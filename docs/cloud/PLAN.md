# Plan cloud de Loresmith

Statut global : en cours. Chaque lot porte son propre statut : « à faire », « à valider », « validé », « corrigé ».

## 1. Contexte

- Application React + Vite, côté navigateur, destinée aux MJ.
- Données dans IndexedDB (`src/store/persist.js`), un seul objet `store` contenant tout le grimoire.
- Images : aujourd'hui en base64, dans l'état. `public/` pèse 127 Mo, avec 559 images intégrées.
- Fenêtre joueur locale (`src/present/PlayerScreen.tsx`). Pas de comptes joueurs.
- Appels d'IA et de synthèse vocale faits depuis le navigateur, avec la clé de l'utilisateur.
- Le MJ doit pouvoir jouer hors ligne à la table.

## 2. Objectifs

- Permettre à des MJ de créer un compte, puis de partager univers et campagnes.
- Hébergement sans frais, pour une dizaine d'utilisateurs au départ.
- Architecture qui permettra une commercialisation plus tard, sans reconstruire les bases.

## 3. Décisions

| Sujet | Décision | Statut |
|---|---|---|
| Hébergement | Cloudflare Pages (front), Worker (API), D1 (base), Workers KV (images partagées, sauvegardes : R2 exigerait un moyen de paiement) | Acquis |
| Authentification | Better Auth, avec envoi de courriels via Resend (plan gratuit) | Acquis |
| Base de données | D1 (SQLite), migrations versionnées | Acquis |
| Rôles univers | propriétaire, éditeur, contributeur, lecteur | Acquis |
| Rôles campagne | MJ (créateur), co-MJ | Acquis |
| Secrets de campagne | Visibles par tous les MJ membres de l'univers (tous les utilisateurs sont des MJ, aucun joueur n'a de compte) | Acquis |
| Mode hors ligne | Le MJ travaille sur une copie locale (IndexedDB). Le serveur sert à la synchronisation et au partage | Acquis |
| Images utilisateur | Blob dans IndexedDB, compressées en WebP, références dans l'état. R2 seulement au moment du partage | Acquis |
| Images intégrées | Restent dans `public/`, converties en WebP et chargées à la demande | Acquis |
| Clés d'IA | Restent dans le navigateur de l'utilisateur | Acquis |
| Joueurs | Pas de compte. La fenêtre joueur est locale | Acquis |
| Données de jeu de l'appareil | Le combat en cours, le journal, les fils de discussion IA et l'univers actif suivent le compte et sont synchronisés, quel que soit l'appareil | Acquis (Q1) |
| Secrets de la bibliothèque | Visibles par tous les membres de l'univers, qui sont tous des MJ | Acquis (Q3) |
| PNJ et créatures | Appartiennent à l'univers, partagés par toutes ses campagnes | Acquis (Q4) |
| Historique | Le serveur garde un historique des versions de chaque document, pour permettre un retour arrière | Acquis (Q5) |
| Fiches de créatures personnalisées | Entrent dans le grimoire (export et synchronisation) | Acquis (Q2) |
| Images des Archives | Réservées à l'univers Underdark | Acquis (Q6) |

Les décisions marquées « à confirmer » doivent être validées par l'utilisateur à la fin du lot 0.

## 4. Architecture cible

- **Front** : l'application actuelle, avec une couche de données qui lit d'abord en local, puis synchronise.
- **Stockage local** : IndexedDB. Un magasin pour le grimoire, un magasin `images` pour les Blob.
- **Serveur** : un Worker Cloudflare dans un dossier `server/`, avec D1 et R2. Aucune logique métier dans le front pour les autorisations.
- **Autorisations** : un module `policy` pur, testé unitairement, utilisé par le serveur.

## 5. Lots

Chaque lot se termine par un commit, puis par une validation de l'utilisateur. Le modèle conseillé est indiqué pour chacun.

### Lot 0 : audit (lecture seule)

- **Statut** : validé
- **Modèle conseillé** : `claude-opus-5-5`
- **Objectif** : cartographier l'existant avant toute modification.
- **Fichiers touchés** : uniquement `docs/cloud/AUDIT.md`.
- **À couvrir** :
  1. Modèle de données du grimoire : chaque entité, son identifiant, son rattachement (`universeId`, `campaignId`), ses champs image.
  2. Points de lecture et d'écriture de l'état : `loadState`, `saveState`, `localStorage`, clés utilisées.
  3. Données secrètes d'une campagne : notes MJ, scènes ou PNJ cachés.
  4. Couplages entre domaines de `App.jsx` : ce qui peut être extrait sans risque.
  5. Estimation du poids des images en base64, à partir du code.
  6. Risques et questions ouvertes.
  7. Plan détaillé de ce document pour les lots 1 à 7 : fichiers, tests, critères.
- **Critères d'acceptation** : `AUDIT.md` existe et répond aux 7 points. Aucun fichier de `src/` n'est modifié.
- **Sortie** : résumé de 15 lignes au maximum, et liste des décisions à valider.

### Lot 1 : images hors de l'état

- **Statut** : validé
- **Modèle conseillé** : `claude-sonnet-5-5`
- **Objectif** : sortir les images de l'état principal et les stocker en Blob dans IndexedDB.
- **Fichiers probables** : `src/store/persist.js`, un nouveau module `src/store/images.*`, `src/media/images.js`, `src/maps/mapStore.ts`.
- **À faire** :
  - magasin IndexedDB `images` (clé : identifiant, valeur : Blob) ;
  - le grimoire ne contient plus que des références (`imageId`) ;
  - migration au premier démarrage : base64 vers Blob, puis suppression des anciennes copies ;
  - compression WebP, avec tailles maximales (portraits environ 512 px, cartes environ 1600 px) ;
  - demande de persistance (`navigator.storage.persist()`) et affichage de l'espace utilisé.
