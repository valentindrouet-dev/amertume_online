# Amertume Online — v0.87

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

L’armurerie permet création/édition/suppression, **pour les aventuriers comme pour les adversaires** (v0.73). Ce qui est porté donne **des attaques de plus**, à côté de celles de la fiche (v0.74) : une arme à deux mains — toute arme à distance l’est — vaut une attaque à elle seule, avec sa portée ; les armes à une main se tiennent ensemble et n’en font qu’une, dés cumulés, la même arme comptant deux fois si elle est portée en double (v0.69). La DEF d’un aventurier est celle de l’armure plus le bouclier, zéro compris, champ verrouillé ; celle d’un adversaire lui est propre et son équipement s’y ajoute. Les effets spéciaux, munitions et contraintes de mains ne sont pas automatisés.

## Images
Cartes et tokens : PNG, JPEG, WebP. Aperçu original/optimisé avec dimensions et poids, qualité 70–100 %, choix 2048/4096 pixels pour les cartes ou 256/512 pour les tokens. Proportions et transparence conservées, sans agrandissement. Compression WebP avec secours PNG ; original conservé s’il est plus léger et ne nécessite aucun redimensionnement. Seule la copie est utilisée. L’aperçu doit être actualisé après un réglage. Images animées non garanties : la compression produit une image fixe.

Garde-fous avant décodage : fichier de 25 Mo maximum, 64 millions de pixels maximum, 20 000 pixels maximum sur un côté. Ce sont des limites d’import, pas une garantie de mémoire disponible sur tous les appareils. Une image corrompue ou un échec de traitement affiche une erreur sans remplacer la carte/token courant.

## Sauvegarde
IndexedDB local conserve scène, combattants, catalogue modifié et images validées. Un message signale l’échec si le stockage est indisponible ou plein. L’effacement des données du site supprime cette sauvegarde. La publication Firebase (v0.08) partage le contenu du MJ, mais la partie jouée reste locale : ni synchronisation des dés, des déplacements ou des PV, ni compte joueur. Les vues MJ/joueur sont des interfaces locales et ne constituent pas une sécurité d’accès.

## Combat
Clic pour sélectionner ; **Maj + clic** pour cibler (ou sélecteur Cible). Maintenir Maj affiche une flèche dorée reliant le combattant actif au pointeur. Attaquer applique les dégâts et place dans le coma à 0 PV. Depuis la v0.72 aucune limite d’activation n’est imposée : le MJ les fixe lui-même, et le compteur Action / Mvt-Analyse / Objet est masqué. Lancer libre ne modifie pas les PV.

## Portée et ligne de vue
La portée découle de l’arme : une arme à distance permet le tir sous condition de ligne de vue, toute autre arme impose le contact. Le combattant sélectionné affiche son **rayon de contact** : un disque translucide de trois tailles de token en diamètre. Une attaque de portée « contact » exige que le socle de la cible touche ce disque : le chevauchement visible suffit, le centre n’a pas besoin d’y tomber. Une attaque de portée « distance » exige une **ligne de vue** : le segment entre les deux tokens ne doit traverser ni un mur du plan, ni un autre combattant vivant. Le bouton Attaquer est désactivé et le motif est affiché sous la cible.

Les murs du plan schématique sont décrits une seule fois, en polygones, et servent à dessiner la carte, à couper la vue et à bloquer les déplacements : le dessin et les règles ne peuvent pas diverger. Un token poussé contre un mur s’arrête au contact et **glisse le long de l’obstacle** ; le déplacement avance par petits pas, de sorte qu’un geste rapide ne traverse pas un mur d’un bond. Une **carte importée n’a pas encore d’obstacles** — le plan est alors masqué et seuls les corps bloquent la vue ; un outil de tracé de murs reste à faire. La taille du socle (moyen, grand, énorme) reste descriptive et ne modifie pas encore le rayon.

Conventions provisoires : dés passant strictement la DEF, rouges/noirs sans DEF ; double 1 hors noirs prioritaire sur critique ; double 6 initial avec relance de la couleur choisie ; légers retirés avant doubles mystiques ; phases et mystiques comparés à la DEF sur valeur naturelle. Affaibli annule le bonus, Au sol retire la DEF et interdit l’attaque, Blindage absorbe une attaque réussie. Dés verts exclus des attaques. Portée, réactions, effets des talents et dégâts-choc manuels.

## Vérification
`node checks.cjs` : contrôles des dimensions PNG/JPEG/WebP, du catalogue source, des dégâts, de la lecture des champs de fiche, du rayon de contact et de la ligne de vue. `node shared-checks.cjs` contrôle le format de publication ; `node id-checks.cjs` refuse deux éléments portant le même identifiant. Syntaxe JavaScript et références des ressources vérifiées. La v0.09 a été contrôlée dans Chromium : rayon de contact, ligne de visée, refus des attaques hors de portée ou sans ligne de vue, dés, barres de PV, rendu mobile et persistance après rechargement. La compression d’images et la publication Firebase n’ont pas été rejouées dans un navigateur pour cette livraison.

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

**Zones de vision** (remplacées en v0.18 par l’outil Découper) : tracées à l’intérieur d’une zone de blocage, elles y **creusaient une ouverture** — vue et passage rétablis, comme si l’on grattait le fromage. La découpe est exacte : chaque rectangle de blocage moins les zones de vision donne un pavage de rectangles, utilisé tel quel pour le dessin et pour les règles. Ce qui s’affiche est donc exactement ce qui bloque. Une porte fermée n’est jamais creusée : elle reste une porte, avec son état propre.

**Annulation** par ⌘Z ou Ctrl+Z, rétablissement par ⇧⌘Z, plus deux boutons dans la barre. L’historique couvre tracés, déplacements, redimensionnements, suppressions, verrouillages, portes et images ; il porte sur la carte en cours d’édition.

**Sélection et verrouillage** : un clic simple sur une forme existante la sélectionne même quand un outil de dessin est actif, et repasse l’éditeur en Sélection — tracer reste possible en glissant. Chaque forme peut être verrouillée par le cadenas du panneau de droite : elle reste sélectionnable, mais ne peut plus être déplacée, redimensionnée ni supprimée tant qu’on ne la déverrouille pas.

## v0.18 — La carte prend le cadrage de son image

**Correction de fond.** Les coordonnées sont des pourcentages de la zone d’affichage, mais l’image était affichée en `cover` sur la table — rognée et recadrée selon la largeur de la fenêtre — et en `contain` dans l’éditeur. Le même pourcentage ne désignait donc pas le même point de l’image d’un écran à l’autre : la carte apparaissait tronquée et les zones tombaient à côté.

Désormais la carte **adopte le rapport de son image**, dans l’éditeur comme sur la table, et l’image la remplit exactement. Un pourcentage vise toujours le même point du plan. Vérifié à 1500, 1024 et 810 pixels de large : une zone tracée à 30 % / 23 % reste à 30 % / 23 %, et la carte entière est visible. La hauteur est plafonnée à 72 % de la fenêtre pour les plans très hauts, la carte restant alors centrée.

**Outil Découper** à la place des zones de vision. Le tracé creuse directement une ouverture définitive dans les zones de blocage : ce que montre l’éditeur est exactement ce qui bloque, sans couche intermédiaire. Une zone verrouillée résiste à la découpe. Les cartes contenant d’anciennes zones de vision sont converties au chargement, sans perte.

**Touche Suppr ou Retour arrière** pour effacer la forme sélectionnée, sauf si elle est verrouillée.

**Dézoom** possible jusqu’à 40 % sur la carte comme dans l’éditeur ; sous 100 %, la vue est centrée.

## v0.19 — Brouillard de guerre

Sur une carte de combat, ce que le groupe n’a pas vu est noir. Seuls les **héros vivants** éclairent : la visibilité est calculée par ligne de vue depuis chaque héros, coupée par les zones de blocage et par les **portes closes**. Ouvrir une porte ouvre le champ de vision au travers, ce qui donne le cône caractéristique dans l’embrasure.

Trois états : noir pour l’inexploré, voilé pour ce que le groupe a déjà vu mais ne voit plus, dégagé pour ce qu’il voit à l’instant. La mémoire d’exploration appartient à la carte et se remet à zéro à chaque ouverture en combat. Le MJ voit la même chose en beaucoup plus clair, afin de garder une carte lisible tout en sachant ce que voient ses joueurs. Deux boutons MJ permettent de réinitialiser le brouillard ou de tout révéler.

**Un adversaire dans le noir n’existe pas pour les joueurs** : il disparaît de la vue joueur et de la liste des cibles, et s’affiche au MJ en pointillés estompés, comme les adversaires marqués invisibles.

Le calcul se fait sur une grille de 104 × 58 cellules, soit moins d’une milliseconde sur une carte simple, et la grille est adoucie à l’affichage.

**Portes** : elles n’ont plus d’état dans l’éditeur, seulement en partie. Une carte s’ouvre toujours portes closes, et c’est le MJ qui les ouvre d’un clic pendant le combat.

**Taille des tokens** : elle est désormais une fraction de la largeur de la carte, et non plus un nombre de pixels fixe. Un adversaire a donc la même taille relative dans l’éditeur et en partie, à toute largeur de fenêtre et à tout niveau de zoom — écart mesuré à 0,2 %, soit l’arrondi du pixel. Le rayon de contact suit la même échelle.

## v0.21 — Découpe libre, portes perçantes, tokens repoussés

**Les portes percent le mur qu’elles recouvrent.** Poser une porte sur une zone de blocage y creuse son empreinte, si bien que l’ouverture est nette : porte close, la vue est coupée ; porte ouverte, elle passe, et seulement là. Le percement se refait si la porte est déplacée ou redimensionnée ; l’ancienne ouverture reste, à reboucher avec une zone de blocage si besoin.

**Découpe libre** pour les formes rondes ou irrégulières. Un glisser trace le contour à main levée ; une suite de clics le construit point par point. Entrée ou un clic sur le premier point ferme le tracé et creuse, Échap l’abandonne.

Le tracé est converti en rectangles : la zone concernée est rastérisée, l’intérieur du contour effacé, puis recomposée en bandes fusionnées. Tout le moteur — vue, collisions, brouillard — continue donc de travailler sur des rectangles, sans cas particulier. Le pas de découpe est de 0,6 % de la carte : un disque creusé garde son aire à moins de 2 % près.

Le brouillard a été optimisé au passage pour absorber ces découpes : test direct segment contre rectangle avec rejet par boîte englobante, au lieu d’un parcours arête par arête. Sur une carte à 141 morceaux, le calcul passe de 47 à 5,5 millisecondes.

**Déplacements.** Le MJ traverse les murs en tenant un token ; les joueurs en sont empêchés et glissent le long de l’obstacle. Dans tous les cas, **un token ne reste jamais dans une zone de blocage ni à cheval dessus** : il en est repoussé au relâchement, et les adversaires pré-placés le sont aussi à l’ouverture de la carte.

## v0.87 — Le tour appelle la suite

**Le socle descend sous ses pastilles.** Elles le touchaient ; il passe quatre pixels plus bas, elles ne bougent pas d’un cheveu — cinq pixels d’air entre les deux, la ligne inchangée.

**Le bloc du tour de combat se tient droit.** L’intitulé et le numéro partagent le même corps, la même graisse et la même police, sur une seule ligne, le numéro au bout. Les trois boutons ont la même hauteur de 40 pixels, la même graisse, et dix pixels les séparent — horizontalement comme verticalement. « Adversaires à 100 % » ne colle plus à « Tour suivant ».

**Tour suivant appelle quand le tour est épuisé.** Dès que plus un seul combattant debout ne garde son Action — c’est-à-dire dès qu’aucune pastille bleue ne reste allumée dans la liste —, le bouton se met à battre doucement dans l’ambre du bloc. Un combattant dans le coma ne retient pas le tour. Le battement s’éteint au tour suivant, quand les activations repartent. Si l’appareil demande des animations sobres, le bouton s’entoure d’un halo fixe plutôt que de clignoter.

## v0.86 — Deux pastilles, un lot, et le temps de lire les dégâts

**Le chiffre des dégâts se lit deux fois plus longtemps.** Il monte aussi vite qu’avant — c’est ce qui attire l’œil — puis **se tient en l’air** avant de s’effacer : 2,5 secondes au lieu de 1,25, dont plus d’une seconde et demie à pleine lisibilité. L’allure vit maintenant sur le premier segment seulement ; appliquée à tout le trajet, elle avalait le palier et le chiffre pâlissait bien avant la fin.

**Un lot reçoit tout ce qu’on lui donne.** Deux combattants pris ou plus, et les **points de vie** comme les **états** portent sur tout le lot : −5 retire cinq points à chacun, *Mort* les couche tous, *Soin* les remplit tous — chacun avec son propre écart, calculé sur ses propres PV. Un état posé depuis le socle de l’un d’eux se pose sur tous, et se lève de même : la décision se prend sur le socle visé et vaut pour le lot. Un socle qui n’est pas du lot ne reçoit que pour lui. Le bandeau des PV annonce « 3 combattants pris » au lieu d’un nom.

**Deux pastilles sur la vignette.** Au-dessus à gauche de chaque languette, un point **bleu** et un point **marron** : l’Action et le Mouvement qu’il reste. Le bleu s’éteint quand le combattant a agi — une attaque —, le marron quand il s’est déplacé, au glissement comme aux flèches du clavier. La vignette descend de quatre pixels pour leur faire place, sans grandir ni pousser la ligne. Les deux points reviennent au tour suivant, comme les activations.

## v0.85 — Deux combattants ne partagent plus un identifiant

