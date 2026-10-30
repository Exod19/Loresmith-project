# Lot 20 : banque réservée à l'administrateur, images propres à l'univers ou à la campagne

- **Administrateur de l'application** (`server/src/admins.js`) :
  - la liste vient de la variable `ADMIN_EMAILS` du projet Pages ; sans elle, `sam@groupeadjuvant.ca` ;
  - le serveur ajoute `admin` au profil du compte (`actor.admin`, `/api/me`).
- **Règle d'accès** `canBanque` (`src/shared/policy.js`, testée) : tout compte lit les retouches des images communes,
  seul l'administrateur les change (403 sinon).
- **Page Banque** :
  - les images communes sont en lecture seule, sauf pour l'administrateur ;
  - un MJ ajoute ses images (jeton, portrait, élément ou texture), pour son univers ou pour sa campagne en cours, puis
    les étiquette ou les retire.
- **Images d'un MJ** : ce sont des `assets` de l'univers (catégorie `banque`, étiquettes dans `banque`, `campaignId`
  pour une campagne). Elles sont synchronisées et partagées avec les droits de l'univers.
  - La banque y puise pour les cartes, les combats et les fiches ; une image de campagne ne sert que quand cette
    campagne est en cours.
  - Le jeton d'un MJ se tourne vers son vis-à-vis comme ceux du catalogue.
  - La silhouette d'un toit ajouté est mesurée à l'envoi, pour qu'il se pose sur les bâtiments en L, en T ou en U.

## Fichiers sensibles

- `src/App.jsx` : une ligne, qui passe à la page Cartes les images « banque » de l'univers (`bankAssets`).
- `server/src/` : nouveau `admins.js`, `index.js` (drapeau `admin`), `account.js` (`/api/me`), `banque.js` (règle).
