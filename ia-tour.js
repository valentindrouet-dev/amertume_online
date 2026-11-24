/* ---------- v1.413 — Les adversaires menés par l'IA, au tour par tour ----------
   Une option du MJ (le bouton 🤖 de la barre de la carte). Les règles sont celles du tour par tour, sans rien y changer :
   PA et PM par tour, distance de mouvement, limites des talents. L'IA ne fait qu'enchaîner les tours —
   1. les aventuriers jouent d'abord, comme toujours ;
   2. quand plus aucun aventurier debout n'a de PA — ou quand le MJ clique « Tour suivant » —, les adversaires révélés
      jouent seuls, l'un après l'autre, chacun jusqu'à ne plus rien pouvoir faire ;
   3. puis « Tour suivant » part de lui-même : tout le monde retrouve ses PA et ses PM.
   Garde-fous : seulement pour un combat que le MJ a lancé à la main (« ⚔ Début du combat », ou « Débuter le combat »
   pour un combat parti tout seul — ce bouton reste alors affiché tant qu'il ne l'a pas cliqué) ; seulement chez le MJ,
   sur la Table, sans fenêtre ouverte devant ni socle en main.
   L'IA n'use que des gestes de la table (attack, les boutons de talents, le déplacement réglé) : mêmes refus, mêmes
   portées, mêmes dégâts d'opportunité qu'à la main. Elle lit sur la fiche d'un adversaire son Focus (« menace ») et sa
   Priorité d'action (« priorite », prioriteDe dans editor.js).
   Le temps réel des v1.409 à v1.412 (recharge des points à l'horloge) est retiré ; l'historique du dépôt le garde.

   Pour retirer l'IA : ôter la balise <script> de ce fichier dans index.html. */
'use strict';
const TRIA_PAS=500,TRIA_CLE='amertume-ia-adversaires',TRIA_CLE_HEROS='amertume-ia-aventuriers';
const triaLu=k=>{try{return localStorage.getItem(k)==='1'}catch(e){return false}},triaEcrit=(k,v)=>{try{localStorage.setItem(k,v?'1':'0')}catch(e){}};
/* « iaTour » : l'option. « triaHeros » : les aventuriers aussi (le bouton 👥, visible quand l'option est allumée) — l'IA mène
   alors tous les aventuriers debout SAUF celui que le MJ a sélectionné (« triaMain » : sa sélection à lui, pas celle que
   l'IA prend le temps d'un geste). « triaFait » : le tour dont les adversaires ont joué. */
let iaTour=triaLu(TRIA_CLE),triaHeros=triaLu(TRIA_CLE_HEROS),triaMain=null,triaCombat=null,triaOccupe=false,triaRang=0,triaFait='';
const triaAttente=new Map(),triaBoude=new Map(),triaTourTalent=new Map(),triaFinis=new Set();
const triaPause=ms=>new Promise(r=>setTimeout(r,ms));
const triaCleTour=()=>numeroCombat+'.'+round;
// Les gestes que l'IA a faits ce tour : un tour où personne n'a rien fait ne s'enchaîne pas tout seul.
let triaGestes={cle:'',n:0};const triaCompte=()=>{const c=triaCleTour();if(triaGestes.cle!==c)triaGestes={cle:c,n:0};triaGestes.n++};
// Le MJ, sur la Table, l'option allumée, pour un combat qu'il a lancé à la main.
function triaTourne(){return iaTour&&enCombat()&&view==='mj'&&!(typeof enLigne!=='undefined'&&enLigne&&typeof estMJ==='function'&&!estMJ())
 &&triaCombat!==null&&triaCombat===numeroCombat&&!(typeof loading!=='undefined'&&loading)&&![...document.body.classList].some(c=>c.startsWith('page-'))}
// Une fenêtre ouverte devant la table la met en pause ; un panneau simplement posé à côté, non.
function triaFenetre(){try{return !!document.querySelector('dialog:modal')}catch(e){return !!document.querySelector('dialog[open]')}}
function triaLibre(){return !window.socleEnMain&&!tirEnVol&&!placementEnCours&&!fermeFormesMur&&!triaFenetre()}
// Ceux qu'elle mène : les adversaires révélés, debout, sur la carte — un PNJ allié ou neutre n'en est pas — et, si le MJ
// l'a choisi, les aventuriers qu'il n'a pas en main.
const triaDebout=a=>a&&!a.orbeStatique&&!a.horsCarte&&alive(a)&&!hasState(a,'Sommeil');
function triaAdversaires(){return actors.filter(a=>triaDebout(a)&&!a.hero&&a.vu&&campDe(a)==='adverse')}
function triaAventuriers(){return triaHeros?actors.filter(a=>triaDebout(a)&&a.hero===true&&a.id!==triaMain):[]}
function triaMenes(){return [...triaAdversaires(),...triaAventuriers()]}
// Ceux qu'il peut viser : le camp d'en face, debout, pas invisible ; un aventurier ne vise qu'un adversaire révélé.
function triaProies(a){return actors.filter(o=>triaDebout(o)&&o!==a&&hostiles(o,a)&&(a.hero?!o.hero&&o.vu:campDe(o)==='troupe')&&!hasState(o,'Invisible'))}

