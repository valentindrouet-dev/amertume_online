/* Cartes de combat : onglet MJ pleine page pour tracer zones de blocage, zones de vision
   qui les creusent, portes, zone de départ et adversaires pré-placés.
   Les formes sont des rectangles en pourcentages de la carte. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null,cutRect=null;
let undoStack=[],redoStack=[],zoomC=1,panCX=0,panCY=0;
const nsSVG='http://www.w3.org/2000/svg';
const FOG_W=104,FOG_H=58,FOG_N=FOG_W*FOG_H;let fogVis=null;
const KINDS={wall:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire'};
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
// Obstacles du moteur : la carte ouverte fait foi, sinon le plan schématique de départ.
function activeObstacles(){const m=currentMap();return m?obstaclesFrom(m):$('map').classList.contains('custom')?[]:WALLS}
// Nomme l'obstacle qui coupe la vue, pour que le MJ sache s'il peut l'ouvrir.
function obstacleLabel(a,b){const m=currentMap();
 return m&&wallsBetween(a,b,(m.doors||[]).filter(d=>!d.open).map(rectPolygon))?'une porte fermée':'un mur'}

/* ---------- Brouillard de guerre ---------- */
// Seuls les héros vivants éclairent. La mémoire de l'exploration vit sur la carte.
function computeFog(){const m=currentMap();
 if(!m){fogVis=null;return}
 fogVis=visibleCells(actors.filter(a=>a.hero&&alive(a)),activeObstacles(),FOG_W,FOG_H);
 if(typeof m.seen!=='string'||m.seen.length!==FOG_N)m.seen='0'.repeat(FOG_N);
 let out='',change=false;
 for(let k=0;k<FOG_N;k++){const deja=m.seen[k]==='1',v=fogVis[k]===1||deja;out+=v?'1':'0';if(v!==deja)change=true}
 if(change)m.seen=out}
// Un adversaire dans le noir n'existe pas pour les joueurs.
function partySees(a){if(!fogVis)return true;
 const i=Math.min(FOG_W-1,Math.max(0,Math.floor(a.x/100*FOG_W))),j=Math.min(FOG_H-1,Math.max(0,Math.floor(a.y/100*FOG_H)));
 return fogVis[j*FOG_W+i]===1}
function renderFog(){const cv=$('fog'),m=currentMap();
 if(!m||!fogVis){cv.style.display='none';return}
 cv.style.display='';if(cv.width!==FOG_W){cv.width=FOG_W;cv.height=FOG_H}
 const ctx=cv.getContext('2d'),img=ctx.createImageData(FOG_W,FOG_H);
 // Le MJ garde une vue lisible ; le joueur ne voit rien de l'inexploré.
 const inconnu=view==='mj'?110:255,memoire=view==='mj'?40:150;
 for(let k=0;k<FOG_N;k++){const p=k*4;img.data[p]=6;img.data[p+1]=9;img.data[p+2]=11;
  img.data[p+3]=fogVis[k]?0:(m.seen[k]==='1'?memoire:inconnu)}
 ctx.putImageData(img,0,0)}
