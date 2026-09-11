/* ---------- La table en ligne ----------
   Le MJ ouvre une table et partage son lien. Chacun l'ouvre chez soi, choisit
   l'aventurier qu'il incarne, et joue : socles, attaques, portes et points de vie
   se synchronisent en direct.

   Deux étages, pour que rien ne rame :
   · le CONTENU (catalogue, cartes, illustrations) est publié rarement et lourdement
     par shared.js — c'est lui qui donne aux joueurs les fiches et les images ;
   · l'ÉTAT VIVANT (qui est où, à combien de PV, quel état, quelle porte ouverte) tient
     dans un seul petit document que tout le monde écoute et écrit. Quelques kilo-octets,
     donc un aller-retour court.

   L'écriture se fait par différence : après chaque rendu on compare l'état vivant à ce
   qu'on a poussé la dernière fois, et on n'envoie que les champs qui ont bougé, par
   chemin (« actors.<id>.hp »). Firestore fusionne ces chemins un à un : deux joueurs qui
   bougent deux socles différents ne se marchent jamais dessus. Ce qui arrive d'en face
   est appliqué puis retenu comme référence, de sorte qu'on ne le renvoie pas en écho. */
'use strict';
/* Ce qui vit et se synchronise. Les images n'y sont pas : elles voyagent avec le contenu
   publié, une fois pour toutes, et pèsent mille fois plus. */
const CHAMPS_VIVANTS=['name','hero','template','role','type','socle','x','y','hp','max','def','dmg',
 'pool','attacks','weapons','armorId','shieldId','states','bleed','checks','target','activeAttack',
 'revealed','hidden'];
const CHAMPS_MJ=['round','mapId','locked','title'];
const TABLE_CLE='amertume-table';
let tableId=null,salleRef=null,siegesRef=null,enLigne=false,appliquantDistant=false;
let dernierPousse=null,poussePret=false,pousseTimer=null,pousseEnCours=false;
let monUid=null,monSiege=null,sieges={},quitteSalle=null,quitteSieges=null,dernierDoc=null;
// Le socle qu'on tient sous le doigt ne doit pas être replacé par ce qui arrive du réseau.
window.socleEnMain=null;
const estMJ=()=>typeof admin!=='undefined'&&admin===true;
const liveStatus=t=>{const e=$('live-status');if(e)e.textContent=t};

/* ---------- Lecture et écriture de l'état vivant ---------- */
function etatVivant(){const out={actors:{}};
 actors.forEach(a=>{if(!a||!a.id)return;const e={};
  CHAMPS_VIVANTS.forEach(k=>{if(a[k]!==undefined)e[k]=a[k]});
  out.actors[a.id]=e});
 out.round=round;out.locked=!!tokensLocked;
 out.mapId=(typeof currentMapId!=='undefined'&&currentMapId)||null;
 out.title=typeof sceneTitle==='function'?sceneTitle():'';
 const m=typeof currentMap==='function'?currentMap():null;
 out.doors=m?(m.doors||[]).map(d=>!!d.open):[];
 return out}
const pareil=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
/* La différence, en chemins de champs. Un acteur disparu s'efface, un acteur neuf part
   entier — c'est ainsi qu'un adversaire posé en pleine partie arrive chez les joueurs
   sans republier tout le contenu. */
function diffEtat(av,ap){const maj={},SUPPR=firebase.firestore.FieldValue.delete();
 const ids=new Set([...Object.keys(av&&av.actors||{}),...Object.keys(ap.actors||{})]);
 ids.forEach(id=>{const a=(av&&av.actors||{})[id],b=ap.actors[id];
  if(!b){maj['actors.'+id]=SUPPR;return}
  if(!a){maj['actors.'+id]=b;return}
  CHAMPS_VIVANTS.forEach(k=>{if(!pareil(a[k],b[k]))maj['actors.'+id+'.'+k]=b[k]===undefined?SUPPR:b[k]})});
 if(!pareil(av&&av.doors,ap.doors))maj.doors=ap.doors;
 // Le tour, la carte ouverte, le verrou et le titre appartiennent au MJ.
 if(estMJ())CHAMPS_MJ.forEach(k=>{if(!pareil(av&&av[k],ap[k]))maj[k]=ap[k]});
 return maj}
function pousserPlusTard(){if(!enLigne||appliquantDistant||!poussePret)return;
 clearTimeout(pousseTimer);pousseTimer=setTimeout(pousserEtat,140)}
async function pousserEtat(){if(!enLigne||!salleRef||pousseEnCours)return;
 const ap=etatVivant(),maj=diffEtat(dernierPousse,ap);
 if(!Object.keys(maj).length)return;
 pousseEnCours=true;const avant=dernierPousse;dernierPousse=ap;
 try{maj.at=firebase.firestore.FieldValue.serverTimestamp();await salleRef.update(maj)}
 catch(e){dernierPousse=avant;liveStatus('Envoi impossible : '+(e.message||e.code||'réseau'))}
 finally{pousseEnCours=false}}

