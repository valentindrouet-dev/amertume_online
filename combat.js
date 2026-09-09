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
function obstaclesFrom(map){if(!map)return [];
 return [...(map.walls||[]),...(map.doors||[]).filter(d=>d&&!d.open)]
  .filter(r=>r&&r.w>0&&r.h>0).map(rectPolygon)}
// Répartit n combattants en grille dans la zone de départ, sans sortir de ses bords.
function spreadInZone(n,zone){if(!zone||n<1)return [];
 const cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols),out=[];
 for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);
  out.push({x:zone.x+zone.w*(c+.5)/cols,y:zone.y+zone.h*(r+.5)/rows})}
 return out}
const api={resolveAttack,contactRadius,tokenDistance,inContact,sightBlockers,hasLineOfSight,crosses,wallsBetween,segmentHitsPolys,
 rectPolygon,obstaclesFrom,spreadInZone,
 DICE_KEYS,equippedPool,equippedRanged,equippedDef,closestOnSegment,pointInPolygon,slideOutOfWalls};
if(typeof module!=='undefined')module.exports=api;else Object.assign(root,api);
})(globalThis);
