# Carte du monde : lot 13, monde extensible et mers nommées (statut : validé)

## Ce qui change

- **Le monde s'agrandit au lieu d'entasser les cités.**
  - À la création ou au replacement d'une cité, si la place manque ou si une distance voulue sort du monde, le monde gagne une bande du bon côté, jusqu'à trois au besoin. Une bande fait 30 % du monde de départ, soit ~150 km d'est en ouest ou ~105 km du nord au sud pour un royaume.
  - Les boutons ⤢ Nord, Sud, Est et Ouest du panneau Monde agrandissent à la main.
  - Le relief est défini partout en km, donc rien de ce qui existe ne change : cités, forêts, montagnes et rivières restent à leur place sur le terrain. Le panneau annonce l'agrandissement.
  - Le climat garde les latitudes du monde de départ : s'agrandir vers le pôle donne des terres plus froides.
  - On n'agrandit jamais du côté d'une mer. Au-delà, ce sont d'autres continents, pour les voyages en mer à venir.
- **Positions recalées.** Quand les bornes changent, tout ce qui est gardé en coordonnées sur le plan monde est recalé pour ne pas bouger sur le terrain : le groupe, sa piste et ses haltes, les repères du MJ, les chemins parcourus du brouillard, le personnage du MJ et sa cachette.
- **Mers nommées.** Une mer reçoit un nom à sa création et peut être renommée. Le panneau liste les mers et leurs ports.
- **Suggestion pour un nouveau port.** Si une mer existe déjà, le panneau propose :
  > ⚓ Port-Sel est un port. La Mer de Vieuxpierre existe déjà : je peux l'installer sur sa côte, à environ 1 jour de marche à l'est de Havre-Gris. D'accord ?

  Les choix sont : Oui, sur cette mer ; Nouvelle mer (d'un côté libre) ; Je la place moi-même (la cité est posée, puis on clique sur la carte) ; Annuler.
  - Une fiche qui nomme une mer existante y installe son port directement.
  - Sans mer, le premier port en crée une, comme au lot 12.

## Vérifications

- Les tests montrent qu'agrandir le monde ne déplace ni cités, ni forêts, ni montagnes (en km), et ne change pas le climat d'une cité.
- Dans le navigateur :
  - la suggestion apparaît pour le deuxième port, et « Oui » le pose sur la côte de la mer existante ;
  - une cité voulue à 10 jours au nord de Brumeval fait grandir le monde vers le nord (500 × 455 km), sans erreur dans la console.

## Fichiers

- Modifiés :
  - `world/index.ts` : agrandissement, choix du port, recalage des positions, mer d'un port ;
  - `world/terrain.js` et `terrain.d.ts` : mer d'un côté imposé, écarts mesurés sur le monde de départ ;
  - `world/generate.js` et `generate.d.ts` : nom d'une mer ;
  - `world/WorldPanel.tsx` : boutons d'agrandissement, mers, carte de suggestion, annonce ;
  - `atlas/atlas.css` ;
  - `world.test.mjs` : un nouveau test.
- `src/App.jsx` et `src/store/persist.js` ne sont pas touchés.

## Limites

- Une forêt ou une montagne nommée tout au bord du monde peut voir son nom glisser vers la nouvelle bande, si la partie ajoutée est plus boisée ou plus haute.
- Les voyages en mer vers d'autres continents ne sont pas encore faits.
