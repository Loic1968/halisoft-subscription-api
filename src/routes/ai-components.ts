// ═══════════════════════════════════════════════════════════════
// AI Components Routes
// Execute AI components with quota enforcement
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { checkSubscription } from '../middleware/subscription';
import { enforceQuota, trackUsage } from '../middleware/quotaEnforcement';
import { logger } from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * POST /api/ai/invoice-ocr/analyze
 * Invoice OCR & Analysis component
 */
router.post(
  '/invoice-ocr/analyze',
  authenticateUser,
  checkSubscription,
  enforceQuota('invoice_ocr'),
  async (req: any, res) => {
    try {
      const { invoiceData, imageBase64 } = req.body;

      if (!invoiceData && !imageBase64) {
        return res.status(400).json({
          error: 'invoiceData or imageBase64 is required',
        });
      }

      // Call Claude API for invoice analysis
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Analyze this invoice and extract all relevant data including:
- Invoice number
- Date
- Vendor/Supplier information
- Line items with descriptions, quantities, unit prices
- Subtotal, tax, and total amounts
- Payment terms
- Due date

Invoice data: ${JSON.stringify(invoiceData || 'See attached image')}

Return the data as structured JSON.`,
          },
        ],
      });

      const analysis = response.content[0];
      const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

      // Track usage
      await trackUsage('invoice_ocr', 1)(req, res, () => {});

      res.json({
        analysis,
        tokensUsed,
        quota: req.componentQuota,
      });
    } catch (error: any) {
      logger.error('Invoice OCR analysis failed', {
        error: error.message,
        subscription: req.subscription?.id,
      });

      res.status(500).json({
        error: 'Analysis failed',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/ai/risk-assessment/evaluate
 * Risk Assessment & Scoring component
 */
router.post(
  '/risk-assessment/evaluate',
  authenticateUser,
  checkSubscription,
  enforceQuota('risk_assessment'),
  async (req: any, res) => {
    try {
      const { companyData } = req.body;

      if (!companyData) {
        return res.status(400).json({
          error: 'companyData is required',
        });
      }

      // Check if advanced AI scoring is available (Professional+)
      const plan = req.subscription.plan;
      const useAdvancedAI = plan.slug !== 'starter';

      let riskScore, analysis;

      if (useAdvancedAI) {
        // Advanced AI risk assessment with Claude
        const response = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Perform a comprehensive credit risk assessment for this company:

${JSON.stringify(companyData, null, 2)}

Provide:
1. Overall risk score (0-100, where 100 is lowest risk)
2. Risk category (Low, Medium, High, Very High)
3. Key risk factors identified
4. Recommendations for factoring terms
5. Red flags or concerns

Return as JSON with: { score, category, factors, recommendations, redFlags }`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          try {
            analysis = JSON.parse(content.text);
          } catch {
            analysis = { rawAnalysis: content.text };
          }
        }

        riskScore = analysis.score || 50;
      } else {
        // Basic algorithmic scoring for Starter plan
        riskScore = calculateBasicRiskScore(companyData);
        analysis = {
          score: riskScore,
          category: getRiskCategory(riskScore),
          note: 'Upgrade to Professional for AI-powered risk assessment',
        };
      }

      // Track usage
      await trackUsage('risk_assessment', 1)(req, res, () => {});

      res.json({
        riskScore,
        analysis,
        quota: req.componentQuota,
      });
    } catch (error: any) {
      logger.error('Risk assessment failed', {
        error: error.message,
        subscription: req.subscription?.id,
      });

      res.status(500).json({
        error: 'Risk assessment failed',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/ai/document-processing/verify
 * Document Processing & KYC component
 */
router.post(
  '/document-processing/verify',
  authenticateUser,
  checkSubscription,
  enforceQuota('document_processing'),
  async (req: any, res) => {
    try {
      const { documentType, documentData, imageBase64 } = req.body;

      if (!documentType || (!documentData && !imageBase64)) {
        return res.status(400).json({
          error: 'documentType and (documentData or imageBase64) are required',
        });
      }

      // Call Claude for document verification
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: `Verify this ${documentType} document for KYC purposes:

${JSON.stringify(documentData || 'See attached image', null, 2)}

Check for:
1. Document authenticity indicators
2. Required fields completeness
3. Inconsistencies or red flags
4. Compliance with KYC standards
5. Data extraction accuracy

Return JSON with: { isValid, confidence, extractedData, issues, recommendations }`,
          },
        ],
      });

      const content = response.content[0];
      let verification;

      if (content.type === 'text') {
        try {
          verification = JSON.parse(content.text);
        } catch {
          verification = { rawAnalysis: content.text };
        }
      }

      // Track usage
      await trackUsage('document_processing', 1)(req, res, () => {});

      res.json({
        verification,
        quota: req.componentQuota,
      });
    } catch (error: any) {
      logger.error('Document processing failed', {
        error: error.message,
        subscription: req.subscription?.id,
      });

      res.status(500).json({
        error: 'Document processing failed',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/ai/financial-audit/analyze
 * Financial Audit Tools component (Professional+ only)
 */
router.post(
  '/financial-audit/analyze',
  authenticateUser,
  checkSubscription,
  enforceQuota('financial_audit'),
  async (req: any, res) => {
    try {
      const { financialStatements, analysisType } = req.body;

      if (!financialStatements) {
        return res.status(400).json({
          error: 'financialStatements is required',
        });
      }

      // Call Claude for financial analysis
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Perform ${analysisType || 'comprehensive'} financial analysis:

${JSON.stringify(financialStatements, null, 2)}

Calculate key ratios and provide insights:
- Liquidity ratios (Current, Quick, Cash)
- Profitability ratios (ROE, ROA, Profit Margin)
- Leverage ratios (Debt-to-Equity, Interest Coverage)
- Efficiency ratios (Asset Turnover, Inventory Turnover)

Return JSON with: { ratios, analysis, strengths, concerns, recommendation }`,
          },
        ],
      });

      const content = response.content[0];
      let analysis;

      if (content.type === 'text') {
        try {
          analysis = JSON.parse(content.text);
        } catch {
          analysis = { rawAnalysis: content.text };
        }
      }

      // Track usage
      await trackUsage('financial_audit', 1)(req, res, () => {});

      res.json({
        analysis,
        quota: req.componentQuota,
      });
    } catch (error: any) {
      logger.error('Financial audit failed', {
        error: error.message,
        subscription: req.subscription?.id,
      });

      res.status(500).json({
        error: 'Financial audit failed',
        details: error.message,
      });
    }
  }
);

// Helper functions for basic risk scoring (Starter plan)
function calculateBasicRiskScore(companyData: any): number {
  let score = 50; // Base score

  // Simple heuristics
  if (companyData.yearsInBusiness > 5) score += 10;
  if (companyData.annualRevenue > 1000000) score += 15;
  if (companyData.paymentHistory === 'excellent') score += 20;
  if (companyData.creditScore > 700) score += 15;

  // Deductions
  if (companyData.latePayments > 2) score -= 20;
  if (companyData.outstandingDebts > 500000) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getRiskCategory(score: number): string {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  if (score >= 40) return 'High Risk';
  return 'Very High Risk';
}

export default router;
