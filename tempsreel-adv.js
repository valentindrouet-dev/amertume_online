/* ---------- v1.410 — L'IA simple des adversaires, en temps réel seulement ----------
   Trois garde-fous, tous ici :
   - elle ne tourne qu'en temps réel (trActif, tempsreel.js) : au tour par tour, rien ne bouge seul ;
   - elle ne démarre que si le MJ a cliqué « Débuter le combat » pour CE combat — le bouton reste donc
     affiché, en temps réel, tant qu'il ne l'a pas fait ;
   - elle ne tourne que chez le MJ, sur la Table, sans fenêtre ouverte ni socle en main.
   Les adversaires jouent sous les règles de tous : un PA par coup ou par talent, qui se recharge ; un
   PM disponible pour bouger ; mêmes refus, mêmes portées, mêmes dégâts d'opportunité qu'à la main —
   l'IA n'use que des gestes de la table (attack, les boutons de talents, le déplacement réglé).

   Ce qu'elle lit sur un adversaire (sa fiche, editor.js) : « menace », son Focus — qui il vise — et
   « priorite », sa Priorité d'action — au contact ou à distance d'abord. Sans réglage, Focus « Plus
   proche » et la priorité déduite de sa première attaque (prioriteDe).

   Pour retirer l'IA : ôter la balise <script> de ce fichier dans index.html. Le temps réel reste. */
'use strict';
const TRIA_PAS=500,TRIA_REPOS=900;
let triaCombat=null,triaOccupe=false,triaRang=0;
const triaAttente=new Map(),triaBoude=new Map(),triaTourTalent=new Map();
const triaPause=ms=>new Promise(r=>setTimeout(r,ms));
// Le MJ, sur la Table, en temps réel, pour un combat qu'il a débuté à la main.
function triaTourne(){return typeof trActif==='function'&&trActif()&&view==='mj'&&!(typeof enLigne!=='undefined'&&enLigne&&typeof estMJ==='function'&&!estMJ())
 &&triaCombat!==null&&triaCombat===numeroCombat&&!(typeof loading!=='undefined'&&loading)&&![...document.body.classList].some(c=>c.startsWith('page-'))}
function triaLibre(){return !window.socleEnMain&&!tirEnVol&&!placementEnCours&&!fermeFormesMur&&!document.querySelector('dialog[open]')}
// Ceux qu'elle mène : les adversaires révélés, debout, sur la carte. Un PNJ allié ou neutre n'en est pas.
function triaAdversaires(){return actors.filter(a=>a&&!a.hero&&!a.orbeStatique&&a.vu&&!a.horsCarte&&alive(a)&&campDe(a)==='adverse'&&!hasState(a,'Sommeil'))}
function triaProies(a){return actors.filter(o=>o&&o!==a&&!o.orbeStatique&&!o.horsCarte&&alive(o)&&campDe(o)==='troupe'&&!hasState(o,'Invisible'))}

/* Le Focus : parmi la troupe debout, selon la « menace » de la fiche. À égalité, le plus proche. */
function triaCible(a){const size=mapSize(),d=o=>Math.hypot((o.x-a.x)/100*size.width,(o.y-a.y)/100*size.height),l=triaProies(a);if(!l.length)return null;
 const niveau=o=>Math.max(1,Math.trunc(Number(o.level))||1),max=o=>Number(o.max)||0,hp=o=>Number(o.hp)||0;
 const cmp={pvLow:(x,y)=>hp(x)-hp(y),pvHigh:(x,y)=>hp(y)-hp(x),defLow:(x,y)=>defOf(x)-defOf(y),
  fort:(x,y)=>niveau(y)-niveau(x)||max(y)-max(x),faible:(x,y)=>niveau(x)-niveau(y)||max(x)-max(y)}[a.menace]||(()=>0);
 return actors.indexOf(l.slice().sort((x,y)=>cmp(x,y)||d(x)-d(y))[0])}
const triaTire=a=>attackChoices(a,items()).some(at=>(at.range||'contact')==='distance');
const triaContact=(a,j)=>reachTo(a,actors[j],j,'contact').ok;
const triaVue=(a,j)=>!blinded(a)&&reachTo(a,actors[j],j,'distance').ok;
/* L'attaque qui porte sur la cible : celle que sa priorité préfère d'abord, sinon celle qui l'atteint. Elle
   devient l'attaque en main, comme si le MJ l'avait choisie. */