En cherchant pourquoi une Analyse semblait toucher toute une espèce, j’ai trouvé autre chose : **le bouton ⧉ Dupliquer laissait à la copie l’identifiant de l’original**. Or la sélection, le marquage et le comptage des homonymes travaillent sur les identifiants, jamais sur les rangs — c’est ce qui permet de retirer un combattant sans que tout se décale. Deux combattants du même identifiant étaient donc **pris ensemble** : marquer l’un marquait l’autre, et les déplacer aussi depuis la v0.80.

La copie reçoit maintenant le sien, et **une session ouverte se répare d’elle-même** : à l’ouverture comme au chargement de la sauvegarde, tout identifiant manquant ou déjà vu est remplacé. Mesuré sur une session fautive : marquer un combattant en prenait trois, il n’en prend plus qu’un.

L’Analyse, elle, reste individuelle — vérifié sur six chemins : le geste sur le socle, le bouton Analyser, la sauvegarde et son rechargement, la vue joueur, la propagation d’un modèle du bestiaire, et jusque sur des combattants qui partageaient un identifiant. Un seul adversaire est analysé à la fois.

## v0.84 — La frontière de l’exploré ne monte plus en escalier

**Le crénelage restant venait de la mémoire, pas de la vue.** Le champ vu est un polygone tracé au trait depuis la v0.25 : ses bords sont nets à tout niveau de zoom. Mais **ce que la troupe a exploré** est une grille de bits — 640 colonnes — et cette grille était agrandie jusqu’à l’écran *sans interpolation*, avec en prime un `image-rendering: pixelated` sur la toile du brouillard. D’où l’escalier sur le noir des zones non repérées, d’autant plus gros que la carte est zoomée : à 2,6 ×, des marches de dix pixels.

La mémoire est désormais **interpolée et fondue sur un peu moins d’une case** : la frontière de l’exploré devient un dégradé, ce qu’elle est en vérité — on ne se souvient pas d’une salle au bit près. Le champ vu, lui, ne doit rien à ce lissage et garde ses arêtes franches. Vérifié sur une frontière oblique tracée à la main dans la grille : escalier de dix pixels avant, droite propre après, à 1 × comme à 2,6 ×.

## v0.83 — Le fil de matière dans l’embrasure

**Une porte ouverte pouvait ne rien ouvrir du tout.** Une porte perce la zone de blocage qu’elle recouvre — mais seulement son propre rectangle. Or on ne trace jamais une porte pile d’un bord à l’autre du mur : il en restait dans l’embrasure **un fil de matière large d’un cheveu**, invisible à l’écran et parfaitement opaque. La porte s’ouvrait, se dessinait ouverte, et personne ne voyait au travers : l’adversaire planté juste derrière restait « hors de vue de la troupe », sans qu’aucune règle visible l’explique. Un reste de deux dixièmes de pour cent suffisait.

Désormais **une porte perce le mur qu’elle recoupe sur toute son épaisseur**, c’est-à-dire par son petit côté, quelle que soit la façon dont elle a été tracée — trop étroite, décalée, à cheval. Close, elle rebouche exactement ce qu’elle avait percé : le trou et le bouchon sont la même géométrie. Un gros bloc n’est pas percé de part en part pour autant : on ne prolonge que si l’épaisseur reste de l’ordre de la porte. Six tracés bâclés qui aveuglaient tous la troupe passent maintenant, et les portes closes bloquent toujours.

**Le nom de la carte** s’écrit en Killam, tel qu’il a été saisi, sans passer en capitales.

**La languette d’un combattant invisible ne dit plus rien sous son nom** : le liseré bleu du socle suffit.

## v0.82 — Invisible est un état, et lâcher est un geste

**Reposer la sélection.** Un clic sur le décor de la carte, hors de tout socle, repose ce qui était pris — le geste qu’on fait sans y penser. **Échap** fait la même chose, à condition d’être sur la table de jeu, aucune fenêtre ouverte et aucun champ en cours de saisie ; ailleurs il continue d’appartenir à la page ouverte (le lasso de l’éditeur de cartes, la fermeture d’un menu). Le cadre vide, qui levait déjà la sélection, passe par la même règle, et n’écrit plus rien au journal : celui-ci n’a pas à tenir le compte des clics.

**Invisible devient un état.** Il rejoint le menu des états, entre Gel et Onde. Un combattant invisible n’apparaît que sur deux écrans : celui du MJ et celui du joueur qui le tient. Les autres n’en voient rien — ni socle, ni languette, ni cible désignable. Le MJ, lui, le voit pâli d’un liseré bleu pointillé, distinct de ses deux autres voiles (l’orange « hors de vue de la troupe », le violet « caché par toi »), avec la mention *invisible aux autres écrans* sous son nom. Une Onde ne l’absorbe ni ne le purge : l’invisibilité n’est pas une affection.

**L’éditeur de cartes ne pose plus d’adversaires invisibles.** La case « Invisible à l’ouverture » disparaît : l’invisibilité se donne en jeu, comme les autres états. Une carte tracée avant cette version garde ses invisibles — ils reçoivent l’état à l’ouverture de la carte.

## v0.81 — Les portées suivent la sélection

**Le disque de contact appartient aux combattants pris, et à eux seuls.** La v0.80 l’avait donné à toute la troupe en permanence : trop de disques, la carte devenait illisible. Il revient donc au ou aux socles sélectionnés — mais **toujours**, quelle que soit l’attaque retenue, un archer comme un porteur de rapière : c’est ce qu’il faut lire pour les contacts et les attaques d’opportunité. Tout un lot montre le sien, tous à égalité. Le bouton Portées les éteint toujours d’un coup.

## v0.80 — Portées permanentes, et les lots

**Le rayon de contact ne dépend plus de l’attaque retenue.** Il s’effaçait dès qu’on retenait une attaque à distance. Cette version l’avait rendu permanent pour toute la troupe : c’était trop, la carte se couvrait de disques (corrigé en v0.81).

**Un bouton Portées** dans la barre de la carte les éteint et les rallume d’un clic, quand le décor prime sur les règles. Il est allumé par défaut et son état est gardé sur l’appareil, comme le thème.

**Un lot se déplace d’un bloc.** Plusieurs combattants pris — au raccourci ou au cadre de sélection — **portent tous le halo de sélection**, et non plus le seul actif : sur la carte, tous les pris se ressemblent. Prendre l’un d’eux les déplace **tous**, du même écart ; ceux qui restent hors du lot ne bougent pas, et le lot reste pris au relâchement. Le cerceau pointillé qui marquait le groupe a disparu des socles, faisant double emploi avec le halo ; il reste dans la liste des combattants.

**La carte des Actions se tait sur un lot.** Deux combattants ou plus sélectionnés : elle n’affiche plus que « Plusieurs combattants sélectionnés ». Ni cibles, ni boutons d’attaque, ni Analyse — une attaque part d’un combattant, pas d’un groupe.

## v0.79 — L’actif se voit toujours

**L’aura n’était pas une sélection, c’était une portée.** Le disque vert autour du combattant actif est le **rayon de contact** : il ne paraît que si l’attaque retenue est au contact, et disparaît dès qu’on retient une attaque à distance — un arc, un sort — puisqu’il n’y a alors plus de rayon à montrer. Comme rien d’autre ne marquait l’actif sur la carte, sélectionner un archer donnait l’impression que le clic n’avait pas pris.

Le socle actif porte donc maintenant **son propre halo**, un liseré clair et une lueur à sa couleur de camp, quelle que soit l’attaque retenue. Le grand disque, lui, garde son sens : il dit une portée de contact, pas une sélection.

## v0.78 — Un passage secret qui se tait

**Le passage secret se trahissait, et de trois façons.** Une porte perce la zone de blocage qu’elle recouvre — c’est ce qui en fait un passage. Un passage secret la perçait donc lui aussi : il fallait d’abord tracer une porte, qui trouait le mur, avant de la déclarer secrète. Le trou restait, bien visible. Pire, le brouillard rendait à chaque rectangle de porte la clarté de ses abords — pour qu’une porte découverte reste lisible dans la pénombre — et dessinait ainsi une plaque grise en plein mur noir, à l’endroit exact du passage.

Désormais **un passage secret ne perce la matière qu’une fois ouvert**. Tant qu’il est clos, le mur est plein : pour le tracé comme pour le dessin, pour la troupe comme pour le MJ. Le brouillard, lui, ne lui rend plus la clarté des portes tant qu’il est caché : c’est du mur, le mur reste dans l’ombre. Le MJ le devine au seul trait violet posé sur la matière pleine. Ouvert, il redevient une porte comme une autre, trou compris.

**Un outil dédié.** « Passage secret » prend sa place dans la barre de l’éditeur, entre Porte et Zone de départ : on le trace à même le mur, il naît secret et clos. La case à cocher reste dans le panneau de droite pour convertir une porte déjà tracée dans un sens ou dans l’autre.

**Glisser un modèle jusqu’à sa place.** Dans « Ajouter un adversaire » — et dans « Placer un aventurier » —, on peut désormais **glisser une languette jusqu’à la carte** et lâcher le modèle exactement où on le veut. La fenêtre se referme dès que le geste part, sinon elle masque justement l’endroit visé ; un jeton fantôme suit le doigt et pâlit hors de la carte. Un simple clic continue de poser au centre.

**La carte des Actions, suite.** Les cibles à portée passent directement sous l’intitulé : la réserve de dés affichée seule faisait doublon avec les dés que chaque bouton porte déjà. Et le bonus de dégâts se lit maintenant contre l’intitulé, non plus repoussé à l’autre bout de la carte.

## v0.77 — Les Actions frappent

**La carte des Actions.** L’intitulé « Attaque » devient **ACTIONS**, en Killam gras dans le bleu des Actions, et le bonus de dégâts se lit à sa droite. La carte se lit désormais de haut en bas dans l’ordre où l’on s’en sert : l’intitulé et le bonus, la réserve de dés, les cibles à portée, puis les Actions elles-mêmes.

**Un bouton par attaque, et ce bouton frappe.** Les boutons d’armes et d’attaques ne servaient qu’à désigner ce qui partirait ; ils portent maintenant le coup. On clique sur « Rapière » et la rapière frappe. Le bouton « Attaque » séparé disparaît : il ne servait plus à rien. Tous les boutons portent le bleu plein des Actions et leur hauteur de 36 pixels, celle de l’Analyse. Celui qui vient de partir garde un liseré clair, car c’est sa réserve que la carte affiche.

Ce qui empêche de frapper grise le bouton concerné et en dit la raison au survol — et **chaque attaque répond pour elle-même** : l’arc reste offert sur une cible que la rapière ne peut pas atteindre, et se grise à son tour si la ligne de vue est coupée. Coma, Au sol, aveuglement, cible alliée, contact hors de portée : les règles sont les mêmes qu’avant, elles se lisent seulement là où l’on clique.

**Un passage secret ne se trahit plus.** Une porte perce la zone de blocage qu’elle recouvre — c’est ce qui fait le passage. Un passage secret clos perçait donc, lui aussi, un trou bien visible dans le mur peint : la troupe lisait l’emplacement du passage sans avoir rien découvert. Pour la troupe, ce trou est désormais rebouché et le mur se lit plein. Le MJ garde le trou et le trait violet qui le nomme. Ce qui arrête le regard n’a pas changé : ouvert ou clos, secret ou non, le passage bloque exactement comme avant.

Au passage, une cible ayant quitté la scène entre deux rendus — les adversaires remplacés à l’ouverture d’une carte, par exemple — ne fait plus tomber la table de jeu.

## v0.76 — Un cadre prend ce qu’il enferme

**Le cadre de sélection.** Glisser sur la carte, hors de tout socle, trace un cadre qui prend tous les combattants qu’il enferme — la sélection multiple sans tenir Cmd et cliquer un par un. Le combattant actif devient le premier du lot que l’on contrôle. Un cadre tracé sur le vide **lève la sélection** : c’est la façon de tout reposer. Un clic sans glissement reste un clic. En vue joueur, les adversaires cachés ou hors de vue ne se laissent pas prendre.

Le glissement simple revenant au cadre, **le panoramique passe au bouton droit** — la molette et le pincement continuent de faire le leur comme avant, et ce sont eux qu’on utilise le plus.

**Le bestiaire pose une meute d’un coup.** Un chiffre à côté d’« Ajouter à la carte » dit combien de créatures partent — jusqu’à vingt. Chacune reçoit sa place, hors des murs, et les homonymes se numérotent d’eux-mêmes comme depuis la v0.61.

**Les deux « + » ont rejoint leur camp.** « + Aventurier » et « + Adversaire » quittent le titre du panneau pour s’asseoir au bout des intitulés **Aventuriers** et **Adversaires** de la liste des combattants, réduits à un « + ». L’intitulé d’un camp vide paraît quand même pour le MJ, faute de quoi son bouton serait introuvable.

## v0.75 — Les passages secrets

Un troisième type de porte dans l’éditeur de cartes : le **passage secret**, coché sur n’importe quelle porte. Tant qu’il est clos, il n’existe pas pour la troupe — il ne se dessine pas, rien ne se clique à son emplacement, et il bloque le passage et la vue comme le mur dont il a l’air. **Le MJ seul l’ouvre.** Le message qui nomme l’obstacle coupant une ligne de vue dit d’ailleurs « un mur » aux joueurs là où il dit « une porte fermée » au MJ : il ne trahit pas ce que le socle ne montre pas.

**Une fois ouvert, ce n’est plus qu’une porte** : visible de tous, refermable par qui l’atteint, exactement comme les autres. Le MJ le distingue à son trait violet en pointillé serré, sur la carte comme dans l’éditeur ; ouvert, il reprend le gris des portes ouvertes.

Une réserve, la même que pour tout le reste : les vues MJ et joueur sont des interfaces locales, pas une barrière. Un passage secret est caché de l’**écran**, pas des données publiées — un joueur curieux qui inspecte le contenu partagé le trouverait. C’est la géométrie de la carte qui l’exige : le retirer de la publication ouvrirait un trou dans le mur chez les joueurs.

