# HaliSoft - Production Deployment Checklist

Complete checklist for deploying to production.

## Pre-Deployment (Local)

### ✅ 1. Environment Setup

- [ ] All environment variables configured in `.env`
- [ ] Database migrations tested locally
- [ ] Seed data executed successfully
- [ ] PayPal sandbox tested end-to-end
- [ ] Admin login verified
- [ ] All tests passing (`npm test`)

### ✅ 2. PayPal Configuration

- [ ] PayPal Product created (save `PAYPAL_PRODUCT_ID`)
- [ ] Webhook configured (will update URL after deployment)
- [ ] Plans synced to PayPal (`npm run sync-paypal`)
- [ ] Test subscription completed in sandbox

### ✅ 3. Security Review

- [ ] JWT_SECRET is strong random string (32+ characters)
- [ ] Admin password changed from default
- [ ] Database credentials secure
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled

## Deployment to Railway

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Initialize Project

```bash
cd halisoft-subscription-system
railway init
```

### Step 3: Add PostgreSQL

```bash
railway add --database postgresql
```

Railway automatically sets `DATABASE_URL` environment variable.

### Step 4: Configure Environment Variables

```bash
# Set all required variables
railway variables set JWT_SECRET="your_production_secret_here"
railway variables set PAYPAL_MODE="live"
railway variables set PAYPAL_CLIENT_ID="your_live_client_id"
railway variables set PAYPAL_CLIENT_SECRET="your_live_client_secret"
railway variables set PAYPAL_PRODUCT_ID="PROD-XXXXXXXXXXXX"
railway variables set PAYPAL_WEBHOOK_ID="WH-XXXXXXXXXXXXX"
railway variables set ANTHROPIC_API_KEY="sk-ant-xxxxx"
railway variables set SMTP_HOST="smtp.gmail.com"
railway variables set SMTP_USER="noreply@halisoft.com"
railway variables set SMTP_PASSWORD="your_smtp_password"
railway variables set APP_URL="https://api.yourdomain.com"
railway variables set FRONTEND_URL="https://yourdomain.com"
```

### Step 5: Deploy

```bash
railway up
```

Railway will:
1. Build TypeScript code
2. Run Prisma migrations
3. Start the server
4. Provide a URL (e.g., `https://xyz.railway.app`)

### Step 6: Run Seed (First Time Only)

```bash
railway run npm run prisma:seed
```

This creates:
- Initial plans (Starter, Professional, Enterprise)
- AI components
- Admin user

### Step 7: Sync PayPal Plans

```bash
railway run npm run sync-paypal
```

This creates billing plans in PayPal for production.

### Step 8: Setup Custom Domain

```bash
railway domain
# Follow prompts to add custom domain
```

Configure DNS:
```
Type: CNAME
Name: api
Value: xyz.railway.app
```

### Step 9: Update PayPal Webhook

1. Go to PayPal Developer Dashboard
2. Navigate to your webhook
3. Update URL to: `https://api.yourdomain.com/webhooks/paypal`
4. Test with PayPal's webhook simulator

### Step 10: Verify Deployment

```bash
# Health check
curl https://api.yourdomain.com/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "uptime": 123,
#   "environment": "production"
# }

# Check plans
curl https://api.yourdomain.com/api/public/plans
```

## Deployment to Vercel

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Initialize Project

```bash
cd halisoft-subscription-system
vercel
```

### Step 3: Add PostgreSQL

Use Vercel Storage or external provider:
- Vercel Storage: `vercel storage create postgres`
- External: Railway, Supabase, Neon, etc.

Set `DATABASE_URL` in Vercel dashboard.

### Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```
JWT_SECRET=your_production_secret_here
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_client_secret
PAYPAL_PRODUCT_ID=PROD-XXXXXXXXXXXX
PAYPAL_WEBHOOK_ID=WH-XXXXXXXXXXXXX
ANTHROPIC_API_KEY=sk-ant-xxxxx
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@halisoft.com
SMTP_PASSWORD=your_smtp_password
APP_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Step 5: Deploy

```bash
vercel --prod
```

### Step 6: Run Database Commands

```bash
# SSH into Vercel (or use local with production DATABASE_URL)
npx prisma migrate deploy
npx prisma db seed
npm run sync-paypal
```

### Step 7: Setup Custom Domain

In Vercel Dashboard → Settings → Domains:
- Add: `api.yourdomain.com`
- Configure DNS as instructed

### Step 8: Update PayPal Webhook

Same as Railway Step 9 above.

## Post-Deployment

### ✅ 1. Monitoring Setup

- [ ] Health endpoint monitored: `GET /health`
- [ ] Error tracking (Sentry):
  ```bash
  railway variables set SENTRY_DSN="your_sentry_dsn"
  railway variables set SENTRY_ENVIRONMENT="production"
  ```
- [ ] Log monitoring:
  ```bash
  railway logs --follow
  # or
  vercel logs --follow
  ```

### ✅ 2. Testing Production

#### Test Subscription Flow

