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
function tokenDistance(a,b,size){const [ax,ay]=mapPoint(a,size),[bx,by]=mapPoint(b,size);return Math.hypot(bx-ax,by-ay)}
// Le socle de la cible doit toucher le disque, pas seulement son centre y tomber.
function inContact(a,b,size,token){return tokenDistance(a,b,size)<=contactRadius(token)+token/2}
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
/* L'équipement est l'affaire des aventuriers. Eux seuls tirent leurs dés, leur portée
   et leur DEF de ce qu'ils portent ; un adversaire n'a pas d'armurerie, et son profil
   est sa carte d'attaque et sa DEF propre — les seules choses qu'un modèle de bestiaire
   sache décrire. Sans cette règle, une arme posée sur une créature rendait muets les dés
   saisis sur sa fiche : on les corrigeait sans rien voir changer. */
function equipRules(actor){return !!(actor&&actor.hero)}
function poolFromGear(actor,items){return equipRules(actor)?equippedPool(actor,items):null}
function rangedFromGear(actor,items){return equipRules(actor)?equippedRanged(actor,items):null}
/* La DEF d'un aventurier est la somme de son armure et de son bouclier, sans exception :
   sans rien porté elle vaut zéro, et elle ne se saisit jamais à la main. Celle d'un
   adversaire est celle de sa fiche, tout simplement. */
function defenseOf(actor,items){if(!equipRules(actor))return Number(actor&&actor.def)||0;
 return equippedDef(actor,items)||0}
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
// Différence de deux rectangles : jusqu'à quatre bandes, exactement l'aire restante.
function diffRect(a,b){const ax2=a.x+a.w,ay2=a.y+a.h,bx2=b.x+b.w,by2=b.y+b.h;
 if(b.x>=ax2||bx2<=a.x||b.y>=ay2||by2<=a.y)return [a];
 const haut=Math.max(a.y,b.y),bas=Math.min(ay2,by2),out=[];
 if(b.y>a.y)out.push({x:a.x,y:a.y,w:a.w,h:b.y-a.y});
 if(by2<ay2)out.push({x:a.x,y:by2,w:a.w,h:ay2-by2});
 if(b.x>a.x)out.push({x:a.x,y:haut,w:b.x-a.x,h:bas-haut});
 if(bx2<ax2)out.push({x:bx2,y:haut,w:ax2-bx2,h:bas-haut});
 return out.filter(r=>r.w>1e-9&&r.h>1e-9)}
// Zones de blocage moins zones de vision : on creuse, comme dans un fromage.
// Garde-fou : au-delà de 600 morceaux on arrête de creuser plutôt que d'exploser.
function subtractRects(rects,holes){let cur=rects.slice();
 for(const h of holes||[]){if(cur.length>600)break;cur=cur.flatMap(r=>diffRect(r,h))}
 return cur}
/* Découpe d'une forme quelconque dans des rectangles : on rastérise la zone
   concernée, on efface l'intérieur du tracé, puis on recompose en rectangles.
   Tout le moteur continue donc de travailler sur des rectangles. */
function boundsOf(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(const p of pts){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1])}
 return {x:x0,y:y0,w:x1-x0,h:y1-y0}}
function rectsOverlap(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h}
// Recompose une grille booléenne en rectangles, par bandes fusionnées.
function gridToRects(g,cols,rows,box,cw,ch){const out=[],fait=new Uint8Array(cols*rows);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;
  if(!g[k]||fait[k])continue;
  let w=1;while(i+w<cols&&g[k+w]&&!fait[k+w])w++;
  let h=1;
  for(;j+h<rows;h++){let plein=true;
   for(let a=0;a<w;a++){const q=(j+h)*cols+i+a;if(!g[q]||fait[q]){plein=false;break}}
   if(!plein)break}
  for(let b=0;b<h;b++)for(let a=0;a<w;a++)fait[(j+b)*cols+i+a]=1;
  out.push({x:box.x+i*cw,y:box.y+j*ch,w:w*cw,h:h*ch})}
 return out}
