/* ---------- Le calcul des planches ----------
   Ce qui lit une planche sans rien afficher : ses taches, sa grille, qui possède chaque pixel,
   ses cases, et le masque qui efface d'une icône ce qui appartient à ses voisines. Aucun appel
   à la page ici : le même fichier sert à la page (planches.js) et au fil de calcul à part
   (planches-worker.js), qui découpe sans figer l'interface. */
const SEUIL_ALPHA=40;
// Des valeurs proches se regroupent ; chaque groupe rend sa moyenne, son effectif et son étendue.
function grappes(vals,ecart){const v=[...vals].sort((a,b)=>a-b),g=[[v[0]]];
 for(const x of v.slice(1)){const d=g[g.length-1];if(x-d[d.length-1]>ecart)g.push([x]);else d.push(x)}
 return g.map(x=>({m:x.reduce((s,y)=>s+y,0)/x.length,n:x.length,e:x[x.length-1]-x[0]}))}
/* Relire un axe rang par rang : chaque icône rejoint sa ligne (ou sa colonne) de l'autre axe ;
   dans celles qui sont complètes, la première icône est au premier rang, la deuxième au
   deuxième, et ainsi de suite. Les rangs se lisent alors sans que les centres se touchent. */
function parRang(vote,groupes,le,lautre){const rangs=groupes.map(()=>[]);
 vote.forEach(k=>{let i=0,d=Infinity;groupes.forEach((g,j)=>{const e=Math.abs(le(k)-g.m);if(e<d){d=e;i=j}});rangs[i].push(lautre(k))});
 const n=new Map();rangs.forEach(r=>n.set(r.length,(n.get(r.length)||0)+1));
 const mode=[...n.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0][0];
 const pleines=rangs.filter(r=>r.length===mode).map(r=>r.sort((a,b)=>a-b));
 return Array.from({length:mode},(_,i)=>{const v=pleines.map(r=>r[i]);return {m:v.reduce((s,x)=>s+x,0)/v.length,n:v.length,e:Math.max(...v)-Math.min(...v)}})}
// Les bornes entre des centres : à mi-chemin, et les bords de l'image aux deux bouts.
function bornes(centres,max){const b=[0];for(let i=1;i<centres.length;i++)b.push((centres[i-1]+centres[i])/2);b.push(max);return b}
// Les taches opaques d'une planche : chacune son cadre et son nombre de pixels ; « lab » dit à quelle tache (1, 2…) appartient chaque pixel.
function taches({W,H,A}){const lab=new Int32Array(W*H),comps=[],pile=[];
 for(let s=0;s<W*H;s++){if(A[s]<=SEUIL_ALPHA||lab[s])continue;
  const n=comps.length+1;lab[s]=n;pile.push(s);let x0=W,y0=H,x1=-1,y1=-1,c=0;
  while(pile.length){const p=pile.pop(),x=p%W,y=(p-x)/W;c++;
   if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
   if(x>0&&!lab[p-1]&&A[p-1]>SEUIL_ALPHA){lab[p-1]=n;pile.push(p-1)}
   if(x<W-1&&!lab[p+1]&&A[p+1]>SEUIL_ALPHA){lab[p+1]=n;pile.push(p+1)}
   if(y>0&&!lab[p-W]&&A[p-W]>SEUIL_ALPHA){lab[p-W]=n;pile.push(p-W)}
   if(y<H-1&&!lab[p+W]&&A[p+W]>SEUIL_ALPHA){lab[p+W]=n;pile.push(p+W)}}
  comps.push({x0,y0,x1,y1,c})}
 comps.lab=lab;return comps}
/* La grille, lue dans la transparence. Chaque tache opaque est une icône, ou un morceau
   d'icône ; celles qui ont la taille courante donnent leurs centres, qui se rangent en
   colonnes et en lignes. Deux icônes qui se touchent font une tache trop grande : elle ne
   vote pas. Une étincelle détachée, trop petite, non plus. */
/* Les taches votent une fois séparées : des icônes aux contours soudés, rongées puis
   rendues à elles-mêmes, votent chacune pour sa ligne et sa colonne. */
