/* Cartes de combat : éditeur de zones, portes, zone de départ et adversaires pré-placés.
   Les formes sont des rectangles en pourcentages de la carte, comme les positions des tokens. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null;
const nsSVG='http://www.w3.org/2000/svg';
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
// Obstacles du moteur : la carte ouverte fait foi, sinon le plan schématique de départ.
function activeObstacles(){const m=currentMap();return m?obstaclesFrom(m):$('map').classList.contains('custom')?[]:WALLS}

// Nomme l'obstacle qui coupe la vue, pour que le MJ sache s'il peut l'ouvrir.
function obstacleLabel(a,b){const m=currentMap();
 return m&&wallsBetween(a,b,(m.doors||[]).filter(d=>!d.open).map(rectPolygon))?'une porte fermée':'un mur'}

/* ---------- Rendu en jeu ---------- */
function svgRect(r,cls){const el=document.createElementNS(nsSVG,'rect');
 el.setAttribute('x',r.x+'%');el.setAttribute('y',r.y+'%');el.setAttribute('width',r.w+'%');el.setAttribute('height',r.h+'%');
 if(cls)el.setAttribute('class',cls);return el}
function renderMapLayer(){const svg=$('map-shapes'),m=currentMap();svg.replaceChildren();
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 const g=document.createElementNS(nsSVG,'g');g.setAttribute('class','wall-group');
 (m.walls||[]).forEach(r=>g.append(svgRect(r)));svg.append(g);
 (m.doors||[]).forEach(d=>{const el=svgRect(d,'door'+(d.open?' open':''));
  el.setAttribute('tabindex','-1');
  if(view==='mj'){el.style.pointerEvents='auto';
   el.onclick=()=>{d.open=!d.open;log('Porte '+(d.open?'ouverte':'fermée')+'.');render();scheduleSave()}}
  svg.append(el)});
}
const renderBeforeMaps=render;render=function(){renderBeforeMaps();renderMapLayer()};

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
 render();log('Carte « '+m.name+' » ouverte : '+heros.length+' héros placés, '+(m.foes||[]).length+' adversaire(s) en place.');scheduleSave()}

/* ---------- Barre d'outils MJ ---------- */
const mapPick=document.createElement('select');mapPick.id='map-pick';mapPick.setAttribute('aria-label','Carte de combat');
mapPick.style.width='auto';mapPick.style.margin='0';
const mapOpen=document.createElement('button');mapOpen.id='map-open';mapOpen.textContent='Ouvrir la carte';
const mapEdit=document.createElement('button');mapEdit.id='map-edit';mapEdit.textContent='Éditeur de cartes';
document.querySelector('.mj-tools').append(mapEdit,mapPick,mapOpen);
function refreshMapPick(){mapPick.replaceChildren();maps.forEach(m=>mapPick.add(new Option(m.name,m.id)));
 mapPick.hidden=mapOpen.hidden=!maps.length;if(currentMapId)mapPick.value=currentMapId}
mapOpen.onclick=()=>{if(mapPick.value)openBattleMap(mapPick.value)};

/* ---------- Éditeur ---------- */
const mapsDialog=dialog('maps-editor','Éditeur de cartes',
 '<div class="maps-layout"><aside><div class="toolbar"><button id="map-new">+ Carte</button><button id="map-copy">Dupliquer</button><button id="map-del">Supprimer</button></div><div id="map-list"></div></aside>'
 +'<div id="map-side"><div class="toolbar"><label style="flex:1">Nom de la carte<input id="map-name" maxlength="80"></label><button id="map-image">Image de fond</button><button id="map-image-clear">Retirer l’image</button></div>'
 +'<input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="toolbar" id="map-tools"><button data-tool="select">Sélection</button><button data-tool="wall">Zone de blocage</button><button data-tool="door">Porte</button><button data-tool="start">Zone de départ</button><button data-tool="foe">Adversaire</button><select id="map-foe-tpl" style="width:auto;margin:0"></select></div>'
 +'<div id="map-canvas"></div><p class="muted" id="map-hint"></p>'
 +'<div class="toolbar" id="map-shape-tools"><span class="muted" id="shape-label"></span><label id="door-open-label" hidden><input type="checkbox" id="door-open"> Porte ouverte</label><label id="foe-hidden-label" hidden><input type="checkbox" id="foe-hidden"> Invisible à l’ouverture</label><button id="shape-delete">Supprimer</button></div></div></div>');

