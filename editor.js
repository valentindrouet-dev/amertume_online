'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['white','bone','red','blue','green','black','yellow'];
let catalog=structuredClone(AMERTUME_CATALOG),mapImage=null,db=null,loading=true,saveTimer;
const num=(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0));
const poolFrom=d=>keys.map(k=>num(d?.[k],0,12));
const diceFrom=p=>Object.fromEntries(keys.map((k,i)=>[k,p[i]||0]));
// STATES et les jetons d'état vivent dans index.html, chargé avant ce fichier.
/* On créait d'office une « Attaque de base » à qui n'en avait pas : chez un aventurier
   elle doublait le bouton de son arme, et personne ne l'avait demandée. Elle n'est plus
   créée, et les fiches qui la portent encore la perdent au chargement — on ne reconnaît
   qu'elle, à son nom : une attaque écrite à la main reste. Un aventurier frappe donc de
   ses armes équipées, et un adversaire de ce que son modèle lui donne. */
const ATTAQUE_AUTO='Attaque de base';
function normalizeActor(a){a.id??=crypto.randomUUID();a.vie??=a.hero?Math.max(1,a.max/3):0;a.endu??=3;a.pvBonus??=0;a.xp??=0;a.level??=1;a.type??='standard';a.socle??='medium';a.menace??='closest';a.attacks=(Array.isArray(a.attacks)?a.attacks:[]).filter(x=>x&&x.name!==ATTAQUE_AUTO);a.notes??='';a.states??=(a.state&&a.state!=='Aucun'?[a.state]:[]);delete a.state;a.sexe??='';a.race??='';a.vieMax??=a.vie;a.hidden??=false;a.skills??=Array(8).fill(0);a.weapons??=[];a.armorId??='';a.shieldId??='';a.activeAttack??=0;a.talents??=[];a.bleed??=0;a.cumuls??={};a.revealed??=false;return a}
/* Un catalogue enregistré avant les talents n'a pas le rayon : on l'ouvre vide. */
function normalizeCatalog(c){c||={};c.items||=[];c.monsters||=[];c.talents||=[];
 /* Les classes du jeu viennent avec lui : un catalogue enregistré avant elles les reçoit
    une fois. Ensuite elles lui appartiennent, et le MJ peut les corriger. */
 if(!Array.isArray(c.classes))c.classes=structuredClone((window.AMERTUME_CATALOG||{}).classes||[]);
 /* Les premiers talents codés se reconnaissaient à leur nom. Ils portent désormais leur
    effet en clair : on le leur inscrit une fois, d'après ce nom, et le nom redevient
    libre — le renommer ne fait plus perdre la mécanique. */
 c.talents.forEach(t=>{if(t&&t.effet===undefined){const k=cleTalent(t.name);
  t.effet=TALENTS_CODES[k]?k:''}});
 // Un modèle s'équipe depuis la v0.73 : les anciens reçoivent leurs emplacements vides.
 c.monsters.forEach(m=>{m.weapons||=[];m.armorId??='';m.shieldId??=''});
 return c}
function idsUniques(liste){const vus=new Set();
 (liste||[]).forEach(a=>{if(!a)return;
  if(!a.id||vus.has(a.id))a.id=crypto.randomUUID();
  vus.add(a.id)})}
actors.forEach(normalizeActor);idsUniques(actors);normalizeCatalog(catalog);
// Équipement de départ de la scène de démonstration. Toute partie enregistrée le remplace.
(function(){const parNom=n=>catalog.items.find(w=>w.name===n)?.id||'';
 [['Éla',['Épée'],'Armure de mailles','Bouclier'],['Kaël',['Arc'],'Armure de cuir',''],['Sentinelle',['Lance'],'Armure de mailles','Bouclier'],['Rôdeur des ruines',['Hache'],'Armure de plates','Bouclier']]
 .forEach(([nom,armes,armure,bouclier])=>{const a=actors.find(x=>x.name===nom);if(!a||a.weapons.length)return;
  a.weapons=armes.map(parNom).filter(Boolean);a.armorId=parNom(armure);a.shieldId=parNom(bouclier);
  a.def=defenseOf(a,catalog.items);a.pool=poolOf(a)})})();
/* Le bandeau de scène a quitté la table : chaque action qu'il portait a rejoint
   l'endroit qui la concerne — ajouter un combattant, la liste des combattants ;
   retirer la carte, la barre de la carte ; soigner le camp adverse, le bloc des
   points de vie ; le titre de la scène et l'état de la sauvegarde, les Paramètres. */
const saveLabel=document.createElement('p');saveLabel.id='save-status';saveLabel.className='muted';
/* Le titre de la scène vit dans un bandeau masqué : la sauvegarde, le chargement,
   la publication et la réception le lisent tous. Un seul endroit sait où il est. */
function sceneTitle(neuf){const h=document.querySelector('.intro h1');
 if(neuf!==undefined&&h)h.textContent=neuf;
 return h?h.textContent:'Amertume'}
const note=document.createElement('p');note.id='actor-notes';note.className='muted';$('class').after(note);
/* Les attaques d'un combattant s'offrent en boutons nommés, celles de sa fiche comme
   celle que lui donne son équipement : on lit d'un coup ce qu'il sait faire et on
   clique celle qui part. Le bouton retenu est plein, les autres sont dessinés. */
function renderAttackChoices(){const boite=$('attack-choices');if(!boite)return;
 // Plusieurs combattants pris : la carte des Actions ne propose rien.
 if(marked.size>1){boite.replaceChildren();boite.hidden=true;return}
 const a=actors[selected],liste=a?attackChoices(a,catalog.items):[];
 // Même seule, une attaque se montre : on lit ce qui part avant de frapper.
 boite.replaceChildren();boite.hidden=!liste.length;
 if(!liste.length)return;
 const retenu=Math.trunc(a.activeAttack)||0;
 liste.forEach((at,i)=>{const b=document.createElement('button');
  b.className='btn-action choix-attaque'+(i===(retenu<liste.length?retenu:0)?' on':'');
  const nom=document.createElement('span');nom.className='nom';nom.textContent=at.name||'Attaque';
  // Les dés partent avec le nom : on choisit son attaque en voyant ce qu'elle lance.
  b.append(nom,dicePips(at.dice));
  if(at.range==='distance'){const loin=document.createElement('span');loin.className='loin';
   loin.textContent='⤳';loin.setAttribute('aria-hidden','true');b.append(loin)}
  const refus=typeof refusAttaque==='function'?refusAttaque(a,at):'';
  b.disabled=!!refus;
  b.title=refus||('Frapper : '+(at.gear?'attaque avec l’équipement':'attaque de fiche')
   +' · '+(at.range==='distance'?'à distance':'au contact')
   +(at.targets==='all'?' · toutes cibles':''));
  b.setAttribute('aria-label',(at.name||'Attaque')+' — '+b.title);
  /* Le bouton n'arme plus l'attaque : il la porte. On retient laquelle est partie —
     la réserve affichée la suit — puis le coup part aussitôt. */
  b.onclick=()=>{a.activeAttack=i;
   boite.querySelectorAll('.choix-attaque').forEach((x,k)=>x.classList.toggle('on',k===i));
   attack();scheduleSave()};
  boite.append(b)})}
const cover=document.createElement('div');cover.id='busy-cover';cover.textContent='Chargement de la partie enregistrée…';document.body.append(cover);
function dialog(id,title,body){const el=document.createElement('dialog');el.id=id;el.innerHTML='<div class="dialog-head"><h2>'+title+'</h2><button type="button" aria-label="Fermer" data-close>✕</button></div>'+body;document.body.append(el);el.querySelector('[data-close]').onclick=()=>el.close();return el}
const actorDialog=dialog('actor-editor','Modifier la fiche','<form id="actor-form"><div id="actor-fields"></div><p class="form-error" id="actor-error" role="alert"></p><div class="form-actions"><button type="button" id="delete-actor">Retirer de la scène</button><button type="button" id="save-template">Enregistrer au bestiaire</button><button type="submit" class="primary">Enregistrer la fiche</button></div></form>');
/* ---------- Pages Armurerie et Bestiaire ---------- */
const armoryPage=document.createElement('main');armoryPage.id='armory-page';
armoryPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Armurerie</h2><div class="cat-actions">'
 +'<button id="armory-official">Catalogue officiel</button><button id="armory-add" class="primary">+ Ajouter</button></div></header>'
 
 +'<div class="cat-filters"><input id="armory-search" placeholder="Rechercher…" aria-label="Rechercher un objet">'
 +'<select id="armory-cat" aria-label="Catégorie"><option value="">Toutes catégories</option>'
 +'<option value="melee">Armes de mêlée</option><option value="ranged">Armes à distance</option>'
 +'<option value="armor">Armures</option><option value="object">Objets</option></select></div>'
 +'<div class="cat-cols" id="armory-cols"></div></section>';
const heroesPage=document.createElement('main');heroesPage.id='heroes-page';
heroesPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Aventuriers</h2><div class="cat-actions">'
 +'<button id="hero-add" class="primary">+ Nouvel aventurier</button></div></header>'
 // Le mode d'emploi n'a plus à occuper le haut de la page : les infobulles le disent
 // au survol de chaque valeur, et le champ de recherche ne sert qu'à une grande troupe.
 +'<div class="cat-filters" id="hero-filtres" hidden><input id="hero-search" placeholder="Rechercher…" aria-label="Rechercher un aventurier"></div>'
 +'<div class="hero-grid" id="hero-grid"></div></section>';
const settingsPage=document.createElement('main');settingsPage.id='settings-page';
settingsPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Paramètres</h2></header>'
 +'<p class="muted">Réglages de cet appareil. Ils ne quittent pas ce navigateur et ne touchent pas la partie.</p>'
 +'<div class="divider"></div><h3 class="reglage-titre">Apparence</h3>'
 +'<div class="reglage"><div><strong>Mode nuit</strong><p class="muted">Fond sombre, mêmes couleurs de jeu.</p></div>'
 +'<button id="theme-switch" class="primary"></button></div>'
 +'<div class="divider"></div><h3 class="reglage-titre">Raccourcis de la carte</h3>'
 +'<p class="muted">La touche à maintenir en cliquant sur un combattant. Deux gestes ne peuvent pas partager la même touche.</p>'
 +'<div id="raccourcis"></div>'
 +'<p class="form-error" id="raccourcis-erreur" role="status" aria-live="polite"></p>'
 +'<p class="muted">Chaque changement est enregistré aussitôt, sur cet appareil seulement.</p>'
 +'<div class="side-actions"><button id="raccourcis-reset">Rétablir les touches d’origine</button></div>'
 +'<div id="bloc-scene" hidden><div class="divider"></div><h3 class="reglage-titre">Scène en cours</h3>'
 +'<p class="muted">Le titre de la partie et le tour de combat. Ils voyagent avec la scène publiée.</p>'
 +'<div class="reglage"><div><strong id="scene-titre"></strong><p class="muted" id="scene-tour"></p></div>'
 +'<button id="edit-scene">Modifier la scène</button></div></div>'
 +'<div class="divider"></div><h3 class="reglage-titre">Sauvegarde</h3>'
 +'<div id="bloc-sauvegarde"></div>'
 +'</section>';
const talentsPage=document.createElement('main');talentsPage.id='talents-page';
talentsPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Talents</h2><div class="cat-actions">'
 +'<button id="talent-add" class="primary">+ Nouveau talent</button></div></header>'
 
 +'<div class="cat-filters"><input id="talent-search" placeholder="Rechercher…" aria-label="Rechercher un talent">'
 +'<select id="talent-family" aria-label="Classe"></select>'
 +'<select id="talent-sort" aria-label="Tri"><option value="niveau">Tri : niveau ↑</option>'
 +'<option value="niveau-">Tri : niveau ↓</option><option value="nom">Tri : nom</option></select></div>'
 /* La bibliothèque des effets : ce que le moteur sait faire, replié par défaut. On y lit
    ce qu'un effet fait et les réglages qu'il demande, avant d'aller créer le talent qui
    s'en servira. */
 +'<details class="bloc-replie biblio"><summary><span class="bloc-titre">📖 Bibliothèque des effets</span>'
 +'<span class="compte" id="biblio-compte"></span></summary><div id="biblio-effets"></div></details>'
 +'<div class="cat-cols" id="talent-cols"></div></section>';
const bestiaryPage=document.createElement('main');bestiaryPage.id='bestiary-page';
bestiaryPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Bestiaire</h2><div class="cat-actions">'
 +'<button id="bestiary-add" class="primary">+ Nouveau monstre</button></div></header>'
 
 +'<div class="cat-filters"><input id="bestiary-search" placeholder="Rechercher…" aria-label="Rechercher un monstre">'
 +'<select id="bestiary-family" aria-label="Famille"></select>'
 +'<select id="bestiary-sort" aria-label="Tri"><option value="danger">Tri : danger ↓</option>'
 +'<option value="danger-">Tri : danger ↑</option><option value="nom">Tri : nom</option></select></div>'
 +'<div class="cat-cols" id="bestiary-cols"></div></section>';
document.querySelector('main.layout').after(heroesPage,talentsPage,armoryPage,bestiaryPage,settingsPage);
/* Un sous-titre de carte, avec son « + » : équiper ou attribuer sans ouvrir la fiche. */
function sousTitre(texte,titre,fn){const h=document.createElement('h4');h.className='hero-sous';
 h.append(texte);
 const b=document.createElement('button');b.className='ico plus';b.textContent='+';
 b.title=titre;b.setAttribute('aria-label',titre);b.onclick=fn;h.append(b);return h}
/* ---------- Corriger une valeur là où elle est lue ---------- */
let champsOuverts=0;
/* Le MJ clique le chiffre sur la fiche, le retape, et valide par Entrée ou en
   sortant du champ ; Échap laisse tout en place. Le nœud d'origine est remis avant
   que la valeur soit posée : la page se redessine derrière, sans reste de champ.
   Les joueurs n'ont pas ce droit — chez eux une fiche se lit, elle ne s'écrit pas. */
function champVif(noeud,valeur,poser,titre,classe){if(view!=='mj')return;
 if(view!=='mj')return noeud;
 noeud.classList.add('modifiable');noeud.tabIndex=0;
 noeud.title=titre||'Cliquer pour modifier';
 // Une note tient sur plusieurs lignes : elle s'écrit dans une zone, où Entrée
 // saute une ligne et où c'est la sortie du champ qui valide.
 const zone=classe==='zone';
 const ouvrir=()=>{const parent=noeud.parentNode;if(!parent)return;
  const champ=document.createElement(zone?'textarea':'input');
  champ.className='champ-vif'+(classe?' '+classe:'');
  // La valeur se relit maintenant : celle d'il y a trois corrections n'a plus cours.
  const v=typeof valeur==='function'?valeur():valeur;
  champ.value=String(v??'');champ.setAttribute('aria-label',noeud.title);
  if(zone)champ.rows=4;
  parent.replaceChild(champ,noeud);champ.focus();champ.select();champsOuverts++;
  let clos=false;
  const fermer=garder=>{if(clos)return;clos=true;champsOuverts--;
   if(champ.parentNode)champ.parentNode.replaceChild(noeud,champ);
   if(garder)poser(champ.value)};
  champ.onkeydown=e=>{e.stopPropagation();
   if(e.key==='Enter'&&(!zone||e.metaKey||e.ctrlKey)){e.preventDefault();fermer(true)}
   else if(e.key==='Escape'){e.preventDefault();fermer(false)}};
  champ.onblur=()=>fermer(true);
  champ.onclick=e=>e.stopPropagation()};
 noeud.onclick=e=>{e.preventDefault();e.stopPropagation();ouvrir()};
 noeud.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ouvrir()}};
 return noeud}
/* Un choix ne se tape pas : la pastille s'échange contre un menu, qui se referme
   sur la sélection. Sortir sans choisir ne change rien. */
function choixVif(noeud,valeur,options,poser,titre){if(view!=='mj')return;
 if(view!=='mj')return noeud;
 noeud.classList.add('modifiable');noeud.tabIndex=0;noeud.title=titre||'Cliquer pour changer';
 const ouvrir=()=>{const parent=noeud.parentNode;if(!parent)return;
  const menu=document.createElement('select');menu.className='champ-vif choix';
  menu.setAttribute('aria-label',noeud.title);
  options.forEach(([v,t])=>menu.add(new Option(t,v)));
  menu.value=String((typeof valeur==='function'?valeur():valeur)??'');
  parent.replaceChild(menu,noeud);menu.focus();champsOuverts++;
  let clos=false;
  const fermer=garder=>{if(clos)return;clos=true;champsOuverts--;
   if(menu.parentNode)menu.parentNode.replaceChild(noeud,menu);
   if(garder)poser(menu.value)};
  menu.onchange=()=>fermer(true);menu.onblur=()=>fermer(false);
  menu.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();fermer(false)}}};
 noeud.onclick=e=>{e.preventDefault();e.stopPropagation();ouvrir()};
 noeud.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ouvrir()}};
 return noeud}
/* Une case à cocher déguisée en pastille : un clic la retourne. */
function basculeVive(noeud,poser,titre){if(view!=='mj')return;
 if(view!=='mj')return noeud;
 noeud.classList.add('modifiable');noeud.tabIndex=0;noeud.title=titre;
 noeud.onclick=e=>{e.preventDefault();e.stopPropagation();poser()};
 noeud.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();poser()}};
 return noeud}
/* Le portrait d'un modèle, cliquable : on change l'illustration là où on la regarde,
   sans passer par la fiche complète. Un portrait déjà posé se retire par sa croix. */
