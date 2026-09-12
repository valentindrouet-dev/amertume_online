const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const editor=fs.readFileSync('editor.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(editor.slice(editor.indexOf('function imageDimensions'),editor.indexOf('let imageJob')),ctx);
const png=new Uint8Array(24),v=new DataView(png.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,4096);v.setUint32(20,2048);assert.equal(ctx.imageDimensions(png).join(','),'4096,2048');
const jpg=new Uint8Array([255,216,255,192,0,7,8,2,0,4,0,255,217]);assert.equal(ctx.imageDimensions(jpg).join(','),'1024,512');
const webp=new Uint8Array(30);webp.set(Buffer.from('RIFF'));webp.set(Buffer.from('WEBPVP8X'),8);webp[24]=255;webp[25]=1;webp[27]=255;assert.equal(ctx.imageDimensions(webp).join(','),'512,256');assert.throws(()=>ctx.imageDimensions(new Uint8Array(30)));
const c={window:{}};vm.runInNewContext(fs.readFileSync('catalog.js','utf8'),c);const cat=c.window.AMERTUME_CATALOG;assert.equal(cat.classes.length,4);
['Destructeur','Gardien','Lamevent','Mystique'].forEach(n=>{const k=cat.classes.find(x=>x.name===n);
 assert.ok(k,'classe manquante : '+n);assert.match(k.tint,/^#[0-9a-f]{6}$/);assert.ok(k.pv>0);
 assert.ok(k.id)});
assert.equal(new Set(cat.classes.map(k=>k.id)).size,4);
assert.equal(cat.items.filter(i=>i.category==='weapon').length,14);assert.equal(cat.items.filter(i=>i.category==='armor').length,5);assert.equal(cat.monsters.length,4);assert.equal(cat.monsters.find(m=>m.name==='Mystique déchu').attacks[0].dice.blue,2);
const {resolveAttack:r}=require('./combat.js');assert.equal(r({dice:[[5,0]],def:3,dmg:0,roll:()=>2}).damage,5);assert.equal(r({dice:[[5,0]],def:3,dmg:8,roll:()=>2}).damage,13);assert.equal(r({dice:[[1,0],[1,2]],def:0,dmg:8,roll:()=>2}).damage,0);
// Test de lecture des champs du formulaire sans navigateur.
const read=editor.slice(editor.indexOf('function readActor()'),editor.indexOf('function toMonster'));
const values={name:'<Éla>',role:'Gardienne',notes:'texte',state:'Aucun',socle:'medium',sexe:'Femme',race:'Humaine',hp:'99',max:'20',def:'7',dmg:'8',xp:'50',vie:'5',vieMax:'6',endu:'4',pvBonus:'0',level:'3',weapon1:'w',weapon2:'',armor:'a',shield:''};const elements=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]));elements.rapide={checked:true};elements.esquive={checked:false};for(let i=0;i<8;i++)elements['skill'+i]={value:'4'};
const gearApi=require('./combat.js');
const lire=inventaire=>{const t={structuredClone,keys:['white','bone','red','blue','green','black','yellow'],skillNames:Array(8).fill(''),templateIndex:null,draft:{hero:true},attackDraft:[{dice:{white:2}}],readAttacks(){},$:()=>({elements}),num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,catalog:{items:inventaire}};vm.createContext(t);vm.runInContext(read+';result=readActor()',t);return t.result};
const nu=lire([]);assert.equal(nu.sexe,'Femme');assert.equal(nu.race,'Humaine');assert.equal(nu.vieMax,6);assert.equal(nu.hp,20);assert.equal(nu.def,0);   // Aventurier sans armure ni bouclier : DEF nulle, la saisie ne compte pas.
// La DEF d'un aventurier est dérivée, celle d'un adversaire lui appartient.
assert.equal(gearApi.defenseOf({hero:true,def:9},[]),0);
assert.equal(gearApi.defenseOf({hero:true,def:9,armorId:'a',shieldId:'b'},[{id:'a',def:2},{id:'b',def:1}]),3);
assert.equal(gearApi.defenseOf({hero:false,def:5},[]),5);
assert.equal(gearApi.defenseOf({hero:false,def:5,armorId:'a'},[{id:'a',def:2}]),7); // Sur un adversaire, l'armure s'ajoute à sa DEF propre.
// L'équipement est l'affaire des aventuriers : une arme posée sur une créature ne
// rend pas muets les dés de sa carte d'attaque.
// Porter une arme ajoute une attaque, chez l'aventurier comme chez l'adversaire :
// elle vient en tête, si bien qu'une fiche d'avant ce choix retrouve son arme.
const ARSENAL=[{id:'e',name:'Épée',category:'weapon',hands:1,dice:{white:2,red:1}},{id:'d',name:'Dague',category:'weapon',hands:1,dice:{bone:1}},{id:'ar',name:'Armure',category:'armor',def:3}];
const bete={hero:false,def:4,weapons:['e','e'],armorId:'ar',attacks:[{name:'Griffes',dice:{white:1}},{name:'Souffle',dice:{red:2}}]};
assert.deepEqual(gearApi.attackChoices(bete,ARSENAL).map(x=>x.name),['Épée ×2','Griffes','Souffle']);
// Une arme à deux mains s'emploie seule : elle vaut son propre bouton, et une arme à
// distance l'est toujours — rapière au contact et arc au loin sont deux attaques.
const PANOPLIE=[{id:'rap',name:'Rapière',category:'weapon',hands:1,dice:{white:2}},
 {id:'arc',name:'Arc court',category:'weapon',ranged:true,dice:{red:2}},
 {id:'dag',name:'Dague',category:'weapon',hands:1,dice:{bone:1}},
 {id:'hache',name:'Hache lourde',category:'weapon',hands:2,dice:{black:3}}];
assert.deepEqual(gearApi.attackChoices({weapons:['rap','arc'],attacks:[]},PANOPLIE)
 .map(x=>x.name+'/'+x.range),['Rapière/contact','Arc court/distance']);
assert.deepEqual(gearApi.attackChoices({weapons:['rap','dag'],attacks:[]},PANOPLIE)
 .map(x=>x.name),['Rapière + Dague']);                       // Deux mains libres : une seule attaque.
assert.equal(gearApi.gearAttacks({weapons:['hache','hache']},PANOPLIE)[0].dice.black,6); // Deux exemplaires cumulent.
assert.equal(gearApi.weaponHands({ranged:true,hands:1}),2);  // Une arme à distance tient toujours à deux mains.
assert.equal(gearApi.weaponHands({hands:1}),1);
assert.equal(gearApi.weaponHands({}),2);                     // Sans précision, deux mains : c'est le cas courant.
// Un passage secret : un mur pour la troupe tant qu'il est clos, une porte une fois ouvert.
assert.equal(gearApi.doorHiddenFrom({secret:true,open:false},false),true);
assert.equal(gearApi.doorHiddenFrom({secret:true,open:false},true),false);   // Le MJ le voit toujours.
assert.equal(gearApi.doorHiddenFrom({secret:true,open:true},false),false);   // Ouvert, il est connu de tous.
assert.equal(gearApi.doorHiddenFrom({},false),false);
assert.equal(gearApi.doorLockedFor({secret:true,open:false},false),true);    // Le MJ seul l'ouvre.
assert.equal(gearApi.doorLockedFor({secret:true,open:false},true),false);
assert.equal(gearApi.doorLockedFor({secret:true,open:true},false),false);    // Ouvert, chacun le referme.
assert.equal(gearApi.doorLockedFor({keyLocked:true},false),true);
assert.equal(gearApi.doorLockedFor({},false),false);
assert.equal(gearApi.chosenAttack(bete,ARSENAL).name,'Épée ×2');          // Sans choix, l'arme décide.
assert.equal(gearApi.chosenAttack(bete,ARSENAL).dice.white,4);            // Deux exemplaires cumulent.
assert.equal(gearApi.chosenAttack({...bete,activeAttack:2},ARSENAL).name,'Souffle');
assert.equal(gearApi.chosenAttack({...bete,activeAttack:9},ARSENAL).name,'Épée ×2'); // Choix caduc : la première.
assert.equal(gearApi.gearAttacks({weapons:['e','d']},ARSENAL)[0].name,'Épée + Dague');
assert.deepEqual(gearApi.gearAttacks({weapons:['ar']},ARSENAL),[]);       // Une armure n'est pas une attaque.
assert.deepEqual(gearApi.gearAttacks({weapons:[]},ARSENAL),[]);
assert.deepEqual(gearApi.attackChoices({attacks:[{name:'Griffes'}]},ARSENAL).map(x=>x.name),['Griffes']);
assert.deepEqual(gearApi.attackChoices({},ARSENAL),[]);                   // Ni fiche ni arme : rien à choisir.
/* Un adversaire peut n'avoir aucune attaque : on ne lui en invente plus une. Mais un
   modèle d'avant, qui portait ses dés à la racine sans liste d'attaques, garde les siens. */
{const {cleanMonster}=require('./combat.js');
 assert.deepEqual(cleanMonster({name:'Statue',attacks:[]}).attacks,[]);      // Liste vide : elle reste vide.
 assert.deepEqual(cleanMonster({name:'Brume'}).attacks,[]);                   // Ni liste ni dés : aucune attaque.
 const legs=cleanMonster({name:'Gobelin',dice:{white:2}});
 assert.equal(legs.attacks.length,1);                                        // Dés à la racine : ils sont sauvés…
 assert.equal(legs.attacks[0].dice.white,2);                                 // … avec leur compte.
 assert.equal(legs.attacks[0].name,'Attaque');
 // Une liste explicite l'emporte toujours sur les dés de la racine.
 assert.deepEqual(cleanMonster({name:'Gobelin',dice:{white:2},attacks:[]}).attacks,[]);
 assert.equal(cleanMonster({name:'Gobelin',dice:{white:2},attacks:[{name:'Griffes'}]}).attacks.length,1);}
