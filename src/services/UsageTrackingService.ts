// ═══════════════════════════════════════════════════════════════
// Usage Tracking Service
// Tracks AI component usage and enforces quotas
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { emailService } from './EmailService';

const prisma = new PrismaClient();

export interface UsageSummary {
  [componentSlug: string]: {
    used: number;
    limit: number | null;
    percentage: number;
    resetDate: Date;
  };
}

export class UsageTrackingService {
  /**
   * Initialize usage tracking for a new subscription period
   */
  async initializeUsageForSubscription(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    logger.info('Initializing usage tracking', { subscriptionId });

    // Get subscription with plan features
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

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Create usage tracking entries for each AI component
    const usageEntries = subscription.plan.features
      .filter((f) => f.enabled)
      .map((feature) => ({
        subscriptionId,
        aiComponentId: feature.aiComponent.id,
        metricType: feature.limitType,
        value: 0,
        periodStart,
        periodEnd,
      }));

    if (usageEntries.length > 0) {
      await prisma.usageTracking.createMany({
        data: usageEntries,
      });
    }

    logger.info('Usage tracking initialized', {
      subscriptionId,
      componentsTracked: usageEntries.length,
    });
  }

  /**
   * Increment usage for an AI component
   */
  async incrementUsage(
    subscriptionId: string,
    aiComponentSlug: string,
    amount: number = 1
  ): Promise<void> {
    logger.debug('Incrementing usage', {
      subscriptionId,
      aiComponentSlug,
      amount,
    });

    // Get subscription with current period
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get AI component
    const aiComponent = await prisma.aIComponent.findUnique({
      where: { slug: aiComponentSlug },
    });

    if (!aiComponent) {
      throw new Error('AI component not found');
    }

    // Find or create usage tracking entry for current period
    const existingUsage = await prisma.usageTracking.findFirst({
      where: {
        subscriptionId,
        aiComponentId: aiComponent.id,
        periodStart: subscription.currentPeriodStart!,
        periodEnd: subscription.currentPeriodEnd!,
      },
    });

    if (existingUsage) {
      // Update existing entry
      await prisma.usageTracking.update({
        where: { id: existingUsage.id },
        data: {
          value: {
            increment: amount,
          },
        },
      });
    } else {
      // Create new entry
      await prisma.usageTracking.create({
        data: {
          subscriptionId,
          aiComponentId: aiComponent.id,
          metricType: 'count',
          value: amount,
          periodStart: subscription.currentPeriodStart!,
          periodEnd: subscription.currentPeriodEnd!,
        },
      });
    }

    // Check if approaching quota and send warning
    await this.checkQuotaWarnings(subscriptionId, aiComponent.id);
  }

  /**
   * Get current usage for a specific component
   */
  async getComponentUsage(
    subscriptionId: string,
    aiComponentId: string
  ): Promise<number> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.currentPeriodStart) {
      return 0;
    }

    const usage = await prisma.usageTracking.findFirst({
      where: {
        subscriptionId,
        aiComponentId,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd!,
      },
    });

    return usage?.value || 0;
  }

  /**
   * Get current period usage for all components
   */
  async getCurrentPeriodUsage(subscriptionId: string): Promise<UsageSummary> {
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
        usageTracking: {
          where: {
            periodStart: {
              gte: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000), // Last 32 days
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const summary: UsageSummary = {};

    for (const feature of subscription.plan.features) {
      if (!feature.enabled) continue;

      const usage = subscription.usageTracking.find(
        (u) =>
          u.aiComponentId === feature.aiComponent.id &&
          u.periodStart.getTime() === subscription.currentPeriodStart?.getTime()
      );

      const used = usage?.value || 0;
      const limit = feature.limitValue;
      const percentage = limit ? (used / limit) * 100 : 0;

      summary[feature.aiComponent.slug] = {
        used,
        limit,
        percentage,
        resetDate: subscription.currentPeriodEnd!,
      };
    }

    return summary;
  }

  /**
   * Check if quota is exceeded
   */
  async isQuotaExceeded(
    subscriptionId: string,
    aiComponentSlug: string
  ): Promise<boolean> {
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

    if (!subscription) {
      return true;
    }

    const feature = subscription.plan.features.find(
      (f) => f.aiComponent.slug === aiComponentSlug && f.enabled
    );

    if (!feature) {
      return true; // Component not available in plan
    }

    // Unlimited quota
    if (feature.limitValue === null) {
      return false;
    }

    const currentUsage = await this.getComponentUsage(
      subscriptionId,
      feature.aiComponent.id
    );

    return currentUsage >= feature.limitValue;
  }

  /**
   * Check quota warnings and send emails if approaching limit
   */
  private async checkQuotaWarnings(
    subscriptionId: string,
    aiComponentId: string
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            features: {
              where: { aiComponentId },
              include: {
                aiComponent: true,
              },
            },
          },
        },
      },
    });

    if (!subscription || subscription.plan.features.length === 0) {
      return;
    }

    const feature = subscription.plan.features[0];
    if (!feature.limitValue) return; // Unlimited

    const usage = await this.getComponentUsage(subscriptionId, aiComponentId);
    const percentage = (usage / feature.limitValue) * 100;

    // Send warning at 80%, 90%, and 100%
    if (percentage >= 100) {
      await emailService.sendQuotaExceededEmail(
        subscription.userId,
        feature.aiComponent.name,
        usage,
        feature.limitValue
      );
    } else if (percentage >= 90) {
      await emailService.sendQuotaWarningEmail(
        subscription.userId,
        feature.aiComponent.name,
        usage,
        feature.limitValue,
        90
      );
    } else if (percentage >= 80) {
      await emailService.sendQuotaWarningEmail(
        subscription.userId,
        feature.aiComponent.name,
        usage,
        feature.limitValue,
        80
      );
    }
  }

  /**
   * Reset quotas for a subscription (called at period end)
   */
  async resetQuotas(subscriptionId: string): Promise<void> {
    logger.info('Resetting quotas', { subscriptionId });

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription || !subscription.currentPeriodEnd) {
      return;
    }

    // Archive old usage data (keep for analytics)
    // New period usage will be initialized by initializeUsageForSubscription

    logger.info('Quotas reset', { subscriptionId });
  }

  /**
   * Get usage analytics for admin dashboard
   */
  async getUsageAnalytics(params: {
    startDate: Date;
    endDate: Date;
    aiComponentSlug?: string;
  }) {
    const where: any = {
      periodStart: {
        gte: params.startDate,
      },
      periodEnd: {
        lte: params.endDate,
      },
    };

    if (params.aiComponentSlug) {
      const component = await prisma.aIComponent.findUnique({
        where: { slug: params.aiComponentSlug },
      });
      if (component) {
        where.aiComponentId = component.id;
      }
    }

    const usage = await prisma.usageTracking.findMany({
      where,
      include: {
        aiComponent: true,
        subscription: {
          include: {
            plan: true,
            user: true,
          },
        },
      },
    });

    // Aggregate by component
    const byComponent: Record<string, number> = {};
    const byPlan: Record<string, number> = {};

    for (const entry of usage) {
      const componentName = entry.aiComponent.name;
      const planName = entry.subscription.plan.name;

      byComponent[componentName] = (byComponent[componentName] || 0) + entry.value;
      byPlan[planName] = (byPlan[planName] || 0) + entry.value;
    }

    return {
      totalUsage: usage.reduce((sum, u) => sum + u.value, 0),
      byComponent,
      byPlan,
      details: usage,
    };
  }
}

export const usageTrackingService = new UsageTrackingService();
