// ═══════════════════════════════════════════════════════════════
// Quota Enforcement Middleware
// Check and enforce usage quotas for AI components
// ═══════════════════════════════════════════════════════════════

import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { SubscriptionRequest } from './subscription';
import { usageTrackingService } from '../services/UsageTrackingService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface QuotaRequest extends SubscriptionRequest {
  componentQuota?: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
}

/**
 * Factory function to create quota enforcement middleware for specific AI component
 */
export function enforceQuota(aiComponentSlug: string) {
  return async (
    req: QuotaRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.subscription) {
        res.status(403).json({
          error: 'Active subscription required',
          code: 'NO_SUBSCRIPTION',
        });
        return;
      }

      // Get AI component
      const aiComponent = await prisma.aIComponent.findUnique({
        where: { slug: aiComponentSlug },
      });

      if (!aiComponent || !aiComponent.isActive) {
        res.status(404).json({
          error: 'AI component not found or inactive',
        });
        return;
      }

      // Check if component is available in user's plan
      const planFeature = await prisma.planFeature.findFirst({
        where: {
          planId: req.subscription.plan.id,
          aiComponentId: aiComponent.id,
          enabled: true,
        },
      });

      if (!planFeature) {
        // Component not available in this plan
        const availablePlans = await prisma.planFeature.findMany({
          where: {
            aiComponentId: aiComponent.id,
            enabled: true,
          },
          include: {
            plan: true,
          },
          orderBy: {
            plan: {
              basePrice: 'asc',
            },
          },
        });

        const minPlan = availablePlans[0]?.plan;

        res.status(403).json({
          error: `${aiComponent.name} not available in your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          currentPlan: req.subscription.plan.name,
          requiredPlan: minPlan?.name,
          upgradeUrl: '/pricing',
        });
        return;
      }

      // Check quota (if limited)
      if (planFeature.limitValue !== null) {
        const currentUsage = await usageTrackingService.getComponentUsage(
          req.subscription.id,
          aiComponent.id
        );

        if (currentUsage >= planFeature.limitValue) {
          res.status(429).json({
            error: 'Quota exceeded',
            code: 'QUOTA_EXCEEDED',
            component: aiComponent.name,
            current: currentUsage,
            limit: planFeature.limitValue,
            resetDate: req.subscription.currentPeriodEnd,
            upgradeUrl: '/pricing',
          });
          return;
        }

        // Attach quota info to request
        req.componentQuota = {
          used: currentUsage,
          limit: planFeature.limitValue,
          remaining: planFeature.limitValue - currentUsage,
        };
      } else {
        // Unlimited quota
        const currentUsage = await usageTrackingService.getComponentUsage(
          req.subscription.id,
          aiComponent.id
        );

        req.componentQuota = {
          used: currentUsage,
          limit: null,
          remaining: null,
        };
      }

      logger.debug('Quota check passed', {
        component: aiComponentSlug,
        subscription: req.subscription.id,
        quota: req.componentQuota,
      });

      next();
    } catch (error: any) {
      logger.error('Quota enforcement failed', {
        component: aiComponentSlug,
        error: error.message,
      });

      res.status(500).json({
        error: 'Failed to check quota',
      });
    }
  };
}

/**
 * Middleware to check for a specific additional feature (non-AI)
 */
export function requireFeature(featureKey: string) {
  return async (
    req: SubscriptionRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.subscription) {
        res.status(403).json({
          error: 'Active subscription required',
        });
        return;
      }

      // Check if feature is available in plan
      const additionalFeature = await prisma.planAdditionalFeature.findFirst({
        where: {
          planId: req.subscription.plan.id,
          featureKey,
          enabled: true,
        },
      });

      if (!additionalFeature) {
        // Find minimum plan with this feature
        const availablePlans = await prisma.planAdditionalFeature.findMany({
          where: {
            featureKey,
            enabled: true,
          },
          include: {
            plan: true,
          },
          orderBy: {
            plan: {
              basePrice: 'asc',
            },
          },
        });

        const minPlan = availablePlans[0]?.plan;

        res.status(403).json({
          error: `Feature '${featureKey}' not available in your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          currentPlan: req.subscription.plan.name,
          requiredPlan: minPlan?.name,
          upgradeUrl: '/pricing',
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error('Feature check failed', {
        feature: featureKey,
        error: error.message,
      });

      res.status(500).json({
        error: 'Failed to verify feature access',
      });
    }
  };
}

/**
 * Track usage after successful request
 * This should be called after the AI component has been executed
 */
export function trackUsage(aiComponentSlug: string, amount: number = 1) {
  return async (
    req: QuotaRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.subscription) {
        next();
        return;
      }

      // Track the usage asynchronously (don't block response)
      usageTrackingService
        .incrementUsage(req.subscription.id, aiComponentSlug, amount)
        .catch((error) => {
          logger.error('Failed to track usage', {
            component: aiComponentSlug,
            subscription: req.subscription?.id,
            error: error.message,
          });
        });

      next();
    } catch (error) {
      // Don't fail the request if tracking fails
      next();
    }
  };
}
