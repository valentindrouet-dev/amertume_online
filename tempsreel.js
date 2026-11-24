/* ---------- v1.409 — Le combat en temps réel, à l'essai ----------
   Une option du MJ (le bouton ⏱ de la barre de la carte). Allumée, en combat, chaque point d'Action ou de
   Mouvement dépensé revient de lui-même après un temps de recharge, sans attendre « Tour suivant », et le
   déplacement n'a plus de distance comptée (v1.410) ; éteinte, le combat est le tour par tour de toujours.

   TOUT tient dans ce fichier — la règle, le bouton, l'affichage et son style. Pour retirer le temps
   réel : ôter sa balise <script> d'index.html (et ce fichier). Rien d'autre ne le connaît.

   Comment ça tient sans rien changer au reste :
   - « checks[0] » garde son sens : les PA dépensés ce tour. C'est la mémoire du tour, que lisent
     « Débuter le combat », les talents de début de combat… Elle ne bouge pas quand un PA revient.
   - « recharges » (sur le combattant) : l'heure de retour de chaque PA encore en recharge. Un PA
     dont l'heure est passée est rendu — personne n'a rien à écrire pour cela, c'est l'horloge qui
     le dit, la même chez tous. « Tour suivant » remet checks à zéro : tout est rendu d'un coup.
   - pointsUses, pointsRestants, depensePoint, rendPoint et epuisePoints (les copies que combat.js publie)
     sont enveloppés pour les points d'Action et de Mouvement (« rechargesM ») ;
     l'Objet, les états et les limites des talents restent au tour.
   - L'option voyage du MJ aux joueurs dans « fogReset » (clé « tr », en secondes), comme le
     mouvement limité : aucune clé nouvelle dans le document, aucune règle Firebase à toucher. */
'use strict';
const TR_CLE='amertume-temps-reel',TR_SECONDES=6;
let tempsReel=(()=>{try{return localStorage.getItem(TR_CLE)==='1'}catch(e){return false}})(),trSecondes=TR_SECONDES;
const trDuree=()=>Math.max(1,trSecondes)*1000;
// Le temps réel ne vaut qu'en combat : hors combat, rien ne change.
const trActif=()=>tempsReel&&typeof enCombat==='function'&&enCombat();
// Les heures de retour encore à venir, de la plus proche à la plus lointaine.
// Action : « recharges » ; Mouvement : « rechargesM ». L'Objet reste au tour.
const TR_CHAMP={action:'recharges',mouvement:'rechargesM'};
const trVivantes=(a,t=Date.now(),quoi='action')=>{const l=a&&a[TR_CHAMP[quoi]];return Array.isArray(l)?l.filter(f=>typeof f==='number'&&f>t).sort((x,y)=>x-y):[]};

/* ---------- La règle ----------
   combat.js garde ses fonctions pour lui et n'en publie qu'une copie : ce sont ces copies — celles que la
   table appelle — qu'on enveloppe, pour le seul point d'Action et en temps réel seulement. */
{const lis=pointsUses,restants=pointsRestants,depense=depensePoint,rend=rendPoint,epuise=epuisePoints;
 const ici=(a,quoi)=>!!TR_CHAMP[quoi]&&!!a&&trActif();
 /* Le compte voulu : checks le retient comme toujours ; les recharges s'alignent dessus — un point de plus
    part en recharge maintenant, un point rendu (un remboursement) ôte la plus lointaine. */
 const pose=(a,quoi,n)=>{if(!Array.isArray(a.checks))a.checks=[0,0,0];
  const t=Date.now(),v=trVivantes(a,t,quoi),r=Math.max(0,Math.min(pointsMax(a,quoi),Math.trunc(n)||0)),champ=TR_CHAMP[quoi];a.checks[POINTS_CLES.indexOf(quoi)]=r;
  while(v.length<r)v.push(t+trDuree());v.length=r;
  if(v.length)a[champ]=v;else delete a[champ];return r};
 pointsUses=function(a,quoi){const n=lis(a,quoi);return n>0&&ici(a,quoi)?Math.min(n,trVivantes(a,Date.now(),quoi).length):n};
 pointsRestants=function(a,quoi){return ici(a,quoi)?pointsMax(a,quoi)-pointsUses(a,quoi):restants(a,quoi)};
 depensePoint=function(a,quoi,n=1){return ici(a,quoi)?pose(a,quoi,pointsUses(a,quoi)+n):depense(a,quoi,n)};
 rendPoint=function(a,quoi,n=1){return ici(a,quoi)?pose(a,quoi,pointsUses(a,quoi)-n):rend(a,quoi,n)};
 epuisePoints=function(a,quoi){return ici(a,quoi)?pose(a,quoi,pointsMax(a,quoi)):epuise(a,quoi)}}
