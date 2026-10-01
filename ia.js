/* ---------- Les adversaires IA — mis de côté ----------
   Ce fichier n'est chargé par aucune page : l'IA ne tourne pas et ne touche à rien. Il garde tout ce qui
   a été écrit en v0.492, pour reprendre plus tard. Pour la recâbler, il faudra :
   - charger ce fichier dans index.html après live.js ;
   - les variables : iaAdversaires, iaEnCours, iaTourJoue, iaPlanifie, iaArret ;
   - le bouton « 🤖 Adversaires IA » (#ia-adversaires) sous « Tour suivant », son état dans renderCombat,
     et planifieTourIA() à la fin de renderCombat ;
   - iaTourJoue=0 dans basculerMode et remiseAuTourUn ;
   - dans frappe : b.frappePar={de:a.id,tour:round} quand des PV partent, et reactionsIA() quand Revanche
     ou Traction s'arment ;
   - $('next').onclick : si iaDoitJouer(), tourDesAdversaires() au lieu de tourSuivant() ;
   - la partie : « ia » dans snapshot() et appliquerSauvegarde() ;
   - les fiches : les trois menus Ciblage, Comportement, Survie dans le formulaire d'adversaire
     (ia_cible, ia_conduite, ia_survie), leur lecture dans readActor, normaliseIa dans normalizeActor,
     cleanMonster, fromMonster et toMonster, et les trois colonnes de l'éditeur en masse à la place de
     « Menace ». */
'use strict';
/* ---------- L'IA des adversaires ----------
   Trois champs sur un adversaire (« ia ») : qui il vise, comment il se conduit, quand il fuit. Le moteur
   ne tient que les clés et les choix purs ; la table (index.html) joue le tour avec ses propres gestes.
   L'ancienne « menace » du bestiaire se relit comme ciblage. */
const IA_CIBLAGES=[['proche','Le plus proche'],['loin','Le plus loin'],['pvBas','PV les plus bas'],['pvHaut','PV les plus hauts'],['fort','Le plus fort'],['faible','Le plus faible'],['defBas','DEF la plus basse']];
const IA_CONDUITES=[['agressif','Agressif'],['protecteur','Protecteur'],['furtif','Furtif']];
const IA_SURVIES=[['kamikaze','Kamikaze'],['fuit25','Fuit sous 25 % de PV'],['fuit50','Fuit sous 50 % de PV']];
const IA_DEFAUT={cible:'proche',conduite:'agressif',survie:'kamikaze'};
const MENACE_VERS_CIBLAGE={closest:'proche',pvLow:'pvBas',pvHigh:'pvHaut',defLow:'defBas'};
function iaDe(a){const o=a&&a.ia&&typeof a.ia==='object'?a.ia:{},dans=(l,v)=>l.some(([k])=>k===v);
 return {cible:dans(IA_CIBLAGES,o.cible)?o.cible:MENACE_VERS_CIBLAGE[a&&a.menace]||IA_DEFAUT.cible,
  conduite:dans(IA_CONDUITES,o.conduite)?o.conduite:IA_DEFAUT.conduite,survie:dans(IA_SURVIES,o.survie)?o.survie:IA_DEFAUT.survie}}
// Ce qui se garde sur la fiche : rien quand tout est au défaut.
function normaliseIa(a){const ia=iaDe(a);return Object.keys(IA_DEFAUT).every(k=>ia[k]===IA_DEFAUT[k])?null:ia}
// Le seuil de fuite, en part des PV max ; zéro pour qui se bat jusqu'au bout.
function seuilFuite(survie){return survie==='fuit25'?.25:survie==='fuit50'?.5:0}
/* L'ordre d'activation : les sbires, puis les Élites, les Solitaires, les Boss ; avant tous, ceux dont un
   talent sert les autres — meneur, gardien, rempart, garde rapprochée, provocation, invocation — pour
   qu'ils soient en place. « clesDe » : les clés d'effet des talents tenus par un combattant. */
const TALENTS_SOUTIEN_IA=['meneur','gardien','rempart','garderapprochee','provocation','invocation'];
function ordreIA(liste,clesDe){const soutien=a=>(clesDe?clesDe(a):[]).some(k=>TALENTS_SOUTIEN_IA.includes(k))?0:1;
 return (liste||[]).map((a,i)=>[a,i]).sort((u,v)=>soutien(u[0])-soutien(v[0])||rangType(u[0])-rangType(v[0])||u[1]-v[1]).map(([a])=>a)}