function triaAttaque(a,j){const liste=attackChoices(a,items());if(!liste.length)return null;
 const contact=triaContact(a,j),vue=triaVue(a,j),sorte=at=>(at.range||'contact')==='distance'?'distance':'contact',porte=at=>sorte(at)==='contact'?contact:vue,voulue=prioriteDe(a);
 let k=liste.findIndex(at=>sorte(at)===voulue&&porte(at));if(k<0)k=liste.findIndex(porte);if(k<0)return null;a.activeAttack=k;return liste[k]}
// Le temps d'un geste, l'adversaire est le combattant choisi — la table ne frappe que par lui ; puis le MJ retrouve sa sélection.
async function triaEnMain(a,geste){const avant=actors[selected]?actors[selected].id:null,marques=new Set(marked);
 selected=actors.indexOf(a);markOnly(selected);
 try{return await geste()}
 finally{const k=avant===null?-1:actors.findIndex(o=>o.id===avant);selected=k>=0?k:null;marked=marques;render();scheduleSave()}}
// Un coup, attendu jusqu'à ce que ses dégâts tombent ; au plus tard trois secondes et demie.
function triaCoup(j){return new Promise(res=>{let fini=false;const fin=()=>{if(!fini){fini=true;res()}};
 try{attack({vises:[j],apres:fin})}catch(e){fin();throw e}setTimeout(fin,3500)})}
// Le refus se demande une fois l'adversaire en main et sa cible désignée : c'est ainsi que la table juge un coup.
async function triaFrappe(a,j){const at=triaAttaque(a,j);if(!at)return false;
 const avant=pointsRestants(a,'action');await triaEnMain(a,async()=>{poseCibles(a,[j]);render();if(!refusAttaque(a,at))await triaCoup(j)});return pointsRestants(a,'action')<avant}
/* Un talent : son bouton, tel que la table le donne. On ne joue que ce qui peut partir tout seul — un talent qui
   attend un clic sur la carte ou un choix est abandonné aussitôt et laissé à la main du MJ pour le reste du combat. */
function triaTalents(a){const t=Date.now();return boutonsTalents(a).filter(b=>b&&b.peut&&(b.code.cle==='orbes'||b.cout.pa>0||b.cout.pm>0)&&b.talent.type!=='reac'&&!((triaBoude.get(a.id+'|'+b.talent.id)||0)>t))}
// Un geste resté ouvert derrière l'IA se referme toujours, quoi qu'il arrive : sinon elle s'attendrait elle-même.
function triaRenonce(){try{renonceGeste()}catch(e){}try{if(placementEnCours)annulerPlacement()}catch(e){}try{if(fermeFormesMur)fermeFormesMur()}catch(e){}}
async function triaJoue(a,j,b){const cle=a.id+'|'+b.talent.id,trace=()=>JSON.stringify([a.checks,a.talentsJoues||[],a.orbes||0,a.usages||{},a.limitesCombat||{}]),avant=trace();
 await triaEnMain(a,async()=>{poseCibles(a,[j]);render();const moi=boutonsTalents(a).find(x=>x.talent.id===b.talent.id&&x.peut);if(!moi)return;
  try{moi.agir();for(let n=0;n<14&&tirEnVol;n++)await triaPause(250)}
  catch(e){triaBoude.set(cle,Infinity);if(typeof signaleErreur==='function')signaleErreur(e,'IA · '+(b.talent.name||''))}
  finally{if(placementEnCours||fermeFormesMur){triaRenonce();triaBoude.set(cle,Infinity)}}});
 if(trace()===avant){if(triaBoude.get(cle)!==Infinity)triaBoude.set(cle,Date.now()+15000);return false}return true}

/* Le déplacement, sous la règle du Mouvement de la table (en temps réel : un PM disponible, pas de distance comptée) ;
   l'IA, elle, avance par étapes de sa distance de mouvement, pour qu'on la voie venir. Ceux qu'elle quitte frappent,
   la Foudre tombe, un piège armé l'arrête puis part — comme à la main. */