## v0.74 — Une arme à deux mains vaut son attaque

**Rapière et arc court sont deux boutons, pas un.** Une arme à deux mains s’emploie seule : elle vaut donc une attaque à elle, avec sa portée. Les armes à une main se tiennent ensemble et n’en font qu’une, dés cumulés — et deux exemplaires du même modèle cumulent aussi les leurs, comme depuis la v0.69. **Une arme à distance est toujours à deux mains**, quoi que dise sa fiche : l’une frappe au contact, l’autre tire au loin, et l’on choisit. Le champ « Mains » existait déjà à l’armurerie et le catalogue était juste — il n’était simplement jamais lu.

**Les dés partent avec le nom.** Chaque bouton d’attaque porte sa réserve de dés, et une flèche ⤳ marque celles qui tirent au loin : on choisit son attaque en voyant ce qu’elle lance.

**Changer de combattant renouvelle les boutons.** Cliquer un socle sans tout redessiner — ce qui garde la capture du pointeur pendant un glissement — laissait à l’écran les attaques du combattant précédent. On voyait « Griffes » et « Morsure » en tenant un aventurier. Corrigé.

**Les cibles se lisent à leur couleur** avant même leur nom : vert pour un allié, rouge pour un adversaire, et un liseré plus épais sur celle qui est visée.

**Tous les boutons d’Action ont la même hauteur.** L’émoji de l’Analyse donnait à sa ligne une hauteur plus grande et le faisait dépasser de la rangée ; une hauteur fixe aligne Attaque, Analyser, Dégel et Se relever.

**Ajouter un combattant, c’est prendre dans ce qu’on a déjà.** Les boutons « + Aventurier » et « + Adversaire » n’ouvrent plus une fiche vierge : ils offrent le bestiaire ou la troupe, avec portrait, chiffres et recherche. Un modèle cliqué pose une créature sur la carte ; un aventurier cliqué est reposé au centre et désigné — toute la troupe est en scène par construction, il n’y a donc pas de double créé. Le dernier bouton du choix mène quand même au formulaire de création.

`checks.cjs` passe à 294 vérifications, dont la règle des mains et le découpage des attaques d’équipement.

## v0.73 — Les adversaires s’équipent, et chaque attaque a son bouton

**Porter une arme, c’est savoir s’en servir.** La v0.71 avait tranché trop court : l’équipement y devenait l’affaire des seuls aventuriers, faute de quoi une arme posée sur une créature rendait muets les dés de sa fiche. La vraie règle est plus simple et vaut pour tout le monde — **l’équipement ne fait pas taire la fiche, il ajoute une attaque de plus**. Un adversaire a donc son bloc Attaques (crocs, griffes, souffles) *et* son bloc Équipement, garni de la même façon qu’un aventurier.

**Chaque attaque a son bouton.** Le menu déroulant disparaît : la carte d’attaque montre un bouton bleu nommé par attaque — celles de la fiche et celle que donne l’équipement — et l’on clique celle qui part. Le bouton retenu est plein, les autres dessinés ; l’infobulle dit d’où vient l’attaque, sa portée et si elle touche toutes les cibles. Même seule, une attaque se montre : on lit ce qui va être lancé avant de frapper.

Les armes portées se cumulent en **une seule** attaque d’équipement, comme depuis la v0.30, la même arme en double comptant deux fois (v0.69). Cette attaque vient **en tête** de la liste : une fiche enregistrée avant ce choix a son `activeAttack` à zéro et retrouve donc exactement l’arme qui décidait pour elle — rien ne change sous les pieds d’une partie en cours. Un choix devenu caduc — l’arme retirée, une attaque effacée — retombe sur la première offerte plutôt que sur rien.

**La DEF suit la même logique.** Celle d’un aventurier reste ce que porte son armure et son bouclier, zéro compris, champ verrouillé. Celle d’un adversaire lui est propre — écailles, cuir épais — et **ce qu’il porte s’y ajoute** : son champ reste à lui, et le résumé du formulaire annonce le détail (« 4 à lui, plus 1 d’équipement, soit 5 »).

**Le bestiaire transporte enfin l’équipement.** Un modèle a sa rubrique Équipement avec son « + », ce qu’il porte voyage avec lui, et les créatures déjà posées le reçoivent comme le reste de leur profil (v0.71).

`checks.cjs` passe à 285 vérifications : l’attaque d’équipement, l’ordre de la liste, le repli d’un choix caduc, et les deux règles de DEF.

## v0.72 — Le compteur d’activation est mis de côté

**Plus aucune limite d’activation : c’est le MJ qui les fixe.** Le bloc Action / Mvt-Analyse / Objet quitte l’écran, et surtout il n’interdit plus rien — on attaque autant de fois qu’on veut, on analyse plusieurs cibles dans le tour, le Dégel et le Se relever ne coûtent plus rien. Les compteurs continuent d’être tenus en coulisse, si bien que la règle pourra revenir telle quelle le jour venu, sans qu’aucune partie enregistrée n’ait rien perdu.

Ce bloc portait aussi un levier discret : cocher Action faisait jouer le **Poison** et la **Vie**, cocher Mouvement la **Foudre**, pour une activation dépensée sans attaquer ni bouger. Attaquer et se déplacer les déclenchent toujours d’eux-mêmes ; le déclenchement à la main a rejoint le **menu du clic droit**, où vivent les états, et n’y paraît que pour un combattant qui porte l’un des trois.

**Une deuxième attaque d’adversaire était inatteignable.** Le sélecteur d’attaque se cachait dès qu’une arme était portée — reste de la règle d’équipement, corrigée pour la réserve de dés en v0.71 mais oubliée ici. Les créatures armées par la scène de démonstration d’avant la v0.71 étaient donc muettes : on leur ajoutait une attaque, on la réglait, et rien ne paraissait sur la table. Le sélecteur suit désormais la même règle que les dés, et les trois autres endroits qui interrogeaient encore l’équipement sans distinguer aventurier et adversaire ont été alignés.

Ajouter ou modifier une attaque au bestiaire se voit maintenant **aussitôt** sur la table : les dés, le bonus de dégâts et le choix entre plusieurs attaques suivent sans qu’il faille resélectionner la créature.

**Le numéro d’un homonyme** est légèrement décalé vers la gauche sur son socle, à hauteur inchangée.

## v0.71 — Les chiffres se corrigent en jeu, et un modèle corrigé corrige ses créatures

Trois causes distinctes se cachaient derrière « ça ne prend pas mes modifications ».

**La fiche de la table de jeu était figée.** Corriger une valeur au clic n’existait que sur la page Aventuriers et au bestiaire ; sur la fiche de droite — celle qu’on a sous les yeux en plein combat — les chiffres ne répondaient pas. Ils se corrigent désormais comme ailleurs : PV et leur maximum, Vie, Endurance, dégâts, et pour un adversaire sa DEF et son XP. Entrée valide, Échap annule, la barre de PV et le socle suivent. Comme sur les cartes d’aventurier, le redessin de la table **attend qu’on ait fini de taper** : sans cela il détacherait le chiffre visé ensuite et volerait le clic suivant — c’était le défaut de fond derrière « une valeur passe, deux d’affilée jamais ».

**Corriger un modèle du bestiaire ne changeait que le plafond de PV.** Dégâts, DEF, XP, attaques, dés, portrait, nom : rien de tout cela n’atteignait les créatures déjà posées sur la table. On modifiait des dés d’attaque sans jamais voir le coup changer en jeu. **Tout le profil suit maintenant**, tandis que ce qui appartient au combat en cours reste intact : place sur la carte, blessure, états, activations et cible visée. La créature est modifiée sur place et non remplacée, si bien qu’aucune sélection ni aucun renvoi ne devient orphelin. Un modèle inchangé, lui, ne touche toujours rien.

**Une arme posée sur une créature rendait muets les dés de sa carte d’attaque.** L’équipement fait foi — c’était la règle depuis la v0.30 — mais elle s’appliquait aussi aux adversaires, dont deux étaient armés par la scène de démonstration. On corrigeait leurs dés d’attaque sans effet visible, et leur DEF venait de leur armure. **L’équipement devient l’affaire des aventuriers** : eux seuls tirent leurs dés, leur portée et leur DEF de ce qu’ils portent. Un adversaire n’a pas d’armurerie — son profil est sa carte d’attaque et sa DEF propre, les seules choses qu’un modèle de bestiaire sache décrire. La rubrique Équipement disparaît en conséquence de la fiche et du formulaire d’un adversaire, et la scène de démonstration n’arme plus ses deux créatures.

`checks.cjs` passe à 272 vérifications : la nouvelle règle d’équipement, et la propagation complète d’un modèle avec ce qu’elle doit préserver.

## v0.70 — L’onglet ouvert survit au rechargement

**Recharger ne renvoie plus à la table de jeu.** L’onglet ouvert — Cartes, Aventuriers, Talents, Armurerie, Bestiaire, Paramètres — est retenu et rouvert au chargement suivant. C’est un réglage d’appareil, comme le mode nuit : il vit dans le navigateur, ne voyage ni dans la sauvegarde de partie ni dans la publication, et il n’est rendu qu’une fois la partie chargée, faute de quoi la page s’ouvrirait sur du vide. Un joueur dont le dernier onglet était réservé au MJ retombe sur la table, et cet atterrissage n’écrase pas l’onglet mémorisé du MJ.

**Le portrait d’un modèle se change là où on le regarde.** Cliquer le grand rond d’une fiche dépliée ouvre l’import d’image — avec son cadrage de socle — et le portrait s’applique aussitôt, sur la languette comme sur la fiche. Une légende sous le rond dit ce qui arrivera (« Ajouter » ou « Changer ») et une croix retire l’illustration posée. Plus besoin d’ouvrir la fiche complète pour cela.

**Rapide et Esquive quittent les adversaires.** Ces deux marques n’étaient appliquées à la main nulle part et encombraient la fiche : ni pastille au bestiaire, ni case au formulaire d’un adversaire. **Les valeurs enregistrées sont conservées telles quelles** — elles reviendront quand une vraie règle les prendra en charge. Les aventuriers gardent leurs cases.

La fiche dépliée serre le pas au passage : depuis que les Alpha ont leur colonne, le bestiaire en compte quatre et chacune est plus étroite. Portrait un peu plus petit, pastilles resserrées — deux tiennent de nouveau par ligne.

## v0.69 — La carte dit son nom, les camps se séparent, une arme se porte en double

**Le bouton « Utiliser cette image » ne s’éteint plus sans raison.** Depuis la v0.66, régler le cadrage d’un socle périmait la copie optimisée : le bouton se désactivait, la copie affichée restait celle d’avant, et rien ne disait qu’il fallait cliquer « Actualiser l’aperçu ». La copie se refait maintenant **d’elle-même**, un tiers de seconde après le dernier réglage — cadrage, taille ou qualité — et le bouton se rallume seul. Ce qui est montré est donc toujours ce qui sera enregistré.

**La barre annonce la carte qu’on joue.** À la place du mot « CARTE TACTIQUE », le nom de la carte de combat ouverte. C’était la dernière trace du nom de la scène depuis que le bandeau a disparu en v0.68. Sans carte ouverte, l’intitulé d’origine revient.

**La liste des combattants sépare les deux camps** : « Aventuriers » d’abord, un filet, puis « Adversaires ». Les groupes tiennent quel que soit l’ordre du tableau interne, et un groupe vide n’écrit pas son intitulé. Au passage, « héros » cède la place à « aventurier » partout où le mot paraissait à l’écran — bouton d’ajout, sélecteur de vue, messages de jeu, éditeur de cartes.

**Une arme se porte en double.** La plupart se tiennent à deux mains, et rien n’interdit d’en avoir deux du même modèle : leurs dés s’additionnent comme ceux de deux armes différentes. Dans l’équipement, un clic fait le tour — rien, un exemplaire, deux, puis tout reposé — et la ligne affiche « ✓ » ou « ×2 ». Les pastilles de la fiche regroupent les doublons sous un « ×2 » plutôt que de répéter la même. Les deux mains restent la limite.

**La DEF d’un aventurier ne se saisit plus.** Elle est la somme de son armure et de son bouclier, **zéro compris** : jusqu’ici, un aventurier sans rien porté gardait un chiffre écrit à la main, et le champ ne se verrouillait qu’une fois une armure équipée. La règle est désormais tenue par `defenseOf`, en un seul endroit, pour la fiche, la tuile, le formulaire et la résolution des coups. Un adversaire, lui, garde la DEF de sa fiche tant qu’aucune armure ne la commande.

**La page Aventuriers s’ouvre sur ses fiches.** Le paragraphe d’explication a disparu — les infobulles disent la même chose au survol de chaque valeur — et le champ de recherche ne paraît qu’à partir de neuf aventuriers, faute d’avoir à chercher dans quatre fiches.

`checks.cjs` passe à 265 vérifications, dont la règle de DEF et le cumul des dés de deux exemplaires. Un contrôle d’identifiants en double s’ajoute à la routine : il a d’ailleurs attrapé une collision sur `map-name` avant qu’elle n’atteigne l’écran.

## v0.68 — Le bandeau s’efface, les Alpha reviennent, le voile se lève

**Le bandeau de scène a quitté la table.** Titre, sous-titre, barre d’outils et ligne de sauvegarde ont disparu de l’écran de jeu. Aucune de leurs commandes n’est perdue : chacune a rejoint l’endroit qui la concerne. Ajouter un héros ou un adversaire se fait au-dessus de la liste des combattants ; retirer la carte de fond et choisir la carte de combat tiennent dans la barre de la carte ; remettre le camp adverse à 100 % rejoint le bloc des points de vie ; le titre de la scène, le tour de combat et l’état de la sauvegarde sont aux Paramètres. Le titre continue de voyager avec la scène publiée — un seul accesseur sait désormais où il est rangé, au lieu de quatre lectures dispersées. Un échec de sauvegarde ne se cache plus dans un onglet : il passe aussi par le journal, une fois.