function detecteGrille(al){const {W,H}=al,comps=proprietaires(al).objets.filter(o=>!o.absorbe);
 const gros=comps.filter(k=>k.c>=15);if(!gros.length)return null;
 const taille=k=>Math.max(k.x1-k.x0,k.y1-k.y0),tailles=gros.map(taille).sort((a,b)=>a-b),med=tailles[tailles.length>>1];
 const vote=gros.filter(k=>taille(k)>=med*.5&&taille(k)<=med*1.25);
 const cxk=k=>(k.x0+k.x1)/2,cyk=k=>(k.y0+k.y1)/2;
 let gx=grappes(vote.map(cxk),med*.45),gy=grappes(vote.map(cyk),med*.45);
 /* Des icônes de largeurs inégales décalent leurs centres : deux colonnes voisines peuvent se
    fondre en une grappe trop étendue. Cet axe se relit alors rang par rang, d'après l'autre. */
 const etalee=g=>g.some(x=>x.e>med*.9);
 if(etalee(gx)&&!etalee(gy))gx=parRang(vote,gy,cyk,cxk);
 else if(etalee(gy)&&!etalee(gx))gy=parRang(vote,gx,cxk,cyk);
 const cx=gx.map(x=>x.m),cy=gy.map(x=>x.m);
 return {lignes:cy.length,colonnes:cx.length,bx:bornes(cx,W),by:bornes(cy,H)}}
// Une grille imposée : lignes et colonnes égales, sur l'étendue opaque de la planche.
function grilleUniforme({W,H,A},lignes,colonnes){let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A[y*W+x]>SEUIL_ALPHA){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 if(x1<0)return null;const pas=(a,b,n)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
 return {lignes,colonnes,bx:pas(x0,x1+1,colonnes),by:pas(y0,y1+1,lignes)}}
/* Qui possède chaque pixel de la planche. Les taches se lisent au seuil ordinaire ; une tache
   trop grande, deux icônes qui se touchent, se relit à des seuils plus hauts jusqu'à se séparer
   en morceaux de la taille courante. Puis chaque pixel, halo, ombre et éclats compris, revient
   de proche en proche à l'icône la plus proche. Une icône découpée ne montrera que ses pixels :
   le bord d'une voisine qui déborde dans son cadre s'efface. */
function proprietaires(al){if(al.proprio)return al.proprio;
 const {W,H,A}=al,base=al.taches||(al.taches=taches(al)),lab=base.lab,N=W*H;
 const tailleK=k=>Math.max(k.x1-k.x0,k.y1-k.y0),gros=base.filter(k=>k.c>=30);
 /* La taille courante d'une icône : la médiane des taches, sans les éclats détachés vingt fois plus
    petits que la plus grande — les étincelles d'une explosion ne disent pas la taille des icônes. */
 const grosMax=gros.reduce((m,k)=>Math.max(m,k.c),0),votants=gros.filter(k=>k.c>=grosMax*.05);
 const med=votants.length?votants.map(tailleK).sort((a,b)=>a-b)[votants.length>>1]:0;
 const own=new Int32Array(N),objets=[],idDe=new Int32Array(base.length+1);
 const nouvel=(k,trop)=>{objets.push({x0:k.x0,y0:k.y0,x1:k.x1,y1:k.y1,c:k.c,gros:!!trop,hx0:W,hy0:H,hx1:-1,hy1:-1});return objets.length};
 const morceaux=[];
 base.forEach((k,i)=>{const n=i+1;if(k.c<30)return;
  if(tailleK(k)>med*1.25){const sep=separe(al,k,n,med,lab);
   if(sep){sep.forEach(m=>{morceaux.push([nouvel(m),m.pixels])});idDe[n]=-1;return}}
  // Qui ne se sépare pas reste d'un tenant : la grille dira si c'est une icône large ou deux soudées.
  idDe[n]=nouvel(k,tailleK(k)>med*1.25)});
 /* Une petite tache qui touche presque une grande icône en fait partie : le bout d'un canon
    qui dépasse, l'étincelle d'une flamme. Isolée, elle reste une icône, ou la partie d'une
    icône en plusieurs morceaux, que sa case réunira. */
 const cible=objets.map((_,i)=>i+1),grande=o=>tailleK(o)>=med*.5;
 objets.forEach((o,i)=>{if(o.gros||grande(o))return;let best=0,d=med*.3;
  objets.forEach((g,j)=>{if(j===i||g.gros||!grande(g))return;
   const e=Math.hypot(Math.max(0,g.x0-o.x1,o.x0-g.x1),Math.max(0,g.y0-o.y1,o.y0-g.y1));if(e<d){d=e;best=j+1}});
  if(best){cible[i]=best;o.absorbe=best;const g=objets[best-1];
   g.x0=Math.min(g.x0,o.x0);g.y0=Math.min(g.y0,o.y0);g.x1=Math.max(g.x1,o.x1);g.y1=Math.max(g.y1,o.y1);g.c+=o.c}});
 morceaux.forEach(([id,px])=>px.forEach(p=>{own[p]=cible[id-1]}));
 for(let p=0;p<N;p++){const n=lab[p];if(n&&idDe[n]>0)own[p]=cible[idDe[n]-1]}
 // De proche en proche : chaque pixel encore sans maître prend celui du voisin atteint le premier.
 const file=new Int32Array(N);let debut=0,fin=0;for(let p=0;p<N;p++)if(own[p])file[fin++]=p;
 while(debut<fin){const p=file[debut++],o=own[p],x=p%W;
  if(x>0&&!own[p-1]){own[p-1]=o;file[fin++]=p-1}
  if(x<W-1&&!own[p+1]){own[p+1]=o;file[fin++]=p+1}
  if(p>=W&&!own[p-W]){own[p-W]=o;file[fin++]=p-W}
  if(p+W<N&&!own[p+W]){own[p+W]=o;file[fin++]=p+W}}
 // Le halo de chaque icône : tout ce qu'elle possède d'à peine visible autour d'elle.
 for(let p=0;p<N;p++){const o=own[p];if(!o||A[p]<=8)continue;const b=objets[o-1],x=p%W,y=(p-x)/W;
  if(x<b.hx0)b.hx0=x;if(x>b.hx1)b.hx1=x;if(y<b.hy0)b.hy0=y;if(y>b.hy1)b.hy1=y}
 return al.proprio={own,objets,med}}
