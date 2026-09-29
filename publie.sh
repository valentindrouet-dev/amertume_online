#!/bin/sh
# Publier une version : vérifier, monter le numéro, se mettre à jour sur main, valider, pousser.
#   sh publie.sh 0.362 "titre du commit" [fichier du corps du message]
set -e;cd "$(dirname "$0")"
V="$1";T="$2";B="$3";[ -n "$V" ] && [ -n "$T" ] || { echo "usage : sh publie.sh 0.362 \"titre\" [corps.txt]";exit 1; }
node verif.cjs
A=$(grep -o "const IMG_V='[0-9.]*'" index.html | grep -o "[0-9.]*[0-9]")
sed -i "s/?v=$A\b/?v=$V/g; s/const IMG_V='$A';/const IMG_V='$V';/; s|<span class=\"ver\">v$A</span>|<span class=\"ver\">v$V</span>|" index.html
[ "$(grep -o "$V" index.html | wc -l)" -ge 17 ] || { echo "✗ numéro de version incomplet";exit 1; }
git fetch -q origin main && git merge -q --ff-only origin/main
git add -A -- '*.js' '*.html' '*.css' '*.cjs' '*.sh' '*.md' img fonts
{ echo "v$V : $T";echo;[ -n "$B" ] && cat "$B" && echo;echo "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>";echo "Claude-Session: https://claude.ai/code/session_01PF75UrdhWECBCA3fXu5RYa"; } | git commit -q -F -
git push -q -u origin claude/reprise-code-chatgpt-lc34es && git push -q origin HEAD:main && git log --oneline -1
