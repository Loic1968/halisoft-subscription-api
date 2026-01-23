// ═══════════════════════════════════════════════════════════════
// Subscription Routes
// User-facing subscription management endpoints
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { subscriptionService } from '../services/SubscriptionService';
import { usageTrackingService } from '../services/UsageTrackingService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/subscriptions/current
 * Get user's current active subscription with usage data
 */
router.get('/current', authenticateUser, async (req: any, res) => {
  try {
    const subscriptions = await subscriptionService.getUserSubscriptions(
      req.user.id
    );

    const activeSubscription = subscriptions.find((s) => s.status === 'ACTIVE');

    if (!activeSubscription) {
      return res.json({
        subscription: null,
        message: 'No active subscription',
      });
    }

    // Get usage data
    const usage = await usageTrackingService.getCurrentPeriodUsage(
      activeSubscription.id
    );

    res.json({
      subscription: activeSubscription,
      usage,
    });
  } catch (error: any) {
    logger.error('Failed to get current subscription', {
      userId: req.user?.id,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to retrieve subscription',
    });
  }
});

/**
 * POST /api/subscriptions/create
 * Create a new subscription
 */
router.post('/create', authenticateUser, async (req: any, res) => {
  try {
    const { planId, tenantId } = req.body;

    if (!planId) {
      return res.status(400).json({
        error: 'planId is required',
      });
    }

    const result = await subscriptionService.createSubscription({
      userId: req.user.id,
      planId,
      tenantId,
    });

    res.json({
      subscription: result.subscription,
      approvalUrl: result.approvalUrl,
    });
  } catch (error: any) {
    logger.error('Failed to create subscription', {
      userId: req.user?.id,
      error: error.message,
    });

    res.status(400).json({
      error: error.message || 'Failed to create subscription',
    });
  }
});

/**
 * POST /api/subscriptions/activate/:paypalSubscriptionId
 * Activate subscription after PayPal approval
 */
router.post('/activate/:paypalSubscriptionId', async (req, res) => {
  try {
    const { paypalSubscriptionId } = req.params;

    const subscription = await subscriptionService.activateSubscription(
      paypalSubscriptionId
    );

    res.json({
      subscription,
      message: 'Subscription activated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to activate subscription', {
      paypalSubscriptionId: req.params.paypalSubscriptionId,
      error: error.message,
    });

    res.status(400).json({
      error: error.message || 'Failed to activate subscription',
    });
  }
});

/**
 * POST /api/subscriptions/:id/change-plan
 * Upgrade or downgrade subscription plan
 */
router.post('/:id/change-plan', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return res.status(400).json({
        error: 'newPlanId is required',
      });
    }

    const subscription = await subscriptionService.changeSubscriptionPlan({
      subscriptionId: id,
      newPlanId,
    });

    res.json({
      subscription,
      message: 'Plan change initiated',
    });
  } catch (error: any) {
    logger.error('Failed to change plan', {
      subscriptionId: req.params.id,
      error: error.message,
    });

    res.status(400).json({
      error: error.message || 'Failed to change plan',
    });
  }
});

/**
 * POST /api/subscriptions/:id/cancel
 * Cancel subscription
 */
router.post('/:id/cancel', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { reason, immediate } = req.body;

    const subscription = await subscriptionService.cancelSubscription(
      id,
      reason,
      immediate || false
    );

    res.json({
      subscription,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at period end',
    });
  } catch (error: any) {
    logger.error('Failed to cancel subscription', {
      subscriptionId: req.params.id,
      error: error.message,
    });

    res.status(400).json({
      error: error.message || 'Failed to cancel subscription',
    });
  }
});

/**
 * GET /api/subscriptions/:id/usage
 * Get detailed usage statistics for subscription
 */
router.get('/:id/usage', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;

    const usage = await usageTrackingService.getCurrentPeriodUsage(id);

    res.json({ usage });
  } catch (error: any) {
    logger.error('Failed to get usage', {
      subscriptionId: req.params.id,
      error: error.message,
    });

    res.status(500).json({
      error: 'Failed to retrieve usage data',
    });
  }
});

/**
 * GET /api/subscriptions/:id/check-feature/:componentSlug
 * Check if subscription has access to a specific AI component
 */
router.get(
  '/:id/check-feature/:componentSlug',
  authenticateUser,
  async (req: any, res) => {
    try {
      const { id, componentSlug } = req.params;

      const access = await subscriptionService.hasFeatureAccess(
        id,
        componentSlug
      );

      res.json(access);
    } catch (error: any) {
      logger.error('Failed to check feature access', {
        subscriptionId: req.params.id,
        componentSlug: req.params.componentSlug,
        error: error.message,
      });

      res.status(500).json({
        error: 'Failed to check feature access',
      });
    }
  }
);

export default router;