assert.equal(gearApi.chosenAttack({},ARSENAL).dice,null);
// La DEF : celle de l'équipement pour un aventurier, la sienne plus l'équipement pour un adversaire.
assert.equal(gearApi.defenseOf({hero:true,def:9,armorId:'ar'},ARSENAL),3);
assert.equal(gearApi.defenseOf({hero:false,def:4,armorId:'ar'},ARSENAL),7);
assert.equal(gearApi.defenseOf({hero:false,def:4},ARSENAL),4);
// Deux exemplaires de la même arme : les dés s'additionnent comme deux armes distinctes.
const epee={id:'e',dice:{white:2,red:1}};
assert.deepEqual(gearApi.equippedPool({weapons:['e']},[epee]).slice(0,4),[2,0,1,0]);
assert.deepEqual(gearApi.equippedPool({weapons:['e','e']},[epee]).slice(0,4),[4,0,2,0]);
assert.deepEqual(gearApi.equippedPool({weapons:['e','e']},[{id:'e',dice:{white:9}}]).slice(0,1),[12]); // Plafond à douze.
assert.equal(nu.dmg,8);assert.equal(nu.skills[0],4);assert.equal(nu.pool[0],2);assert.equal(nu.name,'<Éla>');
// Équipé : les dés viennent de l'arme et la DEF de l'armure, pas des champs saisis.
const equipe=lire([{id:'w',category:'weapon',dice:{white:3}},{id:'a',category:'armor',slot:'body',def:5}]);
assert.equal(equipe.pool[0],3);assert.equal(equipe.def,5);
// Portée de contact et ligne de vue, en pixels de carte affichée.
const {contactRadius,tokenDistance,inContact,sightBlockers,hasLineOfSight}=require('./combat.js');const size={width:800,height:400},TOKEN=46;
assert.equal(contactRadius(TOKEN),69);assert.equal(tokenDistance({x:10,y:50},{x:20,y:50},size),80);
assert.ok(inContact({x:50,y:50},{x:54,y:50},size,TOKEN));assert.ok(!inContact({x:50,y:50},{x:70,y:50},size,TOKEN));
// Contact au socle : le disque fait 69 px de rayon, un socle de 23 px le touche jusqu'à 92 px.
assert.ok(inContact({x:50,y:50},{x:59,y:50},size,TOKEN));assert.ok(inContact({x:50,y:50},{x:61.5,y:50},size,TOKEN));assert.ok(!inContact({x:50,y:50},{x:61.6,y:50},size,TOKEN));
assert.ok(hasLineOfSight({x:10,y:50},{x:90,y:50},[{x:50,y:20}],size,TOKEN));
assert.ok(!hasLineOfSight({x:10,y:50},{x:90,y:50},[{x:50,y:51}],size,TOKEN));
assert.equal(sightBlockers({x:10,y:50},{x:90,y:50},[{x:50,y:50},{x:50,y:20}],size,TOKEN).length,1);
assert.ok(hasLineOfSight({x:10,y:50},{x:90,y:50},[{x:2,y:50}],size,TOKEN)); // Derrière le tireur : ne bloque pas.
// Murs : un carré de 10 à 20 en pourcentages de carte.
const {wallsBetween}=require('./combat.js');const MUR=[[[10,10],[20,10],[20,20],[10,20]]];
assert.ok(wallsBetween({x:5,y:15},{x:25,y:15},MUR));   // Traverse le mur de part en part.
assert.ok(!wallsBetween({x:5,y:5},{x:25,y:5},MUR));    // Passe au-dessus.
assert.ok(!wallsBetween({x:5,y:15},{x:9,y:15},MUR));   // S'arrête avant le mur.
assert.ok(!wallsBetween({x:12,y:12},{x:18,y:18},MUR)); // Entièrement à l'intérieur.
assert.ok(!wallsBetween({x:5,y:15},{x:25,y:15},[]));   // Aucun mur défini.
// Équipement : dés de l'arme, portée et DEF de l'armure.
const {equippedPool,equippedRanged,equippedDef,slideOutOfWalls}=require('./combat.js');
const OBJETS=[{id:'ep',category:'weapon',dice:{white:2}},{id:'dg',category:'weapon',dice:{white:1,bone:1}},{id:'arc',category:'weapon',ranged:true,dice:{white:1,red:1}},{id:'ma',category:'armor',slot:'body',def:3},{id:'bo',category:'armor',slot:'shield',def:1}];
assert.deepEqual(equippedPool({weapons:['ep']},OBJETS),[2,0,0,0,0,0,0]);
assert.deepEqual(equippedPool({weapons:['ep','dg']},OBJETS),[3,1,0,0,0,0,0]); // Deux armes cumulent.
assert.equal(equippedPool({weapons:[]},OBJETS),null);                        // Rien d'équipé : dés propres.
assert.equal(equippedRanged({weapons:['ep']},OBJETS),false);
assert.equal(equippedRanged({weapons:['ep','arc']},OBJETS),true);            // Une arme à distance suffit.
assert.equal(equippedRanged({weapons:[]},OBJETS),null);
assert.equal(equippedDef({armorId:'ma',shieldId:'bo'},OBJETS),4);
assert.equal(equippedDef({armorId:'ma'},OBJETS),3);
assert.equal(equippedDef({},OBJETS),null);
// Collision : carré de 10 à 30, socle de rayon 5.
const CARRE=[[[10,10],[30,10],[30,30],[10,30]]];
assert.deepEqual(slideOutOfWalls([2,20],CARRE,5),[2,20]);   // Assez loin : inchangé.
assert.deepEqual(slideOutOfWalls([7,20],CARRE,5),[5,20]);   // Trop près : repoussé au contact.
assert.deepEqual(slideOutOfWalls([12,20],CARRE,5),[5,20]);  // Entré dans le mur : ressorti.
assert.deepEqual(slideOutOfWalls([12,25],CARRE,5),[5,25]);  // Glissement : l'axe libre est conservé.
assert.deepEqual(slideOutOfWalls([20,20],[],5),[20,20]);    // Sans mur, rien ne bouge.
const {segmentHitsPolys}=require('./combat.js');
assert.ok(segmentHitsPolys([5,20],[35,20],CARRE));   // Bond au travers : détecté.
assert.ok(!segmentHitsPolys([5,5],[35,5],CARRE));    // Bond au-dessus : libre.
// Cartes de combat : obstacles et zone de départ.
const {obstaclesFrom,spreadInZone,contoursOf,shapeContains,unionContours,polygonArea:aireDe}=require('./combat.js');
const CARTE={walls:[{x:10,y:10,w:20,h:5}],doors:[{x:40,y:10,w:5,h:10,open:false},{x:60,y:10,w:5,h:10,open:true}],start:{x:5,y:70,w:20,h:20}};
assert.equal(obstaclesFrom(CARTE).length,2);                  // Le mur et la porte fermée ; l'ouverte ne bloque pas.
assert.equal(contoursOf(obstaclesFrom(CARTE)[0]).length,1);
assert.equal(aireDe(contoursOf(obstaclesFrom(CARTE)[0])[0]),20*5);   // Le contour épouse la zone.
assert.equal(obstaclesFrom(null).length,0);
assert.equal(contoursOf(obstaclesFrom({walls:[{x:1,y:1,w:0,h:5}]})[0]).length,0); // Rectangle plat : ignoré.
const places=spreadInZone(5,CARTE.start);
assert.equal(places.length,5);
assert.ok(places.every(p=>p.x>=5&&p.x<=25&&p.y>=70&&p.y<=90));   // Tous dans la zone.
assert.equal(new Set(places.map(p=>p.x+':'+p.y)).size,5);        // Aucun doublon de position.
assert.deepEqual(spreadInZone(3,null),[]);
// Une carte d'avant, avec sa zone de vision : fondue en matière, la pièce creusée y est un trou.
const FROMAGE={walls:[{x:20,y:20,w:60,h:40}],visions:[{x:30,y:30,w:40,h:20}],doors:[]};
const troues=obstaclesFrom(FROMAGE);
// Un contour extérieur et un contour de creux : la matière est un anneau.
assert.equal(contoursOf(troues[0]).length,2);
assert.ok(shapeContains(troues[0],[22,40]));   // Dans l'épaisseur : c'est du plein.
assert.ok(!shapeContains(troues[0],[50,40]));  // Dans la pièce creusée : c'est du vide.
assert.ok(!wallsBetween({x:35,y:40},{x:65,y:40},troues));  // À l'intérieur de la pièce : dégagé.
assert.ok(wallsBetween({x:10,y:40},{x:90,y:40},troues));   // De part en part : le plein bloque.
assert.ok(wallsBetween({x:50,y:10},{x:50,y:90},troues));   // Verticalement aussi.
// Une porte fermée n'est jamais creusée par une zone de vision.
assert.equal(obstaclesFrom({walls:[],visions:[{x:0,y:0,w:100,h:100}],doors:[{x:40,y:40,w:5,h:5,open:false}]}).length,2);
// Brouillard : un mur plein coupe la carte en deux, un héros ne voit que son côté.
const {rectPolygon,visionPolygon,polygonArea,fillPolygonGrid,packMask,unpackMask,maskChars,pointInPolygon}=require('./combat.js');
/* Vision exacte : le polygone vu doit dire la même chose que le test segment par segment. */
assert.equal(polygonArea(visionPolygon({x:50,y:50},[],null)).toFixed(2),'10000.00'); // Sans obstacle : toute la carte.
const MUR_PLEIN=[{contours:[rectPolygon({x:40,y:20,w:20,h:4})]}];
const VUE=visionPolygon({x:50,y:50},MUR_PLEIN,null);
assert.ok(polygonArea(VUE)<10000);
assert.ok(pointInPolygon([50,40],VUE));   // Devant le mur : vu.
assert.ok(!pointInPolygon([50,10],VUE));  // Derrière : caché.
assert.ok(pointInPolygon([10,10],VUE));   // De côté : vu.
// Accord complet avec wallsBetween sur un plan chargé, hors bords des obstacles.
const dedale=[];for(let i=0;i<8;i++){dedale.push({x:6+i*11,y:12,w:2,h:26});dedale.push({x:6+i*11,y:56,w:2,h:26})}
for(let j=0;j<6;j++)dedale.push({x:6,y:12+j*14,w:88,h:2});
const TROUS=Array.from({length:30},(_,i)=>({x:7+(i*7)%84,y:13+(i*11)%74,w:4,h:4}));
const C=require('./combat.js');
const LABYRINTHE={ratio:16/9,walls:dedale,visions:TROUS,doors:[]};
const FORMES=[{contours:C.contoursMatiere(LABYRINTHE)}];
for(const o of [{x:22.7,y:74.3},{x:50.5,y:47.3}]){const vision=visionPolygon(o,FORMES,null);let compares=0;
 for(let i=0;i<1500;i++){const p=[(i*37.13)%100,(i*61.7)%100];
  if([...dedale,...TROUS].some(r=>p[0]>r.x-.3&&p[0]<r.x+r.w+.3&&p[1]>r.y-.3&&p[1]<r.y+r.h+.3))continue;
  assert.equal(pointInPolygon(p,vision),!wallsBetween(o,{x:p[0],y:p[1]},FORMES));compares++}
 assert.ok(compares>800)}
