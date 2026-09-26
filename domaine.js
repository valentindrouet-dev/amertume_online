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
const appliquerSansDomaine=appliquerSauvegarde;appliquerSauvegarde=function(s){appliquerSansDomaine(s);domaine=normaliseDomaine(s&&s.domaine);domSel=null;domPageSel=null};
/* Avant chaque sauvegarde, personne ne reste dans un bâtiment qui n'est plus construit ; et
   le contenu publié suit, pour que les joueurs voient le domaine tel qu'il est. */
function sauveDomaine(){evacueNonConstruits();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
/* En vue joueur, l'onglet se dessine sans ses commandes ; en vue MJ, avec. Changer de vue
   pendant qu'il est ouvert le redessine. */
let vueDomaine=null;
const mjDom=()=>typeof view==='undefined'||view==='mj';
const renderSansVueDomaine=render;render=function(){renderSansVueDomaine();
 if(document.body.classList.contains('page-domaine')&&vueDomaine!==view)renderDomaine()};
const TEINTES_ETAPE=['#b9a48a','#c9953f','#7faddc','#8bbd9c','#d9532b','#6e6a66','#9b7fd4','#a89f8f','#7d9b3c'];
const etatBatimentValide=v=>v&&ETATS_BATIMENT.some(([k])=>k===v)?v:'';
const batimentDom=id=>domaine.batiments.find(b=>b.id===id)||null;
/* Un aventurier ne loge que dans un bâtiment construit : si l'étape recule, il en sort
   aussitôt et se retrouve simplement au domaine. Renvoie le nombre d'évacués. */
const batimentConstruit=b=>!!b&&b.etape>=ETAPES_DOMAINE.length-1;
// Les joueurs ne voient que ce qui est sorti de terre : une friche n'a ni ligne ni fiche chez eux.
const batimentChoisissable=b=>!!b&&(mjDom()||b.etape>0);
function evacueNonConstruits(){let n=0;Object.values(domaine.aventuriers).forEach(v=>{if(!v||!v.lieu)return;
 const b=batimentDom(v.lieu);if(b&&!batimentConstruit(b)){v.lieu='';n++}});return n}
function nomLieu(lieu){if(lieu==='aventure')return 'En aventure';if(lieu==='absent')return 'Absent';
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
  if(opts.jeu){const presents=actors.filter(a=>a.hero&&(domaine.aventuriers[a.id]||{}).lieu===b.id);
   if(presents.length){const j=document.createElement('div');j.className='dom-etiquette-jetons';
    presents.forEach(a=>{const t=jetonRond(a.image,a.name,'mini');t.title=a.name+(mjDom()?' — glisser vers un autre bâtiment construit':'');t.onpointerdown=ev=>glisseJetonAventurier(ev,a,t);j.append(t)});e.append(j)}}
  if(opts.deplace||opts.clic&&!inerte)rendEtiquetteDeplacable(e,b,etiquettes,opts);etiquettes.append(e)});
 dessineCartouches(etiquettes,opts);
 /* Sur le plan du Domaine, le bâtiment choisi s'allume : le reste de la carte s'assombrit
    un peu autour de lui, contours cachés ou non. Le voile passe sous les zones et laisse
    passer les clics. */
 const choisi=opts.jeu&&opts.sel!==null&&opts.sel!==undefined?d.batiments[opts.sel]:null;
 if(choisi&&choisi.zone){const v=document.createElementNS(ns,'path');v.setAttribute('class','dom-voile');v.setAttribute('fill-rule','evenodd');
  v.setAttribute('d','M0,0H100V100H0Z M'+choisi.zone.map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' L')+'Z');svg.prepend(v)}
 if(opts.trace&&opts.trace.pts.length){const pts=opts.trace.pts;
  const f=document.createElementNS(ns,pts.length>2?'polygon':'polyline');
  f.setAttribute('points',pts.map(q=>q.join(',')).join(' '));f.setAttribute('class','dom-trace');svg.append(f)}}

/* Les inscriptions de la carte, à l'encre sur ses parchemins : en haut, le nom du domaine sur
   deux lignes — « Lamuline (Domaine) » s'écrit Lamuline, puis Domaine — ; en bas, qui y vit
   et qui y passe, les vrais nombres. Elles se glissent dans l'éditeur de carte seulement. */
function nomEnDeux(nom){nom=String(nom||'').trim();const m=nom.match(/^(.*\S)\s*\((.+)\)$/);
 return m?[m[1],m[2].trim()]:[nom,/domaine/i.test(nom)?'':'Domaine']}
