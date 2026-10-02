/* Conventions provisoires de résolution, détaillées dans l'interface. */
(function(root){
/* Résolution d'une attaque.
   « faille » ajoute un dé rose : il ne blesse jamais, mais tous les dés qui tombent sur
   sa valeur sortent du compte des dégâts. « bleed » est la saignée de la cible, qui
   s'ajoute à tout coup qui passe. */
/* « doublesCritiques » : Destructeur — n'importe quel double vaut un critique, pas
   seulement deux 6 ; un double 1 reste un échec, il est jugé avant. */
function resolveAttack({dice,def,dmg,round=1,criticalColor=0,roll,faille=false,bleed=0,doublesCritiques=false,solidite=false,sansEchec=false,sansCritique=false}){
 const all=dice.map(d=>[...d]);
 if(!all.length||all.some(([v,c])=>!Number.isInteger(v)||v<1||v>6||![0,1,2,3,5,6].includes(c)))throw Error('Réserve offensive invalide');
 /* Un dé d'os qui double avec un autre dé lancé s'en va d'abord, avant tout le reste :
    il ne compte ni pour l'échec, ni pour le critique, ni pour les dégâts. Un 6 d'os et
    un 6 blanc ne font donc pas de critique — l'os est parti avant qu'on les compte. */
 const faces0={};all.forEach(([v])=>faces0[v]=(faces0[v]||0)+1);
 const vifs=all.filter(([v,c])=>!(c===1&&faces0[v]>1));
 // Dominateur : contre un adversaire au sol, le double 1 n'est pas un échec.
 if(!sansEchec&&vifs.filter(([v,c])=>v===1&&c!==5).length>=2)return {dice:all,failleFace:null,bleed:0,damage:0,failed:true,critical:false};
 const faces={};vifs.forEach(([v])=>faces[v]=(faces[v]||0)+1);
 // « sansCritique » : un orbe ne fait pas de critique, sauf amélioration (Orbes critiques).
 const critical=!sansCritique&&(faces[6]>=2||(doublesCritiques&&Object.keys(faces).some(v=>Number(v)!==1&&faces[v]>=2)));
 if(critical){if(!vifs.some(([,c])=>c===criticalColor))throw Error('Couleur critique absente');let v;let count=0;do{v=roll();all.push([v,criticalColor]);vifs.push([v,criticalColor]);if(++count>=100&&v===6)throw Error('Limite de relances atteinte, attaque non appliquée');}while(v===6)}
 const failleFace=faille?roll():null;
 const kept=vifs.filter(([v])=>v!==failleFace);const remaining={};kept.forEach(([v])=>remaining[v]=(remaining[v]||0)+1);
 /* La DEF écarte les dés : un dé dont la face est égale ou inférieure à sa valeur ne compte
    pas. Le Lourd (rouge) et le Mortel (noir) passent toujours ; sous Solidité, le Lourd la
    subit comme les autres. Sans un dé qui passe, pas de coup : ni bonus, ni saignée. */
 const seuil=defPlafonnee(def);let damage=0,hit=false;
 kept.forEach(d=>{if(!passeDef(d,seuil,solidite))return;const [v,c]=d;hit=true;damage+=v*(c===3&&remaining[v]>1?2:c===6?Math.min(3,Math.max(1,round)):1)});
 const saignee=hit?Math.max(0,Math.trunc(bleed)||0):0;
 return {dice:all,failleFace,bleed:saignee,damage:damage+(hit?dmg:0)+saignee,failed:false,critical,hit};
}
/* La DEF va de 0 à 6 : à 6, plus aucune face ne la passe, seuls le Lourd et le Mortel. */
const DEF_MAX=6;
function defPlafonnee(def){return Math.max(0,Math.min(DEF_MAX,Math.trunc(Number(def))||0))}
function passeDef([v,c],def,solidite=false){return c===5||(c===2&&!solidite)||v>defPlafonnee(def)}
/* Portée : le rayon de contact vaut 3 tailles de token en diamètre. Les positions
   sont en pourcentage de la carte, converties en pixels avec sa taille affichée. */
function mapPoint(a,size){return [a.x/100*size.width,a.y/100*size.height]}
function contactRadius(token){return token*3/2}
/* La taille d'un socle. Le petit valait la moitié du moyen : c'était un quart de sa
   surface, et l'illustration n'y survivait pas. Aux sept dixièmes il reste franchement
   plus petit — on ne s'y trompe pas côte à côte — mais on voit encore qui il est. Grand
   et énorme existaient dans les fiches sans jamais rien changer au dessin ; ils comptent
   enfin. Tout ce qui mesure une portée prend le socle de celui qu'il mesure. */
const SOCLE_TAILLES={small:.7,medium:1,large:1.5,huge:2};
function socleFacteur(a){return SOCLE_TAILLES[a&&a.socle]||1}
function tokenDistance(a,b,size){const [ax,ay]=mapPoint(a,size),[bx,by]=mapPoint(b,size);return Math.hypot(bx-ax,by-ay)}
// Le socle de la cible doit toucher le disque, pas seulement son centre y tomber.
// « token » est le socle de celui qui tend le bras, « cible » celui qu'il cherche à toucher.
function inContact(a,b,size,token,cible){return tokenDistance(a,b,size)<=contactRadius(token)+(cible||token)/2}
// Ligne de vue : segment entre les deux tokens ; un combattant traversé la bloque.
function sightBlockers(a,b,others,size,token){const [ax,ay]=mapPoint(a,size),[bx,by]=mapPoint(b,size);const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy,r=token/2;
 return others.filter(o=>{const [ox,oy]=mapPoint(o,size);const t=len2?Math.max(0,Math.min(1,((ox-ax)*dx+(oy-ay)*dy)/len2)):0;return Math.hypot(ox-(ax+t*dx),oy-(ay+t*dy))<r})}
function hasLineOfSight(a,b,others,size,token){return sightBlockers(a,b,others,size,token).length===0}
// Croisement de deux segments par orientation. Invariant par mise à l'échelle des axes :
// murs et combattants sont comparés en pourcentages de carte, sans passer par les pixels.
function crosses(p,q,r,s){const side=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const d1=side(p,q,r),d2=side(p,q,s),d3=side(r,s,p),d4=side(r,s,q);
 return d1!==0&&d2!==0&&d3!==0&&d4!==0&&(d1>0)!==(d2>0)&&(d3>0)!==(d4>0)}
// Un segment franchit-il un côté de polygone ? Sert à la vue comme au déplacement.
/* Un obstacle est une forme : une liste de contours, la matière étant définie par la
   règle pair-impair. Un creux est donc un contour comme un autre. Un polygone simple
   reste accepté tel quel, ce qui laisse tout le code d'avant valable. */
function contoursOf(s){return Array.isArray(s)?[s]:(s&&s.contours)||[]}
function shapeContains(s,p){let dedans=false;
 for(const c of contoursOf(s))if(pointInPolygon(p,c))dedans=!dedans;
 return dedans}
function segmentHitsPolys(p,q,shapes){return (shapes||[]).some(s=>contoursOf(s).some(poly=>
 poly.some((pt,i)=>crosses(p,q,pt,poly[(i+1)%poly.length]))))}
// walls : polygones fermés en pourcentages de carte. Un côté traversé coupe la vue.
function wallsBetween(a,b,walls){return segmentHitsPolys([a.x,a.y],[b.x,b.y],walls)}
/* Équipement : l'arme confère les dés, l'armure la DEF. Renvoient null quand rien
   n'est équipé, pour laisser les valeurs propres du combattant (monstres). */
const DICE_KEYS=['white','bone','red','blue','green','black','yellow'];
function gearOf(ids,items){return (ids||[]).filter(Boolean).map(id=>(items||[]).find(w=>w&&w.id===id)).filter(Boolean)}
function equippedPool(actor,items){const worn=gearOf(actor&&actor.weapons,items);if(!worn.length)return null;
 return DICE_KEYS.map(k=>Math.min(12,worn.reduce((sum,w)=>sum+(Number(w.dice&&w.dice[k])||0),0)))}
function equippedRanged(actor,items){const worn=gearOf(actor&&actor.weapons,items);return worn.length?worn.some(w=>w.ranged===true):null}
/* ---------- Les emplacements d'équipement ----------
   Ce qu'un corps peut porter, et combien de chaque : deux mains pour les armes et le
   bouclier, puis un torse, un dos, une tête, trois anneaux, une amulette et des bottes.
   Une cape et une armure se portent donc ensemble ; deux armures, jamais. */
const MAINS_MAX=2;
const EMPLACEMENTS=[['torse','Torse',1],['dos','Dos',1],['tete','Tête',1],
 ['anneau','Anneaux',3],['amulette','Amulette',1],['bottes','Bottes',1]];
const NOM_EMPLACEMENT=s=>s==='shield'?'Bouclier':(EMPLACEMENTS.find(([k])=>k===s)||[])[1]||'';
function placesEmplacement(s){const e=EMPLACEMENTS.find(([k])=>k===s);return e?e[2]:0}
/* Où se porte une pièce : à l'emplacement qu'elle nomme, au torse à défaut — c'est là que
   se rangent les armures d'avant les emplacements — et aux mains pour un bouclier. */
function emplacementDe(o){if(!o||o.category!=='armor')return '';
 if(o.slot==='shield')return 'shield';
 const s=String(o.slot||'').trim();
 return EMPLACEMENTS.some(([k])=>k===s)?s:'torse'}
/* Ce qu'un combattant porte, hors mains : une liste, car les emplacements se cumulent. Une
   fiche d'avant les emplacements n'avait qu'une armure — on la lit comme une liste d'une. */
function armuresDe(a){const l=a&&a.armures;
 if(Array.isArray(l))return l.filter(Boolean);
 return a&&a.armorId?[a.armorId]:[]}
// Ce qui occupe un emplacement donné, dans l'ordre où cela a été mis.
function portesA(a,slot,items){return armuresDe(a).filter(id=>emplacementDe((items||[]).find(o=>o&&o.id===id))===slot)}
// Les places qui restent à un emplacement : zéro quand il est plein.
function placesLibres(a,slot,items){return Math.max(0,placesEmplacement(slot)-portesA(a,slot,items).length)}
function equippedDef(actor,items){const worn=gearOf(actor&&[...armuresDe(actor),actor&&actor.shieldId],items);
 return worn.length?worn.reduce((sum,w)=>sum+(Number(w.def)||0),0):null}
/* Porter une arme, c'est savoir s'en servir — adversaires compris. L'équipement ne
   fait donc plus taire la fiche : il ajoute une attaque de plus, à côté des crocs, des
   griffes et des souffles, et c'est le joueur qui choisit laquelle part. Les armes
   portées se cumulent en une seule attaque, comme depuis la v0.30, la même arme en
   double comptant deux fois (v0.69).
   L'attaque d'équipement vient en tête : une fiche enregistrée avant ce choix a
   « activeAttack » à zéro, et retrouve ainsi l'arme qui décidait pour elle. */
/* Une arme à deux mains s'emploie seule : elle vaut donc une attaque à elle. Les armes
   à une main se tiennent ensemble et n'en font qu'une, dés cumulés — et deux exemplaires
   du même modèle cumulent aussi les leurs (v0.69). Une arme à distance se tient toujours
   à deux mains : rapière et arc court sont deux boutons, l'un au contact, l'autre au loin. */
/* Une arme à distance se tient à deux mains ; une arme de contact à une main, sauf si sa fiche
   dit deux. Sans précision, une main — comme l'affichent le formulaire et la bulle : l'écart
   faisait passer pour une arme à deux mains une épée qu'on lisait « 1 main », et elle chassait
   le bouclier. */
function weaponHands(w){return w&&w.ranged===true?2:(Number(w&&w.hands)===2?2:1)}
function poolOfWeapons(armes){const dice={};
 DICE_KEYS.forEach(k=>dice[k]=Math.min(12,armes.reduce((somme,w)=>somme+(Number(w.dice&&w.dice[k])||0),0)));
 return dice}
/* Ce qu'une arme pose sur qui elle touche. Deux armes en main, deux états : la liste
   sans doublon de ce que le coup inflige. */
const etatsDArmes=armes=>[...new Set((armes||[]).map(w=>w&&w.etat).filter(Boolean))];
function gearAttacks(actor,items){
 // Seule une arme frappe : un objet rangé là par erreur ne crée pas une attaque sans dés.
 const armes=gearOf(actor&&actor.weapons,items).filter(w=>w.category==='weapon');
 if(!armes.length)return [];
 /* Les armes d'une même portée font une seule attaque : dés cumulés, un seul bouton, le
    nom les énumère, et les logos sont ceux des armes du lot qui en ont un — deux au plus,
    que le bouton croise. Contact et distance ne se cumulent pas : une épée et un arc font
    deux boutons, le contact d'abord. */
 /* La munition portée sert les armes à distance : un dé de plus, de sa couleur, et l'état
    qu'elle inflige. Le contact n'en a que faire. */
 const mun=actor&&actor.munitionId?gearOf([actor.munitionId],items).find(m=>m.category==='ammo')||null:null;
 const attaque=(lot,range,sansMunition)=>{const groupes=new Map();lot.forEach(w=>groupes.set(w,(groupes.get(w)||0)+1));
  const tire=range==='distance'&&mun&&!sansMunition,dice=poolOfWeapons(lot);
  if(tire&&DICE_KEYS.includes(mun.munDe))dice[mun.munDe]=Math.min(12,(dice[mun.munDe]||0)+1);
  const etats=[...new Set([...etatsDArmes(lot),...(tire&&mun.etat?[mun.etat]:[])])];
  return {name:[...groupes].map(([w,n])=>w.name+(n>1?' ×'+n:'')).join(' + ')+(tire?' · '+mun.name:''),dice,range,
   targets:'one',useOwnDamage:true,effects:{},etats,logos:lot.filter(w=>w.logo).map(w=>String(w.logo)).slice(0,2),gear:true,munition:tire?mun.id:null}};
 const contact=armes.filter(w=>w.ranged!==true),distance=armes.filter(w=>w.ranged===true&&w.lancer!==true);
 /* Une arme de lancer a son bouton à elle, sans munition : lancée au loin, ou maniée au contact — la table
    tranche selon la cible. « lancer » dit laquelle part. */
 const lancers=[...new Set(armes.filter(w=>w.ranged===true&&w.lancer===true))],lance=w=>({...attaque([w],'distance',true),lancer:w.id});
 /* Un adversaire porte tout ce qu'il possède, sans compter ses mains : chaque arme est une
    variante, son bouton à elle, et une arme en double ne frappe pas deux fois. */
 if(actor&&actor.hero===false)return [...new Set(contact)].map(w=>attaque([w],'contact')).concat([...new Set(distance)].map(w=>attaque([w],'distance')),lancers.map(lance));
 const sorties=[];if(contact.length)sorties.push(attaque(contact,'contact'));if(distance.length)sorties.push(attaque(distance,'distance'));
 lancers.forEach(w=>sorties.push(lance(w)));
 return sorties}
/* Une attaque de fiche — l'attaque spéciale d'un adversaire — peut poser une affliction,
   tout comme une arme. On lui donne la même forme qu'à une attaque d'équipement, « etats »,
   pour que le moteur n'ait pas à connaître deux façons de dire la même chose. */
function attackChoices(actor,items){
 return gearAttacks(actor,items).concat((actor&&actor.attacks||[])
  .map(at=>at&&at.etat&&!at.etats?{...at,etats:[at.etat]}:at))}
/* L'attaque retenue, quoi qu'il arrive : un choix devenu caduc — l'arme retirée, une
   attaque effacée — retombe sur la première offerte plutôt que sur rien du tout. */
function chosenAttack(actor,items){const liste=attackChoices(actor,items);
 if(!liste.length)return {range:'contact',useOwnDamage:true,dice:null};
 const i=Math.trunc(actor&&actor.activeAttack)||0;
 return liste[i>=0&&i<liste.length?i:0]}
/* La DEF d'un aventurier est ce que porte son armure et son bouclier, zéro compris :
   elle ne se saisit jamais à la main. Celle d'un adversaire lui est propre — écailles,
   cuir épais — et son équipement s'y ajoute s'il en porte. */
/* Un adversaire qui porte une armure tire sa DEF d'elle seule : c'est l'armure qui dit
   ce qu'il encaisse, et son chiffre propre — écailles, cuir épais — ne s'y ajoute plus.
   Sans armure, ce chiffre fait foi : c'est celui d'un ours. Un aventurier n'a jamais eu
   de DEF propre : la sienne est toujours celle de ce qu'il porte, zéro compris. */
function defenseOf(actor,items){const porte=equippedDef(actor,items);
 if(actor&&actor.hero)return porte||0;
 return porte===null||porte===undefined?(Number(actor&&actor.def)||0):porte}
/* Un passage secret est un mur pour la troupe tant qu'il est clos : il ne se dessine
   pas et le MJ seul le manœuvre. Ouvert, ce n'est plus qu'une porte — visible de tous
   et refermable par qui l'atteint, comme n'importe quelle autre. */
/* Un passage secret découvert (« decouvert ») par un test de Perception devient une porte comme une autre. */
function doorHiddenFrom(d,estMJ){return !!(d&&d.secret&&!d.open&&!d.decouvert&&!estMJ)}
function doorLockedFor(d,estMJ){return !estMJ&&!!(d&&(d.keyLocked||(d.secret&&!d.open&&!d.decouvert)))}
/* Déplacement : le socle est un disque repoussé hors des murs. Le mouvement restant
   subsiste le long de l'obstacle, ce qui produit le glissement. */
function closestOnSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
 const t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2)):0;return [a[0]+t*dx,a[1]+t*dy]}
function pointInPolygon(p,poly){let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];
  if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside}return inside}
/* ---------- Les socles occupent la place ----------
   Un combattant vivant tient sa place sur le plateau : on ne finit jamais à cheval sur lui,
   et le camp d'en face barre le passage — comme la matière. Un corps à zéro point de vie ne
   tient plus rien : on lui passe dessus et on s'y arrête. Les socles sont donnés en pixels
   de carte, {x,y,r}, et « r » est le rayon de celui qui bouge. */
/* Écarter un point des socles qu'il chevauche : juste assez pour que les deux se touchent
   sans se couvrir, en s'éloignant du centre. Quelques passes, car sortir de l'un peut
   entrer dans l'autre ; deux centres confondus partent vers la droite, faute de direction. */
function ecarteDesSocles(p,cercles,r){let x=p[0],y=p[1];
 for(let pass=0;pass<4;pass++){let touche=false;
  for(const c of cercles||[]){if(!c)continue;
   const dx=x-c.x,dy=y-c.y,d=Math.hypot(dx,dy),min=r+c.r;
   if(d>=min-1e-9)continue;
   const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0;
   x=c.x+nx*min;y=c.y+ny*min;touche=true}
  if(!touche)break}
 return [x,y]}
/* Le point tombe-t-il sur un socle ? Vrai dès que les deux se couvriraient. La marge laisse
   passer celui qui s'arrête pile au bord : il touche, il ne recouvre pas. */
function dansUnSocle(p,cercles,r,marge=.5){
 return (cercles||[]).some(c=>c&&Math.hypot(p[0]-c.x,p[1]-c.y)<r+c.r-marge)}
/* Un pas qui traverse un socle : le segment passe sous les deux rayons réunis. La marge
   laisse longer un socle sans s'y coller — un point posé pile au bord ne se bloque pas
   lui-même. */
function segmentCoupeSocles(p,q,cercles,r,marge=.5){const seuil=(c)=>r+c.r-marge;
 return (cercles||[]).some(c=>{if(!c)return false;
  const proche=closestOnSegment([c.x,c.y],p,q);
  return Math.hypot(c.x-proche[0],c.y-proche[1])<seuil(c)})}
/* Où poser un socle pour qu'il ne couvre ni la matière ni un autre : on écarte, on remet
   hors des murs, et on recommence tant que l'un défait l'autre — trois passes suffisent,
   et dans un couloir trop étroit c'est le mur qui l'emporte. */
function poserHorsDesSocles(p,cercles,shapes,r){let q=p;
 for(let pass=0;pass<3;pass++){const avant=q;
  q=slideOutOfWalls(ecarteDesSocles(q,cercles,r),shapes,r);
  if(Math.abs(q[0]-avant[0])<.01&&Math.abs(q[1]-avant[1])<.01)break}
 return q}
function slideOutOfWalls(p,shapes,r){let x=p[0],y=p[1];
 for(let pass=0;pass<4;pass++){let touched=false;
  for(const s of shapes||[]){const contours=contoursOf(s).filter(c=>c&&c.length>=3);
   if(!contours.length)continue;
   // Le point de bord le plus proche, tous contours confondus : un creux compte comme un bord.
   let best=null,bd=Infinity;
   for(const poly of contours)for(let i=0;i<poly.length;i++){
    const c=closestOnSegment([x,y],poly[i],poly[(i+1)%poly.length]);const d=Math.hypot(x-c[0],y-c[1]);
    if(d<bd){bd=d;best=c}}
   const inside=shapeContains(s,[x,y]);
   if(!inside&&bd>=r)continue;
   let nx=0,ny=-1;
   if(bd>1e-6){nx=(x-best[0])/bd;ny=(y-best[1])/bd;if(inside){nx=-nx;ny=-ny}}
   x=best[0]+nx*r;y=best[1]+ny*r;touched=true}
  if(!touched)break}
 return [x,y]}
/* Cartes de combat : les zones de blocage sont des rectangles en pourcentages.
   Une porte ouverte ne bloque plus rien, ni la vue ni le passage. */
function rectPolygon(r){return [[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]]}
/* Un trait de blocage : deux points et une épaisseur. Ce n'est pas un rectangle aligné
   sur les axes — une cloison en biais n'en est pas un —, il vit donc à part, comme une
   forme à quatre sommets. L'épaisseur se compte en pour cent de la largeur de la carte et
   reste constante à l'écran quel que soit le rapport de celle-ci : la normale est prise
   dans le repère de l'écran, puis ramenée en pour cent. */
const TRAIT_EPAISSEUR=.3;
function traitPolygon(t,ratio){if(!t)return null;
 const r=Math.max(.05,Number(ratio)||16/9);
 const sx=(t.x2-t.x1)*r,sy=t.y2-t.y1,L=Math.hypot(sx,sy);
 if(!(L>1e-6))return null;
 const e=Math.max(.05,Number(t.e)||TRAIT_EPAISSEUR)/2;
 const hx=-sy/L*e,hy=sx/L*e*r;
 return [[t.x1+hx,t.y1+hy],[t.x2+hx,t.y2+hy],[t.x2-hx,t.y2-hy],[t.x1-hx,t.y1-hy]]}
/* Recalage des cartes tracées quand l'éditeur réduisait l'image dans son cadre :
   les positions enregistrées étaient comprimées vers le centre. On inverse. */
// La même correction, point par point, pour les anneaux de la matière.
function uncontainPoints(pts,frameRatio,imageRatio){let sx=1,sy=1;
 if(imageRatio<frameRatio)sx=imageRatio/frameRatio;else sy=frameRatio/imageRatio;
 const ox=(1-sx)/2*100,oy=(1-sy)/2*100;
 return (pts||[]).map(([x,y])=>[(x-ox)/sx,(y-oy)/sy])}
function uncontain(shapes,frameRatio,imageRatio){
 let sx=1,sy=1;
 if(imageRatio<frameRatio)sx=imageRatio/frameRatio;else sy=frameRatio/imageRatio;
 const ox=(1-sx)/2*100,oy=(1-sy)/2*100;
 return (shapes||[]).map(r=>{const o={...r};o.x=(r.x-ox)/sx;o.y=(r.y-oy)/sy;
  if(typeof r.w==='number')o.w=r.w/sx;if(typeof r.h==='number')o.h=r.h/sy;return o})}
// Trois points alignés : celui du milieu ne dit rien, on l'enlève.
function fuseAligned(pts){const out=[];
 for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
  const d=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(d)>1e-12)out.push(b)}
 return out.length>=3?out:pts}
/* Douglas-Peucker à seuil fixe ne distingue pas un tremblement d'une courbe : pour
   redresser un trait tracé à la main il faut un seuil plus large que le tremblement, et
   ce même seuil rabote alors les courbes voulues. Or les deux ne se ressemblent que de
   près : le tremblement de la main garde toujours la même amplitude, quelle que soit la
   longueur du geste, tandis que le ventre d'une courbe grandit avec elle. On juge donc
   l'écart *relativement à la corde qui le porte* — un demi-pourcent de travers sur un
   long trait est un tremblement, le même écart sur une corde courte est une courbe. Le
   seuil reste borné des deux côtés : jamais plus fin que le quart du seuil demandé,
   jamais plus large que son double. Sans proportion donnée, le seuil fixe d'origine. */
function simplifyClosed(pts,tol,relatif){
 if(!pts||pts.length<4||!(tol>0))return pts;
 let loin=0,dmax=-1;
 for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]);
  if(d>dmax){dmax=d;loin=i}}
 const garde=new Uint8Array(pts.length);garde[0]=1;garde[loin]=1;
 const pile=[[0,loin],[loin,pts.length]];
 while(pile.length){const [i,j]=pile.pop();const fin=j===pts.length?0:j;
  const corde=Math.hypot(pts[fin][0]-pts[i][0],pts[fin][1]-pts[i][1]);
  const seuil=relatif>0?Math.min(tol*2,Math.max(tol*.18,relatif*corde)):tol;
  let best=-1,bd=seuil;
  for(let k=i+1;k<j;k++){const c=closestOnSegment(pts[k],pts[i],pts[fin]);
   const d=Math.hypot(pts[k][0]-c[0],pts[k][1]-c[1]);
   if(d>bd){bd=d;best=k}}
  if(best>=0){garde[best]=1;pile.push([i,best],[best,j])}}
 const out=pts.filter((_,i)=>garde[i]);
 return out.length>=3?out:pts}
/* Export et import des couches d'une carte : matière de blocage, portes, zone de départ,
   adversaires pré-placés. Le même nettoyage sert dans les deux sens — ce qui sort est
   déjà propre, ce qui entre le devient. Rien de ce qui vient d'un fichier n'est cru sur
   parole : nombres bornés, textes coupés, image vérifiée. Un fichier d'avant, fait de
   rectangles et de traits, est fondu en matière à la lecture. */
const MAP_FORMAT='amertume-cartes';
const IMAGE_RE=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function borne(v,min=-1,max=101){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0}
function cleanRect(r,porte){if(!r)return null;
 const o={x:borne(r.x),y:borne(r.y),w:borne(r.w,0,102),h:borne(r.h,0,102)};
 if(!(o.w>0&&o.h>0))return null;
 if(r.locked)o.locked=true;
 if(porte){o.open=false;if(r.keyLocked)o.keyLocked=true;if(r.secret)o.secret=true;
  // La clé qui l'ouvre, une pièce de l'armurerie de la catégorie Clés.
  if(r.cleId)o.cleId=texte(r.cleId,60);
  // Les réussites de Perception qu'il faut pour trouver un passage secret.
  if(r.secret&&Number(r.perception)>1)o.perception=Math.min(9,Math.trunc(Number(r.perception)));
  // L'angle d'une porte de biais voyage avec elle ; une porte droite n'en porte pas.
  const a=Number(r.a);if(Number.isFinite(a)&&((a%180)+180)%180!==0)o.a=((a%180)+180)%180}
 return o}
