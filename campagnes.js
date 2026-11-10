/* Les campagnes : l'état d'une partie — la troupe (XP, équipement, talents), les adversaires
   en scène, le domaine, la scène en cours et la progression sur les cartes (brouillard, voile,
   portes ouvertes) — enregistré sous un nom, sur cet appareil, pour y revenir plus tard ou
   mener plusieurs tables de front. Le contenu du jeu — talents, armurerie, bestiaire, cartes —
   est commun à toutes : ouvrir une campagne ne le touche pas. Tout vit dans la base locale,
   à côté de la partie en cours ; une campagne s'exporte aussi en fichier, pour la garder
   ailleurs ou la porter sur un autre appareil. */
'use strict';
const CLE_CAMPAGNES='campagnes',PREFIXE_CAMPAGNE='campagne:';
let campagnes=[],campagneOuverte=null;

/* ---------- La base locale ---------- */
// La même base que la partie en cours (« db », ouverte par l'éditeur), sous d'autres clés.
function lireCampagneCle(cle){return new Promise((res,rej)=>{if(!db)return res(undefined);
 try{const r=db.transaction('state').objectStore('state').get(cle);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}})}
function ecritCampagneCle(cle,valeur){return new Promise((res,rej)=>{if(!db)return rej(Error('Sauvegarde locale indisponible dans ce navigateur.'));
 try{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(valeur,cle);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)}catch(e){rej(e)}})}
function effaceCampagneCle(cle){return new Promise((res,rej)=>{if(!db)return res();
 try{const tx=db.transaction('state','readwrite');tx.objectStore('state').delete(cle);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)}catch(e){rej(e)}})}

/* ---------- Ce qu'une campagne retient ---------- */
/* La progression sur les cartes : le brouillard, ce qu'on y a vu, le voile levé et les portes
   ouvertes — par carte, à son identifiant. Les cartes elles-mêmes restent au contenu du jeu. */
function etatCartes(liste){const out={};(liste||[]).forEach(m=>{if(!m||!m.id)return;
 out[m.id]={fog:typeof m.fog==='string'?m.fog:null,seen:typeof m.seen==='string'?m.seen:null,fogOff:m.fogOff===true,portes:(m.doors||[]).map(d=>!!(d&&d.open))}});return out}
function poseEtatCartes(liste,etat){if(!etat||typeof etat!=='object')return liste;
 (liste||[]).forEach(m=>{const e=m&&etat[m.id];if(!e||typeof e!=='object')return;
  if(typeof e.fog==='string')m.fog=e.fog;else delete m.fog;
  if(typeof e.seen==='string')m.seen=e.seen;else delete m.seen;
  m.fogOff=e.fogOff===true;
  (m.doors||[]).forEach((d,i)=>{if(d&&Array.isArray(e.portes)&&typeof e.portes[i]==='boolean')d.open=e.portes[i]})});return liste}
function partieCourante(){if(typeof saveChecks==='function')saveChecks();if(typeof savePool==='function')savePool();const s=snapshot();
 return {actors:structuredClone(s.actors),round:s.round,mode:s.mode,owner:s.owner,selected:s.selected,mapImage:s.mapImage||null,currentMapId:s.currentMapId||null,title:s.title||'',
  locked:typeof tokensLocked!=='undefined'&&tokensLocked===true,domaine:structuredClone(s.domaine||null),cartes:etatCartes(s.maps)}}
function resumePartie(p){const l=Array.isArray(p&&p.actors)?p.actors:[];const av=l.filter(a=>a&&a.hero).length,adv=l.length-av;
 return av+' aventurier'+(av>1?'s':'')+(adv?' · '+adv+' adversaire'+(adv>1?'s':''):'')+(p&&p.domaine&&p.domaine.nom?' · '+p.domaine.nom:'')+' · tour '+(Number(p&&p.round)||1)}
function verifieCampagne(o){if(!o||typeof o!=='object'||Array.isArray(o)||o.genre!=='campagne'||!o.partie||typeof o.partie!=='object'||Array.isArray(o.partie))return 'Ce fichier n’est pas une campagne d’Amertume Online.';
 const p=o.partie;if(!Array.isArray(p.actors)||p.actors.length>500||!p.actors.every(a=>a&&typeof a==='object'&&typeof a.name==='string'))return 'La campagne ne contient pas de troupe lisible.';return ''}
