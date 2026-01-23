# HaliSoft - Project Structure

Complete file organization for the configuration-first subscription system.

```
halisoft-subscription-system/
│
├── 📄 Configuration Files
│   ├── package.json                    # Dependencies and scripts
│   ├── tsconfig.json                   # TypeScript configuration
│   ├── .env.example                    # Environment variables template
│   ├── railway.json                    # Railway deployment config
│   ├── vercel.json                     # Vercel deployment config
│   ├── README.md                       # Main documentation
│   ├── QUICK_START.md                  # 15-minute setup guide
│   ├── ARCHITECTURE.md                 # System architecture deep-dive
│   └── PROJECT_STRUCTURE.md            # This file
│
├── 📁 prisma/                          # Database schema and migrations
│   ├── schema.prisma                   # Prisma schema (configuration-first!)
│   └── seed.ts                         # Initial data seed script
│
├── 📁 src/                             # Backend source code
│   │
│   ├── index.ts                        # Main application entry point
│   │
│   ├── 📁 config/                      # Configuration utilities
│   │
│   ├── 📁 services/                    # Business logic services
│   │   ├── PayPalService.ts           # PayPal Billing API integration
│   │   ├── SubscriptionService.ts     # Subscription management
│   │   ├── UsageTrackingService.ts    # Quota tracking & enforcement
│   │   └── EmailService.ts            # Transactional emails
│   │
│   ├── 📁 middleware/                  # Express middleware
│   │   ├── auth.ts                    # JWT authentication
│   │   ├── subscription.ts            # Subscription validation
│   │   └── quotaEnforcement.ts        # Dynamic quota checking
│   │
│   ├── 📁 routes/                      # API endpoints
│   │   ├── subscriptions.ts           # User subscription management
│   │   ├── ai-components.ts           # AI component execution
│   │   ├── admin.ts                   # Admin configuration endpoints
│   │   └── webhooks.ts                # PayPal webhook handlers
│   │
│   ├── 📁 utils/                       # Utilities
│   │   └── logger.ts                  # Winston logger setup
│   │
│   ├── 📁 cron/                        # Scheduled jobs
│   │   ├── reset-monthly-quotas.ts    # Quota reset (daily)
│   │   └── quota-warnings.ts          # Usage warnings (6 hours)
│   │
│   └── 📁 __tests__/                   # Test suites
│       └── subscription.test.ts       # Configuration-first tests
│
├── 📁 frontend/                        # React frontend components
│   │
│   ├── 📁 hooks/                       # React hooks
│   │   ├── useSubscription.ts         # Subscription state management
│   │   └── useAIComponent.ts          # AI component execution
│   │
│   └── 📁 components/                  # React components
│       ├── PricingPage.tsx            # Dynamic pricing (loads from API)
│       └── UserDashboard.tsx          # Usage dashboard
│
└── 📁 logs/                            # Application logs (generated)
    ├── combined.log                    # All logs
    └── error.log                       # Error logs only
```

## Key Files Explained

### Backend Core

#### `src/index.ts`
Main application entry point. Sets up Express server, middleware, routes, and error handling.

**Key Responsibilities**:
- Load environment variables
- Connect to database
- Register routes
- Start HTTP server
- Handle graceful shutdown

#### `src/services/SubscriptionService.ts`
Core subscription management logic.

**Key Methods**:
- `createSubscription()` - Initiate PayPal flow
- `activateSubscription()` - After PayPal approval
- `hasFeatureAccess()` - Dynamic permission check
- `changeSubscriptionPlan()` - Upgrade/downgrade
- `cancelSubscription()` - End subscription

**Configuration-First**:
```typescript
// Loads features dynamically from database
const features = await prisma.planFeature.findMany({
  where: { planId: subscription.plan.id }
});
```

#### `src/services/UsageTrackingService.ts`
Quota tracking and enforcement.

**Key Methods**:
- `incrementUsage()` - Track AI component calls
- `getCurrentPeriodUsage()` - Real-time stats
- `isQuotaExceeded()` - Check hard limits
- `resetQuotas()` - Monthly reset
- `getUsageAnalytics()` - Admin reporting

**Zero Hardcoded Limits**:
```typescript
// Limit loaded from database, not hardcoded!
const feature = await prisma.planFeature.findFirst({
  where: { planId, aiComponentId }
});

if (usage >= feature.limitValue) {
  return 429; // Quota exceeded
}
```

#### `src/services/PayPalService.ts`
PayPal Billing API integration.

**Key Methods**:
- `createBillingPlan()` - Sync plans to PayPal
- `updatePlanPricing()` - Handle price changes
- `createSubscription()` - User checkout
- `verifyWebhookSignature()` - Security
- `cancelSubscription()` - Terminate billing

