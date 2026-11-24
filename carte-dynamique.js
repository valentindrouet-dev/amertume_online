/* ---------- v1.417 — Les Cartes Dynamiques ----------
   Une carte cochée « Carte dynamique » dans l'éditeur de cartes se joue autrement, sur la Table :
   - la carte s'affiche telle qu'elle est (v1.418 : plus de vue isométrique calculée — une carte se peint en isométrique si
     on la veut ainsi) ; les jetons se recouvrent selon leur profondeur, le plus bas devant ;
   - un clic sur le sol fait marcher l'aventurier sélectionné jusque-là, en contournant les murs ; un clic sur un adversaire
     le fait marcher jusqu'à son contact ;
   - il n'y a plus de mode combat : tant que la carte est ouverte, le combat ne commence jamais ;
   - chaque aventurier frappe seul, de son attaque en main, l'adversaire révélé le plus proche à sa portée, à la cadence de
     son arme (« cadence », en secondes, réglée dans l'Armurerie ; sinon 2 s, et 3,5 s pour une arme à deux mains). Le coup
     est celui de la table — dés, dégâts, journal — sans dépenser de PA. Les adversaires ne ripostent pas encore.
   Les frappes ne partent que chez le MJ (sur la table en ligne, chez le MJ connecté) : chacun les voit arriver par la table.

   Tout tient dans ce fichier, la case de l'éditeur et le champ « Cadence » de l'Armurerie exceptés (editor.js, maps.js).
   Pour retirer les Cartes Dynamiques : ôter sa balise <script> dans index.html. */
'use strict';
const DYN_VITESSE=4,DYN_PAS=80;
let dynMain=null,dynFrappe=false,dynAttaquant=null;
const dynMarches=new Map(),dynProchain=new Map();
const dynTable=()=>typeof PAGES==='undefined'||!PAGES.some(x=>x!=='table'&&document.body.classList.contains('page-'+x));
function carteDynamique(){const m=typeof currentMap==='function'?currentMap():null;return !!(m&&m.dynamique===true)}
const dynChezMJ=()=>view==='mj'&&!(typeof enLigne!=='undefined'&&enLigne&&typeof estMJ==='function'&&!estMJ());

// La profondeur : plus un socle est bas sur la carte, plus il passe devant — une carte peinte en isométrique se lit ainsi.
function dynProfondeur(){const dyn=document.body.classList.contains('carte-dynamique');
 document.querySelectorAll('#map-view .token[data-id]').forEach(el=>{const a=actors.find(o=>o.id===el.dataset.id);
  el.style.zIndex=dyn&&a?String(2+Math.round(a.y*10)):''})}

/* ---------- Pas de mode combat ---------- */
{const bascule=basculerMode;basculerMode=function(neuf,...x){if(neuf==='combat'&&carteDynamique())return;return bascule.call(this,neuf,...x)}}

/* ---------- Marcher ----------
   Le chemin de la table, qui contourne murs et socles ; puis le socle avance à vitesse constante, pas à pas, sous les
   mêmes règles que sous la souris : murs, socles, pièges. Un nouveau clic remplace la marche en cours. */
function dynArrete(a){const m=a&&dynMarches.get(a.id);if(m){clearTimeout(m.t);dynMarches.delete(a.id)}}
/* Le chemin, sur la grille de la table (celle de cheminVersContact) : murs et socles adverses barrent, les alliés se
   traversent. On s'arrête au contact de la cible — sans mur entre eux —, ou au point visé. Un point hors d'atteinte (dans un
   mur, derrière une porte close) mène au plus près qu'on puisse aller. */