function resetFog(tout){const m=currentMap();if(!m)return;
 m.seen=(tout?'1':'0').repeat(FOG_N);render();scheduleSave();
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
function renderMapLayer(){const svg=$('map-shapes'),m=currentMap();svg.replaceChildren();applyMapRatio();renderFog();
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 // Les zones sont déjà découpées dans les données : ce que l'on voit est ce qui bloque.
 const g=document.createElementNS(nsSVG,'g');g.setAttribute('class','wall-group');
 (m.walls||[]).filter(r=>r.w>0&&r.h>0).forEach(r=>g.append(svgRect(r)));svg.append(g);
 (m.doors||[]).forEach(d=>{const el=svgRect(d,'door'+(d.open?' open':''));
  if(view==='mj'){el.style.pointerEvents='auto';
   el.onclick=()=>{d.open=!d.open;log('Porte '+(d.open?'ouverte':'fermée')+'.');render();scheduleSave()}}
  svg.append(el)});
}

/* ---------- Ouverture d'une carte en combat ---------- */
function openBattleMap(id){const m=maps.find(x=>x.id===id);if(!m)return;
 if(!confirm('Ouvrir « '+m.name+' » ? Les héros sont regroupés dans la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.'))return;
 currentMapId=id;mapImage=m.image||null;
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 const heros=actors.filter(a=>a.hero);
 if(m.start)spreadInZone(heros.length,m.start).forEach((p,i)=>moveActor(heros[i],p.x,p.y));
 actors.splice(0,actors.length,...heros);
 // Une carte s'ouvre portes closes et brouillard intact : l'état des portes est une affaire de partie.
 (m.doors||[]).forEach(d=>{d.open=false});m.seen='0'.repeat(FOG_N);
 (m.foes||[]).forEach(f=>{const a=fromMonster(f.tpl);a.hidden=!!f.hidden;a.x=f.x;a.y=f.y;normalizeActor(a);actors.push(a)});
 actors.forEach(a=>{a.target=null});
 owner=actors.findIndex(a=>a.hero);selected=Math.max(0,owner);
 resetMapZoom();showPage('table');render();
 log('Carte « '+m.name+' » ouverte : '+heros.length+' héros placés, '+(m.foes||[]).length+' adversaire(s) en place.');scheduleSave()}

/* ---------- Onglets de page, réservés au MJ ---------- */
const tabs=document.createElement('nav');tabs.className='tabs';
tabs.innerHTML='<button data-page="table" class="on">Table de jeu</button><button data-page="maps">Cartes</button>';
document.querySelector('.view-controls').before(tabs);
const tabMaps=tabs.querySelector('[data-page="maps"]');
function showPage(p){if(p==='maps'&&view!=='mj')return;
 document.body.classList.toggle('page-maps',p==='maps');
 tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.page===p));
 if(p==='maps'){if(!maps.length)newMap();if(!mapDraft)mapDraft=maps.find(m=>m.id===currentMapId)||maps[0];renderMapList();renderCanvas()}
 // De retour sur la table, la carte est remesurée : elle était masquée, donc sans largeur.
 else{applyMapRatio();applyMapZoom()}}
tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));

/* ---------- Page de l'éditeur ---------- */
const mapsPage=document.createElement('main');mapsPage.id='maps-page';
mapsPage.innerHTML=
 '<aside class="maps-side panel"><h2>Cartes</h2><div id="map-list"></div>'
 +'<div class="side-actions"><button id="map-new" class="primary">+ Nouvelle carte</button><button id="map-copy">Dupliquer</button><button id="map-del">Supprimer</button></div></aside>'
 +'<section class="maps-main panel"><div class="maps-bar"><label class="grow">Nom de la carte<input id="map-name" maxlength="80"></label>'
 +'<button id="map-image">Image de fond</button><button id="map-image-clear">Retirer l’image</button><button id="map-play" class="primary">Ouvrir en combat</button></div>'
 +'<input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="tool-bar" id="map-tools"><button data-tool="select">Sélection</button><button data-tool="wall">Zone de blocage</button>'
 +'<button data-tool="cut">Découper</button><button data-tool="door">Porte</button><button data-tool="start">Zone de départ</button>'
 +'<button data-tool="foe">Adversaire</button><select id="map-foe-tpl" aria-label="Modèle d’adversaire"></select>'
 +'<span class="bar-sep"></span><button id="undo" title="Annuler (⌘Z)">↶ Annuler</button><button id="redo" title="Rétablir (⇧⌘Z)">↷ Rétablir</button>'
 +'<span class="bar-sep"></span><button id="czoom-out" aria-label="Dézoomer">−</button><span id="czoom-label" class="muted">100 %</span>'
 +'<button id="czoom-in" aria-label="Zoomer">+</button><button id="czoom-reset">Ajuster</button></div>'
 +'<div class="canvas-wrap"><div id="map-canvas"></div></div><p class="muted" id="map-hint"></p></section>'
 +'<aside class="maps-props panel"><h2>Forme sélectionnée</h2><p class="muted" id="shape-label">Aucune sélection.</p>'
 +'<button id="shape-lock" hidden>🔒 Verrouiller</button>'
  +'<label id="foe-hidden-label" hidden><input type="checkbox" id="foe-hidden"> Invisible à l’ouverture</label>'
 +'<button id="shape-delete" hidden>Supprimer la forme</button><div class="divider"></div><h2>Légende</h2>'
 +'<ul class="legend"><li><i class="sw-wall"></i>Zone de blocage — coupe la vue et le passage</li>'
 +'<li><i class="sw-cut"></i>Découper — creuse une ouverture dans les zones de blocage</li>'
 +'<li><i class="sw-door"></i>Porte — close au début du combat, un clic du MJ l’ouvre en jeu</li>'
 +'<li><i class="sw-start"></i>Zone de départ des héros</li>'
 +'<li><i class="sw-foe"></i>Adversaire pré-placé</li></ul><p class="muted" id="map-count"></p></aside>';
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
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps'))return;
 if(e.key!=='Delete'&&e.key!=='Backspace')return;
 if(e.target.closest('input,textarea,select'))return;
 const cible=mapSel&&shapeAt(mapSel);if(!cible||cible.locked)return;
 e.preventDefault();pushUndo();removeShape(mapSel);mapSel=null;
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});