/* Un combattant que l'on ne connaît pas encore : on le rebâtit depuis le bestiaire publié,
   et à défaut depuis ce que l'état vivant en dit. Son identifiant est celui de la table. */
function instancierActeur(id,e){
 let a=null;
 if(e.template&&typeof fromMonster==='function'){
  const m=(catalog.monsters||[]).find(x=>x.id===e.template);
  if(m)a=fromMonster(m)}
 if(!a)a={...baseActor(e.hero===true)};
 a.id=id;normalizeActor(a);return a}
function appliquerSalle(d){if(!d)return;
 appliquantDistant=true;
 try{
  if(!estMJ()){
   if(Number.isFinite(d.round))round=d.round;
   if(typeof d.locked==='boolean')tokensLocked=d.locked;
   if(typeof d.title==='string'&&typeof sceneTitle==='function')sceneTitle(d.title);
   if(d.mapId&&d.mapId!==currentMapId&&maps.some(m=>m.id===d.mapId)){
    currentMapId=d.mapId;const m=currentMap();mapImage=m&&m.image||null;
    $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';
    $('map').classList.toggle('custom',!!mapImage)}}
  const vus=new Set();
  Object.entries(d.actors||{}).forEach(([id,e])=>{if(!e||typeof e!=='object')return;
   vus.add(id);
   let a=actors.find(x=>x.id===id);
   if(!a){a=instancierActeur(id,e);actors.push(a)}
   // Ce qu'on tient sous le doigt garde sa place : le réseau ne le reprend pas en main.
   const enMain=window.socleEnMain===id;
   CHAMPS_VIVANTS.forEach(k=>{if(e[k]===undefined)return;
    if(enMain&&(k==='x'||k==='y'))return;
    if(!pareil(a[k],e[k]))a[k]=structuredClone(e[k])});
   normalizeActor(a)});
  // La composition de la scène appartient au MJ : chez les joueurs, ce qui n'y est plus s'en va.
  if(!estMJ())for(let i=actors.length-1;i>=0;i--)if(!vus.has(actors[i].id))actors.splice(i,1);
  const m=typeof currentMap==='function'?currentMap():null;
  if(m&&Array.isArray(d.doors))(m.doors||[]).forEach((p,i)=>{if(typeof d.doors[i]==='boolean')p.open=d.doors[i]});
  if(selected!==null&&!actors[selected])selected=null;
  if(monSiege){const i=actors.findIndex(a=>a.id===monSiege);if(i>=0)owner=i}
  if(typeof marked!=='undefined')marked=new Set([...marked].filter(id=>actors.some(a=>a.id===id)));
  $('round').textContent=String(round).padStart(2,'0');
  render();
 }finally{appliquantDistant=false;dernierPousse=etatVivant();poussePret=true}}

/* Le contenu publié vient d'être posé : il a remplacé les fiches et les cartes, donc
   l'état vivant doit être reposé par-dessus, sans quoi la table reculerait d'un cran. */
function reappliquerTable(){if(dernierDoc)appliquerSalle(dernierDoc)}
/* ---------- Sièges : qui incarne qui ---------- */
function renderSieges(){const boite=$('live-sieges');if(!boite)return;boite.replaceChildren();
 const troupe=actors.filter(a=>a.hero);
 if(!troupe.length){const v=document.createElement('p');v.className='muted';
  v.textContent='Aucun aventurier dans la scène publiée.';boite.append(v);return}
 troupe.forEach(a=>{
  const occupant=Object.entries(sieges).find(([,s])=>s&&s.actorId===a.id);
  const b=document.createElement('button');
  b.className='actor pick-ligne'+(monSiege===a.id?' selected':'');
  const vignette=document.createElement('span');vignette.className='vignette';
  const socle=document.createElement('span');socle.className='avatar';
  if(a.image){const im=document.createElement('img');im.src=a.image;im.alt='';im.draggable=false;socle.append(im)}
  else socle.textContent=(a.name||'?')[0].toUpperCase();
  vignette.append(socle);
  const corps=document.createElement('span');corps.className='actor-body';
  const nom=document.createElement('span');nom.className='actor-nom';
  const t=document.createElement('strong');t.textContent=a.name;nom.append(t);
  const etat=document.createElement('small');
  etat.textContent=occupant?(occupant[0]===monUid?'Tu l’incarnes':'Pris par un autre joueur'):'Libre';
  corps.append(nom,etat);
  const marque=document.createElement('span');marque.className='pick-etat';
  marque.textContent=monSiege===a.id?'✓':occupant?'•':'+';
  b.append(vignette,corps,marque);
  b.disabled=!!occupant&&occupant[0]!==monUid;
  b.onclick=()=>monSiege===a.id?libererSiege():prendreSiege(a);
  boite.append(b)})}
