/* ---------- Les planches d'icônes ----------
   Le MJ dépose ses planches, des icônes rangées en lignes et en colonnes sur fond transparent,
   dans img/planches/ du dépôt. L'onglet Icônes les découpe une fois : la grille se lit toute
   seule dans la transparence, quel que soit le nombre de lignes et de colonnes, et se corrige
   à la main au besoin. Les cases sont gardées au catalogue en fractions de l'image : une
   planche remplacée par la même en plus grand garde ses découpes. Chaque icône y reçoit un
   nom et une catégorie, puis se choisit comme n'importe quel logo : « planches/x.webp#7 ».
   Rien n'est extrait en fichier : l'icône se découpe à l'affichage, dans le navigateur. */
const CATS_ICONES=[['talents','Talents'],['equipement','Équipement'],['divers','Divers']];
/* Le nom d'une planche : ce que GitHub accepte d'ordinaire, espaces et accents compris, sans
   dossier, ni guillemet, ni chevron, ni rien qui casserait une adresse ou une page. */
const estFichierPlanche=l=>/^planches\/[^/#?"'<>&\\]+\.(png|webp)$/i.test(String(l||''));
const estIconePlanche=l=>/^planches\/[^/#?"'<>&\\]+\.(png|webp)#[1-9]\d{0,3}$/i.test(String(l||''));
// Les planches du dépôt, d'après la liste que GitHub donne de img/ (voir chargeDossiersLogos).
const PLANCHES_FICHIERS=[];
function planchesDuCatalogue(){return typeof catalog!=='undefined'&&Array.isArray(catalog.planches)?catalog.planches:[]}
function plancheDe(fichier){return planchesDuCatalogue().find(p=>p&&p.fichier===fichier)||null}
// « planches/runes_02.webp » se lit « Runes 02 ».
function nomPlanche(f){const n=String(f||'').replace(/^planches\//,'').replace(/\.[a-z]+$/i,'').replace(/[_-]+/g,' ').trim();return n?n[0].toUpperCase()+n.slice(1):'Planche'}
function iconeDe(id){const m=/^(.*)#(\d+)$/.exec(String(id||''));if(!m)return null;const p=plancheDe(m[1]),n=+m[2];
 return p&&p.cases[n-1]?{planche:p,n,cas:p.cases[n-1],info:p.icones[n-1]||{nom:'',cat:''}}:null}
// Le nom d'une icône : celui que le MJ lui a donné, sinon sa planche et son numéro.
function nomIcone(id){const i=iconeDe(id),m=/^(.*)#(\d+)$/.exec(String(id||''));
 return i&&i.info.nom?i.info.nom:nomPlanche(m?m[1]:'')+' n°'+(m?m[2]:'?')}
// Les icônes découpées, dans l'ordre des planches ; d'une catégorie seulement si on la donne.
function iconesPlanches(cat){const out=[];
 planchesDuCatalogue().forEach(p=>p.cases.forEach((_,i)=>{if(cat===undefined||((p.icones[i]||{}).cat||'')===cat)out.push(p.fichier+'#'+(i+1))}));return out}
// Les familles de menu : une par catégorie, et celles qui attendent d'être rangées.
function famillesPlanches(){return [...CATS_ICONES.map(([k,n])=>['Icônes · '+n,iconesPlanches(k)]),['Icônes · À ranger',iconesPlanches('')]]}
/* Au chargement : une planche nommée comme il faut, des cases dans l'image, un nom court et
   une catégorie connue par icône. Rien d'autre ne passe. */
function normalisePlanches(l){if(!Array.isArray(l))return [];const vues=new Set();
 return l.filter(p=>p&&estFichierPlanche(p.fichier)&&Array.isArray(p.cases)&&!vues.has(p.fichier)&&vues.add(p.fichier)).slice(0,200).map(p=>{
  const cases=p.cases.filter(r=>Array.isArray(r)&&r.length===4&&r.every(v=>Number.isFinite(v)&&v>=0&&v<=1)).slice(0,2000).map(r=>r.map(v=>Math.round(v*1e5)/1e5));
  const icones=cases.map((_,i)=>{const x=(Array.isArray(p.icones)&&p.icones[i])||{};
   return {nom:typeof x.nom==='string'?x.nom.trim().slice(0,40):'',cat:CATS_ICONES.some(([k])=>k===x.cat)?x.cat:''}});
  const n=v=>Math.max(1,Math.min(60,Math.trunc(Number(v))||1));
  return {fichier:p.fichier,lignes:n(p.lignes),colonnes:n(p.colonnes),cases,icones}})}

/* ---------- Lire une planche ---------- */
/* L'image d'une planche, chargée une fois. Tout juste envoyée, le site peut ne pas l'avoir
   encore publiée : elle se reprend alors au dépôt lui-même, qui autorise la lecture. */
const PLANCHES_IMAGES=new Map();
function chargePlanche(fichier){if(PLANCHES_IMAGES.has(fichier))return PLANCHES_IMAGES.get(fichier);
 const pr=new Promise((ok,ko)=>{const im=new Image();im.crossOrigin='anonymous';let repli=false;
  im.onload=()=>ok(im);
  im.onerror=()=>{const depot=typeof depotPages==='function'?depotPages():'';
   if(repli||!depot){PLANCHES_IMAGES.delete(fichier);ko(new Error('Planche illisible : '+fichier));return}
   repli=true;im.src='https://raw.githubusercontent.com/'+depot+'/main/img/'+fichier.split('/').map(encodeURIComponent).join('/')};
  im.src=urlPlanche(fichier)});
 PLANCHES_IMAGES.set(fichier,pr);return pr}
// La transparence de chaque pixel, seule chose dont la découpe a besoin.
function lisAlpha(img){const W=img.naturalWidth,H=img.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const d=g.getImageData(0,0,W,H).data,A=new Uint8Array(W*H);
 for(let i=0;i<W*H;i++)A[i]=d[i*4+3];return {W,H,A}}
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
function detecteGrille(al){const comps=al.taches||(al.taches=taches(al)),{W,H}=al;
 const gros=comps.filter(k=>k.c>=30);if(!gros.length)return null;
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
 const med=gros.length?gros.map(tailleK).sort((a,b)=>a-b)[gros.length>>1]:0;
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
// La transparence d'une planche, lue une fois par image.
const PLANCHES_ALPHA=new Map();
function alphaPlanche(fichier,img){let al=PLANCHES_ALPHA.get(fichier);
 if(!al||al.img!==img){al=lisAlpha(img);al.img=img;PLANCHES_ALPHA.set(fichier,al)}return al}

/* ---------- Montrer une icône ----------
   Une planche pèse quelques mégaoctets ; une icône, quelques kilo-octets. Chaque appareil ne
   télécharge donc une planche qu'une fois : il la découpe en entier, garde ses icônes dans le
   navigateur, réduites à la taille où elles servent, et la planche quitte aussitôt la mémoire.
   Une icône se cherche dans l'ordre : déjà montrée pendant la visite ; jointe par le MJ à la
   publication, pour que les joueurs n'ouvrent jamais une planche ; gardée sur l'appareil ;
   enfin découpée dans sa planche. Une planche remplacée change de version, et ses icônes avec. */
const URLS_ICONES=new Map(),URLS_PRETES=new Map(),ICONES_PUBLIEES=new Map(),TAILLE_ICONE=128;
// La version d'une planche : l'empreinte que GitHub donne de son contenu, sinon celle du site.
const PLANCHES_SHA={};
const versionPlanche=f=>PLANCHES_SHA[f]?String(PLANCHES_SHA[f]).slice(0,12):'v'+(typeof IMG_V!=='undefined'?IMG_V:'');
const urlPlanche=f=>PLANCHES_SHA[f]?'./img/'+f.split('/').map(encodeURIComponent).join('/')+'?s='+versionPlanche(f):imgUrl(f);
// La façon de découper compte aussi : une découpe améliorée refait les icônes gardées.
const DECOUPE_V='d2',cleIcone=(id,i)=>i.planche.fichier+'|'+versionPlanche(i.planche.fichier)+'|'+DECOUPE_V+'|'+i.cas.join(',');
function urlIconePrete(id){const i=iconeDe(id);return (i&&URLS_PRETES.get(cleIcone(id,i)))||ICONES_PUBLIEES.get(id)||''}
function urlIcone(id){const i=iconeDe(id);if(!i)return Promise.reject(new Error('Icône inconnue : '+id));
 const cle=cleIcone(id,i);if(URLS_PRETES.has(cle))return Promise.resolve(URLS_PRETES.get(cle));
 if(ICONES_PUBLIEES.has(id))return Promise.resolve(ICONES_PUBLIEES.get(id));
 if(URLS_ICONES.has(cle))return URLS_ICONES.get(cle);
 const pr=(async()=>{const b=await litIconeBd(cle);
  if(b){const u=URL.createObjectURL(b);URLS_PRETES.set(cle,u);return u}
  await decoupeLaPlanche(i.planche.fichier);
  if(!URLS_PRETES.has(cle))throw new Error('Découpe impossible : '+id);return URLS_PRETES.get(cle)})();
 pr.catch(()=>URLS_ICONES.delete(cle));URLS_ICONES.set(cle,pr);return pr}
/* Les icônes gardées sur l'appareil, dans une base à part : ni la partie ni ses sauvegardes
   n'y touchent. Sans elle (navigation privée), tout marche encore, en redécoupant. */
let bdIcones=null;
function ouvreBdIcones(){if(bdIcones)return bdIcones;
 bdIcones=new Promise(ok=>{try{const r=indexedDB.open('amertume-icones',1);r.onupgradeneeded=()=>r.result.createObjectStore('icones');
  r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null);r.onblocked=()=>ok(null)}catch(e){ok(null)}});return bdIcones}
async function litIconeBd(cle){const db=await ouvreBdIcones();if(!db)return null;
 return new Promise(ok=>{try{const q=db.transaction('icones').objectStore('icones').get(cle);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null)}catch(e){ok(null)}})}
async function ecritIconesBd(paires){const db=await ouvreBdIcones();if(!db||!paires.length)return;
 await new Promise(ok=>{try{const t=db.transaction('icones','readwrite'),s=t.objectStore('icones');paires.forEach(([k,v])=>s.put(v,k));t.oncomplete=ok;t.onerror=ok;t.onabort=ok}catch(e){ok()}})}
/* Découper toute une planche d'un coup, une planche à la fois : la mémoire n'en tient jamais
   qu'une. Ses icônes rejoignent l'appareil, puis la planche est oubliée. */
let fileDecoupe=Promise.resolve();const DECOUPES=new Map();
function decoupeLaPlanche(f){if(DECOUPES.has(f))return DECOUPES.get(f);
 const pr=fileDecoupe.then(async()=>{const p=plancheDe(f);if(!p)return;
  const img=await chargePlanche(f),al=alphaPlanche(f,img),v=versionPlanche(f),paires=[];
  for(const cas of p.cases){const cle=f+'|'+v+'|'+DECOUPE_V+'|'+cas.join(',');if(URLS_PRETES.has(cle))continue;
   const b=await coupeIcone(img,al,cas);if(!b)continue;URLS_PRETES.set(cle,URL.createObjectURL(b));paires.push([cle,b])}
  await ecritIconesBd(paires)}).catch(()=>{}).finally(()=>{DECOUPES.delete(f);oubliePlanche(f)});
 fileDecoupe=pr;DECOUPES.set(f,pr);return pr}
// La planche et tout ce qu'on en avait lu quittent la mémoire ; une nouvelle découpe la relira.
function oubliePlanche(f){PLANCHES_ALPHA.delete(f);PLANCHES_IMAGES.delete(f)}
/* Une icône : son cadre, sans ce qui appartient aux voisines, réduite à 128 pixels au plus,
   assez pour rester nette sur un écran fin. */
function coupeIcone(img,al,[x,y,w,h]){const W=img.naturalWidth,H=img.naturalHeight;
 const sx=Math.round(x*W),sy=Math.round(y*H),sw=Math.max(1,Math.round(w*W)),sh=Math.max(1,Math.round(h*H));
 const c=document.createElement('canvas');c.width=sw;c.height=sh;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
 try{gardeSesPixels(g,al,sx,sy,sw,sh)}catch(e){}
 return versBlob(reduit(c,TAILLE_ICONE),.9)}
function reduit(c,max){const k=Math.min(1,max/Math.max(c.width,c.height));if(k>=1)return c;
 const r=document.createElement('canvas');r.width=Math.max(1,Math.round(c.width*k));r.height=Math.max(1,Math.round(c.height*k));
 const g=r.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,0,0,r.width,r.height);return r}
// En WebP là où le navigateur sait l'écrire, en PNG sinon.
const versBlob=(c,q)=>new Promise(ok=>{try{c.toBlob(b=>ok(b||null),'image/webp',q)}catch(e){ok(null)}});
/* Le cadre d'une icône peut mordre sur ses voisines : il ne garde que les pixels des icônes dont
   le centre y tombe, et efface le reste, halo et ombre des voisines compris. Deux icônes restées
   soudées se gardent ensemble. Un cadre où aucune icône n'a son centre reste tel quel. */
function gardeSesPixels(g,al,sx,sy,sw,sh){const {own,objets}=proprietaires(al),garde=new Set();
 objets.forEach((o,k)=>{if(o.absorbe)return;const cx=(o.x0+o.x1)/2,cy=(o.y0+o.y1)/2;
  // Son centre y tombe, ou elle remplit le cadre : deux icônes soudées, dont ce cadre est une part.
  const recouvre=Math.max(0,Math.min(o.x1+1,sx+sw)-Math.max(o.x0,sx))*Math.max(0,Math.min(o.y1+1,sy+sh)-Math.max(o.y0,sy));
  if((cx>=sx&&cx<sx+sw&&cy>=sy&&cy<sy+sh)||recouvre>=sw*sh*.35)garde.add(k+1)});
 if(!garde.size)return;
 const d=g.getImageData(0,0,sw,sh),px=d.data;let efface=false;
 for(let y=0;y<sh;y++){const ligne=(sy+y)*al.W+sx;
  for(let x=0;x<sw;x++){const o=own[ligne+x];if(o&&!garde.has(o)&&px[(y*sw+x)*4+3]){px[(y*sw+x)*4+3]=0;efface=true}}}
 if(efface)g.putImageData(d,0,0)}
// Poser une icône de planche dans une image : tout de suite si elle est prête, sinon dès qu'elle l'est.
function poseIcone(im,id){const u=urlIconePrete(id);if(u){im.src=u;return}
 im.removeAttribute('src');urlIcone(id).then(v=>{im.src=v}).catch(()=>{})}

/* ---------- L'onglet Icônes ---------- */
const iconesPage=document.createElement('main');iconesPage.id='icones-page';
iconesPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Icônes</h2></header>'
 +'<p class="muted">Dépose tes planches d’icônes, en PNG ou WebP sur fond transparent, dans le dossier <b>img/planches</b> du dépôt. '
 +'Chaque planche se découpe ici une fois, quel que soit son nombre de lignes et de colonnes. Nomme et range ses icônes : '
 +'elles paraissent ensuite dans les menus de logos des talents, des objets et des attaques.</p>'
 +'<div class="cat-filters"><input id="icones-recherche" placeholder="Rechercher une icône…" aria-label="Rechercher une icône">'
 +'<select id="icones-cat" aria-label="Catégorie"><option value="*">Toutes les catégories</option>'
 +CATS_ICONES.map(([k,n])=>'<option value="'+k+'">'+n+'</option>').join('')+'<option value="">À ranger</option></select></div>'
 +'<div id="icones-planches"></div></section>';
document.querySelector('main.layout').after(iconesPage);
function sauveIcones(){if(typeof scheduleSave==='function')scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}
/* Les planches se replient : une planche fermée ne se télécharge pas. On ouvre celle qu'on
   range ; une recherche ou un filtre ouvre d'elles-mêmes celles où quelque chose correspond,
   les noms se lisant sans rien télécharger. */
const PLANCHES_OUVERTES=new Set();
function renderIcones(){const boite=$('icones-planches');if(!boite)return;boite.replaceChildren();
 const fichiers=[...new Set([...PLANCHES_FICHIERS,...planchesDuCatalogue().map(p=>p.fichier)])].sort((a,b)=>a.localeCompare(b,'fr'));
 if(!fichiers.length){const v=document.createElement('p');v.className='muted';
  v.textContent='Aucune planche pour l’instant. Dépose un fichier dans img/planches sur GitHub, puis reviens ici : il paraîtra en quelques minutes.';
  boite.append(v);return}
 fichiers.forEach(f=>boite.append(blocPlanche(f)))}
$('icones-recherche').oninput=renderIcones;$('icones-cat').onchange=renderIcones;
// Les numéros d'une planche qui passent la recherche et le filtre.
function iconesVisibles(f){const p=plancheDe(f);if(!p)return [];const q=cleTalent($('icones-recherche').value),cat=$('icones-cat').value;
 return p.cases.map((_,k)=>k).filter(k=>(cat==='*'||(p.icones[k].cat||'')===cat)&&(!q||cleTalent(nomIcone(f+'#'+(k+1))).includes(q)))}
function blocPlanche(f){const p=plancheDe(f),bloc=document.createElement('details');bloc.className='planche-bloc';
 const filtre=!!$('icones-recherche').value.trim()||$('icones-cat').value!=='*',vues=iconesVisibles(f);
 if(filtre&&p&&!vues.length)return document.createDocumentFragment();
 bloc.open=PLANCHES_OUVERTES.has(f)||(filtre&&vues.length>0);
 bloc.ontoggle=()=>{if(!filtre){if(bloc.open)PLANCHES_OUVERTES.add(f);else PLANCHES_OUVERTES.delete(f)}if(bloc.open&&!bloc.dataset.rempli)remplitPlanche(bloc,f)};
 const tete=document.createElement('summary');tete.className='planche-tete';
 const h=document.createElement('h3');h.textContent=nomPlanche(f);
 const compte=document.createElement('span');compte.className='compte';
 compte.textContent=!p?'à découper':filtre?vues.length+' / '+p.cases.length+' icônes':p.cases.length+' icônes';
 const ranges=p?p.icones.filter(i=>i.cat).length:0,noms=p?p.icones.filter(i=>i.nom).length:0;
 const etat=document.createElement('span');etat.className='planche-etat muted';if(p)etat.textContent=noms+' nommées · '+ranges+' rangées';
 tete.append(h,compte,etat);bloc.append(tete);
 if(bloc.open)remplitPlanche(bloc,f);
 return bloc}
// Le contenu d'une planche ouverte : ses outils, puis ses icônes.
function remplitPlanche(bloc,f){bloc.dataset.rempli='1';const p=plancheDe(f);
 const q=cleTalent($('icones-recherche').value),cat=$('icones-cat').value;
 const outils=document.createElement('div');outils.className='planche-outils';
 const bouton=(txt,titre,fn,cls)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.title=titre;if(cls)b.className=cls;b.onclick=fn;return b};
 if(!p)outils.append(bouton('✂ Découper','Lire la grille de la planche et la découper',()=>decouper(f),'primary'));
 else{
  // La grille se corrige à la main : lignes × colonnes, sur toute la planche.
  const nb=(v,lab)=>{const i=document.createElement('input');i.type='number';i.min=1;i.max=60;i.value=v;i.setAttribute('aria-label',lab);i.className='planche-nb';return i};
  const li=nb(p.lignes,'Lignes'),co=nb(p.colonnes,'Colonnes'),x=document.createElement('span');x.textContent='×';
  const ranger=document.createElement('select');ranger.setAttribute('aria-label','Tout ranger dans une catégorie');
  ranger.innerHTML='<option value="-">Tout ranger dans…</option>'+CATS_ICONES.map(([k,n])=>'<option value="'+k+'">'+n+'</option>').join('')+'<option value="">À ranger</option>';
  ranger.onchange=()=>{if(ranger.value==='-')return;p.icones.forEach(i=>{i.cat=ranger.value});sauveIcones();renderIcones()};
  outils.append(bouton('✂ Relire la grille','Détecter à nouveau lignes et colonnes',()=>decouper(f)),li,x,co,
   bouton('Découper ainsi','Découper en lignes × colonnes égales',()=>decouper(f,+li.value,+co.value)),ranger,
   bouton('✕','Oublier la découpe de cette planche',()=>{if(!confirm('Oublier la découpe de « '+nomPlanche(f)+' » ? Les logos qui en viennent ne s’afficheront plus.'))return;
    catalog.planches=planchesDuCatalogue().filter(x=>x.fichier!==f);sauveIcones();renderIcones()},'danger'))}
 bloc.append(outils);
 if(!p)return;
 const grille=document.createElement('div');grille.className='icones-grille';
 p.cases.forEach((_,k)=>{const id=f+'#'+(k+1),info=p.icones[k];
  if(cat!=='*'&&(info.cat||'')!==cat)return;
  if(q&&!cleTalent(nomIcone(id)).includes(q))return;
  const carte=document.createElement('div');carte.className='icone-carte c-'+(info.cat||'aucune');
  const cas=document.createElement('span');cas.className='icone-case';const im=document.createElement('img');im.alt='';im.draggable=false;poseIcone(im,id);cas.append(im);
  const num=document.createElement('span');num.className='icone-num';num.textContent='n°'+(k+1);cas.append(num);
  const nom=document.createElement('input');nom.className='icone-nom';nom.value=info.nom;nom.maxLength=40;nom.placeholder=nomPlanche(f)+' n°'+(k+1);
  nom.setAttribute('aria-label','Nom de l’icône n°'+(k+1));nom.onchange=()=>{info.nom=nom.value.trim().slice(0,40);sauveIcones()};
  const sel=document.createElement('select');sel.className='icone-cat';sel.setAttribute('aria-label','Catégorie de l’icône n°'+(k+1));
  sel.innerHTML='<option value="">À ranger</option>'+CATS_ICONES.map(([c,n])=>'<option value="'+c+'"'+(c===info.cat?' selected':'')+'>'+n+'</option>').join('');
  sel.onchange=()=>{info.cat=sel.value;carte.className='icone-carte c-'+(info.cat||'aucune');sauveIcones();if(cat!=='*')renderIcones()};
  carte.append(cas,nom,sel);grille.append(carte)});
 if(!grille.childElementCount){const v=document.createElement('p');v.className='muted';v.textContent='Aucune icône de cette planche ne correspond.';bloc.append(v)}
 else bloc.append(grille)}
/* Découper une planche : la grille lue dans la transparence, ou celle qu'on impose. Les noms
   et catégories déjà donnés restent attachés aux numéros. */
async function decouper(f,lignes,colonnes){let al;
 try{al=alphaPlanche(f,await chargePlanche(f))}catch(e){alert('Impossible de lire la planche « '+nomPlanche(f)+' ».');return}
 const g=lignes&&colonnes?grilleUniforme(al,Math.max(1,Math.min(60,lignes|0)),Math.max(1,Math.min(60,colonnes|0))):detecteGrille(al);
 if(!g){alert('Aucune icône trouvée : la planche a-t-elle bien un fond transparent ?');return}
 const cases=casesDe(al,g.bx,g.by),avant=plancheDe(f);
 if(!cases.length){alert('Aucune icône trouvée dans cette grille.');return}
 if(avant&&avant.icones.some(i=>i.nom||i.cat)&&!confirm('Redécouper « '+nomPlanche(f)+' » en '+cases.length+' icônes ? Les noms et catégories restent attachés aux numéros : vérifie-les ensuite.'))return;
 const p={fichier:f,lignes:g.lignes,colonnes:g.colonnes,cases,icones:cases.map((_,i)=>avant&&avant.icones[i]?{...avant.icones[i]}:{nom:'',cat:''})};
 catalog.planches=[...planchesDuCatalogue().filter(x=>x.fichier!==f),normalisePlanches([p])[0]];PLANCHES_OUVERTES.add(f);sauveIcones();renderIcones();
 // Toutes ses icônes rejoignent l'appareil dans la foulée, et la planche quitte la mémoire.
 decoupeLaPlanche(f)}

/* ---------- Les icônes voyagent avec la publication ----------
   Quand le MJ publie, son navigateur, qui a déjà découpé les icônes, joint au contenu celles
   que ce contenu emploie vraiment, talents, objets, attaques ou autre, en 96 pixels. Un
   joueur n'ouvre ainsi jamais une planche : il ne reçoit que ce qu'il peut voir. */
const TAILLE_PUBLIEE=96;
async function iconesAPublier(value){const ids=[...new Set(JSON.stringify(value).match(/planches\/[^"#\\]+#\d+/g)||[])].filter(id=>estIconePlanche(id)&&iconeDe(id));
 const out={};
 for(const id of ids){try{const u=await urlIcone(id);out[id]=u.startsWith('data:')?u:await enDonnees(u)}catch(e){}}
 return out}
// Une icône en texte, réduite pour la publication.
async function enDonnees(u){const im=new Image();im.src=u;await im.decode();
 const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
 const r=reduit(c,TAILLE_PUBLIEE);let d=r.toDataURL('image/webp',.85);if(!d.startsWith('data:image/webp'))d=r.toDataURL('image/png');return d}
// Chez qui reçoit : les icônes jointes se posent sans rien télécharger.
function recoitIcones(icones){ICONES_PUBLIEES.clear();if(!icones||typeof icones!=='object')return;
 Object.entries(icones).forEach(([id,d])=>{if(estIconePlanche(id)&&typeof d==='string'&&/^data:image\/(webp|png);base64,[A-Za-z0-9+/=]+$/.test(d))ICONES_PUBLIEES.set(id,d)})}

/* ---------- Choisir un logo à l'œil ----------
   À côté de chaque menu de logos, 🖼 ouvre ses propres options en grille, groupées comme
   lui, avec une recherche. Un clic choisit, comme si on l'avait pris dans le menu. */
const BOUTON_GRILLE='<button type="button" class="grille-logos" title="Choisir dans la grille" aria-label="Choisir le logo dans la grille">🖼</button>';
let grilleDialog=null,grilleSelect=null;
const vueGrille=typeof IntersectionObserver==='function'
 ?new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;vueGrille.unobserve(e.target);poseLogo(e.target,e.target.dataset.logo)}),{rootMargin:'200px'})
 :{observe:im=>poseLogo(im,im.dataset.logo),unobserve(){}};
function ouvreGrilleLogos(select){grilleSelect=select;
 if(!grilleDialog){grilleDialog=dialog('grille-logos','Choisir un logo','<input id="grille-logos-recherche" placeholder="Rechercher…" aria-label="Rechercher un logo"><div id="grille-logos-corps"></div>');
  $('grille-logos-recherche').oninput=dessineGrilleLogos}
 $('grille-logos-recherche').value='';dessineGrilleLogos();grilleDialog.showModal();$('grille-logos-recherche').focus()}
function dessineGrilleLogos(){const corps=$('grille-logos-corps'),s=grilleSelect;if(!corps||!s)return;corps.replaceChildren();
 const q=cleTalent($('grille-logos-recherche').value);let montres=0;
 const tuile=o=>{const v=o.value;if(!v||(q&&!cleTalent(o.textContent).includes(q)))return null;
  const b=document.createElement('button');b.type='button';b.className='grille-logo'+(v===s.value?' on':'');b.title=o.textContent;
  const im=document.createElement('img');im.alt='';im.draggable=false;
  // L'image se pose quand la tuile paraît : les planches qu'on ne fait pas défiler ne se téléchargent pas.
  im.dataset.logo=String(v).includes('{logo}')&&typeof remplaceElement==='function'?remplaceElement(v,ELEMENTS[0]):v;vueGrille.observe(im);
  const n=document.createElement('span');n.textContent=o.textContent;b.append(im,n);
  b.onclick=()=>{s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));grilleDialog.close()};montres++;return b};
 const groupe=(titre,options)=>{const t=options.map(tuile).filter(Boolean);if(!t.length)return;
  if(titre){const h=document.createElement('h3');h.className='grille-logos-titre';h.textContent=titre;corps.append(h)}
  const g=document.createElement('div');g.className='grille-logos-liste';g.append(...t);corps.append(g)};
 groupe('',[...s.children].filter(x=>x.tagName==='OPTION'));
 [...s.querySelectorAll('optgroup')].forEach(g=>groupe(g.label,[...g.children]));
 if(!montres){const v=document.createElement('p');v.className='muted';v.textContent='Aucun logo de ce nom.';corps.append(v)}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.grille-logos');if(!b)return;
 e.preventDefault();const s=b.parentNode.querySelector('select');if(s)ouvreGrilleLogos(s)});
