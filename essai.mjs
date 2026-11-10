/* L'essai avant publication : le jeu est lancé dans un vrai navigateur (Chromium, sans écran) et joué quelques secondes.
   checks.cjs lit le code ; ici on regarde s'il marche : la page se charge, un combat se joue, un socle se glisse, chaque
   onglet s'ouvre, la partie s'enregistre et se relit telle quelle — y compris une partie enregistrée par une version
   d'avant. Une erreur de page, où qu'elle sorte, fait échouer l'essai.
     node essai.mjs            l'essai complet
   Sans Playwright sur la machine, l'essai échoue : ESSAI=non sh publie.sh … le saute, en connaissance de cause. */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const RACINE=path.dirname(fileURLToPath(import.meta.url));
let chromium;
try{({chromium}=await import('playwright'))}catch(e){try{({chromium}=await import('/opt/node22/lib/node_modules/playwright/index.mjs'))}
 catch(e2){console.error('✗ essai : Playwright introuvable sur cette machine.');process.exit(2)}}

const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
const serveur=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(RACINE,p);
 if(!f.startsWith(RACINE)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return}
 r.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f))});
await new Promise(ok=>serveur.listen(0,'127.0.0.1',ok));
const URL_PAGE='http://127.0.0.1:'+serveur.address().port+'/index.html';

const soucis=[];let etape='';
const dit=(ok,quoi,detail)=>{console.log((ok?'  ✓ ':'  ✗ ')+quoi+(detail?' — '+detail:''));if(!ok)soucis.push(etape+' : '+quoi+(detail?' — '+detail:''))};
const profil=fs.mkdtempSync(path.join(os.tmpdir(),'amertume-essai-'));
// Un profil gardé d'une page à l'autre : c'est lui qui porte la partie enregistrée, comme le navigateur du MJ.
const ctx=await chromium.launchPersistentContext(profil,{viewport:{width:1500,height:900}});
const erreurs=[];
const ouvre=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>erreurs.push(etape+' : '+String(e.message).slice(0,200)));
 await p.goto(URL_PAGE);await p.waitForFunction(()=>{const c=document.getElementById('busy-cover');return !c||c.hidden},{timeout:20000});await p.waitForTimeout(600);return p};
// Ce qui doit se retrouver à l'identique après un enregistrement : fiches, catalogue, cartes et leurs images.
const empreinte=p=>p.evaluate(()=>{const s=snapshot();const h=t=>{let a=0;for(let i=0;i<t.length;i++)a=(a*31+t.charCodeAt(i))|0;return a};
 return JSON.stringify({acteurs:s.actors.map(a=>[a.id,a.name,a.hp,a.max,a.notes||'']),cartes:s.maps.map(m=>[m.id,m.name,m.image?m.image.length+':'+h(m.image):0,(m.matiere||[]).length]),
  carte:s.currentMapId,objets:s.catalog.items.length,monstres:s.catalog.monsters.length,talents:(s.catalog.talents||[]).length,titre:s.title,domaine:s.domaine?[s.domaine.nom,(s.domaine.batiments||[]).map(b=>b.id+':'+b.nom)]:null})});
const enregistre=p=>p.evaluate(()=>new Promise(ok=>{saveNow();setTimeout(ok,700)}));

