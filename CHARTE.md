# Charte graphique d'Amertüme Online

Ce document fixe l'apparence du site. Toute nouvelle interface s'y conforme. Avant d'écrire une bulle, un bouton, un cartouche ou un texte, on relit la section qui le concerne et on **réutilise le composant existant**, jamais un style refait à la main.

Les images ci-dessous sont des captures du site lui-même.

---

## 0. Règles d'or

1. **Aucun texte non demandé.** On n'ajoute ni titre, ni aide, ni explication que Valentin n'a pas demandés. Un mot ajouté par prudence est une faute.
2. **On réutilise, on n'invente pas.** Une infobulle est une bulle de talent, un bouton est un bouton du site, un cartouche est un cartouche du site. Un nouveau style n'est créé que sur demande.
3. **Rien de ce qui existe n'est cassé ni retiré.** Un changement ajoute ou corrige, il ne supprime pas en passant.
4. **Les couleurs viennent de la charte.** Fonds, lignes et encres passent par les variables `--…` de la section 1. Les teintes de jeu (types de talent, états, caracs, extensions) viennent de leurs tables. Aucune couleur en dur hors de ces listes.
5. **Le français du site.** Guillemets « », espace insécable avant `: ; ! ?`, majuscule aux noms propres et aux noms de jeu (Gardé, Foudre, Plasma, Incident). Pas d'anglais.
6. **En cas de doute, on demande** avant de coder.

---

## 1. Couleurs de base

Tout le décor passe par ces variables (`index.html`, `:root`). Le thème sombre a les mêmes noms avec d'autres valeurs : on n'écrit donc jamais la couleur elle-même.

| Variable | Clair | Rôle |
|---|---|---|
| `--bg` | `#e9e3d5` | fond de page |
| `--panel` | `#f8f4e9` | panneaux, fenêtres, bulles simples |
| `--panel-2` | `#eee7d6` | fond secondaire, bandeaux |
| `--field` | `#fffdf5` | champs de saisie |
| `--btn` | `#f0e9d8` | bouton ordinaire |
| `--hover` | `#dfd5bd` | survol d'un bouton |
| `--line` | `#cfc1a6` | bordures fines |
| `--line-strong` | `#b0a084` | bordures marquées, fenêtres |
| `--ink` | `#241d16` | texte |
| `--muted` | `#6c6254` | texte secondaire, titres de section |
| `--accent` | `#9c631c` | bouton principal, focus, mot clé du MJ sans couleur |
| `--green` | `#3d7a5b` | « à moi », sélection, validé |
| `--red-mat` | `#a4442f` | danger matériel |

Pour éclaircir ou foncer une teinte, on la mélange avec `color-mix(in srgb, teinte x %, #fff)` ou `#000` : ce sont les deux seules couleurs neutres permises en dur.

---

## 2. Typographie

| Usage | Police | Exemple |
|---|---|---|
| Texte courant, boutons, champs | `system-ui`, 16 px | les phrases des bulles |
| Titres de bulle, noms d'aventurier, chiffres des caracs, titres de fenêtre | **Killam** gras (`'Killam',Georgia,serif`) | « Gardien », « Éla », « 3 » |
| Titres de section et de colonne | `system-ui` 600, 12 px, MAJUSCULES, espacement 2,5 px, encre `--muted` | « ESPÈCES », « COMPÉTENCES » |
| Cartouche de classe | `system-ui` 700, 11 px, MAJUSCULES, espacement 2 px | « GARDIENNE niv. 3 » |

Les chiffres, `xdy` et `%` d'un texte de jeu sont en **gras** (section 4).

---

## 3. Infobulle

**Il n'y a qu'un modèle d'infobulle : celui des talents.** Toute bulle du site (talent, objet, extension, dé de Plasma, aide…) le reprend.

![Bulle de Maîtrise](img/charte/bulle-mait.webp)

**Anatomie**
- Un conteneur `.bulle.bulle-talent`, ouvert par `surveille(ancre, () => ouvrirBulle(ancre, contenu, 'bulle-talent'))`. Il apparaît au survol, se place au-dessus ou dessous, avec sa petite flèche.
- Un contenu `.talent-detail.large`, sur un fond pâle de sa teinte, avec un **liseré de 4 px à gauche** dans la teinte pleine.
- Un titre `p.talent-bulle-nom > b`, en **Killam gras**, à la couleur de la teinte.
- Le texte, en `p.palier-effet`, écrit avec `texteEnrichi()` pour colorer les mots clés.
- Une ligne d'Incident, si besoin, en `p.palier-effet.talent-incident` (section 4).

