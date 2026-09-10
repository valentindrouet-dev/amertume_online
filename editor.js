'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['white','bone','red','blue','green','black','yellow'];
let catalog=structuredClone(AMERTUME_CATALOG),mapImage=null,db=null,loading=true,saveTimer;
const num=(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0));
const poolFrom=d=>keys.map(k=>num(d?.[k],0,12));
const diceFrom=p=>Object.fromEntries(keys.map((k,i)=>[k,p[i]||0]));
// STATES et les jetons d'état vivent dans index.html, chargé avant ce fichier.
function normalizeActor(a){a.id??=crypto.randomUUID();a.vie??=a.hero?Math.max(1,a.max/3):0;a.endu??=3;a.pvBonus??=0;a.xp??=0;a.level??=1;a.type??='standard';a.socle??='medium';a.menace??='closest';a.attacks??=[{name:'Attaque de base',dice:diceFrom(a.pool),range:'contact',targets:'one',useOwnDamage:true,effects:{}}];a.notes??='';a.states??=(a.state&&a.state!=='Aucun'?[a.state]:[]);delete a.state;a.sexe??='';a.race??='';a.vieMax??=a.vie;a.hidden??=false;a.skills??=Array(8).fill(0);a.weapons??=[];a.armorId??='';a.shieldId??='';a.activeAttack??=0;a.talents??=[];a.bleed??=0;return a}
/* Un catalogue enregistré avant les talents n'a pas le rayon : on l'ouvre vide. */
function normalizeCatalog(c){c||={};c.items||=[];c.monsters||=[];c.talents||=[];return c}
actors.forEach(normalizeActor);normalizeCatalog(catalog);
// Équipement de départ de la scène de démonstration. Toute partie enregistrée le remplace.
(function(){const parNom=n=>catalog.items.find(w=>w.name===n)?.id||'';
 [['Éla',['Épée'],'Armure de mailles','Bouclier'],['Kaël',['Arc'],'Armure de cuir',''],['Sentinelle',['Lance'],'Armure de mailles','Bouclier'],['Rôdeur des ruines',['Hache'],'Armure de plates','Bouclier']]
 .forEach(([nom,armes,armure,bouclier])=>{const a=actors.find(x=>x.name===nom);if(!a||a.weapons.length)return;
  a.weapons=armes.map(parNom).filter(Boolean);a.armorId=parNom(armure);a.shieldId=parNom(bouclier);
  const d=equippedDef(a,catalog.items);if(d!==null)a.def=d;a.pool=poolOf(a)})})();
const toolsBar=document.createElement('div');toolsBar.className='mj-tools';toolsBar.innerHTML='<button id="new-hero">+ Personnage</button><button id="new-monster">+ Monstre</button><button id="edit-scene">Modifier la scène</button><button id="heal-foes">Adversaires à 100 %</button><button id="reset-map">Retirer la carte</button>';
document.querySelector('.intro').after(toolsBar);const saveLabel=document.createElement('p');saveLabel.id='save-status';toolsBar.after(saveLabel);
const note=document.createElement('p');note.id='actor-notes';note.className='muted';$('class').after(note);
const attackSelect=document.createElement('select');attackSelect.id='attack-preset';attackSelect.setAttribute('aria-label','Attaque du combattant');$('targets').before(attackSelect);
attackSelect.onchange=()=>{const a=actors[selected];if(!a)return;a.activeAttack=Number(attackSelect.value);a.pool=poolOf(a);render()};
const cover=document.createElement('div');cover.id='busy-cover';cover.textContent='Chargement de la partie enregistrée…';document.body.append(cover);
function dialog(id,title,body){const el=document.createElement('dialog');el.id=id;el.innerHTML='<div class="dialog-head"><h2>'+title+'</h2><button type="button" aria-label="Fermer" data-close>✕</button></div>'+body;document.body.append(el);el.querySelector('[data-close]').onclick=()=>el.close();return el}
const actorDialog=dialog('actor-editor','Modifier la fiche','<form id="actor-form"><div id="actor-fields"></div><p class="form-error" id="actor-error" role="alert"></p><div class="form-actions"><button type="button" id="delete-actor">Retirer de la scène</button><button type="button" id="save-template">Enregistrer au bestiaire</button><button type="submit" class="primary">Enregistrer la fiche</button></div></form>');
/* ---------- Pages Armurerie et Bestiaire ---------- */
const armoryPage=document.createElement('main');armoryPage.id='armory-page';
armoryPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Armurerie</h2><div class="cat-actions">'
 +'<button id="armory-official">Catalogue officiel</button><button id="armory-add" class="primary">+ Ajouter</button></div></header>'
 +'<p class="muted">Catalogue d’armes, d’armures et d’objets. Chaque combattant y choisit son équipement depuis sa fiche.</p>'
 +'<div class="cat-filters"><input id="armory-search" placeholder="Rechercher…" aria-label="Rechercher un objet">'
 +'<select id="armory-cat" aria-label="Catégorie"><option value="">Toutes catégories</option>'
 +'<option value="melee">Armes de mêlée</option><option value="ranged">Armes à distance</option>'
 +'<option value="armor">Armures</option><option value="object">Objets</option></select></div>'
 +'<div class="cat-cols" id="armory-cols"></div></section>';
const heroesPage=document.createElement('main');heroesPage.id='heroes-page';
heroesPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Aventuriers</h2><div class="cat-actions">'
 +'<button id="hero-add" class="primary">+ Nouvel aventurier</button></div></header>'
 +'<p class="muted">Les fiches des héros de la troupe. C’est ici qu’on les crée, qu’on les modifie et qu’on les retire.</p>'
 +'<div class="cat-filters"><input id="hero-search" placeholder="Rechercher…" aria-label="Rechercher un aventurier"></div>'
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
 +'<p class="form-error" id="raccourcis-erreur" role="alert"></p>'
 +'<div class="side-actions"><button id="raccourcis-reset">Rétablir les touches d’origine</button></div>'
 +'</section>';