mapEdit.onclick=()=>{if(view!=='mj')return;if(!maps.length)newMap();mapDraft=maps.find(m=>m.id===currentMapId)||maps[0];mapSel=null;renderMapList();renderCanvas();mapsDialog.showModal()};
function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,walls:[],doors:[],start:null,foes:[]};maps.push(m);mapDraft=m;mapSel=null;return m}
$('map-new').onclick=()=>{newMap();renderMapList();renderCanvas();saveMaps()};
$('map-copy').onclick=()=>{if(!mapDraft)return;const c=structuredClone(mapDraft);c.id=crypto.randomUUID();c.name=mapDraft.name+' (copie)';maps.push(c);mapDraft=c;mapSel=null;renderMapList();renderCanvas();saveMaps()};
$('map-del').onclick=()=>{if(!mapDraft||!confirm('Supprimer « '+mapDraft.name+' » ?'))return;
 const i=maps.indexOf(mapDraft);maps.splice(i,1);if(currentMapId===mapDraft.id)currentMapId=null;
 mapDraft=maps[Math.max(0,i-1)]||null;mapSel=null;if(!maps.length)newMap();renderMapList();renderCanvas();saveMaps();render()};
$('map-name').oninput=()=>{if(mapDraft){mapDraft.name=$('map-name').value;renderMapList();saveMaps()}};
$('map-image').onclick=()=>$('map-file').click();
$('map-file').onchange=()=>{const f=$('map-file').files[0];$('map-file').value='';
 if(f)openImage(f,'map',url=>{mapDraft.image=url;renderCanvas();saveMaps()})};
$('map-image-clear').onclick=()=>{if(mapDraft){mapDraft.image=null;renderCanvas();saveMaps()}};
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;mapSel=null;renderCanvas()});

function renderMapList(){$('map-list').replaceChildren(...maps.map(m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'');b.textContent=m.name+(m.id===currentMapId?' · ouverte':'');
 b.onclick=()=>{mapDraft=m;mapSel=null;renderMapList();renderCanvas()};return b}));
 if(mapDraft)$('map-name').value=mapDraft.name;
 $('map-foe-tpl').replaceChildren();catalog.monsters.forEach((m,i)=>$('map-foe-tpl').add(new Option(m.name,String(i))))}

const HINTS={select:'Clique une forme pour la sélectionner, glisse pour la déplacer, tire un coin pour la redimensionner.',
 wall:'Trace un rectangle : il bloque la vue et le passage. Les rectangles qui se chevauchent se fondent en une seule zone.',
 door:'Trace une porte. Fermée elle bloque, ouverte elle laisse passer tokens et vision. En jeu, un clic du MJ l’ouvre ou la ferme.',
 start:'Trace la zone où les héros seront regroupés à l’ouverture de la carte. Une seule par carte.',
 foe:'Clique pour poser l’adversaire choisi dans la liste. Il pourra être invisible à l’ouverture.'};
function renderCanvas(){const c=$('map-canvas'),m=mapDraft;$('map-hint').textContent=HINTS[mapTool]||'';
 document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.classList.toggle('primary',b.dataset.tool===mapTool));
 const jeu=$('map').getBoundingClientRect();c.style.aspectRatio=jeu.width&&jeu.height?jeu.width+'/'+jeu.height:'16/9';
 c.replaceChildren();if(!m)return;
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 (m.walls||[]).forEach((r,i)=>c.append(shapeEl('wall',i,r)));
 (m.doors||[]).forEach((r,i)=>c.append(shapeEl('door',i,r)));
 if(m.start)c.append(shapeEl('start',0,m.start));
 (m.foes||[]).forEach((f,i)=>c.append(foeEl(i,f)));
 const s=mapSel&&mapSel.kind==='door'?m.doors[mapSel.i]:null,f=mapSel&&mapSel.kind==='foe'?m.foes[mapSel.i]:null;
 $('map-shape-tools').hidden=!mapSel;
 $('door-open-label').hidden=!s;$('foe-hidden-label').hidden=!f;
 if(s)$('door-open').checked=!!s.open;
 if(f)$('foe-hidden').checked=!!f.hidden;
 $('shape-label').textContent=mapSel?({wall:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire'})[mapSel.kind]+(f?' · '+f.tpl.name:''):''}
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(kind==='door'&&r.open?' open':'')+(mapSel&&mapSel.kind===kind&&mapSel.i===i?' selected':'');
 el.style.left=r.x+'%';el.style.top=r.y+'%';el.style.width=r.w+'%';el.style.height=r.h+'%';
 el.dataset.kind=kind;el.dataset.i=i;
 ['nw','ne','sw','se'].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;el.append(h)});
 return el}
function foeEl(i,f){const el=document.createElement('div');el.className='shape foe'+(f.hidden?' hidden-foe':'')+(mapSel&&mapSel.kind==='foe'&&mapSel.i===i?' selected':'');
 el.style.left=f.x+'%';el.style.top=f.y+'%';el.dataset.kind='foe';el.dataset.i=i;el.textContent=(f.tpl.name||'?')[0];el.title=f.tpl.name;return el}