**Corriger une valeur ne dérobe plus le clic suivant.** C’était le vrai défaut derrière « les PV ou la Vie ne se modifient pas » : chaque validation redessinait toute la page, si bien que le chiffre visé ensuite était détaché entre l’appui et le relâchement, et que le clic tombait dans le vide. Une valeur isolée passait ; deux d’affilée, jamais. Désormais une saisie validée **réécrit les chiffres sur place** — aucun nœud n’est remplacé, le clic suivant arrive à bon port. Le classement des languettes du bestiaire, lui, attend qu’on ait fini de taper avant de se réordonner. Et un champ rouvert montre la valeur du moment, non celle qu’il avait à sa construction.

`checks.cjs` passe à 255 vérifications : onze de plus garantissent que chaque type d’adversaire a sa colonne, sa teinte de languette et un bandeau sans fond — la vérification échoue bien si l’on retire de nouveau les Alpha.

**Les quatre types d’adversaires ont chacun leur colonne.** Le bestiaire n’en rangeait que trois : les **Alpha** n’apparaissaient nulle part, et leurs modèles restaient invisibles quel que soit le filtre. La colonne existe, avec la teinte de languette qui lui manquait aussi. Les bandeaux des quatre colonnes reposent maintenant sur le même fond clair que les Sbires — seule l’encre les distingue ; le fond presque noir des Boss est parti.

**Un adversaire pâli dit enfin pourquoi.** Deux raisons le voilent, et rien ne les distinguait : ou bien la troupe ne le voit pas, ou bien le MJ l’a caché — ce que fait la case « Invisible à l’ouverture » d’un adversaire pré-placé dans l’éditeur de cartes, **sans qu’aucune commande ne permette ensuite de le montrer**. La liste des combattants écrit désormais la raison sous le nom (« 👁 hors de vue de la troupe » ou « 🚫 caché par toi »), les deux voiles ont deux dessins distincts, et le clic droit sur un socle porte une ligne « Visible des joueurs / Caché aux joueurs » qui lève ou repose le voile à volonté.

## v0.67 — Corriger un chiffre là où il est lu

**Les caractéristiques se modifient d’un clic.** Sur la page Aventuriers, le MJ clique une valeur — niveau, XP, Vie et son maximum, Endurance, PV et leur maximum, dégâts, bonus de compétence — la retape, et valide par Entrée ou en sortant du champ. Échap laisse tout en place, et une saisie vide ou illisible garde la valeur d’avant plutôt que d’écrire n’importe quoi. Chaque chiffre s’arrête aux mêmes bornes que dans le formulaire de fiche, et la fiche reste cohérente : baisser le plafond de PV y ramène les PV du moment, tomber à zéro met dans le coma, la Vie ne dépasse pas son maximum. **La DEF fait exception dès qu’une armure la commande** — elle vient alors de l’équipement, l’écu le dit et refuse la saisie.

**Le bestiaire montre enfin ses fiches.** Une languette dépliée ne donne plus une ligne de résumé mais la fiche entière du modèle : le portrait en grand, le nom, la famille, le type, la menace, la taille du socle, Rapide et Esquive, les quatre tuiles de chiffres — les mêmes qu’en jeu — puis les attaques avec leurs dés, leur portée, leurs cibles et leurs effets, et enfin les notes. **Tout s’y corrige d’un clic**, y compris les dés : cliquer un dé le retire, le « + » en propose un de chaque couleur. Une attaque s’ajoute et se retire depuis la fiche, à condition d’en garder une. Corriger les PV maximum d’un modèle met à jour les créatures déjà posées sur la table, comme depuis la v0.54 — et la languette ouverte le reste pendant qu’on la modifie.

**Le portrait suit partout.** Le token apparaît en petit sur chaque languette du bestiaire, pour reconnaître une créature sans la déplier, et en grand dans la fiche dépliée.

Rien de tout cela n’est offert aux joueurs : chez eux une fiche se lit, elle ne s’écrit pas. `checks.cjs` passe à 244 vérifications, dont dix-huit pour les bornes de saisie et la cohérence d’une fiche corrigée à la main.

## v0.66 — Cadrer un socle, sauver un raccourci, analyser en aventurier

**Le cadrage du socle.** L’import d’un token ouvre désormais un rond de 220 pixels où l’image se règle avant d’être découpée : la molette ou le curseur zooment de 40 à 320 %, le glissement déplace l’image, « Recentrer » revient au cadrage d’origine. Le rond ne laisse jamais paraître de vide — dès que l’image couvre le carré, le glissement est borné à ses bords ; quand le zoom la fait plus petite que le carré, elle reste au contraire enfermée dedans. Le fichier enregistré est carré, découpé exactement comme l’aperçu le montrait. La même fonction `squareFrame` sert à l’aperçu et à la découpe finale : ce qui est vu est ce qui est gardé.

**Les raccourcis s’enregistrent — et le disent.** Ils l’avaient toujours fait ; ce qui manquait était la preuve. Un choix déjà pris par un autre geste était refusé en silence, ce qui donnait l’impression que rien n’était retenu. Les deux gestes **échangent** maintenant leur touche, et chaque changement affiche une confirmation verte : « ✓ Enregistré sur cet appareil. », ou « ✓ Enregistré · « Attaque auto » prend Maj en échange. » Le réglage reste propre à l’appareil, comme le mode nuit.

**L’Analyse est une action d’aventurier.** Le bouton ne paraît plus que sur la fiche d’un héros, et il dit pourquoi il est éteint quand il l’est : pas de cible, cible alliée, cible déjà analysée, ou Mouvement / Analyse déjà dépensé ce tour. Il est aussi passé à un violet plus clair. Enfin, **la remise à zéro du combat efface les analyses** : les adversaires redeviennent inconnus des joueurs, au même titre que les activations et les cibles.

## v0.65 — Les points de vie ont leur bloc

Les paliers quittent la fiche du personnage pour **un bloc à eux**, sous le tour de combat, dans la colonne de gauche : c’est un outil du MJ, pas une lecture de fiche. Il ne paraît qu’en vue Maître du jeu et seulement quand un combattant est choisi, et il annonce sur qui il agit.

Huit boutons, deux rangées : **Mort** ouvre en haut à gauche, **Soin** — l’ancien « Plein » — ferme en bas à droite ; les retraits en rouge sur la première ligne, les ajouts en vert sur la seconde. Mort et Soin sont pleins pour se trouver du premier coup d’œil ; les deux calculent leur écart au lieu de le connaître d’avance.

## v0.64 — Un vrai rond, un chiffre centré, un bouton violet

**Le numéro d’un homonyme est enfin rond.** Il était ovale sur le socle et plat dans la liste parce que sa largeur venait d’un minimum plus du remplissage, quand sa hauteur venait de l’interlignage : deux mesures indépendantes ne font pas un cercle. La boîte est désormais **carrée**, le rayon à 50 %, le chiffre centré par la grille — 14 × 14 sur un socle, 18 × 18 dans la liste, à 0,16 px près. La barre des cibles le reçoit aussi : deux cibles du même nom s’y départagent comme ailleurs.

**Le chiffre des PV se centre pour de bon.** La bordure de la barre mangeait deux pixels de la boîte de contenu, si bien qu’une hauteur de ligne réglée sur la hauteur totale poussait le texte vers le bas. Le centrage passe par la boîte — écart mesuré : 0,00 px dans la liste.

**La barre d’un adversaire non analysé ne porte plus rien** : ni chiffre, ni point d’interrogation.

**Le bouton Analyser rejoint la barre d’attaque**, à côté d’Attaque : même dessin, même police, même hauteur, même remplissage — et **violet**, parce que ce n’est pas une activation du tour mais un geste du MJ. Il était perdu au bas des paliers de PV.

## v0.63 — Mort, Analyser, et l’écu au bout de la barre

**Un bouton Mort** rejoint les paliers de PV : il fait tomber à zéro et sombrer dans le coma d’un seul geste, là où il fallait descendre à la main. Il ne fait rien sur un combattant déjà à terre.

**Un bouton 👁 Analyser** ouvre les chiffres d’une créature à toute la table : ses PV et sa DEF cessent d’être « ? » pour les joueurs. Il se referme d’un second clic, ne paraît que pour les adversaires — un héros n’a rien à révéler — et **l’Analyse au clavier révèle aussi** : c’est le prix d’une Analyse réussie, et elle profite à tous, pas seulement à celui qui l’a menée.

Ce que chacun a le droit de lire tient désormais dans une seule fonction, `hpKnown` : le MJ voit tout, la troupe voit les siens, une créature analysée se livre. Les quatre endroits qui décidaient chacun de leur côté s’y rangent — liste, socle, barre des cibles, infobulles.

**La barre de la liste ne porte plus que les PV du moment** ; le maximum se lit dans la fiche. **L’écu de DEF se pose au bout de la barre**, sur la même ligne et à la même hauteur — celui des aventuriers toujours, celui d’un adversaire une fois analysé, comme ses PV.

## v0.62 — Le bleu de l’Action, le jeton du numéro

**Attaquer et se dégeler dépensent la même activation** : les deux boutons portent désormais le même bleu, la même graisse, la même taille de police. Se relever coûte le Mouvement, pas l’Action — il garde le bouton neutre, pour qu’on lise le coût sur la forme du bouton plutôt que dans l’infobulle.

Le style a quitté `#attack` pour une classe `button.btn-action`, partagée. Il a fallu la qualifier par l’élément : `button.primary`, que porte le bouton d’attaque, l’emportait sinon sur une simple classe et rendait au bouton son brun d’origine.

**Le numéro d’un homonyme reprend le jeton de la liste** — même fond, même liseré, même chiffre — et se pose **à l’intérieur** du socle, au coin haut gauche. Débordant au-dessus, il mordait sur la barre de PV.

## v0.61 — Numéroter les homonymes, régler les PV par paliers

**Deux créatures du même nom se ressemblent trop.** Elles sont désormais numérotées dans l’ordre où elles sont entrées en scène : un chiffre à droite du nom dans la liste, un autre au coin haut gauche du socle. Un nom porté par un seul combattant n’en reçoit pas — c’est le doublon qu’il s’agit de départager. Les numéros se resserrent quand on en retire un du milieu, et l’infobulle les reprend.

**Les points de vie se règlent par paliers** : −10, −5, −1, +1, +5, +10 et **Plein**. Le point à point était intenable sur une créature de 33 PV. Les bornes tiennent — on ne descend pas sous zéro ni au-dessus du plafond —, le coma tombe et se lève avec les PV, et le chiffre monte au-dessus du socle à chaque palier.

Deux régressions attrapées en chemin, toutes deux de ma règle CSS : le nom d’un combattant se tronquait au lieu de passer à la ligne, et `overflow:hidden` **rognait l’accent du « É » d’Éla** par le haut.

## v0.60 — La barre d’activation rassemblée, la table dégagée

**Dégeler et Se relever rejoignent Attaque** dans la barre du bas : ce sont des activations comme elle, elles n’avaient rien à faire sous les cases à cocher. Chaque bouton disparaît dès que son état est levé.

**Trois textes d’aide quittent la table de jeu** : « Ordre et fuite gérés manuellement dans cet aperçu », « Sélectionne un combattant pour ouvrir sa fiche » et la ligne des raccourcis sous la carte. Les touches se lisent désormais dans l’onglet Paramètres, où elles se règlent.

**Pourquoi un adversaire paraît transparent.** Un combattant pâli sur la carte n’est ni mort ni épuisé : c’est le **brouillard de guerre** — la troupe ne le voit pas, et le MJ le garde à l’œil en transparent, cerclé de tirets. Un combattant à 0 PV est pâli lui aussi, et rien ne les distinguait au premier coup d’œil. L’infobulle le dit maintenant : « hors de vue de la troupe », « caché par le MJ, invisible aux joueurs » ou « hors de combat », sur le socle comme dans la liste.

## v0.59 — Paramètres, chiffres qui montent, dés au bas de la table

**Un onglet Paramètres**, ouvert aux joueurs comme au MJ — ce sont des réglages d’appareil, pas du contenu de partie ; ils vivent dans le navigateur et ne touchent à rien d’enregistré. Le **mode nuit** y déménage : le petit bouton lune quitte l’en-tête, et avec lui un vestige, un bouton caché que la page cliquait pour elle-même.

**Cinq gestes de la carte, chacun sa touche réglable** : Sélection, Ciblage, Sélection multiple, Attaque auto, Analyse auto. Deux gestes ne peuvent pas partager la même touche — le réglage refuse le doublon en le nommant, plutôt que de trancher en douce. « Aucune » veut dire le clic nu pour la Sélection, et « désactivé » pour les autres. L’aide sous la carte annonce les touches en vigueur, pas celles d’origine, et un bouton rétablit celles-ci.

Deux gestes sont neufs : **Attaque auto** désigne la cible et frappe dans le même clic ; **Analyse auto** dépense Mvt / Analyse et lit au journal ce qu’on a le droit de savoir de la créature — PV si on y a droit, DEF, dégâts, portée, états.

**Un chiffre monte au-dessus du socle** à chaque changement de PV : rouge pour une perte, vert pour un gain, et « Blindage » ou « Échec » quand le coup n’a rien coûté. Il vit dans sa propre couche, sinon le redessin des tokens l’emporterait au premier point de vie perdu.

**Les dés se posent au bas de la table** au lieu de voler depuis l’attaquant, et le plateau à dés sort du calque zoomé : ils tombent toujours au même endroit, quel que soit le zoom ou le recadrage.

**Plus d’alerte** avant de remettre les adversaires à 100 %.

