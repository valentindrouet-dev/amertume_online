/* v0.924 — L'onglet Règles. Tout ce qui vit dans le moteur s'y lit à chaque ouverture : les dés et leurs couleurs, les états et ce
   qu'ils font, les espèces et leurs bonus, les compétences, les classes, les types d'adversaires, les raretés. Le reste est écrit
   ici, à la main, et se met à jour avec chaque règle qui change. */
const reglesPage=document.createElement('main');reglesPage.id='regles-page';document.body.append(reglesPage);
// Un élément, sa classe, ses enfants : du texte, des nœuds, ou du HTML marqué par « { html } ».
function rgEl(tag,cls,...kids){const e=document.createElement(tag);if(cls)e.className=cls;
 kids.flat().forEach(k=>{if(k===null||k===undefined||k===false)return;if(typeof k==='object'&&!(k instanceof Node)&&'html' in k){const t=document.createElement('template');t.innerHTML=k.html;e.append(t.content)}else e.append(k)});return e}
const rgHtml=html=>({html});
// Un dé, à la couleur du jeu : sa face, ou son nom en bulle.
function rgDe(c,v){const s=document.createElement('span');s.className='j-de rg-de'+(typeof DARK_DIE!=='undefined'&&DARK_DIE.includes(c)?' dark':'');
 s.style.setProperty('--die',(typeof colors!=='undefined'&&colors[c])||'#ccc');s.textContent=v===undefined?'':v;s.title=(typeof types!=='undefined'&&types[c])||'';return s}
// Une carte teintée : un titre, un glyphe, et ce qu'elle explique.
function rgCarte(teinte,titre,...kids){const c=rgEl('div','rg-carte',titre?rgEl('h4','rg-carte-titre',titre):null,...kids);if(teinte)c.style.setProperty('--teinte',teinte);return c}
// Une ligne de calcul : des morceaux posés côte à côte, les dés en dés, les opérateurs en gros.
function rgCalcul(...morceaux){return rgEl('div','rg-calcul',...morceaux.map(m=>typeof m==='string'&&/^[+−×=÷→]$/.test(m)?rgEl('span','rg-op',m):typeof m==='string'?rgEl('span','rg-terme',m):m))}
function rgListe(items){return rgEl('ul','rg-liste',...items.map(x=>rgEl('li','',typeof x==='string'?rgHtml(x):x)))}
function rgSection(id,titre,teinte,glyphe,intro,...kids){const s=rgEl('section','rg-section');s.id='rg-'+id;s.dataset.titre=titre;s.style.setProperty('--teinte',teinte);
 s.append(rgEl('h2','rg-titre',rgEl('span','rg-glyphe',glyphe),titre));if(intro)s.append(rgEl('p','rg-intro',rgHtml(intro)));s.append(...kids);return s}
// Ce qu'un état fait, tel que la table le dit à son survol : un combattant fictif qui le porte une fois.
function rgEtatTexte(etat){if(typeof descriptionEtat!=='function')return '';try{return descriptionEtat({id:'',name:'',states:[etat],cumuls:{[etat]:1},bleed:1},etat)||''}catch(e){return ''}}
function rgEtats(){const l=(typeof STATES!=='undefined'?STATES:[]).filter(e=>e!=='Aucun');
 return rgEl('div','rg-etats',...l.map(e=>{const im=typeof imageEtat==='function'?imageEtat(e):null,teinte=(typeof COULEURS_ETATS!=='undefined'&&COULEURS_ETATS[e])||'#a2691f';
  const c=rgEl('div','rg-etat',rgEl('div','rg-etat-tete',im?rgEl('span','rg-etat-ic',im):null,rgEl('b','',e),
   typeof cumulable==='function'&&cumulable(e)?rgEl('span','rg-badge','cumulable'):null),rgEl('p','',rgHtml(REGLES_ETATS[e]||rgEtatTexte(e)||'—')));c.style.setProperty('--teinte',teinte);return c}))}
function rgEspeces(){const l=typeof ESPECES!=='undefined'?ESPECES:[];
 return rgEl('div','rg-especes',...l.map(e=>{const c=rgEl('div','rg-espece',rgEl('h4','',e.nom),
   e.description?rgEl('p','rg-espece-desc',e.description):null,typeof bonusEspeceEl==='function'?bonusEspeceEl(e):null,
   rgTalentsEspece(e));c.style.setProperty('--teinte',e.teinte||'#8a8474');return c}))}
function rgTalentsEspece(e){const l=(typeof catalog!=='undefined'&&Array.isArray(catalog.talents)?catalog.talents:[]).filter(t=>t&&t.espece===e.id&&(t.famille==='Espèces'||(typeof talentFamily==='function'&&talentFamily(t)==='Espèces')));
 if(!l.length)return null;const noms={act:'Action',abon:'Action bonus',mvt:'Mouvement',reac:'Réaction',pass:'Passif',mait:'Maîtrise'};
 return rgEl('ul','rg-talents',...l.map(t=>rgEl('li','t-'+(t.type||'pass'),rgEl('b','',t.name),rgEl('span','rg-type',noms[t.type]||'Passif'),rgEl('span','',' '+(t.effects||'')))))}
function rgCompetences(){const l=typeof COMPETENCES!=='undefined'?COMPETENCES:[];return rgEl('div','rg-puces',...l.map(n=>rgEl('span','rg-puce',n)))}
function rgClasses(){const l=(typeof catalog!=='undefined'&&Array.isArray(catalog.classes)?catalog.classes:[]).filter(k=>k&&k.name);
 if(!l.length)return rgEl('p','rg-note','Aucune classe au catalogue.');
 return rgEl('div','rg-classes',...l.map(k=>{const comps=(typeof COMPETENCES_CLASSE!=='undefined'&&COMPETENCES_CLASSE[k.name])||k.comps||[];
  const c=rgEl('div','rg-classe',rgEl('h4','',k.name),rgEl('p','',(k.pv?'PV de départ '+k.pv+'. ':'')+(comps.length?'Compétences : '+comps.join(', ')+'.':'')));c.style.setProperty('--teinte',k.tint||'#8a8474');return c}))}