/* La cible, selon le ciblage, parmi des candidats {a, dist, def} : la distance en pixels et la DEF, déjà
   mesurées par la table. Le plus fort : le niveau le plus haut, puis le plus de PV max. À égalité, le plus
   proche ; puis l'ordre donné. */
function choixCibleIA(cle,candidats){const l=(candidats||[]).filter(c=>c&&c.a);if(!l.length)return null;
 const niveau=c=>Math.max(1,Math.trunc(Number(c.a.level))||1),max=c=>Number(c.a.max)||0,hp=c=>Number(c.a.hp)||0,def=c=>Number(c.def!==undefined?c.def:c.a.def)||0;
 const cmp={proche:(x,y)=>x.dist-y.dist,loin:(x,y)=>y.dist-x.dist,pvBas:(x,y)=>hp(x)-hp(y),pvHaut:(x,y)=>hp(y)-hp(x),
  fort:(x,y)=>niveau(y)-niveau(x)||max(y)-max(x),faible:(x,y)=>niveau(x)-niveau(y)||max(x)-max(y),defBas:(x,y)=>def(x)-def(y)}[cle]||((x,y)=>x.dist-y.dist);
 return l.map((c,i)=>[c,i]).sort((u,v)=>cmp(u[0],v[0])||u[0].dist-v[0].dist||u[1]-v[1])[0][0].a}

/* ---------- Les adversaires IA ----------
   Un mode, au MJ : les adversaires révélés jouent seuls leur tour, dès que le dernier aventurier debout a
   dépensé sa dernière Action — ou quand le MJ demande le tour suivant. Chacun lit ses trois champs,
   ciblage, conduite, survie, et n'use que des gestes de la table : se dégeler, se relever, approcher,
   attaquer, reculer, fuir, lancer ses orbes. Mêmes refus, mêmes coûts, mêmes dégâts d'opportunité qu'un
   adversaire mené à la main. L'IA ne tourne que dans le navigateur du MJ ; la table reçoit ses gestes. */
const iaActif=()=>view==='mj'&&iaAdversaires&&enCombat()&&!(typeof loading!=='undefined'&&loading)&&!(typeof spectateur==='function'&&spectateur());
function adversairesIA(){return actors.filter(a=>!a.hero&&a.vu&&alive(a)&&!a.horsCarte)}
function herosDebout(){return actors.filter(a=>a.hero&&alive(a)&&!a.horsCarte)}
// Les aventuriers ont fini : plus un point d'Action chez ceux qui tiennent debout.
function aventuriersFinis(){const h=herosDebout();return h.length>0&&h.every(o=>pointsRestants(o,'action')<=0)}
function iaDoitJouer(){return iaActif()&&!iaEnCours&&iaTourJoue!==round&&adversairesIA().length>0}
// Le tour des adversaires se prépare à chaque rendu, et part une fois le dernier coup lu.
function planifieTourIA(){if(iaPlanifie||!iaDoitJouer()||!aventuriersFinis())return;
 iaPlanifie=setTimeout(()=>{iaPlanifie=0;if(iaDoitJouer()&&aventuriersFinis())tourDesAdversaires()},900)}
const pauseIA=ms=>new Promise(r=>setTimeout(r,ms));
async function tourDesAdversaires(){if(!iaDoitJouer())return;iaEnCours=true;iaArret=false;iaTourJoue=round;
 const avant=selected,tour=round;log('Tour des adversaires.',{ton:'reveal'});annonceFlottante('Tour des adversaires');render();
 try{const vus=new Set();
  for(;;){if(iaArret||!iaActif()||round!==tour)break;
   const a=ordreIA(adversairesIA().filter(x=>!vus.has(x.id)),x=>talentsCodes(x).map(t=>t.code.cle))[0];if(!a)break;vus.add(a.id);
   try{await activationIA(a)}catch(e){log(nomNum(a)+' · IA : '+e.message,{local:true})}
   await pauseIA(500)}}
 finally{iaEnCours=false;selected=avant!==null&&avant!==undefined&&actors[avant]?avant:null;markOnly(selected===null?-1:selected);render();scheduleSave()}
 // Puis le tour suivant, de lui-même, le temps de lire le dernier coup.
 if(!iaArret&&iaActif()&&round===tour)setTimeout(()=>{if(iaActif()&&round===tour&&!iaEnCours)tourSuivant()},1000)}
/* L'activation d'un adversaire : gelé, il se dégèle ; au sol, il se relève ; sous son seuil, il fuit, sauf
   acculé ; ses orbes partent ; puis sa conduite mène le reste. */