## v0.58 — Suppr ne parle qu’à l’onglet où l’on se trouve

Sur l’onglet **Cartes**, retirer un adversaire pré-placé faisait surgir l’alerte de la table de jeu. Deux gestionnaires de touche coexistaient : celui de l’éditeur de cartes, qui se garde depuis toujours à `page-maps`, et celui des combattants, arrivé en v0.55 **sans garde de page**. Les deux se déclenchaient ; l’éditeur retirait bien sa forme, et la table demandait par-dessus si l’on voulait vraiment retirer le héros sélectionné dans l’autre onglet.

Le second ne s’applique plus qu’à la table de jeu — la seule page qui ne porte aucune classe `page-…`. Cartes, Aventuriers, Talents, Armurerie et Bestiaire sont donc inertes de ce côté, chacune restant maîtresse de sa propre sélection.

## v0.57 — Les états agissent

Dix des douze états ne sont plus des jetons décoratifs. Ce qui se calcule vit dans `combat.js`, testé à part ; l’interface ne fait que déclencher au bon moment et raconter au journal.

- **Feu** — au clic sur *Tour suivant*, chaque porteur perd un dé noir de PV, avant que les activations ne se remettent à zéro.
- **Gel** — plus de déplacement, et un bouton **❄ Dégel** paraît sous les activations : il coûte l’Action et rend le Mouvement.
- **Au sol** — ni déplacement ni Action, et un bouton **⤴ Se relever** qui coûte le Mouvement et laisse l’Action disponible ensuite.
- **Aveugle** — ni arme à distance ni sort ; le bouton d’attaque le dit au lieu de rester muet.
- **Blindage** — inchangé depuis la v0.52 : absorbe le coup et se consume seul.
- **Faille** — un dé rose s’ajoute au jet ; il ne blesse jamais, et **tous les dés tombés sur sa valeur sortent du compte des dégâts**. Il roule sur le plateau avec les autres.
- **Foudre** — en cochant le Mouvement, un dé bleu frappe tout ce qui est dans l’aura de contact, le porteur compris.
- **Onde** — posée sur un blessé, elle dissipe l’affection la plus fraîche et se consume ; posée sur quelqu’un d’indemne, elle attend et **absorbe le prochain état reçu**. Les états bénéfiques et le coma lui échappent.
- **Poison** — en cochant l’Action, un dé noir de PV en moins.
- **Vie** — en cochant l’Action, un dé vert de PV rendus. Le mouvement seul ne déclenche rien.
- **Saignée** — se cumule : chaque clic dans le menu l’aggrave d’un point, **Maj + clic** la fait redescendre, et le compte se lit sur le jeton. Sa valeur s’ajoute à tout coup qui passe.
- **Ciblage** — laissé de côté, comme demandé.

Les dégâts d’effet ne se défendent pas : ni DEF, ni blindage, ni saignée. Chacun montre son dé sur la carte et se raconte au journal.

Vingt-sept assertions couvrent le dé de faille (valeur présente, absente, jet vidé de tous ses dés), la saignée (ajoutée à un coup qui passe, jamais à un échec ni à un coup arrêté par la DEF, négative ignorée), le cumul et son plancher, la purge de l’Onde, les dégâts et soins qui n’excèdent ni zéro ni le plafond, et le coma qui tombe et se lève avec les PV.

Deux choix d’arbitrage, à corriger d’un mot : **le MJ traverse Gel et Au sol** comme il traverse le verrou des déplacements — c’est lui qui arbitre, et il replace souvent un socle ; et **la Foudre suit la case Mouvement** plutôt que chaque glissement, pour ne pas frapper pendant qu’on installe la scène.

## v0.56 — Les cibles à portée, sous la main

**La barre sous « Attaque » liste ce qui est atteignable** — alliés et adversaires — et un clic y désigne la cible. Plus besoin de viser sur la carte pour en changer. Chaque cible porte son portrait, son nom, et son infobulle dit ses PV quand on a le droit de les lire. La cible courante est encadrée ; la recliquer la lève.

« À portée » veut dire ce que le combat entend par là : le rayon de contact pour qui frappe au corps à corps, une **ligne de vue dégagée** pour qui tire — murs et combattants interposés comptent. C’est la même règle que celle qui autorise le coup, sortie de la fonction qui ne savait juger que la cible déjà désignée. Les adversaires qu’un joueur ne voit pas ne paraissent pas dans sa barre.

**Un allié peut être désigné** — on vise aussi pour soigner ou pour montrer — mais le coup ne part pas sur lui : le bouton d’attaque le dit en toutes lettres au lieu de rester muet.

**Le menu déroulant des attaques** ne s’affiche plus que lorsqu’il y a vraiment à choisir, c’est-à-dire à partir de deux attaques. Avec une seule, il annonçait « Attaque de base » et occupait la barre pour rien.

**Les bonus de dégâts passent en rouge mat**, sur la carte d’attaque comme sur la tuile de caractéristique, avec un jeton de couleur qui s’éclaircit en thème sombre.

## v0.55 — Choisir plusieurs combattants, les retirer au clavier

**Commande + clic** (Contrôle sous Windows) ajoute un combattant à la sélection ou l’en retire, sur le socle comme dans la liste. Un clic simple revient à un seul, et le cerceau **ne réapparaît que lorsqu’ils sont plusieurs** : seul, un combattant reste net, comme demandé en v0.53.

La sélection est un ensemble d’**identifiants**, pas d’indices : retirer un combattant décale les indices de tous les suivants, jamais leurs identifiants. Le groupe survit donc à une coupe au milieu. « L’actif » — celui dont la fiche s’ouvre et dont l’attaque part — reste unique et suit le groupe : s’il en sort, un autre prend sa place. Glisser un membre du groupe ne le disperse pas.

**Suppr ou Retour arrière** retire ce qui est sélectionné. Un adversaire part sans un mot ; **un héros fait surgir une alerte**, et un groupe qui en contient un aussi — perdre un monstre se répare d’un clic, pas une fiche. Rien ne part tant qu’un champ de saisie ou un dialogue a la main, ni en vue joueur, ni si l’opération devait laisser la troupe sans héros.

`removeActor` devient `removeActors` : les indices sont défaits du plus grand au plus petit, sinon chaque coupe décalerait les suivants, et cibles, joueur maître et sélection sont recalés ensuite.

## v0.54 — Le bestiaire commande la table

**« PV actuels » disparaît de la fiche d’un modèle du bestiaire.** Un modèle n’a pas de blessure : son maximum fait foi, et les PV du moment le suivent. Le champ reste là où il sert — un héros, une créature déjà sur la table, une créature qu’on crée pour la scène.

**Corriger un modèle corrige les créatures déjà en jeu.** Une créature posée depuis le bestiaire garde le lien vers son modèle ; en changer les PV maximum met à jour toutes ses copies sur la table, à l’instant, liste et socles compris. **Une créature intacte reste intacte** au nouveau plafond, **une créature blessée garde sa blessure**, et rendre des PV à une créature dans le coma l’en sort. Baisser le plafond écrête sans jamais descendre sous 1 PV.

Les créatures posées avant que ce lien existe n’en ont pas : elles sont rattrapées **par leur nom**, faute de mieux, et seulement quand aucun lien n’est enregistré. Douze assertions couvrent le tout : la troupe jamais touchée, les deux cas de blessure, le coma levé, le rattrapage par le nom, l’autre modèle laissé de côté, l’écrêtage, le plancher à 1, et le modèle inchangé qui ne signale rien.

## v0.53 — Portraits, barres redessinées, PV réservés au MJ

**Un aventurier à portrait n’affichait ni ses PV ni ses états.** Le socle était bien construit avec sa jauge et ses jetons, puis un second passage, hérité de l’époque où le socle ne portait qu’une lettre, le vidait pour y coller l’illustration. L’illustration se pose désormais **dans** la construction du socle, à la place de la lettre, et le second passage disparaît. Au passage la règle CSS `.token img` visait aussi les jetons d’état ; elle ne vise plus que le portrait.

**L’illustration paraît aussi dans la liste des combattants**, à gauche de la carte, dans la pastille qui ne montrait que l’initiale.

**Les barres de vie changent de dessin** — liste, fiche et socle : pilule entièrement arrondie, fond sombre, remplissage en dégradé horizontal, vert pour la troupe, rouge vers l’ambre pour les adversaires, et le texte en clair par-dessus. Elles ne sont plus bombées mais plates, et se lisent mieux sur une carte pâle.

**Les PV des adversaires sont réservés au MJ.** Jusqu’ici un joueur ne lisait que ceux de son propre héros ; il lit maintenant ceux de toute la troupe, et les adversaires lui restent en « En combat », barre pleine, sur la carte comme dans la liste.

**Le clic droit sur une ligne de la liste** ouvre le même menu d’états que sur le socle — utile quand un combattant est hors du champ ou caché par le brouillard.

**Le cerceau orange** autour du combattant sélectionné disparaît. La liste, la fiche et l’aura de portée le disent déjà.

## v0.52 — Plusieurs états à la fois

**Un combattant en porte désormais autant qu’il en subit.** `a.state`, le champ unique, devient `a.states`, une liste tenue dans l’ordre où les états sont posés ; les fiches enregistrées migrent d’elles-mêmes au chargement. Les jetons sont **deux fois plus petits** et **s’empilent vers la gauche** depuis le coin bas-droit du socle, le dernier venu en tête.

Le menu du clic droit **bascule** au lieu d’imposer, et reste ouvert : on en empile souvent trois d’affilée. « Aucun » les lève tous d’un coup.

Les règles de combat suivent, car plusieurs d’entre elles lisaient cet état : *Au sol* interdit l’Action et annule la DEF de qui le subit, *Affaibli* supprime le bonus de dégâts, *Blindage* absorbe le coup **et se consume seul** — les autres états du même combattant restent en place, ce qu’un champ unique ne savait pas faire —, *Coma* met hors de combat. Les trois fonctions (`statesOf`, `hasState`, `setState`) ont quitté l’interface pour `combat.js`, avec treize assertions : l’ordre de pose, l’absence de doublon, le retrait ciblé, le retrait d’un état absent, un champ mal formé.

Le menu « État » de la fiche du personnage disparaît — il ne savait choisir qu’un état, et il était masqué depuis la v0.38. La fiche d’édition reçoit à la place la même grille de jetons que le clic droit, pour qu’on reconnaisse le geste. Au passage, un vestige : `shared.js` écoutait encore ce menu pour déclencher une publication, ce qui levait une erreur à chaque chargement une fois l’élément retiré ; c’est l’événement de contenu qui s’en charge maintenant.

**La barre de PV passe au-dessus du socle** et gagne trois pixels de haut. Elle n’a plus à partager le bas avec les jetons d’état.

## v0.51 — Poser un état au clic droit, lire les PV sous le socle

**Clic droit sur un socle** : le menu des états s’ouvre là où le pointeur se trouve, quinze cases en grille, chacune son jeton, l’état courant encadré. Un clic pose, « Aucun » lève. C’est réservé au MJ, comme le menu « État » de la fiche — le suivi des états lui appartient. Le menu se ferme sur Échap, sur un clic ailleurs et au redimensionnement, et il se recale dans la fenêtre : un socle contre le bord droit ne le pousse pas dehors. Il vit hors de la carte, sinon le débordement de celle-ci le rognerait.

Choisir « Coma » met les PV à zéro, en sortir en rend un : l’état et la barre de vie ne peuvent pas se contredire.

**Une barre de PV sous chaque socle.** Elle suit le token, verte pour la troupe, ambrée pour les adversaires, avec les chiffres en infobulle. Elle respecte ce que la liste des combattants dit déjà : un joueur lit la barre de son héros, celle des autres reste pleine et annonce « En combat ». Le jeton d’état passe au-dessus si les deux se croisent.

**Tuiles.** L’écu de DEF perd quatre pixels (30 × 36) et les chiffres des autres caractéristiques en gagnent trois (22 px) : l’écu ne domine plus la rangée.

## v0.50 — Les écus peints et les jetons d’état

Valentin a déposé ses images dans `img/`. Le tracé SVG de la v0.49 disparaît : la DEF porte désormais **ses écus**, `DEF 0` à `DEF 6`. Au-delà du 6, `DEF VIDE` reçoit le chiffre en Killam — la DEF peut monter sans qu’il faille dessiner une image de plus.

**Douze états, chacun son jeton.** La liste passe de six à quinze entrées : Au sol, Aveugle, Blindage, Ciblage, Faille, Feu, Foudre, Gel, Onde, Poison, Saignée, Vie — plus « Aucun », « Coma », que la barre de vie dit déjà, et « Affaibli », hérité des versions d’avant les jetons et gardé pour ne perdre aucune fiche enregistrée.

**Le jeton s’affiche sur le socle**, en bas à droite, à la moitié de sa largeur, avec une ombre portée pour se détacher d’une carte claire. Il suit le token dans ses déplacements et son zoom, puisqu’il en est un enfant.

La liste des états n’est plus écrite en double : elle vit dans `index.html` avec la table des jetons, et le menu déroulant de la fiche comme celui du panneau se remplissent depuis elle. Ajouter un état, c’est une ligne et une image.

*(`DEGATS.webp` reste inutilisé : « Dégâts » est une caractéristique, pas un état. `VIE.png` a été pris comme état, faute de mieux — si les deux sont en fait les icônes des tuiles Vie et Dégâts, c’est un mot et je les déplace.)*

## v0.49 — La DEF portée par un écu

**La DEF n’est plus un chiffre, c’est un écu.** La forme des jetons d’Amertüme, dessinée en SVG : contour épais, intérieur clair, chiffre au centre. Il remplace l’ancien écu taillé au `clip-path`, et sert partout où une DEF s’affiche — la tuile de caractéristique, les pastilles d’armure de l’armurerie, celles de l’équipement d’un aventurier.

