// ═══════════════════════════════════════════════════════════════
// Subscription Management Service
// Handles subscription lifecycle, upgrades, and cancellations
// ═══════════════════════════════════════════════════════════════

import { PrismaClient, Subscription, SubscriptionStatus } from '@prisma/client';
import { paypalService } from './PayPalService';
import { usageTrackingService } from './UsageTrackingService';
import { emailService } from './EmailService';
import { logger } from '../utils/logger';
import { addMonths, addYears } from 'date-fns';

const prisma = new PrismaClient();

export interface CreateSubscriptionParams {
  userId: string;
  planId: string;
  tenantId?: string;
}

export interface UpgradeSubscriptionParams {
  subscriptionId: string;
  newPlanId: string;
}

export class SubscriptionService {
  /**
   * Create a new subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<{
    subscription: Subscription;
    approvalUrl: string;
  }> {
    logger.info('Creating subscription', params);

    // Get plan details
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: params.planId },
    });

    if (!plan || !plan.isActive) {
      throw new Error('Invalid or inactive plan');
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: params.userId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // For custom pricing (Enterprise), require manual setup
    if (plan.isCustomPricing) {
      // Create pending subscription without PayPal
      const subscription = await prisma.subscription.create({
        data: {
          userId: params.userId,
          planId: params.planId,
          tenantId: params.tenantId,
          status: 'PENDING',
        },
      });

      logger.info('Enterprise subscription created (pending manual setup)', {
        subscriptionId: subscription.id,
      });

      return {
        subscription,
        approvalUrl: '/contact-sales', // Redirect to sales team
      };
    }

    // Create PayPal subscription
    const paypalSubscription = await paypalService.createSubscription({
      planId: plan.paypalPlanId!,
      userEmail: user.email,
      returnUrl: `${process.env.APP_URL}/subscription/success`,
      cancelUrl: `${process.env.APP_URL}/subscription/cancel`,
    });

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        tenantId: params.tenantId,
        paypalSubscriptionId: paypalSubscription.id,
        paypalPlanId: plan.paypalPlanId,
        status: 'PENDING',
      },
    });

    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      paypalSubscriptionId: paypalSubscription.id,
    });

    return {
      subscription,
      approvalUrl: paypalSubscription.approvalUrl,
    };
  }

  /**
   * Activate subscription after PayPal approval
   */
  async activateSubscription(paypalSubscriptionId: string): Promise<Subscription> {
    logger.info('Activating subscription', { paypalSubscriptionId });

    const subscription = await prisma.subscription.findUnique({
      where: { paypalSubscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get subscription details from PayPal
    const paypalData = await paypalService.getSubscription(paypalSubscriptionId);

    // Determine billing period
    const billingPeriod = subscription.plan.billingPeriod;
    const currentPeriodStart = new Date();
    const currentPeriodEnd =
      billingPeriod === 'yearly'
        ? addYears(currentPeriodStart, 1)
        : addMonths(currentPeriodStart, 1);

    // Update subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    // Initialize usage tracking for this period
    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      currentPeriodStart,
      currentPeriodEnd
    );

    // Send welcome email
    await emailService.sendWelcomeEmail(subscription.userId, subscription.plan.name);

    logger.info('Subscription activated', { subscriptionId: subscription.id });

    return updatedSubscription;
  }

  /**
   * Get subscription with usage data
   */
  async getSubscriptionWithUsage(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            features: {
              include: {
                aiComponent: true,
              },
            },
          },
        },
        user: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get current usage
    const usage = await usageTrackingService.getCurrentPeriodUsage(subscription.id);

    return {
      subscription,
      usage,
    };
  }

  /**
   * Upgrade or downgrade subscription
   */
  async changeSubscriptionPlan(
    params: UpgradeSubscriptionParams
  ): Promise<Subscription> {
    logger.info('Changing subscription plan', params);

    const subscription = await prisma.subscription.findUnique({
      where: { id: params.subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: params.newPlanId },
    });

    if (!newPlan || !newPlan.isActive) {
      throw new Error('Invalid or inactive plan');
    }

    // For PayPal subscriptions, we need to cancel and create new
    if (subscription.paypalSubscriptionId) {
      // Cancel old subscription
      await paypalService.cancelSubscription(
        subscription.paypalSubscriptionId,
        'Plan change requested by user'
      );

      // Create new PayPal subscription
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
      });

      const paypalSubscription = await paypalService.createSubscription({
        planId: newPlan.paypalPlanId!,
        userEmail: user!.email,
        returnUrl: `${process.env.APP_URL}/subscription/change-success`,
        cancelUrl: `${process.env.APP_URL}/subscription/change-cancel`,
      });

      // Update subscription
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: newPlan.id,
          paypalSubscriptionId: paypalSubscription.id,
          paypalPlanId: newPlan.paypalPlanId,
          status: 'PENDING', // Will be activated after PayPal approval
        },
      });

      logger.info('Subscription plan changed', {
        subscriptionId: subscription.id,
        oldPlan: subscription.plan.name,
        newPlan: newPlan.name,
      });

      return updatedSubscription;
    }

    // For custom pricing, just update the plan
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlan.id,
      },
    });

    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
    cancelImmediately: boolean = false
  ): Promise<Subscription> {
    logger.info('Cancelling subscription', { subscriptionId, cancelImmediately });

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel in PayPal if applicable
    if (subscription.paypalSubscriptionId) {
      await paypalService.cancelSubscription(
        subscription.paypalSubscriptionId,
        reason
      );
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: cancelImmediately ? 'CANCELLED' : subscription.status,
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelAtPeriodEnd: !cancelImmediately,
      },
    });

    // Send cancellation email
    await emailService.sendCancellationEmail(
      subscription.userId,
      subscription.plan.name,
      cancelImmediately
    );

    logger.info('Subscription cancelled', {
      subscriptionId: subscription.id,
      immediate: cancelImmediately,
    });

    return updatedSubscription;
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Check if subscription has access to a feature
   */
  async hasFeatureAccess(
    subscriptionId: string,
    aiComponentSlug: string
  ): Promise<{ hasAccess: boolean; limit?: number; used?: number }> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            features: {
              include: {
                aiComponent: true,
              },
            },
          },
        },
      },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return { hasAccess: false };
    }

    // Find the feature
    const feature = subscription.plan.features.find(
      (f) => f.aiComponent.slug === aiComponentSlug && f.enabled
    );

    if (!feature) {
      return { hasAccess: false };
    }

    // Get current usage
    const usage = await usageTrackingService.getComponentUsage(
      subscription.id,
      feature.aiComponent.id
    );

    // Check if within quota
    if (feature.limitValue !== null && usage >= feature.limitValue) {
      return {
        hasAccess: false,
        limit: feature.limitValue,
        used: usage,
      };
    }

    return {
      hasAccess: true,
      limit: feature.limitValue || undefined,
      used: usage,
    };
  }
}

export const subscriptionService = new SubscriptionService();