const pct=e=>{const r=$('map-canvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,100*(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(e.clientY-r.top)/r.height))}};
$('map-canvas').addEventListener('pointerdown',e=>{if(!mapDraft)return;
 const grip=e.target.dataset.grip,p=pct(e);
 // Un outil de dessin trace toujours une nouvelle forme, même au-dessus d'une existante ;
 // seul l'outil Sélection déplace, et les poignées redimensionnent en toutes circonstances.
 const forme=(mapTool==='select'||grip)?e.target.closest('.shape'):null;
 if(forme){const kind=forme.dataset.kind,i=Number(forme.dataset.i);mapSel={kind,i};
  const cible=kind==='wall'?mapDraft.walls[i]:kind==='door'?mapDraft.doors[i]:kind==='start'?mapDraft.start:mapDraft.foes[i];
  mapDrag={mode:grip?'resize':'move',kind,i,grip,orig:structuredClone(cible),from:p};
  $('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 if(mapTool==='foe'){const t=catalog.monsters[Number($('map-foe-tpl').value)];if(!t)return;
  mapDraft.foes.push({tpl:structuredClone(t),x:p.x,y:p.y,hidden:false});mapSel={kind:'foe',i:mapDraft.foes.length-1};renderCanvas();saveMaps();return}
 if(mapTool==='select')  {mapSel=null;renderCanvas();return}
 const rect={x:p.x,y:p.y,w:0,h:0};
 if(mapTool==='wall'){mapDraft.walls.push(rect);mapSel={kind:'wall',i:mapDraft.walls.length-1}}
 else if(mapTool==='door'){rect.open=false;mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 mapDrag={mode:'create',kind:mapTool,i:mapSel.i,from:p};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
$('map-canvas').addEventListener('pointermove',e=>{if(!mapDrag)return;const p=pct(e),d=mapDrag;
 const cible=d.kind==='wall'?mapDraft.walls[d.i]:d.kind==='door'?mapDraft.doors[d.i]:d.kind==='start'?mapDraft.start:mapDraft.foes[d.i];
 if(!cible)return;
 if(d.kind==='foe'){cible.x=p.x;cible.y=p.y}
 else if(d.mode==='create'){cible.x=Math.min(d.from.x,p.x);cible.y=Math.min(d.from.y,p.y);cible.w=Math.abs(p.x-d.from.x);cible.h=Math.abs(p.y-d.from.y)}
 else if(d.mode==='move'){cible.x=Math.max(0,Math.min(100-d.orig.w,d.orig.x+p.x-d.from.x));cible.y=Math.max(0,Math.min(100-d.orig.h,d.orig.y+p.y-d.from.y))}
 else{const o=d.orig,est=d.grip.includes('e'),sud=d.grip.includes('s');
  const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
  cible.x=Math.min(x1,x2);cible.w=Math.abs(x2-x1);cible.y=Math.min(y1,y2);cible.h=Math.abs(y2-y1)}
 renderCanvas()});
$('map-canvas').addEventListener('pointerup',()=>{if(!mapDrag)return;const d=mapDrag;mapDrag=null;
 // Une forme trop petite est un clic manqué, pas une zone : on la retire.
 const cible=d.kind==='wall'?mapDraft.walls[d.i]:d.kind==='door'?mapDraft.doors[d.i]:d.kind==='start'?mapDraft.start:null;
 if(cible&&(cible.w<1.2||cible.h<1.2)){if(d.kind==='wall')mapDraft.walls.splice(d.i,1);else if(d.kind==='door')mapDraft.doors.splice(d.i,1);else mapDraft.start=null;mapSel=null}
 renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()});
$('shape-delete').onclick=()=>{if(!mapSel||!mapDraft)return;
 if(mapSel.kind==='wall')mapDraft.walls.splice(mapSel.i,1);else if(mapSel.kind==='door')mapDraft.doors.splice(mapSel.i,1);
 else if(mapSel.kind==='foe')mapDraft.foes.splice(mapSel.i,1);else mapDraft.start=null;
 mapSel=null;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-open').onchange=()=>{if(mapSel&&mapSel.kind==='door'){mapDraft.doors[mapSel.i].open=$('door-open').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()}};
$('foe-hidden').onchange=()=>{if(mapSel&&mapSel.kind==='foe'){mapDraft.foes[mapSel.i].hidden=$('foe-hidden').checked;renderCanvas();saveMaps()}};
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
refreshMapPick();renderMapLayer();
