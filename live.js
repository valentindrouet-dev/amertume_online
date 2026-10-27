/* ---------- La table en ligne ----------
   Le MJ ouvre une table et partage son lien. Chacun l'ouvre chez soi, choisit
   l'aventurier qu'il incarne, et joue : socles, attaques, portes et points de vie
   se synchronisent en direct.

   Deux étages, pour que rien ne rame :
   · le CONTENU (catalogue, cartes, illustrations) est publié rarement et lourdement
     par shared.js — c'est lui qui donne aux joueurs les fiches et les images ;
   · l'ÉTAT VIVANT (qui est où, à combien de PV, quel état, quelle porte ouverte) tient
     dans un seul petit document que tout le monde écoute et écrit. Quelques kilo-octets,
     donc un aller-retour court.

   L'écriture se fait par différence : après chaque rendu on compare l'état vivant à ce
   qu'on a poussé la dernière fois, et on n'envoie que les champs qui ont bougé, par
   chemin (« actors.<id>.hp »). Firestore fusionne ces chemins un à un : deux joueurs qui
   bougent deux socles différents ne se marchent jamais dessus. Ce qui arrive d'en face
   est appliqué puis retenu comme référence, de sorte qu'on ne le renvoie pas en écho. */
'use strict';
/* Ce qui vit et se synchronise. Les images n'y sont pas : elles voyagent avec le contenu
   publié, une fois pour toutes, et pèsent mille fois plus. */
const CHAMPS_VIVANTS=['name','hero','template','role','type','socle','x','y','hp','max','def','dmg',
 'pool','attacks','weapons','armures','shieldId','munitionId','inventaire','talents','states','bleed','cumuls','checks','points','ignition','immunites','usages','cibles','activeAttack','auraPv','mursElem','talentsJoues','orbeStatique','nyctalope','mouvement','mvtReste','mvtTour','opportunitesSubies',
 'revealed','hidden','vu','numero','orbes','orbesGardes','garde','garde2','plasma','plasmaPose','plasmaTour','inventions','armesAvantInventions','notes','reposPris','vie','comaVie','etatsPassifs','richesses','lieuDomaine','paliersTalents','defBrisee','element','depots','reposCourts','horsCarte','retire','butin','quantites','lameventPret','fouilles','revanche','traction','bondissement','decoupe','vengeance','insaisisQuittes','paBonus','impulsion','coupureFatale','adieu','quetesPrises','quetesDebloquees','forges','accelM','pointsCreation','espece','enAventure','imageJeton','joueur','joueurNom','poussiere','savoirAnterieur','nature','gages','deguise','deguisements','malefice','rancunes','necrose','radiance','armure','pvBase','formeGeant','mvtBonus','pnj','alignement','bourse','alignementJeu','enrage','bilan',
 'xp','level','skills','endu','vieMax','pvBonus','sexe','race','malusPieges','enjambe','franchis','etatsPieges','tenuPar','entendu','discret','crie','ecoutes','connu','analysesFaites','debutTour','avantPiege','muraille','murailleImmo','carapaceRecue'];
const CHAMPS_MJ=['round','mapId','locked','title','mode','fogOff','fogReset'];
// Ce qu'un joueur n'écrit jamais sur un combattant : révéler et voiler sont l'affaire du MJ.
// L'élément d'un Mystique est au MJ : un joueur ne le pousse pas.
const CHAMPS_ACTEUR_MJ=['vu','revealed','hidden','numero','element','pnj','alignement','alignementJeu','debutTour','enAventure'];
// L'attente d'un aventurier créé par un joueur : le MJ seul la lève, et elle voyage avec les autres champs.
CHAMPS_ACTEUR_MJ.push('enAttente');CHAMPS_VIVANTS.push('enAttente');
// v0.915 : le Charme retient qui l'a charmé ; Sang Féerique, le combat où il a servi.
CHAMPS_VIVANTS.push('charmePar','sangFeerique');
// v1.009 : les opérations d'un aventurier sur le Coffre de Groupe, que l'appareil du MJ verse une fois.
CHAMPS_VIVANTS.push('coffreOps');
// v1.010 : la demande de combat d'un joueur — son coup est parti contre un adversaire révélé, hors combat : l'appareil du MJ le lance.
CHAMPS_VIVANTS.push('demandeCombat');
// v0.916 : la compétence de Compétent (Humain).
CHAMPS_VIVANTS.push('competent');
// v0.921 : l'Ascendance du Drakéide.
CHAMPS_VIVANTS.push('ascendance');
// v0.922 : l'Héritage du Tieffelin ; l'Adrénaline et l'Acharnement retiennent leur combat.
CHAMPS_VIVANTS.push('heritage','adrenaline','acharnement');
// v0.929 : la forme du Charognard, son socle d'avant, son Dévoreur ; le cadavre dévoré.
CHAMPS_VIVANTS.push('forme','socleAvantForme','devoreur','devore');
// v0.930 : le nuage de fumée de l'Allsteiner.
CHAMPS_VIVANTS.push('fumee','cacheFumee');
// v0.933 : la Maîtrise et l'Éclat du Tellure.
CHAMPS_VIVANTS.push('maitriseT','maitriseTPrete','eclat');
CHAMPS_VIVANTS.push('ingenieuxPret','limitesCombat','surBanc');
// v0.934 : l'Ascension et le Touche-à-Tout de l'Hephosien.
CHAMPS_VIVANTS.push('ascension','toucheATout');
// L'aventurier que le MJ a sorti du combat de la table : à lui seul de l'y faire rentrer.
CHAMPS_ACTEUR_MJ.push('sortiCombat');CHAMPS_VIVANTS.push('sortiCombat');
// La position d'où un socle au mouvement épuisé s'ajuste.
CHAMPS_VIVANTS.push('ajuste');
// Où chaque test de compétence a été fait : le même ne se refait pas sans être sorti de sa zone de contact.
CHAMPS_VIVANTS.push('testsLieux');
// v1.013 : les recettes d'herboristerie apprises, et ce que les potions laissent sur le buveur.
CHAMPS_VIVANTS.push('recettes','pmPotion','visionPotion','lumierePotion','enduit','repulsif');
// v1.014 : un Sommeil d'un tour, posé par la Berceuse concentrée.
CHAMPS_VIVANTS.push('sommeilBref');
// v1.018 : l'Onguent de lest, l'Élixir de seuil — ce qu'ils percent des Intangibles, jusqu'à la fin du prochain combat.
CHAMPS_VIVANTS.push('perceIntangible');
/* L'état du tour d'un aventurier : ce qu'il a dépensé, joué, parcouru. Un joueur l'écrit daté du tour qu'il voit (« tourVu »,
   cleTour) ; le MJ écarte ce qui arrive daté d'un tour révolu. Au début, à la fin d'un combat et à chaque tour, le joueur reprend
   ces champs tels que le MJ les a remis, sans garder ce qu'il avait encore en route. */
const CHAMPS_TOUR=['checks','mvtReste','mvtTour','talentsJoues','orbes','orbesGardes','garde','garde2','plasma','plasmaPose','plasmaTour','lameventPret','opportunitesSubies'];
const TABLE_CLE='amertume-table';
let tableId=null,salleRef=null,siegesRef=null,enLigne=false,appliquantDistant=false;
let dernierPousse=null,poussePret=false,pousseTimer=null,docPrecedent=null,renduDiffere=null,dernierRefus='';
let monUid=null,monSiege=null,sieges={},quitteSalle=null,quitteSieges=null,dernierDoc=null;
// Ce qu'un joueur a déjà vu de la table : le mode, le dernier envoi d'onglet. Remis à zéro en quittant la table.
let modeConnu=false,ongletConnu=false,ongletVu=null,envoiOnglet=null;
// La victoire sur la carte : son instant voyage avec la table ; celle qu'on trouve en arrivant ne s'annonce pas.
let donjonConnu=false,donjonVu=null,envoiDonjon=null;
// Le numéro des remises à zéro du brouillard, reçu une première fois de la table.
let brouillardConnu=false;
let journalRef=null,quitteJournal=null,journalVus=new Set(),journalPremier=true;
/* Les exclus d'une table : le MJ les inscrit ; les règles leur ferment la table, et leur propre page les en sort aussitôt. */
let bannisRef=null,bannis={},quitteBannis=null,quitteMonBan=null;
/* Le sas : un compte joueur n'agit à une table qu'une fois accepté par le MJ, pour de bon à cette table (« admis/{uid} »).
   En attendant, la table lui reste voilée, et rien ne part de chez lui : ni combattant, ni ligne de journal, ni aventurier. */
let admisRef=null,admis={},quitteAdmis=null,quitteMonAdmis=null,admisIci=true;
function sasEnAttente(){return enLigne&&!estMJ()&&!(typeof mjIci==='function'&&mjIci())&&!admisIci}
// L'exploration de chaque carte, gardée par la table : le MJ l'écrit, les joueurs l'écoutent.
let brouillardsRef=null,quitteBrouillard=null,brouillardEcoute=null,brouillardTable=null,brouillardPousseTimer=0;const brouillardsPousses=new Map();
/* Chez un joueur en ligne, révéler n'est pas son affaire : le MJ révèle, et « vu » lui
   arrive par la table. Sinon chaque appareil révélait de son côté, et un joueur qui
   arrivait voyait « révélés » des créatures que personne n'avait aperçues. */
const tableVoulue=!!new URL(location.href).searchParams.get('table');
/* Un joueur qui arrive ou revient à sa table : la carte reste voilée jusqu'au premier état reçu de la table, au lieu de montrer
   quelques secondes celle de la dernière publication. Le voile tombe au plus tard au bout de trente secondes. */
{let attendue=false;try{attendue=!(typeof mjIci==='function'&&mjIci())&&(tableVoulue||!!localStorage.getItem(TABLE_CLE))}catch(e){}
 if(attendue){document.body.classList.add('table-attendue');setTimeout(()=>document.body.classList.remove('table-attendue'),30000)}}
/* Seul un invité est rangé d'office en vue joueur : venu par le lien d'une table, ou assis à l'une
   d'elles. Une identité anonyme, seule, n'en fait pas un : l'appareil du MJ en gardait une parfois,
   et chaque rechargement le jetait en vue joueur. */
function spectateur(){if(estMJ())return false;
 return enLigne||tableVoulue}
// Le socle qu'on tient sous le doigt ne doit pas être replacé par ce qui arrive du réseau.
window.socleEnMain=null;
/* ---------- Les socles venus du réseau glissent ----------
   Les positions d'un socle déplacé ailleurs arrivent par à-coups, toutes les 150 ms environ, parfois en grappe. On les
   rejoue avec un léger retard, d'une position à la suivante à vitesse régulière, image par image : le socle glisse, et sa
   jauge, son aura, sa lumière avec lui. La position reçue reste la vraie : c'est elle qui repart d'ici. */
const GLISSE_RETARD=220,glissements=new Map();let glisseImage=0;
function positionVraie(a){const g=glissements.get(a.id);return g?g.cible:{x:a.x,y:a.y}}
function glisseVers(a,x,y){const t=performance.now(),g=glissements.get(a.id);
 if(g){g.pts.push({t,x,y});g.cible={x,y}}else glissements.set(a.id,{pts:[{t:t-GLISSE_RETARD,x:a.x,y:a.y},{t,x,y}],cible:{x,y}});
 if(!glisseImage)glisseImage=requestAnimationFrame(glisseUneImage)}
function glisseUneImage(){if(typeof figeCadre==='function'&&!cadreFige)return figeCadre(glisseUneImage);glisseImage=0;const rt=performance.now()-GLISSE_RETARD;
 glissements.forEach((g,id)=>{const a=actors.find(x=>x.id===id);if(!a||window.socleEnMain===id){glissements.delete(id);return}
  while(g.pts.length>2&&g.pts[1].t<=rt)g.pts.shift();
  const [p,q]=g.pts;let x=q.x,y=q.y;
  if(rt<q.t){const s=Math.max(0,Math.min(1,(rt-p.t)/Math.max(1,q.t-p.t)));x=p.x+(q.x-p.x)*s;y=p.y+(q.y-p.y)*s}else glissements.delete(id);
  a.x=x;a.y=y;
  const el=document.querySelector('#map-view .token:not(.lumiere)[data-id="'+CSS.escape(id)+'"]');
  if(el){el.classList.remove('glisse');el.style.left=x+'%';el.style.top=y+'%';if(typeof suitLaJauge==='function')suitLaJauge(el)}});
 if(typeof visibilitesEnGeste==='function')visibilitesEnGeste();if(typeof updateRing==='function')updateRing();if(typeof updateSight==='function')updateSight();
 if(typeof renderNuit==='function'){renderHalos();renderNuit()}
 if(glissements.size)glisseImage=requestAnimationFrame(glisseUneImage);else planifieRenduComplet()}
const estMJ=()=>typeof admin!=='undefined'&&admin===true;
const liveStatus=t=>{const e=$('live-status');if(e)e.textContent=t};
/* « Missing or insufficient permissions » ne dit pas quoi faire. Pour la table, la cause
   est presque toujours la même : le bloc de règles amertume_online_live n'est pas encore
   déployé dans le projet Firebase. Autant l'écrire. */
function liveErreur(e){const code=(e&&(e.code||''))+' '+(e&&e.message||'');
 if(/permission|insufficient/i.test(code))
  return 'Règles Firestore incomplètes ou périmées pour la table. Dans la console Firebase → Firestore → Règles, reprends le bloc « amertume_online_live » tel qu’il est aujourd’hui dans le fichier firestore-online.rules (sa liste de clés doit contenir « mode »), publie, puis réessaie.';
 if(/unauthenticated/i.test(code))return 'Personne n’est connecté : reconnecte-toi avant d’ouvrir la table.';
 if(/operation-not-allowed|admin-restricted/i.test(code))
  return 'Connexion anonyme désactivée. Console Firebase → Authentication → Sign-in method → Anonyme : activer.';
 if(/unavailable|network/i.test(code))return 'Réseau indisponible : la table réessaiera toute seule.';
 return (e&&e.message)||(e&&e.code)||'Erreur inconnue'}

/* ---------- Lecture et écriture de l'état vivant ---------- */
/* Les cibles d'un combattant sont des rangs dans la liste locale, et chaque table range
   ses combattants dans son propre ordre : un rang envoyé tel quel désignait n'importe qui
   chez l'autre. Sur le réseau, elles voyagent donc par identifiant, et se retraduisent
   à l'arrivée. */
function ciblesIds(a){const brut=Array.isArray(a.targets)?a.targets
  :(a.target===null||a.target===undefined?[]:[a.target]);
 return brut.map(j=>actors[j]&&actors[j].id).filter(Boolean)}
