/* Conventions provisoires de résolution, détaillées dans l'interface. */
(function(root){
function resolveAttack({dice,def,dmg,round=1,criticalColor=0,roll}){
 const all=dice.map(d=>[...d]);
 if(!all.length||all.some(([v,c])=>!Number.isInteger(v)||v<1||v>6||![0,1,2,3,5,6].includes(c)))throw Error('Réserve offensive invalide');
 if(all.filter(([v,c])=>v===1&&c!==5).length>=2)return {dice:all,damage:0,failed:true,critical:false};
 const critical=all.filter(([v])=>v===6).length>=2;
 if(critical){if(!all.some(([,c])=>c===criticalColor))throw Error('Couleur critique absente');let v;let count=0;do{v=roll();all.push([v,criticalColor]);if(++count>=100&&v===6)throw Error('Limite de relances atteinte, attaque non appliquée');}while(v===6)}
 const counts={};all.forEach(([v])=>counts[v]=(counts[v]||0)+1);
 const kept=all.filter(([v,c])=>!(c===1&&counts[v]>1));const remaining={};kept.forEach(([v])=>remaining[v]=(remaining[v]||0)+1);
 let damage=0,hit=false;
 kept.forEach(([v,c])=>{if(c===2||c===5||v>def){hit=true;damage+=v*(c===3&&remaining[v]>1?2:c===6?Math.min(3,Math.max(1,round)):1)}});
 return {dice:all,damage:damage+(hit?dmg:0),failed:false,critical,hit};
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
function segmentHitsPolys(p,q,polys){return (polys||[]).some(poly=>poly.some((pt,i)=>crosses(p,q,pt,poly[(i+1)%poly.length])))}
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
/* Déplacement : le socle est un disque repoussé hors des murs. Le mouvement restant
   subsiste le long de l'obstacle, ce qui produit le glissement. */
function closestOnSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
 const t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2)):0;return [a[0]+t*dx,a[1]+t*dy]}
function pointInPolygon(p,poly){let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];
  if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside}return inside}
function slideOutOfWalls(p,polys,r){let x=p[0],y=p[1];
 for(let pass=0;pass<4;pass++){let touched=false;
  for(const poly of polys||[]){if(!poly||poly.length<3)continue;
   let best=null,bd=Infinity;
   for(let i=0;i<poly.length;i++){const c=closestOnSegment([x,y],poly[i],poly[(i+1)%poly.length]);const d=Math.hypot(x-c[0],y-c[1]);if(d<bd){bd=d;best=c}}
   const inside=pointInPolygon([x,y],poly);
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
function obstaclesFrom(map){return obstacleRectsFrom(map).map(rectPolygon)}
// Répartit n combattants en grille dans la zone de départ, sans sortir de ses bords.
function spreadInZone(n,zone){if(!zone||n<1)return [];
 const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols),out=[];
 for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);
  out.push({x:zone.x+zone.w*(c+.5)/cols,y:zone.y+zone.h*(r+.5)/rows})}
 return out}
/* Brouillard de guerre : une grille de cellules, visible depuis un héros si le
   segment qui les relie ne traverse aucun obstacle. Les portes fermées comptent.
   Le test travaille sur les rectangles eux-mêmes : rejet par boîte englobante
   puis découpe par tranches, bien moins coûteux qu'arête par arête. */
function segmentHitsRect(px,py,qx,qy,r){
 const rx2=r.x+r.w,ry2=r.y+r.h;
 if((px<r.x&&qx<r.x)||(px>rx2&&qx>rx2)||(py<r.y&&qy<r.y)||(py>ry2&&qy>ry2))return false;
 let t0=0,t1=1;const dx=qx-px,dy=qy-py;
 if(dx>-1e-12&&dx<1e-12){if(px<r.x||px>rx2)return false}
 else{let a=(r.x-px)/dx,b=(rx2-px)/dx;if(a>b){const t=a;a=b;b=t}
  if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false}
 if(dy>-1e-12&&dy<1e-12){if(py<r.y||py>ry2)return false}
 else{let a=(r.y-py)/dy,b=(ry2-py)/dy;if(a>b){const t=a;a=b;b=t}
  if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false}
 return true}
function visibleCells(heroes,rects,cols,rows){const vis=new Uint8Array(cols*rows);
 const rs=rects||[],hs=heroes||[];
 for(let j=0;j<rows;j++){const cy=(j+.5)/rows*100;
  for(let i=0;i<cols;i++){const cx=(i+.5)/cols*100;
   for(const h of hs){let vu=true;
    for(let k=0;k<rs.length;k++)if(segmentHitsRect(h.x,h.y,cx,cy,rs[k])){vu=false;break}
    if(vu){vis[j*cols+i]=1;break}}}}
 return vis}
const api={visibleCells,segmentHitsRect,resolveAttack,contactRadius,tokenDistance,inContact,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,obstaclesFrom,obstacleRectsFrom,wallsPierced,uncontain,spreadInZone,diffRect,subtractRects,carveWithPolygon,gridToRects,boundsOf,
 DICE_KEYS,equippedPool,equippedRanged,equippedDef,closestOnSegment,pointInPolygon,slideOutOfWalls};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