function cleanRects(list,porte){return (Array.isArray(list)?list:[]).map(r=>cleanRect(r,porte)).filter(Boolean).slice(0,2000)}
function texte(v,n=200){return String(v==null?'':v).slice(0,n)}
function cleanMonster(t){const dés={};
 for(const k of DICE_KEYS)dés[k]=Math.max(0,Math.min(12,Math.round(borne(t&&t.dice&&t.dice[k],0,12))));
 const attaques=(Array.isArray(t&&t.attacks)?t.attacks:[]).slice(0,6).map(a=>{const d={};
  for(const k of DICE_KEYS)d[k]=Math.max(0,Math.min(12,Math.round(borne(a&&a.dice&&a.dice[k],0,12))));
  const o={name:texte(a&&a.name,100)||'Attaque',dice:d,range:a&&a.range==='distance'?'distance':'contact',
   targets:a&&a.targets==='all'?'all':'one',useOwnDamage:!(a&&a.useOwnDamage===false)};
  // Plusieurs états se gardent tous ; l'état unique d'avant reste lu.
  const etats=[...new Set((Array.isArray(a&&a.etats)?a.etats:[a&&a.etat]).filter(e=>ETATS_JEU.includes(e)))].slice(0,6);
  if(etats.length){o.etats=etats;o.etat=etats[0]}
  return o});
 return {name:texte(t&&t.name,120)||'Adversaire',type:['standard','solitaire','boss'].includes(t&&t.type)?t.type:'standard',
  socle:texte(t&&t.socle,20)||'medium',family:texte(t&&t.family,60),
  pv:Math.round(borne(t&&t.pv,0,9999))||1,def:Math.round(borne(t&&t.def,0,DEF_MAX)),
  damage:Math.round(borne(t&&t.damage,0,999)),xp:Math.round(borne(t&&t.xp,0,9999)),
  menace:texte(t&&t.menace,30)||'closest',esquive:!!(t&&t.esquive),rapide:!!(t&&t.rapide),
  /* Un adversaire peut n'avoir aucune attaque : c'est au maître du jeu d'en décider, et
     un monstre qui ne frappe pas est un monstre comme un autre. Un modèle d'avant, qui
     portait ses dés à la racine sans liste d'attaques, garde pourtant les siens —
     sinon il les perdrait sans rien dire. */
  notes:texte(t&&t.notes,2000),
  attacks:attaques.length||Array.isArray(t&&t.attacks)||!DICE_KEYS.some(k=>dés[k]>0)?attaques
   :[{name:'Attaque',dice:dés,range:'contact',targets:'one',useOwnDamage:true}]}}
function cleanAnneau(r){return (Array.isArray(r)?r:[]).slice(0,4000).map(p=>[borne(p&&p[0]),borne(p&&p[1])])}
function cleanMatiere(list){return (Array.isArray(list)?list:[]).slice(0,600).map(p=>{
 const anneaux=(Array.isArray(p&&p.anneaux)?p.anneaux:[]).slice(0,200).map(cleanAnneau).filter(r=>r.length>=3);
 if(!anneaux.length)return null;const o={anneaux};if(p&&p.verrou)o.verrou=true;return o}).filter(Boolean)}
function cleanTraits(list){return (Array.isArray(list)?list:[]).slice(0,600).map(t=>({x1:borne(t&&t.x1),y1:borne(t&&t.y1),
 x2:borne(t&&t.x2),y2:borne(t&&t.y2),e:Math.max(.05,Math.min(5,Number(t&&t.e)||TRAIT_EPAISSEUR))}))}
/* Un objet posé sur la carte : un coffre, un levier, un trésor sous une dalle. Un nom, une
   description que la troupe lira, des objets de l'armurerie à prendre, un trésor en
   toutes lettres ; visible, ou caché derrière un test de compétence — la compétence est
   un rang de la liste (Perception vaut 3), et il faut tant de réussites. */
const TAILLES_OBJET=['small','medium','large'];
function cleanObjet(o){const t=o&&o.test||{};
 return {id:texte(o&&o.id,40),nom:texte(o&&o.nom,60)||'Objet',desc:texte(o&&o.desc,600),
  x:borne(o&&o.x,0,100),y:borne(o&&o.y,0,100),taille:TAILLES_OBJET.includes(o&&o.taille)?o.taille:'medium',
  visible:!(o&&o.visible===false),
  // Récupéré par un aventurier : il reste hors de la carte jusqu'à ce qu'elle soit rechargée sur la table.
  ...(o&&o.pris===true?{pris:true}:{}),
  items:(Array.isArray(o&&o.items)?o.items:[]).filter(x=>typeof x==='string').slice(0,20).map(x=>texte(x,60)).filter(Boolean),
  tresor:texte(o&&o.tresor,200),
  test:{comp:Math.max(0,Math.min(7,Math.trunc(Number(t.comp))||0)),
   reussites:Math.max(1,Math.min(9,Math.trunc(Number(t.reussites))||1))}}}
/* Un coffre : un rectangle, comme une porte. Son nom et sa description ; caché (« cache »), un test de
   Perception de tant de réussites le révèle ; verrouillé (« verrou » : réussites de Ruse ou de Technique,
   0 s'il ne l'est pas) ; piégé (« piege » : de même), le piège infligeant des dégâts et des états à qui est
   au contact ; dedans, des pièces de l'armurerie, de l'or et des gemmes. Ce qui lui arrive en partie —
   révélé, déverrouillé, désamorcé, ouvert — ne voyage pas avec la carte. */
function cleanCoffre(c){const r=cleanRect(c);if(!r)return null;const n=(v,max)=>Math.max(0,Math.min(max,Math.trunc(Number(v))||0));
 const a=Number(c.a);if(Number.isFinite(a)&&((a%180)+180)%180!==0)r.a=((a%180)+180)%180;if(c.rond===true)r.rond=true;if(c.cleId)r.cleId=texte(c.cleId,60);
 const rich={};if(c.richesses&&typeof c.richesses==='object')CLES_RICHESSES.forEach(k=>{const v=n(c.richesses[k],99999);if(v)rich[k]=v});
 return {...r,id:texte(c.id,40),nom:texte(c.nom,60)||'Coffre',desc:texte(c.desc,600),...(c.cache===true?{cache:true}:{}),
  perception:Math.max(1,n(c.perception,9)),verrou:n(c.verrou,9),piege:n(c.piege,9),degats:n(c.degats,99),
  etats:(Array.isArray(c.etats)?c.etats:[]).filter(e=>ETATS_JEU.includes(e)).slice(0,8),
  items:(Array.isArray(c.items)?c.items:[]).filter(x=>typeof x==='string').slice(0,99).map(x=>texte(x,60)).filter(Boolean),richesses:rich}}
/* Ce qu'un adversaire posé porte en propre, en plus de son modèle — une clé, un message —, et la chance,
   pièce par pièce, que cela tombe à sa mort. */
function portePropre(f){const inv=(Array.isArray(f&&f.inventaire)?f.inventaire:[]).filter(x=>typeof x==='string').slice(0,30).map(x=>texte(x,60)).filter(Boolean);
 if(!inv.length)return {};const butin={};
 Object.entries(f.butin&&typeof f.butin==='object'?f.butin:{}).forEach(([id,v])=>{const n=Math.max(0,Math.min(100,Math.round(Number(v))||0));if(n&&inv.includes(id))butin[id]=n});
 return {inventaire:inv,...(Object.keys(butin).length?{butin}:{})}}
function cleanMap(m){const img=typeof (m&&m.image)==='string'&&IMAGE_RE.test(m.image)?m.image:null;
 const ratio=Math.max(.2,Math.min(6,Number(m&&m.ratio)||16/9));
 const matiere=Array.isArray(m&&m.matiere)?cleanMatiere(m.matiere)
  :migreMatiere({ratio,walls:cleanRects(m&&m.walls),visions:cleanRects(m&&m.visions),traits:cleanTraits(m&&m.traits)}).matiere;
 return {name:texte(m&&m.name,80)||'Carte',ratio,
  fitted:!(m&&m.fitted===false),image:img,
  matiere,doors:cleanRects(m&&m.doors,true),
  start:cleanRect(m&&m.start),
  foes:(Array.isArray(m&&m.foes)?m.foes:[]).slice(0,200).map(f=>({x:borne(f&&f.x),y:borne(f&&f.y),
   hidden:!!(f&&f.hidden),...(f&&f.cache===true?{cache:true}:{}),...(f&&typeof f.id==='string'&&f.id?{id:texte(f.id,40)}:{}),...portePropre(f),locked:!!(f&&f.locked),tpl:cleanMonster(f&&f.tpl)})),
  coffres:(Array.isArray(m&&m.coffres)?m.coffres:[]).slice(0,100).map(cleanCoffre).filter(Boolean),
  objets:(Array.isArray(m&&m.objets)?m.objets:[]).slice(0,200).map(cleanObjet),
  // Les zones que le MJ a séparées ou regroupées voyagent avec la carte.
  zonesCoupures:cleanSegments(m&&m.zonesCoupures),zonesLiens:cleanSegments(m&&m.zonesLiens),zonesNoms:cleanEtiquettes(m&&m.zonesNoms),
  // Le socle témoin voyage avec la carte : c'est lui qui dit à quelle échelle elle est tracée.
  echelle:{x:borne(m&&m.echelle&&m.echelle.x),y:borne(m&&m.echelle&&m.echelle.y),
   t:Math.max(.6,Math.min(40,Number(m&&m.echelle&&m.echelle.t)||100*46/810))}}}
function packMaps(maps){return {format:MAP_FORMAT,version:1,exporte:new Date().toISOString(),
 maps:(Array.isArray(maps)?maps:[]).map(cleanMap)}}
function readMapsFile(texteBrut){let data;
 try{data=JSON.parse(texteBrut)}catch(e){throw Error('Fichier illisible : ce n’est pas du JSON.')}
 if(!data||data.format!==MAP_FORMAT)throw Error('Ce fichier ne vient pas de l’éditeur de cartes d’Amertume.');
 if(!Array.isArray(data.maps)||!data.maps.length)throw Error('Aucune carte dans ce fichier.');
 return data.maps.slice(0,60).map(cleanMap)}
/* ====================================================================================
   LA MATIÈRE DE BLOCAGE : DES POLYGONES EXACTS
   ------------------------------------------------------------------------------------
   Une carte porte une seule couche de blocage — la matière — faite de polygones à trous,
   exacts au millième, sans grille ni trame. Chaque outil est une opération booléenne sur
   cette couche : bloquer, c'est unir la forme de l'outil à la matière ; découper, c'est
   l'en soustraire. La forme obtenue est donc exactement celle du geste — un rectangle
   reste un rectangle, une ligne en biais reste droite, un rond reste rond — et deux
   morceaux qui se touchent ne font plus qu'un polygone, sans couture ni marche.
   Les opérations booléennes viennent de polygon-clipping (Martinez-Rueda), chargé avant
   ce fichier dans la page, et requis ici sous Node pour les vérifications.
   Un polygone de matière : { anneaux:[extérieur, trou, trou…], verrou? }. Les anneaux
   sont ouverts (le dernier point ne répète pas le premier) et la matière se lit à la
   règle pair-impair, comme partout dans le moteur.
   ==================================================================================== */
const Clipper=typeof polygonClipping!=='undefined'?polygonClipping:require('./polygon-clipping.umd.min.js');
function anneauFerme(r){const n=r.length;
 return n&&(r[0][0]!==r[n-1][0]||r[0][1]!==r[n-1][1])?[...r,r[0]]:r}
function anneauOuvert(r){const n=r.length;
 return n>1&&r[0][0]===r[n-1][0]&&r[0][1]===r[n-1][1]?r.slice(0,n-1):r}
function versClip(polys){return (polys||[]).map(p=>(p&&p.anneaux||[]).filter(r=>r&&r.length>=3).map(anneauFerme)).filter(p=>p.length)}
/* Ce qui sort d'une opération est remis au propre : anneaux ouverts, sommets alignés fondus
   (la jonction de deux rectangles laisse un sommet au milieu d'un côté droit : il ne dit
   rien, on l'enlève sans déplacer le bord d'un iota), poussières d'aire nulle jetées. */
function depuisClip(mp){return (mp||[]).map(p=>({anneaux:p.map(r=>fuseAligned(anneauOuvert(r))).filter(r=>r.length>=3&&polygonArea(r)>1e-7)}))
 .filter(p=>p.anneaux.length)}
/* Un verrou tient une masse : si elle grandit par union, ou fond avec une autre, le
   polygone né de la fusion hérite du verrou de ce qu'il a absorbé. */
function garderVerrous(polys,avant){const verrous=(avant||[]).filter(p=>p.verrou).map(p=>versClip([p]));
 if(!verrous.length)return polys;
 return polys.map(p=>verrous.some(v=>Clipper.intersection(versClip([p]),v).length)?{...p,verrou:true}:p)}
function matiereDe(map){if(!map)return [];
 if(!Array.isArray(map.matiere))migreMatiere(map);
 return map.matiere}
/* Les cartes d'avant stockaient des rectangles, des traits, des découpes rastérisées et
   des zones de vision : on les fond une fois pour toutes en polygones exacts — l'union
   des rectangles et des traits, moins les zones de vision. Les crans que la trame y avait
   laissés restent tels quels : c'est la géométrie que la carte avait, il n'y a pas à
   l'inventer ; on la reprend à l'outil, qui désormais taille net. */
function migreMatiere(map){const r=Math.max(.05,Number(map.ratio)||16/9);
 const rects=(map.walls||[]).filter(w=>w&&w.w>0&&w.h>0);
 const morceaux=[...rects.map(w=>[[anneauFerme(rectPolygon(w))]]),
  ...(map.traits||[]).map(t=>traitPolygon(t,r)).filter(Boolean).map(p=>[[anneauFerme(p)]])];
 let mp=morceaux.length?Clipper.union(...morceaux):[];
 const trous=(map.visions||[]).filter(v=>v&&v.w>0&&v.h>0).map(v=>[[anneauFerme(rectPolygon(v))]]);
 if(mp.length&&trous.length)mp=Clipper.difference(mp,...trous);
 const verrous=rects.filter(w=>w.locked).map(w=>({anneaux:[rectPolygon(w)],verrou:true}));
 map.matiere=garderVerrous(depuisClip(mp),verrous);
 delete map.walls;delete map.traits;delete map.carves;delete map.cuts;delete map.visions;
 return map}
/* Bloquer : la forme de l'outil rejoint la matière. Ce qui la touche fond avec elle en un
   seul polygone ; ce qui ne la touche pas devient un polygone à part. */
function ajouteMatiere(map,forme){const avant=matiereDe(map);
 if(!forme||forme.length<3)return avant;
 map.matiere=garderVerrous(depuisClip(Clipper.union(versClip(avant),[[anneauFerme(forme)]])),avant);
 return map.matiere}
/* Découper : la forme de l'outil est ôtée de la matière libre. Un polygone verrouillé
   résiste : la découpe passe à côté sans l'entamer. */
function retireMatiere(map,forme){const avant=matiereDe(map);
 if(!forme||forme.length<3)return avant;
 const libres=avant.filter(p=>!p.verrou),tenus=avant.filter(p=>p.verrou);
 if(!libres.length)return avant;
 map.matiere=[...tenus,...depuisClip(Clipper.difference(versClip(libres),[[anneauFerme(forme)]]))];
 return map.matiere}
/* Après un déplacement ou une mise à l'échelle, le polygone bougé peut en recouvrir un
   autre : on refond toute la matière pour qu'ils n'en fassent qu'un — et non un trou,
   comme le voudrait la règle pair-impair de deux contours superposés. */
function refondMatiere(map){const avant=matiereDe(map);if(avant.length<2)return avant;
 map.matiere=garderVerrous(depuisClip(Clipper.union(...avant.map(p=>versClip([p])))),avant);
 return map.matiere}
function polygoneContient(p,pt){return (p&&p.anneaux||[]).reduce((v,r)=>pointInPolygon(pt,r)?!v:v,false)}
// Le polygone de matière sous ce point, ou -1 : c'est lui qu'un clic désigne.
function matiereSous(map,pt){return matiereDe(map).findIndex(p=>polygoneContient(p,pt))}
function boitePolygone(p){const pts=(p&&p.anneaux&&p.anneaux[0])||[];if(!pts.length)return null;
 const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]);
 const x=Math.min(...xs),y=Math.min(...ys);
 return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}}
function transformePolygone(p,fn){return {...p,anneaux:p.anneaux.map(r=>r.map(q=>fn(q)))}}
function contoursMatiere(map){return matiereDe(map).flatMap(p=>p.anneaux)}
/* Le pinceau laisse une touche ronde à l'écran ; entre deux pas, une capsule qui relie les
   deux touches, pour que le geste soit continu. Tout se calcule dans le repère de l'écran
   (abscisse multipliée par le rapport de la carte) puis se ramène en pour cent : un rond
   reste rond, quel que soit le format de la carte. L'épaisseur, comme celle d'un trait,
   se compte en pour cent de la largeur. */
function capsulePolygon(a,b,e,ratio,n=12){const r=Math.max(.05,Number(ratio)||16/9),demi=Math.max(.02,e*r/2);
 const ax=a.x*r,ay=a.y,bx=b.x*r,by=b.y,dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy),pts=[];
 if(L<1e-9)for(let i=0;i<2*n;i++){const t=i/n*Math.PI;pts.push([ax+Math.cos(t)*demi,ay+Math.sin(t)*demi])}
 else{const ang=Math.atan2(dy,dx);
  for(let i=0;i<=n;i++){const t=ang+Math.PI/2+i/n*Math.PI;pts.push([ax+Math.cos(t)*demi,ay+Math.sin(t)*demi])}
  for(let i=0;i<=n;i++){const t=ang-Math.PI/2+i/n*Math.PI;pts.push([bx+Math.cos(t)*demi,by+Math.sin(t)*demi])}}
 return pts.map(([x,y])=>[x/r,y])}
/* La main tremble. Un glissement que l'on croit bien droit arrive en quarante points qui
   serpentent d'un tiers de pourcent ; comme la découpe suit désormais le tracé au sommet
   près, ce tremblement ressortirait en dents. On redresse donc l'encre avant de s'en
   servir. Le seuil est fin — moins d'un demi pour cent —, et proportionné à la corde :
   les angles voulus, eux, dépassent largement le seuil et tiennent bon. */
const ENCRE_TOL=.44,ENCRE_PART=.012;
function encreDroite(carves,tol){return (carves||[]).map(p=>{
 const d=simplifyClosed(p,tol>0?tol:ENCRE_TOL,ENCRE_PART);return d&&d.length>=3?d:p})}
/* Les portes. Une porte percée — ouverte, ou ordinaire — ôte son rectangle à la matière ;
   close, elle rebouche exactement ce même rectangle. Un passage secret ne perce qu'une
   fois ouvert : tant qu'il est clos, la matière reste pleine et rien — ni le mur peint,
   ni la vue, ni le passage — ne trahit son emplacement.
   Une porte tracée à la main couvre rarement le mur pile d'un bord à l'autre : il restait
   dans l'embrasure un fil de matière large d'un cheveu, invisible et pourtant opaque. On
   prolonge donc la porte sur son petit côté, de chaque côté, jusqu'à ce que la matière
   s'arrête — et au plus de sa propre épaisseur : si l'on ne ressort pas dans cette
   limite, c'est un gros bloc et non un mur, on n'y creuse que la porte elle-même. */
function doorPierces(d){return !!d&&(!d.secret||!!d.open||!!d.decouvert)}
function rectsOverlap(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h}
/* Une porte de biais. Elle garde son rectangle {x,y,w,h} et gagne un angle « a », en
   degrés, qui la tourne autour de son centre — dans le repère de l'écran, sinon elle se
   déformerait avec le format de la carte. Sans angle, c'est la porte d'avant, bit pour
   bit. Le repère de la porte : son centre, ses demi-côtés et ses deux axes, en unités
   d'écran (l'abscisse multipliée par le rapport). */
function doorFrame(d,ratio){const r=Math.max(.05,Number(ratio)||16/9),a=(Number(d&&d.a)||0)*Math.PI/180;
 const ux=Math.cos(a),uy=Math.sin(a);
 return {r,cx:(d.x+d.w/2)*r,cy:d.y+d.h/2,hw:d.w*r/2,hh:d.h/2,ux,uy,vx:-uy,vy:ux}}
/* La forme d'un coffre, en pour cent de carte : son rectangle, tourné comme une porte, ou l'ellipse qu'il
   enferme (« rond »), tournée de même — vingt-quatre points, mesurés dans le vrai rapport de la carte. */
function coffrePolygon(c,ratio){if(!c)return null;if(!c.rond)return doorPolygon(c,ratio);
 const f=doorFrame(c,ratio),pts=[];for(let i=0;i<24;i++){const t=i/24*Math.PI*2,s=Math.cos(t),u=Math.sin(t);
  pts.push([(f.cx+s*f.hw*f.ux+u*f.hh*f.vx)/f.r,f.cy+s*f.hw*f.uy+u*f.hh*f.vy])}return pts}
// Les quatre coins de la porte, en pour cent de carte. Sans angle : ceux de son rectangle.
function doorPolygon(d,ratio){if(!d)return null;if(!(Number(d.a)||0))return rectPolygon(d);
 const f=doorFrame(d,ratio);
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[(f.cx+s*f.hw*f.ux+t*f.hh*f.vx)/f.r,f.cy+s*f.hw*f.uy+t*f.hh*f.vy])}
/* Tourner une porte par sa poignée : la poignée est posée au-dessus de son centre, dans
   son repère ; l'angle est donc celui qui amène cette direction sur le curseur. Maj
   avance par crans de quinze degrés ; sans rien, une porte presque droite ou presque à
   quarante-cinq degrés s'y aimante. Entre 0 et 180 : une porte n'a pas de sens. */
function anglePoignee(centre,p,ratio,crans){const r=Math.max(.05,Number(ratio)||16/9);
 const dx=(p.x-centre.x)*r,dy=p.y-centre.y;if(Math.hypot(dx,dy)<1e-9)return 0;
 let a=Math.atan2(dy,dx)*180/Math.PI+90;
 if(crans)a=Math.round(a/15)*15;
 else{const proche=Math.round(a/45)*45;if(Math.abs(a-proche)<=4)a=proche}
 return ((a%180)+180)%180}
/* Redimensionner une porte tournée par un coin : le curseur est ramené dans le repère de
   la porte, le coin opposé y reste fixe, puis le rectangle obtenu est reposé dans le
   monde autour de son nouveau centre. Sans angle, c'est le redimensionnement ordinaire. */
function redimPorteTournee(orig,grip,p,ratio){const r=Math.max(.05,Number(ratio)||16/9),deg=Number(orig.a)||0,a=deg*Math.PI/180;
 const cx=(orig.x+orig.w/2)*r,cy=orig.y+orig.h/2;
 const dx=p.x*r-cx,dy=p.y-cy,c=Math.cos(a),s=Math.sin(a);
 const lx=deg?(cx+dx*c+dy*s)/r:p.x,ly=deg?cy-dx*s+dy*c:p.y;   // le curseur, dans le repère de la porte
 const est=grip.includes('e'),sud=grip.includes('s');
 const x1=est?orig.x:lx,x2=est?lx:orig.x+orig.w,y1=sud?orig.y:ly,y2=sud?ly:orig.y+orig.h;
 const w=Math.abs(x2-x1),h=Math.abs(y2-y1),nx=Math.min(x1,x2),ny=Math.min(y1,y2);
 if(!deg)return {x:nx,y:ny,w,h,a:0};
 const ncx=(nx+w/2)*r-cx,ncy=ny+h/2-cy;                // le nouveau centre, retourné dans le monde
 const wx=(cx+ncx*c-ncy*s)/r,wy=cy+ncx*s+ncy*c;
 return {x:wx-w/2,y:wy-h/2,w,h,a:Number(orig.a)||0}}
/* Le trou qu'une porte perce : son rectangle, prolongé sur son petit côté de chaque côté
   jusqu'à ce que la matière s'arrête — et au plus de sa propre épaisseur : si l'on ne
   ressort pas dans cette limite, c'est un gros bloc et non un mur. Le tout dans le
   repère de la porte, donc valable de biais comme droit. Renvoie les quatre coins. */
function trouPorte(d,map){if(!d||!(d.w>0&&d.h>0))return null;
 const f=doorFrame(d,map&&map.ratio),polys=matiereDe(map);
 const large=f.hw>=f.hh,demi=large?f.hh:f.hw,autre=large?f.hw:f.hh,n=12;
 // L'axe court, celui qu'on prolonge, et l'axe long, celui qu'on garde.
 const kx=large?f.vx:f.ux,ky=large?f.vy:f.uy,lx=large?f.ux:f.vx,ly=large?f.uy:f.vy;
 const dedans=(x,y)=>polys.some(p=>polygoneContient(p,[x/f.r,y]));
 const sonde=sens=>{if(!polys.length)return 0;
  for(let k=1;k<=n;k++){const s=demi*2*k/n;
   if(!dedans(f.cx+kx*sens*(demi+s),f.cy+ky*sens*(demi+s)))return s}
  return 0};
 const lo=-(demi+sonde(-1)),hi=demi+sonde(1);
 const pt=(k,o)=>[(f.cx+kx*k+lx*o)/f.r,f.cy+ky*k+ly*o];
 return [pt(lo,-autre),pt(hi,-autre),pt(hi,autre),pt(lo,autre)]}
// Une porte close rebouche exactement le trou qu'elle avait percé, prolongement compris.
function doorBlocks(map){return (map&&map.doors||[]).filter(d=>d&&!d.open&&d.w>0&&d.h>0).map(d=>trouPorte(d,map)).filter(Boolean)}
/* Géométrie effectivement opposée au regard et aux tirs : la matière percée de ses portes,
   puis chaque porte close. Dessin et calcul y puisent ensemble, donc l'ombre commence
   exactement là où le mur est peint. */
function wallShape(map){const polys=matiereDe(map);
 const trous=(map&&map.doors||[]).filter(d=>doorPierces(d)&&d.w>0&&d.h>0).map(d=>trouPorte(d,map)).filter(Boolean);
 let mp=versClip(polys);
 if(mp.length&&trous.length)mp=Clipper.difference(mp,...trous.map(t=>[[anneauFerme(t)]]));
 return {contours:depuisClip(mp).flatMap(p=>p.anneaux)}}
function obstaclesFrom(map){if(!map)return [];
 return [wallShape(map),...doorBlocks(map).map(t=>({contours:[t]}))]}
// Une porte se manœuvre au contact : son rectangle doit entrer dans le rayon du token.
function rectInReach(actor,rect,size,token){
 const cx=Math.max(rect.x,Math.min(actor.x,rect.x+rect.w));
 const cy=Math.max(rect.y,Math.min(actor.y,rect.y+rect.h));
 return tokenDistance(actor,{x:cx,y:cy},size)<=contactRadius(token)}
// La même portée pour une porte de biais : le point du polygone le plus proche, en pixels.
function polyInReach(actor,poly,size,token){if(!poly||poly.length<3)return false;
 if(pointInPolygon([actor.x,actor.y],poly))return true;
 const [ax,ay]=mapPoint(actor,size),pts=poly.map(q=>mapPoint({x:q[0],y:q[1]},size));
 let best=Infinity;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){const q=closestOnSegment([ax,ay],pts[j],pts[i]);
  best=Math.min(best,Math.hypot(ax-q[0],ay-q[1]))}
 return best<=contactRadius(token)}
// Répartit n combattants en grille dans la zone de départ, sans sortir de ses bords.
function spreadInZone(n,zone){if(!zone||n<1)return [];
 const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols),out=[];
 for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);
  out.push({x:zone.x+zone.w*(c+.5)/cols,y:zone.y+zone.h*(r+.5)/rows})}
 return out}
/* Brouillard de guerre : la zone vue depuis un héros est calculée exactement,
   sous forme de polygone. On tire un rayon vers chaque coin d'obstacle — et de
   part et d'autre, pour contourner l'angle — on garde la première rencontre, puis
   on relie les points par angle croissant. Le bord obtenu est une vraie droite :
   aucune grille, donc aucun escalier de pixels. */