**Dynamic Plan Creation**:
```typescript
// Creates PayPal plan from database config
const paypalPlan = await createBillingPlan({
  name: plan.name,        // From database
  price: plan.basePrice,  // From database
  interval: plan.billingPeriod // From database
});
```

### Middleware Layer

#### `src/middleware/quotaEnforcement.ts`
Dynamic quota enforcement middleware.

**How It Works**:
```typescript
// Factory function creates middleware for any component
export function enforceQuota(componentSlug: string) {
  return async (req, res, next) => {
    // 1. Check if component available in plan (from DB)
    const feature = await prisma.planFeature.findFirst({
      where: { planId, aiComponentId, enabled: true }
    });

    if (!feature) {
      return res.status(403).json({
        error: 'Not available in your plan',
        upgradeUrl: '/pricing'
      });
    }

    // 2. Check quota (from DB)
    const usage = await getUsage(subscriptionId, componentSlug);

    if (usage >= feature.limitValue) {
      return res.status(429).json({
        error: 'Quota exceeded',
        resetDate: subscription.currentPeriodEnd
      });
    }

    next();
  };
}
```

**Usage in Routes**:
```typescript
router.post(
  '/invoice-ocr/analyze',
  authenticateUser,
  checkSubscription,
  enforceQuota('invoice_ocr'),  // Dynamic check!
  async (req, res) => {
    // Execute AI component
  }
);
```

### Database Schema

#### `prisma/schema.prisma`
Configuration-first database design.

**Core Models**:

```prisma
// Plans are fully configurable
model SubscriptionPlan {
  basePrice  Decimal?  // Modifiable by admin
  features   PlanFeature[]  // Dynamic feature mapping
}

// AI components as first-class entities
model AIComponent {
  slug       String @unique
  planFeatures PlanFeature[]
}

// Many-to-many with config
model PlanFeature {
  enabled    Boolean      // Toggle via admin
  limitValue Int?         // Change quota via admin
  plan       SubscriptionPlan
  aiComponent AIComponent
}
```

**Why This Works**:
Admin can modify `PlanFeature` entries to change what's included in each plan, WITHOUT touching code!

#### `prisma/seed.ts`
Initial database population.

**What It Creates**:
- 3 Plans (Starter, Professional, Enterprise)
- 6 AI Components
- Feature mappings for each plan
- Admin user

**Running**:
```bash
npm run prisma:seed
```

### Frontend Components

#### `frontend/hooks/useSubscription.ts`
React hook for subscription management.

**Exported Functions**:
- `subscription` - Current subscription object
- `usage` - Real-time usage by component
- `hasFeature(slug)` - Check component access
- `isQuotaExceeded(slug)` - Check limits
- `cancelSubscription()` - Cancel flow
- `changePlan(planId)` - Upgrade/downgrade

**Example Usage**:
```typescript
function MyComponent() {
  const { subscription, usage, hasFeature } = useSubscription();

  if (!hasFeature('invoice_ocr')) {
    return <UpgradePrompt />;
  }

  const quota = usage['invoice_ocr'];
  // Display quota: quota.used / quota.limit
}
```

#### `frontend/hooks/useAIComponent.ts`
React hook for AI component execution.

**Exported Functions**:
- `execute(params)` - Run AI component
- `loading` - Execution state
- `error` - Error messages
- `data` - Component result

**Auto Quota Check**:
```typescript
const { execute, loading } = useAIComponent('invoice_ocr');

const handleAnalyze = async () => {
  try {
    const result = await execute({ invoiceData });
    // Automatically checks quota before execution!
  } catch (err) {
    if (err.message.includes('Quota exceeded')) {
      showUpgradeModal();
    }
  }
};
```

#### `frontend/components/PricingPage.tsx`
Dynamic pricing page that loads from API.

**NO HARDCODED PRICES**:
```typescript
useEffect(() => {
  // Loads plans from API
  fetch('/api/public/plans')
    .then(res => res.json())
    .then(data => setPlans(data.plans));
}, []);

// Renders dynamically
{plans.map(plan => (
  <PricingCard
    name={plan.name}
    price={plan.basePrice}  // From database!
    features={plan.features} // From database!
  />
))}
```

Admin changes prices → Users see new prices immediately!

### Cron Jobs

#### `src/cron/reset-monthly-quotas.ts`
Runs daily at midnight.

**What It Does**:
1. Find subscriptions with expiring periods
2. Get last month usage
3. Send monthly report email
4. Reset usage counters to 0
5. Initialize new period

#### `src/cron/quota-warnings.ts`
Runs every 6 hours.

**What It Does**:
1. Check all active subscriptions
2. Calculate usage percentage for each component
3. Send warning emails:
   - 80% threshold
   - 90% threshold
   - 100% (quota exceeded)

### Configuration Files

