# Loresmith : règles de travail

## Le projet

- Application React + Vite pour les MJ (Maîtres du jeu), en français. Le grimoire (univers, PNJ, campagnes, cartes…) vit
  d'abord dans le navigateur (IndexedDB) ; un compte MJ facultatif le synchronise et permet de partager des univers.
- `src/App.jsx` est un monolithe d'environ 18 000 lignes. N'en extrais que le nécessaire, dans de nouveaux modules.
- Site et API sont hébergés sur Cloudflare (offres gratuites) : Pages pour le site, Pages Functions pour l'API
  (`functions/api/[[path]].js` → `server/src`), base D1 `loresmith`, espace KV `loresmith-blobs` (images partagées,
  sauvegardes), Worker `loresmith-backup` (sauvegarde nocturne). Le site est protégé par Cloudflare Access.
- Historique du chantier cloud : `docs/cloud/PLAN.md` (lots 0 à 8), `docs/cloud/AUDIT.md`, `docs/cloud/CONFORMITE.md`.

## Déploiement

- **Tout envoi sur `main` part en production** (site et API), automatiquement. Travaille sur une branche, puis pull request.
- Les aperçus Cloudflare ne sont construits que pour les branches listées dans le projet Pages
  (Settings → Builds → Branch control). Une autre branche n'aura pas d'aperçu tant qu'elle n'y est pas ajoutée.
- Les aperçus et la production partagent la même base D1 et le même espace KV.

## Règles permanentes

1. **Coût zéro.** Aucun service payant, abonnement ou ressource facturable sans accord écrit de l'utilisateur
   (R2 a été écarté pour cette raison : il exige un moyen de paiement).
2. **Secrets.** Aucun secret, jeton ou clé dans le dépôt. Les clés d'IA restent dans le navigateur de l'utilisateur.
   Les secrets du serveur sont dans le projet Pages (`BETTER_AUTH_SECRET`) et, en local, dans `server/.dev.vars` (ignoré).
3. **Données utilisateur.** Ne supprime jamais de données par accident. Toute migration doit être réversible, ou précédée
   d'une sauvegarde. Le serveur marque les suppressions (`deleted_at`) et garde l'historique (`document_versions`).
4. **Zones à risque.** `src/App.jsx`, `src/store/persist.js`, `src/sync/engine.js` et `server/src/` : signale
   explicitement toute modification de ces fichiers dans ton compte rendu.
5. **Tests.** Avant chaque commit : `npm run build` et `npm test` (site et serveur ; la première fois,
   `npm install --prefix server`). `npm run lint` si tu touches du TypeScript. Pour un changement qui touche le stockage,
   la synchronisation ou le partage : `npm run test:e2e` (parcours dans Chromium). Ne désactive jamais un test.
6. **Langue.** Interface, documentation et commentaires en français.

## Pièges de l'architecture (à connaître avant de coder)

- **Images.** Dans le grimoire en mémoire, une image est une URL `blob:` ; sur le disque et sur le serveur, une référence
  `lsimg:<empreinte>` (images dans le magasin IndexedDB `images`, cf. `src/store/images.js`). Pour une nouvelle image,
  passe par les aides existantes (`fileToCompressed`, `compressImage` de `src/media/images.js`, tailles dans
  `IMAGE_MAX`) : une data URL base64 est convertie à la sauvegarde, mais ne la garde pas dans l'état.
- **Nouvelle collection dans l'état.** Pour qu'elle soit exportée et synchronisée, ajoute-la à `DOC_TYPES`
  (`src/shared/schema.js`), à `COLLECTIONS` (`src/store/archive.js`) et, si elle est rattachée à un univers, donne à
  chaque élément un `universeId`. Un champ ajouté à un élément existant voyage tout seul.
- **Identifiants.** Les éléments ont des identifiants créés dans le navigateur. Ne réutilise pas un identifiant fixe
  (seule exception : la carte `atlas-profondeurs`, cf. `FIXED_IDS`).
- **Champs secrets.** Un nouveau champ réservé au MJ doit être ajouté à `SECRET_FIELDS` (`src/shared/schema.js`).
- **Permissions.** Toute règle d'accès vit dans `src/shared/policy.js` (testé rôle par rôle) et est appliquée par le
  serveur ; l'interface ne fait que masquer.
- **Base de données.** Toute modification du schéma passe par une **nouvelle** migration dans `server/migrations/`
  (jamais en modifiant une migration existante), testée en local, puis appliquée en ligne :
  `npx wrangler d1 migrations apply DB --remote` (depuis `server/`, Wrangler connecté au compte Cloudflare).
- **Conditions d'utilisation.** Le texte est dans `src/shared/terms.js`. Toute modification du texte doit changer
  `TERMS_VERSION` : chaque MJ devra l'accepter de nouveau.
- **Mode local.** Sans serveur ni compte, l'application doit fonctionner exactement comme avant. Vérifie-le.

## Compte rendu

À la fin de chaque changement, donne : les fichiers créés ou modifiés, les résultats des tests et du build,
les décisions prises et pourquoi, et les questions ouvertes.
