# HaliSoft - Guide de Déploiement sur Render

Guide complet pour déployer HaliSoft sur Render.com.

---

## Pourquoi Render ?

✅ **Avantages** :
- Déploiement automatique depuis Git (GitHub, GitLab)
- PostgreSQL géré inclus
- SSL automatique (HTTPS gratuit)
- Logs en temps réel
- Support des cron jobs
- Plan gratuit disponible pour commencer

---

## Prérequis

Avant de commencer :

- [ ] Compte Render.com créé
- [ ] Code HaliSoft sur GitHub/GitLab
- [ ] Compte PayPal Developer configuré
- [ ] API Key Anthropic Claude
- [ ] Compte email SMTP (Gmail, SendGrid, etc.)

---

## Étape 1 : Créer le Repository Git

Si ce n'est pas déjà fait :

```bash
cd /sessions/sharp-focused-planck/mnt/outputs/halisoft-subscription-system

# Initialiser Git
git init
git add .
git commit -m "Initial commit - HaliSoft subscription system"

# Créer un repo sur GitHub et pusher
git remote add origin https://github.com/votre-username/halisoft.git
git branch -M main
git push -u origin main
```

---

## Étape 2 : Déployer sur Render via l'Interface Web

### Option A : Déploiement avec render.yaml (Recommandé)

1. **Connectez votre Repository** :
   - Allez sur https://dashboard.render.com
   - Cliquez **"New +"** → **"Blueprint"**
   - Connectez votre GitHub/GitLab
   - Sélectionnez le repository `halisoft`
   - Render détectera automatiquement `render.yaml`

2. **Render va créer automatiquement** :
   - Service Web (API)
   - Base de données PostgreSQL
   - Cron jobs (si plan Pro)

3. **Configurez les Variables d'Environnement Secrètes** :

   Dans le Render Dashboard, allez dans votre service → **Environment** → Ajoutez :

   ```env
   PAYPAL_CLIENT_ID=votre_client_id_sandbox
   PAYPAL_CLIENT_SECRET=votre_secret_sandbox
   PAYPAL_WEBHOOK_ID=WH-xxxxxxxxxxxxx
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
   SMTP_USER=votre.email@gmail.com
   SMTP_PASSWORD=votre_mot_de_passe_app
   ```

   **⚠️ IMPORTANT** : Ne mettez PAS ces valeurs dans `render.yaml` (risque de commit public).

4. **Cliquez "Apply"** → Render déploie automatiquement !

### Option B : Déploiement Manuel (Sans Blueprint)

Si vous préférez créer manuellement :

#### 2.1 Créer la Base de Données PostgreSQL

1. Dashboard Render → **"New +"** → **"PostgreSQL"**
2. Remplissez :
   - **Name** : `halisoft-db`
   - **Database** : `halisoft`
   - **User** : `halisoft_user`
   - **Region** : Choisissez la plus proche (Frankfurt, Oregon)
   - **Plan** : Starter (gratuit) ou Standard (production)
3. Cliquez **"Create Database"**
4. **Copiez l'URL de connexion** : `postgresql://...` (vous en aurez besoin)

#### 2.2 Créer le Service Web

1. Dashboard Render → **"New +"** → **"Web Service"**
2. Connectez votre GitHub/GitLab
3. Sélectionnez le repository `halisoft`
4. Remplissez :
   - **Name** : `halisoft-api`
   - **Region** : Même que la database (Frankfurt)
   - **Branch** : `main`
   - **Runtime** : Node
   - **Build Command** :
     ```bash
     npm install && npm run build && npx prisma generate
     ```
   - **Start Command** :
     ```bash
     npm start
     ```
   - **Plan** : Starter (gratuit) ou Standard (production)

5. **Variables d'Environnement** :

   Cliquez **"Advanced"** → **"Add Environment Variable"** :

   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<URL_COPIÉE_DEPUIS_POSTGRESQL>
   JWT_SECRET=<généré_automatiquement_ou_utilisez_openssl>

   PAYPAL_MODE=sandbox
   PAYPAL_API_URL=https://api-m.sandbox.paypal.com
   PAYPAL_CLIENT_ID=votre_client_id
   PAYPAL_CLIENT_SECRET=votre_secret
   PAYPAL_PRODUCT_ID=
   PAYPAL_WEBHOOK_ID=WH-xxxxx

   ANTHROPIC_API_KEY=sk-ant-xxxxx

   APP_URL=https://halisoft-api.onrender.com
   FRONTEND_URL=https://halisoft.onrender.com

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=votre.email@gmail.com
   SMTP_PASSWORD=votre_password
   SMTP_FROM=noreply@halisoft.com
   ```

6. Cliquez **"Create Web Service"**

---

## Étape 3 : Exécuter les Migrations et Seed

Une fois le service déployé :

### Via Render Shell

1. Dashboard → Votre service `halisoft-api` → **"Shell"**
2. Exécutez :

```bash
# Générer le client Prisma
npx prisma generate

