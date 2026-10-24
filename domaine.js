/* Le Domaine : le fief de la troupe, d'où partent les aventures et où se nouent les
   intrigues. Un onglet pour le gérer — bâtiments, trésor, habitants, aventuriers — et,
   dans l'onglet Cartes, un éditeur à part pour sa carte : des calques superposés — un par
   étape de construction, un par état — dans lesquels chaque bâtiment se découpe au sien.
   Les règles sont dans combat.js ; ici, l'écran. Le domaine vit dans la sauvegarde de la
   partie et part avec le contenu publié : les joueurs le lisent — carte, bâtiments, trésor,
   habitants, où est chacun — sans rien pouvoir y changer ; l'édition reste au MJ. */
'use strict';
let domaine=normaliseDomaine(null);
// La sauvegarde l'emporte et le rend, sans que l'éditeur de partie ait à le connaître.
const snapshotSansDomaine=snapshot;snapshot=function(){return Object.assign(snapshotSansDomaine(),{domaine})};
/* Un domaine vide — une sauvegarde ou une campagne d'avant le domaine, une scène publiée trop
   ancienne — n'efface jamais un domaine qui a du contenu : il reste en place. */
const appliquerSansDomaine=appliquerSauvegarde;appliquerSauvegarde=function(s){appliquerSansDomaine(s);const d=normaliseDomaine(s&&s.domaine);
 if(poidsDomaine(d)>0||poidsDomaine(domaine)===0)domaine=d;domSel=null;domPageSel=null};
/* Ce qu'un domaine a de précieux : ses calques d'abord, puis ses zones, ses étapes, son nom, son
   monde. Zéro, c'est le domaine d'origine, vierge. */
function poidsDomaine(d){if(!d||!d.carte||!Array.isArray(d.batiments))return 0;
 return d.carte.calques.filter(Boolean).length*100+d.batiments.filter(b=>b.zone).length*5+d.batiments.filter(b=>b.etape>0||b.etat).length*2
  +(d.nom!=='Le Domaine'?1:0)+(d.pnj||[]).length+(d.quetes||[]).length+((d.finances&&d.finances.journal)||[]).length+(d.finances&&d.finances.tresor?1:0)}
/* ---------- Le domaine de secours ---------- */
/* À chaque enregistrement, un domaine qui a du contenu se garde aussi à part, sous
   « domaine:secours », sur cet appareil. Un domaine vide ne l'écrase jamais : si la partie perd
   son domaine — une autre fenêtre restée ouverte, une sauvegarde trop ancienne —, le dernier
   domaine digne de ce nom reste, et l'onglet Domaine propose de le reprendre. */
let secoursDomaine=null,signatureSecours='';
const signatureDomaine=d=>[d.nom,d.carte.calques.map(c=>c?c.length:0).join('.'),JSON.stringify(d.batiments).length,JSON.stringify(d.finances).length,(d.pnj||[]).length,JSON.stringify(d.ressources||{}).length,JSON.stringify(d.quetes||[]).length].join('|');
const saveNowSansSecours=saveNow;saveNow=function(){saveNowSansSecours();gardeSecoursDomaine()};
function gardeSecoursDomaine(){if(typeof db==='undefined'||!db||(typeof ongletPerime!=='undefined'&&ongletPerime)||poidsDomaine(domaine)<=0)return;
 const sig=signatureDomaine(domaine);if(sig===signatureSecours)return;
 try{const rec={t:Date.now(),domaine:structuredClone(domaine)},tx=db.transaction('state','readwrite');tx.objectStore('state').put(rec,'domaine:secours');
  tx.oncomplete=()=>{signatureSecours=sig;secoursDomaine=rec}}catch(e){}}
// Au chargement : le secours est lu ; s'il est plus riche que le domaine de la partie, on le dit.
document.addEventListener('amertume-partie-chargee',()=>{if(typeof db==='undefined'||!db)return;
 try{const r=db.transaction('state').objectStore('state').get('domaine:secours');
  r.onsuccess=()=>{const rec=r.result;if(!rec||!rec.domaine)return;rec.domaine=normaliseDomaine(rec.domaine);secoursDomaine=rec;
   /* La partie est revenue sans domaine alors que cet appareil en garde un : c'est une perte, pas
      un choix — rien dans l'application ne vide un domaine. Il revient de lui-même. */
   if(poidsDomaine(domaine)===0&&poidsDomaine(rec.domaine)>0){domaine=normaliseDomaine(structuredClone(rec.domaine));domSel=null;domPageSel=null;imagesDom.clear();
    log('Domaine « '+domaine.nom+' » repris automatiquement : la partie l’avait perdu, cet appareil le gardait.',{local:true});
    sauveDomaine();if(document.body.classList.contains('page-domaine'))renderDomaine();return}
   if(poidsDomaine(rec.domaine)>poidsDomaine(domaine)){log('Un domaine plus complet est gardé sur cet appareil : l’onglet Domaine propose de le reprendre.',{local:true});
    if(document.body.classList.contains('page-domaine'))renderDomaine()}}}catch(e){}});
/* La sauvegarde globale emporte le secours quand il est plus riche que le domaine de la partie ; à l'import,
   il ne remplace qu'un secours plus pauvre. */
ANNEXES_SAUVEGARDE.push({nom:'le domaine de secours',
 lit:()=>secoursDomaine&&poidsDomaine(secoursDomaine.domaine)>poidsDomaine(domaine)?{domaineSecours:structuredClone(secoursDomaine)}:{},
 pose:s=>{const rec=s.domaineSecours;if(!rec||typeof rec!=='object'||!rec.domaine||typeof db==='undefined'||!db)return;
  const d=normaliseDomaine(rec.domaine);if(poidsDomaine(d)<=Math.max(poidsDomaine(domaine),secoursDomaine?poidsDomaine(secoursDomaine.domaine):0))return;
  const r={t:Number(rec.t)||Date.now(),domaine:d};
  return new Promise((ok,ko)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(r,'domaine:secours');
   tx.oncomplete=()=>{secoursDomaine=r;ok()};tx.onerror=()=>ko(tx.error)})}});
function bandeauSecours(){const boite=$('dom-secours');if(!boite)return;boite.replaceChildren();
 const rec=secoursDomaine;boite.hidden=!(mjDom()&&rec&&poidsDomaine(rec.domaine)>poidsDomaine(domaine));if(boite.hidden)return;
 const d=rec.domaine,n=d.carte.calques.filter(Boolean).length,z=d.batiments.filter(b=>b.zone).length;
 const p=document.createElement('p');p.textContent='Un domaine plus complet est gardé sur cet appareil depuis le '+new Date(rec.t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
  +' : « '+d.nom+' » — '+n+' calque'+(n>1?'s':'')+', '+z+' bâtiment'+(z>1?'s':'')+' tracé'+(z>1?'s':'')+'.';
 const b=document.createElement('button');b.className='primary';b.textContent='⟲ Reprendre ce domaine';
 b.onclick=()=>{if(!confirm('Reprendre « '+d.nom+' » à la place du domaine actuel « '+domaine.nom+' » ?'))return;
  domaine=normaliseDomaine(structuredClone(d));domSel=null;domPageSel=null;imagesDom.clear();renderDomaine();renderMapList();sauveDomaine();log('Domaine repris depuis le secours : '+d.nom+'.',{local:true})};
 boite.append(p,b)}
/* Avant chaque sauvegarde, personne ne reste dans un bâtiment qui n'est plus construit ; et
   le contenu publié suit, pour que les joueurs voient le domaine tel qu'il est. */
function sauveDomaine(){evacueNonConstruits();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
/* En vue joueur, l'onglet se dessine sans ses commandes ; en vue MJ, avec. Changer de vue
   pendant qu'il est ouvert le redessine. */
let vueDomaine=null;
const mjDom=()=>typeof view==='undefined'||view==='mj';
/* Ce que la table change — un joueur qui se déplace, un achat — se relit sur l'onglet, sans
   redessiner le fond de carte, et jamais sous les doigts de qui est en train d'écrire. */
const renderSansVueDomaine=render;render=function(){renderSansVueDomaine();
 if(!document.body.classList.contains('page-domaine'))return;
 if(vueDomaine!==view){renderDomaine();return}
 const f=document.activeElement;if(f&&f.closest&&f.closest('#domaine-page')&&/^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName))return;
 if(typeof champsOuverts!=='undefined'&&champsOuverts>0)return;
 renderDomaine(true)};
const TEINTES_ETAPE=['#b9a48a','#c9953f','#7faddc','#8bbd9c','#d9532b','#6e6a66','#9b7fd4','#a89f8f','#7d9b3c'];
const etatBatimentValide=v=>v&&ETATS_BATIMENT.some(([k])=>k===v)?v:'';
const batimentDom=id=>domaine.batiments.find(b=>b.id===id)||null;
/* Un aventurier ne loge que dans un bâtiment construit : si l'étape recule, il en sort
   aussitôt et se retrouve simplement au domaine. Renvoie le nombre d'évacués. */
const batimentConstruit=b=>!!b&&b.etape>=ETAPES_DOMAINE.length-1;
// Les joueurs ne voient que ce qui est sorti de terre : une friche n'a ni ligne ni fiche chez eux.
const batimentChoisissable=b=>!!b&&(mjDom()||b.etape>0);
/* Où se trouve un aventurier au domaine : sur sa fiche, pour que son joueur l'y déplace lui-même
   — la table en ligne porte les champs des aventuriers, pas le domaine. Une fiche d'avant
   lit encore le domaine, jusqu'à son premier déplacement. */
const lieuDe=a=>!a?'':typeof a.lieuDomaine==='string'?a.lieuDomaine:((domaine.aventuriers[a.id]||{}).lieu||'');
function poseLieu(a,lieu){if(a)a.lieuDomaine=String(lieu||'').slice(0,60)}
function evacueNonConstruits(){let n=0;actors.forEach(a=>{if(!a.hero)return;const l=lieuDe(a);if(!l||l==='aventure'||l==='absent'||l==='route')return;
 if(!batimentConstruit(batimentDom(l))){poseLieu(a,'');n++}});return n}
/* Qui agit pour un aventurier : le MJ, pour tous ; en ligne, le joueur assis à sa place ;
   sur un seul appareil, celui de « Mon aventurier ». */
function agitPour(a){if(!a)return false;if(mjDom())return true;
 if(typeof enLigne!=='undefined'&&enLigne)return aMoi(a)||(typeof monSiege!=='undefined'&&monSiege===a.id);
 return actors.indexOf(a)===owner}
function nomLieu(lieu){if(lieu==='aventure')return 'En aventure';if(lieu==='route')return 'Sur la route';if(lieu==='absent')return 'Absent';
 const b=lieu?batimentDom(lieu):null;return b?b.nom:'Au domaine'}
function montantLisible(n){const s=Math.abs(n).toLocaleString('fr-FR');return (n<0?'−':'')+s+' '+domaine.monnaie}

/* ---------- L'image du village ---------- */
// Chaque calque n'est décodé qu'une fois ; ce qui attend son chargement se redessine alors.
const imagesDom=new Map();
function imageDom(url,apres){if(!url)return null;let e=imagesDom.get(url);
 if(!e){e={img:new Image(),ok:false,attente:[]};imagesDom.set(url,e);
  e.img.onload=()=>{e.ok=true;const l=e.attente;e.attente=[];l.forEach(f=>f())};
  e.img.onerror=()=>{e.attente=[]};e.img.src=url}
 if(e.ok)return e.img;if(apres&&!e.attente.includes(apres))e.attente.push(apres);return null}
/* Le village composé : le calque le plus bas en fond, puis chaque bâtiment découpé dans
   le calque de son étape. « vue » force un calque entier, pour tracer dessus. Renvoie
   faux s'il n'y a rien à peindre. */
const DOM_LARGEUR=2048;
function dessineDomaine(canvas,vue,redessine){const d=domaine,c=d.carte,ctx=canvas.getContext('2d');
 const W=DOM_LARGEUR,H=Math.max(200,Math.round(W/(c.ratio||16/9)));
 if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
 ctx.clearRect(0,0,W,H);
 const charge=i=>i>=0&&c.calques[i]?imageDom(c.calques[i],redessine):null;
 if(vue>=0){const im=charge(vue);if(im)ctx.drawImage(im,0,0,W,H);return !!c.calques[vue]}
 const fond=calqueDisponible(c.calques,0);if(fond<0)return false;
 const imFond=charge(fond);if(imFond)ctx.drawImage(imFond,0,0,W,H);
 d.batiments.forEach(b=>{if(!b.zone)return;const k=calqueDuBatiment(c.calques,b);if(k<0||k===fond)return;
  const im=charge(k);if(!im)return;
  ctx.save();ctx.beginPath();b.zone.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x/100*W,y/100*H));ctx.closePath();ctx.clip();
  ctx.drawImage(im,0,0,W,H);ctx.restore()});
 return true}
/* Les zones par-dessus l'image : un polygone par bâtiment, teinté de son étape, et son
   nom au centre. Le tracé en cours, s'il y en a un, en pointillé. */
/* Le nom d'un bâtiment se glisse là où on le veut — dans l'éditeur de carte seulement :
   il reste à ce point, et non plus au centre de la zone. « deplace » reçoit le bâtiment et
   le point où on l'a lâché ; sans « deplace », le nom ne bouge pas et n'est qu'un bouton.
   Un clic sans mouvement va à « clic ». */
function rendEtiquetteDeplacable(e,b,boite,opts){e.classList.add(opts.deplace?'deplacable':'cliquable');
 e.onpointerdown=ev=>{if(ev.button!==0)return;ev.stopPropagation();ev.preventDefault();
  const r=boite.getBoundingClientRect(),depart={x:ev.clientX,y:ev.clientY},id=ev.pointerId;let bouge=false,pt=null;
  const pos=m=>({x:Math.max(0,Math.min(100,100*(m.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(m.clientY-r.top)/r.height))});
  /* Le geste s'écoute sur la fenêtre, pas sur l'étiquette : il se poursuit même si la
     capture du pointeur est refusée, ou si la souris file hors du nom en chemin. */
  const suit=m=>{if(m.pointerId!==id||!opts.deplace)return;if(!bouge&&Math.hypot(m.clientX-depart.x,m.clientY-depart.y)<4)return;bouge=true;pt=pos(m);e.style.left=pt.x+'%';e.style.top=pt.y+'%'};
  const lache=m=>{if(m&&m.pointerId!==id)return;window.removeEventListener('pointermove',suit);window.removeEventListener('pointerup',lache);window.removeEventListener('pointercancel',lache);
   try{e.releasePointerCapture(id)}catch(_){}
   if(bouge&&pt&&opts.deplace)opts.deplace(b,[pt.x,pt.y]);else if(!bouge&&opts.clic)opts.clic(b)};
  try{e.setPointerCapture(id)}catch(_){}
  window.addEventListener('pointermove',suit);window.addEventListener('pointerup',lache);window.addEventListener('pointercancel',lache)}}
function dessineZonesDom(svg,etiquettes,opts){const d=domaine;svg.replaceChildren();etiquettes.replaceChildren();
 const ns='http://www.w3.org/2000/svg';
 d.batiments.forEach((b,i)=>{if(!b.zone)return;
  const p=document.createElementNS(ns,'polygon');p.setAttribute('points',b.zone.map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));
  const inerte=!!(opts.inerte&&opts.inerte(b));
  p.setAttribute('class','dom-zone e'+b.etape+(b.etat?' etat-'+b.etat:'')+(batimentConstruit(b)?' construit':'')+(opts.sel===i?' sel':'')+(inerte?' inerte':''));p.dataset.bat=String(i);
  const t=document.createElementNS(ns,'title');t.textContent=b.nom+' — '+NOM_ETAPE(b.etape)+(b.etat?' · '+NOM_ETAT_BATIMENT(b.etat):'');p.append(t);svg.append(p);
  const c=b.etiquette||centroide(b.zone);if(!c)return;
  const e=document.createElement('span');e.className='dom-etiquette e'+b.etape+(b.etat?' etat-'+b.etat:'')+(opts.sel===i?' sel':'');
  e.style.left=c[0]+'%';e.style.top=c[1]+'%';e.dataset.bat=String(i);
  /* Sur le plan du Domaine (« jeu »), l'étiquette parle en joueur : en friche, il n'y a pas
     encore de bâtiment — « Friche » tient lieu de nom ; construit, c'est la normale — rien
     dessous. Un état se dit toujours. L'éditeur, lui, montre tout : nom, puis étape ou état. */
  const friche=!!opts.jeu&&b.etape===0,fini=!!opts.jeu&&b.etape>=ETAPES_DOMAINE.length-1;
  const nom=document.createElement('b');nom.textContent=friche?NOM_ETAPE(0):b.nom;e.append(nom);
  const sous=b.etat?NOM_ETAT_BATIMENT(b.etat):friche||fini?'':NOM_ETAPE(b.etape);
  if(sous){const et=document.createElement('small');et.textContent=sous;e.append(et)}
  // Sur le plan, les aventuriers qui s'y trouvent : leur jeton sous le nom du bâtiment.
  if(opts.jeu){const presents=actors.filter(a=>a.hero&&lieuDe(a)===b.id);
   if(presents.length){const j=document.createElement('div');j.className='dom-etiquette-jetons';
    presents.forEach(a=>{const t=jetonRond(a.image,a.name,'mini');t.title=a.name+(agitPour(a)?' — glisser vers un autre bâtiment construit':'');if(agitPour(a))t.classList.add('a-moi');t.onpointerdown=ev=>glisseJetonAventurier(ev,a,t);j.append(t)});e.append(j)}}
  if(opts.deplace||opts.clic&&!inerte)rendEtiquetteDeplacable(e,b,etiquettes,opts);etiquettes.append(e)});
 dessineCartouches(etiquettes,opts);
 /* Sur le plan du Domaine, le bâtiment choisi brille : sa zone s'éclaire d'une lueur aux bords
    fondus, sans trait de contour, et le reste de la carte ne change pas. La lueur passe sous les
    zones et laisse passer les clics. */
 const choisi=opts.jeu&&opts.sel!==null&&opts.sel!==undefined?d.batiments[opts.sel]:null;
 if(choisi&&choisi.zone){const defs=document.createElementNS(ns,'defs');
  defs.innerHTML='<filter id="dom-lueur-flou" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.7"/></filter>';
  const v=document.createElementNS(ns,'polygon');v.setAttribute('class','dom-lueur');v.setAttribute('filter','url(#dom-lueur-flou)');
  v.setAttribute('points',choisi.zone.map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));svg.prepend(defs,v)}
 if(opts.trace&&opts.trace.pts.length){const pts=opts.trace.pts;
  const f=document.createElementNS(ns,pts.length>2?'polygon':'polyline');
  f.setAttribute('points',pts.map(q=>q.join(',')).join(' '));f.setAttribute('class','dom-trace');svg.append(f)}}

