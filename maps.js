/* Cartes de combat : onglet MJ pleine page pour tracer zones de blocage, zones de vision
   qui les creusent, portes, zone de départ et adversaires pré-placés.
   Les formes sont des rectangles en pourcentages de la carte. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null,cutRect=null,lasso=null;
let undoStack=[],redoStack=[],zoomC=1,panCX=0,panCY=0;
const nsSVG='http://www.w3.org/2000/svg';
// Grille du brouillard : des cellules carrées et fines, pour un bord net qui suit les murs.
const FOG_COLS=640;let fogVis=null,fogSeen=null,fogSeenSrc=null,fogKey='',fogDim=null,fogMem=null,fogDirty=true;
function fogDims(m){const r=(m&&m.ratio)||16/9,w=FOG_COLS,h=Math.max(32,Math.round(w/r));return{w,h,n:w*h}}
const KINDS={wall:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire'};
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
// L'éditeur et la table étirent l'image de la même façon ; encore faut-il que le cadre
// ait le bon rapport. On le relit sur l'image pour les cartes d'avant son enregistrement.
function measureRatio(m,apres){if(!m||!m.image)return;const img=new Image();
 img.onload=()=>{if(!img.naturalHeight)return;const r=img.naturalWidth/img.naturalHeight;
  if(Math.abs(r-(m.ratio||0))>1e-3){m.ratio=r;scheduleSave();if(apres)apres()}};
 img.onerror=()=>{};img.src=m.image}
/* Le contour lissé des zones coûte quelques millisecondes : on le garde tant que la
   géométrie ne bouge pas. Dessin, vue, tirs et déplacements y puisent tous, donc le
   mur peint et le mur qui arrête sont exactement le même. */
let shapeCache={cle:'',formes:[],murs:null};
function geometryKey(m){return m.id+'|'+(m.walls||[]).map(r=>r.x+','+r.y+','+r.w+','+r.h+(r.locked?'v':'')).join(';')
 +'|'+(m.doors||[]).map(d=>d.x+','+d.y+','+d.w+','+d.h+(d.open?'o':'f')).join(';')
 +'|'+(m.carves||[]).length+'/'+(m.cuts||[]).length}
// L'éditeur redessine à chaque geste : son contour est gardé de la même façon.
let skinCache={cle:'',contours:[]};
function draftSkin(m){const cle=geometryKey(m);
 if(skinCache.cle!==cle)skinCache={cle,contours:wallShape(m).contours};
 return skinCache.contours}
function mapShapes(m){const cle=geometryKey(m);
 if(shapeCache.cle!==cle){const murs=wallShape(m);
  shapeCache={cle,murs,formes:[murs,...(m.doors||[]).filter(d=>d&&!d.open&&d.w>0&&d.h>0).map(d=>({contours:[rectPolygon(d)]}))]}}
 return shapeCache}
// Obstacles du moteur : la carte ouverte fait foi, sinon le plan schématique de départ.
function activeObstacles(){const m=currentMap();
 return m?mapShapes(m).formes:$('map').classList.contains('custom')?[]:WALLS.map(p=>({contours:[p]}))}
// Nomme l'obstacle qui coupe la vue, pour que le MJ sache s'il peut l'ouvrir.
function obstacleLabel(a,b){const m=currentMap();
 return m&&wallsBetween(a,b,(m.doors||[]).filter(d=>!d.open).map(rectPolygon))?'une porte fermée':'un mur'}
// Un socle est vu dès qu'il mord sur la zone éclairée, fût-ce d'un pour cent.
function tokenRadiusPct(){const size=mapSize();return size.width?tokenPx()/2/size.width*100:1.5}

/* ---------- Brouillard de guerre ---------- */
/* Ce que l'on voit à l'instant est un polygone exact, tracé au pixel près.
   Ce que la troupe a exploré est une grille fine, gardée sur la carte en base64. */
// Le MJ voit par toute la troupe ; le joueur ne voit que par son aventurier.
function fogParty(){return actors.filter(a=>a.hero&&alive(a))}
function fogSeers(){const troupe=fogParty();if(view==='mj')return troupe;
 const a=actors[owner];return a&&a.hero&&alive(a)?[a]:troupe}
// Mémoire d'exploration : format compact, avec reprise des grilles d'avant la v0.25.
function readSeen(m,d){
 if(typeof m.fog==='string'&&m.fog.length===maskChars(d.n))return unpackMask(m.fog,d.n);
 if(typeof m.seen==='string'&&/^[01]+$/.test(m.seen))
  for(const c of [256,104]){const r=m.seen.length/c;
   if(Number.isInteger(r)&&r>10&&r<c)return regridMask(m.seen,c,r,d.w,d.h)}
 return new Uint8Array(d.n)}
function computeFog(){const m=currentMap();
 if(!m){fogVis=null;fogSeen=null;fogKey='';fogDim=null;return}
 const d=fogDim=fogDims(m);
 if(!fogSeen||fogSeen.length!==d.n||m.fog!==fogSeenSrc){fogSeen=readSeen(m,d);fogSeenSrc=m.fog;fogDirty=true}
 const formes=activeObstacles(),troupe=fogParty();
 // Le calcul ne reprend que si la scène a bougé : héros, portes, zones ou point de vue.
 const cle=m.id+'|'+d.n+'|'+view+'|'+owner+'|'+troupe.map(a=>a.x.toFixed(2)+','+a.y.toFixed(2)).join(';')
  +'|'+geometryKey(m);
 if(cle===fogKey&&fogVis)return;
 fogKey=cle;
 const vues=new Map(),vu=a=>{const k=a.x+','+a.y;
  if(!vues.has(k))vues.set(k,visionPolygon(a,formes));return vues.get(k)};
 // La mémoire retient ce que la troupe entière a vu, où que soit le lecteur.
 let neuf=0;for(const a of troupe)neuf+=fillPolygonGrid(fogSeen,d.w,d.h,vu(a));
 fogVis=fogSeers().map(vu);
 if(neuf){m.fog=fogSeenSrc=packMask(fogSeen,d.n);delete m.seen;fogDirty=true;scheduleSave()}}