try{
 /* ---------- 1. Une page neuve, appareil du MJ ---------- */
 etape='Chargement';console.log(etape);
 let p=await ouvre();await p.evaluate(()=>localStorage.setItem('amertume-mj-appareil','1'));await p.close();p=await ouvre();
 dit(await p.evaluate(()=>typeof render==='function'&&typeof snapshot==='function'&&actors.length>0),'la page se charge et la scène par défaut est là');

 /* ---------- 2. Une scène : une carte à image, quatre aventuriers, trois adversaires ---------- */
 etape='Scène';console.log(etape);
 await p.evaluate(async()=>{
  const image=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),d=g.createImageData(w,h);
   for(let i=0;i<d.data.length;i+=4){const v=110+((Math.sin(i/7000)+Math.sin(i/613))*40|0)+(Math.random()*40|0);d.data[i]=v;d.data[i+1]=v*.9;d.data[i+2]=v*.8;d.data[i+3]=255}g.putImageData(d,0,0);return c.toDataURL('image/webp',.8)};
  window.__image=image;
  const m=newMap();m.name='Carte d’essai';m.image=image(1200,675);m.ratio=16/9;
  const rect=(x,y,w,h)=>({anneaux:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]]});
  m.matiere.push(rect(5,5,90,1),rect(5,94,90,1),rect(60,20,1,30));
  await new Promise(r=>{ouvreCarte(m,false);setTimeout(r,700)});
  const h=actors.filter(a=>a.hero);h.forEach((a,i)=>{a.horsCarte=false;a.x=20+i*6;a.y=50});
  for(let i=0;i<2;i++){const a=structuredClone(h[0]);a.id=crypto.randomUUID();a.name='Héros '+(i+3);a.x=32+i*6;a.y=50;actors.push(a)}
  const idx=catalog.monsters.findIndex(x=>!x.pnj);for(let k=0;k<3;k++)poserAdversaire(idx+k,{x:45+k*8,y:35+k*12},false,1);
  actors.forEach(a=>{if(!a.hero){a.vu=true;a.hidden=false;a.notes='Note du MJ sur '+a.name}});render()});
 await p.waitForTimeout(300);
 dit(await p.evaluate(()=>document.querySelectorAll('#map-view .token:not(.lumiere):not(.objet)').length)>=7,'les socles sont sur la carte');

 /* ---------- Les notes du MJ sur ses adversaires restent chez lui ; celles d'un aventurier voyagent ---------- */
 etape='Notes du MJ';console.log(etape);
 {const r=await p.evaluate(()=>{const h=actors.find(a=>a.hero),adv=actors.find(a=>!a.hero);h.notes='Note de joueur';catalog.monsters[0].notes='Note de modèle';
   const t=JSON.stringify(etatVivant()),pub=JSON.stringify(publicContent());
   const n=notesDuMJ(),avant=adv.notes;adv.notes='';catalog.monsters[0].notes='';remetNotesDuMJ(n);
   return {table:t.includes('Note du MJ sur'),pub:pub.includes('Note du MJ sur')||pub.includes('Note de modèle'),heros:t.includes('Note de joueur')&&pub.includes('Note de joueur'),
    garde:adv.notes===avant&&catalog.monsters[0].notes==='Note de modèle',ici:actors.filter(a=>!a.hero).every(a=>a.notes.startsWith('Note du MJ sur'))}});
  dit(!r.table,'les notes d’un adversaire ne partent pas à la table');dit(!r.pub,'ni dans le contenu publié');
  dit(r.heros,'celles d’un aventurier voyagent toujours');dit(r.garde&&r.ici,'le MJ garde les siennes, même quand il recharge la scène publiée')}
 /* ---------- Les clés de cache du rendu ne retiennent rien hors d'un rendu ---------- */
 {const r=await p.evaluate(()=>{const m=currentMap();m.doors.push({x:60,y:50,w:1,h:6,open:false});const k1=geometryKey(m);m.doors[m.doors.length-1].open=true;const k2=geometryKey(m);render();const k3=geometryKey(m);m.doors.pop();render();
   return {change:k1!==k2,tient:k2===k3,vide:memoClesRendu===null}});
  dit(r.change&&r.tient&&r.vide,'une porte ouverte change aussitôt la vue de la carte')}

 /* ---------- 3. Un combat : il commence, un socle se glisse, le tour passe, il finit ---------- */
 etape='Combat';console.log(etape);
 await p.evaluate(()=>{basculerMode('combat');const b=document.getElementById('debuter-combat');if(b&&!b.hidden)b.click();selected=actors.findIndex(a=>a.hero);marked=new Set([selected]);render()});
 dit(await p.evaluate(()=>enCombat()&&round===1),'le combat commence au tour 1');
 const avant=await p.evaluate(()=>{const h=actors[selected],t=document.querySelector('#map-view .token[data-id="'+h.id+'"]').getBoundingClientRect();return {x:t.left+t.width/2,y:t.top+t.height/2,ax:h.x,ay:h.y}});
 await p.mouse.move(avant.x,avant.y);await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(avant.x-i*3,avant.y+i*2);await p.waitForTimeout(16)}await p.mouse.up();await p.waitForTimeout(250);
 dit(await p.evaluate(a=>{const h=actors[selected];return Math.abs(h.x-a.ax)+Math.abs(h.y-a.ay)>.5},avant),'un aventurier glissé à la souris change de place');
 await p.evaluate(()=>{tourSuivant()});await p.waitForTimeout(200);
 dit(await p.evaluate(()=>round===2),'« Tour suivant » passe au tour 2');
 // Lu aussitôt : un adversaire révélé encore debout relance le combat de lui-même dans la seconde, c'est la règle.
 dit(await p.evaluate(()=>{basculerMode('exploration');return !enCombat()}),'« Fin du combat » rend la main à l’exploration');
 await p.evaluate(()=>{actors.forEach(a=>{if(!a.hero)a.vu=false})});await p.waitForTimeout(200);

 /* ---------- 4. Chaque onglet s'ouvre ---------- */
 etape='Onglets';console.log(etape);
 const onglets=await p.evaluate(async()=>{const vus=[];for(const [k] of ONGLETS){showPage(k);await new Promise(r=>setTimeout(r,180));vus.push(k)}showPage('table');return vus});
 dit(onglets.length>=10,onglets.length+' onglets ouverts tour à tour');

 /* ---------- 5. La partie s'enregistre et se relit telle quelle ---------- */
 etape='Sauvegarde';console.log(etape);
 const e1=await empreinte(p);await enregistre(p);await p.close();
 p=await ouvre();const e2=await empreinte(p);
 {const a=JSON.parse(e1),b=JSON.parse(e2),diff=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
  dit(!diff.length,'la partie relue après fermeture est identique',diff.map(k=>k+' : '+JSON.stringify(a[k]).slice(0,160)+' ≠ '+JSON.stringify(b[k]).slice(0,160)).join(' | '))}
 // L'export en fichier se relit lui aussi.
 dit(await p.evaluate(()=>{const t=JSON.stringify(sauvegardeGlobale()),l=lisSauvegardeGlobale(t,'essai.json');return !!l&&l.actors.length===actors.length&&l.maps.length===maps.length}),'la sauvegarde en fichier se relit');

 /* ---------- 6. Une partie enregistrée par une version d'avant (une seule clé « session », images dedans) ---------- */
 etape='Partie d’une version d’avant';console.log(etape);
 await p.evaluate(()=>new Promise((ok,ko)=>{const s=structuredClone(snapshot());s.title='Partie d’avant';s.maps.push({...structuredClone(s.maps[s.maps.length-1]),id:crypto.randomUUID(),name:'Vieille carte',image:window.__image?window.__image(800,450):s.maps[s.maps.length-1].image});
  const r=indexedDB.open('amertume_online_v007');r.onsuccess=()=>{const b=r.result,tx=b.transaction('state','readwrite'),st=tx.objectStore('state');
   // Tout ce que les versions récentes ont pu écrire est ôté : il ne reste que l'ancienne forme.
   const k=st.getAllKeys();k.onsuccess=()=>{k.result.forEach(c=>{if(c!=='session')st.delete(c)});st.put(s,'session')};
   tx.oncomplete=()=>{b.close();window.__avant=JSON.stringify([s.title,s.maps.map(m=>[m.id,m.image?m.image.length:0]),s.actors.length]);ok()};tx.onerror=()=>ko(tx.error)};r.onerror=()=>ko(r.error)}));
 const attendu=await p.evaluate(()=>window.__avant);
 // La page est fermée sans enregistrer : la relecture qui suit part bien de l'ancienne forme.
 await p.evaluate(()=>{ongletPerime=true});await p.close();
 p=await ouvre();
 const relu=await p.evaluate(()=>{const s=snapshot();return JSON.stringify([s.title,s.maps.map(m=>[m.id,m.image?m.image.length:0]),s.actors.length])});
 dit(relu===attendu,'elle s’ouvre telle qu’elle était',relu===attendu?'':'attendu '+attendu.slice(0,200)+' … lu '+relu.slice(0,200));
 const e3=await empreinte(p);await p.evaluate(()=>{actors[0].name=actors[0].name+' ';render()});await enregistre(p);await p.close();
 p=await ouvre();const e4=await empreinte(p);
 dit(e4.replace(/ "/,'"')===e3||JSON.parse(e4).cartes+''===JSON.parse(e3).cartes+'','puis s’enregistre et se relit avec ses cartes et leurs images');
 dit(await p.evaluate(()=>new Promise(ok=>{const g=db.transaction('state').objectStore('state').get('session');g.onsuccess=()=>ok(!!g.result&&Array.isArray(g.result.maps));g.onerror=()=>ok(false)})),'l’ancienne clé « session » est toujours là');
 await p.close();
}catch(e){soucis.push(etape+' : l’essai s’est arrêté — '+String(e.message).split('\n')[0])}
finally{await ctx.close().catch(()=>{});serveur.close();try{fs.rmSync(profil,{recursive:true,force:true})}catch(e){}}

const uniques=[...new Set(erreurs)];
if(uniques.length){console.log('Erreurs de page');uniques.forEach(e=>console.log('  ✗ '+e))}
if(soucis.length||uniques.length){console.error('✗ essai en navigateur : '+(soucis.length+uniques.length)+' souci(s)');soucis.forEach(s=>console.error('   '+s));process.exit(1)}
console.log('✓ essai en navigateur : tout passe');