Les chiffres de tes images sont du **Killam Bold** — je les ai comparés glyphe par glyphe. L’écu est donc dessiné, pas photographié : **le 5 et le 6 sont déjà là**, et le 7, le 8, le 9 aussi. Rien à fournir, rien à renommer quand la DEF montera.

*(Les cinq images du message ne me sont pas parvenues comme fichiers — seule la police l’avait été, via un chemin. Si tu tiens à tes PNG exacts plutôt qu’au tracé, dépose-les dans `img/` et je les branche ; mais il faudra alors un fichier par valeur.)*

**Deux réglages de tuile.** « MAX x » descend d’un cran sous la valeur et repasse en police standard : en Killam à 9 px, il se confondait avec le chiffre du dessus. Et le « + » des dégâts respire, écarté du chiffre par de l’interlettrage — le retrait de gauche compense la poussée que l’interlettrage applique aussi après le dernier caractère, la tuile reste donc centrée.

## v0.48 — Killam partout où il y a un nom, et un en-tête resserré

**L’en-tête tient sur une ligne** : « AMERTÜME » et sa version à côté. « Online · Table virtuelle » disparaît, la version quitte son bloc sous le titre. Le titre d’onglet du navigateur suit : « Amertüme · Table de jeu ».

**Killam Bold s’étend** aux noms — celui de la fiche à droite, ceux des languettes de combattants, la lettre portée par les tokens et les avatars, le nom d’une carte d’aventurier — et aux **pastilles** : équipement, talents, armurerie, bestiaire. Avec les chiffres des caractéristiques déjà passés en v0.47, tout ce qui nomme ou chiffre un combattant est désormais dans la même main.

Le sous-ensemble WOFF2 contenait déjà le Ü et les accents français : rien à recompiler.

## v0.47 — Équiper depuis la carte, et la police Killam

**Un « + » à côté d’ÉQUIPEMENT et de TALENTS**, sur la carte de l’aventurier elle-même. Il ouvre le catalogue en pastilles : cliquer une arme la prend, une deuxième fois en met deux exemplaires (v0.69), une troisième les repose ; l’état de chacune est marqué « ✓ » ou « ×2 ». Deux armes au plus, une armure, un bouclier — quand les emplacements sont pris, c’est dit, jamais remplacé en silence ; une armure, elle, remplace bien l’ancienne. La DEF et la réserve de dés découlant de l’équipement, elles sont recalculées à chaque changement, et la carte comme la table de jeu suivent aussitôt. Le même bouton sur Talents ouvre le rayon rangé par classe, celle de l’aventurier et les Génériques en tête.

*(Les « + » de la v0.45, dans les titres de la fiche d’édition, servaient à **créer** un objet ou un talent. Ceux-ci servent à **équiper** avec ce qui existe déjà. Les deux restent.)*

**« MAX x »** remplace le « / x » sous les PV et la Vie.

**La police Killam Bold** (fournie par Valentin) porte les chiffres des caractéristiques et la ligne MAX. Elle est rangée dans `fonts/` : `killam-bold.woff2` est ce que la page charge — un sous-ensemble latin de **48 Ko** au lieu des 188 Ko du TTF, dont l’essentiel du poids était une table de crénage et des bitmaps embarqués inutiles au web. Le `KillamBold.ttf` d’origine reste à côté, intact, pour tout autre usage.

## v0.46 — L’aura sous les doigts, et le test de compétence corrigé

**L’aura de portée apparaît à la prise en main.** Jusqu’ici, saisir un token non sélectionné ne l’activait qu’au relâchement : on déplaçait à l’aveugle, sans voir son rayon de contact. Il se sélectionne désormais dès que le pointeur s’enfonce. La difficulté était qu’un `render()` complet reconstruit les tokens et **couperait la capture du pointeur** au premier pixel de glissement : la sélection en cours de prise ne refait donc pas les tokens, elle bascule les classes de ceux qui sont déjà là et redessine ce qui en dépend — aura, ligne de vue, flèche, fiche, panneau de combat. Le clic qui suit ne repose pas le token qu’on vient de prendre, et les deux acquis précédents tiennent : recliquer sur un token déjà choisi le dépose, glisser un token choisi ne le dépose pas.

**Le test de compétence lançait un dé de moins.** Le chiffre d’une compétence est un **bonus**, pas un nombre de dés : la règle est *1 dé + le bonus*, chaque 4+ vaut une réussite, chaque 6 relance un dé de plus qui compte à son tour et peut relancer lui aussi. Le code lançait exactement `bonus` dés — donc **aucun** dé pour un bonus de 0, un échec garanti là où la règle donne une chance sur deux, et un dé manquant à tous les autres niveaux.

Le calcul est sorti de l’interface et vit maintenant dans `combat.js` sous le nom `skillRoll(bonus, dé)`, avec douze assertions : le dé de base à bonus nul, le compte 1 + bonus, le seuil de réussite à 4, la relance sur 6, la relance de la relance, un bonus négatif qui ne retire jamais le dé de base, et le plafond qui arrête une série emballée. Les huit compétences s’affichent désormais toutes sur la carte d’un aventurier, y compris à `+0` : un bonus nul reste une compétence qu’on teste. Et la fiche rappelle la règle sous le titre.

**XP et points de vie.** L’XP quitte les tuiles de caractéristiques pour une pastille à côté du niveau — ce n’en est pas une. Les tuiles **PV** et **Vie** montrent la valeur du moment en gros et le plafond en petit dessous, au lieu d’un « 18 / 24 » serré sur une ligne.

## v0.45 — Cartes d’aventurier en tuiles, création depuis la fiche

**Les caractéristiques prennent la mise en page de la fiche en jeu.** Sur la carte d’un aventurier : le nom, la pastille de classe teintée, les puces (sexe, peuple, niveau), puis les caractéristiques en **tuiles** — libellé au-dessus, valeur en gros, une teinte par caractéristique, l’écu pour la DEF — et les compétences chiffrées en puces à deux colonnes. La ligne « Classe · niveau » sous le nom disparaît : la pastille porte la classe et une puce porte le niveau, une troisième copie ne servait à rien.

**Créer sans quitter la fiche.** Un « + » dans les titres **Équipement** et **Talents** de la fiche d’un aventurier. L’objet créé se pose aussitôt dans le premier emplacement libre qui l’accepte (arme, armure ou bouclier selon sa catégorie) et le récapitulatif des dés se met à jour ; le talent créé est aussitôt coché. Les quatre listes d’équipement se rechargent **en place** : reconstruire le formulaire aurait perdu ce qui y était saisi et pas encore enregistré. Fermer le dialogue sans enregistrer n’arme aucun rappel — sinon une création faite plus tard depuis l’armurerie serait allée se cocher dans une fiche déjà refermée.

**Adversaires à 100 %.** Un bouton du bloc des points de vie, réservé au MJ (barre du MJ jusqu’à la v0.67), remet tous les adversaires blessés à leurs PV maximum et les sort du coma. La troupe garde ses blessures : c’est le combat qu’on recommence, pas la partie. Le bouton annonce combien d’adversaires sont concernés avant d’agir, et ne fait rien s’ils sont tous au complet.

**Les corps se poussent.** Le MJ peut déplacer le token d’un combattant mort, à la souris comme aux flèches. Les joueurs, eux, restent bloqués sur les leurs.

**Deux détails de couleur.** L’aura de contact voit son opacité doublée une seconde fois. Et toutes les armes portent désormais la même teinte, celle de l’arc : mêlée et distance ne se distinguaient que par une nuance de parchemin qui ressemblait à un défaut.

## v0.44 — Talents, et l’équipement en pastilles

**L’équipement se lit comme à l’armurerie.** Sur la carte d’un aventurier et sur sa fiche à droite de la table de jeu, armes, armure et bouclier sont désormais des pastilles : la même couleur par catégorie qu’à l’armurerie, les dés de l’arme à droite, l’écu et sa DEF pour une armure, l’effet pour un objet. La pastille est posée, pas cliquable — sur une fiche on lit son équipement, on ne modifie pas le catalogue d’un clic de travers. L’infobulle donne les traits et les effets.

Au passage, une pastille dont le nom était long débordait de sa colonne et décalait ses icônes : il manquait un `min-width:0` sur un élément flex. Corrigé pour l’armurerie et le bestiaire aussi.

**Onglet Talents.** Un rayon de talents, rangé en colonnes par classe, les Génériques en tête. Chaque talent porte un nom, une classe, une **nature** — Action, Réaction, Passif, Critique, Maîtrise, Amélioration, chacune sa couleur et son abrégé — un niveau, un effet et des notes. Recherche, filtre par classe et tri par niveau ou par nom. Cliquer un talent déplie son effet et **qui l’a appris**. Les trois icônes habituelles : modifier, dupliquer, supprimer.

**Attribuer un talent.** Dans la fiche d’un aventurier, une rubrique Talents : une case à cocher par talent, groupées par classe, avec la classe de l’aventurier et les Génériques en tête — un arbre entier se parcourt mal quand ce qu’on cherche est au milieu. Un champ filtre la liste sans rien perdre de ce qui est déjà coché. La rubrique n’apparaît pas pour les monstres, qui n’apprennent pas de talents.

Les talents appris s’affichent en pastilles sur la carte de l’aventurier et sur sa fiche en jeu, sous l’équipement. Supprimer un talent du rayon prévient s’il est appris, et le retire alors de ceux qui l’avaient ; une fiche ne garde jamais un talent qui n’existe plus au catalogue — c’est vérifié par les tests.

Le rayon part **vide** : je n’ai pas les talents d’Amertume sous la main, seulement l’image de ton autre application. Donne-moi les données et je les importe comme le catalogue d’objets.

## v0.43 — Enregistrer une fiche depuis la page Aventuriers

Corrigé le jour même : sur la page Aventuriers, enregistrer une fiche ne changeait rien à l’écran, et le crayon de cette carte ne rouvrait plus rien.

Enregistrer **remplace** l’objet dans la liste des combattants au lieu de le modifier. La carte, elle, avait été dessinée avec l’ancien : elle gardait un objet devenu orphelin. Deux conséquences — la page ne se redessinait pas, donc les modifications n’apparaissaient qu’après un rechargement ; et le crayon cherchait le rang d’un objet qui n’était plus dans la liste, obtenait `-1`, et ouvrait une fiche vide qui plantait la page.

Trois corrections : la grille se redessine après chaque enregistrement et chaque retrait ; le rang se relit au moment du clic, et une carte périmée redessine la page au lieu d’agir sur un mauvais rang ; enfin `openActor` refuse un rang qui ne désigne personne plutôt que de lever une erreur. Vérifié : renommer puis rouvrir aussitôt, modifier deux fois de suite, dupliquer, retirer depuis la fiche, créer — la page et la table de jeu suivent, sans rechargement.

## v0.42 — Onglet Aventuriers

**La troupe a sa page.** Un quatrième onglet, **Aventuriers**, à côté de Cartes, Armurerie et Bestiaire, réservé au MJ comme les autres. Une carte par héros : portrait, nom, classe, ses chiffres (PV, DEF, dégâts, Vie, Endurance, niveau, XP) et son équipement en une ligne. Trois icônes par carte — **✎** ouvre la fiche, **⧉** la duplique, **✕** retire le héros de la scène. Un champ de recherche filtre par nom.

Le bouton **Modifier la fiche** disparaît de la table de jeu : c’est ici qu’on modifie un aventurier, plus dans la barre d’outils. Le retrait passe par le même garde-fou qu’auparavant — la troupe garde toujours au moins un héros, et les cibles des adversaires sont recalées après une suppression.

**Tour de combat.** L’intitulé et le numéro tiennent désormais sur une seule ligne, alignés sur la même base : le panneau de gauche gagne une ligne de hauteur.

## v0.41 — Sauvegarde des cartes, socles à la bonne taille

**Exporter, importer.** Deux boutons au bas du panneau des cartes. **⇩ Exporter** écrit un fichier qui contient **toutes** tes cartes — zones de blocage, portes avec leurs verrous, découpes rectangulaires, tracés à main levée, zone de départ, adversaires pré-placés et image de fond — daté, à garder de côté. **⇧ Importer** les relit et les ajoute comme **cartes neuves** : rien n’est jamais remplacé, tu supprimes toi-même ce qui ne sert plus.

Le fichier est nettoyé dans les deux sens par le même code : nombres bornés à la carte, textes coupés, portes remises closes, et surtout **image vérifiée**. Un fichier trafiqué ne peut ni glisser une URL exécutable à la place d’une image de fond, ni faire dérailler des coordonnées — c’est vérifié par les tests, un `javascript:` déposé là ressort à `null`. La mémoire d’exploration, elle, ne fait pas partie des couches : elle appartient à la partie, pas à la carte.

**Les socles ne rapetissent plus.** En passant sur l’onglet Cartes, la table est masquée, donc large de zéro ; la taille d’un socle se calculant sur cette largeur, elle retombait au plancher de 16 px et les tokens revenaient minuscules. Deux corrections : la mesure garde la dernière largeur connue au lieu de s’effondrer, et le retour sur la table redessine au lieu de se contenter de recadrer. Vérifié sur les trois onglets : 46 px au départ, 46 px au retour.

## v0.40 — Une interface claire

L’application passe au **parchemin** : fond clair, texte sombre, dans la teinte de tes cartes. Le thème sombre ne disparaît pas — un bouton ☾/☀ dans l’en-tête bascule de l’un à l’autre, et le choix reste dans le navigateur, propre à chaque appareil. Il ne voyage pas avec la partie : le MJ et ses joueurs lisent chacun comme ils veulent.

