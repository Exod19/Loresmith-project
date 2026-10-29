# Liste de vérification de conformité

> **Statut : à valider par un professionnel.**
> Ce document n'est pas un avis juridique. Il recense, à partir du code au lot 7, ce que Loresmith collecte et ce qu'il
> faut vérifier ou produire avant d'ouvrir le service à d'autres MJ, et avant toute commercialisation.
> Chaque point porte un état : **en place** (fait dans le code), **à faire** (manque), **à vérifier** (question pour le
> professionnel ou pour le propriétaire du projet).

## 1. Inventaire des renseignements personnels

| Donnée | Où | Pourquoi | Durée de conservation actuelle | État |
|---|---|---|---|---|
| Courriel, nom affiché | D1, table `user` | compte, invitations | tant que le compte existe | à vérifier : aucune suppression de compte n'existe encore |
| Mot de passe | D1, table `account` | connexion | idem | en place : haché par Better Auth (scrypt), jamais en clair |
| Adresse IP, navigateur | D1, table `session` | sécurité de la session | durée de la session | à vérifier : à mentionner dans la politique |
| Courriel d'un invité | D1, table `invitations` | invitation | sans limite (même expirée) | à faire : purger les invitations expirées ou acceptées |
| Contenu des grimoires (univers, PNJ, notes, discussions IA, images) | D1 `documents`, R2 | service | tant que le document existe ; **historique complet** dans `document_versions` | à vérifier : un MJ peut y noter des renseignements sur ses joueurs ; durée de l'historique à fixer |
| Journaux | Workers Logs | diagnostic | quelques jours (offre gratuite) | en place : identifiant de compte, route, statut, durée ; ni courriel, ni contenu, ni jeton (testé) |
| Sauvegardes de la base | R2, `backups/` | reprise après sinistre | 30 jours (`BACKUP_KEEP`) | à vérifier : elles contiennent courriels et mots de passe hachés |
| Clés d'IA et de synthèse vocale | navigateur de l'utilisateur seulement | appels d'IA | localStorage | en place : jamais envoyées au serveur, ni dans les exports |
| Textes envoyés aux fournisseurs d'IA (OpenAI, Gemini, OpenRouter, Groq, ElevenLabs, Pollinations) | directement depuis le navigateur | génération | selon chaque fournisseur | à vérifier : Loresmith n'en est pas destinataire, mais la politique doit en informer |
| Polices Google Fonts | chargées depuis Google | affichage | — | à vérifier : l'adresse IP du visiteur part chez Google ; mentionner, ou héberger les polices |

## 2. Loi 25 (Loi sur la protection des renseignements personnels dans le secteur privé, Québec)