// Une tache trop grande, relue à des seuils plus hauts : ses morceaux, s'ils ont tous la taille courante.
function separe({W,A},k,n,med,lab){for(const seuil of [80,128,176,224]){const vu=new Set(),morceaux=[];
  for(let y=k.y0;y<=k.y1;y++)for(let x=k.x0;x<=k.x1;x++){const s=y*W+x;if(lab[s]!==n||A[s]<=seuil||vu.has(s))continue;
   const m={x0:x,y0:y,x1:x,y1:y,c:0,pixels:[]},pile=[s];vu.add(s);
   while(pile.length){const p=pile.pop(),px=p%W,py=(p-px)/W;m.c++;m.pixels.push(p);
    if(px<m.x0)m.x0=px;if(px>m.x1)m.x1=px;if(py<m.y0)m.y0=py;if(py>m.y1)m.y1=py;
    for(const q of [px>k.x0?p-1:-1,px<k.x1?p+1:-1,py>k.y0?p-W:-1,py<k.y1?p+W:-1])
     if(q>=0&&lab[q]===n&&A[q]>seuil&&!vu.has(q)){vu.add(q);pile.push(q)}}
   morceaux.push(m)}
  const vrais=morceaux.filter(m=>m.c>=30);
  if(vrais.length>=2&&vrais.every(m=>Math.max(m.x1-m.x0,m.y1-m.y0)<=med*1.25))return vrais}
 return erode({W},k,n,med,lab)}
/* Des icônes dont les contours opaques se touchent ne se séparent pas par la transparence : on
   ronge alors la tache depuis ses bords, de plus en plus, jusqu'à ce que les ponts fins entre
   icônes cèdent. Chaque cœur restant est une icône ; ce qu'on a rongé lui revient ensuite, de
   proche en proche. */
function erode({W},k,n,med,lab){const w=k.x1-k.x0+1,h=k.y1-k.y0+1,D=new Uint16Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)D[y*w+x]=lab[(k.y0+y)*W+k.x0+x]===n?60000:0;
 // La distance au bord le plus proche, en deux passes, diagonales comprises.
 const v=(x,y)=>x<0||y<0||x>=w||y>=h?0:D[y*w+x];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(D[i])D[i]=Math.min(D[i],v(x-1,y)+1,v(x,y-1)+1,v(x-1,y-1)+1,v(x+1,y-1)+1)}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(D[i])D[i]=Math.min(D[i],v(x+1,y)+1,v(x,y+1)+1,v(x+1,y+1)+1,v(x-1,y+1)+1)}
 for(const r of [2,3,4,6,8,11,15]){const vu=new Uint8Array(w*h),morceaux=[];
  for(let s=0;s<w*h;s++){if(D[s]<=r||vu[s])continue;
   const m={x0:w,y0:h,x1:-1,y1:-1,c:0,pixels:[]},pile=[s];vu[s]=1;
   while(pile.length){const p=pile.pop(),x=p%w,y=(p-x)/w;m.c++;m.pixels.push((k.y0+y)*W+k.x0+x);
    if(x<m.x0)m.x0=x;if(x>m.x1)m.x1=x;if(y<m.y0)m.y0=y;if(y>m.y1)m.y1=y;
    for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!vu[q]&&D[q]>r){vu[q]=1;pile.push(q)}}
   morceaux.push(m)}
  const vrais=morceaux.filter(m=>m.c>=15);
  if(vrais.length>=2&&vrais.every(m=>Math.max(m.x1-m.x0,m.y1-m.y0)+2*r<=med*1.25))
   // Le cadre d'un cœur, rendu à la taille de son icône et replacé sur la planche.
   return vrais.map(m=>({...m,x0:k.x0+Math.max(0,m.x0-r),y0:k.y0+Math.max(0,m.y0-r),x1:k.x0+Math.min(w-1,m.x1+r),y1:k.y0+Math.min(h-1,m.y1+r)}))}
 return null}
