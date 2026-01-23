#!/bin/bash

# ==========================================
# Script d'Intégration HaliSoft
# Copie HaliSoft dans votre projet existant
# ==========================================

set -e  # Arrêter si erreur

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Chemin du projet cible (À MODIFIER)
TARGET_PROJECT="/Users/loicl/Documents/Documents - loic MAc  air/cursor/trade-partner-info-app-v2/component"

# Chemin du code source HaliSoft
HALISOFT_SOURCE="/sessions/sharp-focused-planck/mnt/outputs/halisoft-subscription-system"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Intégration HaliSoft dans votre projet${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Vérifier que le projet cible existe
if [ ! -d "$TARGET_PROJECT" ]; then
  echo -e "${RED}❌ Erreur: Le projet cible n'existe pas: $TARGET_PROJECT${NC}"
  exit 1
fi

echo -e "${YELLOW}📁 Projet cible: $TARGET_PROJECT${NC}"
echo ""

# Confirmation
read -p "Voulez-vous continuer l'intégration ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ Intégration annulée${NC}"
  exit 1
fi

# ==========================================
# 1. CRÉER UN BACKUP
# ==========================================
echo ""
echo -e "${YELLOW}📦 Étape 1/8: Création d'un backup de sécurité...${NC}"

BACKUP_DIR="$TARGET_PROJECT/../backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup des fichiers critiques
if [ -f "$TARGET_PROJECT/package.json" ]; then
  cp "$TARGET_PROJECT/package.json" "$BACKUP_DIR/package.json.backup"
fi
if [ -f "$TARGET_PROJECT/prisma/schema.prisma" ]; then
  mkdir -p "$BACKUP_DIR/prisma"
  cp "$TARGET_PROJECT/prisma/schema.prisma" "$BACKUP_DIR/prisma/schema.prisma.backup"
fi
if [ -f "$TARGET_PROJECT/.env" ]; then
  cp "$TARGET_PROJECT/.env" "$BACKUP_DIR/.env.backup"
fi

echo -e "${GREEN}✅ Backup créé dans: $BACKUP_DIR${NC}"

# ==========================================
# 2. COPIER LES FICHIERS SOURCES
# ==========================================
echo ""
echo -e "${YELLOW}📂 Étape 2/8: Copie des fichiers sources HaliSoft...${NC}"

# Créer le dossier src s'il n'existe pas
mkdir -p "$TARGET_PROJECT/src"

# Copier les services
if [ -d "$HALISOFT_SOURCE/src/services" ]; then
  cp -r "$HALISOFT_SOURCE/src/services" "$TARGET_PROJECT/src/subscription-services"
  echo -e "${GREEN}✅ Services copiés → src/subscription-services/${NC}"
fi

# Copier les middleware
if [ -d "$HALISOFT_SOURCE/src/middleware" ]; then
  cp -r "$HALISOFT_SOURCE/src/middleware" "$TARGET_PROJECT/src/subscription-middleware"
  echo -e "${GREEN}✅ Middleware copiés → src/subscription-middleware/${NC}"
fi

# Copier les routes
if [ -d "$HALISOFT_SOURCE/src/routes" ]; then
  cp -r "$HALISOFT_SOURCE/src/routes" "$TARGET_PROJECT/src/subscription-routes"
  echo -e "${GREEN}✅ Routes copiées → src/subscription-routes/${NC}"
fi

# Copier les cron jobs
if [ -d "$HALISOFT_SOURCE/src/cron" ]; then
  cp -r "$HALISOFT_SOURCE/src/cron" "$TARGET_PROJECT/src/subscription-cron"
  echo -e "${GREEN}✅ Cron jobs copiés → src/subscription-cron/${NC}"
fi

# Copier les utils
if [ -d "$HALISOFT_SOURCE/src/utils" ]; then
  cp -r "$HALISOFT_SOURCE/src/utils" "$TARGET_PROJECT/src/subscription-utils"
  echo -e "${GREEN}✅ Utils copiés → src/subscription-utils/${NC}"
fi

# Copier les composants frontend
if [ -d "$HALISOFT_SOURCE/frontend" ]; then
  cp -r "$HALISOFT_SOURCE/frontend" "$TARGET_PROJECT/src/subscription-frontend"
  echo -e "${GREEN}✅ Frontend copiés → src/subscription-frontend/${NC}"
fi

# ==========================================
# 3. COPIER LE SEED PRISMA
# ==========================================
echo ""
echo -e "${YELLOW}🌱 Étape 3/8: Copie du seed Prisma...${NC}"

mkdir -p "$TARGET_PROJECT/prisma"

if [ -f "$HALISOFT_SOURCE/prisma/seed.ts" ]; then
  cp "$HALISOFT_SOURCE/prisma/seed.ts" "$TARGET_PROJECT/prisma/seed-halisoft.ts"
  echo -e "${GREEN}✅ Seed copié → prisma/seed-halisoft.ts${NC}"
  echo -e "${YELLOW}⚠️  Vous devrez fusionner ce fichier avec votre seed existant si nécessaire${NC}"
fi

# ==========================================
# 4. CRÉER LE FICHIER DE SCHÉMA ADDITIONNEL
# ==========================================
echo ""
echo -e "${YELLOW}🗄️  Étape 4/8: Création du schéma Prisma additionnel...${NC}"

cat > "$TARGET_PROJECT/prisma/schema-halisoft-models.prisma" << 'EOF'
// ==========================================
// MODÈLES HALISOFT SUBSCRIPTION SYSTEM
// À copier dans votre prisma/schema.prisma
// ==========================================

model SubscriptionPlan {
  id                String            @id @default(uuid())
  name              String
  slug              String            @unique
  description       String?
  basePrice         Decimal?          @db.Decimal(10, 2)
  billingPeriod     String            @default("monthly")
  isCustomPricing   Boolean           @default(false)
  paypalPlanId      String?
  features          PlanFeature[]
  subscriptions     Subscription[]
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@map("subscription_plans")
}

model AIComponent {
  id              String         @id @default(uuid())
  name            String
  slug            String         @unique
  description     String?
  category        String
  baseTokenCost   Int?
  planFeatures    PlanFeature[]
  usageTracking   UsageTracking[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@map("ai_components")
}

model PlanFeature {
  id            String           @id @default(uuid())
  planId        String
  aiComponentId String
  enabled       Boolean          @default(true)
  limitValue    Int?
  limitType     String           @default("count")
  plan          SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  aiComponent   AIComponent      @relation(fields: [aiComponentId], references: [id], onDelete: Cascade)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@unique([planId, aiComponentId])
  @@map("plan_features")
}

model Subscription {
  id                    String            @id @default(uuid())
  userId                String
  planId                String
  status                String            @default("PENDING")
  paypalSubscriptionId  String?           @unique
  currentPeriodStart    DateTime          @default(now())
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean           @default(false)
  plan                  SubscriptionPlan  @relation(fields: [planId], references: [id])
  usageTracking         UsageTracking[]
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([userId, status])
  @@map("subscriptions")
}

model UsageTracking {
  id              String       @id @default(uuid())
  subscriptionId  String
  aiComponentId   String
  value           Int          @default(0)
  periodStart     DateTime
  periodEnd       DateTime
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  aiComponent     AIComponent  @relation(fields: [aiComponentId], references: [id])
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([subscriptionId, aiComponentId, periodStart])
  @@index([subscriptionId, periodStart])
  @@map("usage_tracking")
}

model AuditLog {
  id          String   @id @default(uuid())
  userId      String
  action      String
  entityType  String
  entityId    String?
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@map("audit_logs")
}

model Tenant {
  id              String   @id @default(uuid())
  name            String
  slug            String   @unique
  customDomain    String?
  brandingConfig  Json?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("tenants")
}

model PayPalEvent {
  id              String   @id @default(uuid())
  eventType       String
  eventId         String   @unique
  resourceId      String?
  payload         Json
  processed       Boolean  @default(false)
  processedAt     DateTime?
  error           String?
  createdAt       DateTime @default(now())

  @@index([eventType, processed])
  @@map("paypal_events")
}
EOF

echo -e "${GREEN}✅ Schéma créé → prisma/schema-halisoft-models.prisma${NC}"
echo -e "${YELLOW}⚠️  Vous devrez copier ces modèles dans votre prisma/schema.prisma${NC}"

# ==========================================
# 5. CRÉER LE FICHIER .env.halisoft
# ==========================================
echo ""
echo -e "${YELLOW}🔐 Étape 5/8: Création du fichier .env.halisoft...${NC}"

cat > "$TARGET_PROJECT/.env.halisoft" << 'EOF'
# ==========================================
# VARIABLES HALISOFT À AJOUTER À VOTRE .env
# ==========================================

# PayPal Configuration
PAYPAL_MODE=sandbox
PAYPAL_API_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=votre_client_id_ici
PAYPAL_CLIENT_SECRET=votre_secret_ici
PAYPAL_PRODUCT_ID=
PAYPAL_WEBHOOK_ID=WH-xxxxx

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# JWT (si vous n'en avez pas déjà)
JWT_SECRET=your_jwt_secret_here

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASSWORD=votre_password
SMTP_FROM=noreply@halisoft.com

# Application URLs
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
EOF

echo -e "${GREEN}✅ Variables créées → .env.halisoft${NC}"
echo -e "${YELLOW}⚠️  Copiez ces variables dans votre .env existant${NC}"

# ==========================================
# 6. CRÉER package-halisoft-dependencies.json
# ==========================================
echo ""
echo -e "${YELLOW}📦 Étape 6/8: Création de la liste des dépendances...${NC}"

cat > "$TARGET_PROJECT/package-halisoft-dependencies.json" << 'EOF'
{
  "dependencies_to_add": {
    "@anthropic-ai/sdk": "^0.9.1",
    "@prisma/client": "^5.7.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "nodemailer": "^6.9.7",
    "node-cron": "^3.0.3",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0"
  },
  "devDependencies_to_add": {
    "prisma": "^5.7.0",
    "@types/node": "^20.10.5",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/nodemailer": "^6.4.14",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2"
  },
  "scripts_to_add": {
    "sync-paypal": "ts-node src/subscription-services/scripts/sync-paypal.ts",
    "cron:quotas": "ts-node src/subscription-cron/reset-monthly-quotas.ts",
    "cron:warnings": "ts-node src/subscription-cron/quota-warnings.ts",
    "prisma:generate": "npx prisma generate",
    "prisma:migrate": "npx prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed-halisoft.ts"
  },
  "prisma_config": {
    "seed": "ts-node prisma/seed-halisoft.ts"
  }
}
EOF

echo -e "${GREEN}✅ Dépendances listées → package-halisoft-dependencies.json${NC}"
echo -e "${YELLOW}⚠️  Ajoutez ces dépendances manuellement à votre package.json${NC}"

# ==========================================
# 7. CRÉER LE GUIDE D'INTÉGRATION
# ==========================================
echo ""
echo -e "${YELLOW}📖 Étape 7/8: Création du guide d'intégration...${NC}"

cat > "$TARGET_PROJECT/INTEGRATION-HALISOFT.md" << 'EOF'
# Guide d'Intégration HaliSoft

Ce fichier a été généré automatiquement par le script d'intégration.

## ✅ Ce qui a été fait automatiquement

- [x] Copie des fichiers sources HaliSoft
- [x] Création du backup de sécurité
- [x] Création des fichiers de configuration

## ⏳ Ce que VOUS devez faire maintenant

### 1. Fusionner package.json

Ouvrez `package-halisoft-dependencies.json` et ajoutez les dépendances à votre `package.json` :

```bash
# Ouvrez les deux fichiers côte à côte
code package.json package-halisoft-dependencies.json
```

Ajoutez manuellement les dépendances, devDependencies et scripts.

Puis installez :
```bash
npm install
```

### 2. Fusionner prisma/schema.prisma

Ouvrez `prisma/schema-halisoft-models.prisma` et copiez les modèles dans votre `prisma/schema.prisma` :

```bash
code prisma/schema.prisma prisma/schema-halisoft-models.prisma
```

**Important** : Copiez les modèles à la FIN de votre schema.prisma existant.

### 3. Fusionner .env

Ouvrez `.env.halisoft` et copiez les variables dans votre `.env` :

```bash
code .env .env.halisoft
```

Remplissez les valeurs (PayPal, Anthropic, SMTP).

### 4. Créer la migration de base de données

```bash
npx prisma generate
npx prisma migrate dev --name add_halisoft_subscription_system
```

### 5. Insérer les données initiales

```bash
npm run prisma:seed
# ou
ts-node prisma/seed-halisoft.ts
```

### 6. Enregistrer les routes dans votre serveur

Ouvrez votre fichier principal (ex: `src/index.ts` ou `src/app.ts`) :

```typescript
// Ajoutez ces imports
import subscriptionRoutes from './subscription-routes/subscriptions';
import adminRoutes from './subscription-routes/admin';
import webhookRoutes from './subscription-routes/webhooks';
import aiComponentRoutes from './subscription-routes/ai-components';

// Ajoutez ces routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/ai', aiComponentRoutes);
```

### 7. Protéger vos routes existantes avec les quotas

Dans vos routes où vous utilisez l'API Claude :

```typescript
import { enforceQuota } from './subscription-middleware/quotaEnforcement';

// Ajoutez le middleware
router.post('/votre-route',
  authenticateUser,              // Votre auth existante
  enforceQuota('invoice_ocr'),   // ← Nouveau
  async (req, res) => {
    // Votre code existant
  }
);
```

### 8. Configurer PayPal

1. Créez une app PayPal (Merchant)
2. Copiez Client ID et Secret dans `.env`
3. Créez un webhook : `https://votre-url.com/webhooks/paypal`
4. Copiez Webhook ID dans `.env`
5. Exécutez : `npm run sync-paypal`

### 9. Tester

```bash
# Démarrer le serveur
npm run dev

# Tester health check
curl http://localhost:3001/health

# Tester les plans
curl http://localhost:3001/api/public/plans
```

## 📁 Structure ajoutée

```
votre-projet/
├── src/
│   ├── subscription-services/     ← Services HaliSoft
│   ├── subscription-middleware/   ← Middleware quotas
│   ├── subscription-routes/       ← Routes API
│   ├── subscription-cron/         ← Cron jobs
│   ├── subscription-utils/        ← Utilitaires
│   └── subscription-frontend/     ← Composants React
├── prisma/
│   ├── schema-halisoft-models.prisma  ← Modèles à copier
│   └── seed-halisoft.ts               ← Seed HaliSoft
├── .env.halisoft                      ← Variables à copier
├── package-halisoft-dependencies.json ← Dépendances à ajouter
└── INTEGRATION-HALISOFT.md           ← Ce fichier
```

## 🆘 Besoin d'aide ?

Consultez la documentation complète :
- README.md
- QUICK_START.md
- ARCHITECTURE.md
- RENDER_DEPLOYMENT.md

## 📧 Support

support@halisoft.com
EOF

echo -e "${GREEN}✅ Guide créé → INTEGRATION-HALISOFT.md${NC}"

# ==========================================
# 8. COPIER LA DOCUMENTATION
# ==========================================
echo ""
echo -e "${YELLOW}📚 Étape 8/8: Copie de la documentation...${NC}"

mkdir -p "$TARGET_PROJECT/docs-halisoft"

# Copier tous les fichiers de documentation
for doc in README.md QUICK_START.md ARCHITECTURE.md PROJECT_STRUCTURE.md DEPLOYMENT_CHECKLIST.md RENDER_DEPLOYMENT.md INDEX.md PROJECT_SUMMARY.md; do
  if [ -f "$HALISOFT_SOURCE/$doc" ]; then
    cp "$HALISOFT_SOURCE/$doc" "$TARGET_PROJECT/docs-halisoft/"
    echo -e "${GREEN}✅ $doc copié${NC}"
  fi
done

# ==========================================
# RÉSUMÉ FINAL
# ==========================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ INTÉGRATION TERMINÉE !${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}📁 Fichiers copiés dans:${NC}"
echo "   $TARGET_PROJECT"
echo ""
echo -e "${YELLOW}📦 Backup sauvegardé dans:${NC}"
echo "   $BACKUP_DIR"
echo ""
echo -e "${YELLOW}📖 PROCHAINES ÉTAPES (IMPORTANT):${NC}"
echo ""
echo "1. Ouvrez le guide d'intégration:"
echo "   ${GREEN}code $TARGET_PROJECT/INTEGRATION-HALISOFT.md${NC}"
echo ""
echo "2. Fusionnez package.json (ajoutez les dépendances)"
echo "3. Fusionnez prisma/schema.prisma (ajoutez les modèles)"
echo "4. Fusionnez .env (ajoutez les variables)"
echo "5. Exécutez: npm install"
echo "6. Exécutez: npx prisma migrate dev --name add_halisoft"
echo "7. Exécutez: npm run prisma:seed"
echo "8. Enregistrez les routes HaliSoft dans votre serveur"
echo ""
echo -e "${GREEN}🎉 HaliSoft est prêt à être intégré !${NC}"
echo ""
