/* Cartes de combat : onglet MJ pleine page pour tracer la matière de blocage, la
   découper, poser portes, zone de départ et adversaires pré-placés.
   La matière est une couche unique de polygones exacts (voir combat.js) ; portes, zone
   de départ et adversaires restent des rectangles ou des points en pourcentages. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null,cutRect=null,lasso=null;
let undoStack=[],redoStack=[],zoomC=1,panCX=0,panCY=0;
const nsSVG='http://www.w3.org/2000/svg';
// Grille du brouillard : des cellules carrées et fines, pour un bord net qui suit les murs.
const FOG_COLS=640;let fogVis=null,fogSeen=null,fogSeenSrc=null,fogKey='',fogDim=null,fogMem=null,fogDirty=true;
function fogDims(m){const r=(m&&m.ratio)||16/9,w=FOG_COLS,h=Math.max(32,Math.round(w/r));return{w,h,n:w*h}}
const KINDS={matiere:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire',objet:'Objet',coffre:'Coffre',coupure:'Séparation de zones',lien:'Regroupement de zones'};
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
// L'éditeur et la table étirent l'image de la même façon ; encore faut-il que le cadre
// ait le bon rapport. On le relit sur l'image pour les cartes d'avant son enregistrement.
function measureRatio(m,apres){if(!m||!m.image)return;const img=new Image();
 img.onload=()=>{if(!img.naturalHeight)return;const r=img.naturalWidth/img.naturalHeight;
  if(Math.abs(r-(m.ratio||0))>1e-3){m.ratio=r;scheduleSave();if(apres)apres()}};
 img.onerror=()=>{};img.src=m.image}
/* Percer la matière de ses portes coûte quelques millisecondes : on garde le résultat
   tant que la géométrie ne bouge pas. Dessin, vue, tirs et déplacements y puisent tous,
   donc le mur peint et le mur qui arrête sont exactement le même.
   La clé résume la matière sans la recopier : nombre de sommets et somme pondérée des
   coordonnées de chaque anneau — un sommet qui bouge d'un millième la change. */
let shapeCache={cle:'',formes:[],murs:null};
function geometryKey(m){return m.id+'|'+matiereDe(m).map(p=>(p.verrou?'v':'')+p.anneaux.map(r=>
  r.length+':'+r.reduce((t,q)=>t+q[0]*7.31+q[1]*13.07,0).toFixed(4)).join(',')).join(';')
 +'|'+(m.doors||[]).map(d=>d.x+','+d.y+','+d.w+','+d.h+','+(d.a||0)+(d.open?'o':'f')+(d.secret?'s':'')+(d.decouvert?'d':'')).join(';')}
// L'éditeur redessine à chaque geste : son contour est gardé de la même façon.
let skinCache={cle:'',contours:[]};
function draftSkin(m){const cle=geometryKey(m);
 if(skinCache.cle!==cle)skinCache={cle,contours:wallShape(m).contours};
 return skinCache.contours}
function mapShapes(m){const cle=geometryKey(m);
 if(shapeCache.cle!==cle){const murs=wallShape(m);
  shapeCache={cle,murs,formes:[murs,...doorBlocks(m).map(t=>({contours:[t]}))]}}
 return shapeCache}
/* ---------- La sélection d'une zone de blocage ---------- */
/* Un clic dans la matière désigne le polygone qui le contient — toute la zone d'un seul
   tenant, trous compris. Elle se déplace d'un bloc, se tire par les quatre coins de sa
   boîte, se verrouille ou s'efface ; relâchée sur une autre, elle fond avec elle. */
function polygoneSel(){const m=mapDraft;
 return m&&mapSel&&mapSel.kind==='matiere'?matiereDe(m)[mapSel.i]||null:null}
// Après une refonte, la zone qu'on tenait : celle qui recouvre encore ce qu'elle était.
function zoneApres(avant){return matiereDe(mapDraft).findIndex(p=>Clipper.intersection(p.anneaux,avant.anneaux).length)}
// Obstacles du moteur : la carte ouverte fait foi, sinon le plan schématique de départ.
/* La clé de géométrie se recalcule en parcourant tous les sommets : demandée des centaines
   de fois par geste (chaque socle du lot, chaque échantillon de contact, chaque aura), elle
   pesait plus que le reste. Le résultat vaut pour toute la tâche en cours et s'oublie juste
   après : un geste ou un rendu ne le reconstruit qu'une fois, et un mur modifié entre deux
   tâches est vu à la suivante. */
let obstaclesTache=null;
function activeObstacles(){const m=currentMap();
 if(obstaclesTache&&obstaclesTache.m===m)return obstaclesTache.formes;
 const formes=m?mapShapes(m).formes:$('map').classList.contains('custom')?[]:WALLS.map(p=>({contours:[p]}));
 obstaclesTache={m,formes};setTimeout(()=>{obstaclesTache=null},0);
 return formes}
// Nomme l'obstacle qui coupe la vue, pour que le MJ sache s'il peut l'ouvrir.
function obstacleLabel(a,b){const m=currentMap(),mj=view==='mj';
 // Un passage secret clos se nomme « un mur » pour la troupe : le message ne doit pas
 // trahir ce que le socle ne montre pas.
 const portes=(m&&m.doors||[]).filter(d=>!d.open&&!doorHiddenFrom(d,mj));
 return m&&wallsBetween(a,b,portes.map(d=>doorPolygon(d,m.ratio)))?'une porte fermée':'un mur'}
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
let visionCache={cle:'',vues:new Map()};
/* Les polygones déjà versés dans la mémoire d'exploration : chacun ne l'est qu'une fois.
   Sans cela, chaque pas d'un aventurier refaisait rentrer dans la grille la vue de tous
   les autres, immobiles — quelques millisecondes par tête, à chaque image. */
let fogMemorise=new WeakSet();
/* La mémoire d'exploration n'est réemballée en base64 — quelques millisecondes pour
   deux cent mille cases — que lorsqu'elle a changé, et une fois par calcul. */
let fogAEmballer=false;
function emballeFog(){if(!fogAEmballer)return;fogAEmballer=false;const m=currentMap();
 if(!m||!fogSeen||!fogDim)return;
 m.fog=fogSeenSrc=packMask(fogSeen,fogDim.n);delete m.seen;scheduleSave()}
function computeFog(){const m=currentMap();
 if(!m){fogVis=null;fogTroupe=null;fogSeen=null;fogKey='';fogDim=null;return}
 const d=fogDim=fogDims(m);
 if(!fogSeen||fogSeen.length!==d.n||m.fog!==fogSeenSrc){fogSeen=readSeen(m,d);fogSeenSrc=m.fog;fogDirty=true;fogMemorise=new WeakSet()}
 const formes=activeObstacles(),troupe=fogParty();
 // Le calcul ne reprend que si la scène a bougé : héros, portes, zones ou point de vue.
 const cle=m.id+'|'+d.n+'|'+view+'|'+owner+'|'+troupe.map(a=>a.x.toFixed(2)+','+a.y.toFixed(2)).join(';')
  +'|'+geometryKey(m);
 if(cle===fogKey&&fogVis){emballeFog();return}
 fogKey=cle;
 /* Le polygone de vision ne dépend que d'une position et de la géométrie : on le garde par
    position tant que la géométrie ne bouge pas. Quand un seul aventurier se déplace, les
    autres — et le maître du jeu voit par tous — ne coûtent plus rien. */
 const geo=m.id+'|'+geometryKey(m);
 if(visionCache.cle!==geo)visionCache={cle:geo,vues:new Map()};
 const vues=visionCache.vues,vu=a=>{const k=a.x+','+a.y;
  if(!vues.has(k)){if(vues.size>=48)vues.clear();vues.set(k,visionPolygon(a,formes))}return vues.get(k)};
 // La mémoire retient ce que la troupe entière a vu, où que soit le lecteur.
 let neuf=0;for(const a of troupe){const p=vu(a);if(fogMemorise.has(p))continue;
  fogMemorise.add(p);neuf+=fillPolygonGrid(fogSeen,d.w,d.h,p)}
 fogVis=fogSeers().map(vu);fogTroupe=troupe.map(vu);
 if(neuf){fogDirty=true;fogAEmballer=true}
 emballeFog()}
// Le champ de vision en pixels : le socle est un disque, pas un point.
let fogPx=null,fogPxKey='';
/* La clé porte la largeur et la hauteur du cadre : au chargement, le cadre prend la
   taille de la carte après le premier calcul, et un polygone mis à l'échelle de l'ancien
   cadre disait la troupe aveugle jusqu'au premier pas — d'où des socles voilés et des
   adversaires non révélés sous les yeux mêmes d'un aventurier. */
function cleCadre(size){return fogKey+'|'+Math.round(size.width)+'x'+Math.round(size.height)}
function visionInPixels(){const size=mapSize(),k=cleCadre(size);
 if(fogPxKey!==k){fogPxKey=k;
  fogPx=(fogVis||[]).map(p=>p.map(([x,y])=>[x/100*size.width,y/100*size.height]))}
 return fogPx}
// Un adversaire hors du champ n'existe pas pour celui qui regarde. Mais il suffit
// qu'un bout de son socle morde sur la zone éclairée pour qu'il se montre.
function partySees(a){const m=currentMap();
 if(!fogVis||!m||m.fogOff)return true;
 const size=mapSize();if(!size.width)return true;
 const c=[a.x/100*size.width,a.y/100*size.height],r=tokenOf(a)/2;
 return visionInPixels().some(p=>polyTouchesDisc(p,c,r))}
/* Ce que la troupe entière voit à l'instant, où que soit l'écran : c'est elle qui révèle
   un adversaire, et non le seul aventurier de ce joueur. Mêmes règles qu'un socle vu. */
let fogTroupe=null,fogTroupePx=null,fogTroupeKey='';
function troupeVoit(a){const m=currentMap();
 /* Sans carte, rien ne se voit. Et le voile levé n'est qu'une aide à l'affichage : il ne
    vaut pas regard. Il comptait comme tel, et une carte enregistrée voile levé révélait
    tous ses adversaires d'un coup au rechargement. Seule la vision réelle révèle. */
 if(!m)return false;
 // Une carte dont le brouillard n'est pas encore calculé ne révèle rien : on attend.
 if(!fogTroupe)return false;
 // Un autre onglet est affiché : la carte n'a pas de largeur, on ne peut rien en dire.
 const size=mapSize();if(!size.width)return false;
 const k=cleCadre(size);
 if(fogTroupeKey!==k){fogTroupeKey=k;
  fogTroupePx=fogTroupe.map(p=>p.map(([x,y])=>[x/100*size.width,y/100*size.height]))}
 const c=[a.x/100*size.width,a.y/100*size.height],r=tokenOf(a)/2;
 return fogTroupePx.some(p=>polyTouchesDisc(p,c,r))}
// La mémoire d'exploration, lue en un point : sert à garder les portes visibles.
function seenAt(x,y){if(!fogSeen||!fogDim)return false;const d=fogDim;
 const i=Math.min(d.w-1,Math.max(0,Math.floor(x/100*d.w))),j=Math.min(d.h-1,Math.max(0,Math.floor(y/100*d.h)));
 return fogSeen[j*d.w+i]===1}
/* Une porte close est un obstacle : le regard s'arrête sur sa face, si bien que les
   cases de son rectangle ne sont jamais « vues » et qu'elle resterait invisible aux
   joueurs plantés devant. On interroge donc sa face, et la mémoire tout autour. */
function doorProbes(d,marge){const out=[];
 if(!(Number(d.a)||0)){const xs=[d.x-marge,d.x+d.w/2,d.x+d.w+marge],ys=[d.y-marge,d.y+d.h/2,d.y+d.h+marge];
  for(const x of xs)for(const y of ys)out.push([x,y]);return out}
 // De biais : la même grille de neuf points, mais dans le repère de la porte.
 const m=currentMap(),f=doorFrame(d,m&&m.ratio);
 for(const s of [-1,0,1])for(const t of [-1,0,1]){const ku=s*(f.hw+marge),kv=t*(f.hh+marge);
  out.push([(f.cx+f.ux*ku+f.vx*kv)/f.r,f.cy+f.uy*ku+f.vy*kv])}
 return out}
/* Vue à l'instant. Le polygone de vision est en étoile autour de l'observateur : un
   point s'y trouve si, et seulement si, le rayon qui l'y mène ne rencontre aucun mur.
   On interroge donc l'index des murs plutôt que de parcourir les milliers de sommets du
   polygone pour chacune des neuf sondes de chaque porte — douze portes coûtaient quarante
   millisecondes à chaque pas, c'est là que la vue prenait son retard. La face d'une porte
   close est elle-même un obstacle : on s'arrête un peu avant, d'un rayon de tolérance,
   là où le regard la touche vraiment. Le verdict est gardé tant que la scène ne bouge
   pas — le brouillard et le calque des portes le demandent tous deux, plusieurs fois. */
let portesVues={cle:'',vues:new WeakMap(),yeux:[]};
function doorInSight(d){const size=mapSize();
 if(!size.width||!fogVis)return false;
 const cle=cleCadre(size);
 if(portesVues.cle!==cle){const formes=activeObstacles();
  portesVues={cle,vues:new WeakMap(),formes,idx:indexMurs(formes),
   yeux:fogSeers().map(a=>({x:a.x,y:a.y,exclues:formesAutour(a,formes)}))}}
 if(portesVues.vues.has(d))return portesVues.vues.get(d);
 /* Chaque sonde est un petit disque, comme avant : son centre et huit points de son
    bord, en pour cent de carte pour un rayon en pixels. Il suffit que l'un d'eux soit
    en vue — c'est ainsi que la face d'une porte close se laisse voir de devant. */
 /* Le rayon doit arriver à moins de r pixels du point : la face d'une porte close se
    voit de devant, mais une porte derrière un mur ne se devine plus par le côté — les
    petits disques autour des sondes passaient à travers la cloison d'à côté. */
 const r=Math.max(6,tokenPx()*.25);
 const points=doorProbes(d,0);
 const vu=portesVues.yeux.some(o=>points.some(([x,y])=>{const dx=x-o.x,dy=y-o.y;
  const L=Math.hypot(dx/100*size.width,dy/100*size.height);
  if(L<=r)return true;
  const t=1-r/L;return rayonContre(portesVues.idx,o.x,o.y,dx,dy,t,o.exclues)>=t}));
 portesVues.vues.set(d,vu);return vu}
/* Déjà explorée : la mémoire devant ou derrière la porte, dans son axe — pas sur ses
   côtés, où la case voisine appartient souvent au couloir d'à côté. */
function doorFaces(d,marge){
 if(!(Number(d.a)||0)){const cx=d.x+d.w/2,cy=d.y+d.h/2;
  return d.w>=d.h?[[cx,d.y-marge],[cx,d.y+d.h+marge]]:[[d.x-marge,cy],[d.x+d.w+marge,cy]]}
 const m=currentMap(),f=doorFrame(d,m&&m.ratio),long=f.hw>=f.hh;
 return [-1,1].map(k=>{const ku=long?0:k*(f.hw+marge),kv=long?k*(f.hh+marge):0;
  return [(f.cx+f.ux*ku+f.vx*kv)/f.r,f.cy+f.uy*ku+f.vy*kv]})}
function doorRemembered(d){return doorFaces(d,.9).some(([x,y])=>seenAt(x,y))}
function doorSeen(d){const m=currentMap();
 if(!oeilJoueur()||!m||m.fogOff||!fogVis)return true;
 return doorInSight(d)||doorRemembered(d)}
// La mémoire est peinte une fois par changement, puis réutilisée telle quelle.
function memoryCanvas(d){if(!fogSeen)return null;
 if(!fogMem||fogMem.width!==d.w||fogMem.height!==d.h){
  fogMem=document.createElement('canvas');fogMem.width=d.w;fogMem.height=d.h;fogDirty=true}
 if(fogDirty){const c=fogMem.getContext('2d'),img=c.createImageData(d.w,d.h);
  for(let k=0;k<d.n;k++)if(fogSeen[k]){const p=k*4;img.data[p]=img.data[p+1]=img.data[p+2]=img.data[p+3]=255}
  c.putImageData(img,0,0);fogDirty=false}
 return fogMem}
/* Au chargement, l'image de la carte paraissait avant que le brouillard ne la couvre :
   un instant, et toute l'aventure était lue. Un voile opaque couvre la carte tant que le
   brouillard de la carte ouverte n'a pas été peint ; sans carte ou voile levé, il s'ôte. */
const voileAttente=document.createElement('div');voileAttente.id='voile-attente';$('map').append(voileAttente);
let cartePeinte=null;
function cleVoile(){const m=currentMap();return m?m.id+'|'+(m.fogOff?1:0):''}
// Peint, ou rien à peindre : le voile s'ôte. Brouillard pas encore calculé, cadre sans largeur : il reste.
function leverVoile(){const m=currentMap(),cv=$('fog');
 const peint=!m||m.fogOff||(fogVis&&fogDim&&cv.clientWidth>0&&cv.clientHeight>0);
 if(!peint)return;cartePeinte=cleVoile();voileAttente.hidden=true}
let vueTroupe=false;
function oeilJoueur(){return view!=='mj'||vueTroupe}
function renderFog(){const cv=$('fog'),m=currentMap(),d=fogDim;
 // Voile levé par le MJ : plus rien ne masque la carte, pour personne.
 if(!m||!fogVis||!d||m.fogOff){cv.style.display='none';return}
 cv.style.display='';
 const large=cv.clientWidth,haut=cv.clientHeight;if(!large||!haut)return;
 // Toile à la résolution de l'écran : le bord du polygone est tracé au pixel près.
 const ech=Math.min(2,window.devicePixelRatio||1);
 /* La toile suivait la seule taille du cadre, et le zoom l'agrandissait ensuite : à deux
    cents pour cent, chaque pixel de toile en couvrait deux à l'écran, et le bord du champ
    de vision — pourtant tracé d'un trait exact — montait en marches d'escalier. Elle suit
    donc le zoom, jusqu'à un plafond de pixels : au-delà, le prix de la repeinte ne vaut
    plus la finesse gagnée. */
 const zoom=Math.max(1,typeof mapZoom==='number'&&mapZoom>0?mapZoom:1);
 const W=Math.max(1,Math.min(4096,Math.round(large*ech*zoom))),H=Math.max(1,Math.round(W*haut/large));
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
 const ctx=cv.getContext('2d');
 // Le MJ garde une vue lisible ; le joueur ne voit rien de l'inexploré.
 const inconnu=oeilJoueur()?255:110,memoire=oeilJoueur()?150:40;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle='rgba(6,9,11,'+(inconnu/255).toFixed(3)+')';ctx.fillRect(0,0,W,H);
 ctx.globalCompositeOperation='destination-out';
 const mem=memoryCanvas(d);
 /* La mémoire est une grille de bits ; agrandie telle quelle jusqu'à l'écran, sa
    frontière montait en escalier — d'autant plus visible que la carte est zoomée. On
    l'interpole donc, et on la fond sur un peu moins d'une case : le bord de l'exploré
    devient un dégradé, ce qu'il est en vérité. Le champ vu, lui, reste un polygone
    tracé au trait, et ne doit rien à ce lissage. */
 if(mem){ctx.globalAlpha=1-memoire/inconnu;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const flou=Math.max(1,W/d.w*.7);ctx.filter='blur('+flou.toFixed(2)+'px)';
  ctx.drawImage(mem,0,0,W,H);ctx.filter='none'}
 ctx.globalAlpha=1;ctx.fillStyle='#000';
 for(const poly of fogVis){if(!poly||poly.length<3)continue;
  ctx.beginPath();ctx.moveTo(poly[0][0]/100*W,poly[0][1]/100*H);
  for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0]/100*W,poly[i][1]/100*H);
  ctx.closePath();ctx.fill()}
 /* Une porte n'est qu'un contour : le regard s'arrête dessus, donc son rectangle n'est
    jamais éclairé et le décor y resterait noir. On lui rend la clarté de ses abords —
    pleine si on la voit, celle de la mémoire si on l'a seulement découverte. */
 const rect=p=>{if(!(Number(p.a)||0)){ctx.fillRect(p.x/100*W,p.y/100*H,p.w/100*W,p.h/100*H);return}
  const poly=doorPolygon(p,m.ratio);ctx.beginPath();
  poly.forEach((q,i)=>ctx[i?'lineTo':'moveTo'](q[0]/100*W,q[1]/100*H));ctx.closePath();ctx.fill()};
 /* Un passage secret clos n'est pas une porte pour la troupe : c'est du mur, et le mur
    reste dans l'ombre. Lui rendre la clarté de ses abords le désignerait du doigt —
    c'est par là qu'il se trahissait, une plaque grise dans le noir. */
 const portes=(m.doors||[]).filter(p=>p&&p.w>0&&p.h>0&&!doorHiddenFrom(p,view==='mj'));
 const retenues=portes.filter(p=>!doorInSight(p)&&doorRemembered(p));
 if(retenues.length){ctx.globalAlpha=1-memoire/inconnu;retenues.forEach(rect);ctx.globalAlpha=1}
 portes.filter(doorInSight).forEach(rect);
 ctx.globalCompositeOperation='source-over'}