function indicesDesCibles(ids){return (Array.isArray(ids)?ids:[]).map(id=>actors.findIndex(o=>o&&o.id===id)).filter(j=>j>=0)}
// Une lumière posée au sol, telle qu'elle voyage : ses clés dans l'ordre où le document les rend.
function lumiereAuSol(l){return {n:l.nom,o:(l.items||[])[0]||'',p:l.id,r:l.rayon,x:l.x,y:l.y}}
// L'état d'un piège en un nombre : révélé 1, parti 2, désamorcé 4, détection manquée 8.
const drapeauxPiege=p=>(p.revele?1:0)|(p.declenche?2:0)|(p.desamorce?4:0)|(p.rate?8:0);
function etatVivant(){const out={actors:{}};
 actors.forEach(a=>{if(!a||!a.id)return;const e={};
  CHAMPS_VIVANTS.forEach(k=>{if(a[k]!==undefined)e[k]=a[k]});
  if(glissements.has(a.id)){const v=glissements.get(a.id).cible;e.x=v.x;e.y=v.y}
  e.cibles=ciblesIds(a);
  out.actors[a.id]=e});
 out.round=round;out.locked=!!tokensLocked;out.mode=mode;
 out.mapId=(typeof currentMapId!=='undefined'&&currentMapId)||null;
 out.title=typeof sceneTitle==='function'?sceneTitle():'';
 const m=typeof currentMap==='function'?currentMap():null;
 /* Les portes, puis — à leur suite, dans le même tableau — la visibilité des objets de la carte :
    un objet découvert paraît chez tous, sans clé de plus dans la salle. Un appareil plus ancien
    ne lit que les portes et ignore la suite. */
 // Un objet : 0 caché, 1 visible, 2 récupéré. Une porte : ouverte ou non ; passage secret découvert, 2 close, 3 ouverte.
 // Puis les coffres, en drapeaux : 1 révélé, 2 déverrouillé, 4 désamorcé, 8 ouvert, 16 tenté verrouillé.
 out.doors=m?[...(m.doors||[]).map(d=>d.crochetee?4+(d.decouvert?2:0)+(d.open?1:0):d.decouvert?(d.open?3:2):!!d.open),...(m.objets||[]).map(o=>o.pris?2:o.prisN>0?16+Math.min(20,o.prisN):o.indice&&o.examine?41:o.indice&&o.tente?40:objetVu(o)?1:0),
  ...(m.coffres||[]).map(c=>(c.revele?1:0)|(c.deverrouille?2:0)|(c.desamorce?4:0)|(c.ouvert?8:0)|(c.tente?16:0)),
  // Puis les lumières de la carte : 2 prise, 1 éteinte, 0 allumée ; enfin, chaque lumière posée au sol, en entier.
  ...(m.lumieres||[]).filter(l=>l&&!l.pose).map(l=>l.prise?2:l.eteinte?1:0),...(m.lumieres||[]).filter(l=>l&&l.pose).map(lumiereAuSol),
  // Enfin les pièges, chacun par son identifiant : 1 révélé, 2 déclenché, 4 désamorcé, 8 détection manquée.
  // v1.014 : les formes de terrain dangereux détruites (le Sel de racine), chacune par sa clé.
  ...(m.dangersDetruits||[]).map(k=>({dg:k})),
  // v1.018 : les seuils de Sel bleu tracés, chacun par ses deux bouts.
  ...(m.seuilsSel||[]).map(s=>({sl:[s.a.x,s.a.y,s.b.x,s.b.y].map(v=>Math.round(v*100)/100)})),
  // v1.044 : les zones gommées dans le terrain coché « Sel », chacune par ses points.
  ...(m.dangersTrous||[]).map(r=>({tr:r.flat().map(v=>Math.round(v*100)/100)})),
  ...(m.pieges||[]).map(p=>({t:p.id,e:drapeauxPiege(p)}))]:[];
 out.fogOff=!!(m&&m.fogOff);
 /* La limite de mouvement que le MJ impose en exploration voyage avec la remise à zéro du brouillard : une clé du MJ seul,
    que les règles admettent déjà ; aucune clé nouvelle dans le document. */
 out.fogReset={...(typeof brouillardReset!=='undefined'?brouillardReset:{n:0,tout:false}),...(typeof mouvementLimiteExplo!=='undefined'&&mouvementLimiteExplo?{limite:true}:{}),
  ...(envoiOnglet?{page:envoiOnglet.page,pn:envoiOnglet.pn}:{}),...(m&&m.obscuriteOff?{noirOff:true}:{}),...(typeof bruitCoupe!=='undefined'&&bruitCoupe?{bruitOff:true}:{}),...(typeof numeroCombat!=='undefined'?{cb:numeroCombat}:{})};
 if(envoiDonjon)out.fogReset.dn=envoiDonjon;
 // La version du MJ voyage : un joueur resté sur une plus ancienne recharge sa page.
 if(typeof IMG_V==='string'&&typeof estMJ==='function'&&estMJ())out.fogReset.v=IMG_V;
 // Les onglets ouverts aux joueurs voyagent avec la table : cochés dans les Paramètres, ils s'ouvrent aussitôt, sans attendre une publication.
 if(typeof estMJ==='function'&&estMJ()&&typeof catalog!=='undefined'&&catalog&&Array.isArray(catalog.ongletsJoueurs))out.fogReset.ong=catalog.ongletsJoueurs.slice();
 /* Une copie profonde : la référence gardée pour la différence ne doit pas suivre les
    tableaux qu'on modifie en place (états, cases, cumuls), sinon rien n'en partait. */
 return JSON.parse(JSON.stringify(out))}
const pareil=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
/* La différence, en chemins de champs. Un acteur disparu s'efface, un acteur neuf part
   entier — c'est ainsi qu'un adversaire posé en pleine partie arrive chez les joueurs
   sans republier tout le contenu. */
function diffEtat(av,ap){const maj={},SUPPR=firebase.firestore.FieldValue.delete();
 const ids=new Set([...Object.keys(av&&av.actors||{}),...Object.keys(ap.actors||{})]);
 ids.forEach(id=>{let a=(av&&av.actors||{})[id];const b=ap.actors[id];
  if(!b){maj['actors.'+id]=SUPPR;return}
  // Sans référence, un joueur compare au dernier document reçu : il n'écrit jamais un combattant entier qui existe déjà.
  if(!a&&!estMJ()&&docPrecedent&&docPrecedent.actors&&docPrecedent.actors[id])a=docPrecedent.actors[id];
  if(!a){maj['actors.'+id]=b;return}
  /* Les PV partent en différence, que Firestore additionne lui-même : deux coups portés au même instant sur le même adversaire
     comptent tous les deux. Une référence négative — des coups qui se sont croisés — se corrige d'une valeur pleine. */
  let tour=false;
  CHAMPS_VIVANTS.forEach(k=>{if(!estMJ()&&CHAMPS_ACTEUR_MJ.includes(k))return;if(pareil(a[k],b[k]))return;
   if(CHAMPS_TOUR.includes(k))tour=true;
   maj['actors.'+id+'.'+k]=b[k]===undefined?SUPPR:k==='hp'&&typeof a[k]==='number'&&typeof b[k]==='number'&&a[k]>=0?firebase.firestore.FieldValue.increment(b[k]-a[k]):b[k]});
  if(tour&&!estMJ()&&typeof cleTour==='function')maj['actors.'+id+'.tourVu']=cleTour()});
 // Un joueur n'écrit l'état du sol que pour la carte ouverte par le MJ : jamais celui d'une carte périmée.
 // Une position écrite par un joueur porte aussi la date du tour qu'il voit : le MJ en combat écarte un pas fait hors combat.
 if(!estMJ()&&typeof cleTour==='function')Object.keys(maj).forEach(k=>{const p=/^actors\.(.+)\.(?:[xy]|hp)$/.exec(k);if(p)maj['actors.'+p[1]+'.tourVu']=cleTour()});
 if(!pareil(av&&av.doors,ap.doors)&&(estMJ()||(dernierDoc&&dernierDoc.mapId&&dernierDoc.mapId===currentMapId)))maj.doors=ap.doors;
 // Le tour, la carte ouverte, le verrou et le titre appartiennent au MJ.
 if(estMJ())CHAMPS_MJ.forEach(k=>{if(!pareil(av&&av[k],ap[k]))maj[k]=ap[k]});
 return maj}
function pousserPlusTard(){if(!enLigne||appliquantDistant||!poussePret)return;
 clearTimeout(pousseTimer);pousseTimer=setTimeout(pousserEtat,60)}
/* Pendant un glissement, la position part par salves : assez souvent pour que le socle
   glisse en face, pas à chaque pixel. */
function pousserBientot(){if(!enLigne||appliquantDistant||!poussePret||pousseTimer)return;
 pousseTimer=setTimeout(pousserEtat,150)}
/* Les envois se suivent sans s'attendre : Firestore les ordonne. Un refus fait repartir
   l'état entier au prochain envoi, pour que rien ne manque en face. */
function pousserEtat(){pousseTimer=null;if(!enLigne||!salleRef||sasEnAttente())return;
 const ap=etatVivant(),maj=diffEtat(dernierPousse,ap);
 if(!Object.keys(maj).length)return;
 dernierPousse=ap;maj.at=firebase.firestore.FieldValue.serverTimestamp();
 salleRef.update(maj).then(()=>{const b=$('open-live');if(b&&b.dataset.souci){delete b.dataset.souci;b.title=''}})
  .catch(e=>{dernierPousse=null;const texte='Envoi impossible. '+liveErreur(e);liveStatus(texte);
   // Un refus se voit sur le bouton de la table, et se dit une fois au journal de l'appareil.
   const b=$('open-live');if(b){b.dataset.souci='1';b.title=texte}
   if(texte!==dernierRefus){dernierRefus=texte;log('Table : '+texte,{local:true})}})}
/* Rien d'autre que des positions n'a bougé ? Les socles glissent sans rendu complet. */
function seulementPositions(av,ap){
 for(const k of CHAMPS_MJ)if(!pareil(av[k],ap[k]))return false;
 if(!pareil(av.doors,ap.doors))return false;
 const A=av.actors||{},B=ap.actors||{},ids=Object.keys(B);
 if(ids.length!==Object.keys(A).length)return false;
 for(const id of ids){const a=A[id],b=B[id];if(!a||!b)return false;
  for(const k of CHAMPS_VIVANTS){if(k==='x'||k==='y')continue;if(!pareil(a[k],b[k]))return false}}
 return true}
function glisserDistant(d,force){const B=d.actors||{};let bouge=false;
 Object.entries(B).forEach(([id,e])=>{const a=actors.find(x=>x.id===id);
  if(!a||window.socleEnMain===id||typeof e.x!=='number'||typeof e.y!=='number')return;
  // Ce qui revient tel qu'on l'a envoyé n'apprend rien : le local est plus récent.
  const r=dernierPousse&&dernierPousse.actors&&dernierPousse.actors[id];
  if(r&&r.x===e.x&&r.y===e.y)return;
  if(r){r.x=e.x;r.y=e.y}
  const v=positionVraie(a);if(v.x===e.x&&v.y===e.y)return;
  glisseVers(a,e.x,e.y);bouge=true});
 if(bouge||force)planifieRenduComplet()}
/* Le rendu complet attend la fin du geste local : un rendu détruirait le socle tenu. */
/* Prendre ce qui est au sol se joue sur la table, d'un seul coup : une transaction relit l'état du sol tel que le serveur le
   tient, et ne marque la chose prise que si personne ne l'a prise avant. « marque » reçoit le tableau des portes et objets du
   document et rend le tableau marqué, ou null si c'est déjà pris. Rend vrai si la prise est à nous ; hors ligne, toujours vrai.
   Un MJ et un joueur qui ramassent la même torche au même instant : un seul l'a. */
function reserveSurTable(marque){if(!enLigne||!salleRef)return Promise.resolve(true);
 return salleRef.firestore.runTransaction(async tx=>{const s=await tx.get(salleRef),d=s.exists?s.data():null;
  const neuf=marque(Array.isArray(d&&d.doors)?d.doors.slice():[]);if(!neuf)return false;
  tx.update(salleRef,{doors:neuf,at:firebase.firestore.FieldValue.serverTimestamp()});return true}).catch(e=>{console.warn('Prise refusée',e);return false})}
// Les adversaires révélés que le dernier document reçu dit encore debout : la fin du combat les attend.
function adversairesDeboutTable(){if(!enLigne||!dernierDoc||!dernierDoc.actors)return 0;
 return Object.entries(dernierDoc.actors).filter(([id,e])=>{const a=actors.find(x=>x&&x.id===id);
  return a&&e&&campDe(a)==='adverse'&&!a.orbeStatique&&(e.vu===true||a.vu)&&Number(e.hp)>0}).length}
function planifieRenduComplet(){clearTimeout(renduDiffere);
 renduDiffere=setTimeout(()=>{if(window.socleEnMain||glissements.size){planifieRenduComplet();return}
  if(dernierDoc)appliquerSalle(dernierDoc,true)},220)}

/* Un combattant que l'on ne connaît pas encore : on le rebâtit depuis le bestiaire publié,
   et à défaut depuis ce que l'état vivant en dit. Son identifiant est celui de la table. */
function instancierActeur(id,e){
 let a=null;
 if(e.template&&typeof fromMonster==='function'){
  const m=(catalog.monsters||[]).find(x=>x.id===e.template);
  if(m)a=fromMonster(m)}
 if(!a)a={...baseActor(e.hero===true)};
 a.id=id;normalizeActor(a);return a}
/* Les instantanés arrivent en rafale — quatre joueurs, l'écho de nos propres envois — et
   chacun redessinait toute la table. On n'applique que le dernier reçu, un instant plus
   tard : une rafale ne coûte qu'une application. */
let applicationTimer=null;const imagesRattrapees=new WeakSet();
/* v1.010 : un onglet caché ne retarde rien — le navigateur y ralentit les minuteries jusqu'à une par minute ; le document
   s'applique alors dès qu'il arrive. C'est là que le MJ révèle, lance et termine le combat pour toute la table. */
function programmerApplication(){if(typeof document!=='undefined'&&document.hidden){clearTimeout(applicationTimer);applicationTimer=null;if(dernierDoc){appliquerSalle(dernierDoc);majTable()}return}
 if(applicationTimer)return;
 applicationTimer=setTimeout(()=>{applicationTimer=null;if(dernierDoc){appliquerSalle(dernierDoc);majTable()}},40)}
/* Chez le MJ, ce que les joueurs ont déposé sur leur aventurier pour la réserve — une conversion
   à la tannerie, une fabrication — y est versé dès réception, une seule fois (recueilleDepots). */