/* Ouvrir : la partie en cours prend la troupe, le domaine, la scène et la progression de la
   campagne ; le catalogue et les cartes restent ceux d'aujourd'hui. Une carte que la campagne
   ouvrait et qui n'existe plus laisse la table sans carte, sans rien casser. */
function appliquerPartie(p){const cartes=poseEtatCartes(structuredClone(maps),p.cartes);
 const s=Object.assign(snapshot(),{actors:structuredClone(p.actors||[]),round:p.round,mode:p.mode,owner:p.owner,selected:p.selected,mapImage:typeof p.mapImage==='string'?p.mapImage:null,
  currentMapId:cartes.some(m=>m.id===p.currentMapId)?p.currentMapId:null,title:p.title||'',locked:p.locked===true,maps:cartes,domaine:p.domaine||null});
 appliquerSauvegarde(s);if(typeof refreshMapPick==='function')refreshMapPick();renderCatalogPages();render();saveNow();document.dispatchEvent(new Event('amertume-content-changed'))}

/* ---------- Le bloc des Paramètres ---------- */
const blocCampagnes=document.createElement('div');blocCampagnes.id='bloc-campagnes';
blocCampagnes.innerHTML='<div class="divider"></div><h3 class="reglage-titre">Campagnes</h3>'
 +'<p class="muted">Une campagne, c’est l’état d’une partie : la troupe — XP, équipement, talents —, les adversaires en scène, le domaine, la scène en cours et la progression sur les cartes. Le contenu du jeu — talents, armurerie, bestiaire, cartes — est commun à toutes et ne change pas quand on en ouvre une.</p>'
 +'<div class="reglage"><div><strong id="campagne-ouverte">Aucune campagne ouverte</strong><p class="muted" id="campagne-ouverte-detail">Enregistre la partie en cours sous un nom pour commencer.</p></div>'
 +'<button id="campagne-enregistrer" class="primary" hidden>Enregistrer</button></div>'
 +'<div class="edit-grid inv-ajout"><label>Nouvelle campagne<input id="campagne-nom" maxlength="60" placeholder="Nom de la campagne"></label><button id="campagne-creer">Enregistrer la partie sous ce nom</button></div>'
 +'<div id="campagne-liste" class="campagne-liste"></div>'
 +'<div class="side-actions"><button id="campagne-importer">⇧ Importer une campagne</button><input type="file" id="campagne-fichier" accept=".json,application/json" hidden></div>'
 +'<p class="form-error" id="campagne-erreur" role="status" aria-live="polite"></p>';
// Le bloc se range dans les Paramètres, juste avant la sauvegarde globale.
{const ancre=[...settingsPage.querySelectorAll('h3.reglage-titre')].find(h=>h.textContent==='Sauvegarde globale');
 const div=ancre&&ancre.previousElementSibling;if(div&&div.classList.contains('divider'))div.before(blocCampagnes);else settingsPage.firstElementChild.append(blocCampagnes)}
