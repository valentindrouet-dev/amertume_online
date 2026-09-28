/* Publication de contenu MJ. Les parties jouées demeurent locales. */
'use strict';
// Le partage vit dans une fenêtre, ouverte par un bouton de l'en-tête.
const shareDialog=dialog('share-panel','Contenu partagé','<p id="shared-status" class="muted" role="status">Connexion au contenu publié…</p><div class="toolbar"><button id="public-catalog">Consulter les catalogues</button><button id="shared-scene" hidden>Charger la scène publiée</button><button id="shared-login">Connexion MJ</button><button id="shared-publish" hidden>Publier mon contenu</button><button id="shared-logout" hidden>Déconnexion</button></div><label id="shared-auto-label" hidden><input id="shared-auto" type="checkbox" checked> Publier automatiquement mes modifications enregistrées</label><p id="shared-identity" class="muted"></p>');
const shareButton=document.createElement('button');shareButton.id='open-share';shareButton.textContent='Partager';shareButton.onclick=()=>shareDialog.showModal();
document.querySelector('.view-controls').append(shareButton);
let cloud=null,auth=null,admin=false,publishing=false,remote=null,remoteId=null,baseRevision=null,autoReady=false,cloudTimer,unsubscribe,lastPublishedText='',cloudReadGeneration=0;
const status=t=>$('shared-status').textContent=t;
const flagShare=on=>shareButton.classList.toggle('has-news',!!on);
const publicationRef=()=>cloud.doc('amertume_online_public/main');
// Seule la carte ouverte transporte sa mémoire d'exploration : les autres alourdiraient la publication.
function publicMaps(){return structuredClone(maps).map(m=>{if(m.id!==currentMapId){delete m.fog;delete m.seen}return m})}
/* Ce qui, dans le contenu, vaut une publication : les fiches, les cartes, le catalogue —
   pas l'état vivant d'une partie (positions, PV, états, cases cochées, cibles, tour, mode,
   portes ouvertes, mémoire du brouillard, carte ouverte), que la table transporte déjà.
   Sans cela, chaque coup porté republiait tout, images comprises, deux secondes plus
   tard, et chaque joueur retéléchargeait tout : c'était la latence des parties à quatre. */
const CHAMPS_VOLATILS=['x','y','hp','states','bleed','cumuls','checks','target','targets','activeAttack','orbes','garde','revealed','vu','numero','pool','weapons','armures','shieldId','munitionId','auraPv','reposPris','comaVie','etatsPassifs','defBrisee'];
function texteStable(value){const v={...value,round:1,mode:'exploration',locked:false,currentMapId:null,mapImage:null,
  actors:(value.actors||[]).map(a=>{const c={...a};CHAMPS_VOLATILS.forEach(k=>delete c[k]);return c}),
  maps:(value.maps||[]).map(m=>{const c={...m};delete c.fog;delete c.seen;c.doors=(m.doors||[]).map(d=>{const p={...d};delete p.open;return p});return c})};
 return JSON.stringify(v)}
function publicContent(){saveChecks();savePool();return {schema:1,title:sceneTitle(),round,mode,mapImage,maps:publicMaps(),currentMapId,locked:tokensLocked,domaine:typeof domaine!=='undefined'?structuredClone(domaine):null,catalog:structuredClone(catalog),actors:actors.map(a=>({...structuredClone(a),target:null,checks:[false,false,false]}))}}
/* ---------- Les grandes images, publiées à part ----------
   Une carte, un calque du domaine, un grand portrait pèsent des mégaoctets : ensemble, ils
   faisaient passer la publication au-delà de 16 Mo, et chaque republication les renvoyait tous.
   Une grande image part désormais une seule fois, sous l'empreinte de son contenu, dans ses
   propres morceaux (amertume_online_versions/img-<empreinte>) ; la publication n'en garde que la
   référence. Qui la reçoit la télécharge une fois, puis la garde sur son appareil. */
