/* ---------- v1.144 : les gemmes gagnées en jouant ----------
   Chaque aventurier a sa bourse de gemmes, qui ne se partage pas : ce sont ses actions qui la remplissent. Quand il réussit une
   action liée à une couleur — un déclencheur —, il lance un dé de gemme : chaque face donne tant de Brisures de la couleur (le MJ
   règle la table, couleur par couleur) ; un critique fait lancer plusieurs dés. En combat, au plus tant de Brisures de chaque
   couleur par combat ; hors combat, chaque déclencheur ne joue qu'une fois par zone de la carte. Un boss vaincu vaut à chacun un
   Éclat de la couleur qu'il a le plus déclenchée. Tout se règle dans l'onglet Gemmes du MJ (catalog.gemmesRegles) ; le dé part
   de lui-même après chaque action que l'appli voit, et le MJ lance les autres à la main depuis la fiche. */
const COULEURS_GEMMES=VARIETES_GEMMES.map(([k])=>k);
const NOM_COULEUR_GEMME=Object.fromEntries(VARIETES_GEMMES);
/* Les déclencheurs que le moteur connaît. « auto » : l'appli le voit et lance le dé elle-même ; sinon, le MJ le lance à la main.
   « competence » : la couleur de la compétence testée, celle du tableau des gemmes des bonus ; « etat » : celle de l'état posé (v1.154). */
const DECLENCHEURS_GEMMES=[
 {cle:'critique',nom:'Faire un critique',phase:'combat',couleur:'rubis',auto:true,note:'Un critique à l’attaque ou à l’orbe.'},
 {cle:'tuer',nom:'Tuer un adversaire',phase:'combat',couleur:'rubis',auto:true,note:'Le coup ou l’orbe qui met un adversaire à 0 PV.'},
 {cle:'frapper-non-vu',nom:'Frapper un adversaire qui ne vous voit pas',phase:'combat',couleur:'rubis',auto:true,note:'Cible Surprise, Aveugle ou endormie, ou attaquant Invisible ou Caché.'},
 {cle:'soigner-allie',nom:'Soigner un allié',phase:'combat',couleur:'emeraude',auto:true,note:'Un talent, une potion ou un objet qui rend des PV à un autre.'},
 {cle:'encaisser-debout',nom:'Encaisser un coup sans tomber',phase:'combat',couleur:'emeraude',auto:true,note:'Un coup adverse qui blesse sans mettre à 0 PV.'},
 {cle:'degager-sans-do',nom:'Se dégager du contact sans Dégâts d’Opportunité',phase:'combat',couleur:'emeraude',auto:true,note:'Quitter un adversaire au contact sans rien perdre.'},
 {cle:'toucher-distance',nom:'Toucher une cible à distance',phase:'combat',couleur:'citrine',auto:true,note:'Une attaque à distance qui passe la DEF.'},
 {cle:'utiliser-objet',nom:'Utiliser un objet, un piège ou une invention',phase:'combat',couleur:'citrine',auto:true,note:'Un objet employé, ou une invention qui touche.'},
 {cle:'reperer-cache',nom:'Repérer un adversaire caché',phase:'combat',couleur:'citrine',auto:true,note:'Un test de Perception en combat qui révèle un adversaire.'},
 {cle:'sort-touche',nom:'Lancer un sort ou un talent mystique qui touche',phase:'combat',couleur:'saphir',auto:true,note:'Un orbe qui passe la DEF.'},
 {cle:'etat-elementaire',nom:'Infliger un état',phase:'combat',couleur:'etat',auto:true,note:'Feu, Gel, Poison… posé sur un adversaire ; la couleur est celle de l’état (tableau des couleurs).'},
 {cle:'reveler-faiblesse',nom:'Révéler une faiblesse',phase:'combat',couleur:'saphir',auto:true,note:'Une Analyse qui apprend quelque chose.'},
 {cle:'def-tient',nom:'Une attaque adverse ne passe pas votre DEF',phase:'combat',couleur:'diamant',auto:true,note:'Les dés adverses tous arrêtés par la DEF.'},
 {cle:'proteger-allie',nom:'Protéger un allié à sa place',phase:'combat',couleur:'diamant',auto:true,note:'Gardien, Rempart ou Garde rapprochée qui prend le coup.'},
 {cle:'combat-sans-coma',nom:'Finir un combat sans être tombé dans le coma',phase:'combat',couleur:'diamant',auto:true,note:'À la fin du combat, pour chaque aventurier debout de bout en bout.'},
 {cle:'larcin',nom:'Voler (Larcin)',phase:'hors',couleur:'rubis',auto:true,note:'Un Larcin qui rapporte de l’or.'},
 {cle:'intimider',nom:'Intimider',phase:'hors',couleur:'rubis',auto:false},
 {cle:'test-competence',nom:'Réussir un test de compétence',phase:'hors',couleur:'competence',auto:true,note:'Un test hors combat avec au moins une réussite ; la couleur est celle de la compétence (tableau des gemmes des bonus).'},
 {cle:'escalader',nom:'Escalader, sauter, nager',phase:'hors',couleur:'emeraude',auto:false},
 {cle:'longue-marche',nom:'Tenir une longue marche',phase:'hors',couleur:'emeraude',auto:false},
 {cle:'fouiller',nom:'Fouiller',phase:'hors',couleur:'citrine',auto:true,note:'Une fouille avec au moins une réussite.'},
 {cle:'crocheter',nom:'Crocheter',phase:'hors',couleur:'citrine',auto:true,note:'Une serrure ou un coffre déverrouillé.'},
 {cle:'desamorcer',nom:'Désamorcer',phase:'hors',couleur:'citrine',auto:true,note:'Un piège de coffre trouvé et désamorcé.'},
 {cle:'reparer',nom:'Réparer',phase:'hors',couleur:'citrine',auto:false},
 {cle:'secret',nom:'Trouver un secret',phase:'hors',couleur:'citrine',auto:true,note:'Un indice de la carte percé.'},
 {cle:'lire-grimoire',nom:'Lire un grimoire',phase:'hors',couleur:'saphir',auto:false},
 {cle:'identifier',nom:'Identifier un objet magique',phase:'hors',couleur:'saphir',auto:false},
 {cle:'negocier',nom:'Négocier',phase:'hors',couleur:'rubis',auto:false}];
