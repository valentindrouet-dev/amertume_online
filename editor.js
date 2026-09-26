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
function normalizeActor(a){a.id??=crypto.randomUUID();a.munitionId??='';a.vie??=a.hero?Math.max(1,a.max/3):0;a.endu??=3;a.pvBonus??=0;a.xp??=0;a.level??=1;a.type??='standard';a.socle??='medium';a.menace??='closest';a.attacks=(Array.isArray(a.attacks)?a.attacks:[]).filter(x=>x&&x.name!==ATTAQUE_AUTO);a.notes??='';a.states??=(a.state&&a.state!=='Aucun'?[a.state]:[]);delete a.state;a.sexe??='';a.race??='';a.vieMax??=a.vie;a.hidden??=false;a.skills??=Array(8).fill(0);a.weapons??=[];a.armures=armuresDe(a);delete a.armorId;a.shieldId??='';a.inventaire=Array.isArray(a.inventaire)?a.inventaire.filter(x=>typeof x==='string'&&x):[];completerInventaire(a);a.activeAttack??=0;a.talents??=[];a.ignition??='';
 a.immunites=immunites(a);a.usages=a.usages&&typeof a.usages==='object'?a.usages:{};
 a.points={action:pointsMax(a,'action'),mouvement:pointsMax(a,'mouvement'),objet:pointsMax(a,'objet')};
 a.checks=Array.isArray(a.checks)?POINTS_CLES.map((q,i)=>Math.max(0,Math.min(pointsMax(a,q),a.checks[i]===true?1:Math.trunc(Number(a.checks[i]))||0))):[0,0,0];a.bleed??=0;a.cumuls??={};a.revealed??=false;a.vu??=false;a.orbes??=0;a.garde??=null;a.numero??=null;
 // L'état Gardé n'existe plus depuis la v0.164 : Gardien pose Blindage.
 a.states=a.states.filter(s=>s!=='Gardé');return a}
// Trois spécialisations par classe, pas une de plus : les trois branches de l'arbre.
const VOIES_MAX=3;
/* Les cinq chemins d'un étage de l'arbre : droit vers le central suivant, vers la diagonale
   gauche et son retour, vers la diagonale droite et son retour. */
const SEGMENTS=['c','g','gc','d','dc'];
/* Un catalogue enregistré avant les talents n'a pas le rayon : on l'ouvre vide. */
function normalizeCatalog(c){c||={};c.items||=[];c.monsters||=[];c.talents||=[];
 // Les mots clés du MJ : des mots ou expressions, uniques, bornés.
 c.motsCles=[...new Set((Array.isArray(c.motsCles)?c.motsCles:[]).map(m=>String(m||'').trim().slice(0,60)).filter(Boolean))].slice(0,200);
 /* Les spécialisations de chaque classe, dans l'ordre du MJ : des noms, trois au plus par
    classe, sans doublon. Une voie qu'un talent nomme sans y figurer s'y lit quand même. */
 const voies=c.voies&&typeof c.voies==='object'&&!Array.isArray(c.voies)?c.voies:{};
 c.voies={};Object.entries(voies).forEach(([f,l])=>{if(!Array.isArray(l))return;
  const noms=[...new Set(l.filter(v=>typeof v==='string').map(v=>v.trim().slice(0,60)).filter(Boolean))].slice(0,VOIES_MAX);
  if(noms.length)c.voies[f]=noms});
 /* Les classes du jeu viennent avec lui : un catalogue enregistré avant elles les reçoit
    une fois. Ensuite elles lui appartiennent, et le MJ peut les corriger. */
 if(!Array.isArray(c.classes))c.classes=structuredClone((window.AMERTUME_CATALOG||{}).classes||[]);
 /* Les premiers talents codés se reconnaissaient à leur nom. Ils portent désormais leur
    effet en clair : on le leur inscrit une fois, d'après ce nom, et le nom redevient
    libre — le renommer ne fait plus perdre la mécanique. */
 c.talents.forEach(t=>{if(t&&(t.effet===undefined||t.effet===''||!TALENTS_CODES[t.effet]))t.effet=effetParNom(t.name)});
 // Un prérequis désigne un autre talent du catalogue, ou rien : un lien mort s'efface.
 c.talents.forEach(t=>{if(!t)return;
  if(!t.prerequis||t.prerequis===t.id||!c.talents.some(x=>x&&x.id===t.prerequis))t.prerequis='';
  // La spécialisation d'un talent : la voie de l'arbre où il se range, ou rien.
  t.voie=typeof t.voie==='string'?t.voie.trim().slice(0,60):'';
  // Sa place dans l'arbre : sur l'épine, ou en diagonale — à gauche, à droite — sous son prérequis.
  t.branche=t.branche==='g'||t.branche==='d'?t.branche:''});
 /* Les chemins fermés de l'arbre, par talent central : ceux qu'on ne dessine ni ne marche.
    Un chemin d'un talent disparu, ou d'un segment inconnu, s'oublie. */
 const caches=c.cheminsCaches&&typeof c.cheminsCaches==='object'&&!Array.isArray(c.cheminsCaches)?c.cheminsCaches:{};
 c.cheminsCaches={};Object.entries(caches).forEach(([id,l])=>{if(!Array.isArray(l)||!c.talents.some(t=>t&&t.id===id))return;
  const segs=[...new Set(l.filter(x=>SEGMENTS.includes(x)))];if(segs.length)c.cheminsCaches[id]=segs});
 /* Une voie qu'un talent porte sans qu'elle soit nommée entre dans la liste de sa classe :
    la colonne ne disparaît pas quand on en sort le dernier talent. */
 c.talents.forEach(t=>{if(!t||!t.voie)return;const f=(t.famille||'').trim()||'Génériques',l=c.voies[f]||[];
  if(!l.includes(t.voie)&&l.length<VOIES_MAX)c.voies[f]=[...l,t.voie]});
 /* Un objet porte un effet du moteur, ses réglages et sa manière d'en user. Un objet
    d'avant les effets n'en a pas, et son ancienne case « consommable » devient son usage. */
 c.items.forEach(o=>{if(!o)return;
  // L'emplacement d'une pièce : le sien s'il est connu, le torse pour les armures d'avant.
  if(o.category==='armor')o.slot=emplacementDe(o);
  o.effet=OBJETS_CODES[o.effet]?o.effet:'';
  o.params=o.effet?paramsObjet(o):{};
  // Sa rareté, et ses bonus, relus au travers de leur déclaration.
  o.rarete=rareteDe(o);o.bonus=normaliseBonusEquip(o.bonus);
  o.usage=usageObjet(o);o.consumable=o.usage==='conso'});
 // Un modèle s'équipe depuis la v0.73 : les anciens reçoivent leurs emplacements vides.
 c.monsters.forEach(m=>{m.weapons||=[];m.armures=armuresDe(m);delete m.armorId;m.shieldId??=''});
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
  a.weapons=armes.map(parNom).filter(Boolean);a.armures=[parNom(armure)].filter(Boolean);a.shieldId=parNom(bouclier);
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
/* Les dés d'une attaque et, s'il y a lieu, le bonus de dégâts avec son jeton : la même
   seconde ligne pour l'attaque d'une arme et pour le talent qui frappe. */
function desEtBonus(dice,bonus){const bas=document.createElement('span');bas.className='des-bonus';
 bas.append(dicePips(dice));
 if(bonus){const plus=document.createElement('b');plus.className='bonus';plus.textContent='+'+bonus;
  // Le jeton des dégâts, après la valeur : on lit « +2 » et l'on voit de quoi il s'agit.
  const ico=document.createElement('img');ico.className='dmg-ico';ico.src=imgUrl('DEGATS.webp');ico.alt='dégâts';ico.draggable=false;
  bas.append(plus,ico)}
 return bas}
/* Les objets qui agissent : chaque pièce portée ou rangée dont le moteur connaît l'effet
   offre son bouton dans la rangée des Actions, à l'encre de sa famille — brun pour une arme,
   vert pour un consommable, bleu-gris pour une armure. */
const TEINTE_OBJET={melee:'#8a7a5a',ranged:'#6f8a5a',armor:'#6b7a8a',object:'#9c8a55'};
// La teinte d'une rareté : c'est elle qui colore les carrés et les boutons, plus la famille.
const TEINTE_RARETE={commun:'#7d7a74',rare:'#4d7fb0',mystique:'#7a5fc0',epique:'#c26a2f'};
function boutonsObjets(a){if(!a||(view!=='mj'&&!controlled(actors.indexOf(a)))||!alive(a))return [];
 const vus=new Set(),out=[];
 (a.inventaire||[]).forEach(id=>{if(vus.has(id))return;vus.add(id);
  const o=objetDe(id),code=objetCode(o);if(!o||!code)return;
  // Une pièce à effet passif agit d'elle-même : pas de bouton.
  if(modeObjet(o)==='passif')return;
  const dispo=objetDisponible(a,o),usage=usageObjet(o),p=paramsObjet(o);
  /* Le bouton dit ce que l'objet prodigue — Invisibilité, Soin, Invulnérabilité — plutôt
     que son nom : c'est l'effet qu'on choisit. Un usage compté s'écrit dessous : 1 / jour,
     0 / jour une fois pris ; 1 / repos entre deux repos courts. */
  const texte=code.cle==='etat'?(p&&p.etat)||code.nom:code.nom;
  const compte=usageLimite(usage)?(dispo?'1':'0')+' / '+(usage==='jour'?'jour':'repos'):'';
  out.push({objet:o,texte,compte,
   teinte:TEINTE_RARETE[rareteDe(o)]||TEINTE_OBJET.object,
   peut:dispo,limite:usageLimite(usage),epuise:!dispo,
   titre:dispo?o.name+' — '+NOM_USAGE(usage)+' · '+code.phrase(paramsObjet(o)).replace(/<[^>]*>/g,'')
    :o.name+' a déjà servi aujourd’hui : il faut une nuit de repos.',
   acteur:a,agir:()=>utiliserObjet(a,o)})});
 return out}
function renderAttackChoices(){const boite=$('attack-choices');if(!boite)return;
 // Plusieurs combattants pris : la carte des Actions ne propose rien.
 if(marked.size>1){boite.replaceChildren();boite.hidden=true;return}
 const a=actors[selected],liste=a?attackChoices(a,catalog.items):[];
 /* Les talents de la rangée des attaques se dessinent à leur suite, en grands boutons à
    deux lignes : le logo à gauche, le nom, puis les dés qu'ils lancent — ou, sans dés, la
    nature du talent. Leur couleur est celle du type, sauf teinte propre. */
 const talents=a&&typeof boutonsTalents==='function'?boutonsTalents(a).filter(b=>b.rangee==='attaques'):[];
 // Même seule, une attaque se montre : on lit ce qui part avant de frapper.
 const objets=a&&typeof boutonsObjets==='function'?boutonsObjets(a):[];
 boite.replaceChildren();boite.hidden=!liste.length&&!talents.length&&!objets.length;
 talents.forEach(t=>{const b=document.createElement('button');b.className=t.classe+' choix-attaque';
  if(t.teinte){b.style.setProperty('--fond',t.teinte);b.classList.add('teinte-propre')}
  const im=logoTalent({logo:t.logo},'bouton');
  if(im){const logos=document.createElement('span');logos.className='logos';logos.append(im);b.classList.add('avec-logo');b.append(logos)}
  const nom=document.createElement('span');nom.className='nom';nom.textContent=t.texte;
  // Les dés qu'il lance sur la seconde ligne ; sans dés, le nom seul — rien d'autre à dire.
  b.append(nom);
  /* Un talent qui frappe se lit comme une attaque : son nom, puis les dés qu'il lance, le
     bonus de dégâts et son jeton. Un talent sans dés garde le nom seul. */
  if(t.des)b.append(desEtBonus(t.des,t.bonus||0));
  else b.classList.add('sans-des');
  inerte(b,!t.peut);b.title=t.titre;b.setAttribute('aria-label',t.texte+' — '+t.titre);
  b.onclick=()=>{if(estInerte(b))return;t.agir()};b.reinit=t.reinit;boite.append(b)});
 /* Les objets qui agissent viennent après les talents : mêmes grands boutons, l'encre de
    leur famille, et le logo de l'objet à gauche. */
 (a?boutonsObjets(a):[]).forEach(b=>{const el=document.createElement('button');
  el.className='btn-action choix-attaque btn-objet teinte-propre';
  el.style.setProperty('--fond',b.teinte);
  const im=logoEquipement({logo:b.objet.logo},'bouton');
  if(im){const logos=document.createElement('span');logos.className='logos';logos.append(im);el.classList.add('avec-logo');el.append(logos)}
  const nom=document.createElement('span');nom.className='nom';nom.textContent=b.texte;
  el.append(nom);
  // Le compte des usages sur la seconde ligne ; sans compte, le nom seul.
  if(b.compte){const c=document.createElement('span');c.className='compte';c.textContent=b.compte;el.append(c)}
  else el.classList.add('sans-des');
  inerte(el,!b.peut);el.title=b.titre;el.setAttribute('aria-label',b.objet.name+' : '+b.texte+(b.compte?' ('+b.compte+')':'')+' — '+b.titre);
  /* Un usage compté porte son chrono, en haut à droite : il dit que la charge se rend au
     repos, et le MJ la rend d'un clic — les joueurs, non, leur bouton est désactivé. */
  if(b.limite){const chrono=document.createElement('span');chrono.className='chrono'+(b.epuise?' vide':'');
   chrono.textContent='⏱';
   chrono.title=view==='mj'
    ?(b.epuise?'Recharger '+b.objet.name+' — MJ':b.objet.name+' : charge intacte. Clic : la reprendre — MJ')
    :NOM_USAGE(usageObjet(b.objet));
   if(view==='mj'){chrono.setAttribute('role','button');chrono.tabIndex=0;
    const basculer=e=>{e.stopPropagation();e.preventDefault();
     const a2=b.acteur;
     if(b.epuise?rendreUsage(a2,b.objet):prendreUsage(a2,b.objet)){
      log('MJ : '+b.objet.name+(b.epuise?' rechargé':' marqué employé')+' pour '+a2.name+'.',{local:true});
      render();scheduleSave()}};
    chrono.onclick=basculer;
    chrono.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')basculer(e)}}
   el.append(chrono)}
  el.onclick=()=>{if(estInerte(el))return;b.agir()};boite.append(el)});
 if(!liste.length)return;
 const retenu=Math.trunc(a.activeAttack)||0;
 liste.forEach((at,i)=>{const b=document.createElement('button');
  b.className='btn-action choix-attaque'+(i===(retenu<liste.length?retenu:0)?' on':'');
  /* Le logo de l'arme à gauche, sur les deux lignes de hauteur ; à sa droite, le nom puis
     les dés — chacun sur sa ligne. Sans logo, les deux lignes occupent tout le bouton. */
  const logos=document.createElement('span');logos.className='logos';
  (at.logos||[]).forEach(l=>{const im=logoAttaque(l,'bouton');if(im)logos.append(im)});
  // Deux armes : les logos l'un sur l'autre, celui de derrière en miroir — croisés.
  if(logos.childElementCount>1)logos.classList.add('croises');
  if(logos.childElementCount){b.classList.add('avec-logo');b.append(logos)}
  /* Une attaque d'équipement s'appelle « Attaque » : les armes se lisent à leurs logos et
     à leurs dés, et leurs noms bout à bout débordaient du bouton. Une attaque de fiche —
     l'Attaque Blindée d'un adversaire — garde le nom qu'on lui a donné. */
  const libelle=at.gear?'Attaque':(at.name||'Attaque');
  const nom=document.createElement('span');nom.className='nom';nom.textContent=libelle;
  /* Deux lignes, centrées : le nom, puis les dés et le bonus de dégâts — on choisit son
     attaque en voyant tout ce qu'elle lance. Affaibli ou une attaque « dés seuls » n'ont
     pas de bonus, et n'en écrivent pas. */
  const bonus=hasState(a,'Affaibli')||at.useOwnDamage===false?0:degatsDe(a);
  b.append(nom,desEtBonus(at.dice,bonus));
  const refus=typeof refusAttaque==='function'?refusAttaque(a,at):'';
  inerte(b,!!refus);
  // Le clic droit du MJ rend l'Action et pose la flèche en vol.
  b.reinit=()=>{rendPoint(a,'action');if(typeof tirEnVol!=='undefined')tirEnVol=false};
  b.title=refus||((at.gear&&at.name?at.name+' — ':'')+'Frapper : '+(at.gear?'attaque avec l’équipement':'attaque de fiche')
   +' · '+(at.range==='distance'?'à distance':'au contact')
   +(at.targets==='all'?' · toutes cibles':''));
  b.setAttribute('aria-label',libelle+(at.gear&&at.name?' ('+at.name+')':'')+' — '+b.title);
  /* Le bouton n'arme plus l'attaque : il la porte. On retient laquelle est partie —
     la réserve affichée la suit — puis le coup part aussitôt. */
  b.onclick=()=>{if(estInerte(b))return;a.activeAttack=i;
   boite.querySelectorAll('.choix-attaque:not(.btn-talent)').forEach((x,k)=>x.classList.toggle('on',k===i));
   attack();scheduleSave()};
  // Les attaques d'abord, toujours : les talents et les objets viennent à leur suite.
  const premierAutre=boite.querySelector('.btn-talent,.btn-objet');
  if(premierAutre)boite.insertBefore(b,premierAutre);else boite.append(b)})}
const cover=document.createElement('div');cover.id='busy-cover';cover.textContent='Chargement de la partie enregistrée…';document.body.append(cover);
function dialog(id,title,body){const el=document.createElement('dialog');el.id=id;el.innerHTML='<div class="dialog-head"><h2>'+title+'</h2><button type="button" aria-label="Fermer" data-close>✕</button></div>'+body;document.body.append(el);el.querySelector('[data-close]').onclick=()=>el.close();return el}
const actorDialog=dialog('actor-editor','Modifier la fiche','<form id="actor-form"><div id="actor-fields"></div><p class="form-error" id="actor-error" role="alert"></p><div class="form-actions"><button type="button" id="delete-actor">Retirer de la scène</button><button type="button" id="save-template">Enregistrer au bestiaire</button><button type="submit" class="primary">Enregistrer la fiche</button></div></form>');
/* ---------- Pages Armurerie et Bestiaire ---------- */
const armoryPage=document.createElement('main');armoryPage.id='armory-page';
armoryPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Armurerie</h2><div class="cat-actions">'
 +'<button id="armory-add" class="primary">+ Ajouter</button></div></header>'
 
 +'<div class="cat-filters"><input id="armory-search" placeholder="Rechercher…" aria-label="Rechercher un objet">'
 +'<select id="armory-cat" aria-label="Catégorie"><option value="">Toutes catégories</option>'
 +'<option value="melee">Armes de mêlée</option><option value="ranged">Armes à distance</option>'
 +'<option value="armor">Armures</option><option value="object">Objets</option></select></div>'
 /* La banque des effets d'équipement, comme celle des talents : ce que le moteur sait
    faire quand on se sert d'un objet, replié par défaut. */
 +'<details class="bloc-replie biblio"><summary><span class="bloc-titre">📖 Banque des effets d’équipement</span>'
 +'<span class="compte" id="biblio-objets-compte"></span></summary><div id="biblio-objets"></div></details>'
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
 +'<div class="divider"></div><h3 class="reglage-titre">Sauvegarde globale</h3>'
 +'<p class="muted">Toute la partie dans un seul fichier : aventuriers, adversaires, bestiaire, armurerie, talents, cartes, domaine et scène en cours. À garder au chaud, au cas où ce navigateur perdrait ses données.</p>'
 +'<div class="reglage"><div><strong>Exporter toute la partie</strong><p class="muted">Télécharge un fichier .json sur cet appareil.</p></div>'
 +'<button id="export-tout" class="primary">⇩ Exporter</button></div>'
 +'<div class="reglage" id="reglage-import"><div><strong>Importer une sauvegarde</strong><p class="muted">Remplace la partie de ce navigateur par le fichier choisi. Exporte d’abord la partie actuelle si tu veux la garder.</p></div>'
 +'<button id="import-tout">⇧ Importer</button><input type="file" id="import-fichier" accept=".json,application/json" hidden></div>'
 +'<p class="form-error" id="import-erreur" role="status" aria-live="polite"></p>'
 +'</section>';
const talentsPage=document.createElement('main');talentsPage.id='talents-page';
talentsPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Talents</h2><div class="cat-actions">'
 +'<button id="talent-mots" title="Les mots mis en valeur dans les descriptions de talents">Mots clés</button><button id="talent-add" class="primary">+ Nouveau talent</button></div></header>'
 
 +'<div class="cat-filters"><input id="talent-search" placeholder="Rechercher…" aria-label="Rechercher un talent">'
 +'<select id="talent-family" aria-label="Classe"></select>'
 +'<select id="talent-sort" aria-label="Tri" hidden><option value="niveau">Tri : niveau ↑</option>'
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
/* Un menu déroulant posé à côté d'un bouton, le temps d'un choix. choixVif remplace le
   nœud qu'il décore ; ici il n'y a rien à remplacer, seulement une liste à offrir. */
function choixMenu(ancre,options,poser){if(view!=='mj'||!ancre||!ancre.parentNode)return;
 const menu=document.createElement('select');menu.className='champ-vif choix';
 menu.setAttribute('aria-label',ancre.title||'Choisir');
 menu.add(new Option('—',''));
 options.forEach(([v,t])=>menu.add(new Option(t,v)));
 ancre.after(menu);menu.focus();champsOuverts++;
 let clos=false;
 const fermer=garder=>{if(clos)return;clos=true;champsOuverts--;
  const v=menu.value;menu.remove();if(garder&&v)poser(v)};
 menu.onchange=()=>fermer(true);
 menu.onblur=()=>fermer(false);
 menu.onkeydown=ev=>{if(ev.key==='Escape'){ev.preventDefault();fermer(false)}}}
// « fn » nul : l'intitulé paraît sans son bouton — un outil que ce regard n'a pas.
function sousTitre(texte,titre,fn,glyphe='+'){const h=document.createElement('h4');h.className='hero-sous';
 h.append(texte);
 if(!fn)return h;
 const b=document.createElement('button');b.className='ico plus'+(glyphe==='+'?'':' rouage');b.textContent=glyphe;
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
/* Les PV maximum d'un aventurier ne se saisissent jamais : Vie × Endurance + bonus de
   classe et d'espèce. Toucher Vie ou Endurance les recalcule donc aussitôt, et les PV du
   moment restent sous le nouveau plafond. */
function recalculerPV(a){if(!a||!a.hero)return false;
 /* Les nœuds de bonus appris comptent, et ce qu'un Meneur allié confère à portée aussi —
    temporairement : le plafond redescend quand on s'éloigne, et les PV du moment suivent ;
    en arrivant sous l'aura, ils montent d'autant, une fois. Le MJ calcule l'aura, la
    table la transporte : un joueur relit celle qu'on lui a donnée. */
 const aura=view==='mj'&&typeof auraMeneur==='function'?auraMeneur(a,'pv'):(Number(a.auraPv)||0);
 const max=pvMaximum(catalog.classes,a,catalog.talents,catalog.items)+aura;a.pvBonus=bonusPV(catalog.classes,a.role,a.race);
 const delta=aura-(Number(a.auraPv)||0);a.auraPv=aura;
 if(max===a.max&&!delta)return false;
 writeStat(a,'max',max);if(delta>0)a.hp=Math.min(a.max,a.hp+delta);return true}
// À chaque rendu du MJ, les PV max de la troupe se relisent : un nœud appris, un Meneur qui s'approche.
function synchronisePV(){if(view!=='mj')return false;let change=false;
 actors.forEach(a=>{if(a&&a.hero&&recalculerPV(a))change=true});return change}
function poserCarac(a,cle,brut,carte){const avant=a[cle];writeStat(a,cle,brut);
 if(a[cle]===avant)return;
 if(cle==='vie'||cle==='endu')recalculerPV(a);
 majFiche(carte,a);rendrePlusTard();scheduleSave();
 // Une fiche corrigée est du contenu : une publication en cours la reprend.
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* L'écu de DEF redessiné sans être remplacé : même élément, autre image. */
function majEcu(ecu,valeur){if(!ecu)return;
 const im=ecu.querySelector('img');if(im)im.src=ecuDef(valeur);
 ecu.setAttribute('aria-label','DEF '+valeur);
 // L'écu est dessiné, chiffre compris : plus de texte posé dessus.
 const b=ecu.querySelector('b');if(b)b.remove()}
/* Réécrire les chiffres d'une carte d'aventurier là où ils sont, sans rien remplacer.
   Un chiffre en cours de saisie n'est pas dans la page : le sélecteur ne le trouve
   pas, et il n'est donc pas écrasé sous les doigts. */
function majFiche(carte,a){if(!carte)return;
 const ecrire=(sel,texte)=>{const n=carte.querySelector(sel);if(n)n.textContent=texte};
 ecrire('.stat-tile.t-vie strong',vieAffichee(a));ecrire('.stat-tile.t-vie small','MAX '+(a.vieMax??a.vie));
 ecrire('.stat-tile.t-endu strong',enduAffichee(a));
 ecrire('.stat-tile.t-pv strong',a.max);
 ecrire('.stat-tile.t-dmg strong','+'+degatsDe(a));ecrire('.stat-tile.t-xp strong',a.xp||0);
 ecrire('.chip-niveau','Niveau '+a.level);ecrire('.chip-xp',(a.xp||0)+' XP');
 majEcu(carte.querySelector('.stat-tile.t-def .ecu'),defOf(a));
 carte.querySelectorAll('.skill-chip').forEach((puce,k)=>{
  const b=puce.querySelector('b');if(b)b.textContent='+'+competenceDe(a,k);
  puce.classList.toggle('zero',!competenceDe(a,k))})}
/* Rendre modifiables les tuiles d'une rangée : la grosse valeur, et le plafond
   écrit en petit dessous quand il y en a un. La DEF fait exception dès qu'une
   armure la commande — elle se change alors dans l'équipement, pas ici. */
/* Le détail d'un chiffre de fiche, en lignes : chacune dit une part, la dernière le total. */
function detailPvMax(a){const b=bonusDe(a,catalog.talents,catalog.items);
 const vieB=Math.max(1,Math.trunc(Number(a.vie))||1),enduB=Math.max(1,Math.trunc(Number(a.endu))||1),vie=vieB+b.vie,endu=enduB+b.endu;
 const c=classeDe(catalog.classes,a.role),classe=(c&&Number(c.pv))||0,espece=pvEspece(a.race),aura=Number(a.auraPv)||0;
 const l=[['PV max','= Endu × Vie + Classe'],['Endurance',endu+(b.endu?' ('+enduB+' + '+b.endu+' de bonus)':'')],['Vie',vie+(b.vie?' ('+vieB+' + '+b.vie+' de bonus)':'')],
  ['Endu × Vie',endu+' × '+vie+' = '+endu*vie]];
 l.push(['Classe'+(c&&c.name?' ('+c.name+')':''),(classe>=0?'+ ':'− ')+Math.abs(classe)]);
 if(espece)l.push(['Espèce ('+a.race+')',(espece>=0?'+ ':'− ')+Math.abs(espece)]);
 if(b.pv)l.push(['Bonus de talents et d’équipement','+ '+b.pv]);
 if(aura)l.push(['Meneur allié','+ '+aura]);
 l.push(['Total',String(a.max)]);return l}
function detailDegats(a){const b=bonusDe(a,catalog.talents,catalog.items),bt=bonusDe(a,catalog.talents,null),aura=typeof auraMeneur==='function'?auraMeneur(a,'dmg'):0;
 const l=[['Dégâts','= fiche + bonus'],['Fiche (saisie)',String(Number(a.dmg)||0)]];
 if(bt.dmg)l.push(['Talents','+ '+bt.dmg]);if(b.dmg-bt.dmg)l.push(['Équipement','+ '+(b.dmg-bt.dmg)]);if(aura)l.push(['Meneur allié','+ '+aura]);
 l.push(['Total','+'+degatsDe(a)]);return l}
function calculAuSurvol(tuile,lignes){if(!tuile)return;
 const montre=()=>{const d=document.createElement('div');d.className='calcul-bulle';
  lignes().forEach(([k,v],i,t)=>{const r=document.createElement('div');r.className='calcul-ligne'+(i===0?' tete':i===t.length-1?' total':'');
   const a=document.createElement('span');a.textContent=k;const b=document.createElement('b');b.textContent=v;r.append(a,b);d.append(r)});
  ouvrirBulle(tuile,d,'bulle-calcul')};
 if(BULLES)surveille(tuile,montre);else tuile.title=lignes().map(([k,v])=>k+' '+v).join('\n')}
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
 /* Au survol, la classe se présente : son nom, ce qu'elle apporte aux PV, sa description. Au
    clic, son arbre de talents s'ouvre — celui de l'aventurier, ou celui de la classe pour le MJ. */
 {const cl=classeDe(catalog.classes,a.role),nomCl=cl&&cl.name||(a.role||'Aventurier').split('·')[0].trim();
  classe.classList.add('cliquable');classe.setAttribute('role','button');classe.tabIndex=0;classe.setAttribute('aria-label','Arbre de talents de '+nomCl);
  const ouvre=()=>{if(typeof peutVoirArbres==='function'&&peutVoirArbres(a))openArbres(a);else if(view==='mj')openArbresClasse(nomCl)};
  classe.onclick=ev=>{ev.stopPropagation();fermerBulle();ouvre()};classe.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ouvre()}};
  const montre=()=>{const d=document.createElement('div');d.className='calcul-bulle classe-bulle';
   const t=document.createElement('div');t.className='calcul-ligne tete';const n=document.createElement('span');n.textContent=nomCl;n.style.color=teinte;t.append(n);d.append(t);
   const pv=cl?Number(cl.pv)||0:0;const l=document.createElement('div');l.className='calcul-ligne';const k=document.createElement('span');k.textContent='Bonus de PV max';const v=document.createElement('b');v.textContent=(pv>=0?'+ ':'− ')+Math.abs(pv);l.append(k,v);d.append(l);
   const texte=cl&&(cl.description||cl.notes);if(texte){const p=document.createElement('p');p.className='classe-texte';p.textContent=texte;d.append(p)}
   const aide=document.createElement('p');aide.className='classe-aide';aide.textContent='Clique pour ouvrir l’arbre de talents.';d.append(aide);
   ouvrirBulle(classe,d,'bulle-calcul')};
  if(BULLES)surveille(classe,montre);else classe.title=nomCl+' — bonus de PV max '+(cl?cl.pv:0)}
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
   copie.name=a.name+' (copie)';copie.target=null;copie.checks=[0,0,0];
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
 const tuiles=[['vie','Vie',vieAffichee(a),false,a.vieMax??a.vie],['endu','Endu',enduAffichee(a)],
  ['pv','PV max',a.max],['def','DEF',defOf(a),true],['dmg','Dég.','+'+degatsDe(a)]]
  .map(t=>statTile(...t));
 // Le MJ corrige un chiffre là où il le lit ; les PV max se calculent, ils ne se saisissent pas.
 tuilesVives(a,tuiles,[['vie','vieMax'],['endu'],[],['def'],['dmg']],c);
 // Au survol, le calcul : d'où viennent les PV max, et les Dégâts.
 calculAuSurvol(tuiles[2],()=>detailPvMax(a));calculAuSurvol(tuiles[4],()=>detailDegats(a));
 chiffres.append(...tuiles);
 /* La fiche ne montre que ce que l'aventurier sait faire : une compétence à zéro
    n'apprend rien à personne et prenait une case pour rien. Le « + » ouvre la liste
    entière et donne un point à celle qu'on choisit — c'est ainsi qu'une compétence
    inédite paraît. */
 /* Un joueur lit les fiches de la troupe, mais ne tient d'outils que sur la sienne : les
    « + » sont au MJ, et le rouage des arbres s'ouvre pour son propre aventurier. */
 const mien=view==='mj'||actors.indexOf(a)===owner;
 const titreComp=sousTitre('Compétences','Ajouter un point de compétence à '+a.name,view!=='mj'?null:ev=>{
  ev.stopPropagation();
  choixMenu(ev.currentTarget,skillNames.map((n,k)=>[String(k),n+' +'+a.skills[k]]),v=>{
   const k=Number(v);if(!(k>=0&&k<skillNames.length))return;
   a.skills[k]=readStat('skill',a.skills[k]+1,a.skills[k]);
   majFiche(c,a);rendrePlusTard();scheduleSave();
   document.dispatchEvent(new Event('amertume-content-changed'))})});
 const comps=document.createElement('div');comps.className='skills';
 skillNames.forEach((n,k)=>{
  // Un point appris dans l'arbre compte : la puce paraît, la valeur le porte, et le clic corrige la fiche.
  if(!competenceDe(a,k))return;
  const puce=document.createElement('span');puce.className='skill-chip'+(competenceDe(a,k)?'':' zero');
  puce.style.setProperty('--tint',SKILL_TINTS[k]);
  const l=document.createElement('span');l.textContent=n;
  const v=document.createElement('b');v.textContent='+'+competenceDe(a,k);
  champVif(v,()=>a.skills[k],brut=>{const avant=a.skills[k];
   a.skills[k]=readStat('skill',brut,avant);
   if(a.skills[k]!==avant){majFiche(c,a);rendrePlusTard();scheduleSave();
    document.dispatchEvent(new Event('amertume-content-changed'))}},'Modifier '+n+' de '+a.name,'petit');
  puce.append(l,v);comps.append(puce)});

 const titreKit=sousTitre('Équipement','Inventaire de '+a.name,view!=='mj'?null:()=>openPicker(a,'gear'));
 // Le rouage ouvre les arbres de la classe : les talents s'y choisissent de haut en bas.
 const titreTal=sousTitre('Talents','Arbres de talents de '+a.name,mien?()=>openArbres(a):null,'⚙');
 c.append(tete,puces,chiffres,titreComp,comps,titreKit,corpsEtSac(a),titreTal,talentPills(a));return c}
function renderHeroes(){const grille=$('hero-grid');if(!grille)return;grille.replaceChildren();
 const q=($('hero-search').value||'').trim().toLowerCase();
 const troupe=actors.filter(a=>a.hero);
 // La maîtrise d'une classe s'acquiert avec la classe : on la pose avant de dessiner.
 if(view==='mj'){let acquis=false;troupe.forEach(a=>{if(assureMaitrises(a))acquis=true});if(acquis)scheduleSave()}
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
/* « place » : une arme à distance qui n'a qu'un ou deux dés montre, tout à droite, un dé vide
   de même taille — la place qu'une munition peut remplir. */
function dicePips(dice,etat,place){const out=document.createElement('span');out.className='pips';
 const e=etatPastille(etat);if(e)out.append(e);let n0=0;
 DIE_ORDER.forEach(c=>{for(let n=0;n<(dice&&dice[keys[c]]||0);n++){
  const d=document.createElement('i');d.className='die-sq';n0++;
  d.style.setProperty('--face',dieFace(c));d.title=types[c];out.append(d)}});
 if(place&&n0>=1&&n0<=2){const v=document.createElement('i');v.className='die-sq die-munition';v.title='Place d’une munition';out.append(v)}
 return out}
function itemColumn(a){return a.category==='armor'?'armor'
 :a.category==='weapon'?(a.ranged?'ranged':'melee'):'object'}
/* La même pastille qu'à l'armurerie, mais posée : sur une fiche on lit son équipement,
   on ne le modifie pas d'un clic. Les dés de l'arme, la DEF de l'armure, l'effet d'un objet. */
function gearPill(o){const col=itemColumn(o);
 const p=document.createElement('span');p.className='cat-pill k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');
 const logo=logoEquipement(o);if(logo)p.append(logo);
 const nom=document.createElement('span');nom.className='nom';nom.textContent=o.name;p.append(nom);
 if(col==='armor')p.append(shieldBadge(o.def||0));
 else if(col==='object'){const t=document.createElement('span');t.className='tag';
  t.textContent=(o.effects||o.notes||'—').slice(0,22);p.append(t)}
 else p.append(dicePips(o.dice,o.etat));
 const info=[o.etat?'inflige '+o.etat:'',o.effects,(o.traits||[]).join(', '),o.notes].filter(Boolean).join(' · ');
 p.title=info?o.name+' — '+info:o.name;
 return p}
/* L'équipement d'une fiche, sur deux colonnes : les armes à gauche, l'armure et le
   bouclier à droite, chaque colonne empilant les siens. Deux exemplaires de la même arme
   font une pastille marquée « ×2 », pas deux jumelles. */
/* L'équipement d'une fiche, en carrés : le logo en haut, les dés — ou l'écu — en bas, rien
   d'autre. Un clic déplie sa description sur toute la ligne, sous la rangée de carrés,
   comme les talents. Les armes d'abord, l'armure et le bouclier ensuite ; deux exemplaires
   de la même arme ne font qu'un carré, marqué ×2. Les carrés ouverts le restent au rendu. */
/* Une seule description à la fois, sous la rangée : celle du dernier carré cliqué. */
/* ---------- La bulle flottante ----------
   La description d'un objet ou d'un talent ne pousse plus ses voisins : elle sort du flux et
   se pose au-dessus de la vignette cliquée, dans une bulle à elle. Un clic ailleurs, Échap,
   un défilement ou un changement de taille la referment.
   « BULLES » commande tout : à faux, les dépliants d'avant reviennent tels quels, en place
   sous la vignette — le code des deux est là, et l'on bascule d'un mot. */
const BULLES=true;
let bulleEl=null,bulleAncre=null,bulleEpinglee=false;
/* La bulle s'ouvre au survol de la vignette et s'en va dès que le doigt la quitte — sans
   attendre, et sans qu'on puisse la retenir en la survolant : tant qu'elle n'est pas
   épinglée, la souris la traverse. Le clavier fait de même par le focus. */
function surveille(el,quoi){if(!BULLES||!el)return el;
 /* L'infobulle du système doublait la bulle, et les deux se lisaient l'une sur l'autre :
    la vignette et ce qu'elle contient n'en gardent aucune — le nom reste au lecteur d'écran. */
 [el,...el.querySelectorAll('[title]')].forEach(x=>{if(!x.title)return;
  if(!x.getAttribute('aria-label'))x.setAttribute('aria-label',x.title);x.removeAttribute('title')});
 const ouvre=()=>{if(!bulleEpinglee)quoi()};
 const lache=()=>{if(!bulleEpinglee)fermerBulle()};
 el.addEventListener('pointerenter',ouvre);
 el.addEventListener('focus',ouvre);
 el.addEventListener('pointerleave',lache);
 el.addEventListener('blur',lache);
 return el}
/* Épinglée, la bulle tient le temps d'aller y chercher le bouton « Utiliser » d'un objet :
   elle s'en va quand on la quitte, elle, d'un clic ailleurs, ou d'Échap. */
function epingleBulle(oui){bulleEpinglee=!!oui&&!!bulleEl;if(bulleEl)bulleEl.classList.toggle('epinglee',bulleEpinglee)}
// Le clic épingle la bulle de cette vignette ; le même clic, encore, la referme.
function basculeEpingle(el,quoi){if(bulleEpinglee&&bulleAncre===el){fermerBulle();return}
 quoi();if(bulleAncre===el)epingleBulle(true)}
// Après un rendu, la bulle se repose telle qu'elle était : épinglée si elle l'était.
function reposeBulle(quoi){const ep=bulleEpinglee;quoi();if(ep)epingleBulle(true)}
/* Et si sa vignette n'est plus là après le rendu — l'objet consommé, la fiche changée —,
   elle s'en va : une bulle sans ancre ne se repose sur rien. */
function bulleOrpheline(){if(BULLES)requestAnimationFrame(()=>{if(bulleEl&&bulleAncre&&!bulleAncre.isConnected)fermerBulle()})}
/* Refermée, plus rien n'est « ouvert » : un rendu venu d'ailleurs — un jet, la table d'en
   face — ne la ferait pas renaître sur la dernière vignette survolée. */
function fermerBulle(){retireBulle();if(BULLES){gearOuvert=null;talentOuvert=null}}
// Ôter la bulle sans rien oublier de ce qui est ouvert : c'est ainsi qu'elle se remplace.
function retireBulle(){bulleEpinglee=false;if(!bulleEl)return;bulleEl.remove();bulleEl=null;bulleAncre=null;
 document.removeEventListener('pointerdown',bulleDehors,true);
 document.removeEventListener('keydown',bulleEchap,true);
 window.removeEventListener('scroll',fermerBulle,true);window.removeEventListener('resize',fermerBulle)}
function bulleDehors(e){if(bulleEl&&!bulleEl.contains(e.target)&&(!bulleAncre||!bulleAncre.contains(e.target)))fermerBulle()}
/* Échap ferme d'abord la bulle, et rien d'autre : la table déselectionne au même geste, et
   l'on perdait sa fiche en refermant une description. Un second Échap, elle. */
function bulleEchap(e){if(e.key!=='Escape'||!bulleEl)return;
 e.preventDefault();e.stopPropagation();fermerBulle()}
/* Où la poser : au-dessus de la vignette si la place y est, dessous sinon ; centrée sur elle,
   sans jamais déborder de la fenêtre. La flèche vise le centre de la vignette. */
function placerBulle(){if(!bulleEl||!bulleAncre)return;
 const r=bulleAncre.getBoundingClientRect(),b=bulleEl.getBoundingClientRect(),marge=8;
 /* Une vignette sans place à l'écran — la fiche d'un onglet caché, la même qu'ailleurs —
    n'ancre rien : la bulle s'en irait se coller dans le coin. */
 if(!bulleAncre.isConnected||(!r.width&&!r.height)){fermerBulle();return}
 const dessous=r.top-b.height-12<marge;
 const haut=dessous?r.bottom+10:r.top-b.height-10;
 let gauche=r.left+r.width/2-b.width/2;
 gauche=Math.max(marge,Math.min(innerWidth-b.width-marge,gauche));
 bulleEl.style.top=Math.max(marge,haut)+'px';bulleEl.style.left=gauche+'px';
 bulleEl.classList.toggle('dessous',dessous);
 bulleEl.style.setProperty('--fleche',Math.max(14,Math.min(b.width-14,r.left+r.width/2-gauche))+'px')}
// « ancre » doit être visible : une vignette d'une page repliée n'ouvre pas de bulle.
function ancreVisible(el){return !!el&&el.isConnected&&!!el.offsetParent}
function ouvrirBulle(ancre,contenu,classe){retireBulle();if(!ancreVisible(ancre)||!contenu)return null;
 bulleEl=document.createElement('div');bulleEl.className='bulle'+(classe?' '+classe:'');
 bulleEl.append(contenu);document.body.append(bulleEl);bulleAncre=ancre;
 // Seule une bulle épinglée reçoit la souris : la quitter, alors, la referme.
 bulleEl.addEventListener('pointerleave',()=>{if(bulleEpinglee)fermerBulle()});
 placerBulle();
 document.addEventListener('pointerdown',bulleDehors,true);
 document.addEventListener('keydown',bulleEchap,true);
 window.addEventListener('scroll',fermerBulle,true);window.addEventListener('resize',fermerBulle);
 return bulleEl}
/* La description ouverte : une seule à la fois, et sur la fiche où l'on a cliqué. Retenue
   au seul identifiant de l'objet, elle s'ouvrait aussi chez les autres porteurs du même
   objet, dont les carrés se décalaient sans qu'on y touche. */
let gearOuvert=null;
const cleGear=(a,o)=>(a&&a.id||'?')+'|'+(o&&o.id||'?');
/* L'icône de l'effet d'une pièce : l'état qu'elle donne ; barré, l'état ou la couleur de dés
   dont elle rend insensible. */
function pastilleEffet(o){const code=objetCode(o);if(!code)return null;const p=paramsObjet(o)||{};let el=null,titre='';
 if(code.cle==='invulnerabilite'){if(p.contre==='des'){const k=keys.indexOf(p.des);if(k<0)return null;el=document.createElement('i');el.className='die-sq';el.style.setProperty('--face',dieFace(k));titre='Insensible aux dés '+types[k]}
  else{el=etatPastille(p.etat);titre='Insensible à '+p.etat}}
 else if(code.cle==='etat'){el=etatPastille(p.etat);titre='Donne '+p.etat}
 if(!el)return null;el.removeAttribute('title');el.removeAttribute('aria-label');
 const w=document.createElement('span');w.className='effet-pastille'+(code.cle==='invulnerabilite'?' barre':'');w.title=titre;w.setAttribute('role','img');w.setAttribute('aria-label',titre);w.append(el);return w}
function gearCarre(o,n,portes){const col=itemColumn(o),equipable=o.category==='weapon'||o.category==='armor'||o.category==='ammo';
 const p=document.createElement('span');p.className='cat-pill gear-carre k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'')+(equipable?(portes?' porte':' dispo'):'');p.setAttribute('role','button');p.tabIndex=0;
 if(equipable){const m=document.createElement('span');m.className='marque-porte';m.textContent='✓';p.append(m)}
 const logo=logoEquipement(o);
 if(logo)p.append(logo);else{const g=document.createElement('span');g.className='glyphe';g.textContent=col==='armor'?'🛡':col==='object'?'◈':'⚔';p.append(g)}
 /* Sous le logo d'une pièce d'équipement : sa DEF — seulement si elle en donne, ou si c'est une
    armure de corps ou un bouclier —, puis l'icône de son effet : l'état qu'elle rend, barré
    quand elle en protège. Un anneau sans DEF ne porte plus d'écu à zéro. */
 if(col==='armor'){const bas=document.createElement('span');bas.className='gear-bas';
  if((Number(o.def)||0)>0||['torse','shield'].includes(emplacementDe(o)))bas.append(shieldBadge(o.def||0));
  const eff=pastilleEffet(o);if(eff)bas.append(eff);
  if(bas.children.length)p.append(bas)}
 else if(col!=='object')p.append(dicePips(o.dice,o.etat,col==='ranged'));
 // Une munition montre ce qu'elle ajoute : son dé, son état.
 else if(o.category==='ammo'&&(o.munDe||o.etat))p.append(dicePips(o.munDe?{[o.munDe]:1}:{},o.etat));
 if(n>1){const x=document.createElement('span');x.className='exemplaires';x.textContent=(portes>1?portes+'/':'×')+n;p.append(x)}
 p.title=o.name+(portes?' — porté':'');p.setAttribute('aria-label',p.title);
 return p}
/* Le dépliant ne dit que l'essentiel : le nom, les mains et la portée d'une arme — les dés
   sont sur le carré —, la DEF d'une armure, l'état qu'elle inflige s'il y en a un. */
function gearDetail(o,a,enJeu){const col=itemColumn(o),d=document.createElement('div');d.className='gear-detail large k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');
 const titre=document.createElement('p');titre.className='gear-nom';titre.textContent=o.name;d.append(titre);
 const ligne=(texte,classe)=>{if(!texte)return;const p=document.createElement('p');if(classe)p.className=classe;p.textContent=texte;d.append(p)};
 // La rareté, puis ce que la pièce confère, une ligne par bonus.
 if(rareteDe(o)!=='commun')ligne(NOM_RARETE(rareteDe(o)),'gear-rarete r-'+rareteDe(o));
 normaliseBonusEquip(o.bonus).forEach(b=>ligne(libelleBonus(b),'gear-bonus'));
 if(col==='armor')ligne('DEF '+(o.def||0)+' · '+NOM_EMPLACEMENT(emplacementDe(o)).toLowerCase());
 else if(col!=='object')ligne((o.hands===2?'2 mains':'1 main')+(col==='ranged'?' · à distance':' · au contact'));
 if(o.category==='ammo'){const k=keys.indexOf(o.munDe);ligne('Munition : '+(k>=0?'+1 dé '+types[k]:'aucun dé')+' aux armes à distance portées');ligne(o.etat?'Leur tir inflige : '+o.etat:'')}
 else if(o.etat)ligne('Inflige : '+o.etat);
 /* Un objet dit ce qu'il fait et s'utilise d'un bouton : l'effet part au journal de la
    table, et un consommable quitte l'inventaire. Le moteur ne devine rien de plus. */
 if(col==='object')ligne(o.effects||o.notes||'Effet à préciser dans l’armurerie.');
 /* Ce que le moteur en fera, et comment on en use : la phrase vient du moteur, jamais
    recopiée ici, et l'usage dit si l'objet se garde, se défausse ou attend le lendemain. */
 const code=objetCode(o);
 if(code){const p=document.createElement('p');p.className='gear-effet';
  p.innerHTML=phraseDeObjet(o);d.append(p);
  if(modeObjet(o)==='passif')ligne('Passif : agit tant que la pièce est portée','gear-passif');
  else ligne('Usage : '+NOM_USAGE(usageObjet(o))+(usageLimite(usageObjet(o))&&a&&usageEpuise(a,o)?' — déjà employé':''))}
 /* Un objet s'emploie à la table de jeu ; un équipement qui porte un effet aussi — la page
    Aventuriers, elle, ne fait que ranger l'inventaire. */
 /* Plus de bouton dans la bulle — elle s'efface quand la souris la quitte : un objet
    s'utilise d'un clic sur son carré, en jeu comme sur la fiche. */
 if(a&&col==='object'&&actors.includes(a)){const p=document.createElement('p');p.className='gear-astuce';
  p.textContent=code&&!objetDisponible(a,o)?'Déjà employé : il faut un repos pour le recharger.':'Clique l’objet pour l’utiliser.';d.append(p)}
 return d}
