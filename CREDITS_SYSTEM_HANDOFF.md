# Passation — Refonte système de crédits + admin (30 juin 2026)

> Préférences : jamais de tiret cadratin (—), ne JAMAIS rebuild l'APK mobile soi-même.
> Projet Supabase : `rogesnduejmqpxolhbif`. Les 3 apps partagent cette base.

## Les 3 apps
- **Admin** (Next 15, ce repo) : `D:\MesApps\deploy\CosmeCheckAdmin` → déployé sur `cosme-check-admin.vercel.app` (auto-deploy depuis `origin/main`).
- **Mobile** (Expo) : `d:\MesApps\deploy\CosmeCheck-App` (contient `supabase/migrations` + `supabase/functions`).
- **Web public** (Next 15) : `D:\MesApps\deploy\CosmetWiki` → `cosme-check.com` (Vercel).

---

## CE QUI A ÉTÉ FAIT (tout LIVE en prod, testé contre la base)

### 1. Cœur des crédits refondu (le système était dédoublé/incohérent)
Avant : deux `cosme_check_get_credits` (public + cosme_check), deux `admin_update_credit_tier`, RPC redondantes, et `consume_credit` qui vérifiait `user_credits.daily_limit` pendant que `get_credits` lisait les tiers → incohérent.

Maintenant, UNE chaîne canonique :
- Helpers (schéma `cosme_check`) : `credit_interval_days`, `credit_period_start`, `credit_config_for`, `credit_state`.
- **`public.cosme_check_get_credits()`** + **`public.cosme_check_consume_credit(feature)`** = drop-in (mobile + web les appellent déjà).
- **Vraies périodes** : daily/weekly/monthly/yearly/one_time (fenêtre alignée calendrier ; `used` = SUM sur la période, garde les lignes par jour pour les charts).
- **Crédits bonus ponctuels additifs** : table `cosme_check.credit_grants` (amount, remaining). `remaining = max(0, limit - used_période) + sum(grants)`. Consommation : période d'abord, puis bonus FIFO.
- Config effective = override actif → sinon tier → sinon free/5/daily.

Migrations (repo mobile `supabase/migrations/`) : `20260630_credits_canonical_core_v1.sql`, `20260630_credits_admin_rpcs_v1.sql`.

