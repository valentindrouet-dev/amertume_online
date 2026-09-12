/* Conventions provisoires de résolution, détaillées dans l'interface. */
(function(root){
/* Résolution d'une attaque.
   « faille » ajoute un dé rose : il ne blesse jamais, mais tous les dés qui tombent sur
   sa valeur sortent du compte des dégâts. « bleed » est la saignée de la cible, qui
   s'ajoute à tout coup qui passe. */
function resolveAttack({dice,def,dmg,round=1,criticalColor=0,roll,faille=false,bleed=0}){
 const all=dice.map(d=>[...d]);
 if(!all.length||all.some(([v,c])=>!Number.isInteger(v)||v<1||v>6||![0,1,2,3,5,6].includes(c)))throw Error('Réserve offensive invalide');
 if(all.filter(([v,c])=>v===1&&c!==5).length>=2)return {dice:all,failleFace:null,bleed:0,damage:0,failed:true,critical:false};
 const critical=all.filter(([v])=>v===6).length>=2;
 if(critical){if(!all.some(([,c])=>c===criticalColor))throw Error('Couleur critique absente');let v;let count=0;do{v=roll();all.push([v,criticalColor]);if(++count>=100&&v===6)throw Error('Limite de relances atteinte, attaque non appliquée');}while(v===6)}
 const failleFace=faille?roll():null;
 const counts={};all.forEach(([v])=>counts[v]=(counts[v]||0)+1);
 const kept=all.filter(([v,c])=>!(c===1&&counts[v]>1)&&v!==failleFace);const remaining={};kept.forEach(([v])=>remaining[v]=(remaining[v]||0)+1);
 let damage=0,hit=false;
 kept.forEach(([v,c])=>{if(c===2||c===5||v>def){hit=true;damage+=v*(c===3&&remaining[v]>1?2:c===6?Math.min(3,Math.max(1,round)):1)}});
 const saignee=hit?Math.max(0,Math.trunc(bleed)||0):0;
 return {dice:all,failleFace,bleed:saignee,damage:damage+(hit?dmg:0)+saignee,failed:false,critical,hit};
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
function equippedDef(actor,items){const worn=gearOf(actor&&[actor.armorId,actor.shieldId],items);
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
function weaponHands(w){return w&&w.ranged===true?2:(Number(w&&w.hands)===1?1:2)}
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
 const groupes=new Map();armes.forEach(w=>groupes.set(w,(groupes.get(w)||0)+1));
 const nommer=(w,n)=>w.name+(n>1?' ×'+n:'');
 const sorties=[],uneMain=[];
 groupes.forEach((n,w)=>{const copies=Array(n).fill(w);
  if(weaponHands(w)===2)sorties.push({name:nommer(w,n),dice:poolOfWeapons(copies),
   range:w.ranged===true?'distance':'contact',targets:'one',useOwnDamage:true,effects:{},
   etats:etatsDArmes(copies),gear:true});
  else uneMain.push(...copies)});
 if(uneMain.length){const groupesM=new Map();uneMain.forEach(w=>groupesM.set(w,(groupesM.get(w)||0)+1));
  sorties.unshift({name:[...groupesM].map(([w,n])=>nommer(w,n)).join(' + '),dice:poolOfWeapons(uneMain),
   range:'contact',targets:'one',useOwnDamage:true,effects:{},etats:etatsDArmes(uneMain),gear:true})}
 return sorties}
function attackChoices(actor,items){
 return gearAttacks(actor,items).concat(actor&&actor.attacks||[])}
/* L'attaque retenue, quoi qu'il arrive : un choix devenu caduc — l'arme retirée, une
   attaque effacée — retombe sur la première offerte plutôt que sur rien du tout. */
function chosenAttack(actor,items){const liste=attackChoices(actor,items);
 if(!liste.length)return {range:'contact',useOwnDamage:true,dice:null};
 const i=Math.trunc(actor&&actor.activeAttack)||0;
 return liste[i>=0&&i<liste.length?i:0]}
/* La DEF d'un aventurier est ce que porte son armure et son bouclier, zéro compris :
   elle ne se saisit jamais à la main. Celle d'un adversaire lui est propre — écailles,
   cuir épais — et son équipement s'y ajoute s'il en porte. */
function defenseOf(actor,items){const porte=equippedDef(actor,items)||0;
 return actor&&actor.hero?porte:(Number(actor&&actor.def)||0)+porte}
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
 if(porte){o.open=false;if(r.keyLocked)o.keyLocked=true}
 return o}
function cleanRects(list,porte){return (Array.isArray(list)?list:[]).map(r=>cleanRect(r,porte)).filter(Boolean).slice(0,2000)}
function texte(v,n=200){return String(v==null?'':v).slice(0,n)}
function cleanMonster(t){const dés={};
 for(const k of DICE_KEYS)dés[k]=Math.max(0,Math.min(12,Math.round(borne(t&&t.dice&&t.dice[k],0,12))));
 const attaques=(Array.isArray(t&&t.attacks)?t.attacks:[]).slice(0,6).map(a=>{const d={};
  for(const k of DICE_KEYS)d[k]=Math.max(0,Math.min(12,Math.round(borne(a&&a.dice&&a.dice[k],0,12))));
  return {name:texte(a&&a.name,100)||'Attaque',dice:d,range:a&&a.range==='distance'?'distance':'contact',
   targets:a&&a.targets==='all'?'all':'one',useOwnDamage:!(a&&a.useOwnDamage===false)}});
 return {name:texte(t&&t.name,120)||'Adversaire',type:['standard','solitaire','boss'].includes(t&&t.type)?t.type:'standard',
  socle:texte(t&&t.socle,20)||'medium',family:texte(t&&t.family,60),
  pv:Math.round(borne(t&&t.pv,0,9999))||1,def:Math.round(borne(t&&t.def,0,99)),
  damage:Math.round(borne(t&&t.damage,0,999)),xp:Math.round(borne(t&&t.xp,0,9999)),
  menace:texte(t&&t.menace,30)||'closest',esquive:!!(t&&t.esquive),rapide:!!(t&&t.rapide),
  notes:texte(t&&t.notes,2000),attacks:attaques.length?attaques:[{name:'Attaque',dice:dés,range:'contact',targets:'one',useOwnDamage:true}]}}
function cleanAnneau(r){return (Array.isArray(r)?r:[]).slice(0,4000).map(p=>[borne(p&&p[0]),borne(p&&p[1])])}
function cleanMatiere(list){return (Array.isArray(list)?list:[]).slice(0,600).map(p=>{
 const anneaux=(Array.isArray(p&&p.anneaux)?p.anneaux:[]).slice(0,200).map(cleanAnneau).filter(r=>r.length>=3);
 if(!anneaux.length)return null;const o={anneaux};if(p&&p.verrou)o.verrou=true;return o}).filter(Boolean)}
function cleanTraits(list){return (Array.isArray(list)?list:[]).slice(0,600).map(t=>({x1:borne(t&&t.x1),y1:borne(t&&t.y1),
 x2:borne(t&&t.x2),y2:borne(t&&t.y2),e:Math.max(.05,Math.min(5,Number(t&&t.e)||TRAIT_EPAISSEUR))}))}
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
function trouPorte(d,map){if(!d||!(d.w>0&&d.h>0))return null;
 const polys=matiereDe(map),large=d.w>=d.h,epais=large?d.h:d.w,n=12;
 const dedans=pt=>polys.some(p=>polygoneContient(p,pt));
 const sonde=sens=>{if(!polys.length)return 0;
  for(let k=1;k<=n;k++){const s=epais*k/n;
   const pt=large?[d.x+d.w/2,sens<0?d.y-s:d.y+d.h+s]:[sens<0?d.x-s:d.x+d.w+s,d.y+d.h/2];
   if(!dedans(pt))return s}
  return 0};
 const a=sonde(-1),b=sonde(1);
 return large?{x:d.x,y:d.y-a,w:d.w,h:d.h+a+b}:{x:d.x-a,y:d.y,w:d.w+a+b,h:d.h}}
// Une porte close rebouche exactement le trou qu'elle avait percé, prolongement compris.
function doorBlocks(map){return (map&&map.doors||[]).filter(d=>d&&!d.open&&d.w>0&&d.h>0).map(d=>trouPorte(d,map)).filter(Boolean)}
/* Géométrie effectivement opposée au regard et aux tirs : la matière percée de ses portes,
   puis chaque porte close. Dessin et calcul y puisent ensemble, donc l'ombre commence
   exactement là où le mur est peint. */
function wallShape(map){const polys=matiereDe(map);
 const trous=(map&&map.doors||[]).filter(d=>doorPierces(d)&&d.w>0&&d.h>0).map(d=>trouPorte(d,map)).filter(Boolean);
 let mp=versClip(polys);
 if(mp.length&&trous.length)mp=Clipper.difference(mp,...trous.map(t=>[[anneauFerme(rectPolygon(t))]]));
 return {contours:depuisClip(mp).flatMap(p=>p.anneaux)}}
function obstaclesFrom(map){if(!map)return [];
 return [wallShape(map),...doorBlocks(map).map(d=>({contours:[rectPolygon(d)]}))]}
// Une porte se manœuvre au contact : son rectangle doit entrer dans le rayon du token.
function rectInReach(actor,rect,size,token){
 const cx=Math.max(rect.x,Math.min(actor.x,rect.x+rect.w));
 const cy=Math.max(rect.y,Math.min(actor.y,rect.y+rect.h));
 return tokenDistance(actor,{x:cx,y:cy},size)<=contactRadius(token)}
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
function visionPolygon(o,shapes,box){
 const B=box||{x:0,y:0,w:100,h:100};
 // Un héros poussé dans la matière verrait le noir : la forme qui le contient est ignorée.
 const murs=[];
 for(const s of shapes||[]){if(shapeContains(s,[o.x,o.y]))continue;
  for(const c of contoursOf(s))if(c&&c.length>=3)murs.push({pts:c,box:contourBox(c)})}
 const coins=[[B.x,B.y],[B.x+B.w,B.y],[B.x+B.w,B.y+B.h],[B.x,B.y+B.h]];
 for(const m of murs)for(const p of m.pts)coins.push(p);
 const E=2e-5,pts=[];
 for(const c of coins){const base=Math.atan2(c[1]-o.y,c[0]-o.x);
  for(const a of [base-E,base,base+E]){const dx=Math.cos(a),dy=Math.sin(a);
   let t=rayLeavesBox(o.x,o.y,dx,dy,B);
   for(const m of murs){
    // Rejet par boîte englobante : la plupart des contours ne sont pas sur le trajet.
    if(rayHitsRect(o.x,o.y,dx,dy,m.box)>=t)continue;
    const q=m.pts;
    for(let i=0,j=q.length-1;i<q.length;j=i++){const u=rayHitsSegment(o.x,o.y,dx,dy,q[j],q[i]);if(u<t)t=u}}
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
 const n=Math.max(24,Math.min(360,pas||72)),pts=[],murs=[];
 if(!(rayon>0)||!(largeur>0)||!(hauteur>0))return pts;
 for(const s of shapes||[]){if(shapeContains(s,[o.x,o.y]))continue;
  for(const c of contoursOf(s))if(c&&c.length>=3)murs.push({pts:c,box:contourBox(c)})}
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;
  const dx=Math.cos(a)*100/largeur,dy=Math.sin(a)*100/hauteur;
  let t=rayon;
  for(const m of murs){if(rayHitsRect(o.x,o.y,dx,dy,m.box)>=t)continue;
   const q=m.pts;
   for(let k=0,j=q.length-1;k<q.length;j=k++){const u=rayHitsSegment(o.x,o.y,dx,dy,q[j],q[k]);if(u<t)t=u}}
  pts.push([o.x+t*dx,o.y+t*dy])}
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
/* Chaque effet sait se dire en une phrase, avec ses parties réglables en gras : c'est
   ainsi qu'on le lit dans la bibliothèque comme sur la fiche du talent, et qu'on voit d'un
   coup ce qu'un réglage change. Le texte est bâti par le moteur, donc il ne peut pas
   mentir sur ce qu'il fera. */
/* Les états qu'un effet peut poser. Le coma n'en est pas : c'est ce qui arrive à zéro
   point de vie. La liste complète, avec « Aucun » et « Coma », vit dans la table de jeu —
   elle y sert le menu du clic droit, qui n'a pas le même office. */
const ETATS_JEU=['Au sol','Aveugle','Blindage','Ciblage','Faille','Feu','Foudre','Gel',
 'Invisible','Onde','Poison','Saignée','Vie','Affaibli'];
const CHOIX_ETAT=[['','— aucun —'],...ETATS_JEU.map(e=>[e,e])];
const TALENTS_CODES={lamevent:{cle:'lamevent',nom:'Lamevent',bouton:'⚡ Lamevent',
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
   +(b?' + '+b:'')+'</b>'+(e?' et <b>'+e+'</b>':'')+' à '+qui+'.'}}};
/* L'ordre canonique des cibles. Quand plusieurs sont éligibles à une attaque ou à un
   effet, on les prend toujours dans le même ordre, et cet ordre est écrit une fois pour
   toutes : les Boss d'abord, puis les Solitaires, les Alphas et enfin les sbires ; à type
   égal, l'ordre alphabétique ; à nom égal, le numéro porté sur le socle — la cible 1 avant
   la cible 2. Ce numéro suit la place dans la liste des combattants, c'est donc elle qui
   tranche en dernier. Les aventuriers comptent comme des sbires : la règle parle des
   types d'ennemis, et il faut bien que leur ordre soit défini aussi. */
const RANG_TYPE={boss:0,solitaire:1,alpha:2,standard:3};
function rangType(a){return a&&!a.hero&&RANG_TYPE[a.type]!==undefined?RANG_TYPE[a.type]:3}
/* Trie des paires [combattant, place dans la liste]. On garde la place plutôt que le
   numéro affiché : c'est elle qui le produit, et elle est toujours à portée de main. */
function ordreCibles(paires){return [...(paires||[])].sort((u,v)=>
 rangType(u[0])-rangType(v[0])
 ||String(u[0]&&u[0].name||'').localeCompare(String(v[0]&&v[0].name||''),'fr')
 ||u[1]-v[1])}
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
 return (d.options||[]).some(([k])=>k===v)?v:d.defaut}
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
const api={visionPolygon,Clipper,matiereDe,migreMatiere,ajouteMatiere,retireMatiere,refondMatiere,polygoneContient,matiereSous,boitePolygone,transformePolygone,contoursMatiere,capsulePolygon,trouPorte,uncontainPoints,cleanMatiere,ENCRE_TOL,packMaps,readMapsFile,cleanMap,MAP_FORMAT,polyTouchesDisc,rayHitsSegment,contourBox,simplifyClosed,encreDroite,ENCRE_TOL,wallShape,contoursOf,shapeContains,rectInReach,polygonArea,fillPolygonGrid,packMask,unpackMask,maskChars,regridMask,rayHitsRect,reachPolygon,resolveAttack,contactRadius,tokenDistance,inContact,socleFacteur,SOCLE_TAILLES,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,traitPolygon,TRAIT_EPAISSEUR,obstaclesFrom,uncontain,spreadInZone,
 DICE_KEYS,equippedPool,equippedRanged,equippedDef,defenseOf,doorHiddenFrom,doorLockedFor,doorPierces,doorBlocks,rectsOverlap,weaponHands,gearAttacks,attackChoices,chosenAttack,closestOnSegment,pointInPolygon,slideOutOfWalls,skillRoll,statesOf,hasState,setState,ONDE_EXCLUS,frozenSolid,blinded,bleedOf,addBleed,RANG_TYPE,rangType,ordreCibles,cleTalent,cleClasse,classeDe,talentCode,reglageTalent,paramsTalent,phraseTalent,libelleTalent,ETATS_JEU,TALENTS_CODES,ETATS_CUMULES,cumulable,compteEtat,ajouteEtat,infligeEtat,ondeCures,etatsDArmes,applyDamage,applyHeal,STAT_LIMITS,readStat,writeStat};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
