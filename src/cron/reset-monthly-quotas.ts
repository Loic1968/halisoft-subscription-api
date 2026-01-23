// ═══════════════════════════════════════════════════════════════
// Reset Monthly Quotas Cron Job
// Runs daily to check for subscriptions that need quota reset
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, addMonths, addYears } from 'date-fns';
import { usageTrackingService } from '../services/UsageTrackingService';
import { emailService } from '../services/EmailService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function resetMonthlyQuotas() {
  logger.info('Starting monthly quota reset job');

  try {
    // Find subscriptions expiring today
    const today = new Date();
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: startOfDay(today),
          lt: endOfDay(today),
        },
      },
      include: {
        plan: true,
        user: true,
      },
    });

    logger.info(`Found ${expiringSubscriptions.length} subscriptions to reset`);

    for (const subscription of expiringSubscriptions) {
      try {
        // Get usage summary for last period
        const lastPeriodUsage = await usageTrackingService.getCurrentPeriodUsage(
          subscription.id
        );

        // Calculate new period dates
        const newPeriodStart = new Date();
        const billingPeriod = subscription.plan.billingPeriod;
        const newPeriodEnd =
          billingPeriod === 'yearly'
            ? addYears(newPeriodStart, 1)
            : addMonths(newPeriodStart, 1);

        // Update subscription period
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
          },
        });

        // Reset quotas
        await usageTrackingService.resetQuotas(subscription.id);
        await usageTrackingService.initializeUsageForSubscription(
          subscription.id,
          newPeriodStart,
          newPeriodEnd
        );

        // Send monthly report email
        const usageForReport: Record<string, { used: number; limit: number | null }> = {};

        for (const [componentSlug, data] of Object.entries(lastPeriodUsage)) {
          usageForReport[componentSlug] = {
            used: data.used,
            limit: data.limit,
          };
        }

        await emailService.sendMonthlyUsageReport(
          subscription.userId,
          usageForReport
        );

        logger.info('Quotas reset successfully', {
          subscriptionId: subscription.id,
          userId: subscription.userId,
        });
      } catch (error: any) {
        logger.error('Failed to reset quota for subscription', {
          subscriptionId: subscription.id,
          error: error.message,
        });
      }
    }

    logger.info('Monthly quota reset job completed');
  } catch (error: any) {
    logger.error('Quota reset job failed', { error: error.message });
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  resetMonthlyQuotas()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default resetMonthlyQuotas;