Le travail n’a pas consisté à repeindre, mais à **faire passer tout le décor par des jetons de couleur** — fond, panneaux, surfaces creuses, champs, survols, lignes, encre, accent, et jusqu’aux teintes des outils de l’éditeur. Basculer d’un thème à l’autre ne touche désormais **aucune règle de mise en page** : deux listes de valeurs, et rien d’autre.

Les **couleurs de jeu** n’en font pas partie et ne changent jamais : les sept dés, les murs, les socles, le brouillard, les portes disent une règle, pas une ambiance. En revanche les teintes qui servaient à colorer des **textes** — noms du journal, tuiles de caractéristiques, pastilles de compétences, mots-clés — étaient des pastels pensés pour le noir, illisibles sur parchemin. Elles passent à des tons moyens, lisibles sur les deux fonds.

Vérifié page par page dans les deux thèmes — table, cartes, armurerie, bestiaire, fiche — sans une erreur, et par un relevé de contraste : hors textes posés sur l’accent, aucun texte ne descend sous 3,2 contre son fond.

## v0.39 — Déplacer n’est pas reposer

La désélection au reclic de la v0.38 avait un effet de bord : un token relâché après un déplacement passait par le même chemin qu’un clic, donc **bouger un combattant déjà actif le désélectionnait** — la fiche se refermait sous les doigts.

Un déplacement et un clic ne disent plus la même chose. Le clic bascule, le déplacement sélectionne et rien d’autre : on vient de prendre le token en main, ce serait absurde de le lâcher au relâchement. Vérifié à la souris, sur les quatre cas : déplacer un token actif le laisse actif, un clic simple le repose, déplacer un token au repos l’active, un clic le repose à nouveau.

## v0.38 — Aura, languettes, désélection, retour au tour 1

**L’aura de contact double d’opacité** — le disque passe de 8 % à 16 % au centre et de 19 % à 38 % au bord, son liseré de 44 % à 88 %. Elle se voit enfin sur une carte claire.

**Recliquer sur le combattant actif le repose.** La fiche se referme, la carte d’attaque, l’aura et la flèche s’éteignent, les cases d’activation se grisent. C’est un état à part entière : plus personne n’est actif, et tout ce qui parlait de « l’actif » se tait au lieu de s’accrocher au dernier sélectionné. Un clic sur n’importe quelle languette rouvre une fiche.

**↺ ramène au tour 1**, à côté de Tour suivant et réservé au MJ : activations et cibles de tous les combattants remises à zéro, sur confirmation. Les PV, eux, ne bougent pas — c’est un tour qu’on recommence, pas un combat qu’on efface.

**Les vignettes de combattants deviennent des languettes** : 53 px de haut au lieu de 85, jeton de 26 px, barre de PV de 15 px. La liste tient à l’écran.

**La fiche perd l’état et les compétences.** L’état reste modifiable dans « Modifier la fiche », où il a toujours vécu. Les compétences, elles, ne sont plus cliquables nulle part : leur jet existe encore dans le code, mais plus aucun bouton ne l’appelle.

## v0.37 — Quatre lignes, et rien d’autre

**Le trait doré du Maj disparaît.** Appuyer sur Maj change encore le curseur en croix — le geste s’annonce — mais plus rien ne traverse la carte : la flèche de ciblage, elle, reste et suffit. Le Maj + clic cible exactement comme avant.

**La carte d’attaque se réduit à ce qu’elle montre** : le titre, les dés de l’arme et le bonus de dégâts, le bouton, et **« Cible : <nom> »**. Rien de plus — ni PV, ni DEF, ni mention de portée, ni ligne de refus, ni menu de critique, ni lancer libre, ni conventions dépliables.

Ce qui disparaît de l’écran ne disparaît pas du jeu :

- la **raison** d’un coup impossible passe en infobulle du bouton, et la couleur de la flèche la dit déjà d’un coup d’œil ;
- le **dé de critique** se choisit tout seul — la première couleur présente dans la réserve, les verts exclus puisqu’ils soignent : exactement ce que proposait le menu ;
- les **résultats de jet** roulent sur le plateau et se racontent au journal, qui les gardait déjà ;
- un **test de compétence** lancé depuis la fiche roule pareillement sur le plateau.

Seul le **lancer libre** est retiré pour de bon : la réserve d’une arme se lance en attaquant, les compétences depuis la fiche.

## v0.36 — La flèche dit si le coup peut partir

Trois couleurs, lisibles sans lire :

- **bleu plein** — le coup part : cible à portée, ligne de vue dégagée, Action disponible. C’est le bleu du bouton d’attaque, les deux se répondent ;
- **rouge pointillé** — la géométrie l’interdit : hors du rayon de contact, ou vue coupée par un mur, une porte close ou un combattant ;
- **gris pointillé, effacé** — l’Action est passée. La flèche ne rappelle plus que la cible choisie.

L’ordre compte : l’Action passée l’emporte, parce qu’alors le coup ne partira pas ce tour-ci où que soit la cible. La ligne sous le bouton, elle, continue de donner la raison en toutes lettres. La tête de la flèche change de couleur avec elle — trois marqueurs distincts plutôt qu’un `context-stroke` que les navigateurs ne servent pas tous.

## v0.35 — Flèche droite, bouton court

**La flèche ne fait plus le tour.** Elle va droit d’un socle à l’autre, et surtout elle **part du bord du token** et non de son centre : deux pixels au-delà du rayon, de quoi loger le bout arrondi du trait, et la pointe vient tomber pile sur le bord du socle visé — la tête dépassant de trois pixels le bout du tracé, c’est compté. Mesuré : départ à 25,2 px pour un socle de 23,2 px de rayon, pointe à 23,2 px du centre de la cible. Quand les deux socles se touchent presque, la flèche garde une hampe minimale plutôt que de se réduire à sa pointe ; s’ils se chevauchent, elle s’efface.

**Le bouton d’attaque** rétrécit au quart de sa largeur, prend une **taille fixe** — 126 px, quelle que soit l’arme — et porte simplement **Attaque**, en **bleu Mystique** (`#3f7bc0`). Le nom de l’arme passe en infobulle : il se lit déjà dans les dés juste au-dessus, qui grossissent à 30 px, et le bonus de dégâts avec.

## v0.34 — Flèche de ciblage, carte d’attaque

**La cible se voit sur la carte.** Tant qu’un combattant a une cible désignée, un **arc rouge** part de son socle et vient mourir au bord de celui de la cible, tête effilée. Il est **plein quand le coup peut partir**, en **pointillé quand il ne peut pas** — hors du rayon de contact, ou ligne de vue coupée : l’information que donnait l’ancienne ligne verte et rouge, mais lisible d’un coup d’œil et pour le contact comme pour le tir. Le trait garde toujours une hampe visible, même quand les deux socles se touchent presque. La flèche dorée du Maj + clic ne change pas : elle sert à désigner, celle-ci à se souvenir.

**La grosse boîte « Lancer de dés » disparaît** au profit d’une carte compacte : les **dés de l’arme équipée**, faces muettes, le **bonus de dégâts**, et un bouton qui porte le **nom de l’arme**. Sous le bouton, deux lignes seulement — la cible avec sa portée, et la raison quand le coup ne part pas.

Ce qui vivait dans l’ancienne boîte n’est pas perdu pour autant : le choix du dé de critique et le lancer libre tiennent sur une ligne au bas de la carte, le résultat du jet et son résumé s’affichent puis s’effacent, et les conventions de combat restent repliées. Seul le menu déroulant de cible est retiré : on cible au **Maj + clic**, et la flèche dit laquelle.

## v0.33 — Des dés qui ne s’écrasent plus

En v0.32 le dé était un **empilement de boîtes CSS** : une bordure de 1,5 px, deux ombres internes pour le relief, et une pastille centrée par `margin:auto`. Sur le papier c’est la recette exacte ; à l’écran, chacune de ces couches s’arrondit indépendamment au pixel de l’appareil. Dès que la page ne tombe pas sur un pixel entier — n’importe quel zoom autre que 100 %, un écran à échelle fractionnaire, un iPad — la bordure passait de 1 à 2 px d’un côté seulement et la pastille se recentrait dans une boîte d’un pixel plus courte : **un dé sortait aplati, son point avec**, et son voisin identique restait carré.

Le dé est maintenant **dessiné d’un seul tenant**, dans un repère de 22 × 22 : liseré, relief et pastille sont mis à l’échelle ensemble, donc les proportions sont justes quelle que soit la position. Toujours zéro fichier ajouté — le dessin est fabriqué à la volée et mis en cache, un par type. L’ombre portée reste en CSS, où elle ne coûte rien.

Vérifié à quatre densités d’écran et quatre niveaux de zoom, dont des combinaisons volontairement bancales (150 % d’échelle à 125 % de zoom) : la boîte fait 22 × 22 partout, et à la loupe les dés d’une même colonne sont indiscernables. Il subsiste, comme pour n’importe quel élément d’une page posé entre deux pixels, un pixel de flou de bord variable : c’est l’ombre portée, pas la forme.

## v0.32 — Portes plus fines, dés à la recette officielle

**Les portes.** Le contour orange s’affine — 2,5 px close, 3,5 px verrouillée. Une porte **ouverte** passe au **pointillé gris** : elle ne réclame plus l’œil comme un obstacle. Et une porte que le lecteur peut effectivement manœuvrer **s’allume au survol** — trait doré, halo, curseur de main. Le critère est le même que pour l’ouverture : le MJ partout, un joueur seulement si son token la touche et qu’elle n’est pas verrouillée. Une porte hors de portée reste éteinte et garde son curseur ordinaire : on voit d’un coup d’œil ce qu’on peut faire.

**Les dés reprennent la recette d’Amertume RPG**, en CSS pur comme dans le jeu — aucun fichier graphique ajouté. Carré de 22 px, rayon 5, liseré de 1,5 px, pastille centrale de 6 px, relief par deux ombres internes et une ombre portée. Les couleurs passent aux valeurs officielles : Simple `#ece7db`, Léger `#dcb87f`, Lourd `#c0392b`, Mystique `#3f7bc0`, Soin `#5fa45f`, Mortel `#2b2b2b`, Phase `#d8c13a`. Le Mortel porte le liseré clair ; Lourd, Mystique et Mortel la pastille claire, leur face étant trop sombre pour l’inverse — et pour la même raison, leur chiffre passe en clair sur les dés du plateau et dans les résultats.

Les réserves s’affichent désormais dans l’**ordre officiel** : noir, rouge, bleu, vert, jaune, blanc, os.

Le huitième dé, **Faille (rose `#b84ec0`)**, n’est pas repris : la réserve est un tableau de sept entrées, validé comme tel jusque dans le contenu publié. L’ajouter est une modification du modèle de données, pas d’affichage — à faire sur demande.

## v0.31 — Le décor se voit sous les portes

Une porte close arrête le regard : le polygone de vision s’arrête **sur sa face**, donc les cases de son rectangle ne sont jamais éclairées. Tant qu’elle était peinte en plein, cela ne se voyait pas ; depuis qu’elle n’est plus qu’un contour, son intérieur restait un rectangle de brouillard au milieu d’un couloir éclairé.

Le brouillard rend maintenant au rectangle d’une porte **la clarté de ses abords** : pleine si un aventurier la voit à l’instant, celle de la mémoire s’il l’a seulement découverte, et rien du tout tant qu’elle est inconnue. Le décor de la carte se lit donc au travers, sans que la porte cesse une seconde de bloquer la vue — le calcul d’obstacle, lui, n’a pas changé d’un iota.

Mesuré en navigateur, deux héros devant une porte close : opacité du brouillard nulle sous la porte, nulle dans le couloir, pleine derrière la porte.

## v0.30 — Armurerie et Bestiaire en pleine page, portes au contour

**Une porte n’est plus un bloc.** Close, elle se dessine comme un **contour orange gras** ; ouverte, le même contour en **pointillé**. Verrouillée, le trait passe en or pâle et s’épaissit. Plus rien ne masque le décor de la carte sous une porte, et l’état se lit d’un coup d’œil. L’éditeur suit la même règle, avec juste un voile de couleur à l’intérieur pour rester saisissable à la souris.

**L’Armurerie et le Bestiaire deviennent des onglets**, au même titre que Table de jeu et Cartes, à la place des deux fenêtres modales qui les logeaient. Ils reprennent la disposition d’Amertume RPG :

- **Armurerie** — quatre colonnes (Armes de mêlée, Armes à distance, Armures, Objets), chaque objet en pastille de parchemin. À droite de la pastille, la réserve de dés est figurée par une pastille colorée par dé, une armure par son écusson de DEF, un objet par son effet. Recherche par nom, filtre par catégorie, **+ Ajouter**, et **Catalogue officiel** qui réinstalle les objets d’origine sans toucher à ceux que tu as créés.
- **Bestiaire** — trois colonnes, Sbires, Solitaires et Boss, chacune avec son compte et sa couleur. Recherche, filtre par famille, tri par danger ou par nom. Chaque ligne s’ouvre d’un clic sur ses PV, DEF, dégâts, XP et famille, avec le bouton **Ajouter à la carte** ; à droite, modifier, dupliquer, supprimer.

Les deux onglets sont réservés au MJ, comme l’éditeur de cartes : la vue joueur les masque et ramène à la table.

## v0.29 — La porte devant laquelle on se tient

Une porte close est un obstacle : le regard s’arrête **sur sa face**, donc les cases de son rectangle ne sont jamais marquées comme vues. Or la v0.26 décidait de l’afficher aux joueurs en interrogeant la mémoire d’exploration **à son centre et à ses quatre coins** — c’est-à-dire précisément là où, par construction, la mémoire reste vierge. Résultat : deux héros plantés devant une porte ne la voyaient pas, alors que le MJ la voyait très bien.