/* Les inscriptions de la carte, à l'encre sur ses parchemins : en haut, le nom du domaine sur
   deux lignes — « Lamuline (Domaine) » s'écrit Lamuline, puis Domaine — ; en bas, qui y vit
   et qui y passe, les vrais nombres. Elles se glissent dans l'éditeur de carte seulement. */
function nomEnDeux(nom){nom=String(nom||'').trim();const m=nom.match(/^(.*\S)\s*\((.+)\)$/);
 return m?[m[1],m[2].trim()]:[nom,/domaine/i.test(nom)?'':'Domaine']}
function dessineCartouches(etiquettes,opts){const d=domaine,compte=k=>d.pnj.filter(p=>p.statut===k).length;
 const accorde=(n,mot)=>n+' '+mot+(n>1?'s':''),[nom,sous]=nomEnDeux(d.nom);
 // Quatre textes décorrélés : chacun sa place, chacun se glisse seul.
 const textes={nom,sous,habitants:accorde(compte('habitant'),'habitant'),visiteurs:accorde(compte('visiteur'),'visiteur')};
 Object.keys(textes).forEach(k=>{const pt=d.carte.cartouches[k],t=textes[k];if(!pt||!t)return;
  const e=document.createElement('span');e.className='dom-cartouche c-'+k;e.style.left=pt[0]+'%';e.style.top=pt[1]+'%';e.textContent=t;
  if(opts.deplaceCartouche){rendEtiquetteDeplacable(e,k,etiquettes,{deplace:opts.deplaceCartouche});e.title='Glisser pour déplacer ce texte'}
  etiquettes.append(e)})}

/* Le jeton d'un aventurier se glisse d'un bâtiment à un autre, sur le plan : lâché n'importe
   où sur la zone d'un bâtiment construit, il y est rattaché aussitôt. Lâché ailleurs, il
   revient d'où il vient. Un fantôme suit le doigt ; les bâtiments qui l'accueilleraient
   s'allument le temps du geste, celui qu'on survole plus fort. */
function glisseJetonAventurier(ev,a,t){if(ev.button!==0||!agitPour(a))return;ev.stopPropagation();ev.preventDefault();
 const plan=$('dom-plan'),id=ev.pointerId,depart={x:ev.clientX,y:ev.clientY};let fantome=null;
 const pos=m=>{const r=plan.getBoundingClientRect();return [100*(m.clientX-r.left)/r.width,100*(m.clientY-r.top)/r.height]};
 const cibleSous=m=>{const i=batimentSous(domaine,pos(m));const b=i>=0?domaine.batiments[i]:null;return batimentConstruit(b)?b:null};
 const allume=b=>{plan.querySelectorAll('.dom-zone.vise').forEach(z=>z.classList.remove('vise'));
  if(b){const z=plan.querySelector('.dom-zone[data-bat="'+domaine.batiments.indexOf(b)+'"]');if(z)z.classList.add('vise')}};
 const suit=m=>{if(m.pointerId!==id)return;
  if(!fantome){if(Math.hypot(m.clientX-depart.x,m.clientY-depart.y)<4)return;
   fantome=jetonRond(a.image,a.name,'fantome-pose');document.body.append(fantome);plan.classList.add('glisse-jeton');t.classList.add('tire')}
  fantome.style.left=m.clientX+'px';fantome.style.top=m.clientY+'px';const b=cibleSous(m);fantome.classList.toggle('hors',!b);allume(b)};
 const lache=m=>{if(m&&m.pointerId!==id)return;window.removeEventListener('pointermove',suit);window.removeEventListener('pointerup',lache);window.removeEventListener('pointercancel',lache);
  try{t.releasePointerCapture(id)}catch(_){}
  if(!fantome)return;fantome.remove();plan.classList.remove('glisse-jeton');t.classList.remove('tire');allume(null);
  const b=m&&m.type==='pointerup'?cibleSous(m):null;
  if(b&&lieuDe(a)!==b.id)deplaceAventurier(a,b)};
 try{t.setPointerCapture(id)}catch(_){}
 window.addEventListener('pointermove',suit);window.addEventListener('pointerup',lache);window.addEventListener('pointercancel',lache)}

/* ---------- L'éditeur, dans l'onglet Cartes ---------- */
/* La carte du domaine n'est pas une carte de combat : ni matière, ni porte, ni socle. Elle
   a sa propre ligne en tête de la liste des cartes, et ses propres outils quand on l'ouvre :
   les calques à charger — étapes et états —, la vue, le tracé des bâtiments. */
let domaineEdite=false,domOutil='select',domSel=null,domDrag=null,domTrace=null,domVue=-1;
let domZoom=1,domPanX=0,domPanY=0,domUndo=[],domRedo=[],calqueVise=null;
const domEditeur=document.createElement('section');domEditeur.className='maps-main panel';domEditeur.id='domaine-editeur';
domEditeur.innerHTML=
 '<div class="maps-bar"><label class="grow">Nom du domaine<input id="dom-nom" maxlength="80"></label>'
 +'<button id="dom-ouvrir" class="primary">Ouvrir le Domaine</button></div>'
 +'<input type="file" id="dom-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="tool-bar" id="dom-calques"><span class="muted">Calques</span>'
 +CALQUES_DOMAINE.map(([k,nom],i)=>'<span class="dom-calque'+(i>=4?' dom-calque-etat':'')+'"><button id="dom-calque-'+i+'" data-calque="'+i+'" title="Charger l’image du village '+(i>=4?'« '+nom+' » — un état, pas une étape':'à l’étape « '+nom+' »')+'">'+nom+'</button>'
  +'<button id="dom-calque-x-'+i+'" data-retire="'+i+'" class="dom-calque-x" title="Retirer ce calque" hidden>×</button></span>').join('')
 +'<span class="bar-sep"></span><label class="dom-vue">Vue <select id="dom-vue"><option value="-1">Composée — chaque bâtiment à son étape</option>'
 +CALQUES_DOMAINE.map(([k,nom],i)=>'<option value="'+i+'">Calque '+nom+' entier</option>').join('')+'</select></label></div>'
 +'<div class="tool-bar" id="dom-outils"><button data-outil="select">Sélection</button><button data-outil="zone">Tracer un bâtiment</button>'
 +'<span class="bar-sep"></span><button id="dom-contours-editeur" title="Montrer ou cacher le contour des bâtiments — le même réglage que dans l’onglet Domaine">▦ Contours</button>'
 +'<span class="bar-sep"></span><button id="dom-undo" title="Annuler (⌘Z)">↶ Annuler</button><button id="dom-redo" title="Rétablir (⇧⌘Z)">↷ Rétablir</button>'
 +'<span class="bar-sep"></span><button id="dom-zoom-out" aria-label="Dézoomer">−</button><span id="dom-zoom-label" class="muted">100 %</span>'
 +'<button id="dom-zoom-in" aria-label="Zoomer">+</button><button id="dom-zoom-reset">Ajuster</button></div>'
 +'<div class="canvas-wrap" id="dom-wrap"><div id="dom-canvas"><canvas id="dom-fond"></canvas><svg id="dom-zones" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>'
 +'<div id="dom-etiquettes"></div><div id="dom-sommets"></div></div></div><p class="muted" id="dom-hint"></p>';
const domProps=document.createElement('aside');domProps.className='maps-props panel';domProps.id='domaine-props';
domProps.innerHTML='<h2>Bâtiments</h2><p class="muted">Clique un bâtiment pour le choisir, puis « Tracer » : contourne-le sur la carte, point par point ou à main levée. Chaque bâtiment se découpe ensuite dans le calque de son étape.</p>'
 +'<div id="dom-liste"></div><div class="side-actions"><button id="dom-bat-add">+ Bâtiment</button></div>'
 +'<div class="divider"></div><h2>Bâtiment choisi</h2><div id="dom-sel-boite"><p class="muted">Aucun bâtiment choisi.</p></div>'
 +'<div class="divider"></div><h2>Légende</h2><ul class="legend">'
 +CALQUES_DOMAINE.map(([k,nom],i)=>'<li><i class="sw-etape" style="--t:'+TEINTES_ETAPE[i]+'"></i>'+nom+(i>=4?' — un état, pas une étape':'')+'</li>').join('')
 +'<li><i class="sw-cut"></i>Tracé en cours — Entrée ferme, Échap abandonne</li></ul>'
 +'<p class="muted">Tous les calques doivent avoir le même cadrage : la même vue du village, à chaque étape et dans chaque état. Le premier chargé fixe le cadre.</p>';
mapsPage.append(domEditeur,domProps);
const DOM_HINTS={select:'Clique un bâtiment pour le choisir, glisse-le pour le déplacer, tire un de ses sommets pour le retoucher. Suppr efface sa zone. ⌘Z annule.',
 zone:'Contourne le bâtiment : clique point par point, ou glisse à main levée. Un clic sur le premier point, ou Entrée, ferme le tracé ; Échap l’abandonne. Le tracé va au bâtiment choisi — ou en crée un s’il n’y en a pas.'};
function entreDomaine(){domaineEdite=true;mapsPage.classList.add('mode-domaine');domTrace=null;domDrag=null;renderMapList();renderDomaineEditeur()}
function quitteDomaine(){if(!domaineEdite)return;domaineEdite=false;domTrace=null;domDrag=null;mapsPage.classList.remove('mode-domaine')}
// Depuis l'onglet Domaine, on saute droit dans l'éditeur de sa carte.
function ouvreEditeurDomaine(){showPage('maps');entreDomaine()}
/* La liste des cartes reçoit le domaine en tête ; le choisir ouvre son éditeur, choisir
   une carte le referme. */
const renderMapListSansDomaine=renderMapList;renderMapList=function(){renderMapListSansDomaine();const liste=$('map-list');if(!liste)return;
 liste.querySelectorAll('.map-row').forEach(b=>{const f=b.onclick;b.onclick=()=>{quitteDomaine();f()};if(domaineEdite)b.classList.remove('current')});
 const b=document.createElement('button');b.className='map-row dom-row'+(domaineEdite?' current':'');
 const nom=document.createElement('strong');nom.textContent='🏰 '+domaine.nom;
 const n=domaine.carte.calques.filter(Boolean).length,z=domaine.batiments.filter(x=>x.zone).length;
 b.title=domaine.nom+'\n'+n+' calque'+(n>1?'s':'')+' · '+z+' bâtiment'+(z>1?'s':'')+' tracé'+(z>1?'s':'');
 b.append(nom);b.onclick=entreDomaine;liste.prepend(b)};
function pushDomUndo(){domUndo.push(domEtat());
 if(domUndo.length>40)domUndo.shift();domRedo.length=0}
function domEtat(){return {batiments:structuredClone(domaine.batiments),calques:[...domaine.carte.calques],ratio:domaine.carte.ratio,cartouches:structuredClone(domaine.carte.cartouches)}}
function poseDomEtat(e){domaine.batiments=e.batiments;domaine.carte.calques=e.calques;domaine.carte.ratio=e.ratio;domaine.carte.cartouches=cartouchesValides(e.cartouches);
 if(domSel!==null&&!domaine.batiments[domSel])domSel=null;renderDomaineEditeur();sauveDomaine()}
function domAnnule(){if(!domUndo.length)return;domRedo.push(domEtat());poseDomEtat(domUndo.pop())}
function domRetablit(){if(!domRedo.length)return;domUndo.push(domEtat());poseDomEtat(domRedo.pop())}
$('dom-undo').onclick=domAnnule;$('dom-redo').onclick=domRetablit;
$('dom-ouvrir').onclick=()=>showPage('domaine');
$('dom-nom').oninput=()=>{domaine.nom=$('dom-nom').value.slice(0,80);renderMapList();sauveDomaine()};
$('dom-vue').onchange=()=>{domVue=Number($('dom-vue').value);renderDomaineEditeur()};
document.querySelectorAll('#dom-outils [data-outil]').forEach(b=>b.onclick=()=>{domOutil=b.dataset.outil;domTrace=null;renderDomaineEditeur()});
/* Un calque : l'image du village à une étape. Le premier chargé fixe le cadre ; un autre
   cadrage se signale, mais on ne refuse rien — c'est au MJ de voir. */
document.querySelectorAll('#dom-calques [data-calque]').forEach(b=>b.onclick=()=>{calqueVise=Number(b.dataset.calque);$('dom-file').click()});
document.querySelectorAll('#dom-calques [data-retire]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.retire);
 if(!domaine.carte.calques[i]||!confirm('Retirer le calque « '+NOM_ETAPE(i)+' » ?'))return;
 pushDomUndo();domaine.carte.calques[i]=null;renderDomaineEditeur();renderMapList();sauveDomaine()});
$('dom-file').onchange=()=>{const f=$('dom-file').files[0];$('dom-file').value='';const i=calqueVise;calqueVise=null;
 if(!f||i===null)return;
 openImage(f,'map',url=>{pushDomUndo();domaine.carte.calques[i]=url;
  const img=new Image();img.onload=()=>{if(!img.naturalHeight)return;const r=img.naturalWidth/img.naturalHeight;
   const autres=domaine.carte.calques.filter((c,k)=>c&&k!==i).length;
   if(!autres)domaine.carte.ratio=r;
   else if(Math.abs(r-domaine.carte.ratio)/domaine.carte.ratio>.01)alert('Ce calque n’a pas le cadrage des autres ('+img.naturalWidth+' × '+img.naturalHeight+'). Il sera étiré pour tenir dans le même cadre : les bâtiments risquent de ne plus tomber juste.');
   renderDomaineEditeur();renderMapList();sauveDomaine()};
  img.onerror=()=>{renderDomaineEditeur();sauveDomaine()};img.src=url})};
// Le plan de travail prend le rapport du village et la place disponible.
function sizeDomCanvas(){const c=$('dom-canvas'),w=$('dom-wrap');
 const ratio=domaine.carte.ratio||16/9,dispoW=w.clientWidth||600,dispoH=w.clientHeight||400;
 let lw=dispoW,lh=lw/ratio;if(lh>dispoH){lh=dispoH;lw=lh*ratio}
 c.style.width=Math.round(lw)+'px';c.style.height=Math.round(lh)+'px'}
function applyDomZoom(){const c=$('dom-canvas'),w=c.clientWidth||1,h=c.clientHeight||1;
 if(domZoom<=1){domPanX=(1-domZoom)*w/2;domPanY=(1-domZoom)*h/2}
 else{domPanX=Math.min(0,Math.max(-(domZoom-1)*w,domPanX));domPanY=Math.min(0,Math.max(-(domZoom-1)*h,domPanY))}
 c.style.transform='translate('+domPanX+'px,'+domPanY+'px) scale('+domZoom+')';c.style.setProperty('--z',domZoom);
 $('dom-zoom-label').textContent=Math.round(domZoom*100)+' %'}
function zoomDomAt(f,cx,cy){const z=Math.min(8,Math.max(.4,domZoom*f));domPanX=cx-(cx-domPanX)*z/domZoom;domPanY=cy-(cy-domPanY)*z/domZoom;domZoom=z;applyDomZoom()}
$('dom-zoom-in').onclick=()=>{const c=$('dom-canvas');zoomDomAt(1.25,c.clientWidth/2,c.clientHeight/2)};
$('dom-zoom-out').onclick=()=>{const c=$('dom-canvas');zoomDomAt(1/1.25,c.clientWidth/2,c.clientHeight/2)};
$('dom-zoom-reset').onclick=()=>{domZoom=1;domPanX=domPanY=0;applyDomZoom()};
$('dom-wrap').addEventListener('wheel',e=>{const r=$('dom-canvas').getBoundingClientRect();
 if(e.ctrlKey||e.metaKey){e.preventDefault();zoomDomAt(Math.exp(-e.deltaY*.0035),e.clientX-r.left,e.clientY-r.top);return}
 if(domZoom>1){e.preventDefault();domPanX-=e.deltaX;domPanY-=e.deltaY;applyDomZoom()}},{passive:false});
