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
const {resolveAttack:r}=require('./combat.js');assert.equal(r({dice:[[5,0]],def:3,dmg:0,roll:()=>2}).damage,5);
/* L'os qui double s'en va avant tout : ni critique, ni échec, ni dégâts avec lui. */
assert.equal(r({dice:[[6,0],[6,1]],def:0,dmg:0,roll:()=>2}).critical,false);      // 6 blanc + 6 os : pas de critique.
assert.equal(r({dice:[[6,0],[6,1]],def:0,dmg:0,roll:()=>2}).damage,6);            // Le seul 6 blanc compte.
assert.equal(r({dice:[[6,0],[6,0],[6,1]],def:0,dmg:0,roll:()=>2}).critical,true); // Deux 6 blancs : critique, l'os parti.
assert.equal(r({dice:[[6,0],[6,0],[6,1]],def:0,dmg:0,roll:()=>2}).damage,14);     // 6 + 6 + la relance à 2.
assert.equal(r({dice:[[1,0],[1,1]],def:0,dmg:0,roll:()=>2}).failed,false);        // 1 blanc + 1 os : l'os parti, pas de double 1.
assert.equal(r({dice:[[3,1],[3,1]],def:0,dmg:0,roll:()=>2}).damage,0);            // Deux os qui doublent : plus rien.
assert.equal(r({dice:[[4,0],[4,1]],def:0,dmg:0,roll:()=>2,doublesCritiques:true}).critical,false); // Destructeur non plus.
assert.equal(r({dice:[[3,1],[6,0],[6,0]],def:0,dmg:0,roll:()=>3}).damage,18);     // La relance à 3 ne retire pas l'os 3 : 3 + 6 + 6 + 3.assert.equal(r({dice:[[5,0]],def:3,dmg:8,roll:()=>2}).damage,13);assert.equal(r({dice:[[1,0],[1,2]],def:0,dmg:8,roll:()=>2}).damage,0);
// Test de lecture des champs du formulaire sans navigateur.
const read=editor.slice(editor.indexOf('function readActor()'),editor.indexOf('function toMonster'));
const values={name:'<Éla>',role:'Gardienne',notes:'texte',state:'Aucun',socle:'medium',sexe:'Femme',race:'Humaine',hp:'99',max:'20',def:'7',dmg:'8',xp:'50',vie:'5',vieMax:'6',endu:'4',pvBonus:'0',level:'3',weapon1:'w',weapon2:'',armor:'a',shield:''};const elements=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]));elements.rapide={checked:true};elements.esquive={checked:false};for(let i=0;i<8;i++)elements['skill'+i]={value:'4'};
const gearApi=require('./combat.js');
const lire=(inventaire,brouillon={hero:true})=>{const t={structuredClone,keys:['white','bone','red','blue','green','black','yellow'],skillNames:Array(8).fill(''),templateIndex:null,draft:brouillon,attackDraft:[{dice:{white:2}}],readAttacks(){},$:()=>({elements}),num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,armuresDe:gearApi.armuresDe,emplacementDe:gearApi.emplacementDe,placesLibres:gearApi.placesLibres,placesEmplacement:gearApi.placesEmplacement,EMPLACEMENTS:gearApi.EMPLACEMENTS,portesA:gearApi.portesA,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,catalog:{items:inventaire}};vm.createContext(t);vm.runInContext(read+';result=readActor()',t);return t.result};
const nu=lire([]);assert.equal(nu.sexe,'Femme');assert.equal(nu.race,'Humaine');assert.equal(nu.vieMax,6);assert.equal(nu.hp,20);assert.equal(nu.def,0);   // Aventurier sans armure ni bouclier : DEF nulle, la saisie ne compte pas.
// La DEF d'un aventurier est dérivée, celle d'un adversaire lui appartient.
assert.equal(gearApi.defenseOf({hero:true,def:9},[]),0);
assert.equal(gearApi.defenseOf({hero:true,def:9,armures:['a'],shieldId:'b'},[{id:'a',def:2},{id:'b',def:1}]),3);
assert.equal(gearApi.defenseOf({hero:false,def:5},[]),5);
/* Un adversaire qui porte une armure tire sa DEF d'elle seule : son chiffre propre —
   écailles, cuir épais — ne s'y ajoute plus. Sans armure, ce chiffre fait foi. */
assert.equal(gearApi.defenseOf({hero:false,def:5,armures:['a']},[{id:'a',def:2}]),2);
assert.equal(gearApi.defenseOf({hero:false,def:5,armures:['a'],shieldId:'b'},[{id:'a',def:2},{id:'b',def:3}]),5);
assert.equal(gearApi.defenseOf({hero:false,def:5,armures:['a']},[{id:'a',def:0}]),0);   // Une armure à zéro dit zéro.
// L'équipement est l'affaire des aventuriers : une arme posée sur une créature ne
// rend pas muets les dés de sa carte d'attaque.
// Porter une arme ajoute une attaque, chez l'aventurier comme chez l'adversaire :
// elle vient en tête, si bien qu'une fiche d'avant ce choix retrouve son arme.
const ARSENAL=[{id:'e',name:'Épée',category:'weapon',hands:1,dice:{white:2,red:1}},{id:'d',name:'Dague',category:'weapon',hands:1,dice:{bone:1}},{id:'ar',name:'Armure',category:'armor',def:3}];
const bete={hero:false,def:4,weapons:['e','e'],armures:['ar'],attacks:[{name:'Griffes',dice:{white:1}},{name:'Souffle',dice:{red:2}}]};
assert.deepEqual(gearApi.attackChoices(bete,ARSENAL).map(x=>x.name),['Épée ×2','Griffes','Souffle']);
// Les armes d'une même portée font une seule attaque, dés cumulés ; contact et distance
// ne se cumulent pas — la rapière et l'arc font deux boutons, le contact d'abord.
const PANOPLIE=[{id:'rap',name:'Rapière',category:'weapon',hands:1,dice:{white:2}},
 {id:'arc',name:'Arc court',category:'weapon',ranged:true,dice:{red:2}},
 {id:'dag',name:'Dague',category:'weapon',hands:1,dice:{bone:1}},
 {id:'hache',name:'Hache lourde',category:'weapon',hands:2,dice:{black:3}}];
assert.deepEqual(gearApi.attackChoices({weapons:['rap','arc'],attacks:[]},PANOPLIE)
 .map(x=>x.name+'/'+x.range),['Rapière/contact','Arc court/distance']);
assert.deepEqual(gearApi.attackChoices({weapons:['arc','rap'],attacks:[]},PANOPLIE).map(x=>x.name),['Rapière','Arc court']);
assert.deepEqual(gearApi.attackChoices({weapons:['arc'],attacks:[]},PANOPLIE).map(x=>x.name+'/'+x.range),['Arc court/distance']);
assert.deepEqual(gearApi.gearAttacks({weapons:['rap','arc']},PANOPLIE)[0].dice,{white:2,red:0,bone:0,blue:0,green:0,black:0,yellow:0});
assert.deepEqual(gearApi.gearAttacks({weapons:['rap','arc']},PANOPLIE)[1].dice.red,2);
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
assert.equal(gearApi.defenseOf({hero:true,def:9,armures:['ar']},ARSENAL),3);
assert.equal(gearApi.defenseOf({hero:false,def:4,armures:['ar']},ARSENAL),3);
assert.equal(gearApi.defenseOf({hero:false,def:4},ARSENAL),4);
/* Les points de vie d'un aventurier ne se saisissent pas : son bonus vient de sa classe
   et de son espèce, son maximum en découle — Vie × Endurance + ce bonus. */
{const {bonusPV,pvMaximum,pvEspece,ESPECES_PV}=require('./combat.js');
 const CLASSES=[{name:'Gardien',tint:'#3f7bc0',pv:18},{name:'Mystique',tint:'#7a5cb8',pv:10}];
 assert.equal(bonusPV(CLASSES,'Gardien'),18);
 assert.equal(bonusPV(CLASSES,'Gardien · Voie du roc'),18);   // La tête du rôle suffit.
 assert.equal(bonusPV(CLASSES,'Mystique'),10);
 assert.equal(bonusPV(CLASSES,'Chasseur'),0);                 // Un rôle libre n'apporte rien.
 assert.equal(bonusPV(CLASSES,''),0);
 assert.equal(bonusPV(null,'Gardien'),0);
 // Les espèces n'ont pas encore de table : leur part vaut zéro, et le calcul l'attend.
 assert.deepEqual(ESPECES_PV,{});
 assert.equal(pvEspece('Nain'),0);
 assert.equal(bonusPV(CLASSES,'Gardien','Nain'),18);
 assert.equal(pvMaximum(CLASSES,{vie:8,endu:3,role:'Gardien'}),8*3+18);
 assert.equal(pvMaximum(CLASSES,{vie:10,endu:3,role:'Gardien'}),10*3+18);
 assert.equal(pvMaximum(CLASSES,{vie:4,endu:2,role:'Chasseur'}),8);
 assert.equal(pvMaximum(CLASSES,{}),1);                       // Jamais moins d'un point de vie.
 assert.equal(pvMaximum(CLASSES,{vie:'x',endu:null,role:'Mystique'}),11);}
/* Une attaque spéciale d'adversaire peut poser une affliction, comme une arme : le moteur
   la reçoit sous la même forme, et elle voyage à l'export. */
{const {attackChoices,cleanMonster}=require('./combat.js');
 const bete={attacks:[{name:'Morsure',etat:'Poison'},{name:'Charge'}]};
 assert.deepEqual(attackChoices(bete,[]).map(x=>x.etats||null),[['Poison'],null]);
 assert.deepEqual(attackChoices({attacks:[{name:'X',etat:'Feu',etats:['Gel']}]},[])[0].etats,['Gel']);
 const sortie=cleanMonster({name:'Vipère',attacks:[{name:'Morsure',etat:'Poison'},{name:'Queue',etat:'Dragon'}]});
 assert.equal(sortie.attacks[0].etat,'Poison');
 assert.ok(!('etat'in sortie.attacks[1]));}
/* Double attaque : un passif qui élargit ce qu'une attaque peut viser. Sans talent, une
   cible ; avec, ce que dit son réglage ; et le plus généreux l'emporte. */
{const {ciblesPermises,TALENTS_CODES,paramsTalent,phraseTalent,libelleTalent}=require('./combat.js');
 const porte=n=>({code:TALENTS_CODES.doubleattaque,params:{cibles:n}});
 assert.equal(ciblesPermises([]),1);
 assert.equal(ciblesPermises(null),1);
 assert.equal(ciblesPermises([{code:TALENTS_CODES.lamevent,params:{}}]),1);   // Un autre talent n'y change rien.
 assert.equal(ciblesPermises([porte(2)]),2);
 assert.equal(ciblesPermises([porte(3)]),3);
 assert.equal(ciblesPermises([porte(2),porte(4)]),4);                          // Le plus généreux l'emporte.
 assert.equal(ciblesPermises([porte(0)]),1);                                   // Jamais moins d'une.
 // Les réglages sont bornés par leur déclaration, et la phrase les dit.
 assert.deepEqual(paramsTalent({effet:'doubleattaque'}),{cibles:2});
 assert.deepEqual(paramsTalent({effet:'doubleattaque',params:{cibles:'4'}}),{cibles:4});
 assert.deepEqual(paramsTalent({effet:'doubleattaque',params:{cibles:99}}),{cibles:6});   // Borné au maximum déclaré.
 assert.deepEqual(paramsTalent({effet:'doubleattaque',params:{cibles:'zéro'}}),{cibles:2});  // Illisible : le défaut.
 assert.match(phraseTalent('doubleattaque'),/cibler <b>2<\/b> adversaires/);
 assert.match(phraseTalent('doubleattaque',{cibles:3}),/cibler <b>3<\/b> adversaires/);
 assert.ok(libelleTalent('doubleattaque').startsWith('Double attaque : '));
 // Un passif n'ouvre aucun bouton : il n'a pas d'effet à déclencher.
 assert.ok(!TALENTS_CODES.doubleattaque.bouton);
 /* Chaque effet câblé dit son type : la bibliothèque s'y range, et un talent de monstre
    porte sa marque. */
 assert.equal(TALENTS_CODES.lamevent.type,'mait');
 assert.equal(TALENTS_CODES.doubleattaque.type,'pass');
 assert.equal(TALENTS_CODES.garderapprochee.type,'pass');
 assert.ok(TALENTS_CODES.garderapprochee.monstre);
 assert.ok(!TALENTS_CODES.lamevent.monstre);
 /* Garde rapprochée : un passif, sans bouton, dont le réglage est le nombre de sbires
    qui encaissent. */
 assert.ok(!TALENTS_CODES.garderapprochee.bouton);
 assert.deepEqual(paramsTalent({effet:'garderapprochee'}),{sbires:1});
 assert.deepEqual(paramsTalent({effet:'garderapprochee',params:{sbires:'3'}}),{sbires:3});
 assert.deepEqual(paramsTalent({effet:'garderapprochee',params:{sbires:99}}),{sbires:6});
 assert.match(phraseTalent('garderapprochee'),/<b>1<\/b> sbire allié au contact les encaisse/);
 assert.match(phraseTalent('garderapprochee',{sbires:2}),/<b>2<\/b> sbires alliés au contact les encaissent/);
 // La phrase dit la cascade : chacun jusqu'à son dernier point de vie, puis le reliquat.
 assert.match(phraseTalent('garderapprochee'),/dernier point de vie ; le reliquat passe au suivant, puis au porteur/);
 assert.ok(libelleTalent('garderapprochee').startsWith('Garde rapprochée : '));
 /* Orbes mystiques : une maîtrise gratuite, réglée en nombre d'orbes et en dégâts. */
 const {orbesPermis,desOrbe,etatDesOrbes,resolveAttack}=require('./combat.js');
 assert.equal(TALENTS_CODES.orbes.type,'mait');
 // Un orbe lance des dés, pas des dégâts : tant de dés d'une couleur, Mystique par défaut.
 assert.deepEqual(paramsTalent({effet:'orbes'}),{orbes:1,des:1,couleur:'blue'});
 assert.deepEqual(paramsTalent({effet:'orbes',params:{orbes:'3',des:12,couleur:'red'}}),{orbes:3,des:6,couleur:'red'});
 assert.deepEqual(paramsTalent({effet:'orbes',params:{couleur:'green'}}),{orbes:1,des:1,couleur:'blue'});  // Le Soin ne frappe pas.
 assert.match(phraseTalent('orbes'),/lancer <b>1<\/b> orbe qui lance <b>1 dé Mystique<\/b>\./);
 assert.match(phraseTalent('orbes',{orbes:3,des:2,couleur:'red'}),/<b>3<\/b> orbes qui lancent <b>2 dés Lourds<\/b> chacun/);
 const tenus=[{code:TALENTS_CODES.orbes,params:{orbes:2,des:1,couleur:'blue'}},{code:TALENTS_CODES.orbes,params:{orbes:1,des:3,couleur:'black'}}];
 assert.equal(orbesPermis(tenus),2);assert.deepEqual(desOrbe(tenus),{n:3,couleur:'black',nom:'Mortel'});assert.equal(desOrbe([]),null);
 assert.equal(orbesPermis([]),0);
 assert.equal(etatDesOrbes(tenus),'');
 /* Destructeur : tous les doubles sont des critiques ; le double 1 reste un échec. */
 assert.equal(TALENTS_CODES.destructeur.type,'mait');assert.match(phraseTalent('destructeur'),/<b>critiques sur tous ses doubles<\/b>/);
 assert.equal(resolveAttack({dice:[[3,0],[3,0]],def:0,dmg:0,roll:()=>2}).critical,false);
 const crit=resolveAttack({dice:[[3,0],[3,0]],def:0,dmg:0,roll:()=>2,doublesCritiques:true});
 assert.equal(crit.critical,true);assert.equal(crit.dice.length,3);
 assert.equal(resolveAttack({dice:[[1,0],[1,0]],def:0,dmg:0,roll:()=>2,doublesCritiques:true}).failed,true);
 assert.equal(resolveAttack({dice:[[3,0],[4,0]],def:0,dmg:0,roll:()=>2,doublesCritiques:true}).critical,false);
 /* Orbes de feu : une amélioration libre. Le moteur ne réclame plus les orbes au-dessus —
    c'est le MJ qui nomme le prérequis, talent par talent ; Feu par défaut. */
 assert.equal(TALENTS_CODES.orbesfeu.type,'ame');assert.equal(TALENTS_CODES.orbesfeu.requiert,undefined);
 assert.deepEqual(paramsTalent({effet:'orbesfeu'}),{etat:'Feu'});
 assert.deepEqual(paramsTalent({effet:'orbesfeu',params:{etat:'Gel'}}),{etat:'Gel'});
 assert.deepEqual(paramsTalent({effet:'orbesfeu',params:{etat:'Coma'}}),{etat:'Feu'});
 assert.match(phraseTalent('orbesfeu'),/infligent <b>Feu<\/b> en plus/);
 assert.equal(etatDesOrbes([...tenus,{code:TALENTS_CODES.orbesfeu,params:{etat:'Gel'}}]),'Gel');}
/* Les prérequis : par la fiche (« prerequis ») ou par la mécanique (« requiert »). Aucune
   mécanique livrée n'impose plus de socle — le MJ le nomme lui-même, talent par talent —
   mais la machinerie demeure, et s'éprouve ici sur une mécanique d'essai. */
{const {TALENTS_CODES,manqueTalent,nomPrerequis,talentsDependants,talentsSans,talentsTenus,ordonneTalents}=require('./combat.js');
 assert.deepEqual(Object.values(TALENTS_CODES).filter(c=>c.requiert).map(c=>c.cle),[],'aucune mécanique livrée n’exige un socle');
 TALENTS_CODES.__socle={cle:'__socle',nom:'Socle d’essai',type:'mait',params:[],phrase(){return ''}};
 TALENTS_CODES.__ame={cle:'__ame',nom:'Âme d’essai',type:'ame',requiert:'__socle',params:[],phrase(){return ''}};
 try{
 const a={id:'a',name:'Orbes mystiques',effet:'__socle'},b={id:'b',name:'Orbes de feu',effet:'__ame'},
  c={id:'c',name:'Souffle',effet:'',prerequis:'a'},d={id:'d',name:'Brasier',effet:'',prerequis:'b'},e={id:'e',name:'Lamevent',effet:'lamevent'};
 const cat=[a,b,c,d,e];
 assert.equal(manqueTalent([],b,cat),'Socle d’essai');    // la mécanique le réclame
 assert.equal(manqueTalent(['a'],b,cat),'');
 assert.equal(manqueTalent([],c,cat),'Orbes mystiques');    // la fiche le nomme
 assert.equal(manqueTalent(['a'],c,cat),'');
 assert.equal(manqueTalent([],a,cat),'');assert.equal(manqueTalent([],e,cat),'');
 assert.equal(manqueTalent(['b'],d,cat),'');
 assert.equal(nomPrerequis(b,cat),'Socle d’essai');assert.equal(nomPrerequis(c,cat),'Orbes mystiques');
 assert.equal(nomPrerequis(d,cat),'Orbes de feu');assert.equal(nomPrerequis(a,cat),'');
 assert.deepEqual(talentsDependants(a,cat).map(t=>t.id),['b','c']);
 assert.deepEqual(talentsDependants(b,cat).map(t=>t.id),['d']);
 // Oublier le socle fait tomber toute la branche, de proche en proche.
 assert.deepEqual(talentsSans(['a','b','c','d','e'],'a',cat),{liste:['e'],tombes:['Orbes de feu','Souffle','Brasier']});
 assert.deepEqual(talentsSans(['a','b','d'],'b',cat),{liste:['a'],tombes:['Brasier']});
 // Une amélioration orpheline ne compte pas pour le moteur.
 assert.deepEqual(talentsTenus(['b','e'],cat).map(t=>t.id),['e']);
 assert.deepEqual(talentsTenus(['a','b'],cat).map(t=>t.id),['a','b']);
 // L'arbre : chaque amélioration suit son socle ; sans socle dans la liste, à la racine.
 assert.deepEqual(ordonneTalents([e,a,b,c,d],cat).map(([t,p])=>t.id+p),['e0','a0','b1','d2','c1']);
 assert.deepEqual(ordonneTalents([b,d],cat).map(([t,p])=>t.id+p),['b0','d1']);
 assert.deepEqual(ordonneTalents([d],cat).map(([t,p])=>t.id+p),['d0']);
 // Un cycle ne bloque rien : tout finit par sortir, une fois.
 const x={id:'x',name:'X',prerequis:'y'},y={id:'y',name:'Y',prerequis:'x'};
 assert.deepEqual(ordonneTalents([x,y],[x,y]).map(([t])=>t.id).sort(),['x','y']);
 }finally{delete TALENTS_CODES.__socle;delete TALENTS_CODES.__ame}}
/* Débordement, Rempart, Gardien et son amélioration : déclarés, réglés, et les petites
   règles pures qui les portent. */
{const {TALENTS_CODES,paramsTalent,phraseTalent,partDuRempart,porteEffet,ONDE_EXCLUS}=require('./combat.js');
 assert.equal(TALENTS_CODES.debordement.type,'pass');assert.match(phraseTalent('debordement'),/<b>reliquat de dégâts<\/b>/);
 assert.equal(TALENTS_CODES.rempart.type,'pass');assert.match(phraseTalent('rempart'),/<b>la moitié<\/b>/);
 assert.equal(TALENTS_CODES.gardien.type,'mait');assert.match(phraseTalent('gardien'),/<b>au contact<\/b> reçoit <b>Blindage<\/b>/);
 assert.ok(!TALENTS_CODES.gardienblindage);   // L'amélioration a disparu avec l'état Gardé.
 // La part du rempart : la moitié arrondie au-dessus, rien sur rien.
 assert.equal(partDuRempart(5),3);assert.equal(partDuRempart(4),2);assert.equal(partDuRempart(1),1);assert.equal(partDuRempart(0),0);
 const g=[{code:TALENTS_CODES.gardien,params:{}}];
 assert.ok(porteEffet(g,'gardien'));assert.ok(!porteEffet(g,'rempart'));
 assert.ok(!ONDE_EXCLUS.includes('Gardé'));}
