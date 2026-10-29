# API de Loresmith (Worker Cloudflare)

Serveur du plan cloud (`docs/cloud/PLAN.md`, lot 4) : un Worker avec une base D1 et des comptes Better Auth.
Il ne fonctionne qu'en local pour l'instant : rien n'est déployé chez Cloudflare.
Le site, lancé avec `npm run dev`, s'y connecte tout seul (Réglages → Compte et synchronisation).

## Démarrer en local

```bash
cd server
npm install
cp .dev.vars.example .dev.vars   # puis y mettre un secret d'au moins 32 caractères
npm run db:migrate:local         # crée la base D1 locale (dossier .wrangler, ignoré par git)
npm run dev                      # API sur http://localhost:8787
```

## Routes

| Route | Rôle |
|---|---|
| `GET /api/health` | santé, sans compte |
| `/api/auth/*` | comptes Better Auth (ex. `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`) |
| `GET /api/me` | profil et rôles du compte connecté |
| `GET, POST /api/universes` | univers dont on est membre ; création (on en devient propriétaire) |
| `GET, PUT /api/universes/:id` | lecture ; mise à jour avec la version lue (`409` si elle a changé) |
| `GET, POST /api/universes/:id/campaigns` | campagnes de l'univers ; création (on en devient MJ) |
| `GET, PUT /api/campaigns/:id` | lecture ; mise à jour versionnée |
| `GET /api/sync?since=<ms>` | synchronisation : documents lisibles modifiés depuis le curseur, suppressions comprises |
| `PUT /api/docs/:type/:id` | création (`version: 0`) ou mise à jour versionnée de tout document du grimoire |
| `DELETE /api/docs/:type/:id?version=N` | suppression (le document est seulement marqué, l'historique est gardé) |
| `PUT, GET /api/images/:universeId/:id` | images partagées dans R2 ; l'identifiant est l'empreinte SHA-256 du contenu |
| `GET /api/universes/:id/members` | membres et rôles ; invitations en attente (propriétaire seulement) |
| `POST /api/universes/:id/invitations` | invitation par courriel (7 jours) ; renvoie le lien, et l'envoie par Resend si configuré |
| `DELETE /api/universes/:id/invitations/:invitationId` | annule une invitation |
| `GET /api/invitations/:token` | aperçu d'une invitation, sans compte |
| `POST /api/invitations/:token/accept` | accepte, avec un compte au courriel invité |
| `PUT, DELETE /api/universes/:id/members/:userId` | change le rôle d'un membre, le retire (ou le membre quitte) |
| `GET /api/campaigns/:id/members`, `PUT, DELETE /api/campaigns/:id/members/:userId` | co-MJ d'une campagne |

Sans session, toute route autre que la santé, l'authentification et l'aperçu d'une invitation répond `401`.

Courriels : sans `RESEND_API_KEY` (secret) et `MAIL_FROM`, aucun courriel ne part ; le lien d'invitation est montré à celui qui invite.
Les droits sont ceux de `src/shared/policy.js`. Chaque version écrite est gardée dans `document_versions`.

## Tests

`npm test` (ici, ou à la racine du projet) applique la migration sur une base D1 temporaire et teste l'API.

## Journaux

Une ligne JSON par requête (route, statut, durée, identifiant du compte), lisible dans Workers Logs.
Jamais de courriel, de contenu, de jeton ni de mot de passe. Niveau réglable avec `LOG_LEVEL` (`info`, `error`, `silent`).

## Sauvegardes

Chaque jour (cron `17 7 * * *`, vers 3 h à Montréal), le Worker copie la base dans R2 : `backups/d1-<date>.json.gz`.
Les `BACKUP_KEEP` plus récentes (30 par défaut) sont gardées. Les sessions et jetons éphémères n'y sont pas.

### Restaurer une sauvegarde

1. Télécharger la sauvegarde depuis R2 (tableau de bord Cloudflare, ou `npx wrangler r2 object get loresmith-images/backups/<fichier> --file <fichier>`).
2. Créer une base neuve et y appliquer les migrations : `npx wrangler d1 migrations apply DB` (ajouter `--local` pour un essai local).
3. Convertir puis appliquer :

```bash
npm run backup:sql -- d1-<date>.json.gz > restauration.sql
npx wrangler d1 execute DB --file restauration.sql
```

Chacun se reconnecte ensuite avec son mot de passe. Cette procédure est testée de bout en bout (`test/backup.test.mjs`).

## Tests de bout en bout

À la racine du projet : `npm run test:e2e`. Le script lance l'API et le site, puis rejoue dans Chromium
les parcours des lots 1, 2, 5 et 6. Il faut Playwright et Chromium : `npm i -D playwright && npx playwright install chromium`.