/* Utiliser un objet : on désigne d'abord la cible — un combattant, ou l'endroit visé pour
   ce qui frappe une zone —, puis l'effet se joue. Le journal et une annonce au-dessus de
   la carte disent l'objet, sa cible et ce qu'il fait ; un consommable quitte l'inventaire. */
/* Une fois par jour : la charge est retenue sur le porteur, objet par objet, et revient
   avec le repos — le retour au tour 1 d'une rencontre, ou l'Onde qui remet un camp d'aplomb. */
function usageEpuise(a,o){return !!(a&&o&&a.usages&&a.usages[o.id])}
function objetDisponible(a,o){return !usageLimite(usageObjet(o))||!usageEpuise(a,o)}
/* Rendre sa charge à un objet : le MJ le fait d'un clic sur le chrono, quel que soit le
   repos dont elle dépendait. */
function rendreUsage(a,o){if(view!=='mj'||!a||!o||!usageEpuise(a,o))return false;
 const u={...(a.usages||{})};delete u[o.id];a.usages=u;return true}
// L'envers : le MJ marque la charge employée sans que l'objet agisse.
function prendreUsage(a,o){if(view!=='mj'||!a||!o||!usageLimite(usageObjet(o))||usageEpuise(a,o))return false;
 a.usages={...(a.usages||{}),[o.id]:usageObjet(o)};return true}
/* Un repos rend les charges : le court ne rend que les siennes, le long rend tout. C'est
   par là que passera le repos court quand il arrivera. */
function reposer(a,type='long'){if(!a||!a.usages)return 0;
 const garde={},rendues=[];
 Object.entries(a.usages).forEach(([id,quoi])=>{
  if(type==='long'||quoi==='court')rendues.push(id);else garde[id]=quoi});
 a.usages=garde;return rendues.length}
/* Un objet dont le moteur connaît l'effet agit sur son porteur : rien à viser, le geste est
   pour soi. Le reste — les objets purement décrits — se vise comme avant. */
