# Activer le contenu global — v0.08

L’application GitHub Pages et la sauvegarde locale fonctionnent indépendamment. Le partage est préparé pour le projet Firebase **amertume-rpg** déjà utilisé par `amertume_rpg`. Il n’est pas activé tant que l’authentification et les règles ci-dessous ne sont pas configurées. Aucun accès d’administration Firebase n’est disponible dans la connexion GitHub.

## 1. Activer la connexion du MJ

Dans https://console.firebase.google.com/project/amertume-rpg/authentication/providers : activer **Google**, en renseignant l’adresse d’assistance demandée.

Dans **Authentication → Settings → Authorized domains**, ajouter `valentindrouet-dev.github.io` s’il manque. Ne pas saisir le chemin `/amertume_online/`.

## 2. Ajouter les règles Firestore

Ouvrir **Firestore Database → Rules**. Conserver les règles nécessaires à l’application existante. Copier le contenu de `firestore-online.rules` **à l’intérieur** du bloc `match /databases/{database}/documents { ... }`, puis publier.

Attention aux règles existantes du type `match /{document=**} { allow read, write: if true; }` : leurs autorisations s’ajoutent à ces règles et les rendraient inefficaces. Les restreindre à la collection de l’autre app (`amertume_snapshots`) si c’est bien leur usage. Ne pas remplacer tout le fichier sans examiner les règles actuelles. En cas de doute, transmettre le texte des règles pour préparer la fusion exacte.

Ces nouvelles collections sont distinctes de `amertume_snapshots` et ne modifient pas ses données.

## 3. Autoriser ton compte MJ

Sur Amertume Online, cliquer **Connexion MJ**, puis se connecter avec Google. Copier l’**Identifiant MJ** affiché sous les boutons.

Dans la console Firestore, créer :
- collection : `amertume_online_admins`
- identifiant du document : l’identifiant MJ copié
- champ : `active`, type **boolean**, valeur **true**.

Se déconnecter puis se reconnecter dans l’application. Le bouton **Publier mon contenu** doit apparaître. Ne jamais autoriser les visiteurs à écrire eux-mêmes dans cette collection.

## 4. Publier

Cliquer **Publier mon contenu**. Le dialogue rappelle que tous les personnages, notes, catalogues et images sont accessibles à toute personne ayant le lien. Après la première publication réussie, les modifications enregistrées dans les fiches, les catalogues, la scène et les imports de cartes sont republiées automatiquement pendant cette connexion MJ (case décochable).

Partager le lien habituel : https://valentindrouet-dev.github.io/amertume_online/

Les joueurs peuvent consulter les catalogues et charger la scène publiée sans compte. Leur partie jouée reste locale : ce partage n’est pas la synchronisation multijoueur des dés, déplacements ou PV. Charger une nouvelle scène demande confirmation pour conserver la partie locale tant qu’on ne la remplace pas.

## Limites et fonctionnement

- Le contenu complet est limité à **16 Mo** après sérialisation, images incluses. Si la limite est dépassée, la publication s’arrête et le contenu local reste intact.
- Le contenu est réparti en blocs sous la limite d’un document Firestore. Le manifeste n’est mis à jour qu’une fois tous les blocs transmis.
- En cas de modification concurrente par un autre MJ/appareil, la publication est refusée jusqu’au chargement de la version partagée ; les modifications locales sont conservées.
- Les versions publiées sont immuables. Les anciennes versions et les blocs d’une publication interrompue sont conservés ; leur nettoyage devra être géré dans Firebase. Suivre l’usage du stockage et les quotas, notamment si les images sont nombreuses.
- Les règles Firebase sont la protection réelle des écritures. Masquer les boutons MJ dans le navigateur ne remplace pas ces règles.
- Aucune clé privée ou compte de service ne figure dans le dépôt. La configuration Firebase cliente est publique par conception.
- Le projet Firebase, ses règles en production, l’authentification et le chargement sur deux appareils n’ont pas été vérifiés dans cette livraison : l’activation ci-dessus reste à faire.