function carveWithPolygon(rects,poly,pas=.6){
 if(!poly||poly.length<3)return rects;
 const bb=boundsOf(poly),touches=[],intacts=[];
 (rects||[]).forEach(r=>(rectsOverlap(r,bb)?touches:intacts).push(r));
 if(!touches.length)return rects;
 const box=boundsOf(touches.flatMap(r=>[[r.x,r.y],[r.x+r.w,r.y+r.h]]));
 const cols=Math.max(4,Math.min(320,Math.ceil(box.w/pas))),rows=Math.max(4,Math.min(320,Math.ceil(box.h/pas)));
 const cw=box.w/cols,ch=box.h/rows,g=new Uint8Array(cols*rows);
 for(const r of touches){const i0=Math.max(0,Math.ceil((r.x-box.x)/cw-.5)),i1=Math.min(cols-1,Math.floor((r.x+r.w-box.x)/cw-.5));
  const j0=Math.max(0,Math.ceil((r.y-box.y)/ch-.5)),j1=Math.min(rows-1,Math.floor((r.y+r.h-box.y)/ch-.5));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)g[j*cols+i]=1}
 for(let j=0;j<rows;j++){const y=box.y+(j+.5)*ch,xs=[];
  for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length];
   if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]))}
  xs.sort((u,v)=>u-v);
  for(let t=0;t+1<xs.length;t+=2){
   const i0=Math.max(0,Math.ceil((xs[t]-box.x)/cw-.5)),i1=Math.min(cols-1,Math.floor((xs[t+1]-box.x)/cw-.5));
   for(let i=i0;i<=i1;i++)g[j*cols+i]=0}}
 return [...intacts,...gridToRects(g,cols,rows,box,cw,ch)]}
/* Une porte perce toujours la zone de blocage qu'elle recouvre, à l'affichage comme
   au calcul : fermée elle bloque à sa place, ouverte elle laisse le trou béant. */
function wallsPierced(map){const solide=r=>r&&r.w>0&&r.h>0;
 const murs=(map.walls||[]).filter(solide),trous=(map.visions||[]).filter(solide);
 return subtractRects(subtractRects(murs,trous),(map.doors||[]).filter(solide))}
function obstacleRectsFrom(map){if(!map)return [];
 return [...wallsPierced(map),...(map.doors||[]).filter(d=>d&&!d.open&&d.w>0&&d.h>0)]}
/* Recalage des cartes tracées quand l'éditeur réduisait l'image dans son cadre :
   les positions enregistrées étaient comprimées vers le centre. On inverse. */
function uncontain(shapes,frameRatio,imageRatio){
 let sx=1,sy=1;
 if(imageRatio<frameRatio)sx=imageRatio/frameRatio;else sy=frameRatio/imageRatio;
 const ox=(1-sx)/2*100,oy=(1-sy)/2*100;
 return (shapes||[]).map(r=>{const o={...r};o.x=(r.x-ox)/sx;o.y=(r.y-oy)/sy;
  if(typeof r.w==='number')o.w=r.w/sx;if(typeof r.h==='number')o.h=r.h/sy;return o})}
/* Contour exact de l'union de rectangles. Les seules lignes utiles sont les bords des
   rectangles : on comprime les coordonnées sur ces lignes, chaque case est alors
   entièrement pleine ou vide, et on chaîne les arêtes de bord en boucles fermées.
   Aucune quantification, donc aucun escalier qui ne soit déjà dans les données. */
function unionContours(rects){
 const rs=(rects||[]).filter(r=>r&&r.w>1e-9&&r.h>1e-9);
 if(!rs.length)return [];
 // Deux bords calculés autrement tombent au même endroit à 1e-15 près : on les fond,
 // sinon la grille se remplit de lamelles fantômes et le contour part en morceaux.
 const lignes=v=>{const t=[...v].sort((a,b)=>a-b),out=[];
  for(const x of t)if(!out.length||x-out[out.length-1]>1e-7)out.push(x);
  return out};
 const xs=lignes(rs.flatMap(r=>[r.x,r.x+r.w])),ys=lignes(rs.flatMap(r=>[r.y,r.y+r.h]));
 const C=xs.length-1,R=ys.length-1,g=new Uint8Array(C*R);
 // Chaque rectangle marque directement sa plage de cases : la case suit ses bords.
 const rang=(t,v)=>{let a=0,b=t.length-1;while(a<b){const m=(a+b)>>1;if(t[m]<v-1e-7)a=m+1;else b=m}return a};
 for(const r of rs){const i0=rang(xs,r.x),i1=rang(xs,r.x+r.w),j0=rang(ys,r.y),j1=rang(ys,r.y+r.h);
  for(let j=j0;j<j1;j++)for(let i=i0;i<i1;i++)g[j*C+i]=1}
 // Arêtes orientées matière à gauche, indexées par leur point de départ.
 const sorties=new Map(),cle=(x,y)=>x+'|'+y;
 const arete=(ax,ay,bx,by)=>{const k=cle(ax,ay);
  if(!sorties.has(k))sorties.set(k,[]);sorties.get(k).push([bx,by])};
 const plein=(i,j)=>i>=0&&j>=0&&i<C&&j<R&&g[j*C+i]===1;
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){if(!plein(i,j))continue;
  if(!plein(i,j-1))arete(xs[i+1],ys[j],xs[i],ys[j]);
  if(!plein(i,j+1))arete(xs[i],ys[j+1],xs[i+1],ys[j+1]);
  if(!plein(i-1,j))arete(xs[i],ys[j],xs[i],ys[j+1]);
  if(!plein(i+1,j))arete(xs[i+1],ys[j+1],xs[i+1],ys[j]);}
 const contours=[];
 for(const [depart,liste] of sorties){
  while(liste.length){
   const boucle=[depart.split('|').map(Number)];let pt=liste.pop();
   for(let garde=0;garde<200000;garde++){
    boucle.push(pt);const suite=sorties.get(cle(pt[0],pt[1]));
    if(!suite||!suite.length)break;
    pt=suite.pop();
    if(pt[0]===boucle[0][0]&&pt[1]===boucle[0][1])break}
   if(boucle.length>=4)contours.push(fuseAligned(boucle))}}
 return contours}
