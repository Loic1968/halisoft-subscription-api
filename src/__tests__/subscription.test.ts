// ═══════════════════════════════════════════════════════════════
// Subscription System Tests
// Test configuration-first architecture and quota enforcement
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { subscriptionService } from '../services/SubscriptionService';
import { usageTrackingService } from '../services/UsageTrackingService';
import bcrypt from 'bcryptjs';
import { addMonths } from 'date-fns';

const prisma = new PrismaClient();

// Test helpers
async function createTestUser(email: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      isActive: true,
      emailVerified: true,
    },
  });
}

async function createTestPlan(slug: string, basePrice: number) {
  return prisma.subscriptionPlan.create({
    data: {
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      slug,
      basePrice,
      billingPeriod: 'monthly',
      isActive: true,
    },
  });
}

async function createTestAIComponent(slug: string) {
  return prisma.aIComponent.create({
    data: {
      name: slug.replace('_', ' ').toUpperCase(),
      slug,
      category: 'test',
      isActive: true,
    },
  });
}

// Cleanup after tests
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Configuration-First Subscription System', () => {
  let testUser: any;
  let starterPlan: any;
  let proPlan: any;
  let invoiceOCR: any;
  let financialAudit: any;

  beforeAll(async () => {
    // Create test data
    testUser = await createTestUser('test@example.com');
    starterPlan = await createTestPlan('test_starter', 299);
    proPlan = await createTestPlan('test_professional', 799);

    invoiceOCR = await createTestAIComponent('test_invoice_ocr');
    financialAudit = await createTestAIComponent('test_financial_audit');

    // Configure plan features
    await prisma.planFeature.create({
      data: {
        planId: starterPlan.id,
        aiComponentId: invoiceOCR.id,
        enabled: true,
        limitValue: 100,
        limitType: 'count',
      },
    });

    await prisma.planFeature.create({
      data: {
        planId: starterPlan.id,
        aiComponentId: financialAudit.id,
        enabled: false, // Not available in Starter
        limitValue: null,
        limitType: 'count',
      },
    });

    await prisma.planFeature.create({
      data: {
        planId: proPlan.id,
        aiComponentId: invoiceOCR.id,
        enabled: true,
        limitValue: 500,
        limitType: 'count',
      },
    });

    await prisma.planFeature.create({
      data: {
        planId: proPlan.id,
        aiComponentId: financialAudit.id,
        enabled: true, // Available in Professional
        limitValue: 150,
        limitType: 'count',
      },
    });
  });

  test('Starter plan has access to Invoice OCR', async () => {
    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    // Initialize usage tracking
    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    // Check feature access
    const hasAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_invoice_ocr'
    );

    expect(hasAccess.hasAccess).toBe(true);
    expect(hasAccess.limit).toBe(100);
    expect(hasAccess.used).toBe(0);

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Starter plan does NOT have access to Financial Audit', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    const hasAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_financial_audit'
    );

    expect(hasAccess.hasAccess).toBe(false);

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Professional plan has access to both components', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    const invoiceAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_invoice_ocr'
    );

    const auditAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_financial_audit'
    );

    expect(invoiceAccess.hasAccess).toBe(true);
    expect(invoiceAccess.limit).toBe(500); // Higher limit

    expect(auditAccess.hasAccess).toBe(true);
    expect(auditAccess.limit).toBe(150);

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Quota enforcement blocks requests when limit reached', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    // Simulate 100 API calls (Starter limit)
    for (let i = 0; i < 100; i++) {
      await usageTrackingService.incrementUsage(
        subscription.id,
        'test_invoice_ocr',
        1
      );
    }

    // Check quota exceeded
    const isExceeded = await usageTrackingService.isQuotaExceeded(
      subscription.id,
      'test_invoice_ocr'
    );

    expect(isExceeded).toBe(true);

    const hasAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_invoice_ocr'
    );

    expect(hasAccess.hasAccess).toBe(false);
    expect(hasAccess.used).toBe(100);
    expect(hasAccess.limit).toBe(100);

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Admin can modify plan limits dynamically', async () => {
    // Initial limit
    const feature = await prisma.planFeature.findFirst({
      where: {
        planId: starterPlan.id,
        aiComponentId: invoiceOCR.id,
      },
    });

    expect(feature?.limitValue).toBe(100);

    // Admin changes limit to 150
    await prisma.planFeature.update({
      where: { id: feature!.id },
      data: { limitValue: 150 },
    });

    // Create new subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    // Check new limit applies
    const hasAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_invoice_ocr'
    );

    expect(hasAccess.limit).toBe(150); // Updated limit!

    // Reset for other tests
    await prisma.planFeature.update({
      where: { id: feature!.id },
      data: { limitValue: 100 },
    });

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Admin can enable/disable features dynamically', async () => {
    const feature = await prisma.planFeature.findFirst({
      where: {
        planId: starterPlan.id,
        aiComponentId: financialAudit.id,
      },
    });

    expect(feature?.enabled).toBe(false);

    // Admin enables Financial Audit for Starter
    await prisma.planFeature.update({
      where: { id: feature!.id },
      data: {
        enabled: true,
        limitValue: 50, // Set a limit
      },
    });

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    // Check access granted
    const hasAccess = await subscriptionService.hasFeatureAccess(
      subscription.id,
      'test_financial_audit'
    );

    expect(hasAccess.hasAccess).toBe(true);
    expect(hasAccess.limit).toBe(50);

    // Reset for other tests
    await prisma.planFeature.update({
      where: { id: feature!.id },
      data: {
        enabled: false,
        limitValue: null,
      },
    });

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });

  test('Usage tracking accurately counts API calls', async () => {
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: starterPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      subscription.currentPeriodStart!,
      subscription.currentPeriodEnd!
    );

    // Increment usage 5 times
    for (let i = 0; i < 5; i++) {
      await usageTrackingService.incrementUsage(
        subscription.id,
        'test_invoice_ocr',
        1
      );
    }

    const usage = await usageTrackingService.getComponentUsage(
      subscription.id,
      invoiceOCR.id
    );

    expect(usage).toBe(5);

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
  });
});

describe('Integration Tests', () => {
  test('Complete subscription lifecycle', async () => {
    const user = await createTestUser('lifecycle@example.com');
    const plan = await createTestPlan('test_lifecycle', 199);

    // 1. Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'PENDING',
      },
    });

    expect(subscription.status).toBe('PENDING');

    // 2. Activate subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
      },
    });

    const activated = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });

    expect(activated?.status).toBe('ACTIVE');

    // 3. Cancel subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    const cancelled = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });

    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.cancelledAt).toBeDefined();

    // Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
    await prisma.subscriptionPlan.delete({ where: { id: plan.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