# Créer les tables
npx prisma migrate deploy

# Insérer les données initiales
npm run prisma:seed

# Créer le produit PayPal et les plans
npm run sync-paypal
```

### Via Render SSH (Alternative)

Si le Shell ne fonctionne pas, vous pouvez vous connecter en SSH :

```bash
# Depuis votre terminal local
render ssh halisoft-api

# Puis exécutez les mêmes commandes
npx prisma migrate deploy
npm run prisma:seed
npm run sync-paypal
```

---

## Étape 4 : Configurer le Webhook PayPal

Maintenant que votre API est déployée, mettez à jour le webhook :

1. **Copiez votre URL Render** :
   - Dans le Dashboard : `https://halisoft-api.onrender.com`

2. **Allez dans PayPal Developer Dashboard** :
   - Votre App → **"Webhooks"**
   - Cliquez sur votre webhook existant → **"Edit"**
   - **Webhook URL** : `https://halisoft-api.onrender.com/webhooks/paypal`
   - Cliquez **"Save"**

3. **Testez le Webhook** :
   - Dans PayPal, cliquez **"Webhooks"** → Votre webhook → **"Simulate"**
   - Sélectionnez `BILLING.SUBSCRIPTION.ACTIVATED`
   - Cliquez **"Send Test"**
   - Vérifiez dans les logs Render que l'événement est reçu

---

## Étape 5 : Configurer les Cron Jobs

### Option A : Render Cron Jobs (Plan Pro requis - $7/mois)

Si vous êtes sur le plan Pro, les cron jobs définis dans `render.yaml` sont automatiquement créés.

### Option B : Service Externe (Plan Gratuit)

Si vous utilisez le plan gratuit, utilisez un service externe :

#### Avec cron-job.org (Gratuit)

1. Allez sur https://cron-job.org
2. Créez un compte
3. Ajoutez 2 jobs :

**Job 1 : Reset Quotas (Quotidien à minuit)**
```
Title: HaliSoft Reset Quotas
URL: https://halisoft-api.onrender.com/cron/reset-quotas
Schedule: 0 0 * * * (tous les jours à 00:00 UTC)
```

**Job 2 : Quota Warnings (Toutes les 6h)**
```
Title: HaliSoft Quota Warnings
URL: https://halisoft-api.onrender.com/cron/quota-warnings
Schedule: 0 */6 * * * (toutes les 6 heures)
```

#### Sécuriser les Endpoints Cron

Ajoutez un token secret dans vos routes cron :

```typescript
// src/routes/cron.ts
router.get('/cron/reset-quotas', (req, res) => {
  const token = req.headers['x-cron-token'];

  if (token !== process.env.CRON_SECRET_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Exécuter le cron job
  resetMonthlyQuotas();
  res.json({ success: true });
});
```

Ajoutez `CRON_SECRET_TOKEN` dans Render → Environment.

Dans cron-job.org, ajoutez le header :
```
X-Cron-Token: votre_token_secret
```

---

## Étape 6 : Vérifier le Déploiement

### 6.1 Health Check

```bash
curl https://halisoft-api.onrender.com/health
```

**Réponse attendue** :
```json
{
  "status": "healthy",
  "timestamp": "2024-01-23T10:00:00Z",
  "uptime": 123,
  "environment": "production"
}
```

### 6.2 Vérifier les Plans

```bash
curl https://halisoft-api.onrender.com/api/public/plans
```

Vous devriez voir les 3 plans (Starter, Professional, Enterprise) avec leurs prix.

### 6.3 Test d'Authentification