function dessineCartouches(etiquettes,opts){const d=domaine,compte=k=>d.pnj.filter(p=>p.statut===k).length;
 const accorde=(n,mot)=>n+' '+mot+(n>1?'s':'');
 [['titre',nomEnDeux(d.nom)],['gens',[accorde(compte('habitant'),'habitant'),accorde(compte('visiteur'),'visiteur')]]].forEach(([k,lignes])=>{
  const pt=d.carte.cartouches[k];if(!pt)return;
  const e=document.createElement('span');e.className='dom-cartouche c-'+k;e.style.left=pt[0]+'%';e.style.top=pt[1]+'%';
  lignes.forEach((t,i)=>{if(!t)return;const l=document.createElement(i?'small':'b');l.textContent=t;e.append(l)});
  if(opts.deplaceCartouche){rendEtiquetteDeplacable(e,k,etiquettes,{deplace:opts.deplaceCartouche});e.title='Glisser pour déplacer l’inscription'}
  etiquettes.append(e)})}

/* Le jeton d'un aventurier se glisse d'un bâtiment à un autre, sur le plan : lâché n'importe
   où sur la zone d'un bâtiment construit, il y est rattaché aussitôt. Lâché ailleurs, il
   revient d'où il vient. Un fantôme suit le doigt ; les bâtiments qui l'accueilleraient
   s'allument le temps du geste, celui qu'on survole plus fort. */
