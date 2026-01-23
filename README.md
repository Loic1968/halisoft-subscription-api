# HaliSoft Subscription System

**Configuration-first** subscription management system for AI components with PayPal integration.

## 🎯 Key Features

- ✅ **Zero Hardcoded Pricing** - All plans and features configurable via admin dashboard
- ✅ **Dynamic Feature Gating** - AI components access controlled by subscription plan
- ✅ **Smart Quota Enforcement** - Real-time usage tracking with automatic quota resets
- ✅ **PayPal Integration** - Automated billing with webhook handling
- ✅ **Multi-tenant Support** - White-label deployments for Enterprise clients
- ✅ **Usage Analytics** - Comprehensive tracking of AI component usage
- ✅ **Email Notifications** - Quota warnings, receipts, and reports

## 🏗️ Architecture

### Backend (Node.js + Express + Prisma + PostgreSQL)
- **Services**: PayPal, Subscription, Usage Tracking, Email
- **Middleware**: Authentication, Quota Enforcement, Feature Gating
- **Routes**: Subscriptions, AI Components, Admin, Webhooks

### Frontend (React + TypeScript)
- **Hooks**: `useSubscription`, `useAIComponent`
- **Components**: PricingPage, UserDashboard, Admin panels
- **Real-time Quota Display**: Live usage updates

### Database (PostgreSQL + Prisma ORM)
- Plans, AI Components, Subscriptions, Usage Tracking
- Audit logs for all admin changes
- Multi-tenant support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- PayPal Developer Account
- Anthropic API Key

### 1. Installation

```bash
# Clone repository
cd halisoft-subscription-system

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials
```

### 2. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data (plans, AI components, admin user)
npm run prisma:seed
```

### 3. PayPal Configuration

#### Create Product (One-time setup)
1. Log into [PayPal Developer Dashboard](https://developer.paypal.com)
2. Navigate to **Catalog → Products**
3. Create product: "HaliSoft AI Platform"
4. Copy `PAYPAL_PRODUCT_ID` to `.env`

#### Configure Webhooks
1. Navigate to **Webhooks** in PayPal Dashboard
2. Create webhook: `https://yourdomain.com/webhooks/paypal`
3. Subscribe to events:
   - `BILLING.SUBSCRIPTION.*`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.DENIED`
4. Copy `PAYPAL_WEBHOOK_ID` to `.env`

#### Sync Plans to PayPal
```bash
# After first deployment
npm run sync-paypal
```

This creates billing plans in PayPal for each plan in your database.

### 4. Start Development Server

```bash
# Start backend API
npm run dev

# Backend runs on http://localhost:3001
```

### 5. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3001/health

# Response:
# {
#   "status": "healthy",
#   "timestamp": "2025-01-23T...",
#   "uptime": 123.45,
#   "environment": "development"
# }
```

## 📋 Configuration

### Admin Access

Default admin credentials (change immediately):
- **Email**: `admin@halisoft.com`
- **Password**: `change_me_on_first_login`

### Environment Variables

See `.env.example` for all required variables:

**Critical Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secure random string for JWT signing
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` - From PayPal Dashboard
- `ANTHROPIC_API_KEY` - From Anthropic Console

## 🎨 Admin Dashboard Usage

### Modify Plan Pricing

```bash
# Via API
curl -X PATCH https://api.halisoft.com/api/admin/plans/starter \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"basePrice": 349.00}'

# This automatically:
# 1. Updates database
# 2. Creates new PayPal billing plan
# 3. Logs audit trail
```

### Add AI Component to Plan

```bash
curl -X POST https://api.halisoft.com/api/admin/plans/starter/features \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "aiComponentId": "uuid-of-financial-audit-component",
    "enabled": true,
    "limitValue": 50,
    "displayName": "Financial Audit (50/month)"
  }'
```

### View Analytics

Admin dashboard includes:
- **Revenue Metrics**: MRR, ARR, breakdown by plan
- **Usage Analytics**: AI component usage trends
- **Subscription Stats**: Active, churned, upgrades
- **Quota Monitoring**: Components approaching limits

## 🔄 Cron Jobs

Setup automated tasks (recommended: use cron or Railway/Vercel cron):

```bash
# Reset quotas daily at midnight
0 0 * * * cd /path/to/app && npm run cron:quotas

# Send quota warnings every 6 hours
0 */6 * * * cd /path/to/app && npm run cron:warnings
```

### Railway/Vercel Cron

Add to `railway.json` or `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/cron/reset-quotas",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/cron/quota-warnings",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

### Example Test

```typescript
import { subscriptionService } from './services/SubscriptionService';

test('Starter plan cannot access Financial Audit', async () => {
  const user = await createUserWithPlan('starter');

  const hasAccess = await subscriptionService.hasFeatureAccess(
    user.subscriptionId,
    'financial_audit'
  );

  expect(hasAccess.hasAccess).toBe(false);
});
```

## 🚀 Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add --database postgresql

# Deploy
railway up
```

Railway auto-configures:
- `DATABASE_URL` from PostgreSQL addon
- Environment variables from dashboard
- SSL certificates
- Custom domains

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add PostgreSQL via Vercel Storage
# Configure environment variables in dashboard
```

### Environment Setup

After deployment, configure:

1. **Database**: Add connection string to `DATABASE_URL`
2. **PayPal Webhook**: Update webhook URL to production domain
3. **Environment Variables**: Set all production variables
4. **Sync PayPal Plans**: Run `npm run sync-paypal` once

## 📊 Monitoring

### Logs

```bash
# View logs
tail -f logs/combined.log
tail -f logs/error.log

# Railway
railway logs

# Vercel
vercel logs
```

### Health Checks

- **Endpoint**: `GET /health`
- **Database**: Prisma health check on startup
- **PayPal**: Token refresh every 8 hours

### Sentry Integration (Optional)

Add to `.env`:
```
SENTRY_DSN=your_sentry_dsn
SENTRY_ENVIRONMENT=production
```

## 🔐 Security

- ✅ JWT authentication with secure secrets
- ✅ Helmet.js for HTTP security headers
- ✅ Rate limiting on sensitive endpoints
- ✅ PayPal webhook signature verification
- ✅ SQL injection protection via Prisma
- ✅ CORS configured for frontend domain only

## 📈 Scaling Considerations

### Database Optimization
- Add indexes on frequently queried fields
- Consider connection pooling for high traffic
- Regular VACUUM and ANALYZE for PostgreSQL

### Redis Caching
Optional Redis integration for:
- Session management
- Rate limiting
- Quota caching

### Load Balancing
For high traffic:
- Deploy multiple API instances
- Use Railway/Vercel auto-scaling
- Database read replicas

## 🤝 Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@halisoft.com

## 📄 License

MIT License - See LICENSE file

---

## 🎯 Next Steps

1. ✅ Deploy to Railway/Vercel
2. ✅ Configure PayPal webhooks
3. ✅ Sync plans to PayPal
4. ✅ Test subscription flow end-to-end
5. ✅ Set up monitoring and alerts
6. ✅ Launch! 🚀

**Remember**: All pricing and features are configurable via admin dashboard - NO CODE CHANGES NEEDED! 🎉
