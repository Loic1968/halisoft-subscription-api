// ═══════════════════════════════════════════════════════════════
// Subscription Middleware
// Check active subscription and attach to request
// ═══════════════════════════════════════════════════════════════

import { Response, NextFunction } from 'express';
import { PrismaClient, Subscription, SubscriptionPlan } from '@prisma/client';
import { AuthenticatedRequest } from './auth';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface SubscriptionRequest extends AuthenticatedRequest {
  subscription?: Subscription & { plan: SubscriptionPlan };
}

/**
 * Check that user has an active subscription
 */
export async function checkSubscription(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      res.status(403).json({
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION',
        message: 'You need an active subscription to use this feature',
        upgradeUrl: '/pricing',
      });
      return;
    }

    // Check if subscription is expired
    if (
      subscription.currentPeriodEnd &&
      new Date() > subscription.currentPeriodEnd
    ) {
      res.status(403).json({
        error: 'Subscription expired',
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue.',
        renewUrl: '/settings/billing',
      });
      return;
    }

    // Attach subscription to request
    req.subscription = subscription;

    next();
  } catch (error: any) {
    logger.error('Subscription check failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to verify subscription',
    });
  }
}

/**
 * Check subscription but don't fail if missing (for freemium features)
 */
export async function optionalSubscription(
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      next();
      return;
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    if (subscription) {
      req.subscription = subscription;
    }

    next();
  } catch (error) {
    // Silently fail for optional subscription
    next();
  }
}
