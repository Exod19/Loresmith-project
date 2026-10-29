# Loresmith : règles de travail

## Le projet

- Application React + Vite, entièrement côté navigateur, destinée aux MJ (Maîtres du jeu).
- Les données (univers, PNJ, campagnes, images) sont dans IndexedDB, via `src/store/persist.js`.
- `src/App.jsx` est un monolithe de plus de 13 000 lignes.
- La fenêtre joueur (`src/present/PlayerScreen.tsx`) s'affiche localement. Les joueurs n'ont pas de compte.
- Objectif à terme : comptes MJ, partage d'univers et de campagnes entre MJ, hébergement sans frais (Cloudflare Pages, Worker, D1, R2), et possibilité de commercialiser plus tard.
- Le plan complet est dans `docs/cloud/PLAN.md`. Lis-le avant tout travail.

## Règles permanentes

1. **Coût zéro.** N'utilise aucun service payant, aucun abonnement et aucune ressource facturable sans accord écrit de l'utilisateur.
2. **Branche.** Travaille sur `feature/cloud-foundations`. Ne fais jamais de commit sur la branche principale.
3. **Pas de pull request.** Ne crée pas de pull request, et ne pousse rien sans demande explicite.
4. **Un lot à la fois.** Arrête-toi à la fin de chaque lot pour validation. Ne commence jamais le lot suivant de toi-même.
5. **Périmètre strict.** Ne modifie pas le comportement visible hors du lot demandé.
6. **Pas de refactor large de `App.jsx`.** N'en extrais que ce qui est nécessaire, dans de nouveaux modules.
7. **Zones à risque.** `src/App.jsx` et `src/store/persist.js` sont sensibles. Toute modification de ces fichiers doit être signalée explicitement dans le rapport de fin de lot.
8. **Secrets.** Aucun secret, jeton ou clé dans le dépôt. Les clés d'IA restent dans le navigateur de l'utilisateur.
9. **Données utilisateur.** Ne supprime jamais de données. Toute migration doit être réversible, ou précédée d'une sauvegarde.
10. **Tests.** Avant chaque commit, lance `npm run build` et `npm test`. Lance `npm run lint` si tu as touché du code. Si un test échoue à cause de ton travail, corrige-le. Ne désactive jamais un test.
11. **Commits.** Un commit par lot, avec un message au format `lot N : titre court`.
12. **Langue.** Documentation et commentaires en français, comme le reste du code.

## Rapport de fin de lot

À la fin de chaque lot, donne :

- la liste des fichiers créés ou modifiés ;
- les résultats des tests et du build ;
- les décisions que tu as prises, et pourquoi ;
- les questions ouvertes pour l'utilisateur.