/* v1.410 — Le déplacement en temps réel : plus de distance comptée, plus de point payé pour bouger. Il suffit d'avoir
   un point de Mouvement disponible ; tous en recharge (dépensés par un talent, une Analyse, se relever), le socle
   ne bouge pas tant qu'aucun n'est revenu. La règle du geste est celle du jeu, dont on lève la borne et le prix. */
if(typeof regleMouvement==='function'){const regle=regleMouvement;
 regleMouvement=function(a){const r=regle(a);if(!r||!trActif())return r;
  // « neuf » à faux : le geste ne paie pas de point ; « max » négatif : aucune borne (borneMouvement, appliqueRegleMouvement).
  r.fini=pointsRestants(a,'mouvement')<=0;r.neuf=false;r.max=-1;r.metres=0;r.bonus0=0;r.tempsReel=true;return r}}
/* Les cases cachées Action / Mvt / Objet se relisent à chaque sélection : celle de l'Action dit ce que
   dit l'horloge, sinon un PA revenu depuis le dernier rendu serait repris. */
{const garde=saveChecks;saveChecks=function(){if(trActif()){const a=actors[selected];if(a)[['action','action'],['move','mouvement']].forEach(([id,quoi])=>{const c=$(id);if(c)c.checked=pointsRestants(a,quoi)<=0})}return garde()}}
// Les recharges voyagent avec l'état du tour d'un combattant, comme ses points.
if(typeof CHAMPS_VIVANTS!=='undefined'){CHAMPS_VIVANTS.push('recharges','rechargesM');CHAMPS_TOUR.push('recharges','rechargesM')}
if(typeof etatVivant==='function'){const dit=etatVivant;etatVivant=function(){const o=dit();if(tempsReel&&o&&o.fogReset&&typeof estMJ==='function'&&estMJ())o.fogReset.tr=trSecondes;return o}}
// Chez un joueur à la table, l'option est celle du MJ.
function trLisTable(){if(typeof enLigne==='undefined'||!enLigne||typeof estMJ!=='function'||estMJ()||typeof dernierDoc==='undefined'||!dernierDoc)return;
 const f=dernierDoc.fogReset,s=f&&typeof f==='object'?Math.trunc(Number(f.tr))||0:0;tempsReel=s>0;if(s>0)trSecondes=Math.min(600,s)}

/* ---------- Le bouton du MJ ---------- */
const trBouton=typeof icone==='function'&&typeof limiteBtn!=='undefined'?icone('temps-reel','⏱','Temps réel'):null;
if(trBouton){limiteBtn.after(trBouton);texteBouton(trBouton);
 BOUTONS_CARTE['temps-reel']=()=>['Temps réel',tempsReel?'En combat, chaque point d’Action ou de Mouvement dépensé revient après '+trSecondes+' s, et les déplacements n’ont plus de limite ; un clic rend le combat au tour par tour.':'En combat, chaque point d’Action ou de Mouvement dépensé revient après '+trSecondes+' s, sans attendre le tour suivant, et les déplacements n’ont plus de limite.'];
 trBouton.onclick=()=>{tempsReel=!tempsReel;try{localStorage.setItem(TR_CLE,tempsReel?'1':'0')}catch(e){}
  if(typeof refreshGmBar==='function')refreshGmBar();render();scheduleSave()}}