// Le champ de vision en pixels : le socle est un disque, pas un point.
let fogPx=null,fogPxKey='';
function visionInPixels(){const size=mapSize(),k=fogKey+'|'+Math.round(size.width);
 if(fogPxKey!==k){fogPxKey=k;
  fogPx=(fogVis||[]).map(p=>p.map(([x,y])=>[x/100*size.width,y/100*size.height]))}
 return fogPx}
// Un adversaire hors du champ n'existe pas pour celui qui regarde. Mais il suffit
// qu'un bout de son socle morde sur la zone éclairée pour qu'il se montre.
function partySees(a){const m=currentMap();
 if(!fogVis||!m||m.fogOff)return true;
 const size=mapSize();if(!size.width)return true;
 const c=[a.x/100*size.width,a.y/100*size.height],r=tokenPx()/2;
 return visionInPixels().some(p=>polyTouchesDisc(p,c,r))}
// La mémoire d'exploration, lue en un point : sert à garder les portes visibles.
function seenAt(x,y){if(!fogSeen||!fogDim)return false;const d=fogDim;
 const i=Math.min(d.w-1,Math.max(0,Math.floor(x/100*d.w))),j=Math.min(d.h-1,Math.max(0,Math.floor(y/100*d.h)));
 return fogSeen[j*d.w+i]===1}
/* Une porte close est un obstacle : le regard s'arrête sur sa face, si bien que les
   cases de son rectangle ne sont jamais « vues » et qu'elle resterait invisible aux
   joueurs plantés devant. On interroge donc sa face, et la mémoire tout autour. */
function doorProbes(d,marge){const xs=[d.x-marge,d.x+d.w/2,d.x+d.w+marge];
 const ys=[d.y-marge,d.y+d.h/2,d.y+d.h+marge],out=[];
 for(const x of xs)for(const y of ys)out.push([x,y]);
 return out}
// Vue à l'instant : le polygone de vision épouse la face de la porte.
function doorInSight(d){const size=mapSize();
 if(!size.width||!fogVis)return false;
 const r=Math.max(3,tokenPx()*.12);
 const faces=doorProbes(d,0).map(([x,y])=>[x/100*size.width,y/100*size.height]);
 return visionInPixels().some(p=>faces.some(c=>polyTouchesDisc(p,c,r)))}
// Déjà explorée : la mémoire juste autour du rectangle suffit.
function doorRemembered(d){return doorProbes(d,.9).some(([x,y])=>seenAt(x,y))}
function doorSeen(d){const m=currentMap();
 if(view==='mj'||!m||m.fogOff||!fogVis)return true;
 return doorInSight(d)||doorRemembered(d)}
// La mémoire est peinte une fois par changement, puis réutilisée telle quelle.
function memoryCanvas(d){if(!fogSeen)return null;
 if(!fogMem||fogMem.width!==d.w||fogMem.height!==d.h){
  fogMem=document.createElement('canvas');fogMem.width=d.w;fogMem.height=d.h;fogDirty=true}
 if(fogDirty){const c=fogMem.getContext('2d'),img=c.createImageData(d.w,d.h);
  for(let k=0;k<d.n;k++)if(fogSeen[k]){const p=k*4;img.data[p]=img.data[p+1]=img.data[p+2]=img.data[p+3]=255}
  c.putImageData(img,0,0);fogDirty=false}
 return fogMem}
function renderFog(){const cv=$('fog'),m=currentMap(),d=fogDim;
 // Voile levé par le MJ : plus rien ne masque la carte, pour personne.
 if(!m||!fogVis||!d||m.fogOff){cv.style.display='none';return}
 cv.style.display='';
 const large=cv.clientWidth,haut=cv.clientHeight;if(!large||!haut)return;
 // Toile à la résolution de l'écran : le bord du polygone est tracé au pixel près.
 const ech=Math.min(2,window.devicePixelRatio||1);
 const W=Math.max(1,Math.min(2400,Math.round(large*ech))),H=Math.max(1,Math.round(W*haut/large));
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
 const ctx=cv.getContext('2d');
 // Le MJ garde une vue lisible ; le joueur ne voit rien de l'inexploré.
 const inconnu=view==='mj'?110:255,memoire=view==='mj'?40:150;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle='rgba(6,9,11,'+(inconnu/255).toFixed(3)+')';ctx.fillRect(0,0,W,H);
 ctx.globalCompositeOperation='destination-out';
 const mem=memoryCanvas(d);
 if(mem){ctx.globalAlpha=1-memoire/inconnu;ctx.imageSmoothingEnabled=false;ctx.drawImage(mem,0,0,W,H)}
 ctx.globalAlpha=1;ctx.fillStyle='#000';
 for(const poly of fogVis){if(!poly||poly.length<3)continue;
  ctx.beginPath();ctx.moveTo(poly[0][0]/100*W,poly[0][1]/100*H);
  for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0]/100*W,poly[i][1]/100*H);
  ctx.closePath();ctx.fill()}
 /* Une porte n'est qu'un contour : le regard s'arrête dessus, donc son rectangle n'est
    jamais éclairé et le décor y resterait noir. On lui rend la clarté de ses abords —
    pleine si on la voit, celle de la mémoire si on l'a seulement découverte. */
 const rect=p=>ctx.fillRect(p.x/100*W,p.y/100*H,p.w/100*W,p.h/100*H);
 const portes=(m.doors||[]).filter(p=>p&&p.w>0&&p.h>0);
 const retenues=portes.filter(p=>!doorInSight(p)&&doorRemembered(p));
 if(retenues.length){ctx.globalAlpha=1-memoire/inconnu;retenues.forEach(rect);ctx.globalAlpha=1}
 portes.filter(doorInSight).forEach(rect);
 ctx.globalCompositeOperation='source-over'}
