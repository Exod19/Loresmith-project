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

Sans session, toute route autre que la santé et l'authentification répond `401`.
Les droits sont ceux de `src/shared/policy.js`. Chaque version écrite est gardée dans `document_versions`.

## Tests

`npm test` (ici, ou à la racine du projet) applique la migration sur une base D1 temporaire et teste l'API.