function jetonVif(m,poser){const boite=document.createElement('div');boite.className='jeton-boite';
 if(view!=='mj')return boite;
 const j=jetonRond(m.image,m.name,'grand');boite.append(j);
 if(view!=='mj')return boite;
 const fichier=document.createElement('input');fichier.type='file';fichier.hidden=true;
 fichier.accept='image/png,image/jpeg,image/webp';
 fichier.onchange=()=>{const f=fichier.files[0];fichier.value='';
  if(f)openImage(f,'token',url=>{m.image=url;poser()})};
 j.classList.add('modifiable');j.tabIndex=0;
 j.title=m.image?'Changer l’illustration de '+m.name:'Ajouter une illustration à '+m.name;
 j.setAttribute('role','button');j.setAttribute('aria-label',j.title);
 const ouvrir=e=>{e.stopPropagation();fichier.click()};
 j.onclick=ouvrir;
 j.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fichier.click()}};
 const legende=document.createElement('span');legende.className='jeton-legende';
 legende.textContent=m.image?'Changer':'Ajouter';boite.append(legende);
 boite.append(fichier);return boite}
/* Le portrait d'un combattant, rond comme sur la carte : petit sur une languette
   pour le reconnaître d'un coup d'œil, grand dans la fiche dépliée. */
function jetonRond(image,nom,taille){const j=document.createElement('span');
 j.className='jeton-rond'+(taille?' '+taille:'');
 if(image){const im=document.createElement('img');im.src=image;im.alt='';im.draggable=false;j.append(im)}
 else j.textContent=(String(nom||'?').trim()[0]||'?').toUpperCase();
 return j}
/* Poser une caractéristique d'aventurier. Le piège : redessiner toute la page à la
   validation détache le chiffre que le MJ vient de viser, si bien que son clic suivant
   tombe dans le vide et que la valeur « ne se modifie pas ». On réécrit donc les
   chiffres sur place — aucun nœud n'est détaché, le clic suivant arrive à bon port. */
/* Le redessin de la table refait la fiche en jeu de fond en comble : lancé sur-le-champ,
   il détacherait le chiffre que le MJ vise ensuite et lui volerait son clic. Les chiffres
   sont donc réécrits sur place, et le redessin attend qu'on ait fini de taper. */
let rendreTimer=null;
function rendrePlusTard(){clearTimeout(rendreTimer);
 rendreTimer=setTimeout(function encore(){
  if(champsOuverts){rendreTimer=setTimeout(encore,200);return}
  render()},300)}
function poserCarac(a,cle,brut,carte){const avant=a[cle];writeStat(a,cle,brut);
 if(a[cle]===avant)return;
 majFiche(carte,a);rendrePlusTard();scheduleSave();
 // Une fiche corrigée est du contenu : une publication en cours la reprend.
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* L'écu de DEF redessiné sans être remplacé : même élément, autre image. */
function majEcu(ecu,valeur){if(!ecu)return;
 const n=Number(valeur),peint=Number.isInteger(n)&&n>=0&&n<=6;
 const im=ecu.querySelector('img');if(im)im.src=imgUrl('DEF '+(peint?n:'VIDE')+'.png');
 ecu.setAttribute('aria-label','DEF '+valeur);
 let b=ecu.querySelector('b');
 if(peint){if(b)b.remove()}
 else{if(!b){b=document.createElement('b');ecu.append(b)}b.textContent=valeur}}
/* Réécrire les chiffres d'une carte d'aventurier là où ils sont, sans rien remplacer.
   Un chiffre en cours de saisie n'est pas dans la page : le sélecteur ne le trouve
   pas, et il n'est donc pas écrasé sous les doigts. */
function majFiche(carte,a){if(!carte)return;
 const ecrire=(sel,texte)=>{const n=carte.querySelector(sel);if(n)n.textContent=texte};
 ecrire('.stat-tile.t-vie strong',a.vie);ecrire('.stat-tile.t-vie small','MAX '+(a.vieMax??a.vie));
 ecrire('.stat-tile.t-endu strong',a.endu);
 ecrire('.stat-tile.t-pv strong',a.hp);ecrire('.stat-tile.t-pv small','MAX '+a.max);
 ecrire('.stat-tile.t-dmg strong','+'+a.dmg);ecrire('.stat-tile.t-xp strong',a.xp||0);
 ecrire('.chip-niveau','Niveau '+a.level);ecrire('.chip-xp',(a.xp||0)+' XP');
 majEcu(carte.querySelector('.stat-tile.t-def .ecu'),defOf(a));
 carte.querySelectorAll('.skill-chip').forEach((puce,k)=>{
  const b=puce.querySelector('b');if(b)b.textContent='+'+a.skills[k];
  puce.classList.toggle('zero',!a.skills[k])})}
/* Rendre modifiables les tuiles d'une rangée : la grosse valeur, et le plafond
   écrit en petit dessous quand il y en a un. La DEF fait exception dès qu'une
   armure la commande — elle se change alors dans l'équipement, pas ici. */
function tuilesVives(a,tuiles,cles,carte){
 tuiles.forEach((tuile,i)=>{const [cle,plafond]=cles[i]||[];if(!cle)return;
  const gros=tuile.querySelector('strong'),ecu=tuile.querySelector('.ecu'),
   petit=tuile.querySelector('small');
  // La DEF d'un aventurier est la somme de son armure et de son bouclier : jamais saisie.
  if(cle==='def'&&a.hero){
   if(ecu){ecu.classList.add('verrou');
    ecu.title=equippedDef(a,catalog.items)===null
     ?'DEF nulle : rien n’est porté. Équipe-lui une armure ou un bouclier.'
     :'DEF de l’armure et du bouclier équipés : elle se change dans l’équipement.'}}
  else if(ecu)champVif(ecu,()=>a.def,v=>poserCarac(a,'def',v,carte),'Modifier la DEF de '+a.name);
  else if(gros)champVif(gros,()=>a[cle],v=>poserCarac(a,cle,v,carte),'Modifier '+cle.toUpperCase()+' de '+a.name);
  if(petit&&plafond)champVif(petit,()=>a[plafond],v=>poserCarac(a,plafond,v,carte),
   'Modifier le maximum de '+a.name,'petit')})}
/* Une carte par aventurier : de quoi le reconnaître, lire ses chiffres et agir dessus. */
/* Enregistrer une fiche remplace l'objet dans « actors » : une carte dessinée avant
   garde l'ancien, devenu orphelin. Le rang se relit donc au clic, et une carte périmée
   redessine la page au lieu d'ouvrir un index qui n'existe plus. */
function heroRank(a){const i=actors.indexOf(a);if(i<0)renderHeroes();return i}
function heroCard(a,i){const c=document.createElement('article');c.className='hero-card';
 const tete=document.createElement('div');tete.className='hero-head';
 const jeton=document.createElement('span');jeton.className='avatar';
 if(a.image){const im=document.createElement('img');im.src=a.image;im.alt='';jeton.append(im)}
 else jeton.textContent=(a.name||'?')[0];
 const titre=document.createElement('div');titre.className='hero-id';
 const nom=document.createElement('strong');nom.textContent=a.name;
 titre.append(nom);  // La classe est portée par la pastille, le niveau par une puce : pas de troisième copie.

 // Même pastille de classe que sur la fiche en jeu, teintée par le nom.
 const teinte=typeof actorTint==='function'?actorTint(a):'#8a7a63';
 const classe=document.createElement('span');classe.className='sheet-class';
 classe.textContent=(a.role||'Aventurier').split('·')[0].trim().toUpperCase();
 classe.style.color=classe.style.borderColor=teinte;
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(g,t,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=g;
  b.title=t;b.setAttribute('aria-label',t+' '+a.name);b.onclick=fn;return b};
 const suppr=ico('✕','Retirer',()=>{const r=heroRank(a);if(r<0)return;
  const souci=removeActor(r);if(souci)alert(souci);else renderHeroes()});
 suppr.classList.add('danger');
 outils.append(ico('✎','Modifier',()=>{const r=heroRank(a);if(r>=0)openActor(r)}),
  ico('⧉','Dupliquer',()=>{if(heroRank(a)<0)return;
   // Une copie est un autre combattant : elle ne peut pas garder l'identifiant de l'original,
   // sous peine d'être prise, marquée et comptée avec lui.
   const copie=structuredClone(a);delete copie.id;normalizeActor(copie);
   copie.name=a.name+' (copie)';copie.target=null;copie.checks=[false,false,false];
   actors.push(copie);renderHeroes();render();scheduleSave()}),suppr);
 tete.append(jeton,titre,classe,outils);
 const puces=document.createElement('div');puces.className='chips';
 const marques=[];if(a.sexe)marques.push([(a.sexe==='Femme'?'♀ ':a.sexe==='Homme'?'♂ ':'')+a.sexe]);
 if(a.race)marques.push([a.race]);
 // Le niveau et l'expérience sont des chiffres de fiche : ils se corrigent d'un clic.
 marques.push(['Niveau '+a.level,'level','chip-niveau','Modifier le niveau de '+a.name],
  [(a.xp||0)+' XP','xp','chip-xp','Modifier l’XP de '+a.name]);
 marques.forEach(([t,cle,marque,titre])=>{const p=document.createElement('span');
  p.className='chip'+(marque?' '+marque:'');p.textContent=t;
  if(cle)champVif(p,()=>a[cle]||0,v=>poserCarac(a,cle,v,c),titre,'petit');
  puces.append(p)});
 // Les caractéristiques reprennent les tuiles de la fiche en jeu : libellé au-dessus,
 // valeur en gros, une teinte par caractéristique, l'écu pour la DEF.
 const chiffres=document.createElement('div');chiffres.className='stat-row';
 const tuiles=[['vie','Vie',a.vie,false,a.vieMax??a.vie],['endu','Endu',a.endu],
  ['pv','PV',a.hp,false,a.max],['def','DEF',defOf(a),true],['dmg','Dég.','+'+a.dmg]]
  .map(t=>statTile(...t));
 // Le MJ corrige un chiffre là où il le lit ; la fiche complète reste pour le reste.
 tuilesVives(a,tuiles,[['vie','vieMax'],['endu'],['hp','max'],['def'],['dmg']],c);
 chiffres.append(...tuiles);
 const titreComp=document.createElement('h4');titreComp.className='hero-sous';titreComp.textContent='Compétences';
 const comps=document.createElement('div');comps.className='skills';
 // Un bonus de 0 reste une compétence qu'on teste — le dé de base est toujours lancé.
 skillNames.forEach((n,k)=>{
  const puce=document.createElement('span');puce.className='skill-chip'+(a.skills[k]?'':' zero');
  puce.style.setProperty('--tint',SKILL_TINTS[k]);
  const l=document.createElement('span');l.textContent=n;
  const v=document.createElement('b');v.textContent='+'+a.skills[k];
  champVif(v,()=>a.skills[k],brut=>{const avant=a.skills[k];
   a.skills[k]=readStat('skill',brut,avant);
   if(a.skills[k]!==avant){majFiche(c,a);rendrePlusTard();scheduleSave();
    document.dispatchEvent(new Event('amertume-content-changed'))}},'Modifier '+n+' de '+a.name,'petit');
  puce.append(l,v);comps.append(puce)});

 const titreKit=sousTitre('Équipement','Équiper '+a.name,()=>openPicker(a,'gear'));
 const titreTal=sousTitre('Talents','Ajouter un talent à '+a.name,()=>openPicker(a,'talents'));
 c.append(tete,puces,chiffres,titreComp,comps,titreKit,gearPills(a),titreTal,talentPills(a));return c}
function renderHeroes(){const grille=$('hero-grid');if(!grille)return;grille.replaceChildren();
 const q=($('hero-search').value||'').trim().toLowerCase();
 const troupe=actors.filter(a=>a.hero);
 // Chercher dans quatre fiches n'a pas de sens : le champ ne paraît qu'à partir de neuf.
 $('hero-filtres').hidden=troupe.length<9&&!q;
 const heros=troupe.filter(a=>!q||a.name.toLowerCase().includes(q));
 heros.forEach((a,i)=>grille.append(heroCard(a,i)));
 if(!heros.length){const v=document.createElement('p');v.className='muted';
  v.textContent=q?'Aucun aventurier de ce nom.':'Aucun aventurier dans la troupe.';grille.append(v)}}
$('hero-search').oninput=renderHeroes;
$('hero-add').onclick=()=>openActor(null,true);
/* Une pastille par dé de la réserve, dans l’ordre officiel d’affichage : noir, rouge,
   bleu, vert, jaune, blanc, os. Le Mortel porte un liseré clair, et Lourd, Mystique et
   Mortel une pastille centrale claire — leur face est trop sombre pour l’inverse.
   Le dé est dessiné d'un seul tenant, dans un repère de 22 × 22 : liseré, relief et
   pastille sont mis à l'échelle ensemble. Empilés en boîtes CSS, ils tombaient chacun
   sur une fraction de pixel différente dès que la page n'était pas à 100 %, et l'un
   sortait écrasé, sa pastille avec. Là, quel que soit le zoom, tous sont identiques. */
const DIE_ORDER=[5,2,3,4,6,0,1],DIE_PALE=[5],DIE_LIGHT_PIP=[2,3,5];
const dieCache=new Map();
// Le dé muet porte sa pastille ; le dé qui affiche une valeur s'en passe.
function dieFace(c,muet=true){const cle=c+(muet?'p':'v');if(dieCache.has(cle))return dieCache.get(cle);
 const liseré=DIE_PALE.includes(c)?'rgba(255,255,255,.32)':'rgba(0,0,0,.55)';
 const point=DIE_LIGHT_PIP.includes(c)?'rgba(255,255,255,.6)':'rgba(0,0,0,.45)';
 const svg="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'>"
  +"<defs><linearGradient id='r' x1='0' y1='0' x2='0' y2='1'>"
  +"<stop offset='0' stop-color='#fff' stop-opacity='.18'/>"
  +"<stop offset='.4' stop-color='#fff' stop-opacity='0'/>"
  +"<stop offset='.66' stop-color='#000' stop-opacity='0'/>"
  +"<stop offset='1' stop-color='#000' stop-opacity='.28'/></linearGradient></defs>"
  +"<rect width='22' height='22' rx='5' fill='"+colors[c]+"'/>"
  +"<rect width='22' height='22' rx='5' fill='url(#r)'/>"
  +"<rect x='.75' y='.75' width='20.5' height='20.5' rx='4.25' fill='none' stroke='"+liseré+"' stroke-width='1.5'/>"
  +(muet?"<circle cx='11' cy='11' r='3' fill='"+point+"'/>":"")+"</svg>";
 const url="url(\"data:image/svg+xml,"+encodeURIComponent(svg).replace(/'/g,'%27')+"\")";
 dieCache.set(cle,url);return url}
/* La réserve d'une arme, faces muettes : la carte d'attaque montre ce qui va être lancé,
   pas le résultat — celui-ci roule sur le plateau. */
function poolBadges(pool){const out=document.createElement('span');out.className='pips';
 DIE_ORDER.forEach(c=>{for(let n=0;n<(pool&&pool[c]||0);n++){
  const d=document.createElement('i');d.className='die-sq valeur'+(DIE_LIGHT_PIP.includes(c)?' clair':'');
  d.style.setProperty('--face',dieFace(c,false));d.textContent='?';d.title=types[c];out.append(d)}});
 return out}
/* L'état qu'une arme inflige se lit à gauche de ses dés, à la même taille et sur la même
   ligne : on voit d'un coup ce que le coup pose, sans ouvrir la fiche. Trois états n'ont
   pas de jeton peint — ils se contentent alors de leur initiale, au même gabarit. */
function etatPastille(etat){if(!etat)return null;
 const s=document.createElement('span');s.className='etat-inflige';
 s.title='Inflige '+etat;s.setAttribute('role','img');s.setAttribute('aria-label','Inflige '+etat);
 const nom=STATE_ICONS[etat];
 if(nom){const im=document.createElement('img');im.src=imgUrl(nom+'.png');im.alt='';im.draggable=false;s.append(im)}
 else{s.classList.add('sans-jeton');s.textContent=etat[0]}
 return s}
function dicePips(dice,etat){const out=document.createElement('span');out.className='pips';
 const e=etatPastille(etat);if(e)out.append(e);
 DIE_ORDER.forEach(c=>{for(let n=0;n<(dice&&dice[keys[c]]||0);n++){
  const d=document.createElement('i');d.className='die-sq';
  d.style.setProperty('--face',dieFace(c));d.title=types[c];out.append(d)}});
 return out}
function itemColumn(a){return a.category==='armor'?'armor'
 :a.category==='weapon'?(a.ranged?'ranged':'melee'):'object'}
/* La même pastille qu'à l'armurerie, mais posée : sur une fiche on lit son équipement,
   on ne le modifie pas d'un clic. Les dés de l'arme, la DEF de l'armure, l'effet d'un objet. */
function gearPill(o){const col=itemColumn(o);
 const p=document.createElement('span');p.className='cat-pill k-'+col+(o.consumable?' consommable':'');
 const nom=document.createElement('span');nom.className='nom';nom.textContent=o.name;p.append(nom);
 if(col==='armor')p.append(shieldBadge(o.def||0));
 else if(col==='object'){const t=document.createElement('span');t.className='tag';
  t.textContent=(o.effects||o.notes||'—').slice(0,22);p.append(t)}
 else p.append(dicePips(o.dice,o.etat));
 const info=[o.etat?'inflige '+o.etat:'',o.effects,(o.traits||[]).join(', '),o.notes].filter(Boolean).join(' · ');
 p.title=info?o.name+' — '+info:o.name;
 return p}
function gearPills(a){const out=document.createElement('div');out.className='gear-pills';
 // Deux exemplaires de la même arme font une pastille marquée « ×2 », pas deux jumelles.
 const comptes=new Map();
 [...(a.weapons||[]),a.armorId,a.shieldId].map(gear).filter(Boolean)
  .forEach(o=>comptes.set(o,(comptes.get(o)||0)+1));
 comptes.forEach((n,o)=>{const p=gearPill(o);
  if(n>1){const x=document.createElement('span');x.className='tag exemplaires';x.textContent='×'+n;
   p.querySelector('.nom').after(x)}
  out.append(p)});
 return out}
/* Talents : six natures, chacune sa couleur et son abrégé, comme dans le jeu de table. */
const TALENT_TYPES=[['act','ACT','Action'],['reac','REAC','Réaction'],['pass','PASS','Passif'],
 ['crit','CRIT','Critique'],['mait','MAIT','Maîtrise'],['ame','AME','Amélioration']];
const talentType=t=>TALENT_TYPES.find(x=>x[0]===(t&&t.type))||TALENT_TYPES[0];
const GENERIQUES='Génériques';
// La valeur qui n'est pas une classe mais une invitation à en nommer une.
const AUTRE_CLASSE='__autre';
const talentFamily=t=>(t&&t.famille||'').trim()||GENERIQUES;
function talent(id){return (catalog.talents||[]).find(t=>t&&t.id===id)}
function talentPill(t){const [cle,court,nom]=talentType(t);
 const p=document.createElement('span');p.className='cat-pill t-'+cle;
 const n=document.createElement('span');n.className='nom';n.textContent=t.name;
 const b=document.createElement('span');b.className='t-badge';b.textContent=court;b.title=nom;
 const niv=document.createElement('span');niv.className='tag';niv.textContent='Niv. '+(t.level||1);
 p.append(n,b,niv);
 const info=[talentFamily(t),nom,t.effects,t.notes].filter(Boolean).join(' · ');
 p.title=t.name+' — '+info;
 return p}
function talentPills(a){const out=document.createElement('div');out.className='gear-pills';
 const liste=(a.talents||[]).map(talent).filter(Boolean);
 if(!liste.length){const v=document.createElement('span');v.className='muted';v.textContent='Aucun talent';out.append(v)}
 else liste.forEach(t=>out.append(talentPill(t)));
 return out}
const ARMORY_COLS=[['melee','Armes de mêlée'],['ranged','Armes à distance'],['armor','Armures'],['object','Objets']];
function armoryRow(a,i){const rang=document.createElement('div');rang.className='cat-row';
 const col=itemColumn(a);
 const pill=document.createElement('button');
 pill.className='cat-pill k-'+col+(a.consumable?' consommable':'');
 pill.title='Modifier '+a.name;
 const nom=document.createElement('span');nom.className='nom';nom.textContent=a.name;pill.append(nom);
 if(col==='armor')pill.append(shieldBadge(a.def||0));
 else if(col==='object'){const t=document.createElement('span');t.className='tag';
  t.textContent=(a.effects||a.notes||'—').slice(0,22);pill.append(t)}
 else pill.append(dicePips(a.dice,a.etat));
 pill.onclick=()=>openItem(i);
 const crayon=document.createElement('button');crayon.className='ico';crayon.textContent='✎';
 crayon.title='Modifier';crayon.setAttribute('aria-label','Modifier '+a.name);crayon.onclick=()=>openItem(i);
 rang.append(pill,crayon);return rang}
function renderArmory(){const cols=$('armory-cols');if(!cols)return;cols.replaceChildren();
 const q=($('armory-search').value||'').trim().toLowerCase(),choisie=$('armory-cat').value;
 for(const [key,titre] of ARMORY_COLS){
  if(choisie&&choisie!==key)continue;
  const liste=catalog.items.map((a,i)=>[a,i]).filter(([a])=>itemColumn(a)===key
   &&(!q||a.name.toLowerCase().includes(q)));
  const bloc=document.createElement('div');bloc.className='cat-col';
  const h=document.createElement('h3');h.textContent=titre;
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([a,i])=>bloc.append(armoryRow(a,i)));
  cols.append(bloc)}}
// Quatre types d'adversaires, quatre colonnes : les Alpha manquaient, et leurs
// modèles ne paraissaient donc nulle part.
const BEST_COLS=[['standard','Sbires'],['alpha','Alpha'],['solitaire','Solitaires'],['boss','Boss']];
function danger(m){return (Number(m.xp)||0)*100+(Number(m.pv)||0)}
/* Quelles languettes du bestiaire sont dépliées. Un modèle importé peut n'avoir
   pas d'identifiant : son nom sert alors de clé, faute de mieux. */
const bestiaireOuverts=new Set();
function cleModele(m){return m&&(m.id||'nom:'+m.name)}
const MENACE_NOMS={closest:'Plus proche',pvLow:'PV bas',pvHigh:'PV haut',defLow:'DEF basse'};
const SOCLE_NOMS={small:'Petit socle',medium:'Socle moyen',large:'Grand socle',huge:'Socle énorme'};
/* Le classement des languettes attend qu'on ait fini de taper : reclasser une liste
   au milieu d'une saisie déplacerait sous les doigts la valeur qu'on visait ensuite. */
let reclassement=null;
function reclasserPlusTard(){clearTimeout(reclassement);
 reclassement=setTimeout(function encore(){
  if(champsOuverts){reclassement=setTimeout(encore,220);return}
  renderCatalogPages()},320)}
/* Enregistrer un modèle corrigé. « refaire » distingue les deux façons de le changer :
   un clic (un dé retiré, un choix pris) peut refaire la fiche, puisque le clic a déjà
   été délivré ; une saisie validée, elle, doit se contenter de réécrire les chiffres
   sur place, sans quoi le clic suivant tomberait dans le vide. */
function poserModele(m,f,refaire){const suivis=syncFromTemplate(m);
 if(suivis)log(suivis+' créature(s) « '+m.name+' » sur la table mise(s) à jour.');
 if(refaire&&f)f.replaceChildren(...monsterSheet(m).childNodes);
 else majModele(f,m);
 reclasserPlusTard();render();scheduleSave();
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* Les chiffres d'un modèle réécrits là où ils sont, la languette comprise. */
function majModele(f,m){if(!f)return;
 const ecrire=(sel,texte)=>{const n=f.querySelector(sel);if(n)n.textContent=texte};
 ecrire('.best-ident h4',m.name);
 ecrire('.stat-tile.t-pv strong',m.pv||0);
 ecrire('.stat-tile.t-dmg strong','+'+(m.damage||0));
 ecrire('.stat-tile.t-xp strong',m.xp||0);
 majEcu(f.querySelector('.stat-tile.t-def .ecu'),m.def||0);
 const entree=f.closest('.cat-entry'),languette=entree&&entree.querySelector('.cat-pill .nom');
 if(languette)languette.textContent=m.name}
/* Les dés d'une attaque, réglés au doigt : cliquer un dé le retire, le « + » en
   propose un de chaque couleur. Douze par couleur au plus, comme au formulaire. */
function desVifs(at,poser){const out=document.createElement('span');out.className='pips';
 DIE_ORDER.forEach(c=>{for(let n=0;n<(at.dice&&at.dice[keys[c]]||0);n++){
  const d=document.createElement('button');d.className='die-sq';
  d.style.setProperty('--face',dieFace(c));
  d.title=types[c]+' · cliquer pour retirer ce dé';d.setAttribute('aria-label',d.title);
  if(view==='mj')d.onclick=e=>{e.stopPropagation();
   at.dice[keys[c]]=Math.max(0,(at.dice[keys[c]]||0)-1);poser()};
  else d.disabled=true;
  out.append(d)}});
 if(view!=='mj')return out;
 const plus=document.createElement('button');plus.className='die-ajout';plus.textContent='+';
 plus.title='Ajouter un dé';plus.setAttribute('aria-label','Ajouter un dé');
 plus.onclick=e=>{e.stopPropagation();
  const menu=document.createElement('select');menu.className='champ-vif choix';
  menu.setAttribute('aria-label','Couleur du dé à ajouter');
  menu.add(new Option('Ajouter…',''));DIE_ORDER.forEach(c=>menu.add(new Option(types[c],String(c))));
  plus.replaceWith(menu);menu.focus();
  let clos=false;
  const fermer=garder=>{if(clos)return;clos=true;
   if(menu.parentNode)menu.replaceWith(plus);
   if(garder&&menu.value!==''){const c=Number(menu.value);
    at.dice[keys[c]]=Math.min(12,(at.dice[keys[c]]||0)+1);poser()}};
  menu.onchange=()=>fermer(true);menu.onblur=()=>fermer(false);
  menu.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();fermer(false)}}};
 out.append(plus);return out}
