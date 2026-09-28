/* ---------- Les planches d'icônes ----------
   Le MJ dépose ses planches, des icônes rangées en lignes et en colonnes sur fond transparent,
   dans img/planches/ du dépôt. L'onglet Icônes les découpe une fois : la grille se lit toute
   seule dans la transparence, quel que soit le nombre de lignes et de colonnes, et se corrige
   à la main au besoin. Les cases sont gardées au catalogue en fractions de l'image : une
   planche remplacée par la même en plus grand garde ses découpes. Chaque icône y reçoit un
   nom et une catégorie, puis se choisit comme n'importe quel logo : « planches/x.webp#7 ».
   Rien n'est extrait en fichier : l'icône se découpe à l'affichage, dans le navigateur. */
const CATS_ICONES=[['talents','Talents'],['equipement','Équipement'],['divers','Divers']];
const estFichierPlanche=l=>/^planches\/[A-Za-z0-9_.-]+\.(png|webp)$/i.test(String(l||''));
const estIconePlanche=l=>/^planches\/[A-Za-z0-9_.-]+\.(png|webp)#[1-9]\d{0,3}$/i.test(String(l||''));
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
  im.src=imgUrl(fichier)});
 PLANCHES_IMAGES.set(fichier,pr);return pr}
// La transparence de chaque pixel, seule chose dont la découpe a besoin.
function lisAlpha(img){const W=img.naturalWidth,H=img.naturalHeight,c=document.createElement('canvas');c.width=W;c.height=H;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const d=g.getImageData(0,0,W,H).data,A=new Uint8Array(W*H);
 for(let i=0;i<W*H;i++)A[i]=d[i*4+3];return {W,H,A}}
const SEUIL_ALPHA=40;
// Des valeurs proches se regroupent ; chaque groupe rend sa moyenne.
function grappes(vals,ecart){const v=[...vals].sort((a,b)=>a-b),g=[[v[0]]];
 for(const x of v.slice(1)){const d=g[g.length-1];if(x-d[d.length-1]>ecart)g.push([x]);else d.push(x)}
 return g.map(x=>x.reduce((s,y)=>s+y,0)/x.length)}
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
 const cx=grappes(vote.map(k=>(k.x0+k.x1)/2),med*.45),cy=grappes(vote.map(k=>(k.y0+k.y1)/2),med*.45);
 return {lignes:cy.length,colonnes:cx.length,bx:bornes(cx,W),by:bornes(cy,H)}}
