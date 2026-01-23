# HaliSoft Subscription System - Complete File Index

Quick reference to navigate the complete codebase.

---

## 📚 Start Here (Documentation)

| File | Purpose | Read Time |
|------|---------|-----------|
| **[README.md](README.md)** | Complete system documentation | 10 min |
| **[QUICK_START.md](QUICK_START.md)** | 15-minute setup guide | 5 min |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | High-level overview | 5 min |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System design deep-dive | 15 min |
| **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** | File organization guide | 10 min |
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Production deployment guide | 10 min |
| **[INDEX.md](INDEX.md)** | This file - navigation guide | 2 min |

**Recommended Reading Order**:
1. PROJECT_SUMMARY.md (understand what we built)
2. QUICK_START.md (get it running)
3. ARCHITECTURE.md (understand how it works)
4. PROJECT_STRUCTURE.md (navigate the code)
5. DEPLOYMENT_CHECKLIST.md (deploy to production)

---

## ⚙️ Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies & npm scripts |
| `tsconfig.json` | TypeScript configuration |
| `.env.example` | Environment variables template |
| `railway.json` | Railway deployment config |
| `vercel.json` | Vercel deployment config |

---

## 🗄️ Database (Prisma)

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | **CRITICAL** - Database schema (configuration-first design) |
| `prisma/seed.ts` | Initial data: plans, components, admin user |

**Key Models in schema.prisma**:
- `SubscriptionPlan` - Pricing plans (Starter, Pro, Enterprise)
- `AIComponent` - AI features (Invoice OCR, Risk Assessment, etc.)
- `PlanFeature` - Which components are in which plans (many-to-many)
- `Subscription` - User subscriptions
- `UsageTracking` - Quota usage tracking
- `Tenant` - Multi-tenant support
- `AuditLog` - Admin change tracking

---

## 🔧 Backend Code

### Entry Point
| File | Purpose |
|------|---------|
| `src/index.ts` | **START HERE** - Main application entry point |

### Services (Business Logic)
| File | Key Responsibilities |
|------|---------------------|
| `src/services/PayPalService.ts` | PayPal Billing API integration |
| `src/services/SubscriptionService.ts` | **CORE** - Subscription lifecycle management |
| `src/services/UsageTrackingService.ts` | **CORE** - Quota tracking & enforcement |
| `src/services/EmailService.ts` | Transactional emails (welcome, warnings, reports) |

### Middleware (Request Pipeline)
| File | Purpose |
|------|---------|
| `src/middleware/auth.ts` | JWT authentication |
| `src/middleware/subscription.ts` | Check active subscription |
| `src/middleware/quotaEnforcement.ts` | **CORE** - Dynamic quota checking |

### Routes (API Endpoints)
| File | Endpoints |
|------|-----------|
| `src/routes/subscriptions.ts` | `/api/subscriptions/*` - User subscription management |
| `src/routes/ai-components.ts` | `/api/ai/*` - AI component execution |
| `src/routes/admin.ts` | `/api/admin/*` - Admin configuration |
| `src/routes/webhooks.ts` | `/webhooks/paypal` - PayPal event handling |

### Utilities
| File | Purpose |
|------|---------|
| `src/utils/logger.ts` | Winston logger configuration |

### Cron Jobs
| File | Schedule | Purpose |
|------|----------|---------|
| `src/cron/reset-monthly-quotas.ts` | Daily at midnight | Reset quotas, send reports |
| `src/cron/quota-warnings.ts` | Every 6 hours | Send usage warnings (80%, 90%, 100%) |

### Tests
| File | Tests |
|------|-------|
| `src/__tests__/subscription.test.ts` | Configuration-first validation, quota enforcement, feature gating |

---

## 🎨 Frontend Code

### React Hooks
| File | Purpose |
|------|---------|
| `frontend/hooks/useSubscription.ts` | **ESSENTIAL** - Subscription state management |
| `frontend/hooks/useAIComponent.ts` | **ESSENTIAL** - AI component execution with quota check |

**useSubscription provides**:
- `subscription` - Current subscription object
- `usage` - Real-time usage stats
- `hasFeature(slug)` - Check component access
- `isQuotaExceeded(slug)` - Check limits
- `cancelSubscription()` - Cancel flow
- `changePlan(planId)` - Upgrade/downgrade

**useAIComponent provides**:
- `execute(params)` - Run AI component
- `loading` - Execution state
- `error` - Error messages
- Automatic quota checking

### React Components
| File | Purpose |
|------|---------|
| `frontend/components/PricingPage.tsx` | **DYNAMIC** - Pricing page (loads from API, no hardcoded prices!) |
| `frontend/components/UserDashboard.tsx` | User dashboard with usage stats |

