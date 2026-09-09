# Amertume Online — v0.17

https://valentindrouet-dev.github.io/amertume_online/

Version 0.x jusqu’à demande explicite de Valentin de passer en v1.

## Publication
GitHub Pages : Deploy from a branch → main → / (root). Aucun build requis.

## Édition MJ
Sélectionner un combattant puis **Modifier la fiche**. Édition du nom, rôle/classe, PV, DEF, dégâts, XP, Vie/Endurance/bonus, niveau, compétences, type, taille, menace, notes, équipement, attaques et image de token. Le bouton de recalcul des PV est volontaire : le MJ peut aussi fixer directement le maximum. Rapide, Esquive, portée, effets et talents restent manuels. Un seul état simultané dans cette version.

Ajout de personnages/monstres et suppression de combattants (au moins un héros conservé). Les modèles du bestiaire peuvent être édités, copiés vers la carte et supprimés indépendamment de leurs copies. Une fiche de monstre peut être enregistrée au bestiaire. Le titre et le tour de la scène sont éditables.

## Catalogue importé
Source : `valentindrouet-dev/amertume_rpg`, branche `claude/elegant-planck-jp7ygb`, `js/store.js`, blob `5314d6439be28b47597a7c21b3df310b1501c8d1`.
14 armes, 5 armures/bouclier, 1 potion, 4 monstres d’exemple. Il s’agit des données embarquées, pas du contenu enregistré dans le navigateur du propriétaire ni d’une publication Firebase. Les couleurs des dés des armes étaient déjà marquées comme interprétations à valider dans le dépôt source.

L’armurerie permet création/édition/suppression. **L’équipement fait foi** : les dés d’attaque sont ceux des armes équipées, cumulés pour deux armes, et la DEF est celle de l’armure plus le bouclier. La réserve de dés n’est plus saisie à la main et le champ DEF se verrouille dès qu’une armure est portée. Un combattant sans arme équipée — les monstres du bestiaire — garde les dés de ses attaques de fiche et sa DEF propre. Les effets spéciaux, munitions et contraintes de mains ne sont pas automatisés.

## Images
Cartes et tokens : PNG, JPEG, WebP. Aperçu original/optimisé avec dimensions et poids, qualité 70–100 %, choix 2048/4096 pixels pour les cartes ou 256/512 pour les tokens. Proportions et transparence conservées, sans agrandissement. Compression WebP avec secours PNG ; original conservé s’il est plus léger et ne nécessite aucun redimensionnement. Seule la copie est utilisée. L’aperçu doit être actualisé après un réglage. Images animées non garanties : la compression produit une image fixe.

Garde-fous avant décodage : fichier de 25 Mo maximum, 64 millions de pixels maximum, 20 000 pixels maximum sur un côté. Ce sont des limites d’import, pas une garantie de mémoire disponible sur tous les appareils. Une image corrompue ou un échec de traitement affiche une erreur sans remplacer la carte/token courant.

## Sauvegarde
IndexedDB local conserve scène, combattants, catalogue modifié et images validées. Un message signale l’échec si le stockage est indisponible ou plein. L’effacement des données du site supprime cette sauvegarde. La publication Firebase (v0.08) partage le contenu du MJ, mais la partie jouée reste locale : ni synchronisation des dés, des déplacements ou des PV, ni compte joueur. Les vues MJ/joueur sont des interfaces locales et ne constituent pas une sécurité d’accès.

## Combat
Clic pour sélectionner ; **Maj + clic** pour cibler (ou sélecteur Cible). Maintenir Maj affiche une flèche dorée reliant le combattant actif au pointeur. Attaquer applique les dégâts, consomme l’Action et place dans le coma à 0 PV. Lancer libre ne modifie pas les PV.

## Portée et ligne de vue
La portée découle de l’arme : une arme à distance permet le tir sous condition de ligne de vue, toute autre arme impose le contact. Le combattant sélectionné affiche son **rayon de contact** : un disque translucide de trois tailles de token en diamètre. Une attaque de portée « contact » exige que le socle de la cible touche ce disque : le chevauchement visible suffit, le centre n’a pas besoin d’y tomber. Une attaque de portée « distance » exige une **ligne de vue** : le segment entre les deux tokens ne doit traverser ni un mur du plan, ni un autre combattant vivant. Le bouton Attaquer est désactivé et le motif est affiché sous la cible.

Les murs du plan schématique sont décrits une seule fois, en polygones, et servent à dessiner la carte, à couper la vue et à bloquer les déplacements : le dessin et les règles ne peuvent pas diverger. Un token poussé contre un mur s’arrête au contact et **glisse le long de l’obstacle** ; le déplacement avance par petits pas, de sorte qu’un geste rapide ne traverse pas un mur d’un bond. Une **carte importée n’a pas encore d’obstacles** — le plan est alors masqué et seuls les corps bloquent la vue ; un outil de tracé de murs reste à faire. La taille du socle (moyen, grand, énorme) reste descriptive et ne modifie pas encore le rayon.

