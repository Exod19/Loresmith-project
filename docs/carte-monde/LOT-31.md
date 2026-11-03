# Lot 31 : la nuit et l'effraction (lot D du monde vivant)

La nuit, la fiche (MJ) d'un bâtiment de cité propose une effraction en trois temps (`BreakInBox.tsx`, règles dans
`src/maps/world/effraction.js`). Chaque bâtiment porte maintenant sa nature et son quartier (`AtlasFeature.batiment`).

1. **La porte.** Verrouillée la nuit, sauf une taverne ou une auberge, qui veillent.
   - Crocheter : Dextérité (outils de voleur), une minute.
   - Forcer : Force (Athlétisme), DD + 2, un round, mais bruyant (+ 5 à la Discrétion ensuite).

   | Bâtiment | DD |
   |---|---|
   | Ferme, écurie | 10 |
   | Maison, taverne | 12 |
   | Échoppe, atelier, forge, temple | 13 |
   | Entrepôt | 14 |
   | Guilde, manoir | 15 |
   | Caserne | 16 |
   | Château | 18 |

   Le quartier ajuste le DD : château et haute-ville + 2, faubourg − 1, fermes − 2.

2. **La Discrétion.** Le plus bas jet du groupe.
   - DD : 10, + 2 par dormeur (+ 8 au plus), + 3 pour un chien, + 5 si la porte a été forcée.
   - Un veilleur éveillé (garde de guilde, veilleur d'entrepôt, gardes de caserne et de château) : DD 15 + 2 par
     veilleur.
   - Les occupants viennent de l'intérieur déjà généré pour la nuit, s'il l'a été ; sinon, une estimation stable tirée
     du bâtiment.

3. **Le réveil.** Un échec réveille une personne ; un échec de 5 ou plus, tout le monde. Chacun réagit selon qui il est :

   | Qui | Réaction |
   |---|---|
   | Garde, soldat | dégaine et donne l'alerte |
   | Enfant | pleure et réveille toute la maison |
   | Tavernier, forgeron, fermier | prend une arme de fortune et crie au voleur |
   | Marchand, noble, domestique | appelle la garde |
   | Prêtre | demande qui va là |
   | Les autres | crient, ou se cachent sous la couverture |

   Le chien aboie. Si quelqu'un crie, la garde arrive :

   | Quartier | Qui arrive | Délai |
   |---|---|---|
   | Château | la garde du château | 1d4 rounds |
   | Haute-ville | une patrouille du guet | 1d6 + 1 rounds |
   | Ville, marché | une patrouille du guet | 2d6 rounds |
   | Faubourg | une patrouille du guet | 3d6 rounds |
   | Hors des murs | les voisins | 2d10 rounds |

- **Mémoire du monde** : l'effraction s'inscrit d'elle-même. Gravité 1 si personne n'a rien vu, 2 si quelqu'un s'est
  réveillé, 3 s'il y a eu lutte ou si la garde est venue. Les réveillés sont les PNJ touchés. Ses suites (lot C) suivent :
  serrure changée, rondes renforcées à valider, rumeur.
- **Temps** : crocheter 1 min, forcer 1 round, entrer et fouiller 10 min.

## Tests

`effraction.test.mjs` : serrures selon le moment, le bâtiment et le quartier ; DD de Discrétion ; réactions et garde ;
occupants connus ou estimés ; l'événement inscrit ; article devant un rôle.