function appliquerSalle(d,complet){appliquerSalleSeule(d,complet);if(d&&estMJ()&&typeof recueilleDepots==='function')recueilleDepots();
 // v1.010 : chez le MJ, à chaque document reçu, le combat se juge — commencer, finir — sans attendre une minuterie.
 if(d&&estMJ()&&typeof veilleCombat==='function')veilleCombat();
 // v1.010 : la fenêtre du Coffre de Groupe montre aussitôt ce que les autres y font.
 if(typeof coffreGroupeDialog!=='undefined'&&coffreGroupeDialog.open&&typeof dessineCoffreGroupe==='function')dessineCoffreGroupe()}
function appliquerSalleSeule(d,complet){if(!d)return;
 /* Seules des positions ont bougé, ou un socle est sous le doigt ici : les socles glissent,
    le rendu complet attend la fin du geste. */
 /* Le combat qui commence ou finit chez le MJ interrompt le geste en cours ici, et s'applique aussitôt. */
 const basculeMode=!estMJ()&&modeConnu&&(d.mode==='combat'||d.mode==='exploration')&&d.mode!==mode;
 if(basculeMode&&typeof interromptGestes==='function')interromptGestes();
 const enGeste=!!window.socleEnMain;
 if(!complet&&!basculeMode&&poussePret&&docPrecedent&&(enGeste||seulementPositions(docPrecedent,d))){docPrecedent=d;glisserDistant(d,enGeste);return}
 docPrecedent=d;clearTimeout(renduDiffere);
 // L'état d'avant, pour ne redessiner que si le document a changé quelque chose ici.
 const avant=JSON.stringify(etatVivant());
 appliquantDistant=true;let base=null,carteNeuve=false,tourChange=false,combatExige=false;const aGlisser=[];
 try{
  // Ce que le joueur connaissait avant ce document : le bandeau d'un nouveau tour, ou d'un combat qui a recommencé, s'en déduit.
  const avantIci={connu:modeConnu,mode,round,cb:typeof numeroCombat!=='undefined'?numeroCombat:0};
  const cb=d.fogReset&&Number.isFinite(d.fogReset.cb)?d.fogReset.cb:null;
  // Un joueur prend le numéro du combat du MJ ; le MJ qui revient à la table reprend le sien là où il en était.
  if(cb!==null&&typeof numeroCombat!=='undefined'&&(!estMJ()||cb>numeroCombat))numeroCombat=cb;
  if(!estMJ()&&((Number.isFinite(d.round)&&d.round!==round)||((d.mode==='combat'||d.mode==='exploration')&&d.mode!==mode)))tourChange=true;
  if(!estMJ()){
   if(Number.isFinite(d.round))round=d.round;
   if(d.mode==='combat'||d.mode==='exploration'){const avant=mode;mode=d.mode;
    // Le combat qui commence ou finit chez le MJ s'annonce ici aussi, du même bandeau ; pas à l'arrivée à la table.
    if(modeConnu&&avant!==mode&&typeof annonceFlottante==='function')annonceFlottante(mode==='combat'?'⚔ Début du combat !':'🕊 Fin du combat');modeConnu=true}
   // L'onglet où le MJ envoie la troupe : chaque envoi porte son instant ; celui qu'on trouve en arrivant ne compte pas.
   {const pn=d.fogReset&&typeof d.fogReset.pn==='number'?d.fogReset.pn:null;
    if(ongletConnu&&pn!==null&&pn!==ongletVu&&typeof showPage==='function')showPage(String(d.fogReset.page||'table'));ongletVu=pn;ongletConnu=true}
   /* Une version plus récente chez le MJ : la page du joueur se recharge, une fois par version, pour prendre le code à jour —
      ses correctifs compris. */
   {const v=d.fogReset&&typeof d.fogReset.v==='string'?d.fogReset.v:'';
    if(v&&typeof IMG_V==='string'&&parseFloat(v)>parseFloat(IMG_V)){let deja='';try{deja=sessionStorage.getItem('amertume-recharge')||''}catch(e){}
     if(deja!==v){try{sessionStorage.setItem('amertume-recharge',v)}catch(e){}const u=new URL(location.href);u.searchParams.set('v',v);location.replace(u.toString())}}}
   // Les onglets que le MJ ouvre aux joueurs, tels qu'il les a cochés à l'instant.
   if(d.fogReset&&Array.isArray(d.fogReset.ong)&&typeof catalog!=='undefined'&&catalog&&typeof ONGLETS!=='undefined'){
    const l=d.fogReset.ong.filter(k=>typeof k==='string'&&ONGLETS.some(([x])=>x===k));
    if(!pareil(catalog.ongletsJoueurs,l)){catalog.ongletsJoueurs=l;if(typeof majOnglets==='function')majOnglets()}}
   {const dn=d.fogReset&&typeof d.fogReset.dn==='number'?d.fogReset.dn:null;
    if(donjonConnu&&dn!==null&&dn!==donjonVu&&typeof annonceFlottante==='function')annonceFlottante('🏆 Donjon Terminé !','annonce-victoire');donjonVu=dn;donjonConnu=true}
   if(typeof d.locked==='boolean')tokensLocked=d.locked;
   if(typeof d.title==='string'&&typeof sceneTitle==='function')sceneTitle(d.title);
   // Sans carte chez le MJ, aucune chez le joueur : ni un paysage refermé, ni une carte d'une vieille copie de son navigateur.
   if(!d.mapId&&currentMapId){carteNeuve=true;currentMapId=null;mapImage=null;$('map-view').style.backgroundImage='';$('map').classList.remove('custom')}
   if(d.mapId&&d.mapId!==currentMapId&&maps.some(m=>m.id===d.mapId)){carteNeuve=true;
    currentMapId=d.mapId;const m=currentMap();mapImage=m&&m.image||null;
    $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';
    $('map').classList.toggle('custom',!!mapImage)}
   // Le voile levé et la remise à zéro du brouillard viennent du MJ.
   if(d.fogReset&&typeof d.fogReset==='object'&&typeof mouvementLimiteExplo!=='undefined')mouvementLimiteExplo=d.fogReset.limite===true;
   if(d.fogReset&&typeof d.fogReset==='object'&&typeof bruitCoupe!=='undefined')bruitCoupe=d.fogReset.bruitOff===true;
   const m0=typeof currentMap==='function'?currentMap():null;
   if(m0&&typeof d.fogOff==='boolean'&&!!m0.fogOff!==d.fogOff){m0.fogOff=d.fogOff;if(typeof fogKey!=='undefined')fogKey=''}
   // L'obscurité que le MJ désactive l'est ici aussi.
   if(m0&&d.fogReset&&typeof d.fogReset==='object'){const off=d.fogReset.noirOff===true;
    if(!!m0.obscuriteOff!==off){if(off)m0.obscuriteOff=true;else delete m0.obscuriteOff;if(typeof fogKey!=='undefined')fogKey=''}}
   if(d.fogReset&&typeof d.fogReset.n==='number'&&typeof brouillardReset!=='undefined'&&d.fogReset.n!==brouillardReset.n){
    brouillardReset={n:d.fogReset.n,tout:!!d.fogReset.tout};
    // À l'arrivée à la table, la dernière remise à zéro du MJ est déjà passée : elle ne se rejoue pas, sauf un voile levé partout.
    if(m0&&typeof resetFog==='function'&&(brouillardConnu||brouillardReset.tout))resetFog(brouillardReset.tout,true)}
   // Le numéro connu, la mémoire d'exploration gardée sur l'appareil se relit.
   if(!brouillardConnu&&d.fogReset&&typeof d.fogReset.n==='number'){brouillardConnu=true;if(typeof fogSeenSrc!=='undefined'){fogSeenSrc=null;fogKey=''}setTimeout(appliqueBrouillardTable,0)}}
  /* Chez un joueur, en combat d'un document à l'autre : un nouveau combat s'annonce, même sans retour à l'exploration entre les
     deux ; sinon un nouveau tour s'annonce, comme chez le MJ, et ouvre son tour au journal. */
  if(!estMJ()&&avantIci.connu&&avantIci.mode==='combat'&&mode==='combat'&&typeof annonceFlottante==='function'){
   if(typeof numeroCombat!=='undefined'&&numeroCombat!==avantIci.cb)annonceFlottante('⚔ Début du combat !');
   else if(round!==avantIci.round){annonceFlottante('Tour '+round);if(typeof separateurTour==='function')separateurTour($('journal'))}}
  // Le MJ qui revient à la table reprend le numéro des remises à zéro là où il en était : sinon chaque joueur rejouait une remise à zéro.
  if(estMJ()&&d.fogReset&&typeof d.fogReset.n==='number'&&typeof brouillardReset!=='undefined'&&d.fogReset.n>brouillardReset.n)brouillardReset={n:d.fogReset.n,tout:!!d.fogReset.tout};
  const vus=new Set(),aRepousser=[],gardes=[],cibles=[],gardesPieges=[],cleIci=typeof cleTour==='function'?cleTour():null;
  Object.entries(d.actors||{}).forEach(([id,e])=>{if(!e||typeof e!=='object')return;
   vus.add(id);
   let a=actors.find(x=>x.id===id);
   const neuf=!a;if(!a){a=instancierActeur(id,e);actors.push(a)}
   // Ce qu'on tient sous le doigt garde sa place : le réseau ne le reprend pas en main.
   const enMain=window.socleEnMain===id,r=dernierPousse&&dernierPousse.actors&&dernierPousse.actors[id];
   // Sur la même carte, un socle connu qui a bougé ailleurs y glisse ; sa position ne se pose pas d'un coup.
   const glisse=!neuf&&!carteNeuve&&!!docPrecedent&&typeof e.x==='number'&&typeof e.y==='number';
   // Chez le MJ : l'état du tour qu'un joueur a écrit daté d'un autre tour ne passe pas ; le MJ renvoie le sien.
   const jetonAvant=a.imageJeton;
   const perime=estMJ()&&!neuf&&typeof e.tourVu==='string'&&cleIci!==null&&e.tourVu!==cleIci;
   /* Chez le MJ en combat : ce qu'un joueur a écrit en se croyant hors combat, ou dans un combat fini, ne compte pas. Ses pas, ses
      points du tour reviennent tels que le MJ les tient. Un aventurier déplacé sans date est traité de même. */
   const horsCombat=estMJ()&&!neuf&&mode==='combat'&&typeof numeroCombat!=='undefined'
    &&(typeof e.tourVu==='string'?!e.tourVu.startsWith('c'+numeroCombat+'.'):a.hero===true);
   CHAMPS_VIVANTS.forEach(k=>{if(e[k]===undefined)return;
    if(enMain&&(k==='x'||k==='y'))return;
    // Les cibles se comparent par identifiant, telles qu'elles partent : jamais par rang.
    const local=k==='cibles'?ciblesIds(a):k==='x'||k==='y'?positionVraie(a)[k]:a[k];
    /* Ce qui revient tel qu'on l'a envoyé n'apprend rien : un changement local survenu
       depuis est plus récent. On le garde, et la référence retient la valeur reçue pour
       qu'il parte au prochain envoi — sinon il s'y fondait, ne partait jamais, et le
       document suivant l'écrasait (des PV corrigés qui « ne comptaient pas »). */
    if(perime&&CHAMPS_TOUR.includes(k)&&!pareil(local,e[k])){gardes.push([id,k,structuredClone(e[k])]);return}
    if(horsCombat&&(k==='x'||k==='y'||CHAMPS_TOUR.includes(k))&&!pareil(local,e[k])){gardes.push([id,k,structuredClone(e[k])]);return}
    if(r&&pareil(r[k],e[k])&&!pareil(local,e[k])&&!(tourChange&&CHAMPS_TOUR.includes(k))){gardes.push([id,k,structuredClone(e[k])]);return}
    /* Révélé, pour de bon : le MJ ne reprend jamais un « vu » à faux venu du réseau, il le
       renvoie à vrai. Ses propres remises à zéro passent, elles partent de chez lui. */
    if(estMJ()&&CHAMPS_ACTEUR_MJ.includes(k)&&k!=='hidden'&&a[k]===true&&e[k]===false){aRepousser.push([id,k]);return}
    // Le joueur d'un aventurier, chez le MJ : posé à sa création par le joueur, puis par le MJ seul ; un autre changement repart.
    if(estMJ()&&!neuf&&(k==='joueur'||k==='joueurNom')&&!pareil(a[k],e[k])){gardes.push([id,k,structuredClone(e[k])]);return}
    /* v1.010 : un coup d'un joueur sur un adversaire révélé ne compte que dans le combat en cours. Porté hors combat — son écran
       ne savait pas encore le combat commencé —, il est refusé, et le combat commence ; daté d'un autre combat, il est refusé. */
    if(estMJ()&&!neuf&&k==='hp'&&!a.hero&&a.vu&&typeof campDe==='function'&&campDe(a)==='adverse'&&typeof e.hp==='number'&&typeof local==='number'&&e.hp<local&&!(r&&pareil(r[k],e[k]))){
     if(mode!=='combat'){gardes.push([id,k,e.hp]);combatExige=true;return}
     if(typeof e.tourVu==='string'&&typeof numeroCombat!=='undefined'&&!e.tourVu.startsWith('c'+numeroCombat+'.')){gardes.push([id,k,e.hp]);return}}
    // v1.010 : la demande de combat d'un joueur, pour le combat qui suit celui qu'il connaît : une seule fois.
    if(estMJ()&&k==='demandeCombat'&&a.hero&&e[k]&&typeof e[k]==='object'&&!pareil(local,e[k])&&typeof numeroCombat!=='undefined'&&e[k].cb===numeroCombat&&mode!=='combat')combatExige=true;
    if(pareil(local,e[k]))return;
    // Les cibles attendent que toute la scène soit en place : leur combattant peut suivre.
    if(k==='cibles'){cibles.push([a,e[k]]);return}
    if(glisse&&(k==='x'||k==='y')){if(!aGlisser.includes(a))aGlisser.push(a);return}
    if(k==='x'||k==='y')glissements.delete(a.id);
    a[k]=structuredClone(e[k])});
   // Une distance de mouvement rendue aux neuf mètres de tous quitte le document : chez un joueur, elle quitte aussi le socle.
   if(!estMJ()&&!a.hero&&e.mouvement===undefined&&a.mouvement!==undefined)delete a.mouvement;
   // L'image qu'un joueur a donnée à son aventurier : chez qui n'en a pas, elle devient la sienne.
   /* L'image envoyée par la table devient celle de l'aventurier chez qui n'en a pas ; chez un joueur, aussi quand elle change :
      le MJ vient de la lui donner. Le MJ, lui, garde la sienne. */
   if(typeof e.imageJeton==='string'&&(!a.image||(!estMJ()&&e.imageJeton!==jetonAvant)))a.image=e.imageJeton;
   // Chez son joueur, l'image d'un aventurier qui n'est jamais partie (trop lourde, avant la v0.721) repart, allégée.
   if(!estMJ()&&aMoi(a)&&!a.imageJeton&&typeof a.image==='string'&&a.image.startsWith('data:image/')&&!imagesRattrapees.has(a)){imagesRattrapees.add(a);
    imagePourTable(a.image).then(u=>{if(u&&!a.imageJeton){a.imageJeton=u;pousserBientot()}})}
   /* Des coups croisés ont pu passer sous zéro : ici on lit zéro ; chez le MJ, la référence garde le négatif reçu, et le zéro
      repart en valeur pleine. */
   if(typeof a.hp==='number'&&a.hp<0){a.hp=0;if(estMJ()&&typeof e.hp==='number'&&e.hp<0)gardes.push([id,'hp',e.hp])}
   /* Un aventurier qui arrive d'un joueur attend la validation du MJ, quoi que dise le document : un second compte ne fait
      pas entrer un second personnage sans son accord. */
   if(estMJ()&&neuf&&a.hero){a.enAttente=true;if(typeof log==='function')log((a.joueurNom||'Un joueur')+' a créé '+a.name+' : en attente de ta validation, dans l’onglet Aventuriers.',{local:true})}
   normalizeActor(a)});
  cibles.forEach(([a,ids])=>{if(typeof poseCibles==='function')poseCibles(a,indicesDesCibles(ids))});
  // La composition de la scène appartient au MJ : chez les joueurs, ce qui n'y est plus s'en va.
  if(!estMJ())for(let i=actors.length-1;i>=0;i--)if(!vus.has(actors[i].id))actors.splice(i,1);
  const m=typeof currentMap==='function'?currentMap():null;
  if(m&&Array.isArray(d.doors)){(m.doors||[]).forEach((p,i)=>{const v=d.doors[i];if(typeof v==='boolean'){p.open=v;delete p.decouvert;delete p.crochetee}else if(v===2||v===3){p.open=v===3;p.decouvert=true;delete p.crochetee}
    else if(Number.isInteger(v)&&v>=4&&v<=7){p.open=!!(v&1);if(v&2)p.decouvert=true;else delete p.decouvert;p.crochetee=true}});
   {const dg=d.doors.filter(v=>v&&typeof v==='object'&&typeof v.dg==='string').map(v=>v.dg.slice(0,80));if(dg.length)m.dangersDetruits=dg;else delete m.dangersDetruits}
   {const sl=d.doors.filter(v=>v&&typeof v==='object'&&Array.isArray(v.sl)&&v.sl.length===4&&v.sl.every(n=>Number.isFinite(Number(n)))).slice(0,20).map(v=>{const n=v.sl.map(x=>Math.max(0,Math.min(100,Number(x))));return {a:{x:n[0],y:n[1]},b:{x:n[2],y:n[3]}}});
    if(sl.length)m.seuilsSel=sl;else delete m.seuilsSel}
   {const tr=d.doors.filter(v=>v&&typeof v==='object'&&Array.isArray(v.tr)&&v.tr.length>=6&&v.tr.length<=200&&v.tr.length%2===0&&v.tr.every(n=>Number.isFinite(Number(n)))).slice(0,40)
     .map(v=>{const r=[];for(let i=0;i<v.tr.length;i+=2)r.push([Number(v.tr[i]),Number(v.tr[i+1])]);return r});
    if(tr.length)m.dangersTrous=tr;else delete m.dangersTrous}
   const n=(m.doors||[]).length;(m.objets||[]).forEach((o,k)=>{const v=d.doors[n+k];
    if(typeof v==='boolean'){montreObjet(o,v);delete o.pris;delete o.prisN}else if(v===0||v===1||v===2){montreObjet(o,v>=1);if(v===2)o.pris=true;else delete o.pris;delete o.prisN;if(o.indice){delete o.examine;delete o.tente}}
    else if(o.indice&&(v===40||v===41)){montreObjet(o,true);if(v===41){o.examine=true;delete o.tente}else{o.tente=true;delete o.examine}}
    else if(Number.isInteger(v)&&v>16&&v<=36){montreObjet(o,true);delete o.pris;o.prisN=v-16}});
   const n2=n+(m.objets||[]).length;(m.coffres||[]).forEach((c,k)=>{const v=d.doors[n2+k];if(!Number.isInteger(v)||v<0||v>31)return;
    [['revele',1],['deverrouille',2],['desamorce',4],['ouvert',8],['tente',16]].forEach(([cle,b])=>{if(v&b)c[cle]=true;else delete c[cle]})});
   const n3=n2+(m.coffres||[]).length,fixes=(m.lumieres||[]).filter(l=>l&&!l.pose);fixes.forEach((l,k)=>{const v=d.doors[n3+k];if(v===2){l.eteinte=true;l.prise=true}else if(v===1){l.eteinte=true;delete l.prise}else if(v===0){delete l.eteinte;delete l.prise}});
   /* Les lumières posées au sol arrivent en entier, à la suite. Ce qui revient tel qu'on l'a envoyé n'apprend rien : une
      lumière posée ou ramassée ici depuis est plus récente, et reste ; sinon, le sol est celui du document. */
   const auSol=x=>(Array.isArray(x)?x:[]).filter(v=>v&&typeof v==='object'&&typeof v.p==='string'),cle=l=>l.map(v=>[v.p,v.n,v.x,v.y,v.r,v.o].join('|')).join(';');
   const recues=auSol(d.doors),ici=(m.lumieres||[]).filter(l=>l&&l.pose),cleIci=cle(ici.map(lumiereAuSol)),cleRecue=cle(recues);
   const envoyees=dernierPousse?auSol(dernierPousse.doors):null;
   if(cleIci!==cleRecue&&!(envoyees&&cle(envoyees)===cleRecue)){const avant=new Map(ici.map(l=>[l.id,l]));
    m.lumieres=[...fixes,...recues.map(v=>Object.assign(avant.get(v.p)||{},cleanLumiere({id:v.p,nom:v.n,x:v.x,y:v.y,rayon:v.r,items:v.o?[v.o]:[],pose:true})))]}
   /* L'état des pièges, chacun retrouvé par son identifiant. Ce qui revient tel qu'on l'a envoyé n'apprend rien : un piège parti
      ou désamorcé ici depuis est plus récent ; il reste, et part au prochain envoi. */
   const envoyes=dernierPousse&&Array.isArray(dernierPousse.doors)?dernierPousse.doors:[];
   d.doors.forEach(v=>{if(!v||typeof v!=='object'||typeof v.t!=='string')return;const p=(m.pieges||[]).find(x=>x&&x.id===v.t);if(!p)return;const e=Number(v.e)||0;
    const r=envoyes.find(x=>x&&typeof x==='object'&&x.t===v.t);if(r&&(Number(r.e)||0)===e&&drapeauxPiege(p)!==e){gardesPieges.push([v.t,e]);return}
    [['revele',1],['declenche',2],['desamorce',4],['rate',8]].forEach(([k,b])=>{if(e&b)p[k]=true;else delete p[k]})})}
  if(selected!==null&&!actors[selected])selected=null;
  if(monSiege){const i=actors.findIndex(a=>a.id===monSiege);if(i>=0&&(estMJ()||aMoi(actors[i])))owner=i}
  if(typeof marked!=='undefined')marked=new Set([...marked].filter(id=>actors.some(a=>a.id===id)));
  $('round').textContent=String(round).padStart(2,'0');
  /* Ce qui est reçu devient la référence AVANT le rendu : ce que le rendu ajoute (une
     révélation chez le MJ) est alors une différence, et part. Prise après, elle s'y
     fondait et n'arrivait jamais en face. */
  // Les glissements partent avant la référence : ce qui part d'ici ensuite porte déjà les positions reçues.
  aGlisser.forEach(a=>{const e=d.actors[a.id];glisseVers(a,e.x,e.y)});
  base=etatVivant();
  const change=complet||JSON.stringify(base)!==avant;
  /* Chez le MJ, ce que le document ne porte pas encore — un champ qu'une version plus récente fait voyager, comme l'XP — n'est
     pas tenu pour envoyé : il part au prochain envoi, même s'il n'a pas bougé ici depuis. Sans cela, une XP remise à zéro
     avant que le champ voyage restait chez les joueurs à sa vieille valeur. */
  if(estMJ())Object.entries(base.actors).forEach(([id,e])=>{const recu=d.actors&&d.actors[id];if(!recu){delete base.actors[id];return}
   CHAMPS_VIVANTS.forEach(k=>{if(recu[k]===undefined&&e[k]!==undefined)delete e[k]})});
  aRepousser.forEach(([id,k])=>{if(base.actors[id])base.actors[id][k]=false});
  gardes.forEach(([id,k,v])=>{if(base.actors[id])base.actors[id][k]=v});
  gardesPieges.forEach(([t,e])=>{const x=(base.doors||[]).find(y=>y&&typeof y==='object'&&y.t===t);if(x)x.e=e});
  // L'écho de notre propre envoi n'a rien changé : pas de rendu pour rien.
  if(change){render();rafraichitFiches()}
  // v1.010 : un coup ou une demande venus d'un joueur hors combat : le combat commence chez tous.
  if(combatExige&&estMJ()&&mode!=='combat'&&typeof basculerMode==='function')queueMicrotask(()=>{if(!enCombat())basculerMode('combat',true)});
  // Une carte neuve ouverte par le MJ se montre toute entière, à 100 %, chez chaque joueur aussi.
  if(carteNeuve&&typeof resetMapZoom==='function')setTimeout(resetMapZoom,0);
 }finally{appliquantDistant=false;dernierPousse=base||etatVivant();poussePret=true;pousserPlusTard();
  /* Le premier état de la table posé, le voile d'arrivée tombe : la carte qui paraît est la bonne. Pas tant que la carte de la
     table manque encore ici : l'ancienne resterait à l'écran jusqu'au contenu publié, qui l'apporte et fait réappliquer la table. */
  if(!(d.mapId&&d.mapId!==currentMapId))document.body.classList.remove('table-attendue')}}

