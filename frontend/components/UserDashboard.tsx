// ═══════════════════════════════════════════════════════════════
// User Dashboard Component
// Display subscription info and usage statistics
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import Link from 'next/link';

export default function UserDashboard() {
  const {
    subscription,
    usage,
    loading,
    error,
    isApproachingLimit,
    isQuotaExceeded,
  } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  No Active Subscription
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You don't have an active subscription. Subscribe to access AI
                    components.
                  </p>
                </div>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                  >
                    View Plans →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const approachingLimitComponents = Object.entries(usage).filter(
    ([slug, data]) => data.limit !== null && data.percentage >= 80
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage your subscription and monitor AI component usage
          </p>
        </div>

        {/* Subscription Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Current Plan: {subscription.plan.name}
              </h2>
              <p className="mt-1 text-gray-600">
                Renews on:{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Status:{' '}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    subscription.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {subscription.status}
                </span>
              </p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/pricing"
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Change Plan
              </Link>
              <Link
                href="/settings/billing"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                Manage Billing
              </Link>
            </div>
          </div>
        </div>

        {/* Warning for approaching limits */}
        {approachingLimitComponents.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-yellow-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Approaching Usage Limits
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    You're approaching limits on:{' '}
                    {approachingLimitComponents
                      .map(([slug]) => usage[slug])
                      .join(', ')}
                  </p>
                </div>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                  >
                    Upgrade Plan →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(usage).map(([componentSlug, usageData]) => (
            <UsageCard
              key={componentSlug}
              componentSlug={componentSlug}
              data={usageData}
              isApproachingLimit={isApproachingLimit(componentSlug)}
              isExceeded={isQuotaExceeded(componentSlug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface UsageCardProps {
  componentSlug: string;
  data: {
    used: number;
    limit: number | null;
    percentage: number;
    resetDate: Date;
  };
  isApproachingLimit: boolean;
  isExceeded: boolean;
}

function UsageCard({
  componentSlug,
  data,
  isApproachingLimit,
  isExceeded,
}: UsageCardProps) {
  // Format component name from slug
  const componentName = componentSlug
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const getProgressColor = () => {
    if (isExceeded) return 'bg-red-600';
    if (isApproachingLimit) return 'bg-yellow-500';
    return 'bg-green-600';
  };

  const getStatusColor = () => {
    if (isExceeded) return 'text-red-600';
    if (isApproachingLimit) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {componentName}
      </h3>

      {/* Progress Bar */}
      {data.limit !== null ? (
        <>
          <div className="mb-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">
                {data.used} / {data.limit} used
              </span>
              <span className={`font-medium ${getStatusColor()}`}>
                {Math.round(data.percentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${Math.min(data.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Status Message */}
          {isExceeded && (
            <p className="text-sm text-red-600 mt-2">
              ⚠️ Quota exceeded. Upgrade to continue using this feature.
            </p>
          )}
          {isApproachingLimit && !isExceeded && (
            <p className="text-sm text-yellow-600 mt-2">
              ⚠️ Approaching limit. Consider upgrading your plan.
            </p>
          )}
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{data.used} used</span>
            <span className="text-sm font-medium text-gray-900">Unlimited</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-600 h-2 rounded-full w-full" />
          </div>
        </div>
      )}

      {/* Reset Date */}
      <p className="text-xs text-gray-500 mt-3">
        Resets: {new Date(data.resetDate).toLocaleDateString()}
      </p>
    </div>
  );
}