// Trois points alignés : celui du milieu ne dit rien, on l'enlève.
function fuseAligned(pts){const out=[];
 for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
  const d=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  if(Math.abs(d)>1e-12)out.push(b)}
 return out.length>=3?out:pts}
/* Marche d'escalier → courbe. On simplifie d'abord (Douglas-Peucker : les marches
   cèdent la place à leur corde, l'angle droit franc a un écart trop grand pour céder),
   puis deux passes de Chaikin arrondissent, avec une coupe plafonnée pour qu'un mur
   droit reste droit et qu'un angle d'architecture reste un angle. */
function simplifyClosed(pts,tol){
 if(!pts||pts.length<4||!(tol>0))return pts;
 let loin=0,dmax=-1;
 for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]);
  if(d>dmax){dmax=d;loin=i}}
 const garde=new Uint8Array(pts.length);garde[0]=1;garde[loin]=1;
 const pile=[[0,loin],[loin,pts.length]];
 while(pile.length){const [i,j]=pile.pop();const fin=j===pts.length?0:j;
  let best=-1,bd=tol;
  for(let k=i+1;k<j;k++){const c=closestOnSegment(pts[k],pts[i],pts[fin]);
   const d=Math.hypot(pts[k][0]-c[0],pts[k][1]-c[1]);
   if(d>bd){bd=d;best=k}}
  if(best>=0){garde[best]=1;pile.push([i,best],[best,j])}}
 const out=pts.filter((_,i)=>garde[i]);
 return out.length>=3?out:pts}
/* On ne lisse QUE le tracé de la découpe à main levée, et rien d'autre. Chaque contour
   à main levée est enregistré sur la carte : seuls les sommets qui tombent sur ce tracé
   sont assouplis. Un mur, un angle, une découpe rectangulaire ne sont jamais marqués,
   donc jamais déplacés d'un iota — la géométrie sort bit à bit identique. */
// Distance d'un point au bord d'un rectangle : sert à protéger les angles voulus.
function distToRectEdge(p,r){let d=Infinity;const c=rectPolygon(r);
 for(let i=0,j=c.length-1;i<c.length;j=i++){const q=closestOnSegment(p,c[j],c[i]);
  d=Math.min(d,Math.hypot(p[0]-q[0],p[1]-q[1]))}
 return d}
/* Trois conditions, toutes ensemble : le sommet doit tomber sur un tracé à main levée,
   porter une arête à l'échelle de la trame, et ne pas appartenir au bord d'une forme
   voulue droite — découpe rectangulaire ou porte. Un angle taillé à l'outil Découper
   au beau milieu d'un tracé reste donc parfaitement droit. */