function appliquerEffetObjet(a,o){const code=objetCode(o);if(!a||!code)return;
 if(!objetDisponible(a,o)){log(o.name+' a déjà servi aujourd’hui : il faut une nuit de repos.',{local:true});return}
 const p=paramsObjet(o),usage=usageObjet(o);let dit='';
 if(code.cle==='soin'){
  if(a.hp>=a.max){log(nomNum(a)+' est déjà au complet : '+o.name+' reste en réserve.',{local:true});return}
  const {total,jets}=montantRegeneration(a,p,d6),gagne=applyHeal(a,total);
  if(jets.length&&typeof rollOnBoard==='function')rollOnBoard(jets.map(v=>[v,4]),a,a);
  if(typeof floatNumber==='function')floatNumber(a,'+'+gagne,'gain');
  dit='+'+gagne+' PV'+(jets.length?' ('+jets.join(' + ')+')':'')}
 else if(code.cle==='etat'){const issue=infligeEtat(a,p.etat);
  if(typeof floatNumber==='function')floatNumber(a,issue===true?'+'+p.etat:p.etat,issue===true?'gain':'nul');
  dit=issue===true?p.etat+' obtenu':issue==='onde'?'l’Onde a absorbé '+p.etat:issue==='immunise'?p.etat+' sans effet : il y est insensible':p.etat+' déjà porté'}
 else if(code.cle==='invulnerabilite'){
  const des=p.contre==='des',valeur=des?p.des:p.etat;
  const nom=des?((DES_ORBE.find(([k])=>k===valeur)||[])[1]||valeur)+'s':valeur;
  const neuf=poseImmunite(a,des?'des':'etats',valeur);
  if(des&&!neuf)dit='déjà insensible aux dés '+nom;
  else dit='insensible '+(des?'aux dés ':'à ')+nom+(neuf?'':' — déjà');
  if(neuf&&!des&&hasState(a,valeur)){setState(a,valeur,false);dit+=', et '+valeur+' se dissipe'}}
 // La charge du jour est prise, le consommable quitte l'inventaire.
 if(usageLimite(usage)){a.usages={...(a.usages||{}),[o.id]:usage}}
 if(usage==='conso')retirerInventaire(a,o);
 log(nomNum(a)+' emploie '+o.name+(dit?' : '+dit:'')+'.',{ton:'talent'});
 if(typeof annonceFlottante==='function')annonceFlottante('◈ '+o.name+(dit?' · '+dit:''));
 render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* Sur la table, l'objet se vise sur la carte ; ailleurs — l'onglet Aventuriers, sans carte —
   il s'emploie sur son porteur, à moins qu'il n'inflige un état : celui-là ramène à la table
   pour y viser sa cible. */
function employerDepuisFiche(a,o){const surTable=typeof PAGES==='undefined'||!PAGES.some(x=>x!=='table'&&document.body.classList.contains('page-'+x));
 if(surTable||objetCode(o)){utiliserObjet(a,o);return}
 if(o.etat&&typeof showPage==='function'){showPage('table');utiliserObjet(a,o);return}
 appliquerObjet(a,o,a,null)}
function utiliserObjet(a,o){if(!a||!o)return;
 // Un objet qui porte un effet du moteur agit sur son porteur : il n'y a rien à désigner.
 if(objetCode(o)){appliquerEffetObjet(a,o);return}
 if(typeof viserCible!=='function'){appliquerObjet(a,o,a,null);return}
 viserCible('◈ '+o.name+' — clique le combattant ou l’endroit visé',
  (vise,q)=>appliquerObjet(a,o,vise,q),o.name+' : geste annulé.')}
function appliquerObjet(a,o,vise,q){
 const dit=(o.effects||o.notes||'').trim();
 const ou=vise?(vise===a?'lui-même':vise.name):'la zone visée';
 if(vise&&o.etat&&typeof infligeEtat==='function')infligeEtat(vise,o.etat);
 log(nomNum(a)+' utilise '+o.name+' sur '+ou+(dit?' : '+dit:'.'),{ton:'talent'});
 if(typeof annonceFlottante==='function')annonceFlottante('◈ '+o.name+' → '+ou+(dit?' · '+dit:''));
 if(o.consumable)retirerInventaire(a,o);
 render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* L'inventaire d'une fiche : l'équipement d'abord — porté en clair, possédé en pâle —, les
   objets sur leur ligne. Un clic sur un carré d'équipement l'équipe ou le repose, pour le
   MJ ou le joueur qui tient l'aventurier ; le chevron déplie sa description. */
/* Un carré d'une fiche, avec sa bulle et son clic. La description se montre au survol ;
   en jeu, le clic sur un objet l'épingle — le temps d'aller y chercher « Utiliser » ;
   là où tout l'inventaire est offert, le clic équipe une arme, une armure, un bouclier —
   en remplaçant ce qu'il faut. « porte » : ce qui est déjà porté, pour la coche. */
/* Une arme à distance portée, munition en place : la place vide de son dé prend le dé de la
   munition — ce que le tir lancera vraiment. */
function remplitMunition(p,a,o){if(!p||!a||!a.munitionId||!o||o.category!=='weapon'||o.ranged!==true)return p;
 const mun=objetDe(a.munitionId),k=mun&&mun.category==='ammo'?keys.indexOf(mun.munDe):-1,place=p.querySelector('.die-munition');
 if(place&&k>=0){place.classList.remove('die-munition');place.classList.add('die-charge');place.style.setProperty('--face',dieFace(k));place.title=types[k]+' — '+mun.name}
 return p}
function carreDeFiche(a,o,n,tout,portes,peutEquiper,corps){const p=gearCarre(o,n,portes(o)),detail=gearDetail(o,a,!tout);
 if(portes(o))remplitMunition(p,a,o);
 const cle=cleGear(a,o),ouvert=gearOuvert===cle;detail.hidden=!ouvert||BULLES;
 const montre=()=>{gearOuvert=cle;talentOuvert=null;
  const d=gearDetail(o,a,!tout);d.hidden=false;d.classList.add('large');ouvrirBulle(p,d,'bulle-gear')};
 /* Après un rendu — on vient d'équiper — la bulle se repose d'elle-même sur la vignette
    refaite : le doigt n'a pas bougé, aucun survol ne se déclencherait. */
 if(BULLES&&ouvert)requestAnimationFrame(()=>{if(bulleEl&&gearOuvert===cle&&ancreVisible(p))reposeBulle(montre)});
 if(BULLES)surveille(p,montre);
 const redessine=()=>{render();if(typeof renderHeroes==='function')renderHeroes()};
 // Une seule description à la fois : ouvrir celle d'un objet referme celle d'un talent.
 const ouvrir=()=>{gearOuvert=cle;talentOuvert=null};
 const basculer=()=>{gearOuvert=ouvert?null:cle;if(BULLES&&ouvert)fermerBulle();redessine()};
 const equipable=(o.category==='weapon'||o.category==='armor'||o.category==='ammo')&&tout&&peutEquiper;
 // Un objet d'un combattant en scène s'utilise d'un clic, pour son joueur ou le MJ ; une munition se porte.
 const utilisable=o.category!=='weapon'&&o.category!=='armor'&&o.category!=='ammo'&&peutEquiper&&actors.includes(a);
 const agir=e=>{e.stopPropagation();
  if(utilisable){fermerBulle();employerDepuisFiche(a,o);return}
  /* Au survol, la description se montre seule. En jeu, le clic l'épingle — le temps
     d'aller y chercher « Utiliser » ; ailleurs, il ne sert plus qu'à équiper. */
  if(!equipable){if(BULLES){if(!tout)basculeEpingle(p,montre)}else basculer();return}
  toggleEquip(a,o);ouvrir();
  redessine();scheduleSave()};
 p.onclick=agir;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();agir(e)}};
 /* Sur le corps de l'aventurier, la pièce se tire : du sac vers le corps pour l'équiper,
    du corps vers le sac pour la reposer. */
 if(corps!==undefined&&equipable){p.draggable=true;
  p.addEventListener('dragstart',e=>{gearGlisse={id:o.id,porte:!!corps};p.classList.add('tire');fermerBulle();
   try{e.dataTransfer.setData('text/plain',o.id);e.dataTransfer.effectAllowed='move'}catch(_){}
   const boite=p.closest('.corps-sac');if(boite)boite.classList.add('glisse-'+placeDe(o))});
  p.addEventListener('dragend',()=>{gearGlisse=null;p.classList.remove('tire');
   const boite=p.closest('.corps-sac');if(boite)boite.className='corps-sac'})}
 p.detailPlie=detail;return p}
let gearGlisse=null;
// L'emplacement où va une pièce : ses mains pour une arme ou un bouclier, le sien pour une armure.
function placeDe(o){return o.category==='ammo'?'munitions':o.category==='weapon'||emplacementDe(o)==='shield'?'main':emplacementDe(o)}
/* Équiper une pièce de plus, ou en reposer une : les deux moitiés du basculement, pour le
   glisser-déposer qui sait où il va. */
function equiperPiece(a,o){if(!a||!o)return false;const dans=(a.inventaire||[]).filter(x=>x===o.id).length;
 if(o.category==='ammo'){if(!dans||a.munitionId===o.id)return false;a.munitionId=o.id;syncEquipped(a);return true}
 if(o.category==='weapon'){if(gearCount(a,o.id)>=dans)return false;prendArme(a,o);return true}
 if(o.category!=='armor')return false;
 if(emplacementDe(o)==='shield'){if(a.shieldId===o.id)return false;prendBouclier(a,o);return true}
 const slot=emplacementDe(o);a.armures=armuresDe(a);
 if(a.armures.filter(x=>x===o.id).length>=dans)return false;
 libereEmplacement(a,slot,1);a.armures.push(o.id);return true}
/* Lâcher une pièce sur une main précise : elle y va, et chasse ce que cette main tenait. Une
   arme lâchée sur la main gauche y tient la seconde place ; un bouclier va toujours à gauche. */
function equiperDansMain(a,o,cote){if(!a||!o)return false;const dans=(a.inventaire||[]).filter(x=>x===o.id).length;
 if(o.category==='armor'&&emplacementDe(o)==='shield')return equiperPiece(a,o);
 if(o.category!=='weapon'||gearCount(a,o.id)>=dans)return false;
 if(weaponHands(o)===2)return equiperPiece(a,o);
 a.weapons??=[];
 if(a.weapons[0]&&weaponHands(objetDe(a.weapons[0]))===2)a.weapons=[];
 if(cote==='gauche'){a.shieldId='';if(a.weapons.length>1)a.weapons.pop();a.weapons=[...a.weapons,o.id]}
 else{if(a.weapons.length)a.weapons.shift();a.weapons=[o.id,...a.weapons];
  while(mainsPrises(a)>2){if(a.weapons.length>1)a.weapons.pop();else if(a.shieldId)a.shieldId='';else break}}
 return true}
function reposerPiece(a,o){if(!a||!o)return false;
 if(o.category==='ammo'){if(a.munitionId!==o.id)return false;a.munitionId='';syncEquipped(a);return true}
 if(o.category==='weapon'){const i=(a.weapons||[]).lastIndexOf(o.id);if(i<0)return false;a.weapons.splice(i,1);return true}
 if(o.category!=='armor')return false;
 if(emplacementDe(o)==='shield'){if(a.shieldId!==o.id)return false;a.shieldId='';return true}
 a.armures=armuresDe(a);const i=a.armures.lastIndexOf(o.id);if(i<0)return false;a.armures.splice(i,1);return true}
// Le corps, stylisé : un pâle bonhomme derrière les emplacements.
/* Derrière les emplacements, la silhouette d'aventurier peinte par le MJ (img/PERSO.png), en
   filigrane : elle situe les pièces sur le corps sans jamais gêner le geste. */
const SILHOUETTE='<img class="silhouette" src="'+imgUrl('PERSO.png')+'" alt="" aria-hidden="true" draggable="false">';
/* La page Aventuriers montre le corps de l'aventurier — tête, torse, dos, mains, anneaux,
   amulette, bottes — et ce qu'il y porte ; le sac, dessous, tient le reste. On glisse une
   pièce du sac sur le corps pour l'équiper à sa place, une pièce du corps sur le sac pour
   la reposer ; le clic fait de même. Une pièce sans place libre prend celle de la plus
   ancienne. */
function corpsEtSac(a){const out=document.createElement('div');out.className='corps-sac';
 const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);
 const possede=(a.inventaire&&a.inventaire.length)?a.inventaire:[...(a.weapons||[]),...armuresDe(a),a.shieldId].filter(Boolean);
 const comptes=new Map();possede.map(objetDe).filter(Boolean).forEach(o=>comptes.set(o,(comptes.get(o)||0)+1));
 const portes=o=>o.category==='weapon'?gearCount(a,o.id):o.category==='ammo'?(o.id===a.munitionId?1:0):o.id===a.shieldId?1:armuresDe(a).filter(x=>x===o.id).length;
 const corps=document.createElement('div');corps.className='corps';corps.innerHTML=SILHOUETTE;
 /* Les mains, vues de face : la main droite de l'aventurier est à gauche de l'image. Elle tient
    la première arme — la main de base. La gauche tient le bouclier, ou la seconde arme ; une
    arme à deux mains tient les deux. */
 const armes=(a.weapons||[]).map(objetDe).filter(Boolean),bouclier=a.shieldId?objetDe(a.shieldId):null;
 const droite=armes[0]||null,gauche=droite&&weaponHands(droite)===2?{deux:droite}:(bouclier||armes[1]||null);
 const anneaux=portesA(a,'anneau',catalog.items).map(objetDe).filter(Boolean);
 const seul=slot=>{const id=portesA(a,slot,catalog.items)[0];return id?objetDe(id):null};
 /* Sous la main droite, les munitions ; les trois anneaux se serrent à droite de la même rangée. */
 const munition=a.munitionId?objetDe(a.munitionId):null;
 const places=[['dos','Dos',seul('dos')],['tete','Tête',seul('tete')],['amulette','Amulette',seul('amulette')],
  ['main','Main droite',droite],['torse','Torse',seul('torse')],['main','Main gauche',gauche],
  ['munitions','Munitions',munition],['anneau','Anneau',anneaux[0]||null],['anneau','Anneau',anneaux[1]||null],['anneau','Anneau',anneaux[2]||null],['bottes','Bottes',seul('bottes')]];
 const groupeAnneaux=document.createElement('div');groupeAnneaux.className='anneaux-groupe';
 places.forEach(([cle,nom,o],k)=>{const pl=document.createElement('div');pl.className='place p-'+cle+(cle==='bottes'?' bottes':'');pl.dataset.place=cle;if(cle==='main')pl.dataset.main=k===3?'droite':'gauche';
  const l=document.createElement('span');l.className='nom-place';l.textContent=nom;pl.append(l);
  if(o&&o.deux){const p=remplitMunition(gearCarre(o.deux,1,1),a,o.deux);p.classList.add('deux-mains');p.removeAttribute('title');p.setAttribute('aria-label',o.deux.name+' — à deux mains');pl.append(p)}
  else if(o)pl.append(carreDeFiche(a,o,1,true,portes,peutEquiper,true));
  else{const v=document.createElement('span');v.className='vide';v.textContent='·';pl.append(v)}
  if(cle==='anneau'){groupeAnneaux.append(pl);if(!groupeAnneaux.isConnected)corps.append(groupeAnneaux)}else corps.append(pl)});
 out.append(corps);
 // Le sac : ce qui n'est pas porté, puis les objets.
 const sac=document.createElement('div');sac.className='sac gear-grille';
 const titre=document.createElement('span');titre.className='gear-rangee-titre';titre.textContent='Inventaire';sac.append(titre);
 let rien=true;
 [...comptes.entries()].forEach(([o,n])=>{const equipement=o.category==='weapon'||o.category==='armor'||o.category==='ammo';
  const reste=equipement?n-portes(o):n;if(reste<=0)return;rien=false;
  const p=carreDeFiche(a,o,reste,true,()=>0,peutEquiper,equipement?false:undefined);
  /* Au survol, une petite croix rouge retire un exemplaire de l'inventaire — après confirmation.
     Ce qui est porté ne bouge pas : on retire un exemplaire du sac. */
  if(peutEquiper){const x=document.createElement('button');x.type='button';x.className='retirer-sac';x.textContent='✕';
   x.title='Retirer '+o.name+' de l’inventaire';x.setAttribute('aria-label',x.title);x.draggable=false;
   x.onclick=async ev=>{ev.stopPropagation();ev.preventDefault();fermerBulle();
    const ok=typeof demander==='function'?await demander('Retirer « '+o.name+' » de l’inventaire de '+a.name+' ?'+(reste>1?' Un exemplaire sur '+reste+'.':''),'Retirer'):confirm('Retirer « '+o.name+' » ?');
    if(!ok)return;retirerInventaire(a,o);log(nomNum(a)+' se défait de '+o.name+'.',{local:true});
    render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))};
   x.onpointerdown=ev=>ev.stopPropagation();p.append(x)}
  sac.append(p)});
 if(rien){const v=document.createElement('span');v.className='muted';v.textContent='Rien dans le sac.';sac.append(v)}
 out.append(sac);
 /* Le dépôt : sur le corps, la pièce s'équipe à sa place ; sur le sac, elle se repose. */
 if(peutEquiper){const redessine=()=>{render();if(typeof renderHeroes==='function')renderHeroes();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))};
  const recoit=(el,fn)=>{el.addEventListener('dragover',e=>{if(!gearGlisse)return;e.preventDefault();el.classList.add('survol');try{e.dataTransfer.dropEffect='move'}catch(_){}});
   el.addEventListener('dragleave',()=>el.classList.remove('survol'));
   el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('survol');const g=gearGlisse;gearGlisse=null;if(!g)return;g.cible=e.target&&e.target.closest?e.target.closest('.place'):null;
    const o=objetDe(g.id);if(o&&fn(o,g))redessine()})};
  recoit(corps,(o,g)=>{if(g.porte)return false;
   // Lâchée sur une main, la pièce prend cette main-là ; ailleurs sur le corps, sa place d'usage.
   const main=g.cible&&g.cible.dataset&&g.cible.dataset.main;return main?equiperDansMain(a,o,main):equiperPiece(a,o)});
  recoit(sac,(o,g)=>g.porte&&reposerPiece(a,o))}
 bulleOrpheline();return out}
/* Les carrés d'une fiche. En jeu (« tout » faux), on ne voit que ce qui est porté, plus les
   objets, qui servent pendant la partie ; ailleurs — bestiaire — tout l'inventaire, pour
   composer ce qu'on emporte. Un clic équipe ou repose une arme, une armure, un bouclier ;
   sur un objet, il ouvre sa description et son bouton Utiliser. */
function gearPills(a,tout=true){const out=document.createElement('div');out.className='gear-grille';
 const possede=(a.inventaire&&a.inventaire.length)?a.inventaire:[...(a.weapons||[]),...armuresDe(a),a.shieldId].filter(Boolean);
 const comptes=new Map();possede.map(objetDe).filter(Boolean).forEach(o=>comptes.set(o,(comptes.get(o)||0)+1));
 const portes=o=>o.category==='weapon'?gearCount(a,o.id):o.id===a.shieldId?1:armuresDe(a).filter(x=>x===o.id).length;
 const tous=[...comptes.entries()];
 /* En jeu, le rangé reste rangé : on ne montre que ce qui est porté, plus les objets. Le
    bouton du bout déplie le reste du sac — c'est ainsi qu'on change d'arme en pleine
    partie, joueur comme MJ. Ailleurs, tout l'inventaire est là d'emblée. */
 const armurerie=tous.filter(([o])=>o.category==='weapon'||o.category==='armor');
 const equipement=armurerie.filter(([o])=>tout||portes(o));
 const objets=tous.filter(([o])=>o.category!=='weapon'&&o.category!=='armor');
 if(!equipement.length&&!objets.length){const v=document.createElement('span');v.className='muted';v.textContent='Aucun équipement';out.append(v);return out}
 const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);
 const PAR_LIGNE=6;
 const rangees=(liste,titre)=>{if(!liste.length)return;
  if(titre){const t=document.createElement('span');t.className='gear-rangee-titre';t.textContent=titre;out.append(t)}
  for(let k=0;k<liste.length;k+=PAR_LIGNE){const rangee=liste.slice(k,k+PAR_LIGNE),details=[];
   rangee.forEach(([o,n])=>{const p=carreDeFiche(a,o,n,tout,portes,peutEquiper);
    out.append(p);if(!BULLES)details.push(p.detailPlie)});
   details.forEach(d=>d&&out.append(d))}};
 rangees(equipement,'');rangees(objets,'Objets');bulleOrpheline();
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
/* Un bonus de caractéristique n'est pas un talent : un nœud d'arbre qu'on débloque en
   descendant, et rien de plus. Il vit dans le catalogue des talents — même rangement, même
   arbre — mais ne paraît jamais parmi eux : ni fiche, ni onglet, ni sélecteur. */
const estBonus=t=>!!t&&t.effet==='bonus';
// « compact » : sur une fiche, la vignette ne dit que le nom — la nature et le niveau
// encombraient une colonne étroite, et le dépliant les redit.
/* Les niveaux de talent ne se montrent plus : ni sur les vignettes, ni dans l'arbre, ni au
   formulaire. Ils restent enregistrés et câblés ; les rallumer, c'est passer ceci à vrai. */
const NIVEAUX_TALENTS=false;
function talentPill(t,compact){const [cle,court,nom]=talentType(t);
 const p=document.createElement('span');p.className='cat-pill t-'+cle;
 const logo=logoTalent(t);if(logo)p.append(logo);
 const n=document.createElement('span');n.className='nom';n.textContent=t.name;
 p.append(n);
 const socle=nomPrerequis(t,catalog.talents);
 if(!compact){const b=document.createElement('span');b.className='t-badge';b.textContent=court;b.title=nom;
  const niv=document.createElement('span');niv.className='tag';niv.textContent='Niv. '+(t.level||1);
  p.append(b);if(NIVEAUX_TALENTS)p.append(niv);
  // La spécialisation ne s'écrit pas sur la vignette : l'arbre la montre, le formulaire la règle.
  // Une amélioration dit sur quoi elle repose : on le lit sans ouvrir la fiche.
  if(socle){const s=document.createElement('span');s.className='tag prereq';s.textContent='↳ '+socle;
   s.title='Requiert : '+socle;p.append(s)}}
 const info=[talentFamily(t),nom,t.effects,t.notes,socle?'Requiert : '+socle:''].filter(Boolean).join(' · ');
 p.title=t.name+' — '+info;
 return p}
/* Ce que dit un talent, sous sa vignette : sa nature, la phrase que le moteur appliquera
   — réglages en gras — ou le texte libre de la fiche, les notes, et l'arbre (requiert,
   débloque). Pas de « appris par » : la vignette est sur la fiche de qui l'a appris. */
/* Les mots clés des descriptions. Le jeu en connaît : caractéristiques (à leurs couleurs de
   fiche), états (à leurs teintes), points et natures (en gras), formules de dés et bonus
   chiffrés (« 1d6+2 », « +3 »). Le MJ en ajoute dans l'onglet Talents ; « **ainsi** » force
   le gras. Le texte se découpe autour d'eux, sans jamais passer par du HTML. */
const TEINTE_ETAT_MOT={Feu:'#c2503a',Gel:'#2f8fae',Foudre:'#3a6fc2',Poison:'#5d8a2e','Saignée':'#b8352f',Onde:'#3577b8',Invisible:'#6a5fb0',Faille:'#a0408f'};
/* La couleur d'un mot clé du MJ : « Allié : vert », « Allié = #2f8a63 », ou rien — la
   couleur du thème. Un mot du jeu redéclaré prend la couleur qu'on lui donne. */
const COULEURS_MOTS={rouge:'#b8352f',orange:'#c2692a',or:'#9d7b1e',jaune:'#b39222',vert:'#2f7a4b',turquoise:'#2c8c85',bleu:'#3a6fc2',violet:'#7a5cb8',rose:'#b04a8a',brun:'#8a5a2b',gris:'#6e6a66',noir:'#2a2622'};
function lisMotCle(ligne){const s=String(ligne||'').trim();const m=s.match(/^(.+?)\s*[:=]\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|[a-zA-Zéè]+)\s*$/);
 if(m){const c=m[2].startsWith('#')?m[2]:COULEURS_MOTS[m[2].toLowerCase()];if(c)return {mot:m[1].trim(),couleur:c}}
 return {mot:s,couleur:''}}
let motsClesCache=null;
/* Le motif d'un mot clé : chaque mot prend son pluriel (« attaque » → « attaques », « feu » →
   « feux »), les mots se séparent de n'importe quel blanc ; « insensible », il se lit en
   majuscules comme en minuscules. Ceux du jeu gardent leurs graphies — « Vie » et non « la
   vie » —, ceux du MJ se lisent quelle que soit la casse. */
function motifMotCle(mot,insensible){const q=x=>x.replace(/[.*+?^${}()|[\]\\\/-]/g,'\\$&');
 return String(mot).trim().split(/\s+/).map(w=>{const c=[...w].map(ch=>{const lo=ch.toLowerCase(),up=ch.toUpperCase();
   return insensible&&lo!==up?'['+q(lo)+q(up)+']':q(ch)}).join('');
  return /[sxz]$/i.test(w)?c:c+'(?:[sxSX])?'}).join('\\s+')}
function motsCles(){const perso=(catalog&&catalog.motsCles)||[],cle=perso.join('\u0001');
 if(motsClesCache&&motsClesCache.cle===cle)return motsClesCache;
 const entrees=[],vus=new Set();
 const ajoute=(formes,couleur,insensible)=>formes.forEach(f=>{if(!f)return;const motif=motifMotCle(f,insensible);if(vus.has(motif))return;vus.add(motif);entrees.push({mot:f,motif,couleur,re:new RegExp('^(?:'+motif+')$','u')})});
 // Ceux du MJ qui ont une couleur passent d'abord : ils l'emportent sur ceux du jeu. Sans couleur, un mot du jeu garde la sienne.
 const lus=perso.map(lisMotCle).filter(x=>x.mot);lus.filter(x=>x.couleur).forEach(x=>ajoute([x.mot],x.couleur,true));
 const rgb=k=>typeof STAT_TINTS!=='undefined'&&STAT_TINTS[k]?'rgb('+STAT_TINTS[k]+')':'';
 ajoute(['PV max','PV'],rgb('pv'));ajoute(['DEF','Défense'],rgb('def'));ajoute(['Endurance','ENDU','Endu'],rgb('endu'));
 ajoute(['Vie','VIE'],rgb('vie'));ajoute(['Dégât','dégât','DÉGÂT'],rgb('dmg'));ajoute(['XP'],rgb('xp'));
 ETATS_JEU.forEach(x=>ajoute([x,x.toUpperCase()],TEINTE_ETAT_MOT[x]||'#a2691f'));
 ajoute(['Action','Mouvement','Réaction','Objet','Passif','Critique','Maîtrise','Amélioration'],'');
 lus.filter(x=>!x.couleur).forEach(x=>ajoute([x.mot],'var(--accent)',true));
 // Les expressions longues d'abord : « Attaque critique » avant « Attaque ».
 entrees.sort((x,y)=>y.mot.length-x.mot.length);
 const rx=new RegExp('\\*\\*([^*\\n]+)\\*\\*|(^|[^\\p{L}\\p{N}])(?:'+entrees.map(x=>'('+x.motif+')').join('|')+'|(\\d*d\\d+(?:\\s*[+−-]\\s*\\d+)?|[+−]\\d+))(?![\\p{L}\\p{N}])','gu');
 // La couleur d'un texte trouvé : celle de la première entrée qui le reconnaît.
 const couleur=texte=>{const x=entrees.find(x=>x.re.test(texte));return x?x.couleur:''};
 return motsClesCache={cle,entrees,rx,couleur}}
function texteEnrichi(el,texte){texte=String(texte||'');el.replaceChildren();const {rx,entrees}=motsCles();rx.lastIndex=0;let last=0,m;
 const gras=(mot,couleur)=>{const b=document.createElement('b');b.className='mot-cle';b.textContent=mot;if(couleur)b.style.color=couleur;el.append(b)};
 while((m=rx.exec(texte))){
  if(m[1]!==undefined){if(m.index>last)el.append(texte.slice(last,m.index));gras(m[1],'');last=rx.lastIndex;continue}
  const debut=m.index+m[2].length;if(debut>last)el.append(texte.slice(last,debut));
  // Le groupe qui a pris : une entrée (sa couleur), ou la formule de dés (en gras seul).
  let k=3;while(k<3+entrees.length&&m[k]===undefined)k++;
  gras(m[k]!==undefined?m[k]:m[3+entrees.length],k<3+entrees.length?entrees[k-3].couleur:'');last=rx.lastIndex}
 if(last<texte.length)el.append(texte.slice(last));return el}
function talentDetail(t,vif){const d=document.createElement('div');d.className='talent-detail t-'+talentType(t)[0];
 const ligne=(texte,html)=>{if(!texte)return null;const p=document.createElement('p');
  if(html)p.innerHTML=texte;else p.textContent=texte;d.append(p);return p};
 /* Ni nature, ni niveau, ni classe — la vignette les dit — ni la phrase du moteur : la
    bibliothèque des effets la garde. Ici, seul le texte que le MJ a écrit, et il se
    corrige là où on le lit, dans l'onglet Talents. */
 const effet=ligne(t.effects||'Effet à préciser.');if(effet&&t.effects)texteEnrichi(effet,t.effects);
 if(vif&&effet)champVif(effet,()=>t.effects||'',v=>{t.effects=String(v).trim().slice(0,600);talentCorrige()},'Corriger l’effet — ⌘ Entrée valide','zone');
 ligne(t.notes);
 const socle=nomPrerequis(t,catalog.talents),branches=talentsDependants(t,catalog.talents);
 if(socle)ligne('↳ Requiert : '+socle);
 return d}
/* La vignette et son dépliant, l'un sous l'autre, de la même largeur : le bloc prend la
   largeur de la vignette, et le dépliant s'y range sans l'élargir. Un clic ouvre, un
   autre referme. Le sélecteur n'en veut pas — sa ligne entière est déjà un bouton. */
/* Les dépliants ouverts survivent au rendu : corriger un talent redessine l'onglet, et
   le dépliant qu'on corrigeait doit rester ouvert. */
