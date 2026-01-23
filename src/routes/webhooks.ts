// ═══════════════════════════════════════════════════════════════
// PayPal Webhook Routes
// Handle PayPal billing events
// ═══════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { paypalService } from '../services/PayPalService';
import { subscriptionService } from '../services/SubscriptionService';
import { usageTrackingService } from '../services/UsageTrackingService';
import { emailService } from '../services/EmailService';
import { logger } from '../utils/logger';
import { addMonths, addYears } from 'date-fns';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /webhooks/paypal
 * Handle PayPal webhook events
 */
router.post('/paypal', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const headers = req.headers as Record<string, string>;

    // Verify webhook signature
    const isValid = await paypalService.verifyWebhookSignature(headers, event);

    if (!isValid) {
      logger.error('Invalid PayPal webhook signature', { eventId: event.id });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Log the event
    await prisma.payPalEvent.create({
      data: {
        eventType: event.event_type,
        eventId: event.id,
        payload: event,
        processed: false,
      },
    });

    logger.info('PayPal webhook received', {
      eventType: event.event_type,
      eventId: event.id,
    });

    // Process event based on type
    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        await handleSubscriptionCreated(event);
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(event);
        break;

      case 'PAYMENT.SALE.COMPLETED':
        await handlePaymentCompleted(event);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(event);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(event);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        await handlePaymentFailed(event);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        await handleSubscriptionUpdated(event);
        break;

      default:
        logger.info('Unhandled PayPal event type', {
          eventType: event.event_type,
        });
    }

    // Mark event as processed
    await prisma.payPalEvent.updateMany({
      where: { eventId: event.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error('PayPal webhook processing failed', {
      error: error.message,
      stack: error.stack,
    });

    // Mark event as failed
    if (req.body?.id) {
      await prisma.payPalEvent.updateMany({
        where: { eventId: req.body.id },
        data: {
          processed: false,
          errorMessage: error.message,
        },
      });
    }

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(event: any): Promise<void> {
  logger.info('Processing SUBSCRIPTION.CREATED', {
    subscriptionId: event.resource.id,
  });

  // Subscription is already created in our DB when user initiates
  // Just log the event
}

/**
 * Handle subscription activated (user approved payment)
 */
async function handleSubscriptionActivated(event: any): Promise<void> {
  const paypalSubscriptionId = event.resource.id;

  logger.info('Processing SUBSCRIPTION.ACTIVATED', { paypalSubscriptionId });

  try {
    await subscriptionService.activateSubscription(paypalSubscriptionId);
  } catch (error: any) {
    logger.error('Failed to activate subscription', {
      paypalSubscriptionId,
      error: error.message,
    });
  }
}

/**
 * Handle payment completed (monthly/yearly payment)
 */
async function handlePaymentCompleted(event: any): Promise<void> {
  const billingAgreementId = event.resource.billing_agreement_id;
  const amount = parseFloat(event.resource.amount.total);

  logger.info('Processing PAYMENT.COMPLETED', {
    billingAgreementId,
    amount,
  });

  try {
    // Find subscription
    const subscription = await prisma.subscription.findFirst({
      where: { paypalSubscriptionId: billingAgreementId },
      include: { plan: true, user: true },
    });

    if (!subscription) {
      logger.error('Subscription not found for payment', {
        billingAgreementId,
      });
      return;
    }

    // Update billing period
    const billingPeriod = subscription.plan.billingPeriod;
    const newPeriodStart = new Date();
    const newPeriodEnd =
      billingPeriod === 'yearly'
        ? addYears(newPeriodStart, 1)
        : addMonths(newPeriodStart, 1);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        status: 'ACTIVE',
      },
    });

    // Reset quotas for new period
    await usageTrackingService.resetQuotas(subscription.id);
    await usageTrackingService.initializeUsageForSubscription(
      subscription.id,
      newPeriodStart,
      newPeriodEnd
    );

    // Send payment receipt
    await emailService.sendPaymentReceipt(
      subscription.userId,
      amount,
      subscription.plan.name
    );

    logger.info('Payment processed and quotas reset', {
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    logger.error('Failed to process payment', {
      billingAgreementId,
      error: error.message,
    });
  }
}

/**
 * Handle subscription cancelled
 */
async function handleSubscriptionCancelled(event: any): Promise<void> {
  const paypalSubscriptionId = event.resource.id;

  logger.info('Processing SUBSCRIPTION.CANCELLED', { paypalSubscriptionId });

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { paypalSubscriptionId },
    });

    if (!subscription) {
      logger.error('Subscription not found', { paypalSubscriptionId });
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    logger.info('Subscription marked as cancelled', {
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    logger.error('Failed to cancel subscription', {
      paypalSubscriptionId,
      error: error.message,
    });
  }
}

/**
 * Handle subscription suspended (payment failure)
 */
async function handleSubscriptionSuspended(event: any): Promise<void> {
  const paypalSubscriptionId = event.resource.id;

  logger.info('Processing SUBSCRIPTION.SUSPENDED', { paypalSubscriptionId });

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { paypalSubscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      logger.error('Subscription not found', { paypalSubscriptionId });
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'SUSPENDED',
      },
    });

    // Send suspension email
    await emailService.sendPaymentFailedEmail(subscription.userId);

    logger.info('Subscription suspended due to payment failure', {
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    logger.error('Failed to suspend subscription', {
      paypalSubscriptionId,
      error: error.message,
    });
  }
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(event: any): Promise<void> {
  const paypalSubscriptionId = event.resource.id;

  logger.info('Processing PAYMENT.FAILED', { paypalSubscriptionId });

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { paypalSubscriptionId },
      include: { user: true },
    });

    if (!subscription) {
      logger.error('Subscription not found', { paypalSubscriptionId });
      return;
    }

    // Send payment failed email
    await emailService.sendPaymentFailedEmail(subscription.userId);

    logger.info('Payment failure notification sent', {
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    logger.error('Failed to handle payment failure', {
      paypalSubscriptionId,
      error: error.message,
    });
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(event: any): Promise<void> {
  const paypalSubscriptionId = event.resource.id;

  logger.info('Processing SUBSCRIPTION.UPDATED', { paypalSubscriptionId });

  // Log the update for audit purposes
  // Additional handling can be added based on specific update types
}

export default router;