/* Une arme qui inflige un état le porte dans son attaque, et le pose sur qui elle touche. */
{const {gearAttacks:armesAtt,infligeEtat,etatsDArmes,hasState,bleedOf}=require('./combat.js');
 const stock=[{id:'w1',category:'weapon',name:'Dague',hands:1,etat:'Saignée',dice:{white:1}},
  {id:'w2',category:'weapon',name:'Torche',hands:1,etat:'Feu',dice:{red:1}},
  {id:'w3',category:'weapon',name:'Bâton',hands:2,dice:{bone:2}}];
 assert.deepEqual(etatsDArmes([stock[0],stock[1],stock[0]]),['Saignée','Feu']);  // Sans doublon.
 const deux=armesAtt({weapons:['w1','w2']},stock);
 assert.deepEqual(deux[0].etats,['Saignée','Feu']);        // Les deux mains cumulent leurs états.
 assert.deepEqual(armesAtt({weapons:['w3']},stock)[0].etats,[]); // Une arme sans état n'en pose aucun.
 const {compteEtat,ajouteEtat,setState,cumulable}=require('./combat.js');
 const cible={hp:10,max:10,states:[],bleed:0,cumuls:{}};
 // Saignée, Feu, Foudre et Poison s'empilent ; les autres se posent une fois.
 for(const e of ['Saignée','Feu','Foudre','Poison']){assert.ok(cumulable(e),e);
  assert.ok(infligeEtat(cible,e));assert.equal(compteEtat(cible,e),1,e);
  assert.ok(infligeEtat(cible,e));assert.equal(compteEtat(cible,e),2,e)}
 assert.equal(bleedOf(cible),2);                           // L'ancien compte lit le nouveau.
 assert.ok(infligeEtat(cible,'Gel'));assert.equal(compteEtat(cible,'Gel'),1);
 assert.ok(!infligeEtat(cible,'Gel'));                     // Deux fois le même : rien de neuf.
 assert.equal(compteEtat(cible,'Gel'),1);
 // Un état levé ne revient pas chargé de ses crans.
 setState(cible,'Feu',false);assert.equal(compteEtat(cible,'Feu'),0);
 assert.ok(infligeEtat(cible,'Feu'));assert.equal(compteEtat(cible,'Feu'),1);
 setState(cible,'Saignée',false);assert.equal(bleedOf(cible),0);assert.equal(cible.bleed,0);
 // On redescend aussi : à zéro cran, l'état s'en va.
 ajouteEtat(cible,'Poison',-1);assert.equal(compteEtat(cible,'Poison'),1);
 ajouteEtat(cible,'Poison',-1);assert.ok(!hasState(cible,'Poison'));
 /* L'Onde est un bouclier : elle absorbe l'affliction qui arrive, d'où qu'elle vienne,
    et se consume. Les états bénéfiques ne la réveillent pas. */
 const garde={hp:10,max:10,states:['Onde'],bleed:0,cumuls:{}};
 assert.equal(infligeEtat(garde,'Feu'),'onde');
 assert.ok(!hasState(garde,'Feu'));assert.ok(!hasState(garde,'Onde'));
 assert.equal(infligeEtat(garde,'Feu'),true);      // L'Onde consumée, le suivant passe.
 const beni={hp:10,max:10,states:['Onde'],bleed:0,cumuls:{}};
 assert.equal(infligeEtat(beni,'Blindage'),true);  // Un état bénéfique ne la consume pas.
 assert.ok(hasState(beni,'Onde'));}
/* L'ordre canonique des cibles : Boss, Solitaire, Alpha, sbires ; à type égal l'alphabet ;
   à nom égal la place dans la liste, qui est le numéro porté sur le socle. */
{const {ordreCibles,rangType,cleClasse,classeDe}=require('./combat.js');
 const m=(name,type)=>({name,type,hero:false});
 const troupe=[[m('Gobelin','standard'),0],[m('Reine','boss'),1],[m('Alpha des bois','alpha'),2],
  [m('Gobelin','standard'),3],[m('Ermite','solitaire'),4],[m('Brute','standard'),5]];
 assert.deepEqual(ordreCibles(troupe).map(([o,i])=>o.name+i),
  ['Reine1','Ermite4','Alpha des bois2','Brute5','Gobelin0','Gobelin3']);
 // Deux monstres du même nom : la place dans la liste tranche, donc le numéro du socle.
 assert.deepEqual(ordreCibles([[m('Gobelin','standard'),7],[m('Gobelin','standard'),2]])
  .map(([,i])=>i),[2,7]);
 assert.equal(rangType({name:'Éla',hero:true}),3);        // Un aventurier compte comme un sbire.
 assert.equal(rangType({type:'inconnu'}),3);              // Un type inattendu aussi.
 assert.equal(rangType(null),3);
 assert.deepEqual(ordreCibles(null),[]);
 // Les classes du jeu, reconnues sur la seule tête du rôle.
 const classes=[{name:'Destructeur',tint:'#b0452e',pv:16},{name:'Mystique',tint:'#7a5cb8',pv:10}];
 assert.equal(cleClasse('Mystique · Voie du gel'),'mystique');
 assert.equal(classeDe(classes,'mystique').pv,10);
 assert.equal(classeDe(classes,'Destructeur · Ruine').tint,'#b0452e');
 assert.equal(classeDe(classes,'Aventurier'),null);
 assert.equal(classeDe(classes,''),null);}
/* Un talent porte l'effet qu'il applique, et non plus son seul nom : le nom est au
   joueur, la mécanique au moteur. Le nom réduit ne sert qu'à reprendre les anciens. */
{const {cleTalent,talentCode,paramsTalent,reglageTalent,TALENTS_CODES}=require('./combat.js');
 assert.equal(cleTalent('Lamevent'),'lamevent');
 assert.equal(cleTalent('  LAME-VENT '),'lamevent');
 assert.equal(cleTalent('Lâmevént'),'lamevent');
 assert.equal(talentCode({effet:'lamevent'}),TALENTS_CODES.lamevent);
 assert.equal(talentCode({name:'Lamevent'}),null);       // Le nom seul ne suffit plus.
 assert.equal(talentCode({effet:'inconnu'}),null);
 assert.equal(talentCode(null),null);
 const code=TALENTS_CODES.lamevent;
 // Les réglages sont relus au travers de leur déclaration : bornés, et jamais absents.
 assert.deepEqual(paramsTalent({effet:'lamevent'}),{cibles:'1',bonus:0,etat:'',mode:'plus'});
 assert.deepEqual(paramsTalent({effet:'lamevent',params:{cibles:'tous',bonus:'7',etat:'Feu',mode:'place'}}),
  {cibles:'tous',bonus:7,etat:'Feu',mode:'place'});
 /* Un choix hors de la liste, un nombre hors des bornes, ou un talent enregistré avant que
    ces réglages n'existent : chacun retombe sur son défaut sans rien casser. */
 assert.deepEqual(paramsTalent({effet:'lamevent',params:{cibles:1,bonus:-5,etat:'Dragon',mode:'x'}}),
  {cibles:'1',bonus:0,etat:'',mode:'plus'});
 assert.equal(paramsTalent({effet:''}),null);
 assert.equal(reglageTalent(code,{},'inexistant'),undefined);
 /* La phrase d'un effet est bâtie par le moteur, réglages en gras : la bibliothèque et la
    fiche du talent la lisent au même endroit, elle ne peut donc pas mentir. */
 const {phraseTalent}=require('./combat.js');
 assert.match(phraseTalent('lamevent'),/<b>bonus de dégâts<\/b> à <b>un<\/b> adversaire au contact/);
 assert.match(phraseTalent('lamevent',{cibles:'2',bonus:2,etat:'Gel'}),
  /<b>bonus de dégâts \+ 2<\/b> et <b>Gel<\/b> à <b>deux<\/b> adversaires au contact/);
 assert.match(phraseTalent('lamevent',{cibles:'tous'}),/<b>tous les adversaires<\/b> au contact/);
 // L'état à la place des dégâts : la phrase le dit, et le moteur ne retire alors aucun PV.
 assert.match(phraseTalent('lamevent',{cibles:'tous',etat:'Feu',mode:'place'}),
  /inflige <b>Feu<\/b> à <b>tous les adversaires<\/b> au contact, <b>sans dégâts<\/b>/);
 assert.equal(phraseTalent('inconnu'),'');}