const talentsPage=document.createElement('main');talentsPage.id='talents-page';
talentsPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Talents</h2><div class="cat-actions">'
 +'<button id="talent-add" class="primary">+ Nouveau talent</button></div></header>'
 +'<p class="muted">Les talents que les aventuriers peuvent apprendre, rangés par classe. Les Génériques sont ouverts à tous. On les attribue depuis la fiche d’un aventurier, onglet Aventuriers.</p>'
 +'<div class="cat-filters"><input id="talent-search" placeholder="Rechercher…" aria-label="Rechercher un talent">'
 +'<select id="talent-family" aria-label="Classe"></select>'
 +'<select id="talent-sort" aria-label="Tri"><option value="niveau">Tri : niveau ↑</option>'
 +'<option value="niveau-">Tri : niveau ↓</option><option value="nom">Tri : nom</option></select></div>'
 +'<div class="cat-cols" id="talent-cols"></div></section>';
const bestiaryPage=document.createElement('main');bestiaryPage.id='bestiary-page';
bestiaryPage.innerHTML='<section class="cat-panel panel">'
 +'<header class="cat-head"><h2>Bestiaire</h2><div class="cat-actions">'
 +'<button id="bestiary-add" class="primary">+ Nouveau monstre</button></div></header>'
 +'<p class="muted">Modèles d’adversaires. Un modèle se pose sur la carte de combat ou se pré-place depuis l’éditeur de cartes.</p>'
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
 classe.textContent=(a.role||'Héros').split('·')[0].trim().toUpperCase();
 classe.style.color=classe.style.borderColor=teinte;
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(g,t,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=g;
  b.title=t;b.setAttribute('aria-label',t+' '+a.name);b.onclick=fn;return b};
 const suppr=ico('✕','Retirer',()=>{const r=heroRank(a);if(r<0)return;
  const souci=removeActor(r);if(souci)alert(souci);else renderHeroes()});
 suppr.classList.add('danger');
 outils.append(ico('✎','Modifier',()=>{const r=heroRank(a);if(r>=0)openActor(r)}),
  ico('⧉','Dupliquer',()=>{if(heroRank(a)<0)return;
   const copie=normalizeActor(structuredClone(a));
   copie.name=a.name+' (copie)';copie.target=null;copie.checks=[false,false,false];
   actors.push(copie);renderHeroes();render();scheduleSave()}),suppr);
 tete.append(jeton,titre,classe,outils);
 const puces=document.createElement('div');puces.className='chips';
 const marques=[];if(a.sexe)marques.push((a.sexe==='Femme'?'♀ ':a.sexe==='Homme'?'♂ ':'')+a.sexe);
 if(a.race)marques.push(a.race);marques.push('Niveau '+a.level,(a.xp||0)+' XP');
 marques.forEach(t=>{const p=document.createElement('span');p.className='chip';p.textContent=t;puces.append(p)});
 // Les caractéristiques reprennent les tuiles de la fiche en jeu : libellé au-dessus,
 // valeur en gros, une teinte par caractéristique, l'écu pour la DEF.
 const chiffres=document.createElement('div');chiffres.className='stat-row';
 chiffres.append(...[['vie','Vie',a.vie,false,a.vieMax??a.vie],['endu','Endu',a.endu],
  ['pv','PV',a.hp,false,a.max],['def','DEF',defOf(a),true],['dmg','Dég.','+'+a.dmg]]
  .map(t=>statTile(...t)));
 const titreComp=document.createElement('h4');titreComp.className='hero-sous';titreComp.textContent='Compétences';
 const comps=document.createElement('div');comps.className='skills';
 // Un bonus de 0 reste une compétence qu'on teste — le dé de base est toujours lancé.
 skillNames.forEach((n,k)=>{
  const puce=document.createElement('span');puce.className='skill-chip'+(a.skills[k]?'':' zero');
  puce.style.setProperty('--tint',SKILL_TINTS[k]);
  const l=document.createElement('span');l.textContent=n;
  const v=document.createElement('b');v.textContent='+'+a.skills[k];
  puce.append(l,v);comps.append(puce)});

 const titreKit=sousTitre('Équipement','Équiper '+a.name,()=>openPicker(a,'gear'));
 const titreTal=sousTitre('Talents','Ajouter un talent à '+a.name,()=>openPicker(a,'talents'));
 c.append(tete,puces,chiffres,titreComp,comps,titreKit,gearPills(a),titreTal,talentPills(a));return c}
function renderHeroes(){const grille=$('hero-grid');if(!grille)return;grille.replaceChildren();
 const q=($('hero-search').value||'').trim().toLowerCase();
 const heros=actors.filter(a=>a.hero&&(!q||a.name.toLowerCase().includes(q)));
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
function dicePips(dice){const out=document.createElement('span');out.className='pips';
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
 else p.append(dicePips(o.dice));
 const info=[o.effects,(o.traits||[]).join(', '),o.notes].filter(Boolean).join(' · ');
 p.title=info?o.name+' — '+info:o.name;
 return p}
function gearPills(a){const out=document.createElement('div');out.className='gear-pills';
 const porte=[...(a.weapons||[]),a.armorId,a.shieldId].map(gear).filter(Boolean);
 if(!porte.length){const v=document.createElement('span');v.className='muted';v.textContent='Sans équipement';out.append(v)}
 else porte.forEach(o=>out.append(gearPill(o)));
 return out}
/* Talents : six natures, chacune sa couleur et son abrégé, comme dans le jeu de table. */
const TALENT_TYPES=[['act','ACT','Action'],['reac','REAC','Réaction'],['pass','PASS','Passif'],
 ['crit','CRIT','Critique'],['mait','MAIT','Maîtrise'],['ame','AME','Amélioration']];
const talentType=t=>TALENT_TYPES.find(x=>x[0]===(t&&t.type))||TALENT_TYPES[0];
const GENERIQUES='Génériques';
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
 else pill.append(dicePips(a.dice));
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
  if(!liste.length){const vide=document.createElement('p');vide.className='muted';vide.textContent='Rien ici.';bloc.append(vide)}
  cols.append(bloc)}}