- **Critères d'acceptation** :
  - les données existantes sont migrées sans perte, vérifié par un test ;
  - le chargement ne relit plus les images avec le grimoire ;
  - le mode local fonctionne comme avant, sans régression visible.
- **Tests** : unitaires pour la migration et la compression, avec `node --test`.

### Lot 2 : export et import

- **Statut** : validé
- **Modèle conseillé** : `claude-sonnet-5-5`
- **Objectif** : exporter et importer un univers, une campagne, ou la totalité des données, sous forme de fichier ZIP.
- **Contenu du ZIP** : un fichier JSON du grimoire ou de l'élément choisi, et un dossier `images/`.
- **Dépendance** : une bibliothèque de ZIP gratuite. Choix de l'utilisateur : `fflate` (licence MIT).
- **Critères d'acceptation** : export puis import dans un navigateur vierge restaure les données et les images. Un import ne doit jamais écraser silencieusement des données existantes.

### Lot 3 : modèle de données et permissions

- **Statut** : validé
- **Modèle conseillé** : `claude-opus-5-5`
- **Objectif** : définir le schéma cible, et un module `policy` pur, sans serveur.
- **Fichiers probables** : `src/shared/policy.*`, `src/shared/schema.*`, tests associés.
- **Règles** : une fonction `can(user, action, ressource)` par ressource. Les rôles sont ceux de la section 3.
- **Critères d'acceptation** : tests couvrant chaque rôle et chaque action, y compris les cas refusés. Les secrets de campagne ne sont accessibles qu'aux MJ et co-MJ. Mise à jour après le lot 0 : tous les comptes étant des MJ, les secrets sont lisibles par tout membre de l'univers (réglage `SECRETS_VISIBLE_TO` dans `policy.js`) ; un non-membre n'y a jamais accès.

### Lot 4 : backend

- **Statut** : validé
- **Modèle conseillé** : `claude-opus-5-5`
- **Objectif** : Worker, base D1, authentification, migrations.
- **Fichiers probables** : dossier `server/`, `wrangler.toml`, migrations SQL.
- **À faire** : installer `wrangler` comme dépendance de développement ; créer les tables ; configurer Better Auth ; exposer les routes de base (santé, profil, univers, campagnes).
- **Critères d'acceptation** : `wrangler dev` démarre ; une migration s'applique sur une base locale ; une requête sans authentification est refusée.
- **Hors périmètre** : aucun déploiement en production sans demande explicite.

### Lot 5 : synchronisation

- **Statut** : validé
- **Modèle conseillé** : `claude-opus-5-5`
- **Objectif** : envoyer et recevoir univers et campagnes partagés, avec un numéro de version.
- **Règles** : le local reste la copie de travail. En cas de conflit (réponse 409), proposer à l'utilisateur de choisir la version à garder. Pas de synchronisation en temps réel.
- **Critères d'acceptation** : deux clients peuvent travailler sur un même univers sans perte silencieuse ; le mode hors ligne reste utilisable.

### Lot 6 : partage

- **Statut** : validé
- **Modèle conseillé** : `claude-sonnet-5-5`
- **Objectif** : invitations par courriel, gestion des rôles dans l'interface.
- **Critères d'acceptation** : une invitation expire ; un invité sans compte peut en créer un puis accepter ; un rôle retiré prend effet immédiatement côté serveur.

### Lot 7 : durcissement

- **Statut** : validé
- **Modèle conseillé** : `claude-sonnet-5-5`
- **Objectif** : tests de bout en bout, sauvegarde régulière de D1 vers R2, journalisation, check-list de conformité.
- **Critères d'acceptation** : une restauration depuis une sauvegarde est testée ; la check-list de conformité (Loi 25 du Québec, conditions d'utilisation, licences des contenus tiers) est rédigée et marquée à valider par un professionnel.

### Lot 8 : conformité et mise en ligne

- **Statut** : à valider
- **Modèle conseillé** : `claude-opus-5-5`
- **Objectif** : avis et conditions acceptés à la première connexion, export et suppression du compte, mentions et licences ; mise en ligne gratuite de l'API.
- **Fait** :
  - avis et conditions (`src/shared/terms.js`, version datée) : exigés par le serveur avant toute synchronisation ;
  - export des renseignements du compte (JSON) et suppression du compte (univers partagés protégés) ;
  - fenêtre « Mentions, licences et confidentialité » ;
  - stockage des images et des sauvegardes dans Workers KV plutôt que R2 (R2 exige un moyen de paiement) ;
  - identifiants déjà pris par un autre compte (même archive importée deux fois) : renommés automatiquement ;
  - Pages Function `functions/api/[[path]].js` : l'API est servie à l'adresse du site.
- **Décision de l'utilisateur** : pas de commercialisation prévue ; une curation des contenus hors SRD précédera tout lancement public.

## 6. Points à vérifier avant commercialisation

- Licences des Archives de l'Underdark et des images dans `public/images/archives`.
- Conditions d'usage commercial des fournisseurs d'images générées.
- Loi 25 du Québec : responsable de la protection des renseignements, consentement, droit d'accès et de suppression.
- Quotas des offres gratuites Cloudflare, Resend et Better Auth, à revérifier avant la mise en production.