/* Chaque case de la grille, resserrée sur les icônes dont le centre y tombe, halo compris ; elle
   ne mord pas plus d'un huitième sur ses voisines. Deux icônes restées soudées, faute de se
   séparer, se partagent à la frontière des cases. Une case presque vide, au bout d'une dernière
   ligne incomplète, n'est pas une icône. */
function casesDe(al,bx,by){const {W,H}=al,{objets,med}=proprietaires(al),cases=[],m=Math.max(4,med*.08);
 for(let r=0;r<by.length-1;r++)for(let c=0;c<bx.length-1;c++){
  const X0=bx[c],X1=bx[c+1],Y0=by[r],Y1=by[r+1];
  let x0=W,y0=H,x1=-1,y1=-1,n=0;
  const prend=(a,b,c,d,nb)=>{n+=nb;if(a<x0)x0=a;if(c>x1)x1=c;if(b<y0)y0=b;if(d>y1)y1=d};
  objets.forEach(o=>{if(o.absorbe)return;
   /* Plus large ou plus haute que sa case : deux icônes restées soudées, que chaque case
      couverte partage. Une icône large, un canon, tient dans sa case et compte entière. */
   if(o.x1-o.x0>(X1-X0)*1.3||o.y1-o.y0>(Y1-Y0)*1.3){const a=Math.max(o.x0,X0),b=Math.max(o.y0,Y0),c=Math.min(o.x1,X1-1),d=Math.min(o.y1,Y1-1);
    if(c>a&&d>b)prend(a,b,c,d,o.c*(c-a)*(d-b)/Math.max(1,(o.x1-o.x0)*(o.y1-o.y0)));return}
   const cx=(o.x0+o.x1)/2,cy=(o.y0+o.y1)/2;if(cx<X0||cx>=X1||cy<Y0||cy>=Y1)return;
   /* L'icône entière, même si elle déborde de sa case, sur une planche aux lignes inégales :
      ses voisines s'effaceront à l'affichage. Son halo compte sur quelques pixels ; un éclat
      détaché plus loin reste dehors, il est trop souvent celui d'une voisine. */
   prend(Math.min(o.x0,Math.max(o.hx0,o.x0-m)),Math.min(o.y0,Math.max(o.hy0,o.y0-m)),
    Math.max(o.x1,Math.min(o.hx1,o.x1+m)),Math.max(o.y1,Math.min(o.hy1,o.y1+m)),o.c)});
  if(x1<0||n<(X1-X0)*(Y1-Y0)*.02)continue;
  x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(W-1,Math.ceil(x1));y1=Math.min(H-1,Math.ceil(y1));
  cases.push([x0/W,y0/H,(x1-x0+1)/W,(y1-y0+1)/H])}
 return cases}
/* Le cadre d'une icône peut mordre sur ses voisines : il ne garde que les pixels des icônes dont
   le centre y tombe, et efface le reste, halo et ombre des voisines compris. Deux icônes restées
   soudées se gardent ensemble. Un cadre où aucune icône n'a son centre reste tel quel. Rend vrai
   si des pixels ont été effacés. */
function masque(px,al,sx,sy,sw,sh){const {own,objets}=proprietaires(al),garde=new Set();
 objets.forEach((o,k)=>{if(o.absorbe)return;const cx=(o.x0+o.x1)/2,cy=(o.y0+o.y1)/2;
  // Son centre y tombe, ou elle remplit le cadre : deux icônes soudées, dont ce cadre est une part.
  const recouvre=Math.max(0,Math.min(o.x1+1,sx+sw)-Math.max(o.x0,sx))*Math.max(0,Math.min(o.y1+1,sy+sh)-Math.max(o.y0,sy));
  if((cx>=sx&&cx<sx+sw&&cy>=sy&&cy<sy+sh)||recouvre>=sw*sh*.35)garde.add(k+1)});
 if(!garde.size)return false;
 let efface=false;
 for(let y=0;y<sh;y++){const ligne=(sy+y)*al.W+sx;
  for(let x=0;x<sw;x++){const o=own[ligne+x];if(o&&!garde.has(o)&&px[(y*sw+x)*4+3]){px[(y*sw+x)*4+3]=0;efface=true}}}
 return efface}