function resetFog(tout){const m=currentMap();if(!m)return;
 const d=fogDims(m),g=new Uint8Array(d.n);if(tout)g.fill(1);
 m.fog=packMask(g,d.n);delete m.seen;m.fogOff=false;fogSeen=g;fogSeenSrc=m.fog;fogDirty=true;fogKey='';
 render();scheduleSave();
 log(tout?'Brouillard levé sur toute la carte.':'Brouillard réinitialisé.')}

/* ---------- Rendu sur la table de jeu ---------- */
function svgRect(r,cls){const el=document.createElementNS(nsSVG,'rect');
 el.setAttribute('x',r.x+'%');el.setAttribute('y',r.y+'%');el.setAttribute('width',r.w+'%');el.setAttribute('height',r.h+'%');
 if(cls)el.setAttribute('class',cls);return el}
function applyMapRatio(){const m=currentMap(),el=$('map');
 if(!m||!m.ratio){el.style.width='';el.style.height='';return}
 const dispo=el.parentElement.clientWidth||el.clientWidth||600,hMax=Math.max(260,Math.round(innerHeight*.72));
 let w=dispo,h=w/m.ratio;if(h>hMax){h=hMax;w=h*m.ratio}
 el.style.width=Math.round(w)+'px';el.style.height=Math.round(h)+'px'}
/* Le contour lissé devient un tracé SVG dans un repère de 0 à 100 : c'est très
   exactement la matière qui arrête le regard, dessinée sans un pixel d'écart. */
function svgPath(contours,cls,wrap){const svg=document.createElementNS(nsSVG,'svg');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 if(wrap)svg.setAttribute('class',wrap);
 const el=document.createElementNS(nsSVG,'path');
 el.setAttribute('d',contours.map(c=>'M'+c.map(p=>p[0].toFixed(3)+' '+p[1].toFixed(3)).join('L')+'Z').join(''));
 el.setAttribute('fill-rule','evenodd');if(cls)el.setAttribute('class',cls);
 svg.append(el);return svg}
// Le joueur ne manœuvre une porte qu'au contact : elle doit mordre son rayon.
function doorInReach(d){if(view==='mj')return true;
 const a=actors[owner],size=mapSize();
 return !!(a&&a.hero&&alive(a)&&size.width&&rectInReach(a,d,size,tokenPx()))}
function renderMapLayer(){const svg=$('map-shapes'),portes=$('map-doors'),m=currentMap();
 svg.replaceChildren();portes.replaceChildren();applyMapRatio();renderFog();refreshGmBar();
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 const formes=mapShapes(m);
 if(formes.murs.contours.length)svg.append(svgPath(formes.murs.contours,'wall-group'));
 // Les portes se dessinent au-dessus du brouillard : une fois découverte, une porte
 // reste lisible dans la pénombre. Tant qu'elle est inexplorée, elle n'existe pas.
 (m.doors||[]).forEach((d,i)=>{
  if(!doorSeen(d))return;
  // Une porte que ce lecteur peut manœuvrer s'annonce au survol.
  const ouvrable=view==='mj'||(!d.keyLocked&&doorInReach(d));
  const el=svgRect(d,'door'+(d.open?' open':'')+(d.keyLocked?' keyed':'')+(ouvrable?' can-open':''));
  el.style.pointerEvents='all';
  el.onclick=()=>{
   if(d.keyLocked&&view!=='mj'){log('Cette porte est verrouillée : seul le MJ peut l’ouvrir.');return}
   if(!doorInReach(d)){log('Trop loin de la porte : approche ton aventurier pour la manœuvrer.');return}
   d.open=!d.open;log('Porte '+(i+1)+' '+(d.open?'ouverte':'fermée')+'.');render();scheduleSave()};
  portes.append(el)});
}

/* ---------- Ouverture d'une carte en combat ---------- */
function openBattleMap(id){const m=maps.find(x=>x.id===id);if(!m)return;
 if(!confirm('Ouvrir « '+m.name+' » ? Les héros sont regroupés dans la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.'))return;
 currentMapId=id;mapImage=m.image||null;measureRatio(m,render);
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 const heros=actors.filter(a=>a.hero);
 if(m.start)spreadInZone(heros.length,m.start).forEach((p,i)=>moveActor(heros[i],p.x,p.y));
 actors.splice(0,actors.length,...heros);
 // Une carte s'ouvre portes closes et brouillard intact : l'état des portes est une affaire de partie.
 (m.doors||[]).forEach(d=>{d.open=false});const grille=fogDims(m);
 m.fog=packMask(new Uint8Array(grille.n),grille.n);delete m.seen;m.fogOff=false;fogSeen=null;fogSeenSrc=null;fogKey='';
 (m.foes||[]).forEach(f=>{const a=fromMonster(f.tpl);a.hidden=!!f.hidden;a.x=f.x;a.y=f.y;normalizeActor(a);actors.push(a)});
 render();actors.forEach(settleActor);   // Personne ne démarre dans un mur.

 actors.forEach(a=>{a.target=null});
 owner=actors.findIndex(a=>a.hero);selected=Math.max(0,owner);
 resetMapZoom();showPage('table');render();
 log('Carte « '+m.name+' » ouverte : '+heros.length+' héros placés, '+(m.foes||[]).length+' adversaire(s) en place.');scheduleSave()}

/* ---------- Onglets de page, réservés au MJ ---------- */
const tabs=document.createElement('nav');tabs.className='tabs';
tabs.innerHTML='<button data-page="table" class="on">Table de jeu</button><button data-page="maps">Cartes</button>'
 +'<button data-page="armory">Armurerie</button><button data-page="bestiary">Bestiaire</button>';
document.querySelector('.view-controls').before(tabs);
const PAGES=['table','maps','armory','bestiary'];
const tabsMJ=[...tabs.querySelectorAll('button')].filter(b=>b.dataset.page!=='table');
function showPage(p){if(p!=='table'&&view!=='mj')return;
 PAGES.forEach(x=>document.body.classList.toggle('page-'+x,x===p&&x!=='table'));
 tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.page===p));
 if(p==='maps'){if(!maps.length)newMap();if(!mapDraft)mapDraft=maps.find(m=>m.id===currentMapId)||maps[0];
  measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas()}
 else if(p==='armory')renderArmory();
 else if(p==='bestiary')renderBestiary();
 // De retour sur la table, tout est remesuré : la carte était masquée, donc sans largeur,
 // et les socles comme le brouillard se calculent sur cette largeur.
 else{applyMapRatio();applyMapZoom();render()}}
tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));

/* ---------- Page de l'éditeur ---------- */
const mapsPage=document.createElement('main');mapsPage.id='maps-page';
mapsPage.innerHTML=
 '<aside class="maps-side panel"><h2>Cartes</h2><div id="map-list"></div>'
 +'<div class="side-actions"><button id="map-new" class="primary">+ Nouvelle carte</button><button id="map-copy">Dupliquer</button><button id="map-del">Supprimer</button></div>'
 +'<div class="divider"></div><h2>Sauvegarde</h2>'
 +'<p class="muted">Un fichier qui contient toutes tes cartes : zones, portes, découpes, zone de départ, adversaires et image de fond. À garder de côté, et à réimporter si la partie saute.</p>'
 +'<div class="side-actions"><button id="map-export">⇩ Exporter</button><button id="map-import">⇧ Importer</button></div>'
 +'<input type="file" id="map-json" accept="application/json,.json" hidden></aside>'
 +'<section class="maps-main panel"><div class="maps-bar"><label class="grow">Nom de la carte<input id="map-name" maxlength="80"></label>'
 +'<button id="map-image">Image de fond</button><button id="map-image-clear">Retirer l’image</button><button id="map-play" class="primary">Ouvrir en combat</button></div>'
 +'<input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="tool-bar" id="map-tools"><button data-tool="select">Sélection</button><button data-tool="wall">Zone de blocage</button>'
 +'<button data-tool="cut">Découper</button><button data-tool="lasso">Découpe libre</button><button data-tool="door">Porte</button><button data-tool="start">Zone de départ</button>'
 +'<button data-tool="foe">Adversaire</button><select id="map-foe-tpl" aria-label="Modèle d’adversaire"></select>'
 +'<span class="bar-sep"></span><button id="undo" title="Annuler (⌘Z)">↶ Annuler</button><button id="redo" title="Rétablir (⇧⌘Z)">↷ Rétablir</button>'
 +'<span class="bar-sep"></span><button id="czoom-out" aria-label="Dézoomer">−</button><span id="czoom-label" class="muted">100 %</span>'
 +'<button id="czoom-in" aria-label="Zoomer">+</button><button id="czoom-reset">Ajuster</button></div>'
 +'<div class="canvas-wrap"><div id="map-canvas"></div></div><p class="muted" id="map-hint"></p></section>'
 +'<aside class="maps-props panel"><h2>Forme sélectionnée</h2><p class="muted" id="shape-label">Aucune sélection.</p>'
 +'<button id="shape-lock" hidden>🔒 Verrouiller</button>'
  +'<label id="door-key-label" hidden><input type="checkbox" id="door-key"> Verrouillée — le MJ seul l’ouvre</label>'+'<label id="foe-hidden-label" hidden><input type="checkbox" id="foe-hidden"> Invisible à l’ouverture</label>'
 +'<button id="shape-delete" hidden>Supprimer la forme</button><div class="divider"></div><h2>Légende</h2>'
 +'<ul class="legend"><li><i class="sw-wall"></i>Zone de blocage — coupe la vue et le passage</li>'
 +'<li><i class="sw-cut"></i>Découper — ouverture rectangulaire dans les zones de blocage</li>'+'<li><i class="sw-cut"></i>Découpe libre — contour tracé ou point par point, pour les formes rondes</li>'
 +'<li><i class="sw-door"></i>Porte — close au début du combat, ouverte d’un clic en jeu</li>'+'<li><i class="sw-key"></i>Porte verrouillée — le MJ seul peut l’ouvrir</li>'
 +'<li><i class="sw-start"></i>Zone de départ des héros</li>'
 +'<li><i class="sw-foe"></i>Adversaire pré-placé</li></ul><p class="muted" id="map-count"></p>'
 +'<div id="recal-box" hidden><div class="divider"></div><h2>Réparation</h2>'
  +'<p class="muted">Tes zones semblent décalées vers le centre de l’image ? Cette carte a été tracée quand l’éditeur logeait l’image dans un cadre 16/9. Le recalage leur rend leur place ; ⌘Z l’annule.</p>'
  +'<button id="map-recal">Recaler les zones sur l’image</button></div></aside>';
document.querySelector('main.layout').after(mapsPage);

/* ---------- Historique ---------- */
function pushUndo(){if(!mapDraft)return;undoStack.push(structuredClone(mapDraft));if(undoStack.length>60)undoStack.shift();redoStack.length=0;refreshHistory()}
function refreshHistory(){$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length}
function applySnapshot(snap){const i=maps.findIndex(m=>m.id===snap.id);if(i<0)return;
 maps[i]=snap;mapDraft=snap;mapSel=null;renderMapList();renderCanvas();saveMaps();if(snap.id===currentMapId)render();refreshHistory()}
function undo(){if(!undoStack.length||!mapDraft)return;redoStack.push(structuredClone(mapDraft));applySnapshot(undoStack.pop())}
function redo(){if(!redoStack.length||!mapDraft)return;undoStack.push(structuredClone(mapDraft));applySnapshot(redoStack.pop())}
$('undo').onclick=undo;$('redo').onclick=redo;
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps'))return;
 if(e.key.toLowerCase()!=='z'||!(e.metaKey||e.ctrlKey))return;
 if(e.target.closest('input,textarea,select'))return;
 e.preventDefault();e.shiftKey?redo():undo()});
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps')||!lasso)return;
 if(e.key==='Enter'){e.preventDefault();applyLasso()}
 else if(e.key==='Escape'){e.preventDefault();lasso=null;renderCanvas()}});
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps'))return;
 if(e.key!=='Delete'&&e.key!=='Backspace')return;
 if(e.target.closest('input,textarea,select'))return;
 const cible=mapSel&&shapeAt(mapSel);if(!cible||cible.locked)return;
 e.preventDefault();pushUndo();removeShape(mapSel);mapSel=null;
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});