const {simplifyClosed,closestOnSegment,encreDroite,wallShape,polyTouchesDisc,rectInReach}=require('./combat.js');
/* ====================================================================================
   LA MATIÈRE EST EXACTE : CHAQUE OUTIL LAISSE EXACTEMENT SA FORME
   Plus de trame, plus de lissage : bloquer unit la forme de l'outil à la matière,
   découper l'en soustrait, et le contour obtenu a les sommets du geste, ni plus ni moins.
   ==================================================================================== */
const carteVide=()=>({ratio:16/9,doors:[]});
const rectP=(x,y,w,h)=>rectPolygon({x,y,w,h});
const sommets=m=>C.matiereDe(m).map(p=>p.anneaux.map(r=>r.length));
// Deux blocs jointifs fondent en un polygone : quatre sommets, sans couture au milieu.
{const m=carteVide();C.ajouteMatiere(m,rectP(0,0,10,10));C.ajouteMatiere(m,rectP(10,0,10,10));
 assert.deepEqual(sommets(m),[[4]]);
 assert.equal(aireDe(C.matiereDe(m)[0].anneaux[0]),200);}
// Deux blocs à l'écart restent deux zones ; un troisième qui les relie n'en fait qu'une.
{const m=carteVide();C.ajouteMatiere(m,rectP(0,0,10,10));C.ajouteMatiere(m,rectP(30,0,10,10));
 assert.equal(C.matiereDe(m).length,2);
 C.ajouteMatiere(m,rectP(8,3,24,4));assert.equal(C.matiereDe(m).length,1);}
// Une découpe rectangulaire au milieu : un trou de quatre sommets, aux coins tracés, l'aire exacte.
{const m=carteVide();C.ajouteMatiere(m,rectP(10,10,60,40));C.retireMatiere(m,rectP(30,20,20,10));
 assert.deepEqual(sommets(m),[[4,4]]);
 const [ext,trou]=C.matiereDe(m)[0].anneaux;
 assert.equal(aireDe(ext)-aireDe(trou),2400-200);
 for(const coin of [[30,20],[50,20],[50,30],[30,30]])assert.ok(trou.some(p=>p[0]===coin[0]&&p[1]===coin[1]),'coin '+coin);}
// Une découpe qui mord le bord entame le contour, sans faire de trou.
{const m=carteVide();C.ajouteMatiere(m,rectP(10,10,60,40));C.retireMatiere(m,rectP(0,20,20,10));
 assert.deepEqual(sommets(m),[[8]]);assert.equal(aireDe(C.matiereDe(m)[0].anneaux[0]),2400-100);}
// Une découpe en biais : la coupe est la droite tracée, chaque sommet exactement dessus, aucune marche.
{const m=carteVide();C.ajouteMatiere(m,rectP(20,30,60,8));
 const bande=[[10,55],[70,-5],[75,0],[15,60]];C.retireMatiere(m,bande);
 const polys=C.matiereDe(m);assert.equal(polys.length,2);          // Le mur est coupé en deux.
 for(const p of polys)for(const c of p.anneaux){assert.ok(c.length<=6,c.length+' sommets');
  for(const q of c){let d=Infinity;
   for(let k=0,j=bande.length-1;k<bande.length;j=k++){const t=closestOnSegment(q,bande[j],bande[k]);
    d=Math.min(d,Math.hypot(q[0]-t[0],q[1]-t[1]))}
   const bord=Math.min(Math.abs(q[0]-20),Math.abs(q[0]-80),Math.abs(q[1]-30),Math.abs(q[1]-38));
   assert.ok(Math.min(d,bord)<1e-6,'sommet à '+d.toFixed(4)+' du tracé')}}}
// Une ellipse à main levée creuse exactement l'ellipse dessinée : mêmes sommets, même aire.
{const m=carteVide();C.ajouteMatiere(m,rectP(20,30,60,40));
 const ell=Array.from({length:64},(_,i)=>{const a=i/64*2*Math.PI;return [50+18*Math.cos(a),50+12*Math.sin(a)]});
 C.retireMatiere(m,ell);
 const [ext,trou]=C.matiereDe(m)[0].anneaux;
 assert.equal(ext.length,4);assert.equal(trou.length,64);
 assert.ok(Math.abs(aireDe(trou)-aireDe(ell))<1e-6);}
// La main tremble : l'encre redressée ne garde que les angles voulus, et la coupe est droite.
{const NET=[[70,2],[96,28],[99,25],[73,-1]];let g=1;const al=()=>{g=(g*1103515245+12345)%2147483648;return g/2147483648-.5};
 const MAIN=[];{const A=[70,2],B=[96,28],n=44;
  for(let i=0;i<=n;i++)MAIN.push([A[0]+(B[0]-A[0])*i/n+al()*.5,A[1]+(B[1]-A[1])*i/n+al()*.5]);
  for(let i=n;i>=0;i--)MAIN.push([A[0]+3+(B[0]-A[0])*i/n,A[1]-3+(B[1]-A[1])*i/n])}
 assert.equal(encreDroite([MAIN])[0].length,NET.length);
 const m=carteVide();C.ajouteMatiere(m,rectP(60,0,40,40));const droite=encreDroite([MAIN])[0];C.retireMatiere(m,droite);
 // Chaque sommet est sur la bande redressée ou sur le bord du bloc : rien n'est inventé.
 for(const c of C.contoursMatiere(m)){assert.ok(c.length<=10,c.length+' sommets après la main');
  for(const q of c){let d=Infinity;
   for(let k=0,j=droite.length-1;k<droite.length;j=k++){const t=closestOnSegment(q,droite[j],droite[k]);d=Math.min(d,Math.hypot(q[0]-t[0],q[1]-t[1]))}
   const bord=Math.min(Math.abs(q[0]-60),Math.abs(q[0]-100),Math.abs(q[1]-0),Math.abs(q[1]-40));
   assert.ok(Math.min(d,bord)<1e-6,'sommet inventé à '+d.toFixed(4))}}}
// Une ligne de blocage en biais est un quadrilatère exact, fondu dans la matière qu'elle touche.
{const m=carteVide();C.ajouteMatiere(m,rectP(10,10,10,10));
 const trait={x1:20,y1:15,x2:50,y2:40,e:.6};C.ajouteMatiere(m,C.traitPolygon(trait,m.ratio));
 assert.equal(C.matiereDe(m).length,1);assert.equal(C.matiereDe(m)[0].anneaux.length,1);
 assert.ok(C.wallsBetween({x:35,y:20},{x:35,y:35},C.obstaclesFrom(m)));   // Elle arrête la vue.
 assert.ok(!C.wallsBetween({x:60,y:5},{x:60,y:45},C.obstaclesFrom(m)));   // Ailleurs, non.
 // Un trait à l'écart est une zone à lui seul.
 C.ajouteMatiere(m,C.traitPolygon({x1:70,y1:70,x2:90,y2:90,e:.3},m.ratio));assert.equal(C.matiereDe(m).length,2);}
// Le pinceau : un appui laisse un rond — rond à l'écran, l'abscisse étirée du rapport —, un pas une capsule.
{const rond=C.capsulePolygon({x:20,y:20},{x:20,y:20},2,16/9);
 assert.equal(rond.length,24);
 const rx=Math.max(...rond.map(p=>p[0]))-20,ry=Math.max(...rond.map(p=>p[1]))-20;
 assert.ok(Math.abs(rx*16/9-ry)<1e-9);assert.ok(Math.abs(ry-16/9)<1e-9);   // Épaisseur 2 % de la largeur.
 const cap=C.capsulePolygon({x:10,y:10},{x:30,y:10},2,16/9);
 assert.equal(cap.length,26);
 assert.ok(cap.every(p=>p[0]>=9-1e-9&&p[0]<=31+1e-9&&Math.abs(p[1]-10)<=16/9+1e-9));
 // La gomme ôte exactement la capsule : un trou de vingt-six sommets dans un bloc intact.
 const m=carteVide();C.ajouteMatiere(m,rectP(0,0,60,40));
 C.retireMatiere(m,C.capsulePolygon({x:20,y:20},{x:40,y:20},3,m.ratio));
 assert.deepEqual(sommets(m),[[4,26]]);
 // Et deux touches qui se suivent ne font qu'une zone, sans couture.
 const n=carteVide();C.ajouteMatiere(n,C.capsulePolygon({x:20,y:20},{x:20,y:20},3,n.ratio));
 C.ajouteMatiere(n,C.capsulePolygon({x:20,y:20},{x:24,y:21},3,n.ratio));
 assert.equal(C.matiereDe(n).length,1);assert.equal(C.matiereDe(n)[0].anneaux.length,1);}