const domAuZoom=v=>v/Math.max(1,domZoom);
function renderDomaineEditeur(){if(!domaineEdite)return;const d=domaine;
 $('dom-nom').value=d.nom;$('dom-vue').value=String(domVue);
 CALQUES_DOMAINE.forEach((_,i)=>{const on=!!d.carte.calques[i];$('dom-calque-'+i).classList.toggle('on',on);$('dom-calque-x-'+i).hidden=!on});
 document.querySelectorAll('#dom-outils [data-outil]').forEach(b=>b.classList.toggle('on',b.dataset.outil===domOutil));
 $('dom-canvas').classList.toggle('sans-contours',!domContours);$('dom-contours-editeur').classList.toggle('on',domContours);
 $('dom-hint').textContent=d.carte.calques.some(Boolean)?DOM_HINTS[domOutil]||'':'Commence par charger le calque « Friche » : l’image du village avant toute construction. Puis les autres — étapes, puis états — au même cadrage.';
 $('dom-undo').disabled=!domUndo.length;$('dom-redo').disabled=!domRedo.length;
 sizeDomCanvas();applyDomZoom();
 const vide=!dessineDomaine($('dom-fond'),domVue,()=>{if(domaineEdite)dessineDomaine($('dom-fond'),domVue)});
 $('dom-canvas').classList.toggle('no-image',vide);
 renderDomZones();renderDomListe();renderDomSel()}
// Les zones et les sommets se redessinent seuls pendant un geste : l'image, elle, ne bouge pas.
function renderDomZones(){dessineZonesDom($('dom-zones'),$('dom-etiquettes'),{sel:domSel,trace:domTrace,
  ...(domOutil==='select'?{deplace:(b,pt)=>{pushDomUndo();b.etiquette=pt;renderDomaineEditeur();sauveDomaine()},clic:b=>{domSel=domaine.batiments.indexOf(b);renderDomaineEditeur()},
   deplaceCartouche:(k,pt)=>{pushDomUndo();domaine.carte.cartouches[k]=pt;renderDomaineEditeur();sauveDomaine()}}:{})});
 const boite=$('dom-sommets');boite.replaceChildren();const b=domSel!==null?domaine.batiments[domSel]:null;
 if(!b||!b.zone||domOutil!=='select')return;
 b.zone.forEach(([x,y],i)=>{const s=document.createElement('span');s.className='dom-sommet';s.dataset.sommet=String(i);
  s.style.left=x+'%';s.style.top=y+'%';s.title='Tirer pour déplacer ce sommet';boite.append(s)})}
function renderDomListe(){const boite=$('dom-liste');boite.replaceChildren();
 domaine.batiments.forEach((b,i)=>{const row=document.createElement('button');row.className='dom-ligne e'+b.etape+(domSel===i?' current':'');
  const nom=document.createElement('strong');nom.textContent=b.nom;
  const det=document.createElement('small');det.textContent=NOM_ETAPE(b.etape)+(b.etat?' · '+NOM_ETAT_BATIMENT(b.etat).toLowerCase():'')+(b.zone?' · tracé':' · sans zone');
  row.append(nom,det);row.onclick=()=>{domSel=i;domTrace=null;renderDomaineEditeur()};boite.append(row)})}
function renderDomSel(){const boite=$('dom-sel-boite');boite.replaceChildren();const b=domSel!==null?domaine.batiments[domSel]:null;
 if(!b){const p=document.createElement('p');p.className='muted';p.textContent='Aucun bâtiment choisi.';boite.append(p);return}
 const nom=document.createElement('input');nom.maxLength=60;nom.value=b.nom;nom.setAttribute('aria-label','Nom du bâtiment');
 nom.oninput=()=>{b.nom=nom.value.slice(0,60)||'Bâtiment';renderDomListe();renderDomZones();sauveDomaine()};
 const etape=document.createElement('select');etape.setAttribute('aria-label','Étape');
 ETAPES_DOMAINE.forEach(([k,n],i)=>etape.add(new Option(n,String(i))));etape.value=String(b.etape);
 etape.onchange=()=>{pushDomUndo();b.etape=Number(etape.value);renderDomaineEditeur();sauveDomaine()};
 // L'état : intact, en feu, en ruines, hanté, abandonné, envahi — il ne se construit pas, il arrive.
 const etat=document.createElement('select');etat.setAttribute('aria-label','État');
 ETATS_BATIMENT.forEach(([k,n])=>etat.add(new Option(n,k)));etat.value=b.etat||'';
 etat.onchange=()=>{pushDomUndo();b.etat=etatBatimentValide(etat.value);renderDomaineEditeur();sauveDomaine()};
 const tracer=document.createElement('button');tracer.textContent=b.zone?'Retracer la zone':'Tracer la zone';
 tracer.onclick=()=>{domOutil='zone';domTrace=null;renderDomaineEditeur()};
 const actions=document.createElement('div');actions.className='side-actions';actions.append(tracer);
 if(b.zone){const efface=document.createElement('button');efface.textContent='Effacer la zone';
  efface.onclick=()=>{pushDomUndo();b.zone=null;renderDomaineEditeur();renderMapList();sauveDomaine()};actions.append(efface)}
 const suppr=document.createElement('button');suppr.textContent='Supprimer le bâtiment';suppr.className='dom-danger';
 suppr.onclick=()=>{if(!confirm('Supprimer « '+b.nom+' » du domaine ?'))return;pushDomUndo();
  domaine.batiments.splice(domSel,1);domSel=null;renderDomaineEditeur();renderMapList();sauveDomaine()};
 actions.append(suppr);
 const l1=document.createElement('label');l1.textContent='Nom';l1.append(nom);
 const l2=document.createElement('label');l2.textContent='Étape';l2.append(etape);
 const l3=document.createElement('label');l3.textContent='État';l3.append(etat);
 boite.append(l1,l2,l3,actions)}
$('dom-bat-add').onclick=()=>{pushDomUndo();const b=nouveauBatiment('Bâtiment '+(domaine.batiments.length+1));domaine.batiments.push(b);
 domSel=domaine.batiments.length-1;renderDomaineEditeur();sauveDomaine()};
