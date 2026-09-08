# Amertume Online — v0.12

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

L’armurerie permet création/édition/suppression. Appliquer l’équipement dans une fiche cumule les dés des armes dans une attaque et calcule la DEF armure + bouclier ; les champs restent ensuite modifiables. Le choix de l’attaque charge sa réserve et respecte son option d’ajout des dégâts du combattant. Les effets spéciaux, munitions, portée et contraintes de mains ne sont pas automatisés.

## Images
Cartes et tokens : PNG, JPEG, WebP. Aperçu original/optimisé avec dimensions et poids, qualité 70–100 %, choix 2048/4096 pixels pour les cartes ou 256/512 pour les tokens. Proportions et transparence conservées, sans agrandissement. Compression WebP avec secours PNG ; original conservé s’il est plus léger et ne nécessite aucun redimensionnement. Seule la copie est utilisée. L’aperçu doit être actualisé après un réglage. Images animées non garanties : la compression produit une image fixe.

Garde-fous avant décodage : fichier de 25 Mo maximum, 64 millions de pixels maximum, 20 000 pixels maximum sur un côté. Ce sont des limites d’import, pas une garantie de mémoire disponible sur tous les appareils. Une image corrompue ou un échec de traitement affiche une erreur sans remplacer la carte/token courant.

## Sauvegarde
IndexedDB local conserve scène, combattants, catalogue modifié et images validées. Un message signale l’échec si le stockage est indisponible ou plein. L’effacement des données du site supprime cette sauvegarde. La publication Firebase (v0.08) partage le contenu du MJ, mais la partie jouée reste locale : ni synchronisation des dés, des déplacements ou des PV, ni compte joueur. Les vues MJ/joueur sont des interfaces locales et ne constituent pas une sécurité d’accès.

## Combat
Clic pour sélectionner ; **Maj + clic** pour cibler (ou sélecteur Cible). Maintenir Maj affiche une flèche dorée reliant le combattant actif au pointeur. Attaquer applique les dégâts, consomme l’Action et place dans le coma à 0 PV. Lancer libre ne modifie pas les PV.

## Portée et ligne de vue
Le combattant sélectionné affiche son **rayon de contact** : un disque translucide de trois tailles de token en diamètre. Une attaque de portée « contact » exige que le socle de la cible touche ce disque : le chevauchement visible suffit, le centre n’a pas besoin d’y tomber. Une attaque de portée « distance » exige une **ligne de vue** : le segment entre les deux tokens ne doit traverser ni un mur du plan, ni un autre combattant vivant. Le bouton Attaquer est désactivé et le motif est affiché sous la cible.

Les murs du plan schématique sont décrits une seule fois, en polygones, et servent à la fois à dessiner la carte et à couper la vue : le dessin et la règle ne peuvent pas diverger. Une **carte importée n’a pas encore d’obstacles** — le plan est alors masqué et seuls les corps bloquent la vue ; un outil de tracé de murs reste à faire. La taille du socle (moyen, grand, énorme) reste descriptive et ne modifie pas encore le rayon.

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
