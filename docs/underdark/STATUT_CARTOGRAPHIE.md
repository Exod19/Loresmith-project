# État de l'Atlas et méthode d'export (29 octobre 2026)

## Données vérifiées dans le dépôt source de Fléau

Dépôt : `Exod19/Fl-au-Bestiaire` ; branche inspectée : `claude/underdark-encyclopedia-gp0j59` (ne pas présumer qu'il s'agit toujours de la branche active).

- `src/atlas/data.ts` déclare les niveaux, strates, features, géométries, ancres, connexions et carte. La géographie de test a `demo:true` et **n'est pas canonique**.
- `src/atlas/hostenValak.ts` détaille la cité verticale avec ses paliers et lieux nommés, ses cartes BAT001–BAT008. Sa situation globale « sud » n'autorise pas une position arbitraire sur une strate.
- `src/atlas/procedural.ts` ajoute des centaines de repères fictifs en développement. Leur nombre et IDs peuvent changer ; l'export doit être réalisé sur le dépôt courant.
- `src/atlas/cities.ts` construit des sites à partir des fichiers `atlas-cite-v1` et parfois de brouillons locaux non publiés.
- `public/data/cites/index.json` répertoriait **khordun** et **kharaz-dumel** au moment de l'inspection, statut de création pour les deux. Leurs paliers et emplacements proviennent de leurs JSON (pas automatiquement canoniques).
- `src/atlas/encounters.ts` contient déjà un générateur simple de rencontres qu'il faut conserver jusqu'à migration vérifiée.

## Contenu livré et non livré

Le ZIP comprend le **moteur d'exportation des lieux** du kit, la **taxonomie fonctionnelle**, les **7 lieux canoniques** du kit et un index **non exhaustif** de repères vérifiés dans les sources.
Il **ne contient pas l'export complet du dépôt réel**, car celui-ci doit être calculé depuis la copie à jour du dépôt de Claude. Les seuls index `examples/export-fixture/` du kit sont des jeux de démonstration ; ne les copier jamais dans la base de données canonique.

## Commander l'export réel à Claude

Depuis le répertoire `03_RENCONTRES_ET_ASSOCIATIONS/KIT_RENCONTRES_VIVANTES_V1`, exécuter :

```bash
node scripts/build-atlas-inventory.mjs --repo /CHEMIN/DU/DEPOT/Fl-au-Bestiaire --out /CHEMIN/DE_SORTIE/atlas-reel
```

Attendu : `atlas-location-index.json`, `atlas-location-index.csv`, `atlas-routes.json`, `atlas-classification-report.md`. Valider la différence `confirme` / `creation` / `demo` et les emplacements `unknown` / `approximate` / `illustrative` / `documented`.

**Ne jamais convertir un exemple en vérité géographique.** Claude peut conserver les données d'Atlas de Fléau comme références sans dupliquer les repères en dur dans LoreSmith. Toute carte, route, ou état de campagne ajouté par le MJ se conserve dans un overlay de campagne.
