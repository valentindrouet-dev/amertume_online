/* ---------- v1.144 : les gemmes gagnées en jouant ----------
   Chaque aventurier a sa bourse de gemmes, qui ne se partage pas : ce sont ses actions qui la remplissent. Quand il réussit une
   action liée à une couleur — un déclencheur —, il lance un dé de gemme : sur le seuil du déclencheur ou plus (5+ de base), une
   Brisure de la couleur, jamais plus d'une (v1.155) ; un déclencheur lance un seul dé, son seuil fait sa difficulté (v1.167), et une
   même action ne donne qu'une gemme de chaque couleur (v1.157). En combat, au plus tant de Brisures de chaque
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
 {cle:'abattre-approche',nom:'Abattre un adversaire qui s’est déplacé vers vous ou un allié ce tour',phase:'combat',couleur:'rubis',auto:true,note:'Il a bougé ce tour et s’est rapproché d’un aventurier : on l’abat avant le contact.'},
 {cle:'contribution',nom:'Un adversaire que vous avez blessé ce tour meurt, quel que soit le tueur',phase:'combat',couleur:'rubis',auto:true,note:'Chacun de ceux qui l’ont blessé ce tour.'},
 {cle:'tuer-plusieurs',nom:'Tuer 2 adversaires ou plus en une seule attaque ou un seul talent',phase:'combat',couleur:'rubis',auto:true,note:'Un même geste qui met deux adversaires ou plus à 0 PV.'},
 {cle:'frapper-non-vu',nom:'Frapper un adversaire qui ne vous voit pas',phase:'combat',couleur:'rubis',auto:true,note:'Cible Surprise, Aveugle ou endormie, ou attaquant Invisible ou Caché.'},
 {cle:'soigner-allie',nom:'Soigner un allié',phase:'combat',couleur:'emeraude',auto:true,note:'Un talent, une potion ou un objet qui rend des PV à un autre.'},
 {cle:'critique-soin',nom:'Faire un critique de soin',phase:'combat',couleur:'emeraude',auto:true,note:'Deux dés verts ou plus font 6, sur un talent de soin d’aventurier — pas un objet.'},
 {cle:'fin-tour-intouchable',nom:'Finir le tour sans adversaire au contact et sans avoir été blessé',phase:'combat',couleur:'emeraude',auto:true,note:'À la fin du tour, pour chaque aventurier debout qui n’a pas perdu de PV ce tour.'},
 {cle:'distance-ratee',nom:'Une attaque à distance adverse qui vous rate',phase:'combat',couleur:'emeraude',auto:true,note:'Un tir ou un orbe adverse qui ne passe pas.'},
 {cle:'encaisser-debout',nom:'Encaisser un coup sans tomber',phase:'combat',couleur:'emeraude',auto:true,note:'Un coup adverse qui blesse sans mettre à 0 PV.'},
 {cle:'subir-25',nom:'Subir 25 % de ses PV max d’une attaque adverse',phase:'combat',couleur:'emeraude',auto:true,note:'Seul le plus haut palier atteint par le coup compte.'},
 {cle:'subir-50',nom:'Subir 50 % de ses PV max d’une attaque adverse',phase:'combat',couleur:'emeraude',auto:true,note:'Seul le plus haut palier atteint par le coup compte.'},
 {cle:'subir-75',nom:'Subir 75 % de ses PV max d’une attaque adverse',phase:'combat',couleur:'emeraude',auto:true,note:'Seul le plus haut palier atteint par le coup compte.'},
 {cle:'subir-critique',nom:'Subir un critique adverse',phase:'combat',couleur:'emeraude',auto:true,note:'Un critique d’attaque ou d’orbe adverse sur l’aventurier.'},
 {cle:'degager-sans-do',nom:'Se dégager du contact sans Dégâts d’Opportunité',phase:'combat',couleur:'emeraude',auto:true,note:'Quitter un adversaire au contact sans rien perdre.'},
 {cle:'toucher-distance',nom:'Toucher une cible à distance (une fois par tour)',phase:'combat',couleur:'citrine',auto:true,parTour:true,note:'Une attaque à distance qui passe la DEF, une fois par tour.'},
 {cle:'tir-longue-portee',nom:'Tir à longue portée, la cible au-delà d’un mouvement',phase:'combat',couleur:'citrine',seuil:6,auto:true,note:'Un tir qui touche une cible plus loin que le mouvement du tireur.'},
 {cle:'utiliser-objet',nom:'Utiliser un objet, un piège ou une invention',phase:'combat',couleur:'citrine',auto:true,note:'Un objet employé, ou une invention qui touche.'},
 {cle:'reperer-cache',nom:'Repérer un adversaire caché',phase:'combat',couleur:'citrine',auto:true,note:'Un test de Perception en combat qui révèle un adversaire.'},
 {cle:'double-mystique',nom:'Faire doubler un dé Mystique',phase:'combat',couleur:'saphir',auto:true,note:'Le pouvoir des dés bleus : un dé Mystique qui passe et dont la face est répétée double.'},
 {cle:'deplacement-force',nom:'Repousser ou attirer un adversaire, ou le mettre Au sol',phase:'combat',couleur:'citrine',auto:true,note:'Un déplacement forcé, ou Au sol infligé.'},
 {cle:'etat-precision',nom:'Infliger un état de précision (Aveugle)',phase:'combat',couleur:'citrine',auto:true,note:'Aveugle posé sur un adversaire.'},
 {cle:'tir-premier',nom:'Tirer le premier du tour, sur un adversaire qui n’a pas encore agi',phase:'combat',couleur:'citrine',auto:true,note:'Le premier tir des aventuriers dans le tour.'},
 {cle:'bouger-premier',nom:'Se déplacer le premier du tour',phase:'combat',couleur:'citrine',auto:true,note:'Le premier combattant qui bouge dans le tour, s’il est aventurier.'},
 {cle:'tuer-pv-max',nom:'Tuer en un coup un adversaire à ses PV max',phase:'combat',couleur:'citrine',auto:true,note:'Un adversaire intact abattu d’un seul coup.'},
 {cle:'sort-touche',nom:'Lancer un sort ou un talent mystique qui touche',phase:'combat',couleur:'saphir',auto:true,note:'Un orbe qui passe la DEF.'},
 {cle:'etat-elementaire',nom:'Infliger un état',phase:'combat',couleur:'etat',auto:true,note:'Feu, Gel, Poison… posé sur un adversaire ; la couleur est celle de l’état (tableau des couleurs).'},
 {cle:'etat-positif-allie',nom:'Mettre un état positif sur un allié',phase:'combat',couleur:'etat',auto:true,note:'Blindage, Furie, Invisible, Onde, Vie ou Rage posé sur un autre aventurier ; la couleur est celle de l’état.'},
 {cle:'test-mental-combat',nom:'Réussir un test de Mysticisme ou de Savoir en combat',phase:'combat',couleur:'saphir',auto:true,note:'Un test réussi pendant le combat (résister, analyser).'},
 {cle:'tuer-par-etat',nom:'Tuer un adversaire avec les dégâts d’un état',phase:'combat',couleur:'saphir',auto:true,note:'Feu, Poison, Nécrose… : à celui qui a posé l’état.'},
 {cle:'maitrise-unique',nom:'Utiliser une Maîtrise ou un talent « une fois par combat »',phase:'combat',couleur:'saphir',auto:true,note:'Le premier usage du combat, talent par talent.'},
 {cle:'relever-coma',nom:'Relever un allié du coma, ou être relevé',phase:'combat',couleur:'saphir',seuil:4,auto:true,note:'La sortie du coma : à celui qui se relève et à celui qui l’a soigné.'},
 {cle:'reveler-faiblesse',nom:'Révéler une faiblesse',phase:'combat',couleur:'saphir',auto:true,note:'Une Analyse qui apprend quelque chose.'},
 {cle:'def-tient',nom:'Une attaque adverse ne passe pas votre DEF',phase:'combat',couleur:'diamant',auto:true,note:'Les dés adverses tous arrêtés par la DEF.'},
 {cle:'toucher-couvert',nom:'Toucher un adversaire au contact d’un allié',phase:'combat',couleur:'diamant',auto:true,note:'Le coup ou le tir qui touche un adversaire qu’un autre aventurier tient au contact.'},
 {cle:'proteger-allie',nom:'Protéger un allié à sa place',phase:'combat',couleur:'diamant',auto:true,note:'Gardien, Rempart ou Garde rapprochée qui prend le coup.'},
 {cle:'absorber-armure',nom:'Absorber entièrement un coup avec l’Armure ou le Blindage',phase:'combat',couleur:'diamant',auto:true,note:'Un coup adverse qui passe la DEF sans faire perdre un PV.'},
 {cle:'gain-armure',nom:'Gagner de l’Armure ou du Blindage (une fois par combat)',phase:'combat',couleur:'diamant',auto:true,parCombat:true,note:'La première fois du combat.'},
 {cle:'reaction-annule',nom:'Annuler une attaque par une Réaction',phase:'combat',couleur:'diamant',auto:true,note:'Un Pas de Côté qui laisse le coup sans cible.'},
 {cle:'fin-tour-bas-pv',nom:'Finir le tour sous 25 % de ses PV sans tomber',phase:'combat',couleur:'diamant',auto:true,note:'À la fin du tour, debout, moins d’un quart de ses PV max.'},
 {cle:'groupe-sans-coma',nom:'Finir un combat sans aucun allié dans le coma (groupe)',phase:'combat',couleur:'diamant',auto:true,note:'À la fin du combat, chaque aventurier lance le dé si personne n’est dans le coma.'},
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
/* v1.155 : plus de table des faces ; chaque déclencheur a son seuil — la plus petite face qui donnait quelque chose dans la table
   d'avant, s'il y en avait une, sinon 5+ (6+ pour le Diamant, comme la table d'avant). */