**Teinte par type** (classe `t-…` du contenu)

| Type | Classe | Teinte | Fond |
|---|---|---|---|
| Maîtrise | `t-mait` | `#c99a3c` | `#f0e0bd` |
| Action | `t-act` | `#4f7fb5` | `#cfdcea` |
| Action bonus | `t-abon` | `#2a9d8f` | `#cdeae6` |
| Mouvement | `t-mvt` | `#8a6440` | `#eee2d4` |
| Réaction | `t-reac` | `#8b6bb5` | `#ddd3ea` |
| Passif | `t-pass` | `#8a8474` | `#dcd8cf` |
| Critique | `t-crit` | `#b5525a` | `#eccfd0` |
| Amélioration | `t-ame` | `#5e9a5b` | `#d3e5cd` |

![Action](img/charte/bulle-act.webp) ![Mouvement](img/charte/bulle-mvt.webp)
![Réaction](img/charte/bulle-reac.webp) ![Passif](img/charte/bulle-pass.webp) ![Amélioration](img/charte/bulle-ame.webp)

**Bulle hors talent.** On garde le même contenu `.talent-detail.large` et on donne sa teinte par `--teinte` : fond à 14 % de la teinte sur `#fbf3e2`, liseré et titre dans la teinte. Exemple, l'Extension :