const BEST_COLS=[['standard','Sbires'],['solitaire','Solitaires'],['boss','Boss']];
function danger(m){return (Number(m.xp)||0)*100+(Number(m.pv)||0)}
function bestiaryRow(m,i){const rang=document.createElement('div');rang.className='cat-row';
 const pill=document.createElement('button');pill.className='cat-pill k-'+(m.type||'standard');
 const nom=document.createElement('span');nom.className='nom';nom.textContent=m.name;
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';
 pill.append(nom,chev);
 const detail=document.createElement('div');detail.className='cat-detail';detail.hidden=true;
 detail.innerHTML='<span>'+(m.pv||0)+' PV · DEF '+(m.def||0)+' · Dégâts '+(m.damage||0)+' · '+(m.xp||0)+' XP</span>'
  +'<span class="muted">'+esc(m.family||'Sans famille')+(m.rapide?' · Rapide':'')+(m.esquive?' · Esquive':'')+'</span>';
 const poser=document.createElement('button');poser.dataset.catAdd=i;poser.textContent='Ajouter à la carte';
 detail.append(poser);
 poser.onclick=()=>{saveChecks();savePool();const a=fromMonster(catalog.monsters[i]);
  a.x=30+Math.random()*40;a.y=20+Math.random()*30;normalizeActor(a);actors.push(a);selected=actors.length-1;
  showPage('table');render();log(a.name+' ajouté à la carte.')};
 pill.onclick=()=>{detail.hidden=!detail.hidden;pill.classList.toggle('ouvert',!detail.hidden)};
 const outils=document.createElement('span');outils.className='cat-tools';
 const ico=(glyphe,titre,fn)=>{const b=document.createElement('button');b.className='ico';b.textContent=glyphe;
  b.title=titre;b.setAttribute('aria-label',titre+' '+m.name);b.onclick=fn;return b};
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
function renderBestiary(){const cols=$('bestiary-cols');if(!cols)return;cols.replaceChildren();
 const q=($('bestiary-search').value||'').trim().toLowerCase();
 const familles=[...new Set(catalog.monsters.map(m=>m.family).filter(Boolean))].sort();
 const sel=$('bestiary-family'),avant=sel.value;
 sel.replaceChildren(new Option('Toutes familles',''));
 familles.forEach(f=>sel.add(new Option(f,f)));
 sel.value=familles.includes(avant)?avant:'';
 const tri=$('bestiary-sort').value;
 for(const [key,titre] of BEST_COLS){
  let liste=catalog.monsters.map((m,i)=>[m,i]).filter(([m])=>(m.type||'standard')===key
   &&(!q||m.name.toLowerCase().includes(q))&&(!sel.value||m.family===sel.value));
  liste.sort((a,b)=>tri==='nom'?a[0].name.localeCompare(b[0].name)
   :tri==='danger-'?danger(a[0])-danger(b[0]):danger(b[0])-danger(a[0]));
  const bloc=document.createElement('div');bloc.className='cat-col c-'+key;
  const h=document.createElement('h3');h.textContent=titre;
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([m,i])=>bloc.append(bestiaryRow(m,i)));
  if(!liste.length){const vide=document.createElement('p');vide.className='muted';vide.textContent='Rien ici.';bloc.append(vide)}
  cols.append(bloc)}}
/* Une colonne par classe, les Génériques en tête : c'est ainsi qu'on lit un arbre de
   talents, la souche commune d'abord et les branches ensuite. */
function talentFamilies(){const autres=[...new Set((catalog.talents||[]).map(talentFamily))]
 .filter(f=>f!==GENERIQUES).sort((a,b)=>a.localeCompare(b,'fr'));
 return [GENERIQUES,...autres]}
function talentRow(t,i){const rang=document.createElement('div');rang.className='cat-row';
 const pill=talentPill(t);pill.classList.add('cliquable');
 const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';pill.append(chev);
 const detail=document.createElement('div');detail.className='cat-detail';detail.hidden=true;
 const ligne=document.createElement('span');
 ligne.textContent=talentFamily(t)+' · '+talentType(t)[2]+' · niveau '+(t.level||1);
 const effet=document.createElement('span');effet.className='muted';
 effet.textContent=t.effects||'Effet à préciser.';
 detail.append(ligne,effet);
 if(t.notes){const n=document.createElement('span');n.className='muted';n.textContent=t.notes;detail.append(n)}
 const porteurs=actors.filter(a=>a.hero&&(a.talents||[]).includes(t.id)).map(a=>a.name);
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
function renderTalents(){const cols=$('talent-cols');if(!cols)return;cols.replaceChildren();
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
  const compte=document.createElement('span');compte.className='compte';compte.textContent=liste.length;
  h.append(compte);bloc.append(h);
  liste.forEach(([t,i])=>bloc.append(talentRow(t,i)));
  if(!liste.length){const vide=document.createElement('p');vide.className='muted';
   vide.textContent='Rien ici.';bloc.append(vide)}
  cols.append(bloc)}
 if(!(catalog.talents||[]).length){const vide=document.createElement('p');vide.className='muted';
  vide.textContent='Aucun talent pour l’instant. « + Nouveau talent » ouvre une fiche vierge : un nom, une classe, une nature et un niveau.';
  cols.replaceChildren(vide)}}
$('talent-search').oninput=renderTalents;$('talent-family').onchange=renderTalents;
$('talent-sort').onchange=renderTalents;
$('talent-add').onclick=()=>openTalent(null);
const talentDialog=dialog('talent-editor','Talent','<form id="talent-form"><div id="talent-fields"></div><div class="form-actions"><button type="button" id="delete-talent">Supprimer</button><button class="primary">Enregistrer</button></div></form>');
let talentIndex=null,talentApres=null;
/* Fermé sans enregistrer, le dialogue ne doit rien rappeler : sinon une création faite
   plus tard depuis l'armurerie irait se cocher dans une fiche déjà refermée. */
