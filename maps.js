/* Cartes de combat : onglet MJ pleine page pour tracer la matière de blocage, la
   découper, poser portes, zone de départ et adversaires pré-placés.
   La matière est une couche unique de polygones exacts (voir combat.js) ; portes, zone
   de départ et adversaires restent des rectangles ou des points en pourcentages. */
'use strict';
let mapDraft=null,mapTool='select',mapSel=null,mapDrag=null,cutRect=null,lasso=null;
let undoStack=[],redoStack=[],zoomC=1,panCX=0,panCY=0;
const nsSVG='http://www.w3.org/2000/svg';
// Grille du brouillard : des cellules carrées et fines, pour un bord net qui suit les murs.
let fogCalcul=0,fogMemTick=0;
const FOG_COLS=640;let fogVis=null,fogSeen=null,fogSeenSrc=null,fogKey='',fogDim=null,fogMem=null,fogDirty=true;
function fogDims(m){const r=(m&&m.ratio)||16/9,w=FOG_COLS,h=Math.max(32,Math.round(w/r));return{w,h,n:w*h}}
const KINDS={matiere:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire',objet:'Objet',coffre:'Coffre',lumiere:'Lumière',piege:'Piège',declencheur:'Déclencheur du piège',coupure:'Séparation de zones',lien:'Regroupement de zones'};
function currentMap(){return maps.find(m=>m.id===currentMapId)||null}
/* Les paysages : des visions d'autres endroits, non des cartes. Ils vivent parmi les cartes, marqués « paysage », et la table
   les montre quand le MJ le veut : une image, sans tracé, sans socles, sans zone de départ, sans rien d'un combat. */
const estPaysage=m=>!!m&&m.paysage===true;
function enPaysage(){return estPaysage(currentMap())}
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
 +'|'+(m.doors||[]).map(d=>d.x+','+d.y+','+d.w+','+d.h+','+(d.a||0)+(d.open?'o':'f')+(d.secret?'s':'')+(d.decouvert?'d':'')+(d.fenetre?'w':'')).join(';')}
// L'éditeur redessine à chaque geste : son contour est gardé de la même façon.
let skinCache={cle:'',contours:[]};
function draftSkin(m){const cle=geometryKey(m);
 if(skinCache.cle!==cle)skinCache={cle,contours:wallShape(m).contours};
 return skinCache.contours}
function mapShapes(m){const cle=geometryKey(m);
 if(shapeCache.cle!==cle){const murs=wallShape(m);
  shapeCache={cle,murs,formes:[murs,...doorBlocks(m).map(t=>({contours:[t]}))],formesVue:[murs,...doorBlocksVue(m).map(t=>({contours:[t]}))]}}
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
// v0.971 : ce qui arrête le regard et la lumière — les mêmes obstacles, sauf les fenêtres ouvertes.
function obstaclesVue(){const m=currentMap();return m?mapShapes(m).formesVue:activeObstacles()}
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
/* ---------- L'obscurité et la lumière ----------
   Dans le noir, on ne voit que ce qui est éclairé, et ce qui tient dans son rayon de vision : la zone de contact pour
   tout le monde, plus loin avec Vision dans le noir, sans limite pour un adversaire nyctalope. Aveugle ramène chacun à sa
   zone de contact, lumière ou pas. Les murs s'ajoutent à cela, comme toujours : la règle ne vaut que dans la ligne de vue.
   Ce qui est éclairé se lit sur un masque à la grille du brouillard : blanc hors de l'obscurité et sous une lumière, noir
   dans le noir. Il se refait quand l'obscurité ou les lumières changent, pas à chaque pas. */
function obscuriteKey(m){return obscuriteDe(m).map(p=>p.anneaux.map(r=>r.length+':'+r.reduce((t,q)=>t+q[0]*7.31+q[1]*13.07,0).toFixed(3)).join(',')).join(';')}
/* Les sources de lumière de la carte ouverte : chacune {x,y,rayon}, le point en pour cent, le rayon en pixels. Les lumières
   de la carte encore allumées, et chaque combattant debout qui porte de quoi éclairer. Le feu éclaire aussi, sur quatre
   mètres : un combattant debout qui a l'état Feu, un orbe de feu posé sur le terrain, et un mur de feu tout du long, un
   point par mètre. */
const LUMIERE_FEU=4;
/* Une source prise dans la matière, une torche scellée au mur, éclaire depuis le point libre le plus proche, comme un socle
   collé au mur regarde : son halo ne traverse pas le mur et n'empiète pas sur lui ; les portes closes l'arrêtent aussi. */
function sourcesLumiere(){const m=currentMap();if(!m)return [];const tk=tokenPx(),items=typeof catalog!=='undefined'?catalog.items||[]:[],formes=obstaclesVue();
 const libre=s=>{const p=pointLibre(s,formes);return p?{...s,x:p.x,y:p.y}:null};
 const l=(m.lumieres||[]).filter(x=>x&&!x.eteinte).map(x=>libre({x:x.x,y:x.y,rayon:x.rayon*tk})).filter(Boolean);
 actors.forEach(a=>{if(!a||!alive(a)||a.horsCarte)return;const feu=hasState(a,'Feu')||(a.orbeStatique&&a.orbeStatique.etat==='Feu')?LUMIERE_FEU:0;
  const p=Math.max(lumierePortee(a,items),feu);if(p>0){const s=libre({x:a.x,y:a.y,rayon:p*tk});if(s)l.push(s)}});
 const size=mapSize();
 if(size.width&&typeof mursEnJeu==='function')mursEnJeu().forEach(([,mur])=>{if(String(mur.etat)!=='Feu')return;
  const pts=mur.pts.map(q=>[q.x/100*size.width,q.y/100*size.height]);if(mur.zone&&pts.length>2)pts.push(pts[0]);
  for(let i=1;i<pts.length;i++){const [x1,y1]=pts[i-1],[x2,y2]=pts[i],n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/tk));
   for(let k=i===1?0:1;k<=n;k++){const s=libre({x:(x1+(x2-x1)*k/n)/size.width*100,y:(y1+(y2-y1)*k/n)/size.height*100,rayon:LUMIERE_FEU*tk});if(s)l.push(s)}}});
 /* v0.971 : une fenêtre ouverte entre le jour et l'obscurité fait entrer la lumière : un rayon de torche, depuis la fenêtre,
    que les murs arrêtent. Un côté dans le noir, l'autre au clair. */
 if(!m.obscuriteOff&&obscuriteDe(m).length)(m.doors||[]).forEach(d=>{if(!d||!d.fenetre||!d.open||!(d.w>0&&d.h>0))return;
  const c={x:d.x+d.w/2,y:d.y+d.h/2},e=Math.max(d.w,d.h)*.6+1,cotes=[[c.x+e,c.y],[c.x-e,c.y],[c.x,c.y+e],[c.x,c.y-e]].map(p=>dansObscurite(m,p));
  if(cotes.some(Boolean)&&cotes.some(v=>!v)){const rayon=(typeof porteeEclat==='function'?porteeEclat():3)*tk;
   /* v0.975 : la lumière part du côté sombre, juste derrière la vitre, et non d'un point pris au hasard autour d'elle : depuis
      le dehors, elle ne passait que par l'embrasure et traçait des coins à bords droits. Elle s'éteint ensuite en douceur. */
   const ang=(Number(d.a)||0)*Math.PI/180,large=d.w>=d.h,nx=large?-Math.sin(ang):Math.cos(ang),ny=large?Math.cos(ang):Math.sin(ang);
   const dedans=q=>formes.some(f=>shapeContains(f,q));let s=null;
   for(const sg of [1,-1]){for(let t=Math.min(d.w,d.h)/2;t<=3;t+=.15){const q=[c.x+sg*nx*t,c.y+sg*ny*t];
     if(!dedans(q)){if(dansObscurite(m,q))s={x:q[0]+sg*nx*.3,y:q[1]+sg*ny*.3,rayon,fenetre:true};break}}if(s)break}
   if(s&&dedans([s.x,s.y]))s=libre(s);if(!s)s=libre({x:c.x,y:c.y,rayon,fenetre:true});if(s)l.push(s)}});
 return l}
/* v0.984 : les sources de lumière se calculent une fois par geste, pas une fois par porte : chaque porte testée en vue les
   redemandait, et chacune repoussait ses lumières hors des murs. Le résultat vaut jusqu'à la fin de la tâche en cours, tant
   que les socles, les lumières et les portes n'ont pas bougé. */
{const sl=sourcesLumiere;let memo=null;
 const cle=()=>{const m=currentMap();return (m?m.id:'')+'|'+actors.map(a=>a?a.x+','+a.y+','+(a.hp>0?1:0)+(a.horsCarte?'h':'')+(a.eclat?'e':'')+(a.states||[]).length:'').join(';')
  +'|'+(m&&m.lumieres||[]).map(l=>l&&l.x+','+l.y+(l.eteinte?'e':'')).join(';')+'|'+(m&&m.doors||[]).map(d=>d&&d.open?1:0).join('')};
 sourcesLumiere=function(){const k=cle();if(memo&&memo.k===k)return memo.v;const v=sl();memo={k,v};queueMicrotask(()=>{memo=null});return v}}
/* Les halos : un rond de clarté chaude, à peine teinté, autour de chaque source, arrêté par les murs. Une toile à part, sous le
   brouillard : là où l'on voit, le halo paraît ; ailleurs, le noir le couvre. */
function toileHalos(){let cv=$('halos');if(!cv){cv=document.createElement('canvas');cv.id='halos';cv.setAttribute('aria-hidden','true');$('fog').before(cv)}return cv}
function renderHalos(){const cv=toileHalos(),m=currentMap(),size=mapSize();
 const sources=m?sourcesLumiere():[];if(!sources.length||!size.width){cv.style.display='none';return}
 // La toile couvre la carte : sa taille est celle du cadre, déjà mesuré pendant un rendu.
 cv.style.display='';const large=cadreFige?cadreFige.cw:cv.clientWidth,haut=cadreFige?cadreFige.ch:cv.clientHeight;if(!large||!haut)return;
 const ech=Math.min(2,window.devicePixelRatio||1),zoom=Math.max(1,typeof mapZoom==='number'&&mapZoom>0?mapZoom:1);
 const W=Math.max(1,Math.min(4096,Math.round(large*ech*zoom))),H=Math.max(1,Math.round(W*haut/large));
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
 const cle=m.id+'|'+W+'x'+H+'|'+sources.map(l=>l.x.toFixed(2)+','+l.y.toFixed(2)+','+Math.round(l.rayon)).join(';')+'|'+geometryKey(m);if(cv._peinte===cle)return;cv._peinte=cle;
 const ctx=cv.getContext('2d'),k=W/size.width,formes=obstaclesVue();ctx.clearRect(0,0,W,H);
 sources.forEach(l=>{const poly=reachPolygon(l,formes,l.rayon,size.width,size.height,96);if(poly.length<3)return;
  const cx=l.x/100*W,cy=l.y/100*H,r=l.rayon*k;ctx.save();
  ctx.beginPath();poly.forEach((q,i)=>ctx[i?'lineTo':'moveTo'](q[0]/100*W,q[1]/100*H));ctx.closePath();ctx.clip();
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,226,176,.30)');g.addColorStop(.55,'rgba(255,216,156,.16)');g.addColorStop(1,'rgba(255,206,136,0)');
  ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,2*r,2*r);ctx.restore()})}
/* Les lumières de la carte, à la table : un petit jeton au cœur du halo, l'icône de l'objet qu'elle contient ou une flamme.
   La troupe le voit comme un objet, en vue ou déjà vu ; éteinte, elle reste là, grisée, sans éclairer, et le MJ la rallume
   de son menu. Un aventurier au contact prend l'objet d'un clic : la lumière s'éteint et n'est plus là. */
function lumiereAPortee(a,l){const size=mapSize();if(!a||!size.width)return false;
 const p=pointLibre(l,walls())||l;return inContact(a,l,size,tokenOf(a),tokenPx()*SOCLE_TAILLES.small)&&!wallsBetween(a,p,walls())}
/* Ce qui se prend au sol se réserve d'abord sur la table (reserveSurTable) : la prise n'a lieu qu'une fois, même si deux
   tables la tentent au même instant. Les rangs dans le tableau des portes sont ceux qu'etatVivant écrit. */
function rangsSol(m){const n=(m.doors||[]).length,n2=n+(m.objets||[]).length,n3=n2+(m.coffres||[]).length;return {n,n2,n3}}
function prisSurTable(marque,fait){if(!marque||typeof reserveSurTable!=='function'||typeof enLigne==='undefined'||!enLigne)return fait();
 reserveSurTable(marque).then(ok=>{if(ok)fait();else{render();scheduleSave()}})}
function recupererLumiere(a,l){if(!a||!l||l.eteinte)return;
 const pieces=(l.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);if(!pieces.length)return;
 const m=currentMap();if(!m)return;
 // Un sac plein ne prend rien : on ne réserve pas ce qu'on ne pourra pas porter.
 if(typeof inventairePlein==='function'&&pieces.every(it=>inventairePlein(a,it)))return;
 const marque=l.pose?arr=>{const k=arr.findIndex(v=>v&&typeof v==='object'&&v.p===l.id);if(k<0)return null;arr.splice(k,1);return arr}
  :arr=>{const k=rangsSol(m).n3+(m.lumieres||[]).filter(x=>x&&!x.pose).indexOf(l);if(k<rangsSol(m).n3||arr[k]===2)return null;arr[k]=2;return arr};
 prisSurTable(marque,()=>recupereLumiereFait(a,l,pieces))}
function recupereLumiereFait(a,l,pieces){
 // Un sac plein ne prend rien : la lumière reste où elle est.
 const pris=pieces.filter(it=>{if(typeof ajouterInventaire==='function')return ajouterInventaire(a,it)!==false;noteInventaire(a,it.name);return true});if(!pris.length)return;
 // Posée au sol, elle s'en va avec son objet ; une lumière de la carte s'éteint, et la carte rouverte la rallume.
 if(l.pose){const m=currentMap(),k=m?(m.lumieres||[]).indexOf(l):-1;if(k>=0)m.lumieres.splice(k,1);log(nomNum(a)+' ramasse '+pris.map(it=>'⟦'+it.id+'⟧').join(' ')+'.',{ton:'butin'})}
 else{l.eteinte=true;l.prise=true;log(nomNum(a)+' prend '+pris.map(it=>'⟦'+it.id+'⟧').join(' ')+' : '+l.nom+' s’éteint.',{ton:'butin'})}
 render();saveMaps();scheduleSave()}
/* Poser une source de lumière : l'objet qui éclaire quitte l'inventaire et reste au sol, sous l'aventurier, allumé, jusqu'à
   ce que quelqu'un à son contact le ramasse. */
function poserLumiere(a,o){const m=currentMap();if(!a||!o||!m||a.horsCarte||!lumiereDe(o)||!(a.inventaire||[]).includes(o.id))return;
 retirerInventaire(a,o);if(typeof syncEquipped==='function')syncEquipped(a);m.lumieres??=[];
 m.lumieres.push(cleanLumiere({id:crypto.randomUUID(),nom:o.name,x:a.x,y:a.y,rayon:lumiereDe(o),items:[o.id],pose:true}));
 log(nomNum(a)+' pose ⟦'+o.id+'⟧.',{ton:'butin'});render();saveMaps();scheduleSave()}
function menuLumiereMJ(l,x,y){fermeMenuObjet();const m=document.createElement('div');m.className='menu-objet';m.setAttribute('role','menu');
 const t=document.createElement('p');t.className='menu-objet-titre';t.textContent=l.nom||'Lumière';m.append(t);
 const bouton=(txt,fn)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.textContent=txt;b.onclick=()=>{fermeMenuObjet();fn()};m.append(b)};
 if(!l.pose)bouton(l.eteinte?'Rallumer':'Éteindre',()=>{if(l.eteinte){delete l.eteinte;delete l.prise}else l.eteinte=true;log(l.nom+(l.eteinte?' s’éteint.':' se rallume.'),{ton:'carte'});render();saveMaps();scheduleSave()});
 const h=(l.items||[]).length&&!l.eteinte?heroLePlusProche(l):null;if(h)bouton('Donner à '+nomNum(h)+', le plus proche',()=>recupererLumiere(h,l));
 document.body.append(m);const r=m.getBoundingClientRect();
 m.style.left=Math.max(6,Math.min(x+8,innerWidth-r.width-6))+'px';m.style.top=Math.max(6,Math.min(y+8,innerHeight-r.height-6))+'px';menuObjet=m;
 setTimeout(()=>{document.addEventListener('pointerdown',dehorsMenuObjet,true);document.addEventListener('keydown',echapMenuObjet,true)})}
/* L'icône d'une lumière qui contient des objets : le logo du premier qui en a un, sinon le signe de la famille du premier,
   comme son carré dans un inventaire. Sans objet, rien : la flamme. */
function iconeDeLumiere(l){const pieces=(l&&l.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);if(!pieces.length)return null;
 for(const o of pieces){const im=typeof logoEquipement==='function'?logoEquipement(o):null;if(im)return im}
 return typeof glyphePiece==='function'&&typeof itemColumn==='function'?glyphePiece(itemColumn(pieces[0])):null}
// Une lumière est en vue dès qu'un œil de la troupe a la ligne de vue sur son jeton : elle s'éclaire elle-même.
function lumiereEnVue(l){const m=currentMap();if(!fogVis||!m||m.fogOff)return true;const size=mapSize();if(!size.width)return true;
 const c=[l.x/100*size.width,l.y/100*size.height],r=tokenPx()*SOCLE_TAILLES.small/2,yeux=fogVisQui||[];
 return visionInPixels().some((p,k)=>polyTouchesDisc(p,c,r)&&(!yeux[k]||!blinded(yeux[k])||tokenDistance(yeux[k],l,size)<=rayonVision(yeux[k])+r))}
function renderLumieres(){const vue=$('map-view'),m=currentMap();
 vue.querySelectorAll('.token.lumiere').forEach(t=>t.remove());renderHalos();if(!m)return;
 (m.lumieres||[]).forEach(l=>{if(!l||l.prise)return;
  const enVue=lumiereEnVue(l),vuTroupe=enVue||seenAt(l.x,l.y);
  if(oeilJoueur()&&!vuTroupe)return;
  // Hors de la vue de la troupe, elle se grise, comme un objet ou une porte dont on se souvient ; éteinte aussi.
  const t=document.createElement('button');t.className='token lumiere'+(!enVue?' veiled':'')+(l.eteinte?' eteinte':'');
  const piece=(l.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).find(Boolean),im=iconeDeLumiere(l);
  if(im){im.classList.add('logo-objet');t.append(im);t.classList.add('avec-logo')}else t.textContent='🔥';
  t.setAttribute('aria-label',l.nom);
  t.style.left=l.x+'%';t.style.top=l.y+'%';t.style.setProperty('--token',(tokenPx()*SOCLE_TAILLES.small)+'px');
  t.onmousedown=e=>e.preventDefault();
  // Posé au sol, l'objet montre sa bulle au survol, dès qu'il est dans la zone de contact d'un aventurier.
  if(l.pose&&piece&&typeof surveille==='function')surveille(t,()=>{if(!actors.some(a=>a&&a.hero&&alive(a)&&!a.horsCarte&&lumiereAPortee(a,l)))return;
   const d=gearDetail(piece,null,false);d.hidden=false;d.classList.add('large');ouvrirBulle(t,d,'bulle-gear')});
  /* Le MJ déplace à la main un objet posé au sol : sa lumière le suit pendant le geste. Un simple clic ouvre
     toujours son menu. */
  if(view==='mj'&&l.pose){let g=null;
   t.onpointerdown=e=>{if(e.button!==0)return;g={x:e.clientX,y:e.clientY,bouge:false,image:0};t.setPointerCapture(e.pointerId)};
   t.onpointermove=e=>{if(!g||!t.hasPointerCapture(e.pointerId))return;if(!g.bouge&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<4)return;g.bouge=true;
    const q=mapPct(e);l.x=Math.max(0,Math.min(100,q.x));l.y=Math.max(0,Math.min(100,q.y));t.style.left=l.x+'%';t.style.top=l.y+'%';
    if(!g.image)g.image=requestAnimationFrame(()=>{if(g)g.image=0;renderHalos();renderNuit()})};
   t.onpointerup=e=>{if(!g)return;const bouge=g.bouge;g=null;if(t.hasPointerCapture(e.pointerId))t.releasePointerCapture(e.pointerId);
    if(!bouge)return;t._glisse=true;setTimeout(()=>{render();saveMaps()},0)};
   t.onpointercancel=()=>{g=null}}
  t.onclick=e=>{e.stopPropagation();if(t._glisse){t._glisse=false;return}if(view==='mj'){menuLumiereMJ(l,e.clientX,e.clientY);return}
   const a=actors[owner];if(!a||!a.hero||!alive(a)||!(l.items||[]).length)return;
   if(!lumiereAPortee(a,l)){log('Approche ton aventurier : il faut être au contact de '+l.nom+'.',{local:true});return}
   recupererLumiere(a,l)};
  // Sous les combattants : posée à leurs pieds, elle ne les cache pas.
  vue.insertBefore(t,vue.querySelector('.token:not(.lumiere)'))})}
function clesLumieres(){return sourcesLumiere().map(l=>l.x.toFixed(2)+','+l.y.toFixed(2)+','+Math.round(l.rayon)).join(';')}
// Une carte est obscure dès qu'elle porte de l'obscurité ; sans elle, rien ne change. Le MJ peut aussi la désactiver en jeu.
function carteObscure(){const m=currentMap();return !!m&&!m.obscuriteOff&&obscuriteDe(m).length>0}
let masqueLum={cle:'',data:null};
function masqueEclaire(){const m=currentMap();if(!m||!fogDim)return null;const d=fogDim;
 const cle=m.id+'|'+d.n+'|'+obscuriteKey(m)+'|'+clesLumieres()+'|'+geometryKey(m);
 if(masqueLum.cle===cle)return masqueLum;
 const cv=document.createElement('canvas');cv.width=d.w;cv.height=d.h;const c=cv.getContext('2d');
 c.fillStyle='#fff';c.fillRect(0,0,d.w,d.h);
 const trace=anneaux=>{c.beginPath();anneaux.forEach(r=>{r.forEach((q,i)=>c[i?'lineTo':'moveTo'](q[0]/100*d.w,q[1]/100*d.h));c.closePath()})};
 c.fillStyle='#000';obscuriteDe(m).forEach(p=>{trace(p.anneaux);c.fill('evenodd')});
 // Une lumière repousse le noir en rond autour d'elle, jusqu'aux murs.
 const size=mapSize(),formes=obstaclesVue();c.fillStyle='#fff';
 if(size.width)sourcesLumiere().forEach(l=>{const poly=reachPolygon(l,formes,l.rayon,size.width,size.height,96);if(poly.length>2){trace([poly]);c.fill()}});
 const img=c.getImageData(0,0,d.w,d.h).data,data=new Uint8Array(d.n);for(let k=0;k<d.n;k++)data[k]=img[k*4]>127?1:0;
 masqueLum={cle,data};return masqueLum}
function eclaireA(x,y){const M=masqueEclaire();if(!M||!fogDim)return true;const d=fogDim;
 const i=Math.min(d.w-1,Math.max(0,Math.floor(x/100*d.w))),j=Math.min(d.h-1,Math.max(0,Math.floor(y/100*d.h)));
 return M.data[j*d.w+i]===1}
/* Le noir, un calque à part du brouillard de vue : l'obscurité, au bord fondu sur un demi-mètre, percée par les lumières.
   Une lumière éclaire pleinement en son cœur, s'assombrit peu à peu vers son bord, puis tombe au noir sur son dernier
   demi-mètre. Deux toiles en cache : l'obscurité fondue, qui ne se refait qu'avec elle ; le noir percé, qui suit aussi les
   lumières et les murs. */
let nuitFondue={cle:'',cv:null},nuitPercee={cle:'',cv:null},nuitGrise={cle:'',cv:null};
function toileCache(o,W,H){if(!o.cv)o.cv=document.createElement('canvas');if(o.cv.width!==W||o.cv.height!==H){o.cv.width=W;o.cv.height=H;o.cle=''}return o.cv}
// La force d'une lumière, du cœur au bord, en arrêts de dégradé : pleine, un peu moins, puis le noir sur le dernier demi-mètre.
function lumiereDegrade(r,demi){if(!(r>demi))return [[0,1],[.5,.55],[1,0]];const b=(r-demi)/r,q=(r-demi/2)/r;return [[0,1],[b*.5,.88],[b,.66],[q,.3],[1,0]]}
/* Le flou des toiles. Safari n'applique pas le filtre de canevas (ctx.filter) : le noir et la mémoire du brouillard y
   restaient en marches d'escalier. On le vérifie une fois ; sans lui, on floute à la main l'opacité de l'image, en trois
   passes de boîte (presque un flou gaussien), sur une copie réduite quand le flou est large, puis on l'étire lissée. */
let filtreCanevas=null;
function filtreDisponible(){if(filtreCanevas===null){try{const c=document.createElement('canvas');c.width=c.height=9;const x=c.getContext('2d');
 x.filter='blur(2px)';x.fillRect(4,4,1,1);filtreCanevas=x.getImageData(1,4,1,1).data[3]>0}catch(e){filtreCanevas=false}}return filtreCanevas}
function boiteFlou(a,w,h,r){const t=new Float32Array(a.length),n=2*r+1;
 for(let y=0;y<h;y++){const o=y*w;let s=0;for(let k=-r;k<=r;k++)s+=a[o+Math.min(w-1,Math.max(0,k))];
  for(let x=0;x<w;x++){t[o+x]=s/n;s+=a[o+Math.min(w-1,x+r+1)]-a[o+Math.max(0,x-r)]}}
 for(let x=0;x<w;x++){let s=0;for(let k=-r;k<=r;k++)s+=t[Math.min(h-1,Math.max(0,k))*w+x];
  for(let y=0;y<h;y++){a[y*w+x]=s/n;s+=t[Math.min(h-1,y+r+1)*w+x]-t[Math.max(0,y-r)*w+x]}}}
// Dessine « src » flouté de « flou » pixels, comme blur(), dans (dx,dy,dw,dh) ; « teinte » : la couleur de ce qui reste.
function dessineFloute(ctx,src,dx,dy,dw,dh,flou,teinte){
 if(filtreDisponible()){ctx.filter='blur('+flou.toFixed(2)+'px)';ctx.drawImage(src,dx,dy,dw,dh);ctx.filter='none';return}
 const d=Math.max(1,flou/3),w=Math.max(1,Math.round(dw/d)),h=Math.max(1,Math.round(dh/d)),s=flou/d;
 const c=document.createElement('canvas');c.width=w;c.height=h;const cx=c.getContext('2d');cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(src,0,0,w,h);
 const im=cx.getImageData(0,0,w,h),px=im.data,a=new Float32Array(w*h);for(let i=0;i<w*h;i++)a[i]=px[i*4+3];
 const r=Math.max(1,Math.round((Math.sqrt(1+4*s*s)-1)/2));boiteFlou(a,w,h,r);boiteFlou(a,w,h,r);boiteFlou(a,w,h,r);
 for(let i=0;i<w*h;i++){const o=i*4;px[o]=teinte[0];px[o+1]=teinte[1];px[o+2]=teinte[2];px[o+3]=a[i]}
 cx.putImageData(im,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(c,dx,dy,dw,dh)}
function calqueNuit(W,H){const m=currentMap(),size=mapSize();if(!m||!size.width)return null;const k=W/size.width;
 const c1=m.id+'|'+W+'x'+H+'|'+obscuriteKey(m)+'|'+geometryKey(m),f=toileCache(nuitFondue,W,H);
 if(nuitFondue.cle!==c1){nuitFondue.cle=c1;
  // L'obscurité nette, sur une toile élargie dont les marges prolongent ses bords : le flou ne pâlit pas le tour de la carte.
  // Du même noir que l'inexploré : rien ne distingue une zone obscure d'un mur jamais vu.
  const net=document.createElement('canvas');net.width=W;net.height=H;const nc=net.getContext('2d');nc.fillStyle='rgb(6,9,11)';
  obscuriteDe(m).forEach(p=>{nc.beginPath();p.anneaux.forEach(r=>{r.forEach((q,i)=>nc[i?'lineTo':'moveTo'](q[0]/100*W,q[1]/100*H));nc.closePath()});nc.fill('evenodd')});
  // La pierre et les filets clairs qui touchent le noir, de la même encre, d'une grille fine étirée : aucun bord de mur ne se devine.
  {const pierre=noirDeLaPierre(m),g=document.createElement('canvas');g.width=pierre.cols;g.height=pierre.rows;const gx=g.getContext('2d'),im=gx.createImageData(pierre.cols,pierre.rows);
   pierre.data.forEach((v,k)=>{if(v){const o=k*4;im.data[o]=6;im.data[o+1]=9;im.data[o+2]=11;im.data[o+3]=255}});gx.putImageData(im,0,0);
   nc.imageSmoothingEnabled=true;nc.drawImage(g,0,0,W,H)}
  const flou=Math.max(.5,tokenPx()*.2*k),e=Math.ceil(flou*3)+1,large=document.createElement('canvas');large.width=W+2*e;large.height=H+2*e;const lc=large.getContext('2d');
  lc.drawImage(net,e,e);lc.drawImage(net,0,0,1,H,0,e,e,H);lc.drawImage(net,W-1,0,1,H,W+e,e,e,H);lc.drawImage(net,0,0,W,1,e,0,W,e);lc.drawImage(net,0,H-1,W,1,e,H+e,W,e);
  lc.drawImage(net,0,0,1,1,0,0,e,e);lc.drawImage(net,W-1,0,1,1,W+e,0,e,e);lc.drawImage(net,0,H-1,1,1,0,H+e,e,e);lc.drawImage(net,W-1,H-1,1,1,W+e,H+e,e,e);
  const fc=f.getContext('2d');fc.clearRect(0,0,W,H);dessineFloute(fc,large,-e,-e,large.width,large.height,flou,[6,9,11])}
 const sources=sourcesLumiere(),c2=c1+'|'+sources.map(l=>l.x.toFixed(2)+','+l.y.toFixed(2)+','+Math.round(l.rayon)).join(';')+'|'+geometryKey(m),p=toileCache(nuitPercee,W,H);
 if(nuitPercee.cle!==c2){nuitPercee.cle=c2;const pc=p.getContext('2d'),formes=obstaclesVue(),demi=tokenPx()*.5;
  pc.globalCompositeOperation='source-over';pc.clearRect(0,0,W,H);pc.drawImage(f,0,0);pc.globalCompositeOperation='destination-out';
  sources.forEach(l=>{const poly=reachPolygon(l,formes,l.rayon,size.width,size.height,96);if(poly.length<3)return;
   const cx=l.x/100*W,cy=l.y/100*H,g=pc.createRadialGradient(cx,cy,0,cx,cy,l.rayon*k);
   (l.fenetre?[[0,1],[.25,.8],[.55,.45],[.8,.15],[1,0]]:lumiereDegrade(l.rayon,demi)).forEach(([o,v])=>g.addColorStop(o,'rgba(0,0,0,'+v+')'));
   pc.fillStyle=g;pc.beginPath();poly.forEach((q,i)=>pc[i?'lineTo':'moveTo'](q[0]/100*W,q[1]/100*H));pc.closePath();pc.fill()});
  pc.globalCompositeOperation='source-over'}
 return p}
/* Le noir, sur sa toile, au-dessus du brouillard, à la taille du cadre sans le zoom. Chez un joueur, il est plein, sauf ce que
   chaque œil voit dans le noir à l'instant : sa zone de contact, plus loin avec Vision dans le noir, arrêtée par les murs et
   les portes closes. Rien ne s'en garde : il se referme derrière l'aventurier. Chez le MJ, c'est un voile. Il ne se repeint
   qu'au changement, et suit le socle qu'on glisse, image après image. */
function toileNuit(){let cv=$('nuit');if(!cv){cv=document.createElement('canvas');cv.id='nuit';cv.setAttribute('aria-hidden','true');$('fog').after(cv)}return cv}
/* v1.159 : la copie réduite d'un calque de la nuit, refaite quand le calque change (sa clé) ou la taille voulue. */
const copiesNuit=new WeakMap();
function reduiteNuit(src,W,H,cleSrc){const o0=src===nuitFondue.cv?nuitFondue:src===nuitPercee.cv?nuitPercee:null;let o=copiesNuit.get(src);
 if(!o){o={cle:'',cv:document.createElement('canvas')};copiesNuit.set(src,o)}const k=(cleSrc!==undefined?cleSrc:o0?o0.cle:'')+'|'+src.width+'x'+src.height+'|'+W+'x'+H;
 if(o.cle!==k){o.cle=k;o.cv.width=W;o.cv.height=H;const x=o.cv.getContext('2d');x.clearRect(0,0,W,H);x.drawImage(src,0,0,W,H)}return o.cv}
function renderNuit(){const cv=toileNuit(),m=currentMap(),size=mapSize();
 if(!m||!size.width||!carteObscure()){cv.style.display='none';cv._peinte='';return}
 // La toile couvre la carte : sa taille est celle du cadre, déjà mesuré pendant un rendu.
 cv.style.display='';const large=cadreFige?cadreFige.cw:cv.clientWidth,haut=cadreFige?cadreFige.ch:cv.clientHeight;if(!large||!haut)return;
 const ech=Math.min(2,window.devicePixelRatio||1),NW=Math.max(1,Math.min(2048,Math.round(large*ech))),NH=Math.max(1,Math.round(NW*haut/large));
 const nuit=calqueNuit(NW,NH);if(!nuit)return;
 const joueur=oeilJoueur(),yeux=joueur?fogSeers().map(o=>({o,r:rayonVision(o)})).filter(y=>y.r>0):[];
 /* v1.159 : pendant le glissement d'un socle, la toile se peint à demi-résolution — le noir a le bord fondu, la différence ne se
    voit pas, et il y a quatre fois moins à peindre ; au lâcher, le rendu la repeint nette. */
 const red=window.socleEnMain?.5:1,W=Math.max(1,Math.round(NW*red)),H=Math.max(1,Math.round(NH*red));
 const cle=[nuitPercee.cle,NW,NH,red,joueur,fogCalcul,yeux.map(({o,r})=>o.x.toFixed(2)+','+o.y.toFixed(2)+','+(Number.isFinite(r)?Math.round(r):'∞')).join(';')].join('|');
 if(cv._peinte===cle)return;cv._peinte=cle;
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
 // Sous le geste, les calques se lisent dans leurs copies réduites, faites une fois : chaque image copie pixel pour pixel.
 const R=t=>red<1?reduiteNuit(t,W,H):t;
 const c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);c.setTransform(red,0,0,red,0,0);c.drawImage(R(nuit),0,0,NW,NH);
 if(joueur){const formes=obstaclesVue();c.globalCompositeOperation='destination-out';c.fillStyle='#000';
  // Ce que l'œil voit dans le noir se fond vers son bord, du même dégradé qu'une lumière.
  const kk=NW/size.width,demi=tokenPx()*.5;
  yeux.forEach(({o,r})=>{c.beginPath();
   if(Number.isFinite(r)){const poly=reachPolygon(o,formes,r,size.width,size.height,72);if(poly.length<3)return;poly.forEach((q,k)=>c[k?'lineTo':'moveTo'](q[0]/100*NW,q[1]/100*NH));c.closePath();
    const cx=o.x/100*NW,cy=o.y/100*NH,g=c.createRadialGradient(cx,cy,0,cx,cy,r*kk);lumiereDegrade(r,demi).forEach(([s,v])=>g.addColorStop(s,'rgba(0,0,0,'+v+')'));c.fillStyle=g}
   else{c.rect(0,0,NW,NH);c.fillStyle='#000'}
   c.fill()});
  c.globalCompositeOperation='source-over'}
 /* Ce que la lumière éclaire hors de la vue de la troupe se grise, comme ce dont on se souvient : la part éclairée du noir,
    hors des champs de vision, reprend la moitié de son noir. */
 if(fogVis&&fogVis.length&&nuitFondue.cv){const g=toileCache(nuitGrise,W,H),gc=g.getContext('2d');
  gc.setTransform(1,0,0,1,0,0);gc.globalCompositeOperation='source-over';gc.clearRect(0,0,W,H);gc.setTransform(red,0,0,red,0,0);gc.drawImage(R(nuitFondue.cv),0,0,NW,NH);gc.globalCompositeOperation='destination-out';gc.drawImage(R(nuit),0,0,NW,NH);gc.fillStyle='#000';
  fogVis.forEach(poly=>{if(!poly||poly.length<3)return;gc.beginPath();poly.forEach((q,k)=>gc[k?'lineTo':'moveTo'](q[0]/100*NW,q[1]/100*NH));gc.closePath();gc.fill()});
  gc.globalCompositeOperation='source-over';gc.setTransform(1,0,0,1,0,0);c.setTransform(1,0,0,1,0,0);c.globalAlpha=.5;c.drawImage(g,0,0);c.globalAlpha=1}
 c.setTransform(1,0,0,1,0,0);cv.style.opacity=joueur?'1':'.5'}
// Un combattant dans le noir : sur une case obscure que rien n'éclaire.
function dansLeNoir(a){return !!a&&carteObscure()&&!eclaireA(a.x,a.y)}
/* Jusqu'où un combattant voit dans le noir, en pixels : sa zone de contact ; plus loin avec Vision dans le noir ; sans limite
   pour un adversaire nyctalope, ce qu'ils sont tous sauf réglage contraire. Aveugle : la zone de contact, et rien d'autre. */
function rayonVision(a){const base=contactRadius(tokenOf(a));
 if(!a||blinded(a))return base;
 if(!a.hero)return a.orbeStatique||a.nyctalope===false?base:Infinity;
 const m=typeof visionNoirDe==='function'?visionNoirDe(a):0;
 return Math.max(base,m*tokenPx())}
// « o » voit le socle « b », les murs mis à part : dans son rayon, ou éclairé s'il n'est pas aveugle.
function voitSocle(o,b){if(!o||!b)return true;if(!carteObscure()&&!blinded(o))return true;
 const size=mapSize();if(!size.width)return true;
 if(tokenDistance(o,b,size)<=rayonVision(o)+tokenOf(b)/2)return true;
 return !blinded(o)&&eclaireA(b.x,b.y)}
// « o » voit le point (x,y) en pour cent, les murs mis à part.
function voitPoint(o,x,y){if(!o)return true;if(!carteObscure()&&!blinded(o))return true;
 const size=mapSize();if(!size.width)return true;
 if(Math.hypot((x-o.x)/100*size.width,(y-o.y)/100*size.height)<=rayonVision(o))return true;
 return !blinded(o)&&eclaireA(x,y)}
/* Les polygones déjà versés dans la mémoire d'exploration : chacun ne l'est qu'une fois.
   Sans cela, chaque pas d'un aventurier refaisait rentrer dans la grille la vue de tous
   les autres, immobiles — quelques millisecondes par tête, à chaque image. */
let fogMemorise=new WeakMap(),fogVisQui=[],fogTroupeQui=[];
/* La mémoire d'exploration n'est réemballée en base64 — quelques millisecondes pour
   deux cent mille cases — que lorsqu'elle a changé, et une fois par calcul. */
let fogAEmballer=false;
/* v0.985 : la vue suit le socle qu'on glisse — le brouillard, les portes et leurs ronds se refont pendant le geste, quelques
   fois par seconde ; la mémoire ne s'emballe et ne s'enregistre qu'au relâchement. */
let fogEnGeste=false,vueGesteT=0;
let vueGesteDuree=0;
// Le pas se règle sur le coût : une mise à jour qui a pris 20 ms attend 80 ms avant la suivante ; la main garde la priorité.
function vueEnGeste(){const t=performance.now();if(t-vueGesteT<Math.max(40,vueGesteDuree*4))return;vueGesteT=t;fogEnGeste=true;
 try{computeFog();renderFog();if(typeof renderPortes==='function')renderPortes()}finally{fogEnGeste=false;fogKey='';vueGesteDuree=performance.now()-t}}
function emballeFog(){if(fogEnGeste||!fogAEmballer)return;fogAEmballer=false;const m=currentMap();
 if(!m||!fogSeen||!fogDim)return;
 m.fog=fogSeenSrc=packMask(fogSeen,fogDim.n);delete m.seen;scheduleSave();garderBrouillardJoueur()}
/* Chez un joueur en ligne, rien ne s'enregistre : sa mémoire d'exploration se garde donc à part, sur l'appareil, par table et par
   carte, avec le numéro de la dernière remise à zéro. Rechargée, la page la retrouve ; une remise à zéro survenue depuis l'efface. */
const BROUILLARD_CLE='amertume-brouillard';let brouillardGardeTimer=0;
function brouillardJoueurPret(){return typeof spectateur==='function'&&spectateur()&&typeof tableId!=='undefined'&&!!tableId&&typeof brouillardConnu!=='undefined'&&brouillardConnu}
function garderBrouillardJoueur(){if(typeof pousserBrouillard==='function')pousserBrouillard();if(brouillardGardeTimer||!brouillardJoueurPret())return;
 brouillardGardeTimer=setTimeout(()=>{brouillardGardeTimer=0;const m=currentMap();if(!m||typeof m.fog!=='string'||!brouillardJoueurPret())return;
  try{const t=JSON.parse(localStorage.getItem(BROUILLARD_CLE)||'{}'),k=tableId+'|'+m.id;delete t[k];t[k]={n:brouillardReset.n,f:m.fog};
   const cles=Object.keys(t);cles.slice(0,Math.max(0,cles.length-6)).forEach(c=>delete t[c]);localStorage.setItem(BROUILLARD_CLE,JSON.stringify(t))}catch(e){}},1000)}
/* L'exploration gardée par la table — celle du MJ, qui voit par toute la troupe — s'ajoute à celle de la page : un joueur qui
   recharge, ou qui arrive en cours de partie, retrouve tout ce que la troupe a exploré. */
function ajouteBrouillard(m,f){if(!m||typeof f!=='string')return;const d=fogDims(m);if(f.length!==maskChars(d.n))return;const g=unpackMask(f,d.n);
 const ici=currentMap()===m&&fogSeen&&fogSeen.length===d.n?fogSeen:readSeen(m,d);let plus=0;for(let k=0;k<d.n;k++)if(g[k]&&!ici[k]){ici[k]=1;plus++}
 if(!plus)return;if(ici===fogSeen){fogDirty=true;fogAEmballer=true;fogKey='';fogMemorise=new WeakMap()}else{m.fog=packMask(ici,d.n);delete m.seen}
 if(typeof render==='function')render()}
function brouillardRetrouve(m,d){if(!brouillardJoueurPret())return;let e=null;
 try{e=JSON.parse(localStorage.getItem(BROUILLARD_CLE)||'{}')[tableId+'|'+m.id]}catch(x){}
 if(!e||e.n!==brouillardReset.n||typeof e.f!=='string'||e.f.length!==maskChars(d.n))return;
 const g=unpackMask(e.f,d.n);let plus=0;for(let k=0;k<d.n;k++)if(g[k]&&!fogSeen[k]){fogSeen[k]=1;plus++}
 if(plus){fogDirty=true;fogAEmballer=true}}
function computeFog(){const m=currentMap();
 if(!m){fogVis=null;fogTroupe=null;fogSeen=null;fogKey='';fogDim=null;return}
 const d=fogDim=fogDims(m);
 if(!fogSeen||fogSeen.length!==d.n||m.fog!==fogSeenSrc){fogSeen=readSeen(m,d);fogSeenSrc=m.fog;fogDirty=true;fogMemorise=new WeakMap();brouillardRetrouve(m,d)}
 const formes=obstaclesVue(),troupe=fogParty();
 // Le calcul ne reprend que si la scène a bougé : héros, portes, zones ou point de vue.
 const obscur=carteObscure(),M=obscur?masqueEclaire():null;
 const cle=m.id+'|'+d.n+'|'+view+'|'+owner+'|'+troupe.map(a=>a.x.toFixed(2)+','+a.y.toFixed(2)+(obscur||blinded(a)?'/'+Math.round(rayonVision(a)):'')).join(';')
  +'|'+geometryKey(m)+(M?'|'+M.cle:'');
 if(cle===fogKey&&fogVis){emballeFog();return}
 fogKey=cle;fogCalcul++;
 /* Le polygone de vision ne dépend que d'une position et de la géométrie : on le garde par
    position tant que la géométrie ne bouge pas. Quand un seul aventurier se déplace, les
    autres — et le maître du jeu voit par tous — ne coûtent plus rien. */
 const geo=m.id+'|'+geometryKey(m);
 if(visionCache.cle!==geo)visionCache={cle:geo,vues:new Map()};
 const vues=visionCache.vues,vu=a=>{const k=a.x+','+a.y;
  if(!vues.has(k)){if(vues.size>=48)vues.clear();vues.set(k,visionPolygon(a,formes))}return vues.get(k)};
 // La mémoire retient ce que la troupe entière a vu, où que soit le lecteur.
 /* Dans le noir, la mémoire ne retient que les cases éclairées : ce que l'aventurier n'a vu qu'au contact, ou par sa vision
    dans le noir, s'y referme derrière lui. L'aveugle n'en retient que sa zone de contact. Ce qu'il a mémorisé vaut tant que
    ni la lumière ni son rayon ne changent. */
 let neuf=0;const size=mapSize();for(const a of (fogEnGeste?[]:troupe)){const p=vu(a),r=obscur||blinded(a)?rayonVision(a):Infinity;
  const cleM=(M?M.cle:'')+'|'+Math.round(r)+(blinded(a)?'b':'');
  if(fogMemorise.get(p)===cleM)continue;fogMemorise.set(p,cleM);
  if(!Number.isFinite(r)&&!M){neuf+=fillPolygonGrid(fogSeen,d.w,d.h,p);continue}
  const ax=a.x/100*size.width,ay=a.y/100*size.height,r2=r*r,aveugle=blinded(a);
  neuf+=fillPolygonGridSi(fogSeen,d.w,d.h,p,(i,j)=>{if(M&&M.data[j*d.w+i]!==1)return false;if(!aveugle)return true;
   const dx=(i+.5)/d.w*size.width-ax,dy=(j+.5)/d.h*size.height-ay;return dx*dx+dy*dy<=r2})}
 fogVis=fogSeers().map(vu);fogVisQui=fogSeers();fogTroupe=troupe.map(vu);fogTroupeQui=troupe;
 if(neuf){fogDirty=true;fogAEmballer=true}
 emballeFog()}
// Le champ de vision en pixels : le socle est un disque, pas un point.
let fogPx=null,fogPxKey='';
/* La clé porte la largeur et la hauteur du cadre : au chargement, le cadre prend la
   taille de la carte après le premier calcul, et un polygone mis à l'échelle de l'ancien
   cadre disait la troupe aveugle jusqu'au premier pas — d'où des socles voilés et des
   adversaires non révélés sous les yeux mêmes d'un aventurier. */
// v1.040 : le numéro du calcul aussi — pendant un geste, la clé de la vue est remise à vide, et l'ancienne vue restait lue.
function cleCadre(size){return fogKey+'|'+fogCalcul+'|'+Math.round(size.width)+'x'+Math.round(size.height)}
function visionInPixels(){const size=mapSize(),k=cleCadre(size);
 if(fogPxKey!==k){fogPxKey=k;
  fogPx=(fogVis||[]).map(p=>p.map(([x,y])=>[x/100*size.width,y/100*size.height]))}
 return fogPx}
// Un adversaire hors du champ n'existe pas pour celui qui regarde. Mais il suffit
// qu'un bout de son socle morde sur la zone éclairée pour qu'il se montre.
/* v1.033 — Un point que la troupe voit à l'instant : dans la vue d'un aventurier, et dans sa lumière si la carte est obscure. */
function centreVuTroupe(x,y){const m=currentMap();if(!fogVis||!m||m.fogOff)return true;const size=mapSize();if(!size.width)return true;
 const c=[x/100*size.width,y/100*size.height],yeux=fogVisQui||[];return visionInPixels().some((p,k)=>polyTouchesDisc(p,c,1)&&(!yeux[k]||voitSocle(yeux[k],{x,y,socle:'medium'})))}
function partySees(a){const m=currentMap();
 if(!fogVis||!m||m.fogOff)return true;
 const size=mapSize();if(!size.width)return true;
 const c=[a.x/100*size.width,a.y/100*size.height],r=tokenOf(a)/2,yeux=fogVisQui||[];
 return visionInPixels().some((p,k)=>polyTouchesDisc(p,c,r)&&(!yeux[k]||voitSocle(yeux[k],a)))}
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
 const c=[a.x/100*size.width,a.y/100*size.height],r=tokenOf(a)/2,yeux=fogTroupeQui||[];
 return fogTroupePx.some((p,k)=>polyTouchesDisc(p,c,r)&&(!yeux[k]||voitSocle(yeux[k],a)))}
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
 if(portesVues.cle!==cle){const formes=obstaclesVue();
  portesVues={cle,vues:new WeakMap(),formes,idx:indexMurs(formes),
   yeux:fogSeers().map(a=>({x:a.x,y:a.y,exclues:formesAutour(a,formes),qui:a}))}}
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
  // Dans le noir, la porte doit aussi être éclairée, ou dans le rayon de cet œil.
  if(!voitPoint(o.qui,x,y))return false;
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
  c.putImageData(img,0,0);fogDirty=false;fogMemTick++}
 return fogMem}
/* Au chargement, l'image de la carte paraissait avant que le brouillard ne la couvre :
   un instant, et toute l'aventure était lue. Un voile opaque couvre la carte tant que le
   brouillard de la carte ouverte n'a pas été peint ; sans carte ou voile levé, il s'ôte. */
const voileAttente=document.createElement('div');voileAttente.id='voile-attente';$('map').append(voileAttente);
let cartePeinte=null;
function cleVoile(){const m=currentMap();return m?m.id+'|'+(m.fogOff?1:0):''}
// Peint, ou rien à peindre : le voile s'ôte. Brouillard pas encore calculé, cadre sans largeur : il reste.
function leverVoile(){const m=currentMap(),cv=$('fog');
 // v1.080 : la taille du cadre mesurée au début du rendu, s'il y en a une — la toile le couvre exactement.
 const w=cadreFige&&cadreFige.cw?cadreFige.cw:cv.clientWidth,h=cadreFige&&cadreFige.ch?cadreFige.ch:cv.clientHeight;
 const peint=!m||m.fogOff||(fogVis&&fogDim&&w>0&&h>0);
 if(!peint)return;cartePeinte=cleVoile();voileAttente.hidden=true}
let vueTroupe=false;
function oeilJoueur(){return view!=='mj'||vueTroupe}
let memFloue=null;
function renderFog(){const cv=$('fog'),m=currentMap(),d=fogDim;
 // Voile levé par le MJ : plus rien ne masque la carte, pour personne.
 if(!m||!fogVis||!d||m.fogOff){cv.style.display='none';return}
 cv.style.display='';
 // v1.080 : la toile couvre exactement le cadre ; mesuré au début du rendu (cadreFige), il ne se relit pas en plein milieu.
 const large=cadreFige&&cadreFige.cw?cadreFige.cw:cv.clientWidth,haut=cadreFige&&cadreFige.ch?cadreFige.ch:cv.clientHeight;if(!large||!haut)return;
 // Toile à la résolution de l'écran : le bord du polygone est tracé au pixel près.
 const ech=Math.min(2,window.devicePixelRatio||1);
 /* La toile suivait la seule taille du cadre, et le zoom l'agrandissait ensuite : à deux
    cents pour cent, chaque pixel de toile en couvrait deux à l'écran, et le bord du champ
    de vision — pourtant tracé d'un trait exact — montait en marches d'escalier. Elle suit
    donc le zoom, jusqu'à un plafond de pixels : au-delà, le prix de la repeinte ne vaut
    plus la finesse gagnée. */
 const zoom=Math.max(1,typeof mapZoom==='number'&&mapZoom>0?mapZoom:1);
 const W=Math.max(1,Math.min(4096,Math.round(large*ech*zoom))),H=Math.max(1,Math.round(W*haut/large));
 /* v1.159 : pendant le glissement d'un socle, la toile se peint à demi-résolution, comme le noir ; tout se trace aux mêmes
    coordonnées, à l'échelle ; au lâcher, le rendu la repeint nette. */
 const red=window.socleEnMain?.5:1,CW=Math.max(1,Math.round(W*red)),CH=Math.max(1,Math.round(H*red));
 if(cv.width!==CW||cv.height!==CH){cv.width=CW;cv.height=CH}
 const ctx=cv.getContext('2d');
 /* Rien ne se repeint tant que rien n'a bougé : ni le calcul du brouillard, ni la mémoire, ni le cadre, ni le noir. Chaque
    rendu de la table repeignait la toile entière, flou de la mémoire compris. */
 const mem=memoryCanvas(d);
 const peinte=[m.id,fogCalcul,fogMemTick,W,H,red,view,owner,oeilJoueur()].join('|');
 if(cv._peinte===peinte)return;cv._peinte=peinte;
 // Le MJ garde une vue lisible ; le joueur ne voit rien de l'inexploré.
 const inconnu=oeilJoueur()?255:110,memoire=oeilJoueur()?150:40;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 ctx.clearRect(0,0,CW,CH);ctx.setTransform(red,0,0,red,0,0);
 ctx.fillStyle='rgba(6,9,11,'+(inconnu/255).toFixed(3)+')';ctx.fillRect(0,0,W,H);
 ctx.globalCompositeOperation='destination-out';
 /* La mémoire est une grille de bits ; agrandie telle quelle jusqu'à l'écran, sa
    frontière montait en escalier — d'autant plus visible que la carte est zoomée. On
    l'interpole donc, et on la fond sur un peu moins d'une case : le bord de l'exploré
    devient un dégradé, ce qu'il est en vérité. Le champ vu, lui, reste un polygone
    tracé au trait, et ne doit rien à ce lissage. */
 if(mem){ctx.globalAlpha=1-memoire/inconnu;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  /* v0.987 : la mémoire floutée se garde sur sa propre toile, tant qu'elle ne change pas : pendant le glisser d'un socle, seul
     le champ vu se repeint, et le flou — le plus cher, sur une toile de plusieurs milliers de pixels — ne se refait plus. */
  const cleFlou=fogMemTick+'|'+W+'x'+H+'|'+d.w;
  if(!memFloue||memFloue._cle!==cleFlou){if(!memFloue)memFloue=document.createElement('canvas');if(memFloue.width!==W||memFloue.height!==H){memFloue.width=W;memFloue.height=H}
   const mc=memFloue.getContext('2d');mc.clearRect(0,0,W,H);mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';
   dessineFloute(mc,mem,0,0,W,H,Math.max(1,W/d.w*.7),[0,0,0]);memFloue._cle=cleFlou}
  if(red<1)ctx.drawImage(reduiteNuit(memFloue,CW,CH,memFloue._cle),0,0,W,H);else ctx.drawImage(memFloue,0,0)}
 ctx.globalAlpha=1;ctx.fillStyle='#000';
 const trace=(c,poly)=>{c.beginPath();c.moveTo(poly[0][0]/100*W,poly[0][1]/100*H);
  for(let i=1;i<poly.length;i++)c.lineTo(poly[i][0]/100*W,poly[i][1]/100*H);c.closePath()};
 /* Le brouillard de vue ne sait rien du noir : chacun découvre tout son champ ; l'aveugle, sa seule zone de contact. Le noir
    se peint ensuite, à part. */
 const size=mapSize(),k=size.width?W/size.width:1;
 fogVis.forEach((poly,n)=>{if(!poly||poly.length<3)return;const o=(fogVisQui||[])[n];
  if(!o||!blinded(o)){trace(ctx,poly);ctx.fill();return}
  ctx.save();trace(ctx,poly);ctx.clip();ctx.beginPath();ctx.arc(o.x/100*W,o.y/100*H,rayonVision(o)*k,0,Math.PI*2);ctx.fill();ctx.restore()});
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
 ctx.globalCompositeOperation='source-over';ctx.setTransform(1,0,0,1,0,0);
 // Le noir se peint à part, sur sa toile (renderNuit).
}
/* Chaque remise à zéro du brouillard se compte : le numéro voyage par la table, et les
   joueurs rejouent la même remise à zéro, en silence. */
let brouillardReset={n:0,tout:false};
function resetFog(tout,silencieux){const m=currentMap();if(!m)return;
 const d=fogDims(m),g=new Uint8Array(d.n);if(tout)g.fill(1);
 m.fog=packMask(g,d.n);delete m.seen;m.fogOff=false;fogSeen=g;fogSeenSrc=m.fog;fogDirty=true;fogKey='';fogMemorise=new WeakMap();
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
// Rend vrai quand le cadre a changé de taille.
function applyMapRatio(){const m=currentMap(),el=$('map');
 if(!m||!m.ratio){const avait=!!(el.style.width||el.style.height);el.style.width='';el.style.height='';return avait}
 const dispo=el.parentElement.clientWidth||el.clientWidth||600,hMax=Math.max(260,hauteurDispoCarte(el));
 let w=dispo,h=w/m.ratio;if(h>hMax){h=hMax;w=h*m.ratio}
 const W=Math.round(w)+'px',H=Math.round(h)+'px',change=el.style.width!==W||el.style.height!==H;el.style.width=W;el.style.height=H;return change}
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
let ratioDuRendu=false;
function renderMapLayer(){const svg=$('map-shapes'),portes=$('map-doors'),m=currentMap();
 // La rangée des Actions a pu changer de hauteur : le cadre se recale, et se remesure s'il a bougé.
 svg.replaceChildren();portes.replaceChildren();if(!ratioDuRendu&&applyMapRatio()&&cadreFige)cadreFige=mesureCadre();renderFog();renderNuit();renderZones();leverVoile();refreshGmBar();
 // .hidden n'existe pas sur un élément SVG : le masquage passe par une classe.
 $('map').classList.toggle('has-map',!!m);if(!m)return;
 if(m.start&&view==='mj')svg.append(svgRect(m.start,'startzone'));
 const formes=mapShapes(m);
 // Un passage secret clos ne perce plus la matière : le mur se peint plein pour tout le
 // monde, MJ compris, et c'est le trait violet — lui seul — qui le lui signale.
 if(formes.murs.contours.length)svg.append(svgMatiere([formes.murs.contours],null,'wall-group'));
 renderPortes();renderCoffres();renderPieges();renderObjets();renderLumieres()}
/* ---------- Les objets à la table ----------
   Un objet visible est un socle comme un autre, doré, que chacun peut ouvrir : on y lit
   la description, et un aventurier au contact y prend ce qui s'y trouve. Caché, seul le
   MJ le voit — en pointillé — jusqu'à ce qu'un test le découvre. Le brouillard ne le
   cache pas : c'est la description qui dit s'il est dans un recoin. */
/* En combat, les objets s'effacent de la carte, pour tous : ils reviennent en exploration. Ils ne
   coupent jamais la vue. */
function renderObjets(){const vue=$('map-view'),m=currentMap();
 vue.querySelectorAll('.token.objet').forEach(t=>t.remove());if(!m||enCombat())return;
 (m.objets||[]).forEach((o,i)=>{if(o.pris||(!objetVu(o)&&view!=='mj'))return;
  // Pour la troupe, un objet dans le noir n'existe pas : il faut le voir, ou l'avoir vu.
  // v1.033 : son centre même — un bord de socle qui frôle la vue, derrière un mur, ne suffit plus.
  // v1.042 : dans le champ de vision de la troupe, à l'instant — une zone seulement explorée ne le montre plus.
  const vuTroupe=centreVuTroupe(o.x,o.y);
  if(oeilJoueur()&&!vuTroupe)return;
  /* Chez le MJ, un objet se voile comme un adversaire : caché par lui, pâli et cerclé de violet ;
     dans une salle que la troupe n'a pas encore vue, pâli et cerclé de tirets. */
  const t=document.createElement('button');t.className='token objet'+(!objetVu(o)?' cachemj':!vuTroupe?' veiled':'');
  poseLogoObjet(t,o);
  /* v1.017 : un Indice découvert qui attend son test garde son icône ; le test se prend au-dessus de lui, sur le Bouton
     d'Interaction qui paraît au survol (indiceBouton). */
  t.dataset.objet=o.id||String(i);
  if(indiceATester(o))survolIndice(t,o);
  t.style.left=o.x+'%';t.style.top=o.y+'%';
  t.style.setProperty('--token',tokenPx()*(SOCLE_TAILLES[o.taille]||1)+'px');
  t.title=o.nom+(objetVu(o)?'':' · caché — '+skillNames[o.test.comp]+' × '+o.test.reussites);
  t.setAttribute('aria-label',t.title);
  /* Au survol, la bulle : la pièce qu'il contient, telle qu'à l'Armurerie, et sa description. Au
     clic, un aventurier au contact le récupère ; le MJ, lui, choisit : révéler, cacher, ou le
     donner à l'aventurier le plus proche. */
  if(typeof surveille==='function'&&!indiceATester(o))surveille(t,()=>ouvrirBulle(t,bulleObjetCarte(o),'bulle-gear'));
  t.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();
   // v1.017 : chez un joueur, un clic sur un Indice ne fait rien : son test se prend sur le bouton, au-dessus.
   if(o.indice&&view!=='mj')return;
   // v1.011 : le Coffre de Groupe s'ouvre sur la fenêtre commune ; le MJ l'ouvre pour l'aventurier actif au contact, sinon le plus proche.
   if(o.groupe===true&&typeof ouvrirCoffreGroupe==='function'){const a=heroActif();
    if(view==='mj'){const h=a&&objetAPortee(a,o)?a:heroLePlusProche(o);if(h)ouvrirCoffreGroupe(h,o);return}
    if(!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
    if(!objetAPortee(a,o)){log('Approche '+a.name+' : il faut être au contact de '+o.nom+'.',{local:true});return}
    ouvrirCoffreGroupe(a,o);return}
   if(view==='mj'){menuObjetMJ(o,e.clientX,e.clientY);return}
   const a=actors[selected],mien=!!(a&&a.hero&&controlled(selected)&&alive(a));
   if(!mien){log('Sélectionne d’abord ton aventurier.',{local:true});return}
   if(!objetAPortee(a,o)){log('Approche '+a.name+' : il faut être au contact de '+o.nom+'.',{local:true});return}
   if(o.indice){examinerIndice(a,o);return}
   if(o.ressource===true){recolterRessource(a,o);return}
   recupererObjet(a,o)};
  vue.append(t)})}
/* v0.998 — Examiner un Indice découvert, au contact : le test réglé par le MJ (sa compétence, ses réussites), ou l'objet
   qu'il faut porter. Réussi, son secret s'écrit au journal et se lit ensuite dans sa bulle. */
/* v1.039 — Le test d'un Indice ne se tente qu'une fois, pour toute la troupe : la table partagée le réserve (40 : tenté, 41 : percé),
   si bien que deux aventuriers qui cliquent ensemble n'en lancent qu'un. Raté, rien de plus : le secret reste caché, sauf si le
   MJ le révèle (« Révéler l'indice complet »). */
const rangIndice=o=>{const m=currentMap(),k=m?(m.objets||[]).indexOf(o):-1;return k<0?-1:rangsSol(m).n+k};
function perceIndice(o){const i=rangIndice(o);o.examine=true;delete o.tente;if(o.secret)log(o.secret,{ton:'reveal'});
 if(i>=0&&typeof reserveSurTable==='function'&&typeof enLigne!=='undefined'&&enLigne)reserveSurTable(arr=>{arr[i]=41;return arr});render();saveMaps();scheduleSave()}
function examinerIndice(a,o){const x=o.examen||{};if(!x.mode||o.examine||o.tente)return;
 if(x.mode==='objet'){const it=(catalog.items||[]).find(i=>i&&i.id===x.item);if(!it)return;
  if(!(a.inventaire||[]).includes(it.id)){log('Il faut ⟦'+it.id+'⟧.',{local:true});return}
  // v1.018 : une pièce consommable s'use à l'emploi.
  if(usageConsomme(usageObjet(it)))retirerInventaire(a,it);
  perceIndice(o);return}
 const i=rangIndice(o);
 prisSurTable(i<0?null:arr=>{if(arr[i]===40||arr[i]===41)return null;arr[i]=40;return arr},()=>{if(o.examine)return;o.tente=true;
  const k=Math.max(0,Math.min(7,Number(x.comp)||0)),n=Math.max(1,Number(x.reussites)||1),jet=skillRoll(valeurCompetence(a,k)-1,d6);
  if(typeof rollOnBoard==='function')rollOnBoard([{dice:jet.des.slice(0,40).map(v=>[v,0])}],a,null);
  log(nomNum(a)+' - ⟬t'+k+'|'+jet.reussites+'|'+jet.des.slice(0,40).join(',')+'⟭');
  if(jet.reussites>=n){perceIndice(o);return}render();saveMaps();scheduleSave()})}
function bulleObjetCarte(o){const d=document.createElement('div');d.className='bulle-objet-carte';
 const pieces=restantsObjet(o).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 const desc=()=>{if(!o.desc&&!o.tresor)return null;const p=document.createElement('p');p.className='objet-desc-bulle';p.textContent=[o.desc,o.tresor?'Trésor : '+o.tresor:''].filter(Boolean).join('\n');return p};
 // v1.035 : plusieurs exemplaires d'une même pièce, une seule bulle, leur nombre dans un rond en haut à droite.
 const parPiece=new Map();pieces.forEach(it=>parPiece.set(it,(parPiece.get(it)||0)+1));
 if(pieces.length)[...parPiece].forEach(([it,n],k)=>{const g=gearDetail(it,null,false);g.hidden=false;g.classList.add('large');
  if(n>1){const q=document.createElement('span');q.className='quantite-bulle';q.textContent=String(n);q.setAttribute('aria-label',n+' exemplaires');g.classList.add('avec-quantite');g.append(q)}
  if(!k){const p=desc();if(p)g.append(p)}d.append(g)});
 else{const g=document.createElement('div');g.className='gear-detail large';const n=document.createElement('p');n.className='gear-nom';n.textContent=o.nom||'Objet';g.append(n);const p=desc();if(p)g.append(p);d.append(g)}
 if(o.indice&&o.examine&&o.secret){const p=document.createElement('p');p.className='objet-desc-bulle';p.textContent=o.secret;(d.firstChild||d).append(p)}
 // v0.9994 : un second test reste à tenter : sa compétence, à sa couleur.
 if(o.indice&&objetVu(o)&&!o.examine&&!o.tente&&o.examen&&o.examen.mode==='comp'){const k=Math.max(0,Math.min(7,Number(o.examen.comp)||0)),p=document.createElement('p'),b=document.createElement('b');
  p.className='indice-examen-bulle';b.textContent=skillNames[k];if(SKILL_TINTS[k])b.style.color='rgb('+SKILL_TINTS[k]+')';const t=document.createElement('b');t.textContent='Test de ';p.append(t,b,' pour en découvrir davantage.');(d.firstChild||d).append(p)}
 if(view==='mj'&&!objetVu(o)){const c=document.createElement('p');c.className='muted objet-cache-bulle';c.textContent='Caché : '+skillNames[o.test.comp]+', '+o.test.reussites+' réussite'+(o.test.reussites>1?'s':'');(d.firstChild||d).append(c)}
 return d}
/* v1.012 — La Récolte d'une Ressource, au contact, hors combat : un test de la compétence réglée, plus les réussites que
   donnent les talents (Bonus de Récolte) pour ce type de ressource et cette compétence. N réussites donnent le premier
   palier ; N+1, le deuxième en plus ; N×2, le troisième en plus. Réussie ou non, la ressource quitte la carte pour
   toute la table : on ne la récolte qu'une fois. */
function bonusRecolte(a,o){const k=normaliseRecolte(o&&o.recolte).comp,type=String(o&&o.type||'').toLowerCase();
 return (typeof talentsCodes==='function'?talentsCodes(a):[]).filter(t=>t.code.cle==='bonusrecolte').reduce((s,t)=>{const p=t.params||{};
  if(p.ressource&&String(p.ressource).toLowerCase()!==type)return s;if(p.comp!==''&&p.comp!=null&&Number(p.comp)!==k)return s;return s+(Number(p.n)||0)},0)}
function recolterRessource(a,o){if(!a||!o||o.pris||o.ressource!==true||enCombat())return;const m=currentMap(),k=m?(m.objets||[]).indexOf(o):-1;
 prisSurTable(k<0?null:arr=>{const i=rangsSol(m).n+k;if(arr[i]===2)return null;arr[i]=2;return arr},()=>recolteFaite(a,o))}
function recolteFaite(a,o){if(!o||o.pris)return;const r=normaliseRecolte(o.recolte),k=r.comp,n=r.reussites;
 const jet=skillRoll(valeurCompetence(a,k)-1,d6),total=jet.reussites+bonusRecolte(a,o);
 if(typeof rollOnBoard==='function')rollOnBoard([{dice:jet.des.slice(0,40).map(v=>[v,0])}],a,null);
 log(nomNum(a)+' - ⟬t'+k+'|'+total+'|'+jet.des.slice(0,40).join(',')+'⟭');
 o.pris=true;const gains=new Map();
 [n,n+1,2*n].forEach((s,j)=>{if(total<s)return;r.paliers[j].forEach(x=>{const it=(catalog.items||[]).find(i=>i&&i.id===x.id);if(!it)return;
  const q=tireQuantite(x.q,d6);let mis=0;for(let c=0;c<q;c++){if(typeof ajouterInventaire!=='function'||!ajouterInventaire(a,it))break;mis++}if(typeof noteTrouve==='function')noteTrouve(a,it,mis);
  if(mis)gains.set(it.id,(gains.get(it.id)||0)+mis)})});
 if(gains.size)log(nomNum(a)+' récolte '+[...gains].map(([id,q])=>'⟦'+id+'⟧'+(q>1?' ×'+q:'')).join(' ')+'.',{ton:'butin'});
 render();saveMaps();scheduleSave()}
/* Récupérer un objet : ses pièces vont à l'inventaire de l'aventurier, son trésor à ses notes, et
   l'objet quitte la carte pour toute la table — jusqu'à ce que la carte soit rechargée. */
/* v1.033 — Plusieurs exemplaires d'une pièce sur un même objet : un clic n'en prend qu'un de chaque. « prisN » compte les
   prises déjà faites ; la dernière emporte l'objet. La table partagée retient ce compte (16 + prises), la course comprise. */
const toursObjet=o=>{const n=new Map();(o&&o.items||[]).forEach(id=>n.set(id,(n.get(id)||0)+1));return Math.max(1,...n.values())};
function restantsObjet(o){const r=Math.max(0,Math.trunc(Number(o&&o.prisN))||0),vus=new Map();
 return (o&&o.items||[]).filter(id=>{const k=(vus.get(id)||0)+1;vus.set(id,k);return k>r})}
function recupererObjet(a,o){if(!a||!o||o.pris||o.indice||o.groupe===true||o.ressource===true)return;const m=currentMap(),k=m?(m.objets||[]).indexOf(o):-1;
 let rang=null;
 prisSurTable(k<0?null:arr=>{const i=rangsSol(m).n+k,v=arr[i];if(v===2)return null;const r=Number.isInteger(v)&&v>16?v-16:0;rang=r;arr[i]=r+1>=toursObjet(o)?2:17+r;return arr},()=>recupereObjetFait(a,o,rang))}
function recupereObjetFait(a,o,rang){if(o&&o.indice)return;
 const r=Number.isInteger(rang)?rang:Math.max(0,Math.trunc(Number(o.prisN))||0),vus=new Map();
 const pieces=(o.items||[]).filter(id=>{const k=(vus.get(id)||0)+1;vus.set(id,k);return k===r+1}).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
 pieces.forEach(it=>{if(typeof ajouterInventaire==='function'){if(ajouterInventaire(a,it)!==false&&typeof noteTrouve==='function')noteTrouve(a,it)}else noteInventaire(a,it.name)});
 const tresor=r===0?o.tresor:'';if(tresor)noteInventaire(a,tresor);
 if(r+1>=toursObjet(o)){o.pris=true;delete o.prisN}else o.prisN=r+1;
 /* v1.041 — Prises répétées sur un même objet, l'une après l'autre : une seule ligne au journal, le nombre de chaque pièce
    qui grandit (l'icône, puis ×2, ×3…). */
 const nb=new Map();pieces.forEach(it=>nb.set(it.id,(nb.get(it.id)||0)+1));
 {const der=$('journal')&&$('journal').lastElementChild,r=der&&der._rec,pre=nomNum(a)+' récupère ';
  if(!tresor&&pieces.length&&r&&r.ton==='butin'&&typeof r.texte==='string'&&r.texte.startsWith(pre)&&r.texte.endsWith('.')&&der._objetSol===o.id){
   const avant=new Map(),reste=r.texte.slice(pre.length,-1).replace(/⟦([^⟧]{1,80})⟧(?: ×(\d+))?/g,(m,id,n)=>{avant.set(id,(avant.get(id)||0)+(Number(n)||1));return ''}).trim();
   if(!reste&&avant.size){avant.forEach((n,id)=>nb.set(id,(nb.get(id)||0)+n));der.remove()}}}
 log(nomNum(a)+' récupère '+(pieces.length?[...nb].map(([id,n])=>'⟦'+id+'⟧'+(n>1?' ×'+n:'')).join(' '):o.nom)+(tresor?' et '+tresor:'')+'.',{ton:'butin'});
 {const li=$('journal')&&$('journal').lastElementChild;if(li)li._objetSol=o.id}
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
 bouton(objetVu(o)?'Cacher à la troupe':'Révéler à la troupe',()=>{montreObjet(o,!objetVu(o));if(objetVu(o))floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');log(o.nom+(objetVu(o)?' est révélé.':' est caché.'),{ton:'carte'});render();saveMaps();scheduleSave()});
 // v0.9991 : un Indice ne se donne ni ne se ramasse : il reste où il est.
 const h=o.indice||o.groupe===true||o.ressource===true?null:heroLePlusProche(o);if(h)bouton('Donner à '+nomNum(h)+', le plus proche',()=>recupererObjet(h,o));
 // v1.039 : le MJ livre le secret d'un Indice, test raté ou pas tenté.
 if(o.indice&&o.secret&&!o.examine)bouton('Révéler l’indice complet',()=>{if(!objetVu(o))montreObjet(o,true);perceIndice(o)});
 // v1.012 : une Ressource, le MJ la fait récolter par l'aventurier actif au contact, sinon par le plus proche.
 if(o.ressource===true){const a=heroActif(),r=a&&objetAPortee(a,o)?a:heroLePlusProche(o);if(r)bouton('Récolte · '+nomNum(r),()=>recolterRessource(r,o))}
 document.body.append(m);const r=m.getBoundingClientRect();
 m.style.left=Math.max(6,Math.min(x+8,innerWidth-r.width-6))+'px';m.style.top=Math.max(6,Math.min(y+8,innerHeight-r.height-6))+'px';menuObjet=m;
 setTimeout(()=>{document.addEventListener('pointerdown',dehorsMenuObjet,true);document.addEventListener('keydown',echapMenuObjet,true)})}
/* Le jeton d'un objet porte l'icône de la première pièce qu'il contient — celle choisie en premier
   dans sa fiche ; sans pièce à icône, son initiale. */
function logoIndiceDefaut(){for(const pl of (typeof catalog!=='undefined'&&catalog.planches)||[]){const k=(pl&&pl.icones||[]).findIndex(ic=>ic&&String(ic.nom||'').trim()==='?');if(k>=0)return pl.fichier+'#'+(k+1)}return ''}
function poseLogoObjet(el,o){
 // v1.012 : une Ressource porte l'icône choisie dans sa fiche ; sans elle, celle de la première pièce qu'elle donne.
 if(o&&o.ressource===true){const prem=(((o.recolte||{}).paliers)||[]).flat().map(x=>(catalog.items||[]).find(it=>it&&it.id===x.id)).find(Boolean);
  const im=o.logo&&typeof logoAttaque==='function'?logoAttaque(o.logo,'logo-objet'):prem&&typeof logoEquipement==='function'?logoEquipement(prem):null;el.classList.add('ressource');
  if(im){im.classList.add('logo-objet');el.replaceChildren(im);el.classList.add('avec-logo')}else el.textContent=(o.nom||'?')[0].toUpperCase();return}
 // v1.011 : le Coffre de Groupe porte l'icône choisie dans sa fiche ; sans elle, un coffre dessiné.
 if(o&&o.groupe===true){const im=o.logo&&typeof logoAttaque==='function'?logoAttaque(o.logo,'logo-objet'):null;el.classList.add('coffre-groupe');
  el.classList.add('avec-logo');if(im){el.replaceChildren(im);return}
  el.innerHTML='<svg class="logo-objet coffre-dessin" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5V19h18v-8.5M3 10.5C3 7 5 5 8 5h8c3 0 5 2 5 5.5M3 10.5h18M10.5 10.5v3h3v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';return}
 // v0.998 : un Indice porte son icône, sinon celle des Indices réglée avec les actions spéciales, sinon une loupe.
 // v1.058 : sans icône choisie, un Indice prend l'icône nommée « ? » dans l'onglet Icônes ; à défaut, celle des Indices des actions spéciales.
 if(o&&o.indice){const l=o.logo||logoIndiceDefaut()||(typeof actionSpeciale==='function'?actionSpeciale('indice').logo:'')||'',im=l&&typeof logoAttaque==='function'?logoAttaque(l,'logo-objet'):null;
  el.classList.add('indice');if(im){el.replaceChildren(im);el.classList.add('avec-logo')}else el.textContent='🔍';return}
 let im=null,piece=null;const pieces=(o.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean);
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
/* Un aventurier peut fouiller tant qu'une part de son socle, même infime, déborde des zones déjà fouillées ; tout entier
   dedans, il n'a plus rien à y chercher. Le socle se découpe aux murs, comme l'aura. */
let socleFouilleCache={cle:'',dedans:false};
function zoneFouillee(a){const size=mapSize(),W=size.width,H=size.height;if(!a||!W||!H)return false;const U=unionFouilles();if(!U.length)return false;
 const cle=a.x+','+a.y+','+tokenOf(a)+'|'+fouillesCache.cle;if(socleFouilleCache.cle===cle)return socleFouilleCache.dedans;
 const D=auraPx(a.x,a.y,tokenOf(a)/2,W,H);let dedans=false;
 if(D)try{const tout=aireMulti(D);dedans=aireMulti(Clipper.difference(D,U))<=Math.max(1,tout*.002)}catch(e){dedans=false}
 socleFouilleCache={cle,dedans};return dedans}
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
 /* Les fouilles passent toujours sous les tokens : posées devant eux, leurs chiffres empêchaient d'attraper un aventurier
    qui se tenait dessous. Leur calque se range avant le premier token, au-dessus du brouillard et du noir. */
 {const t0=vue.querySelector(':scope > .token');if(t0&&(c.compareDocumentPosition(t0)&Node.DOCUMENT_POSITION_PRECEDING))t0.before(c)}
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
 if(typeof ajouterInventaire==='function'){if(ajouterInventaire(a,it)!==false&&typeof noteTrouve==='function')noteTrouve(a,it)}else noteInventaire(a,it.name);
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
 if(trouve){montreObjet(o,true);floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');render();saveMaps()}
 return trouve}
/* Un test de compétence lancé depuis la fiche cherche aussi, dans la zone de contact de
   l'aventurier : chaque objet caché qui s'y trouve — aucun mur entre eux —, découvert par cette
   compétence, la Perception d'ordinaire, et avec assez de réussites, paraît à toute la table. */
/* v0.9992 : « visible » est le choix de l'éditeur, que la Table ne touche jamais. Ce qu'elle révèle ou cache le MJ en partie
   tient dans « revele » (un objet caché paru) et « voile » (un objet visible caché d'autorité), effacés au chargement de la carte. */
const objetVu=o=>!!o&&(o.visible!==false?!o.voile:!!o.revele);
function montreObjet(o,v){if(o.visible!==false){if(v)delete o.voile;else o.voile=true}else if(v)o.revele=true;else delete o.revele}
function objetsDecouverts(a,comp,reussites,nouvelle){const m=currentMap();if(!a||!a.hero||!m)return [];
 // La Perception ne cherche que dans la part neuve de la fouille ; une autre compétence, dans tout le contact.
 const murs=walls(),atteint=o=>nouvelle?!wallsBetween(a,o,murs)&&dansFouilleNeuve(o,nouvelle):objetAPortee(a,o);
 // Fouiller révèle tout objet caché de sa zone, quelle que soit la compétence de son test ; un autre test, ceux de sa compétence.
 // v0.899 : Vision des profondeurs (Nain) — +1 réussite contre ce qui est caché dans la pierre.
 const pierre=x=>x&&x.pierre===true&&typeof porteEffet==='function'&&porteEffet(talentsCodes(a),'visionprofondeurs')?1:0;
 const trouves=(m.objets||[]).filter(o=>!objetVu(o)&&o.test&&(nouvelle||o.test.comp===comp)&&reussites+pierre(o)>=o.test.reussites&&atteint(o));
 trouves.forEach(o=>{montreObjet(o,true);floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');
  // v0.998 : un Indice trouvé s'annonce au milieu de l'écran.
  if(o.indice&&typeof annonceFlottante==='function')annonceFlottante('Indice Repéré !','annonce-indice')});
 /* La Perception trouve aussi les passages secrets et les coffres cachés que sa fouille neuve touche,
    avec assez de réussites : le passage devient une porte, le coffre paraît. */
 const noms=trouves.map(o=>o.indice?'⁅'+o.nom+'⁆':o.nom);
 if(comp===PERCEPTION&&nouvelle){
  (m.doors||[]).forEach(d=>{if(d.secret&&!d.open&&!d.decouvert&&reussites+pierre(d)>=(Number(d.perception)||1)&&formeDansFouille(d,nouvelle)){
   d.decouvert=true;floatNumber(centreForme(d),'Révélé !','nul');noms.push('un passage secret')}});
  (m.coffres||[]).forEach(c=>{if(c.cache&&!c.revele&&reussites+pierre(c)>=(Number(c.perception)||1)&&formeDansFouille(c,nouvelle)){
   c.revele=true;floatNumber(centreForme(c),'Révélé !','nul');noms.push(c.nom)}})}
 /* Les pièges cachés : leur test de détection, Perception ou Ruse, au choix du MJ. La Perception ne cherche que dans la part
    neuve de sa fouille ; la Ruse, au contact, et un échec y reste : on ne retente pas sur ce piège. */
 let piegeManque=false;
 if((comp===PERCEPTION&&nouvelle)||comp===RUSE)(m.pieges||[]).forEach(p=>{if(!p.cache||p.revele||p.rate||!p.detection||p.detection.comp!==comp)return;
  if(!(comp===PERCEPTION?formeDansFouille(p,nouvelle):piegeAPortee(a,p)))return;
  if(reussites>=p.detection.reussites){p.revele=true;floatNumber(centrePiege(p),'Révélé !','nul');noms.push(p.nom)}else if(comp===RUSE){p.rate=true;piegeManque=true}});
 // v0.9992 : la découverte d'abord, puis la phrase du MJ de chaque indice trouvé.
 if(noms.length){log(nomNum(a)+' découvre '+noms.join(', ')+' !',{ton:'carte'});trouves.forEach(o=>{if(o.indice&&o.journal)log(o.journal,{ton:'reveal'})});render();saveMaps();scheduleSave()}
 else if(piegeManque){saveMaps();scheduleSave()}
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
 if(pointsRestants(a,'action')<=0){floatNumber(a,'Action déjà dépensée','nul',true);log(nomNum(a)+' a déjà dépensé son Action ce tour.',{local:true});return false}
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
/* Le terrain impraticable, à la table : chez le MJ seul, en pointillés rouges, au-dessus du brouillard ; la troupe ne le voit
   jamais, elle s'y heurte. */
let impratVisible=(()=>{try{return localStorage.getItem('amertume-impraticables')!=='0'}catch(e){return true}})();
function renderImpraticables(){let svg=$('impraticables-mj');if(!svg){svg=document.createElementNS(nsSVG,'svg');svg.id='impraticables-mj';svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');$('fog').after(svg)}
 svg.replaceChildren();const m=currentMap();if(!m||view!=='mj'||!impratVisible||(typeof oeilJoueur==='function'&&oeilJoueur()))return;
 impraticableDe(m).forEach(p=>{const el=document.createElementNS(nsSVG,'path');
  el.setAttribute('d',p.anneaux.map(r=>'M'+r.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L')+'Z').join(''));el.setAttribute('class','imprat-mj');svg.append(el)})}
/* v1.014 : le terrain dangereux, à la table : visible de tous, à la couleur de son type, sous les socles. */
function renderDangers(){let svg=$('dangers-carte');if(!svg){svg=document.createElementNS(nsSVG,'svg');svg.id='dangers-carte';svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');$('fog').before(svg)}
 svg.replaceChildren();const m=currentMap();if(!m)return;
 dangersDe(m).forEach(t=>formesActives(m,t).forEach(p=>{const el=document.createElementNS(nsSVG,'path');el.setAttribute('d',p.anneaux.map(r=>'M'+r.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L')+'Z').join(''));
  el.setAttribute('class','danger-carte');el.style.color=t.couleur;svg.append(el)}))}
/* v0.896 : le terrain difficile, à la table : visible de tous, en hachures ocre, sous les socles. */
function renderDifficiles(){let svg=$('difficiles-carte');if(!svg){svg=document.createElementNS(nsSVG,'svg');svg.id='difficiles-carte';svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');$('fog').before(svg)}
 svg.replaceChildren();const m=currentMap();if(!m)return;const l=difficileDe(m);if(!l.length)return;
 const defs=document.createElementNS(nsSVG,'defs'),pat=document.createElementNS(nsSVG,'pattern');pat.id='hachures-difficile';pat.setAttribute('patternUnits','userSpaceOnUse');
 pat.setAttribute('width','1.2');pat.setAttribute('height','1.2');pat.setAttribute('patternTransform','rotate(45)');
 const ln=document.createElementNS(nsSVG,'line');ln.setAttribute('x1','0');ln.setAttribute('y1','0');ln.setAttribute('x2','0');ln.setAttribute('y2','1.2');ln.setAttribute('class','hachure');pat.append(ln);defs.append(pat);svg.append(defs);
 l.forEach(p=>{const el=document.createElementNS(nsSVG,'path');el.setAttribute('d',p.anneaux.map(r=>'M'+r.map(q=>q[0].toFixed(3)+' '+q[1].toFixed(3)).join('L')+'Z').join(''));el.setAttribute('class','diffi-carte');svg.append(el)})}
function renderCoffres(){renderImpraticables();renderDifficiles();renderDangers();const calque=$('map-coffres'),vue=$('map-view'),m=currentMap();calque.replaceChildren();vue.querySelectorAll('.coffre-alerte,.coffre-cadenas').forEach(x=>x.remove());majBoutonCoffres();
 /* Un coffre caché, pas encore trouvé, le MJ le voit toujours : un contour en pointillés, au-dessus du brouillard et du noir,
    qui couvraient jusqu'à le faire disparaître. */
 let caches=$('coffres-caches');if(!caches){caches=document.createElementNS(nsSVG,'svg');caches.id='coffres-caches';caches.setAttribute('viewBox','0 0 100 100');
  caches.setAttribute('preserveAspectRatio','none');caches.setAttribute('aria-hidden','true');$('fog').after(caches)}
 caches.replaceChildren();if(!m)return;
 const mj=view==='mj',oeil=typeof oeilJoueur==='function'&&oeilJoueur();
 (m.coffres||[]).forEach(c=>{const enVue=coffreEnVue(c);
  // La troupe ne voit un coffre que révélé et sous ses yeux ; le MJ voit tout, pâli hors de la vue de la troupe.
  if((!mj||oeil)&&(!coffreVisible(c)||!enVue))return;
  const cls='coffre'+(c.ouvert?' ouvert':'')+(coffreVisible(c)?'':' cache')+(enVue?'':' voile');
  let el;if(!c.rond)el=svgPorte(c,m.ratio,cls);
  else{el=document.createElementNS(nsSVG,'polygon');el.setAttribute('points',polyCoffre(c).map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));el.setAttribute('class',cls)}
  if(mj&&!oeil&&!coffreVisible(c)&&!c.ouvert){const o=document.createElementNS(nsSVG,'polygon');o.setAttribute('class','coffre-cache-mj');
   o.setAttribute('points',polyCoffre(c).map(q=>q[0].toFixed(3)+','+q[1].toFixed(3)).join(' '));caches.append(o)}
  // Piégé et encore armé : l'avertissement, chez le MJ seul.
  if(mj&&!oeil&&coffreArme(c)){const w=document.createElement('span');w.className='coffre-alerte';w.textContent='⚠';w.title='Piégé';
   w.style.left=(c.x+c.w/2)+'%';w.style.top=(c.y+c.h/2)+'%';vue.append(w)}
  /* Un joueur a trouvé le coffre verrouillé : un cadenas s'y pose, sous le brouillard — hors de la vue de la
     troupe, on ne le voit pas —, et s'en va quand le coffre s'ouvre. */
  if(c.tente&&coffreVerrouille(c)&&!c.ouvert){const k=document.createElement('span');k.className='coffre-cadenas';k.textContent='🔒';
   k.style.left=(c.x+c.w/2)+'%';k.style.top=(c.y+c.h/2)+'%';$('fog').before(k)}
  if(!c.ouvert||c.groupe===true){el.style.pointerEvents='all';
   // La bulle : son nom et sa description, au survol, quand l'aventurier choisi est au contact.
   if(typeof surveille==='function')surveille(el,()=>{if(mj?!bullesCoffresMJ:!coffreAPortee(heroActif(),c))return;ouvrirBulle(el,bulleCoffre(c),'bulle-gear')});
   // Un clic ne lui donne pas le focus : le navigateur l'entourait d'un anneau.
   el.onmousedown=e=>e.preventDefault();
   // Le MJ choisit dans un menu ; un joueur, lui, tente d'ouvrir, d'un clic.
   el.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();if(mj)menuCoffre(c,e.clientX,e.clientY);else ouvreCoffreJoueur(c)}}
  calque.append(el)})}
function bulleCoffre(c){const g=document.createElement('div');g.className='gear-detail large';
 const n=document.createElement('p');n.className='gear-nom';n.textContent=c.nom||'Coffre';g.append(n);
 // v1.034 : sa description dit ce qu'il contient — la troupe ne la lit qu'une fois le coffre ouvert ; le MJ, toujours.
 if(c.desc&&(c.ouvert||c.groupe===true||(view==='mj'&&!oeilJoueur()))){const p=document.createElement('p');p.className='objet-desc-bulle';p.textContent=c.desc;g.append(p)}
 // Ce qu'il contient, le MJ seul le voit : l'icône de chaque pièce et son nombre, l'or, les gemmes.
 if(view==='mj'){const comptes=new Map();(c.items||[]).forEach(id=>{const o=objetDe(id);if(o)comptes.set(o,(comptes.get(o)||0)+1)});const r=c.richesses||{};
  const l=document.createElement('div');l.className='coffre-contenu-bulle';comptes.forEach((n,o)=>l.append(carreInventaire(o,n)));
  if(r.or>0)l.append(ligneOr(r.or,null));const gem=ligneGemmes(r,null);if(gem)l.append(gem);const des=ligneBourse(c.bourse);if(des)l.append(des);if(l.childElementCount)g.append(l)}
 if(view==='mj'){const p=document.createElement('p');p.className='muted objet-cache-bulle';
  p.textContent=[c.cache&&!c.revele?'Caché : Perception '+(c.perception||1):'',coffreVerrouille(c)?'Verrou '+c.verrou+(c.cleId?' ou '+nomCle(c.cleId):'')+(c.code?' ou « '+c.code+' »':''):'',coffreArme(c)?'Piège '+c.piege:''].filter(Boolean).join(' · ');if(p.textContent)g.append(p)}
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
 // v1.009 : le Coffre de Groupe s'ouvre sur la fenêtre commune ; le MJ l'ouvre pour l'aventurier actif au contact, sinon le plus proche.
 if(c.groupe===true&&typeof ouvrirCoffreGroupe==='function'){const h=proche?a:mj?heroLePlusProche(centreForme(c)):null;if(h)ouvrirCoffreGroupe(h,c);return}
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
/* Crocheter : un test de Ruse sur chaque serrure à portée de l'aventurier — un coffre verrouillé qu'il touche, une porte
   verrouillée qu'il atteint. Assez de réussites : le coffre se déverrouille, la porte aussi, et s'ouvre. Hors combat, on retente. */
const difficultePorte=d=>Math.max(1,Math.min(9,Math.trunc(Number(d&&d.crochetage))||1));
function serruresAPortee(a){const m=currentMap(),size=mapSize();if(!a||!m||!size.width)return [];
 const coffres=(m.coffres||[]).filter(c=>c&&!c.ouvert&&coffreVisible(c)&&coffreVerrouille(c)&&coffreAPortee(a,c)).map(c=>({c,n:c.verrou}));
 const portes=(m.doors||[]).filter(d=>d&&d.keyLocked&&!d.crochetee&&!d.open&&(!d.secret||d.decouvert)&&doorSeen(d)&&polyInReach(a,doorPolygon(d,m.ratio),size,tokenPx())).map(d=>({d,n:difficultePorte(d)}));
 return [...coffres,...portes]}
function crocheter(a){const l=serruresAPortee(a);if(!a||!l.length)return;
 const jet=skillRoll(valeurCompetence(a,RUSE)-1,d6),n=jet.reussites+(typeof bonusBricoleur==='function'?bonusBricoleur(a):0);rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),a,null);
 const faits=[];l.forEach(s=>{if(n<s.n)return;
  if(s.c){s.c.deverrouille=true;floatNumber(centreForme(s.c),'Déverrouillé','nul');faits.push(s.c.nom||'le coffre')}
  else{s.d.crochetee=true;s.d.open=true;faits.push('la porte')}});
 log(nomNum(a)+' · Ruse : '+n+' réussite'+(n>1?'s':'')+' ⦃'+jet.des.join(',')+'⦄ — '+(faits.length?'crochète '+faits.join(', '):'la serrure résiste')+'.',{dice:true,ton:'competence'});
 render();saveMaps();scheduleSave()}
/* Déverrouiller ou chercher un piège : un test de Ruse ou de Technique, assez de réussites. Quand le
   verrou et le piège demandent autant de réussites, réussir l'un vient à bout de l'autre ; sinon,
   chacun le sien. Un piège trouvé est désamorcé. */
function testCoffre(a,c,quoi,k){if(!a||!c||c.ouvert||!payeAction(a))return;
 const jet=skillRoll(valeurCompetence(a,k)-1,d6),n=jet.reussites+(typeof bonusReussites==='function'?bonusReussites(a,k):0)+(typeof bonusBricoleur==='function'?bonusBricoleur(a):0);rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),a,null);
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
/* v1.053 — Un coffre verrouillé à code ou à mot de passe : qui le tente le saisit. Des chiffres : une case par chiffre ; un mot de
   passe : une ligne, comparée sans la casse ni les pluriels. Juste, le coffre se déverrouille et s'ouvre ; faux, il reste clos. */
const estCodeChiffres=v=>/^\d+$/.test(String(v||''));
const motNormal=v=>String(v||'').normalize('NFC').toLowerCase().trim().split(/\s+/).filter(Boolean).map(w=>w.length>2?w.replace(/[sx]$/,''):w).join(' ');
const codeJuste=(c,v)=>estCodeChiffres(c.code)?String(v||'')===String(c.code):motNormal(v)===motNormal(c.code);
let codeDialog=null;
function saisieCode(a,c){if(!codeDialog){codeDialog=dialog('code-coffre','Code','<form id="code-form"><div id="code-champs"></div><div class="form-actions"><button class="primary">Ouvrir</button></div></form>')}
 const chiffres=estCodeChiffres(c.code),champs=$('code-champs');codeDialog.querySelector('h2').textContent=chiffres?'Code':'Mot de passe';champs.replaceChildren();
 if(chiffres){const l=document.createElement('div');l.className='code-cases';
  for(let i=0;i<String(c.code).length;i++){const e=document.createElement('input');e.type='text';e.inputMode='numeric';e.maxLength=1;e.autocomplete='off';e.setAttribute('aria-label','Chiffre '+(i+1));
   e.oninput=()=>{e.value=e.value.replace(/\D/g,'').slice(-1);if(e.value&&e.nextElementSibling)e.nextElementSibling.focus()};
   e.onkeydown=ev=>{if(ev.key==='Backspace'&&!e.value&&e.previousElementSibling){e.previousElementSibling.focus()}};l.append(e)}
  champs.append(l)}
 else{const e=document.createElement('input');e.type='text';e.name='mot';e.autocomplete='off';e.maxLength=40;e.className='code-mot';e.setAttribute('aria-label','Mot de passe');champs.append(e)}
 $('code-form').onsubmit=ev=>{ev.preventDefault();const v=chiffres?[...champs.querySelectorAll('.code-cases input')].map(x=>x.value).join(''):champs.querySelector('.code-mot').value;
  codeDialog.close();if(!codeJuste(c,v)){c.tente=true;log(nomNum(a)+' tente d’ouvrir '+c.nom+' : '+(chiffres?'mauvais code':'mauvais mot de passe')+'.',{ton:'carte'});render();saveMaps();scheduleSave();return}
  c.deverrouille=true;log(nomNum(a)+' déverrouille '+c.nom+' '+(chiffres?'avec le code':'avec le mot de passe')+'.',{ton:'carte'});ouvrirCoffre(c,a,false)};
 codeDialog.showModal();const f=champs.querySelector('input');if(f)f.focus()}
function ouvreCoffreJoueur(c){const a=heroActif();
 if(!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
 if(!coffreAPortee(a,c)){log('Approche '+a.name+' : il faut être au contact de '+c.nom+'.',{local:true});return}
 // v1.011 : un coffre coché « Coffre de groupe » ouvre la fenêtre commune, chez le joueur aussi.
 if(c.groupe===true&&typeof ouvrirCoffreGroupe==='function'){ouvrirCoffreGroupe(a,c);return}
 if(coffreVerrouille(c)&&!aLaCle(a,c.cleId)&&c.code){saisieCode(a,c);return}
 if(coffreVerrouille(c)&&!aLaCle(a,c.cleId)){c.tente=true;log(nomNum(a)+' tente d’ouvrir '+c.nom+' : verrouillé.',{ton:'carte'});render();saveMaps();scheduleSave();return}
 if(enCombat()&&pointsRestants(a,'action')<=0){payeAction(a);return}
 if(coffreVerrouille(c)){c.deverrouille=true;log(nomNum(a)+' déverrouille '+c.nom+' avec '+nomCle(c.cleId)+'.',{ton:'carte'})}
 ouvrirCoffre(c,a,false)}
/* En combat, ouvrir coûte l'Action de qui ouvre, que le geste vienne de lui ou du MJ. */
function ouvrirCoffre(c,h,parMJ){if(!c||c.ouvert||(coffreVerrouille(c)&&!parMJ))return;
 // Sans Action en combat, le refus se dit, et rien ne se réserve.
 if(h&&enCombat()&&pointsRestants(h,'action')<=0){payeAction(h);return}
 const m=currentMap(),k=m?(m.coffres||[]).indexOf(c):-1;
 prisSurTable(k<0?null:arr=>{const i=rangsSol(m).n2+k,v=Number(arr[i])||0;if(v&8)return null;arr[i]=v|8|2;return arr},()=>ouvreCoffreFait(c,h))}
// v1.011 : « Ouvrir pour… » sur un Coffre de Groupe : la fenêtre commune, jamais le coffre ordinaire.
{const oc=ouvrirCoffre;ouvrirCoffre=function(c,h,parMJ){if(c&&c.groupe===true&&typeof ouvrirCoffreGroupe==='function'){if(h)ouvrirCoffreGroupe(h,c);return}return oc(c,h,parMJ)}}
/* v1.067 — Les crans d'un état cumulable, pour un coffre ou un piège : la case de l'état, et à côté sa quantité, « x » ou « xdy » ;
   lue à l'enregistrement, tirée quand le piège part. */
function casesEtatsCrans(o){return '<div class="coffre-etats">'+ETATS_JEU.map(e=>'<label class="field-check"><input type="checkbox" name="etat" value="'+esc(e)+'"'+((o.etats||[]).includes(e)?' checked':'')+'>'+esc(e)
 +(cumulable(e)?'<input name="crans" data-etat="'+esc(e)+'" class="etat-crans" value="'+esc(formuleDegats((o.crans||{})[e]||{degats:1}))+'" pattern="[0-9]{1,2}([dD][0-9]{1,3})?" maxlength="6" aria-label="Quantité de '+esc(e)+'">':'')+'</label>').join('')+'</div>'}
function montreCrans(boite){boite.querySelectorAll('.etat-crans').forEach(x=>{x.hidden=!x.closest('label').querySelector('input[name="etat"]').checked})}
function lisCrans(boite,o){const cr={};boite.querySelectorAll('.etat-crans').forEach(x=>{const e=x.dataset.etat,q=lisFormuleDegats(x.value);if(!(o.etats||[]).includes(e)||!q||(!q.degatsDes&&q.degats<=1))return;cr[e]=q});
 if(Object.keys(cr).length)o.crans=cr;else delete o.crans}
function tireCrans(o){const crans={};(o.etats||[]).forEach(e=>{if(cumulable(e)&&o.crans&&o.crans[e])crans[e]=Math.max(1,tireDegats(o.crans[e]).total)});return crans}
// Pose l'état et ses crans en plus ; rend « Poison 4 », ou rien s'il n'a pas pris.
function infligeCrans(a,e,crans){if(infligeEtat(a,e)!==true)return '';const k=(crans&&crans[e])||1;if(k>1)ajouteEtat(a,e,k-1);return e+(k>1?' '+k:'')}
function ouvreCoffreFait(c,h){if(h&&!payeAction(h))return;
 if(coffreArme(c)){c.desamorce=true;
  // Le piège part : une gerbe de feu sur le coffre, ici et sur chaque table.
  if(typeof explosionPiege==='function'){explosionPiege(centreForme(c));const m=currentMap();if(m&&typeof diffuserEffet==='function')diffuserEffet('piege',h,null,String((m.coffres||[]).indexOf(c)))}
  // Ses dégâts, fixes ou aux dés, se tirent une fois : la même gerbe frappe tous ceux qui sont là.
  const jet=tireDegats(c);
  // v1.066 : la quantité d'un état cumulable, fixe ou aux dés, se tire une fois aussi.
  const crans=tireCrans(c);
  const touches=actors.filter(o=>o&&o.hero&&alive(o)&&!o.horsCarte&&dansZoneCoffre(o,c)).map(o=>{const p=[];
   if(jet.total>0){const {perdu:n,blinde}=encaisse(o,jet.total,null);p.push(blinde?'Blindage consommé':n+' dégât'+(n>1?'s':''))}
   (c.etats||[]).forEach(e=>{const t=infligeCrans(o,e,crans);if(t)p.push(t)});return nomNum(o)+(p.length?' : '+p.join(', '):'')});
  log('Piège ! '+c.nom+' se déclenche'+(jet.jets.length?' ('+formuleDegats(c)+' : '+jet.jets.join(' + ')+')':'')+(touches.length?' — '+touches.join(' ; '):'')+'.',{ton:'degats'})}
 c.ouvert=true;c.deverrouille=true;
 const pieces=(c.items||[]).map(id=>(catalog.items||[]).find(x=>x&&x.id===id)).filter(Boolean),rich={...(c.richesses||{})},gains=[];
 Object.entries(tireBourse(c.bourse)).forEach(([k,v])=>{rich[k]=(Math.trunc(Number(rich[k]))||0)+v});
 if(h){const parPiece=new Map();pieces.forEach(it=>{if(typeof ajouterInventaire==='function'){if(ajouterInventaire(h,it)!==false&&typeof noteTrouve==='function')noteTrouve(h,it)}else noteInventaire(h,it.name);parPiece.set(it.id,(parPiece.get(it.id)||0)+1)});
  parPiece.forEach((n,id)=>gains.push((n>1?n+' × ':'')+'⟦'+id+'⟧'));
  if(rich.or>0)ajouteOr(h,rich.or);
  h.richesses={...(h.richesses||{})};CLES_GEMMES.forEach(k=>{const v=Math.trunc(Number(rich[k]))||0;if(v>0)h.richesses[k]=(Math.trunc(Number(h.richesses[k]))||0)+v});
  gains.push(...phraseRichesses(rich))}
 log((h?nomNum(h)+' ouvre '+c.nom:c.nom+' s’ouvre')+(gains.length?' : '+gains.join(', '):', vide')+'.',{ton:'butin'});
 if(h&&enCombat()&&typeof afterAction==='function')afterAction(h);
 render();saveMaps();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
/* ---------- Les pièges à la table (v0.615) ----------
   Un piège se voit comme un coffre, sous le brouillard : en jeton rond, ou en image seule. Caché, seul le MJ le voit, en
   pointillé, jusqu'à ce qu'un test de détection le révèle. Armé, il part au contact de sa forme ou de ses déclencheurs ;
   déclenché ou désamorcé, il reste là, grisé. */
const piegeArme=p=>!!p&&!p.declenche&&!p.desamorce,piegeConnu=p=>!!p&&(!p.cache||!!p.revele);
const centrePiege=p=>({x:p.x+p.w/2,y:p.y+p.h/2,socle:'medium'});
const nomCaracPiege=b=>b.carac==='comp'?(skillNames[Number(b.comp)]||'compétence'):((CARACS_EQUIP.find(([k])=>k===b.carac)||[])[1]||b.carac);
const phrasePerte=b=>'−'+b.valeur+' '+nomCaracPiege(b)+(b.duree==='repos'?' jusqu’au repos':'');
// Sa forme, en pour cent de carte : le rond de son jeton, ou le rectangle de son image.
function polyPiege(p){const m=currentMap();return coffrePolygon({...p,a:0,rond:p.affichage!=='image'},m&&m.ratio)}
// L'écart d'un point à un segment, en pixels : un fil se touche à moins d'un rayon de socle.
function ecartAuFil(c,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((c[0]-a[0])*dx+(c[1]-a[1])*dy)/l)):0;return Math.hypot(c[0]-a[0]-t*dx,c[1]-a[1]-t*dy)}
// Le disque d'un socle — centre et rayon, en pixels — touche-t-il le piège, sa forme s'il part au contact, ou un de ses déclencheurs ?
// Rend « contact » quand c'est sa forme, « distance » quand c'est un déclencheur.
/* La hitbox (« bloc ») d'un piège en est le corps, plus large que son icône : la toucher, c'est toucher le piège. */
const rectHitbox=d=>[[d.x,d.y],[d.x+d.w,d.y],[d.x+d.w,d.y+d.h],[d.x,d.y+d.h]];
function touchePiege(p,c,r,size){const px=q=>[q[0]/100*size.width,q[1]/100*size.height];
 if(p.contact!==false&&polyTouchesDisc(polyPiege(p).map(px),c,r))return 'contact';
 if((p.declencheurs||[]).some(d=>d.type==='bloc'&&polyTouchesDisc(rectHitbox(d).map(px),c,r)))return 'contact';
 return (p.declencheurs||[]).some(d=>d.type==='bloc'?false:d.type==='fil'?ecartAuFil(c,px([d.x1,d.y1]),px([d.x2,d.y2]))<=r
  :polyTouchesDisc([[d.x,d.y],[d.x+d.w,d.y],[d.x+d.w,d.y+d.h],[d.x,d.y+d.h]].map(px),c,r))?'distance':false}
/* L'écart, en pixels, d'un point au piège : à sa forme s'il part au contact, et à chacun de ses déclencheurs ; 0 dedans. Les
   formes se mesurent une fois : la fonction rendue sert à chaque échantillon d'un geste. */
function mesureEcartPiege(p,size){const px=q=>[q[0]/100*size.width,q[1]/100*size.height],polys=[],fils=[];
 if(p.contact!==false)polys.push(polyPiege(p).map(px));
 (p.declencheurs||[]).forEach(d=>{if(d.type==='fil')fils.push([px([d.x1,d.y1]),px([d.x2,d.y2])]);else polys.push([[d.x,d.y],[d.x+d.w,d.y],[d.x+d.w,d.y+d.h],[d.x,d.y+d.h]].map(px))});
 return c=>{let best=Infinity;
  for(const l of polys){if(pointInPolygon(c,l))return 0;for(let i=0;i<l.length;i++)best=Math.min(best,ecartAuFil(c,l[i],l[(i+1)%l.length]))}
  for(const [a,b] of fils)best=Math.min(best,ecartAuFil(c,a,b));
  return best}}
function ecartAuPiege(p,c,size){return mesureEcartPiege(p,size)(c)}
/* Le premier piège armé que le socle touche en allant de « de » jusqu'à sa place : lui, là où il le touche, en pour cent, et
   s'il le touche par sa forme. Ce qu'il touchait déjà au départ ne part pas ; un piège qu'il a su enjamber, plus jamais.
   Un piège que la troupe connaît, un aventurier n'y tombe pas sans le vouloir : il l'arrête comme un mur, au bord (« bloque »),
   tant qu'il ne l'a pas enjambé. Le socle n'y avance plus d'un pixel ; ce qui reste du pas le fait glisser le long du bord. */
function piegeAuPassage(o,de){const m=currentMap(),size=mapSize();
 if(!m||!(m.pieges||[]).length||!o||!de||!size.width||!alive(o)||o.horsCarte||o.orbeStatique)return null;
 const franchis=Array.isArray(o.franchis)?o.franchis:[],armes=m.pieges.filter(p=>piegeArme(p)&&!franchis.includes(p.id));if(!armes.length)return null;
 const r=tokenOf(o)/2,a=[de.x/100*size.width,de.y/100*size.height],b=[o.x/100*size.width,o.y/100*size.height];
 const connus=(o.hero===true&&!tenuParPiege(o)?armes.filter(piegeConnu):[]).map(p=>({p,ecart:mesureEcartPiege(p,size)}));
 const libres=armes.filter(p=>!connus.some(k=>k.p===p)&&!touchePiege(p,a,r,size));if(!libres.length&&!connus.length)return null;
 connus.forEach(k=>{k.d0=k.ecart(a)});
 // Bute : touché, et plus près qu'au départ du pas. Celui qui touchait déjà peut longer le piège ou s'en écarter, pas y entrer.
 const bute=(k,c)=>{const d=k.ecart(c);return d<r&&d<Math.min(k.d0,r)-.01};
 const pct=c=>({x:c[0]/size.width*100,y:c[1]/size.height*100});
 const n=Math.max(1,Math.min(400,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(1,r/3))));
 for(let i=1;i<=n;i++){const t=i/n,c=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],mur=connus.find(k=>bute(k,c));
  if(mur){const au=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];let lo=(i-1)/n,hi=t;
   for(let k=0;k<6;k++){const mi=(lo+hi)/2;if(bute(mur,au(mi)))hi=mi;else lo=mi}
   const q=au(lo);
   /* Le reste du pas, privé de ce qui va vers le piège : la pente de l'écart donne la direction du bord. */
   const e=1,gx=mur.ecart([q[0]+e,q[1]])-mur.ecart([q[0]-e,q[1]]),gy=mur.ecart([q[0],q[1]+e])-mur.ecart([q[0],q[1]-e]),gn=Math.hypot(gx,gy);
   let fin=q;
   if(gn>0){const nx=gx/gn,ny=gy/gn,vx=b[0]-q[0],vy=b[1]-q[1],dot=vx*nx+vy*ny;
    // Poussé de face, il s'arrête net : il ne glisse que pris de biais.
    if(dot<0&&Math.hypot(vx-dot*nx,vy-dot*ny)>=.3*Math.hypot(vx,vy)){const s=[q[0]+vx-dot*nx,q[1]+vy-dot*ny],kq={...mur,d0:mur.ecart(q)},bute2=c=>connus.some(k=>bute(k===mur?kq:k,c));
     const m2=Math.max(1,Math.ceil(Math.hypot(s[0]-q[0],s[1]-q[1])/Math.max(1,r/3)));let ok=1;
     for(let k=1;k<=m2;k++){const c=[q[0]+(s[0]-q[0])*k/m2,q[1]+(s[1]-q[1])*k/m2];if(bute2(c))break;ok=k}
     if(ok>=1&&!bute2([q[0]+(s[0]-q[0])*ok/m2,q[1]+(s[1]-q[1])*ok/m2]))fin=[q[0]+(s[0]-q[0])*ok/m2,q[1]+(s[1]-q[1])*ok/m2]}}
   // Le long du piège, jamais à travers un mur ni le terrain impraticable : la glissade qui en toucherait un n'a pas lieu.
   if(fin!==q&&typeof obstaclesDuPas==='function'){const murs=obstaclesDuPas((x,y)=>[x/100*size.width,y/100*size.height]);
    if(murs.length&&(segmentHitsPolys(q,fin,murs)||Math.hypot(...(([x,y])=>[x-fin[0],y-fin[1]])(slideOutOfWalls(fin,murs,r)))>.5))fin=q}
   return {p:mur.p,...pct(fin),bloque:true}}
  const p=libres.find(q=>touchePiege(q,c,r,size));
  if(p)return {p,...pct(c),contact:touchePiege(p,c,r,size)==='contact'}}
 return null}
/* Ce que coûte un piège en caractéristiques : un aventurier le porte à sa fiche, permanent ou jusqu'au repos ; une créature le
   perd pour de bon. Rend les mots du journal. */
function appliquePertes(o,lignes){const l=cleanPertes(lignes);if(!l.length)return [];
 if(o.hero){o.malusPieges=[...malusDe(o),...l];if(typeof recalculerPV==='function')recalculerPV(o)}
 else l.forEach(b=>{const v=b.valeur;
  if(b.carac==='pv'){o.max=Math.max(1,(Number(o.max)||1)-v);o.hp=Math.min(Number(o.hp)||0,o.max)}
  else if(b.carac==='def')o.def=Math.max(0,(Number(o.def)||0)-v);else if(b.carac==='dmg')o.dmg=Math.max(0,(Number(o.dmg)||0)-v);
  else if(b.carac==='comp'&&Array.isArray(o.skills)){const k=Number(b.comp)||0;o.skills[k]=Math.max(0,(Number(o.skills[k])||0)-v)}});
 return l.map(phrasePerte)}
/* Un piège part sur qui l'a touché : il se grise, sauf s'il est toujours actif ; révélé s'il était caché, et sa gerbe jaillit
   sur chaque table. Évitable, la victime tente son test d'abord ; puis les dégâts, les états et les pertes de caractéristique.
   Touché par sa forme, il happe sa victime : son socle va au centre du piège, à moins qu'elle ne l'esquive. */
function declenchePiege(p,o,contact){const m=currentMap();if(!m||!piegeArme(p)||!o)return;
 if(!p.actif)p.declenche=true;if(p.cache)p.revele=true;
 if(typeof explosionPiege==='function')explosionPiege(centrePiege(p));
 if(typeof diffuserEffet==='function')diffuserEffet('piegecarte',o,null,String(m.pieges.indexOf(p)));
 /* Le test d'évitement se joue d'abord, mais se dit après : le journal annonce le piège, puis la tentative. Sur la carte,
    « Piège ! » paraît, puis « Esquive ! », en vert, si la victime l'esquive. */
 let issue='plein',essai='';
 if(p.evitement){const t=p.evitement,jet=skillRoll(valeurCompetence(o,t.comp)-1,d6),n=jet.reussites+(typeof bonusReussites==='function'?bonusReussites(o,t.comp,true):0),ok=n>=t.reussites;
  rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),o,null);if(ok)issue=t.issue;
  essai=nomNum(o)+' · '+skillNames[t.comp]+' : '+n+' réussite'+(n>1?'s':'')+' ⦃'+jet.des.join(',')+'⦄ — '+(ok?(issue==='esquive'?'esquive le piège':'amortit le piège'):'ne l’évite pas')+'.'}
 const depuis=contact&&issue!=='esquive'?{x:o.x,y:o.y}:null;if(depuis){const c=centrePiege(p);o.avantPiege={x:depuis.x,y:depuis.y};o.x=c.x;o.y=c.y;if(p.actif||p.enjambement)o.tenuPar=p.id}
 floatNumber(o,'Piège !','perte');if(issue==='esquive')setTimeout(()=>floatNumber(o,'Esquive !','gain'),650);
 const parts=[];
 if(issue!=='esquive'){const jet=tireDegats(p),deg=issue==='moitie'?Math.floor(jet.total/2):jet.total;
  if(deg>0){const {perdu:n,blinde}=encaisse(o,deg,null);parts.push((blinde?'Blindage consommé':n+' dégât'+(n>1?'s':''))+(jet.jets.length?' ('+formuleDegats(p)+' : '+jet.jets.join(' + ')+')':''))}
  if(issue==='plein'){const crans=tireCrans(p),poses=[],etats=(p.etats||[]).filter(e=>{const t=infligeCrans(o,e,crans);if(t)poses.push(t);return !!t});parts.push(...poses);
   // Hors combat, ils survivront au combat que ce pas-là déclenche peut-être.
   if(etats.length&&!enCombat())o.etatsPieges=[...new Set([...(Array.isArray(o.etatsPieges)?o.etatsPieges:[]),...etats])];
   parts.push(...appliquePertes(o,p.caracs))}}
 log('Piège ! '+p.nom+' se déclenche sur '+nomNum(o)+(parts.length?' — '+parts.join(', '):'')+'.',{ton:'degats'});
 if(essai)log(essai,{dice:true,ton:'competence'});
 render();if(depuis)glisseAuPiege(o,depuis);saveMaps();scheduleSave()}
/* Où sortir d'un piège : la place d'où il a happé le socle ; sinon, autour de lui, le premier point libre — hors du piège et de
   sa hitbox, hors des murs —, en s'éloignant peu à peu. */
function sortieDuPiege(o,p){if(o.avantPiege&&Number.isFinite(o.avantPiege.x)&&Number.isFinite(o.avantPiege.y))return {x:o.avantPiege.x,y:o.avantPiege.y};
 const size=mapSize(),c=centrePiege(p);if(!size.width)return {x:o.x,y:o.y};
 const r=tokenOf(o)/2,murs=typeof obstaclesDuPas==='function'?obstaclesDuPas((x,y)=>[x/100*size.width,y/100*size.height]):[];
 for(let d=r;d<size.width;d+=r/2)for(let k=0;k<16;k++){const t=k/16*2*Math.PI,q=[c.x/100*size.width+Math.cos(t)*d,c.y/100*size.height+Math.sin(t)*d];
  if(q[0]<r||q[1]<r||q[0]>size.width-r||q[1]>size.height-r||touchePiege(p,q,r,size))continue;
  const s=murs.length?slideOutOfWalls(q,murs,r):q;if(Math.hypot(s[0]-q[0],s[1]-q[1])>.5)continue;
  return {x:q[0]/size.width*100,y:q[1]/size.height*100}}
 return {x:o.x,y:o.y}}
// Le socle happé glisse jusqu'au centre du piège, du point où il l'a touché.
function glisseAuPiege(o,depuis){const el=document.querySelector('#map-view .token[data-id="'+CSS.escape(o.id)+'"]');if(!el)return;
 el.style.left=depuis.x+'%';el.style.top=depuis.y+'%';void el.offsetWidth;el.classList.add('glisse');el.style.left=o.x+'%';el.style.top=o.y+'%';if(typeof suitLaJauge==='function')suitLaJauge(el)}
/* ---------- Le bruit ----------
   Un adversaire pas encore révélé entend un combattant quand le son lui parvient, qu'il le voie ou non : le chemin le plus
   court entre eux, plié aux angles des murs, ne dépasse pas la portée du bruit. Une porte close sur ce chemin ne le laisse passer
   qu'une fois sur deux, deux portes une fois sur quatre, et ainsi de suite. Les pas ne se tentent qu'une fois, comme on se
   révèle : la première fois qu'un aventurier entre à portée d'un adversaire. Celui qui entend porte un « ! » au-dessus de la
   tête, jusqu'à sa révélation. Rien d'autre : le MJ fait le reste. */
let terrainSon=null;
// Les côtés de la matière, qui arrêtent le son, et ceux de chaque porte close, rangés par mètre carré de carte.
function terrainDuBruit(){const m=currentMap(),size=mapSize(),tk=tokenPx();if(!m||!size.width||!(tk>0))return null;
 const cle=geometryKey(m)+'|'+Math.round(size.width)+'x'+Math.round(size.height)+'|'+Math.round(tk*100);
 if(terrainSon&&terrainSon.cle===cle)return terrainSon;
 const B=tk,cols=Math.ceil(size.width/B)+1,seaux=new Map(),px=q=>[q[0]/100*size.width,q[1]/100*size.height];
 const range=(a,b,k)=>{const x0=Math.max(0,Math.floor(Math.min(a[0],b[0])/B)),x1=Math.floor(Math.max(a[0],b[0])/B),y0=Math.max(0,Math.floor(Math.min(a[1],b[1])/B)),y1=Math.floor(Math.max(a[1],b[1])/B);
  for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){const c=j*cols+i;let l=seaux.get(c);if(!l)seaux.set(c,l=[]);l.push([a,b,k])}};
 (mapShapes(m).murs.contours||[]).forEach(c=>{const p=c.map(px);p.forEach((q,i)=>range(q,p[(i+1)%p.length],-1))});
 const portes=[];(m.doors||[]).forEach(d=>{if(!d||d.open||!(d.w>0&&d.h>0))return;const t=trouPorte(d,m);if(!t)return;
  const p=t.map(px),k=portes.length;portes.push(p);p.forEach((q,i)=>range(q,p[(i+1)%p.length],k))});
 return terrainSon={cle,B,cols,seaux,portes,size,tk}}
// Un pas du son, de p à q, en pixels : -1 si un mur le coupe, sinon le nombre de portes closes qu'il passe.
function traverseBruit(t,p,q){const B=t.B,x0=Math.max(0,Math.floor(Math.min(p[0],q[0])/B)),x1=Math.floor(Math.max(p[0],q[0])/B),y0=Math.max(0,Math.floor(Math.min(p[1],q[1])/B)),y1=Math.floor(Math.max(p[1],q[1])/B);
 const cote=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),coupe=(a,b)=>(cote(p,q,a)>0)!==(cote(p,q,b)>0)&&(cote(a,b,p)>0)!==(cote(a,b,q)>0)&&cote(p,q,a)!==0&&cote(p,q,b)!==0;
 let n=0,vues=null;
 for(let i=x0;i<=x1;i++)for(let j=y0;j<=y1;j++){const l=t.seaux.get(j*t.cols+i);if(!l)continue;
  for(const [a,b,k] of l){if(!coupe(a,b))continue;if(k<0)return -1;
   // Une porte compte quand on la quitte, ou qu'on la passe d'un pas : pas en y entrant.
   if(!(vues||(vues=new Set())).has(k)){vues.add(k);if(!pointInPolygon(q,t.portes[k]))n++}}}
 return n}
const VOISINS_BRUIT=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]].map(([i,j])=>[i,j,Math.hypot(i,j)]);
/* Le son se répand depuis ses sources sur une grille d'un demi-mètre, en seize directions : la plus courte distance, en
   pixels, de chaque case, selon le nombre de portes passées (0 à 3 ; au-delà, on ne l'entend plus guère). */
function propageBruit(t,sources,R){const C=t.tk/2,cols=Math.ceil(t.size.width/C),rows=Math.ceil(t.size.height/C),K=4,portees=Array.isArray(R)?R:[R,R],Rp=Math.max(...portees)*t.tk;
 const d=new Float64Array(cols*rows*K).fill(Infinity),tas=[];
 const pousse=(v,s)=>{tas.push([v,s]);let i=tas.length-1;while(i>0){const p=(i-1)>>1;if(tas[p][0]<=tas[i][0])break;[tas[p],tas[i]]=[tas[i],tas[p]];i=p}};
 const tire=()=>{const h=tas[0],f=tas.pop();if(tas.length){tas[0]=f;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<tas.length&&tas[l][0]<tas[m][0])m=l;if(r<tas.length&&tas[r][0]<tas[m][0])m=r;if(m===i)break;[tas[m],tas[i]]=[tas[i],tas[m]];i=m}}return h};
 const centre=c=>[(c%cols+.5)*C,(Math.floor(c/cols)+.5)*C];
 const vaut=(c,k,v)=>{for(let x=0;x<=k;x++)if(d[c*K+x]<=v)return false;return true};
 sources.forEach(s=>{const p=[s.x/100*t.size.width,s.y/100*t.size.height],ci=Math.floor(p[0]/C),cj=Math.floor(p[1]/C);
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=cols||j>=rows)continue;
   const c=j*cols+i,q=centre(c),k=traverseBruit(t,p,q);if(k<0||k>=K)continue;const v=Math.hypot(q[0]-p[0],q[1]-p[1]);if(v<d[c*K+k]){d[c*K+k]=v;pousse(v,c*K+k)}}});
 while(tas.length){const [v,s]=tire();if(v>d[s]||v>Rp)continue;const c=Math.floor(s/K),k=s%K,ci=c%cols,cj=Math.floor(c/cols),p=centre(c);
  for(const [di,dj,l] of VOISINS_BRUIT){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=cols||j>=rows)continue;const w=v+l*C;if(w>Rp)continue;
   const c2=j*cols+i;if(!vaut(c2,k,w))continue;const q=centre(c2),x=traverseBruit(t,p,q);if(x<0)continue;const k2=k+x;if(k2>=K||!vaut(c2,k2,w))continue;
   d[c2*K+k2]=w;pousse(w,c2*K+k2)}}
 return {d,cols,rows,C,K,Rp,Rk:portees.map(r=>r*t.tk),centre}}
// La chance qu'un adversaire entende : 1 sans porte, ½ derrière une porte close, ¼ derrière deux… 0 hors de portée, qui peut s'allonger derrière une porte.
function chanceEntendre(t,pr,a){const p=[a.x/100*t.size.width,a.y/100*t.size.height],ci=Math.floor(p[0]/pr.C),cj=Math.floor(p[1]/pr.C);let best=0;
 for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=pr.cols||j>=pr.rows)continue;
  const c=j*pr.cols+i,q=pr.centre(c),x=traverseBruit(t,q,p);if(x<0)continue;const l=Math.hypot(q[0]-p[0],q[1]-p[1]);
  for(let k=0;k<pr.K;k++){const v=pr.d[c*pr.K+k];if(k+x<pr.K&&v+l<=pr.Rk[k+x?1:0])best=Math.max(best,Math.pow(.5,k+x))}}
 return best}
/* Un bruit, depuis une ou plusieurs places, et sa portée en mètres, ou deux : sans porte, et à travers une porte close. Chaque
   adversaire pas encore révélé tente de l'entendre. « Une fois » : il ne le tente qu'une fois par aventurier, quand celui-ci
   entre à sa portée. Rend le nombre de ceux qui l'ont entendu. */
function faisBruit(qui,places,R,unefois){if(!qui||!Array.isArray(places)||!places.length||(typeof bruitCoupe!=='undefined'&&bruitCoupe))return 0;const t=terrainDuBruit();if(!t)return 0;
 const W=t.size.width,H=t.size.height,Rp=Math.max(...(Array.isArray(R)?R:[R]))*t.tk,deja=a=>unefois&&Array.isArray(a.ecoutes)&&a.ecoutes.includes(qui.id);
 const proches=actors.filter(a=>a&&a!==qui&&alive(a)&&!a.horsCarte&&!a.orbeStatique&&!a.vu&&campDe(a)==='adverse'&&!deja(a)
  &&places.some(s=>Math.hypot((a.x-s.x)/100*W,(a.y-s.y)/100*H)<=Rp));
 if(!proches.length)return 0;
 const pr=propageBruit(t,places,R);let n=0;
 proches.forEach(a=>{const c=chanceEntendre(t,pr,a);if(!(c>0))return;
  if(unefois)a.ecoutes=[...(Array.isArray(a.ecoutes)?a.ecoutes:[]),qui.id].slice(-24);
  if(Math.random()<c){a.entendu=Date.now();n++}});
 return n}
/* Les pas d'un combattant de la troupe, le long du chemin qu'il a suivi. Discret, il marche sans bruit jusqu'au bout de ses
   mètres de discrétion ; le bruit part de là où ils s'épuisent. */
function bruitDePas(o,pts){if(!o||!duCoteTroupe(o)||o.orbeStatique||!alive(o)||o.horsCarte||!Array.isArray(pts)||pts.length<2)return 0;
 const size=mapSize(),tk=tokenPx();if(!size.width||!(tk>0))return 0;
 const metresEntre=(p,q)=>Math.hypot((q.x-p.x)/100*size.width,(q.y-p.y)/100*size.height)/tk;
 let reste=Math.max(0,Number(o.discret)||0);const avait=reste>0,places=[];
 for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i],l=metresEntre(p,q);if(!(l>0))continue;
  if(reste>=l){reste-=l;continue}
  if(reste>0){const f=reste/l;places.push({x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f});reste=0}
  places.push({x:q.x,y:q.y})}
 if(avait){if(reste>0)o.discret=Math.round(reste*10)/10;else delete o.discret}
 return places.length?faisBruit(o,places,[BRUIT_PAS,BRUIT_PAS_PORTE],true):0}
// Le « ! » ne vaut qu'avant la révélation : révélé, ou tombé, l'adversaire le perd.
function oublieEntendus(){actors.forEach(a=>{if(a&&a.entendu&&(a.vu||!alive(a)))delete a.entendu})}
/* Le piège toujours actif, ou enjambable, qui a happé un combattant le tient : il n'en sort qu'en l'enjambant, ou le MJ l'en
   sort. Il le lâche quand il cesse de le toucher, quand on le désamorce, quand l'enjambement l'en a affranchi ; déclenché, un
   piège enjambable le tient encore. */
function tenuParPiege(o){if(!o||!o.tenuPar)return null;const m=currentMap(),p=m&&(m.pieges||[]).find(x=>x&&x.id===o.tenuPar),size=mapSize();
 if(!size.width)return p||null;
 if(!p||p.desamorce||(!piegeArme(p)&&!p.enjambement)||(Array.isArray(o.franchis)&&o.franchis.includes(p.id))||!touchePiege(p,[o.x/100*size.width,o.y/100*size.height],tokenOf(o)/2,size)){delete o.tenuPar;return null}
 return p}
// Au contact : la forme du piège touche la zone de contact de l'aventurier.
function piegeAPortee(a,p){const size=mapSize();return !!a&&!!p&&!!size.width&&(polyInReach(a,polyPiege(p),size,tokenOf(a))||(p.declencheurs||[]).some(d=>d.type==='bloc'&&polyInReach(a,rectHitbox(d),size,tokenOf(a))))}
/* Désamorcer ou enjamber : le test que le MJ a préparé, l'Action en combat. Désamorcé, le piège se grise ; manqué, il reste en
   l'état. Enjambé, l'aventurier le franchit sans le faire partir, et ne le fera plus jamais partir ; manqué, il le déclenche. */
function testPiege(a,p,quoi){const t=p&&p[quoi],dedans=quoi==='enjambement'&&!!p&&tenuParPiege(a)===p;if(!a||!t||(!piegeArme(p)&&!dedans)||!payeAction(a))return;
 const jet=skillRoll(valeurCompetence(a,t.comp)-1,d6),n=jet.reussites+(typeof bonusReussites==='function'?bonusReussites(a,t.comp,quoi==='enjambement'):0)+(quoi!=='enjambement'&&typeof bonusBricoleur==='function'?bonusBricoleur(a):0),ok=n>=t.reussites;rollOnBoard(jet.des.slice(0,40).map(v=>[v,0]),a,null);
 const tete=nomNum(a)+' · '+skillNames[t.comp]+' : '+n+' réussite'+(n>1?'s':'')+' ⦃'+jet.des.join(',')+'⦄ — ';
 if(quoi==='desamorcage'){if(ok)p.desamorce=true;log(tete+(ok?'désamorce '+p.nom:'ne parvient pas à désamorcer '+p.nom)+'.',{dice:true,ton:'competence'})}
 // v0.9993 : le Bouton d'Interaction n'écrit que son test : « Ulfgar - Test de Ruse : 2 Réussites ».
 else{log(nomNum(a)+' - ⟬t'+Math.max(0,Math.min(7,Math.trunc(Number(t.comp))||0))+'|'+n+'|'+jet.des.slice(0,40).join(',')+'⟭');if(ok){a.franchis=[...new Set([...(Array.isArray(a.franchis)?a.franchis:[]),p.id])].slice(-60);delete a.tenuPar}
  // Sorti du fond, il regagne la place d'où le piège l'avait happé, ou à défaut le bord le plus proche, hors du piège.
  // Sorti, il n'est plus Au sol si c'est ce piège qui l'y avait mis.
  if(ok&&dedans){const de={x:a.x,y:a.y},q=sortieDuPiege(a,p);a.x=q.x;a.y=q.y;delete a.avantPiege;if((p.etats||[]).includes('Au sol')&&hasState(a,'Au sol'))setState(a,'Au sol',false);if(typeof settleActor==='function')settleActor(a);render();glisseAuPiege(a,de);saveMaps();scheduleSave();return}}
 if(enCombat()&&typeof afterAction==='function')afterAction(a);
 /* Manqué du bord, l'aventurier est précipité dans le piège ; manqué du fond, il y reste et en subit encore les états. */
 if(quoi==='enjambement'&&!ok&&dedans){const crans=tireCrans(p),etats=(p.etats||[]).map(e=>infligeCrans(a,e,crans)).filter(Boolean);floatNumber(a,'Piège !','perte');
  if(etats.length)log('Piège ! '+nomNum(a)+' retombe dans '+p.nom+' — '+etats.join(', ')+'.',{ton:'degats'});render();saveMaps();scheduleSave();return}
 if(quoi==='enjambement'&&!ok){declenchePiege(p,a,true);return}
 render();saveMaps();scheduleSave()}
// Réamorcer : le porteur du talent Réamorceur rend son mordant à un piège réamorçable et grisé, à son contact.
function reamorcePiege(a,p){if(!a||!p||piegeArme(p)||!p.reamorcable||!payeAction(a))return;
 delete p.declenche;delete p.desamorce;log(nomNum(a)+' réamorce '+p.nom+'.',{ton:'carte'});
 if(enCombat()&&typeof afterAction==='function')afterAction(a);render();saveMaps();scheduleSave()}
/* Au clic : l'aventurier choisi, au contact, désamorce ou enjambe un piège armé, ou en réamorce un grisé s'il en a le talent.
   Le MJ révèle ou cache, déclenche sur le combattant choisi, désamorce ou réarme d'autorité. */
function menuPiege(p,x,y){const mj=view==='mj',a=heroActif(),proche=!!a&&piegeAPortee(a,p),entrees=[];
 if(!mj&&!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
 if(!mj&&!proche){log('Approche '+a.name+' : il faut être au contact de '+p.nom+'.',{local:true});return}
 if(proche){if(piegeArme(p)){if(p.desamorcage)entrees.push(['Désamorcer · '+skillNames[p.desamorcage.comp],()=>testPiege(a,p,'desamorcage')]);
   if(p.enjambement&&!(Array.isArray(a.franchis)&&a.franchis.includes(p.id)))entrees.push(['Enjamber · '+skillNames[p.enjambement.comp],()=>testPiege(a,p,'enjambement')])}
  else if(p.reamorcable&&porteEffet(talentsCodes(a),'reamorcage'))entrees.push(['Réamorcer',()=>reamorcePiege(a,p)])}
 /* Un joueur au contact d'un piège qu'il n'a qu'à enjamber : son clic lance le test, sans menu. Manqué, le piège part sur lui. */
 if(!mj&&entrees.length===1&&p.enjambement&&entrees[0][0].startsWith('Enjamber')){entrees[0][1]();return}
 if(mj){if(p.cache)entrees.push([p.revele?'Cacher à la troupe':'Révéler à la troupe',()=>{p.revele=!p.revele;if(p.revele)floatNumber(centrePiege(p),'Révélé !','nul');render();saveMaps();scheduleSave()}]);
  if(piegeArme(p)){const c=actors[selected];if(c&&alive(c)&&!c.horsCarte)entrees.push(['Déclencher sur '+nomNum(c),()=>declenchePiege(p,c)]);
   entrees.push(['Désamorcer',()=>{p.desamorce=true;log(p.nom+' est désamorcé.',{ton:'carte',local:true});render();saveMaps();scheduleSave()}])}
  else entrees.push(['Réarmer',()=>{delete p.declenche;delete p.desamorce;log(p.nom+' est réarmé.',{ton:'carte',local:true});render();saveMaps();scheduleSave()}])}
 menuCarte(p.nom||'Piège',entrees,x,y)}
/* Le visuel d'un piège : l'image importée, sinon l'icône choisie, sinon le piège à mâchoires. En jeton, dans un rond ; en image
   seule, sans fond ni bord. */
function visuelPiege(p){const v=document.createElement('span');v.className='piege-visuel';let im=null;
 if(p&&p.image){im=document.createElement('img');im.src=p.image}else if(p&&p.logo&&typeof poseLogo==='function'){im=document.createElement('img');poseLogo(im,p.logo)}
 if(im){im.className='piege-image';im.alt='';im.draggable=false;v.append(im)}else v.textContent='🪤';return v}
// Sa bulle : son nom et sa description ; chez le MJ, ses réglages et ses effets.
function bullePiege(p,mj){const g=document.createElement('div');g.className='gear-detail large';
 const n=document.createElement('p');n.className='gear-nom';n.textContent=p.nom||'Piège';g.append(n);
 if(p.desc){const d=document.createElement('p');d.className='objet-desc-bulle';d.textContent=p.desc;g.append(d)}
 if(mj){const t=(nom,x)=>x?nom+' : '+skillNames[x.comp]+' '+x.reussites:'';
  const l=[p.cache&&!p.revele?t('Caché',p.detection):'',p.declenche?'Déclenché':p.desamorce?'Désamorcé':'',p.actif?'Toujours actif':'',t('Désamorçable',p.desamorcage),t('Évitable',p.evitement),t('Enjambable',p.enjambement),
   p.reamorcable?'Réamorçable':'',p.degatsDes||p.degats>0?formuleDegats(p)+' dégât'+(p.degatsDes||p.degats>1?'s':''):'',...(p.etats||[]).map(e=>p.crans&&p.crans[e]?e+' '+formuleDegats(p.crans[e]):e),...(p.caracs||[]).map(phrasePerte)].filter(Boolean);
  if(l.length){const q=document.createElement('p');q.className='muted objet-cache-bulle';q.textContent=l.join(' · ');g.append(q)}}
 return g}
/* Les pièges ont leur calque, sous le brouillard, comme les coffres. La troupe ne voit un piège que connu et sous ses yeux ; le
   MJ les voit tous, avec leurs déclencheurs ; ceux d'un piège armé se voient aussi de la troupe. */
function renderPieges(){let calque=$('map-pieges');if(!calque){calque=document.createElement('div');calque.id='map-pieges';$('fog').before(calque)}
 calque.replaceChildren();const m=currentMap();if(!m||!(m.pieges||[]).length)return;
 const mj=view==='mj'&&!(typeof oeilJoueur==='function'&&oeilJoueur()),svg=document.createElementNS(nsSVG,'svg');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','piege-declencheurs');
 m.pieges.forEach(p=>{const connu=piegeConnu(p),enVue=coffreEnVue(p),arme=piegeArme(p);
  if(!mj&&(!connu||!enVue))return;
  const el=document.createElement('div');el.className='piege-table '+(p.affichage==='image'&&(p.image||p.logo)?'image':'jeton')+(connu?'':' cache')+(arme?'':' inerte')+(enVue?'':' voile');
  el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.width=p.w+'%';el.style.height=p.h+'%';el.append(visuelPiege(p));el.setAttribute('aria-label',p.nom);
  // Sa bulle n'est plus sur le piège, pour personne : elle est sur le rond Enjamber (renderEnjamber).
  el.onmousedown=e=>e.preventDefault();el.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();menuPiege(p,e.clientX,e.clientY)};
  calque.append(el);
  if(mj||arme)(p.declencheurs||[]).forEach(d=>{let f;if(d.type==='bloc'&&!mj)return;
   if(d.type==='fil'){f=document.createElementNS(nsSVG,'line');[['x1',d.x1],['y1',d.y1],['x2',d.x2],['y2',d.y2]].forEach(([k,v])=>f.setAttribute(k,v))}
   else{f=document.createElementNS(nsSVG,'rect');[['x',d.x],['y',d.y],['width',d.w],['height',d.h]].forEach(([k,v])=>f.setAttribute(k,v))}
   f.setAttribute('class',(d.type==='fil'?'fil':d.type==='bloc'?'zone hitbox':'zone')+(arme?'':' inerte')+(connu?'':' cache'));svg.append(f)})});
 if(svg.childNodes.length)calque.prepend(svg)}
/* Enjamber : au-dessus d'un piège armé, connu, en vue et enjambable que l'aventurier choisi touche de sa zone de contact, un
   bouton rond flottant, à la couleur de la compétence du test. Un clic lance le test d'Enjamber, avec ses suites ordinaires. */
/* Il se redessine au fil du geste : le rond paraît dès que le piège entre dans la zone de contact. Rien ne change, rien ne se
   refait. */
let enjamberCle='';
function renderEnjamber(){let calque=$('piege-boutons');if(!calque){calque=document.createElement('div');calque.id='piege-boutons';calque.setAttribute('aria-hidden','false');$('map-view').append(calque);enjamberCle=''}
 const m=currentMap(),a=heroActif();
 const montres=!m||!a||a.horsCarte?[]:(m.pieges||[]).filter(p=>{const dedans=!!p&&tenuParPiege(a)===p;
  return !!p&&!!p.enjambement&&(dedans||(piegeArme(p)&&piegeConnu(p)&&coffreEnVue(p)&&!(Array.isArray(a.franchis)&&a.franchis.includes(p.id))&&piegeAPortee(a,p)))});
 const gris=!!a&&enCombat()&&(pointsRestants(a,'action')<=0||(typeof gelDebut==='function'&&gelDebut(a)));
 const cle=(a?a.id:'')+'|'+gris+'|'+echelleInteraction()+'|'+montres.map(p=>p.id+':'+p.x+':'+p.y+':'+p.w+':'+p.h).join(',');
 // Le même rond, dans la barre d'actions, au bout des petits boutons, cerné de sa couleur.
 let barre=$('actions-contexte');if(!barre){const row=$('attack-row');if(row){barre=document.createElement('span');barre.id='actions-contexte';row.append(barre);enjamberCle=''}}
 if(cle===enjamberCle&&calque.isConnected&&(!barre||barre.isConnected))return;enjamberCle=cle;calque.replaceChildren();if(barre)barre.replaceChildren();
 montres.forEach(p=>[false,true].forEach(dansBarre=>{if(dansBarre&&!barre)return;
  const k=Math.max(0,Math.min(7,Math.trunc(Number(p.enjambement.comp))||0)),b=document.createElement('button');b.type='button';
  b.className='btn-action rond btn-enjamber'+(dansBarre?' contexte':' bouton-interaction');if(!dansBarre){b.style.left=(p.x+p.w/2)+'%';b.style.top=(p.y+p.h/2)+'%';b.style.setProperty('--echelle',echelleInteraction())}b.style.setProperty('--fond','rgb('+SKILL_TINTS[k]+')');
  const ico=typeof logoCompetence==='function'?logoCompetence(k):null;if(ico)b.append(ico);else b.textContent=skillNames[k].slice(0,2);
  // Sa bulle, comme celle d'une action : Enjamber le piège, ou Sortir du piège pour qui y est tombé ; le test requis.
  const nom=tenuParPiege(a)===p?'Sortir du piège':'Enjamber le piège',dit='Test de '+skillNames[k]+' requis.';
  b.setAttribute('aria-label',nom+' — '+dit);
  if(typeof surveille==='function'&&typeof bulleAction==='function')surveille(b,()=>bulleAction(b,{nom,dit}));
  inerte(b,gris);
  b.onpointerdown=e=>e.stopPropagation();b.onmousedown=e=>{e.preventDefault();e.stopPropagation()};
  b.onclick=e=>{e.stopPropagation();if(estInerte(b))return;testPiege(a,p,'enjambement')};(dansBarre?barre:calque).append(b)}))}
const objetVue=dialog('objet-vue','Objet','<div id="objet-corps"></div>');
function openObjetTable(i){const m=currentMap(),o=m&&m.objets&&m.objets[i];if(!o||(!objetVu(o)&&view!=='mj'))return;
 objetVue.querySelector('h2').textContent=(objetVu(o)?'':'◌ ')+o.nom;
 const corps=$('objet-corps');corps.replaceChildren();
 const p=(cls,txt)=>{const e=document.createElement('p');if(cls)e.className=cls;e.textContent=txt;corps.append(e);return e};
 p(o.desc?'objet-desc':'muted',o.desc||'Aucune description.');
 const a=actors[selected],mien=!!(a&&a.hero&&controlled(selected)&&alive(a)),pres=mien&&objetAPortee(a,o);
 const pourquoi=!mien?'Sélectionne d’abord ton aventurier.':!pres?'Approche ton aventurier : il faut être au contact.':'';
 // Au contact, l'objet débloque la quête cachée qu'il porte.
 if(pres&&o.quete&&typeof debloqueQuete==='function')debloqueQuete(a,o.quete);
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
  const voile=document.createElement('button');voile.textContent=objetVu(o)?'Cacher à la troupe':'Révéler à la troupe';
  voile.onclick=()=>{montreObjet(o,!objetVu(o));log(o.nom+(objetVu(o)?' est révélé.':' est caché.'),{ton:'carte'});render();saveMaps();openObjetTable(i)};
  outils.append(voile);
  if(!objetVu(o)){const test=document.createElement('button');
   test.textContent='🎲 Test : '+skillNames[o.test.comp]+' × '+o.test.reussites+(a&&a.hero?' pour '+a.name:'');
   test.disabled=!(a&&a.hero);test.title=a&&a.hero?'Lance la compétence de l’aventurier sélectionné.':'Sélectionne l’aventurier qui cherche.';
   test.onclick=()=>{objetVue.close();testerObjet(a,o)};outils.append(test)}
  corps.append(outils)}
 objetVue.showModal()}
/* Les portes se dessinent au-dessus du brouillard : une fois découverte, une porte reste
   lisible dans la pénombre. Tant qu'elle est inexplorée, elle n'existe pas. Le calque se
   refait seul, à part de la matière : il suit le socle qu'on tient. */
/* v0.974 : les fenêtres se peignent sous le brouillard, dans leur propre calque : elles ne ressortent pas de l'ombre comme
   les portes, on ne les voit que là où la vue porte. */
function calqueFenetres(){let f=$('map-fenetres');if(!f){const doors=$('map-doors'),fog=$('fog');if(!doors||!fog)return doors;
  f=document.createElementNS('http://www.w3.org/2000/svg','svg');f.id='map-fenetres';f.setAttribute('viewBox','0 0 100 100');f.setAttribute('preserveAspectRatio','none');f.setAttribute('aria-hidden','true');
  fog.before(f)}return f}
/* v0.976 : ce qui manœuvre chaque porte dessinée, pour le rond qui l'ouvre (renderBoutonsPortes). */
const manoeuvresPorte=new Map();
const porteManoeuvree=a=>!!a&&Array.isArray(a.talentsJoues)&&a.talentsJoues.includes('__porte');
function renderPortes(){manoeuvresPorte.clear();const portes=$('map-doors'),fenetres=calqueFenetres(),m=currentMap();portes.replaceChildren();if(fenetres&&fenetres!==portes)fenetres.replaceChildren();if(!m)return;
 (m.doors||[]).forEach((d,i)=>{
  const mj=view==='mj';
  // Un passage secret clos n'existe pas pour la troupe : elle ne voit qu'un mur.
  if(doorHiddenFrom(d,mj)||!doorSeen(d))return;
  // v0.977 : chez un joueur, une porte ne se dessine que dans sa ligne de vue directe, et éclairée : ni de mémoire, ni dans le noir.
  // v0.979 : une fenêtre aussi.
  if(!mj&&oeilJoueur()&&!m.fogOff&&fogVis&&!doorInSight(d))return;
  // Une porte que ce lecteur peut manœuvrer s'annonce au survol.
  /* La clé de la porte, dans l'inventaire de l'aventurier choisi : elle ouvre ce que seul le MJ ouvrait —
     une porte verrouillée, un passage secret découvert et verrouillé. Elle n'est pas consommée. */
  const parCle=!mj&&d.keyLocked&&!!d.cleId&&aLaCle(heroActif(),d.cleId)&&(!d.secret||d.open||d.decouvert);
  const ouvrable=mj||((!doorLockedFor(d,mj)||parCle)&&doorInReach(d));
  const el=svgPorte(d,m.ratio,'door'+(d.open?' open':'')+(d.keyLocked?' keyed':'')
   +(d.secret?' secret':'')+(d.fenetre?' fenetre':'')+(ouvrable?' can-open':'')+(!mj&&!doorInReach(d)?' loin':''));
  el.style.pointerEvents='all';
  el.onclick=()=>{
   if(doorLockedFor(d,mj)&&!parCle){log(d.secret&&!d.open
    ?'Rien ici qu’un mur : ce passage n’existe pas pour la troupe.'
    :d.fenetre?'Cette fenêtre est verrouillée : seul le MJ peut l’ouvrir.':'Cette porte est verrouillée : seul le MJ peut l’ouvrir.');return}
   if(!doorInReach(d)){log(d.fenetre?'Trop loin de la fenêtre : approche ton aventurier pour manœuvrer ses volets.':'Trop loin de la porte : approche ton aventurier pour la manœuvrer.',{local:true});return}
   /* v1.072 — En combat, ouvrir ou fermer est une Action bonus : sans coût, une fois par tour pour qui manœuvre (noté dans
      « talentsJoues », que chaque nouveau tour vide). En exploration, c'est libre. */
   const qui=typeof enCombat==='function'&&enCombat()?porteurDePorte(d):null;
   if(qui){if(porteManoeuvree(qui)){log(nomNum(qui)+' a déjà manœuvré une porte ce tour.',{local:true});
     if(typeof floatNumber==='function')floatNumber(qui,'Déjà fait ce tour','nul',true);return}
    qui.talentsJoues=[...(Array.isArray(qui.talentsJoues)?qui.talentsJoues:[]),'__porte']}
   d.open=!d.open;
   render();scheduleSave()};
  manoeuvresPorte.set(d,el.onclick);
  // v0.996 : les portes aussi se peignent sous le brouillard, comme les fenêtres.
  (fenetres||portes).append(el)});portesBoutonsCle='';if($('map-view'))renderBoutonsPortes()}
/* v0.976 : sur la porte que l'aventurier du joueur touche et peut manœuvrer, un rond aux couleurs d'un Mouvement, comme le rond
   Enjamber d'un piège : un clic l'ouvre ou la ferme. Grisé en combat sans point de Mouvement. */
let portesBoutonsCle='';
// L'échelle des Boutons d'Interaction : dessinés à 58 px, ils font 45 % du socle de la carte.
function echelleInteraction(){return (tokenPx()*.45/58).toFixed(3)}
function renderBoutonsPortes(){let calque=$('porte-boutons');if(!calque){calque=document.createElement('div');calque.id='porte-boutons';$('map-view').append(calque);portesBoutonsCle=''}
 // v1.047 : le MJ voit aussi les Boutons d'Interaction, ceux de l'aventurier qu'il a sélectionné, comme son joueur.
 const m=currentMap(),a=view==='mj'?heroActif():actors[owner];
 const montres=!m||!a||!a.hero||!alive(a)||a.horsCarte?[]:(m.doors||[]).filter(d=>{if(!d||doorHiddenFrom(d,false)||!doorSeen(d)||!porteAtteinte(a,d)||!manoeuvresPorte.has(d))return false;
  const parCle=d.keyLocked&&!!d.cleId&&aLaCle(a,d.cleId)&&(!d.secret||d.open||d.decouvert);return !doorLockedFor(d,false)||parCle});
 const gris=typeof enCombat==='function'&&enCombat()&&porteManoeuvree(a);
 const cle=(a?a.id:'')+'|'+gris+'|'+Math.round(tokenPx())+'|'+montres.map(d=>[d.x,d.y,d.w,d.h,d.open?1:0].join(':')).join(',')+'|'+verrouilleesAPortee(m,a).map(d=>[d.x,d.y].join(':')).join(',');
 if(cle===portesBoutonsCle&&calque.isConnected)return;portesBoutonsCle=cle;calque.replaceChildren();
 montres.forEach(d=>{const b=document.createElement('button');b.type='button';b.className='btn-action rond btn-porte bouton-interaction'+(d.open?' ouverte':'');
  b.style.left=(d.x+d.w/2)+'%';b.style.top=(d.y+d.h/2)+'%';
  // v0.980 : sa taille suit la carte, à proportion du socle : il ne grossit pas quand on dézoome.
  b.style.setProperty('--echelle',echelleInteraction());
  // Son icône se choisit dans l'éditeur, avec celles des actions spéciales ; sans elle, une porte dessinée.
  {const ic=typeof centreAction==='function'?centreAction('porte',null):null;if(ic&&typeof ic==='object')b.append(ic);else b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4.5L13 3v18M13 4h5v17M3 21h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="10.5" cy="12.5" r="1.2" fill="currentColor"/></svg>';}
  const nom=d.fenetre?(d.open?'Fermer les volets':'Ouvrir les volets'):(d.open?'Fermer la porte':'Ouvrir la porte');b.setAttribute('aria-label',nom);
  if(typeof surveille==='function'&&typeof bulleAction==='function')surveille(b,()=>bulleAction(b,{nom}));
  if(typeof inerte==='function')inerte(b,gris);
  b.onpointerdown=e=>e.stopPropagation();b.onmousedown=e=>{e.preventDefault();e.stopPropagation()};
  b.onclick=e=>{e.stopPropagation();if(typeof estInerte==='function'&&estInerte(b))return;const f=manoeuvresPorte.get(d);if(f)f()};calque.append(b)})
 /* v1.022 : une porte ou une fenêtre verrouillée, à portée, porte un cadenas à la place du rond : sa bulle le dit, il n'agit pas. */
 verrouilleesAPortee(m,a).forEach(d=>{const b=document.createElement('button');b.type='button';b.className='btn-action rond btn-porte bouton-interaction verrouillee';
  b.style.left=(d.x+d.w/2)+'%';b.style.top=(d.y+d.h/2)+'%';b.style.setProperty('--echelle',echelleInteraction());b.innerHTML=ICONE_CADENAS;
  const nom=d.fenetre?'Fenêtre verrouillée':'Porte verrouillée';b.setAttribute('aria-label',nom);if(typeof surveille==='function'&&typeof bulleAction==='function')surveille(b,()=>bulleAction(b,{nom}));
  b.onpointerdown=e=>e.stopPropagation();b.onmousedown=e=>{e.preventDefault();e.stopPropagation()};b.onclick=e=>e.stopPropagation();calque.append(b)})}
const ICONE_CADENAS='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15.5" r="1.5" fill="currentColor"/></svg>';
// À portée de l'aventurier dont on montre les boutons : chez le MJ, le sélectionné — doorInReach, chez lui, dit toujours oui.
function porteAtteinte(a,d){if(view!=='mj')return doorInReach(d);const size=mapSize(),m=currentMap();return !!(a&&a.hero&&alive(a)&&size.width&&polyInReach(a,doorPolygon(d,m&&m.ratio),size,tokenPx()))}
function verrouilleesAPortee(m,a){if(!m||!a||!a.hero||!alive(a)||a.horsCarte)return [];
 return (m.doors||[]).filter(d=>d&&d.keyLocked&&!d.crochetee&&!(d.secret&&!d.open&&!d.decouvert)&&!doorHiddenFrom(d,false)&&doorSeen(d)&&porteAtteinte(a,d)&&manoeuvresPorte.has(d)&&!(d.cleId&&aLaCle(a,d.cleId)))}
{const f=renderEnjamber;renderEnjamber=function(...x){const r=f.apply(this,x);renderBoutonsPortes();return r}}
/* (v0.985 : il se refait aussi pendant le geste, quelques fois par seconde — vueEnGeste.) Le brouillard ne se recalcule qu'au relâchement du socle, jamais pendant le geste : le
   repeindre à chaque image — une toile de quatre mille pixels, floutée — faisait accrocher
   la main, et c'est la main qui prime. Au relâchement, il est prêt en quelques
   millisecondes : les portes sont testées par lancer de rayon, la mémoire n'est
   réemballée qu'une fois. */

/* ---------- Ouverture d'une carte en combat ---------- */
function modeleActuel(tpl){if(!tpl)return tpl;const liste=catalog.monsters||[];
 const parId=tpl.id&&liste.find(x=>x&&x.id===tpl.id);if(parId)return parId;
 const parNom=liste.filter(x=>x&&x.name===tpl.name);return parNom.length===1?parNom[0]:tpl}
/* v1.109 — La progression d'une carte : en la quittant, la table retient les adversaires encore debout (place, PV, états) et ceux
   qu'on y avait déjà posés ; le reste — objets pris, portes, coffres, pièges, terrains détruits, brouillard — vit déjà sur la carte.
   À la réouverture : la reprendre, ou repartir à zéro. Une seule progression par carte. */
const CHAMPS_PROGRESSION=['x','y','hp','max','states','cumuls','bleed','armure','hidden','vu','revealed','connu','alignementJeu','inventaire','bourse','plantesVolees','entendu','name','numero'];
function noteProgression(){const m=maps.find(x=>x&&x.id===currentMapId);if(!m||view!=='mj'||(typeof spectateur==='function'&&spectateur()))return;
 const poses=new Set((m.foes||[]).map(f=>f&&f.id).filter(Boolean));
 const advs=actors.filter(a=>a&&!a.hero&&a.pose&&poses.has(a.pose)&&alive(a)&&!a.retire).map(a=>{const o={pose:a.pose};CHAMPS_PROGRESSION.forEach(k=>{if(a[k]!==undefined)o[k]=structuredClone(a[k])});return o});
 m.progression={date:Date.now(),poses:[...poses],adversaires:advs,xpAccordee:Math.max(0,Math.trunc(Number(m.xpAccordee))||0)}}
function effaceProgression(m){if(m&&m.progression){delete m.progression;saveMaps();renderMapList();if(typeof majBoutonProgression==='function')majBoutonProgression()}}
const dateProgression=m=>m&&m.progression?new Date(m.progression.date).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
// Reprendre, repartir à zéro, ou renoncer : rend 'reprendre', 'zero' ou null.
function demanderProgression(m){return new Promise(res=>{let d=$('demande-progression');
 if(!d){d=document.createElement('dialog');d.id='demande-progression';d.className='demande';
  d.innerHTML='<p id="demande-progression-texte"></p><div class="form-actions"><button type="button" data-v="">Annuler</button><button type="button" data-v="zero">Repartir à zéro</button><button type="button" data-v="reprendre" class="primary">Reprendre la progression</button></div>';
  document.body.append(d)}
 $('demande-progression-texte').textContent='Ouvrir « '+m.name+' » ? Une progression y est enregistrée ('+dateProgression(m)+').';
 let fini=false;const fin=v=>{if(fini)return;fini=true;if(d.open)d.close();res(v||null)};
 d.querySelectorAll('button').forEach(b=>{b.onclick=()=>fin(b.dataset.v)});d.onclose=()=>fin(null);d.showModal();d.querySelector('.primary').focus()})}
function openBattleMap(id){const m=maps.find(x=>x.id===id);if(!m)return;
 if(m.progression){demanderProgression(m).then(v=>{if(v)ouvreCarte(m,v==='reprendre')});return}
 if(!confirm('Ouvrir « '+m.name+' » ? Les aventuriers sont regroupés dans la zone de départ et les adversaires de la scène sont remplacés par ceux de la carte.'))return;
 ouvreCarte(m,false)}
function ouvreCarte(m,reprendre){const id=m.id;
 // La carte quittée — ou celle qu'on rouvre — retient où en était la troupe.
 noteProgression();const prog=reprendre&&m.progression?m.progression:null;if(!reprendre)delete m.progression;
 // v0.848 : rouvrir la carte déjà en cours garde le zoom et le point visé.
 const memeCarte=currentMapId===id;
 currentMapId=id;mapImage=m.image||null;measureRatio(m,render);
 // Une carte ouverte repart de zéro XP accordée : la rencontre est à venir ; reprise, elle garde ce qu'elle a donné.
 m.xpAccordee=prog?prog.xpAccordee||0:0;
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 /* Ceux que le MJ a cochés partent à l'aventure : eux seuls entrent sur la carte, les autres restent hors de la carte.
    Sans aucune case cochée, tous entrent, comme avant. */
 const tous=actors.filter(a=>a.hero),libres=tous.filter(a=>a.surBanc!==true),choisis=libres.filter(a=>a.enAventure===true),heros=choisis.length?choisis:libres;
 tous.forEach(a=>{if(!heros.includes(a))a.horsCarte=true});
 // v0.961 : une carte rechargée ne rend PAS les repos courts : seul un vrai repos le fait.
 // Une carte rechargée rend aussi ses zones à fouiller : les tests de Perception y repartent de zéro.
 // Et ramène sur la table ceux qu'on en avait retirés : ils sont toujours parmi les aventuriers.
 heros.forEach(a=>{a.horsCarte=false;delete a.retire;a.fouilles=(a.fouilles||[]).filter(f=>f&&f.m!==id)});
 // Un aventurier en attente du MJ n'entre pas sur la carte.
 heros.forEach(a=>{if(a.enAttente===true)a.horsCarte=true});
 // Et ses objets récupérés reviennent à leur place — sauf si l'on reprend la progression : la carte reste comme la troupe l'a laissée.
 if(!prog){(m.objets||[]).forEach(o=>{delete o.pris;delete o.prisN;delete o.revele;delete o.voile;delete o.examine;delete o.tente});(m.lumieres||[]).forEach(l=>{delete l.eteinte;delete l.prise});delete m.dangersDetruits;delete m.seuilsSel;delete m.dangersTrous}
 // Placement libre : d'une carte à l'autre, les murs de la nouvelle ne barrent pas le chemin.
 if(m.start)spreadInZone(heros.length,m.start,m.ratio).forEach((p,i)=>moveActor(heros[i],p.x,p.y,true));
 actors.splice(0,actors.length,...tous);
 // Une carte s'ouvre portes closes et brouillard intact : l'état des portes est une affaire de partie.
 if(!prog)(m.doors||[]).forEach(d=>{d.open=!!d.fenetre&&etatFenetre(d)==='ouverte';delete d.decouvert;delete d.crochetee});const grille=fogDims(m);
 // Et ses coffres reviennent comme le MJ les a laissés : cachés, verrouillés, piégés, pleins.
 if(!prog)(m.coffres||[]).forEach(c=>{['revele','deverrouille','desamorce','ouvert','tente'].forEach(k=>delete c[k])});
 // Et ses pièges, armés et cachés comme le MJ les a posés.
 if(!prog)(m.pieges||[]).forEach(p=>{['revele','declenche','desamorce','rate'].forEach(k=>delete p[k])});
 {const ids=new Set((m.pieges||[]).map(p=>p.id));heros.forEach(a=>{delete a.tenuPar;if(Array.isArray(a.franchis)){a.franchis=a.franchis.filter(id=>!ids.has(id));if(!a.franchis.length)delete a.franchis}})}
 if(!prog){m.fog=packMask(new Uint8Array(grille.n),grille.n);delete m.seen;m.fogOff=false}fogSeen=null;fogSeenSrc=null;fogKey='';
 /* L'invisibilité ne se pose plus sur la carte : c'est un état, donné en jeu. Une carte
    tracée avant la v0.82 garde ses invisibles, mais sous forme d'état. */
 /* Le modèle a été recopié sur la carte le jour où l'adversaire y a été posé ; le
    bestiaire, lui, a pu changer depuis. C'est le bestiaire qui fait foi : le modèle du
    même identifiant, ou à défaut du même nom s'il est seul à le porter. La copie ne
    sert plus que si le modèle a disparu. */
 const uniques=new Set();
 (m.foes||[]).forEach(f=>{const t=modeleActuel(f.tpl);if(t&&t.pnj&&t.unique===true){if(uniques.has(t.id))return;uniques.add(t.id)}
  if(!f.id)f.id=crypto.randomUUID();
  // Reprise : un adversaire tombé ne revient pas ; un adversaire posé depuis dans l'éditeur arrive, neuf.
  const garde=prog&&(prog.adversaires||[]).find(x=>x.pose===f.id);if(prog&&!garde&&(prog.poses||[]).includes(f.id))return;
  const a=fromMonster(t);a.x=f.x;a.y=f.y;
  // Le lien vers sa pose : l'éditeur retrouve ainsi l'adversaire en jeu.
  a.pose=f.id;
  // Ce que la carte lui a donné, à lui seul.
  {const bourse=normaliseBourse(f.bourse);if((Array.isArray(f.inventaire)&&f.inventaire.length)||bourse.length){a.propres={inventaire:[...(f.inventaire||[])],butin:{...(f.butin||{})},...(bourse.length?{bourse}:{})};ajoutePropres(a,a.propres)}}
  normalizeActor(a);
  if(f.hidden)setState(a,'Invisible',true);
  // Caché par le MJ dans l'éditeur : la troupe ne le voit pas tant qu'il ne le révèle pas d'un clic.
  if(f.cache)a.hidden=true;
  // Reprise : là où il était, avec ses PV, ses états, ce qu'on sait de lui.
  if(garde){CHAMPS_PROGRESSION.forEach(k=>{if(garde[k]!==undefined)a[k]=structuredClone(garde[k])});normalizeActor(a)}
  actors.push(a)});
 /* Une carte qui s'ouvre, c'est une rencontre à venir : tour 1, tout remis à zéro, et la
    troupe en exploration — le combat commencera de lui-même au premier adversaire révélé. */
 if(typeof remiseAuTourUn==='function')remiseAuTourUn();
 mode='exploration';
 render();actors.forEach(a=>settleActor(a));   // Personne ne démarre dans un mur.

 actors.forEach(a=>{a.target=null});
 owner=actors.findIndex(a=>a.hero&&!a.horsCarte);if(owner<0)owner=actors.findIndex(a=>a.hero);selected=Math.max(0,owner);
 if(!memeCarte)resetMapZoom();showPage('table');render();
 scheduleSave()}

/* ---------- Onglets de page, réservés au MJ ---------- */
const tabs=document.createElement('nav');tabs.className='tabs';
tabs.innerHTML='<button data-page="accueil">Accueil</button><button data-page="table" class="on">Table</button><button data-page="maps">Cartes</button>'
 +'<button data-page="domaine">Domaine</button><button data-page="heroes">Aventuriers</button><button data-page="talents">Talents</button>'
 +'<button data-page="armory">Armurerie</button><button data-page="bestiary">Bestiaire</button><button data-page="icones">Icônes</button><button data-page="gemmes">Sphères</button>'
 +'<button data-page="regles">Règles</button><button data-page="settings">Paramètres</button><button data-page="maj">Versions</button>';
document.querySelector('.view-controls').before(tabs);
const PAGES=['accueil','table','maps','domaine','heroes','talents','armory','bestiary','icones','gemmes','regles','settings','maj'];
/* Sous l'onglet ouvert, chez le MJ seul et pendant une table en ligne : un petit viseur. Un clic envoie tous les joueurs
   connectés sur cet onglet, s'il leur est ouvert. */
const envoiOngletBtn=document.createElement('button');envoiOngletBtn.type='button';envoiOngletBtn.className='envoi-onglet';envoiOngletBtn.textContent='⌖';envoiOngletBtn.hidden=true;let envoiOngletPage=null;
envoiOngletBtn.setAttribute('aria-label','Envoyer les joueurs sur cet onglet');tabs.append(envoiOngletBtn);
function majEnvoiOnglet(){const b=tabs.querySelector('button.on[data-page]'),p=b&&b.dataset.page;
 const montre=!!b&&view==='mj'&&typeof estMJ==='function'&&estMJ()&&typeof enLigne!=='undefined'&&enLigne&&ongletsJoueurs().includes(p);
 envoiOngletBtn.hidden=!montre;if(montre){envoiOngletPage=p;envoiOngletBtn.style.left=(b.offsetLeft+b.offsetWidth/2)+'px'}}
envoiOngletBtn.onclick=e=>{e.stopPropagation();if(typeof envoyerOnglet!=='function')return;envoyerOnglet(envoiOngletPage);
 envoiOngletBtn.classList.remove('envoye');void envoiOngletBtn.offsetWidth;envoiOngletBtn.classList.add('envoye')};
window.addEventListener('resize',()=>majEnvoiOnglet());
/* La troupe voit les onglets que le MJ lui ouvre dans les Paramètres — ongletsJoueurs() : la Table
   toujours, les Cartes jamais. Tout ce qui s'y modifie reste au MJ — voir « vue-joueur » dans editor.css. */
function majOnglets(){majEnvoiOnglet();const ouverts=ongletsJoueurs();{const cv=$('conversion-ouvre');if(cv)cv.hidden=view!=='mj'}tabs.querySelectorAll('button[data-page]').forEach(b=>{b.hidden=view!=='mj'&&!ouverts.includes(b.dataset.page);
  // v0.925 : chez le MJ, les onglets ouverts aux joueurs en vert pâle.
  b.classList.toggle('ouvert-joueurs',view==='mj'&&ouverts.includes(b.dataset.page))});
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
 tabs.querySelectorAll('button[data-page]').forEach(b=>b.classList.toggle('on',b.dataset.page===p));majEnvoiOnglet();
 // v1.059 : rechargée, la page rouvre la carte qu'on éditait — l'appareil s'en souvient —, sinon celle de la table.
 if(p==='maps'){if(!maps.length)newMap();if(!mapDraft){let id='';try{id=localStorage.getItem('amertume-carte-editee')||''}catch(e){}mapDraft=maps.find(m=>m.id===id)||maps.find(m=>m.id===currentMapId)||maps[0]}
  // La carte du domaine, si c'est elle qu'on éditait, se rouvre à sa place.
  if(typeof domaineEdite!=='undefined'&&domaineEdite){renderMapList();renderDomaineEditeur()}
  else{measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas()}}
 else if(p==='table'){render();
  // Une approche demandée pendant que la carte était masquée — une nouvelle carte, chez un joueur — se fait au retour.
  if(typeof approcheEnAttente!=='undefined'&&approcheEnAttente){const a=actors.find(x=>x.id===approcheEnAttente);approcheEnAttente=null;if(a)approcherToken(a)}}
 else if(p==='domaine')renderDomaine();
 else if(p==='accueil')renderAccueil();
 else if(p==='heroes')renderHeroes();
 else if(p==='talents')renderTalents();
 else if(p==='armory')renderArmory();
 else if(p==='bestiary')renderBestiary();
 else if(p==='icones')renderIcones();
 else if(p==='settings')renderSettings();
 // v0.924 : les Règles, tirées du moteur à chaque ouverture.
 else if(p==='regles'){if(typeof renderRegles==='function')renderRegles()}
 // De retour sur la table, tout est remesuré : la carte était masquée, donc sans largeur,
 // et les socles comme le brouillard se calculent sur cette largeur.
 else{applyMapRatio();applyMapZoom();render()}}
tabs.querySelectorAll('button[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));

/* ---------- Page de l'éditeur ---------- */
const mapsPage=document.createElement('main');mapsPage.id='maps-page';
mapsPage.innerHTML=
 '<aside class="maps-side panel"><h2>Cartes</h2><div id="map-list"></div>'
 +'<div class="side-actions"><button id="map-new" class="primary">+ Nouvelle carte</button><button id="map-copy">Dupliquer</button><button id="map-del">Supprimer</button></div>'
 +'<div class="divider"></div><h2>Paysages</h2><div id="paysage-list"></div><div class="side-actions"><button id="paysage-new" class="primary">+ Nouveau paysage</button><button id="paysage-del" hidden>Supprimer</button></div>'
 +'<div class="divider"></div><h2>Sauvegarde</h2>'
 +'<div class="side-actions"><button id="map-export">⇩ Exporter</button><button id="map-import">⇧ Importer</button></div>'
 +'<input type="file" id="map-json" accept="application/json,.json" hidden></aside>'
 +'<section class="maps-main panel"><div class="maps-bar"><label class="grow">Nom de la carte<input id="map-name" maxlength="80"></label><label class="map-code">Code<input id="map-code" maxlength="24"></label><label>Lieu<select id="map-lieu"></select></label><label>Bâtiment<select id="map-batiment"></select></label><label class="field-check map-jcj" title="Les aventuriers s’y affrontent : chacun est neutre, ennemi de tous ; pas d’XP sur cette carte."><input type="checkbox" id="map-jcj">PvP</label><span class="map-xp" id="map-xp"></span>'
 +'<button id="map-image">Image de fond</button><button id="map-image-clear">Retirer l’image</button><button id="map-play" class="primary">Ouvrir la Carte</button><button id="map-progression" hidden>Effacer la progression</button><button id="paysage-play" class="primary">Afficher le paysage</button></div>'
 +'<input type="file" id="map-file" accept="image/png,image/jpeg,image/webp" hidden>'
 +'<div class="tool-bar" id="map-tools"><button data-tool="select">Sélection</button><button data-tool="wall">Zone de blocage</button>'
 +'<button data-tool="ligne">Ligne de blocage</button><button data-tool="cadre">Carré de blocage</button><button data-tool="pinceau">Pinceau de blocage</button><button data-tool="blocagelibre">Blocage libre</button><button data-tool="courbe">Ligne de points</button>'
 +'<button data-tool="cut">Découper</button><button data-tool="lasso">Découpe libre</button><button data-tool="gomme">Pinceau de découpe</button>'
 +'<select id="pinceau-taille" aria-label="Grosseur du pinceau" hidden><option value=".3">Pinceau fin</option><option value=".55" selected>Pinceau moyen</option><option value="1">Pinceau large</option></select>'
 +'<span class="bar-sep"></span><button data-tool="obscur">Obscurité</button><button data-tool="obscurlibre">Obscurité libre</button><button data-tool="obscurremplir">Remplir d’obscurité</button><button data-tool="obscurgomme">Gomme d’obscurité</button><span class="bar-sep"></span>'
 +'<button data-tool="imprat">Impraticable</button><button data-tool="impratlibre">Impraticable libre</button><button data-tool="impratligne">Ligne impraticable</button><button data-tool="impratcourbe">Ligne de points</button><button data-tool="impratcadre">Carré impraticable</button><button data-tool="impratgomme">Gomme d’impraticable</button><span class="bar-sep"></span>'
 +'<button data-tool="diffi">Difficile</button><button data-tool="diffilibre">Difficile libre</button><button data-tool="diffiligne">Ligne difficile</button><button data-tool="difficadre">Carré difficile</button><button data-tool="diffigomme">Gomme de difficile</button><span class="bar-sep"></span>'
 +'<button data-tool="danger">Dangereux</button><button data-tool="dangerlibre">Dangereux libre</button><button data-tool="dangerligne">Ligne dangereuse</button><button data-tool="dangergomme">Gomme de dangereux</button>'
 +'<select id="map-danger-type" aria-label="Type de terrain dangereux"></select><button id="map-danger-edit" type="button">✎ Type</button><span class="bar-sep"></span>'
 +'<button data-tool="door">Porte</button><button data-tool="secret">Passage secret</button><button data-tool="fenetre">Fenêtre</button><button data-tool="start">Zone de départ</button>'
 +'<button data-tool="foestandard">Standard</button><button data-tool="foealpha">Élite</button><button data-tool="foesolitaire">Solitaire</button><button data-tool="foeboss">Boss</button><select id="map-foe-tpl" aria-label="Modèle d’adversaire"></select>'
 +'<button data-tool="pnj">PNJ</button><select id="map-pnj-tpl" aria-label="Modèle de PNJ"></select>'
 +'<button data-tool="objet">+ Objet</button><button data-tool="indice">Indice</button><button data-tool="ressource">Ressource</button><button data-tool="coffre">Coffre</button><button data-tool="coffrerond">Coffre rond</button><button data-tool="coffregroupe">Coffre de groupe</button><button data-tool="lumiere">Lumière</button><button data-tool="piege">Piège</button><button data-tool="notemj">Note de MJ</button>'
 +'<span class="bar-sep"></span><button data-tool="zones">Zones</button><button data-tool="separer">Séparer les zones</button><button data-tool="regrouper">Regrouper les zones</button>'
 +'<span class="bar-sep"></span><button id="map-aimant" type="button" aria-pressed="false">🧲 Aimant</button><button id="undo" title="Annuler (⌘Z)">↶ Annuler</button><button id="redo" title="Rétablir (⇧⌘Z)">↷ Rétablir</button>'
 +'<span class="bar-sep"></span><button id="czoom-out" aria-label="Dézoomer">−</button><span id="czoom-label" class="muted">100 %</span>'
 +'<button id="czoom-in" aria-label="Zoomer">+</button><button id="czoom-reset">Ajuster</button><button id="czoom-largeur">Largeur</button></div>'
 +'<div class="canvas-wrap"><div id="map-canvas"></div></div><p class="muted" id="map-hint"></p></section>'
 +'<aside class="maps-props panel"><h2>Forme sélectionnée</h2><p class="muted" id="shape-label">Aucune sélection.</p>'
 +'<button id="shape-lock" hidden>🔒 Verrouiller</button>'
  +'<label id="door-key-label" hidden><input type="checkbox" id="door-key"> Verrouillée — le MJ seul l’ouvre</label>'
  +'<label id="door-fenetre-label" hidden>État de la fenêtre <select id="door-fenetre"><option value="ouverte">Ouverte</option><option value="fermee">Fermée</option><option value="verrouillee">Verrouillée</option></select></label>'
  +'<label id="door-secret-label" hidden><input type="checkbox" id="door-secret"> Passage secret — un mur pour la troupe tant qu’il est clos</label>'
  +'<label id="door-perception-label" hidden>Réussites de Perception pour le trouver <input type="number" id="door-perception" min="1" max="9"></label>'
  +'<label id="door-pierre-label" hidden><input type="checkbox" id="door-pierre"> Dans la pierre</label>'
  +'<label id="door-crochet-label" hidden>Réussites de Ruse pour la crocheter <input type="number" id="door-crochet" min="1" max="9"></label>'
  +'<label id="foe-cache-label" hidden><input type="checkbox" id="foe-cache"> Caché — le MJ le révèle d’un clic en jeu</label>'
  +'<button id="foe-objets" hidden>✎ Objets portés</button>'
  +'<label id="foe-quete-label" hidden>Quête débloquée au contact <select id="foe-quete"></select></label>'
  +'<label id="door-cle-label" hidden>Clé qui l’ouvre <select id="door-cle"></select></label>'
  +'<button id="coffre-edit" hidden>✎ Modifier le coffre</button><button id="coffre-double" hidden>⧉ Dupliquer le coffre</button>'
  +'<button id="piege-edit" hidden>✎ Modifier le piège</button><button id="piege-double" hidden>⧉ Dupliquer le piège</button>'
 +'<button id="objet-edit" hidden>✎ Modifier l’objet</button><button id="lumiere-edit" hidden>✎ Modifier la lumière</button><button id="lumiere-double" hidden>⧉ Dupliquer la lumière</button><button id="notemj-edit" hidden>✎ Modifier la note</button><button id="shape-double" hidden>⧉ Dupliquer</button>'
 +'<button id="shape-delete" hidden>Supprimer la forme</button>'+'<div class="divider"></div><h2 id="echelle-titre">Échelle de la carte</h2>'+'<p class="muted" id="echelle-info"></p>'+'<p class="muted">Le socle témoin se promène sur la carte : pose-le contre une porte, un lit, un couloir, et tire son coin jusqu’à ce qu’un combattant y tienne. Il ne paraît jamais en partie.</p>'+'<button id="echelle-reset">Rétablir la mesure d’origine</button>'+'<div class="divider"></div><h2>Légende</h2>'
 +'<ul class="legend"><li><i class="sw-wall"></i>Zone de blocage — coupe la vue et le passage</li>'+'<li><i class="sw-ligne"></i>Ligne de blocage — la même chose, d’un seul trait fin</li>'
 +'<li><i class="sw-cut"></i>Découper — ouverture rectangulaire dans les zones de blocage</li>'+'<li><i class="sw-cut"></i>Découpe libre — contour tracé ou point par point, pour les formes rondes</li>'
 +'<li><i class="sw-door"></i>Porte — close au début du combat, ouverte d’un clic en jeu</li>'+'<li><i class="sw-key"></i>Porte verrouillée — le MJ seul peut l’ouvrir</li>'+'<li><i class="sw-secret"></i>Passage secret — un mur pour la troupe tant qu’il est clos</li>'
 +'<li><i class="sw-start"></i>Zone de départ des aventuriers</li>'
 +'<li><i class="sw-wall"></i>Pinceau de blocage — de la matière peinte à main levée</li>'+'<li><i class="sw-wall"></i>Blocage libre — contour tracé ou point par point, pour les formes rondes</li>'
 +'<li><i class="sw-cut"></i>Pinceau de découpe — la même chose en négatif, il gratte</li>'
 +'<li><i class="sw-obscur"></i>Obscurité — dans le noir, on ne voit que sa zone de contact, ce qui est éclairé, ou jusqu’où porte sa vision dans le noir</li>'
 +'<li><i class="sw-imprat"></i>Impraticable — un terrain qu’on ne traverse pas ; la vue passe, et la troupe ne le voit pas</li>'
 +'<li><i class="sw-diffi"></i>Difficile — chaque mètre parcouru dedans en coûte deux ; tout le monde le voit</li>'
 +'<li><i class="sw-lumiere"></i>Lumière — une torche, une lampe, un feu : elle repousse le noir en rond ; l’objet qu’elle contient se prend, et elle s’éteint</li>'
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
document.addEventListener('keydown',e=>{if(editeDomaine()||!courbe||!document.body.classList.contains('page-maps'))return;
 if(e.key==='Enter'){e.preventDefault();appliqueCourbe()}else if(e.key==='Escape'){e.preventDefault();courbe=null;renderCanvas()}});
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
function newPaysage(){const m={id:crypto.randomUUID(),name:'Paysage '+(maps.filter(estPaysage).length+1),image:null,ratio:16/9,fitted:true,paysage:true,fogOff:true,
 matiere:[],doors:[],start:null,foes:[],objets:[],coffres:[],echelle:{x:8,y:8,t:SOCLE_DEFAUT}};
 maps.push(m);mapDraft=m;mapSel=null;undoStack=[];redoStack=[];return m}
/* Afficher un paysage : la table le montre à la place de sa carte. La carte reste telle quelle, socles, portes et brouillard,
   et revient quand le MJ ferme le paysage. */
function montreCarte(m){currentMapId=m?m.id:null;mapImage=m&&m.image||null;
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);
 fogSeen=null;fogSeenSrc=null;fogKey='';if(m)measureRatio(m,render);resetMapZoom();refreshMapPick();render()}
function afficherPaysage(id){const p=maps.find(m=>m&&m.id===id&&estPaysage(m));if(!p)return;const avant=currentMap();
 if(avant!==p){if(estPaysage(avant)){p.retour=avant.retour||null;delete avant.retour}else p.retour=currentMapId||null}
 montreCarte(p);showPage('table');scheduleSave()}
function fermerPaysage(){const p=currentMap();if(!estPaysage(p))return;const r=maps.find(m=>m&&m.id===p.retour&&!estPaysage(m));delete p.retour;
 montreCarte(r||null);scheduleSave()}
function newMap(){const m={id:crypto.randomUUID(),name:'Carte '+(maps.length+1),image:null,ratio:16/9,fitted:true,matiere:[],doors:[],start:null,foes:[],objets:[],coffres:[],echelle:{x:8,y:8,t:SOCLE_DEFAUT}};
 maps.push(m);mapDraft=m;mapSel=null;undoStack=[];redoStack=[];return m}
function ensure(m){m.doors??=[];m.foes??=[];m.ratio??=16/9;
 // L'obscurité est née en v0.591 : une seconde matière, qui ne bloque rien. Les lumières, en v0.592.
 m.obscurite??=[];m.impraticable??=[];m.lumieres??=[];m.lumieres.forEach(l=>{l.id||=crypto.randomUUID();l.items??=[];l.rayon=Math.max(.5,Math.min(40,Number(l.rayon)||3))});m.difficile??=[];
 // Les zones séparées, regroupées ou nommées par le MJ : nées en v0.252.
 m.zonesCoupures??=[];m.zonesLiens??=[];m.zonesNoms??=[];
 // Les objets sont nés en v0.144 ; chacun porte un identifiant, la table s'y réfère.
 m.objets??=[];m.objets.forEach(o=>{o.id||=crypto.randomUUID();o.test??={comp:3,reussites:1};o.items??=[]});
 // Les coffres sont nés en v0.502.
 m.coffres??=[];m.coffres.forEach(c=>{c.id||=crypto.randomUUID();c.items??=[];c.richesses??={};c.etats??=[]});
 // Les pièges sont nés en v0.615, avec leurs déclencheurs.
 m.pieges??=[];m.pieges.forEach(p=>{p.id||=crypto.randomUUID();p.declencheurs??=[];p.declencheurs.forEach(d=>{d.id||=crypto.randomUUID()});p.etats??=[];p.caracs??=[];p.detection??={comp:3,reussites:1};if(p.contact===undefined)p.contact=true;if(p.actif&&!p.enjambement)p.enjambement={comp:0,reussites:1}});
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
$('map-batiment').onchange=()=>{if(!mapDraft)return;const v=$('map-batiment').value;if(v)mapDraft.batiment=v;else delete mapDraft.batiment;saveMaps()};
$('map-lieu').onchange=()=>{const s=$('map-lieu');if(!mapDraft)return;
 if(s.value==='*'){const n=prompt('Nom du nouveau lieu :','');if(n&&n.trim())poseLieuCarte(mapDraft,n);else renderMapList();return}
 poseLieuCarte(mapDraft,s.value)};
/* v1.108 — Carte PvP : une case de la carte ; les aventuriers s'y affrontent, sans XP à gagner. */
$('map-jcj').onchange=()=>{if(!mapDraft)return;if($('map-jcj').checked)mapDraft.jcj=true;else delete mapDraft.jcj;jcjMemo.t=0;renderMapList();saveMaps();if(typeof render==='function')render()};
let jcjMemo={t:0,v:false};
// La carte sur la table est-elle PvP ? Relue au plus toutes les 300 ms : le camp de chacun se demande à chaque instant.
function carteJcJ(){const n=performance.now();if(n-jcjMemo.t>300){const m=typeof currentMap==='function'?currentMap():null;jcjMemo={t:n,v:!!(m&&m.jcj===true)}}return jcjMemo.v}
// v1.110 : le code d'une carte, celui que lit la liste de l'éditeur.
$('map-code').oninput=()=>{if(!mapDraft)return;const v=$('map-code').value.trim().slice(0,24);if(v)mapDraft.code=v;else delete mapDraft.code;renderMapList();saveMaps()};
$('map-name').oninput=()=>{if(mapDraft){mapDraft.name=$('map-name').value;renderMapList();saveMaps()}};
/* Sauvegarde des couches : le fichier se suffit à lui-même, image comprise, et il
   revient toujours en cartes neuves — on ne remplace jamais ce qui est là. */
$('map-export').onclick=()=>{
 // v1.173 : les Notes de MJ de chaque carte partent avec elle, rang pour rang ; le fichier reste celui du MJ.
 const paquet=packMaps(maps);if(view==='mj'&&maps.some(m=>(notesMJ.cartes[String(m.id)]||[]).length))paquet.notesMJ=maps.map(m=>notesMJ.cartes[String(m.id)]||[]);
 const blob=new Blob([JSON.stringify(paquet)],{type:'application/json'});
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
  let notesFichier=[];try{const o=JSON.parse(String(lecteur.result));notesFichier=o&&Array.isArray(o.notesMJ)&&view==='mj'?o.notesMJ:[]}catch(e){}
  entrantes.forEach((m,i)=>{m.id=crypto.randomUUID();m.name+=' (importée)';maps.push(m);
   const n=Array.isArray(notesFichier[i])?normaliseNotesMJ({cartes:{x:notesFichier[i]}}).cartes.x:null;if(n&&n.length)notesMJ.cartes[m.id]=n});
  if(notesFichier.length)sauveNotesMJ();
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
function majBoutonProgression(){const b=$('map-progression');if(!b)return;const p=!!(mapDraft&&mapDraft.progression);b.hidden=!p;b.title=p?'Progression enregistrée le '+dateProgression(mapDraft)+' : la carte rouvrira comme au premier jour.':''}
$('map-progression').onclick=()=>{if(!mapDraft||!mapDraft.progression)return;if(confirm('Effacer la progression de « '+mapDraft.name+' » ? Elle rouvrira comme au premier jour.'))effaceProgression(mapDraft)};
$('paysage-play').onclick=()=>{if(estPaysage(mapDraft))afficherPaysage(mapDraft.id)};
$('paysage-new').onclick=()=>{newPaysage();renderMapList();renderCanvas();saveMaps()};
/* v1.032 — Supprimer le paysage sélectionné. Affiché à la table, il se ferme d'abord : la carte d'avant revient. */
$('paysage-del').onclick=()=>{const p=mapDraft;if(!estPaysage(p)||!confirm('Supprimer « '+p.name+' » ?'))return;
 if(currentMapId===p.id)fermerPaysage();const i=maps.indexOf(p);if(i>=0)maps.splice(i,1);
 mapDraft=maps.filter(estPaysage)[0]||maps.find(m=>!estPaysage(m))||null;mapSel=null;undoStack=[];redoStack=[];if(!maps.length)newMap();
 renderMapList();renderCanvas();saveMaps();render()};
document.querySelectorAll('#map-tools [data-tool]').forEach(b=>b.onclick=()=>{mapTool=b.dataset.tool;if(typeOutilAdv(mapTool)){typeAdvChoisi=typeOutilAdv(mapTool);remplitModelesAdv()}if(courbe&&courbe.outil!==mapTool)courbe=null;if(mapTool!=='lasso')lasso=null;
 $('pinceau-taille').hidden=mapTool!=='pinceau'&&mapTool!=='gomme'&&mapTool!=='impratgomme'&&mapTool!=='diffigomme'&&mapTool!=='dangergomme';
 zoneTrait=zoneVise=null;
 // Changer d'outil abandonne le tracé en cours : on ne finit pas un trait à la truelle.
 if(mapTool!=='ligne'&&mapTool!=='impratligne'&&mapTool!=='diffiligne'&&mapTool!=='dangerligne')traitDepart=traitVise=null;
 renderCanvas()});
/* v0.971 : les outils rangés par familles. Une ligne de familles — Sélection, Blocage, Découpe, Obscurité, Impraticable,
   Difficile, Portes et fenêtres, Placement, Zones — puis, dessous, les outils de la famille ouverte. Annuler, Rétablir,
   l'Aimant et le zoom restent sur la première ligne. La famille ouverte se garde sur l'appareil. */
const FAMILLES_OUTILS=[['blocage','Blocage',['wall','ligne','courbe','cadre','pinceau','blocagelibre']],['decoupe','Découpe',['cut','lasso','gomme']],
 ['obscurite','Obscurité',['obscur','obscurlibre','obscurremplir','obscurgomme']],['imprat','Impraticable',['imprat','impratlibre','impratligne','impratcourbe','impratcadre','impratgomme']],
 ['diffi','Difficile',['diffi','diffilibre','diffiligne','difficadre','diffigomme']],['danger','Dangereux',['danger','dangerlibre','dangerligne','dangergomme']],['ouvertures','Portes et fenêtres',['door','secret','fenetre']],
 ['tokens','Tokens',['foestandard','foealpha','foesolitaire','foeboss','pnj']],['placement','Objets',['start','objet','indice','ressource','coffre','coffrerond','coffregroupe','lumiere','piege','notemj']],['zones','Zones',['zones','separer','regrouper']]];
let aimantOn=(()=>{try{return localStorage.getItem('amertume-aimant')==='1'}catch(e){return false}})();
let familleOuverte=(()=>{try{const f=localStorage.getItem('amertume-famille-outils');return FAMILLES_OUTILS.some(x=>x[0]===f)?f:'blocage'}catch(e){return 'blocage'}})();
{const barre=$('map-tools');if(barre&&!barre.querySelector('.familles-outils')){
 const tete=document.createElement('div');tete.className='familles-outils';
 const outil=k=>barre.querySelector('[data-tool="'+k+'"]');
 tete.append(outil('select'));
 const corps=[];
 FAMILLES_OUTILS.forEach(([k,nom,outils])=>{const b=document.createElement('button');b.type='button';b.className='famille-outil';b.dataset.famille=k;b.textContent=nom;
  b.onclick=()=>{familleOuverte=k;try{localStorage.setItem('amertume-famille-outils',familleOuverte)}catch(e){}majFamillesOutils()};tete.append(b);
  const r=document.createElement('div');r.className='outils-famille';r.dataset.famille=k;
  outils.forEach(t=>{const o=outil(t);if(!o)return;r.append(o);if(t==='foeboss'&&$('map-foe-tpl'))r.append($('map-foe-tpl'));if(t==='pnj'&&$('map-pnj-tpl'))r.append($('map-pnj-tpl'));if(t==='dangergomme')['map-danger-type','map-danger-edit'].forEach(id=>{if($(id))r.append($(id))})});
  corps.push(r)});
 const fin=document.createElement('span');fin.className='familles-fin';tete.append(fin);
 ['pinceau-taille','map-aimant','undo','redo','czoom-out','czoom-label','czoom-in','czoom-reset','czoom-largeur'].forEach(id=>{const x=$(id);if(x)tete.append(x)});
 barre.querySelectorAll('.bar-sep').forEach(x=>x.remove());
 [...barre.children].forEach(x=>{if(x!==tete)tete.append(x)});
 const pile=document.createElement('div');pile.className='outils-familles';pile.append(...corps);
 barre.replaceChildren(tete,pile)}}
function majFamillesOutils(){document.querySelectorAll('#map-tools .outils-famille').forEach(r=>{r.hidden=r.dataset.famille!==familleOuverte});
 document.querySelectorAll('#map-tools .famille-outil').forEach(b=>{const f=FAMILLES_OUTILS.find(x=>x[0]===b.dataset.famille);
  b.classList.toggle('ouverte',b.dataset.famille===familleOuverte);b.classList.toggle('contient',!!f&&f[2].includes(mapTool));b.setAttribute('aria-expanded',String(b.dataset.famille===familleOuverte))});
 const ai=$('map-aimant');if(ai){ai.classList.toggle('on',aimantOn);ai.setAttribute('aria-pressed',String(aimantOn))}}
if($('map-aimant'))$('map-aimant').onclick=()=>{aimantOn=!aimantOn;try{localStorage.setItem('amertume-aimant',aimantOn?'1':'0')}catch(e){}majFamillesOutils();if(!aimantOn&&traitVise)traitVise={...traitVise,aimante:false};dessineTraits()};
{const rc=renderCanvas;renderCanvas=function(...x){const r=rc(...x);majFamillesOutils();return r}}
majFamillesOutils();
/* La liste des cartes : le nom seul, sur une ligne ; en vert, celle qui est chargée sur la table.
   Le détail — zones, portes, adversaires, objets — se lit au survol. */
/* Les lieux : des cartes rassemblées sous un même nom — les étages d'une tour, les salles d'un grand lieu. Une carte sans lieu
   reste en tête, comme avant ; chaque lieu a son bandeau, qui se replie, se renomme, et reçoit la carte qu'on y dépose. */
let lieuxReplies=new Set();try{lieuxReplies=new Set(JSON.parse(localStorage.getItem('amertume-lieux-replies')||'[]'))}catch(e){}
/* v1.056 — L'ordre des lieux : le rang que le MJ leur a donné en les glissant (« lieuRang », porté par leurs cartes), puis l'alphabet
   pour ceux qui n'en ont pas. L'ordre des cartes, dans un lieu comme hors des lieux, est celui de la liste des cartes. */
const rangLieu=l=>{const m=maps.find(x=>x&&typeof x.lieu==='string'&&x.lieu.trim()===l&&Number.isFinite(x.lieuRang));return m?m.lieuRang:Infinity};
const lieuxDesCartes=()=>[...new Set(maps.filter(m=>!estPaysage(m)).map(m=>m&&typeof m.lieu==='string'?m.lieu.trim():'').filter(Boolean))].sort((x,y)=>rangLieu(x)-rangLieu(y)||x.localeCompare(y,'fr',{numeric:true}));
function poseLieuCarte(m,lieu){if(!m)return;const l=String(lieu||'').trim().slice(0,60);if(l){m.lieu=l;const r=rangLieu(l);if(Number.isFinite(r))m.lieuRang=r;else delete m.lieuRang}else{delete m.lieu;delete m.lieuRang}renderMapList();saveMaps()}
// Une carte lâchée sur une autre : elle se place juste avant elle, dans son lieu.
function placeCarteAvant(m,cible){if(!m||!cible||m===cible)return;const i=maps.indexOf(m);if(i<0)return;maps.splice(i,1);maps.splice(maps.indexOf(cible),0,m);
 poseLieuCarte(m,cible.lieu||'')}
// Un lieu lâché sur un autre : il passe juste avant lui ; chaque lieu reçoit son rang.
let lieuGlisse=null;
function placeLieuAvant(l,cible){if(!l||!cible||l===cible)return;const ordre=lieuxDesCartes().filter(x=>x!==l);ordre.splice(Math.max(0,ordre.indexOf(cible)),0,l);
 ordre.forEach((x,k)=>maps.forEach(m=>{if(m&&typeof m.lieu==='string'&&m.lieu.trim()===x)m.lieuRang=k}));renderMapList();saveMaps()}
function renommeLieu(ancien){const n=prompt('Nom du lieu :',ancien);if(n===null)return;const l=n.trim().slice(0,60);
 maps.forEach(m=>{if(m&&m.lieu===ancien){if(l)m.lieu=l;else delete m.lieu}});
 if(lieuxReplies.delete(ancien)&&l)lieuxReplies.add(l);try{localStorage.setItem('amertume-lieux-replies',JSON.stringify([...lieuxReplies]))}catch(e){}
 renderMapList();saveMaps()}
let carteGlissee=null;
/* v1.059 — Quand les cartes arrivent d'ailleurs (le contenu partagé, une sauvegarde), la carte éditée se retrouve parmi les nouvelles
   par son identifiant : celle qu'on éditait, ou celle que l'appareil a retenue. */
function rattacheCarteEditee(){if(mapDraft&&maps.includes(mapDraft))return;let id=mapDraft&&mapDraft.id;if(!id)try{id=localStorage.getItem('amertume-carte-editee')||''}catch(e){}
 const avant=mapDraft,m=maps.find(x=>x&&x.id===id);if(m)mapDraft=m;else if(mapDraft)mapDraft=maps.find(x=>x&&x.id===currentMapId)||maps[0]||null;
 if(mapDraft!==avant&&mapDraft&&document.body.classList.contains('page-maps')&&!(typeof domaineEdite!=='undefined'&&domaineEdite)){mapSel=null;measureRatio(mapDraft,renderCanvas);renderMapList();renderCanvas()}}
function renderMapList(){if(mapDraft&&mapDraft.id)try{localStorage.setItem('amertume-carte-editee',mapDraft.id)}catch(e){}
 const rangee=m=>{const b=document.createElement('button');
 b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');
 // v1.110 : la liste lit le code de la carte s'il y en a un — plus court ; le nom reste celui de la table.
 const nom=document.createElement('strong');nom.textContent=m.code||m.name;ensure(m);
 b.title=m.name+(m.id===currentMapId?' — chargée sur la table':'')+'\n'+matiereDe(m).length+' zone(s) · '+m.doors.length+' porte(s) · '+m.foes.length+' adversaire(s)'+((m.objets||[]).length?' · '+m.objets.length+' objet(s)':'');
 b.append(nom);
 // v1.109 : une progression enregistrée se signale d'une pastille, sa date au survol.
 if(m.progression){const s=document.createElement('span');s.className='map-sauve';s.textContent='💾';s.title='Progression enregistrée le '+dateProgression(m);s.setAttribute('aria-label',s.title);nom.prepend(s)}
 b.onclick=()=>{mapDraft=m;mapSel=null;undoStack=[];redoStack=[];measureRatio(m,renderCanvas);renderMapList();renderCanvas()};
  // Elle se glisse sur le bandeau d'un lieu, ou sur la liste hors des lieux pour l'en sortir.
  b.draggable=true;b.addEventListener('dragstart',e=>{carteGlissee=m;try{e.dataTransfer.setData('text/plain',m.id||'');e.dataTransfer.effectAllowed='move'}catch(_){}});
  b.addEventListener('dragend',()=>{carteGlissee=null;document.querySelectorAll('.map-row.avant').forEach(x=>x.classList.remove('avant'))});
  // v1.056 : lâchée sur une autre carte, elle prend sa place, juste avant elle.
  b.addEventListener('dragover',e=>{if(!carteGlissee||carteGlissee===m)return;e.preventDefault();e.stopPropagation();b.classList.add('avant')});
  b.addEventListener('dragleave',()=>b.classList.remove('avant'));
  b.addEventListener('drop',e=>{if(!carteGlissee)return;e.preventDefault();e.stopPropagation();b.classList.remove('avant');const g=carteGlissee;carteGlissee=null;placeCarteAvant(g,m)});return b};
 const recoit=(el,lieu)=>{el.addEventListener('dragover',e=>{if(!carteGlissee)return;e.preventDefault();e.stopPropagation();el.classList.add('survol')});
  el.addEventListener('dragleave',()=>el.classList.remove('survol'));
  el.addEventListener('drop',e=>{if(!carteGlissee)return;e.preventDefault();e.stopPropagation();el.classList.remove('survol');const m=carteGlissee;carteGlissee=null;poseLieuCarte(m,lieu)})};
 const liste=$('map-list');liste.replaceChildren(...maps.filter(m=>!estPaysage(m)&&!(m&&typeof m.lieu==='string'&&m.lieu.trim())).map(rangee));if(!liste.dataset.recoit){liste.dataset.recoit='1';recoit(liste,'')}
 // Les paysages : leur liste à eux, sans lieu ; celui qu'on édite n'a ni outils ni zone de départ.
 {const pl=$('paysage-list');if(pl)pl.replaceChildren(...maps.filter(estPaysage).map(m=>{const b=document.createElement('button');
  b.className='map-row'+(m===mapDraft?' current':'')+(m.id===currentMapId?' live':'');const nom=document.createElement('strong');nom.textContent=m.name;b.append(nom);
  b.onclick=()=>{mapDraft=m;mapSel=null;undoStack=[];redoStack=[];measureRatio(m,renderCanvas);renderMapList();renderCanvas()};return b}))}
 mapsPage.classList.toggle('edition-paysage',estPaysage(mapDraft));if($('paysage-del'))$('paysage-del').hidden=!estPaysage(mapDraft);if(estPaysage(mapDraft))mapTool='select';
 lieuxDesCartes().forEach(l=>{const lot=maps.filter(m=>m&&!estPaysage(m)&&m.lieu&&m.lieu.trim()===l),replie=lieuxReplies.has(l);
  const g=document.createElement('div');g.className='map-lieu'+(replie?' replie':'');
  const tete=document.createElement('div');tete.className='map-lieu-tete';tete.setAttribute('role','button');tete.tabIndex=0;
  const nom=document.createElement('span');nom.className='map-lieu-nom';nom.textContent=(replie?'▸ ':'▾ ')+l;const n=document.createElement('small');n.textContent=lot.length;
  const ren=document.createElement('button');ren.type='button';ren.className='ico';ren.textContent='✎';ren.title='Renommer le lieu';ren.setAttribute('aria-label','Renommer le lieu '+l);
  ren.onclick=e=>{e.stopPropagation();renommeLieu(l)};tete.append(nom,n,ren);
  tete.onclick=()=>{if(lieuxReplies.has(l))lieuxReplies.delete(l);else lieuxReplies.add(l);try{localStorage.setItem('amertume-lieux-replies',JSON.stringify([...lieuxReplies]))}catch(e){}renderMapList()};
  // v1.056 : le bandeau se glisse sur celui d'un autre lieu, et passe juste avant lui.
  tete.draggable=true;tete.addEventListener('dragstart',e=>{lieuGlisse=l;try{e.dataTransfer.setData('text/plain',l);e.dataTransfer.effectAllowed='move'}catch(_){}});
  tete.addEventListener('dragend',()=>{lieuGlisse=null;document.querySelectorAll('.map-lieu-tete.avant').forEach(x=>x.classList.remove('avant'))});
  tete.addEventListener('dragover',e=>{if(!lieuGlisse||lieuGlisse===l)return;e.preventDefault();e.stopPropagation();tete.classList.add('avant')});
  tete.addEventListener('dragleave',()=>tete.classList.remove('avant'));
  tete.addEventListener('drop',e=>{if(!lieuGlisse)return;e.preventDefault();e.stopPropagation();tete.classList.remove('avant');const x=lieuGlisse;lieuGlisse=null;placeLieuAvant(x,l)});
  recoit(g,l);g.append(tete);if(!replie)lot.forEach(m=>g.append(rangee(m)));liste.append(g)});
 // Le lieu de la carte ouverte : aucun, un lieu existant, ou un nouveau.
 // Le bâtiment du domaine dont c'est une carte de combat, s'il en a un.
 {const s=$('map-batiment');if(s){s.replaceChildren(new Option('— aucun —',''),...((typeof domaine!=='undefined'&&domaine.batiments)||[]).map(b=>new Option(b.nom,b.id)));s.value=mapDraft&&mapDraft.batiment||'';s.disabled=!mapDraft}}
 {const s=$('map-lieu');if(s){s.replaceChildren(new Option('— aucun lieu —',''),...lieuxDesCartes().map(l=>new Option(l,l)),new Option('✎ Nouveau lieu…','*'));s.value=mapDraft&&mapDraft.lieu||'';s.disabled=!mapDraft}}
 if(mapDraft)$('map-name').value=mapDraft.name;
 {const c=$('map-code');if(c){c.value=mapDraft&&mapDraft.code||'';c.disabled=!mapDraft;c.placeholder=mapDraft?mapDraft.name.slice(0,24):''}}
 if(typeof majBoutonProgression==='function')majBoutonProgression();
 {const j=$('map-jcj');if(j){j.checked=!!(mapDraft&&mapDraft.jcj===true);j.disabled=!mapDraft}}
 remplitModelesAdv()}
/* v1.070 — La famille Tokens : un outil par Type d'adversaire (Standard, Élite, Solitaire, Boss) et un pour les PNJ. Le menu
   des modèles ne montre que ceux du Type de l'outil choisi, par ordre alphabétique ; celui des PNJ aussi. */
const typeOutilAdv=t=>({foestandard:'standard',foealpha:'alpha',foesolitaire:'solitaire',foeboss:'boss'})[t]||'';
let typeAdvChoisi='standard';
function remplitModelesAdv(){const s=$('map-foe-tpl'),sp=$('map-pnj-tpl');if(!s||!sp)return;const av=s.value,avp=sp.value;
 const tri=l=>l.sort((a,b)=>a[0].name.localeCompare(b[0].name,'fr',{sensitivity:'base'}));
 const tous=catalog.monsters.map((m,i)=>[m,i]).filter(([m])=>m&&m.name);
 s.replaceChildren(...tri(tous.filter(([m])=>!m.pnj&&(m.type||'standard')===typeAdvChoisi)).map(([m,i])=>new Option(m.name,String(i))));
 sp.replaceChildren(...tri(tous.filter(([m])=>m.pnj)).map(([m,i])=>new Option(m.name,String(i))));
 if([...s.options].some(o=>o.value===av))s.value=av;if([...sp.options].some(o=>o.value===avp))sp.value=avp}

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
// v0.971 : l'aimant se coupe et se rallume d'un bouton ; coupé par défaut, le choix se garde sur l'appareil.
function boutAimante(p,ratio){const m=mapDraft;if(!m||!aimantOn)return null;
 const r=Math.max(.05,Number(ratio)||16/9);
 let meilleur=null,court=2.6/Math.max(1,zoomC);
 const test=(x,y)=>{const d=Math.hypot((p.x-x)*r,p.y-y);if(d<court){court=d;meilleur={x,y}}};
 // Les angles de la matière sont autant de points d'accroche : on y ferme une pièce net.
 matiereDe(m).forEach(p=>p.anneaux.forEach(r=>r.forEach(q=>test(q[0],q[1]))));
 if(traitDepart)test(traitDepart.x,traitDepart.y);
 return meilleur}
/* Maj tenu : le trait parfaitement horizontal ou vertical, selon le côté où va le curseur, sans aimant qui le dévierait. */
function traitDroit(a,b,ratio){const r=Math.max(.05,Number(ratio)||16/9);return Math.abs((b.x-a.x)*r)>=Math.abs(b.y-a.y)?{x:b.x,y:a.y}:{x:a.x,y:b.y}}
let traitCurseur=null;
function viseTrait(p,droit,ratio,maj){if(maj&&traitDepart)return traitDroit(traitDepart,p,ratio);const bout=boutAimante(p,ratio);
 return bout?{x:bout.x,y:bout.y,aimante:true}:traitContraint(traitDepart,p,droit,ratio)}
// Maj enfoncée ou relâchée sans bouger : l'aperçu se redresse ou se libère aussitôt.
['keydown','keyup'].forEach(t=>document.addEventListener(t,e=>{if(e.key!=='Shift'||!traitDepart||!traitCurseur||!document.body.classList.contains('page-maps'))return;
 traitVise=viseTrait(traitCurseur,e.metaKey||e.ctrlKey,mapDraft&&mapDraft.ratio,e.type==='keydown');dessineTraits()}));
/* Le contour d'un rectangle, de l'épaisseur d'une ligne de blocage : quatre barres qui se chevauchent aux angles, pour une
   case vide au trait plein. */
function cadreFormes(r,ratio){const e=TRAIT_EPAISSEUR/2,ex=e,ey=e*Math.max(.05,Number(ratio)||16/9),x0=Math.min(r.x,r.x+r.w),x1=Math.max(r.x,r.x+r.w),y0=Math.min(r.y,r.y+r.h),y1=Math.max(r.y,r.y+r.h);
 return [{x:x0-ex,y:y0-ey,w:x1-x0+2*ex,h:2*ey},{x:x0-ex,y:y1-ey,w:x1-x0+2*ex,h:2*ey},{x:x0-ex,y:y0-ey,w:2*ex,h:y1-y0+2*ey},{x:x1-ex,y:y0-ey,w:2*ex,h:y1-y0+2*ey}].map(rectPolygon)}
function annulerTrait(){if(courbe){courbe=null;renderCanvas();return true}if(!traitDepart)return false;traitDepart=traitVise=null;renderCanvas();return true}
/* v0.971 : la Ligne de points — chaque clic pose un point, la courbe passe par tous et s'arrondit (Catmull-Rom) ; un
   double-clic ou Entrée la fond dans la matière, en trait de blocage ouvert ; Échap l'abandonne. */
let courbe=null;
function courbeLissee(pts,ratio){if(pts.length<3)return pts.slice();const r=Math.max(.05,Number(ratio)||16/9),out=[];
 const P=pts.map(p=>({x:p.x*r,y:p.y})).filter((p,i,a)=>!i||Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y)>1e-6);if(P.length<3)return pts.slice();
 // v0.973 : un point où le tracé tourne de plus de 60° est un angle net ; la courbe ne lisse qu'entre deux angles.
 const coin=i=>{const a=P[i-1],b=P[i],c=P[i+1],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y};
  return (u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y))<Math.cos(Math.PI/3)};
 const morceaux=[];let deb=0;for(let i=1;i<P.length-1;i++)if(coin(i)){morceaux.push(P.slice(deb,i+1));deb=i}morceaux.push(P.slice(deb));
 // Catmull-Rom centripète : elle passe par chaque point sans boucler ni déborder, même aux points serrés.
 const lisse=Q=>{const R=[];if(Q.length<3){Q.forEach((q,i)=>{if(i<Q.length-1)R.push(q)});return R}
  const ext=(a,b)=>({x:2*a.x-b.x,y:2*a.y-b.y}),at=i=>i<0?ext(Q[0],Q[1]):i>=Q.length?ext(Q[Q.length-1],Q[Q.length-2]):Q[i];
  const L=(m,n,ta,tb,t)=>tb-ta<1e-9?m:{x:(tb-t)/(tb-ta)*m.x+(t-ta)/(tb-ta)*n.x,y:(tb-t)/(tb-ta)*m.y+(t-ta)/(tb-ta)*n.y};
  for(let i=0;i<Q.length-1;i++){const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2),d=(m,n)=>Math.max(1e-6,Math.sqrt(Math.hypot(n.x-m.x,n.y-m.y)));
   const t0=0,t1=t0+d(p0,p1),t2=t1+d(p1,p2),t3=t2+d(p2,p3),n=Math.max(4,Math.ceil(Math.hypot(p2.x-p1.x,p2.y-p1.y)/.8));
   for(let k=0;k<n;k++){const t=t1+(t2-t1)*k/n,A1=L(p0,p1,t0,t1,t),A2=L(p1,p2,t1,t2,t),A3=L(p2,p3,t2,t3,t),B1=L(A1,A2,t0,t2,t),B2=L(A2,A3,t1,t3,t);R.push(L(B1,B2,t1,t2,t))}}
  return R};
 morceaux.forEach(Q=>lisse(Q).forEach(q=>out.push({x:q.x/r,y:q.y})));
 out.push(pts[pts.length-1]);return out}
// v1.063 : la même, en terrain impraticable (« impratcourbe »).
function appliqueCourbe(){if(!courbe||!mapDraft)return;const pts=courbeLissee(courbe.pts,mapDraft.ratio),imprat=courbe.outil==='impratcourbe';courbe=null;
 if(pts.length<2){renderCanvas();return}pushUndo();const formes=[];
 for(let i=1;i<pts.length;i++){const f=capsulePolygon(pts[i-1],pts[i],TRAIT_EPAISSEUR,mapDraft.ratio,6);if(f)formes.push(f)}
 if(imprat){if(formes.length)ajouteImpraticable(mapDraft,formes)}else formes.forEach(f=>ajouteMatiere(mapDraft,f));
 matiereChangee()}
const HINTS={courbe:'Chaque clic pose un point : la ligne de blocage passe par tous et s’arrondit. Double-clic ou Entrée la termine, Échap l’abandonne.',
 impratcourbe:'Chaque clic pose un point : la ligne impraticable passe par tous et s’arrondit. Double-clic ou Entrée la termine, Échap l’abandonne.',
 fenetre:'Glisse pour poser une fenêtre sur un mur, comme une porte. Elle ne se traverse pas et on ne tire pas à travers ; ouverte, elle laisse voir et fait entrer la lumière dans l’obscurité. Son état se choisit à droite.',
 select:'Clique une zone de blocage, une porte ou un adversaire pour le sélectionner, glisse pour le déplacer, tire un coin pour le redimensionner. ⌘Z annule.',
 wall:'Trace un rectangle de blocage : il coupe la vue et le passage, et fond avec la matière qu’il touche. Suppr efface la sélection.',
 ligne:'Un clic pose l’origine du trait, un second l’arrête. ⌘ (ou Ctrl) le redresse à l’horizontale, à la verticale ou à quarante-cinq degrés. Maj le tient parfaitement horizontal ou vertical, et au second clic pose un point d’appui : le trait s’arrête là et le suivant en repart, de quoi longer une salle entière sans relever la main. Près d’une extrémité déjà posée, le tracé s’y aimante — une pastille verte le dit — et le carré se ferme juste. Échap abandonne.',
 cut:'Trace un rectangle dans la matière : la découpe y creuse exactement ce rectangle, vue et passage rétablis.',
 lasso:'Contourne la forme à creuser : glisse pour tracer à main levée, ou clique point par point. La découpe suit exactement ton tracé. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 blocagelibre:'Contourne la forme à bloquer : glisse pour tracer à main levée, ou clique point par point. Le blocage suit exactement ton tracé. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 door:'Trace une porte : elle perce d’elle-même la matière qu’elle recouvre, et le mur se referme si tu la déplaces. Sélectionne-la et tire sa poignée ronde pour la tourner — pour une porte de biais. Maj tourne par crans de quinze degrés. Close à chaque ouverture de la carte, elle s’ouvre d’un clic en partie — sauf si tu la verrouilles, auquel cas le MJ seul la manœuvre.',
 secret:'Trace un passage secret à même le mur — et tourne-le par sa poignée ronde s’il est de biais : tant qu’il est clos, il ne perce rien et la troupe ne voit qu’un mur — toi seul le devines à son trait violet, et toi seul l’ouvres. Ouvert, il devient une porte comme une autre.',
 start:'Trace la zone où les aventuriers seront regroupés à l’ouverture de la carte. Une seule par carte.',
 pinceau:'Glisse pour peindre de la matière à main levée, comme au feutre. Le trait se fond dans les zones qu’il touche. Sa grosseur se choisit à côté, en fraction de socle : elle suit donc l’échelle de la carte.',
 gomme:'Glisse pour gratter la matière, comme à la gomme. Ce qui est verrouillé résiste. Sa grosseur se choisit à côté.',
 obscur:'Trace un rectangle d’obscurité : tout ce qu’il couvre est plongé dans le noir, et il fond avec l’obscurité qu’il touche.',
 obscurlibre:'Contourne la zone à plonger dans le noir : glisse pour tracer à main levée, ou clique point par point. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 obscurremplir:'Clique dans une zone : toute la zone — telle que la découpent les murs, les portes et les séparations, et que la réunissent les regroupements — devient noire d’un coup.',
 imprat:'Trace un rectangle de terrain impraticable : personne ne le traverse, la vue passe, et la troupe ne le voit pas.',
 cadre:'Trace un rectangle dont seul le contour bloque, de l’épaisseur d’une ligne : une case vide.',
 impratcadre:'Trace un rectangle dont seul le contour est impraticable, de l’épaisseur d’une ligne : une case vide.',
 impratlibre:'Contourne le terrain impraticable : glisse pour tracer à main levée, ou clique point par point. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 impratligne:'Un trait impraticable : premier clic, origine ; second clic, arrivée. Maj le tient horizontal ou vertical et enchaîne le trait suivant depuis le bout.',
 impratgomme:'Gomme le terrain impraticable sous le pinceau, à main levée.',
 diffi:'Trace un rectangle de terrain difficile : chaque mètre parcouru dedans en coûte deux, et tout le monde le voit.',
 difficadre:'Trace un rectangle dont seul le contour est difficile, de l’épaisseur d’une ligne.',
 diffilibre:'Contourne le terrain difficile : glisse pour tracer à main levée, ou clique point par point. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 diffiligne:'Un trait difficile : premier clic, origine ; second clic, arrivée. Maj le tient horizontal ou vertical et enchaîne le trait suivant depuis le bout.',
 diffigomme:'Gomme le terrain difficile sous le pinceau, à main levée.',
 obscurgomme:'Contourne l’obscurité à effacer : glisse pour tracer à main levée, ou clique point par point. Entrée ou un clic sur le premier point ferme le tracé, Échap l’abandonne.',
 coffre:'Trace un coffre comme une porte : sa fiche s’ouvre aussitôt — nom, description, caché ou non, verrou, piège et contenu. La poignée ronde le fait tourner.',
 lumiere:'Clique pour poser une lumière — torche au mur, lampe, feu — et régler son nom, sa portée en mètres et l’objet qu’elle contient. Tire sa poignée pour agrandir son halo. Un aventurier au contact prend l’objet d’un clic, et la lumière s’éteint.',
 coffrerond:'Trace un coffre rond : un tonneau, une urne, un nid. Sa fiche s’ouvre aussitôt ; la poignée ronde le fait tourner.',
 piege:'Trace un piège à la taille voulue : sa fiche s’ouvre aussitôt — apparence, détection, déclenchement, parades et effets.',
 piegezone:'Trace la zone qui déclenche le piège : un combattant qui y entre le fait partir.',
 piegebloc:'Trace la hitbox du piège : un rectangle à part de son icône, qu’on étire en travers du passage. Tant qu’un aventurier ne l’a pas enjambé, il ne traverse pas ; caché, le piège part dès qu’on la touche.',
 piegefil:'Tire le fil qui déclenche le piège, d’un bout à l’autre : un combattant qui le touche le fait partir.',
 foe:'Clique pour poser l’adversaire choisi à droite de la barre. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
 foestandard:'Clique pour poser l’adversaire Standard choisi à droite. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
 foealpha:'Clique pour poser l’adversaire Élite choisi à droite. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
 foesolitaire:'Clique pour poser l’adversaire Solitaire choisi à droite. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
 foeboss:'Clique pour poser le Boss choisi à droite. Pour le rendre invisible, donne-lui l’état Invisible en jeu.',
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
 // Un paysage se voit en entier : jamais zoomé dans l'éditeur, où il n'a pas de bouton pour s'ajuster.
 if(estPaysage(m)&&zoomC!==1){zoomC=1;panCX=panCY=0}
 c.replaceChildren();sizeCanvas();applyCanvasZoom();majEchelle();if(!m)return;ensure(m);
 /* La matière est peinte d'un seul tenant, percée de ses portes : l'éditeur montre le
    mur du jeu. Pendant qu'on déplace une zone, elle se peint à part, par-dessus : deux
    contours superposés se liraient sinon comme un trou, le temps du geste. */
 const contours=draftSkin(m);
 const bouge=mapDrag&&mapDrag.mode==='masse'?matiereDe(m)[mapDrag.i]:null;
 const fixes=bouge?contours.filter(r=>!bouge.anneaux.includes(r)):contours;
 if(fixes.length||bouge)c.append(svgMatiere([fixes,bouge?bouge.anneaux:[]],null,'wall-skin'));
 // L'obscurité, en voile sombre par-dessus : la pièce reste lisible dessous.
 {const obs=obscuriteDe(m);if(obs.length)c.append(svgMatiere([obs.flatMap(p=>p.anneaux)],null,'obscur-skin'))}
 // Le terrain impraticable, en pointillés rouges.
 {const imp=impraticableDe(m);if(imp.length)c.append(svgMatiere([imp.flatMap(p=>p.anneaux)],null,'imprat-skin'))}
 // Le terrain difficile, en hachures ocre.
 {const dif=difficileDe(m);if(dif.length)c.append(svgMatiere([dif.flatMap(p=>p.anneaux)],null,'diffi-skin'))}
 // v1.014 : le terrain dangereux, chaque type à sa couleur.
 dangersDe(m).forEach(t=>{if(!(t.formes||[]).length)return;const s=svgMatiere([t.formes.flatMap(p=>p.anneaux)],null,'danger-skin');s.style.color=t.couleur;c.append(s)});
 c.style.backgroundImage=m.image?'url("'+m.image+'")':'';c.classList.toggle('no-image',!m.image);
 m.doors.forEach((r,i)=>c.append(shapeEl('door',i,r)));
 m.coffres.forEach((r,i)=>c.append(shapeEl('coffre',i,r)));
 (m.pieges||[]).forEach((r,i)=>c.append(shapeEl('piege',i,r),...declencheursEl(i,r)));
 // L'aperçu du rectangle en cours — bloc ou découpe — tant que la main n'a pas lâché.
 if(cutRect){const el=shapeEl(cutRect.diffi||cutRect.danger?'diffi':cutRect.imprat?'imprat':cutRect.obscur?'obscur':cutRect.bloc?'bloc':'cut',0,cutRect);if(cutRect.cadre)el.classList.add('cadre');c.append(el)}
 if(lasso&&lasso.pts.length){const svg=document.createElementNS(nsSVG,'svg');svg.setAttribute('class','lasso-layer'+(lasso.mode==='obscurlibre'?' obscur':lasso.mode==='obscurgomme'?' obscur-gomme':lasso.mode==='blocagelibre'?' bloc':lasso.mode==='impratlibre'?' imprat':lasso.mode==='diffilibre'?' diffi':''));
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
 {const formes=mapShapes(m).formes;(m.lumieres||[]).forEach((l,i)=>c.append(lumiereEl(i,l,formes)))}
 // Le socle témoin par-dessus tout le reste : c'est lui qu'on vient comparer.
 const jauge=echelleEl();if(jauge)c.append(jauge);
 dessineTraits();dessineZonesEditeur();
 // La zone choisie, éclairée d'un bloc, et sa boîte de manœuvre par-dessus.
 const masse=polygoneSel();
 if(masse){c.append(svgSelection(masse));const boite=boiteSelection(masse);if(boite)c.append(boite)}
 const cible=mapSel?shapeAt(mapSel):null;
 const adv=mapSel&&mapSel.kind==='foe'?cible:null,porte=mapSel&&mapSel.kind==='door'?cible:null;
 const obj=mapSel&&mapSel.kind==='objet'?cible:null;$('objet-edit').hidden=!obj;
 const lum=mapSel&&mapSel.kind==='lumiere'?cible:null;$('lumiere-edit').hidden=$('lumiere-double').hidden=!lum;
 const coffre=mapSel&&mapSel.kind==='coffre'?cible:null;$('coffre-edit').hidden=$('coffre-double').hidden=!coffre;
 const piege=mapSel&&mapSel.kind==='piege'?cible:null;$('piege-edit').hidden=$('piege-double').hidden=!piege;
 const piegeDuDecl=mapSel&&mapSel.kind==='declencheur'?(m.pieges||[])[mapSel.i]:null;
 $('door-cle-label').hidden=!(porte&&porte.keyLocked);if(porte&&porte.keyLocked)remplitCles($('door-cle'),porte.cleId||'');
 $('door-key-label').hidden=$('door-secret-label').hidden=!porte||!!porte.fenetre;
 if(porte){$('door-key').checked=!!porte.keyLocked;$('door-secret').checked=!!porte.secret}
 $('door-fenetre-label').hidden=!(porte&&porte.fenetre);if(porte&&porte.fenetre)$('door-fenetre').value=etatFenetre(porte);
 $('door-perception-label').hidden=!(porte&&porte.secret);if(porte&&porte.secret)$('door-perception').value=Number(porte.perception)||1;
 $('door-pierre-label').hidden=!(porte&&porte.secret);if(porte&&porte.secret)$('door-pierre').checked=porte.pierre===true;
 $('door-crochet-label').hidden=!(porte&&porte.keyLocked);if(porte&&porte.keyLocked)$('door-crochet').value=difficultePorte(porte);
 $('foe-cache-label').hidden=$('foe-objets').hidden=!adv;if(adv)$('foe-cache').checked=adv.cache===true;
 // Un PNJ peut débloquer une quête cachée : l'aventurier qui le rejoint au contact la découvre.
 {const pnj=!!adv&&!!(modeleActuel(adv.tpl)||adv.tpl||{}).pnj;$('foe-quete-label').hidden=!pnj;
  if(pnj){const s=$('foe-quete');s.replaceChildren(new Option('— aucune —',''),...((typeof domaine!=='undefined'&&domaine.quetes)||[]).map(q=>new Option(q.titre,q.id)));s.value=adv.quete||''}}
 const verrou=masse?!!masse.verrou:!!(cible&&cible.locked);
 $('shape-delete').hidden=!mapSel||verrou;$('shape-lock').hidden=!mapSel||mapSel.kind==='coupure'||mapSel.kind==='lien';
 if(mapSel)$('shape-lock').textContent=verrou?'🔓 Déverrouiller':'🔒 Verrouiller';
 /* Une masse ne s'annonce pas en morceaux : elle est « la zone de blocage », qu'elle soit
    née d'un rectangle, d'un coup de pinceau ou de vingt gestes mêlés. */
 $('shape-label').textContent=mapSel?(porte&&porte.secret?'Passage secret':adv&&(modeleActuel(adv.tpl)||adv.tpl).pnj?'PNJ':KINDS[mapSel.kind])
  +(adv?' · '+adv.tpl.name+(adv.cache?' · caché':''):'')+(obj?' · '+obj.nom+(obj.visible?'':' · caché'):'')+(lum?' · '+lum.nom+' · '+lum.rayon+' m':'')+(coffre?' · '+coffre.nom+(coffre.cache?' · caché':''):'')+(piege?' · '+piege.nom+(piege.cache?' · caché':''):'')+(piegeDuDecl?' · '+piegeDuDecl.nom:'')+(verrou?' · verrouillée':''):'Aucune sélection.';
 $('map-xp').textContent=(m.jcj===true?0:xpDeCarte(m))+' xp';
 $('map-count').textContent=matiereDe(m).length+' zone(s) de blocage, '+obscuriteDe(m).length+' zone(s) d’obscurité, '+(m.lumieres||[]).length+' lumière(s), '+m.doors.length+' porte(s), '
  +m.foes.length+' adversaire(s), '+m.objets.length+' objet(s), '+m.coffres.length+' coffre(s), '+(m.pieges||[]).length+' piège(s)'+(m.start?', zone de départ définie.':', aucune zone de départ.');
 $('recal-box').hidden=!recalNeeded();
 refreshHistory()}
// Portes, zone de départ et aperçus de tracé sont des boîtes ; la matière, elle, est peinte.
function shapeEl(kind,i,r){const el=document.createElement('div');
 el.className='shape '+kind+(r.locked?' locked':'')+(kind==='door'&&r.keyLocked?' keyed':'')+(kind==='door'&&r.secret?' secret':'')+(kind==='door'&&r.fenetre?' fenetre':'')+(kind==='coffre'&&r.cache?' cache':'')+(kind==='coffre'&&r.rond?' rond':'')+(kind==='piege'&&r.cache?' cache':'')+(kind==='piege'&&r.affichage==='image'&&(r.image||r.logo)?' image-seule':'')
  +(mapSel&&mapSel.kind===kind&&mapSel.i===i?' selected':'');
 el.style.left=r.x+'%';el.style.top=r.y+'%';el.style.width=r.w+'%';el.style.height=r.h+'%';
 // Une porte de biais tourne autour de son centre ; ses coins tournent avec elle et la
 // redimensionnent dans son repère. La poignée ronde, au-dessus, la fait pivoter.
 if((kind==='door'||kind==='coffre')&&(Number(r.a)||0))el.style.transform='rotate('+r.a+'deg)';
 el.dataset.kind=kind;el.dataset.i=i;
 [...['nw','ne','sw','se'],...(kind==='door'||kind==='coffre'?['rot']:[])].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;
  if(g==='rot')h.title=(kind==='coffre'?'Tourner le coffre':'Tourner la porte')+' — Maj par crans de 15°';el.append(h)});
 // Un piège : son visuel, jeton ou image seule ; sa bulle au survol, réglages compris.
 if(kind==='piege'){el.prepend(visuelPiege(r));if(typeof surveille==='function')surveille(el,()=>{if(!mapDrag)ouvrirBulle(el,bullePiege(r,true),'bulle-gear')})}
 // Un coffre : sa bulle au survol, comme en partie, contenu compris ; piégé, l'avertissement du MJ.
 if(kind==='coffre'){if(r.piege>0)el.append(Object.assign(document.createElement('span'),{className:'coffre-alerte',textContent:'⚠',title:'Piégé'}));
  // Caché : un œil fermé, pour que le MJ le sache d'un coup d'œil.
  if(r.cache){const o=document.createElement('span');o.className='coffre-oeil';o.setAttribute('aria-label','Caché');
   o.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10c2.5 3.2 5.6 4.8 9 4.8s6.5-1.6 9-4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6.5 13.4 5 16M12 14.8V17.8M17.5 13.4 19 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';el.append(o)}
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
let clicObjet=null,clicCoffre=null,clicPiege=null,piegeLie=null;
/* Une lumière sur le plan de travail : son halo, à la taille qu'il aura en partie, un cœur au milieu qui porte l'icône de
   l'objet contenu, et une poignée au bord du halo pour le régler. */
let clicLumiere=null;
function lumiereEl(i,l,formes){const el=document.createElement('div');
 el.className='shape lumiere'+(mapSel&&mapSel.kind==='lumiere'&&mapSel.i===i?' selected':'');
 const socle=Math.max(8,$('map-canvas').clientWidth*echelleSocle(mapDraft)/100),d=socle*2*l.rayon;
 el.style.width=el.style.height=d+'px';el.style.margin=(-d/2)+'px 0 0 '+(-d/2)+'px';
 el.style.left=l.x+'%';el.style.top=l.y+'%';el.dataset.kind='lumiere';el.dataset.i=i;
 // Le halo, découpé par les murs et les portes closes comme à la table ; le cœur et la poignée restent entiers.
 const halo=document.createElement('span');halo.className='lumiere-halo';
 {const o=pointLibre({x:l.x,y:l.y},formes||[]),W=$('map-canvas').clientWidth,H=$('map-canvas').clientHeight;
  const poly=o&&W&&H?reachPolygon(o,formes||[],socle*l.rayon+3,W,H,72):[];
  if(poly.length>2)halo.style.clipPath='polygon('+poly.map(q=>(((q[0]-l.x)/100*W/d+.5)*100).toFixed(2)+'% '+(((q[1]-l.y)/100*H/d+.5)*100).toFixed(2)+'%').join(',')+')';
  else if(!o)halo.style.display='none'}
 const coeur=document.createElement('span');coeur.className='lumiere-coeur';coeur.style.width=coeur.style.height=Math.max(12,socle*.55)+'px';
 const im=iconeDeLumiere(l);
 if(im){im.classList.add('logo-objet');coeur.append(im)}else coeur.textContent='🔥';
 const grip=document.createElement('span');grip.className='grip rayon';grip.dataset.grip='rayon';grip.dataset.kind='lumiere';grip.dataset.i=i;
 el.append(halo,coeur,grip);el.title=l.nom+' · '+l.rayon+' m — double-clic pour modifier';
 el.ondblclick=e=>{e.stopPropagation();openLumiere(i)};
 return el}
function objetEl(i,o){const el=document.createElement('div');
 el.className='shape objet'+(o.visible?'':' cache')+(o.locked?' locked':'')+(mapSel&&mapSel.kind==='objet'&&mapSel.i===i?' selected':'');
 const t=Math.max(10,$('map-canvas').clientWidth*echelleSocle(mapDraft)/100*(SOCLE_TAILLES[o.taille]||1));
 el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';el.style.fontSize=(t*.47)+'px';
 el.style.left=o.x+'%';el.style.top=o.y+'%';el.dataset.kind='objet';el.dataset.i=i;
 poseLogoObjet(el,o);
 // v1.057 : dans l'éditeur aussi, l'objet — indice, ressource, coffre de groupe — a sa bulle au survol, celle de la table, vue du MJ.
 if(typeof surveille==='function')surveille(el,()=>{if(!mapDrag)ouvrirBulle(el,bulleObjetCarte(o),'bulle-gear')});
 el.ondblclick=e=>{e.stopPropagation();openObjet(i)};
 return el}
function foeEl(i,f){const el=document.createElement('div');
 const modele=modeleActuel(f.tpl)||f.tpl||{};
 el.className='shape foe'+(modele.pnj?' pnj al-'+alignementDe(modele):'')+(f.locked?' locked':'')+(f.cache?' cache':'')+(mapSel&&mapSel.kind==='foe'&&mapSel.i===i?' selected':'');
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
   o.setAttribute('class','trait-aimant');svg.append(o)}}
 if(courbe&&courbe.pts.length){const pts=courbeLissee([...courbe.pts,...(courbe.vise?[courbe.vise]:[])],m.ratio),l=document.createElementNS(nsSVG,'polyline');
  l.setAttribute('points',pts.map(q=>q.x+','+q.y).join(' '));l.setAttribute('class','trait-apercu courbe-apercu');svg.append(l);
  courbe.pts.forEach(q=>{const o=document.createElementNS(nsSVG,'ellipse'),r=Math.max(.05,Number(m.ratio)||16/9),rx=.5/Math.max(1,zoomC);
   o.setAttribute('cx',q.x);o.setAttribute('cy',q.y);o.setAttribute('rx',rx);o.setAttribute('ry',rx*r);o.setAttribute('class','courbe-point');svg.append(o)})}}
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
 if(mapTool==='dangergomme'){retireDanger(typeDangerCourant(false),forme);return}
 if(mapTool==='impratgomme')retireImpraticable(m,forme);else if(mapTool==='diffigomme')retireDifficile(m,forme);else if(mapTool==='gomme')retireMatiere(m,forme);else ajouteMatiere(m,forme)}
let pinceauDernier=null;
/* La découpe libre suit l'encre redressée : le tremblement de la main s'efface, les angles
   voulus restent, et la forme ôtée est exactement celle qui a été tracée. */
function applyLasso(){const brut=lasso&&lasso.pts,mode=lasso&&lasso.mode;lasso=null;
 if(!brut||brut.length<3){renderCanvas();return}
 pushUndo();const forme=encreDroite([brut])[0];
 // Le même contour fermé, selon l'outil : il creuse la matière, en pose, pose l'obscurité, ou l'efface.
 if(mode==='dangerlibre')ajouteDanger(typeDangerCourant(true),forme);else if(mode==='impratlibre')ajouteImpraticable(mapDraft,forme);else if(mode==='diffilibre')ajouteDifficile(mapDraft,forme);else if(mode==='obscurlibre')ajouteObscurite(mapDraft,forme);else if(mode==='obscurgomme')retireObscurite(mapDraft,forme);else if(mode==='blocagelibre')ajouteMatiere(mapDraft,forme);else retireMatiere(mapDraft,forme);
 mapSel=null;matiereChangee()}
function shapeAt(d){const m=mapDraft;if(!m)return null;if(d.kind==='cut'||d.kind==='bloc')return cutRect;
 if(d.kind==='coupure')return (m.zonesCoupures||[])[d.i];if(d.kind==='lien')return (m.zonesLiens||[])[d.i];
 if(d.kind==='piege')return (m.pieges||[])[d.i];if(d.kind==='declencheur'){const p=(m.pieges||[])[d.i];return p&&(p.declencheurs||[])[d.k]}
 return d.kind==='start'?m.start:(d.kind==='door'?m.doors:d.kind==='objet'?m.objets:d.kind==='coffre'?(m.coffres||[]):d.kind==='lumiere'?(m.lumieres||[]):m.foes)[d.i]}
function removeShape(d){const m=mapDraft;
 if(d.kind==='start')m.start=null;
 else if(d.kind==='coupure')m.zonesCoupures.splice(d.i,1);else if(d.kind==='lien')m.zonesLiens.splice(d.i,1);
 else if(d.kind==='piege')(m.pieges||[]).splice(d.i,1);else if(d.kind==='declencheur'){const p=(m.pieges||[])[d.i];if(p&&p.declencheurs)p.declencheurs.splice(d.k,1)}
 else (d.kind==='door'?m.doors:d.kind==='objet'?m.objets:d.kind==='coffre'?m.coffres:d.kind==='lumiere'?m.lumieres:m.foes).splice(d.i,1)}
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
 let dessous=sous?{kind:sous.dataset.kind,i:Number(sous.dataset.i),...(sous.dataset.k!==undefined?{k:Number(sous.dataset.k)}:{})}:null;
 /* Avec la Sélection, la hitbox d'un piège passe devant les grandes formes qui la couvrent : départ, matière, halo d'une
    lumière hors de son cœur. */
 if(!grip&&e.button===0&&mapTool==='select'){const hb=hitboxSous(p);
  const coeur=dessous&&dessous.kind==='lumiere'&&sous.querySelector('.lumiere-coeur'),r=coeur?coeur.getBoundingClientRect():null;
  const surCoeur=!!r&&Math.hypot(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2))<=r.width/2+4;
  if(hb&&(!dessous||dessous.kind==='start'||dessous.kind==='matiere'||(dessous.kind==='lumiere'&&!surCoeur)))dessous=hb}
 /* Un objet déjà posé se rouvre : un clic dessus avec l'outil Objet, qui en posait un autre par
    mégarde ; deux clics rapprochés avec la Sélection. Le plan se redessine à chaque clic, le
    double clic du navigateur n'arrivait donc jamais jusqu'à lui. */
 if(dessous&&dessous.kind==='objet'&&e.button===0&&mapDraft.objets&&mapDraft.objets[dessous.i]){const t=performance.now(),deux=clicObjet&&clicObjet.i===dessous.i&&t-clicObjet.t<450;
  clicObjet=deux?null:{i:dessous.i,t};
  if(deux||mapTool==='objet'){mapSel=dessous;renderCanvas();openObjet(dessous.i);e.preventDefault();return}}
 if(dessous&&dessous.kind==='coffre'&&e.button===0&&mapDraft.coffres&&mapDraft.coffres[dessous.i]&&!grip){const t=performance.now(),deux=clicCoffre&&clicCoffre.i===dessous.i&&t-clicCoffre.t<450;
  clicCoffre=deux?null:{i:dessous.i,t};if(deux){mapSel=dessous;renderCanvas();openCoffre(dessous.i);e.preventDefault();return}}
 // Un piège posé se rouvre de deux clics rapprochés, comme un coffre.
 if(dessous&&dessous.kind==='piege'&&e.button===0&&mapDraft.pieges&&mapDraft.pieges[dessous.i]&&!grip){const t=performance.now(),deux=clicPiege&&clicPiege.i===dessous.i&&t-clicPiege.t<450;
  clicPiege=deux?null:{i:dessous.i,t};if(deux){mapSel=dessous;renderCanvas();openPiege(dessous.i);e.preventDefault();return}}
 // Un fil de déclenchement se prend par son trait, qui le déplace d'un bloc, ou par un de ses bouts.
 if(dessous&&dessous.kind==='declencheur'&&(mapTool==='select'||grip)){const fil=shapeAt(dessous);
  if(fil&&fil.type==='fil'){mapSel=dessous;if(!fil.locked){pushUndo();mapDrag={mode:'fil',...dessous,bout:grip==='a'||grip==='b'?grip:null,orig:{...fil},from:p};$('map-canvas').setPointerCapture(e.pointerId)}
   renderCanvas();e.preventDefault();return}}
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
 if(typeOutilAdv(mapTool)||mapTool==='pnj'){const t=catalog.monsters[Number($(mapTool==='pnj'?'map-pnj-tpl':'map-foe-tpl').value)];if(!t)return;
  // Un PNJ unique n'a qu'un exemplaire sur une carte : le second clic montre celui qui y est déjà.
  const deja=t.pnj&&t.unique===true?mapDraft.foes.findIndex(f=>f&&f.tpl&&f.tpl.id===t.id):-1;
  if(deja>=0){mapSel={kind:'foe',i:deja};renderCanvas();$('shape-label').textContent=t.name+' est unique : il est déjà sur cette carte.';return}
  pushUndo();mapDraft.foes.push({tpl:structuredClone(t),x:p.x,y:p.y,locked:false});
  mapSel={kind:'foe',i:mapDraft.foes.length-1};renderCanvas();saveMaps();return}
 if(dessous&&dessous.kind==='lumiere'&&e.button===0&&mapDraft.lumieres&&mapDraft.lumieres[dessous.i]&&!grip){const t=performance.now(),deux=clicLumiere&&clicLumiere.i===dessous.i&&t-clicLumiere.t<450;
  clicLumiere=deux?null:{i:dessous.i,t};
  if(deux||mapTool==='lumiere'){mapSel=dessous;renderCanvas();openLumiere(dessous.i);e.preventDefault();return}}
 // Une lumière se pose d'un clic, comme un objet, et sa fiche s'ouvre : nom, portée, objet contenu.
 if(mapTool==='lumiere'&&!dessous){pushUndo();
  mapDraft.lumieres.push({id:crypto.randomUUID(),nom:'Torche',x:p.x,y:p.y,rayon:3,items:[]});
  mapSel={kind:'lumiere',i:mapDraft.lumieres.length-1};renderCanvas();saveMaps();openLumiere(mapSel.i);return}
 /* Un objet se pose d'un clic et sa fiche s'ouvre aussitôt : on le nomme avant de l'oublier. */
 // v0.998 : un Indice se pose comme un objet, caché d'office.
 if(mapTool==='indice'){pushUndo();
  mapDraft.objets.push({id:crypto.randomUUID(),nom:'Indice',desc:'',x:p.x,y:p.y,taille:'small',visible:false,indice:true,logo:'',journal:'',secret:'',examen:{mode:'',comp:3,reussites:1,item:''},items:[],tresor:'',test:{comp:3,reussites:1}});
  mapSel={kind:'objet',i:mapDraft.objets.length-1};renderCanvas();saveMaps();openObjet(mapSel.i);return}
 // v1.012 : une Ressource se pose comme un objet ; sa fiche s'ouvre aussitôt.
 if(mapTool==='ressource'){pushUndo();
  mapDraft.objets.push({id:crypto.randomUUID(),nom:'Ressource',desc:'',x:p.x,y:p.y,taille:'medium',visible:true,ressource:true,logo:'',type:typesRessources()[0]||'',
   recolte:{comp:TECHNIQUE,reussites:1,paliers:[[],[],[]]},items:[],tresor:'',test:{comp:3,reussites:1}});
  mapSel={kind:'objet',i:mapDraft.objets.length-1};renderCanvas();saveMaps();openObjet(mapSel.i);return}
 // v1.011 : le Coffre de Groupe se pose comme un objet, un jeton à son icône ; sa fiche s'ouvre aussitôt.
 if(mapTool==='coffregroupe'){pushUndo();
  mapDraft.objets.push({id:crypto.randomUUID(),nom:'Coffre de groupe',desc:'',x:p.x,y:p.y,taille:'medium',visible:true,groupe:true,logo:'',items:[],tresor:'',test:{comp:3,reussites:1}});
  mapSel={kind:'objet',i:mapDraft.objets.length-1};renderCanvas();saveMaps();openObjet(mapSel.i);return}
 if(mapTool==='objet'){pushUndo();
  // v1.050 : un objet posé naît caché — un test le découvre ; le MJ le rend visible dans sa fiche.
  mapDraft.objets.push({id:crypto.randomUUID(),nom:'Objet',desc:'',x:p.x,y:p.y,taille:'medium',visible:false,items:[],tresor:'',test:{comp:3,reussites:1}});
  mapSel={kind:'objet',i:mapDraft.objets.length-1};renderCanvas();saveMaps();openObjet(mapSel.i);return}
 /* Le tracé : premier clic, origine ; second clic, arrivée. Entre les deux, l'aperçu suit
    le curseur — et Maj le redresse. */
 if(mapTool==='courbe'||mapTool==='impratcourbe'){e.preventDefault();
  if(!courbe)courbe={pts:[],outil:mapTool};const der=courbe.pts[courbe.pts.length-1];if(!der||Math.hypot(der.x-p.x,der.y-p.y)>.05)courbe.pts.push({x:p.x,y:p.y});courbe.vise=p;dessineTraits();return}
 if(mapTool==='ligne'||mapTool==='impratligne'||mapTool==='diffiligne'||mapTool==='dangerligne'){
  if(!traitDepart){const d=boutAimante(p,mapDraft.ratio)||p;
   traitDepart={x:d.x,y:d.y};traitVise={x:d.x,y:d.y};renderCanvas();e.preventDefault();return}
  const fin=viseTrait(p,e.metaKey||e.ctrlKey,mapDraft.ratio,e.shiftKey);
  const r=Math.max(.05,Number(mapDraft.ratio)||16/9);
  const pose=Math.hypot((fin.x-traitDepart.x)*r,fin.y-traitDepart.y)>=auZoom(.5);
  // On ne choisit pas ce qu'on vient de tracer : la main est encore à l'ouvrage.
  if(pose){pushUndo();
   (mapTool==='dangerligne'?(m,f)=>ajouteDanger(typeDangerCourant(true),f):mapTool==='impratligne'?ajouteImpraticable:mapTool==='diffiligne'?ajouteDifficile:ajouteMatiere)(mapDraft,traitPolygon({x1:traitDepart.x,y1:traitDepart.y,x2:fin.x,y2:fin.y,e:TRAIT_EPAISSEUR},mapDraft.ratio))}
  /* Maj pose un point d'appui : le trait s'arrête là et le suivant en repart. C'est ainsi
     qu'on longe une salle entière sans relever la main. */
  if(pose&&e.shiftKey){traitDepart={x:fin.x,y:fin.y};traitVise={x:fin.x,y:fin.y}}
  else traitDepart=traitVise=null;
  renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render();e.preventDefault();return}
 if(mapTool==='select'){mapSel=null;renderCanvas();return}
 /* Le pinceau : on appuie, on trace, on relâche. Chaque pas dépose ou gratte, et le pas
    vaut la moitié de la grosseur — assez serré pour que la trace soit continue, assez
    espacé pour ne pas empiler mille formes sur un geste. */
 if(mapTool==='pinceau'||mapTool==='gomme'||mapTool==='impratgomme'||mapTool==='diffigomme'||mapTool==='dangergomme'){pushUndo();mapSel=null;
  pinceauDernier=null;coupPinceau(p);pinceauDernier={x:p.x,y:p.y};
  mapDrag={mode:'pinceau',from:p};$('map-canvas').setPointerCapture(e.pointerId);
  renderCanvas();e.preventDefault();return}
 // Le remplissage d'obscurité : un clic, et la zone libre autour devient noire.
 if(mapTool==='obscurremplir'){pushUndo();const avant=obscuriteDe(mapDraft).length;remplitObscurite(mapDraft,[p.x,p.y]);
  if(obscuriteDe(mapDraft).length===avant&&!dansObscurite(mapDraft,[p.x,p.y]))undoStack.pop();
  mapSel=null;matiereChangee();e.preventDefault();return}
 if(mapTool==='lasso'||mapTool==='blocagelibre'||mapTool==='obscurlibre'||mapTool==='obscurgomme'||mapTool==='impratlibre'||mapTool==='diffilibre'||mapTool==='dangerlibre'){if(!lasso||lasso.mode!==mapTool)lasso={pts:[],mode:mapTool};
  // Un clic près du premier point ferme le contour, comme dans un outil de détourage.
  if(lasso.pts.length>2&&Math.hypot(p.x-lasso.pts[0][0],p.y-lasso.pts[0][1])<auZoom(1.6)){applyLasso();return}
  lasso.pts.push([p.x,p.y]);mapSel=null;
  mapDrag={mode:'lasso',from:p,bouge:false};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 if(mapTool==='cut'){cutRect={x:p.x,y:p.y,w:0,h:0};mapSel=null;
  mapDrag={mode:'cut',kind:'cut',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Le bloc se trace comme la découpe : un aperçu suit la main, l'union se fait au relâché.
 // Le carré de blocage, ou d'impraticable, se tire de même : seul son contour, de l'épaisseur d'une ligne, se pose.
 if(mapTool==='wall'||mapTool==='obscur'||mapTool==='imprat'||mapTool==='cadre'||mapTool==='impratcadre'||mapTool==='diffi'||mapTool==='difficadre'||mapTool==='danger'){cutRect={x:p.x,y:p.y,w:0,h:0,danger:mapTool==='danger',bloc:mapTool==='wall'||mapTool==='cadre',obscur:mapTool==='obscur',imprat:mapTool==='imprat'||mapTool==='impratcadre',diffi:mapTool==='diffi'||mapTool==='difficadre',cadre:mapTool==='cadre'||mapTool==='impratcadre'||mapTool==='difficadre'};mapSel=null;
  mapDrag={mode:'cut',kind:'bloc',i:0,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 /* Un déclencheur se trace pour le piège dont la fiche l'a demandé : une zone comme un rectangle, un fil d'un bout à l'autre.
    Tracé, on repasse en Sélection. */
 if(mapTool==='piegezone'||mapTool==='piegefil'||mapTool==='piegebloc'){const pg=(mapDraft.pieges||[])[piegeLie];if(!pg){mapTool='select';renderCanvas();return}
  pg.declencheurs??=[];if(pg.declencheurs.length>=12)return;pushUndo();
  if(mapTool==='piegefil'){pg.declencheurs.push({id:crypto.randomUUID(),type:'fil',x1:p.x,y1:p.y,x2:p.x,y2:p.y});mapSel={kind:'declencheur',i:piegeLie,k:pg.declencheurs.length-1};
   mapDrag={mode:'fil',...mapSel,bout:'b',orig:null,from:p,neuf:true}}
  else{pg.declencheurs.push({id:crypto.randomUUID(),type:mapTool==='piegebloc'?'bloc':'zone',x:p.x,y:p.y,w:0,h:0});mapSel={kind:'declencheur',i:piegeLie,k:pg.declencheurs.length-1};
   mapDrag={mode:'create',...mapSel,from:p,dessous:null}}
  $('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault();return}
 // Outil de dessin : on trace. Un clic sans glisser sélectionne la forme sous le curseur.
 pushUndo();const rect={x:p.x,y:p.y,w:0,h:0,locked:false};
 if(mapTool==='door'||mapTool==='secret'||mapTool==='fenetre'){rect.open=false;
  // Un passage secret est une porte, née secrète : plus besoin de percer d'abord un trou.
  if(mapTool==='secret')rect.secret=true;
  // v0.971 : une fenêtre se pose comme une porte, fermée d'abord.
  if(mapTool==='fenetre'){rect.fenetre=true;rect.etatInitial='fermee'}
  mapDraft.doors.push(rect);mapSel={kind:'door',i:mapDraft.doors.length-1}}
 else if(mapTool==='start'){mapDraft.start=rect;mapSel={kind:'start',i:0}}
 else if(mapTool==='coffre'||mapTool==='coffrerond'){Object.assign(rect,{id:crypto.randomUUID(),nom:'Coffre',desc:'',perception:1,verrou:0,piege:0,degats:0,etats:[],items:[],richesses:{}});
  if(mapTool==='coffrerond')rect.rond=true;
  mapDraft.coffres.push(rect);mapSel={kind:'coffre',i:mapDraft.coffres.length-1}}
 else if(mapTool==='piege'){Object.assign(rect,{id:crypto.randomUUID(),nom:'Piège',desc:'',affichage:'jeton',contact:true,declencheurs:[],detection:{comp:3,reussites:1},degats:0,etats:[],caracs:[]});
  mapDraft.pieges??=[];mapDraft.pieges.push(rect);mapSel={kind:'piege',i:mapDraft.pieges.length-1}}
 mapDrag={mode:'create',kind:mapSel.kind,i:mapSel.i,from:p,dessous};$('map-canvas').setPointerCapture(e.pointerId);renderCanvas();e.preventDefault()});
// Un double-clic termine la Ligne de points.
$('map-canvas').addEventListener('dblclick',e=>{if((mapTool==='courbe'||mapTool==='impratcourbe')&&courbe){e.preventDefault();appliqueCourbe()}});
$('map-canvas').addEventListener('pointermove',e=>{
 if(enZones()&&zoneTrait&&!mapDrag){zoneVise=pct(e);dessineZonesEditeur();return}
 if(courbe&&!mapDrag){courbe.vise=pct(e);dessineTraits();return}
 if(traitDepart&&!mapDrag){traitCurseur=pct(e);traitVise=viseTrait(traitCurseur,e.metaKey||e.ctrlKey,mapDraft&&mapDraft.ratio,e.shiftKey);
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
 // Un fil : un bout suit le pointeur, ou le fil entier glisse, sans sortir de la carte.
 if(d.mode==='fil'){const f=shapeAt(d);if(!f)return;
  if(d.bout==='a'){f.x1=p.x;f.y1=p.y}else if(d.bout==='b'){f.x2=p.x;f.y2=p.y}
  else{const o=d.orig,bx=Math.max(-Math.min(o.x1,o.x2),Math.min(100-Math.max(o.x1,o.x2),p.x-d.from.x)),by=Math.max(-Math.min(o.y1,o.y2),Math.min(100-Math.max(o.y1,o.y2),p.y-d.from.y));
   f.x1=o.x1+bx;f.x2=o.x2+bx;f.y1=o.y1+by;f.y2=o.y2+by}
  renderCanvas();return}
 const cible=shapeAt(d);if(!cible)return;
 if(d.mode==='tourne'){cible.a=anglePoignee(d.centre,p,mapDraft.ratio,e.shiftKey);renderCanvas();return}
 if(d.kind==='lumiere'&&d.grip==='rayon'){const r=$('map-canvas').getBoundingClientRect(),socle=Math.max(8,r.width*echelleSocle(mapDraft)/100);
  cible.rayon=Math.max(.5,Math.min(40,Math.round(Math.hypot((p.x-cible.x)/100*r.width,(p.y-cible.y)/100*r.height)/socle*2)/2));renderCanvas();return}
 if(d.kind==='foe'||d.kind==='objet'||d.kind==='lumiere'||d.kind==='notemj'){cible.x=p.x;cible.y=p.y}
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
   if(r.cadre){const formes=cadreFormes(r,mapDraft.ratio);if(r.imprat)ajouteImpraticable(mapDraft,formes);else if(r.diffi)ajouteDifficile(mapDraft,formes);else formes.forEach(f=>ajouteMatiere(mapDraft,f));mapSel=null}
   else if(r.imprat){ajouteImpraticable(mapDraft,forme);mapSel=null}
   else if(r.danger){ajouteDanger(typeDangerCourant(true),forme);mapSel=null}
   else if(r.diffi){ajouteDifficile(mapDraft,forme);mapSel=null}
   else if(r.obscur){ajouteObscurite(mapDraft,forme);mapSel=null}
   else if(r.bloc){ajouteMatiere(mapDraft,forme);mapSel={kind:'matiere',i:matiereSous(mapDraft,[r.x+r.w/2,r.y+r.h/2])};
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
 // Un fil trop court n'est qu'un clic : il ne reste pas. Tracé, on repasse en Sélection.
 if(d.mode==='fil'){const f=shapeAt(d),r=Math.max(.05,Number(mapDraft.ratio)||16/9);
  if(f&&d.neuf&&Math.hypot((f.x2-f.x1)*r,f.y2-f.y1)<auZoom(1.2)){removeShape(d);mapSel=null;undoStack.pop()}else if(d.neuf)mapTool='select';
  renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render();return}
 // v1.065 : une Note de MJ n'a pas de surface ; déplacée, elle reste (elle se voyait effacée comme un clic manqué).
 const cible=d.kind==='foe'||d.kind==='objet'||d.kind==='lumiere'||d.kind==='notemj'?null:shapeAt(d);
 // Un coffre tout juste tracé ouvre sa fiche, comme un objet posé.
 if(cible&&d.mode==='create'&&d.kind==='coffre'&&gesteTrace(cible))setTimeout(()=>openCoffre(d.i));
 // Un piège tout juste tracé ouvre sa fiche ; une zone de déclenchement tracée rend la Sélection.
 if(cible&&d.mode==='create'&&d.kind==='piege'&&gesteTrace(cible))setTimeout(()=>openPiege(d.i));
 if(cible&&d.mode==='create'&&d.kind==='declencheur'&&gesteTrace(cible))mapTool='select';
 if(cible&&!gesteTrace(cible)){removeShape(d);
  // Clic manqué : si une forme était dessous, on la sélectionne et on repasse en Sélection.
  if(d.dessous){mapSel=d.dessous;mapTool='select'}else{mapSel=null;undoStack.pop()}}
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()});
/* Le choix dans l'armurerie, par familles : de petits carrés, un clic prend la pièce, un autre la repose.
   « pris » : l'ensemble des identifiants choisis, que le formulaire relit à l'enregistrement. */
function pickerArmurerie(filtre,boite,pris){const liste=()=>{const q=(filtre.value||'').trim().toLowerCase();boite.replaceChildren();
  [['weapon','Armes'],['armor','Armures et boucliers'],['object','Objets'],['cle','Clés'],['treasure','Trésors'],['ressource','Ressources'],['restes','Restes'],['herbe','Herboristerie'],['potion','Potions'],['recette','Recettes']].forEach(([cat,titre])=>{
   const lot=(catalog.items||[]).filter(it=>it&&!it.forge&&it.category===cat&&(!q||it.name.toLowerCase().includes(q)));
   if(!lot.length)return;const h=document.createElement('h3');h.textContent=titre;boite.append(h);
   /* De petits carrés, comme l'inventaire d'un aventurier : l'icône seule, la bulle au survol ; un
      clic prend la pièce, un autre la repose. */
   const rang=document.createElement('div');rang.className='objet-rang';
   lot.forEach(it=>{const p=gearCarre(it,1,0);p.classList.remove('dispo');const coche=p.querySelector('.marque-porte');if(coche)coche.remove();
    const maj=()=>{p.classList.toggle('pris',pris.has(it.id));p.setAttribute('aria-pressed',String(pris.has(it.id)));
     // v1.021 : compté (une Map), la pièce dit combien d'exemplaires attendent.
     if(pris instanceof Map){let b=p.querySelector('.exemplaires');const n=pris.get(it.id)||0;if(n>1){if(!b){b=document.createElement('span');b.className='exemplaires';p.append(b)}b.textContent='×'+n}else if(b)b.remove()}};
    const total=()=>[...pris.values()].reduce((s,v)=>s+v,0);
    const bascule=()=>{if(pris instanceof Map){if(total()<20)pris.set(it.id,(pris.get(it.id)||0)+1)}else if(pris.has(it.id))pris.delete(it.id);else pris.add(it.id);maj()};
    if(pris instanceof Map)p.oncontextmenu=e=>{e.preventDefault();const n=(pris.get(it.id)||0)-1;if(n>0)pris.set(it.id,n);else pris.delete(it.id);maj()};
    p.setAttribute('aria-label',it.name);p.onclick=bascule;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();bascule()}};maj();
    if(typeof surveille==='function')surveille(p,()=>{const d=gearDetail(it,null,false);d.hidden=false;d.classList.add('large');ouvrirBulle(p,d,'bulle-gear')});
    rang.append(p)});
   boite.append(rang)})};
 filtre.oninput=liste;liste()}
/* ---------- La fiche d'un objet ---------- */
const objetDialog=dialog('objet-editor','Objet','<form id="objet-form"><div id="objet-fields"></div><div class="form-actions"><button type="button" id="objet-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
let objetIndex=null;
/* v0.998 — La fiche d'un Indice : son icône, son test de découverte et la phrase qu'il écrit au journal ; puis l'examen qui
   livre son secret — un test d'une autre compétence, ou un objet à utiliser — et le texte de ce secret. */
function openIndice(i){const m=mapDraft,o=m&&m.objets&&m.objets[i];if(!o||view!=='mj')return;objetIndex=i;const x=o.examen||(o.examen={mode:'',comp:3,reussites:1,item:''});
 objetDialog.querySelector('h2').textContent=o.nom||'Indice';
 const objets=(catalog.items||[]).filter(it=>it&&!it.forge).sort((u,v)=>String(u.name).localeCompare(String(v.name),'fr'));
 $('objet-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','nom',o.nom,'text','required maxlength="60"')
  +(typeof selLogos==='function'?selLogos('Icône','logo',o.logo||''):'')
  +sel('Visibilité','visible',o.visible?'1':'0',[['0','Caché — un test le découvre'],['1','Visible']])+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="2" maxlength="600">'+esc(o.desc||'')+'</textarea></label>'
  +'<div class="edit-grid">'+sel('Test de découverte — compétence','comp',String(o.test.comp),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites nécessaires','reussites',o.test.reussites,'number','min="1" max="9"')+'</div>'
  +'<label>Texte du journal quand il est repéré<textarea name="journal" rows="2" maxlength="400">'+esc(o.journal||'')+'</textarea></label>'
  +'<h2 class="sous-titre">Second test : son secret</h2><div class="edit-grid">'
  +sel('Pour le révéler','mode',x.mode||'',[['','— aucun —'],['comp','Un test de compétence'],['objet','Un objet à utiliser']])
  +sel('Compétence','xcomp',String(x.comp??3),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites nécessaires','xreussites',x.reussites||1,'number','min="1" max="9"')
  +sel('Objet','xitem',x.item||'',[['','— choisir —'],...objets.map(it=>[it.id,it.name])])+'</div>'
  +'<label>Texte du secret, au journal<textarea name="secret" rows="3" maxlength="600">'+esc(o.secret||'')+'</textarea></label>';
 const f=$('objet-form').elements,maj=()=>{const md=f.mode.value;f.xcomp.closest('label').hidden=f.xreussites.closest('label').hidden=md!=='comp';f.xitem.closest('label').hidden=md!=='objet';f.secret.closest('label').hidden=!md};
 f.mode.onchange=maj;maj();
 $('objet-form').onsubmit=e=>{e.preventDefault();pushUndo();
  o.nom=f.nom.value.trim().slice(0,60)||'Indice';o.visible=f.visible.value==='1';o.desc=f.desc.value.trim().slice(0,600);
  o.logo=f.logo?f.logo.value:'';o.journal=f.journal.value.trim().slice(0,400);o.secret=f.secret.value.trim().slice(0,600);
  o.test={comp:Math.max(0,Math.min(7,Number(f.comp.value)||0)),reussites:Math.max(1,Math.min(9,Number(f.reussites.value)||1))};
  o.examen={mode:['comp','objet'].includes(f.mode.value)?f.mode.value:'',comp:Math.max(0,Math.min(7,Number(f.xcomp.value)||0)),reussites:Math.max(1,Math.min(9,Number(f.xreussites.value)||1)),item:f.xitem.value};
  objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('objet-suppr').onclick=()=>{if(!confirm('Supprimer « '+o.nom+' » ?'))return;pushUndo();
  m.objets.splice(i,1);mapSel=null;objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 objetDialog.showModal()}
/* v1.012 — La fiche d'une Ressource : son nom, son icône, sa taille, son type ; caché ou non, comme un objet ; puis sa Récolte :
   la compétence, les réussites demandées, et trois paliers — N, N+1, N×2 —, chacun avec ses pièces et leur quantité. */
function typesRessources(){return typeof catalog!=='undefined'&&Array.isArray(catalog.typesRessources)?catalog.typesRessources:normaliseTypesRessources()}
function openRessource(i){const m=mapDraft,o=m&&m.objets&&m.objets[i];if(!o||view!=='mj')return;objetIndex=i;
 const r=normaliseRecolte(o.recolte),paliers=r.paliers.map(l=>l.map(x=>({...x})));
 objetDialog.querySelector('h2').textContent=o.nom||'Ressource';
 const pieces=(catalog.items||[]).filter(it=>it&&!it.forge&&it.id).sort((u,v)=>String(u.name).localeCompare(String(v.name),'fr'));
 const groupes=[['herbe','Herboristerie'],['ressource','Ressources'],['restes','Restes']];
 const optionsPieces=v=>'<option value="">— choisir —</option>'+[...groupes,['','Autres']].map(([c,n])=>{const l=pieces.filter(it=>c?it.category===c:!groupes.some(([g])=>g===it.category));
   return l.length?'<optgroup label="'+esc(n)+'">'+l.map(it=>'<option value="'+esc(it.id)+'"'+(it.id===v?' selected':'')+'>'+esc(it.name)+'</option>').join('')+'</optgroup>':''}).join('');
 const optionsTypes=v=>{const l=typesRessources(),tous=v&&!l.includes(v)?[...l,v]:l;
  return tous.map(t=>'<option value="'+esc(t)+'"'+(t===v?' selected':'')+'>'+esc(t)+'</option>').join('')+'<option value="__nouveau">+ Nouveau type…</option>'};
 $('objet-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','nom',o.nom,'text','required maxlength="60"')
  +(typeof selLogos==='function'?selLogos('Icône','logo',o.logo||'',false,'herboristerie'):'')
  +sel('Taille','taille',o.taille,[['small','Petit'],['medium','Moyen'],['large','Grand']])
  +'<label>Type<select name="type">'+optionsTypes(o.type||'')+'</select></label>'
  +sel('Visibilité','visible',o.visible?'1':'0',[['1','Visible'],['0','Caché — un test le découvre']])+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="2" maxlength="600">'+esc(o.desc||'')+'</textarea></label>'
  +'<div class="edit-grid">'+sel('Test de découverte — compétence','comp',String(o.test.comp),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites nécessaires','reussites',o.test.reussites,'number','min="1" max="9"')+'</div>'
  +'<h2 class="sous-titre">Récolte</h2><div class="edit-grid">'
  +sel('Compétence','rcomp',String(r.comp),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites demandées','rreussites',r.reussites,'number','min="1" max="9"')+'</div>'
  +'<div id="ressource-paliers" class="ressource-paliers"></div>';
 const f=$('objet-form').elements,boite=$('ressource-paliers');
 f.type.onchange=()=>{if(f.type.value!=='__nouveau')return;const t=(prompt('Nouveau type de ressource :','')||'').trim().slice(0,40);
  if(t){catalog.typesRessources=normaliseTypesRessources([...typesRessources(),t]);scheduleSave()}
  const v=t?(typesRessources().find(x=>x.toLowerCase()===t.toLowerCase())||t):(o.type||typesRessources()[0]||'');f.type.innerHTML=optionsTypes(v);f.type.value=v};
 const lis=()=>boite.querySelectorAll('.palier-ressource').forEach((fs,j)=>{paliers[j]=[...fs.querySelectorAll('.ligne-ressource')].map(l=>({id:l.querySelector('select').value,q:l.querySelector('input').value}))});
 const dessine=()=>{const n=Math.max(1,Math.min(9,Math.trunc(Number(f.rreussites.value))||1));boite.replaceChildren();
  [n,n+1,2*n].forEach((s,j)=>{const fs=document.createElement('fieldset');fs.className='palier-ressource';
   fs.innerHTML='<legend>Palier '+(j+1)+' — '+s+' réussite'+(s>1?'s':'')+'</legend>';
   paliers[j].forEach((x,k)=>{const l=document.createElement('div');l.className='ligne-ressource';
    l.innerHTML='<select aria-label="Pièce">'+optionsPieces(x.id)+'</select><input aria-label="Quantité" maxlength="9" value="'+esc(x.q||'1')+'"><button type="button" aria-label="Retirer">✕</button>';
    l.querySelector('button').onclick=()=>{lis();paliers[j].splice(k,1);dessine()};fs.append(l)});
   const plus=document.createElement('button');plus.type='button';plus.textContent='+ Pièce';plus.onclick=()=>{lis();paliers[j].push({id:'',q:'1'});dessine()};
   fs.append(plus);boite.append(fs)})};
 f.rreussites.oninput=()=>{lis();dessine()};dessine();
 $('objet-form').onsubmit=e=>{e.preventDefault();lis();pushUndo();
  o.nom=f.nom.value.trim().slice(0,60)||'Ressource';o.logo=f.logo?f.logo.value:'';o.taille=f.taille.value;o.visible=f.visible.value==='1';
  o.type=f.type.value==='__nouveau'?(o.type||''):f.type.value;o.desc=f.desc.value.trim().slice(0,600);
  o.test={comp:Math.max(0,Math.min(7,Number(f.comp.value)||0)),reussites:Math.max(1,Math.min(9,Number(f.reussites.value)||1))};
  o.recolte=normaliseRecolte({comp:f.rcomp.value,reussites:f.rreussites.value,paliers});
  objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('objet-suppr').onclick=()=>{if(!confirm('Supprimer « '+o.nom+' » ?'))return;pushUndo();
  m.objets.splice(i,1);mapSel=null;objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 objetDialog.showModal()}
// v1.011 : la fiche d'un Coffre de Groupe posé : son nom, son icône, sa taille, sa description.
function openCoffreGroupeCarte(i){const m=mapDraft,o=m&&m.objets&&m.objets[i];if(!o||view!=='mj')return;objetIndex=i;
 objetDialog.querySelector('h2').textContent=o.nom||'Coffre de groupe';
 $('objet-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','nom',o.nom,'text','required maxlength="60"')
  +(typeof selLogos==='function'?selLogos('Icône','logo',o.logo||''):'')
  +sel('Taille','taille',o.taille,[['small','Petit'],['medium','Moyen'],['large','Grand']])+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="3" maxlength="600">'+esc(o.desc||'')+'</textarea></label>';
 $('objet-form').onsubmit=e=>{e.preventDefault();const f=$('objet-form').elements;pushUndo();
  o.nom=f.nom.value.trim().slice(0,60)||'Coffre de groupe';o.logo=f.logo?f.logo.value:'';o.taille=f.taille.value;o.desc=f.desc.value.trim().slice(0,600);
  objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('objet-suppr').onclick=()=>{if(!confirm('Supprimer « '+o.nom+' » ?'))return;pushUndo();
  m.objets.splice(i,1);mapSel=null;objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 objetDialog.showModal()}
function openObjet(i){const m=mapDraft,o=m&&m.objets&&m.objets[i];if(!o||view!=='mj')return;if(o.indice)return openIndice(i);if(o.groupe===true)return openCoffreGroupeCarte(i);if(o.ressource===true)return openRessource(i);objetIndex=i;
 objetDialog.querySelector('h2').textContent=o.nom||'Objet';
 $('objet-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','nom',o.nom,'text','required maxlength="60"')
  +sel('Taille','taille',o.taille,[['small','Petit'],['medium','Moyen'],['large','Grand']])
  +sel('Visibilité','visible',o.visible?'1':'0',[['1','Visible — la troupe le voit et l’ouvre'],['0','Caché — un test le découvre']])+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="3" maxlength="600">'+esc(o.desc||'')+'</textarea></label>'
  +'<div class="edit-grid">'+sel('Test de découverte — compétence','comp',String(o.test.comp),skillNames.map((n,k)=>[String(k),n]))
  +field('Réussites nécessaires','reussites',o.test.reussites,'number','min="1" max="9"')
  +'<label class="field-check"><input type="checkbox" name="pierre"'+(o.pierre===true?' checked':'')+'>Dans la pierre</label>'
  +field('Trésor — en toutes lettres','tresor',o.tresor||'','text','maxlength="200"')
  +sel('Quête débloquée','quete',o.quete||'',[['','— aucune —'],...((typeof domaine!=='undefined'&&domaine.quetes)||[]).map(q=>[q.id,q.titre])])+'</div>'
  // v1.055 : le choix des pièces, comme celui d'un coffre — boutons à cocher par catégorie, filtre, ce qui est dedans au-dessus.
  +'<h2 class="sous-titre">Objets à prendre</h2><div id="objet-liste"></div>'
  +'<p class="muted">Ce qui est choisi, d’un clic, attend dans l’objet ; la première pièce choisie donne son icône au jeton. Un aventurier au contact la prend d’un clic : elle va dans son inventaire.</p>';
 const contenu={inventaire:[...(o.items||[])]};contenuCoffre($('objet-liste'),contenu);
 $('objet-form').onsubmit=e=>{e.preventDefault();const f=$('objet-form').elements;pushUndo();
  o.nom=f.nom.value.trim().slice(0,60)||'Objet';o.taille=f.taille.value;o.visible=f.visible.value==='1';
  o.desc=f.desc.value.trim().slice(0,600);o.tresor=f.tresor.value.trim().slice(0,200);if(f.quete.value)o.quete=f.quete.value;else delete o.quete;
  o.test={comp:Math.max(0,Math.min(7,Number(f.comp.value)||0)),reussites:Math.max(1,Math.min(9,Number(f.reussites.value)||1))};if(f.pierre.checked)o.pierre=true;else delete o.pierre;
  o.items=contenu.inventaire.filter(id=>objetDe(id)).slice(0,20);objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('objet-suppr').onclick=()=>{if(!confirm('Supprimer « '+o.nom+' » ?'))return;pushUndo();
  m.objets.splice(i,1);mapSel=null;objetDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 objetDialog.showModal()}
$('objet-edit').onclick=()=>{if(mapSel&&mapSel.kind==='objet')openObjet(mapSel.i)};
const lumiereDialog=dialog('lumiere-editor','Lumière','<form id="lumiere-form"><div id="lumiere-fields"></div><div class="form-actions"><button type="button" id="lumiere-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openLumiere(i){const m=mapDraft,l=m&&m.lumieres&&m.lumieres[i];if(!l||view!=='mj')return;
 lumiereDialog.querySelector('h2').textContent=l.nom||'Lumière';
 $('lumiere-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',l.nom,'text','required maxlength="60"')
  +field('Lumière (m)','rayon',l.rayon,'number','min="0.5" max="40" step="0.5"')+'</div>'
  +'<h2 class="sous-titre">Objet contenu</h2><input id="lumiere-filtre" placeholder="Filtrer l’armurerie…" aria-label="Filtrer l’armurerie"><div id="lumiere-liste" class="objet-liste"></div>';
 const pris=new Set(l.items||[]);pickerArmurerie($('lumiere-filtre'),$('lumiere-liste'),pris);
 $('lumiere-form').onsubmit=e=>{e.preventDefault();const f=$('lumiere-form').elements;pushUndo();
  l.nom=f.nom.value.trim().slice(0,60)||'Torche';l.rayon=Math.max(.5,Math.min(40,Number(f.rayon.value)||3));
  l.items=[...pris];lumiereDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('lumiere-suppr').onclick=()=>{if(!confirm('Supprimer « '+l.nom+' » ?'))return;pushUndo();
  m.lumieres.splice(i,1);mapSel=null;lumiereDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 lumiereDialog.showModal()}
$('lumiere-edit').onclick=()=>{if(mapSel&&mapSel.kind==='lumiere')openLumiere(mapSel.i)};
// Dupliquer : la même lumière, objet compris, posée un peu plus loin, allumée.
$('lumiere-double').onclick=()=>{const l=mapSel&&mapSel.kind==='lumiere'&&shapeAt(mapSel);if(!l)return;pushUndo();
 const copie=structuredClone(l);copie.id=crypto.randomUUID();delete copie.eteinte;delete copie.prise;copie.x=Math.min(100,l.x+2);copie.y=Math.min(100,l.y+2);
 mapDraft.lumieres.push(copie);mapSel={kind:'lumiere',i:mapDraft.lumieres.length-1};
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
$('shape-delete').onclick=()=>{if(!supprimeSelection())return;
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
// v0.971 : l'état d'une fenêtre — celui qu'elle a à l'ouverture de la carte.
const etatFenetre=d=>d.etatInitial==='ouverte'||d.etatInitial==='verrouillee'?d.etatInitial:'fermee';
$('door-fenetre').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d||!d.fenetre)return;pushUndo();
 const v=$('door-fenetre').value;d.etatInitial=v;d.open=v==='ouverte';if(v==='verrouillee')d.keyLocked=true;else delete d.keyLocked;
 renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-key').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.keyLocked=$('door-key').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
$('door-secret').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.secret=$('door-secret').checked;renderCanvas();saveMaps();if(mapDraft.id===currentMapId)render()};
// Le nombre de réussites de Perception qu'un passage secret demande pour être trouvé.
$('door-crochet').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.crochetage=difficultePorte({crochetage:$('door-crochet').value});renderCanvas();saveMaps()};
$('door-pierre').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();if($('door-pierre').checked)d.pierre=true;else delete d.pierre;saveMaps()};
$('door-perception').onchange=()=>{const d=mapSel&&mapSel.kind==='door'&&shapeAt(mapSel);if(!d)return;
 pushUndo();d.perception=Math.max(1,Math.min(9,Math.trunc(Number($('door-perception').value))||1));renderCanvas();saveMaps()};
// Un adversaire caché : la troupe ne le voit pas tant que le MJ ne le révèle pas, d'un clic en jeu.
/* Ce que cet adversaire-là porte en plus de son modèle, et la chance que chaque pièce tombe : choisi comme
   l'inventaire d'un adversaire du bestiaire. Les autres du même modèle n'en ont rien. */
const foeObjetsDialog=dialog('foe-objets-editor','Objets portés','<div id="foe-objets-corps"></div>');
$('foe-objets').onclick=()=>{const f=mapSel&&mapSel.kind==='foe'&&shapeAt(mapSel);if(!f)return;pushUndo();
 foeObjetsDialog.querySelector('h2').textContent=(f.tpl&&f.tpl.name)||'Adversaire';f.inventaire??=[];f.butin??={};
 inventaireAdversaire($('foe-objets-corps'),f,()=>saveMaps());
 foeObjetsDialog.onclose=()=>{f.butin=normaliseButin(f.butin,f.inventaire);if(!f.inventaire.length){delete f.inventaire;delete f.butin}f.bourse=normaliseBourse(f.bourse);if(!f.bourse.length)delete f.bourse;renderCanvas();saveMaps()};
 foeObjetsDialog.showModal()};
/* L'adversaire que la table a tiré de cette pose, si la carte y est ouverte : par l'identifiant de la pose,
   à défaut — une table ouverte avant qu'elle n'en ait un — par son modèle et sa place, s'il n'a pas bougé. */
function adversaireDeLaTable(m,f){if(!m||!f||m.id!==currentMapId)return null;
 return actors.find(a=>a&&!a.hero&&f.id&&a.pose===f.id)
  ||actors.find(a=>a&&!a.hero&&!a.pose&&f.tpl&&a.template===f.tpl.id&&Math.abs(a.x-f.x)<.5&&Math.abs(a.y-f.y)<.5)||null}
$('foe-quete').onchange=()=>{const f=mapSel&&mapSel.kind==='foe'&&shapeAt(mapSel);if(!f)return;
 pushUndo();if($('foe-quete').value)f.quete=$('foe-quete').value;else delete f.quete;saveMaps()};
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
/* Les déclencheurs d'un piège, sur le plan : chaque zone en pointillé, chaque fil d'un trait, et un fin lien de chacun au
   piège. Une zone se tire par ses coins ; un fil, par ses bouts. */
/* La hitbox sous un point de la carte, la dernière tracée d'abord : celle qu'on voit au-dessus. */
function hitboxSous(p){const pg=(mapDraft&&mapDraft.pieges)||[];
 for(let i=pg.length-1;i>=0;i--){const ds=(pg[i]&&pg[i].declencheurs)||[];
  for(let k=ds.length-1;k>=0;k--){const d=ds[k];if(d&&d.type==='bloc'&&p.x>=d.x&&p.x<=d.x+d.w&&p.y>=d.y&&p.y<=d.y+d.h)return {kind:'declencheur',i,k}}}
 return null}
function declencheursEl(i,p){const out=[],cx=p.x+p.w/2,cy=p.y+p.h/2,svg=document.createElementNS(nsSVG,'svg');
 svg.setAttribute('class','piege-liens');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');
 const ligne=(cls,x1,y1,x2,y2)=>{const l=document.createElementNS(nsSVG,'line');l.setAttribute('class',cls);[['x1',x1],['y1',y1],['x2',x2],['y2',y2]].forEach(([k,v])=>l.setAttribute(k,v));return l};
 (p.declencheurs||[]).forEach((d,k)=>{const choisi=mapSel&&mapSel.kind==='declencheur'&&mapSel.i===i&&mapSel.k===k;
  const fil=d.type==='fil';svg.append(ligne('lien',fil?(d.x1+d.x2)/2:d.x+d.w/2,fil?(d.y1+d.y2)/2:d.y+d.h/2,cx,cy));
  const el=document.createElement('div');el.dataset.kind='declencheur';el.dataset.i=i;el.dataset.k=k;
  if(fil){el.className='declencheur fil'+(choisi?' selected':'')+(d.locked?' locked':'');const s=document.createElementNS(nsSVG,'svg');
   s.setAttribute('viewBox','0 0 100 100');s.setAttribute('preserveAspectRatio','none');s.append(ligne('touche',d.x1,d.y1,d.x2,d.y2),ligne('trait',d.x1,d.y1,d.x2,d.y2));el.append(s);
   [['a',d.x1,d.y1],['b',d.x2,d.y2]].forEach(([g,x,y])=>{const h=document.createElement('span');h.className='grip bout';h.dataset.grip=g;h.style.left=x+'%';h.style.top=y+'%';el.append(h)})}
  else{el.className='shape declencheur zone'+(d.type==='bloc'?' hitbox':'')+(choisi?' selected':'')+(d.locked?' locked':'');el.style.left=d.x+'%';el.style.top=d.y+'%';el.style.width=d.w+'%';el.style.height=d.h+'%';
   ['nw','ne','sw','se'].forEach(g=>{const h=document.createElement('span');h.className='grip '+g;h.dataset.grip=g;el.append(h)})}
  out.push(el)});
 if(svg.childNodes.length)out.unshift(svg);return out}
/* La fiche d'un piège : son nom et sa description ; son apparence — jeton, icône, image importée, ou l'image seule — ; caché ou
   non, et le test qui le détecte ; au contact ou non, et ses déclencheurs ; ses parades, chacune par son test ; ses effets. */
const piegeDialog=dialog('piege-editor','Piège','<form id="piege-form"><div id="piege-fields"></div><div class="form-actions"><button type="button" id="piege-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openPiege(i){const m=mapDraft,p=m&&m.pieges&&m.pieges[i];if(!p||view!=='mj')return;
 piegeDialog.querySelector('h2').textContent=p.nom||'Piège';
 const nb=(lab,name,v,min,max)=>field(lab,name,v,'number','min="'+min+'" max="'+max+'"');
 const coche=(name,txt,on)=>'<label class="field-check"><input type="checkbox" name="'+name+'"'+(on?' checked':'')+'>'+txt+'</label>';
 const choix=(lab,name,v,opts)=>'<label>'+lab+'<select name="'+name+'">'+opts.map(([k,t])=>'<option value="'+esc(String(k))+'"'+(String(k)===String(v)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
 const comps=l=>(l||skillNames.map((_,k)=>k)).map(k=>[k,skillNames[k]]);
 // Une parade sur une ligne : sa case, puis, cochée, la compétence et les réussites du test — et ce qu'elle a de plus.
 const parade=(cle,pre,nom,on,t,liste,def,plus='')=>'<div class="piege-parade">'+coche(cle,nom,on)+'<span class="piege-si" data-si="'+cle+'">'
  +'<select name="'+pre+'_comp" aria-label="Compétence">'+comps(liste).map(([k,x])=>'<option value="'+k+'"'+(k===(t?t.comp:def)?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'
  +'<input type="number" name="'+pre+'_n" min="1" max="9" value="'+(t?t.reussites:1)+'" aria-label="Réussites"><span>réussites</span>'+plus+'</span></div>';
 let image=p.image||null;const pertes=(p.caracs||[]).map(b=>({...b}));
 $('piege-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',p.nom||'Piège','text','required maxlength="60"')+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="2" maxlength="600">'+esc(p.desc||'')+'</textarea></label>'
  +'<h2 class="sous-titre">Apparence</h2><div class="edit-grid">'+choix('Affichage','affichage',p.affichage||'jeton',[['jeton','Jeton'],['image','Image seule']])+selLogos('Icône','logo',p.logo||'')+'</div>'
  +'<div class="piege-image"><span class="piege-apercu" id="piege-apercu"></span><button type="button" id="piege-image-importer">Importer une image</button><button type="button" id="piege-image-retirer">Retirer l’image</button><input type="file" id="piege-image-fichier" accept="image/png,image/webp,image/jpeg,image/gif" hidden></div>'
  +'<h2 class="sous-titre">Détection</h2>'+parade('cache','det','Caché',!!p.cache,p.detection,DETECTION_PIEGE,3)
  +'<h2 class="sous-titre">Déclenchement</h2><div class="coffre-cases">'+coche('contact','Au contact',p.contact!==false)+coche('actif','Toujours actif',!!p.actif)+'</div>'
  +'<div class="piege-declencheurs" id="piege-declencheurs"></div>'
  +'<h2 class="sous-titre">Parades</h2>'+parade('desamorcable','des','Désamorçable',!!p.desamorcage,p.desamorcage,DESAMORCAGE_PIEGE,5)
  +parade('evitable','evi','Évitable',!!p.evitement,p.evitement,null,0,'<span>· Si réussi :</span><select name="evi_issue" aria-label="Si le test réussit">'+[['esquive','Esquive le piège'],['moitie','Moitié des dégâts, sans état ni perte']].map(([k,x])=>'<option value="'+k+'"'+((p.evitement?p.evitement.issue:'esquive')===k?' selected':'')+'>'+x+'</option>').join('')+'</select>')
  +parade('enjambable','enj','Enjambable',!!p.enjambement,p.enjambement,null,0)
  +'<div class="coffre-cases">'+coche('reamorcable','Réamorçable',!!p.reamorcable)+'</div>'
  +'<h2 class="sous-titre">Effets</h2><div class="edit-grid">'+field('Dégâts','degats',formuleDegats(p),'text','pattern="[0-9]{1,2}([dD][0-9]{1,3})?" maxlength="6" class="degats-formule"')+'</div>'
  +casesEtatsCrans(p)
  +'<div class="piege-pertes" id="piege-pertes"></div>';
 const f=$('piege-form').elements;
 // Toujours actif, il ne se franchit qu'en l'enjambant : la case Enjambable va avec.
 const montre=()=>{if(f.actif.checked)f.enjambable.checked=true;f.enjambable.disabled=f.actif.checked;piegeDialog.querySelectorAll('.piege-si').forEach(b=>{b.hidden=!f[b.dataset.si].checked});montreCrans(piegeDialog)};
 ['cache','desamorcable','evitable','enjambable','actif'].forEach(k=>{f[k].onchange=montre});piegeDialog.querySelectorAll('input[name="etat"]').forEach(x=>{x.onchange=montre});montre();
 const apercu=()=>{$('piege-apercu').replaceChildren(visuelPiege({image,logo:f.logo.value}));$('piege-image-retirer').hidden=!image};
 f.logo.addEventListener('change',apercu);apercu();
 $('piege-image-importer').onclick=()=>$('piege-image-fichier').click();
 $('piege-image-fichier').onchange=()=>{const x=$('piege-image-fichier').files[0];$('piege-image-fichier').value='';if(x)openImage(x,'token',url=>{image=url;apercu()})};
 $('piege-image-retirer').onclick=()=>{image=null;apercu()};
 const n=(v,max)=>Math.max(0,Math.min(max,Math.trunc(Number(v))||0));
 const lisTest=cle=>({comp:Number(f[cle+'_comp'].value)||0,reussites:Math.max(1,n(f[cle+'_n'].value,9))});
 const applique=()=>{pushUndo();
  p.nom=f.nom.value.trim().slice(0,60)||'Piège';p.desc=f.desc.value.trim().slice(0,600);
  p.affichage=f.affichage.value==='image'?'image':'jeton';if(f.logo.value)p.logo=f.logo.value;else delete p.logo;if(image)p.image=image;else delete p.image;
  if(f.cache.checked)p.cache=true;else delete p.cache;p.detection=lisTest('det');p.contact=f.contact.checked;
  if(f.desamorcable.checked)p.desamorcage=lisTest('des');else delete p.desamorcage;
  if(f.evitable.checked)p.evitement={...lisTest('evi'),issue:f.evi_issue.value==='moitie'?'moitie':'esquive'};else delete p.evitement;
  if(f.enjambable.checked||f.actif.checked)p.enjambement=lisTest('enj');else delete p.enjambement;if(f.actif.checked)p.actif=true;else delete p.actif;
  if(f.reamorcable.checked)p.reamorcable=true;else delete p.reamorcable;
  {const d=lisFormuleDegats(f.degats.value);if(d){p.degats=d.degats;if(d.degatsDes)p.degatsDes=d.degatsDes;else delete p.degatsDes}}p.etats=[...piegeDialog.querySelectorAll('input[name="etat"]:checked')].map(x=>x.value).filter(x=>ETATS_JEU.includes(x));lisCrans(piegeDialog,p);
  p.caracs=cleanPertes(pertes)};
 // Les déclencheurs liés : une ligne chacun, que la croix retire ; les deux boutons en tracent un de plus sur la carte.
 const listeDecl=()=>{const b=$('piege-declencheurs');b.replaceChildren();let nz=0,nf=0;
  (p.declencheurs||[]).forEach((d,k)=>{const l=document.createElement('span');l.className='piege-decl';l.textContent=d.type==='fil'?'Fil '+(++nf):d.type==='bloc'?'Hitbox':'Zone '+(++nz);
   // Un clic sur son nom le choisit sur la carte, Sélection en main : on le déplace, on l'étire.
   l.onclick=ev=>{if(ev.target!==l)return;applique();piegeDialog.close();mapTool='select';mapSel={kind:'declencheur',i,k};renderCanvas();renderMapList();saveMaps()};
   const x=document.createElement('button');x.type='button';x.className='ico';x.textContent='✕';x.setAttribute('aria-label','Retirer '+l.textContent);
   x.onclick=()=>{pushUndo();p.declencheurs.splice(k,1);listeDecl();renderCanvas();saveMaps()};l.append(x);b.append(l)});
  [['zone','+ Zone de déclenchement'],['fil','+ Fil de déclenchement'],['bloc','+ Hitbox de blocage']].forEach(([type,txt])=>{const t=document.createElement('button');t.type='button';t.textContent=txt;
   t.disabled=(p.declencheurs||[]).length>=12;t.onclick=()=>{applique();piegeDialog.close();piegeLie=i;mapTool=type==='fil'?'piegefil':type==='bloc'?'piegebloc':'piegezone';mapSel={kind:'piege',i};renderCanvas();renderMapList();saveMaps()};b.append(t)})};
 listeDecl();
 // Les pertes de caractéristique : une ligne chacune — laquelle, combien, pour combien de temps.
 const listePertes=()=>{const b=$('piege-pertes');b.replaceChildren();
  pertes.forEach((x,k)=>{const l=document.createElement('div');l.className='piege-perte';
   const sel=(opts,v,fn)=>{const s=document.createElement('select');opts.forEach(([a,t])=>s.append(new Option(t,String(a),false,String(a)===String(v))));s.onchange=()=>{fn(s.value);listePertes()};return s};
   l.append(sel(CARACS_EQUIP,x.carac,v=>{x.carac=v}));
   if(x.carac==='comp')l.append(sel(skillNames.map((nom,j)=>[j,nom]),x.comp,v=>{x.comp=v}));
   const v=document.createElement('input');v.type='number';v.min='1';v.max='99';v.value=x.valeur;v.setAttribute('aria-label','Perte');v.oninput=()=>{x.valeur=Math.max(1,Math.min(99,Math.trunc(Number(v.value))||1))};l.append('−',v);
   l.append(sel([['perm','Permanente'],['repos','Jusqu’au repos']],x.duree,d=>{x.duree=d}));
   const s=document.createElement('button');s.type='button';s.className='ico';s.textContent='✕';s.setAttribute('aria-label','Retirer cette perte');s.onclick=()=>{pertes.splice(k,1);listePertes()};l.append(s);
   b.append(l)});
  if(pertes.length<6){const a=document.createElement('button');a.type='button';a.textContent='+ Perte de caractéristique';a.onclick=()=>{pertes.push({carac:'vie',valeur:1,comp:'0',duree:'perm'});listePertes()};b.append(a)}};
 listePertes();
 $('piege-form').onsubmit=e=>{e.preventDefault();applique();piegeDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('piege-suppr').onclick=()=>{if(!confirm('Supprimer « '+p.nom+' » ?'))return;pushUndo();
  m.pieges.splice(i,1);mapSel=null;piegeDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 piegeDialog.showModal()}
$('piege-edit').onclick=()=>{if(mapSel&&mapSel.kind==='piege')openPiege(mapSel.i)};
// Dupliquer : le même piège, réglages et déclencheurs compris, posé un peu plus loin et réarmé.
$('piege-double').onclick=()=>{const p=mapSel&&mapSel.kind==='piege'&&shapeAt(mapSel);if(!p)return;pushUndo();const c=structuredClone(p),dx=Math.min(2,100-p.x-p.w),dy=Math.min(2,100-p.y-p.h);
 c.id=crypto.randomUUID();c.x+=dx;c.y+=dy;['revele','declenche','desamorce','rate'].forEach(k=>delete c[k]);
 (c.declencheurs||[]).forEach(d=>{d.id=crypto.randomUUID();const b=v=>Math.max(0,Math.min(100,v));if(d.type==='fil'){d.x1=b(d.x1+dx);d.x2=b(d.x2+dx);d.y1=b(d.y1+dy);d.y2=b(d.y2+dy)}else{d.x=b(d.x+dx);d.y=b(d.y+dy)}});
 mapDraft.pieges.push(c);mapSel={kind:'piege',i:mapDraft.pieges.length-1};renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()};
const coffreDialog=dialog('coffre-editor','Coffre','<form id="coffre-form"><div id="coffre-fields"></div><div class="form-actions"><button type="button" id="coffre-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openCoffre(i){const m=mapDraft,c=m&&m.coffres&&m.coffres[i];if(!c||view!=='mj')return;
 coffreDialog.querySelector('h2').textContent=c.nom||'Coffre';
 const nb=(lab,name,v,min,max)=>field(lab,name,v,'number','min="'+min+'" max="'+max+'"');
 const coche=(name,txt,on)=>'<label class="field-check"><input type="checkbox" name="'+name+'"'+(on?' checked':'')+'>'+txt+'</label>';
 $('coffre-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',c.nom||'Coffre','text','required maxlength="60"')+'</div>'
  +'<label>Description lue par les joueurs<textarea name="desc" rows="2" maxlength="600">'+esc(c.desc||'')+'</textarea></label>'
  // Caché, verrouillé, piégé : chaque case ouvre ses champs, et seulement elle.
  +'<div class="coffre-cases">'+coche('cache','Caché',!!c.cache)+coche('ferme','Verrouillé',c.verrou>0)+coche('piege_on','Piégé',c.piege>0)+coche('groupe','Coffre de groupe',c.groupe===true)+'</div>'
  +'<div class="edit-grid coffre-si" data-si="cache">'+nb('Réussites de Perception pour le trouver','perception',c.perception||1,1,9)+coche('pierre','Dans la pierre',c.pierre===true)+'</div>'
  +'<div class="edit-grid coffre-si" data-si="ferme">'+nb('Réussites de Ruse ou Technique','verrou',Math.max(1,c.verrou||1),1,9)
  +'<label>Clé qui l’ouvre<select name="cleId"></select></label>'
  // v1.053 : un code (des chiffres, autant de cases chez les joueurs) ou un mot de passe (ni casse, ni pluriel).
  +field('Code ou mot de passe','code',c.code||'','text','maxlength="40" autocomplete="off"')+'</div>'
  +'<div class="coffre-si" data-si="piege_on"><div class="edit-grid">'+nb('Réussites de Ruse ou Technique pour le trouver','piege',Math.max(1,c.piege||1),1,9)+field('Dégâts du piège','degats',formuleDegats(c),'text','pattern="[0-9]{1,2}([dD][0-9]{1,3})?" maxlength="6" class="degats-formule"')+'</div>'
  // v1.066 : un état cumulable coché prend sa quantité, « x » ou « xdy » comme les dégâts.
  +casesEtatsCrans(c)+'</div>'
  +'<h2 class="sous-titre">Contenu</h2><div class="coffre-tresor" id="coffre-bourse"></div>'
  +'<div id="coffre-contenu"></div>';
 const f=$('coffre-form').elements;remplitCles(f.cleId,c.cleId||'');
 const montre=()=>{coffreDialog.querySelectorAll('.coffre-si').forEach(b=>{b.hidden=!f[b.dataset.si].checked});
  montreCrans(coffreDialog)};
 ['cache','ferme','piege_on'].forEach(k=>{f[k].onchange=montre});coffreDialog.querySelectorAll('input[name="etat"]').forEach(x=>{x.onchange=montre});montre();
 /* L'or et les gemmes, tirés aux dés à l'ouverture : « x d y » par ligne. Ce qu'un coffre d'avant tenait
    en nombres fixes s'y lit en dés à une face, trente pièces valant 30d1. */
 const bourse={bourse:[...normaliseBourse(c.bourse,false),...CLES_RICHESSES.filter(k=>(Math.trunc(Number((c.richesses||{})[k]))||0)>0).map(k=>({k,n:Math.min(9999,Math.trunc(Number(c.richesses[k]))),f:1}))]};
 $('coffre-bourse').append(editeurBourse(bourse,null,false));
 // Les pièces de l'armurerie, choisies comme l'inventaire d'un adversaire : un clic, une de plus ; le clic droit, une de moins.
 const contenu={inventaire:[...(c.items||[])]};contenuCoffre($('coffre-contenu'),contenu);
 $('coffre-form').onsubmit=e=>{e.preventDefault();const n=(v,max)=>Math.max(0,Math.min(max,Math.trunc(Number(v))||0));pushUndo();
  c.nom=f.nom.value.trim().slice(0,60)||'Coffre';c.desc=f.desc.value.trim().slice(0,600);if(f.groupe.checked)c.groupe=true;else delete c.groupe;
  if(f.cache.checked){c.cache=true;c.perception=Math.max(1,n(f.perception.value,9));if(f.pierre.checked)c.pierre=true;else delete c.pierre}else{delete c.cache;delete c.pierre}
  c.verrou=f.ferme.checked?Math.max(1,n(f.verrou.value,9)):0;if(f.ferme.checked&&f.cleId.value)c.cleId=f.cleId.value;else delete c.cleId;
  {const cd=String(f.code.value||'').trim().slice(0,40);if(f.ferme.checked&&cd)c.code=cd;else delete c.code}
  c.piege=f.piege_on.checked?Math.max(1,n(f.piege.value,9)):0;{const d=c.piege?lisFormuleDegats(f.degats.value):null;if(!c.piege){c.degats=0;delete c.degatsDes}else if(d){c.degats=d.degats;if(d.degatsDes)c.degatsDes=d.degatsDes;else delete c.degatsDes}}
  c.etats=c.piege?[...coffreDialog.querySelectorAll('input[name="etat"]:checked')].map(x=>x.value).filter(x=>ETATS_JEU.includes(x)):[];
  lisCrans(coffreDialog,c);
  c.richesses={};const b=normaliseBourse(bourse.bourse,false);if(b.length)c.bourse=b;else delete c.bourse;
  c.items=[...contenu.inventaire].slice(0,99);coffreDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 $('coffre-suppr').onclick=()=>{if(!confirm('Supprimer « '+c.nom+' » ?'))return;pushUndo();
  m.coffres.splice(i,1);mapSel=null;coffreDialog.close();renderCanvas();renderMapList();saveMaps();if(m.id===currentMapId)render()};
 coffreDialog.showModal()}
/* Ce qu'un coffre contient, en petits carrés comme l'inventaire d'un adversaire : les familles à
   allumer, un filtre, et l'armurerie ; un clic ajoute un exemplaire, le clic droit en retire un. Au-dessus,
   ce qui est déjà dedans, chaque pièce et son nombre. */
const CATS_COFFRE=[['armes','Armes',o=>o.category==='weapon'||o.category==='ammo'],['armures','Armures',o=>o.category==='armor'],
 ['objets','Objets',o=>!['weapon','ammo','armor','restes','ressource','cle','herbe','recette'].includes(o.category)],['ressources','Ressources',o=>o.category==='ressource'],
 ['cles','Clés',o=>o.category==='cle'],['restes','Restes',o=>o.category==='restes'],['herbes','Herboristerie',o=>o.category==='herbe'],['recettes','Recettes',o=>o.category==='recette']];
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
  (catalog.items||[]).filter(o=>o&&!o.forge&&tests.some(t=>t(o))&&(!q||String(o.name||'').toLowerCase().includes(q)))
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
// v1.052 : « Largeur » — la carte touche les deux bords du cadre, à gauche et à droite ; on la voit depuis son haut.
$('czoom-largeur').onclick=()=>{const c=$('map-canvas'),w=$('map-canvas').parentElement,cw=c.offsetWidth||1,ch=c.offsetHeight||1,W=w.clientWidth||cw,H=w.clientHeight||ch;
 const z=Math.min(8,Math.max(1,W/cw));if(z<=1.001){zoomC=1;panCX=panCY=0;applyCanvasZoom();return}
 zoomC=z;panCX=-(W-cw)/2;panCY=-(H-ch)/2;applyCanvasZoom()};
const wrap=document.querySelector('.canvas-wrap');
wrap.addEventListener('wheel',e=>{if(estPaysage(mapDraft))return;const r=$('map-canvas').getBoundingClientRect();
 // Le pincement du trackpad arrive en molette avec ctrlKey : c'est le zoom du système.
 if(e.ctrlKey||e.metaKey){e.preventDefault();zoomCanvasAt(Math.exp(-e.deltaY*.0035),e.clientX-r.left,e.clientY-r.top);return}
 if(zoomC>1){e.preventDefault();panCX-=e.deltaX;panCY-=e.deltaY;applyCanvasZoom()}},{passive:false});
let gestC=1;
wrap.addEventListener('gesturestart',e=>{e.preventDefault();gestC=zoomC});
wrap.addEventListener('gesturechange',e=>{e.preventDefault();if(estPaysage(mapDraft))return;const r=$('map-canvas').getBoundingClientRect();
 zoomCanvasAt(gestC*e.scale/zoomC,e.clientX-r.left,e.clientY-r.top)});

/* ---------- Accès depuis la table de jeu ---------- */
const mapPick=document.createElement('select');mapPick.id='map-pick';mapPick.setAttribute('aria-label','Carte de combat');
mapPick.style.width='auto';mapPick.style.margin='0';
const mapOpen=document.createElement('button');mapOpen.id='map-open';mapOpen.textContent='Ouvrir la carte';
// Les cartes se choisissent et s'ouvrent depuis l'onglet Cartes : la barre de la table
// n'en propose plus ni la liste, ni l'ouverture, ni l'import d'image.
function refreshMapPick(){mapPick.replaceChildren();maps.filter(m=>!estPaysage(m)).forEach(m=>mapPick.add(new Option(m.name,m.id)));
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
// Le mouvement limité en exploration : les aventuriers ne vont pas plus loin que leur distance de mouvement.
const limiteBtn=icone('mouvement-limite','👣','Mouvement limité');
// L'obscurité de la carte, activée ou désactivée par le MJ, pour toute la table.
const noirBtn=icone('obscurite-bascule','🌑','Désactiver l’obscurité');
// Le bruit, activé ou désactivé par le MJ, pour toute la table.
const bruitBtn=icone('bruit-bascule','🔊','Désactiver le bruit');
// Le terrain impraticable, montré ou caché au MJ ; la troupe ne le voit jamais.
const impratBtn=icone('impraticables-vue','🚧','Cacher le terrain impraticable');
fogBar.append(fogReset,fogAll,noirBtn,eyeBtn,zonesBtn,lockBtn,limiteBtn,bruitBtn,impratBtn);document.querySelector('.mapbar .zoom-bar').before(fogBar);
// Un paysage affiché : le MJ le ferme, et sa carte revient.
const paysageFin=document.createElement('button');paysageFin.id='paysage-fin';paysageFin.type='button';paysageFin.textContent='Fermer le paysage';paysageFin.hidden=true;
paysageFin.onclick=()=>fermerPaysage();fogBar.before(paysageFin);
/* Les boutons de la barre de la carte disent ce qu'ils font dès le survol, dans une bulle du site : l'infobulle du système
   tardait et ne ressemblait à rien d'ici. Leur titre devient le texte de la bulle, et celui qu'un rendu leur redonne aussi ;
   le nom reste au lecteur d'écran. Au doigt, pas de bulle : un toucher n'est pas un survol. */
const barreCarte=document.querySelector('.mapbar');let boutonSurvole=null;
function texteBouton(b){if(b.hasAttribute('title')){const t=b.getAttribute('title');b.removeAttribute('title');
  if(t){b.dataset.infobulle=t;if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',t)}}
 return b.dataset.infobulle||b.getAttribute('aria-label')||''}
const BOUTONS_CARTE={
 portees:()=>['Contacts',porteesOn?'Les contacts de tous les combattants sont affichés ; un clic ne garde que ceux de la sélection.':'Affiche les contacts de tous les combattants, aventuriers et adversaires révélés.'],
 'fouilles-vue':()=>['Fouilles',(fouillesOn?'Masque':'Affiche')+' les zones où un test de Perception a déjà été fait'+(view==='mj'?' ; un clic droit les efface sur cette carte.':'.')],
 'distances-vue':()=>['Distances',(distancesOn?'Masque':'Affiche')+' les distances sur les flèches de ciblage.'],
 'coffres-bulles':()=>['Coffres',(bullesCoffresMJ?'Masque':'Affiche')+' la bulle des coffres au survol.'],
 'fog-reset':()=>['Brouillard','Remet le brouillard : la carte redevient inexplorée pour la troupe.'],
 'fog-all':()=>{const m=currentMap();return ['Tout révéler',m&&m.fogOff?'Le voile est levé pour tous ; un clic rétablit le brouillard.':'Lève le voile : toute la carte devient visible pour tous.']},
 'obscurite-bascule':()=>{const m=currentMap();return ['Obscurité',m&&m.obscuriteOff?'L’obscurité est désactivée pour toute la table ; un clic la rétablit.':'Désactive l’obscurité de la carte pour toute la table.']},
 'troupe-eye':()=>['Vue de la troupe',vueTroupe?'Tu vois la carte comme la troupe ; un clic rend la vue du MJ.':'Montre la carte comme la voit la troupe, sans quitter la vue du MJ.'],
 'zones-eye':()=>['Zones',(zonesVisibles?'Cache':'Montre')+' les zones de la carte, chacune de sa couleur et de son numéro.'],
 'token-lock':()=>['Verrou',tokensLocked?'Les déplacements des joueurs sont figés ; un clic les leur rend.':'Fige les déplacements des joueurs, le temps de décrire une scène.'],
 'impraticables-vue':()=>['Terrain impraticable',impratVisible?'Les pointillés rouges du terrain impraticable sont visibles ; un clic les cache. La troupe ne les voit jamais.':'Le terrain impraticable est caché ; un clic montre ses pointillés rouges.'],
 'bruit-bascule':()=>['Bruit',bruitCoupe?'Le bruit est désactivé pour toute la table ; un clic le rétablit.':'Désactive le bruit pour toute la table : les adversaires pas encore révélés n’entendent plus rien.'],
 'mouvement-limite':()=>['Mouvement limité',mouvementLimiteExplo?'En exploration, chaque aventurier ne va pas plus loin que sa distance de mouvement ; un clic lève la limite.':'En exploration, limite chaque déplacement à la distance de mouvement de l’aventurier.'],
 'zoom-out':()=>['Dézoomer','Éloigne la vue de la carte.'],
 'zoom-in':()=>['Zoomer','Rapproche la vue de la carte.'],
 'zoom-reset':()=>['Ajuster','Ajuste la carte entière au cadre.'],
 'zoom-centre':()=>['Centrer','Centre la vue sur le token sélectionné, sans changer le zoom.']};
function bulleBouton(b){let nom='',dit=texteBouton(b);if(BOUTONS_CARTE[b.id])try{[nom,dit]=BOUTONS_CARTE[b.id]()}catch(e){}
 if((!nom&&!dit)||b.hidden||typeof ouvrirBulle!=='function'||bulleEpinglee)return;
 const d=document.createElement('div');d.className='talent-detail large bulle-etat bulle-bouton-texte';
 if(nom){const t=document.createElement('p');t.className='talent-bulle-nom';const n=document.createElement('b');n.textContent=nom;t.append(n);d.append(t)}
 if(dit){const p=document.createElement('p');p.className='palier-effet';p.textContent=dit;d.append(p)}
 ouvrirBulle(b,d,'bulle-talent bulle-bouton')}
barreCarte.querySelectorAll('[title]').forEach(texteBouton);
new MutationObserver(ms=>ms.forEach(m=>{const b=m.target;if(!(b instanceof Element)||!b.hasAttribute('title'))return;
 texteBouton(b);if(b===boutonSurvole)bulleBouton(b)})).observe(barreCarte,{subtree:true,attributes:true,attributeFilter:['title']});
barreCarte.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const b=e.target.closest('button');
 if(!b||!barreCarte.contains(b)||b===boutonSurvole)return;boutonSurvole=b;bulleBouton(b)});
// Un clic change l'état du bouton : sa bulle se relit aussitôt.
barreCarte.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b===boutonSurvole)requestAnimationFrame(()=>{if(b===boutonSurvole)bulleBouton(b)})});
barreCarte.addEventListener('pointerout',e=>{const b=e.target.closest('button');if(!b||b!==boutonSurvole||b.contains(e.relatedTarget))return;
 boutonSurvole=null;if(bulleAncre===b&&!bulleEpinglee)fermerBulle()});
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
noirBtn.onclick=()=>{const m=currentMap();if(!m)return;if(m.obscuriteOff)delete m.obscuriteOff;else m.obscuriteOff=true;
 fogKey='';refreshGmBar();render();scheduleSave()};
impratBtn.onclick=()=>{impratVisible=!impratVisible;try{localStorage.setItem('amertume-impraticables',impratVisible?'1':'0')}catch(e){}
 refreshGmBar();renderImpraticables()};
bruitBtn.onclick=()=>{bruitCoupe=!bruitCoupe;try{localStorage.setItem('amertume-bruit-coupe',bruitCoupe?'1':'0')}catch(e){}
 refreshGmBar();render();scheduleSave()};
limiteBtn.onclick=()=>{mouvementLimiteExplo=!mouvementLimiteExplo;try{localStorage.setItem('amertume-mouvement-limite',mouvementLimiteExplo?'1':'0')}catch(e){}
 refreshGmBar();render();scheduleSave()};
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
 document.body.classList.toggle('vue-paysage',estPaysage(m));paysageFin.hidden=!mj||!estPaysage(m);
 if(titre&&mj&&m&&!estPaysage(m)){const donne=Math.max(0,Math.trunc(Number(m.xpAccordee))||0),reste=actors.filter(a=>a&&!duCoteTroupe(a)).reduce((s,a)=>s+(Math.max(0,Math.trunc(Number(a.xp))||0)),0);
  const x=document.createElement('span');x.className='xp-carte';x.textContent=donne+'/'+(donne+reste)+' xp';titre.append(x)}
 fogBar.hidden=!mj||estPaysage(m);fogReset.hidden=fogAll.hidden=!m;
 fogAll.classList.toggle('on',!!(m&&m.fogOff));eyeBtn.hidden=!m;eyeBtn.classList.toggle('on',vueTroupe);
 zonesBtn.hidden=!m;zonesBtn.classList.toggle('on',zonesVisibles);zonesBtn.title=zonesVisibles?'Cacher les zones de la carte':'Voir les zones de la carte';
 fogAll.title=m&&m.fogOff?'Rétablir le brouillard':'Tout révéler';
 noirBtn.hidden=!m||!obscuriteDe(m).length;noirBtn.classList.toggle('on',!!(m&&m.obscuriteOff));
 noirBtn.title=m&&m.obscuriteOff?'Activer l’obscurité':'Désactiver l’obscurité';noirBtn.setAttribute('aria-label',noirBtn.title);
 /* Changer de carte en pleine partie appartient au MJ : la liste et son bouton suivent
    donc la vue, et non le seul fait qu'il existe des cartes. Ils étaient montés une fois
    pour toutes avant le chargement de la partie, quand « maps » était encore vide : ils
    ne reparaissaient plus jusqu'à la première retouche de carte. */
 mapPick.hidden=mapOpen.hidden=!mj||!maps.length;
 lockBtn.textContent=tokensLocked?'🔒':'🔓';lockBtn.classList.toggle('on',tokensLocked);
 lockBtn.title=tokensLocked?'Rendre les déplacements aux joueurs':'Figer les déplacements des joueurs';
 limiteBtn.classList.toggle('on',!!mouvementLimiteExplo);
 impratBtn.hidden=!m||!impraticableDe(m).length;impratBtn.classList.toggle('on',!impratVisible);
 impratBtn.title=impratVisible?'Cacher le terrain impraticable':'Montrer le terrain impraticable';impratBtn.setAttribute('aria-label',impratBtn.title);
 bruitBtn.textContent=bruitCoupe?'🔇':'🔊';bruitBtn.classList.toggle('on',!!bruitCoupe);
 bruitBtn.title=bruitCoupe?'Activer le bruit':'Désactiver le bruit';bruitBtn.setAttribute('aria-label',bruitBtn.title)}
function saveMaps(){refreshMapPick();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}

// L'onglet Cartes n'existe que pour le MJ ; passer en vue joueur ramène à la table.
/* Le cadre prend la taille de la carte avant tout : ce que le rendu mesure — vue,
   contact, révélation — se mesure dans le bon cadre dès le premier passage. */
const renderBeforeMaps=render;render=function(){
 // Une autre carte, ou un voile qui change : elle se couvre jusqu'à la prochaine peinture.
 if(cleVoile()!==cartePeinte)voileAttente.hidden=false;
 // Le cadre posé, il se mesure une fois pour tout le rendu.
 applyMapRatio();const dehors=cadreFige;cadreFige=mesureCadre();
 /* v1.080 : la carte, mesurée ici, ne se remesure pas au milieu du rendu : la relire après tant de changements forçait la page
    entière à se recalculer. La rangée des Actions qui change de hauteur la fait remesurer d'elle-même (son observateur). */
 ratioDuRendu=true;
 try{computeFog();oublieEntendus();renderBeforeMaps();renderMapLayer();renderFouilles()}finally{cadreFige=dehors?cadreFige:null;ratioDuRendu=false}
 calerColonnes();
 majOnglets()};
/* Le journal descend jusqu'au bas de la carte : son panneau est calé dessus à chaque rendu
   et à chaque changement de taille. Sur une seule colonne, il reprend sa hauteur propre. */
function calerColonnes(){const centre=document.querySelector('.layout>.stack:not(.left):not(.right)'),droite=document.querySelector('.stack.right'),gauche=document.querySelector('.stack.left');
 if(!centre||!droite||!centre.lastElementChild)return;
 // Le bas du dernier panneau affiché de la colonne du centre : la rangée du bas, vidée, ne compte plus.
 const rc=centre.getBoundingClientRect(),rd=droite.getBoundingClientRect(),bas=[...centre.children].filter(e=>e.offsetParent).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0);
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
/* Un onglet que seul le MJ ouvre, retenu sur l'appareil : c'est l'appareil du MJ, sa vue est celle du MJ. */
document.addEventListener('amertume-partie-chargee',()=>{refreshMapPick();const p=lastPage();
 if(p!=='table'&&!vueChoisie()&&!ongletsJoueurs().includes(p))retiensVue('mj');if(p!=='table')showPage(p)});

// La rangée du bas vidée, la carte descend jusqu'au bas de la page ouverte ; sur un écran étroit, tout défile comme avant.
{const hauteurAvantRangee=hauteurDispoCarte;hauteurDispoCarte=function(el){const rangee=document.querySelector('.actions-rangee'),r=el.getBoundingClientRect();
 if(innerWidth<=900||!rangee||!rangee.classList.contains('vide')||!el.offsetParent||!r.width)return hauteurAvantRangee(el);
 const layout=document.querySelector('.layout'),marge=layout?parseFloat(getComputedStyle(layout).paddingBottom)||0:0;
 return Math.round(innerHeight-(r.top+scrollY)-marge-2)}}
/* ---------- Les panneaux à la taille de chacun ----------
   Le bouton ⇔ de la barre de la carte déverrouille la mise en page : des poignées paraissent entre les colonnes et sous la
   carte, et se glissent. La colonne des combattants, celle de la fiche et du journal, la hauteur de la carte : chaque taille se
   garde sur l'appareil. Un double-clic sur une poignée rend sa taille d'origine ; recliquer sur ⇔ reverrouille l'ensemble. */
const TAILLES_CLE='amertume-tailles';
function lisTailles(){try{const t=JSON.parse(localStorage.getItem(TAILLES_CLE)||'{}');return t&&typeof t==='object'?t:{}}catch(e){return {}}}
function gardeTailles(t){try{localStorage.setItem(TAILLES_CLE,JSON.stringify(t))}catch(e){}}
function appliqueTailles(){const L=document.querySelector('main.layout');if(!L)return;const t=lisTailles();L.style.gridTemplateColumns='';
 if(innerWidth<=1150||!(t.g||t.d))return;const [g,,d]=getComputedStyle(L).gridTemplateColumns.split(/\s+/).map(parseFloat);
 L.style.gridTemplateColumns=Math.round(t.g||g)+'px minmax(0,1fr) '+Math.round(t.d||d)+'px'}
/* Le panneau de la carte touche le bas de l'écran, quelle que soit la forme de l'image : la carte garde ses proportions, et le
   panneau s'allonge sous elle de ce qui manque. Sur un écran étroit, tout défile comme avant. */
{const ratioSeul=applyMapRatio;applyMapRatio=function(){const change=ratioSeul(),el=$('map'),panneau=el&&el.closest('.map-panel');if(!panneau)return change;
 const m=currentMap();if(innerWidth<=900||!m||!m.ratio||!el.offsetParent){panneau.style.minHeight='';return change}
 const haut=el.getBoundingClientRect().top-panneau.getBoundingClientRect().top;panneau.style.minHeight=Math.round(haut+Math.max(260,hauteurDispoCarte(el)))+'px';return change}}
// La hauteur de la carte choisie à la main passe avant celle qui tient dans l'écran.
{const hauteurAvantTailles=hauteurDispoCarte;hauteurDispoCarte=function(el){const h=Math.round(Number(lisTailles().h));return h>=200?h:hauteurAvantTailles(el)}}
let renduTailles=0;const rendTailles=()=>{if(renduTailles)return;renduTailles=requestAnimationFrame(()=>{renduTailles=0;render()})};
function poigneeTaille(parent,cle,sens){const p=document.createElement('div');p.className='poignee-taille poignee-'+cle;p.setAttribute('aria-hidden','true');
 p.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();p.setPointerCapture(e.pointerId);
  const L=document.querySelector('main.layout'),cols=getComputedStyle(L).gridTemplateColumns.split(/\s+/).map(parseFloat);
  const depart=cle==='h'?$('map').getBoundingClientRect().height:cle==='g'?cols[0]:cols[2],x0=e.clientX,y0=e.clientY;
  const bouge=ev=>{const t=lisTailles();
   if(cle==='h')t.h=Math.round(Math.max(200,Math.min(2400,depart+ev.clientY-y0)));
   else t[cle]=Math.round(Math.max(170,Math.min(640,depart+(sens*(ev.clientX-x0)))));
   gardeTailles(t);appliqueTailles();rendTailles()};
  const fin=()=>{p.removeEventListener('pointermove',bouge);p.removeEventListener('pointerup',fin);p.removeEventListener('pointercancel',fin);rendTailles()};
  p.addEventListener('pointermove',bouge);p.addEventListener('pointerup',fin);p.addEventListener('pointercancel',fin)});
 p.addEventListener('dblclick',()=>{const t=lisTailles();delete t[cle];gardeTailles(t);appliqueTailles();rendTailles()});
 // Dans une colonne, la poignée passe en tête : le dernier panneau reste le dernier, et le journal garde sa hauteur calée sur la carte.
 if(cle==='h')parent.append(p);else parent.prepend(p)}
{const g=document.querySelector('main.layout>.stack.left'),d=document.querySelector('main.layout>.stack.right'),c=document.querySelector('.map-panel');
 if(g)poigneeTaille(g,'g',1);if(d)poigneeTaille(d,'d',-1);if(c)poigneeTaille(c,'h',1)}
$('redim-panneaux').onclick=()=>{const on=document.body.classList.toggle('redim');$('redim-panneaux').classList.toggle('on',on);$('redim-panneaux').setAttribute('aria-pressed',on?'true':'false')};
addEventListener('resize',appliqueTailles);appliqueTailles();
/* ---------- Le zoom de chacun, par carte ----------
   Le zoom et le point visé se gardent sur l'appareil, carte par carte : à l'ouverture d'une carte, au rechargement, la vue revient
   où on l'avait laissée. « Ajuster » la remet à 100 %, et c'est ce qui se garde alors. */
const ZOOMS_CLE='amertume-zooms';let zoomGardeTimer=0,zoomReprisPour=null,zoomEnReprise=false,zoomPrevu=0;
function lisZooms(){try{const t=JSON.parse(localStorage.getItem(ZOOMS_CLE)||'{}');return t&&typeof t==='object'?t:{}}catch(e){return {}}}
{const applyAvantGarde=applyMapZoom;applyMapZoom=function(){applyAvantGarde.apply(this,arguments);
 const id=typeof currentMapId!=='undefined'&&currentMapId;if(!id||zoomEnReprise||zoomReprisPour!==id)return;
 clearTimeout(zoomGardeTimer);zoomGardeTimer=setTimeout(()=>{const m=$('map'),w=m.clientWidth,h=m.clientHeight;if(!w||!h||currentMapId!==id)return;
  const t=lisZooms();delete t[id];t[id]={z:+mapZoom.toFixed(3),x:+((w/2-mapPanX)/(w*mapZoom)).toFixed(4),y:+((h/2-mapPanY)/(h*mapZoom)).toFixed(4)};
  const c=Object.keys(t);c.slice(0,Math.max(0,c.length-30)).forEach(k=>delete t[k]);try{localStorage.setItem(ZOOMS_CLE,JSON.stringify(t))}catch(e){}},400)}}
function reprendZoom(){const id=typeof currentMapId!=='undefined'&&currentMapId,m=$('map'),w=m.clientWidth,h=m.clientHeight;if(!id||!w||!h)return;
 zoomReprisPour=id;const s=lisZooms()[id];if(!s||!(s.z>0)||!Number.isFinite(s.x)||!Number.isFinite(s.y))return;
 zoomEnReprise=true;try{mapZoom=Math.min(8,Math.max(1,s.z));mapPanX=w/2-s.x*w*mapZoom;mapPanY=h/2-s.y*h*mapZoom;vueCadre={w,h};applyMapZoom()}finally{zoomEnReprise=false}}
// Une carte qui paraît — ouverte, reçue de la table, retrouvée au chargement — reprend son zoom, une fois posée à l'écran.
{const renderAvantZoom=render;render=function(){renderAvantZoom.apply(this,arguments);
 if(typeof currentMapId!=='undefined'&&currentMapId&&zoomReprisPour!==currentMapId&&!zoomPrevu)zoomPrevu=setTimeout(()=>{zoomPrevu=0;if(zoomReprisPour!==currentMapId)reprendZoom()},80)}}
/* ---------- Le ping ----------
   Alt + clic sur la carte, hors d'un token : un signal s'y anime, chez tous à la table. Celui du MJ est doré, celui d'un joueur
   vert d'eau. */
function pingCarte(x,y,mj){if(!Number.isFinite(x)||!Number.isFinite(y))return;const el=document.createElement('div');el.className='ping-carte'+(mj?' mj':'');
 el.style.left=Math.max(0,Math.min(100,x))+'%';el.style.top=Math.max(0,Math.min(100,y))+'%';el.setAttribute('aria-hidden','true');
 el.innerHTML='<i></i><i></i><i></i><b></b>';$('map-view').append(el);setTimeout(()=>el.remove(),2600)}
$('map').addEventListener('pointerdown',e=>{if(!e.altKey||e.button!==0||e.target.closest('.token')||!currentMap())return;
 e.preventDefault();e.stopImmediatePropagation();const p=mapPct(e),mj=view==='mj';pingCarte(p.x,p.y,mj);if(typeof diffuserPing==='function')diffuserPing(p.x,p.y,mj)},true);
// v0.897 : Gageur — un adversaire dont un Fielsang tient le gage, à 10 m de lui, se voit toujours.
{const ps=partySees,tv=troupeVoit;partySees=function(a){return ps(a)||(typeof troupeVoitParGage==='function'&&troupeVoitParGage(a))};troupeVoit=function(a){return tv(a)||(typeof troupeVoitParGage==='function'&&troupeVoitParGage(a))}}

/* ---------- v1.013 — Les effets des potions d'herboristerie ----------
   Ce que l'emploi d'une potion laisse sur le buveur : une vision dans le noir jusqu'au prochain repos long (« visionPotion » :
   les mètres), une lumière jusqu'à la fin de la carte (« lumierePotion » : la carte, les mètres), des PM jusqu'à la fin du combat (« pmPotion »), un enduit sur
   ses prochaines attaques (« enduit » : les états, le nombre d'attaques), et, pour toute la troupe, le répulsif des bêtes
   (« repulsif » : la carte). Le reste agit sur l'instant : relever un aventurier tombé, une couleur de dés choisie, une purge,
   un objet lancé, une recette apprise, les passages secrets de la pièce. */
const CODES_POTION=['boirelancer','vision','mouvement','resurrection','fluxdes','purge','repulsif','enduit','lancer','lumiere','grimoire','revelesecrets','perceintangible','veille','soinpurge'];
function finPotion(a,o,dit){const u=usageObjet(o);if(usageLimite(u))a.usages={...(a.usages||{}),[o.id]:u};if(usageConsomme(u))retirerInventaire(a,o);
 log(nomNum(a)+' emploie '+o.name+(dit?' : '+dit:'')+'.',{ton:'talent'});if(typeof annonceFlottante==='function')annonceFlottante('◈ '+o.name+(dit?' · '+dit:''));
 render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
const menuAuCentre=(titre,entrees)=>menuCarte(titre,entrees,innerWidth/2-90,innerHeight/2-60);
const estBete=o=>{if(!o||o.hero)return false;const t=o.template&&(catalog.monsters||[]).find(x=>x&&x.id===o.template);
 return famillesDe(o).includes('betes')||/b[êe]te/i.test(String(o.family||(t&&t.family)||''))};
const carteDuMoment=()=>String(currentMapId||'hors-carte');
const repousse=a=>!!a&&a.hero===true&&!!a.repulsif&&a.repulsif===carteDuMoment()&&estBete(actors[selected]);
// Ceux qui touchent la cible d'un objet lancé : ses alliés à son contact, sans mur entre eux.
function voisinsDuLancer(vise,a){const size=mapSize();if(!size.width)return [];const murs=walls();
 return actors.filter(o=>o&&o!==vise&&alive(o)&&!o.horsCarte&&hostiles(o,a)&&inContact(vise,o,size,tokenOf(vise),tokenOf(o))&&!wallsBetween(vise,o,murs))}
function poseEtatPotion(x,etat,crans,a){let ok=false;for(let i=0;i<Math.max(1,crans|0);i++){const r=infligeEtat(x,etat);if(r===true)ok=true;else break}
 if(ok&&etat==='Charme')x.charmePar=a.id;if(ok&&typeof floatNumber==='function')floatNumber(x,'✦ '+etat+(crans>1?' '+crans:''),'perte');return ok}
/* v1.014 — Ce qu'un objet lancé peut toucher : par famille — végétale, fongique —, par rang — un lieutenant est une créature
   vivante organique, ni plante, ni champignon, ni méca, ni mort-vivant, qui n'est pas un boss. */
const FAMILLES_VEGETALES=['plantes','plantesligneuses','plantescarnivores','sylvestres','gardienssylvestres','bosssylvestres'];
// Ses familles : les siennes, sinon celles de son modèle au bestiaire — un adversaire posé ne les recopie pas.
const famillesDe=o=>{if(!o||typeof normaliseFamillesMonstre!=='function')return [];const l=normaliseFamillesMonstre(o.familles);if(l.length)return l;
 const t=o.template&&(catalog.monsters||[]).find(x=>x&&x.id===o.template);return t?normaliseFamillesMonstre(t.familles):[]};
// v1.076 : végétal, de la famille Plantes, hors de la sous-famille Fongiques.
const estVegetal=o=>{if(!o||o.hero)return false;const f=famillesDe(o);return f.some(k=>FAMILLES_VEGETALES.includes(k))&&!f.includes('fongiques')};
const estFongique=o=>!!o&&!o.hero&&(famillesDe(o).includes('fongiques')||(typeof porteTalent==='function'&&porteTalent(o,'sensiblefongicide')));
const estBoss=o=>!!o&&o.type==='boss';
const estLieutenant=o=>!!o&&!o.hero&&!estBoss(o)&&natureDe(o)==='vivant'&&!estVegetal(o)&&!estFongique(o);
function cibleAdmise(x,p){const c=p.cibles||'';if(c==='vegetal'&&!estVegetal(x))return false;if(c==='fongique'&&!estFongique(x))return false;if(c==='vegetalfongique'&&!estVegetal(x)&&!estFongique(x))return false;
 if(p.rangs==='sanslieutenants'&&(estLieutenant(x)||estBoss(x)))return false;if(p.rangs==='lieutenants'&&!estLieutenant(x))return false;return true}
function lancerPotion(a,o,p){if(!mapSize().width){log(o.name+' se lance sur la carte.',{local:true});return}
 let portee=p.portee==='contact'?'contact':'distance';
 viserCible('◈ '+o.name+' — clique '+(p.detruit==='oui'?'l’adversaire ou le terrain visé':'l’adversaire visé'),(vise,q)=>{
  // Le Sel de racine : un terrain dangereux coché « Sel », au contact du lanceur, est détruit.
  if((!vise||!hostiles(vise,a))&&p.detruit==='oui'&&q){const z=formeDangerSous(q,t=>t.sel===true);
   if(z&&formeAPortee(a,z.p)){detruitForme(z);finPotion(a,o,z.t.nom+' détruit');return}}
  const j=actors.indexOf(vise);
  // v1.018 : « au contact ou à distance » — au contact du lanceur, le jet part au contact, sans opportunité.
  if(p.portee==='deux')portee=vise&&contactsDe(a).includes(vise)?'contact':'distance';
  if(!vise||!alive(vise)||!hostiles(vise,a)||!ciblesAtteignables(a,[j],portee).length){log(o.name+' : vise un adversaire '+(portee==='contact'?'au contact':'en vue')+'.',{local:true});return}
  if(!cibleAdmise(vise,p)){log(o.name+' est sans effet sur '+nomNum(vise)+'.',{local:true});return}
  const crans=Math.max(1,p.crans|0),autres=(p.zone==='tous'?actors.filter(x=>x&&alive(x)&&!x.horsCarte&&hostiles(x,a)&&(x.revealed||x.hero)):p.zone==='voisins'?[vise,...voisinsDuLancer(vise,a)]:[]).filter(x=>cibleAdmise(x,p));
  const pose=x=>{const ok=poseEtatPotion(x,p.etat,crans,a);if(ok&&(p.duree==='1'||p.duree==='2')&&enCombat())ajouteEtatBref(x,p.etat,round+(p.duree==='2'?1:0));return ok};
  const poseAutres=()=>p.etat?autres.filter(x=>(p.de&&p.zone==='voisins'&&x===vise)?false:alive(x)&&pose(x)):[];
  if(p.de){if(enCombat()&&pointsRestants(a,'action')<1){log(nomNum(a)+' a déjà dépensé son Action ce tour.',{local:true});return}
   finPotion(a,o,'lancé sur '+nomNum(vise));selected=actors.indexOf(a);
   // v1.018 : un jet qui rend Tangible (le Sel bleu) blesse aussi l'Intangible qu'il vise.
   jetPerceSur=p.etat==='Tangible'?{b:vise,t:Date.now(),sel:p.seuil==='oui'}:null;
   // v1.020 : Hantise du sel — un Sel bleu lui vaut 2 dés rouges ; il coupe la Source.
   const hante=p.seuil==='oui'&&porteTalent(vise,'hantisesel'),deJet=hante?'red':p.de,nbJet=hante?2:Math.max(1,p.nb|0);
   if(p.seuil==='oui'&&porteTalent(vise,'source')&&enCombat()){vise.sourceCoupee={c:numeroCombat,r:round+1};log(phraseJournal(talentDe(vise,'source'),'source','coupee',{lanceur:nomNum(vise)}),{ton:'talent'})}
   attack({vises:[j],desSeuls:DICE_KEYS.map(c=>c===deJet?nbJet:0),sansArme:true,portee,sansDegats:true,potion:true,
    etatsEnPlus:{etats:p.etat&&p.zone!=='tous'?Array(crans).fill(p.etat):[],touches:[]},
    apres:()=>{jetPerceSur=null;const t=poseAutres();if(t.length)log(o.name+' : '+p.etat+(crans>1?' '+crans:'')+' sur '+t.map(nomNum).join(', ')+'.',{ton:'talent'});render();scheduleSave()}});return}
  if(!payeAction(a))return;
  const cibles=p.zone==='cible'?[vise]:autres,t=p.etat?cibles.filter(pose):[];
  finPotion(a,o,'lancé sur '+nomNum(vise)+(t.length?', '+p.etat+(crans>1?' '+crans:'')+' sur '+t.map(nomNum).join(', '):', sans effet'))},o.name+' : geste annulé.')}
function releverAvecPotion(a,o,h){if(estMort(h)){if(h.poussiere===true)return;h.vie=1}
 h.comaVie=false;h.states=[];h.cumuls={};h.bleed=0;if(typeof leveNecrose==='function')leveNecrose(h);if(typeof recalculerPV==='function')recalculerPV(h);h.hp=h.max;setState(h,'Coma',false);
 if(h.horsCarte){h.horsCarte=false;moveActor(h,a.x,a.y,true)}
 finPotion(a,o,nomNum(h)+' se relève, PV au complet')}
function revelePassages(a){const m=currentMap(),zones=m&&zonesDe(m),z=zoneDe(a);if(!m||!z)return 0;let n=0;
 (m.doors||[]).forEach(d=>{if(!d||!d.secret||d.decouvert||d.open)return;const c=centreForme(d),r=1.5;
  if([[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,-r],[r,-r],[-r,r]].some(([dx,dy])=>zoneAu(zones,c.x+dx,c.y+dy)===z)){d.decouvert=true;n++;floatNumber(c,'Révélé !','nul')}});
 if(n)saveMaps();return n}
{const ae=appliquerEffetObjet;appliquerEffetObjet=function(a,o){const code=objetCode(o);if(!a||!code||!CODES_POTION.includes(code.cle))return ae(a,o);
 if(!objetDisponible(a,o)){log(o.name+' a déjà servi aujourd’hui : il faut une nuit de repos.',{local:true});return}
 const p=paramsObjet(o)||{},carte=carteDuMoment();
 switch(code.cle){
  case 'vision':a.visionPotion={m:Math.max(1,p.portee|0)};finPotion(a,o,'voit dans le noir à '+a.visionPotion.m+' m');return;
  case 'lumiere':a.lumierePotion={carte,m:Math.max(1,p.m|0)};finPotion(a,o,'éclaire à '+a.lumierePotion.m+' m');return;
  case 'mouvement':a.pmPotion=Math.min(3,(Math.trunc(Number(a.pmPotion))||0)+Math.max(1,p.n|0));finPotion(a,o,'+'+Math.max(1,p.n|0)+' PM jusqu’à la fin du combat');return;
  case 'enduit':{const etats=[p.etat,p.etat2].filter((e,i,l)=>e&&l.indexOf(e)===i),n=Math.max(1,p.n|0);a.enduit={etats,n};
   finPotion(a,o,(n>1?'ses '+n+' prochaines attaques posent ':'sa prochaine attaque pose ')+etats.join(' et '));return}
  case 'repulsif':actors.filter(h=>h&&h.hero).forEach(h=>{h.repulsif=carte});finPotion(a,o,'les bêtes ne surprennent plus la troupe');return;
  case 'purge':{const leves=[p.etat,p.etat2].filter((e,i,l)=>e&&l.indexOf(e)===i).filter(e=>{const avait=hasState(a,e)||(e==='Nécrose'&&Number(a.necrose)>0);
    if(e==='Nécrose'&&typeof leveNecrose==='function')leveNecrose(a);setState(a,e,false);if(a.cumuls)delete a.cumuls[e];return avait});
   finPotion(a,o,leves.length?leves.join(' et ')+(leves.length>1?' levés':' levé'):'rien à lever');return}
  case 'fluxdes':menuAuCentre(o.name,DES_ORBE.filter(([k])=>k!=='green').map(([k,n])=>[n,()=>{poseImmunite(a,'des',k);finPotion(a,o,'insensible aux dés '+n.toLowerCase()+'s')}]));return;
  case 'resurrection':{const tombes=actors.filter(h=>h&&h.hero&&h!==a&&h.poussiere!==true&&(estMort(h)||Number(h.hp)<=0));
   if(!tombes.length){log('Aucun aventurier tombé à relever.',{local:true});return}
   menuAuCentre(o.name,tombes.map(h=>[nomNum(h),()=>releverAvecPotion(a,o,h)]));return}
  case 'lancer':if(p.seuil==='oui'){menuAuCentre(o.name,[['Lancer',()=>lancerPotion(a,o,p)],['Tracer un seuil',()=>tracerSeuil(a,o)]]);return}lancerPotion(a,o,p);return;
  // v1.018 : percer les Intangibles jusqu'à la fin du prochain combat ; la lanterne agit portée ; soigner et purger.
  case 'perceintangible':a.perceIntangible={portee:p.portee==='tout'?'tout':'arme',malus:Math.max(0,p.malus|0)};finPotion(a,o,a.perceIntangible.portee==='tout'?'ses coups et sorts blessent les Intangibles':'son arme blesse les Intangibles');return;
  case 'veille':log(o.name+' agit tant qu’elle est portée.',{local:true});return;
  case 'soinpurge':{const n=Math.max(1,p.quantite|0),jets=p.forme==='des'?Array.from({length:n},()=>d6()):[],gagne=applyHeal(a,jets.length?jets.reduce((s,v)=>s+v,0):n);
   if(jets.length&&typeof rollOnBoard==='function')rollOnBoard(jets.map(v=>[v,4]),a,a);if(gagne&&typeof floatNumber==='function')floatNumber(a,'+'+gagne,'gain');
   const avait=hasState(a,p.etat)||(p.etat==='Nécrose'&&Number(a.necrose)>0);if(p.etat==='Nécrose'&&typeof leveNecrose==='function')leveNecrose(a);setState(a,p.etat,false);if(a.cumuls)delete a.cumuls[p.etat];
   finPotion(a,o,'+'+gagne+' PV'+(avait?', '+p.etat+' levée':''));return}
  // v1.014 : bu, il retire un état ; lancé, des dés contre une créature d'une famille.
  case 'boirelancer':menuAuCentre(o.name,[['Boire',()=>{const avait=hasState(a,p.etat);setState(a,p.etat,false);if(a.cumuls)delete a.cumuls[p.etat];finPotion(a,o,avait?p.etat+' levée':'rien à lever')}],
   ['Lancer',()=>lancerPotion(a,o,{de:p.de,nb:p.nb,etat:'',crans:1,zone:'cible',portee:'distance',cibles:p.cibles,rangs:'',duree:'',detruit:'non'})]]);return;
  case 'grimoire':{const r=objetDe(p.recette);if(!r){log(o.name+' : aucune recette.',{local:true});return}
   if((a.recettes||[]).includes(r.id)){log(nomNum(a)+' connaît déjà la recette : '+r.name+'.',{local:true});return}
   // v1.055 : une Recette ne s'apprend qu'au rang d'herboriste qu'elle demande.
   if(o.category==='recette'&&typeof refusHerbo==='function'&&r.herbo){const refus=refusHerbo(a,r,null);if(refus){log(nomNum(a)+' ne peut pas apprendre '+r.name+' : '+refus.charAt(0).toLowerCase()+refus.slice(1),{local:true});return}}
   a.recettes=[...(a.recettes||[]),r.id];finPotion(a,o,'apprend la recette : '+r.name);return}
  case 'revelesecrets':{const n=revelePassages(a);finPotion(a,o,n?n+' passage'+(n>1?'s secrets révélés':' secret révélé'):'aucun passage secret');return}}}}
// Les PM de la potion, jusqu'à la fin du combat.
{const pt=pointsDeTalents;pointsDeTalents=function(a,quoi){return pt(a,quoi)+(quoi==='mouvement'&&a&&a.pmPotion>0?Math.min(3,Math.trunc(a.pmPotion)):0)}}
{const bm=basculerMode;basculerMode=function(neuf,...x){const fin=mode==='combat'&&neuf!=='combat';const r=bm(neuf,...x);if(fin)actors.forEach(a=>{if(a&&a.pmPotion)delete a.pmPotion});return r}}
// La lumière de la potion, sur la carte où elle a été bue ; sa vision dans le noir, jusqu'au prochain repos long (v1.060).
{const vn=visionNoirDe;visionNoirDe=function(a){const v=vn(a),p=a&&a.visionPotion;return p&&(!p.carte||p.carte===carteDuMoment())?Math.max(v,Number(p.m)||0):v}}
{const lp=lumierePortee;lumierePortee=function(a,items){const v=lp(a,items),p=a&&a.lumierePotion;return p&&p.carte===carteDuMoment()?Math.max(v,Number(p.m)||0):v}}
// Le répulsif : une bête ne surprend plus la troupe.
{const ia=insensibleA;insensibleA=function(a,etat){return ia(a,etat)||(etat==='Surpris'&&repousse(a))}}
{const ss=setState;setState=function(a,etat,pose,...x){if(pose&&etat==='Surpris'&&repousse(a))return;return ss(a,etat,pose,...x)}}
// L'enduit : les états qu'il pose s'ajoutent à chaque attaque du porteur, jusqu'à la dernière.
{const at=attack;attack=function(opts={}){const a=actors[selected],e=a&&a.enduit;if(!e||!(e.n>0)||!Array.isArray(e.etats)||!e.etats.length||(opts&&opts.potion))return at(opts);
 const ep=opts.etatsEnPlus||{etats:[],touches:[]},avant=ep.etats||[],ap=opts.apres;ep.etats=[...avant,...e.etats];
 return at({...opts,etatsEnPlus:ep,apres:r=>{ep.etats=avant;if(a.enduit){a.enduit.n--;if(!(a.enduit.n>0))delete a.enduit}if(ap)ap(r);else{render();scheduleSave()}}})}}

/* ---------- v1.014 — Le terrain dangereux ----------
   Dans l'éditeur, ses outils tracent dans le type choisi au menu ; « ✎ Type » ouvre sa fiche. À la table, il frappe un token
   sensible quand un déplacement le traverse ou s'y arrête, puis en combat à chaque fin de tour passée dedans. Les Gants de
   ronceur, portés, protègent des types cochés « Ronces » ; le Sel de racine détruit, au contact, la forme d'un type coché
   « Sel » — pour toute la table, jusqu'à ce que la carte soit rechargée. */
let dangerCourant=null;
function typeDangerCourant(creer){const m=mapDraft;if(!m)return null;const l=dangersDe(m);let t=l.find(x=>x.id===dangerCourant)||l[0]||null;
 if(!t&&creer){t=cleanDanger({id:crypto.randomUUID(),nom:'Terrain dangereux'});l.push(t)}if(t)dangerCourant=t.id;return t}
/* v1.068 — Les types de terrain dangereux sont communs à toutes les cartes : le menu offre ceux de chaque carte, un même nom
   n'y paraissant qu'une fois. Choisir un type qu'une carte n'a pas encore l'y copie, sans terrain ; la fiche d'un type,
   enregistrée, vaut pour toutes les cartes qui portent ce nom. Le terrain tracé reste propre à chaque carte. */
const cleTypeDanger=t=>String(t&&t.nom||'').normalize('NFC').trim().toLowerCase();
function typesDangerCommuns(){const vus=new Map();[mapDraft,...(typeof maps!=='undefined'?maps:[])].forEach(m=>{if(!m||!Array.isArray(m.dangers))return;
 m.dangers.forEach(t=>{const k=cleTypeDanger(t);if(k&&!vus.has(k))vus.set(k,t)})});return vus}
const PROPS_TYPE_DANGER=['nom','couleur','degats','degatsDes','etats','sensibles','ronces','sel'];
function copieTypeDanger(de,vers){PROPS_TYPE_DANGER.forEach(k=>{if(de[k]===undefined)delete vers[k];else vers[k]=JSON.parse(JSON.stringify(de[k]))})}
function majTypesDanger(){const s=$('map-danger-type');if(!s||!mapDraft)return;const l=dangersDe(mapDraft),t=typeDangerCourant(false),ici=new Set(l.map(cleTypeDanger));
 const ailleurs=[...typesDangerCommuns().entries()].filter(([k])=>!ici.has(k));
 s.innerHTML=[...l.map(x=>[x.nom,x.id]),...ailleurs.map(([k,x])=>[x.nom,'__commun:'+k])].sort((a,b)=>a[0].localeCompare(b[0],'fr'))
  .map(([n,v])=>'<option value="'+esc(v)+'">'+esc(n)+'</option>').join('')+'<option value="__nouveau">+ Nouveau type…</option>';s.value=t?t.id:'__nouveau'}
const dangerDialog=dialog('danger-editor','Terrain dangereux','<form id="danger-form"><div id="danger-fields"></div><div class="form-actions"><button type="button" id="danger-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openDanger(t){if(!t||view!=='mj')return;dangerDialog.querySelector('h2').textContent=t.nom;
 $('danger-fields').innerHTML='<div class="edit-grid">'+field('Nom','nom',t.nom,'text','required maxlength="40"')
  +'<label>Couleur<input type="color" name="couleur" value="'+esc(t.couleur)+'"></label>'
  +field('Dégâts — 2, ou 1d6','degats',formuleDegats(t),'text','maxlength="6"')
  +sel('Frappe','sensibles',t.sensibles,SENSIBLES_DANGER)+'</div>'
  +'<div class="coffre-etats">'+ETATS_JEU.map(e=>'<label class="field-check"><input type="checkbox" name="etat" value="'+esc(e)+'"'+((t.etats||[]).includes(e)?' checked':'')+'>'+esc(e)+'</label>').join('')+'</div>'
  +'<div class="coffre-cases"><label class="field-check"><input type="checkbox" name="ronces"'+(t.ronces?' checked':'')+'>Ronces — les Gants de ronceur en protègent</label>'
  +'<label class="field-check"><input type="checkbox" name="sel"'+(t.sel?' checked':'')+'>Sel — le Sel de racine le détruit</label></div>';
 $('danger-form').onsubmit=e=>{e.preventDefault();const f=$('danger-form').elements;pushUndo();
  const avant=cleTypeDanger(t);
  t.nom=f.nom.value.trim().slice(0,40)||'Terrain dangereux';if(/^#[0-9a-fA-F]{6}$/.test(f.couleur.value))t.couleur=f.couleur.value;
  {const d=lisFormuleDegats(f.degats.value);if(d){t.degats=d.degats;if(d.degatsDes)t.degatsDes=d.degatsDes;else delete t.degatsDes}}
  t.sensibles=SENSIBLES_DANGER.some(([k])=>k===f.sensibles.value)?f.sensibles.value:'tous';
  t.etats=[...dangerDialog.querySelectorAll('input[name="etat"]:checked')].map(x=>x.value).filter(x=>ETATS_JEU.includes(x));
  if(f.ronces.checked)t.ronces=true;else delete t.ronces;if(f.sel.checked)t.sel=true;else delete t.sel;
  // v1.068 : le même type, sur les autres cartes, prend la même fiche.
  maps.forEach(m=>{if(!m||!Array.isArray(m.dangers))return;m.dangers.forEach(x=>{if(x!==t&&cleTypeDanger(x)===avant)copieTypeDanger(t,x)})});
  dangerDialog.close();matiereChangee()};
 $('danger-suppr').onclick=()=>{if(!confirm('Supprimer « '+t.nom+' » et tout son terrain ?'))return;pushUndo();const l=dangersDe(mapDraft),i=l.indexOf(t);if(i>=0)l.splice(i,1);
  dangerCourant=null;dangerDialog.close();matiereChangee()};
 dangerDialog.showModal()}
if($('map-danger-type'))$('map-danger-type').onchange=e=>{if(!mapDraft)return;
 if(e.target.value.startsWith('__commun:')){const src=typesDangerCommuns().get(e.target.value.slice(9));if(!src){majTypesDanger();return}pushUndo();
  const t=cleanDanger({id:crypto.randomUUID(),nom:src.nom});copieTypeDanger(src,t);t.formes=[];dangersDe(mapDraft).push(t);dangerCourant=t.id;majTypesDanger();saveMaps();return}
 if(e.target.value==='__nouveau'){pushUndo();const t=cleanDanger({id:crypto.randomUUID(),nom:'Terrain dangereux'});
  dangersDe(mapDraft).push(t);dangerCourant=t.id;majTypesDanger();openDanger(t);return}dangerCourant=e.target.value;majTypesDanger()};
if($('map-danger-edit'))$('map-danger-edit').onclick=()=>{if(!mapDraft)return;const t=typeDangerCourant(true);majTypesDanger();if(t)openDanger(t)};
{const rc=renderCanvas;renderCanvas=function(...x){const r=rc(...x);majTypesDanger();return r}}
// La forme active sous un point de la carte, et son type.
function formeDangerSous(q,garde){const m=currentMap();if(!m)return null;
 for(const t of dangersDe(m)){if(garde&&!garde(t))continue;for(const p of formesActives(m,t)){const r=p.anneaux&&p.anneaux[0];if(r&&pointInPolygon([q.x,q.y],r))return {t,p}}}return null}
const formeAPortee=(a,p)=>!!a&&!!p&&polyInReach(a,p.anneaux[0],mapSize(),tokenOf(a));
function detruitForme(z){const m=currentMap();if(!m||!z)return;m.dangersDetruits=[...new Set([...(m.dangersDetruits||[]),cleFormeDanger(z.t,z.p)])];renderDangers();scheduleSave()}
// v1.028 : toute pièce portée à l'effet « Protège des ronces » ; le nom des Gants de ronceur reste en secours.
const porteGantsRonceur=h=>!!h&&(h.armures||[]).concat(h.weapons||[],[h.shieldId,h.munitionId]).some(id=>{const it=id&&(catalog.items||[]).find(x=>x&&x.id===id);return !!it&&(it.effet==='protegeronces'||/gants de ronceur/i.test(it.name))});
const sensibleAuDanger=(o,t)=>!!o&&alive(o)&&!o.horsCarte&&!o.orbeStatique&&(t.sensibles==='tous'||(t.sensibles==='heros')===(o.hero===true))&&!(t.ronces&&porteGantsRonceur(o));
/* v1.028 — Au journal : « Ronces blesse Drachir : 5 dégâts + [icône] Saignée. » Le terrain en gras, de sa couleur ; les dégâts sans le détail
   des dés ; chaque état posé, son icône et son nom, en gras et de sa couleur. */
function frappeDanger(o,t){const jet=tireDegats(t),parts=[];
 if(jet.total>0){const {perdu:n,blinde}=encaisse(o,jet.total,null);parts.push(blinde?'Blindage consommé':n+' dégât'+(n>1?'s':''))}
 (t.etats||[]).forEach(e=>{if(alive(o)&&infligeEtat(o,e)===true)parts.push('⸢'+e+'⸣')});
 if(!parts.length)return false;floatNumber(o,t.nom,'perte');
 const nom=String(t.nom||'Terrain dangereux').replace(/[⁅⁆¦]/g,''),teinte=/^#[0-9a-fA-F]{3,8}$/.test(String(t.couleur||''))?'¦'+t.couleur:'';
 log('⁅'+nom+teinte+'⁆ blesse '+nomNum(o)+' : '+parts.join(' + ')+'.',{ton:'degats'});return true}
// Les formes d'un type, en pixels de carte.
const formesPx=(m,t,size)=>formesActives(m,t).map(p=>p.anneaux[0].map(q=>[q[0]/100*size.width,q[1]/100*size.height]));
function dangerAuPassage(o,chemin){const m=currentMap(),size=mapSize();if(!m||!size.width||!Array.isArray(chemin)||chemin.length<2||!dangersDe(m).length)return;
 const pts=chemin.filter(Boolean).map(q=>[q.x/100*size.width,q.y/100*size.height]);let frappe=false;
 dangersDe(m).forEach(t=>{if(!sensibleAuDanger(o,t))return;const polys=formesPx(m,t,size);if(!polys.length)return;
  if(pts.some(c=>polys.some(l=>pointInPolygon(c,l)))||pts.slice(1).some((c,i)=>segmentHitsPolys(pts[i],c,polys)))frappe=frappeDanger(o,t)||frappe});
 if(frappe){render();scheduleSave()}}
{const pm=passeMurs;passeMurs=function(o,chemin,...x){const r=pm(o,chemin,...x);try{dangerAuPassage(o,chemin)}catch(e){}return r}}
// La fin de chaque tour de combat : qui s'y tient encore est frappé ; puis les Sommeils d'un tour se lèvent.
{const ts=tourSuivant;tourSuivant=function(...x){
 try{const m=currentMap(),size=mapSize();if(enCombat()&&m&&size.width&&dangersDe(m).length){let f=false;
  actors.forEach(o=>{dangersDe(m).forEach(t=>{if(!sensibleAuDanger(o,t))return;const c=[o.x/100*size.width,o.y/100*size.height];if(formesPxTrous(m,t,size).some(fo=>dansFormePx(c,fo)))f=frappeDanger(o,t)||f})});
  if(f)scheduleSave()}}catch(e){}
 const r=ts(...x);
 try{actors.forEach(o=>{const l=etatsBrefs(o);if(!l.length)return;const reste=l.filter(b=>{if(round>b.r||!enCombat()){setState(o,b.e,false);return false}return true});
  if(reste.length)o.sommeilBref=reste.length>1?reste:reste[0];else delete o.sommeilBref});render()}catch(e){}
 return r}}

/* ---------- v1.017 — Les Boutons d'Interaction des objets et des coffres ----------
   Au contact d'un coffre ou d'un objet que la troupe voit — pas caché —, un rond paraît en son centre, comme sur une porte :
   Ouvrir un coffre, Inspecter un objet (Récolter une Ressource, Ouvrir un Coffre de Groupe). Le clic fait ce que faisait
   le clic sur l'objet. Leurs icônes se choisissent avec celles des actions spéciales. */
const ICONE_COFFRE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5V19h18v-8.5M3 10.5C3 7 5 5 8 5h8c3 0 5 2 5 5.5M3 10.5h18M10.5 10.5v3h3v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const ICONE_INSPECTER='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 15l5.5 5.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
function poseBoutonCarte(calque,x,y,nom,icone,svg,gris,faire,extra){const b=document.createElement('button');b.type='button';b.className='btn-action rond bouton-interaction'+(extra?' '+extra:'');
 b.style.left=x+'%';b.style.top=y+'%';b.style.setProperty('--echelle',echelleInteraction());
 const ic=typeof centreAction==='function'?centreAction(icone,null):null;if(ic&&typeof ic==='object')b.append(ic);else b.innerHTML=svg;
 b.setAttribute('aria-label',nom);if(typeof surveille==='function'&&typeof bulleAction==='function')surveille(b,()=>bulleAction(b,{nom}));
 if(typeof inerte==='function')inerte(b,gris);b.onpointerdown=e=>e.stopPropagation();b.onmousedown=e=>{e.preventDefault();e.stopPropagation()};
 b.onclick=e=>{e.stopPropagation();if(typeof fermerBulle==='function')fermerBulle();if(typeof estInerte==='function'&&estInerte(b))return;faire()};calque.append(b);return b}
// Ce que fait le geste sur un objet, pour l'aventurier du joueur au contact.
function agirSurObjet(a,o){if(!a||!o)return;if(o.groupe===true&&typeof ouvrirCoffreGroupe==='function'){ouvrirCoffreGroupe(a,o);return}
 if(o.indice)return;if(o.ressource===true){recolterRessource(a,o);return}recupererObjet(a,o)}
let objetsBoutonsCle='';
function renderBoutonsObjets(){let calque=$('objet-boutons');if(!calque){calque=document.createElement('div');calque.id='objet-boutons';$('map-view').append(calque);objetsBoutonsCle=''}
 const m=currentMap(),a=view==='mj'?heroActif():actors[owner],ok=!!m&&!!a&&a.hero&&alive(a)&&!a.horsCarte&&controlled(actors.indexOf(a));
 const coffres=ok?(m.coffres||[]).filter(c=>c&&coffreVisible(c)&&coffreEnVue(c)&&(!c.ouvert||c.groupe===true)&&coffreAPortee(a,c)):[];
 const objets=ok&&!enCombat()?(m.objets||[]).filter(o=>o&&!o.pris&&!o.indice&&(o.groupe===true||o.ressource===true)&&objetVu(o)&&objetAPortee(a,o)&&centreVuTroupe(o.x,o.y)):[];
 const gris=enCombat()&&!!a&&pointsRestants(a,'action')<=0;
 const cle=(a?a.id:'')+'|'+gris+'|'+Math.round(tokenPx())+'|'+coffres.map(c=>[c.x,c.y,c.w,c.h,c.ouvert?1:0].join(':')).join(',')+'|'+objets.map(o=>[o.x,o.y,o.id].join(':')).join(',');
 if(cle===objetsBoutonsCle&&calque.isConnected)return;objetsBoutonsCle=cle;calque.replaceChildren();
 coffres.forEach(c=>poseBoutonCarte(calque,c.x+c.w/2,c.y+c.h/2,'Ouvrir','ouvrircoffre',ICONE_COFFRE,gris,()=>ouvreCoffreJoueur(c)));
 objets.forEach(o=>poseBoutonCarte(calque,o.x,o.y,o.ressource===true?'Récolter':o.groupe===true?'Ouvrir':'Inspecter',o.groupe===true?'ouvrircoffre':'inspecter',o.groupe===true?ICONE_COFFRE:ICONE_INSPECTER,false,()=>agirSurObjet(a,o)))}
{const f=renderEnjamber;renderEnjamber=function(...x){const r=f.apply(this,x);renderBoutonsObjets();return r}}
/* v1.017 — L'Indice révélé qui attend son test : au survol, au-dessus de lui, un Bouton d'Interaction à l'icône et à la couleur
   de la compétence ; la bulle de l'indice s'y accroche. On y monte la souris — il reste —, et un clic fait le test. */
const indiceATester=o=>!!o&&o.indice&&objetVu(o)&&!o.examine&&!o.tente&&!!o.examen&&(o.examen.mode==='comp'||(o.examen.mode==='objet'&&!!objetDe(o.examen.item)));
let indiceBouton=null,indiceBoutonMinuteur=0;
function cacheIndiceBouton(){clearTimeout(indiceBoutonMinuteur);if(indiceBouton){indiceBouton.remove();indiceBouton=null;if(typeof fermerBulle==='function')fermerBulle()}}
function cacheIndiceBientot(){clearTimeout(indiceBoutonMinuteur);indiceBoutonMinuteur=setTimeout(()=>{const b=indiceBouton;if(!b)return;
 const t=document.querySelector('#map-view .token.objet[data-objet="'+CSS.escape(b.dataset.objet)+'"]');
 if(b.matches(':hover')||(t&&t.matches(':hover'))||document.querySelector('.bulle:hover'))return cacheIndiceBientot();cacheIndiceBouton()},250)}
function survolIndice(t,o){t.addEventListener('pointerenter',()=>montreIndiceBouton(t,o));t.addEventListener('pointerleave',cacheIndiceBientot)}
function montreIndiceBouton(t,o){clearTimeout(indiceBoutonMinuteur);if(indiceBouton&&indiceBouton.dataset.objet===t.dataset.objet)return;cacheIndiceBouton();
 let calque=$('indice-bouton');if(!calque){calque=document.createElement('div');calque.id='indice-bouton';$('map-view').append(calque)}
 const k=Math.max(0,Math.min(7,Number(o.examen.comp)||0)),size=mapSize(),haut=size.height?((tokenPx()*(SOCLE_TAILLES[o.taille]||1))/2+58*Number(echelleInteraction())/2+4)/size.height*100:4;
 const piece=o.examen.mode==='objet'?objetDe(o.examen.item):null;
 const b=poseBoutonCarte(calque,o.x,o.y-haut,piece?piece.name:'Test de '+skillNames[k],'',ICONE_INSPECTER,false,()=>{const a=heroActif();
  if(!a){log('Sélectionne d’abord ton aventurier.',{local:true});return}
  if(!objetAPortee(a,o)){log('Approche '+a.name+' : il faut être au contact de '+o.nom+'.',{local:true});return}
  cacheIndiceBouton();examinerIndice(a,o)},'btn-indice');
 b.replaceChildren();
 // v1.018 : l'Indice qui veut un objet porte l'icône de la pièce, sur le fond ordinaire des boutons.
 if(piece){const im=typeof logoEquipement==='function'?logoEquipement(piece):null;if(im)b.append(im);else b.textContent=piece.name.slice(0,2)}
 else{const ico=typeof logoCompetence==='function'?logoCompetence(k):null;if(ico)b.append(ico);else b.textContent=skillNames[k].slice(0,2);
  b.style.setProperty('--fond','rgb('+SKILL_TINTS[k]+')');b.style.color='#fff'}b.dataset.objet=t.dataset.objet;
 b.onmouseenter=()=>clearTimeout(indiceBoutonMinuteur);b.onmouseleave=cacheIndiceBientot;indiceBouton=b;
 if(typeof ouvrirBulle==='function')ouvrirBulle(b,bulleObjetCarte(o),'bulle-gear')}

/* ---------- v1.018 — Intangibles, Tangible, Esquive x+, Lanterne de veille, seuil de Sel bleu ----------
   Un combattant Intangible (talent) ne perd rien des coups qu'il reçoit, à moins d'être Tangible, ou que son agresseur ne le
   perce (« perceIntangible » : ses coups d'arme, ou tous ses coups et sorts, jusqu'à la fin du prochain combat ; « malus » :
   ce que chaque coup d'un Intangible lui fait de plus). Esquive x+ : sur un d6 de x ou plus, le combattant ignore tout d'une
   attaque — dégâts et états ; un Intangible dans la lumière d'une Lanterne de veille n'esquive plus, et un adversaire
   Invisible y est révélé. Le Sel bleu tracé sur un seuil : une ligne que nul Intangible ne franchit, jusqu'à la fin du combat. */
STATES.push('Tangible');GLYPHES_ETATS['Tangible']='⚓';COULEURS_ETATS['Tangible']='#4f6a86';
{const de0=descriptionEtat;descriptionEtat=function(o,etat){if(etat==='Tangible')return 'Les coups le blessent, même Intangible.';return de0(o,etat)}}
// Les états d'un tour ou deux : un, ou plusieurs à la fois.
const etatsBrefs=o=>[].concat((o&&o.sommeilBref)||[]).filter(b=>b&&typeof b.e==='string');
function ajouteEtatBref(x,e,r){const l=etatsBrefs(x).filter(b=>b.e!==e);l.push({e,r});x.sommeilBref=l.length>1?l:l[0]}
// v1.020 : Hors d'atteinte l'est aussi, et refuse en plus les états.
const intangibleDeNature=o=>!!o&&typeof porteTalent==='function'&&(porteTalent(o,'intangible')||porteTalent(o,'horsatteinte'));
const estIntangible=o=>intangibleDeNature(o)&&!hasState(o,'Tangible');
const perceDe=a=>{const p=a&&a.perceIntangible;return p&&typeof p==='object'?p:null};
const perceLIntangible=(a,arme)=>{const p=perceDe(a);return !!p&&(p.portee==='tout'||(p.portee==='arme'&&!!arme))};
// Les Lanternes de veille portées sur la carte, et jusqu'où elles éclairent.
function lanternesVeille(){const its=typeof items==='function'?items():(catalog.items||[]);
 return actors.filter(h=>h&&alive(h)&&!h.horsCarte).map(h=>{const l=objetsQuiComptent(h,its,o=>o.effet==='veille');
  return l.length?{h,m:Math.max(...l.map(o=>Math.max(1,(paramsObjet(o)||{}).m|0)))}:null}).filter(Boolean)}
function dansLanterne(o){const size=mapSize(),tk=tokenPx();if(!o||!size.width||!tk)return false;const murs=walls();
 return lanternesVeille().some(({h,m})=>h!==o&&hostiles(h,o)&&metres(h,o,size,tk)<=m&&!wallsBetween(h,o,murs))}
function esquiveActive(b){const x=esquiveDe(b);return x&&!(intangibleDeNature(b)&&dansLanterne(b))?x:0}
{const lp=lumierePortee;lumierePortee=function(a,its){const v=lp(a,its),l=objetsQuiComptent(a,its||[],o=>o.effet==='veille');
 return l.length?Math.max(v,...l.map(o=>Math.max(1,(paramsObjet(o)||{}).m|0))):v}}
// Dans la lumière d'une Lanterne de veille, l'adversaire Invisible est révélé.
function reveleParLanterne(){if(!lanternesVeille().length)return;let n=0;
 actors.forEach(o=>{if(o&&alive(o)&&!o.horsCarte&&hasState(o,'Invisible')&&dansLanterne(o)){setState(o,'Invisible',false);if(typeof floatNumber==='function')floatNumber(o,'Révélé !','nul');n++}});
 if(n){render();scheduleSave()}}
{const pm=passeMurs;passeMurs=function(...x){const r=pm(...x);try{reveleParLanterne()}catch(e){}return r}}
{const ts=tourSuivant;tourSuivant=function(...x){const r=ts(...x);try{reveleParLanterne()}catch(e){}return r}}
/* Le jet d'une attaque : la cible est celle dont les dés viennent d'être reçus (desRecus) ; l'agresseur, le lanceur de l'orbe
   en cours ou l'auteur du coup. L'Esquive passe d'abord : réussie, l'attaque échoue sans être un échec — ni relance, ni
   Revanche. Puis l'Intangible ne perd rien, à moins d'être percé ; un Intangible qui frappe un buveur d'Élixir lui fait plus. */
let cibleDuJet=null,lanceurOrbe=null,jetPerceSur=null,esquiveDite=null,derniereEsquive=null;
const jetPerce=b=>!!jetPerceSur&&jetPerceSur.b===b&&Date.now()-jetPerceSur.t<10000;
{const f=desRecus;desRecus=function(b,...x){cibleDuJet=b;return f(b,...x)}}
{const f=orbe;orbe=function(a,...x){const av=lanceurOrbe;lanceurOrbe=a;try{return f(a,...x)}finally{lanceurOrbe=av}}}
{const f=resolveAttack;resolveAttack=function(o,...x){const b=cibleDuJet;cibleDuJet=null;derniereEsquive=null;let r=f(o,...x);
 try{const a=lanceurOrbe||auteurCoup;if(!b||!r||!a||!hostiles(a,b)||r.failed)return r;
  const x=enCombat()?esquiveActive(b):0;
  if(x){const v=d6();if(v>=x){esquiveDite={b,v};derniereEsquive=b;return {...r,failed:true,hit:false,critical:false,damage:0,bleed:0,poison:0,esquive:v}}}
  const arme=!lanceurOrbe&&typeof activeAttack==='function'&&!!activeAttack(a).gear;
  if(estIntangible(b)&&!jetPerce(b)&&!percePour(b,a,arme))return {...r,hit:false,critical:false,damage:0,bleed:0,poison:0,intangible:true};
  const p=perceDe(b);if(r.hit&&r.damage>0&&p&&p.malus>0&&porteTalent(a,'intangible'))r={...r,damage:r.damage+p.malus}}catch(e){}
 return r}}
// L'Esquive se dit « Esquive ! », sur la carte et au journal, là où l'échec se dirait.
{const f=floatNumber;floatNumber=function(c,t,g,...x){if(esquiveDite&&c===esquiveDite.b&&t==='Échec'){t='Esquive !';g='gain'}return f(c,t,g,...x)}}
{const f=logAttaque;logAttaque=function(a,b,logo,corps,...x){if(esquiveDite&&b===esquiveDite.b&&/^Échec/.test(String(corps))){corps='Esquive !';esquiveDite=null}return f(a,b,logo,corps,...x)}}
{const f=debrouillardDispo;debrouillardDispo=function(...x){return derniereEsquive?null:f(...x)}}
{const f=frappe;frappe=function(a,b,...x){const avant=new Map(actors.map(o=>[o,o.revanche]));derniereEsquive=null;const r=f(a,b,...x);
 if(derniereEsquive===b)actors.forEach(o=>{if(o.revanche!==avant.get(o)){if(avant.get(o))o.revanche=avant.get(o);else delete o.revanche}});return r}}
// Ce qui ne passe pas par un jet — un état qui brûle, un terrain, un talent : l'Intangible n'en perd rien non plus.
{const f=encaisse;encaisse=function(a,n,de,...x){const src=de===undefined?auteurCoup:de;
 if(Math.trunc(n)>0&&estIntangible(a)&&!jetPerce(a)&&!percePour(a,src,false)){if(typeof floatNumber==='function')floatNumber(a,'0','nul');return {perdu:0,blinde:false}}
 return f(a,n,de,...x)}}
// La fin du combat : les coups percés, les états brefs, les seuils de sel s'en vont.
{const bm=basculerMode;basculerMode=function(neuf,...x){const fin=mode==='combat'&&neuf!=='combat';const r=bm(neuf,...x);
 if(fin){actors.forEach(a=>{if(!a)return;delete a.perceIntangible;etatsBrefs(a).forEach(b=>setState(a,b.e,false));delete a.sommeilBref});
  const m=currentMap();if(m&&m.seuilsSel){delete m.seuilsSel;renderDangers()}}return r}}
/* Le seuil de Sel bleu : deux clics, ses deux bouts, chacun à 3 m au plus du lanceur. Il se dessine sur la carte, en bleu. */
const PORTEE_SEUIL=3;
function tracerSeuil(a,o){const size=mapSize();if(!size.width){log(o.name+' se trace sur la carte.',{local:true});return}
 const proche=q=>!!q&&metres(a,q,mapSize(),tokenPx())<=PORTEE_SEUIL,loin=()=>log(o.name+' : trace le seuil à '+PORTEE_SEUIL+' m au plus de '+nomNum(a)+'.',{local:true});
 viserCible('◈ '+o.name+' — clique un bout du seuil',(v1,q1)=>{if(!proche(q1)){loin();return}
  setTimeout(()=>viserCible('◈ '+o.name+' — clique l’autre bout du seuil',(v2,q2)=>{if(!proche(q2)){loin();return}
   const m=currentMap();if(!m)return;if(enCombat()&&!payeAction(a))return;
   m.seuilsSel=[...(m.seuilsSel||[]),{a:{x:q1.x,y:q1.y},b:{x:q2.x,y:q2.y}}].slice(-20);renderDangers();finPotion(a,o,'seuil tracé')},o.name+' : geste annulé.'))},o.name+' : geste annulé.')}
{const rd=renderDangers;renderDangers=function(...x){const r=rd(...x),m=currentMap();
 // v1.025 : les seuils ont leur calque à eux — celui des terrains dangereux est flouté sur ses bords.
 let svg=$('seuils-carte');const fond=$('dangers-carte');if(!svg&&fond){svg=document.createElementNS(nsSVG,'svg');svg.id='seuils-carte';svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');fond.after(svg)}
 if(svg)svg.replaceChildren();
 if(svg&&m&&Array.isArray(m.seuilsSel))m.seuilsSel.forEach(s=>{const l=document.createElementNS(nsSVG,'line');l.setAttribute('class','seuil-sel');
  l.setAttribute('x1',s.a.x);l.setAttribute('y1',s.a.y);l.setAttribute('x2',s.b.x);l.setAttribute('y2',s.b.y);svg.append(l)});return r}}
// Ce qui arrête le pas d'un Intangible : en plus des murs, les seuils de sel.
let bougeurPas=null;
{const f=obstaclesDuPas;obstaclesDuPas=function(px,...x){const r=f(px,...x),m=typeof currentMap==='function'?currentMap():null;
 if(!m||!Array.isArray(m.seuilsSel)||!m.seuilsSel.length)return r;const o=bougeurPas||actors[selected];
 if(!o||!(intangibleDeNature(o)||porteTalent(o,'hantisesel')))return r;const size=mapSize(),ratio=size.height?size.width/size.height:16/9;
 return [...r,...m.seuilsSel.map(s=>({contours:[capsulePolygon(s.a,s.b,.6,ratio).map(([x,y])=>px(x,y))]}))]}}
{const f=moveActor;moveActor=function(a,...x){const av=bougeurPas;bougeurPas=a;try{return f(a,...x)}finally{bougeurPas=av}}}
{const f=settleActor;settleActor=function(a,...x){const av=bougeurPas;bougeurPas=a;try{return f(a,...x)}finally{bougeurPas=av}}}
{const f=cheminVersContact;cheminVersContact=function(b,...x){const av=bougeurPas;bougeurPas=b;try{return f(b,...x)}finally{bougeurPas=av}}}

/* ---------- v1.020 — Les talents des spectres de la tour d'azur ----------
   Hors d'atteinte refuse aussi les états (sauf Tangible) ; Tangible posé par une attaque (Ancrer) tient jusqu'à la fin du tour,
   par un Sel bleu jusqu'à la fin du tour suivant. Créancier : en phase 1, tant que le Sablier tient, l'Onguent de lest ne perce
   plus. Une attaque qui rend Tangible perce elle-même. Les attaques de la fiche se lisent : « (P1) » ou « (P2) » au nom, « 1 tour
   sur 2 », « 1 fois par combat », « critique = Au sol » au texte. Grégaire, Reformation et Ancré restent en texte. */
Object.assign(JOURNAL_TALENTS,{
 source:[['source','Source','{lanceur} puise à la Source : +{n} PV.'],['coupee','Source coupée','La Source de {lanceur} est coupée.']],
 debordementpuits:[['deborde','Débordement','Le Puits déborde : Gel sur {cibles}.']],
 mesfilles:[['appelle','Appel des filles','{lanceur} appelle ses filles : {n} {nom}.']],
 planetaire:[['frappe','Planétaire','Le planétaire de {lanceur} s’emballe : {cible} prend {n}.']],
 prelevement:[['preleve','Prélèvement','{lanceur} prélève : Nécrose sur {cible}.']],
 mortsrendues:[['frappe','Morts rendues','{lanceur} rend un mort : {cible} prend {n}.'],['soin','Le Sablier la nourrit','{lanceur} : +{n} PV.']],
 exigible:[['phase2','Phase 2','{lanceur} passe en phase 2.'],['aubin','Aubin tombe','{lanceur} recouvre sa dette : +{n} PV.']],
 rappel:[['appelle','Rappel','{lanceur} rappelle : {n} {nom}.']],
 appel:[['reveille','Appel','{lanceur} réveille {n} {nom}.']],
 dispersion:[['disperse','Dispersion','{lanceur} se disperse : Gel sur {cibles}.']],
 serment:[['prend','Serment','{lanceur} prend le coup à la place de {cible}.']],
 statue:[['eveil','Éveil','{lanceur} s’éveille.']]});
const mjAppareil=()=>typeof view!=='undefined'&&view==='mj';
const herosSurCarte=()=>actors.filter(h=>h&&h.hero&&surCarteAdv(h));
const hasardDans=l=>l.length?l[Math.floor(Math.random()*l.length)]:null;
// Le Sablier : un adversaire qui porte Rappel ; il tient tant qu'il vit. Aubin : un allié qui porte son nom.
const sablierTient=o=>actors.some(x=>x&&x!==o&&surCarteAdv(x)&&porteTalent(x,'rappel'));
const sablierBrise=o=>!sablierTient(o)&&actors.some(x=>x&&x!==o&&!x.horsCarte&&porteTalent(x,'rappel'));
const aubinDe=()=>actors.find(o=>o&&!o.hero&&!o.horsCarte&&/\baubin\b/i.test(String(o.name||''))&&campDe(o)!=='adverse')||null;
const creancierActif=b=>!!b&&porteTalent(b,'creancier')&&!enPhase2(b)&&sablierTient(b);
function percePour(b,a,arme){if(!a)return false;
 if(!lanceurOrbe&&typeof activeAttack==='function'&&a.attacks&&(activeAttack(a).etats||[]).includes('Tangible'))return true;
 if(creancierActif(b)){const p=perceDe(a);return !!p&&p.portee==='tout'}
 return perceLIntangible(a,arme)}
// Hors d'atteinte : aucun état, sauf Tangible ; un coup qui le perce pose les siens.
{const ie=infligeEtat;infligeEtat=function(o,e,...x){
 if(o&&e!=='Tangible'&&porteTalent(o,'horsatteinte')&&!hasState(o,'Tangible')&&!jetPerce(o)&&!(auteurCoup&&percePour(o,auteurCoup,true)))return 'immunise';
 const r=ie(o,e,...x);
 if(r===true&&e==='Tangible'&&enCombat()){if(jetPerce(o)&&jetPerceSur&&jetPerceSur.sel)ajouteEtatBref(o,'Tangible',round+1);else if(auteurCoup&&!jetPerce(o))ajouteEtatBref(o,'Tangible',round)}
 return r}}
// Liens : +1 DEF par chaîne qui n'a pas encore été vaincue dans la campagne (catalog.vaincus).
const vaincusCampagne=()=>Array.isArray(catalog.vaincus)?catalog.vaincus:[];
function chainesIntactes(a){if(!porteTalent(a,'liens'))return 0;const p=paramsTalentDe(a,'liens');return [p.modele,p.modele2].filter(id=>id&&!vaincusCampagne().includes(id)).length}
{const d0=defOf;defOf=function(a){const d=d0(a),n=a&&!a.hero?chainesIntactes(a):0;return n?defPlafonnee(d+n):d}}
function retientVaincus(){if(!mjAppareil())return;const chaines=new Set();(catalog.talents||[]).forEach(t=>{if(t&&t.effet==='liens'&&t.params)[t.params.modele,t.params.modele2].forEach(id=>id&&chaines.add(id))});
 if(!chaines.size)return;const neufs=actors.filter(o=>o&&!o.hero&&o.template&&chaines.has(o.template)&&!(Number(o.hp)>0)&&!vaincusCampagne().includes(o.template)).map(o=>o.template);
 if(neufs.length){catalog.vaincus=[...new Set([...vaincusCampagne(),...neufs])];scheduleSave()}}
// Orbite : le chef ne se vise pas à distance tant qu'un Orbe vit. Invisible (adversaire) : seulement après avoir attaqué ce tour, ou sous la Lanterne.
const protegeParOrbite=b=>!!b&&porteTalent(b,'orbite')&&b.type!=='standard'&&actors.some(o=>o!==b&&surCarteAdv(o)&&o.type==='standard'&&porteTalent(o,'orbite')&&campDe(o)===campDe(b));
const insaisissableAdv=b=>!!b&&porteTalent(b,'invisibleadv')&&b.attaqueTour!==numeroCombat+':'+round&&!dansLanterne(b);
{const rt=reachTo;reachTo=function(a,b,rang,portee,...x){const r=rt(a,b,rang,portee,...x);if(!r||!r.ok||!a||!b||!hostiles(a,b))return r;
 if(insaisissableAdv(b))return {ok:false,ranged:true,text:'ligne de vue bloquée : cible invisible'};
 if(r.ranged&&protegeParOrbite(b))return {ok:false,ranged:true,text:'ligne de vue bloquée par son orbite'};return r}}
// Les attaques de la fiche : la phase, « 1 tour sur 2 », « 1 fois par combat ».
function refusTempsAttaque(a,at){if(!a||a.hero||!at)return '';const n=String(at.name||''),t=String(at.effectText||'').toLowerCase();
 const ph=/\(P([12])\)/i.exec(n);if(ph&&Number(ph[1])!==(enPhase2(a)?2:1))return 'Phase '+ph[1]+' seulement.';
 const u=(a.attaquesFaites&&a.attaquesFaites.c===numeroCombat&&a.attaquesFaites.l)||{};
 if(/1 fois par combat/.test(t)&&u[n])return 'Une fois par combat : déjà faite.';
 if(/1 tour sur 2/.test(t)&&u[n]&&round-u[n]<2)return 'Un tour sur deux : au tour '+(u[n]+2)+'.';return ''}
{const ra=refusAttaque;refusAttaque=function(a,at){const r=ra(a,at);if(r)return r;return enCombat()?refusTempsAttaque(a,at||(a&&activeAttack(a))):r}}
{const at0=attack;attack=function(opts={},...x){const a=actors[selected];let marque=null;
 if(a&&!a.hero&&enCombat()&&!(opts&&opts.potion)){const at=activeAttack(a);if(at&&!refusAttaque(a,at))marque=at.name}
 const r=at0(opts,...x);
 if(marque){const l=a.attaquesFaites&&a.attaquesFaites.c===numeroCombat?a.attaquesFaites.l:{};a.attaquesFaites={c:numeroCombat,l:{...l,[marque]:round}};
  a.attaqueTour=numeroCombat+':'+round;if(porteTalent(a,'horsetoile'))a.etoileSortie=numeroCombat}
 return r}}
// « critique = Au sol », « critique = Gel 1 » : l'état que pose un critique de cette attaque.
function etatsCritiqueAttaque(a,r){if(!a||!r||!r.critical||r.failed||typeof activeAttack!=='function')return [];const t=String(activeAttack(a).effectText||'');
 const m=/critique\s*=\s*(?:la\s+)?(?:cible\s+)?([^,;.]+)/i.exec(t);if(!m)return [];const txt=m[1].trim(),k=String(txt).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
 const e=ETATS_JEU.find(x=>k.startsWith(x.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()));if(!e)return [];
 const n=Math.max(1,Math.min(9,Number((/(\d+)\s*$/.exec(txt)||[])[1])||1));return Array(n).fill(e)}
{const et=etatsTalentsCoup;etatsTalentsCoup=function(a,b,r,...x){return [...et(a,b,r,...x),...etatsCritiqueAttaque(a,r)]}}
// Hors de l'étoile : 1 dé blanc de plus à sa première attaque.
{const da=desAttaque;desAttaque=function(a,dice,...x){const d=da(a,dice,...x);if(!d||!a||a.hero||!porteTalent(a,'horsetoile')||a.etoileSortie===numeroCombat||!enCombat())return d;
 return Array.isArray(d)?d.map((v,i)=>i===0?v+1:v):{...d,white:(Number(d.white)||0)+1}}}
// Serment : un spectre allié à son contact est frappé — il prend le coup, une fois par tour.
const estSpectre=o=>!!o&&!o.hero&&(porteTalent(o,'horsatteinte')||porteTalent(o,'intangible')||/spectre/i.test(String(o.family||o.role||'')));
{const fr=frappe;frappe=function(a,b,...x){if(enCombat()&&a&&b&&!b.hero&&estSpectre(b)&&hostiles(a,b)){
  const c=actors.find(o=>o!==b&&surCarteAdv(o)&&porteTalent(o,'serment')&&campDe(o)===campDe(b)&&o.sermentTour!==numeroCombat+':'+round&&allieAuContact(b,o));
  if(c){const r0=reachTo(a,c,actors.indexOf(c));if(r0&&r0.ok){c.sermentTour=numeroCombat+':'+round;log(phraseJournal(talentDe(c,'serment'),'serment','prend',{lanceur:nomNum(c),cible:nomNum(b)}),{ton:'talent'});return fr(a,c,...x)}}}
 return fr(a,b,...x)}}
// Exigible : en phase 2, elle vise qui couvre Aubin, sinon Aubin.
{const ci=cibleImposee;cibleImposee=function(m){const i=ci(m);if(i>=0||!m||!enCombat()||!porteTalent(m,'exigible')||!enPhase2(m))return i;
 const au=aubinDe();if(!au||!alive(au))return i;const h=actors.find(o=>o&&o.hero&&surCarteAdv(o)&&allieAuContact(au,o));const v=h||au;return actors.indexOf(v)}}
// Les appels : autour du porteur, ou aux étoiles fendues pour le Sablier.
function etoilesDe(){const m=currentMap();return (m&&m.objets||[]).filter(o=>o&&o.indice&&o.examen&&o.examen.mode==='objet'&&/cire de sceau/i.test((objetDe(o.examen.item)||{}).name||''))}
function appelle(o,code,cle,nomDefaut,n,centres){const m=modeleTalent(paramsTalentDe(o,code),nomDefaut);if(!m||n<=0)return;const l=centres&&centres.length?centres:[o];
 for(let k=0;k<n;k++)invoqueAupres(l[k%l.length],m,1,o);log(phraseJournal(talentDe(o,code),code,cle,{lanceur:nomNum(o),n,nom:m.name+(n>1?'s':'')}),{ton:'talent'})}
// Ce qui se lit à chaque dessin, chez le MJ : les phases, les appels à mi-PV, Aubin tombé, les dispersions, les chaînes rompues.
{const r0=render;render=function(...x){try{if(mjAppareil()&&enCombat())actors.forEach(o=>{if(!o||o.hero||o.horsCarte)return;
  if(alive(o)){
   if(porteTalent(o,'exigible')){const au=aubinDe();
    if(au&&!(Number(au.hp)>0)&&o.aubinTombe!==numeroCombat){o.aubinTombe=numeroCombat;const g=applyHeal(o,40);if(g)floatNumber(o,'+'+g,'gain');log(phraseJournal(talentDe(o,'exigible'),'exigible','aubin',{lanceur:nomNum(o),n:g}),{ton:'talent'});if(!enPhase2(o)){o.phase2=numeroCombat;log(phraseJournal(talentDe(o,'exigible'),'exigible','phase2',{lanceur:nomNum(o)}),{ton:'talent'})}}
    else if(!enPhase2(o)&&(o.hp<=o.max/2||sablierBrise(o))){o.phase2=numeroCombat;log(phraseJournal(talentDe(o,'exigible'),'exigible','phase2',{lanceur:nomNum(o)}),{ton:'talent'})}}
   if(porteTalent(o,'mesfilles')&&o.filles!==numeroCombat&&o.hp<=o.max/2){o.filles=numeroCombat;appelle(o,'mesfilles','appelle','pleureuse',2)}}
  else if(porteTalent(o,'dispersion')&&o.disperse!==numeroCombat){o.disperse=numeroCombat;const size=mapSize(),l=herosSurCarte().filter(h=>inContact(o,h,size,tokenOf(o),tokenOf(h)));const t=l.filter(h=>infligeEtat(h,'Gel')===true);
   if(t.length)log(phraseJournal(talentDe(o,'dispersion'),'dispersion','disperse',{lanceur:nomNum(o),cibles:t.map(nomNum).join(', ')}),{ton:'talent'})}});
 retientVaincus()}catch(e){}return r0(...x)}}
// Le début du combat : Hors de l'étoile se cache ; Appel réveille ses alliés.
{const bm=basculerMode;basculerMode=function(neuf,...x){const avant=typeof mode!=='undefined'?mode:'';const r=bm(neuf,...x);
 if(neuf==='combat'&&avant!=='combat'&&mjAppareil())try{actors.forEach(o=>{if(!surCarteAdv(o)||o.hero)return;
  if(porteTalent(o,'horsetoile')&&o.etoileSortie!==numeroCombat)setState(o,'Invisible',true);
  if(porteTalent(o,'appel')&&o.appelFait!==numeroCombat){o.appelFait=numeroCombat;appelle(o,'appel','reveille','grimoire',2)}});render();scheduleSave()}catch(e){}
 return r}}
// La fin de chaque tour : Source, Débordement, Planétaire, Prélèvement, Morts rendues ; au tour pair, le Rappel du Sablier.
function deDirect(o,h,couleur,code,cle){const v=d6();rollOnBoard([{dice:[[v,DICE_KEYS.indexOf(couleur)]]}],o,h);encaisse(h,v,o);log(phraseJournal(talentDe(o,code),code,cle,{lanceur:nomNum(o),cible:nomNum(h),n:v}),{ton:'degats'})}
function soigneVerts(o,n,code,cle){const d=Array.from({length:n},()=>d6());rollOnBoard([{dice:d.map(v=>[v,4])}],o,null);const g=applyHeal(o,d.reduce((s,v)=>s+v,0));if(g>0){floatNumber(o,'+'+g,'gain');log(phraseJournal(talentDe(o,code),code,cle,{lanceur:nomNum(o),n:g}),{ton:'soin'})}}
function finDuTourSpectres(){if(!enCombat()||!mjAppareil())return;
 actors.filter(o=>surCarteAdv(o)&&!o.hero).forEach(o=>{
  if(porteTalent(o,'source')&&!(o.sourceCoupee&&o.sourceCoupee.c===numeroCombat&&round<=o.sourceCoupee.r)&&o.hp<o.max)soigneVerts(o,2,'source','source');
  if(porteTalent(o,'debordementpuits')&&o.hp<=o.max/2){const z=zoneDe(o),t=herosSurCarte().filter(h=>!z||zoneDe(h)===z).filter(h=>infligeEtat(h,'Gel')===true);
   if(t.length)log(phraseJournal(talentDe(o,'debordementpuits'),'debordementpuits','deborde',{lanceur:nomNum(o),cibles:t.map(nomNum).join(', ')}),{ton:'talent'})}
  if(porteTalent(o,'planetaire')&&o.hp<=o.max/2){const h=hasardDans(herosSurCarte());if(h)deDirect(o,h,'blue','planetaire','frappe')}
  if(porteTalent(o,'prelevement')&&!enPhase2(o)){const h=herosSurCarte().sort((u,v)=>v.hp-u.hp)[0];if(h&&!insensibleA(h,'Nécrose')&&infligeEtat(h,'Nécrose')!=='immunise'){appliqueNecrose(h,1);log(phraseJournal(talentDe(o,'prelevement'),'prelevement','preleve',{lanceur:nomNum(o),cible:nomNum(h)}),{ton:'degats'})}}
  if(porteTalent(o,'mortsrendues')&&enPhase2(o)){const h=hasardDans(herosSurCarte());if(h)deDirect(o,h,'red','mortsrendues','frappe');if(sablierTient(o)&&o.hp<o.max)soigneVerts(o,2,'mortsrendues','soin')}})}
function debutDuTourSpectres(){if(!enCombat()||!mjAppareil()||round%2!==0)return;
 actors.filter(o=>surCarteAdv(o)&&!o.hero&&porteTalent(o,'rappel')).forEach(o=>{const l=etoilesDe(),fendues=l.filter(s=>!s.examine),n=Math.max(0,2-(l.length-fendues.length));
  appelle(o,'rappel','appelle','veilleur',n,fendues.map(s=>({x:s.x,y:s.y})))})}
{const ts=tourSuivant;tourSuivant=function(...x){try{finDuTourSpectres()}catch(e){}const r=ts(...x);try{debutDuTourSpectres();render();scheduleSave()}catch(e){}return r}}
// Seuil : un aventurier qui entre dans sa zone de contact subit ses Dégâts d'opportunité, une fois par tour. Statue : la lumière ou la course l'éveillent.
function metresDuChemin(c){const size=mapSize(),tk=tokenPx();let m=0;for(let i=1;i<c.length;i++)if(c[i]&&c[i-1])m+=metres(c[i-1],c[i],size,tk);return m}
{const pm=passeMurs;passeMurs=function(o,chemin,...x){const r=pm(o,chemin,...x);try{if(o&&o.hero&&alive(o)&&Array.isArray(chemin)&&chemin.length>1){const size=mapSize(),murs=walls(),depart=chemin[0];
  if(enCombat())actors.filter(g=>surCarteAdv(g)&&!g.hero&&hostiles(g,o)&&porteTalent(g,'seuilgardien')&&g.seuilTour!==numeroCombat+':'+round).forEach(g=>{
   if(inContact(g,depart,size,tokenOf(g),tokenOf(o))||!inContact(g,o,size,tokenOf(g),tokenOf(o))||wallsBetween(g,o,murs))return;
   g.seuilTour=numeroCombat+':'+round;const n=degatsDe(g),{blinde}=encaisse(o,n,g,' ⚠');logAttaque(g,o,'*degats',blinde?'Dégâts d’opportunité : Blindage consommé.':n+' Dégâts d’opportunité.',null,o.hp===0?' 💀':'')});
  const court=metresDuChemin(chemin)>9,lumiere=lumierePortee(o,items())>0;
  if(court||lumiere)actors.filter(g=>g&&!g.hero&&alive(g)&&!g.horsCarte&&porteTalent(g,'statue')&&g.statueInit&&!g.statueEveillee).forEach(g=>{
   if(wallsBetween(g,o,murs)||metres(g,o,size,tokenPx())>20)return;g.statueEveillee=true;g.hidden=false;log(phraseJournal(talentDe(g,'statue'),'statue','eveil',{lanceur:nomNum(g)}),{ton:'reveal'});render();scheduleSave()})}}catch(e){}return r}}
// La Statue dort cachée tant qu'elle n'est pas éveillée — une fois posée ; le MJ peut toujours la révéler.
{const r0=render;render=function(...x){try{if(mjAppareil())actors.forEach(g=>{if(g&&!g.hero&&!g.statueInit&&!g.vu&&porteTalent(g,'statue')){g.statueInit=true;g.hidden=true}})}catch(e){}return r0(...x)}}
// Les gestes d'Aubin : donner un Sel bleu, resceller une étoile.
const selBleu=()=>(catalog.items||[]).find(o=>o&&/^sel bleu$/i.test(String(o.name||'').trim()))||null;
const cireSceau=()=>(catalog.items||[]).find(o=>o&&/^cire de sceau$/i.test(String(o.name||'').trim()))||null;
const herosAuContact=a=>herosSurCarte().filter(h=>allieAuContact(a,h));
const selsDonnes=a=>a.selsDonnes&&a.selsDonnes.c===numeroCombat?a.selsDonnes.n:0;
function donneSel(a){const s=selBleu();if(!s)return 'Aucun Sel bleu à l’Armurerie.';if(enCombat()&&selsDonnes(a)>=3)return 'Déjà 3 Sels bleus donnés ce combat.';
 const l=herosAuContact(a);if(!l.length)return 'Aucun aventurier au contact.';
 const donne=h=>{if(!ajouterInventaire(h,s))return;a.selsDonnes={c:numeroCombat,n:selsDonnes(a)+1};log(nomNum(a)+' donne un Sel bleu à '+nomNum(h)+'.',{ton:'talent'});render();scheduleSave()};
 if(l.length===1){donne(l[0]);return ''}menuAuCentre('Sel bleu',l.map(h=>[nomNum(h),()=>donne(h)]));return ''}
function etoileAuContact(a){return etoilesDe().find(s=>!s.examine&&objetAPortee(a,s))||null}
function resceller(a){const s=etoileAuContact(a);if(!s)return 'Aucune étoile fendue au contact.';const c=cireSceau();if(!c)return 'Aucune Cire de sceau à l’Armurerie.';
 const h=[a,...herosAuContact(a)].find(x=>(x.inventaire||[]).includes(c.id));if(!h)return 'Il faut la Cire de sceau d’un aventurier au contact.';
 retirerInventaire(h,c);s.examine=true;if(s.secret)log(s.secret,{ton:'reveal'});saveMaps();render();scheduleSave();return nomNum(a)+' rebouche '+s.nom+' avec la Cire de sceau de '+nomNum(h)+'.'}
Object.assign(TALENTS_EFFETS,{
 selbleu:{fn:a=>donneSel(a),peut:a=>!!selBleu()&&!(enCombat()&&selsDonnes(a)>=3)&&herosAuContact(a).length>0,titre:a=>!selBleu()?'Aucun Sel bleu à l’Armurerie.':enCombat()&&selsDonnes(a)>=3?'Déjà 3 Sels bleus donnés ce combat.':herosAuContact(a).length?'Donner un Sel bleu à un aventurier au contact.':'Aucun aventurier au contact.'},
 resceller:{fn:a=>resceller(a),peut:a=>!!etoileAuContact(a),titre:a=>etoileAuContact(a)?'Reboucher l’étoile fendue avec une Cire de sceau.':'Aucune étoile fendue au contact.'}});

/* ---------- v1.021 — Dupliquer, et la Note de MJ ----------
   Dupliquer : la forme choisie — objet, indice, ressource, coffre, porte, fenêtre, adversaire, lumière, piège, note — est copiée,
   puis le clic suivant sur la carte pose la copie, centrée là. Échap la laisse où elle est née, un peu plus loin. */
let copieAPlacer=null;
function centrePlace(s,p){if(!s||!p)return;
 if(Number.isFinite(s.w)&&Number.isFinite(s.h)){const dx=Math.max(-s.x,Math.min(100-s.x-s.w,p.x-(s.x+s.w/2))),dy=Math.max(-s.y,Math.min(100-s.y-s.h,p.y-(s.y+s.h/2)));s.x+=dx;s.y+=dy;
  (s.declencheurs||[]).forEach(d=>{const b=v=>Math.max(0,Math.min(100,v));if(d.type==='fil'){d.x1=b(d.x1+dx);d.x2=b(d.x2+dx);d.y1=b(d.y1+dy);d.y2=b(d.y2+dy)}else{d.x=b(d.x+dx);d.y=b(d.y+dy)}});return}
 s.x=Math.max(0,Math.min(100,p.x));s.y=Math.max(0,Math.min(100,p.y))}
function commencePlacement(){if(!mapSel)return;copieAPlacer={...mapSel};$('shape-label').textContent='Clique sur la carte, là où poser la copie.'}
$('map-canvas').addEventListener('pointerdown',e=>{if(!copieAPlacer||!mapDraft)return;e.preventDefault();e.stopImmediatePropagation();
 const s=shapeAt(copieAPlacer);if(e.button===0&&s){centrePlace(s,pct(e));mapSel=copieAPlacer}copieAPlacer=null;
 renderCanvas();renderMapList();saveMaps();if(mapDraft.id===currentMapId)render()},{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&copieAPlacer){copieAPlacer=null;renderCanvas()}});
['lumiere-double','coffre-double','piege-double'].forEach(id=>{const b=$(id);if(!b)return;const f=b.onclick;b.onclick=e=>{const avant=mapSel;f&&f(e);if(mapSel&&mapSel!==avant)commencePlacement()}});
$('shape-double').onclick=()=>{const m=mapDraft,d=mapSel;if(!m||!d)return;const s=shapeAt(d);if(!s)return;pushUndo();const c=structuredClone(s);if(c.id)c.id=crypto.randomUUID();c.locked=false;
 ['pris','revele','voile','examine','tente','open','decouvert','crochetee','eteinte','prise'].forEach(k=>delete c[k]);
 if(d.kind==='notemj'){const l=notesDe(m.id);c.id=crypto.randomUUID();l.push(c);mapSel={kind:'notemj',i:l.length-1};sauveNotesMJ()}
 else{const l=d.kind==='door'?m.doors:d.kind==='objet'?m.objets:d.kind==='foe'?m.foes:null;if(!l)return;
  if(Number.isFinite(c.w)){c.x=Math.min(100-c.w,c.x+2);c.y=Math.min(100-c.h,c.y+2)}else{c.x=Math.min(100,c.x+2);c.y=Math.min(100,c.y+2)}
  l.push(c);mapSel={kind:d.kind,i:l.length-1}}
 renderCanvas();commencePlacement()};
/* La Note de MJ : une icône au choix et un texte, que seul le MJ voit — dans l'éditeur, et à la table au survol, sans geste. Elle
   ne vit jamais dans les cartes : ni la publication, ni la table en ligne ne l'emportent. Elle se garde dans ce navigateur
   (« amertume-notes-mj ») et, MJ connecté, dans un document Firebase que seul un compte MJ peut lire (amertume_online_mj/notes). */
const NOTES_MJ_CLE='amertume-notes-mj';
function normaliseNotesMJ(d){const out={at:Math.max(0,Number(d&&d.at)||0),cartes:{}},c=d&&d.cartes&&typeof d.cartes==='object'?d.cartes:{};
 Object.keys(c).slice(0,200).forEach(k=>{const l=(Array.isArray(c[k])?c[k]:[]).filter(n=>n&&typeof n==='object').slice(0,200).map(n=>({id:typeof n.id==='string'&&n.id?n.id.slice(0,60):crypto.randomUUID(),
  x:Math.max(0,Math.min(100,Number(n.x)||0)),y:Math.max(0,Math.min(100,Number(n.y)||0)),logo:typeof n.logo==='string'?n.logo.slice(0,300):'',titre:String(n.titre||'').slice(0,120),texte:String(n.texte||'').slice(0,4000),...(n.locked===true?{locked:true}:{})}));
  if(l.length)out.cartes[String(k).slice(0,80)]=l});return out}
let notesMJ=(()=>{try{return normaliseNotesMJ(JSON.parse(localStorage.getItem(NOTES_MJ_CLE)||'{}'))}catch(e){return normaliseNotesMJ({})}})();
function notesDe(id){const k=String(id||'');if(!notesMJ.cartes[k])notesMJ.cartes[k]=[];return notesMJ.cartes[k]}
let notesNuage=0;
function sauveNotesMJ(){Object.keys(notesMJ.cartes).forEach(k=>{if(!notesMJ.cartes[k].length)delete notesMJ.cartes[k]});notesMJ.at=Date.now();
 try{localStorage.setItem(NOTES_MJ_CLE,JSON.stringify(notesMJ))}catch(e){}
 clearTimeout(notesNuage);notesNuage=setTimeout(envoieNotesMJ,1500)}
const notesMJRef=()=>typeof cloud!=='undefined'&&cloud&&typeof admin!=='undefined'&&admin&&typeof auth!=='undefined'&&auth&&auth.currentUser?cloud.doc('amertume_online_mj/notes'):null;
async function envoieNotesMJ(){const r=notesMJRef();if(!r)return;try{await r.set({notes:JSON.stringify(notesMJ),at:notesMJ.at,author:auth.currentUser.uid})}catch(e){console.warn('Notes de MJ : envoi refusé',e&&e.message)}}
async function recoitNotesMJ(){const r=notesMJRef();if(!r)return;try{const d=await r.get();
 if(!d.exists){if(notesMJ.at)envoieNotesMJ();return}const v=normaliseNotesMJ(JSON.parse(d.data().notes||'{}'));
 if(v.at>notesMJ.at){notesMJ=v;try{localStorage.setItem(NOTES_MJ_CLE,JSON.stringify(notesMJ))}catch(e){}if(typeof renderCanvas==='function'&&mapDraft)renderCanvas();render()}
 else if(notesMJ.at>v.at)envoieNotesMJ()}catch(e){console.warn('Notes de MJ : lecture refusée',e&&e.message)}}
document.addEventListener('amertume-mj-change',()=>{if(typeof admin!=='undefined'&&admin)recoitNotesMJ()});
/* v1.173 : la sauvegarde globale du MJ emporte ses Notes, et l'import les repose ; un fichier qui n'en porte pas laisse celles d'ici. */
ANNEXES_SAUVEGARDE.push({nom:'les notes de MJ',
 lit:()=>view==='mj'?{notesMJ:normaliseNotesMJ(notesMJ)}:{},
 pose:s=>{if(view!=='mj'||!s.notesMJ||typeof s.notesMJ!=='object')return;notesMJ=normaliseNotesMJ(s.notesMJ);sauveNotesMJ();if(typeof renderCanvas==='function'&&mapDraft)renderCanvas();render()}});
KINDS.notemj='Note de MJ';
HINTS.notemj='Un clic pose une Note de MJ et ouvre sa fiche. Seul le MJ la voit ; à la table, elle se lit au survol.';
{const sa=shapeAt;shapeAt=function(d){if(d&&d.kind==='notemj')return mapDraft?notesDe(mapDraft.id)[d.i]||null:null;return sa(d)}}
{const rs=removeShape;removeShape=function(d){if(d&&d.kind==='notemj'){if(mapDraft){notesDe(mapDraft.id).splice(d.i,1);sauveNotesMJ()}return}return rs(d)}}
{const sm=saveMaps;saveMaps=function(...x){const r=sm(...x);if(mapDraft&&notesMJ.cartes[String(mapDraft.id)])sauveNotesMJ();return r}}
const ICONE_NOTE_MJ='<svg class="logo-objet" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z M15 3v4h4 M9 11h7 M9 14h7 M9 17h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
// v1.049 : toutes les Notes de MJ portent la même icône — le parchemin n° 39 de la planche PARCHEMINS ; à défaut, la feuille dessinée.
const LOGO_NOTE_MJ='planches/PARCHEMINS.webp#39';
function logoNoteMJ(el,n){const im=typeof logoAttaque==='function'?logoAttaque(LOGO_NOTE_MJ,'logo-objet'):null;if(im)el.replaceChildren(im);else el.innerHTML=ICONE_NOTE_MJ}
function bulleNoteMJ(n){const d=document.createElement('div');d.className='gear-detail large note-mj-bulle';
 // v1.049 : son titre, au-dessus de la note.
 if(n.titre){const t=document.createElement('p');t.className='gear-nom note-mj-titre';t.textContent=n.titre;d.append(t)}
 const p=document.createElement('p');p.className='objet-desc-bulle';
 if(typeof texteEnrichi==='function')texteEnrichi(p,n.texte||'',null);else p.textContent=n.texte||'';d.append(p);return d}
let clicNote=null;
{const rc=renderCanvas;renderCanvas=function(...x){const r=rc(...x);try{const c=$('map-canvas'),m=mapDraft;if(!c||!m)return r;
  notesDe(m.id).forEach((n,i)=>{const el=document.createElement('div');el.className='shape notemj'+(n.locked?' locked':'')+(mapSel&&mapSel.kind==='notemj'&&mapSel.i===i?' selected':'');
   const t=Math.max(10,c.clientWidth*echelleSocle(m)/100*.8);el.style.width=el.style.height=t+'px';el.style.margin=(-t/2)+'px 0 0 '+(-t/2)+'px';
   el.style.left=n.x+'%';el.style.top=n.y+'%';el.dataset.kind='notemj';el.dataset.i=i;logoNoteMJ(el,n);
   if(typeof surveille==='function')surveille(el,()=>ouvrirBulle(el,bulleNoteMJ(n),'bulle-gear'));c.append(el)});
  if(!notesDe(m.id).length)delete notesMJ.cartes[String(m.id)];
  const sel=mapSel&&mapSel.kind==='notemj';$('notemj-edit').hidden=!sel;
  $('shape-double').hidden=!(mapSel&&['objet','door','foe','notemj'].includes(mapSel.kind)&&shapeAt(mapSel));
  if(copieAPlacer)$('shape-label').textContent='Clique sur la carte, là où poser la copie.'}catch(e){}return r}}
// L'outil Note de MJ : un clic pose une note ; sur une note, il la rouvre. Deux clics rapprochés la rouvrent aussi avec la Sélection.
$('map-canvas').addEventListener('pointerdown',e=>{if(!mapDraft||copieAPlacer||e.button!==0)return;const sous=e.target.closest('[data-kind="notemj"]');
 if(sous){const i=Number(sous.dataset.i),t=performance.now(),deux=clicNote&&clicNote.i===i&&t-clicNote.t<450;clicNote=deux?null:{i,t};
  if(deux||mapTool==='notemj'){e.preventDefault();e.stopImmediatePropagation();mapSel={kind:'notemj',i};renderCanvas();openNoteMJ(i)}return}
 if(mapTool!=='notemj')return;e.preventDefault();e.stopImmediatePropagation();const p=pct(e),l=notesDe(mapDraft.id);
 l.push({id:crypto.randomUUID(),x:p.x,y:p.y,logo:'',texte:''});mapSel={kind:'notemj',i:l.length-1};sauveNotesMJ();renderCanvas();openNoteMJ(mapSel.i)},{capture:true});
const noteMJDialog=dialog('notemj-editor','Note de MJ','<form id="notemj-form"><div id="notemj-fields"></div><div class="form-actions"><button type="button" id="notemj-suppr">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
function openNoteMJ(i){const m=mapDraft,n=m&&notesDe(m.id)[i];if(!n||view!=='mj')return;
 $('notemj-fields').innerHTML='<label>Titre<input name="titre" maxlength="120" value="'+esc(n.titre||'')+'"></label><label>Note<textarea name="texte" rows="6" maxlength="4000">'+esc(n.texte||'')+'</textarea></label>';
 $('notemj-form').onsubmit=e=>{e.preventDefault();const f=$('notemj-form').elements;n.titre=f.titre.value.trim().slice(0,120);n.texte=f.texte.value.slice(0,4000);
  sauveNotesMJ();noteMJDialog.close();renderCanvas();if(m.id===currentMapId)render()};
 $('notemj-suppr').onclick=()=>{if(!confirm('Supprimer cette note ?'))return;notesDe(m.id).splice(i,1);mapSel=null;sauveNotesMJ();noteMJDialog.close();renderCanvas();if(m.id===currentMapId)render()};
 noteMJDialog.showModal()}
$('notemj-edit').onclick=()=>{if(mapSel&&mapSel.kind==='notemj')openNoteMJ(mapSel.i)};
// À la table : chez le MJ seul, sous les jetons, sans geste ; le survol montre la note.
// v1.049 : un bouton de la barre du MJ les montre ou les cache, à la table seulement ; l'appareil s'en souvient.
let notesMJVisibles=(()=>{try{return localStorage.getItem('amertume-notes-mj-table')!=='0'}catch(e){return true}})();
const notesBtn=icone('notes-mj-vue','📜','Cacher les Notes de MJ');fogBar.append(notesBtn);
notesBtn.onclick=()=>{notesMJVisibles=!notesMJVisibles;try{localStorage.setItem('amertume-notes-mj-table',notesMJVisibles?'1':'0')}catch(e){}renderNotesMJ()};
function majBoutonNotesMJ(){const m=currentMap();notesBtn.hidden=!m||view!=='mj'||!notesDe(m.id).length;notesBtn.classList.toggle('on',!notesMJVisibles);
 notesBtn.title=notesMJVisibles?'Cacher les Notes de MJ':'Montrer les Notes de MJ';notesBtn.setAttribute('aria-label',notesBtn.title)}
function renderNotesMJ(){majBoutonNotesMJ();let calque=$('notes-mj');const m=currentMap(),l=m&&view==='mj'&&notesMJVisibles&&!(typeof spectateur==='function'&&spectateur())?notesDe(m.id):[];
 if(!l.length){if(calque)calque.remove();if(m&&!notesDe(m.id).length)delete notesMJ.cartes[String(m.id)];return}
 if(!calque){calque=document.createElement('div');calque.id='notes-mj';calque.setAttribute('aria-hidden','true');$('map-view').append(calque)}calque.replaceChildren();
 const t=Math.max(14,tokenPx()*.8);
 l.forEach(n=>{const el=document.createElement('div');el.className='note-mj';el.style.left=n.x+'%';el.style.top=n.y+'%';el.style.width=el.style.height=t+'px';logoNoteMJ(el,n);
  el.onpointerdown=e=>e.stopPropagation();el.onclick=e=>e.stopPropagation();
  if(typeof surveille==='function')surveille(el,()=>ouvrirBulle(el,bulleNoteMJ(n),'bulle-gear'));calque.append(el)})}
{const rc=renderCoffres;renderCoffres=function(...x){const r=rc(...x);try{renderNotesMJ()}catch(e){}return r}}

/* ---------- v1.023 — L'éditeur de cartes sur deux colonnes ----------
   Le bloc Forme sélectionnée passe en tête de la colonne de gauche, avec l'invite de recalage ; la colonne de droite — Échelle,
   Légende, compte des formes — se retire, et la carte prend la place. Rien n'est ôté : ses éléments restent, cachés. */
{const droite=document.querySelector('#maps-page>.maps-props:not(#domaine-props)'),gauche=document.querySelector('#maps-page>.maps-side');
 if(droite&&gauche){const sel=document.createElement('section');sel.className='maps-props maps-selection';
  const fin=$('shape-delete'),noeuds=[];for(const n of [...droite.childNodes]){noeuds.push(n);if(n===fin)break}
  sel.append(...noeuds);const recal=$('recal-box');if(recal)sel.append(recal);
  const trait=document.createElement('div');trait.className='divider';gauche.prepend(sel,trait);droite.hidden=true;droite.classList.add('colonne-retiree')}}

/* v1.027 — Les bords du terrain difficile s'estompent : les hachures restent nettes, leur liseré passe sur un calque flouté qui
   s'efface vers le transparent ; celui du terrain dangereux est flouté tout entier (editor.css). */
{const rdf=renderDifficiles;renderDifficiles=function(...x){const r=rdf(...x);const fond=$('difficiles-carte');if(!fond)return r;
 let bords=$('difficiles-bords');if(!bords){bords=document.createElementNS(nsSVG,'svg');bords.id='difficiles-bords';bords.setAttribute('viewBox','0 0 100 100');bords.setAttribute('preserveAspectRatio','none');bords.setAttribute('aria-hidden','true');fond.after(bords)}
 bords.replaceChildren(...[...fond.querySelectorAll('.diffi-carte')].map(p=>{const c=p.cloneNode(false);c.setAttribute('class','diffi-bord');return c}));return r}}

/* v1.028 — Au survol de la carte, sur un terrain dangereux que la troupe voit, une bulle pleine : « Terrain Dangereux : <nom> ».
   Un socle, un bouton, une bulle ouverte par-dessus gardent la leur. */
let ancreDanger=null,dangerSurvole=null,dangerTache=0,dangerMinuteur=0;
function survolDanger(e){if(dangerTache)return;dangerTache=requestAnimationFrame(()=>{dangerTache=0;try{
 const vue=$('map-view'),m=currentMap(),dessus=e.target&&e.target.closest&&e.target.closest('.token,button,.bulle,.door,.coffre,.note-mj');
 if(document.body.classList.contains('placement')){clearTimeout(dangerMinuteur);if(dangerSurvole){dangerSurvole=null;if(ancreDanger&&typeof bulleAncre!=='undefined'&&bulleAncre===ancreDanger)fermerBulle()}return}
 const q=m&&!dessus?mapPct(e):null,z=q&&dangersDe(m).length?formeDangerSous(q):null,vu=z&&(view==='mj'||m.fogOff||(typeof seenAt==='function'&&seenAt(q.x,q.y)));
 if(!vu){clearTimeout(dangerMinuteur);if(dangerSurvole){dangerSurvole=null;if(ancreDanger&&typeof bulleAncre!=='undefined'&&bulleAncre===ancreDanger)fermerBulle()}return}
 if(!ancreDanger){ancreDanger=document.createElement('div');ancreDanger.className='ancre-danger'}if(!ancreDanger.isConnected)vue.append(ancreDanger);
 ancreDanger.style.left=q.x+'%';ancreDanger.style.top=q.y+'%';
 const cle=z.t.id+'|'+cleFormeDanger(z.t,z.p);if(dangerSurvole===cle&&typeof bulleAncre!=='undefined'&&bulleAncre===ancreDanger){if(typeof placerBulle==='function')placerBulle();return}
 /* v1.081 : comme celle d'un adversaire, la bulle attend que la souris se pose — 700 ms sans bouger sur le terrain. */
 clearTimeout(dangerMinuteur);if(e.pointerType&&e.pointerType!=='mouse')return;
 dangerMinuteur=setTimeout(()=>{if(!ancreDanger||!ancreDanger.isConnected||window.socleEnMain)return;ouvreBulleDanger(z,cle)},700)}catch(err){}})}
function ouvreBulleDanger(z,cle){try{
 dangerSurvole=cle;const d=document.createElement('div');d.className='gear-detail large';const p=document.createElement('p');p.className='gear-nom';p.textContent='Terrain Dangereux : '+z.t.nom;d.append(p);
 const teinte=/^#[0-9a-fA-F]{3,8}$/.test(String(z.t.couleur||''))?z.t.couleur:'';if(teinte){d.classList.add('bulle-danger');d.style.setProperty('--teinte',teinte)}
 ouvrirBulle(ancreDanger,d,'bulle-gear');const bu=d.closest('.bulle');if(bu&&teinte)bu.style.setProperty('--bulle-bord','color-mix(in srgb,'+teinte+' 16%,#fbf3e2)')}catch(err){}}
if($('map-view')){$('map-view').addEventListener('pointermove',survolDanger);
 $('map-view').addEventListener('pointerleave',()=>{clearTimeout(dangerMinuteur);if(dangerSurvole){dangerSurvole=null;if(ancreDanger&&typeof bulleAncre!=='undefined'&&bulleAncre===ancreDanger)fermerBulle()}})}

/* v1.029 — Le terrain ne clignote plus au relâchement d'un socle : chaque rendu de la carte redessinait ses calques et relançait
   le pouls. Tant que rien n'a changé, les calques restent ; redessinés, le pouls reprend là où il en était. */
{const rdg=renderDangers;let cle=null;renderDangers=function(...x){const m=currentMap(),svg=$('dangers-carte');
 const k=m?currentMapId+'|'+JSON.stringify(dangersDe(m))+'|'+JSON.stringify(m.dangersDetruits||null)+'|'+JSON.stringify(m.seuilsSel||null)+'|'+JSON.stringify(m.dangersTrous||null):'';
 if(k&&k===cle&&svg&&svg.isConnected&&$('seuils-carte'))return;cle=k;const r=rdg(...x);
 const phase=-(performance.now()%5200)/1000+'s';document.querySelectorAll('#dangers-carte .danger-carte').forEach(p=>p.style.animationDelay=phase);return r}}
{const rdi=renderDifficiles;let cle=null;renderDifficiles=function(...x){const m=currentMap(),svg=$('difficiles-carte');
 const k=m?currentMapId+'|'+JSON.stringify(difficileDe(m)):'';
 if(k&&k===cle&&svg&&svg.isConnected&&$('difficiles-bords'))return;cle=k;return rdi(...x)}}

/* v1.040 — Pendant le glissement d'un socle, ce qui entre dans la vue de la troupe paraît sans attendre le lâcher : objets, indices,
   coffres, pièges découverts, lumières. Au plus une fois toutes les 120 ms ; les adversaires suivent visibilitesEnGeste. */
let solsEnGesteT=0;
{const veg=visibilitesEnGeste;visibilitesEnGeste=function(...x){const r=veg(...x);const t=performance.now();
 if(t-solsEnGesteT>=120){solsEnGesteT=t;try{renderCoffres();if(typeof renderPieges==='function')renderPieges();renderObjets();renderLumieres()}catch(e){}}return r}}

/* ---------- v1.044 — Les objets lancés en zone ----------
   Réglé sur une zone (Petite, Moyenne, Grande, Très grande : la zone de contact d'un socle de cette taille), l'objet se lance
   sur un point : au clic, la zone suit le pointeur, coupée par les murs, et se grise là où il ne peut pas tomber. Ses dés et ses
   états frappent chaque combattant qu'elle touche — le lanceur excepté — que l'objet admet (familles, rangs). Réglé pour
   détruire le terrain coché « Sel », il y gomme un vide de la taille de la zone ; le reste du terrain demeure. */
const AIRES_LANCER=['small','medium','large','huge'];
const aireLancer=p=>p&&AIRES_LANCER.includes(p.aire)?p.aire:'';
const anneauClos=r=>{const l=r.map(q=>[q[0],q[1]]);const a=l[0],b=l[l.length-1];if(a&&b&&(a[0]!==b[0]||a[1]!==b[1]))l.push([a[0],a[1]]);return l};
const versClipZone=l=>l.map(p=>(p.anneaux||[]).filter(r=>r&&r.length>=3).map(anneauClos)).filter(p=>p.length);
const depuisClipZone=mp=>(mp||[]).map(p=>({anneaux:p.map(r=>r.slice(0,-1)).filter(r=>r.length>=3)})).filter(p=>p.anneaux.length);
// Le terrain coché « Sel », moins ses zones gommées ; un calcul par type, gardé tant que rien ne change.
const trousCache=new WeakMap();
{const fa=formesActives;formesActives=function(m,t){const l=fa(m,t),tr=t&&t.sel===true&&m&&Array.isArray(m.dangersTrous)?m.dangersTrous:null;
 if(!tr||!tr.length||!l.length)return l;
 const cle=JSON.stringify(tr)+'|'+JSON.stringify(m.dangersDetruits||null),c=trousCache.get(t);if(c&&c.cle===cle&&c.src===t.formes)return c.res;
 let res=l;try{res=depuisClipZone(Clipper.difference(versClipZone(l),...tr.map(r=>[anneauClos(r)])))}catch(e){res=l}
 trousCache.set(t,{cle,src:t.formes,res});return res}}
// Un point dans une forme : dans son contour, hors de ses trous.
const dansFormePx=(c,f)=>pointInPolygon(c,f[0])&&!f.slice(1).some(h=>pointInPolygon(c,h));
{const vieux=formeDangerSous;formeDangerSous=function(q,garde){const m=currentMap();if(!m)return null;
 for(const t of dangersDe(m)){if(garde&&!garde(t))continue;for(const p of formesActives(m,t)){const r=p.anneaux||[];if(r[0]&&pointInPolygon([q.x,q.y],r[0])&&!r.slice(1).some(h=>pointInPolygon([q.x,q.y],h)))return {t,p}}}return null}}
const formesPxTrous=(m,t,size)=>formesActives(m,t).map(p=>p.anneaux.map(r=>r.map(q=>[q[0]/100*size.width,q[1]/100*size.height])));
{const vieux=dangerAuPassage;dangerAuPassage=function(o,chemin){const m=currentMap(),size=mapSize();if(!m||!size.width||!Array.isArray(chemin)||chemin.length<2||!dangersDe(m).length)return;
 const pts=chemin.filter(Boolean).map(q=>[q.x/100*size.width,q.y/100*size.height]);let frappe=false;
 dangersDe(m).forEach(t=>{if(!sensibleAuDanger(o,t))return;const formes=formesPxTrous(m,t,size);if(!formes.length)return;const anneaux=formes.flat(1);
  if(pts.some(c=>formes.some(f=>dansFormePx(c,f)))||pts.slice(1).some((c,i)=>segmentHitsPolys(pts[i],c,anneaux)))frappe=frappeDanger(o,t)||frappe});
 if(frappe){render();scheduleSave()}}}
// Le tracé de la zone autour d'un point, en % de carte : la zone de contact d'un socle de cette taille, coupée par les murs.
function zoneLancer(q,aire){const size=mapSize();if(!size.width)return [];return reachPolygon({x:q.x,y:q.y},walls(),contactRadius(tokenPx()*(SOCLE_TAILLES[aire]||1)),size.width,size.height,48)}
// v1.045 : au contact, la zone doit toucher la zone de contact du lanceur — y mordre, ou la border —, pas y être centrée.
const auContactDuLanceur=(a,q,aire)=>{const size=mapSize(),rz=aire?contactRadius(tokenPx()*(SOCLE_TAILLES[aire]||1)):0;return Math.hypot((q.x-a.x)/100*size.width,(q.y-a.y)/100*size.height)<=contactRadius(tokenOf(a))+rz+2};
// v1.049 : un objet lancé en zone (bombe, gaz…) part jusqu'à 10 m — du centre du lanceur au centre de la zone —, sans mur entre eux.
const PORTEE_LANCER_ZONE=10;
function zoneAtteinte(a,q,p){if(!a||!q||wallsBetween(a,q,walls()))return false;return metres(a,q,mapSize(),tokenPx())<=PORTEE_LANCER_ZONE}
let apercuZone=null;
function retireApercuZone(){if(!apercuZone)return;apercuZone.svg.remove();$('map').removeEventListener('pointermove',apercuZone.suit);cancelAnimationFrame(apercuZone.image);apercuZone=null}
{const ap=annulerPlacement;annulerPlacement=function(...x){retireApercuZone();return ap(...x)}}
function montreApercuZone(a,p){retireApercuZone();const aire=aireLancer(p),svg=document.createElementNS(nsSVG,'svg');svg.id='zone-lancer';svg.setAttribute('viewBox','0 0 100 100');
 svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(nsSVG,'path');svg.append(path);$('map-view').append(svg);
 const z={svg,image:0,q:null,suit:e=>{z.q=mapPct(e);if(z.image)return;z.image=requestAnimationFrame(()=>{z.image=0;const q=z.q,pts=q?zoneLancer(q,aire):[];
  if(pts.length<3){path.removeAttribute('d');return}path.setAttribute('d','M'+pts.map(v=>v[0].toFixed(2)+' '+v[1].toFixed(2)).join('L')+'Z');path.classList.toggle('hors',!zoneAtteinte(a,q,p))})}};
 $('map').addEventListener('pointermove',z.suit);apercuZone=z}
// Les combattants qu'une zone touche, le lanceur excepté.
function touchesDeZone(a,pts,p){const size=mapSize(),px=pts.map(v=>[v[0]/100*size.width,v[1]/100*size.height]);
 return actors.filter(x=>x&&x!==a&&alive(x)&&!x.horsCarte&&!x.orbeStatique&&polyTouchesDisc(px,[x.x/100*size.width,x.y/100*size.height],tokenOf(x)/2)&&cibleAdmise(x,p))}
// Gommer le terrain coché « Sel » sous la zone : le vide qu'elle trace, seulement là où un tel terrain la touche.
function gommeTerrainSel(pts){const m=currentMap();if(!m||pts.length<3)return [];const z=[anneauClos(pts)],noms=[];
 dangersDe(m).forEach(t=>{if(t.sel!==true)return;const l=formesActives(m,t);if(!l.length)return;let touche=false;try{touche=Clipper.intersection(versClipZone(l),z).length>0}catch(e){}if(touche&&!noms.includes(t.nom))noms.push(t.nom)});
 if(noms.length){m.dangersTrous=[...(m.dangersTrous||[]),pts.map(v=>[Math.round(v[0]*100)/100,Math.round(v[1]*100)/100])].slice(-40);renderDangers();saveMaps();scheduleSave()}
 return noms}
let zoneLancerIds=null;
{const ca=ciblesAtteignables;ciblesAtteignables=function(a,l,portee){if(zoneLancerIds&&Array.isArray(l)&&l.length&&l.every(j=>zoneLancerIds.has(j)))return l.slice();return ca(a,l,portee)}}
function lancerEnZone(a,o,p){if(!mapSize().width){log(o.name+' se lance sur la carte.',{local:true});return}
 if(p.de&&enCombat()&&pointsRestants(a,'action')<1){log(nomNum(a)+' a déjà dépensé son Action ce tour.',{local:true});return}
 viserCible('◈ '+o.name+' — clique où le lancer',(vise,q)=>{if(!q)return;
  if(!zoneAtteinte(a,q,p)){log(o.name+' se lance jusqu’à '+PORTEE_LANCER_ZONE+' m, sans mur entre '+nomNum(a)+' et la zone.',{local:true});return}
  const pts=zoneLancer(q,aireLancer(p));if(pts.length<3)return;
  const portee=auContactDuLanceur(a,q,aireLancer(p))?'contact':'distance';
  const touches=touchesDeZone(a,pts,p),crans=Math.max(1,p.crans|0);
  const pose=x=>{const ok=poseEtatPotion(x,p.etat,crans,a);if(ok&&(p.duree==='1'||p.duree==='2')&&enCombat())ajouteEtatBref(x,p.etat,round+(p.duree==='2'?1:0));return ok};
  if(p.de&&touches.length){const gomme=p.detruit==='oui'?gommeTerrainSel(pts):[];
   finPotion(a,o,'lancé'+(gomme.length?', '+gomme.join(', ')+' gommé':''));selected=actors.indexOf(a);
   zoneLancerIds=new Set(touches.map(x=>actors.indexOf(x)));
   try{attack({vises:[...zoneLancerIds],desSeuls:DICE_KEYS.map(c=>c===p.de?Math.max(1,p.nb|0):0),sansArme:true,portee,sansDegats:true,potion:true,
    etatsEnPlus:{etats:p.etat?Array(crans).fill(p.etat):[],touches:[]},apres:()=>{render();scheduleSave()}})}finally{zoneLancerIds=null}return}
  if(!payeAction(a))return;
  const gomme=p.detruit==='oui'?gommeTerrainSel(pts):[],t=!p.de&&p.etat?touches.filter(pose):[];
  finPotion(a,o,'lancé'+(gomme.length?', '+gomme.join(', ')+' gommé':'')+(t.length?', '+p.etat+(crans>1?' '+crans:'')+' sur '+t.map(nomNum).join(', '):'')+(!gomme.length&&!t.length?', sans effet':''))},o.name+' : geste annulé.');
 montreApercuZone(a,p)}
{const lp=lancerPotion;lancerPotion=function(a,o,p){if(p&&aireLancer(p)&&p.seuil!=='oui')return lancerEnZone(a,o,p);return lp(a,o,p)}}
/* ---------- v1.131 : la carte plein écran, ses panneaux flottants ----------
   Sur la Table (MJ et joueurs, écran de plus de 900 px), la carte prend toute la page sous le menu, d'un bord à l'autre et
   jusqu'en bas ; sa barre flotte en haut, entre les deux colonnes. Les panneaux — le tour, les combattants, les points de vie,
   les dés, la fiche, le journal — flottent par-dessus, rangés en colonnes comme avant. Chacun se prend par son titre ou par la
   barrette de son bord haut et se pose où l'on veut ; sa place se garde sur l'appareil. Un double-clic sur sa prise le rend à
   sa colonne. Rien ne se mesure pendant qu'on le promène : une image sur deux au plus, sa seule position.
   v1.132 : la carte se tient dans la zone libre — entre les colonnes, sous sa barre, au-dessus de la barre d'actions — : ajustée,
   elle y tient tout entière ; zoomée, on la décale jusqu'à mettre son bord au ras de cette zone, du noir sous les colonnes, mais
   jamais plus loin. Une fenêtre lâchée sur une colonne s'y range, au-dessus ou au-dessous des autres, au même écart. */
const FENETRES_CLE='amertume-fenetres',COLONNES_CLE='amertume-colonnes';
const cartePleine=()=>document.body.classList.contains('carte-pleine');
function lisFenetres(){try{const t=JSON.parse(localStorage.getItem(FENETRES_CLE)||'{}');return t&&typeof t==='object'?t:{}}catch(e){return {}}}
function gardeFenetres(t){try{localStorage.setItem(FENETRES_CLE,JSON.stringify(t))}catch(e){}}
function lisColonnes(){try{const t=JSON.parse(localStorage.getItem(COLONNES_CLE)||'null');return t&&Array.isArray(t.left)&&Array.isArray(t.right)?t:null}catch(e){return null}}
function gardeColonnes(t){try{localStorage.setItem(COLONNES_CLE,JSON.stringify(t))}catch(e){}}
const PANNEAUX_TABLE=[['tour','#round'],['combattants','#actors'],['pv','#pv-panel'],['des','#piste-des'],['fiche','#sheet'],['journal','#journal']];
function fenetresTable(){const L=document.querySelector('main.layout');if(!L)return [];
 return PANNEAUX_TABLE.map(([k,s])=>{const e=L.querySelector(s);return [k,e&&e.closest('.panel')]}).filter(([,p])=>p&&p.parentElement&&p.parentElement.matches('.stack.left,.stack.right'))}
const colonneTable=c=>document.querySelector('main.layout>.stack.'+c);
// L'ordre des panneaux dans chaque colonne, lu dans la page ; celui d'origine, gardé pour l'écran étroit.
function ordreColonnes(){const o={left:[],right:[]};['left','right'].forEach(c=>{const s=colonneTable(c);if(s)o[c]=[...s.children].map(e=>e.dataset&&e.dataset.fenetre).filter(Boolean)});return o}
let ORDRE_ORIGINE=null;
function rangeColonnes(o){const tous=new Map(fenetresTable());['left','right'].forEach(c=>{const s=colonneTable(c);if(!s)return;
 const voulu=(o[c]||[]).filter(k=>tous.has(k));if(ordreColonnes()[c].join()===voulu.join())return;voulu.forEach(k=>s.append(tous.get(k)))})}
function ordreVoulu(){const o=lisColonnes(),base=ORDRE_ORIGINE||ordreColonnes();if(!o)return base;
 const vu=new Set(),r={left:[],right:[]};['left','right'].forEach(c=>o[c].forEach(k=>{if(!vu.has(k)&&base.left.concat(base.right).includes(k)){vu.add(k);r[c].push(k)}}));
 ['left','right'].forEach(c=>base[c].forEach(k=>{if(!vu.has(k)){vu.add(k);r[c].push(k)}}));return r}
// Une fenêtre posée : sa place, gardée par rapport au cadre de la carte, se rapporte à sa colonne, qui la porte.
function poseFenetre(p,s,L){const r=L.getBoundingClientRect(),c=p.parentElement.getBoundingClientRect();
 const w=Math.min(Math.max(170,s.w||p.offsetWidth),r.width-16),x=Math.max(0,Math.min(r.width-60,s.x)),y=Math.max(0,Math.min(r.height-40,s.y));
 p.classList.add('flottante');p.style.width=Math.round(w)+'px';p.style.height=s.h?Math.round(Math.min(s.h,r.height-y))+'px':'';
 p.style.left=Math.round(r.left+x-c.left)+'px';p.style.top=Math.round(r.top+y-c.top)+'px'}
function rendFenetre(p){p.classList.remove('flottante','tenue');['left','top','width','height','zIndex'].forEach(k=>p.style[k]='')}
let hautTable=-1,modePlein=null;
function placeTablePleine(){const L=document.querySelector('main.layout');if(!L)return;
 if(!ORDRE_ORIGINE)ORDRE_ORIGINE=ordreColonnes();
 const on=innerWidth>900,change=on!==modePlein;modePlein=on;document.body.classList.toggle('carte-pleine',on);
 if(!on){fenetresTable().forEach(([,p])=>rendFenetre(p));rangeColonnes(ORDRE_ORIGINE);if(change)redessineCarte();return}
 if(!L.offsetParent)return;
 const haut=Math.max(0,Math.round(L.getBoundingClientRect().top+scrollY));
 if(haut!==hautTable){hautTable=haut;L.style.setProperty('--haut-table',haut+'px')}
 if(!document.querySelector('.panel.tenue'))rangeColonnes(ordreVoulu());
 const r=L.getBoundingClientRect(),g=colonneTable('left'),d=colonneTable('right');
 if(g)L.style.setProperty('--barre-g',Math.round(g.getBoundingClientRect().right-r.left+12)+'px');
 if(d)L.style.setProperty('--barre-d',Math.round(r.right-d.getBoundingClientRect().left+12)+'px');
 const t=lisFenetres();fenetresTable().forEach(([k,p])=>{if(p.classList.contains('tenue'))return;const s=t[k];
  if(s&&Number.isFinite(s.x)&&Number.isFinite(s.y))poseFenetre(p,s,L);else rendFenetre(p)});
 if(change||haut!==redessinePour)redessineCarte()}
// La carte change de cadre : elle se remesure et se repeint, une fois, à l'image suivante.
let redessinePour=-1,redessinePrevu=0;
function redessineCarte(){redessinePour=hautTable;if(redessinePrevu)return;redessinePrevu=requestAnimationFrame(()=>{redessinePrevu=0;
 if(document.body.classList.contains('page-maps'))return;applyMapRatio();applyMapZoom();render()})}
// La hauteur de la carte : celle de son panneau, toute la page sous le menu.
{const h0=hauteurDispoCarte;hauteurDispoCarte=function(el){if(cartePleine()&&el&&el.offsetParent){const p=el.closest('.map-panel');if(p&&p.clientHeight)return p.clientHeight}
 return h0.apply(this,arguments)}}
/* La zone libre, dans le panneau de la carte : entre les deux colonnes, sous la barre de la carte, au-dessus de la place de la
   barre d'actions — chacune à 12 px. Sur un écran trop petit pour elle, tout le panneau. Mesurée quand la carte se cale, gardée
   pour le zoom, qui la lit à chaque cran sans rien remesurer. */
let zoneCarte=null;
function zoneLibreCarte(){return cartePleine()?zoneCarte:null}
function mesureZoneLibre(p){const pr=p.getBoundingClientRect(),g=colonneTable('left'),d=colonneTable('right'),bar=p.querySelector(':scope>.mapbar'),act=p.querySelector(':scope>.barre-actions');
 let l=g?g.getBoundingClientRect().right-pr.left+12:12,r=d?d.getBoundingClientRect().left-pr.left-12:pr.width-12;if(r-l<240){l=12;r=pr.width-12}
 let t=bar&&bar.offsetParent?bar.getBoundingClientRect().bottom-pr.top+12:12,b=pr.height-Math.max(150,act&&act.offsetHeight?act.offsetHeight+26:0);if(b-t<200){t=12;b=pr.height-12}
 return {l,t,r,b}}
{const ar=applyMapRatio;applyMapRatio=function(){const el=$('map'),avant=el?[el.style.width,el.style.height,el.style.marginLeft,el.style.marginTop].join():'';
 const change=ar.apply(this,arguments),p=el&&el.closest('.map-panel');
 if(!cartePleine()||!p||!el.offsetParent||!p.clientWidth){zoneCarte=null;if(el&&(el.style.marginLeft||el.style.marginTop)){el.style.marginLeft=el.style.marginTop='';return true}return change}
 const Z=mesureZoneLibre(p),m=currentMap(),zw=Z.r-Z.l,zh=Z.b-Z.t;let x=0,y=0;
 if(m&&m.ratio){let w=zw,h=w/m.ratio;if(h>zh){h=zh;w=h*m.ratio}w=Math.round(w);h=Math.round(h);x=Math.round(Z.l+(zw-w)/2);y=Math.round(Z.t+(zh-h)/2);
  el.style.width=w+'px';el.style.height=h+'px';el.style.marginLeft=x+'px';el.style.marginTop=y+'px'}
 else if(el.style.marginLeft||el.style.marginTop)el.style.marginLeft=el.style.marginTop='';
 zoneCarte={l:Z.l-x,t:Z.t-y,r:Z.r-x,b:Z.b-y};
 return [el.style.width,el.style.height,el.style.marginLeft,el.style.marginTop].join()!==avant}}
// Les deux colonnes prennent toute la hauteur : le journal, où qu'il soit rangé, prend ce qui reste de la sienne.
{const c0=calerColonnes;calerColonnes=function(){const g=colonneTable('left'),d=colonneTable('right');
 if(!cartePleine()){[g,d].forEach(s=>{if(s&&s.classList.contains('colonne-pleine')){s.classList.remove('colonne-pleine');s.style.height=''}});return c0()}
 const L=document.querySelector('main.layout');if(!L||!L.offsetParent)return;
 const cs=getComputedStyle(L),H=Math.round(L.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom))+'px';
 [g,d].forEach(s=>{if(!s)return;if(s.classList.contains('calee'))s.classList.remove('calee');if(!s.classList.contains('colonne-pleine'))s.classList.add('colonne-pleine');if(s.style.height!==H)s.style.height=H})}}
{const a0=appliqueTailles;appliqueTailles=function(){const r=a0.apply(this,arguments);if(cartePleine())placeTablePleine();return r}}
{const sp=showPage;showPage=function(...x){const r=sp.apply(this,x);requestAnimationFrame(placeTablePleine);return r}}
/* La prise : la barrette du haut, le titre du panneau ; ni un bouton, ni un champ. La fenêtre prise passe devant les autres.
   Au-dessus d'une colonne, une place s'y ouvre, à l'écart des autres, là où elle se rangera si on la lâche. */
let fenetreDevant=3;
const estRangee=e=>e&&e.classList&&e.classList.contains('panel')&&!!e.dataset.fenetre&&!e.classList.contains('flottante')&&!!e.offsetParent;
function prendFenetres(){const L=document.querySelector('main.layout');if(!L)return;
 fenetresTable().forEach(([k,p])=>{if(p.querySelector(':scope>.prise-fenetre'))return;p.dataset.fenetre=k;if(k==='journal')p.classList.add('panneau-journal');
  const prise=document.createElement('div');prise.className='prise-fenetre';prise.setAttribute('aria-hidden','true');p.prepend(prise);
  const estPrise=e=>{if(!cartePleine()||e.target.closest('button,input,select,textarea,a,label,summary,[draggable="true"]'))return false;
   const h=e.target.closest('.prise-fenetre,h2,.eyebrow');return !!h&&(h.parentElement===p||h.parentElement.parentElement===p)};
  p.addEventListener('pointerdown',e=>{if(!cartePleine())return;
   const devant=()=>{p.style.zIndex=String(++fenetreDevant);const c=p.parentElement;L.querySelectorAll(':scope>.stack.left,:scope>.stack.right').forEach(s=>s.style.zIndex=s===c?'6':'')};
   if(p.classList.contains('flottante'))devant();
   if(e.button!==0||!estPrise(e))return;e.preventDefault();
   const x0=e.clientX,y0=e.clientY,pr=p.getBoundingClientRect();let parti=false,prevu=0,dernier=null;
   const place=document.createElement('div');place.className='place-fenetre';place.setAttribute('aria-hidden','true');
   const bouge=ev=>{dernier=ev;if(!parti){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<4)return;parti=true;try{p.setPointerCapture(e.pointerId)}catch(err){}
     place.style.height=Math.round(pr.height)+'px';if(estRangee(p))p.before(place);
     const r=L.getBoundingClientRect();poseFenetre(p,{x:pr.left-r.left,y:pr.top-r.top,w:pr.width,h:k==='journal'?pr.height:0},L);p.classList.add('tenue');devant()}
    if(prevu)return;prevu=requestAnimationFrame(()=>{prevu=0;const r=L.getBoundingClientRect(),c=p.parentElement.getBoundingClientRect();
     const x=Math.max(0,Math.min(r.width-60,pr.left-r.left+dernier.clientX-x0)),y=Math.max(0,Math.min(r.height-40,pr.top-r.top+dernier.clientY-y0));
     p.style.left=Math.round(r.left+x-c.left)+'px';p.style.top=Math.round(r.top+y-c.top)+'px';
     // La colonne sous le pointeur : la place s'ouvre avant le premier panneau rangé dont le milieu est plus bas que lui.
     const col=['left','right'].map(colonneTable).find(s=>{if(!s)return false;const q=s.getBoundingClientRect();return dernier.clientX>=q.left-24&&dernier.clientX<=q.right+24});
     if(!col){if(place.parentElement)place.remove();return}
     const ref=[...col.children].filter(n=>n!==p&&estRangee(n)).find(n=>{const q=n.getBoundingClientRect();return q.top+q.height/2>dernier.clientY})||null;
     let n=place.parentElement===col?place.nextElementSibling:undefined;while(n&&n!==ref&&!estRangee(n))n=n.nextElementSibling;
     if(n!==(ref||null))col.insertBefore(place,ref)})};
   const fin=()=>{removeEventListener('pointermove',bouge);removeEventListener('pointerup',fin);removeEventListener('pointercancel',fin);
    if(prevu){cancelAnimationFrame(prevu);prevu=0}if(!parti)return;p.classList.remove('tenue');const t=lisFenetres();
    if(place.parentElement){place.replaceWith(p);rendFenetre(p);delete t[k]}
    else{const r=L.getBoundingClientRect(),q=p.getBoundingClientRect();t[k]={x:Math.round(q.left-r.left),y:Math.round(q.top-r.top),w:Math.round(q.width),...(k==='journal'?{h:Math.round(q.height)}:{})}}
    gardeFenetres(t);gardeColonnes(ordreColonnes());calerColonnes()};
   addEventListener('pointermove',bouge);addEventListener('pointerup',fin);addEventListener('pointercancel',fin)});
  p.addEventListener('dblclick',e=>{if(!estPrise(e)||!p.classList.contains('flottante'))return;const t=lisFenetres();delete t[k];gardeFenetres(t);rendFenetre(p)})})}
prendFenetres();placeTablePleine();
addEventListener('resize',placeTablePleine);
if(typeof ResizeObserver==='function'){const h=document.querySelector('header');if(h)new ResizeObserver(()=>placeTablePleine()).observe(h)}
/* v1.134 — Tab ⇥, la touche au-dessus du verrouillage des majuscules, cache l'interface de la Table en plein écran : les panneaux
   et la barre de la carte s'effacent, la barre d'actions du bas reste. Un message, en haut de la carte, dit comment la rendre ;
   Tab la rend. Changer d'onglet, ou quitter la page du navigateur, la rend aussi. Rien ne bouge dessous : les panneaux gardent
   leur place, la carte la sienne — rien à remesurer, rien à repeindre. Ni dans un champ, ni fenêtre ouverte. */
let interfaceCachee=false;
function cacheInterfaceTable(on){if(on===interfaceCachee)return;interfaceCachee=on;document.body.classList.toggle('interface-cachee',on);
 let m=document.getElementById('interface-message');
 if(on&&!m){const p=document.querySelector('.map-panel');if(p){m=document.createElement('div');m.id='interface-message';m.className='interface-message';m.setAttribute('role','status');
  m.textContent='Appuyez sur Tab ⇥ pour faire réapparaître l’interface.';p.append(m)}}
 if(m)m.hidden=!on;if(on&&typeof fermerBulle==='function')fermerBulle()}
addEventListener('keydown',e=>{if(e.key!=='Tab'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.repeat)return;
 const L=document.querySelector('main.layout'),c=e.target;
 if(!cartePleine()||!L||!L.offsetParent||document.body.classList.contains('page-maps')||document.querySelector('dialog[open]'))return;
 if(c&&c.closest&&c.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],dialog,[popover]'))return;
 e.preventDefault();cacheInterfaceTable(!interfaceCachee)});
{const sp=showPage;showPage=function(...x){cacheInterfaceTable(false);return sp.apply(this,x)}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cacheInterfaceTable(false)});
addEventListener('resize',()=>{if(!cartePleine())cacheInterfaceTable(false)});