async function activationIA(a){const i=actors.indexOf(a);if(i<0||!alive(a))return;
 selected=i;markOnly(i);render();await pauseIA(300);
 const ia=iaDe(a);
 if(hasState(a,'Gel')){depensePoint(a,'action');rendPoint(a,'mouvement');setState(a,'Gel',false);log(nomNum(a)+' se dégèle : Action dépensée, Mouvement rendu.',{ton:'etat'});render()}
 if(hasState(a,'Au sol')){depensePoint(a,'mouvement');setState(a,'Au sol',false);log(nomNum(a)+' se relève : Mouvement dépensé, Action encore disponible.',{ton:'etat'});render()}
 const seuil=seuilFuite(ia.survie);
 if(seuil>0&&a.hp<=a.max*seuil&&await fuiteIA(a))return;
 await orbesIA(a);
 let j=cibleIA(a,ia.cible);if(j===null)return;
 if(ia.conduite==='protecteur')await conduiteProtecteur(a,j);else if(ia.conduite==='furtif')await conduiteFurtif(a,j);else await conduiteAgressif(a,j);
 // La cible tombée, ce qui reste d'Action va à qui est encore à portée, sans bouger.
 for(let n=0;n<3&&alive(a)&&pointsRestants(a,'action')>0&&!(actors[j]&&alive(actors[j]));n++){const k=cibleIA(a,'proche');if(k===null||k===j)break;j=k;
  if(!(await attaquesIA(a,k)))break}}
/* Les aventuriers qu'il peut atteindre : au contact, en vue pour un tir, ou au bout d'un chemin ; à défaut
   tous ceux qui tiennent debout. Un invisible n'est pas une cible. */
function cibleIA(a,cle){const size=mapSize(),px=o=>[o.x/100*size.width,o.y/100*size.height],[ax,ay]=px(a);
 const tous=herosDebout().filter(h=>!hasState(h,'Invisible')).map(h=>{const k=actors.indexOf(h),[x,y]=px(h);
  return {a:h,dist:Math.hypot(x-ax,y-ay),def:defOf(h),ok:reachTo(a,h,k,'contact').ok||(aDistanceIA(a)&&!blinded(a)&&reachTo(a,h,k,'distance').ok)||!!(size.width&&cheminVersContact(a,h,size))}});
 if(!tous.length)return null;const ok=tous.filter(c=>c.ok),choisi=choixCibleIA(cle,ok.length?ok:tous);
 return choisi?actors.indexOf(choisi):null}
function aDistanceIA(a){return attackChoices(a,items()).some(at=>(at.range||'contact')==='distance')}
/* L'attaque qui porte sur la cible : au contact, une attaque de contact d'abord ; sinon celle qui l'atteint.
   Elle devient l'attaque en main, comme si le MJ l'avait choisie. */
function choisirAttaqueIA(a,j){const b=actors[j],liste=attackChoices(a,items());if(!b||!liste.length)return null;
 const contact=reachTo(a,b,j,'contact').ok,vue=!blinded(a)&&reachTo(a,b,j,'distance').ok;
 const porte=at=>(at.range||'contact')==='contact'?contact:vue;
 let k=contact?liste.findIndex(at=>(at.range||'contact')==='contact'&&porte(at)):-1;
 if(k<0)k=liste.findIndex(porte);if(k<0)return null;a.activeAttack=k;return liste[k]}
// Un coup, attendu jusqu'à ce que ses dégâts tombent ; au plus tard trois secondes et demie.
function attaqueIA(j){return new Promise(res=>{let fini=false;const fin=()=>{if(!fini){fini=true;res()}};
 try{attack({vises:[j],apres:fin})}catch(e){log('IA : '+e.message,{local:true});fin()}
 setTimeout(fin,3500)})}
// Toutes ses Actions sur la cible, tant qu'elle tient et qu'il la porte. Renvoie le nombre de coups partis.
async function attaquesIA(a,j){let coups=0;
 while(alive(a)&&actors[j]&&alive(actors[j])&&pointsRestants(a,'action')>0&&coups<6){
  const at=choisirAttaqueIA(a,j);if(!at||refusAttaque(a,at))break;
  const avant=pointsRestants(a,'action');await attaqueIA(j);
  if(pointsRestants(a,'action')>=avant)break;coups++;await pauseIA(450)}
 return coups}
