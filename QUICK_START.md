# HaliSoft - Quick Start Guide

Get your subscription system running in 15 minutes.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ running
- [ ] PayPal Sandbox account created
- [ ] Anthropic API key obtained

## Step-by-Step Setup

### 1. Clone & Install (2 mins)

```bash
cd halisoft-subscription-system
npm install
```

### 2. Configure Environment (3 mins)

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# Database (from your PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/halisoft

# JWT Secret (generate random string)
JWT_SECRET=your_super_secret_key_here

# PayPal Sandbox
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=YOUR_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_CLIENT_SECRET
PAYPAL_PRODUCT_ID=PROD-XXXXXXXXXXXX
PAYPAL_WEBHOOK_ID=WH-XXXXXXXXXXXXX

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 3. Database Setup (2 mins)

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data
npm run prisma:seed
```

**Default admin login**:
- Email: `admin@halisoft.com`
- Password: `change_me_on_first_login`

### 4. PayPal Configuration (5 mins)

#### A. Create Product

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com)
2. Navigate to **Catalog → Products**
3. Click **Create Product**
4. Enter:
   - Name: "HaliSoft AI Platform"
   - Type: "Service"
   - Category: "Software"
5. Copy the **Product ID** → paste into `.env` as `PAYPAL_PRODUCT_ID`

#### B. Setup Webhooks

1. Navigate to **Apps & Credentials → REST API apps**
2. Select your app → **Webhooks**
3. Click **Add Webhook**
4. Enter webhook URL: `http://localhost:3001/webhooks/paypal` (for now)
5. Select events:
   - ✅ `BILLING.SUBSCRIPTION.CREATED`
   - ✅ `BILLING.SUBSCRIPTION.ACTIVATED`
   - ✅ `BILLING.SUBSCRIPTION.CANCELLED`
   - ✅ `BILLING.SUBSCRIPTION.SUSPENDED`
   - ✅ `BILLING.SUBSCRIPTION.UPDATED`
   - ✅ `PAYMENT.SALE.COMPLETED`
   - ✅ `PAYMENT.SALE.DENIED`
6. Copy **Webhook ID** → paste into `.env` as `PAYPAL_WEBHOOK_ID`

#### C. Sync Plans to PayPal

```bash
npm run sync-paypal
```

This creates PayPal billing plans for Starter ($299) and Professional ($799).

### 5. Start Server (1 min)

```bash
npm run dev
```

Server starts on http://localhost:3001

### 6. Verify Installation (2 mins)

#### Check Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T...",
  "uptime": 5.123,
  "environment": "development"
}
```

#### Check Plans

```bash
curl http://localhost:3001/api/public/plans
```

Should return 3 plans: Starter, Professional, Enterprise.

#### Test Admin Login

Use Postman or curl to test authentication:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@halisoft.com",
    "password": "change_me_on_first_login"
  }'
```

You'll receive a JWT token.

## 🎉 You're Ready!

Your subscription system is now running with:

✅ **3 Plans**: Starter ($299), Professional ($799), Enterprise (Custom)
✅ **6 AI Components**: Invoice OCR, Risk Assessment, Document Processing, Financial Audit, AR Aging, Currency Conversion
✅ **PayPal Integration**: Ready for test payments
✅ **Admin Dashboard**: Modify plans without code changes

## Next Steps

### For Development

1. **Test Subscription Flow**:
   - Create test user
   - Subscribe to a plan
   - Approve payment in PayPal sandbox
   - Check subscription activation

2. **Test AI Components**:
   ```bash
   curl -X POST http://localhost:3001/api/ai/invoice-ocr/analyze \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"invoiceData": {"number": "INV-001", "amount": 1000}}'
   ```

3. **Modify Plans** (Admin Dashboard):
   - Change Starter price to $349
   - Add new AI component to Professional
   - Watch changes sync to PayPal automatically

### For Production

1. **Deploy to Railway**:
   ```bash
   railway init
   railway add --database postgresql
   railway up
   ```

2. **Update PayPal Webhook**:
   - Change webhook URL to production domain
   - Test with PayPal's webhook simulator

3. **Setup Cron Jobs**:
   - Railway/Vercel will auto-configure from `railway.json`
   - Or use system cron on VPS

4. **Monitor**:
   - Check `/health` endpoint
   - View logs: `railway logs` or `vercel logs`
   - Setup Sentry for error tracking

## Common Issues

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql postgresql://user:password@localhost:5432/halisoft
```

### PayPal Sync Failed

```bash
# Check PayPal credentials
echo $PAYPAL_CLIENT_ID
echo $PAYPAL_CLIENT_SECRET

# Test PayPal authentication manually
curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -u "${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}" \
  -d "grant_type=client_credentials"
```

### Prisma Client Not Generated

```bash
npm run prisma:generate
```

### Port Already in Use

```bash
# Change API_PORT in .env
API_PORT=3002
```

## Support

- 📚 **Full Documentation**: See `README.md`
- 🐛 **Issues**: GitHub Issues
- 💬 **Email**: support@halisoft.com

---

**Pro Tip**: All pricing and features are stored in the database. You can modify them via admin dashboard without redeploying! 🚀