/* ---------- Cartes ---------- */
function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,ratio:16/9,fitted:true,walls:[],doors:[],start:null,foes:[]};
 maps.push(m);mapDraft=m;mapSel=null;undoStack=[];redoStack=[];return m}
function ensure(m){m.walls??=[];m.doors??=[];m.foes??=[];m.carves??=[];m.cuts??=[];m.ratio??=16/9;
 // Migration : les anciennes zones de vision sont appliquées une fois pour toutes aux murs.
 if(m.visions&&m.visions.length){const libres=m.walls.filter(w=>!w.locked),verrous=m.walls.filter(w=>w.locked);
  m.walls=[...verrous,...subtractRects(libres,m.visions.filter(r=>r&&r.w>0&&r.h>0))]}
 delete m.visions;return m}
$('map-new').onclick=()=>{newMap();renderMapList();renderCanvas();saveMaps()};
$('map-copy').onclick=()=>{if(!mapDraft)return;const c=structuredClone(mapDraft);c.id=crypto.randomUUID();c.name=mapDraft.name+' (copie)';
 maps.push(c);mapDraft=c;mapSel=null;undoStack=[];redoStack=[];renderMapList();renderCanvas();saveMaps()};
$('map-del').onclick=()=>{if(!mapDraft||!confirm('Supprimer « '+mapDraft.name+' » ?'))return;
 const i=maps.indexOf(mapDraft);maps.splice(i,1);if(currentMapId===mapDraft.id)currentMapId=null;
 mapDraft=maps[Math.max(0,i-1)]||null;mapSel=null;undoStack=[];redoStack=[];if(!maps.length)newMap();
 renderMapList();renderCanvas();saveMaps();render()};
$('map-name').oninput=()=>{if(mapDraft){mapDraft.name=$('map-name').value;renderMapList();saveMaps()}};
/* Sauvegarde des couches : le fichier se suffit à lui-même, image comprise, et il
   revient toujours en cartes neuves — on ne remplace jamais ce qui est là. */
$('map-export').onclick=()=>{
 const blob=new Blob([JSON.stringify(packMaps(maps))],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='amertume-cartes-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 log(maps.length+' carte(s) exportée(s) dans un fichier.')};
$('map-import').onclick=()=>$('map-json').click();
$('map-json').onchange=()=>{const f=$('map-json').files[0];$('map-json').value='';if(!f)return;
 const lecteur=new FileReader();
 lecteur.onerror=()=>alert('Lecture du fichier impossible.');
 lecteur.onload=()=>{let entrantes;
  try{entrantes=readMapsFile(String(lecteur.result))}catch(e){alert(e.message);return}
  entrantes.forEach(m=>{m.id=crypto.randomUUID();m.name+=' (importée)';maps.push(m)});
  mapDraft=maps[maps.length-1];mapSel=null;undoStack=[];redoStack=[];
  measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas();saveMaps();
  log(entrantes.length+' carte(s) importée(s).')};
 lecteur.readAsText(f)};
$('map-image').onclick=()=>$('map-file').click();
$('map-file').onchange=()=>{const f=$('map-file').files[0];$('map-file').value='';
 // Le rapport de l'image devient celui de la carte : le tracé et le jeu voient le même cadrage.
 if(f)openImage(f,'map',url=>{pushUndo();mapDraft.image=url;const img=new Image();
  img.onload=()=>{if(img.naturalHeight)mapDraft.ratio=img.naturalWidth/img.naturalHeight;
   renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
  img.onerror=()=>{renderCanvas();saveMaps()};img.src=url})};
$('map-image-clear').onclick=()=>{if(mapDraft){pushUndo();mapDraft.image=null;renderCanvas();saveMaps()}};
$('map-play').onclick=()=>{if(mapDraft)openBattleMap(mapDraft.id)};
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;if(mapTool!=='lasso')lasso=null;renderCanvas()});

function renderMapList(){$('map-list').replaceChildren(...maps.map(m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');
 const nom=document.createElement('strong');nom.textContent=m.name;
 const det=document.createElement('small');ensure(m);
 det.textContent=m.walls.length+' zone(s) · '+m.doors.length+' porte(s) · '+m.foes.length+' adversaire(s)';
 b.append(nom,det);b.onclick=()=>{mapDraft=m;mapSel=null;undoStack=[];redoStack=[];measureRatio(m,renderCanvas);renderMapList();renderCanvas()};return b}));
 if(mapDraft)$('map-name').value=mapDraft.name;
 $('map-foe-tpl').replaceChildren();catalog.monsters.forEach((m,i)=>$('map-foe-tpl').add(new Option(m.name,String(i))))}

const HINTS={select:'Clique une forme pour la sélectionner, glisse pour la déplacer, tire un coin pour la redimensionner. ⌘Z annule.',
 wall:'Trace un rectangle : il coupe la vue et le passage. Un clic simple sur une forme existante la sélectionne. Suppr efface la sélection.',
 cut:'Trace un rectangle à l’intérieur d’une zone de blocage : la découpe y creuse une ouverture définitive, vue et passage rétablis.',
 lasso:'Contourne la forme à creuser : glisse pour tracer à main levée, ou clique point par point. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 door:'Trace une porte : elle perce d’elle-même la zone de blocage qu’elle recouvre, et le mur se referme si tu la déplaces. Close à chaque ouverture de la carte, elle s’ouvre d’un clic en partie — sauf si tu la verrouilles, auquel cas le MJ seul la manœuvre.',
 start:'Trace la zone où les héros seront regroupés à l’ouverture de la carte. Une seule par carte.',
 foe:'Clique pour poser l’adversaire choisi à droite de la barre. Il pourra être invisible à l’ouverture.'};
// Le plan de travail adopte le rapport de la carte et occupe la place disponible.
function sizeCanvas(){const c=$('map-canvas'),w=document.querySelector('.canvas-wrap');
 const ratio=(mapDraft&&mapDraft.ratio)||16/9,dispoW=w.clientWidth||600,dispoH=w.clientHeight||400;
 let lw=dispoW,lh=lw/ratio;if(lh>dispoH){lh=dispoH;lw=lh*ratio}
 c.style.width=Math.round(lw)+'px';c.style.height=Math.round(lh)+'px'}