#### `railway.json` / `vercel.json`
Deployment configuration for platforms.

**Key Features**:
- Build commands
- Start commands
- Health checks
- Cron job schedules
- Environment variables

**Cron Configuration**:
```json
{
  "crons": [
    {
      "name": "Reset Monthly Quotas",
      "schedule": "0 0 * * *",  // Daily at midnight
      "command": "npm run cron:quotas"
    },
    {
      "name": "Send Quota Warnings",
      "schedule": "0 */6 * * *",  // Every 6 hours
      "command": "npm run cron:warnings"
    }
  ]
}
```

## Data Flow Examples

### 1. User Subscribes to Plan

```
1. Frontend: User clicks "Get Started" on Pricing Page
   → POST /api/subscriptions/create { planId: 'professional' }

2. Backend: SubscriptionService.createSubscription()
   → Load plan from database
   → Create PayPal billing subscription
   → Create Subscription record (status: PENDING)
   → Return approval URL

3. Frontend: Redirect to PayPal
   → User approves payment

4. PayPal Webhook: BILLING.SUBSCRIPTION.ACTIVATED
   → POST /webhooks/paypal
   → SubscriptionService.activateSubscription()
   → Update status to ACTIVE
   → Initialize usage tracking
   → Send welcome email

5. Frontend: User redirected back
   → Dashboard shows active subscription
```

### 2. User Executes AI Component

```
1. Frontend: User clicks "Analyze Invoice"
   → POST /api/ai/invoice-ocr/analyze { invoiceData }

2. Middleware Chain:
   → authenticateUser: Verify JWT
   → checkSubscription: Load active subscription
   → enforceQuota('invoice_ocr'):
     → Load plan features from DB
     → Check if enabled for this plan
     → Check current usage vs limit
     → If exceeded: return 429
     → If OK: attach quota info

3. Route Handler:
   → Call Anthropic Claude API
   → Get analysis result

4. trackUsage Middleware:
   → Increment usage counter in DB
   → Check if approaching 80%/90%
   → Send warning email if needed

5. Response:
   → Return analysis + quota info
   → Frontend updates usage display
```

### 3. Admin Changes Plan Pricing

```
1. Admin Dashboard: Change Starter price to $349
   → PATCH /api/admin/plans/starter { basePrice: 349 }

2. Backend: Admin Route Handler
   → requireAdmin: Verify admin role
   → Load current plan from DB
   → Update plan.basePrice = 349
   → Call PayPalService.updatePlanPricing():
     → Create new PayPal billing plan
     → Deactivate old plan
     → Return new paypalPlanId
   → Update plan.paypalPlanId in DB
   → Create AuditLog entry

3. Result:
   → New price effective immediately
   → Existing subscriptions unaffected
   → New subscriptions use $349
   → NO DEPLOYMENT NEEDED!
```

## Environment Variables

### Required

```env
DATABASE_URL                # PostgreSQL connection
JWT_SECRET                  # Secure random string
PAYPAL_CLIENT_ID            # From PayPal Dashboard
PAYPAL_CLIENT_SECRET        # From PayPal Dashboard
PAYPAL_PRODUCT_ID           # Created in PayPal
ANTHROPIC_API_KEY           # From Anthropic Console
```

### Optional

```env
SMTP_HOST                   # Email server
SMTP_USER                   # Email credentials
SMTP_PASSWORD
REDIS_URL                   # For caching
SENTRY_DSN                  # Error tracking
```

## NPM Scripts

```bash
# Development
npm run dev                 # Start with hot reload
npm run build               # Compile TypeScript

# Database
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Run migrations
npm run prisma:seed         # Seed initial data
npm run prisma:studio       # Visual database editor

# Deployment
npm start                   # Production start
npm run sync-paypal         # Sync plans to PayPal

# Cron Jobs
npm run cron:quotas         # Reset quotas manually
npm run cron:warnings       # Send warnings manually

# Testing
npm test                    # Run tests
npm run test:watch          # Watch mode
```

## Key Principles Demonstrated

### 1. Configuration-First
- All prices in database, not code
- Features toggled via admin dashboard
- Quotas modified without deployment

### 2. Dynamic Feature Gating
- `enforceQuota` middleware checks DB
- No hardcoded permission checks
- Flexible plan configurations

### 3. Real-time Usage Tracking
- Every API call increments counter
- Live quota display in dashboard
- Automatic warning emails

### 4. Fail-Safe Design
- Quota exceeded returns 429, not crash
- PayPal webhook failures logged and retryable
- Database constraints prevent invalid state

### 5. Audit Trail
- All admin changes logged
- Before/after snapshots
- Compliance and debugging

---

**Remember**: This architecture enables business users to modify pricing, features, and quotas through the admin dashboard WITHOUT needing developers! 🚀
