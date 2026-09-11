const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const editor=fs.readFileSync('editor.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(editor.slice(editor.indexOf('function imageDimensions'),editor.indexOf('let imageJob')),ctx);
const png=new Uint8Array(24),v=new DataView(png.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,4096);v.setUint32(20,2048);assert.equal(ctx.imageDimensions(png).join(','),'4096,2048');
const jpg=new Uint8Array([255,216,255,192,0,7,8,2,0,4,0,255,217]);assert.equal(ctx.imageDimensions(jpg).join(','),'1024,512');
const webp=new Uint8Array(30);webp.set(Buffer.from('RIFF'));webp.set(Buffer.from('WEBPVP8X'),8);webp[24]=255;webp[25]=1;webp[27]=255;assert.equal(ctx.imageDimensions(webp).join(','),'512,256');assert.throws(()=>ctx.imageDimensions(new Uint8Array(30)));
const c={window:{}};vm.runInNewContext(fs.readFileSync('catalog.js','utf8'),c);const cat=c.window.AMERTUME_CATALOG;assert.equal(cat.items.filter(i=>i.category==='weapon').length,14);assert.equal(cat.items.filter(i=>i.category==='armor').length,5);assert.equal(cat.monsters.length,4);assert.equal(cat.monsters.find(m=>m.name==='Mystique déchu').attacks[0].dice.blue,2);
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
// Zones de vision : elles creusent les zones de blocage.
const {diffRect,subtractRects}=require('./combat.js');
const aire=rs=>rs.reduce((s,r)=>s+r.w*r.h,0);
assert.deepEqual(diffRect({x:0,y:0,w:10,h:10},{x:20,y:20,w:5,h:5}),[{x:0,y:0,w:10,h:10}]); // Sans recouvrement : intact.
assert.equal(diffRect({x:0,y:0,w:10,h:10},{x:0,y:0,w:10,h:10}).length,0);                  // Entièrement creusé.
const troue=diffRect({x:0,y:0,w:10,h:10},{x:4,y:4,w:2,h:2});
assert.equal(troue.length,4);assert.equal(aire(troue),100-4);                              // Trou central : quatre bandes.
const bord=diffRect({x:0,y:0,w:10,h:10},{x:-5,y:-5,w:10,h:20});
assert.equal(aire(bord),50);                                                               // Creusé par la gauche.
assert.equal(aire(subtractRects([{x:0,y:0,w:10,h:10}],[{x:2,y:2,w:2,h:2},{x:6,y:6,w:2,h:2}])),100-8);
// Une pièce creusée dans un gros bloc : la vue passe dedans, pas au travers du plein.
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
const MORCEAUX=subtractRects(dedale,Array.from({length:30},(_,i)=>({x:7+(i*7)%84,y:13+(i*11)%74,w:4,h:4})));
const CONTOURS=MORCEAUX.map(rectPolygon);
const FORMES=[{contours:CONTOURS}];
for(const o of [{x:22.7,y:74.3},{x:50.5,y:47.3}]){const vision=visionPolygon(o,FORMES,null);let compares=0;
 for(let i=0;i<1500;i++){const p=[(i*37.13)%100,(i*61.7)%100];
  if(MORCEAUX.some(r=>p[0]>r.x-.3&&p[0]<r.x+r.w+.3&&p[1]>r.y-.3&&p[1]<r.y+r.h+.3))continue;
  assert.equal(pointInPolygon(p,vision),!wallsBetween(o,{x:p[0],y:p[1]},CONTOURS));compares++}
 assert.ok(compares>800)}
/* Contour de l'union : exact, sans couture interne, avec les creux comme contours. */
const {smoothContours,simplifyClosed,relaxContour,carveMask,distToRectEdge,carveWithPolygon:creuse,CARVE_STEP,closestOnSegment,encreDroite,wallShape,wallsPierced:perce,polyTouchesDisc,rectInReach}=require('./combat.js');
assert.equal(unionContours([{x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10}]).length,1);      // Deux zones jointives fusionnent.
assert.equal(unionContours([{x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10}])[0].length,4);   // Sans couture au milieu.
assert.equal(unionContours(subtractRects([{x:0,y:0,w:40,h:40}],[{x:15,y:15,w:10,h:10}])).length,2); // Creux : deux contours.
/* Découpe libre : la marche d'escalier devient une courbe fidèle, l'angle droit reste droit. */
const ELLIPSE=Array.from({length:64},(_,i)=>{const a=i/64*2*Math.PI;return [50+18*Math.cos(a),50+12*Math.sin(a)]});
const CREUSE=creuse([{x:20,y:30,w:60,h:40}],ELLIPSE,CARVE_STEP);
const LISSE=wallShape({walls:CREUSE,doors:[],carves:[ELLIPSE]}).contours;
assert.equal(LISSE.length,2);
assert.ok(Math.abs(aireDe(LISSE[1])-Math.PI*18*12)/(Math.PI*18*12)<.02); // Aire du trou à 2 % de l'ellipse voulue.
// Aucun pli visible : le plus grand changement de cap reste doux tout au long de la courbe.
const cassure=c=>{let pire=0;
 for(let i=0;i<c.length;i++){const a=c[(i+c.length-1)%c.length],b=c[i],d=c[(i+1)%c.length];
  let t=Math.abs(Math.atan2(d[1]-b[1],d[0]-b[0])-Math.atan2(b[1]-a[1],b[0]-a[0]));
  if(t>Math.PI)t=2*Math.PI-t;pire=Math.max(pire,t)}
 return pire*180/Math.PI};
assert.ok(cassure(LISSE[1])<15);                                   // Contre 90° pour l'escalier brut.
assert.ok(cassure(unionContours(CREUSE)[1])>85);
// Sans tracé à main levée enregistré, rien n'est lissé : la géométrie ressort à l'identique.
assert.deepEqual(wallShape({walls:CREUSE,doors:[]}).contours,unionContours(CREUSE));
const DROIT=wallShape({walls:[{x:10,y:40,w:80,h:6}],doors:[]}).contours;
assert.equal(DROIT[0].length,4);                                   // Un mur droit n'est pas arrondi…
assert.equal(aireDe(DROIT[0]),480);                                // … et garde son aire exacte.
// Une découpe rectangulaire reste un rectangle : le lissage ne touche pas l'architecture.
const RECT=[[40,38],[60,38],[60,62],[40,62]];
const ENCOCHE=wallShape({walls:creuse([{x:10,y:40,w:80,h:20}],RECT,CARVE_STEP),doors:[],carves:[RECT]}).contours;
assert.deepEqual(ENCOCHE.map(c=>c.length),[4,4]);
assert.equal(aireDe(ENCOCHE[0])+aireDe(ENCOCHE[1]),1200);
/* Une découpe libre suit la forme dessinée, et non la trame qui a servi à la creuser :
   une coupe bien droite ressort bien droite, aux sommets voulus. */
for(const [nom,bande] of [['de biais',[[10,55],[70,-5],[75,0],[15,60]]],
 ['en pente douce',[[10,45],[90,25],[90,20],[10,40]]],
 ['presque plate',[[10,40],[90,32],[90,28],[10,36]]]]){
 const reste=creuse([{x:20,y:30,w:60,h:8}],bande,CARVE_STEP);
 for(const c of wallShape({walls:reste,doors:[],carves:[bande]}).contours){
  assert.ok(c.length<=6,nom+' : '+c.length+' sommets');       // Plus la moindre marche.
  for(const p of c){let d=Infinity;                           // Et chacun là où la main l'a mis.
   for(let k=0,j=bande.length-1;k<bande.length;j=k++){const q=closestOnSegment(p,bande[j],bande[k]);
    d=Math.min(d,Math.hypot(p[0]-q[0],p[1]-q[1]))}
   const bord=Math.min(Math.abs(p[0]-20),Math.abs(p[0]-80),Math.abs(p[1]-30),Math.abs(p[1]-38));
   assert.ok(Math.min(d,bord)<1e-9,nom+' : sommet à '+d.toFixed(3)+' du tracé')}}}
/* La main tremble : le même geste, tracé point par point puis glissé en tremblant, doit
   donner la même matière. Sinon le tremblement ressort en crénelures sur le mur. */
{const NET=[[70,2],[96,28],[99,25],[73,-1]];
 let g=1;const al=()=>{g=(g*1103515245+12345)%2147483648;return g/2147483648-.5};
 const MAIN=[];{const A=[70,2],B=[96,28],n=44;
  for(let i=0;i<=n;i++)MAIN.push([A[0]+(B[0]-A[0])*i/n+al()*.5,A[1]+(B[1]-A[1])*i/n+al()*.5]);
  for(let i=n;i>=0;i--)MAIN.push([A[0]+3+(B[0]-A[0])*i/n,A[1]-3+(B[1]-A[1])*i/n])}
 const BANDE=[{x:6,y:6,w:88,h:4},{x:6,y:90,w:88,h:4},{x:6,y:6,w:4,h:88},{x:90,y:6,w:4,h:88}];
 const taille=poly=>{const p=encreDroite([poly])[0],r=creuse(BANDE,p,CARVE_STEP);
  return wallShape({walls:r,doors:[],carves:[p]}).contours.map(c=>c.length)};
 assert.deepEqual(taille(MAIN),taille(NET));          // Le tremblement ne coûte pas un sommet.
 // Et la coupe est bien droite : trois points alignés suffiraient à la décrire.
 const p=encreDroite([MAIN])[0],r=creuse(BANDE,p,CARVE_STEP);
 for(const c of wallShape({walls:r,doors:[],carves:[p]}).contours)
  for(let i=0;i<c.length;i++){const a=c[(i+c.length-1)%c.length],b=c[i],d=c[(i+1)%c.length];
   const l=Math.min(Math.hypot(b[0]-a[0],b[1]-a[1]),Math.hypot(d[0]-b[0],d[1]-b[1]));
   assert.ok(l>CARVE_STEP*1.5,'marche de '+l.toFixed(2)+' laissée par la main');}}
/* Un angle taillé à l'outil Découper reste droit, même au beau milieu d'un tracé libre. */
const OVALE=Array.from({length:48},(_,i)=>{const a=i/48*2*Math.PI;return [50+18*Math.cos(a),50+14*Math.sin(a)]});
const BLOC=creuse([{x:10,y:10,w:80,h:60}],OVALE,CARVE_STEP);
const TAILLE=wallShape({walls:subtractRects(BLOC,[{x:64,y:60,w:26,h:10}]),doors:[],carves:[OVALE]}).contours;
const obliques=c=>c.filter((p,i)=>{const q=c[(i+1)%c.length];
 return Math.abs(p[0]-q[0])>1e-9&&Math.abs(p[1]-q[1])>1e-9}).length;
const CONTOUR_BLOC=TAILLE.find(c=>c.length<=12);
assert.equal(obliques(CONTOUR_BLOC),0);            // Pas une seule arête de biais.
for(const coin of [[64,60],[64,70],[90,60]])       // Les coins de la découpe, au sommet près.
 assert.ok(TAILLE.some(c=>c.some(p=>Math.abs(p[0]-coin[0])<1e-9&&Math.abs(p[1]-coin[1])<1e-9)));
const TROU=TAILLE.find(c=>obliques(c)>10);
assert.ok(TROU&&TROU.length>40);                   // Le tracé libre, lui, reste une courbe.
// Un sommet posé en plein sur un tracé libre est assoupli…
const TRACE_TEST=[[45,36],[55,36],[55,40],[45,40]];
const MORCEAU=[[49.6,36],[50,36],[50,36.4],[49.6,36.4]];
assert.equal(carveMask(MORCEAU,[TRACE_TEST],CARVE_STEP*1.6,CARVE_STEP,[])[1],1);
// … sauf s'il appartient au bord d'une découpe rectangulaire ou d'une porte : là, jamais.
assert.equal(carveMask(MORCEAU,[TRACE_TEST],CARVE_STEP*1.6,CARVE_STEP,[{x:50,y:30,w:2,h:6}])[1],0);
assert.equal(distToRectEdge([50,36],{x:50,y:30,w:2,h:6}),0);
assert.ok(distToRectEdge([53,36],{x:50,y:30,w:2,h:6})>.9);
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
assert.equal(SORTIE.walls.length,1);            // Le rectangle plat ne sort pas.
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
assert.equal(SALE[0].walls[0].x,0);
assert.equal(SALE[0].walls[0].y,101);
assert.equal(SALE[0].foes[0].tpl.pv,1);
/* Le donjon aux murs minces : découpes rectangulaires comprises, pas un sommet ne bouge. */
const MINCES=subtractRects(
 [{x:10,y:10,w:60,h:1.2},{x:10,y:10,w:1.2,h:50},{x:68.8,y:10,w:1.2,h:50},{x:10,y:58.8,w:60,h:1.2},
  {x:30,y:20,w:1.2,h:20},{x:30,y:20,w:18,h:1.2},{x:20,y:40,w:25,h:1.2},{x:44,y:30,w:1.2,h:12}],
 [{x:33,y:20,w:6,h:1.4},{x:30,y:26,w:1.4,h:5},{x:25,y:40,w:5,h:1.4}]);
const DONJON={walls:MINCES,doors:[{x:50,y:9.6,w:4,h:2,open:false}],carves:[ELLIPSE]};
assert.deepEqual(wallShape(DONJON).contours,unionContours(perce(DONJON)));
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
const {wallsPierced,uncontain}=require('./combat.js');
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
const AVEC_PORTE={walls:[{x:10,y:40,w:80,h:10}],doors:[{x:48,y:38,w:6,h:14,open:false}]};
assert.equal(wallsPierced(AVEC_PORTE).length,2);                       // Le mur est coupé en deux.
assert.ok(wallsBetween({x:51,y:20},{x:51,y:70},obstaclesFrom(AVEC_PORTE)));   // Porte close : vue coupée.
AVEC_PORTE.doors[0].open=true;
assert.ok(!wallsBetween({x:51,y:20},{x:51,y:70},obstaclesFrom(AVEC_PORTE)));  // Porte ouverte : vue libre.
assert.ok(wallsBetween({x:30,y:20},{x:30,y:70},obstaclesFrom(AVEC_PORTE)));   // À côté, le mur tient.
AVEC_PORTE.doors[0].open=false;
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
console.log('308 vérifications passées : dimensions PNG/JPEG/WebP, catalogue, dégâts, édition de fiche, contact et ligne de vue.');