Conventions provisoires : dés passant strictement la DEF, rouges/noirs sans DEF ; double 1 hors noirs prioritaire sur critique ; double 6 initial avec relance de la couleur choisie ; légers retirés avant doubles mystiques ; phases et mystiques comparés à la DEF sur valeur naturelle. Affaibli annule le bonus, Au sol retire la DEF et interdit l’attaque, Blindage absorbe une attaque réussie. Dés verts exclus des attaques. Portée, réactions, effets des talents et dégâts-choc manuels.

## Vérification
`node checks.cjs` : contrôles des dimensions PNG/JPEG/WebP, du catalogue source, des dégâts, de la lecture des champs de fiche, du rayon de contact et de la ligne de vue. Syntaxe JavaScript et références des ressources vérifiées. La v0.09 a été contrôlée dans Chromium : rayon de contact, ligne de visée, refus des attaques hors de portée ou sans ligne de vue, dés, barres de PV, rendu mobile et persistance après rechargement. La compression d’images et la publication Firebase n’ont pas été rejouées dans un navigateur pour cette livraison.

## v0.08 — Contenu partagé (activation Firebase requise)

Connexion MJ Google, publication du contenu local et republication automatique des modifications enregistrées après une première publication réussie. Lecture publique des catalogues et chargement de la scène avec le lien habituel. Images incluses ; publication complète limitée à 16 Mo. Les parties jouées restent locales.

Lire **FIREBASE-SETUP.md** pour la configuration unique de Firebase. La connexion GitHub ne permet pas d'activer le fournisseur Google ni de publier les règles Firestore. Le code est prêt, le partage n’est pas déclaré opérationnel avant cette configuration et un test à deux appareils.

## v0.09 — Portée, ligne de vue et habillage

Rayon de contact affiché autour du combattant sélectionné et exigé pour les attaques de contact ; ligne de vue exigée pour les attaques à distance. Ciblage passé de Commande/Ctrl à **Maj**, avec flèche de visée dorée suivant le pointeur. Dés redessinés en faces arrondies avec bandeau de résultat et pastille « + N dégâts ». Barres de PV pleines affichant « X / Y PV » à l’intérieur, vertes pour les héros et ambrées pour les adversaires, dans la liste des combattants comme dans la fiche.

## v0.10 — Aura solidaire du token

Le rayon de contact suit le token pendant le glisser, dans le même rafraîchissement : il n’est plus repositionné seulement au relâchement. Le glisser d’un autre combattant ne déplace pas l’aura du combattant sélectionné. Écart mesuré à 0 pixel pendant tout le déplacement, contre 259 pixels au maximum en v0.09.

## v0.11 — Contact au socle

Le contact était refusé tant que le centre de la cible n’entrait pas dans le disque, alors qu’un socle largement chevauchant se lit comme un contact. La cible est désormais à portée dès que son socle touche le disque, ce qui correspond au rendu à l’écran et à la règle « petit rayon autour du socle » du corpus.

## v0.12 — Murs, dés sur la carte et journal de combat

Les murs du plan coupent la ligne de vue des attaques à distance, et l’interface nomme l’obstacle : un mur ou le combattant traversé. Le plan est dessiné à partir de la même liste de polygones que celle utilisée pour le calcul.

Les jets d’attaque et les lancers libres font rouler les dés sur la carte : ils partent de l’attaquant, culbutent en changeant de face, puis se posent à côté des combattants sans les masquer. L’animation est supprimée si le système demande un mouvement réduit.

Le journal devient un journal de combat chronologique : séparateurs de tour, noms colorés par combattant, dégâts et états mis en valeur, et un dé marquant les entrées issues d’un jet. L’heure de chaque entrée reste en infobulle.

## v0.13 — L’équipement décide

L’arme équipée confère ses dés de dégâts, qui ne sont plus choisis : la réserve affichée est en lecture seule et indique son origine. Deux armes cumulent leurs dés. Une arme à distance donne le tir avec ligne de vue et masque le rayon de contact, au profit d’une ligne de tir permanente vers la cible, verte si le tir passe et rouge s’il est coupé. L’armure et le bouclier donnent la DEF, et le champ correspondant se verrouille dans la fiche.

Les murs bloquent aussi les déplacements : le socle s’arrête au contact et glisse le long du mur, sans pouvoir le franchir même d’un geste rapide.

La scène de démonstration part équipée — Éla à l’épée et en mailles, Kaël à l’arc — afin que ces règles soient visibles dès l’ouverture. Toute partie enregistrée conserve son propre équipement.

## v0.14 — Fiches, partage et réserve

La réserve de dés n’est plus affichée : l’arme la détermine, et une ligne sous le titre rappelle son origine et sa portée.