/* Chaque remise à zéro du brouillard se compte : le numéro voyage par la table, et les
   joueurs rejouent la même remise à zéro, en silence. */
let brouillardReset={n:0,tout:false};
function resetFog(tout,silencieux){const m=currentMap();if(!m)return;
 const d=fogDims(m),g=new Uint8Array(d.n);if(tout)g.fill(1);
 m.fog=packMask(g,d.n);delete m.seen;m.fogOff=false;fogSeen=g;fogSeenSrc=m.fog;fogDirty=true;fogKey='';fogMemorise=new WeakSet();
 if(!silencieux)brouillardReset={n:brouillardReset.n+1,tout:!!tout};
 render();scheduleSave();
 if(!silencieux)log(tout?'Brouillard levé sur toute la carte.':'Brouillard réinitialisé.',{ton:'carte'})}

/* ---------- Rendu sur la table de jeu ---------- */
function svgRect(r,cls){const el=document.createElementNS(nsSVG,'rect');
 el.setAttribute('x',r.x+'%');el.setAttribute('y',r.y+'%');el.setAttribute('width',r.w+'%');el.setAttribute('height',r.h+'%');
 if(cls)el.setAttribute('class',cls);return el}
/* La carte tient dans l'écran : sa hauteur laisse, en dessous, la place de la rangée des
   Actions et des Dés puis de la marge du bas — plus rien à faire défiler pour voir le bas
   des boutons. On mesure depuis le haut de la page, comme si elle n'était pas défilée.
   Sur une seule colonne (téléphone), tout défile de toute façon : on garde la borne
   d'avant, comme pour une carte masquée qui ne se mesure pas. */
function hauteurDispoCarte(el){const repli=Math.round(innerHeight*.72),r=el.getBoundingClientRect();
 if(!el.offsetParent||!r.width)return repli;
 const rangee=document.querySelector('.actions-rangee'),layout=document.querySelector('.layout');
 if(!rangee||!rangee.offsetParent||getComputedStyle(rangee).gridTemplateColumns.trim().split(/\s+/).length<2)return repli;
 /* Tout ce qui sépare le bas de la carte du bas de la rangée des Actions — le bas de son
    panneau, l'écart, la rangée — puis la marge de la page : rien de cela ne dépend de la
    hauteur de la carte. (Le bas de la colonne, lui, s'étire sur la plus haute des trois.) */
 const sous=rangee.getBoundingClientRect().bottom-r.bottom,marge=layout?parseFloat(getComputedStyle(layout).paddingBottom)||0:0;
 return Math.round(innerHeight-(r.top+scrollY)-sous-marge)}
function applyMapRatio(){const m=currentMap(),el=$('map');
 if(!m||!m.ratio){el.style.width='';el.style.height='';return}
 const dispo=el.parentElement.clientWidth||el.clientWidth||600,hMax=Math.max(260,hauteurDispoCarte(el));
 let w=dispo,h=w/m.ratio;if(h>hMax){h=hMax;w=h*m.ratio}
 el.style.width=Math.round(w)+'px';el.style.height=Math.round(h)+'px'}
/* Le contour lissé devient un tracé SVG dans un repère de 0 à 100 : c'est très
   exactement la matière qui arrête le regard, dessinée sans un pixel d'écart. */
/* Plusieurs tracés dans une même toile : les zones d'un côté, les traits de l'autre, mais
   la même encre et le même liseré — c'est la même matière, elle doit se peindre pareil.
   Deux tracés plutôt qu'un seul : réunis, la règle pair-impair ferait un trou là où un
   trait croise une zone. */
/* Zones et traits ne sont qu'une matière, et doivent se lire comme telle : un trait posé
   sur une zone ne doit pas y redessiner son propre contour. On peint donc en deux temps —
   tous les liserés d'abord, sans remplissage, puis tous les remplissages par-dessus. Le
   liseré enterré sous la matière voisine s'en trouve couvert, et il ne reste que la
   silhouette commune, comme lorsqu'on pose une zone sur une autre.
   Les zones gardent la règle du pair-impair, qui leur creuse leurs trous ; les traits la
   règle ordinaire, sans quoi un trait posé sur une zone y percerait un vide. */
function svgMatiere(groupes,cls,wrap){const svg=document.createElementNS(nsSVG,'svg');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 if(wrap)svg.setAttribute('class',wrap);
 const utiles=(groupes||[]).map((g,i)=>[g,i]).filter(([g])=>g&&g.length);
 const tracer=(g,i,role)=>{const el=document.createElementNS(nsSVG,'path');
  el.setAttribute('d',g.map(c=>'M'+c.map(p=>p[0].toFixed(3)+' '+p[1].toFixed(3)).join('L')+'Z').join(''));
  el.setAttribute('fill-rule',i?'nonzero':'evenodd');
  el.setAttribute('class',(cls?cls+' ':'')+role);svg.append(el)};
 utiles.forEach(([g,i])=>tracer(g,i,'bord'));
 utiles.forEach(([g,i])=>tracer(g,i,'fond'));
 return svg}
function svgPath(contours,cls,wrap){const svg=document.createElementNS(nsSVG,'svg');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 if(wrap)svg.setAttribute('class',wrap);
 const el=document.createElementNS(nsSVG,'path');
 el.setAttribute('d',contours.map(c=>'M'+c.map(p=>p[0].toFixed(3)+' '+p[1].toFixed(3)).join('L')+'Z').join(''));
 el.setAttribute('fill-rule','evenodd');if(cls)el.setAttribute('class',cls);
 svg.append(el);return svg}
// Le joueur ne manœuvre une porte qu'au contact : elle doit mordre son rayon.
/* Qui manœuvre la porte : chez un joueur, son aventurier ; chez le MJ, le combattant choisi
   s'il est à portée — sinon personne, et la porte s'ouvre d'elle-même, gratuitement. */
function porteurDePorte(d){const size=mapSize(),m=currentMap();if(!size.width)return null;
 const a=view==='mj'?(selected!==null?actors[selected]:null):actors[owner];
 return a&&alive(a)&&polyInReach(a,doorPolygon(d,m&&m.ratio),size,tokenPx())?a:null}
function doorInReach(d){if(view==='mj')return true;
 const a=actors[owner],size=mapSize(),m=currentMap();
 return !!(a&&a.hero&&alive(a)&&size.width&&polyInReach(a,doorPolygon(d,m&&m.ratio),size,tokenPx()))}
// Une porte droite reste un rectangle en pour cent ; de biais, un polygone à ses quatre coins.
function svgPorte(d,ratio,cls){if(!(Number(d.a)||0))return svgRect(d,cls);
 const el=document.createElementNS(nsSVG,'polygon');
 el.setAttribute('points',doorPolygon(d,ratio).map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));
 if(cls)el.setAttribute('class',cls);return el}
function renderMapLayer(){const svg=$('map-shapes'),portes=$('map-doors'),m=currentMap();
 svg.replaceChildren();portes.replaceChildren();applyMapRatio();renderFog();renderZones();leverVoile();refreshGmBar();
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 const formes=mapShapes(m);
 // Un passage secret clos ne perce plus la matière : le mur se peint plein pour tout le
 // monde, MJ compris, et c'est le trait violet — lui seul — qui le lui signale.
 if(formes.murs.contours.length)svg.append(svgMatiere([formes.murs.contours],null,'wall-group'));
 renderPortes();renderCoffres();renderObjets()}
/* ---------- Les objets à la table ----------
   Un objet visible est un socle comme un autre, doré, que chacun peut ouvrir : on y lit
   la description, et un aventurier au contact y prend ce qui s'y trouve. Caché, seul le
   MJ le voit — en pointillé — jusqu'à ce qu'un test le découvre. Le brouillard ne le
   cache pas : c'est la description qui dit s'il est dans un recoin. */
/* En combat, les objets s'effacent de la carte, pour tous : ils reviennent en exploration. Ils ne
   coupent jamais la vue. */
function renderObjets(){const vue=$('map-view'),m=currentMap();
 vue.querySelectorAll('.token.objet').forEach(t=>t.remove());if(!m||enCombat())return;
 (m.objets||[]).forEach((o,i)=>{if(o.pris||(!o.visible&&view!=='mj'))return;
  // Pour la troupe, un objet dans le noir n'existe pas : il faut le voir, ou l'avoir vu.
  const vuTroupe=seenAt(o.x,o.y)||partySees({x:o.x,y:o.y,socle:'medium'});
  if(oeilJoueur()&&!vuTroupe)return;
  /* Chez le MJ, un objet se voile comme un adversaire : caché par lui, pâli et cerclé de violet ;
     dans une salle que la troupe n'a pas encore vue, pâli et cerclé de tirets. */
  const t=document.createElement('button');t.className='token objet'+(!o.visible?' cachemj':!vuTroupe?' veiled':'');
  poseLogoObjet(t,o);t.style.left=o.x+'%';t.style.top=o.y+'%';
  t.style.setProperty('--token',tokenPx()*(SOCLE_TAILLES[o.taille]||1)+'px');
  t.title=o.nom+(o.visible?'':' · caché — '+skillNames[o.test.comp]+' × '+o.test.reussites);
  t.setAttribute('aria-label',t.title);
  /* Au survol, la bulle : la pièce qu'il contient, telle qu'à l'Armurerie, et sa description. Au
     clic, un aventurier au contact le récupère ; le MJ, lui, choisit : révéler, cacher, ou le
     donner à l'aventurier le plus proche. */
  if(typeof surveille==='function')surveille(t,()=>ouvrirBulle(t,bulleObjetCarte(o),'bulle-gear'));
  t.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();
   if(view==='mj'){menuObjetMJ(o,e.clientX,e.clientY);return}
   const a=actors[selected],mien=!!(a&&a.hero&&controlled(selected)&&alive(a));
   if(!mien){log('Sélectionne d’abord ton aventurier.',{local:true});return}
   if(!objetAPortee(a,o)){log('Approche '+a.name+' : il faut être au contact de '+o.nom+'.',{local:true});return}
   recupererObjet(a,o)};
  vue.append(t)})}
