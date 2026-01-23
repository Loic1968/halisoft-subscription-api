// ═══════════════════════════════════════════════════════════════
// Admin Routes
// Configuration management for plans, pricing, and features
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import { paypalService } from '../services/PayPalService';
import { usageTrackingService } from '../services/UsageTrackingService';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// All admin routes require authentication and admin role
router.use(authenticateUser, requireAdmin);

/**
 * GET /api/admin/plans
 * List all subscription plans
 */
router.get('/plans', async (req: any, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        features: {
          include: {
            aiComponent: true,
          },
        },
        additionalFeatures: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    res.json({ plans });
  } catch (error: any) {
    logger.error('Failed to list plans', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve plans' });
  }
});

/**
 * POST /api/admin/plans
 * Create a new plan
 */
router.post('/plans', async (req: any, res) => {
  try {
    const {
      name,
      slug,
      tagline,
      description,
      basePrice,
      billingPeriod,
      isCustomPricing,
      isPopular,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        error: 'name and slug are required',
      });
    }

    // Create PayPal plan if not custom pricing
    let paypalPlanId = null;

    if (!isCustomPricing && basePrice) {
      const paypalPlan = await paypalService.createBillingPlan({
        name,
        description: tagline || name,
        price: parseFloat(basePrice),
        interval: billingPeriod === 'yearly' ? 'YEAR' : 'MONTH',
      });

      paypalPlanId = paypalPlan.id;
    }

    // Create plan in database
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        slug,
        tagline,
        description,
        basePrice: basePrice ? new Prisma.Decimal(basePrice) : null,
        billingPeriod: billingPeriod || 'monthly',
        isCustomPricing: isCustomPricing || false,
        isPopular: isPopular || false,
        paypalPlanId,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PLAN_CREATED',
        entityType: 'subscription_plan',
        entityId: plan.id,
        changesAfter: plan as any,
      },
    });

    logger.info('Plan created', { planId: plan.id, userId: req.user.id });

    res.json({ plan });
  } catch (error: any) {
    logger.error('Failed to create plan', { error: error.message });
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

/**
 * PATCH /api/admin/plans/:id
 * Update plan details (including pricing)
 */
router.patch('/plans/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { basePrice, name, tagline, description, isActive, isPopular } = req.body;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const changesBefore = { ...plan };

    // If price is being updated, update PayPal plan
    let paypalPlanId = plan.paypalPlanId;

    if (basePrice && parseFloat(basePrice) !== parseFloat(plan.basePrice?.toString() || '0')) {
      if (!plan.isCustomPricing && plan.paypalPlanId) {
        const newPayPalPlan = await paypalService.updatePlanPricing(
          plan.paypalPlanId,
          parseFloat(basePrice),
          name || plan.name
        );
        paypalPlanId = newPayPalPlan.id;
      }
    }

    // Update plan
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        basePrice: basePrice ? new Prisma.Decimal(basePrice) : undefined,
        name: name || undefined,
        tagline: tagline || undefined,
        description: description || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        isPopular: isPopular !== undefined ? isPopular : undefined,
        paypalPlanId: paypalPlanId || undefined,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PLAN_UPDATED',
        entityType: 'subscription_plan',
        entityId: plan.id,
        changesBefore: changesBefore as any,
        changesAfter: updatedPlan as any,
      },
    });

    logger.info('Plan updated', { planId: id, userId: req.user.id });

    res.json({ plan: updatedPlan });
  } catch (error: any) {
    logger.error('Failed to update plan', { error: error.message });
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

/**
 * POST /api/admin/plans/:id/features
 * Add or update AI component feature for a plan
 */
router.post('/plans/:id/features', async (req: any, res) => {
  try {
    const { id } = req.params;
    const { aiComponentId, enabled, limitValue, limitType, displayName } = req.body;

    if (!aiComponentId) {
      return res.status(400).json({ error: 'aiComponentId is required' });
    }

    // Upsert plan feature
    const feature = await prisma.planFeature.upsert({
      where: {
        planId_aiComponentId: {
          planId: id,
          aiComponentId,
        },
      },
      create: {
        planId: id,
        aiComponentId,
        enabled: enabled !== undefined ? enabled : true,
        limitValue: limitValue || null,
        limitType: limitType || 'count',
        displayName,
      },
      update: {
        enabled: enabled !== undefined ? enabled : undefined,
        limitValue: limitValue !== undefined ? limitValue : undefined,
        limitType: limitType || undefined,
        displayName: displayName || undefined,
      },
      include: {
        aiComponent: true,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PLAN_FEATURE_UPDATED',
        entityType: 'plan_feature',
        entityId: feature.id,
        changesAfter: feature as any,
      },
    });

    logger.info('Plan feature updated', {
      planId: id,
      featureId: feature.id,
      userId: req.user.id,
    });

    res.json({ feature });
  } catch (error: any) {
    logger.error('Failed to update plan feature', { error: error.message });
    res.status(500).json({ error: 'Failed to update plan feature' });
  }
});

/**
 * GET /api/admin/ai-components
 * List all AI components
 */
router.get('/ai-components', async (req: any, res) => {
  try {
    const components = await prisma.aIComponent.findMany({
      include: {
        planFeatures: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        category: 'asc',
      },
    });

    res.json({ components });
  } catch (error: any) {
    logger.error('Failed to list AI components', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve AI components' });
  }
});

/**
 * POST /api/admin/ai-components
 * Create a new AI component
 */
router.post('/ai-components', async (req: any, res) => {
  try {
    const { name, slug, description, category, apiEndpoint, baseTokenCost } = req.body;

    if (!name || !slug || !category) {
      return res.status(400).json({
        error: 'name, slug, and category are required',
      });
    }

    const component = await prisma.aIComponent.create({
      data: {
        name,
        slug,
        description,
        category,
        apiEndpoint,
        baseTokenCost: baseTokenCost || 1000,
      },
    });

    logger.info('AI component created', { componentId: component.id });

    res.json({ component });
  } catch (error: any) {
    logger.error('Failed to create AI component', { error: error.message });
    res.status(500).json({ error: 'Failed to create AI component' });
  }
});

/**
 * GET /api/admin/subscriptions
 * List all subscriptions with filters
 */
router.get('/subscriptions', async (req: any, res) => {
  try {
    const { status, planId, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.planId = planId;

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.subscription.count({ where });

    res.json({
      subscriptions,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    logger.error('Failed to list subscriptions', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve subscriptions' });
  }
});

/**
 * GET /api/admin/analytics/usage
 * Get usage analytics across all subscriptions
 */
router.get('/analytics/usage', async (req: any, res) => {
  try {
    const { startDate, endDate, aiComponentSlug } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const analytics = await usageTrackingService.getUsageAnalytics({
      startDate: start,
      endDate: end,
      aiComponentSlug: aiComponentSlug as string | undefined,
    });

    res.json({ analytics });
  } catch (error: any) {
    logger.error('Failed to get usage analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Get revenue metrics
 */
router.get('/analytics/revenue', async (req: any, res) => {
  try {
    // Get active subscriptions by plan
    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['planId', 'status'],
      where: {
        status: 'ACTIVE',
      },
      _count: true,
    });

    // Calculate MRR and ARR
    let mrr = 0;
    const breakdown: any[] = [];

    for (const group of subscriptionsByPlan) {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: group.planId },
      });

      if (plan && plan.basePrice) {
        const price = parseFloat(plan.basePrice.toString());
        const monthlyRevenue = plan.billingPeriod === 'yearly' ? price / 12 : price;
        const planMrr = monthlyRevenue * group._count;

        mrr += planMrr;

        breakdown.push({
          plan: plan.name,
          subscriptions: group._count,
          mrr: planMrr,
        });
      }
    }

    const arr = mrr * 12;

    res.json({
      mrr,
      arr,
      breakdown,
    });
  } catch (error: any) {
    logger.error('Failed to get revenue analytics', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve revenue analytics' });
  }
});

/**
 * POST /api/admin/sync-paypal
 * Sync all plans to PayPal
 */
router.post('/sync-paypal', async (req: any, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        isCustomPricing: false,
      },
    });

    const results = [];

    for (const plan of plans) {
      try {
        if (plan.basePrice) {
          const paypalPlan = await paypalService.createBillingPlan({
            name: plan.name,
            description: plan.tagline || plan.name,
            price: parseFloat(plan.basePrice.toString()),
            interval: plan.billingPeriod === 'yearly' ? 'YEAR' : 'MONTH',
          });

          await prisma.subscriptionPlan.update({
            where: { id: plan.id },
            data: { paypalPlanId: paypalPlan.id },
          });

          results.push({
            plan: plan.name,
            success: true,
            paypalPlanId: paypalPlan.id,
          });
        }
      } catch (error: any) {
        results.push({
          plan: plan.name,
          success: false,
          error: error.message,
        });
      }
    }

    res.json({ results });
  } catch (error: any) {
    logger.error('Failed to sync PayPal plans', { error: error.message });
    res.status(500).json({ error: 'Failed to sync PayPal plans' });
  }
});

export default router;
