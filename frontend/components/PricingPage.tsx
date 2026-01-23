// ═══════════════════════════════════════════════════════════════
// Dynamic Pricing Page Component
// Loads pricing from API - NO HARDCODED PRICES!
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSubscription } from '../hooks/useSubscription';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Plan {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  basePrice: number | null;
  billingPeriod: string;
  isCustomPricing: boolean;
  isPopular: boolean;
  features: Array<{
    aiComponent: {
      name: string;
      slug: string;
    };
    enabled: boolean;
    limitValue: number | null;
    displayName: string;
  }>;
  additionalFeatures: Array<{
    featureKey: string;
    displayName: string;
    enabled: boolean;
  }>;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { subscription } = useSubscription();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/public/plans`);
      setPlans(response.data.plans);
      setError(null);
    } catch (err) {
      setError('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        // Redirect to login
        window.location.href = '/login?redirect=/pricing';
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/subscriptions/create`,
        { planId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Redirect to PayPal for approval
      window.location.href = response.data.approvalUrl;
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create subscription');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Choose the plan that's right for your factoring business
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              currentPlan={subscription?.plan.slug}
              onSubscribe={() => handleSubscribe(plan.id)}
            />
          ))}
        </div>

        {/* FAQ or Trust Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-600">
            All plans include 24/7 support and regular AI model updates
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Cancel anytime • No long-term contracts • Secure payment via PayPal
          </p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  currentPlan,
  onSubscribe,
}: {
  plan: Plan;
  currentPlan?: string;
  onSubscribe: () => void;
}) {
  const isCurrentPlan = currentPlan === plan.slug;
  const isPopular = plan.isPopular;

  return (
    <div
      className={`relative rounded-2xl border ${
        isPopular
          ? 'border-indigo-600 shadow-xl scale-105'
          : 'border-gray-200'
      } bg-white p-8 ${isCurrentPlan ? 'opacity-75' : ''}`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute top-0 right-6 transform -translate-y-1/2">
          <span className="inline-flex rounded-full bg-indigo-600 px-4 py-1 text-sm font-semibold text-white">
            Most Popular
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            ✓ Current Plan
          </span>
        </div>
      )}

      {/* Plan Header */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{plan.tagline}</p>

        {/* Price */}
        <div className="mt-4">
          {plan.isCustomPricing ? (
            <div>
              <span className="text-4xl font-extrabold text-gray-900">Custom</span>
              <p className="mt-1 text-sm text-gray-500">Contact sales for pricing</p>
            </div>
          ) : (
            <div>
              <span className="text-4xl font-extrabold text-gray-900">
                ${plan.basePrice?.toFixed(0)}
              </span>
              <span className="text-lg text-gray-600">
                /{plan.billingPeriod === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Features List */}
      <ul className="space-y-4 mb-8">
        {/* AI Component Features */}
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <span
              className={`flex-shrink-0 ${
                feature.enabled ? 'text-green-500' : 'text-gray-300'
              }`}
            >
              {feature.enabled ? '✓' : '✗'}
            </span>
            <span
              className={`ml-3 text-sm ${
                feature.enabled ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              {feature.displayName || feature.aiComponent.name}
              {feature.enabled &&
                feature.limitValue !== null &&
                ` (${feature.limitValue}/month)`}
              {feature.enabled && feature.limitValue === null && ' (unlimited)'}
            </span>
          </li>
        ))}

        {/* Additional Features */}
        {plan.additionalFeatures
          .filter((f) => f.enabled)
          .map((feature, index) => (
            <li key={`additional-${index}`} className="flex items-start">
              <span className="flex-shrink-0 text-green-500">✓</span>
              <span className="ml-3 text-sm text-gray-700">
                {feature.displayName}
              </span>
            </li>
          ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={onSubscribe}
        disabled={isCurrentPlan}
        className={`w-full rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors ${
          isCurrentPlan
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isPopular
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {isCurrentPlan
          ? 'Current Plan'
          : plan.isCustomPricing
          ? 'Contact Sales'
          : 'Get Started'}
      </button>
    </div>
  );
}
