/* Conventions provisoires de résolution, détaillées dans l'interface. */
(function(root){
/* Résolution d'une attaque.
   « faille » ajoute un dé rose : il ne blesse jamais, mais tous les dés qui tombent sur
   sa valeur sortent du compte des dégâts. « bleed » est la saignée de la cible, qui
   s'ajoute à tout coup qui passe. */
/* « doublesCritiques » : Destructeur — n'importe quel double vaut un critique, pas
   seulement deux 6 ; un double 1 reste un échec, il est jugé avant. */
function resolveAttack({dice,def,dmg,round=1,criticalColor=0,roll,faille=false,bleed=0,doublesCritiques=false,solidite=false}){
 const all=dice.map(d=>[...d]);
 if(!all.length||all.some(([v,c])=>!Number.isInteger(v)||v<1||v>6||![0,1,2,3,5,6].includes(c)))throw Error('Réserve offensive invalide');
 /* Un dé d'os qui double avec un autre dé lancé s'en va d'abord, avant tout le reste :
    il ne compte ni pour l'échec, ni pour le critique, ni pour les dégâts. Un 6 d'os et
    un 6 blanc ne font donc pas de critique — l'os est parti avant qu'on les compte. */
 const faces0={};all.forEach(([v])=>faces0[v]=(faces0[v]||0)+1);
 const vifs=all.filter(([v,c])=>!(c===1&&faces0[v]>1));
 if(vifs.filter(([v,c])=>v===1&&c!==5).length>=2)return {dice:all,failleFace:null,bleed:0,reduction:0,damage:0,failed:true,critical:false};
 const faces={};vifs.forEach(([v])=>faces[v]=(faces[v]||0)+1);
 const critical=faces[6]>=2||(doublesCritiques&&Object.keys(faces).some(v=>Number(v)!==1&&faces[v]>=2));
 if(critical){if(!vifs.some(([,c])=>c===criticalColor))throw Error('Couleur critique absente');let v;let count=0;do{v=roll();all.push([v,criticalColor]);vifs.push([v,criticalColor]);if(++count>=100&&v===6)throw Error('Limite de relances atteinte, attaque non appliquée');}while(v===6)}
 const failleFace=faille?roll():null;
 const kept=vifs.filter(([v])=>v!==failleFace);const remaining={};kept.forEach(([v])=>remaining[v]=(remaining[v]||0)+1);
 /* La DEF n'écarte plus aucun dé : tous passent, et les dégâts subis — dés, bonus et
    saignée ensemble — baissent de sa valeur, jamais sous zéro. Le Lourd (rouge) et le
    Mortel (noir) l'ignorent et s'appliquent en entier ; sous Solidité, le Lourd la subit. */
 let brut=0,fixe=0,hit=false;
 kept.forEach(([v,c])=>{hit=true;const d=v*(c===3&&remaining[v]>1?2:c===6?Math.min(3,Math.max(1,round)):1);
  if(c===5||(c===2&&!solidite))fixe+=d;else brut+=d});
 const saignee=hit?Math.max(0,Math.trunc(bleed)||0):0;
 const subi=brut+(hit?dmg:0)+saignee,reduction=Math.min(subi,Math.max(0,Math.trunc(def)||0));
 return {dice:all,failleFace,bleed:saignee,reduction,damage:subi-reduction+fixe,failed:false,critical,hit};
}
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
 const attaque=(lot,range)=>{const groupes=new Map();lot.forEach(w=>groupes.set(w,(groupes.get(w)||0)+1));
  const tire=range==='distance'&&mun,dice=poolOfWeapons(lot);
  if(tire&&DICE_KEYS.includes(mun.munDe))dice[mun.munDe]=Math.min(12,(dice[mun.munDe]||0)+1);
  const etats=[...new Set([...etatsDArmes(lot),...(tire&&mun.etat?[mun.etat]:[])])];
  return {name:[...groupes].map(([w,n])=>w.name+(n>1?' ×'+n:'')).join(' + ')+(tire?' · '+mun.name:''),dice,range,
   targets:'one',useOwnDamage:true,effects:{},etats,logos:lot.filter(w=>w.logo).map(w=>String(w.logo)).slice(0,2),gear:true,munition:tire?mun.id:null}};
 const contact=armes.filter(w=>w.ranged!==true),distance=armes.filter(w=>w.ranged===true);
 const sorties=[];if(contact.length)sorties.push(attaque(contact,'contact'));if(distance.length)sorties.push(attaque(distance,'distance'));
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
function doorHiddenFrom(d,estMJ){return !!(d&&d.secret&&!d.open&&!estMJ)}
function doorLockedFor(d,estMJ){return !estMJ&&!!(d&&(d.keyLocked||(d.secret&&!d.open)))}
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
  if(ETATS_JEU.includes(a&&a.etat))o.etat=a.etat;
  return o});
 return {name:texte(t&&t.name,120)||'Adversaire',type:['standard','solitaire','boss'].includes(t&&t.type)?t.type:'standard',
  socle:texte(t&&t.socle,20)||'medium',family:texte(t&&t.family,60),
  pv:Math.round(borne(t&&t.pv,0,9999))||1,def:Math.round(borne(t&&t.def,0,99)),
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
  items:(Array.isArray(o&&o.items)?o.items:[]).filter(x=>typeof x==='string').slice(0,20).map(x=>texte(x,60)).filter(Boolean),
  tresor:texte(o&&o.tresor,200),
  test:{comp:Math.max(0,Math.min(7,Math.trunc(Number(t.comp))||0)),
   reussites:Math.max(1,Math.min(9,Math.trunc(Number(t.reussites))||1))}}}