/* Le donjon aux murs minces : chaque coin de chaque mur est un sommet exact, découpes
   rectangulaires comprises, et pas une arête de biais — tout est comme tracé. */
{const m=carteVide();
 for(const r of [{x:10,y:10,w:60,h:1.2},{x:10,y:10,w:1.2,h:50},{x:68.8,y:10,w:1.2,h:50},{x:10,y:58.8,w:60,h:1.2},
  {x:30,y:20,w:1.2,h:20},{x:30,y:20,w:18,h:1.2},{x:20,y:40,w:25,h:1.2},{x:44,y:30,w:1.2,h:12}])C.ajouteMatiere(m,rectPolygon(r));
 for(const r of [{x:33,y:20,w:6,h:1.4},{x:30,y:26,w:1.4,h:5},{x:25,y:40,w:5,h:1.4}])C.retireMatiere(m,rectPolygon(r));
 const tous=C.contoursMatiere(m).flat();
 // (30,40) n'est pas un sommet : la cloison verticale y prolonge le bord, en ligne droite.
 for(const coin of [[10,10],[70,10],[70,60],[10,60],[33,20],[39,20],[25,40],[30,41.2]])
  assert.ok(tous.some(p=>Math.abs(p[0]-coin[0])<1e-9&&Math.abs(p[1]-coin[1])<1e-9),'coin '+coin);
 for(const c of C.contoursMatiere(m))for(let i=0;i<c.length;i++){const a=c[i],b=c[(i+1)%c.length];
  assert.ok(Math.abs(a[0]-b[0])<1e-9||Math.abs(a[1]-b[1])<1e-9,'arête de biais')}}
/* Les portes. Une porte perce son rectangle, prolongé sur l'épaisseur d'un mur mince pour
   n'y laisser aucun fil ; close, elle rebouche le même trou. Un gros bloc ne se creuse
   que de la porte elle-même. */
{const m={ratio:16/9,matiere:[{anneaux:[rectP(10,40,80,10)]}],doors:[{x:48,y:42,w:6,h:6,open:false}]};
 const trou=C.trouPorte(m.doors[0],m),boite=pts=>({x:Math.min(...pts.map(p=>p[0])),y:Math.min(...pts.map(p=>p[1])),
  x2:Math.max(...pts.map(p=>p[0])),y2:Math.max(...pts.map(p=>p[1]))}),bt=boite(trou);
 assert.equal(trou.length,4);
 assert.ok(bt.y<=40&&bt.y2>=50,'prolongée à travers le mur : '+JSON.stringify(trou));
 assert.ok(Math.abs(bt.x-48)<1e-9&&Math.abs(bt.x2-54)<1e-9,'largeur gardée : '+JSON.stringify(bt));
 assert.equal(C.wallShape(m).contours.length,2);                            // Le mur est coupé en deux.
 assert.ok(C.wallsBetween({x:51,y:20},{x:51,y:70},C.obstaclesFrom(m)));    // Close : vue coupée.
 m.doors[0].open=true;
 assert.ok(!C.wallsBetween({x:51,y:20},{x:51,y:70},C.obstaclesFrom(m)));   // Ouverte : vue libre.
 assert.ok(C.wallsBetween({x:30,y:20},{x:30,y:70},C.obstaclesFrom(m)));    // À côté, le mur tient.
 // Un passage secret clos ne perce rien ; ouvert, il perce comme une porte.
 const secret={ratio:16/9,matiere:[{anneaux:[rectP(10,40,80,10)]}],doors:[{x:48,y:42,w:6,h:6,open:false,secret:true}]};
 assert.equal(C.wallShape(secret).contours.length,1);
 secret.doors[0].open=true;assert.equal(C.wallShape(secret).contours.length,2);
 const bloc={ratio:16/9,matiere:[{anneaux:[rectP(0,0,100,100)]}],doors:[{x:48,y:42,w:6,h:6,open:true}]};
 assert.deepEqual(C.trouPorte(bloc.doors[0],bloc).map(p=>p.map(v=>+v.toFixed(9))),[[48,42],[48,48],[54,48],[54,42]]);}
/* Les portes de biais. Une porte garde son rectangle et gagne un angle ; sans angle, elle
   est la porte d'avant bit pour bit. Tracée le long d'un mur incliné, elle en prend
   l'épaisseur, le perce en deux, le bloque close et le libère ouverte. */
{const R=16/9;
 assert.deepEqual(C.doorPolygon({x:10,y:20,w:6,h:2},R),rectPolygon({x:10,y:20,w:6,h:2}));   // Sans angle : le rectangle.
 // Tournée de 90°, une porte large devient debout : ses coins sont ceux du rectangle transposé autour du centre.
 const debout=C.doorPolygon({x:10,y:20,w:6,h:2,a:90},R).map(p=>p.map(v=>+v.toFixed(6)));
 const cx=13,cy=21,hw=3*R,hh=1;   // en unités d'écran : demi-longueur 3·R, demi-épaisseur 1
 const attendu=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[+((cx*R-t*hh)/R).toFixed(6),+(cy+s*hw).toFixed(6)]);
 assert.deepEqual(debout,attendu);
 /* La poignée de rotation : posée au-dessus du centre, elle amène la porte sur le curseur.
    Maj par crans de quinze degrés ; sans rien, aimantée aux angles droits et à 45°. */
 const c={x:50,y:50};
 assert.equal(C.anglePoignee(c,{x:50,y:40},R),0);                       // Poignée en haut : droite.
 assert.equal(C.anglePoignee(c,{x:60,y:50},R),90);                      // À droite : debout.
 assert.equal(C.anglePoignee(c,{x:50,y:60},R),0);                       // En bas : droite aussi — pas de sens.
 assert.equal(C.anglePoignee(c,{x:50+10/R,y:40},R),45);                 // Diagonale d'écran : 45°.
 assert.equal(C.anglePoignee(c,{x:50+Math.tan(3*Math.PI/180)*10/R,y:40},R),0);   // À 3° : aimantée.
 assert.equal(C.anglePoignee(c,{x:50+Math.tan(23*Math.PI/180)*10/R,y:40},R,true),30);   // Maj : au cran de 15.
 assert.equal(C.anglePoignee(c,{x:50,y:50},R),0);
 /* Redimensionner une porte tournée par un coin : le coin opposé ne bouge pas d'un iota,
    et sans angle c'est le redimensionnement ordinaire. */
 const orig={x:40,y:48,w:20,h:4,a:30};
 const coins=d=>C.doorPolygon(d,R).map(p=>p.map(v=>+v.toFixed(6)));
 const avantNW=coins(orig)[0];
 // Le curseur : le coin sud-est poussé de +3 en largeur et +2 en hauteur, dans le repère de la porte.
 const f=C.doorFrame(orig,R),Lx=(orig.x+orig.w+3)*R-f.cx,Ly=orig.y+orig.h+2-f.cy;
 const cible={x:(f.cx+Lx*f.ux+Ly*f.vx)/R,y:f.cy+Lx*f.uy+Ly*f.vy};
 const tire=C.redimPorteTournee(orig,'se',cible,R);
 assert.equal(tire.a,30);
 assert.deepEqual(coins(tire)[0],avantNW);                              // Le coin nord-ouest est resté.
 assert.ok(Math.abs(tire.w-(orig.w+3))<1e-9&&Math.abs(tire.h-(orig.h+2))<1e-9,JSON.stringify(tire));
 assert.deepEqual(C.redimPorteTournee({x:10,y:10,w:6,h:2,a:0},'se',{x:20,y:15},R),{x:10,y:10,w:10,h:5,a:0});
 // Un mur de biais à 30°, épais de 4 unités d'écran, long de 60 : bâti comme une porte géante.
 const murBiais=C.doorPolygon({x:50-30/R,y:48,w:60/R,h:4,a:30},R);
 const m={ratio:R,matiere:[{anneaux:[murBiais]}],doors:[]};
 // La porte, tracée droite sur le mur puis tournée de trente degrés par sa poignée.
 const porte={x:50-5/R,y:48,w:10/R,h:4,a:30,open:false};m.doors.push(porte);
 assert.equal(C.wallShape(m).contours.length,2);                               // Le mur est coupé en deux.
 const trou=C.trouPorte(porte,m);assert.equal(trou.length,4);
 // De part et d'autre de la porte, perpendiculairement au mur : bloqué close, libre ouverte.
 const n=[-Math.sin(Math.PI/6),Math.cos(Math.PI/6)];
 const A={x:(50*R+n[0]*-6)/R,y:50+n[1]*-6},B={x:(50*R+n[0]*6)/R,y:50+n[1]*6};
 assert.ok(C.wallsBetween(A,B,C.obstaclesFrom(m)));
 porte.open=true;assert.ok(!C.wallsBetween(A,B,C.obstaclesFrom(m)));
 // Plus loin le long du mur, il tient toujours.
 const u=[Math.cos(Math.PI/6),Math.sin(Math.PI/6)],k=20;
 assert.ok(C.wallsBetween({x:(50*R+u[0]*k+n[0]*-6)/R,y:50+u[1]*k+n[1]*-6},{x:(50*R+u[0]*k+n[0]*6)/R,y:50+u[1]*k+n[1]*6},C.obstaclesFrom(m)));
 // La portée d'une porte de biais : le point du polygone le plus proche, en pixels.
 const ecran={width:800,height:450},socle=46;
 const poly=C.doorPolygon(porte,R);
 assert.ok(C.polyInReach({x:50,y:50},poly,ecran,socle));                       // Dessus.
 assert.ok(C.polyInReach({x:(50*R+n[0]*3)/R,y:50+n[1]*3},poly,ecran,socle));    // Tout près, à côté.
 assert.ok(!C.polyInReach({x:10,y:10},poly,ecran,socle));                       // Loin.
 assert.equal(C.polyInReach({x:50,y:50},null,ecran,socle),false);
 // L'angle et le secret voyagent à l'export ; une porte droite n'emporte pas d'angle.
 const sortie=C.packMaps([{ratio:R,matiere:[],doors:[{x:1,y:1,w:5,h:2,a:30,secret:true,keyLocked:true},{x:1,y:1,w:5,h:2,a:180},{x:1,y:1,w:5,h:2,a:'x'}]}]).maps[0].doors;
 assert.deepEqual(sortie.map(d=>[d.a,!!d.secret,!!d.keyLocked]),[[30,true,true],[undefined,false,false],[undefined,false,false]]);}