- [ ] **Responsable de la protection des renseignements personnels** : désigner (par défaut, la personne ayant la plus haute autorité), publier son titre et ses coordonnées sur le site. — *à faire*
- [ ] **Politique de confidentialité** en termes simples, publiée sur le site, et lien au moment de l'inscription. — *à faire*
- [ ] **Consentement** à l'inscription : finalités, fournisseurs, transferts hors Québec ; case ou mention explicite dans le formulaire « Créer un compte ». — *à faire (interface)*
- [ ] **Évaluation des facteurs relatifs à la vie privée (EFVP)** pour ce système d'information. — *à faire*
- [ ] **Communication hors du Québec** : Cloudflare (Workers, D1, R2, journaux) et Resend traitent les données hors Québec. Une EFVP et des engagements contractuels (conditions et accords de traitement des fournisseurs) sont requis avant la communication. — *à vérifier*
- [ ] **Droits des personnes** : accès, rectification, retrait du consentement, suppression, portabilité (format technologique structuré).
  - export du grimoire : *en place* (.zip, lot 2) ;
  - export des données du compte (profil, appartenances) : *à faire* ;
  - **suppression du compte** et de ses renseignements (y compris dans les sauvegardes, à l'échéance de la rotation) : *à faire*.
- [ ] **Conservation et destruction** : fixer des durées (comptes inactifs, invitations, historique des versions, sauvegardes, journaux). À arbitrer avec la règle de travail « ne jamais supprimer de données », pensée pour éviter les pertes accidentelles, pas pour conserver indéfiniment. — *à vérifier*
- [ ] **Incidents de confidentialité** : registre des incidents, évaluation du risque de préjudice sérieux, avis à la Commission d'accès à l'information et aux personnes concernées. Procédure à écrire. — *à faire*
- [x] **Confidentialité par défaut** : rien n'est public ; un univers n'est visible que de ses membres ; les éléments non autorisés répondent « introuvable ». — *en place*
- [ ] **Témoins (cookies)** : un seul témoin, essentiel, de session (`better-auth.session_token`, HttpOnly). À mentionner dans la politique ; pas de témoin publicitaire ni de mesure d'audience. — *à vérifier*
- [ ] **Mineurs** : âge minimum à fixer dans les conditions d'utilisation (consentement parental sous 14 ans). — *à vérifier*
- [x] **Décision automatisée, profilage** : aucun. — *en place*

## 3. Sécurité (mesures techniques)

- [x] Mots de passe hachés, sessions en témoin HttpOnly (Better Auth) ; HTTPS fourni par Cloudflare.
- [x] Droits vérifiés côté serveur pour chaque requête (`src/shared/policy.js`), rôles relus à chaque requête ; tests de chaque rôle et de chaque action.
- [x] Jetons d'invitation aléatoires, dont seule l'empreinte est conservée ; invitation liée au courriel invité, valable 7 jours.
- [x] Images partagées identifiées par l'empreinte de leur contenu (une image ne peut pas en remplacer une autre).
- [x] Aucun secret dans le dépôt (`.dev.vars` ignoré ; secrets de production à poser avec `wrangler secret put`).
- [x] Sauvegarde quotidienne de la base, restauration testée (`server/test/backup.test.mjs`).
- [ ] Vérification du courriel à l'inscription et réinitialisation du mot de passe (nécessitent Resend). — *à faire*
- [ ] Limite de tentatives de connexion persistante (la limite par défaut de Better Auth est en mémoire, par instance). — *à faire*
- [ ] Authentification à deux facteurs pour les comptes d'administration Cloudflare, Resend et GitHub. — *à vérifier*
- [ ] Les images dans R2 ne sont pas sauvegardées ailleurs (R2 est lui-même redondant ; une copie hors Cloudflare reste à décider). — *à vérifier*

## 4. Conditions d'utilisation

Points à couvrir (rédaction à faire, en français : Charte de la langue française pour les contrats d'adhésion) :

- [ ] Propriété des contenus : le MJ garde ses droits ; licence limitée à Loresmith pour héberger, afficher et transmettre aux membres qu'il invite.
- [ ] Partage : qui invite répond de ses invitations ; **tous les membres d'un univers lisent tout, secrets compris** (choix du projet).
- [ ] Contenus interdits, signalement, suspension.
- [ ] Contenus générés par IA : clés et comptes de l'utilisateur, conditions des fournisseurs applicables, aucune garantie sur le contenu généré.
- [ ] Service fourni sans garantie de disponibilité (offres gratuites), limitation de responsabilité, sauvegardes conseillées (export .zip).
- [ ] Fermeture de compte et sort des contenus partagés.
- [ ] Âge minimum, droit applicable (Québec), modifications des conditions.

## 5. Licences des contenus tiers

| Contenu | Où | Licence connue | État |
|---|---|---|---|
| Statistiques du SRD 5.1 (Wizards of the Coast) | `src/maps/atlas/statblocks.ts` et ailleurs | CC BY 4.0 | en place : mention `SRD_CREDIT` ; *à vérifier* qu'elle s'affiche partout où ces données sont utilisées, et dans une page « Mentions et licences » |
| Noms et lieux hors SRD (ex. Menzoberranzan, univers des Royaumes oubliés) | données, Archives, textes | propriété de Wizards of the Coast | **à vérifier avant commercialisation** |
| Archives de l'Underdark (`public/feeds/underdark.json` : 263 fiches, 270 images) et `public/archive`, `public/images/archives` | site | inconnue | **à vérifier** : auteur, droits de diffusion et d'usage commercial |
| Images intégrées (`public/images/encyclopedie`, `combat-map`, `atlas`, `albums`) | site | inconnue | **à vérifier**, lot par lot (provenance, générateur, conditions) |
| Images générées : OpenAI (gpt-image-1) | grimoires | conditions d'OpenAI (droits à l'utilisateur) | à vérifier pour l'usage commercial |
| Images générées : Pollinations | grimoires | conditions de Pollinations | **à vérifier** pour l'usage commercial |
| Voix : ElevenLabs | lecture à voix haute | conditions d'ElevenLabs selon le forfait de l'utilisateur | à vérifier |
| Polices Cinzel, EB Garamond, Spectral, JetBrains Mono | Google Fonts | SIL Open Font License | en place (usage permis) |
| Bibliothèques : React, react-dom, fflate, @3d-dice/dice-box, Hono, Better Auth (MIT) ; lucide-react (ISC) ; pdfjs-dist (Apache-2.0) ; Wrangler (MIT ou Apache-2.0) | code | libres | *à faire* : fichier d'avis de licences des tiers joint à la distribution |

## 6. Offres gratuites : quotas à revérifier avant la mise en production

Valeurs connues au moment de la rédaction ; **à revérifier** sur les pages officielles des fournisseurs avant l'ouverture.

| Service | Limite gratuite (indicative) | Usage par Loresmith |
|---|---|---|
| Cloudflare Workers | 100 000 requêtes par jour | API (synchronisation toutes les 5 min par appareil connecté) |
| Cloudflare D1 | 5 Go ; 5 millions de lignes lues et 100 000 écrites par jour | base, historique des versions |
| Cloudflare R2 | 10 Go stockés ; 1 million d'écritures et 10 millions de lectures par mois | images partagées, sauvegardes. L'activation de R2 peut exiger un moyen de paiement au dossier |
| Workers Logs | volume quotidien limité, quelques jours de rétention | journaux |
| Déclencheurs planifiés (cron) | quelques déclencheurs par compte | sauvegarde quotidienne |
| Resend | 3 000 courriels par mois, 100 par jour ; domaine d'envoi à vérifier | invitations, et plus tard vérification du courriel |
| Better Auth | bibliothèque libre, hébergée dans le Worker : aucun quota | comptes |

## 7. Actions techniques identifiées (lots à venir)

1. Suppression de compte (avec purge des renseignements, des appartenances et des invitations) et export des données du compte.
2. Consentement et lien vers la politique dans le formulaire d'inscription ; page « Mentions et licences » (SRD, polices, bibliothèques).
3. Vérification du courriel et mot de passe oublié (Resend, domaine vérifié).
4. Purge des invitations expirées ; durée de conservation de l'historique des versions.
5. Limite de tentatives de connexion persistante.
6. Hébergement local des polices (évite le transfert d'adresse IP à Google).