/* L'onglet Aventuriers et l'arbre de talents, s'ils sont ouverts, se redessinent sur ce qui arrive : un équipement ôté, un
   talent appris ailleurs se voient ici aussi. Pas sous la main de qui s'en sert : un champ en saisie, un glissement, une
   pression tenue attendent d'être finis. */
let fichesTimer=null,pressionTenue=false;
addEventListener('pointerdown',()=>{pressionTenue=true},true);
['pointerup','pointercancel'].forEach(t=>addEventListener(t,()=>{pressionTenue=false},true));
function rafraichitFiches(){clearTimeout(fichesTimer);fichesTimer=setTimeout(function encore(){
 if(pressionTenue||(typeof champsOuverts!=='undefined'&&champsOuverts>0)||(typeof arbreGlisse!=='undefined'&&arbreGlisse)){fichesTimer=setTimeout(encore,250);return}
 if(document.body.classList.contains('page-heroes')&&typeof renderHeroes==='function')renderHeroes();
 // L'Accueil aussi : un aventurier qu'un joueur vient de créer y paraît sans recharger la page.
 if(document.body.classList.contains('page-accueil')&&typeof renderAccueil==='function')renderAccueil();
 if(typeof arbresDialog!=='undefined'&&arbresDialog.open&&typeof renderArbres==='function')renderArbres()},60)}
/* Le contenu publié vient d'être posé : il a remplacé les fiches et les cartes, donc
   l'état vivant doit être reposé par-dessus, sans quoi la table reculerait d'un cran. */
function reappliquerTable(){if(dernierDoc){dernierPousse=null;appliquerSalle(dernierDoc,true)}}
/* ---------- Le journal partagé ----------
   Chaque ligne part vers la table en texte et en chiffres, jamais en balisage : l'autre
   côté la rebâtit avec ses propres fonctions, et rien de ce qui arrive n'est posé tel
   quel dans la page. Les lignes propres à l'appareil (sauvegarde, imports) restent chez
   elles. Qui rejoint la table reçoit les dernières lignes, à la place de son journal. */
