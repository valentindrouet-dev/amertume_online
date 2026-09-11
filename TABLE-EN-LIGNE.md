# Activer la table en ligne — procédure complète

À faire une seule fois. Tout se passe dans la console Firebase du projet
**amertume-rpg**, celui qui sert déjà à publier le contenu.
Compte à utiliser : le tien, celui qui est déjà MJ.

👉 https://console.firebase.google.com/project/amertume-rpg

---

## 1. Autoriser tes joueurs à se connecter sans compte

Tes amis ne doivent rien créer. Firebase leur donnera une identité anonyme, le
temps de la partie.

1. Menu de gauche → **Build** → **Authentication**.
2. Onglet **Sign-in method** (Méthode de connexion).
3. Dans la liste des fournisseurs, clique **Anonymous** (Anonyme).
   S’il n’apparaît pas, clique d’abord **Add new provider**.
4. Bascule **Enable** (Activer) → **Save** (Enregistrer).

✅ *Anonymous* doit afficher **Enabled**.

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
3. **Table en ligne → Ouvrir une table.** Un code est tiré.
4. **Copier le lien** et l’envoyer à tes joueurs.

Tes joueurs ouvrent le lien : rien à installer, aucun compte. La fenêtre
s’ouvre, ils choisissent l’aventurier qu’ils incarnent, et vous jouez.

---

## Si ça coince

| Message dans l’application | Ce qui manque |
| --- | --- |
| Firebase ne répond pas… | Réseau, ou un bloqueur qui empêche `gstatic.com` |
| Connecte-toi avec ton compte MJ | Étape 5.1 |
| Pas encore autorisé comme MJ | Étape 4 |
| Règles Firestore incomplètes pour la table | Étape 3 |
| Connexion anonyme désactivée | Étape 1 |
| Cette table n’existe plus | Le MJ a fermé la table, ou le lien est périmé |

Et si un joueur voit la carte mais aucun aventurier à incarner : le contenu n’a
pas encore été publié — étape 5.2.