// Une grille imposée : lignes et colonnes égales, sur l'étendue opaque de la planche.
function grilleUniforme({W,H,A},lignes,colonnes){let x0=W,y0=H,x1=-1,y1=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(A[y*W+x]>SEUIL_ALPHA){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
 if(x1<0)return null;const pas=(a,b,n)=>Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
 return {lignes,colonnes,bx:pas(x0,x1+1,colonnes),by:pas(y0,y1+1,lignes)}}
/* Chaque case de la grille, resserrée sur les taches dont le centre y tombe : l'éclat d'une
   icône voisine qui déborde lui appartient, et reste chez elle. Un liseré de deux pixels garde
   le halo, et la case ne mord pas plus d'un huitième sur ses voisines. Une case presque vide,
   au bout d'une dernière ligne incomplète, n'est pas une icône. */
function casesDe(al,bx,by){const {W,H}=al,comps=al.taches||(al.taches=taches(al)),cases=[];
 for(let r=0;r<by.length-1;r++)for(let c=0;c<bx.length-1;c++){
  const X0=bx[c],X1=bx[c+1],Y0=by[r],Y1=by[r+1],mx=(X1-X0)/8,my=(Y1-Y0)/8;
  let x0=W,y0=H,x1=-1,y1=-1,n=0;
  const prend=(a,b,c,d,nb)=>{n+=nb;if(a<x0)x0=a;if(c>x1)x1=c;if(b<y0)y0=b;if(d>y1)y1=d};
  comps.forEach(k=>{
   /* Deux icônes qui se touchent font une seule tache, plus grande qu'une case : chaque case
      qu'elle couvre en prend sa part, à son propre cadre. */
   if(k.x1-k.x0>(X1-X0)*1.25||k.y1-k.y0>(Y1-Y0)*1.25){const a=Math.max(k.x0,X0),b=Math.max(k.y0,Y0),c=Math.min(k.x1,X1-1),d=Math.min(k.y1,Y1-1);
    if(c>a&&d>b)prend(a,b,c,d,k.c*(c-a)*(d-b)/Math.max(1,(k.x1-k.x0)*(k.y1-k.y0)));return}
   const cx=(k.x0+k.x1)/2,cy=(k.y0+k.y1)/2;if(cx<X0||cx>=X1||cy<Y0||cy>=Y1)return;prend(k.x0,k.y0,k.x1,k.y1,k.c)});
  if(x1<0||n<(X1-X0)*(Y1-Y0)*.02)continue;
  x0=Math.max(0,Math.floor(X0-mx),x0-2);y0=Math.max(0,Math.floor(Y0-my),y0-2);
  x1=Math.min(W-1,Math.ceil(X1+mx),x1+2);y1=Math.min(H-1,Math.ceil(Y1+my),y1+2);
  cases.push([x0/W,y0/H,(x1-x0+1)/W,(y1-y0+1)/H])}
 return cases}

/* ---------- Montrer une icône ---------- */
/* L'icône se découpe dans sa planche à la première demande, et l'adresse obtenue se garde :
   un rendu suivant la pose aussitôt, sans clignoter. Redécouper change la clé. */
const URLS_ICONES=new Map(),URLS_PRETES=new Map();
const cleIcone=(id,i)=>id+'|'+i.cas.join(',');
function urlIconePrete(id){const i=iconeDe(id);return i?URLS_PRETES.get(cleIcone(id,i))||'':''}
function urlIcone(id){const i=iconeDe(id);if(!i)return Promise.reject(new Error('Icône inconnue : '+id));
 const cle=cleIcone(id,i);if(URLS_ICONES.has(cle))return URLS_ICONES.get(cle);
 const pr=chargePlanche(i.planche.fichier).then(img=>new Promise((ok,ko)=>{
  const [x,y,w,h]=i.cas,W=img.naturalWidth,H=img.naturalHeight;
  const sx=Math.round(x*W),sy=Math.round(y*H),sw=Math.max(1,Math.round(w*W)),sh=Math.max(1,Math.round(h*H));
  const c=document.createElement('canvas');c.width=sw;c.height=sh;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
  try{const d=g.getImageData(0,0,sw,sh);if(nettoieBords(d))g.putImageData(d,0,0)}catch(e){}
  c.toBlob(b=>{if(!b){ko(new Error('Découpe impossible'));return}const u=URL.createObjectURL(b);URLS_PRETES.set(cle,u);ok(u)},'image/png')}));
 pr.catch(()=>URLS_ICONES.delete(cle));URLS_ICONES.set(cle,pr);return pr}
/* Le cadre d'une icône peut mordre sur sa voisine : ses éclats, petites taches collées au bord,
   s'effacent, halo compris. L'icône elle-même, de loin la plus grande tache, reste entière. */
function nettoieBords(d){const W=d.width,H=d.height,px=d.data,A=new Uint8Array(W*H);for(let i=0;i<W*H;i++)A[i]=px[i*4+3];
 const comps=taches({W,H,A});if(comps.length<2)return false;const max=Math.max(...comps.map(k=>k.c));
 const eclats=comps.filter(k=>k.c<max*.12&&(k.x0===0||k.y0===0||k.x1===W-1||k.y1===H-1));if(!eclats.length)return false;
 eclats.forEach(k=>{const x0=Math.max(0,k.x0-2),y0=Math.max(0,k.y0-2),x1=Math.min(W-1,k.x1+2),y1=Math.min(H-1,k.y1+2);
  const n=comps.indexOf(k)+1;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x;
   // L'éclat lui-même et son halo, jamais un pixel d'une autre tache.
   if(comps.lab[i]===n||(!comps.lab[i]&&A[i]<=SEUIL_ALPHA))px[i*4+3]=0}});
 return true}
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
function renderIcones(){const boite=$('icones-planches');if(!boite)return;boite.replaceChildren();
 const fichiers=[...new Set([...PLANCHES_FICHIERS,...planchesDuCatalogue().map(p=>p.fichier)])].sort((a,b)=>a.localeCompare(b,'fr'));
 if(!fichiers.length){const v=document.createElement('p');v.className='muted';
  v.textContent='Aucune planche pour l’instant. Dépose un fichier dans img/planches sur GitHub, puis reviens ici : il paraîtra en quelques minutes.';
  boite.append(v);return}
 fichiers.forEach(f=>boite.append(blocPlanche(f)))}
