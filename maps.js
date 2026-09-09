/* Cartes de combat : onglet MJ pleine page pour tracer zones, portes, zone de départ
   et adversaires pré-placés. Les formes sont des rectangles en pourcentages de la carte. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null,playRatio='16/9';
const nsSVG='http://www.w3.org/2000/svg';
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
// Obstacles du moteur : la carte ouverte fait foi, sinon le plan schématique de départ.
function activeObstacles(){const m=currentMap();return m?obstaclesFrom(m):$('map').classList.contains('custom')?[]:WALLS}
// Nomme l'obstacle qui coupe la vue, pour que le MJ sache s'il peut l'ouvrir.
function obstacleLabel(a,b){const m=currentMap();
 return m&&wallsBetween(a,b,(m.doors||[]).filter(d=>!d.open).map(rectPolygon))?'une porte fermée':'un mur'}

/* ---------- Rendu sur la table de jeu ---------- */
function svgRect(r,cls){const el=document.createElementNS(nsSVG,'rect');
 el.setAttribute('x',r.x+'%');el.setAttribute('y',r.y+'%');el.setAttribute('width',r.w+'%');el.setAttribute('height',r.h+'%');
 if(cls)el.setAttribute('class',cls);return el}
function renderMapLayer(){const svg=$('map-shapes'),m=currentMap();svg.replaceChildren();
 const jeu=$('map').getBoundingClientRect();if(jeu.width&&jeu.height)playRatio=jeu.width+'/'+jeu.height;
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 const g=document.createElementNS(nsSVG,'g');g.setAttribute('class','wall-group');
 (m.walls||[]).forEach(r=>g.append(svgRect(r)));svg.append(g);
 (m.doors||[]).forEach(d=>{const el=svgRect(d,'door'+(d.open?' open':''));
  if(view==='mj'){el.style.pointerEvents='auto';
   el.onclick=()=>{d.open=!d.open;log('Porte '+(d.open?'ouverte':'fermée')+'.');render();scheduleSave()}}
  svg.append(el)});
}

/* ---------- Ouverture d'une carte en combat ---------- */
function openBattleMap(id){const m=maps.find(x=>x.id===id);if(!m)return;
 if(!confirm('Ouvrir « '+m.name+' » ? Les héros sont regroupés dans la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.'))return;
 currentMapId=id;mapImage=m.image||null;
 $('map').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 const heros=actors.filter(a=>a.hero);
 if(m.start)spreadInZone(heros.length,m.start).forEach((p,i)=>moveActor(heros[i],p.x,p.y));
 actors.splice(0,actors.length,...heros);
 (m.foes||[]).forEach(f=>{const a=fromMonster(f.tpl);a.hidden=!!f.hidden;a.x=f.x;a.y=f.y;normalizeActor(a);actors.push(a)});
 actors.forEach(a=>{a.target=null});
 owner=actors.findIndex(a=>a.hero);selected=Math.max(0,owner);
 showPage('table');render();
 log('Carte « '+m.name+' » ouverte : '+heros.length+' héros placés, '+(m.foes||[]).length+' adversaire(s) en place.');scheduleSave()}

