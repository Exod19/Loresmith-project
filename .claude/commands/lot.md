---
description: Exécute un lot du plan cloud (docs/cloud/PLAN.md)
argument-hint: <numéro du lot>
---

Tu exécutes le lot $ARGUMENTS du plan décrit dans `docs/cloud/PLAN.md`.

Procédure :

1. Lis `CLAUDE.md` et `docs/cloud/PLAN.md`.
2. Vérifie la branche courante. Elle doit être `feature/cloud-foundations`. Sinon, arrête-toi et signale-le.
3. Vérifie dans le plan que le lot précédent est marqué « validé ». Pour le lot 0, il n'y a pas de précédent. Si ce n'est pas le cas, arrête-toi et demande confirmation.
4. Lis le lot $ARGUMENTS dans `docs/cloud/PLAN.md` et applique-le strictement dans son périmètre.
5. Lance `npm run build` et `npm test`. Corrige les échecs liés à ton travail. Ne désactive aucun test.
6. Dans `docs/cloud/PLAN.md`, passe le statut du lot à « à valider ».
7. Fais un commit au format `lot $ARGUMENTS : titre court`.
8. Rédige le rapport de fin de lot selon `CLAUDE.md`.

Arrête-toi là. Ne lance pas le lot suivant.