async function prendreSiege(a){if(!siegesRef||!monUid)return;
 try{await siegesRef.doc(monUid).set({actorId:a.id,nom:a.name,at:firebase.firestore.FieldValue.serverTimestamp()});
  monSiege=a.id;localStorage.setItem(TABLE_CLE+'-siege',a.id);
  const i=actors.findIndex(x=>x.id===a.id);
  if(i>=0){owner=i;selected=i;markOnly(i);$('owner').value=String(i)}
  if(!estMJ()){view='player';$('view').value='player'}
  render();renderSieges();liveStatus('Tu incarnes '+a.name+'.')}
 catch(e){liveStatus('Impossible de prendre ce siège : '+(e.message||e.code))}}
async function libererSiege(){if(!siegesRef||!monUid)return;
 try{await siegesRef.doc(monUid).delete();monSiege=null;localStorage.removeItem(TABLE_CLE+'-siege');
  renderSieges();liveStatus('Siège libéré.')}catch(e){liveStatus(e.message||'Échec')}}

/* ---------- Ouvrir, rejoindre ---------- */
function lienTable(code){const u=new URL(location.href);u.searchParams.set('table',code);
 u.hash='';return u.toString()}
function codeNeuf(){const lettres='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';
 const r=crypto.getRandomValues(new Uint8Array(10));
 for(const v of r)s+=lettres[v%lettres.length];
 return s.slice(0,5)+'-'+s.slice(5)}
async function ouvrirTable(){if(!cloud||!auth||!auth.currentUser){liveStatus('Connexion Firebase pas encore prête.');return}
 if(!estMJ()){liveStatus('Seul un MJ connecté peut ouvrir une table.');return}
 monUid=auth.currentUser.uid;
 const code=codeNeuf();
 try{await cloud.doc('amertume_online_live/'+code).set({...etatVivant(),
   mj:auth.currentUser.uid,at:firebase.firestore.FieldValue.serverTimestamp()});
  localStorage.setItem(TABLE_CLE,code);brancherTable(code);
  liveStatus('Table ouverte. Partage le lien à tes joueurs.')}
 catch(e){liveStatus('Ouverture impossible : '+(e.message||e.code))}}
async function fermerTable(){if(!estMJ()||!tableId)return;
 if(!confirm('Fermer la table ? Les joueurs connectés ne verront plus la partie.'))return;
 try{await salleRef.delete()}catch(e){}
 debrancherTable();localStorage.removeItem(TABLE_CLE);liveStatus('Table fermée.')}
function debrancherTable(){if(quitteSalle)quitteSalle();if(quitteSieges)quitteSieges();
 quitteSalle=quitteSieges=null;enLigne=false;poussePret=false;tableId=null;salleRef=siegesRef=null;
 sieges={};monSiege=null;majTable()}
function brancherTable(code){if(!cloud)return;debrancherTable();
 tableId=code;salleRef=cloud.doc('amertume_online_live/'+code);
 siegesRef=salleRef.collection('seats');
 enLigne=true;poussePret=false;dernierPousse=null;
 quitteSalle=salleRef.onSnapshot(doc=>{
  if(!doc.exists){liveStatus('Cette table n’existe plus.');debrancherTable();return}
  dernierDoc=doc.data();appliquerSalle(dernierDoc);majTable()},
  e=>liveStatus('Écoute interrompue : '+(e.message||e.code)));
 quitteSieges=siegesRef.onSnapshot(s=>{sieges={};s.forEach(d=>sieges[d.id]=d.data());
  const mien=monUid&&sieges[monUid];monSiege=mien?mien.actorId:null;
  if(monSiege){const i=actors.findIndex(a=>a.id===monSiege);if(i>=0)owner=i}
  renderSieges();majTable()},()=>{});
 majTable()}
/* La fenêtre ne cache plus ses boutons : elle les montre, grisés quand il manque quelque
   chose, et dit lequel. Masquer « Ouvrir une table » tant que le MJ n'était pas reconnu ne
   laissait qu'une fenêtre vide, sans rien à faire ni rien à comprendre. */
