# Cahier des charges pour Claude Code — LoreSmith Combat Narrator

## Mission
Intégrer cette bibliothèque dans le module Combat et, si approprié, Scene Runner de LoreSmith. **Inspecte le code actuel avant toute modification**; ne remplace pas les règles existantes.

## Import
1. Copier le dossier `data` et `manifest.json` dans `src/data/combatNarration/` (ou `public/data/` pour chargement paresseux).
2. Valider le schéma au chargement; signaler les entrées invalides sans planter le combat.
3. Utiliser une sélection déterministe par ID avec générateur aléatoire injectable pour les tests.
4. Sélectionner seulement **après** résolution de l'attaque et de ses dégâts.

## Ordre de filtrage strict
1. `result` exact : `miss`, `hit`, `critical_fail`, `critical_hit`, `killing_blow`, `legendary`. Le moteur de règles décide de la classification.
2. Si coup fatal, autoriser `killing_blow`; si coup critique fatal contre boss, autoriser aussi `legendary`; si coup critique non fatal, `critical_hit`. Prévoir un fallback si la classe prioritaire est vide.
3. `tags.weapons` : correspondance exacte ou `any`; `spell` seulement pour attaques magiques.
4. `tags.creatures` : correspondance exacte ou `any`. Faire correspondre l'identité canonique de la créature.
5. `tags.anatomies` : correspondance exacte ou `any`; ne jamais supposer une anatomie absente.
6. `tags.damageTypes` si présent : correspondance stricte avec les dégâts réellement appliqués. Ne pas choisir une phrase d'impact feu pour une attaque immunisée sans dégâts.
7. `tags.environments` et `conditions` : ne jamais inventer le contexte. Toute condition inconnue = faux.
8. Exclure les IDs récents; réintroduire progressivement seulement si le bassin est vide.
9. Tirage pondéré par rareté et tonalité, avec ajustement selon la gravité de la scène.

## Attention à la mécanique
- `critical_fail` ne provoque pas automatiquement chute, désarmement, perte d'action, dommage allié ou pénalité.
- Une attaque ratée peut être une esquive, un raté de trajectoire ou un choc sur une armure, **mais** ne pas prétendre à une parade si aucune parade n'est établie.
- `killing_blow` et `legendary` exigent `isKillingBlow=true`.
- Ne pas afficher de narration d'impact si l'attaque n'a infligé aucun dégât et que le texte suppose une blessure; préférer un fallback neutre.
- Ne pas afficher les descriptions d'armes physiques pour des sorts.
- Certains coups critiques décrivent une blessure visible; les éviter sur les ennemis sans anatomie appropriée, sauf si `any` est validé éditorialement.

## Variables et formatage
Les seules variables textuelles actuelles sont `{attacker}` et `{target}`. Échapper les valeurs dans React (texte brut, jamais `dangerouslySetInnerHTML`). Prévoir noms complets et articles naturels en français. Pour les monstres, `target` peut être `le squelette` plutôt que `Squelette`.

## Historique / anti-répétition
Stocker par campagne les 40 derniers IDs narrés, et par combat les 20 derniers; aucune répétition tant que suffisamment de candidats existent. Ne pas persister une phrase entière inutilement. Ajouter une option pour désactiver les narrations longues pendant les combats rapides.

## UX
Afficher narration en bas du panneau résultat du dé, avec un style discret pour hit/miss et une transition plus marquée pour critical/legendary. Ne jamais bloquer les contrôles pendant une animation. Accessibilité : `prefers-reduced-motion`, aria-live poli, possibilité de couper les animations et l'humour. Pas de génération IA à chaque attaque.

## Tests requis
- Aucun ID ni texte exact dupliqué entre fichiers.
- Aucun placeholder inconnu.
- Une phrase fatale n'apparaît jamais pour une cible survivante.
- Un sort ne sélectionne jamais une phrase d'arme physique.
- Une créature `ooze` ne reçoit pas une description d'os ou de sang.
- Les conditions inconnues rendent l'entrée inéligible.
- Le système fonctionne hors ligne.
- 10 000 sélections sans exception, avec bonne répartition et fallback.

## Extensions futures
Ajouter les langues `en-CA`, les conditions de terrain, les identités claniques Moriquendi, les styles de personnage et les narrations personnalisées par campagne. Les textes d'origine sont indépendants du moteur de jeu et ne nécessitent pas d'API payante.
