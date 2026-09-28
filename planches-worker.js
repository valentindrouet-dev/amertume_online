/* ---------- Le fil de calcul des planches ----------
   Lire une planche et la découper demande quelques centaines de millisecondes de calcul par
   planche. Fait dans la page, ce calcul figeait l'interface ; il se fait ici, à l'écart. La page
   envoie une demande, « detecte » (la grille d'une planche, pour l'onglet Icônes) ou « decoupe »
   (des icônes précises, dans l'ordre où elle les veut) ; chaque icône revient dès qu'elle est
   prête, en WebP. Les demandes se traitent une à une : la mémoire ne tient qu'une planche, gardée
   quinze secondes au cas où la demande suivante porterait sur elle. */
'use strict';
importScripts('planches-calcul.js'+(self.location.search||''));
/* Une à une, mais la grille d'abord : le MJ qui clique Découper n'attend pas que les icônes
   d'une autre planche soient prêtes. */
let derniere=null,occupe=false;const attente=[];
self.onmessage=e=>{attente.push(e.data);if(!occupe)suite()};
async function suite(){occupe=true;
 while(attente.length){const i=attente.findIndex(m=>m.type==='detecte'),m=attente.splice(i>=0?i:0,1)[0];try{await traite(m)}catch(e){}}
 occupe=false}
// La planche, à la première adresse qui répond : le site, sinon le dépôt lui-même.
async function litPlanche(urls){if(derniere&&derniere.url===urls[0])return derniere;
 let r=null,erreur=null;
 for(const u of urls){try{const x=await fetch(u);if(x.ok){r=x;break}}catch(e){erreur=e}}
 if(!r)throw erreur||new Error('Planche introuvable');
 const bmp=await createImageBitmap(await r.blob()),W=bmp.width,H=bmp.height;
 const c=new OffscreenCanvas(W,H),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(bmp,0,0);if(bmp.close)bmp.close();
 const px=g.getImageData(0,0,W,H).data,A=new Uint8Array(W*H);for(let i=0;i<W*H;i++)A[i]=px[i*4+3];
 return {url:urls[0],al:{W,H,A},px,W,H}}
function garde(p){if(derniere&&derniere!==p)clearTimeout(derniere.minuteur);derniere=p;clearTimeout(p.minuteur);
 p.minuteur=setTimeout(()=>{if(derniere===p)derniere=null},15000)}
async function traite(m){try{const p=await litPlanche(m.urls);garde(p);const {al,px,W,H}=p;
  if(m.type==='detecte'){const g=m.lignes&&m.colonnes?grilleUniforme(al,m.lignes,m.colonnes):detecteGrille(al);
   postMessage({id:m.id,grille:g?{lignes:g.lignes,colonnes:g.colonnes,cases:casesDe(al,g.bx,g.by)}:null});return}
  for(const {cle,cas} of m.cases){const [x,y,w,h]=cas;
   const sx=Math.round(x*W),sy=Math.round(y*H),sw=Math.max(1,Math.min(W-sx,Math.round(w*W))),sh=Math.max(1,Math.min(H-sy,Math.round(h*H)));
   // Le cadre de l'icône, pris dans les pixels déjà lus, sans ce qui appartient aux voisines.
   const d=new ImageData(sw,sh);for(let r=0;r<sh;r++)d.data.set(px.subarray(((sy+r)*W+sx)*4,((sy+r)*W+sx+sw)*4),r*sw*4);
   try{masque(d.data,al,sx,sy,sw,sh)}catch(e){}
   const c=new OffscreenCanvas(sw,sh);c.getContext('2d').putImageData(d,0,0);
   // Réduite à la taille où elle sert.
   const k=Math.min(1,m.taille/Math.max(sw,sh));let out=c;
   if(k<1){out=new OffscreenCanvas(Math.max(1,Math.round(sw*k)),Math.max(1,Math.round(sh*k)));
    const g=out.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(c,0,0,out.width,out.height)}
   let blob;try{blob=await out.convertToBlob({type:'image/webp',quality:.9})}catch(e){blob=await out.convertToBlob()}
   postMessage({id:m.id,cle,blob});
   // Une grille demandée entre-temps passe avant la suite : la découpe reprend juste après.
   const j=attente.findIndex(x=>x.type==='detecte');if(j>=0)await traite(attente.splice(j,1)[0])}
  postMessage({id:m.id,fini:true})}
 catch(err){postMessage({id:m.id,erreur:String(err&&err.message||err)})}}