/* Une attaque du modèle : son nom, ses dés, sa portée et ses cibles. Tout se
   corrige sur place ; ce qui reste manuel en jeu est écrit sous la ligne. */
function attaqueVive(m,at,poser,poserTexte){const l=document.createElement('div');l.className='best-attaque';
 const tete=document.createElement('div');tete.className='best-att-tete';
 const nom=document.createElement('b');nom.textContent=at.name||'Attaque';
 champVif(nom,()=>at.name||'',v=>{const t=String(v).trim().slice(0,100);
  if(t&&t!==at.name){at.name=t;nom.textContent=t;poserTexte()}},'Renommer cette attaque','texte');
 tete.append(nom,desVifs(at,poser));
 const bas=document.createElement('div');bas.className='best-att-bas';
 const puce=(texte,valeur,options,titre,ecrire)=>{const p=document.createElement('span');
  p.className='tag-mini';p.textContent=texte;
  return choixVif(p,valeur,options,v=>{ecrire(v);poser()},titre)};
 bas.append(puce(at.range==='distance'?'DISTANCE':'CONTACT',at.range||'contact',
   [['contact','Contact'],['distance','Distance']],'Portée de l’attaque',v=>at.range=v),
  puce(at.targets==='all'?'TOUTES CIBLES':'CIBLE UNIQUE',at.targets||'one',
   [['one','Cible unique'],['all','Toutes cibles (manuel)']],'Cibles de l’attaque',v=>at.targets=v),
  puce(at.useOwnDamage===false?'SANS BONUS':'AVEC BONUS DE DÉGÂTS',at.useOwnDamage===false?'non':'oui',
   [['oui','Ajoute les dégâts du monstre'],['non','Dés seuls']],'Bonus de dégâts',
   v=>at.useOwnDamage=v==='oui'));
 const effetDe=()=>at.effectText||Object.entries(at.effects||{}).filter(([,v])=>v).map(([k])=>k).join(', ');
 const note=document.createElement('span');note.className='tag-mini effet';
 note.textContent=effetDe()?effetDe().toUpperCase():'+ EFFET';
 champVif(note,effetDe,v=>{at.effectText=String(v).trim().slice(0,160);
  note.textContent=at.effectText?at.effectText.toUpperCase():'+ EFFET';poserTexte()},
  'Effets à appliquer à la main','texte');
 bas.append(note);
 const retirer=document.createElement('button');retirer.className='ico danger';retirer.textContent='✕';
 retirer.title='Retirer cette attaque';retirer.setAttribute('aria-label','Retirer l’attaque '+(at.name||''));
 retirer.onclick=e=>{e.stopPropagation();
  // Un adversaire peut se retrouver sans aucune attaque : on le laisse faire.
  m.attacks.splice(m.attacks.indexOf(at),1);poser()};
 if(view==='mj')tete.append(retirer);
 l.append(tete,bas);return l}
/* La fiche d'un modèle, dépliée sous sa languette : le portrait en grand, tous les
   chiffres, les attaques. Le MJ corrige chaque valeur là où il la lit ; les copies
   déjà posées sur la table suivent le plafond de PV, comme depuis la v0.54. */
function monsterSheet(m){const f=document.createElement('div');f.className='best-fiche';
 const poser=()=>poserModele(m,f,true),poserTexte=()=>poserModele(m,f,false);
 const tete=document.createElement('div');tete.className='best-tete';
 tete.append(jetonVif(m,poser));
 const ident=document.createElement('div');ident.className='best-ident';
 const nom=document.createElement('h4');nom.textContent=m.name;
 champVif(nom,()=>m.name,v=>{const t=String(v).trim().slice(0,120);
  if(t&&t!==m.name){m.name=t;poserTexte()}},'Renommer ce modèle','texte');
 const famille=document.createElement('span');famille.className='chip';
 famille.textContent=m.family||'Sans famille';
 champVif(famille,()=>m.family||'',v=>{m.family=String(v).trim().slice(0,60);
  famille.textContent=m.family||'Sans famille';poserTexte()},'Modifier la famille','texte');
 const rangee=document.createElement('div');rangee.className='chips';
 rangee.append(famille,
  choixVif(Object.assign(document.createElement('span'),
   {className:'chip',textContent:TYPE_NOMS[m.type]||'Standard'}),m.type||'standard',
   Object.entries(TYPE_NOMS),v=>{m.type=v;poser()},'Type d’adversaire'),
  /* Le ciblage, comme Rapide et Esquive, est mis de côté chez les adversaires : ni
     pastille, ni case, tant qu'aucune IA ne les fait agir. Les valeurs sont conservées. */
  choixVif(Object.assign(document.createElement('span'),
   {className:'chip',textContent:SOCLE_NOMS[m.socle]||'Socle moyen'}),m.socle||'medium',
   Object.entries(SOCLE_NOMS),v=>{m.socle=v;poser()},'Taille du socle'));
 ident.append(nom,rangee);tete.append(ident);
 // Les mêmes tuiles qu'en jeu : un modèle se lit comme la créature qu'il deviendra.
 const chiffres=document.createElement('div');chiffres.className='stat-row';
 // Une armure portée dicte la DEF : la tuile la montre et ne se corrige plus à la main.
 const defPortee=equippedDef(m,catalog.items);
 const tuiles=[['pv','PV',m.pv||0],['def','DEF',defPortee===null?(m.def||0):defPortee,true],
  ['dmg','Dég.','+'+(m.damage||0)],['xp','XP',m.xp||0]].map(t=>statTile(...t));
 [['pv'],['def'],['damage'],['xp']].forEach(([cle],k)=>{
  if(cle==='def'&&defPortee!==null){tuiles[k].title='DEF donnée par l’armure portée.';return}
  const cible=tuiles[k].querySelector('.ecu')||tuiles[k].querySelector('strong');
  if(cible)champVif(cible,()=>m[cle]||0,v=>{const avant=m[cle];writeStat(m,cle,v);
   if(m[cle]!==avant)poserTexte()},'Modifier '+cle.toUpperCase()+' de '+m.name)});
 chiffres.append(...tuiles);
 const titreAtt=document.createElement('h5');titreAtt.textContent='Attaques';
 if(view==='mj'){const ajout=document.createElement('button');ajout.className='ico plus';
  ajout.textContent='+';ajout.title='Ajouter une attaque';
  ajout.setAttribute('aria-label','Ajouter une attaque à '+m.name);
  ajout.onclick=e=>{e.stopPropagation();m.attacks=[...(m.attacks||[]),
   {name:'Nouvelle attaque',dice:diceFrom([1,0,0,0,0,0,0]),range:'contact',targets:'one',
    useOwnDamage:true,effects:{}}];poser()};
  titreAtt.append(ajout)}
 const listeAtt=document.createElement('div');listeAtt.className='best-attaques';
 (m.attacks||[]).forEach(at=>listeAtt.append(attaqueVive(m,at,poser,poserTexte)));
 /* Un adversaire s'équipe comme un aventurier, et ce qu'il porte lui donne une attaque
    de plus. Le modèle transporte donc son équipement, et les créatures posées le reçoivent. */
 const titreKit=document.createElement('h5');titreKit.textContent='Équipement';
 if(view==='mj'){const plus=document.createElement('button');plus.className='ico plus';
  plus.textContent='+';plus.title='Équiper '+m.name;
  plus.setAttribute('aria-label','Équiper '+m.name);
  plus.onclick=e=>{e.stopPropagation();openPicker(m,'gear',()=>poserModele(m,f,true))};
  titreKit.append(plus)}
 const kit=gearPills(m);
 const titreNotes=document.createElement('h5');titreNotes.textContent='Notes';
 const notes=document.createElement('p');notes.className='best-notes'+(m.notes?'':' muted');
 notes.textContent=m.notes||'—';
 champVif(notes,()=>m.notes||'',v=>{m.notes=String(v).slice(0,600);
  notes.textContent=m.notes||'—';notes.classList.toggle('muted',!m.notes);poserTexte()},
  'Talents, inventaire et notes · Entrée saute une ligne, sortir du champ enregistre','zone');
 f.append(tete,chiffres,titreAtt,listeAtt,titreKit,kit,titreNotes,notes);
 return f}