const CLES_JOURNAL=['t','de','tour','genre','texte','badge','logo','a','b','corps','detail','suite','effet','ton'];
const logLocal=log,logAttaqueLocal=logAttaque,logChatLocal=logChat,viderJournalLocal=viderJournal;
// Firestore refuse les tableaux imbriqués : un dé [valeur, couleur] devient un seul nombre.
function codeDes(dice){return (dice||[]).map(([v,c])=>v*8+c)}
function decodeDes(des){return (des||[]).map(x=>[Math.floor(x/8),x%8])}
function fiche(o){return {id:o&&o.id||null,name:String(o&&o.name||'?').slice(0,60),hero:!!(o&&o.hero)}}
function acteurDuJournal(f){return (f&&f.id&&actors.find(x=>x.id===f.id))||{name:String(f&&f.name||'?'),hero:!!(f&&f.hero)}}
function idJournal(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function diffuser(rec){if(!enLigne||!journalRef||!monUid||sasEnAttente())return;
 const id=idJournal();journalVus.add(id);const ref=journalRef.doc(id),plein={t:Date.now(),de:monUid,tour:round,...rec};
 ref.set(plein).catch(e=>{
  // Une règle qui ignore encore « ton » refuse la ligne : elle repart sans sa couleur.
  if('ton' in plein&&/permission|insufficient/i.test(String(e&&e.code)+' '+String(e&&e.message))){
   const sans={...plein};delete sans.ton;return ref.set(sans).catch(e2=>liveStatus('Journal non partagé. '+liveErreur(e2)))}
  liveStatus('Journal non partagé. '+liveErreur(e))})}
log=function(text,meta){logLocal(text,meta);if(meta&&meta.local)return;
 // Les sources d'un butin partent avec la ligne, à côté du bilan d'un combat : les règles du journal admettent déjà « detail ».
 const detail={...(meta&&meta.bilan?{bilan:meta.bilan}:{}),...(meta&&Array.isArray(meta.sources)?{sources:meta.sources.slice(0,20)}:{})};
 diffuser({genre:'texte',texte:String(text).slice(0,400),badge:meta&&meta.badge?String(meta.badge).slice(0,40):null,ton:meta&&meta.ton?String(meta.ton).slice(0,20):null,...(Object.keys(detail).length?{detail}:{})})};
// « talent » ne colore que la ligne locale ; elle part sans lui, les règles du journal ne le connaissent pas.
logAttaque=function(a,b,logo,corps,detail,suite,talent){logAttaqueLocal(a,b,logo,corps,detail,suite,talent);
 const d=detail?{des:codeDes(detail.dice),origine:Number.isInteger(detail.origine)?detail.origine:null,
  faille:Number.isInteger(detail.faille)?detail.faille:null,...(Array.isArray(detail.plasma)?{plasma:detail.plasma.slice(0,6).map(v=>Math.trunc(Number(v))||0)}:{}),bonus:detail.bonus||0,saignee:detail.saignee||0,def:Number.isInteger(detail.def)?detail.def:null,solidite:!!detail.solidite,double:!!detail.double,total:detail.total||0}:null;
 diffuser({genre:'attaque',a:fiche(a),b:fiche(b),logo:logo?String(logo).slice(0,40):null,corps:String(corps).slice(0,60),detail:d,suite:suite?String(suite).slice(0,200):null})};
/* Les mots qui montent au-dessus des socles — dégâts, Gardé, Échec, Révélé — se voient sur toutes les tables : l'appareil
   qui agit les envoie avec le journal, comme les effets. Ce qui se calcule en appliquant la table reçue reste chez soi, et un
   refus (« Plus de Mouvement ») ne regarde que celui qui l'essuie : quatrième argument. */
const floatNumberLocal=floatNumber;
floatNumber=function(cible,texte,genre,seul){floatNumberLocal(cible,texte,genre);
 if(seul||appliquantDistant||!enLigne||!cible||texte===undefined||texte===null)return;
 const rec={genre:'effet',effet:'flottant',texte:String(texte).slice(0,60),logo:genre?String(genre).slice(0,20):null};
 if(cible.id&&actors.includes(cible))rec.a=fiche(cible);
 else if(Number.isFinite(cible.x)&&Number.isFinite(cible.y)){rec.a=null;rec.detail={x:+cible.x.toFixed(2),y:+cible.y.toFixed(2),...(typeof cible.socle==='string'?{socle:cible.socle.slice(0,12)}:{})}}
 else return;
 diffuser(rec)};
// À l'arrivée : un socle que la troupe ne voit pas ne parle pas chez un joueur.
function flottantRecu(rec){const texte=String(rec.texte||'').slice(0,60);if(!texte)return;
 const genre=['perte','gain','nul'].includes(rec.logo)?rec.logo:'perte';
 if(rec.a&&rec.a.id){const a=actors.find(x=>x.id===rec.a.id);if(!a)return;
  if(!estMJ()){const el=document.querySelector('#map-view .token:not(.lumiere)[data-id="'+CSS.escape(a.id)+'"]');
   if(!el||el.hidden||['unseen','veiled','hors-carte','cachemj'].some(c=>el.classList.contains(c)))return}
  floatNumberLocal(a,texte,genre);return}
 const d=rec.detail;if(d&&typeof d==='object'&&Number.isFinite(d.x)&&Number.isFinite(d.y))floatNumberLocal({x:d.x,y:d.y,socle:typeof d.socle==='string'?d.socle:'medium'},texte,genre)}
// Un ping part à toute la table, en direct, comme un effet : son point en pour cent, et s'il vient du MJ.
function diffuserPing(x,y,mj){diffuser({genre:'effet',effet:'ping',a:null,b:null,logo:mj?'mj':'joueur',detail:{x:+x.toFixed(2),y:+y.toFixed(2)}})}
function diffuserEffet(type,a,b,couleur){diffuser({genre:'effet',effet:String(type).slice(0,20),a:fiche(a),b:fiche(b),logo:couleur?String(couleur).slice(0,20):null})}
// Une parole part avec la fiche de qui parle ; le MJ se reconnaît à son identifiant, pas à son nom.
logChat=function(qui,texte){logChatLocal(qui,texte);
 diffuser({genre:'texte',texte:String(texte).slice(0,400),a:qui&&qui.mj?{id:null,name:'MJ',hero:false}:fiche(qui),ton:'chat'})};
viderJournal=function(){viderJournalLocal();if(!enLigne||!estMJ()||!journalRef)return;
 diffuser({genre:'effet',effet:'vider',a:null,b:null,logo:null});balayerJournal()};
// Une nouvelle session : le journal se vide partout, sa marque reste à la table, et rien d'avant elle ne se rejoue.
nouvelleSession=function(){viderJournalLocal();if(!enLigne||!estMJ()||!journalRef)return;diffuser({genre:'effet',effet:'session',a:null,b:null,logo:null})};
// Le MJ balaie les lignes de la table : qui rejoint ensuite ne rejoue rien.
async function balayerJournal(){try{let lot;do{lot=await journalRef.limit(200).get();if(!lot.size)break;
  const b=cloud.batch();lot.forEach(d=>b.delete(d.ref));await b.commit()}while(lot.size===200)}catch(e){}}
function poserLigne(rec){if(!rec||typeof rec!=='object')return;
 const duMJ=!!(dernierDoc&&rec.de&&rec.de===dernierDoc.mj);
 if(rec.genre==='texte'&&rec.a&&typeof rec.a==='object'){const f=rec.a;
  const qui=f.id?acteurDuJournal(f):{name:duMJ&&f.name==='MJ'?'MJ':String(f.name||'?').slice(0,60),mj:duMJ&&f.name==='MJ'};
  logChatLocal(qui,String(rec.texte||''));return}
 // Un effet ne s'écrit pas : il se joue, et seulement en direct.
 if(rec.genre==='effet'){if((rec.effet==='vider'||rec.effet==='session')&&duMJ)viderJournalLocal();
  else if(rec.effet==='orbe'&&typeof volOrbe==='function'){const [couleur,etat]=(typeof rec.logo==='string'?rec.logo:'').split('|');
   volOrbe(acteurDuJournal(rec.a),acteurDuJournal(rec.b),couleur||'',etat||'')}
  else if(rec.effet==='flottant')flottantRecu(rec);
  else if(rec.effet==='ping'&&typeof pingCarte==='function'&&rec.detail&&typeof rec.detail==='object')pingCarte(Number(rec.detail.x),Number(rec.detail.y),rec.logo==='mj');
  else if(rec.effet==='intervention'&&typeof interventionRecue==='function')interventionRecue(rec);
  else if(rec.effet==='plasma'&&typeof billesPlasma==='function')billesPlasma(acteurDuJournal(rec.a),Number(rec.logo)||1,false);
  else if(rec.effet==='fleche'&&typeof volFleche==='function')volFleche(acteurDuJournal(rec.a),acteurDuJournal(rec.b));
  else if(rec.effet==='balayage'&&typeof coupDeToken==='function')coupDeToken(acteurDuJournal(rec.a),acteurDuJournal(rec.b));
  else if(rec.effet==='choc'&&typeof chocImpact==='function'){const [x,y]=(typeof rec.logo==='string'?rec.logo:'').split('|').map(Number);
   chocImpact(acteurDuJournal(rec.a),acteurDuJournal(rec.b),170,Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null)}
  else if(rec.effet==='piege'&&typeof explosionPiege==='function'){const m=typeof currentMap==='function'?currentMap():null,c=m&&(m.coffres||[])[Number(rec.logo)];if(c)explosionPiege(centreForme(c))}
  else if(rec.effet==='piegecarte'&&typeof explosionPiege==='function'){const m=typeof currentMap==='function'?currentMap():null,p=m&&(m.pieges||[])[Number(rec.logo)];if(p)explosionPiege(centrePiege(p))}return}
 if(rec.genre==='attaque'){const r=rec.detail&&typeof rec.detail==='object'?rec.detail:null;
  const d=r?{...(Array.isArray(r.plasma)?{plasma:r.plasma.slice(0,6)}:{}),dice:decodeDes(Array.isArray(r.des)?r.des:[]),origine:r.origine,faille:r.faille,bonus:r.bonus,saignee:r.saignee,def:Number.isInteger(r.def)?r.def:null,solidite:!!r.solidite,double:!!r.double,total:r.total}:null;
  logAttaqueLocal(acteurDuJournal(rec.a),acteurDuJournal(rec.b),typeof rec.logo==='string'?rec.logo:'',String(rec.corps||''),d,rec.suite?String(rec.suite):'')}
 else logLocal(String(rec.texte||''),{badge:rec.badge?String(rec.badge):undefined,ton:typeof rec.ton==='string'?rec.ton:undefined,bilan:rec.detail&&typeof rec.detail==='object'&&rec.detail.bilan||undefined,
  sources:rec.detail&&typeof rec.detail==='object'&&Array.isArray(rec.detail.sources)?rec.detail.sources:undefined})}
function rejouerJournal(docs){const j=$('journal');if(!j)return;j.replaceChildren();let tour=null;journalRejoue=true;try{rejouerJournalSeul(docs,j,tour)}finally{journalRejoue=false}}
function rejouerJournalSeul(docs,j,tour){
 // Seule la session en cours se rejoue : les combats d'un autre soir restent dans le passé.
 if(typeof debutSession==='function')docs=docs.slice(debutSession(docs.map(d=>d.data())));
 // Ni ce qui précède la dernière session ouverte, ou le dernier journal vidé, par le MJ.
 {const k=docs.map(d=>d.data()).findLastIndex(r=>r&&r.genre==='effet'&&(r.effet==='session'||r.effet==='vider')&&(!dernierDoc||!dernierDoc.mj||r.de===dernierDoc.mj));if(k>=0)docs=docs.slice(k+1)}
 docs.forEach(d=>{const rec=d.data();if(!rec||rec.genre==='effet')return;
  if(rec.tour!==tour){tour=rec.tour;const sep=document.createElement('li');sep.className='j-turn';
   const t=document.createElement('span');t.textContent='Tour '+tour;sep.append(t);j.append(sep)}
  logRound=round;poserLigne(rec)});
 // La prochaine ligne locale rouvre un tour si le journal reçu s'arrête avant le tour en cours.
 logRound=tour===round?round:null}
function ecouterJournal(){journalPremier=true;
 quitteJournal=journalRef.orderBy('t').limitToLast(60).onSnapshot(s=>{
  if(journalPremier){journalPremier=false;const docs=s.docs.filter(d=>!journalVus.has(d.id));
   if(docs.length){docs.forEach(d=>journalVus.add(d.id));rejouerJournal(docs)}return}
  s.docChanges().forEach(ch=>{if(ch.type!=='added'||journalVus.has(ch.doc.id))return;
   journalVus.add(ch.doc.id);poserLigneEnDirect(ch.doc.data())})},()=>{})}
/* Chez un joueur, une ligne du MJ arrive souvent avant l'état de la table qui la suit : elle se range sous le tour où le MJ l'a
   écrite, et non sous celui que la page connaît encore. « Le combat commence » ouvre son tour 1 ; « Fin du combat » n'en ouvre aucun. */
function poserLigneEnDirect(rec){if(estMJ()||!rec||typeof rec!=='object'||rec.genre==='effet'||!Number.isFinite(rec.tour)){poserLigne(rec);return}
 const texte=rec.genre==='texte'&&!rec.a?String(rec.texte||''):'',debut=texte==='⚔ Le combat commence.',fin=/^Fin du combat/.test(texte);
 if(!debut&&!fin&&!enCombat()){poserLigne(rec);return}
 const r0=round,m0=mode;if(debut){mode='combat';logRound=null}else if(fin)mode='exploration';else round=rec.tour;
 try{poserLigne(rec)}finally{round=r0;mode=m0}}

/* ---------- Les joueurs connectés ----------
   Un joueur à la table renouvelle sa présence toutes les trente secondes : il compte comme connecté tant qu'elle date de moins
   de soixante-quinze. Quitter la table efface son siège ; fermer la page date sa présence d'avant, et il sort de la liste.
   Sous son pseudo, l'aventurier qu'il incarne, quand on a le droit de le voir. */
const PRESENCE_MS=30000,PRESENCE_MAX=75000;let presenceTimer=null;
function joueursConnectes(){const now=Date.now();
 return Object.entries(sieges).filter(([uid,s])=>{if(!s||typeof s.nom!=='string'||!s.nom.trim()||bannis[uid])return false;
  const t=s.at&&typeof s.at.toMillis==='function'?s.at.toMillis():null;return t===null||now-t<PRESENCE_MAX})
  .map(([uid,s])=>({uid,nom:s.nom.trim().slice(0,30),heros:actors.find(a=>a&&a.id===s.actorId)||null})).sort((x,y)=>x.nom.localeCompare(y.nom,'fr'))}
function renderJoueursConnectes(){const l=tableId?joueursConnectes():[];
 const b=$('open-joueurs');if(b){const n=b.querySelector('.compte');if(n)n.textContent=l.length?String(l.length):''}
 ['accueil-joueurs','joueurs-liste'].forEach(id=>remplitJoueurs($(id),l))}
function remplitJoueurs(boite,l){if(!boite)return;boite.replaceChildren();
  if(!l.length){const p=document.createElement('p');p.className='muted';p.textContent='Aucun joueur connecté.';boite.append(p);return}
  l.forEach(j=>{const c=document.createElement('div');c.className='joueur-connecte';const h=j.heros&&voitAventurier(j.heros)?j.heros:null;
   const av=document.createElement('span');av.className='joueur-avatar';
   if(h&&h.image){const im=document.createElement('img');im.src=h.image;im.alt='';av.append(im)}else av.textContent=j.nom.charAt(0).toUpperCase();
   const t=document.createElement('div');t.className='joueur-texte';const n=document.createElement('b');n.textContent=j.nom;t.append(n);
   if(h){const s=document.createElement('small');s.textContent=h.name;t.append(s)}
   const point=document.createElement('i');point.className='point-connecte';point.setAttribute('aria-hidden','true');c.append(point,av,t);
   // Chez le MJ, dans la liste de l'Accueil et la fenêtre : Exclure, pour tout autre que lui.
   // Un compte qui attend la validation : Accepter, avant Exclure.
   if(boite.id&&estMJ()&&j.uid!==monUid&&admisRef&&!admis[j.uid]){c.classList.add('en-attente');const ok=document.createElement('button');ok.type='button';ok.className='accepter';ok.textContent='Accepter';ok.onclick=()=>admettre(j.uid,j.nom);c.append(ok)}
   if(boite.id&&estMJ()&&j.uid!==monUid){const x=document.createElement('button');x.type='button';x.className='exclure';x.textContent='Exclure';x.onclick=()=>exclureJoueur(j.uid,j.nom);c.append(x)}
   boite.append(c)})}
setInterval(()=>{if(tableId)renderJoueursConnectes()},30000);

/* ---------- Sièges : qui incarne qui ---------- */
function renderSieges(){const boite=$('live-sieges');if(!boite)return;boite.replaceChildren();
 if(tableId&&!estMJ()&&!(typeof remote!=='undefined'&&remote)){const p=document.createElement('p');p.className='muted';
  p.textContent='Le MJ n’a pas encore publié son contenu : fiches, images et cartes arriveront dès qu’il l’aura fait (Partager → Publier mon contenu).';boite.append(p)}
 const troupe=actors.filter(a=>a.hero&&voitAventurier(a));
 if(!troupe.length){const v=document.createElement('p');v.className='muted';
  v.textContent=invitEnLigne()?'Crée ton aventurier depuis l’Accueil.':'Aucun aventurier dans la scène publiée.';boite.append(v);return}
 troupe.forEach(a=>{
  const occupant=Object.entries(sieges).find(([,s])=>s&&s.actorId===a.id);
  const b=document.createElement('button');
  b.className='actor pick-ligne'+(monSiege===a.id?' selected':'');
  const vignette=document.createElement('span');vignette.className='vignette';
  const socle=document.createElement('span');socle.className='avatar';
  if(a.image){const im=document.createElement('img');im.src=a.image;im.alt='';im.draggable=false;socle.append(im)}
  else socle.textContent=(a.name||'?')[0].toUpperCase();
  vignette.append(socle);
  const corps=document.createElement('span');corps.className='actor-body';
  const nom=document.createElement('span');nom.className='actor-nom';
  const t=document.createElement('strong');t.textContent=a.name;nom.append(t);
  const etat=document.createElement('small');
  etat.textContent=occupant?(occupant[0]===monUid?'Tu l’incarnes':'Pris par un autre joueur'):'Libre';
  corps.append(nom,etat);
  const marque=document.createElement('span');marque.className='pick-etat';
  marque.textContent=monSiege===a.id?'✓':occupant?'•':'+';
  b.append(vignette,corps,marque);
  b.disabled=!!occupant&&occupant[0]!==monUid;
  b.onclick=()=>monSiege===a.id?libererSiege():prendreSiege(a);
  boite.append(b)})}
async function prendreSiege(a){if(!siegesRef||!monUid||!tientAventurier(a))return;
 try{await siegesRef.doc(monUid).set({actorId:a.id,nom:pseudoJoueur(),at:firebase.firestore.FieldValue.serverTimestamp()});
  monSiege=a.id;localStorage.setItem(TABLE_CLE+'-siege',a.id);
  const i=actors.findIndex(x=>x.id===a.id);
  if(i>=0){owner=i;selected=i;markOnly(i);$('owner').value=String(i)}
  if(!estMJ()){view='player';$('view').value='player'}
  render();renderSieges();liveStatus('Tu incarnes '+a.name+'.')}
 catch(e){liveStatus('Siège refusé. '+liveErreur(e))}}
// Le pseudo du joueur : celui de son compte.
function pseudoJoueur(){const u=typeof auth!=='undefined'&&auth&&auth.currentUser;return String(u&&u.displayName||'Joueur').trim().slice(0,30)||'Joueur'}
/* Un joueur qui rejoint se signale à la table sous son pseudo, même sans aventurier : le MJ le voit, et peut lui en confier un.
   Le MJ aussi : il paraît parmi les connectés, sous son nom. */
const nomConnecte=()=>{if(!estMJ())return pseudoJoueur();const u=typeof auth!=='undefined'&&auth&&auth.currentUser;return String(u&&u.displayName||'MJ').trim().slice(0,30)||'MJ'};
async function signaleJoueur(){if(!siegesRef||!monUid)return;const ref=siegesRef.doc(monUid),at=firebase.firestore.FieldValue.serverTimestamp();
 try{const d=await ref.get();if(d.exists)await ref.update({nom:nomConnecte(),at});else await ref.set({actorId:'',nom:nomConnecte(),at})}catch(e){}
 // Puis sa présence, toutes les trente secondes, tant qu'il est à la table.
 clearInterval(presenceTimer);presenceTimer=setInterval(()=>{if(!siegesRef||!monUid){clearInterval(presenceTimer);presenceTimer=null;return}
  siegesRef.doc(monUid).update({at:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{})},PRESENCE_MS)}
async function libererSiege(){if(!siegesRef||!monUid)return;
 try{await siegesRef.doc(monUid).set({actorId:'',nom:pseudoJoueur(),at:firebase.firestore.FieldValue.serverTimestamp()});monSiege=null;localStorage.removeItem(TABLE_CLE+'-siege');
  renderSieges();liveStatus('Siège libéré.')}catch(e){liveStatus(liveErreur(e))}}

/* ---------- Ouvrir, rejoindre ---------- */
function lienTable(code){const u=new URL(location.href);u.searchParams.set('table',code);
 u.hash='';return u.toString()}
function codeNeuf(){const lettres='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';
 const r=crypto.getRandomValues(new Uint8Array(10));
 for(const v of r)s+=lettres[v%lettres.length];
 return s.slice(0,5)+'-'+s.slice(5)}
async function ouvrirTable(){if(!cloud||!auth||!auth.currentUser){liveStatus('Connexion Firebase pas encore prête.');return}
 if(!estMJ()){liveStatus('Seul un MJ connecté peut ouvrir une table.');return}
 monUid=auth.currentUser.uid;
 // Sans contenu publié, les joueurs n'auraient ni fiches ni cartes : la table publie d'abord
 // ce qui a changé, et ne s'ouvre pas si la publication échoue.
 if(typeof publishShared==='function'&&typeof publicContent==='function'){
  const b=$('live-open');if(b)b.disabled=true;liveStatus('Publication du contenu pour tes joueurs…');
  try{while(publishing)await new Promise(r=>setTimeout(r,200));await publishShared(false)}finally{if(b)b.disabled=false}
  if(texteStable(publicContent())!==lastPublishedText){
   liveStatus('Table non ouverte : le contenu n’a pas pu être publié. '+$('shared-status').textContent);return}}
 const code=codeNeuf();
 try{await cloud.doc('amertume_online_live/'+code).set({...etatVivant(),
   mj:auth.currentUser.uid,at:firebase.firestore.FieldValue.serverTimestamp()});
  localStorage.setItem(TABLE_CLE,code);brancherTable(code);signaleJoueur();
  liveStatus('Table ouverte. Partage le lien à tes joueurs.')}
 catch(e){liveStatus('Ouverture impossible. '+liveErreur(e))}}
async function fermerTable(){if(!estMJ()||!tableId)return;
 if(!confirm('Fermer la table ? Les joueurs connectés ne verront plus la partie.'))return;
 try{await salleRef.delete()}catch(e){}
 // Les sièges et le journal ne suivent pas le document : on les balaie, sans en faire une affaire.
 for(const col of [siegesRef,journalRef,bannisRef]){if(!col)continue;
  try{let lot;do{lot=await col.limit(200).get();if(!lot.size)break;const b=cloud.batch();lot.forEach(d=>b.delete(d.ref));await b.commit()}while(lot.size===200)}catch(e){}}
 debrancherTable();localStorage.removeItem(TABLE_CLE);liveStatus('Table fermée.')}
function debrancherTable(){document.body.classList.remove('table-attendue');if(quitteAdmis)quitteAdmis();if(quitteMonAdmis)quitteMonAdmis();quitteAdmis=quitteMonAdmis=null;admisRef=null;admis={};admisIci=true;majSas();if(quitteBrouillard)quitteBrouillard();quitteBrouillard=null;brouillardEcoute=null;brouillardTable=null;brouillardsRef=null;brouillardsPousses.clear();clearInterval(presenceTimer);presenceTimer=null;if(quitteSalle)quitteSalle();if(quitteSieges)quitteSieges();if(quitteJournal)quitteJournal();
 if(quitteBannis)quitteBannis();if(quitteMonBan)quitteMonBan();quitteBannis=quitteMonBan=null;bannisRef=null;bannis={};
 quitteSalle=quitteSieges=quitteJournal=null;enLigne=false;poussePret=false;tableId=null;salleRef=siegesRef=journalRef=null;journalVus=new Set();
 modeConnu=ongletConnu=false;ongletVu=null;envoiOnglet=null;donjonConnu=false;donjonVu=null;envoiDonjon=null;brouillardConnu=false;
 sieges={};monSiege=null;majTable();renderJoueursConnectes()}
function brancherTable(code){if(!cloud)return;debrancherTable();
 tableId=code;salleRef=cloud.doc('amertume_online_live/'+code);
 siegesRef=salleRef.collection('seats');journalRef=salleRef.collection('journal');
 enLigne=true;poussePret=false;dernierPousse=null;
 ecouterJournal();
 quitteSalle=salleRef.onSnapshot(doc=>{
  if(!doc.exists){liveStatus('Cette table n’existe plus. Demande un nouveau lien au MJ.');debrancherTable();if(!estMJ())ouvreTable();return}
  dernierDoc=doc.data();programmerApplication()},
  e=>{liveStatus('Écoute interrompue. '+liveErreur(e));if(!estMJ())ouvreTable();
   // Sans écoute, un joueur jouerait sur une table figée, hors combat peut-être : il se rebranche, sauf refus des règles.
   if(!estMJ()&&!(e&&e.code==='permission-denied'))setTimeout(()=>{if(tableId===code)brancherTable(code)},3000)});
 quitteSieges=siegesRef.onSnapshot(s=>{sieges={};s.forEach(d=>sieges[d.id]=d.data());
  const mien=monUid&&sieges[monUid];monSiege=mien?mien.actorId:null;
  if(monSiege){const i=actors.findIndex(a=>a.id===monSiege);if(i>=0&&(estMJ()||aMoi(actors[i])))owner=i}
  renderSieges();renderJoueursConnectes();majTable()},()=>{});
 bannisRef=salleRef.collection('bannis');ecouterBannis();brouillardsRef=salleRef.collection('brouillard');
 admisRef=salleRef.collection('admis');ecouterAdmis();
 majTable()}
function ecouterBannis(){if(!bannisRef)return;
 // Le MJ suit la liste ; un joueur, sa seule inscription : exclu, il quitte la table.
 if(estMJ())quitteBannis=bannisRef.onSnapshot(s=>{bannis={};s.forEach(d=>bannis[d.id]=d.data());renderBannis();renderJoueursConnectes()},()=>{});
 else if(monUid)quitteMonBan=bannisRef.doc(monUid).onSnapshot(d=>{if(d.exists)exclu()},()=>{})}
// Exclu : la table se ferme ici, la page repart sans son lien, et dit pourquoi.
function exclu(){debrancherTable();try{localStorage.removeItem(TABLE_CLE);sessionStorage.setItem('amertume-exclu','1')}catch(e){}
 const u=new URL(location.href);u.searchParams.delete('table');location.replace(u.toString())}
async function exclureJoueur(uid,nom){if(!estMJ()||!bannisRef||!uid||uid===monUid)return;
 if(!confirm('Exclure '+nom+' de la table ? Il ne pourra plus la voir ni y jouer, même en revenant par le lien.'))return;
 try{await bannisRef.doc(uid).set({nom:String(nom||'Joueur').slice(0,30),at:firebase.firestore.FieldValue.serverTimestamp()});
  try{await siegesRef.doc(uid).delete()}catch(e){}if(admisRef)try{await admisRef.doc(uid).delete()}catch(e){}log(nom+' est exclu de la table.',{local:true})}
 catch(e){liveStatus('Exclusion refusée. '+liveErreur(e))}}
async function readmettre(uid){if(!estMJ()||!bannisRef||!uid)return;try{await bannisRef.doc(uid).delete()}catch(e){liveStatus(liveErreur(e))}}
function renderBannis(){const boite=$('live-bannis'),titre=$('live-titre-bannis');if(!boite)return;const l=Object.entries(bannis);
 boite.hidden=titre.hidden=!estMJ()||!l.length;boite.replaceChildren(...l.map(([uid,b])=>{const r=document.createElement('div');r.className='banni';
  const n=document.createElement('span');n.textContent=b&&b.nom||'Joueur';const btn=document.createElement('button');btn.type='button';btn.textContent='Réadmettre';btn.onclick=()=>readmettre(uid);
  r.append(n,btn);return r}))}
/* La fenêtre ne cache plus ses boutons : elle les montre, grisés quand il manque quelque
   chose, et dit lequel. Masquer « Ouvrir une table » tant que le MJ n'était pas reconnu ne
   laissait qu'une fenêtre vide, sans rien à faire ni rien à comprendre. */
// Le MJ envoie toute la troupe connectée sur un onglet.
function signaleDonjon(){if(!estMJ()||!enLigne)return;envoiDonjon=Date.now();pousserPlusTard()}
function envoyerOnglet(p){if(!estMJ()||!enLigne||!p)return;envoiOnglet={page:String(p),pn:Date.now()};pousserPlusTard()}
function majTable(){const ouvert=!!tableId,pret=!!cloud&&typeof firebase!=='undefined';verrouillerInvite();if(typeof majEnvoiOnglet==='function')majEnvoiOnglet();
 const connecte=!!(auth&&auth.currentUser),mj=estMJ();
 // Un joueur n'a que ses options : l'état de la table et la quitter. Le lien, les sièges et qui incarne qui sont au MJ.
 const joueur=invitEnLigne();
 const ligne=$('live-lien');if(ligne){ligne.hidden=!ouvert||joueur;if(ouvert)ligne.value=lienTable(tableId)}
 const montre=(id,vu,off,pourquoi)=>{const e=$(id);if(!e)return;
  e.hidden=!vu;e.disabled=!!off;e.title=off?pourquoi:''};
 montre('live-open',!ouvert,!pret||!mj,
  !pret?'La bibliothèque Firebase n’est pas chargée.'
  :!connecte?'Connecte-toi d’abord avec ton compte MJ.'
  :'Ce compte n’est pas encore autorisé comme MJ.');
 montre('live-login',!ouvert&&!mj,!pret,'La bibliothèque Firebase n’est pas chargée.');
 {const l=$('live-login');if(l)l.textContent=tableVoulue?'Se connecter':'Connexion MJ'}
 montre('live-close',ouvert&&mj,false,'');
 montre('live-quit',ouvert&&!mj,false,'');
 montre('live-copy',ouvert&&!joueur,false,'');
 ['live-sieges','live-titre-sieges'].forEach(id=>{const e=$(id);if(e)e.hidden=!ouvert||joueur});
 const b=$('open-live');if(b){b.classList.toggle('has-news',ouvert);
  b.textContent=joueur?'Options en ligne':ouvert?'Table · '+tableId:'Table en ligne'}
 {const t=document.querySelector('#live-panel .dialog-head h2');if(t)t.textContent=joueur?'Options en ligne':'Table en ligne'}
 const c=$('live-compte');if(c)c.hidden=joueur;if(c)c.textContent=ouvert
  ?Object.keys(sieges).filter(u=>u!==monUid).length+' joueur(s) assis · table '+tableId:'';
 if(ouvert)return;
 liveStatus(!pret?'Firebase ne répond pas : vérifie la connexion, ou un bloqueur qui empêcherait gstatic.com. La partie reste jouable sur cet appareil.'
  :!connecte?'Connecte-toi avec ton compte MJ pour ouvrir une table. Tes joueurs, eux, n’auront rien à créer : le lien suffira.'
  :!mj?'Compte connecté, mais pas encore autorisé comme MJ. Ajoute son identifiant aux administrateurs Firebase — il est écrit dans la fenêtre Partager.'
  :'Prêt. Ouvre une table, puis envoie son lien à tes joueurs.')}

/* ---------- La fenêtre ---------- */
const liveDialog=dialog('live-panel','Table en ligne',
 '<p id="live-status" class="muted" role="status">Table hors ligne : la partie reste sur cet appareil.</p>'
 +'<div class="toolbar"><button id="live-open" hidden>Ouvrir une table</button>'
 +'<button id="live-login" hidden>Connexion MJ</button>'
 +'<button id="live-close" hidden>Fermer la table</button>'
 +'<button id="live-quit" hidden>Quitter la table</button>'
 +'<button id="live-copy" hidden>Copier le lien</button></div>'
 +'<input id="live-lien" readonly hidden aria-label="Lien de la table">'
 +'<p class="muted" id="live-compte"></p>'
 +'<h2 class="sous-titre" id="live-titre-sieges" hidden>Qui incarne qui</h2><div id="live-sieges" hidden></div>'
 +'<h2 class="sous-titre" id="live-titre-bannis" hidden>Exclus</h2><div id="live-bannis" hidden></div>');
// Ce qui coince se montre : une fenêtre fermée ne renseigne personne.
const ouvreTable=()=>{if(!liveDialog.open)liveDialog.showModal()};
const liveButton=document.createElement('button');liveButton.id='open-live';
liveButton.textContent='Table en ligne';liveButton.onclick=()=>{renderSieges();majTable();liveDialog.showModal()};
document.querySelector('.view-controls').append(liveButton);
// À côté, les joueurs connectés : leur nombre sur le bouton, leur liste dans la fenêtre.
const joueursDialog=dialog('joueurs-connectes','Joueurs connectés','<div id="joueurs-liste" class="joueurs-connectes"></div>');
const joueursButton=document.createElement('button');joueursButton.id='open-joueurs';joueursButton.type='button';
joueursButton.append('Joueurs connectés',Object.assign(document.createElement('span'),{className:'compte'}));
joueursButton.onclick=()=>{renderJoueursConnectes();joueursDialog.showModal()};liveButton.after(joueursButton);
// Au survol, la liste paraît en bulle : plus besoin de cliquer.
if(typeof surveille==='function')surveille(joueursButton,()=>{const d=document.createElement('div');d.className='joueurs-connectes joueurs-bulle';
 remplitJoueurs(d,tableId?joueursConnectes():[]);ouvrirBulle(joueursButton,d,'bulle-joueurs')});
$('live-open').onclick=ouvrirTable;
$('live-login').onclick=()=>{if(tableVoulue){demandeCompte();return}const b=$('shared-login');if(b)b.click();
 liveStatus('Fenêtre de connexion Google ouverte…')};
/* ---------- Le compte d'un joueur ----------
   Un compte Amertüme : un pseudo et un mot de passe, sans adresse e-mail — Firebase en garde une, faite du pseudo. Ou Google. */
const compteDialog=dialog('compte-joueur','Rejoindre la table','<form id="compte-form" autocomplete="on"><label>Pseudo<input name="pseudo" maxlength="24" autocomplete="username" required></label>'
 +'<label>Mot de passe<input name="mdp" type="password" minlength="6" autocomplete="current-password"></label>'
 +'<div class="form-actions compte-actions"><button type="button" id="compte-creer">Créer mon compte</button><button type="submit" class="primary">Se connecter</button></div>'
 +'<div class="compte-ou"><button type="button" id="compte-google">Continuer avec Google</button></div><p class="form-error" id="compte-erreur" role="alert"></p></form>');
let compteAttente=[];
const cleCompte=p=>String(p||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const courrielCompte=p=>cleCompte(p)+'@joueurs.amertume-online.example.com';
function erreurCompte(e){const c=String(e&&e.code||'');
 return c==='pseudo'?'Pseudo trop court : trois lettres ou chiffres au moins.':/email-already-in-use/.test(c)?'Ce pseudo est déjà pris.':/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)?'Pseudo ou mot de passe incorrect.'
  :/weak-password/.test(c)?'Mot de passe trop court : six caractères au moins.':/operation-not-allowed/.test(c)?'Ce mode de connexion n’est pas activé dans Firebase.'
  :/popup-closed|cancelled-popup/.test(c)?'':/too-many-requests/.test(c)?'Trop d’essais : patiente un instant.':'Connexion impossible. '+(e&&e.message||'')}
function demandeCompte(){return new Promise(r=>{if(auth&&auth.currentUser&&!auth.currentUser.isAnonymous){r(auth.currentUser);return}
 compteAttente.push(r);$('compte-erreur').textContent='';if(!compteDialog.open)compteDialog.showModal()})}
async function compteFait(pseudo){const u=auth.currentUser;if(!u)return;
 if(pseudo&&(!u.displayName||u.displayName!==pseudo))try{await u.updateProfile({displayName:pseudo})}catch(e){}
 compteDialog.close();const l=compteAttente;compteAttente=[];l.forEach(f=>f(u))}
async function compteAvec(fait){const f=$('compte-form').elements,pseudo=f.pseudo.value.trim();$('compte-erreur').textContent='';
 try{await fait(pseudo,f.mdp.value);await compteFait(pseudo||null)}catch(e){$('compte-erreur').textContent=erreurCompte(e)}}
const pseudoValide=p=>cleCompte(p).length>=3||(()=>{throw {code:'pseudo'}})();
$('compte-form').onsubmit=e=>{e.preventDefault();compteAvec((p,m)=>{pseudoValide(p);return auth.signInWithEmailAndPassword(courrielCompte(p),m)})};
$('compte-creer').onclick=()=>compteAvec((p,m)=>{pseudoValide(p);return auth.createUserWithEmailAndPassword(courrielCompte(p),m)});
$('compte-google').onclick=()=>compteAvec(()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
document.addEventListener('amertume-mj-change',majTable);
document.addEventListener('amertume-firebase-prete',majTable);
$('live-close').onclick=fermerTable;
// Quitter la table : le siège s'efface, le MJ ne le voit plus connecté.
async function quitterSiege(){if(!siegesRef||!monUid||estMJ())return;const ref=siegesRef.doc(monUid);clearInterval(presenceTimer);presenceTimer=null;
 try{await ref.delete()}catch(e){}monSiege=null;try{localStorage.removeItem(TABLE_CLE+'-siege')}catch(e){}}
// La page qui se ferme ou se recharge date la présence du joueur : il sort de la liste aussitôt, et la reprend en revenant.
window.addEventListener('pagehide',()=>{if(!siegesRef||!monUid||typeof firebase==='undefined')return;
 try{siegesRef.doc(monUid).update({at:firebase.firestore.Timestamp.fromMillis(0)}).catch(()=>{})}catch(e){}});
/* Quitter la table ferme tout chez un joueur : le siège s'efface, et la page repart sans le lien de table, sur la page fermée.
   Chez le MJ, la partie reste ouverte sur l'appareil, comme avant. */
$('live-quit').onclick=async()=>{const joueur=!estMJ();await quitterSiege();debrancherTable();
 const u=new URL(location.href);u.searchParams.delete('table');
 if(joueur){try{localStorage.removeItem(TABLE_CLE)}catch(e){}location.replace(u.toString());return}
 history.replaceState(null,'',u);
 liveStatus('Table quittée. La partie reste sur cet appareil.')};
$('live-copy').onclick=async()=>{try{await navigator.clipboard.writeText(lienTable(tableId));
 liveStatus('Lien copié : donne-le à tes joueurs.')}catch(e){$('live-lien').select()}};

/* ---------- Branchement ---------- */
/* Le lien porte le code de la table. Un joueur n'a rien à installer ni à créer : une
   connexion anonyme lui donne un identifiant, le temps de la partie. */
document.addEventListener('amertume-firebase-prete',async()=>{
 const lien=new URL(location.href).searchParams.get('table'),code=lien||localStorage.getItem(TABLE_CLE);
 // La partie locale se pose d'abord : la table la recouvre ensuite, pas l'inverse.
 if(typeof loading!=='undefined'&&loading)await new Promise(r=>document.addEventListener('amertume-partie-chargee',r,{once:true}));
 // Le compte MJ mémorisé revient tout seul, mais pas tout de suite : on l'attend avant
 // de créer une identité anonyme, qui prendrait sa place.
 const deja=await new Promise(r=>{const off=auth.onAuthStateChanged(u=>{off();r(u)})});
 /* Sans lien de table, l'appareil n'est pas celui d'un invité : l'identité anonyme d'une table passée
    s'efface, elle le faisait passer pour un joueur à chaque rechargement. La table retenue ici est celle
    que le MJ y a ouverte : elle ne se rouvre qu'une fois le MJ reconnu, jamais en invité, ni par un
    détour en vue joueur, qui le rejetait sur la table. */
 if(!lien){if(deja&&deja.isAnonymous)try{await auth.signOut()}catch(e){}
  if(!code)return;
  auth.onAuthStateChanged(u=>{monUid=u?u.uid:null;majTable()});
  const rouvre=()=>{if(!estMJ()||enLigne||localStorage.getItem(TABLE_CLE)!==code||!auth.currentUser)return;monUid=auth.currentUser.uid;brancherTable(code);signaleJoueur()};
  document.addEventListener('amertume-mj-change',rouvre);rouvre();return}
 /* Un joueur rejoint avec son compte : Amertüme, pseudo et mot de passe, ou Google. Une identité anonyme d'avant s'efface : elle
    ne retrouverait pas ses aventuriers d'un appareil à l'autre. */
 if(deja&&deja.isAnonymous){try{await auth.signOut()}catch(e){}}
 if(!auth.currentUser||auth.currentUser.isAnonymous)await demandeCompte();
 monUid=auth.currentUser?auth.currentUser.uid:null;
 auth.onAuthStateChanged(u=>{monUid=u?u.uid:null;majTable()});
 brancherTable(code);
 // Un invité joue en joueur, avec le contenu publié s'il est déjà arrivé : sinon il
 // n'aurait que la scène de cet appareil, et rien pour le lui dire. Le MJ se reconnaît d'abord.
 for(let k=0;k<50&&typeof adminConnu!=='undefined'&&!adminConnu;k++)await new Promise(r=>setTimeout(r,100));
 const invite=!estMJ();signaleJoueur();
 if(invite){view='player';$('view').value='player';
  if(typeof remote!=='undefined'&&remote&&typeof applyRemote==='function')applyRemote();else render()}
 liveStatus('Table rejointe.');});

/* Un invité joue, il ne dirige pas : ni la vue MJ, ni le choix d'un autre aventurier (son
   siège est son aventurier), ni le partage. Ses onglets sont ceux que le MJ ouvre aux joueurs.
   Ce qui est caché ici l'est après chaque rendu, pour que rien ne le rouvre. */
function verrouillerInvite(){const inv=spectateur();
 const cache=(el,oui)=>{if(el)el.hidden=oui};
 cache($('view'),inv);cache(document.querySelector('label[for="view"]'),inv);
 if(inv){cache($('owner'),true);cache($('owner-label'),true)}
 cache($('open-share'),inv);
 // Les joueurs connectés, dans l'en-tête, sont au MJ ; à l'Accueil, tout le monde les voit.
 cache($('open-joueurs'),inv)}
// Après chaque rendu, ce qui a bougé part sur le réseau — et rien d'autre.
// Une vue imposée le temps d'être invité se rend dès qu'on ne l'est plus, avec l'onglet d'avant.
let vueImposee=false;
const renderAvantTable=render;render=function(){let rendre=false;
 if(spectateur()&&view!=='player'){view='player';$('view').value='player';vueImposee=true}
 else if(vueImposee&&!spectateur()){vueImposee=false;view=vueChoisie()||'mj';$('view').value=view;rendre=true}
 /* Un joueur voit par l'aventurier qui est le sien, celui qu'il commande : sans siège pris, la vue retombait sur le premier de la
    liste, et il commandait l'un en voyant par les yeux d'un autre. */
 if(typeof invitEnLigne==='function'&&invitEnLigne()&&!aMoi(actors[owner])){let i=actors.findIndex(a=>aMoi(a)&&!a.horsCarte);if(i<0)i=actors.findIndex(aMoi);
  if(i>=0){if(selected===owner)selected=i;owner=i;if($('owner'))$('owner').value=String(i)}}
 renderAvantTable();verrouillerInvite();pousserPlusTard();
 // Hors d'une table, le site n'est qu'au MJ.
 appliqueVerrou();
 // Un joueur dont aucun aventurier n'est sur la carte ne voit rien de la table.
 document.body.classList.toggle('table-sans-heros',invitEnLigne()&&!actors.some(a=>aMoi(a)&&!a.horsCarte));if(rendre&&typeof rendPage==='function')rendPage()};
// Ce qui s'enregistre part aussi : une fiche corrigée dans l'onglet Aventuriers n'attend pas le prochain rendu de la table.
const scheduleSaveAvantTable=scheduleSave;scheduleSave=function(){scheduleSaveAvantTable.apply(this,arguments);pousserPlusTard()};
majTable();
/* L'Accueil s'est dessiné avant ce fichier, sans savoir qui regarde : chez un joueur, il montrait les aventuriers de tous. Il se
   redessine maintenant que la table sait qui est invité. */
if(document.body.classList.contains('page-accueil')&&typeof renderAccueil==='function')renderAccueil();
// Le verrou suit le compte : le MJ reconnu ouvre tout ; un autre compte, sur cette page fermée, l'apprend.
appliqueVerrou();document.addEventListener('amertume-mj-change',()=>{appliqueVerrou();const s=$('verrou-statut');
 // Le refus ne se dit qu'à qui a demandé la connexion MJ : un joueur qui vient de quitter sa table ne le lit pas.
 if(s)s.textContent=$('verrou-page')&&$('verrou-page').dataset.demande&&typeof adminConnu!=='undefined'&&adminConnu&&auth&&auth.currentUser&&!estMJ()?'Ce compte n’est pas celui du MJ.':''});
/* ---------- Une version plus récente en ligne ----------
   Chaque publication écrit son numéro dans « version.json ». La page le relit au chargement, toutes les cinq minutes et en
   revenant au premier plan : plus récent que le sien, un bandeau le dit, et son bouton recharge la page sur la nouvelle version. */
function rechargerVersion(v){const u=new URL(location.href);u.searchParams.set('v',v);location.replace(u.toString())}
function verifieVersion(){if(typeof IMG_V!=='string'||typeof fetch!=='function')return;
 fetch('./version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(o=>{const v=o&&typeof o.v==='string'?o.v:'';
  if(!v||!(parseFloat(v)>parseFloat(IMG_V)))return;let b=$('bandeau-version');
  if(!b){b=document.createElement('div');b.id='bandeau-version';b.className='bandeau-version';b.setAttribute('role','status');
   const t=document.createElement('span'),r=document.createElement('button');r.type='button';r.textContent='Recharger';b.append(t,r);document.body.append(b);
   // v1.113 : dans la couche du dessus, comme les fenêtres : au-dessus de l'arbre, des éditeurs, de tout ce qui s'ouvre.
   if(typeof b.showPopover==='function'){b.setAttribute('popover','manual');try{b.showPopover()}catch(e){}
    new MutationObserver(()=>{if(!b.isConnected||!b.matches(':popover-open'))return;const ouvertes=document.querySelectorAll('dialog[open]').length;
     if(ouvertes>(b._ouvertes||0)){try{b.hidePopover();b.showPopover()}catch(e){}}b._ouvertes=ouvertes}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']})}}
  b.firstChild.textContent='Nouvelle version disponible : v'+v;b.lastChild.onclick=()=>rechargerVersion(v)}).catch(()=>{})}
setTimeout(verifieVersion,4000);setInterval(verifieVersion,5*60*1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')verifieVersion()});

/* ---------- L'exploration gardée par la table ----------
   « brouillard/{carte} » : la mémoire d'exploration de la carte, telle que le MJ la tient, et le numéro de sa dernière remise à
   zéro. Le MJ l'écrit au plus toutes les trois secondes, quand elle a changé ; chaque joueur écoute celle de la carte ouverte et
   l'ajoute à la sienne. Sans la règle Firestore qui l'admet, rien ne s'écrit et rien ne casse. */
function pousserBrouillard(){if(!estMJ()||!enLigne||!brouillardsRef||brouillardPousseTimer)return;
 brouillardPousseTimer=setTimeout(()=>{brouillardPousseTimer=0;const m=typeof currentMap==='function'?currentMap():null;
  if(!m||!brouillardsRef||typeof m.fog!=='string'||m.fog.length>300000||(typeof estPaysage==='function'&&estPaysage(m)))return;
  const n=typeof brouillardReset!=='undefined'?brouillardReset.n:0,cle=n+'|'+m.fog;if(brouillardsPousses.get(m.id)===cle)return;brouillardsPousses.set(m.id,cle);
  brouillardsRef.doc(m.id).set({f:m.fog,n,at:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>brouillardsPousses.delete(m.id))},3000)}
// Une remise à zéro du MJ part aussitôt : la mémoire vidée remplace l'ancienne.
{const resetFogSansTable=resetFog;resetFog=function(){const r=resetFogSansTable.apply(this,arguments);pousserBrouillard();return r}}
function ecouterBrouillard(id){if(quitteBrouillard)quitteBrouillard();quitteBrouillard=null;brouillardTable=null;brouillardEcoute=id||null;
 if(!id||!brouillardsRef)return;quitteBrouillard=brouillardsRef.doc(id).onSnapshot(d=>{const o=d.exists?d.data():null;
  brouillardTable=o&&typeof o.f==='string'&&typeof o.n==='number'?{id,f:o.f,n:o.n}:null;appliqueBrouillardTable()},()=>{})}
function appliqueBrouillardTable(){const t=brouillardTable,m=typeof currentMap==='function'?currentMap():null;
 if(estMJ()||!t||!m||m.id!==t.id||!brouillardConnu||typeof brouillardReset==='undefined'||t.n!==brouillardReset.n||typeof ajouteBrouillard!=='function')return;
 ajouteBrouillard(m,t.f)}
// Chez un joueur, l'écoute suit la carte ouverte ; chez le MJ, la carte ouverte part une première fois.
{const renderAvantBrouillard=render;render=function(){renderAvantBrouillard.apply(this,arguments);if(!enLigne||!brouillardsRef)return;
 const id=typeof currentMapId!=='undefined'&&currentMapId||null;
 if(estMJ()){if(id&&!brouillardsPousses.has(id))pousserBrouillard()}else if(id!==brouillardEcoute)ecouterBrouillard(id)}}

/* ---------- Le sas des comptes ---------- */
function ecouterAdmis(){if(!admisRef)return;if(quitteAdmis){quitteAdmis();quitteAdmis=null}if(quitteMonAdmis){quitteMonAdmis();quitteMonAdmis=null}
 if(estMJ()){admisIci=true;quitteAdmis=admisRef.onSnapshot(s=>{admis={};s.forEach(d=>admis[d.id]=d.data());renderJoueursConnectes();majSas()},()=>{})}
 else if(monUid){admisIci=false;quitteMonAdmis=admisRef.doc(monUid).onSnapshot(d=>{const avant=admisIci;admisIci=d.exists;majSas();if(admisIci&&!avant){pousserPlusTard();render()}},
  // Sans la règle Firestore du sas, la lecture est refusée : le sas n'existe pas encore, la table reste ouverte comme avant.
  ()=>{admisIci=true;majSas()})}
 majSas()}
// Le compte connu après coup, ou le MJ reconnu : l'écoute se refait.
document.addEventListener('amertume-mj-change',()=>{if(enLigne&&admisRef)setTimeout(()=>{if(enLigne&&admisRef)ecouterAdmis()},0)});
// De même pour l'exclusion : un compte connu après l'ouverture de la table écoute aussitôt la sienne, et l'exclusion le touche dans l'instant.
document.addEventListener('amertume-mj-change',()=>setTimeout(()=>{if(!enLigne||!bannisRef)return;
 if(estMJ()?!quitteBannis:(!quitteMonBan&&!!monUid)){if(quitteBannis){quitteBannis();quitteBannis=null}if(quitteMonBan){quitteMonBan();quitteMonBan=null}ecouterBannis()}},0));
async function admettre(uid,nom){if(!estMJ()||!admisRef||!uid)return;
 try{await admisRef.doc(uid).set({nom:String(nom||'Joueur').slice(0,30),at:firebase.firestore.FieldValue.serverTimestamp()})}catch(e){liveStatus('Validation refusée. '+liveErreur(e))}}
// L'attente se voit : chez le joueur, la table voilée et le message ; chez le MJ, un point sur « Joueurs connectés ».
function majSas(){const attente=sasEnAttente();document.body.classList.toggle('sas-attente',attente);
 let m=$('sas-message');if(attente&&!m){m=document.createElement('div');m.id='sas-message';m.className='sas-message';m.setAttribute('role','status');m.textContent='En attente de la validation du MJ…';document.body.append(m)}
 if(m)m.hidden=!attente;
 const b=$('open-joueurs');if(b)b.classList.toggle('attente',estMJ()&&!!admisRef&&joueursConnectes().some(j=>j.uid!==monUid&&!admis[j.uid]));
 if(typeof renderAccueil==='function'&&document.body.classList.contains('page-accueil'))renderAccueil()}
{const renderJoueursSansSas=renderJoueursConnectes;renderJoueursConnectes=function(){renderJoueursSansSas.apply(this,arguments);
 const b=$('open-joueurs');if(b)b.classList.toggle('attente',estMJ()&&!!admisRef&&joueursConnectes().some(j=>j.uid!==monUid&&!admis[j.uid]))}}
// Un compte en attente ne crée pas d'aventurier.
{const peutCreerSansSas=peutCreerAventurier;peutCreerAventurier=function(){return !sasEnAttente()&&peutCreerSansSas.apply(this,arguments)}}

/* ---------- Un aventurier à soi, et à personne d'autre ----------
   Chez un joueur, la barre d'actions ne montre que les actions d'un aventurier qu'il commande : celui d'un autre, sélectionné
   pour lire sa fiche, n'y paraît pas. */
{const renderAvantAutrui=render;render=function(){renderAvantAutrui.apply(this,arguments);
 document.body.classList.toggle('actions-autrui',invitEnLigne()&&!(selected!==null&&actors[selected]&&controlled(selected)))}}

/* ---------- Un seul tirage de départ ----------
   L'objet inhabituel de départ se tire une fois par compte et par classe, et se garde : recréer un aventurier ne le relance pas.
   Seul le MJ supprime un aventurier ; un joueur qui a déjà le sien lit pourquoi il n'en crée pas d'autre. */
{const tireSansGarde=tirePieceDepart;tirePieceDepart=function(role,tirage){const uid=!tirage&&invitEnLigne()&&monUid?monUid:null;if(!uid)return tireSansGarde.apply(this,arguments);
 const cle='amertume-tirage-depart',k=uid+'|'+role;let t={};try{t=JSON.parse(localStorage.getItem(cle)||'{}')||{}}catch(e){}
 const g=t[k];if(g&&typeof g.base==='string'&&Array.isArray(g.affixes)&&(catalog.items||[]).some(o=>o&&o.id===g.base))return {id:'forge-'+crypto.randomUUID(),base:g.base,affixes:structuredClone(g.affixes)};
 const r=tireSansGarde(role);if(r){t[k]={base:r.base,affixes:r.affixes};try{localStorage.setItem(cle,JSON.stringify(t))}catch(e){}}return r}}
{const supprimerSansCompte=supprimerAventurier;supprimerAventurier=function(){if(invitEnLigne()&&!(typeof mjIci==='function'&&mjIci()))return 'Seul le MJ peut supprimer un aventurier.';return supprimerSansCompte.apply(this,arguments)}}
{const renderAccueilSansFragment=renderAccueil;renderAccueil=function(){renderAccueilSansFragment.apply(this,arguments);
 const bloc=document.querySelector('.accueil-creer'),b=$('accueil-creer');if(!bloc||!b)return;
 const manque=invitEnLigne()&&!sasEnAttente()&&actors.some(a=>aMoi(a))&&!peutCreerAventurier();let p=bloc.querySelector('.manque-fragment');
 if(manque){bloc.hidden=false;b.disabled=true;if(!p){p=document.createElement('p');p.className='manque-fragment';p.textContent='Composant manquant : Fragment d’Âme';bloc.append(p)}p.hidden=false}
 else{b.disabled=false;if(p)p.hidden=true}}}

/* ---------- L'aventurier « Actif » ----------
   Au premier combat, chaque aventurier en scène devient Actif : son arbre — talents et caractéristiques — se fige jusqu'à son
   prochain repos, court ou long. Il s'ouvre et se lit ; un essai de changement le dit. Le MJ, lui, passe outre. */
CHAMPS_VIVANTS.push('actif');
{const basculerSansActif=basculerMode;basculerMode=function(){const avant=enCombat(),r=basculerSansActif.apply(this,arguments);
 if(!avant&&enCombat()&&!(typeof spectateur==='function'&&spectateur())){let n=0;
  actors.forEach(a=>{if(a&&a.hero&&!a.horsCarte&&a.actif!==true&&(typeof prendPartAventure!=='function'||prendPartAventure(a))){a.actif=true;n++}});if(n)scheduleSave()}
 return r}}
{const reposerSansActif=reposer;reposer=function(a){const r=reposerSansActif.apply(this,arguments);if(a&&a.actif===true)a.actif=false;return r}}
{const figeSansActif=figeEnCombat;figeEnCombat=function(a){const f=figeSansActif.apply(this,arguments)||(view!=='mj'&&!!a&&a.hero===true&&a.actif===true);
 if(f&&typeof annonceVerrouBuild==='function')annonceVerrouBuild();return f}}
let verrouAnnonce=0;
function annonceVerrouBuild(){if(performance.now()-verrouAnnonce<1500)return;verrouAnnonce=performance.now();
 const hote=document.querySelector('dialog[open]')||document.body,el=document.createElement('div');el.className='annonce-flottante annonce-info';el.setAttribute('role','status');
 el.textContent='Votre aventurier est au cœur de l’action, il ne peut pas modifier ses talents avant le prochain repos court.';
 el.style.left='50%';el.style.top='32%';el.addEventListener('animationend',()=>el.remove());hote.append(el)}
// Le repos venu, chez qui commande l'aventurier : son arbre se rouvre, et il le lit.
const actifsConnus=new Map();
{const renderAvantRepos=render;render=function(){renderAvantRepos.apply(this,arguments);
 actors.forEach((a,i)=>{if(!a||!a.hero||!a.id)return;const avant=actifsConnus.get(a.id),mien=view!=='mj'&&(invitEnLigne()?aMoi(a):i===owner);
  if(mien&&avant===true&&a.actif!==true&&typeof annonceFlottante==='function')annonceFlottante('Vous pouvez modifier vos talents');actifsConnus.set(a.id,a.actif===true)})}}

/* ---------- La connexion MJ de la page fermée ----------
   Elle ouvre la même fenêtre de compte que les joueurs : pseudo et mot de passe, ou Google, et ses erreurs s'y lisent. Le service
   pas encore prêt, elle l'attend ; un autre compte déjà connecté sur l'appareil cède d'abord la place. */
async function connexionMJ(){if(!auth){document.addEventListener('amertume-firebase-prete',()=>connexionMJ(),{once:true});return}
 if(auth.currentUser&&!estMJ())try{await auth.signOut()}catch(e){}
 // La fenêtre porte, le temps de cette connexion, le nom du bouton qui l'ouvre.
 const t=compteDialog.querySelector('.dialog-head h2'),avant=t?t.textContent:'';if(t)t.textContent='Connexion MJ';
 compteDialog.addEventListener('close',()=>{if(t)t.textContent=avant},{once:true});demandeCompte()}
/* v1.080 — Les talents tenus et la DEF, retenus le temps d'un rendu (memoRendu) : posés ici, après toutes leurs enveloppes. */
{const tc=talentsCodes;talentsCodes=function(a,...x){const m=typeof memoRendu!=='undefined'&&memoRendu;if(!m||x.length||!a||typeof a!=='object')return tc.call(this,a,...x);
 if(!m.tc.has(a))m.tc.set(a,tc.call(this,a));return m.tc.get(a)}}
{const d0=defOf;defOf=function(a,...x){const m=typeof memoRendu!=='undefined'&&memoRendu;if(!m||x.length||!a||typeof a!=='object')return d0.call(this,a,...x);
 if(!m.def.has(a))m.def.set(a,d0.call(this,a));return m.def.get(a)}}