// Distance à laquelle un rayon entre dans un rectangle, l'infini s'il le manque.
function rayHitsRect(ox,oy,dx,dy,r){let t0=0,t1=Infinity;
 if(dx>-1e-12&&dx<1e-12){if(ox<=r.x||ox>=r.x+r.w)return Infinity}
 else{let a=(r.x-ox)/dx,b=(r.x+r.w-ox)/dx;if(a>b){const t=a;a=b;b=t}
  if(a>t0)t0=a;if(b<t1)t1=b}
 if(dy>-1e-12&&dy<1e-12){if(oy<=r.y||oy>=r.y+r.h)return Infinity}
 else{let a=(r.y-oy)/dy,b=(r.y+r.h-oy)/dy;if(a>b){const t=a;a=b;b=t}
  if(a>t0)t0=a;if(b<t1)t1=b}
 return t1>=t0&&t1>=0?Math.max(t0,0):Infinity}
// Distance à laquelle un rayon quitte le cadre de la carte.
function rayLeavesBox(ox,oy,dx,dy,B){let t=Infinity;
 if(dx>1e-12)t=Math.min(t,(B.x+B.w-ox)/dx);else if(dx<-1e-12)t=Math.min(t,(B.x-ox)/dx);
 if(dy>1e-12)t=Math.min(t,(B.y+B.h-oy)/dy);else if(dy<-1e-12)t=Math.min(t,(B.y-oy)/dy);
 return t===Infinity?0:Math.max(0,t)}
// Distance à laquelle un rayon coupe un segment, l'infini s'il le manque.
function rayHitsSegment(ox,oy,dx,dy,a,b){
 const ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
 if(den>-1e-12&&den<1e-12)return Infinity;
 const t=((a[0]-ox)*ey-(a[1]-oy)*ex)/den;
 if(t<=0)return Infinity;
 const u=((a[0]-ox)*dy-(a[1]-oy)*dx)/den;
 return u>=0&&u<=1?t:Infinity}
function contourBox(c){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const p of c){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}
 return {x:x0,y:y0,w:x1-x0,h:y1-y0}}
/* ---------- L'index des murs : les arêtes par paquets, chaque paquet sous sa boîte ----------
   Un rayon ne testait un contour qu'après sa boîte englobante ; mais une matière d'un seul
   tenant — un long geste de pinceau, une carte fondue — n'est qu'un contour de mille
   arêtes, et sa boîte ne rejette rien : chaque rayon les parcourait toutes, et le
   brouillard prenait deux cents millisecondes par observateur. Les arêtes sont donc
   groupées par huit, et les groupes par huit, chacun sous sa boîte : un rayon n'ouvre que
   les paquets qu'il traverse, et n'ouvre plus rien dès qu'un mur est plus près que le
   paquet suivant. L'index est gardé tant que ce sont les mêmes formes. */
const INDEX_MURS=new WeakMap();
function boiteAretes(lot){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const [a,b] of lot)for(const p of [a,b]){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}
 // Un cheveu de marge : une feuille d'arêtes toutes verticales aurait une boîte sans largeur.
 return {x:x0-1e-7,y:y0-1e-7,w:x1-x0+2e-7,h:y1-y0+2e-7}}
function indexMurs(shapes){if(!Array.isArray(shapes))return {groupes:[]};
 let idx=INDEX_MURS.get(shapes);if(idx)return idx;
 const groupes=[];
 shapes.forEach((s,forme)=>{for(const c of contoursOf(s)){if(!c||c.length<3)continue;
  const aretes=[];for(let i=0,j=c.length-1;i<c.length;j=i++)aretes.push([c[j],c[i]]);
  for(let g=0;g<aretes.length;g+=64){const lot=aretes.slice(g,g+64),feuilles=[];
   for(let f=0;f<lot.length;f+=8){const petit=lot.slice(f,f+8);feuilles.push({box:boiteAretes(petit),aretes:petit})}
   groupes.push({forme,box:boiteAretes(lot),feuilles})}}});
 idx={groupes};INDEX_MURS.set(shapes,idx);return idx}
// Le premier mur qu'un rayon rencontre avant t, les formes exclues mises à part.
function rayonContre(idx,ox,oy,dx,dy,t,exclues){
 for(const g of idx.groupes){if((exclues&&exclues.has(g.forme))||rayHitsRect(ox,oy,dx,dy,g.box)>=t)continue;
  for(const f of g.feuilles){if(rayHitsRect(ox,oy,dx,dy,f.box)>=t)continue;
   for(const [a,b] of f.aretes){const u=rayHitsSegment(ox,oy,dx,dy,a,b);if(u<t)t=u}}}
 return t}
// Un héros poussé dans la matière verrait le noir : les formes qui le contiennent sont ignorées.
function formesAutour(o,shapes){const ex=new Set();
 (shapes||[]).forEach((s,i)=>{if(shapeContains(s,[o.x,o.y]))ex.add(i)});return ex}
/* Un observateur dont le centre tombe dans la matière — un socle collé au mur, une zone de départ qui
   mord sur la pierre — regarde depuis le point libre le plus proche, à trois unités au plus ; sans
   point libre, il ne voit rien. Écarter la forme entière, comme avant, lui ouvrait d'un coup toutes
   les salles d'un donjon d'un seul tenant, et révélait chaque adversaire de la carte. */
function pointLibre(o,shapes){const dedans=p=>(shapes||[]).some(s=>shapeContains(s,p));
 if(!dedans([o.x,o.y]))return o;
 for(let r=.25;r<=3;r+=.25)for(let k=0;k<24;k++){const a=k/24*Math.PI*2,p=[o.x+Math.cos(a)*r,o.y+Math.sin(a)*r];if(!dedans(p))return {...o,x:p[0],y:p[1]}}
 return null}
function visionPolygon(o,shapes,box){
 const libre=pointLibre(o,shapes);if(!libre)return [[o.x,o.y],[o.x+.01,o.y],[o.x,o.y+.01]];o=libre;
 const B=box||{x:0,y:0,w:100,h:100},exclues=new Set(),idx=indexMurs(shapes);
 const coins=[[B.x,B.y],[B.x+B.w,B.y],[B.x+B.w,B.y+B.h],[B.x,B.y+B.h]];
 (shapes||[]).forEach((s,i)=>{if(exclues.has(i))return;
  for(const c of contoursOf(s))if(c&&c.length>=3)for(const p of c)coins.push(p)});
 const E=2e-5,pts=[];
 for(const c of coins){const base=Math.atan2(c[1]-o.y,c[0]-o.x);
  for(const a of [base-E,base,base+E]){const dx=Math.cos(a),dy=Math.sin(a);
   const t=rayonContre(idx,o.x,o.y,dx,dy,rayLeavesBox(o.x,o.y,dx,dy,B),exclues);
   pts.push([a,o.x+t*dx,o.y+t*dy])}}
 pts.sort((p,q)=>p[0]-q[0]);
 return pts.map(p=>[p[1],p[2]])}
/* Le rayon de contact tel qu'on le voit : un disque, mais coupé par la matière — un mur
   arrête le bras comme il arrête le regard. On tire des rayons depuis le socle, chacun
   arrêté au premier obstacle ou à la portée, la plus courte des deux.
   Les directions sont données en pour cent de carte pour un pas d'un pixel d'écran, si
   bien que « t » se compte en pixels : le disque reste rond à l'écran, même sur une carte
   qui n'est pas carrée. */
function reachPolygon(o,shapes,rayon,largeur,hauteur,pas){
 const n=Math.max(24,Math.min(360,pas||72)),pts=[];
 if(!(rayon>0)||!(largeur>0)||!(hauteur>0))return pts;
 const exclues=formesAutour(o,shapes),idx=indexMurs(shapes);
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
  const dx=Math.cos(a)*100/largeur,dy=Math.sin(a)*100/hauteur;
  pts.push((t=>[o.x+t*dx,o.y+t*dy])(rayonContre(idx,o.x,o.y,dx,dy,rayon,exclues)))}
 return pts}
// Un socle est vu dès qu'il mord sur la zone éclairée, pas seulement par son centre.
function polyTouchesDisc(poly,c,r){if(!poly||poly.length<3)return false;
 if(pointInPolygon(c,poly))return true;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const p=closestOnSegment(c,poly[j],poly[i]);
  if(Math.hypot(c[0]-p[0],c[1]-p[1])<=r)return true}
 return false}
// Aire d'un polygone : sert à comparer une vision à celle d'une carte dégagée.
function polygonArea(poly){let a=0;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j][0]+poly[i][0])*(poly[j][1]-poly[i][1]);
 return Math.abs(a/2)}
/* Mémoire d'exploration : une grille de bits, remplie par balayage du polygone vu.
   Elle survit à la partie, donc elle voyage compressée en base64. */
// Renvoie le nombre de cellules nouvellement marquées : de quoi savoir si la mémoire a bougé.
function fillPolygonGrid(grid,cols,rows,poly){let neuf=0;
 if(!poly||poly.length<3)return neuf;
 for(let j=0;j<rows;j++){const y=(j+.5)/rows*100,xs=[];
  for(let i=0,k=poly.length-1;i<poly.length;k=i++){const a=poly[k],b=poly[i];
   if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
  xs.sort((u,v)=>u-v);
  for(let t=0;t+1<xs.length;t+=2){
   const i0=Math.max(0,Math.ceil(xs[t]/100*cols-.5)),i1=Math.min(cols-1,Math.floor(xs[t+1]/100*cols-.5));
   for(let i=i0;i<=i1;i++){const k=j*cols+i;if(!grid[k]){grid[k]=1;neuf++}}}}
 return neuf}
function maskChars(n){return Math.ceil(Math.ceil(n/8)/3)*4}
function packMask(grid,n){let s='';
 for(let i=0;i<n;i+=8){let b=0;for(let k=0;k<8&&i+k<n;k++)if(grid[i+k])b|=1<<k;s+=String.fromCharCode(b)}
 return btoa(s)}
function unpackMask(str,n){const out=new Uint8Array(n),s=atob(str);
 for(let i=0;i<n;i++)if(s.charCodeAt(i>>3)&(1<<(i&7)))out[i]=1;
 return out}
/* La mémoire d'exploration est une grille : quand la finesse du brouillard change,
   on la ré-échantillonne au lieu de la jeter — les joueurs gardent ce qu'ils ont vu. */
function regridMask(seen,fromW,fromH,toW,toH){const out=new Uint8Array(toW*toH);
 for(let j=0;j<toH;j++){const sj=Math.min(fromH-1,Math.floor((j+.5)/toH*fromH));
  for(let i=0;i<toW;i++){const si=Math.min(fromW-1,Math.floor((i+.5)/toW*fromW));
   if(seen[sj*fromW+si]==='1')out[j*toW+i]=1}}
 return out}
/* Test de compétence. Le chiffre d'une compétence est un bonus, pas un nombre de dés :
   on lance 1 dé plus ce bonus. Chaque 4+ est une réussite ; chaque 6 relance un dé de
   plus, qui compte à son tour et peut relancer lui aussi. Le plafond arrête une série
   qui s'emballe — elle est finie avec probabilité 1, mais pas bornée. */
function skillRoll(bonus,roll,plafond=1000){const des=[];let reussites=0,reste=1+Math.max(0,Math.trunc(bonus)||0);
 while(reste>0&&des.length<plafond){reste--;const v=roll();des.push(v);if(v>=4)reussites++;if(v===6)reste++}
 return {des,reussites,reste}}
/* Les états d'un combattant. Il en porte plusieurs à la fois, dans l'ordre où on les
   pose : le dernier venu se range à gauche des précédents sur le socle. Poser un état
   déjà porté ne le double pas, et le lever quand il est absent ne fait rien. */
function statesOf(a){return Array.isArray(a&&a.states)?a.states:[]}
function hasState(a,etat){return statesOf(a).includes(etat)}
function setState(a,etat,pose){const reste=statesOf(a).filter(x=>x!==etat);
 a.states=pose?[...reste,etat]:reste;
 // Un état qui s'en va emporte son compte : il ne doit pas revenir chargé de ses crans.
 if(!pose&&a){if(etat==='Saignée')a.bleed=0;else if(a.cumuls)delete a.cumuls[etat]}
 return a.states}
/* Les états et ce qu'ils empêchent ou déclenchent. Tout ce qui se calcule vit ici ;
   l'interface ne fait que déclencher au bon moment et raconter. */
const ONDE_EXCLUS=['Blindage','Invisible','Onde','Vie','Coma'];
function frozenSolid(a){return hasState(a,'Gel')||hasState(a,'Au sol')}
function blinded(a){return hasState(a,'Aveugle')}
/* Quatre états s'empilent : chaque aggravation vaut un cran, et à zéro l'état s'en va.
   Leur effet joue autant de fois qu'ils portent de crans — trois crans de Feu, trois dés
   de brûlure. La saignée garde le champ qui était le sien avant les autres : les parties
   déjà enregistrées le portent, et tout ce qui s'appuie dessus continue de le lire. Les
   trois autres logent ensemble dans « cumuls ». */
const ETATS_CUMULES=['Saignée','Feu','Foudre','Poison'];
function cumulable(etat){return ETATS_CUMULES.includes(etat)}
function compteEtat(a,etat){if(!hasState(a,etat))return 0;
 if(!cumulable(etat))return 1;
 const v=etat==='Saignée'?(a&&a.bleed):(a&&a.cumuls&&a.cumuls[etat]);
 return Math.max(1,Math.trunc(v)||1)}
function ajouteEtat(a,etat,n){if(!a||!cumulable(etat))return 0;
 const v=Math.max(0,Math.min(99,compteEtat(a,etat)+Math.trunc(n)));
 if(etat==='Saignée')a.bleed=v;
 else{const c=a.cumuls||(a.cumuls={});if(v>0)c[etat]=v;else delete c[etat]}
 setState(a,etat,v>0);return v}
function bleedOf(a){return compteEtat(a,'Saignée')}
function addBleed(a,n){return ajouteEtat(a,'Saignée',n)}
/* Poser sur un combattant l'affliction qu'on vient de lui infliger, d'une arme ou de la
   main du MJ. L'Onde est un bouclier : elle absorbe celle qui arrive et se consume, d'où
   qu'elle vienne. Les états empilables prennent un cran de plus, les autres se posent une
   fois et y restent. Trois réponses, pour que le journal ne raconte que ce qui est
   arrivé : vrai si l'état est posé, « onde » s'il a été absorbé, faux s'il était déjà là. */
function infligeEtat(a,etat){if(!a||!etat)return false;
 if(!ONDE_EXCLUS.includes(etat)&&hasState(a,'Onde')){setState(a,'Onde',false);return 'onde'}
 if(cumulable(etat)){ajouteEtat(a,etat,1);return true}
 if(hasState(a,etat))return false;
 setState(a,etat,true);return true}
/* Les talents dont l'effet est écrit dans le code. Un talent créé à la main dans l'onglet
   Talents s'y reconnaît à son nom réduit — sans accents, sans casse, sans ponctuation —
   de sorte qu'il n'a aucun identifiant particulier à porter : « Lamevent », « lame-vent »
   ou « LAMEVENT » trouvent le même effet. Ce que le code sait faire est déclaré ici ; ce
   qu'il en fait à l'écran vit dans la table de jeu. */
function cleTalent(nom){return String(nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]/g,'')}
/* La mécanique qu'un nom désigne : sa clé — « lamevent », « gardien » — ou le nom même de
   l'effet, tel que la bibliothèque l'écrit. Un talent appelé « Orbes de feu » ou « Orbes
   mystiques » se câblait jusque-là sur rien : leurs clés sont « orbesfeu » et « orbes »,
   que leurs noms ne donnent pas. Chaîne vide si aucun effet ne répond à ce nom. */
function effetParNom(nom){const k=cleTalent(nom);if(!k)return '';
 if(TALENTS_CODES[k])return k;
 const c=Object.values(TALENTS_CODES).find(x=>cleTalent(x.nom)===k)||Object.values(TALENTS_CODES).find(x=>(x.anciens||[]).some(a=>cleTalent(a)===k));return c?c.cle:''}
/* Chaque effet sait se dire en une phrase, avec ses parties réglables en gras : c'est
   ainsi qu'on le lit dans la bibliothèque comme sur la fiche du talent, et qu'on voit d'un
   coup ce qu'un réglage change. Le texte est bâti par le moteur, donc il ne peut pas
   mentir sur ce qu'il fera. */
/* Les états qu'un effet peut poser. Le coma n'en est pas : c'est ce qui arrive à zéro
   point de vie. La liste complète, avec « Aucun » et « Coma », vit dans la table de jeu —
   elle y sert le menu du clic droit, qui n'a pas le même office. */
// Les huit compétences, dans l'ordre des fiches : la table les nomme depuis le moteur.
const COMPETENCES=['Agilité','Force','Mysticisme','Perception','Robustesse','Ruse','Savoir','Technique'];
const ETATS_JEU=['Au sol','Aveugle','Blindage','Ciblage','Faille','Feu','Foudre','Gel',
 'Invisible','Onde','Poison','Saignée','Vie','Affaibli'];
const CHOIX_ETAT=[['','— aucun —'],...ETATS_JEU.map(e=>[e,e])];
// Les réglages de Dominateur, bornés : l'état visé, x, et les dés de xdx.
function dominateurDe(p){const n=(v,a,b,d)=>Math.max(a,Math.min(b,Math.trunc(Number(v))||d));
 return {mode:(p&&p.mode)||'sansechec',etat:(p&&p.etat)||'Au sol',x:n(p&&p.x,1,20,1),nb:n(p&&p.nb,1,9,1),faces:[4,6,8,10,12,20].includes(Math.trunc(Number(p&&p.faces)))?Math.trunc(Number(p.faces)):6}}
/* Ce que blessent Dévorant, Épines et Éclaboussure : le bonus de dégâts du porteur, ce bonus + x, son double,
   ou x dégâts tout court. */
const PARAMS_MONTANT=[{cle:'montant',nom:'Dégâts',type:'choix',defaut:'bonus',options:[['bonus','son bonus de dégâts'],['plus','son bonus de dégâts + x'],['double','le double de son bonus de dégâts'],['fixe','x dégâts']]},
 {cle:'x',nom:'x',type:'nombre',defaut:1,min:1,max:20}];
function phraseMontant(p){const x=Math.max(1,Math.min(20,Math.trunc(Number(p&&p.x))||1)),m=(p&&p.montant)||'bonus';
 return m==='plus'?'<b>son bonus de dégâts + '+x+'</b>':m==='double'?'<b>le double de son bonus de dégâts</b>':m==='fixe'?'<b>'+x+' dégât'+(x>1?'s':'')+'</b>':'<b>son bonus de dégâts</b>'}
// Le nombre que ces mots valent, le bonus de dégâts du porteur donné.
function montantDegats(p,bonus){const x=Math.max(1,Math.min(20,Math.trunc(Number(p&&p.x))||1)),b=Math.max(0,Math.trunc(Number(bonus))||0),m=(p&&p.montant)||'bonus';
 return m==='plus'?b+x:m==='double'?2*b:m==='fixe'?x:b}
// Péril : les dégâts d'un porteur sous son seuil de PV, doublés ou divisés par deux (arrondis au-dessus).
function degatsPeril(n,a,p){if(!a||!(Number(a.max)>0))return n;const s=Math.max(5,Math.min(95,Math.trunc(Number(p&&p.seuil))||50));
 if(Number(a.hp)/Number(a.max)*100>=s)return n;return p&&p.effet==='moitie'?Math.ceil(n/2):n*2}