/* ---------- Cartes ---------- */
function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,ratio:16/9,walls:[],doors:[],start:null,foes:[]};
 maps.push(m);mapDraft=m;mapSel=null;undoStack=[];redoStack=[];return m}
function ensure(m){m.walls??=[];m.doors??=[];m.foes??=[];m.ratio??=16/9;
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
$('map-image').onclick=()=>$('map-file').click();
$('map-file').onchange=()=>{const f=$('map-file').files[0];$('map-file').value='';
 // Le rapport de l'image devient celui de la carte : le tracé et le jeu voient le même cadrage.
 if(f)openImage(f,'map',url=>{pushUndo();mapDraft.image=url;const img=new Image();
  img.onload=()=>{if(img.naturalHeight)mapDraft.ratio=img.naturalWidth/img.naturalHeight;
   renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
  img.onerror=()=>{renderCanvas();saveMaps()};img.src=url})};
$('map-image-clear').onclick=()=>{if(mapDraft){pushUndo();mapDraft.image=null;renderCanvas();saveMaps()}};
$('map-play').onclick=()=>{if(mapDraft)openBattleMap(mapDraft.id)};
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;renderCanvas()});

function renderMapList(){$('map-list').replaceChildren(...maps.map(m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');
 const nom=document.createElement('strong');nom.textContent=m.name;
 const det=document.createElement('small');ensure(m);
 det.textContent=m.walls.length+' zone(s) · '+m.doors.length+' porte(s) · '+m.foes.length+' adversaire(s)';
 b.append(nom,det);b.onclick=()=>{mapDraft=m;mapSel=null;undoStack=[];redoStack=[];renderMapList();renderCanvas()};return b}));
 if(mapDraft)$('map-name').value=mapDraft.name;
 $('map-foe-tpl').replaceChildren();catalog.monsters.forEach((m,i)=>$('map-foe-tpl').add(new Option(m.name,String(i))))}

const HINTS={select:'Clique une forme pour la sélectionner, glisse pour la déplacer, tire un coin pour la redimensionner. ⌘Z annule.',
 wall:'Trace un rectangle : il coupe la vue et le passage. Un clic simple sur une forme existante la sélectionne. Suppr efface la sélection.',
 cut:'Trace un rectangle à l’intérieur d’une zone de blocage : la découpe y creuse une ouverture définitive, vue et passage rétablis.',
 door:'Trace une porte. Elle démarre close à chaque ouverture de la carte ; c’est en partie que le MJ l’ouvre ou la ferme d’un clic.',
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
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 m.walls.forEach((r,i)=>c.append(shapeEl('wall',i,r)));
 m.doors.forEach((r,i)=>c.append(shapeEl('door',i,r)));
 if(cutRect)c.append(shapeEl('cut',0,cutRect));
 if(m.start)c.append(shapeEl('start',0,m.start));
 m.foes.forEach((f,i)=>c.append(foeEl(i,f)));
 const cible=mapSel?shapeAt(mapSel):null;
 const adv=mapSel&&mapSel.kind==='foe'?cible:null;
 $('foe-hidden-label').hidden=!adv;
 $('shape-delete').hidden=!mapSel||!!(cible&&cible.locked);$('shape-lock').hidden=!mapSel;
 if(cible)$('shape-lock').textContent=cible.locked?'🔓 Déverrouiller':'🔒 Verrouiller';
 if(adv)$('foe-hidden').checked=!!adv.hidden;
 $('shape-label').textContent=mapSel?KINDS[mapSel.kind]+(adv?' · '+adv.tpl.name:'')+(cible&&cible.locked?' · verrouillée':''):'Aucune sélection.';
 $('map-count').textContent=m.walls.length+' zone(s) de blocage, '+m.doors.length+' porte(s), '
  +m.foes.length+' adversaire(s)'+(m.start?', zone de départ définie.':', aucune zone de départ.');
 refreshHistory()}
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(r.locked?' locked':'')
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
function shapeAt(d){const m=mapDraft;if(!m)return null;if(d.kind==='cut')return cutRect;
 return d.kind==='start'?m.start:(d.kind==='wall'?m.walls:d.kind==='door'?m.doors:m.foes)[d.i]}