// Un polygone verrouillé résiste à la découpe, et transmet son verrou à ce qui fond avec lui.
{const m=carteVide();C.ajouteMatiere(m,rectP(0,0,20,20));C.matiereDe(m)[0].verrou=true;
 C.retireMatiere(m,rectP(5,5,5,5));assert.deepEqual(sommets(m),[[4]]);          // Rien n'est entamé.
 C.ajouteMatiere(m,rectP(15,5,20,5));assert.equal(C.matiereDe(m).length,1);assert.ok(C.matiereDe(m)[0].verrou);
 C.ajouteMatiere(m,rectP(60,60,5,5));assert.ok(!C.matiereDe(m)[1].verrou);}     // Une zone à part ne l'hérite pas.
// Le polygone sous un point, sa boîte, et la refonte après un déplacement qui en recouvre un autre.
{const m=carteVide();C.ajouteMatiere(m,rectP(0,0,10,10));C.ajouteMatiere(m,rectP(30,0,10,10));
 assert.equal(C.matiereSous(m,[5,5]),0);assert.equal(C.matiereSous(m,[35,5]),1);assert.equal(C.matiereSous(m,[20,5]),-1);
 assert.deepEqual(C.boitePolygone(C.matiereDe(m)[1]),{x:30,y:0,w:10,h:10});
 m.matiere[1]=C.transformePolygone(m.matiere[1],([x,y])=>[x-22,y]);
 C.refondMatiere(m);assert.deepEqual(sommets(m),[[4]]);
 assert.equal(aireDe(C.matiereDe(m)[0].anneaux[0]),180);
 // Un trou compte comme du vide : on ne le désigne pas.
 C.retireMatiere(m,rectP(4,4,2,2));assert.equal(C.matiereSous(m,[5,5]),-1);assert.equal(C.matiereSous(m,[2,2]),0);}
/* Une carte d'avant — rectangles, traits, zones de vision, tracés gardés — devient une
   matière exacte, une fois pour toutes, verrous compris ; ses anciens champs s'en vont. */
{const leg={ratio:16/9,walls:[{x:10,y:10,w:20,h:5,locked:true},{x:0,y:0,w:0,h:5},{x:60,y:60,w:5,h:5}],
  traits:[{x1:30,y1:12,x2:50,y2:12,e:.6}],visions:[{x:12,y:11,w:4,h:2}],cuts:[],carves:[[[1,1],[2,2],[3,1]]],doors:[]};
 const polys=C.matiereDe(leg);
 assert.equal(polys.length,2);
 assert.ok(!('walls'in leg)&&!('traits'in leg)&&!('visions'in leg)&&!('carves'in leg)&&!('cuts'in leg));
 const grand=polys.find(p=>p.anneaux[0].some(q=>q[0]===10&&q[1]===10));
 assert.ok(grand.verrou);assert.equal(grand.anneaux.length,2);      // Verrou hérité, zone de vision creusée.
 assert.ok(!polys.find(p=>p!==grand).verrou);
 assert.equal(C.matiereDe({}).length,0);assert.equal(C.matiereDe(null).length,0);}
/* Export et import des couches : aller-retour fidèle, et rien de ce qui entre n'est cru. */
const {packMaps,readMapsFile}=require('./combat.js');
const PLAN_EXPORT={name:'Manoir',ratio:1.64,image:'data:image/png;base64,AAAA',
 walls:[{x:10,y:10,w:20,h:2},{x:0,y:0,w:0,h:5}],doors:[{x:30,y:9,w:2,h:4,open:true,keyLocked:true}],
 start:{x:5,y:70,w:10,h:10},cuts:[{x:12,y:10,w:3,h:2}],carves:[[[1,1],[2,2],[3,1]]],
 foes:[{x:50,y:50,hidden:true,tpl:{name:'Rôdeur',pv:6,def:3,type:'boss',attacks:[{name:'Griffes',dice:{white:2}}]}}],
 fog:'mémoire de partie'};
const PAQUET=packMaps([PLAN_EXPORT]);
assert.equal(PAQUET.format,'amertume-cartes');
assert.deepEqual(readMapsFile(JSON.stringify(PAQUET)),PAQUET.maps);   // Aller-retour fidèle.
const SORTIE=PAQUET.maps[0];
assert.equal(SORTIE.matiere.length,1);          // Fondu en matière ; le rectangle plat ne compte pas.
assert.ok(!('walls'in SORTIE)&&!('cuts'in SORTIE)&&!('carves'in SORTIE));
assert.equal(SORTIE.doors[0].open,false);       // Une porte revient toujours close…
assert.equal(SORTIE.doors[0].keyLocked,true);   // … mais garde son verrou.
assert.ok(!('fog' in SORTIE));                  // La mémoire d'exploration n'est pas une couche.
assert.equal(SORTIE.foes[0].tpl.type,'boss');
for(const mauvais of ['pas du json','{}','{"format":"autre","maps":[]}','{"format":"amertume-cartes","maps":[]}'])
 assert.throws(()=>readMapsFile(mauvais));
/* Un fichier trafiqué ne peut ni injecter une URL, ni déborder, ni faire dérailler les coordonnées. */
const SALE=readMapsFile(JSON.stringify({format:'amertume-cartes',maps:[{name:'x'.repeat(500),
 image:'javascript:alert(1)',walls:[{x:'NaN',y:1e9,w:5,h:5}],foes:[{x:0,y:0,tpl:{name:'<script>',pv:-4,dice:{white:99}}}]}]}));
assert.equal(SALE[0].image,null);
assert.equal(SALE[0].name.length,80);
assert.ok(SALE[0].matiere[0].anneaux[0].some(p=>p[0]===0&&p[1]===101));   // Coordonnées bornées.
// Une matière trafiquée : anneaux trop courts jetés, coordonnées bornées, texte refusé.
assert.deepEqual(readMapsFile(JSON.stringify({format:'amertume-cartes',maps:[{name:'m',
 matiere:[{anneaux:[[[1,1],[2,2]]]},{anneaux:[[[0,0],[500,'x'],[5,5]]],verrou:1}]}]}))[0].matiere,
 [{anneaux:[[[0,0],[101,0],[5,5]]],verrou:true}]);