// Ses orbes, gratuits, comme au bouton.
async function orbesIA(a){for(let n=0;n<9;n++){const b=boutonsTalents(a).find(x=>x.code.cle==='orbes');if(!b||!b.peut)return;b.agir();await pauseIA(500)}}
/* Un déplacement de l'IA : le long d'étapes en pixels, pas à pas, sous la règle du Mouvement — une zone
   franchie se paie, sans point pour la suivante le socle reste au bord ; sans zones, le geste coûte un
   point, comme à la main. Ceux qu'il quitte frappent, la Foudre tombe, Lamevent s'arme. */
async function marcheIA(a,etapes,ignorer,arrive){const size=mapSize();if(!size.width||!etapes||!etapes.length)return false;
 const regle=regleMouvement(a);if(regle.fini)return false;
 noteContactsDepart(a);const croises=new Set(contactsDe(a)),depart={x:a.x,y:a.y};
 for(const [x,y] of etapes){if(arrive&&arrive())break;
  moveActor(a,x/size.width*100,y/size.height*100,false,ignorer,true);
  if(!appliqueRegleMouvement(a,regle))break}
 settleActor(a,ignorer);
 if(Math.hypot((a.x-depart.x)/100*size.width,(a.y-depart.y)/100*size.height)<1){a.x=depart.x;a.y=depart.y;return false}
 const cout=soldeRegleMouvement(a,regle);if(regle.zonee){if(cout>0)depensePoint(a,'mouvement',cout)}else depensePoint(a,'mouvement');
 ramasseContacts(a,croises,depart,size,walls());a.lameventPret=round;
 const el=document.querySelector('#map-view .token[data-id="'+CSS.escape(a.id)+'"]');
 if(el){el.classList.add('glisse');el.style.left=a.x+'%';el.style.top=a.y+'%';suitLaJauge(el)}
 await pauseIA(280);
 updateRing();degatsOpportunite(a,[...croises]);afterMove(a);render();return true}
/* Où un geste le mènerait, murs, socles et zones compris, sans rien bouger : le point d'arrivée, ou null
   si le geste est refusé. */
function essaiPasIA(a,x,y,ignorer){const size=mapSize(),regle=regleMouvement(a);if(regle.fini)return null;
 const e={...a};moveActor(e,x/size.width*100,y/size.height*100,false,ignorer,true);
 return appliqueRegleMouvement(e,regle)?{x:e.x,y:e.y}:null}
// Jusqu'au contact de la cible : le chemin qui contourne murs et socles adverses, le dernier pas au bord de son socle.
async function approcheIA(a,j){const b=actors[j],size=mapSize();if(!b||!size.width)return false;
 if(reachTo(a,b,j,'contact').ok)return false;
 const px=o=>[o.x/100*size.width,o.y/100*size.height],[bx,by]=px(b),arret=tokenOf(a)/2+tokenOf(b)/2+1;
 const etapes=(cheminVersContact(a,b,size)||[]).slice(1);
 const auBord=([x,y])=>{const dx=x-bx,dy=y-by,n=Math.hypot(dx,dy)||1;return [bx+dx/n*arret,by+dy/n*arret]};
 etapes.push(auBord(etapes.length?etapes[etapes.length-1]:px(a)));
 return marcheIA(a,etapes,new Set([a.id,b.id]),()=>reachTo(a,b,j,'contact').ok)}
/* Se dégager : le point le plus proche hors de toute zone de contact adverse — la cible en vue s'il en a
   une —, d'un seul geste. Ceux qu'il quitte frappent. */
async function reculIA(a,j){const size=mapSize();if(!size.width||!contactsDe(a).length)return false;
 const ax=a.x/100*size.width,ay=a.y/100*size.height,t=tokenOf(a),ignorer=new Set([a.id]),x0=a.x,y0=a.y;let mieux=null;
 for(const r of [t*2,t*3,t*4.5,t*6])for(let k=0;k<16;k++){const ang=k/16*Math.PI*2,p=essaiPasIA(a,ax+Math.cos(ang)*r,ay+Math.sin(ang)*r,ignorer);if(!p)continue;
  a.x=p.x;a.y=p.y;const libre=!contactsDe(a).length&&(j===null||j===undefined||!actors[j]||reachTo(a,actors[j],j,'distance').ok);a.x=x0;a.y=y0;if(!libre)continue;
  const d=Math.hypot(p.x/100*size.width-ax,p.y/100*size.height-ay);if(d>=1&&(!mieux||d<mieux.d))mieux={x:p.x,y:p.y,d}}
 if(!mieux)return false;
 return marcheIA(a,[[mieux.x/100*size.width,mieux.y/100*size.height]],ignorer,null)}
