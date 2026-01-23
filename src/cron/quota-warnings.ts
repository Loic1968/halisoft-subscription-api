// ═══════════════════════════════════════════════════════════════
// Quota Warning Cron Job
// Runs every 6 hours to check for subscriptions approaching limits
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { usageTrackingService } from '../services/UsageTrackingService';
import { emailService } from '../services/EmailService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function sendQuotaWarnings() {
  logger.info('Starting quota warning check');

  try {
    // Get all active subscriptions
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        plan: {
          include: {
            features: {
              where: {
                enabled: true,
                limitValue: {
                  not: null,
                },
              },
              include: {
                aiComponent: true,
              },
            },
          },
        },
        user: true,
      },
    });

    logger.info(`Checking ${activeSubscriptions.length} active subscriptions`);

    let warningsSent = 0;

    for (const subscription of activeSubscriptions) {
      try {
        const usage = await usageTrackingService.getCurrentPeriodUsage(
          subscription.id
        );

        for (const feature of subscription.plan.features) {
          const componentUsage = usage[feature.aiComponent.slug];

          if (!componentUsage || feature.limitValue === null) continue;

          const used = componentUsage.used;
          const limit = feature.limitValue;
          const percentage = (used / limit) * 100;

          // Send appropriate warnings
          if (percentage >= 100) {
            // Quota exceeded
            await emailService.sendQuotaExceededEmail(
              subscription.userId,
              feature.aiComponent.name,
              used,
              limit
            );
            warningsSent++;

            logger.info('Quota exceeded email sent', {
              subscriptionId: subscription.id,
              component: feature.aiComponent.slug,
              percentage,
            });
          } else if (percentage >= 90) {
            // 90% warning
            await emailService.sendQuotaWarningEmail(
              subscription.userId,
              feature.aiComponent.name,
              used,
              limit,
              90
            );
            warningsSent++;

            logger.info('90% quota warning email sent', {
              subscriptionId: subscription.id,
              component: feature.aiComponent.slug,
              percentage,
            });
          } else if (percentage >= 80 && percentage < 90) {
            // 80% warning
            await emailService.sendQuotaWarningEmail(
              subscription.userId,
              feature.aiComponent.name,
              used,
              limit,
              80
            );
            warningsSent++;

            logger.info('80% quota warning email sent', {
              subscriptionId: subscription.id,
              component: feature.aiComponent.slug,
              percentage,
            });
          }
        }
      } catch (error: any) {
        logger.error('Failed to check quota for subscription', {
          subscriptionId: subscription.id,
          error: error.message,
        });
      }
    }

    logger.info(`Quota warning check completed. Sent ${warningsSent} warnings`);
  } catch (error: any) {
    logger.error('Quota warning job failed', { error: error.message });
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  sendQuotaWarnings()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default sendQuotaWarnings;