assert.equal(SALE[0].foes[0].tpl.pv,1);
/* Un socle est vu dès qu'il mord sur la zone éclairée. */
const CHAMP=[[0,0],[50,0],[50,100],[0,100]];
assert.ok(polyTouchesDisc(CHAMP,[25,50],3));    // Bien dedans.
assert.ok(polyTouchesDisc(CHAMP,[52,50],3));    // Dehors, mais le socle mord.
assert.ok(!polyTouchesDisc(CHAMP,[56,50],3));   // Trop loin : invisible.
/* Une porte ne se manœuvre qu'au contact du token. */
const ECRAN={width:800,height:400},SOCLE=46;
assert.ok(rectInReach({x:50,y:50},{x:52,y:48,w:2,h:6},ECRAN,SOCLE));    // Le rectangle entre dans le rayon.
assert.ok(!rectInReach({x:50,y:50},{x:80,y:48,w:2,h:6},ECRAN,SOCLE));   // À l'autre bout : hors de portée.
assert.ok(rectInReach({x:50,y:50},{x:30,y:48,w:22,h:6},ECRAN,SOCLE));   // Une porte longue suffit d'un bout.
/* Mémoire d'exploration : remplissage, comptage des nouveautés, aller-retour compressé. */
const GRILLE=new Uint8Array(64*36);
const PAVE=[[20,20],[60,20],[60,60],[20,60]];
const neuves=fillPolygonGrid(GRILLE,64,36,PAVE);
assert.ok(neuves>0);
assert.equal(fillPolygonGrid(GRILLE,64,36,PAVE),0);       // Rien de neuf la seconde fois.
assert.equal(GRILLE[18*64+32],1);                          // Au centre du carré : exploré.
assert.equal(GRILLE[2*64+2],0);                            // Loin du carré : toujours noir.
const COMPACT=packMask(GRILLE,64*36);
assert.equal(COMPACT.length,maskChars(64*36));
assert.deepEqual(Array.from(unpackMask(COMPACT,64*36)),Array.from(GRILLE));
const {uncontain}=require('./combat.js');
const {regridMask}=require('./combat.js');
/* Ré-échantillonnage de la mémoire d'exploration : la zone vue reste au même endroit. */
const AVANT=(()=>{let s='';for(let j=0;j<58;j++)for(let i=0;i<104;i++)s+=(i<52&&j<29)?'1':'0';return s})();
const APRES=regridMask(AVANT,104,58,256,156);
assert.equal(APRES.length,256*156);
const lu=(g,w,i,j)=>g[j*w+i];
assert.equal(lu(APRES,256,10,10),1);
assert.equal(lu(APRES,256,200,10),0);
assert.equal(lu(APRES,256,10,140),0);
assert.equal(lu(APRES,256,127,77),1);
assert.equal(lu(APRES,256,129,79),0);
assert.ok(!regridMask('0'.repeat(104*58),104,58,256,156).some(v=>v));
// Recalage : une zone enregistrée sous l'ancien cadre 16/9 retrouve sa place sur l'image.
const cadre=16/9,image=1232/751,ech=image/cadre,marge=(1-ech)/2*100;
const stocke=[{x:marge+10*ech,y:20,w:5*ech,h:8}];
const remis=uncontain(stocke,cadre,image);
assert.ok(Math.abs(remis[0].x-10)<1e-6);assert.ok(Math.abs(remis[0].w-5)<1e-6);
assert.ok(Math.abs(remis[0].y-20)<1e-6);                               // L'axe non comprimé ne bouge pas.
assert.ok(Math.abs(uncontain([{x:50,y:50}],cadre,image)[0].x-50)<1e-6); // Le centre est invariant.
assert.ok(Math.abs(uncontain([{x:0,y:0}],cadre,image)[0].x+marge/ech)<1e-6);
// Talents : la fiche ne garde que ceux qui existent encore au catalogue, sans doublon.
const avecTalents=(brouillon,rayon)=>{const t={structuredClone,keys:['white','bone','red','blue','green','black','yellow'],
 skillNames:Array(8).fill(''),templateIndex:null,draft:{hero:true,talents:brouillon},attackDraft:[{dice:{white:2}}],readAttacks(){},
 $:()=>({elements}),num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),
 poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,
 catalog:{items:[],talents:rayon}};vm.createContext(t);vm.runInContext(read+';result=readActor()',t);return t.result.talents.join(',')};
const rayon=[{id:'t1'},{id:'t2'}];
assert.equal(avecTalents(['t1','t2'],rayon),'t1,t2');       // Les deux existent : les deux restent.
assert.equal(avecTalents(['t1','t1'],rayon),'t1');            // Coché deux fois ne compte qu'une.
assert.equal(avecTalents(['t1','fantome'],rayon),'t1');       // Un talent supprimé du catalogue tombe.
assert.equal(avecTalents(undefined,rayon),'');                  // Une fiche d'avant les talents en sort vide.
assert.equal(avecTalents(['t1'],undefined),'');                 // Un catalogue sans rayon ne garde rien.
// Test de compétence : 1 dé plus le bonus, 4+ réussit, 6 relance en chaîne.
const {skillRoll}=require('./combat.js');
const fixe=v=>()=>v,suite=xs=>{let k=0;return()=>xs[Math.min(k++,xs.length-1)]};
assert.equal(skillRoll(0,fixe(1)).des.length,1);        // Bonus nul : un dé quand même.
assert.equal(skillRoll(3,fixe(1)).des.length,4);        // 1 + le bonus.
assert.equal(skillRoll(0,fixe(3)).reussites,0);         // 3 échoue.
assert.equal(skillRoll(0,fixe(4)).reussites,1);         // 4 réussit.
assert.equal(skillRoll(2,fixe(5)).reussites,3);         // Tous les dés comptent.
assert.equal(skillRoll(0,suite([6,5])).des.length,2);   // Un 6 relance.
assert.equal(skillRoll(0,suite([6,5])).reussites,2);    // Le 6 et sa relance comptent.
assert.equal(skillRoll(0,suite([6,6,1])).des.length,3); // La relance relance à son tour.
assert.equal(skillRoll(0,suite([6,6,1])).reussites,2);
assert.equal(skillRoll(-4,fixe(1)).des.length,1);       // Un bonus négatif ne retire pas le dé de base.
const emballe=skillRoll(0,fixe(6),50);                  // Une série infinie est arrêtée net.
assert.equal(emballe.des.length,50);assert.ok(emballe.reste>0);
// États multiples : on empile, on lève, sans doublon ni trou.
const {statesOf,hasState,setState}=require('./combat.js');
const sujet={};
assert.equal(statesOf(sujet).length,0);assert.equal(statesOf(null).length,0);
assert.equal(statesOf({states:'Feu'}).length,0);           // Un champ mal formé ne casse rien.
setState(sujet,'Feu',true);setState(sujet,'Poison',true);
assert.equal(sujet.states.join(','),'Feu,Poison');         // L'ordre de pose est conservé.
setState(sujet,'Feu',true);
assert.equal(sujet.states.join(','),'Poison,Feu');         // Reposer un état le remet en dernier, sans doublon.
assert.ok(hasState(sujet,'Poison')&&hasState(sujet,'Feu'));
setState(sujet,'Poison',false);
assert.equal(sujet.states.join(','),'Feu');                // Lever n'enlève que celui-là.
setState(sujet,'Gel',false);
assert.equal(sujet.states.join(','),'Feu');                // Lever un état absent ne fait rien.
setState(sujet,'Feu',false);assert.equal(sujet.states.length,0);
assert.equal(hasState({},'Coma'),false);
// Corriger un modèle du bestiaire corrige les créatures déjà sur la table.
const src=fs.readFileSync('editor.js','utf8');
const bloc=src.slice(src.indexOf('const EN_JEU='),src.indexOf("$('actor-form').onsubmit"));
const table=[{hero:true,name:'Éla',hp:9,max:24},                        // La troupe n'est jamais touchée.
 {hero:false,name:'Sbire',template:'t1',hp:12,max:12},                  // Intact : reste plein.
 {hero:false,name:'Sbire',template:'t1',hp:4,max:12},                   // Blessé : garde sa blessure.
 {hero:false,name:'Sbire',template:'t1',hp:12,max:12,states:['Coma']},  // Un cas incohérent hérité.
 {hero:false,name:'Sbire',hp:12,max:12},                                // Sans lien : rattrapé par le nom.
 {hero:false,name:'Autre',template:'t2',hp:12,max:12}];                 // Autre modèle : intouché.
const ctxT={actors:table,num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),
 setState:gearApi.setState,structuredClone,normalizeActor:a=>a,poolFrom:()=>null,
 activeAttack:a=>(a.attacks&&a.attacks[0])||{},
 fromMonster:m=>({hero:false,template:m.id,name:m.name,role:m.family||'Adversaire',
  hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,
  notes:m.notes||'',attacks:structuredClone(m.attacks||[]),image:m.image||null})};