/* Fuir : le point qui l'éloigne le plus du plus proche aventurier, d'un seul geste. Sans un pas qui
   l'éloigne vraiment, il est acculé : il se bat. */
async function fuiteIA(a){const size=mapSize();if(!size.width)return false;const heros=herosDebout();if(!heros.length)return false;
 const px=o=>[o.x/100*size.width,o.y/100*size.height],[ax,ay]=px(a),t=tokenOf(a),ignorer=new Set([a.id]);
 const proche=(x,y)=>Math.min(...heros.map(h=>{const [u,v]=px(h);return Math.hypot(u-x,v-y)}));
 const depart=proche(ax,ay);let mieux=null;
 for(const r of [t*3,t*6,t*10,t*16])for(let k=0;k<16;k++){const ang=k/16*Math.PI*2,p=essaiPasIA(a,ax+Math.cos(ang)*r,ay+Math.sin(ang)*r,ignorer);if(!p)continue;
  const [x,y]=px(p),d=proche(x,y);if(!mieux||d>mieux.d)mieux={x:p.x,y:p.y,d}}
 if(!mieux||mieux.d<=depart+t*.5)return false;
 const ok=await marcheIA(a,[[mieux.x/100*size.width,mieux.y/100*size.height]],ignorer,null);
 if(ok)log(nomNum(a)+' fuit.',{ton:'reveal'});return ok}
// Agressif : une attaque à distance, la cible en vue et personne au contact, il tire d'où il est ; sinon il la rejoint.
async function conduiteAgressif(a,j){const b=actors[j];
 const tire=aDistanceIA(a)&&!blinded(a)&&reachTo(a,b,j,'distance').ok&&!contactsDe(a).length;
 if(!tire)await approcheIA(a,j);
 await attaquesIA(a,j)}
/* Furtif : avec une attaque à distance, il se dégage du contact puis tire ; sans, il frappe puis recule avec le
   Mouvement qui lui reste. */
async function conduiteFurtif(a,j){
 if(aDistanceIA(a)&&!blinded(a)){if(contactsDe(a).length)await reculIA(a,j);await attaquesIA(a,j)}
 else{await approcheIA(a,j);await attaquesIA(a,j);if(alive(a)&&contactsDe(a).length)await reculIA(a,null)}}
/* Protecteur : l'allié à protéger, du plus haut rang puis le plus de PV max ; il le rejoint et reste à son
   contact. Il frappe en priorité qui a touché ce protégé ce tour, sinon sa cible, s'ils sont à portée. Sans
   personne à protéger, il se conduit en agressif. */
function protegeIA(a){return actors.filter(o=>o!==a&&!o.hero&&alive(o)&&!o.horsCarte)
 .sort((u,v)=>rangType(v)-rangType(u)||(Number(v.max)||0)-(Number(u.max)||0))[0]||null}
async function conduiteProtecteur(a,j){const p=protegeIA(a);if(!p)return conduiteAgressif(a,j);
 const k=actors.indexOf(p),f=p.frappePar&&p.frappePar.tour===round?actors.findIndex(x=>x.id===p.frappePar.de):-1;
 const cible=f>=0&&actors[f].hero&&alive(actors[f])?f:j;
 if(!reachTo(a,p,k,'contact').ok)await approcheIA(a,k);
 if(!(await attaquesIA(a,cible))&&pointsRestants(a,'action')>0){const autre=cibleIA(a,'proche');if(autre!==null&&autre!==cible)await attaquesIA(a,autre)}}
/* En mode IA, un adversaire joue sa réaction dès qu'elle s'arme : Revanche sur l'échec d'un aventurier,
   Traction sur le tir qui l'a blessé. Un Mouvement gratuit, comme au bouton. */
function reactionsIA(){if(!iaActif())return;
 actors.forEach(o=>{if(o.hero||!alive(o)||o.horsCarte)return;['revanche','traction'].forEach(cle=>{const r=o[cle];if(!r||r.tour!==round||r.ia)return;
  const t=talentsCodes(o).find(x=>x.code.cle===cle);if(!t)return;r.ia=true;
  setTimeout(()=>{if(!iaActif()||!alive(o)||!o[cle])return;const dit=TALENTS_EFFETS[cle].fn(o,t.params,t.talent);if(dit)log(dit,{ton:'talent'});render();scheduleSave()},450)})})};