const seuilDesFaces=(g,c)=>{const l=COULEURS_GEMMES.includes(c)?(Array.isArray(g.faces&&g.faces[c])?g.faces[c]:FACES_GEMMES_DEFAUT[c]):null;if(!l)return 5;const i=l.findIndex(n=>Number(n)>0);return i<0?6:i+1};
function normaliseReglesGemmes(g){g=g&&typeof g==='object'&&!Array.isArray(g)?g:{};const out={plafond:nbEntier(g.plafond,0,99,3),
 boss:{taille:['brisure','eclat','brome'].includes(g.boss&&g.boss.taille)?g.boss.taille:'eclat',n:nbEntier(g.boss&&g.boss.n,0,20,1)},
 fusion:{eclat:nbEntier(g.fusion&&g.fusion.eclat,1,99,5),brome:nbEntier(g.fusion&&g.fusion.brome,1,99,5)},declencheurs:{}};
 DECLENCHEURS_GEMMES.forEach(d=>{const x=g.declencheurs&&g.declencheurs[d.cle]||{},couleur=COULEURS_GEMMES.includes(x.couleur)||x.couleur==='competence'||x.couleur==='etat'?x.couleur:d.couleur;
  out.declencheurs[d.cle]={couleur,actif:x.actif!==false,seuil:nbEntier(x.seuil,1,6,d.seuil||seuilDesFaces(g,couleur))}});
 return out}