function bestiaryRow(m,i){const rang=document.createElement('div');rang.className='cat-row';
 const pill=document.createElement('button');pill.className='cat-pill k-'+(m.type||'standard');
 const nom=document.createElement('span');nom.className='nom';nom.textContent=m.name;
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';
 pill.append(jetonRond(m.image,m.name,'mini'),nom,chev);
 // Corriger une valeur redessine la page : la languette ouverte doit le rester.
 const detail=document.createElement('div');detail.className='cat-detail';
 detail.hidden=!bestiaireOuverts.has(cleModele(m));
 pill.classList.toggle('ouvert',!detail.hidden);
 if(!detail.hidden)detail.append(monsterSheet(m));
 /* Une meute se pose d'un coup : le chiffre dit combien de créatures partent sur la carte. */
 const pose=document.createElement('div');pose.className='pose-nombre';
 const combien=document.createElement('input');combien.type='number';combien.min='1';combien.max='20';
 combien.value='1';combien.setAttribute('aria-label','Nombre de '+m.name+' à poser');
 const poser=document.createElement('button');poser.dataset.catAdd=i;poser.textContent='Ajouter à la carte';
 pose.append(combien,poser);detail.append(pose);
 poser.onclick=()=>{saveChecks();savePool();
  const n=Math.max(1,Math.min(20,Math.trunc(Number(combien.value))||1));
  for(let k=0;k<n;k++){const a=fromMonster(catalog.monsters[i]);
   a.x=30+Math.random()*40;a.y=20+Math.random()*30;normalizeActor(a);actors.push(a);
   settleActor(a);selected=actors.length-1}
  markOnly(selected);showPage('table');render();scheduleSave();
  log(n>1?n+' × '+m.name+' ajoutés à la carte.':m.name+' ajouté à la carte.')};
 pill.onclick=()=>{const ouvrir=detail.hidden;
  if(ouvrir)bestiaireOuverts.add(cleModele(m));else bestiaireOuverts.delete(cleModele(m));
  detail.hidden=!ouvrir;pill.classList.toggle('ouvert',ouvrir);
  if(ouvrir&&!detail.querySelector('.best-fiche'))detail.prepend(monsterSheet(m))};
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(glyphe,titre,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=glyphe;
  b.title=titre;b.setAttribute('aria-label',titre+' '+m.name);b.onclick=fn;return b};
 /* La coche dit que la troupe a percé l'espèce. Le MJ la lève d'un clic : les créatures
    de ce modèle redeviennent des inconnues sur tous les écrans. */
 if(view==='mj'&&modeleAnalyse(m)){const coche=ico('✓','Analysé par la troupe — cliquer pour le lui reprendre',()=>{
  const n=oublierAnalyse(m);if(!n)return;
  log(m.name+' n’est plus analysé'+(n>1?' ('+n+' créatures)':'')+'.');
  renderCatalogPages();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))});
  coche.classList.add('coche-analyse');outils.append(coche)}
 const suppr=ico('✕','Supprimer',()=>{
  if(!confirm('Supprimer « '+m.name+' » du bestiaire ? Les copies déjà sur la carte sont conservées.'))return;
  catalog.monsters.splice(i,1);renderCatalogPages();scheduleSave()});
 suppr.dataset.catDelete=i;suppr.classList.add('danger');
 outils.append(ico('✎','Modifier',()=>openActor(null,false,i)),
  ico('⧉','Dupliquer',()=>{const copie=structuredClone(m);copie.id=crypto.randomUUID();
   copie.name=m.name+' (copie)';catalog.monsters.splice(i+1,0,copie);renderCatalogPages();scheduleSave()}),
  suppr);
 const bloc=document.createElement('div');bloc.className='cat-entry';
 rang.append(pill,outils);bloc.append(rang,detail);return bloc}
/* Un modèle est « analysé » dès qu'une des créatures posées qui en descend l'a été :
   c'est l'espèce que la troupe a percée, pas l'individu. */
function modeleAnalyse(m){return actors.some(a=>!a.hero&&a.revealed
 &&(a.template?a.template===m.id:a.name===m.name))}
function oublierAnalyse(m){let n=0;
 actors.forEach(a=>{if(!a.hero&&a.revealed&&(a.template?a.template===m.id:a.name===m.name)){a.revealed=false;n++}});
 return n}
function renderBestiary(){const cols=$('bestiary-cols');if(!cols)return;cols.replaceChildren();
 // La troupe ne lit au bestiaire que ce qu'elle a analysé.
 const troupeSeule=view!=='mj';
 const q=($('bestiary-search').value||'').trim().toLowerCase();
 const familles=[...new Set(catalog.monsters.map(m=>m.family).filter(Boolean))].sort();
 const sel=$('bestiary-family'),avant=sel.value;
 sel.replaceChildren(new Option('Toutes familles',''));
 familles.forEach(f=>sel.add(new Option(f,f)));
 sel.value=familles.includes(avant)?avant:'';
 const tri=$('bestiary-sort').value;
 for(const [key,titre] of BEST_COLS){
  let liste=catalog.monsters.map((m,i)=>[m,i]).filter(([m])=>(m.type||'standard')===key
   &&(!q||m.name.toLowerCase().includes(q))&&(!sel.value||m.family===sel.value)
   &&(!troupeSeule||modeleAnalyse(m)));
  liste.sort((a,b)=>tri==='nom'?a[0].name.localeCompare(b[0].name)
   :tri==='danger-'?danger(a[0])-danger(b[0]):danger(b[0])-danger(a[0]));
  const bloc=document.createElement('div');bloc.className='cat-col c-'+key;
  const h=document.createElement('h3');h.textContent=titre;
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([m,i])=>bloc.append(bestiaryRow(m,i)));
  cols.append(bloc)}}
/* Une colonne par classe, les Génériques en tête : c'est ainsi qu'on lit un arbre de
   talents, la souche commune d'abord et les branches ensuite. */
function talentFamilies(){
 // Les classes du jeu ont leur colonne même vide : c'est là qu'on vient poser leurs talents.
 const noms=[...(catalog.classes||[]).map(c=>c&&c.name).filter(Boolean),
  ...(catalog.talents||[]).map(talentFamily)];
 const autres=[...new Set(noms)].filter(f=>f!==GENERIQUES).sort((a,b)=>a.localeCompare(b,'fr'));
 return [GENERIQUES,...autres]}
// L'encre d'une classe, pour un intitulé de colonne ou une languette.
function teinteClasse(nom){const c=classeDe(catalog.classes,nom);return c&&c.tint||''}
function talentRow(t,i){const rang=document.createElement('div');rang.className='cat-row';
 const pill=talentPill(t);pill.classList.add('cliquable');
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';pill.append(chev);
 const detail=document.createElement('div');detail.className='cat-detail';detail.hidden=true;
 /* La languette dit déjà le nom, le type et le niveau, et la colonne dit la classe :
    la ligne qui les répétait en tête du dépliant ne servait à rien. */
 const effet=document.createElement('span');effet.className='muted';
 effet.textContent=t.effects||'Effet à préciser.';
 detail.append(effet);
 if(t.notes){const n=document.createElement('span');n.className='muted';n.textContent=t.notes;detail.append(n)}
 const porteurs=actors.filter(a=>(a.talents||[]).includes(t.id)).map(a=>a.name);
 const qui=document.createElement('span');qui.className='muted';
 qui.textContent=porteurs.length?'Appris par : '+porteurs.join(', '):'Appris par personne.';
 detail.append(qui);
 pill.onclick=()=>{detail.hidden=!detail.hidden;pill.classList.toggle('ouvert',!detail.hidden)};
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(glyphe,titre,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=glyphe;
  b.title=titre;b.setAttribute('aria-label',titre+' '+t.name);b.onclick=fn;return b};
 const suppr=ico('✕','Supprimer',()=>{
  const pris=actors.filter(a=>(a.talents||[]).includes(t.id)).length;
  if(!confirm('Supprimer « '+t.name+' » ?'+(pris?' Il est appris par '+pris+' aventurier(s), qui le perdront.':'')))return;
  actors.forEach(a=>{if(a.talents)a.talents=a.talents.filter(x=>x!==t.id)});
  catalog.talents.splice(i,1);renderCatalogPages();render();scheduleSave()});
 suppr.classList.add('danger');
 outils.append(ico('✎','Modifier',()=>openTalent(i)),
  ico('⧉','Dupliquer',()=>{const copie=structuredClone(t);copie.id=crypto.randomUUID();
   copie.name=t.name+' (copie)';catalog.talents.splice(i+1,0,copie);renderCatalogPages();scheduleSave()}),
  suppr);
 const bloc=document.createElement('div');bloc.className='cat-entry';
 rang.append(pill,outils);bloc.append(rang,detail);return bloc}
/* Ce que le moteur sait appliquer, tel qu'il le déclare : le nom de la mécanique, ce
   qu'elle fait, et les réglages qu'elle attend avec leurs bornes. Rien n'est écrit ici en
   double — tout vient de la déclaration, donc la liste ne peut pas mentir. */
function renderBiblioEffets(){const boite=$('biblio-effets');if(!boite)return;
 const codes=Object.values(TALENTS_CODES);
 const compte=$('biblio-compte');
 if(compte)compte.textContent=codes.length;
 boite.replaceChildren();
 const porteurs=cle=>(catalog.talents||[]).filter(t=>t&&t.effet===cle);
 /* Une ligne par effet : son nom, puis la phrase que le moteur appliquera, réglages en
    gras. La phrase vient du moteur lui-même, jamais recopiée ici. */
 codes.forEach(c=>{const bloc=document.createElement('div');bloc.className='effet-fiche';
  const nom=document.createElement('span');nom.className='nom-effet';nom.textContent=c.nom+' : ';
  const dit=document.createElement('span');dit.innerHTML=phraseTalent(c.cle);
  bloc.append(nom,dit);
  const pris=porteurs(c.cle);
  if(pris.length){const tag=document.createElement('span');tag.className='tag';
   tag.textContent=' — '+pris.map(t=>t.name).join(', ');bloc.append(tag)}
  boite.append(bloc)});
 if(!codes.length){const v=document.createElement('p');v.className='muted';
  v.textContent='Aucun effet câblé pour l’instant.';boite.append(v)}}
function renderTalents(){renderBiblioEffets();const cols=$('talent-cols');if(!cols)return;cols.replaceChildren();
 const q=($('talent-search').value||'').trim().toLowerCase();
 const familles=talentFamilies(),sel=$('talent-family'),avant=sel.value;
 sel.replaceChildren(new Option('Toutes classes',''));
 familles.forEach(f=>sel.add(new Option(f,f)));
 sel.value=familles.includes(avant)?avant:'';
 const tri=$('talent-sort').value;
 const visibles=sel.value?[sel.value]:familles;
 for(const famille of visibles){
  const liste=(catalog.talents||[]).map((t,i)=>[t,i]).filter(([t])=>talentFamily(t)===famille
   &&(!q||t.name.toLowerCase().includes(q)||(t.effects||'').toLowerCase().includes(q)));
  liste.sort((a,b)=>tri==='nom'?a[0].name.localeCompare(b[0].name,'fr')
   :tri==='niveau-'?(b[0].level||1)-(a[0].level||1)||a[0].name.localeCompare(b[0].name,'fr')
   :(a[0].level||1)-(b[0].level||1)||a[0].name.localeCompare(b[0].name,'fr'));
  const bloc=document.createElement('div');bloc.className='cat-col'+(famille===GENERIQUES?' c-generique':'');
  const h=document.createElement('h3');h.textContent=famille;
  // Seule l'encre distingue une classe : les bandeaux restent sans fond, comme partout.
  const encre=teinteClasse(famille);if(encre)h.style.color=encre;
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([t,i])=>bloc.append(talentRow(t,i)));
  cols.append(bloc)}
}
$('talent-search').oninput=renderTalents;$('talent-family').onchange=renderTalents;
$('talent-sort').onchange=renderTalents;
$('talent-add').onclick=()=>openTalent(null);
const talentDialog=dialog('talent-editor','Talent','<form id="talent-form"><div id="talent-fields"></div><div class="form-actions"><button type="button" id="delete-talent">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
let talentIndex=null,talentApres=null,talentDraft={effet:'',params:{}};
/* Fermé sans enregistrer, le dialogue ne doit rien rappeler : sinon une création faite
   plus tard depuis l'armurerie irait se cocher dans une fiche déjà refermée. */
talentDialog.addEventListener('close',()=>{talentApres=null});
/* Les réglages d'un effet sont dessinés d'après sa déclaration : ajouter un effet au
   moteur suffit à lui donner son formulaire, sans toucher à celui-ci. */
function lireReglagesTalent(){const f=$('talent-form').elements,out={};
 for(const el of f)if(el.name&&el.name.startsWith('p_'))out[el.name.slice(2)]=el.value;
 return out}
function dessineReglagesTalent(){const boite=$('talent-reglages');if(!boite)return;
 const code=TALENTS_CODES[$('talent-form').elements.effet.value]||null;
 if(!code){boite.replaceChildren();return}
 const vals=paramsTalent({effet:code.cle,params:talentDraft.params});
 boite.innerHTML='<div class="edit-grid">'
  +(code.params||[]).map(p=>p.type==='nombre'
   ?field(p.nom,'p_'+p.cle,vals[p.cle],'number','min="'+p.min+'" max="'+p.max+'"')
   :sel(p.nom,'p_'+p.cle,vals[p.cle],p.options)).join('')+'</div>'}
function openTalent(i=null,apres=null){if(view!=='mj')return;talentIndex=i;talentApres=apres;
 const t=i===null?{name:'Nouveau talent',famille:GENERIQUES,type:'act',level:1,effect:'',effets:'',effects:'',notes:'',effet:'',params:{}}:catalog.talents[i];
 if(i!==null&&!t)return;
 talentDraft={effet:t.effet||'',params:{...(t.params||{})}};
 /* Les classes offertes : celles du jeu, celles déjà portées par un talent, et celles que
    la troupe s'est données. La classe du talent ouvert y figure toujours, fût-elle inédite. */
 const familles=[...new Set([GENERIQUES,...talentFamilies(),
  ...actors.filter(a=>a.hero).map(a=>(a.role||'').split('·')[0].trim()).filter(Boolean),
  talentFamily(t)])];
 const famille=talentFamily(t);
 $('talent-fields').innerHTML='<div class="edit-grid quatre">'
  +field('Nom','name',t.name,'text','required maxlength="120"')
  /* Un vrai menu, et non plus une liste de suggestions : un datalist ne propose que ce
     qui ressemble à ce qui est déjà écrit, et le champ arrivant rempli de « Génériques »,
     il n'offrait que « Génériques ». Une classe inédite reste possible, par la dernière
     entrée du menu, qui ouvre un champ libre. */
  +sel('Classe','famille',famille,[...familles.map(f=>[f,f]),[AUTRE_CLASSE,'✎ Autre classe…']])
  +sel('Type','type',t.type||'act',TALENT_TYPES.map(([k,,nom])=>[k,nom]))
  +field('Niveau','level',t.level||1,'number','min="1" max="20"')+'</div>'
  +'<div id="famille-autre" hidden><label>Nom de la nouvelle classe<input name="familleLibre" maxlength="60" value=""></label></div>'
  +'<label>Effet<textarea name="effects" rows="3" maxlength="600">'+esc(t.effects||'')+'</textarea></label>'
  /* Le texte ci-dessus se lit à la table ; celui-ci agit. On choisit l'effet dans la liste
     de ce que le moteur sait faire, puis on en règle les valeurs — plus besoin que le nom
     du talent tombe juste. */
  +'<h2 class="sous-titre">Effet appliqué par le moteur</h2>'
  +sel('Mécanique','effet',t.effet||'',[['','— Aucun : talent descriptif —'],
   ...Object.values(TALENTS_CODES).map(c=>[c.cle,libelleTalent(c.cle)])])
  +'<div id="talent-reglages"></div>';
 /* « Autre classe… » ouvre le champ libre et lui donne la main ; revenir sur une classe
    connue le referme, et ce qui y était tapé ne compte plus. */
 const fam=$('talent-form').elements.famille;
 fam.onchange=()=>{const autre=fam.value===AUTRE_CLASSE;$('famille-autre').hidden=!autre;
  if(autre){const champ=$('talent-form').elements.familleLibre;champ.value='';champ.focus()}};
 const menu=$('talent-form').elements.effet;
 menu.onchange=()=>{talentDraft.params=lireReglagesTalent();talentDraft.effet=menu.value;dessineReglagesTalent()};
 dessineReglagesTalent();
 $('delete-talent').hidden=i===null;talentDialog.showModal()}
$('talent-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 const f=$('talent-form').elements;
 const t=talentIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.talents[talentIndex]);
 t.name=f.name.value.trim()||'Talent';
 t.famille=(f.famille.value===AUTRE_CLASSE?f.familleLibre.value:f.famille.value).trim()||GENERIQUES;
 t.type=f.type.value;t.level=num(f.level.value,1,20);
 t.effects=f.effects.value.trim();if(f.notes)t.notes=f.notes.value.trim();
 // L'effet et ses réglages, relus au travers de leur déclaration : rien d'illisible n'entre.
 t.effet=TALENTS_CODES[f.effet.value]?f.effet.value:'';
 t.params=t.effet?paramsTalent({effet:t.effet,params:lireReglagesTalent()}):{};
 if(talentIndex===null)catalog.talents.push(t);else catalog.talents[talentIndex]=t;
 talentDialog.close();renderCatalogPages();render();scheduleSave();
 const rappel=talentApres;talentApres=null;if(rappel)rappel(t)};
$('delete-talent').onclick=()=>{if(talentIndex===null)return;
 const t=catalog.talents[talentIndex];
 const pris=actors.filter(a=>(a.talents||[]).includes(t.id)).length;
 if(!confirm('Supprimer « '+t.name+' » ?'+(pris?' Il est appris par '+pris+' aventurier(s), qui le perdront.':'')))return;
 actors.forEach(a=>{if(a.talents)a.talents=a.talents.filter(x=>x!==t.id)});
 catalog.talents.splice(talentIndex,1);talentDialog.close();renderCatalogPages();render();scheduleSave()};
/* Équiper depuis la carte. Le catalogue s'ouvre en pastilles ; cliquer l'une d'elles
   la met en main ou la retire. Deux armes au plus, une armure, un bouclier : quand les
   emplacements sont pris, on le dit au lieu de remplacer en silence. La DEF et la réserve
   de dés découlent de l'équipement, elles sont donc recalculées à chaque changement. */