![Bulle d'Extension](img/charte/bulle-extension.webp)

**Toujours un fond.** Toute bulle a le fond pâle de sa teinte et son liseré : un talent par sa classe `t-…`, un objet par sa rareté, tout le reste par `.bulle-teintee` et sa `--teinte` (ou une classe dédiée comme `bulle-extension`). Un `.talent-detail` sans teinte ne s'ouvre jamais.

**Interdit** : une bulle en simple texte, un fond blanc ou gris sans liseré, un `title=` du navigateur à la place d'une bulle.

---

## 4. Mots clés colorés

Dans tout texte de jeu (bulles, fiches, journal), les mots clés se colorent et se graissent d'eux-mêmes par `texteEnrichi()`. On n'écrit jamais la couleur à la main dans un texte.

![Mots clés](img/charte/mots-cles.webp)

| Mot clé | Couleur | Style |
|---|---|---|
| Chiffres, `xdy`, `%` | noir `#000` | **gras** |
| Action bonus | `#2a9d8f` | gras |
| Compétences (Agilité, Ruse…) | teinte de l'icône de la compétence, `SKILL_TINTS` | gras |

**Pointeur de bond** (`.bond-visee`) : socle en pointillés, vert `#2e9b5f` où le bond peut retomber, rouge `#c0392b` barré d'une croix où il ne peut pas.

**Limite d'une Action bonus** (`.talent-limite`) : sous le nom dans la bulle, en italique, couleur atténuée ; rouge `#b03a48` une fois prise dans son créneau.
| Au sol | `#a65b26` | gras |
| Aveugle | `#9c21de` | gras |
| Blindage | `#1b70bb` | gras |
| Ciblage | `#198014` | gras |
| Faille | `#c41ca7` | gras |
| Feu | `#cd331d` | gras |
| Foudre | `#786e11` | gras |
| Furie | `#d6271f` | gras |
| Gardé | `#1e8113` | gras |
| Gel | `#1b71bb` | gras |
| Invisible | `#5d6b7d` | gras |
| Onde | `#1b7e2d` | gras |
| Poison | `#ac20df` | gras |
| Saignée | `#d6231f` | gras |
| Vie | `#218019` | gras |
| Affaibli | `#97652b` | gras |
| Rage | `#d6281f` | gras |
| Coma | `#9e602e` | gras |
| Sommeil | `#1f6adb` | gras |
| Nécrose | `#5e7821` | gras |
| Corruption | `#a920df` | gras |
| Surpris | `#aa5a18` | gras |
| Charme | `#cd1d81` | gras |
| Caché | `#6e6a66` | gras |
| Autres états | `#a2691f` | gras |

Chaque état prend la **couleur dominante de son icône** (planche ETATS), foncée pour se lire sur fond clair. Le mot **Vie** garde la couleur de la caractéristique VIE.
| PV | `rgb(47,122,91)` | gras |
| Endurance | `rgb(44,140,133)` | gras |
| Vie | `rgb(122,92,184)` | gras |
| Dégâts | `rgb(180,72,58)` | gras |
| DEF | `rgb(96,110,118)` | gras |
| XP | `rgb(157,123,30)` | gras |
| **Incident** | `#b03a48` | gras *italique*, partout ; la ligne « Incident : … » entière en italique |
| `{plasma}` | dé rose `#c23fbe` | petite icône de dé |
| `{état}` ou `[état]` | — | remplacé par l'icône de l'état |
| Mots du MJ (Paramètres) | leur couleur, sinon `--accent` | gras |

Palette des couleurs nommées que le MJ peut donner à ses mots : rouge `#b8352f`, orange `#c2692a`, or `#9d7b1e`, jaune `#b39222`, vert `#2f7a4b`, turquoise `#2c8c85`, bleu `#3a6fc2`, violet `#7a5cb8`, rose `#b04a8a`, plasma `#c23fbe`, brun `#8a5a2b`, gris `#6e6a66`, noir `#2a2622`.

---

## 5. Boutons

![Boutons](img/charte/boutons.webp)

| Bouton | Classe | Quand |
|---|---|---|
| Ordinaire | `button` | action secondaire : Précédent, Retirer, Importer… |
| Principal | `button.primary` | l'action qui fait avancer : Suivant, Créer, Enregistrer. **Un seul par fenêtre.** |
| Suppression | `button.danger` | supprimer, refuser, oublier : **rouge plein** (`--red-mat`), texte blanc gras |
| Icône | `button.ico` | outils d'une carte : ✎ modifier, ⧉ dupliquer, ✕ supprimer (`.ico.danger`, rouge au survol) |
| Décision en jeu | `button.btn-action` | boutons en relief des fenêtres de réaction et de début de combat. L'action principale (Activer, Intervenir) en **bleu** avec `.primaire` ; l'autre (Laisser) en **relief neutre** gris-brun `#8d8676` |
| Rond de talent | `talentRond()` | les talents et actions de la barre et des fiches (section 7) |

Le texte d'un bouton est un **verbe court**, à l'infinitif ou à l'impératif, sans point final.

---

## 6. Cartouches et pastilles

**Cartouche d'identité** (`.hero-cartouche`) : genre, espèce. Fond `#f4ecda`, bord `#cdbf9f`, coins ronds, `system-ui` 700 13 px.
**Cartouche de classe** (`.sheet-class`) : bord et encre de la teinte de la classe, fond à 16 % de cette teinte, MAJUSCULES espacées, le niveau en minuscules.

![Cartouches](img/charte/cartouches.webp)

**Pastilles de bonus** (`pastilleCarac`, `pastilleComp`) : icône de la carac ou de la compétence puis la valeur, à l'encre de sa teinte. Sur deux lignes à la création : Vitesse et caracs d'abord, compétences ensuite par ordre alphabétique.

![Pastilles de bonus](img/charte/pastilles-carac.webp)

**Pastille d'Extension** (`pastilleExtension(cle)`) : un rond de 26 px **au coin haut droit** de ce qui vient d'une extension, fond très pâle de la teinte du logo, bulle « Extension : … » au survol.

![Pastilles d'Extension](img/charte/pastilles-extension.webp)

| Extension | Teinte |
|---|---|
| Diablo | `#d2500a` |
| WoW | `#b8860b` |
| D&D | `#d32f2f` |
| Ravenloft | `#5b3a8c` |
| Faërun | `#1e5fb4` |
| Nimble | `#12898a` |
| Cthulhu | `#4f7a28` |
| Amertüme | `#1f4d55` |

**Barre de PV** (`lifebar`, jauge des tokens) : les PV en vert ; à droite, chacune à sa part des PV max :

| Part | Classe | Teintes |
|---|---|---|
| Radiance | `.pv-radiance` | or brillant `#f2c14e`, reflet `#fff3c4` |
| Nécrose | `.pv-necrose` | hachures `#3b2440` et `#5a3a63` |
| Armure | `.pv-armure` | bleu électrique `#4fd8ff`, reflet `#b8f2ff` |

**Points d'Action et de Mouvement** (`.pt.action`, `.pt.mvt`) : toujours leur icône, `img/points/pa.webp` (bleu) et `img/points/pm.webp` (brun) ; dépensé, grisé.

**Mouvement gelé** (`.gele`) : sous Gel, les points de Mouvement prennent le bleu du Gel `#8fd3f7`, cerclé de `#2f8fae`.

---

## 7. Ronds de talent

Un talent se montre en **rond** : fond pâle et anneau de la teinte de son type (section 3), logo au centre, nom dessous. Tailles : grand pour les actions, moyen pour les passifs, petit pour les bonus.

![Ronds de talent](img/charte/ronds-talents.webp)

Une **action bonus** (Action gratuite) a son rond **turquoise** `#2a9d8f` dans la barre d'actions (`.t-bonus`).

Un talent indisponible est **grisé**, jamais caché. Un talent qui s'ouvre (réaction, début de combat) **rayonne** de sa teinte.

---

## 8. Fenêtres

**Fenêtre** (`dialog(id, titre, html)`) : fond `--panel`, bord `--line-strong`, coins 12 px, titre en Killam, bouton ✕ en haut à droite, boutons d'action en bas à droite, le principal à droite.

![Fenêtre](img/charte/fenetre.webp)

**Fenêtre de réaction et de début de combat** (`.choix-intervention`) : sur la carte, sous sa barre de boutons, côte à côte sans se couvrir. Liseré gauche violet (réaction) ou or (début de combat), titre avec le logo du talent, deux boutons `btn-action` : le principal en bleu, l'autre en relief neutre, et une barre de temps en bas pour un délai.

![Fenêtre de réaction](img/charte/fenetre-reaction.webp)

---

## 9. Panneaux et sections

Une page est faite de panneaux `.panel` (fond `--panel`, bord `--line`). Une colonne ou une section a un titre en MAJUSCULES espacées, encre `--muted`, filet dessous (`.cat-col h3`), et son compteur dans une puce à droite.

![Panneau de talents](img/charte/panneau-talents.webp)

**Fiche d'aventurier** : en tête, l'avatar, le nom en Killam et les outils ; dessous, les cartouches genre, espèce et classe ; puis les caracs, les compétences, les talents et l'inventaire, chacun sous son titre de section.

![Fiche d'aventurier](img/charte/fiche.webp)

---

## 10. Champs

Libellé au-dessus du champ, en `system-ui`, encre `--muted`. Champs sur fond `--field`, bord `--line`, focus en contour `--accent`. Une case à cocher a son libellé à droite (`.field-check`). Les champs se rangent en grille (`.edit-grid`).

![Champs](img/charte/champs.webp)

---

## 11. Journal

Une ligne par événement, en cartouche arrondi, fond et bord pâles du **ton** de l'événement. Les noms sont en gras à la couleur de leur camp, les chiffres en gras, et les dégâts s'écrivent avec l'icône des dégâts, pas avec le mot.

![Journal](img/charte/journal.webp)

| Ton | Couleur | Pour |
|---|---|---|
| `attaque` | `#3f7bc0` | coups portés |
| `talent` | `#8a63c9` | talents joués |
| `degats` | `#b8483a` | dégâts subis |
| `soin` | `#2f8a63` | soins |
| `etat` | `#a2691f` | états |
| `competence` | `#2f7d45` | tests |
| `reveal` | `#9d7b1e` | révélations |
| `carte` | `#8a6d3b` | carte, déplacements |
| `butin` | `#a8832c` | objets trouvés |

Une information qui se voit déjà (une recharge animée, un état affiché) **ne s'écrit pas** au journal.

---

## 12. Animations

- Courtes, de 400 à 700 ms, avec une courbe douce.
- Elles montrent un mouvement réel : une bille de Plasma qui part du token vers la Cellule, une flèche, une poussée.
- L'arrivée d'une animation se marque par un **éclat** bref (agrandissement et halo de la teinte).
- Si l'appareil demande de réduire les animations (`prefers-reduced-motion`), seul l'éclat reste.

---

## 13. Contrôles automatiques

`checks.cjs` vérifie à chaque publication, et la publication échoue en cas d'écart :
- **Infobulles** : chaque `ouvrirBulle(…)` utilise une classe de bulle déjà connue (`bulle-talent`, `bulle-calcul`, `bulle-comp`, `bulle-gear`, `bulle-modele`, `bulle-test`, `bulle-detail-degats`, `bulle-fouilleur`, `bulle-joueurs`), et aucune nouvelle bulle n'est ouverte sans classe. Une nouvelle classe de bulle ne s'ajoute qu'avec l'accord de Valentin, dans cette charte puis dans le contrôle.
- **Couleurs** : dans `editor.css`, sous le repère « Charte graphique », toute couleur écrite en dur (`#…`) figure dans cette charte.
- **Fond des bulles** : aucun `className='talent-detail large'` nu ; une bulle porte toujours sa teinte (`t-…`, `bulle-teintee`, ou une classe de bulle dédiée).
- **Charte présente** : `CHARTE.md` et ses captures `img/charte/` existent.

Les autres règles (texte non demandé, `texteEnrichi()` pour les textes de jeu, français du site) se relisent à la main avant chaque publication.