function carveMask(pts,carves,rayon,pas,protege){const n=pts.length,marque=new Uint8Array(n);
 const libre=new Uint8Array(n);
 for(let i=0;i<n;i++){const a=pts[(i+n-1)%n],b=pts[i],c=pts[(i+1)%n];
  const l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]);
  if(Math.min(l1,l2)>pas*2.5)continue;
  if((protege||[]).some(r=>r&&r.w>0&&r.h>0&&distToRectEdge(b,r)<=rayon))continue;
  libre[i]=1}
 for(const poly of carves||[]){if(!poly||poly.length<3)continue;
  const b=boundsOf(poly),x0=b.x-rayon,x1=b.x+b.w+rayon,y0=b.y-rayon,y1=b.y+b.h+rayon;
  for(let i=0;i<n;i++){if(marque[i]||!libre[i])continue;
   const p=pts[i];if(p[0]<x0||p[0]>x1||p[1]<y0||p[1]>y1)continue;
   for(let k=0,j=poly.length-1;k<poly.length;j=k++){
    const c=closestOnSegment(p,poly[j],poly[k]);
    if(Math.hypot(p[0]-c[0],p[1]-c[1])<=rayon){marque[i]=1;break}}}}
 return marque}
/* Moyenne des voisins sur les seuls sommets marqués — le filtre (1,2,1)/4 annule
   exactement l'ondulation d'une case sur deux que laisse la rastérisation — et jamais
   à plus de deux cases de la position d'origine, garde-fou contre toute dérive. */
function relaxContour(pts,pas,passes,marque){
 const n=pts.length,cap=pas*2;let cur=pts;
 for(let p=0;p<passes;p++){const out=new Array(n);
  for(let i=0;i<n;i++){if(!marque[i]){out[i]=cur[i];continue}
   const a=cur[(i+n-1)%n],b=cur[i],c=cur[(i+1)%n];
   let x=(a[0]+2*b[0]+c[0])/4,y=(a[1]+2*b[1]+c[1])/4;
   const dx=x-pts[i][0],dy=y-pts[i][1],d=Math.hypot(dx,dy);
   if(d>cap){x=pts[i][0]+dx/d*cap;y=pts[i][1]+dy/d*cap}
   out[i]=[x,y]}
  cur=out}
 return cur}
// Allègement réservé aux mêmes suites : un sommet non marqué est conservé tel quel.
function simplifyRuns(pts,marque,tol){const n=pts.length,garde=new Uint8Array(n);
 // Contour entièrement issu du tracé : c'est une boucle, pas une suite entre deux ancres.
 if(marque.every(v=>v))return simplifyClosed(pts,tol);
 for(let i=0;i<n;i++)if(!marque[i])garde[i]=1;
 for(let i=0;i<n;i++){if(garde[i])continue;
  let fin=i;while(fin<n&&marque[fin])fin++;
  const chemin=[pts[(i+n-1)%n]];for(let k=i;k<fin;k++)chemin.push(pts[k]);chemin.push(pts[fin%n]);
  const tenus=dpOpen(chemin,tol);
  for(let k=1;k<chemin.length-1;k++)if(tenus[k])garde[i+k-1]=1;
  i=fin}
 const out=pts.filter((_,i)=>garde[i]);
 return out.length>=3?out:pts}
function dpOpen(pts,tol){const n=pts.length,garde=new Uint8Array(n);
 garde[0]=1;garde[n-1]=1;const pile=[[0,n-1]];
 while(pile.length){const [i,j]=pile.pop();
  let best=-1,bd=tol;
  for(let k=i+1;k<j;k++){const c=closestOnSegment(pts[k],pts[i],pts[j]);
   const d=Math.hypot(pts[k][0]-c[0],pts[k][1]-c[1]);
   if(d>bd){bd=d;best=k}}
  if(best>=0){garde[best]=1;pile.push([i,best],[best,j])}}
 return garde}
function smoothContours(contours,carves,tol,pas,protege){
 if(!carves||!carves.length)return (contours||[]).filter(c=>c.length>=3);
 return (contours||[]).map(c=>{
  if(c.length<=12)return c;
  const marque=carveMask(c,carves,pas*1.6,pas,protege);
  if(!marque.some(v=>v))return c;
  return simplifyRuns(relaxContour(c,pas,6,marque),marque,tol)}).filter(c=>c.length>=3)}