/* ---------- Onglets de page, réservés au MJ ---------- */
const tabs=document.createElement('nav');tabs.className='tabs';
tabs.innerHTML='<button data-page="table" class="on">Table de jeu</button><button data-page="maps">Cartes</button>';
document.querySelector('.view-controls').before(tabs);
const tabMaps=tabs.querySelector('[data-page="maps"]');
function showPage(p){if(p==='maps'&&view!=='mj')return;
 document.body.classList.toggle('page-maps',p==='maps');
 tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.page===p));
 if(p==='maps'){if(!maps.length)newMap();if(!mapDraft)mapDraft=maps.find(m=>m.id===currentMapId)||maps[0];renderMapList();renderCanvas()}}
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
 +'<button data-tool="door">Porte</button><button data-tool="start">Zone de départ</button><button data-tool="foe">Adversaire</button>'
 +'<select id="map-foe-tpl" aria-label="Modèle d’adversaire"></select></div>'
 +'<div class="canvas-wrap"><div id="map-canvas"></div></div><p class="muted" id="map-hint"></p></section>'
 +'<aside class="maps-props panel"><h2>Forme sélectionnée</h2><p class="muted" id="shape-label">Aucune sélection.</p>'
 +'<label id="door-open-label" hidden><input type="checkbox" id="door-open"> Porte ouverte</label>'
 +'<label id="foe-hidden-label" hidden><input type="checkbox" id="foe-hidden"> Invisible à l’ouverture</label>'
 +'<button id="shape-delete" hidden>Supprimer la forme</button><div class="divider"></div><h2>Légende</h2>'
 +'<ul class="legend"><li><i class="sw-wall"></i>Zone de blocage — coupe la vue et le passage</li>'
 +'<li><i class="sw-door"></i>Porte fermée — un clic du MJ l’ouvre en jeu</li>'
 +'<li><i class="sw-door-open"></i>Porte ouverte — laisse tout passer</li>'
 +'<li><i class="sw-start"></i>Zone de départ des héros</li>'
 +'<li><i class="sw-foe"></i>Adversaire pré-placé</li></ul><p class="muted" id="map-count"></p></aside>';
document.querySelector('main.layout').after(mapsPage);

function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,walls:[],doors:[],start:null,foes:[]};
 maps.push(m);mapDraft=m;mapSel=null;return m}
$('map-new').onclick=()=>{newMap();renderMapList();renderCanvas();saveMaps()};
$('map-copy').onclick=()=>{if(!mapDraft)return;const c=structuredClone(mapDraft);c.id=crypto.randomUUID();c.name=mapDraft.name+' (copie)';
 maps.push(c);mapDraft=c;mapSel=null;renderMapList();renderCanvas();saveMaps()};
$('map-del').onclick=()=>{if(!mapDraft||!confirm('Supprimer « '+mapDraft.name+' » ?'))return;
 const i=maps.indexOf(mapDraft);maps.splice(i,1);if(currentMapId===mapDraft.id)currentMapId=null;
 mapDraft=maps[Math.max(0,i-1)]||null;mapSel=null;if(!maps.length)newMap();renderMapList();renderCanvas();saveMaps();render()};
$('map-name').oninput=()=>{if(mapDraft){mapDraft.name=$('map-name').value;renderMapList();saveMaps()}};
$('map-image').onclick=()=>$('map-file').click();
$('map-file').onchange=()=>{const f=$('map-file').files[0];$('map-file').value='';
 if(f)openImage(f,'map',url=>{mapDraft.image=url;renderCanvas();saveMaps()})};
$('map-image-clear').onclick=()=>{if(mapDraft){mapDraft.image=null;renderCanvas();saveMaps()}};
$('map-play').onclick=()=>{if(mapDraft)openBattleMap(mapDraft.id)};
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;mapSel=null;renderCanvas()});

function renderMapList(){$('map-list').replaceChildren(...maps.map(m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');
 const nom=document.createElement('strong');nom.textContent=m.name;
 const det=document.createElement('small');det.textContent=(m.walls||[]).length+' zone(s) · '+(m.doors||[]).length+' porte(s) · '+(m.foes||[]).length+' adversaire(s)'+(m.id===currentMapId?' · en jeu':'');
 b.append(nom,det);b.onclick=()=>{mapDraft=m;mapSel=null;renderMapList();renderCanvas()};return b}));
 if(mapDraft)$('map-name').value=mapDraft.name;
 $('map-foe-tpl').replaceChildren();catalog.monsters.forEach((m,i)=>$('map-foe-tpl').add(new Option(m.name,String(i))))}

const HINTS={select:'Clique une forme pour la sélectionner, glisse pour la déplacer, tire un coin pour la redimensionner.',
 wall:'Trace un rectangle : il coupe la vue et le passage. Deux rectangles qui se chevauchent se fondent en une seule zone sur la table.',
 door:'Trace une porte. Fermée elle bloque, ouverte elle laisse passer tokens et vision. En jeu, un clic du MJ l’ouvre ou la ferme.',
 start:'Trace la zone où les héros seront regroupés à l’ouverture de la carte. Une seule par carte.',
 foe:'Clique pour poser l’adversaire choisi à droite de la barre. Il pourra être invisible à l’ouverture.'};
