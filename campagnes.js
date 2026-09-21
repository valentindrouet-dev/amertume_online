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
$('campagne-creer').onclick=creeCampagne;
$('campagne-nom').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();creeCampagne()}};
$('campagne-enregistrer').onclick=()=>{const c=campagnes.find(x=>x.id===campagneOuverte);if(c)enregistreCampagne(c.id,c.nom,false)};
$('campagne-importer').onclick=()=>{if(view!=='mj')return;$('campagne-fichier').click()};
$('campagne-fichier').onchange=()=>{const f=$('campagne-fichier').files[0];$('campagne-fichier').value='';if(f)importeCampagne(f)};
// Le bloc est au MJ ; les joueurs ne le voient pas. La liste se lit une fois la base ouverte.
const renderSettingsSansCampagnes=renderSettings;renderSettings=function(){renderSettingsSansCampagnes();$('bloc-campagnes').hidden=view!=='mj';renderCampagnes()};
document.addEventListener('amertume-partie-chargee',chargeCampagnes);
