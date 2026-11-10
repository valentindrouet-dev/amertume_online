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
const ouvre=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>erreurs.push(etape+' : '+String(e.message).slice(0,200)));p.on('dialog',d=>d.accept().catch(()=>{}));
 await p.goto(URL_PAGE);await p.waitForFunction(()=>{const c=document.getElementById('busy-cover');return !c||c.hidden},{timeout:20000});await p.waitForTimeout(600);return p};
// Ce qui doit se retrouver à l'identique après un enregistrement : fiches, catalogue, cartes et leurs images.
const empreinte=p=>p.evaluate(()=>{const s=snapshot();const h=t=>{let a=0;for(let i=0;i<t.length;i++)a=(a*31+t.charCodeAt(i))|0;return a};
 return JSON.stringify({acteurs:s.actors.map(a=>[a.id,a.name,a.hp,a.max,a.notes||'']),cartes:s.maps.map(m=>[m.id,m.name,m.image?m.image.length+':'+h(m.image):0,(m.matiere||[]).length]),
  carte:s.currentMapId,objets:s.catalog.items.length,monstres:s.catalog.monsters.length,talents:(s.catalog.talents||[]).length,titre:s.title,domaine:s.domaine?[s.domaine.nom,(s.domaine.batiments||[]).map(b=>b.id+':'+b.nom)]:null})});
const enregistre=p=>p.evaluate(()=>new Promise(ok=>{saveNow();setTimeout(ok,700)}));
// Ce que la base de l'appareil contient : les clés, et pour une clé donnée, le poids de ses images restées dedans.
const base=p=>p.evaluate(()=>new Promise(ok=>{const st=db.transaction('state').objectStore('state'),k=st.getAllKeys();k.onsuccess=()=>ok(k.result.map(String))}));
const lis=(p,cle)=>p.evaluate(cle=>new Promise(ok=>{const g=db.transaction('state').objectStore('state').get(cle);g.onsuccess=()=>{const r=g.result,s=r&&r.s?r.s:r;if(!s){ok(null);return}
 const t=JSON.stringify(s);ok({leger:!!s.imagesAPart,octets:t.length,imagesDedans:(t.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]{20000,}/g)||[]).length,refs:(t.match(/amertume-locale:/g)||[]).length,titre:s.title,quand:s.enregistreLe||r.t||0,nom0:s.actors[0].name})};g.onerror=()=>ok(null)}),cle);