function renderCanvas(){const c=$('map-canvas'),m=mapDraft;$('map-hint').textContent=HINTS[mapTool]||'';
 document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===mapTool));
 c.replaceChildren();sizeCanvas();applyCanvasZoom();if(!m)return;ensure(m);
 // La matière est peinte d'un seul tenant, lissée : l'éditeur montre le mur du jeu.
 const contours=draftSkin(m);
 if(contours.length)c.append(svgPath(contours,null,'wall-skin'));
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 m.walls.forEach((r,i)=>c.append(shapeEl('wall',i,r)));
 m.doors.forEach((r,i)=>c.append(shapeEl('door',i,r)));
 if(cutRect)c.append(shapeEl('cut',0,cutRect));
 if(lasso&&lasso.pts.length){const svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','lasso-layer');
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
  const forme=document.createElementNS(nsSVG,lasso.pts.length>2?'polygon':'polyline');
  forme.setAttribute('points',lasso.pts.map(pt=>pt.join(',')).join(' '));svg.append(forme);
  lasso.pts.forEach(pt=>{const o=document.createElementNS(nsSVG,'circle');
   o.setAttribute('cx',pt[0]);o.setAttribute('cy',pt[1]);o.setAttribute('r',.7);svg.append(o)});
  c.append(svg)}
 if(m.start)c.append(shapeEl('start',0,m.start));
 m.foes.forEach((f,i)=>c.append(foeEl(i,f)));
 const cible=mapSel?shapeAt(mapSel):null;
 const adv=mapSel&&mapSel.kind==='foe'?cible:null,porte=mapSel&&mapSel.kind==='door'?cible:null;
 $('foe-hidden-label').hidden=!adv;$('door-key-label').hidden=!porte;
 if(porte)$('door-key').checked=!!porte.keyLocked;
 $('shape-delete').hidden=!mapSel||!!(cible&&cible.locked);$('shape-lock').hidden=!mapSel;
 if(cible)$('shape-lock').textContent=cible.locked?'🔓 Déverrouiller':'🔒 Verrouiller';
 if(adv)$('foe-hidden').checked=!!adv.hidden;
 $('shape-label').textContent=mapSel?KINDS[mapSel.kind]+(adv?' · '+adv.tpl.name:'')+(cible&&cible.locked?' · verrouillée':''):'Aucune sélection.';
 $('map-count').textContent=m.walls.length+' zone(s) de blocage, '+m.doors.length+' porte(s), '
  +m.foes.length+' adversaire(s)'+(m.start?', zone de départ définie.':', aucune zone de départ.');
 $('recal-box').hidden=!recalNeeded();
 refreshHistory()}
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(r.locked?' locked':'')+(kind==='door'&&r.keyLocked?' keyed':'')
  +(mapSel&&mapSel.kind===kind&&mapSel.i===i?' selected':'');
 el.style.left=r.x+'%';el.style.top=r.y+'%';el.style.width=r.w+'%';el.style.height=r.h+'%';
 el.dataset.kind=kind;el.dataset.i=i;
 ['nw','ne','sw','se'].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;el.append(h)});
 return el}
function foeEl(i,f){const el=document.createElement('div');
 el.className='shape foe'+(f.hidden?' hidden-foe':'')+(f.locked?' locked':'')+(mapSel&&mapSel.kind==='foe'&&mapSel.i===i?' selected':'');
 // Même taille relative qu'en partie : une fraction de la largeur de la carte.
 const t=Math.max(10,$('map-canvas').clientWidth*TOKEN_FRACTION);
 el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';el.style.fontSize=(t*.47)+'px';
 el.style.left=f.x+'%';el.style.top=f.y+'%';el.dataset.kind='foe';el.dataset.i=i;
 el.textContent=(f.tpl.name||'?')[0];el.title=f.tpl.name+(f.hidden?' (invisible à l’ouverture)':'');return el}
// Ne creuse que les zones libres : une zone verrouillée résiste au grattage.
function carveWalls(fn){const libres=mapDraft.walls.filter(w=>!w.locked),verrous=mapDraft.walls.filter(w=>w.locked);
 mapDraft.walls=[...verrous,...fn(libres)]}
function applyLasso(){const pts=lasso&&lasso.pts;lasso=null;
 if(!pts||pts.length<3){renderCanvas();return}
 pushUndo();carveWalls(r=>carveWithPolygon(r,pts,CARVE_STEP));
 // Le tracé est gardé : c'est la seule chose que le lissage a le droit d'adoucir.
 (mapDraft.carves||(mapDraft.carves=[])).push(pts.map(p=>[p[0],p[1]]));
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()}
function shapeAt(d){const m=mapDraft;if(!m)return null;if(d.kind==='cut')return cutRect;
 return d.kind==='start'?m.start:(d.kind==='wall'?m.walls:d.kind==='door'?m.doors:m.foes)[d.i]}
function removeShape(d){const m=mapDraft;
 if(d.kind==='start')m.start=null;
 else (d.kind==='wall'?m.walls:d.kind==='door'?m.doors:m.foes).splice(d.i,1)}

/* ---------- Recalage des cartes tracées avant la v0.23 ---------- */
// L'éditeur d'alors logeait l'image dans un cadre 16/9 : tout le tracé s'en trouvait
// comprimé vers le centre. On rend aux formes leurs coordonnées d'image.
function recalNeeded(){const m=mapDraft;
 return !!(m&&m.image&&!m.fitted&&Math.abs((m.ratio||16/9)-16/9)>.01
  &&(m.walls.length||m.doors.length||m.foes.length||m.start))}
$('map-recal').onclick=()=>{const m=mapDraft;if(!recalNeeded())return;
 pushUndo();const remis=s=>uncontain(s,16/9,m.ratio);
 m.walls=remis(m.walls);m.doors=remis(m.doors);m.foes=remis(m.foes);
 if(m.start)m.start=remis([m.start])[0];
 m.fitted=true;renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};

