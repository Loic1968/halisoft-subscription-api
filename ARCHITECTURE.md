# HaliSoft - System Architecture

## Overview

Configuration-first subscription system built for **zero hardcoded values**. All pricing, features, and quotas are dynamically loaded from the database and modifiable via admin dashboard.

## Core Principles

1. **Configuration-First**: No hardcoded prices or feature flags
2. **Dynamic Feature Gating**: Plan access controlled by database config
3. **Real-time Quota Enforcement**: Usage tracked and enforced per component
4. **Audit Trail**: All admin changes logged
5. **Fail-Safe**: Graceful degradation if quotas exceeded

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  React Components                                           │
│  ├─ PricingPage (dynamic, loads from API)                  │
│  ├─ UserDashboard (real-time usage)                        │
│  └─ AdminDashboard (config management)                     │
│                                                             │
│  React Hooks                                                │
│  ├─ useSubscription (state management)                     │
│  └─ useAIComponent (execution + quota check)               │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Routes                                                     │
│  ├─ /api/subscriptions (user subscription management)      │
│  ├─ /api/ai/* (AI component execution)                     │
│  ├─ /api/admin/* (config management)                       │
│  └─ /webhooks/paypal (payment events)                      │
│                                                             │
│  Middleware Chain                                           │
│  ├─ authenticateUser (JWT verification)                    │
│  ├─ checkSubscription (active subscription required)       │
│  ├─ enforceQuota (component access + quota check)          │
│  └─ trackUsage (increment usage after execution)           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  SubscriptionService                                        │
│  ├─ createSubscription (initiate PayPal flow)              │
│  ├─ activateSubscription (after PayPal approval)           │
│  ├─ changeSubscriptionPlan (upgrade/downgrade)             │
│  ├─ cancelSubscription (end subscription)                  │
│  └─ hasFeatureAccess (dynamic permission check)            │
│                                                             │
│  UsageTrackingService                                       │
│  ├─ incrementUsage (track AI component calls)              │
│  ├─ getCurrentPeriodUsage (real-time stats)                │
│  ├─ isQuotaExceeded (hard limit check)                     │
│  ├─ resetQuotas (monthly reset)                            │
│  └─ getUsageAnalytics (admin reporting)                    │
│                                                             │
│  PayPalService                                              │
│  ├─ createBillingPlan (sync plans to PayPal)               │
│  ├─ updatePlanPricing (price changes)                      │
│  ├─ createSubscription (user checkout)                     │
│  ├─ verifyWebhookSignature (security)                      │
│  └─ cancelSubscription (terminate billing)                 │
│                                                             │
│  EmailService                                               │
│  ├─ sendWelcomeEmail                                        │
│  ├─ sendQuotaWarningEmail (80%, 90% thresholds)            │
│  ├─ sendQuotaExceededEmail                                 │
│  ├─ sendPaymentReceipt                                     │
│  ├─ sendMonthlyUsageReport                                 │
│  └─ sendPaymentFailedEmail                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database (via Prisma ORM)                      │
│                                                             │
│  Core Tables:                                               │
│  ├─ SubscriptionPlan                                        │
│  │   └─ basePrice, billingPeriod, isCustomPricing         │
│  ├─ AIComponent                                             │
│  │   └─ name, slug, category, baseTokenCost               │
│  ├─ PlanFeature (many-to-many)                             │
│  │   └─ planId, aiComponentId, enabled, limitValue        │
│  ├─ Subscription                                            │
│  │   └─ userId, planId, status, currentPeriodEnd          │
│  ├─ UsageTracking                                           │
│  │   └─ subscriptionId, aiComponentId, value, period      │
│  ├─ Tenant (multi-tenant support)                          │
│  │   └─ brandingJson, customDomain, ssoConfig             │
│  └─ AuditLog                                                │
│      └─ userId, action, changesBefore, changesAfter        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────┤
│  PayPal Billing API                                         │
│  ├─ Create billing plans                                    │
│  ├─ Manage subscriptions                                    │
│  └─ Webhook events (payment, cancellation)                 │
│                                                             │
│  Anthropic Claude API                                       │
│  ├─ Invoice OCR & Analysis                                 │
│  ├─ Risk Assessment                                         │
│  ├─ Document Processing                                     │
│  └─ Financial Audit Tools                                   │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Example

### AI Component Execution with Quota Enforcement

```
1. User calls: POST /api/ai/invoice-ocr/analyze
                ↓
2. authenticateUser middleware
   → Verify JWT token
   → Attach user to request
                ↓
3. checkSubscription middleware
   → Find active subscription
   → Check not expired
   → Attach subscription + plan to request
                ↓
4. enforceQuota('invoice_ocr') middleware
   → Load plan features from DB (dynamic!)
   → Check if 'invoice_ocr' enabled for this plan
   → Get current usage from UsageTracking
   → Compare usage vs limitValue
   → If exceeded: return 429 Quota Exceeded
   → If OK: attach quota info to request
                ↓
5. Route handler
   → Execute AI component (call Claude API)
   → Get result
                ↓
6. trackUsage('invoice_ocr', 1) middleware
   → Increment usage counter
   → Check if approaching 80%/90% threshold
   → Send warning email if needed
                ↓
7. Response
   → Return AI result + quota info to client
```

## Configuration Flow

### Admin Changes Plan Pricing

```
1. Admin calls: PATCH /api/admin/plans/starter
   Body: { "basePrice": 349.00 }
                ↓
2. requireAdmin middleware
   → Verify admin role
                ↓
3. Admin route handler
   → Load current plan from DB
   → Update basePrice = 349.00
   → Call PayPalService.updatePlanPricing()
     → Create new PayPal billing plan
     → Deactivate old plan
     → Return new paypalPlanId
   → Update plan.paypalPlanId in DB
   → Create AuditLog entry
                ↓
4. Response
   → Return updated plan
                ↓
5. ZERO CODE DEPLOYMENT NEEDED!
   → All users immediately see new price
   → Existing subscriptions unaffected
   → New subscriptions use new price
```

## Database Schema Design

### Why Configuration-First Works

```sql
-- Example: Starter Plan configuration
-- Plan
SubscriptionPlan {
  id: "uuid-starter",
  name: "Starter",
  basePrice: 299.00,  -- ✅ MODIFIABLE via admin
  isActive: true
}

-- Features (many-to-many)
PlanFeature {
  planId: "uuid-starter",
  aiComponentId: "uuid-invoice-ocr",
  enabled: true,        -- ✅ Toggle via admin
  limitValue: 100       -- ✅ Change quota via admin
}

PlanFeature {
  planId: "uuid-starter",
  aiComponentId: "uuid-financial-audit",
  enabled: false,       -- ✅ Not available in Starter
  limitValue: null
}
```

**Result**: Admin can:
- Change price: `basePrice = 349`
- Increase quota: `limitValue = 150`
- Enable feature: `enabled = true`
- All without touching code!

## Quota System Design

### Usage Tracking

```typescript
// Each subscription has usage entries per component
UsageTracking {
  subscriptionId: "uuid",
  aiComponentId: "invoice_ocr",
  metricType: "count",
  value: 47,  // Current usage
  periodStart: "2025-01-01",
  periodEnd: "2025-02-01"
}

// Plan defines limit
PlanFeature {
  limitValue: 100  // Max allowed
}

// Enforcement
if (value >= limitValue) {
  return 429 Quota Exceeded
}
```

### Quota Reset Logic

```typescript
// Cron job runs daily
for (subscription in expiringSubscriptions) {
  // Get last period usage
  const usage = getUsage(subscription.id);

  // Send monthly report
  sendMonthlyUsageReport(usage);

  // Reset all counters to 0
  resetQuotas(subscription.id);

  // Initialize new period
  initializeUsageForSubscription(
    subscription.id,
    newPeriodStart,
    newPeriodEnd
  );
}
```

## Multi-Tenant Architecture

### White-Label Deployment

```
Tenant {
  id: "tenant-acme-factoring",
  name: "ACME Factoring",
  subdomain: "acme",           // acme.halisoft.com
  customDomain: "ai.acme.com", // CNAME setup

  brandingJson: {
    logo_url: "https://cdn.acme.com/logo.png",
    primary_color: "#FF5733",
    secondary_color: "#33C3FF",
    fonts: {
      heading: "Montserrat",
      body: "Inter"
    }
  },

  customAIModelsJson: {
    invoice_ocr: "path/to/acme-trained-model.pkl"
  },

  ssoEnabled: true,
  ssoProvider: "saml",
  ssoConfigJson: {
    entityId: "https://acme.com/saml",
    ssoUrl: "https://sso.acme.com/login",
    certificate: "..."
  }
}
```

Each tenant gets:
- Custom domain/subdomain
- Branded UI (logo, colors, fonts)
- Custom AI models trained on their data
- SSO integration
- Isolated subscriptions and users

## Security Model

### Authentication Flow

```
1. User logs in
   → POST /api/auth/login
   → Verify email + password
   → Generate JWT token

2. JWT contains:
   {
     userId: "uuid",
     email: "user@example.com",
     role: "USER" | "ADMIN",
     iat: timestamp,
     exp: timestamp (7 days)
   }

3. Every request:
   → authenticateUser middleware
   → Verify JWT signature
   → Check user still active
   → Attach user to request
```

### Quota Enforcement Layers

```
1. Client-side (UX)
   → useSubscription hook
   → isQuotaExceeded() check
   → Disable buttons, show upgrade prompt

2. API middleware (Security)
   → enforceQuota middleware
   → Database check: current usage vs limit
   → Return 429 if exceeded

3. Service layer (Business logic)
   → trackUsage service
   → Increment counter after successful call
   → Send warnings at 80%, 90%
```

## Scalability Considerations

### High Traffic Optimizations

```
1. Database Indexes
   CREATE INDEX idx_subscription_user ON subscriptions(user_id, status);
   CREATE INDEX idx_usage_tracking ON usage_tracking(subscription_id, period_start);

2. Connection Pooling
   Prisma default: 10 connections
   High traffic: Increase to 50-100

3. Redis Caching (optional)
   - Cache plan features (rarely change)
   - Cache user subscriptions
   - Invalidate on admin changes

4. Load Balancing
   - Deploy multiple API instances
   - Railway/Vercel auto-scaling
   - Database read replicas
```

## Monitoring & Observability

### Key Metrics

```
1. Business Metrics
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)
   - Churn rate
   - Subscription conversions
   - Average quota usage per plan

2. System Metrics
   - API response times
   - Database query performance
   - Quota enforcement latency
   - PayPal webhook processing time
   - Claude API token usage

3. User Metrics
   - Active subscriptions by plan
   - Components approaching limits
   - Failed payment rate
   - Support ticket volume
```

### Logging Strategy

```typescript
// Structured logging with Winston
logger.info('Subscription created', {
  subscriptionId: '...',
  userId: '...',
  planSlug: 'professional'
});

logger.error('Quota exceeded', {
  subscriptionId: '...',
  component: 'invoice_ocr',
  used: 105,
  limit: 100
});
```

## Deployment Architecture

### Railway (Recommended)

```
Railway Project
├─ PostgreSQL (managed)
├─ API Service (auto-scaling)
├─ Cron Jobs (from railway.json)
└─ Environment Variables (encrypted)
```

### Vercel (Alternative)

```
Vercel Project
├─ API Routes (serverless functions)
├─ PostgreSQL (via Vercel Storage)
└─ Cron Jobs (from vercel.json)
```

Both platforms:
- Auto SSL certificates
- Custom domains
- Environment variable management
- One-click deployments
- Built-in monitoring

---

**Key Takeaway**: The entire system is built around the principle that **configuration should live in the database, not in code**. This allows non-technical admins to modify pricing, features, and quotas without deployments! 🚀
