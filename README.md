# Amertume Online — v0.39

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