function removeShape(d){const m=mapDraft;
 if(d.kind==='start')m.start=null;
 else (d.kind==='wall'?m.walls:d.kind==='door'?m.doors:m.foes).splice(d.i,1)}

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
 if(mapTool==='cut'){cutRect={x:p.x,y:p.y,w:0,h:0};mapSel=null;
  mapDrag={mode:'cut',kind:'cut',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Outil de dessin : on trace. Un clic sans glisser sélectionne la forme sous le curseur.
 pushUndo();const rect={x:p.x,y:p.y,w:0,h:0,locked:false};
 if(mapTool==='wall'){mapDraft.walls.push(rect);mapSel={kind:'wall',i:mapDraft.walls.length-1}}
 else if(mapTool==='door'){rect.open=false;mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 mapDrag={mode:'create',kind:mapTool,i:mapSel.i,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
$('map-canvas').addEventListener('pointermove',e=>{if(!mapDrag)return;const p=pct(e),d=mapDrag,cible=shapeAt(d);if(!cible)return;
 if(d.kind==='foe'){cible.x=p.x;cible.y=p.y}
 else if(d.mode==='create'||d.mode==='cut'){cible.x=Math.min(d.from.x,p.x);cible.y=Math.min(d.from.y,p.y);cible.w=Math.abs(p.x-d.from.x);cible.h=Math.abs(p.y-d.from.y)}
 else if(d.mode==='move'){cible.x=Math.max(0,Math.min(100-d.orig.w,d.orig.x+p.x-d.from.x));cible.y=Math.max(0,Math.min(100-d.orig.h,d.orig.y+p.y-d.from.y))}
 else{const o=d.orig,est=d.grip.includes('e'),sud=d.grip.includes('s');
  const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
  cible.x=Math.min(x1,x2);cible.w=Math.abs(x2-x1);cible.y=Math.min(y1,y2);cible.h=Math.abs(y2-y1)}
 renderCanvas()});
$('map-canvas').addEventListener('pointerup',()=>{if(!mapDrag)return;const d=mapDrag;mapDrag=null;
 if(d.mode==='cut'){const r=cutRect;cutRect=null;
  if(r&&r.w>=1.2&&r.h>=1.2){pushUndo();
   // On ne découpe que les zones libres : une zone verrouillée résiste au grattage.
   const libres=mapDraft.walls.filter(w=>!w.locked),verrous=mapDraft.walls.filter(w=>w.locked);
   mapDraft.walls=[...verrous,...subtractRects(libres,[r])]}
  else if(d.dessous){mapSel=d.dessous;mapTool='select'}
  renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render();return}
 const cible=d.kind==='foe'?null:shapeAt(d);
 if(cible&&(cible.w<1.2||cible.h<1.2)){removeShape(d);
  // Clic manqué : si une forme était dessous, on la sélectionne et on repasse en Sélection.
  if(d.dessous){mapSel=d.dessous;mapTool='select'}else{mapSel=null;undoStack.pop()}}
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
$('shape-delete').onclick=()=>{const cible=mapSel&&shapeAt(mapSel);if(!cible||cible.locked)return;
 pushUndo();removeShape(mapSel);mapSel=null;renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
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
 mapPick.hidden=mapOpen.hidden=!maps.length;$('fog-reset').hidden=$('fog-all').hidden=!currentMap();
 if(currentMapId)mapPick.value=currentMapId}
mapOpen.onclick=()=>{if(mapPick.value)openBattleMap(mapPick.value)};
const fogReset=document.createElement('button');fogReset.id='fog-reset';fogReset.textContent='Réinitialiser le brouillard';
const fogAll=document.createElement('button');fogAll.id='fog-all';fogAll.textContent='Tout révéler';
document.querySelector('.mj-tools').append(fogReset,fogAll);
fogReset.onclick=()=>resetFog(false);fogAll.onclick=()=>resetFog(true);
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}

// L'onglet Cartes n'existe que pour le MJ ; passer en vue joueur ramène à la table.
const renderBeforeMaps=render;render=function(){computeFog();renderBeforeMaps();renderMapLayer();
 tabMaps.hidden=view!=='mj';if(view!=='mj'&&document.body.classList.contains('page-maps'))showPage('table')};
window.addEventListener('resize',()=>{if(document.body.classList.contains('page-maps'))renderCanvas();
 else{applyMapRatio();applyMapZoom();render()}});
maps.forEach(ensure);refreshMapPick();renderMapLayer();refreshHistory();tabMaps.hidden=view!=='mj';