function majTable(){const ouvert=!!tableId,pret=!!cloud&&typeof firebase!=='undefined';
 const connecte=!!(auth&&auth.currentUser),mj=estMJ();
 const ligne=$('live-lien');if(ligne){ligne.hidden=!ouvert;if(ouvert)ligne.value=lienTable(tableId)}
 const montre=(id,vu,off,pourquoi)=>{const e=$(id);if(!e)return;
  e.hidden=!vu;e.disabled=!!off;e.title=off?pourquoi:''};
 montre('live-open',!ouvert,!pret||!mj,
  !pret?'La bibliothèque Firebase n’est pas chargée.'
  :!connecte?'Connecte-toi d’abord avec ton compte MJ.'
  :'Ce compte n’est pas encore autorisé comme MJ.');
 montre('live-login',!ouvert&&!mj,!pret,'La bibliothèque Firebase n’est pas chargée.');
 montre('live-close',ouvert&&mj,false,'');
 montre('live-quit',ouvert&&!mj,false,'');
 montre('live-copy',ouvert,false,'');
 ['live-sieges','live-titre-sieges'].forEach(id=>{const e=$(id);if(e)e.hidden=!ouvert});
 const b=$('open-live');if(b){b.classList.toggle('has-news',ouvert);
  b.textContent=ouvert?'Table · '+tableId:'Table en ligne'}
 const c=$('live-compte');if(c)c.textContent=ouvert
  ?Object.keys(sieges).length+' joueur(s) assis · table '+tableId:'';
 if(ouvert)return;
 liveStatus(!pret?'Firebase ne répond pas : vérifie la connexion, ou un bloqueur qui empêcherait gstatic.com. La partie reste jouable sur cet appareil.'
  :!connecte?'Connecte-toi avec ton compte MJ pour ouvrir une table. Tes joueurs, eux, n’auront rien à créer : le lien suffira.'
  :!mj?'Compte connecté, mais pas encore autorisé comme MJ. Ajoute son identifiant aux administrateurs Firebase — il est écrit dans la fenêtre Partager.'
  :'Prêt. Ouvre une table, puis envoie son lien à tes joueurs.')}

/* ---------- La fenêtre ---------- */
const liveDialog=dialog('live-panel','Table en ligne',
 '<p id="live-status" class="muted" role="status">Table hors ligne : la partie reste sur cet appareil.</p>'
 +'<div class="toolbar"><button id="live-open" hidden>Ouvrir une table</button>'
 +'<button id="live-login" hidden>Connexion MJ</button>'
 +'<button id="live-close" hidden>Fermer la table</button>'
 +'<button id="live-quit" hidden>Quitter la table</button>'
 +'<button id="live-copy" hidden>Copier le lien</button></div>'
 +'<input id="live-lien" readonly hidden aria-label="Lien de la table">'
 +'<p class="muted" id="live-compte"></p>'
 +'<h2 class="sous-titre" id="live-titre-sieges" hidden>Qui incarne qui</h2><div id="live-sieges" hidden></div>');
const liveButton=document.createElement('button');liveButton.id='open-live';
liveButton.textContent='Table en ligne';liveButton.onclick=()=>{renderSieges();majTable();liveDialog.showModal()};
document.querySelector('.view-controls').append(liveButton);
$('live-open').onclick=ouvrirTable;
$('live-login').onclick=()=>{const b=$('shared-login');if(b)b.click();
 liveStatus('Fenêtre de connexion Google ouverte…')};
document.addEventListener('amertume-mj-change',majTable);
document.addEventListener('amertume-firebase-prete',majTable);
$('live-close').onclick=fermerTable;
$('live-quit').onclick=()=>{libererSiege();debrancherTable();
 const u=new URL(location.href);u.searchParams.delete('table');history.replaceState(null,'',u);
 liveStatus('Table quittée. La partie reste sur cet appareil.')};
$('live-copy').onclick=async()=>{try{await navigator.clipboard.writeText(lienTable(tableId));
 liveStatus('Lien copié : donne-le à tes joueurs.')}catch(e){$('live-lien').select()}};

/* ---------- Branchement ---------- */
/* Le lien porte le code de la table. Un joueur n'a rien à installer ni à créer : une
   connexion anonyme lui donne un identifiant, le temps de la partie. */
document.addEventListener('amertume-firebase-prete',async()=>{
 const code=new URL(location.href).searchParams.get('table')||localStorage.getItem(TABLE_CLE);
 if(!code)return;
 try{if(!auth.currentUser)await auth.signInAnonymously()}catch(e){
  liveStatus('Connexion anonyme refusée : le MJ doit l’activer dans Firebase. '+(e.code||''));return}
 monUid=auth.currentUser?auth.currentUser.uid:null;
 auth.onAuthStateChanged(u=>{monUid=u?u.uid:null;majTable()});
 brancherTable(code);
 liveStatus('Table rejointe. Choisis l’aventurier que tu incarnes.');
 setTimeout(()=>{if(!monSiege&&!estMJ())liveDialog.showModal()},1200)});

// Après chaque rendu, ce qui a bougé part sur le réseau — et rien d'autre.
const renderAvantTable=render;render=function(){renderAvantTable();pousserPlusTard()};
majTable();