function bulleObjetCarte(o){const d=document.createElement('div');d.className='bulle-objet-carte';
 const pieces=(o.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 const desc=()=>{if(!o.desc&&!o.tresor)return null;const p=document.createElement('p');p.className='objet-desc-bulle';p.textContent=[o.desc,o.tresor?'Trésor : '+o.tresor:''].filter(Boolean).join('\n');return p};
 if(pieces.length)pieces.forEach((it,k)=>{const g=gearDetail(it,null,false);g.hidden=false;g.classList.add('large');if(!k){const p=desc();if(p)g.append(p)}d.append(g)});
 else{const g=document.createElement('div');g.className='gear-detail large';const n=document.createElement('p');n.className='gear-nom';n.textContent=o.nom||'Objet';g.append(n);const p=desc();if(p)g.append(p);d.append(g)}
 if(view==='mj'&&!o.visible){const c=document.createElement('p');c.className='muted objet-cache-bulle';c.textContent='Caché : '+skillNames[o.test.comp]+', '+o.test.reussites+' réussite'+(o.test.reussites>1?'s':'');(d.firstChild||d).append(c)}
 return d}
/* Récupérer un objet : ses pièces vont à l'inventaire de l'aventurier, son trésor à ses notes, et
   l'objet quitte la carte pour toute la table — jusqu'à ce que la carte soit rechargée. */
function recupererObjet(a,o){if(!a||!o||o.pris)return;
 const pieces=(o.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 pieces.forEach(it=>{if(typeof ajouterInventaire==='function')ajouterInventaire(a,it);else noteInventaire(a,it.name)});
 if(o.tresor)noteInventaire(a,o.tresor);o.pris=true;
 log(nomNum(a)+' récupère '+(pieces.length?pieces.map(it=>'⟦'+it.id+'⟧').join(' '):o.nom)+(o.tresor?' et '+o.tresor:'')+'.',{ton:'butin'});
 render();saveMaps();scheduleSave()}
function heroLePlusProche(o){const size=mapSize(),loin=h=>Math.hypot((h.x-o.x)/100*size.width,(h.y-o.y)/100*size.height);
 const heros=actors.filter(h=>h&&h.hero&&!h.horsCarte),vivants=heros.filter(alive),parmi=vivants.length?vivants:heros;
 return parmi.length?parmi.reduce((m,x)=>loin(x)<loin(m)?x:m):null}
let menuObjet=null;
function fermeMenuObjet(){if(menuObjet){menuObjet.remove();menuObjet=null}document.removeEventListener('pointerdown',dehorsMenuObjet,true);document.removeEventListener('keydown',echapMenuObjet,true)}
function dehorsMenuObjet(e){if(menuObjet&&!menuObjet.contains(e.target))fermeMenuObjet()}
function echapMenuObjet(e){if(e.key==='Escape')fermeMenuObjet()}
function menuObjetMJ(o,x,y){fermeMenuObjet();const m=document.createElement('div');m.className='menu-objet';m.setAttribute('role','menu');
 const t=document.createElement('p');t.className='menu-objet-titre';t.textContent=o.nom||'Objet';m.append(t);
 const bouton=(txt,fn)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=txt;b.onclick=()=>{fermeMenuObjet();fn()};m.append(b)};
 bouton(o.visible?'Cacher à la troupe':'Révéler à la troupe',()=>{o.visible=!o.visible;if(o.visible)floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');log(o.nom+(o.visible?' est révélé.':' est caché.'),{ton:'carte'});render();saveMaps();scheduleSave()});
 const h=heroLePlusProche(o);if(h)bouton('Donner à '+nomNum(h)+', le plus proche',()=>recupererObjet(h,o));
 document.body.append(m);const r=m.getBoundingClientRect();
 m.style.left=Math.max(6,Math.min(x+8,innerWidth-r.width-6))+'px';m.style.top=Math.max(6,Math.min(y+8,innerHeight-r.height-6))+'px';menuObjet=m;
 setTimeout(()=>{document.addEventListener('pointerdown',dehorsMenuObjet,true);document.addEventListener('keydown',echapMenuObjet,true)})}
/* Le jeton d'un objet porte l'icône de la première pièce qu'il contient — celle choisie en premier
   dans sa fiche ; sans pièce à icône, son initiale. */
function poseLogoObjet(el,o){let im=null,piece=null;const pieces=(o.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 for(const it of pieces){im=typeof logoEquipement==='function'?logoEquipement(it):null;if(im){piece=it;break}}
 // Le fond du jeton : celui du carré de cette pièce, à la couleur de sa rareté.
 piece=piece||pieces[0];if(piece&&typeof rareteDe==='function')el.classList.add('piece','r-'+rareteDe(piece));
 if(im){im.classList.add('logo-objet');el.replaceChildren(im);el.classList.add('avec-logo')}else el.textContent=(o.nom||'?')[0].toUpperCase()}
/* ---------- Les fouilles ----------
   Un test de Perception fouille la zone de contact de l'aventurier — son aura, que les murs
   découpent. Les zones fouillées ne se superposent pas : elles s'additionnent en une seule zone
   commune. Un nouveau test ne fouille que la part de l'aura qui ne l'a pas encore été, et un objet
   tout entier dans la zone déjà fouillée ne peut plus être trouvé. Une aura déjà toute fouillée ne
   permet plus de test de Perception. Chaque aventurier garde ses fouilles (« fouilles » : la carte,
   le centre, le rayon en part de la largeur de la carte), toute la table les partage ; elles
   s'effacent quand la carte est rechargée sur la table. Le bouton « Fouilles » montre leur somme. */
const PERCEPTION=3,PART_MINIMALE=.02;
function fouillesCarte(){const id=typeof currentMapId!=='undefined'?currentMapId||'':'';
 return actors.filter(a=>a&&a.hero).flatMap(a=>(a.fouilles||[]).filter(f=>f&&(f.m||'')===id).map(f=>({...f,par:a})))}
// Les aires, en pixels carrés : un anneau au lacet, un multipolygone trous déduits.
const aireAnneau=r=>{let s=0;for(let i=0,n=r.length;i<n;i++){const p=r[i],q=r[(i+1)%n];s+=p[0]*q[1]-q[0]*p[1]}return Math.abs(s)/2};
const aireMulti=mp=>(mp||[]).reduce((t,p)=>t+(p&&p.length?aireAnneau(p[0])-p.slice(1).reduce((h,r)=>h+aireAnneau(r),0):0),0);
// Une aura en pixels, découpée par les murs comme celle qu'on voit autour d'un socle.
function auraPx(x,y,rayon,W,H){const pts=reachPolygon({x,y},walls(),rayon,W,H,48);return pts.length<3?null:[[pts.map(p=>[p[0]/100*W,p[1]/100*H])]]}
function disquePx(x,y,r,W,H){const ring=[];for(let i=0;i<24;i++){const t=i/24*Math.PI*2;ring.push([x/100*W+Math.cos(t)*r,y/100*H+Math.sin(t)*r])}return [[ring]]}
let fouillesCache={cle:'',union:[]};
function unionFouilles(){const size=mapSize(),W=size.width,H=size.height;if(!W||!H)return [];
 const liste=fouillesCarte(),cle=W+'x'+H+'|'+liste.map(f=>f.x+','+f.y+','+f.r).join(';');
 if(fouillesCache.cle===cle)return fouillesCache.union;
 const polys=liste.map(f=>auraPx(f.x,f.y,f.r*W,W,H)).filter(Boolean);
 let u=[];try{u=polys.length?Clipper.union(...polys):[]}catch(e){u=polys.flat()}
 fouillesCache={cle,union:u};return u}
// Ce qu'un test de Perception fouillerait ici : la part neuve de l'aura, et sa proportion.
let zoneCache={cle:'',zone:null};
function zonePerception(a){const size=mapSize(),W=size.width,H=size.height;if(!a||!W||!H)return {nouvelle:[],part:0};
 const U=unionFouilles(),cle=a.x+','+a.y+','+tokenOf(a)+'|'+fouillesCache.cle;if(zoneCache.cle===cle)return zoneCache.zone;
 const A=auraPx(a.x,a.y,contactRadius(tokenOf(a)),W,H);let zone={nouvelle:[],part:0};
 if(A){let N=A;try{if(U.length)N=Clipper.difference(A,U)}catch(e){}const aA=aireMulti(A);zone={nouvelle:N,part:aA?aireMulti(N)/aA:0}}
 zoneCache={cle,zone};return zone}
function zoneFouillee(a){return zonePerception(a).part<PART_MINIMALE}
// Un objet se trouve si une part de son socle tombe dans ce que le test fouille vraiment.
function dansFouilleNeuve(o,nouvelle){const size=mapSize(),W=size.width,H=size.height;if(!W||!nouvelle||!nouvelle.length)return false;
 const D=disquePx(o.x,o.y,tokenPx()*(SOCLE_TAILLES[o.taille]||1)/2,W,H);try{return aireMulti(Clipper.intersection(D,nouvelle))>.5}catch(e){return false}}
// Une fouille retient aussi ses réussites (« n ») : le chiffre se lit au centre de sa zone.
function noteFouille(a,reussites){const size=mapSize();if(!a||!size.width)return;
 a.fouilles=[...(a.fouilles||[]),{m:typeof currentMapId!=='undefined'?currentMapId||'':'',x:+a.x.toFixed(2),y:+a.y.toFixed(2),r:+(contactRadius(tokenOf(a))/size.width).toFixed(4),n:Math.max(0,Math.trunc(Number(reussites))||0)}].slice(-200);
 renderFouilles()}
let fouillesOn=false;try{fouillesOn=localStorage.getItem('amertume-fouilles')==='1'}catch(e){}
function renderFouilles(){const vue=$('map-view');if(!vue)return;let c=$('fouilles-layer');
 if(!c){c=document.createElement('div');c.id='fouilles-layer';vue.append(c)}
 c.replaceChildren();c.hidden=!fouillesOn;const b=$('fouilles-vue');
 if(b){b.classList.toggle('on',fouillesOn);b.setAttribute('aria-pressed',String(fouillesOn));
  b.title=(fouillesOn?'Masquer':'Afficher')+' les zones où un test de Perception a déjà été fait'+(view==='mj'?' — clic droit : les effacer sur cette carte':'');b.setAttribute('aria-label',b.title)}
 if(!fouillesOn)return;const size=mapSize(),U=unionFouilles();if(!U.length||!size.width)return;
 // Une seule zone : la somme des fouilles, son contour en pointillé, ses trous laissés vides.
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),p=document.createElementNS(NS,'path');
 svg.setAttribute('viewBox','0 0 '+size.width+' '+size.height);svg.setAttribute('preserveAspectRatio','none');
 p.setAttribute('d',U.map(poly=>poly.map(r=>'M'+r.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L')+'Z').join('')).join(''));
 p.setAttribute('fill-rule','evenodd');p.setAttribute('class','fouille');svg.append(p);c.append(svg);
 // Au centre de chaque fouille, ses réussites en Killam : rouge à zéro, vert dès une.
 fouillesCarte().forEach(f=>{if(!Number.isInteger(f.n))return;const n=document.createElement('span');n.className='fouille-n'+(f.n>0?' reussie':' ratee');
  n.textContent=f.n;n.style.left=f.x+'%';n.style.top=f.y+'%';n.setAttribute('aria-label',f.n+' réussite'+(f.n>1?'s':'')+' — '+f.par.name);
  // Au survol du chiffre, l'icône de l'aventurier qui a fouillé.
  if(typeof surveille==='function')surveille(n,()=>{const d=document.createElement('div');d.className='fouilleur';
   if(f.par.image){const im=document.createElement('img');im.src=f.par.image;im.alt='';d.append(im)}else d.textContent=(f.par.name||'?')[0].toUpperCase();
   ouvrirBulle(n,d,'bulle-fouilleur')});
  c.append(n)})}
if($('fouilles-vue')){$('fouilles-vue').onclick=()=>{fouillesOn=!fouillesOn;try{localStorage.setItem('amertume-fouilles',fouillesOn?'1':'0')}catch(e){}renderFouilles()};
 $('fouilles-vue').oncontextmenu=e=>{if(view!=='mj')return;e.preventDefault();const id=typeof currentMapId!=='undefined'?currentMapId||'':'';
  if(!fouillesCarte().length||!confirm('Effacer les zones fouillées de cette carte ? La Perception pourra y être retentée.'))return;
  actors.forEach(a=>{if(a&&a.hero&&a.fouilles)a.fouilles=a.fouilles.filter(f=>f&&(f.m||'')!==id)});render();scheduleSave()}}
function objetAPortee(a,o){const size=mapSize();if(!a||!size.width)return false;
 return inContact(a,o,size,tokenOf(a),tokenPx()*(SOCLE_TAILLES[o.taille]||1))&&!wallsBetween(a,o,walls())}
function noteInventaire(a,texte){a.notes=(a.notes?a.notes.replace(/\s+$/,'')+'\n':'')+'• '+texte}
/* Prendre : une arme va en main si une main est libre, une armure sur le dos ou au bras si
   la place est vide ; sinon, et pour tout le reste, une ligne à l'inventaire. */
function prendreObjet(a,o,it){const k=(o.items||[]).indexOf(it.id);if(k<0)return;
 // Toute pièce prise va à l'inventaire de l'aventurier : on l'équipe ensuite sur sa fiche.
 if(typeof ajouterInventaire==='function')ajouterInventaire(a,it);else noteInventaire(a,it.name);
 o.items.splice(k,1);
 log(nomNum(a)+' prend '+it.name+' — '+o.nom+' — à l’inventaire.',{ton:'carte'});
 render();saveMaps();scheduleSave()}
function prendreTresor(a,o){if(!o.tresor)return;noteInventaire(a,o.tresor);
 log(nomNum(a)+' ramasse '+o.tresor+' — '+o.nom+'.',{ton:'carte'});o.tresor='';render();saveMaps()}
/* Le test de découverte : l'aventurier choisi lance sa compétence ; assez de réussites,
   et l'objet paraît à toute la table. Les dés roulent sur le plateau comme pour un test. */
function testerObjet(a,o){const jet=skillRoll(a.skills[o.test.comp]||0,d6);
 rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),a,a);
 const trouve=jet.reussites>=o.test.reussites;
 log(nomNum(a)+' · '+skillNames[o.test.comp]+' : '+jet.reussites+' réussite'+(jet.reussites>1?'s':'')+' sur '+o.test.reussites+' ⦃'+jet.des.join(',')+'⦄ — '
  +(trouve?'découvre '+o.nom+' !':'ne trouve rien.'),{dice:true});
 if(trouve){o.visible=true;floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');render();saveMaps()}
 return trouve}
/* Un test de compétence lancé depuis la fiche cherche aussi, dans la zone de contact de
   l'aventurier : chaque objet caché qui s'y trouve — aucun mur entre eux —, découvert par cette
   compétence, la Perception d'ordinaire, et avec assez de réussites, paraît à toute la table. */
function objetsDecouverts(a,comp,reussites,nouvelle){const m=currentMap();if(!a||!a.hero||!m)return [];
 // La Perception ne cherche que dans la part neuve de la fouille ; une autre compétence, dans tout le contact.
 const murs=walls(),atteint=o=>nouvelle?!wallsBetween(a,o,murs)&&dansFouilleNeuve(o,nouvelle):objetAPortee(a,o);
 const trouves=(m.objets||[]).filter(o=>!o.visible&&o.test&&o.test.comp===comp&&reussites>=o.test.reussites&&atteint(o));
 trouves.forEach(o=>{o.visible=true;floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul')});
 /* La Perception trouve aussi les passages secrets et les coffres cachés que sa fouille neuve touche,
    avec assez de réussites : le passage devient une porte, le coffre paraît. */
 const noms=trouves.map(o=>o.nom);
 if(comp===PERCEPTION&&nouvelle){
  (m.doors||[]).forEach(d=>{if(d.secret&&!d.open&&!d.decouvert&&reussites>=(Number(d.perception)||1)&&formeDansFouille(d,nouvelle)){
   d.decouvert=true;floatNumber(centreForme(d),'Révélé !','nul');noms.push('un passage secret')}});
  (m.coffres||[]).forEach(c=>{if(c.cache&&!c.revele&&reussites>=(Number(c.perception)||1)&&formeDansFouille(c,nouvelle)){
   c.revele=true;floatNumber(centreForme(c),'Révélé !','nul');noms.push(c.nom)}})}
 if(noms.length){log(nomNum(a)+' découvre '+noms.join(', ')+' !',{ton:'carte'});render();saveMaps();scheduleSave()}
 return trouves}
// Le centre d'une porte ou d'un coffre, là où s'affiche ce qui lui arrive.
const centreForme=f=>({x:f.x+f.w/2,y:f.y+f.h/2,socle:'medium'});
// Une forme rectangulaire — passage, coffre — touchée par la part neuve d'une fouille.
function formeDansFouille(f,nouvelle){const size=mapSize(),W=size.width,H=size.height,m=currentMap();if(!W||!nouvelle||!nouvelle.length)return false;
 const P=[[coffrePolygon(f,m&&m.ratio).map(([x,y])=>[x/100*W,y/100*H])]];try{return aireMulti(Clipper.intersection(P,nouvelle))>.5}catch(e){return false}}
/* ---------- Les coffres à la table ----------
   Un coffre visible se voit comme une porte : un contour épais, brun orangé, et un voile par-dessus la
   carte. Caché, seul le MJ le voit, en pointillé, jusqu'à ce qu'un test de Perception le révèle. Au
   contact, un aventurier l'ouvre, le déverrouille ou y cherche un piège, en Ruse ou en Technique. Ouvert,
   il donne ce qu'il contient et reste là, inerte et pâli, comme un socle à 0 PV. */
const RUSE=5,TECHNIQUE=7;
const coffreVisible=c=>!c.cache||!!c.revele,coffreVerrouille=c=>c.verrou>0&&!c.deverrouille,coffreArme=c=>c.piege>0&&!c.desamorce;
function heroActif(){const a=actors[selected];return a&&a.hero&&controlled(selected)&&alive(a)?a:null}
function polyCoffre(c){const m=currentMap();return coffrePolygon(c,m&&m.ratio)}
/* Dans le champ de vision de la troupe, maintenant : un coffre ne se voit ni hors de vue, ni dans le
   brouillard, même dans une salle déjà explorée. Sans brouillard sur la carte, toujours. */
function coffreEnVue(c){const m=currentMap();if(!m||m.fogOff||!fogVis)return true;return doorInSight(c)}
// L'aventurier choisi a-t-il cette clé dans son inventaire ?
const aLaCle=(a,id)=>!!a&&!!id&&(a.inventaire||[]).includes(id);
const nomCle=id=>((catalog.items||[]).find(o=>o&&o.id===id)||{}).name||'la clé';
/* En combat, ouvrir un coffre ou tenter un test coûte l'Action ; sans elle, rien ne se fait. */
function payeAction(a){if(!enCombat()||!a)return true;
 if(pointsRestants(a,'action')<=0){floatNumber(a,'Action déjà dépensée','nul');log(nomNum(a)+' a déjà dépensé son Action ce tour.',{local:true});return false}
 depensePoint(a,'action');return true}
// Au contact : le coffre touche la zone de contact de l'aventurier.
function coffreAPortee(a,c){const size=mapSize();return !!a&&!!size.width&&polyInReach(a,polyCoffre(c),size,tokenOf(a))}
// Le piège frappe qui est dans la zone de contact du coffre : celle d'un socle moyen, autour de sa forme.
function dansZoneCoffre(h,c){const size=mapSize();return !!size.width&&polyInReach(h,polyCoffre(c),size,tokenPx())}
/* Le bouton du MJ : la bulle des coffres au survol, chez lui, allumée ou éteinte. Les joueurs n'en sont pas
   touchés : ils la lisent, au contact, comme avant. */
let bullesCoffresMJ=true;try{bullesCoffresMJ=localStorage.getItem('amertume-bulles-coffres')!=='0'}catch(e){}
function majBoutonCoffres(){const b=$('coffres-bulles');if(!b)return;b.hidden=view!=='mj';b.classList.toggle('on',bullesCoffresMJ);
 b.setAttribute('aria-pressed',String(bullesCoffresMJ));b.title=(bullesCoffresMJ?'Masquer':'Afficher')+' la bulle des coffres au survol';b.setAttribute('aria-label',b.title)}
if($('coffres-bulles'))$('coffres-bulles').onclick=()=>{bullesCoffresMJ=!bullesCoffresMJ;try{localStorage.setItem('amertume-bulles-coffres',bullesCoffresMJ?'1':'0')}catch(e){}
 if(!bullesCoffresMJ&&typeof fermerBulle==='function')fermerBulle();majBoutonCoffres()};
/* Les coffres ont leur calque, sous le brouillard : hors de la vue de la troupe, il les couvre, et seule leur
   part en vue se découpe. */
function renderCoffres(){const calque=$('map-coffres'),vue=$('map-view'),m=currentMap();calque.replaceChildren();vue.querySelectorAll('.coffre-alerte,.coffre-cadenas').forEach(x=>x.remove());majBoutonCoffres();if(!m)return;
 const mj=view==='mj',oeil=typeof oeilJoueur==='function'&&oeilJoueur();
 (m.coffres||[]).forEach(c=>{const enVue=coffreEnVue(c);
  // La troupe ne voit un coffre que révélé et sous ses yeux ; le MJ voit tout, pâli hors de la vue de la troupe.
  if((!mj||oeil)&&(!coffreVisible(c)||!enVue))return;
  const cls='coffre'+(c.ouvert?' ouvert':'')+(coffreVisible(c)?'':' cache')+(enVue?'':' voile');
  let el;if(!c.rond)el=svgPorte(c,m.ratio,cls);
  else{el=document.createElementNS(nsSVG,'polygon');el.setAttribute('points',polyCoffre(c).map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));el.setAttribute('class',cls)}
  // Piégé et encore armé : l'avertissement, chez le MJ seul.
  if(mj&&!oeil&&coffreArme(c)){const w=document.createElement('span');w.className='coffre-alerte';w.textContent='⚠';w.title='Piégé';
   w.style.left=(c.x+c.w/2)+'%';w.style.top=(c.y+c.h/2)+'%';vue.append(w)}
  /* Un joueur a trouvé le coffre verrouillé : un cadenas s'y pose, sous le brouillard — hors de la vue de la
     troupe, on ne le voit pas —, et s'en va quand le coffre s'ouvre. */
  if(c.tente&&coffreVerrouille(c)&&!c.ouvert){const k=document.createElement('span');k.className='coffre-cadenas';k.textContent='🔒';
   k.style.left=(c.x+c.w/2)+'%';k.style.top=(c.y+c.h/2)+'%';$('fog').before(k)}
  if(!c.ouvert){el.style.pointerEvents='all';
   // La bulle : son nom et sa description, au survol, quand l'aventurier choisi est au contact.
   if(typeof surveille==='function')surveille(el,()=>{if(mj?!bullesCoffresMJ:!coffreAPortee(heroActif(),c))return;ouvrirBulle(el,bulleCoffre(c),'bulle-gear')});
   // Un clic ne lui donne pas le focus : le navigateur l'entourait d'un anneau.
   el.onmousedown=e=>e.preventDefault();
   // Le MJ choisit dans un menu ; un joueur, lui, tente d'ouvrir, d'un clic.
   el.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();if(mj)menuCoffre(c,e.clientX,e.clientY);else ouvreCoffreJoueur(c)}}
  calque.append(el)})}
function bulleCoffre(c){const g=document.createElement('div');g.className='gear-detail large';
 const n=document.createElement('p');n.className='gear-nom';n.textContent=c.nom||'Coffre';g.append(n);
 if(c.desc){const p=document.createElement('p');p.className='objet-desc-bulle';p.textContent=c.desc;g.append(p)}
 // Ce qu'il contient, le MJ seul le voit : l'icône de chaque pièce et son nombre, l'or, les gemmes.
 if(view==='mj'){const comptes=new Map();(c.items||[]).forEach(id=>{const o=objetDe(id);if(o)comptes.set(o,(comptes.get(o)||0)+1)});const r=c.richesses||{};
  const l=document.createElement('div');l.className='coffre-contenu-bulle';comptes.forEach((n,o)=>l.append(carreInventaire(o,n)));
  if(r.or>0)l.append(ligneOr(r.or,null));const gem=ligneGemmes(r,null);if(gem)l.append(gem);if(l.childElementCount)g.append(l)}
 if(view==='mj'){const p=document.createElement('p');p.className='muted objet-cache-bulle';
  p.textContent=[c.cache&&!c.revele?'Caché : Perception '+(c.perception||1):'',coffreVerrouille(c)?'Verrou '+c.verrou+(c.cleId?' ou '+nomCle(c.cleId):''):'',coffreArme(c)?'Piège '+c.piege:''].filter(Boolean).join(' · ');if(p.textContent)g.append(p)}
 return g}
// Un petit menu au clic, à la place du pointeur : un titre, des entrées.
function menuCarte(titre,entrees,x,y){fermeMenuObjet();if(!entrees.length)return;const m=document.createElement('div');m.className='menu-objet';m.setAttribute('role','menu');
 const t=document.createElement('p');t.className='menu-objet-titre';t.textContent=titre;m.append(t);
 entrees.forEach(([txt,fn])=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=txt;b.onclick=()=>{fermeMenuObjet();fn()};m.append(b)});
 document.body.append(m);const r=m.getBoundingClientRect();
 m.style.left=Math.max(6,Math.min(x+8,innerWidth-r.width-6))+'px';m.style.top=Math.max(6,Math.min(y+8,innerHeight-r.height-6))+'px';menuObjet=m;
 setTimeout(()=>{document.addEventListener('pointerdown',dehorsMenuObjet,true);document.addEventListener('keydown',echapMenuObjet,true)})}
function menuCoffre(c,x,y){const mj=view==='mj',a=heroActif(),proche=!!a&&coffreAPortee(a,c),entrees=[];
 if(!mj&&!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
 if(!mj&&!proche){log('Approche '+a.name+' : il faut être au contact de '+c.nom+'.',{local:true});return}
 const comps=[[RUSE,'Ruse'],[TECHNIQUE,'Technique']];
 if(proche){if(!coffreVerrouille(c))entrees.push(['Ouvrir',()=>ouvrirCoffre(c,a,false)]);
  else{// Sa clé, si l'aventurier la porte : le verrou cède, la clé reste dans son inventaire.
   if(aLaCle(a,c.cleId))entrees.push(['Déverrouiller avec '+nomCle(c.cleId),()=>{c.deverrouille=true;log(nomNum(a)+' déverrouille '+c.nom+' avec '+nomCle(c.cleId)+'.',{ton:'carte'});render();saveMaps();scheduleSave()}]);
   comps.forEach(([k,n])=>entrees.push(['Déverrouiller · '+n,()=>testCoffre(a,c,'verrou',k)]))}
  if(!c.desamorce)comps.forEach(([k,n])=>entrees.push(['Chercher un piège · '+n,()=>testCoffre(a,c,'piege',k)]))}
 if(mj){if(c.cache)entrees.push([c.revele?'Cacher à la troupe':'Révéler à la troupe',()=>{c.revele=!c.revele;if(c.revele)floatNumber(centreForme(c),'Révélé !','nul');
   log(c.nom+(c.revele?' est révélé.':' est caché.'),{ton:'carte'});render();saveMaps();scheduleSave()}]);
  const h=heroLePlusProche(centreForme(c));if(h&&!(proche&&h===a))entrees.push(['Ouvrir pour '+nomNum(h)+', le plus proche',()=>ouvrirCoffre(c,h,true)])}
 menuCarte(c.nom||'Coffre',entrees,x,y)}
/* Déverrouiller ou chercher un piège : un test de Ruse ou de Technique, assez de réussites. Quand le
   verrou et le piège demandent autant de réussites, réussir l'un vient à bout de l'autre ; sinon,
   chacun le sien. Un piège trouvé est désamorcé. */
function testCoffre(a,c,quoi,k){if(!a||!c||c.ouvert||!payeAction(a))return;
 const jet=skillRoll(valeurCompetence(a,k)-1,d6),n=jet.reussites;rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),a,null);
 let dit;
 if(quoi==='verrou'){if(coffreVerrouille(c)&&n>=c.verrou){c.deverrouille=true;dit='déverrouille '+c.nom;
   if(coffreArme(c)&&c.piege===c.verrou){c.desamorce=true;floatNumber(centreForme(c),'Révélé !','nul');dit+=' et désamorce son piège'}}
  else dit='le verrou résiste'}
 else if(coffreArme(c)&&n>=c.piege){c.desamorce=true;floatNumber(centreForme(c),'Révélé !','nul');dit='trouve un piège et le désamorce';
  if(coffreVerrouille(c)&&c.verrou===c.piege){c.deverrouille=true;dit+=', et déverrouille '+c.nom}}
 else dit='ne trouve aucun piège';
 log(nomNum(a)+' · '+skillNames[k]+' : '+n+' réussite'+(n>1?'s':'')+' ⦃'+jet.des.join(',')+'⦄ — '+dit+'.',{dice:true,ton:'competence'});
 if(enCombat()&&typeof afterAction==='function')afterAction(a);
 render();saveMaps();scheduleSave()}
/* Ouvrir : un piège encore armé se déclenche sur qui est au contact du coffre, puis le contenu va à qui
   l'ouvre — ou, quand c'est le MJ, à l'aventurier le plus proche. */
/* Un joueur clique : son aventurier tente d'ouvrir. Verrouillé, sans la clé, rien ne se passe, sauf la ligne du journal ;
   avec elle, le verrou cède. Piégé, le piège part. */
function ouvreCoffreJoueur(c){const a=heroActif();
 if(!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
 if(!coffreAPortee(a,c)){log('Approche '+a.name+' : il faut être au contact de '+c.nom+'.',{local:true});return}
 if(coffreVerrouille(c)&&!aLaCle(a,c.cleId)){c.tente=true;log(nomNum(a)+' tente d’ouvrir '+c.nom+' : verrouillé.',{ton:'carte'});render();saveMaps();scheduleSave();return}
 if(enCombat()&&pointsRestants(a,'action')<=0){payeAction(a);return}
 if(coffreVerrouille(c)){c.deverrouille=true;log(nomNum(a)+' déverrouille '+c.nom+' avec '+nomCle(c.cleId)+'.',{ton:'carte'})}
 ouvrirCoffre(c,a,false)}
/* En combat, ouvrir coûte l'Action de qui ouvre, que le geste vienne de lui ou du MJ. */
function ouvrirCoffre(c,h,parMJ){if(!c||c.ouvert||(coffreVerrouille(c)&&!parMJ))return;if(h&&!payeAction(h))return;
 if(coffreArme(c)){c.desamorce=true;
  // Le piège part : une gerbe de feu sur le coffre, ici et sur chaque table.
  if(typeof explosionPiege==='function'){explosionPiege(centreForme(c));const m=currentMap();if(m&&typeof diffuserEffet==='function')diffuserEffet('piege',h,null,String((m.coffres||[]).indexOf(c)))}
  const touches=actors.filter(o=>o&&o.hero&&alive(o)&&!o.horsCarte&&dansZoneCoffre(o,c)).map(o=>{const p=[];
   if(c.degats>0){const {perdu:n,blinde}=encaisse(o,c.degats);p.push(blinde?'Blindage consommé':n+' dégât'+(n>1?'s':''))}
   (c.etats||[]).forEach(e=>{if(infligeEtat(o,e)===true)p.push(e)});return nomNum(o)+(p.length?' : '+p.join(', '):'')});
  log('Piège ! '+c.nom+' se déclenche'+(touches.length?' — '+touches.join(' ; '):'')+'.',{ton:'degats'})}
 c.ouvert=true;c.deverrouille=true;
 const pieces=(c.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean),rich=c.richesses||{},gains=[];
 if(h){const parPiece=new Map();pieces.forEach(it=>{if(typeof ajouterInventaire==='function')ajouterInventaire(h,it);else noteInventaire(h,it.name);parPiece.set(it.id,(parPiece.get(it.id)||0)+1)});
  parPiece.forEach((n,id)=>gains.push((n>1?n+' × ':'')+'⟦'+id+'⟧'));
  if(rich.or>0){ajouteOr(h,rich.or);gains.push(rich.or+' or')}
  h.richesses={...(h.richesses||{})};CLES_GEMMES.forEach(k=>{const v=Math.trunc(Number(rich[k]))||0;if(v<=0)return;
   h.richesses[k]=(Math.trunc(Number(h.richesses[k]))||0)+v;const [t,va]=k.split('-');gains.push(v+' '+nomGemme(t,va,false).toLowerCase())})}
 log((h?nomNum(h)+' ouvre '+c.nom:c.nom+' s’ouvre')+(gains.length?' : '+gains.join(', '):', vide')+'.',{ton:'butin'});
 if(h&&enCombat()&&typeof afterAction==='function')afterAction(h);
 render();saveMaps();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
const objetVue=dialog('objet-vue','Objet','<div id="objet-corps"></div>');
function openObjetTable(i){const m=currentMap(),o=m&&m.objets&&m.objets[i];if(!o||(!o.visible&&view!=='mj'))return;
 objetVue.querySelector('h2').textContent=(o.visible?'':'◌ ')+o.nom;
 const corps=$('objet-corps');corps.replaceChildren();
 const p=(cls,txt)=>{const e=document.createElement('p');if(cls)e.className=cls;e.textContent=txt;corps.append(e);return e};
 p(o.desc?'objet-desc':'muted',o.desc||'Aucune description.');
 const a=actors[selected],mien=!!(a&&a.hero&&controlled(selected)&&alive(a)),pres=mien&&objetAPortee(a,o);
 const pourquoi=!mien?'Sélectionne d’abord ton aventurier.':!pres?'Approche ton aventurier : il faut être au contact.':'';
 const liste=(o.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 if(liste.length||o.tresor){const h=document.createElement('h3');h.textContent='À prendre';corps.append(h)}
 liste.forEach(it=>{const ligne=document.createElement('div');ligne.className='objet-ligne';ligne.append(gearPill(it));
  const b=document.createElement('button');b.textContent='Prendre';b.disabled=!pres;b.title=pourquoi;
  b.onclick=()=>{prendreObjet(a,o,it);openObjetTable(i)};ligne.append(b);corps.append(ligne)});
 if(o.tresor){const ligne=document.createElement('div');ligne.className='objet-ligne';
  const t=document.createElement('span');t.className='tresor';t.textContent='✦ '+o.tresor;ligne.append(t);
  const b=document.createElement('button');b.textContent='Ramasser';b.disabled=!pres;b.title=pourquoi;
  b.onclick=()=>{prendreTresor(a,o);openObjetTable(i)};ligne.append(b);corps.append(ligne)}
 if(!liste.length&&!o.tresor&&o.desc)p('muted','Rien à prendre ici.');
 if(pourquoi&&(liste.length||o.tresor))p('muted',pourquoi);
 if(view==='mj'){const outils=document.createElement('div');outils.className='objet-outils';
  const h=document.createElement('h3');h.textContent='Maître du jeu';corps.append(h);
  const voile=document.createElement('button');voile.textContent=o.visible?'Cacher à la troupe':'Révéler à la troupe';
  voile.onclick=()=>{o.visible=!o.visible;log(o.nom+(o.visible?' est révélé.':' est caché.'),{ton:'carte'});render();saveMaps();openObjetTable(i)};
  outils.append(voile);
  if(!o.visible){const test=document.createElement('button');
   test.textContent='🎲 Test : '+skillNames[o.test.comp]+' × '+o.test.reussites+(a&&a.hero?' pour '+a.name:'');
   test.disabled=!(a&&a.hero);test.title=a&&a.hero?'Lance la compétence de l’aventurier sélectionné.':'Sélectionne l’aventurier qui cherche.';
   test.onclick=()=>{objetVue.close();testerObjet(a,o)};outils.append(test)}
  corps.append(outils)}
 objetVue.showModal()}
/* Les portes se dessinent au-dessus du brouillard : une fois découverte, une porte reste
   lisible dans la pénombre. Tant qu'elle est inexplorée, elle n'existe pas. Le calque se
   refait seul, à part de la matière : il suit le socle qu'on tient. */
function renderPortes(){const portes=$('map-doors'),m=currentMap();portes.replaceChildren();if(!m)return;
 (m.doors||[]).forEach((d,i)=>{
  const mj=view==='mj';
  // Un passage secret clos n'existe pas pour la troupe : elle ne voit qu'un mur.
  if(doorHiddenFrom(d,mj)||!doorSeen(d))return;
  // Une porte que ce lecteur peut manœuvrer s'annonce au survol.
  /* La clé de la porte, dans l'inventaire de l'aventurier choisi : elle ouvre ce que seul le MJ ouvrait —
     une porte verrouillée, un passage secret découvert et verrouillé. Elle n'est pas consommée. */
  const parCle=!mj&&d.keyLocked&&!!d.cleId&&aLaCle(heroActif(),d.cleId)&&(!d.secret||d.open||d.decouvert);
  const ouvrable=mj||((!doorLockedFor(d,mj)||parCle)&&doorInReach(d));
  const el=svgPorte(d,m.ratio,'door'+(d.open?' open':'')+(d.keyLocked?' keyed':'')
   +(d.secret?' secret':'')+(ouvrable?' can-open':''));
  el.style.pointerEvents='all';
  el.onclick=()=>{
   if(doorLockedFor(d,mj)&&!parCle){log(d.secret&&!d.open
    ?'Rien ici qu’un mur : ce passage n’existe pas pour la troupe.'
    :'Cette porte est verrouillée : seul le MJ peut l’ouvrir.');return}
   if(!doorInReach(d)){log('Trop loin de la porte : approche ton aventurier pour la manœuvrer.',{local:true});return}
   /* En combat, ouvrir ou fermer coûte un point de Mouvement à qui manœuvre ; sans point,
      la porte ne bouge pas. En exploration, c'est gratuit. */
   const qui=typeof enCombat==='function'&&enCombat()?porteurDePorte(d):null;
   if(qui){if(pointsRestants(qui,'mouvement')<=0){log(nomNum(qui)+' n’a plus de point de Mouvement pour manœuvrer cette porte.',{local:true});
     if(typeof floatNumber==='function')floatNumber(qui,'Plus de Mouvement','nul');return}
    depensePoint(qui,'mouvement')}
   d.open=!d.open;
   render();scheduleSave()};
  portes.append(el)})}
/* Le brouillard ne se recalcule qu'au relâchement du socle, jamais pendant le geste : le
   repeindre à chaque image — une toile de quatre mille pixels, floutée — faisait accrocher
   la main, et c'est la main qui prime. Au relâchement, il est prêt en quelques
   millisecondes : les portes sont testées par lancer de rayon, la mémoire n'est
   réemballée qu'une fois. */

/* ---------- Ouverture d'une carte en combat ---------- */
function modeleActuel(tpl){if(!tpl)return tpl;const liste=catalog.monsters||[];
 const parId=tpl.id&&liste.find(x=>x&&x.id===tpl.id);if(parId)return parId;
 const parNom=liste.filter(x=>x&&x.name===tpl.name);return parNom.length===1?parNom[0]:tpl}
function openBattleMap(id){const m=maps.find(x=>x.id===id);if(!m)return;
 if(!confirm('Ouvrir « '+m.name+' » ? Les aventuriers sont regroupés dans la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.'))return;
 currentMapId=id;mapImage=m.image||null;measureRatio(m,render);
 // Une carte ouverte repart de zéro XP accordée : la rencontre est à venir.
 m.xpAccordee=0;
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 const heros=actors.filter(a=>a.hero);
 // Une carte rechargée rend à chacun ses repos courts.
 // Une carte rechargée rend aussi ses zones à fouiller : les tests de Perception y repartent de zéro.
 // Et ramène sur la table ceux qu'on en avait retirés : ils sont toujours parmi les aventuriers.
 heros.forEach(a=>{a.horsCarte=false;delete a.retire;a.reposCourts=0;a.reposPris=false;a.fouilles=(a.fouilles||[]).filter(f=>f&&f.m!==id)});
 // Et ses objets récupérés reviennent à leur place.
 (m.objets||[]).forEach(o=>{delete o.pris});
 // Placement libre : d'une carte à l'autre, les murs de la nouvelle ne barrent pas le chemin.
 if(m.start)spreadInZone(heros.length,m.start).forEach((p,i)=>moveActor(heros[i],p.x,p.y,true));
 actors.splice(0,actors.length,...heros);
 // Une carte s'ouvre portes closes et brouillard intact : l'état des portes est une affaire de partie.
 (m.doors||[]).forEach(d=>{d.open=false;delete d.decouvert});const grille=fogDims(m);
 // Et ses coffres reviennent comme le MJ les a laissés : cachés, verrouillés, piégés, pleins.
 (m.coffres||[]).forEach(c=>{['revele','deverrouille','desamorce','ouvert','tente'].forEach(k=>delete c[k])});
 m.fog=packMask(new Uint8Array(grille.n),grille.n);delete m.seen;m.fogOff=false;fogSeen=null;fogSeenSrc=null;fogKey='';
 /* L'invisibilité ne se pose plus sur la carte : c'est un état, donné en jeu. Une carte
    tracée avant la v0.82 garde ses invisibles, mais sous forme d'état. */
 /* Le modèle a été recopié sur la carte le jour où l'adversaire y a été posé ; le
    bestiaire, lui, a pu changer depuis. C'est le bestiaire qui fait foi : le modèle du
    même identifiant, ou à défaut du même nom s'il est seul à le porter. La copie ne
    sert plus que si le modèle a disparu. */
 (m.foes||[]).forEach(f=>{const a=fromMonster(modeleActuel(f.tpl));a.x=f.x;a.y=f.y;
  // Le lien vers sa pose : l'éditeur retrouve ainsi l'adversaire en jeu.
  if(!f.id)f.id=crypto.randomUUID();a.pose=f.id;
  // Ce que la carte lui a donné, à lui seul.
  if(Array.isArray(f.inventaire)&&f.inventaire.length){a.propres={inventaire:[...f.inventaire],butin:{...(f.butin||{})}};ajoutePropres(a,a.propres)}
  normalizeActor(a);
  if(f.hidden)setState(a,'Invisible',true);
  // Caché par le MJ dans l'éditeur : la troupe ne le voit pas tant qu'il ne le révèle pas d'un clic.
  if(f.cache)a.hidden=true;actors.push(a)});
 /* Une carte qui s'ouvre, c'est une rencontre à venir : tour 1, tout remis à zéro, et la
    troupe en exploration — le combat commencera de lui-même au premier adversaire révélé. */
 if(typeof remiseAuTourUn==='function')remiseAuTourUn();
 mode='exploration';
 render();actors.forEach(a=>settleActor(a));   // Personne ne démarre dans un mur.

 actors.forEach(a=>{a.target=null});
 owner=actors.findIndex(a=>a.hero);selected=Math.max(0,owner);
 resetMapZoom();showPage('table');render();
 scheduleSave()}

/* ---------- Onglets de page, réservés au MJ ---------- */
const tabs=document.createElement('nav');tabs.className='tabs';
tabs.innerHTML='<button data-page="table" class="on">Table de jeu</button><button data-page="maps">Cartes</button>'
 +'<button data-page="domaine">Domaine</button><button data-page="heroes">Aventuriers</button><button data-page="talents">Talents</button>'
 +'<button data-page="armory">Armurerie</button><button data-page="bestiary">Bestiaire</button><button data-page="icones">Icônes</button>'
 +'<button data-page="settings">Paramètres</button>';
document.querySelector('.view-controls').before(tabs);
const PAGES=['table','maps','domaine','heroes','talents','armory','bestiary','icones','settings'];
/* La troupe voit les onglets que le MJ lui ouvre dans les Paramètres — ongletsJoueurs() : la Table
   toujours, les Cartes jamais. Tout ce qui s'y modifie reste au MJ — voir « vue-joueur » dans editor.css. */
function majOnglets(){const ouverts=ongletsJoueurs();{const cv=$('conversion-ouvre');if(cv)cv.hidden=view!=='mj'}tabs.querySelectorAll('button').forEach(b=>{b.hidden=view!=='mj'&&!ouverts.includes(b.dataset.page)});
 document.body.classList.toggle('vue-joueur',view!=='mj');
 if(view!=='mj'&&PAGES.some(x=>!ouverts.includes(x)&&document.body.classList.contains('page-'+x)))showPage('table',false)}
/* L'onglet ouvert est un réglage d'appareil, comme le thème : recharger en plein
   travail au bestiaire doit y ramener, pas rejeter sur la table de jeu. Il ne voyage
   donc ni dans la sauvegarde de partie, ni dans la publication. */
function rememberPage(p){try{localStorage.setItem('amertume-page',p)}catch(e){}}
function lastPage(){try{const p=localStorage.getItem('amertume-page');
 return PAGES.includes(p)?p:'table'}catch(e){return 'table'}}
/* « retenir » distingue le choix d'un onglet du repli imposé : passer en vue joueur
   ramène à la table, mais cela ne doit pas effacer l'onglet où le MJ travaillait. */
function showPage(p,retenir=true){if(!ongletsJoueurs().includes(p)&&view!=='mj')return;
 // Une bulle ouverte appartient à la page qu'on quitte : elle s'en va avec elle.
 if(typeof fermerBulle==='function')fermerBulle();
 if(retenir)rememberPage(p);
 PAGES.forEach(x=>document.body.classList.toggle('page-'+x,x===p&&x!=='table'));
 tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.page===p));
 if(p==='maps'){if(!maps.length)newMap();if(!mapDraft)mapDraft=maps.find(m=>m.id===currentMapId)||maps[0];
  // La carte du domaine, si c'est elle qu'on éditait, se rouvre à sa place.
  if(typeof domaineEdite!=='undefined'&&domaineEdite){renderMapList();renderDomaineEditeur()}
  else{measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas()}}
 else if(p==='table')render();
 else if(p==='domaine')renderDomaine();
 else if(p==='heroes')renderHeroes();
 else if(p==='talents')renderTalents();
 else if(p==='armory')renderArmory();
 else if(p==='bestiary')renderBestiary();
 else if(p==='icones')renderIcones();
 else if(p==='settings')renderSettings();
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
 +'<p class="muted">Un fichier qui contient toutes tes cartes : zones, portes, découpes, zone de départ, adversaires, objets et image de fond. Le domaine n’y est pas : il s’exporte depuis son onglet, et la partie entière depuis les Paramètres.</p>'
 +'<div class="side-actions"><button id="map-export">⇩ Exporter</button><button id="map-import">⇧ Importer</button></div>'
 +'<input type="file" id="map-json" accept="application/json,.json" hidden></aside>'
 +'<section class="maps-main panel"><div class="maps-bar"><label class="grow">Nom de la carte<input id="map-name" maxlength="80"></label><span class="map-xp" id="map-xp"></span>'
 +'<button id="map-image">Image de fond</button><button id="map-image-clear">Retirer l’image</button><button id="map-play" class="primary">Ouvrir en combat</button></div>'
 +'<input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="tool-bar" id="map-tools"><button data-tool="select">Sélection</button><button data-tool="wall">Zone de blocage</button>'
 +'<button data-tool="ligne">Ligne de blocage</button><button data-tool="pinceau">Pinceau de blocage</button>'
 +'<button data-tool="cut">Découper</button><button data-tool="lasso">Découpe libre</button><button data-tool="gomme">Pinceau de découpe</button>'
 +'<select id="pinceau-taille" aria-label="Grosseur du pinceau" hidden><option value=".3">Pinceau fin</option><option value=".55" selected>Pinceau moyen</option><option value="1">Pinceau large</option></select>'
 +'<button data-tool="door">Porte</button><button data-tool="secret">Passage secret</button><button data-tool="start">Zone de départ</button>'
 +'<button data-tool="foe">Adversaire</button><select id="map-foe-tpl" aria-label="Modèle d’adversaire"></select>'
 +'<button data-tool="objet">+ Objet</button><button data-tool="coffre">Coffre</button><button data-tool="coffrerond">Coffre rond</button>'
 +'<span class="bar-sep"></span><button data-tool="zones">Zones</button><button data-tool="separer">Séparer les zones</button><button data-tool="regrouper">Regrouper les zones</button>'
 +'<span class="bar-sep"></span><button id="undo" title="Annuler (⌘Z)">↶ Annuler</button><button id="redo" title="Rétablir (⇧⌘Z)">↷ Rétablir</button>'
 +'<span class="bar-sep"></span><button id="czoom-out" aria-label="Dézoomer">−</button><span id="czoom-label" class="muted">100 %</span>'
 +'<button id="czoom-in" aria-label="Zoomer">+</button><button id="czoom-reset">Ajuster</button></div>'
 +'<div class="canvas-wrap"><div id="map-canvas"></div></div><p class="muted" id="map-hint"></p></section>'
 +'<aside class="maps-props panel"><h2>Forme sélectionnée</h2><p class="muted" id="shape-label">Aucune sélection.</p>'
 +'<button id="shape-lock" hidden>🔒 Verrouiller</button>'
  +'<label id="door-key-label" hidden><input type="checkbox" id="door-key"> Verrouillée — le MJ seul l’ouvre</label>'
  +'<label id="door-secret-label" hidden><input type="checkbox" id="door-secret"> Passage secret — un mur pour la troupe tant qu’il est clos</label>'
  +'<label id="door-perception-label" hidden>Réussites de Perception pour le trouver <input type="number" id="door-perception" min="1" max="9"></label>'
  +'<label id="foe-cache-label" hidden><input type="checkbox" id="foe-cache"> Caché — le MJ le révèle d’un clic en jeu</label>'
  +'<button id="foe-objets" hidden>✎ Objets portés</button>'
  +'<label id="door-cle-label" hidden>Clé qui l’ouvre <select id="door-cle"></select></label>'
  +'<button id="coffre-edit" hidden>✎ Modifier le coffre</button><button id="coffre-double" hidden>⧉ Dupliquer le coffre</button>'
 +'<button id="objet-edit" hidden>✎ Modifier l’objet</button>'
 +'<button id="shape-delete" hidden>Supprimer la forme</button>'+'<div class="divider"></div><h2 id="echelle-titre">Échelle de la carte</h2>'+'<p class="muted" id="echelle-info"></p>'+'<p class="muted">Le socle témoin se promène sur la carte : pose-le contre une porte, un lit, un couloir, et tire son coin jusqu’à ce qu’un combattant y tienne. Il ne paraît jamais en partie.</p>'+'<button id="echelle-reset">Rétablir la mesure d’origine</button>'+'<div class="divider"></div><h2>Légende</h2>'
 +'<ul class="legend"><li><i class="sw-wall"></i>Zone de blocage — coupe la vue et le passage</li>'+'<li><i class="sw-ligne"></i>Ligne de blocage — la même chose, d’un seul trait fin</li>'
 +'<li><i class="sw-cut"></i>Découper — ouverture rectangulaire dans les zones de blocage</li>'+'<li><i class="sw-cut"></i>Découpe libre — contour tracé ou point par point, pour les formes rondes</li>'
 +'<li><i class="sw-door"></i>Porte — close au début du combat, ouverte d’un clic en jeu</li>'+'<li><i class="sw-key"></i>Porte verrouillée — le MJ seul peut l’ouvrir</li>'+'<li><i class="sw-secret"></i>Passage secret — un mur pour la troupe tant qu’il est clos</li>'
 +'<li><i class="sw-start"></i>Zone de départ des aventuriers</li>'
 +'<li><i class="sw-wall"></i>Pinceau de blocage — de la matière peinte à main levée</li>'
 +'<li><i class="sw-cut"></i>Pinceau de découpe — la même chose en négatif, il gratte</li>'
 +'<li><i class="sw-foe"></i>Adversaire pré-placé</li>'
 +'<li><i class="sw-objet"></i>Objet ou mécanisme — visible, la troupe l’ouvre d’un clic ; caché, un test de compétence le découvre</li></ul><p class="muted" id="map-count"></p>'
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
// Quand c'est la carte du domaine qu'on édite, ces touches sont à son éditeur (domaine.js).
const editeDomaine=()=>typeof domaineEdite!=='undefined'&&domaineEdite;
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps')||editeDomaine())return;
 if(e.key.toLowerCase()!=='z'||!(e.metaKey||e.ctrlKey))return;
 if(e.target.closest('input,textarea,select'))return;
 e.preventDefault();e.shiftKey?redo():undo()});
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps')||editeDomaine()||!lasso)return;
 if(e.key==='Enter'){e.preventDefault();applyLasso()}
 else if(e.key==='Escape'){e.preventDefault();if(!annulerTrait()){lasso=null;renderCanvas()}}});
// Échap abandonne un trait ou un lien de zones en cours.
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps')||editeDomaine()||!zoneTrait||e.key!=='Escape')return;
 e.preventDefault();zoneTrait=zoneVise=null;dessineZonesEditeur()});
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('page-maps')||editeDomaine())return;
 if(e.key!=='Delete'&&e.key!=='Backspace')return;
 if(e.target.closest('input,textarea,select'))return;
 if(!supprimeSelection())return;
 e.preventDefault();
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
// Supprimer, c'est enlever la zone entière, trous compris — ou la porte, le départ, l'adversaire.
function supprimeSelection(){const m=mapDraft;if(!m||!mapSel)return false;
 const p=polygoneSel();
 if(p){if(p.verrou)return false;pushUndo();matiereDe(m).splice(mapSel.i,1)}
 else{const cible=shapeAt(mapSel);if(!cible||cible.locked)return false;pushUndo();removeShape(mapSel)}
 mapSel=null;return true}