/* Export et import des couches d'une carte : zones de blocage, portes, zone de départ,
   adversaires pré-placés, tracés à main levée et découpes. Le même nettoyage sert dans les
   deux sens — ce qui sort est déjà propre, ce qui entre le devient. Rien de ce qui vient
   d'un fichier n'est cru sur parole : nombres bornés, textes coupés, image vérifiée. */
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
function cleanMap(m){const img=typeof (m&&m.image)==='string'&&IMAGE_RE.test(m.image)?m.image:null;
 return {name:texte(m&&m.name,80)||'Carte',ratio:Math.max(.2,Math.min(6,Number(m&&m.ratio)||16/9)),
  fitted:!(m&&m.fitted===false),image:img,
  walls:cleanRects(m&&m.walls),doors:cleanRects(m&&m.doors,true),
  start:cleanRect(m&&m.start),
  foes:(Array.isArray(m&&m.foes)?m.foes:[]).slice(0,200).map(f=>({x:borne(f&&f.x),y:borne(f&&f.y),
   hidden:!!(f&&f.hidden),locked:!!(f&&f.locked),tpl:cleanMonster(f&&f.tpl)})),
  carves:(Array.isArray(m&&m.carves)?m.carves:[]).slice(0,400)
   .map(c=>(Array.isArray(c)?c:[]).slice(0,3000).map(p=>[borne(p&&p[0]),borne(p&&p[1])])).filter(c=>c.length>=3),
  cuts:cleanRects(m&&m.cuts)}}
function packMaps(maps){return {format:MAP_FORMAT,version:1,exporte:new Date().toISOString(),
 maps:(Array.isArray(maps)?maps:[]).map(cleanMap)}}
function readMapsFile(texteBrut){let data;
 try{data=JSON.parse(texteBrut)}catch(e){throw Error('Fichier illisible : ce n’est pas du JSON.')}
 if(!data||data.format!==MAP_FORMAT)throw Error('Ce fichier ne vient pas de l’éditeur de cartes d’Amertume.');
 if(!Array.isArray(data.maps)||!data.maps.length)throw Error('Aucune carte dans ce fichier.');
 return data.maps.slice(0,60).map(cleanMap)}
/* Géométrie effectivement opposée au regard et aux tirs : le contour lissé des zones
   percées par les portes, puis chaque porte close. Dessin et calcul y puisent
   ensemble, donc l'ombre commence exactement là où le mur est peint. */
const CARVE_STEP=.4;
function wallShape(map){return {contours:smoothContours(unionContours(wallsPierced(map)),map&&map.carves,CARVE_STEP*.05,CARVE_STEP,
 [...(map&&map.cuts||[]),...(map&&map.doors||[])])}}
function obstaclesFrom(map){if(!map)return [];
 return [wallShape(map),...(map.doors||[]).filter(d=>d&&!d.open&&d.w>0&&d.h>0).map(d=>({contours:[rectPolygon(d)]}))]}
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
 a.states=pose?[...reste,etat]:reste;return a.states}
/* Les états et ce qu'ils empêchent ou déclenchent. Tout ce qui se calcule vit ici ;
   l'interface ne fait que déclencher au bon moment et raconter. */
const ONDE_EXCLUS=['Blindage','Onde','Vie','Coma'];
function frozenSolid(a){return hasState(a,'Gel')||hasState(a,'Au sol')}
function blinded(a){return hasState(a,'Aveugle')}
/* La saignée se cumule : chaque aggravation vaut un point, et à zéro l'état s'en va. */
function bleedOf(a){return hasState(a,'Saignée')?Math.max(1,Math.trunc(a&&a.bleed)||1):0}
function addBleed(a,n){const v=Math.max(0,Math.min(99,bleedOf(a)+Math.trunc(n)));
 a.bleed=v;setState(a,'Saignée',v>0);return v}
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
const api={visionPolygon,packMaps,readMapsFile,cleanMap,MAP_FORMAT,distToRectEdge,relaxContour,carveMask,simplifyRuns,polyTouchesDisc,rayHitsSegment,contourBox,unionContours,simplifyClosed,smoothContours,wallShape,contoursOf,shapeContains,rectInReach,CARVE_STEP,polygonArea,fillPolygonGrid,packMask,unpackMask,maskChars,regridMask,rayHitsRect,resolveAttack,contactRadius,tokenDistance,inContact,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,obstaclesFrom,obstacleRectsFrom,wallsPierced,uncontain,spreadInZone,diffRect,subtractRects,carveWithPolygon,gridToRects,boundsOf,
 DICE_KEYS,equippedPool,equippedRanged,equippedDef,defenseOf,equipRules,poolFromGear,rangedFromGear,closestOnSegment,pointInPolygon,slideOutOfWalls,skillRoll,statesOf,hasState,setState,ONDE_EXCLUS,frozenSolid,blinded,bleedOf,addBleed,ondeCures,applyDamage,applyHeal,STAT_LIMITS,readStat,writeStat};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
