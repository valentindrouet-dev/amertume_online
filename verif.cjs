/* Une seule commande pour tout vérifier : les scripts compilent, checks.cjs, shared-checks.cjs,
   id-checks.cjs, et aucun nom déclaré deux fois au niveau d'un fichier. Quand une vérification
   par chaîne (src.includes) échoue, on affiche la chaîne manquante : plus besoin d'aller la chercher. */
const fs=require('fs'),{execFileSync}=require('child_process');
const fichiers={src:'editor.js',page:'index.html',css:'editor.css',feuille:'editor.css',vivant:'live.js',combat:'combat.js',fief:'domaine.js',cartes2:'maps.js',part:'shared.js'};
// 1. Chaque script compile, l'inline de index.html compris.
for(const f of ['combat.js','catalog.js','planches-calcul.js','planches.js','editor.js','maps.js','domaine.js','campagnes.js','shared-data.js','shared.js','live.js','planches-worker.js'])
 try{new Function(fs.readFileSync(f,'utf8'))}catch(e){console.error('✗ '+f+' ne compile pas : '+e.message);process.exit(1)}
{const page=fs.readFileSync('index.html','utf8');let m,re=/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g,k=0;
 while((m=re.exec(page))){k++;try{new Function(m[1])}catch(e){console.error('✗ index.html, script inline n°'+k+' : '+e.message);process.exit(1)}}}
// 2. Les déclarations au niveau du fichier, sans doublon (function, const, let, class).
for(const f of ['editor.js','index.html','combat.js','maps.js','domaine.js','live.js','shared.js']){const t=fs.readFileSync(f,'utf8'),vus=new Map();
 for(const m of t.matchAll(/^(?:async )?(?:function\*? ([A-Za-z_$][\w$]*)|(?:const|let|class) ([A-Za-z_$][\w$]*))/gm)){const n=m[1]||m[2];
  if(vus.has(n)){console.error('✗ '+f+' : « '+n+' » déclaré deux fois');process.exit(1)}vus.set(n,1)}}
// 3. Les trois jeux de tests ; sur un échec, la ligne et les chaînes manquantes. Avec « --epure »,
//    une vérification par chaîne devenue fausse est ôtée de checks.cjs, et l'on recommence : c'est
//    le sort d'une copie de ligne de code après un changement voulu — elle ne testait rien du jeu.
const epure=process.argv.includes('--epure');const otes=[];
function oteChaine(f,lit){let t=fs.readFileSync('checks.cjs','utf8'),n=0;const qs=[JSON.stringify(lit),"'"+lit.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n')+"'"];
 const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 // L'appel, précédé ou suivi de « && », même à cheval sur une ligne.
 for(const q of qs){const F='!?'+esc(f+'.includes('+q+')');for(const re of [new RegExp('\\s*&&\\s*'+F),new RegExp(F+'\\s*&&\\s*')])while(re.test(t)){t=t.replace(re,'');n++}}
 if(n)fs.writeFileSync('checks.cjs',t);return n}
for(let tour=0;tour<40;tour++){let refaire=false;
for(const f of ['checks.cjs','shared-checks.cjs','id-checks.cjs']){
 try{process.stdout.write(execFileSync('node',[f],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n').pop()+'\n')}
 catch(e){const err=String(e.stderr||''),m=/checks\.cjs:(\d+)/.exec(err)||/(?:^|\/)(\w+-checks\.cjs):(\d+)/.exec(err);
  console.error(err.split('\n').filter(l=>l&&!/^\s+at /.test(l)).slice(0,8).join('\n'));
  if(f==='checks.cjs'&&m){const n=+m[1],L=fs.readFileSync(f,'utf8').split('\n');let i=n-1;while(i>0&&!/^\s*(assert\.|\{assert)/.test(L[i]))i--;
   const bloc=L.slice(i,n+14).join('\n'),re=/(!?)(src|page|css|feuille|vivant|combat|fief|cartes2|part)\.includes\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g;let x;
   while((x=re.exec(bloc))){let lit;try{lit=eval(x[3])}catch(_){continue}const has=fs.readFileSync(fichiers[x[2]],'utf8').includes(lit);
    if((x[1]==='!')===has){if(epure&&oteChaine(x[2],lit)){otes.push(lit.slice(0,120));refaire=true}else console.error('  chaîne '+(x[1]?'présente à tort':'manquante')+' ('+x[2]+') : '+lit.slice(0,220))}}}
  if(refaire)break;process.exit(1)}}
if(!refaire)break}
if(otes.length)console.log('épuré : '+otes.length+' vérification(s) par chaîne ôtée(s)\n  · '+otes.join('\n  · '));
console.log('✓ tout passe');