/* Les dés qu'un orbe peut lancer : ceux de l'attaque, moins le dé de Soin, qui ne frappe pas. */
const DES_ORBE=[['white','Simple'],['bone','Léger'],['red','Lourd'],['blue','Mystique'],['black','Mortel'],['yellow','Phase']];
const TALENTS_CODES={lamevent:{cle:'lamevent',nom:'Lamevent',type:'mait',bouton:'⚡ Lamevent',
 aide:'En terminant un mouvement : ton bonus de dégâts aux adversaires au contact.',
 params:[{cle:'cibles',nom:'Adversaires frappés',type:'choix',defaut:'1',
   options:[['1','Un'],['2','Deux'],['tous','Tous ceux au contact']]},
  {cle:'bonus',nom:'Dégâts en plus du bonus',type:'nombre',defaut:0,min:0,max:99},
  {cle:'etat',nom:'État infligé',type:'choix',defaut:'',options:CHOIX_ETAT},
  {cle:'mode',nom:'Cet état vient',type:'choix',defaut:'plus',
   options:[['plus','en plus des dégâts'],['place','à la place des dégâts']]}],
 phrase(p){const q=p&&p.cibles,b=(p&&p.bonus)|0,e=p&&p.etat,place=e&&(p&&p.mode)==='place';
  const qui=q==='tous'?'<b>tous les adversaires</b> au contact'
   :'<b>'+(q==='2'?'deux':'un')+'</b> adversaire'+(q==='2'?'s':'')+' au contact';
  if(place)return 'En terminant un mouvement, le porteur inflige <b>'+e+'</b> à '+qui
   +', <b>sans dégâts</b>.';
  return 'En terminant un mouvement, le porteur inflige son <b>bonus de dégâts'
   +(b?' + '+b:'')+'</b>'+(e?' et <b>'+e+'</b>':'')+' à '+qui+'.'}},
 /* Rebond : une action. Le porteur attaque ; s'il tue la cible, il gagne 1 point de Mouvement. */
 rebond:{cle:'rebond',nom:'Rebond',type:'act',bouton:'⚔ Rebond',attaque:true,
  aide:'Action : le porteur effectue une attaque ; s’il tue la cible, il gagne 1 point de Mouvement.',
  params:[],phrase(){return 'Le porteur effectue <b>une attaque</b>. S’il <b>tue la cible</b>, il gagne <b>1 point de Mouvement</b>.'}},
 /* Revanche : une réaction, gratuite. Après l'échec d'un adversaire, le porteur le rejoint au contact
    d'un Mouvement qui ne coûte rien. */
 revanche:{cle:'revanche',nom:'Revanche',type:'reac',bouton:'↯ Revanche',gratuit:true,
  aide:'Réaction : après l’échec d’un adversaire, le porteur effectue un Mouvement gratuit jusqu’à son contact.',
  params:[],phrase(){return 'Après qu’un adversaire réalise <b>un échec</b>, le porteur effectue <b>un Mouvement gratuit</b> jusqu’à son contact.'}},
 /* Traction : une réaction, gratuite. Blessé par une attaque à distance, le porteur rejoint le tireur. */
 traction:{cle:'traction',nom:'Traction',type:'reac',bouton:'⇢ Traction',gratuit:true,
  aide:'Réaction : après avoir subi les dégâts d’une attaque à distance, le porteur effectue un Mouvement gratuit jusqu’au contact du tireur.',
  params:[],phrase(){return 'Après avoir subi les dégâts d’une <b>attaque à distance</b>, le porteur effectue <b>un Mouvement gratuit</b> jusqu’au contact de l’adversaire.'}},
 /* Rapide : un passif. Un point de Mouvement en plus, au premier tour du combat ou à chaque tour. */
 rapide:{cle:'rapide',nom:'Rapide',type:'pass',
  aide:'Passif : le porteur gagne 1 point de Mouvement supplémentaire au premier tour de combat, ou au début de chaque tour.',
  params:[{cle:'quand',nom:'Quand',type:'choix',defaut:'premier',options:[['premier','au premier tour de combat'],['chaque','au début de chaque tour']]}],
  phrase(p){return 'Le porteur gagne <b>1 point de Mouvement</b> supplémentaire '+((p&&p.quand)==='chaque'?'<b>au début de chaque tour</b>':'<b>au premier tour de combat</b>')+'.'}},
 /* Larcin : une action. Le porteur attaque, puis un test de Ruse dérobe à la cible ce que ses
    réussites atteignent — le plus précieux : arme, armure, objet, ressource, ou de l'or. */
 larcin:{cle:'larcin',nom:'Larcin',type:'act',bouton:'✋ Larcin',attaque:true,
  aide:'Action : le porteur attaque, puis un test de Ruse automatique dérobe une chose à la cible — de l’or, une ressource, un objet, une armure ou une arme — selon les réussites.',
  params:[{cle:'or',nom:'Réussites pour de l’or',type:'nombre',defaut:1,min:1,max:9},{cle:'orQte',nom:'Or dérobé',type:'nombre',defaut:5,min:1,max:999},
   {cle:'ressource',nom:'Réussites pour une ressource',type:'nombre',defaut:2,min:1,max:9},{cle:'objet',nom:'Réussites pour un objet',type:'nombre',defaut:3,min:1,max:9},
   {cle:'armure',nom:'Réussites pour une armure',type:'nombre',defaut:4,min:1,max:9},{cle:'arme',nom:'Réussites pour une arme',type:'nombre',defaut:5,min:1,max:9}],
  phrase(p){const n=k=>Math.max(1,(p&&p[k])|0);
   return 'Le porteur effectue <b>une attaque</b>, puis un <b>test de Ruse</b> pour dérober à la cible : de l’<b>or</b> ('+n('or')+' réussite'+(n('or')>1?'s':'')+', '+Math.max(1,(p&&p.orQte)|0)+' or), une <b>ressource</b> ('+n('ressource')+'), un <b>objet</b> ('+n('objet')+'), une <b>armure</b> ('+n('armure')+') ou une <b>arme</b> ('+n('arme')+') — le plus précieux qu’il atteint.'}},
 /* Pris en tenailles : une amélioration. Des dégâts en plus par adversaire au contact, au-delà du premier. */
 tenailles:{cle:'tenailles',nom:'Pris en tenailles',type:'ame',
  aide:'Amélioration : le porteur augmente son bonus de dégâts pour chaque adversaire au contact au-delà du premier.',
  params:[{cle:'bonus',nom:'Dégâts par adversaire en plus',type:'nombre',defaut:1,min:1,max:9}],
  phrase(p){const n=Math.max(1,(p&&p.bonus)|0);return 'Le porteur augmente son bonus de dégâts de <b>+'+n+'</b> par adversaire au contact <b>au-delà du premier</b>.'}},
 /* Dominateur : un passif générique. Contre les adversaires qui portent l'état réglé — Au sol d'origine —,
    le porteur double ses dégâts, les augmente de x ou de xdx, ou ne fait pas d'échec. */
 dominateur:{cle:'dominateur',nom:'Dominateur',type:'pass',
  aide:'Passif : contre les adversaires qui portent l’état réglé, le porteur double ses dégâts, les augmente de x ou de xdx, ou ne fait pas d’échec.',
  params:[{cle:'mode',nom:'Contre eux, le porteur',type:'choix',defaut:'sansechec',options:[['double','double ses dégâts'],['plus','augmente ses dégâts de x'],['des','augmente ses dégâts de xdx'],['sansechec','ne fait pas d’échec']]},
   {cle:'etat',nom:'Adversaires avec',type:'choix',defaut:'Au sol',options:CHOIX_ETAT.slice(1)},
   {cle:'x',nom:'x',type:'nombre',defaut:1,min:1,max:20},
   {cle:'nb',nom:'Nombre de dés',type:'nombre',defaut:1,min:1,max:9},
   {cle:'faces',nom:'Faces',type:'choix',defaut:'6',options:[['4','d4'],['6','d6'],['8','d8'],['10','d10'],['12','d12'],['20','d20']]}],
  phrase(p){const m=(p&&p.mode)||'sansechec',e='contre les adversaires avec <b>'+((p&&p.etat)||'Au sol')+'</b>.',d=dominateurDe(p);
   return m==='double'?'Le porteur <b>double ses dégâts</b> '+e:m==='plus'?'Le porteur augmente ses dégâts de <b>+'+d.x+'</b> '+e
    :m==='des'?'Le porteur augmente ses dégâts de <b>+'+d.nb+'d'+d.faces+'</b> '+e:'Le porteur <b>n’effectue pas d’échec</b> '+e}},
 /* Déception : un passif. Un critique adverse contre le porteur devient un échec — ou lui vaut une
    attaque gratuite en retour. */
 deception:{cle:'deception',nom:'Déception',type:'pass',
  aide:'Passif : les critiques adverses contre le porteur deviennent des échecs, ou lui valent une attaque gratuite en retour.',
  params:[{cle:'mode',nom:'Un critique adverse contre le porteur',type:'choix',defaut:'echec',options:[['echec','devient un échec'],['riposte','lui vaut une attaque gratuite en retour']]}],
  phrase(p){return (p&&p.mode)==='riposte'?'Le porteur effectue <b>une attaque gratuite</b> contre l’adversaire qui réalise <b>un critique</b> contre lui.':'Les <b>attaques critiques</b> adverses contre le porteur deviennent des <b>échecs</b>.'}},
 /* Lamevent élémentaire : une amélioration de Lamevent. Ses dégâts infligent aussi l'état réglé. */
 /* Corps élémentaire : une amélioration. Qui attaque le porteur au contact en garde l'état —
    s'il l'a blessé, ou à chaque attaque, même sans le toucher, selon le réglage « Quand ». */
 corpselem:{cle:'corpselem',nom:'Corps élémentaire',court:'Corps élémentaire',type:'ame',
  aide:'Les adversaires qui attaquent le porteur au contact subissent un état : s’ils lui infligent des dégâts, ou à chaque attaque, même sans le toucher.',
  params:[{cle:'etat',nom:'État infligé',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])},
   {cle:'quand',nom:'Quand',type:'choix',defaut:'degats',options:[['degats','S’il vous inflige des dégâts'],['toujours','À chaque attaque, même sans toucher']]}],
  phrase(p){return 'Les adversaires qui attaquent le porteur au contact subissent <b>'+((p&&p.etat)||'Feu')+'</b>'+(p&&p.quand==='toujours'?', <b>même sans le toucher</b>.':' s’ils lui infligent des <b>dégâts</b>.')}},
 lameventelem:{cle:'lameventelem',nom:'Lamevent élémentaire',court:'état infligé',type:'ame',
  aide:'Amélioration de Lamevent : ses dégâts infligent aussi l’état réglé.',
  params:[{cle:'etat',nom:'État infligé',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Le porteur inflige <b>'+((p&&p.etat)||'Feu')+'</b> lorsqu’il inflige les dégâts de <b>Lamevent</b>.'}},
 /* Double attaque : un passif. Il n'ouvre aucun bouton — rien à déclencher — il élargit
    seulement ce qu'une attaque peut viser. Le ciblage accumule alors jusqu'à ce compte,
    et le bouton d'attaque les frappe toutes, chacune avec son propre jet. */
 doubleattaque:{cle:'doubleattaque',nom:'Double attaque',type:'pass',
  aide:'Passif : le porteur vise plusieurs adversaires d’une même attaque.',
  params:[{cle:'cibles',nom:'Adversaires visés',type:'nombre',defaut:2,min:2,max:6}],
  phrase(p){const n=Math.max(2,(p&&p.cibles)|0);
   return 'Le porteur peut cibler <b>'+n+'</b> adversaires quand il effectue une attaque.'}},
 /* Garde rapprochée : un passif, et d'abord un talent de monstre — un chef entouré de sa
    piétaille. Le coup est détourné avant de porter : les sbires alliés au contact
    encaissent à sa place, chacun le plein des dégâts. Sans sbire au contact, le porteur
    encaisse comme n'importe qui. */
 garderapprochee:{cle:'garderapprochee',nom:'Garde rapprochée',type:'pass',monstre:true,
  aide:'Passif : des sbires alliés au contact encaissent les dégâts à la place du porteur.',
  params:[{cle:'sbires',nom:'Sbires qui encaissent',type:'nombre',defaut:1,min:1,max:6}],
  phrase(p){const n=Math.max(1,(p&&p.sbires)|0);
   return 'Après avoir subi des dégâts, <b>'+n+'</b> sbire'+(n>1?'s':'')+' allié'+(n>1?'s':'')
    +' au contact '+(n>1?'les encaissent':'les encaisse')+' à la place du porteur, '
    +'chacun jusqu’à son dernier point de vie ; le reliquat passe au suivant, puis au porteur.'}},
 /* Orbes mystiques : une maîtrise. À chaque activation, le porteur lance quelques orbes
    qui ne lui coûtent rien — ni Action ni Mouvement, seul le compte du tour — sur un
    adversaire en vue. Les dégâts d'un orbe sont ceux d'un effet : ni DEF, ni blindage. */
 orbes:{cle:'orbes',nom:'Orbes mystiques',type:'mait',bouton:'✦ Orbe',teinte:'#9b7ad4',gratuit:true,
  aide:'Maîtrise : à chaque activation, le porteur lance gratuitement des orbes sur un adversaire en vue, sans dépenser d’Action.',
  params:[{cle:'orbes',nom:'Orbes par activation',type:'nombre',defaut:1,min:1,max:9},
   {cle:'des',nom:'Dés par orbe',type:'nombre',defaut:1,min:1,max:6},
   {cle:'couleur',nom:'Couleur des dés',type:'choix',defaut:'blue',options:DES_ORBE}],
  phrase(p){const n=Math.max(1,(p&&p.orbes)|0),d=Math.max(1,(p&&p.des)|0);
   const nom=(DES_ORBE.find(([k])=>k===(p&&p.couleur))||DES_ORBE[3])[1];
   return 'Durant son activation, le porteur peut lancer <b>'+n+'</b> orbe'+(n>1?'s':'')
    +' qui lance'+(n>1?'nt':'')+' <b>'+d+' dé'+(d>1?'s':'')+' '+nom+(d>1?'s':'')+'</b>'+(n>1?' chacun':'')+'.'}},
 /* Orbes de feu : une amélioration. Elle ne lance rien elle-même : elle change ce que les
    orbes du porteur emportent, et l'état se règle, Feu par défaut. Le moteur n'exige plus
    d'Orbes mystiques au-dessus : c'est le MJ qui nomme le prérequis, talent par talent.
    Trois volets, chacun au palier que le MJ choisit : l'état sur un 6 (palier 1), puis à
    chaque touche (2), puis en deux crans (3). */
 orbesfeu:{cle:'orbesfeu',nom:'Orbes de feu',court:'état infligé',type:'ame',
  aide:'Les orbes du porteur infligent un état en plus de leurs dégâts : sur un 6, puis à chaque touche, puis en deux crans, chacun au palier choisi.',
  params:[{cle:'etat',nom:'État infligé',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])},
   {cle:'quand',nom:'Quand',type:'choix',defaut:'degats',options:[['degats','S’il inflige des dégâts'],['toujours','Toujours, même sans dégâts']]}],
  volets:[{cle:'six',nom:'Inflige l’état sur 6+',palier:1},{cle:'touche',nom:'Inflige l’état à chaque touche',palier:2},
   {cle:'deux',nom:'Inflige l’état en deux crans',palier:3}],
  phrase(p,palier,v){const e=(p&&p.etat)||'Feu',n=Math.max(1,Math.trunc(Number(palier))||1),ouvert=k=>!!v&&v[k]>0&&n>=v[k];
   if(!PALIERS.actifs)return 'Les orbes du porteur infligent <b>'+e+'</b> '+(p&&p.quand==='toujours'?'à chaque orbe, <b>même sans dégâts</b>.':'quand ils infligent des <b>dégâts</b>.');
   if(!ouvert('six')&&!ouvert('touche'))return 'Les orbes du porteur n’infligent encore <b>aucun état</b> à ce palier.';
   return 'Les orbes du porteur infligent <b>'+e+(ouvert('deux')&&cumulable(e)?' 2':'')+'</b>'+(ouvert('touche')?'':' sur <b>6+</b>')+' en plus de leurs dégâts.'}},
 /* Débordement : un passif. Le coup qui achève un adversaire ne s'arrête pas à lui — ce
    qu'il n'a pas pu encaisser passe à un autre adversaire à portée de l'attaque. */
 debordement:{cle:'debordement',nom:'Débordement',type:'pass',
  aide:'Passif : après avoir achevé un adversaire, le reliquat de dégâts est infligé à un autre adversaire à portée.',
  params:[],
  phrase(){return 'Après avoir achevé un adversaire, le <b>reliquat de dégâts</b> est infligé à un autre adversaire à portée.'}},
 /* Rempart : un passif, le pendant de Garde rapprochée côté troupe. Avant qu'un
    aventurier au contact ne subisse des dégâts, le porteur en prend la moitié — arrondie
    au-dessus, c'est lui le mur — et l'aventurier visé subit le reste. */
 rempart:{cle:'rempart',nom:'Rempart',type:'pass',
  aide:'Passif : avant qu’un aventurier au contact ne subisse des dégâts, le porteur en subit la moitié à sa place.',
  params:[],
  phrase(){return 'Avant qu’un aventurier au contact ne subisse des dégâts, le porteur subit <b>la moitié</b> des dégâts à sa place ; l’aventurier visé subit le reliquat.'}},
 /* Gardien : une maîtrise. Au début du combat, un aventurier allié au contact reçoit
    l'état Gardé — l'allié ciblé, sinon le plus proche. Une fois par combat. */
 gardien:{cle:'gardien',nom:'Gardien',type:'mait',bouton:'🛡 Gardien',
  aide:'Maîtrise : au début du premier tour de combat, un aventurier allié au contact reçoit l’état Gardé — l’allié ciblé, sinon le plus proche.',
  params:[],
  phrase(){return 'Au début du premier tour de combat, un aventurier allié <b>au contact</b> reçoit l’état <b>Gardé</b> : l’allié ciblé, sinon le plus proche.'}},
 /* Destructeur : une maîtrise. Avec une arme au contact, tous les doubles sont des
    critiques, pas seulement les 6 ; le double 1 reste ce qu'il est, un échec. Ni les
    armes à distance, ni les orbes, ni les attaques de fiche n'en profitent. */
 destructeur:{cle:'destructeur',nom:'Destructeur',type:'mait',
  aide:'Maîtrise : avec une arme au contact, le porteur réussit un critique sur tous ses doubles, pas seulement les 6.',
  params:[],
  phrase(){return 'Le porteur réalise des <b>critiques sur tous ses doubles</b> avec une <b>arme au contact</b> ; un double 1 reste un échec.'}},
 insaisissable:{cle:'insaisissable',nom:'Insaisissable',type:'pass',
  aide:'Passif : le porteur ignore les Dégâts d’Opportunité quand il effectue un mouvement.',
  params:[],
  phrase(){return 'Le porteur <b>ignore les Dégâts d’Opportunité</b> en effectuant un mouvement.'}},
 /* Meute : un passif d'adversaire, la bête qui chasse en groupe. Un allié dans sa zone de
    contact, et le porteur double son bonus de dégâts ; la table mesure qui touche qui. */
 meute:{cle:'meute',nom:'Meute',type:'pass',monstre:true,
  aide:'Passif : si un allié est dans sa zone de contact, le porteur double son bonus de dégâts.',
  params:[],
  phrase(){return 'Si un <b>allié</b> est dans sa zone de contact, le porteur <b>double son bonus de dégâts</b>.'}},
 /* Invocation : un adversaire en appelle un autre du bestiaire, posé sur la carte là où le
    MJ clique. Le modèle se choisit à la création du talent ; son nom se lit par la page,
    qui seule connaît le bestiaire. */
 invocation:{cle:'invocation',nom:'Invocation',type:'act',monstre:true,bouton:'✦ Invocation',
  aide:'Action : pose sur la carte, là où tu cliques, un allié du bestiaire.',
  params:[{cle:'modele',nom:'Adversaire invoqué',type:'modele',defaut:''}],
  phrase(p){const nom=typeof nomModele==='function'?nomModele(p&&p.modele):'';
   return 'Le porteur invoque <b>'+(nom||'un combattant du bestiaire')+'</b>, allié, posé sur la carte où le MJ le veut.'}},
 /* Régénération : le porteur se soigne — d'un montant fixe, de dés, ou de son Endurance ou
    sa Vie majorées — aussitôt frappé, au début du tour ou à sa fin ; un état peut l'en
    empêcher tant qu'il le porte. */
 regeneration:{cle:'regeneration',nom:'Régénération',type:'pass',monstre:true,
  aide:'Passif : le porteur regagne des PV à chaque tour, ou dès qu’il est frappé.',
  params:[{cle:'quantite',nom:'Quantité',type:'nombre',defaut:2,min:1,max:99},
   {cle:'forme',nom:'Sous la forme de',type:'choix',defaut:'fixe',options:[['fixe','PV'],['des','dés (d6)'],['endu','PV + Endurance'],['vie','PV + Vie']]},
   {cle:'moment',nom:'Se produit',type:'choix',defaut:'debut',options:[['immediat','immédiatement, dès qu’il est frappé'],['debut','au début du tour'],['fin','à la fin du tour']]},
   {cle:'bloque',nom:'Empêchée par l’état',type:'choix',defaut:'',options:CHOIX_ETAT}],
  phrase(p){const n=Math.max(1,(p&&p.quantite)|0),f=p&&p.forme,m=p&&p.moment,b=p&&p.bloque;
   const combien=f==='des'?'<b>'+n+'d6</b>':f==='endu'?'<b>'+n+' + Endurance</b>':f==='vie'?'<b>'+n+' + Vie</b>':'<b>'+n+'</b>';
   const quand=m==='immediat'?'<b>dès qu’il est frappé</b>':m==='fin'?'<b>à la fin du tour</b>':'<b>au début du tour</b>';
   return 'Le porteur se soigne de '+combien+' PV '+quand+'.'+(b?' <b>'+b+'</b> l’en empêche tant qu’il le porte.':'')}},
 /* Nuée : le porteur peut occuper l'espace d'un autre socle, et s'y superposer. */
 nuee:{cle:'nuee',nom:'Nuée',type:'pass',monstre:true,
  aide:'Passif : le porteur peut finir son mouvement sur un token et traverser les tokens adverses.',params:[],
  phrase(){return 'Le porteur peut <b>finir son mouvement sur un token</b> et <b>traverser les tokens adverses</b>.'}},
 /* Glissant : un adversaire qui finit son mouvement sur le token du porteur — le token, pas sa zone de contact —
    tombe Au sol, et le porteur, s'il était caché, est révélé. Le porteur ne barre pas le passage à ses
    adversaires : on peut lui marcher dessus. */
 glissant:{cle:'glissant',nom:'Glissant',type:'pass',monstre:true,
  aide:'Passif : un adversaire qui finit son mouvement sur le token du porteur subit Au sol ; le porteur, s’il était caché, est ensuite révélé.',params:[],
  phrase(){return 'Un adversaire qui finit son mouvement <b>sur le token</b> du porteur subit <b>Au sol</b>. Le porteur est ensuite <b>révélé</b> s’il était caché.'}},
 /* Dévorant : en se déplaçant, le porteur blesse chaque socle adverse qu'il fait entrer dans sa zone
    de contact, même en passant — une fois par socle et par déplacement. */
 devorant:{cle:'devorant',nom:'Dévorant',type:'pass',monstre:true,
  aide:'Passif : le porteur blesse les socles adverses qu’il fait entrer dans sa zone de contact, même en passant.',
  params:PARAMS_MONTANT,
  phrase(p){return 'Le porteur inflige '+phraseMontant(p)+' aux socles adverses qu’il fait entrer dans sa zone de contact, <b>même en passant</b>.'}},
 /* Épines : un socle adverse qui entre dans la zone de contact du porteur en est blessé aussitôt. */
 epines:{cle:'epines',nom:'Épines',type:'pass',monstre:true,
  aide:'Passif : un socle adverse qui entre dans la zone de contact du porteur est blessé aussitôt.',
  params:PARAMS_MONTANT,
  phrase(p){return 'Quand un socle adverse entre dans sa zone de contact, le porteur lui inflige '+phraseMontant(p)+' <b>aussitôt</b>.'}},
 /* Tourbillon : l'attaque du porteur frappe tous les adversaires de sa zone de contact. */
 tourbillon:{cle:'tourbillon',nom:'Tourbillon',type:'pass',monstre:true,
  aide:'Passif : l’attaque du porteur frappe tous les adversaires de sa zone de contact.',params:[],
  phrase(){return 'L’attaque du porteur frappe <b>tous les adversaires</b> de sa zone de contact.'}},
 /* Péril : sous un seuil de ses PV, le porteur double ses dégâts — ou les divise par deux. */
 peril:{cle:'peril',nom:'Péril',type:'pass',monstre:true,
  aide:'Passif : sous un seuil de ses PV, le porteur double ses dégâts, ou les divise par deux.',
  params:[{cle:'effet',nom:'Ses dégâts',type:'choix',defaut:'double',options:[['double','doublés'],['moitie','divisés par deux']]},
   {cle:'seuil',nom:'Sous',type:'nombre',defaut:50,min:5,max:95,pas:5,unite:'%'}],
  phrase(p){const s=Math.max(5,Math.min(95,Math.trunc(Number(p&&p.seuil))||50));
   return 'Sous <b>'+s+' %</b> de ses PV, le porteur '+(p&&p.effet==='moitie'?'<b>divise par deux</b>':'<b>double</b>')+' ses dégâts.'}},
 /* Éclaboussure : frappé, le porteur rend un état, son bonus de dégâts ou des dégâts fixes — à qui le
    frappe, ou à tous les adversaires au contact ; à chaque attaque, ou aux attaques au contact seules. */
 eclaboussure:{cle:'eclaboussure',nom:'Éclaboussure',type:'pass',monstre:true,
  aide:'Passif : frappé, le porteur inflige un état ou des dégâts à qui le frappe, ou à tous les adversaires au contact.',
  params:[{cle:'quoi',nom:'Inflige',type:'choix',defaut:'etat',options:[['etat','un état'],...PARAMS_MONTANT[0].options]},
   {cle:'etat',nom:'État',type:'choix',defaut:'Poison',options:CHOIX_ETAT.slice(1)},PARAMS_MONTANT[1],
   {cle:'cible',nom:'À',type:'choix',defaut:'attaquant',options:[['attaquant','l’adversaire qui le frappe'],['contact','tous les adversaires au contact']]},
   {cle:'quand',nom:'Quand il subit',type:'choix',defaut:'toute',options:[['toute','toute attaque'],['contact','une attaque au contact']]}],
  phrase(p){const quoi=(p&&p.quoi)||'etat';
   return 'Quand il subit '+(p&&p.quand==='contact'?'<b>une attaque au contact</b>':'<b>toute attaque</b>')+', le porteur inflige '
    +(quoi==='etat'?'<b>'+((p&&p.etat)||'Poison')+'</b>':phraseMontant({...p,montant:quoi}))+' à '+(p&&p.cible==='contact'?'<b>tous les adversaires au contact</b>':'<b>l’adversaire qui le frappe</b>')+'.'}},
 mauvaissort:{cle:'mauvaissort',nom:'Mauvais Sort',type:'pass',monstre:true,
  aide:'Passif : un combattant qui cible le porteur relance son meilleur dé de dégâts, avant le calcul des dégâts.',
  params:[],
  phrase(){return 'Qui cible le porteur <b>relance son meilleur dé</b> de dégâts, avant le calcul.'}},
 /* Attaque État : une action. Le porteur effectue une attaque — celle de son bouton, cibles
    et geste compris — et, selon l'issue, gagne l'état réglé : s'il tue la cible, ou si elle
    en réchappe. C'est le porteur qui reçoit l'état, jamais la cible. */
 attaqueetat:{cle:'attaqueetat',nom:'Attaque d’état',anciens:['Attaque État'],type:'act',bouton:'⚔ Attaque d’état',attaque:true,
  aide:'Action : le porteur effectue une attaque et, selon son issue, gagne un état.',
  params:[{cle:'condition',nom:'Le porteur gagne l’état si',type:'choix',defaut:'tue',
    options:[['tue','il tue la cible'],['survit','la cible n’est pas tuée']]},
   {cle:'etat',nom:'État gagné',type:'choix',defaut:'',options:CHOIX_ETAT}],
  phrase(p){const e=p&&p.etat,c=p&&p.condition;
   return 'Le porteur effectue <b>une attaque</b>. '+(c==='survit'?'Si <b>la cible n’est pas tuée</b>':'S’il <b>tue la cible</b>')
    +', il gagne <b>'+(e||'un état à régler')+'</b>.'}},
 /* Meneur : un passif. Le porteur augmente les dégâts, la DEF ou — temporairement — les
    PV max d'un, deux ou tous ses alliés au contact ou dans sa ligne de vue : les plus
    proches d'abord. C'est la table qui sait qui est où ; le moteur ne fait que choisir. */
 /* Meneur : un passif. Le porteur augmente les dégâts, la DEF ou les PV max de ses alliés :
    le plus proche, les deux plus proches ou tous, au contact, en vue ou n'importe où ; d'un
    nombre fixe, ou de son propre bonus (ses dégâts, sa DEF). Chaque palier a ses réglages. */
 meneur:{cle:'meneur',nom:'Meneur',type:'pass',
  aide:'Passif : le porteur augmente les dégâts, la DEF ou les PV max, temporairement, de son allié le plus proche, de deux ou de tous ses alliés, au contact, en vue ou n’importe où ; d’un nombre fixe, ou de son propre bonus.',
  params:[{cle:'quoi',nom:'Ce qu’il augmente',type:'choix',defaut:'dmg',options:[['dmg','les dégâts'],['def','la DEF'],['pv','les PV max, temporairement']]},
   {cle:'base',nom:'De combien',type:'choix',defaut:'fixe',options:[['fixe','un nombre fixe'],['porteur','le bonus du porteur : ses dégâts, sa DEF']]},
   {cle:'valeur',nom:'Nombre fixe',type:'nombre',defaut:1,min:1,max:20},
   {cle:'combien',nom:'Pour',type:'choix',defaut:'un',options:[['un','l’allié le plus proche'],['deux','les deux alliés les plus proches'],['tous','tous les alliés']]},
   {cle:'portee',nom:'Qui se trouve',type:'choix',defaut:'contact',options:[['contact','au contact'],['vue','dans la ligne de vue'],['partout','n’importe où']]}],
  phrase(p){const quoi=(p&&p.quoi)||'dmg',q={dmg:'les dégâts',def:'la DEF',pv:'les PV max temporaires'}[quoi]||'les dégâts';
   const qui={un:'votre allié le plus proche',deux:'vos deux alliés les plus proches',tous:'tous vos alliés'}[p&&p.combien]||'votre allié le plus proche';
   const ou={vue:' dans votre ligne de vue',partout:''}[p&&p.portee]??' au contact';
   const de=bonusDuMeneur(p)?(quoi==='def'?'votre DEF':'vos dégâts'):'+'+Math.max(1,(p&&p.valeur)|0);
   return 'Vous augmentez <b>'+q+'</b> de <b>'+qui+ou+'</b> de <b>'+de+'</b>.'}},
 /* Bonus de caractéristique : un nœud d'arbre qui n'est pas un talent. Appris, il ajoute
    à la fiche : des PV max, de l'Endurance, de la Vie, des dégâts, ou un point à une
    compétence. La fiche garde ses valeurs propres ; le bonus s'ajoute à la lecture. */
 bonus:{cle:'bonus',nom:'Bonus de caractéristique',type:'pass',
  aide:'Un nœud d’arbre qui n’est pas un talent : +x PV max, Endurance, Vie, Dégâts, Orbes mystiques, ou un point à une compétence.',
  params:[{cle:'carac',nom:'Caractéristique',type:'choix',defaut:'pv',options:[['pv','PV max'],['endu','Endurance'],['vie','Vie'],['dmg','Dégâts'],['orbe','Orbe mystique'],['comp','Compétence']]},
   {cle:'valeur',nom:'Bonus',type:'nombre',defaut:1,min:1,max:20},
   {cle:'comp',nom:'Compétence',type:'choix',defaut:'0',options:COMPETENCES.map((n,i)=>[String(i),n])}],
  phrase(p){return '<b>'+libelleBonus(p)+'</b>.'}},
 /* Provocation : une action. Un adversaire en ligne de vue doit faire un mouvement vers le
    porteur — l'adversaire visé s'il est en vue, sinon le premier en vue — jusqu'au contact,
    les murs l'arrêtant ; puis le porteur effectue une attaque contre lui. */
 /* Ignition : une amélioration. L'orbe ne frappe plus, il allume : lancé sur un allié, il
    charge sa prochaine attaque au contact de l'affection que portent les orbes. L'allié doit
    être désigné — on ne brûle pas un camarade par mégarde. Là encore, le prérequis est au
    MJ : le moteur n'impose rien au-dessus. */
 ignition:{cle:'ignition',nom:'Ignition',court:'Ignition',type:'ame',
  aide:'Un orbe lancé sur un allié désigné charge sa prochaine attaque au contact, au lieu de blesser.',
  params:[],
  phrase(){return 'Un orbe lancé sur un <b>allié désigné</b> ne lui fait aucun mal : sa <b>prochaine attaque au contact</b> inflige l’affection des orbes du porteur.'}},
 /* Déluge : une action. Le porteur lance d'un coup tous les orbes qu'il lui reste ce tour, sur
    un même adversaire, en un seul jet commun où tous ses bonus s'appliquent une fois. */
 deluge:{cle:'deluge',nom:'Déluge',type:'act',bouton:'✦ Déluge',
  aide:'Action : le porteur lance tous ses orbes restants ensemble, contre un même adversaire, en un seul jet.',
  params:[],
  phrase(){return 'Le porteur lance <b>tous ses orbes</b> ensemble contre <b>un même adversaire</b>, en <b>un seul jet</b> de dés commun.'}},
 /* Orbes critiques : une amélioration. Les orbes du porteur peuvent faire des critiques sur un double 6. */
 /* Les dégâts d'un état — Feu qui brûle, décharge de Foudre, Éruption, Poison : un talent les fait
    ignorer au porteur ; ses améliorations les changent en soin, puis en soin doublé. */
 ignoredegats:{cle:'ignoredegats',nom:'Ignore les dégâts',anciens:['Ignore les dégâts d’un état'],type:'pass',
  aide:'Passif : le porteur ne subit pas les dégâts de l’état réglé (Feu qui brûle, décharge de Foudre, Éruption, Poison).',
  params:[{cle:'etat',nom:'État',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Le porteur <b>ignore les dégâts</b> de <b>'+((p&&p.etat)||'Feu')+'</b>.'}},
 soinetat:{cle:'soinetat',nom:'Dégâts d’état en soin',court:'soin',type:'ame',
  aide:'Amélioration : les dégâts de l’état que le porteur ignore, ou auquel il est insensible, le soignent.',params:[],
  phrase(){return 'Les dégâts de l’état que le porteur <b>ignore</b> le <b>soignent</b>.'}},
 soinetatdouble:{cle:'soinetatdouble',nom:'Dégâts d’état en soin ×2',court:'soin ×2',type:'ame',
  aide:'Amélioration : les dégâts de l’état que le porteur ignore, ou auquel il est insensible, le soignent deux fois.',params:[],
  phrase(){return 'Les dégâts de l’état que le porteur <b>ignore</b> le <b>soignent deux fois</b>.'}},
 /* Améliorations des Orbes, de Déluge et d'Implosion ; la Contagion et les siennes. */
 orbes2des:{cle:'orbes2des',nom:'Orbes à deux dés',court:'deux dés',type:'ame',aide:'Amélioration : chaque orbe lance deux dés.',params:[],
  phrase(){return 'Vos <b>orbes</b> lancent <b>2 dés</b>.'}},
 orbesrouges:{cle:'orbesrouges',nom:'Orbes lourds',court:'dés lourds',type:'ame',aide:'Amélioration : les orbes lancent des dés rouges (Lourds) au lieu de leurs dés.',params:[],
  phrase(){return 'Vos <b>orbes</b> lancent des <b>dés rouges</b>.'}},
 orbescritun:{cle:'orbescritun',nom:'Critique : un orbe rendu',court:'critique : un orbe rendu',type:'ame',aide:'Amélioration : un critique d’orbe rend un orbe pour le tour.',params:[],
  phrase(){return 'Un <b>critique</b> de vos orbes vous <b>rend un orbe</b>.'}},
 orbescrittous:{cle:'orbescrittous',nom:'Critique : tous les orbes rendus',court:'critique : tous les orbes rendus',type:'ame',aide:'Amélioration : un critique d’orbe rend tous les orbes du tour.',params:[],
  phrase(){return 'Un <b>critique</b> de vos orbes vous <b>rend tous vos orbes</b>.'}},
 delugegratuit:{cle:'delugegratuit',nom:'Déluge gratuit',court:'gratuit',type:'ame',aide:'Amélioration de Déluge : il ne coûte plus l’Action.',params:[],
  phrase(){return '<b>Déluge</b> ne coûte plus l’<b>Action</b>.'}},
 implosionmouvement:{cle:'implosionmouvement',nom:'Implosion de mouvement',court:'point de Mouvement',type:'ame',aide:'Amélioration d’Implosion : un critique rend aussi 1 point de Mouvement.',params:[],
  phrase(){return 'Après un <b>critique</b>, le porteur gagne aussi <b>1 point de Mouvement</b>.'}},
 implosionorbe:{cle:'implosionorbe',nom:'Implosion d’orbe',court:'orbe rendu',type:'ame',aide:'Amélioration d’Implosion : un critique rend aussi un orbe pour le tour.',params:[],
  phrase(){return 'Après un <b>critique</b>, le porteur récupère aussi <b>un orbe</b>.'}},
 /* Mitraille : un passif. Chaque orbe lancé en fait partir un autre, sans le compter, sur l'autre adversaire
    le plus proche ; ses améliorations visent un adversaire de plus, ou lancent un orbe de plus sur chacun. */
 mitraille:{cle:'mitraille',nom:'Mitraille',type:'pass',aide:'Passif : quand le porteur lance un orbe, il en lance aussi un sur l’autre adversaire le plus proche.',
  params:[{cle:'cibles',nom:'Autres adversaires',type:'nombre',defaut:1,min:1,max:6},{cle:'orbes',nom:'Orbes par adversaire',type:'nombre',defaut:1,min:1,max:3}],
  phrase(p){const c=Math.max(1,Math.trunc(p&&p.cibles)||1),o=Math.max(1,Math.trunc(p&&p.orbes)||1);
   return 'Quand le porteur lance un <b>orbe</b>, il lance automatiquement <b>'+(o>1?o+' orbes':'un orbe')+'</b> sur '+(c>1?'<b>les '+c+' autres adversaires les plus proches</b>':'<b>l’autre adversaire le plus proche</b>')+'.'}},
 mitraillecibles:{cle:'mitraillecibles',nom:'Mitraille — un adversaire de plus',court:'un adversaire de plus',type:'ame',aide:'Amélioration de Mitraille : elle vise un adversaire de plus.',params:[],
  phrase(){return 'La <b>Mitraille</b> vise <b>un adversaire de plus</b>.'}},
 mitrailleorbes:{cle:'mitrailleorbes',nom:'Mitraille — un orbe de plus',court:'un orbe de plus',type:'ame',aide:'Amélioration de Mitraille : un orbe de plus sur chaque adversaire.',params:[],
  phrase(){return 'La <b>Mitraille</b> lance <b>un orbe de plus</b> sur chaque adversaire.'}},
 contagion:{cle:'contagion',nom:'Contagion',type:'pass',aide:'Passif : au début de chaque tour, le porteur inflige l’état réglé à un adversaire à son contact.',
  params:[{cle:'etat',nom:'État',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Au <b>début de chaque tour</b>, le porteur inflige <b>'+((p&&p.etat)||'Feu')+'</b> à <b>un adversaire</b> à son contact.'}},
 contagioncontact:{cle:'contagioncontact',nom:'Contagion au contact',court:'au contact',type:'ame',aide:'Amélioration de Contagion : tous les adversaires au contact la subissent.',params:[],
  phrase(){return 'La <b>Contagion</b> touche <b>tous les adversaires au contact</b>.'}},
 contagionvue:{cle:'contagionvue',nom:'Contagion en vue',court:'en vue',type:'ame',aide:'Amélioration de Contagion : tous les adversaires visibles la subissent.',params:[],
  phrase(){return 'La <b>Contagion</b> touche <b>tous les adversaires visibles</b>.'}},
 /* Orbes inratables : une amélioration. Les orbes du porteur ne font jamais d'échec sur un double 1. */
 orbesinratables:{cle:'orbesinratables',nom:'Orbes inratables',court:'inratables',type:'ame',
  aide:'Amélioration : les Orbes mystiques du porteur ne peuvent pas produire d’échec (double 1).',
  params:[],
  phrase(){return 'Vos <b>Orbes mystiques</b> ne peuvent pas produire d’<b>échec</b> (double 1).'}},
 orbescritiques:{cle:'orbescritiques',nom:'Orbes critiques',court:'critiques',type:'ame',
  aide:'Amélioration : les Orbes mystiques du porteur peuvent produire des critiques (double 6).',
  params:[],
  phrase(){return 'Vos <b>Orbes mystiques</b> peuvent produire des <b>critiques</b> (double 6).'}},
 /* Éruption : un passif. Un adversaire qui meurt en portant l'état réglé le fait éclater : tous
    les adversaires à son contact le reçoivent. Suit l'élément du Mystique. Deux améliorations :
    les dégâts de l'état — un dé par cran — puis ces dégâts doublés. */
 eruption:{cle:'eruption',nom:'Éruption',type:'pass',
  aide:'Passif : quand un adversaire portant l’état réglé est tué, tous les adversaires à son contact le subissent.',
  params:[{cle:'etat',nom:'État qui éclate',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){const e=(p&&p.etat)||'Feu';return 'Quand un adversaire portant <b>'+e+'</b> est tué, tous les adversaires <b>à son contact</b> subissent <b>'+e+'</b>.'}},
 eruptiondegats:{cle:'eruptiondegats',nom:'Éruption — dégâts',court:'dégâts',type:'ame',
  aide:'Amélioration d’Éruption : les adversaires touchés subissent aussi les dégâts de l’état du mort, un dé par cran (Feu 4 : 4d6).',params:[],
  phrase(){return 'L’<b>Éruption</b> inflige aussi les <b>dégâts</b> de l’état du mort : un dé par cran.'}},
 eruptiondouble:{cle:'eruptiondouble',nom:'Éruption — double',court:'dégâts doublés',type:'ame',
  aide:'Amélioration d’Éruption : les dégâts de l’Éruption sont doublés.',params:[],
  phrase(){return 'Les dégâts de l’<b>Éruption</b> sont <b>doublés</b>.'}},
 /* Implosion : un passif. Un critique rend au porteur le point d'Action qu'il vient de dépenser. */
 implosion:{cle:'implosion',nom:'Implosion',type:'pass',
  aide:'Passif : après un critique, le porteur gagne 1 point d’Action.',
  params:[],
  phrase(){return 'Après avoir réalisé un <b>critique</b>, le porteur gagne <b>1 point d’Action</b>.'}},
 /* Dégâts élémentaires : un passif. Les orbes du porteur ajoutent son bonus de dégâts. */
 degatselem:{cle:'degatselem',nom:'Dégâts élémentaires',type:'pass',
  aide:'Passif : le porteur ajoute son bonus de dégâts à ses orbes.',
  params:[],
  phrase(){return 'Le porteur ajoute son <b>bonus de dégâts</b> à ses <b>orbes</b>.'}},
 /* Invulnérable : une amélioration. L'affection réglée ne prend jamais sur le porteur, d'où
    qu'elle vienne — arme, orbe, objet ou main du MJ par un effet. */
 invulnerable:{cle:'invulnerable',nom:'Invulnérable',type:'ame',
  aide:'Amélioration : le porteur ne subit jamais l’état réglé, ou n’est plus entamé par une couleur de dés.',
  params:[{cle:'contre',nom:'Insensible à',type:'choix',defaut:'etat',commun:true,options:[['etat','un état'],['des','une couleur de dés']]},
   {cle:'etat',nom:'État jamais subi',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])},
   {cle:'des',nom:'Couleur de dés',type:'choix',defaut:'red',commun:true,options:DES_ORBE}],
  phrase(p){if((p&&p.contre)==='des')return 'Le porteur est <b>insensible aux dés '+((DES_ORBE.find(([k])=>k===(p&&p.des))||DES_ORBE[2])[1])+'s</b> : ils ne l’entament plus.';
   return 'Le porteur ne subit <b>jamais '+((p&&p.etat)||'Feu')+'</b>.'}},
 /* Brise : une amélioration contre une cible qui porte l'affection réglée, en trois volets —
    ignorer sa DEF, lui en retirer pour de bon après l'attaque, doubler les dégâts. Chacun
    s'ouvre au palier que le MJ choisit (1, 2 et 3 d'ordinaire) et le reste aux suivants. */
 brise:{cle:'brise',nom:'Brise',type:'ame',
  aide:'Amélioration contre les cibles portant l’état réglé : ignorer leur DEF, leur en retirer pour de bon, doubler les dégâts, chacun au palier choisi.',
  params:[{cle:'etat',nom:'État qui ouvre la garde',type:'choix',defaut:'Gel',options:ETATS_JEU.map(e=>[e,e])},
   {cle:'perte',nom:'DEF retirée',type:'nombre',defaut:1,min:1,max:6,volet:'perte'}],
  volets:[{cle:'ignore',nom:'Ignore la DEF de la cible',palier:1},{cle:'perte',nom:'Lui retire de la DEF pour de bon après l’attaque',palier:2},
   {cle:'double',nom:'Double les dégâts',palier:3}],
  phrase(p,palier,v){const e=(p&&p.etat)||'Gel',n=Math.max(1,Math.trunc(Number(palier))||1),perte=Math.max(1,(p&&p.perte)|0);
   const ouvert=k=>!!v&&v[k]>0&&n>=v[k];
   const faits=[ouvert('ignore')?'<b>ignorent sa DEF</b>':'',ouvert('perte')?'lui <b>retirent '+perte+' DEF</b> pour de bon après l’attaque':'',
    ouvert('double')?'font <b>le double de dégâts</b>':''].filter(Boolean);
   if(!faits.length)return 'Contre une cible qui porte <b>'+e+'</b> : rien encore à ce palier.';
   return 'Contre une cible qui porte <b>'+e+'</b>, les attaques du porteur '+(faits.length>1?faits.slice(0,-1).join(', ')+' et '+faits[faits.length-1]:faits[0])+'.'}},
 /* Solidité : une amélioration. La DEF du porteur écarte aussi les dés Lourds — le rouge,
    qui l'ignore chez tout autre. Le Mortel, noir, passe toujours en entier. */
 solidite:{cle:'solidite',nom:'Solidité',type:'ame',
  aide:'Amélioration : la DEF du porteur écarte aussi les dés rouges (Lourds), qui d’ordinaire l’ignorent.',
  params:[],
  phrase(){return 'La DEF du porteur écarte aussi les <b>dés de dégâts mortels</b> (rouges).'}},
 /* Provocation : un adversaire en vue s'avance au contact du porteur, rien de plus. Ses
    améliorations y ajoutent le coup (Provocation — attaque) et la chute (Provocation — au sol). */
 provocation:{cle:'provocation',nom:'Provocation',type:'act',bouton:'📣 Provocation',attaque:true,
  aide:'Action : un adversaire en vue s’avance jusqu’au contact du porteur.',
  params:[],
  phrase(){return 'Un adversaire <b>en ligne de vue</b> doit faire un mouvement vers le porteur — l’adversaire visé, sinon le premier en vue — jusqu’à son <b>contact</b>.'}},
 provocattaque:{cle:'provocattaque',nom:'Provocation — attaque',court:'attaque',type:'ame',
  aide:'Amélioration de Provocation : le porteur attaque aussitôt l’adversaire provoqué.',params:[],
  phrase(){return 'Après une <b>Provocation</b>, le porteur effectue <b>une attaque</b> contre l’adversaire provoqué.'}},
 provocsol:{cle:'provocsol',nom:'Provocation — au sol',court:'au sol',type:'ame',
  aide:'Amélioration de Provocation : l’adversaire provoqué tombe Au sol.',params:[],
  phrase(){return 'L’adversaire provoqué par une <b>Provocation</b> tombe <b>Au sol</b>.'}},
 /* Poussée : une action. Le porteur effectue une attaque, puis repousse la cible hors de sa
    zone de contact. Deux volets, chacun au palier que le MJ choisit : deux fois plus loin que
    la zone (palier 2 d'ordinaire), et tous les adversaires au contact (palier 3). */
 poussee:{cle:'poussee',nom:'Poussée',type:'act',bouton:'💥 Poussée',attaque:true,monstre:true,
  aide:'Action : le porteur attaque, puis repousse la cible hors de sa zone de contact ; deux fois plus loin, puis tous les adversaires au contact, aux paliers suivants.',
  params:[],
  volets:[{cle:'loin',nom:'Repousse à deux fois la zone de contact',palier:2},{cle:'tous',nom:'Repousse tous les adversaires au contact',palier:3}],
  phrase(p,palier,v){const n=Math.max(1,Math.trunc(Number(palier))||1),ouvert=k=>!!v&&v[k]>0&&n>=v[k];
   return 'Le porteur effectue <b>une attaque</b>, puis repousse '+(ouvert('tous')?'<b>tous les adversaires à son contact</b>':'<b>la cible</b>')
    +(ouvert('loin')?' à <b>deux fois sa zone de contact</b>.':' <b>hors de sa zone de contact</b>.')}}};
/* Chaque amélioration dit le talent qu'elle améliore : la bibliothèque la range dessous, et son nom
   s'écrit « Talent — court », d'un seul modèle pour toutes ; l'ancien nom reste connu, pour retrouver
   l'effet d'un talent nommé d'après lui. Celles qui ne sont liées à aucun talent en particulier restent
   seules, sous leur propre nom. */
{const POUR={orbes2des:'orbes',orbesrouges:'orbes',orbescritun:'orbes',orbescrittous:'orbes',delugegratuit:'deluge',implosionmouvement:'implosion',implosionorbe:'implosion',
 contagioncontact:'contagion',contagionvue:'contagion',mitraillecibles:'mitraille',mitrailleorbes:'mitraille',orbesfeu:'orbes',orbescritiques:'orbes',orbesinratables:'orbes',ignition:'orbes',lameventelem:'lamevent',
 provocattaque:'provocation',provocsol:'provocation',eruptiondegats:'eruption',eruptiondouble:'eruption',
 soinetat:'ignoredegats',soinetatdouble:'ignoredegats',corpselem:'invulnerable'};
 Object.entries(POUR).forEach(([k,p])=>{const c=TALENTS_CODES[k];if(!c||!TALENTS_CODES[p])return;c.pour=p;
  if(c.court){const nom=TALENTS_CODES[p].nom+' — '+c.court;if(nom!==c.nom){c.anciens=[...(c.anciens||[]),c.nom];c.nom=nom}}})}
/* ---------- Les effets d'équipement ----------
   Ce qu'un objet sait faire quand on s'en sert : même grammaire que les talents — une clé,
   des réglages, une phrase que le moteur écrit lui-même — et trois manières d'en user.
   Ce qu'il en advient à l'écran vit dans la table de jeu. */
const USAGES_OBJET=[['libre','À volonté'],['conso','Consommable — l’objet est défaussé'],
 ['court','Une fois entre deux repos courts'],['jour','Une fois par jour']];
// Les usages qui se comptent : une charge prise, et il faut un repos pour la rendre.
const USAGES_LIMITES=['court','jour'];
const usageLimite=u=>USAGES_LIMITES.includes(u);
const NOM_USAGE=u=>(USAGES_OBJET.find(([k])=>k===u)||USAGES_OBJET[0])[1];
const OBJETS_CODES={
 /* Soin : le porteur se remet d'aplomb — d'un montant fixe, de dés, ou de son Endurance ou
    sa Vie majorées, comme la Régénération d'un adversaire. */
 soin:{cle:'soin',nom:'Soin',aide:'Le porteur regagne des points de vie.',
  params:[{cle:'quantite',nom:'Quantité',type:'nombre',defaut:5,min:1,max:99},
   {cle:'forme',nom:'Sous la forme de',type:'choix',defaut:'fixe',
    options:[['fixe','PV'],['des','dés (d6)'],['endu','PV + Endurance'],['vie','PV + Vie']]}],
  phrase(p){const n=Math.max(1,(p&&p.quantite)|0),f=p&&p.forme;
   const combien=f==='des'?'<b>'+n+'d6</b>':f==='endu'?'<b>'+n+' + Endurance</b>':f==='vie'?'<b>'+n+' + Vie</b>':'<b>'+n+'</b>';
   return 'Le porteur se soigne de '+combien+' PV.'}},
 /* État : le porteur gagne l'affection réglée — un Blindage, une Onde, ce que le MJ veut. */
 etat:{cle:'etat',nom:'État',aide:'Le porteur reçoit l’état réglé.',
  params:[{cle:'etat',nom:'État obtenu',type:'choix',defaut:'Blindage',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Le porteur obtient <b>'+((p&&p.etat)||'Blindage')+'</b>.'},
  // Passif : l'état est donné quand la pièce se porte, et repris quand elle s'ôte.
  passif(p){return 'Tant qu’il porte la pièce, le porteur a <b>'+((p&&p.etat)||'Blindage')+'</b>.'}},
 /* Invulnérabilité : le porteur ne craint plus, jusqu'à la fin de la rencontre, soit une
    affection, soit une couleur de dés — ceux-là ne l'entament plus. */
 invulnerabilite:{cle:'invulnerabilite',nom:'Invulnérabilité',
  aide:'Le porteur devient insensible à un état, ou à une couleur de dés de dégâts.',
  params:[{cle:'contre',nom:'Insensible à',type:'choix',defaut:'etat',
    options:[['etat','un état'],['des','une couleur de dés']]},
   {cle:'etat',nom:'État',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])},
   {cle:'des',nom:'Couleur de dés',type:'choix',defaut:'red',options:DES_ORBE}],
  phrase(p){const quoi=(p&&p.contre)==='des'
    ?'aux dés <b>'+((DES_ORBE.find(([k])=>k===(p&&p.des))||DES_ORBE[2])[1])+'s</b>'
    :'à <b>'+((p&&p.etat)||'Feu')+'</b>';
   return 'Jusqu’à la fin de la rencontre, le porteur est <b>insensible</b> '+quoi+'.'},
  passif(p){const quoi=(p&&p.contre)==='des'
    ?'aux dés <b>'+((DES_ORBE.find(([k])=>k===(p&&p.des))||DES_ORBE[2])[1])+'s</b>'
    :'à <b>'+((p&&p.etat)||'Feu')+'</b>';
   return 'Tant qu’il porte la pièce, le porteur est <b>insensible</b> '+quoi+'.'}}};
/* Actif ou passif : une pièce d'équipement — arme, armure, munition — dont l'effet le permet
   peut agir d'elle-même, en permanence tant qu'elle est portée, sans bouton en combat. Un
   objet consommable reste actif : il s'emploie. */
const EQUIPEMENTS=['weapon','armor','ammo'];
function modeObjet(o){const code=objetCode(o);
 return o&&o.mode==='passif'&&code&&typeof code.passif==='function'&&EQUIPEMENTS.includes(o.category)?'passif':'actif'}
function phraseDeObjet(o){const code=objetCode(o);if(!code)return '';const p=paramsObjet(o);
 return modeObjet(o)==='passif'?code.passif(p):code.phrase(p)}
// Ce que confèrent les pièces portées à effet passif : des états refusés, des dés écartés, des états donnés.
function passifsPortes(a,items){const out={etats:[],des:[],donnes:[]};if(!a)return out;
 const ids=[...(a.weapons||[]),...armuresDe(a),a.shieldId,a.munitionId].filter(Boolean);
 gearOf([...new Set(ids)],items).forEach(o=>{if(modeObjet(o)!=='passif')return;const code=objetCode(o),p=paramsObjet(o);
  if(code.cle==='invulnerabilite'){if(p.contre==='des'){if(!out.des.includes(p.des))out.des.push(p.des)}else if(!out.etats.includes(p.etat))out.etats.push(p.etat)}
  else if(code.cle==='etat'&&p.etat&&!out.donnes.includes(p.etat))out.donnes.push(p.etat)});
 return out}
function objetCode(o){return o&&OBJETS_CODES[o.effet]||null}
// Les réglages d'un objet, relus au travers de la déclaration de son effet : rien d'illisible n'entre.
function paramsObjet(o){const code=objetCode(o);if(!code)return null;
 const out={};(code.params||[]).forEach(p=>{out[p.cle]=reglageTalent(code,o&&o.params,p.cle)});return out}
function phraseObjet(cle,params){const code=OBJETS_CODES[cle];
 return code?code.phrase(paramsObjet({effet:cle,params})):''}
// L'usage d'un objet : à volonté, consommable, ou une fois par jour.
function usageObjet(o){const u=o&&o.usage;
 return USAGES_OBJET.some(([k])=>k===u)?u:(o&&o.consumable?'conso':'libre')}
/* Ce dont un combattant est devenu insensible : les états qu'il ne subit plus, les couleurs
   de dés qui ne l'entament plus. */
function immunites(a){const i=a&&a.immunites;
 return {etats:Array.isArray(i&&i.etats)?i.etats:[],des:Array.isArray(i&&i.des)?i.des:[]}}
function immuniseEtat(a,etat){return !!etat&&immunites(a).etats.includes(etat)}
function immuniseDe(a,couleur){return !!couleur&&immunites(a).des.includes(couleur)}
function poseImmunite(a,quoi,valeur){if(!a||!valeur)return false;
 const i=immunites(a);if(i[quoi].includes(valeur))return false;
 a.immunites={etats:[...i.etats],des:[...i.des]};a.immunites[quoi].push(valeur);return true}
/* Mauvais Sort : le meilleur dé de l'attaquant — la plus haute face, le premier en cas
   d'égalité — est relancé sur place, avant tout calcul. La relance peut être meilleure. */
function mauvaisSort(dice,roll){if(!Array.isArray(dice)||!dice.length)return null;
 let i=0;dice.forEach((d,k)=>{if(d[0]>dice[i][0])i=k});
 const avant=dice[i][0],apres=roll();dice[i]=[apres,dice[i][1]];return {index:i,avant,apres}}
/* Rempart : la part du mur. La moitié, arrondie au-dessus, et jamais plus que les dégâts. */
function partDuRempart(degats){const d=Math.max(0,Math.trunc(degats)||0);return Math.ceil(d/2)}
function porteEffet(portes,cle){return (portes||[]).some(t=>t&&t.code&&t.code.cle===cle)}
/* Ce que les orbes d'un porteur valent, d'après ce qu'il tient : combien par activation,
   quels dégâts, et l'état que l'amélioration y ajoute. Plusieurs talents d'orbes ne se
   cumulent pas : le plus généreux fait foi. */
/* Les nœuds « +1 Orbe mystique » de l'arbre s'y ajoutent, autant qu'on en a appris ; sans
   talent d'orbes, ils ne donnent rien : il n'y a pas d'orbe à lancer. */
function orbesPermis(portes){const base=(portes||[]).filter(t=>t&&t.code&&t.code.cle==='orbes')
 .reduce((n,t)=>Math.max(n,Math.trunc(t.params&&t.params.orbes)||0),0);if(!base)return 0;
 return base+(portes||[]).filter(t=>t&&t.code&&t.code.cle==='bonus'&&t.params&&t.params.carac==='orbe').reduce((n,t)=>n+Math.max(1,Math.trunc(t.params.valeur)||1),0)}
/* Les dés d'un orbe : le talent le plus généreux en dés fait foi, avec sa couleur. */
function desOrbe(portes){const t=(portes||[]).filter(t=>t&&t.code&&t.code.cle==='orbes')
 .sort((u,v)=>(Math.trunc(v.params&&v.params.des)||0)-(Math.trunc(u.params&&u.params.des)||0))[0];
 if(!t)return null;const a=cle=>(portes||[]).some(x=>x&&x.code&&x.code.cle===cle);
 // Orbes lourds : des dés rouges ; Orbes à deux dés : deux dés au moins.
 const couleur=a('orbesrouges')?'red':DES_ORBE.some(([k])=>k===(t.params&&t.params.couleur))?t.params.couleur:'blue';
 return {n:Math.max(a('orbes2des')?2:1,Math.trunc(t.params&&t.params.des)||1),couleur,nom:DES_ORBE.find(([k])=>k===couleur)[1]}}
function etatDesOrbes(portes){const t=(portes||[]).find(t=>t&&t.code&&t.code.cle==='orbesfeu');
 return t?String(t.params&&t.params.etat||'Feu'):''}
/* L'état des orbes au palier tenu : ce qu'il faut pour qu'il prenne — un 6 parmi les dés, ou
   la seule touche — et combien de crans il pose. Null tant qu'aucun volet ne l'ouvre. Deux
   crans ne valent que pour un état qui s'empile. */
function etatOrbeAuPalier(portes){const t=(portes||[]).find(t=>t&&t.code&&t.code.cle==='orbesfeu');if(!t)return null;
 // Paliers en sommeil : l'orbe emporte l'état, un cran ; s'il blesse, ou toujours, selon le réglage « Quand ».
 if(!PALIERS.actifs)return {etat:String(t.params&&t.params.etat||'Feu'),six:false,crans:1,blesse:!(t.params&&t.params.quand==='toujours')};
 const n=Math.max(1,Math.min(PALIERS_MAX,Math.trunc(Number(t.talent&&t.talent.palier))||1));
 const v=voletsDe({...(t.talent||{}),effet:'orbesfeu'}),ouvert=k=>v[k]>0&&n>=v[k];
 if(!ouvert('six')&&!ouvert('touche'))return null;
 const etat=String(t.params&&t.params.etat||'Feu');
 return {etat,six:!ouvert('touche'),crans:ouvert('deux')&&cumulable(etat)?2:1}}
// Ce que l'état des orbes demande, en une ligne : « Feu sur 6+ », « Feu à la touche », « Feu 2 à la touche ».
const ditEtatOrbe=o=>o?o.etat+(o.crans>1?' '+o.crans:'')+(o.blesse?' s’il blesse':o.six?' sur 6+':' à la touche'):'';
/* Une affection que le porteur ne subit jamais : Invulnérable la refuse avant qu'elle ne
   se pose, d'où qu'elle vienne. */
function etatRefuse(portes,etat){if(!etat)return false;
 return (portes||[]).some(t=>t&&t.code&&t.code.cle==='invulnerable'&&(t.params&&t.params.contre)!=='des'&&String(t.params&&t.params.etat||'Feu')===etat)}
// Les couleurs de dés dont un talent Invulnérable rend le porteur insensible.
function desRefuses(portes){return (portes||[]).filter(t=>t&&t.code&&t.code.cle==='invulnerable'&&t.params&&t.params.contre==='des').map(t=>String(t.params.des||'red'))}
/* Brise contre une cible : pour chaque Brise dont l'état est sur elle, les volets que son
   palier a ouverts — la DEF ignorée, la DEF retirée après l'attaque, les dégâts doublés. */
function briseContre(portes,cible){let palier=0,perte=0,etat='',ignore=false,double=false;
 (portes||[]).forEach(t=>{if(!t||!t.code||t.code.cle!=='brise')return;const e=String(t.params&&t.params.etat||'Gel');if(!hasState(cible,e))return;
  const n=Math.max(1,Math.min(PALIERS_MAX,Math.trunc(Number(t.talent&&t.talent.palier))||1));
  const v=voletsDe({...(t.talent||{}),effet:'brise'}),ouvert=k=>v[k]>0&&n>=v[k];
  if(n>palier){palier=n;etat=e}
  if(ouvert('ignore'))ignore=true;if(ouvert('double'))double=true;
  if(ouvert('perte'))perte=Math.max(perte,Math.max(1,Math.trunc(Number(t.params&&t.params.perte))||1))});
 return {palier,etat,ignore,perte,double}}
function briseLaGarde(portes,cible){return briseContre(portes,cible).ignore}
/* ---------- Les points d'activation ----------
   Ce qu'un combattant peut dépenser dans son tour : une Action, un Mouvement et un Objet
   d'ordinaire. Des talents en donneront davantage ; le jeu est prêt à les compter, jusqu'à
   ces plafonds. Les comptes vivent dans « checks », qui portait des oui-non : un ancien
   « true » vaut un point dépensé, et tout ce qui lisait « a-t-il joué ? » lit toujours vrai. */
const POINTS_MAX={action:4,mouvement:3,objet:1};
const POINTS_CLES=['action','mouvement','objet'];
/* Combien il en a : ce que sa fiche déclare, borné au plafond, un au moins. Le Mouvement peut
   en compter davantage le temps d'un tour (« mvtBonus » : Rapide, Rebond), au-delà du plafond. */
function pointsMax(a,quoi){const plafond=POINTS_MAX[quoi]||1;
 const v=Math.trunc(Number(a&&a.points&&a.points[quoi])),bonus=quoi==='mouvement'?Math.max(0,Math.min(9,Math.trunc(Number(a&&a.mvtBonus))||0)):0;
 return Math.max(1,Math.min(plafond+bonus,(Number.isFinite(v)&&v>0?v:1)+bonus))}
// Combien il en a dépensés, jamais plus qu'il n'en a.
function pointsUses(a,quoi){const i=POINTS_CLES.indexOf(quoi);if(i<0)return 0;
 const c=a&&a.checks&&a.checks[i];
 const n=c===true?1:Math.max(0,Math.trunc(Number(c))||0);
 return Math.min(pointsMax(a,quoi),n)}
function pointsRestants(a,quoi){return pointsMax(a,quoi)-pointsUses(a,quoi)}
// Dépenser, rendre : le compte bouge d'un cran, et reste entre zéro et le plafond.
function poseUses(a,quoi,n){const i=POINTS_CLES.indexOf(quoi);if(i<0||!a)return 0;
 if(!Array.isArray(a.checks))a.checks=[0,0,0];
 a.checks[i]=Math.max(0,Math.min(pointsMax(a,quoi),Math.trunc(n)||0));return a.checks[i]}
function depensePoint(a,quoi,n=1){return poseUses(a,quoi,pointsUses(a,quoi)+n)}
function rendPoint(a,quoi,n=1){return poseUses(a,quoi,pointsUses(a,quoi)-n)}
// Tout dépenser d'un coup, ou tout rendre : ce que coche la case d'activation.
function epuisePoints(a,quoi){return poseUses(a,quoi,pointsMax(a,quoi))}
/* ---------- Les prérequis ----------
   Une amélioration ne s'apprend qu'au-dessus d'un autre talent. Deux façons de le dire :
   la fiche du talent nomme un talent du catalogue (« prerequis »), ou son effet en réclame
   un autre par sa clé (« requiert ») — Orbes de feu ne va pas sans Orbes mystiques, quel
   que soit le nom que le MJ a donné à ce dernier. Le catalogue est passé en argument : le
   moteur n'en tient pas. */
function talentDuCatalogue(talents,id){return (talents||[]).find(t=>t&&t.id===id)||null}
/* Ce qui manque au porteur pour apprendre ce talent : le nom du prérequis absent, ou rien. */
function manqueTalent(portes,t,talents){const ids=portes||[];
 if(t&&t.prerequis){const p=talentDuCatalogue(talents,t.prerequis);
  if(p&&p.id!==t.id&&!ids.includes(p.id))return p.name}
 const code=talentCode(t);
 if(code&&code.requiert&&!ids.some(id=>{const x=talentDuCatalogue(talents,id);return !!x&&x.effet===code.requiert}))
  return (TALENTS_CODES[code.requiert]||{}).nom||code.requiert;
 return ''}
/* Le nom du prérequis d'un talent, tel que la bibliothèque et le sélecteur l'écrivent. */
function nomPrerequis(t,talents){if(t&&t.prerequis){const p=talentDuCatalogue(talents,t.prerequis);
  if(p&&p.id!==t.id)return p.name}
 const code=talentCode(t);return code&&code.requiert?(TALENTS_CODES[code.requiert]||{}).nom||'':''}
/* Les talents du catalogue qui reposent sur celui-ci, directement. */
function talentsDependants(t,talents){if(!t)return [];
 return (talents||[]).filter(x=>x&&x.id!==t.id&&(x.prerequis===t.id
  ||(talentCode(x)&&talentCode(x).requiert&&t.effet===talentCode(x).requiert)))}
/* Retirer un talent entraîne ce qui reposait sur lui : on relit la liste jusqu'à ce que
   plus rien n'y manque. Renvoie la liste épurée et les noms de ce qui est tombé. */
function talentsSans(portes,id,talents){let liste=(portes||[]).filter(x=>x!==id);const tombes=[];
 for(let encore=true;encore;){encore=false;
  for(const x of liste){const t=talentDuCatalogue(talents,x);
   if(t&&manqueTalent(liste,t,talents)){liste=liste.filter(y=>y!==x);tombes.push(t.name);encore=true;break}}}
 return {liste,tombes}}
/* Les talents que le porteur tient vraiment : ceux dont le prérequis est là. Une
   amélioration orpheline — son socle oublié, ou retiré du catalogue — ne fait rien. */
function talentsTenus(portes,talents){return (portes||[]).map(id=>talentDuCatalogue(talents,id))
 .filter(t=>t&&!manqueTalent(portes,t,talents))}
/* ---------- Les paliers ---------- */
/* Un talent se prend en trois paliers : le premier l'apprend, les suivants le font évoluer.
   Chaque palier a son texte, ses réglages et son coût en points de talent (PT). Le palier 1
   est le talent lui-même — effects, params — ; les paliers 2 et 3 vivent dans t.paliers[n], et
   ce qu'un palier ne redit pas, il le garde de celui d'en dessous. Un bonus de caractéristique
   n'a qu'un palier. Un aventurier retient le sien dans paliersTalents — absent, c'est 1. */
const PALIERS_MAX=3;
/* Les paliers sont en sommeil, le modèle va changer : un talent se joue, se lit et se paie à son
   palier 1. Ce qu'on a écrit pour les paliers 2 et 3 reste dans le catalogue, intact, sans agir ;
   « actifs » les rallume. */
const PALIERS={actifs:false};
const paliersDe=t=>!PALIERS.actifs||t&&t.effet==='bonus'?1:PALIERS_MAX;
const coutPalier=(t,n)=>Math.max(0,Math.trunc(Number((t&&Array.isArray(t.couts)?t.couts:[])[n-1]))||0);
function talentAuPalier(t,n){if(!t)return t;n=Math.max(1,Math.min(paliersDe(t),Math.trunc(Number(n))||1));
 let params=t.params,effects=t.effects;
 for(let i=2;i<=n;i++){const p=t.paliers&&t.paliers[i];if(!p||typeof p!=='object')continue;
  if(p.params&&typeof p.params==='object'&&Object.keys(p.params).length)params=p.params;
  if(typeof p.effects==='string'&&p.effects.trim())effects=p.effects}
 // Les réglages communs restent ceux du palier 1, quoi qu'un palier plus haut ait gardé.
 const code=talentCode(t);if(params!==t.params&&code&&t.params&&typeof t.params==='object'){const c={};
  (code.params||[]).forEach(p=>{if(reglageCommun(p)&&p.cle in t.params)c[p.cle]=t.params[p.cle]});params={...params,...c}}
 return n===1?t:{...t,params,effects,palier:n}}
function palierDe(a,t){if(!a||!t||!(a.talents||[]).includes(t.id))return 0;
 const n=Math.trunc(Number((a.paliersTalents||{})[t.id]))||1;return Math.max(1,Math.min(paliersDe(t),n))}
/* ---------- Les éléments du Mystique ---------- */
/* Un Mystique choisit un élément — Feu, Gel ou Foudre — et ses talents élémentaires le suivent.
   Un talent s'écrit une fois, avec des accolades que l'élément remplit : {élément} Feu, Gel,
   Foudre ; {mot} feu, glace, foudre — Brise{mot} fait Brisefeu, Briseglace, Brisefoudre ;
   {Mot} la même chose, capitale en tête ; {logo} feu, gel, foudre, pour spell_orbes_{logo}.
   Un talent coché « élémentaire » voit en plus son état réglé suivre celui de l'élément. */
const ELEMENTS=[{cle:'feu',nom:'Feu',etat:'Feu',mot:'feu',logo:'feu',teinte:'#e8842c'},{cle:'gel',nom:'Gel',etat:'Gel',mot:'glace',logo:'gel',teinte:'#8fd0ef'},{cle:'foudre',nom:'Foudre',etat:'Foudre',mot:'foudre',logo:'foudre',teinte:'#e8c230'}];
const CLASSES_ELEMENTAIRES=['mystique'];
const classeElementaire=c=>CLASSES_ELEMENTAIRES.includes(cleTalent(c));
const elementDe=a=>ELEMENTS.find(e=>e.cle===(a&&a.element))||null;
/* {élément}, {Élément}, {ELEMENT}, {etat}… : la casse et les accents ne comptent pas. Une
   accolade en capitale donne sa capitale, tout en capitales donne des capitales ; {logo},
   un nom de fichier, reste en minuscules. */
const ACCOLADES=/\{(\p{L}{3,12})\}/gu;
// La sorte d'une accolade, accents et casse ôtés : {élémént} vaut {élément} ; une inconnue, rien.
const sorteAccolade=k=>{const b=String(k).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return ['element','etat','mot','logo'].includes(b)?b:''};
const aDesAccolades=s=>typeof s==='string'&&[...s.normalize('NFC').matchAll(new RegExp(ACCOLADES.source,'gu'))].some(m=>sorteAccolade(m[1]));
function casseAccolade(k,mot){if(k.length>1&&k===k.toUpperCase())return mot.toUpperCase();
 return k[0]!==k[0].toLowerCase()?mot[0].toUpperCase()+mot.slice(1):mot}
function remplaceElement(texte,e){if(!e||!aDesAccolades(texte))return texte;
 return texte.normalize('NFC').replace(ACCOLADES,(m,k)=>{const s=sorteAccolade(k);if(!s)return m;
  return s==='logo'?e.logo:s==='mot'?casseAccolade(k,e.mot):k.length>1&&k===k.toUpperCase()?e.nom.toUpperCase():e.nom})}
// Un talent qui suit l'élément : coché élémentaire, ou écrit avec des accolades.
const estElementaire=t=>!!t&&(t.elementaire===true||[t.name,t.effects,t.logo,...Object.values(t.paliers||{}).map(p=>p&&p.effects)].some(aDesAccolades));
// Le talent tel que le voit et le joue un porteur de cet élément : ses mots remplis, son état réglé sur l'élément.
function talentPourElement(t,e){if(!t||!e||!estElementaire(t))return t;
 const etat=p=>t.elementaire===true&&p&&typeof p==='object'&&'etat' in p?{...p,etat:e.etat}:p;
 const pal={};Object.entries(t.paliers||{}).forEach(([n,p])=>{if(p&&typeof p==='object')pal[n]={...p,effects:remplaceElement(p.effects,e),...(p.params?{params:etat(p.params)}:{})}});
 /* Le logo suit aussi : celui que le MJ a choisi pour cet élément, s'il y en a un ; sinon {logo}
    se remplit, et un logo choisi à un élément fixe (…_feu, …_gel, …_foudre) passe à celui du porteur. */
 const propre=t.logos&&typeof t.logos==='object'&&typeof t.logos[e.cle]==='string'?t.logos[e.cle]:'';
 const logo=remplaceElement(t.logo,e),suffixe=new RegExp('_('+ELEMENTS.map(x=>x.logo).join('|')+')(\\.[a-z0-9]+)?$','i');
 return {...t,name:remplaceElement(t.name,e),effects:remplaceElement(t.effects,e),logo:propre||(typeof logo==='string'?logo.replace(suffixe,(m,x,ext)=>'_'+e.logo+(ext||'')):logo),params:etat(t.params),paliers:pal,elementVu:e.cle}}
// Les talents d'un combattant, chacun tel qu'il joue : à son élément, puis à son palier.
/* Deux améliorations à la suite sur un même chemin : cochée « Remplace le texte de l'amélioration
   précédente », la seconde est un renforcement — son texte et son effet prennent la place de ceux
   d'avant. Sinon les deux s'additionnent. Les bonus, eux, s'additionnent toujours. */
function sansAmeliorationsRemplacees(liste){const L=(liste||[]).filter(Boolean);
 const am=t=>t.effet!=='bonus'&&t.chemin&&typeof t.chemin==='object'&&t.chemin.de;
 return L.filter(t=>!am(t)||!L.some(u=>u!==t&&am(u)&&u.remplacePrecedente===true&&u.chemin.de===t.chemin.de&&u.chemin.dir===t.chemin.dir&&(Number(u.chemin.rang)||0)>(Number(t.chemin.rang)||0)))}
function talentsAuPalier(a,talents){const e=elementDe(a);return talentsTenus(a&&a.talents,talents).map(t=>talentAuPalier(talentPourElement(t,e),palierDe(a,t)))}
// Ce qu'a coûté l'arbre d'un aventurier : chaque palier acquis, au prix que le talent en demande.
function ptDepenses(a,talents){return talentsTenus(a&&a.talents,talents).reduce((s,t)=>{let n=0;for(let i=1;i<=palierDe(a,t);i++)n+=coutPalier(t,i);return s+n},0)}
/* L'XP paie les talents, les bonus et les améliorations : il reste à dépenser l'XP gagnée moins ce
   que coûte ce qu'il tient. Le niveau, lui, suit toute l'XP gagnée : dépenser ne le fait pas
   redescendre, et oublier un talent rend son prix. */
function xpDisponible(a,talents){return Math.max(0,Math.max(0,Math.trunc(Number(a&&a.xp))||0)-ptDepenses(a,talents))}
// Les paliers retenus : un entier de 2 au plafond, pour un talent appris ; le reste s'efface.
function normalisePaliersActeur(a){const src=a&&a.paliersTalents&&typeof a.paliersTalents==='object'&&!Array.isArray(a.paliersTalents)?a.paliersTalents:{},out={};
 Object.keys(src).slice(0,300).forEach(id=>{const n=Math.trunc(Number(src[id]));if(n>=2&&n<=PALIERS_MAX&&(a.talents||[]).includes(id))out[id]=n});return out}
/* Une liste de talents rangée en arbre : chaque amélioration suit son prérequis, avec sa
   profondeur, si celui-ci est dans la liste ; sinon elle reste à sa place, à la racine. */
function ordonneTalents(liste,talents){const out=[],vus=new Set();
 const dans=new Set((liste||[]).map(t=>t&&t.id));
 const socleDe=t=>{if(t.prerequis&&dans.has(t.prerequis)&&t.prerequis!==t.id)return t.prerequis;
  const code=talentCode(t);if(!code||!code.requiert)return null;
  const s=(liste||[]).find(x=>x&&x.id!==t.id&&x.effet===code.requiert);return s?s.id:null};
 const pose=(t,prof)=>{if(vus.has(t.id))return;vus.add(t.id);out.push([t,prof]);
  (liste||[]).filter(x=>x&&socleDe(x)===t.id).forEach(x=>pose(x,prof+1))};
 (liste||[]).forEach(t=>{if(t&&socleDe(t)===null)pose(t,0)});
 (liste||[]).forEach(t=>{if(t)pose(t,0)});   // un cycle, faute de racine, sort quand même
 return out}
/* Combien d'adversaires un combattant peut viser d'une même attaque : un, sauf si un
   talent passif l'augmente. Qui en porte plusieurs garde le plus généreux. */
function ciblesPermises(portes){let n=1;
 for(const t of portes||[]){if(!t||!t.code||t.code.cle!=='doubleattaque')continue;
  n=Math.max(n,Math.max(1,Math.trunc(t.params&&t.params.cibles)||1))}
 return n}
/* L'ordre canonique des cibles. Quand plusieurs sont éligibles à une attaque, une
   analyse ou un effet, on les prend toujours dans le même ordre, écrit une fois pour
   toutes : les plus proches du socle d'abord ; à distance égale — au pixel près — par
   type croissant, sbires, puis Élites, Solitaires et Boss ; à type égal, par numéro de
   socle, c'est-à-dire par place dans la liste des combattants. Les aventuriers comptent
   comme des sbires : la règle parle des types d'ennemis, et il faut bien que leur ordre
   soit défini aussi. Sans point de départ — ni combattant ni cadre — la distance ne
   compte pas et le type tranche d'abord. */
const RANG_TYPE={standard:0,alpha:1,solitaire:2,boss:3};
function rangType(a){return a&&!a.hero&&RANG_TYPE[a.type]!==undefined?RANG_TYPE[a.type]:0}
/* Trie des paires [combattant, place dans la liste], depuis un combattant et dans un
   cadre en pixels. On garde la place plutôt que le numéro affiché : c'est elle qui le
   produit, et elle est toujours à portée de main. */
function ordreCibles(paires,depuis,size){
 const mesure=depuis&&size&&size.width>0?o=>Math.round(tokenDistance(depuis,o,size)):()=>0;
 return [...(paires||[])].sort((u,v)=>
  mesure(u[0])-mesure(v[0])
  ||rangType(u[0])-rangType(v[0])
  ||u[1]-v[1])}
/* Le bonus de points de vie d'un aventurier : ce que lui donnent sa classe et son espèce,
   et rien d'autre — il ne se saisit pas. Les classes sont au catalogue ; les espèces
   n'ont pas encore de table, leur part vaut donc zéro, et le calcul l'attend déjà.
   De là découlent les points de vie maximum : Vie × Endurance + ce bonus. */
const ESPECES_PV={};
function pvEspece(nom){const cle=cleClasse(nom);return (cle&&ESPECES_PV[cle])||0}
function bonusPV(classes,role,espece){const c=classeDe(classes,role);
 return ((c&&Number(c.pv))||0)+pvEspece(espece)}
// Avec le catalogue, les nœuds de bonus appris comptent : Vie et Endurance majorées, PV max en plus.
function pvMaximum(classes,a,talents,items){const b=talents||items?bonusDe(a,talents,items):null;
 const vie=Math.max(1,Math.trunc(Number(a&&a.vie))||1)+(b?b.vie:0);
 const endu=Math.max(1,Math.trunc(Number(a&&a.endu))||1)+(b?b.endu:0);
 return Math.max(1,vie*endu+bonusPV(classes,a&&a.role,a&&a.race)+(b?b.pv:0))}
/* Les classes d'aventurier : un nom, une encre, et les points de vie qu'elles apportent.
   On les retrouve par leur nom réduit, et sur la seule tête du rôle : « Mystique »,
   « mystique » ou « Mystique · Voie du gel » désignent la même classe. Un rôle écrit
   librement reste possible — il n'a simplement pas de classe, donc pas de couleur propre. */
function cleClasse(nom){return cleTalent(String(nom||'').split('·')[0])}
function classeDe(classes,role){const k=cleClasse(role);
 return k?(classes||[]).find(c=>c&&cleClasse(c.name)===k)||null:null}
/* Un talent dit quel effet il porte, et non plus son seul nom : le nom est au joueur, la
   mécanique au moteur, et deux talents peuvent porter le même effet réglé autrement. */
function talentCode(t){return t&&TALENTS_CODES[t.effet]||null}
/* Les volets d'un effet à plusieurs facettes (Brise) et le palier qui ouvre chacun : celui
   que le MJ a choisi, sinon celui de la déclaration ; 0, jamais. */
function voletsDe(t){const code=talentCode(t),out={};if(!code||!Array.isArray(code.volets))return out;
 const src=t&&t.volets&&typeof t.volets==='object'?t.volets:{};
 code.volets.forEach(v=>{const n=Math.trunc(Number(src[v.cle]));out[v.cle]=v.cle in src&&n>=0&&n<=PALIERS_MAX?n:v.palier});return out}
/* Un réglage commun vaut pour les trois paliers : l'état d'un talent, ou le chiffre d'un volet.
   Il s'écrit une fois, au palier 1. */
const reglageCommun=p=>!!p&&(p.cle==='etat'||!!p.commun||!!p.volet);
/* La valeur d'un réglage, bornée par sa déclaration. Un talent enregistré avant qu'un
   réglage n'existe, ou avec une valeur hors bornes, reçoit celle par défaut : le moteur
   ne se fie jamais à ce qui est écrit dans le catalogue. */
function reglageTalent(code,params,cle){const d=(code&&code.params||[]).find(p=>p.cle===cle);
 if(!d)return undefined;
 const v=params&&params[cle];
 if(d.type==='nombre'){const n=Math.trunc(Number(v));
  return Number.isFinite(n)?Math.max(d.min,Math.min(d.max,n)):d.defaut}
 // Un modèle du bestiaire : un identifiant, que seule la page peut vérifier.
 if(d.type==='modele')return typeof v==='string'?v.slice(0,100):(d.defaut||'');
 return (d.options||[]).some(([k])=>k===v)?v:d.defaut}
/* La Régénération que porte un combattant, réglages relus ; null s'il n'en a pas. */
function regenerationDe(portes){const t=(portes||[]).find(t=>t&&t.code&&t.code.cle==='regeneration');
 return t?paramsTalent({effet:'regeneration',params:t.params}):null}
/* Ce qu'une Régénération rend : le montant, et les dés lancés s'il y en a. */
function montantRegeneration(a,p,roll){const n=Math.max(1,(p&&p.quantite)|0),f=p&&p.forme,jets=[];
 if(f==='des'){for(let i=0;i<n;i++)jets.push(roll());return {total:jets.reduce((s,v)=>s+v,0),jets}}
 if(f==='endu')return {total:n+Math.max(0,Math.trunc(Number(a&&a.endu))||0),jets};
 if(f==='vie')return {total:n+Math.max(0,Math.trunc(Number(a&&a.vie))||0),jets};
 return {total:n,jets}}
function paramsTalent(t){const code=talentCode(t);if(!code)return null;
 const out={};(code.params||[]).forEach(p=>out[p.cle]=reglageTalent(code,t&&t.params,p.cle));return out}
/* La phrase d'un effet, réglages relus au travers de leur déclaration. Sans réglages
   donnés, ce sont les valeurs par défaut : c'est ce que montre la bibliothèque. */
// « palier » : pour un effet qui change avec lui — Brise —, la phrase de ce palier-là.
// « volets » : ceux que le talent a ouverts, et à quel palier ; sans eux, ceux de la déclaration.
function phraseTalent(cle,params,palier,volets){const code=TALENTS_CODES[cle];
 if(!code||typeof code.phrase!=='function')return code&&code.aide||'';
 return code.phrase(paramsTalent({effet:cle,params}),palier,volets||voletsDe({effet:cle}))}
/* Les parties variables d'une phrase d'effet, pour la bibliothèque. La phrase est relue avec chaque
   autre valeur d'un réglage, mot à mot : ce qui change est la partie de ce réglage. Un nombre ne garde
   que son chiffre ; un choix, les mots qui changent ensemble. Deux réglages ne se partagent pas une
   partie : le second reste hors du texte. « texte » rend le texte d'une phrase HTML, tel qu'à l'écran. */
const MOTS_PHRASE=/[\p{L}\p{N}’'\-]+|\s+|[^\p{L}\p{N}\s]/gu;
function texteBrut(html){return String(html||'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,'\u00a0').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&amp;/g,'&')}
function valeursReglage(p,courante){if(!p)return [];if(p.type==='choix')return (p.options||[]).map(([v])=>v);
 if(p.type!=='nombre')return [];const haut=Math.min(p.max,p.min+19),l=[];for(let n=p.min;n<=haut;n++)l.push(n);
 [25,30,40,50,75,100,150,200,250,500,999].forEach(n=>{if(n>haut&&n>=p.min&&n<=p.max)l.push(n)});
 if(Number.isFinite(courante)&&!l.includes(courante))l.push(courante);return l.sort((x,y)=>x-y)}
function morceauxDiffs(a,b){const n=a.length,m=b.length,L=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=a[i]===b[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
 const out=[];let i=0,j=0,h=null;
 while(i<n||j<m){if(i<n&&j<m&&a[i]===b[j]){if(h){h.be=i;h.ae=j;out.push(h);h=null}i++;j++;continue}
  if(!h)h={bs:i,as:j};if(j<m&&(i>=n||L[i][j+1]>=L[i+1][j]))j++;else i++}
 if(h){h.be=i;h.ae=j;out.push(h)}return out}
// « fin » : un mot ajouté juste à cette limite en fait partie.
function versAutre(hs,i,fin){let off=0;for(const h of hs){if(h.bs===i&&h.be===i)return fin?h.ae:h.as;if(h.bs>i)break;if(i<h.be)return h.as;off=h.ae-h.be}return i+off}
function variablesPhrase(cle,params,texte=texteBrut){const code=TALENTS_CODES[cle];if(!code)return {texte:'',variables:[],hors:[]};
 const reg=paramsTalent({effet:cle,params})||{},base=texte(phraseTalent(cle,reg)),bt=base.match(MOTS_PHRASE)||[];
 const blanc=t=>/^\s+$/.test(t),pos=[0];bt.forEach(t=>pos.push(pos[pos.length-1]+t.length));
 const variables=[],hors=[];
 // Les nombres d'abord : leur chiffre est sûr, un choix qui le recouvre reste hors du texte.
 [...(code.params||[])].sort((x,y)=>(x.type==='nombre'?0:1)-(y.type==='nombre'?0:1)).forEach(p=>{const cur=reg[p.cle],autres=[];let S=Infinity,E=-1;
  valeursReglage(p,cur).forEach(v=>{if(v===cur)return;const at=(texte(phraseTalent(cle,{...reg,[p.cle]:v}))).match(MOTS_PHRASE)||[];
   const hs=morceauxDiffs(bt,at);autres.push([v,at,hs]);
   const vrais=hs.filter(h=>[...bt.slice(h.bs,h.be),...at.slice(h.as,h.ae)].some(t=>!blanc(t))),plein=h=>h.be>h.bs&&bt.slice(h.bs,h.be).some(t=>!blanc(t));
   let d,e;
   // Un nombre ne garde que son chiffre.
   if(p.type!=='choix'){const h=vrais.find(plein);if(!h)return;d=h.bs;e=h.be}
   // Un choix garde les mots qui changent ensemble, à deux mots d'écart au plus.
   else{const tas=[];vrais.forEach(h=>{const t=tas[tas.length-1];if(t&&bt.slice(t.e,h.bs).filter(x=>!blanc(x)).length<=2){t.e=h.be;t.l.push(h)}else tas.push({d:h.bs,e:h.be,l:[h]})});
    const t=tas.find(x=>x.l.some(plein));if(!t)return;d=t.d;e=t.e}
   S=Math.min(S,d);E=Math.max(E,e)});
  while(S<E&&blanc(bt[S]))S++;while(E>S&&blanc(bt[E-1]))E--;
  if(!(E>S)||variables.some(x=>S<x.fin&&E>x.debut)){hors.push(p.cle);return}
  const libelle=(at,hs)=>at.slice(versAutre(hs,S),versAutre(hs,E,p.type==='choix')).join('').trim();
  const options=[[cur,bt.slice(S,E).join('').trim()]];
  autres.forEach(([v,at,hs])=>{let l=libelle(at,hs);if(!l){const o=(p.options||[]).find(([k])=>k===v);l=String(o?o[1]:v).replace(/^—\s*|\s*—$/g,'')||String(v)}options.push([v,l])});
  const ordre=valeursReglage(p,cur);options.sort((x,y)=>ordre.indexOf(x[0])-ordre.indexOf(y[0]));
  variables.push({cle:p.cle,nom:p.nom,debut:S,fin:E,de:pos[S],a:pos[E],valeur:cur,options})});
 variables.sort((x,y)=>x.de-y.de);hors.sort((x,y)=>code.params.findIndex(p=>p.cle===x)-code.params.findIndex(p=>p.cle===y));return {texte:base,variables,hors}}
/* La même phrase, dépouillée de son gras : une option de menu déroulant ne porte que du
   texte. « Lamevent : En terminant un mouvement, le porteur inflige… » se lit alors d'un
   trait dans la liste, sans qu'il faille la choisir pour savoir ce qu'elle fait. */
/* Le nom d'un effet : celui que le MJ lui a donné dans la bibliothèque, sinon celui du moteur. */
function nomEffet(c){const k=c&&typeof c==='object'?c.cle:c,code=TALENTS_CODES[k];if(!code)return '';
 const perso=typeof catalog!=='undefined'&&catalog&&catalog.nomsEffets&&catalog.nomsEffets[k];return typeof perso==='string'&&perso.trim()?perso.trim():code.nom}
function libelleTalent(cle,params){const code=TALENTS_CODES[cle];if(!code)return '';
 const dit=phraseTalent(cle,params).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim(),nom=nomEffet(cle);
 return dit?nom+' : '+dit:nom}
/* L'Onde purge l'affection la plus fraîche — celle qui vient de tomber — et se consume.
   Les états bénéfiques et le coma ne s'en vont jamais ainsi. */
function ondeCures(a){const l=statesOf(a).filter(e=>!ONDE_EXCLUS.includes(e));return l.length?l[l.length-1]:null}
/* Les dégâts d'un effet ne se défendent pas : ni DEF, ni blindage, ni saignée. */
/* Le Blindage absorbe toute source de dégâts, une fois, puis disparaît : rien n'est perdu. */
function applyDamage(a,montant){if(Math.trunc(montant)>0&&hasState(a,'Blindage')){setState(a,'Blindage',false);return 0}
 const perdu=Math.min(a.hp,Math.max(0,Math.trunc(montant)||0));
 a.hp=Math.max(0,a.hp-perdu);if(a.hp===0)setState(a,'Coma',true);return perdu}
// Un aventurier mort ne se soigne plus, d'aucune façon : seul le MJ le ressuscite.
function applyHeal(a,montant){if(a&&a.hero===true&&a.vie!==undefined&&a.vie!==null&&Math.trunc(Number(a.vie))<=0)return 0;const gagne=Math.min(Math.max(0,a.max-a.hp),Math.max(0,Math.trunc(montant)||0));
 a.hp+=gagne;if(a.hp>0)setState(a,'Coma',false);return gagne}
/* ---------- Caractéristiques corrigées à la main ---------- */
/* Chaque caractéristique a ses bornes, les mêmes que dans le formulaire de fiche.
   Une saisie vide, illisible ou d'un autre monde ne détruit rien : elle revient à
   la valeur d'avant, ou s'arrête à la borne. La virgule vaut le point : on tape
   comme on écrit. */
const STAT_LIMITS={hp:[0,99999],max:[1,99999],def:[0,6],dmg:[0,999],xp:[0,999999],
 level:[1,20],endu:[1,999],pvBonus:[-9999,9999],skill:[0,30],
 vie:[0,999,true],vieMax:[1,999,true],
 pv:[1,99999],damage:[0,999]};   // pv et damage : les noms du bestiaire.
function readStat(cle,texte,avant){const bornes=STAT_LIMITS[cle];
 if(!bornes)return avant;
 const brut=String(texte??'').replace(',','.').trim();
 if(!brut)return avant;
 const n=bornes[2]?parseFloat(brut):parseInt(brut,10);
 if(!Number.isFinite(n))return avant;
 return Math.max(bornes[0],Math.min(bornes[1],bornes[2]?Math.round(n*100)/100:Math.trunc(n)))}
/* Écrire une caractéristique en gardant la fiche cohérente : des PV ne dépassent
   jamais leur plafond, baisser le plafond y ramène les PV, et toucher le fond
   met dans le coma comme n'importe quel coup. */
/* L'XP à atteindre pour chaque niveau d'aventurier, du 1 au 20 : le niveau suit l'XP, de lui-même. */
/* ---------- La conversion des dégâts de D&D 5.5 ----------
   Des dés de D&D — « 3d8 », « d8 + 1d4 », des d4 aux d12 — se lisent en leur moyenne ; un bonus fixe
   tapé quand même n'y entre pas : il se garde à part, comme le bonus de dégâts d'Amertüme. Les dés
   d'Amertüme sont tous des d6, mais chaque couleur a sa règle : le Lourd passe la DEF, le Mystique double
   sur une paire, un double 1 fait échec, un double 6 critique. Leur moyenne n'est donc pas écrite à la
   main : le moteur lui-même lance les dés, contre la DEF donnée, et la conversion cherche, pour chaque
   couleur, le nombre de dés — sans bonus — qui s'en approche le plus. */
const FACES_DND=[4,6,8,10,12];
function lireDegatsDnd(texte){const t=String(texte||'').toLowerCase().replace(/\s+/g,'');
 if(!t)return {erreur:'Entre des dégâts, par exemple 2d6+3.'};
 const des=[];let bonus=0,lu='';const rx=/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;let m;
 while((m=rx.exec(t))!==null){lu+=m[0];
  if(m[3]!==undefined){const f=Number(m[3]),n=m[2]===''?1:Number(m[2]);
   if(!FACES_DND.includes(f))return {erreur:'Seuls les d4, d6, d8, d10 et d12 se convertissent.'};
   if(m[1]==='-')return {erreur:'Un dé ne se retranche pas.'};
   if(n<1||n>40)return {erreur:'Entre 1 et 40 dés de chaque sorte.'};des.push({n,f})}
  else bonus+=(m[4]==='-'?-1:1)*Number(m[5])}
 if(lu.replace(/^\+/,'')!==t.replace(/^\+/,'')||!des.length)return {erreur:'Lecture impossible : écris par exemple 2d6+3.'};
 const moyenne=des.reduce((s,d)=>s+d.n*(d.f+1)/2,0)+bonus;
 return {des,bonus,moyenne,min:Math.max(0,des.reduce((s,d)=>s+d.n,0)+bonus),max:des.reduce((s,d)=>s+d.n*d.f,0)+bonus}}
/* La moyenne d'une poignée de dés, panachée ou non — « {white:2,red:1} » —, lancée par le moteur contre
   une DEF : les dégâts des dés, et la part des jets qui touchent. Le critique relance la première couleur
   de la poignée, comme en jeu, le Léger en dernier. Le hasard est semé : les mêmes questions donnent les mêmes réponses. */
function moyennePoignee(poignee,def,essais=1600){const couleurs=[];DICE_KEYS.forEach((k,c)=>{for(let i=0;i<(Number(poignee&&poignee[k])||0);i++)couleurs.push(c)});
 if(!couleurs.length)return {moyenne:0,touche:0};
 let graine=97+(Number(def)||0)*7919;couleurs.forEach((c,i)=>{graine=(graine*31+c*977+i*131)%2147483647});
 const d6=()=>{graine=(graine*1103515245+12345)%2147483648;return 1+Math.floor(graine/2147483648*6)};
 // Un Léger qui double s'efface avant le critique : il ne relance donc que s'il est seul de sa sorte.
 const autres=couleurs.filter(c=>c!==4&&c!==1),crit=autres.length?Math.min(...autres):1;let somme=0,touche=0;
 for(let i=0;i<essais;i++){const dice=couleurs.map(c=>[d6(),c]);let r;
  try{r=resolveAttack({dice,def:Number(def)||0,dmg:0,round:1,criticalColor:crit,roll:d6})}catch(e){continue}
  if(r.hit){touche++;somme+=r.damage}}
 return {moyenne:somme/essais,touche:touche/essais}}
function moyenneDesAmertume(couleur,n,def,essais=1600){return moyennePoignee({[couleur]:n},def,essais)}
// Les dés que la conversion panache : Simple, Léger, Lourd, Mystique, Mortel — ni le Soin, ni la Phase, qui suit le tour.
const CONVERSION_COULEURS=['white','bone','red','blue','black'];
// Les propositions d'un jeu de dés, gardées : le hasard est semé, le même jeu donne toujours les mêmes.
const CONVERSIONS_VUES=new Map();
function conversionDegats(texte,combien=6){const dnd=lireDegatsDnd(texte);if(dnd.erreur)return dnd;
 const cle=JSON.stringify(dnd.des)+'|'+combien,vue=CONVERSIONS_VUES.get(cle);if(vue)return {...dnd,...vue,propositions:vue.propositions.map(p=>({...p,des:{...p.des}}))};
 /* La moyenne des seuls dés D&D ; un bonus fixe n'y entre pas. Toutes les poignées panachées jusqu'à cinq
    dés sont lancées une première fois, vite, sans DEF : leur valeur est absolue ; les plus proches le sont de
    nouveau, longuement. Le Mortel n'échoue jamais et ses 1 ne font pas d'échec : il n'entre qu'aux grosses
    valeurs, à partir de 25 de moyenne, un de plus tous les 5 points. On en garde
    les plus proches, une par mélange de couleurs d'abord, pour que les propositions varient. Jamais plus de
    cinq dés. */
 const moyenne=dnd.des.reduce((s,d)=>s+d.n*(d.f+1)/2,0),maxDes=Math.max(2,Math.min(5,Math.ceil(moyenne/3)+2)),maxNoirs=Math.max(0,Math.floor((moyenne-20)/5));
 const poignees=[],remplis=(k,reste,p)=>{if(k===CONVERSION_COULEURS.length){const n=Object.values(p).reduce((x,y)=>x+y,0);if(n)poignees.push({...p});return}
  const plafond=CONVERSION_COULEURS[k]==='black'?Math.min(reste,maxNoirs):reste;
  for(let q=0;q<=plafond;q++){const c={...p};if(q)c[CONVERSION_COULEURS[k]]=q;remplis(k+1,reste-q,c)}};
 remplis(0,maxDes,{});
 const note=(p,essais)=>{const s=moyennePoignee(p,0,essais),n=Object.values(p).reduce((x,y)=>x+y,0);return {des:p,n,moyenne:s.moyenne,touche:s.touche,score:Math.abs(s.moyenne-moyenne)+.05*n}};
 const tri=(x,y)=>x.score-y.score;
 const fins=poignees.map(p=>note(p,300)).sort(tri).slice(0,48).map(c=>note(c.des,2400)).sort(tri);
 const signe=c=>Object.keys(c.des).sort().join('+'),pris=[],vus=new Set();
 fins.forEach(c=>{if(pris.length<combien&&!vus.has(signe(c))){vus.add(signe(c));pris.push(c)}});
 fins.forEach(c=>{if(pris.length<combien&&!pris.includes(c))pris.push(c)});
 const r={moyenne,min:dnd.des.reduce((s,d)=>s+d.n,0),max:dnd.des.reduce((s,d)=>s+d.n*d.f,0),propositions:pris.sort(tri)};
 if(CONVERSIONS_VUES.size>200)CONVERSIONS_VUES.clear();CONVERSIONS_VUES.set(cle,r);
 return {...dnd,...r,propositions:r.propositions.map(p=>({...p,des:{...p.des}}))}}
const NIVEAUX_XP=[0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
function niveauDeXp(xp){const n=Math.max(0,Math.trunc(Number(xp))||0);let niv=1;NIVEAUX_XP.forEach((s,i)=>{if(n>=s)niv=i+1});return niv}
function writeStat(a,cle,texte){if(!a||!STAT_LIMITS[cle])return null;
 const v=readStat(cle,texte,a[cle]);a[cle]=v;
 if(cle==='xp'&&a.hero)a.level=niveauDeXp(a.xp);
 // Un modèle du bestiaire n'a ni PV du moment ni états : sa cohérence s'arrête à ses bornes.
 const combattant=Number.isFinite(a.hp)&&Number.isFinite(a.max);
 if(combattant){if(cle==='max')a.hp=Math.min(a.hp,a.max);
  else if(cle==='hp')a.hp=Math.min(a.hp,a.max);
  if(cle==='hp'||cle==='max')setState(a,'Coma',!a.hp)}
 if(cle==='vieMax'&&Number.isFinite(a.vie))a.vie=Math.min(a.vie,a.vieMax);
 else if(cle==='vie'&&Number.isFinite(a.vieMax)&&a.vie>a.vieMax)a.vie=a.vieMax;
 return a[cle]}
/* ====================================================================================
   LE DOMAINE
   ------------------------------------------------------------------------------------
   Le fief de la troupe : des bâtiments qui se bâtissent en quatre étapes — friche,
   fondations, construction, construit —, un trésor qui les paie, des habitants et des
   visiteurs, et les aventuriers qui y séjournent. Le moteur tient les règles ; l'image
   du village, elle, est faite de quatre calques, un par étape, dans lesquels chaque
   bâtiment se découpe à l'étape où il en est. Rien de tout cela ne voyage encore vers
   la table ni vers les joueurs : le domaine reste sur l'appareil du MJ.
   ==================================================================================== */
/* ---------- Les compétences et les bonus de caractéristique ---------- */
const NOM_CARAC={pv:'PV max',endu:'Endurance',vie:'Vie',def:'DEF',dmg:'Dégâts',orbe:'Orbe mystique'},NOM_CARAC_COURT={pv:'PV',endu:'Endu',vie:'Vie',def:'DEF',dmg:'Dég.',orbe:'Orbe'};
// « +2 PV max », « +1 Force » — ou, en court pour un nœud d'arbre, « +2 PV ».
function libelleBonus(p,court){const n=Math.max(1,(p&&p.valeur)|0),c=p&&p.carac;
 if(c==='comp')return '+'+n+' '+(COMPETENCES[Number(p&&p.comp)||0]||COMPETENCES[0]);
 // « +2 Orbes mystiques », « +2 Orbes » : le pluriel dès deux.
 if(c==='orbe')return '+'+n+' '+(court?(n>1?'Orbes':'Orbe'):(n>1?'Orbes mystiques':'Orbe mystique'));
 return '+'+n+' '+((court?NOM_CARAC_COURT:NOM_CARAC)[c]||(court?'PV':'PV max'))}
// Un compte de bonus, vide : par caractéristique, et par compétence.
function bonusVide(){return {pv:0,endu:0,vie:0,def:0,dmg:0,skills:COMPETENCES.map(()=>0)}}
function ajouteBonus(out,carac,n,comp){n=Math.max(0,Math.trunc(Number(n))||0);if(!n)return;
 if(carac==='comp'){const k=Number(comp)||0;if(out.skills[k]!==undefined)out.skills[k]+=n}
 else if(carac==='pv'||carac==='endu'||carac==='vie'||carac==='def'||carac==='dmg')out[carac]+=n}
// Ce que les nœuds de bonus appris ajoutent, en tout.
function bonusTalents(portes){const out=bonusVide();
 (portes||[]).forEach(t=>{if(!t||!t.code||t.code.cle!=='bonus')return;const p=t.params||{};ajouteBonus(out,p.carac,Math.max(1,p.valeur|0),p.comp)});
 return out}
/* ---------- Les raretés et les bonus d'équipement ----------
   Une pièce a une rareté — commune, rare, mystique, épique — qui la teinte, et peut
   conférer des bonus, une ligne chacun, qui jouent tant qu'elle est portée et se cumulent. */
const RARETES=[['commun','Commun'],['rare','Rare'],['mystique','Mystique'],['epique','Épique']];
// Une ressource a sa rareté à elle, « Ressource », qu'on ne choisit pas.
function rareteDe(o){if(o&&o.category==='ressource')return 'ressource';const r=o&&o.rarete;return RARETES.some(([k])=>k===r)?r:'commun'}
const NOM_RARETE=r=>r==='ressource'?'Ressource':(RARETES.find(([k])=>k===r)||RARETES[0])[1];
const CARACS_EQUIP=[['pv','PV max'],['endu','Endurance'],['vie','Vie'],['def','DEF'],['dmg','Dégâts'],['comp','Compétence']];
function normaliseBonusEquip(l){return (Array.isArray(l)?l:[]).filter(b=>b&&typeof b==='object').slice(0,12).map(b=>({
 carac:CARACS_EQUIP.some(([k])=>k===b.carac)?b.carac:'pv',valeur:Math.max(1,Math.min(99,Math.trunc(Number(b.valeur))||1)),
 comp:String(Math.max(0,Math.min(COMPETENCES.length-1,Math.trunc(Number(b.comp))||0)))}))}
// Ce que l'équipement porté confère : chaque pièce aux mains, sur le corps, au bras — deux anneaux, deux fois.
function bonusEquipement(a,items){const out=bonusVide();
 gearOf(a&&[...(a.weapons||[]),...armuresDe(a),a.shieldId],items).forEach(o=>normaliseBonusEquip(o.bonus).forEach(b=>ajouteBonus(out,b.carac,b.valeur,b.comp)));
 return out}
// Tout ce qui s'ajoute à la fiche : les nœuds appris, et l'équipement porté.
/* Ce qu'une classe donne à ses aventuriers en compétences, dès le niveau 1 : un point dans chacune de
   ces trois, en plus de la fiche, comme son bonus de PV. */
const COMPETENCES_CLASSE={Gardien:['Robustesse','Savoir','Force'],Mystique:['Mysticisme','Savoir','Ruse'],Lamevent:['Agilité','Ruse','Perception'],Destructeur:['Force','Robustesse','Technique']};
function competencesDeClasse(role){const k=cleClasse(role),e=k?Object.entries(COMPETENCES_CLASSE).find(([n])=>cleClasse(n)===k):null;
 return COMPETENCES.map(n=>e&&e[1].includes(n)?1:0)}
function bonusDe(a,talents,items){const out=bonusTalents(talentsAuPalier(a,talents)
 .map(t=>{const code=talentCode(t);return code?{code,params:paramsTalent(t)}:null}).filter(Boolean));
 if(a&&a.hero)competencesDeClasse(a.role).forEach((n,k)=>out.skills[k]+=n);
 if(items){const e=bonusEquipement(a,items);['pv','endu','vie','def','dmg'].forEach(k=>out[k]+=e[k]);e.skills.forEach((n,k)=>out.skills[k]+=n)}
 return out}
// La Vie et l'Endurance telles qu'elles jouent : la fiche, plus les bonus appris et portés.
function vieDe(a,talents,items){return (Math.trunc(Number(a&&a.vie))||0)+(talents||items?bonusDe(a,talents,items).vie:0)}
function enduDe(a,talents,items){return (Math.trunc(Number(a&&a.endu))||0)+(talents||items?bonusDe(a,talents,items).endu:0)}
/* Les élus d'un Meneur : parmi les alliés à sa portée, les plus proches — un, deux, ou
   tous. « candidats » : des {a,dist}, la table les a déjà triés par portée. */
// Le Meneur donne-t-il son propre bonus plutôt qu'un nombre fixe ? Les PV max n'en ont pas : le nombre fixe vaut.
const bonusDuMeneur=p=>!!p&&p.base==='porteur'&&(p.quoi||'dmg')!=='pv';
function elusMeneur(p,candidats){const c=p&&p.combien,n=c==='tous'?Infinity:c==='deux'?2:1;
 const tries=[...(candidats||[])].sort((u,v)=>u.dist-v.dist);
 return (n===Infinity?tries:tries.slice(0,n)).map(x=>x.a)}
/* ---------- Les zones d'une carte ----------
   Toute étendue close par la matière et par les portes — ouvertes ou fermées — est une
   zone. Le calcul se fait sur une grille fine : chaque case est bouchée si elle tombe dans
   la matière ou dans une porte, et ce qui reste se partage en régions d'un seul tenant.
   Les miettes — quelques cases coincées dans l'épaisseur d'un mur — ne comptent pas. */
// Remplir, à la règle pair-impair sur l'ensemble des anneaux d'un polygone : les trous restent vides.
function rempliAnneaux(grid,cols,rows,anneaux,valeur){
 for(let j=0;j<rows;j++){const y=(j+.5)/rows*100,xs=[];
  for(const r of anneaux){if(!r||r.length<3)continue;
   for(let i=0,k=r.length-1;i<r.length;k=i++){const a=r[k],b=r[i];
    if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}}
  xs.sort((u,v)=>u-v);
  for(let t=0;t+1<xs.length;t+=2){const i0=Math.max(0,Math.ceil(xs[t]/100*cols-.5)),i1=Math.min(cols-1,Math.floor(xs[t+1]/100*cols-.5));
   for(let i=i0;i<=i1;i++)grid[j*cols+i]=valeur}}}
/* Les coupures et les liens du MJ. Une coupure est un trait fin qui sépare — une porte
   ouverte, un seuil, une arche — sans rien bloquer d'autre ; un lien est une paire de
   points dont les zones n'en font qu'une. Les deux se disent en pour cent de carte. */
// Les noms que le MJ donne aux zones : un point qui désigne la zone, et son nom — douze signes.
function cleanEtiquettes(l){return (Array.isArray(l)?l:[]).filter(e=>e&&typeof e==='object').slice(0,200)
 .map(e=>({x:borne(e.x,0,100),y:borne(e.y,0,100),nom:String(e.nom||'').trim().slice(0,12)})).filter(e=>e.nom)}
function cleanSegments(l){return (Array.isArray(l)?l:[]).filter(s=>s&&typeof s==='object').slice(0,200)
 .map(s=>({x1:borne(s.x1,0,100),y1:borne(s.y1,0,100),x2:borne(s.x2,0,100),y2:borne(s.y2,0,100)}))}
/* Une coupure se trace cellule par cellule le long de son trait : une ligne d'une case,
   continue en diagonale, que l'inondation — qui ne va que de case en case voisine — ne
   franchit pas. Plus fine qu'une porte, elle ne bouche jamais rien qu'elle-même. */
function traceCoupure(bouche,cols,rows,s){const x1=s.x1/100*cols,y1=s.y1/100*rows,x2=s.x2/100*cols,y2=s.y2/100*rows;
 const n=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))*2.5));
 for(let k=0;k<=n;k++){const t=k/n,x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;
  const i=Math.max(0,Math.min(cols-1,Math.floor(x))),j=Math.max(0,Math.min(rows-1,Math.floor(y)));bouche[j*cols+i]=1}}
function calculeZones(polys,portes,cols,rows,miette=10,coupures,liens){const n=cols*rows,bouche=new Uint8Array(n);
 (polys||[]).forEach(p=>{if(p&&p.anneaux)rempliAnneaux(bouche,cols,rows,p.anneaux,1)});
 (portes||[]).forEach(q=>{if(q&&q.length>=3)rempliAnneaux(bouche,cols,rows,[q],1)});
 cleanSegments(coupures).forEach(c=>traceCoupure(bouche,cols,rows,c));
 const zone=new Int16Array(n),tailles=[0],pile=new Int32Array(n);let compte=0;
 for(let s=0;s<n;s++){if(bouche[s]||zone[s])continue;
  compte++;let haut=0,taille=0;pile[haut++]=s;zone[s]=compte;
  while(haut){const k=pile[--haut];taille++;const i=k%cols,j=(k-i)/cols;
   const voisins=[i>0?k-1:-1,i<cols-1?k+1:-1,j>0?k-cols:-1,j<rows-1?k+cols:-1];
   for(const v of voisins)if(v>=0&&!bouche[v]&&!zone[v]){zone[v]=compte;pile[haut++]=v}}
  tailles.push(taille)}
 // Les liens : deux zones liées n'en font qu'une — la racine de chaque famille garde le numéro.
 const racine=new Int32Array(compte+1);for(let z=0;z<=compte;z++)racine[z]=z;
 const trouve=z=>{while(racine[z]!==z){racine[z]=racine[racine[z]];z=racine[z]}return z};
 const brut={cols,rows,zone};
 cleanSegments(liens).forEach(l=>{const a=zoneAu(brut,l.x1,l.y1),b=zoneAu(brut,l.x2,l.y2);if(a>0&&b>0){const ra=trouve(a),rb=trouve(b);if(ra!==rb)racine[Math.max(ra,rb)]=Math.min(ra,rb)}});
 const fusion=new Array(compte+1).fill(0);for(let z=1;z<=compte;z++)fusion[trouve(z)]+=tailles[z];
 // Les miettes s'effacent, et les numéros se resserrent, dans l'ordre de lecture.
 const renum=new Int16Array(compte+1),finales=[0];let m=0;
 for(let z=1;z<=compte;z++){const r=trouve(z);if(r!==z){renum[z]=renum[r];continue}renum[z]=fusion[z]>=miette?++m:0;if(renum[z])finales.push(fusion[z])}
 for(let s=0;s<n;s++)zone[s]=renum[zone[s]];
 return {cols,rows,zone,compte:m,tailles:finales}}
// La zone sous un point de la carte, en pour cent : 0 dans un mur, une porte, ou une miette.
function zoneAu(z,x,y){if(!z)return 0;
 const i=Math.max(0,Math.min(z.cols-1,Math.floor(x/100*z.cols))),j=Math.max(0,Math.min(z.rows-1,Math.floor(y/100*z.rows)));
 return z.zone[j*z.cols+i]}
const ETAPES_DOMAINE=[['friche','Friche'],['fondation','Fondations'],['construction','Construction'],['construit','Construit']];
const NOM_ETAPE=i=>(ETAPES_DOMAINE[i]||ETAPES_DOMAINE[0])[1];
/* Les calques de la carte : les quatre étapes, puis deux états qui ne se construisent pas —
   le village en feu, le village en ruines. Un bâtiment en feu ou en ruines se découpe dans
   le calque de son état, s'il est chargé ; sinon dans celui de son étape. */
/* Après les quatre étapes, un calque par état du bâtiment : ce qui lui arrive, et ne se
   construit pas — le feu, la ruine, les spectres, l'abandon, l'ennemi qui s'y installe. */
const CALQUES_DOMAINE=[...ETAPES_DOMAINE,['feu','En feu'],['ruine','Ruines'],['hante','Hanté'],['abandonne','Abandonné'],['envahi','Envahi']];
const ETATS_BATIMENT=[['','Intact'],['feu','En feu'],['ruine','En ruines'],['hante','Hanté'],['abandonne','Abandonné'],['envahi','Envahi']];
const NOM_ETAT_BATIMENT=e=>(ETATS_BATIMENT.find(([k])=>k===e)||ETATS_BATIMENT[0])[1];
const BATIMENTS_DEFAUT=['Étables','Auberge','Magasin','Tour de Mystique','Temple','Bibliothèque','Forge','Tannerie','Taverne','Baraquements','Entrepôts','Laboratoire','Cartographe'];
const STATUTS_PNJ=[['habitant','Habitant'],['visiteur','Visiteur']];
function idDomaine(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'d'+Math.random().toString(36).slice(2)}
// Une zone de bâtiment : au moins trois sommets, en pourcentage de la carte, sans trou.
function zoneValide(z){if(!Array.isArray(z)||z.length<3)return null;
 const pts=z.filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])))
  .map(p=>[borne(p[0],0,100),borne(p[1],0,100)]);
 return pts.length>=3?pts.slice(0,400):null}
/* Ce qu'un bâtiment fait pour la troupe. Il ne le fait que construit et intact : toute autre
   étape, tout autre état, et sa fonction s'arrête. Un bâtiment d'avant les fonctions qui
   s'appelle Magasin devient le magasin, une fois ; ensuite c'est le MJ qui choisit. */
const FONCTIONS_BATIMENT=[['','Aucune fonction'],['magasin','Magasin'],['tannerie','Tannerie']];
const NOM_FONCTION=f=>(FONCTIONS_BATIMENT.find(([k])=>k===f)||FONCTIONS_BATIMENT[0])[1];
const fonctionActive=b=>!!b&&!!b.fonction&&b.etape>=ETAPES_DOMAINE.length-1&&!b.etat;
function nouveauBatiment(nom,id){nom=String(nom||'Bâtiment').slice(0,60);
 return {id:id||idDomaine(),nom,etape:0,etat:'',fonction:fonctionParNom(nom),zone:null,etiquette:null,couts:[0,0,0],effets:['','','',''],notes:''}}
function fonctionParNom(nom){const n=String(nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 return FONCTIONS_BATIMENT.some(([k])=>k&&k===n)?n:''}
function normaliseBatiment(b){const n=nouveauBatiment(b&&b.nom,b&&b.id);
 n.etape=Math.max(0,Math.min(3,Math.trunc(Number(b&&b.etape))||0));
 n.etat=b&&typeof b.etat==='string'&&b.etat&&ETATS_BATIMENT.some(([k])=>k===b.etat)?b.etat:'';
 n.fonction=b&&typeof b.fonction==='string'?(FONCTIONS_BATIMENT.some(([k])=>k===b.fonction)?b.fonction:''):fonctionParNom(n.nom);
 n.zone=zoneValide(b&&b.zone);
 // Où s'écrit son nom : là où le MJ l'a posé, sinon au centre de sa zone.
 const et=b&&b.etiquette;n.etiquette=Array.isArray(et)&&et.length>=2&&Number.isFinite(Number(et[0]))&&Number.isFinite(Number(et[1]))?[borne(et[0],0,100),borne(et[1],0,100)]:null;
 n.couts=[0,1,2].map(i=>Math.max(0,Math.trunc(Number(b&&b.couts&&b.couts[i]))||0));
 n.effets=[0,1,2,3].map(i=>String(b&&b.effets&&b.effets[i]||'').slice(0,600));
 n.notes=String(b&&b.notes||'').slice(0,2000);return n}
function normalisePnj(p){return {id:p&&p.id||idDomaine(),nom:String(p&&p.nom||'Inconnu').slice(0,60),role:String(p&&p.role||'').slice(0,80),
 statut:p&&p.statut==='visiteur'?'visiteur':'habitant',batiment:String(p&&p.batiment||'').slice(0,60),notes:String(p&&p.notes||'').slice(0,2000)}}
/* ---------- Les ressources ---------- */
/* L'or, les gemmes et les matériaux. Les matériaux sont aussi ceux dont une pièce d'équipement
   est faite ; l'or du domaine est son trésor. Une gemme a une taille — Brisure, Éclat,
   Brôme —, une variété — Rubis, Diamant, Émeraude, Saphir — et peut être éteinte : sa
   flamme vidée, elle se recharge. Un compte ne garde que ce qui n'est pas nul. */
// Les matériaux de départ ; le MJ en crée d'autres et les renomme dans l'Armurerie (catalog.ressources).
const MATERIAUX=['Acier','Argent','Bois','Bronze','Corde','Cuir','Diamant','Fer','Or','Pierre','Verre'];
const cleRessource=n=>String(n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
const TAILLES_GEMMES=[['brisure','Brisures','Brisure'],['eclat','Éclats','Éclat'],['brome','Brômes','Brôme']];
// Les variétés, de la moins chère à la plus chère.
const VARIETES_GEMMES=[['citrine','Citrine'],['emeraude','Émeraude'],['saphir','Saphir'],['rubis','Rubis'],['diamant','Diamant']];
/* Ce que vaut une gemme allumée, en or, par taille et par variété. Une gemme éteinte n'a pas
   encore de prix : elle ne compte pas dans la valeur d'une bourse. */
const VALEURS_GEMMES={brisure:{citrine:5,emeraude:10,saphir:15,rubis:20,diamant:50},
 eclat:{citrine:25,emeraude:50,saphir:75,rubis:100,diamant:250},
 brome:{citrine:50,emeraude:100,saphir:150,rubis:200,diamant:500}};
const valeurGemme=(taille,variete,eteinte)=>eteinte?0:((VALEURS_GEMMES[taille]||{})[variete]||0);
function valeurGemmes(compte){let n=0;if(compte)TAILLES_GEMMES.forEach(([t])=>VARIETES_GEMMES.forEach(([v])=>{n+=(Number(compte[cleGemme(t,v,false)])||0)*valeurGemme(t,v,false)}));return n}
const cleGemme=(taille,variete,eteinte)=>taille+'-'+variete+(eteinte?'-eteinte':'');
// L'icône d'une gemme : img/ressource_<taille>_<variété>.png — la plus grande taille s'y écrit « gemme ».
const FICHIERS_TAILLES={brisure:'brisure',eclat:'eclat',brome:'gemme'};
const iconeGemme=(taille,variete)=>'ressource_'+(FICHIERS_TAILLES[taille]||taille)+'_'+variete;
function nomGemme(taille,variete,eteinte){const t=(TAILLES_GEMMES.find(([k])=>k===taille)||[])[1]||'',v=((VARIETES_GEMMES.find(([k])=>k===variete)||[])[1]||'').toLowerCase();
 return t+(/^[aeiouéèêh]/i.test(v)?' d’':' de ')+v+(eteinte?', éteintes':'')}
/* Les gemmes éteintes — la flamme vidée, à recharger — sont en sommeil : pour l'instant, une
   gemme se dépense tout entière. Hors des comptes, elles quittent les bourses et les réserves
   au premier chargement. Remettre ce drapeau à vrai les fait revenir partout. */
const GEMMES_ETEINTES=false;
const CLES_GEMMES=TAILLES_GEMMES.flatMap(([t])=>VARIETES_GEMMES.flatMap(([v])=>[cleGemme(t,v,false),...(GEMMES_ETEINTES?[cleGemme(t,v,true)]:[])]));
// Ce que porte un aventurier : son or et ses gemmes. Ce que stocke le domaine : ses matériaux et ses gemmes.
const CLES_RICHESSES=['or',...CLES_GEMMES];
const CLES_RESSOURCES_DOMAINE=[...MATERIAUX.filter(m=>m!=='Or').map(cleRessource),...CLES_GEMMES];
const lisCompte=v=>Math.max(0,Math.min(999999,Math.trunc(Number(String(v??'').replace(/[\s\u202f\u00a0]/g,'')))||0));
function normaliseCompte(c,cles){const o={};if(c&&typeof c==='object'&&!Array.isArray(c))cles.forEach(k=>{const n=lisCompte(c[k]);if(n)o[k]=n});return o}
/* ---------- Le magasin ---------- */
/* On y achète au prix de l'armurerie ce qu'elle met en vente ; on y revend à la moitié de ce
   prix, arrondie en dessous — d'autres taux viendront. L'or est celui de l'aventurier. */
const TAUX_VENTE=50;
const prixAchat=o=>Math.max(0,Math.trunc(Number(o&&o.price))||0);
const prixVente=(o,taux=TAUX_VENTE)=>Math.floor(prixAchat(o)*Math.max(0,Number(taux)||0)/100);
const orDe=a=>(a&&a.richesses&&Math.max(0,Math.trunc(Number(a.richesses.or))||0))||0;
// L'or d'un aventurier bouge ; il ne descend jamais sous zéro, et un compte nul disparaît.
function ajouteOr(a,delta){if(!a)return 0;const n=Math.max(0,orDe(a)+(Math.trunc(Number(delta))||0));
 a.richesses={...(a.richesses||{})};if(n)a.richesses.or=n;else delete a.richesses.or;return n}
function peutAcheter(a,o){const prix=prixAchat(o),or=orDe(a),enVente=!!o&&o.magasin===true;
 return {ok:!!a&&enVente&&or>=prix,prix,manque:Math.max(0,prix-or),enVente}}
/* Les inscriptions de la carte, sur ses parchemins : quatre textes, chacun à sa place — le nom
   du domaine et sa qualité en haut à gauche, les habitants et les visiteurs en bas à droite.
   Le MJ les pose où il veut, en pourcentage de la carte. Les deux blocs d'avant (titre, gens)
   se défont en deux lignes chacun, là où elles s'écrivaient. */
const CARTOUCHES_DOMAINE={nom:[13,6.9],sous:[13,11.2],habitants:[79,90.9],visiteurs:[79,94.1]};
const pointCarte=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1]))?[borne(p[0],0,100),borne(p[1],0,100)]:null;
function cartouchesValides(c){c=c&&typeof c==='object'?c:{};const titre=pointCarte(c.titre),gens=pointCarte(c.gens);
 const avant={nom:titre&&[titre[0],titre[1]-1.6],sous:titre&&[titre[0],titre[1]+2.7],habitants:gens&&[gens[0],gens[1]-1.6],visiteurs:gens&&[gens[0],gens[1]+1.6]};
 const o={};Object.keys(CARTOUCHES_DOMAINE).forEach(k=>{o[k]=pointCarte(c[k])||pointCarte(avant[k])||[...CARTOUCHES_DOMAINE[k]]});return o}
/* Le domaine relu au travers de sa déclaration, comme tout ce que le moteur enregistre :
   un domaine absent naît avec ses treize bâtiments en friche et un trésor vide. */
function normaliseDomaine(d){d=d&&typeof d==='object'&&!Array.isArray(d)?d:{};
 const calques=CALQUES_DOMAINE.map((_,i)=>{const c=d.carte&&Array.isArray(d.carte.calques)?d.carte.calques[i]:null;return typeof c==='string'&&c?c:null});
 const ratio=Number(d.carte&&d.carte.ratio);
 const batiments=Array.isArray(d.batiments)?d.batiments.filter(Boolean).slice(0,80).map(normaliseBatiment):BATIMENTS_DEFAUT.map(n=>nouveauBatiment(n));
 const ids=new Set();batiments.forEach(b=>{if(ids.has(b.id))b.id=idDomaine();ids.add(b.id)});
 /* Une ligne dit qui l'a faite : « joueurs » pour une étape qu'ils ont bâtie, « mj » pour
    une étape que le MJ a posée de sa main. Une ligne d'avant cette distinction se reconnaît :
    une construction qui n'a rien coûté au trésor n'était pas l'œuvre des joueurs. */
 const journal=(d.finances&&Array.isArray(d.finances.journal)?d.finances.journal:[]).filter(e=>e&&typeof e==='object').slice(-200)
  .map(e=>{const libelle=String(e.libelle||'').slice(0,120),montant=Math.trunc(Number(e.montant))||0;
   const par=e.par==='joueurs'||e.par==='mj'?e.par:/^Construction — /.test(libelle)&&montant===0?'mj':'';
   return Object.assign({t:Number(e.t)||0,libelle,montant},par?{par}:{})});
 const aventuriers={};if(d.aventuriers&&typeof d.aventuriers==='object')Object.keys(d.aventuriers).slice(0,100).forEach(k=>{const v=d.aventuriers[k]||{};
  aventuriers[k]={lieu:String(v.lieu||'').slice(0,60),notes:String(v.notes||'').slice(0,1000)}});
 return {nom:String(d.nom||'Le Domaine').slice(0,80),monnaie:String(d.monnaie||'or').slice(0,20),
  carte:{calques,ratio:ratio>0?ratio:16/9,cartouches:cartouchesValides(d.carte&&d.carte.cartouches)},batiments,
  finances:{tresor:Math.trunc(Number(d.finances&&d.finances.tresor))||0,journal},
  pnj:(Array.isArray(d.pnj)?d.pnj:[]).filter(Boolean).slice(0,300).map(normalisePnj),aventuriers,
  ressources:normaliseReserve(d.ressources),fonctionsVues:fonctionsPosees(d,batiments),
  // Les dépôts des joueurs déjà versés à la réserve : chacun ne compte qu'une fois.
  depotsVus:(Array.isArray(d.depotsVus)?d.depotsVus:[]).filter(x=>typeof x==='string'&&ID_DEPOT.test(x)).slice(-500)}}
/* Une fonction nouvelle se pose d'elle-même, une seule fois, sur le bâtiment sans fonction qui
   porte son nom — la Tannerie devient la tannerie ; ensuite, c'est le MJ qui choisit. */
function fonctionsPosees(d,batiments){const vues=Array.isArray(d.fonctionsVues)?d.fonctionsVues.filter(f=>typeof f==='string'):['magasin'];
 FONCTIONS_BATIMENT.forEach(([f])=>{if(!f||vues.includes(f))return;batiments.forEach(b=>{if(!b.fonction&&fonctionParNom(b.nom)===f)b.fonction=f});vues.push(f)});
 return vues.slice(0,40)}
/* ---------- La tannerie ----------
   Les restes pris aux adversaires s'y vendent à leur valeur, ou s'y changent en ressources pour
   la réserve du domaine ; le tanneur y vend ses produits, et les fabrique avec la réserve,
   d'après leur recette. Ce qui va à la réserve ou en sort passe par un dépôt, quand c'est un
   joueur qui agit : le domaine est au MJ, dont l'appareil verse chaque dépôt une seule fois. */
const ID_DEPOT=/^[A-Za-z0-9_-]{1,60}$/;
const lisQte=(v,max=99)=>Math.max(1,Math.min(max,Math.trunc(Number(v))||1));
// Une recette : des ressources connues et leur quantité, une ligne par ressource, six au plus.
function normaliseRecette(l,cles){const out=[];(Array.isArray(l)?l:[]).forEach(x=>{if(!x||typeof x!=='object')return;const k=String(x.cle||'');
 if(!CLE_MATERIAU.test(k)||(cles&&!cles.has(k)))return;const q=lisQte(x.qte),deja=out.find(y=>y.cle===k);if(deja)deja.qte=Math.min(99,deja.qte+q);else if(out.length<6)out.push({cle:k,qte:q})});return out}
// Ce qu'un reste donne, converti : ses deux ressources, chacune à son rendement.
function rendementReste(o){const d={};if(!o||o.category!=='restes')return d;
 [[o.ressource1,o.rendement1],[o.ressource2,o.rendement2]].forEach(([k,q])=>{if(k&&CLE_MATERIAU.test(k))d[k]=(d[k]||0)+lisQte(q)});return d}
const recetteDelta=o=>Object.fromEntries(normaliseRecette(o&&o.recette).map(r=>[r.cle,-r.qte]));
// Une réserve qui bouge : jamais sous zéro, un compte nul disparaît.
function appliqueDelta(reserve,delta){Object.entries(delta||{}).forEach(([k,v])=>{if(!CLE_MATERIAU.test(k)||k==='or')return;
 const n=Math.max(0,Math.min(999999,(Number(reserve[k])||0)+(Math.trunc(Number(v))||0)));if(n)reserve[k]=n;else delete reserve[k]});return reserve}
// Ce qui manque à une réserve pour une recette : [clé, quantité manquante].
const manqueRecette=(reserve,o)=>normaliseRecette(o&&o.recette).map(r=>[r.cle,Math.max(0,r.qte-(Number(reserve&&reserve[r.cle])||0))]).filter(([,n])=>n>0);
// Les dépôts d'un aventurier : identifiés, datés, bornés ; les soixante derniers.
function normaliseDepots(l){return (Array.isArray(l)?l:[]).filter(e=>e&&typeof e==='object'&&typeof e.id==='string'&&ID_DEPOT.test(e.id)).slice(-60).map(e=>{const delta={};
 if(e.delta&&typeof e.delta==='object')Object.keys(e.delta).slice(0,12).forEach(k=>{const v=Math.max(-999999,Math.min(999999,Math.trunc(Number(e.delta[k]))||0));if(v&&CLE_MATERIAU.test(k)&&k!=='or')delta[k]=v});
 return {id:e.id,t:Number(e.t)||0,delta}}).filter(e=>Object.keys(e.delta).length)}
/* La réserve du domaine : ses matériaux — ceux du catalogue, que le MJ crée et renomme ; leur clé,
   elle, ne change jamais — et ses gemmes. Une clé bien formée passe, sauf l'or (le trésor) et une
   gemme hors des comptes. */
const CLE_MATERIAU=/^[a-z0-9][a-z0-9-]{0,39}$/;
function normaliseReserve(c){const o={};if(!c||typeof c!=='object'||Array.isArray(c))return o;
 Object.keys(c).slice(0,300).forEach(k=>{if(k==='or'||!CLE_MATERIAU.test(k))return;
  if(TAILLES_GEMMES.some(([t])=>k.startsWith(t+'-'))&&!CLES_GEMMES.includes(k))return;const n=lisCompte(c[k]);if(n)o[k]=n});return o}
// Le coût pour atteindre une étape : les fondations, la construction, le bâti.
function coutEtape(b,etape){return etape>=1&&etape<=3?Math.max(0,Math.trunc(Number((b&&b.couts||[])[etape-1]))||0):0}
function prochaineEtape(b){return b&&b.etape<3?b.etape+1:null}
function peutConstruire(d,b){const e=prochaineEtape(b);if(e===null)return {ok:false,cout:0,manque:0,fini:true};
 const cout=coutEtape(b,e),manque=Math.max(0,cout-d.finances.tresor);return {ok:manque===0,cout,manque,fini:false}}
function mouvementFinance(d,montant,libelle){const m=Math.trunc(Number(montant));if(!Number.isFinite(m))return null;
 d.finances.tresor+=m;const e={t:Date.now(),libelle:String(libelle||'').slice(0,120),montant:m};
 d.finances.journal.push(e);if(d.finances.journal.length>200)d.finances.journal.splice(0,d.finances.journal.length-200);return e}
/* Construire : le trésor paie l'étape, le journal la note, l'étape avance. Sans le sou,
   rien ne se fait — sauf si le MJ force, et le trésor passe alors en dessous de zéro.
   C'est l'œuvre des joueurs : la ligne le dit, et ils la lisent. */
function construire(d,b,force){const e=prochaineEtape(b);if(e===null)return false;
 const cout=coutEtape(b,e);if(cout>d.finances.tresor&&!force)return false;
 const l=mouvementFinance(d,-cout,'Construction — '+b.nom+' : '+NOM_ETAPE(e));if(l)l.par='joueurs';b.etape=e;return true}
/* Défaire ou imposer une étape ne coûte ni ne rembourse rien : c'est la main du MJ, qui
   corrige ou raconte — le trésor se règle à part, et le journal n'en dit rien. */
function reculerEtape(b){if(!b||b.etape<=0)return false;b.etape-=1;return true}
function avancerEtape(b){if(!b||b.etape>=ETAPES_DOMAINE.length-1)return false;b.etape+=1;return true}
// Ce que les joueurs lisent du journal : tout, sauf les étapes que le MJ a posées lui-même.
const ligneDesJoueurs=e=>!!e&&e.par!=='mj';
/* Le calque qui montre une étape : le sien s'il est chargé, sinon le plus proche en
   dessous — un bâtiment en construction sur un village sans calque de construction se
   montre en fondations —, sinon le plus proche au-dessus. Aucun calque : -1. */
function calqueDisponible(calques,etape){const c=calques||[],e=Math.max(0,Math.min(3,Math.trunc(Number(etape))||0));
 for(let i=e;i>=0;i--)if(c[i])return i;
 for(let i=e+1;i<4;i++)if(c[i])return i;
 return -1}
// Le calque où se découpe un bâtiment : celui de son état s'il est chargé, sinon celui de son étape.
function calqueDuBatiment(calques,b){const c=calques||[];
 // Un état a son calque, s'il est chargé ; sinon le bâtiment se montre à son étape.
 const k=b&&b.etat?CALQUES_DOMAINE.findIndex(([cle],i)=>i>=4&&cle===b.etat):-1;
 if(k>=0&&c[k])return k;
 return calqueDisponible(c,b&&b.etape)}
// Le centre d'une zone, là où son nom s'écrit : le barycentre de sa surface.
function centroide(zone){const z=zoneValide(zone);if(!z)return null;
 let a=0,cx=0,cy=0;
 for(let i=0,j=z.length-1;i<z.length;j=i++){const f=z[j][0]*z[i][1]-z[i][0]*z[j][1];a+=f;cx+=(z[j][0]+z[i][0])*f;cy+=(z[j][1]+z[i][1])*f}
 if(Math.abs(a)<1e-9)return [z.reduce((s,p)=>s+p[0],0)/z.length,z.reduce((s,p)=>s+p[1],0)/z.length];
 return [cx/(3*a),cy/(3*a)]}
// Le bâtiment sous un point : le dernier tracé l'emporte, comme le dernier posé.
function batimentSous(d,pt){const l=d&&d.batiments||[];
 for(let i=l.length-1;i>=0;i--){const z=l[i].zone;if(z&&pointInPolygon(pt,z))return i}
 return -1}
function pnjDuBatiment(d,id){return (d&&d.pnj||[]).filter(p=>p.batiment===id)}
// Une zone glissée reste dans la carte : le déplacement se borne à ce que ses bords permettent.
function deplaceZone(zone,dx,dy){const z=zoneValide(zone);if(!z)return null;
 const xs=z.map(p=>p[0]),ys=z.map(p=>p[1]);
 dx=Math.max(-Math.min(...xs),Math.min(100-Math.max(...xs),Number(dx)||0));
 dy=Math.max(-Math.min(...ys),Math.min(100-Math.max(...ys),Number(dy)||0));
 return z.map(([x,y])=>[x+dx,y+dy])}
const api={dominateurDe,coffrePolygon,montantDegats,degatsPeril,phraseMontant,PARAMS_MONTANT,texteBrut,valeursReglage,variablesPhrase,DEF_MAX,defPlafonnee,passeDef,FACES_DND,lireDegatsDnd,moyennePoignee,moyenneDesAmertume,CONVERSION_COULEURS,conversionDegats,normaliseRecette,rendementReste,recetteDelta,appliqueDelta,manqueRecette,normaliseDepots,fonctionsPosees,lisQte,normaliseReserve,CLE_MATERIAU,visionPolygon,cleanMonster,Clipper,matiereDe,migreMatiere,ajouteMatiere,retireMatiere,refondMatiere,polygoneContient,matiereSous,boitePolygone,transformePolygone,contoursMatiere,capsulePolygon,trouPorte,doorFrame,doorPolygon,anglePoignee,redimPorteTournee,polyInReach,uncontainPoints,cleanMatiere,ENCRE_TOL,packMaps,readMapsFile,cleanMap,cleanObjet,TAILLES_OBJET,MAP_FORMAT,polyTouchesDisc,rayHitsSegment,contourBox,simplifyClosed,encreDroite,ENCRE_TOL,wallShape,contoursOf,shapeContains,rectInReach,polygonArea,fillPolygonGrid,packMask,unpackMask,maskChars,regridMask,rayHitsRect,reachPolygon,resolveAttack,contactRadius,tokenDistance,inContact,socleFacteur,SOCLE_TAILLES,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,traitPolygon,TRAIT_EPAISSEUR,obstaclesFrom,indexMurs,rayonContre,formesAutour,uncontain,spreadInZone,
 CALQUES_DOMAINE,ETATS_BATIMENT,NOM_ETAT_BATIMENT,calqueDuBatiment,cleanSegments,cleanEtiquettes,traceCoupure,
 NIVEAUX_XP,niveauDeXp,COMPETENCES,NOM_CARAC,libelleBonus,bonusTalents,bonusDe,vieDe,enduDe,elusMeneur,bonusDuMeneur,RARETES,rareteDe,NOM_RARETE,CARACS_EQUIP,normaliseBonusEquip,bonusEquipement,bonusVide,rempliAnneaux,calculeZones,zoneAu,
 ETAPES_DOMAINE,NOM_ETAPE,BATIMENTS_DEFAUT,STATUTS_PNJ,idDomaine,zoneValide,nouveauBatiment,normaliseDomaine,coutEtape,prochaineEtape,peutConstruire,mouvementFinance,construire,reculerEtape,avancerEtape,ligneDesJoueurs,CARTOUCHES_DOMAINE,cartouchesValides,FONCTIONS_BATIMENT,NOM_FONCTION,fonctionActive,fonctionParNom,TAUX_VENTE,prixAchat,prixVente,orDe,ajouteOr,peutAcheter,MATERIAUX,cleRessource,TAILLES_GEMMES,VARIETES_GEMMES,VALEURS_GEMMES,valeurGemme,valeurGemmes,cleGemme,GEMMES_ETEINTES,FICHIERS_TAILLES,iconeGemme,nomGemme,CLES_GEMMES,CLES_RICHESSES,CLES_RESSOURCES_DOMAINE,lisCompte,normaliseCompte,calqueDisponible,centroide,batimentSous,pnjDuBatiment,deplaceZone,
 DICE_KEYS,modeObjet,phraseDeObjet,passifsPortes,EQUIPEMENTS,equippedPool,equippedRanged,equippedDef,MAINS_MAX,EMPLACEMENTS,NOM_EMPLACEMENT,placesEmplacement,emplacementDe,armuresDe,portesA,placesLibres,defenseOf,doorHiddenFrom,doorLockedFor,doorPierces,doorBlocks,rectsOverlap,weaponHands,gearAttacks,attackChoices,chosenAttack,closestOnSegment,pointInPolygon,slideOutOfWalls,ecarteDesSocles,dansUnSocle,segmentCoupeSocles,poserHorsDesSocles,skillRoll,statesOf,hasState,setState,ONDE_EXCLUS,frozenSolid,blinded,bleedOf,addBleed,RANG_TYPE,rangType,ordreCibles,cleTalent,effetParNom,cleClasse,OBJETS_CODES,USAGES_OBJET,USAGES_LIMITES,usageLimite,NOM_USAGE,objetCode,paramsObjet,phraseObjet,usageObjet,immunites,immuniseEtat,immuniseDe,poseImmunite,classeDe,bonusPV,pvMaximum,pvEspece,ESPECES_PV,talentCode,voletsDe,reglageCommun,reglageTalent,paramsTalent,phraseTalent,libelleTalent,nomEffet,ciblesPermises,orbesPermis,desOrbe,DES_ORBE,etatDesOrbes,partDuRempart,porteEffet,mauvaisSort,regenerationDe,montantRegeneration,etatRefuse,desRefuses,briseLaGarde,briseContre,etatOrbeAuPalier,ditEtatOrbe,POINTS_MAX,POINTS_CLES,pointsMax,pointsUses,pointsRestants,depensePoint,rendPoint,epuisePoints,talentDuCatalogue,manqueTalent,nomPrerequis,talentsDependants,talentsSans,talentsTenus,PALIERS_MAX,PALIERS,paliersDe,coutPalier,talentAuPalier,ELEMENTS,CLASSES_ELEMENTAIRES,classeElementaire,elementDe,remplaceElement,aDesAccolades,ACCOLADES,sorteAccolade,estElementaire,talentPourElement,palierDe,talentsAuPalier,sansAmeliorationsRemplacees,COMPETENCES_CLASSE,competencesDeClasse,ptDepenses,xpDisponible,normalisePaliersActeur,ordonneTalents,ETATS_JEU,CHOIX_ETAT,TALENTS_CODES,ETATS_CUMULES,cumulable,compteEtat,ajouteEtat,infligeEtat,ondeCures,etatsDArmes,applyDamage,applyHeal,STAT_LIMITS,readStat,writeStat};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