---

## 📊 Data Flow Reference

### 1. User Subscribes to Plan

```
Frontend: POST /api/subscriptions/create
    ↓
Backend: SubscriptionService.createSubscription()
    → Load plan from database (dynamic pricing!)
    → Create PayPal subscription
    → Return approval URL
    ↓
User approves payment in PayPal
    ↓
PayPal Webhook: BILLING.SUBSCRIPTION.ACTIVATED
    → POST /webhooks/paypal
    ↓
Backend: SubscriptionService.activateSubscription()
    → Update status to ACTIVE
    → Initialize usage tracking
    → Send welcome email
    ↓
Frontend: Dashboard shows active subscription
```

### 2. User Executes AI Component

```
Frontend: useAIComponent('invoice_ocr').execute()
    ↓
POST /api/ai/invoice-ocr/analyze
    ↓
Middleware Chain:
    → authenticateUser (verify JWT)
    → checkSubscription (load active subscription)
    → enforceQuota('invoice_ocr'):
        → Load plan features from database
        → Check if enabled for this plan
        → Check usage vs limit
        → If exceeded: return 429
        → If OK: continue
    ↓
Route Handler:
    → Call Anthropic Claude API
    → Get result
    ↓
trackUsage middleware:
    → Increment counter in database
    → Check if approaching 80%/90%
    → Send warning if needed
    ↓
Response: Return result + quota info
    ↓
Frontend: Update usage display
```

### 3. Admin Changes Pricing

```
Admin Dashboard: Change Starter price to $349
    ↓
PATCH /api/admin/plans/starter { basePrice: 349 }
    ↓
Backend:
    → requireAdmin middleware (verify role)
    → Load current plan from database
    → Update plan.basePrice = 349
    → PayPalService.updatePlanPricing():
        → Create new PayPal billing plan
        → Deactivate old plan
    → Update database with new paypalPlanId
    → Create AuditLog entry
    ↓
Result:
    ✓ New price effective immediately
    ✓ Existing subscriptions unaffected
    ✓ New subscriptions use $349
    ✓ NO CODE DEPLOYMENT NEEDED!
```

---

## 🚀 Deployment Files

| File | Platform | Purpose |
|------|----------|---------|
| `railway.json` | Railway | Deployment config, cron jobs |
| `vercel.json` | Vercel | Deployment config, cron jobs |

Both include:
- Build commands
- Start commands
- Health check config
- Cron job schedules

---

## 🔍 Key Code Locations

### Configuration-First Examples

**Where Pricing is Stored**:
```typescript
// File: prisma/schema.prisma
model SubscriptionPlan {
  basePrice Decimal?  // ← Admin can modify this!
}
```

**How It's Loaded**:
```typescript
// File: src/routes/admin.ts
const plan = await prisma.subscriptionPlan.findUnique({
  where: { slug: 'starter' }
});

const price = plan.basePrice; // From database, not hardcoded!
```

**How Admin Changes It**:
```typescript
// File: src/routes/admin.ts - PATCH /api/admin/plans/:id
await prisma.subscriptionPlan.update({
  where: { id },
  data: { basePrice: new Prisma.Decimal(349.00) }
});

// Automatically syncs to PayPal
await paypalService.updatePlanPricing(plan.paypalPlanId, 349.00);
```

### Quota Enforcement Examples

**Where Quotas are Stored**:
```typescript
// File: prisma/schema.prisma
model PlanFeature {
  enabled    Boolean  // ← Admin can toggle
  limitValue Int?     // ← Admin can change quota
}
```

**How It's Checked**:
```typescript
// File: src/middleware/quotaEnforcement.ts
const feature = await prisma.planFeature.findFirst({
  where: {
    planId: subscription.plan.id,
    aiComponentId: component.id,
    enabled: true
  }
});

if (!feature) {
  return res.status(403).json({
    error: 'Not available in your plan'
  });
}

const usage = await getUsage(subscription.id, component.id);

if (usage >= feature.limitValue) {
  return res.status(429).json({
    error: 'Quota exceeded',
    current: usage,
    limit: feature.limitValue
  });
}
```

### Dynamic Feature Gating

**Frontend Check**:
```typescript
// File: frontend/hooks/useSubscription.ts
const hasFeature = (componentSlug: string): boolean => {
  return subscription.plan.features.some(
    (f) => f.aiComponent.slug === componentSlug && f.enabled
  );
};
```

**Backend Enforcement**:
```typescript
// File: src/middleware/quotaEnforcement.ts
export function enforceQuota(componentSlug: string) {
  // Dynamically checks database at runtime
  // NO hardcoded permissions!
}
```

---

