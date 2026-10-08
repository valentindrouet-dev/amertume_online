/* ---------- Les planches d'icônes ----------
   Le MJ dépose ses planches, des icônes rangées en lignes et en colonnes sur fond transparent,
   dans img/planches/ du dépôt. L'onglet Icônes les découpe une fois : la grille se lit toute
   seule dans la transparence, quel que soit le nombre de lignes et de colonnes, et se corrige
   à la main au besoin. Les cases sont gardées au catalogue en fractions de l'image : une
   planche remplacée par la même en plus grand garde ses découpes. Chaque icône y reçoit un
   nom et une catégorie, puis se choisit comme n'importe quel logo : « planches/x.webp#7 ».
   Rien n'est extrait en fichier : l'icône se découpe à l'affichage, dans le navigateur. */
const CATS_ICONES=[['talents','Talents'],['equipement','Équipement'],['divers','Divers'],['ombrelame','Ombrelame']];
/* Le nom d'une planche : ce que GitHub accepte d'ordinaire, espaces et accents compris, sans
   dossier, ni guillemet, ni chevron, ni rien qui casserait une adresse ou une page. */
const estFichierPlanche=l=>/^planches\/[^/#?"'<>&\\]+\.(png|webp)$/i.test(String(l||''));
const estIconePlanche=l=>/^planches\/[^/#?"'<>&\\]+\.(png|webp)#[1-9]\d{0,3}$/i.test(String(l||''));
// Les planches du dépôt, d'après la liste que GitHub donne de img/ (voir chargeDossiersLogos).
const PLANCHES_FICHIERS=[];
function planchesDuCatalogue(){return typeof catalog!=='undefined'&&Array.isArray(catalog.planches)?catalog.planches:[]}
function plancheDe(fichier){return planchesDuCatalogue().find(p=>p&&p.fichier===fichier)||null}
/* Le nom d'une planche : celui que le MJ lui a donné dans l'onglet Icônes, sinon celui de son
   fichier, « planches/runes_02.webp » se lisant « Runes 02 ». Le fichier ne change pas : le
   site ne peut pas renommer ce qui est sur GitHub, et les logos déjà choisis restent valides. */
function nomPlanche(f){const donne=typeof catalog!=='undefined'&&catalog.nomsPlanches&&catalog.nomsPlanches[f];if(donne)return donne;
 const n=String(f||'').replace(/^planches\//,'').replace(/\.[a-z]+$/i,'').replace(/[_-]+/g,' ').trim();return n?n[0].toUpperCase()+n.slice(1):'Planche'}
function normaliseNomsPlanches(o){const out={};if(!o||typeof o!=='object'||Array.isArray(o))return out;
 Object.entries(o).slice(0,500).forEach(([f,n])=>{if(estFichierPlanche(f)&&typeof n==='string'&&n.trim())out[f]=n.trim().slice(0,40)});return out}
function renommePlanche(f){const n=prompt('Nom de la planche « '+nomPlanche(f)+' » :',nomPlanche(f));if(n===null)return;
 catalog.nomsPlanches={...(catalog.nomsPlanches||{})};if(n.trim())catalog.nomsPlanches[f]=n.trim().slice(0,40);else delete catalog.nomsPlanches[f];
 sauveIcones();renderIcones()}
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
// La transparence d'une planche, lue une fois par image.
const PLANCHES_ALPHA=new Map();
function alphaPlanche(fichier,img){let al=PLANCHES_ALPHA.get(fichier);
 if(!al||al.img!==img){al=lisAlpha(img);al.img=img;PLANCHES_ALPHA.set(fichier,al)}return al}

/* ---------- Montrer une icône ----------
   Une planche pèse un mégaoctet ; une icône, quelques kilo-octets. Une icône se cherche dans
   l'ordre : déjà montrée pendant la visite ; jointe par le MJ à la publication, pour que les
   joueurs n'ouvrent jamais une planche ; gardée sur l'appareil ; enfin découpée dans sa planche.
   La découpe se fait à l'écart, dans un fil de calcul à part (planches-worker.js), et seulement
   pour les icônes demandées, regroupées par planche : l'interface ne se fige plus, et une page
   ne réveille que les planches dont elle montre une icône. Une planche remplacée change de
   version, et ses icônes avec. */
const URLS_ICONES=new Map(),URLS_PRETES=new Map(),ICONES_PUBLIEES=new Map(),TAILLE_ICONE=128;
// La version d'une planche : l'empreinte que GitHub donne de son contenu, sinon celle du site.
const PLANCHES_SHA={};
const versionPlanche=f=>PLANCHES_SHA[f]?String(PLANCHES_SHA[f]).slice(0,12):'v'+(typeof IMG_V!=='undefined'?IMG_V:'');
const urlPlanche=f=>PLANCHES_SHA[f]?'./img/'+f.split('/').map(encodeURIComponent).join('/')+'?s='+versionPlanche(f):imgUrl(f);
// La façon de découper compte aussi : une découpe améliorée refait les icônes gardées.
const DECOUPE_V='d3',cleCase=(f,cas)=>f+'|'+versionPlanche(f)+'|'+DECOUPE_V+'|'+cas.join(','),cleIcone=(id,i)=>cleCase(i.planche.fichier,i.cas);
function urlIconePrete(id){const i=iconeDe(id);return (i&&URLS_PRETES.get(cleIcone(id,i)))||ICONES_PUBLIEES.get(id)||''}
function urlIcone(id){const i=iconeDe(id);if(!i)return Promise.reject(new Error('Icône inconnue : '+id));
 const cle=cleIcone(id,i);if(URLS_PRETES.has(cle))return Promise.resolve(URLS_PRETES.get(cle));
 if(ICONES_PUBLIEES.has(id))return Promise.resolve(ICONES_PUBLIEES.get(id));
 if(URLS_ICONES.has(cle))return URLS_ICONES.get(cle);
 const pr=(async()=>{const b=await litIconeBd(cle);
  if(b instanceof Blob){const u=URL.createObjectURL(b);URLS_PRETES.set(cle,u);return u}
  return demandeDecoupe(i.planche.fichier,i.cas,cle)})();
 pr.catch(()=>URLS_ICONES.delete(cle));URLS_ICONES.set(cle,pr);return pr}
/* Les icônes gardées sur l'appareil, dans une base à part : ni la partie ni ses sauvegardes
   n'y touchent. Sans elle (navigation privée), tout marche encore, en redécoupant. Les lectures
   d'un même instant partent ensemble, en une transaction ; les écritures aussi, par salves. */
let bdIcones=null;
function ouvreBdIcones(){if(bdIcones)return bdIcones;
 bdIcones=new Promise(ok=>{try{const r=indexedDB.open('amertume-icones',1);r.onupgradeneeded=()=>r.result.createObjectStore('icones');
  r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null);r.onblocked=()=>ok(null)}catch(e){ok(null)}});return bdIcones}
let lectures=null,ecritures=null;
function litIconeBd(cle){return new Promise(ok=>{if(!lectures){lectures=new Map();setTimeout(videLectures,0)}
 (lectures.get(cle)||lectures.set(cle,[]).get(cle)).push(ok)})}
async function videLectures(){const lot=lectures;lectures=null;const db=await ouvreBdIcones(),rend=(fs,v)=>fs.forEach(f=>f(v));
 if(!db){lot.forEach(fs=>rend(fs,null));return}
 try{const s=db.transaction('icones').objectStore('icones');
  lot.forEach((fs,cle)=>{const q=s.get(cle);q.onsuccess=()=>rend(fs,q.result||null);q.onerror=()=>rend(fs,null)})}
 catch(e){lot.forEach(fs=>rend(fs,null))}}
function ecritIconesBd(paires){if(!paires.length)return;if(!ecritures){ecritures=[];setTimeout(videEcritures,50)}ecritures.push(...paires)}
// Quitter la page écrit ce qui attendait encore.
addEventListener('pagehide',()=>{if(ecritures)videEcritures()});
async function videEcritures(){const lot=ecritures;ecritures=null;if(!lot)return;const db=await ouvreBdIcones();if(!db)return;
 try{const s=db.transaction('icones','readwrite').objectStore('icones');lot.forEach(([k,v])=>s.put(v,k))}catch(e){}}
/* Les demandes de découpe d'un même rendu se regroupent par planche : une planche s'ouvre une
   fois pour toutes les icônes qu'on lui demande. */
const ATTENTES=new Map();let demandes=null;
function demandeDecoupe(f,cas,cle){return new Promise((ok,ko)=>{(ATTENTES.get(cle)||ATTENTES.set(cle,[]).get(cle)).push({ok,ko});
 if(!demandes){demandes=new Map();setTimeout(lanceDecoupes,30)}
 (demandes.get(f)||demandes.set(f,new Map()).get(f)).set(cle,cas)})}
function arrivee(cle,blob){const u=URL.createObjectURL(blob);URLS_PRETES.set(cle,u);ecritIconesBd([[cle,blob]]);
 (ATTENTES.get(cle)||[]).forEach(a=>a.ok(u));ATTENTES.delete(cle)}
function echec(cles,err){cles.forEach(c=>{(ATTENTES.get(c)||[]).forEach(a=>a.ko(err));ATTENTES.delete(c)})}
function lanceDecoupes(){const lot=demandes;demandes=null;
 lot.forEach((cases,f)=>{const liste=[...cases].map(([cle,cas])=>({cle,cas}));
  // À l'écart d'abord ; sans fil de calcul (vieux navigateur), dans la page, comme avant.
  decoupeAlEcart(f,liste).then(()=>echec(liste.map(x=>x.cle).filter(c=>!URLS_PRETES.has(c)),new Error('Icône absente')))
   .catch(()=>decoupeIci(f,liste)).catch(e=>echec(liste.map(x=>x.cle),e))})}
// Toutes les icônes d'une planche, sur l'appareil, après une découpe.
function decoupeLaPlanche(f){const p=plancheDe(f);if(!p)return Promise.resolve();
 return Promise.allSettled(p.cases.map((_,k)=>urlIcone(f+'#'+(k+1))))}
/* Le fil de calcul : créé à la première découpe, gardé ensuite. S'il manque ou tombe, la page
   découpe elle-même. */
let travailleur=null,travailleurHS=typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function';
const TRAVAUX=new Map();let travailN=0;
function travail(msg,surIcone){if(travailleurHS)return Promise.reject(new Error('Pas de fil de calcul'));
 if(!travailleur){try{travailleur=new Worker('./planches-worker.js?v='+(typeof IMG_V!=='undefined'?IMG_V:''));
   travailleur.onmessage=e=>{const m=e.data,t=TRAVAUX.get(m.id);if(!t)return;
    if(m.blob){if(t.surIcone)t.surIcone(m.cle,m.blob);return}
    TRAVAUX.delete(m.id);if(m.erreur)t.ko(new Error(m.erreur));else t.ok(m)};
   travailleur.onerror=()=>{travailleurHS=true;TRAVAUX.forEach(t=>t.ko(new Error('Fil de calcul indisponible')));TRAVAUX.clear()}}
  catch(e){travailleurHS=true;return Promise.reject(e)}}
 return new Promise((ok,ko)=>{const id=++travailN;TRAVAUX.set(id,{ok,ko,surIcone});travailleur.postMessage({...msg,id})})}
// Les adresses d'une planche : le site, puis le dépôt, pour une planche tout juste envoyée.
function adressesPlanche(f){const depot=typeof depotPages==='function'?depotPages():'';
 return [new URL(urlPlanche(f),location.href).href,...(depot?['https://raw.githubusercontent.com/'+depot+'/main/img/'+f.split('/').map(encodeURIComponent).join('/')]:[])]}
function decoupeAlEcart(f,liste){return travail({type:'decoupe',urls:adressesPlanche(f),taille:TAILLE_ICONE,cases:liste},arrivee)}
// Dans la page : une planche à la fois, les icônes demandées seulement, puis la planche est oubliée.
let fileIci=Promise.resolve();
function decoupeIci(f,liste){const pr=fileIci.then(async()=>{const reste=liste.filter(x=>!URLS_PRETES.has(x.cle));if(!reste.length)return;
  const img=await chargePlanche(f),al=alphaPlanche(f,img);
  for(const {cle,cas} of reste){const b=await coupeIcone(img,al,cas);if(b)arrivee(cle,b);else echec([cle],new Error('Découpe impossible'))}})
  .finally(()=>oubliePlanche(f));
 fileIci=pr.catch(()=>{});return pr}
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
// Dans la page, faute de fil de calcul : le même masque, posé sur une toile.
function gardeSesPixels(g,al,sx,sy,sw,sh){const d=g.getImageData(0,0,sw,sh);if(masque(d.data,al,sx,sy,sw,sh))g.putImageData(d,0,0)}
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
 // Dans l'ordre de leurs noms, les numéros comptés comme des nombres : Talents 9, puis Talents 10.
 const fichiers=[...new Set([...PLANCHES_FICHIERS,...planchesDuCatalogue().map(p=>p.fichier)])].sort((a,b)=>nomPlanche(a).localeCompare(nomPlanche(b),'fr',{numeric:true}));
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
 // Renommer sans ouvrir ni fermer la planche.
 const renomme=document.createElement('button');renomme.type='button';renomme.className='planche-renomme';renomme.textContent='✎';
 renomme.title='Renommer la planche';renomme.setAttribute('aria-label','Renommer la planche '+nomPlanche(f));
 renomme.onclick=e=>{e.preventDefault();e.stopPropagation();renommePlanche(f)};
 tete.append(h,renomme,compte,etat);bloc.append(tete);
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
async function decouper(f,lignes,colonnes){
 const li=lignes&&colonnes?Math.max(1,Math.min(60,lignes|0)):0,co=lignes&&colonnes?Math.max(1,Math.min(60,colonnes|0)):0;
 // La grille se lit à l'écart ; sans fil de calcul, dans la page.
 let g;try{g=(await travail({type:'detecte',urls:adressesPlanche(f),lignes:li,colonnes:co})).grille}
 catch(e){let al;try{al=alphaPlanche(f,await chargePlanche(f))}catch(e2){alert('Impossible de lire la planche « '+nomPlanche(f)+' ».');return}
  const gr=li?grilleUniforme(al,li,co):detecteGrille(al);g=gr&&{lignes:gr.lignes,colonnes:gr.colonnes,cases:casesDe(al,gr.bx,gr.by)};oubliePlanche(f)}
 if(!g){alert('Aucune icône trouvée : la planche a-t-elle bien un fond transparent ?');return}
 const cases=g.cases,avant=plancheDe(f);
 if(!cases.length){alert('Aucune icône trouvée dans cette grille.');return}
 if(avant&&avant.icones.some(i=>i.nom||i.cat)&&!confirm('Redécouper « '+nomPlanche(f)+' » en '+cases.length+' icônes ? Les noms et catégories restent attachés aux numéros : vérifie-les ensuite.'))return;
 // Une planche qui porte le nom d'une catégorie, « OMBRELAME », y range d'emblée ses icônes nouvelles.
 const catNom=(CATS_ICONES.find(([,n])=>cleTalent(n)===cleTalent(nomPlanche(f)))||[''])[0];
 const p={fichier:f,lignes:g.lignes,colonnes:g.colonnes,cases,icones:cases.map((_,i)=>avant&&avant.icones[i]?{...avant.icones[i]}:{nom:'',cat:catNom})};
 catalog.planches=[...planchesDuCatalogue().filter(x=>x.fichier!==f),normalisePlanches([p])[0]];PLANCHES_OUVERTES.add(f);sauveIcones();renderIcones();
 // Toutes ses icônes rejoignent l'appareil dans la foulée, et la planche quitte la mémoire.
 decoupeLaPlanche(f)}

/* ---------- Les icônes voyagent avec la publication ----------
   Quand le MJ publie, son navigateur, qui a déjà découpé les icônes, joint au contenu celles
   que ce contenu emploie vraiment, talents, objets, attaques ou autre, en 96 pixels. Un
   joueur n'ouvre ainsi jamais une planche : il ne reçoit que ce qu'il peut voir. */
const TAILLE_PUBLIEE=96;
/* Une icône déjà préparée pour la publication le reste, sur l'appareil : publier après chaque
   changement ne réencode plus rien, seules les icônes nouvellement employées se préparent. */
const DONNEES_PUBLIEES=new Map();
async function iconesAPublier(value){const ids=[...new Set(JSON.stringify(value).match(/planches\/[^"#\\]+#\d+/g)||[])].filter(id=>estIconePlanche(id)&&iconeDe(id));
 const out={};
 await Promise.all(ids.map(async id=>{const cle='pub|'+cleIcone(id,iconeDe(id));let d=DONNEES_PUBLIEES.get(cle);
  if(!d){const b=await litIconeBd(cle);if(typeof b==='string')d=b}
  if(!d)try{const u=await urlIcone(id);d=u.startsWith('data:')?u:await enDonnees(u);ecritIconesBd([[cle,d]])}catch(e){}
  if(d){DONNEES_PUBLIEES.set(cle,d);out[id]=d}}));
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
 /* Replié, un groupe se déplie d'un clic sur son titre ; une recherche ouvre ceux qui répondent. */
 const groupe=(titre,options,replie)=>{const t=options.map(tuile).filter(Boolean);if(!t.length)return;
  const g=document.createElement('div');g.className='grille-logos-liste';g.append(...t);
  if(!titre){corps.append(g);return}
  const d=document.createElement('details');d.className='grille-logos-groupe';d.open=!replie||!!q;
  const h=document.createElement('summary');h.className='grille-logos-titre';h.textContent=titre;d.append(h,g);corps.append(d)};
 const options=[...s.children].filter(x=>x.tagName==='OPTION'),groupes=[...s.querySelectorAll('optgroup')];
 /* Le logo d'un talent : les planches de talents d'abord, une par une et dépliées ; tout le
    reste suit, replié. */
 if(s.closest('#talent-form')){
  /* Les planches à mettre en tête : celles des talents ; pour le logo d'un bonus, celles des
     caractéristiques d'abord, puis celles des talents. */
  const tetes=s.name==='b_logo'?['caracteristiques','talents']:['talents'];
  const planche=o=>{const m=/^(planches\/([a-z]+)_(\d+)\.(?:png|webp))#(\d+)$/i.exec(o.value);if(!m)return null;const k=tetes.indexOf(m[2].toLowerCase());return k<0?null:{f:m[1],k,n:+m[3],i:+m[4]}};
  const vues=new Set(),parPlanche=new Map();
  groupes.forEach(g=>[...g.children].forEach(o=>{const p=planche(o);if(!p||vues.has(o.value))return;vues.add(o.value);
   if(!parPlanche.has(p.f))parPlanche.set(p.f,{k:p.k,n:p.n,l:[]});parPlanche.get(p.f).l.push([p.i,o])}));
  groupe('',options);
  [...parPlanche.entries()].sort((x,y)=>x[1].k-y[1].k||x[1].n-y[1].n).forEach(([f,p])=>groupe(nomPlanche(f),p.l.sort((x,y)=>x[0]-y[0]).map(x=>x[1]),false));
  groupes.forEach(g=>groupe(g.label,[...g.children].filter(o=>!vues.has(o.value)),true))}
 else{groupe('',options);groupes.forEach(g=>groupe(g.label,[...g.children]))}
 if(!montres){const v=document.createElement('p');v.className='muted';v.textContent='Aucun logo de ce nom.';corps.append(v)}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.grille-logos');if(!b)return;
 e.preventDefault();const s=b.parentNode.querySelector('select');if(s)ouvreGrilleLogos(s)});