const talentsOuverts=new Set();
// Avec les bulles, une seule description à la fois : la fiche et le talent qu'on regarde.
let talentOuvert=null;
function talentCorrige(){renderCatalogPages();render();scheduleSave()}
/* « vif » : dans l'onglet Talents, le MJ corrige le nom, le type, le niveau et l'effet là
   où il les lit — comme sur une fiche d'aventurier. La mécanique du moteur et les
   réglages passent toujours par le crayon. */
function talentBloc(t,vif,compact){const bloc=document.createElement('span');bloc.className='talent-bloc';
 const pill=talentPill(t,compact);pill.classList.add('cliquable');
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';pill.append(chev);
 const detail=talentDetail(t,vif);
 const ouvert=talentsOuverts.has(t.id);detail.hidden=!ouvert;pill.classList.toggle('ouvert',ouvert);
 pill.onclick=e=>{e.stopPropagation();const o=detail.hidden;detail.hidden=!o;pill.classList.toggle('ouvert',o);
  if(o)talentsOuverts.add(t.id);else talentsOuverts.delete(t.id)};
 if(vif){champVif(pill.querySelector('.nom'),()=>t.name,v=>{const n=String(v).trim().slice(0,120);if(n){t.name=n;talentCorrige()}},'Renommer ce talent','texte');
  choixVif(pill.querySelector('.t-badge'),()=>t.type||'act',TALENT_TYPES.map(([k,,nom])=>[k,nom]),v=>{t.type=v;talentCorrige()},'Changer le type');
  const tagNiv=[...pill.querySelectorAll('.tag')].find(x=>x.textContent.startsWith('Niv.'));
  if(tagNiv)champVif(tagNiv,()=>t.level||1,v=>{t.level=num(v,1,20);talentCorrige()},'Changer le niveau (1 à 20)','texte')}
 bloc.append(pill,detail);return bloc}
/* Les talents d'une fiche : une grille de deux colonnes, dans l'ordre où ils sont appris —
   le premier à gauche, le deuxième à droite. Le dépliant d'un talent s'étale sous les deux
   vignettes de sa rangée : moins haut, et la rangée suivante ne se décale pas de travers. */
function talentPills(a){const out=document.createElement('div');out.className='talent-grille';
 // Un nœud de bonus n'est pas un talent : la fiche le porte dans ses chiffres, pas ici.
 const liste=(a.talents||[]).map(talent).filter(t=>t&&t.effet!=='bonus');
 if(!liste.length){const v=document.createElement('span');v.className='muted';v.textContent='Aucun talent';out.append(v);return out}
 /* Un talent appris dont le socle manque ne fait rien : il se taisait, et on le croyait à
    l'œuvre. Il porte désormais sa marque, et son dépliant dit ce qu'il attend. */
 const sansEffet=t=>typeof manqueTalent==='function'?manqueTalent(a.talents||[],t,catalog.talents):'';
 for(let i=0;i<liste.length;i+=2){const rangee=liste.slice(i,i+2),details=[];
  rangee.forEach(t=>{const pill=talentPill(t,true);pill.classList.add('cliquable');
   const manque=sansEffet(t);
   // Le chevron ne dépliait que l'ancien dépliant : sous la bulle, rien à déplier.
   if(!BULLES){const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';pill.append(chev)}
   const detail=talentDetail(t,false);detail.classList.add('large');
   if(manque){pill.classList.add('sans-effet');
    const m=document.createElement('span');m.className='t-sans-effet';m.textContent='⚠';
    m.title='Sans effet : « '+t.name+' » requiert « '+manque+' », que '+a.name+' n’a pas.';pill.append(m);
    pill.title+=' — sans effet : requiert '+manque;
    const dit=document.createElement('p');dit.className='sans-effet-dit';
    dit.textContent='⚠ Sans effet : requiert « '+manque+' », que '+a.name+' n’a pas appris.';detail.prepend(dit)}
   const cle=(a.id||'?')+'|'+t.id,ouvert=BULLES?talentOuvert===cle:talentsOuverts.has(t.id);
   detail.hidden=!ouvert||BULLES;pill.classList.toggle('ouvert',ouvert);
   const montre=()=>{talentOuvert=cle;gearOuvert=null;
    const d=detail.cloneNode(true);d.hidden=false;ouvrirBulle(pill,d,'bulle-talent')};
   if(BULLES&&ouvert)requestAnimationFrame(()=>{if(bulleEl&&talentOuvert===cle&&ancreVisible(pill))montre()});
   if(BULLES)surveille(pill,montre);
   pill.onclick=e=>{e.stopPropagation();
    if(BULLES)return;   // au survol, la description se montre seule
    const o=detail.hidden;detail.hidden=!o;pill.classList.toggle('ouvert',o);
    if(o)talentsOuverts.add(t.id);else talentsOuverts.delete(t.id)};
   out.append(pill);if(!BULLES)details.push(detail)});
  if(rangee.length===1){const vide=document.createElement('span');vide.className='vide';out.append(vide)}
  details.forEach(d=>out.append(d))}
 bulleOrpheline();return out}
const ARMORY_COLS=[['melee','Armes de mêlée'],['ranged','Armes à distance'],['armor','Armures'],['object','Objets']];
/* Une pièce de l'armurerie : le même carré qu'à la table et sur le corps de l'aventurier,
   teinté de sa rareté, son nom dessous, sa description en bulle au survol. Le clic ouvre
   le formulaire ; ✎ et ⧉ paraissent au survol. */
function armoryRow(a,i){const carte=document.createElement('div');carte.className='cat-carte';
 const p=gearCarre(a,1,0);p.classList.remove('dispo');const coche=p.querySelector('.marque-porte');if(coche)coche.remove();
 p.removeAttribute('title');p.setAttribute('aria-label','Modifier '+a.name);
 if(BULLES)surveille(p,()=>{const d=gearDetail(a,null,false);d.hidden=false;d.classList.add('large');ouvrirBulle(p,d,'bulle-gear')});
 p.onclick=()=>openItem(i);p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openItem(i)}};
 const nom=document.createElement('span');nom.className='nom-carte';nom.textContent=a.name;
 const outils=document.createElement('span');outils.className='cat-tools';
 const crayon=document.createElement('button');crayon.className='ico';crayon.textContent='✎';
 crayon.title='Modifier';crayon.setAttribute('aria-label','Modifier '+a.name);crayon.onclick=()=>openItem(i);
 // Dupliquer : une copie juste en dessous, à corriger — une variante d'arme se fait en un clic.
 const double=document.createElement('button');double.className='ico';double.textContent='⧉';
 double.title='Dupliquer';double.setAttribute('aria-label','Dupliquer '+a.name);
 double.onclick=()=>{const copie=structuredClone(a);copie.id=crypto.randomUUID();copie.name=a.name+' (copie)';
  catalog.items.splice(i+1,0,copie);renderCatalogPages();scheduleSave()};
 outils.append(crayon,double);carte.append(p,nom,outils);return carte}
function renderArmory(){renderBiblioObjets();const cols=$('armory-cols');if(!cols)return;cols.replaceChildren();
 const q=($('armory-search').value||'').trim().toLowerCase(),choisie=$('armory-cat').value;
 for(const [key,titre] of ARMORY_COLS){
  if(choisie&&choisie!==key)continue;
  const liste=catalog.items.map((a,i)=>[a,i]).filter(([a])=>itemColumn(a)===key
   &&(!q||a.name.toLowerCase().includes(q)));
  const bloc=document.createElement('div');bloc.className='cat-col armurerie-grille';
  const h=document.createElement('h3');h.textContent=titre;
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([a,i])=>bloc.append(armoryRow(a,i)));
  cols.append(bloc)}
 bulleOrpheline()}
// Quatre types d'adversaires, quatre colonnes : les Élites manquaient, et leurs
// modèles ne paraissaient donc nulle part.
const BEST_COLS=[['standard','Sbires'],['alpha','Élites'],['solitaire','Solitaires'],['boss','Boss']];
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
 /* L'état que l'attaque inflige se lit devant son nom, comme sur une arme : un jeton, ou
    un rond vide qui invite à en choisir un. Clic : le menu des états. Rien d'autre sur la
    ligne — nom, dés, et c'est tout. Portée, cibles et bonus gardent leur valeur enregistrée
    mais ne se règlent plus ici. */
 const etat=etatPastille(at.etat)||(()=>{const s=document.createElement('span');s.className='etat-inflige sans-jeton vide';
  s.textContent='+';s.title='Choisir l’état infligé';return s})();
 choixVif(etat,at.etat||'',CHOIX_ETAT,v=>{at.etat=v;poser()},'État infligé par l’attaque');
/* L'icône de l'attaque, devant son état : un jeton, ou un rond vide qui invite à en choisir
    un. Elle se retrouve sur le bouton d'action à la table et dans le journal. */
 const icone=document.createElement('span');icone.className='att-logo';
 const dessineIcone=()=>{icone.replaceChildren();
  const im=logoAttaque((at.logos||[])[0],'bouton');
  if(im)icone.append(im);else{icone.textContent='◇';icone.classList.add('vide')}
  icone.classList.toggle('vide',!im)};
 dessineIcone();
 choixVif(icone,(at.logos||[])[0]||'',[['','— aucune icône —'],...LOGOS_TOUS.map(l=>[l,nomLogo(l)])],
  v=>{at.logos=v?[v]:[];dessineIcone();poser()},'Icône de l’attaque');
 /* Comme une arme à l'armurerie : le logo à gauche du nom, puis, tout à droite, l'état
    infligé juste avant les dés de dégâts. */
 tete.append(icone,nom,etat,desVifs(at,poser));
 const retirer=document.createElement('button');retirer.className='ico danger';retirer.textContent='✕';
 retirer.title='Retirer cette attaque';retirer.setAttribute('aria-label','Retirer l’attaque '+(at.name||''));
 retirer.onclick=e=>{e.stopPropagation();
  // Un adversaire peut se retrouver sans aucune attaque : on le laisse faire.
  m.attacks.splice(m.attacks.indexOf(at),1);poser()};
 if(view==='mj')tete.append(retirer);
 l.append(tete);return l}
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
 /* « Adversaire » ne dit rien de plus que la page : une famille par défaut, ou vide, ne
    prend pas de cartouche. Une vraie famille — Gobelins, Morts-vivants — le garde. */
 const vraieFamille=f=>!!f&&f!=='Adversaire';
 const famille=document.createElement('span');famille.className='chip';
 famille.textContent=m.family||'Sans famille';famille.hidden=!vraieFamille(m.family);
 champVif(famille,()=>m.family||'',v=>{m.family=String(v).trim().slice(0,60);
  famille.textContent=m.family||'Sans famille';famille.hidden=!vraieFamille(m.family);poserTexte()},'Modifier la famille','texte');
 const rangee=document.createElement('div');rangee.className='chips';
 // Le cartouche du type porte la couleur du type, comme la vignette de la liste.
 const chipType=Object.assign(document.createElement('span'),
  {className:'chip chip-type k-'+(m.type||'standard'),textContent:TYPE_NOMS[m.type]||'Standard'});
 rangee.append(famille,
  choixVif(chipType,m.type||'standard',
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
 const titreAtt=document.createElement('h5');titreAtt.textContent='Attaques spéciales';
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
  plus.textContent='+';plus.title='Inventaire de '+m.name;
  plus.setAttribute('aria-label','Inventaire de '+m.name);
  plus.onclick=e=>{e.stopPropagation();openPicker(m,'gear',()=>poserModele(m,f,true))};
  titreKit.append(plus)}
 /* Sans rien à porter, la rubrique disparaît tout entière : la fiche remonte d'autant. */
 const aDuKit=!!((m.inventaire||[]).length||(m.weapons||[]).length||armuresDe(m).length||m.shieldId);
 const kit=aDuKit?gearPills(m):document.createElement('span');
 if(!aDuKit){titreKit.hidden=true;kit.hidden=true}
 /* Un adversaire porte des talents comme un aventurier : sa fiche les montre, et le « + »
    ouvre la même liste que pour la troupe. */
 const titreTal=document.createElement('h5');titreTal.textContent='Talents';
 if(view==='mj'){const plus=document.createElement('button');plus.className='ico plus';
  plus.textContent='+';plus.title='Donner un talent à '+m.name;
  plus.setAttribute('aria-label','Donner un talent à '+m.name);
  plus.onclick=ev=>{ev.stopPropagation();openPicker(m,'talents',()=>poserModele(m,f,true))};
  titreTal.append(plus)}
 const tal=talentPills(m);
 f.append(tete,chiffres,titreAtt,listeAtt,titreKit,kit,titreTal,tal);
 return f}