const noteCampagne=t=>{$('campagne-erreur').textContent=t||''};
const dateCampagne=t=>t?new Date(t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
// La campagne ouverte est un repère d'appareil, comme l'onglet : elle ne voyage pas.
function retientCampagne(id){campagneOuverte=id||null;try{if(id)localStorage.setItem('amertume-campagne',id);else localStorage.removeItem('amertume-campagne')}catch(e){}}
async function chargeCampagnes(){try{const l=await lireCampagneCle(CLE_CAMPAGNES);campagnes=Array.isArray(l)?l.filter(c=>c&&typeof c.id==='string'&&typeof c.nom==='string'):[]}catch(e){campagnes=[]}
 let id=null;try{id=localStorage.getItem('amertume-campagne')}catch(e){}
 campagneOuverte=id&&campagnes.some(c=>c.id===id)?id:null;renderCampagnes()}
function renderCampagnes(){const liste=$('campagne-liste');if(!liste)return;liste.replaceChildren();
 const ouverte=campagnes.find(c=>c.id===campagneOuverte)||null;
 $('campagne-ouverte').textContent=ouverte?'Campagne ouverte : '+ouverte.nom:'Aucune campagne ouverte';
 $('campagne-ouverte-detail').textContent=ouverte?ouverte.resume+' · enregistrée le '+dateCampagne(ouverte.modifie):'Enregistre la partie en cours sous un nom pour commencer.';
 $('campagne-enregistrer').hidden=!ouverte;
 if(!campagnes.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucune campagne enregistrée sur cet appareil.';liste.append(p);return}
 [...campagnes].sort((a,b)=>(b.modifie||0)-(a.modifie||0)).forEach(c=>{const row=document.createElement('div');row.className='campagne-ligne'+(c.id===campagneOuverte?' ouverte':'');
  const texte=document.createElement('div');texte.className='campagne-texte';
  const nom=document.createElement('strong');nom.textContent=c.nom+(c.id===campagneOuverte?' — ouverte':'');
  const det=document.createElement('small');det.textContent=c.resume+' · '+dateCampagne(c.modifie)+(c.octets?' · '+tailleLisible(c.octets):'');
  texte.append(nom,det);
  const outils=document.createElement('div');outils.className='campagne-outils';
  const bouton=(txt,titre,fn,cls)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.title=titre;if(cls)b.className=cls;b.onclick=fn;outils.append(b)};
  if(c.id!==campagneOuverte)bouton('Ouvrir','Reprendre cette campagne à la place de la partie en cours',()=>ouvreCampagne(c.id),'primary');
  bouton('Enregistrer ici','Écraser cette campagne avec la partie en cours',()=>enregistreCampagne(c.id,c.nom,true));
  bouton('✎','Renommer',()=>renommeCampagne(c.id));bouton('⇩','Exporter dans un fichier',()=>exporteCampagne(c.id));bouton('✕','Supprimer',()=>supprimeCampagne(c.id),'dom-danger');
  row.append(texte,outils);liste.append(row)})}
async function enregistreCampagne(id,nom,demande){if(view!=='mj')return;noteCampagne('');
 const c=campagnes.find(x=>x.id===id);
 if(demande&&c&&c.id!==campagneOuverte&&!confirm('Écraser « '+c.nom+' » avec la partie en cours ?\n'+c.resume+' → sera remplacé.'))return;
 try{const partie=partieCourante(),t=Date.now();
  const rec={app:'amertume_online',genre:'campagne',version:1,id,nom,cree:c?c.cree:t,modifie:t,partie};
  const octets=JSON.stringify(rec).length;await ecritCampagneCle(PREFIXE_CAMPAGNE+id,rec);
  const entree={id,nom,cree:rec.cree,modifie:t,resume:resumePartie(partie),octets};
  if(c)Object.assign(c,entree);else campagnes.push(entree);
  await ecritCampagneCle(CLE_CAMPAGNES,campagnes);retientCampagne(id);renderCampagnes();
  log('Campagne enregistrée : '+nom+' — '+entree.resume+'.',{local:true})}
 catch(e){noteCampagne('Enregistrement impossible : '+(e&&e.message||e))}}
function creeCampagne(){if(view!=='mj')return;const champ=$('campagne-nom'),nom=champ.value.trim().slice(0,60);
 if(!nom){noteCampagne('Donne un nom à la campagne.');champ.focus();return}
 if(campagnes.some(c=>c.nom.toLowerCase()===nom.toLowerCase())){noteCampagne('Une campagne porte déjà ce nom : ouvre-la, ou choisis-en un autre.');return}
 champ.value='';enregistreCampagne(crypto.randomUUID(),nom,false)}
async function ouvreCampagne(id){if(view!=='mj')return;const c=campagnes.find(x=>x.id===id);if(!c)return;noteCampagne('');
 let rec;try{rec=await lireCampagneCle(PREFIXE_CAMPAGNE+id)}catch(e){rec=null}
 if(!rec||!rec.partie){noteCampagne('Cette campagne est introuvable sur cet appareil.');return}
 const actuelle=campagnes.find(x=>x.id===campagneOuverte);
 if(!confirm('Ouvrir « '+c.nom+' » ?\n'+c.resume+'.\nLa partie en cours sera remplacée'+(actuelle?' — enregistre-la d’abord dans « '+actuelle.nom+' » si tu veux garder son avancée.':'.')))return;
 try{appliquerPartie(rec.partie)}catch(e){noteCampagne('Ouverture impossible : '+(e&&e.message||e));return}
 retientCampagne(id);renderCampagnes();log('Campagne ouverte : '+c.nom+' — '+c.resume+'.',{local:true})}
async function renommeCampagne(id){const c=campagnes.find(x=>x.id===id);if(!c)return;const nom=prompt('Nom de la campagne',c.nom);if(nom===null)return;
 const n=nom.trim().slice(0,60);if(!n)return;c.nom=n;
 try{const rec=await lireCampagneCle(PREFIXE_CAMPAGNE+id);if(rec){rec.nom=n;await ecritCampagneCle(PREFIXE_CAMPAGNE+id,rec)}await ecritCampagneCle(CLE_CAMPAGNES,campagnes)}catch(e){noteCampagne('Renommage non enregistré : '+(e&&e.message||e))}
 renderCampagnes()}
async function supprimeCampagne(id){const c=campagnes.find(x=>x.id===id);if(!c||!confirm('Supprimer la campagne « '+c.nom+' » de cet appareil ? La partie en cours n’est pas touchée.'))return;
 try{await effaceCampagneCle(PREFIXE_CAMPAGNE+id);campagnes=campagnes.filter(x=>x.id!==id);await ecritCampagneCle(CLE_CAMPAGNES,campagnes)}catch(e){noteCampagne('Suppression non enregistrée : '+(e&&e.message||e))}
 if(campagneOuverte===id)retientCampagne(null);renderCampagnes()}
function nomFichierCampagne(nom,d=new Date()){const p=n=>String(n).padStart(2,'0');
 const s=String(nom||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,40)||'campagne';
 return 'amertume-campagne-'+s+'-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.json'}
async function exporteCampagne(id){const c=campagnes.find(x=>x.id===id);let rec;try{rec=await lireCampagneCle(PREFIXE_CAMPAGNE+id)}catch(e){rec=null}
 if(!c||!rec){noteCampagne('Cette campagne est introuvable sur cet appareil.');return}
 const texte=JSON.stringify({...rec,exporte:new Date().toISOString()});const url=URL.createObjectURL(new Blob([texte],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=nomFichierCampagne(c.nom);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 log('Campagne exportée : '+a.download+' ('+tailleLisible(texte.length)+').',{local:true})}
// Importer ajoute la campagne à la liste, sans l'ouvrir : on la reprend quand on veut.
function importeCampagne(fichier){if(view!=='mj')return;noteCampagne('');
 fichier.text().then(async texte=>{let o;try{o=JSON.parse(texte)}catch(e){throw Error('ce fichier n’est pas du JSON lisible.')}
  const souci=verifieCampagne(o);if(souci)throw Error(souci);
  const id=crypto.randomUUID(),t=Date.now(),nom=String(o.nom||fichier.name.replace(/\.json$/i,'')).trim().slice(0,60)||'Campagne';
  const rec={app:'amertume_online',genre:'campagne',version:1,id,nom,cree:Number(o.cree)||t,modifie:t,partie:o.partie};
  await ecritCampagneCle(PREFIXE_CAMPAGNE+id,rec);
  campagnes.push({id,nom,cree:rec.cree,modifie:t,resume:resumePartie(o.partie),octets:texte.length});await ecritCampagneCle(CLE_CAMPAGNES,campagnes);
  renderCampagnes();log('Campagne importée : '+nom+' — elle est dans la liste, pas encore ouverte.',{local:true})})
 .catch(e=>noteCampagne('Import refusé : '+(e&&e.message||e)))}
/* La sauvegarde globale emporte toutes les campagnes de l'appareil, et laquelle est ouverte. À l'import, une
   campagne manquante s'ajoute ; une campagne déjà là, aussi récente ou plus, reste telle quelle. */
ANNEXES_SAUVEGARDE.push({nom:'les campagnes',
 lit:async()=>{if(!db)throw Error('base locale indisponible');const liste=await lireCampagneCle(CLE_CAMPAGNES),out=[];
  for(const c of Array.isArray(liste)?liste:[]){if(!c||typeof c.id!=='string')continue;const rec=await lireCampagneCle(PREFIXE_CAMPAGNE+c.id);if(rec&&rec.partie)out.push(rec)}
  return {campagnes:out,campagneOuverte}},
 pose:async s=>{if(!Array.isArray(s.campagnes))return;if(!db)throw Error('base locale indisponible');let change=false;
  for(const rec of s.campagnes){if(verifieCampagne(rec)||typeof rec.id!=='string'||!/^[\w-]{1,80}$/.test(rec.id))continue;
   const c=campagnes.find(x=>x.id===rec.id),t=Number(rec.modifie)||Date.now();if(c&&(c.modifie||0)>=t)continue;
   const nom=String(rec.nom||'').trim().slice(0,60)||'Campagne';
   const propre={app:'amertume_online',genre:'campagne',version:1,id:rec.id,nom,cree:Number(rec.cree)||t,modifie:t,partie:rec.partie};
   await ecritCampagneCle(PREFIXE_CAMPAGNE+rec.id,propre);
   const entree={id:rec.id,nom,cree:propre.cree,modifie:t,resume:resumePartie(rec.partie),octets:JSON.stringify(propre).length};
   if(c)Object.assign(c,entree);else campagnes.push(entree);change=true}
  if(change)await ecritCampagneCle(CLE_CAMPAGNES,campagnes);
  // La partie importée est celle de la campagne qui était ouverte : le repère la suit.
  if(s.campagneOuverte===null||typeof s.campagneOuverte==='string')retientCampagne(s.campagneOuverte&&campagnes.some(c=>c.id===s.campagneOuverte)?s.campagneOuverte:null);
  renderCampagnes()}});
$('campagne-creer').onclick=creeCampagne;
$('campagne-nom').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();creeCampagne()}};
$('campagne-enregistrer').onclick=()=>{const c=campagnes.find(x=>x.id===campagneOuverte);if(c)enregistreCampagne(c.id,c.nom,false)};
$('campagne-importer').onclick=()=>{if(view!=='mj')return;$('campagne-fichier').click()};
$('campagne-fichier').onchange=()=>{const f=$('campagne-fichier').files[0];$('campagne-fichier').value='';if(f)importeCampagne(f)};
// Le bloc est au MJ ; les joueurs ne le voient pas. La liste se lit une fois la base ouverte.
const renderSettingsSansCampagnes=renderSettings;renderSettings=function(){renderSettingsSansCampagnes();$('bloc-campagnes').hidden=view!=='mj';renderCampagnes()};
document.addEventListener('amertume-partie-chargee',chargeCampagnes);

/* ---------- v1.405 — Les aventures ----------
   Une aventure arrive en un seul fichier (format : AVENTURE-FORMAT.md) : ses talents, ses objets, ses adversaires et ses
   cartes. Avant d'ajouter quoi que ce soit, la fenêtre montre tout ce qui va entrer, nom par nom. Chaque aventure importée est
   retenue (catalog.aventures : son nom, et l'identifiant de chaque chose qu'elle a apportée), et se retire d'un clic. Au
   retrait, ce qui sert ailleurs — un objet dans un sac, un talent appris, une carte ouverte, un élément cité par le reste du
   contenu — reste, sauf si le MJ coche le contraire ; la partie d'avant le retrait est gardée dans les copies. */
const GENRES_AVENTURE=[['talents','talent','talents'],['items','objet','objets'],['monsters','adversaire','adversaires'],['maps','carte','cartes']];
const idSur=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const aventuresImportees=()=>Array.isArray(catalog.aventures)?catalog.aventures.filter(a=>a&&idSur(a.id)&&typeof a.nom==='string'):[];
function resumeAventure(x){const l=GENRES_AVENTURE.map(([k,un,des])=>{const n=Array.isArray(x[k])?x[k].length:0;return n?n+' '+(n>1?des:un):''}).filter(Boolean);return l.length?l.join(', '):'rien'}
// Lire le fichier : une aventure d'Amertüme Online, ou un refus qui dit pourquoi.
function lisAventure(texte,nom){let s=null;try{s=JSON.parse(String(texte||'').replace(/^﻿/,'').trim())}catch(e){throw Error('« '+nom+' » n’est pas du JSON lisible — '+e.message)}
 if(!s||typeof s!=='object'||Array.isArray(s)||s.genre!=='aventure')throw Error('« '+nom+' » n’est pas une aventure (il lui faut « "genre": "aventure" »).');
 if(!idSur(s.id))throw Error('« '+nom+' » : l’identifiant de l’aventure manque ou est invalide.');
 if(typeof s.nom!=='string'||!s.nom.trim())throw Error('« '+nom+' » : l’aventure n’a pas de nom.');
 const a={id:s.id,nom:s.nom.trim().slice(0,80)};
 GENRES_AVENTURE.forEach(([k])=>{const l=s[k];if(l!==undefined&&!Array.isArray(l))throw Error('« '+nom+' » : « '+k+' » doit être une liste.');
  a[k]=(l||[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.name==='string'&&x.name.trim()).map(x=>structuredClone(x))});
 if(!GENRES_AVENTURE.some(([k])=>a[k].length))throw Error('« '+nom+' » ne contient ni talent, ni objet, ni adversaire, ni carte.');
 return a}
/* Préparer l'ajout : chaque chose garde son identifiant s'il est libre ; sinon elle en reçoit un neuf, et chaque mention de
   l'ancien dans l'aventure (un talent d'adversaire, un objet posé sur une carte…) suit. Rien n'est encore ajouté. */
function prepareAventure(a){const pris=new Set([...(catalog.talents||[]),...(catalog.items||[]),...(catalog.monsters||[]),...(maps||[]),...actors].map(x=>x&&x.id).filter(Boolean));
 const neufs=new Map(),vus=new Set();
 GENRES_AVENTURE.forEach(([k])=>a[k].forEach(x=>{const ancien=x.id;if(idSur(ancien)&&!pris.has(ancien)&&!vus.has(ancien)){vus.add(ancien);return}
  const n=crypto.randomUUID();if(idSur(ancien))neufs.set(ancien,n);x.id=n;vus.add(n)}));
 const suit=v=>{if(typeof v==='string')return neufs.has(v)?neufs.get(v):v;if(Array.isArray(v))return v.map(suit);
  if(v&&typeof v==='object'){for(const c of Object.keys(v))if(c!=='__proto__')v[c]=suit(v[c]);return v}return v};
 if(neufs.size)GENRES_AVENTURE.forEach(([k])=>{a[k]=a[k].map(x=>{const id=x.id;const y=suit(x);y.id=id;return y})});
 // Les noms déjà pris, pour le dire dans l'aperçu : rien n'est remplacé, les deux coexistent.
 const noms=k=>new Set((k==='maps'?maps:(catalog[k]||[])).map(x=>x&&x.name).filter(Boolean));
 a.doublons={};GENRES_AVENTURE.forEach(([k])=>{const n=noms(k);a.doublons[k]=a[k].filter(x=>n.has(x.name)).map(x=>x.name)});
 a.renommes=neufs.size;return a}
function ajouteAventure(a){if(aventuresImportees().some(x=>x.id===a.id))throw Error('« '+a.nom+' » est déjà importée : retire-la d’abord pour la réimporter.');
 const base={ratio:16/9,fitted:true,image:null,matiere:[],doors:[],start:null,foes:[],objets:[],coffres:[],echelle:{x:8,y:8,t:typeof SOCLE_DEFAUT!=='undefined'?SOCLE_DEFAUT:1}};
 catalog.talents.push(...a.talents);catalog.items.push(...a.items);catalog.monsters.push(...a.monsters);
 maps.push(...a.maps.map(m=>Object.assign(structuredClone(base),m)));
 catalog=normalizeCatalog(catalog);
 // Ce qui est vraiment entré, d'après ce qui est là après la normalisation.
 const ici={talents:new Set(catalog.talents.map(x=>x.id)),items:new Set(catalog.items.map(x=>x.id)),monsters:new Set(catalog.monsters.map(x=>x.id)),maps:new Set(maps.map(x=>x.id))};
 const r={id:a.id,nom:a.nom,le:Date.now()};GENRES_AVENTURE.forEach(([k])=>{r[k]=a[k].map(x=>x.id).filter(id=>ici[k].has(id))});
 catalog.aventures=[...aventuresImportees(),r];
 if(typeof refreshMapPick==='function')refreshMapPick();renderCatalogPages();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'));
 log('Aventure importée : '+a.nom+' — '+resumeAventure(r)+'.',{local:true});renderAventures();return r}
/* Ce qu'un retrait toucherait : chaque chose de l'aventure encore là, et parmi elles ce qui sert ailleurs. */
function bilanRetrait(r){const tous={talents:catalog.talents,items:catalog.items,monsters:catalog.monsters,maps};
 const siens=new Set(GENRES_AVENTURE.flatMap(([k])=>r[k]||[]));
 // Ailleurs : les combattants, le domaine, et tout le contenu qui n'est pas de cette aventure.
 const ailleurs=JSON.stringify([actors,typeof domaine!=='undefined'?domaine:null,...GENRES_AVENTURE.map(([k])=>tous[k].filter(x=>x&&!siens.has(x.id)))]);
 const out={};GENRES_AVENTURE.forEach(([k])=>{const l=tous[k].filter(x=>x&&(r[k]||[]).includes(x.id));
  out[k]=l.map(x=>({id:x.id,nom:x.name,sert:(k==='maps'&&x.id===currentMapId)?'ouverte':ailleurs.includes('"'+x.id+'"')?'ailleurs':''}))});
 return out}
function retireAventure(r,aussiUtilises){const b=bilanRetrait(r),otes={};
 const part=k=>b[k].filter(x=>aussiUtilises?x.sert!=='ouverte':!x.sert).map(x=>x.id);
 GENRES_AVENTURE.forEach(([k])=>{otes[k]=new Set(part(k))});
 catalog.talents=catalog.talents.filter(x=>!otes.talents.has(x.id));catalog.items=catalog.items.filter(x=>!otes.items.has(x.id));catalog.monsters=catalog.monsters.filter(x=>!otes.monsters.has(x.id));
 maps=maps.filter(x=>!otes.maps.has(x.id));if(typeof mapDraft!=='undefined'&&mapDraft&&!maps.includes(mapDraft))mapDraft=maps[0]||null;
 // L'aventure reste inscrite tant qu'il lui reste quelque chose : un second retrait l'achève.
 const reste={...r};let vide=true;GENRES_AVENTURE.forEach(([k])=>{reste[k]=(r[k]||[]).filter(id=>!otes[k].has(id));if(reste[k].length)vide=false});
 catalog.aventures=aventuresImportees().map(x=>x.id===r.id?(vide?null:reste):x).filter(Boolean);
 catalog=normalizeCatalog(catalog);
 if(typeof refreshMapPick==='function')refreshMapPick();renderCatalogPages();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'));
 const n=GENRES_AVENTURE.reduce((s,[k])=>s+otes[k].size,0);log('Aventure retirée : '+r.nom+' — '+n+' élément'+(n>1?'s':'')+' ôté'+(n>1?'s':'')+(vide?'.':' ; le reste sert encore ailleurs.'),{local:true});
 renderAventures();return {otes:n,vide}}
// Avant un retrait, la partie telle qu'elle est se garde : « Avant le dernier retrait d'aventure », dans les copies.
function gardeAvantRetrait(){return new Promise(ok=>{try{if(typeof db==='undefined'||!db){ok();return}const tx=db.transaction('state','readwrite'),st=tx.objectStore('state'),g=st.get('session');
 g.onsuccess=()=>{if(g.result){const c=structuredClone(g.result);c.enregistreLe=Date.now();st.put(c,'copie:avant-retrait')}};tx.oncomplete=()=>ok();tx.onerror=()=>ok()}catch(e){ok()}})}

/* ---------- La fenêtre : l'aperçu d'un import, le bilan d'un retrait ---------- */
const aventureDialog=dialog('aventure-fenetre','Aventure','<div id="aventure-corps"></div><label class="aventure-aussi" id="aventure-aussi-label" hidden><input type="checkbox" id="aventure-aussi"> Retirer aussi ce qui sert ailleurs</label><div class="form-actions"><button type="button" id="aventure-non">Annuler</button><button type="button" id="aventure-oui" class="primary"></button></div>');
function listeNoms(titre,noms,marques){const d=document.createElement('div');d.className='aventure-groupe';const h=document.createElement('h3');h.className='reglage-titre';h.textContent=titre+' · '+noms.length;
 const p=document.createElement('p');p.className='aventure-noms';noms.forEach((n,i)=>{const s=document.createElement('span');s.textContent=n;if(marques&&marques[i])s.className='aventure-marque';p.append(s)});d.append(h,p);return d}
function apercuAventure(a){const corps=$('aventure-corps');corps.replaceChildren();aventureDialog.querySelector('.dialog-head h2').textContent='Importer « '+a.nom+' »';
 GENRES_AVENTURE.forEach(([k,,des])=>{if(!a[k].length)return;const nom=des.charAt(0).toUpperCase()+des.slice(1);
  corps.append(listeNoms(nom,a[k].map(x=>x.name+(a.doublons[k].includes(x.name)?' (nom déjà pris)':'')),a[k].map(x=>a.doublons[k].includes(x.name))))});
 $('aventure-aussi-label').hidden=true;$('aventure-oui').textContent='Importer';
 $('aventure-oui').onclick=()=>{try{ajouteAventure(a);aventureDialog.close()}catch(e){alert('Import refusé : '+e.message)}};
 $('aventure-non').onclick=()=>aventureDialog.close();aventureDialog.showModal()}
function fenetreRetrait(r){const b=bilanRetrait(r),corps=$('aventure-corps');corps.replaceChildren();aventureDialog.querySelector('.dialog-head h2').textContent='Retirer « '+r.nom+' »';
 const otes=[],garde=[];GENRES_AVENTURE.forEach(([k,,des])=>{const nom=des.charAt(0).toUpperCase()+des.slice(1),l=b[k];
  const o=l.filter(x=>!x.sert),g=l.filter(x=>x.sert);if(o.length)otes.push(listeNoms(nom,o.map(x=>x.nom)));
  if(g.length)garde.push(listeNoms(nom+' qui servent ailleurs',g.map(x=>x.nom+(x.sert==='ouverte'?' (ouverte en ce moment)':'')),g.map(()=>true)))});
 corps.append(...otes,...garde);if(!otes.length&&!garde.length){const p=document.createElement('p');p.className='muted';p.textContent='Plus rien de cette aventure n’est là.';corps.append(p)}
 const utilises=GENRES_AVENTURE.some(([k])=>b[k].some(x=>x.sert==='ailleurs'));$('aventure-aussi-label').hidden=!utilises;$('aventure-aussi').checked=false;
 $('aventure-oui').textContent='Retirer';
 $('aventure-oui').onclick=async()=>{const aussi=$('aventure-aussi').checked;aventureDialog.close();await gardeAvantRetrait();retireAventure(r,aussi)};
 $('aventure-non').onclick=()=>aventureDialog.close();aventureDialog.showModal()}

/* ---------- Le bloc des Paramètres, sous les campagnes ---------- */
const blocAventures=document.createElement('div');blocAventures.id='bloc-aventures';
blocAventures.innerHTML='<div class="divider"></div><h3 class="reglage-titre">Aventures</h3><div id="aventure-liste"></div>'
 +'<div class="side-actions"><button id="aventure-importer">⇧ Importer une aventure</button><input type="file" id="aventure-fichier" accept=".json,application/json" hidden></div>'
 +'<p class="form-error" id="aventure-erreur" role="status" aria-live="polite"></p>';
blocCampagnes.after(blocAventures);
function renderAventures(){const liste=$('aventure-liste');if(!liste)return;blocAventures.hidden=view!=='mj';liste.replaceChildren();
 aventuresImportees().forEach(r=>{const l=document.createElement('div');l.className='reglage';const d=document.createElement('div'),s=document.createElement('strong'),p=document.createElement('p');
  s.textContent=r.nom;p.className='muted';p.textContent=resumeAventure(r)+(r.le?' · importée le '+dateCampagne(r.le):'');d.append(s,p);
  const b=document.createElement('button');b.type='button';b.textContent='Retirer';b.onclick=()=>fenetreRetrait(r);l.append(d,b);liste.append(l)})}
$('aventure-importer').onclick=()=>{if(view!=='mj')return;$('aventure-erreur').textContent='';$('aventure-fichier').click()};
$('aventure-fichier').onchange=()=>{const f=$('aventure-fichier').files[0];$('aventure-fichier').value='';if(!f)return;
 f.text().then(t=>{const a=prepareAventure(lisAventure(t,f.name));if(aventuresImportees().some(x=>x.id===a.id))throw Error('« '+a.nom+' » est déjà importée : retire-la d’abord pour la réimporter.');apercuAventure(a)})
  .catch(e=>{$('aventure-erreur').textContent='Import refusé : '+e.message;if(typeof signaleErreur==='function')signaleErreur(e,'aventure')})};
{const rs=renderSettings;renderSettings=function(...x){const r=rs.apply(this,x);try{renderAventures()}catch(e){}return r}}
renderAventures();