talentDialog.addEventListener('close',()=>{talentApres=null});
function openTalent(i=null,apres=null){if(view!=='mj')return;talentIndex=i;talentApres=apres;
 const t=i===null?{name:'Nouveau talent',famille:GENERIQUES,type:'act',level:1,effects:'',notes:''}:catalog.talents[i];
 if(i!==null&&!t)return;
 const familles=[...new Set([GENERIQUES,...talentFamilies(),...actors.filter(a=>a.hero).map(a=>(a.role||'').split('·')[0].trim()).filter(Boolean)])];
 $('talent-fields').innerHTML='<div class="edit-grid">'
  +field('Nom','name',t.name,'text','required maxlength="120"')
  +'<label>Classe<input name="famille" list="talent-familles" maxlength="60" value="'+esc(talentFamily(t))+'"></label>'
  +sel('Nature','type',t.type||'act',TALENT_TYPES.map(([k,,nom])=>[k,nom]))
  +field('Niveau','level',t.level||1,'number','min="1" max="20"')+'</div>'
  +'<datalist id="talent-familles">'+familles.map(f=>'<option value="'+esc(f)+'">').join('')+'</datalist>'
  +'<label>Effet<textarea name="effects" rows="3" maxlength="600">'+esc(t.effects||'')+'</textarea></label>'
  +'<label>Notes<textarea name="notes" rows="2" maxlength="600">'+esc(t.notes||'')+'</textarea></label>';
 $('delete-talent').hidden=i===null;talentDialog.showModal()}
$('talent-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;
 const f=$('talent-form').elements;
 const t=talentIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.talents[talentIndex]);
 t.name=f.name.value.trim()||'Talent';t.famille=f.famille.value.trim()||GENERIQUES;
 t.type=f.type.value;t.level=num(f.level.value,1,20);
 t.effects=f.effects.value.trim();t.notes=f.notes.value.trim();
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
function syncEquipped(a){const d=equippedDef(a,catalog.items);if(d!==null)a.def=d;
 a.pool=equippedPool(a,catalog.items)||poolFrom(a.attacks&&a.attacks[0]&&a.attacks[0].dice)||a.pool}
function toggleGear(a,o){
 if(o.category==='weapon'){const dedans=(a.weapons||[]).includes(o.id);
  if(dedans)a.weapons=a.weapons.filter(x=>x!==o.id);
  else if((a.weapons||[]).length>=2)return 'Deux armes déjà en main : retire-en une d’abord.';
  else a.weapons=[...(a.weapons||[]),o.id]}
 else if(o.category==='armor'){const cle=o.slot==='shield'?'shieldId':'armorId';
  a[cle]=a[cle]===o.id?'':o.id}
 else return 'Cet objet n’a pas d’emplacement : il se note dans l’inventaire de la fiche.';
 syncEquipped(a);return null}
const pickerDialog=dialog('picker','Équiper','<p class="muted" id="picker-note"></p>'
 +'<input id="picker-search" placeholder="Rechercher…" aria-label="Rechercher">'
 +'<div id="picker-body"></div>');
let pickerActeur=null,pickerMode='gear';
function openPicker(a,mode){if(view!=='mj')return;pickerActeur=a;pickerMode=mode;
 pickerDialog.querySelector('h2').textContent=(mode==='gear'?'Équiper ':'Talents de ')+a.name;
 $('picker-note').textContent=mode==='gear'
  ?'Clique un objet pour le mettre en main ou le retirer. Deux armes au plus, une armure, un bouclier.'
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
   etat.textContent=porte(o)?'✓':'+';rang.append(etat);
   rang.onclick=()=>clic(o);bloc.append(rang)});
  corps.append(bloc)};
 if(pickerMode==='gear'){
  const porte=o=>(a.weapons||[]).includes(o.id)||a.armorId===o.id||a.shieldId===o.id;
  const clic=o=>{const souci=toggleGear(a,o);
   if(souci){$('picker-note').textContent=souci;return}
   renderPicker();renderHeroes();render();scheduleSave()};
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
  sel.onchange=()=>{const pris=GESTES.find(([k])=>k!==cle&&raccourcis[k]===sel.value&&sel.value);
   if(pris){$('raccourcis-erreur').textContent='« '+pris[1]+' » utilise déjà cette touche.';
    sel.value=raccourcis[cle];return}
   $('raccourcis-erreur').textContent='';raccourcis[cle]=sel.value;saveShortcuts();renderSettings()};
  ligne.append(gauche,sel);return ligne}))}