### 2. RPC admin — ⚠️ DANS LE SCHÉMA `public`, `service_role` UNIQUEMENT
**Piège majeur rencontré** : créées d'abord en `cosme_check` → l'admin appelle `sb.rpc()` qui résout en `public` → erreur "Could not find function public.cosme_check_admin_*" + fiches qui affichaient le repli 0/5. **Toute RPC appelée via `sb.rpc()` DOIT être en `public`.** Corrigé : migration `20260630_credits_admin_rpcs_to_public_v1.sql`. Révoquées de authenticated/anon (sinon un user pourrait s'auto-créditer), accordées à `service_role`.

RPC admin (toutes en `public` maintenant) :
`cosme_check_admin_grant_credits(user,amount,note,admin)` (négatif = revoke FIFO), `_set_override(user,amount,period)`, `_clear_override(user)`, `_set_tier(tier,amount,period)`, `_users_overview()`, `_user_credits(user)`, `_get_credit_tiers()`, `_get_app_config()`, `_set_app_config(jsonb)`.

### 3. Admin — fiche utilisateur (`/users/[id]`)
- Bloc "**Donner des crédits bonus**" (ponctuel) + "**Override de la limite**" (montant + période) + reset compteur jour. Fichiers : `app/(dashboard)/users/[id]/CreditsAdjuster.tsx`, `app/(dashboard)/users/actions.ts` (actions `grantBonusCredits`/`setUserOverride`/`clearUserOverride`).
- Routine "Sans titre" corrigée (coalesce `name`), **coût IA en $** ajouté, carte "Scans OCR" → "**Scans code-barres**". Fichier : `lib/queries/users.ts`.

### 4. Admin — liste users (`/users`)
- Colonne **Renouvellement** réelle (par jour/semaine/mois selon tier ou override) + badge bonus. Via `cosme_check_admin_users_overview`. Fichier : `app/(dashboard)/users/page.tsx`.

### 5. Admin — Gestion des crédits (`/settings/credits`)
3 onglets câblés : **Tiers** (édite Free/Premium), **Overrides utilisateurs** (bug `email` sur user_profiles corrigé → email via auth.users), **Journal d'audit** (unifié sur `cosme_check.admin_audit_log` filtré `credits.%`/`user.%`). Fichiers : `app/api/credits/{actions,users,audit}/route.ts`, `app/(dashboard)/settings/credits/*`.

### 6. Admin — Paramètres reconstruite (`/settings`)
Table `cosme_check.app_config` (singleton) + UI : tier par défaut (appliqué dans le trigger `handle_new_user`), inscriptions ouvertes/fermées (bloque dans le trigger si false), feature flags (deep_search/suggestions/advisor/public_share), seuils alertes coûts IA $, mode maintenance + message. Migration `20260630_app_config_v1.sql`. Fichiers : `app/(dashboard)/settings/{page.tsx,actions.ts,AppConfigForm.tsx}`. (L'ancien `CreditDefaultsForm.tsx` supprimé.)

### 7. Tracking scans code-barres
Table `cosme_check.scan_events` + RPC public `cosme_check_log_scan(kind,ean)`. L'Edge Function `product-by-barcode` (mobile) loggue chaque scan — **déployée en prod via CLI**. Activité + fiche user comptent `scan_events kind='barcode'`. Migration `20260630_scan_events_v1.sql`. Fichiers : `supabase/functions/product-by-barcode/index.ts` (mobile), `lib/queries/activity.ts` + `app/(dashboard)/activity/page.tsx` + `components/charts/ActivityTrendChart.tsx` (admin).

### 8. Nettoyage
9 RPC dupliquées droppées (`20260630_credits_cleanup_drop_redundant_v1.sql`). Conservées : public get_credits/consume_credit, `cosme_check_admin_reset_today`, `cosme_check_update_tier_with_credits` (webhook RevenueCat).

---

## VÉRIFIÉ
- Brian (`clarkybrian@outlook.fr`, override 100/jour) : état correct ; grant +10 → bonus 10 / remaining 15 ; drawdown base→bonus exact.
- `log_scan` : barcode comptabilisé, garde sur kind.
- Toutes les RPC admin répondent en `public` comme `service_role`.
- Admin `tsc` = 0 erreur. Web `tsc` = seulement 2 erreurs pré-existantes connues (`app/privacy/page.tsx`, `components/nav/AppShell.tsx`). Mobile : 397 tests jest passent ; erreurs tsc pré-existantes sans rapport (test d'intégration advisor + script local + fonctions Deno hors scope).

---

## RESTE À FAIRE / LIMITES (à reprendre dans la nouvelle discussion)
1. **Vérifier le rendu live de l'admin** : sur `cosme-check-admin.vercel.app`, faire `Ctrl+Shift+R` sur `/settings/credits` et `/users/[id]`. Si onglets toujours vides → vérifier que le déploiement Vercel du commit `1802375` est bien actif (sinon redéployer). Côté base + code tout est prêt/testé, mais je n'ai pas pu cliquer l'UI (pas de `.env.local` local).
2. **Enforcement des feature flags + maintenance DANS les apps** : l'infra existe (`public.cosme_check_get_app_config()` renvoie le subset flags/maintenance), mais les apps ne lisent pas encore ce réglage au runtime. À câbler : **web** (immédiat) et **mobile** (prochain build) pour que désactiver une feature la bloque vraiment. Le tier par défaut + le gel des inscriptions sont déjà appliqués côté base (trigger).
3. **Scans code-barres côté web** : non trackés (la route web `/api/product-by-barcode` n'a pas de session user). Seul le mobile loggue. À ajouter si besoin (lire la session dans la route web).
4. **Pille crédits mobile/web** : `remaining` inclut déjà le bonus (chiffre correct affiché), mais pas de badge "+N bonus" explicite (éviterait un rebuild APK). Optionnel.
5. **"Messages advisor"** dans l'admin compte en réalité `ai_logs feature='synthesis'` (165 pour Brian), pas le vrai feature 'advisor' (2 logs). Laissé tel quel volontairement (ne pas surprendre). À clarifier si voulu.

---

## Commandes utiles
- Admin : `cd D:\MesApps\deploy\CosmeCheckAdmin ; npx tsc --noEmit`
- Mobile : `cd d:\MesApps\deploy\CosmeCheck-App ; npx jest --config jest.config.js --no-coverage`
- Web : `cd D:\MesApps\deploy\CosmetWiki ; npx tsc --noEmit`
- Deploy edge function : `cd d:\MesApps\deploy\CosmeCheck-App ; npx supabase functions deploy <name> --project-ref rogesnduejmqpxolhbif --no-verify-jwt`
- Migrations : via Supabase MCP `apply_migration`. NE PAS rebuild l'APK.

## Mémoire associée (Claude)
`credits-canonical-system.md`, `web-suggestions-localstorage-cache.md`, `cosmecheck-admin-web-app.md`.