La question posée est maintenant la bonne, en deux temps : le polygone de vision **touche-t-il la face de la porte** — ce qu’il fait dès qu’on la regarde, puisqu’il s’y arrête ; sinon, la mémoire d’exploration est-elle marquée **tout autour** de son rectangle, à une case de distance. La première réponse couvre le joueur qui s’en approche, la seconde celle qu’il a déjà découverte et laissée derrière lui.

Le filtre continue de filtrer : vérifié en navigateur, une porte enfermée dans une pièce close reste invisible aux joueurs tant qu’aucun héros n’y est entré, et apparaît dès qu’il y entre.

## v0.28 — L’outil Découper garde ses angles droits

La v0.27 lissait les sommets qui **tombent sur un tracé à main levée**. Un angle taillé ensuite à l’outil **Découper**, juste à côté d’un de ces tracés, était donc adouci lui aussi : le coin ressortait biseauté au lieu d’être droit. Le critère de proximité, à lui seul, ne distingue pas ce qui vient du lasso de ce qui vient d’un autre outil au même endroit.

Il en faut désormais **trois d’un coup** pour qu’un sommet soit assoupli :

1. il tombe sur un tracé à main levée enregistré ;
2. il porte une arête à l’échelle de la trame — un angle voulu a des arêtes longues ;
3. il n’appartient au bord **ni d’une découpe rectangulaire ni d’une porte**.

Les découpes de l’outil Découper sont donc **enregistrées elles aussi** (`m.cuts`), au même titre que les tracés libres, mais pour la raison inverse : les unes disent où arrondir, les autres où ne surtout pas toucher. Vérifié en navigateur et dans les tests : un angle taillé au ras d’un tracé libre ressort sans une seule arête de biais, ses sommets au millième près, pendant que la courbe voisine reste une courbe.

Le second critère protège aussi les découpes rectangulaires faites **avant** cette version, qui n’ont pas été enregistrées : dès qu’un angle a une arête d’un pour cent de carte ou plus — c’est-à-dire à peu près toutes —, il reste droit.

## v0.27 — Le lissage rendu à sa place

La v0.26 lissait au jugé : elle repérait les « petites arêtes » et les assouplissait, en pariant que seule la rastérisation d’une découpe libre en produit. Le pari était faux. **Un mur mince a lui aussi des arêtes courtes** — ses deux bouts — et un donjon en compte des dizaines : leurs angles se sont mis à fuir, les lignes droites à onduler, et la ligne de vue avec elles, puisque c’est ce contour qui arrête le regard.

Le lissage ne devine plus rien. **Chaque tracé de la Découpe libre est enregistré sur la carte** (`m.carves`), et seuls les sommets qui tombent dessus, à moins de deux tiers de case, sont assouplis. Tout le reste — murs, angles, découpes rectangulaires, portes — traverse la chaîne sans qu’un sommet bouge. C’est vérifié comme tel : sur un donjon aux murs de 1,2 % d’épaisseur avec ses découpes rectangulaires, le contour lissé est **identique au contour brut**, comparé point par point, y compris quand la carte contient par ailleurs un tracé à main levée. Aucune arête oblique n’apparaît là où il n’y en avait pas.

Les tracés à main levée, eux, restent des courbes : sur une salle ovale, l’escalier brut passe de 300 sommets à 84 et son plus grand pli de 90° à 12°, l’aire à 0,5 % près de l’ellipse voulue.

**Aucune carte n’est à refaire.** Les rectangles n’ont jamais été modifiés — seul l’affichage les déformait — donc les cartes retrouvent leurs lignes droites d’elles-mêmes. En revanche, une découpe libre tracée avant cette version n’a pas laissé de trace enregistrée : elle reste anguleuse tant qu’on ne la retrace pas.

## v0.26 — Découpes en courbes, portes au contact, table gelée

**La découpe à main levée ne fait plus d’escalier.** Une zone découpée était stockée — et surtout *dessinée* — comme des centaines de petits rectangles issus de la rastérisation : d’où les marches. Les rectangles restent la matière première de l’édition, mais ce n’est plus ce qu’on affiche. À chaque changement de géométrie, le moteur en tire le **contour exact de leur union** (`unionContours()`, par compression de coordonnées : les seules lignes utiles sont les bords des rectangles, donc le contour est exact et sans couture entre zones jointives), puis le lisse et l’allège.

Le lissage ne peut pas se contenter d’arrondir : il doit effacer la marche d’escalier *sans* toucher à l’angle d’un mur droit. Il applique donc une moyenne des voisins (filtre 1-2-1, qui annule exactement l’ondulation d’une case sur deux laissée par la trame) **uniquement là où les arêtes sont à l’échelle de la trame** — une marche mesure 0,4 % de la carte, un mur en mesure quarante. Puis une simplification retire les points devenus inutiles. Mesuré : l’escalier brut d’une salle ovale passe de 300 sommets à 89, son plus grand pli de 90° à 9,6°, son aire à 0,6 % de l’ellipse voulue — et une zone rectangulaire, elle, sort avec ses 4 sommets et son aire au millième près. Une encoche rectangulaire reste une encoche rectangulaire.

Ce contour lissé est **la même géométrie pour tout le monde** : il est peint dans l’éditeur, peint sur la table, et c’est lui qui arrête le regard, les tirs et les pas. L’ombre commence donc exactement où le mur est peint. Les obstacles sont devenus des *formes* — une liste de contours avec règle pair-impair — si bien qu’une salle creusée dans un bloc plein est un creux véritable : un héros y tient, et le moteur l’y repousse au lieu de l’en éjecter.

**Tout révéler lève vraiment le voile.** Le bouton remplissait la mémoire d’exploration, ce qui laissait le dessous des zones de blocage en gris sombre — noir, à l’œil d’un joueur. C’est maintenant un interrupteur : 👁 retire le brouillard de la carte pour tout le monde, adversaires compris, et un second clic le rétablit. L’icône s’allume tant que le voile est levé.

**Les portes se manœuvrent au contact.** Un joueur ne peut ouvrir ou fermer une porte que si son token la touche : le rectangle de la porte doit mordre son rayon de contact, ne serait-ce que par un bout. Sinon le journal le lui dit. Le MJ, lui, manœuvre tout, de partout.

**Les portes restent lisibles dans la pénombre.** Elles se dessinent désormais au-dessus du brouillard, dès lors que la troupe a exploré leur emplacement. Une porte jamais approchée reste invisible.

**🔒 fige la table.** Une icône réservée au MJ bloque le déplacement des tokens joueurs — le temps de décrire une scène sans que personne n’avance. Le MJ continue de tout déplacer ; l’état voyage avec le contenu publié.

Enfin, le journal ne raconte plus les déplacements : il ne garde que ce qui se décide.

## v0.25 — Vision exacte, propre à chaque aventurier

**Le brouillard n’est plus une grille.** La zone vue depuis un héros est maintenant calculée exactement, sous forme de **polygone** : on tire un rayon vers chaque coin d’obstacle — et de part et d’autre, pour contourner l’angle — on garde la première rencontre, puis on relie les points par angle croissant (`visionPolygon()`). Le bord est une vraie droite tracée au pixel de l’écran : plus aucun escalier, à aucun niveau de zoom. C’est aussi **plus rapide** que l’ancien échantillonnage case par case — 3 ms au lieu de 20 sur la même scène, parce que le coût suit le nombre d’obstacles et non le nombre de cases.

Le polygone est vérifié contre le moteur existant : sur un plan à 56 morceaux de murs, `pointInPolygon(p, vision)` et `wallsBetween(héros, p)` donnent **le même verdict sur plusieurs milliers de points**, depuis plusieurs positions. C’est ce test qui garantit que la zone éclairée correspond exactement aux règles de ligne de vue déjà utilisées pour les tirs.

**Chacun voit par son propre aventurier.** En vue joueur, le brouillard suit le regard du héros contrôlé, et lui seul : changer d’aventurier change la zone éclairée, et un adversaire hors de ce champ reste invisible. Le MJ, lui, continue de voir par toute la troupe. La **mémoire d’exploration reste commune** — ce qu’un héros a découvert reste dessiné en sombre pour tout le monde — sinon elle divergerait d’un appareil à l’autre et le contenu publié ne voudrait plus rien dire.

Cette mémoire passe à 640 colonnes (cases de 1,3 px à l’écran contre 3,2 avant) et voyage désormais **compressée en base64** au lieu d’une suite de 0 et de 1 : même encombrement qu’avant pour six fois plus de finesse. Les mémoires enregistrées en v0.23 et v0.24 sont reprises et ré-échantillonnées, pas jetées.

**Deux icônes pour le MJ** dans la barre de la carte : 🌫 remet le brouillard, 👁 lève tout. Elles remplacent les deux boutons longs qui encombraient les outils du MJ, et n’apparaissent qu’en vue Maître du jeu.

**Les portes se referment.** Une porte ouverte est dessinée en pointillé sans remplissage — et un rectangle SVG sans remplissage n’attrape pas les clics : le second clic tombait dans le vide. La porte accepte maintenant les clics sur toute sa surface, ouverte comme fermée. Un clic ouvre, le suivant referme, et la ligne de vue se rebloque immédiatement.

## v0.24 — Brouillard de guerre net et fin

Le brouillard était calculé sur une grille de 104 × 58 cases étirée sur toute la carte, et le navigateur lissait cet agrandissement : d’où des taches molles d’une dizaine de pixels. Trois changements :

- **La grille passe à 256 colonnes**, et le nombre de lignes est déduit du rapport de la carte pour que les cases soient **carrées** — sur une image en 1232 × 751 elles étaient auparavant nettement plus hautes que larges, ce qui accentuait l’effet d’escalier vertical. Mesuré sur une carte affichée en 816 × 497 : cases de 3,19 × 3,19 px, contre 7,8 × 8,6 px avant.
- **Le rendu devient net** (`image-rendering: pixelated`) : plus d’interpolation, les rayons d’ombre projetés par les angles de murs sont des droites franches au lieu de dégradés flous. Le zoom conserve cette netteté.
- **Le calcul est mémorisé.** À cette finesse il coûte 8 à 20 ms ; il ne reprend donc que si la scène a bougé — position d’un héros vivant, état d’une porte, géométrie des zones. Les autres rendus (sélection, journal, changement de vue) le réutilisent tel quel.

La mémoire d’exploration des cartes déjà jouées n’est pas perdue : une grille de 104 × 58 est **ré-échantillonnée** vers la nouvelle finesse (`regridMask()`), ce que les tests vérifient case par case. En publication, seule la carte ouverte emporte sa mémoire d’exploration : les autres n’alourdissent plus le contenu partagé.

## v0.23 — Les portes percent les murs, recalage des cartes anciennes

**Une porte creuse la zone de blocage qu’elle recouvre, en permanence.** Jusqu’ici le trou était découpé une fois pour toutes dans les données au moment du tracé : les cartes dessinées avant cette règle gardaient leur mur intact sous la porte, et déplacer une porte laissait un trou orphelin derrière elle. Le percement est désormais **calculé à chaque affichage** — `wallsPierced()` retire les portes des zones avant de peindre et avant de calculer la vue. Conséquences immédiates : les cartes déjà tracées sont réparées sans rien toucher à leurs données, et une porte déplacée referme le mur derrière elle.

L’éditeur peint la même chose que la table. Une zone de blocage n’est plus un rectangle plein : c’est un cadre transparent qui contient ses **morceaux visibles**, ce qu’il reste d’elle une fois les portes retirées. On voit donc le trou en dessinant, exactement là où il bloquera. La zone reste sélectionnable, déplaçable et redimensionnable d’un seul tenant.

**Recaler les zones sur l’image.** Le cadrage a été corrigé en v0.22, mais les cartes tracées avant gardent des coordonnées enregistrées dans l’ancien cadre 16/9, où l’image était réduite et centrée : tout le tracé s’y trouve comprimé vers le centre. Pour une image 1232 × 751, l’échelle valait 0,9228 et la marge 3,86 % — une zone posée sur l’image à 10 % a été enregistrée à 13,09 %, d’où le décalage qui persistait à l’écran. Le panneau de droite propose désormais **Recaler les zones sur l’image** quand la carte est concernée : zones, portes, zone de départ et adversaires retrouvent leurs coordonnées d’image (`uncontain()`). L’opération est annulable par ⌘Z, et le bouton disparaît une fois la carte recalée. Les cartes créées à partir de cette version sont marquées comme déjà cadrées et ne le proposent jamais.

Vérifié en navigateur : un mur de 10 % à 90 % traversé par une porte à 48 %–54 % se peint en deux morceaux (0–47,5 % et 55–100 % de sa largeur), la ligne de vue passe porte ouverte et se ferme porte close, et un tracé enregistré à 13,09 % revient à 10 % après recalage — puis à 13,09 % si l’on annule.

## v0.22 — Cadrage identique des deux côtés, portes verrouillées

**Le décalage résiduel des zones est corrigé.** La table étirait l’image pour remplir la carte, mais l’éditeur l’affichait encore en `contain` : rentrée dans le cadre, donc réduite et centrée dès que le rapport du cadre ne collait pas exactement à celui de l’image. Une zone posée sur un détail se retrouvait alors décalée vers le centre en jeu. L’éditeur étire désormais l’image de la même façon que la table.

Pour les cartes importées avant l’enregistrement du rapport, celui-ci est **relu sur l’image** à l’ouverture de la carte, dans l’éditeur comme en combat : le cadre reprend le bon rapport sans réimport. Mesuré : une zone posée à 30,05 % / 20,11 % dans l’éditeur s’affiche à 30 % / 20 % en jeu.

**Portes verrouillées.** Une case dans les propriétés de la porte réserve son ouverture au MJ. Les autres portes s’ouvrent d’un clic par n’importe qui pendant la partie — un joueur peut donc ouvrir une porte ordinaire, mais une porte verrouillée lui est refusée avec un message au journal. Elles se repèrent à leur hachure et à leur clé dans l’éditeur.