function dynEtapes(a,but,cible){const s=mapSize(),px=(x,y)=>[x/100*s.width,y/100*s.height],polys=obstaclesDuPas(px);
 const rb=tokenOf(a)/2,ra=cible?tokenOf(cible)/2:0,barrent=soclesOccupes(a,s,new Set([a.id,...(cible?[cible.id]:[])]),true),[bx,by]=px(a.x,a.y);
 const [dx,dy]=cible?px(cible.x,cible.y):px(but.x,but.y);
 const pas=Math.max(4,rb*.7),cols=Math.ceil(s.width/pas),rows=Math.ceil(s.height/pas),centre=k=>[(k%cols+.5)*pas,(Math.floor(k/cols)+.5)*pas];
 const vus=new Map(),libre=k=>{if(vus.has(k))return vus.get(k);const p=centre(k);
  let ok=p[0]>=rb&&p[1]>=rb&&p[0]<=s.width-rb&&p[1]<=s.height-rb&&!dansUnSocle(p,barrent,rb);
  if(ok){const q=slideOutOfWalls(p,polys,rb);ok=Math.hypot(q[0]-p[0],q[1]-p[1])<.5}vus.set(k,ok);return ok};
 const arrive=([x,y])=>{const d=Math.hypot(x-dx,y-dy);return (cible?d<=ra+rb+pas*.8:d<=pas)&&!segmentHitsPolys([x,y],[dx,dy],polys)};
 const depart=Math.min(rows-1,Math.max(0,Math.floor(by/pas)))*cols+Math.min(cols-1,Math.max(0,Math.floor(bx/pas)));
 const avant=new Map([[depart,-1]]),file=[depart];let fin=-1,proche=depart,dProche=Infinity;
 for(let n=0;n<file.length&&n<60000;n++){const k=file[n],c0=centre(k);
  if(arrive(c0)){fin=k;break}
  const d=Math.hypot(c0[0]-dx,c0[1]-dy);if(d<dProche){dProche=d;proche=k}
  const c=k%cols,r=Math.floor(k/cols);
  for(const [u,v] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nc=c+u,nr=r+v;if(nc<0||nr<0||nc>=cols||nr>=rows)continue;
   const j=nr*cols+nc;if(avant.has(j)||!libre(j)||segmentHitsPolys(c0,centre(j),polys))continue;avant.set(j,k);file.push(j)}}
 const bout=fin>=0?fin:proche,etapes=[];for(let k=bout;k!==-1;k=avant.get(k))etapes.push(centre(k));etapes.reverse();etapes.shift();
 // Le dernier pas : au bord du socle visé, ou sur le point, s'il est atteint.
 if(fin>=0){if(cible){const d=etapes.length?etapes[etapes.length-1]:[bx,by],ux=d[0]-dx,uy=d[1]-dy,n=Math.hypot(ux,uy)||1,arret=ra+rb+1;etapes.push([dx+ux/n*arret,dy+uy/n*arret])}else etapes.push([dx,dy])}
 return etapes}
function dynMarche(a,but,cible){dynArrete(a);const s=mapSize(),i=actors.indexOf(a);if(!s.width||i<0)return;
 const etapes=dynEtapes(a,but,cible),depart={x:a.x,y:a.y},ignorer=new Set([a.id,...(cible?[cible.id]:[])]),pas=DYN_VITESSE*tokenPx()*DYN_PAS/1000;
 const fin=()=>{dynMarches.delete(a.id);settleActor(a,ignorer);if(Math.hypot(a.x-depart.x,a.y-depart.y)>=.05){compteDistance(a,depart);passeMurs(a,[depart,{x:a.x,y:a.y}]);afterMove(a)}render();scheduleSave()};
 const avance=()=>{if(!carteDynamique()||!alive(a)||!canMove(actors.indexOf(a))){fin();return}
  if(cible&&reachTo(a,cible,actors.indexOf(cible),'contact').ok){fin();return}
  let reste=pas;const avant={x:a.x,y:a.y};
  while(reste>0&&etapes.length){const [x,y]=etapes[0],ax=a.x/100*s.width,ay=a.y/100*s.height,d=Math.hypot(x-ax,y-ay);
   if(d<=reste){moveActor(a,x/s.width*100,y/s.height*100,false,ignorer,true);etapes.shift();reste-=d}
   else{moveActor(a,(ax+(x-ax)/d*reste)/s.width*100,(ay+(y-ay)/d*reste)/s.height*100,false,ignorer,true);reste=0}}
  const piege=typeof piegeAuPassage==='function'?piegeAuPassage(a,avant):null;
  if(piege){a.x=piege.x;a.y=piege.y;fin();if(!piege.bloque&&typeof declenchePiege==='function')declenchePiege(piege.p,a,piege.contact);return}
  const bouge=Math.hypot((a.x-avant.x)/100*s.width,(a.y-avant.y)/100*s.height);
  const el=document.querySelector('#map-view .token[data-id="'+CSS.escape(a.id)+'"]');if(el)el.classList.add('glisse');render();
  // Bloqué (un mur, un socle) ou arrivé : la marche s'arrête.
  if(!etapes.length||bouge<.3){fin();return}
  dynMarches.set(a.id,{t:setTimeout(avance,DYN_PAS)})};
 dynMarches.set(a.id,{t:setTimeout(avance,0)})}
// Le clic : sur le sol, l'aventurier en main y marche ; sur un adversaire, il marche jusqu'à son contact. Le reste ne change pas.
$('map').addEventListener('pointerdown',e=>{if(!document.body.classList.contains('carte-dynamique')||e.button!==0||e.altKey||e.shiftKey||e.metaKey||e.ctrlKey)return;
 if(e.target.closest('#map-doors,#map-fenetres,#map-coffres,#map-pieges,#piege-boutons,#porte-boutons,#objet-boutons'))return;
 const k=actors.findIndex(o=>o&&o.id===dynMain),a=actors[k];if(!a||!a.hero||!alive(a)||!controlled(k)||!canMove(k))return;
 const t=e.target.closest('.token');let cible=null;
 if(t){cible=actors.find(o=>o.id===t.dataset.id)||null;if(!cible||cible===a||!hostiles(cible,a)||(view!=='mj'&&cachePour(cible,actors.indexOf(cible))))return}
 e.preventDefault();e.stopImmediatePropagation();dynAvale=true;
 if(typeof pingCarte==='function'&&!cible){const p=mapPct(e);pingCarte(p.x,p.y,false)}
 dynMarche(a,cible?null:mapPct(e),cible)},{capture:true});