/* ---------- Cartes ---------- */
function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,ratio:16/9,fitted:true,matiere:[],doors:[],start:null,foes:[],objets:[],coffres:[],echelle:{x:8,y:8,t:SOCLE_DEFAUT}};
 maps.push(m);mapDraft=m;mapSel=null;undoStack=[];redoStack=[];return m}
function ensure(m){m.doors??=[];m.foes??=[];m.ratio??=16/9;
 // Les zones séparées, regroupées ou nommées par le MJ : nées en v0.252.
 m.zonesCoupures??=[];m.zonesLiens??=[];m.zonesNoms??=[];
 // Les objets sont nés en v0.144 ; chacun porte un identifiant, la table s'y réfère.
 m.objets??=[];m.objets.forEach(o=>{o.id||=crypto.randomUUID();o.test??={comp:3,reussites:1};o.items??=[]});
 // Les coffres sont nés en v0.502.
 m.coffres??=[];m.coffres.forEach(c=>{c.id||=crypto.randomUUID();c.items??=[];c.richesses??={};c.etats??=[]});
 m.echelle??={x:8,y:8,t:SOCLE_DEFAUT};
 // Une carte d'avant — rectangles, traits, zones de vision — est fondue en matière exacte.
 matiereDe(m);return m}
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
 log(maps.length+' carte(s) exportée(s) dans un fichier.',{local:true})};
