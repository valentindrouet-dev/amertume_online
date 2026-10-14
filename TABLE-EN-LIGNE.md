# Activer la table en ligne — procédure complète

À faire une seule fois. Tout se passe dans la console Firebase du projet
**amertume-rpg**, celui qui sert déjà à publier le contenu.
Compte à utiliser : le tien, celui qui est déjà MJ.

👉 https://console.firebase.google.com/project/amertume-rpg

---

## 1. Autoriser tes joueurs à se créer un compte

Depuis la v0.714, un joueur rejoint la table avec son compte : un **compte
Amertüme** (un pseudo et un mot de passe, sans adresse e-mail) ou son compte
**Google**. C'est ce compte qui lui rend ses aventuriers, d'un appareil à
l'autre et d'une séance à l'autre.

1. Menu de gauche → **Build** → **Authentication**.
2. Onglet **Sign-in method** (Méthode de connexion).
3. Clique **Email/Password** (Adresse e-mail/Mot de passe). S’il n’apparaît pas,
   clique d’abord **Add new provider**.
4. Bascule le premier **Enable** (Activer), laisse *Email link* désactivé →
   **Save** (Enregistrer).
5. Vérifie que **Google** est bien **Enabled** : c'est déjà le cas, ton compte
   MJ s'en sert.

✅ *Email/Password* et *Google* doivent afficher **Enabled**.

Un compte Amertüme n'a pas d'adresse e-mail : un mot de passe oublié ne se
récupère pas. Le joueur se crée un nouveau compte, et tu lui confies ses
aventuriers depuis l'onglet **Aventuriers**.

### Le site au MJ seul (v0.717)

Sans ton compte MJ, le site n'offre qu'une page fermée, hors d'une table. Ton
appareil s'en souvient dès que ton compte y a été reconnu une fois. Dans les
règles Firestore, chaque `if true` des blocs Amertüme Online devient
`if request.auth != null` : seul un visiteur connecté lit le contenu publié et
la table. Ne remplace que ces mots, pas le reste des règles.

## 2. Vérifier que le site est autorisé

1. Toujours dans **Authentication**, onglet **Settings** (Paramètres).
2. Section **Authorized domains** (Domaines autorisés).
3. `valentindrouet-dev.github.io` doit y figurer. Sinon **Add domain** et
   colle-le.

## 3. Déployer les règles de la table

C’est ce qui manque quand l’application dit *« Missing or insufficient
permissions »*.

1. Menu de gauche → **Build** → **Firestore Database**.
2. Onglet **Rules** (Règles).
3. Tu vois le texte des règles actuelles. Il ressemble à ceci :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // ... les règles d’Amertume RPG ...
       // ... le bloc amertume_online déjà en place (publication du contenu) ...

     }
   }
   ```

4. **Sans rien supprimer**, colle le contenu du fichier
   [`firestore-online.rules`](firestore-online.rules) du dépôt **à l’intérieur**
   du bloc `match /databases/{database}/documents { … }`, juste avant son
   accolade fermante.

   Si la fonction `isOnlineMJ()` et les blocs `amertume_online_admins`,
   `amertume_online_public`, `amertume_online_versions` y sont **déjà**, ne les
   recolle pas : il ne manque que le dernier bloc, celui qui commence par
   `// ---- Table en ligne (v0.91) ----` et contient
   `match /amertume_online_live/{table}`.

5. Clique **Publish** (Publier). Le déploiement prend quelques secondes.

⚠️ Ces règles **s’ajoutent** à celles d’Amertume RPG, elles ne les remplacent
pas. Ne supprime jamais les blocs de l’autre application.

## 4. Vérifier que tu es bien MJ

Si l’application t’a déjà laissé publier ton contenu, c’est fait. Sinon :

1. Dans l’application : **Partager** → **Connexion MJ** → ton compte Google.
2. La fenêtre affiche *« Identifiant MJ : … »*. Copie cette suite de caractères.
3. Console Firebase → **Firestore Database** → onglet **Data**.
4. Collection **amertume_online_admins** (crée-la si besoin :
   **Start collection**).