/* Le Focus : parmi ceux d'en face, selon la « menace » de la fiche (un aventurier n'en a pas : le plus proche). À égalité, le plus proche. */
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
 finally{if(actors[selected]===a){const k=avant===null?-1:actors.findIndex(o=>o.id===avant);selected=k>=0?k:null;marked=marques}render();scheduleSave()}}
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

/* Le déplacement, sous la règle du Mouvement de la table — sa distance, son point de Mouvement —, par étapes, pour qu'on
   la voie venir. Ceux qu'elle quitte frappent,
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

/* Un geste d'un combattant mené, un seul ; « faux » quand il n'a plus rien à faire ce tour. Dans l'ordre —
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
/* ---------- Les tours ---------- */
// Les aventuriers ont fini : plus un PA chez ceux qui tiennent debout — un aventurier mené par l'IA qui n'a plus rien à faire compte pour fini.
function triaHerosFinis(){const h=actors.filter(a=>triaDebout(a)&&a.hero===true),cle=triaCleTour();return h.length>0&&h.every(o=>pointsRestants(o,'action')<=0||triaFinis.has(cle+'|'+o.id))}
// Le tour des adversaires : chacun enchaîne ses gestes jusqu'à ne plus rien pouvoir faire ; puis le tour suivant, de lui-même.
async function triaTourAdversaires(){if(triaOccupe)return;const cle=triaCleTour(),vaut=()=>triaTourne()&&triaCleTour()===cle;triaOccupe=true;triaFait=cle;
 try{await triaPause(700);
  for(const a of triaAdversaires()){for(let n=0;n<8&&vaut()&&triaDebout(a);n++){
    for(let k=0;k<100&&vaut()&&!triaLibre();k++)await triaPause(300);if(!vaut()||!triaLibre())break;
    let fait=false;try{fait=await triaActive(a)}catch(e){if(typeof signaleErreur==='function')signaleErreur(e,'IA');break}
    if(!fait)break;triaCompte();await triaPause(450)}}}
 finally{triaOccupe=false}
 // Personne n'a rien fait de tout le tour — ni l'IA, ni un aventurier à la main : le MJ garde « Tour suivant », rien ne tourne à vide.
 if(!(triaGestes.cle===cle&&triaGestes.n>0)&&!actors.some(o=>o&&o.hero&&(pointsUses(o,'action')>0||pointsUses(o,'mouvement')>0)))return;
 if(!vaut())return;await triaPause(900);for(let k=0;k<100&&vaut()&&!triaLibre();k++)await triaPause(300);
 if(vaut()&&triaLibre())tourSuivant()}
// Pendant le tour des aventuriers : ceux que l'IA mène jouent, un geste à la fois ; puis, tous finis, les adversaires.
async function triaPasse(){if(triaOccupe||!triaTourne()||!triaLibre())return;const cle=triaCleTour();if(triaFait===cle)return;
 const l=triaAventuriers().filter(a=>!triaFinis.has(cle+'|'+a.id)),t=Date.now();
 if(l.length){triaOccupe=true;
  try{for(let n=0;n<l.length;n++){const a=l[(triaRang+n)%l.length];if((triaAttente.get(a.id)||0)>t)continue;
    let fait=false;try{fait=await triaActive(a)}catch(e){if(typeof signaleErreur==='function')signaleErreur(e,'IA')}
    triaAttente.set(a.id,Date.now()+600);if(fait){triaCompte();triaRang=(triaRang+n+1)%l.length;break}triaFinis.add(cle+'|'+a.id)}}
  finally{triaOccupe=false}}
 if(triaTourne()&&triaCleTour()===cle&&triaAdversaires().length&&triaHerosFinis())triaTourAdversaires()}
setInterval(()=>{triaPasse().catch(e=>{triaOccupe=false;if(typeof signaleErreur==='function')signaleErreur(e,'IA')})},TRIA_PAS);
// « Tour suivant », cliqué par le MJ avant que les adversaires aient joué : ils jouent d'abord, puis le tour passe.
{const nx=document.getElementById('next');if(nx){const avant=nx.onclick;
  nx.onclick=function(e){if(triaTourne()&&!triaOccupe&&triaFait!==triaCleTour()&&triaAdversaires().length){triaTourAdversaires();return}return avant?avant.call(this,e):undefined}}}