const FACES_GEMMES_DEFAUT={citrine:[0,0,0,0,1,2],emeraude:[0,0,0,0,1,2],saphir:[0,0,0,0,1,2],rubis:[0,0,0,0,1,2],diamant:[0,0,0,0,0,1]};
const declencheurGemme=cle=>DECLENCHEURS_GEMMES.find(d=>d.cle===cle)||null;
const nbEntier=(v,lo,hi,d)=>{const n=Math.trunc(Number(v));return Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):d};
// Les règles telles que le catalogue les porte, complétées de ce qui manque ; rien d'autre n'y passe.
function normaliseReglesGemmes(g){g=g&&typeof g==='object'&&!Array.isArray(g)?g:{};const out={faces:{},critique:nbEntier(g.critique,1,6,2),plafond:nbEntier(g.plafond,0,99,3),
 boss:{taille:['brisure','eclat','brome'].includes(g.boss&&g.boss.taille)?g.boss.taille:'eclat',n:nbEntier(g.boss&&g.boss.n,0,20,1)},
 fusion:{eclat:nbEntier(g.fusion&&g.fusion.eclat,1,99,5),brome:nbEntier(g.fusion&&g.fusion.brome,1,99,5)},declencheurs:{}};
 COULEURS_GEMMES.forEach(c=>{const l=Array.isArray(g.faces&&g.faces[c])?g.faces[c]:FACES_GEMMES_DEFAUT[c];out.faces[c]=[0,1,2,3,4,5].map(i=>nbEntier(l[i],0,9,FACES_GEMMES_DEFAUT[c][i]))});
 DECLENCHEURS_GEMMES.forEach(d=>{const x=g.declencheurs&&g.declencheurs[d.cle]||{};
  out.declencheurs[d.cle]={couleur:COULEURS_GEMMES.includes(x.couleur)||x.couleur==='competence'||x.couleur==='etat'?x.couleur:d.couleur,des:nbEntier(x.des,1,6,1),actif:x.actif!==false}});
 return out}