vm.createContext(ctxT);
vm.runInContext(bloc+';result=syncFromTemplate({id:"t1",name:"Sbire",pv:20})',ctxT);
assert.equal(ctxT.result,4);                                    // Quatre créatures suivies.
assert.equal(table[0].max,24);                                  // Le héros n'a pas bougé.
assert.equal(table[1].hp+'/'+table[1].max,'20/20');             // Intact, plein au nouveau plafond.
assert.equal(table[2].hp+'/'+table[2].max,'4/20');              // Blessé, la blessure tient.
assert.equal(table[3].states.length,0);                         // PV rendus, le Coma tombe.
assert.equal(table[4].hp+'/'+table[4].max,'20/20');             // Le rattrapage par le nom a joué.
assert.equal(table[5].max,12);                                  // L'autre modèle est resté à part.
// Baisser le plafond écrête, sans jamais passer sous 1.
vm.runInContext('result=syncFromTemplate({id:"t1",name:"Sbire",pv:3})',ctxT);
assert.equal(table[2].hp+'/'+table[2].max,'3/3');
vm.runInContext('result=syncFromTemplate({id:"t1",name:"Sbire",pv:0})',ctxT);
assert.equal(table[1].max,1);
// Un modèle inchangé ne touche rien et ne se signale pas.
vm.runInContext('result=syncFromTemplate({id:"t1",name:"Sbire",pv:1})',ctxT);
assert.equal(ctxT.result,0);
// Faille : le dé rose ne blesse pas, et efface du compte tous les dés de sa valeur.
const rose=v=>{let k=0;return()=>[v][k++]??v};
const sansFaille=r({dice:[[4,0],[4,0],[5,0]],def:0,dmg:0,roll:()=>2});
assert.equal(sansFaille.damage,13);assert.equal(sansFaille.failleFace,null);
const avecFaille=r({dice:[[4,0],[4,0],[5,0]],def:0,dmg:0,faille:true,roll:rose(4)});
assert.equal(avecFaille.failleFace,4);
assert.equal(avecFaille.damage,5);                      // Les deux 4 sortent, le 5 reste.
const failleVide=r({dice:[[4,0],[4,0]],def:0,dmg:3,faille:true,roll:rose(4)});
assert.equal(failleVide.damage,0);                      // Plus rien ne passe : pas même le bonus.
assert.equal(r({dice:[[5,0]],def:0,dmg:0,faille:true,roll:rose(2)}).damage,5); // Valeur absente : rien ne change.
// Saignée : elle s'ajoute à tout coup qui passe, jamais à un coup qui rate.
assert.equal(r({dice:[[5,0]],def:0,dmg:2,bleed:3,roll:()=>2}).damage,10);
assert.equal(r({dice:[[5,0]],def:0,dmg:2,bleed:3,roll:()=>2}).bleed,3);
assert.equal(r({dice:[[1,0],[1,0]],def:0,dmg:2,bleed:3,roll:()=>2}).damage,0);
assert.equal(r({dice:[[2,0]],def:5,dmg:2,bleed:3,roll:()=>2}).damage,0); // Aucun dé ne passe la DEF.
assert.equal(r({dice:[[5,0]],def:0,dmg:0,bleed:-4,roll:()=>2}).damage,5); // Une saignée négative ne soigne pas.
// Cumul de saignée, purge par l'Onde, dégâts et soins d'effet.
const {bleedOf,addBleed,ondeCures,applyDamage,applyHeal,frozenSolid,blinded}=require('./combat.js');
const bl={};assert.equal(bleedOf(bl),0);
assert.equal(addBleed(bl,1),1);assert.equal(bleedOf(bl),1);
assert.equal(addBleed(bl,1),2);assert.equal(addBleed(bl,-1),1);
assert.equal(addBleed(bl,-1),0);assert.equal(bl.states.length,0);   // À zéro l'état s'en va.
assert.equal(addBleed(bl,-1),0);                                     // On ne descend pas sous zéro.
assert.equal(ondeCures({states:['Feu','Blindage','Poison']}),'Poison'); // La plus fraîche affection.
assert.equal(ondeCures({states:['Blindage','Vie','Onde','Coma']}),null); // Rien à purger.
assert.equal(ondeCures({}),null);
const bl2={hp:5,max:12,states:[]};
assert.equal(applyDamage(bl2,3),3);assert.equal(bl2.hp,2);
assert.equal(applyDamage(bl2,9),2);assert.equal(bl2.hp,0);           // On ne perd pas plus qu'on n'a.
assert.ok(bl2.states.includes('Coma'));
assert.equal(applyHeal(bl2,4),4);assert.equal(bl2.hp,4);
assert.equal(bl2.states.includes('Coma'),false);                     // Rendre des PV lève le coma.
assert.equal(applyHeal(bl2,99),8);assert.equal(bl2.hp,12);           // On ne dépasse pas le plafond.
assert.ok(frozenSolid({states:['Gel']})&&frozenSolid({states:['Au sol']})&&!frozenSolid({states:['Feu']}));
assert.ok(blinded({states:['Aveugle']})&&!blinded({states:[]}));
// Cadrage d'un socle : le carré se remplit, et le glissement reste borné.
const recadre=new Function('bw','bh','side','zoom','dx','dy',
 src.slice(src.indexOf('function squareFrame'),src.indexOf('function drawTokenPreview'))
 +';return squareFrame(bw,bh,side,zoom,dx,dy)');
const large=recadre(400,200,100,1,0,0);      // Paysage : la hauteur touche les bords.
assert.equal(large.dh,100);assert.equal(large.dw,200);
assert.equal(large.oy,0);assert.equal(large.ox,-50);          // Centré, débordant à gauche et à droite.
const haut=recadre(200,400,100,1,0,0);       // Portrait : c'est la largeur qui touche.
assert.equal(haut.dw,100);assert.equal(haut.oy,-50);
const zoome=recadre(400,200,100,2,0,0);      // Zoom deux : tout double.
assert.equal(zoome.dh,200);assert.equal(zoome.dw,400);
// Le glissement ne découvre jamais de vide quand l'image couvre le carré.
assert.equal(recadre(400,200,100,1,9,0).ox,0);        // Poussé à droite : bloqué au bord.
assert.equal(recadre(400,200,100,1,-9,0).ox,-100);    // Poussé à gauche : bloqué à l'autre.
assert.equal(recadre(400,200,100,1,0,9).oy,0);        // La hauteur, elle, colle déjà.
// Sous zoom 1 l'image ne couvre plus : elle reste alors dans le carré.
const petit=recadre(200,200,100,.5,0,0);
assert.equal(petit.dw,50);assert.equal(petit.ox,25);          // Centrée dans le carré.
assert.equal(recadre(200,200,100,.5,9,0).ox,50);                // Poussée à droite, elle s'arrête au bord.
assert.equal(recadre(200,200,100,.5,-9,0).ox,0);
const nul=recadre(0,0,100,1,0,0);                             // Une image dégénérée ne divise pas par zéro.
assert.ok(Object.values(nul).every(Number.isFinite));
// Caractéristiques corrigées à la main : bornes, saisies illisibles et cohérence de la fiche.
const {readStat,writeStat}=require('./combat.js');
assert.equal(readStat('def','5',2),5);
assert.equal(readStat('def','',2),2);                          // Champ vidé : la valeur d'avant tient.
assert.equal(readStat('def','abc',2),2);                       // Illisible : rien ne bouge.
assert.equal(readStat('def','900',2),99);                      // Au-delà de la borne : on s'y arrête.
assert.equal(readStat('def','-4',2),0);
assert.equal(readStat('vie','7,5',1),7.5);                     // La virgule vaut le point.
assert.equal(readStat('endu','3.9',1),3);                      // Une endurance ne se coupe pas en quatre.
assert.equal(readStat('level','9',1),7);
assert.equal(readStat('inconnue','5',2),2);                    // Une clé qui n'existe pas ne s'invente pas.
const fiche={hp:20,max:24,vie:8,vieMax:8,dmg:2,states:[]};
assert.equal(writeStat(fiche,'max','10'),10);assert.equal(fiche.hp,10);   // Le plafond baissé ramène les PV.
assert.equal(writeStat(fiche,'hp','99'),10);assert.equal(fiche.hp,10);    // Les PV ne dépassent pas leur plafond : c'est la valeur retenue qui revient.
writeStat(fiche,'hp','0');assert.ok(hasState(fiche,'Coma'));              // Tomber à zéro, c'est le coma.
writeStat(fiche,'hp','4');assert.ok(!hasState(fiche,'Coma'));
writeStat(fiche,'vieMax','5');assert.equal(fiche.vie,5);                  // La Vie suit son maximum.
const modele={pv:8,def:2,damage:3,xp:7};
assert.equal(writeStat(modele,'pv','42'),42);
assert.ok(!('hp'in modele)&&!('max'in modele)&&!('states'in modele));     // Un modèle n'a ni PV du moment ni états.
// Les quatre types d'adversaires ont chacun leur colonne au bestiaire : un type sans
// colonne rendrait ses modèles introuvables, ce qui est arrivé aux Alpha.
const page=fs.readFileSync('index.html','utf8');
const typesAdv=Object.keys(JSON.parse(page.slice(page.indexOf('const TYPE_NOMS=')+16,page.indexOf(';',page.indexOf('const TYPE_NOMS=')))
 .replace(/(\w+):/g,'"$1":').replace(/'/g,'"')));
const colonnes=[...src.slice(src.indexOf('const BEST_COLS='),src.indexOf(';',src.indexOf('const BEST_COLS=')))
 .matchAll(/\['(\w+)'/g)].map(m=>m[1]);
assert.equal(typesAdv.length,4);
assert.deepEqual([...colonnes].sort(),[...typesAdv].sort());
// Les langue­ttes ont la teinte de leur type, sinon elles sortent blanches.
const feuille=fs.readFileSync('editor.css','utf8');
typesAdv.forEach(t=>assert.ok(feuille.includes('.cat-pill.k-'+t+'{'),'languette sans teinte : '+t));
// Aucun bandeau de colonne d'adversaire ne porte de fond : seule l'encre les distingue.
typesAdv.forEach(t=>{const r=feuille.match(new RegExp('\\.cat-col\\.c-'+t+' h3\\{([^}]*)\\}'));
 assert.ok(!r||!r[1].includes('background'),'bandeau teinté : '+t)});
/* Le menu déroulant des mécaniques porte le nom ET la description : on sait ce qu'un effet
   fait avant de le choisir, sans gras — une option ne lit pas le balisage. */
const lib=C.libelleTalent('lamevent');
assert.ok(lib.startsWith('Lamevent : '),'le libellé s’ouvre sur le nom : '+lib);
assert.ok(!/[<>]/.test(lib),'le libellé ne porte aucune balise : '+lib);
assert.ok(lib.includes('bonus de dégâts')&&lib.includes('au contact'),lib);
assert.equal(C.libelleTalent('inconnu'),'');
console.log('462 vérifications passées : dimensions PNG/JPEG/WebP, catalogue, dégâts, édition de fiche, contact, ligne de vue et matière exacte.');