/* Après un changement d'équipement. La DEF d'un aventurier est celle de ce qu'il porte
   et se réécrit ici ; celle d'un adversaire lui reste propre — son armure s'y ajoute à la
   lecture, jamais dans sa fiche, sans quoi elle grossirait à chaque passage. Un modèle de
   bestiaire n'a ni PV du moment ni réserve : on ne lui écrit rien. */
function syncEquipped(a){if(!a||!Number.isFinite(a.max))return;
 if(a.hero)a.def=defenseOf(a,catalog.items);
 a.pool=poolFrom(chosenAttack(a,catalog.items).dice)||a.pool}
/* Combien d'exemplaires d'un objet un aventurier porte. La plupart des armes se
   tiennent à deux mains, et rien n'interdit d'en avoir deux du même modèle : leurs
   dés s'additionnent comme ceux de deux armes différentes. */
function gearCount(a,id){return (a&&a.weapons||[]).filter(x=>x===id).length}
/* Un clic fait le tour : rien, un exemplaire, deux, puis rien de nouveau. Les deux
   mains restent la limite — le second exemplaire prend la place d'une autre arme. */
function toggleGear(a,o){
 /* Reposer ce qu'on porte passe avant tout : une main pleine ne doit jamais empêcher de
    la vider. Avec deux armes différentes en main, cliquer l'une d'elles ne pouvait que
    proposer d'en prendre un second exemplaire — impossible, faute de main libre — et il
    devenait impossible de rien retirer. On repose donc dès qu'il n'y a plus de place
    pour un doublon ; le second exemplaire, lui, reste à un clic quand la main est libre. */
 if(o.category==='weapon'){const n=gearCount(a,o.id),total=(a.weapons||[]).length;
  if(n>=2||(n===1&&total>=2))a.weapons=(a.weapons||[]).filter(x=>x!==o.id);
  else if(total>=2)return 'Deux armes déjà en main : retires-en une d’abord.';
  else a.weapons=[...(a.weapons||[]),o.id]}
 else if(o.category==='armor'){const cle=o.slot==='shield'?'shieldId':'armorId';
  a[cle]=a[cle]===o.id?'':o.id}
 else return 'Cet objet n’a pas d’emplacement : il se note dans l’inventaire de la fiche.';
 syncEquipped(a);return null}
const pickerDialog=dialog('picker','Équiper','<p class="muted" id="picker-note"></p>'
 +'<input id="picker-search" placeholder="Rechercher…" aria-label="Rechercher">'
 +'<div id="picker-body"></div>');
let pickerActeur=null,pickerMode='gear',pickerApres=null;
function openPicker(a,mode,apres){if(view!=='mj')return;pickerActeur=a;pickerMode=mode;pickerApres=apres||null;
 pickerDialog.querySelector('h2').textContent=(mode==='gear'?'Équiper ':'Talents de ')+a.name;
 $('picker-note').textContent=mode==='gear'
  ?'Clique une arme pour la prendre, une deuxième fois pour en porter deux exemplaires — leurs dés s’additionnent — une troisième pour tout reposer. Clique une arme portée pour la reposer quand les deux mains sont prises. Deux armes en main au plus, une armure, un bouclier.'
  :'Clique un talent pour l’apprendre ou l’oublier.';
 $('picker-search').value='';$('picker-search').oninput=renderPicker;
 renderPicker();pickerDialog.showModal()}
function renderPicker(){const corps=$('picker-body');if(!corps||!pickerActeur)return;corps.replaceChildren();
 const a=pickerActeur,q=($('picker-search').value||'').trim().toLowerCase();
 const groupe=(titre,liste,porte,pastille,clic)=>{if(!liste.length)return;
  const bloc=document.createElement('div');bloc.className='pick-famille';
  const h=document.createElement('h3');h.textContent=titre;
  const compte=document.createElement('span');compte.className='compte';
  compte.textContent=liste.filter(porte).length+' / '+liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(o=>{const rang=document.createElement('button');rang.className='pick-ligne'+(porte(o)?' porte':'');
   rang.append(pastille(o));
   const etat=document.createElement('span');etat.className='pick-etat';
   // Une arme portée en double le dit : « ×2 » plutôt qu'un coché muet.
   const n=pickerMode==='gear'&&o.category==='weapon'?gearCount(a,o.id):0;
   etat.textContent=n>1?'×'+n:porte(o)?'✓':'+';rang.append(etat);
   rang.onclick=()=>clic(o);bloc.append(rang)});
  corps.append(bloc)};
 if(pickerMode==='gear'){
  const porte=o=>o.category==='weapon'?gearCount(a,o.id)>0:(a.armorId===o.id||a.shieldId===o.id);
  const clic=o=>{const souci=toggleGear(a,o);
   if(souci){$('picker-note').textContent=souci;return}
   renderPicker();if(pickerApres)pickerApres();else{renderHeroes();render();scheduleSave()}};
  const filtre=p=>catalog.items.filter(o=>p(o)&&(!q||o.name.toLowerCase().includes(q)));
  groupe('Armes de mêlée',filtre(o=>o.category==='weapon'&&!o.ranged),porte,gearPill,clic);
  groupe('Armes à distance',filtre(o=>o.category==='weapon'&&o.ranged),porte,gearPill,clic);
  groupe('Armures',filtre(o=>o.category==='armor'&&o.slot!=='shield'),porte,gearPill,clic);
  groupe('Boucliers',filtre(o=>o.category==='armor'&&o.slot==='shield'),porte,gearPill,clic);
  if(!corps.childElementCount){const v=document.createElement('p');v.className='muted';
   v.textContent=q?'Aucun objet de ce nom.':'L’armurerie est vide : crée un objet dans l’onglet Armurerie.';
   corps.append(v)}}
 else{
  a.talents??=[];
  const porte=t=>a.talents.includes(t.id);
  const clic=t=>{a.talents=porte(t)?a.talents.filter(x=>x!==t.id):[...a.talents,t.id];
   renderPicker();renderHeroes();render();scheduleSave()};
  const sienne=(a.role||'').split('·')[0].trim(),toutes=talentFamilies();
  const tete=[GENERIQUES,...(sienne&&toutes.includes(sienne)?[sienne]:[])];
  for(const famille of [...tete,...toutes.filter(f=>!tete.includes(f))])
   groupe(famille,(catalog.talents||[]).filter(t=>talentFamily(t)===famille
    &&(!q||t.name.toLowerCase().includes(q)||(t.effects||'').toLowerCase().includes(q)))
    .sort((x,y)=>(x.level||1)-(y.level||1)||x.name.localeCompare(y.name,'fr')),porte,talentPill,clic);
  if(!corps.childElementCount){const v=document.createElement('p');v.className='muted';
   v.textContent=q?'Aucun talent de ce nom.':'Aucun talent au catalogue : crée-en un dans l’onglet Talents.';
   corps.append(v)}}}
/* Les réglages de l'appareil : le thème et les touches de la carte. Rien n'est enregistré
   dans la partie — c'est le navigateur qui s'en souvient, pour ce poste seulement. */
function renderSettings(){const boite=$('raccourcis');if(!boite)return;
 $('theme-switch').textContent=document.body.classList.contains('sombre')?'☀ Repasser au thème clair':'☾ Passer au mode nuit';
 // La scène n'a plus de bandeau au-dessus de la table : son titre se lit et se change ici.
 $('bloc-scene').hidden=view!=='mj';
 $('scene-titre').textContent=sceneTitle();
 $('scene-tour').textContent='Tour de combat '+String(round).padStart(2,'0');
 if(saveLabel.parentNode!==$('bloc-sauvegarde'))$('bloc-sauvegarde').append(saveLabel);
 boite.replaceChildren(...GESTES.map(([cle,nom,aide])=>{
  const ligne=document.createElement('div');ligne.className='reglage';
  const gauche=document.createElement('div');
  const t=document.createElement('strong');t.textContent=nom;
  const p=document.createElement('p');p.className='muted';p.textContent=aide;
  gauche.append(t,p);
  const sel=document.createElement('select');sel.id='rac-'+cle;
  sel.setAttribute('aria-label','Touche pour « '+nom+' »');
  // Sans touche, la sélection se fait au clic nu ; tout autre geste devient inatteignable.
  TOUCHES.forEach(([v,l])=>sel.add(new Option(v===''&&cle!=='select'?'Aucune (désactivé)':l,v)));
  sel.value=raccourcis[cle];
  // Une touche déjà prise n'est pas refusée : les deux gestes l'échangent. Refuser en
  // silence donnait l'impression que rien ne s'enregistrait — c'était le contraire.
  sel.onchange=()=>{const avant=raccourcis[cle],pris=GESTES.find(([k])=>k!==cle&&raccourcis[k]===sel.value&&sel.value);
   raccourcis[cle]=sel.value;
   if(pris)raccourcis[pris[0]]=avant;
   saveShortcuts();renderSettings();
   noterReglage(pris?'Enregistré · « '+pris[1]+' » prend '+(TOUCHES.find(([v])=>v===avant)[1])+' en échange.'
    :'Enregistré sur cet appareil.')};
  ligne.append(gauche,sel);return ligne}))}
$('theme-switch').onclick=toggleTheme;
$('raccourcis-reset').onclick=()=>{raccourcis={...RACCOURCIS_DEFAUT};saveShortcuts();renderSettings();
 noterReglage('Touches d’origine rétablies et enregistrées.')};
/* Les réglages s'enregistrent à l'instant même : on le dit, faute de quoi rien ne
   distingue un réglage pris en compte d'un réglage perdu. */
let reglageTimer;
function noterReglage(texte){const n=$('raccourcis-erreur');if(!n)return;
 n.textContent='✓ '+texte;n.classList.add('ok');clearTimeout(reglageTimer);
 reglageTimer=setTimeout(()=>{n.textContent='';n.classList.remove('ok')},3200)}
function renderCatalogPages(){renderHeroes();renderTalents();renderArmory();renderBestiary()}
$('armory-search').oninput=renderArmory;$('armory-cat').onchange=renderArmory;
$('armory-add').onclick=()=>openItem(null);
$('armory-official').onclick=()=>{
 if(!confirm('Réinstaller le catalogue officiel d’amertume_rpg ? Les objets que tu as ajoutés sont conservés, les objets officiels reprennent leurs valeurs d’origine.'))return;
 const officiels=AMERTUME_CATALOG.items.filter(o=>o.official);
 const gardes=catalog.items.filter(a=>!officiels.some(o=>o.name===a.name));
 catalog.items=[...structuredClone(officiels),...gardes];
 renderArmory();scheduleSave();log('Catalogue officiel réinstallé.')};