function reglesGemmes(){return normaliseReglesGemmes(typeof catalog!=='undefined'&&catalog?catalog.gemmesRegles:null)}
function poseReglesGemmes(f){catalog.gemmesRegles=reglesGemmes();f(catalog.gemmesRegles);catalog.gemmesRegles=normaliseReglesGemmes(catalog.gemmesRegles);
 if(typeof scheduleSave==='function')scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
{const nc=normalizeCatalog;normalizeCatalog=function(c,...x){const r=nc(c,...x);if(c&&typeof c==='object'){if(c.gemmesRegles)c.gemmesRegles=normaliseReglesGemmes(c.gemmesRegles)}return r}}
/* Ce que l'appli suit pour un aventurier (a.gemmesSuivi, qui voyage avec lui) : le combat en cours et ses Brisures par couleur,
   ses déclencheurs par couleur, s'il est tombé dans le coma ; et, hors combat, les déclencheurs déjà joués par zone. */
function suiviGemmes(a){let s=a.gemmesSuivi;if(!s||typeof s!=='object')s=a.gemmesSuivi={};
 const n=typeof numeroCombat!=='undefined'?numeroCombat:0;
 if(s.combat!==n&&typeof enCombat==='function'&&enCombat()){s.combat=n;s.brisures={};s.decl={};delete s.coma}
 if(!s.brisures||typeof s.brisures!=='object')s.brisures={};if(!s.decl||typeof s.decl!=='object')s.decl={};if(!Array.isArray(s.scenes))s.scenes=[];return s}
// La zone de la carte où se tient l'aventurier : la scène des déclencheurs hors combat.
function cleSceneGemme(a){const m=typeof currentMap==='function'?currentMap():null,id=typeof currentMapId!=='undefined'?currentMapId||'':'';
 const z=m&&typeof zonesDe==='function'?zonesDe(m):null;return id+':'+(z&&typeof zoneAu==='function'?zoneAu(z,a.x,a.y):0)}
function couleurDeclencheur(cle,opts){const d=declencheurGemme(cle);if(!d)return null;const r=reglesGemmes().declencheurs[cle];
 if(r.couleur==='competence'){const k=Math.max(0,Math.min(7,Number(opts&&opts.comp)||0));return typeof varieteBonus==='function'?varieteBonus({carac:'comp',comp:String(k)}):'citrine'}
 if(r.couleur==='etat')return typeof varieteBonus==='function'?varieteBonus({carac:'etat',etat:opts&&opts.etat}):'rubis';
 return r.couleur}
// Un même déclencheur, pour un même aventurier, ne joue qu'une fois par geste : les crans d'un état, les dés d'un coup.
const gemmesCeGeste=new Set();
function deGemme(a,cle,opts={}){if(!a||!a.hero||typeof spectateur==='function'&&spectateur())return null;const d=declencheurGemme(cle);if(!d)return null;
 const R=reglesGemmes(),r=R.declencheurs[cle];if(!r.actif&&!opts.manuel)return null;
 const combat=opts.phase?opts.phase==='combat':typeof enCombat==='function'&&enCombat();
 if(!opts.manuel&&d.phase==='combat'&&!combat)return null;if(!opts.manuel&&d.phase==='hors'&&combat)return null;
 const k=cle+(opts.comp!==undefined?':'+opts.comp:'')+(opts.etat!==undefined?':'+opts.etat:'');if(gemmesCeGeste.has(a.id+'|'+k))return null;gemmesCeGeste.add(a.id+'|'+k);queueMicrotask(()=>gemmesCeGeste.delete(a.id+'|'+k));
 const couleur=couleurDeclencheur(cle,opts),s=suiviGemmes(a);if(!couleur)return null;
 s.decl[couleur]=(s.decl[couleur]||0)+1;
 if(!combat||d.phase==='hors'){const sc=cleSceneGemme(a)+'|'+k;if(s.scenes.includes(sc)&&!opts.manuel)return null;s.scenes=[...s.scenes.filter(x=>x!==sc),sc].slice(-80)}
 const des=Math.max(1,Math.min(12,(opts.des||r.des)*(opts.critique?R.critique:1)));
 const faces=Array.from({length:des},()=>typeof d6==='function'?d6():1+Math.floor(Math.random()*6));
 let gagne=faces.reduce((n,f)=>n+(R.faces[couleur][f-1]||0),0);
 // Le plafond du combat : ce qui dépasse ne tombe pas.
 if(combat&&d.phase==='combat'){const deja=s.brisures[couleur]||0;gagne=Math.max(0,Math.min(gagne,R.plafond-deja));s.brisures[couleur]=deja+gagne}
 if(gagne>0){const cg=cleGemme('brisure',couleur,false);a.richesses={...(a.richesses||{})};a.richesses[cg]=(Math.trunc(Number(a.richesses[cg]))||0)+gagne;
  flotteGemme(a,'brisure',couleur,gagne);
  if(typeof log==='function')log(nomNum(a)+' · Dé de gemme ('+d.nom+') ⦃'+faces.join(',')+'⦄ : +'+gagne+' '+nomGemme('brisure',couleur,false).toLowerCase().replace(/^brisures/, gagne>1?'Brisures':'Brisure')+'.',{ton:'talent'})}
 if(typeof scheduleSave==='function')scheduleSave();return {faces,gagne,couleur}}
// La petite sphère qui monte au-dessus du socle quand une Brisure tombe.
function flotteGemme(a,taille,variete,n){if(typeof floatNumber!=='function')return;const c=$('floaters'),avant=c?c.childElementCount:0;
 floatNumber(a,'+'+n,'gain');const el=c&&c.childElementCount>avant?c.lastElementChild:null;if(!el)return;
 const im=document.createElement('img');im.className='floater-gemme';im.src=imgUrl(iconeGemme(taille,variete)+'.png');im.alt=nomGemme(taille,variete,false);im.draggable=false;el.append(im)}
/* ---------- Ce que le moteur dit au dé de gemme ---------- */
let bossVaincuCombat=0,dernierInvisible=null;
// Un coup posé (index.html, frappe et orbe) : à l'attaquant, à la cible, ce que les faces ont dit.
function gemmesApresCoup(a,b,r,hpAvant,lost){if(!a||!b||!r||typeof enCombat!=='function'||!enCombat())return;
 const crit=!!(r.critical&&!r.failed),touche=!r.failed&&!!r.hit,opp={critique:crit};
 if(a.hero&&hostiles(a,b)){
  if(crit)deGemme(a,'critique',opp);
  if(b.hp===0&&hpAvant>0){deGemme(a,'tuer',opp);if(b.type==='boss')bossVaincuCombat=numeroCombat}
  if(touche&&!r.orbe){const inv=dernierInvisible&&dernierInvisible.id===a.id&&performance.now()-dernierInvisible.t<3000;
   if(inv||hasState(b,'Surpris')||hasState(b,'Aveugle')||hasState(b,'Sommeil')||hasState(a,'Invisible')||hasState(a,'Caché'))deGemme(a,'frapper-non-vu',opp);
   if(typeof rangeOf==='function'&&rangeOf(a)==='distance')deGemme(a,'toucher-distance',opp);
   if(typeof activeAttack==='function'&&activeAttack(a).invention===true)deGemme(a,'utiliser-objet',opp)}
  if(touche&&r.orbe)deGemme(a,'sort-touche',opp)}
 if(b.hero&&hostiles(a,b)){if(!r.failed&&!r.hit&&!r.orbe)deGemme(b,'def-tient');if(lost>0&&b.hp>0)deGemme(b,'encaisser-debout')}}
// Un coup partagé : ceux qui l'ont pris à la place de la cible.
function gemmesProtege(b,partage){if(!b||!partage||typeof enCombat!=='function'||!enCombat())return;
 const dits=[...(partage.gardien||[]),...(partage.rempart||[]),...(partage.garde||[])];if(!dits.length)return;
 actors.forEach(h=>{if(!h||!h.hero||h===b)return;const nom=nomNum(h);if(dits.some(d=>String(d).startsWith(nom))||h.garde===b.id||h.garde2===b.id&&(partage.gardien||[]).length)deGemme(h,'proteger-allie')})}
{const fi=finInvisible;finInvisible=function(a,...x){const etait=!!a&&(hasState(a,'Invisible')||hasState(a,'Caché'));const r=fi(a,...x);if(etait)dernierInvisible={id:a.id,t:performance.now()};return r}}
// Un soin qui va à un autre, en combat : au soigneur.
{const ah=applyHeal;applyHeal=function(o,...x){const g=ah(o,...x);if(g>0&&typeof enCombat==='function'&&enCombat()){const h=(typeof talentEnCours!=='undefined'&&talentEnCours&&talentEnCours.a)||actors[selected];
 if(h&&h.hero&&h!==o&&memeCamp(h,o))deGemme(h,'soigner-allie')}return g}}
// Un état élémentaire posé sur un autre, en combat : à qui l'a posé.
{const ie=infligeEtat;infligeEtat=function(o,etat,...x){const r=ie(o,etat,...x);
 // v1.154 : tout état posé sur un adversaire, à la couleur de l'état.
 if(r===true&&o&&!o.hero&&typeof enCombat==='function'&&enCombat()){const s=(typeof auteurCoup!=='undefined'&&auteurCoup)||(typeof talentEnCours!=='undefined'&&talentEnCours&&talentEnCours.a)||null;
  if(s&&s.hero&&s!==o)deGemme(s,'etat-elementaire',{etat})}return r}}
// Quitter le contact sans rien perdre.
{const dO=degatsOpportunite;degatsOpportunite=function(a,avant,...x){const hp=a&&a.hp,menace=typeof enCombat==='function'&&enCombat()&&a&&a.hero&&alive(a)&&(avant||[]).some(e=>peutFrapperOpportunite(e)&&hostiles(e,a));
 const r=dO(a,avant,...x);if(menace&&alive(a)&&a.hp===hp){const apres=new Set(contactsDe(a));if((avant||[]).some(e=>!apres.has(e)&&peutFrapperOpportunite(e)&&hostiles(e,a)))deGemme(a,'degager-sans-do')}return r}}
// Un objet employé en combat.
if(typeof appliquerObjet==='function'){const ao=appliquerObjet;appliquerObjet=function(a,...x){const r=ao(a,...x);if(a&&a.hero&&typeof enCombat==='function'&&enCombat())deGemme(a,'utiliser-objet');return r}}
if(typeof appliquerEffetObjet==='function'){const ae=appliquerEffetObjet;appliquerEffetObjet=function(a,...x){const r=ae(a,...x);if(a&&a.hero&&typeof enCombat==='function'&&enCombat())deGemme(a,'utiliser-objet');return r}}
// Une Analyse qui apprend quelque chose : le nombre de choses sues grandit.
{const an=analyse;analyse=function(i,...x){const a=actors[selected],o=actors[i],avant=o&&typeof connuDe==='function'?connuDe(o).size:0;const r=an(i,...x);
 if(a&&a.hero&&o&&typeof connuDe==='function'&&connuDe(o).size>avant)deGemme(a,'reveler-faiblesse');return r}}
/* Un test de compétence : hors combat, une réussite au moins déclenche la couleur de la compétence — la Fouille la sienne ; en
   combat, la Perception qui révèle un adversaire. Le jet se lit au passage. */
{const ts=testSkill;testSkill=function(i,fouille,...x){const a=actors[selected],caches=()=>actors.filter(o=>o&&!o.hero&&alive(o)&&(o.hidden||!o.vu)).length,avant=caches();
 let jet=null;const sr=skillRoll;skillRoll=function(...y){const j=sr(...y);jet=j;return j};let r;try{r=ts(i,fouille,...x)}finally{skillRoll=sr}
 if(jet&&a&&a.hero){if(typeof enCombat==='function'&&enCombat()){if(i===PERCEPTION_RANG&&caches()<avant)deGemme(a,'reperer-cache')}
  else if(jet.reussites>0){if(fouille)deGemme(a,'fouiller');else deGemme(a,'test-competence',{comp:i})}}
 return r}}
// Crocheter, désamorcer : ce qui s'ouvre.
{const cr=crocheter;crocheter=function(a,...x){const l=a&&typeof serruresAPortee==='function'?serruresAPortee(a):[],avant=l.map(s=>s.c?!!s.c.deverrouille:!!(s.d&&s.d.crochetee));const r=cr(a,...x);
 if(a&&a.hero&&l.some((s,k)=>!avant[k]&&(s.c?!!s.c.deverrouille:!!(s.d&&s.d.crochetee))))deGemme(a,'crocheter');return r}}
{const tc=testCoffre;testCoffre=function(a,c,quoi,...x){const v=!!(c&&c.deverrouille),p=!!(c&&c.desamorce);const r=tc(a,c,quoi,...x);
 if(a&&a.hero&&c){if(!v&&c.deverrouille)deGemme(a,'crocheter');if(!p&&c.desamorce)deGemme(a,'desamorcer')}return r}}
// Un Larcin qui rapporte : l'or qui arrive dans la minute.
let larcinGemme=null;
{const la=larcin;larcin=function(a,...x){if(a&&a.hero)larcinGemme={id:a.id,t:performance.now()};return la(a,...x)}}
{const ao=ajouteOr;ajouteOr=function(a,n,...x){const r=ao(a,n,...x);if(n>0&&a&&a.hero&&larcinGemme&&larcinGemme.id===a.id&&performance.now()-larcinGemme.t<60000){larcinGemme=null;deGemme(a,'larcin')}return r}}
// Un indice de la carte percé.
{const pi=perceIndice;perceIndice=function(...x){const r=pi(...x);const a=actors[selected];if(a&&a.hero)deGemme(a,'secret');return r}}
// Le coma se note le temps du combat.
{const ca=comaAventuriers;comaAventuriers=function(...x){const r=ca(...x);if(typeof enCombat==='function'&&enCombat())actors.forEach(a=>{if(a&&a.hero){const s=suiviGemmes(a);if(a.comaVie)s.coma=numeroCombat}});return r}}
/* La fin du combat : à chaque aventurier debout de bout en bout, son dé ; un boss vaincu vaut à chacun un Éclat (ou ce que le MJ
   a réglé) de la couleur qu'il a le plus déclenchée. */
{const bm=basculerMode;basculerMode=function(neuf,...x){const finit=mode==='combat'&&neuf!=='combat',spect=typeof spectateur==='function'&&spectateur(),n=numeroCombat;
 const r=bm(neuf,...x);if(!finit||spect)return r;const R=reglesGemmes(),presents=actors.filter(a=>a&&a.hero&&!a.horsCarte&&!estMort(a)&&!sortiDuCombat(a));
 presents.forEach(a=>{const s=suiviGemmes(a);if(s.combat===n&&s.coma!==n)deGemme(a,'combat-sans-coma',{phase:'combat'})});
 if(bossVaincuCombat===n&&R.boss.n>0){presents.forEach(a=>{const s=suiviGemmes(a),c=COULEURS_GEMMES.reduce((m,k)=>(s.decl[k]||0)>(s.decl[m]||0)?k:m,COULEURS_GEMMES[0]);if(!(s.decl[c]>0))return;
  const cg=cleGemme(R.boss.taille,c,false);a.richesses={...(a.richesses||{})};a.richesses[cg]=(Math.trunc(Number(a.richesses[cg]))||0)+R.boss.n;flotteGemme(a,R.boss.taille,c,R.boss.n);
  if(typeof log==='function')log(nomNum(a)+' · Boss vaincu : +'+R.boss.n+' '+nomGemme(R.boss.taille,c,false).toLowerCase()+'.',{ton:'talent'})});bossVaincuCombat=0}
 if(typeof scheduleSave==='function')scheduleSave();return r}}
/* ---------- Le dé à la main, par le MJ ---------- */
const deGemmeDialog=dialog('de-gemme','Dé de gemme','<form id="de-gemme-form"><div class="edit-grid"><label>Déclencheur<select name="decl" id="de-gemme-decl"></select></label>'
 +'<label>Dés<input name="des" type="number" min="1" max="12" value="1"></label><label>Compétence<select name="comp" id="de-gemme-comp"></select></label><label>État<select name="etat" id="de-gemme-etat"></select></label></div>'
 +'<p class="muted" id="de-gemme-dit"></p><div class="form-actions"><button class="primary">Lancer</button></div></form>');
let deGemmeActeur=null;
function ouvreDeGemme(a){if(view!=='mj'||!a||!a.hero)return;deGemmeActeur=a;const f=$('de-gemme-form'),sd=$('de-gemme-decl'),sc=$('de-gemme-comp'),se=$('de-gemme-etat');sd.replaceChildren();sc.replaceChildren();se.replaceChildren();ETATS_JEU.forEach(e=>se.add(new Option(e,e)));
 [['combat','En combat'],['hors','Hors combat']].forEach(([ph,nom])=>{const g=document.createElement('optgroup');g.label=nom;DECLENCHEURS_GEMMES.filter(d=>d.phase===ph).forEach(d=>g.append(new Option(d.nom+(d.auto?'':' (à la main)'),d.cle)));sd.append(g)});
 skillNames.forEach((n,k)=>sc.add(new Option(n,String(k))));f.des.value='1';
 const maj=()=>{const d=declencheurGemme(sd.value),r=reglesGemmes().declencheurs[sd.value];sc.closest('label').hidden=!(r&&r.couleur==='competence');se.closest('label').hidden=!(r&&r.couleur==='etat');
  const c=couleurDeclencheur(sd.value,{comp:sc.value,etat:se.value});$('de-gemme-dit').textContent=(d?d.nom:'')+' → '+(c?NOM_COULEUR_GEMME[c]:'')+(r&&!r.actif?' (déclencheur désactivé)':'')};
 sd.onchange=maj;sc.onchange=maj;se.onchange=maj;maj();
 f.onsubmit=e=>{e.preventDefault();const res=deGemme(deGemmeActeur,sd.value,{manuel:true,des:nbEntier(f.des.value,1,12,1),comp:sc.value,etat:se.value});deGemmeDialog.close();
  if(res&&!res.gagne&&typeof log==='function')log(nomNum(deGemmeActeur)+' · dé de gemme ⦃'+res.faces.join(',')+'⦄ : rien.',{ton:'talent',local:true});
  if(typeof render==='function')render();if(typeof renderHeroes==='function')renderHeroes()};
 deGemmeDialog.showModal()}
// Dans la fenêtre Richesses d'un aventurier (l'or de son inventaire, au MJ) : le bouton du dé.
{const orr=openRichesses;openRichesses=function(a,...x){const r=orr(a,...x);const f=$('richesses-form'),acts=f&&f.querySelector('.form-actions');
 if(acts&&!acts.querySelector('.de-gemme-bouton')){const b=document.createElement('button');b.type='button';b.className='de-gemme-bouton';b.textContent='🎲 Dé de gemme';b.onclick=()=>{richessesDialog.close();ouvreDeGemme(richessesActeur)};acts.prepend(b)}return r}}
/* ---------- L'onglet Gemmes du MJ ---------- */
const gemmesPage=document.createElement('main');gemmesPage.id='gemmes-page';
gemmesPage.innerHTML='<section class="cat-panel panel"><header class="cat-head"><h2>Gemmes</h2></header>'
 +'<p class="muted">Les gemmes se gagnent en jouant : chaque action réussie liée à une couleur fait lancer un dé de gemme. Ici se règlent la table du dé, les déclencheurs et leurs couleurs, le plafond par combat, la récompense d’un boss, les ratios de fusion et la couleur de chaque caractéristique et compétence.</p>'
 +'<div id="gemmes-regles"></div></section>';
document.querySelector('main.layout').after(gemmesPage);
function renderGemmes(){const boite=$('gemmes-regles');if(!boite)return;boite.replaceChildren();const R=reglesGemmes();
 const h=(t,sous)=>{const e=document.createElement('h3');e.className='gemmes-titre';e.textContent=t;boite.append(e);if(sous){const p=document.createElement('p');p.className='muted';p.textContent=sous;boite.append(p)}};
 const nombre=(v,lo,hi,f)=>{const i=document.createElement('input');i.type='number';i.min=lo;i.max=hi;i.value=v;i.onchange=()=>{poseReglesGemmes(g=>f(g,nbEntier(i.value,lo,hi,v)));renderGemmes()};return i};
 const icone=(taille,c)=>{const im=document.createElement('img');im.src=imgUrl(iconeGemme(taille,c)+'.png');im.alt='';im.className='gemmes-icone';return im};
 // 1. Le dé.
 h('Le dé de gemme','Pour chaque couleur, ce que donne chaque face du dé, en Brisures.');
 {const t=document.createElement('table');t.className='gemmes-table';const tr=document.createElement('tr');tr.append(document.createElement('th'));[1,2,3,4,5,6].forEach(f=>{const th=document.createElement('th');th.textContent='Face '+f;tr.append(th)});t.append(tr);
  COULEURS_GEMMES.forEach(c=>{const r=document.createElement('tr');const td=document.createElement('td');td.className='gemmes-couleur';td.append(icone('brisure',c),document.createTextNode(NOM_COULEUR_GEMME[c]));r.append(td);
   R.faces[c].forEach((v,i)=>{const cell=document.createElement('td');cell.append(nombre(v,0,9,(g,n)=>{g.faces[c][i]=n}));r.append(cell)});t.append(r)});boite.append(t)}
 {const l=document.createElement('div');l.className='gemmes-reglage';
  const li=(txt,el)=>{const lab=document.createElement('label');lab.append(txt,el);l.append(lab)};
  li('Dés sur un critique ',nombre(R.critique,1,6,(g,n)=>{g.critique=n}));li('Plafond de Brisures par couleur et par combat ',nombre(R.plafond,0,99,(g,n)=>{g.plafond=n}));
  const p=document.createElement('span');p.className='muted';p.textContent='Hors combat : chaque déclencheur joue une fois par zone de la carte.';l.append(p);boite.append(l)}
 // 2. Les déclencheurs.
 h('Les déclencheurs','Ce qui fait lancer le dé, et de quelle couleur. L’appli lance elle-même ceux qu’elle voit ; les autres, le MJ les lance depuis la fiche de l’aventurier (🎲 Dé de gemme).');
 [['combat','En combat'],['hors','Hors combat']].forEach(([ph,nom])=>{const t=document.createElement('table');t.className='gemmes-table gemmes-decl';const cap=document.createElement('caption');cap.textContent=nom;t.append(cap);
  const tr=document.createElement('tr');['Actif','Déclencheur','Couleur','Dés','Détection'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th)});t.append(tr);
  DECLENCHEURS_GEMMES.filter(d=>d.phase===ph).forEach(d=>{const r=R.declencheurs[d.cle],row=document.createElement('tr');if(!r.actif)row.classList.add('inactif');
   const c1=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.checked=r.actif;cb.onchange=()=>{poseReglesGemmes(g=>{g.declencheurs[d.cle].actif=cb.checked});renderGemmes()};c1.append(cb);
   const c2=document.createElement('td');c2.className='gemmes-nom';c2.textContent=d.nom;
   const c3=document.createElement('td');c3.className='gemmes-couleur';const s=document.createElement('select');COULEURS_GEMMES.forEach(c=>s.add(new Option(NOM_COULEUR_GEMME[c],c)));if(d.couleur==='competence'||d.cle==='test-competence')s.add(new Option('Compétence testée','competence'));if(d.couleur==='etat')s.add(new Option('Couleur de l’état','etat'));
   s.value=r.couleur;const im=icone('brisure',['competence','etat'].includes(r.couleur)?'citrine':r.couleur);if(['competence','etat'].includes(r.couleur))im.hidden=true;s.onchange=()=>{poseReglesGemmes(g=>{g.declencheurs[d.cle].couleur=s.value});renderGemmes()};c3.append(im,s);
   const c4=document.createElement('td');c4.append(nombre(r.des,1,6,(g,n)=>{g.declencheurs[d.cle].des=n}));
   const c5=document.createElement('td');c5.className='muted gemmes-note';c5.textContent=d.auto?('Automatique'+(d.note?' — '+d.note:'')):'À la main (🎲 sur la fiche)';
   row.append(c1,c2,c3,c4,c5);t.append(row)});boite.append(t)});
 // 3. Les récompenses et la fusion.
 h('Récompenses et fusion');
 {const l=document.createElement('div');l.className='gemmes-reglage';
  const lab=document.createElement('label');lab.append('Boss vaincu : chaque aventurier reçoit ');lab.append(nombre(R.boss.n,0,20,(g,n)=>{g.boss.n=n}));const s=document.createElement('select');TAILLES_GEMMES.forEach(([k,n])=>s.add(new Option(n,k)));s.value=R.boss.taille;s.onchange=()=>{poseReglesGemmes(g=>{g.boss.taille=s.value});renderGemmes()};lab.append(' ',s,' de la couleur qu’il a le plus déclenchée.');l.append(lab);
  const f1=document.createElement('label');f1.append('Fusion : ',nombre(R.fusion.eclat,1,99,(g,n)=>{g.fusion.eclat=n}),' Brisures → 1 Éclat ; ',nombre(R.fusion.brome,1,99,(g,n)=>{g.fusion.brome=n}),' Éclats → 1 Brôme');l.append(f1);
  const p=document.createElement('span');p.className='muted';p.textContent='La fusion se règle ici ; elle se branchera avec l’Arcaniste.';l.append(p);boite.append(l)}
 // 4. Les couleurs des caractéristiques et des compétences : ce que coûtent les bonus, et ce que rapportent les tests.
 h('Couleur de chaque caractéristique et compétence','Ce que paie un bonus du sphérier, et ce que rapporte un test de compétence réussi ou un état infligé.');
 {const g=document.createElement('div');g.className='gemmes-bonus-liste';remplitGemmesBonus(g,()=>renderGemmes());boite.append(g)}}
{const sp=showPage;showPage=function(p,...x){const r=sp(p,...x);if(p==='gemmes')renderGemmes();return r}}