Le contenu partagé quitte la page pour une fenêtre, ouverte par le bouton **Partager** de l’en-tête. Un point ambre sur ce bouton signale qu’une version partagée est disponible.

Les fiches de héros et d’adversaires reprennent la maquette fournie : bandeau de classe teinté par combattant, chips d’identité (sexe, peuple, niveau, portée), tuiles de caractéristiques colorées — Vie, Endurance, PV, DEF en écu, Dégâts pour les héros ; PV, DEF, Dégâts, XP pour les adversaires — et compétences en pastilles teintées avec leur bonus. La fiche MJ gagne les champs Sexe, Peuple et Vie maximale.

## v0.15 — Éditeur de cartes de combat

Un éditeur dédié crée autant de cartes que voulu, chacune avec son image de fond optimisée comme les autres imports.

**Zones de blocage** : des rectangles tracés à la souris, déplaçables et redimensionnables par leurs quatre coins. Elles coupent la vue et le passage. À l’écran de jeu, les rectangles qui se chevauchent se fondent en une seule zone semi-transparente ; dans l’éditeur ils restent distincts pour rester modifiables. La fusion est visuelle : chaque rectangle est testé individuellement, le résultat est le même.

**Portes** : mêmes tracé et redimensionnement, avec un état ouvert ou fermé. Fermée, une porte bloque la vue et le passage comme un mur, et l’interface la nomme (« ligne de vue bloquée par une porte fermée »). Ouverte, elle laisse tout passer. En jeu, le MJ ouvre ou ferme une porte d’un clic dessus.

**Zone de départ** : une par carte. À l’ouverture de la carte, les héros y sont regroupés en grille, sans jamais sortir de ses bords.

**Adversaires pré-placés** : choisis dans le bestiaire et posés sur la carte, chacun avec un statut **visible ou invisible à l’ouverture**. Un adversaire invisible n’apparaît pas du tout en vue joueur, ne peut pas être ciblé depuis cette vue, et s’affiche au MJ en pointillés estompés. Chaque adversaire est une copie indépendante du modèle : modifier le bestiaire ensuite ne change pas les cartes.

**En combat**, un sélecteur choisit la carte et le bouton **Ouvrir la carte** l’applique après confirmation : l’image devient le fond, les obstacles de la carte remplacent le plan schématique, les héros rejoignent la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.

Les cartes sont enregistrées avec la partie (format interne passé en version 8, les sauvegardes en version 7 sont reprises sans perte) et publiées avec le contenu partagé.

## v0.16 — L’éditeur passe en onglet pleine page

L’éditeur quittait une fenêtre trop étroite pour travailler. Le site a désormais deux onglets dans l’en-tête, **Table de jeu** et **Cartes** ; le second n’apparaît qu’en vue MJ et bascule automatiquement vers la table si l’on passe en vue joueur.

La page occupe toute la largeur : liste des cartes à gauche, plan de travail au centre, propriétés de la forme sélectionnée et légende à droite. Le plan de travail conserve le rapport d’écran de la carte de jeu et occupe la hauteur disponible.

Les contrôles ne se chevauchent plus, et chaque outil porte la couleur de la forme qu’il trace : ardoise pour les zones de blocage, ambre pour les portes, vert pour la zone de départ, rouge pour les adversaires. L’outil actif est rempli de sa couleur.

## v0.17 — Zoom, zones de vision, annulation et verrouillage

**Zoom** sur la carte de jeu comme dans l’éditeur : le pincement du trackpad (que le système envoie en molette + ctrl), les boutons − / + et **Ajuster**, jusqu’à ×8. Une fois zoomé, le défilement à deux doigts déplace la vue, et on peut aussi la faire glisser à la souris depuis une zone vide. Seul l’affichage est transformé : les positions restent en pourcentages, donc portées, lignes de vue et collisions sont inchangées.

**Zones de vision** : tracées à l’intérieur d’une zone de blocage, elles y **creusent une ouverture** — vue et passage rétablis, comme si l’on grattait le fromage. La découpe est exacte : chaque rectangle de blocage moins les zones de vision donne un pavage de rectangles, utilisé tel quel pour le dessin et pour les règles. Ce qui s’affiche est donc exactement ce qui bloque. Une porte fermée n’est jamais creusée : elle reste une porte, avec son état propre.

**Annulation** par ⌘Z ou Ctrl+Z, rétablissement par ⇧⌘Z, plus deux boutons dans la barre. L’historique couvre tracés, déplacements, redimensionnements, suppressions, verrouillages, portes et images ; il porte sur la carte en cours d’édition.

**Sélection et verrouillage** : un clic simple sur une forme existante la sélectionne même quand un outil de dessin est actif, et repasse l’éditeur en Sélection — tracer reste possible en glissant. Chaque forme peut être verrouillée par le cadenas du panneau de droite : elle reste sélectionnable, mais ne peut plus être déplacée, redimensionnée ni supprimée tant qu’on ne la déverrouille pas.