function reglesGemmes(){return normaliseReglesGemmes(typeof catalog!=='undefined'&&catalog?catalog.gemmesRegles:null)}
function poseReglesGemmes(f){catalog.gemmesRegles=reglesGemmes();f(catalog.gemmesRegles);catalog.gemmesRegles=normaliseReglesGemmes(catalog.gemmesRegles);
 if(typeof scheduleSave==='function')scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
{const nc=normalizeCatalog;normalizeCatalog=function(c,...x){const r=nc(c,...x);if(c&&typeof c==='object'){if(c.gemmesRegles)c.gemmesRegles=normaliseReglesGemmes(c.gemmesRegles)}return r}}
/* Ce que l'appli suit pour un aventurier (a.gemmesSuivi, qui voyage avec lui) : le combat en cours et ses Brisures par couleur,
   ses déclencheurs par couleur, s'il est tombé dans le coma ; et, hors combat, les déclencheurs déjà joués par zone. */
function suiviGemmes(a){let s=a.gemmesSuivi;if(!s||typeof s!=='object')s=a.gemmesSuivi={};
 const n=typeof numeroCombat!=='undefined'?numeroCombat:0;
 if(s.combat!==n&&typeof enCombat==='function'&&enCombat()){s.combat=n;s.brisures={};s.decl={};s.gagnes={};delete s.coma}
 if(!s.brisures||typeof s.brisures!=='object')s.brisures={};
 // v1.160 : les gemmes gagnées pendant le combat, pour son bilan ; et chaque déclenchement compté, depuis le début.
 if(!s.gagnes||typeof s.gagnes!=='object')s.gagnes={};if(!s.compte||typeof s.compte!=='object')s.compte={};if(!s.decl||typeof s.decl!=='object')s.decl={};if(!Array.isArray(s.scenes))s.scenes=[];return s}
// La zone de la carte où se tient l'aventurier : la scène des déclencheurs hors combat.
function cleSceneGemme(a){const m=typeof currentMap==='function'?currentMap():null,id=typeof currentMapId!=='undefined'?currentMapId||'':'';
 const z=m&&typeof zonesDe==='function'?zonesDe(m):null;return id+':'+(z&&typeof zoneAu==='function'?zoneAu(z,a.x,a.y):0)}
function couleurDeclencheur(cle,opts){const d=declencheurGemme(cle);if(!d)return null;const r=reglesGemmes().declencheurs[cle];
 if(r.couleur==='competence'){const k=Math.max(0,Math.min(7,Number(opts&&opts.comp)||0));return typeof varieteBonus==='function'?varieteBonus({carac:'comp',comp:String(k)}):'citrine'}
 if(r.couleur==='etat')return typeof varieteBonus==='function'?varieteBonus({carac:'etat',etat:opts&&opts.etat}):'rubis';
 return r.couleur}
// Un même déclencheur, pour un même aventurier, ne joue qu'une fois par geste : les crans d'un état, les dés d'un coup.
const gemmesCeGeste=new Set(),gemmesCetteAction=new Set();
function deGemme(a,cle,opts={}){if(!a||!a.hero||typeof spectateur==='function'&&spectateur())return null;const d=declencheurGemme(cle);if(!d)return null;
 const R=reglesGemmes(),r=R.declencheurs[cle];if(!r.actif&&!opts.manuel)return null;
 const combat=opts.phase?opts.phase==='combat':typeof enCombat==='function'&&enCombat();
 if(!opts.manuel&&d.phase==='combat'&&!combat)return null;if(!opts.manuel&&d.phase==='hors'&&combat)return null;
 const k=cle+(opts.comp!==undefined?':'+opts.comp:'')+(opts.etat!==undefined?':'+opts.etat:'');if(gemmesCeGeste.has(a.id+'|'+k))return null;gemmesCeGeste.add(a.id+'|'+k);queueMicrotask(()=>gemmesCeGeste.delete(a.id+'|'+k));
 const couleur=couleurDeclencheur(cle,opts),s=suiviGemmes(a);if(!couleur)return null;
 s.decl[couleur]=(s.decl[couleur]||0)+1;
 if(!combat||d.phase==='hors'){const sc=cleSceneGemme(a)+'|'+k;if(s.scenes.includes(sc)&&!opts.manuel)return null;s.scenes=[...s.scenes.filter(x=>x!==sc),sc].slice(-80)}
 // v1.163 : un déclencheur « une fois par tour » ne rejoue pas avant le tour suivant.
 // v1.169 : « une fois par combat » de même.
 if(d.parCombat&&!opts.manuel){if(!s.parCombat||typeof s.parCombat!=='object')s.parCombat={};if(s.parCombat[cle]===numeroCombat)return null;s.parCombat[cle]=numeroCombat}
 if(d.parTour&&!opts.manuel&&typeof cleTour==='function'){if(!s.tours||typeof s.tours!=='object')s.tours={};if(s.tours[cle]===cleTour())return null;s.tours[cle]=cleTour()}
 s.compte[cle]=(Math.trunc(Number(s.compte[cle]))||0)+1;
 // v1.167 : un seul dé par déclencheur ; le seuil fait la difficulté.
 const des=1;
 const faces=Array.from({length:des},()=>typeof d6==='function'?d6():1+Math.floor(Math.random()*6));
 let gagne=faces.some(f=>f>=r.seuil)?1:0;
 /* v1.157 : une même action — un coup, un talent et toutes ses cibles — ne donne qu'une gemme de chaque couleur : chaque
    déclencheur lance ses dés, mais si deux d'une même couleur réussissent, une seule se garde. Le dé du MJ n'y est pas tenu. */
 if(gagne&&!opts.manuel){const kc=a.id+'|'+couleur;if(gemmesCetteAction.has(kc))gagne=0;else{gemmesCetteAction.add(kc);queueMicrotask(()=>gemmesCetteAction.delete(kc))}}
 // Le plafond du combat : ce qui dépasse ne tombe pas.
 if(combat&&d.phase==='combat'){const deja=s.brisures[couleur]||0;gagne=Math.max(0,Math.min(gagne,R.plafond-deja));s.brisures[couleur]=deja+gagne}
 if(gagne>0){const cg=cleGemme('brisure',couleur,false);a.richesses={...(a.richesses||{})};a.richesses[cg]=(Math.trunc(Number(a.richesses[cg]))||0)+gagne;
  flotteGemme(a,'brisure',couleur,gagne);if(combat)s.gagnes[cg]=(s.gagnes[cg]||0)+gagne}
 if(typeof scheduleSave==='function')scheduleSave();return {faces,gagne,couleur}}
// La petite sphère qui monte au-dessus du socle quand une Brisure tombe.
/* v1.166 : la sphère gagnée — des éclats de sa couleur jaillissent tout autour du socle, puis se rassemblent à sa droite, à mi-hauteur,
   en une gemme qui brille un instant et s'efface, son « +1 » à côté. Elle reste à part des dégâts et des états, qui montent au-dessus
   du socle ; plusieurs à la suite s'étagent vers le bas. */
const pilesSpheres=new Map();
/* v1.171 : les sphères ont leur propre calque, au-dessus de tout sur la carte — tokens, états, jauges, flottants. */
function coucheSpheres(){let c=$('couche-spheres');if(!c){const v=$('map-view');if(!v)return null;c=document.createElement('div');c.id='couche-spheres';c.setAttribute('aria-hidden','true');v.append(c)}return c}
function flotteGemme(a,taille,variete,n){const c=coucheSpheres();if(!c||!a||typeof tokenOf!=='function')return;const tk=tokenOf(a),t=performance.now(),pile=(pilesSpheres.get(a.id)||[]).filter(x=>t-x<1600),rang=pile.length;pile.push(t);pilesSpheres.set(a.id,pile);
 const teinte=(typeof TEINTES_GEMMES!=='undefined'&&TEINTES_GEMMES[variete])||'#c99a3c',calme=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bx=Math.round(tk*.62),by=Math.round(rang*tk*.42-tk*.18),retard=calme?0:520;
 const el=document.createElement('span');el.className='flotte-sphere';el.style.left='calc('+a.x+'% + '+bx+'px)';el.style.top='calc('+a.y+'% + '+by+'px)';el.style.setProperty('--t',Math.max(18,Math.round(tk*.42))+'px');
 const im=document.createElement('img');im.src=imgUrl(iconeGemme(taille,variete)+'.png');im.alt=nomGemme(taille,variete,false);im.draggable=false;const b=document.createElement('b');b.textContent='+'+n;el.append(im,b);el.style.opacity='0';c.append(el);
 if(!calme){const N=8,R=tk*.78,e=Math.max(6,Math.round(tk*.17));
  for(let k=0;k<N;k++){const ang=(k/N)*Math.PI*2+(Math.random()-.5)*.5,r=R*(.8+Math.random()*.4),ox=Math.cos(ang)*r,oy=Math.sin(ang)*r,d=document.createElement('i');d.className='eclat-sphere';
   d.style.left=a.x+'%';d.style.top=a.y+'%';d.style.setProperty('--c',teinte);d.style.width=d.style.height=e+'px';c.append(d);const rot=Math.round(Math.random()*90);
   const f=d.animate([{transform:'translate(-50%,-50%) rotate(45deg) scale(.3)',opacity:0},{transform:'translate(calc(-50% + '+ox+'px),calc(-50% + '+oy+'px)) rotate('+(45+rot)+'deg) scale(1)',opacity:1,offset:.38},
    {transform:'translate(calc(-50% + '+ox*1.08+'px),calc(-50% + '+oy*1.08+'px)) rotate('+(45+rot*1.4)+'deg) scale(1)',opacity:1,offset:.55},
    {transform:'translate(calc(-50% + '+(bx+tk*.21)+'px),calc(-50% + '+by+'px)) rotate('+(45+rot*2)+'deg) scale(.35)',opacity:.9}],{duration:retard+60,easing:'cubic-bezier(.25,.8,.35,1)'});
   f.onfinish=()=>d.remove()}}
 const fin=el.animate(calme?[{opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.75},{opacity:0}]
  :[{transform:'translate(0,-50%) scale(.3)',opacity:0,filter:'brightness(1)'},{transform:'translate(0,-50%) scale(1.25)',opacity:1,filter:'brightness(1.9)',offset:.16},
    {transform:'translate(0,-50%) scale(1)',opacity:1,filter:'brightness(1)',offset:.32},{transform:'translate(0,-50%) scale(1)',opacity:1,offset:.8},{transform:'translate(0,-62%) scale(.92)',opacity:0}],
  {duration:calme?1600:1300,delay:retard,easing:'ease-out',fill:'backwards'});
 fin.onfinish=()=>el.remove()}
/* ---------- Ce que le moteur dit au dé de gemme ---------- */
let bossVaincuCombat=0,dernierInvisible=null;
// Un coup posé (index.html, frappe et orbe) : à l'attaquant, à la cible, ce que les faces ont dit.
function gemmesApresCoup(a,b,r,hpAvant,lost){if(!a||!b||!r||typeof enCombat!=='function'||!enCombat())return;
 const crit=!!(r.critical&&!r.failed),touche=!r.failed&&!!r.hit,opp={critique:crit};
 if(a.hero&&hostiles(a,b)){
  if(crit)deGemme(a,'critique',opp);
  // v1.170 : un dé Mystique qui double, critique ou non : le Saphir.
  if(r.mystique)deGemme(a,'double-mystique',opp);
  if(b.hp===0&&hpAvant>0){deGemme(a,'tuer',opp);noteTuerie(a,b,opp);if(b.type==='boss')bossVaincuCombat=numeroCombat}
  if(touche&&!r.orbe){const inv=dernierInvisible&&dernierInvisible.id===a.id&&performance.now()-dernierInvisible.t<3000;
   if(inv||hasState(b,'Surpris')||hasState(b,'Aveugle')||hasState(b,'Sommeil')||hasState(a,'Invisible')||hasState(a,'Caché'))deGemme(a,'frapper-non-vu',opp);
   if(typeof rangeOf==='function'&&rangeOf(a)==='distance')deGemme(a,'toucher-distance',opp);
   if(typeof activeAttack==='function'&&activeAttack(a).invention===true)deGemme(a,'utiliser-objet',opp)}
  if(touche&&r.orbe)deGemme(a,'sort-touche',opp)}
 if(b.hero&&hostiles(a,b)){if(!r.failed&&!r.hit&&!r.orbe)deGemme(b,'def-tient');if(lost>0&&b.hp>0)deGemme(b,'encaisser-debout');
  // v1.155 : la part des PV max qu'emporte le coup — seul le plus haut palier atteint ; et le critique adverse subi.
  if(lost>0){const f=lost/Math.max(1,Number(b.max)||1),p=f>=.75?'subir-75':f>=.5?'subir-50':f>=.25?'subir-25':null;if(p)deGemme(b,p)}
  if(crit)deGemme(b,'subir-critique')}}
/* v1.155 — Tuer deux adversaires ou plus d'un même geste : les morts d'un même tour de boucle (une attaque, un talent, ses
   cibles l'une après l'autre), qu'elles viennent d'un coup ou d'un talent qui inflige ses dégâts sans jet. */
let tueriesGeste=null;
function noteTuerie(a,b,opp){if(!a||!a.hero||!b)return;if(!tueriesGeste||tueriesGeste.id!==a.id){tueriesGeste={id:a.id,morts:new Set(),fait:false};const t=tueriesGeste;queueMicrotask(()=>{if(tueriesGeste===t)tueriesGeste=null})}
 tueriesGeste.morts.add(b.id);if(tueriesGeste.morts.size>=2&&!tueriesGeste.fait){tueriesGeste.fait=true;deGemme(a,'tuer-plusieurs',opp||{})}}
{const en=encaisse;encaisse=function(o,n,de,...x){const hp=o&&o.hp,r=en(o,n,de,...x),s=de===undefined?(typeof auteurCoup!=='undefined'?auteurCoup:null):de;
 if(s&&s.hero&&o&&hp>0&&o.hp===0&&typeof enCombat==='function'&&enCombat()&&hostiles(s,o))noteTuerie(s,o);return r}}
/* v1.155 — Le critique de soin : deux dés verts ou plus à 6, roulés par un aventurier pour un soin de talent dans le même geste
   — pas un objet ni une potion. Le jet et le soin se croisent dans le même tour de boucle, dans un ordre ou dans l'autre. */
let soinObjet=0,critSoin=null;
function noteCritSoin(champ,a){if(!critSoin){const c=critSoin={};queueMicrotask(()=>{if(critSoin!==c)return;critSoin=null;if(c.jet&&c.soin&&c.a)deGemme(c.a,'critique-soin')})}
 critSoin[champ]=true;if(a)critSoin.a=a}
{const rb=rollOnBoard;rollOnBoard=function(lignes,from,...x){try{if(from&&from.hero&&!soinObjet&&typeof enCombat==='function'&&enCombat()&&Array.isArray(lignes)&&lignes.length){
  const l=Array.isArray(lignes[0])&&typeof lignes[0][0]==='number'?[{dice:lignes}]:lignes,six=l.reduce((n,g)=>n+((g&&g.dice)||[]).filter(([v,c])=>v===6&&c===4).length,0);
  if(six>=2)noteCritSoin('jet',from)}}catch(e){}return rb(lignes,from,...x)}}
{const ah=applyHeal;applyHeal=function(o,...x){const g=ah(o,...x);if(g>0&&!soinObjet&&typeof enCombat==='function'&&enCombat())noteCritSoin('soin');return g}}
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
if(typeof appliquerObjet==='function'){const ao=appliquerObjet;appliquerObjet=function(a,...x){soinObjet++;let r;try{r=ao(a,...x)}finally{soinObjet--}if(a&&a.hero&&typeof enCombat==='function'&&enCombat())deGemme(a,'utiliser-objet');return r}}
if(typeof appliquerEffetObjet==='function'){const ae=appliquerEffetObjet;appliquerEffetObjet=function(a,...x){soinObjet++;let r;try{r=ae(a,...x)}finally{soinObjet--}if(a&&a.hero&&typeof enCombat==='function'&&enCombat())deGemme(a,'utiliser-objet');return r}}
// Une Analyse qui apprend quelque chose : le nombre de choses sues grandit.
{const an=analyse;analyse=function(i,...x){const a=actors[selected],o=actors[i],avant=o&&typeof connuDe==='function'?connuDe(o).size:0;const r=an(i,...x);
 if(a&&a.hero&&o&&typeof connuDe==='function'&&connuDe(o).size>avant)deGemme(a,'reveler-faiblesse');return r}}
/* Un test de compétence : hors combat, une réussite au moins déclenche la couleur de la compétence — la Fouille la sienne ; en
   combat, la Perception qui révèle un adversaire. Le jet se lit au passage. */
{const ts=testSkill;testSkill=function(i,fouille,...x){const a=actors[selected],caches=()=>actors.filter(o=>o&&!o.hero&&alive(o)&&(o.hidden||!o.vu)).length,avant=caches();
 let jet=null;const sr=skillRoll;skillRoll=function(...y){const j=sr(...y);jet=j;return j};let r;try{r=ts(i,fouille,...x)}finally{skillRoll=sr}
 if(jet&&a&&a.hero){if(typeof enCombat==='function'&&enCombat()){if(i===PERCEPTION_RANG&&caches()<avant)deGemme(a,'reperer-cache');if(jet.reussites>0&&(skillNames[i]==='Mysticisme'||skillNames[i]==='Savoir'))deGemme(a,'test-mental-combat')}
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
/* v1.160 : elles tombent juste avant que le combat se ferme : le bilan de fin de combat les compte. */
{const bm=basculerMode;basculerMode=function(neuf,...x){const finit=mode==='combat'&&neuf!=='combat',spect=typeof spectateur==='function'&&spectateur(),n=numeroCombat;
 if(!finit||spect)return bm(neuf,...x);const R=reglesGemmes(),presents=actors.filter(a=>a&&a.hero&&!a.horsCarte&&!estMort(a)&&!sortiDuCombat(a));
 presents.forEach(a=>{const s=suiviGemmes(a);if(s.combat===n&&s.coma!==n)deGemme(a,'combat-sans-coma',{phase:'combat'})});
 // v1.169 : personne dans le coma au moment où le combat se ferme : chacun son dé.
 if(presents.length&&!presents.some(a=>a.comaVie||a.hp<=0||hasState(a,'Coma')))presents.forEach(a=>deGemme(a,'groupe-sans-coma',{phase:'combat'}));
 if(bossVaincuCombat===n&&R.boss.n>0){presents.forEach(a=>{const s=suiviGemmes(a),c=COULEURS_GEMMES.reduce((m,k)=>(s.decl[k]||0)>(s.decl[m]||0)?k:m,COULEURS_GEMMES[0]);if(!(s.decl[c]>0))return;
  const cg=cleGemme(R.boss.taille,c,false);a.richesses={...(a.richesses||{})};a.richesses[cg]=(Math.trunc(Number(a.richesses[cg]))||0)+R.boss.n;flotteGemme(a,R.boss.taille,c,R.boss.n);s.gagnes[cg]=(s.gagnes[cg]||0)+R.boss.n});bossVaincuCombat=0}
 const r=bm(neuf,...x);if(typeof scheduleSave==='function')scheduleSave();return r}}
/* ---------- Le dé à la main, par le MJ ---------- */
const deGemmeDialog=dialog('de-gemme','Dé de gemme','<form id="de-gemme-form"><div class="edit-grid"><label>Déclencheur<select name="decl" id="de-gemme-decl"></select></label>'
 +'<label>Compétence<select name="comp" id="de-gemme-comp"></select></label><label>État<select name="etat" id="de-gemme-etat"></select></label></div>'
 +'<p class="muted" id="de-gemme-dit"></p><div class="form-actions"><button class="primary">Lancer</button></div></form>');
let deGemmeActeur=null;
function ouvreDeGemme(a){if(view!=='mj'||!a||!a.hero)return;deGemmeActeur=a;const f=$('de-gemme-form'),sd=$('de-gemme-decl'),sc=$('de-gemme-comp'),se=$('de-gemme-etat');sd.replaceChildren();sc.replaceChildren();se.replaceChildren();ETATS_JEU.forEach(e=>se.add(new Option(e,e)));
 [['combat','En combat'],['hors','Hors combat']].forEach(([ph,nom])=>{const g=document.createElement('optgroup');g.label=nom;DECLENCHEURS_GEMMES.filter(d=>d.phase===ph).forEach(d=>g.append(new Option(d.nom+(d.auto?'':' (à la main)'),d.cle)));sd.append(g)});
 skillNames.forEach((n,k)=>sc.add(new Option(n,String(k))));
 const maj=()=>{const d=declencheurGemme(sd.value),r=reglesGemmes().declencheurs[sd.value];sc.closest('label').hidden=!(r&&r.couleur==='competence');se.closest('label').hidden=!(r&&r.couleur==='etat');
  const c=couleurDeclencheur(sd.value,{comp:sc.value,etat:se.value});$('de-gemme-dit').textContent=(d?d.nom:'')+' → '+(c?NOM_COULEUR_GEMME[c]:'')+(r&&!r.actif?' (déclencheur désactivé)':'')};
 sd.onchange=maj;sc.onchange=maj;se.onchange=maj;maj();
 f.onsubmit=e=>{e.preventDefault();const res=deGemme(deGemmeActeur,sd.value,{manuel:true,comp:sc.value,etat:se.value});deGemmeDialog.close();
  if(res&&!res.gagne&&typeof log==='function')log(nomNum(deGemmeActeur)+' · dé de gemme ⦃'+res.faces.join(',')+'⦄ : rien.',{ton:'talent',local:true});
  if(typeof render==='function')render();if(typeof renderHeroes==='function')renderHeroes()};
 deGemmeDialog.showModal()}
// Dans la fenêtre Richesses d'un aventurier (l'or de son inventaire, au MJ) : le bouton du dé.
{const orr=openRichesses;openRichesses=function(a,...x){const r=orr(a,...x);const f=$('richesses-form'),acts=f&&f.querySelector('.form-actions');
 if(acts&&!acts.querySelector('.de-gemme-bouton')){const b=document.createElement('button');b.type='button';b.className='de-gemme-bouton';b.textContent='🎲 Dé de gemme';b.onclick=()=>{richessesDialog.close();ouvreDeGemme(richessesActeur)};acts.prepend(b)}return r}}
/* ---------- L'onglet Gemmes du MJ ---------- */
const gemmesPage=document.createElement('main');gemmesPage.id='gemmes-page';
gemmesPage.innerHTML='<section class="cat-panel panel"><header class="cat-head"><h2>Sphères</h2></header>'
 +'<p class="muted">Les gemmes se gagnent en jouant : chaque action réussie liée à une couleur fait lancer un dé de gemme. Ici se règlent les déclencheurs, leurs couleurs et leurs seuils, le plafond par combat, la récompense d’un boss, les ratios de fusion et la couleur de chaque caractéristique et compétence.</p>'
 +'<div id="gemmes-regles"></div></section>';
document.querySelector('main.layout').after(gemmesPage);
function renderGemmes(){const boite=$('gemmes-regles');if(!boite)return;boite.replaceChildren();const R=reglesGemmes();
 const h=(t,sous)=>{const e=document.createElement('h3');e.className='gemmes-titre';e.textContent=t;boite.append(e);if(sous){const p=document.createElement('p');p.className='muted';p.textContent=sous;boite.append(p)}};
 const nombre=(v,lo,hi,f)=>{const i=document.createElement('input');i.type='number';i.min=lo;i.max=hi;i.value=v;i.onchange=()=>{poseReglesGemmes(g=>f(g,nbEntier(i.value,lo,hi,v)));renderGemmes()};return i};
 const icone=(taille,c)=>{const im=document.createElement('img');im.src=imgUrl(iconeGemme(taille,c)+'.png');im.alt='';im.className='gemmes-icone';return im};
 // 1. Le dé.
 h('Le dé de gemme','Sur le seuil de son déclencheur ou plus, une Brisure de sa couleur ; jamais plus d’une, ni plus d’une de chaque couleur par action.');
 {const l=document.createElement('div');l.className='gemmes-reglage';
  const li=(txt,el)=>{const lab=document.createElement('label');lab.append(txt,el);l.append(lab)};
  li('Plafond de Brisures par couleur et par combat ',nombre(R.plafond,0,99,(g,n)=>{g.plafond=n}));
  const p=document.createElement('span');p.className='muted';p.textContent='Hors combat : chaque déclencheur joue une fois par zone de la carte.';l.append(p);boite.append(l)}
 // 2. Les déclencheurs.
 h('Les déclencheurs','Ce qui fait lancer le dé, et de quelle couleur. L’appli lance elle-même ceux qu’elle voit ; les autres, le MJ les lance depuis la fiche de l’aventurier (🎲 Dé de gemme).');
 /* v1.160 : au bout de chaque ligne, combien de fois le déclencheur a joué depuis le début, tous aventuriers réunis ; le bouton
    relit les comptes, qui arrivent des fiches. */
 {const bt=document.createElement('button');bt.type='button';bt.className='gemmes-rafraichir';bt.textContent='Rafraîchir les stats de déclenchement';bt.onclick=()=>renderGemmes();boite.append(bt)}
 const fois=cle=>actors.reduce((n,a)=>n+(a&&a.hero&&a.gemmesSuivi&&a.gemmesSuivi.compte?Math.max(0,Math.trunc(Number(a.gemmesSuivi.compte[cle]))||0):0),0);
 [['combat','En combat'],['hors','Hors combat']].forEach(([ph,nom])=>{const t=document.createElement('table');t.className='gemmes-table gemmes-decl';const cap=document.createElement('caption');cap.textContent=nom;t.append(cap);
  const tr=document.createElement('tr');['Actif','Déclencheur','Couleur','Seuil','Détection','Fois'].forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.append(th)});t.append(tr);
  DECLENCHEURS_GEMMES.filter(d=>d.phase===ph).forEach(d=>{const r=R.declencheurs[d.cle],row=document.createElement('tr');if(!r.actif)row.classList.add('inactif');
   const c1=document.createElement('td');const cb=document.createElement('input');cb.type='checkbox';cb.checked=r.actif;cb.onchange=()=>{poseReglesGemmes(g=>{g.declencheurs[d.cle].actif=cb.checked});renderGemmes()};c1.append(cb);
   const c2=document.createElement('td');c2.className='gemmes-nom';c2.textContent=d.nom;
   const c3=document.createElement('td');c3.className='gemmes-couleur';const s=document.createElement('select');COULEURS_GEMMES.forEach(c=>s.add(new Option(NOM_COULEUR_GEMME[c],c)));if(d.couleur==='competence'||d.cle==='test-competence')s.add(new Option('Compétence testée','competence'));if(d.couleur==='etat')s.add(new Option('Couleur de l’état','etat'));
   s.value=r.couleur;const im=icone('brisure',['competence','etat'].includes(r.couleur)?'citrine':r.couleur);if(['competence','etat'].includes(r.couleur))im.hidden=true;s.onchange=()=>{poseReglesGemmes(g=>{g.declencheurs[d.cle].couleur=s.value});renderGemmes()};c3.append(im,s);
   const c6=document.createElement('td');const ss=document.createElement('select');ss.className='gemmes-seuil';[1,2,3,4,5,6].forEach(n=>ss.add(new Option(n+'+',String(n))));ss.value=String(r.seuil);ss.classList.add('seuil-'+r.seuil);ss.onchange=()=>{poseReglesGemmes(g=>{g.declencheurs[d.cle].seuil=Number(ss.value)});renderGemmes()};c6.append(ss);
   const c5=document.createElement('td');c5.className='muted gemmes-note';c5.textContent=d.auto?('Automatique'+(d.note?' — '+d.note:'')):'À la main (🎲 sur la fiche)';
   const c7=document.createElement('td');c7.className='gemmes-fois';const nf=fois(d.cle);c7.textContent=String(nf);if(!nf)c7.classList.add('zero');
   row.append(c1,c2,c3,c6,c5,c7);t.append(row)});boite.append(t)});
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

/* ---------- v1.163 — De nouveaux déclencheurs en combat ---------- */
// Où était chaque adversaire au début du tour : celui qui s'est rapproché d'un aventurier depuis, abattu, vaut une gemme.
let posDebutTour=new Map(),blessuresTour=new Map(),blessesTour=new Map();const mortsVus=new WeakSet();
function notePositionsTour(){posDebutTour=new Map(actors.filter(o=>o&&!o.hero).map(o=>[o.id,{x:o.x,y:o.y}]))}
function seRapprochait(o){const p=posDebutTour.get(o&&o.id);if(!p||(Math.abs(p.x-o.x)<.01&&Math.abs(p.y-o.y)<.01))return false;const size=mapSize();if(!size.width)return false;
 const heros=actors.filter(h=>h&&!h.horsCarte&&alive(h)&&hostiles(h,o));if(!heros.length)return false;
 const d=(q,h)=>Math.hypot((q.x-h.x)/100*size.width,(q.y-h.y)/100*size.height),avant=Math.min(...heros.map(h=>d(p,h))),apres=Math.min(...heros.map(h=>d(o,h)));return apres<avant-1}
{const nt=noteTuerie;noteTuerie=function(a,b,opp,...x){const r=nt(a,b,opp,...x);if(a&&a.hero&&b&&!b.hero&&seRapprochait(b))deGemme(a,'abattre-approche',opp||{});return r}}
/* Les blessures du tour : qui a blessé quel adversaire ; à sa mort, d'où qu'elle vienne, chacun d'eux a son dé. Et l'aventurier
   blessé ce tour, pour « finir le tour sans avoir été blessé ». */
{const cd=compteDegats;compteDegats=function(de,vers,n,...x){const r=cd(de,vers,n,...x);
 if(n>0&&vers&&typeof enCombat==='function'&&enCombat()&&typeof cleTour==='function'){const k=cleTour();
  if(vers.hero)blessesTour.set(vers.id,k);
  if(de&&de.hero&&!vers.hero&&hostiles(de,vers)){let b=blessuresTour.get(vers.id);if(!b||b.k!==k){b={k,ids:new Set()};blessuresTour.set(vers.id,b)}b.ids.add(de.id)}
  if(!vers.hero&&vers.hp===0&&!mortsVus.has(vers)){mortsVus.add(vers);const b=blessuresTour.get(vers.id);
   if(b&&b.k===k)b.ids.forEach(id=>{const h=actors.find(o=>o&&o.id===id);if(h&&h.hero)deGemme(h,'contribution')})}}
 return r}}
// Un coup : la couverture d'un allié, la longue portée, l'attaque à distance adverse qui rate.
{const ac=gemmesApresCoup;gemmesApresCoup=function(a,b,r,hpAvant,lost,...x){const res=ac(a,b,r,hpAvant,lost,...x);
 if(!a||!b||!r||typeof enCombat!=='function'||!enCombat())return res;const touche=!r.failed&&!!r.hit,opp={critique:!!(r.critical&&!r.failed)};
 const aDistance=!r.orbe&&typeof rangeOf==='function'&&rangeOf(a)==='distance';
 if(a.hero&&hostiles(a,b)&&touche){
  if(typeof contactsDe==='function'&&contactsDe(b).some(o=>o&&o!==a&&o.hero&&alive(o)))deGemme(a,'toucher-couvert',opp);
  if(aDistance&&typeof metres==='function'&&typeof distanceMouvement==='function'){const m=metres(a,b,mapSize(),tokenPx());if(m>distanceMouvement(a,catalog.items||[]))deGemme(a,'tir-longue-portee',opp)}}
 if(b.hero&&hostiles(a,b)&&!touche&&(aDistance||r.orbe))deGemme(b,'distance-ratee');
 return res}}
// Un état positif posé sur un autre aventurier, par un talent ou un geste : à qui l'a posé.
{const pose=(o,etat)=>{if(!o||!ETATS_POSITIFS.includes(etat)||typeof enCombat!=='function'||!enCombat())return;const s=(typeof talentEnCours!=='undefined'&&talentEnCours&&talentEnCours.a)||null;
  if(s&&s.hero&&s!==o&&memeCamp(s,o))deGemme(s,'etat-positif-allie',{etat})};
 const ie=infligeEtat;infligeEtat=function(o,etat,...x){const r=ie(o,etat,...x);if(r===true){const s=(typeof auteurCoup!=='undefined'&&auteurCoup)||null;
  if(s&&s.hero&&s!==o&&memeCamp(s,o)&&ETATS_POSITIFS.includes(etat)&&enCombat())deGemme(s,'etat-positif-allie',{etat});else pose(o,etat)}return r};
 const ae=ajouteEtat;ajouteEtat=function(o,etat,n,...x){const r=ae(o,etat,n,...x);if(r>0&&n>0)pose(o,etat);return r};
 const ss=setState;setState=function(o,etat,mis,...x){const avant=!!o&&hasState(o,etat),r=ss(o,etat,mis,...x);if(mis&&!avant&&o&&hasState(o,etat))pose(o,etat);return r}}
// La fin du tour : chaque aventurier debout, sans adversaire au contact et sans PV perdus ce tour. Puis les positions du tour suivant.
{const ts=tourSuivant;tourSuivant=function(...x){if(typeof enCombat==='function'&&enCombat()&&!(typeof spectateur==='function'&&spectateur())){const k=cleTour();
  actors.forEach(a=>{if(!a||!a.hero||a.horsCarte||!alive(a)||estMort(a))return;if(blessesTour.get(a.id)===k)return;if(typeof contactsDe==='function'&&contactsDe(a).length)return;deGemme(a,'fin-tour-intouchable')})}
 const r=ts(...x);notePositionsTour();return r}}
{const bm=basculerMode;basculerMode=function(neuf,...x){const r=bm(neuf,...x);if(neuf==='combat')notePositionsTour();return r}}

/* ---------- v1.169 — Encore des déclencheurs ---------- */
const enCombatG=()=>typeof enCombat==='function'&&enCombat();
const sourceG=()=>(typeof talentEnCours!=='undefined'&&talentEnCours&&talentEnCours.a)||(typeof auteurCoup!=='undefined'&&auteurCoup)||null;
// Qui a posé chaque état sur chaque adversaire : la mort par ses dégâts lui revient.
const auteursEtats=new Map();
{const ie=infligeEtat;infligeEtat=function(o,etat,...x){const r=ie(o,etat,...x);if(r===true&&o&&!o.hero&&enCombatG()){const s=sourceG();
  if(s&&s.hero&&hostiles(s,o)){auteursEtats.set(o.id+'|'+etat,s.id);if(etat==='Au sol')deGemme(s,'deplacement-force');if(etat==='Aveugle')deGemme(s,'etat-precision')}}
 if(r===true&&o&&o.hero&&etat==='Blindage'&&enCombatG())deGemme(o,'gain-armure');return r}}
{const ae=ajouteEtat;ajouteEtat=function(o,etat,n,...x){const r=ae(o,etat,n,...x);if(r>0&&n>0&&o&&!o.hero&&enCombatG()){const s=sourceG();if(s&&s.hero&&hostiles(s,o))auteursEtats.set(o.id+'|'+etat,s.id)}return r}}
{const sd=subitDegatsEtat;subitDegatsEtat=function(o,etat,n,...x){const hp=o&&o.hp,r=sd(o,etat,n,...x);
 if(o&&!o.hero&&hp>0&&o.hp===0&&enCombatG()){const id=auteursEtats.get(o.id+'|'+etat),h=id&&actors.find(a=>a&&a.id===id);if(h&&h.hero)deGemme(h,'tuer-par-etat')}return r}}
// Une Maîtrise, ou un talent « une fois par combat » : son premier usage du combat.
{const pt=payeTalent;payeTalent=function(ctx,...x){const r=pt(ctx,...x);const a=ctx&&ctx.a,t=ctx&&ctx.talent;
 if(a&&a.hero&&t&&t.id&&enCombatG()&&(t.type==='mait'||(typeof limiteTalent==='function'&&limiteTalent(t)==='combat')||/une fois par combat/i.test(String(t.effects||'')))){
  const s=suiviGemmes(a);if(!s.talentsCombat||typeof s.talentsCombat!=='object')s.talentsCombat={};if(s.talentsCombat[t.id]!==numeroCombat){s.talentsCombat[t.id]=numeroCombat;deGemme(a,'maitrise-unique')}}
 return r}}
// Sortir du coma, pendant le combat : à celui qui se relève, et à celui qui l'a soigné.
function releve(o){if(!o||!o.hero||!enCombatG())return;deGemme(o,'relever-coma');const h=(typeof talentEnCours!=='undefined'&&talentEnCours&&talentEnCours.a)||actors[selected];if(h&&h.hero&&h!==o&&alive(h))deGemme(h,'relever-coma')}
{const ah=applyHeal;applyHeal=function(o,...x){const coma=!!o&&(o.hp<=0||hasState(o,'Coma')),g=ah(o,...x);if(coma&&g>0&&o.hp>0)releve(o);return g}}
{const ss=setState;setState=function(o,etat,mis,...x){const avant=!!o&&etat==='Coma'&&!mis&&hasState(o,'Coma'),r=ss(o,etat,mis,...x);if(avant&&!hasState(o,'Coma')&&o.hp>0)releve(o);return r}}
// Repousser, attirer : à qui pousse ou tire. Le pas forcé ne compte ni pour « bouger le premier », ni pour « a agi ».
let forceEnCours=0;
{const rp=repousser;repousser=function(b,a,...x){forceEnCours++;let r;try{r=rp(b,a,...x)}finally{forceEnCours--}if(r&&a&&a.hero&&b&&hostiles(a,b)&&enCombatG())deGemme(a,'deplacement-force');return r}}
{const ra=rapprocher;rapprocher=function(b,a,...x){forceEnCours++;let r;try{r=ra(b,a,...x)}finally{forceEnCours--}if(r&&a&&a.hero&&b&&hostiles(a,b)&&enCombatG())deGemme(a,'deplacement-force');return r}}
// L'Armure gagnée.
{const da=donneArmure;donneArmure=function(a,n,...x){const r=da(a,n,...x);if(a&&a.hero&&Math.trunc(Number(n))>0&&enCombatG())deGemme(a,'gain-armure');return r}}
// Le premier pas, le premier tir du tour ; les adversaires qui ont déjà agi.
let bougeTour='',tirTour='';const agisTour=new Map();
const aAgi=o=>!!o&&agisTour.get(o.id)===cleTour();
{const am=afterMove;afterMove=function(a,...x){const r=am(a,...x);if(a&&!forceEnCours&&enCombatG()){const k=cleTour();if(!a.hero)agisTour.set(a.id,k);
  if(bougeTour!==k){bougeTour=k;if(a.hero)deGemme(a,'bouger-premier')}}return r}}
{const ac=gemmesApresCoup;gemmesApresCoup=function(a,b,r,hpAvant,lost,...x){
 if(a&&b&&r&&enCombatG()){const k=cleTour(),touche=!r.failed&&!!r.hit,aDistance=!r.orbe&&typeof rangeOf==='function'&&rangeOf(a)==='distance';
  if(a.hero&&hostiles(a,b)){
   if(aDistance&&tirTour!==k){tirTour=k;if(!aAgi(b))deGemme(a,'tir-premier')}
   if(hpAvant>0&&hpAvant>=(Number(b.max)||Infinity)&&b.hp===0)deGemme(a,'tuer-pv-max')}
  if(b.hero&&hostiles(a,b)&&touche&&(Number(r.damage)||0)>0&&!(lost>0)&&b.hp>0)deGemme(b,'absorber-armure');
  if(!a.hero)agisTour.set(a.id,k)}
 return ac(a,b,r,hpAvant,lost,...x)}}
{const en=encaisse;encaisse=function(o,n,de,...x){const hp=o&&o.hp,r=en(o,n,de,...x),s=de===undefined?(typeof auteurCoup!=='undefined'?auteurCoup:null):de;
 if(s&&s.hero&&o&&!o.hero&&hp>0&&hp>=(Number(o.max)||Infinity)&&o.hp===0&&enCombatG()&&hostiles(s,o))deGemme(s,'tuer-pv-max');return r}}
// La fin du tour : sous un quart de ses PV, debout.
{const ts=tourSuivant;tourSuivant=function(...x){if(enCombatG()&&!(typeof spectateur==='function'&&spectateur()))actors.forEach(a=>{if(a&&a.hero&&!a.horsCarte&&alive(a)&&!estMort(a)&&a.hp>0&&a.hp<.25*(Number(a.max)||0))deGemme(a,'fin-tour-bas-pv')});return ts(...x)}}