$('map-import').onclick=()=>$('map-json').click();
$('map-json').onchange=()=>{const f=$('map-json').files[0];$('map-json').value='';if(!f)return;
 const lecteur=new FileReader();
 lecteur.onerror=()=>alert('Lecture du fichier impossible.');
 lecteur.onload=()=>{let entrantes;
  /* Un autre fichier d'Amertume se reconnaît : une sauvegarde globale donne ses cartes, si on
     le veut ; un domaine ou une campagne disent où ils se reprennent. */
  try{entrantes=readMapsFile(String(lecteur.result))}catch(e){let o=null;try{o=JSON.parse(String(lecteur.result))}catch(_){}
   const cartes=o&&typeof o==='object'&&Array.isArray(o.actors)&&Array.isArray(o.maps)?o.maps.filter(m=>m&&typeof m==='object'):null;
   if(cartes&&cartes.length){if(!confirm('Ce fichier est une sauvegarde globale de la partie, pas un export de cartes.\nImporter ses '+cartes.length+' carte(s) ici, à côté des tiennes ?\nLe domaine et le reste de la partie se reprennent dans Paramètres → Sauvegarde globale.'))return;
    entrantes=cartes.slice(0,60).map(cleanMap)}
   else{alert(o&&typeof o==='object'&&Array.isArray(o.actors)?'Ce fichier est une sauvegarde globale de la partie, sans carte à importer ici.\nLe domaine et le reste de la partie se reprennent dans Paramètres → Sauvegarde globale.'
    :o&&o.genre==='domaine'?'Ce fichier est un export du domaine : reprends-le dans l’onglet Domaine, bouton « Importer ».'
    :o&&o.genre==='campagne'?'Ce fichier est une campagne : reprends-la dans Paramètres → Campagnes.':e.message);return}}
  entrantes.forEach(m=>{m.id=crypto.randomUUID();m.name+=' (importée)';maps.push(m)});
  mapDraft=maps[maps.length-1];mapSel=null;undoStack=[];redoStack=[];
  measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas();saveMaps();
  log(entrantes.length+' carte(s) importée(s).',{local:true})};
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
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;if(mapTool!=='lasso')lasso=null;
 $('pinceau-taille').hidden=mapTool!=='pinceau'&&mapTool!=='gomme';
 zoneTrait=zoneVise=null;
 // Changer d'outil abandonne le tracé en cours : on ne finit pas un trait à la truelle.
 if(mapTool!=='ligne')traitDepart=traitVise=null;
 renderCanvas()});

/* La liste des cartes : le nom seul, sur une ligne ; en vert, celle qui est chargée sur la table.
   Le détail — zones, portes, adversaires, objets — se lit au survol. */
function renderMapList(){$('map-list').replaceChildren(...maps.map(m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');
 const nom=document.createElement('strong');nom.textContent=m.name;ensure(m);
 b.title=m.name+(m.id===currentMapId?' — chargée sur la table':'')+'\n'+matiereDe(m).length+' zone(s) · '+m.doors.length+' porte(s) · '+m.foes.length+' adversaire(s)'+((m.objets||[]).length?' · '+m.objets.length+' objet(s)':'');
 b.append(nom);b.onclick=()=>{mapDraft=m;mapSel=null;undoStack=[];redoStack=[];measureRatio(m,renderCanvas);renderMapList();renderCanvas()};return b}));
 if(mapDraft)$('map-name').value=mapDraft.name;
 $('map-foe-tpl').replaceChildren();catalog.monsters.forEach((m,i)=>$('map-foe-tpl').add(new Option(m.name,String(i))))}

/* Le tracé se fait en deux clics : le premier pose l'origine, le second arrête le trait.
   Maj le contraint aux huit directions, comme dans n'importe quel outil de dessin. */
let traitDepart=null,traitVise=null;
function traitContraint(a,b,droit,ratio){if(!droit||!a)return b;
 const r=Math.max(.05,Number(ratio)||16/9);
 const dx=(b.x-a.x)*r,dy=b.y-a.y,L=Math.hypot(dx,dy);
 if(!L)return b;
 const pas=Math.PI/4,ang=Math.round(Math.atan2(dy,dx)/pas)*pas;
 return {x:a.x+Math.cos(ang)*L/r,y:a.y+Math.sin(ang)*L}}
/* Aimantation : à portée d'une extrémité déjà posée, le trait s'y accroche. C'est ainsi
   qu'on ferme un carré sans le manquer d'un cheveu. Le seuil se resserre quand on zoome,
   pour ne pas gêner un tracé serré. */
function boutAimante(p,ratio){const m=mapDraft;if(!m)return null;
 const r=Math.max(.05,Number(ratio)||16/9);
 let meilleur=null,court=2.6/Math.max(1,zoomC);
 const test=(x,y)=>{const d=Math.hypot((p.x-x)*r,p.y-y);if(d<court){court=d;meilleur={x,y}}};
 // Les angles de la matière sont autant de points d'accroche : on y ferme une pièce net.
 matiereDe(m).forEach(p=>p.anneaux.forEach(r=>r.forEach(q=>test(q[0],q[1]))));
 if(traitDepart)test(traitDepart.x,traitDepart.y);
 return meilleur}
function viseTrait(p,droit,ratio){const bout=boutAimante(p,ratio);
 return bout?{x:bout.x,y:bout.y,aimante:true}:traitContraint(traitDepart,p,droit,ratio)}
function annulerTrait(){if(!traitDepart)return false;traitDepart=traitVise=null;renderCanvas();return true}
const HINTS={select:'Clique une zone de blocage, une porte ou un adversaire pour le sélectionner, glisse pour le déplacer, tire un coin pour le redimensionner. ⌘Z annule.',
 wall:'Trace un rectangle de blocage : il coupe la vue et le passage, et fond avec la matière qu’il touche. Suppr efface la sélection.',
 ligne:'Un clic pose l’origine du trait, un second l’arrête. ⌘ (ou Ctrl) le redresse à l’horizontale, à la verticale ou à quarante-cinq degrés. Maj au second clic pose un point d’appui : le trait s’arrête là et le suivant en repart, de quoi longer une salle entière sans relever la main. Près d’une extrémité déjà posée, le tracé s’y aimante — une pastille verte le dit — et le carré se ferme juste. Échap abandonne.',
 cut:'Trace un rectangle dans la matière : la découpe y creuse exactement ce rectangle, vue et passage rétablis.',
 lasso:'Contourne la forme à creuser : glisse pour tracer à main levée, ou clique point par point. La découpe suit exactement ton tracé. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 door:'Trace une porte : elle perce d’elle-même la matière qu’elle recouvre, et le mur se referme si tu la déplaces. Sélectionne-la et tire sa poignée ronde pour la tourner — pour une porte de biais. Maj tourne par crans de quinze degrés. Close à chaque ouverture de la carte, elle s’ouvre d’un clic en partie — sauf si tu la verrouilles, auquel cas le MJ seul la manœuvre.',
 secret:'Trace un passage secret à même le mur — et tourne-le par sa poignée ronde s’il est de biais : tant qu’il est clos, il ne perce rien et la troupe ne voit qu’un mur — toi seul le devines à son trait violet, et toi seul l’ouvres. Ouvert, il devient une porte comme une autre.',
 start:'Trace la zone où les aventuriers seront regroupés à l’ouverture de la carte. Une seule par carte.',
 pinceau:'Glisse pour peindre de la matière à main levée, comme au feutre. Le trait se fond dans les zones qu’il touche. Sa grosseur se choisit à côté, en fraction de socle : elle suit donc l’échelle de la carte.',
 gomme:'Glisse pour gratter la matière, comme à la gomme. Ce qui est verrouillé résiste. Sa grosseur se choisit à côté.',
 coffre:'Trace un coffre comme une porte : sa fiche s’ouvre aussitôt — nom, description, caché ou non, verrou, piège et contenu. La poignée ronde le fait tourner.',
 coffrerond:'Trace un coffre rond : un tonneau, une urne, un nid. Sa fiche s’ouvre aussitôt ; la poignée ronde le fait tourner.',
 foe:'Clique pour poser l’adversaire choisi à droite de la barre. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
 objet:'Clique pour poser un objet ou un mécanisme : coffre, levier, trésor. Sa fiche s’ouvre aussitôt — nom, taille, description, objets à prendre, et s’il est caché, le test qui le découvre. Double-clic sur un objet posé pour le modifier.',
 zones:'Les zones : toute étendue close par la matière et les portes en est une, chacune de sa couleur et de son numéro. Clique un numéro pour le renommer. Clique un trait de séparation ou un lien pour le choisir, Suppr l’efface.',
 separer:'Deux clics tracent un trait qui coupe une zone en deux — un seuil, une arche — sans rien bloquer d’autre. Il s’aimante aux angles de la matière et aux bords de la carte. Échap abandonne, Suppr efface le trait choisi.',
 regrouper:'Un clic dans une zone, un clic dans une autre : les deux n’en font plus qu’une. Suppr efface le lien choisi.'};
// Le plan de travail adopte le rapport de la carte et occupe la place disponible.
function sizeCanvas(){const c=$('map-canvas'),w=document.querySelector('.canvas-wrap');
 const ratio=(mapDraft&&mapDraft.ratio)||16/9,dispoW=w.clientWidth||600,dispoH=w.clientHeight||400;
 let lw=dispoW,lh=lw/ratio;if(lh>dispoH){lh=dispoH;lw=lh*ratio}
 c.style.width=Math.round(lw)+'px';c.style.height=Math.round(lh)+'px'}
function renderCanvas(){const c=$('map-canvas'),m=mapDraft;$('map-hint').textContent=HINTS[mapTool]||'';
 document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===mapTool));
 c.replaceChildren();sizeCanvas();applyCanvasZoom();majEchelle();if(!m)return;ensure(m);
 /* La matière est peinte d'un seul tenant, percée de ses portes : l'éditeur montre le
    mur du jeu. Pendant qu'on déplace une zone, elle se peint à part, par-dessus : deux
    contours superposés se liraient sinon comme un trou, le temps du geste. */
 const contours=draftSkin(m);
 const bouge=mapDrag&&mapDrag.mode==='masse'?matiereDe(m)[mapDrag.i]:null;
 const fixes=bouge?contours.filter(r=>!bouge.anneaux.includes(r)):contours;
 if(fixes.length||bouge)c.append(svgMatiere([fixes,bouge?bouge.anneaux:[]],null,'wall-skin'));
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 m.doors.forEach((r,i)=>c.append(shapeEl('door',i,r)));
 m.coffres.forEach((r,i)=>c.append(shapeEl('coffre',i,r)));
 // L'aperçu du rectangle en cours — bloc ou découpe — tant que la main n'a pas lâché.
 if(cutRect)c.append(shapeEl(cutRect.bloc?'bloc':'cut',0,cutRect));
 if(lasso&&lasso.pts.length){const svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','lasso-layer');
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
  const forme=document.createElementNS(nsSVG,lasso.pts.length>2?'polygon':'polyline');
  forme.setAttribute('points',lasso.pts.map(pt=>pt.join(',')).join(' '));svg.append(forme);
  /* Les points d'étape ne sont pas des cercles mais des traits de longueur nulle à bout
     rond : un cercle est dessiné dans l'espace de la carte, donc étiré par son rapport et
     grossi par le zoom — d'où des pastilles énormes dès qu'on approche. Un bout de trait,
     lui, garde sa taille à l'écran, comme les pointillés du contour. */
  lasso.pts.forEach(pt=>{const o=document.createElementNS(nsSVG,'path');
   o.setAttribute('class','point');
   o.setAttribute('d','M'+pt[0]+' '+pt[1]+'L'+pt[0]+' '+pt[1]);svg.append(o)});
  c.append(svg)}
 if(m.start)c.append(shapeEl('start',0,m.start));
 m.foes.forEach((f,i)=>c.append(foeEl(i,f)));
 m.objets.forEach((o,i)=>c.append(objetEl(i,o)));
 // Le socle témoin par-dessus tout le reste : c'est lui qu'on vient comparer.
 const jauge=echelleEl();if(jauge)c.append(jauge);
 dessineTraits();dessineZonesEditeur();
 // La zone choisie, éclairée d'un bloc, et sa boîte de manœuvre par-dessus.
 const masse=polygoneSel();
 if(masse){c.append(svgSelection(masse));const boite=boiteSelection(masse);if(boite)c.append(boite)}
 const cible=mapSel?shapeAt(mapSel):null;
 const adv=mapSel&&mapSel.kind==='foe'?cible:null,porte=mapSel&&mapSel.kind==='door'?cible:null;
 const obj=mapSel&&mapSel.kind==='objet'?cible:null;$('objet-edit').hidden=!obj;
 const coffre=mapSel&&mapSel.kind==='coffre'?cible:null;$('coffre-edit').hidden=$('coffre-double').hidden=!coffre;
 $('door-cle-label').hidden=!(porte&&porte.keyLocked);if(porte&&porte.keyLocked)remplitCles($('door-cle'),porte.cleId||'');
 $('door-key-label').hidden=$('door-secret-label').hidden=!porte;
 if(porte){$('door-key').checked=!!porte.keyLocked;$('door-secret').checked=!!porte.secret}
 $('door-perception-label').hidden=!(porte&&porte.secret);if(porte&&porte.secret)$('door-perception').value=Number(porte.perception)||1;
 $('foe-cache-label').hidden=$('foe-objets').hidden=!adv;if(adv)$('foe-cache').checked=adv.cache===true;
 const verrou=masse?!!masse.verrou:!!(cible&&cible.locked);
 $('shape-delete').hidden=!mapSel||verrou;$('shape-lock').hidden=!mapSel||mapSel.kind==='coupure'||mapSel.kind==='lien';
 if(mapSel)$('shape-lock').textContent=verrou?'🔓 Déverrouiller':'🔒 Verrouiller';
 /* Une masse ne s'annonce pas en morceaux : elle est « la zone de blocage », qu'elle soit
    née d'un rectangle, d'un coup de pinceau ou de vingt gestes mêlés. */
 $('shape-label').textContent=mapSel?(porte&&porte.secret?'Passage secret':KINDS[mapSel.kind])
  +(adv?' · '+adv.tpl.name+(adv.cache?' · caché':''):'')+(obj?' · '+obj.nom+(obj.visible?'':' · caché'):'')+(coffre?' · '+coffre.nom+(coffre.cache?' · caché':''):'')+(verrou?' · verrouillée':''):'Aucune sélection.';
 $('map-xp').textContent=xpDeCarte(m)+' xp';
 $('map-count').textContent=matiereDe(m).length+' zone(s) de blocage, '+m.doors.length+' porte(s), '
  +m.foes.length+' adversaire(s), '+m.objets.length+' objet(s), '+m.coffres.length+' coffre(s)'+(m.start?', zone de départ définie.':', aucune zone de départ.');
 $('recal-box').hidden=!recalNeeded();
 refreshHistory()}
// Portes, zone de départ et aperçus de tracé sont des boîtes ; la matière, elle, est peinte.
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(r.locked?' locked':'')+(kind==='door'&&r.keyLocked?' keyed':'')+(kind==='door'&&r.secret?' secret':'')+(kind==='coffre'&&r.cache?' cache':'')+(kind==='coffre'&&r.rond?' rond':'')
  +(mapSel&&mapSel.kind===kind&&mapSel.i===i?' selected':'');
 el.style.left=r.x+'%';el.style.top=r.y+'%';el.style.width=r.w+'%';el.style.height=r.h+'%';
 // Une porte de biais tourne autour de son centre ; ses coins tournent avec elle et la
 // redimensionnent dans son repère. La poignée ronde, au-dessus, la fait pivoter.
 if((kind==='door'||kind==='coffre')&&(Number(r.a)||0))el.style.transform='rotate('+r.a+'deg)';
 el.dataset.kind=kind;el.dataset.i=i;
 [...['nw','ne','sw','se'],...(kind==='door'||kind==='coffre'?['rot']:[])].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;
  if(g==='rot')h.title=(kind==='coffre'?'Tourner le coffre':'Tourner la porte')+' — Maj par crans de 15°';el.append(h)});
 // Un coffre : sa bulle au survol, comme en partie, contenu compris ; piégé, l'avertissement du MJ.
 if(kind==='coffre'){if(r.piege>0)el.append(Object.assign(document.createElement('span'),{className:'coffre-alerte',textContent:'⚠',title:'Piégé'}));
  if(typeof surveille==='function')surveille(el,()=>{if(!mapDrag)ouvrirBulle(el,bulleCoffre(r),'bulle-gear')})}
 return el}
/* La zone choisie s'éclaire d'un seul tenant, trous compris : un seul tracé, à la règle
   pair-impair, dans un groupe translucide. */
