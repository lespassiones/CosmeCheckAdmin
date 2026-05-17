# CosmetWiki Admin

Dashboard d'administration de [CosmetWiki](https://www.cosme-check.com). Connecté à la même base Supabase (`rogesnduejmqpxolhbif`) que l'app prod, avec accès **service_role** côté serveur uniquement.

> ⚠️ Cette app NE doit JAMAIS être exposée publiquement sans auth.
> Le middleware refuse toute requête dont l'email n'est pas dans `ADMIN_EMAILS`.

---

## Stack

- **Next.js 15** (App Router, Server Components, Server Actions)
- **TypeScript strict**
- **Tailwind 3** + design system maison light-mode (neomorphisme + glass + pill)
- **Supabase JS + SSR** (auth via cookies, queries via service_role)
- **Recharts** pour les graphes
- **Sonner** pour les toasts
- **Lucide React** pour les icônes
- **Zod** pour la validation

---

## Quickstart local

```bash
# 1. Installer les dépendances
npm install

# 2. Le .env est déjà rempli avec les clés Supabase prod
# (vérifier ADMIN_EMAILS au besoin)

# 3. Lancer en dev sur le port 3001 (l'app prod tourne sur 3000)
npm run dev -- -p 3001
```

Puis ouvrir [http://localhost:3001](http://localhost:3001).

**Première visite** : tu seras redirigé vers `/auth/sign-up` (parce qu'aucun compte admin n'existe encore). Le seul email autorisé est `brianbiendou@gmail.com` (ou ce que tu mets dans `ADMIN_EMAILS`).

Une fois inscrit, plus aucune autre inscription n'est possible. Pour ajouter un 2e admin, ajoute son email à `ADMIN_EMAILS` puis fais-le passer par `/auth/sign-up` AVANT que `hasAdmin()` ne le bloque (ou supprime le compte existant d'abord).

---

## Variables d'env

```bash
NEXT_PUBLIC_SUPABASE_URL=https://rogesnduejmqpxolhbif.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...           # SERVER ONLY — god mode
ADMIN_EMAILS=brianbiendou@gmail.com     # comma-separated allowlist
NEXT_PUBLIC_SITE_URL=https://admin.cosme-check.com  # ou http://localhost:3001 en dev

# Optionnel : URL de l'app prod pour /system → HealthPing
NEXT_PUBLIC_COSMECHECK_URL=https://www.cosme-check.com
```

---

## Onglets du dashboard

| Onglet | Route | Contenu |
|---|---|---|
| Vue d'ensemble | `/` | 8 KPIs + 3 charts 30j + breakdown coûts IA |
| Utilisateurs | `/users` | Liste + recherche + détail user avec ajustement crédits/suspension/delete |
| Activité | `/activity` | Analyses récentes cross-user, top marques/produits/catégories, verdicts cohérence |
| Coûts IA & Cache | `/ai` | Coûts par feature/provider, latence p50/p95, purge des caches |
| Catalogue | `/catalog/products` (+ `/ingredients`, `/daily-picks`) | Gestion produits, ingrédients, daily picks |
| Sécurité | `/security` | Erreurs runtime, IPs rate-limitées, audit admin |
| Système | `/system` | Health check live, cron jobs, migrations, tailles tables |
| Abonnements | `/billing` | Placeholder Stripe (à connecter plus tard) |

---

## Structure du projet

```
app/
├── auth/{sign-in,sign-up}/   ← login + signup admin
├── (dashboard)/              ← toutes les pages protégées par requireAdmin()
│   ├── layout.tsx            ← Sidebar + MobileNav
│   ├── page.tsx              ← Vue d'ensemble
│   ├── users/                ← liste + détail + actions
│   ├── activity/
│   ├── ai/
│   ├── catalog/{products,ingredients,daily-picks}/
│   ├── security/
│   ├── system/
│   └── billing/
└── globals.css               ← design system (neo, glass, pill)

components/                   ← Sidebar, StatCard, PageHeader, charts, …
lib/
├── supabase.ts               ← supabaseAdmin (service_role, server-only)
├── authGuard.ts              ← requireAdmin, hasAdmin
├── audit.ts                  ← logAudit() → admin_audit_log
├── utils.ts                  ← formatInt, formatUSD, formatRelative, cn
└── queries/                  ← 1 fichier server-only par page

middleware.ts                 ← gate toutes les routes hors /auth/*
supabase/migrations/0009_*.sql  ← RPCs admin (déjà appliqués)
```