function cleanMap(m){const img=typeof (m&&m.image)==='string'&&IMAGE_RE.test(m.image)?m.image:null;
 const ratio=Math.max(.2,Math.min(6,Number(m&&m.ratio)||16/9));
 const matiere=Array.isArray(m&&m.matiere)?cleanMatiere(m.matiere)
  :migreMatiere({ratio,walls:cleanRects(m&&m.walls),visions:cleanRects(m&&m.visions),traits:cleanTraits(m&&m.traits)}).matiere;
 return {name:texte(m&&m.name,80)||'Carte',ratio,
  fitted:!(m&&m.fitted===false),image:img,
  matiere,doors:cleanRects(m&&m.doors,true),
  start:cleanRect(m&&m.start),
  foes:(Array.isArray(m&&m.foes)?m.foes:[]).slice(0,200).map(f=>({x:borne(f&&f.x),y:borne(f&&f.y),
   hidden:!!(f&&f.hidden),locked:!!(f&&f.locked),tpl:cleanMonster(f&&f.tpl)})),
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
function doorPierces(d){return !!d&&(!d.secret||!!d.open)}
function rectsOverlap(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h}
/* Une porte de biais. Elle garde son rectangle {x,y,w,h} et gagne un angle « a », en
   degrés, qui la tourne autour de son centre — dans le repère de l'écran, sinon elle se
   déformerait avec le format de la carte. Sans angle, c'est la porte d'avant, bit pour
   bit. Le repère de la porte : son centre, ses demi-côtés et ses deux axes, en unités
   d'écran (l'abscisse multipliée par le rapport). */
function doorFrame(d,ratio){const r=Math.max(.05,Number(ratio)||16/9),a=(Number(d&&d.a)||0)*Math.PI/180;
 const ux=Math.cos(a),uy=Math.sin(a);
 return {r,cx:(d.x+d.w/2)*r,cy:d.y+d.h/2,hw:d.w*r/2,hh:d.h/2,ux,uy,vx:-uy,vy:ux}}
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
function visionPolygon(o,shapes,box){
 const B=box||{x:0,y:0,w:100,h:100},exclues=formesAutour(o,shapes),idx=indexMurs(shapes);
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
 const c=Object.values(TALENTS_CODES).find(x=>cleTalent(x.nom)===k);return c?c.cle:''}
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
    d'Orbes mystiques au-dessus : c'est le MJ qui nomme le prérequis, talent par talent. */
 orbesfeu:{cle:'orbesfeu',nom:'Orbes de feu',type:'ame',
  aide:'Les orbes du porteur infligent un état en plus de leurs dégâts.',
  params:[{cle:'etat',nom:'État infligé',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Les orbes du porteur infligent <b>'+((p&&p.etat)||'Feu')+'</b> en plus de leurs dégâts.'}},
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
    Blindage — l'allié ciblé, sinon le plus proche. Une fois par combat. */
 gardien:{cle:'gardien',nom:'Gardien',type:'mait',bouton:'🛡 Gardien',
  aide:'Maîtrise : au début du premier tour de combat, un aventurier allié au contact reçoit Blindage — l’allié ciblé, sinon le plus proche.',
  params:[],
  phrase(){return 'Au début du premier tour de combat, un aventurier allié <b>au contact</b> reçoit <b>Blindage</b> : l’allié ciblé, sinon le plus proche.'}},
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
 mauvaissort:{cle:'mauvaissort',nom:'Mauvais Sort',type:'pass',monstre:true,
  aide:'Passif : un combattant qui cible le porteur relance son meilleur dé de dégâts, avant le calcul des dégâts.',
  params:[],
  phrase(){return 'Qui cible le porteur <b>relance son meilleur dé</b> de dégâts, avant le calcul.'}},
 /* Attaque État : une action. Le porteur effectue une attaque — celle de son bouton, cibles
    et geste compris — et, selon l'issue, gagne l'état réglé : s'il tue la cible, ou si elle
    en réchappe. C'est le porteur qui reçoit l'état, jamais la cible. */
 attaqueetat:{cle:'attaqueetat',nom:'Attaque État',type:'act',bouton:'⚔ Attaque État',attaque:true,
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
 meneur:{cle:'meneur',nom:'Meneur',type:'pass',
  aide:'Passif : le porteur augmente les dégâts, la DEF ou les PV max — temporairement — d’un, deux ou tous ses alliés au contact ou dans sa ligne de vue.',
  params:[{cle:'quoi',nom:'Ce qu’il augmente',type:'choix',defaut:'dmg',options:[['dmg','les dégâts'],['def','la DEF'],['pv','les PV max, temporairement']]},
   {cle:'valeur',nom:'De combien',type:'nombre',defaut:1,min:1,max:20},
   {cle:'combien',nom:'Pour',type:'choix',defaut:'un',options:[['un','un allié'],['deux','deux alliés'],['tous','tous les alliés']]},
   {cle:'portee',nom:'Qui se trouve',type:'choix',defaut:'contact',options:[['contact','au contact'],['vue','dans la ligne de vue']]}],
  phrase(p){const q={dmg:'les dégâts',def:'la DEF',pv:'les PV max temporaires'}[p&&p.quoi]||'les dégâts';
   const c={un:'un allié',deux:'deux alliés',tous:'tous les alliés'}[p&&p.combien]||'un allié';
   return 'Vous augmentez <b>'+q+'</b> de <b>'+Math.max(1,(p&&p.valeur)|0)+'</b> pour <b>'+c+'</b> <b>'+((p&&p.portee)==='vue'?'dans votre ligne de vue':'au contact')+'</b>.'}},
 /* Bonus de caractéristique : un nœud d'arbre qui n'est pas un talent. Appris, il ajoute
    à la fiche : des PV max, de l'Endurance, de la Vie, des dégâts, ou un point à une
    compétence. La fiche garde ses valeurs propres ; le bonus s'ajoute à la lecture. */
 bonus:{cle:'bonus',nom:'Bonus de caractéristique',type:'pass',
  aide:'Un nœud d’arbre qui n’est pas un talent : +x PV max, Endurance, Vie, Dégâts, ou un point à une compétence.',
  params:[{cle:'carac',nom:'Caractéristique',type:'choix',defaut:'pv',options:[['pv','PV max'],['endu','Endurance'],['vie','Vie'],['dmg','Dégâts'],['comp','Compétence']]},
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
 ignition:{cle:'ignition',nom:'Ignition',type:'ame',
  aide:'Un orbe lancé sur un allié désigné charge sa prochaine attaque au contact, au lieu de blesser.',
  params:[],
  phrase(){return 'Un orbe lancé sur un <b>allié désigné</b> ne lui fait aucun mal : sa <b>prochaine attaque au contact</b> inflige l’affection des orbes du porteur.'}},
 /* Invulnérable : une amélioration. L'affection réglée ne prend jamais sur le porteur, d'où
    qu'elle vienne — arme, orbe, objet ou main du MJ par un effet. */
 invulnerable:{cle:'invulnerable',nom:'Invulnérable',type:'ame',
  aide:'Amélioration : le porteur ne subit jamais l’état réglé.',
  params:[{cle:'etat',nom:'État jamais subi',type:'choix',defaut:'Feu',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Le porteur ne subit <b>jamais '+((p&&p.etat)||'Feu')+'</b>.'}},
 /* Brise : une amélioration. Contre une cible qui porte l'affection réglée, les attaques du
    porteur passent la garde : la DEF ne compte plus. */
 brise:{cle:'brise',nom:'Brise',type:'ame',
  aide:'Amélioration : les attaques du porteur ignorent la DEF des cibles portant l’état réglé.',
  params:[{cle:'etat',nom:'État qui ouvre la garde',type:'choix',defaut:'Gel',options:ETATS_JEU.map(e=>[e,e])}],
  phrase(p){return 'Les attaques du porteur <b>ignorent la DEF</b> des cibles qui portent <b>'+((p&&p.etat)||'Gel')+'</b>.'}},
 /* Solidité : une amélioration. La DEF du porteur retranche aussi les dés Lourds — le rouge,
    qui l'ignore chez tout autre. Le Mortel, noir, passe toujours en entier. */
 solidite:{cle:'solidite',nom:'Solidité',type:'ame',
  aide:'Amélioration : la DEF du porteur réduit aussi les dés rouges (Lourds), qui d’ordinaire l’ignorent.',
  params:[],
  phrase(){return 'La DEF du porteur réduit aussi les <b>dés de dégâts mortels</b> (rouges).'}},
 provocation:{cle:'provocation',nom:'Provocation',type:'act',bouton:'📣 Provocation',attaque:true,
  aide:'Action : un adversaire en vue s’avance jusqu’au porteur, qui l’attaque aussitôt.',
  params:[],
  phrase(){return 'Un adversaire <b>en ligne de vue</b> doit faire un mouvement vers le porteur — l’adversaire visé, sinon le premier en vue — puis le porteur effectue <b>une attaque</b> contre lui.'}}};
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
function orbesPermis(portes){return (portes||[]).filter(t=>t&&t.code&&t.code.cle==='orbes')
 .reduce((n,t)=>Math.max(n,Math.trunc(t.params&&t.params.orbes)||0),0)}
/* Les dés d'un orbe : le talent le plus généreux en dés fait foi, avec sa couleur. */
function desOrbe(portes){const t=(portes||[]).filter(t=>t&&t.code&&t.code.cle==='orbes')
 .sort((u,v)=>(Math.trunc(v.params&&v.params.des)||0)-(Math.trunc(u.params&&u.params.des)||0))[0];
 if(!t)return null;const couleur=DES_ORBE.some(([k])=>k===(t.params&&t.params.couleur))?t.params.couleur:'blue';
 return {n:Math.max(1,Math.trunc(t.params&&t.params.des)||1),couleur,nom:DES_ORBE.find(([k])=>k===couleur)[1]}}
function etatDesOrbes(portes){const t=(portes||[]).find(t=>t&&t.code&&t.code.cle==='orbesfeu');
 return t?String(t.params&&t.params.etat||'Feu'):''}
/* Une affection que le porteur ne subit jamais : Invulnérable la refuse avant qu'elle ne
   se pose, d'où qu'elle vienne. */
function etatRefuse(portes,etat){if(!etat)return false;
 return (portes||[]).some(t=>t&&t.code&&t.code.cle==='invulnerable'&&String(t.params&&t.params.etat||'Feu')===etat)}
/* Brise : contre une cible qui porte l'affection réglée, la DEF ne compte plus. */
function briseLaGarde(portes,cible){
 return (portes||[]).some(t=>t&&t.code&&t.code.cle==='brise'&&hasState(cible,String(t.params&&t.params.etat||'Gel')))}
/* ---------- Les points d'activation ----------
   Ce qu'un combattant peut dépenser dans son tour : une Action, un Mouvement et un Objet
   d'ordinaire. Des talents en donneront davantage ; le jeu est prêt à les compter, jusqu'à
   ces plafonds. Les comptes vivent dans « checks », qui portait des oui-non : un ancien
   « true » vaut un point dépensé, et tout ce qui lisait « a-t-il joué ? » lit toujours vrai. */
const POINTS_MAX={action:4,mouvement:3,objet:1};
const POINTS_CLES=['action','mouvement','objet'];
// Combien il en a : ce que sa fiche déclare, borné au plafond, un au moins.
function pointsMax(a,quoi){const plafond=POINTS_MAX[quoi]||1;
 const v=Math.trunc(Number(a&&a.points&&a.points[quoi]));
 return Math.max(1,Math.min(plafond,Number.isFinite(v)&&v>0?v:1))}
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
function phraseTalent(cle,params){const code=TALENTS_CODES[cle];
 if(!code||typeof code.phrase!=='function')return code&&code.aide||'';
 return code.phrase(paramsTalent({effet:cle,params}))}
/* La même phrase, dépouillée de son gras : une option de menu déroulant ne porte que du
   texte. « Lamevent : En terminant un mouvement, le porteur inflige… » se lit alors d'un
   trait dans la liste, sans qu'il faille la choisir pour savoir ce qu'elle fait. */
function libelleTalent(cle,params){const code=TALENTS_CODES[cle];if(!code)return '';
 const dit=phraseTalent(cle,params).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 return dit?code.nom+' : '+dit:code.nom}
/* L'Onde purge l'affection la plus fraîche — celle qui vient de tomber — et se consume.
   Les états bénéfiques et le coma ne s'en vont jamais ainsi. */
function ondeCures(a){const l=statesOf(a).filter(e=>!ONDE_EXCLUS.includes(e));return l.length?l[l.length-1]:null}
/* Les dégâts d'un effet ne se défendent pas : ni DEF, ni blindage, ni saignée. */
function applyDamage(a,montant){const perdu=Math.min(a.hp,Math.max(0,Math.trunc(montant)||0));
 a.hp=Math.max(0,a.hp-perdu);if(a.hp===0)setState(a,'Coma',true);return perdu}
function applyHeal(a,montant){const gagne=Math.min(Math.max(0,a.max-a.hp),Math.max(0,Math.trunc(montant)||0));
 a.hp+=gagne;if(a.hp>0)setState(a,'Coma',false);return gagne}
/* ---------- Caractéristiques corrigées à la main ---------- */
/* Chaque caractéristique a ses bornes, les mêmes que dans le formulaire de fiche.
   Une saisie vide, illisible ou d'un autre monde ne détruit rien : elle revient à
   la valeur d'avant, ou s'arrête à la borne. La virgule vaut le point : on tape
   comme on écrit. */
const STAT_LIMITS={hp:[0,99999],max:[1,99999],def:[0,99],dmg:[0,999],xp:[0,999999],
 level:[1,7],endu:[1,999],pvBonus:[-9999,9999],skill:[0,30],
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
function writeStat(a,cle,texte){if(!a||!STAT_LIMITS[cle])return null;
 const v=readStat(cle,texte,a[cle]);a[cle]=v;
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
const NOM_CARAC={pv:'PV max',endu:'Endurance',vie:'Vie',def:'DEF',dmg:'Dégâts'},NOM_CARAC_COURT={pv:'PV',endu:'Endu',vie:'Vie',def:'DEF',dmg:'Dég.'};
// « +2 PV max », « +1 Force » — ou, en court pour un nœud d'arbre, « +2 PV ».
function libelleBonus(p,court){const n=Math.max(1,(p&&p.valeur)|0),c=p&&p.carac;
 if(c==='comp')return '+'+n+' '+(COMPETENCES[Number(p&&p.comp)||0]||COMPETENCES[0]);
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
function rareteDe(o){const r=o&&o.rarete;return RARETES.some(([k])=>k===r)?r:'commun'}
const NOM_RARETE=r=>(RARETES.find(([k])=>k===r)||RARETES[0])[1];
const CARACS_EQUIP=[['pv','PV max'],['endu','Endurance'],['vie','Vie'],['def','DEF'],['dmg','Dégâts'],['comp','Compétence']];
function normaliseBonusEquip(l){return (Array.isArray(l)?l:[]).filter(b=>b&&typeof b==='object').slice(0,12).map(b=>({
 carac:CARACS_EQUIP.some(([k])=>k===b.carac)?b.carac:'pv',valeur:Math.max(1,Math.min(99,Math.trunc(Number(b.valeur))||1)),
 comp:String(Math.max(0,Math.min(COMPETENCES.length-1,Math.trunc(Number(b.comp))||0)))}))}
// Ce que l'équipement porté confère : chaque pièce aux mains, sur le corps, au bras — deux anneaux, deux fois.
function bonusEquipement(a,items){const out=bonusVide();
 gearOf(a&&[...(a.weapons||[]),...armuresDe(a),a.shieldId],items).forEach(o=>normaliseBonusEquip(o.bonus).forEach(b=>ajouteBonus(out,b.carac,b.valeur,b.comp)));
 return out}
// Tout ce qui s'ajoute à la fiche : les nœuds appris, et l'équipement porté.
function bonusDe(a,talents,items){const out=bonusTalents(talentsTenus(a&&a.talents,talents)
 .map(t=>{const code=talentCode(t);return code?{code,params:paramsTalent(t)}:null}).filter(Boolean));
 if(items){const e=bonusEquipement(a,items);['pv','endu','vie','def','dmg'].forEach(k=>out[k]+=e[k]);e.skills.forEach((n,k)=>out.skills[k]+=n)}
 return out}
// La Vie et l'Endurance telles qu'elles jouent : la fiche, plus les bonus appris et portés.
function vieDe(a,talents,items){return (Math.trunc(Number(a&&a.vie))||0)+(talents||items?bonusDe(a,talents,items).vie:0)}
function enduDe(a,talents,items){return (Math.trunc(Number(a&&a.endu))||0)+(talents||items?bonusDe(a,talents,items).endu:0)}
/* Les élus d'un Meneur : parmi les alliés à sa portée, les plus proches — un, deux, ou
   tous. « candidats » : des {a,dist}, la table les a déjà triés par portée. */
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
function nouveauBatiment(nom,id){return {id:id||idDomaine(),nom:String(nom||'Bâtiment').slice(0,60),etape:0,etat:'',zone:null,etiquette:null,couts:[0,0,0],effets:['','','',''],notes:''}}
function normaliseBatiment(b){const n=nouveauBatiment(b&&b.nom,b&&b.id);
 n.etape=Math.max(0,Math.min(3,Math.trunc(Number(b&&b.etape))||0));
 n.etat=b&&typeof b.etat==='string'&&b.etat&&ETATS_BATIMENT.some(([k])=>k===b.etat)?b.etat:'';
 n.zone=zoneValide(b&&b.zone);
 // Où s'écrit son nom : là où le MJ l'a posé, sinon au centre de sa zone.
 const et=b&&b.etiquette;n.etiquette=Array.isArray(et)&&et.length>=2&&Number.isFinite(Number(et[0]))&&Number.isFinite(Number(et[1]))?[borne(et[0],0,100),borne(et[1],0,100)]:null;
 n.couts=[0,1,2].map(i=>Math.max(0,Math.trunc(Number(b&&b.couts&&b.couts[i]))||0));
 n.effets=[0,1,2,3].map(i=>String(b&&b.effets&&b.effets[i]||'').slice(0,600));
 n.notes=String(b&&b.notes||'').slice(0,2000);return n}
function normalisePnj(p){return {id:p&&p.id||idDomaine(),nom:String(p&&p.nom||'Inconnu').slice(0,60),role:String(p&&p.role||'').slice(0,80),
 statut:p&&p.statut==='visiteur'?'visiteur':'habitant',batiment:String(p&&p.batiment||'').slice(0,60),notes:String(p&&p.notes||'').slice(0,2000)}}
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
  pnj:(Array.isArray(d.pnj)?d.pnj:[]).filter(Boolean).slice(0,300).map(normalisePnj),aventuriers}}
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
const api={visionPolygon,cleanMonster,Clipper,matiereDe,migreMatiere,ajouteMatiere,retireMatiere,refondMatiere,polygoneContient,matiereSous,boitePolygone,transformePolygone,contoursMatiere,capsulePolygon,trouPorte,doorFrame,doorPolygon,anglePoignee,redimPorteTournee,polyInReach,uncontainPoints,cleanMatiere,ENCRE_TOL,packMaps,readMapsFile,cleanMap,cleanObjet,TAILLES_OBJET,MAP_FORMAT,polyTouchesDisc,rayHitsSegment,contourBox,simplifyClosed,encreDroite,ENCRE_TOL,wallShape,contoursOf,shapeContains,rectInReach,polygonArea,fillPolygonGrid,packMask,unpackMask,maskChars,regridMask,rayHitsRect,reachPolygon,resolveAttack,contactRadius,tokenDistance,inContact,socleFacteur,SOCLE_TAILLES,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,traitPolygon,TRAIT_EPAISSEUR,obstaclesFrom,indexMurs,rayonContre,formesAutour,uncontain,spreadInZone,
 CALQUES_DOMAINE,ETATS_BATIMENT,NOM_ETAT_BATIMENT,calqueDuBatiment,cleanSegments,cleanEtiquettes,traceCoupure,
 COMPETENCES,NOM_CARAC,libelleBonus,bonusTalents,bonusDe,vieDe,enduDe,elusMeneur,RARETES,rareteDe,NOM_RARETE,CARACS_EQUIP,normaliseBonusEquip,bonusEquipement,bonusVide,rempliAnneaux,calculeZones,zoneAu,
 ETAPES_DOMAINE,NOM_ETAPE,BATIMENTS_DEFAUT,STATUTS_PNJ,idDomaine,zoneValide,nouveauBatiment,normaliseDomaine,coutEtape,prochaineEtape,peutConstruire,mouvementFinance,construire,reculerEtape,avancerEtape,ligneDesJoueurs,CARTOUCHES_DOMAINE,cartouchesValides,calqueDisponible,centroide,batimentSous,pnjDuBatiment,deplaceZone,
 DICE_KEYS,modeObjet,phraseDeObjet,passifsPortes,EQUIPEMENTS,equippedPool,equippedRanged,equippedDef,MAINS_MAX,EMPLACEMENTS,NOM_EMPLACEMENT,placesEmplacement,emplacementDe,armuresDe,portesA,placesLibres,defenseOf,doorHiddenFrom,doorLockedFor,doorPierces,doorBlocks,rectsOverlap,weaponHands,gearAttacks,attackChoices,chosenAttack,closestOnSegment,pointInPolygon,slideOutOfWalls,ecarteDesSocles,dansUnSocle,segmentCoupeSocles,poserHorsDesSocles,skillRoll,statesOf,hasState,setState,ONDE_EXCLUS,frozenSolid,blinded,bleedOf,addBleed,RANG_TYPE,rangType,ordreCibles,cleTalent,effetParNom,cleClasse,OBJETS_CODES,USAGES_OBJET,USAGES_LIMITES,usageLimite,NOM_USAGE,objetCode,paramsObjet,phraseObjet,usageObjet,immunites,immuniseEtat,immuniseDe,poseImmunite,classeDe,bonusPV,pvMaximum,pvEspece,ESPECES_PV,talentCode,reglageTalent,paramsTalent,phraseTalent,libelleTalent,ciblesPermises,orbesPermis,desOrbe,DES_ORBE,etatDesOrbes,partDuRempart,porteEffet,mauvaisSort,regenerationDe,montantRegeneration,etatRefuse,briseLaGarde,POINTS_MAX,POINTS_CLES,pointsMax,pointsUses,pointsRestants,depensePoint,rendPoint,epuisePoints,talentDuCatalogue,manqueTalent,nomPrerequis,talentsDependants,talentsSans,talentsTenus,ordonneTalents,ETATS_JEU,CHOIX_ETAT,TALENTS_CODES,ETATS_CUMULES,cumulable,compteEtat,ajouteEtat,infligeEtat,ondeCures,etatsDArmes,applyDamage,applyHeal,STAT_LIMITS,readStat,writeStat};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