$('bestiary-search').oninput=renderBestiary;$('bestiary-family').onchange=renderBestiary;
$('bestiary-sort').onchange=renderBestiary;
$('bestiary-add').onclick=()=>openActor(null,false);
const itemDialog=dialog('item-editor','Objet','<form id="item-form"><div id="item-fields"></div><div class="form-actions"><button type="button" id="delete-item">Supprimer du catalogue</button><button class="primary">Enregistrer</button></div></form>');
itemDialog.addEventListener('close',()=>{itemApres=null});
const imgDialog=dialog('image-editor','Optimiser l’image','<div class="edit-grid"><label>Taille maximale<select id="image-size"></select></label><label>Qualité WebP<input id="image-quality" type="range" min="70" max="100" value="90"><span id="quality-label">90 %</span></label><div><button id="image-recalc">Refaire l’aperçu</button></div></div><div id="token-frame" hidden><p>Cadrage du socle</p><div class="cadre-rond"><canvas id="token-canvas" width="220" height="220" aria-label="Aperçu du socle"></canvas></div><div class="cadre-reglages"><label>Zoom<input id="token-zoom" type="range" min="40" max="320" value="100"></label><span id="token-zoom-label">100 %</span><button type="button" id="token-center">Recentrer</button></div><p class="muted">Glisse l’image dans le rond pour la déplacer ; la molette zoome. La copie optimisée se refait toute seule après chaque réglage.</p></div><div class="image-comparison"><div><p>Original</p><img id="image-before" alt="Image originale"><p class="muted" id="before-info"></p></div><div><p>Copie optimisée</p><img id="image-after" alt="Image optimisée"><p class="muted" id="after-info"></p></div></div><p class="form-error" id="image-error" role="alert"></p><p class="muted">Proportions et transparence conservées. L’original n’est pas modifié. PNG de secours si WebP indisponible.</p><div class="form-actions"><button id="image-cancel">Annuler</button><button class="primary" id="image-accept" disabled>Utiliser cette image</button></div>');
function field(label,key,value,type='text',extra=''){return '<label>'+label+'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
function sel(label,key,value,opts){return '<label>'+label+'<select name="'+key+'">'+opts.map(([v,t])=>'<option value="'+v+'" '+(String(value)===String(v)?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'}
/* Le choix des dés se fait au doigt : une pastille par couleur, teintée comme le dé
   lui-même, avec un moins et un plus de part et d'autre du compte. Le champ de saisie
   reste au milieu, sans bordure — on peut toujours taper un chiffre, et le formulaire le
   lit exactement comme avant. L'ordre est celui de la table : noir, rouge, bleu, vert,
   jaune, blanc, os. Le dé de Faille n'y est pas : il ne fait pas partie d'une réserve,
   il se lance à part. */
function poolFields(p,prefix){return '<div class="mini-pool">'+DIE_ORDER.map(c=>
 '<div class="die-pick'+(DARK_DIE.includes(c)?'':' clair')+'" title="'+esc(types[c])+'">'
 +'<i class="die-sq" data-c="'+c+'" aria-hidden="true"></i>'
 +'<button type="button" data-pas="-1" data-champ="'+prefix+c+'" aria-label="Un dé '+esc(types[c])+' de moins">−</button>'
 +'<input name="'+prefix+c+'" type="number" min="0" max="12" value="'+(p[c]||0)+'" aria-label="Dés '+esc(types[c])+'">'
 +'<button type="button" data-pas="1" data-champ="'+prefix+c+'" aria-label="Un dé '+esc(types[c])+' de plus">+</button>'
 +'</div>').join('')+'</div>'}
/* La face du dé est une image construite en mémoire : on la pose après coup, plutôt que
   de la glisser dans l'attribut style où ses guillemets se battraient avec les nôtres. */
function habilleDes(racine){(racine||document).querySelectorAll('.die-pick').forEach(el=>{
 const i=el.querySelector('.die-sq[data-c]');if(!i)return;const c=Number(i.dataset.c);
 i.style.setProperty('--face',dieFace(c));el.style.setProperty('--teinte',colors[c])})}
// Les deux boutons d'une pastille agissent sur le champ qu'ils encadrent, où qu'il soit.
document.addEventListener('click',e=>{const b=e.target.closest('.die-pick [data-champ]');if(!b)return;
 e.preventDefault();const form=b.closest('form');const ch=form&&form.elements[b.dataset.champ];if(!ch)return;
 ch.value=Math.max(0,Math.min(12,(Number(ch.value)||0)+Number(b.dataset.pas)));
 ch.dispatchEvent(new Event('change',{bubbles:true}))});
let editing=null,draft=null,attackDraft=[],templateIndex=null,itemIndex=null,itemApres=null,itemDraft=null;
function baseActor(hero){return normalizeActor({name:hero?'Nouvel aventurier':'Nouveau monstre',hero,role:hero?'Aventurier':'Adversaire',hp:12,max:12,def:2,dmg:2,x:50,y:60,pool:[2,0,0,0,0,0,0],checks:[false,false,false],target:null,skills:Array(8).fill(0)})}
function fromMonster(m){const a=baseActor(false);Object.assign(a,{template:m.id,name:m.name,role:m.family||'Adversaire',sexe:m.sexe||'',race:m.race||'',hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,esquive:!!m.esquive,rapide:!!m.rapide,notes:m.notes||'',talents:[...(m.talents||[])],attacks:structuredClone(m.attacks||[]),image:m.image||null,weapons:[...(m.weapons||[])],armorId:m.armorId||'',shieldId:m.shieldId||''});a.activeAttack=0;a.pool=poolOf(a);return a}
function openActor(index=null,hero=true,template=null){if(view!=='mj')return;
 if(index!==null&&!actors[index])return;saveChecks();savePool();editing=index;templateIndex=template;draft=structuredClone(template!==null?fromMonster(catalog.monsters[template]):index===null?baseActor(hero):actors[index]);attackDraft=structuredClone(draft.attacks);$('actor-error').textContent='';$('delete-actor').hidden=index===null;$('save-template').hidden=draft.hero;renderActorForm();actorDialog.showModal()}
function renderActorForm(){const a=draft;const weaponOptions=[['','Aucune'],...catalog.items.filter(w=>w.category==='weapon').map(w=>[w.id,w.name])];const armorOptions=slot=>[['','Aucune'],...catalog.items.filter(w=>w.category==='armor'&&w.slot===slot).map(w=>[w.id,w.name])];
$('actor-fields').innerHTML='<div class="edit-grid">'+field('Nom','name',a.name,'text','required maxlength="120"')+field(a.hero?'Classe / rôle':'Famille / rôle','role',a.role,'text',a.hero?'list="classes-jeu" maxlength="120"':'')+(templateIndex===null&&a.hero?field('PV actuels','hp',a.hp,'number','min="0" max="99999"'):'')+field('PV maximum (modifiable)','max',a.max,'number','min="1" max="99999" required')+field(a.hero?'DEF':'Bonus de DEF','def',a.def,'number','min="0" max="99"')+field(a.hero?'Dégâts':'Bonus de dégâts','dmg',a.dmg,'number','min="0" max="999"')+field('XP','xp',a.xp,'number','min="0" max="999999"')+(a.hero?sel('Sexe','sexe',a.sexe,[['','—'],['Femme','Femme'],['Homme','Homme'],['Autre','Autre']])+field('Peuple','race',a.race,'text','maxlength="40"'):'')+(a.hero?field('Vie','vie',a.vie,'number','min="0" max="999" step="any"')+field('Vie maximale','vieMax',a.vieMax,'number','min="1" max="999" step="any"')+field('Endurance','endu',a.endu,'number','min="1" max="999"')+field('Bonus PV','pvBonus',a.pvBonus,'number','min="-9999" max="9999"')+field('Niveau','level',a.level,'number','min="1" max="7"'):'')+'</div>'
  +(a.hero?'<datalist id="classes-jeu">'+(catalog.classes||[]).map(c=>'<option value="'+esc(c.name)+'">').join('')+'</datalist>'
   +'<p class="muted">Classes du jeu : '+(catalog.classes||[]).map(c=>esc(c.name)+' (PV +'+(c.pv||0)+')').join(' · ')+'.</p>':'')
  +(a.hero?'<h2 class="sous-titre">États</h2><div id="state-picker"></div><p class="muted">Un combattant peut en porter plusieurs. Le clic droit sur son socle les pose aussi, en pleine partie.</p>':'')+'<div class="edit-grid">'+sel('Taille du socle','socle',a.socle,[['small','Petit'],['medium','Moyen'],['large','Grand'],['huge','Énorme']])+(!a.hero?sel('Type','type',a.type,[['standard','Standard'],['solitaire','Solitaire'],['alpha','Alpha'],['boss','Boss']]):'')+(a.hero?'<label class="field-check"><input name="rapide" type="checkbox" '+(a.rapide?'checked':'')+'>Rapide (manuel)</label><label class="field-check"><input name="esquive" type="checkbox" '+(a.esquive?'checked':'')+'>Esquive 6+ (manuelle)</label>':'')+'</div>'+(a.hero?'<button type="button" id="calculate-pv" style="margin-top:12px">Recalculer PV max : Vie × Endu + bonus</button>':'')+'<div class="divider"></div><h2>Illustration du token</h2><img class="preview-token" id="draft-image" alt="Token" '+(a.image?'src="'+a.image+'"':'hidden')+'><div class="toolbar"><button type="button" id="token-upload">Importer et optimiser</button><button type="button" id="token-remove">Retirer l’image</button></div><input id="token-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>'+'<div class="divider"></div><h2 class="sous-titre">Talents<button type="button" id="add-talent" class="ico plus" title="Créer un talent" aria-label="Créer un talent">+</button></h2><input id="talent-filter" placeholder="Filtrer les talents…" aria-label="Filtrer les talents"><div id="talent-picker"></div><p class="muted">Les talents se créent dans l’onglet Talents. Les Génériques viennent en tête, puis ceux de la '+(a.hero?'classe de l’aventurier':'famille de la créature')+'.</p>'+(a.hero?'<div class="divider"></div><h2>Compétences</h2><p class="muted">Chaque chiffre est un <b>bonus</b>, pas un nombre de dés : un test lance 1 dé plus ce bonus, chaque 4+ est une réussite, chaque 6 relance un dé de plus qui compte à son tour.</p><div class="edit-grid">'+skillNames.map((n,i)=>field(n,'skill'+i,a.skills[i],'number','min="0" max="30"')).join('')+'</div>':'')+'<div class="divider"></div><h2 class="sous-titre">Équipement<button type="button" id="add-gear" class="ico plus" title="Créer un objet" aria-label="Créer un objet">+</button></h2><div class="edit-grid">'+sel('Arme 1','weapon1',a.weapons[0]||'',weaponOptions)+sel('Arme 2','weapon2',a.weapons[1]||'',weaponOptions)+sel('Armure','armor',a.armorId,armorOptions('body'))+sel('Bouclier','shield',a.shieldId,armorOptions('shield'))+'</div><p class="muted" id="equip-summary"></p><p class="muted">Les dés de l’attaque et la DEF découlent de l’équipement. Mains, munitions et effets restent à vérifier à la main. La même arme peut se porter en deux exemplaires : ses dés se cumulent. Ce qui est porté donne une attaque de plus, à choisir en jeu à côté de celles ci-dessous.</p>'+'<div class="divider"></div><h2>Attaques</h2><div id="attack-edit-list"></div><button type="button" id="add-attack">+ Attaque</button><p class="muted">La réserve et le bonus de dégâts sont appliqués. Portée, cibles multiples et effets indiqués ci-dessous restent manuels.</p><div class="divider"></div><label>'+(a.hero?'Inventaire et notes':'Notes')+'<textarea name="notes" rows="4">'+esc(a.notes)+'</textarea></label>';
/* Un adversaire qui porte une armure tire sa DEF d'elle seule : le champ se tait et
   montre ce que l'armure donne. Son chiffre propre reste dessous — readActor ne lit pas
   un champ éteint — et revient tel quel si l'armure s'en va. */
{const f=$('actor-form').elements,porte=equippedDef(a,catalog.items);
 if(f.def&&!a.hero&&porte!==null){f.def.value=porte;f.def.disabled=true;
  f.def.title='DEF donnée par l’armure portée.'}}
if(a.hero)$('calculate-pv').onclick=()=>{const f=$('actor-form').elements;f.max.value=Math.max(1,num(f.vie.value,1,999)*num(f.endu.value,1,999)+num(f.pvBonus.value,-9999,9999))};
$('token-upload').onclick=()=>$('token-file').click();$('token-file').onchange=()=>{const f=$('token-file').files[0];if(f)openImage(f,'token',url=>{draft.image=url;$('draft-image').src=url;$('draft-image').hidden=false})};$('token-remove').onclick=()=>{draft.image=null;$('draft-image').hidden=true};$('add-attack').onclick=()=>{readAttacks();attackDraft.push({name:'Nouvelle attaque',dice:diceFrom([1,0,0,0,0,0,0]),range:'contact',targets:'one',useOwnDamage:true,effects:{}});renderAttacks()};renderStatePicker();
if($('talent-filter')){$('talent-filter').oninput=renderTalentPicker;renderTalentPicker();
 // Créé depuis la fiche, le talent y est aussitôt coché : on l'ajoutait pour cet aventurier.
 $('add-talent').onclick=()=>openTalent(null,t=>{draft.talents=[...new Set([...(draft.talents||[]),t.id])];
  if($('talent-filter'))$('talent-filter').value='';renderTalentPicker()})}
// Créé depuis la fiche, l'objet se pose dans le premier emplacement libre qui lui convient.
$('add-gear').onclick=()=>openItem(null,o=>refreshGearOptions(o));['weapon1','weapon2','armor','shield'].forEach(k=>{$('actor-form').elements[k].onchange=refreshEquip});refreshEquip();
renderAttacks()}
// Aperçu vivant de l'équipement : dés cumulés, portée et DEF verrouillée par l'armure.
function refreshEquip(){const f=$('actor-form').elements,ids=[f.weapon1.value,f.weapon2.value].filter(Boolean);
 const armes=ids.map(id=>catalog.items.find(w=>w.id===id)).filter(Boolean);
 const p=equippedPool({weapons:ids},catalog.items);
 /* Un aventurier ne saisit jamais sa DEF : elle est la somme de son armure et de son
    bouclier, zéro compris, et le champ est verrouillé. Un adversaire garde la sienne —
    écailles, cuir épais — et ce qu'il porte s'y ajoute : le champ reste à lui. */
 const heros=!!(draft&&draft.hero);
 const porte=equippedDef({armorId:f.armor.value,shieldId:f.shield.value},catalog.items)||0;
 const d=heros?porte:num(f.def.value,0,99)+porte;
 f.def.readOnly=heros;if(heros)f.def.value=porte;
 const des=p?p.map((n,i)=>n?n+' '+types[i]:'').filter(Boolean).join(' · ')||'aucun dé':'';
 // Deux exemplaires de la même arme se lisent « ×2 » plutôt que deux fois le même nom.
 const noms=[...new Set(ids)].map(id=>{const w=armes.find(x=>x.id===id),n=ids.filter(x=>x===id).length;
  return w?w.name+(n>1?' ×'+n:''):''}).filter(Boolean);
 $('equip-summary').textContent=(armes.length?'Dés de '+noms.join(' + ')+' : '+des+(armes.some(w=>w.ranged)?' · tir à distance.':' · contact.'):'Aucune arme équipée : les dés viennent des attaques ci-dessous.')
  +' '+(heros?'DEF de l’équipement : '+d+', champ verrouillé.'
   :porte?'DEF : '+num(f.def.value,0,99)+' à lui, plus '+porte+' d’équipement, soit '+d+'.'
   :'DEF : la sienne, sans équipement pour l’augmenter.')}
function renderAttacks(){$('attack-edit-list').innerHTML=attackDraft.map((a,i)=>'<div class="attack-card" data-attack="'+i+'"><div class="edit-grid">'+field('Nom','an'+i,a.name,'text','required maxlength="100"')+sel('Portée','ar'+i,a.range,[['contact','Contact'],['distance','Distance']])+sel('Cibles','at'+i,a.targets,[['one','Unique'],['all','Multiples (manuel)']])+'</div>'+poolFields(poolFrom(a.dice),'ad'+i+'_')+'<label class="field-check"><input type="checkbox" name="ab'+i+'" '+(a.useOwnDamage!==false?'checked':'')+'>Ajouter les dégâts du combattant</label>'+field('Effets à appliquer manuellement','ae'+i,a.effectText||Object.entries(a.effects||{}).filter(([,v])=>v).map(([k])=>k).join(', '))+'<button type="button" data-remove-attack="'+i+'">Retirer cette attaque</button></div>').join('');habilleDes($('attack-edit-list'));document.querySelectorAll('[data-remove-attack]').forEach(b=>b.onclick=()=>{readAttacks();attackDraft.splice(Number(b.dataset.removeAttack),1);renderAttacks()})}
function readAttacks(){const f=$('actor-form').elements;attackDraft=attackDraft.map((a,i)=>({...a,name:f['an'+i].value.trim()||'Attaque',range:f['ar'+i].value,targets:f['at'+i].value,useOwnDamage:f['ab'+i].checked,effectText:f['ae'+i].value,dice:diceFrom(keys.map((_,c)=>num(f['ad'+i+'_'+c].value,0,12)))}))}
/* Les états de la fiche : la même grille de jetons que le clic droit sur le socle, pour
   qu'on reconnaisse le geste. Ils vivent sur le brouillon jusqu'à l'enregistrement. */
function renderStatePicker(){const boite=$('state-picker');if(!boite)return;
 draft.states??=[];
 boite.replaceChildren(...STATES.map(etat=>{
  const b=document.createElement('button');b.type='button';b.title=etat;
  b.className=hasState(draft,etat)?'on':'';
  const nom=STATE_ICONS[etat];
  if(nom){const im=document.createElement('img');im.src=imgUrl(nom+'.png');im.alt='';b.append(im)}
  else{const v=document.createElement('span');v.className='vide';v.textContent=etat==='Aucun'?'✕':'•';b.append(v)}
  const l=document.createElement('span');l.textContent=etat;b.append(l);
  b.onclick=()=>{if(etat==='Aucun')draft.states=[];else setState(draft,etat,!hasState(draft,etat));
   renderStatePicker()};
  return b}))}
/* Attribuer un talent : une case par talent, groupées par classe. La classe de
   l'aventurier et les Génériques passent devant, le reste suit — un arbre entier
   se parcourt mal quand ce qu'on cherche est au milieu. Les cases cochées vivent
   sur le brouillon, pas dans le DOM : filtrer la liste ne perd donc rien. */
function draftFamilies(){const sienne=(draft.role||'').split('·')[0].trim();
 const toutes=talentFamilies();
 const tete=[GENERIQUES,...(sienne&&toutes.includes(sienne)?[sienne]:[])];
 return [...tete,...toutes.filter(f=>!tete.includes(f))]}
function renderTalentPicker(){const boite=$('talent-picker');if(!boite)return;boite.replaceChildren();
 const q=($('talent-filter')?.value||'').trim().toLowerCase();
 draft.talents??=[];
 let montres=0;
 for(const famille of draftFamilies()){
  const liste=(catalog.talents||[]).filter(t=>talentFamily(t)===famille
   &&(!q||t.name.toLowerCase().includes(q)||(t.effects||'').toLowerCase().includes(q)))
   .sort((a,b)=>(a.level||1)-(b.level||1)||a.name.localeCompare(b.name,'fr'));
  if(!liste.length)continue;
  montres+=liste.length;
  const bloc=document.createElement('div');bloc.className='pick-famille';
  const h=document.createElement('h3');h.textContent=famille;
  const compte=document.createElement('span');compte.className='compte';
  compte.textContent=liste.filter(t=>draft.talents.includes(t.id)).length+' / '+liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(t=>{const [cle,court]=talentType(t);
   const l=document.createElement('label');l.className='pick-talent t-'+cle;
   const c=document.createElement('input');c.type='checkbox';c.checked=draft.talents.includes(t.id);
   c.onchange=()=>{draft.talents=c.checked?[...new Set([...draft.talents,t.id])]
    :draft.talents.filter(x=>x!==t.id);renderTalentPicker()};
   const n=document.createElement('span');n.className='nom';n.textContent=t.name;
   const b=document.createElement('span');b.className='t-badge';b.textContent=court;
   const niv=document.createElement('span');niv.className='tag';niv.textContent='Niv. '+(t.level||1);
   l.append(c,n,b,niv);l.title=t.effects||t.name;bloc.append(l)});
  boite.append(bloc)}
 if(!montres){const v=document.createElement('p');v.className='muted';
  v.textContent=(catalog.talents||[]).length?'Aucun talent ne correspond à ce filtre.'
   :'Aucun talent au catalogue. Va dans l’onglet Talents pour en créer.';
  boite.append(v)}}
/* Recharger les quatre listes d'équipement en place : reconstruire tout le formulaire
   perdrait ce qui y est saisi et pas encore enregistré. Le choix courant est conservé,
   et un objet tout neuf va se poser dans le premier emplacement libre qui l'accepte. */
function refreshGearOptions(neuf){const f=$('actor-form').elements;if(!f||!f.weapon1)return;
 const remplir=(el,liste)=>{const avant=el.value;
  el.replaceChildren(...[['','Aucune'],...liste.map(w=>[w.id,w.name])].map(([v,t])=>new Option(t,v)));
  el.value=liste.some(w=>w.id===avant)?avant:''};
 const armes=catalog.items.filter(w=>w.category==='weapon');
 const armures=slot=>catalog.items.filter(w=>w.category==='armor'&&w.slot===slot);
 remplir(f.weapon1,armes);remplir(f.weapon2,armes);
 remplir(f.armor,armures('body'));remplir(f.shield,armures('shield'));
 if(neuf){const cases=neuf.category==='weapon'?[f.weapon1,f.weapon2]
  :neuf.category==='armor'?[neuf.slot==='shield'?f.shield:f.armor]:[];
  const libre=cases.find(c=>!c.value);if(libre)libre.value=neuf.id}
 refreshEquip()}
function readActor(){const f=$('actor-form').elements;readAttacks();const a=structuredClone(draft);for(const k of ['name','role','notes','socle'])a[k]=f[k].value.trim();a.states=[...statesOf(draft)];for(const k of ['sexe','race'])if(f[k])a[k]=f[k].value.trim();
 for(const k of ['hp','max','def','dmg','xp','vie','vieMax','endu','pvBonus','level'])if(f[k]&&!f[k].disabled)a[k]=num(f[k].value,k==='pvBonus'?-9999:0,k==='xp'?999999:99999);a.max=Math.max(1,a.max);if(templateIndex!==null)a.hp=a.max;a.hp=Math.min(a.hp,a.max);setState(a,'Coma',!a.hp);if(!a.hero){a.type=f.type.value;if(f.menace)a.menace=f.menace.value}// Sans cases à l'écran (adversaires), les valeurs enregistrées sont conservées telles quelles.
 if(f.rapide)a.rapide=f.rapide.checked;if(f.esquive)a.esquive=f.esquive.checked;if(f.skill0)a.skills=skillNames.map((_,i)=>num(f['skill'+i].value,0,30));// Un adversaire n'a pas de rayon d'armurerie dans son formulaire : ce qu'il porte reste tel quel.
 if(f.weapon1){a.weapons=[f.weapon1.value,f.weapon2.value].filter(Boolean);a.armorId=f.armor.value;a.shieldId=f.shield.value}a.attacks=attackDraft;a.activeAttack=0;a.talents=[...new Set(draft.talents||[])].filter(id=>(catalog.talents||[]).some(t=>t.id===id));
 // Un aventurier ne saisit jamais sa DEF : elle vaut son armure plus son bouclier, zéro compris.
 if(a.hero)a.def=defenseOf(a,catalog.items);
 a.pool=poolFrom(chosenAttack(a,catalog.items).dice)||poolFrom(attackDraft[0]?.dice);return a}
function toMonster(a){return {id:crypto.randomUUID(),name:a.name,family:a.role,sexe:a.sexe,race:a.race,pv:a.max,def:a.def,damage:a.dmg,xp:a.xp,type:a.type,socle:a.socle,menace:a.menace,rapide:a.rapide,esquive:a.esquive,notes:a.notes,talents:[...(a.talents||[])],attacks:structuredClone(a.attacks),image:a.image||null,weapons:[...(a.weapons||[])],armorId:a.armorId||'',shieldId:a.shieldId||''}}
/* Une créature posée sur la table garde le lien vers son modèle : corriger les PV maximum
   au bestiaire corrige ceux qui combattent déjà. Une créature blessée garde sa blessure,
   une créature intacte reste intacte. Les créatures d'avant ce lien sont rattrapées par
   leur nom — c'est tout ce qu'on a d'elles, et seulement quand aucun lien n'est enregistré. */
/* Ce qui appartient au combat en cours, et que corriger un modèle ne doit pas effacer :
   la place sur la carte, la blessure, les états, les activations et la cible visée. */
const EN_JEU=['id','x','y','hp','states','bleed','cumuls','checks','target','targets','revealed','hidden','activeAttack','template'];
/* Corriger un modèle corrige les créatures qui le portent déjà sur la table — nom,
   chiffres, attaques, portrait : tout le profil suit. Jusqu'ici seul le plafond de PV
   descendait, si bien qu'on changeait des dés d'attaque sans rien voir changer en jeu.
   La créature est modifiée sur place, jamais remplacée : rien ne devient orphelin. */
function syncFromTemplate(m){let touches=0;
 actors.forEach(a=>{if(a.hero)return;
  if(a.template?a.template!==m.id:a.name!==m.name)return;
  const plein=a.hp>=a.max,neuf=fromMonster(m);
  // Le modèle gouverne exactement ce que « fromMonster » sait produire : comparer clé
  // par clé, et non deux sérialisations dont l'ordre d'insertion diffère toujours.
  const pareil=Object.keys(neuf).every(k=>EN_JEU.includes(k)
   ||JSON.stringify(a[k])===JSON.stringify(neuf[k]));
  if(pareil&&a.max===Math.max(1,num(m.pv,1,99999)))return;
  Object.keys(neuf).forEach(k=>{if(!EN_JEU.includes(k))a[k]=neuf[k]});
  a.max=Math.max(1,num(m.pv,1,99999));
  a.hp=plein?a.max:Math.min(a.hp,a.max);
  a.activeAttack=Math.min(a.activeAttack||0,Math.max(0,(a.attacks||[]).length-1));
  setState(a,'Coma',!a.hp);normalizeActor(a);a.pool=poolFrom(activeAttack(a).dice)||a.pool;
  touches++});
 return touches}
$('actor-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;const a=readActor();if(templateIndex!==null){const modele={...toMonster(a),id:catalog.monsters[templateIndex].id};catalog.monsters[templateIndex]=modele;
 const suivis=syncFromTemplate(modele);
 if(suivis)log(suivis+' créature(s) « '+modele.name+' » sur la table mise(s) à jour.');
 renderCatalogPages()}else if(editing===null){actors.push(a);selected=actors.length-1}else actors[editing]=a;actorDialog.close();renderHeroes();render();log('Fiche enregistrée : '+a.name);scheduleSave()};
$('save-template').onclick=()=>{if(!$('actor-form').reportValidity()||view!=='mj')return;catalog.monsters.push(toMonster(readActor()));$('actor-error').textContent='Copie ajoutée au bestiaire.';scheduleSave()};
/* Retirer un combattant : les cibles qui le visaient et les indices qui le suivaient
   sont recalés, et la scène garde toujours au moins un aventurier. */
function removeActor(i){return removeActors([i],true)}
/* Retirer un ou plusieurs combattants d'un coup. Les indices sont défaits du plus grand
   au plus petit, sinon chaque coupe décalerait les suivants. Cibles, joueur maître et
   sélection sont recalés ensuite. La troupe garde toujours un aventurier.
   « demande » vaut pour la fiche, où l'on confirme quoi qu'il arrive ; au clavier, seuls
   les aventuriers font surgir l'alerte — perdre un monstre se répare d'un clic, pas une fiche. */
function removeActors(liste,demande){
 if(view!=='mj')return 'Retrait impossible.';
 const rangs=[...new Set(liste)].filter(i=>actors[i]).sort((x,y)=>y-x);
 if(!rangs.length)return 'Retrait impossible.';
 const heros=rangs.filter(i=>actors[i].hero).length;
 if(rangs.length>=actors.length||heros>=actors.filter(a=>a.hero).length)
  return 'Conserve au moins un aventurier dans la scène.';
 const noms=rangs.map(i=>actors[i].name).reverse();
 if(demande||heros){const quoi=noms.length===1?'Retirer '+noms[0]+' de la scène ?'
  :'Retirer '+noms.length+' combattants de la scène ?\n\n'+noms.join(', ');
  if(!confirm(quoi))return null}
 rangs.forEach(i=>{actors.splice(i,1);
  actors.forEach(a=>{if(a.target===i)a.target=null;else if(a.target>i)a.target--});
  if(owner>=i)owner=Math.max(0,owner-1);
  if(selected!==null&&selected>=i)selected=selected>i?selected-1:null});
 if(!actors[owner]?.hero)owner=actors.findIndex(a=>a.hero);
 marked.clear();
 render();scheduleSave();log(noms.join(', ')+(noms.length>1?' retirés':' retiré')+' de la scène.');return null}
/* Rejouer la même rencontre : les adversaires repartent intacts, la troupe garde ses
   blessures — c'est le combat qu'on recommence, pas la partie. */
$('heal-foes').onclick=()=>{if(view!=='mj')return;
 const blesses=actors.filter(a=>!a.hero&&(a.hp<a.max||hasState(a,'Coma')));
 if(!blesses.length){log('Aucun adversaire à soigner : ils sont tous au complet.');return}
 blesses.forEach(a=>{a.hp=a.max;setState(a,'Coma',false)});
 render();log(blesses.length+' adversaire(s) remis à 100 % de leurs PV.');scheduleSave()};
$('delete-actor').onclick=()=>{if(editing===null)return;
 const souci=removeActor(editing);
 if(souci){$('actor-error').textContent=souci;return}
 selected=owner;actorDialog.close();renderHeroes();render()};
/* Les états qu'un coup peut poser. « Aucun » est l'absence d'état : il devient le tiret
   du choix, et ne figure pas deux fois. */
// Le coma n'est pas un état qu'on inflige : c'est ce qui arrive à zéro point de vie.
const ETATS_INFLIGES=()=>STATES.filter(e=>e!=='Aucun'&&e!=='Coma');
/* La catégorie porte aussi la portée : une arme de contact et une arme à distance ne se
   remplissent pas pareil, et c'est bien une seule question qu'on pose. Ce qui est
   enregistré ne change pas pour autant — category reste « weapon », ranged reste un
   booléen — pour que rien de ce qui s'appuie dessus n'ait à bouger. */
const ITEM_CATS=[['melee','Arme de contact'],['ranged','Arme à distance'],['armor','Armure'],
 ['ammo','Munition'],['object','Objet'],['misc','Divers']];
/* Ce que le formulaire affiche à l'instant, relu tel quel. Les champs absents ne sont pas
   lus : la valeur déjà enregistrée reste en place au lieu d'être remise à zéro. */
function itemDepuisForm(base){const f=$('item-form').elements,a={...base};
 const c=f.category.value;a.ranged=c==='ranged';a.category=c==='melee'||c==='ranged'?'weapon':c;
 for(const k of ['name','slot','etat','notes'])if(f[k])a[k]=f[k].value.trim();
 for(const k of ['qty','price','hands','def'])if(f[k])a[k]=num(f[k].value,0,999999);
 for(const k of ['usesAmmo','consumable'])if(f[k])a[k]=f[k].checked;
 if(f.itemdie0)a.dice=diceFrom(keys.map((_,i)=>num(f['itemdie'+i].value,0,12)));
 return a}
/* Une arme ne porte pas de DEF, une armure pas de dés : le formulaire ne montre que les
   champs qui veulent dire quelque chose pour la catégorie choisie. Changer de catégorie
   le redessine, sans perdre ce qui vient d'être tapé. */
function dessineItem(){const a=itemDraft,arme=a.category==='weapon',armure=a.category==='armor';
 const cat=arme?(a.ranged?'ranged':'melee'):a.category;
 $('item-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','name',a.name,'text','required maxlength="120"')
  +sel('Catégorie','category',cat,ITEM_CATS)
  +field('Prix','price',a.price||0,'number','min="0" max="999999"')
  +(arme?sel('Mains','hands',a.hands||1,[[1,'1 main'],[2,'2 mains']]):'')
  +(armure?field('DEF','def',a.def||0,'number','min="0" max="99"')
   +sel('Emplacement','slot',a.slot||'body',[['body','Corps'],['shield','Bouclier']]):'')
  +(arme||armure?'':field('Quantité','qty',a.qty||1,'number','min="1" max="9999"'))
  +'</div>'
  +(arme?'<p class="etiquette">Dés de l’arme</p>'+poolFields(poolFrom(a.dice),'itemdie')
   +sel('État infligé','etat',a.etat||'',[['','—'],...ETATS_INFLIGES().map(e=>[e,e])]):'')
  +(arme&&a.ranged?'<label class="field-check"><input name="usesAmmo" type="checkbox" '+(a.usesAmmo?'checked':'')+'>Munitions nécessaires</label>':'')
  +(arme||armure?'':'<label class="field-check"><input name="consumable" type="checkbox" '+(a.consumable?'checked':'')+'>Consommable</label>')
  +'<label>Notes<textarea name="notes">'+esc(a.notes||'')+'</textarea></label>';
 habilleDes($('item-fields'));
 $('item-form').elements.category.onchange=()=>{itemDraft=itemDepuisForm(itemDraft);dessineItem()}}
function openItem(i=null,apres=null){itemIndex=i;itemApres=apres;
 itemDraft=i===null?{name:'Nouvel objet',category:'weapon',ranged:false,hands:1,qty:1,price:0,def:0,slot:'body',dice:{},traits:[]}
  :structuredClone(catalog.items[i]);
 dessineItem();$('delete-item').hidden=i===null;itemDialog.showModal()}
$('item-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 const a=itemDepuisForm({...(itemIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.items[itemIndex])),...itemDraft});
 if(itemIndex===null)catalog.items.push(a);else catalog.items[itemIndex]=a;itemDialog.close();renderCatalogPages();scheduleSave();const rappel=itemApres;itemApres=null;if(rappel)rappel(a)};
$('delete-item').onclick=()=>{if(view!=='mj'||itemIndex===null||!confirm('Supprimer cet objet du catalogue ? Les attaques déjà appliquées restent inchangées.'))return;const id=catalog.items[itemIndex].id;actors.forEach(a=>{a.weapons=a.weapons.filter(w=>w!==id);if(a.armorId===id)a.armorId='';if(a.shieldId===id)a.shieldId=''});catalog.items.splice(itemIndex,1);itemDialog.close();renderCatalogPages();scheduleSave()};

/* Ajouter un combattant à la scène, c'est prendre dans ce qu'on a déjà — le bestiaire
   pour les adversaires, la troupe pour les aventuriers — et non remplir une fiche vierge.
   Créer reste possible : le dernier bouton du choix mène au formulaire.
   Toute la troupe est en scène par construction : choisir un aventurier le repose donc
   au centre de la carte et le désigne, plutôt que d'en faire un double. */
const sceneDialog2=dialog('scene-picker','Ajouter à la scène',
 '<p class="muted" id="scene-picker-note"></p><input id="scene-picker-search" placeholder="Rechercher…" aria-label="Rechercher">'
 +'<div id="scene-picker-body"></div><div class="form-actions"><button type="button" id="scene-picker-new"></button></div>');
let scenePickerMode='foe';
function openScenePicker(mode){if(view!=='mj')return;scenePickerMode=mode;
 sceneDialog2.querySelector('h2').textContent=mode==='foe'?'Ajouter un adversaire':'Placer un aventurier';
 $('scene-picker-note').textContent=mode==='foe'
  ?'Glisse un modèle du bestiaire jusqu’à l’endroit voulu sur la carte. Un simple clic le pose au centre. Sans lâcher, appuie sur Maj autant de fois que tu veux d’exemplaires : ils se posent en groupe.'
  :'Toute la troupe est déjà en scène. Glisse un aventurier là où tu le veux sur la carte ; un simple clic le repose au centre.';
 $('scene-picker-new').textContent=mode==='foe'?'+ Créer un monstre au bestiaire':'+ Créer un aventurier';
 $('scene-picker-search').value='';$('scene-picker-search').oninput=renderScenePicker;
 renderScenePicker();sceneDialog2.showModal()}
function renderScenePicker(){const corps=$('scene-picker-body');if(!corps)return;corps.replaceChildren();
 const q=($('scene-picker-search').value||'').trim().toLowerCase();
 const libre=()=>({x:34+Math.random()*32,y:30+Math.random()*26});
 if(scenePickerMode==='foe'){
  const liste=catalog.monsters.map((m,i)=>[m,i]).filter(([m])=>!q||m.name.toLowerCase().includes(q));
  liste.forEach(([m,i])=>corps.append(ligneScene(m.name,m.image,
   (m.pv||0)+' PV · DEF '+(m.def||0)+' · '+(m.family||'sans famille'),
   ()=>poserAdversaire(i,libre(),false,1),(x,y,n)=>poserAdversaire(i,{x,y},true,n),
   {hero:false,pv:m.pv||0,def:m.def||0,groupe:true})));
  if(!liste.length)corps.append(videScene(q?'Aucun modèle de ce nom.':'Le bestiaire est vide.'))}
 else{
  const liste=actors.map((a,i)=>[a,i]).filter(([a])=>a.hero&&(!q||a.name.toLowerCase().includes(q)));
  liste.forEach(([a,i])=>corps.append(ligneScene(a.name,a.image,
   a.hp+' / '+a.max+' PV · '+(a.role||'Aventurier'),
   ()=>placerAventurier(i,libre(),false),(x,y)=>placerAventurier(i,{x,y},true),
   {hero:true,pv:a.hp,part:ratio(a),def:defOf(a)})));
  if(!liste.length)corps.append(videScene(q?'Aucun aventurier de ce nom.':'La troupe est vide.'))}}
/* Poser un modèle : au hasard du centre pour un clic, au point exact pour un glissement.
   Dans les deux cas la créature est repoussée hors des murs avant d'apparaître. */
/* Un groupe se pose en corolle : le premier au point visé, les suivants en anneaux
   autour de lui, espacés d'un socle. Les pourcentages ne sont pas carrés — la carte a
   ses proportions — d'où le passage par les pixels avant de revenir en pourcentage. */
function placesEnGroupe(centre,combien,diam){const t=mapSize();
 const w=t.width||1,h=t.height||1,out=[{x:centre.x,y:centre.y}];
 for(let anneau=1;out.length<combien;anneau++){
  const places=6*anneau,r=diam*anneau*.98;
  for(let j=0;j<places&&out.length<combien;j++){
   const a=(j/places+(anneau%2?0:.5/places))*2*Math.PI;
   out.push({x:centre.x+Math.cos(a)*r/w*100,y:centre.y+Math.sin(a)*r/h*100})}}
 return out}
/* Poser un modèle : au hasard du centre pour un clic, au point exact pour un glissement.
   Le compte vient de la touche Maj tenue pendant le geste ; chaque exemplaire est une
   créature à part entière, avec son identité et ses points de vie propres, et chacune
   est repoussée hors des murs avant d'apparaître. */
function poserAdversaire(i,ou,glisse,combien){saveChecks();savePool();
 const m=catalog.monsters[i];if(!m)return;
 const n=Math.max(1,Math.min(24,Math.round(Number(combien)||1)));
 sceneDialog2.close();showPage('table');
 const poses=placesEnGroupe(ou,n,tokenPx()*socleFacteur(m)).map(p=>{
  const a=fromMonster(m);Object.assign(a,p);normalizeActor(a);
  actors.push(a);settleActor(a);return a});
 selected=actors.length-1;marked=new Set(poses.map(a=>a.id));
 render();scheduleSave();
 log(n>1?n+' × '+m.name+' posés en groupe.'
  :m.name+(glisse?' posé à l’endroit choisi.':' ajouté à la carte.'))}
function placerAventurier(i,ou,glisse){saveChecks();savePool();Object.assign(actors[i],ou);
 selected=i;markOnly(i);sceneDialog2.close();showPage('table');settleActor(actors[i]);render();scheduleSave();
 log(actors[i].name+(glisse?' placé à l’endroit choisi.':' replacé au centre de la carte.'))}
// Le point lâché est-il sur la carte ? On vise le cadre visible, pas le calque zoomé.
function surLaCarte(e){const r=$('map').getBoundingClientRect();
 return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}
/* Glisser une languette jusqu'à la carte. La fenêtre se referme dès que le geste part,
   sinon elle masque justement l'endroit que l'on vise ; un jeton fantôme suit le doigt
   et pâlit hors de la carte, pour qu'on sache où l'on pose avant de lâcher. */
function glisserVersCarte(el,nom,image,poser,groupe){
 el.addEventListener('pointerdown',e=>{if(e.button!==0)return;
  const depart={x:e.clientX,y:e.clientY};let fantome=null,parti=false,combien=1,ou=depart;
  const lever=()=>{if(parti)return;parti=true;sceneDialog2.close();showPage('table');
   fantome=jetonRond(image,nom,'mini');fantome.classList.add('fantome-pose');document.body.append(fantome);
   suivre(ou)};
  const suivre=p=>{if(!fantome)return;
   fantome.style.left=p.clientX+'px';fantome.style.top=p.clientY+'px';
   fantome.classList.toggle('hors',!surLaCarte(p))};
  const compter=()=>{if(!fantome)return;
   let b=fantome.querySelector('.fantome-nombre');
   if(combien<2){if(b)b.remove();return}
   if(!b){b=document.createElement('b');b.className='fantome-nombre';fantome.append(b)}
   b.textContent='×'+combien};
  /* Maj, pressée autant de fois qu'on veut d'exemplaires tant que le modèle est tenu :
     le compte s'inscrit sur le jeton fantôme et tout le groupe se pose d'un seul geste.
     La répétition d'une touche maintenue ne compte pas — sans quoi le clavier remplirait
     la carte à lui seul. */
  const touche=ev=>{if(!groupe||ev.key!=='Shift'||ev.repeat)return;
   ev.preventDefault();combien=Math.min(24,combien+1);lever();compter()};
  const bouge=ev=>{ou=ev;
   if(!parti&&Math.hypot(ev.clientX-depart.x,ev.clientY-depart.y)<7)return;
   lever();suivre(ev)};
  const fin=ev=>{document.removeEventListener('pointermove',bouge);document.removeEventListener('pointerup',fin);
   document.removeEventListener('keydown',touche,true);
   if(!parti)return;
   if(fantome)fantome.remove();
   // Un glissement n'est pas un clic : le bouton ne doit pas poser un second exemplaire.
   el.dataset.glisse='1';
   if(surLaCarte(ev)){const p=mapPct(ev);poser(p.x,p.y,combien)}
   else log('Rien de posé : lâche le modèle sur la carte.')};
  document.addEventListener('pointermove',bouge);document.addEventListener('pointerup',fin);
  document.addEventListener('keydown',touche,true)})}
/* La fenêtre de choix montre exactement ce que montre la liste des combattants : le même
   socle rond, le même nom, la même barre de vie et le même écu de DEF. Ce qu'on va poser
   se lit comme ce qui est déjà en jeu. Pas de pastilles d'activation : un modèle qui n'est
   pas encore sur la carte n'a ni Action ni Mouvement à dépenser. */
function ligneScene(nom,image,detail,clic,poser,fiche){const f=fiche||{};
 const b=document.createElement('button');b.className='actor pick-ligne'+(f.hero?'':' enemy');
 const vignette=document.createElement('span');vignette.className='vignette';
 const socle=document.createElement('span');socle.className='avatar';
 if(image){const im=document.createElement('img');im.src=image;im.alt='';im.draggable=false;socle.append(im)}
 else socle.textContent=(String(nom||'?').trim()[0]||'?').toUpperCase();
 vignette.append(socle);
 const corps=document.createElement('span');corps.className='actor-body';
 const ligneNom=document.createElement('span');ligneNom.className='actor-nom';
 const t=document.createElement('strong');t.textContent=nom;ligneNom.append(t);
 const vie=document.createElement('span');vie.className='vie-ligne';
 vie.innerHTML=lifebar(Number.isFinite(f.part)?f.part:100,f.pv!=null?String(f.pv):'',!!f.hero);
 if(f.def!=null)vie.append(shieldBadge(f.def));
 corps.append(ligneNom,vie);b.append(vignette,corps);
 const fleche=document.createElement('span');fleche.className='pick-etat';fleche.textContent='+';
 b.append(fleche);
 b.title=nom+(detail?' · '+detail:'');
 b.onclick=()=>{if(b.dataset.glisse){delete b.dataset.glisse;return}clic()};
 if(poser)glisserVersCarte(b,nom,image,poser,!!f.groupe);
 return b}
function videScene(texte){const v=document.createElement('p');v.className='muted';v.textContent=texte;return v}
$('scene-picker-new').onclick=()=>{sceneDialog2.close();
 if(scenePickerMode==='foe')openActor(null,false);else openActor(null,true)};
$('new-hero').onclick=()=>openScenePicker('hero');$('new-monster').onclick=()=>openScenePicker('foe');
const sceneDialog=dialog('scene-editor','Scène','<form id="scene-form"><label>Titre<input name="title" maxlength="120" required></label><label>Tour de combat<input name="round" type="number" min="1" max="999" required></label><div class="form-actions"><button class="primary">Enregistrer</button></div></form>');
$('edit-scene').onclick=()=>{if(view!=='mj')return;$('scene-form').elements.title.value=sceneTitle();$('scene-form').elements.round.value=round;sceneDialog.showModal()};$('scene-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;round=num($('scene-form').elements.round.value,1,999);sceneTitle($('scene-form').elements.title.value);renderSettings();$('round').textContent=String(round).padStart(2,'0');sceneDialog.close();scheduleSave()};
$('reset-map').onclick=()=>{if(view!=='mj')return;mapImage=null;$('map-view').style.backgroundImage='';$('map').classList.remove('custom');scheduleSave()};
const originalRender=render;render=function(){originalRender();
 const mj=view==='mj';['reset-map','heal-foes'].forEach(id=>{const el=$(id);if(el)el.hidden=!mj});$('owner').replaceChildren();actors.forEach((a,i)=>{if(a.hero)$('owner').add(new Option(a.name,String(i)))});$('owner').value=String(owner);const a=actors[selected];$('actor-notes').textContent=a&&a.notes||'';

 // Le menu des attaques ne paraît que s'il y a vraiment à choisir : la barre sous
 // « Attaque » appartient désormais aux cibles à portée.
 // Une arme portée ne commande la réserve que d'un aventurier : chez un adversaire,
 // c'est sa carte d'attaque, et le choix entre plusieurs doit rester offert.
 renderAttackChoices();scheduleSave()};
// Les entrées éditées restent du texte, y compris dans les boutons de sélection.
const rawLog=log;log=function(...args){rawLog(...args);scheduleSave()};
function scheduleSave(){if(loading)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,200)}
function snapshot(){return {version:8,actors,catalog,round,mode,owner,selected,mapImage,maps,currentMapId,title:sceneTitle()}}
/* L'état de la sauvegarde a quitté la table pour les Paramètres. Un échec, lui, ne
   doit pas attendre qu'on aille l'y chercher : il passe une fois par le journal. */
let dernierSouci='';
function noterSauvegarde(texte,souci){saveLabel.textContent=texte;
 saveLabel.classList.toggle('form-error',!!souci);
 if(souci&&texte!==dernierSouci){dernierSouci=texte;log(texte)}
 if(!souci)dernierSouci=''}
function saveNow(){if(!db){noterSauvegarde('Sauvegarde locale indisponible : cette session ne sera pas conservée.',true);return}try{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(snapshot(),'session');tx.oncomplete=()=>noterSauvegarde('Enregistré sur cet appareil · pas de synchronisation multijoueur');tx.onerror=()=>noterSauvegarde('Échec de sauvegarde (stockage plein ou bloqué). La session reste ouverte.',true)}catch(e){noterSauvegarde('Impossible d’enregistrer : '+e.message,true)}}
document.addEventListener('change',scheduleSave);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!loading)saveNow()});
function loadSession(){try{const req=indexedDB.open('amertume_online_v007',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onerror=finish;req.onblocked=finish;req.onsuccess=()=>{db=req.result;const get=db.transaction('state').objectStore('state').get('session');get.onerror=finish;get.onsuccess=()=>{const s=get.result;if(s&&(s.version===7||s.version===8)&&Array.isArray(s.actors)&&s.actors.length&&s.actors.some(a=>a.hero)){actors.splice(0,actors.length,...s.actors.map(normalizeActor));idsUniques(actors);catalog=normalizeCatalog(s.catalog);round=s.round;mode=s.mode==='exploration'?'exploration':'combat';owner=s.owner;selected=s.selected;mapImage=s.mapImage;maps=Array.isArray(s.maps)?s.maps:[];currentMapId=s.currentMapId||null;sceneTitle(s.title);if(mapImage){$('map-view').style.backgroundImage='url("'+mapImage+'")';$('map').classList.add('custom')}$('round').textContent=String(round).padStart(2,'0')}finish()}}}catch(e){finish()}}
function finish(){if(!loading)return;loading=false;cover.hidden=true;render();
 if(!db)noterSauvegarde('Sauvegarde locale indisponible dans ce navigateur.',true);
 // La partie est là : les onglets peuvent rouvrir la page où l'on travaillait.
 document.dispatchEvent(new Event('amertume-partie-chargee'))}
// Lit les dimensions avant décodage pour refuser les images disproportionnées.
function imageDimensions(bytes){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),str=(a,n)=>String.fromCharCode(...bytes.slice(a,a+n));
 if(bytes.length>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a)return [v.getUint32(16),v.getUint32(20)];
 if(bytes[0]===255&&bytes[1]===216){let p=2;while(p+9<bytes.length){if(bytes[p]!==255){p++;continue}const m=bytes[p+1];p+=2;if(m===216||m===1)continue;if(m===218||m===217)break;const n=v.getUint16(p);if(n<2||p+n>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m))return [v.getUint16(p+5),v.getUint16(p+3)];p+=n}}
 if(str(0,4)==='RIFF'&&str(8,4)==='WEBP'){const type=str(12,4);if(type==='VP8X'&&bytes.length>=30)return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];if(type==='VP8 '&&bytes.length>=30)return [v.getUint16(26,true)&16383,v.getUint16(28,true)&16383];if(type==='VP8L'&&bytes.length>=25&&bytes[20]===47){const bits=v.getUint32(21,true);return [(bits&16383)+1,((bits>>>14)&16383)+1]}}
 throw Error('Image non reconnue. Utilise un fichier PNG, JPEG ou WebP valide.');
}
let imageJob=null,imageGeneration=0;
const pretty=n=>n<1024*1024?Math.round(n/1024)+' Ko':(n/(1024*1024)).toFixed(2)+' Mo';
async function openImage(file,kind,accept){if(view!=='mj')return;try{if(file.size>25*1024*1024)throw Error('Fichier trop lourd : maximum 25 Mo. Réduis-le avant de l’importer.');const bytes=new Uint8Array(await file.arrayBuffer());const [w,h]=imageDimensions(bytes);if(!w||!h||w*h>64000000||Math.max(w,h)>20000)throw Error('Image trop grande : maximum 64 millions de pixels et 20 000 pixels par côté.');
 cleanupImage();const original=URL.createObjectURL(file);imageJob={file,kind,accept,original,w,h,output:null,url:null,bitmap:null,zoom:1,dx:0,dy:0};$('image-before').src=original;$('before-info').textContent=w+' × '+h+' · '+pretty(file.size);$('image-size').replaceChildren(...(kind==='map'?[2048,4096]:[256,512]).map(n=>new Option(n+' pixels',String(n))));$('image-size').value=kind==='map'?'4096':'512';$('image-quality').value='90';$('quality-label').textContent='90 %';$('image-error').textContent='';$('image-accept').disabled=true;
 // Le socle se cadre : on garde l'image décodée sous la main pour l'aperçu rond.
 $('token-frame').hidden=kind!=='token';$('token-zoom').value='100';
 imgDialog.showModal();
 if(kind==='token'){const job=imageJob;const bmp=await createImageBitmap(file);
  if(job!==imageJob){bmp.close();return}job.bitmap=bmp;drawTokenPreview()}
 await optimizeImage();
}catch(e){if(imgDialog.open)$('image-error').textContent=e.message;else log(e.message)}}
async function optimizeImage(){const job=imageJob;if(!job)return;const generation=++imageGeneration;$('image-accept').disabled=true;$('image-recalc').disabled=true;$('image-size').disabled=$('image-quality').disabled=true;$('image-error').textContent='Optimisation en cours…';let bitmap;try{bitmap=job.bitmap||await createImageBitmap(job.file);if(job!==imageJob||generation!==imageGeneration)return;const carre=job.kind==='token';
 const factor=Math.min(1,Number($('image-size').value)/Math.max(bitmap.width,bitmap.height));
 const cote=Math.max(1,Math.round(Number($('image-size').value)));
 const w=carre?cote:Math.max(1,Math.round(bitmap.width*factor)),h=carre?cote:Math.max(1,Math.round(bitmap.height*factor));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Le navigateur ne peut pas traiter cette image.');ctx.imageSmoothingQuality='high';
 // Un socle sort carré, cadré comme dans l'aperçu ; le reste garde ses proportions.
 if(carre){const f=squareFrame(bitmap.width,bitmap.height,cote,job.zoom,job.dx,job.dy);
  ctx.drawImage(bitmap,f.ox,f.oy,f.dw,f.dh)}
 else ctx.drawImage(bitmap,0,0,w,h);let output=await new Promise(r=>canvas.toBlob(r,'image/webp',Number($('image-quality').value)/100));canvas.width=canvas.height=1;if(!output)throw Error('Compression impossible. Essaie une image plus petite.');if(job!==imageJob||generation!==imageGeneration)return;
 // Ne remplace pas un fichier déjà plus léger lorsqu'aucune réduction de dimensions n'est nécessaire.
 if(!carre&&factor===1&&job.file.size<output.size)output=job.file;if(job.url)URL.revokeObjectURL(job.url);job.output=output;job.url=URL.createObjectURL(output);$('image-after').src=job.url;const gain=Math.round((1-output.size/job.file.size)*100);$('after-info').textContent=w+' × '+h+' · '+pretty(output.size)+' · '+(gain>=0?gain+' % de réduction':Math.abs(gain)+' % plus lourd')+' · '+(output.type||'image');$('image-error').textContent=output===job.file?'L’original est déjà plus léger : il sera conservé.':'';$('image-accept').disabled=false;
}catch(e){if(job===imageJob)$('image-error').textContent='Import impossible : '+e.message}finally{if(bitmap&&bitmap!==job.bitmap)bitmap.close();if(job)job.dirty=false;if(generation===imageGeneration){$('image-recalc').disabled=false;$('image-size').disabled=$('image-quality').disabled=false}}}
/* Le cadrage d'un socle : l'image remplit le carré, agrandie ou réduite par le zoom et
   glissée à la main. À zoom 1 le petit côté touche exactement les bords ; en deçà, des
   bords transparents apparaissent, et le glissement reste borné au carré dans les deux cas. */