function renderCanvas(){const c=$('map-canvas'),m=mapDraft;$('map-hint').textContent=HINTS[mapTool]||'';
 document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===mapTool));
 c.style.aspectRatio=playRatio;c.replaceChildren();if(!m)return;
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 (m.walls||[]).forEach((r,i)=>c.append(shapeEl('wall',i,r)));
 (m.doors||[]).forEach((r,i)=>c.append(shapeEl('door',i,r)));
 if(m.start)c.append(shapeEl('start',0,m.start));
 (m.foes||[]).forEach((f,i)=>c.append(foeEl(i,f)));
 const porte=mapSel&&mapSel.kind==='door'?m.doors[mapSel.i]:null,adv=mapSel&&mapSel.kind==='foe'?m.foes[mapSel.i]:null;
 $('door-open-label').hidden=!porte;$('foe-hidden-label').hidden=!adv;$('shape-delete').hidden=!mapSel;
 if(porte)$('door-open').checked=!!porte.open;
 if(adv)$('foe-hidden').checked=!!adv.hidden;
 $('shape-label').textContent=mapSel?({wall:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire'})[mapSel.kind]+(adv?' · '+adv.tpl.name:''):'Aucune sélection.';
 $('map-count').textContent=(m.walls||[]).length+' zone(s), '+(m.doors||[]).length+' porte(s), '+(m.foes||[]).length+' adversaire(s)'+(m.start?', zone de départ définie.':', aucune zone de départ.')}
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(kind==='door'&&r.open?' open':'')+(mapSel&&mapSel.kind===kind&&mapSel.i===i?' selected':'');
 el.style.left=r.x+'%';el.style.top=r.y+'%';el.style.width=r.w+'%';el.style.height=r.h+'%';
 el.dataset.kind=kind;el.dataset.i=i;
 ['nw','ne','sw','se'].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;el.append(h)});
 return el}
function foeEl(i,f){const el=document.createElement('div');
 el.className='shape foe'+(f.hidden?' hidden-foe':'')+(mapSel&&mapSel.kind==='foe'&&mapSel.i===i?' selected':'');
 el.style.left=f.x+'%';el.style.top=f.y+'%';el.dataset.kind='foe';el.dataset.i=i;
 el.textContent=(f.tpl.name||'?')[0];el.title=f.tpl.name+(f.hidden?' (invisible à l’ouverture)':'');return el}

