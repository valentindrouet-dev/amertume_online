# Amertume Online — v0.2

https://valentindrouet-dev.github.io/amertume_online/

## Publication
Settings → Pages → Deploy from a branch → main → / (root).

## Utilisation
- Vue MJ : contrôle tous les combattants, ajuste les PV et états, importe la carte et avance les tours.
- Vue joueur : choisir un héros de démonstration et contrôler celui-ci. Les PV adverses sont masqués.
- Clic pour sélectionner ; Commande-clic sur Mac ou Ctrl-clic sur Windows pour cibler un adversaire. Le sélecteur Cible fonctionne aussi au clavier et sur mobile.
- Configurer la réserve puis Attaquer : dégâts appliqués aux PV, Action consommée et coma à 0 PV.
- Les lancers libres ne modifient pas les PV.

## Conventions provisoires
Seuls les dés passant strictement la DEF contribuent. Rouges/noirs ignorent la DEF et permettent le bonus de dégâts. Échec initial sur deux 1 hors noirs, prioritaire sur critique. Deux 6 initiaux déclenchent un dé supplémentaire de la couleur choisie ; ses 6 explosent. Les dés supplémentaires comptent pour les doubles, sans nouvel échec. Légers retirés avant les doubles mystiques. Phase et mystiques utilisent leur valeur naturelle contre la DEF. Affaibli annule le bonus, Au sol retire la DEF et interdit l'attaque, Blindage absorbe une attaque réussie. Les verts ne sont pas acceptés dans une attaque.

Portée, dégâts-choc, réactions et autres talents non automatisés. États uniques dans cette version. Données fictives. Vues locales de démonstration, pas des autorisations sécurisées : pas de comptes, de synchronisation multijoueur ni de sauvegarde. Recharger réinitialise la partie.

## Vérification
Syntaxe JavaScript vérifiée et dix cas déterministes du moteur de combat testés (DEF, double 1, noirs, rouges, légers/mystiques, phase, critique, refus des soins). Pas de test visuel navigateur effectué.