/* Les logos d'équipement déclarés dans l'éditeur sont exactement les weapon_*.png du
   dossier img : un fichier ajouté sans être déclaré n'apparaîtrait dans aucun menu. */
{const src=fs.readFileSync('editor.js','utf8');const m=src.match(/const LOGOS_EQUIPEMENT=(\[[^\]]*\]);/);
 assert.ok(m,'LOGOS_EQUIPEMENT introuvable');const declares=JSON.parse(m[1].replace(/'/g,'"')).sort();
 const fichiers=fs.readdirSync('img').filter(f=>/^weapon_.*\.png$/.test(f)).map(f=>f.replace(/\.png$/,'')).sort();
 assert.deepEqual(declares,fichiers,'LOGOS_EQUIPEMENT doit lister img/weapon_*.png : '+fichiers.join(', '));
 // Un seul bouton, et le logo de la première arme équipée — ou de la première qui en a un.
 const {gearAttacks}=require('./combat.js');
 const items=[{id:'e',name:'Épée',category:'weapon',hands:1,dice:{white:1},logo:'weapon_epee'},{id:'d',name:'Dague',category:'weapon',hands:1,dice:{white:1}},{id:'a',name:'Arc',category:'weapon',hands:2,ranged:true,dice:{white:1},logo:'weapon_arc'}];
 const att=gearAttacks({weapons:['e','e','d','a']},items);
 assert.equal(att.length,2);assert.deepEqual(att[0].logos,['weapon_epee','weapon_epee']);   // Deux épées : deux logos, croisés.assert.equal(att[0].dice.white,3);
 assert.deepEqual(att[1].logos,['weapon_arc']);assert.equal(att[1].range,'distance');
 assert.deepEqual(gearAttacks({weapons:['a','e']},items).map(x=>x.logos),[['weapon_epee'],['weapon_arc']]);
 assert.deepEqual(gearAttacks({weapons:['d','e']},items)[0].logos,['weapon_epee']);
 assert.deepEqual(gearAttacks({weapons:['d']},items)[0].logos,[]);
 // Deux armes à logo : les deux logos, dans l'ordre d'équipement, pour que le bouton les croise.
 const h={id:'h',name:'Hache',category:'weapon',hands:1,dice:{white:1},logo:'weapon_hache'};
 assert.deepEqual(gearAttacks({weapons:['e','h']},[...items,h])[0].logos,['weapon_epee','weapon_hache']);
 assert.deepEqual(gearAttacks({weapons:['e','e']},items)[0].logos,['weapon_epee','weapon_epee']);
 // Les logos d'objets déclarés sont exactement les item_*.png du dossier ; le menu d'un objet les
 // propose, celui d'une arme ou d'une armure garde les weapon_* ; une pastille accepte les deux.
 const mo=src.match(/const LOGOS_OBJET=(\[[^\]]*\]);/);assert.ok(mo,'LOGOS_OBJET introuvable');
 const objets=fs.readdirSync('img').filter(f=>/^item_.*\.png$/.test(f)).map(f=>f.replace(/\.png$/,'')).sort();
 assert.deepEqual(JSON.parse(mo[1].replace(/'/g,'"')).sort(),objets,'LOGOS_OBJET doit lister img/item_*.png : '+objets.join(', '));
 assert.ok(src.includes("function logosItem(o){const c=o&&o.category;return c==='weapon'||c==='armor'?LOGOS_EQUIPEMENT:LOGOS_OBJET}")
  &&src.includes("...logosItem(a).map(l=>[l,nomLogo(l)])")&&src.includes("a.logo=logosItem(a).includes(f.logo.value)?f.logo.value:''")
  &&src.includes("logoImage(o&&o.logo,[...LOGOS_EQUIPEMENT,...LOGOS_OBJET],cls)")&&src.includes("replace(/^(weapon|spell|item|attack)_/,'')"),'les objets choisissent parmi les item_*');
 // Les logos de talents déclarés sont exactement les spell_*.png du dossier.
 {const ma=src.match(/const LOGOS_ATTAQUE=(\[[^\]]*\]);/);assert.ok(ma,'LOGOS_ATTAQUE introuvable');
  const attaques=fs.readdirSync('img').filter(f=>/^attack_.*\.png$/i.test(f)).map(f=>f.replace(/\.png$/i,'')).sort();
  assert.deepEqual(JSON.parse(ma[1].replace(/'/g,'"')).sort(),attaques,'LOGOS_ATTAQUE doit lister img/attack_*.png : '+attaques.join(', '));
  assert.ok(src.includes('const LOGOS_TOUS=[...LOGOS_ATTAQUE,...LOGOS_EQUIPEMENT,...LOGOS_TALENT,...LOGOS_OBJET];')
   &&src.includes('function logoAttaque(l,cls){return logoImage(l,LOGOS_TOUS,cls)}')
   &&src.includes("(at.logos||[]).forEach(l=>{const im=logoAttaque(l,'bouton');if(im)logos.append(im)});")
   &&src.includes("choixVif(icone,(at.logos||[])[0]||'',[['','— aucune icône —'],...LOGOS_TOUS.map(l=>[l,nomLogo(l)])],")
   &&src.includes("v=>{at.logos=v?[v]:[];dessineIcone();poser()},'Icône de l’attaque');")
   &&src.includes(' tete.append(icone,nom,etat,desVifs(at,poser));')
   &&fs.readFileSync('editor.css','utf8').includes('.best-att-tete .etat-inflige{margin-left:auto}')
   &&src.includes("replace(/^(weapon|spell|item|attack)_/,'')")
   &&fs.readFileSync('editor.css','utf8').includes('.best-att-tete .att-logo{'),'une attaque spéciale choisit son icône parmi toutes celles du dossier');}
 const mt=src.match(/const LOGOS_TALENT=(\[[^\]]*\]);/);assert.ok(mt,'LOGOS_TALENT introuvable');
 const sorts=fs.readdirSync('img').filter(f=>/^spell_.*\.png$/.test(f)).map(f=>f.replace(/\.png$/,'')).sort();
 assert.deepEqual(JSON.parse(mt[1].replace(/'/g,'"')).sort(),sorts,'LOGOS_TALENT doit lister img/spell_*.png : '+sorts.join(', '));}
/* Les objets de carte : relus au travers de leur déclaration, bornés, jamais illisibles. */
{const {cleanObjet,cleanMap}=require('./combat.js');
 const o=cleanObjet({id:'o1',nom:'Coffre',desc:'Un coffre.',x:150,y:-3,taille:'huge',visible:false,items:['e','',7,'a'],tresor:'12 pièces',test:{comp:9,reussites:0}});
 assert.equal(o.nom,'Coffre');assert.equal(o.x,100);assert.equal(o.y,0);assert.equal(o.taille,'medium');
 assert.equal(o.visible,false);assert.deepEqual(o.items,['e','a']);assert.equal(o.tresor,'12 pièces');
 assert.deepEqual(o.test,{comp:7,reussites:1});
 assert.deepEqual(cleanObjet({}).test,{comp:0,reussites:1});assert.equal(cleanObjet({}).visible,true);assert.equal(cleanObjet({}).nom,'Objet');
 const m=cleanMap({name:'C',objets:[{nom:'Levier',x:10,y:20,taille:'small',visible:true}]});
 assert.equal(m.objets.length,1);assert.equal(m.objets[0].taille,'small');
 assert.deepEqual(cleanMap({name:'C'}).objets,[]);}
// Deux exemplaires de la même arme : les dés s'additionnent comme deux armes distinctes.
const epee={id:'e',dice:{white:2,red:1}};
assert.deepEqual(gearApi.equippedPool({weapons:['e']},[epee]).slice(0,4),[2,0,1,0]);
assert.deepEqual(gearApi.equippedPool({weapons:['e','e']},[epee]).slice(0,4),[4,0,2,0]);
assert.deepEqual(gearApi.equippedPool({weapons:['e','e']},[{id:'e',dice:{white:9}}]).slice(0,1),[12]); // Plafond à douze.
assert.equal(nu.dmg,8);assert.equal(nu.skills[0],4);assert.equal(nu.pool[0],2);assert.equal(nu.name,'<Éla>');
// Équipé : les dés viennent de l'arme et la DEF de l'armure, pas des champs saisis.
const equipe=lire([{id:'w',category:'weapon',dice:{white:3}},{id:'a',category:'armor',slot:'torse',def:5}],{hero:true,inventaire:['w','a'],weapons:['w'],armorId:'a'});
assert.deepEqual(equipe.inventaire,['w','a']);   // L'inventaire suit, l'équipement en fait partie.
const porteSansAvoir=lire([{id:'w',category:'weapon',dice:{white:3}}],{hero:true,inventaire:[],weapons:['w']});assert.deepEqual(porteSansAvoir.inventaire,['w']);   // Porté sans être possédé : entre dans l'inventaire.
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
assert.equal(equippedDef({armures:['ma'],shieldId:'bo'},OBJETS),4);
assert.equal(equippedDef({armures:['ma']},OBJETS),3);
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
/* L'ordre canonique des cibles : les plus proches ; à égalité sbires, Élites, Solitaires, Boss ;
   à nom égal la place dans la liste, qui est le numéro porté sur le socle. */
{const {ordreCibles,rangType,cleClasse,classeDe}=require('./combat.js');
 const m=(name,type,x=0,y=0)=>({name,type,hero:false,x,y});
 // Sans point de départ, le type tranche : sbires, Élites, Solitaires, Boss ; puis la place.
 const troupe=[[m('Gobelin','standard'),0],[m('Reine','boss'),1],[m('Élite des bois','alpha'),2],
  [m('Gobelin','standard'),3],[m('Ermite','solitaire'),4],[m('Brute','standard'),5]];
 assert.deepEqual(ordreCibles(troupe).map(([o,i])=>o.name+i),
  ['Gobelin0','Gobelin3','Brute5','Élite des bois2','Ermite4','Reine1']);
 // Depuis un socle : le plus proche d'abord, quel que soit son type.
 const depuis={x:10,y:50},cadre={width:1000,height:1000};
 const proches=[[m('Gobelin','standard',40,50),0],[m('Reine','boss',20,50),1],[m('Gobelin','standard',20,50),2],[m('Ermite','solitaire',30,50),3]];
 assert.deepEqual(ordreCibles(proches,depuis,cadre).map(([o,i])=>o.name+i),['Gobelin2','Reine1','Ermite3','Gobelin0']);
 // Deux monstres du même nom : la place dans la liste tranche, donc le numéro du socle.
 assert.deepEqual(ordreCibles([[m('Gobelin','standard'),7],[m('Gobelin','standard'),2]])
  .map(([,i])=>i),[2,7]);
 assert.equal(rangType({name:'Éla',hero:true}),0);        // Un aventurier compte comme un sbire.
 assert.equal(rangType({type:'inconnu'}),0);              // Un type inattendu aussi.
 assert.equal(rangType(null),0);
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
 poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,armuresDe:gearApi.armuresDe,emplacementDe:gearApi.emplacementDe,placesLibres:gearApi.placesLibres,placesEmplacement:gearApi.placesEmplacement,EMPLACEMENTS:gearApi.EMPLACEMENTS,portesA:gearApi.portesA,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,
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
 {hero:false,name:'Autre',template:'t2',hp:12,max:12},                  // Autre modèle : intouché.
 {hero:false,name:'Sbire',template:'perdu',hp:12,max:12}];               // Modèle disparu : repris par le nom.
const ctxT={actors:table,num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),
 // Le bestiaire et les cartes du test : « t2 » existe, « perdu » n'existe plus.
 catalog:{monsters:[{id:'t1',name:'Sbire'},{id:'t2',name:'Autre'}]},
 maps:[{foes:[{tpl:{id:'t1',name:'Sbire',pv:12}},{tpl:{id:'t2',name:'Autre',pv:12}},{}]}],saveMaps:()=>{},
 setState:gearApi.setState,structuredClone,normalizeActor:a=>a,poolFrom:()=>null,
 activeAttack:a=>(a.attacks&&a.attacks[0])||{},
 fromMonster:m=>({hero:false,template:m.id,name:m.name,role:m.family||'Adversaire',
  hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,
  notes:m.notes||'',attacks:structuredClone(m.attacks||[]),image:m.image||null})};
vm.createContext(ctxT);
vm.runInContext(bloc+';result=syncFromTemplate({id:"t1",name:"Sbire",pv:20})',ctxT);
assert.equal(ctxT.result,5);                                    // Cinq créatures suivies.
assert.equal(table[0].max,24);                                  // Le héros n'a pas bougé.
assert.equal(table[1].hp+'/'+table[1].max,'20/20');             // Intact, plein au nouveau plafond.
assert.equal(table[2].hp+'/'+table[2].max,'4/20');              // Blessé, la blessure tient.
assert.equal(table[3].states.length,0);                         // PV rendus, le Coma tombe.
assert.equal(table[4].hp+'/'+table[4].max,'20/20');             // Le rattrapage par le nom a joué.
assert.equal(table[5].max,12);                                  // L'autre modèle est resté à part.
assert.equal(table[6].hp+'/'+table[6].max,'20/20');             // Modèle disparu, repris par son nom.
assert.equal(table[6].template,'t1','elle adopte le modèle qui l’a reprise');
assert.equal(table[4].template,'t1','celle qui n’en avait pas l’adopte aussi');
// La copie que la carte garde du modèle suit : plus besoin de rouvrir la carte pour la voir changer.
assert.equal(ctxT.maps[0].foes[0].tpl.pv,20);
assert.equal(ctxT.maps[0].foes[1].tpl.pv,12,'le modèle d’à côté n’a pas bougé');
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
/* La sauvegarde globale : ce que l'import accepte, ce qu'il refuse, et le résumé qu'il annonce. */
const sauve={};vm.createContext(sauve);vm.runInContext(editor.slice(editor.indexOf('function nomSauvegarde'),editor.indexOf('function appliquerSauvegarde')),sauve);
const bonne={version:8,actors:[{hero:true,name:'A'},{hero:true},{hero:false}],catalog:{monsters:[1,2],items:[1],talents:[1,2,3]},maps:[{},{}]};
assert.equal(sauve.verifieSauvegarde(bonne),'');
assert.equal(sauve.verifieSauvegarde({...bonne,version:7}),'');                                    // L'ancienne forme se relit.
assert.match(sauve.verifieSauvegarde(null),/pas une sauvegarde/);
assert.match(sauve.verifieSauvegarde([1]),/pas une sauvegarde/);
assert.match(sauve.verifieSauvegarde({...bonne,version:3}),/Version de sauvegarde inconnue \(3\)/);
assert.match(sauve.verifieSauvegarde({...bonne,actors:[]}),/aucun combattant/);
assert.match(sauve.verifieSauvegarde({...bonne,actors:[{hero:false}]}),/aucun aventurier/);
assert.match(sauve.verifieSauvegarde({...bonne,catalog:[]}),/catalogue/);
assert.match(sauve.verifieSauvegarde({...bonne,maps:{}}),/cartes/);
assert.equal(sauve.verifieSauvegarde({...bonne,catalog:undefined,maps:undefined}),'');          // Sans cartes ni catalogue : lisible quand même.
assert.equal(sauve.resumeSauvegarde(bonne),'2 aventuriers, 1 adversaire, 2 cartes, 2 modèles, 1 équipement, 3 talents');
assert.equal(sauve.resumeSauvegarde({actors:[{hero:true}]}),'1 aventurier, 0 adversaire, 0 carte, 0 modèle, 0 équipement, 0 talent');
assert.equal(sauve.nomSauvegarde(new Date(2026,8,16,9,5)),'amertume-20260916-0905.json');
assert.equal(sauve.tailleLisible(500),'1 Ko');
assert.equal(sauve.tailleLisible(3*1048576),'3,0 Mo');
// Les Paramètres portent les deux gestes, et l'import ne prend que du JSON.
['id="export-tout"','id="import-tout"','id="import-fichier"','accept=".json,application/json"','id="import-erreur"'].forEach(m=>assert.ok(src.includes(m),'Paramètres sans '+m));
// La sauvegarde locale et le fichier passent par la même vérification et la même pose.
assert.ok(src.includes('get.onsuccess=()=>{poser(get.result);finish()}')&&src.includes('if(verifieSauvegarde(s))return;'));
/* La table en ligne : ce que le joueur voit quand ça coince, et l'ordre des choses. */
const vivant=fs.readFileSync('live.js','utf8');
assert.ok(vivant.indexOf('onAuthStateChanged(u=>{off();r(u)})')<vivant.indexOf('await auth.signInAnonymously()'),'l’identité mémorisée revient avant toute connexion anonyme');
assert.ok(vivant.includes("liveErreur(e));ouvreTable();return"),'un échec pour rejoindre ouvre la fenêtre');
assert.ok(vivant.includes('await publishShared(false)'),'ouvrir une table publie d’abord le contenu');
assert.ok(vivant.includes("if(invite){view='player'"),'un invité joue en joueur');
/* Le chargement n'attend pas une sauvegarde muette, et une erreur se lit sur le voile. */
assert.ok(src.includes("setTimeout(()=>{if(!sessionRepondue)ouvrir()},3000)"),'une ouverture sans réponse se relance');
assert.ok(src.includes("finish()}},8000)"),'la scène s’ouvre quoi qu’il arrive');
assert.ok(page.includes("c.textContent='Le chargement a échoué : '"),'le voile dit l’erreur');
/* Les règles de la table doivent connaître chaque clé du document vivant : une clé de plus
   côté client, et chaque envoi est refusé (c'est arrivé avec « mode »). */
const regles=fs.readFileSync('firestore-online.rules','utf8');
const champsMJ=JSON.parse(vivant.match(/const CHAMPS_MJ=(\[[^\]]*\]);/)[1].replace(/'/g,'"'));
const regleLive=regles.slice(regles.indexOf('match /amertume_online_live/'));
const clesRegle=JSON.parse(regleLive.match(/request\.resource\.data\.keys\(\)\.hasOnly\((\[[^\]]*\])\)/)[1].replace(/'/g,'"'));
assert.deepEqual([...clesRegle].sort(),[...champsMJ,'actors','doors','mj','at'].sort(),'les clés de la règle update ne suivent pas CHAMPS_MJ');
// Ce que le client envoie vraiment : les clés d'etatVivant, toutes dans la règle.
['actors','round','locked','mode','mapId','title','doors'].forEach(k=>assert.ok(clesRegle.includes(k),'clé absente de la règle : '+k));
/* Le journal partagé : les clés de la règle suivent le client, les dés font l'aller-retour,
   et un joueur en ligne ne révèle rien de lui-même. */
const clesJournal=JSON.parse(vivant.match(/const CLES_JOURNAL=(\[[^\]]*\]);/)[1].replace(/'/g,'"'));
const regleJournal=regles.slice(regles.indexOf('match /journal/{ligne}'));
assert.deepEqual(JSON.parse(regleJournal.match(/hasOnly\((\[[^\]]*\])\)/)[1].replace(/'/g,'"')).sort(),[...clesJournal].sort(),'les clés du journal ne suivent pas la règle');
const jl={};vm.createContext(jl);vm.runInContext(vivant.slice(vivant.indexOf('function codeDes'),vivant.indexOf('function fiche')),jl);
assert.equal(JSON.stringify(jl.decodeDes(jl.codeDes([[5,0],[3,1],[6,7]]))),'[[5,0],[3,1],[6,7]]');
assert.ok(page.includes("(typeof spectateur==='function'&&spectateur())?[]:actors.filter("),'un joueur en ligne ne révèle pas');
assert.ok(vivant.includes("if(meta&&meta.local)return;"),'les lignes propres à l’appareil restent chez elles');
/* La table : la référence se prend avant le rendu, les positions partent par salves, les
   socles reçus glissent, et deux doigts mènent la carte. */
assert.ok(vivant.indexOf("base=etatVivant();")<vivant.indexOf("aRepousser.forEach(([id,k])")&&vivant.indexOf("aRepousser.forEach(([id,k])")<vivant.indexOf("  if(change)render();\n }finally{appliquantDistant=false;dernierPousse=base||etatVivant();poussePret=true;pousserPlusTard()")
 ,'la référence précède le rendu');
assert.ok(vivant.includes('function pousserBientot')&&page.includes("if(typeof pousserBientot==='function')pousserBientot()"),'le glissement part par salves');
assert.ok(vivant.includes("appliquerSalle(dernierDoc,true)")&&vivant.includes("seulementPositions(docPrecedent,d)"),'les positions seules glissent sans rendu');
assert.ok(page.includes("t.dataset.id=a.id")&&page.includes(".token.glisse{transition:"),'le socle reçu est retrouvé et glisse');
assert.ok(page.includes("addEventListener('touchmove'")&&page.includes("mapPanX+=c.x-doigts.x"),'deux doigts font glisser la carte');
/* Le point d'Action chez le joueur, les orbes gratuits, l'orbe qui vole. */
assert.ok(/orbes:\{[^}]*gratuit:true/.test(fs.readFileSync('combat.js','utf8')),'les orbes se disent gratuits');
assert.ok(page.includes("if(actionPrise(a)){log(a.name+' a déjà dépensé son Action ce tour.'")&&page.includes("if(actionPrise(a))return 'Action déjà dépensée ce tour.';"),'l’Action prise ferme la rangée');
assert.ok(page.includes('function volOrbe(')&&vivant.includes("rec.genre==='effet'"),'l’orbe vole ici et en face');
assert.ok(vivant.includes("if(!estMJ()&&CHAMPS_ACTEUR_MJ.includes(k))return;")&&vivant.includes('aRepousser.push([id,k])'),'« vu » n’appartient qu’au MJ');
/* Les invités ne dirigent pas, la carte reste voilée jusqu'au brouillard, le journal a ses tons. */
assert.ok(vivant.includes('function verrouillerInvite')&&vivant.includes("if(spectateur()&&view!=='player'){view='player'"),'un invité reste en vue joueur');
const cartes=fs.readFileSync('maps.js','utf8');
assert.ok(cartes.includes("if(cleVoile()!==cartePeinte)voileAttente.hidden=false;")&&cartes.includes('renderFog();renderZones();leverVoile();')&&page.includes('#voile-attente{'),'la carte se voile jusqu’au brouillard');
assert.ok(page.includes(".j-entry.ton-talent{")&&page.includes("li.classList.add('j-attaque','ton',/^spell_/.test(logo||'')?'ton-talent':'ton-attaque')"),'le journal a ses tons');
// Le journal se cale sur le bas de la carte, et se libère sur une colonne.
assert.ok(cartes.includes('function calerColonnes')&&cartes.includes('renderMapLayer();calerColonnes();')&&page.includes('.stack.right.calee .journal{flex:1'),'les colonnes se calent sur la centrale');
assert.ok(cartes.includes("moveActor(heros[i],p.x,p.y,true)"),'l’ouverture d’une carte place librement');
assert.ok(feuille.includes('repeat(4,minmax(0,1fr))')&&feuille.includes("@media(max-width:1150px){.hero-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}"),'quatre aventuriers par ligne');
assert.ok(page.includes(".eyebrow,.turn-head .eyebrow,#titre-tour,.journal-title,.titre-actions,.panel>h2,#carte-titre{font:600 13px")&&feuille.includes(".bloc-titre,.bloc-replie .bloc-titre{font:600 13px")&&page.includes('.actions-rangee>.attack-card{margin:0;height:220px;overflow:auto}'),'un seul lettrage de titres');
/* Le journal se vide et s'écrit ; les lignes ne disent plus « Coma » mais 💀 ; la fiche tient dans sa colonne. */
assert.ok(page.includes('id="journal-chat"')&&page.includes('function logChat(')&&vivant.includes("rec.effet==='vider'&&duMJ"),'le journal s’écrit et se vide');
assert.ok(!page.includes("' Coma.'")&&page.includes("' 💀'")&&!page.includes('Les dés ne passent pas la DEF'),'💀 et rien de plus');
assert.ok(src.includes('function talentPill(t,compact)')&&src.includes("talentPill(t,true)")&&feuille.includes('.talent-grille .cat-pill{'),'les talents de la fiche sont compacts');
assert.ok(page.includes('minmax(0,1fr) 340px')&&page.includes('minmax(0,1fr) 380px'),'la colonne de droite s’élargit');
/* L'orbe et la flèche volent avant que les dégâts tombent ; l'œil de la troupe ; le journal épuré. */
assert.ok(page.includes('function volFleche(')&&vivant.includes("rec.effet==='fleche'")&&page.includes("diffuserEffet('fleche',a,actors[j],null)")
 &&page.includes('function volBalayage(')&&vivant.includes("rec.effet==='balayage'")&&page.includes("diffuserEffet('balayage',a,actors[j],null)"),'le souffle et le balayage jouent ici et en face');
assert.ok(page.includes("if(duree>0)setTimeout(()=>{poser();render();")&&page.includes("setTimeout(()=>{tirEnVol=false;frapper();scheduleSave()},duree)"),'les dégâts attendent le vol');
assert.ok(cartes.includes("icone('troupe-eye'")&&cartes.includes('function oeilJoueur')&&cartes.includes("inconnu=oeilJoueur()?255:110"),'l’œil de la troupe');
assert.ok(!page.includes('Bienvenue dans Amertume')&&!cartes.includes("(d.secret?'Passage secret ':'Porte ')")&&page.includes(" garde '+o.name+' : Blindage.'")&&page.includes("' 🔍 '+o.name+' :\\n'"),'le journal s’épure');
assert.ok(!src.includes("loin.textContent=' ⤳'")&&page.includes('.actor.enemy.k-alpha:not(.selected){background:#efdcc2}')&&page.includes("r.damage+' Dégâts'+(poses.length?' + '+poses.join(' + '):'')+'.'"),'boutons et vignettes');
/* Le tour 1 à l'ouverture d'une carte, les numéros à la révélation, les adversaires cachés repliés, l'Onde et les talents en colonnes. */
assert.ok(page.includes('function remiseAuTourUn')&&cartes.includes("if(typeof remiseAuTourUn==='function')remiseAuTourUn();"),'ouvrir une carte revient au tour 1');
assert.ok(page.includes('function prochainNumero')&&page.includes("a.vu=true;if(!a.numero)a.numero=prochainNumero(a)")&&JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"')).includes('numero'),'les numéros se donnent à la révélation');
assert.ok(page.includes("groupeReplie('Adversaires cachés',cachees)")&&page.includes('let cachesOuverts=false;'),'les adversaires cachés se replient');
assert.ok(page.includes("imgUrl('ONDE.png')")&&src.includes("out.className='talent-grille'")&&feuille.includes('.talent-detail.large{grid-column:1/-1'),'l’Onde et les deux colonnes de talents');
/* La troupe ne voit ni porte de côté ni objet dans le noir ; la barre de la carte se vide ; qui parle. */
assert.ok(cartes.includes('function doorFaces')&&cartes.includes("const t=1-r/L;return rayonContre(")&&cartes.includes("if(oeilJoueur()&&!(seenAt(o.x,o.y)"),'portes et objets ne se devinent plus');
assert.ok(!cartes.includes("before(mapPick,mapOpen)")&&page.includes('<div class="mapbar-h2" hidden>')&&!src.includes("' de la scène.'"),'la barre de la carte se vide');
assert.ok(page.includes("const a=selected!==null?actors[selected]:null;return a?a:{name:'MJ',mj:true}"),'le socle sélectionné parle, sinon le MJ');
/* Le zoom reste net, les points de vie précèdent les combattants, le sélecteur de talents se limite à la classe. */
assert.ok(page.includes('#map-view{--token:46px;position:absolute;inset:0;transform-origin:0 0;background-image')&&!page.includes('id="pv-cible"')&&page.indexOf('id="pv-panel"')<page.indexOf('id="actors"'),'zoom net, points de vie en haut');
assert.ok(src.includes("a.hero?tete:")&&src.includes("cle.startsWith(cleClasse(f))"),'les talents de la classe seulement');
/* Dégâts d'opportunité, Insaisissable, Mauvais Sort. */
{const C2=require('./combat.js');
 assert.equal(C2.TALENTS_CODES.insaisissable.type,'pass');assert.equal(C2.TALENTS_CODES.mauvaissort.monstre,true);
 const des=[[3,0],[6,1],[6,0]],s=C2.mauvaisSort(des,()=>2);
 assert.deepEqual([s.index,s.avant,s.apres],[1,6,2]);assert.equal(des[1][0],2);assert.equal(des[1][1],1);   // Le premier des meilleurs, sa couleur gardée.
 assert.equal(C2.mauvaisSort([],()=>2),null);}
assert.ok(page.includes('function degatsOpportunite')&&page.includes("croises.forEach(([k,set])=>degatsOpportunite(actors[k],[...set]));")&&page.includes("const avant=contactsDe(a);moveActor("),'les dégâts d’opportunité se jugent au lâcher et au clavier');
assert.ok(page.includes("porteEffet(talentsCodes(a),'insaisissable')")&&page.includes("porteEffet(talentsCodes(b),'mauvaissort')?mauvaisSort(dice,d6):null"),'Insaisissable et Mauvais Sort câblés');
// Le journal ne dit ni la fiche enregistrée, ni les créatures mises à jour, ni la carte ouverte.
assert.ok(!src.includes('Fiche enregistrée')&&!src.includes('mise(s) à jour')&&!cartes.includes('» ouverte : '),'le journal se tait sur l’intendance');
/* Un changement local gardé part au prochain envoi ; le MJ réinitialise d'un clic droit ; pastilles à droite. */
assert.ok(vivant.includes("gardes.push([id,k,structuredClone(e[k])])")&&vivant.includes("gardes.forEach(([id,k,v])=>{if(base.actors[id])base.actors[id][k]=v})"),'un changement local gardé part');
assert.ok(page.includes('function inerte(')&&page.includes('function reinitialiser(')&&src.includes('inerte(b,!!refus)')&&src.includes('inerte(b,!t.peut)')&&page.includes('inerte(rev,!!refus)'),'le clic droit du MJ réinitialise');
assert.ok(page.includes('.pastilles{position:absolute;right:8px')&&page.includes('.actor-nom strong{overflow:hidden;text-overflow:ellipsis')&&feuille.includes('button.btn-analyse,button.btn-analyse.on{--fond:#e0a04a;color:#fff;background-image:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.07))}')&&!feuille.includes('#8264bb')&&page.includes('function mouvementPris(')&&page.includes(":mouvementPris(a)?'Mouvement déjà dépensé ce tour")&&page.includes('body.vue-joueur .turn-head{margin-bottom:0}'),'pastilles à droite, nom coupé, Analyser teal, tour compact');
/* Vie ou Endurance corrigée sur une fiche : les PV maximum suivent (Vie × Endu + bonus), sans
   dépasser leurs bornes ni laisser les PV du moment au-dessus ; le sélecteur Analyser n'est pas
   « button button » ; chaque effet déjà porté par un talent du catalogue arbore sa coche verte. */
assert.ok(src.includes('function recalculerPV(')&&src.includes("if(cle==='vie'||cle==='endu')recalculerPV(a);")&&src.includes("writeStat(a,'max',max)"),'les PV max suivent Vie et Endurance');
assert.ok(!/button\s*\/\*[^*]*\*\/\s*button\.btn-analyse/.test(feuille)&&/\*\/\s*button\.btn-analyse,button\.btn-analyse\.on\{--fond:#e0a04a;color:#fff;/.test(feuille),'le sélecteur Analyser vise bien le bouton');
assert.ok(src.includes("filter(t=>t&&t.effet===c.cle).map(t=>t.name)")&&src.includes("coche.className='utilise'")&&src.includes("coche.textContent='✅'")&&feuille.includes('.effet-fiche .utilise{display:inline-block;width:18px'),'coche verte sur les effets utilisés');
{const {pvMaximum,writeStat,setState}=C;const cls=[{name:'Gardien',pv:18}];
 const h={hero:true,role:'Gardien',race:'',vie:3,vieMax:4,endu:3,hp:27,max:27,states:[]};
 assert.equal(pvMaximum(cls,h),27);h.endu=2;assert.equal(pvMaximum(cls,h),24);
 writeStat(h,'max',pvMaximum(cls,h));assert.equal(h.max,24);assert.equal(h.hp,24);
 h.vie=0.5;assert.equal(pvMaximum(cls,h),20);}   // Vie fractionnaire tronquée à 1, jamais 0 : 1 × 2 + 18.
/* Les cibles voyagent par identifiant : chaque table range ses combattants à sa façon, un rang
   envoyé tel quel désignait n'importe qui. Un aventurier ne vise jamais de lui-même un adversaire
   caché à la troupe ; la flèche ne suit qu'une cible valide ; l'orbe ignore Mauvais Sort. */
{const champs=JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"'));
 assert.ok(champs.includes('cibles')&&!champs.includes('target')&&!champs.includes('targets'),'les cibles partent en identifiants');
 assert.ok(vivant.includes('function ciblesIds(')&&vivant.includes('function indicesDesCibles(')&&vivant.includes('e.cibles=ciblesIds(a);')
  &&vivant.includes("const local=k==='cibles'?ciblesIds(a):a[k];")&&vivant.includes("if(k==='cibles'){cibles.push([a,e[k]]);return}")
  &&vivant.includes('cibles.forEach(([a,ids])=>{if(typeof poseCibles===\'function\')poseCibles(a,indicesDesCibles(ids))});'),'les cibles se retraduisent à l’arrivée, une fois la scène en place');
 assert.ok(page.includes("if(cachePour(o,j)&&(view!=='mj'||a.hero))return false;")&&page.includes('function reach(){const a=actors[selected],j=a?ciblesDe(a)[0]:undefined;'),'un aventurier ne vise pas un adversaire caché');
 const orbeSrc=page.slice(page.indexOf('function orbe('),page.indexOf('function cibleAlliee('));
 assert.ok(!orbeSrc.includes('mauvaisSort(')&&!orbeSrc.includes('Mauvais Sort :')&&orbeSrc.includes("let suite='',pose='';"),'l’orbe est un talent : pas de Mauvais Sort');
 const frappeSrc=page.slice(page.indexOf('function frappe('),page.indexOf('function frappe(')+1200);
 assert.ok(frappeSrc.includes("porteEffet(talentsCodes(b),'mauvaissort')?mauvaisSort(dice,d6):null"),'Mauvais Sort reste sur les attaques');}
/* Les boutons d'action écrivent en blanc, actifs, grisés ou inertes ; un talent sans dés ne porte
   plus sa nature ; un adversaire retiré laisse son XP aux aventuriers et les cibles ne glissent pas. */
assert.ok(feuille.includes('letter-spacing:.2px;color:#fff;')&&feuille.includes('button.btn-action:disabled{--fond:var(--disabled);color:#fff;opacity:1;')
 &&feuille.includes('button.btn-action.inerte,button.btn-action.inerte:hover{opacity:1;filter:saturate(.35) brightness(1.1);color:#fff;')
 &&!feuille.includes('encre-sombre')&&!/button\.btn-[a-z]+[^{]*\{[^}]*(color:#2a2118|disabled-ink)/.test(feuille)&&feuille.includes('button.btn-talent.t-mait{--fond:#d4a341}'),'les boutons d’action écrivent en blanc');
assert.ok(!src.includes("className='nature'")&&!feuille.includes('.nature{')&&src.includes("else b.classList.add('sans-des');"),'un talent sans dés ne dit plus sa nature');
assert.ok(src.includes('function xpDesRetires(')&&src.includes('xpDesRetires(partants);')&&src.includes("heros.forEach(h=>writeStat(h,'xp',(Math.trunc(Number(h.xp))||0)+xp));")
 &&src.includes("poseCibles(a,ids.map(id=>actors.findIndex(o=>o&&o.id===id)).filter(j=>j>=0))")&&!src.includes('if(a.target===i)a.target=null;else if(a.target>i)a.target--'),'l’XP d’un adversaire retiré va aux aventuriers, les cibles suivent');
/* Le verrou des déplacements et la remise à zéro d'un bouton se notent chez le MJ seul. */
assert.ok(cartes.includes("'Déplacements rendus aux joueurs.',{ton:'carte',local:true})")&&page.includes("' » réinitialisé.',{local:true})"),'verrou et remise à zéro : notes locales au MJ');
/* La carte tient dans l'écran : sa hauteur laisse la place de la rangée Actions/Dés, et se remesure
   quand cette rangée change de hauteur. */
assert.ok(cartes.includes('function hauteurDispoCarte(')&&cartes.includes('return Math.round(innerHeight-(r.top+scrollY)-sous-marge)}')
 &&cartes.includes('hMax=Math.max(260,hauteurDispoCarte(el))')&&!cartes.includes('Math.round(innerHeight*.72));')
 &&cartes.includes("if(Math.abs(el.offsetHeight-h)>1){applyMapZoom();render()}}).observe(rangee)"),'la carte tient dans l’écran');
/* Une partie à quatre ne republie plus tout à chaque coup : la publication ne suit que le contenu
   (fiches, cartes, catalogue), jamais l'état vivant ; les instantanés en rafale ne coûtent qu'une
   application ; l'écho de son propre envoi ne redessine rien ; l'Action d'un joueur se dépense
   même hors combat. */
{const partage=fs.readFileSync('shared.js','utf8');
 assert.ok(partage.includes('function texteStable(')&&partage.includes("const value=publicContent(),text=texteStable(value);if(!explicit&&text===lastPublishedText)return;")
  &&partage.includes('lastPublishedText=texteStable(publicContent())')&&!partage.includes("b.closest('#hp-buttons')"),'la publication ne suit que le contenu');
 const vol=JSON.parse(partage.match(/const CHAMPS_VOLATILS=(\[[^\]]*\]);/)[1].replace(/'/g,'"'));
 ['x','y','hp','states','checks','target','targets','revealed','vu','numero','orbes','garde'].forEach(k=>assert.ok(vol.includes(k),'volatil : '+k));
 assert.ok(vivant.includes('texteStable(publicContent())!==lastPublishedText')&&vivant.includes('function programmerApplication(')
  &&vivant.includes('dernierDoc=doc.data();programmerApplication()')&&vivant.includes('const avant=JSON.stringify(etatVivant());')
  &&vivant.includes('const change=complet||JSON.stringify(base)!==avant;')&&vivant.includes('if(change)render();'),'rafales et échos ne redessinent pas pour rien');
 assert.ok(page.includes("function actionPrise(a){return view!=='mj'&&!!a&&pointsRestants(a,'action')<=0}")&&page.includes("if(coute&&pointsRestants(a,'action')>0){depensePoint(a,'action');afterAction(a)}")
  &&page.includes('function pastillesPoints(a)')&&page.includes("function mouvementPris(a){return view!=='mj'&&enCombat()&&"),'l’Action se dépense même hors combat, le Mouvement en combat');
 // Le texte stable ignore l'état vivant et retient le contenu.
 const src2=partage.slice(partage.indexOf('const CHAMPS_VOLATILS='),partage.indexOf('function publicContent('));
 const texteStable=new Function(src2+';return texteStable')();
 const base={schema:1,title:'T',round:1,mode:'exploration',mapImage:null,currentMapId:'m1',locked:false,catalog:{items:[]},maps:[{id:'m1',fog:'aaa',doors:[{x:1,y:2,w:3,h:1,open:false}]}],actors:[{id:'a',name:'Éla',hp:10,x:5,y:5,checks:[false,false,false],states:[]}]};
 const joue=structuredClone(base);joue.round=4;joue.mode='combat';joue.locked=true;joue.currentMapId='m2';joue.maps[0].fog='bbb';joue.maps[0].doors[0].open=true;
 Object.assign(joue.actors[0],{hp:3,x:40,y:9,checks:[true,true,false],states:['Feu'],target:2,vu:true,numero:1});
 assert.equal(texteStable(joue),texteStable(base));
 const contenu=structuredClone(base);contenu.actors[0].name='Ela';assert.notEqual(texteStable(contenu),texteStable(base));
 const carte=structuredClone(base);carte.maps[0].doors[0].x=9;assert.notEqual(texteStable(carte),texteStable(base));}
/* Les projectiles volent sur transform et opacity seulement : le compositeur les mène même quand le
   fil principal est pris (dés, rendu complet, état reçu). Plus de left/top dans les images clés. */
{const orbe=page.slice(page.indexOf('function volOrbe('),page.indexOf('function deplacement(')),fleche=page.slice(page.indexOf('function volFleche('),page.indexOf('function volBalayage('));
 const balayage=page.slice(page.indexOf('function volBalayage('),page.indexOf('function floatNumber('));
 assert.ok(!/\{[^}]*\bleft:/.test(balayage.slice(balayage.indexOf('el.animate')))&&balayage.includes('duree=calme?1:320')&&fleche.includes('duree=calme?1:650'),'balayage et souffle : compositeur, rythme fixé');
 assert.ok(!/\{[^}]*\bleft:/.test(orbe.slice(orbe.indexOf('el.animate')))&&!/\{[^}]*\bleft:/.test(fleche.slice(fleche.indexOf('el.animate'))),'pas de left/top animé');
 assert.ok(page.includes('function deplacement(couche,de,vers)')&&orbe.includes("transform:'translate('+arrivee+') scale(1)'")&&fleche.includes("transform:'translate('+arrivee+')'+tourne")
  &&page.includes('.orbe-vol{position:absolute;will-change:transform,opacity;')&&page.includes('.souffle-vol{position:absolute;will-change:transform,opacity;')&&page.includes('.balayage-vol{position:absolute;will-change:transform,opacity;')&&!page.includes('fleche-vol'),'le vol est porté par le compositeur');}
/* Contacts : tous les rayons (aventuriers et adversaires révélés) quand il est actif, la seule
   sélection sinon ; un joueur inspecte n'importe quel combattant — fiche selon ce qu'il en sait,
   aura — sans le contrôler, et ses cases d'activation restent celles de son actif ; les
   projectiles sont plus lents et plus gros. */
assert.ok(page.includes('id="portees">◎ Contacts<')&&page.includes("let porteesOn=localStorage.getItem('amertume-portees')==='1';")&&page.includes("return a.hero||(a.vu&&!a.hidden)")&&!page.includes("couche.hidden=!porteesOn"),'Contacts : tous les rayons, ou la sélection');
assert.ok(page.includes('let inspecteId=null;')&&page.includes("if(!controlled(i)){const a=actors[i];inspecteId=a&&inspecteId!==a.id?a.id:null;render();return}")&&!page.includes('Sélectionne ton aventurier, puis cible')
 &&page.includes("const k=view!=='mj'&&inspecteIndex()>=0?inspecteIndex():selected,a=actors[k];")&&page.includes("  $(id).checked=!!s&&pointsRestants(s,quoi)<=0;")
 &&page.includes('#sheet.secret :is(#sheet-chips,#stats,#hpbar,#bloc-gear,#bloc-talents,#skills,.divider){display:none}')&&page.includes("a.id===inspecteId?'inspecte ':''"),'un joueur inspecte sans contrôler');
assert.ok(page.includes('duration:calme?1:650')&&page.includes('return calme?0:650}')&&page.includes('Math.max(16,tokenOf(vers)*.7)')&&page.includes('const long=Math.max(40,tokenOf(vers)*1.7),haut=Math.max(12,tokenOf(vers)*.5);'),'projectiles plus lents et plus visibles');
/* Dégâts d'opportunité étendus : traverser une zone de contact pendant un glissement compte comme
   s'y arrêter puis en sortir ; tirer ou lancer un orbe au contact déclenche l'occasion de tous les
   adversaires au contact, après les dégâts du tir — un adversaire tué ou entravé ne frappe pas. */
assert.ok(page.includes('function ramasseContacts(')&&page.includes("croises:lot0.map(k=>[k,new Set(contactsDe(actors[k])),{x:actors[k].x,y:actors[k].y}])")
 &&page.includes("drag.croises.forEach(([k,set,pos])=>{const o=actors[k];if(!o)return;ramasseContacts(o,set,pos,size,murs);pos.x=o.x;pos.y=o.y})}"),'la traversée d’une zone de contact compte');
assert.ok(page.includes('function peutFrapperOpportunite(e){return !!e&&alive(e)&&!frozenSolid(e)&&degatsDe(e)>0}')&&page.includes('function opportuniteAuTir(')
 &&page.includes("const contacts=rangeOf(a)==='distance'?contactsDe(a):[];")&&page.includes("afterAction(a);opportuniteAuTir(a,contacts,'tir')}")
 &&page.includes("const poser=()=>{poserOrbe();opportuniteAuTir(a,contacts,'sort')};"),'tir et sort au contact : occasion après les dégâts');
/* Le bestiaire crée des modèles : « + Nouveau monstre » enregistre au bestiaire, pas en scène. */
assert.ok(src.includes('let templateNeuf=false;')&&src.includes("$('bestiary-add').onclick=()=>openActor(null,false,null,true);")
 &&src.includes("templateNeuf=!!neuf&&template===null&&!hero;")&&src.includes("else if(templateNeuf){catalog.monsters.push(toMonster(a));templateNeuf=false;renderCatalogPages();")
 &&src.includes("$('save-template').hidden=draft.hero||templateNeuf;"),'un nouveau monstre du bestiaire y entre');
/* Sans sélection, Points de vie, Actions et fiche restent en place, vides ; le bloc Actions a une
   hauteur de repos pour que la carte calée dessus ne bouge pas au clic. */
assert.ok(page.includes("pv.hidden=view!=='mj';pv.classList.toggle('vide',!a);")&&page.includes("document.querySelector('.attack-card').classList.toggle('vide',!a);")
 &&!page.includes("document.querySelector('.attack-card').hidden=!a")&&page.includes("$('sheet').hidden=false;$('sheet').classList.toggle('vide',!a);")
 &&page.includes('.actions-rangee>.attack-card{margin:0;height:220px;overflow:auto}')&&page.includes('#sheet.vide #hpbar,#sheet.vide #bloc-gear,#sheet.vide .divider{display:none}')&&page.includes('#sheet{min-height:0}')&&page.includes('.piste-des{display:flex;flex-direction:column;gap:8px;height:220px;overflow:hidden}'),'les blocs restent en place, vides');
/* Un talent sans mécanique dont le nom est celui d'une mécanique la reçoit (Double Attaque) ; la ligne
   « Cible : » a disparu ; les blocs vides n'affichent aucun texte. */
assert.ok(src.includes("if(t&&(t.effet===undefined||t.effet===''||!TALENTS_CODES[t.effet]))t.effet=effetParNom(t.name)});")&&!page.includes("'Cible : '+actors[a.target].name")
 &&!page.includes('Sélectionne un combattant pour agir.')&&!page.includes('Aucun combattant sélectionné.'),'Double Attaque se câble par son nom, plus de ligne Cible');
{const {ciblesPermises,TALENTS_CODES:T,paramsTalent}=C;
 const t={name:'Double Attaque',effet:'doubleattaque',params:{cibles:3}};
 assert.equal(ciblesPermises([{code:T.doubleattaque,talent:t,params:paramsTalent(t)}]),3);
 assert.equal(ciblesPermises([{code:T.doubleattaque,talent:{effet:'doubleattaque'},params:paramsTalent({effet:'doubleattaque'})}]),2);}
/* La révélation ne suit que la vision réelle de la troupe : ni le voile levé, ni l'absence de carte
   ne révèlent quoi que ce soit (au rechargement, une carte voile levé révélait tout d'un coup). */
{const tv=cartes.slice(cartes.indexOf('function troupeVoit('),cartes.indexOf('function seenAt('));
 assert.ok(tv.includes('if(!m)return false;')&&!tv.includes('fogOff')&&tv.includes('if(!fogTroupe)return false;')&&tv.includes('if(!size.width)return false;'),'seule la vision réelle révèle');}
/* Le combat commence de lui-même dès qu'un adversaire est révélé — par la vue ou à la main — et
   l'ouverture d'une carte remet la troupe en exploration. */
assert.ok(page.includes("if(!enCombat()&&view==='mj')setTimeout(()=>{if(!enCombat())basculerMode('combat',true)},0);")&&page.includes("if(a.vu&&!enCombat())basculerMode('combat',true);")
 &&cartes.includes("if(typeof remiseAuTourUn==='function')remiseAuTourUn();\n mode='exploration';"),'le combat commence à la première révélation');
/* Glisser plusieurs socles ne coûte plus en proportion : obstacles et murs en pixels construits une
   fois par tâche, auras mémorisées par socle, redessin au plus une fois par image, contacts relevés en
   combat seulement, avec cadre et murs lus une fois. */
assert.ok(cartes.includes('let obstaclesTache=null;')&&cartes.includes("obstaclesTache={m,formes};setTimeout(()=>{obstaclesTache=null},0);")
 &&page.includes('let mursPxTache=null;')&&page.includes("let auraCache={formes:null,cle:'',pts:new Map()};")&&page.includes("auraCache.pts.set(k,pts)")
 &&page.includes("if(!drag.image)drag.image=requestAnimationFrame(()=>{if(drag)drag.image=0;updateRing();updateSight()});")
 &&page.includes("if(enCombat()){const size=mapSize(),murs=walls();")&&page.includes('function ramasseContacts(a,croises,de,size,murs){'),'glisser un lot reste léger');
/* Ciblage : une cible désignée hors de portée ne grise plus l'attaque ; le coup part sur qui est à
   portée, sans jamais retenir une cible automatique ; la désignation lointaine s'efface. */
assert.ok(page.includes('function ciblesAtteignables(a,liste,portee)')&&page.includes("if(ciblesAtteignables(a,vises,portee).length||cibleAutomatique(a,portee).length)return '';")
 &&!page.includes('poseCibles(a,cibleAutomatique(a))')&&page.includes("if(!vises.length){vises=cibleAutomatique(a,portee);if(designees.length){poseCibles(a,[]);render()}}")
 &&!page.includes('Hors du rayon de contact : rapproche-toi'),'l’attaque prend qui est à portée');
/* Les questions de la table passent par une boîte de la page, jamais par confirm() ; la fin du combat
   s'annonce comme son début. */
assert.ok(page.includes('function demander(texte,ok)')&&!page.includes("confirm('Mettre fin au combat")&&!page.includes("confirm('Revenir au tour 1")&&!page.includes("confirm('Vider le journal")
 &&page.includes("if(!await demander('Mettre fin au combat ?")&&page.includes("basculerMode('exploration',true)};")&&page.includes("if(annonce)annonceFlottante(enCombat()?'⚔ Début du combat !':'🕊 Fin du combat')}")
 &&feuille.includes('dialog.demande{width:min(440px,94vw)}'),'les questions de la table ont leur boîte, la fin du combat s’annonce');
/* Un allié désigné ne grise jamais l'attaque : le coup part sur l'adversaire à portée, la désignation
   alliée (protégé d'un Gardien) reste. */
assert.ok(!page.includes('Cible alliée : aucun coup ne part sur un allié.')&&page.includes("const vises=ciblesDe(a).filter(j=>actors[j]&&alive(actors[j])&&actors[j].hero!==a.hero);\n if(ciblesAtteignables(a,vises,portee).length||cibleAutomatique(a,portee).length)return '';"),'un allié désigné ne bloque pas l’attaque');
/* L'Onde de chaque camp, à gauche du « + » : Aventuriers ou Adversaires à 100 % ; l'ancien bouton a disparu. */
assert.ok(!page.includes('id="heal-foes"')&&!src.includes("$('heal-foes')")&&!page.includes("$('heal-foes')")&&page.includes('function remettreCamp(hero)')&&page.includes("b.className='ajout-camp soin-camp'")
 &&page.includes("groupe('Aventuriers',troupe,AJOUT_CAMP.hero,soinCamp().hero)")&&page.includes("if(mj&&soin){soin.hidden=false;h.append(soin)}")&&page.includes('.ajout-camp.soin-camp{margin-left:auto}.ajout-camp.soin-camp+.ajout-camp{margin-left:0}'),'l’Onde de chaque camp remplace Adversaires à 100 %');
/* Sans équipement, pas de rubrique Équipement sur la fiche de table ; la coche d'un modèle analysé se pose
   dans la vignette, à gauche du nom ; les projectiles sont un souffle (650 ms) et le coup au contact un
   balayage d'air (320 ms), le coup tombant au bout du geste. */
assert.ok(page.includes("$('gear-compte').textContent=nbGear;$('bloc-gear').hidden=!nbGear;")&&src.includes("coche.className='coche-modele'")&&src.includes('nom.after(coche)')&&!src.includes("coche.classList.add('coche-analyse')")
 &&feuille.includes('.cat-pill .coche-modele{flex:none;width:16px;height:16px;')&&page.includes("if(rangeOf(a)!=='distance'&&typeof volBalayage==='function'){"),'équipement vide masqué, coche dans la vignette, balayage au contact');
/* La barre de PV d'un token est pleine, entamée ou non — c'est sa hauteur qui dit l'actif ;
   sur la piste des dés, le lanceur à gauche et, au bout de chaque ligne, qui reçoit. */
assert.ok(page.includes('margin-bottom:3px;height:3.2px;border-radius:999px;background:#211f1b;border:1px solid #0000008c;')&&page.includes('function poseJet(ligne,from,to){ligne.de=from;ligne.vers=to;')
 &&page.includes("const de=from||(lignes.find(l=>l.de)||{}).de||null;")&&page.includes("const cible=recoit(l),tc=lignes.length>1?petit:Math.max(petit,taille);if(cible)visage(cible,tc,bordD+10+tc/2,cy)")
 &&page.includes('.board-token{position:absolute;transform:translate(-50%,-50%);border-radius:50%;'),'barre de PV égale, visages sur la piste');
/* Plus de chip Niveau sur la fiche de table ; le balayage est une déchirure dentelée de 90° ; la coche du
   bestiaire suit le nom ; l'équipement se lit en carrés — logo dessus, dés dessous — dont la description
   prend toute la ligne. */
assert.ok(!page.includes("chips.push('Niveau '+a.level)")&&page.includes('clip-path:polygon(')&&page.includes("r(-45)+' scale(.8)'")&&page.includes("r(45)+' scale(1.05)'")&&page.includes('tokenOf(de)*1.6)')
 &&src.includes('function gearCarre(o,n,portes)')&&src.includes('function gearDetail(o,a,enJeu)')&&src.includes("out.className='gear-grille'")&&src.includes("d.className='gear-detail large k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');")&&!src.includes("out.className='gear-pills'")
 &&feuille.includes('.gear-grille{display:flex;flex-wrap:wrap;gap:6px;')&&feuille.includes('.cat-pill.gear-carre{flex:none;width:auto;min-width:69px;min-height:69px;flex-direction:column;')&&feuille.includes('.gear-detail.large{flex-basis:100%;')&&feuille.includes('.cat-pill.gear-carre .die-sq,.cat-pill.gear-carre .pips .etat-inflige{flex-basis:19px;width:19px;height:19px}')&&!feuille.includes('.gear-pills')&&src.includes("d.className='gear-detail large k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');")&&!src.includes('ligne(o.notes)')&&src.includes(' const PAR_LIGNE=6;'),'niveau masqué, déchirure, coche après le nom, équipement en carrés');
/* Invocation et Régénération : deux mécaniques d'adversaire câblées — la pose au clic, les soins au
   tour ou dès le coup reçu, l'état qui les empêche ; le modèle invoqué se choisit au bestiaire. Deux
   armes équipées croisent leurs logos ; la grille d'équipement se serre sur des carrés de 52 px. */
{const {TALENTS_CODES:T,reglageTalent,paramsTalent,regenerationDe,montantRegeneration,phraseTalent}=C;
 assert.equal(T.invocation.type,'act');assert.ok(T.invocation.monstre&&T.invocation.bouton);assert.equal(T.regeneration.type,'pass');assert.ok(T.regeneration.monstre&&!T.regeneration.bouton);
 assert.equal(reglageTalent(T.invocation,{modele:'abc'},'modele'),'abc');assert.equal(reglageTalent(T.invocation,{},'modele'),'');
 const p=paramsTalent({effet:'regeneration',params:{quantite:3,forme:'endu',moment:'fin',bloque:'Feu'}});
 assert.deepEqual(JSON.parse(JSON.stringify(p)),{quantite:3,forme:'endu',moment:'fin',bloque:'Feu'});
 assert.deepEqual(JSON.parse(JSON.stringify(regenerationDe([{code:T.regeneration,params:{quantite:2,forme:'des',moment:'immediat',bloque:''}}]))),{quantite:2,forme:'des',moment:'immediat',bloque:''});
 assert.equal(regenerationDe([{code:T.lamevent,params:{}}]),null);
 assert.deepEqual(montantRegeneration({endu:4,vie:7},{quantite:3,forme:'endu'},()=>6),{total:7,jets:[]});
 assert.deepEqual(montantRegeneration({endu:4,vie:7},{quantite:3,forme:'vie'},()=>6),{total:10,jets:[]});
 assert.deepEqual(montantRegeneration({},{quantite:2,forme:'des'},()=>5),{total:10,jets:[5,5]});
 assert.deepEqual(montantRegeneration({},{quantite:4,forme:'fixe'},()=>1),{total:4,jets:[]});
 assert.ok(phraseTalent('regeneration',{quantite:2,forme:'des',moment:'immediat',bloque:'Feu'}).includes('2d6')&&phraseTalent('regeneration',{quantite:2,forme:'des',moment:'immediat',bloque:'Feu'}).includes('Feu'));
 assert.ok(phraseTalent('invocation',{modele:''}).includes('un combattant du bestiaire'));}
assert.ok(page.includes('function invocation(a,p,talent)')&&page.includes('function annulerPlacement()')&&page.includes('function regenerer(a,quand)')&&page.includes('applyDamage=function(a,montant)')
 &&page.includes("actors.forEach(o=>regenerer(o,'fin'));round++;")&&page.includes("if(actors.filter(o=>regenerer(o,'debut')).length)render()")&&page.includes('.placement #map{cursor:crosshair}')
 &&src.includes("p.type==='modele'?sel(p.nom,'p_'+p.cle,vals[p.cle],[['','— choisir un adversaire —'],...(catalog.monsters||[]).map(m=>[m.id,m.name])])")&&src.includes('function nomModele(id)')
 &&src.includes("if(logos.childElementCount>1)logos.classList.add('croises');")&&feuille.includes('button.choix-attaque .logos.croises .logo-equip:first-child{transform:scaleX(-1)'),'Invocation, Régénération, logos croisés');
/* Inventaire et équipement : tout ce qu'on possède d'un côté, ce qu'on porte de l'autre — deux mains au
   plus, une armure — et l'équipement fait toujours partie de l'inventaire. Les carrés s'élargissent
   avec leurs icônes, jamais sur deux lignes. Les attaques spéciales du bestiaire prennent l'allure
   d'un talent d'action. */
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const code=morceau('function completerInventaire(a)','function syncEquipped(a)')+'\n'+morceau('function gearCount(a,id)','/* Ajouter ou retirer un exemplaire')+'\n'+morceau('function ajouterInventaire(a,o)','const pickerDialog=dialog(');
 t2=null;
 const t={catalog:{items:[{id:'e',name:'Épée',category:'weapon',hands:1},{id:'h',name:'Hache',category:'weapon',hands:1},{id:'arc',name:'Arc',category:'weapon',hands:2,ranged:true},{id:'b',name:'Bouclier',category:'armor',slot:'shield',def:1},{id:'ar',name:'Cotte',category:'armor',slot:'torse',def:2},{id:'p',name:'Potion',category:'object'},
  {id:'cape',name:'Cape',category:'armor',slot:'dos',def:1},{id:'an',name:'Anneau',category:'armor',slot:'anneau',def:0},
  {id:'an2',name:'Anneau de fer',category:'armor',slot:'anneau',def:0}]},
  weaponHands:C.weaponHands,syncEquipped(){},objetDe(id){return t.catalog.items.find(x=>x&&x.id===id)||null},
  armuresDe:C.armuresDe,emplacementDe:C.emplacementDe,placesLibres:C.placesLibres};
 vm.createContext(t);vm.runInContext(code+';this.mainsPrises=mainsPrises;this.toggleEquip=toggleEquip;this.libereMains=libereMains;this.libereEmplacement=libereEmplacement;this.completerInventaire=completerInventaire;this.retirerInventaire=retirerInventaire;this.ajouterInventaire=ajouterInventaire',t);
 const a={inventaire:['e','h','arc','b','ar','p','e','cape','an','an','an','an2'],weapons:[],armures:[],shieldId:''},o=id=>t.catalog.items.find(x=>x.id===id);
 assert.equal(t.toggleEquip(a,o('e')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify(['e']));assert.equal(t.mainsPrises(a),1);
 assert.equal(t.toggleEquip(a,o('b')),null);assert.equal(a.shieldId,'b');assert.equal(t.mainsPrises(a),2);
 // Mains pleines (épée + bouclier) : la hache à une main chasse la plus ancienne, le bouclier reste.
 assert.equal(t.toggleEquip(a,o('h')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify(['h']));assert.equal(a.shieldId,'b');assert.equal(t.mainsPrises(a),2);
 a.weapons=[];a.shieldId='';
 assert.equal(t.toggleEquip(a,o('e')),null);assert.equal(t.toggleEquip(a,o('h')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify(['e','h']));   // Deux armes à une main tiennent ensemble.
 assert.equal(t.toggleEquip(a,o('arc')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify(['arc']));assert.equal(t.mainsPrises(a),2);   // L'arc prend les deux mains : tout le reste tombe.
 assert.equal(t.toggleEquip(a,o('b')),null);assert.equal(a.shieldId,'b');assert.equal(JSON.stringify(a.weapons),JSON.stringify([]));   // Le bouclier chasse l'arc.
 a.weapons=[];a.shieldId='';
 assert.equal(t.toggleEquip(a,o('e')),null);assert.equal(t.toggleEquip(a,o('e')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify(['e','e']));   // Deux exemplaires possédés : les deux en main.
 assert.equal(t.toggleEquip(a,o('e')),null);assert.equal(JSON.stringify(a.weapons),JSON.stringify([]));   // Troisième clic : tout reposé.
assert.equal(t.toggleEquip(a,o('ar')),null);assert.equal(JSON.stringify(a.armures),JSON.stringify(['ar']));assert.ok(/ne s’équipe pas/.test(t.toggleEquip(a,o('p'))));
 /* Les emplacements se cumulent : une cape au dos tient avec l'armure au torse, et trois
    anneaux tiennent ensemble — le quatrième chasse le plus ancien. */
 assert.equal(t.toggleEquip(a,o('cape')),null);assert.equal(JSON.stringify(a.armures),JSON.stringify(['ar','cape']),'le dos et le torse se cumulent');
 assert.equal(t.toggleEquip(a,o('an')),null);assert.equal(t.toggleEquip(a,o('an')),null);assert.equal(t.toggleEquip(a,o('an')),null);
 assert.equal(JSON.stringify(a.armures),JSON.stringify(['ar','cape','an','an','an']),'trois anneaux au doigt');
 assert.equal(t.toggleEquip(a,o('an2')),null);
 assert.equal(JSON.stringify(a.armures),JSON.stringify(['ar','cape','an','an','an2']),'le quatrième anneau chasse le plus ancien');
 assert.equal(t.toggleEquip(a,o('cape')),null);assert.ok(!a.armures.includes('cape'),'un second clic repose la pièce');
 // Une seconde armure de torse remplace la première : une seule place.
 t.catalog.items.push({id:'plaque',name:'Plaque',category:'armor',slot:'torse',def:4});a.inventaire.push('plaque');
 assert.equal(t.toggleEquip(a,o('plaque')),null);
 assert.ok(a.armures.includes('plaque')&&!a.armures.includes('ar'),'un seul torse à la fois');
 // Retirer les exemplaires d'un anneau le dépose au fur et à mesure.
 t.retirerInventaire(a,o('an'));assert.equal(a.armures.filter(x=>x==='an').length,2,'un exemplaire de moins, un anneau de moins');
 t.retirerInventaire(a,o('an'));t.retirerInventaire(a,o('an'));
 assert.ok(!a.armures.includes('an'),'plus d’exemplaire, plus au doigt');
 assert.ok(/pas dans l’inventaire/.test(t.toggleEquip({inventaire:[],weapons:[]},o('e'))));
 a.weapons=[];t.toggleEquip(a,o('e'));t.retirerInventaire(a,o('e'));t.retirerInventaire(a,o('e'));assert.equal(JSON.stringify(a.weapons),JSON.stringify([]));assert.ok(!a.inventaire.includes('e'));   // Retirer le dernier exemplaire le repose.
 const b={weapons:['h'],armures:['ar'],shieldId:'',inventaire:[]};t.completerInventaire(b);assert.equal(JSON.stringify(b.inventaire),JSON.stringify(['h','ar']));}
assert.ok(src.includes("a.inventaire=Array.isArray(a.inventaire)?a.inventaire.filter(x=>typeof x==='string'&&x):[];completerInventaire(a);")&&src.includes("inventaire:[...(a.inventaire||[])]}}")&&src.includes("inventaire:[...(m.inventaire||[])]});completerInventaire(a);")
 &&src.includes('function toggleEquip(a,o)')&&src.includes('function dessineInventaire()')&&src.includes("sel('Ajouter à l’inventaire','inv_ajout','',inventaireOptions())")&&!src.includes('function refreshGearOptions')&&!src.includes("'weapon1'")
 &&src.includes("rangees(equipement,'');")&&src.includes("rangees(objets,'Objets');")&&src.includes("const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);")
 &&JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"')).includes('inventaire')
 &&fs.readFileSync('shared.js','utf8').includes("'pool','weapons','armures','shieldId','auraPv'];")&&page.includes("const nbGear=(a.weapons||[]).length+armuresDe(a).length+(a.shieldId?1:0)+(a.inventaire||[])")
 &&feuille.includes('.cat-pill.gear-carre .pips{gap:2px;justify-content:center;flex-wrap:nowrap}')&&feuille.includes('.cat-pill.gear-carre.dispo{opacity:.55}')&&feuille.includes('.gear-rangee-titre{flex-basis:100%;')
 &&feuille.includes('.best-attaque{background:#cfdcea;border:1px solid #00000026;border-left:4px solid #4f7fb5;border-radius:9px;'),'inventaire, équipement et attaques spéciales');
/* Fiche d'un modèle : plus de cartouche « Adversaire », le type porte sa couleur comme tout le bloc,
   pas de rubrique Équipement quand il n'y a rien, ni Notes, ni pose depuis la fiche. */
assert.ok(src.includes("const vraieFamille=f=>!!f&&f!=='Adversaire';")&&src.includes("famille.hidden=!vraieFamille(m.family);")
 &&src.includes("{className:'chip chip-type k-'+(m.type||'standard'),textContent:TYPE_NOMS[m.type]||'Standard'}")
 &&src.includes("detail.className='cat-detail k-'+(m.type||'standard');")&&src.includes('const aDuKit=!!((m.inventaire||[]).length')&&src.includes("if(!aDuKit){titreKit.hidden=true;kit.hidden=true}")
 &&src.includes('f.append(tete,chiffres,titreAtt,listeAtt,titreKit,kit,titreTal,tal);')&&!src.includes("titreNotes")&&!src.includes('best-notes')&&!src.includes("pose-nombre")&&!src.includes('Ajouter à la carte')
 &&feuille.includes('.cat-detail.k-solitaire,.chip.chip-type.k-solitaire{background:#e8d3cb}')&&feuille.includes('.chip.chip-type{color:var(--ink);border-color:#00000026}'),'la fiche d’un modèle est sobre et teintée');
/* En jeu, la fiche ne montre que le porté et les objets ; la coche est un rond à cheval sur l'angle ;
   plus de chevron ni de titre « Équipement » en double ; un objet se lit et s'utilise ; le MJ équipe
   aussi un modèle du bestiaire, et un refus dit combien de mains manquent. */
assert.ok(src.includes('function gearPills(a,tout=true)')&&page.includes('gearPills(a,false)')&&src.includes("const armurerie=tous.filter(([o])=>o.category==='weapon'||o.category==='armor');")&&src.includes("const equipement=armurerie.filter(([o])=>tout||portes(o));")
 &&src.includes("rangees(equipement,'');")&&src.includes("rangees(objets,'Objets');")&&!src.includes("chev.title='Détail'")&&!src.includes("p.querySelector('.chev').onclick=deplie;")
 &&src.includes('function utiliserObjet(a,o)')&&src.includes("b.className='gear-utiliser'")&&src.includes("const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);")
 &&feuille.includes('.cat-pill.gear-carre .marque-porte{display:none;position:absolute;top:-6px;left:-6px;')&&feuille.includes('.gear-detail.k-object.consommable{background:#d9e7cd;')
 &&page.includes("const nbGear=(a.weapons||[]).length+armuresDe(a).length+(a.shieldId?1:0)+(a.inventaire||[])")
 &&!src.includes('inventairesOuverts')&&!src.includes('gear-sac')&&!feuille.includes('gear-sac'),'fiche en jeu : porté et objets, coche ronde, objet utilisable');
/* Les mains se remplacent au lieu de refuser ; en jeu, pas de sac à déplier, le clic ouvre la
   description, et un objet se vise avant de s'employer, à la table de jeu seulement. */
assert.ok(src.includes('function libereMains(a,besoin)')&&src.includes('else{libereMains(a,weaponHands(o));a.weapons=[...(a.weapons||[]),o.id]}}')&&src.includes('else{libereMains(a,1);a.shieldId=o.id}}')
 &&src.includes('function gearDetail(o,a,enJeu)')&&src.includes("if(a&&enJeu&&(col==='object'||code)){const b=document.createElement('button')")&&src.includes('function appliquerObjet(a,o,vise,q)')
 &&src.includes("viserCible('◈ '+o.name+' — clique le combattant ou l’endroit visé',")&&src.includes("const equipable=(o.category==='weapon'||o.category==='armor')&&tout&&peutEquiper;")
 &&src.includes('toggleEquip(a,o);ouvrir();')&&page.includes('function viserCible(annonce,fn,refus)')&&page.includes("viserCible('✦ Clique sur la carte pour poser '+m.name,"),'mains remplacées, objet visé, description à l’équipement');
{const t={mainsPrises:null},src2=src.slice(src.indexOf('function libereMains(a,besoin)'),src.indexOf('/* Équiper depuis l’inventaire'));
 assert.ok(src2.includes('while(mainsPrises(a)+besoin>2)')&&src2.includes('if(a.weapons.length)a.weapons.shift();')&&src2.includes("else if(a.shieldId)a.shieldId='';"),'les mains se libèrent du plus ancien');}
/* Une seule description ouverte à la fois, celle du dernier carré cliqué, et plus de liseré brun
   autour du carré ouvert : rien ne laisse croire qu'il est encore porté. */
assert.ok(src.includes('let gearOuvert=null;')&&!src.includes('gearOuverts')&&src.includes('const cle=cleGear(a,o),ouvert=gearOuvert===cle;detail.hidden=!ouvert||BULLES;')
 &&src.includes('const basculer=()=>{gearOuvert=ouvert?null:cle;if(BULLES&&ouvert)fermerBulle();redessine()};')&&!feuille.includes('.cat-pill.gear-carre.ouvert'),'une seule description, sans liseré');
/* Les arbres de talents : le rouage remplace le « + » des talents d'une fiche, la popup dessine
   la classe, ses maîtrises acquises d'office, puis une colonne par spécialisation — trois au plus
   — lue de haut en bas, et les génériques à part. La voie d'un talent se choisit au formulaire. */
assert.ok(src.includes("function sousTitre(texte,titre,fn,glyphe='+')")&&src.includes("mien?()=>openArbres(a):null,'⚙');")
 &&!src.includes("openPicker(a,'talents')")&&src.includes("const arbresDialog=dialog('arbres','Arbres de talents','<p class=\"muted\" id=\"arbres-note\"></p><div id=\"arbres-corps\"></div>');")
 &&src.includes('function openArbres(a){a=acteurCourant(a);if(!peutVoirArbres(a))return;arbresActeur=a;arbresClasse=null;')&&src.includes("const classe=classeDuHeros(a),toutes=talentFamilies();")
 &&src.includes("if(view==='mj'){let acquis=false;troupe.forEach(a=>{if(assureMaitrises(a))acquis=true});if(acquis)scheduleSave()}")
 &&src.includes("t.voie=typeof t.voie==='string'?t.voie.trim().slice(0,60):'';")&&src.includes("+sel('Spécialisation','voie',t.voie||'',optionsVoie(famille,t.voie||''))")
 &&src.includes("if(voie&&!connues.includes(voie)&&connues.length>=VOIES_MAX){alert(")&&src.includes('t.voie=voie;if(voie)enregistreVoie(t.famille,voie);')&&!src.includes("v.className='tag voie';v.textContent=t.voie;")
 &&src.includes("const verrou=!a||acquis?'':(libre?'':verrouEtages(a.talents,etages,t))||manqueTalent(a.talents,t,catalog.talents);")
 &&src.includes("n.title=t.name+' — Maîtrise de classe, acquise avec la classe.';")
 &&feuille.includes('#arbres{width:min(1180px,96vw)}')&&feuille.includes('.arbre-noeud::before{content:\'\';display:block;width:3px;height:18px;')&&feuille.includes('.arbre-noeud.premier::before,.arbre-maitrises .arbre-noeud::before{display:none}')
 &&feuille.includes('.arbre-titre{width:100%;')&&feuille.includes('clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),50% 100%,0 calc(100% - 8px))}')
 &&feuille.includes('.arbre-noeud.acquis .arbre-rond::after{content:\'✓\';')&&feuille.includes('.arbre-noeud.verrou{opacity:.45;cursor:not-allowed}')
 &&feuille.includes('.hero-sous .ico.plus.rouage{')&&feuille.includes('.cat-pill .tag.voie{'),'arbres de talents : rouage, popup, voie au formulaire');
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const ctx={catalog:{classes:[{name:'Gardien',tint:'#3f7bc0'}],talents:[
   {id:'m',name:'Maîtrise du bouclier',famille:'Gardien',type:'mait',level:1,voie:''},
   {id:'b',name:'Rempart de fer',famille:'Gardien',type:'ame',level:3,voie:'Rempart',prerequis:'a'},
   {id:'a',name:'Rempart',famille:'Gardien',type:'act',level:1,voie:'Rempart'},
   {id:'c',name:'Charge',famille:'Gardien',type:'act',level:2,voie:'Assaut'},
   {id:'d',name:'Souffle',famille:'Gardien',type:'pass',level:1,voie:''},
   {id:'e',name:'Serment',famille:'Gardien',type:'pass',level:2,voie:'Serment'},
   {id:'f',name:'Foi',famille:'Gardien',type:'pass',level:2,voie:'Quatrième'},
   {id:'g',name:'Vigilance',famille:'',type:'pass',level:1,voie:''}]},
  cleClasse:C.cleClasse,ordonneTalents:C.ordonneTalents,talentCode:C.talentCode,manqueTalent:C.manqueTalent,talentsDependants:C.talentsDependants,VOIES_MAX:3};
 vm.createContext(ctx);
 vm.runInContext(morceau('const TALENT_TYPES=','function talent(id)')+morceau('function talentFamilies()',"// L'encre d'une classe")
  +morceau('function descendDe(','function openTalent(')+morceau('const AUTRE_VOIE=','const arbresDialog='),ctx);
 // Trois voies au plus, dans l'ordre du catalogue ; la quatrième n'existe pas pour l'arbre.
 // Trois rangs, toujours : nommés, ou vides en attendant qu'on les baptise.
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['Rempart','Assaut','Serment']));
 assert.equal(JSON.stringify(ctx.voiesDe('Mystique')),JSON.stringify(['','','']));
 assert.equal(JSON.stringify(ctx.voiesNommees('Mystique')),'[]');
 assert.equal(ctx.rangDAccueil('Mystique'),0,'sans nom, le premier rang accueille les sans-voie');
 assert.equal(ctx.rangDAccueil('Gardien'),0,'tous nommés : les orphelins reviennent au premier');
 assert.equal(JSON.stringify(ctx.optionsVoie('Gardien','')),JSON.stringify([['','— tronc commun —'],['Rempart','Rempart'],['Assaut','Assaut'],['Serment','Serment']]),'plus de place : pas de nouvelle voie');
 assert.equal(ctx.optionsVoie('Mystique','').length,2,'le tronc commun et une nouvelle voie');
 // Une Gardienne trouve la colonne Gardien ; sans classe, pas de colonne.
 assert.equal(ctx.classeDuHeros({role:'Gardienne · niveau 2'}),'Gardien');
 assert.equal(ctx.classeDuHeros({role:'Gardien'}),'Gardien');
 assert.equal(ctx.classeDuHeros({role:''}),null);
 assert.equal(ctx.classeDuHeros({role:'Barde'}),null);
 // La maîtrise vient avec la classe, une seule fois.
 const h={hero:true,role:'Gardien',talents:['a']};
 assert.equal(ctx.maitrisesDe('Gardien').map(t=>t.id).join(),'m');
 assert.equal(ctx.assureMaitrises(h),true);assert.equal(JSON.stringify(h.talents),JSON.stringify(['a','m']));
 assert.equal(ctx.assureMaitrises(h),false);
 assert.equal(ctx.assureMaitrises({hero:false,role:'Gardien',talents:[]}),false,'un adversaire ne reçoit rien');
 // Les colonnes : une par voie, l'amélioration suspendue sous son prérequis, le tronc commun en
 // dernier, sans la maîtrise ni la voie de trop ; l'ordre est celui du catalogue.
 const cols=ctx.colonnesArbre('Gardien');
 assert.equal(cols.length,3,'trois colonnes, ni plus ni moins');
 assert.equal(JSON.stringify(cols.map(c=>c.titre)),JSON.stringify(['Rempart','Assaut','Serment']));
 // Toutes les voies sont nommées : les talents sans voie reviennent au premier rang.
 assert.equal(JSON.stringify(cols.map(c=>c.liste.map(t=>t.id))),JSON.stringify([['a','b','d','f'],['c'],['e']]));
 assert.equal(JSON.stringify(cols[0].racines.map(t=>t.id)),JSON.stringify(['a','d','f']),'b pend sous a ; les sans-voie sont des racines à part');
 assert.equal(cols[0].arbre[0].enfants[0].t.id,'b');
 assert.equal(cols[0].famille,'Gardien');assert.equal(cols[0].rang,0);assert.equal(cols[2].rang,2);
 {const vides=ctx.colonnesArbre('Mystique');
  assert.equal(vides.length,3,'une classe sans voie a quand même ses trois colonnes');
  assert.equal(JSON.stringify(vides.map(c=>c.titre)),JSON.stringify(['Tronc commun','Spécialisation 2','Spécialisation 3']));}
 // De haut en bas : la seconde racine attend la première ; un talent suspendu attend son prérequis, pas la chaîne.
 {const troncs=[{id:'d',name:'Souffle'},{id:'f',name:'Foi'}];
  assert.equal(ctx.verrouColonne([],troncs,troncs[1]),'Souffle');
  assert.equal(ctx.verrouColonne(['d'],troncs,troncs[1]),'');
  assert.equal(ctx.verrouColonne([],troncs,troncs[0]),'','la première est toujours libre');}
 assert.equal(ctx.verrouColonne([],cols[0].racines,cols[0].liste[1]),'','b n’est pas une racine');
 assert.equal(C.manqueTalent([],cols[0].liste[1],ctx.catalog.talents),'Rempart','c’est le prérequis qui verrouille b');
 // Chargé, le catalogue nomme les voies que ses talents portaient : ici, on le fait à la main.
 ctx.catalog.voies={Gardien:ctx.voiesDe('Gardien')};
 // Placer un talent : sous un autre, avant un frère, en dernier ; jamais sous ce qui repose sur lui.
 assert.equal(ctx.placerTalent('c',{famille:'Gardien',voie:'Rempart',prerequis:'b'}),true);
 {const c=ctx.catalog.talents.find(t=>t.id==='c');assert.equal(c.voie+'|'+c.prerequis,'Rempart|b');assert.equal(ctx.catalog.talents.at(-1).id,'c','en dernier');}
 assert.equal(JSON.stringify(ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id)),JSON.stringify(['a','b','c','d','f']),'c a rejoint Rempart, les sans-voie restent hébergés');
 assert.equal(ctx.placerTalent('a',{famille:'Gardien',voie:'Rempart',prerequis:'c'}),false,'c repose sur a : refusé');
 assert.equal(ctx.placerTalent('a',{famille:'Gardien',voie:'Rempart',prerequis:'a'}),false,'pas sous lui-même');
 assert.equal(ctx.placerTalent('f',{famille:'Gardien',voie:'',avant:'d'}),true);
 {const prem=ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id);
  ['a','b','c','f','d'].forEach(id=>assert.ok(prem.includes(id),'le premier rang tient '+id+' : les sans-voie ne se perdent pas'));
  assert.ok(prem.indexOf('f')<prem.indexOf('d'),'f passe avant d');}
 assert.equal(ctx.placerTalent('d',{famille:'',voie:''}),true);
 assert.equal(ctx.catalog.talents.find(t=>t.id==='d').famille,'Génériques','sans classe, un générique');
 assert.equal(ctx.placerTalent('zzz',{famille:'Gardien'}),false);
 // Les voies nommées : trois par classe, renommées sur leurs talents, dissoutes vers le tronc.
 assert.equal(ctx.enregistreVoie('Mystique','Feu'),true);assert.equal(ctx.enregistreVoie('Mystique','Feu'),true,'déjà là : rien à redire');
 assert.equal(ctx.enregistreVoie('Mystique','Givre'),true);assert.equal(ctx.enregistreVoie('Mystique','Onde'),true);
 assert.equal(ctx.enregistreVoie('Mystique','Foudre'),false,'quatrième refusée');
 assert.equal(JSON.stringify(ctx.voiesDe('Mystique')),JSON.stringify(['Feu','Givre','Onde']));
 assert.equal(ctx.enregistreVoie('Mystique','  '),false);
 // Baptiser un rang, le renommer, lui reprendre son nom : ses talents suivent à chaque fois.
 assert.equal(ctx.renommerVoie('Gardien','Rempart','Mur'),true);
 assert.equal(ctx.catalog.talents.find(t=>t.id==='a').voie,'Mur');
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['Mur','Assaut','Serment']));
 assert.equal(ctx.renommerVoie('Gardien','Mur','Assaut'),false,'un nom déjà pris');
 assert.equal(ctx.nommerVoie('Gardien',0,'Mur'),false,'le même nom ne change rien');
 assert.equal(ctx.dissoudreVoie('Gardien','Mur'),true);
 assert.equal(ctx.catalog.talents.find(t=>t.id==='a').voie,'','ses talents rejoignent le tronc commun');
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['','Assaut','Serment']),'le rang reste, sans nom');
 assert.equal(ctx.colonnesArbre('Gardien').length,3);
 assert.equal(ctx.colonnesArbre('Gardien')[0].titre,'Tronc commun');
 // Nommer le rang qui héberge les sans-voie les emmène avec lui : rien ne disparaît de l'arbre.
 {const avant=ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id);
  assert.ok(avant.includes('a'),'le tronc commun tient les sans-voie');
  assert.equal(ctx.nommerVoie('Gardien',0,'Protection'),true);
  assert.equal(ctx.catalog.talents.find(t=>t.id==='a').voie,'Protection');
  assert.equal(JSON.stringify(ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id)),JSON.stringify(avant));}
 assert.equal(ctx.nommerVoie('Gardien',7,'Ailleurs'),false,'il n’y a que trois rangs');
 // Une forêt sans racine — un cycle — sort quand même.
 assert.equal(ctx.foretArbre([{id:'p',prerequis:'q'},{id:'q',prerequis:'p'}]).length,1);}
/* L'arbre s'édite en place : les voies vivent au catalogue, un talent créé depuis l'arbre arrive
   déjà rangé, le formulaire refermé redessine l'arbre, et le glisser-déposer place les talents. */
assert.ok(src.includes("const voies=c.voies&&typeof c.voies==='object'&&!Array.isArray(c.voies)?c.voies:{};")&&src.includes('const VOIES_MAX=3;')
 &&src.includes("if(!l.includes(t.voie)&&l.length<VOIES_MAX)c.voies[f]=[...l,t.voie]});")&&src.includes('function descendDe(x,t,vus=new Set()){if(!x||!t||vus.has(t.id))return false;vus.add(t.id);')
 &&src.includes('function openTalent(i=null,apres=null,defauts=null)')&&src.includes(",...(defauts||{})}:catalog.talents[i];")
 &&src.includes("if(typeof arbresDialog!=='undefined'&&arbresDialog.open)renderArbres()});")&&src.includes('function placerTalent(id,dest)')
 &&src.includes("if(!p||p===t||descendDe(p,t))return false}")&&src.includes("el.addEventListener('dragstart',e=>{arbreGlisse=t.id;el.classList.add('tire');corps.classList.add('glisse');")
 &&src.includes("if(!id)return;if(placerTalent(id,dest))arbreChange();else note(")&&src.includes("glissable(el,t);cible(el,{famille:col.famille,voie:col.voie,prerequis:t.id});")
 &&src.includes("if(mj)pile.append(entre({famille:c.famille,voie:c.voie,avant:e.t.id}));")
 &&src.includes("cible(h,{famille:c.famille,voie:c.voie});")&&src.includes("champVif(nomVoie,()=>c.voie,v=>{if(nommerVoie(c.famille,c.rang,v))arbreChange();")&&src.includes("nomVoie.classList.toggle('vierge',!c.voie);")&&feuille.includes('.arbre-titre .arbre-voie.vierge{')&&src.includes("if(nommerVoie(c.famille,c.rang,''))arbreChange()});")
 &&src.includes("plus.onclick=()=>openTalent(null,renderArbres,{famille:c.famille,voie:c.voie});col.append(plus)}")
 &&src.includes("{famille:talentFamily(t),voie:t.voie||'',prerequis:t.id,level:Math.min(20,(t.level||1)+1)})));")
 &&src.includes("plus.onclick=()=>openTalent(null,renderArbres,{famille:classe,type:'mait',name:'Maîtrise'});tete.append(plus)}}")
 /* Trois colonnes, toujours : plus de colonne « + Spécialisation », et les génériques ont leur
    propre arbre au lieu d'encombrer celui d'une classe. */
 &&!src.includes('+ Spécialisation')&&!src.includes('arbre-col nouvelle')
 &&src.includes(" (classe?colonnesArbre(classe):[]).forEach(c=>grille.append(colonne(c,classe===GENERIQUES)));")
 &&!src.includes("grille.append(colonne(colonneArbre(GENERIQUES,GENERIQUES,")
 &&src.includes("const oublier=(t,racines)=>{")&&src.includes("const chute=racines.includes(t)?racines.slice(racines.indexOf(t)):[t];")
 &&feuille.includes('.glisse .arbre-entre{height:12px;margin:3px 0;border:1px dashed var(--line-strong)}')&&feuille.includes('.arbre-enfants{display:flex;justify-content:center;align-items:flex-start;width:100%}')
 &&feuille.includes('.arbre-noeud:hover .arbre-outils,.arbre-noeud:focus-within .arbre-outils{display:flex}')&&feuille.includes('.arbre-col.nouvelle{border-style:dashed;'),'l’arbre s’édite en place');

/* Deux effets de plus : Attaque État — le porteur attaque et, selon l'issue, gagne un état — et
   Provocation — un adversaire en vue s'avance au contact, puis le coup part. attack() accepte
   une cible imposée et un rappel après les dégâts, pour que les talents bâtissent dessus. */
{const ae=C.TALENTS_CODES.attaqueetat,pv=C.TALENTS_CODES.provocation;
 assert.ok(ae&&ae.type==='act'&&ae.params.map(p=>p.cle).join()==='condition,etat'&&!ae.monstre,'Attaque État déclaré');
 assert.ok(pv&&pv.type==='act'&&pv.params.length===0&&!pv.monstre&&pv.bouton==='📣 Provocation','Provocation déclarée');
 const d=C.paramsTalent({effet:'attaqueetat',params:{}});assert.equal(d.condition,'tue');assert.equal(d.etat,'');
 assert.ok(C.phraseTalent('attaqueetat',{condition:'survit',etat:'Feu'}).includes('Si <b>la cible n’est pas tuée</b>, il gagne <b>Feu</b>.'));
 assert.ok(C.phraseTalent('attaqueetat',{condition:'tue',etat:'Blindage'}).includes('S’il <b>tue la cible</b>, il gagne <b>Blindage</b>.'));
 assert.ok(C.phraseTalent('provocation',{}).includes('<b>en ligne de vue</b>')&&C.phraseTalent('provocation',{}).includes('<b>une attaque</b> contre lui.'));
 assert.equal(C.cleTalent('Attaque État'),'attaqueetat','un talent nommé ainsi trouve son effet');}
/* Le mouvement forcé d'une Provocation coûte comme un autre : ce que le provoqué quitte le
   frappe, y compris les zones traversées en chemin, et tombé en route il n'y a plus de coup. */
assert.ok(page.includes('const croises=new Set(contactsDe(b)),depart={x:b.x,y:b.y};')
 &&page.includes('if(venu)ramasseContacts(b,croises,depart,mapSize(),walls());')
 &&page.includes('if(venu)degatsOpportunite(b,[...croises]);')
 &&page.includes("if(!alive(b)){log(b.name+' tombe en chemin : le coup ne part pas.',{ton:'degats'});")
 &&page.includes("if(pointsRestants(a,'action')>0){depensePoint(a,'action');afterAction(a)}"),'la Provocation paie ses dégâts d’opportunité');
assert.ok(page.includes('function attack(opts={})')&&page.includes('if(opts.vises){vises=ciblesAtteignables(a,opts.vises,portee);')
 &&page.includes("depensePoint(a,'action');afterAction(a);render();return}}")&&page.includes('const vivants=vises.filter(j=>alive(actors[j]));')
 &&page.includes('if(opts.apres)opts.apres({vises,partis,tues:vivants.filter(j=>!alive(actors[j]))});')
 &&page.includes('function attaqueEtat(a,p,talent)')&&page.includes("const survit=p.condition==='survit',gagne=survit?tues.length<vises.length:tues.length>0;")
 &&page.includes('const issue=infligeEtat(a,p.etat);')&&page.includes('function cibleProvocation(a)')&&page.includes('function rapprocher(b,a)')
 &&page.includes('const arret=Math.max(tokenOf(a)/2+tokenOf(b)/2,contactRadius(tokenOf(a))+tokenOf(b)/2-3);')&&page.includes('if(d<=arret)return false;')
 &&page.includes("if(el){el.classList.add('glisse');el.style.left=b.x+'%';el.style.top=b.y+'%'}")&&page.includes('function provocation(a,p,talent)')
 &&page.includes("poseCibles(a,[j]);if(venu)afterMove(b);")&&page.includes("attack({vises:[j]});scheduleSave()},venu?220:0);")
 &&page.includes('attaqueetat:{fn:attaqueEtat,')&&page.includes('provocation:{fn:provocation,')&&page.includes("peut:a=>!hasState(a,'Au sol')&&cibleProvocation(a)!==null,"),'Attaque État et Provocation câblés à la table');
/* Un talent nommé comme sa mécanique la reçoit, que son nom en donne la clé ou l'intitulé :
   « Orbes de feu » et « Orbes mystiques » restaient descriptifs, donc muets — les orbes
   n'infligeaient pas Feu. */
assert.equal(C.effetParNom('Double Attaque'),'doubleattaque');
assert.equal(C.effetParNom('Orbes de feu'),'orbesfeu');
assert.equal(C.effetParNom('ORBES DE FEU'),'orbesfeu');
assert.equal(C.effetParNom('Orbes mystiques'),'orbes');
assert.equal(C.effetParNom('Orbes'),'orbes','la clé elle-même vaut toujours');
assert.equal(C.effetParNom('Garde rapprochée'),'garderapprochee');
assert.equal(C.effetParNom('Attaque État'),'attaqueetat');
assert.equal(C.effetParNom('Souffle du dragon'),'','un nom libre reste descriptif');
assert.equal(C.effetParNom(''),'');
// Un orbe de feu porté par un talent câblé inflige bien son état, et son vol flambe.
assert.equal(C.etatDesOrbes([{code:C.TALENTS_CODES.orbesfeu,params:{etat:'Feu'}}]),'Feu');
assert.ok(page.includes('function volOrbe(de,vers,couleur,etat)')&&page.includes("const el=document.createElement('span');el.className='orbe-vol'+(etat==='Feu'?' feu':'');")
 &&page.includes("el.style.setProperty('--orbe',TEINTE_ORBE[etat]||'#9b7ad4');")&&page.includes("const TEINTE_ORBE={Feu:'#ff6a2c',")
 &&page.includes('const duree=volOrbe(a,b,des.couleur,etat);')&&page.includes("diffuserEffet('orbe',a,b,des.couleur+(etat?'|'+etat:''));")
 &&vivant.includes("const [couleur,etat]=(typeof rec.logo==='string'?rec.logo:'').split('|');")
 &&page.includes('.orbe-vol.feu::after{content:')&&page.includes('@keyframes flamme{'),'l’orbe porte son état, et le feu flambe');
/* La description d'un équipement s'ouvre sur la fiche où l'on a cliqué, et nulle part ailleurs :
   deux aventuriers portant la même hache ne s'ouvrent plus l'un l'autre. */
assert.ok(src.includes("const cleGear=(a,o)=>(a&&a.id||'?')+'|'+(o&&o.id||'?');")&&src.includes("const cle=cleGear(a,o),ouvert=gearOuvert===cle;detail.hidden=!ouvert||BULLES;")
 &&src.includes("const ouvrir=()=>{gearOuvert=cle;talentOuvert=null};")&&cartes.includes("if(typeof fermerBulle==='function')fermerBulle();")&&src.includes("const basculer=()=>{gearOuvert=ouvert?null:cle;if(BULLES&&ouvert)fermerBulle();redessine()};")
 &&!src.includes('gearOuvert===o.id'),'une description par fiche, pas par objet');
/* Un talent appris dont le socle manque ne fait rien : la fiche le dit, au lieu de le taire. */
assert.ok(src.includes("const sansEffet=t=>typeof manqueTalent==='function'?manqueTalent(a.talents||[],t,catalog.talents):'';")
 &&src.includes("if(manque){pill.classList.add('sans-effet');")&&src.includes("m.className='t-sans-effet';m.textContent='⚠';")
 &&src.includes("dit.textContent='⚠ Sans effet : requiert « '+manque+' », que '+a.name+' n’a pas appris.';detail.prepend(dit)}")
 &&feuille.includes('.cat-pill.sans-effet{filter:saturate(.4)}')&&feuille.includes('.talent-detail .sans-effet-dit{font-weight:700;color:#b03828}'),'un talent sans effet le dit');
/* Le joueur ouvre les arbres de son aventurier, sans les outils du MJ ; les « + » du MJ ne
   paraissent plus chez lui, et son choix de talents part à la table avec sa fiche. */
/* Les fiches se remplacent en bloc quand la scène publiée ou la table arrive : le rouage
   d'une page dessinée avant tenait l'ancienne, et restait muet chez un joueur. La fiche se
   retrouve par son identifiant. */
assert.ok(src.includes('function acteurCourant(a){if(!a||actors.includes(a))return a;return actors.find(x=>x&&x.id===a.id)||a}')
 &&src.includes('function peutVoirArbres(a){a=acteurCourant(a);return !!a&&(view===\'mj\'||(a.hero&&actors.indexOf(a)===owner))}')
 &&src.includes(' if(arbresActeur)arbresActeur=acteurCourant(arbresActeur);')
 &&fs.readFileSync('shared.js','utf8').includes("if(typeof renderCatalogPages==='function')renderCatalogPages()}")
 &&src.includes('function openArbres(a){a=acteurCourant(a);if(!peutVoirArbres(a))return;arbresActeur=a;arbresClasse=null;')
 &&src.includes("if(a){a.talents??=[];if(!peutVoirArbres(a)){arbresDialog.close();return}")
 &&src.includes("const mien=view==='mj'||actors.indexOf(a)===owner;")
 &&src.includes("const titreTal=sousTitre('Talents','Arbres de talents de '+a.name,mien?()=>openArbres(a):null,'⚙');")
 &&src.includes("const titreKit=sousTitre('Équipement','Inventaire de '+a.name,view!=='mj'?null:()=>openPicker(a,'gear'));")
 &&src.includes("function sousTitre(texte,titre,fn,glyphe='+'){")&&src.includes(' if(!fn)return h;')
 &&vivant.includes("'inventaire','talents','states'"),'le joueur choisit ses talents dans l’arbre');
/* Le bestiaire gouverne la table sur-le-champ : les créatures en scène et la copie des cartes. */
assert.ok(src.includes('function suitLeModele(a,m)')&&src.includes('function syncCartes(m)')
 &&src.includes('function syncFromTemplate(m){let touches=0;syncCartes(m);')&&src.includes('if(!suitLeModele(a,m))return;a.template=m.id;')
 &&src.includes("if(!f||!f.tpl||f.tpl.id!==m.id)return;f.tpl=structuredClone(m);touches++}));"),'le modèle corrigé descend jusqu’aux cartes');
/* Plus de « Personne à portée de contact. » sous les Actions, ni de cartouche « Prototype » :
   l'en-tête porte le nom du jeu et ONLINE dessous, en brun clair. */
assert.ok(!page.includes('Personne à portée de contact.')&&!page.includes("'Hors de combat.'")&&page.includes(' if(!rangs.length)return;')
 &&!page.includes('Prototype · partie locale')&&!page.includes('class="badge"')
 &&page.includes('<span class="brand-nom">Amertüme</span>')&&page.includes('<span class="brand-online">ONLINE</span>')
 &&page.includes('.brand-online{font:600 13px system-ui;letter-spacing:7px;color:var(--accent)}'),'en-tête sur deux lignes, sans cartouche');
/* Les socles occupent la place : on ne finit jamais à cheval sur un vivant, le camp d'en face
   barre le passage, les alliés se laissent traverser, et un corps à terre ne tient plus rien. */
{const cercle=(x,y,r)=>({x,y,r});
 // Écarter : juste assez pour que les deux se touchent, dans l'axe des centres.
 assert.equal(JSON.stringify(C.ecarteDesSocles([10,0],[cercle(0,0,10)],10)),JSON.stringify([20,0]));
 assert.equal(JSON.stringify(C.ecarteDesSocles([30,0],[cercle(0,0,10)],10)),JSON.stringify([30,0]),'assez loin : rien ne bouge');
 assert.equal(JSON.stringify(C.ecarteDesSocles([20,0],[cercle(0,0,10)],10)),JSON.stringify([20,0]),'pile au contact : rien ne bouge');
 // Deux centres confondus : on part vers la droite, faute de direction.
 assert.equal(JSON.stringify(C.ecarteDesSocles([0,0],[cercle(0,0,8)],12)),JSON.stringify([20,0]));
 // Sortir de l'un sans entrer dans l'autre : les passes s'enchaînent.
 {const [x,y]=C.ecarteDesSocles([0,0],[cercle(-6,0,10),cercle(6,0,10)],10);
  assert.ok(Math.hypot(x+6,y)>=19.99&&Math.hypot(x-6,y)>=19.99,'écarté des deux à la fois');}
 // Un socle vide ou nul ne fait rien planter.
 assert.equal(JSON.stringify(C.ecarteDesSocles([5,5],[null],10)),JSON.stringify([5,5]));
 assert.equal(JSON.stringify(C.ecarteDesSocles([5,5],null,10)),JSON.stringify([5,5]));
 // Tomber sur un socle : dès que les deux se couvriraient, la marge du bord exceptée.
 assert.equal(C.dansUnSocle([15,0],[cercle(0,0,10)],10),true);
 assert.equal(C.dansUnSocle([20,0],[cercle(0,0,10)],10),false,'pile au contact : on touche sans couvrir');
 assert.equal(C.dansUnSocle([25,0],[cercle(0,0,10)],10),false);
 assert.equal(C.dansUnSocle([0,0],[],10),false);
 assert.equal(C.dansUnSocle([0,0],[null],10),false);
 // Traverser : le segment passe sous les deux rayons réunis.
 assert.equal(C.segmentCoupeSocles([-50,0],[50,0],[cercle(0,0,10)],10),true);
 assert.equal(C.segmentCoupeSocles([-50,40],[50,40],[cercle(0,0,10)],10),false,'on passe à côté');
 assert.equal(C.segmentCoupeSocles([-50,0],[50,0],[],10),false);
 // Longer un socle sans s'y coller : le pas qui part du bord ne se bloque pas lui-même.
 assert.equal(C.segmentCoupeSocles([20,0],[20,30],[cercle(0,0,10)],10),false);
 // Poser hors des socles ET hors des murs : le mur l'emporte quand les deux se disputent.
 {const mur=[{contours:[[[100,-100],[200,-100],[200,100],[100,100]]]}];
  const [x,y]=C.poserHorsDesSocles([85,0],[],mur,10);   // sans socle : juste hors du mur
  assert.ok(x<=90.01&&Math.abs(y)<1e-6,'le mur repousse');
  const [x2,y2]=C.poserHorsDesSocles([85,0],[cercle(70,0,10)],mur,10);
  assert.ok(Math.hypot(x2-70,y2)>=19.9||x2<=90.01,'écarté du socle, jamais dans le mur');}}
/* La table applique la règle : le camp d'en face barre le pas, l'allié se laisse traverser mais
   pas couvrir, un corps à terre ne tient plus la place, et un lot pris ensemble ne se repousse pas. */
assert.ok(page.includes('function soclesOccupes(a,size,ignorer,adverses)')
 &&page.includes('return actors.filter(o=>o!==a&&alive(o)&&!(ignorer&&ignorer.has(o.id))')&&page.includes("&&(!adverses||o.hero!==a.hero))")
 &&page.includes('function settleActor(a,ignorer)')&&page.includes(' const [x,y]=alive(a)\n  ?poserHorsDesSocles(px(a.x,a.y),soclesOccupes(a,size,ignorer,false),polys,r)\n  :slideOutOfWalls(px(a.x,a.y),polys,r);')
 &&page.includes('function moveActor(a,xp,yp,libre,ignorer)')
 &&page.includes(' const barrent=(alive(a)?soclesOccupes(a,size,ignorer,true):[])\n  .filter(c=>Math.hypot(start[0]-c.x,start[1]-c.y)>=r+c.r-.5);')&&page.includes('const tiennent=alive(a)?soclesOccupes(a,size,ignorer,false):[];')
 /* L'adversaire barre : on s'arrête devant lui, on ne glisse pas sur son flanc. Les murs,
    eux, se longent toujours — c'est ce qui assure le passage des portes. */
 &&!page.includes('ecarteDesSocles(suivant,barrent,r)')&&page.includes(' if(segmentHitsPolys(last,suivant,polys))break;')
 &&page.includes('if(barrent.length&&(dansUnSocle(suivant,barrent,r)||segmentCoupeSocles(last,suivant,barrent,r)))break;')
 &&page.includes('if(tiennent.length)last=poserHorsDesSocles(last,tiennent,polys,r);')
 &&page.includes("const enMain=new Set(lot.map(k=>actors[k]&&actors[k].id).filter(Boolean));")
 &&page.includes("moveActor(o,o.x+dx,o.y+dy,view==='mj',enMain)})}")&&page.includes("else moveActor(a,q.x,q.y,view==='mj',enMain);")
 &&page.includes("const [x,y]=ecarteDesSocles(px(a.x,a.y),soclesOccupes(a,size,ignorer,false),tokenOf(a)/2);"),'les socles tiennent la place sur la table');
/* La fiche en jeu : plus de barre sous les PV, l'équipement ouvert d'office et les talents
   repliés ; l'attaque d'équipement s'appelle « Attaque » ; un talent qui frappe porte les dés,
   le bonus et son jeton, comme une attaque ; l'Onde du camp lève les états comme le bouton Soin. */
assert.ok(page.includes('<span class="lifebar-text" id="hp"></span></div><div class="bloc-fixe" id="bloc-gear"><div class="bloc-tete"><span class="bloc-titre">Équipement</span><span class="compte" id="gear-compte"></span></div><div id="gear"></div></div>')
 &&!page.includes('<details class="bloc-replie" id="bloc-gear">')&&page.includes('<details class="bloc-replie" id="bloc-talents">')
 &&feuille.includes('.bloc-replie,.bloc-fixe{margin:6px 0}')&&feuille.includes(".bloc-replie .bloc-titre,.bloc-fixe .bloc-titre{font:700 15px 'Killam'")
 &&(page.match(/class="divider"/g)||[]).length===2,'fiche en jeu : équipement ouvert, pas de barre sous les PV');
assert.ok(src.includes("const libelle=at.gear?'Attaque':(at.name||'Attaque');")&&src.includes("nom.textContent=libelle;")
 &&src.includes('function desEtBonus(dice,bonus)')&&src.includes('b.append(nom,desEtBonus(at.dice,bonus));')
 &&src.includes('if(t.des)b.append(desEtBonus(t.des,t.bonus||0));')
 &&page.includes('des:eff.des?eff.des(a,params):code.attaque?activeAttack(a).dice:null,')
 &&page.includes("bonus:code.attaque&&!hasState(a,'Affaibli')&&activeAttack(a).useOwnDamage!==false?degatsDe(a):0,")
 &&C.TALENTS_CODES.attaqueetat.attaque===true&&C.TALENTS_CODES.provocation.attaque===true
 &&!C.TALENTS_CODES.orbes.attaque,'le bouton d’attaque dit « Attaque », le talent qui frappe montre ses dés');
/* L'Onde d'un camp lève les états avec les blessures, et prend aussi celui qui n'a rien perdu
   mais porte une affliction — empoisonné au complet, il restait sur le carreau. */
assert.ok(page.includes("const soignes=actors.filter(a=>!!a.hero===hero&&(a.hp<a.max||statesOf(a).length));")
 &&page.includes("soignes.forEach(a=>{if(a.hp<a.max)rendus++;a.hp=a.max;setState(a,'Coma',false);")&&page.includes("if(typeof reposer==='function')reposer(a,'long');else a.usages={};   // l'Onde vaut un repos long")
 &&page.includes("' remis d’aplomb'+(rendus?' : PV au complet':'')+(leves?(rendus?', ':' : ')+'états levés':'')+'.'")
 &&!page.includes('const blesses=actors.filter'),'l’Onde du camp lève les états, même sans blessure');
/* La jauge de PV est un fil, et le même pour tous les socles — l'actif n'y fait rien. */
assert.ok(page.includes('.token .pv{position:absolute;left:2%;right:2%;bottom:100%;margin-bottom:3px;height:3.2px;')
 &&!page.includes('.token.selected .pv'),'la jauge est fine et pareille pour tous');
/* L'arbre d'une classe s'ouvre depuis l'onglet Talents, par le rouage posé contre son nom :
   sans combattant, nul n'y porte rien, le clic sur un talent le corrige, et la Provocation
   ne pose plus de bandeau en travers de la carte. */
assert.ok(src.includes('let arbresActeur=null,arbresClasse=null,arbreGlisse=null,arbresVueJoueur=false;')
 &&src.includes("function openArbresClasse(famille){if(view!=='mj')return;arbresActeur=null;arbresClasse=famille||GENERIQUES;")
 &&src.includes("function renderArbres(){const corps=$('arbres-corps');if(!corps||(!arbresActeur&&!arbresClasse))return;corps.replaceChildren();")
 &&src.includes("const classe=a?classeDuHeros(a):arbresClasse;")&&src.includes("const porte=t=>!!a&&a.talents.includes(t.id);")
 &&src.includes("el.onclick=()=>{if(!a){if(mj)openTalent(catalog.talents.indexOf(t),renderArbres);return}")
 &&src.includes("const el=noeud(t,!a?'modele':acquis?'acquis':verrou?'verrou':'dispo',verrou);")
 &&src.includes("arbresDialog.addEventListener('close',()=>{if(arbresDialog.open)return;arbresActeur=null;arbresClasse=null;arbresVueJoueur=false});")
 &&src.includes("rouage.textContent='⚙';rouage.title='Arbre de talents — '+famille;")
 &&src.includes("rouage.onclick=e=>{e.stopPropagation();openArbresClasse(famille)};h.append(rouage);")
 /* Le nom de la classe ouvre le même arbre, un clic hors de la fenêtre la referme, et ni
    l'intitulé ni la notice d'édition ne paraissent sur l'arbre d'une classe. */
 &&src.includes("h.onclick=()=>openArbresClasse(famille)}")
 &&src.includes("arbresDialog.addEventListener('click',e=>{if(e.target===arbresDialog)arbresDialog.close()});")
 &&src.includes("titre.textContent='Arbres de talents — '+(a?a.name:classe);titre.hidden=!a;")&&src.includes("$('arbres-note').hidden=!a;")
 &&src.includes('const NOTE_ARBRES_CLASSE=')&&feuille.includes('.arbre-noeud.modele{cursor:pointer}')
 &&feuille.includes('.cat-col>h3 .ico.plus.rouage{')
 &&!page.includes("annonceFlottante('📣 '"),'l’arbre d’une classe s’ouvre depuis l’onglet Talents');
/* Trois mécaniques de plus : Ignition charge un allié désigné d'un orbe, Invulnérable refuse
   une affection au porteur, Brise ouvre la garde d'une cible affligée. Aucune n'exige de
   socle : le MJ nomme le prérequis dans le talent qu'il écrit. */
{const ig=C.TALENTS_CODES.ignition,inv=C.TALENTS_CODES.invulnerable,br=C.TALENTS_CODES.brise;
 assert.ok(ig&&ig.type==='ame'&&ig.requiert===undefined&&!ig.params.length,'Ignition ne se règle pas, et ne s’impose pas de socle');
 assert.ok(inv&&inv.type==='ame'&&inv.params[0].cle==='etat'&&br&&br.type==='ame'&&br.params[0].cle==='etat','Invulnérable et Brise se règlent sur un état');
 assert.ok(C.phraseTalent('ignition',{}).includes('<b>allié désigné</b>')&&C.phraseTalent('invulnerable',{etat:'Poison'}).includes('<b>jamais Poison</b>')
  &&C.phraseTalent('brise',{etat:'Gel'}).includes('<b>ignorent la DEF</b>'),'chacune se dit en une phrase');
 assert.equal(C.effetParNom('Ignition'),'ignition');
 // Invulnérable ne refuse que son affection, et seulement à qui la porte.
 const porte=e=>[{code:C.TALENTS_CODES.invulnerable,params:{etat:e}}];
 assert.equal(C.etatRefuse(porte('Feu'),'Feu'),true);
 assert.equal(C.etatRefuse(porte('Feu'),'Gel'),false);
 assert.equal(C.etatRefuse([],'Feu'),false);
 assert.equal(C.etatRefuse(porte('Feu'),''),false);
 // Brise regarde la cible, pas le porteur.
 const brise=e=>[{code:C.TALENTS_CODES.brise,params:{etat:e}}];
 assert.equal(C.briseLaGarde(brise('Gel'),{states:['Gel']}),true);
 assert.equal(C.briseLaGarde(brise('Gel'),{states:['Feu']}),false);
 assert.equal(C.briseLaGarde([],{states:['Gel']}),false);}
/* Les points d'activation : un de chaque d'ordinaire, quatre Actions et trois Mouvements au
   plus. Les comptes vivent dans « checks », qui portait des oui-non — un ancien « true » vaut
   un point dépensé, et rien de ce qui lisait « a-t-il joué ? » ne s'y perd. */
assert.equal(JSON.stringify(C.POINTS_MAX),JSON.stringify({action:4,mouvement:3,objet:1}));
assert.equal(JSON.stringify(C.POINTS_CLES),JSON.stringify(['action','mouvement','objet']));
assert.equal(C.pointsMax({},'action'),1,'sans rien de dit, un point');
assert.equal(C.pointsMax({points:{action:3}},'action'),3);
assert.equal(C.pointsMax({points:{action:9}},'action'),4,'jamais plus que le plafond');
assert.equal(C.pointsMax({points:{mouvement:9}},'mouvement'),3);
assert.equal(C.pointsMax({points:{objet:9}},'objet'),1);
assert.equal(C.pointsMax({points:{action:0}},'action'),1,'jamais moins d’un');
assert.equal(C.pointsUses({checks:[true,false,false]},'action'),1,'un ancien oui vaut un point');
assert.equal(C.pointsUses({checks:[2,0,0],points:{action:3}},'action'),2);
assert.equal(C.pointsUses({checks:[7,0,0],points:{action:3}},'action'),3,'jamais plus qu’il n’en a');
assert.equal(C.pointsUses({},'action'),0);
assert.equal(C.pointsRestants({points:{action:3},checks:[1,0,0]},'action'),2);
{const a={points:{action:3},checks:[0,0,0]};
 assert.equal(C.depensePoint(a,'action'),1);assert.equal(C.depensePoint(a,'action'),2);
 assert.equal(C.pointsRestants(a,'action'),1);
 assert.equal(C.rendPoint(a,'action'),1);
 assert.equal(C.epuisePoints(a,'action'),3);assert.equal(C.pointsRestants(a,'action'),0);
 assert.equal(C.depensePoint(a,'action'),3,'on ne dépense pas ce qu’on n’a plus');
 assert.equal(C.rendPoint(a,'action',9),0,'rendre plus que tout remet à zéro');
 const vide={};C.depensePoint(vide,'action');assert.equal(JSON.stringify(vide.checks),JSON.stringify([1,0,0]),'les comptes naissent avec la dépense');}
/* À la table : l'Action et le Mouvement se dépensent point par point, les pastilles en
   comptent autant qu'il en reste, et les cases disent l'épuisement sans raboter un compte. */
assert.ok(page.includes('function pastillesPoints(a)')&&page.includes("const act=alive(a)?pointsRestants(a,'action'):0;")
 &&page.includes("const mvt=alive(a)&&enCombat()?pointsRestants(a,'mouvement'):0;")
 &&page.includes("if(coche&&!epuise)epuisePoints(a,quoi);else if(!coche&&epuise)rendPoint(a,quoi,POINTS_MAX[quoi])})}")
 &&page.includes("l.lastChild.textContent=' '+LIBELLES_POINTS[i]+(s&&max>1?' '+pointsRestants(s,quoi)+'/'+max:'')});")
 &&page.includes("reinit:()=>{if(code.cle==='orbes')a.orbes=0;else if(code.cle==='gardien')a.garde=null;else rendPoint(a,'action')},")
 &&page.includes("actors.forEach(a=>{a.checks=[0,0,0];a.orbes=0});")&&!page.includes('a.checks=[false,false,false]')
 &&src.includes("a.points={action:pointsMax(a,'action'),mouvement:pointsMax(a,'mouvement'),objet:pointsMax(a,'objet')};")
 &&vivant.includes("'checks','points','ignition','immunites','usages','cibles'"),'les points d’activation se comptent');
/* Ignition à la table : l'orbe part sur l'allié désigné, ne blesse pas, et sa braise s'en va
   avec le premier coup au contact. Invulnérable et Brise s'entendent dans le journal. */
assert.ok(page.includes('function alliePourIgnition(a)')&&page.includes("const j=ciblesDe(a).find(k=>vus.includes(k)&&actors[k]&&actors[k].hero===a.hero&&actors[k]!==a);")
 &&page.includes('if(allie!==null){const feu=etat||\'Feu\';')&&page.includes("const poser=()=>{b.ignition=feu;floatNumber(b,'✦ '+feu,'gain');")
 &&page.includes("const charge=(rangeOf(a)==='distance'?'':a.ignition)||'';")&&page.includes("if(charge)a.ignition=''}")
 &&page.includes('const infligeEtatBrut=infligeEtat;')&&page.includes("if(etatRefuse(talentsCodes(a),etat)||immuniseEtat(a,etat))return 'immunise';")
 &&page.includes('const ouverte=briseLaGarde(talentsCodes(a),b);')&&page.includes("const def=hasState(b,'Au sol')||ouverte?0:defOf(b);")
 &&page.includes("(ouverte?' Brise : la DEF ne compte pas.':'')")&&page.includes("(immunises.length?' Invulnérable : '+immunises.join(', ')+' sans effet.':'')"),'Ignition, Invulnérable et Brise câblés');
/* Les descriptions d'objet et de talent sortent du flux : une bulle se pose au-dessus de la
   vignette cliquée, au lieu d'écarter ses voisines. Le dépliant d'avant reste en place dans
   le code, sous « BULLES » : un mot à faux le ramène. */
assert.ok(src.includes('const BULLES=true;')&&src.includes('function ouvrirBulle(ancre,contenu,classe)')&&src.includes('function placerBulle()')
 /* Le survol ouvre la bulle, la quitter la referme aussitôt, et la survoler ne la retient pas :
    on va y chercher le bouton « Utiliser » d'un objet sans qu'elle fuie. */
 &&!src.includes('BULLE_GRACE')&&!src.includes('bulleRetient')&&!src.includes('bulleLache')&&src.includes('function surveille(el,quoi)')
 &&src.includes("const ouvre=()=>{if(!bulleEpinglee)quoi()};")&&src.includes("const lache=()=>{if(!bulleEpinglee)fermerBulle()};")
 &&src.includes("el.addEventListener('pointerenter',ouvre);")&&src.includes("el.addEventListener('pointerleave',lache);")
 &&src.includes("bulleEl.addEventListener('pointerleave',()=>{if(bulleEpinglee)fermerBulle()});")&&src.includes('if(BULLES)surveille(p,montre);')
 &&feuille.includes('box-sizing:border-box;pointer-events:none;')&&feuille.includes('.bulle.epinglee{pointer-events:auto}')
 /* En jeu, le clic sur un objet épingle sa bulle — son bouton « Utiliser » y est — et la même
    vignette, cliquée encore, la referme ; un rendu la repose épinglée. Refermée, plus rien
    n'est ouvert : un rendu venu d'ailleurs ne la fait pas renaître. */
 &&src.includes('function epingleBulle(oui){bulleEpinglee=!!oui&&!!bulleEl;')&&src.includes('function basculeEpingle(el,quoi){if(bulleEpinglee&&bulleAncre===el){fermerBulle();return}')
 &&src.includes('function reposeBulle(quoi){const ep=bulleEpinglee;quoi();if(ep)epingleBulle(true)}')
 &&src.includes('function fermerBulle(){retireBulle();if(BULLES){gearOuvert=null;talentOuvert=null}}')
 &&src.includes('function retireBulle(){bulleEpinglee=false;if(!bulleEl)return;')&&src.includes('function ouvrirBulle(ancre,contenu,classe){retireBulle();')
 &&src.includes('function bulleOrpheline(){if(BULLES)requestAnimationFrame(()=>{if(bulleEl&&bulleAncre&&!bulleAncre.isConnected)fermerBulle()})}')
 &&src.includes("rangees(equipement,'');rangees(objets,'Objets');bulleOrpheline();")&&src.includes(' bulleOrpheline();return out}')
 &&src.includes("if(!equipable){if(BULLES){if(!tout)basculeEpingle(p,montre)}else basculer();return}")
 // Le chevron des vignettes de talent d'une fiche ne dépliait que l'ancien dépliant.
 &&src.includes("if(!BULLES){const chev=document.createElement('span');chev.className='chev';chev.textContent='⌄';pill.append(chev)}")
 &&src.includes('if(BULLES)surveille(pill,montre);')
 &&src.includes('    if(BULLES)return;   // au survol, la description se montre seule')
 &&src.includes('function fermerBulle()')&&src.includes("document.addEventListener('pointerdown',bulleDehors,true);")
 &&src.includes("document.addEventListener('keydown',bulleEchap,true);")&&src.includes(" e.preventDefault();e.stopPropagation();fermerBulle()}")&&src.includes("window.addEventListener('scroll',fermerBulle,true);window.addEventListener('resize',fermerBulle)")
 &&src.includes("if(!bulleAncre.isConnected||(!r.width&&!r.height)){fermerBulle();return}")&&src.includes("function ancreVisible(el){return !!el&&el.isConnected&&!!el.offsetParent}")&&src.includes('const dessous=r.top-b.height-12<marge;')
 &&src.includes("bulleEl.style.setProperty('--fleche',")
 // Les deux chemins cohabitent : la bulle, et le dépliant d'avant si l'on repasse BULLES à faux.
 &&src.includes("if(BULLES&&ouvert)requestAnimationFrame(()=>{if(bulleEl&&gearOuvert===cle&&ancreVisible(p))reposeBulle(montre)});")
 &&src.includes("out.append(p);if(!BULLES)details.push(p.detailPlie)});")&&src.includes("out.append(pill);if(!BULLES)details.push(detail)});")
 &&src.includes('let talentOuvert=null;')&&src.includes("const cle=(a.id||'?')+'|'+t.id,ouvert=BULLES?talentOuvert===cle:talentsOuverts.has(t.id);")
 &&src.includes("if(BULLES&&ouvert)requestAnimationFrame(()=>{if(bulleEl&&talentOuvert===cle&&ancreVisible(pill))montre()});")
 &&src.includes("if(o)talentsOuverts.add(t.id);else talentsOuverts.delete(t.id)};")
 &&feuille.includes('.bulle{position:fixed;z-index:60;')&&feuille.includes(".bulle::after{content:'';position:absolute;left:var(--fleche,50%);")
 &&feuille.includes('.bulle.dessous::after{'),'la description se pose en bulle, le dépliant reste sous BULLES');
/* Les effets d'équipement : une banque déclarée comme celle des talents — une clé, des
   réglages, une phrase — et trois manières d'en user. */
{const codes=C.OBJETS_CODES;
 assert.equal(Object.keys(codes).sort().join(),'etat,invulnerabilite,soin');
 assert.equal(JSON.stringify(C.USAGES_OBJET.map(([k])=>k)),JSON.stringify(['libre','conso','court','jour']));
 assert.equal(JSON.stringify(C.USAGES_LIMITES),JSON.stringify(['court','jour']));
 assert.equal(C.usageLimite('court'),true);assert.equal(C.usageLimite('conso'),false);
 assert.equal(C.NOM_USAGE('court'),'Une fois entre deux repos courts');
 assert.equal(C.NOM_USAGE('jour'),'Une fois par jour');assert.equal(C.NOM_USAGE('bidon'),'À volonté');
 // Chaque effet se dit en une phrase, réglages en gras, écrite par le moteur.
 assert.ok(C.phraseObjet('soin',{quantite:2,forme:'des'}).includes('<b>2d6</b> PV'));
 assert.ok(C.phraseObjet('soin',{quantite:3,forme:'endu'}).includes('<b>3 + Endurance</b>'));
 assert.ok(C.phraseObjet('etat',{etat:'Onde'}).includes('obtient <b>Onde</b>'));
 assert.ok(C.phraseObjet('invulnerabilite',{contre:'etat',etat:'Poison'}).includes('insensible</b> à <b>Poison</b>'));
 assert.ok(C.phraseObjet('invulnerabilite',{contre:'des',des:'black'}).includes('aux dés <b>Mortels</b>'));
 assert.equal(C.phraseObjet('inconnu',{}),'','un effet inconnu ne dit rien');
 // Les réglages manquants prennent leur défaut, et rien d'illisible n'entre.
 {const p=C.paramsObjet({effet:'soin',params:{}});assert.equal(p.quantite,5);assert.equal(p.forme,'fixe');
  assert.equal(C.paramsObjet({effet:'soin',params:{quantite:'999'}}).quantite,99,'borné au maximum déclaré');
  assert.equal(C.paramsObjet({effet:''}),null);}
 // L'usage : celui qui est dit, sinon l'ancienne case « consommable », sinon à volonté.
 assert.equal(C.usageObjet({usage:'jour'}),'jour');
 assert.equal(C.usageObjet({consumable:true}),'conso','un objet d’avant les usages garde le sien');
 assert.equal(C.usageObjet({}),'libre');
 assert.equal(C.usageObjet({usage:'n’importe quoi'}),'libre');
 // Les insensibilités d'un combattant : des états, des couleurs de dés, jamais deux fois la même.
 {const a={};
  assert.equal(JSON.stringify(C.immunites(a)),JSON.stringify({etats:[],des:[]}));
  assert.equal(C.poseImmunite(a,'etats','Feu'),true);
  assert.equal(C.poseImmunite(a,'etats','Feu'),false,'déjà insensible');
  assert.equal(C.poseImmunite(a,'des','red'),true);
  assert.equal(C.immuniseEtat(a,'Feu'),true);assert.equal(C.immuniseEtat(a,'Gel'),false);
  assert.equal(C.immuniseDe(a,'red'),true);assert.equal(C.immuniseDe(a,'blue'),false);
  assert.equal(C.poseImmunite(null,'etats','Feu'),false);assert.equal(C.poseImmunite(a,'etats',''),false);}}
/* À la table et à l'armurerie : la banque au-dessus des objets, l'effet et son usage au
   formulaire, le bouton qui l'emploie, la charge du jour et les dés écartés. */
assert.ok(src.includes("function renderBiblioObjets()")&&src.includes("function renderArmory(){renderBiblioObjets();")
 &&src.includes('📖 Banque des effets d’équipement')&&src.includes("const porteurs=(catalog.items||[]).filter(o=>o&&o.effet===c.cle).map(o=>o.name);")
 &&src.includes("o.effet=OBJETS_CODES[o.effet]?o.effet:'';")&&src.includes("o.usage=usageObjet(o);o.consumable=o.usage==='conso'});")
 &&src.includes("+sel('Usage','usage',usageObjet(a),USAGES_OBJET)+'</div>'")&&src.includes('function dessineReglagesObjet()')
 &&src.includes("a.params=a.effet?paramsObjet({effet:a.effet,params:lireReglagesObjet()}):{};")&&!src.includes(">Consommable</label>')")
 &&src.includes('function usageEpuise(a,o)')&&src.includes("function objetDisponible(a,o){return !usageLimite(usageObjet(o))||!usageEpuise(a,o)}")
 &&src.includes('function appliquerEffetObjet(a,o)')&&src.includes("if(usageLimite(usage)){a.usages={...(a.usages||{}),[o.id]:usage}}")
 &&src.includes("if(usage==='conso')retirerInventaire(a,o);")&&src.includes('if(objetCode(o)){appliquerEffetObjet(a,o);return}')
 &&src.includes("a.immunites=immunites(a);a.usages=a.usages&&typeof a.usages==='object'?a.usages:{};")
 &&page.includes('function desRecus(b,dice)')&&page.includes('const {gardes:dice,ecartes}=desRecus(b,tous);')
 &&page.includes('const suite=ditEcartes(ecartes)+')&&page.includes('const {gardes:dice,ecartes:orbeEcartes}=desRecus(b,tous);')
 &&page.includes("a.immunites={etats:[],des:[]};if(typeof reposer==='function')reposer(a,'long');")&&src.includes('function reposer(a,type=')
 &&feuille.includes('.gear-detail .gear-effet{font-weight:600}'),'les effets d’équipement sont câblés');
/* Les emplacements du corps : deux mains, un torse, un dos, une tête, trois anneaux, une
   amulette, des bottes. Une cape et une armure se portent ensemble ; deux armures, jamais. */
assert.equal(C.MAINS_MAX,2);
assert.equal(JSON.stringify(C.EMPLACEMENTS),JSON.stringify([['torse','Torse',1],['dos','Dos',1],['tete','Tête',1],
 ['anneau','Anneaux',3],['amulette','Amulette',1],['bottes','Bottes',1]]));
assert.equal(C.placesEmplacement('anneau'),3);assert.equal(C.placesEmplacement('torse'),1);
assert.equal(C.placesEmplacement('nulle part'),0);
assert.equal(C.NOM_EMPLACEMENT('shield'),'Bouclier');assert.equal(C.NOM_EMPLACEMENT('bottes'),'Bottes');
// Où va une pièce : à l'emplacement qu'elle nomme, au torse à défaut, aux mains pour un bouclier.
assert.equal(C.emplacementDe({category:'armor',slot:'dos'}),'dos');
assert.equal(C.emplacementDe({category:'armor',slot:'body'}),'torse','une armure d’avant les emplacements');
assert.equal(C.emplacementDe({category:'armor',slot:'n’importe quoi'}),'torse');
assert.equal(C.emplacementDe({category:'armor',slot:'shield'}),'shield');
assert.equal(C.emplacementDe({category:'weapon'}),'','une arme n’a pas d’emplacement de corps');
assert.equal(C.emplacementDe(null),'');
{const objets=[{id:'ar',category:'armor',slot:'torse',def:2},{id:'cape',category:'armor',slot:'dos',def:1},
  {id:'an',category:'armor',slot:'anneau',def:0},{id:'b',category:'armor',slot:'shield',def:1}];
 const h={armures:['ar','cape','an','an'],shieldId:'b'};
 // La DEF est la somme de tout ce qui se porte, bouclier compris.
 assert.equal(C.equippedDef(h,objets),4);
 assert.equal(JSON.stringify(C.portesA(h,'anneau',objets)),JSON.stringify(['an','an']));
 assert.equal(C.placesLibres(h,'anneau',objets),1);assert.equal(C.placesLibres(h,'torse',objets),0);
 assert.equal(C.placesLibres(h,'bottes',objets),1,'rien aux pieds : la place est libre');
 // Une fiche d'avant les emplacements se lit comme une liste d'une seule armure.
 assert.equal(JSON.stringify(C.armuresDe({armorId:'ar'})),JSON.stringify(['ar']));
 assert.equal(JSON.stringify(C.armuresDe({})),'[]');
 assert.equal(C.equippedDef({armorId:'ar'},objets),2,'l’ancienne fiche garde sa DEF');}
/* À la table : ce qu'on porte va à son emplacement, la fiche en tient la liste, et les objets
   qui agissent offrent leur bouton dans la rangée des Actions, à l'encre de leur famille. */
assert.ok(src.includes("a.weapons??=[];a.armures=armuresDe(a);delete a.armorId;a.shieldId??='';")
 &&src.includes("if(o.category==='armor')o.slot=emplacementDe(o);")&&src.includes('function libereEmplacement(a,slot,besoin)')
 &&src.includes("else if(o.category==='armor'){const slot=emplacementDe(o);")
 &&src.includes("if(portes>0&&portes<dans&&placesLibres(a,slot,catalog.items)>0)a.armures=[...a.armures,o.id];")
 &&src.includes("else{libereEmplacement(a,slot,1);a.armures=[...a.armures,o.id]}}")
 &&src.includes("+sel('Emplacement','slot',emplacementDe(a),[...EMPLACEMENTS.map(([k,n,p])=>[k,n+(p>1?' ('+p+')':'')]),['shield','Bouclier — une main']]):'')")
 &&src.includes('const TEINTE_OBJET={melee:')&&src.includes('function boutonsObjets(a)')
 &&src.includes("const o=objetDe(id),code=objetCode(o);if(!o||!code)return;")
 &&src.includes("el.className='btn-action choix-attaque btn-objet teinte-propre';")&&src.includes("el.style.setProperty('--fond',b.teinte);")
 &&src.includes("boite.hidden=!liste.length&&!talents.length&&!objets.length;")
 &&!src.includes('a.armorId=')&&!src.includes('draft.armorId'),'les emplacements du corps et les boutons d’objets');
/* Un usage compté porte son chrono, en pastille à cheval sur le coin haut droit de son
   bouton : il dit que la charge se rend au repos, et le MJ la rend — ou la reprend — d'un
   clic. Les joueurs, non : leur bouton épuisé est désactivé, et rien dedans ne se clique. */
assert.ok(src.includes('function rendreUsage(a,o){')&&src.includes("if(view!=='mj'||!a||!o||!usageEpuise(a,o))return false;")
 &&src.includes('function prendreUsage(a,o){')&&src.includes("if(view!=='mj'||!a||!o||!usageLimite(usageObjet(o))||usageEpuise(a,o))return false;")
 &&src.includes("function reposer(a,type='long'){")&&src.includes("if(type==='long'||quoi==='court')rendues.push(id);else garde[id]=quoi});")
 &&src.includes("if(b.limite){const chrono=document.createElement('span');chrono.className='chrono'+(b.epuise?' vide':'');")
 &&src.includes("if(view==='mj'){chrono.setAttribute('role','button');chrono.tabIndex=0;")
 &&src.includes("const a2=b.acteur;")&&src.includes("if(b.epuise?rendreUsage(a2,b.objet):prendreUsage(a2,b.objet)){")
 &&src.includes("acteur:a,agir:()=>utiliserObjet(a,o)})});")
 &&feuille.includes('.btn-objet .chrono{position:absolute;top:-6px;right:-6px;z-index:2;width:19px;height:19px;')
 &&feuille.includes('border:2px solid var(--panel);box-shadow:0 1px 3px #0005;pointer-events:auto}')
 &&feuille.includes('.btn-objet .chrono.vide{opacity:.5;filter:grayscale(1)}')
 /* Le bouton d'un joueur est désactivé, celui du MJ seulement pâli : c'est ce qui laisse le
    chrono cliquable pour l'un et muet pour l'autre. */
 &&page.includes("function inerte(b,off){if(view==='mj'){b.disabled=false;b.classList.toggle('inerte',!!off);"),'le chrono rend sa charge, pour le MJ seul');
/* ---------- Le Domaine ---------- */
/* Le fief de la troupe : treize bâtiments en quatre étapes, un trésor qui les paie, des
   habitants et des visiteurs, les aventuriers qui y séjournent. Les règles sont pures ; le
   domaine vit dans la sauvegarde de la partie et nulle part ailleurs. */
{const D=C.normaliseDomaine(null);
 assert.equal(C.BATIMENTS_DEFAUT.length,13);assert.ok(C.BATIMENTS_DEFAUT.includes('Cartographe')&&C.BATIMENTS_DEFAUT.includes('Tour de Mystique'));
 assert.deepEqual(C.ETAPES_DOMAINE.map(e=>e[1]),['Friche','Fondations','Construction','Construit']);
 assert.equal(D.batiments.length,13);assert.equal(D.batiments[0].nom,'Étables');
 assert.ok(D.batiments.every(b=>b.etape===0&&b.zone===null&&b.couts.length===3&&b.effets.length===4&&b.id));
 assert.equal(D.finances.tresor,0);assert.deepEqual(D.finances.journal,[]);assert.deepEqual(D.carte.calques,[null,null,null,null,null,null]);
 assert.equal(D.carte.ratio,16/9);assert.deepEqual(D.pnj,[]);assert.equal(D.nom,'Le Domaine');assert.equal(D.monnaie,'or');
 // Un domaine abîmé se relit borné : étapes dans [0,3], zones valides ou rien, journal court.
 const G=C.normaliseDomaine({nom:42,batiments:[{nom:'Forge',etape:7,zone:[[0,0],[200,-5],[10,10]],couts:['a',5,-3]},{etape:-2,zone:[[0,0],[1,1]]},null],
  carte:{calques:['a',null,3,''],ratio:'x'},finances:{tresor:'12.9',journal:Array.from({length:250},(_,i)=>({t:i,libelle:'l'+i,montant:1}))},
  pnj:[{nom:'Brenn',statut:'roi'},{statut:'visiteur'}],aventuriers:{h1:{lieu:'x',notes:'n'}}});
 assert.equal(G.nom,'42');assert.equal(G.batiments.length,2);assert.equal(G.batiments[0].etape,3);assert.deepEqual(G.batiments[0].zone,[[0,0],[100,0],[10,10]]);
 assert.deepEqual(G.batiments[0].couts,[0,5,0]);assert.equal(G.batiments[1].etape,0);assert.equal(G.batiments[1].zone,null);assert.equal(G.batiments[1].nom,'Bâtiment');
 assert.deepEqual(G.carte.calques,['a',null,null,null,null,null]);assert.equal(G.carte.ratio,16/9);assert.equal(G.finances.tresor,12);assert.equal(G.finances.journal.length,200);
 assert.equal(G.pnj[0].statut,'habitant');assert.equal(G.pnj[1].statut,'visiteur');assert.equal(G.pnj[1].nom,'Inconnu');assert.deepEqual(G.aventuriers.h1,{lieu:'x',notes:'n'});
 // Construire : le trésor paie, le journal note, l'étape avance ; sans le sou, rien — sauf forcé.
 const b=D.batiments.find(x=>x.nom==='Forge');b.couts=[100,200,300];D.finances.tresor=150;
 assert.deepEqual(C.peutConstruire(D,b),{ok:true,cout:100,manque:0,fini:false});
 assert.equal(C.construire(D,b),true);assert.equal(b.etape,1);assert.equal(D.finances.tresor,50);
 assert.deepEqual(D.finances.journal.map(e=>[e.libelle,e.montant]),[['Construction — Forge : Fondations',-100]]);
 assert.deepEqual(C.peutConstruire(D,b),{ok:false,cout:200,manque:150,fini:false});
 assert.equal(C.construire(D,b),false);assert.equal(b.etape,1);assert.equal(D.finances.tresor,50);
 assert.equal(C.construire(D,b,true),true);assert.equal(b.etape,2);assert.equal(D.finances.tresor,-150);
 assert.equal(C.construire(D,b,true),true);assert.equal(b.etape,3);assert.equal(C.construire(D,b,true),false);assert.equal(C.prochaineEtape(b),null);
 assert.deepEqual(C.peutConstruire(D,b),{ok:false,cout:0,manque:0,fini:true});
 // Reculer ne rembourse rien ; un mouvement se note, et le journal ne garde que les 200 derniers.
 assert.equal(C.reculerEtape(b),true);assert.equal(b.etape,2);assert.equal(D.finances.tresor,-450);
 assert.equal(C.mouvementFinance(D,'abc','?'),null);assert.equal(C.mouvementFinance(D,500.9,'Butin').montant,500);assert.equal(D.finances.tresor,50);
 for(let i=0;i<210;i++)C.mouvementFinance(D,1,'x');assert.equal(D.finances.journal.length,200);
 assert.equal(C.coutEtape(b,0),0);assert.equal(C.coutEtape(b,3),300);assert.equal(C.coutEtape(b,4),0);
 // Le calque d'une étape : le sien, sinon le plus proche en dessous, sinon au-dessus.
 assert.equal(C.calqueDisponible([null,'f',null,'c'],2),1);assert.equal(C.calqueDisponible([null,'f',null,'c'],3),3);
 assert.equal(C.calqueDisponible([null,null,null,'c'],0),3);assert.equal(C.calqueDisponible(['a',null,null,null],3),0);assert.equal(C.calqueDisponible([],2),-1);
 // Le centre d'une zone, le bâtiment sous un point, la zone qui ne sort pas de la carte.
 const carre=[[0,0],[10,0],[10,10],[0,10]];
 assert.deepEqual(C.centroide(carre),[5,5]);assert.equal(C.centroide([[0,0],[1,1]]),null);
 assert.equal(C.batimentSous({batiments:[{zone:carre},{zone:[[5,5],[20,5],[20,20],[5,20]]}]},[7,7]),1);
 assert.equal(C.batimentSous({batiments:[{zone:carre},{zone:null}]},[2,2]),0);assert.equal(C.batimentSous({batiments:[{zone:carre}]},[50,50]),-1);
 assert.deepEqual(C.deplaceZone(carre,-5,95),[[0,90],[10,90],[10,100],[0,100]]);assert.equal(C.deplaceZone(null,1,1),null);
 assert.equal(C.pnjDuBatiment({pnj:[{batiment:'a'},{batiment:'b'},{batiment:'a'}]},'a').length,2);
 assert.ok(typeof C.idDomaine()==='string'&&C.idDomaine()!==C.idDomaine());}
/* L'écran : un onglet, un script à part, la carte du domaine dans l'onglet Cartes, et
   la sauvegarde qui l'emporte. Le domaine ne se publie pas et ne va pas à la table. */
{const fief=fs.readFileSync('domaine.js','utf8'),partage=fs.readFileSync('shared.js','utf8');
 assert.ok(page.includes('<script src="./maps.js?v=')&&/maps\.js\?v=[\d.]+"><\/script><script src="\.\/domaine\.js\?v=/.test(page),'domaine.js se charge après maps.js');
 assert.ok(cartes.includes("const PAGES=['table','maps','domaine','heroes','talents','armory','bestiary','settings'];")
  &&cartes.includes('<button data-page="domaine">Domaine</button>')&&cartes.includes("else if(p==='domaine')renderDomaine();")
  &&cartes.includes("if(typeof domaineEdite!=='undefined'&&domaineEdite){renderMapList();renderDomaineEditeur()}")
  &&cartes.includes("const editeDomaine=()=>typeof domaineEdite!=='undefined'&&domaineEdite;")
  &&(cartes.match(/\|\|editeDomaine\(\)/g)||[]).length===4,'l’onglet Domaine, MJ seul, et l’éditeur de combat cède ses touches');
 assert.ok(fief.includes('let domaine=normaliseDomaine(null);')
  &&fief.includes('snapshot=function(){return Object.assign(snapshotSansDomaine(),{domaine})};')
  &&fief.includes('appliquerSauvegarde=function(s){appliquerSansDomaine(s);domaine=normaliseDomaine(s&&s.domaine);')
  &&src.includes("if(s.domaine!=null&&(typeof s.domaine!=='object'||Array.isArray(s.domaine)))return 'Le domaine de la sauvegarde est illisible.';")
  &&!/\bdomaine\b/.test(partage)&&!/\bdomaine\b/.test(vivant),'le domaine voyage dans la sauvegarde, et nulle part ailleurs');
 assert.ok(fief.includes('function dessineDomaine(canvas,vue,redessine)')&&fief.includes('const fond=calqueDisponible(c.calques,0);if(fond<0)return false;')
  &&fief.includes("ctx.closePath();ctx.clip();")&&fief.includes('const k=calqueDuBatiment(c.calques,b);if(k<0||k===fond)return;')
  &&fief.includes("if(vue>=0){const im=charge(vue);if(im)ctx.drawImage(im,0,0,W,H);return !!c.calques[vue]}"),'le village composé : chaque bâtiment découpé dans le calque de son étape');
 assert.ok(fief.includes('renderMapList=function(){renderMapListSansDomaine();')&&fief.includes('mapsPage.append(domEditeur,domProps);')
  &&fief.includes('function entreDomaine(){domaineEdite=true;mapsPage.classList.add(\'mode-domaine\');')
  &&fief.includes('function fermeTraceDom(){')&&fief.includes('const pts=zoneValide(t.bouge?encreDroite([t.pts])[0]:t.pts);')
  &&fief.includes("if(domTrace.pts.length>2&&Math.hypot(p.x-domTrace.pts[0][0],p.y-domTrace.pts[0][1])<domAuZoom(1.6)){fermeTraceDom();return}")
  &&fief.includes("if(d.mode==='move'){b.zone=deplaceZone(d.orig,p.x-d.from.x,p.y-d.from.y);renderDomZones()}")
  &&fief.includes("if(d.mode==='sommet'){b.zone[d.i]=[p.x,p.y];renderDomZones();return}")
  &&feuille.includes('#maps-page.mode-domaine #domaine-editeur{display:flex}')&&feuille.includes('#maps-page.mode-domaine>.maps-main:not(#domaine-editeur)'),'la carte du domaine s’édite dans Cartes : calques, tracé, déplacement, sommets');
 assert.ok(fief.includes("if(!p.ok&&!confirm('Le trésor ne suffit pas : il manque '")&&fief.includes('construire(domaine,b,true);renderDomaine();sauveDomaine()}')
  &&fief.includes("mouvementFinance(domaine,signe*m,libelle.value.trim()||(signe>0?'Recette':'Dépense'));")
  &&fief.includes("const pnjDialog=dialog('dom-pnj-editor','Personnage',")&&fief.includes("[['','Au domaine'],...domaine.batiments.map(b=>[b.id,b.nom]),['aventure','En aventure'],['absent','Absent']]")
  &&fief.includes("ta.onchange=()=>{b.effets[i]=ta.value.slice(0,600);renderDomBats();sauveDomaine()}")
  &&feuille.includes('body.page-domaine #domaine-page{display:grid;')&&feuille.includes('body.page-domaine main.layout'),'l’onglet Domaine : construire, financer, peupler, loger, conférer');}
/* Six retouches d'écran : plus de spécialisation sur la vignette ; l'infobulle du système
   cède à la bulle ; un objet se nomme par ce qu'il prodigue et compte ses usages dessous ;
   l'Attaque reste le premier bouton ; le logo des Orbes suit l'amélioration tenue. */
assert.ok(src.includes("[el,...el.querySelectorAll('[title]')].forEach(x=>{if(!x.title)return;")&&src.includes("if(!x.getAttribute('aria-label'))x.setAttribute('aria-label',x.title);x.removeAttribute('title')});")
 &&src.includes("const texte=code.cle==='etat'?(p&&p.etat)||code.nom:code.nom;")
 &&src.includes("const compte=usageLimite(usage)?(dispo?'1':'0')+' / '+(usage==='jour'?'jour':'repos'):'';")
 &&src.includes("if(b.compte){const c=document.createElement('span');c.className='compte';c.textContent=b.compte;el.append(c)}")
 &&!src.includes("' 1/1'")&&feuille.includes('button.choix-attaque .compte{')
 &&src.includes("const premierAutre=boite.querySelector('.btn-talent,.btn-objet');")&&!src.includes("boite.querySelector('.btn-talent');")
 &&page.includes("const tenus=talentsCodes(a),affine=tenus.find(x=>x.code.cle==='orbesfeu');")
 &&page.includes("const logo=(code.cle==='orbes'&&affine&&affine.talent.logo)||talent.logo||'';")&&page.includes('return {talent,code,params,rangee,logo,'),'vignettes, bulles, objets, attaque première, logo des orbes');
/* Les étages d'une colonne : l'épine des centraux, et sous chacun deux places en diagonale
   qu'un talent de branche occupe ; les chemins se ferment et s'ouvrent, et l'on ne marche
   que sur les chemins ouverts. Un talent de branche sans central reprend l'épine. */
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const ctx={catalog:{classes:[],voies:{Mystique:['Pyromane']},cheminsCaches:{},talents:[
   {id:'o',name:'Orbes de Feu',famille:'Mystique',type:'act',level:1,voie:'Pyromane'},
   {id:'b',name:'Brisefeu',famille:'Mystique',type:'ame',level:2,voie:'Pyromane',prerequis:'o'},
   {id:'g',name:'Braise',famille:'Mystique',type:'pass',level:2,voie:'Pyromane',prerequis:'o',branche:'g'},
   {id:'d',name:'Cendre',famille:'Mystique',type:'pass',level:2,voie:'Pyromane',prerequis:'o',branche:'d'},
   {id:'x',name:'Orphelin',famille:'Mystique',type:'pass',level:2,voie:'Pyromane',prerequis:'zz',branche:'g'},
   {id:'f',name:'Fournaise',famille:'Mystique',type:'act',level:3,voie:'Pyromane'}]},
  cleClasse:C.cleClasse,ordonneTalents:C.ordonneTalents,talentCode:C.talentCode,manqueTalent:C.manqueTalent,talentsDependants:C.talentsDependants,VOIES_MAX:3,SEGMENTS:['c','g','gc','d','dc']};
 vm.createContext(ctx);
 vm.runInContext(morceau('const TALENT_TYPES=','function talent(id)')+morceau('function talentFamilies()',"// L'encre d'une classe")
  +morceau('function descendDe(','function openTalent(')+morceau('const AUTRE_VOIE=','const arbresDialog='),ctx);
 const col=ctx.colonnesArbre('Mystique')[0];let et=ctx.etagesArbre(col);
 assert.equal(JSON.stringify(et.map(e=>[e.t.id,e.g&&e.g.id,e.d&&e.d.id,e.suivant&&e.suivant.id])),JSON.stringify([['o','g','d','b'],['b',null,null,'x'],['x',null,null,'f'],['f',null,null,null]]),'l’épine, ses diagonales, et l’orphelin remis sur l’épine');
 assert.equal(JSON.stringify(et.map(e=>e.rang)),'[0,1,2,3]');
 const [o,b,g,d,x]=['o','b','g','d','x'].map(id=>ctx.catalog.talents.find(t=>t.id===id));
 // Le premier central est libre ; une diagonale attend son central ; le suivant, un chemin ouvert.
 assert.equal(ctx.verrouEtages([],et,o),'');assert.equal(ctx.verrouEtages([],et,g),'Orbes de Feu');assert.equal(ctx.verrouEtages([],et,d),'Orbes de Feu');
 assert.equal(ctx.verrouEtages([],et,b),'Orbes de Feu ou Braise ou Cendre');
 assert.equal(ctx.verrouEtages(['o'],et,g),'');assert.equal(ctx.verrouEtages(['o'],et,b),'');
 assert.equal(ctx.verrouEtages(['g'],et,b),'','par la diagonale gauche, sans le central');
 // Fermer le chemin droit : il faut passer par une diagonale ; fermer les retours : plus de passage.
 assert.equal(ctx.cheminCache('o','c'),false);assert.equal(ctx.basculeChemin('o','c'),true);assert.equal(ctx.cheminCache('o','c'),true);
 assert.equal(ctx.verrouEtages(['o'],et,b),'Braise ou Cendre');assert.equal(ctx.verrouEtages(['o','g'],et,b),'');
 assert.equal(ctx.basculeChemin('o','gc'),true);assert.equal(ctx.verrouEtages(['o','g'],et,b),'Cendre');
 assert.equal(ctx.basculeChemin('o','dc'),true);assert.equal(ctx.verrouEtages(['o','g','d'],et,b),'un chemin ouvert jusqu’à lui');
 assert.equal(ctx.basculeChemin('o','g'),true);assert.equal(ctx.verrouEtages(['o'],et,g),'un chemin ouvert jusqu’à lui');
 assert.equal(JSON.stringify(ctx.catalog.cheminsCaches),JSON.stringify({o:['c','gc','dc','g']}));
 assert.equal(ctx.basculeChemin('o','c'),true);assert.equal(ctx.verrouEtages(['o'],et,b),'','rouvert');
 assert.equal(ctx.basculeChemin('o','zzz'),false);assert.equal(ctx.basculeChemin('','c'),false);
 ['gc','dc','g'].forEach(seg=>ctx.basculeChemin('o',seg));assert.equal(JSON.stringify(ctx.catalog.cheminsCaches),'{}','tout rouvert : plus rien de noté');
 // La chute : oublier un central emporte tout ce qui est sous lui, diagonales comprises ; une diagonale tombe seule.
 assert.equal(JSON.stringify(ctx.chuteDe(et,o).map(t=>t.id)),JSON.stringify(['o','g','d','b','x','f']));
 assert.equal(JSON.stringify(ctx.chuteDe(et,x).map(t=>t.id)),JSON.stringify(['x','f']));
 assert.equal(JSON.stringify(ctx.chuteDe(et,g).map(t=>t.id)),'["g"]');
 // Placer en diagonale, puis sur l'épine : la branche suit la destination.
 assert.equal(ctx.placerTalent('f',{famille:'Mystique',voie:'Pyromane',prerequis:'b',branche:'d'}),true);
 et=ctx.etagesArbre(ctx.colonnesArbre('Mystique')[0]);
 assert.equal(JSON.stringify(et.map(e=>[e.t.id,e.g&&e.g.id,e.d&&e.d.id])),JSON.stringify([['o','g','d'],['b',null,'f'],['x',null,null]]));
 assert.equal(ctx.placerTalent('f',{famille:'Mystique',voie:'Pyromane',prerequis:'b'}),true);
 assert.equal(ctx.catalog.talents.find(t=>t.id==='f').branche,'','déposé sur un central : sur l’épine');
 assert.equal(JSON.stringify(ctx.etagesArbre(ctx.colonnesArbre('Mystique')[0]).map(e=>e.t.id)),JSON.stringify(['o','b','f','x']));}
assert.ok(src.includes("const SEGMENTS=['c','g','gc','d','dc'];")&&src.includes("t.branche=t.branche==='g'||t.branche==='d'?t.branche:''});")
 &&src.includes("const segs=[...new Set(l.filter(x=>SEGMENTS.includes(x)))];if(segs.length)c.cheminsCaches[id]=segs});")
 &&src.includes("+sel('Place dans l’arbre','branche',t.branche||'',[['','Sur l’épine — talent central'],['g','Diagonale gauche, sous le prérequis'],['d','Diagonale droite, sous le prérequis']])")
 &&src.includes(" t.branche=f.branche&&(f.branche.value==='g'||f.branche.value==='d')?f.branche.value:'';")
 &&src.includes(" t.branche=dest.branche==='g'||dest.branche==='d'?dest.branche:'';"),'la place d’un talent dans l’arbre : au formulaire, au dépôt, au chargement');
/* Les chemins se tracent en SVG d'un rond à l'autre, se ferment d'un clic pour le MJ, ne se
   dessinent pas fermés pour la troupe ; la vue joueur ôte les outils au MJ le temps de regarder. */
assert.ok(src.includes('function traceChemins(){const corps=$(\'arbres-corps\');if(!corps||!arbresDialog.open)return;')
 &&src.includes("if(B){const cache=cheminCache(e.t.id,'c');if(mj||!cache)trait(H,B,'c',e.t.id,cache,false,!cache&&pris(e.t,e.suivant))}")
 &&src.includes("g.onclick=e=>{e.stopPropagation();if(basculeChemin(id,seg))arbreChange()}}")
 &&src.includes("const a=arbresActeur,mj=view==='mj'&&!arbresVueJoueur;")&&src.includes("else if(view!=='mj'){arbresDialog.close();return}")
 &&src.includes("arbresVue.onclick=()=>{arbresVueJoueur=!arbresVueJoueur;noteArbres('');renderArbres()};")
 &&src.includes("if(mj||e.suivant||e.g||e.d){const inter=document.createElement('div');inter.className='arbre-etage inter'+(!e.g&&!e.d?' vide':'');")
 &&src.includes("const place=(col,e,seg)=>{const p=document.createElement('div');p.className='arbre-place';\n  if(!mj)return p;")
 &&src.includes(" requestAnimationFrame(traceChemins)}")
 &&feuille.includes('.arbre-chemins{position:absolute;inset:0;')&&feuille.includes('.arbre-chemins .chemin.cache .trait{stroke-dasharray:5 7;opacity:.3}')
 &&feuille.includes('.arbre-col.editable .arbre-chemins .chemin{pointer-events:stroke;cursor:pointer}')&&feuille.includes('.arbre-etages .arbre-noeud::before{display:none}')
 &&feuille.includes('.arbre-place:empty{visibility:hidden}')&&feuille.includes('.arbres-vue.on{'),'les chemins tracés, fermés d’un clic, et la vue joueur');
/* Les bonus de caractéristique : des nœuds d'arbre qui ne sont pas des talents. Appris,
   ils s'ajoutent à la lecture — PV max, Endurance, Vie, dégâts, un point de compétence — et
   la fiche garde ses valeurs propres. */
{const cat=[{id:'b1',name:'Vigueur',effet:'bonus',params:{carac:'pv',valeur:4}},{id:'b2',name:'Poigne',effet:'bonus',params:{carac:'comp',valeur:2,comp:'1'}},
  {id:'b3',name:'Souffle',effet:'bonus',params:{carac:'endu',valeur:1}},{id:'b4',name:'Tranchant',effet:'bonus',params:{carac:'dmg',valeur:3}},
  {id:'b5',name:'Sève',effet:'bonus',params:{carac:'vie',valeur:2}},{id:'t',name:'Lamevent',effet:'lamevent'}];
 const a={vie:6,endu:3,role:'x',talents:['b1','b2','b3','b4','b5','t']};
 assert.deepEqual(C.bonusDe(a,cat),{pv:4,endu:1,vie:2,def:0,dmg:3,skills:[0,2,0,0,0,0,0,0]});
 assert.equal(C.pvMaximum([],a,cat),(6+2)*(3+1)+4);assert.equal(C.pvMaximum([],a),18,'sans catalogue, la fiche seule');
 assert.equal(C.vieDe(a,cat),8);assert.equal(C.enduDe(a,cat),4);assert.equal(C.vieDe({vie:'x'},cat),0);
 assert.equal(C.libelleBonus({carac:'comp',valeur:2,comp:'1'}),'+2 Force');assert.equal(C.libelleBonus({carac:'pv',valeur:4}),'+4 PV max');assert.equal(C.libelleBonus({carac:'pv',valeur:4},true),'+4 PV');
 assert.equal(C.libelleBonus({carac:'dmg',valeur:1},true),'+1 Dég.');assert.equal(C.libelleBonus({}),'+1 PV max');
 assert.deepEqual(C.paramsTalent({effet:'bonus',params:{carac:'zzz',valeur:99,comp:'9'}}),{carac:'pv',valeur:20,comp:'0'},'relu au travers de la déclaration');
 assert.deepEqual(C.bonusDe({talents:['b1']},[]),{pv:0,endu:0,vie:0,def:0,dmg:0,skills:[0,0,0,0,0,0,0,0]},'un nœud absent du catalogue ne donne rien');
 assert.equal(C.COMPETENCES.length,8);assert.ok(page.includes('const skillNames=COMPETENCES;'));
 assert.match(C.phraseTalent('bonus',{carac:'endu',valeur:2}),/<b>\+2 Endurance<\/b>/);}
/* Meneur : un passif qui augmente les dégâts, la DEF ou les PV max temporaires des alliés
   les plus proches à portée — un, deux ou tous. Le moteur choisit ; la table mesure. */
{const m=C.TALENTS_CODES.meneur;assert.ok(m&&m.type==='pass'&&m.params.map(p=>p.cle).join()==='quoi,valeur,combien,portee');
 assert.match(C.phraseTalent('meneur',{quoi:'def',valeur:2,combien:'tous',portee:'vue'}),/<b>la DEF<\/b> de <b>2<\/b> pour <b>tous les alliés<\/b> <b>dans votre ligne de vue<\/b>/);
 assert.match(C.phraseTalent('meneur',{}),/<b>les dégâts<\/b> de <b>1<\/b> pour <b>un allié<\/b> <b>au contact<\/b>/);
 assert.deepEqual(C.elusMeneur({combien:'deux'},[{a:'c',dist:3},{a:'a',dist:1},{a:'b',dist:2}]),['a','b']);
 assert.deepEqual(C.elusMeneur({combien:'un'},[{a:'c',dist:3},{a:'a',dist:1}]),['a']);
 assert.equal(C.elusMeneur({combien:'tous'},[{a:'c',dist:3},{a:'a',dist:1}]).length,2);assert.deepEqual(C.elusMeneur({},[]),[]);
 assert.ok(page.includes("function defOf(a){return defenseOf(a,items())+bonusFiche(a).def+auraMeneur(a,'def')}")&&page.includes("function degatsDe(a){return (Number(a&&a.dmg)||0)+bonusFiche(a).dmg+auraMeneur(a,'dmg')}")
  &&page.includes("function competenceDe(a,k){return (Number(a&&a.skills&&a.skills[k])||0)+(bonusFiche(a).skills[k]||0)}")
  &&page.includes("function auraMeneur(a,quoi){")&&page.includes("const size=mapSize();if(!size.width)return 0;let total=0,murs=null;")
  &&page.includes("if(elusMeneur(params,candidats).includes(a))total+=Math.max(1,params.valeur|0)})});")
  &&page.includes("if(portee==='vue')return hasLineOfSight(m,o,actors.filter(x=>x!==m&&x!==o&&alive(x)),size,tokenPx());")
  &&page.includes(" const jet=skillRoll(competenceDe(a,i),d6);")&&page.includes("useOwnDamage===false?0:degatsDe(a);")
  &&page.includes(" const degats=(p.etat&&p.mode==='place')?0:degatsDe(a)+(p.bonus|0);")&&page.includes("const n=degatsDe(e);applyDamage(a,n);")
  &&src.includes("const aura=view==='mj'&&typeof auraMeneur==='function'?auraMeneur(a,'pv'):(Number(a.auraPv)||0);")
  &&src.includes(" const max=pvMaximum(catalog.classes,a,catalog.talents,catalog.items)+aura;")&&src.includes("writeStat(a,'max',max);if(delta>0)a.hp=Math.min(a.max,a.hp+delta);return true}")
  &&src.includes("function synchronisePV(){if(view!=='mj')return false;")&&src.includes("render=function(){if(!loading&&synchronisePV())scheduleSave();originalRender();")
  &&vivant.includes("'activeAttack','auraPv',")&&fs.readFileSync('shared.js','utf8').includes("'shieldId','auraPv'];")
  &&src.includes("const liste=(a.talents||[]).map(talent).filter(t=>t&&t.effet!=='bonus');")&&src.includes("if(t.effet==='bonus'){const p=paramsTalent(t);b.classList.add('bonus');")
  &&src.includes(" ecrire('.stat-tile.t-dmg strong','+'+degatsDe(a));")&&src.includes("  if(!competenceDe(a,k))return;")&&feuille.includes('.arbre-noeud.bonus{--teinte:#b8862b}'),'les caractéristiques telles qu’elles jouent, et le Meneur');}
/* Les zones : toute étendue close par la matière et par les portes — ouvertes ou fermées —
   en est une ; les miettes ne comptent pas ; le MJ les voit d'un bouton. */
{const mur={anneaux:[[[49,0],[51,0],[51,100],[49,100]]]};
 const z=C.calculeZones([mur],[[[49,40],[51,40],[51,60],[49,60]]],100,50);
 assert.equal(z.compte,2);assert.equal(C.zoneAu(z,10,10),1);assert.equal(C.zoneAu(z,90,90),2);assert.equal(C.zoneAu(z,50,50),0,'dans la porte : aucune zone');
 assert.equal(C.zoneAu(z,50,10),0,'dans le mur : aucune zone');assert.equal(C.zoneAu(z,-5,200),1,'hors de la carte, la case la plus proche');
 assert.deepEqual([...z.tailles].map(n=>n>0),[false,true,true]);
 const ouvert=C.calculeZones([{anneaux:[[[49,0],[51,0],[51,40],[49,40]]]}],[],100,50);
 assert.equal(ouvert.compte,1);assert.equal(C.zoneAu(ouvert,10,10),C.zoneAu(ouvert,90,90),'un mur qui ne ferme rien ne partage rien');
 // Un trou dans la matière est une zone à part ; une miette de mur ne compte pas.
 const creux={anneaux:[[[10,10],[90,10],[90,90],[10,90]],[[40,40],[60,40],[60,60],[40,60]]]};
 const zc=C.calculeZones([creux],[],100,50);
 assert.equal(zc.compte,2);assert.equal(C.zoneAu(zc,50,50),2,'le trou');assert.equal(C.zoneAu(zc,5,5),1,'le tour');assert.equal(C.zoneAu(zc,20,20),0);
 const miette=C.calculeZones([{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[50,50],[52,50],[52,52],[50,52]]]}],[],100,50);
 assert.equal(miette.compte,0,'une case ou deux ne font pas une zone');
 assert.equal(C.calculeZones([],[],10,5).compte,1);assert.equal(C.zoneAu(null,1,1),0);
 assert.ok(cartes.includes("const zonesBtn=icone('zones-eye','▦','Voir les zones de la carte');")&&cartes.includes("fogBar.append(fogReset,fogAll,eyeBtn,zonesBtn,lockBtn);")
  &&cartes.includes("function zonesDe(m){if(!m)return null;")&&cartes.includes("zonesCache={cle,zones:calculeZones(matiereDe(m),portes,cols,rows,10,m.zonesCoupures,m.zonesLiens)}}")
  &&cartes.includes("function zoneDe(a){const m=currentMap();return m&&a?zoneAu(zonesDe(m),a.x,a.y):0}")&&cartes.includes("function memeZone(a,b){")
  &&cartes.includes("if(!zonesVisibles||!m||view!=='mj'){cv.style.display='none';noms.hidden=true;return}")
  &&cartes.includes("zonesBtn.hidden=!m;zonesBtn.classList.toggle('on',zonesVisibles);")&&feuille.includes('#map-zones,#map-zones-noms{position:absolute;inset:0;'),'les zones se voient d’un bouton, et se retiennent');}
/* Maj + clic dans la liste : tout ce qui va de l'actif à la ligne cliquée, bornes comprises. */
assert.ok(page.includes(" b.dataset.index=i;")&&page.includes("b.onclick=e=>{if(e.shiftKey&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&selected!==null&&selected!==i&&markRange(i))return;onGesture(gestureOf(e),i)};")
 &&page.includes("function markRange(i){const lignes=[...document.querySelectorAll('#actors .actor[data-index]')].map(b=>Number(b.dataset.index));")
 &&page.includes(" marked=new Set(plage);render();return true}"),'la plage de sélection');
/* Les raretés et les bonus d'équipement : une pièce se teinte de sa rareté, plus de sa
   famille ; portée, elle confère ses bonus, une ligne chacun, cumulables — deux anneaux,
   deux fois. Les carrés ont grandi d'un tiers, le logo avec, les dés non. */
{const it=[{id:'w',category:'weapon',hands:1,rarete:'rare',bonus:[{carac:'dmg',valeur:2},{carac:'comp',valeur:1,comp:'3'}]},
  {id:'r',category:'armor',slot:'anneau',bonus:[{carac:'pv',valeur:3},{carac:'def',valeur:1}]},{id:'x',category:'armor',slot:'torse',rarete:'zzz',bonus:'nope'},{id:'s',category:'armor',slot:'shield',bonus:[{carac:'endu',valeur:1},{carac:'vie',valeur:1}]}];
 const a={weapons:['w'],armures:['r','r','x'],shieldId:'s',vie:6,endu:3,talents:[]};
 assert.deepEqual(C.bonusEquipement(a,it),{pv:6,endu:1,vie:1,def:2,dmg:2,skills:[0,0,0,1,0,0,0,0]});
 assert.equal(C.rareteDe(it[0]),'rare');assert.equal(C.rareteDe(it[2]),'commun');assert.equal(C.rareteDe(null),'commun');assert.equal(C.NOM_RARETE('epique'),'Épique');assert.equal(C.NOM_RARETE('zzz'),'Commun');
 assert.deepEqual(C.normaliseBonusEquip(it[2].bonus),[]);assert.deepEqual(C.normaliseBonusEquip([{carac:'zzz',valeur:0,comp:'99'},null,{carac:'comp',valeur:150,comp:'2'}]),[{carac:'pv',valeur:1,comp:'7'},{carac:'comp',valeur:99,comp:'2'}],'bornés : la compétence à la dernière, la valeur à 99');
 assert.equal(C.pvMaximum([],a,[],it),(6+1)*(3+1)+6);assert.equal(C.vieDe(a,[],it),7);assert.equal(C.enduDe(a,[],it),4);
 assert.deepEqual(C.bonusDe(a,[],it),{pv:6,endu:1,vie:1,def:2,dmg:2,skills:[0,0,0,1,0,0,0,0]});
 assert.deepEqual(C.bonusDe(a,[]),C.bonusVide(),'sans équipement passé, les talents seuls — ici aucun');
 assert.equal(C.libelleBonus({carac:'def',valeur:1}),'+1 DEF');
 assert.ok(src.includes("o.rarete=rareteDe(o);o.bonus=normaliseBonusEquip(o.bonus);")&&src.includes("+sel('Rareté','rarete',rareteDe(a),RARETES)")
  &&src.includes("if(f.rarete)a.rarete=rareteDe({rarete:f.rarete.value});")&&src.includes(" if($('item-bonus'))a.bonus=lireBonusItem();")
  &&src.includes('function dessineBonusItem(){')&&src.includes('function lireBonusItem(){')&&src.includes("teinte:TEINTE_RARETE[rareteDe(o)]||TEINTE_OBJET.object,")
  &&src.includes("p.className='cat-pill gear-carre k-'+col+' r-'+rareteDe(o)+")&&src.includes("p.className='cat-pill k-'+col+' r-'+rareteDe(o)+")
  &&src.includes("if(rareteDe(o)!=='commun')ligne(NOM_RARETE(rareteDe(o)),'gear-rarete r-'+rareteDe(o));")&&src.includes("normaliseBonusEquip(o.bonus).forEach(b=>ligne(libelleBonus(b),'gear-bonus'));")
  &&page.includes("function bonusFiche(a){return bonusDe(a,typeof catalog!=='undefined'?catalog.talents:[],items())}")
  &&feuille.includes('.cat-pill.r-rare{background:#cfe0f5;')&&feuille.includes('.cat-pill.gear-carre .logo-equip{width:38px;height:38px;margin:0}')&&feuille.includes('.cat-pill.gear-carre .die-sq,.cat-pill.gear-carre .pips .etat-inflige{flex-basis:19px;width:19px;height:19px}'),'rareté et bonus : formulaire, carrés, bulle, moteur');}
/* Le corps de l'aventurier sur sa page : les emplacements et ce qu'ils portent, le sac
   dessous ; on glisse une pièce du sac sur le corps pour l'équiper, du corps sur le sac
   pour la reposer. Équiper de plus, reposer : les deux moitiés du basculement. */
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const items=[{id:'e',name:'Épée',category:'weapon',hands:1},{id:'g',name:'Grande hache',category:'weapon',hands:2},{id:'b',name:'Bouclier',category:'armor',slot:'shield'},{id:'r',name:'Anneau',category:'armor',slot:'anneau'},{id:'t',name:'Cuir',category:'armor',slot:'torse'}];
 const ctx={catalog:{items},objetDe:id=>items.find(o=>o.id===id),gearCount:(a,id)=>(a.weapons||[]).filter(x=>x===id).length,weaponHands:C.weaponHands,emplacementDe:C.emplacementDe,armuresDe:C.armuresDe,placesLibres:C.placesLibres};
 vm.createContext(ctx);vm.runInContext(morceau('function mainsPrises(a)','function toggleEquip(a,o)')+morceau('function placeDe(o)','/* Équiper une pièce de plus')+morceau('function equiperPiece(a,o)','// Le corps, stylisé'),ctx);
 const a={weapons:[],armures:[],shieldId:'',inventaire:['e','e','g','b','r','r','r','r','t']};
 assert.equal(ctx.placeDe(items[0]),'main');assert.equal(ctx.placeDe(items[2]),'main');assert.equal(ctx.placeDe(items[3]),'anneau');
 assert.equal(ctx.equiperPiece(a,items[0]),true);assert.equal(ctx.equiperPiece(a,items[0]),true,'la seconde épée dans l’autre main');assert.equal(JSON.stringify(a.weapons),'["e","e"]');
 assert.equal(ctx.equiperPiece(a,items[0]),false,'pas de troisième exemplaire');
 assert.equal(ctx.equiperPiece(a,items[2]),true);assert.equal(JSON.stringify([a.weapons,a.shieldId]),'[["e"],"b"]','le bouclier prend la place de la plus ancienne épée');
 assert.equal(ctx.equiperPiece(a,items[1]),true);assert.equal(JSON.stringify([a.weapons,a.shieldId]),'[["g"],""]','deux mains : tout le reste cède');
 assert.equal(ctx.reposerPiece(a,items[1]),true);assert.equal(JSON.stringify(a.weapons),'[]');assert.equal(ctx.reposerPiece(a,items[1]),false);
 [0,1,2].forEach(()=>assert.equal(ctx.equiperPiece(a,items[3]),true));assert.equal(ctx.equiperPiece(a,items[3]),true,'un quatrième anneau : le plus ancien cède');assert.equal(a.armures.filter(x=>x==='r').length,3);
 assert.equal(ctx.reposerPiece(a,items[3]),true);assert.equal(a.armures.filter(x=>x==='r').length,2);
 assert.equal(ctx.equiperPiece(a,items[4]),true);assert.equal(ctx.reposerPiece(a,items[4]),true);assert.equal(ctx.reposerPiece(a,items[4]),false);
 assert.equal(ctx.equiperPiece(a,{id:'zz',category:'object'}),false);assert.equal(ctx.reposerPiece(a,null),false);
 assert.ok(src.includes('function corpsEtSac(a){')&&src.includes(" c.append(tete,puces,chiffres,titreComp,comps,titreKit,corpsEtSac(a),titreTal,talentPills(a));return c}")
  &&src.includes("function carreDeFiche(a,o,n,tout,portes,peutEquiper,corps){")&&src.includes("const p=carreDeFiche(a,o,n,tout,portes,peutEquiper);")
  &&src.includes("  recoit(corps,(o,g)=>!g.porte&&equiperPiece(a,o));\n  recoit(sac,(o,g)=>g.porte&&reposerPiece(a,o))}")
  &&src.includes("if(corps!==undefined&&equipable){p.draggable=true;")&&src.includes("const SILHOUETTE='<svg class=\"silhouette\"")
  &&src.includes("['main','Main gauche',mains[1]||null],['torse','Torse',seul('torse')],['main','Main droite',mains[0]||null],")
  &&feuille.includes('.corps{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));')&&feuille.includes('.corps .place.bottes{grid-column:2}')
  &&feuille.includes('.corps .gear-carre.deux-mains{opacity:.45;pointer-events:none}')&&feuille.includes('.sac.survol{'),'le corps et le sac, et le glisser-déposer');}
/* Les coupures et les liens du MJ : une coupure est un trait d'une case qui sépare — un
   seuil, une arche — sans rien bloquer d'autre ; un lien fond deux zones en une. Les deux
   voyagent avec la carte, bornés. */
{const troue={anneaux:[[[49,0],[51,0],[51,40],[49,40]]]},mur={anneaux:[[[49,0],[51,0],[51,100],[49,100]]]};
 assert.equal(C.calculeZones([troue],[],320,180).compte,1,'un mur qui ne ferme rien');
 const zc=C.calculeZones([troue],[],320,180,10,[{x1:50,y1:40,x2:50,y2:100}],[]);
 assert.equal(zc.compte,2,'la coupure au seuil sépare');assert.notEqual(C.zoneAu(zc,10,10),C.zoneAu(zc,90,90));
 const zd=C.calculeZones([],[],320,180,10,[{x1:0,y1:0,x2:100,y2:100}],[]);
 assert.equal(zd.compte,2,'une coupure en diagonale sépare aussi : l’inondation ne passe pas entre deux cases en coin');
 const zl=C.calculeZones([mur],[[[49,40],[51,40],[51,60],[49,60]]],320,180,10,[],[{x1:10,y1:10,x2:90,y2:90}]);
 assert.equal(zl.compte,1,'le lien fond les deux salles');assert.equal(C.zoneAu(zl,10,10),C.zoneAu(zl,90,90));
 assert.equal(C.calculeZones([mur],[[[49,40],[51,40],[51,60],[49,60]]],320,180,10,[],[{x1:10,y1:10,x2:50,y2:50}]).compte,2,'un lien depuis une porte ne lie rien');
 assert.deepEqual(C.cleanSegments([{x1:-5,y1:200,x2:'3',y2:'x'},null,'z']),[{x1:0,y1:100,x2:3,y2:0}]);
 assert.equal(C.cleanSegments(Array.from({length:300},()=>({x1:1,y1:1,x2:2,y2:2}))).length,200);
 const nettoyee=C.cleanMap({name:'z',zonesCoupures:[{x1:1,y1:1,x2:2,y2:2}],zonesLiens:'nope'});
 assert.deepEqual(nettoyee.zonesCoupures,[{x1:1,y1:1,x2:2,y2:2}]);assert.deepEqual(nettoyee.zonesLiens,[]);
 assert.ok(cartes.includes("KINDS={matiere:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire',objet:'Objet',coupure:'Séparation de zones',lien:'Regroupement de zones'}")
  &&cartes.includes('<button data-tool="zones">Zones</button><button data-tool="separer">Séparer les zones</button><button data-tool="regrouper">Regrouper les zones</button>')&&cartes.includes("const OUTILS_ZONES=['zones','separer','regrouper'];")
  &&cartes.includes(" m.zonesCoupures??=[];m.zonesLiens??=[];")&&cartes.includes(' dessineTraits();dessineZonesEditeur();')
  &&cartes.includes("if(d.kind==='coupure')return (m.zonesCoupures||[])[d.i];if(d.kind==='lien')return (m.zonesLiens||[])[d.i];")
  &&cartes.includes("else if(d.kind==='coupure')m.zonesCoupures.splice(d.i,1);else if(d.kind==='lien')m.zonesLiens.splice(d.i,1);")
  &&cartes.includes('function dessineZonesEditeur(){')&&cartes.includes('function segmentSous(p){')&&cartes.includes('function clicZones(p){')
  &&cartes.includes("if(enZones()&&e.button===0){clicZones(p);e.preventDefault();return}")
  &&cartes.includes("if(mode==='regrouper'){const z=zonesDe(m),a=zoneAu(z,seg.x1,seg.y1),b=zoneAu(z,seg.x2,seg.y2);if(!a||!b||a===b){renderCanvas();return}")
  &&cartes.includes("if(enZones()&&zoneTrait&&!mapDrag){zoneVise=pct(e);dessineZonesEditeur();return}")
  &&cartes.includes("e.preventDefault();zoneTrait=zoneVise=null;dessineZonesEditeur()});")
  &&cartes.includes('function peindreZones(cv,noms,z,surnoms,edite){if(!z)return;')&&cartes.includes("peindreZones(cv,noms,z,nomsDesZones(m,z),(n,x,y,span)=>{")
  &&feuille.includes('.calque-zones .coupure{stroke:#e04a2f;')&&feuille.includes('.calque-zones .lien{stroke:#2f8a63;')&&feuille.includes('#map-tools [data-tool=separer]{'),'l’outil Zones : voir, séparer, regrouper, choisir, effacer');}
/* Le domaine : deux calques de plus — En feu, Ruines — qui ne se construisent pas, et un état
   par bâtiment qui dit lequel le découpe. */
{const d=C.normaliseDomaine({batiments:[{nom:'Forge',etape:2,etat:'feu'},{nom:'Temple',etat:'zzz'},{nom:'Tour',etape:1,etat:'ruine'}]});
 assert.equal(C.CALQUES_DOMAINE.length,6);assert.deepEqual(C.CALQUES_DOMAINE.slice(4).map(c=>c[0]),['feu','ruine']);assert.equal(d.carte.calques.length,6);
 assert.deepEqual(d.batiments.map(b=>b.etat),['feu','','ruine']);assert.equal(C.nouveauBatiment('x').etat,'');
 assert.equal(C.calqueDuBatiment([null,'a',null,null,'F','R'],d.batiments[0]),4,'en feu, le calque du feu');
 assert.equal(C.calqueDuBatiment([null,'a',null,null,null,'R'],d.batiments[0]),1,'sans calque du feu, celui de l’étape — le plus proche en dessous');
 assert.equal(C.calqueDuBatiment(['a',null,null,null,'F','R'],d.batiments[2]),5);assert.equal(C.calqueDuBatiment(['a',null,null,null,'F','R'],d.batiments[1]),0);
 assert.equal(C.calqueDisponible(['a',null,null,null,'F','R'],3),0,'le fond ne prend jamais un état pour une étape');
 assert.equal(C.NOM_ETAT_BATIMENT('feu'),'En feu');assert.equal(C.NOM_ETAT_BATIMENT(''),'Intact');
 const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("+CALQUES_DOMAINE.map(([k,nom],i)=>'<span class=\"dom-calque'+(i>=4?' dom-calque-etat':'')+'\">")&&fief.includes(" CALQUES_DOMAINE.forEach((_,i)=>{const on=!!d.carte.calques[i];")
  &&fief.includes("const etat=document.createElement('select');etat.className='dom-etat-choix';")&&fief.includes(" tete.append(nom,et,etat,boutonConstruire(b),recul);boite.append(tete);")
  &&fief.includes("if(b.etat){const x=document.createElement('span');x.className='dom-etat etat-'+b.etat;")&&feuille.includes('.dom-zone.etat-feu{--t:#d9532b}'),'En feu et Ruines : les calques, l’état sur la fiche et la carte');}
/* Les zones se renomment d'un clic sur leur numéro, dans l'éditeur ; le nom tient par un point
   de la zone et voyage avec la carte. Le nom d'un bâtiment du domaine se glisse où l'on veut ;
   les contours ne se montrent que sur demande. L'armurerie montre ses pièces en carrés. */
{assert.deepEqual(C.cleanEtiquettes([{x:-1,y:300,nom:'  Cave  '},{x:1,y:1,nom:''},null,{x:2,y:2,nom:'x'.repeat(30)}]),[{x:0,y:100,nom:'Cave'},{x:2,y:2,nom:'x'.repeat(12)}]);
 assert.deepEqual(C.cleanMap({name:'z',zonesNoms:[{x:5,y:5,nom:'Salle'}]}).zonesNoms,[{x:5,y:5,nom:'Salle'}]);assert.deepEqual(C.cleanMap({name:'z'}).zonesNoms,[]);
 const d=C.normaliseDomaine({batiments:[{nom:'Forge',etiquette:[120,'7']},{nom:'Temple',etiquette:'x'},{nom:'Tour'}]});
 assert.deepEqual(d.batiments.map(b=>b.etiquette),[[100,7],null,null]);assert.equal(C.nouveauBatiment('x').etiquette,null);
 const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(cartes.includes("function nomsDesZones(m,z){")&&cartes.includes("function renommeZone(m,z,n,x,y,nom){nom=String(nom||'').trim().slice(0,12);")
  &&cartes.includes(" if(nom&&nom!==String(n))m.zonesNoms.push({x,y,nom});")&&cartes.includes(" m.zonesCoupures??=[];m.zonesLiens??=[];m.zonesNoms??=[];")
  &&cartes.includes("e.textContent=(surnoms&&surnoms.get(n))||String(n);")&&cartes.includes("if(edite){e.classList.add('editable');")
  &&cartes.includes("peindreZones(cv,noms,z,nomsDesZones(m,z))}")&&cartes.includes("const zonesMode=()=>mapTool==='separer'?'separer':mapTool==='regrouper'?'regrouper':'voir';")
  &&feuille.includes('.zones-noms span.editable{pointer-events:auto;cursor:text}'),'les zones se renomment, et les trois outils sont des boutons');
 assert.ok(fief.includes('function rendEtiquetteDeplacable(e,b,boite,opts){')&&fief.includes("const c=b.etiquette||centroide(b.zone);if(!c)return;")
  &&fief.includes("if(opts.deplace||opts.clic)rendEtiquetteDeplacable(e,b,etiquettes,opts);")
  &&fief.includes("...(domOutil==='select'?{deplace:(b,pt)=>{pushDomUndo();b.etiquette=pt;renderDomaineEditeur();sauveDomaine()},")
  &&fief.includes("deplace:(b,pt)=>{b.etiquette=pt;renderDomaine();sauveDomaine()},clic:b=>{domPageSel=domPageSel===b.id?null:b.id;renderDomaine()}});")
  &&fief.includes('<button id="dom-contours" title="Montrer ou cacher le contour des bâtiments">▦ Contours</button>')&&fief.includes("plan.classList.toggle('sans-contours',!domContours);")
  &&feuille.includes('#dom-plan.sans-contours .dom-zone{stroke:transparent;fill:transparent}')&&feuille.includes('.dom-etiquette.deplacable{pointer-events:auto;cursor:grab;'),'le nom d’un bâtiment se glisse, les contours sur un bouton');
 assert.ok(src.includes("function armoryRow(a,i){const carte=document.createElement('div');carte.className='cat-carte';")
  &&src.includes(" const p=gearCarre(a,1,0);p.classList.remove('dispo');const coche=p.querySelector('.marque-porte');if(coche)coche.remove();")
  &&src.includes("bloc.className='cat-col armurerie-grille';")&&src.includes(" outils.append(crayon,double);carte.append(p,nom,outils);return carte}")
  &&feuille.includes('.cat-col.armurerie-grille{display:flex;flex-wrap:wrap;')&&feuille.includes('.cat-carte .nom-carte{'),'l’armurerie en carrés teintés de leur rareté');}
/* L'écu de DEF se dessine : l'écu vide et le chiffre en Killam Bold, noir pur, mesuré sur la
   police, pour n'importe quelle valeur — deux chiffres se serrent. Une fois par valeur ; en
   attendant la police et l'écu vide, l'écu peint, puis tout se redessine. */
assert.ok(page.includes('function ecuDef(valeur){')&&page.includes("if(ecusDessines.has(texte))return ecusDessines.get(texte);")
 &&page.includes("if(!ecuPret){preparerEcus();return imgUrl('DEF '+(Number.isInteger(n)&&n>=0&&n<=6?n:'VIDE')+'.png')}")
 &&page.includes("ctx.font='700 100px Killam';const m=ctx.measureText(texte);")
 &&page.includes(" const F=Math.min(ECU_HAUTEUR*.604/Math.max(.01,haut),ECU_LARGEUR*.72/Math.max(.01,large));")
 &&page.includes("ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='alphabetic';")
 &&page.includes("ctx.fillText(texte,ECU_LARGEUR*.493,ECU_HAUTEUR*.483+(mm.actualBoundingBoxAscent-mm.actualBoundingBoxDescent)/2);")
 &&page.includes("const police=document.fonts&&document.fonts.load?document.fonts.load('700 100px Killam'):Promise.resolve();")
 &&page.includes("Promise.all([police,image]).then(([,im])=>{if(!im)return;ecuVide=im;ecuPret=true;ecusDessines.clear();")
 &&page.includes("const im=document.createElement('img');im.src=ecuDef(valeur);")&&!page.includes("const b=document.createElement('b');b.textContent=valeur;w.append(b)")
 &&src.includes(" const im=ecu.querySelector('img');if(im)im.src=ecuDef(valeur);")&&src.includes(" const b=ecu.querySelector('b');if(b)b.remove()}")
 &&!src.includes("imgUrl('DEF '+(peint?n:'VIDE')+'.png')")&&page.includes("@font-face{font-family:'Killam';src:url('./fonts/killam-bold.woff2"),'l’écu de DEF se dessine en Killam, pour toute valeur');
console.log('1363 vérifications passées : dimensions PNG/JPEG/WebP, catalogue, dégâts, édition de fiche, contact, ligne de vue et matière exacte.');
