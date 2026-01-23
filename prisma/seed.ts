// ═══════════════════════════════════════════════════════════════
// Database Seed Script
// Initialize database with plans and AI components
// ═══════════════════════════════════════════════════════════════

import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ═══════════════════════════════════════════════════════════════
  // 1. Create AI Components
  // ═══════════════════════════════════════════════════════════════

  console.log('📦 Creating AI components...');

  const aiComponents = [
    {
      name: 'Invoice OCR & Analysis',
      slug: 'invoice_ocr',
      description: 'AI-powered invoice data extraction and analysis',
      category: 'document_analysis',
      apiEndpoint: '/api/ai/invoice-ocr/analyze',
      requiresClaudeAPI: true,
      baseTokenCost: 1500,
    },
    {
      name: 'Risk Assessment & Scoring',
      slug: 'risk_assessment',
      description: 'Credit risk evaluation and scoring with ML',
      category: 'credit_analysis',
      apiEndpoint: '/api/ai/risk-assessment/evaluate',
      requiresClaudeAPI: true,
      baseTokenCost: 2000,
    },
    {
      name: 'Document Processing (KYC)',
      slug: 'document_processing',
      description: 'Document verification and KYC compliance',
      category: 'document_analysis',
      apiEndpoint: '/api/ai/document-processing/verify',
      requiresClaudeAPI: true,
      baseTokenCost: 2500,
    },
    {
      name: 'Financial Audit Tools',
      slug: 'financial_audit',
      description: 'Financial ratios and balance sheet analysis',
      category: 'financial_analysis',
      apiEndpoint: '/api/ai/financial-audit/analyze',
      requiresClaudeAPI: true,
      baseTokenCost: 3000,
    },
    {
      name: 'AR Aging Analysis',
      slug: 'ar_aging',
      description: 'Accounts receivable aging and collection analysis',
      category: 'financial_analysis',
      apiEndpoint: '/api/ai/ar-aging/analyze',
      requiresClaudeAPI: true,
      baseTokenCost: 1800,
    },
    {
      name: 'Multi-Currency Conversion',
      slug: 'currency_conversion',
      description: 'Real-time multi-currency conversion and analysis',
      category: 'financial_analysis',
      apiEndpoint: '/api/ai/currency/convert',
      requiresClaudeAPI: false,
      baseTokenCost: 100,
    },
  ];

  const createdComponents: any = {};

  for (const component of aiComponents) {
    const created = await prisma.aIComponent.upsert({
      where: { slug: component.slug },
      update: component,
      create: component,
    });

    createdComponents[component.slug] = created;
    console.log(`  ✓ ${component.name}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. Create Subscription Plans
  // ═══════════════════════════════════════════════════════════════

  console.log('💎 Creating subscription plans...');

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'starter' },
    update: {},
    create: {
      name: 'Starter',
      slug: 'starter',
      tagline: 'Perfect for small factoring companies',
      description: 'Essential AI tools to get started with automated factoring',
      basePrice: new Prisma.Decimal(299.0),
      billingPeriod: 'monthly',
      isCustomPricing: false,
      isPopular: false,
      sortOrder: 1,
    },
  });

  console.log('  ✓ Starter Plan');

  const professionalPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'professional' },
    update: {},
    create: {
      name: 'Professional',
      slug: 'professional',
      tagline: 'For growing factoring businesses',
      description: 'Advanced AI features with increased limits and integrations',
      basePrice: new Prisma.Decimal(799.0),
      billingPeriod: 'monthly',
      isCustomPricing: false,
      isPopular: true,
      sortOrder: 2,
    },
  });

  console.log('  ✓ Professional Plan');

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      slug: 'enterprise',
      tagline: 'For large factors and banks',
      description: 'Unlimited usage, custom AI models, and white-label deployment',
      basePrice: null,
      billingPeriod: 'monthly',
      isCustomPricing: true,
      isPopular: false,
      sortOrder: 3,
    },
  });

  console.log('  ✓ Enterprise Plan');

  // ═══════════════════════════════════════════════════════════════
  // 3. Configure Plan Features
  // ═══════════════════════════════════════════════════════════════

  console.log('🎨 Configuring plan features...');

  // STARTER PLAN FEATURES
  const starterFeatures = [
    {
      aiComponentSlug: 'invoice_ocr',
      enabled: true,
      limitValue: 100,
      displayName: '100 invoice analyses/month',
    },
    {
      aiComponentSlug: 'risk_assessment',
      enabled: true,
      limitValue: 50,
      displayName: 'Basic risk scoring (50/month)',
    },
    {
      aiComponentSlug: 'document_processing',
      enabled: false,
      limitValue: null,
      displayName: 'Document Processing (KYC)',
    },
    {
      aiComponentSlug: 'financial_audit',
      enabled: false,
      limitValue: null,
      displayName: 'Financial Audit Tools',
    },
    {
      aiComponentSlug: 'ar_aging',
      enabled: false,
      limitValue: null,
      displayName: 'AR Aging Analysis',
    },
    {
      aiComponentSlug: 'currency_conversion',
      enabled: true,
      limitValue: 500,
      displayName: 'Currency conversions (500/month)',
    },
  ];

  for (const [index, feature] of starterFeatures.entries()) {
    await prisma.planFeature.upsert({
      where: {
        planId_aiComponentId: {
          planId: starterPlan.id,
          aiComponentId: createdComponents[feature.aiComponentSlug].id,
        },
      },
      update: {},
      create: {
        planId: starterPlan.id,
        aiComponentId: createdComponents[feature.aiComponentSlug].id,
        enabled: feature.enabled,
        limitValue: feature.limitValue,
        limitType: 'count',
        displayName: feature.displayName,
        displayOrder: index,
      },
    });
  }

  console.log('  ✓ Starter features configured');

  // PROFESSIONAL PLAN FEATURES
  const professionalFeatures = [
    {
      aiComponentSlug: 'invoice_ocr',
      enabled: true,
      limitValue: 500,
      displayName: '500 invoice analyses/month',
    },
    {
      aiComponentSlug: 'risk_assessment',
      enabled: true,
      limitValue: 300,
      displayName: 'Advanced ML risk scoring (300/month)',
    },
    {
      aiComponentSlug: 'document_processing',
      enabled: true,
      limitValue: 200,
      displayName: 'Document Processing & KYC (200/month)',
    },
    {
      aiComponentSlug: 'financial_audit',
      enabled: true,
      limitValue: 150,
      displayName: 'Financial audit & ratios (150/month)',
    },
    {
      aiComponentSlug: 'ar_aging',
      enabled: true,
      limitValue: 200,
      displayName: 'AR aging analysis (200/month)',
    },
    {
      aiComponentSlug: 'currency_conversion',
      enabled: true,
      limitValue: 2000,
      displayName: 'Currency conversions (2000/month)',
    },
  ];

  for (const [index, feature] of professionalFeatures.entries()) {
    await prisma.planFeature.upsert({
      where: {
        planId_aiComponentId: {
          planId: professionalPlan.id,
          aiComponentId: createdComponents[feature.aiComponentSlug].id,
        },
      },
      update: {},
      create: {
        planId: professionalPlan.id,
        aiComponentId: createdComponents[feature.aiComponentSlug].id,
        enabled: feature.enabled,
        limitValue: feature.limitValue,
        limitType: 'count',
        displayName: feature.displayName,
        displayOrder: index,
      },
    });
  }

  console.log('  ✓ Professional features configured');

  // ENTERPRISE PLAN FEATURES (All unlimited)
  const enterpriseFeatures = Object.keys(createdComponents).map(
    (slug, index) => ({
      aiComponentSlug: slug,
      enabled: true,
      limitValue: null, // Unlimited
      displayName: `${createdComponents[slug].name} (unlimited)`,
      displayOrder: index,
    })
  );

  for (const feature of enterpriseFeatures) {
    await prisma.planFeature.upsert({
      where: {
        planId_aiComponentId: {
          planId: enterprisePlan.id,
          aiComponentId: createdComponents[feature.aiComponentSlug].id,
        },
      },
      update: {},
      create: {
        planId: enterprisePlan.id,
        aiComponentId: createdComponents[feature.aiComponentSlug].id,
        enabled: feature.enabled,
        limitValue: feature.limitValue,
        limitType: 'count',
        displayName: feature.displayName,
        displayOrder: feature.displayOrder,
      },
    });
  }

  console.log('  ✓ Enterprise features configured');

  // ═══════════════════════════════════════════════════════════════
  // 4. Add Additional Features (non-AI)
  // ═══════════════════════════════════════════════════════════════

  console.log('➕ Adding additional features...');

  // Starter additional features
  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: starterPlan.id,
        featureKey: 'email_notifications',
      },
    },
    update: {},
    create: {
      planId: starterPlan.id,
      featureKey: 'email_notifications',
      enabled: true,
      displayName: 'Email notifications',
    },
  });

  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: starterPlan.id,
        featureKey: 'branding_customization',
      },
    },
    update: {},
    create: {
      planId: starterPlan.id,
      featureKey: 'branding_customization',
      enabled: true,
      displayName: 'Basic branding (logo, colors)',
    },
  });

  // Professional additional features
  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: professionalPlan.id,
        featureKey: 'crm_integration',
      },
    },
    update: {},
    create: {
      planId: professionalPlan.id,
      featureKey: 'crm_integration',
      enabled: true,
      displayName: 'CRM integrations (Salesforce, HubSpot)',
      featureValue: { providers: ['salesforce', 'hubspot'] },
    },
  });

  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: professionalPlan.id,
        featureKey: 'slack_notifications',
      },
    },
    update: {},
    create: {
      planId: professionalPlan.id,
      featureKey: 'slack_notifications',
      enabled: true,
      displayName: 'Slack/Teams notifications',
    },
  });

  // Enterprise additional features
  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: enterprisePlan.id,
        featureKey: 'sso_authentication',
      },
    },
    update: {},
    create: {
      planId: enterprisePlan.id,
      featureKey: 'sso_authentication',
      enabled: true,
      displayName: 'SSO/SAML authentication',
    },
  });

  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: enterprisePlan.id,
        featureKey: 'custom_ai_training',
      },
    },
    update: {},
    create: {
      planId: enterprisePlan.id,
      featureKey: 'custom_ai_training',
      enabled: true,
      displayName: 'Custom AI model training',
    },
  });

  await prisma.planAdditionalFeature.upsert({
    where: {
      planId_featureKey: {
        planId: enterprisePlan.id,
        featureKey: 'white_label',
      },
    },
    update: {},
    create: {
      planId: enterprisePlan.id,
      featureKey: 'white_label',
      enabled: true,
      displayName: 'Complete white-label deployment',
    },
  });

  console.log('  ✓ Additional features configured');

  // ═══════════════════════════════════════════════════════════════
  // 5. Create Admin User
  // ═══════════════════════════════════════════════════════════════

  console.log('👤 Creating admin user...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@halisoft.com';
  const adminPassword =
    process.env.ADMIN_INITIAL_PASSWORD || 'change_me_on_first_login';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`  ✓ Admin user created: ${adminEmail}`);
  console.log(`  ⚠️  Initial password: ${adminPassword}`);

  console.log('\n✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
