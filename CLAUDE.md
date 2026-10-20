# Consignes de travail

Avant toute modification d'interface (bulle, bouton, cartouche, couleur, texte affiché), lire **CHARTE.md** et s'y conformer. Les contrôles de `checks.cjs` (§ 13 de la charte) font échouer la publication en cas d'écart.

Toute modification d'une règle du jeu (dés, attaque, dégâts, états, espèces, classes, talents, adversaires, objets, exploration) met à jour, dans la même version, la page **Règles** : `regles.js`. Ce qui se lit dans le moteur (états, espèces, classes, dés…) s'y affiche tout seul ; le texte écrit à la main (`REGLES_DES`, `REGLES_ETATS`, `REGLES_SECTIONS`) se corrige à chaque changement.