function bestiaryRow(m,i){const rang=document.createElement('div');rang.className='cat-row';
 const pill=document.createElement('button');pill.className='cat-pill k-'+(m.type||'standard');
 const nom=document.createElement('span');nom.className='nom';nom.textContent=m.name;
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';
 pill.append(jetonRond(m.image,m.name,'mini'),nom,chev);
 // Corriger une valeur redessine la page : la languette ouverte doit le rester.
 const detail=document.createElement('div');detail.className='cat-detail k-'+(m.type||'standard');
 detail.hidden=!bestiaireOuverts.has(cleModele(m));
 pill.classList.toggle('ouvert',!detail.hidden);
 if(!detail.hidden)detail.append(monsterSheet(m));
 pill.onclick=()=>{const ouvrir=detail.hidden;
  if(ouvrir)bestiaireOuverts.add(cleModele(m));else bestiaireOuverts.delete(cleModele(m));
  detail.hidden=!ouvrir;pill.classList.toggle('ouvert',ouvrir);
  if(ouvrir&&!detail.querySelector('.best-fiche'))detail.prepend(monsterSheet(m))};
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(glyphe,titre,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=glyphe;
  b.title=titre;b.setAttribute('aria-label',titre+' '+m.name);b.onclick=fn;return b};
 /* La coche dit que la troupe a percé l'espèce. Le MJ la lève d'un clic : les créatures
    de ce modèle redeviennent des inconnues sur tous les écrans. */
 /* Elle se pose dans la vignette, juste à droite du nom : la vignette ne change pas de taille. */
 if(view==='mj'&&modeleAnalyse(m)){const coche=document.createElement('span');coche.className='coche-modele';coche.textContent='✓';
  coche.setAttribute('role','button');coche.tabIndex=0;coche.title='Analysé par la troupe — cliquer pour le lui reprendre';coche.setAttribute('aria-label',coche.title+' '+m.name);
  const lever=e=>{e.stopPropagation();e.preventDefault();const n=oublierAnalyse(m);if(!n)return;
   log(m.name+' n’est plus analysé'+(n>1?' ('+n+' créatures)':'')+'.');
   renderCatalogPages();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))};
  coche.onclick=lever;coche.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')lever(e)};nom.after(coche)}
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
 /* Les classes du jeu d'abord, dans l'ordre alphabétique — chacune a sa colonne même
    vide — puis les Génériques, puis les familles d'adversaires. */
 const classes=[...new Set((catalog.classes||[]).map(c=>c&&c.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const autres=[...new Set((catalog.talents||[]).map(talentFamily))]
  .filter(f=>f!==GENERIQUES&&!classes.includes(f)).sort((a,b)=>a.localeCompare(b,'fr'));
 return [...classes,GENERIQUES,...autres]}
// L'encre d'une classe, pour un intitulé de colonne ou une languette.
function teinteClasse(nom){const c=classeDe(catalog.classes,nom);return c&&c.tint||''}
function talentRow(t,i){const rang=document.createElement('div');rang.className='cat-row';
 // Le même dépliant qu'ailleurs, sous la vignette — corrigeable ici — les outils à droite.
 const bloc=talentBloc(t,view==='mj'),pill=bloc.querySelector('.cat-pill');
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
 const entree=document.createElement('div');entree.className='cat-entry';
 rang.append(bloc,outils);entree.append(rang);return entree}
/* Ce que le moteur sait appliquer, tel qu'il le déclare : le nom de la mécanique, ce
   qu'elle fait, et les réglages qu'elle attend avec leurs bornes. Rien n'est écrit ici en
   double — tout vient de la déclaration, donc la liste ne peut pas mentir. */
/* La banque des effets d'équipement : une ligne par effet, sa phrase telle que le moteur
   l'écrira, et la coche verte des effets déjà portés par un objet du catalogue. */
function renderBiblioObjets(){const boite=$('biblio-objets');if(!boite)return;
 const codes=Object.values(OBJETS_CODES);
 const compte=$('biblio-objets-compte');if(compte)compte.textContent=codes.length;
 boite.replaceChildren();
 codes.forEach(c=>{const bloc=document.createElement('div');bloc.className='effet-fiche';
  const porteurs=(catalog.items||[]).filter(o=>o&&o.effet===c.cle).map(o=>o.name);
  const coche=document.createElement('span');coche.className='utilise';
  if(porteurs.length){coche.textContent='✅';coche.title='Utilisé par : '+porteurs.join(', ')}
  bloc.append(coche);
  const nom=document.createElement('span');nom.className='nom';nom.textContent=c.nom+' : ';
  const dit=document.createElement('span');dit.className='dit';dit.innerHTML=c.phrase(paramsObjet({effet:c.cle,params:{}}));
  bloc.append(nom,dit);
  // Les manières d'en user, rappelées une fois : elles valent pour tous les effets.
  boite.append(bloc)});
 const note=document.createElement('p');note.className='muted';
 note.textContent='Chaque objet dit ensuite comment on s’en sert : '+USAGES_OBJET.map(([,n])=>n.toLowerCase()).join(', ')+'.';
 boite.append(note)}
function renderBiblioEffets(){const boite=$('biblio-effets');if(!boite)return;
 /* Rangés par type — Action, Réaction, Passif, Critique, Maîtrise, Amélioration — puis
    par nom : on lit la bibliothèque comme on lit un arbre de talents. */
 // Le bonus de caractéristique n'est pas une mécanique de talent : il a son propre éditeur.
 const codes=Object.values(TALENTS_CODES).filter(c=>c.cle!=='bonus').map(c=>{
  const k=TALENT_TYPES.findIndex(t=>t[0]===(c.type||'act'));
  return [c,k<0?TALENT_TYPES.length:k]})
  .sort((u,v)=>u[1]-v[1]||String(u[0].nom).localeCompare(String(v[0].nom),'fr'))
  .map(([c])=>c);
 const compte=$('biblio-compte');
 if(compte)compte.textContent=codes.length;
 boite.replaceChildren();
 /* Une ligne par effet : son nom, puis la phrase que le moteur appliquera, réglages en
    gras. La phrase vient du moteur lui-même, jamais recopiée ici. */
 codes.forEach(c=>{const bloc=document.createElement('div');bloc.className='effet-fiche';
  /* Une coche verte devant l'effet déjà porté par au moins un talent du catalogue : on voit
     d'un coup d'œil ce qui reste à câbler. Les talents porteurs se lisent au survol. */
  const porteurs=(catalog.talents||[]).filter(t=>t&&t.effet===c.cle).map(t=>t.name);
  const coche=document.createElement('span');coche.className='utilise';
  if(porteurs.length){coche.textContent='✅';coche.title='Utilisé par : '+porteurs.join(', ')}
  bloc.append(coche);
  // Le type en tête, comme sur une languette de talent : on voit la famille avant le nom.
  const type=document.createElement('span');type.className='tag type-effet';
  type.textContent=talentType(c)[1];bloc.append(type);
  const nom=document.createElement('span');nom.className='nom-effet';
  // Un talent de monstre porte sa marque : on ne le cherche pas parmi ceux de la troupe.
  nom.textContent=(c.monstre?'👹 ':'')+c.nom+' : ';
  const dit=document.createElement('span');dit.innerHTML=phraseTalent(c.cle);
  bloc.append(nom,dit);
  // Une amélioration nomme la mécanique qu'elle exige : on sait où la ranger.
  if(c.requiert&&TALENTS_CODES[c.requiert]){const r=document.createElement('span');r.className='prereq';
   r.textContent='↳ requiert '+TALENTS_CODES[c.requiert].nom;bloc.append(r)}
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
  const liste=(catalog.talents||[]).map((t,i)=>[t,i]).filter(([t])=>!estBonus(t)&&talentFamily(t)===famille
   &&(!q||t.name.toLowerCase().includes(q)||(t.effects||'').toLowerCase().includes(q)));
  liste.sort((a,b)=>tri==='nom'?a[0].name.localeCompare(b[0].name,'fr')
   :tri==='niveau-'?(b[0].level||1)-(a[0].level||1)||a[0].name.localeCompare(b[0].name,'fr')
   :(a[0].level||1)-(b[0].level||1)||a[0].name.localeCompare(b[0].name,'fr'));
  const bloc=document.createElement('div');bloc.className='cat-col'+(famille===GENERIQUES?' c-generique':'');
  const h=document.createElement('h3');h.textContent=famille;
  // Seule l'encre distingue une classe : les bandeaux restent sans fond, comme partout.
  const encre=teinteClasse(famille);if(encre)h.style.color=encre;
  /* Le même rouage que sur une fiche, à côté du nom de la classe : l'arbre s'ouvre là où
     l'on range ses talents, sans passer par un aventurier. */
  if(view==='mj'){const rouage=document.createElement('button');rouage.type='button';rouage.className='ico plus rouage';
   rouage.textContent='⚙';rouage.title='Arbre de talents — '+famille;
   rouage.setAttribute('aria-label','Ouvrir l’arbre de talents de '+famille);
   rouage.onclick=e=>{e.stopPropagation();openArbresClasse(famille)};h.append(rouage);
   // Le nom de la classe ouvre le même arbre : on clique où l'on regarde.
   h.classList.add('cliquable');h.title='Ouvrir l’arbre de talents de '+famille;
   h.onclick=()=>openArbresClasse(famille)}
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  /* Une amélioration se range sous son prérequis, en retrait : la colonne se lit comme
     l'arbre qu'elle est. Un prérequis d'une autre classe laisse le talent à la racine. */
  const place=new Map(liste.map(([t,i])=>[t.id,i]));
  ordonneTalents(liste.map(([t])=>t),catalog.talents).forEach(([t,prof])=>{
   const rang=talentRow(t,place.get(t.id));if(prof)rang.classList.add('sous-talent');bloc.append(rang)});
  cols.append(bloc)}
}
$('talent-search').oninput=renderTalents;$('talent-family').onchange=renderTalents;
$('talent-sort').onchange=renderTalents;
$('talent-add').onclick=()=>openTalent(null);
const motsDialog=dialog('mots-cles','Mots clés des talents','<form id="mots-form"><p class="muted">Dans les descriptions de talents, le jeu met déjà en valeur les caractéristiques (PV, DEF, Endurance, Vie, Dégâts), les états (Feu, Gel, Poison…), les points et natures (Action, Mouvement, Réaction, Passif…), les formules de dés et les bonus chiffrés. Ajoute ici les tiens, un par ligne, et donne-leur une couleur après deux-points : <b>Allié : vert</b>, ou un code : <b>Allié : #2f8a63</b>. Sans couleur, celle du thème. Un mot du jeu redéclaré avec une couleur prend la tienne (<b>Feu : orange</b>). Dans un texte, <b>**ainsi**</b> force le gras.</p><p class="palette-mots" id="palette-mots"></p>'
 +'<label>Tes mots clés<textarea name="mots" rows="8" maxlength="6000" placeholder="Allié : vert\nAdversaire : rouge\nau contact"></textarea></label><p class="muted" id="mots-apercu"></p><div class="form-actions"><button class="primary">Enregistrer</button></div></form>');
function apercuMots(){const t=$('mots-form').elements.mots.value.split('\n').map(x=>x.trim()).filter(Boolean);
 const ex='Inflige +2 Dégâts et Feu à un Allié au contact : 1d6+ENDU PV, une Action.'+(t.length?' — '+t.map(l=>lisMotCle(l).mot).filter(Boolean).slice(0,6).join(', '):'');const p=$('mots-apercu');const ancien=catalog.motsCles;catalog.motsCles=t;
 p.replaceChildren('Aperçu : ');const s=document.createElement('span');texteEnrichi(s,ex);p.append(s);catalog.motsCles=ancien}
// La palette : un clic sur une couleur l'ajoute à la ligne où se trouve le curseur.
{const pal=$('palette-mots');Object.entries(COULEURS_MOTS).forEach(([nom,c])=>{const b=document.createElement('button');b.type='button';b.className='pastille-mot';b.textContent=nom;b.style.color=c;b.style.borderColor=c;
 b.onclick=()=>{const ta=$('mots-form').elements.mots,v=ta.value,pos=ta.selectionStart??v.length,debut=v.lastIndexOf('\n',pos-1)+1,finL=v.indexOf('\n',pos),fin=finL<0?v.length:finL;
  const ligne=v.slice(debut,fin).replace(/\s*[:=]\s*\S+\s*$/,'').trim();if(!ligne)return;ta.value=v.slice(0,debut)+ligne+' : '+nom+v.slice(fin);apercuMots();ta.focus()};pal.append(b)})}
$('talent-mots').onclick=()=>{if(view!=='mj')return;$('mots-form').elements.mots.value=(catalog.motsCles||[]).join('\n');apercuMots();motsDialog.showModal()};
$('mots-form').elements.mots.oninput=apercuMots;
$('mots-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 catalog.motsCles=[...new Set($('mots-form').elements.mots.value.split('\n').map(x=>x.trim().slice(0,60)).filter(Boolean))].slice(0,200);
 motsDialog.close();renderCatalogPages();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))};
const talentDialog=dialog('talent-editor','Talent','<form id="talent-form"><div id="talent-fields"></div><div class="form-actions"><button type="button" id="delete-talent">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
let talentIndex=null,talentApres=null,talentDraft={effet:'',params:{}};
/* Fermé sans enregistrer, le dialogue ne doit rien rappeler : sinon une création faite
   plus tard depuis l'armurerie irait se cocher dans une fiche déjà refermée. */
talentDialog.addEventListener('close',()=>{talentApres=null;
 // L'arbre ouvert dessous se redessine : un talent créé, corrigé ou supprimé y paraît.
 if(typeof arbresDialog!=='undefined'&&arbresDialog.open)renderArbres()});
/* Les réglages d'un effet sont dessinés d'après sa déclaration : ajouter un effet au
   moteur suffit à lui donner son formulaire, sans toucher à celui-ci. */
function lireReglagesTalent(){const f=$('talent-form').elements,out={};
 for(const el of f)if(el.name&&el.name.startsWith('p_'))out[el.name.slice(2)]=el.value;
 return out}
function dessineReglagesTalent(){const boite=$('talent-reglages');if(!boite)return;
 const code=TALENTS_CODES[$('talent-form').elements.effet.value]||null;
 if(!code){boite.replaceChildren();return}
 const vals=paramsTalent({effet:code.cle,params:talentDraft.params});
 /* Une mécanique qui en exige une autre le dit ici, sous le menu : le talent ne pourra
    s'apprendre qu'au-dessus d'un talent portant celle-là. */
 const exige=code.requiert&&TALENTS_CODES[code.requiert]
  ?'<p class="muted exige">↳ Amélioration : ne s’apprend qu’au-dessus d’un talent portant la mécanique « '+esc(TALENTS_CODES[code.requiert].nom)+' ».</p>':'';
 boite.innerHTML=exige+'<div class="edit-grid">'
  +(code.params||[]).map(p=>p.type==='nombre'
   ?field(p.nom,'p_'+p.cle,vals[p.cle],'number','min="'+p.min+'" max="'+p.max+'"')
   // Un modèle du bestiaire : le menu se remplit des adversaires créés.
   :p.type==='modele'?sel(p.nom,'p_'+p.cle,vals[p.cle],[['','— choisir un adversaire —'],...(catalog.monsters||[]).map(m=>[m.id,m.name])])
   :sel(p.nom,'p_'+p.cle,vals[p.cle],p.options)).join('')+'</div>'}
// Le nom d'un modèle du bestiaire, pour les phrases du moteur qui ne le connaissent pas.
function nomModele(id){const m=(catalog.monsters||[]).find(x=>x&&x.id===id);return m?m.name:''}
/* Vrai si x repose, de près ou de loin, sur t : par la fiche ou par la mécanique. */
/* Le garde-fou marque les ancêtres parcourus — t — et non le candidat x : marquer x coupait la
   descente au premier étage, et un cycle à trois talents passait. */
function descendDe(x,t,vus=new Set()){if(!x||!t||vus.has(t.id))return false;vus.add(t.id);
 return talentsDependants(t,catalog.talents).some(d=>d.id===x.id||descendDe(x,d,vus))}
/* « defauts » : ce que l'arbre sait déjà d'un talent qu'on y crée — sa classe, sa voie, le
   talent dont il pendra, sa nature — pour ne pas le redire au formulaire. */
function openTalent(i=null,apres=null,defauts=null){if(view!=='mj')return;talentIndex=i;talentApres=apres;
 const t=i===null?{name:'Nouveau talent',famille:GENERIQUES,type:'act',level:1,effect:'',effets:'',effects:'',notes:'',effet:'',params:{},...(defauts||{})}:catalog.talents[i];
 if(i!==null&&!t)return;
 talentDraft={effet:t.effet||'',params:{...(t.params||{})}};
 /* Les classes offertes : celles du jeu, celles déjà portées par un talent, et celles que
    la troupe s'est données. La classe du talent ouvert y figure toujours, fût-elle inédite. */
 const familles=[...new Set([GENERIQUES,...talentFamilies(),
  ...actors.filter(a=>a.hero).map(a=>(a.role||'').split('·')[0].trim()).filter(Boolean),
  talentFamily(t)])];
 const famille=talentFamily(t);
 /* Talent ou bonus de caractéristique : deux natures, un seul dialogue. Le bonus n'a ni nom,
    ni type, ni logo, ni mécanique à choisir — une caractéristique, une valeur, sa place dans
    l'arbre. Les champs qui ne le concernent pas se retirent quand on le choisit. */
 const bonus=estBonus(t),pb=paramsTalent({effet:'bonus',params:t.params||{}}),optBonus=cle=>(TALENTS_CODES.bonus.params.find(p=>p.cle===cle)||{}).options||[];
 $('talent-fields').innerHTML='<div class="nature-choix" role="radiogroup" aria-label="Nature">'
  +'<label><input type="radio" name="nature" value="talent"'+(bonus?'':' checked')+'> Talent</label>'
  +'<label><input type="radio" name="nature" value="bonus"'+(bonus?' checked':'')+'> Bonus de caractéristique</label></div>'
  +'<div class="edit-grid quatre">'
  +field('Nom','name',t.name,'text','required maxlength="120"')
  /* Un vrai menu, et non plus une liste de suggestions : un datalist ne propose que ce
     qui ressemble à ce qui est déjà écrit, et le champ arrivant rempli de « Génériques »,
     il n'offrait que « Génériques ». Une classe inédite reste possible, par la dernière
     entrée du menu, qui ouvre un champ libre. */
  +sel('Classe','famille',famille,[...familles.map(f=>[f,f]),[AUTRE_CLASSE,'✎ Autre classe…']])
  /* La spécialisation : une des voies de la classe — trois au plus — ou le tronc commun.
     Une voie inédite se nomme dans un champ libre, comme une classe. */
  +sel('Spécialisation','voie',t.voie||'',optionsVoie(famille,t.voie||''))
  /* Sa place dans l'arbre : sur l'épine, ou en diagonale sous son prérequis — à gauche ou à
     droite —, d'où un chemin redescend vers le central suivant. */
  +sel('Place dans l’arbre','branche',t.branche||'',[['','Sur l’épine — talent central'],['g','Diagonale gauche, sous le prérequis'],['d','Diagonale droite, sous le prérequis']])
  +sel('Type','type',t.type||'act',TALENT_TYPES.map(([k,,nom])=>[k,nom]))
  +(NIVEAUX_TALENTS?field('Niveau','level',t.level||1,'number','min="1" max="20"'):'<input type="hidden" name="level" value="'+(Number(t.level)||1)+'">')
  +sel('Logo','logo',t.logo||'',[['','— aucun —'],...LOGOS_TALENT.map(l=>[l,nomLogo(l)])])
  /* Où le bouton du talent se tient à la table : avec les attaques, en grand ; sur la
     ligne des réactions, dessous ; ou nulle part — un passif se lit sur la fiche. */
  +sel('Rangée à la table','rangee',t.rangee||'',[['','Selon le type'],['attaques','Attaques — grand bouton à deux lignes'],
   ['reactions','Réactions — la ligne dessous'],['aucune','Aucune — passifs et améliorations, sur la fiche seulement']])+'</div>'
  +'<div id="famille-autre" hidden><label>Nom de la nouvelle classe<input name="familleLibre" maxlength="60" value=""></label></div>'
  +'<div id="voie-autre" hidden><label>Nom de la nouvelle spécialisation<input name="voieLibre" maxlength="60" value=""></label></div>'
  /* Le prérequis : un autre talent du catalogue, qu'il faudra posséder d'abord. Ni
     lui-même, ni ce qui repose déjà sur lui — sans quoi l'arbre se mordrait la queue. */
  +sel('Prérequis — talent à posséder d’abord','prerequis',t.prerequis||'',[['','— aucun —'],
   ...(catalog.talents||[]).filter(x=>x&&x.id!==t.id&&!descendDe(x,t)).map(x=>[x.id,talentFamily(x)+' · '+x.name+(NIVEAUX_TALENTS?' (niv. '+(x.level||1)+')':'')])])
  +'<div class="t-seul"><label>Effet<textarea name="effects" rows="3" maxlength="600">'+esc(t.effects||'')+'</textarea></label>'
  /* Le texte ci-dessus se lit à la table ; celui-ci agit. On choisit l'effet dans la liste
     de ce que le moteur sait faire, puis on en règle les valeurs — plus besoin que le nom
     du talent tombe juste. */
  +'<h2 class="sous-titre">Effet appliqué par le moteur</h2>'
  +sel('Mécanique','effet',bonus?'':(t.effet||''),[['','— Aucun : talent descriptif —'],
   ...Object.values(TALENTS_CODES).filter(c=>c.cle!=='bonus').map(c=>[c.cle,libelleTalent(c.cle)])])
  +'<div id="talent-reglages"></div></div>'
  // Le bonus : une caractéristique, une valeur — et la compétence, si c'est là qu'il va.
  +'<div class="b-seul"><h2 class="sous-titre">Le bonus</h2><div class="edit-grid">'
  +sel('Caractéristique','b_carac',pb.carac,optBonus('carac'))
  +field('Valeur','b_valeur',pb.valeur,'number','min="1" max="20"')
  +sel('Compétence','b_comp',pb.comp,optBonus('comp'))+'</div>'
  +'<p class="muted" id="bonus-apercu"></p></div>';
 /* Ce qui n'est que talent — nom, type, logo, rangée, effet, mécanique — se retire en mode
    bonus, et ce qui n'est que bonus se retire en mode talent : retiré, et non caché, pour
    qu'un champ requis absent ne bloque pas l'enregistrement. */
 const champs=$('talent-form').elements;
 ['name','type','logo','rangee'].forEach(n=>{const l=champs[n]&&champs[n].closest('label');if(l)l.classList.add('t-seul')});
 const apercuBonus=()=>{const comp=champs.b_carac.value==='comp';const lc=champs.b_comp.closest('label');if(lc)lc.classList.toggle('talent-cache',!comp);
  $('bonus-apercu').textContent='Dans l’arbre : '+libelleBonus({carac:champs.b_carac.value,valeur:num(champs.b_valeur.value,1,20),comp:champs.b_comp.value})};
 const poseNature=()=>{const b=champs.nature.value==='bonus';
  $('talent-fields').querySelectorAll('.t-seul').forEach(el=>{el.classList.toggle('talent-cache',b);el.querySelectorAll('input,select,textarea').forEach(c=>c.disabled=b)});
  $('talent-fields').querySelectorAll('.b-seul').forEach(el=>{el.classList.toggle('talent-cache',!b);el.querySelectorAll('input,select,textarea').forEach(c=>c.disabled=!b)});
  talentDialog.querySelector('.dialog-head h2').textContent=b?'Bonus de caractéristique':'Talent';apercuBonus()};
 [...champs.nature].forEach(r=>r.onchange=poseNature);champs.b_carac.onchange=apercuBonus;champs.b_valeur.oninput=apercuBonus;champs.b_comp.onchange=apercuBonus;
 poseNature();
 /* « Autre classe… » ouvre le champ libre et lui donne la main ; revenir sur une classe
    connue le referme, et ce qui y était tapé ne compte plus. */
 const fam=$('talent-form').elements.famille,voie=$('talent-form').elements.voie;
 /* Les voies offertes suivent la classe choisie : changer de classe rebâtit le menu, et
    garde la voie si la nouvelle classe la connaît. */
 const majVoies=()=>{const avant=voie.value;voie.replaceChildren();
  optionsVoie(fam.value===AUTRE_CLASSE?'':fam.value,t.voie||'').forEach(([v,l])=>voie.add(new Option(l,v)));
  voie.value=[...voie.options].some(o=>o.value===avant)?avant:'';$('voie-autre').hidden=voie.value!==AUTRE_VOIE};
 fam.onchange=()=>{const autre=fam.value===AUTRE_CLASSE;$('famille-autre').hidden=!autre;
  if(autre){const champ=$('talent-form').elements.familleLibre;champ.value='';champ.focus()}
  majVoies()};
 voie.onchange=()=>{const autre=voie.value===AUTRE_VOIE;$('voie-autre').hidden=!autre;
  if(autre){const champ=$('talent-form').elements.voieLibre;champ.value='';champ.focus()}};
 const menu=$('talent-form').elements.effet;
 menu.onchange=()=>{talentDraft.params=lireReglagesTalent();talentDraft.effet=menu.value;dessineReglagesTalent()};
 // L'aperçu du logo, à côté de son menu, comme pour un objet.
 const menuLogo=$('talent-form').elements.logo;
 const apercu=document.createElement('img');apercu.className='logo-equip apercu';apercu.alt='';
 const montre=()=>{const l=menuLogo.value;apercu.hidden=!l;if(l)apercu.src=imgUrl(l+'.png')};
 menuLogo.parentNode.append(apercu);montre();menuLogo.onchange=montre;
 dessineReglagesTalent();
 $('delete-talent').hidden=i===null;talentDialog.showModal()}
$('talent-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 const f=$('talent-form').elements;
 const t=talentIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.talents[talentIndex]);
 t.name=f.name.value.trim()||'Talent';
 t.famille=(f.famille.value===AUTRE_CLASSE?f.familleLibre.value:f.famille.value).trim()||GENERIQUES;
 /* Trois voies par classe, pas une de plus : une quatrième est refusée en le disant, et le
    formulaire reste ouvert pour en choisir une autre. */
 const voie=(f.voie.value===AUTRE_VOIE?f.voieLibre.value:f.voie.value).trim().slice(0,60);
 const connues=voiesDe(t.famille);
 if(voie&&!connues.includes(voie)&&connues.length>=VOIES_MAX){alert('« '+t.famille+' » a déjà ses '+VOIES_MAX+' spécialisations : '+connues.join(', ')+'.');return}
 t.voie=voie;if(voie)enregistreVoie(t.famille,voie);
 t.type=f.type.value;t.level=num(f.level.value,1,20);
 t.effects=f.effects.value.trim();if(f.notes)t.notes=f.notes.value.trim();
 t.prerequis=f.prerequis&&f.prerequis.value&&f.prerequis.value!==t.id&&(catalog.talents||[]).some(x=>x&&x.id===f.prerequis.value)?f.prerequis.value:'';
 t.branche=f.branche&&(f.branche.value==='g'||f.branche.value==='d')?f.branche.value:'';
 t.logo=f.logo&&LOGOS_TALENT.includes(f.logo.value)?f.logo.value:'';
 t.rangee=f.rangee&&['attaques','reactions','aucune'].includes(f.rangee.value)?f.rangee.value:'';
 // L'effet et ses réglages, relus au travers de leur déclaration : rien d'illisible n'entre.
 t.effet=TALENTS_CODES[f.effet.value]&&f.effet.value!=='bonus'?f.effet.value:'';
 t.params=t.effet?paramsTalent({effet:t.effet,params:lireReglagesTalent()}):{};
 /* Un bonus de caractéristique : sa caractéristique et sa valeur font tout — le nom s'écrit
    seul, la nature est passive, rien à la table, pas de logo. */
 if(f.nature&&f.nature.value==='bonus'){t.params=paramsTalent({effet:'bonus',params:{carac:f.b_carac.value,valeur:f.b_valeur.value,comp:f.b_comp.value}});
  t.effet='bonus';t.name=libelleBonus(t.params);t.type='pass';t.rangee='aucune';t.logo='';t.effects=''}
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
/* L'inventaire est tout ce que le combattant possède ; l'équipement, ce qu'il porte, en
   fait toujours partie : ce qui est porté sans être possédé entre dans l'inventaire. */
function completerInventaire(a){if(!a)return;a.inventaire??=[];
 const besoin=new Map();[...(a.weapons||[]),...armuresDe(a),a.shieldId].filter(Boolean).forEach(id=>besoin.set(id,(besoin.get(id)||0)+1));
 besoin.forEach((n,id)=>{const ont=a.inventaire.filter(x=>x===id).length;for(let k=ont;k<n;k++)a.inventaire.push(id)})}
const objetDe=id=>(catalog.items||[]).find(o=>o&&o.id===id)||null;
function syncEquipped(a){if(!a||!Number.isFinite(a.max))return;
 if(a.hero)a.def=defenseOf(a,catalog.items);
 a.pool=poolFrom(chosenAttack(a,catalog.items).dice)||a.pool}
/* Combien d'exemplaires d'un objet un aventurier porte. La plupart des armes se
   tiennent à deux mains, et rien n'interdit d'en avoir deux du même modèle : leurs
   dés s'additionnent comme ceux de deux armes différentes. */
function gearCount(a,id){return (a&&a.weapons||[]).filter(x=>x===id).length}
/* Un clic fait le tour : rien, un exemplaire, deux, puis rien de nouveau. Les deux
   mains restent la limite — le second exemplaire prend la place d'une autre arme. */
/* Les mains : deux au plus. Une arme à une main en prend une, une arme à deux mains — ou
   à distance — les deux, un bouclier une. Une armure se porte seule, sans main. */
function mainsPrises(a){const armes=(a.weapons||[]).map(objetDe).filter(Boolean);
 return armes.reduce((s,w)=>s+weaponHands(w),0)+(a.shieldId?1:0)}
/* Faire la place qu'il faut : on repose, du plus ancien au plus récent, ce qui occupe les
   mains jusqu'à loger ce qu'on prend. C'est la règle de l'armure, étendue aux mains :
   cliquer une arme ou un bouclier remplace, jamais ne refuse. */
/* La main droite est la main de base : une arme qu'on prend y va, et prend la place de ce
   qu'elle tenait. Une arme à deux mains vide les deux. Un bouclier va à la main gauche, et
   en chasse la seconde arme. Rend le nombre de pièces reposées. */
function libereMains(a,besoin){a.weapons??=[];let n=0;
 while(mainsPrises(a)+besoin>2){
  if(a.weapons.length){a.weapons.shift();n++}
  else if(a.shieldId){a.shieldId='';n++}
  else break}
 return n}
function libereMainGauche(a){a.weapons??=[];
 while(mainsPrises(a)+1>2){
  if(a.weapons.length>1)a.weapons.pop();
  else if(a.weapons.length)a.weapons.shift();
  else break}}
// Prendre une arme en main : à droite si une place s'y libère, sinon à gauche, main droite occupée.
function prendArme(a,o){const retires=libereMains(a,weaponHands(o));
 a.weapons=retires>0||!(a.weapons||[]).length?[o.id,...(a.weapons||[])]:[...a.weapons,o.id]}
function prendBouclier(a,o){a.shieldId='';libereMainGauche(a);a.shieldId=o.id}
/* Équiper depuis l'inventaire, d'un clic sur le carré : une arme prend la place qu'il
   faut — un second clic prend un second exemplaire s'il est possédé et qu'une main reste,
   sinon repose tout ; un bouclier prend une main ; une armure se porte ou se repose. Ce
   qui n'est pas possédé ne se porte pas. Renvoie le souci, ou null. */
/* Faire de la place à un emplacement : la pièce la plus anciennement mise s'en va, autant
   de fois qu'il le faut pour que la nouvelle entre. */
function libereEmplacement(a,slot,besoin){if(!a)return;a.armures=armuresDe(a);
 while(placesLibres(a,slot,catalog.items)<besoin){
  const i=a.armures.findIndex(id=>emplacementDe(objetDe(id))===slot);
  if(i<0)break;a.armures.splice(i,1)}}
function toggleEquip(a,o){if(!a||!o)return 'Rien à équiper.';
 const dans=(a.inventaire||[]).filter(x=>x===o.id).length;
 if(!dans)return o.name+' n’est pas dans l’inventaire.';
 if(o.category==='weapon'){const n=gearCount(a,o.id);
  if(n>0&&n<dans&&mainsPrises(a)+weaponHands(o)<=2)a.weapons=[...(a.weapons||[]),o.id];
  else if(n>0)a.weapons=(a.weapons||[]).filter(x=>x!==o.id);
  else prendArme(a,o)}
 else if(o.category==='armor'&&emplacementDe(o)==='shield'){
  if(a.shieldId===o.id)a.shieldId='';
  else prendBouclier(a,o)}
 // Une munition se porte ou se repose ; une autre prend sa place.
 else if(o.category==='ammo')a.munitionId=a.munitionId===o.id?'':o.id;
 /* Une pièce d'équipement va à son emplacement, qui a ses places : trois anneaux, un
    torse, un dos… Plein, c'est la plus ancienne pièce qui cède la sienne, comme les mains. */
 else if(o.category==='armor'){const slot=emplacementDe(o);
  a.armures=armuresDe(a);
  const portes=a.armures.filter(x=>x===o.id).length;
  if(portes>0&&portes<dans&&placesLibres(a,slot,catalog.items)>0)a.armures=[...a.armures,o.id];
  else if(portes>0)a.armures=a.armures.filter(x=>x!==o.id);
  else{libereEmplacement(a,slot,1);a.armures=[...a.armures,o.id]}}
 else return 'Un objet ne s’équipe pas : il reste dans l’inventaire.';
 syncEquipped(a);return null}
/* Ajouter ou retirer un exemplaire à l'inventaire. Retirer le dernier exemplaire porté
   le repose d'abord. */
function ajouterInventaire(a,o){if(!a||!o)return;a.inventaire??=[];a.inventaire.push(o.id)}
function retirerInventaire(a,o){if(!a||!o)return;a.inventaire??=[];const i=a.inventaire.lastIndexOf(o.id);if(i<0)return;
 a.inventaire.splice(i,1);const reste=a.inventaire.filter(x=>x===o.id).length;
 if(o.category==='weapon'){while(gearCount(a,o.id)>reste){const k=(a.weapons||[]).lastIndexOf(o.id);a.weapons.splice(k,1)}}
 else if(o.category==='armor'){a.armures=armuresDe(a);
  while(a.armures.filter(x=>x===o.id).length>reste){const k=a.armures.lastIndexOf(o.id);a.armures.splice(k,1)}
  if(!reste&&a.shieldId===o.id)a.shieldId=''}
 else if(o.category==='ammo'&&!reste&&a.munitionId===o.id)a.munitionId='';
 syncEquipped(a)}
const pickerDialog=dialog('picker','Équiper','<p class="muted" id="picker-note"></p>'
 +'<input id="picker-search" placeholder="Rechercher…" aria-label="Rechercher">'
 +'<div id="picker-body"></div>');
let pickerActeur=null,pickerMode='gear',pickerApres=null;
function openPicker(a,mode,apres){if(view!=='mj')return;pickerActeur=a;pickerMode=mode;pickerApres=apres||null;
 pickerDialog.querySelector('h2').textContent=(mode==='gear'?'Inventaire de ':'Talents de ')+a.name;
 $('picker-note').textContent=mode==='gear'
  ?'Clique un objet pour l’ajouter à l’inventaire — encore une fois pour un second exemplaire — et « − » pour en retirer un. Ce qui est porté se choisit sur la fiche, en cliquant les carrés : deux mains au plus, une armure.'
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
   // Possédé en plusieurs exemplaires, l'inventaire le dit : « ×2 ».
   const n=pickerMode==='gear'?(a.inventaire||[]).filter(x=>x===o.id).length:0;
   const cle=rang.querySelector('.cat-pill.verrou');if(cle)rang.classList.add('verrou');
   etat.textContent=n>1?'×'+n:porte(o)?'✓':cle?'🔒':'+';rang.append(etat);
   if(pickerMode==='gear'&&n){const moins=document.createElement('span');moins.className='pick-moins';moins.textContent='−';moins.title='Retirer un exemplaire';
    moins.setAttribute('role','button');moins.onclick=e=>{e.stopPropagation();clic(o,true)};rang.append(moins)}
   rang.onclick=()=>clic(o);bloc.append(rang)});
  corps.append(bloc)};
 if(pickerMode==='gear'){
  const porte=o=>(a.inventaire||[]).includes(o.id);
  const clic=(o,retirer)=>{if(retirer)retirerInventaire(a,o);else ajouterInventaire(a,o);
   renderPicker();if(pickerApres)pickerApres();else{renderHeroes();render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}};
  const filtre=p=>catalog.items.filter(o=>p(o)&&(!q||o.name.toLowerCase().includes(q)));
  groupe('Armes de mêlée',filtre(o=>o.category==='weapon'&&!o.ranged),porte,gearPill,clic);
  groupe('Armes à distance',filtre(o=>o.category==='weapon'&&o.ranged),porte,gearPill,clic);
  groupe('Armures',filtre(o=>o.category==='armor'&&o.slot!=='shield'),porte,gearPill,clic);
  groupe('Boucliers',filtre(o=>o.category==='armor'&&o.slot==='shield'),porte,gearPill,clic);
  groupe('Objets',filtre(o=>o.category!=='weapon'&&o.category!=='armor'),porte,gearPill,clic);
  if(!corps.childElementCount){const v=document.createElement('p');v.className='muted';
   v.textContent=q?'Aucun objet de ce nom.':'L’armurerie est vide : crée un objet dans l’onglet Armurerie.';
   corps.append(v)}}
 else{
  a.talents??=[];
  const porte=t=>a.talents.includes(t.id);
  /* Une amélioration reste sous clé tant que son prérequis n'est pas appris ; l'oublier
     entraîne ce qui reposait dessus, et la note le dit. Le rappel du demandeur est honoré
     comme dans la branche de l'équipement, sans quoi une fiche de bestiaire ne se
     redessinait pas quand on décochait un talent. */
  const manque=t=>porte(t)?'':manqueTalent(a.talents,t,catalog.talents);
  const clic=t=>{const m=manque(t);
   if(m){$('picker-note').textContent='« '+t.name+' » exige d’abord « '+m+' ».';return}
   if(porte(t)){const {liste,tombes}=talentsSans(a.talents,t.id,catalog.talents);a.talents=liste;
    $('picker-note').textContent=tombes.length?'« '+t.name+' » oublié, et avec lui : '+tombes.join(', ')+'.':'Clique un talent pour l’apprendre ou l’oublier.'}
   else{a.talents=[...a.talents,t.id];$('picker-note').textContent='Clique un talent pour l’apprendre ou l’oublier.'}
   renderPicker();
   if(pickerApres)pickerApres();else{renderHeroes();render();scheduleSave()}};
  const prof=new Map();
  const pastille=t=>{const p=talentPill(t);if(prof.get(t.id))p.classList.add('sous-talent');
   const m=manque(t);if(m){p.classList.add('verrou');p.title+=' — sous clé : requiert '+m}return p};
  /* Un aventurier n'a que les génériques et les talents de sa classe ; un adversaire
     voit toutes les familles. La classe se reconnaît à sa clé (Gardien, Gardienne…). */
  const classe=classeDuHeros(a),toutes=talentFamilies();
  const tete=[GENERIQUES,...(classe?[classe]:[])];
  for(const famille of (a.hero?tete:[...tete,...toutes.filter(f=>!tete.includes(f))]))
   groupe(famille,ordonneTalents((catalog.talents||[]).filter(t=>talentFamily(t)===famille
    &&(!q||t.name.toLowerCase().includes(q)||(t.effects||'').toLowerCase().includes(q)))
    .sort((x,y)=>(x.level||1)-(y.level||1)||x.name.localeCompare(y.name,'fr')),catalog.talents)
    .map(([t,p])=>{prof.set(t.id,p);return t}),porte,pastille,clic);
  if(!corps.childElementCount){const v=document.createElement('p');v.className='muted';
   v.textContent=q?'Aucun talent de ce nom.':'Aucun talent au catalogue : crée-en un dans l’onglet Talents.';
   corps.append(v)}}}
/* ---------- Arbres de talents ---------- */
/* Une classe se lit comme un arbre : sa maîtrise en tête, acquise avec la classe, puis une
   colonne par spécialisation — trois au plus — dont les racines se prennent de haut en bas ;
   sous un talent pendent des sous-branches, les talents qui le requièrent. Les talents sans
   voie forment le tronc commun ; les génériques, une colonne à part, se choisissent
   librement. Le MJ bâtit l'arbre ici même : il nomme une voie, la renomme, la dissout ;
   il glisse un talent sur un autre pour l'y suspendre, sur un bandeau pour l'y ranger, entre
   deux pour l'insérer ; il crée un talent depuis une colonne ou sous un talent. Comment les
   points de talent débloquent les rangs viendra ensuite. */
const AUTRE_VOIE='__voie';
/* Une classe a toujours ses trois colonnes, nommées ou non : un arbre se lit d'un coup
   d'œil, et l'on ne compte pas les cases vides. Chaque rang porte un nom — ou rien tant que
   le MJ ne l'a pas baptisé. Un catalogue d'avant les voies nommées donne les siennes par
   les talents qui les portent. */
function voiesDe(famille){const brut=[...((catalog.voies||{})[famille]||[])].filter(v=>typeof v==='string');
 (catalog.talents||[]).forEach(t=>{if(t&&talentFamily(t)===famille&&t.voie&&!brut.includes(t.voie))brut.push(t.voie)});
 const out=brut.slice(0,VOIES_MAX);while(out.length<VOIES_MAX)out.push('');
 return out}