// Le clic qui suit ce geste ne sélectionne rien : il est avalé.
let dynAvale=false;
$('map').addEventListener('click',e=>{if(!dynAvale)return;dynAvale=false;e.preventDefault();e.stopImmediatePropagation()},{capture:true});
$('map').addEventListener('pointerdown',()=>{},{capture:true});

/* ---------- Frapper seul ---------- */
// La cadence d'une attaque : celle de son arme la plus lente, sinon 2 s, 3,5 s à deux mains ; à mains nues, 2 s.
function cadenceDe(a){const att=activeAttack(a),portee=att.range==='distance'?true:false;
 const l=items(),armes=(Array.isArray(a.weapons)?a.weapons:[]).map(id=>l.find(w=>w&&w.id===id)).filter(w=>w&&w.category==='weapon'&&(w.ranged===true)===portee);
 if(!armes.length)return 2;
 return Math.max(...armes.map(w=>{const c=Number(w.cadence);return Number.isFinite(c)&&c>0?Math.min(10,Math.max(.5,c)):weaponHands(w)===2?3.5:2}))}
// L'adversaire révélé le plus proche à portée de son attaque en main, ou personne.
function dynCibleDe(a){const att=activeAttack(a),portee=att.range==='distance'?'distance':'contact',s=mapSize();if(portee==='distance'&&blinded(a))return null;
 let mieux=null,d0=Infinity;
 actors.forEach((o,j)=>{if(!o||o===a||o.horsCarte||!alive(o)||!o.vu||o.hidden||!hostiles(o,a)||hasState(o,'Invisible'))return;
  if(!reachTo(a,o,j,portee).ok)return;const d=Math.hypot((o.x-a.x)/100*s.width,(o.y-a.y)/100*s.height);if(d<d0){d0=d;mieux=j}});
 return mieux}
/* Un coup : le temps de l'appel, l'aventurier est le combattant choisi — la table ne frappe que par lui —, puis le MJ retrouve
   sa sélection. Le coup se résout ensuite tout seul (dés, dégâts, journal) : on ne l'attend pas, chacun garde sa cadence. */
function dynCoup(a,j){const k=actors.indexOf(a);if(k<0)return;dynAttaquant=a;dynFrappe=true;
 try{selected=k;markOnly(k);poseCibles(a,[j]);render();attack({vises:[j],sansAction:true})}
 catch(e){if(typeof signaleErreur==='function')signaleErreur(e,'carte dynamique')}
 finally{dynAttaquant=null;dynFrappe=false;const m=dynMain===null?-1:actors.findIndex(o=>o.id===dynMain);selected=m>=0?m:null;markOnly(selected===null?-1:selected);render()}}
function dynFrappes(){if(!carteDynamique()||!dynChezMJ()||!dynTable()||(typeof loading!=='undefined'&&loading)||placementEnCours||window.socleEnMain)return;
 try{if(document.querySelector('dialog:modal'))return}catch(e){}
 const t=Date.now();
 for(const a of actors.slice()){if(tirEnVol)return;
  if(!a||!a.hero||a.horsCarte||!alive(a)||hasState(a,'Au sol')||hasState(a,'Sommeil')||dynMarches.has(a.id))continue;
  if((dynProchain.get(a.id)||0)>t)continue;const j=dynCibleDe(a);if(j===null)continue;
  dynProchain.set(a.id,t+cadenceDe(a)*1000);dynCoup(a,j)}}
setInterval(()=>{try{dynFrappes()}catch(e){dynFrappe=false;dynAttaquant=null;if(typeof signaleErreur==='function')signaleErreur(e,'carte dynamique')}},200);

/* ---------- À chaque rendu ---------- */
{const rendu=render;render=function(...x){
  const dyn=carteDynamique()&&dynTable();
  document.body.classList.toggle('carte-dynamique',dyn);
  const o=rendu.apply(this,x);
  // L'aventurier en main : la sélection du MJ (ou du joueur), lue hors des frappes.
  if(!dynAttaquant||actors[selected]!==dynAttaquant)dynMain=actors[selected]?actors[selected].id:null;
  dynProfondeur();
  // Sans mode combat, pas de « Début du combat ».
  {const b=$('start-combat');if(b&&dyn)b.hidden=true}
  // Une carte dynamique ouverte en plein combat : le combat s'achève.
  if(dyn&&dynChezMJ()&&enCombat())setTimeout(()=>{if(carteDynamique()&&enCombat()){basculerMode('exploration');render()}},0);
  return o}}