$('icones-recherche').oninput=renderIcones;$('icones-cat').onchange=renderIcones;
function blocPlanche(f){const p=plancheDe(f),bloc=document.createElement('section');bloc.className='planche-bloc';
 const q=cleTalent($('icones-recherche').value),cat=$('icones-cat').value;
 const tete=document.createElement('header');tete.className='planche-tete';
 const h=document.createElement('h3');h.textContent=nomPlanche(f);
 const compte=document.createElement('span');compte.className='compte';compte.textContent=p?p.cases.length+' icônes':'à découper';
 tete.append(h,compte);
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
 tete.append(outils);bloc.append(tete);
 if(!p)return bloc;
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
 else bloc.append(grille);
 return bloc}
/* Découper une planche : la grille lue dans la transparence, ou celle qu'on impose. Les noms
   et catégories déjà donnés restent attachés aux numéros. */
async function decouper(f,lignes,colonnes){let al;
 try{al=lisAlpha(await chargePlanche(f))}catch(e){alert('Impossible de lire la planche « '+nomPlanche(f)+' ».');return}
 const g=lignes&&colonnes?grilleUniforme(al,Math.max(1,Math.min(60,lignes|0)),Math.max(1,Math.min(60,colonnes|0))):detecteGrille(al);
 if(!g){alert('Aucune icône trouvée : la planche a-t-elle bien un fond transparent ?');return}
 const cases=casesDe(al,g.bx,g.by),avant=plancheDe(f);
 if(!cases.length){alert('Aucune icône trouvée dans cette grille.');return}
 if(avant&&avant.icones.some(i=>i.nom||i.cat)&&!confirm('Redécouper « '+nomPlanche(f)+' » en '+cases.length+' icônes ? Les noms et catégories restent attachés aux numéros : vérifie-les ensuite.'))return;
 const p={fichier:f,lignes:g.lignes,colonnes:g.colonnes,cases,icones:cases.map((_,i)=>avant&&avant.icones[i]?{...avant.icones[i]}:{nom:'',cat:''})};
 catalog.planches=[...planchesDuCatalogue().filter(x=>x.fichier!==f),normalisePlanches([p])[0]];sauveIcones();renderIcones()}

/* ---------- Choisir un logo à l'œil ----------
   À côté de chaque menu de logos, 🖼 ouvre ses propres options en grille, groupées comme
   lui, avec une recherche. Un clic choisit, comme si on l'avait pris dans le menu. */
const BOUTON_GRILLE='<button type="button" class="grille-logos" title="Choisir dans la grille" aria-label="Choisir le logo dans la grille">🖼</button>';
let grilleDialog=null,grilleSelect=null;
function ouvreGrilleLogos(select){grilleSelect=select;
 if(!grilleDialog){grilleDialog=dialog('grille-logos','Choisir un logo','<input id="grille-logos-recherche" placeholder="Rechercher…" aria-label="Rechercher un logo"><div id="grille-logos-corps"></div>');
  $('grille-logos-recherche').oninput=dessineGrilleLogos}
 $('grille-logos-recherche').value='';dessineGrilleLogos();grilleDialog.showModal();$('grille-logos-recherche').focus()}
function dessineGrilleLogos(){const corps=$('grille-logos-corps'),s=grilleSelect;if(!corps||!s)return;corps.replaceChildren();
 const q=cleTalent($('grille-logos-recherche').value);let montres=0;
 const tuile=o=>{const v=o.value;if(!v||(q&&!cleTalent(o.textContent).includes(q)))return null;
  const b=document.createElement('button');b.type='button';b.className='grille-logo'+(v===s.value?' on':'');b.title=o.textContent;
  const im=document.createElement('img');im.alt='';im.draggable=false;
  poseLogo(im,String(v).includes('{logo}')&&typeof remplaceElement==='function'?remplaceElement(v,ELEMENTS[0]):v);
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