// Les voies qui portent un nom, pour les menus et les comptes.
function voiesNommees(famille){return voiesDe(famille).filter(Boolean)}
// Le rang qui accueille les talents sans voie : le premier sans nom, le premier sinon.
function rangDAccueil(famille){const voies=voiesDe(famille),i=voies.indexOf('');return i<0?0:i}
/* Baptiser un rang : le nom s'écrit sur la colonne et sur ses talents. Un nom vide l'efface
   — ses talents redeviennent sans voie et reviennent au tronc commun. Le rang qui hébergeait
   les sans-voie les emmène avec lui : ils ne disparaissent jamais de l'arbre. */
function nommerVoie(famille,rang,nom){nom=String(nom||'').trim().slice(0,60);
 if(!famille||!(rang>=0&&rang<VOIES_MAX))return false;
 const voies=voiesDe(famille),avant=voies[rang];
 if(nom===avant)return false;
 if(nom&&voies.some((v,i)=>v===nom&&i!==rang))return false;
 const accueil=rangDAccueil(famille);
 catalog.voies||={};catalog.voies[famille]=voies.map((v,i)=>i===rang?nom:v);
 // Une maîtrise trône au-dessus des colonnes : elle n'a que faire d'une voie.
 (catalog.talents||[]).forEach(t=>{if(!t||talentFamily(t)!==famille||t.type==='mait')return;
  const sansVoie=!t.voie||!voies.filter(Boolean).includes(t.voie);
  if(avant&&t.voie===avant)t.voie=nom;
  else if(!avant&&sansVoie&&rang===accueil)t.voie=nom});
 return true}
// Renommer par l'ancien nom, pour qui ne connaît que lui.
function renommerVoie(famille,avant,apres){const i=voiesDe(famille).indexOf(avant);
 return i<0?false:nommerVoie(famille,i,apres)}
// Nommer la première colonne libre : vrai si elle y est.
function enregistreVoie(famille,nom){const voies=voiesDe(famille);nom=String(nom||'').trim().slice(0,60);
 if(!nom)return false;if(voies.includes(nom))return true;
 const i=voies.indexOf('');return i<0?false:nommerVoie(famille,i,nom)}
// Dissoudre une voie : son nom s'efface, ses talents rejoignent le tronc commun.
function dissoudreVoie(famille,nom){const i=voiesDe(famille).indexOf(nom);
 return i<0?false:nommerVoie(famille,i,'')}
// Le menu des voies du formulaire : le tronc commun, les voies nommées, et une nouvelle s'il reste un rang.
function optionsVoie(famille,actuelle){const voies=voiesNommees(famille);
 return [['','— tronc commun —'],...voies.map(v=>[v,v]),
  ...(voies.length<VOIES_MAX||(actuelle&&!voies.includes(actuelle))?[[AUTRE_VOIE,'✎ Nouvelle spécialisation…']]:[])]}
/* La classe d'un aventurier telle que le catalogue la nomme : par son nom, ou par sa clé —
   une Gardienne trouve la colonne Gardien. */
function classeDuHeros(a){const sienne=(a&&a.role||'').split('·')[0].trim(),toutes=talentFamilies();
 const cle=typeof cleClasse==='function'?cleClasse(sienne):'';
 return sienne?toutes.find(f=>f===sienne)||toutes.find(f=>cle&&cleClasse(f)===cle)||toutes.find(f=>cle&&cle.startsWith(cleClasse(f)))||null:null}
// Les maîtrises d'une classe : ses talents de type Maîtrise, quelle que soit leur voie.
function maitrisesDe(classe){return classe?(catalog.talents||[]).filter(t=>t&&t.type==='mait'&&talentFamily(t)===classe):[]}
// La maîtrise vient avec la classe : un aventurier qui ne l'a pas la reçoit. Vrai si la fiche a changé.
function assureMaitrises(a){if(!a||!a.hero)return false;a.talents??=[];let change=false;
 maitrisesDe(classeDuHeros(a)).forEach(t=>{if(!a.talents.includes(t.id)){a.talents.push(t.id);change=true}});
 return change}
/* Une colonne en forêt : les racines — sans prérequis dans la colonne — dans l'ordre du
   catalogue, qui est celui du MJ, et sous chacune les talents qui la requièrent. */
function foretArbre(liste){const ids=new Set(liste.map(t=>t.id)),vus=new Set();
 const noeud=t=>{if(vus.has(t.id))return null;vus.add(t.id);
  return {t,enfants:liste.filter(x=>x.prerequis===t.id&&x.id!==t.id).map(noeud).filter(Boolean)}};
 const racines=liste.filter(t=>!t.prerequis||t.prerequis===t.id||!ids.has(t.prerequis)).map(noeud).filter(Boolean);
 liste.forEach(t=>{if(!vus.has(t.id)){const n=noeud(t);if(n)racines.push(n)}});   // un cycle, faute de racine, sort quand même
 return racines}
const aplatit=n=>[n.t,...n.enfants.flatMap(aplatit)];
function colonneArbre(titre,famille,voie,liste,rang){const arbre=foretArbre(liste);
 return {titre,famille,voie,rang,arbre,racines:arbre.map(n=>n.t),liste:arbre.flatMap(aplatit)}}
/* Les colonnes d'une classe : trois, toujours, nommées ou non. Celle qui accueille les
   talents sans voie s'appelle « Tronc commun » tant qu'elle n'a pas de nom ; les autres
   attendent le leur. Les maîtrises n'y sont pas : elles trônent au-dessus. */
function colonnesArbre(classe){const talents=(catalog.talents||[]).filter(t=>t&&talentFamily(t)===classe&&t.type!=='mait');
 const voies=voiesDe(classe),nommees=voies.filter(Boolean),accueil=rangDAccueil(classe);
 return voies.map((v,i)=>{
  /* Le rang d'accueil prend les siens et les sans-voie : quand les trois portent un nom,
     un talent sans voie s'y range quand même plutôt que de disparaître de l'arbre. */
  const liste=talents.filter(t=>(v&&t.voie===v)||(i===accueil&&!nommees.includes(t.voie||'')));
  const titre=v||(i===accueil?'Tronc commun':'Spécialisation '+(i+1));
  return colonneArbre(titre,classe,v,liste,i)})}
/* De haut en bas : une racine ne s'apprend qu'une fois la racine du dessus apprise ; un
   talent suspendu attend son prérequis, ce que dit déjà le catalogue. */
function verrouColonne(portes,racines,t){const i=racines.indexOf(t);
 return i>0&&!(portes||[]).includes(racines[i-1].id)?racines[i-1].name:''}
/* Placer un talent dans l'arbre : sa classe, sa voie, ce qu'il requiert, et sa place parmi
   ses frères — avant celui qu'on désigne, sinon en dernier. Jamais sous lui-même ni sous ce
   qui repose déjà sur lui : l'arbre ne se mord pas la queue. */
function placerTalent(id,dest){const liste=catalog.talents||[],i=liste.findIndex(t=>t&&t.id===id);if(i<0)return false;
 const t=liste[i];
 if(dest.prerequis){const p=liste.find(x=>x&&x.id===dest.prerequis);if(!p||p===t||descendDe(p,t))return false}
 if(dest.avant===t.id)return false;
 t.famille=dest.famille||GENERIQUES;t.voie=dest.voie||'';t.prerequis=dest.prerequis||'';
 t.branche=dest.branche==='g'||dest.branche==='d'?dest.branche:'';
 liste.splice(i,1);
 const k=dest.avant?liste.findIndex(x=>x&&x.id===dest.avant):-1;
 if(k>=0)liste.splice(k,0,t);else liste.push(t);
 return true}
/* ---------- Les étages d'une colonne ----------
   L'épine : les talents centraux, dans l'ordre de l'arbre. Sous chaque central, un étage
   intermédiaire — une place en diagonale à gauche, une à droite — que tient un talent de
   branche « g » ou « d » suspendu à ce central. On descend tout droit, ou par une
   diagonale, d'où un chemin redescend vers le central suivant. Un talent de branche dont
   le central n'est pas dans la colonne reprend l'épine : rien ne se perd. */
function etagesArbre(col){const liste=col.liste||[];
 const centraux=liste.filter(t=>!t.branche||!liste.some(x=>x.id===t.prerequis&&!x.branche&&x!==t));
 return centraux.map((t,i)=>{const dessous=liste.filter(x=>x.branche&&x.prerequis===t.id&&!centraux.includes(x));
  return {t,rang:i,g:dessous.find(x=>x.branche==='g')||null,d:dessous.find(x=>x.branche==='d')||null,suivant:centraux[i+1]||null}})}
// Un chemin fermé ne se dessine ni ne se marche : le MJ le ferme ou l'ouvre d'un clic.
function cheminCache(id,seg){const l=(catalog.cheminsCaches||{})[id];return Array.isArray(l)&&l.includes(seg)}
function basculeChemin(id,seg){if(!id||!SEGMENTS.includes(seg))return false;
 catalog.cheminsCaches||={};const l=catalog.cheminsCaches[id]||[];
 const apres=l.includes(seg)?l.filter(x=>x!==seg):[...l,seg];
 if(apres.length)catalog.cheminsCaches[id]=apres;else delete catalog.cheminsCaches[id];return true}
/* Ce qu'un nœud attend, par les chemins ouverts : une diagonale, son central et sa branche
   ouverte ; un central, le central du dessus par le chemin droit, ou une diagonale du dessus
   par son retour. Le premier central est libre. Le nom de ce qui manque, ou rien. */
function verrouEtages(portes,etages,t){const a=id=>(portes||[]).includes(id);
 for(let i=0;i<etages.length;i++){const e=etages[i];
  if(e.g===t||e.d===t){const seg=e.g===t?'g':'d';
   if(cheminCache(e.t.id,seg))return 'un chemin ouvert jusqu’à lui';return a(e.t.id)?'':e.t.name}
  if(e.t===t){if(i===0)return '';const h=etages[i-1],voies=[];
   if(!cheminCache(h.t.id,'c'))voies.push(h.t);
   if(h.g&&!cheminCache(h.t.id,'gc'))voies.push(h.g);
   if(h.d&&!cheminCache(h.t.id,'dc'))voies.push(h.d);
   if(!voies.length)return 'un chemin ouvert jusqu’à lui';
   return voies.some(x=>a(x.id))?'':voies.map(x=>x.name).join(' ou ')}}
 return ''}
// Oublier un central fait tomber tout ce qui est sous lui, diagonales comprises ; une diagonale ne tombe que seule.
function chuteDe(etages,t){const i=etages.findIndex(e=>e.t===t);
 return i<0?[t]:etages.slice(i).flatMap(e=>[e.t,e.g,e.d].filter(Boolean))}
const GLYPHES_TALENT={act:'⚔',reac:'↩',pass:'◆',crit:'✸',mait:'★',ame:'⇧'};
const arbresDialog=dialog('arbres','Arbres de talents','<p class="muted" id="arbres-note"></p><div id="arbres-corps"></div>');
/* L'arbre s'ouvre de deux façons : sur la fiche d'un combattant — il y choisit ses talents —
   ou depuis l'onglet Talents, pour une classe seule, que le MJ y bâtit sans personne à
   équiper. « arbresClasse » porte ce second cas. */
let arbresActeur=null,arbresClasse=null,arbreGlisse=null,arbresVueJoueur=false;
/* La vue joueur : le MJ regarde l'arbre comme la troupe le lira — sans outils, sans places
   vides, sans chemins fermés — et revient à l'édition d'un clic. */
const arbresVue=document.createElement('button');arbresVue.type='button';arbresVue.id='arbres-vue';arbresVue.className='arbres-vue';
arbresDialog.querySelector('.dialog-head').insertBefore(arbresVue,arbresDialog.querySelector('[data-close]'));
arbresVue.onclick=()=>{arbresVueJoueur=!arbresVueJoueur;noteArbres('');renderArbres()};
// Refermé, l'arbre ne retient ni fiche ni classe ni vue : la prochaine ouverture repart de zéro.
// L'événement arrive après coup : un arbre rouvert entre-temps garde ce qu'on vient de lui donner.
arbresDialog.addEventListener('close',()=>{if(arbresDialog.open)return;arbresActeur=null;arbresClasse=null;arbresVueJoueur=false});
// Les chemins se mesurent sur l'écran : la fenêtre qui change de taille les retrace.
if(typeof ResizeObserver==='function')new ResizeObserver(()=>traceChemins()).observe($('arbres-corps'));
/* Un clic hors de la fenêtre la referme, comme le ✕ : la cible du clic est le dialogue
   lui-même quand il tombe sur le fond, jamais quand il tombe sur son contenu. */
arbresDialog.addEventListener('click',e=>{if(e.target===arbresDialog)arbresDialog.close()});
/* Plus de mode d'emploi au-dessus des arbres, ni chez le MJ ni chez les joueurs : la note
   ne sert plus qu'aux refus et aux rappels du moment, et s'efface sinon. */
function noteArbres(texte){const n=$('arbres-note');n.textContent=texte||'';n.hidden=!texte}
/* La fiche d'un combattant telle qu'elle est maintenant : les fiches se remplacent en
   bloc quand la scène publiée ou la table arrive, et une page dessinée avant tenait
   l'ancienne — le rouage d'un joueur restait muet, sa fiche n'étant plus « la sienne ». */
function acteurCourant(a){if(!a||actors.includes(a))return a;return actors.find(x=>x&&x.id===a.id)||a}
// Le MJ ouvre l'arbre de n'importe quelle fiche ; un joueur, celui de son aventurier.
function peutVoirArbres(a){a=acteurCourant(a);return !!a&&(view==='mj'||(a.hero&&actors.indexOf(a)===owner))}
function openArbres(a){a=acteurCourant(a);if(!peutVoirArbres(a))return;arbresActeur=a;arbresClasse=null;
 if(assureMaitrises(a))scheduleSave();
 noteArbres('');renderArbres();arbresDialog.showModal()}
// L'arbre d'une classe, sans combattant : le MJ le bâtit, personne n'y apprend rien.
function openArbresClasse(famille){if(view!=='mj')return;arbresActeur=null;arbresClasse=famille||GENERIQUES;
 noteArbres('');renderArbres();arbresDialog.showModal()}
// Après un changement d'arbre : la popup, les onglets du catalogue, la table et la sauvegarde.
function arbreChange(){noteArbres('');renderArbres();renderCatalogPages();render();scheduleSave()}
function renderArbres(){const corps=$('arbres-corps');if(!corps||(!arbresActeur&&!arbresClasse))return;corps.replaceChildren();
 if(arbresActeur)arbresActeur=acteurCourant(arbresActeur);
 // En vue joueur, le MJ perd ses outils le temps de regarder : l'arbre se lit comme chez la troupe.
 const a=arbresActeur,mj=view==='mj'&&!arbresVueJoueur;
 arbresVue.hidden=view!=='mj';arbresVue.textContent=arbresVueJoueur?'✎ Reprendre l’édition':'👁 Vue joueur';arbresVue.classList.toggle('on',arbresVueJoueur);
 if(a){a.talents??=[];if(!peutVoirArbres(a)){arbresDialog.close();return}
  if(assureMaitrises(a))scheduleSave()}
 else if(view!=='mj'){arbresDialog.close();return}
 const classe=a?classeDuHeros(a):arbresClasse;
 /* L'arbre d'une classe se passe d'intitulé : son nom est écrit en grand au-dessus des
    colonnes, et la longue notice d'édition prenait la moitié de la fenêtre. */
 const titre=arbresDialog.querySelector('h2');
 titre.textContent='Arbres de talents — '+(a?a.name:classe);titre.hidden=!a;
 const note=noteArbres;
 // Sans combattant, nul ne porte rien : l'arbre se lit comme un plan, et se corrige.
 const porte=t=>!!a&&a.talents.includes(t.id);
 /* Le choix d'un joueur part à la table comme le reste de sa fiche : les talents voyagent
    avec les champs vivants — le rendu les pousse — et le MJ les voit sans republier. */
 const majTable=()=>{renderArbres();renderHeroes();render();scheduleSave()};
 /* Oublier une racine fait tomber les racines du dessous, et tout ce qui reposait sur
    elles ; du bas vers le haut, pour que chaque retrait n'emporte que le sien. */
 const oublier=(t,racines)=>{const avant=a.talents;let reste=avant;
  const chute=racines.includes(t)?racines.slice(racines.indexOf(t)):[t];
  [...chute].reverse().forEach(x=>{reste=talentsSans(reste,x.id,catalog.talents).liste});
  a.talents=reste;
  return avant.filter(id=>id!==t.id&&!reste.includes(id)).map(id=>{const x=talent(id);return x?x.name:''}).filter(Boolean)};
 const ico=(g,titre,fn)=>{const b=document.createElement('button');b.type='button';b.className='ico';b.textContent=g;
  b.title=titre;b.setAttribute('aria-label',titre);b.draggable=false;b.onclick=e=>{e.stopPropagation();fn()};return b};
 /* Le glisser-déposer du MJ : la source est le talent tiré, la cible dit où il va — sous
    un talent, en dernier d'un bandeau, ou avant un frère. */
 const glissable=(el,t)=>{if(!mj)return;el.draggable=true;
  el.addEventListener('dragstart',e=>{arbreGlisse=t.id;el.classList.add('tire');corps.classList.add('glisse');
   try{e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move'}catch(_){}});
  el.addEventListener('dragend',()=>{arbreGlisse=null;el.classList.remove('tire');corps.classList.remove('glisse')})};
 const cible=(el,dest)=>{if(!mj)return;
  el.addEventListener('dragover',e=>{if(!arbreGlisse)return;e.preventDefault();el.classList.add('survol');try{e.dataTransfer.dropEffect='move'}catch(_){}});
  el.addEventListener('dragleave',()=>el.classList.remove('survol'));
  el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('survol');const id=arbreGlisse;arbreGlisse=null;corps.classList.remove('glisse');
   if(!id)return;if(placerTalent(id,dest))arbreChange();else note('Ce talent ne peut pas aller là : il se retrouverait sous lui-même.')})};
 const entre=dest=>{const z=document.createElement('div');z.className='arbre-entre';cible(z,dest);return z};
 // Un nœud de l'arbre : le rond au logo — ou au glyphe de sa nature — le nom, le niveau.
 const noeud=(t,etat,verrou)=>{const b=document.createElement('div');b.tabIndex=0;b.setAttribute('role','button');
  b.className='arbre-noeud t-'+talentType(t)[0]+(etat?' '+etat:'');b.dataset.id=t.id;
  const rond=document.createElement('span');rond.className='arbre-rond';
  const logo=logoTalent(t);if(logo)rond.append(logo);else rond.textContent=GLYPHES_TALENT[t.type]||'✦';
  const nom=document.createElement('span');nom.className='arbre-nom';nom.textContent=t.name;
  const niv=document.createElement('span');niv.className='arbre-niv';niv.textContent=NIVEAUX_TALENTS?'Niv. '+(t.level||1):'';
  /* Un nœud de bonus n'est pas un talent : son rond dit la valeur, son nom la caractéristique,
     et le nom qu'on lui a donné passe dessous. */
  if(t.effet==='bonus'){const p=paramsTalent(t);b.classList.add('bonus','bonus-'+((p&&p.carac)||'pv'));
   rond.textContent='+'+Math.max(1,(p&&p.valeur)|0);nom.textContent=libelleBonus(p,true).replace(/^\+\d+ /,'');
   niv.textContent=t.name&&t.name!==libelleBonus(p,true)&&t.name!=='Nouveau talent'?t.name:(NIVEAUX_TALENTS?'Niv. '+(t.level||1):'')}
  niv.hidden=!niv.textContent;
  b.append(rond,nom,niv);
  b.title=t.name+' — '+[talentType(t)[2],t.effects].filter(Boolean).join(' · ')+(verrou?' — sous clé : requiert '+verrou:'');
  b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}};
  // Les outils du MJ, au survol : corriger le talent, en suspendre un nouveau dessous.
  if(mj){const outils=document.createElement('span');outils.className='arbre-outils';
   outils.append(ico('✎','Corriger '+t.name,()=>openTalent(catalog.talents.indexOf(t),renderArbres)));
   if(t.type!=='mait')outils.append(ico('⊕','Créer un talent sous '+t.name,()=>openTalent(null,renderArbres,
    {famille:talentFamily(t),voie:t.voie||'',prerequis:t.id,level:Math.min(20,(t.level||1)+1)})));
   b.append(outils)}
  return b};
 // La tête : la classe, et ses maîtrises, acquises d'office.
 const tete=document.createElement('div');tete.className='arbres-tete';
 const nomClasse=document.createElement('h3');nomClasse.className='arbres-classe';nomClasse.textContent=classe||'Sans classe';
 const encre=classe?teinteClasse(classe):'';if(encre){nomClasse.style.color=encre;corps.style.setProperty('--encre',encre)}
 else corps.style.removeProperty('--encre');
 tete.append(nomClasse);
 const maitrises=maitrisesDe(classe);
 if(maitrises.length){const bande=document.createElement('div');bande.className='arbre-maitrises';
  maitrises.forEach(t=>{const n=noeud(t,a?'acquis auto':'modele');
   n.title=t.name+' — Maîtrise de classe, acquise avec la classe.';
   if(!a)n.onclick=()=>openTalent(catalog.talents.indexOf(t),renderArbres);
   bande.append(n)});
  tete.append(bande)}
 else{const v=document.createElement('p');v.className='muted';
  v.textContent=classe?'Aucune maîtrise pour '+classe+'.':'Donne une classe à '+a.name+' pour lui ouvrir un arbre.';   // eslint-disable-line
  tete.append(v);
  if(mj&&classe){const plus=document.createElement('button');plus.type='button';plus.className='arbre-ajout';plus.textContent='+ Maîtrise';
   plus.title='Créer la maîtrise de '+classe+' : elle vient avec la classe';
   plus.onclick=()=>openTalent(null,renderArbres,{famille:classe,type:'mait',name:'Maîtrise'});tete.append(plus)}}
 corps.append(tete);
 /* Un nœud de l'arbre, et ce qu'il attend : sur l'épine, un chemin ouvert depuis l'étage du
    dessus ; en diagonale, son central et sa branche ; partout, son prérequis. Le tronc libre
    n'enchaîne rien. Sans porteur, le clic ouvre le talent : c'est le plan qu'on corrige. */
 const noeudArbre=(t,col,etages,libre,diag)=>{const acquis=porte(t);
  const verrou=!a||acquis?'':(libre?'':verrouEtages(a.talents,etages,t))||manqueTalent(a.talents,t,catalog.talents);
  const el=noeud(t,!a?'modele':acquis?'acquis':verrou?'verrou':'dispo',verrou);if(diag)el.classList.add('diag');
  el.onclick=()=>{if(!a){if(mj)openTalent(catalog.talents.indexOf(t),renderArbres);return}
   if(verrou){note('« '+t.name+' » exige d’abord « '+verrou+' ».');return}
   if(acquis){const tombes=oublier(t,libre?[]:chuteDe(etages,t));
    note(tombes.length?'« '+t.name+' » oublié, et avec lui : '+tombes.join(', ')+'.':'')}
   else{a.talents=[...a.talents,t.id];note('')}
   majTable()};
  glissable(el,t);cible(el,{famille:col.famille,voie:col.voie,prerequis:t.id});
  return el};
 // La place vide d'une diagonale : le MJ y crée un talent, ou y dépose celui qu'il tire.
 const place=(col,e,seg)=>{const p=document.createElement('div');p.className='arbre-place';
  if(!mj)return p;
  p.dataset.sous=e.t.id;p.dataset.place=seg;p.setAttribute('role','button');p.tabIndex=0;p.textContent='+';
  p.title='Créer un talent en diagonale '+(seg==='g'?'gauche':'droite')+' sous '+e.t.name;
  p.onclick=()=>openTalent(null,renderArbres,{famille:col.famille,voie:col.voie,prerequis:e.t.id,branche:seg,level:Math.min(20,(e.t.level||1)+1)});
  p.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();p.click()}};
  cible(p,{famille:col.famille,voie:col.voie,prerequis:e.t.id,branche:seg});return p};
 /* Une colonne : le bandeau — renommable, dissoluble —, puis les étages : chaque central sur
    l'épine, et sous lui l'étage intermédiaire aux deux diagonales. Les chemins se tracent
    par-dessus, une fois la colonne mesurée. Puis « + Talent », qui allonge l'épine. */
 const colonne=(c,libre)=>{const col=document.createElement('div');col.className='arbre-col'+(libre?' libre':'')+(mj?' editable':'');
  const h=document.createElement('h4');h.className='arbre-titre';
  const nomVoie=document.createElement('span');nomVoie.className='arbre-voie';nomVoie.textContent=c.titre;h.append(nomVoie);
  cible(h,{famille:c.famille,voie:c.voie});
  /* Le nom d'une colonne se corrige là où il se lit, nommée ou non : c'est ainsi qu'on
     baptise une spécialisation, et le ✕ lui reprend son nom — ses talents reviennent au
     tronc commun sans rien perdre. */
  if(mj&&c.rang>=0){nomVoie.classList.toggle('vierge',!c.voie);
   champVif(nomVoie,()=>c.voie,v=>{if(nommerVoie(c.famille,c.rang,v))arbreChange();
    else note('Ce nom de spécialisation est vide, inchangé, ou déjà pris par une autre colonne.')},'Nommer cette colonne','texte');
   if(c.voie){const x=ico('✕','Effacer le nom « '+c.voie+' » : ses talents rejoignent le tronc commun',async()=>{
     if(typeof demander==='function'&&!await demander('Effacer la spécialisation « '+c.voie+' » ? Ses talents rejoignent le tronc commun de '+c.famille+'.','Effacer'))return;
     if(nommerVoie(c.famille,c.rang,''))arbreChange()});
    x.classList.add('voie-x');h.append(x)}}
  col.append(h);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','arbre-chemins');col.append(svg);
  const etages=etagesArbre(c);col.etagesArbre={etages,mj,a};
  if(!etages.length){const v=document.createElement('span');v.className='muted';v.textContent='Aucun talent';col.append(v)}
  const pile=document.createElement('div');pile.className='arbre-etages';
  etages.forEach(e=>{if(mj)pile.append(entre({famille:c.famille,voie:c.voie,avant:e.t.id}));
   const central=document.createElement('div');central.className='arbre-etage central';
   central.append(noeudArbre(e.t,c,etages,libre,false));pile.append(central);
   /* L'étage intermédiaire : sous chaque central, pour le MJ ; pour la troupe, seulement
      s'il mène quelque part ou porte déjà une diagonale — une bande vide ne dit rien. */
   if(mj||e.suivant||e.g||e.d){const inter=document.createElement('div');inter.className='arbre-etage inter'+(!e.g&&!e.d?' vide':'');
    inter.append(e.g?noeudArbre(e.g,c,etages,libre,true):place(c,e,'g'));
    const milieu=document.createElement('div');milieu.className='arbre-milieu';inter.append(milieu);
    inter.append(e.d?noeudArbre(e.d,c,etages,libre,true):place(c,e,'d'));
    pile.append(inter)}});
  if(mj)pile.append(entre({famille:c.famille,voie:c.voie}));
  col.append(pile);
  if(mj){const plus=document.createElement('button');plus.type='button';plus.className='arbre-ajout';plus.textContent='+ Talent';
   plus.title='Créer un talent central dans '+c.titre;
   plus.onclick=()=>openTalent(null,renderArbres,{famille:c.famille,voie:c.voie});col.append(plus)}
  return col};
 /* Les colonnes : les trois de la classe, ni plus ni moins. Les génériques ont leur propre
    arbre — on l'ouvre par son rouage, dans l'onglet Talents — et n'encombrent plus celui
    d'une classe. */
 const grille=document.createElement('div');grille.className='arbres-cols';
 (classe?colonnesArbre(classe):[]).forEach(c=>grille.append(colonne(c,classe===GENERIQUES)));
 corps.append(grille);
 // Les chemins attendent que la fenêtre soit ouverte et la colonne mesurée.
 requestAnimationFrame(traceChemins)}