/* ---------- Les boutons du MJ : 🤖 l'option, et 👥 les aventuriers aussi (affiché quand l'option est allumée) ---------- */
const triaBouton=typeof icone==='function'&&typeof limiteBtn!=='undefined'?icone('ia-adversaires','🤖','Adversaires menés par l’IA'):null;
const triaBoutonHeros=triaBouton?icone('ia-aventuriers','👥','Aventuriers menés par l’IA'):null;
if(triaBouton){limiteBtn.after(triaBouton);triaBouton.after(triaBoutonHeros);texteBouton(triaBouton);texteBouton(triaBoutonHeros);triaBoutonHeros.hidden=true;
 BOUTONS_CARTE['ia-adversaires']=()=>['Adversaires menés par l’IA',iaTour?'Quand les aventuriers n’ont plus de PA, les adversaires jouent seuls, puis le tour suivant part de lui-même ; un clic te les rend.':'Dans un combat lancé à la main : quand les aventuriers n’ont plus de PA, les adversaires jouent seuls, puis le tour suivant part de lui-même.'];
 BOUTONS_CARTE['ia-aventuriers']=()=>['Aventuriers menés par l’IA',triaHeros?'L’IA mène les aventuriers, sauf celui que tu as sélectionné ; un clic te les rend tous.':'L’IA mène aussi les aventuriers, sauf celui que tu as sélectionné.'];
 triaBouton.onclick=()=>{iaTour=!iaTour;triaEcrit(TRIA_CLE,iaTour);if(typeof refreshGmBar==='function')refreshGmBar();render()};
 triaBoutonHeros.onclick=()=>{triaHeros=!triaHeros;triaEcrit(TRIA_CLE_HEROS,triaHeros);triaAttente.clear();triaFinis.clear();render()}}
/* Le départ, pour ce combat-ci : le MJ lance le combat à la main (« ⚔ Début du combat »), ou, si le combat est parti tout
   seul, il clique « Débuter le combat » — qui reste donc affiché, l'option allumée, tant que l'IA n'est pas partie. */
{const b=document.getElementById('debuter-combat'),lance=document.getElementById('start-combat');
 const depart=()=>{if(view==='mj'&&enCombat()){triaCombat=numeroCombat;triaFait='';triaBoude.clear();triaAttente.clear();triaFinis.clear();render()}};
 // Posés après les gestes de la table : au clic, le combat a déjà commencé et porte son numéro.
 if(b)b.addEventListener('click',depart);if(lance)lance.addEventListener('click',depart);
 let menage=false;
 const rendu=render;render=function(...x){
  // Une fois : les heures de recharge laissées par le temps réel retiré s'effacent des fiches.
  if(!menage&&typeof actors!=='undefined'&&actors.length){menage=true;actors.forEach(a=>{if(a){delete a.recharges;delete a.rechargesM}})}
  const o=rendu.apply(this,x);
  if(!enCombat())triaCombat=null;
  // Ce que le MJ a en main : sa sélection, lue hors des gestes de l'IA.
  if(!triaOccupe)triaMain=actors[selected]?actors[selected].id:null;
  if(triaBouton){triaBouton.classList.toggle('on',iaTour);triaBoutonHeros.hidden=!iaTour;triaBoutonHeros.classList.toggle('on',triaHeros)}
  if(b&&view==='mj'&&enCombat()&&iaTour&&triaCombat!==numeroCombat)b.hidden=false;return o}}
/* Pourquoi l'IA tourne ou non, condition par condition : etatIA() dans la console du navigateur. Rien à l'écran. */
window.etatIA=()=>({tourne:triaTourne(),option:iaTour,enCombat:enCombat(),vueMJ:view==='mj',mjDeLaTable:!(typeof enLigne!=='undefined'&&enLigne&&typeof estMJ==='function'&&!estMJ()),
 combatLanceALaMain:triaCombat!==null&&triaCombat===numeroCombat,surLaTable:![...document.body.classList].some(c=>c.startsWith('page-')),libre:triaLibre(),fenetreOuverte:triaFenetre(),
 tour:triaCleTour(),adversairesOntJoue:triaFait===triaCleTour(),aventuriersFinis:triaHerosFinis(),enCours:triaOccupe,
 adversaires:triaAdversaires().map(a=>a.name),aventuriersIA:triaHeros,enMain:(actors.find(a=>a.id===triaMain)||{}).name||null,aventuriers:triaAventuriers().map(a=>a.name)});