---

## Sécurité

- **1 seul admin** : `ADMIN_EMAILS` est une allowlist stricte enforced par middleware
- **Pas de confirmation email** : `adminSignUp()` utilise l'Admin API avec `email_confirm: true`
- **Service role server-only** : `import "server-only"` dans `lib/supabase.ts` bloque toute fuite
- **Audit log** : chaque write destructive enregistrée dans `cosme_check.admin_audit_log`
- **`noindex` partout** : header global `X-Robots-Tag: noindex, nofollow`
- **CSP-ready** : Next 15 headers stricts dans `next.config.ts`

---

## Migrations Supabase

Déjà appliquées sur le projet `rogesnduejmqpxolhbif` :

| Migration | Contenu | Repo où elle vit |
|---|---|---|
| `0008_admin_dashboard...` | Table `admin_audit_log` + colonne `suspended_at` + RPCs ajustement crédits | `CosmetWiki/supabase/migrations/` (app principale) |
| `0009_admin_system_helpers` | RPCs `cosme_check_admin_get_cron_jobs` + `_table_stats` | `CosmeCheckAdmin/supabase/migrations/` (ce repo) |

Si tu déploies sur un nouveau projet Supabase, applique-les via Studio → SQL editor.

---

## Déployer sur Vercel

### 1. Créer le repo GitHub et push

```bash
cd d:/MesApps/deploy/CosmeCheckAdmin
git add .
git commit -m "feat: initial CosmetWiki admin dashboard"
git remote add origin git@github.com:<your-user>/cosmecheck-admin.git
git branch -M main
git push -u origin main
```

### 2. Importer dans Vercel

1. Vercel Dashboard → **Add New… → Project** → import du repo
2. Framework: **Next.js** (auto-détecté)
3. **Environment Variables** — copier-coller :

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rogesnduejmqpxolhbif.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(ton anon key)_ |
| `SUPABASE_SERVICE_ROLE_KEY` | _(ton service_role key)_ |
| `ADMIN_EMAILS` | `brianbiendou@gmail.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://<ton-projet>.vercel.app` |
| `NEXT_PUBLIC_COSMECHECK_URL` | `https://www.cosme-check.com` |

4. **Deploy**

### 3. (Optionnel) Domaine custom

- Vercel → ton projet → **Domains** → ajoute `admin.cosme-check.com`
- DNS : CNAME `admin` → `cname.vercel-dns.com`
- Mets à jour `NEXT_PUBLIC_SITE_URL` avec le nouveau domaine

---

## Tests éphémères suggérés après deploy

1. **Health check de la prod** — `/system` doit afficher l'état UP de cosme-check.com (rebond toutes les 10s)
2. **Adjust credits sur un user test** — `/users/[id]` → "Appliquer 500" → vérifie en SQL : `SELECT used, daily_limit FROM cosme_check.user_credits WHERE user_id = ? AND day = CURRENT_DATE`
3. **Audit log** — après l'ajustement ci-dessus : `SELECT * FROM cosme_check.admin_audit_log ORDER BY created_at DESC LIMIT 1`
4. **Cache purge** — `/ai` → purge `ai_cache` (avec confirmation PURGE) → confirmer count = 0
5. **Stats live** — `/` affiche bien le nombre de users, analyses, coûts cumulés du jour

---

## Roadmap (non-bloquant)

- [ ] Supabase Realtime sur Activity/Security (polling 30s suffit pour le moment)
- [ ] Stripe integration sur `/billing`
- [ ] Bouton "Impersonate user" pour debug
- [ ] Export CSV des analyses depuis `/activity`
- [ ] Faire lire `suspended_at` par `apiGate` côté CosmetWiki main app (la suspension est setté mais pas encore enforcée côté API)
- [ ] Génération AI batch des `ingredient_explanations` manquantes

---

## License

Privé — propriété de Brian Biendou. Pas de redistribution.