const ecris=(p,f)=>p.evaluate(f);

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

 /* ---------- La Foudre se voit : un arc par rebond, un éclat par touché, puis plus rien ; jamais vers un socle qu'on ne voit pas ---------- */
 etape='Foudre';console.log(etape);
 {const r=await p.evaluate(async()=>{const h=actors.filter(a=>a.hero),adv=actors.filter(a=>!a.hero),pv=actors.map(a=>a.hp);
   const places=actors.map(a=>[a.x,a.y]);h[0].x=40;h[0].y=50;adv[0].x=44;adv[0].y=47;adv[1].x=44;adv[1].y=54;render();
   infligeEtat(h[0],'Foudre');afterMove(h[0],true);
   const arcs=document.querySelectorAll('.vfx-foudre').length,eclats=document.querySelectorAll('.vfx-foudre-impact').length,touches=actors.filter((a,i)=>a.hp<pv[i]).length;
   await new Promise(ok=>setTimeout(ok,1500));const restes=document.querySelectorAll('.vfx-foudre,.vfx-foudre-impact').length;
   // En vue joueur, un adversaire que la troupe ne voit pas ne reçoit pas d'arc.
   adv[0].vu=false;adv[0].hidden=true;view='player';render();const cache=eclairFoudre(h[0],adv[0],0),vuCache=document.querySelectorAll('.vfx-foudre').length;view='mj';adv[0].vu=true;adv[0].hidden=false;
   // La scène reprend sa place et ses PV pour la suite de l'essai.
   actors.forEach((a,i)=>{a.x=places[i][0];a.y=places[i][1];a.hp=pv[i];a.states=(a.states||[]).filter(e=>!/^Foudre/.test(e))});if(typeof retireEtat==='function')actors.forEach(a=>{try{retireEtat(a,'Foudre')}catch(e){}});render();
   return {arcs,eclats,touches,restes,cache,vuCache}});
  dit(r.touches>=2&&r.arcs===r.touches&&r.eclats===r.touches,'un arc et un éclat par combattant touché',JSON.stringify(r));
  dit(r.restes===0,'l’effet fini, il ne reste rien sur la carte');
  dit(r.cache===0&&r.vuCache===0,'aucun arc vers un adversaire que le joueur ne voit pas')}

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

 /* ---------- Le journal se filtre, les touches 1 à 9 jouent la barre, Maj compare une pièce à celle qu'on porte ---------- */
 etape='Journal, touches, comparaison';console.log(etape);
 {const r=await p.evaluate(async()=>{logChat({name:'Jasnah',hero:true},'On y va ?');log('Éla fouille la salle.',{ton:'carte'});log('Kaël · Feu : 3 PV perdus.',{ton:'degats'});
   const vus=f=>{document.querySelector('#journal-filtres [data-filtre="'+f+'"]').click();return [...document.querySelectorAll('#journal>li')].filter(l=>l.offsetParent).map(l=>l.textContent)};
   const tout=vus('tout').length,combat=vus('combat'),explo=vus('exploration'),disc=vus('discussion');vus('tout');
   return {tout,combat,explo,disc,total:document.querySelectorAll('#journal>li').length,champ:!!document.getElementById('journal-recherche'),puces:[...document.querySelectorAll('#journal-filtres button')].map(b=>b.getAttribute('aria-label')).join(',')}});
  dit(r.combat.some(t=>t.includes('Feu'))&&!r.combat.some(t=>t.includes('fouille')||t.includes('On y va')),'« Combat » ne montre que le combat');
  dit(r.explo.length>=1&&r.explo.every(t=>!t.includes('Feu')&&!t.includes('On y va')),'« Exploration » ne montre que l’exploration');
  dit(r.disc.length>=1&&r.disc.every(t=>t.includes('On y va')),'« Discussion » ne montre que les paroles');
  dit(!r.champ&&r.puces==='Tout,Combat,Exploration,Discussion','quatre puces à icône, chacune son nom, et pas de champ de recherche',r.puces);
  dit(r.tout>=3&&r.total>=r.tout,'« Tout » remontre le journal entier, rien n’en est retiré')}
 {await p.evaluate(()=>{basculerMode('combat');const b=document.getElementById('debuter-combat');if(b&&!b.hidden)b.click();selected=actors.findIndex(a=>a.hero);marked=new Set([selected]);
   // Un adversaire au contact : l'attaque du premier rond a une cible, le rond n'est pas grisé.
   {const h=actors[selected],adv=actors.find(a=>!a.hero);window.__place=[adv.x,adv.y,adv.vu];adv.x=h.x+3;adv.y=h.y;adv.vu=true;adv.hidden=false}render();if(document.activeElement)document.activeElement.blur();
   window.__clics=[];document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('section.attack-card button');if(b)window.__clics.push(b.dataset.touche)},true)});
  const barre=await p.evaluate(()=>rondsDeLaBarre().map(b=>b.dataset.touche).join('')+'|'+document.querySelectorAll('section.attack-card .attack-row button[data-touche]').length);
  await p.keyboard.press('Digit1');await p.waitForTimeout(150);await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());fermerBulle();render()});
  await p.focus('#journal-texte');await p.keyboard.press('Digit1');await p.keyboard.press('Digit2');await p.evaluate(()=>{document.getElementById('journal-texte').value='';document.activeElement.blur()});
  const clics=await p.evaluate(()=>window.__clics.join(','));
  // La ligne du haut rebâtie hors du rendu (autre combattant choisi, document reçu) garde ses chiffres.
  const rebatie=await p.evaluate(()=>new Promise(ok=>{renderAttackChoices();setTimeout(()=>ok(rondsDeLaBarre().map(b=>b.dataset.touche||'-').join('')),30)}));
  dit(/^1/.test(rebatie)&&!rebatie.includes('-'),'rebâtie hors du rendu, la ligne du haut garde ses chiffres',rebatie);
  // L'icône d'un filtre se choisit parmi celles du site ; sans choix, l'emoji.
  {const r=await p.evaluate(()=>{catalog.logosFiltres={combat:'weapon_cotte.png'};render();const b=document.querySelector('#journal-filtres [data-filtre="combat"]'),t=document.querySelector('#journal-filtres [data-filtre="tout"]');
    const avec=!!b.querySelector('img'),emoji=t.textContent;catalog.logosFiltres={};render();return {avec,emoji,sans:!b.querySelector('img')&&b.textContent==='⚔'}});
   dit(r.avec&&r.emoji==='📜'&&r.sans,'l’icône choisie remplace l’emoji d’un filtre, et l’emoji revient sans choix',JSON.stringify(r))}
  dit(/^1\d*\|0$/.test(barre),'seuls les ronds de la ligne du haut portent leur chiffre',barre);
  dit(clics==='1','la touche 1 joue le premier rond du haut, et rien ne part quand on écrit',clics||'aucun clic');
  await p.evaluate(()=>{const adv=actors.find(a=>!a.hero);[adv.x,adv.y,adv.vu]=window.__place;actors.forEach(a=>{if(Array.isArray(a.checks))a.checks=a.checks.map(()=>0);a.hp=a.max});basculerMode('exploration');actors.forEach(a=>{if(!a.hero)a.vu=false});render()})}
 {const r=await p.evaluate(async()=>{const h=actors[selected],porte=objetDe((h.weapons||[])[0]),autre=catalog.items.find(o=>o.category==='weapon'&&o!==porte&&!(h.weapons||[]).includes(o.id));
   if(!porte||!autre)return {saute:true};
   const ancre=document.getElementById('journal-texte'),d=gearDetail(autre,null,false);d.hidden=false;d.classList.add('large');ouvrirBulle(ancre,d,'bulle-gear');
   /* Sans attendre : un rendu survenu entre-temps refermerait la bulle. */document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift'}));
   const c=document.querySelector('.bulles-comparaison'),avec=c?c.textContent:'';document.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift'}));const apres=!!document.querySelector('.bulles-comparaison');fermerBulle();
   return {vu:!!c,bon:avec.includes(porte.name),apres,porte:porte.name,autre:autre.name}});
  dit(r.saute||(r.vu&&r.bon&&!r.apres),'Maj tenue sur une arme montre à côté celle que porte l’aventurier',JSON.stringify(r))}

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
 {const k=await base(p),r=await lis(p,'session');
  dit(!!r&&r.leger&&r.imagesDedans===0&&r.refs>0&&k.some(c=>c.startsWith('img:')),'la partie enregistrée est légère, ses images rangées à part',r?r.octets+' octets, '+r.refs+' références, '+k.filter(c=>c.startsWith('img:')).length+' images':'rien')}
 // L'export en fichier se relit lui aussi, images dedans.
 dit(await p.evaluate(()=>{const t=JSON.stringify(sauvegardeGlobale()),l=lisSauvegardeGlobale(t,'essai.json');return !!l&&l.actors.length===actors.length&&l.maps.length===maps.length&&!t.includes('amertume-locale:')&&l.maps.every((m,i)=>m.image===maps[i].image)}),'la sauvegarde en fichier se relit, images comprises');

 /* ---------- 6. Une partie enregistrée par une version d'avant (une seule clé « session », images dedans) ---------- */
 etape='Partie d’une version d’avant';console.log(etape);
 await p.evaluate(()=>new Promise((ok,ko)=>{const s=structuredClone(snapshot());s.title='Partie d’avant';s.maps.push({...structuredClone(s.maps[s.maps.length-1]),id:crypto.randomUUID(),name:'Vieille carte',image:(()=>{const c=document.createElement('canvas');c.width=800;c.height=450;const g=c.getContext('2d'),d=g.createImageData(800,450);for(let i=0;i<d.data.length;i+=4){const v=90+(Math.random()*120|0);d.data[i]=v;d.data[i+1]=v*.8;d.data[i+2]=v*.7;d.data[i+3]=255}g.putImageData(d,0,0);return c.toDataURL('image/webp',.8)})()});
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
 {const av=await lis(p,'session:avant-images'),se=await lis(p,'session');
  dit(!!av&&!av.leger&&av.imagesDedans>=2&&av.titre==='Partie d’avant','la partie d’avant est gardée entière, de côté',av?av.imagesDedans+' images dedans':'absente');
  dit(!!se&&se.leger&&se.imagesDedans===0,'et la partie courante est passée à la forme légère')}

 /* ---------- 7. Une image introuvable ne casse rien, et revient si on la rend ---------- */
 etape='Image introuvable';console.log(etape);
 const perdue=await p.evaluate(()=>new Promise(ok=>{const tx=db.transaction('state','readwrite'),st=tx.objectStore('state'),k=st.getAllKeys();
  k.onsuccess=()=>{const c='img:'+cleImage(maps[maps.length-1].image);const g=st.get(c);g.onsuccess=()=>{window.__img=[c,g.result];st.put({cle:c,image:g.result},'essai:image-otee');st.delete(c)};tx.oncomplete=()=>ok(c)}}));
 await p.evaluate(()=>{ongletPerime=true});await p.close();p=await ouvre();
 {const r=await p.evaluate(()=>({cartes:maps.length,refs:maps.filter(m=>typeof m.image==='string'&&m.image.startsWith('amertume-locale:')).length,images:maps.filter(m=>typeof m.image==='string'&&m.image.startsWith('data:image/')).length,acteurs:actors.length}));
  dit(r.acteurs>0&&r.refs===1&&r.images===r.cartes-1,'la partie s’ouvre, seule la carte touchée est sans image',JSON.stringify(r))}
 await p.evaluate(()=>{actors[0].name=actors[0].name.trim()+' !';render()});await enregistre(p);
 {const se=await lis(p,'session');dit(!!se&&se.leger&&se.nom0.endsWith('!'),'elle s’enregistre encore, la référence gardée')}
 await p.evaluate(()=>new Promise(ok=>{const tx=db.transaction('state','readwrite'),st=tx.objectStore('state'),g=st.get('essai:image-otee');g.onsuccess=()=>{st.put(g.result.image,g.result.cle);st.delete('essai:image-otee')};tx.oncomplete=ok}));
 await p.evaluate(()=>{ongletPerime=true});await p.close();p=await ouvre();
 dit(await p.evaluate(()=>maps.every(m=>!m.image||m.image.startsWith('data:image/'))),'l’image rendue, la carte la retrouve');

 /* ---------- 8. Si la forme légère échoue, la partie s'enregistre entière, comme avant ---------- */
 etape='Repli';console.log(etape);
 await p.evaluate(()=>{window.__ap=allegePartie;allegePartie=()=>{throw Error('panne d’essai')};actors[0].name='Repli';render()});await enregistre(p);
 {const se=await lis(p,'session');dit(!!se&&!se.leger&&se.imagesDedans>=2&&se.nom0==='Repli','l’enregistrement se replie sur la forme entière',se?JSON.stringify(se).slice(0,160):'rien')}
 await p.evaluate(()=>{ongletPerime=true});await p.close();p=await ouvre();
 dit(await p.evaluate(()=>actors[0].name==='Repli'&&maps.every(m=>!m.image||m.image.startsWith('data:image/'))),'et se relit');
 await p.evaluate(()=>{render()});await enregistre(p);
 {const se=await lis(p,'session');dit(!!se&&se.leger,'puis repasse à la forme légère')}

 /* ---------- 9. Les copies datées : la veille est gardée, cinq au plus, et se reprend ---------- */
 etape='Copies datées';console.log(etape);
 const hier=await p.evaluate(()=>new Promise(ok=>{const tx=db.transaction('state','readwrite'),st=tx.objectStore('state'),g=st.get('session');
  g.onsuccess=()=>{const s=g.result,j=86400000;s.enregistreLe=Date.now()-j;st.put(s,'session');
   // Six copies plus anciennes : il ne doit en rester que cinq en tout après l'enregistrement du jour.
   for(let i=2;i<=7;i++){const c=structuredClone(s);c.enregistreLe=Date.now()-i*j;st.put(c,'copie:'+jourDe(c.enregistreLe))}
   window.__hier=jourDe(s.enregistreLe)};tx.oncomplete=()=>ok(window.__hier)}));
 await p.evaluate(()=>{ongletPerime=true});await p.close();p=await ouvre();
 const nomHier=await p.evaluate(()=>actors[0].name);
 await p.evaluate(()=>{actors[0].name='Aujourd’hui';render()});await enregistre(p);
 {const k=(await base(p)).filter(c=>/^copie:\d{4}-/.test(c)).sort(),c=await lis(p,'copie:'+hier);
  dit(k.length===5&&k.includes('copie:'+hier),'la veille a sa copie, les cinq dernières sont gardées',k.join(' '));
  dit(!!c&&c.leger&&c.nom0===nomHier,'la copie porte la partie telle qu’elle était la veille')}
 {const l=await p.evaluate(()=>new Promise(ok=>listeCopies(ok)));
  dit(l.length>=6&&l[0].quand>=l[1].quand&&l.some(x=>x.genre==='avant-images')&&l.every(x=>typeof x.resume==='string'&&x.resume.length>0),'la liste des copies se lit, la plus récente d’abord',l.map(x=>x.cle).join(' '))}
 {const r=await p.evaluate(h=>new Promise(ok=>reprendCopie('copie:'+h,(fait,texte)=>setTimeout(()=>ok({fait,texte,nom:actors[0].name,images:maps.every(m=>!m.image||m.image.startsWith('data:image/'))}),500))),hier);
  dit(r.fait&&r.nom===nomHier&&r.images,'reprendre la copie de la veille remet la partie, images comprises',JSON.stringify(r));
  const av=await lis(p,'copie:avant-reprise');dit(!!av&&av.nom0==='Aujourd’hui','et ce qui était enregistré juste avant est gardé')}

 /* ---------- 10. Le Diagnostic des Paramètres : il mesure, liste les copies, fait le ménage sur demande ---------- */
 etape='Diagnostic';console.log(etape);
 await p.evaluate(()=>new Promise(ok=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put('data:image/webp;base64,'+'A'.repeat(40000),'img:essai-orpheline');tx.oncomplete=ok}));
 await p.evaluate(()=>{for(let i=0;i<5;i++)render();signaleErreur('Erreur d’essai','essai');showPage('settings')});
 await p.click('#diag-lancer');await p.waitForFunction(()=>document.querySelectorAll('#diag-lignes .reglage').length>=5,{timeout:8000}).catch(()=>{});
 {const r=await p.evaluate(()=>({lignes:[...document.querySelectorAll('#diag-lignes .reglage')].map(l=>l.querySelector('strong').textContent+' : '+l.querySelector('p').textContent),
   copies:document.querySelectorAll('#diag-copies .reglage').length,visible:!document.getElementById('bloc-diagnostic').hidden,erreurs:document.getElementById('diag-erreurs').textContent}));
  dit(r.visible&&r.lignes.length>=6,'« Mesurer » remplit les lignes du Diagnostic',r.lignes.length+' lignes');
  dit(r.lignes.some(l=>/^Rendu de la table : Médiane [\d,]+ ms/.test(l)),'les rendus sont chronométrés',r.lignes.find(l=>l.startsWith('Rendu'))||'');
  dit(r.lignes.some(l=>/^Enregistrement : Le dernier à .* forme légère/.test(l)),'le dernier enregistrement se lit',r.lignes.find(l=>l.startsWith('Enregistrement'))||'');
  dit(r.lignes.some(l=>/^Images qui ne servent plus : 1 sur /.test(l)),'l’image qui ne sert plus est comptée',r.lignes.find(l=>l.startsWith('Images'))||'');
  dit(r.lignes.some(l=>/^Contenu publié : \d+ cartes? sur 60, \d+ fiches? sur 500/.test(l)),'le contenu publié est mesuré face à ses limites',r.lignes.find(l=>l.startsWith('Contenu'))||'');
  dit(r.copies>=6,'les copies de la partie sont listées',r.copies+' copies');
  dit(r.erreurs.includes('Erreur d’essai'),'une erreur signalée se lit dans les Paramètres')}
 {const avant=(await base(p)).filter(c=>c.startsWith('img:'));
  await p.evaluate(()=>{[...document.querySelectorAll('#diag-lignes .reglage button')].find(b=>b.textContent==='Nettoyer').click()});
  await p.waitForFunction(()=>[...document.querySelectorAll('#diag-lignes .reglage p')].some(x=>x.textContent.startsWith('Aucune sur')),{timeout:8000}).catch(()=>{});
  const apres=(await base(p)).filter(c=>c.startsWith('img:'));
  dit(avant.length-apres.length===1&&!apres.includes('img:essai-orpheline'),'« Nettoyer » n’ôte que l’image qui ne sert plus',avant.length+' → '+apres.length);
  dit(await p.evaluate(()=>maps.every(m=>!m.image||m.image.startsWith('data:image/'))),'les images de la partie sont intactes')}
 await p.evaluate(()=>{ongletPerime=true});await p.close();p=await ouvre();
 dit(await p.evaluate(()=>maps.length>0&&maps.every(m=>!m.image||m.image.startsWith('data:image/'))&&erreursVues.some(e=>e.m==='Erreur d’essai')),'après réouverture : images et journal des erreurs sont là');
 await p.close();
}catch(e){soucis.push(etape+' : l’essai s’est arrêté — '+String(e.message).split('\n')[0])}
finally{await ctx.close().catch(()=>{});serveur.close();try{fs.rmSync(profil,{recursive:true,force:true})}catch(e){}}

const uniques=[...new Set(erreurs)];
if(uniques.length){console.log('Erreurs de page');uniques.forEach(e=>console.log('  ✗ '+e))}
if(soucis.length||uniques.length){console.error('✗ essai en navigateur : '+(soucis.length+uniques.length)+' souci(s)');soucis.forEach(s=>console.error('   '+s));process.exit(1)}
console.log('✓ essai en navigateur : tout passe');