/* Les chemins d'une colonne, tracés d'un rond à l'autre : droit vers le central suivant,
   vers chaque diagonale et de là vers le central suivant. Un chemin fermé ne se dessine
   que pour le MJ, en pointillé pâle ; un chemin vers une place vide, plus pâle encore. Un
   chemin dont les deux bouts sont appris se colore. Le MJ clique un chemin pour le fermer
   ou l'ouvrir. */
function traceChemins(){const corps=$('arbres-corps');if(!corps||!arbresDialog.open)return;
 corps.querySelectorAll('.arbre-col').forEach(col=>{const info=col.etagesArbre,svg=col.querySelector('.arbre-chemins');if(!info||!svg)return;
  const ns='http://www.w3.org/2000/svg',R=col.getBoundingClientRect(),{etages,mj,a}=info;
  svg.setAttribute('viewBox','0 0 '+Math.max(1,R.width)+' '+Math.max(1,R.height));svg.replaceChildren();
  const elDe=id=>col.querySelector('.arbre-noeud[data-id="'+id+'"]');
  const placeDe=(id,seg)=>col.querySelector('.arbre-place[data-sous="'+id+'"][data-place="'+seg+'"]');
  // Le centre d'un bouton, et son rayon — anneau compris — pour que le trait s'arrête à son bord.
  const centre=el=>{const r=(el.querySelector('.arbre-rond')||el).getBoundingClientRect();return {x:r.left+r.width/2-R.left,y:r.top+r.height/2-R.top,r:r.width/2+5}};
  // Sans combattant, l'arbre se lit comme un plan : ses traits restent pleins.
  col.classList.toggle('sans-acteur',!a);
  const pris=(x,y)=>!!a&&!!x&&!!y&&a.talents.includes(x.id)&&a.talents.includes(y.id);
  const trait=(p,q,seg,id,cache,vide,marche)=>{const g=document.createElementNS(ns,'g');
   g.setAttribute('class','chemin '+seg+(cache?' cache':'')+(vide?' vide':'')+(marche?' pris':''));
   const l=document.createElementNS(ns,'line'),z=document.createElementNS(ns,'line');
   // Le trait ne traverse jamais un bouton : il ne vit qu'entre deux, d'un bord à l'autre.
   const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,rp=Math.min(p.r||0,d/2),rq=Math.min(q.r||0,d/2);
   const P={x:p.x+ux*rp,y:p.y+uy*rp},Q={x:q.x-ux*rq,y:q.y-uy*rq};
   [l,z].forEach(x=>{x.setAttribute('x1',P.x.toFixed(1));x.setAttribute('y1',P.y.toFixed(1));x.setAttribute('x2',Q.x.toFixed(1));x.setAttribute('y2',Q.y.toFixed(1))});
   z.setAttribute('class','zone');l.setAttribute('class','trait');g.append(z,l);
   if(mj){const t=document.createElementNS(ns,'title');t.textContent=cache?'Chemin fermé — cliquer pour l’ouvrir':'Chemin ouvert — cliquer pour le fermer';g.append(t);
    g.onclick=e=>{e.stopPropagation();if(basculeChemin(id,seg))arbreChange()}}
   svg.append(g)};
  etages.forEach(e=>{const haut=elDe(e.t.id);if(!haut)return;const H=centre(haut);
   const bas=e.suivant?elDe(e.suivant.id):null,B=bas?centre(bas):null;
   if(B){const cache=cheminCache(e.t.id,'c');if(mj||!cache)trait(H,B,'c',e.t.id,cache,false,!cache&&pris(e.t,e.suivant))}
   [['g','gc',e.g],['d','dc',e.d]].forEach(([seg,retour,t])=>{const el=t?elDe(t.id):placeDe(e.t.id,seg);if(!el)return;
    const M=centre(el),cache=cheminCache(e.t.id,seg),cacheRetour=cheminCache(e.t.id,retour);
    if(mj||!cache)trait(H,M,seg,e.t.id,cache,!t,!cache&&pris(e.t,t));
    if(B&&(mj||!cacheRetour))trait(M,B,retour,e.t.id,cacheRetour,!t,!cacheRetour&&pris(t,e.suivant))})})})}
/* Les réglages de l'appareil : le thème et les touches de la carte. Rien n'est enregistré
   dans la partie — c'est le navigateur qui s'en souvient, pour ce poste seulement. */
function renderSettings(){const boite=$('raccourcis');if(!boite)return;
 $('theme-switch').textContent=document.body.classList.contains('sombre')?'☀ Repasser au thème clair':'☾ Passer au mode nuit';
 // La scène n'a plus de bandeau au-dessus de la table : son titre se lit et se change ici.
 $('bloc-scene').hidden=view!=='mj';
 $('scene-titre').textContent=sceneTitle();
 $('scene-tour').textContent='Tour de combat '+String(round).padStart(2,'0');
 if(saveLabel.parentNode!==$('bloc-sauvegarde'))$('bloc-sauvegarde').append(saveLabel);
 $('reglage-import').hidden=view!=='mj';
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
$('bestiary-search').oninput=renderBestiary;$('bestiary-family').onchange=renderBestiary;
$('bestiary-sort').onchange=renderBestiary;
// Depuis le bestiaire, un nouveau monstre est un modèle : il s'y range, sans entrer en scène.
$('bestiary-add').onclick=()=>openActor(null,false,null,true);
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
// Vrai quand la fiche ouverte crée un modèle du bestiaire, et non un combattant de la scène.
let templateNeuf=false;
function baseActor(hero){return normalizeActor({name:hero?'Nouvel aventurier':'Nouveau monstre',hero,role:hero?'Aventurier':'Adversaire',hp:12,max:12,def:2,dmg:2,x:50,y:60,pool:[2,0,0,0,0,0,0],checks:[false,false,false],target:null,skills:Array(8).fill(0)})}
function fromMonster(m){const a=baseActor(false);Object.assign(a,{template:m.id,name:m.name,role:m.family||'Adversaire',sexe:m.sexe||'',race:m.race||'',hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,esquive:!!m.esquive,rapide:!!m.rapide,notes:m.notes||'',talents:[...(m.talents||[])],attacks:structuredClone(m.attacks||[]),image:m.image||null,weapons:[...(m.weapons||[])],armures:[...armuresDe(m)],shieldId:m.shieldId||'',inventaire:[...(m.inventaire||[])]});completerInventaire(a);a.activeAttack=0;a.pool=poolOf(a);return a}
function openActor(index=null,hero=true,template=null,neuf=false){if(view!=='mj')return;
 if(index!==null&&!actors[index])return;saveChecks();savePool();editing=index;templateIndex=template;templateNeuf=!!neuf&&template===null&&!hero;draft=structuredClone(template!==null?fromMonster(catalog.monsters[template]):index===null?baseActor(hero):actors[index]);attackDraft=structuredClone(draft.attacks);$('actor-error').textContent='';$('delete-actor').hidden=index===null;$('save-template').hidden=draft.hero||templateNeuf;renderActorForm();actorDialog.showModal()}
function renderActorForm(){const a=draft;const weaponOptions=[['','Aucune'],...catalog.items.filter(w=>w.category==='weapon').map(w=>[w.id,w.name])];const armorOptions=slot=>[['','Aucune'],...catalog.items.filter(w=>w.category==='armor'&&w.slot===slot).map(w=>[w.id,w.name])];
$('actor-fields').innerHTML='<div class="edit-grid">'+field('Nom','name',a.name,'text','required maxlength="120"')+field(a.hero?'Classe / rôle':'Famille / rôle','role',a.role,'text',a.hero?'list="classes-jeu" maxlength="120"':'')+(templateIndex===null&&a.hero?field('PV actuels','hp',a.hp,'number','min="0" max="99999"'):'')+field('PV maximum','max',a.max,'number','min="1" max="99999" required'+(a.hero?' readonly':''))+field(a.hero?'DEF':'Bonus de DEF','def',a.def,'number','min="0" max="99"')+field(a.hero?'Dégâts':'Bonus de dégâts','dmg',a.dmg,'number','min="0" max="999"')+field('XP','xp',a.xp,'number','min="0" max="999999"')+(a.hero?sel('Sexe','sexe',a.sexe,[['','—'],['Femme','Femme'],['Homme','Homme'],['Autre','Autre']])+field('Espèce','race',a.race,'text','maxlength="40"'):'')+(a.hero?field('Vie','vie',a.vie,'number','min="0" max="999" step="any"')+field('Vie maximale','vieMax',a.vieMax,'number','min="1" max="999" step="any"')+field('Endurance','endu',a.endu,'number','min="1" max="999"')+field('Bonus PV (classe + espèce)','pvBonus',a.pvBonus,'number','min="-9999" max="9999" readonly')+field('Niveau','level',a.level,'number','min="1" max="7"'):'')+'</div>'
  +(a.hero?'<datalist id="classes-jeu">'+(catalog.classes||[]).map(c=>'<option value="'+esc(c.name)+'">').join('')+'</datalist>'
   +'<p class="muted">Classes du jeu : '+(catalog.classes||[]).map(c=>esc(c.name)+' (PV +'+(c.pv||0)+')').join(' · ')+'.</p>':'')
  +'<div class="edit-grid">'+sel('Taille du socle','socle',a.socle,[['small','Petit'],['medium','Moyen'],['large','Grand'],['huge','Énorme']])+(!a.hero?sel('Type','type',a.type,[['standard','Standard'],['solitaire','Solitaire'],['alpha','Élite'],['boss','Boss']]):'')+(a.hero?'<label class="field-check"><input name="rapide" type="checkbox" '+(a.rapide?'checked':'')+'>Rapide (manuel)</label><label class="field-check"><input name="esquive" type="checkbox" '+(a.esquive?'checked':'')+'>Esquive 6+ (manuelle)</label>':'')+'</div>'+'<div class="divider"></div><h2>Illustration du token</h2><img class="preview-token" id="draft-image" alt="Token" '+(a.image?'src="'+a.image+'"':'hidden')+'><div class="toolbar"><button type="button" id="token-upload">Importer et optimiser</button><button type="button" id="token-remove">Retirer l’image</button></div><input id="token-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>'+'<div class="divider"></div><h2 class="sous-titre">Talents<button type="button" id="add-talent" class="ico plus" title="Créer un talent" aria-label="Créer un talent">+</button></h2><input id="talent-filter" placeholder="Filtrer les talents…" aria-label="Filtrer les talents"><div id="talent-picker"></div><p class="muted">Les talents se créent dans l’onglet Talents. Les Génériques viennent en tête, puis ceux de la '+(a.hero?'classe de l’aventurier':'famille de la créature')+'.</p>'+(a.hero?'<div class="divider"></div><h2>Compétences</h2><p class="muted">Chaque chiffre est un <b>bonus</b>, pas un nombre de dés : un test lance 1 dé plus ce bonus, chaque 4+ est une réussite, chaque 6 relance un dé de plus qui compte à son tour.</p><div class="edit-grid">'+skillNames.map((n,i)=>field(n,'skill'+i,a.skills[i],'number','min="0" max="30"')).join('')+'</div>':'')+'<div class="divider"></div><h2 class="sous-titre">Inventaire<button type="button" id="add-gear" class="ico plus" title="Créer un objet" aria-label="Créer un objet">+</button></h2><div id="inventaire-edit"></div><div class="edit-grid inv-ajout">'+sel('Ajouter à l’inventaire','inv_ajout','',inventaireOptions())+'<button type="button" id="inv-ajouter">Ajouter</button></div><p class="muted" id="equip-summary"></p><p class="muted">L’inventaire dit tout ce que le combattant possède ; l’équipement, ce qu’il porte — deux mains au plus : une arme à une main et un bouclier, deux armes à une main, ou une arme à deux mains — et une armure. Les dés de l’attaque et la DEF découlent de ce qui est porté ; les objets restent dans l’inventaire.</p>'+(a.hero?'':'<div class="divider"></div><h2>Attaques spéciales</h2><div id="attack-edit-list"></div><button type="button" id="add-attack">+ Attaque</button><p class="muted">La réserve et le bonus de dégâts sont appliqués. Portée, cibles multiples et effets indiqués ci-dessous restent manuels.</p>')+'<div class="divider"></div><label>'+(a.hero?'Inventaire et notes':'Notes')+'<textarea name="notes" rows="4">'+esc(a.notes)+'</textarea></label>';
/* Un adversaire qui porte une armure tire sa DEF d'elle seule : le champ se tait et
   montre ce que l'armure donne. Son chiffre propre reste dessous — readActor ne lit pas
   un champ éteint — et revient tel quel si l'armure s'en va. */
{const f=$('actor-form').elements,porte=equippedDef(a,catalog.items);
 if(f.def&&!a.hero&&porte!==null){f.def.value=porte;f.def.disabled=true;
  f.def.title='DEF donnée par l’armure portée.'}}
/* Les points de vie d'un aventurier ne se saisissent plus : son bonus vient de sa classe
   et de son espèce, et son maximum en découle — Vie × Endurance + bonus. Les deux champs
   se recalculent à chaque frappe dans Vie, Endurance, la classe ou l'espèce. */
if(a.hero){const f=$('actor-form').elements;
 const majPV=()=>{const bonus=bonusPV(catalog.classes,f.role.value,f.race.value);
  f.pvBonus.value=bonus;
  f.max.value=Math.max(1,num(f.vie.value,1,999)*num(f.endu.value,1,999)+bonus)};
 ['vie','endu','role','race'].forEach(k=>{if(f[k])f[k].addEventListener('input',majPV)});
 majPV()}
$('token-upload').onclick=()=>$('token-file').click();$('token-file').onchange=()=>{const f=$('token-file').files[0];if(f)openImage(f,'token',url=>{draft.image=url;$('draft-image').src=url;$('draft-image').hidden=false})};$('token-remove').onclick=()=>{draft.image=null;$('draft-image').hidden=true};if($('add-attack'))$('add-attack').onclick=()=>{readAttacks();attackDraft.push({name:'Nouvelle attaque',dice:diceFrom([1,0,0,0,0,0,0]),range:'contact',targets:'one',useOwnDamage:true,effects:{}});renderAttacks()};renderStatePicker();
if($('talent-filter')){$('talent-filter').oninput=renderTalentPicker;renderTalentPicker();
 // Créé depuis la fiche, le talent y est aussitôt coché : on l'ajoutait pour cet aventurier.
 $('add-talent').onclick=()=>openTalent(null,t=>{draft.talents=[...new Set([...(draft.talents||[]),t.id])];
  if($('talent-filter'))$('talent-filter').value='';renderTalentPicker()})}
// Créé depuis la fiche, l'objet se pose dans le premier emplacement libre qui lui convient.
$('add-gear').onclick=()=>openItem(null,o=>{ajouterInventaire(draft,o);dessineInventaire();refreshEquip()});
$('inv-ajouter').onclick=()=>{const o=objetDe($('actor-form').elements.inv_ajout.value);if(!o)return;ajouterInventaire(draft,o);dessineInventaire();refreshEquip()};
dessineInventaire();refreshEquip();
renderAttacks()}
// Aperçu vivant de l'équipement : dés cumulés, portée et DEF verrouillée par l'armure.
/* Le menu d'ajout : toute l'armurerie, rangée par famille. */
function inventaireOptions(){const nomCat=o=>o.category==='weapon'?(o.ranged?'à distance':'mêlée'):o.category==='armor'?NOM_EMPLACEMENT(emplacementDe(o)).toLowerCase():'objet';
 const ordre=o=>o.category==='weapon'?(o.ranged?1:0):o.category==='armor'?(emplacementDe(o)==='shield'?3:2):4;
 return [['','— choisir —'],...[...(catalog.items||[])].sort((x,y)=>ordre(x)-ordre(y)||x.name.localeCompare(y.name,'fr')).map(o=>[o.id,o.name+' · '+nomCat(o)])]}
/* L'inventaire du formulaire : une ligne par objet possédé, son compte, « Équiper » ou
   « Porté » pour l'équipement, « − » pour en retirer un exemplaire. */
function dessineInventaire(){const boite=$('inventaire-edit');if(!boite||!draft)return;boite.replaceChildren();
 const comptes=new Map();(draft.inventaire||[]).map(objetDe).filter(Boolean).forEach(o=>comptes.set(o,(comptes.get(o)||0)+1));
 if(!comptes.size){const v=document.createElement('p');v.className='muted';v.textContent='Inventaire vide.';boite.append(v);return}
 comptes.forEach((n,o)=>{const ligne=document.createElement('div');ligne.className='inv-ligne';
  const p=gearPill(o);p.classList.add('mini');ligne.append(p);
  if(n>1){const x=document.createElement('span');x.className='tag exemplaires';x.textContent='×'+n;ligne.append(x)}
  const equipable=o.category==='weapon'||o.category==='armor';
  if(equipable){const portes=o.category==='weapon'?gearCount(draft,o.id):o.id===draft.shieldId?1:armuresDe(draft).filter(x=>x===o.id).length;
   const b=document.createElement('button');b.type='button';b.className='inv-equiper'+(portes?' on':'');b.textContent=portes?'Porté'+(portes>1?' ×'+portes:''):'Équiper';
   b.onclick=()=>{const souci=toggleEquip(draft,o);$('equip-summary').textContent=souci||'';dessineInventaire();refreshEquip()};ligne.append(b)}
  const moins=document.createElement('button');moins.type='button';moins.className='inv-retirer';moins.textContent='−';moins.title='Retirer un exemplaire';
  moins.onclick=()=>{retirerInventaire(draft,o);dessineInventaire();refreshEquip()};ligne.append(moins);
  boite.append(ligne)})}
function refreshEquip(){const f=$('actor-form').elements;if(!f||!$('equip-summary'))return;const ids=[...(draft&&draft.weapons||[])];
 const armes=ids.map(id=>catalog.items.find(w=>w.id===id)).filter(Boolean);
 const p=equippedPool({weapons:ids},catalog.items);
 /* Un aventurier ne saisit jamais sa DEF : elle est la somme de son armure et de son
    bouclier, zéro compris, et le champ est verrouillé. Un adversaire garde la sienne —
    écailles, cuir épais — et ce qu'il porte s'y ajoute : le champ reste à lui. */
 const heros=!!(draft&&draft.hero);
 const porte=equippedDef({armures:armuresDe(draft),shieldId:draft&&draft.shieldId||''},catalog.items)||0;
 const d=heros?porte:num(f.def.value,0,99)+porte;
 f.def.readOnly=heros;if(heros)f.def.value=porte;
 const des=p?p.map((n,i)=>n?n+' '+types[i]:'').filter(Boolean).join(' · ')||'aucun dé':'';
 // Deux exemplaires de la même arme se lisent « ×2 » plutôt que deux fois le même nom.
 const noms=[...new Set(ids)].map(id=>{const w=armes.find(x=>x.id===id),n=ids.filter(x=>x===id).length;
  return w?w.name+(n>1?' ×'+n:''):''}).filter(Boolean);
 /* Ce qui est porté ailleurs qu'aux mains, emplacement par emplacement : on voit d'un coup
    ce qui reste libre — trois anneaux, un dos, une tête. */
 const ailleurs=EMPLACEMENTS.map(([k,nom,places])=>{const mis=portesA(draft,k,catalog.items).map(id=>{const o=objetDe(id);return o?o.name:''}).filter(Boolean);
  return mis.length?nom+' : '+mis.join(', ')+(places>1?' ('+mis.length+'/'+places+')':''):''}).filter(Boolean).join(' · ');
 $('equip-summary').textContent=(armes.length?'Dés de '+noms.join(' + ')+' : '+des+(armes.some(w=>w.ranged)?' · tir à distance.':' · contact.'):'Aucune arme équipée : les dés viennent des attaques ci-dessous.')
  +(ailleurs?' '+ailleurs+'.':'')
  +' '+(heros?'DEF de l’équipement : '+d+', champ verrouillé.'
   :porte?'DEF : '+num(f.def.value,0,99)+' à lui, plus '+porte+' d’équipement, soit '+d+'.'
   :'DEF : la sienne, sans équipement pour l’augmenter.')}
function renderAttacks(){if(!$('attack-edit-list'))return;$('attack-edit-list').innerHTML=attackDraft.map((a,i)=>'<div class="attack-card" data-attack="'+i+'"><div class="edit-grid">'+field('Nom','an'+i,a.name,'text','required maxlength="100"')+sel('Portée','ar'+i,a.range,[['contact','Contact'],['distance','Distance']])+sel('Cibles','at'+i,a.targets,[['one','Unique'],['all','Multiples (manuel)']])+'</div>'+poolFields(poolFrom(a.dice),'ad'+i+'_')+'<label class="field-check"><input type="checkbox" name="ab'+i+'" '+(a.useOwnDamage!==false?'checked':'')+'>Ajouter les dégâts du combattant</label>'+field('Effets à appliquer manuellement','ae'+i,a.effectText||Object.entries(a.effects||{}).filter(([,v])=>v).map(([k])=>k).join(', '))+'<button type="button" data-remove-attack="'+i+'">Retirer cette attaque</button></div>').join('');habilleDes($('attack-edit-list'));document.querySelectorAll('[data-remove-attack]').forEach(b=>b.onclick=()=>{readAttacks();attackDraft.splice(Number(b.dataset.removeAttack),1);renderAttacks()})}
function readAttacks(){const f=$('actor-form').elements;if(!f.an0&&attackDraft.length)return;attackDraft=attackDraft.map((a,i)=>({...a,name:f['an'+i].value.trim()||'Attaque',range:f['ar'+i].value,targets:f['at'+i].value,useOwnDamage:f['ab'+i].checked,effectText:f['ae'+i].value,dice:diceFrom(keys.map((_,c)=>num(f['ad'+i+'_'+c].value,0,12)))}))}
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
  const liste=(catalog.talents||[]).filter(t=>!estBonus(t)&&talentFamily(t)===famille
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
   const niv=document.createElement('span');niv.className='tag';niv.textContent='Niv. '+(t.level||1);niv.hidden=!NIVEAUX_TALENTS;
   l.append(c,n,b,niv);l.title=t.effects||t.name;bloc.append(l)});
  boite.append(bloc)}
 if(!montres){const v=document.createElement('p');v.className='muted';
  v.textContent=(catalog.talents||[]).length?'Aucun talent ne correspond à ce filtre.'
   :'Aucun talent au catalogue. Va dans l’onglet Talents pour en créer.';
  boite.append(v)}}
/* Recharger les quatre listes d'équipement en place : reconstruire tout le formulaire
   perdrait ce qui y est saisi et pas encore enregistré. Le choix courant est conservé,
   et un objet tout neuf va se poser dans le premier emplacement libre qui l'accepte. */
function readActor(){const f=$('actor-form').elements;readAttacks();const a=structuredClone(draft);for(const k of ['name','role','notes','socle'])a[k]=f[k].value.trim();a.states=[...statesOf(draft)];for(const k of ['sexe','race'])if(f[k])a[k]=f[k].value.trim();
 for(const k of ['hp','max','def','dmg','xp','vie','vieMax','endu','pvBonus','level'])if(f[k]&&!f[k].disabled)a[k]=num(f[k].value,k==='pvBonus'?-9999:0,k==='xp'?999999:99999);a.max=Math.max(1,a.max);if(templateIndex!==null)a.hp=a.max;a.hp=Math.min(a.hp,a.max);setState(a,'Coma',!a.hp);if(!a.hero){a.type=f.type.value;if(f.menace)a.menace=f.menace.value}// Sans cases à l'écran (adversaires), les valeurs enregistrées sont conservées telles quelles.
 if(f.rapide)a.rapide=f.rapide.checked;if(f.esquive)a.esquive=f.esquive.checked;if(f.skill0)a.skills=skillNames.map((_,i)=>num(f['skill'+i].value,0,30));// Un adversaire n'a pas de rayon d'armurerie dans son formulaire : ce qu'il porte reste tel quel.
 // L'inventaire et l'équipement viennent du brouillon, où le formulaire les a composés ; ce qui n'est plus au catalogue s'efface.
 a.inventaire=(Array.isArray(a.inventaire)?a.inventaire:[]).filter(id=>catalog.items.some(o=>o.id===id));a.weapons=(a.weapons||[]).filter(id=>catalog.items.some(o=>o.id===id));
 a.armures=armuresDe(a).filter(id=>catalog.items.some(o=>o.id===id));if(!catalog.items.some(o=>o.id===a.shieldId))a.shieldId='';
 {const besoin=new Map();[...a.weapons,...a.armures,a.shieldId].filter(Boolean).forEach(id=>besoin.set(id,(besoin.get(id)||0)+1));besoin.forEach((n,id)=>{const ont=a.inventaire.filter(x=>x===id).length;for(let k=ont;k<n;k++)a.inventaire.push(id)})}
 a.attacks=attackDraft;a.activeAttack=0;a.talents=[...new Set(draft.talents||[])].filter(id=>(catalog.talents||[]).some(t=>t.id===id));
 // Un aventurier ne saisit jamais sa DEF : elle vaut son armure plus son bouclier, zéro compris.
 if(a.hero)a.def=defenseOf(a,catalog.items);
 a.pool=poolFrom(chosenAttack(a,catalog.items).dice)||poolFrom(attackDraft[0]?.dice);return a}
function toMonster(a){return {id:crypto.randomUUID(),name:a.name,family:a.role,sexe:a.sexe,race:a.race,pv:a.max,def:a.def,damage:a.dmg,xp:a.xp,type:a.type,socle:a.socle,menace:a.menace,rapide:a.rapide,esquive:a.esquive,notes:a.notes,talents:[...(a.talents||[])],attacks:structuredClone(a.attacks),image:a.image||null,weapons:[...(a.weapons||[])],armures:[...armuresDe(a)],shieldId:a.shieldId||'',inventaire:[...(a.inventaire||[])]}}
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
/* Un modèle corrigé gouverne aussitôt ce qui en descend : les créatures en scène, et la
   copie que chaque carte garde de lui — sans quoi il fallait rouvrir la carte pour voir
   le changement. Une créature sans modèle, ou dont le modèle a disparu du bestiaire, se
   reconnaît encore à son nom : elle adopte alors le modèle, et suivra ses corrections. */
function suitLeModele(a,m){if(a.hero)return false;
 if(a.template)return a.template===m.id
  ||(!(catalog.monsters||[]).some(x=>x&&x.id===a.template)&&a.name===m.name);
 return a.name===m.name}
function syncCartes(m){let touches=0;
 (typeof maps!=='undefined'?maps:[]).forEach(carte=>(carte.foes||[]).forEach(f=>{
  if(!f||!f.tpl||f.tpl.id!==m.id)return;f.tpl=structuredClone(m);touches++}));
 if(touches&&typeof saveMaps==='function')saveMaps();
 return touches}