function squareFrame(bw,bh,side,zoom,dx,dy){
 const k=side/Math.max(1,Math.min(bw,bh))*zoom,dw=bw*k,dh=bh*k;
 const borne=(v,d)=>d>=side?Math.min(0,Math.max(side-d,v)):Math.max(0,Math.min(side-d,v));
 return {dw,dh,ox:borne((side-dw)/2+dx*side,dw),oy:borne((side-dh)/2+dy*side,dh)}}
function drawTokenPreview(){const job=imageJob,cv=$('token-canvas');
 if(!job||!job.bitmap||!cv)return;
 const side=cv.width,ctx=cv.getContext('2d');if(!ctx)return;
 ctx.clearRect(0,0,side,side);ctx.imageSmoothingQuality='high';
 const f=squareFrame(job.bitmap.width,job.bitmap.height,side,job.zoom,job.dx,job.dy);
 ctx.drawImage(job.bitmap,f.ox,f.oy,f.dw,f.dh);
 $('token-zoom-label').textContent=Math.round(job.zoom*100)+' %'}
/* Un réglage — cadrage, taille ou qualité — périme la copie optimisée. La laisser
   périmée à l'écran avec un bouton éteint et rien pour le dire ne s'explique pas :
   la copie se refait donc toute seule, dès qu'on s'arrête de régler. */