const pct=e=>{const r=$('map-canvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,100*(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(e.clientY-r.top)/r.height))}};
function shapeAt(d){return d.kind==='wall'?mapDraft.walls[d.i]:d.kind==='door'?mapDraft.doors[d.i]:d.kind==='start'?mapDraft.start:mapDraft.foes[d.i]}
$('map-canvas').addEventListener('pointerdown',e=>{if(!mapDraft)return;
 const grip=e.target.dataset.grip,p=pct(e);
 // Un outil de dessin trace toujours une nouvelle forme, même au-dessus d'une existante ;
 // seul l'outil Sélection déplace, et les poignées redimensionnent en toutes circonstances.
 const forme=(mapTool==='select'||grip)?e.target.closest('.shape'):null;
 if(forme){const kind=forme.dataset.kind,i=Number(forme.dataset.i);mapSel={kind,i};
  mapDrag={mode:grip?'resize':'move',kind,i,grip,orig:structuredClone(shapeAt({kind,i})),from:p};
  $('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 if(mapTool==='foe'){const t=catalog.monsters[Number($('map-foe-tpl').value)];if(!t)return;
  mapDraft.foes.push({tpl:structuredClone(t),x:p.x,y:p.y,hidden:false});mapSel={kind:'foe',i:mapDraft.foes.length-1};renderCanvas();saveMaps();return}
 if(mapTool==='select'){mapSel=null;renderCanvas();return}
 const rect={x:p.x,y:p.y,w:0,h:0};
 if(mapTool==='wall'){mapDraft.walls.push(rect);mapSel={kind:'wall',i:mapDraft.walls.length-1}}
 else if(mapTool==='door'){rect.open=false;mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 mapDrag={mode:'create',kind:mapTool,i:mapSel.i,from:p};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
$('map-canvas').addEventListener('pointermove',e=>{if(!mapDrag)return;const p=pct(e),d=mapDrag,cible=shapeAt(d);if(!cible)return;
 if(d.kind==='foe'){cible.x=p.x;cible.y=p.y}
 else if(d.mode==='create'){cible.x=Math.min(d.from.x,p.x);cible.y=Math.min(d.from.y,p.y);cible.w=Math.abs(p.x-d.from.x);cible.h=Math.abs(p.y-d.from.y)}
 else if(d.mode==='move'){cible.x=Math.max(0,Math.min(100-d.orig.w,d.orig.x+p.x-d.from.x));cible.y=Math.max(0,Math.min(100-d.orig.h,d.orig.y+p.y-d.from.y))}
 else{const o=d.orig,est=d.grip.includes('e'),sud=d.grip.includes('s');
  const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
  cible.x=Math.min(x1,x2);cible.w=Math.abs(x2-x1);cible.y=Math.min(y1,y2);cible.h=Math.abs(y2-y1)}
 renderCanvas()});
$('map-canvas').addEventListener('pointerup',()=>{if(!mapDrag)return;const d=mapDrag;mapDrag=null;
 // Une forme trop petite est un clic manqué, pas une zone : on la retire.
 const cible=d.kind==='foe'?null:shapeAt(d);
 if(cible&&(cible.w<1.2||cible.h<1.2)){if(d.kind==='wall')mapDraft.walls.splice(d.i,1);else if(d.kind==='door')mapDraft.doors.splice(d.i,1);else mapDraft.start=null;mapSel=null}
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
$('shape-delete').onclick=()=>{if(!mapSel||!mapDraft)return;
 if(mapSel.kind==='wall')mapDraft.walls.splice(mapSel.i,1);else if(mapSel.kind==='door')mapDraft.doors.splice(mapSel.i,1);
 else if(mapSel.kind==='foe')mapDraft.foes.splice(mapSel.i,1);else mapDraft.start=null;
 mapSel=null;renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-open').onchange=()=>{if(mapSel&&mapSel.kind==='door'){mapDraft.doors[mapSel.i].open=$('door-open').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()}};
$('foe-hidden').onchange=()=>{if(mapSel&&mapSel.kind==='foe'){mapDraft.foes[mapSel.i].hidden=$('foe-hidden').checked;renderCanvas();saveMaps()}};

/* ---------- Accès depuis la table de jeu ---------- */
const mapPick=document.createElement('select');mapPick.id='map-pick';mapPick.setAttribute('aria-label','Carte de combat');
mapPick.style.width='auto';mapPick.style.margin='0';
const mapOpen=document.createElement('button');mapOpen.id='map-open';mapOpen.textContent='Ouvrir la carte';
document.querySelector('.mj-tools').append(mapPick,mapOpen);
function refreshMapPick(){mapPick.replaceChildren();maps.forEach(m=>mapPick.add(new Option(m.name,m.id)));
 mapPick.hidden=mapOpen.hidden=!maps.length;if(currentMapId)mapPick.value=currentMapId}
mapOpen.onclick=()=>{if(mapPick.value)openBattleMap(mapPick.value)};
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}

// L'onglet Cartes n'existe que pour le MJ ; passer en vue joueur ramène à la table.
const renderBeforeMaps=render;render=function(){renderBeforeMaps();renderMapLayer();
 tabMaps.hidden=view!=='mj';if(view!=='mj'&&document.body.classList.contains('page-maps'))showPage('table')};
window.addEventListener('resize',()=>{if(document.body.classList.contains('page-maps'))renderCanvas()});
refreshMapPick();renderMapLayer();tabMaps.hidden=view!=='mj';