/* ---------- Le tracé ---------- */
const domPct=e=>{const r=$('dom-canvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,100*(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(e.clientY-r.top)/r.height))}};
/* Fermer le tracé : l'encre redressée si la main a couru, telle quelle si l'on a cliqué
   point par point. La zone va au bâtiment choisi ; sans bâtiment choisi, elle en fait un. */
function fermeTraceDom(){const t=domTrace;domTrace=null;if(!t||t.pts.length<3){renderDomZones();return}
 const pts=zoneValide(t.bouge?encreDroite([t.pts])[0]:t.pts);if(!pts){renderDomZones();return}
 pushDomUndo();
 if(domSel===null||!domaine.batiments[domSel]){domaine.batiments.push(nouveauBatiment('Bâtiment '+(domaine.batiments.length+1)));domSel=domaine.batiments.length-1}
 domaine.batiments[domSel].zone=pts;domOutil='select';renderDomaineEditeur();renderMapList();sauveDomaine()}
$('dom-canvas').addEventListener('pointerdown',e=>{if(!domaineEdite||e.button!==0)return;const p=domPct(e);
 if(domOutil==='select'&&e.target.dataset.sommet!==undefined&&domSel!==null){pushDomUndo();
  domDrag={mode:'sommet',i:Number(e.target.dataset.sommet)};$('dom-canvas').setPointerCapture(e.pointerId);e.preventDefault();return}
 if(domOutil==='zone'){if(!domTrace)domTrace={pts:[],bouge:false};
  if(domTrace.pts.length>2&&Math.hypot(p.x-domTrace.pts[0][0],p.y-domTrace.pts[0][1])<domAuZoom(1.6)){fermeTraceDom();return}
  domTrace.pts.push([p.x,p.y]);domDrag={mode:'trace'};$('dom-canvas').setPointerCapture(e.pointerId);renderDomZones();e.preventDefault();return}
 const i=batimentSous(domaine,[p.x,p.y]);domSel=i>=0?i:null;
 if(i>=0){pushDomUndo();domDrag={mode:'move',from:p,orig:structuredClone(domaine.batiments[i].zone)};$('dom-canvas').setPointerCapture(e.pointerId)}
 renderDomZones();renderDomListe();renderDomSel();e.preventDefault()});
$('dom-canvas').addEventListener('pointermove',e=>{if(!domDrag)return;const p=domPct(e),d=domDrag,b=domSel!==null?domaine.batiments[domSel]:null;
 if(d.mode==='trace'){const der=domTrace.pts[domTrace.pts.length-1];
  if(Math.hypot(p.x-der[0],p.y-der[1])>=domAuZoom(.6)){domTrace.pts.push([p.x,p.y]);domTrace.bouge=true;renderDomZones()}return}
 if(!b||!b.zone)return;
 if(d.mode==='sommet'){b.zone[d.i]=[p.x,p.y];renderDomZones();return}
 if(d.mode==='move'){b.zone=deplaceZone(d.orig,p.x-d.from.x,p.y-d.from.y);renderDomZones()}});
$('dom-canvas').addEventListener('pointerup',()=>{if(!domDrag)return;const d=domDrag;domDrag=null;
 if(d.mode==='trace'){if(domTrace&&domTrace.bouge&&domTrace.pts.length>=3)fermeTraceDom();return}
 // Un clic sans glisser n'a rien changé : on ne garde pas d'étape d'annulation pour rien.
 renderDomaineEditeur();sauveDomaine()});
document.addEventListener('keydown',e=>{if(!domaineEdite||!document.body.classList.contains('page-maps'))return;
 if(e.target.closest('input,textarea,select'))return;
 const k=e.key.toLowerCase();
 if(k==='z'&&(e.metaKey||e.ctrlKey)){e.preventDefault();e.shiftKey?domRetablit():domAnnule();return}
 if(domTrace&&e.key==='Enter'){e.preventDefault();fermeTraceDom();return}
 if(domTrace&&e.key==='Escape'){e.preventDefault();domTrace=null;renderDomZones();return}
 if((e.key==='Delete'||e.key==='Backspace')&&domSel!==null&&domaine.batiments[domSel]&&domaine.batiments[domSel].zone){e.preventDefault();
  pushDomUndo();domaine.batiments[domSel].zone=null;renderDomaineEditeur();renderMapList();sauveDomaine()}});
window.addEventListener('resize',()=>{if(domaineEdite&&document.body.classList.contains('page-maps'))renderDomaineEditeur()});

/* ---------- L'onglet Domaine ---------- */
let domPageSel=null;
const domainePage=document.createElement('main');domainePage.id='domaine-page';
domainePage.innerHTML=
 '<aside class="panel dom-col" id="dom-col-bat"><h2>Bâtiments</h2><div id="dom-bats"></div></aside>'
 +'<section class="panel dom-centre"><header class="dom-tete"><h2 id="dom-titre"></h2>'
 +'<span class="dom-tresor" id="dom-tresor-tete"></span><span class="dom-actions"><button id="dom-contours" title="Montrer ou cacher le contour des bâtiments">▦ Contours</button><button id="dom-journal-quetes">📜 Journal de quêtes</button><button id="dom-editer">✎ Modifier la carte</button>'
 +'<button id="dom-export" title="Télécharger le domaine — carte, bâtiments, finances, habitants — dans un fichier .json">⇩ Exporter</button><button id="dom-import" title="Reprendre un domaine exporté, à la place de celui-ci">⇧ Importer</button><input type="file" id="dom-json" accept="application/json,.json" hidden></span></header>'
 +'<div class="dom-secours" id="dom-secours" hidden></div>'
 +'<div class="dom-carte-wrap"><div id="dom-plan"><canvas id="dom-plan-fond"></canvas><svg id="dom-plan-zones" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>'
 +'<div id="dom-plan-etiquettes"></div><p class="muted dom-plan-vide" id="dom-plan-vide" hidden>Aucune carte du domaine. Dessine-la dans l’onglet Cartes : des calques — un par étape, un par état.</p></div></div>'
 +'<div id="dom-fiche"></div></section>'
 +'<aside class="panel dom-col" id="dom-col-gestion"><h2>Finances</h2><div id="dom-finances"></div>'
 +'<div class="divider"></div><h2>Ressources</h2><div id="dom-ressources"></div>'
 +'<div class="divider"></div><h2>Quêtes</h2><div id="dom-quetes"></div>'
 +'<div class="divider"></div><h2>Habitants et visiteurs</h2><div id="dom-pnj"></div>'
 +'<div class="divider"></div><h2>Aventuriers</h2><div id="dom-aventuriers"></div></aside>';
document.querySelector('main.layout').after(domainePage);
$('dom-editer').onclick=ouvreEditeurDomaine;
/* Le domaine s'exporte à part : un fichier .json qui se suffit — calques compris —, pour le
   garder ou le reprendre ailleurs. Il vit aussi dans la sauvegarde globale de la partie, et
   c'est elle que l'import sait lire aussi : on en tire le domaine, rien d'autre. */
function nomFichierDomaine(d=new Date()){const p=n=>String(n).padStart(2,'0');
 const nom=(domaine.nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,40)||'domaine';
 return 'amertume-domaine-'+nom+'-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.json'}
function exporterDomaine(){const texte=JSON.stringify({app:'amertume_online',genre:'domaine',exporte:new Date().toISOString(),domaine});
 const url=URL.createObjectURL(new Blob([texte],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=nomFichierDomaine();
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 log('Domaine exporté : '+a.download+' ('+tailleLisible(texte.length)+').',{local:true})}
function lireFichierDomaine(texte){let o;try{o=JSON.parse(texte)}catch(e){throw Error('Ce fichier n’est pas du JSON.')}
 // Un export du domaine, une sauvegarde globale, une campagne : chacun porte un domaine.
 const d=o&&typeof o==='object'&&!Array.isArray(o)?(o.genre==='domaine'||o.domaine?o.domaine:o.genre==='campagne'&&o.partie&&o.partie.domaine?o.partie.domaine:Array.isArray(o.batiments)?o:null):null;
 if(!d||typeof d!=='object'||Array.isArray(d)||!Array.isArray(d.batiments))throw Error('Ce fichier n’est pas un domaine d’Amertume Online.');
 return normaliseDomaine(d)}
function importerDomaine(f){const lecteur=new FileReader();lecteur.onerror=()=>alert('Lecture du fichier impossible.');
 lecteur.onload=()=>{let d;try{d=lireFichierDomaine(String(lecteur.result))}catch(e){alert(e.message);return}
  if(!confirm('Remplacer le domaine actuel « '+domaine.nom+' » par « '+d.nom+' » ? Bâtiments, carte, finances, habitants et aventuriers seront ceux du fichier.'))return;
  domaine=d;domSel=null;domPageSel=null;domUndo=[];domRedo=[];imagesDom.clear();
  renderDomaine();renderMapList();sauveDomaine();log('Domaine importé : '+d.nom+'.',{local:true})};
 lecteur.readAsText(f)}
$('dom-export').onclick=exporterDomaine;$('dom-import').onclick=()=>$('dom-json').click();
$('dom-json').onchange=()=>{const f=$('dom-json').files[0];$('dom-json').value='';if(f)importerDomaine(f)};
/* Les contours des bâtiments ne se montrent que sur demande : la carte se lit sans traits.
   Un seul réglage pour l'onglet et l'éditeur — le bouton de l'un suit celui de l'autre. */
let domContours=false;
function basculeContours(){domContours=!domContours;
 if(document.body.classList.contains('page-domaine'))renderDomaine();else if(domaineEdite)renderDomaineEditeur()}
$('dom-contours').onclick=basculeContours;$('dom-contours-editeur').onclick=basculeContours;
function renderDomaine(leger){const d=domaine,mj=mjDom();vueDomaine=view;if(mj&&evacueNonConstruits())scheduleSave();if(mj)recueilleDepots(false);
 bandeauSecours();
 // Les joueurs lisent le domaine ; ce qui le modifie — carte, export, import — reste au MJ.
 ['dom-editer','dom-export','dom-import','dom-contours'].forEach(id=>$(id).hidden=!mj);
 $('dom-titre').textContent=d.nom;$('dom-tresor-tete').textContent='Trésor : '+montantLisible(d.finances.tresor);
 if(domPageSel!==null&&!batimentChoisissable(batimentDom(domPageSel)))domPageSel=null;
 const plan=$('dom-plan');plan.style.setProperty('--ratio',String(d.carte.ratio||16/9));
 // Relu à la volée, l'onglet garde son fond : il ne change qu'avec le domaine lui-même.
 const vide=leger?plan.classList.contains('no-image'):!dessineDomaine($('dom-plan-fond'),-1,()=>{if(document.body.classList.contains('page-domaine'))dessineDomaine($('dom-plan-fond'),-1)});
 $('dom-plan-vide').hidden=!vide;plan.classList.toggle('no-image',vide);
 const sel=d.batiments.findIndex(b=>b.id===domPageSel);
 // Les contours sont un outil du MJ : chez les joueurs, la carte se lit toujours sans traits.
 plan.classList.toggle('sans-contours',!(mj&&domContours));$('dom-contours').classList.toggle('on',domContours);
 // Sur l'onglet, le nom ne se déplace pas : il choisit le bâtiment, c'est tout.
 dessineZonesDom($('dom-plan-zones'),$('dom-plan-etiquettes'),{sel:sel>=0?sel:null,jeu:true,inerte:b=>!batimentChoisissable(b),
  clic:b=>{domPageSel=domPageSel===b.id?null:b.id;renderDomaine()}});
 renderDomBats();renderDomFiche();renderDomFinances();renderDomRessources();renderDomQuetes();renderDomPnj();renderDomAventuriers();{const jq=document.getElementById('dom-journal-quetes-vue');if(jq&&jq.open)renderJournalQuetes()}}
$('dom-plan-zones').addEventListener('click',e=>{const z=e.target.closest('[data-bat]');if(!z)return;
 const b=domaine.batiments[Number(z.dataset.bat)];if(b&&!batimentChoisissable(b))return;domPageSel=b&&domPageSel!==b.id?b.id:null;renderDomaine()});
// Construire : d'un clic, si le trésor y suffit ; sinon le MJ confirme, et le trésor plonge.
function construireDom(b){const p=peutConstruire(domaine,b);if(p.fini)return;
 if(!p.ok&&!confirm('Le trésor ne suffit pas : il manque '+montantLisible(p.manque)+'. Construire quand même ? Le trésor passera en dessous de zéro.'))return;
 construire(domaine,b,true);renderDomaine();sauveDomaine()}
function boutonConstruire(b){const p=peutConstruire(domaine,b),btn=document.createElement('button');btn.className='dom-construire';
 if(p.fini){btn.textContent='Construit';btn.disabled=true;return btn}
 const e=prochaineEtape(b);btn.textContent='Construire → '+NOM_ETAPE(e)+(p.cout?' · '+montantLisible(p.cout):' · gratuit');
 btn.classList.toggle('manque',!p.ok);btn.title=(p.ok?'Les joueurs bâtissent : le trésor paie l’étape suivante':'Il manque '+montantLisible(p.manque))+' — la ligne du journal leur est visible';
 btn.onclick=ev=>{ev.stopPropagation();construireDom(b)};return btn}
/* La colonne des bâtiments ne dit que l'essentiel : le nom et l'étape sur une ligne, et,
   dessous, l'état particulier s'il y en a un. Effets, présents et construction sont sur la fiche. */
function renderDomBats(){const boite=$('dom-bats');boite.replaceChildren();
 const liste=domaine.batiments.filter(batimentChoisissable);
 liste.forEach(b=>{const row=document.createElement('div');row.className='dom-bat e'+b.etape+(domPageSel===b.id?' sel':'');row.setAttribute('role','button');row.tabIndex=0;
  const tete=document.createElement('div');tete.className='dom-bat-tete';
  const nom=document.createElement('strong');nom.textContent=b.nom;
  const et=document.createElement('span');et.className='dom-etape';et.textContent=NOM_ETAPE(b.etape);tete.append(nom,et);row.append(tete);
  if(b.etat){const x=document.createElement('span');x.className='dom-etat etat-'+b.etat;x.textContent=NOM_ETAT_BATIMENT(b.etat);row.append(x)}
  const choisir=()=>{domPageSel=domPageSel===b.id?null:b.id;renderDomaine()};
  row.onclick=choisir;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choisir()}};
  boite.append(row)});
 if(!liste.length){const p=document.createElement('p');p.className='muted';p.textContent=mjDom()?'Aucun bâtiment. Ajoute-les dans l’éditeur de la carte.':'Aucun bâtiment n’est encore sorti de terre.';boite.append(p)}}
/* La fiche du bâtiment choisi : son nom, son étape, ce qu'elle coûte, ce qu'elle confère
   — un effet passif par étape, en toutes lettres pour l'instant —, et qui s'y trouve. */
function renderDomFiche(){const boite=$('dom-fiche');boite.replaceChildren();const b=batimentDom(domPageSel);
 // Sans bâtiment choisi, la fiche ne prend pas de place : ni texte, ni cadre.
 boite.hidden=!b;if(!b)return;
 if(!mjDom()){renderDomFicheLue(boite,b);return}
 const tete=document.createElement('div');tete.className='dom-fiche-tete';
 const nom=document.createElement('input');nom.value=b.nom;nom.maxLength=60;nom.className='dom-fiche-nom';nom.setAttribute('aria-label','Nom du bâtiment');
 nom.onchange=()=>{b.nom=nom.value.trim().slice(0,60)||'Bâtiment';renderDomaine();sauveDomaine()};
 const et=document.createElement('span');et.className='dom-etape e'+b.etape;et.textContent=NOM_ETAPE(b.etape);
 const recul=document.createElement('button');recul.textContent='↩ Étape précédente';recul.title='Corriger : revenir à l’étape d’avant, sans remboursement';recul.disabled=b.etape===0;
 recul.onclick=()=>{if(reculerEtape(b)){renderDomaine();sauveDomaine()}};
 // Poser l'étape suivante de sa main : sans payer, et sans ligne au journal des joueurs.
 const avance=document.createElement('button');avance.textContent='Étape suivante ↪';avance.className='dom-avance';
 avance.title='Le MJ pose l’étape suivante : rien n’est payé, et les joueurs n’en voient rien au journal';avance.disabled=b.etape>=ETAPES_DOMAINE.length-1;
 avance.onclick=()=>{if(avancerEtape(b)){renderDomaine();sauveDomaine()}};
 // L'état du bâtiment : intact, en feu, en ruines, hanté, abandonné, envahi — la carte le montre s'il a son calque.
 const etat=document.createElement('select');etat.className='dom-etat-choix';etat.setAttribute('aria-label','État du bâtiment');
 ETATS_BATIMENT.forEach(([k,n])=>etat.add(new Option(n,k)));etat.value=b.etat||'';
 etat.onchange=()=>{b.etat=etatBatimentValide(etat.value);renderDomaine();sauveDomaine()};
 // Sa fonction : ce qu'il fait pour la troupe, construit et intact.
 const fonc=document.createElement('select');fonc.className='dom-etat-choix dom-fonction-choix';fonc.setAttribute('aria-label','Fonction du bâtiment');
 FONCTIONS_BATIMENT.forEach(([k,n])=>fonc.add(new Option(n,k)));fonc.value=b.fonction||'';
 fonc.onchange=()=>{b.fonction=FONCTIONS_BATIMENT.some(([k])=>k===fonc.value)?fonc.value:'';renderDomaine();sauveDomaine()};
 // v1.013 : une Herboristerie a un laboratoire, de niveau 1 à 3 : les recettes en demandent un.
 const labo=b.fonction==='herboristerie'?document.createElement('select'):null;
 if(labo){labo.className='dom-etat-choix';labo.setAttribute('aria-label','Niveau du laboratoire');[1,2,3].forEach(n=>labo.add(new Option('Labo '+n,String(n))));labo.value=String(b.labo||1);
  labo.onchange=()=>{b.labo=Math.max(1,Math.min(3,Number(labo.value)||1));renderDomaine();sauveDomaine()}}
 tete.append(nom,et,etat,fonc,boutonConstruire(b),recul,avance);boite.append(tete);if(labo)fonc.after(labo);
 {const cartes=(typeof maps!=='undefined'?maps:[]).filter(m=>m&&m.batiment===b.id);
  if(cartes.length){const l=document.createElement('div');l.className='dom-cartes-bat';
   cartes.forEach(m=>{const x=document.createElement('button');x.type='button';x.textContent='⚔ '+(m.name||'Carte');x.title='Ouvrir cette carte de combat sur la table';
    x.onclick=()=>{openBattleMap(m.id);showPage('table')};l.append(x)});boite.append(l)}}
 const grille=document.createElement('div');grille.className='dom-couts';
 [1,2,3].forEach(e=>{const l=document.createElement('label');l.textContent='Coût — '+NOM_ETAPE(e);
  const inp=document.createElement('input');inp.type='number';inp.min='0';inp.step='1';inp.value=String(b.couts[e-1]);
  inp.onchange=()=>{b.couts[e-1]=Math.max(0,Math.trunc(Number(inp.value))||0);renderDomaine();sauveDomaine()};l.append(inp);grille.append(l)});
 boite.append(grille);
 const effets=document.createElement('div');effets.className='dom-effets';
 const titre=document.createElement('h3');titre.className='reglage-titre';titre.textContent='Effets et pouvoirs passifs, par étape';effets.append(titre);
 ETAPES_DOMAINE.forEach(([k,n],i)=>{const l=document.createElement('label');l.className='dom-effet-etape e'+i+(i===b.etape?' actuelle':'');
  l.textContent=n+(i===b.etape?' — en cours':'');
  const ta=document.createElement('textarea');ta.rows=2;ta.maxLength=600;ta.value=b.effets[i];ta.placeholder='Ce que le bâtiment confère à cette étape…';
  ta.onchange=()=>{b.effets[i]=ta.value.slice(0,600);renderDomBats();sauveDomaine()};l.append(ta);effets.append(l)});
 boite.append(effets);
 const notes=document.createElement('label');notes.className='dom-notes';notes.textContent='Notes du MJ';
 const ta=document.createElement('textarea');ta.rows=3;ta.maxLength=2000;ta.value=b.notes;ta.placeholder='Intrigues, secrets, ce qui s’y trame…';
 ta.onchange=()=>{b.notes=ta.value.slice(0,2000);sauveDomaine()};notes.append(ta);boite.append(notes);
 const qui=document.createElement('p');qui.className='muted dom-qui';
 // Les aventuriers présents se lisent sur leurs boutons, dessous.
 const pnj=pnjDuBatiment(domaine,b.id).map(p=>p.nom);
 qui.textContent=pnj.length?'Présents : '+pnj.join(', '):'Personne n’y vit ni n’y passe.';
 boite.append(qui);finFiche(boite,b)}
/* La fiche telle que la lisent les joueurs : le nom, l'étape, l'état, ce que coûtent les
   étapes, ce que confère chacune, qui s'y trouve — rien à corriger, et pas les notes du MJ. */
function renderDomFicheLue(boite,b){const tete=document.createElement('div');tete.className='dom-fiche-tete';
 const nom=document.createElement('h3');nom.className='dom-fiche-nom-lu';nom.textContent=b.nom;
 const et=document.createElement('span');et.className='dom-etape e'+b.etape;et.textContent=NOM_ETAPE(b.etape);tete.append(nom,et);
 if(b.etat){const x=document.createElement('span');x.className='dom-etat etat-'+b.etat;x.textContent=NOM_ETAT_BATIMENT(b.etat);tete.append(x)}
 boite.append(tete);
 // Ce qui reste à bâtir, et son prix ; les étapes passées se lisent sur le cartouche.
 const reste=[1,2,3].filter(e=>e>b.etape);
 if(reste.length){const couts=document.createElement('p');couts.className='muted dom-couts-lus';
  couts.textContent='Reste à bâtir : '+reste.map(e=>NOM_ETAPE(e)+' '+(b.couts[e-1]?montantLisible(b.couts[e-1]):'gratuit')).join(' · ');boite.append(couts)}
 const effets=document.createElement('div');effets.className='dom-effets-lus';
 ETAPES_DOMAINE.forEach(([k,n],i)=>{const texte=(b.effets[i]||'').trim();if(!texte)return;
  const p=document.createElement('p');p.className='dom-effet-lu e'+i+(i===b.etape?' actuelle':'');
  const t=document.createElement('b');t.textContent=n+(i===b.etape?' — en cours':'')+' : ';p.append(t,texte);effets.append(p)});
 if(effets.children.length)boite.append(effets);
 const qui=document.createElement('p');qui.className='muted dom-qui';
 // Les aventuriers présents se lisent sur leurs boutons, dessous.
 const pnj=pnjDuBatiment(domaine,b.id).map(p=>p.nom);
 qui.textContent=pnj.length?'Présents : '+pnj.join(', '):'Personne n’y vit ni n’y passe.';
 boite.append(qui);finFiche(boite,b)}
/* ---------- Se déplacer, et ce que fait le bâtiment ---------- */
// Au bas de la fiche : un bouton par aventurier pour s'y rendre, puis la fonction du bâtiment.
function finFiche(boite,b){const dep=blocDeplacements(b);if(dep)boite.append(dep);const f=blocFonction(b);if(f)boite.append(f);const q=blocQuetes(b);if(q)boite.append(q)}
function deplaceAventurier(a,b){if(!agitPour(a)||!batimentConstruit(b)||lieuDe(a)===b.id)return;
 poseLieu(a,b.id);renderDomaine(true);render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
/* Chaque bâtiment construit a un bouton par aventurier : « S'y déplacer », ou « Ici » pour qui
   s'y trouve déjà. Le joueur déplace le sien ; le MJ, tout le monde. */
function blocDeplacements(b){const troupe=actors.filter(a=>a.hero);if(!troupe.length||!batimentConstruit(b))return null;
 const out=document.createElement('div');out.className='dom-deplacements';
 troupe.forEach(a=>{const ici=lieuDe(a)===b.id,moi=agitPour(a);
  const btn=document.createElement('button');btn.type='button';btn.className='dom-deplace'+(ici?' ici':'');
  const nom=document.createElement('span');nom.className='dom-deplace-nom';nom.textContent=a.name;
  const quoi=document.createElement('small');quoi.textContent=ici?'Ici':'S’y déplacer';
  btn.append(jetonRond(a.image,a.name,'mini'),nom,quoi);btn.disabled=ici||!moi;
  btn.title=ici?a.name+' est ici.':moi?'Déplacer '+a.name+' : '+b.nom:'Seul le joueur de '+a.name+' le déplace.';
  btn.onclick=()=>deplaceAventurier(a,b);out.append(btn)});
 return out}
/* La fonction du bâtiment : ouverte s'il est construit et intact, fermée sinon — et la fiche
   dit pourquoi. */
function blocFonction(b){if(!b.fonction)return null;const out=document.createElement('section');out.className='dom-fonction f-'+b.fonction;
 const h=document.createElement('h3');h.className='reglage-titre';h.textContent=NOM_FONCTION(b.fonction);out.append(h);
 if(!fonctionActive(b)){const p=document.createElement('p');p.className='muted dom-fonction-arret';
  p.textContent='Fermé : '+(batimentConstruit(b)?'le bâtiment est '+NOM_ETAT_BATIMENT(b.etat).toLowerCase()+'.':'le bâtiment n’est pas construit.');out.append(p);return out}
 if(b.fonction==='magasin')blocMagasin(out,b);
 if(b.fonction==='tannerie')blocTannerie(out,b);
 if(b.fonction==='herboristerie')blocHerboristerie(out,b);
 return out}
/* ---------- Le magasin ---------- */
/* On y achète ce que l'armurerie met en vente, au prix de l'armurerie ; on y revend son
   équipement à la moitié de ce prix, arrondie en dessous. Il faut s'y trouver : l'acheteur
   est un aventurier présent — le sien pour un joueur, au choix pour le MJ. */
let clientMagasin=null;
// Qui agit ici : un aventurier présent — le sien pour un joueur, au choix pour le MJ —, et son or.
function enteteClient(out,b,ici){const presents=actors.filter(a=>a.hero&&lieuDe(a)===b.id),clients=presents.filter(agitPour);
 const client=clients.find(a=>a.id===clientMagasin)||clients[0]||null;
 const tete=document.createElement('div');tete.className='dom-magasin-client';
 if(client){
  if(clients.length>1){const choix=document.createElement('select');choix.setAttribute('aria-label','Qui agit ici');
   clients.forEach(a=>choix.add(new Option(a.name,a.id)));choix.value=client.id;choix.onchange=()=>{clientMagasin=choix.value;renderDomaine(true)};tete.append(choix)}
  else{const n=document.createElement('strong');n.textContent=client.name;tete.append(jetonRond(client.image,client.name,'mini'),n)}
  tete.append(ligneOr(orDe(client),null))}
 else{const p=document.createElement('p');p.className='muted';
  p.textContent=presents.length?'Seul le joueur d’un aventurier présent agit ici.':'Personne '+ici+' : déplace un aventurier ici.';tete.append(p)}
 out.append(tete);return client}
const titreFonction=t=>{const h=document.createElement('h4');h.className='dom-magasin-titre';h.textContent=t;return h};
const texteFonction=(out,t)=>{const p=document.createElement('p');p.className='muted';p.textContent=t;out.append(p)};
function blocMagasin(out,b){const client=enteteClient(out,b,'au magasin');
 const titre=titreFonction;
 // Ce qui est en vente : les pièces de l'armurerie cochées « Magasin », rangées comme elle.
 const rang=o=>['melee','ranged','armor','object','cle','ressource','restes','herbe','treasure'].indexOf(itemColumn(o));
 const enVente=(catalog.items||[]).filter(o=>o&&o.magasin===true).sort((x,y)=>rang(x)-rang(y)||x.name.localeCompare(y.name,'fr'));
 out.append(titre('Acheter'));
 if(!enVente.length){const p=document.createElement('p');p.className='muted';p.textContent=mjDom()?'Rien en vente : coche « Magasin » sur des objets de l’armurerie.':'Rien en vente pour l’instant.';out.append(p)}
 else{const g=document.createElement('div');g.className='dom-articles';
  enVente.forEach(o=>{const p=client?peutAcheter(client,o):null;
   g.append(carteMagasin(o,1,prixAchat(o),!!p&&p.ok,!client?'Il faut être au magasin pour acheter.':p.ok?'Acheter '+o.name+' pour '+prixAchat(o)+' or':'Il manque '+p.manque+' or.',()=>acheterPour(client,o),'achat',client?boutonCoffre(prixAchat(o),()=>acheterPour(client,o,true)):null))});
  out.append(g)}
 if(!client)return;
 // Ce que l'acheteur peut revendre : son inventaire, une carte par pièce, le nombre s'il en a plusieurs.
 const comptes=new Map();(client.inventaire||[]).forEach(id=>{const o=(catalog.items||[]).find(x=>x&&x.id===id);if(o)comptes.set(o,(comptes.get(o)||0)+1)});
 out.append(titre('Vendre — '+TAUX_VENTE+' % du prix'));
 if(!comptes.size){const p=document.createElement('p');p.className='muted';p.textContent=client.name+' n’a rien à vendre.';out.append(p);return}
 const g=document.createElement('div');g.className='dom-articles';
 [...comptes.entries()].sort(([x],[y])=>rang(x)-rang(y)||x.name.localeCompare(y.name,'fr'))
  .forEach(([o,n])=>g.append(carteMagasin(o,n,prixVente(o),true,'Vendre '+o.name+' pour '+prixVente(o)+' or',()=>vendrePour(client,o),'vente')));
 out.append(g)}
/* Une pièce au magasin : le carré de l'armurerie, sa description au survol, son nom, le prix dans
   un rond doré en haut à droite du carré — d'achat ou de revente — et le bouton qui agit. */
/* Un article : un clic sur l'objet l'achète ou le vend ; hors de portée, il pâlit. Ce qu'un clic
   ferait se lit au bas de sa bulle. */
function carteMagasin(o,n,prix,actif,titre,faire,sens,sous){const carte=document.createElement('div');carte.className='cat-carte dom-article '+sens;
 const p=gearCarre(o,n,0);p.classList.remove('dispo');const coche=p.querySelector('.marque-porte');if(coche)coche.remove();
 p.removeAttribute('title');p.setAttribute('aria-label',titre);p.classList.add(actif?'a-cliquer':'indispo');p.setAttribute('aria-disabled',String(!actif));
 const agit=e=>{e.preventDefault();if(actif)faire()};p.onclick=agit;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')agit(e)};
 if(BULLES)surveille(p,()=>{const d=gearDetail(o,null,false);d.hidden=false;d.classList.add('large');
  const a=document.createElement('p');a.className='bulle-action'+(actif?'':' non');a.textContent=actif?'Clic : '+titre.charAt(0).toLowerCase()+titre.slice(1)+'.':titre;d.append(a);ouvrirBulle(p,d,'bulle-gear')});
 const nom=document.createElement('span');nom.className='nom-carte';nom.textContent=o.name;
 if(prix!==null){const piece=document.createElement('span');piece.className='dom-prix';piece.textContent=prix?prix.toLocaleString('fr-FR'):'0';
  piece.title=(sens==='vente'?'Revente : ':'Prix : ')+(prix?prix.toLocaleString('fr-FR')+' or':'gratuit');p.append(piece)}
 carte.append(p,nom);if(sous)carte.append(sous);return carte}
function apresMagasin(){renderDomaine(true);render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
// v1.009 : « parCoffre » — l'or du Coffre de Groupe paie à la place de la bourse de l'aventurier.
function acheterPour(a,o,parCoffre){const p=peutAcheter(a,o),ici=batimentDom(lieuDe(a));if(!(parCoffre?p.enVente&&coffreVue().or>=p.prix:p.ok)||!agitPour(a)||!ici||ici.fonction!=='magasin'||!fonctionActive(ici))return;
 if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;if(parCoffre)versCoffre(a,{or:-p.prix,achat:o.id});else ajouteOr(a,-p.prix);ajouterInventaire(a,o);log(nomNum(a)+' achète '+o.name+' au magasin'+(p.prix?' pour '+p.prix+' or'+(parCoffre?' du coffre de groupe':''):'')+'.');apresMagasin()}
async function vendrePour(a,o){if(!agitPour(a)||!(a.inventaire||[]).includes(o.id))return;const v=prixVente(o);
 const porte=[...(a.weapons||[]),...(a.armures||[]),a.shieldId,a.munitionId].includes(o.id);
 const texte='Vendre « '+o.name+' »'+(porte?', que '+a.name+' porte,':'')+' pour '+v+' or ?';
 const ok=typeof demander==='function'?await demander(texte,'Vendre'):confirm(texte);
 if(!ok||!(a.inventaire||[]).includes(o.id))return;
 retirerInventaire(a,o);ajouteOr(a,v);log(nomNum(a)+' vend '+o.name+' au magasin'+(v?' pour '+v+' or':'')+'.');apresMagasin()}
/* ---------- La tannerie ---------- */
/* On y vend les restes pris aux adversaires, à leur valeur, ou on les change en ressources pour la
   réserve du domaine ; on y achète les produits du tanneur — les pièces cochées « Tanneur » —, ou
   on les fait fabriquer avec la réserve, d'après leur recette. */
function blocTannerie(out,b){const client=enteteClient(out,b,'à la tannerie');const titre=titreFonction;
 const rang=o=>['melee','ranged','armor','object','cle','ressource','restes','herbe','treasure'].indexOf(itemColumn(o));
 const produits=(catalog.items||[]).filter(o=>o&&o.tanneur===true).sort((x,y)=>rang(x)-rang(y)||x.name.localeCompare(y.name,'fr'));
 out.append(titre('Acheter'));
 if(!produits.length)texteFonction(out,mjDom()?'Rien à vendre : coche « Tanneur » sur des pièces de l’armurerie.':'Le tanneur n’a rien à vendre pour l’instant.');
 else{const g=document.createElement('div');g.className='dom-articles';
  produits.forEach(o=>{const prix=prixAchat(o),ok=!!client&&orDe(client)>=prix;
   g.append(carteMagasin(o,1,prix,ok,!client?'Il faut être à la tannerie pour acheter.':ok?'Acheter '+o.name+' pour '+prix+' or':'Il manque '+(prix-orDe(client))+' or.',()=>acheterTannerie(client,o),'achat',client?boutonCoffre(prix,()=>acheterTannerie(client,o,true)):null))});
  out.append(g)}
 // Fabriquer : la recette se prend dans la réserve du domaine.
 const fabricables=produits.filter(o=>o.recette&&o.recette.length);
 if(fabricables.length){out.append(titre('Fabriquer, avec la réserve du domaine et le coffre de groupe'));const reserve=reserveAvecCoffre(),g=document.createElement('div');g.className='dom-articles';
  fabricables.forEach(o=>{const manque=manqueRecette(reserve,o),ok=!!client&&!manque.length;
   g.append(carteMagasin(o,1,null,ok,!client?'Il faut être à la tannerie pour faire fabriquer.':ok?'Fabriquer '+o.name+' : '+texteRessources(Object.fromEntries(o.recette.map(r=>[r.cle,r.qte])))
    :'Il manque '+texteRessources(Object.fromEntries(manque))+' dans la réserve.',()=>fabriquerTannerie(client,o),'fabrique',puceRessources(Object.fromEntries(o.recette.map(r=>[r.cle,r.qte])),manque)))});
  out.append(g)}
 if(!client)return;
 // v1.014 : les recettes d'herboristerie qui se fabriquent ici, apprises à l'herboristerie.
 {const l=potionsHerbo().filter(o=>o.herbo.tannerie&&recettesDe(client).includes(o.id));
  if(l.length){out.append(titre('Fabriquer, recettes d’herboristerie'));const g=document.createElement('div');g.className='dom-articles';
   l.forEach(o=>{const refus=refusHerbo(client,o,b),manque=manqueHerbo(client,o),ok=!refus&&!manque.length;
    g.append(carteMagasin(o,o.herbo.quantite||1,null,ok,refus||(manque.length?'Il manque : '+manque.map(([n,q,v])=>(q-v)+' '+n).join(', ')+'.':'Fabriquer '+o.name),()=>fabriquerHerbo(client,o,b),'fabrique',puceIngredients(o,manque)))});
   out.append(g)}}
 // Les restes de l'aventurier : à vendre, ou à convertir.
 const restes=new Map();(client.inventaire||[]).forEach(id=>{const o=(catalog.items||[]).find(x=>x&&x.id===id);if(o&&o.category==='restes')restes.set(o,(restes.get(o)||0)+1)});
 const tries=[...restes.entries()].sort(([x],[y])=>x.name.localeCompare(y.name,'fr'));
 out.append(titre('Vendre des restes, à leur valeur'));
 if(!tries.length){texteFonction(out,client.name+' n’a pas de restes.');return}
 const gv=document.createElement('div');gv.className='dom-articles';
 tries.forEach(([o,n])=>gv.append(carteMagasin(o,n,prixAchat(o),true,'Vendre '+o.name+' pour '+prixAchat(o)+' or',()=>vendreReste(client,o),'vente')));out.append(gv);
 const convertibles=tries.filter(([o])=>Object.keys(rendementReste(o)).length);
 if(!convertibles.length)return;
 out.append(titre('Convertir en ressources, pour la réserve'));const gc=document.createElement('div');gc.className='dom-articles';
 convertibles.forEach(([o,n])=>{const r=rendementReste(o);gc.append(carteMagasin(o,n,null,true,'Convertir '+o.name+' en '+texteRessources(r),()=>convertirReste(client,o),'conversion',puceRessources(r)))});
 out.append(gc)}
/* ---------- v1.013 — L'Herboristerie ----------
   Construite et intacte, elle vend ses ingrédients (les pièces cochées « Herboriste »), enseigne ses recettes contre de l'or —
   à qui a le rang d'herboriste qu'il faut (un talent « Herboriste Novice », « Compagnon » ou « Maître ») dans un laboratoire
   du niveau voulu — et fabrique celles qu'on connaît. Les ingrédients se prennent dans le sac de l'aventurier, puis dans le
   Coffre de Groupe ; les ressources dans la réserve du domaine, puis le coffre ; les gemmes dans la bourse. */
const NOMS_RANGS_HERBO=['','Novice','Compagnon','Maître'];
function rangHerboriste(a){let r=0;const l=typeof talentsAuPalier==='function'?talentsAuPalier(a,catalog.talents||[]):[];
 l.forEach(t=>{const m=/herboriste\s+(novice|compagnon|ma[iî]tre)/i.exec(String(t&&t.name||''));if(m){const k=m[1][0].toLowerCase();r=Math.max(r,k==='n'?1:k==='c'?2:3)}});return r}
const recettesDe=a=>Array.isArray(a&&a.recettes)?a.recettes:[];
// v1.014 : toute pièce qui porte une recette d'herboristerie — une potion, ou les Gants de ronceur.
const potionsHerbo=()=>(catalog.items||[]).filter(o=>o&&!o.forge&&o.herbo);
function aLHerboristerie(a){const ici=a&&batimentDom(lieuDe(a));return !!a&&agitPour(a)&&!!ici&&ici.fonction==='herboristerie'&&fonctionActive(ici)}
// Ce qui manque pour la fabriquer : [nom, il faut, il y a], pièce par pièce.
function manqueHerbo(a,o){const c=coffreVue(),out=[],dansCoffre=id=>c.tabs.reduce((n,t)=>n+t.filter(x=>x===id).length,0);
 normaliseIngredients(o.ingredients).forEach(({id,n})=>{const p=objetDe(id),a1=(a.inventaire||[]).filter(x=>x===id).length+dansCoffre(id);if(a1<n)out.push([p?p.name:id,n,a1])});
 const r=reserveAvecCoffre();normaliseRecette(o.recette).forEach(({cle,qte})=>{const v=Number(r[cle])||0;if(v<qte)out.push([(ressourcesJeu().find(x=>x.cle===cle)||{}).nom||cle,qte,v])});
 Object.entries(normaliseGemmesRecette(o.gemmes)).forEach(([k,n])=>{const v=Number((a.richesses||{})[k])||0;if(v<n)out.push([(phraseRichesses({[k]:1})[0]||k).replace(/^1 /,''),n,v])});
 return out}
// Sous une recette : ce qu'il faut, pièce par pièce ; ce qui manque, en rouge.
function puceIngredients(o,manque){const w=document.createElement('span');w.className='dom-recette';const rouge=new Set(manque.map(([n])=>n));
 const puce=(n,q)=>{const p=document.createElement('span');p.className='puce-res'+(rouge.has(n)?' manque':'');p.textContent=q+' '+n;p.title=q+' '+n;w.append(p)};
 normaliseIngredients(o.ingredients).forEach(({id,n})=>{const p=objetDe(id);puce(p?p.name:id,n)});
 normaliseRecette(o.recette).forEach(({cle,qte})=>puce((ressourcesJeu().find(x=>x.cle===cle)||{}).nom||cle,qte));
 Object.entries(normaliseGemmesRecette(o.gemmes)).forEach(([k,n])=>puce((phraseRichesses({[k]:1})[0]||k).replace(/^1 /,''),n));return w}
// Ce qui manque pour l'apprendre ou la fabriquer, côté rang et laboratoire : une phrase, ou rien.
function refusHerbo(a,o,b){const h=o.herbo||{};if(rangHerboriste(a)<h.rang)return 'Il faut être Herboriste '+NOMS_RANGS_HERBO[h.rang]+'.';
 if(b&&b.fonction==='herboristerie'&&(b.labo||1)<h.labo)return 'Il faut un laboratoire de niveau '+h.labo+'.';return ''}
function blocHerboristerie(out,b){const client=enteteClient(out,b,'à l’herboristerie'),titre=titreFonction;
 const vendus=(catalog.items||[]).filter(o=>o&&o.herboriste===true).sort((x,y)=>x.name.localeCompare(y.name,'fr'));
 out.append(titre('Acheter'));
 if(!vendus.length)texteFonction(out,mjDom()?'Rien à vendre : coche « Herboriste » sur des pièces de l’armurerie.':'L’herboriste n’a rien à vendre pour l’instant.');
 else{const g=document.createElement('div');g.className='dom-articles';
  vendus.forEach(o=>{const prix=prixAchat(o),ok=!!client&&orDe(client)>=prix;
   g.append(carteMagasin(o,1,prix,ok,!client?'Il faut être à l’herboristerie pour acheter.':ok?'Acheter '+o.name+' pour '+prix+' or':'Il manque '+(prix-orDe(client))+' or.',()=>acheterHerbo(client,o),'achat',client?boutonCoffre(prix,()=>acheterHerbo(client,o,true)):null))});
  out.append(g)}
 const toutes=potionsHerbo().sort((x,y)=>x.herbo.rang-y.herbo.rang||x.herbo.labo-y.herbo.labo||x.name.localeCompare(y.name,'fr'));
 const connues=client?toutes.filter(o=>recettesDe(client).includes(o.id)&&!o.herbo.tannerie):[],aApprendre=toutes.filter(o=>!o.herbo.grimoire&&!(client&&recettesDe(client).includes(o.id)));
 if(aApprendre.length){out.append(titre('Apprendre une recette'));const g=document.createElement('div');g.className='dom-articles';
  aApprendre.forEach(o=>{const prix=o.herbo.apprentissage,refus=client?refusHerbo(client,o,b):'',ok=!!client&&!refus&&orDe(client)>=prix;
   g.append(carteMagasin(o,1,prix,ok,!client?'Il faut être à l’herboristerie pour apprendre.':refus||(ok?'Apprendre la recette : '+o.name+', pour '+prix+' or':'Il manque '+(prix-orDe(client))+' or.'),
    ()=>apprendreRecette(client,o,b),'achat',client&&!refus?boutonCoffre(prix,()=>apprendreRecette(client,o,b,true)):null))});
  out.append(g)}
 if(!client)return;
 out.append(titre('Fabriquer'));
 if(!connues.length){texteFonction(out,client.name+' ne connaît aucune recette.');return}
 const g=document.createElement('div');g.className='dom-articles';
 connues.forEach(o=>{const refus=refusHerbo(client,o,b),manque=manqueHerbo(client,o),ok=!refus&&!manque.length;
  g.append(carteMagasin(o,o.herbo.quantite||1,null,ok,refus||(manque.length?'Il manque : '+manque.map(([n,q,v])=>(q-v)+' '+n).join(', ')+'.':'Fabriquer '+o.name),()=>fabriquerHerbo(client,o,b),'fabrique',puceIngredients(o,manque)))});
 out.append(g)}
function acheterHerbo(a,o,parCoffre){const prix=prixAchat(o);if(!aLHerboristerie(a)||o.herboriste!==true||(parCoffre?coffreVue().or:orDe(a))<prix)return;
 if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;if(parCoffre)versCoffre(a,{or:-prix,achat:o.id});else ajouteOr(a,-prix);ajouterInventaire(a,o);
 log(nomNum(a)+' achète '+o.name+' à l’herboristerie'+(prix?' pour '+prix+' or'+(parCoffre?' du coffre de groupe':''):'')+'.');apresMagasin()}
function apprendreRecette(a,o,b,parCoffre){const prix=o&&o.herbo?o.herbo.apprentissage:0;
 if(!aLHerboristerie(a)||!o||!o.herbo||o.herbo.grimoire||recettesDe(a).includes(o.id)||refusHerbo(a,o,b)||(parCoffre?coffreVue().or:orDe(a))<prix)return;
 if(parCoffre)versCoffre(a,{or:-prix});else ajouteOr(a,-prix);a.recettes=[...recettesDe(a),o.id];
 log(nomNum(a)+' apprend la recette : '+o.name+(prix?', pour '+prix+' or'+(parCoffre?' du coffre de groupe':''):'')+'.');apresMagasin()}
function fabriquerHerbo(a,o,b){if(!o||!o.herbo||!(o.herbo.tannerie?aLaTannerie(a):aLHerboristerie(a))||!recettesDe(a).includes(o.id)||refusHerbo(a,o,b)||manqueHerbo(a,o).length)return;
 if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;
 // Les pièces : le sac d'abord, puis le coffre de groupe, onglet par onglet.
 normaliseIngredients(o.ingredients).forEach(({id,n})=>{const p=objetDe(id);let reste=n;
  while(reste>0&&p&&(a.inventaire||[]).includes(id)){retirerInventaire(a,p);reste--}
  coffreVue().tabs.forEach((t,tab)=>{if(reste<=0)return;const k=Math.min(reste,t.filter(x=>x===id).length);if(k){versCoffre(a,{item:id,tab,n:-k,fab:o.id});reste-=k}})});
 prendRecette(a,o);
 Object.entries(normaliseGemmesRecette(o.gemmes)).forEach(([k,n])=>{a.richesses={...(a.richesses||{})};a.richesses[k]=Math.max(0,(Number(a.richesses[k])||0)-n);if(!a.richesses[k])delete a.richesses[k]});
 // v1.014 : une recette peut en donner plusieurs.
 const q=o.herbo.quantite||1;let n=0;for(let i=0;i<q;i++){if(!ajouterInventaire(a,o))break;n++}
 log(nomNum(a)+' fabrique '+(n>1?n+' × ':'')+o.name+(o.herbo.tannerie?' à la tannerie.':' à l’herboristerie.'));apresMagasin()}
// Sous une carte : les ressources en jeu, icône et quantité ; celles qui manquent, en rouge.
function puceRessources(d,manque=[]){const w=document.createElement('span');w.className='dom-recette';
 Object.entries(d).forEach(([k,n])=>{const p=document.createElement('span');p.className='puce-res'+(manque.some(([m])=>m===k)?' manque':'');
  const nom=(ressourcesJeu().find(r=>r.cle===k)||{}).nom||k,ic=iconeRessource(k);p.title=n+' '+nom;
  if(ic)p.append(ic);const t=document.createElement('span');t.textContent=ic?String(n):n+' '+nom;p.append(t);w.append(p)});return w}
// L'aventurier est-il à une tannerie ouverte, et est-ce à son joueur d'agir ?
function aLaTannerie(a){const ici=a&&batimentDom(lieuDe(a));return !!a&&agitPour(a)&&!!ici&&ici.fonction==='tannerie'&&fonctionActive(ici)}
/* Ce qui va à la réserve ou en sort. Le MJ l'y verse lui-même ; un joueur le dépose sur son
   aventurier, et l'appareil du MJ le versera une fois, en le recevant. */
function versDomaine(a,delta){if(mjDom()){appliqueDelta(domaine.ressources||(domaine.ressources={}),delta);sauveDomaine();return}
 const vus=new Set(domaine.depotsVus||[]);a.depots=[...normaliseDepots(a.depots).filter(e=>!vus.has(e.id)),{id:idDomaine(),t:Date.now(),delta}].slice(-60)}
// La réserve telle qu'on la voit : celle du domaine, plus les dépôts pas encore versés.
function reserveVue(){const r={...(domaine.ressources||{})},vus=new Set(domaine.depotsVus||[]);
 actors.filter(a=>a.hero).forEach(a=>normaliseDepots(a.depots).forEach(e=>{if(!vus.has(e.id))appliqueDelta(r,e.delta)}));return r}
// Chez le MJ : chaque dépôt reçu d'un joueur est versé à la réserve, une seule fois.
function recueilleDepots(redessine=true){if(!mjDom())return false;const vus=new Set(domaine.depotsVus||[]);let n=0;
 actors.filter(a=>a.hero).forEach(a=>normaliseDepots(a.depots).forEach(e=>{if(vus.has(e.id))return;appliqueDelta(domaine.ressources||(domaine.ressources={}),e.delta);vus.add(e.id);n++}));
 if(!n)return false;domaine.depotsVus=[...vus].slice(-500);sauveDomaine();if(redessine&&document.body.classList.contains('page-domaine'))renderDomaine(true);return true}
function acheterTannerie(a,o,parCoffre){const prix=prixAchat(o);if(!aLaTannerie(a)||o.tanneur!==true||(parCoffre?coffreVue().or:orDe(a))<prix)return;
 if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;if(parCoffre)versCoffre(a,{or:-prix,achat:o.id});else ajouteOr(a,-prix);ajouterInventaire(a,o);log(nomNum(a)+' achète '+o.name+' à la tannerie'+(prix?' pour '+prix+' or'+(parCoffre?' du coffre de groupe':''):'')+'.');apresMagasin()}
function fabriquerTannerie(a,o){if(!aLaTannerie(a)||o.tanneur!==true||!o.recette||!o.recette.length||manqueRecette(reserveAvecCoffre(),o).length)return;
 if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;prendRecette(a,o);ajouterInventaire(a,o);log(nomNum(a)+' fait fabriquer '+o.name+' à la tannerie, avec '+texteRessources(Object.fromEntries(o.recette.map(r=>[r.cle,r.qte])))+' de la réserve.');apresMagasin()}
function vendreReste(a,o){if(!aLaTannerie(a)||o.category!=='restes'||!(a.inventaire||[]).includes(o.id))return;const v=prixAchat(o);
 retirerInventaire(a,o);ajouteOr(a,v);log(nomNum(a)+' vend '+o.name+' à la tannerie'+(v?' pour '+v+' or':'')+'.');apresMagasin()}
function convertirReste(a,o){const r=rendementReste(o);if(!aLaTannerie(a)||!Object.keys(r).length||!(a.inventaire||[]).includes(o.id))return;
 retirerInventaire(a,o);versDomaine(a,r);log(nomNum(a)+' fait convertir '+o.name+' à la tannerie : '+texteRessources(r)+' pour la réserve du domaine.');apresMagasin()}
// Au chargement, et chaque fois que l'onglet se redessine chez le MJ, les dépôts en attente sont versés.
document.addEventListener('amertume-partie-chargee',()=>recueilleDepots());
/* ---------- Les finances ---------- */
function renderDomFinances(){const boite=$('dom-finances');boite.replaceChildren();const f=domaine.finances;
 const tresor=document.createElement('div');tresor.className='dom-tresor-ligne';
 const val=document.createElement('strong');val.className='dom-tresor-val'+(f.tresor<0?' dette':'');val.textContent=montantLisible(f.tresor);
 const monnaie=document.createElement('input');monnaie.value=domaine.monnaie;monnaie.maxLength=20;monnaie.className='dom-monnaie';monnaie.title='Le nom de la monnaie';monnaie.setAttribute('aria-label','Monnaie');
 monnaie.onchange=()=>{domaine.monnaie=monnaie.value.trim().slice(0,20)||'or';renderDomaine();sauveDomaine()};
 tresor.append(val);if(mjDom())tresor.append(monnaie);boite.append(tresor);
 const form=document.createElement('form');form.className='dom-mouvement';
 const montant=document.createElement('input');montant.type='number';montant.step='1';montant.placeholder='Montant';montant.required=true;montant.setAttribute('aria-label','Montant');
 const libelle=document.createElement('input');libelle.maxLength=120;libelle.placeholder='Libellé — taxe, butin, salaire…';libelle.setAttribute('aria-label','Libellé');
 const plus=document.createElement('button');plus.type='button';plus.textContent='+ Encaisser';plus.className='dom-plus';
 const moins=document.createElement('button');moins.type='button';moins.textContent='− Dépenser';moins.className='dom-moins';
 const bouge=signe=>{const m=Math.abs(Math.trunc(Number(montant.value)));if(!m)return;
  mouvementFinance(domaine,signe*m,libelle.value.trim()||(signe>0?'Recette':'Dépense'));montant.value='';libelle.value='';renderDomaine();sauveDomaine()};
 plus.onclick=()=>bouge(1);moins.onclick=()=>bouge(-1);form.onsubmit=e=>{e.preventDefault();bouge(1)};
 form.append(montant,libelle,plus,moins);if(mjDom())boite.append(form);
 const liste=document.createElement('ul');liste.className='dom-journal';
 // Les joueurs ne lisent pas les étapes que le MJ a posées ; le MJ les voit, en retrait.
 // Les constructions n'y paraissent pas : le cartouche de chaque bâtiment dit déjà son étape.
 const lignes=(mjDom()?f.journal:f.journal.filter(ligneDesJoueurs)).filter(e=>!/^Construction — /.test(e.libelle));
 [...lignes].reverse().slice(0,25).forEach(e=>{const li=document.createElement('li');
  if(e.par==='mj'){li.className='du-mj';li.title='Posée par le MJ : les joueurs ne voient pas cette ligne'}
  const date=document.createElement('small');date.textContent=e.t?new Date(e.t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const lib=document.createElement('span');lib.textContent=e.libelle;
  const m=document.createElement('b');m.className=e.montant<0?'dette':'gain';m.textContent=(e.montant>0?'+':'')+montantLisible(e.montant);
  li.append(date,lib,m);liste.append(li)});
 if(!lignes.length){const li=document.createElement('li');li.className='muted';li.textContent='Aucun mouvement.';liste.append(li)}
 boite.append(liste)}
/* ---------- Les ressources ---------- */
/* Ce que le domaine a en réserve : ses matériaux, puis ses gemmes — son or est son trésor.
   Le MJ corrige un compte d'un clic ; les joueurs lisent. */
function renderDomRessources(){const boite=$('dom-ressources');if(!boite)return;boite.replaceChildren();
 // Chez un joueur, la réserve compte aussi les dépôts que le MJ n'a pas encore versés.
 const mj=mjDom(),r=mj?(domaine.ressources||(domaine.ressources={})):reserveVue();
 renderRessourcesLues(boite,r);if(mj){const b=document.createElement('button');b.className='dom-ajout';b.textContent='± Ressources';b.onclick=openReserve;boite.append(b)}return;
 const poser=mj?(k,v)=>{poseCompte(r,k,v);renderDomRessources();sauveDomaine()}:null;
 const titre=t=>{const h=document.createElement('h3');h.className='reglage-titre';h.textContent=t;return h};
 const mats=document.createElement('div');mats.className='materiaux';
 // Les ressources du catalogue, sous leur clé fixe : les renommer ne vide pas la réserve.
 ressourcesJeu().filter(x=>x.cle!=='or').forEach(({cle:k,nom:m,piece})=>{const n=r[k]||0;
  const chip=document.createElement('span');chip.className='materiau'+(n?'':' zero');
  const nom=document.createElement('span');nom.textContent=m;const v=document.createElement('b');v.textContent=n.toLocaleString('fr-FR');
  if(poser)champVif(v,()=>r[k]||0,t=>poser(k,t),m+' — réserve du domaine','petit');
  // L'icône choisie pour elle dans l'Armurerie, devant son nom.
  const lg=piece&&logoEquipement(piece,'materiau-logo');if(lg)chip.append(lg);
  chip.append(nom,v);mats.append(chip)});
 boite.append(titre('Matériaux'),mats,titre('Gemmes'),grilleGemmes(r,poser,'réserve du domaine'))}
/* Chez les joueurs, les ressources du domaine se lisent comme les richesses d'un aventurier : l'or du trésor, les matériaux que la
   réserve contient, en carrés, puis ses gemmes ; rien de ce qui manque. */
function renderRessourcesLues(boite,r){const out=document.createElement('div');out.className='richesses dom-richesses';
 const titre=t=>{const x=document.createElement('span');x.className='richesses-titre';x.textContent=t;return x};
 const or=Math.max(0,domaine.finances.tresor||0);if(or)out.append(titre('Or'),ligneOr(or,null));
 const mats=ressourcesJeu().filter(x=>x.cle!=='or'&&(r[x.cle]||0)>0);
 if(mats.length){const l=document.createElement('div');l.className='dom-materiaux-lus';
  mats.forEach(({cle,nom,piece})=>{const n=r[cle]||0;let c;
   if(piece){c=gearCarre(piece,n,false);c.classList.add('petit');c.removeAttribute('role');c.tabIndex=-1;
    if(typeof surveille==='function')surveille(c,()=>{const d=gearDetail(piece,null,true);d.hidden=false;d.classList.add('large');ouvrirBulle(c,d,'bulle-gear')})}
   else{c=document.createElement('span');c.className='materiau';const nm=document.createElement('span');nm.textContent=nom;const v=document.createElement('b');v.textContent=n.toLocaleString('fr-FR');c.append(nm,v)}
   c.setAttribute('aria-label',nom+' : '+n);l.append(c)});
  out.append(titre('Matériaux'),l)}
 const g=ligneGemmes(r,null,'');if(g)out.append(titre('Gemmes'),g);
 if(out.childElementCount)boite.append(out)}
/* Corriger la réserve, au MJ : une ressource ou une gemme, une quantité, ajouter ou retirer. */
const reserveDialog=dialog('dom-reserve-editor','Ressources du domaine','<form id="dom-reserve-form"><div class="edit-grid"><label>Quoi<select name="quoi" id="dom-reserve-quoi"></select></label>'
 +'<label>Quantité<input name="n" type="number" min="-999999" max="999999" step="1" value="1" required></label></div>'
 +'<div class="form-actions"><button type="button" id="dom-reserve-vider">Tout retirer</button><button type="button" id="dom-reserve-retirer">Retirer</button><button class="primary">Ajouter</button></div></form>');
function openReserve(){if(!mjDom())return;const r=domaine.ressources||(domaine.ressources={}),menu=$('dom-reserve-quoi'),avant=menu.value;menu.replaceChildren();
 const opt=(k,t)=>new Option(t+((r[k]||0)?' — '+(r[k]).toLocaleString('fr-FR'):''),k);
 const mats=document.createElement('optgroup');mats.label='Matériaux';ressourcesJeu().filter(x=>x.cle!=='or').forEach(({cle,nom})=>mats.append(opt(cle,nom)));menu.append(mats);
 TAILLES_GEMMES.forEach(([ta,nt])=>{const g=document.createElement('optgroup');g.label=nt;VARIETES_GEMMES.forEach(([v])=>g.append(opt(cleGemme(ta,v,false),nomGemme(ta,v,false))));menu.append(g)});
 if(avant&&[...menu.options].some(o=>o.value===avant))menu.value=avant;$('dom-reserve-form').elements.n.value='1';reserveDialog.showModal()}
function bougeReserve(signe){const f=$('dom-reserve-form').elements,k=f.quoi.value,q=lisQuantite(f.n.value);if(!k)return;
 // « Tout retirer » (signe 0) vide la ligne ; une quantité négative retire, quel que soit le bouton.
 const r=domaine.ressources||(domaine.ressources={}),n=signe===0?-(r[k]||0):q<0?q:signe*q;if(!n)return;poseCompte(r,k,(r[k]||0)+n);reserveDialog.close();renderDomaine(true);sauveDomaine()}
$('dom-reserve-form').onsubmit=e=>{e.preventDefault();bougeReserve(1)};$('dom-reserve-retirer').onclick=()=>bougeReserve(-1);$('dom-reserve-vider').onclick=()=>bougeReserve(0);
/* ---------- Les quêtes ---------- */
/* Une quête se prend par les aventuriers du joueur — tous ceux qu'il mène — et se lit « En cours » dès qu'un aventurier la porte.
   Le MJ dit son issue : Réussie ou Échouée. Le journal les range : en cours, proposées, terminées. */
const NOMS_ETAT_QUETE={proposee:'Proposée',encours:'En cours',reussie:'Réussie',echouee:'Échouée',cachee:'Cachée'};
const preneursQuete=q=>actors.filter(a=>a&&a.hero&&Array.isArray(a.quetesPrises)&&a.quetesPrises.includes(q.id));
// Une quête cachée qu'un aventurier a débloquée — un objet ouvert, un PNJ rejoint — se lit comme une quête proposée.
const debloquee=q=>actors.some(a=>a&&a.hero&&Array.isArray(a.quetesDebloquees)&&a.quetesDebloquees.includes(q.id));
const ouverte=q=>q.statut==='proposee'||(q.statut==='cachee'&&debloquee(q));
function etatQuete(q){return ouverte(q)?(preneursQuete(q).length?'encours':'proposee'):q.statut}
const quetesVues=()=>(domaine.quetes||[]).filter(q=>mjDom()||q.statut!=='cachee'||debloquee(q));
function debloqueQuete(a,id){const q=(domaine.quetes||[]).find(x=>x.id===id);if(!a||!a.hero||!q||q.statut!=='cachee'||debloquee(q))return;
 a.quetesDebloquees=[...(Array.isArray(a.quetesDebloquees)?a.quetesDebloquees:[]),q.id].slice(-100);
 log(nomNum(a)+' découvre une quête : '+q.titre+'.',{ton:'talent'});if(typeof scheduleSave==='function')scheduleSave()}
// Au contact d'un PNJ de la carte qui porte une quête, l'aventurier la débloque.
function quetesAuContact(a){if(!a||!a.hero||typeof currentMap!=='function')return;const m=currentMap(),size=mapSize();if(!m||!size.width)return;
 actors.forEach(o=>{if(!o||o===a||!o.pose||!alive(o))return;const f=(m.foes||[]).find(x=>x&&x.id===o.pose);if(!f||!f.quete)return;
  if(inContact(a,o,size,tokenOf(a),tokenOf(o))||inContact(o,a,size,tokenOf(o),tokenOf(a)))debloqueQuete(a,f.quete)})}
// La récompense en mots : « 30 or », « 2d6 or », « 1 éclat de rubis ».
function ditBourse(l){const nom=(phraseRichesses({[l.k]:2})[0]||'').replace(/^2 /,'');return l.f===1?(phraseRichesses({[l.k]:l.n})[0]||''):l.n+'d'+l.f+' '+nom}
/* Réussie, la quête donne sa récompense, une fois : l'or et les gemmes tirés aux dés, puis partagés entre ceux qui l'ont prise —
   toute la troupe, si personne ne l'a prise ; les pièces, une à chacun tour à tour. */
function donneRecompense(q){if(q.donnee)return;q.donnee=true;const tire=tireBourse(q.gains.bourse),items=(q.gains.items||[]).map(objetDe).filter(Boolean);
 let qui=preneursQuete(q).filter(a=>!a.horsCarte);if(!qui.length)qui=actors.filter(a=>a&&a.hero&&!a.horsCarte);if(!qui.length)return;
 const gains=new Map(qui.map(a=>[a,{or:0,rich:{},objets:[]}]));let k=0;
 Object.entries(tire).forEach(([cle,v])=>{if(cle==='or'){const part=Math.floor(v/qui.length);let reste=v-part*qui.length;qui.forEach(a=>{const n=part+(reste>0?1:0);if(reste>0)reste--;if(n){ajouteOr(a,n);gains.get(a).or+=n}})}
  else for(let i=0;i<v;i++){const a=qui[k++%qui.length];a.richesses={...(a.richesses||{})};a.richesses[cle]=(Math.trunc(Number(a.richesses[cle]))||0)+1;gains.get(a).rich[cle]=(gains.get(a).rich[cle]||0)+1}});
 items.forEach(o=>{const a=qui[k++%qui.length];if(ajouterInventaire(a,o))gains.get(a).objets.push(o.id)});
 gains.forEach((g,a)=>{const dits=[...g.objets.map(id=>'⟦'+id+'⟧'),...phraseRichesses({or:g.or,...g.rich})];if(dits.length)log(a.name+' reçoit '+dits.join(', ')+' ('+q.titre+').',{ton:'butin'})});
 if(typeof renderHeroes==='function')renderHeroes();render();scheduleSave()}
const finieQuete=q=>q.statut==='reussie'||q.statut==='echouee';
function nomLieuQuete(q){if(q.ou==='region'){const m=(typeof maps!=='undefined'?maps:[]).find(x=>x&&x.id===q.carte);return m?m.name:'Région'}const b=q.lieu?batimentDom(q.lieu):null;return b?b.nom:domaine.nom}
function prendreQuete(q,prendre){const qui=actors.filter(a=>a&&a.hero&&agitPour(a));if(!qui.length)return;
 qui.forEach(a=>{const l=(Array.isArray(a.quetesPrises)?a.quetesPrises:[]).filter(x=>x!==q.id);a.quetesPrises=prendre?[...l,q.id].slice(-100):l});
 renderDomaine(true);render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
function issueQuete(q,statut){q.statut=statut;if(statut==='reussie')donneRecompense(q);renderDomaine(true);sauveDomaine()}
function carteQuete(q,avecLieu){const e=etatQuete(q),c=document.createElement('article');c.className='dom-quete q-'+e;
 const tete=document.createElement('div');tete.className='dom-quete-tete';
 const t=document.createElement('strong');t.textContent=q.titre;const badge=document.createElement('span');badge.className='dom-quete-etat';badge.textContent=NOMS_ETAT_QUETE[e];
 tete.append(t,badge);c.append(tete);
 if(avecLieu){const l=document.createElement('small');l.className='dom-quete-lieu';l.textContent=nomLieuQuete(q);c.append(l)}
 if(q.texte){const p=document.createElement('p');p.className='dom-quete-texte';p.textContent=q.texte;c.append(p)}
 // La récompense : l'or et les gemmes en mots, les pièces en petits carrés.
 {const mots=[...q.gains.bourse.map(ditBourse),...(q.recompense?[q.recompense]:[])].filter(Boolean),items=new Map();q.gains.items.map(objetDe).filter(Boolean).forEach(o=>items.set(o,(items.get(o)||0)+1));
  if(mots.length||items.size){const p=document.createElement('div');p.className='dom-quete-recompense';const b=document.createElement('b');b.textContent='Récompense : ';p.append(b);
   if(mots.length)p.append(mots.join(', '));items.forEach((n,o)=>{const x=carreInventaire(o,n);x.removeAttribute('role');x.tabIndex=-1;p.append(x)});c.append(p)}}
 const pris=preneursQuete(q);if(pris.length){const p=document.createElement('small');p.className='dom-quete-qui';p.textContent='Prise par '+pris.map(a=>a.name).join(', ');c.append(p)}
 const actions=document.createElement('div');actions.className='dom-quete-actions';
 const bouton=(txt,fn,cls)=>{const x=document.createElement('button');x.type='button';x.textContent=txt;if(cls)x.className=cls;x.onclick=fn;actions.append(x)};
 const miens=actors.filter(a=>a&&a.hero&&agitPour(a)),tousPris=miens.length&&miens.every(a=>pris.includes(a)),unPris=miens.some(a=>pris.includes(a));
 if(!finieQuete(q)&&ouverte(q)&&miens.length){if(!tousPris)bouton('Accepter',()=>prendreQuete(q,true),'primary');if(unPris)bouton('Abandonner',()=>prendreQuete(q,false))}
 if(mjDom()){if(!finieQuete(q)){bouton('✓ Réussie',()=>issueQuete(q,'reussie'));bouton('✗ Échouée',()=>issueQuete(q,'echouee'))}bouton('✎',()=>openQuete(q.id),'dom-quete-edit')}
 if(actions.childElementCount)c.append(actions);return c}
// Les quêtes de tout le domaine, dans la colonne : en cours et proposées ; les terminées vont au journal.
function renderDomQuetes(){const boite=$('dom-quetes');if(!boite)return;boite.replaceChildren();
 // Celles de tout le domaine, puis celles des régions, qui disent leur carte.
 quetesVues().filter(q=>q.ou!=='region'&&!q.lieu&&(mjDom()||!finieQuete(q))).forEach(q=>boite.append(carteQuete(q,false)));
 quetesVues().filter(q=>q.ou==='region'&&(mjDom()||!finieQuete(q))).forEach(q=>boite.append(carteQuete(q,true)));
 if(mjDom()){const add=document.createElement('button');add.textContent='+ Quête';add.className='dom-ajout';add.onclick=()=>openQuete(null,'');boite.append(add)}}
// Les quêtes d'un bâtiment, au bas de sa fiche.
function blocQuetes(b){const lot=quetesVues().filter(q=>q.ou!=='region'&&q.lieu===b.id&&(mjDom()||!finieQuete(q)));if(!lot.length&&!mjDom())return null;
 const out=document.createElement('section');out.className='dom-quetes-bat';out.append(titreFonction('Quêtes'));lot.forEach(q=>out.append(carteQuete(q,false)));
 if(mjDom()){const add=document.createElement('button');add.textContent='+ Quête ici';add.className='dom-ajout';add.onclick=()=>openQuete(null,b.id);out.append(add)}
 return out}
const queteDialog=dialog('dom-quete-editor','Quête','<form id="dom-quete-form"><div id="dom-quete-fields"></div><div class="form-actions"><button type="button" id="dom-quete-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openQuete(id,lieu){if(!mjDom())return;const q=id?(domaine.quetes||[]).find(x=>x.id===id):null;
 queteDialog.querySelector('h2').textContent=q?q.titre:'Nouvelle quête';
 const lieux=[['','Tout le domaine'],...domaine.batiments.map(b=>[b.id,b.nom])],cartes=(typeof maps!=='undefined'?maps:[]).filter(m=>m&&m.id&&m.paysage!==true).map(m=>[m.id,m.name||'Carte']);
 $('dom-quete-fields').innerHTML='<div class="edit-grid">'+field('Titre','titre',q?q.titre:'','text','required maxlength="80"')
  +sel('Où','ou',q?q.ou:'domaine',[['domaine','Domaine'],['region','Région']])
  +'<span data-ou="domaine">'+sel('Lieu du domaine','lieu',q?q.lieu:(lieu||''),lieux)+'</span>'
  +'<span data-ou="region">'+sel('Carte','carte',q?q.carte:'',cartes.length?cartes:[['','— aucune carte —']])+'</span>'
  +sel('Statut','statut',q?q.statut:'proposee',STATUTS_QUETE)+'</div>'
  +'<label>Description<textarea name="texte" rows="5" maxlength="3000">'+esc(q?q.texte:'')+'</textarea></label>'
  +(q&&q.recompense?field('Récompense écrite','recompense',q.recompense,'text','maxlength="300"'):'')
  +'<h2 class="sous-titre">Récompense</h2><div class="coffre-tresor" id="dom-quete-bourse"></div><div id="dom-quete-contenu"></div>';
 const fo=$('dom-quete-form').elements,montreOu=()=>$('dom-quete-fields').querySelectorAll('[data-ou]').forEach(x=>{x.hidden=x.dataset.ou!==fo.ou.value});fo.ou.onchange=montreOu;montreOu();
 // Comme un coffre : l'or et les gemmes aux dés, les pièces de l'armurerie d'un clic.
 const bourse={bourse:[...(q?q.gains.bourse:[])]},contenu={inventaire:[...(q?q.gains.items:[])]};
 $('dom-quete-bourse').append(editeurBourse(bourse,null,false));contenuCoffre($('dom-quete-contenu'),contenu);
 $('dom-quete-suppr').hidden=!q;
 $('dom-quete-form').onsubmit=e=>{e.preventDefault();const f=$('dom-quete-form').elements;
  const v=normaliseQuete({id:q?q.id:undefined,titre:f.titre.value.trim()||'Quête',ou:f.ou.value,lieu:batimentDom(f.lieu.value)?f.lieu.value:'',carte:f.carte.value,statut:f.statut.value,texte:f.texte.value,
   recompense:f.recompense?f.recompense.value.trim():'',gains:{bourse:bourse.bourse,items:contenu.inventaire},t:q?q.t:Date.now(),donnee:q?q.donnee:false});
  domaine.quetes??=[];if(q)Object.assign(q,v);else domaine.quetes.push(v);queteDialog.close();renderDomaine();sauveDomaine()};
 $('dom-quete-suppr').onclick=()=>{if(!q||!confirm('Supprimer la quête « '+q.titre+' » ?'))return;
  domaine.quetes=domaine.quetes.filter(x=>x!==q);queteDialog.close();renderDomaine();sauveDomaine()};
 queteDialog.showModal()}
// Le journal de quêtes : en cours, proposées, terminées ; chacune dit son lieu.
const journalQuetes=dialog('dom-journal-quetes-vue','Journal de quêtes','<div id="dom-journal-quetes-corps"></div>');
function renderJournalQuetes(){const corps=$('dom-journal-quetes-corps');corps.replaceChildren();const l=quetesVues();
 [['En cours',q=>etatQuete(q)==='encours'],['Proposées',q=>etatQuete(q)==='proposee'],...(mjDom()?[['Cachées',q=>etatQuete(q)==='cachee']]:[]),['Terminées',finieQuete]].forEach(([t,f])=>{
  const lot=l.filter(f);if(!lot.length)return;const h=document.createElement('h3');h.className='reglage-titre';h.textContent=t;corps.append(h);
  lot.forEach(q=>corps.append(carteQuete(q,true)))});
 if(!corps.childElementCount){const p=document.createElement('p');p.className='muted';p.textContent='Aucune quête.';corps.append(p)}}
$('dom-journal-quetes').onclick=()=>{renderJournalQuetes();journalQuetes.showModal()};
/* ---------- Les habitants et les visiteurs ---------- */
const pnjDialog=dialog('dom-pnj-editor','Personnage','<form id="dom-pnj-form"><div id="dom-pnj-fields"></div><div class="form-actions"><button type="button" id="dom-pnj-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openPnj(id){const p=id?domaine.pnj.find(x=>x.id===id):null;
 pnjDialog.querySelector('h2').textContent=p?p.nom:'Nouveau personnage';
 const bats=[['','— aucun bâtiment —'],...domaine.batiments.map(b=>[b.id,b.nom])];
 $('dom-pnj-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',p?p.nom:'','text','required maxlength="60"')
  +field('Rôle','role',p?p.role:'','text','maxlength="80" placeholder="Forgeron, marchande, espion…"')
  +sel('Statut','statut',p?p.statut:'habitant',STATUTS_PNJ)+sel('Bâtiment','batiment',p?p.batiment:'',bats)+'</div>'
  +'<label>Notes<textarea name="notes" rows="3" maxlength="2000">'+esc(p?p.notes:'')+'</textarea></label>';
 $('dom-pnj-suppr').hidden=!p;
 $('dom-pnj-form').onsubmit=e=>{e.preventDefault();const f=$('dom-pnj-form').elements;
  const v={nom:f.nom.value.trim().slice(0,60)||'Inconnu',role:f.role.value.trim().slice(0,80),statut:f.statut.value==='visiteur'?'visiteur':'habitant',
   batiment:batimentDom(f.batiment.value)?f.batiment.value:'',notes:f.notes.value.slice(0,2000)};
  if(p)Object.assign(p,v);else domaine.pnj.push({id:idDomaine(),...v});
  pnjDialog.close();renderDomaine();sauveDomaine()};
 $('dom-pnj-suppr').onclick=()=>{if(!p||!confirm('Retirer « '+p.nom+' » du domaine ?'))return;
  domaine.pnj=domaine.pnj.filter(x=>x!==p);pnjDialog.close();renderDomaine();sauveDomaine()};
 pnjDialog.showModal()}
function renderDomPnj(){const boite=$('dom-pnj');boite.replaceChildren();
 STATUTS_PNJ.forEach(([k,nom])=>{const lot=domaine.pnj.filter(p=>p.statut===k);
  const h=document.createElement('h3');h.className='reglage-titre';h.textContent=nom+'s · '+lot.length;boite.append(h);
  if(!lot.length){const p=document.createElement('p');p.className='muted';p.textContent=k==='habitant'?'Personne ne vit encore ici.':'Personne de passage.';boite.append(p)}
  lot.forEach(p=>{const row=document.createElement(mjDom()?'button':'div');row.className='dom-pnj';
   const nom=document.createElement('strong');nom.textContent=p.nom;
   const det=document.createElement('small');const b=batimentDom(p.batiment);
   det.textContent=[p.role,b?b.nom:''].filter(Boolean).join(' · ');
   row.append(nom,det);if(mjDom())row.onclick=()=>openPnj(p.id);boite.append(row)})});
 const add=document.createElement('button');add.textContent='+ Personnage';add.className='dom-ajout';add.onclick=()=>openPnj(null);if(mjDom())boite.append(add)}
/* ---------- Les aventuriers ---------- */
// La troupe, telle qu'elle est sur la table : où chacun se trouve au domaine, et une note.
/* v1.016 — La troupe en petits jetons, rangés par lieu : Au domaine, chaque bâtiment occupé, Sur la route, En aventure,
   Absent. Le survol dit le nom et le lieu ; on glisse un jeton sur un intitulé, ou sur un bâtiment de la carte, pour l'y
   envoyer. Un joueur déplace son aventurier d'un bâtiment à l'autre ; route, aventure, absence et domaine sont au MJ. */
function renderDomAventuriers(){const boite=$('dom-aventuriers');boite.replaceChildren();boite.classList.remove('en-grille');boite.classList.add('en-jetons');
 const troupe=actors.filter(a=>a.hero);
 if(!troupe.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun aventurier dans la partie.';boite.append(p);return}
 const lieuVu=a=>{const ou=lieuDe(a);return ou&&(ou==='aventure'||ou==='absent'||ou==='route'||batimentConstruit(batimentDom(ou)))?ou:''};
 const groupes=[['',nomLieu('')],...domaine.batiments.filter(b=>batimentConstruit(b)&&troupe.some(a=>lieuVu(a)===b.id)).map(b=>[b.id,b.nom]),['route',nomLieu('route')],['aventure',nomLieu('aventure')],['absent',nomLieu('absent')]];
 groupes.forEach(([k,n])=>{const g=document.createElement('div');g.className='dom-av-groupe';g.dataset.lieu=k;
  const t=document.createElement('h4');t.className='dom-av-groupe-nom';t.textContent=n;const l=document.createElement('div');l.className='dom-av-jetons';
  troupe.filter(a=>lieuVu(a)===k).forEach(a=>{const j=jetonRond(a.image,a.name,'mini');j.classList.add('dom-av-jeton');j.setAttribute('aria-label',a.name+' — '+nomLieu(lieuVu(a)));
   if(typeof surveille==='function')surveille(j,()=>{const d=document.createElement('div');d.className='gear-detail large';const p=document.createElement('p');p.className='gear-nom';p.textContent=a.name;
    const q=document.createElement('p');q.className='muted';q.textContent=nomLieu(lieuVu(a));d.append(p,q);ouvrirBulle(j,d,'bulle-gear')});
   if(agitPour(a)){j.classList.add('glissable');j.onpointerdown=ev=>glisseJetonListe(ev,a,j)}l.append(j)});
  g.append(t,l);boite.append(g)})}
function glisseJetonListe(ev,a,t){if(ev.button!==0||!agitPour(a))return;ev.stopPropagation();ev.preventDefault();if(typeof fermerBulle==='function')fermerBulle();
 const plan=$('dom-plan'),id=ev.pointerId,depart={x:ev.clientX,y:ev.clientY};let fantome=null;
 // Sous le pointeur, ce qui n'est pas le jeton qu'on porte.
 const cible=m=>{const el=document.elementsFromPoint(m.clientX,m.clientY).find(e=>!(fantome&&fantome.contains(e))&&!e.closest('.bulle')),g=el&&el.closest('.dom-av-groupe');
  if(g){const k=g.dataset.lieu||'';return k===''||k==='route'||k==='aventure'||k==='absent'?(mjDom()?{lieu:k,g}:null):{b:batimentDom(k),g}}
  if(!el||!plan.contains(el))return null;const r=plan.getBoundingClientRect(),i=batimentSous(domaine,[100*(m.clientX-r.left)/r.width,100*(m.clientY-r.top)/r.height]),b=i>=0?domaine.batiments[i]:null;
  return batimentConstruit(b)?{b}:null};
 const allume=c=>{plan.querySelectorAll('.dom-zone.vise').forEach(z=>z.classList.remove('vise'));document.querySelectorAll('.dom-av-groupe.vise').forEach(z=>z.classList.remove('vise'));
  if(c&&c.g)c.g.classList.add('vise');else if(c&&c.b){const z=plan.querySelector('.dom-zone[data-bat="'+domaine.batiments.indexOf(c.b)+'"]');if(z)z.classList.add('vise')}};
 const suit=m=>{if(m.pointerId!==id)return;
  if(!fantome){if(Math.hypot(m.clientX-depart.x,m.clientY-depart.y)<4)return;fantome=jetonRond(a.image,a.name,'fantome-pose');document.body.append(fantome);t.classList.add('tire')}
  fantome.style.left=m.clientX+'px';fantome.style.top=m.clientY+'px';const c=cible(m);fantome.classList.toggle('hors',!c);allume(c)};
 const lache=m=>{if(m&&m.pointerId!==id)return;window.removeEventListener('pointermove',suit);window.removeEventListener('pointerup',lache);window.removeEventListener('pointercancel',lache);
  try{t.releasePointerCapture(id)}catch(_){}
  if(!fantome)return;fantome.remove();t.classList.remove('tire');const c=m&&m.type==='pointerup'?cible(m):null;allume(null);if(!c)return;
  if(c.b){if(lieuDe(a)!==c.b.id)deplaceAventurier(a,c.b);return}
  if(lieuDe(a)===c.lieu)return;poseLieu(a,c.lieu);renderDomaine(true);render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))};
 try{t.setPointerCapture(id)}catch(_){}
 window.addEventListener('pointermove',suit);window.addEventListener('pointerup',lache);window.addEventListener('pointercancel',lache)}
/* v1.016 — La fiche d'un bâtiment, et ce qu'il fait — magasin, tannerie, herboristerie —, s'ouvre en fenêtre : la carte
   garde toute sa place. La fermer désélectionne le bâtiment. */
const ficheDomDialog=dialog('dom-fiche-fenetre','','');ficheDomDialog.append($('dom-fiche'));
ficheDomDialog.addEventListener('close',()=>{if(domPageSel!==null){domPageSel=null;renderDomaine()}});
{const rf=renderDomFiche;renderDomFiche=function(...x){const r=rf(...x),ok=!!batimentDom(domPageSel)&&document.body.classList.contains('page-domaine');
 if(ok&&!ficheDomDialog.open)ficheDomDialog.showModal();else if(!ok&&ficheDomDialog.open)ficheDomDialog.close();return r}}
/* ---------- v1.009 — Le Coffre de Groupe ----------
   Un coffre de carte coché « Coffre de groupe » ouvre, au contact, la fenêtre commune : à gauche le coffre, ses onglets et son or ;
   à droite l'inventaire et la bourse de l'aventurier. Un clic range ou reprend une pièce, Maj + clic tous ses exemplaires ; l'or se
   dépose et se retire au montant voulu. Le coffre est au domaine (combat.js : normaliseCoffreGroupe) ; un joueur y agit par une
   opération posée sur son aventurier, que l'appareil du MJ verse — comme les dépôts à la réserve. */
function coffreVue(){const c=normaliseCoffreGroupe(structuredClone(domaine.coffre||{})),vus=new Set(domaine.coffreVus||[]),ops=[];
 actors.filter(a=>a&&a.hero).forEach(a=>normaliseOpsCoffre(a.coffreOps).forEach(op=>{if(!vus.has(op.id))ops.push(op)}));
 ops.sort((x,y)=>x.t-y.t).forEach(op=>appliqueOpCoffre(c,op));return c}
function versCoffre(a,op){const e={...op,id:idDomaine(),t:Date.now()};
 if(mjDom()){const c=normaliseCoffreGroupe(domaine.coffre);resoudreOpCoffre(c,normaliseOpsCoffre([e])[0],a);domaine.coffre=c;sauveDomaine();return}
 const vus=new Set(domaine.coffreVus||[]);a.coffreOps=[...normaliseOpsCoffre(a.coffreOps).filter(x=>!vus.has(x.id)),e].slice(-300)}
/* v1.010 — Chez le MJ, chaque opération passe par l'arbitre (combat.js : jugeOpCoffre) ; ce que le coffre n'a pas pu faire se
   rattrape sur l'aventurier, et le journal le dit. Deux joueurs ont pris la même dernière pièce ou le même or : le second les
   rend. Un dépôt dans un onglet devenu plein revient dans son sac. Un onglet acheté deux fois : le second achat est remboursé.
   Un achat que l'or du coffre ne couvrait plus : la bourse de l'acheteur paie le reste, sinon la pièce lui est reprise. */
function resoudreOpCoffre(c,op,h){if(!op)return;const r=jugeOpCoffre(c,op),nom=h?nomNum(h):'';
 if(!h||!Object.keys(r).length)return;
 const o=op.item?objetDe(op.item):null,quoi=k=>o?(k>1?k+' × ':'')+o.name:'';
 if(r.ongletRefuse){if(!(op.or<0)&&op.prix>0){ajouteOr(h,op.prix);log(nom+' : l’onglet était déjà acheté, '+op.prix+' or rendus.')}return}
 if(r.orManque){
  if(op.achat){const piece=objetDe(op.achat);
   if(orDe(h)>=r.orManque){ajouteOr(h,-r.orManque);log(nom+' : le coffre de groupe n’avait plus assez d’or, '+r.orManque+' or pris dans sa bourse.')}
   else{c.or=Math.min(99999999,c.or+(-op.or-r.orManque));if(piece&&(h.inventaire||[]).includes(piece.id))retirerInventaire(h,piece);log(nom+' : le coffre de groupe n’avait plus assez d’or, '+(piece?piece.name:'l’achat')+' est rendu.')}}
  else{const rendu=Math.min(orDe(h),r.orManque);ajouteOr(h,-rendu);log(nom+' rend '+rendu+' or : le coffre de groupe ne les avait plus.')}}
 if(r.depotRefuse&&o){for(let i=0;i<r.depotRefuse;i++){if(op.forge&&!(h.forges||[]).some(f=>f.id===op.forge.id))h.forges=[...(h.forges||[]),op.forge];ajouterInventaire(h,o)}
  log(quoi(r.depotRefuse)+' revient à '+nom+' : l’onglet du coffre de groupe était plein.')}
 if(r.itemManque){
  if(op.fab){const piece=objetDe(op.fab);if(piece&&(h.inventaire||[]).includes(piece.id))retirerInventaire(h,piece);log(nom+' : il manquait des ressources au coffre de groupe, '+(piece?piece.name:'la fabrication')+' est rendu.')}
  else if(o){let k=0;for(let i=0;i<r.itemManque;i++){if(!(h.inventaire||[]).includes(o.id))break;retirerInventaire(h,o);k++}
   if(k)log(nom+' rend '+quoi(k)+' : le coffre de groupe ne l’avait plus.')}}}
// Chez le MJ : les opérations des joueurs sur le coffre se versent avec les dépôts, une seule fois, dans l'ordre où elles ont eu lieu.
{const r0=recueilleDepots;recueilleDepots=function(redessine=true){const fait=r0(redessine);if(!mjDom())return fait;
 const vus=new Set(domaine.coffreVus||[]),ops=[];actors.filter(h=>h&&h.hero).forEach(h=>normaliseOpsCoffre(h.coffreOps).forEach(op=>{if(!vus.has(op.id))ops.push(op)}));
 if(!ops.length)return fait;const c=normaliseCoffreGroupe(domaine.coffre),auteur=new Map();actors.filter(h=>h&&h.hero).forEach(h=>normaliseOpsCoffre(h.coffreOps).forEach(op=>auteur.set(op.id,h)));
 ops.sort((x,y)=>x.t-y.t).forEach(op=>{resoudreOpCoffre(c,op,auteur.get(op.id));vus.add(op.id)});if(typeof syncForges==='function')syncForges();
 domaine.coffre=c;domaine.coffreVus=[...vus].slice(-800);sauveDomaine();if(coffreGroupeDialog.open)dessineCoffreGroupe();return true}}
// Les pièces forgées du coffre gardent leur fiche : l'armurerie les connaît, comme celles des inventaires.
{const sf=syncForges;syncForges=function(){sf();if(typeof catalog==='undefined'||!catalog||!Array.isArray(catalog.items))return;
 const items=catalog.items,base=items.filter(o=>o&&!o.forge),vus=new Set(items.filter(o=>o&&o.forge).map(o=>o.id)),guide=normaliseGuidePrix(catalog.guidePrix);
 coffreVue().forges.forEach(f=>{if(vus.has(f.id))return;vus.add(f.id);const o=objetForge(f,base,catalog.affixes||[],guide);if(o)items.push(o)})}}
// La réserve et les ressources rangées au coffre, ensemble : ce dont une recette peut disposer.
function reserveAvecCoffre(){const r=reserveVue();coffreVue().tabs.forEach(t=>t.forEach(id=>{const o=objetDe(id);if(o&&o.category==='ressource'&&o.cle)r[o.cle]=(Number(r[o.cle])||0)+1}));return r}
// Une recette se prend d'abord dans la réserve du domaine, puis au coffre.
function prendRecette(a,o){const res=reserveVue(),delta={};
 normaliseRecette(o.recette).forEach(({cle,qte})=>{const pris=Math.min(qte,Number(res[cle])||0);if(pris)delta[cle]=-pris;let reste=qte-pris;
  const c=coffreVue();c.tabs.forEach((t,tab)=>{if(reste<=0)return;const ids=[...new Set(t)].filter(id=>{const x=objetDe(id);return x&&x.category==='ressource'&&x.cle===cle});
   ids.forEach(id=>{if(reste<=0)return;const n=Math.min(reste,t.filter(y=>y===id).length);if(n){versCoffre(a,{item:id,tab,n:-n,fab:o.id});reste-=n}})})});
 if(Object.keys(delta).length)versDomaine(a,delta)}
// Sous une carte de magasin : payer avec l'or du coffre, quand il suffit.
function boutonCoffre(prix,faire){const b=document.createElement('button');b.type='button';b.className='dom-coffre-payer';b.textContent='Payer avec le coffre';
 const ok=coffreVue().or>=prix;b.disabled=!ok;b.title=ok?'':'Il manque '+(prix-coffreVue().or)+' or dans le coffre de groupe.';b.onclick=e=>{e.preventDefault();e.stopPropagation();if(ok)faire()};return b}
const coffreGroupeDialog=dialog('coffre-groupe','Coffre de Groupe','<div class="cg-cadre"><section class="cg-coffre"><div class="cg-onglets" id="cg-onglets"></div><div class="cg-or" id="cg-or-coffre"></div><div class="dom-articles cg-grille" id="cg-coffre"></div></section>'
 +'<section class="cg-sac"><h3 class="cg-qui" id="cg-qui"></h3><div class="cg-or" id="cg-or-sac"></div><div class="dom-articles cg-grille" id="cg-sac"></div></section></div>');
let coffreGroupeDe=null,coffreGroupeOnglet=0,coffreGroupeAchat=false,coffreGroupeMinuterie=null;
function ouvrirCoffreGroupe(a,c){if(!a||!agitPour(a))return;coffreGroupeDe=a.id;coffreGroupeOnglet=0;coffreGroupeAchat=false;
 coffreGroupeDialog.querySelector('h2').textContent=c&&c.nom||'Coffre de Groupe';syncForges();dessineCoffreGroupe();if(!coffreGroupeDialog.open)coffreGroupeDialog.showModal();
 clearInterval(coffreGroupeMinuterie);coffreGroupeMinuterie=setInterval(()=>{if(!coffreGroupeDialog.open){clearInterval(coffreGroupeMinuterie);return}dessineCoffreGroupe()},1500)}
function apresCoffre(){syncForges();dessineCoffreGroupe();render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
function deposerAuCoffre(a,o,tous){const c=coffreVue(),tab=coffreGroupeOnglet,t=c.tabs[tab]||[];if(!agitPour(a)||!(a.inventaire||[]).includes(o.id))return;
 if(!t.includes(o.id)&&placesOnglet(t)>=COFFRE_PLACES){log('Cet onglet du coffre est plein.',{local:true});return}
 const n=tous?(a.inventaire||[]).filter(x=>x===o.id).length:1,forge=o.forge?(a.forges||[]).find(f=>f.id===o.id):null;
 for(let i=0;i<n;i++)retirerInventaire(a,o);if(forge&&typeof oublieForge==='function')oublieForge(a,o.id);
 versCoffre(a,{item:o.id,tab,n,...(forge?{forge}:{})});apresCoffre()}
function prendreAuCoffre(a,id,tous){const c=coffreVue(),tab=coffreGroupeOnglet,t=c.tabs[tab]||[],o=objetDe(id);if(!agitPour(a)||!o||!t.includes(id))return;
 const voulu=tous?t.filter(x=>x===id).length:1,forge=c.forges.find(f=>f.id===id);if(forge&&!(a.forges||[]).some(f=>f.id===id))a.forges=[...(a.forges||[]),forge];
 let n=0;for(let i=0;i<voulu;i++){if(!ajouterInventaire(a,o))break;n++}
 if(!n){log('L’inventaire de '+a.name+' ne prend plus '+o.name+'.',{local:true});return}versCoffre(a,{item:id,tab,n:-n});apresCoffre()}
function orAuCoffre(a,n,sens){n=Math.max(0,Math.trunc(Number(n))||0);if(!n||!agitPour(a))return;
 if(sens>0){n=Math.min(n,orDe(a));if(!n)return;ajouteOr(a,-n);versCoffre(a,{or:n})}else{n=Math.min(n,coffreVue().or);if(!n)return;ajouteOr(a,n);versCoffre(a,{or:-n})}apresCoffre()}
function acheterOnglet(a,parCoffre){const c=coffreVue();if(!agitPour(a)||c.onglets>=COFFRE_ONGLETS_MAX)return;const prix=PRIX_ONGLETS[c.onglets];
 if(parCoffre){if(c.or<prix)return;versCoffre(a,{onglet:1,pour:c.onglets,prix,or:-prix})}else{if(orDe(a)<prix)return;ajouteOr(a,-prix);versCoffre(a,{onglet:1,pour:c.onglets,prix})}
 log(nomNum(a)+' ouvre l’onglet '+(c.onglets+1)+' du coffre de groupe pour '+prix+' or'+(parCoffre?' du coffre':'')+'.');coffreGroupeAchat=false;coffreGroupeOnglet=c.onglets;apresCoffre()}
// Une ligne d'or : le montant, un champ, et le bouton qui le fait passer de l'autre côté.
function ligneOrCoffre(n,txt,max,faire){const l=document.createElement('div');l.className='cg-ligne-or';l.append(ligneOr(n,null));
 const i=document.createElement('input');i.type='number';i.min='1';i.max=String(Math.max(1,max));i.value=String(Math.min(Math.max(1,max),10));i.disabled=max<1;
 const b=document.createElement('button');b.type='button';b.textContent=txt;b.disabled=max<1;b.onclick=()=>faire(i.value);l.append(i,b);return l}
function carreCoffre(o,n,titre,faire){const p=carreInventaire(o,n);p.classList.add('a-cliquer');p.setAttribute('role','button');p.tabIndex=0;p.setAttribute('aria-label',titre);
 p.onclick=e=>{e.preventDefault();faire(e.shiftKey)};p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();faire(e.shiftKey)}};
 const w=document.createElement('div');w.className='cat-carte dom-article';const nom=document.createElement('span');nom.className='nom-carte';nom.textContent=o.name;w.append(p,nom);return w}
function dessineCoffreGroupe(){const a=actors.find(x=>x&&x.id===coffreGroupeDe);if(!a){coffreGroupeDialog.close();return}
 const c=coffreVue();if(coffreGroupeOnglet>=c.onglets)coffreGroupeOnglet=0;const tab=coffreGroupeOnglet,t=c.tabs[tab]||[];
 // Les onglets : ceux qu'on a, puis le suivant, à acheter.
 const og=$('cg-onglets');og.replaceChildren();
 for(let i=0;i<c.onglets;i++){const b=document.createElement('button');b.type='button';b.className='cg-onglet'+(i===tab?' on':'');b.textContent=String(i+1);
  b.title=placesOnglet(c.tabs[i])+' / '+COFFRE_PLACES;b.onclick=()=>{coffreGroupeOnglet=i;coffreGroupeAchat=false;dessineCoffreGroupe()};og.append(b)}
 if(c.onglets<COFFRE_ONGLETS_MAX){const prix=PRIX_ONGLETS[c.onglets],b=document.createElement('button');b.type='button';b.className='cg-onglet cg-achat'+(coffreGroupeAchat?' on':'');
  b.textContent='🔒 '+prix.toLocaleString('fr-FR')+' or';b.onclick=()=>{coffreGroupeAchat=!coffreGroupeAchat;dessineCoffreGroupe()};og.append(b);
  if(coffreGroupeAchat){const l=document.createElement('div');l.className='cg-payer';
   const p1=document.createElement('button');p1.type='button';p1.textContent='Payer';p1.disabled=orDe(a)<prix;p1.onclick=()=>acheterOnglet(a,false);
   const p2=document.createElement('button');p2.type='button';p2.textContent='Payer avec le coffre';p2.disabled=c.or<prix;p2.onclick=()=>acheterOnglet(a,true);l.append(p1,p2);og.append(l)}}
 const places=document.createElement('span');places.className='cg-places';places.textContent=placesOnglet(t)+' / '+COFFRE_PLACES;og.append(places);
 $('cg-or-coffre').replaceChildren(ligneOrCoffre(c.or,'Retirer',c.or,v=>orAuCoffre(a,v,-1)));
 const gc=$('cg-coffre');gc.replaceChildren();const comptes=new Map();t.forEach(id=>comptes.set(id,(comptes.get(id)||0)+1));
 comptes.forEach((n,id)=>{const o=objetDe(id);if(o)gc.append(carreCoffre(o,n,'Reprendre '+o.name,tous=>prendreAuCoffre(a,id,tous)))});
 $('cg-qui').textContent=a.name;
 $('cg-or-sac').replaceChildren(ligneOrCoffre(orDe(a),'Déposer',orDe(a),v=>orAuCoffre(a,v,1)));
 const gs=$('cg-sac');gs.replaceChildren();const sac=new Map();(a.inventaire||[]).forEach(id=>sac.set(id,(sac.get(id)||0)+1));
 sac.forEach((n,id)=>{const o=objetDe(id);if(o)gs.append(carreCoffre(o,n,'Ranger '+o.name,tous=>deposerAuCoffre(a,o,tous)))})}
coffreGroupeDialog.addEventListener('close',()=>{clearInterval(coffreGroupeMinuterie);coffreGroupeDe=null});
