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
 7:'Lancé à chaque attaque d’un porteur de Faille : <b>tous les dés tombés sur sa face</b> sortent du compte. Il ne blesse jamais.'});
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
   rgCarte(RG.pass,'5. DEF',rgEl('p','',rgHtml('Un dé ne compte que si sa face <b>dépasse la DEF</b> (0 à '+rgN(typeof DEF_MAX!=='undefined'&&DEF_MAX,6)+'). Le Lourd et le Mortel passent toujours. À DEF 6, seuls eux passent.'))),
   rgCarte(RG.vert,'6. Total',rgEl('p','',rgHtml('Somme des dés qui passent (Mystique doublé, Phase multiplié). Si <b>au moins un dé passe</b>, on ajoute le <b>bonus de Dégâts</b> et la <b>Saignée</b> de la cible.')))),
  rgEl('h3','','Exemple'),
  rgCalcul(rgDe(0,5),rgDe(2,2),rgDe(3,4),rgDe(3,4),'→','DEF 3'),
  rgCalcul('5','+','2 (Lourd)','+','8 (Mystiques doublés)','+','Dégâts +2','=','17'),
  rgEl('p','rg-note','Le Lourd passe malgré sa face de 2 ; les deux Mystiques montrent la même face et doublent.'),
  rgEl('h3','','Après les dés'),
  rgListe(['<b>Portée</b> : au contact, la cible est dans la zone de contact, sans mur. À distance, il faut une ligne de vue ; les murs et les combattants de l’autre camp la coupent ; aucune portée maximale.',
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
  (()=>{const t=rgEl('table','rg-table');t.innerHTML='<tr><th>Geste</th><th>Coût</th></tr>'+[['Attaque','1 PA'],['Talent d’Action','1 PA (0 s’il est gratuit)'],['Talent de Mouvement','1 PM'],['Test de compétence','1 PA'],['Ouvrir un coffre','1 PA'],['Analyser','1 PM'],['Se relever','1 PM'],['Se réveiller','1 PA'],['Échanger un objet, changer d’armes','1 PM'],['Poser une lumière','1 PM']].map(([g,c])=>'<tr><td>'+g+'</td><td><b>'+c+'</b></td></tr>').join('');return t})(),
  rgListe(['Un talent ne se joue qu’<b>une fois par tour</b>, même gratuit (sauf les Orbes).','Les <b>actions bonus</b> (talents d’Action gratuits) ont leur rond turquoise.',
   '<b>Mouvement</b> : fractionnable dans le tour. <b>Terrain difficile</b> : chaque mètre en coûte deux. <b>Impraticable</b> : bloque comme un mur.',
   '<b>Ajustement</b> : mouvement épuisé, on bouge encore sans sortir de la zone de contact où l’on s’est arrêté.',
   '<b>Tour suivant</b> : le Feu brûle, la Foudre perd un cran, Surpris tombe, les points et les talents joués reviennent.',
   '<b>Début</b> : les états de chacun sont levés (sauf ceux d’un piège récent). Au tour 1, les talents de début de combat passent d’abord.',
   '<b>Fin</b> : tous les états tombent (sauf Coma et ceux d’une pièce portée), l’Armure aussi ; le repos court redevient possible.'])),
 // 7. Les états.
 ()=>rgSection('etats','Les états',RG.reac,'✦','<b>n</b> est le nombre de crans d’un état <b>cumulable</b> : chaque nouvelle fois en ajoute un. Les autres se posent une fois. L’<b>Onde</b> absorbe le prochain état ; <b>Feu et Gel</b> s’annulent.',
  rgEtats(),
  rgEl('div','rg-grille',
   rgCarte(RG.pass,'Armure',rgEl('p','','Des points pris après le Blindage et avant les PV. Tombe à la fin du combat.')),
   rgCarte(RG.mait,'Radiance',rgEl('p','','Le surplus d’un soin radiant monte les PV max. Perdue à la Nécrose, au Poison et au repos.')))),
 // 8. Les aventuriers.
 ()=>rgSection('aventuriers','Les aventuriers',RG.vert,'🧝','Un aventurier a sa VIE, son Endurance, ses Dégâts, ses PV et ses compétences.',
  rgCalcul('PV max','=','VIE','×','Endurance','+','PV de classe','+','bonus','−','Nécrose','+','Radiance'),
  rgEl('div','rg-grille',
   rgCarte(RG.act,'Création',rgListe(['Identité, Espèce, Classe, Caractéristiques, Compétences, Équipement, Illustration, Récapitulatif.','<b>3 points</b> : +2 Endurance, +1 VIE ou +1 Dégâts chacun.','<b>3 points</b> de compétence, +2 au plus dans une même.','Départ : VIE 3, Endurance 2, 100 XP, 10 Rations, 10d6 or.'])),
   rgCarte(RG.rouge,'Coma et mort',rgListe(['À 0 PV : <b>Coma</b>. En combat, l’aventurier perd <b>1 VIE</b> pour de bon.','<b>VIE à 0</b> : mort ; seul le MJ ressuscite.','Fin du combat : le comateux revient avec <b>1d6 + Endurance</b> PV, au prix d’un repos court.','À 0 PV sous Nécrose : mort.'])),
   rgCarte(RG.vert,'Repos court',rgListe(['<b>1d6 + Endurance</b> PV.','Lève les états (sauf Blindage), la Nécrose ; la Radiance se perd.','Rend les charges « par repos court ».','Autant que son <b>Niveau</b>, un seul entre deux combats.'])),
   rgCarte(RG.mait,'Repos long',rgListe(['Par le MJ, hors combat.','VIE et PV au maximum, repos courts et charges rendus, états et Nécrose levés.'])),
   rgCarte(RG.accent,'XP et niveau',rgListe(['Chaque aventurier présent gagne l’<b>XP entière</b> d’un adversaire vaincu.','L’XP paie les talents ; dépenser n’abaisse pas le niveau.','Seuils : '+((typeof seuilsXp==='function'?seuilsXp():typeof NIVEAUX_XP!=='undefined'?NIVEAUX_XP:[]).slice(1,8).join(', '))+'…'])))),
 // 9. Les espèces.
 ()=>rgSection('especes','Les espèces',RG.mait,'🧬','Chaque espèce donne ses bonus pour toujours, sa Vitesse, et ses Talents d’Espèce.',rgEspeces()),
 // 10. Les classes.
 ()=>rgSection('classes','Les classes',RG.accent,'🛡','Chaque classe donne ses PV de départ, +1 à trois compétences, et son arbre de talents.',rgClasses()),
 // 11. Les talents.
 ()=>rgSection('talents','Les talents',RG.ame,'🌿','Les talents s’achètent en XP dans l’arbre de sa classe ; une amélioration exige son talent de base.',
  rgEl('div','rg-puces',...[['Maîtrise','mait'],['Action','act'],['Action bonus','bonus'],['Mouvement','mvt'],['Réaction','reac'],['Passif','pass'],['Critique','crit'],['Amélioration','ame']].map(([n,k])=>{const s=rgEl('span','rg-puce',n);s.style.setProperty('--teinte',RG[k]);return s})),
  rgListe(['<b>Action</b> : 1 PA. <b>Action bonus</b> : aucun coût, une fois par tour chacune ; on peut en jouer plusieurs. Certaines ne reviennent qu’au combat suivant ou après un repos court ou long : leur limite s’écrit sous leur nom. <b>Mouvement</b> : 1 PM. Le MJ peut régler le coût de 0 à 9.','<b>Réaction</b> : une fenêtre <b>Activer / Laisser</b> de 10 s s’ouvre quand elle se déclenche.',
   'Une fois par tour en combat ; certaines, une fois entre deux repos courts ou une fois par combat.','Les bonus de l’arbre ajoutent PV, Endurance, VIE, DEF, Dégâts ou une compétence.','L’arbre se range en groupes <b>Niveau 1, 4, 7 et 10</b> : un talent s’ouvre quand l’aventurier atteint le niveau de son groupe.'])),
 // 12. Les adversaires.
 ()=>rgSection('adversaires','Les adversaires',RG.rouge,'👹','Un adversaire a ses PV, sa DEF, ses Dégâts, ses attaques, sa Vitesse et son XP.',
  rgEl('div','rg-puces',...Object.values(typeof TYPE_NOMS!=='undefined'?TYPE_NOMS:{}).map(n=>rgEl('span','rg-puce',n))),
  rgListe(['<b>Type</b> : il règle l’ordre des cibles (Standard d’abord, Boss en dernier), la Garde rapprochée (Standards) et le butin forgé : 15, 25, 40, 50 % de chances.',
   '<b>Nature</b> : vivant, mort-vivant ou mécanique ; certains talents en dépendent.','<b>Vision</b> : un adversaire voit dans le noir.',
   '<b>Analyse</b> (1 PM, ligne de vue, une fois par combat et par modèle) : test de Savoir ; chaque réussite révèle une information parmi PV max, DEF, Dégâts, attaques, XP, talents, équipement, et rapporte XP ÷ 10 à chaque aventurier.'])),
 // 13. Les objets.
 ()=>rgSection('objets','Les objets',RG.mait,'🎒','Les objets se portent, s’emploient ou se forgent.',
  rgEl('div','rg-puces',...(typeof RARETES!=='undefined'?RARETES:[]).map(([k,n])=>rgEl('span','rg-puce r-'+k,n))),
  rgListe(['<b>Usages</b> : '+(typeof USAGES_OBJET!=='undefined'?USAGES_OBJET.map(([,n])=>n.split(' — ')[0]).join(', '):'')+'.',
   '<b>Emplacements</b> : 2 mains, '+(typeof EMPLACEMENTS!=='undefined'?EMPLACEMENTS.map(([,n,k])=>n+' '+k).join(', '):'')+'. Un bouclier tient une main ; une arme à distance, deux.',
   'Sans arme : 1 dé Léger + Dégâts, à mains nues.','Un objet forgé a 1 à 4 affixes : Inhabituel, Rare, Épique, Légendaire.','Un soin ne se gâche pas : refusé à PV pleins.'])),
 // 14. L'exploration.
 ()=>rgSection('exploration','L’exploration',RG.pass,'🗺','Hors combat, on se déplace librement, on fouille, on crochète et on évite les pièges.',
  rgListe(['<b>Obscurité</b> : on ne voit que sa zone de contact, plus loin avec la Vision dans le noir ; une zone éclairée se voit de loin.',
   '<b>Fouiller</b> : un test de Perception sur la zone de contact pas encore fouillée révèle objets, coffres, passages et pièges cachés.',
   '<b>Indices</b> : cachés comme des objets, un test les repère. Au contact, un second test, ou l’objet qu’il faut, livre leur secret.',
   '<b>Pièges</b> : détecter (Perception ou Ruse), désamorcer (Ruse, Technique ou Force), éviter (Agilité).',
   '<b>Coffres et portes</b> : la clé, ou un test de Ruse ou de Technique.',
   '<b>Bruit</b> : un pas s’entend à 5 m (10 m à travers une porte), une attaque au contact à 15 m, un cri à 20 m.',
   '<b>Discrétion</b> : un test de Ruse donne 50 m de pas silencieux pour 1 réussite, 100 m par réussite au-delà de la première.'])));