function glisseJetonAventurier(ev,a,t){if(ev.button!==0||!mjDom())return;ev.stopPropagation();ev.preventDefault();
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
  const v=domaine.aventuriers[a.id]||(domaine.aventuriers[a.id]={lieu:'',notes:''});
  if(b&&v.lieu!==b.id){v.lieu=b.id;renderDomaine();sauveDomaine()}};
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
 const det=document.createElement('small');const n=domaine.carte.calques.filter(Boolean).length,z=domaine.batiments.filter(x=>x.zone).length;
 det.textContent=n+' calque'+(n>1?'s':'')+' · '+z+' bâtiment'+(z>1?'s':'')+' tracé'+(z>1?'s':'');
 b.append(nom,det);b.onclick=entreDomaine;liste.prepend(b)};
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
 +'<span class="dom-tresor" id="dom-tresor-tete"></span><span class="dom-actions"><button id="dom-contours" title="Montrer ou cacher le contour des bâtiments">▦ Contours</button><button id="dom-editer">✎ Modifier la carte</button>'
 +'<button id="dom-export" title="Télécharger le domaine — carte, bâtiments, finances, habitants — dans un fichier .json">⇩ Exporter</button><button id="dom-import" title="Reprendre un domaine exporté, à la place de celui-ci">⇧ Importer</button><input type="file" id="dom-json" accept="application/json,.json" hidden></span></header>'
 +'<div class="dom-carte-wrap"><div id="dom-plan"><canvas id="dom-plan-fond"></canvas><svg id="dom-plan-zones" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>'
 +'<div id="dom-plan-etiquettes"></div><p class="muted dom-plan-vide" id="dom-plan-vide" hidden>Aucune carte du domaine. Dessine-la dans l’onglet Cartes : des calques — un par étape, un par état.</p></div></div>'
 +'<div id="dom-fiche"></div></section>'
 +'<aside class="panel dom-col" id="dom-col-gestion"><h2>Finances</h2><div id="dom-finances"></div>'
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
 const d=o&&typeof o==='object'&&!Array.isArray(o)?(o.genre==='domaine'||o.domaine?o.domaine:Array.isArray(o.batiments)?o:null):null;
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
function renderDomaine(){const d=domaine,mj=mjDom();vueDomaine=view;if(mj)evacueNonConstruits();
 // Les joueurs lisent le domaine ; ce qui le modifie — carte, export, import — reste au MJ.
 ['dom-editer','dom-export','dom-import','dom-contours'].forEach(id=>$(id).hidden=!mj);
 $('dom-titre').textContent=d.nom;$('dom-tresor-tete').textContent='Trésor : '+montantLisible(d.finances.tresor);
 if(domPageSel!==null&&!batimentChoisissable(batimentDom(domPageSel)))domPageSel=null;
 const plan=$('dom-plan');plan.style.setProperty('--ratio',String(d.carte.ratio||16/9));
 const vide=!dessineDomaine($('dom-plan-fond'),-1,()=>{if(document.body.classList.contains('page-domaine'))dessineDomaine($('dom-plan-fond'),-1)});
 $('dom-plan-vide').hidden=!vide;plan.classList.toggle('no-image',vide);
 const sel=d.batiments.findIndex(b=>b.id===domPageSel);
 // Les contours sont un outil du MJ : chez les joueurs, la carte se lit toujours sans traits.
 plan.classList.toggle('sans-contours',!(mj&&domContours));$('dom-contours').classList.toggle('on',domContours);
 // Sur l'onglet, le nom ne se déplace pas : il choisit le bâtiment, c'est tout.
 dessineZonesDom($('dom-plan-zones'),$('dom-plan-etiquettes'),{sel:sel>=0?sel:null,jeu:true,inerte:b=>!batimentChoisissable(b),
  clic:b=>{domPageSel=domPageSel===b.id?null:b.id;renderDomaine()}});
 renderDomBats();renderDomFiche();renderDomFinances();renderDomPnj();renderDomAventuriers()}
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
 tete.append(nom,et,etat,boutonConstruire(b),recul,avance);boite.append(tete);
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
 const pnj=pnjDuBatiment(domaine,b.id).map(p=>p.nom),av=actors.filter(a=>a.hero&&(domaine.aventuriers[a.id]||{}).lieu===b.id).map(a=>a.name);
 qui.textContent=(pnj.length?'Présents : '+pnj.join(', '):'Personne n’y vit ni n’y passe.')+(av.length?' · Aventuriers : '+av.join(', '):'');
 boite.append(qui)}
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
 const pnj=pnjDuBatiment(domaine,b.id).map(p=>p.nom),av=actors.filter(a=>a.hero&&(domaine.aventuriers[a.id]||{}).lieu===b.id).map(a=>a.name);
 qui.textContent=(pnj.length?'Présents : '+pnj.join(', '):'Personne n’y vit ni n’y passe.')+(av.length?' · Aventuriers : '+av.join(', '):'');
 boite.append(qui)}
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
 const lignes=mjDom()?f.journal:f.journal.filter(ligneDesJoueurs);
 [...lignes].reverse().slice(0,25).forEach(e=>{const li=document.createElement('li');
  if(e.par==='mj'){li.className='du-mj';li.title='Posée par le MJ : les joueurs ne voient pas cette ligne'}
  const date=document.createElement('small');date.textContent=e.t?new Date(e.t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const lib=document.createElement('span');lib.textContent=e.libelle;
  const m=document.createElement('b');m.className=e.montant<0?'dette':'gain';m.textContent=(e.montant>0?'+':'')+montantLisible(e.montant);
  li.append(date,lib,m);liste.append(li)});
 if(!lignes.length){const li=document.createElement('li');li.className='muted';li.textContent='Aucun mouvement.';liste.append(li)}
 boite.append(liste)}
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
function renderDomAventuriers(){const boite=$('dom-aventuriers');boite.replaceChildren();
 // Chez les joueurs, la troupe se range sur deux colonnes, chacun centré : jeton, nom, lieu.
 boite.classList.toggle('en-grille',!mjDom());
 const troupe=actors.filter(a=>a.hero);
 if(!troupe.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun aventurier dans la partie.';boite.append(p);return}
 troupe.forEach(a=>{const v=domaine.aventuriers[a.id]||(domaine.aventuriers[a.id]={lieu:'',notes:''});
  const row=document.createElement('div');row.className='dom-aventurier';
  const tete=document.createElement('div');tete.className='dom-av-tete';
  const nom=document.createElement('strong');nom.textContent=a.name;tete.append(jetonRond(a.image,a.name,'mini'),nom);
  const lieu=document.createElement('select');lieu.setAttribute('aria-label','Où est '+a.name);
  // Seuls les bâtiments construits accueillent quelqu'un.
  [['','Au domaine'],...domaine.batiments.filter(batimentConstruit).map(b=>[b.id,b.nom]),['aventure','En aventure'],['absent','Absent']].forEach(([k,n])=>lieu.add(new Option(n,k)));
  lieu.value=(v.lieu&&(v.lieu==='aventure'||v.lieu==='absent'||batimentConstruit(batimentDom(v.lieu))))?v.lieu:'';
  lieu.onchange=()=>{v.lieu=lieu.value;renderDomaine();sauveDomaine()};
  // La note de l'aventurier reste dans les données et l'export ; elle ne s'affiche plus ici.
  // Les joueurs lisent où est chacun ; le MJ le choisit.
  if(mjDom())row.append(tete,lieu);else{const ou=document.createElement('span');ou.className='dom-av-lieu';ou.textContent=nomLieu(v.lieu);row.append(tete,ou)}
  boite.append(row)})}