const IMAGES_VUES=new Map(),IMAGES_ENVOYEES=new Set(),EMPREINTES=new Map();let baseImagesP=null;
const moLisible=n=>(n/1048576).toFixed(1).replace('.',',')+' Mo';
function baseImages(){return baseImagesP||=new Promise(r=>{try{const q=indexedDB.open('amertume-images',1);q.onupgradeneeded=()=>q.result.createObjectStore('images');
 q.onsuccess=()=>r(q.result);q.onerror=q.onblocked=()=>r(null)}catch(e){r(null)}})}
async function imageGardee(h){if(IMAGES_VUES.has(h))return IMAGES_VUES.get(h);const b=await baseImages();if(!b)return null;
 return new Promise(r=>{try{const g=b.transaction('images').objectStore('images').get(h);g.onsuccess=()=>{const v=typeof g.result==='string'?g.result:null;if(v)IMAGES_VUES.set(h,v);r(v)};g.onerror=()=>r(null)}catch(e){r(null)}})}
async function gardeImage(h,url){IMAGES_VUES.set(h,url);const b=await baseImages();if(!b)return;try{b.transaction('images','readwrite').objectStore('images').put(url,h)}catch(e){}}
// L'appareil ne garde que les images de la dernière publication lue.
async function elagueImages(gardees){for(const h of [...IMAGES_VUES.keys()])if(!gardees.has(h))IMAGES_VUES.delete(h);const b=await baseImages();if(!b)return;
 try{const st=b.transaction('images','readwrite').objectStore('images'),k=st.getAllKeys();k.onsuccess=()=>k.result.forEach(h=>{if(!gardees.has(h))st.delete(h)})}catch(e){}}
async function empreinte(t){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')}
const morceauxImage=h=>cloud.collection('amertume_online_versions').doc('img-'+h).collection('parts');
/* Chez le MJ : chaque grande image est envoyée si elle ne l'est pas déjà — son dernier morceau
   fait foi —, puis remplacée par sa référence. Un envoi interrompu se complète. */
async function envoieImages(value){const P=SharedData.PART_IMAGE,table=new Map(),vues=new Map();let n=0,octets=0;
 for(const url of SharedData.grandesImages(value)){const h=EMPREINTES.get(url)||await empreinte(url);vues.set(url,h);
  const parts=Math.ceil(url.length/P);table.set(url,SharedData.refImage(h,parts));
  if(!IMAGES_VUES.has(h))gardeImage(h,url);
  if(IMAGES_ENVOYEES.has(h))continue;
  const col=morceauxImage(h);
  if(!(await col.doc(String(parts-1)).get()).exists){const entame=(await col.doc('0').get()).exists;
   status('Envoi d’une image ('+moLisible(url.length)+')…');
   for(let i=0;i<parts;i+=8){const batch=cloud.batch();let k=0;
    for(let j=i;j<Math.min(parts,i+8);j++){if(entame&&(await col.doc(String(j)).get()).exists)continue;batch.set(col.doc(String(j)),{data:url.slice(j*P,(j+1)*P)});k++}
    if(k)await batch.commit()}
   n++;octets+=url.length}
  IMAGES_ENVOYEES.add(h)}
 EMPREINTES.clear();vues.forEach((h,u)=>EMPREINTES.set(u,h));
 return {value:table.size?SharedData.remplace(value,table):value,n,octets}}
/* Chez qui lit : chaque référence redevient son image, prise sur l'appareil ou téléchargée une
   fois, et vérifiée — son empreinte doit être celle annoncée. */
async function rechargeImages(data,gen){const refs=[...SharedData.refsImages(data)];if(!refs.length)return data;
 const table=new Map(),gardees=new Set();let i=0;
 for(const r of refs){const {h,parts}=SharedData.lisRef(r);gardees.add(h);let url=await imageGardee(h);
  if(!url){if(gen!==cloudReadGeneration)return data;status('Téléchargement des images : '+(++i)+'…');
   const m=await Promise.all(Array.from({length:parts},(_,j)=>morceauxImage(h).doc(String(j)).get()));
   if(m.some(x=>!x.exists||typeof x.data().data!=='string'))throw Error('Image publiée incomplète : réessaie plus tard.');
   url=m.map(x=>x.data().data).join('');
   if(!SharedData.estImage(url)||await empreinte(url)!==h)throw Error('Image publiée invalide.');gardeImage(h,url)}
  table.set(r,url)}
 elagueImages(gardees);return SharedData.remplace(data,table)}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('Connexion Firebase indisponible.'));document.head.append(s)})}