function syncFromTemplate(m){let touches=0;syncCartes(m);
 actors.forEach(a=>{if(a.hero)return;
  if(!suitLeModele(a,m))return;a.template=m.id;
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
 renderCatalogPages()}
 else if(templateNeuf){catalog.monsters.push(toMonster(a));templateNeuf=false;renderCatalogPages();document.dispatchEvent(new Event('amertume-content-changed'))}
 else if(editing===null){actors.push(a);selected=actors.length-1}else actors[editing]=a;actorDialog.close();renderHeroes();render();scheduleSave()};
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
 const partants=rangs.map(i=>actors[i]);
 /* Les cibles sont des rangs dans la liste : on les retient par identifiant avant de
    retirer, et on les repose après — sinon elles glissaient sur d'autres combattants. */
 const visees=actors.map(a=>[a,(Array.isArray(a.targets)?a.targets:(a.target===null||a.target===undefined?[]:[a.target]))
  .map(j=>actors[j]&&actors[j].id).filter(Boolean)]);
 rangs.forEach(i=>{actors.splice(i,1);
  if(owner>=i)owner=Math.max(0,owner-1);
  if(selected!==null&&selected>=i)selected=selected>i?selected-1:null});
 visees.forEach(([a,ids])=>{if(!actors.includes(a))return;
  poseCibles(a,ids.map(id=>actors.findIndex(o=>o&&o.id===id)).filter(j=>j>=0))});
 if(!actors[owner]?.hero)owner=actors.findIndex(a=>a.hero);
 marked.clear();
 xpDesRetires(partants);
 render();scheduleSave();return null}
/* Un adversaire retiré de la scène laisse son XP : elle va à chaque aventurier présent
   sur la carte, en entier. Une seule ligne au journal, partagée à la table. */
function xpDesRetires(partants){const vaincus=partants.filter(f=>f&&!f.hero&&(Math.trunc(Number(f.xp))||0)>0);
 const xp=vaincus.reduce((s,f)=>s+Math.trunc(Number(f.xp)),0),heros=actors.filter(a=>a&&a.hero);
 if(!xp||!heros.length)return;
 heros.forEach(h=>writeStat(h,'xp',(Math.trunc(Number(h.xp))||0)+xp));
 log('+'+xp+' XP pour '+heros.map(h=>h.name).join(', ')+' ('+vaincus.map(f=>f.name).join(', ')+').');
 document.dispatchEvent(new Event('amertume-content-changed'))}
/* Rejouer la même rencontre : les adversaires repartent intacts, la troupe garde ses
   blessures — c'est le combat qu'on recommence, pas la partie. */
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
/* Les logos d'équipement : les fichiers img/weapon_*.png, sans leur extension. Le site
   est servi tel quel, sans liste de dossier : un logo ajouté dans img/ se déclare ici —
   node checks.cjs le réclame. L'intitulé du menu vient du nom du fichier. */
const LOGOS_EQUIPEMENT=['weapon_anneau_argent','weapon_anneau_bronze','weapon_anneau_or','weapon_arbalete','weapon_arc','weapon_armure','weapon_bouclier','weapon_cape','weapon_cape_elfique','weapon_cape_magique','weapon_cotte','weapon_cuir','weapon_epee','weapon_fleches','weapon_hache','weapon_lance'];
/* Les logos d'objets, de même : les img/item_*.png. Objets et divers y puisent, les
   munitions aussi ; armes et armures gardent les leurs. */
const LOGOS_OBJET=['item_healpotion'];
// Les logos de talents, de même : les img/spell_*.png.
const LOGOS_TALENT=['spell_orbes','spell_orbes_feu','spell_orbes_foudre','spell_orbes_gel'];
/* Les logos d'attaque, de même : les img/attack_*.png. Une attaque spéciale d'adversaire y
   puise — mais elle peut prendre n'importe quelle icône du dossier : griffes, arme, sort ou
   objet, c'est au MJ de dire ce que la bête brandit. */
const LOGOS_ATTAQUE=['attack_griffes'];
const LOGOS_TOUS=[...LOGOS_ATTAQUE,...LOGOS_EQUIPEMENT,...LOGOS_TALENT,...LOGOS_OBJET];
const nomLogo=l=>{const n=String(l||'').replace(/^(weapon|spell|item|attack)_/,'').replace(/[_-]+/g,' ');return n?n[0].toUpperCase()+n.slice(1):''};
// Le menu de logos d'un objet dépend de sa catégorie : une arme ou une armure choisit parmi
// les weapon_*, une munition parmi les deux (le carquois de flèches est un weapon_*), tout
// le reste parmi les item_*.
function logosItem(o){const c=o&&o.category;return c==='weapon'||c==='armor'?LOGOS_EQUIPEMENT:c==='ammo'?[...LOGOS_EQUIPEMENT,...LOGOS_OBJET]:LOGOS_OBJET}
/* Un logo devant un nom : un jeton, ou rien. Un logo inconnu du dossier ne se dessine
   pas — un objet importé d'ailleurs n'affiche pas une image cassée. */
function logoImage(l,liste,cls){if(!l||!liste.includes(l))return null;
 const im=document.createElement('img');im.className='logo-equip'+(cls?' '+cls:'');im.src=imgUrl(l+'.png');im.alt='';im.draggable=false;return im}
function logoEquipement(o,cls){return logoImage(o&&o.logo,[...LOGOS_EQUIPEMENT,...LOGOS_OBJET],cls)}
function logoTalent(t,cls){return logoImage(t&&t.logo,LOGOS_TALENT,cls)}
// Le logo d'une attaque : n'importe quelle icône du dossier, sans distinction de famille.
function logoAttaque(l,cls){return logoImage(l,LOGOS_TOUS,cls)}
const ITEM_CATS=[['melee','Arme de contact'],['ranged','Arme à distance'],['armor','Armure'],
 ['ammo','Munition'],['object','Objet'],['misc','Divers']];
/* Ce que le formulaire affiche à l'instant, relu tel quel. Les champs absents ne sont pas
   lus : la valeur déjà enregistrée reste en place au lieu d'être remise à zéro. */
function itemDepuisForm(base){const f=$('item-form').elements,a={...base};
 const c=f.category.value;a.ranged=c==='ranged';a.category=c==='melee'||c==='ranged'?'weapon':c;
 for(const k of ['name','slot','etat','notes'])if(f[k])a[k]=f[k].value.trim();
 /* L'effet, son usage et ses réglages, relus au travers de la déclaration : « consommable »
    n'est plus une case à part, c'est l'un des trois usages. */
 if(f.effet)a.effet=OBJETS_CODES[f.effet.value]?f.effet.value:'';
 if(f.usage)a.usage=USAGES_OBJET.some(([k])=>k===f.usage.value)?f.usage.value:'libre';
 if(f.mode)a.mode=f.mode.value==='passif'?'passif':'actif';
 a.params=a.effet?paramsObjet({effet:a.effet,params:lireReglagesObjet()}):{};
 a.consumable=usageObjet(a)==='conso';
 if(f.logo)a.logo=logosItem(a).includes(f.logo.value)?f.logo.value:'';
 if(f.rarete)a.rarete=rareteDe({rarete:f.rarete.value});
 if($('item-bonus'))a.bonus=lireBonusItem();
 for(const k of ['qty','price','hands','def'])if(f[k])a[k]=num(f[k].value,0,999999);
 // « consommable » n'a plus de case : c'est l'usage qui le dit, plus haut.
 for(const k of ['usesAmmo'])if(f[k])a[k]=f[k].checked;
 if(f.munDe)a.munDe=keys.includes(f.munDe.value)?f.munDe.value:'';
 if(f.itemdie0)a.dice=diceFrom(keys.map((_,i)=>num(f['itemdie'+i].value,0,12)));
 return a}
/* Une arme ne porte pas de DEF, une armure pas de dés : le formulaire ne montre que les
   champs qui veulent dire quelque chose pour la catégorie choisie. Changer de catégorie
   le redessine, sans perdre ce qui vient d'être tapé. */
/* Les réglages de l'effet d'un objet, relus de sa déclaration — comme ceux d'un talent.
   Invulnérabilité ne montre que le réglage qui compte : un état, ou une couleur de dés. */
function dessineReglagesObjet(){const boite=$('objet-reglages');if(!boite)return;
 const f=$('item-form').elements,code=OBJETS_CODES[f.effet.value]||null;
 if(!code){boite.replaceChildren();return}
 const vals=paramsObjet({effet:code.cle,params:lireReglagesObjet()});
 const contre=vals.contre;
 boite.innerHTML='<div class="edit-grid">'
  +(code.params||[]).filter(p=>code.cle!=='invulnerabilite'||p.cle==='contre'
    ||(p.cle==='etat'&&contre!=='des')||(p.cle==='des'&&contre==='des'))
   .map(p=>p.type==='nombre'
    ?field(p.nom,'q_'+p.cle,vals[p.cle],'number','min="'+p.min+'" max="'+p.max+'"')
    :sel(p.nom,'q_'+p.cle,vals[p.cle],p.options)).join('')+'</div>';
 // Changer « Insensible à » remonte le bon réglage sans quitter le formulaire.
 const choix=f.q_contre;if(choix)choix.onchange=()=>{itemDraft.params=lireReglagesObjet();dessineReglagesObjet()}}
function lireReglagesObjet(){const f=$('item-form').elements,out={...(itemDraft.params||{})};
 for(const el of f)if(el.name&&el.name.startsWith('q_'))out[el.name.slice(2)]=el.value;
 return out}
function dessineItem(){const a=itemDraft,arme=a.category==='weapon',armure=a.category==='armor';
 const cat=arme?(a.ranged?'ranged':'melee'):a.category;
 $('item-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','name',a.name,'text','required maxlength="120"')
  +sel('Catégorie','category',cat,ITEM_CATS)
  +sel('Logo','logo',a.logo||'',[['','— aucun —'],...logosItem(a).map(l=>[l,nomLogo(l)])])
  +sel('Rareté','rarete',rareteDe(a),RARETES)
  +field('Prix','price',a.price||0,'number','min="0" max="999999"')
  +(arme?sel('Mains','hands',a.hands||1,[[1,'1 main'],[2,'2 mains']]):'')
  +(armure?field('DEF','def',a.def||0,'number','min="0" max="99"')
   +sel('Emplacement','slot',emplacementDe(a),[...EMPLACEMENTS.map(([k,n,p])=>[k,n+(p>1?' ('+p+')':'')]),['shield','Bouclier — une main']]):'')
  +(arme||armure?'':field('Quantité','qty',a.qty||1,'number','min="1" max="9999"'))
  +'</div>'
  +(arme?'<p class="etiquette">Dés de l’arme</p>'+poolFields(poolFrom(a.dice),'itemdie')
   +sel('État infligé','etat',a.etat||'',[['','—'],...ETATS_INFLIGES().map(e=>[e,e])]):'')
  +(arme&&a.ranged?'<label class="field-check"><input name="usesAmmo" type="checkbox" '+(a.usesAmmo?'checked':'')+'>Munitions nécessaires</label>':'')
  /* Une munition portée donne aux armes à distance un dé de plus, de sa couleur, et l'état
     qu'elle inflige — l'un, l'autre, ou les deux. */
  +(a.category==='ammo'?'<div class="edit-grid">'+sel('Dé ajouté aux armes à distance','munDe',a.munDe||'',[['','— aucun —'],...keys.map((k,i)=>[k,types[i]]).filter(([k])=>k!=='green')])
   +sel('État infligé par le tir','etat',a.etat||'',[['','—'],...ETATS_INFLIGES().map(x=>[x,x])])+'</div>':'')
  +'<label>Notes<textarea name="notes">'+esc(a.notes||'')+'</textarea></label>'
  /* Ce que l'objet fait quand on s'en sert, et comment on en use : la même grammaire que
     les talents — on choisit l'effet, puis on le règle. */
  +'<h2 class="sous-titre">Effet appliqué par le moteur</h2>'
  +'<div class="edit-grid">'
  +sel('Effet','effet',a.effet||'',[['','— Aucun : objet descriptif —'],...Object.values(OBJETS_CODES).map(c=>[c.cle,c.nom])])
  +sel('Usage','usage',usageObjet(a),USAGES_OBJET)
  /* Actif ou passif : pour une pièce d'équipement dont l'effet le permet. Passif, l'effet
     agit en permanence tant que la pièce est portée, sans bouton en combat. */
  +(EQUIPEMENTS.includes(a.category)?sel('Mode','mode',a.mode==='passif'?'passif':'actif',[['actif','Actif — un bouton en combat'],['passif','Passif — permanent tant que porté']]):'')+'</div>'
  +'<div id="objet-reglages"></div>'
  /* Ce que la pièce confère à qui la porte : une ligne par bonus, cumulables, qu'on ajoute
     et retire ici et qu'on relit sur sa fiche. */
  +'<h2 class="sous-titre">Bonus de caractéristiques</h2><div id="item-bonus"></div>'
  +'<button type="button" id="item-bonus-add" class="arbre-ajout">+ Bonus</button>';
 habilleDes($('item-fields'));
 dessineBonusItem();
 $('item-bonus-add').onclick=()=>{itemDraft=itemDepuisForm(itemDraft);itemDraft.bonus=[...normaliseBonusEquip(itemDraft.bonus),{carac:'pv',valeur:1,comp:'0'}];dessineBonusItem()};
 /* Les réglages de l'effet sont dessinés d'après sa déclaration : ajouter un effet au
    moteur suffit à lui donner son formulaire. */
 const menuEffet=$('item-form').elements.effet;
 // Le mode ne se propose qu'à un effet qui sait être passif ; passif, l'usage ne compte plus.
 const majMode=()=>{const f=$('item-form').elements,code=OBJETS_CODES[f.effet.value];
  if(f.mode){const l=f.mode.closest('label');l.hidden=!(code&&typeof code.passif==='function')}
  const passif=f.mode&&!f.mode.closest('label').hidden&&f.mode.value==='passif';
  if(f.usage)f.usage.closest('label').hidden=!!passif};
 menuEffet.onchange=()=>{itemDraft=itemDepuisForm(itemDraft);itemDraft.effet=menuEffet.value;itemDraft.params={};dessineReglagesObjet();majMode()};
 if($('item-form').elements.mode)$('item-form').elements.mode.onchange=majMode;
 dessineReglagesObjet();majMode();
 /* L'aperçu du logo, à côté de son menu : on voit ce qu'on choisit. */
 const menuLogo=$('item-form').elements.logo;
 const apercu=document.createElement('img');apercu.className='logo-equip apercu';apercu.alt='';
 const montre=()=>{const l=menuLogo.value;apercu.hidden=!l;if(l)apercu.src=imgUrl(l+'.png')};
 menuLogo.parentNode.append(apercu);montre();menuLogo.onchange=montre;
 $('item-form').elements.category.onchange=()=>{itemDraft=itemDepuisForm(itemDraft);dessineItem()}}
/* Les lignes de bonus du formulaire : caractéristique, valeur, et la compétence quand c'en
   est une. Elles se lisent avec le reste du formulaire, et se retirent d'un ✕. */
function dessineBonusItem(){const boite=$('item-bonus');if(!boite)return;boite.replaceChildren();
 normaliseBonusEquip(itemDraft.bonus).forEach((b,i)=>{const l=document.createElement('div');l.className='bonus-ligne';
  const carac=document.createElement('select');carac.name='bonus_carac_'+i;CARACS_EQUIP.forEach(([k,n])=>carac.add(new Option(n,k)));carac.value=b.carac;
  const val=document.createElement('input');val.name='bonus_valeur_'+i;val.type='number';val.min='1';val.max='99';val.value=String(b.valeur);val.setAttribute('aria-label','Valeur du bonus');
  const comp=document.createElement('select');comp.name='bonus_comp_'+i;COMPETENCES.forEach((n,k)=>comp.add(new Option(n,String(k))));comp.value=b.comp;comp.hidden=b.carac!=='comp';
  carac.onchange=()=>{comp.hidden=carac.value!=='comp'};
  const x=document.createElement('button');x.type='button';x.className='ico';x.textContent='✕';x.title='Retirer ce bonus';x.setAttribute('aria-label','Retirer ce bonus');
  x.onclick=()=>{itemDraft=itemDepuisForm(itemDraft);itemDraft.bonus.splice(i,1);dessineBonusItem()};
  const plus=document.createElement('span');plus.className='bonus-plus';plus.textContent='+';
  l.append(plus,val,carac,comp,x);boite.append(l)});
 if(!boite.childElementCount){const v=document.createElement('p');v.className='muted';v.textContent='Aucun bonus : la pièce ne confère rien de plus que ses dés ou sa DEF.';boite.append(v)}}
function lireBonusItem(){const f=$('item-form').elements,out=[];
 for(let i=0;f['bonus_carac_'+i];i++)out.push({carac:f['bonus_carac_'+i].value,valeur:f['bonus_valeur_'+i].value,comp:f['bonus_comp_'+i].value});
 return normaliseBonusEquip(out)}
function openItem(i=null,apres=null){itemIndex=i;itemApres=apres;
 itemDraft=i===null?{name:'Nouvel objet',category:'weapon',ranged:false,hands:1,qty:1,price:0,def:0,slot:'torse',dice:{},traits:[]}
  :structuredClone(catalog.items[i]);
 dessineItem();$('delete-item').hidden=i===null;itemDialog.showModal()}
$('item-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 const a=itemDepuisForm({...(itemIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.items[itemIndex])),...itemDraft});
 if(itemIndex===null)catalog.items.push(a);else catalog.items[itemIndex]=a;itemDialog.close();renderCatalogPages();scheduleSave();const rappel=itemApres;itemApres=null;if(rappel)rappel(a)};
$('delete-item').onclick=()=>{if(view!=='mj'||itemIndex===null||!confirm('Supprimer cet objet du catalogue ? Les attaques déjà appliquées restent inchangées.'))return;const id=catalog.items[itemIndex].id;actors.forEach(a=>{a.weapons=a.weapons.filter(w=>w!==id);a.armures=armuresDe(a).filter(x=>x!==id);if(a.shieldId===id)a.shieldId=''});catalog.items.splice(itemIndex,1);itemDialog.close();renderCatalogPages();scheduleSave()};

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
   else log('Rien de posé : lâche le modèle sur la carte.',{local:true})};
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
const originalRender=render;render=function(){if(!loading&&synchronisePV())scheduleSave();originalRender();
 const mj=view==='mj';['reset-map'].forEach(id=>{const el=$(id);if(el)el.hidden=!mj});$('owner').replaceChildren();actors.forEach((a,i)=>{if(a.hero)$('owner').add(new Option(a.name,String(i)))});$('owner').value=String(owner);const a=actors[selected];$('actor-notes').textContent=a&&a.notes||'';

 // Le menu des attaques ne paraît que s'il y a vraiment à choisir : la barre sous
 // « Attaque » appartient désormais aux cibles à portée.
 // Une arme portée ne commande la réserve que d'un aventurier : chez un adversaire,
 // c'est sa carte d'attaque, et le choix entre plusieurs doit rester offert.
 renderAttackChoices();scheduleSave()};
// Les entrées éditées restent du texte, y compris dans les boutons de sélection.
const rawLog=log;log=function(...args){rawLog(...args);scheduleSave()};
function scheduleSave(){if(loading)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,200)}
function snapshot(){return {version:8,actors,catalog,round,mode,owner,selected,mapImage,maps,currentMapId,title:sceneTitle()}}
/* La sauvegarde globale est la sauvegarde locale, mise dans un fichier : même forme, même
   lecture. Elle ajoute ce qui aide à la reconnaître et le verrou des tokens. */
function sauvegardeGlobale(){return Object.assign({app:'amertume_online',exporte:new Date().toISOString()},snapshot(),{locked:typeof tokensLocked!=='undefined'&&tokensLocked===true})}
function nomSauvegarde(d=new Date()){const p=n=>String(n).padStart(2,'0');return 'amertume-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.json'}
function tailleLisible(octets){return octets<1024*1024?Math.max(1,Math.round(octets/1024))+' Ko':(octets/1048576).toFixed(1).replace('.',',')+' Mo'}
function verifieSauvegarde(s){if(!s||typeof s!=='object'||Array.isArray(s))return 'Ce fichier n’est pas une sauvegarde d’Amertume Online.';
 if(s.version!==7&&s.version!==8)return 'Version de sauvegarde inconnue ('+s.version+'). Cette application lit les versions 7 et 8.';
 if(!Array.isArray(s.actors)||!s.actors.length)return 'La sauvegarde ne contient aucun combattant.';
 if(!s.actors.some(a=>a&&typeof a==='object'&&a.hero))return 'La sauvegarde ne contient aucun aventurier.';
 if(s.catalog!=null&&(typeof s.catalog!=='object'||Array.isArray(s.catalog)))return 'Le catalogue de la sauvegarde est illisible.';
 if(s.maps!=null&&!Array.isArray(s.maps))return 'Les cartes de la sauvegarde sont illisibles.';
 if(s.domaine!=null&&(typeof s.domaine!=='object'||Array.isArray(s.domaine)))return 'Le domaine de la sauvegarde est illisible.';
 return ''}
function resumeSauvegarde(s){const n=(x,un,des)=>x+' '+(x>1?des:un);const c=s.catalog||{},l=k=>Array.isArray(c[k])?c[k].length:0;
 return [n(s.actors.filter(a=>a&&a.hero).length,'aventurier','aventuriers'),n(s.actors.filter(a=>a&&!a.hero).length,'adversaire','adversaires'),
  n(Array.isArray(s.maps)?s.maps.length:0,'carte','cartes'),n(l('monsters'),'modèle','modèles'),n(l('items'),'équipement','équipements'),n(l('talents'),'talent','talents')].join(', ')}
function appliquerSauvegarde(s){actors.splice(0,actors.length,...s.actors.map(normalizeActor));idsUniques(actors);catalog=normalizeCatalog(s.catalog);
 round=Number.isInteger(s.round)&&s.round>0?s.round:1;mode=s.mode==='exploration'?'exploration':'combat';
 owner=Number.isInteger(s.owner)&&actors[s.owner]?s.owner:Math.max(0,actors.findIndex(a=>a.hero));
 selected=Number.isInteger(s.selected)&&actors[s.selected]?s.selected:(s.selected===null?null:owner);
 mapImage=typeof s.mapImage==='string'&&s.mapImage?s.mapImage:null;maps=Array.isArray(s.maps)?s.maps:[];currentMapId=s.currentMapId||null;sceneTitle(s.title);
 if(typeof tokensLocked!=='undefined'&&typeof s.locked==='boolean')tokensLocked=s.locked;
 $('map-view').style.backgroundImage=mapImage?'url("'+mapImage+'")':'';$('map').classList.toggle('custom',!!mapImage);$('round').textContent=String(round).padStart(2,'0')}
function exporterTout(){const texte=JSON.stringify(sauvegardeGlobale());const url=URL.createObjectURL(new Blob([texte],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=nomSauvegarde();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 log('Sauvegarde globale exportée : '+a.download+' ('+tailleLisible(texte.length)+').',{local:true})}
function importerTout(fichier){const erreur=$('import-erreur');erreur.textContent='';
 fichier.text().then(texte=>{let s;try{s=JSON.parse(texte)}catch(e){throw Error('ce fichier n’est pas du JSON lisible.')}
  const souci=verifieSauvegarde(s);if(souci)throw Error(souci);
  if(!confirm('Remplacer la partie de ce navigateur par « '+fichier.name+' » ?\n'+resumeSauvegarde(s)+'.\nLa partie actuelle sera perdue si elle n’a pas été exportée.'))return;
  appliquerSauvegarde(s);if(typeof refreshMapPick==='function')refreshMapPick();renderCatalogPages();render();saveNow();
  log('Sauvegarde importée : '+fichier.name+' — '+resumeSauvegarde(s)+'.',{local:true});document.dispatchEvent(new Event('amertume-content-changed'))})
 .catch(e=>{erreur.textContent='Import refusé : '+e.message})}
$('export-tout').onclick=exporterTout;
$('import-tout').onclick=()=>{if(view!=='mj')return;$('import-fichier').click()};
$('import-fichier').onchange=()=>{const f=$('import-fichier').files[0];$('import-fichier').value='';if(f)importerTout(f)};
/* L'état de la sauvegarde a quitté la table pour les Paramètres. Un échec, lui, ne
   doit pas attendre qu'on aille l'y chercher : il passe une fois par le journal. */
let dernierSouci='';
function noterSauvegarde(texte,souci){saveLabel.textContent=texte;
 saveLabel.classList.toggle('form-error',!!souci);
 if(souci&&texte!==dernierSouci){dernierSouci=texte;log(texte,{local:true})}
 if(!souci)dernierSouci=''}
function saveNow(){if(!db){noterSauvegarde('Sauvegarde locale indisponible : cette session ne sera pas conservée.',true);return}try{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(snapshot(),'session');tx.oncomplete=()=>noterSauvegarde('Enregistré sur cet appareil · pas de synchronisation multijoueur');tx.onerror=()=>noterSauvegarde('Échec de sauvegarde (stockage plein ou bloqué). La session reste ouverte.',true)}catch(e){noterSauvegarde('Impossible d’enregistrer : '+e.message,true)}}
document.addEventListener('change',scheduleSave);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!loading)saveNow()});
/* Safari iOS laisse parfois une ouverture d'IndexedDB sans réponse. On réessaie une fois,
   puis la scène s'ouvre quand même ; si la sauvegarde répond plus tard, elle se pose
   (sauf chez un invité en table, dont la partie vient du MJ). Une sauvegarde illisible
   ne bloque plus rien : elle se dit au journal. */
let sessionRepondue=false;
function loadSession(){
 const poser=s=>{try{if(verifieSauvegarde(s))return;
   if(!loading){const invite=typeof auth!=='undefined'&&auth&&auth.currentUser&&auth.currentUser.isAnonymous;if(invite)return}
   appliquerSauvegarde(s);
   if(!loading){if(typeof refreshMapPick==='function')refreshMapPick();renderCatalogPages();render();
    if(typeof reappliquerTable==='function')reappliquerTable()}}
  catch(e){noterSauvegarde('Partie enregistrée illisible : '+e.message,true)}};
 const ouvrir=()=>{try{const req=indexedDB.open('amertume_online_v007',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');
   req.onerror=()=>{sessionRepondue=true;finish()};req.onblocked=()=>finish();
   req.onsuccess=()=>{if(sessionRepondue){req.result.close();return}sessionRepondue=true;db=req.result;
    const get=db.transaction('state').objectStore('state').get('session');get.onerror=finish;
    get.onsuccess=()=>{poser(get.result);finish()}}}
  catch(e){sessionRepondue=true;finish()}};
 ouvrir();
 setTimeout(()=>{if(!sessionRepondue)ouvrir()},3000);
 setTimeout(()=>{if(loading){noterSauvegarde('La partie enregistrée ne répond pas : la scène s’ouvre sans elle, elle se posera si l’appareil finit par la lire.',true);finish()}},8000)}
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
}catch(e){if(imgDialog.open)$('image-error').textContent=e.message;else log(e.message,{local:true})}}
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
$('mapfile').onchange=()=>{const file=$('mapfile').files[0];$('mapfile').value='';if(file)openImage(file,'map',url=>{mapImage=url;$('map-view').style.backgroundImage='url("'+url+'")';$('map').classList.add('custom');log('Carte optimisée et importée.',{local:true});document.dispatchEvent(new Event('amertume-content-changed'))})};
loadSession();