function svgSelection(p){const svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','calque-masse');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 const bloc=document.createElementNS(nsSVG,'g'),el=document.createElementNS(nsSVG,'path');
 el.setAttribute('d',p.anneaux.map(r=>'M'+r.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L')+'Z').join(''));
 el.setAttribute('fill-rule','evenodd');bloc.append(el);svg.append(bloc);return svg}
// La boîte de la zone : le liseré qui dit son étendue, et les quatre poignées qui la tirent.
function boiteSelection(p){const b=boitePolygone(p);if(!b)return null;
 const el=document.createElement('div');
 el.className='boite-masse'+(p.verrou?' locked':'');
 el.style.left=b.x+'%';el.style.top=b.y+'%';el.style.width=b.w+'%';el.style.height=b.h+'%';
 el.dataset.kind='matiere';el.dataset.i=mapSel.i;
 if(!p.verrou)['nw','ne','sw','se'].forEach(k=>{const h=document.createElement('span');
  h.className='grip '+k;h.dataset.grip=k;el.append(h)});
 return el}
/* Un objet sur le plan de travail : un socle rond, comme un adversaire, à la taille qu'il
   aura en partie ; caché, il se dessine en pointillé. */
let clicObjet=null,clicCoffre=null;
function objetEl(i,o){const el=document.createElement('div');
 el.className='shape objet'+(o.visible?'':' cache')+(o.locked?' locked':'')+(mapSel&&mapSel.kind==='objet'&&mapSel.i===i?' selected':'');
 const t=Math.max(10,$('map-canvas').clientWidth*echelleSocle(mapDraft)/100*(SOCLE_TAILLES[o.taille]||1));
 el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';el.style.fontSize=(t*.47)+'px';
 el.style.left=o.x+'%';el.style.top=o.y+'%';el.dataset.kind='objet';el.dataset.i=i;
 poseLogoObjet(el,o);el.title=o.nom+(o.visible?'':' · caché')+' — double-clic pour modifier';
 el.ondblclick=e=>{e.stopPropagation();openObjet(i)};
 return el}
function foeEl(i,f){const el=document.createElement('div');
 el.className='shape foe'+(f.locked?' locked':'')+(f.cache?' cache':'')+(mapSel&&mapSel.kind==='foe'&&mapSel.i===i?' selected':'');
 // Même taille relative qu'en partie, socle compris : un petit reste petit, un énorme énorme.
 const t=Math.max(10,$('map-canvas').clientWidth*echelleSocle(mapDraft)/100*socleFacteur(f.tpl));
 el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';el.style.fontSize=(t*.47)+'px';
 el.style.left=f.x+'%';el.style.top=f.y+'%';el.dataset.kind='foe';el.dataset.i=i;
 /* Le socle porte l'illustration du bestiaire, comme à la table : on reconnaît d'un coup
    d'œil ce qu'on a posé, au lieu d'une initiale commune à toute une famille. */
 if(f.tpl&&f.tpl.image){const im=document.createElement('img');im.className='portrait';
  im.src=f.tpl.image;im.alt='';im.draggable=false;el.append(im)}
 else el.textContent=(f.tpl.name||'?')[0];
 el.title=f.tpl.name;return el}
// Ne creuse que les zones libres : une zone verrouillée résiste au grattage.
/* Le tracé en cours d'une ligne de blocage, en pointillé, tant que le second clic n'est
   pas venu. Un trait validé n'est plus un objet : il est fondu dans la matière. */
function dessineTraits(){const c=$('map-canvas'),m=mapDraft;if(!c||!m)return;
 let svg=c.querySelector('.calque-traits');
 if(!svg){svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','calque-traits');
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');c.append(svg)}
 svg.replaceChildren();
 if(traitDepart&&traitVise){const l=document.createElementNS(nsSVG,'line');
  l.setAttribute('x1',traitDepart.x);l.setAttribute('y1',traitDepart.y);
  l.setAttribute('x2',traitVise.x);l.setAttribute('y2',traitVise.y);
  l.setAttribute('class','trait-apercu');svg.append(l);
  // L'aimant se voit : une pastille verte au bout du tracé quand il s'accroche.
  if(traitVise.aimante){const o=document.createElementNS(nsSVG,'ellipse');
   const r=Math.max(.05,Number(m.ratio)||16/9),rx=.7/Math.max(1,zoomC);
   o.setAttribute('cx',traitVise.x);o.setAttribute('cy',traitVise.y);
   o.setAttribute('rx',rx);o.setAttribute('ry',rx*r);
   o.setAttribute('class','trait-aimant');svg.append(o)}}}
function echelleEl(){const m=mapDraft;if(!m)return null;ensure(m);
 const large=$('map-canvas').clientWidth||600,t=Math.max(8,large*echelleSocle(m)/100);
 const el=document.createElement('div');el.className='echelle-token';
 el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';
 el.style.left=m.echelle.x+'%';el.style.top=m.echelle.y+'%';
 const nom=document.createElement('span');nom.className='echelle-nom';nom.textContent='SOCLE';
 const poignee=document.createElement('span');poignee.className='echelle-grip';
 poignee.dataset.echelleGrip='1';poignee.title='Tirer pour régler l’échelle';
 el.append(nom,poignee);
 el.title='Socle témoin : promène-le sur la carte pour comparer, tire son coin pour régler la taille des socles. Invisible en partie.';
 return el}
/* L'échelle appartient à la carte ouverte dans l'éditeur, et à elle seule : le panneau
   la nomme, pour qu'on ne croie jamais régler toutes les cartes d'un coup. */
function majEchelle(){const b=$('echelle-info'),t=$('echelle-titre');if(!b||!mapDraft)return;
 if(t)t.textContent='Échelle de « '+(mapDraft.name||'cette carte')+' »';
 const pc=echelleSocle(mapDraft),large=$('map-canvas').clientWidth||600;
 const jeu=$('map').clientWidth||0;
 b.textContent='Socle moyen : '+pc.toFixed(2).replace('.',',')+' % de la largeur de cette carte · '
  +Math.round(large*pc/100)+' px ici'
  +(jeu?' · '+Math.round(jeu*pc/100)+' px sur la table':'')
  +(Math.abs(pc-SOCLE_DEFAUT)<.01?' · mesure d’origine':'')}
/* Les seuils de tracé sont en pourcentage de carte ; à l'écran, le zoom les grossit
   d'autant. Zoomé huit fois, un rectangle bien visible ne pèse qu'un huitième de ce
   qu'il paraît : sans ce correctif, l'outil jetait le geste en croyant à un clic. */
function auZoom(v){return v/Math.max(1,zoomC)}
// Un geste compte dès qu'il court dans un sens : une fente reste une fente.
function gesteTrace(r){return !!r&&Math.max(r.w,r.h)>=auZoom(1.2)&&Math.min(r.w,r.h)>=auZoom(.1)}
// Ce qu'un outil vient de changer : le plan, la liste, la sauvegarde, et la table si c'est elle.
function matiereChangee(){renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()}
/* Les pinceaux. Peindre unit une capsule à la matière à chaque pas — le geste est donc
   continu et rond au bout ; gratter la soustrait. La grosseur se dit en fraction de
   socle : un pinceau moyen vaut un peu plus d'un demi socle, ce qui veut dire la même
   chose sur une carte de couloir et sur un plan de ville. */
function pinceauTaille(){const sel=$('pinceau-taille');
 const part=Math.max(.1,Math.min(3,Number(sel&&sel.value)||.55));
 return Math.max(.25,echelleSocle(mapDraft)*part)}
// Une touche : la capsule entre le pas d'avant et celui-ci — ou un rond, au premier appui.
function coupPinceau(p){const m=mapDraft,r=pinceauTaille(),der=pinceauDernier||p;
 const forme=capsulePolygon(der,p,r,m.ratio);
 if(mapTool==='gomme')retireMatiere(m,forme);else ajouteMatiere(m,forme)}
let pinceauDernier=null;
/* La découpe libre suit l'encre redressée : le tremblement de la main s'efface, les angles
   voulus restent, et la forme ôtée est exactement celle qui a été tracée. */
function applyLasso(){const brut=lasso&&lasso.pts;lasso=null;
 if(!brut||brut.length<3){renderCanvas();return}
 pushUndo();retireMatiere(mapDraft,encreDroite([brut])[0]);mapSel=null;
 matiereChangee()}
function shapeAt(d){const m=mapDraft;if(!m)return null;if(d.kind==='cut'||d.kind==='bloc')return cutRect;
 if(d.kind==='coupure')return (m.zonesCoupures||[])[d.i];if(d.kind==='lien')return (m.zonesLiens||[])[d.i];
 return d.kind==='start'?m.start:(d.kind==='door'?m.doors:d.kind==='objet'?m.objets:d.kind==='coffre'?(m.coffres||[]):m.foes)[d.i]}
function removeShape(d){const m=mapDraft;
 if(d.kind==='start')m.start=null;
 else if(d.kind==='coupure')m.zonesCoupures.splice(d.i,1);else if(d.kind==='lien')m.zonesLiens.splice(d.i,1);
 else (d.kind==='door'?m.doors:d.kind==='objet'?m.objets:d.kind==='coffre'?m.coffres:m.foes).splice(d.i,1)}
/* ---------- L'outil Zones ----------
   Les zones se voient sur le plan de travail, chacune de sa couleur et de son numéro. Le MJ
   les sépare d'un trait — deux clics, comme une ligne de blocage — ou les regroupe d'un
   lien — un clic dans chaque zone. Un trait ou un lien se choisit d'un clic et s'efface
   par Suppr. Ce sont les mêmes zones que la table calcule. */
let zoneTrait=null,zoneVise=null;
// Trois outils, un même calque : voir les zones, les séparer, les regrouper.
const OUTILS_ZONES=['zones','separer','regrouper'];
const enZones=()=>OUTILS_ZONES.includes(mapTool);
const zonesMode=()=>mapTool==='separer'?'separer':mapTool==='regrouper'?'regrouper':'voir';
/* Les noms des zones : le MJ renomme un numéro d'un clic dessus. Chaque nom est retenu par
   un point de la zone, pour survivre à un recalcul qui renumérote. */
function nomsDesZones(m,z){const out=new Map();(m&&m.zonesNoms||[]).forEach(e=>{const n=zoneAu(z,e.x,e.y);if(n)out.set(n,e.nom)});return out}
function renommeZone(m,z,n,x,y,nom){nom=String(nom||'').trim().slice(0,12);
 pushUndo();m.zonesNoms=(m.zonesNoms||[]).filter(e=>zoneAu(z,e.x,e.y)!==n);
 if(nom&&nom!==String(n))m.zonesNoms.push({x,y,nom});
 matiereChangee()}
function dessineZonesEditeur(){const c=$('map-canvas'),m=mapDraft;if(!c||!m)return;
 c.querySelectorAll('.zones-apercu,.zones-noms,.calque-zones').forEach(e=>e.remove());
 if(!enZones())return;
 const z=zonesDe(m);
 const cv=document.createElement('canvas');cv.className='zones-apercu';const noms=document.createElement('div');noms.className='zones-noms';
 c.append(cv,noms);
 // Un clic sur un numéro le remplace par un champ : Entrée ou la sortie valident, Échap renonce.
 peindreZones(cv,noms,z,nomsDesZones(m,z),(n,x,y,span)=>{const champ=document.createElement('input');champ.maxLength=12;champ.value=span.textContent;champ.className='zone-nom-champ';
  champ.setAttribute('aria-label','Nom de la zone '+n);
  let fini=false;const valide=()=>{if(fini)return;fini=true;renommeZone(m,z,n,x,y,champ.value)};
  champ.onkeydown=ev=>{ev.stopPropagation();if(ev.key==='Enter'){ev.preventDefault();valide()}else if(ev.key==='Escape'){ev.preventDefault();fini=true;renderCanvas()}};
  champ.onblur=valide;champ.onpointerdown=ev=>ev.stopPropagation();
  span.replaceChildren(champ);champ.focus();champ.select()});
 const svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','calque-zones');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 const trait=(seg,classe,i)=>{const l=document.createElementNS(nsSVG,'line');l.setAttribute('x1',seg.x1);l.setAttribute('y1',seg.y1);l.setAttribute('x2',seg.x2);l.setAttribute('y2',seg.y2);
  l.setAttribute('class',classe+(i!==undefined&&mapSel&&mapSel.kind===classe&&mapSel.i===i?' selected':''));svg.append(l);return l};
 const bout=(x,y,classe)=>{const o=document.createElementNS(nsSVG,'path');o.setAttribute('class',classe);o.setAttribute('d','M'+x+' '+y+'L'+x+' '+y);svg.append(o)};
 (m.zonesCoupures||[]).forEach((s,i)=>trait(s,'coupure',i));
 (m.zonesLiens||[]).forEach((s,i)=>{trait(s,'lien',i);bout(s.x1,s.y1,'lien-bout');bout(s.x2,s.y2,'lien-bout')});
 // Le tracé en cours, en pointillé, jusqu'au curseur.
 if(zoneTrait&&zoneVise)trait({x1:zoneTrait.x,y1:zoneTrait.y,x2:zoneVise.x,y2:zoneVise.y},zonesMode()==='regrouper'?'lien apercu':'coupure apercu');
 if(zoneTrait)bout(zoneTrait.x,zoneTrait.y,zonesMode()==='regrouper'?'lien-bout':'coupure-bout');
 c.append(svg)}
// Le trait ou le lien le plus proche du point, à portée de clic : {kind,i}, ou rien.
function segmentSous(p){const m=mapDraft;if(!m)return null;const r=Math.max(.05,Number(m.ratio)||16/9),seuil=auZoom(1.4);let meilleur=null,dist=seuil;
 const test=(l,kind)=>l.forEach((s,i)=>{const c=closestOnSegment([p.x*r,p.y],[s.x1*r,s.y1],[s.x2*r,s.y2]);const d=Math.hypot(p.x*r-c[0],p.y-c[1]);if(d<dist){dist=d;meilleur={kind,i}}});
 test(m.zonesCoupures||[],'coupure');test(m.zonesLiens||[],'lien');return meilleur}
/* Un clic de l'outil Zones : un trait ou un lien sous le curseur se choisit ; sinon, en
   mode Séparer ou Regrouper, le premier clic pose l'origine et le second achève. */
function clicZones(p){const m=mapDraft,mode=zonesMode();if(!m)return;
 if(!zoneTrait){const sous=segmentSous(p);if(sous){mapSel=sous;renderCanvas();return}}
 if(mode==='voir'){mapSel=null;renderCanvas();return}
 /* Une coupure s'aimante : à un angle de la matière à portée — le pied d'un mur —, et au
    bord de la carte quand on en est tout près. Un trait qui s'arrête à un cheveu du bord
    laisserait passer l'inondation par ce cheveu. */
 if(mode==='separer'){const bout=boutAimante(p,m.ratio);if(bout)p={x:bout.x,y:bout.y};
  p={x:p.x<1.5?0:p.x>98.5?100:p.x,y:p.y<1.5?0:p.y>98.5?100:p.y}}
 if(!zoneTrait){if(mode==='regrouper'&&!zoneAu(zonesDe(m),p.x,p.y))return;zoneTrait={x:p.x,y:p.y};zoneVise={x:p.x,y:p.y};mapSel=null;renderCanvas();return}
 const seg={x1:zoneTrait.x,y1:zoneTrait.y,x2:p.x,y2:p.y};zoneTrait=zoneVise=null;
 const r=Math.max(.05,Number(m.ratio)||16/9);if(Math.hypot((seg.x2-seg.x1)*r,seg.y2-seg.y1)<auZoom(.6)){renderCanvas();return}
 if(mode==='regrouper'){const z=zonesDe(m),a=zoneAu(z,seg.x1,seg.y1),b=zoneAu(z,seg.x2,seg.y2);if(!a||!b||a===b){renderCanvas();return}
  pushUndo();m.zonesLiens.push(seg);mapSel={kind:'lien',i:m.zonesLiens.length-1}}
 else{pushUndo();m.zonesCoupures.push(seg);mapSel={kind:'coupure',i:m.zonesCoupures.length-1}}
 matiereChangee()}

/* ---------- Recalage des cartes tracées avant la v0.23 ---------- */
// L'éditeur d'alors logeait l'image dans un cadre 16/9 : tout le tracé s'en trouvait
// comprimé vers le centre. On rend aux formes leurs coordonnées d'image.
function recalNeeded(){const m=mapDraft;
 return !!(m&&m.image&&!m.fitted&&Math.abs((m.ratio||16/9)-16/9)>.01
  &&(matiereDe(m).length||m.doors.length||m.foes.length||m.start))}
$('echelle-reset').onclick=()=>{const m=mapDraft;if(!m)return;ensure(m);pushUndo();
 m.echelle.t=SOCLE_DEFAUT;renderCanvas();saveMaps();if(m.id===currentMapId)render()};
$('map-recal').onclick=()=>{const m=mapDraft;if(!recalNeeded())return;
 pushUndo();const remis=s=>uncontain(s,16/9,m.ratio);
 m.matiere=matiereDe(m).map(p=>({...p,anneaux:p.anneaux.map(r=>uncontainPoints(r,16/9,m.ratio))}));
 m.doors=remis(m.doors);m.foes=remis(m.foes);m.objets=remis(m.objets||[]);
 if(m.start)m.start=remis([m.start])[0];
 m.fitted=true;renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};

/* ---------- Verrouillage ---------- */
$('shape-lock').onclick=()=>{const p=polygoneSel();
 // Le verrou tient la zone entière : elle ne bouge plus, et la découpe passe à côté.
 if(p){pushUndo();if(p.verrou)delete p.verrou;else p.verrou=true;renderCanvas();saveMaps();return}
 const cible=mapSel&&shapeAt(mapSel);if(!cible)return;
 pushUndo();cible.locked=!cible.locked;renderCanvas();saveMaps()};

/* ---------- Tracé, sélection, déplacement ---------- */
const pct=e=>{const r=$('map-canvas').getBoundingClientRect();
 return {x:Math.max(0,Math.min(100,100*(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(100,100*(e.clientY-r.top)/r.height))}};
$('map-canvas').addEventListener('pointerdown',e=>{if(!mapDraft)return;ensure(mapDraft);
 /* On remonte au premier élément qui se nomme : une porte, un départ, un adversaire, ou
    la boîte de la zone choisie — une poignée y mène aussi bien. */
 const grip=e.target.dataset.grip,p=pct(e),sous=e.target.closest('[data-kind]');
 /* Le socle témoin se manie à part : il n'appartient à aucune liste de formes, il ne dit
    que l'échelle. Glissé, il se promène ; tiré par son coin, il grossit. */
 if(e.target.closest('.echelle-token')&&e.button===0){pushUndo();
  mapDrag={mode:e.target.dataset.echelleGrip?'echelle-taille':'echelle',from:p,orig:{...mapDraft.echelle}};
  $('map-canvas').setPointerCapture(e.pointerId);e.preventDefault();return}
 const dessous=sous?{kind:sous.dataset.kind,i:Number(sous.dataset.i)}:null;
 /* Un objet déjà posé se rouvre : un clic dessus avec l'outil Objet, qui en posait un autre par
    mégarde ; deux clics rapprochés avec la Sélection. Le plan se redessine à chaque clic, le
    double clic du navigateur n'arrivait donc jamais jusqu'à lui. */
 if(dessous&&dessous.kind==='objet'&&e.button===0&&mapDraft.objets&&mapDraft.objets[dessous.i]){const t=performance.now(),deux=clicObjet&&clicObjet.i===dessous.i&&t-clicObjet.t<450;
  clicObjet=deux?null:{i:dessous.i,t};
  if(deux||mapTool==='objet'){mapSel=dessous;renderCanvas();openObjet(dessous.i);e.preventDefault();return}}
 if(dessous&&dessous.kind==='coffre'&&e.button===0&&mapDraft.coffres&&mapDraft.coffres[dessous.i]&&!grip){const t=performance.now(),deux=clicCoffre&&clicCoffre.i===dessous.i&&t-clicCoffre.t<450;
  clicCoffre=deux?null:{i:dessous.i,t};if(deux){mapSel=dessous;renderCanvas();openCoffre(dessous.i);e.preventDefault();return}}
 if(enZones()&&e.button===0){clicZones(p);e.preventDefault();return}
 // Avec l'outil Sélection, ou sur une poignée, on manipule la forme visée.

 /* Une zone de blocage : celle sous le curseur avec l'outil Sélection, ou celle dont on
    tire la poignée. Elle se déplace d'un bloc, ou s'étire par le coin ; elle ne se scinde
    jamais. */
 const iMat=dessous&&dessous.kind==='matiere'?dessous.i:(mapTool==='select'&&!dessous?matiereSous(mapDraft,[p.x,p.y]):-1);
 if(iMat>=0&&(mapTool==='select'||grip)){const poly=matiereDe(mapDraft)[iMat];
  mapSel={kind:'matiere',i:iMat};
  if(poly&&!poly.verrou){pushUndo();
   mapDrag={mode:'masse',geste:grip?'resize':'move',i:iMat,grip,orig:structuredClone(poly),boite:boitePolygone(poly),from:p};
   $('map-canvas').setPointerCapture(e.pointerId)}
  renderCanvas();e.preventDefault();return}
 if(dessous&&(mapTool==='select'||grip)){mapSel=dessous;const cible=shapeAt(dessous);
  if(cible&&!cible.locked){pushUndo();
   // La poignée ronde d'une porte la fait tourner autour de son centre.
   mapDrag={mode:grip==='rot'?'tourne':grip?'resize':'move',...dessous,grip,orig:structuredClone(cible),from:p,touche:false,
    centre:{x:cible.x+(cible.w||0)/2,y:cible.y+(cible.h||0)/2}};
   $('map-canvas').setPointerCapture(e.pointerId)}
  renderCanvas();e.preventDefault();return}
 if(mapTool==='foe'){const t=catalog.monsters[Number($('map-foe-tpl').value)];if(!t)return;
  pushUndo();mapDraft.foes.push({tpl:structuredClone(t),x:p.x,y:p.y,locked:false});
  mapSel={kind:'foe',i:mapDraft.foes.length-1};renderCanvas();saveMaps();return}
 /* Un objet se pose d'un clic et sa fiche s'ouvre aussitôt : on le nomme avant de l'oublier. */
 if(mapTool==='objet'){pushUndo();
  mapDraft.objets.push({id:crypto.randomUUID(),nom:'Objet',desc:'',x:p.x,y:p.y,taille:'medium',visible:true,items:[],tresor:'',test:{comp:3,reussites:1}});
  mapSel={kind:'objet',i:mapDraft.objets.length-1};renderCanvas();saveMaps();openObjet(mapSel.i);return}
 /* Le tracé : premier clic, origine ; second clic, arrivée. Entre les deux, l'aperçu suit
    le curseur — et Maj le redresse. */
 if(mapTool==='ligne'){
  if(!traitDepart){const d=boutAimante(p,mapDraft.ratio)||p;
   traitDepart={x:d.x,y:d.y};traitVise={x:d.x,y:d.y};renderCanvas();e.preventDefault();return}
  const fin=viseTrait(p,e.metaKey||e.ctrlKey,mapDraft.ratio);
  const r=Math.max(.05,Number(mapDraft.ratio)||16/9);
  const pose=Math.hypot((fin.x-traitDepart.x)*r,fin.y-traitDepart.y)>=auZoom(.5);
  // On ne choisit pas ce qu'on vient de tracer : la main est encore à l'ouvrage.
  if(pose){pushUndo();
   ajouteMatiere(mapDraft,traitPolygon({x1:traitDepart.x,y1:traitDepart.y,x2:fin.x,y2:fin.y,e:TRAIT_EPAISSEUR},mapDraft.ratio))}
  /* Maj pose un point d'appui : le trait s'arrête là et le suivant en repart. C'est ainsi
     qu'on longe une salle entière sans relever la main. */
  if(pose&&e.shiftKey){traitDepart={x:fin.x,y:fin.y};traitVise={x:fin.x,y:fin.y}}
  else traitDepart=traitVise=null;
  renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render();e.preventDefault();return}
 if(mapTool==='select'){mapSel=null;renderCanvas();return}
 /* Le pinceau : on appuie, on trace, on relâche. Chaque pas dépose ou gratte, et le pas
    vaut la moitié de la grosseur — assez serré pour que la trace soit continue, assez
    espacé pour ne pas empiler mille formes sur un geste. */
 if(mapTool==='pinceau'||mapTool==='gomme'){pushUndo();mapSel=null;
  pinceauDernier=null;coupPinceau(p);pinceauDernier={x:p.x,y:p.y};
  mapDrag={mode:'pinceau',from:p};$('map-canvas').setPointerCapture(e.pointerId);
  renderCanvas();e.preventDefault();return}
 if(mapTool==='lasso'){if(!lasso)lasso={pts:[]};
  // Un clic près du premier point ferme le contour, comme dans un outil de détourage.
  if(lasso.pts.length>2&&Math.hypot(p.x-lasso.pts[0][0],p.y-lasso.pts[0][1])<auZoom(1.6)){applyLasso();return}
  lasso.pts.push([p.x,p.y]);mapSel=null;
  mapDrag={mode:'lasso',from:p,bouge:false};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 if(mapTool==='cut'){cutRect={x:p.x,y:p.y,w:0,h:0};mapSel=null;
  mapDrag={mode:'cut',kind:'cut',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Le bloc se trace comme la découpe : un aperçu suit la main, l'union se fait au relâché.
 if(mapTool==='wall'){cutRect={x:p.x,y:p.y,w:0,h:0,bloc:true};mapSel=null;
  mapDrag={mode:'cut',kind:'bloc',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Outil de dessin : on trace. Un clic sans glisser sélectionne la forme sous le curseur.
 pushUndo();const rect={x:p.x,y:p.y,w:0,h:0,locked:false};
 if(mapTool==='door'||mapTool==='secret'){rect.open=false;
  // Un passage secret est une porte, née secrète : plus besoin de percer d'abord un trou.
  if(mapTool==='secret')rect.secret=true;
  mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 else if(mapTool==='coffre'||mapTool==='coffrerond'){Object.assign(rect,{id:crypto.randomUUID(),nom:'Coffre',desc:'',perception:1,verrou:0,piege:0,degats:0,etats:[],items:[],richesses:{}});
  if(mapTool==='coffrerond')rect.rond=true;
  mapDraft.coffres.push(rect);mapSel={kind:'coffre',i:mapDraft.coffres.length-1}}
 mapDrag={mode:'create',kind:mapSel.kind,i:mapSel.i,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
$('map-canvas').addEventListener('pointermove',e=>{
 if(enZones()&&zoneTrait&&!mapDrag){zoneVise=pct(e);dessineZonesEditeur();return}
 if(traitDepart&&!mapDrag){traitVise=viseTrait(pct(e),e.metaKey||e.ctrlKey,mapDraft&&mapDraft.ratio);
  dessineTraits();return}
 if(!mapDrag)return;const p=pct(e),d=mapDrag;
 if(d.mode==='echelle'){const j=mapDraft.echelle;
  j.x=Math.max(0,Math.min(100,d.orig.x+p.x-d.from.x));
  j.y=Math.max(0,Math.min(100,d.orig.y+p.y-d.from.y));renderCanvas();return}
 if(d.mode==='echelle-taille'){const j=mapDraft.echelle,r=$('map-canvas').getBoundingClientRect();
  // Le rayon suit le doigt : la largeur du socle vaut deux fois l'écart à son centre.
  const dx=(p.x-j.x)/100*r.width,dy=(p.y-j.y)/100*r.height;
  j.t=Math.max(.6,Math.min(40,2*Math.hypot(dx,dy)/Math.max(1,r.width)*100));
  renderCanvas();return}
 if(d.mode==='pinceau'){const der=pinceauDernier;
  if(!der||Math.hypot(p.x-der.x,p.y-der.y)>=pinceauTaille()/2){
   coupPinceau(p);pinceauDernier={x:p.x,y:p.y};renderCanvas()}
  return}
 if(d.mode==='lasso'){const der=lasso.pts[lasso.pts.length-1];
  if(Math.hypot(p.x-der[0],p.y-der[1])>=auZoom(.6)){lasso.pts.push([p.x,p.y]);d.bouge=true;renderCanvas()}
  return}
 /* Une zone se déplace ou s'étire d'un bloc : la même transformation affine passe sur tous
    ses anneaux, trous compris. Glissée, elle reste dans la carte ; tirée, elle ne se
    réduit jamais à rien. */
 if(d.mode==='masse'){const o=d.boite,m=matiereDe(mapDraft);
  if(!o||!m[d.i]){mapDrag=null;return}
  let sx=1,sy=1,dx=0,dy=0;
  if(d.geste==='move'){dx=Math.max(-o.x,Math.min(100-o.x-o.w,p.x-d.from.x));
   dy=Math.max(-o.y,Math.min(100-o.y-o.h,p.y-d.from.y))}
  else{const est=d.grip.includes('e'),sud=d.grip.includes('s');
   const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
   const nw=Math.max(auZoom(.2),Math.abs(x2-x1)),nh=Math.max(auZoom(.2),Math.abs(y2-y1));
   sx=o.w>1e-9?nw/o.w:1;sy=o.h>1e-9?nh/o.h:1;dx=Math.min(x1,x2)-o.x;dy=Math.min(y1,y2)-o.y}
  m[d.i]=transformePolygone(d.orig,([x,y])=>[o.x+dx+(x-o.x)*sx,o.y+dy+(y-o.y)*sy]);
  renderCanvas();return}
 const cible=shapeAt(d);if(!cible)return;
 if(d.mode==='tourne'){cible.a=anglePoignee(d.centre,p,mapDraft.ratio,e.shiftKey);renderCanvas();return}
 if(d.kind==='foe'||d.kind==='objet'){cible.x=p.x;cible.y=p.y}
 else if(d.mode==='create'||d.mode==='cut'){cible.x=Math.min(d.from.x,p.x);cible.y=Math.min(d.from.y,p.y);cible.w=Math.abs(p.x-d.from.x);cible.h=Math.abs(p.y-d.from.y);
}
 else if(d.mode==='move'){cible.x=Math.max(0,Math.min(100-d.orig.w,d.orig.x+p.x-d.from.x));cible.y=Math.max(0,Math.min(100-d.orig.h,d.orig.y+p.y-d.from.y))}
 // Une porte tournée se redimensionne dans son propre repère : le coin opposé reste fixe.
 else if((d.kind==='door'||d.kind==='coffre')&&(Number(d.orig.a)||0))Object.assign(cible,redimPorteTournee(d.orig,d.grip,p,mapDraft.ratio));
 else{const o=d.orig,est=d.grip.includes('e'),sud=d.grip.includes('s');
  const x1=est?o.x:p.x,x2=est?p.x:o.x+o.w,y1=sud?o.y:p.y,y2=sud?p.y:o.y+o.h;
  cible.x=Math.min(x1,x2);cible.w=Math.abs(x2-x1);cible.y=Math.min(y1,y2);cible.h=Math.abs(y2-y1)}
 renderCanvas()});
$('map-canvas').addEventListener('pointerup',()=>{if(!mapDrag)return;const d=mapDrag;mapDrag=null;
 if(d.mode==='echelle'||d.mode==='echelle-taille'){renderCanvas();saveMaps();
  if(mapDraft.id===currentMapId)render();return}
 // Un glisser ferme le contour à main levée ; une suite de clics attend Entrée.
 if(d.mode==='pinceau'){pinceauDernier=null;matiereChangee();return}
 if(d.mode==='lasso'){if(d.bouge&&lasso&&lasso.pts.length>=3)applyLasso();else renderCanvas();return}
 /* Le rectangle relâché : un bloc rejoint la matière, une découpe l'en ôte — exactement
    lui, angles droits compris. Un clic sans glisser ne trace rien : s'il tombait sur une
    forme, on la choisit et on repasse en Sélection. */
 if(d.mode==='cut'){const r=cutRect;cutRect=null;
  if(gesteTrace(r)){pushUndo();const forme=rectPolygon(r);
   if(r.bloc){ajouteMatiere(mapDraft,forme);mapSel={kind:'matiere',i:matiereSous(mapDraft,[r.x+r.w/2,r.y+r.h/2])};
    if(mapSel.i<0)mapSel=null}
   else{retireMatiere(mapDraft,forme);mapSel=null}}
  else if(d.dessous){mapSel=d.dessous;mapTool='select'}
  matiereChangee();return}
 /* Une zone relâchée sur une autre fond avec elle : on refond la matière, puis on retrouve
    la zone par un point qu'elle contient — son numéro a pu changer. */
 if(d.mode==='masse'){const bouge=matiereDe(mapDraft)[d.i];
  refondMatiere(mapDraft);
  const i=bouge?zoneApres(bouge):-1;
  mapSel=i>=0?{kind:'matiere',i}:null;
  matiereChangee();return}
 const cible=d.kind==='foe'||d.kind==='objet'?null:shapeAt(d);
 // Un coffre tout juste tracé ouvre sa fiche, comme un objet posé.
 if(cible&&d.mode==='create'&&d.kind==='coffre'&&gesteTrace(cible))setTimeout(()=>openCoffre(d.i));
 if(cible&&!gesteTrace(cible)){removeShape(d);
  // Clic manqué : si une forme était dessous, on la sélectionne et on repasse en Sélection.
  if(d.dessous){mapSel=d.dessous;mapTool='select'}else{mapSel=null;undoStack.pop()}}
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
/* Le choix dans l'armurerie, par familles : de petits carrés, un clic prend la pièce, un autre la repose.
   « pris » : l'ensemble des identifiants choisis, que le formulaire relit à l'enregistrement. */
function pickerArmurerie(filtre,boite,pris){const liste=()=>{const q=(filtre.value||'').trim().toLowerCase();boite.replaceChildren();
  [['weapon','Armes'],['armor','Armures et boucliers'],['object','Objets'],['cle','Clés'],['treasure','Trésors'],['ressource','Ressources'],['restes','Restes']].forEach(([cat,titre])=>{
   const lot=(catalog.items||[]).filter(it=>it&&it.category===cat&&(!q||it.name.toLowerCase().includes(q)));
   if(!lot.length)return;const h=document.createElement('h3');h.textContent=titre;boite.append(h);
   /* De petits carrés, comme l'inventaire d'un aventurier : l'icône seule, la bulle au survol ; un
      clic prend la pièce, un autre la repose. */
   const rang=document.createElement('div');rang.className='objet-rang';
   lot.forEach(it=>{const p=gearCarre(it,1,0);p.classList.remove('dispo');const coche=p.querySelector('.marque-porte');if(coche)coche.remove();
    const maj=()=>{p.classList.toggle('pris',pris.has(it.id));p.setAttribute('aria-pressed',String(pris.has(it.id)))};
    const bascule=()=>{if(pris.has(it.id))pris.delete(it.id);else pris.add(it.id);maj()};
    p.setAttribute('aria-label',it.name);p.onclick=bascule;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bascule()}};maj();
    if(typeof surveille==='function')surveille(p,()=>{const d=gearDetail(it,null,false);d.hidden=false;d.classList.add('large');ouvrirBulle(p,d,'bulle-gear')});
    rang.append(p)});
   boite.append(rang)})};
 filtre.oninput=liste;liste()}
/* ---------- La fiche d'un objet ---------- */
const objetDialog=dialog('objet-editor','Objet','<form id="objet-form"><div id="objet-fields"></div><div class="form-actions"><button type="button" id="objet-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
let objetIndex=null;
function openObjet(i){const m=mapDraft,o=m&&m.objets&&m.objets[i];if(!o||view!=='mj')return;objetIndex=i;
 objetDialog.querySelector('h2').textContent=o.nom||'Objet';
 $('objet-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','nom',o.nom,'text','required maxlength="60"')
  +sel('Taille','taille',o.taille,[['small','Petit'],['medium','Moyen'],['large','Grand']])
  +sel('Visibilité','visible',o.visible?'1':'0',[['1','Visible — la troupe le voit et l’ouvre'],['0','Caché — un test le découvre']])+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="3" maxlength="600">'+esc(o.desc||'')+'</textarea></label>'
  +'<div class="edit-grid">'+sel('Test de découverte — compétence','comp',String(o.test.comp),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites nécessaires','reussites',o.test.reussites,'number','min="1" max="9"')
  +field('Trésor — en toutes lettres','tresor',o.tresor||'','text','maxlength="200"')+'</div>'
  +'<h2 class="sous-titre">Objets à prendre</h2><input id="objet-filtre" placeholder="Filtrer l’armurerie…" aria-label="Filtrer l’armurerie"><div id="objet-liste" class="objet-liste"></div>'
  +'<p class="muted">Ce qui est choisi, d’un clic, attend dans l’objet ; la première pièce choisie donne son icône au jeton. Un aventurier au contact la prend d’un clic : elle va dans son inventaire.</p>';
 const pris=new Set(o.items||[]);pickerArmurerie($('objet-filtre'),$('objet-liste'),pris);
 $('objet-form').onsubmit=e=>{e.preventDefault();const f=$('objet-form').elements;pushUndo();
  o.nom=f.nom.value.trim().slice(0,60)||'Objet';o.taille=f.taille.value;o.visible=f.visible.value==='1';
  o.desc=f.desc.value.trim().slice(0,600);o.tresor=f.tresor.value.trim().slice(0,200);
  o.test={comp:Math.max(0,Math.min(7,Number(f.comp.value)||0)),reussites:Math.max(1,Math.min(9,Number(f.reussites.value)||1))};
  o.items=[...pris];objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('objet-suppr').onclick=()=>{if(!confirm('Supprimer « '+o.nom+' » ?'))return;pushUndo();
  m.objets.splice(i,1);mapSel=null;objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 objetDialog.showModal()}
$('objet-edit').onclick=()=>{if(mapSel&&mapSel.kind==='objet')openObjet(mapSel.i)};
$('shape-delete').onclick=()=>{if(!supprimeSelection())return;
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-key').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.keyLocked=$('door-key').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-secret').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.secret=$('door-secret').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
// Le nombre de réussites de Perception qu'un passage secret demande pour être trouvé.
$('door-perception').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.perception=Math.max(1,Math.min(9,Math.trunc(Number($('door-perception').value))||1));renderCanvas();saveMaps()};
// Un adversaire caché : la troupe ne le voit pas tant que le MJ ne le révèle pas, d'un clic en jeu.
/* Ce que cet adversaire-là porte en plus de son modèle, et la chance que chaque pièce tombe : choisi comme
   l'inventaire d'un adversaire du bestiaire. Les autres du même modèle n'en ont rien. */
const foeObjetsDialog=dialog('foe-objets-editor','Objets portés','<div id="foe-objets-corps"></div>');
$('foe-objets').onclick=()=>{const f=mapSel&&mapSel.kind==='foe'&&shapeAt(mapSel);if(!f)return;pushUndo();
 foeObjetsDialog.querySelector('h2').textContent=(f.tpl&&f.tpl.name)||'Adversaire';f.inventaire??=[];f.butin??={};
 inventaireAdversaire($('foe-objets-corps'),f,()=>saveMaps());
 foeObjetsDialog.onclose=()=>{f.butin=normaliseButin(f.butin,f.inventaire);if(!f.inventaire.length){delete f.inventaire;delete f.butin}renderCanvas();saveMaps()};
 foeObjetsDialog.showModal()};
/* L'adversaire que la table a tiré de cette pose, si la carte y est ouverte : par l'identifiant de la pose,
   à défaut — une table ouverte avant qu'elle n'en ait un — par son modèle et sa place, s'il n'a pas bougé. */
function adversaireDeLaTable(m,f){if(!m||!f||m.id!==currentMapId)return null;
 return actors.find(a=>a&&!a.hero&&f.id&&a.pose===f.id)
  ||actors.find(a=>a&&!a.hero&&!a.pose&&f.tpl&&a.template===f.tpl.id&&Math.abs(a.x-f.x)<.5&&Math.abs(a.y-f.y)<.5)||null}
$('foe-cache').onchange=()=>{const f=mapSel&&mapSel.kind==='foe'&&shapeAt(mapSel);if(!f)return;
 pushUndo();if($('foe-cache').checked)f.cache=true;else delete f.cache;
 // La carte est ouverte sur la table : l'adversaire posé là suit la case tout de suite, sans rouvrir la carte.
 const a=adversaireDeLaTable(mapDraft,f);if(a){a.hidden=f.cache===true;render();scheduleSave()}
 renderCanvas();saveMaps()};
$('coffre-edit').onclick=()=>{if(mapSel&&mapSel.kind==='coffre')openCoffre(mapSel.i)};
// Dupliquer : le même coffre, réglages et contenu compris, posé un peu plus loin.
$('coffre-double').onclick=()=>{const c=mapSel&&mapSel.kind==='coffre'&&shapeAt(mapSel);if(!c)return;pushUndo();
 const copie=structuredClone(c);copie.id=crypto.randomUUID();copie.locked=false;copie.x=Math.min(100-copie.w,copie.x+2);copie.y=Math.min(100-copie.h,copie.y+2);
 ['revele','deverrouille','desamorce','ouvert','tente'].forEach(k=>delete copie[k]);mapDraft.coffres.push(copie);mapSel={kind:'coffre',i:mapDraft.coffres.length-1};
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
// Les clés de l'armurerie, en menu ; « aucune » d'abord.
const clesArmurerie=()=>(catalog.items||[]).filter(o=>o&&o.category==='cle').sort((x,y)=>String(x.name).localeCompare(String(y.name),'fr'));
function remplitCles(menu,valeur){menu.replaceChildren(new Option('— aucune —',''),...clesArmurerie().map(o=>new Option(o.name,o.id)));menu.value=valeur&&clesArmurerie().some(o=>o.id===valeur)?valeur:''}
$('door-cle').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();if($('door-cle').value)d.cleId=$('door-cle').value;else delete d.cleId;saveMaps();if(mapDraft.id===currentMapId)render()};
/* ---------- La fiche d'un coffre ----------
   Son nom et la description que la troupe lit au survol ; caché ou non, et les réussites de Perception
   qui le révèlent ; son verrou et son piège, en réussites de Ruse ou de Technique (0 : sans) ; ce que
   le piège inflige à qui est au contact ; et ce qu'il contient : des pièces, de l'or, des gemmes. */
const coffreDialog=dialog('coffre-editor','Coffre','<form id="coffre-form"><div id="coffre-fields"></div><div class="form-actions"><button type="button" id="coffre-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openCoffre(i){const m=mapDraft,c=m&&m.coffres&&m.coffres[i];if(!c||view!=='mj')return;
 coffreDialog.querySelector('h2').textContent=c.nom||'Coffre';
 const nb=(lab,name,v,min,max)=>field(lab,name,v,'number','min="'+min+'" max="'+max+'"');
 const coche=(name,txt,on)=>'<label class="field-check"><input type="checkbox" name="'+name+'"'+(on?' checked':'')+'>'+txt+'</label>';
 $('coffre-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',c.nom||'Coffre','text','required maxlength="60"')+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="2" maxlength="600">'+esc(c.desc||'')+'</textarea></label>'
  // Caché, verrouillé, piégé : chaque case ouvre ses champs, et seulement elle.
  +'<div class="coffre-cases">'+coche('cache','Caché',!!c.cache)+coche('ferme','Verrouillé',c.verrou>0)+coche('piege_on','Piégé',c.piege>0)+'</div>'
  +'<div class="edit-grid coffre-si" data-si="cache">'+nb('Réussites de Perception pour le trouver','perception',c.perception||1,1,9)+'</div>'
  +'<div class="edit-grid coffre-si" data-si="ferme">'+nb('Réussites de Ruse ou Technique','verrou',Math.max(1,c.verrou||1),1,9)
  +'<label>Clé qui l’ouvre<select name="cleId"></select></label></div>'
  +'<div class="coffre-si" data-si="piege_on"><div class="edit-grid">'+nb('Réussites de Ruse ou Technique pour le trouver','piege',Math.max(1,c.piege||1),1,9)+nb('Dégâts du piège','degats',c.degats||0,0,99)+'</div>'
  +'<div class="coffre-etats">'+ETATS_JEU.map(e=>'<label class="field-check"><input type="checkbox" name="etat" value="'+esc(e)+'"'+((c.etats||[]).includes(e)?' checked':'')+'>'+esc(e)+'</label>').join('')+'</div></div>'
  +'<h2 class="sous-titre">Contenu</h2><div class="coffre-tresor">'+nb('Or','or',(c.richesses||{}).or||0,0,99999)+'<div class="coffre-gemmes" id="coffre-gemmes"></div></div>'
  +'<div id="coffre-contenu"></div>';
 const f=$('coffre-form').elements;remplitCles(f.cleId,c.cleId||'');
 const montre=()=>coffreDialog.querySelectorAll('.coffre-si').forEach(b=>{b.hidden=!f[b.dataset.si].checked});
 ['cache','ferme','piege_on'].forEach(k=>{f[k].onchange=montre});montre();
 /* Les gemmes, en une ligne de petites icônes : un clic en ajoute une, le clic droit en retire une. */
 const gemmes={};CLES_GEMMES.forEach(k=>{const v=Math.trunc(Number((c.richesses||{})[k]))||0;if(v>0)gemmes[k]=v});
 const ligneG=$('coffre-gemmes');
 CLES_GEMMES.forEach(k=>{const [t,v]=k.split('-'),b=document.createElement('button');b.type='button';b.className='coffre-gemme';b.title=nomGemme(t,v,false);
  b.append(iconeDeGemme(t,v,false));const n=document.createElement('b');b.append(n);
  const maj=()=>{n.textContent=gemmes[k]?'×'+gemmes[k]:'';b.classList.toggle('pris',!!gemmes[k])};maj();
  b.onclick=()=>{gemmes[k]=Math.min(999,(gemmes[k]||0)+1);maj()};
  b.oncontextmenu=e=>{e.preventDefault();if(gemmes[k]>1)gemmes[k]--;else delete gemmes[k];maj()};ligneG.append(b)});
 // Les pièces de l'armurerie, choisies comme l'inventaire d'un adversaire : un clic, une de plus ; le clic droit, une de moins.
 const contenu={inventaire:[...(c.items||[])]};contenuCoffre($('coffre-contenu'),contenu);
 $('coffre-form').onsubmit=e=>{e.preventDefault();const n=(v,max)=>Math.max(0,Math.min(max,Math.trunc(Number(v))||0));pushUndo();
  c.nom=f.nom.value.trim().slice(0,60)||'Coffre';c.desc=f.desc.value.trim().slice(0,600);
  if(f.cache.checked){c.cache=true;c.perception=Math.max(1,n(f.perception.value,9))}else delete c.cache;
  c.verrou=f.ferme.checked?Math.max(1,n(f.verrou.value,9)):0;if(f.ferme.checked&&f.cleId.value)c.cleId=f.cleId.value;else delete c.cleId;
  c.piege=f.piege_on.checked?Math.max(1,n(f.piege.value,9)):0;c.degats=c.piege?n(f.degats.value,99):0;
  c.etats=c.piege?[...coffreDialog.querySelectorAll('input[name="etat"]:checked')].map(x=>x.value).filter(x=>ETATS_JEU.includes(x)):[];
  const r={},or=n(f.or.value,99999);if(or)r.or=or;Object.entries(gemmes).forEach(([k,v])=>{if(v>0)r[k]=v});c.richesses=r;
  c.items=[...contenu.inventaire].slice(0,99);coffreDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('coffre-suppr').onclick=()=>{if(!confirm('Supprimer « '+c.nom+' » ?'))return;pushUndo();
  m.coffres.splice(i,1);mapSel=null;coffreDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 coffreDialog.showModal()}
/* Ce qu'un coffre contient, en petits carrés comme l'inventaire d'un adversaire : les familles à
   allumer, un filtre, et l'armurerie ; un clic ajoute un exemplaire, le clic droit en retire un. Au-dessus,
   ce qui est déjà dedans, chaque pièce et son nombre. */
const CATS_COFFRE=[['armes','Armes',o=>o.category==='weapon'||o.category==='ammo'],['armures','Armures',o=>o.category==='armor'],
 ['objets','Objets',o=>!['weapon','ammo','armor','restes','ressource','cle'].includes(o.category)],['ressources','Ressources',o=>o.category==='ressource'],
 ['cles','Clés',o=>o.category==='cle'],['restes','Restes',o=>o.category==='restes']];
let catsCoffre=new Set(['armes','armures','objets']),filtreCoffre='';
function contenuCoffre(boite,cible){boite.replaceChildren();boite.classList.add('inv-adv');
 const compte=id=>cible.inventaire.filter(x=>x===id).length;
 const ajoute=o=>{if(cible.inventaire.length<99&&!(estUnique(o)&&cible.inventaire.includes(o.id)))cible.inventaire.push(o.id);change()};
 const retire=o=>{const k=cible.inventaire.lastIndexOf(o.id);if(k>=0)cible.inventaire.splice(k,1);change()};
 const possede=document.createElement('div');possede.className='inv-possede';
 const majPossede=()=>{possede.replaceChildren();const comptes=new Map();cible.inventaire.map(objetDe).filter(Boolean).forEach(o=>comptes.set(o,(comptes.get(o)||0)+1));
  comptes.forEach((n,o)=>{const p=carreInventaire(o,n);p.title='Clic droit : en retirer un';p.oncontextmenu=e=>{e.preventDefault();retire(o)};p.onclick=()=>ajoute(o);possede.append(p)})};
 const barre=document.createElement('div');barre.className='inv-cats';
 const filtre=document.createElement('input');filtre.type='search';filtre.className='inv-filtre';filtre.placeholder='Filtrer';filtre.value=filtreCoffre;filtre.setAttribute('aria-label','Filtrer les pièces');
 const grille=document.createElement('div');grille.className='inv-grille';const carres=new Map();
 const majComptes=()=>carres.forEach((p,o)=>{const n=compte(o.id);let x=p.querySelector('.exemplaires');
  if(!n){if(x)x.remove();return}if(!x){x=document.createElement('span');x.className='exemplaires';p.append(x)}x.textContent='×'+n});
 const remplit=()=>{grille.replaceChildren();carres.clear();const q=filtreCoffre.trim().toLowerCase(),tests=CATS_COFFRE.filter(([k])=>catsCoffre.has(k)).map(([,,t])=>t);
  const ordre=o=>{const i=CATS_COFFRE.findIndex(([,,t])=>t(o));return i<0?9:i};
  (catalog.items||[]).filter(o=>o&&tests.some(t=>t(o))&&(!q||String(o.name||'').toLowerCase().includes(q)))
   .sort((x,y)=>ordre(x)-ordre(y)||String(x.name).localeCompare(String(y.name),'fr'))
   .forEach(o=>{const p=carreInventaire(o,compte(o.id));p.classList.add('inv-pioche');p.setAttribute('aria-label','Ajouter '+o.name);
    p.onclick=()=>ajoute(o);p.oncontextmenu=e=>{e.preventDefault();retire(o)};carres.set(o,p);grille.append(p)})};
 CATS_COFFRE.forEach(([k,nom])=>{const b=document.createElement('button');b.type='button';const on=()=>catsCoffre.has(k);
  const pose=()=>{b.className='inv-cat'+(on()?' on':'');b.setAttribute('aria-pressed',String(on()))};b.textContent=nom;pose();
  b.onclick=()=>{if(on())catsCoffre.delete(k);else catsCoffre.add(k);pose();remplit()};barre.append(b)});
 filtre.oninput=()=>{filtreCoffre=filtre.value;remplit()};
 const change=()=>{if(typeof fermerBulle==='function')fermerBulle();majPossede();majComptes()};
 barre.append(filtre);boite.append(possede,barre,grille);majPossede();remplit()}

/* ---------- Zoom du plan de travail ---------- */
function applyCanvasZoom(){const c=$('map-canvas');
 const w=c.clientWidth||1,h=c.clientHeight||1;
 if(zoomC<=1){panCX=(1-zoomC)*w/2;panCY=(1-zoomC)*h/2}
 else{panCX=Math.min(0,Math.max(-(zoomC-1)*w,panCX));panCY=Math.min(0,Math.max(-(zoomC-1)*h,panCY))}
 c.style.transform='translate('+panCX+'px,'+panCY+'px) scale('+zoomC+')';
 c.style.setProperty('--z',zoomC);
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
// Les cartes se choisissent et s'ouvrent depuis l'onglet Cartes : la barre de la table
// n'en propose plus ni la liste, ni l'ouverture, ni l'import d'image.
function refreshMapPick(){mapPick.replaceChildren();maps.forEach(m=>mapPick.add(new Option(m.name,m.id)));
 refreshGmBar();
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
/* L'œil de la troupe : le MJ voit la carte comme ses joueurs — brouillard noir, socles
   qu'ils ne voient pas absents — sans quitter sa vue. La liste, elle, reste la sienne. */
const eyeBtn=icone('troupe-eye','🎭','Voir la carte comme la troupe');
/* Les zones : toute étendue close par la matière et par les portes — ouvertes ou fermées —
   en est une. Un bouton les montre au MJ, chacune de sa couleur et de son numéro. */
const zonesBtn=icone('zones-eye','▦','Voir les zones de la carte');
fogBar.append(fogReset,fogAll,eyeBtn,zonesBtn,lockBtn);document.querySelector('.mapbar .zoom-bar').after(fogBar);
const zonesCanvas=document.createElement('canvas');zonesCanvas.id='map-zones';zonesCanvas.setAttribute('aria-hidden','true');
const zonesNoms=document.createElement('div');zonesNoms.id='map-zones-noms';zonesNoms.setAttribute('aria-hidden','true');
$('fog').before(zonesCanvas,zonesNoms);
let zonesVisibles=false,zonesCache={cle:'',zones:null};
const ZONES_COLS=320;
zonesBtn.onclick=()=>{zonesVisibles=!zonesVisibles;refreshGmBar();renderZones()};
// Les zones d'une carte, gardées tant que sa géométrie ne bouge pas — portes comprises.
function zonesDe(m){if(!m)return null;const ratio=Math.max(.05,Number(m.ratio)||16/9);
 const cle=m.id+'|'+geometryKey(m)+'|'+ratio.toFixed(4)+'|'+JSON.stringify(m.zonesCoupures||[])+'|'+JSON.stringify(m.zonesLiens||[]);
 if(zonesCache.cle!==cle){const cols=ZONES_COLS,rows=Math.max(16,Math.round(cols/ratio));
  const portes=(m.doors||[]).map(d=>doorPolygon(d,ratio)).filter(Boolean);
  zonesCache={cle,zones:calculeZones(matiereDe(m),portes,cols,rows,10,m.zonesCoupures,m.zonesLiens)}}
 return zonesCache.zones}
// La zone où se tient un combattant sur la carte ouverte : 0 sans carte, ou dans un mur.
function zoneDe(a){const m=currentMap();return m&&a?zoneAu(zonesDe(m),a.x,a.y):0}
function memeZone(a,b){const za=zoneDe(a);return za>0&&za===zoneDe(b)}
const TEINTES_ZONE=[[200,70],[30,80],[120,55],[280,60],[350,70],[60,75],[170,55],[320,55],[90,60],[240,65],[15,65],[150,50]];
function hslVersRgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
 return [Math.round(255*f(0)),Math.round(255*f(8)),Math.round(255*f(4))]}
/* Les zones peintes : une toile à la grille du calcul, étirée sur la carte, une teinte par
   zone ; et son numéro, au barycentre de ses cases, dans un calque HTML pour rester net. */
function renderZones(){const cv=$('map-zones'),noms=$('map-zones-noms');if(!cv||!noms)return;const m=currentMap();
 if(!zonesVisibles||!m||view!=='mj'){cv.style.display='none';noms.hidden=true;return}
 const z=zonesDe(m);if(!z||!z.compte){cv.style.display='none';noms.hidden=true;return}
 cv.style.display='';noms.hidden=false;peindreZones(cv,noms,z,nomsDesZones(m,z))}
/* La même peinture pour la table et pour l'éditeur : la toile à la grille du calcul, les
   numéros à part — ou les noms que le MJ leur a donnés. « edite » : ce que fait un clic
   sur un numéro, dans l'éditeur seulement. */
function peindreZones(cv,noms,z,surnoms,edite){if(!z)return;
 const W=z.cols,H=z.rows;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
 const ctx=cv.getContext('2d'),img=ctx.createImageData(W,H),px=img.data,sx=new Float64Array(z.compte+1),sy=new Float64Array(z.compte+1),nb=new Int32Array(z.compte+1);
 for(let k=0;k<W*H;k++){const n=z.zone[k];if(!n)continue;const [h,s]=TEINTES_ZONE[(n-1)%TEINTES_ZONE.length],[r,g,b]=hslVersRgb(h,s,55);
  const o=k*4;px[o]=r;px[o+1]=g;px[o+2]=b;px[o+3]=110;const i=k%W;sx[n]+=i+.5;sy[n]+=(k-i)/W+.5;nb[n]++}
 ctx.putImageData(img,0,0);
 noms.replaceChildren();
 for(let n=1;n<=z.compte;n++){if(!nb[n])continue;const e=document.createElement('span');e.textContent=(surnoms&&surnoms.get(n))||String(n);
  const [h,s]=TEINTES_ZONE[(n-1)%TEINTES_ZONE.length];e.style.setProperty('--z','hsl('+h+' '+s+'% 38%)');
  const x=sx[n]/nb[n]/W*100,y=sy[n]/nb[n]/H*100;e.style.left=x+'%';e.style.top=y+'%';
  if(edite){e.classList.add('editable');e.title='Renommer la zone '+n;e.setAttribute('role','button');
   e.onpointerdown=ev=>ev.stopPropagation();e.onclick=ev=>{ev.stopPropagation();edite(n,x,y,e)}}
  noms.append(e)}}
eyeBtn.onclick=()=>{vueTroupe=!vueTroupe;fogKey='';render()};
fogReset.onclick=()=>resetFog(false);
fogAll.onclick=()=>{const m=currentMap();if(!m)return;
 m.fogOff=!m.fogOff;fogKey='';render();scheduleSave();
 log(m.fogOff?'Voile levé : toute la carte est visible.':'Brouillard rétabli.',{ton:'carte'})};
lockBtn.onclick=()=>{tokensLocked=!tokensLocked;refreshGmBar();render();scheduleSave();
 document.dispatchEvent(new Event('amertume-content-changed'));
 // Une note pour le MJ seul : chez les joueurs, le verrou se voit, il ne s'annonce pas.
 log(tokensLocked?'Déplacements figés : les joueurs ne peuvent plus bouger leurs tokens.':'Déplacements rendus aux joueurs.',{ton:'carte',local:true})};
// L'état des icônes se lit d'un coup d'œil : voile levé, déplacements gelés.
// L'XP que rapportent les adversaires posés sur une carte, selon le bestiaire du moment.
function xpDeCarte(m){return (m&&m.foes||[]).map(f=>modeleActuel(f.tpl)||f.tpl||{}).filter(t=>!duCoteTroupe(t)).reduce((s,t)=>s+(Math.max(0,Math.trunc(Number(t.xp))||0)),0)}
function refreshGmBar(){const m=currentMap(),mj=view==='mj';
 // La barre annonce la carte qu'on joue, pas le mot « carte tactique » : c'est la seule
 // trace du nom de la carte depuis que le bandeau de scène a disparu.
 const titre=$('carte-titre');
 if(titre)titre.textContent=m&&m.name?m.name:'Carte tactique';
 /* Au MJ seul, à côté du nom : l'XP déjà accordée sur cette carte, sur tout ce qu'elle rapporte —
    l'accordée plus celle des adversaires encore en scène. */
 if(titre&&mj&&m){const donne=Math.max(0,Math.trunc(Number(m.xpAccordee))||0),reste=actors.filter(a=>a&&!duCoteTroupe(a)).reduce((s,a)=>s+(Math.max(0,Math.trunc(Number(a.xp))||0)),0);
  const x=document.createElement('span');x.className='xp-carte';x.textContent=donne+'/'+(donne+reste)+' xp';titre.append(x)}
 fogBar.hidden=!mj;fogReset.hidden=fogAll.hidden=!m;
 fogAll.classList.toggle('on',!!(m&&m.fogOff));eyeBtn.hidden=!m;eyeBtn.classList.toggle('on',vueTroupe);
 zonesBtn.hidden=!m;zonesBtn.classList.toggle('on',zonesVisibles);zonesBtn.title=zonesVisibles?'Cacher les zones de la carte':'Voir les zones de la carte';
 fogAll.title=m&&m.fogOff?'Rétablir le brouillard':'Tout révéler';
 /* Changer de carte en pleine partie appartient au MJ : la liste et son bouton suivent
    donc la vue, et non le seul fait qu'il existe des cartes. Ils étaient montés une fois
    pour toutes avant le chargement de la partie, quand « maps » était encore vide : ils
    ne reparaissaient plus jusqu'à la première retouche de carte. */
 mapPick.hidden=mapOpen.hidden=!mj||!maps.length;
 lockBtn.textContent=tokensLocked?'🔒':'🔓';lockBtn.classList.toggle('on',tokensLocked);
 lockBtn.title=tokensLocked?'Rendre les déplacements aux joueurs':'Figer les déplacements des joueurs'}
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}

// L'onglet Cartes n'existe que pour le MJ ; passer en vue joueur ramène à la table.
/* Le cadre prend la taille de la carte avant tout : ce que le rendu mesure — vue,
   contact, révélation — se mesure dans le bon cadre dès le premier passage. */
const renderBeforeMaps=render;render=function(){
 // Une autre carte, ou un voile qui change : elle se couvre jusqu'à la prochaine peinture.
 if(cleVoile()!==cartePeinte)voileAttente.hidden=false;
 applyMapRatio();computeFog();renderBeforeMaps();renderMapLayer();renderFouilles();calerColonnes();
 majOnglets()};
/* Le journal descend jusqu'au bas de la carte : son panneau est calé dessus à chaque rendu
   et à chaque changement de taille. Sur une seule colonne, il reprend sa hauteur propre. */
function calerColonnes(){const centre=document.querySelector('.layout>.stack:not(.left):not(.right)'),droite=document.querySelector('.stack.right'),gauche=document.querySelector('.stack.left');
 if(!centre||!droite||!centre.lastElementChild)return;
 const rc=centre.getBoundingClientRect(),rd=droite.getBoundingClientRect(),bas=centre.lastElementChild.getBoundingClientRect().bottom;
 const aCote=rd.left>=rc.right-1&&rc.height>0,h=Math.round(bas-rd.top);
 if(!aCote||h<300){droite.style.height='';droite.classList.remove('calee');if(gauche)gauche.classList.remove('calee');return}
 droite.classList.add('calee');droite.style.height=h+'px';if(gauche)gauche.classList.add('calee')}
if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(()=>calerColonnes());
 ['.map-panel','.actions-rangee','.stack.right>.panel:first-child'].forEach(s=>{const el=document.querySelector(s);if(el)ro.observe(el)});
 /* La rangée des Actions change de hauteur au fil des boutons : la carte se remesure, et
    ne se redessine que si sa hauteur a bougé — la rangée ne dépend pas de la carte, donc
    cela s'arrête de soi-même. */
 const rangee=document.querySelector('.actions-rangee');
 if(rangee)new ResizeObserver(()=>{if(document.body.classList.contains('page-maps'))return;
  const el=$('map'),h=el.offsetHeight;applyMapRatio();
  if(Math.abs(el.offsetHeight-h)>1){applyMapZoom();render()}}).observe(rangee)}
window.addEventListener('resize',()=>{calerColonnes();if(document.body.classList.contains('page-maps'))renderCanvas();
 else{applyMapRatio();applyMapZoom();render()}});
maps.forEach(ensure);refreshMapPick();renderMapLayer();refreshHistory();renderCatalogPages();
majOnglets();
// La page d'avant se rouvre une fois la partie chargée : avant, elle n'a rien à montrer.
document.addEventListener('amertume-partie-chargee',()=>{refreshMapPick();const p=lastPage();if(p!=='table')showPage(p)});
