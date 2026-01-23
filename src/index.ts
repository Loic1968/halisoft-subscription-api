// ═══════════════════════════════════════════════════════════════
// Main Application Entry Point
// HaliSoft Subscription System API
// ═══════════════════════════════════════════════════════════════

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Import routes
import subscriptionRoutes from './routes/subscriptions';
import aiComponentRoutes from './routes/ai-components';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';

// Initialize Express app
const app: Express = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Body parsing
// Special handling for webhooks (need raw body)
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/ai', aiComponentRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Public endpoints (no auth required)
app.get('/api/public/plans', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        features: {
          where: { enabled: true },
          include: {
            aiComponent: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        },
        additionalFeatures: {
          where: { enabled: true },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    res.json({ plans });
  } catch (error: any) {
    logger.error('Failed to fetch public plans', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════

async function startServer() {
  try {
    // Verify database connection
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Verify required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'JWT_SECRET',
    ];

    // Optional env vars (warn if missing)
    const optionalEnvVars = [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'ANTHROPIC_API_KEY',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        logger.warn(`Optional environment variable not set: ${envVar}`);
      }
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 HaliSoft Subscription API running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API URL: http://localhost:${PORT}`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;