let retoucheTimer=null;
function retouche(){if(imageJob)imageJob.dirty=true;
 $('image-accept').disabled=true;
 clearTimeout(retoucheTimer);
 retoucheTimer=setTimeout(()=>{if(imageJob&&imageJob.dirty)optimizeImage()},260)}
$('token-zoom').oninput=()=>{if(!imageJob)return;imageJob.zoom=Number($('token-zoom').value)/100;
 drawTokenPreview();retouche()};
$('token-center').onclick=()=>{if(!imageJob)return;imageJob.zoom=1;imageJob.dx=imageJob.dy=0;
 $('token-zoom').value='100';drawTokenPreview();retouche()};
(function(){const cv=$('token-canvas');let prise=null;
 cv.onpointerdown=e=>{if(!imageJob)return;prise={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId)};
 cv.onpointermove=e=>{if(!prise||!imageJob)return;
  imageJob.dx+=(e.clientX-prise.x)/cv.width;imageJob.dy+=(e.clientY-prise.y)/cv.width;
  prise={x:e.clientX,y:e.clientY};drawTokenPreview();retouche()};
 cv.onpointerup=e=>{if(prise){prise=null;cv.releasePointerCapture(e.pointerId)}};
 cv.onpointercancel=()=>{prise=null};
 cv.onwheel=e=>{if(!imageJob)return;e.preventDefault();
  imageJob.zoom=Math.max(.4,Math.min(3.2,imageJob.zoom*(e.deltaY<0?1.08:1/1.08)));
  $('token-zoom').value=String(Math.round(imageJob.zoom*100));drawTokenPreview();retouche()}})();
function cleanupImage(){imageGeneration++;clearTimeout(retoucheTimer);if(imageJob){URL.revokeObjectURL(imageJob.original);if(imageJob.url)URL.revokeObjectURL(imageJob.url);imageJob.bitmap?.close()}imageJob=null;$('image-before').removeAttribute('src');$('image-after').removeAttribute('src')}
$('image-quality').oninput=()=>{$('quality-label').textContent=$('image-quality').value+' %';retouche()};$('image-size').onchange=retouche;$('image-recalc').onclick=optimizeImage;$('image-cancel').onclick=()=>imgDialog.close();imgDialog.addEventListener('close',cleanupImage);
$('image-accept').onclick=()=>{const job=imageJob;if(!job?.output||view!=='mj')return;$('image-accept').disabled=true;const reader=new FileReader();reader.onerror=()=>{$('image-error').textContent='Impossible de lire la copie optimisée.'};reader.onload=()=>{if(job!==imageJob)return;job.accept(reader.result);imgDialog.close();scheduleSave()};reader.readAsDataURL(job.output)};
$('mapfile').onchange=()=>{const file=$('mapfile').files[0];$('mapfile').value='';if(file)openImage(file,'map',url=>{mapImage=url;$('map-view').style.backgroundImage='url("'+url+'")';$('map').classList.add('custom');log('Carte optimisée et importée.');document.dispatchEvent(new Event('amertume-content-changed'))})};
loadSession();
