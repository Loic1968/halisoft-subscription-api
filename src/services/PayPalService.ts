// ═══════════════════════════════════════════════════════════════
// PayPal Billing API Integration Service
// Handles plan creation, subscription management, and webhooks
// ═══════════════════════════════════════════════════════════════

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface PayPalProduct {
  id: string;
  name: string;
  description?: string;
}

interface PayPalPlan {
  id: string;
  product_id: string;
  name: string;
  status: string;
  billing_cycles: BillingCycle[];
}

interface BillingCycle {
  frequency: {
    interval_unit: 'MONTH' | 'YEAR';
    interval_count: number;
  };
  tenure_type: 'REGULAR';
  sequence: number;
  total_cycles: number;
  pricing_scheme: {
    fixed_price: {
      value: string;
      currency_code: string;
    };
  };
}

interface CreateSubscriptionParams {
  planId: string;
  userEmail: string;
  returnUrl: string;
  cancelUrl: string;
}

export class PayPalService {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get OAuth access token from PayPal
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${process.env.PAYPAL_API_URL}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: process.env.PAYPAL_CLIENT_ID!,
            password: process.env.PAYPAL_CLIENT_SECRET!,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token expires in 9 hours, we'll refresh after 8 hours
      this.tokenExpiry = Date.now() + 8 * 60 * 60 * 1000;

      logger.info('PayPal access token obtained successfully');
      return this.accessToken;
    } catch (error: any) {
      logger.error('Failed to get PayPal access token', { error: error.message });
      throw new Error('PayPal authentication failed');
    }
  }

  /**
   * Make authenticated request to PayPal API
   */
  private async authenticatedRequest<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    data?: any
  ): Promise<T> {
    const token = await this.getAccessToken();

    try {
      const response = await this.api({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('PayPal API request failed', {
        method,
        url,
        error: error.response?.data || error.message,
      });
      throw error;
    }
  }

  /**
   * Create a billing plan in PayPal
   */
  async createBillingPlan(params: {
    name: string;
    description?: string;
    price: number;
    currency?: string;
    interval: 'MONTH' | 'YEAR';
  }): Promise<PayPalPlan> {
    logger.info('Creating PayPal billing plan', { name: params.name });

    const planData = {
      product_id: process.env.PAYPAL_PRODUCT_ID!,
      name: params.name,
      description: params.description || params.name,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: params.interval,
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Unlimited
          pricing_scheme: {
            fixed_price: {
              value: params.price.toFixed(2),
              currency_code: params.currency || 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    };

    const plan = await this.authenticatedRequest<PayPalPlan>(
      'post',
      '/v1/billing/plans',
      planData
    );

    logger.info('PayPal billing plan created', { planId: plan.id });
    return plan;
  }

  /**
   * Get billing plan details
   */
  async getPlan(planId: string): Promise<PayPalPlan> {
    return this.authenticatedRequest<PayPalPlan>(
      'get',
      `/v1/billing/plans/${planId}`
    );
  }

  /**
   * Update billing plan pricing
   * Note: PayPal doesn't allow direct price updates, so we create a new plan
   */
  async updatePlanPricing(
    oldPlanId: string,
    newPrice: number,
    planName: string
  ): Promise<PayPalPlan> {
    logger.info('Updating PayPal plan pricing (creating new plan)', {
      oldPlanId,
      newPrice,
    });

    // Get old plan details
    const oldPlan = await this.getPlan(oldPlanId);

    // Create new plan with updated price
    const newPlan = await this.createBillingPlan({
      name: planName,
      description: oldPlan.billing_cycles[0]?.pricing_scheme?.fixed_price
        ? `Updated from ${oldPlan.billing_cycles[0].pricing_scheme.fixed_price.value}`
        : undefined,
      price: newPrice,
      interval: oldPlan.billing_cycles[0]?.frequency?.interval_unit || 'MONTH',
    });

    // Deactivate old plan
    await this.deactivatePlan(oldPlanId);

    return newPlan;
  }

  /**
   * Deactivate a billing plan
   */
  async deactivatePlan(planId: string): Promise<void> {
    logger.info('Deactivating PayPal plan', { planId });

    await this.authenticatedRequest('patch', `/v1/billing/plans/${planId}`, [
      {
        op: 'replace',
        path: '/status',
        value: 'INACTIVE',
      },
    ]);
  }

  /**
   * Create a subscription for a user
   */
  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<{ id: string; approvalUrl: string }> {
    logger.info('Creating PayPal subscription', {
      planId: params.planId,
      userEmail: params.userEmail,
    });

    const subscriptionData = {
      plan_id: params.planId,
      subscriber: {
        email_address: params.userEmail,
      },
      application_context: {
        brand_name: 'HaliSoft',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    };

    const response = await this.authenticatedRequest<any>(
      'post',
      '/v1/billing/subscriptions',
      subscriptionData
    );

    // Extract approval URL
    const approvalUrl = response.links?.find(
      (link: any) => link.rel === 'approve'
    )?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL returned from PayPal');
    }

    logger.info('PayPal subscription created', { subscriptionId: response.id });

    return {
      id: response.id,
      approvalUrl,
    };
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    return this.authenticatedRequest<any>(
      'get',
      `/v1/billing/subscriptions/${subscriptionId}`
    );
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    reason?: string
  ): Promise<void> {
    logger.info('Cancelling PayPal subscription', { subscriptionId });

    await this.authenticatedRequest(
      'post',
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      {
        reason: reason || 'User requested cancellation',
      }
    );

    logger.info('PayPal subscription cancelled', { subscriptionId });
  }

  /**
   * Suspend a subscription (e.g., for payment failure)
   */
  async suspendSubscription(
    subscriptionId: string,
    reason?: string
  ): Promise<void> {
    logger.info('Suspending PayPal subscription', { subscriptionId });

    await this.authenticatedRequest(
      'post',
      `/v1/billing/subscriptions/${subscriptionId}/suspend`,
      {
        reason: reason || 'Payment failure',
      }
    );
  }

  /**
   * Reactivate a suspended subscription
   */
  async reactivateSubscription(
    subscriptionId: string,
    reason?: string
  ): Promise<void> {
    logger.info('Reactivating PayPal subscription', { subscriptionId });

    await this.authenticatedRequest(
      'post',
      `/v1/billing/subscriptions/${subscriptionId}/activate`,
      {
        reason: reason || 'Payment issue resolved',
      }
    );
  }

  /**
   * Verify PayPal webhook signature
   */
  async verifyWebhookSignature(
    headers: Record<string, string>,
    body: any
  ): Promise<boolean> {
    try {
      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID!,
        webhook_event: body,
      };

      const response = await this.authenticatedRequest<{ verification_status: string }>(
        'post',
        '/v1/notifications/verify-webhook-signature',
        verificationData
      );

      return response.verification_status === 'SUCCESS';
    } catch (error: any) {
      logger.error('PayPal webhook verification failed', {
        error: error.message,
      });
      return false;
    }
  }
}

export const paypalService = new PayPalService();