```bash
# S'inscrire
curl -X POST https://halisoft-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Se connecter
curl -X POST https://halisoft-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 6.4 Vérifier les Logs

Dans le Render Dashboard :
- Votre service → **"Logs"**
- Vous devriez voir :
  ```
  ✓ Database connected
  ✓ Server running on port 3001
  ✓ Health check passed
  ```

---

## Étape 7 : Configurer un Domaine Personnalisé (Optionnel)

### 7.1 Ajouter le Domaine dans Render

1. Dashboard → Votre service → **"Settings"** → **"Custom Domain"**
2. Cliquez **"Add Custom Domain"**
3. Entrez : `api.halisoft.com`
4. Render vous donne une valeur CNAME

### 7.2 Configurer votre DNS

Chez votre registrar (Namecheap, GoDaddy, etc.) :

```
Type: CNAME
Name: api
Value: halisoft-api.onrender.com
TTL: 3600
```

### 7.3 Activer SSL (Automatique)

Render génère automatiquement un certificat SSL Let's Encrypt.

Attendez 5-10 minutes, puis testez :
```bash
curl https://api.halisoft.com/health
```

### 7.4 Mettre à Jour les Variables

Dans Render → Environment :
```env
APP_URL=https://api.halisoft.com
FRONTEND_URL=https://halisoft.com
```

**Important** : Mettez à jour l'URL du webhook PayPal !

---

## Monitoring et Maintenance

### Logs en Temps Réel

```bash
# Via Render CLI
npm install -g render-cli
render login
render logs -s halisoft-api --tail
```

### Métriques

Dashboard Render → Votre service → **"Metrics"** :
- CPU usage
- Memory usage
- Request count
- Response time

### Alertes (Plan Pro)

Configurez des alertes pour :
- Service down
- High error rate
- High memory usage

---

## Scaling

### Plan Gratuit (Starter)
- 512 MB RAM
- CPU partagé
- Le service s'arrête après 15 minutes d'inactivité
- **⚠️ Ne convient PAS pour la production !**

### Plan Standard ($7/mois)
- 2 GB RAM
- CPU dédié
- Pas d'arrêt automatique
- Recommandé pour production

### Auto-Scaling (Plan Pro+)
- Scale automatiquement selon le trafic
- Horizontal scaling (plusieurs instances)

---

## Troubleshooting

### Problème : Base de données non accessible

**Erreur** :
```
Error: Can't reach database server at `...`
```

**Solution** :
1. Vérifiez que `DATABASE_URL` est définie
2. Vérifiez que la base de données est dans la même région
3. Attendez 2-3 minutes (la DB peut prendre du temps à démarrer)

### Problème : Migrations échouent

**Erreur** :
```
Error: Migration failed
```

**Solution** :
```bash
# Via Render Shell
npx prisma migrate reset --force
npx prisma migrate deploy
npm run prisma:seed
```

### Problème : PayPal webhook ne fonctionne pas

**Vérifications** :
1. URL correcte dans PayPal : `https://votre-url.onrender.com/webhooks/paypal`
2. Webhook ID correct dans l'environnement
3. Vérifiez les logs Render pour voir si les requêtes arrivent

### Problème : Service s'arrête après 15 minutes

**Cause** : Plan gratuit Starter

**Solutions** :
1. Upgrade vers plan Standard ($7/mois)
2. Utilisez un service de ping (UptimeRobot) pour garder le service actif
3. Acceptez le comportement pour le développement

---

## Checklist de Déploiement

- [ ] Code pushé sur GitHub/GitLab
- [ ] Service web créé sur Render
- [ ] Base de données PostgreSQL créée
- [ ] Variables d'environnement configurées
- [ ] Migrations exécutées (`prisma migrate deploy`)
- [ ] Seed data inséré (`npm run prisma:seed`)
- [ ] Plans PayPal synchronisés (`npm run sync-paypal`)
- [ ] Webhook PayPal configuré avec URL Render
- [ ] Health check répond correctement
- [ ] API publique retourne les plans
- [ ] Cron jobs configurés (Render Pro ou cron-job.org)
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] Test de création d'abonnement
- [ ] Domaine personnalisé configuré (optionnel)
- [ ] SSL actif (automatique avec Render)

---

## Commandes Utiles

```bash
# Redéployer manuellement
# Dans Dashboard : "Manual Deploy" → "Clear build cache & deploy"

# Voir les logs
render logs -s halisoft-api --tail

# Exécuter une commande
render ssh halisoft-api
npx prisma studio  # Interface visuelle de la DB

# Rollback vers un déploiement précédent
# Dans Dashboard : Deployments → Sélectionner ancien → "Redeploy"
```

---

## Coûts Estimés

### Plan Gratuit (Développement)
- **Web Service** : Gratuit (512MB RAM, s'arrête après 15min)
- **PostgreSQL** : Gratuit (1GB storage)
- **Total** : $0/mois

### Plan Production (Recommandé)
- **Web Service Standard** : $7/mois (2GB RAM)
- **PostgreSQL Standard** : $7/mois (10GB storage)
- **Cron Jobs (Pro)** : $7/mois (optionnel, utilisez cron-job.org sinon)
- **Total** : $14-21/mois

---

## Support

- **Documentation Render** : https://render.com/docs
- **Status Page** : https://status.render.com
- **Community** : https://community.render.com

---

## Prochaines Étapes

Une fois déployé :

1. **Testez un abonnement complet** :
   - Créer un compte
   - S'abonner à un plan
   - Approuver dans PayPal Sandbox
   - Vérifier l'activation
   - Exécuter un composant AI
   - Vérifier le tracking de quota

2. **Configurez le monitoring** :
   - UptimeRobot pour health checks
   - Sentry pour error tracking
   - LogDNA/Papertrail pour logs centralisés

3. **Préparez la production** :
   - Passez à PayPal Live (`PAYPAL_MODE=live`)
   - Upgrade vers plan Standard
   - Configurez un domaine personnalisé
   - Activez les backups automatiques

---

**Félicitations ! HaliSoft est maintenant déployé sur Render !** 🚀

Pour toute question, consultez les logs ou contactez support@halisoft.com.
