// ═══════════════════════════════════════════════════════════════
// useAIComponent Hook
// Execute AI components with automatic quota checking
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import axios from 'axios';
import { useSubscription } from './useSubscription';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AIComponentExecuteParams {
  [key: string]: any;
}

export interface AIComponentResponse {
  [key: string]: any;
  quota?: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
}

export function useAIComponent(componentSlug: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const { hasFeature, isQuotaExceeded, refetch: refetchSubscription } = useSubscription();

  const execute = async (params: AIComponentExecuteParams): Promise<AIComponentResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Check if user has access to this component
      if (!hasFeature(componentSlug)) {
        throw new Error(
          `${componentSlug} is not available in your plan. Please upgrade.`
        );
      }

      // Check if quota is exceeded (client-side check)
      if (isQuotaExceeded(componentSlug)) {
        throw new Error(
          `You've reached your quota for ${componentSlug}. Upgrade your plan or wait for quota reset.`
        );
      }

      // Execute the AI component
      const token = localStorage.getItem('authToken');

      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await axios.post(
        `${API_URL}/api/ai/${componentSlug}/analyze`,
        params,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setData(response.data);

      // Refetch subscription to update usage
      await refetchSubscription();

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Execution failed';
      setError(errorMessage);

      // Handle specific error codes
      if (err.response?.status === 403) {
        // Feature not available or subscription issue
        throw new Error(errorMessage);
      } else if (err.response?.status === 429) {
        // Quota exceeded
        throw new Error(
          `Quota exceeded for ${componentSlug}. ${err.response.data.message || ''}`
        );
      }

      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
  };

  return {
    execute,
    loading,
    error,
    data,
    reset,
  };
}

// ═══════════════════════════════════════════════════════════════
// Specialized hooks for each AI component
// ═══════════════════════════════════════════════════════════════

export function useInvoiceOCR() {
  const component = useAIComponent('invoice_ocr');

  const analyzeInvoice = async (invoiceData: any, imageBase64?: string) => {
    return component.execute({ invoiceData, imageBase64 });
  };

  return {
    ...component,
    analyzeInvoice,
  };
}

export function useRiskAssessment() {
  const component = useAIComponent('risk_assessment');

  const evaluateRisk = async (companyData: any) => {
    return component.execute({ companyData });
  };

  return {
    ...component,
    evaluateRisk,
  };
}

export function useDocumentProcessing() {
  const component = useAIComponent('document_processing');

  const verifyDocument = async (
    documentType: string,
    documentData: any,
    imageBase64?: string
  ) => {
    return component.execute({ documentType, documentData, imageBase64 });
  };

  return {
    ...component,
    verifyDocument,
  };
}

export function useFinancialAudit() {
  const component = useAIComponent('financial_audit');

  const analyzeFinancials = async (
    financialStatements: any,
    analysisType?: string
  ) => {
    return component.execute({ financialStatements, analysisType });
  };

  return {
    ...component,
    analyzeFinancials,
  };
}