function triaTronque(etapes,de,long){const out=[];let [x,y]=de,reste=long;
 for(const [u,v] of etapes){const d=Math.hypot(u-x,v-y);if(d<=reste){out.push([u,v]);reste-=d;x=u;y=v;continue}
  if(reste>1)out.push([x+(u-x)/d*reste,y+(v-y)/d*reste]);break}
 return out}
async function triaMarche(a,etapes,ignorer,arrive){const size=mapSize();if(!size.width||!etapes||!etapes.length)return false;
 const regle=regleMouvement(a);if(regle.fini)return false;
 noteContactsDepart(a);const croises=new Set(contactsDe(a)),depart={x:a.x,y:a.y};let piege=null;
 for(const [x,y] of etapes){if(arrive&&arrive())break;
  const q={x:x/size.width*100,y:y/size.height*100},avant={x:a.x,y:a.y};
  moveActor(a,q.x,q.y,false,ignorer,true);
  const borne=!appliqueRegleMouvement(a,regle);if(borne)jusquALaBorne(a,regle,q,(u,v)=>moveActor(a,u,v,false,ignorer,true));
  const h=typeof piegeAuPassage==='function'?piegeAuPassage(a,avant):null;if(h){a.x=h.x;a.y=h.y;piege=h;break}
  if(borne)break}
 settleActor(a,ignorer);
 if(Math.hypot((a.x-depart.x)/100*size.width,(a.y-depart.y)/100*size.height)<1){a.x=depart.x;a.y=depart.y;return false}
 const cout=soldeRegleMouvement(a,regle);if(cout>0)depensePoint(a,'mouvement',cout);
 ramasseContacts(a,croises,depart,size,walls());a.lameventPret=round;
 const el=document.querySelector('#map-view .token[data-id="'+CSS.escape(a.id)+'"]');
 if(el){el.classList.add('glisse');el.style.left=a.x+'%';el.style.top=a.y+'%';if(typeof suitLaJauge==='function')suitLaJauge(el)}
 await triaPause(280);
 updateRing();degatsOpportunite(a,[...croises]);compteDistance(a,depart);if(typeof passeMurs==='function')passeMurs(a,[depart,{x:a.x,y:a.y}]);afterMove(a);render();scheduleSave();
 if(piege&&typeof declenchePiege==='function')declenchePiege(piege.p,a,piege.contact);return true}
// Vers la cible : le chemin qui contourne murs et socles, une étape à la fois ; « arrive » dit quand s'arrêter.
async function triaApproche(a,j,arrive){const b=actors[j],size=mapSize();if(!b||!size.width||pointsRestants(a,'mouvement')<=0)return false;
 const px=o=>[o.x/100*size.width,o.y/100*size.height],[bx,by]=px(b),arret=tokenOf(a)/2+tokenOf(b)/2+1;
 const etapes=(cheminVersContact(a,b,size)||[]).slice(1);
 const auBord=([x,y])=>{const dx=x-bx,dy=y-by,n=Math.hypot(dx,dy)||1;return [bx+dx/n*arret,by+dy/n*arret]};
 etapes.push(auBord(etapes.length?etapes[etapes.length-1]:px(a)));
 const pas=Math.max(1.5,distanceMouvement(a,items()))*tokenPx();
 return triaMarche(a,triaTronque(etapes,px(a),pas),new Set([a.id,b.id]),arrive)}
// Se dégager pour tirer : le point le plus proche hors de tout contact adverse, la cible encore en vue.
async function triaRecule(a,j){const size=mapSize();if(!size.width||!contactsDe(a).length||pointsRestants(a,'mouvement')<=0)return false;
 const ax=a.x/100*size.width,ay=a.y/100*size.height,t=tokenOf(a),ignorer=new Set([a.id]),x0=a.x,y0=a.y;let mieux=null;
 const essai=(x,y)=>{const e={...a},regle=regleMouvement(a);if(regle.fini)return null;moveActor(e,x/size.width*100,y/size.height*100,false,ignorer,true);return {x:e.x,y:e.y}};
 for(const r of [t*2,t*3,t*4.5])for(let k=0;k<12;k++){const ang=k/12*Math.PI*2,p=essai(ax+Math.cos(ang)*r,ay+Math.sin(ang)*r);if(!p)continue;
  a.x=p.x;a.y=p.y;const bon=!contactsDe(a).length&&triaVue(a,j);a.x=x0;a.y=y0;if(!bon)continue;
  const d=Math.hypot(p.x/100*size.width-ax,p.y/100*size.height-ay);if(d>=1&&(!mieux||d<mieux.d))mieux={x:p.x,y:p.y,d}}
 return mieux?triaMarche(a,[[mieux.x/100*size.width,mieux.y/100*size.height]],ignorer,null):false}