```bash
# 1. Create test user via API
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "firstName": "Test",
    "lastName": "User"
  }'

# 2. Login to get JWT
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'

# 3. Create subscription
curl -X POST https://api.yourdomain.com/api/subscriptions/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "uuid-of-starter-plan"
  }'

# 4. Complete PayPal approval flow
# 5. Verify subscription activated
# 6. Test AI component execution
```

#### Test Quota Enforcement

```bash
# Execute AI component multiple times
for i in {1..5}; do
  curl -X POST https://api.yourdomain.com/api/ai/invoice-ocr/analyze \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"invoiceData": {"number": "INV-'$i'", "amount": 1000}}'
  echo "\nCall $i completed"
done

# Check usage
curl https://api.yourdomain.com/api/subscriptions/current \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test Admin Dashboard

1. Login as admin: `admin@halisoft.com`
2. Change plan price
3. Verify change appears in pricing page
4. Check audit log created

### ✅ 3. Backup Strategy

```bash
# Automated daily backups with Railway
railway plugin add postgresql-backup

# Or manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### ✅ 4. Cron Jobs Verification

Check cron jobs are running:

```bash
# Railway: Check railway.json
# Vercel: Check vercel.json

# Manually trigger to test
railway run npm run cron:quotas
railway run npm run cron:warnings
```

### ✅ 5. Email Testing

Send test emails:

```bash
# Manually trigger quota warning
# Set usage to 85% for a subscription, then run:
railway run npm run cron:warnings
```

Check:
- [ ] Welcome emails sent on subscription
- [ ] Quota warnings sent at 80%, 90%
- [ ] Monthly reports sent
- [ ] Payment receipts sent

### ✅ 6. Performance Optimization

#### Database Indexing

```sql
-- Already included in schema, but verify:
CREATE INDEX idx_subscription_user ON subscriptions(user_id, status);
CREATE INDEX idx_usage_tracking ON usage_tracking(subscription_id, period_start);
CREATE INDEX idx_paypal_events ON paypal_events(event_type, processed);
```

#### Connection Pooling

Check Prisma connection pool:
```typescript
// In production, increase if needed:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection limit
}
```

### ✅ 7. Security Hardening

- [ ] HTTPS enforced (Railway/Vercel automatic)
- [ ] Helmet.js configured (already in code)
- [ ] Rate limiting enabled
- [ ] CORS restricted to production domain
- [ ] PayPal webhook signature verified
- [ ] JWT tokens expire appropriately (7 days default)

### ✅ 8. Documentation

- [ ] Admin credentials documented (securely!)
- [ ] API documentation updated
- [ ] Support team trained
- [ ] Runbook created for common issues

## Scaling Considerations

### When to Scale Up

Monitor these metrics:
- Database connection count approaching limit
- API response times > 500ms
- Error rate > 1%
- CPU/Memory usage > 80%

### Scaling Options

#### Railway
```bash
# Upgrade plan in dashboard
# Auto-scaling available on Pro plan
```

#### Vercel
- Serverless functions auto-scale
- Upgrade for more concurrent executions

#### Database Scaling
- Add read replicas for heavy read load
- Connection pooling via PgBouncer
- Consider managed PostgreSQL (Neon, Supabase)

## Rollback Plan

If deployment fails:

### Railway
```bash
# Rollback to previous deployment
railway rollback
```

### Vercel
```bash
# In Vercel Dashboard → Deployments
# Click "Promote to Production" on previous deployment
```

### Database Rollback
```bash
# If migrations failed
npx prisma migrate resolve --rolled-back "migration_name"
```

## Support & Monitoring

### Log Monitoring

```bash
# Railway
railway logs --follow

# Vercel
vercel logs --follow

# Filter errors only
railway logs --follow | grep ERROR
```

### Health Checks

Setup monitoring service (UptimeRobot, Pingdom) for:
- Endpoint: `https://api.yourdomain.com/health`
- Frequency: Every 5 minutes
- Alert: If status ≠ 200 or response includes "unhealthy"

### Error Alerts

Sentry integration sends alerts for:
- Unhandled exceptions
- API errors
- Database connection failures
- PayPal webhook failures

## Production Checklist Summary

- [x] Environment variables configured
- [x] Database deployed and migrated
- [x] Seed data loaded
- [x] PayPal production plans synced
- [x] Webhook URL updated
- [x] Custom domain configured
- [x] SSL certificate active
- [x] Cron jobs running
- [x] Monitoring setup
- [x] Backups configured
- [x] Test subscription completed
- [x] Admin access verified
- [x] Support team notified
- [x] Rollback plan documented

## 🎉 Launch!

Once all checks pass:

1. Announce to team
2. Monitor logs closely for first 24 hours
3. Check error rates in Sentry
4. Verify cron jobs execute
5. Test real subscriptions with payment

---

**Emergency Contact**: support@halisoft.com

**Remember**: All pricing and features are configurable via admin dashboard. No redeployment needed for price changes! 🚀
