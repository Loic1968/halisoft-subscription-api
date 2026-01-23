// ═══════════════════════════════════════════════════════════════
// useSubscription Hook
// Manage subscription state and data
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    features: Array<{
      aiComponent: {
        name: string;
        slug: string;
      };
      enabled: boolean;
      limitValue: number | null;
    }>;
  };
}

export interface UsageSummary {
  [componentSlug: string]: {
    used: number;
    limit: number | null;
    percentage: number;
    resetDate: Date;
  };
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      if (!token) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/api/subscriptions/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSubscription(response.data.subscription);
      setUsage(response.data.usage || {});
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscription');
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (componentSlug: string): boolean => {
    if (!subscription) return false;

    return subscription.plan.features.some(
      (f) => f.aiComponent.slug === componentSlug && f.enabled
    );
  };

  const getFeatureLimit = (componentSlug: string): number | null => {
    if (!subscription) return null;

    const feature = subscription.plan.features.find(
      (f) => f.aiComponent.slug === componentSlug && f.enabled
    );

    return feature?.limitValue || null;
  };

  const getFeatureUsage = (componentSlug: string) => {
    return usage[componentSlug] || { used: 0, limit: null, percentage: 0 };
  };

  const isApproachingLimit = (componentSlug: string, threshold = 80): boolean => {
    const componentUsage = usage[componentSlug];
    if (!componentUsage) return false;

    return componentUsage.percentage >= threshold;
  };

  const isQuotaExceeded = (componentSlug: string): boolean => {
    const componentUsage = usage[componentSlug];
    if (!componentUsage || componentUsage.limit === null) return false;

    return componentUsage.used >= componentUsage.limit;
  };

  const cancelSubscription = async (reason?: string, immediate = false) => {
    try {
      if (!subscription) throw new Error('No active subscription');

      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/subscriptions/${subscription.id}/cancel`,
        { reason, immediate },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchSubscription();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to cancel subscription',
      };
    }
  };

  const changePlan = async (newPlanId: string) => {
    try {
      if (!subscription) throw new Error('No active subscription');

      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/subscriptions/${subscription.id}/change-plan`,
        { newPlanId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.subscription.status === 'PENDING') {
        // Redirect to PayPal for approval
        return {
          success: true,
          requiresApproval: true,
          approvalUrl: response.data.approvalUrl,
        };
      }

      await fetchSubscription();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to change plan',
      };
    }
  };

  return {
    subscription,
    usage,
    loading,
    error,
    hasFeature,
    getFeatureLimit,
    getFeatureUsage,
    isApproachingLimit,
    isQuotaExceeded,
    cancelSubscription,
    changePlan,
    refetch: fetchSubscription,
  };
}