5. **Add document** → **Document ID** = l’identifiant copié.
6. Ajoute un champ : nom `active`, type **boolean**, valeur **true**. Enregistre.
7. Recharge l’application.

---

## 5. Lancer une partie

Dans l’application, dans cet ordre :

1. **Partager → Connexion MJ** si ce n’est pas déjà fait.
2. **Partager → Publier mon contenu.** C’est ce qui envoie les fiches, le
   bestiaire, l’armurerie et les cartes à tes joueurs. À refaire quand tu
   changes le contenu — pas à chaque coup d’épée.
3. **Table en ligne → Ouvrir une table.** La table publie d’abord ce qui a
   changé dans ton contenu, puis un code est tiré.
4. **Copier le lien** et l’envoyer à tes joueurs.

Tes joueurs ouvrent le lien : rien à installer. La fenêtre **Rejoindre la
table** leur demande de se connecter, ou de se créer un compte Amertüme d'un
pseudo et d'un mot de passe, ou de passer par Google. Un nouveau joueur crée
ensuite son aventurier depuis l'**Accueil** : il lui appartient, et tu le vois
arriver dans ton onglet **Aventuriers**.

Un joueur ne voit que ses aventuriers. Les tiens lui restent cachés, sauf ceux
que tu lui confies : sur leur fiche, onglet **Aventuriers**, le menu **MJ**
liste les joueurs venus à la table, sous leur pseudo. Tant qu'aucun de ses
aventuriers n'est sur la carte, la Table de jeu reste vide chez lui.
Le journal de combat est commun : chaque ligne écrite d’un côté paraît de
l’autre, et qui rejoint la table reçoit les soixante dernières.

## 6. Fluidité à plusieurs

Tu n’héberges rien : chaque appareil, le tien compris, parle directement
à Firebase, qui distribue les changements. Ta machine n’a donc pas plus
de travail avec quatre joueurs qu’avec un — sauf ce qu’elle s’impose
elle-même. Depuis la v0.201 :

- La **publication automatique** ne repart que si le contenu change
  (fiche, carte, catalogue), jamais pour un coup porté, un déplacement ou
  des PV. Avant, chaque action republiait tout, images comprises, et chaque
  joueur retéléchargeait tout : c’était la latence.
- Les mises à jour qui arrivent en rafale ne sont appliquées qu’une fois,
  et l’écho de tes propres envois ne redessine rien.

Ce qui reste à ta main :

- **Des images de carte légères** (autour de 1 Mo, pas 10) : elles partent
  à chaque publication et arrivent chez chaque joueur.
- **Un seul onglet Amertume** ouvert pendant la partie, et l’onglet au
  premier plan : les navigateurs ralentissent les onglets cachés.
- **Publier avant d’ouvrir la table**, pas pendant la partie, sauf si tu
  modifies vraiment le contenu.

---

## Si ça coince

| Message dans l’application | Ce qui manque |
| --- | --- |
| Firebase ne répond pas… | Réseau, ou un bloqueur qui empêche `gstatic.com` |
| Connecte-toi avec ton compte MJ | Étape 5.1 |
| Pas encore autorisé comme MJ | Étape 4 |
| Règles Firestore incomplètes ou périmées pour la table | Étape 3. Si le bloc est déjà là mais que l’envoi échoue, sa liste `hasOnly([...])` doit contenir `'mode'` (v0.181) |
| Journal non partagé. Règles Firestore… | Le sous-bloc `match /journal/{ligne}` (v0.182) manque dans `amertume_online_live` — étape 3 |
| Ce mode de connexion n’est pas activé dans Firebase | Étape 1 |
| Cette table n’existe plus | Le MJ a fermé la table, ou le lien est périmé |

Chez un joueur, la fenêtre *Table en ligne* s’ouvre d’elle-même et dit ce qui
manque : si elle n’apparaît pas, il l’ouvre depuis le bouton en haut de la page
et lit la première ligne. Et si un joueur voit la carte mais aucun aventurier à
incarner : le contenu n’a pas encore été publié — étape 5.2.
