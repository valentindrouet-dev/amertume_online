# Amertume Online

Première interface de table virtuelle pour les Héros du Cataclysme.

## Voir l’interface

Adresse prévue : https://valentindrouet-dev.github.io/amertume_online/

Dans **Settings → Pages → Build and deployment → Source**, sélectionner **GitHub Actions**. Le workflow `Publish Amertume Online` publie ensuite chaque modification de `main`. Si la première exécution a échoué avant l’activation de Pages, la relancer depuis Actions.

## Version 0.1

- Carte schématique et import local d’une image PNG/JPEG/WebP.
- Tokens déplaçables à la souris, au toucher et au clavier.
- Quatre combattants fictifs, PV ajustables et suivi manuel d’un état.
- Suivi manuel des dépenses d’activation par combattant.
- Réserve de sept catégories de dés ; affichage des résultats bruts.
- Tests de compétences : 4+ donne une réussite ; 6 donne une réussite et une relance.
- Journal de session.

Les caractéristiques et la scène sont des exemples, pas des données validées du jeu. Les jets d’attaque ne résolvent pas encore la DEF, les doubles, les critiques, les échecs ni les effets des couleurs. Les états ne modifient pas les caractéristiques. Pas de synchronisation multijoueur, de compte, ni de sauvegarde : recharger la page réinitialise la session. La carte importée reste sur l’appareil.

## Développement

Application statique autonome dans `index.html`, sans dépendance ni étape de compilation. Ouvrir ce fichier dans un navigateur moderne ou utiliser un serveur HTTP statique. GitHub Actions publie uniquement ce fichier, pas les documents du dépôt.