/* ---------- L'affichage ----------
   Un point en recharge — d'Action ou de Mouvement — se montre gris, et se recolore en tournant, comme une montre : sa
   pastille dans la liste des combattants, et, dans la barre du combattant choisi, le rond de chaque action qui
   l'attend. L'animation part « déjà avancée » (un délai négatif) : un rendu la reprend où elle en était. */
const trStyle=h=>'--tr-duree:'+trDuree()+'ms;--tr-avance:-'+Math.max(0,Math.min(trDuree(),Date.now()-(h-trDuree())))+'ms';
// Chaque sorte : sa clé, la classe de sa pastille, et ce que dit le jeu d'un rond qui l'attend — ses phrases, telles qu'il les écrit.
const TR_SORTES=[['action','action',/Action déjà dépensée|points? d’Action/],['mouvement','mvt',/points? de Mouvement/]];
{const billes=pastillesPoints;
 pastillesPoints=function(a){const s=billes(a);if(!a||!trActif()||!alive(a))return s;const t=Date.now();
  const p=TR_SORTES.map(([quoi,cls])=>trVivantes(a,t,quoi).slice(0,Math.max(0,pointsMax(a,quoi)-pointsRestants(a,quoi))).map(h=>'<i class="pt '+cls+' tr-pt" style="'+trStyle(h)+'"></i>').join(''));
  const i=s.indexOf('<i class="pt mvt');return i<0?s+p[0]+p[1]:s.slice(0,i)+p[0]+s.slice(i)+p[1]}}
function trHabille(){const barre=document.querySelector('section.attack-card');if(!barre)return;
 const a=trActif()?actors[selected]:null,t=Date.now();
 barre.querySelectorAll('button.btn-action').forEach(b=>{
  const dit=(b.getAttribute('aria-label')||'')+' '+(b.dataset.dit||'')+' '+(b.dataset.refus||''),billes=[];let h=0;
  if(a)TR_SORTES.forEach(([quoi,cls,re])=>{const v=trVivantes(a,t,quoi);if(!v.length||!re.test(dit))return;
   const pts=[...b.querySelectorAll('.cout-bas .pt.'+cls)],manque=Math.max(1,pts.length)-pointsRestants(a,quoi);if(manque<=0||manque>v.length)return;
   h=Math.max(h,v[manque-1]);pts.slice(0,manque).forEach((p,k)=>billes.push([p,v[k]]))});
  const cle=h?String(h):'',voile=b.querySelector(':scope>.tr-voile');
  if((b.dataset.trRecharge||'')===cle&&(!h||voile))return;
  if(voile)voile.remove();b.querySelectorAll('.cout-bas .pt.tr-pt').forEach(p=>{p.classList.remove('tr-pt');p.style.removeProperty('--tr-duree');p.style.removeProperty('--tr-avance')});
  if(!h){delete b.dataset.trRecharge;b.classList.remove('tr-recharge');b.style.removeProperty('--tr-fond');return}
  // Sa couleur d'avant le gris : celle qu'il a sans « inerte », lue une fois.
  b.classList.remove('tr-recharge');b.style.removeProperty('--tr-fond');
  const inerte=b.classList.contains('inerte');b.classList.remove('inerte');const fond=getComputedStyle(b).getPropertyValue('--fond').trim();if(inerte)b.classList.add('inerte');
  if(fond)b.style.setProperty('--tr-fond',fond);b.dataset.trRecharge=cle;b.classList.add('tr-recharge');
  const s=document.createElement('span');s.className='tr-voile';s.setAttribute('aria-hidden','true');s.style.cssText=trStyle(h);b.append(s);
  billes.forEach(([p,hk])=>{p.classList.add('tr-pt');p.style.cssText+=';'+trStyle(hk)})})}
