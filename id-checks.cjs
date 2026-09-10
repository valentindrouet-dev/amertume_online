// Deux éléments ne peuvent pas porter le même id : $('x') n'en rendrait qu'un.
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8')+fs.readFileSync('editor.js','utf8')+fs.readFileSync('maps.js','utf8')+fs.readFileSync('shared.js','utf8');
const vus=new Map();let doublons=0;
for(const m of html.matchAll(/\bid="([A-Za-z][\w-]*)"/g)){const id=m[1];
 vus.set(id,(vus.get(id)||0)+1)}
for(const [id,n] of vus)if(n>1){console.log('DOUBLON',id,'×'+n);doublons++}
console.log('ids :',doublons?doublons+' doublon(s)':'aucun doublon,',vus.size,'ids');
