# Kit LoreSmith — Campaign Studio V3

## Ce que contient ce kit

- `campaign-studio-v3.html` — nouvelle maquette interactive, autonome et hors ligne.
- `CAHIER_DES_CHARGES_V3.md` — cahier des charges produit et architecture, avec contrôles de lancement, données et critères de recette.
- `PROMPT_CLAUDE_CODE_V3.md` — mandat prêt à transmettre à Claude Code.
- `dossier-mj-exemple-brouillon.html` — exemple de dossier MJ exporté, avec les 9 scènes et l'état de préparation non finalisé.
- `01...10-*.png` — captures d'écran des principales vues, dont une vue mobile.

## Explorer la maquette

Ouvrir `campaign-studio-v3.html` dans un navigateur local. Aucun serveur et aucune connexion n'est nécessaire. La démonstration commence avec **Les Veilleurs du Col**, campagne fictive de 3 actes / 9 scènes / 3 séances dans un Moriquendi d'exemple, sans création de canon.

Tester dans cet ordre :

1. **Vue d'ensemble** : progression globale, état des scènes, préparation prioritaire et séances.
2. **Fil de campagne** : structure des 3 actes, onglet **Évolution dramatique** et onglet **Choix & chemins** (changer les trois décisions pour observer leurs effets en aval).
3. **Dossiers des scènes** : sélectionner la scène 1 (carte et jetons), puis la scène 5 (piège incomplet); la vue joueurs masque les adversaires cachés. Le texte du MJ est modifiable.
4. **Registre** : ouvrir une ressource, voir ses scènes liées et compléter une proposition simulée.
5. **Avant la séance 1** : voir les éléments bloquants, lancer la **Répétition générale**, compléter des éléments, et constater que la préparation générale se met à jour.
6. **Exporter le dossier MJ** : le navigateur télécharge un **fichier HTML imprimable**. Tant que des manques subsistent, il indique clairement « Brouillon ».
7. **Fondations** : modifier le niveau du groupe ou l'édition, puis constater que les rencontres déjà confirmées redeviennent à vérifier.

## Ce qui marche vraiment dans le prototype

- Navigation et accès aux 9 scènes;
- Synchronisation des compteurs de préparation;
- Bifurcations hypothétiques et répercussions préécrites;
- Fiches liées et registre réutilisable;
- Visibilité MJ/joueurs, glisser-déposer des jetons dans les cartes de démonstration;
- Confirmation de préparation et invalidation simplifiée de dépendances;
- Réponses guidées et notes de scène, sauvées localement si le navigateur le permet;
- Audit et répétition générale **simulés**, export HTML et JSON.

## Ce qui n'est PAS branché

- Aucun appel réel à une IA;
- Aucune connexion au code React, à la Library, à Images ou au Scene Runner;
- Aucun calcul réel de budget XP ou d'équilibrage D&D;
- Aucune certification automatique des champs : les validations sont illustratives et doivent devenir de vraies règles métier;
- Aucun export réel de cartes privées/publiques ou d'images produites;
- Le monde Moriquendi sert uniquement de contexte de démonstration et aucun nouvel élément n'est considéré canon.

## Faire construire la version intégrée

Transmettre le HTML, le cahier des charges et `PROMPT_CLAUDE_CODE_V3.md` à Claude Code. **Commencer par le Lot 0, audit du dépôt réel, avant de modifier du code.** Les lots sont décrits dans la section 13 du cahier des charges.