function rgDes(){const l=typeof types!=='undefined'?types:[];return rgEl('div','rg-des',...l.map((n,c)=>rgEl('div','rg-de-ligne',rgDe(c,6),rgEl('div','',rgEl('b','',n),rgEl('p','',rgHtml(REGLES_DES[c]||''))))))}
function rgSommaire(sections){return rgEl('nav','rg-sommaire',rgEl('p','rg-sommaire-titre','Sommaire'),...sections.map(s=>{const a=document.createElement('a');a.href='#'+s.id;a.textContent=s.dataset.titre;
 a.style.setProperty('--teinte',s.style.getPropertyValue('--teinte'));a.onclick=e=>{e.preventDefault();s.scrollIntoView({behavior:'smooth',block:'start'})};return a}))}
// Le texte écrit à la main, section par section (regles-texte en bas de ce fichier).
const REGLES_DES={},REGLES_ETATS={};
/* v0.927 — Les noms d'états, en gras et à la couleur de leur icône, comme partout sur le site (TEINTE_ETAT_MOT). « Vie » reste la
   caractéristique. */
function rgColoreEtats(racine){if(typeof TEINTE_ETAT_MOT==='undefined')return;const noms=Object.keys(TEINTE_ETAT_MOT).filter(e=>e!=='Vie').sort((x,y)=>y.length-x.length);
 const rx=new RegExp('(^|[^\\p{L}])('+noms.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?![\\p{L}])','gu');
 const w=document.createTreeWalker(racine,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement&&n.parentElement.closest('.rg-sommaire,h1,h2,h3')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 const textes=[];while(w.nextNode())textes.push(w.currentNode);
 textes.forEach(t=>{const v=t.nodeValue;rx.lastIndex=0;if(!rx.test(v))return;rx.lastIndex=0;const f=document.createDocumentFragment();let fin=0,m;
  while((m=rx.exec(v))){const debut=m.index+m[1].length;f.append(v.slice(fin,debut));const b=document.createElement('b');b.textContent=m[2];b.style.color=TEINTE_ETAT_MOT[m[2]];f.append(b);fin=debut+m[2].length}
  f.append(v.slice(fin));t.replaceWith(f)})}
function renderRegles(){const p=reglesPage;p.replaceChildren();
 const sections=REGLES_SECTIONS.map(f=>f()).filter(Boolean);
 p.append(rgEl('header','rg-entete',rgEl('h1','','Règles d’Amertüme'),rgEl('p','rg-version','Version '+(typeof IMG_V!=='undefined'?IMG_V:'')+' · tirées du moteur du jeu')),
  rgEl('div','rg-corps',rgSommaire(sections),rgEl('div','rg-contenu',...sections)));rgColoreEtats(p)}
const REGLES_SECTIONS=[];
/* ———— Le texte des règles. À chaque règle qui change dans le moteur, la phrase qui la dit change ici, dans la même version. ———— */
Object.assign(REGLES_DES,{
 0:'Aucun effet particulier. Il passe la DEF si sa face la dépasse.',
 1:'Retiré avant tout calcul si sa face est celle d’un autre dé lancé : il ne compte alors ni pour l’échec, ni pour le critique, ni pour les dégâts.',
 2:'Passe <b>toujours</b> la DEF, sauf contre Solidité.',
 3:'Sa valeur <b>double</b> si un autre dé gardé montre la même face (les dés de Plasma comptent).',
 4:'Ne frappe jamais : il sert aux <b>soins</b> (Vie, potions, repos…).',
 5:'Passe <b>toujours</b> la DEF, même sous Solidité. Ses 1 ne comptent pas pour l’échec.',
 6:'Sa valeur est multipliée par le numéro du tour, <b>×3 au plus</b>.',
 7:'Passe la DEF si sa face la dépasse, et inflige alors <b>Poison</b> de la valeur de sa face à la cible, en plus de ses dégâts.',
 8:'Lancé à chaque attaque d’un porteur de Faille : <b>tous les dés tombés sur sa face</b> sortent du compte. Il ne blesse jamais.'});
// Les états qui se cumulent se disent avec « n », le nombre de crans ; ceux que le survol ne décrit pas ont leur phrase.
Object.assign(REGLES_ETATS,{
 'Feu':'À chaque nouveau tour, subit <b>n dés noirs</b> de dégâts, sans DEF. Le Gel l’éteint.',
 'Foudre':'À chacun de ses déplacements, <b>1 dé bleu</b> de dégâts et Foudre à chaque combattant dont il traverse la zone de contact, alliés compris, sauf mur. Perd 1 cran par tour.',
 'Furie':'<b>+n</b> aux dégâts de ses coups.',
 'Rage':'<b>+n</b> aux dégâts de ses attaques au contact.',
 'Gel':'Mouvement <b>−n m</b> ; aucune attaque d’opportunité. Immobile si son mouvement tombe à 0. Le Feu l’éteint ; il tombe à la fin du combat.',
 'Poison':'Après chacune de ses Actions, subit <b>n</b> dégâts, sans dé ni DEF.',
 'Saignée':'Chaque coup qui le touche lui inflige <b>n</b> dégâts de plus.',
 'Corruption':'<b>+n</b> aux dégâts de ses coups, et <b>+n</b> aux coups qu’il reçoit. Tombe à la fin du combat.',
 'Gardé':'Sous la garde d’un Gardien : tant qu’il est debout et au contact, le Gardien prend la moitié des coups (tout, avec son amélioration).',
 'Coma':'À 0 PV : hors jeu. Un aventurier y perd 1 VIE ; il revient à lui à la fin du combat.',
 'Ciblage':'Un repère posé sur la cible : aucun effet automatique.',
 'Charme':'N’attaque pas celui qui l’a charmé. Tombe à la fin du combat.',
 'Tangible':'Les coups le blessent, même s’il est <b>Intangible</b>. Posé par l’Eau de brume et le Sel bleu, pour 2 tours.',
 'Immobilisé':'En combat, <b>ne se déplace plus</b>. <b>Se libérer</b> : 1 PM, test de <b>Force 1</b>. Une attaque, un talent, un piège ou un coffre peuvent l’infliger ; Enracinée le pose sur la créature qui s’enracine ; Enraciné le donne en permanence à son porteur, qui ne peut s’en libérer.',
 'Entravé':'Ne peut pas quitter le contact de celui qui l’enlace ou l’agrippe (Agripper : une Action, 1 Attaque au contact). <b>Se libérer</b> : 1 PM, test de <b>Force</b> (réussites selon le talent). Tombe si celui qui l’enlace meurt.'});
const RG={act:'#4f7fb5',mvt:'#8a6440',reac:'#8b6bb5',pass:'#8a8474',crit:'#b5525a',ame:'#5e9a5b',mait:'#c99a3c',bonus:'#2a9d8f',accent:'#9c631c',vert:'#3d7a5b',rouge:'#a4442f'};
const rgN=(v,d)=>typeof v!=='undefined'?v:d;
REGLES_SECTIONS.push(
 // 1. L'essentiel.
 ()=>rgSection('bases','L’essentiel',RG.accent,'📜','Amertüme se joue sur une carte, au tour par tour en combat et librement en exploration. Chaque combattant a des <b>points</b> à dépenser à chaque tour, lance des <b>dés de couleur</b> pour frapper, et encaisse ce qui passe sa <b>DEF</b>.',
  rgEl('div','rg-grille',
   rgCarte(RG.act,'Points d’Action',rgEl('p','',rgHtml('Attaquer, jouer un talent d’Action, faire un test en combat. <b>1</b> par tour par défaut, <b>'+rgN(typeof POINTS_MAX!=='undefined'&&POINTS_MAX.action,4)+'</b> au plus.'))),
   rgCarte(RG.mvt,'Points de Mouvement',rgEl('p','',rgHtml('Un point achète <b>'+rgN(typeof DISTANCE_MOUVEMENT!=='undefined'&&DISTANCE_MOUVEMENT,9)+' m</b> (ou la Vitesse de l’espèce). <b>'+rgN(typeof POINTS_MAX!=='undefined'&&POINTS_MAX.mouvement,3)+'</b> au plus.'))),
   rgCarte(RG.pass,'Le mètre',rgEl('p','',rgHtml('<b>1 m</b> = le diamètre d’un socle moyen, de centre à centre. Socles : Petit ×0,7, Moyen ×1, Grand ×1,5, Énorme ×2.'))),
   rgCarte(RG.rouge,'La zone de contact',rgEl('p','',rgHtml('Un disque de <b>1,5 socle</b> autour du combattant : on y frappe au contact, on y subit l’opportunité en le quittant.'))))),
 // 2. Les dés.
 ()=>rgSection('des','Les dés',RG.act,'🎲','Tous les dés sont des d6. Leur <b>couleur</b> dit ce qu’ils font. Une arme compte au plus <b>12 dés</b> de chaque couleur.',rgDes()),
 // 3. L'attaque.
 ()=>rgSection('attaque','Résoudre une attaque',RG.rouge,'⚔','On lance la réserve de l’arme, puis on lit les dés dans cet ordre.',
  rgEl('div','rg-grille',
   rgCarte(RG.pass,'1. Les dés Légers doublés',rgEl('p','','Un dé Léger qui a la face d’un autre dé s’en va.')),
   rgCarte(RG.rouge,'2. Échec',rgEl('p','',rgHtml('<b>Deux 1</b> ou plus (hors dés Mortels) : <b>échec</b>, rien ne porte.')),rgCalcul(rgDe(0,1),rgDe(2,1),'→','Échec')),
   rgCarte(RG.mait,'3. Critique',rgEl('p','',rgHtml('<b>Deux 6</b> ou plus : <b>critique</b>. On ajoute un dé de la première couleur de la réserve, et encore un tant qu’il fait 6.')),rgCalcul(rgDe(2,6),rgDe(0,6),'+',rgDe(2),'→','Critique')),
   rgCarte(RG.crit,'4. Faille',rgEl('p','','Si l’attaquant porte Faille, le dé rose écarte tous les dés de sa face.')),
   rgCarte(RG.pass,'5. DEF',rgEl('p','',rgHtml('Un dé ne compte que si sa face <b>dépasse la DEF</b> (0 à '+rgN(typeof DEF_MAX!=='undefined'&&DEF_MAX,6)+'). Le Lourd et le Mortel passent toujours, sauf sous <b>Solidité</b> (le Lourd ; le Mortel aussi, améliorée). À DEF 6, seuls eux passent.'))),
   rgCarte(RG.vert,'6. Total',rgEl('p','',rgHtml('Somme des dés qui passent (Mystique doublé, Phase multiplié). Si <b>au moins un dé passe</b>, on ajoute le <b>bonus de Dégâts</b> et la <b>Saignée</b> de la cible.')))),
  rgEl('h3','','Exemple'),
  rgCalcul(rgDe(0,5),rgDe(2,2),rgDe(3,4),rgDe(3,4),'→','DEF 3'),
  rgCalcul('5','+','2 (Lourd)','+','8 (Mystiques doublés)','+','Dégâts +2','=','17'),
  rgEl('p','rg-note','Le Lourd passe malgré sa face de 2 ; les deux Mystiques montrent la même face et doublent.'),
  rgEl('h3','','Après les dés'),
  rgListe(['<b>Portée</b> : au contact, la cible est dans la zone de contact, sans mur. À distance, il faut une ligne de vue ; les murs et les combattants de l’autre camp la coupent ; aucune portée maximale. Un talent à rayon, comme Hurlement, ne touche que ceux qu’aucun mur, porte fermée ni blocage ne sépare du porteur.',
   '<b>Ajouts</b> si le coup porte : Corruption (crans des deux), Maléfice +1d6, Dominateur, Assaut Sauvage, Plasma.',
   '<b>Péril</b> : sous son seuil de PV, les dégâts doublent ou sont divisés par deux.',
   '<b>Ordre d’encaissement</b> : Blindage (tout le coup) → Gardien, Rempart, Garde rapprochée → Armure → PV.',
   '<b>États de l’arme</b> : ils ne se posent que si des PV sont partis et que la cible est encore debout.',
   '<b>Débordement</b> : l’excédent sur une cible tombée frappe le prochain adversaire à portée.',
   '<b>Coût</b> : 1 PA ; une munition par tir.'])),
 // 4. Les dégâts.
 ()=>rgSection('degats','Dégâts et défense',RG.crit,'💥','Le bonus de Dégâts s’ajoute à chaque coup qui porte.',
  rgCalcul('Dégâts de la fiche','+','talents et équipement','+','Furie','+','Rage (contact)','=','bonus'),
  rgListe(['<b>Affaibli</b> : aucun bonus de Dégâts.','<b>Meute</b> : le bonus double.','<b>DEF</b> d’un aventurier : la somme des DEF de ses armures et de son bouclier. <b>Au sol</b> : DEF 0 contre les coups.',
   '<b>Opportunité</b> : quitter la zone de contact d’un adversaire fait subir ses Dégâts, sans dé ni DEF, une fois par adversaire et par tour. Tirer au contact aussi. Un adversaire Gelé, Au sol ou à 0 Dégâts n’en fait pas.'])),
 // 5. Tests.
 ()=>rgSection('tests','Tests de compétence',RG.vert,'🎯','On lance <b>autant de dés que la valeur</b> de la compétence. <b>Chaque 4+ est une réussite</b> ; <b>chaque 6</b> fait lancer un dé de plus.',
  rgCalcul('Valeur','=','1','+','points','+','classe','+','espèce','+','talents et objets'),
  rgCalcul(rgDe(0,6),rgDe(0,4),rgDe(0,2),'+',rgDe(0,5),'→','3 réussites'),
  rgCompetences(),
  rgListe(['<b>Perception</b> : fouiller, détecter un piège, un coffre caché, un passage secret.','<b>Ruse</b> : crocheter, déverrouiller, désamorcer, devenir discret.','<b>Technique</b> : déverrouiller un coffre, désamorcer.',
   '<b>Force</b> : désamorcer un piège. <b>Agilité</b> : éviter ou enjamber un piège.','<b>Savoir</b> : Analyser un adversaire.','<b>Mysticisme</b>, <b>Robustesse</b> : tests du MJ.',
   'En combat, un test coûte <b>1 Action</b>. Hors combat, on ne refait pas le même test au même endroit.'])),
 // 6. Le tour de combat.
 ()=>rgSection('combat','Le tour de combat',RG.act,'⏳','Le combat commence quand la troupe voit un adversaire, ou à la main du MJ, et finit quand plus aucun adversaire n’est debout.',
  (()=>{const t=rgEl('table','rg-table');t.innerHTML='<tr><th>Geste</th><th>Coût</th></tr>'+[['Attaque','1 PA'],['Talent d’Action','1 PA (0 s’il est gratuit)'],['Talent de Mouvement','1 PM'],['Test de compétence','1 PA'],['Ouvrir un coffre','1 PA'],['Ouvrir ou fermer une porte','Action bonus, 1 fois par tour'],['Analyser','1 PM'],['Se relever','1 PM'],['Se réveiller','1 PA'],['Échanger un objet, changer d’armes','1 PM'],['Poser une lumière','1 PM']].map(([g,c])=>'<tr><td>'+g+'</td><td><b>'+c+'</b></td></tr>').join('');return t})(),
  rgListe(['Le combat vaut pour <b>toute la table</b> : dès qu’un adversaire révélé est debout, il commence pour tous ; hors combat, une attaque ou un talent offensif contre lui le déclenche d’abord. Il finit pour tous quand le dernier tombe.',
   'Un talent ne se joue qu’<b>une fois par tour</b>, même gratuit (sauf les Orbes).','Les <b>actions bonus</b> (talents d’Action gratuits) ont leur rond turquoise.',
   '<b>Mouvement</b> : fractionnable dans le tour. <b>Terrain difficile</b> : chaque mètre en coûte deux. <b>Impraticable</b> : bloque comme un mur.',
   '<b>Ajustement</b> : mouvement épuisé, on bouge encore sans sortir de la zone de contact où l’on s’est arrêté.',
   '<b>Tour suivant</b> : le Feu brûle, la Foudre perd un cran, Surpris tombe, les points et les talents joués reviennent.',
   '<b>Début</b> : les états de chacun sont levés (sauf ceux d’un piège récent). Les talents de début de combat se jouent quand on veut pendant le premier tour des aventuriers, ceux de début de tour pendant chaque tour : ils se ferment dès qu’un adversaire dépense un PA ou un PM. Un bouton au-dessus du token les rappelle.',
   '<b>Muraille</b> : Immobilisé et DEF +1 jusqu’à la fin du tour, où Immobilisé tombe tout seul. <b>Meneur</b> peut donner « + Niveau » : le niveau du porteur.',
   '<b>Intervention</b> : seulement pour l’allié Gardé du porteur.',
   '<b>Carte PvP</b> : chaque aventurier y est neutre, ennemi de tous — des autres aventuriers comme des adversaires, qui peuvent attaquer n’importe lequel ; aucune XP n’y est gagnée.',
   '<b>Inspiration</b> (Mystique, Action, en combat) : test de Mysticisme ; un Orbe de plus ce tour par réussite — non lancé, il se perd à la fin du tour, sauf Thésaurisation. Améliorée : Action bonus ; +1 réussite automatique ; Rage 1 par réussite.',
   '<b>Main Secourable</b> (Action bonus) : un allié au contact du porteur et d’un adversaire passe derrière le porteur, sans dégâts d’opportunité.',
   '<b>Carapace</b> : chaque combat commence avec Endurance × Armure (× 2, améliorée) ; l’allié Gardé peut la recevoir aussi.',
   '<b>Mouvement forcé</b> (Provocation…) : jamais plus loin que le mouvement du provoqué, ses PM compris ; trop loin, il fait ce mouvement vers le porteur, puis s’arrête. Immobilisé, il ne bouge pas.',
   '<b>Fin</b> : tous les états tombent (sauf Coma et ceux d’une pièce portée), l’Armure aussi ; le repos court redevient possible.'])),
 // 7. Les états.
 ()=>rgSection('etats','Les états',RG.reac,'✦','<b>n</b> est le nombre de crans d’un état <b>cumulable</b> : chaque nouvelle fois en ajoute un. Les autres se posent une fois. L’<b>Onde</b> absorbe le prochain état ; <b>Feu et Gel</b> s’annulent.',
  rgEtats(),
  rgEl('div','rg-grille',
   // v1.099 : l'Armure avec son icône, celle de {armure}.
   (c=>{const h=c.querySelector('.rg-carte-titre'),ic=typeof iconeArmure==='function'?iconeArmure():null;if(h&&ic){ic.classList.add('rg-armure-ic');h.prepend(ic,' ')}return c})(rgCarte(RG.pass,'Armure',rgEl('p','','Des points pris après le Blindage et avant les PV. Tombe à la fin du combat.'))),
   rgCarte(RG.mait,'Radiance',rgEl('p','','Le surplus d’un soin radiant monte les PV max. Perdue à la Nécrose, au Poison et au repos.')))),
 // 8. Les aventuriers.
 ()=>rgSection('aventuriers','Les aventuriers',RG.vert,'🧝','Un aventurier a sa VIE, son Endurance, ses Dégâts, ses PV et ses compétences.',
  rgCalcul('PV max','=','VIE','×','Endurance','+','PV de classe','+','bonus','−','Nécrose','+','Radiance'),
  rgEl('div','rg-grille',
   rgCarte(RG.act,'Création',rgListe(['Identité, Espèce, Classe, Caractéristiques, Compétences, Équipement, Illustration, Récapitulatif.','<b>3 points</b> : +2 Endurance, +1 VIE ou +1 Dégâts chacun.','<b>3 points</b> de compétence, +2 au plus dans une même.','Départ : VIE 3, Endurance 2, 100 XP, 10 Rations, 10d6 or.'])),
   rgCarte(RG.rouge,'Coma et mort',rgListe(['À 0 PV : <b>Coma</b>. En combat, l’aventurier perd <b>1 VIE</b> pour de bon.','<b>VIE à 0</b> : mort ; seul le MJ ressuscite.','Fin du combat : le comateux revient avec <b>1d6 + Endurance</b> PV, au prix d’un repos court.','À 0 PV sous Nécrose : mort.'])),
   rgCarte(RG.vert,'Repos court',rgListe(['<b>1d6 + Endurance</b> PV.','Lève les états (sauf Blindage), la Nécrose ; la Radiance se perd.','Rend les charges « par repos court ».','Autant que son <b>Niveau</b>, un seul entre deux combats.'])),
   rgCarte(RG.mait,'Repos long',rgListe(['Par le MJ, hors combat.','VIE et PV au maximum, repos courts et charges rendus, états et Nécrose levés.'])),
   rgCarte(RG.accent,'XP et niveau',rgListe(['Chaque aventurier présent gagne l’<b>XP entière</b> d’un adversaire vaincu.','Tous les <b>100 XP</b> gagnés valent une <b>Marque</b> : ce sont les Marques qui paient les talents et les améliorations (de 1 à x Marques chacun). Un talent rendu rend ses Marques — hors combat, après un repos court.',(()=>{const s=typeof seuilsXp==='function'?seuilsXp():typeof NIVEAUX_XP!=='undefined'?NIVEAUX_XP:[],m=s.slice(1).map((v,i)=>v-s[i]),fr=n=>n.toLocaleString('fr-FR');
    return 'L’XP repart de <b>0 à chaque niveau</b> ; chacun demande la sienne : '+m.slice(0,6).map(fr).join(', ')+'… jusqu’à '+fr(m[m.length-1]||0)+' pour le niveau '+s.length+' ('+fr(s[s.length-1]||0)+' XP en tout).'})()])))),
 // 9. Les espèces.
 ()=>rgSection('especes','Les espèces',RG.mait,'🧬','Chaque espèce donne ses bonus pour toujours, sa Vitesse, et ses Talents d’Espèce.',rgEspeces()),
 // 10. Les classes.
 ()=>rgSection('classes','Les classes',RG.accent,'🛡','Chaque classe donne ses PV de départ, +1 à trois compétences, et son arbre de talents.',rgClasses()),
 // 11. Les talents.
 ()=>rgSection('talents','Les talents',RG.ame,'🌿','Les talents s’achètent en Marques (1 Marque par 100 XP gagnés) dans l’arbre de sa classe, palier par palier : chaque niveau de palier a son talent initial au centre ; les talents qui l’entourent s’ouvrent une fois ce centre acquis, et le centre d’un palier une fois celui du palier précédent acquis, au niveau voulu. Une amélioration exige son talent de base.',
  rgEl('div','rg-puces',...[['Maîtrise','mait'],['Action','act'],['Action bonus','bonus'],['Mouvement','mvt'],['Réaction','reac'],['Passif','pass'],['Critique','crit'],['Amélioration','ame']].map(([n,k])=>{const s=rgEl('span','rg-puce',n);s.style.setProperty('--teinte',RG[k]);return s})),
  rgListe(['<b>Action</b> : 1 PA. <b>Action bonus</b> : aucun coût, une fois par tour chacune ; on peut en jouer plusieurs. Certaines ne reviennent qu’au combat suivant ou après un repos court ou long : leur limite s’écrit sous leur nom. <b>Mouvement</b> : 1 PM. Le MJ peut régler le coût de 0 à 9.','<b>Réaction</b> : une fenêtre <b>Activer / Laisser</b> de 10 s s’ouvre quand elle se déclenche.',
   'Une fois par tour en combat ; certaines, une fois entre deux repos courts ou une fois par combat.','<b>À 50% des PV</b> : un talent qui porte ce déclencheur, écrit sous son nom, ne joue que lorsque son porteur est à la moitié de ses PV ou moins.','Les bonus ajoutent PV, Endurance, VIE, DEF, Dégâts, un orbe, des mètres à chaque mouvement, de l’Armure ou un état au début de chaque combat (un état qui se cumule, autant de crans), ou une compétence. Ils ne s’obtiennent plus dans les arbres de talents : ils s’infusent dans le seul <b>sphérier</b> de la classe (onglet Bonus de l’arbre), payés en <b>gemmes</b> de la bourse de l’aventurier. Chaque caractéristique, chaque compétence a sa variété (Citrine, Émeraude, Saphir, Rubis, Diamant), chaque bonus son prix, fixé par le MJ : tant de Brisures, d’Éclats ou de Brômes ; un bonus de PA ou de PM peut demander plusieurs gemmes de couleurs différentes. Un clic marque un bonus de départ, puis tout bonus relié à un bonus tenu ou marqué ; <b>Infuser les Sphères</b> les apprend tous et consomme les gemmes : on ne revient plus en arrière.','Un <b>métier</b> choisi sur la fiche — Alchimiste, Forgeron, Tanneur, Mineur, Herboriste, Arcaniste… —, a son propre arbre, aux mêmes paliers que celui de la classe : son talent initial est tenu d’office, les autres s’achètent en XP.','L’arbre se range en paliers <b>Niveau 1, 5, 10, 20 et 40</b> : un talent s’ouvre quand l’aventurier atteint le niveau de son groupe.'])),
 // 11 bis. Les gemmes gagnées en jouant (gemmes.js : ce que lit le moteur, tel que le MJ l'a réglé).
 ()=>{const R=typeof reglesGemmes==='function'?reglesGemmes():null,D=typeof DECLENCHEURS_GEMMES!=='undefined'?DECLENCHEURS_GEMMES:[],N=typeof NOM_COULEUR_GEMME!=='undefined'?NOM_COULEUR_GEMME:{};
  const parCouleur=c=>'<b>'+(N[c]||c)+'</b> — '+D.filter(d=>R&&R.declencheurs[d.cle].actif&&R.declencheurs[d.cle].couleur===c).map(d=>d.nom.toLowerCase()+' ('+R.declencheurs[d.cle].seuil+'+)').join(' ; ')+'.';
  return rgSection('gemmes','Les gemmes',RG.ame,'💎','Chaque aventurier a sa bourse de gemmes, que ses actions remplissent : à chaque action réussie liée à une couleur, il lance un dé de gemme : sur le seuil du déclencheur ou plus (entre parenthèses), il gagne une Brisure de la couleur, jamais plus d’une. Les gemmes paient les bonus du sphérier.',
   rgListe([...(R?['Un seul dé par déclencheur : sur son seuil (entre parenthèses) ou plus, une Brisure ; une <b>même action</b> ne donne qu’une gemme de chaque couleur, même si plusieurs déclencheurs réussissent. En combat, au plus <b>'+R.plafond+' Brisures</b> de chaque couleur par combat ; hors combat, chaque déclencheur ne joue qu’une fois par zone de la carte.',
    'Un <b>boss vaincu</b> : '+(R.boss.n?R.boss.n+' '+(TAILLES_GEMMES.find(([k])=>k===R.boss.taille)||[])[R.boss.n>1?1:2]+' de la couleur la plus déclenchée pendant le combat, à chacun.':'rien.'),
    'Fusion : '+R.fusion.eclat+' Brisures font 1 Éclat, '+R.fusion.brome+' Éclats font 1 Brôme (avec l’Arcaniste).',
    // v1.183 : les titres de fin de combat, et la Tour Mystique.
    'Les <b>titres de fin de combat</b> (Stats de Combat) valent chacun 1 Brisure à l’aventurier qui les remporte : '+(typeof TITRES_GEMMES!=='undefined'&&typeof DISTINCTIONS!=='undefined'?TITRES_GEMMES.filter(([k])=>R.titres[k].actif).map(([k])=>{const d=DISTINCTIONS.find(x=>x[0]===k);return (d?d[2]:k)+' ('+(N[R.titres[k].couleur]||'')+')'}).join(', '):'')+'. L’Intouchable va au moins blessé de la troupe.',
    'La <b>Tour Mystique</b> (bâtiment du Domaine, où vit l’Arcaniste) : achat des sphères ('+R.tour.achat.brisure.citrine+' or la Brisure de citrine, jusqu’à '+R.tour.achat.brome.diamant+' or le Brôme de diamant ; les prix se règlent couleur par couleur), rachat à '+R.tour.vente+' % du prix, fusion aux taux ci-dessus, conversion de '+R.tour.conversion+' sphères d’une couleur en 1 d’une autre à taille égale, et le <b>savoir</b> : '+R.tour.savoir+' or la ligne, qui apprend à la troupe un déclencheur qu’elle ignorait, au hasard — elle n’en connaît aucun au départ.']:[]),
    ...(R?['citrine','emeraude','saphir','rubis','diamant'].map(parCouleur):[]),
    'Les tests de compétence réussis hors combat donnent la couleur de la compétence, un état infligé à un adversaire celle de l’état (tableau des couleurs du MJ). Ce que l’appli ne voit pas — intimider, négocier, escalader, lire un grimoire… —, le MJ le lance depuis la fiche.']))},
 // 12. Les adversaires.
 ()=>rgSection('adversaires','Les adversaires',RG.rouge,'👹','Un adversaire a ses PV, sa DEF, ses Dégâts, ses attaques, sa Vitesse et son XP.',
  rgEl('div','rg-puces',...Object.values(typeof TYPE_NOMS!=='undefined'?TYPE_NOMS:{}).map(n=>rgEl('span','rg-puce',n))),
  rgListe(['<b>Type</b> : il règle l’ordre des cibles (Standard d’abord, Boss en dernier), la Garde rapprochée (Standards) et le butin forgé : 15, 25, 40, 50 % de chances.',
   '<b>Nature</b> : vivant, mort-vivant ou mécanique ; certains talents en dépendent.',
   '<b>Intangible</b> (talent) : spectres, ectoplasmes, arcaniques. Les coups et les sorts ne lui font <b>aucun dégât</b>, à moins qu’il ne soit <b>Tangible</b>, ou que l’Onguent de lest (coups d’arme) ou l’Élixir de seuil (coups et sorts) ne le percent, jusqu’à la fin du combat. Il ne franchit pas un seuil de Sel bleu.',
   '<b>Hors d’atteinte</b> (talent) : comme Intangible, et il refuse aussi tous les états, sauf Tangible. <b>Hantise du sel</b> : un Sel bleu lui fait 2 dés rouges et le rend Tangible jusqu’à la fin du tour suivant. Tangible posé par une attaque (Ancrer) tient jusqu’à la fin du tour ; une attaque qui rend Tangible le blesse elle-même.',
   '<b>Attaques d’adversaire</b> : « (P1) » ou « (P2) » au nom, elle ne sert qu’en phase 1 ou 2 ; « 1 tour sur 2 » ou « 1 fois par combat » au texte, elle attend son tour ; « critique = Au sol », « critique = Gel 1 », un critique pose cet état.',
   '<b>Liens</b> : +1 DEF par chaîne qui n’a pas encore été vaincue dans la campagne ; le Bestiaire garde la mémoire des vaincus, que le MJ efface (↺ Vaincus).',
   '<b>Restes</b> : chaque reste a sa chance de tomber et sa quantité (un nombre, ou des dés), 1 par défaut.','<b>États d’une attaque</b> : un état cumulable (Poison, Feu…) peut se poser en plusieurs crans, un nombre fixe ou tiré aux dés à chaque coup qui porte.','<b>PA et PM</b> : 1 et 1 par tour d’ordinaire ; sa fiche en règle davantage, jusqu’à 4 PA et 3 PM, sans talent.','<b>Esquive x+</b> (aventuriers et adversaires) : à chaque attaque qui le vise, un d6 ; sur <b>x ou plus</b>, il en ignore tout, dégâts et états. Dans la lumière d’une Lanterne de veille, un Intangible n’esquive plus.',
   '<b>Familles</b> : '+(typeof FAMILLES_MONSTRES!=='undefined'?FAMILLES_MONSTRES.map(([,n])=>n).join(', '):'')+' ; chacune a ses sous-familles'+(typeof famillesToutes==='function'?' ('+famillesToutes().filter(f=>f[2]).map(f=>f[1]).join(', ')+')':'')+', et un adversaire d’une sous-famille est aussi de sa famille. Vaincu, un adversaire peut laisser une plante d’Herboristerie de ses familles, chacune à sa chance — une seule au plus par adversaire.','<b>Vision</b> : un adversaire voit dans le noir.',
   '<b>Analyse</b> (1 PM, ligne de vue, une fois par combat et par modèle) : test de Savoir ; chaque réussite révèle une information parmi PV max, DEF, Dégâts, attaques, XP, talents, équipement, et rapporte XP ÷ 10 à chaque aventurier.'])),
 // 13. Les objets.
 ()=>rgSection('objets','Les objets',RG.mait,'🎒','Les objets se portent, s’emploient ou se forgent.',
  rgEl('div','rg-puces',...(typeof RARETES!=='undefined'?RARETES:[]).map(([k,n])=>rgEl('span','rg-puce r-'+k,n))),
  rgListe(['<b>Usages</b> : '+(typeof USAGES_OBJET!=='undefined'?USAGES_OBJET.map(([,n])=>n.split(' — ')[0]).join(', '):'')+'.',
   '<b>Emplacements</b> : 2 mains, '+(typeof EMPLACEMENTS!=='undefined'?EMPLACEMENTS.map(([,n,k])=>n+' '+k).join(', '):'')+'. Un bouclier tient une main ; une arme à distance, deux, sauf réglée à une main (les armes de lancer). Seules les pièces de base, grises, se forgent.',
   'Sans arme : 1 dé Léger + Dégâts, à mains nues.','Un objet forgé a 1 à 4 affixes : Inhabituel, Rare, Épique, Légendaire. Un affixe <b>Anti-famille</b>, sur une arme, ajoute contre les adversaires d’une famille (ou sous-famille) +x dégâts, +xd6, des dés de couleur, ou un état.','Un soin ne se gâche pas : refusé à PV pleins.',
   '<b>Potions</b> : soins, insensibilités, états, Armure ; vision dans le noir jusqu’au prochain repos long ; lumière jusqu’à la fin de la carte ; +PM jusqu’à la fin du combat ; enduits que posent les prochaines attaques ; gaz et explosifs lancés sur la cible, ses voisins ou tous les adversaires ; un aventurier tombé relevé, hors combat ; Nécrose et Corruption purgées ; la troupe à l’abri des bêtes qui surprennent.',
   '<b>Contre les Intangibles</b> : Onguent de lest et Élixir de seuil (qui fait subir +1 dégât de chacun de leurs coups) les rendent vulnérables pour le combat ; Eau de brume et Sel bleu les rendent <b>Tangibles</b> 2 tours ; le Sel bleu, tracé sur un seuil en deux clics (à 3 m au plus), les arrête jusqu’à la fin du combat ; la Lanterne de veille, portée, éclaire à 6 m, y révèle les Invisibles et y ôte l’Esquive des Intangibles. Potion d’Eau du Puits : 2 PV et la Nécrose levée ; Menthe d’Ysaure mâchée : tout le Gel levé.',
   '<b>Objets lancés en zone</b> : au clic, la zone suit le pointeur et se lance jusqu’à 10 m, sans mur entre le lanceur et elle ; elle a la taille d’une zone de contact (socle Petit, Moyen, Grand ou Très grand) et s’arrête aux murs. Ses dés et ses états frappent chaque combattant qu’elle touche, le lanceur excepté ; le Sel de racine y gomme le terrain dangereux coché « Sel », de la taille de la zone.',
   '<b>Objets lancés</b> : certains ne touchent que les créatures végétales ou fongiques ; d’autres épargnent, ou visent seuls, les lieutenants — créatures vivantes organiques, ni plantes, ni champignons, ni mécaniques, ni morts-vivants, qui ne sont pas des boss.',
   '<b>Herboristerie</b> : construite et intacte, elle vend ses ingrédients, enseigne ses recettes contre de l’or — au rang d’herboriste voulu (Novice, Compagnon, Maître, par talent) et dans un laboratoire du niveau voulu (1 à 3) — et fabrique celles qu’on connaît : le sac, puis le coffre de groupe ; Fer, Bois, Argent, Bronze dans la réserve ; les gemmes dans la bourse. Certaines recettes ne s’apprennent que dans un grimoire ; d’autres se fabriquent à la Tannerie, ou en donnent plusieurs. Les recettes cochées « Forge » s’y apprennent et se fabriquent à la Forge du domaine.',
   '<b>Recettes</b> : chaque pièce qui se fabrique (herboristerie, tannerie, forge) a son objet Recette, de la rareté de la pièce : il se trouve, se porte, s’échange, se range au coffre et se vend. Lu par un aventurier du rang d’herboriste voulu, il lui apprend la recette et disparaît.',
   '<b>Coffre de Groupe</b> : au contact, chacun y dépose et y reprend or et objets ; '+(typeof COFFRE_PLACES!=='undefined'?COFFRE_PLACES:50)+' emplacements par onglet, 2 onglets d’office, jusqu’à 10 ('+(typeof PRIX_ONGLETS!=='undefined'?PRIX_ONGLETS.slice(2).join(', '):'')+' or). Son or paie aux magasins ; ses ressources servent aux fabrications, après la réserve du domaine. Deux gestes croisés : ce que le coffre n’avait plus est rendu, un dépôt dans un onglet plein revient au sac, un onglet acheté deux fois est remboursé.'])),
 // 14. L'exploration.
 ()=>rgSection('exploration','L’exploration',RG.pass,'🗺','Hors combat, on se déplace librement, on fouille, on crochète et on évite les pièges.',
  rgListe(['<b>Obscurité</b> : on ne voit que sa zone de contact, plus loin avec la Vision dans le noir ; une zone éclairée se voit de loin.',
   '<b>Objets au sol</b> : visibles seulement dans le champ de vision de la troupe, à l’instant. Un clic au contact prend un exemplaire de chaque pièce ; s’il en reste, l’objet reste au sol.',
   '<b>Fouiller</b> : un test de Perception sur la zone de contact pas encore fouillée révèle objets, coffres, passages et pièges cachés.',
   '<b>Indices</b> : cachés comme des objets, un test les repère. Au contact, un second test, ou l’objet qu’il faut, livre leur secret ; ce test ne se tente qu’une fois pour toute la troupe, et raté, le secret reste caché, sauf si le MJ le révèle ; au survol, un bouton porte l’icône de la compétence ou de la pièce. Une pièce consommable s’use à l’emploi.',
   '<b>Terrain dangereux</b> : ronces, haies vivantes… Chaque type a sa couleur, ses dégâts (fixes ou en d6, sans DEF) et ses états, et frappe les aventuriers, les adversaires ou tous : quand un déplacement le traverse ou s’y arrête, puis, en combat, à chaque fin de tour passée dedans. Une pièce portée à l’effet « Protège des ronces » — les Gants de ronceur — en protège ; le Sel de racine détruit une haie vivante au contact.',
   '<b>Ressources</b> : au contact, hors combat, un clic lance la Récolte, un test de la compétence réglée. N réussites donnent le premier palier ; N+1, le deuxième en plus ; N×2, le troisième en plus. Réussie ou non, la ressource quitte la carte : elle ne se récolte qu’une fois. Chacune a un type ('+(typeof typesRessources==='function'?typesRessources().join(', '):'Filon, Plante, Bête, Mystique')+') ; certains talents y ajoutent des réussites.',
   '<b>Pièges</b> : détecter (Perception ou Ruse), désamorcer (Ruse, Technique ou Force), éviter (Agilité). Le piège d’un coffre ou posé sur la carte peut infliger plusieurs crans d’un état cumulable (Poison, Feu…), un nombre fixe ou tiré aux dés.',
   '<b>Coffres et portes</b> : la clé, ou un test de Ruse ou de Technique. Un coffre peut aussi s’ouvrir d’un code (une case par chiffre) ou d’un mot de passe (ni casse, ni pluriel).',
   '<b>Bruit</b> : un pas s’entend à 5 m (10 m à travers une porte), une attaque au contact à 15 m, un cri à 20 m.',
   '<b>Discrétion</b> : un test de Ruse donne 50 m de pas silencieux pour 1 réussite, 100 m par réussite au-delà de la première.'])));