$('theme-switch').onclick=toggleTheme;
$('raccourcis-reset').onclick=()=>{raccourcis={...RACCOURCIS_DEFAUT};saveShortcuts();
 $('raccourcis-erreur').textContent='';renderSettings()};
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
const imgDialog=dialog('image-editor','Optimiser l’image','<div class="edit-grid"><label>Taille maximale<select id="image-size"></select></label><label>Qualité WebP<input id="image-quality" type="range" min="70" max="100" value="90"><span id="quality-label">90 %</span></label><div><button id="image-recalc">Actualiser l’aperçu</button></div></div><div class="image-comparison"><div><p>Original</p><img id="image-before" alt="Image originale"><p class="muted" id="before-info"></p></div><div><p>Copie optimisée</p><img id="image-after" alt="Image optimisée"><p class="muted" id="after-info"></p></div></div><p class="form-error" id="image-error" role="alert"></p><p class="muted">Proportions et transparence conservées. L’original n’est pas modifié. PNG de secours si WebP indisponible.</p><div class="form-actions"><button id="image-cancel">Annuler</button><button class="primary" id="image-accept" disabled>Utiliser cette image</button></div>');
function field(label,key,value,type='text',extra=''){return '<label>'+label+'<input name="'+key+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>'}
function sel(label,key,value,opts){return '<label>'+label+'<select name="'+key+'">'+opts.map(([v,t])=>'<option value="'+v+'" '+(String(value)===String(v)?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>'}
function poolFields(p,prefix){return '<div class="mini-pool">'+types.map((t,i)=>field(t,prefix+i,p[i]||0,'number','min="0" max="12"')).join('')+'</div>'}
let editing=null,draft=null,attackDraft=[],templateIndex=null,itemIndex=null,itemApres=null;
function baseActor(hero){return normalizeActor({name:hero?'Nouveau héros':'Nouveau monstre',hero,role:hero?'Aventurier':'Adversaire',hp:12,max:12,def:2,dmg:2,x:50,y:60,pool:[2,0,0,0,0,0,0],checks:[false,false,false],target:null,skills:Array(8).fill(0)})}
function fromMonster(m){const a=baseActor(false);Object.assign(a,{template:m.id,name:m.name,role:m.family||'Adversaire',sexe:m.sexe||'',race:m.race||'',hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,esquive:!!m.esquive,rapide:!!m.rapide,notes:m.notes||'',attacks:structuredClone(m.attacks||[]),image:m.image||null});a.pool=poolFrom(a.attacks[0]?.dice);return a}
function openActor(index=null,hero=true,template=null){if(view!=='mj')return;
 if(index!==null&&!actors[index])return;saveChecks();savePool();editing=index;templateIndex=template;draft=structuredClone(template!==null?fromMonster(catalog.monsters[template]):index===null?baseActor(hero):actors[index]);attackDraft=structuredClone(draft.attacks);$('actor-error').textContent='';$('delete-actor').hidden=index===null;$('save-template').hidden=draft.hero;renderActorForm();actorDialog.showModal()}
function renderActorForm(){const a=draft;const weaponOptions=[['','Aucune'],...catalog.items.filter(w=>w.category==='weapon').map(w=>[w.id,w.name])];const armorOptions=slot=>[['','Aucune'],...catalog.items.filter(w=>w.category==='armor'&&w.slot===slot).map(w=>[w.id,w.name])];
$('actor-fields').innerHTML='<div class="edit-grid">'+field('Nom','name',a.name,'text','required maxlength="120"')+field(a.hero?'Classe / rôle':'Famille / rôle','role',a.role)+(templateIndex===null?field('PV actuels','hp',a.hp,'number','min="0" max="99999"'):'')+field('PV maximum (modifiable)','max',a.max,'number','min="1" max="99999" required')+field('DEF','def',a.def,'number','min="0" max="99"')+field('Dégâts','dmg',a.dmg,'number','min="0" max="999"')+field('XP','xp',a.xp,'number','min="0" max="999999"')+sel('Sexe','sexe',a.sexe,[['','—'],['Femme','Femme'],['Homme','Homme'],['Autre','Autre']])+field('Peuple','race',a.race,'text','maxlength="40"')+(a.hero?field('Vie','vie',a.vie,'number','min="0" max="999" step="any"')+field('Vie maximale','vieMax',a.vieMax,'number','min="1" max="999" step="any"')+field('Endurance','endu',a.endu,'number','min="1" max="999"')+field('Bonus PV','pvBonus',a.pvBonus,'number','min="-9999" max="9999"')+field('Niveau','level',a.level,'number','min="1" max="7"'):'')+'</div><h2 class="sous-titre">États</h2><div id="state-picker"></div><p class="muted">Un combattant peut en porter plusieurs. Le clic droit sur son socle les pose aussi, en pleine partie.</p><div class="edit-grid">'+sel('Taille du socle','socle',a.socle,[['medium','Moyen'],['large','Grand'],['huge','Énorme']])+(!a.hero?sel('Type','type',a.type,[['standard','Standard'],['solitaire','Solitaire'],['alpha','Alpha'],['boss','Boss']])+sel('Menace','menace',a.menace,[['closest','Plus proche'],['pvLow','PV bas'],['pvHigh','PV haut'],['defLow','DEF basse']]):'')+'<label class="field-check"><input name="rapide" type="checkbox" '+(a.rapide?'checked':'')+'>Rapide (manuel)</label><label class="field-check"><input name="esquive" type="checkbox" '+(a.esquive?'checked':'')+'>Esquive 6+ (manuelle)</label></div>'+(a.hero?'<button type="button" id="calculate-pv" style="margin-top:12px">Recalculer PV max : Vie × Endu + bonus</button>':'')+'<div class="divider"></div><h2>Illustration du token</h2><img class="preview-token" id="draft-image" alt="Token" '+(a.image?'src="'+a.image+'"':'hidden')+'><div class="toolbar"><button type="button" id="token-upload">Importer et optimiser</button><button type="button" id="token-remove">Retirer l’image</button></div><input id="token-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>'+(a.hero?'<div class="divider"></div><h2 class="sous-titre">Talents<button type="button" id="add-talent" class="ico plus" title="Créer un talent" aria-label="Créer un talent">+</button></h2><input id="talent-filter" placeholder="Filtrer les talents…" aria-label="Filtrer les talents"><div id="talent-picker"></div><p class="muted">Les talents se créent dans l’onglet Talents. Ceux de la classe de l’aventurier et les Génériques viennent en tête.</p>':'')+'<div class="divider"></div><h2>Compétences</h2><p class="muted">Chaque chiffre est un <b>bonus</b>, pas un nombre de dés : un test lance 1 dé plus ce bonus, chaque 4+ est une réussite, chaque 6 relance un dé de plus qui compte à son tour.</p><div class="edit-grid">'+skillNames.map((n,i)=>field(n,'skill'+i,a.skills[i],'number','min="0" max="30"')).join('')+'</div><div class="divider"></div><h2 class="sous-titre">Équipement<button type="button" id="add-gear" class="ico plus" title="Créer un objet" aria-label="Créer un objet">+</button></h2><div class="edit-grid">'+sel('Arme 1','weapon1',a.weapons[0]||'',weaponOptions)+sel('Arme 2','weapon2',a.weapons[1]||'',weaponOptions)+sel('Armure','armor',a.armorId,armorOptions('body'))+sel('Bouclier','shield',a.shieldId,armorOptions('shield'))+'</div><p class="muted" id="equip-summary"></p><p class="muted">Les dés de l’attaque et la DEF découlent de l’équipement. Mains, munitions et effets restent à vérifier à la main.</p><div class="divider"></div><h2>Attaques</h2><div id="attack-edit-list"></div><button type="button" id="add-attack">+ Attaque</button><p class="muted">La réserve et le bonus de dégâts sont appliqués. Portée, cibles multiples et effets indiqués ci-dessous restent manuels.</p><div class="divider"></div><label>Talents, inventaire et notes<textarea name="notes" rows="4">'+esc(a.notes)+'</textarea></label>';
if(a.hero)$('calculate-pv').onclick=()=>{const f=$('actor-form').elements;f.max.value=Math.max(1,num(f.vie.value,1,999)*num(f.endu.value,1,999)+num(f.pvBonus.value,-9999,9999))};
$('token-upload').onclick=()=>$('token-file').click();$('token-file').onchange=()=>{const f=$('token-file').files[0];if(f)openImage(f,'token',url=>{draft.image=url;$('draft-image').src=url;$('draft-image').hidden=false})};$('token-remove').onclick=()=>{draft.image=null;$('draft-image').hidden=true};$('add-attack').onclick=()=>{readAttacks();attackDraft.push({name:'Nouvelle attaque',dice:diceFrom([1,0,0,0,0,0,0]),range:'contact',targets:'one',useOwnDamage:true,effects:{}});renderAttacks()};renderStatePicker();
if(a.hero){$('talent-filter').oninput=renderTalentPicker;renderTalentPicker();
 // Créé depuis la fiche, le talent y est aussitôt coché : on l'ajoutait pour cet aventurier.
 $('add-talent').onclick=()=>openTalent(null,t=>{draft.talents=[...new Set([...(draft.talents||[]),t.id])];
  if($('talent-filter'))$('talent-filter').value='';renderTalentPicker()})}
// Créé depuis la fiche, l'objet se pose dans le premier emplacement libre qui lui convient.
$('add-gear').onclick=()=>openItem(null,o=>refreshGearOptions(o));['weapon1','weapon2','armor','shield'].forEach(k=>{$('actor-form').elements[k].onchange=refreshEquip});refreshEquip();renderAttacks()}
// Aperçu vivant de l'équipement : dés cumulés, portée et DEF verrouillée par l'armure.
function refreshEquip(){const f=$('actor-form').elements,ids=[f.weapon1.value,f.weapon2.value].filter(Boolean);
 const armes=ids.map(id=>catalog.items.find(w=>w.id===id)).filter(Boolean);
 const p=equippedPool({weapons:ids},catalog.items),d=equippedDef({armorId:f.armor.value,shieldId:f.shield.value},catalog.items);
 f.def.readOnly=d!==null;if(d!==null)f.def.value=d;
 const des=p?p.map((n,i)=>n?n+' '+types[i]:'').filter(Boolean).join(' · ')||'aucun dé':'';
 $('equip-summary').textContent=(armes.length?'Dés de '+armes.map(w=>w.name).join(' + ')+' : '+des+(armes.some(w=>w.ranged)?' · tir à distance.':' · contact.'):'Aucune arme équipée : les dés viennent des attaques ci-dessous.')
  +' '+(d!==null?'DEF de l’équipement : '+d+', champ verrouillé.':'DEF saisie à la main.')}
function renderAttacks(){$('attack-edit-list').innerHTML=attackDraft.map((a,i)=>'<div class="attack-card" data-attack="'+i+'"><div class="edit-grid">'+field('Nom','an'+i,a.name,'text','required maxlength="100"')+sel('Portée','ar'+i,a.range,[['contact','Contact'],['distance','Distance']])+sel('Cibles','at'+i,a.targets,[['one','Unique'],['all','Multiples (manuel)']])+'</div>'+poolFields(poolFrom(a.dice),'ad'+i+'_')+'<label class="field-check"><input type="checkbox" name="ab'+i+'" '+(a.useOwnDamage!==false?'checked':'')+'>Ajouter les dégâts du combattant</label>'+field('Effets à appliquer manuellement','ae'+i,a.effectText||Object.entries(a.effects||{}).filter(([,v])=>v).map(([k])=>k).join(', '))+'<button type="button" data-remove-attack="'+i+'">Retirer cette attaque</button></div>').join('');document.querySelectorAll('[data-remove-attack]').forEach(b=>b.onclick=()=>{readAttacks();attackDraft.splice(Number(b.dataset.removeAttack),1);renderAttacks()})}
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
 for(const k of ['hp','max','def','dmg','xp','vie','vieMax','endu','pvBonus','level'])if(f[k])a[k]=num(f[k].value,k==='pvBonus'?-9999:0,k==='xp'?999999:99999);a.max=Math.max(1,a.max);if(templateIndex!==null)a.hp=a.max;a.hp=Math.min(a.hp,a.max);setState(a,'Coma',!a.hp);if(!a.hero){a.type=f.type.value;a.menace=f.menace.value}a.rapide=f.rapide.checked;a.esquive=f.esquive.checked;a.skills=skillNames.map((_,i)=>num(f['skill'+i].value,0,30));a.weapons=[f.weapon1.value,f.weapon2.value].filter(Boolean);a.armorId=f.armor.value;a.shieldId=f.shield.value;a.attacks=attackDraft;a.activeAttack=0;a.talents=[...new Set(draft.talents||[])].filter(id=>(catalog.talents||[]).some(t=>t.id===id));
 const dEquip=equippedDef(a,catalog.items);if(dEquip!==null)a.def=dEquip;
 a.pool=equippedPool(a,catalog.items)||poolFrom(attackDraft[0]?.dice);return a}
function toMonster(a){return {id:crypto.randomUUID(),name:a.name,family:a.role,sexe:a.sexe,race:a.race,pv:a.max,def:a.def,damage:a.dmg,xp:a.xp,type:a.type,socle:a.socle,menace:a.menace,rapide:a.rapide,esquive:a.esquive,notes:a.notes,attacks:structuredClone(a.attacks),image:a.image||null}}
/* Une créature posée sur la table garde le lien vers son modèle : corriger les PV maximum
   au bestiaire corrige ceux qui combattent déjà. Une créature blessée garde sa blessure,
   une créature intacte reste intacte. Les créatures d'avant ce lien sont rattrapées par
   leur nom — c'est tout ce qu'on a d'elles, et seulement quand aucun lien n'est enregistré. */
function syncFromTemplate(m){let touches=0;
 actors.forEach(a=>{if(a.hero)return;
  if(a.template?a.template!==m.id:a.name!==m.name)return;
  const plein=a.hp>=a.max,max=Math.max(1,num(m.pv,1,99999));
  if(a.max===max)return;
  a.max=max;a.hp=plein?max:Math.min(a.hp,max);setState(a,'Coma',!a.hp);touches++});
 return touches}
$('actor-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;const a=readActor();if(templateIndex!==null){const modele={...toMonster(a),id:catalog.monsters[templateIndex].id};catalog.monsters[templateIndex]=modele;
 const suivis=syncFromTemplate(modele);
 if(suivis)log(suivis+' créature(s) « '+modele.name+' » sur la table passée(s) à '+modele.pv+' PV maximum.');
 renderCatalogPages()}else if(editing===null){actors.push(a);selected=actors.length-1}else actors[editing]=a;actorDialog.close();renderHeroes();render();log('Fiche enregistrée : '+a.name);scheduleSave()};
$('save-template').onclick=()=>{if(!$('actor-form').reportValidity()||view!=='mj')return;catalog.monsters.push(toMonster(readActor()));$('actor-error').textContent='Copie ajoutée au bestiaire.';scheduleSave()};
/* Retirer un combattant : les cibles qui le visaient et les indices qui le suivaient
   sont recalés, et la scène garde toujours au moins un héros. */
function removeActor(i){return removeActors([i],true)}
/* Retirer un ou plusieurs combattants d'un coup. Les indices sont défaits du plus grand
   au plus petit, sinon chaque coupe décalerait les suivants. Cibles, joueur maître et
   sélection sont recalés ensuite. La troupe garde toujours un héros.
   « demande » vaut pour la fiche, où l'on confirme quoi qu'il arrive ; au clavier, seuls
   les héros font surgir l'alerte — perdre un monstre se répare d'un clic, pas une fiche. */
function removeActors(liste,demande){
 if(view!=='mj')return 'Retrait impossible.';
 const rangs=[...new Set(liste)].filter(i=>actors[i]).sort((x,y)=>y-x);
 if(!rangs.length)return 'Retrait impossible.';
 const heros=rangs.filter(i=>actors[i].hero).length;
 if(rangs.length>=actors.length||heros>=actors.filter(a=>a.hero).length)
  return 'Conserve au moins un héros dans la scène.';
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
function openItem(i=null,apres=null){itemIndex=i;itemApres=apres;const a=i===null?{name:'Nouvel objet',category:'weapon',hands:1,qty:1,price:0,def:0,slot:'body',dice:{},traits:[]}:catalog.items[i];$('item-fields').innerHTML='<div class="edit-grid">'+field('Nom','name',a.name,'text','required maxlength="120"')+sel('Catégorie','category',a.category,[['weapon','Arme'],['armor','Armure'],['ammo','Munition'],['object','Objet'],['misc','Divers']])+field('Quantité','qty',a.qty||1,'number','min="1" max="9999"')+field('Prix','price',a.price||0,'number','min="0" max="999999"')+sel('Mains','hands',a.hands||1,[[1,'1 main'],[2,'2 mains']])+field('DEF (armure)','def',a.def||0,'number','min="0" max="99"')+sel('Emplacement armure','slot',a.slot||'body',[['body','Corps'],['shield','Bouclier']])+'</div>'+poolFields(poolFrom(a.dice),'itemdie')+['ranged','usesAmmo','consumable'].map((k,i)=>'<label class="field-check"><input name="'+k+'" type="checkbox" '+(a[k]?'checked':'')+'>'+['Distance','Munitions nécessaires','Consommable'][i]+'</label>').join('')+field('Traits (séparés par une virgule)','traits',(a.traits||[]).join(', '))+field('Effets (manuel)','effects',a.effects||'')+'<label>Notes<textarea name="notes">'+esc(a.notes||'')+'</textarea></label>';$('delete-item').hidden=i===null;itemDialog.showModal()}
$('item-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;const f=$('item-form').elements,a=itemIndex===null?{id:crypto.randomUUID()}:structuredClone(catalog.items[itemIndex]);for(const k of ['name','category','slot','effects','notes'])a[k]=f[k].value.trim();for(const k of ['qty','price','hands','def'])a[k]=num(f[k].value,0,999999);a.traits=f.traits.value.split(',').map(s=>s.trim()).filter(Boolean);for(const k of ['ranged','usesAmmo','consumable'])a[k]=f[k].checked;a.dice=diceFrom(keys.map((_,i)=>num(f['itemdie'+i].value,0,12)));if(itemIndex===null)catalog.items.push(a);else catalog.items[itemIndex]=a;itemDialog.close();renderCatalogPages();scheduleSave();const rappel=itemApres;itemApres=null;if(rappel)rappel(a)};
$('delete-item').onclick=()=>{if(view!=='mj'||itemIndex===null||!confirm('Supprimer cet objet du catalogue ? Les attaques déjà appliquées restent inchangées.'))return;const id=catalog.items[itemIndex].id;actors.forEach(a=>{a.weapons=a.weapons.filter(w=>w!==id);if(a.armorId===id)a.armorId='';if(a.shieldId===id)a.shieldId=''});catalog.items.splice(itemIndex,1);itemDialog.close();renderCatalogPages();scheduleSave()};

$('new-hero').onclick=()=>openActor(null,true);$('new-monster').onclick=()=>openActor(null,false);
const sceneDialog=dialog('scene-editor','Scène','<form id="scene-form"><label>Titre<input name="title" maxlength="120" required></label><label>Tour de combat<input name="round" type="number" min="1" max="999" required></label><div class="form-actions"><button class="primary">Enregistrer</button></div></form>');
$('edit-scene').onclick=()=>{if(view!=='mj')return;$('scene-form').elements.title.value=document.querySelector('.intro h1').textContent;$('scene-form').elements.round.value=round;sceneDialog.showModal()};$('scene-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;round=num($('scene-form').elements.round.value,1,999);document.querySelector('.intro h1').textContent=$('scene-form').elements.title.value;$('round').textContent=String(round).padStart(2,'0');sceneDialog.close();scheduleSave()};
$('reset-map').onclick=()=>{if(view!=='mj')return;mapImage=null;$('map-view').style.backgroundImage='';$('map').classList.remove('custom');scheduleSave()};
const originalRender=render;render=function(){originalRender();toolsBar.hidden=view!=='mj';$('owner').replaceChildren();actors.forEach((a,i)=>{if(a.hero)$('owner').add(new Option(a.name,String(i)))});$('owner').value=String(owner);const a=actors[selected];$('actor-notes').textContent=a&&a.notes||'';attackSelect.replaceChildren();
 if(a)a.attacks.forEach((at,i)=>attackSelect.add(new Option(at.name,String(i))));
 if(a)attackSelect.value=String(a.activeAttack||0);
 // Le menu des attaques ne paraît que s'il y a vraiment à choisir : la barre sous
 // « Attaque » appartient désormais aux cibles à portée.
 attackSelect.hidden=!a||a.attacks.length<2||!!equippedPool(a,catalog.items);scheduleSave()};
// Les entrées éditées restent du texte, y compris dans les boutons de sélection.
const rawLog=log;log=function(...args){rawLog(...args);scheduleSave()};
function scheduleSave(){if(loading)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,200)}
function snapshot(){return {version:8,actors,catalog,round,owner,selected,mapImage,maps,currentMapId,title:document.querySelector('.intro h1').textContent}}
function saveNow(){if(!db){$('save-status').textContent='Sauvegarde locale indisponible : cette session ne sera pas conservée.';return}try{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(snapshot(),'session');tx.oncomplete=()=>$('save-status').textContent='Enregistré sur cet appareil · pas de synchronisation multijoueur';tx.onerror=()=>$('save-status').textContent='Échec de sauvegarde (stockage plein ou bloqué). La session reste ouverte.'}catch(e){$('save-status').textContent='Impossible d’enregistrer : '+e.message}}
document.addEventListener('change',scheduleSave);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!loading)saveNow()});
function loadSession(){try{const req=indexedDB.open('amertume_online_v007',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onerror=finish;req.onblocked=finish;req.onsuccess=()=>{db=req.result;const get=db.transaction('state').objectStore('state').get('session');get.onerror=finish;get.onsuccess=()=>{const s=get.result;if(s&&(s.version===7||s.version===8)&&Array.isArray(s.actors)&&s.actors.length&&s.actors.some(a=>a.hero)){actors.splice(0,actors.length,...s.actors.map(normalizeActor));catalog=normalizeCatalog(s.catalog);round=s.round;owner=s.owner;selected=s.selected;mapImage=s.mapImage;maps=Array.isArray(s.maps)?s.maps:[];currentMapId=s.currentMapId||null;document.querySelector('.intro h1').textContent=s.title;if(mapImage){$('map-view').style.backgroundImage='url("'+mapImage+'")';$('map').classList.add('custom')}$('round').textContent=String(round).padStart(2,'0')}finish()}}}catch(e){finish()}}
function finish(){if(!loading)return;loading=false;cover.hidden=true;render();if(!db)$('save-status').textContent='Sauvegarde locale indisponible dans ce navigateur.'}
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
 cleanupImage();const original=URL.createObjectURL(file);imageJob={file,kind,accept,original,w,h,output:null,url:null};$('image-before').src=original;$('before-info').textContent=w+' × '+h+' · '+pretty(file.size);$('image-size').replaceChildren(...(kind==='map'?[2048,4096]:[256,512]).map(n=>new Option(n+' pixels',String(n))));$('image-size').value=kind==='map'?'4096':'512';$('image-quality').value='90';$('quality-label').textContent='90 %';$('image-error').textContent='';$('image-accept').disabled=true;imgDialog.showModal();await optimizeImage();
}catch(e){if(imgDialog.open)$('image-error').textContent=e.message;else log(e.message)}}
async function optimizeImage(){const job=imageJob;if(!job)return;const generation=++imageGeneration;$('image-accept').disabled=true;$('image-recalc').disabled=true;$('image-size').disabled=$('image-quality').disabled=true;$('image-error').textContent='Optimisation en cours…';let bitmap;try{bitmap=await createImageBitmap(job.file);if(job!==imageJob||generation!==imageGeneration)return;const factor=Math.min(1,Number($('image-size').value)/Math.max(bitmap.width,bitmap.height));const w=Math.max(1,Math.round(bitmap.width*factor)),h=Math.max(1,Math.round(bitmap.height*factor));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Le navigateur ne peut pas traiter cette image.');ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);let output=await new Promise(r=>canvas.toBlob(r,'image/webp',Number($('image-quality').value)/100));canvas.width=canvas.height=1;if(!output)throw Error('Compression impossible. Essaie une image plus petite.');if(job!==imageJob||generation!==imageGeneration)return;
 // Ne remplace pas un fichier déjà plus léger lorsqu'aucune réduction de dimensions n'est nécessaire.
 if(factor===1&&job.file.size<output.size)output=job.file;if(job.url)URL.revokeObjectURL(job.url);job.output=output;job.url=URL.createObjectURL(output);$('image-after').src=job.url;const gain=Math.round((1-output.size/job.file.size)*100);$('after-info').textContent=w+' × '+h+' · '+pretty(output.size)+' · '+(gain>=0?gain+' % de réduction':Math.abs(gain)+' % plus lourd')+' · '+(output.type||'image');$('image-error').textContent=output===job.file?'L’original est déjà plus léger : il sera conservé.':'';$('image-accept').disabled=false;
}catch(e){if(job===imageJob)$('image-error').textContent='Import impossible : '+e.message}finally{bitmap?.close();if(generation===imageGeneration){$('image-recalc').disabled=false;$('image-size').disabled=$('image-quality').disabled=false}}}
function cleanupImage(){imageGeneration++;if(imageJob){URL.revokeObjectURL(imageJob.original);if(imageJob.url)URL.revokeObjectURL(imageJob.url)}imageJob=null;$('image-before').removeAttribute('src');$('image-after').removeAttribute('src')}
$('image-quality').oninput=()=>{$('quality-label').textContent=$('image-quality').value+' %';$('image-accept').disabled=true};$('image-size').onchange=()=>{$('image-accept').disabled=true};$('image-recalc').onclick=optimizeImage;$('image-cancel').onclick=()=>imgDialog.close();imgDialog.addEventListener('close',cleanupImage);
$('image-accept').onclick=()=>{const job=imageJob;if(!job?.output||view!=='mj')return;$('image-accept').disabled=true;const reader=new FileReader();reader.onerror=()=>{$('image-error').textContent='Impossible de lire la copie optimisée.'};reader.onload=()=>{if(job!==imageJob)return;job.accept(reader.result);imgDialog.close();scheduleSave()};reader.readAsDataURL(job.output)};
$('mapfile').onchange=()=>{const file=$('mapfile').files[0];$('mapfile').value='';if(file)openImage(file,'map',url=>{mapImage=url;$('map-view').style.backgroundImage='url("'+url+'")';$('map').classList.add('custom');log('Carte optimisée et importée.');document.dispatchEvent(new Event('amertume-content-changed'))})};
loadSession();