/* ---------- Verrouillage ---------- */
$('shape-lock').onclick=()=>{const cible=mapSel&&shapeAt(mapSel);if(!cible)return;
 pushUndo();cible.locked=!cible.locked;renderCanvas();saveMaps()};

/* ---------- Tracé, sélection, déplacement ---------- */
const pct=e=>{const r=$('map-canvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,100*(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(e.clientY-r.top)/r.height))}};
$('map-canvas').addEventListener('pointerdown',e=>{if(!mapDraft)return;ensure(mapDraft);
 const grip=e.target.dataset.grip,p=pct(e),sous=e.target.closest('.shape');
 const dessous=sous?{kind:sous.dataset.kind,i:Number(sous.dataset.i)}:null;
 // Avec l'outil Sélection, ou sur une poignée, on manipule la forme visée.
 if(dessous&&(mapTool==='select'||grip)){mapSel=dessous;const cible=shapeAt(dessous);
  if(cible&&!cible.locked){pushUndo();mapDrag={mode:grip?'resize':'move',...dessous,grip,orig:structuredClone(cible),from:p,touche:false};
   $('map-canvas').setPointerCapture(e.pointerId)}
  renderCanvas();e.preventDefault();return}
 if(mapTool==='foe'){const t=catalog.monsters[Number($('map-foe-tpl').value)];if(!t)return;
  pushUndo();mapDraft.foes.push({tpl:structuredClone(t),x:p.x,y:p.y,hidden:false,locked:false});
  mapSel={kind:'foe',i:mapDraft.foes.length-1};renderCanvas();saveMaps();return}
 if(mapTool==='select'){mapSel=null;renderCanvas();return}
 if(mapTool==='lasso'){if(!lasso)lasso={pts:[]};
  // Un clic près du premier point ferme le contour, comme dans un outil de détourage.
  if(lasso.pts.length>2&&Math.hypot(p.x-lasso.pts[0][0],p.y-lasso.pts[0][1])<1.6){applyLasso();return}
  lasso.pts.push([p.x,p.y]);mapSel=null;
  mapDrag={mode:'lasso',from:p,bouge:false};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 if(mapTool==='cut'){cutRect={x:p.x,y:p.y,w:0,h:0};mapSel=null;
  mapDrag={mode:'cut',kind:'cut',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Outil de dessin : on trace. Un clic sans glisser sélectionne la forme sous le curseur.
 pushUndo();const rect={x:p.x,y:p.y,w:0,h:0,locked:false};
 if(mapTool==='wall'){mapDraft.walls.push(rect);mapSel={kind:'wall',i:mapDraft.walls.length-1}}
 else if(mapTool==='door'){rect.open=false;mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 mapDrag={mode:'create',kind:mapTool,i:mapSel.i,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
$('map-canvas').addEventListener('pointermove',e=>{if(!mapDrag)return;const p=pct(e),d=mapDrag;
 if(d.mode==='lasso'){const der=lasso.pts[lasso.pts.length-1];
  if(Math.hypot(p.x-der[0],p.y-der[1])>=.6){lasso.pts.push([p.x,p.y]);d.bouge=true;renderCanvas()}
  return}
 const cible=shapeAt(d);if(!cible)return;
 if(d.kind==='foe'){cible.x=p.x;cible.y=p.y}
 else if(d.mode==='create'||d.mode==='cut'){cible.x=Math.min(d.from.x,p.x);cible.y=Math.min(d.from.y,p.y);cible.w=Math.abs(p.x-d.from.x);cible.h=Math.abs(p.y-d.from.y)}
 else if(d.mode==='move'){cible.x=Math.max(0,Math.min(100-d.orig.w,d.orig.x+p.x-d.from.x));cible.y=Math.max(0,Math.min(100-d.orig.h,d.orig.y+p.y-d.from.y))}
 else{const o=d.orig,est=d.grip.includes('e'),sud=d.grip.includes('s');
  const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
  cible.x=Math.min(x1,x2);cible.w=Math.abs(x2-x1);cible.y=Math.min(y1,y2);cible.h=Math.abs(y2-y1)}
 renderCanvas()});
$('map-canvas').addEventListener('pointerup',()=>{if(!mapDrag)return;const d=mapDrag;mapDrag=null;
 // Un glisser ferme le contour à main levée ; une suite de clics attend Entrée.
 if(d.mode==='lasso'){if(d.bouge&&lasso&&lasso.pts.length>=3)applyLasso();else renderCanvas();return}
 if(d.mode==='cut'){const r=cutRect;cutRect=null;
  if(r&&r.w>=1.2&&r.h>=1.2){pushUndo();
   // On ne découpe que les zones libres : une zone verrouillée résiste au grattage.
   carveWalls(w=>subtractRects(w,[r]));
   // La découpe est gardée : ses angles sont voulus droits, le lissage n'y touchera pas.
   (mapDraft.cuts||(mapDraft.cuts=[])).push({x:r.x,y:r.y,w:r.w,h:r.h})}
  else if(d.dessous){mapSel=d.dessous;mapTool='select'}
  renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render();return}
 const cible=d.kind==='foe'?null:shapeAt(d);
 if(cible&&(cible.w<1.2||cible.h<1.2)){removeShape(d);
  // Clic manqué : si une forme était dessous, on la sélectionne et on repasse en Sélection.
  if(d.dessous){mapSel=d.dessous;mapTool='select'}else{mapSel=null;undoStack.pop()}}
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
$('shape-delete').onclick=()=>{const cible=mapSel&&shapeAt(mapSel);if(!cible||cible.locked)return;
 pushUndo();removeShape(mapSel);mapSel=null;renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-key').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.keyLocked=$('door-key').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
$('foe-hidden').onchange=()=>{const f=mapSel&&mapSel.kind==='foe'&&shapeAt(mapSel);if(!f)return;
 pushUndo();f.hidden=$('foe-hidden').checked;renderCanvas();saveMaps()};

/* ---------- Zoom du plan de travail ---------- */
function applyCanvasZoom(){const c=$('map-canvas');
 const w=c.clientWidth||1,h=c.clientHeight||1;
 if(zoomC<=1){panCX=(1-zoomC)*w/2;panCY=(1-zoomC)*h/2}
 else{panCX=Math.min(0,Math.max(-(zoomC-1)*w,panCX));panCY=Math.min(0,Math.max(-(zoomC-1)*h,panCY))}
 c.style.transform='translate('+panCX+'px,'+panCY+'px) scale('+zoomC+')';
 $('czoom-label').textContent=Math.round(zoomC*100)+' %'}
function zoomCanvasAt(facteur,cx,cy){const z=Math.min(8,Math.max(.4,zoomC*facteur));
 panCX=cx-(cx-panCX)*z/zoomC;panCY=cy-(cy-panCY)*z/zoomC;zoomC=z;applyCanvasZoom()}
$('czoom-in').onclick=()=>{const c=$('map-canvas');zoomCanvasAt(1.25,c.clientWidth/2,c.clientHeight/2)};
$('czoom-out').onclick=()=>{const c=$('map-canvas');zoomCanvasAt(1/1.25,c.clientWidth/2,c.clientHeight/2)};
$('czoom-reset').onclick=()=>{zoomC=1;panCX=panCY=0;applyCanvasZoom()};
const wrap=document.querySelector('.canvas-wrap');
wrap.addEventListener('wheel',e=>{const r=$('map-canvas').getBoundingClientRect();
 // Le pincement du trackpad arrive en molette avec ctrlKey : c'est le zoom du système.
 if(e.ctrlKey||e.metaKey){e.preventDefault();zoomCanvasAt(Math.exp(-e.deltaY*.0035),e.clientX-r.left,e.clientY-r.top);return}
 if(zoomC>1){e.preventDefault();panCX-=e.deltaX;panCY-=e.deltaY;applyCanvasZoom()}},{passive:false});
let gestC=1;
wrap.addEventListener('gesturestart',e=>{e.preventDefault();gestC=zoomC});
wrap.addEventListener('gesturechange',e=>{e.preventDefault();const r=$('map-canvas').getBoundingClientRect();
 zoomCanvasAt(gestC*e.scale/zoomC,e.clientX-r.left,e.clientY-r.top)});

/* ---------- Accès depuis la table de jeu ---------- */
const mapPick=document.createElement('select');mapPick.id='map-pick';mapPick.setAttribute('aria-label','Carte de combat');
mapPick.style.width='auto';mapPick.style.margin='0';
const mapOpen=document.createElement('button');mapOpen.id='map-open';mapOpen.textContent='Ouvrir la carte';
document.querySelector('.mj-tools').append(mapPick,mapOpen);
function refreshMapPick(){mapPick.replaceChildren();maps.forEach(m=>mapPick.add(new Option(m.name,m.id)));
 mapPick.hidden=mapOpen.hidden=!maps.length;refreshGmBar();
 if(currentMapId)mapPick.value=currentMapId}
mapOpen.onclick=()=>{if(mapPick.value)openBattleMap(mapPick.value)};
/* Trois icônes réservées au MJ dans la barre de la carte : remettre le brouillard,
   lever le voile, et geler les déplacements le temps de décrire une scène. */
const fogBar=document.createElement('div');fogBar.className='zoom-bar';fogBar.id='fog-bar';fogBar.hidden=true;
const icone=(id,glyphe,titre)=>{const b=document.createElement('button');b.id=id;b.className='icon-btn';
 b.textContent=glyphe;b.title=titre;b.setAttribute('aria-label',titre);return b};
const fogReset=icone('fog-reset','🌫','Remettre le brouillard');
const fogAll=icone('fog-all','👁','Tout révéler');
const lockBtn=icone('token-lock','🔓','Figer les déplacements des joueurs');
fogBar.append(fogReset,fogAll,lockBtn);document.querySelector('.mapbar .zoom-bar').after(fogBar);
fogReset.onclick=()=>resetFog(false);
fogAll.onclick=()=>{const m=currentMap();if(!m)return;
 m.fogOff=!m.fogOff;fogKey='';render();scheduleSave();
 log(m.fogOff?'Voile levé : toute la carte est visible.':'Brouillard rétabli.')};
lockBtn.onclick=()=>{tokensLocked=!tokensLocked;refreshGmBar();render();scheduleSave();
 document.dispatchEvent(new Event('amertume-content-changed'));
 log(tokensLocked?'Déplacements figés : les joueurs ne peuvent plus bouger leurs tokens.':'Déplacements rendus aux joueurs.')};
// L'état des icônes se lit d'un coup d'œil : voile levé, déplacements gelés.
function refreshGmBar(){const m=currentMap(),mj=view==='mj';
 fogBar.hidden=!mj;fogReset.hidden=fogAll.hidden=!m;
 fogAll.classList.toggle('on',!!(m&&m.fogOff));
 fogAll.title=m&&m.fogOff?'Rétablir le brouillard':'Tout révéler';
 lockBtn.textContent=tokensLocked?'🔒':'🔓';lockBtn.classList.toggle('on',tokensLocked);
 lockBtn.title=tokensLocked?'Rendre les déplacements aux joueurs':'Figer les déplacements des joueurs'}
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}

// L'onglet Cartes n'existe que pour le MJ ; passer en vue joueur ramène à la table.
const renderBeforeMaps=render;render=function(){computeFog();renderBeforeMaps();renderMapLayer();
 tabsMJ.forEach(b=>b.hidden=view!=='mj');
 if(view!=='mj'&&PAGES.some(x=>x!=='table'&&document.body.classList.contains('page-'+x)))showPage('table')};
window.addEventListener('resize',()=>{if(document.body.classList.contains('page-maps'))renderCanvas();
 else{applyMapRatio();applyMapZoom();render()}});
maps.forEach(ensure);refreshMapPick();renderMapLayer();refreshHistory();renderCatalogPages();
tabsMJ.forEach(b=>b.hidden=view!=='mj');
