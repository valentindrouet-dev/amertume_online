# Format d'une aventure (v1.405)

Une aventure est un seul fichier `.json`, importé dans **Paramètres → Aventures → Importer une aventure**.
Avant tout ajout, le site montre la liste de ce qui va entrer. Une aventure importée se retire ensuite d'un clic.

## Enveloppe

```json
{
  "app": "amertume_online",
  "genre": "aventure",
  "version": 1,
  "id": "crypte-des-murmures",
  "nom": "La Crypte des Murmures",
  "talents": [],
  "items": [],
  "monsters": [],
  "maps": []
}
```

- `genre` vaut toujours `"aventure"`.
- `id` : lettres, chiffres, `-` et `_`, 100 caractères au plus. Il identifie l'aventure : la même ne s'importe pas deux fois sans avoir été retirée.
- `nom` : ce qui s'affiche dans les Paramètres.
- Les quatre listes sont facultatives, mais il en faut au moins une non vide. Chaque élément doit avoir un `name`.

## Les éléments

Chaque élément a exactement la forme qu'il a dans la partie du site :

| Liste | Ce que c'est | Modèle à suivre |
|---|---|---|
| `talents` | talents (onglet Talents) | `catalog.talents` d'une sauvegarde globale, ou l'export « Sauvegarder les arbres » |
| `items` | objets de l'Armurerie | `catalog.items` d'une sauvegarde globale ; les exemples de `catalog.js` |
| `monsters` | modèles du Bestiaire et PNJ | `catalog.monsters` ; les exemples de `catalog.js` |
| `maps` | cartes, avec leur image en `data:image/webp;base64,…` | `maps` d'une sauvegarde globale, ou l'export de l'onglet Cartes |

## Identifiants et liens

- Un élément peut citer un autre élément de l'aventure par son `id` : un adversaire ses talents, une carte ses objets posés ou ses adversaires.
- Si un `id` est déjà pris dans la partie, l'élément en reçoit un neuf à l'import, et **chaque mention de l'ancien dans l'aventure suit**. Les liens restent justes.
- Un nom déjà pris n'est pas remplacé : les deux coexistent, et l'aperçu le signale.

## Retrait

- Tout ce que l'aventure a apporté est retiré, sauf ce qui sert ailleurs : un objet dans un sac, un talent appris, un élément cité par le reste du contenu. Cela reste par défaut ; une case permet de le retirer aussi.
- La carte ouverte en ce moment n'est jamais retirée.
- Ce qui reste de l'aventure y reste inscrit : un second retrait, plus tard, l'achève.
- Avant chaque retrait, la partie est gardée dans **Paramètres → Diagnostic → Copies de la partie** (« Avant le dernier retrait d'aventure »).