/* Le tour d'un adversaire : un geste, un seul, puis il laisse la place. Dans l'ordre —
   se relever ; un talent ou un coup s'il a un PA (ils alternent, pour qu'il ne répète pas le même) ;
   sinon se placer selon sa priorité : rejoindre sa cible, ou se dégager pour tirer. */
async function triaActive(a){const j=triaCible(a);if(j===null)return false;
 if(hasState(a,'Au sol')){if(pointsRestants(a,'mouvement')<=0)return false;depensePoint(a,'mouvement');setState(a,'Au sol',false);render();scheduleSave();return true}
 const tireur=prioriteDe(a)==='distance'&&triaTire(a);
 if(pointsRestants(a,'action')>0&&!gelDebut(a)){
  // À distance d'abord : au contact d'un adversaire, il s'en dégage avant de tirer.
  if(tireur&&contactsDe(a).some(o=>hostiles(o,a))&&await triaRecule(a,j))return true;
  const talents=triaTalents(a),rang=triaTourTalent.get(a.id)||0;triaTourTalent.set(a.id,rang+1);
  // Un geste sur deux, un talent s'il en a un de jouable ; l'autre, ou faute de talent, son attaque.
  if(talents.length&&rang%2===0&&await triaJoue(a,j,talents[Math.floor(rang/2)%talents.length]))return true;
  if(await triaFrappe(a,j))return true;
  if(talents.length&&rang%2===1&&await triaJoue(a,j,talents[Math.floor(rang/2)%talents.length]))return true}
 // Rien n'est parti : il se place. Le tireur cherche la vue, les autres le contact.
 if(tireur?triaVue(a,j):triaContact(a,j))return false;
 return triaApproche(a,j,()=>tireur?triaVue(a,j):triaContact(a,j))}
async function triaPasse(){if(triaOccupe||!triaTourne()||!triaLibre())return;const l=triaAdversaires(),t=Date.now();if(!l.length)return;
 triaOccupe=true;
 try{for(let n=0;n<l.length;n++){const a=l[(triaRang+n)%l.length];if((triaAttente.get(a.id)||0)>t)continue;
   let fait=false;try{fait=await triaActive(a)}catch(e){if(typeof signaleErreur==='function')signaleErreur(e,'IA');triaAttente.set(a.id,Date.now()+3000);continue}
   // Qui n'a rien pu faire repasse vite ; qui a agi souffle un instant.
   triaAttente.set(a.id,Date.now()+(fait?TRIA_REPOS:700));if(fait){triaRang=(triaRang+n+1)%l.length;break}}}
 finally{triaOccupe=false}}
setInterval(()=>{triaPasse().catch(e=>{triaOccupe=false;if(typeof signaleErreur==='function')signaleErreur(e,'IA')})},TRIA_PAS);

/* « Débuter le combat », cliqué par le MJ : c'est le départ de l'IA pour ce combat-ci. En temps réel, le bouton reste
   donc affiché tant qu'il n'a pas été cliqué, même si le combat s'est entamé de lui-même. */
{const b=document.getElementById('debuter-combat');
 if(b)b.addEventListener('click',()=>{if(view==='mj'&&enCombat()){triaCombat=numeroCombat;triaBoude.clear();triaAttente.clear();render()}});
 const rendu=render;render=function(...x){const o=rendu.apply(this,x);
  if(!enCombat())triaCombat=null;
  if(b&&view==='mj'&&enCombat()&&typeof tempsReel!=='undefined'&&tempsReel&&triaCombat!==numeroCombat)b.hidden=false;return o}}