function errorText(e){const code=e.code||'';if(code.includes('permission-denied'))return 'Accès Firebase non configuré. Les règles de partage doivent être activées par le MJ.';if(code.includes('unauthorized-domain'))return 'Ajoute valentindrouet-dev.github.io aux domaines autorisés de Firebase Authentication.';if(code.includes('operation-not-allowed'))return 'Active la connexion Google dans Firebase Authentication.';if(code.includes('popup-blocked'))return 'Autorise la fenêtre de connexion Google puis réessaie.';if(code.includes('popup-closed'))return 'Connexion annulée.';return e.message||'Connexion impossible. Les modifications locales sont conservées.'}
async function connectShared(){try{for(const file of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js'])await loadScript('https://www.gstatic.com/firebasejs/10.14.0/'+file);const app=firebase.initializeApp(AMERTUME_FIREBASE,'amertume-online');cloud=app.firestore();auth=app.auth();document.dispatchEvent(new Event('amertume-firebase-prete'));auth.onAuthStateChanged(async user=>{admin=false;autoReady=false;document.dispatchEvent(new Event('amertume-mj-change'));$('shared-publish').hidden=true;$('shared-auto-label').hidden=true;$('shared-login').hidden=!!user;$('shared-logout').hidden=!user;$('shared-identity').textContent='';if(user){$('shared-identity').textContent='Compte connecté : '+(user.email||user.uid)+' · Identifiant MJ : '+user.uid;try{const grant=await cloud.doc('amertume_online_admins/'+user.uid).get({source:'server'});if(auth.currentUser?.uid!==user.uid)return;admin=grant.exists&&grant.data().active===true;document.dispatchEvent(new Event('amertume-mj-change'));$('shared-publish').hidden=!admin;$('shared-auto-label').hidden=!admin;if(admin){view='mj';$('view').value='mj';render();status('MJ autorisé. Publie ton contenu local ou charge la version partagée.')}else status('Compte connecté, mais pas encore autorisé comme MJ. Ajoute cet identifiant aux administrateurs Firebase.')}catch(e){status(errorText(e))}}});unsubscribe=publicationRef().onSnapshot(doc=>readPublished(doc),e=>status(errorText(e)))}catch(e){status(errorText(e));$('shared-login').disabled=true}}
async function readPublished(doc){if(!doc.exists){status('Aucun contenu publié. La scène actuelle reste enregistrée sur cet appareil.');baseRevision=null;return}const m=doc.data();if(m.revision===remoteId)return;const gen=++cloudReadGeneration;try{if(!/^[A-Za-z0-9_-]{1,100}$/.test(m.revision)||!Number.isInteger(m.parts)||m.parts<1||m.parts>86)throw Error('Publication invalide.');const morceaux=await Promise.all(Array.from({length:m.parts},(_,i)=>cloud.doc('amertume_online_versions/'+m.revision+'/parts/'+i).get()));if(morceaux.some(p=>!p.exists))throw Error('Publication incomplète : réessaie plus tard.');const chunks=morceaux.map(p=>p.data().data);const data=await rechargeImages(SharedData.validate(SharedData.unpack(chunks,m.bytes)),gen);if(gen!==cloudReadGeneration)return;remote=data;remoteId=m.revision;if(typeof recoitIcones==='function')recoitIcones(data.icones);if(baseRevision===null)baseRevision=remoteId;$('shared-scene').hidden=false;flagShare(true);if(!admin){status('Catalogue partagé chargé. Tu peux consulter le contenu ou charger la scène publiée.');const enJoueur=()=>{if(admin)return;view='player';$('view').value='player';render()};if(!loading)enJoueur();else document.addEventListener('amertume-partie-chargee',enJoueur,{once:true});/* Seul un invité de la table prend le contenu publié à la place du sien. Le MJ, dont le compte se
   confirme un instant plus tard, gardait sinon sa partie écrasée par sa dernière publication. */
if(typeof tableId!=='undefined'&&tableId&&auth&&auth.currentUser&&auth.currentUser.isAnonymous){status('Contenu de la partie reçu.');applyRemote()}}else status(publishing?'Publication en cours…':'Une version partagée est disponible. Tes modifications locales sont conservées.')}catch(e){status(errorText(e))}}
$('shared-login').onclick=async()=>{if(!auth){status('La connexion Firebase n’est pas prête.');return}try{await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())}catch(e){status(errorText(e))}};
$('shared-logout').onclick=async()=>{if(auth)await auth.signOut();admin=false;autoReady=false;status('Déconnecté. Le contenu publié reste consultable.')};
function applyRemote(){if(!remote)return;if(typeof recoitIcones==='function')recoitIcones(remote.icones);actors.splice(0,actors.length,...structuredClone(remote.actors).map(normalizeActor));catalog=structuredClone(remote.catalog);if(remote.domaine&&typeof normaliseDomaine==='function'){const d=normaliseDomaine(remote.domaine);if(typeof poidsDomaine!=='function'||poidsDomaine(d)>0||poidsDomaine(domaine)===0)domaine=d;domSel=null;domPageSel=null}maps=Array.isArray(remote.maps)?structuredClone(remote.maps):[];currentMapId=remote.currentMapId||null;tokensLocked=remote.locked===true;round=remote.round||1;mode=remote.mode==='exploration'?'exploration':'combat';owner=actors.findIndex(a=>a.hero);selected=owner;mapImage=remote.mapImage||null;sceneTitle(remote.title||'Amertume');$('round').textContent=String(round).padStart(2,'0');$('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);baseRevision=remoteId;view=admin?'mj':'player';$('view').value=view;
 // En table, chez un joueur, c'est la table qui rend : le contenu publié ne pose pas ses valeurs entre-temps.
 if(!(typeof enLigne!=='undefined'&&enLigne&&!admin&&typeof dernierDoc!=='undefined'&&dernierDoc))render();
 scheduleSave();status('Scène partagée chargée.');if(admin){lastPublishedText=texteStable(publicContent());autoReady=true}
 if(typeof reappliquerTable==='function')reappliquerTable();if(typeof renderSieges==='function')renderSieges();
 // Les pages du catalogue tenaient les fiches d'avant : elles se redessinent sur les nouvelles.
 if(typeof renderCatalogPages==='function')renderCatalogPages();
 // Le domaine reçu se lit tout de suite si c'est lui qu'on regarde.
 if(typeof renderDomaine==='function'&&document.body.classList.contains('page-domaine'))renderDomaine()}
$('shared-scene').onclick=()=>{if(confirm('Charger la scène publiée à la place de la scène locale actuelle ?'))applyRemote()};
async function publishShared(explicit=false){if(!admin||!auth?.currentUser){status('Connecte-toi avec un compte MJ autorisé pour publier.');return}if(publishing)return;const value=publicContent(),text=texteStable(value);if(!explicit&&text===lastPublishedText)return;publishing=true;$('shared-publish').disabled=true;let newRef;try{/* Les icônes de planches que le contenu emploie voyagent avec lui : les joueurs n'ouvrent jamais une planche (planches.js). */if(typeof iconesAPublier==='function')value.icones=await iconesAPublier(value);SharedData.validate(value);const envoi=await envoieImages(value);const packed=SharedData.pack(envoi.value);const revision=crypto.randomUUID();newRef=cloud.collection('amertume_online_versions').doc(revision);status('Publication du contenu et des images…');for(let offset=0;offset<packed.chunks.length;offset+=10){const batch=cloud.batch();packed.chunks.slice(offset,offset+10).forEach((data,j)=>batch.set(newRef.collection('parts').doc(String(offset+j)),{data}));await batch.commit()}
 await cloud.runTransaction(async tx=>{const old=await tx.get(publicationRef());const current=old.exists?old.data().revision:null;if(current!==baseRevision)throw Error('Le contenu partagé a changé depuis son chargement. Charge la version partagée avant de republier. Tes modifications locales sont conservées.');tx.set(publicationRef(),{revision,parts:packed.chunks.length,bytes:packed.bytes,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),author:auth.currentUser.uid})});baseRevision=revision;lastPublishedText=text;autoReady=true;status('Contenu publié : le lien de l’app donne accès à cette version sur tous les appareils.'+(envoi.n?' '+envoi.n+' image'+(envoi.n>1?'s':'')+' nouvelle'+(envoi.n>1?'s':'')+' envoyée'+(envoi.n>1?'s':'')+' ('+moLisible(envoi.octets)+').':''));
 }catch(e){autoReady=false;status(errorText(e)+' La publication automatique est suspendue ; utilise Publier pour réessayer.')}finally{publishing=false;$('shared-publish').disabled=false}}
$('shared-publish').onclick=()=>{if(confirm('Publier tous les personnages, monstres, objets, notes et images de cette scène ? Toute personne disposant du lien pourra les consulter.'))publishShared(true)};
function schedulePublish(){if(!admin||!autoReady||!$('shared-auto').checked)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>{if(publishing){schedulePublish();return}publishShared(false)},1800)}
document.addEventListener('submit',e=>{if(['actor-form','item-form','scene-form'].includes(e.target.id))setTimeout(schedulePublish,0)});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&(['save-template','delete-actor','delete-item','reset-map'].includes(b.id)||b.hasAttribute('data-cat-add')||b.hasAttribute('data-cat-delete')))setTimeout(schedulePublish,0)});
document.addEventListener('amertume-content-changed',schedulePublish);
const publicDialog=dialog('shared-catalog','Contenu publié','<p class="muted">Lecture seule. Les modifications locales de ta partie ne changent pas le contenu du MJ.</p><div id="shared-catalog-body"></div>');
$('public-catalog').onclick=()=>{const data=remote;if(!data){status('Aucun catalogue partagé accessible pour le moment. Le MJ doit publier son contenu.');return}const row=(title,body)=>'<details class="catalog-row" style="display:block"><summary>'+esc(title)+'</summary><p style="white-space:pre-wrap">'+esc(body)+'</p></details>';$('shared-catalog-body').innerHTML='<h2>Personnages et combattants</h2>'+data.actors.map(a=>row(a.name,a.role+'\nPV '+a.max+' · DEF '+a.def+' · Dégâts '+a.dmg+'\n'+a.notes)).join('')+'<h2>Bestiaire</h2>'+data.catalog.monsters.map(a=>row(a.name,'PV '+a.pv+' · DEF '+a.def+' · Dégâts '+a.damage+' · XP '+a.xp+'\n'+(a.notes||''))).join('')+'<h2>Armurerie</h2>'+data.catalog.items.map(a=>row(a.name,(a.category==='armor'?'DEF '+a.def:keys.map((k,i)=>a.dice?.[k]?a.dice[k]+' '+types[i]:'').filter(Boolean).join(' · '))+'\n'+(a.effects||'')+'\n'+(a.notes||''))).join('');publicDialog.showModal()};
connectShared();