## 📝 Common Tasks - Quick Reference

### Task: Change Plan Pricing

1. **Files Involved**:
   - Admin calls: `src/routes/admin.ts` (PATCH `/api/admin/plans/:id`)
   - Service: `src/services/PayPalService.ts` (`updatePlanPricing`)
   - Database: `prisma/schema.prisma` (`SubscriptionPlan.basePrice`)

2. **What Happens**:
   - Admin sends new price
   - Database updated
   - New PayPal plan created
   - Old plan deactivated
   - Audit log created
   - **No code deployment needed!**

### Task: Add AI Component to Plan

1. **Files Involved**:
   - Admin calls: `src/routes/admin.ts` (POST `/api/admin/plans/:id/features`)
   - Database: `prisma/schema.prisma` (`PlanFeature`)

2. **What Happens**:
   - Admin enables component for plan
   - Sets quota limit
   - Database updated
   - **Feature immediately available to users!**

### Task: Execute AI Component

1. **Files Involved**:
   - Frontend: `frontend/hooks/useAIComponent.ts`
   - API: `src/routes/ai-components.ts`
   - Middleware: `src/middleware/quotaEnforcement.ts`
   - Service: `src/services/UsageTrackingService.ts`

2. **What Happens**:
   - Frontend calls `execute()`
   - Middleware checks subscription & quota
   - If OK: Execute Claude API
   - Track usage in database
   - Return result + quota info

### Task: Reset Monthly Quotas

1. **Files Involved**:
   - Cron: `src/cron/reset-monthly-quotas.ts`
   - Service: `src/services/UsageTrackingService.ts`
   - Email: `src/services/EmailService.ts`

2. **What Happens** (Daily at midnight):
   - Find expiring subscriptions
   - Get last month usage
   - Send monthly report email
   - Reset usage counters
   - Initialize new period

---

## 🆘 Troubleshooting Guide

### Problem: Can't Connect to Database

**Check**:
- `.env` file: `DATABASE_URL` correct?
- PostgreSQL running: `pg_isready`
- Prisma client generated: `npm run prisma:generate`

**Files to Check**:
- `.env`
- `prisma/schema.prisma`
- `src/index.ts` (database connection)

### Problem: PayPal Integration Not Working

**Check**:
- `.env` file: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- PayPal mode: `PAYPAL_MODE=sandbox` for testing
- Plans synced: `npm run sync-paypal`

**Files to Check**:
- `src/services/PayPalService.ts`
- `src/routes/webhooks.ts`

### Problem: Quota Not Enforced

**Check**:
- Plan features configured in database
- Usage tracking initialized
- Middleware chain correct in routes

**Files to Check**:
- `src/middleware/quotaEnforcement.ts`
- `src/services/UsageTrackingService.ts`
- `src/routes/ai-components.ts`

### Problem: Emails Not Sending

**Check**:
- `.env` file: SMTP credentials
- Email service configured

**Files to Check**:
- `src/services/EmailService.ts`
- `.env` (SMTP settings)

---

## 🎯 For New Developers

### First Time Setup

1. Read: **[QUICK_START.md](QUICK_START.md)**
2. Configure: `.env` file
3. Run: `npm install`
4. Database: `npm run prisma:migrate && npm run prisma:seed`
5. Start: `npm run dev`
6. Test: Visit `http://localhost:3001/health`

### Understanding the System

1. Read: **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - High-level overview
2. Read: **[ARCHITECTURE.md](ARCHITECTURE.md)** - How it works
3. Explore: `src/index.ts` - Start here for code
4. Study: `prisma/schema.prisma` - Database design
5. Trace: Follow data flow in [Data Flow Reference](#data-flow-reference) above

### Making Changes

1. **Pricing/Features**: Admin dashboard (no code changes!)
2. **New AI Component**: Add to `prisma/schema.prisma` → Seed data → Add route
3. **New Plan**: Admin API or seed script
4. **Bug Fix**: Find relevant service → Write test → Fix → Verify

---

## 📞 Need Help?

1. **Documentation**: Start with README.md
2. **Quick Setup**: QUICK_START.md
3. **Architecture**: ARCHITECTURE.md
4. **Deployment**: DEPLOYMENT_CHECKLIST.md
5. **Email Support**: support@halisoft.com

---

**Pro Tip**: Use your IDE's search function to find keywords like:
- `"basePrice"` - Where pricing is used
- `"limitValue"` - Where quotas are checked
- `"enforceQuota"` - Quota enforcement logic
- `"hasFeatureAccess"` - Feature gating logic

---

**Happy coding!** 🚀

This is a **configuration-first** system. Most business logic changes don't require code - just admin dashboard updates!