// Le prochain point qui revient redessine la table à son heure ; un socle en main, on attend qu'il soit posé.
let trReveil=0;
function trProgramme(){clearTimeout(trReveil);if(!trActif())return;const t=Date.now();let proche=Infinity;
 actors.forEach(a=>TR_SORTES.forEach(([quoi])=>{const v=trVivantes(a,t,quoi);if(v.length&&v[0]<proche)proche=v[0]}));
 if(proche<Infinity)trReveil=setTimeout(function reveil(){if(window.socleEnMain){trReveil=setTimeout(reveil,150);return}render()},Math.max(30,proche-t+25))}
{const rendu=render;render=function(...x){trLisTable();const o=rendu.apply(this,x);
  if(trBouton)trBouton.classList.toggle('on',tempsReel);try{trHabille()}catch(e){if(typeof signaleErreur==='function')signaleErreur(e,'temps réel')}trProgramme();return o}}
// La rangée du haut se refait hors du rendu (un changement d'arme, une cible) : on la rhabille aussitôt.
{const barre=document.querySelector('section.attack-card');
 if(barre)new MutationObserver(()=>{try{trHabille()}catch(e){}}).observe(barre,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-label']})}

/* Le style. Aucune couleur nouvelle : le gris est celui des ronds inertes (--gris-action), la pastille est
   celle du jeu. « --tr-angle » se déclare pour pouvoir s'animer ; là où le navigateur ne le sait pas, le
   rond reste gris jusqu'au retour du PA. */
{const st=document.createElement('style');st.id='temps-reel-style';st.textContent=`
@property --tr-angle{syntax:'<angle>';inherits:false;initial-value:0deg}
@keyframes tr-tourne{from{--tr-angle:0deg}to{--tr-angle:360deg}}
.map-panel .barre-actions button.btn-action.rond.inerte.tr-recharge,button.btn-action.rond.inerte.tr-recharge,button.btn-action.rond.inerte.tr-recharge:hover{--fond:var(--tr-fond,var(--gris-action))!important;opacity:1;filter:none}
button.btn-action.rond.inerte.tr-recharge img{filter:none;opacity:1}
.barre-actions button.btn-action.rond.inerte.tr-recharge .cout-bas .pt:not(.tr-pt){filter:none}
.tr-voile{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:2;
 background:color-mix(in srgb,var(--gris-action) 55%,transparent);
 -webkit-backdrop-filter:grayscale(1) brightness(.8);backdrop-filter:grayscale(1) brightness(.8);
 -webkit-mask-image:conic-gradient(transparent var(--tr-angle),#000 0);mask-image:conic-gradient(transparent var(--tr-angle),#000 0);
 animation:tr-tourne var(--tr-duree) linear var(--tr-avance) both}
.pt.tr-pt,.pastilles .pt.tr-pt,.barre-actions button.btn-action.rond .cout-bas .pt.tr-pt{position:relative;background:none;filter:none;opacity:1}
.pt.tr-pt::before,.pt.tr-pt::after{content:'';position:absolute;inset:0;background:url(img/points/pa.webp) center/contain no-repeat}
.pt.mvt.tr-pt::before,.pt.mvt.tr-pt::after{background-image:url(img/points/pm.webp)}
.pt.tr-pt::before{filter:grayscale(1);opacity:.5}
.pt.tr-pt::after{-webkit-mask-image:conic-gradient(#000 var(--tr-angle),transparent 0);mask-image:conic-gradient(#000 var(--tr-angle),transparent 0);animation:tr-tourne var(--tr-duree) linear var(--tr-avance) both}
@media(prefers-reduced-motion:reduce){.tr-voile,.pt.tr-pt::after{animation:none}}
`;document.head.append(st)}
