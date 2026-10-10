const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
/* Chaque source ne se lit qu'une fois : les tests relisaient editor.js, index.html et editor.css des
   centaines de fois. */
{const lire=fs.readFileSync.bind(fs),lus=new Map();fs.readFileSync=(f,...r)=>{if(typeof f!=='string'||r[0]!=='utf8'||!/\.(?:js|html|css)$/.test(f))return lire(f,...r);
 if(!lus.has(f))lus.set(f,lire(f,...r));return lus.get(f)}}
/* v0.518 — Les camps des PNJ, v0.519 la bourse aux dés : toute machine virtuelle des contrôles les connaît, comme la page. */
{const C=require('./combat.js'),cree=vm.createContext.bind(vm);vm.createContext=(o,...r)=>{if(o&&typeof o==='object')for(const k of ['ALIGNEMENTS','alignementDe','campDe','duCoteTroupe','memeCamp','hostiles','normaliseBourse','tireBourse','phraseRichesses','compteEtat'])if(!(k in o))o[k]=C[k];return cree(o,...r)}}
const editor=fs.readFileSync('editor.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(editor.slice(editor.indexOf('function imageDimensions'),editor.indexOf('let imageJob')),ctx);
const png=new Uint8Array(24),v=new DataView(png.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,4096);v.setUint32(20,2048);assert.equal(ctx.imageDimensions(png).join(','),'4096,2048');
const jpg=new Uint8Array([255,216,255,192,0,7,8,2,0,4,0,255,217]);assert.equal(ctx.imageDimensions(jpg).join(','),'1024,512');
const webp=new Uint8Array(30);webp.set(Buffer.from('RIFF'));webp.set(Buffer.from('WEBPVP8X'),8);webp[24]=255;webp[25]=1;webp[27]=255;assert.equal(ctx.imageDimensions(webp).join(','),'512,256');assert.throws(()=>ctx.imageDimensions(new Uint8Array(30)));
const c={window:{}};vm.runInNewContext(fs.readFileSync('catalog.js','utf8'),c);const cat=c.window.AMERTUME_CATALOG;assert.equal(cat.classes.length,4);
['Destructeur','Gardien','Ombrelame','Mystique'].forEach(n=>{const k=cat.classes.find(x=>x.name===n);
 assert.ok(k,'classe manquante : '+n);assert.match(k.tint,/^#[0-9a-f]{6}$/);assert.ok(k.pv>0);
 assert.ok(k.id)});
assert.equal(new Set(cat.classes.map(k=>k.id)).size,4);
assert.equal(cat.items.filter(i=>i.category==='weapon').length,14);assert.equal(cat.items.filter(i=>i.category==='armor').length,5);assert.equal(cat.monsters.length,4);assert.equal(cat.monsters.find(m=>m.name==='Mystique déchu').attacks[0].dice.blue,2);
const {resolveAttack:r}=require('./combat.js');assert.equal(r({dice:[[5,0]],def:3,dmg:0,roll:()=>2}).damage,5); // Le 5 passe la DEF 3.
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
const lire=(inventaire,brouillon={hero:true})=>{const t={structuredClone,keys:['white','bone','red','blue','green','black','yellow'],skillNames:Array(8).fill(''),templateIndex:null,draft:brouillon,attackDraft:[{dice:{white:2}}],readAttacks(){},$:()=>({elements}),num:(v,min=0,max=99999)=>Math.max(min,Math.min(max,Number(v)||0)),poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,armuresDe:gearApi.armuresDe,emplacementDe:gearApi.emplacementDe,placesLibres:gearApi.placesLibres,placesEmplacement:gearApi.placesEmplacement,EMPLACEMENTS:gearApi.EMPLACEMENTS,portesA:gearApi.portesA,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,defPlafonnee:gearApi.defPlafonnee,catalog:{items:inventaire}};vm.createContext(t);vm.runInContext(read+';result=readActor()',t);return t.result};
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
assert.deepEqual(gearApi.attackChoices(bete,ARSENAL).map(x=>x.name),['Épée ×2','Griffes','Souffle']);   // Un adversaire : deux armes à une main frappent ensemble (v0.611).
assert.deepEqual(gearApi.attackChoices({...bete,weapons:['e','d']},ARSENAL).map(x=>x.name),['Épée + Dague','Griffes','Souffle']);   // Deux armes différentes aussi.
assert.deepEqual(gearApi.attackChoices({...bete,hero:true,weapons:['e','d']},ARSENAL).map(x=>x.name),['Épée + Dague','Griffes','Souffle']);   // Un aventurier les tient ensemble.
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
assert.equal(gearApi.weaponHands({}),1);                     // Sans précision, une main — comme l'affichent le formulaire et la bulle.
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
assert.equal(gearApi.chosenAttack(bete,ARSENAL).dice.white,4);            // Chez un adversaire aussi, deux armes à une main cumulent (v0.611).
assert.equal(gearApi.chosenAttack({...bete,hero:true},ARSENAL).dice.white,4);   // Chez un aventurier, deux exemplaires cumulent.
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
 assert.equal(orbesPermis(tenus),2);assert.deepEqual(desOrbe(tenus),{n:3,couleur:'black',nom:'Mortel',plus:0});assert.equal(desOrbe([]),null);
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
 assert.deepEqual(paramsTalent({effet:'orbesfeu'}),{etat:'Feu',quand:'degats'});
 assert.deepEqual(paramsTalent({effet:'orbesfeu',params:{etat:'Gel'}}),{etat:'Gel',quand:'degats'});
 assert.deepEqual(paramsTalent({effet:'orbesfeu',params:{etat:'Coma'}}),{etat:'Feu',quand:'degats'});
 assert.deepEqual(paramsTalent({effet:'orbesfeu',params:{etat:'Foudre',quand:'toujours'}}),{etat:'Foudre',quand:'toujours'});
 // Paliers en sommeil : l'état part quand l'orbe blesse, ou toujours, selon « Quand ».
 assert.match(phraseTalent('orbesfeu'),/infligent <b>Feu<\/b> quand ils infligent des <b>dégâts<\/b>/);
 assert.match(phraseTalent('orbesfeu',{etat:'Foudre',quand:'toujours'}),/<b>Foudre<\/b> à chaque orbe, <b>même sans dégâts<\/b>/);
 {const {etatOrbeAuPalier}=require('./combat.js');
  assert.equal(etatOrbeAuPalier([{code:TALENTS_CODES.orbesfeu,params:{etat:'Feu',quand:'degats'},talent:{}}]).blesse,true);
  assert.equal(etatOrbeAuPalier([{code:TALENTS_CODES.orbesfeu,params:{etat:'Foudre',quand:'toujours'},talent:{}}]).blesse,false);}
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
 assert.equal(TALENTS_CODES.gardien.type,'mait');assert.match(phraseTalent('gardien'),/<b>au contact<\/b> reçoit l’état <b>Gardé<\/b>/);
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
 assert.ok(src.includes("const l=c==='weapon'||c==='armor'?[...d,...LOGOS_EQUIPEMENT]:c==='ammo'?[...d,...LOGOS_EQUIPEMENT,...LOGOS_OBJET]:c==='treasure'||c==='ressource'||c==='restes'?[...d,...LOGOS_OBJET,...LOGOS_RESSOURCES,...LOGOS_EQUIPEMENT]:[...d,...LOGOS_OBJET];")
  &&src.includes("...logosItem(a).map(l=>[l,nomLogo(l)])")&&src.includes("a.logo=logosItem(a).includes(f.logo.value)||estLogoDossier(f.logo.value)?f.logo.value:''")
  &&src.includes("logoImage(o&&o.logo,[...LOGOS_EQUIPEMENT,...LOGOS_OBJET,...LOGOS_RESSOURCES],cls)")&&src.includes("replace(/^(weapon|spell|item|attack)_/,'')"),'les objets choisissent parmi les item_*');
 // Les logos de talents déclarés sont exactement les spell_*.png du dossier.
 {const ma=src.match(/const LOGOS_ATTAQUE=(\[[^\]]*\]);/);assert.ok(ma,'LOGOS_ATTAQUE introuvable');
  const attaques=fs.readdirSync('img').filter(f=>/^attack_.*\.png$/i.test(f)).map(f=>f.replace(/\.png$/i,'')).sort();
  assert.deepEqual(JSON.parse(ma[1].replace(/'/g,'"')).sort(),attaques,'LOGOS_ATTAQUE doit lister img/attack_*.png : '+attaques.join(', '));
  assert.ok(src.includes('const LOGOS_TOUS=[...LOGOS_ATTAQUE,...LOGOS_EQUIPEMENT,...LOGOS_TALENT,...LOGOS_OBJET,...LOGOS_RESSOURCES,...LOGOS_ETATS,...LOGOS_DIVERS];')
   &&src.includes('function logoAttaque(l,cls){return logoImage(l,LOGOS_TOUS,cls)}')
   &&src.includes("logosDeAttaque(at).slice(0,1).forEach(l=>{const im=logoAttaque(l,'bouton');if(im)logos.append(im)});")
   &&src.includes("...iconesPlanches(),...LOGOS_TOUS,...logosDesDossiers()])].map(l=>[l,nomLogo(l)])]))+'</div>'")
   &&src.includes("logos:logoValide(f['ai'+i].value)?[f['ai'+i].value]:[],")
   &&src.includes("...(etats=>({etats,etat:etats[0]||''}))([...form.querySelectorAll('input[name=\"ax'+i+'\"]:checked')].map(x=>x.value).filter(e=>ETATS_JEU.includes(e))),")
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
 assert.deepEqual(paramsTalent({effet:'lamevent'}),{bonus:0,etat:'',mode:'plus'});
 assert.deepEqual(paramsTalent({effet:'lamevent',params:{cibles:'tous',bonus:'7',etat:'Feu',mode:'place'}}),
  {bonus:7,etat:'Feu',mode:'place'});
 /* Un choix hors de la liste, un nombre hors des bornes, ou un talent enregistré avant que
    ces réglages n'existent : chacun retombe sur son défaut sans rien casser. */
 assert.deepEqual(paramsTalent({effet:'lamevent',params:{cibles:1,bonus:-5,etat:'Dragon',mode:'x'}}),
  {bonus:0,etat:'',mode:'plus'});
 assert.equal(paramsTalent({effet:''}),null);
 assert.equal(reglageTalent(code,{},'inexistant'),undefined);
 /* La phrase d'un effet est bâtie par le moteur, réglages en gras : la bibliothèque et la
    fiche du talent la lisent au même endroit, elle ne peut donc pas mentir. */
 const {phraseTalent}=require('./combat.js');
 assert.match(phraseTalent('lamevent'),/<b>bonus de dégâts<\/b> à <b>un<\/b> adversaire au contact/);
 assert.match(phraseTalent('lamevent',{bonus:2,etat:'Gel'}),
  /<b>bonus de dégâts \+ 2<\/b> et <b>Gel<\/b> à <b>un<\/b> adversaire au contact/);
 // Deux adversaires, ou tous : l'amélioration d'Ombrelame.
 assert.match(phraseTalent('lameventcibles'),/<b>deux<\/b> adversaires au contact/);
 assert.match(phraseTalent('lameventcibles',{cibles:'tous'}),/<b>tous les adversaires<\/b> au contact/);
 // L'état à la place des dégâts : la phrase le dit, et le moteur ne retire alors aucun PV.
 assert.match(phraseTalent('lamevent',{etat:'Feu',mode:'place'}),
  /inflige <b>Feu<\/b> à <b>un<\/b> adversaire au contact, <b>sans dégâts<\/b>/);
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
 poolFrom:d=>[d.white||0,0,0,0,0,0,0],equippedPool:gearApi.equippedPool,equippedDef:gearApi.equippedDef,armuresDe:gearApi.armuresDe,emplacementDe:gearApi.emplacementDe,placesLibres:gearApi.placesLibres,placesEmplacement:gearApi.placesEmplacement,EMPLACEMENTS:gearApi.EMPLACEMENTS,portesA:gearApi.portesA,defenseOf:gearApi.defenseOf,chosenAttack:gearApi.chosenAttack,statesOf:gearApi.statesOf,setState:gearApi.setState,defPlafonnee:gearApi.defPlafonnee,
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
 profilDuModele:m=>({template:m.id,name:m.name,role:m.family||'Adversaire',
  hp:m.pv,max:m.pv,def:m.def,dmg:m.damage,xp:m.xp,type:m.type,socle:m.socle,menace:m.menace,
  notes:m.notes||'',attacks:structuredClone(m.attacks||[]),image:m.image||null}),
 equipementAdversaire:()=>({}),
 // Comme le vrai : un acteur neuf, donc pas encore révélé ni numéroté.
 fromMonster:m=>({hero:false,vu:false,numero:null,orbes:0,usages:{},...ctxT.profilDuModele(m)})};
vm.createContext(ctxT);
// Un adversaire révélé et numéroté le reste quand son modèle est corrigé ou seulement enregistré.
table[1].vu=true;table[1].numero=3;
vm.runInContext(bloc+';result=syncFromTemplate({id:"t1",name:"Sbire",pv:20})',ctxT);
assert.ok(table[1].vu===true&&table[1].numero===3,'révélé et numéro tiennent');
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
assert.equal(readStat('def','900',2),6);                       // Au-delà de la borne, 6 pour la DEF : on s'y arrête.
assert.equal(readStat('def','-4',2),0);
assert.equal(readStat('vie','7,5',1),7.5);                     // La virgule vaut le point.
assert.equal(readStat('endu','3.9',1),3);                      // Une endurance ne se coupe pas en quatre.
assert.equal(readStat('level','9',1),9);assert.equal(readStat('level','25',1),20);
// L'XP paie les talents : il reste l'XP gagnée moins le prix de ce qu'on tient ; le niveau suit toute l'XP.
{const {xpDisponible}=require('./combat.js');const T=[{id:'a',couts:[100,0,0]},{id:'b',couts:[250,0,0]}];
 assert.equal(xpDisponible({xp:500,talents:['a']},T),400);assert.equal(xpDisponible({xp:300,talents:['a','b']},T),0);assert.equal(xpDisponible({xp:0,talents:[]},T),0);}
/* Un aventurier dont le centre mord sur la matière ne voit pas à travers elle : un donjon d'un seul
   tenant, ses salles en creux, ne s'ouvre pas d'un coup. Il regarde depuis le point libre le plus proche. */
{const {visionPolygon,pointInPolygon}=require('./combat.js');const r=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
 const murs=[{contours:[r(0,40,100,60),r(20,60,60,30)]}];
 const p=visionPolygon({x:50,y:42},murs);assert.equal(pointInPolygon([40,75],p),false,'la salle reste cachée');assert.equal(pointInPolygon([50,20],p),true,'le couloir se voit');
 assert.equal(pointInPolygon([40,75],visionPolygon({x:50,y:75},murs)),true,'dans la salle, on la voit');}
// Deux améliorations à la suite : la seconde ne remplace la première que si elle le dit ; sinon elles s'additionnent.
// Au niveau 1, chaque classe donne un point dans trois compétences, calculé comme son bonus de PV.
{const {competencesDeClasse,bonusDe,COMPETENCES}=require('./combat.js');const v=(r,n)=>competencesDeClasse(r)[COMPETENCES.indexOf(n)];
 assert.deepEqual(['Robustesse','Savoir','Force'].map(n=>v('Gardien',n)),[1,1,1]);assert.equal(v('Gardien','Ruse'),0);
 assert.deepEqual(['Mysticisme','Savoir','Ruse'].map(n=>v('mystique · Voie du gel',n)),[1,1,1]);
 assert.deepEqual(['Agilité','Ruse','Perception'].map(n=>v('Ombrelame',n)),[1,1,1]);assert.deepEqual(['Force','Robustesse','Technique'].map(n=>v('Destructeur',n)),[1,1,1]);
 assert.equal(competencesDeClasse('Aventurier').reduce((x,y)=>x+y,0),0);
 assert.equal(bonusDe({hero:true,role:'Gardien',talents:[]},[],null).skills[COMPETENCES.indexOf('Force')],1,'l’aventurier le reçoit');
 assert.equal(bonusDe({hero:false,role:'Gardien',talents:[]},[],null).skills[COMPETENCES.indexOf('Force')],0,'pas un adversaire');}
{const {sansAmeliorationsRemplacees}=require('./combat.js');const ch=r=>({de:'t',dir:'se',rang:r});
 const a1={id:'a1',effet:'x',chemin:ch(1)},a2={id:'a2',effet:'y',chemin:ch(2)},a3={id:'a3',effet:'y',chemin:ch(2),remplacePrecedente:true};
 assert.deepEqual(sansAmeliorationsRemplacees([a1,a2]).map(t=>t.id),['a1','a2']);assert.deepEqual(sansAmeliorationsRemplacees([a1,a3]).map(t=>t.id),['a3']);}
// Le niveau d'un aventurier suit son XP, palier par palier.
{const {niveauDeXp,NIVEAUX_XP,writeStat}=require('./combat.js');assert.equal(NIVEAUX_XP.length,20);
 assert.deepEqual([0,299,300,899,900,2700,6499,6500,64000,354999,355000,999999].map(niveauDeXp),[1,1,2,2,3,4,4,5,10,19,20,20]);
 const h={hero:true,xp:0,level:1};writeStat(h,'xp','14000');assert.equal(h.level,6);
 const m={hero:false,xp:0,level:3};writeStat(m,'xp','900');assert.equal(m.level,3,'un adversaire garde le niveau qu’on lui donne');}
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
// Les PNJ ont leur colonne à eux, quel que soit leur type.
assert.deepEqual([...colonnes].filter(k=>k!=='pnj').sort(),[...typesAdv].sort());
// Les langue­ttes ont la teinte de leur type, sinon elles sortent blanches.
const feuille=fs.readFileSync('editor.css','utf8');
typesAdv.forEach(t=>assert.ok(feuille.includes('.cat-pill.k-'+t+'{'),'languette sans teinte : '+t));
// Aucun bandeau de colonne d'adversaire ne porte de fond : seule l'encre les distingue.
typesAdv.forEach(t=>{const r=feuille.match(new RegExp('\\.cat-col\\.c-'+t+' h3\\{([^}]*)\\}'));
 assert.ok(!r||!r[1].includes('background'),'bandeau teinté : '+t)});
/* Le menu déroulant des mécaniques porte le nom ET la description : on sait ce qu'un effet
   fait avant de le choisir, sans gras — une option ne lit pas le balisage. */
const lib=C.libelleTalent('lamevent');
assert.ok(lib.startsWith('Coupure : '),'le libellé s’ouvre sur le nom : '+lib);
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
assert.ok(src.includes('get.onsuccess=()=>{sessionLue=true;poser(get.result);finish()}')&&src.includes("if(db&&!sessionLue){")&&src.includes('if(verifieSauvegarde(s))return;'));
/* v0.329 — Un enregistrement sans domaine en mémoire garde celui déjà enregistré. */
{const ctxS={};vm.createContext(ctxS);vm.runInContext(src.match(/function domaineRempli\(d\)\{[\s\S]*?catch\(e\)\{return false\}\}/)[0]+';this.domaineRempli=domaineRempli;',ctxS);
 assert.equal(ctxS.domaineRempli(undefined),false);assert.equal(ctxS.domaineRempli({carte:{calques:[null,null]},batiments:[{nom:'Forge',zone:null}]}),false);
 assert.equal(ctxS.domaineRempli({carte:{calques:['data:image/png;base64,x']},batiments:[]}),true);assert.equal(ctxS.domaineRempli({carte:{calques:[]},batiments:[{zone:[[1,1],[2,2],[3,1]]}]}),true);
 assert.equal(ctxS.domaineRempli({carte:{get calques(){throw Error('x')}}}),false,'un domaine illisible ne bloque pas l’enregistrement');
 assert.ok(src.includes("if(domaineRempli(s.domaine))st.put(s,'session');")&&src.includes("else{const g=st.get('session');g.onsuccess=()=>{const avant=g.result;if(avant&&domaineRempli(avant.domaine))s.domaine=avant.domaine;st.put(s,'session')}}"),'le domaine enregistré survit à une sauvegarde qui n’en a pas');}
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
assert.ok(vivant.indexOf("base=etatVivant();")<vivant.indexOf("aRepousser.forEach(([id,k])")&&vivant.indexOf("aRepousser.forEach(([id,k])")<vivant.indexOf("  if(change){render();rafraichitFiches()}\n")&&vivant.indexOf("  if(change){render();rafraichitFiches()}\n")<vivant.indexOf(" }finally{appliquantDistant=false;dernierPousse=base||etatVivant();poussePret=true;pousserPlusTard()")
 ,'la référence précède le rendu');
assert.ok(vivant.includes('function pousserBientot')&&page.includes("if(typeof pousserBientot==='function')pousserBientot()"),'le glissement part par salves');
assert.ok(vivant.includes("appliquerSalle(dernierDoc,true)")&&vivant.includes("seulementPositions(docPrecedent,d)"),'les positions seules glissent sans rendu');
assert.ok(page.includes("t.dataset.id=a.id")&&page.includes(".token.glisse{transition:"),'le socle reçu est retrouvé et glisse');
assert.ok(page.includes("addEventListener('touchmove'")&&page.includes("mapPanX+=c.x-doigts.x"),'deux doigts font glisser la carte');
/* Le point d'Action chez le joueur, les orbes gratuits, l'orbe qui vole. */
assert.ok(/orbes:\{[^}]*gratuit:true/.test(fs.readFileSync('combat.js','utf8')),'les orbes se disent gratuits');
assert.ok(page.includes("const enCombatNow=enCombat();if(enCombatNow){if(actionPrise(a)||gelDebut(a))return;depensePoint(a,'action')}"),'en combat, le test prend l’Action, et ne se fait pas sans elle');
assert.ok(page.includes('function volOrbe(')&&vivant.includes("rec.genre==='effet'"),'l’orbe vole ici et en face');
assert.ok(vivant.includes("if(!estMJ()&&CHAMPS_ACTEUR_MJ.includes(k))return;")&&vivant.includes('aRepousser.push([id,k])'),'« vu » n’appartient qu’au MJ');
/* Les invités ne dirigent pas, la carte reste voilée jusqu'au brouillard, le journal a ses tons. */
assert.ok(vivant.includes('function verrouillerInvite')&&vivant.includes("if(spectateur()&&view!=='player'){view='player'"),'un invité reste en vue joueur');
const cartes=fs.readFileSync('maps.js','utf8');
assert.ok(cartes.includes("if(cleVoile()!==cartePeinte)voileAttente.hidden=false;")&&cartes.includes('renderFog();renderNuit();renderZones();leverVoile();')&&page.includes('#voile-attente{'),'la carte se voile jusqu’au brouillard');
assert.ok(page.includes(".j-entry.ton-talent{"),'le journal a ses tons');
// Le journal se cale sur le bas de la carte, et se libère sur une colonne.
assert.ok(cartes.includes('function calerColonnes')&&cartes.includes('renderFouilles()}finally{cadreFige=dehors?cadreFige:null}\n calerColonnes();')&&page.includes('.stack.right.calee .journal{flex:1'),'les colonnes se calent sur la centrale');
assert.ok(cartes.includes("moveActor(heros[i],p.x,p.y,true)"),'l’ouverture d’une carte place librement');
assert.ok(feuille.includes('repeat(4,minmax(0,1fr))')&&feuille.includes("@media(max-width:1150px){.hero-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}"),'quatre aventuriers par ligne');
assert.ok(page.includes(".eyebrow,.turn-head .eyebrow,#titre-tour,.journal-title,.panel>h2,#carte-titre{font:600 13px")&&!page.includes('titre-actions')&&feuille.includes(".bloc-titre,.bloc-replie .bloc-titre{font:600 13px")&&page.includes('.actions-rangee>.attack-card{margin:0;height:220px;overflow:auto}'),'un seul lettrage de titres');
/* Le journal se vide et s'écrit ; les lignes ne disent plus « Coma » mais 💀 ; la fiche tient dans sa colonne. */
assert.ok(page.includes('id="journal-chat"')&&page.includes('function logChat(')&&vivant.includes("rec.effet==='vider'&&duMJ"),'le journal s’écrit et se vide');
assert.ok(!page.includes("' Coma.'")&&page.includes("' 💀'")&&!page.includes('Les dés ne passent pas la DEF'),'💀 et rien de plus');
assert.ok(src.includes('function talentCarte(t,logo){')&&src.includes("carte=talentCarte(tv),pill=carte.firstChild;")&&feuille.includes('.talent-grille .cat-pill{'),'les talents de la fiche sont compacts');
assert.ok(page.includes('minmax(0,1fr) 340px')&&page.includes('minmax(0,1fr) 380px'),'la colonne de droite s’élargit');
/* L'orbe et la flèche volent avant que les dégâts tombent ; l'œil de la troupe ; le journal épuré. */
assert.ok(page.includes('function volFleche(')&&vivant.includes("rec.effet==='fleche'")&&page.includes("diffuserEffet('fleche',a,actors[j],null)")&&vivant.includes("rec.effet==='balayage'")&&page.includes("diffuserEffet('balayage',a,actors[j],null)"),'le souffle et le balayage jouent ici et en face');
assert.ok(page.includes("if(duree>0)setTimeout(()=>{poser();render();")&&page.includes("setTimeout(()=>{tirEnVol=false;frapper();scheduleSave()},duree)"),'les dégâts attendent le vol');
assert.ok(cartes.includes("icone('troupe-eye'")&&cartes.includes('function oeilJoueur')&&cartes.includes("inconnu=oeilJoueur()?255:110"),'l’œil de la troupe');
assert.ok(!page.includes('Bienvenue dans Amertume')&&!cartes.includes("(d.secret?'Passage secret ':'Porte ')")&&page.includes(" garde '+nomNum(o)+'.'")&&page.includes("' 🔍 '+nomNum(o)+' · '+skillNames[k]+' : '"),'le journal s’épure');
assert.ok(!src.includes("loin.textContent=' ⤳'")&&page.includes('.actor.enemy.k-alpha:not(.selected){background:#efdcc2}')&&page.includes("total+' Dégâts'+(posesDits.length?' + '+posesDits.join(' + '):'')+'.'"),'boutons et vignettes');
/* Le tour 1 à l'ouverture d'une carte, les numéros à la révélation, les adversaires cachés repliés, l'Onde et les talents en colonnes. */
assert.ok(page.includes('function remiseAuTourUn')&&cartes.includes("if(typeof remiseAuTourUn==='function')remiseAuTourUn();"),'ouvrir une carte revient au tour 1');
assert.ok(page.includes('function prochainNumero')&&page.includes("a.vu=true;if(!a.numero)a.numero=prochainNumero(a)")&&JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"')).includes('numero'),'les numéros se donnent à la révélation');
assert.ok(page.includes("groupeReplie('Adversaires cachés',cachees)")&&page.includes('let cachesOuverts=false;'),'les adversaires cachés se replient');
assert.ok(page.includes("imgUrl('ONDE.png')")&&src.includes("out.className='talent-grille'")&&feuille.includes('.talent-detail.large{grid-column:1/-1'),'l’Onde et les deux colonnes de talents');
/* La troupe ne voit ni porte de côté ni objet dans le noir ; la barre de la carte se vide ; qui parle. */
assert.ok(cartes.includes('function doorFaces')&&cartes.includes("const t=1-r/L;return rayonContre(")&&cartes.includes("if(oeilJoueur()&&!vuTroupe)return;"),'portes et objets ne se devinent plus');
assert.ok(!cartes.includes("before(mapPick,mapOpen)")&&page.includes('<div class="mapbar-h2" hidden>')&&!src.includes("' de la scène.'"),'la barre de la carte se vide');
assert.ok(page.includes("const a=selected!==null?actors[selected]:null;return a?a:{name:'MJ',mj:true}"),'le socle sélectionné parle, sinon le MJ');
/* Le zoom reste net, les points de vie suivent les combattants (v0.639), le sélecteur de talents se limite à la classe. */
assert.ok(page.includes('#map-view{--token:46px;position:absolute;inset:0;transform-origin:0 0;background-image')&&!page.includes('id="pv-cible"')&&page.indexOf('id="pv-panel"')>page.indexOf('id="actors"'),'zoom net, points de vie sous les combattants');
assert.ok(src.includes("a.hero?tete:")&&src.includes("cle.startsWith(cleClasse(f))"),'les talents de la classe seulement');
/* Dégâts d'opportunité, Insaisissable, Mauvais Sort. */
{const C2=require('./combat.js');
 assert.equal(C2.TALENTS_CODES.insaisissable.type,'pass');assert.equal(C2.TALENTS_CODES.mauvaissort.monstre,true);
 const des=[[3,0],[6,1],[6,0]],s=C2.mauvaisSort(des,()=>2);
 assert.deepEqual([s.index,s.avant,s.apres],[1,6,2]);assert.equal(des[1][0],2);assert.equal(des[1][1],1);   // Le premier des meilleurs, sa couleur gardée.
 assert.equal(C2.mauvaisSort([],()=>2),null);}
assert.ok(page.includes('function degatsOpportunite')&&page.includes("croises.forEach(([k,set],n)=>{const o=actors[k],d=departs[n];if(o&&d&&Math.hypot(o.x-d.x,o.y-d.y)<.05)return;degatsOpportunite(o,[...set])});")&&page.includes("const avant=contactsDe(a);"),'les dégâts d’opportunité se jugent au lâcher et au clavier');
assert.ok(page.includes("porteEffet(talentsCodes(a),'insaisissable')")&&page.includes("porteEffet(talentsCodes(b),'mauvaissort')?mauvaisSort(dice,d6):null"),'Insaisissable et Mauvais Sort câblés');
// Le journal ne dit ni la fiche enregistrée, ni les créatures mises à jour, ni la carte ouverte.
assert.ok(!src.includes('Fiche enregistrée')&&!src.includes('mise(s) à jour')&&!cartes.includes('» ouverte : '),'le journal se tait sur l’intendance');
/* Un changement local gardé part au prochain envoi ; le MJ réinitialise d'un clic droit ; pastilles à droite. */
assert.ok(vivant.includes("gardes.push([id,k,structuredClone(e[k])])")&&vivant.includes("gardes.forEach(([id,k,v])=>{if(base.actors[id])base.actors[id][k]=v})"),'un changement local gardé part');
assert.ok(page.includes('function inerte(')&&page.includes('function reinitialiser(')&&src.includes("inerte(b,!!refus||(typeof gelDebut==='function'&&gelDebut(a)))")&&src.includes('inerte(b,!t.peut)')&&page.includes('inerte(rev,!!refus||gelDebut(a))'),'le clic droit du MJ réinitialise');
assert.ok(page.includes('.pastilles{position:absolute;right:8px')&&page.includes('.actor-nom strong{overflow:hidden;text-overflow:ellipsis')&&feuille.includes('button.btn-analyse,button.btn-analyse.on,button.btn-mvt{--fond:#cf9152;color:#fff;background-image:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.07))}')&&!feuille.includes('#8264bb')&&page.includes('function mouvementPris(')&&page.includes(":mouvementEpuise(a)?'Plus de point de Mouvement : analyser en coûte un.")&&page.includes('body.vue-joueur .turn-head{margin-bottom:0}'),'pastilles à droite, nom coupé, Analyser teal, tour compact');
/* Vie ou Endurance corrigée sur une fiche : les PV maximum suivent (Vie × Endu + bonus), sans
   dépasser leurs bornes ni laisser les PV du moment au-dessus ; le sélecteur Analyser n'est pas
   « button button » ; chaque effet déjà porté par un talent du catalogue arbore sa coche verte. */
assert.ok(src.includes('function recalculerPV(')&&src.includes("if(cle==='vie'||cle==='endu')recalculerPV(a);")&&src.includes("writeStat(a,'max',max)"),'les PV max suivent Vie et Endurance');
assert.ok(!/button\s*\/\*[^*]*\*\/\s*button\.btn-analyse/.test(feuille)&&/\*\/\s*button\.btn-analyse,button\.btn-analyse\.on,button\.btn-mvt\{--fond:#cf9152;color:#fff;/.test(feuille),'le sélecteur Analyser vise bien le bouton');
// v0.472 : la coche verte devient les petits ronds des talents qui portent l'effet, et « + » en crée un.
assert.ok(src.includes("const porteurs=(catalog.talents||[]).map((t,i)=>[t,i]).filter(([t])=>t&&t.effet===c.cle);")&&src.includes("b.className='biblio-talent';b.append(talentRond(")
 &&src.includes("plus.className='biblio-plus';plus.textContent='+';")&&!src.includes("u.className='utilise'")&&feuille.includes('.biblio-table .biblio-talent .cat-pill.gear-carre.talent-carre{width:20px;height:20px;'),'les talents qui portent un effet, en petits ronds, et « + »');
/* La bibliothèque des effets est un tableau : les classes en corps repliables, les améliorations sous leur talent,
   la phrase aux réglages marqués, les réglages en puces, un filtre. Les noms d'amélioration suivent un seul modèle,
   « Talent — court », et leur ancien nom retrouve encore l'effet. */
{const T=C.TALENTS_CODES;
 Object.values(T).filter(c=>c.pour&&c.court).forEach(c=>assert.equal(c.nom,T[c.pour].nom+' — '+c.court,'nom uniforme : '+c.cle));
 assert.equal(T.orbes2des.nom,'Orbes mystiques — dés en plus');assert.equal(T.eruptiondouble.nom,'Éruption — dégâts doublés');assert.equal(T.ignoredegats.nom,'Invulnérable — ignore les dégâts');
 assert.equal(C.effetParNom('Orbes à deux dés'),'orbes2des','l’ancien nom retrouve l’effet');assert.equal(C.effetParNom('Orbes mystiques — deux dés'),'orbes2des');
 assert.equal(C.effetParNom('Éruption — double'),'eruptiondouble');assert.equal(C.effetParNom('Attaque État'),'attaqueetat');assert.equal(C.effetParNom('Ignore les dégâts d’un état'),'ignoredegats');
 assert.ok(src.includes("const table=document.createElement('table');table.className='biblio-table';")&&src.includes("function ligneEffet(c,classe,rangs,parent){")
  &&src.includes("function phraseVariables(td,c,params){")&&src.includes("function filtreBiblio(){")&&src.includes('id="biblio-filtre"')&&src.includes("tr.className='effet-ligne t-'+(c.type||'act')+(parent?' ame-de':c.type==='ame'?' ame-libre':'');")
  &&src.includes("localStorage.getItem('amertume-biblio-plis')")&&feuille.includes('.biblio-table tr.ame-de td{')&&feuille.includes('.biblio-var{appearance:none;'),'la bibliothèque en tableau');
 /* v0.472 — Sans type ; le nom se renomme d'un clic ; une amélioration ne redit pas son talent ; les parties
    variables de la phrase sont des menus déroulants ; l'ordre se change à la main, sans toucher aux talents. */
 assert.ok(!src.includes("type.className='biblio-type'")&&!feuille.includes('.biblio-type{')&&!src.includes("pre.className='nom-parent'")&&src.includes("nom.onclick=e=>{e.stopPropagation();renomme()};")
  &&src.includes("if(parent){if(!perso&&c.court)texteNom=c.court;")&&src.includes("tr.draggable=true;")&&src.includes("function glisseBiblio(table){"),'la ligne : sans type, nom cliquable, sans le talent racine, déplaçable');
 {const o=C.variablesPhrase('orbes',{}),v=k=>o.variables.find(x=>x.cle===k);
  assert.deepEqual(o.variables.map(x=>[x.cle,o.texte.slice(x.de,x.a)]),[['orbes','1'],['des','1'],['couleur','Mystique']],'les orbes : deux nombres et une couleur, à leur place');
  assert.deepEqual(v('couleur').options.map(x=>x[1]),['Simple','Léger','Lourd','Mystique','Mortel','Phase']);assert.equal(v('orbes').options.length,9);
  const a=C.variablesPhrase('attaqueetat',{});assert.deepEqual(a.variables.find(x=>x.cle==='condition').options.map(x=>x[1]),['S’il tue la cible','Si la cible n’est pas tuée'],'un choix garde les mots qui changent ensemble');
  const l=C.variablesPhrase('lamevent',{});assert.deepEqual(l.hors,['bonus','etat','mode'],'un réglage absent de la phrase reste hors du texte');
  const r=C.variablesPhrase('orbes',{des:3,couleur:'red'});assert.equal(r.texte,C.texteBrut(C.phraseTalent('orbes',{des:3,couleur:'red'})));assert.equal(r.variables.find(x=>x.cle==='des').valeur,3);
  Object.values(C.TALENTS_CODES).forEach(c=>{const x=C.variablesPhrase(c.cle,{});x.variables.forEach((y,i)=>{assert.ok(y.a>y.de&&(!x.variables[i+1]||x.variables[i+1].de>=y.a),c.cle+' : des parties distinctes');
   assert.ok(y.options.some(z=>z[0]===y.valeur),c.cle+' : la valeur est parmi les choix')});
   assert.equal(x.variables.length+x.hors.length,(c.params||[]).length,c.cle+' : chaque réglage, dans le texte ou hors')});}
 {const ctxB={catalog:{classesEffets:{}}};vm.createContext(ctxB);vm.runInContext(src.slice(src.indexOf('function deplaceEffet('),src.indexOf('/* Le filtre de la bibliothèque'))+';this.deplaceEffet=deplaceEffet;',ctxB);
  const L=[['a','','M'],['a1','a','M'],['a2','a','M'],['b','','M'],['c','','G']];
  assert.equal(ctxB.deplaceEffet(L,'a','b',false),true);assert.deepEqual([...ctxB.catalog.ordreEffets],['b','a','a1','a2','c'],'un talent emmène ses améliorations');
  assert.equal(ctxB.deplaceEffet(L,'a2','a1',true),true);assert.deepEqual([...ctxB.catalog.ordreEffets],['a','a2','a1','b','c'],'une amélioration change de place parmi les siennes');
  assert.equal(ctxB.deplaceEffet(L,'a','c',true),true);assert.deepEqual([...ctxB.catalog.ordreEffets],['b','a','a1','a2','c']);assert.deepEqual({...ctxB.catalog.classesEffets},{a:'G',a1:'G',a2:'G'},'posé dans une autre classe, il la prend avec les siennes');
  assert.equal(ctxB.deplaceEffet(L,'a','a1',true),false,'pas dans son propre groupe');}
 assert.ok(src.includes("c.ordreEffets=[...new Set((Array.isArray(c.ordreEffets)?c.ordreEffets:[]).filter(k=>typeof k==='string'&&TALENTS_CODES[k]))];")
  &&src.includes("if(v!==undefined&&v!==p.defaut)a[p.cle]=v});")&&src.includes("ordreEffets:[...(catalog.ordreEffets||[])],reglagesEffets:structuredClone(catalog.reglagesEffets||{}),"),'ordre et valeurs de la bibliothèque gardés au catalogue');}
/* La conversion des dégâts de D&D 5.5 : les dés lus — d4 à d12 —, leur moyenne, et six poignées d'Amertüme
   panachées, sans bonus, dont la moyenne, lancée par le moteur, s'en approche ; des mélanges différents d'abord. */
{assert.deepEqual(C.lireDegatsDnd('2d6+3'),{des:[{n:2,f:6}],bonus:3,moyenne:10,min:5,max:15});
 assert.equal(C.lireDegatsDnd('d8 + 1d4 - 1').moyenne,6);assert.ok(C.lireDegatsDnd('1d20').erreur,'un d20 ne se convertit pas');assert.ok(C.lireDegatsDnd('abc').erreur);
 assert.ok(src.includes("const conversionDialog=dialog('conversion-des','Conversion des dégâts',")&&src.includes("b.id='conversion-ouvre';b.className='conversion-bouton';b.textContent='🎲';")
  &&src.includes("$('view').after(b)")&&!src.includes("conversion-dit")&&!src.includes("conversion-def")&&feuille.includes('.conversion-grille{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'),'le dé à côté de la vue ouvre la conversion');}
/* Un test de compétence tient sur une ligne au journal : la compétence, les réussites, les dés — 4+ en vert, en
   dessous en rouge —, sans « Test de », ni nombre de dés, ni six explosifs. La classe dit aussi ses compétences. */
assert.ok(page.includes(" log(nomNum(a)+' · '+skillNames[i]+' : '+jet.reussites+' réussite'+(jet.reussites>1?'s':'')+' ⦃'+jet.des.join(',')+'⦄',{dice:true,ton:'competence'});")
 &&!page.includes("six explosi")&&page.includes("const faces=/^⦃([0-9,]+)⦄$/.exec(m[0]);")&&feuille.includes('.j-test .j-face.ok{color:#2e8b3e}')
 &&src.includes("competencesDeClasse(nomCl).forEach((n,i)=>{if(!n)return;")&&src.includes("classe.style.background='color-mix(in srgb,'+teinte+' 16%,transparent)';"),'test de compétence sur une ligne, classe et ses compétences');
/* Les petites améliorations de l'onglet Talents et de la fiche d'aventurier gardent leur taille, comme le sphérier
   et le reste de la feuille de style : la bibliothèque ne touche qu'à ses propres règles. */
assert.ok(feuille.includes('.talent-rangee.t-ame .cat-pill.gear-carre.talent-carre{max-width:34px;border-width:2px}')
 &&feuille.includes('.talent-rangee.t-ame{grid-template-columns:repeat(12,minmax(0,1fr));')
 &&feuille.includes('.hero-card .talent-ameliorations .cat-pill.gear-carre.talent-carre{width:100%;max-width:28px;')
 &&feuille.includes('.hero-card .talent-ameliorations .amelioration-case-vide{width:100%;max-width:28px;')
 &&feuille.includes('.arbre-plan>.arbre-noeud.petit .arbre-rond{width:40px;height:40px}')
 &&feuille.includes('.palier-effet.amelioration::before,.gear-detail .gear-bonus::before{')
 &&feuille.includes('.j-des{display:inline-flex;vertical-align:-3px}'),'les améliorations restent petites, le reste de la feuille intact');
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
  &&vivant.includes("const local=k==='cibles'?ciblesIds(a):k==='x'||k==='y'?positionVraie(a)[k]:a[k];")&&vivant.includes("if(k==='cibles'){cibles.push([a,e[k]]);return}")
  &&vivant.includes('cibles.forEach(([a,ids])=>{if(typeof poseCibles===\'function\')poseCibles(a,indicesDesCibles(ids))});'),'les cibles se retraduisent à l’arrivée, une fois la scène en place');
 assert.ok(page.includes("if(cachePour(o,j)&&(view!=='mj'||duCoteTroupe(a)))return false;")&&page.includes('function reach(){const a=actors[selected],j=a?ciblesDe(a)[0]:undefined;'),'un aventurier ne vise pas un adversaire caché');
 const orbeSrc=page.slice(page.indexOf('function orbe('),page.indexOf('function cibleAlliee('));
 assert.ok(!orbeSrc.includes('mauvaisSort(')&&!orbeSrc.includes('Mauvais Sort :')&&orbeSrc.includes("let suite='',pose='';"),'l’orbe est un talent : pas de Mauvais Sort');
 const frappeSrc=page.slice(page.indexOf('function frappe('),page.indexOf('function frappe(')+2000);
 assert.ok(frappeSrc.includes("porteEffet(talentsCodes(b),'mauvaissort')?mauvaisSort(dice,d6):null"),'Mauvais Sort reste sur les attaques');}
/* Les boutons d'action écrivent en blanc, actifs, grisés ou inertes ; un talent sans dés ne porte
   plus sa nature ; un adversaire retiré laisse son XP aux aventuriers et les cibles ne glissent pas. */
assert.ok(feuille.includes('letter-spacing:.2px;color:#fff;')
 &&!feuille.includes('encre-sombre')&&!/button\.btn-[a-z]+[^{]*\{[^}]*(color:#2a2118|disabled-ink)/.test(feuille)&&feuille.includes('button.btn-talent.t-mait{--fond:#d4a341}'),'les boutons d’action écrivent en blanc');
assert.ok(!src.includes("className='nature'")&&!feuille.includes('.nature{'),'un talent sans dés ne dit plus sa nature');
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
  &&vivant.includes('const change=complet||JSON.stringify(base)!==avant;')&&vivant.includes('if(change){render();rafraichitFiches()}'),'rafales et échos ne redessinent pas pour rien');
 assert.ok(page.includes('function pastillesPoints(a)'),'l’Action se dépense même hors combat, le Mouvement en combat');
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
{const orbe=page.slice(page.indexOf('function volOrbe('),page.indexOf('function deplacement(')),fleche=page.slice(page.indexOf('function volFleche('),page.indexOf('function floatNumber('));
 const coup=page.slice(page.indexOf('function coupDeToken('),page.indexOf('function chocImpact('));
 assert.ok(!/\{[^}]*\bleft:/.test(coup.slice(coup.indexOf('el.animate')))&&!/\{[^}]*\bleft:/.test(orbe.slice(orbe.indexOf('el.animate')))&&!/\{[^}]*\bleft:/.test(fleche.slice(fleche.indexOf('el.animate'))),'pas de left/top animé');
 assert.ok(page.includes('function etincelles(couche,cible,delai){')&&coup.includes("{translate:'0 0'}")&&coup.includes(' return 120}')
  &&fleche.includes('<path class="pointe" d="M80,2 L100,8 L80,14 L84,8 Z"/>')&&fleche.includes('etincelles(couche,vers,vol);\n return vol+30}')
  &&page.includes('function deplacement(couche,de,vers)')&&orbe.includes("transform:'translate('+arrivee+') scale(1)'")
  &&page.includes('.orbe-vol{position:absolute;will-change:transform,opacity;')&&page.includes('.vfx{position:absolute;pointer-events:none;z-index:5;will-change:transform,opacity;transform:translate(-50%,-50%)}')
  &&!page.includes('function choc(')&&!page.includes('coup-trait')&&!page.includes('souffle-vol')&&!page.includes('balayage-vol'),'coup, flèche et étincelles, portés par le compositeur');}
/* Contacts : tous les rayons (aventuriers et adversaires révélés) quand il est actif, la seule
   sélection sinon ; un joueur inspecte n'importe quel combattant — fiche selon ce qu'il en sait,
   aura — sans le contrôler, et ses cases d'activation restent celles de son actif ; les
   projectiles sont plus lents et plus gros. */
assert.ok(page.includes('id="portees">◎<')&&page.includes("let porteesOn=localStorage.getItem('amertume-portees')==='1';")&&page.includes("return a.hero||((a.vu||apercusEnGeste.has(a.id))&&!a.hidden)")&&!page.includes("couche.hidden=!porteesOn"),'Contacts : tous les rayons, ou la sélection');
assert.ok(page.includes('let inspecteId=null;')&&page.includes("if(!controlled(i)){const a=actors[i];inspecteId=a&&inspecteId!==a.id?a.id:null;render();return}")&&!page.includes('Sélectionne ton aventurier, puis cible')
 &&page.includes("const k=view!=='mj'&&inspecteIndex()>=0?inspecteIndex():selected,a=actors[k];")&&page.includes("  $(id).checked=!!s&&pointsRestants(s,quoi)<=0;")
 &&page.includes('#sheet.secret :is(#sheet-chips,#stats,#hpbar,#bloc-gear,#bloc-talents,#skills,.divider){display:none}')&&page.includes("a.id===inspecteId?'inspecte ':''"),'un joueur inspecte sans contrôler');
assert.ok(page.includes('duration:calme?1:650')&&page.includes('return calme?0:650}')&&page.includes('Math.max(16,tokenOf(vers)*.7)')&&page.includes("const long=Math.max(34,Math.min(70,tokenOf(vers)*1.15)),haut=long*.16;"),'projectiles plus lents et plus visibles');
/* Dégâts d'opportunité étendus : traverser une zone de contact pendant un glissement compte comme
   s'y arrêter puis en sortir ; tirer ou lancer un orbe au contact déclenche l'occasion de tous les
   adversaires au contact, après les dégâts du tir — un adversaire tué ou entravé ne frappe pas. */
assert.ok(page.includes('function ramasseContacts('),'la traversée d’une zone de contact compte');
assert.ok(page.includes('function opportuniteAuTir(')
 &&page.includes("const contacts=rangeOf(a)==='distance'?contactsDe(a):[];")
 ,'tir et sort au contact : occasion après les dégâts');
/* Le bestiaire crée des modèles : « + Nouveau monstre » enregistre au bestiaire, pas en scène. */
assert.ok(src.includes('let templateNeuf=false;')&&src.includes("$('bestiary-add').onclick=()=>openActor(null,false,null,true);")
 &&src.includes("templateNeuf=!!neuf&&template===null&&!hero;")&&src.includes("else if(templateNeuf){catalog.monsters.push(toMonster(a));templateNeuf=false;renderCatalogPages();")
 &&src.includes("$('save-template').hidden=draft.hero||templateNeuf;"),'un nouveau monstre du bestiaire y entre');
/* Sans sélection, Points de vie, Actions et fiche restent en place, vides ; le bloc Actions a une
   hauteur de repos pour que la carte calée dessus ne bouge pas au clic. */
assert.ok(page.includes("pv.hidden=view!=='mj';pv.classList.toggle('vide',!a);")&&page.includes("document.querySelector('.attack-card').classList.toggle('vide',!a);")
 &&!page.includes("document.querySelector('.attack-card').hidden=!a")&&page.includes("$('sheet').hidden=false;$('sheet').classList.toggle('vide',!a);")
 &&page.includes('.actions-rangee>.attack-card{margin:0;height:220px;overflow:auto}')&&page.includes('#sheet.vide #hpbar,#sheet.vide #bloc-gear,#sheet.vide .divider{display:none}')&&page.includes('#sheet{min-height:0}'),'les blocs restent en place, vides');
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
assert.ok(page.includes("if(!enCombat()&&reveles.some(a=>campDe(a)==='adverse'))setTimeout(()=>{if(!enCombat())basculerMode('combat',true)},0);")&&page.includes("if(a.vu&&!enCombat())basculerMode('combat',true);")
 &&cartes.includes("if(typeof remiseAuTourUn==='function')remiseAuTourUn();\n mode='exploration';"),'le combat commence à la première révélation');
/* Glisser plusieurs socles ne coûte plus en proportion : obstacles et murs en pixels construits une
   fois par tâche, auras mémorisées par socle, redessin au plus une fois par image, contacts relevés en
   combat seulement, avec cadre et murs lus une fois. */
assert.ok(cartes.includes('let obstaclesTache=null;')&&cartes.includes("obstaclesTache={m,formes};setTimeout(()=>{obstaclesTache=null},0);")
 &&page.includes('let mursPxTache=null;')&&page.includes("let auraCache={formes:null,cle:'',pts:new Map()};")&&page.includes("auraCache.pts.set(k,pts)")
 &&page.includes("if(!drag.image)drag.image=requestAnimationFrame(()=>figeCadre(()=>{if(drag)drag.image=0;visibilitesEnGeste();updateRing();updateSight();traceMouvement(a,drag&&drag.regle);if(typeof renderEnjamber==='function')renderEnjamber();if(typeof renderNuit==='function'){renderHalos();renderNuit()}}));")
 &&page.includes("if(enCombat()){const size=mapSize(),murs=walls();")&&page.includes('function ramasseContacts(a,croises,de,size,murs){'),'glisser un lot reste léger');
/* Ciblage : une cible désignée hors de portée ne grise plus l'attaque ; le coup part sur qui est à
   portée, sans jamais retenir une cible automatique ; la désignation lointaine s'efface. */
assert.ok(page.includes('function ciblesAtteignables(a,liste,portee)')&&page.includes("if(ciblesAtteignables(a,vises,portee).length||cibleAutomatique(a,portee).length)return '';")
 &&!page.includes('poseCibles(a,cibleAutomatique(a))')&&page.includes("if(!vises.length){vises=cibleAutomatique(a,portee);if(designees.length){poseCibles(a,[]);render()}}")
 &&!page.includes('Hors du rayon de contact : rapproche-toi'),'l’attaque prend qui est à portée');
/* Les questions de la table passent par une boîte de la page, jamais par confirm() ; la fin du combat
   s'annonce comme son début. */
assert.ok(page.includes('function demander(texte,ok)')&&!page.includes("confirm('Mettre fin au combat")&&!page.includes("confirm('Revenir au tour 1")&&!page.includes("confirm('Vider le journal")&&page.includes("basculerMode('exploration',true)};")&&page.includes("if(annonce)annonceFlottante(enCombat()?'⚔ Début du combat !':'🕊 Fin du combat')}")
 &&feuille.includes('dialog.demande{width:min(440px,94vw)}'),'les questions de la table ont leur boîte, la fin du combat s’annonce');
/* Un allié désigné ne grise jamais l'attaque : le coup part sur l'adversaire à portée, la désignation
   alliée (protégé d'un Gardien) reste. */
assert.ok(!page.includes('Cible alliée : aucun coup ne part sur un allié.')&&page.includes("const vises=ciblesDe(a).filter(j=>actors[j]&&alive(actors[j])&&hostiles(actors[j],a));\n if(ciblesAtteignables(a,vises,portee).length||cibleAutomatique(a,portee).length)return '';"),'un allié désigné ne bloque pas l’attaque');
/* L'Onde de chaque camp, à gauche du « + » : Aventuriers ou Adversaires à 100 % ; l'ancien bouton a disparu. */
assert.ok(!page.includes('id="heal-foes"')&&!src.includes("$('heal-foes')")&&!page.includes("$('heal-foes')")&&page.includes('function remettreCamp(hero)')&&page.includes("b.className='ajout-camp soin-camp'")
 &&page.includes("groupe('Aventuriers',troupe,AJOUT_CAMP.hero,soinCamp().hero,soinCamp().repos)")&&page.includes("if(mj&&soin){soin.hidden=false;h.append(soin)}")&&page.includes('.ajout-camp.soin-camp{margin-left:auto}.ajout-camp.soin-camp+.ajout-camp{margin-left:0}'),'l’Onde de chaque camp remplace Adversaires à 100 %');
/* Sans équipement, pas de rubrique Équipement sur la fiche de table ; la coche d'un modèle analysé se pose
   dans la vignette, à gauche du nom ; les projectiles sont un souffle (650 ms) et le coup au contact un
   balayage d'air (320 ms), le coup tombant au bout du geste. */
assert.ok(page.includes("$('gear-compte').textContent=nbGear;$('bloc-gear').hidden=!nbGear;")&&src.includes("coche.className='coche-modele'")&&src.includes("coche.onclick=lever;coche.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')lever(e)};p.append(coche)}")&&!src.includes("coche.classList.add('coche-analyse')")
 &&feuille.includes('.cat-pill .coche-modele{flex:none;width:16px;height:16px;'),'équipement vide masqué, coche dans la vignette, balayage au contact');
/* La barre de PV d'un token est pleine, entamée ou non — c'est sa hauteur qui dit l'actif ;
   sur la piste des dés, le lanceur à gauche et, au bout de chaque ligne, qui reçoit. */
assert.ok(page.includes('function poseJet(ligne,from,to){ligne.de=from;ligne.vers=to;')
 &&page.includes("const de=from||(lignes.find(l=>l.de)||{}).de||null;")
 &&page.includes('.board-token{position:absolute;transform:translate(-50%,-50%);border-radius:50%;'),'barre de PV égale, visages sur la piste');
/* Plus de chip Niveau sur la fiche de table ; le balayage est une déchirure dentelée de 90° ; la coche du
   bestiaire suit le nom ; l'équipement se lit en carrés — logo dessus, dés dessous — dont la description
   prend toute la ligne. */
assert.ok(!page.includes("chips.push('Niveau '+a.level)")
 &&src.includes('function gearCarre(o,n,portes)')&&src.includes('function gearDetail(o,a,enJeu)')&&src.includes("out.className='gear-grille'")&&src.includes("d.className='gear-detail large k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');")&&!src.includes("out.className='gear-pills'")
 &&feuille.includes('.gear-grille{display:flex;flex-wrap:wrap;gap:6px;')&&feuille.includes('.cat-pill.gear-carre{flex:none;width:auto;min-width:69px;min-height:69px;flex-direction:column;')&&feuille.includes('.gear-detail.large{flex-basis:100%;')&&feuille.includes('.cat-pill.gear-carre .die-sq,.cat-pill.gear-carre .pips .etat-inflige{flex-basis:19px;width:19px;height:19px}')&&!feuille.includes('.gear-pills')&&src.includes("d.className='gear-detail large k-'+col+' r-'+rareteDe(o)+(o.consumable?' consommable':'');")&&src.includes(' const PAR_LIGNE=6;'),'niveau masqué, déchirure, coche après le nom, équipement en carrés');
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
assert.ok(page.includes('function invocation(a,p,talent)')&&page.includes('function annulerPlacement()')&&page.includes('function regenerer(a,quand)')&&page.includes('applyDamage=function(a,montant)')&&page.includes("if(actors.filter(o=>regenerer(o,'debut')).length)render()")&&page.includes('.placement #map{cursor:crosshair}')
 &&src.includes("const opts=p.type==='modele'?[['','— choisir un adversaire —'],...(catalog.monsters||[]).map(m=>[m.id,m.name])]:(p.options||[]);")&&src.includes('function nomModele(id)')
 &&!src.includes("logos.classList.add('croises')")&&!feuille.includes('.logos.croises'),'Invocation, Régénération ; plus de logos croisés : le rond ne montre que la main droite');
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
assert.ok(src.includes("a.inventaire=Array.isArray(a.inventaire)?a.inventaire.filter(x=>typeof x==='string'&&x):[];completerInventaire(a);")&&src.includes("inventaire:[...(a.inventaire||[])],butin:normaliseButin(a.butin,a.inventaire),bourse:normaliseBourse(a.bourse),...(a.pnj?{pnj:true,alignement:alignementDe({pnj:true,alignement:a.alignement}),...(a.unique===true?{unique:true}:{})}:{})}}")&&src.includes("inventaire:[...(m.inventaire||[])],butin:normaliseButin(m.butin),bourse:normaliseBourse(m.bourse),...(m.pnj?{pnj:true,alignement:alignementDe(m),...(m.unique===true?{unique:true}:{})}:{})}}")
 &&src.includes('function toggleEquip(a,o)')&&src.includes('function dessineInventaire()')&&src.includes("sel('Ajouter à l’inventaire','inv_ajout','',inventaireOptions())")&&!src.includes('function refreshGearOptions')&&!src.includes("'weapon1'")
 &&src.includes("rangees(equipement,'');")&&src.includes("rangees(objets,combat?'':'Objets');")&&src.includes("const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);")
 &&JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"')).includes('inventaire')
 &&fs.readFileSync('shared.js','utf8').includes("'pool','weapons','armures','shieldId','munitionId','auraPv',")&&page.includes("const nbGear=typeof objetDeCombat==='function'?(a.inventaire||[]).filter(id=>objetDeCombat((catalog.items||[]).find(x=>x.id===id))).length:0;")
 &&feuille.includes('.cat-pill.gear-carre .pips{gap:2px;justify-content:center;flex-wrap:nowrap}')&&feuille.includes('.cat-pill.gear-carre.dispo{opacity:.55}')&&feuille.includes('.gear-rangee-titre{flex-basis:100%;')
 &&feuille.includes('.best-attaque{background:#cfdcea;border:1px solid #00000026;border-left:4px solid #4f7fb5;border-radius:9px;'),'inventaire, équipement et attaques spéciales');
/* Fiche d'un modèle : plus de cartouche « Adversaire », le type porte sa couleur comme tout le bloc,
   pas de rubrique Équipement quand il n'y a rien, ni Notes, ni pose depuis la fiche. */
assert.ok(src.includes("d.className='cat-detail bulle-modele-corps k-'+(m.type||'standard');")&&!src.includes("ligne([TYPE_NOMS[m.type]||'Standard',m.family&&m.family!=='Adversaire'?m.family:'',")
 &&!src.includes('function monsterSheet(')&&!src.includes('best-notes')&&!src.includes("pose-nombre")&&!src.includes('Ajouter à la carte')
 &&feuille.includes('.cat-detail.k-solitaire,.chip.chip-type.k-solitaire{background:#e8d3cb}')&&feuille.includes('.chip.chip-type{color:var(--ink);border-color:#00000026}'),'la bulle d’un modèle est sobre et teintée');
/* En jeu, la fiche ne montre que le porté et les objets ; la coche est un rond à cheval sur l'angle ;
   plus de chevron ni de titre « Équipement » en double ; un objet se lit et s'utilise ; le MJ équipe
   aussi un modèle du bestiaire, et un refus dit combien de mains manquent. */
assert.ok(src.includes('function gearPills(a,tout=true,combat=false)')&&page.includes('gearPills(a,false,true)')&&src.includes("const armurerie=tous.filter(([o])=>o.category==='weapon'||o.category==='armor');")&&src.includes("const equipement=combat?[]:armurerie.filter(([o])=>tout||portes(o));")
 &&src.includes("rangees(equipement,'');")&&src.includes("rangees(objets,combat?'':'Objets');")&&!src.includes("chev.title='Détail'")&&!src.includes("p.querySelector('.chev').onclick=deplie;")
 &&src.includes('function utiliserObjet(a,o)')&&!src.includes("'Clique l’objet pour l’utiliser.'")&&src.includes("const i=actors.indexOf(a),peutEquiper=view==='mj'||(i>=0&&i===owner);")
 &&feuille.includes('.cat-pill.gear-carre .marque-porte{display:none;position:absolute;top:-6px;left:-6px;')&&feuille.includes('.gear-detail.k-object.consommable{background:#d9e7cd;')
 &&page.includes("const nbGear=typeof objetDeCombat==='function'?(a.inventaire||[]).filter(id=>objetDeCombat((catalog.items||[]).find(x=>x.id===id))).length:0;")
 &&!src.includes('inventairesOuverts')&&!src.includes('gear-sac')&&!feuille.includes('gear-sac'),'fiche en jeu : porté et objets, coche ronde, objet utilisable');
/* Les mains se remplacent au lieu de refuser ; en jeu, pas de sac à déplier, le clic ouvre la
   description, et un objet se vise avant de s'employer, à la table de jeu seulement. */
assert.ok(src.includes('function libereMains(a,besoin)')&&src.includes('  else prendArme(a,o)}')&&src.includes('  else prendBouclier(a,o)}')
 &&src.includes('function gearDetail(o,a,enJeu)')&&!src.includes("p.className='gear-astuce';")&&src.includes('function appliquerObjet(a,o,vise,q)')
 &&src.includes("viserCible('◈ '+o.name+' — clique le combattant ou l’endroit visé',")&&src.includes("const equipable=(o.category==='weapon'||o.category==='armor'||o.category==='ammo')&&tout&&peutEquiper&&!verrouEquip(a,o);")
 &&src.includes('toggleEquip(a,o);ouvrir();')&&page.includes("viserCible('✦ Clique sur la carte pour poser '+m.name,"),'mains remplacées, objet visé, description à l’équipement');
{const t={mainsPrises:null},src2=src.slice(src.indexOf('function libereMains(a,besoin)'),src.indexOf('/* Équiper depuis l’inventaire'));
 assert.ok(src2.includes('while(mainsPrises(a)+besoin>2)')&&src2.includes('if(a.weapons.length){a.weapons.shift();n++}')&&src2.includes("else if(a.shieldId){a.shieldId='';n++}"),'les mains se libèrent du plus ancien');}
/* Une seule description ouverte à la fois, celle du dernier carré cliqué, et plus de liseré brun
   autour du carré ouvert : rien ne laisse croire qu'il est encore porté. */
assert.ok(src.includes('let gearOuvert=null;')&&!src.includes('gearOuverts')&&src.includes('const cle=cleGear(a,o),ouvert=gearOuvert===cle;detail.hidden=!ouvert||BULLES;')
 &&src.includes('const basculer=()=>{gearOuvert=ouvert?null:cle;if(BULLES&&ouvert)fermerBulle();redessine()};')&&!feuille.includes('.cat-pill.gear-carre.ouvert'),'une seule description, sans liseré');
/* Les arbres de talents : le rouage remplace le « + » des talents d'une fiche, la popup dessine
   la classe, puis une colonne par spécialisation, deux ; les maîtrises ne viennent plus d'office
   avec la classe, elles se placent dans l'arbre comme tout talent. */
assert.ok(src.includes("function sousTitre(texte,titre,fn,glyphe='+')")&&src.includes("mien?()=>openArbres(a):null,'⚙');")
 &&!src.includes("openPicker(a,'talents')")&&src.includes("const arbresDialog=dialog('arbres','Arbres de talents','<p class=\"muted\" id=\"arbres-note\"></p><div id=\"arbres-corps\"></div>');")
 &&src.includes('function openArbres(a){a=acteurCourant(a);if(!peutVoirArbres(a))return;arbresActeur=a;arbresClasse=null;')&&src.includes("const classe=classeDuHeros(a),toutes=talentFamilies();")
 &&!src.includes('assureMaitrises')&&!src.includes('maitrisesDe')&&!src.includes('arbre-maitrises')&&!feuille.includes('arbre-maitrises')
 &&src.includes("t.voie=typeof t.voie==='string'?t.voie.trim().slice(0,60):'';")&&!src.includes("+sel('Spécialisation','voie'")
 &&src.includes("else if(talentFamily(avant)!==talentFamily(t)){t.voie='';t.prerequis='';delete t.pos;delete t.liens}")
 &&src.includes("if(!avant){const d=talentDefauts||{};t.voie=d.voie||'';t.prerequis='';if(d.chemin)t.chemin=d.chemin;")
 &&feuille.includes('#arbres{width:fit-content;max-width:96vw}')
 &&feuille.includes('.arbre-titre{width:100%;')&&feuille.includes('clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),50% 100%,0 calc(100% - 8px))}')
 &&feuille.includes('.arbre-noeud.acquis .arbre-rond::after{content:\'✓\';')&&feuille.includes('.arbre-noeud.verrou{opacity:.45;cursor:not-allowed}')
 &&feuille.includes('.hero-sous .ico.plus.rouage{')&&feuille.includes('.cat-pill .tag.voie{'),'arbres de talents : rouage, popup, voie au formulaire, plus de maîtrise d’office');
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const ctx={catalog:{classes:[{name:'Gardien',tint:'#3f7bc0'}],talents:[
   {id:'m',name:'Maîtrise du bouclier',famille:'Gardien',type:'mait',level:1,voie:''},
   {id:'b',name:'Rempart de fer',famille:'Gardien',type:'ame',level:3,voie:'Rempart'},
   {id:'a',name:'Rempart',famille:'Gardien',type:'act',level:1,voie:'Rempart'},
   {id:'c',name:'Charge',famille:'Gardien',type:'act',level:2,voie:'Assaut'},
   {id:'d',name:'Souffle',famille:'Gardien',type:'pass',level:1,voie:''},
   {id:'e',name:'Serment',famille:'Gardien',type:'pass',level:2,voie:'Serment'},
   {id:'f',name:'Foi',famille:'Gardien',type:'pass',level:2,voie:'Quatrième'},
   {id:'g',name:'Vigilance',famille:'',type:'pass',level:1,voie:''}]},
  cleClasse:C.cleClasse,ordonneTalents:C.ordonneTalents,talentCode:C.talentCode,manqueTalent:C.manqueTalent,talentsDependants:C.talentsDependants,VOIES_MAX:3,LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],
  crypto:{randomUUID:(()=>{let n=0;return ()=>'case'+(++n)})()}};
 vm.createContext(ctx);
 vm.runInContext(morceau('const TALENT_TYPES=','function talent(id)')+'const estBonus=t=>!!t&&t.effet===\'bonus\';'+morceau('function talentFamilies()',"// L'encre d'une classe")
  +morceau('/* Une classe a toujours toutes ses colonnes','const arbresDialog='),ctx);
 // Trois voies au plus, dans l'ordre du catalogue ; la quatrième n'existe pas pour l'arbre.
 // Trois rangs, toujours : nommés, ou vides en attendant qu'on les baptise.
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['Rempart','Assaut','Serment']));
 assert.equal(JSON.stringify(ctx.voiesDe('Mystique')),JSON.stringify(['','','']));
 assert.equal(JSON.stringify(ctx.voiesNommees('Mystique')),'[]');
 assert.equal(ctx.rangDAccueil('Mystique'),0,'sans nom, le premier rang accueille les sans-voie');
 assert.equal(ctx.rangDAccueil('Gardien'),0,'tous nommés : les orphelins reviennent au premier');
 // Une Gardienne trouve la colonne Gardien ; sans classe, pas de colonne.
 assert.equal(ctx.classeDuHeros({role:'Gardienne · niveau 2'}),'Gardien');
 assert.equal(ctx.classeDuHeros({role:'Gardien'}),'Gardien');
 assert.equal(ctx.classeDuHeros({role:''}),null);
 assert.equal(ctx.classeDuHeros({role:'Barde'}),null);
 // Les colonnes : une par voie ; la maîtrise y est comme les autres ; sans case, l'ordre du catalogue.
 const cols=ctx.colonnesArbre('Gardien');
 assert.equal(cols.length,3,'trois colonnes, ni plus ni moins');
 assert.equal(JSON.stringify(cols.map(c=>c.titre)),JSON.stringify(['Rempart','Assaut','Serment']));
 // Toutes les voies sont nommées : les talents sans voie reviennent au premier rang.
 assert.equal(JSON.stringify(cols.map(c=>c.liste.map(t=>t.id))),JSON.stringify([['m','b','a','d','f'],['c'],['e']]));
 assert.equal(cols[0].famille,'Gardien');assert.equal(cols[0].rang,0);assert.equal(cols[2].rang,2);
 {const vides=ctx.colonnesArbre('Mystique');
  assert.equal(vides.length,3,'une classe sans voie a quand même ses trois colonnes');
  assert.equal(JSON.stringify(vides.map(c=>c.titre)),JSON.stringify(['Tronc commun','Spécialisation 2','Spécialisation 3']));}
 // Chargé, le catalogue nomme les voies que ses talents portaient : ici, on le fait à la main.
 ctx.catalog.voies={Gardien:ctx.voiesDe('Gardien')};
 const T=id=>ctx.catalog.talents.find(t=>t.id===id);
 // Placer un talent : dans une case ; prise, les deux échangent ; « de » trace la ligne qui y mène.
 assert.equal(ctx.placerTalent('c',{famille:'Gardien',voie:'Rempart',pos:{x:0,y:0}}),true);
 assert.equal(T('c').voie+'|'+T('c').prerequis+'|'+JSON.stringify(T('c').pos),'Rempart||{"x":0,"y":0}');
 assert.equal(ctx.placerTalent('a',{famille:'Gardien',voie:'Rempart',pos:{x:0,y:0}}),true);
 assert.equal(JSON.stringify(T('a').pos),'{"x":0,"y":0}');assert.equal(JSON.stringify(T('c').pos),'{"x":0,"y":1}','la case prise : l’autre descend d’un cran');
 assert.equal(ctx.placerTalent('b',{famille:'Gardien',voie:'Rempart',pos:{x:1,y:0}}),true);
 assert.equal(ctx.placerTalent('b',{famille:'Gardien',voie:'Rempart',pos:{x:0,y:1}}),true);
 assert.equal(JSON.stringify(T('b').pos)+JSON.stringify(T('c').pos),'{"x":0,"y":1}{"x":1,"y":0}','dans le même arbre, deux talents échangent leurs cases');
 assert.equal(ctx.placerTalent('d',{famille:'Gardien',voie:'Rempart',de:'a'}),true);
 assert.equal(JSON.stringify(T('d').pos),'{"x":-1,"y":0}','à côté de a, la première case voisine libre : dessous et à droite sont pris, puis à gauche');
 assert.equal(JSON.stringify(T('a').liens),'["d"]','la ligne part de a');
 assert.equal(ctx.placerTalent('f',{famille:'Gardien',voie:'Rempart',de:'a'}),true);
 assert.equal(ctx.placerTalent('e',{famille:'Gardien',voie:'Rempart',de:'a'}),true);
 assert.equal(JSON.stringify(T('a').liens),'["d"]','jamais au-dessus : sans case voisine libre, les suivants se posent plus bas, sans ligne');
 assert.equal(JSON.stringify(ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id)),JSON.stringify(['d','a','c','b','e','f','m']),'de haut en bas, de gauche à droite ; sans case, en dernier');
 assert.equal(ctx.placerTalent('d',{famille:'',voie:''}),true);
 assert.equal(T('d').famille,'Génériques','sans classe, un générique');assert.equal(T('d').pos===undefined||!!T('d').pos,true);
 assert.equal(JSON.stringify(T('a').liens),'["case1"]','parti ailleurs, ses lignes restent à sa case, vide');
 {const v=T('case1');assert.ok(v&&v.vide===true&&JSON.stringify(v.pos)==='{"x":-1,"y":0}','la case vide tient sa place');
  ctx.catalog.talents.splice(ctx.catalog.talents.indexOf(v),1);delete T('a').liens}
 assert.equal(ctx.placerTalent('zzz',{famille:'Gardien'}),false);
 // Tracer, effacer : vers une case voisine droite seulement, jamais vers soi.
 assert.equal(ctx.basculeLien(T('a'),T('b')),'ajoute');assert.equal(ctx.basculeLien(T('a'),T('c')),'ajoute');
 assert.equal(ctx.basculeLien(T('a'),T('e')),'loin','deux cases plus bas : pas de ligne');
 assert.equal(ctx.basculeLien(T('a'),T('b')),'retire');assert.equal(JSON.stringify(T('a').liens),'["c"]');
 assert.equal(ctx.basculeLien(T('a'),T('a')),'rien');assert.equal(ctx.basculeLien(null,T('a')),'rien');
 // Les voies nommées : trois par classe, renommées sur leurs talents, dissoutes vers le tronc.
 assert.equal(ctx.enregistreVoie('Mystique','Feu'),true);assert.equal(ctx.enregistreVoie('Mystique','Feu'),true,'déjà là : rien à redire');
 assert.equal(ctx.enregistreVoie('Mystique','Givre'),true);assert.equal(ctx.enregistreVoie('Mystique','Onde'),true);
 assert.equal(ctx.enregistreVoie('Mystique','Foudre'),false,'quatrième refusée');
 assert.equal(JSON.stringify(ctx.voiesDe('Mystique')),JSON.stringify(['Feu','Givre','Onde']));
 assert.equal(ctx.enregistreVoie('Mystique','  '),false);
 // Baptiser un rang, le renommer, lui reprendre son nom : ses talents suivent à chaque fois.
 assert.equal(ctx.renommerVoie('Gardien','Rempart','Mur'),true);
 assert.equal(T('a').voie,'Mur');
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['Mur','Assaut','Serment']));
 assert.equal(ctx.renommerVoie('Gardien','Mur','Assaut'),false,'un nom déjà pris');
 assert.equal(ctx.nommerVoie('Gardien',0,'Mur'),false,'le même nom ne change rien');
 assert.equal(ctx.dissoudreVoie('Gardien','Mur'),true);
 assert.equal(T('a').voie,'','ses talents rejoignent le tronc commun');
 assert.equal(T('m').voie,'','la maîtrise aussi, comme tout talent');
 assert.equal(JSON.stringify(ctx.voiesDe('Gardien')),JSON.stringify(['','Assaut','Serment']),'le rang reste, sans nom');
 assert.equal(ctx.colonnesArbre('Gardien').length,3);
 assert.equal(ctx.colonnesArbre('Gardien')[0].titre,'Tronc commun');
 // Nommer le rang qui héberge les sans-voie les emmène avec lui : rien ne disparaît de l'arbre.
 {const avant=ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id);
  assert.ok(avant.includes('a'),'le tronc commun tient les sans-voie');
  assert.equal(ctx.nommerVoie('Gardien',0,'Protection'),true);
  assert.equal(T('a').voie,'Protection');assert.equal(T('m').voie,'Protection');
  assert.equal(JSON.stringify(ctx.colonnesArbre('Gardien')[0].liste.map(t=>t.id)),JSON.stringify(avant));}
 assert.equal(ctx.nommerVoie('Gardien',7,'Ailleurs'),false,'il n’y a que trois rangs');
 // Ce qu'attend un talent, ce qui tombe avec lui : les lignes font foi.
 {const L=[{id:'r',name:'Racine',liens:['p','q']},{id:'p',name:'Pierre',liens:['z']},{id:'q',name:'Quartz',liens:['z']},{id:'z',name:'Zénith',liens:['w']},{id:'w',name:'Ouest'},{id:'h',name:'Hors'}];
  const t=id=>L.find(x=>x.id===id);
  assert.equal(ctx.verrouArbre([],L,t('r')),'','sans ligne qui mène à lui : un départ');
  assert.equal(ctx.verrouArbre([],L,t('h')),'','un talent isolé aussi');
  assert.equal(ctx.verrouArbre([],L,t('p')),'Racine');assert.equal(ctx.verrouArbre(['r'],L,t('p')),'');
  assert.equal(ctx.verrouArbre([],L,t('z')),'Pierre ou Quartz','deux lignes mènent à Zénith : l’une ou l’autre');
  assert.equal(ctx.verrouArbre(['q'],L,t('z')),'');
  assert.equal(JSON.stringify(ctx.entreesDe(L,t('z')).map(x=>x.id)),'["p","q"]');
  assert.equal(JSON.stringify(ctx.chuteArbre(['r','p','q','z','w'],L,t('p')).map(x=>x.id)),'[]','Quartz tient encore Zénith');
  assert.equal(JSON.stringify(ctx.chuteArbre(['r','p','z','w'],L,t('p')).map(x=>x.id)),'["z","w"]','sans Pierre, plus rien ne mène à Zénith');
  assert.equal(JSON.stringify(ctx.chuteArbre(['r','p','q','z','w'],L,t('r')).map(x=>x.id)),'["p","q","z","w"]','la racine emporte tout');
  assert.equal(JSON.stringify(ctx.chuteArbre(['z','w'],L,t('p')).map(x=>x.id)),'["z","w"]','sans exception : ce qu’aucun talent tenu ne rattache au départ tombe');
  // Une ligne n'a pas de sens : tracée du bas vers le haut, elle tient quand même ce qui est dessous.
  {const R=[{id:'a',name:'Haut',pos:{x:0,y:0},liens:['b']},{id:'b',name:'Milieu',pos:{x:0,y:1}},{id:'c',name:'Bas',pos:{x:0,y:2},liens:['b']},{id:'e',name:'Côté',pos:{x:1,y:1},liens:['b','a']}],u=id=>R.find(x=>x.id===id);
   assert.equal(JSON.stringify([...ctx.departsDe(R)]),'["a"]','le plus haut du groupe est le départ');
   assert.equal(ctx.verrouArbre([],R,u('c')),'Milieu');assert.equal(ctx.verrouArbre(['a'],R,u('c')),'Milieu');assert.equal(ctx.verrouArbre(['a','b'],R,u('c')),'');
   assert.equal(JSON.stringify(ctx.chuteArbre(['a','b','c','e'],R,u('b')).map(x=>x.id)),'["c"]','Milieu oublié, Bas ne tenait que par lui ; Côté tient par Haut');
   assert.equal(JSON.stringify(ctx.chuteArbre(['a','b','c'],R,u('a')).map(x=>x.id)),'["b","c"]','le départ emporte tout');}
  // La case libre : sous un talent, dessous puis en diagonale ; sans talent, sous l'arbre, au milieu.
  const P=[{pos:{x:0,y:0}},{pos:{x:0,y:1}},{pos:{x:2,y:0}}];
  assert.equal(JSON.stringify(ctx.caseLibre(P,P[0])),'{"x":1,"y":0}');
  assert.equal(JSON.stringify(ctx.caseLibre(P,P[2])),'{"x":2,"y":1}');
  assert.equal(JSON.stringify(ctx.caseLibre(P,null)),'{"x":1,"y":2}');
  assert.equal(JSON.stringify(ctx.caseLibre([],null)),'{"x":0,"y":0}');}}
/* L'arbre s'édite en place : les voies vivent au catalogue, un talent créé depuis une case arrive
   déjà rangé et relié, le formulaire refermé redessine l'arbre, le glisser-déposer déplace. */
assert.ok(src.includes("const voies=c.voies&&typeof c.voies==='object'&&!Array.isArray(c.voies)?c.voies:{};")&&src.includes('const VOIES_MAX=2;')
 &&src.includes("if(!l.includes(t.voie)&&l.length<(c.nbArbres[f]===1?1:VOIES_MAX))c.voies[f]=[...l,t.voie]});")&&!src.includes('function descendDe(')
 &&src.includes('function openTalent(i=null,apres=null,defauts=null)')&&src.includes(",...(defauts||{})}:catalog.talents[i];")
 &&src.includes("if(typeof arbresDialog!=='undefined'&&arbresDialog.open)renderArbres()});")&&src.includes('function placerTalent(id,dest)')
 &&src.includes("el.addEventListener('dragstart',e=>{arbreGlisse=t.id;el.classList.add('tire');corps.classList.add('glisse');")&&src.includes("glissable(el,t);cible(el,{famille:col.famille,voie:col.voie,pos:posDe(t),soi:t.id});")
 &&src.includes("cible(p,{famille:col.famille,voie:col.voie,pos:{x:pl.x,y:pl.y}});return p};")
 &&src.includes("cible(h,{famille:c.famille,voie:c.voie});")&&src.includes("champVif(nomVoie,()=>c.voie,v=>{if(nommerVoie(c.famille,c.rang,v))arbreChange();")&&src.includes("nomVoie.classList.toggle('vierge',!c.voie);")&&feuille.includes('.arbre-titre .arbre-voie.vierge{')&&src.includes("if(supprimerArbre(c.famille,c.rang))arbreChange()")
 &&src.includes("{famille:talentFamily(t),voie:t.voie||'',de:t.id,level:Math.min(20,(t.level||1)+1)})));")
 &&src.includes("if(!avant&&talentDefauts&&talentDefauts.de){const de=talent(talentDefauts.de);")
 &&!src.includes('+ Spécialisation')&&!src.includes('arbre-col nouvelle')
 &&src.includes(" (classe?colonnesArbre(classe):[]).filter(c=>!(a&&elementaire&&!c.liste.length)).forEach(c=>grille.append(colonne(c,classe===GENERIQUES)));")
 &&!src.includes("grille.append(colonne(colonneArbre(GENERIQUES,GENERIQUES,")
 &&src.includes("const oublier=(t,liste)=>{")&&src.includes("const chute=[t,...(liste?chuteArbre(avant,liste,t):[])];")
 &&!feuille.includes('arbre-entre')&&!feuille.includes('arbre-enfants')&&!feuille.includes('arbre-etage')
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
 assert.ok(C.phraseTalent('provocation',{}).includes('<b>en ligne de vue</b>')&&C.phraseTalent('provocation',{}).includes('jusqu’à son <b>contact</b>.'));
 assert.ok(C.TALENTS_CODES.provocattaque.type==='ame'&&C.TALENTS_CODES.provocsol.type==='ame','les améliorations de Provocation : le coup, la chute');
 assert.equal(C.cleTalent('Attaque État'),'attaqueetat','un talent nommé ainsi trouve son effet');}
/* Le mouvement forcé d'une Provocation coûte comme un autre : ce que le provoqué quitte le
   frappe, y compris les zones traversées en chemin, et tombé en route il n'y a plus de coup. */
assert.ok(page.includes('const croises=new Set(contactsDe(b)),depart={x:b.x,y:b.y};')
 &&page.includes('if(venu)ramasseContacts(b,croises,depart,mapSize(),walls());')
 &&page.includes('if(venu)degatsOpportunite(b,[...croises]);')
 &&page.includes("if(!alive(b)){log(nomNum(b)+' tombe en chemin : le coup ne part pas.',{ton:'degats'});"),'la Provocation paie ses dégâts d’opportunité');
assert.ok(page.includes('function attack(opts={})')&&page.includes('if(opts.vises){vises=ciblesAtteignables(a,opts.vises,portee);')&&page.includes('const vivants=vises.filter(j=>alive(actors[j]));')
 &&page.includes('if(opts.apres)opts.apres({vises,partis,tues:vivants.filter(j=>!alive(actors[j]))});')
 &&page.includes('function attaqueEtat(a,p,talent)')&&page.includes("const survit=p.condition==='survit',gagne=survit?tues.length<vises.length:tues.length>0;")
 &&page.includes('const issue=infligeEtat(a,p.etat);')&&page.includes('function cibleProvocation(a)')&&page.includes('function rapprocher(b,a)')
 &&page.includes('const arret=tokenOf(a)/2+tokenOf(b)/2+1;')&&page.includes('if(d<=arret+1)return false;')
 &&page.includes("if(el){el.classList.add('glisse');el.style.left=b.x+'%';el.style.top=b.y+'%';suitLaJauge(el)}")&&page.includes('function provocation(a,p,talent)')
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
 &&src.includes("dit.textContent='⚠ Sans effet : requiert « '+manque+' », que '+a.name+' n’a pas appris.';detail.firstChild.after(dit)}")
 &&feuille.includes('.cat-pill.sans-effet{filter:saturate(.4)}')&&feuille.includes('.talent-detail .sans-effet-dit{font-weight:700;color:#b03828}'),'un talent sans effet le dit');
/* Le joueur ouvre les arbres de son aventurier, sans les outils du MJ ; les « + » du MJ ne
   paraissent plus chez lui, et son choix de talents part à la table avec sa fiche. */
/* Les fiches se remplacent en bloc quand la scène publiée ou la table arrive : le rouage
   d'une page dessinée avant tenait l'ancienne, et restait muet chez un joueur. La fiche se
   retrouve par son identifiant. */
assert.ok(src.includes('function acteurCourant(a){if(!a||actors.includes(a))return a;return actors.find(x=>x&&x.id===a.id)||a}')
 &&src.includes('function peutVoirArbres(a){a=acteurCourant(a);return !!a&&!!a.hero&&(view===\'mj\'||actors.indexOf(a)===owner)}')
 &&src.includes(' if(arbresActeur)arbresActeur=acteurCourant(arbresActeur);')
 &&fs.readFileSync('shared.js','utf8').includes("if(typeof renderCatalogPages==='function')renderCatalogPages();")
 &&src.includes('function openArbres(a){a=acteurCourant(a);if(!peutVoirArbres(a))return;arbresActeur=a;arbresClasse=null;')
 &&src.includes("if(a){a.talents??=[];if(!peutVoirArbres(a)){arbresDialog.close();return}")
 &&src.includes("const mien=view==='mj'||actors.indexOf(a)===owner;")
 &&src.includes("const titreTal=sousTitre('Talents','Arbres de talents de '+a.name,mien?()=>openArbres(a):null,'⚙');")
 &&src.includes("const titreKit=sousTitre('Inventaire','Ajouter à l’inventaire de '+a.name,view==='mj'?()=>openPicker(a,'gear'):null);")
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
assert.ok(page.includes("&&(!adverses||hostiles(o,a))")
 &&page.includes('function settleActor(a,ignorer)')&&page.includes('const tiennent=alive(a)&&!traverse?soclesOccupes(a,size,ignorer,false):[];')
 /* L'adversaire barre : on s'arrête devant lui, on ne glisse pas sur son flanc. Les murs,
    eux, se longent toujours — c'est ce qui assure le passage des portes. */
 &&!page.includes('ecarteDesSocles(suivant,barrent,r)')&&page.includes(' if(segmentHitsPolys(last,suivant,polys))break;')
 &&page.includes('if(barrent.length&&(dansUnSocle(suivant,barrent,r)||segmentCoupeSocles(last,suivant,barrent,r)))break;')
 &&page.includes('if(tiennent.length)last=poserHorsDesSocles(last,tiennent,polys,r);')
 &&page.includes("const enMain=new Set(lot.map(k=>actors[k]&&actors[k].id).filter(Boolean));")
 &&page.includes("moveActor(o,o.x+dx,o.y+dy,view==='mj',enMain,true)})}")&&page.includes("else{const g=drag.regle?borneMouvement(drag.regle,q):q;moveActor(a,g.x,g.y,view==='mj',enMain,true);")
 &&page.includes("const [x,y]=ecarteDesSocles(px(a.x,a.y),soclesOccupes(a,size,ignorer,!!traverse),tokenOf(a)/2);"),'les socles tiennent la place sur la table ; pendant le geste, les siens se traversent');
/* La fiche en jeu : plus de barre sous les PV, l'équipement ouvert d'office et les talents
   repliés ; l'attaque d'équipement s'appelle « Attaque » ; un talent qui frappe porte les dés,
   le bonus et son jeton, comme une attaque ; l'Onde du camp lève les états comme le bouton Soin. */
assert.ok(!page.includes('<details class="bloc-replie" id="bloc-gear">')&&page.includes('<details class="bloc-replie" id="bloc-talents" open>')
 &&feuille.includes('.bloc-replie,.bloc-fixe{margin:6px 0}')&&feuille.includes(".bloc-replie .bloc-titre,.bloc-fixe .bloc-titre{font:700 15px 'Killam'")
 &&(page.match(/class="divider"/g)||[]).length===2,'fiche en jeu : équipement ouvert, pas de barre sous les PV');
assert.ok(src.includes("const libelle=at.gear&&a.hero?'Attaque':(at.name||'Attaque');")
 
 &&page.includes('des:eff.des?eff.des(a,params):code.attaque?activeAttack(a).dice:null,')
 
 &&C.TALENTS_CODES.attaqueetat.attaque===true&&C.TALENTS_CODES.provocation.attaque===true
 &&!C.TALENTS_CODES.orbes.attaque,'le bouton d’attaque dit « Attaque », le talent qui frappe montre ses dés');
/* L'Onde d'un camp lève les états avec les blessures, et prend aussi celui qui n'a rien perdu
   mais porte une affliction — empoisonné au complet, il restait sur le carreau. */
assert.ok(page.includes("const soignes=actors.filter(a=>(hero?duCoteTroupe(a):campDe(a)==='adverse')&&!estMort(a)&&(a.hp<a.max||statesOf(a).length));")
 &&page.includes("soignes.forEach(a=>{if(a.hp<a.max)rendus++;a.hp=a.max;setState(a,'Coma',false);")&&page.includes("if(typeof reposer==='function')reposer(a,'long');else a.usages={};   // l'Onde vaut un repos long")
 &&page.includes("' remis d’aplomb'+(rendus?' : PV au complet':'')+(leves?(rendus?', ':' : ')+'états levés':'')+'.'")
 &&!page.includes('const blesses=actors.filter'),'l’Onde du camp lève les états, même sans blessure');
/* La jauge de PV est un fil, et le même pour tous les socles — l'actif n'y fait rien. */
/* v0.306 : sans bordure qui mange la hauteur — le liseré passe en ombre —, le rempli occupe
   les 4 px du fil et ne s'arrondit plus à rien. */
assert.ok(page.includes('#pv-layer .pv{position:absolute;transform:translate(-50%,-100%);margin-top:calc(var(--token) / -2 - 1.5px);width:calc(var(--token) * .96);height:3.2px;')
 &&!page.includes('.token.selected .pv'),'la jauge est fine et pareille pour tous');
/* L'arbre d'une classe s'ouvre depuis l'onglet Talents, par le rouage posé contre son nom :
   sans combattant, nul n'y porte rien, le clic sur un talent le corrige, et la Provocation
   ne pose plus de bandeau en travers de la carte. */
assert.ok(src.includes('let arbresActeur=null,arbresClasse=null,arbreGlisse=null,arbresVueJoueur=false;')
 &&src.includes("function openArbresClasse(famille){if(view!=='mj'||!aUnArbre(famille))return;arbresActeur=null;arbresClasse=famille||GENERIQUES;")
 &&src.includes("function renderArbres(){const corps=$('arbres-corps');if(!corps||(!arbresActeur&&!arbresClasse))return;queueMicrotask(gardeDefilement(arbresDialog));corps.replaceChildren();")
 &&src.includes("const classe=a?classeDuHeros(a):arbresClasse;")&&src.includes("const porte=t=>!!a&&a.talents.includes(t.id);")
 &&src.includes("el.onclick=()=>{if(!a){if(mj)openTalent(catalog.talents.indexOf(t),renderArbres);return}")
 &&src.includes("const el=noeud(t,!a?'modele':acquis?'acquis':verrou?'verrou':'dispo',verrou);")
 &&src.includes("rouage.textContent='⚙';rouage.title='Arbre de talents — '+famille;")
 &&src.includes("rouage.onclick=e=>{e.stopPropagation();openArbresClasse(famille)};h.append(rouage);")
 /* Le nom de la classe ouvre le même arbre, un clic hors de la fenêtre la referme, et ni
    l'intitulé ni la notice d'édition ne paraissent sur l'arbre d'une classe. */
 &&src.includes("h.onclick=()=>openArbresClasse(famille)}")
 &&src.includes("arbresDialog.addEventListener('click',e=>{if(e.target===arbresDialog)arbresDialog.close()});")
 &&src.includes("titre.textContent='Arbres de talents — '+(a?a.name:classe);titre.hidden=true;")&&!src.includes("$('arbres-note').hidden=!a;")&&src.includes("function noteArbres(texte){const n=$('arbres-note');n.textContent=texte||'';n.hidden=!texte}")
 &&!src.includes('NOTE_ARBRES')&&feuille.includes('.arbre-noeud.modele{cursor:pointer}')
 &&feuille.includes('.cat-col>h3 .ico.plus.rouage{')
 &&!page.includes("annonceFlottante('📣 '"),'l’arbre d’une classe s’ouvre depuis l’onglet Talents');
/* Trois mécaniques de plus : Ignition charge un allié désigné d'un orbe, Invulnérable refuse
   une affection au porteur, Brise ouvre la garde d'une cible affligée. Aucune n'exige de
   socle : le MJ nomme le prérequis dans le talent qu'il écrit. */
{const ig=C.TALENTS_CODES.ignition,inv=C.TALENTS_CODES.invulnerable,br=C.TALENTS_CODES.brise;
 assert.ok(ig&&ig.type==='ame'&&ig.requiert===undefined&&!ig.params.length,'Ignition ne se règle pas, et ne s’impose pas de socle');
 assert.ok(inv&&inv.type==='ame'&&inv.params.map(p=>p.cle).join()==='contre,etat,des'&&br&&br.type==='ame'&&br.params[0].cle==='etat','Invulnérable (un état ou une couleur de dés) et Brise se règlent sur un état');
 assert.ok(C.phraseTalent('ignition',{}).includes('<b>allié désigné</b>')&&C.phraseTalent('invulnerable',{etat:'Poison'}).includes('<b>jamais Poison</b>')
  &&C.phraseTalent('brise',{etat:'Gel'}).includes('<b>ignorent sa DEF</b>'),'chacune se dit en une phrase');
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
 &&page.includes("l.lastChild.textContent=' '+LIBELLES_POINTS[i]+(s&&max>1?' '+pointsRestants(s,quoi)+'/'+max:'')});")&&!page.includes('a.checks=[false,false,false]')
 &&vivant.includes("'checks','points','ignition','immunites','usages','cibles'"),'les points d’activation se comptent');
/* Ignition à la table : l'orbe part sur l'allié désigné, ne blesse pas, et sa braise s'en va
   avec le premier coup au contact. Invulnérable et Brise s'entendent dans le journal. */
assert.ok(page.includes('function alliePourIgnition(a)')&&page.includes("const j=ciblesDe(a).find(k=>vus.includes(k)&&actors[k]&&memeCamp(actors[k],a)&&actors[k]!==a);")
 &&page.includes('if(allie!==null){const feu=etat||\'Feu\';')&&page.includes("const poser=()=>{b.ignition=feu;floatNumber(b,'✦ '+feu,'gain');")
 &&page.includes("const charge=(rangeOf(a)==='distance'?'':a.ignition)||'';")&&page.includes("if(charge)a.ignition='';")
 &&page.includes('const infligeEtatBrut=infligeEtat;')
 &&page.includes('const brise=briseContre(talentsCodes(a),b),ouverte=brise.ignore;')&&page.includes("const def=hasState(b,'Au sol')||ouverte?0:defOf(b);")&&page.includes("(immunises.length?' Invulnérable : '+immunises.join(', ')+' sans effet.':'')"),'Ignition, Invulnérable et Brise câblés');
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
 &&src.includes('function retireBulle(){bulleEpinglee=false;if(!bulleEl)return;')
 &&src.includes('function bulleOrpheline(){if(BULLES)requestAnimationFrame(()=>{if(bulleEl&&bulleAncre&&!bulleAncre.isConnected)fermerBulle()})}')
 &&src.includes("rangees(equipement,'');rangees(objets,combat?'':'Objets');bulleOrpheline();")&&src.includes(' bulleOrpheline();return out}')
 &&src.includes("if(!equipable){if(BULLES){if(!tout)basculeEpingle(p,montre)}else basculer();return}")
 // Le chevron des vignettes de talent d'une fiche ne dépliait que l'ancien dépliant.
 &&!src.includes("chev.textContent='⌄'")&&src.includes('surveille(pill,montre);out.append(carte)});')
 &&src.includes('function fermerBulle()')&&src.includes("document.addEventListener('pointerdown',bulleDehors,true);")
 &&src.includes("document.addEventListener('keydown',bulleEchap,true);")&&src.includes(" e.preventDefault();e.stopPropagation();fermerBulle()}")&&src.includes("window.addEventListener('scroll',fermerBulle,true);window.addEventListener('resize',fermerBulle)")
 &&src.includes("if(!bulleAncre.isConnected||(!r.width&&!r.height)){fermerBulle();return}")&&src.includes("function ancreVisible(el){return !!el&&el.isConnected&&(!!el.offsetParent||(el instanceof SVGElement&&el.getClientRects().length>0))}")&&src.includes('const dessous=r.top-b.height-12<marge;')
 &&src.includes("bulleEl.style.setProperty('--fleche',")
 // Les deux chemins cohabitent : la bulle, et le dépliant d'avant si l'on repasse BULLES à faux.
 &&src.includes("if(BULLES&&ouvert)requestAnimationFrame(()=>{if(bulleEl&&gearOuvert===cle&&ancreVisible(p))reposeBulle(montre)});")
 &&src.includes("out.append(p);if(!BULLES)details.push(p.detailPlie)});")&&src.includes("surveille(pill,montre);out.append(carte)});")
 &&src.includes('let talentOuvert=null;')&&src.includes("const cle=(a.id||'?')+'|'+t.id;")
 &&src.includes("if(talentOuvert===cle)requestAnimationFrame(()=>{if(bulleEl&&talentOuvert===cle&&ancreVisible(pill))montre()});")
 &&!src.includes('talentsOuverts')
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
 &&src.includes("o.effet=OBJETS_CODES[o.effet]?o.effet:'';")&&src.includes("o.usage=usageObjet(o);o.consumable=o.usage==='conso';")
 &&src.includes("+sel('Usage','usage',usageObjet(a),USAGES_OBJET)")&&src.includes('function dessineReglagesObjet()')
 &&src.includes("a.params=a.effet?paramsObjet({effet:a.effet,params:lireReglagesObjet()}):{};")&&!src.includes(">Consommable</label>')")
 &&src.includes('function usageEpuise(a,o)')&&src.includes("function objetDisponible(a,o){return !usageLimite(usageObjet(o))||!usageEpuise(a,o)}")
 &&src.includes('function appliquerEffetObjet(a,o)')&&src.includes("if(usageLimite(usage)){a.usages={...(a.usages||{}),[o.id]:usage}}")
 &&src.includes("if(usage==='conso')retirerInventaire(a,o);")&&src.includes('if(objetCode(o)){appliquerEffetObjet(a,o);return}')
 &&src.includes("a.immunites=immunites(a);a.usages=a.usages&&typeof a.usages==='object'?a.usages:{};")
 &&page.includes('function desRecus(b,dice)')&&page.includes('const {gardes:dice,ecartes}=desRecus(b,tous);')
 &&page.includes('const suite=domDit+perilDit+ditEcartes(ecartes)+')&&page.includes('const {gardes:dice,ecartes:orbeEcartes}=desRecus(b,tous);')
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
 &&!src.includes("el.className='btn-action choix-attaque btn-objet teinte-propre';")
 &&src.includes("boite.hidden=!liste.length&&!talents.length;")
 &&!src.includes('a.armorId=')&&!src.includes('draft.armorId'),'les emplacements du corps et les boutons d’objets');
/* Un usage compté porte son chrono, en pastille à cheval sur le coin haut droit de son
   bouton : il dit que la charge se rend au repos, et le MJ la rend — ou la reprend — d'un
   clic. Les joueurs, non : leur bouton épuisé est désactivé, et rien dedans ne se clique. */
assert.ok(src.includes('function rendreUsage(a,o){')&&src.includes("if(view!=='mj'||!a||!o||!usageEpuise(a,o))return false;")
 &&src.includes('function prendreUsage(a,o){')&&src.includes("if(view!=='mj'||!a||!o||!usageLimite(usageObjet(o))||usageEpuise(a,o))return false;")
 &&src.includes("function reposer(a,type='long'){")&&src.includes("if(type==='long'||quoi==='court')rendues.push(id);else garde[id]=quoi});")
 &&!src.includes("(a?boutonsObjets(a):[]).forEach(")
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
 assert.equal(D.finances.tresor,0);assert.deepEqual(D.finances.journal,[]);assert.deepEqual(D.carte.calques,Array(9).fill(null));
 assert.equal(D.carte.ratio,16/9);assert.deepEqual(D.pnj,[]);assert.equal(D.nom,'Le Domaine');assert.equal(D.monnaie,'or');
 // Un domaine abîmé se relit borné : étapes dans [0,3], zones valides ou rien, journal court.
 const G=C.normaliseDomaine({nom:42,batiments:[{nom:'Forge',etape:7,zone:[[0,0],[200,-5],[10,10]],couts:['a',5,-3]},{etape:-2,zone:[[0,0],[1,1]]},null],
  carte:{calques:['a',null,3,''],ratio:'x'},finances:{tresor:'12.9',journal:Array.from({length:250},(_,i)=>({t:i,libelle:'l'+i,montant:1}))},
  pnj:[{nom:'Brenn',statut:'roi'},{statut:'visiteur'}],aventuriers:{h1:{lieu:'x',notes:'n'}}});
 assert.equal(G.nom,'42');assert.equal(G.batiments.length,2);assert.equal(G.batiments[0].etape,3);assert.deepEqual(G.batiments[0].zone,[[0,0],[100,0],[10,10]]);
 assert.deepEqual(G.batiments[0].couts,[0,5,0]);assert.equal(G.batiments[1].etape,0);assert.equal(G.batiments[1].zone,null);assert.equal(G.batiments[1].nom,'Bâtiment');
 assert.deepEqual(G.carte.calques,['a',...Array(8).fill(null)]);assert.equal(G.carte.ratio,16/9);assert.equal(G.finances.tresor,12);assert.equal(G.finances.journal.length,200);
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
 assert.ok(cartes.includes("const PAGES=['table','maps','domaine','heroes','talents','armory','bestiary','icones','settings'];")
  &&cartes.includes('<button data-page="domaine">Domaine</button>')&&cartes.includes("else if(p==='domaine')renderDomaine();")
  &&cartes.includes("if(typeof domaineEdite!=='undefined'&&domaineEdite){renderMapList();renderDomaineEditeur()}")
  &&cartes.includes("const editeDomaine=()=>typeof domaineEdite!=='undefined'&&domaineEdite;")
  &&(cartes.match(/\|\|editeDomaine\(\)/g)||[]).length===4,'l’onglet Domaine, MJ seul, et l’éditeur de combat cède ses touches');
 assert.ok(fief.includes('let domaine=normaliseDomaine(null);')
  &&fief.includes('snapshot=function(){return Object.assign(snapshotSansDomaine(),{domaine})};')
  &&fief.includes('appliquerSauvegarde=function(s){appliquerSansDomaine(s);const d=normaliseDomaine(s&&s.domaine);')
  &&src.includes("if(s.domaine!=null&&(typeof s.domaine!=='object'||Array.isArray(s.domaine)))return 'Le domaine de la sauvegarde est illisible.';")
  &&/domaine:typeof domaine!=='undefined'/.test(partage)&&!/\bdomaine\b/.test(vivant),'le domaine voyage dans la sauvegarde et le contenu publié, jamais par la table');
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
  &&fief.includes("const pnjDialog=dialog('dom-pnj-editor','Personnage',")&&fief.includes("[['','Au domaine'],...domaine.batiments.filter(batimentConstruit).map(b=>[b.id,b.nom]),['aventure','En aventure'],['absent','Absent']]")
  &&fief.includes("ta.onchange=()=>{b.effets[i]=ta.value.slice(0,600);renderDomBats();sauveDomaine()}")
  &&feuille.includes('body.page-domaine #domaine-page{display:grid;')&&feuille.includes('body.page-domaine main.layout'),'l’onglet Domaine : construire, financer, peupler, loger, conférer');}
/* Six retouches d'écran : plus de spécialisation sur la vignette ; l'infobulle du système
   cède à la bulle ; un objet se nomme par ce qu'il prodigue et compte ses usages dessous ;
   l'Attaque reste le premier bouton ; le logo des Orbes suit l'amélioration tenue. */
assert.ok(src.includes("[el,...el.querySelectorAll('[title]')].forEach(x=>{if(!x.title)return;")&&src.includes("if(!x.getAttribute('aria-label'))x.setAttribute('aria-label',x.title);x.removeAttribute('title')});")
 &&src.includes("const texte=code.cle==='etat'?(p&&p.etat)||code.nom:code.nom;")
 &&src.includes("const compte=usageLimite(usage)?(dispo?'1':'0')+' / '+(usage==='jour'?'jour':'repos'):'';")
 &&src.includes("boite.replaceChildren();boite.hidden=!liste.length&&!talents.length;revient();")
 &&!src.includes("' 1/1'")&&!feuille.includes('.attaque-carte')
 &&src.includes("// Les talents à leur suite : ceux d'action, puis les réactions.")&&!src.includes("boite.querySelector('.btn-talent');")
 &&page.includes("const tenus=talentsCodes(a),affine=tenus.find(x=>x.code.cle==='orbesfeu');")&&page.includes('return {talent,code,params,rangee,logo,'),'vignettes, bulles, objets, attaque première, logo des orbes');
/* v0.361 — Les arbres d'avant, en épine et diagonales, passent sur la grille libre : le central au
   milieu, ses diagonales juste dessous de part et d'autre ; chaque chemin ouvert devient une ligne,
   le bonus posé dessus la suit, un chemin fermé n'en fait pas. Une fois, les maîtrises quittent
   l'arbre, où elles trônaient : le MJ les y place. */
{const morceau=(debut,fin)=>{const i=src.indexOf(debut);return src.slice(i,src.indexOf(fin,i))};
 const ctx={VOIES_MAX:2,LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o']};vm.createContext(ctx);vm.runInContext(morceau('function migreArbres(','function normalizeCatalog('),ctx);
 const c={classes:[{name:'Mystique'}],voies:{Mystique:['Pyromane']},cheminsCaches:{o:['dc']},talents:[
   {id:'m',name:'Orbes mystiques',famille:'Mystique',type:'mait',voie:''},
   {id:'o',name:'Orbes de Feu',famille:'Mystique',type:'act',voie:'Pyromane'},
   {id:'b',name:'Brisefeu',famille:'Mystique',type:'ame',voie:'Pyromane',prerequis:'o'},
   {id:'g',name:'Braise',famille:'Mystique',type:'pass',voie:'Pyromane',prerequis:'o',branche:'g'},
   {id:'d',name:'Cendre',famille:'Mystique',type:'pass',voie:'Pyromane',prerequis:'o',branche:'d'},
   {id:'x',name:'Orphelin',famille:'Mystique',type:'pass',voie:'Pyromane',prerequis:'zz',branche:'g'},
   {id:'f',name:'Fournaise',famille:'Mystique',type:'act',voie:'Pyromane'},
   {id:'g2',name:'Seconde braise',famille:'Mystique',type:'pass',voie:'Pyromane',prerequis:'o',branche:'g'},
   {id:'k1',name:'+1 PV',famille:'Mystique',type:'pass',effet:'bonus',chemin:'o|gc'},
   {id:'k2',name:'+1 Endu',famille:'Mystique',type:'pass',effet:'bonus',chemin:'o|dc'},
   {id:'k3',name:'+1 Vie',famille:'Mystique',type:'pass',effet:'bonus',chemin:'zz|c'}]};
 assert.equal(ctx.migreArbres(c),true);
 const T=id=>c.talents.find(t=>t.id===id),vu=id=>JSON.stringify(T(id).pos)+JSON.stringify(T(id).liens||[]);
 assert.equal(vu('o'),'{"x":1,"y":0}["g","d"]','deux diagonales : le central n’a plus de ligne droite');
 // Puis le sphérier : l'amélioration reliée depuis Braise devient un petit rond sur un de ses chemins.
 assert.equal(vu('g'),'{"x":0,"y":1}[]','la ligne vers l’amélioration s’efface : elle est sur un chemin');assert.equal(vu('d'),'{"x":2,"y":1}[]','le retour fermé ne fait pas de ligne');
 assert.ok(!T('b').pos&&!T('b').liens&&T('b').chemin&&T('b').chemin.de==='g'&&T('b').chemin.rang===1,'l’amélioration, petit rond au rang 1 d’un chemin de Braise');
 assert.equal(vu('x'),'{"x":1,"y":3}["f"]','l’orphelin reprend l’épine');
 assert.equal(vu('f'),'{"x":1,"y":4}[]');assert.equal(vu('g2'),'{"x":0,"y":5}[]','ce que l’ancien arbre ne montrait pas se range en bas');
 assert.equal(JSON.stringify(T('k1').chemin),'{"de":"g","dir":"ne","rang":1}','le bonus de la ligne devient un petit rond sur la première diagonale libre');
 assert.equal(c.spherier,1);assert.equal(ctx.migreArbres(c),false,'une seconde fois : rien à migrer');
 assert.ok(!T('k2').chemin&&T('k2').horsArbre,'sur un chemin fermé : le bonus quitte l’arbre');
 assert.ok(!T('k3').chemin&&T('k3').horsArbre,'sans étage : aussi');
 assert.ok(T('m').horsArbre&&!T('m').pos,'la maîtrise attend sa place');
 assert.ok(['o','b','g','d','x','f','g2'].every(id=>T(id).prerequis===''&&T(id).branche===undefined),'la structure est dans les lignes');
 assert.equal(c.cheminsCaches,undefined);assert.equal(c.arbresLibres,1);
 // Une seconde fois : rien ne bouge, et une maîtrise créée ensuite reste dans l'arbre.
 c.talents.push({id:'m2',name:'Nouvelle maîtrise',famille:'Mystique',type:'mait',voie:'Pyromane'});
 assert.equal(ctx.migreArbres(c),false);assert.equal(vu('o'),'{"x":1,"y":0}["g","d"]');assert.ok(!T('m2').horsArbre);}
/* Au chargement, une case se lit par deux entiers, une ligne vers un talent qui existe, deux au plus ;
   le bonus d'une ligne disparue quitte l'arbre. */
assert.ok(src.includes("const p=t.pos;if(p&&typeof p==='object'&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&Math.abs(p.x)<=60&&Math.abs(p.y)<=120)t.pos={x:p.x,y:p.y};else delete t.pos;")
 &&src.includes("const l=Array.isArray(t.liens)?[...new Set(t.liens.filter(id=>typeof id==='string'&&id!==t.id&&c.talents.some(x=>x&&x.id===id)))].slice(0,LIENS_MAX):[];")
 &&src.includes(' migreArbres(c);')&&!src.includes('SEGMENTS')&&!src.includes("+sel('Place dans l’arbre','branche'"),'la case, les lignes et les bonus, relus au chargement');
/* Les lignes se tracent en SVG d'un rond à l'autre, avec une pointe quand elles ne descendent pas ;
   le MJ en efface une d'un clic, en trace une par ⤳, et la vue joueur lui ôte ses outils. */
assert.ok(src.includes('function traceChemins(){const corps=$(\'arbres-corps\');if(!corps||!arbresDialog.open)return;')
 &&src.includes("g.onclick=e=>{e.stopPropagation();if(basculeLien(de,vers)==='retire')arbreChange()}}")&&src.includes("else if(view!=='mj'){arbresDialog.close();return}")
 &&src.includes("arbresVue.onclick=()=>{arbresVueJoueur=!arbresVueJoueur;noteArbres('');renderArbres()};")&&src.includes("el.onclick=()=>{if(mj&&lienDepuis){relie(t,col);return}")
 &&src.includes("arbresDialog.addEventListener('cancel',e=>{if(!lienDepuis)return;e.preventDefault();lienDepuis=null;noteArbres('');renderArbres()});")
 &&src.includes(" requestAnimationFrame(traceChemins)}")
 &&feuille.includes('.arbre-chemins{position:absolute;inset:0;')&&feuille.includes('.arbre-grille{--case-l:74px;--case-h:88px;')&&feuille.includes('.arbre-grille>*{pointer-events:auto}')
 &&feuille.includes('.arbre-col.editable .arbre-chemins .chemin{pointer-events:stroke;cursor:pointer}')&&feuille.includes('.arbre-chemins .chemin .pointe{')
 &&feuille.includes('.arbre-noeud.relie-source .arbre-rond{')&&feuille.includes('.arbre-place:empty{visibility:hidden}')&&feuille.includes('.arbres-vue.on{'),'les lignes tracées, effacées d’un clic, et la vue joueur');
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
{const m=C.TALENTS_CODES.meneur;assert.ok(m&&m.type==='pass'&&m.params.map(p=>p.cle).join()==='quoi,base,valeur,combien,portee');
 assert.match(C.phraseTalent('meneur',{quoi:'def',valeur:2,combien:'tous',portee:'vue'}),/<b>la DEF<\/b> de <b>tous vos alliés dans votre ligne de vue<\/b> de <b>\+2<\/b>/);
 assert.match(C.phraseTalent('meneur',{}),/<b>les dégâts<\/b> de <b>votre allié le plus proche au contact<\/b> de <b>\+1<\/b>/);
 assert.deepEqual(C.elusMeneur({combien:'deux'},[{a:'c',dist:3},{a:'a',dist:1},{a:'b',dist:2}]),['a','b']);
 assert.deepEqual(C.elusMeneur({combien:'un'},[{a:'c',dist:3},{a:'a',dist:1}]),['a']);
 assert.equal(C.elusMeneur({combien:'tous'},[{a:'c',dist:3},{a:'a',dist:1}]).length,2);assert.deepEqual(C.elusMeneur({},[]),[]);
 assert.ok(page.includes("function competenceDe(a,k){return (Number(a&&a.skills&&a.skills[k])||0)+(bonusFiche(a).skills[k]||0)}")
  &&page.includes("function auraMeneur(a,quoi){")&&page.includes("const size=mapSize();if(!size.width)return 0;let total=0,murs=null;")
  &&page.includes("if(elusMeneur(params,candidats).includes(a))total+=bonusDuMeneur(params)?propreBonusMeneur(m,quoi):Math.max(1,params.valeur|0)})});")&&page.includes("function valeurCompetence(a,k){return 1+competenceDe(a,k)}")
  &&page.includes("function degatsOmbrelame(a,p){if(p.etat&&p.mode==='place')return 0;")
  &&src.includes("const aura=!(typeof spectateur==='function'&&spectateur())&&typeof auraMeneur==='function'?auraMeneur(a,'pv'):(Number(a.auraPv)||0);")
  &&src.includes(" const max=pvMaximum(catalog.classes,a,catalog.talents,catalog.items)+aura;")&&src.includes("writeStat(a,'max',max);if(delta>0&&!(typeof estMort==='function'&&estMort(a)))a.hp=Math.min(a.max,a.hp+delta);return true}")
  &&src.includes("function synchronisePV(){if(typeof spectateur==='function'&&spectateur())return false;")&&src.includes("render=function(){if(!loading&&synchronisePV())scheduleSave();originalRender();")
  &&vivant.includes("'activeAttack','auraPv',")&&fs.readFileSync('shared.js','utf8').includes("'shieldId','munitionId','auraPv','reposPris','reposCourts','horsCarte','contactsDepart','comaVie','etatsPassifs','defBrisee'];")
  &&src.includes(" ecrire('.stat-tile.t-dmg strong','+\\u202F'+degatsDe(a));")&&src.includes("  const r=rondCompetence(a,k);")&&feuille.includes('.arbre-noeud.bonus{--teinte:#b8862b}'),'les caractéristiques telles qu’elles jouent, et le Meneur');}
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
 assert.ok(cartes.includes("const zonesBtn=icone('zones-eye','▦','Voir les zones de la carte');")&&cartes.includes("fogBar.append(fogReset,fogAll,noirBtn,eyeBtn,zonesBtn,lockBtn,limiteBtn,bruitBtn,impratBtn);")
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
 assert.ok(src.includes("o.rarete=rareteDe(o);o.bonus=normaliseBonusEquip(o.bonus);")&&src.includes("+(a.category==='ressource'?'':sel('Rareté','rarete',rareteDe(a),RARETES))")
  &&src.includes("if(f.rarete)a.rarete=rareteDe({rarete:f.rarete.value});")&&src.includes(" if($('item-bonus'))a.bonus=lireBonusItem();")
  &&src.includes('function dessineBonusItem(){')&&src.includes('function lireBonusItem(){')&&src.includes("teinte:TEINTE_RARETE[rareteDe(o)]||TEINTE_OBJET.object,")
  &&src.includes("p.className='cat-pill gear-carre k-'+col+' r-'+rareteDe(o)+")&&src.includes("p.className='cat-pill k-'+col+' r-'+rareteDe(o)+")
  &&src.includes("if(rareteDe(o)!=='commun')ligne(NOM_RARETE(rareteDe(o)),'gear-rarete r-'+rareteDe(o));")&&src.includes("normaliseBonusEquip(o.bonus).forEach(b=>{const p=document.createElement('p');p.className='gear-bonus';p.append(libelleBonusEl(b));d.append(p)});")
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
 assert.ok(src.includes('function corpsEtSac(a){')
  &&src.includes("function carreDeFiche(a,o,n,tout,portes,peutEquiper,corps){")&&src.includes("const p=carreDeFiche(a,o,n,tout,portes,peutEquiper);")
  &&src.includes("return main?equiperDansMain(a,o,main):equiperPiece(a,o)});\n  recoit(sac,(o,g)=>g.porte&&reposerPiece(a,o))}")
  &&src.includes("if(corps!==undefined&&equipable){p.draggable=true;")&&src.includes("const SILHOUETTE='<img class=\"silhouette\" src=\"'+imgUrl('PERSO.png')+'\"")&&feuille.includes('.corps .silhouette{position:absolute;inset:6px 0 4px;width:100%;height:calc(100% - 10px);object-fit:contain;object-position:center;')
  &&src.includes("['main','Main droite',droite],['torse','Torse',seul('torse')],['main','Main gauche',gauche],")
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
 assert.ok(cartes.includes("KINDS={matiere:'Zone de blocage',door:'Porte',start:'Zone de départ',foe:'Adversaire',objet:'Objet',coffre:'Coffre',lumiere:'Lumière',piege:'Piège',declencheur:'Déclencheur du piège',coupure:'Séparation de zones',lien:'Regroupement de zones'}")
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
/* Le domaine : des calques de plus — En feu, Ruines, puis Hanté, Abandonné, Envahi — qui ne se construisent pas, et un état
   par bâtiment qui dit lequel le découpe. */
{const d=C.normaliseDomaine({batiments:[{nom:'Forge',etape:2,etat:'feu'},{nom:'Temple',etat:'zzz'},{nom:'Tour',etape:1,etat:'ruine'}]});
 assert.equal(C.CALQUES_DOMAINE.length,9);assert.deepEqual(C.CALQUES_DOMAINE.slice(4).map(c=>c[0]),['feu','ruine','hante','abandonne','envahi']);assert.equal(d.carte.calques.length,9);
 assert.deepEqual(d.batiments.map(b=>b.etat),['feu','','ruine']);assert.equal(C.nouveauBatiment('x').etat,'');
 assert.equal(C.calqueDuBatiment([null,'a',null,null,'F','R'],d.batiments[0]),4,'en feu, le calque du feu');
 assert.equal(C.calqueDuBatiment([null,'a',null,null,null,'R'],d.batiments[0]),1,'sans calque du feu, celui de l’étape — le plus proche en dessous');
 assert.equal(C.calqueDuBatiment(['a',null,null,null,'F','R'],d.batiments[2]),5);assert.equal(C.calqueDuBatiment(['a',null,null,null,'F','R'],d.batiments[1]),0);
 assert.equal(C.calqueDisponible(['a',null,null,null,'F','R'],3),0,'le fond ne prend jamais un état pour une étape');
 assert.equal(C.NOM_ETAT_BATIMENT('feu'),'En feu');assert.equal(C.NOM_ETAT_BATIMENT(''),'Intact');
 const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("+CALQUES_DOMAINE.map(([k,nom],i)=>'<span class=\"dom-calque'+(i>=4?' dom-calque-etat':'')+'\">")&&fief.includes(" CALQUES_DOMAINE.forEach((_,i)=>{const on=!!d.carte.calques[i];")
  &&fief.includes("const etat=document.createElement('select');etat.className='dom-etat-choix';")&&fief.includes(" tete.append(nom,et,etat,fonc,boutonConstruire(b),recul,avance);boite.append(tete);")
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
  &&fief.includes("if(opts.deplace||opts.clic&&!inerte)rendEtiquetteDeplacable(e,b,etiquettes,opts);")
  &&fief.includes("...(domOutil==='select'?{deplace:(b,pt)=>{pushDomUndo();b.etiquette=pt;renderDomaineEditeur();sauveDomaine()},")
  &&fief.includes("  clic:b=>{domPageSel=domPageSel===b.id?null:b.id;renderDomaine()}});")&&!fief.includes("b.etiquette=pt;renderDomaine()")
  &&fief.includes('<button id="dom-contours" title="Montrer ou cacher le contour des bâtiments">▦ Contours</button>')&&fief.includes("plan.classList.toggle('sans-contours',!(mj&&domContours));")
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
 &&page.includes("ctx.fillStyle='#000';ctx.textAlign='center';ctx.textBaseline='alphabetic';")
 &&page.includes("const police=document.fonts&&document.fonts.load?document.fonts.load('700 100px Killam'):Promise.resolve();")
 &&page.includes("Promise.all([police,image]).then(([,im])=>{if(!im)return;ecuVide=im;ecuPret=true;ecusDessines.clear();")
 &&page.includes("const im=document.createElement('img');im.src=ecuDef(valeur);")&&!page.includes("const b=document.createElement('b');b.textContent=valeur;w.append(b)")&&src.includes(" const b=ecu.querySelector('b');if(b)b.remove()}")
 &&!src.includes("imgUrl('DEF '+(peint?n:'VIDE')+'.png')")&&page.includes("@font-face{font-family:'Killam';src:url('./fonts/killam-bold.woff2"),'l’écu de DEF se dessine en Killam, pour toute valeur');
/* v0.255, puis v0.359 — La DEF écarte les dés égaux ou inférieurs à sa valeur, plafonnée à 6.
   Lourd et Mortel passent toujours ; Solidité y soumet le Lourd. */
{const r=C.resolveAttack,j=()=>2;
 assert.equal(r({dice:[[2,0],[5,0]],def:4,dmg:0,roll:j}).damage,5);                 // Le 2 écarté, le 5 passe.
 assert.equal(r({dice:[[4,0]],def:4,dmg:0,roll:j}).damage,0);                       // Égal à la DEF : écarté.
 const rien=r({dice:[[2,0]],def:4,dmg:3,bleed:2,roll:j});
 assert.equal(rien.damage,0);assert.equal(rien.hit,false);assert.equal(rien.reduction,undefined); // Aucun dé : ni bonus, ni saignée.
 assert.equal(r({dice:[[3,0]],def:2,dmg:2,bleed:1,roll:j}).damage,6);               // 3 passe : bonus et saignée s'ajoutent.
 assert.equal(r({dice:[[5,2]],def:6,dmg:0,roll:j}).damage,5);                       // Le Lourd ignore la DEF.
 assert.equal(r({dice:[[1,5]],def:6,dmg:0,roll:j}).damage,1);                       // Le Mortel aussi.
 assert.equal(r({dice:[[5,2]],def:5,dmg:0,roll:j,solidite:true}).damage,0);         // Solidité : le Lourd est écarté.
 assert.equal(r({dice:[[6,2]],def:5,dmg:0,roll:j,solidite:true}).damage,6);         // Il passe s'il la dépasse.
 assert.equal(r({dice:[[5,5]],def:6,dmg:0,roll:j,solidite:true}).damage,5);         // Le Mortel, jamais écarté.
 assert.equal(r({dice:[[4,3],[4,3]],def:3,dmg:0,roll:j}).damage,16);                // Doubles mystiques ×2 : ils passent 3.
 assert.equal(r({dice:[[3,6]],def:2,dmg:0,round:3,roll:j}).damage,9);               // Phase ×3 au tour 3, sur sa face naturelle.
 assert.equal(r({dice:[[3,6]],def:3,dmg:0,round:3,roll:j}).damage,0);               // Face 3 contre DEF 3 : écartée.
 assert.equal(r({dice:[[6,0]],def:9,dmg:0,roll:()=>1}).damage,0);                   // DEF 9 lue 6 : le 6 ne passe pas.
 assert.equal(C.DEF_MAX,6);assert.equal(C.defPlafonnee(9),6);assert.equal(C.defPlafonnee(-2),0);assert.equal(C.defPlafonnee('x'),0);
 assert.equal(C.passeDef([6,0],6),false);assert.equal(C.passeDef([6,2],6),true);assert.equal(C.passeDef([6,2],6,true),false);assert.equal(C.passeDef([2,5],6,true),true);
 assert.equal(C.readStat('def','12',2),6);assert.equal(C.cleanMonster({name:'X',def:9}).def,6);
 assert.equal(r({dice:[[3,1],[3,1]],def:2,dmg:5,roll:j}).damage,0);                 // Plus un dé : ni bonus, ni DEF.
 const s=C.TALENTS_CODES.solidite;
 assert.ok(s&&s.type==='ame'&&!s.params.length&&s.requiert===undefined,'Solidité : une amélioration libre');
 assert.match(C.phraseTalent('solidite',{}),/écarte aussi les <b>dés de dégâts mortels<\/b> \(rouges\)/);
 assert.equal(C.effetParNom('Solidité'),'solidite');
 assert.ok(C.porteEffet([{code:s,params:{}}],'solidite'));
 assert.ok(page.includes("const solide=porteEffet(talentsCodes(b),'solidite');")
  &&page.includes("const defCible=hasState(b,'Au sol')?0:defOf(b),solide=porteEffet(talentsCodes(b),'solidite');")
  &&page.includes("const passe=d=>l.def===undefined||l.def===null||d[1]>6||passeDef(d,l.def,!!l.solidite);"),'attaque et orbe demandent Solidité à la cible, et la piste le sait');
 assert.ok(page.includes("poseJet({dice:r.dice,origine:dice.length,faille:r.failleFace,def,bonus:r.failed||blocked||!r.hit?0:bonus,solidite:solide},a,b);")
  &&page.includes("im.className='rate';im.src=imgUrl('DEF VIDE.png');")&&page.includes(".board-die .rate{")&&page.includes("if(calme){marque();return}")
  &&!page.includes('board-def')&&!page.includes('reduction'),'la piste barre d’un écu vide les dés qui ne passent pas la DEF, plus de « − DEF »');
 assert.ok(page.includes("const arrete=!barre&&defJ!==null&&!passeDef([v,c],defJ,!!detail.solidite);")&&!page.includes('.j-plus.def{')
  &&page.includes("bonus:r.hit?bonus:0,saignee:r.bleed,faille:r.failleFace,def,solidite:solide,double,total}")
  &&vivant.includes('def:Number.isInteger(detail.def)?detail.def:null,solidite:!!detail.solidite')&&vivant.includes('def:Number.isInteger(r.def)?r.def:null,solidite:!!r.solidite')
  &&!vivant.includes('reduction'),'le journal barre les dés écartés par la DEF, ici et en table');
 assert.ok(page.includes("return defPlafonnee(a&&a.defBrisee>0?d-a.defBrisee:d)}")&&src.includes("[...c.items,...c.monsters].forEach(o=>{if(o&&Number(o.def)>DEF_MAX)o.def=DEF_MAX});")
  &&src.includes("{cle:'def',nom:'DEF',type:'nombre',max:DEF_MAX,pour:armure,")&&src.includes("ecrit:(m,v)=>{m.def=entier(0,DEF_MAX)(v)}}")
  &&src.includes("field('DEF','def',a.def||0,'number','min=\"0\" max=\"'+DEF_MAX+'\"')")&&src.includes("num(f[k].value,0,k==='def'?DEF_MAX:k==='lumiere'?40:999999)"),'la DEF plafonne à 6 partout');
}
/* v0.256 — Trois états de plus (hanté, abandonné, envahi), chacun avec son calque ; le domaine
   s'exporte et se reprend à part ; les contours ont un bouton dans l'éditeur, lié à celui de
   l'onglet ; le nom d'un bâtiment se glisse en écoutant la fenêtre. */
{const d=C.normaliseDomaine({batiments:[{nom:'Crypte',etape:3,etat:'hante'},{nom:'Moulin',etat:'abandonne'},{nom:'Fort',etape:1,etat:'envahi'},{nom:'Puits',etat:'feu '}]});
 assert.deepEqual(C.ETATS_BATIMENT.map(e=>e[0]),['','feu','ruine','hante','abandonne','envahi']);
 assert.deepEqual(d.batiments.map(b=>b.etat),['hante','abandonne','envahi','']);
 assert.equal(C.NOM_ETAT_BATIMENT('hante'),'Hanté');assert.equal(C.NOM_ETAT_BATIMENT('envahi'),'Envahi');
 const c9=['a','b',null,null,'F','R','H','A','E'];
 assert.equal(C.calqueDuBatiment(c9,d.batiments[0]),6);assert.equal(C.calqueDuBatiment(c9,d.batiments[1]),7);assert.equal(C.calqueDuBatiment(c9,d.batiments[2]),8);
 assert.equal(C.calqueDuBatiment(['a','b',null,null,'F','R',null,null,null],d.batiments[0]),1,'sans calque de l’état, celui de l’étape');
 assert.equal(C.calqueDuBatiment(['a','b',null,null,'F','R'],d.batiments[2]),1,'un vieux domaine à six calques tient toujours');
 const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("const TEINTES_ETAPE=['#b9a48a','#c9953f','#7faddc','#8bbd9c','#d9532b','#6e6a66','#9b7fd4','#a89f8f','#7d9b3c'];")
  &&fief.includes("const etatBatimentValide=v=>v&&ETATS_BATIMENT.some(([k])=>k===v)?v:'';")&&!fief.includes("etat.value==='feu'||etat.value==='ruine'")
  &&feuille.includes('.dom-zone.etat-hante{--t:#9b7fd4}')&&feuille.includes('.dom-etat.etat-envahi{background:#7d9b3c}'),'hanté, abandonné, envahi : teintes, choix et calques');
 assert.ok(fief.includes('<button id="dom-export" title=')&&fief.includes('<input type="file" id="dom-json" accept="application/json,.json" hidden>')
  &&fief.includes("function exporterDomaine(){const texte=JSON.stringify({app:'amertume_online',genre:'domaine',exporte:new Date().toISOString(),domaine});")
  &&fief.includes("domaine=d;domSel=null;domPageSel=null;domUndo=[];domRedo=[];imagesDom.clear();")
  &&fief.includes("$('dom-export').onclick=exporterDomaine;$('dom-import').onclick=()=>$('dom-json').click();"),'le domaine s’exporte et se reprend');
 const ctxD={normaliseDomaine:C.normaliseDomaine};vm.createContext(ctxD);
 vm.runInContext(fief.slice(fief.indexOf('function lireFichierDomaine(texte)'),fief.indexOf('function importerDomaine(f)')),ctxD);
 assert.equal(ctxD.lireFichierDomaine(JSON.stringify({genre:'domaine',domaine:{nom:'Val',batiments:[{nom:'Forge',etat:'hante'}]}})).batiments[0].etat,'hante');
 assert.equal(ctxD.lireFichierDomaine(JSON.stringify({app:'amertume_online',actors:[],domaine:{nom:'Val',batiments:[]}})).nom,'Val','une sauvegarde globale rend son domaine');
 assert.throws(()=>ctxD.lireFichierDomaine('{"actors":[]}'),/pas un domaine/);assert.throws(()=>ctxD.lireFichierDomaine('nope'),/JSON/);
 assert.ok(fief.includes('<button id="dom-contours-editeur" title=')&&fief.includes("$('dom-contours').onclick=basculeContours;$('dom-contours-editeur').onclick=basculeContours;")
  &&fief.includes("$('dom-canvas').classList.toggle('sans-contours',!domContours);$('dom-contours-editeur').classList.toggle('on',domContours);")
  &&feuille.includes('#dom-contours.on,#dom-contours-editeur.on{')&&feuille.includes('#dom-canvas.sans-contours .dom-zone:not(.sel){stroke:transparent;fill:transparent}'),'un seul réglage de contours, deux boutons');
 assert.ok(fief.includes("window.addEventListener('pointermove',suit);window.addEventListener('pointerup',lache);window.addEventListener('pointercancel',lache)}}")
  &&fief.includes("const suit=m=>{if(m.pointerId!==id||!opts.deplace)return;")&&fief.includes("e.classList.add(opts.deplace?'deplacable':'cliquable');")
  &&feuille.includes('.dom-etiquette.cliquable{pointer-events:auto;cursor:pointer;'),'le glisser du nom écoute la fenêtre, et ne vaut que dans l’éditeur');
}
/* v0.257 — La colonne des bâtiments du Domaine : le nom et l'étape, l'état dessous, rien d'autre. */
{const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("et.className='dom-etape';et.textContent=NOM_ETAPE(b.etape);tete.append(nom,et);row.append(tete);")
  &&fief.includes("if(b.etat){const x=document.createElement('span');x.className='dom-etat etat-'+b.etat;x.textContent=NOM_ETAT_BATIMENT(b.etat);row.append(x)}")
  &&!fief.includes("p.className='muted dom-presents'")&&!fief.includes("p.className='dom-effet'")&&!fief.includes("row.append(boutonConstruire(b));")
  &&feuille.includes('.dom-bat>.dom-etat{align-self:flex-start}'),'la colonne des bâtiments s’en tient au nom, à l’étape et à l’état');
}
/* v0.258 — Sur le plan du Domaine, l'étiquette parle en joueur : « Friche » sans nom, le nom seul
   une fois construit, l'état toujours ; l'éditeur garde nom et étape. */
{const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("const friche=!!opts.jeu&&b.etape===0,fini=!!opts.jeu&&b.etape>=ETAPES_DOMAINE.length-1;")
  &&fief.includes("nom.textContent=friche?NOM_ETAPE(0):b.nom;e.append(nom);")&&fief.includes("const sous=b.etat?NOM_ETAT_BATIMENT(b.etat):friche||fini?'':NOM_ETAPE(b.etape);")
  &&fief.includes("{sel:sel>=0?sel:null,jeu:true,")&&!fief.includes("sel:domSel,trace:domTrace,jeu"),'l’étiquette du plan est sobre, celle de l’éditeur complète');
}
/* v0.260 — Sur le plan, le jeton des aventuriers présents sous le nom du bâtiment ; plus de note
   sous le lieu d'un aventurier ; sans bâtiment choisi, la fiche disparaît. */
{const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("if(opts.jeu){const presents=actors.filter(a=>a.hero&&lieuDe(a)===b.id);")
  &&fief.includes("presents.forEach(a=>{const t=jetonRond(a.image,a.name,'mini');t.title=a.name+(agitPour(a)?' — glisser vers un autre bâtiment construit':'');")
  &&feuille.includes('.dom-etiquette-jetons{position:absolute;top:100%;left:50%;transform:translateX(-50%);display:flex;'),'les jetons des présents sous le nom, sur le plan, sans le soulever');
 assert.ok(fief.includes(" boite.hidden=!b;if(!b)return;")&&!fief.includes('Choisis un bâtiment, dans la liste ou sur la carte')
  &&fief.includes("if(mjDom())row.append(tete,lieu);")&&fief.includes("  boite.append(row)})}")&&!fief.includes("notes.placeholder='Note'"),'fiche muette sans bâtiment, lieu sans note');
}
/* v0.262 — Seuls les bâtiments construits accueillent un aventurier ; si l'étape recule, il en sort. */
{const fief=fs.readFileSync('domaine.js','utf8');
 // v0.284 : le lieu est sur la fiche de l'aventurier ; une fiche d'avant lit encore le domaine.
 const ctxE={domaine:{aventuriers:{e:{lieu:'x',notes:''}},batiments:[{id:'x',etape:2},{id:'y',etape:3}]},ETAPES_DOMAINE:C.ETAPES_DOMAINE,mjDom:()=>true,owner:0,
  actors:[{id:'a',hero:true,lieuDomaine:'x'},{id:'b',hero:true,lieuDomaine:'y'},{id:'c',hero:true,lieuDomaine:'aventure'},{id:'d',hero:true,lieuDomaine:''},{id:'e',hero:true},{id:'f',hero:true,lieuDomaine:'perdu'},{id:'m',lieuDomaine:'x'}]};
 ctxE.batimentDom=id=>ctxE.domaine.batiments.find(b=>b.id===id)||null;vm.createContext(ctxE);
 vm.runInContext(fief.slice(fief.indexOf('const batimentConstruit='),fief.indexOf('function nomLieu('))+';this.lieuDe=lieuDe;',ctxE);
 assert.equal(ctxE.lieuDe(ctxE.actors[4]),'x','une fiche d’avant lit le domaine');
 assert.equal(ctxE.evacueNonConstruits(),3);
 assert.deepEqual(ctxE.actors.map(a=>ctxE.lieuDe(a)),['','y','aventure','','','','x'],'hors d’un bâtiment non construit, ou disparu ; un adversaire n’a pas de lieu');
 assert.ok(fief.includes("function sauveDomaine(){evacueNonConstruits();scheduleSave();")&&fief.includes("function renderDomaine(leger){const d=domaine,mj=mjDom();vueDomaine=view;if(mj&&evacueNonConstruits())scheduleSave();")
  &&fief.includes("...domaine.batiments.filter(batimentConstruit).map(b=>[b.id,b.nom]),")&&fief.includes("batimentConstruit(batimentDom(ou))))?ou:'';"),'la liste des lieux ne propose que le construit');
}
/* v0.263 — Le jeton d'un aventurier se glisse vers un bâtiment construit ; les jetons sont moitié plus
   grands ; un bonus de caractéristique n'est pas un talent, et a son propre éditeur. */
{const fief=fs.readFileSync('domaine.js','utf8');
 assert.ok(fief.includes("function glisseJetonAventurier(ev,a,t){")&&fief.includes("const cibleSous=m=>{const i=batimentSous(domaine,pos(m));const b=i>=0?domaine.batiments[i]:null;return batimentConstruit(b)?b:null};")
  &&fief.includes("if(b&&lieuDe(a)!==b.id)deplaceAventurier(a,b)};")&&fief.includes("t.onpointerdown=ev=>glisseJetonAventurier(ev,a,t);")
  &&fief.includes("+(batimentConstruit(b)?' construit':'')")&&feuille.includes('.dom-etiquette .jeton-rond.mini{width:36px;height:36px;font-size:18px;')
  &&feuille.includes('#dom-plan.glisse-jeton .dom-zone.construit{'),'le jeton se glisse vers un bâtiment construit, en grand');
 assert.ok(src.includes("const estBonus=t=>!!t&&t.effet==='bonus';")&&src.includes("filter(([t])=>!estBonus(t)&&!estVide(t)&&talentFamily(t)===famille")
  &&src.includes(".filter(t=>!estBonus(t)&&!estVide(t)&&talentFamily(t)===famille"),'un bonus ne paraît ni dans l’onglet, ni dans le sélecteur, ni dans la bibliothèque');
 assert.ok(src.includes('<label><input type="radio" name="nature" value="bonus"')&&src.includes("['name','type','logo','rangee'].forEach(n=>{const l=champs[n]&&champs[n].closest('label');if(l)l.classList.add('t-seul')});")
  &&src.includes("if(f.nature&&f.nature.value==='bonus'){t.params=paramsTalent({effet:'bonus',params:{carac:f.b_carac.value,valeur:f.b_valeur.value,comp:f.b_comp.value}});")
  &&feuille.includes('.talent-cache{display:none!important}'),'l’éditeur devient éditeur de bonus');
}
/* v0.264 — Le domaine part avec le contenu publié et se lit chez les joueurs, sans édition ; les
   campagnes s'enregistrent dans l'appli : troupe, adversaires, domaine, scène, progression des cartes. */
{const fief=fs.readFileSync('domaine.js','utf8'),camp=fs.readFileSync('campagnes.js','utf8'),partage=fs.readFileSync('shared.js','utf8');
 assert.ok(fs.readFileSync('editor.js','utf8').includes("const ONGLETS_JOUEURS_DEFAUT=['table','domaine','heroes','bestiary','settings'];")
  &&partage.includes(",locked:tokensLocked,domaine:typeof domaine!=='undefined'?structuredClone(domaine):null,catalog:structuredClone(catalog),")
  &&partage.includes("if(remote.domaine&&typeof normaliseDomaine==='function'){const d=normaliseDomaine(remote.domaine);if(typeof poidsDomaine!=='function'||poidsDomaine(d)>0||poidsDomaine(domaine)===0)domaine=d;domSel=null;domPageSel=null}")
  &&fief.includes("function sauveDomaine(){evacueNonConstruits();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'))}"),'le domaine voyage avec le contenu publié');
 assert.ok(fief.includes("const mjDom=()=>typeof view==='undefined'||view==='mj';")&&fief.includes("['dom-editer','dom-export','dom-import','dom-contours'].forEach(id=>$(id).hidden=!mj);")
  &&fief.includes("if(!mjDom()){renderDomFicheLue(boite,b);return}")&&fief.includes("function renderDomFicheLue(boite,b){")&&!fief.includes("renderDomFicheLue(boite,b){")===false
  &&fief.includes("if(ev.button!==0||!agitPour(a))return;")&&fief.includes(" tresor.append(val);if(mjDom())tresor.append(monnaie);")&&fief.includes("if(mjDom())boite.append(form);")
  &&fief.includes("const row=document.createElement(mjDom()?'button':'div');")&&fief.includes("if(mjDom())row.append(tete,lieu);else{const l=document.createElement('span');l.className='dom-av-lieu';l.textContent=nomLieu(ou);")
  &&fief.includes(" if(vueDomaine!==view){renderDomaine();return}")&&fief.includes(" renderDomaine(true)};"),'les joueurs lisent le domaine sans rien y changer');
 assert.ok(page.includes('<script src="./campagnes.js?v=')&&camp.includes("localStorage.setItem('amertume-campagne',id)")
  &&camp.includes("renderSettings=function(){renderSettingsSansCampagnes();$('bloc-campagnes').hidden=view!=='mj';renderCampagnes()};")
  &&camp.includes("document.addEventListener('amertume-partie-chargee',chargeCampagnes);")&&feuille.includes('.campagne-ligne.ouverte{'),'les campagnes ont leur bloc, au MJ');
 const ctxC={};vm.createContext(ctxC);
 vm.runInContext(camp.slice(camp.indexOf('function etatCartes('),camp.indexOf('function partieCourante('))+camp.slice(camp.indexOf('function resumePartie('),camp.indexOf('/* Ouvrir :')),ctxC);
 const cartes2=[{id:'a',fog:'0011',seen:'01',fogOff:true,doors:[{open:true},{open:false}]},{id:'b',doors:[{open:true}]}];
 const etat=ctxC.etatCartes(cartes2);
 assert.deepEqual(JSON.parse(JSON.stringify(etat)),{a:{fog:'0011',seen:'01',fogOff:true,portes:[true,false]},b:{fog:null,seen:null,fogOff:false,portes:[true]}});
 const neuves=[{id:'a',fog:'zzzz',doors:[{open:false},{open:true}]},{id:'b',fog:'11',doors:[{open:false}]},{id:'c',doors:[]}];
 ctxC.poseEtatCartes(neuves,etat);
 assert.equal(neuves[0].fog+'/'+neuves[0].seen+'/'+neuves[0].fogOff+'/'+neuves[0].doors.map(d=>d.open).join(','),'0011/01/true/true,false');
 assert.equal(('fog' in neuves[1])+'/'+neuves[1].doors[0].open,'false/true','une carte sans brouillard dans la campagne repart sans brouillard');
 assert.equal(neuves[2].fog,undefined,'une carte inconnue de la campagne ne change pas');
 assert.equal(ctxC.resumePartie({actors:[{hero:true},{hero:true},{hero:false}],domaine:{nom:'Val'},round:4}),'2 aventuriers · 1 adversaire · Val · tour 4');
 assert.equal(ctxC.resumePartie({}),'0 aventurier · tour 1');
 assert.equal(ctxC.verifieCampagne({genre:'campagne',partie:{actors:[{name:'Éla'}]}}),'');
 assert.match(ctxC.verifieCampagne({genre:'domaine',domaine:{}}),/pas une campagne/);assert.match(ctxC.verifieCampagne({genre:'campagne',partie:{actors:[{}]}}),/troupe lisible/);
}
/* v0.265, puis v0.363, v0.603, v0.604 et v0.605 — Le mouvement limité. La distance se mesure en ligne droite du départ au
   socle, quel que soit le tracé de la main ; elle se plie à l'angle d'un mur contourné. En combat, un point de Mouvement donne la
   distance de mouvement à dépenser par à-coups pendant le tour ; aucun geste ne va au-delà de ce qui reste ; franchir une
   zone ne coûte rien ; lâché dans l'embrasure, le socle revient dans sa zone. Sans reste ni point, le geste est fini. En
   exploration, la limite ne vaut que pour les aventuriers, quand le MJ l'impose, chaque geste repartant pour toute la
   distance, sans point. */
{const regle=page.slice(page.indexOf('let mouvementClavier=null;'),page.indexOf('function contactsDe(a)'));
 // Un mur de 40 à 60 en x, de 0 à 70 en y, sur une carte de 1000 pixels de côté ; un mètre fait 10 pixels.
 const mur=[{contours:[[[400,0],[600,0],[600,700],[400,700]]]}];
 const ctxR={combat:true,round:3,zones:{},notes:[],journal:[],performance:{now:()=>1e6},nomNum:a=>a.name,currentMap:()=>({id:'c'}),zonesDe:()=>({compte:2}),
  enCombat:()=>ctxR.combat,items:()=>[],tokenPx:()=>10,mapSize:()=>({width:1000,height:1000}),distanceMouvement:a=>a.mvt??9,
  wallsInPixels:()=>ctxR.murs||[],obstaclesDuPas:()=>ctxR.murs||[],segmentHitsPolys:C.segmentHitsPolys,contoursOf:C.contoursOf,shapeContains:C.shapeContains,
  pointsUses:(a,q)=>a.uses||0,pointsRestants:(a,q)=>q==='action'?(a.action??1):a.credit,zoneDe:a=>ctxR.zones[Math.round(a.x)+','+Math.round(a.y)]||0,
  floatNumber:(a,t)=>ctxR.notes.push(t),log:t=>ctxR.journal.push(t)};vm.createContext(ctxR);vm.runInContext(regle,ctxR);
 for(let x=0;x<=100;x+=1)ctxR.zones[x+',50']=x<50?1:x>50?2:0;
 const pas=(a,r,pts)=>{for(const [x,y] of pts){a.x=x;a.y=y;if(!ctxR.appliqueRegleMouvement(a,r))return false}return true};
 const a={x:20,y:50,credit:1};const r=ctxR.regleMouvement(a);
 assert.equal(r.max+'/'+r.fini+'/'+r.combat+'/'+r.neuf,'90/false/true/true','neuf mètres, payés d’un point au premier geste');
 assert.ok(pas(a,r,[[22,50],[24,50],[26,50]])&&Math.abs(r.long-60)<1e-6);
 a.x=35;assert.equal(ctxR.appliqueRegleMouvement(a,r),false);assert.equal(a.x,26,'au-delà de ce qui reste, il reste où il en était');
 // Le tracé de la main ne compte pas : tremblements, retour sur ses pas.
 const b={x:20,y:20,credit:1},rb=ctxR.regleMouvement(b);pas(b,rb,[[21,20.1],[22,19.9],[23,20.1],[24,20]]);assert.ok(Math.abs(rb.long-40)<.5,'tremblé : '+rb.long);
 pas(b,rb,[[23,20],[22,20]]);assert.ok(Math.abs(rb.long-20)<.5&&rb.chemin.length===2,'revenu sur ses pas : '+rb.long);
 // Un angle contourné allonge la distance : autour du mur, de (35,80) à (65,60) par (50,75).
 ctxR.murs=mur;const c={x:35,y:65,credit:1,mvt:99},rc=ctxR.regleMouvement(c);
 pas(c,rc,[[38,68],[41,71],[44,74],[47,76],[50,76],[53,74],[56,71],[59,68],[62,65],[65,62]]);
 const droit=Math.hypot(300,30);assert.ok(rc.long>droit+40&&rc.chemin.length>=3,'l’angle compte : '+rc.long.toFixed(1)+' contre '+droit.toFixed(1));ctxR.murs=null;
 // L'IA et le clavier s'arrêtent pile à la limite.
 const e={x:20,y:30,credit:1},re=ctxR.regleMouvement(e);e.x=40;assert.equal(ctxR.appliqueRegleMouvement(e,re),false);
 ctxR.jusquALaBorne(e,re,{x:40,y:30},(x,y)=>{e.x=x;e.y=y});assert.ok(Math.abs(re.long-90)<1.5&&e.x>28.8&&e.x<=29.06,'pile à neuf mètres : '+e.x);
 // Le solde : le point du premier geste, et ce qui reste du mouvement pour le tour.
 a.x=26;assert.equal(ctxR.soldeRegleMouvement(a,r),1,'le premier geste paie le point');assert.equal(a.mvtReste+'/'+a.mvtTour,'3/3');
 assert.equal(ctxR.soldeRegleMouvement(a,r),0,'une seule fois');
 a.uses=1;a.credit=0;const r2=ctxR.regleMouvement(a);assert.equal(r2.neuf+'/'+r2.fini+'/'+r2.max,'false/false/30','il repart avec ses trois mètres, sans point');
 pas(a,r2,[[28,50],[29,50]]);assert.equal(ctxR.soldeRegleMouvement(a,r2),0);assert.equal(a.mvtReste,0);
 assert.equal(ctxR.regleMouvement(a).fini,true,'plus de reste ni de point : il ne part pas');
 a.credit=1;const r3=ctxR.regleMouvement(a);assert.equal(r3.neuf+'/'+r3.max,'true/90','un nouveau point, toute la distance');
 ctxR.round=4;assert.equal(ctxR.resteMouvement({mvtTour:3,mvtReste:5,uses:1}),0,'le reste ne passe pas au tour suivant');ctxR.round=3;
 assert.equal(ctxR.resteMouvement({mvtTour:3,mvtReste:5,uses:0}),0,'points rendus : plus de reste');
 // Franchir une zone ne coûte rien ; lâché dans l'embrasure, il revient dans sa zone.
 const z={x:45,y:50,credit:1},rz=ctxR.regleMouvement(z);pas(z,rz,[[50,50],[53,50]]);
 assert.equal(ctxR.soldeRegleMouvement(z,rz),1,'franchir une zone ne coûte rien de plus');assert.equal(z.mvtReste,1);
 const y={x:45,y:50,credit:2},ry=ctxR.regleMouvement(y);pas(y,ry,[[50,50]]);
 assert.equal(ctxR.soldeRegleMouvement(y,ry),0);assert.equal(y.x,45,'lâché dans l’embrasure, il revient dans sa zone');assert.equal(ctxR.journal.length,1);
 assert.equal(ctxR.regleMouvement({x:60,y:50,credit:0,action:1}).fini,true,'sans point ni reste, en combat, il ne part pas');
 assert.equal(ctxR.regleMouvement({x:60,y:50,credit:3,mvt:12}).max,120,'sa distance à lui');
 const q=ctxR.borneMouvement(r3,{x:50,y:50});assert.ok(q.borne&&Math.abs(q.x-(29+8.995))<1e-6,'le point visé ramené dans le cercle');
 // En exploration : sur ordre du MJ, pour les seuls aventuriers ; ni blocage, ni point, ni reste.
 ctxR.combat=false;assert.equal(ctxR.mouvementBorne({hero:true}),false);
 vm.runInContext('mouvementLimiteExplo=true',ctxR);assert.equal(ctxR.mouvementBorne({hero:true}),true);assert.equal(ctxR.mouvementBorne({hero:false}),false);
 const x={x:20,y:50,credit:0},rx=ctxR.regleMouvement(x);assert.equal(rx.fini+'/'+rx.neuf,'false/false');pas(x,rx,[[25,50]]);assert.equal(ctxR.soldeRegleMouvement(x,rx),0);assert.equal(x.mvtReste,undefined);
 x.x=40;assert.equal(ctxR.appliqueRegleMouvement(x,rx),false,'mais pas au-delà de sa distance');
 ctxR.combat=true;vm.runInContext('mouvementLimiteExplo=false',ctxR);assert.ok(ctxR.mouvementBorne({hero:false})&&ctxR.mouvementBorne({hero:true}),'en combat, pour tous');
 assert.ok(page.includes("const bloque=!!regle&&regle.fini;")&&page.includes("if(regle&&regle.fini){floatNumber(a,'Plus de Mouvement','nul',true);return}")
  &&page.includes("function actionPrise(a){return !!a&&pointsRestants(a,'action')<=0}")&&!page.includes('arriveeAuContact'),'le socle verrouillé sans Mouvement ni Action ; le MJ tenu par l’Action');}
/* v0.267 — Sans point de Mouvement, le socle bouge encore dans sa zone (et y subit l'opportunité) ;
   les jauges de PV ont leur couche, au-dessus de tous les socles. */
{assert.ok(page.includes("function couchePV(){let c=$('pv-layer');if(!c){c=document.createElement('div');c.id='pv-layer';$('map-view').append(c)}return c}")
  &&page.includes(" t._pv=jauge;couchePV().append(jauge);")&&page.includes("document.querySelectorAll('.token').forEach(t=>t.remove());couchePV().replaceChildren();")
  &&page.includes("el.style.top=actors[k].y+'%';suitLaJauge(el)}});")&&page.includes("el.style.top=b.y+'%';suitLaJauge(el)}")
  &&page.includes("#pv-layer{position:absolute;inset:0;z-index:3;pointer-events:none}")&&page.includes("#pv-layer .pv.enemy i{background:")&&!page.includes('.token .pv{'),'les jauges au-dessus de tous les socles, et qui suivent');
 /* v0.335 — Sans point de Mouvement, le socle est verrouillé : il ne bouge pas, le dit, et
    n'offre aucune occasion puisqu'il ne s'est pas déplacé. */
 assert.ok(page.includes("if(drag.bloque){drag.moved=true;if(!drag.dit){drag.dit=true;floatNumber(a,'Plus de Mouvement','nul',true)}return}")
  &&page.includes("  if(bloque){if(moved)skipClick=true;return}"),'sans point, le socle est verrouillé');
}
/* v0.268, puis v0.471 — Les chemins de l'arbre vont jusqu'au bord des boutons, dessous, en pointillés tant qu'ils ne sont pas
   actifs ; les bonus prennent la couleur de leur caractéristique ; plus de mode d'emploi au-dessus. */
{assert.ok(src.includes("return {x:r.left+r.width/2-R.left,y:r.top+r.height/2-R.top,r:i&&i.width?Math.min(i.width,i.height)*.22:r.width/2-2}};")&&src.includes("col.classList.toggle('sans-acteur',!a);")
  &&src.includes("const P={x:p.x+ux*rp,y:p.y+uy*rp},Q={x:q.x-ux*rq,y:q.y-uy*rq};")
  &&feuille.includes(".arbre-chemins .chemin .trait{stroke:var(--line-strong);stroke-width:3;stroke-linecap:round;fill:none;stroke-dasharray:3 7;opacity:.75}")
  &&feuille.includes(".arbre-col.sans-acteur .arbre-chemins .chemin .trait{stroke-dasharray:none;opacity:1}")
  &&feuille.includes(".arbre-chemins .chemin.pris .trait{stroke:var(--green);stroke-dasharray:none;opacity:1}")
  &&feuille.includes(".arbre-chemins .chemin.petit .trait{stroke-width:2.5;stroke-dasharray:none}"),'les chemins : jusqu’aux boutons, pointillés tant qu’inactifs, pleins vers les petits ronds');
 assert.ok(src.includes("b.classList.add('bonus','bonus-'+((p&&p.carac)||'pv'));")&&feuille.includes(".arbre-noeud.bonus-vie{--teinte:rgb(122,92,184)}")&&feuille.includes(".arbre-noeud.bonus-dmg{--teinte:rgb(180,72,58)}"),'les bonus aux couleurs de la fiche');
 assert.ok(!src.includes("||(!arbresActeur?NOTE_ARBRES_CLASSE:view==='mj'&&!arbresVueJoueur?NOTE_ARBRES_MJ:NOTE_ARBRES)}"),'plus de mode d’emploi au-dessus des arbres');
}
/* v0.269 — Le journal numérote les homonymes ; le combat finit seul quand plus un adversaire révélé
   ne tient debout ; le Repos court soigne 1d6 + Endu hors combat, une fois entre deux combats. */
{assert.ok(page.includes("function nomNum(o){if(!o)return '';const r=o.id?nameNumbers().get(o.id):null;return String(o.name||'?')+(r?' '+r:'')}")
  &&page.includes("s.textContent=nomNum(o);s.style.color=actorTint(o);return s};")&&page.includes("const who=parNom.get(m[0]);")
  &&page.includes("return nomNum(c)+(blinde?' Blindage':' −'+degats)+(c.hp===0?' (coma)':'')}")&&page.includes("log(nomNum(a)+' invoque '+nomNum(c)+'.',{ton:'talent'});"),'le journal écrit « Gobelin 2 »');
 // nomNum en machine virtuelle : deux Gobelins révélés portent leur numéro, un nom unique n'en porte pas.
 const ctxN={actors:[{id:'h',name:'Ulfgar',hero:true},{id:'g1',name:'Gobelin',vu:true,numero:1},{id:'g2',name:'Gobelin',vu:true,numero:2},{id:'o',name:'Ogre',vu:true,numero:1}]};vm.createContext(ctxN);
 vm.runInContext(page.slice(page.indexOf('function nomNum(o)'),page.indexOf('/* Ce qu\'on a le droit de lire d\'un combattant')),ctxN);
 assert.equal(ctxN.actors.map(ctxN.nomNum).join('|'),'Ulfgar|Gobelin 1|Gobelin 2|Ogre');assert.equal(ctxN.nomNum({name:'Inconnu'}),'Inconnu');
 assert.ok(page.includes("function finDeCombatAuto(){if(!enCombat()||(typeof loading!=='undefined'&&loading)||(typeof spectateur==='function'&&spectateur()))return;")&&page.includes("if(adversairesDebout()>0){combatEngage=true;return}")&&page.includes(" effetsPassifs();comaAventuriers();glissantsReveles();finDeCombatAuto();")
  &&page.includes("if(finit&&!(typeof spectateur==='function'&&spectateur())){actors.forEach(reveilDuComa);"),'le combat finit seul, et rend le repos');
 assert.ok(page.includes('<button class="btn-action btn-repos rond" id="repos" hidden>⛺</button>')&&page.includes(":enCombat()?'Pas de repos en plein combat.'")
  &&page.includes(":a.reposPris===true?'Repos court déjà pris : il revient à la fin du prochain combat.'")&&page.includes("actors.forEach(a=>{if(a.hero)a.reposPris=false})")&&page.includes("const gagne=applyHeal(a,de+endu);a.reposCourts=Math.min(reposMax(a),(Math.trunc(Number(a.reposCourts))||0)+1);")
  &&feuille.includes('button.btn-repos{--fond:#4f9a5a;color:#fff}'),'le Repos court');
}
/* v0.270 — La main droite, à gauche de l'image, tient la première arme ; un bouclier va à gauche ;
   une arme prise remplace celle de la main droite ; lâchée sur une main, elle prend cette main.
   Le sac a sa croix de retrait ; les descriptions de talents ont leurs mots clés ; le journal
   numérote aussi ceux qui viennent de paraître, et qui frappe sans avoir été vu se révèle. */
{const I={e:{id:'e',category:'weapon',hands:1},d:{id:'d',category:'weapon',hands:1},h:{id:'h',category:'weapon',hands:2},b:{id:'b',category:'armor',slot:'shield'},b2:{id:'b2',category:'armor',slot:'shield'}};
 const ctxM={objetDe:id=>I[id]||null,weaponHands:gearApi.weaponHands,emplacementDe:gearApi.emplacementDe,gearCount:(a,id)=>(a.weapons||[]).filter(x=>x===id).length,armuresDe:gearApi.armuresDe,catalog:{items:Object.values(I)},placesLibres:()=>1};
 vm.createContext(ctxM);
 vm.runInContext(src.slice(src.indexOf('function mainsPrises(a)'),src.indexOf('/* Faire de la place à un emplacement'))+src.slice(src.indexOf('function equiperPiece(a,o)'),src.indexOf('function reposerPiece(a,o)')),ctxM);
 const h=(w,s)=>({inventaire:['e','d','h','b','b2','e'],weapons:[...w],shieldId:s||''}),dit=a=>a.weapons.join('+')+'/'+(a.shieldId||'-');
 let a=h(['e'],'b');ctxM.prendArme(a,I.d);assert.equal(dit(a),'d/b','épée et bouclier, on prend la dague : elle remplace l’épée, le bouclier reste');
 a=h(['e'],'b');ctxM.prendArme(a,I.h);assert.equal(dit(a),'h/-','une arme à deux mains vide les deux mains');
 a=h(['e','d']);ctxM.prendBouclier(a,I.b);assert.equal(dit(a),'e/b','le bouclier chasse la seconde arme, pas la première');
 a=h(['e'],'b');ctxM.prendBouclier(a,I.b2);assert.equal(dit(a),'e/b2','un bouclier remplace l’autre');
 a=h(['e']);ctxM.prendArme(a,I.d);assert.equal(dit(a),'e+d/-','une main libre : la seconde arme va à gauche');
 a=h([],'b');ctxM.prendArme(a,I.e);assert.equal(dit(a),'e/b','main droite vide : l’arme y va');
 a=h(['e'],'b');ctxM.equiperDansMain(a,I.d,'gauche');assert.equal(dit(a),'e+d/-','lâchée sur la main gauche, la dague chasse le bouclier');
 a=h(['e','d']);ctxM.equiperDansMain(a,I.e,'droite');assert.equal(dit(a),'e+d/-','lâchée sur la main droite, elle remplace la première arme');
 a=h(['h']);ctxM.equiperDansMain(a,I.d,'gauche');assert.equal(dit(a),'d/-','une arme à deux mains cède les deux');}
{assert.ok(src.includes("const droite=armes[0]||null,gauche=droite&&weaponHands(droite)===2?{deux:droite}:(bouclier||armes[1]||null);")
  &&src.includes("if(cle==='main')pl.dataset.main=k===3?'droite':'gauche';")&&src.includes("g.cible=e.target&&e.target.closest?e.target.closest('.place'):null;"),'le schéma : main droite à gauche de l’image, dépôt ciblé');
 assert.ok(src.includes("x.className='retirer-sac';x.textContent='✕';")&&src.includes("if(!n)return;for(let k=0;k<n;k++)retirerInventaire(a,o);")
  &&feuille.includes('.sac .gear-carre:hover .retirer-sac,.sac .gear-carre:focus-within .retirer-sac{opacity:1;'),'la croix de retrait du sac');
 const ctxK={catalog:{motsCles:['Allié']},STAT_TINTS:{pv:'1,2,3',dmg:'4,5,6',def:'0,0,0',endu:'0,0,0',vie:'0,0,0',xp:'0,0,0'},ETATS_JEU:gearApi.ETATS_JEU,
  document:{createElement:()=>({className:'',textContent:'',style:{color:''}})}};vm.createContext(ctxK);
 vm.runInContext(src.slice(src.indexOf('const TEINTE_ETAT_MOT='),src.indexOf('function talentDetail(t)')),ctxK);
 const el={k:[],replaceChildren(){this.k=[]},append(...x){this.k.push(...x.map(y=>typeof y==='string'?y:'['+y.textContent+']'))}};
 ctxK.texteEnrichi(el,'Un Allié gagne +2 Dégâts et Feu : 1d6+2 PV, une Action ; **enfin**, la vie.');
 assert.equal(el.k.join(''),'Un [Allié] gagne [+2] [Dégâts] et [Feu] : [1d6+2] [PV], une [Action] ; [enfin], la vie.');
 assert.ok(src.includes("if(effet&&t.effects)texteEnrichi(effet,t.effects);")&&src.includes('<button id="talent-mots"')
  &&src.includes("c.motsCles=[...new Set((Array.isArray(c.motsCles)?c.motsCles:[])")&&feuille.includes('.mot-cle{font-weight:700}'),'les mots clés des talents');
 assert.ok(page.includes("function reveleAttaquant(a){if(!a||a.hero||!a.id||!actors.includes(a)||hasState(a,'Invisible')||(a.vu&&!a.hidden))return;")&&page.includes("log(reveles.map(nomNum).join(', ')")
  &&page.includes(" // Les numéros se lisent après la révélation : ceux qui viennent de paraître en ont un.\n const numeros=nameNumbers();"),'le journal numérote ceux qui viennent de paraître');
}
/* v0.271 — Le coma d'un aventurier coûte une VIE et se relève à la fin du combat ; l'onglet Aventuriers
   montre les PV max et leur calcul ; un objet s'utilise d'un clic ; les niveaux de talent se cachent ;
   les mots clés du MJ ont leur couleur. */
{const coma=page.slice(page.indexOf('function comaAventuriers(){'),page.indexOf('/* Le combat finit de lui-même'));
 const journal=[],flot=[];let enC=true;
 const ctxC={enCombat:()=>enC,loading:false,hasState:(a,e)=>(a.states||[]).includes(e),recalculerPV:a=>{a.max=a.vie*a.endu},floatNumber:(a,t)=>flot.push(t),log:t=>journal.push(t),nomNum:a=>a.name,scheduleSave:()=>{},
  d6:()=>4,enduAffichee:a=>a.endu,reposMax:a=>Math.max(1,Math.trunc(Number(a.level))||1),poseCibles:()=>{},applyHeal:(a,n)=>{const g=Math.min(a.max-a.hp,n);a.hp+=g;if(a.hp>0)a.states=(a.states||[]).filter(e=>e!=='Coma');return g},actors:[]};
 vm.createContext(ctxC);vm.runInContext(coma,ctxC);
 const h={name:'Ulfgar',hero:true,hp:0,vie:5,endu:4,max:20,states:['Coma']};ctxC.actors.push(h,{name:'Gobelin',hero:false,hp:0,states:['Coma']});
 ctxC.comaAventuriers();assert.equal(h.vie+'/'+h.max+'/'+h.comaVie,'4/16/true','tombé : une VIE en moins, PV max recalculés');
 ctxC.comaAventuriers();assert.equal(h.vie,4,'la même chute ne coûte qu’une VIE');
 ctxC.reveilDuComa(h);assert.equal(h.hp+'/'+h.comaVie+'/'+h.reposCourts,'8/false/1','à la fin du combat : 1d6 + Endu, un repos court pris');
 enC=false;h.hp=0;h.states=['Coma'];ctxC.comaAventuriers();assert.equal(h.vie,4,'hors combat, rien ne se perd');
 assert.ok(page.includes(" effetsPassifs();comaAventuriers();glissantsReveles();finDeCombatAuto();")&&page.includes("if(finit&&!(typeof spectateur==='function'&&spectateur())){actors.forEach(reveilDuComa);"),'le coma se compte au rendu et se relève à la fin du combat');}
{assert.ok(src.includes("['pv','PV max',a.max],['def','DEF',defOf(a),true],")&&src.includes("tuilesVives(a,tuiles,[['vie','vieMax'],['endu'],[],['def'],['dmg'],['xp']],c);")
  &&src.includes(" bullesChiffres(a,tuiles);")&&src.includes("function bullesChiffres(a,tuiles){const quoi={vie:detailVie,endu:detailEndu,pv:detailPv,def:detailDef,dmg:detailDegats,xp:detailXp};")&&page.includes("if(typeof bullesChiffres==='function'&&!secret)bullesChiffres(a,tuiles);")&&src.includes(" ecrire('.stat-tile.t-pv strong',a.max);")
  &&feuille.includes('.calcul-ligne.total{'),'PV max et leur calcul, Dégâts détaillés');
 const ctxD={catalog:{talents:[],items:[],classes:[{name:'Gardien',pv:2}]},bonusDe:()=>({pv:0,vie:0,endu:0,dmg:2,def:0,skills:[]}),classeDe:(cl,r)=>cl.find(c=>c.name===r),pvEspece:()=>0,auraMeneur:()=>0,degatsDe:a=>a.dmg+2};
 vm.createContext(ctxD);vm.runInContext(src.slice(src.indexOf('function detailPvMax(a)'),src.indexOf('function calculAuSurvol(')),ctxD);
 const pv=ctxD.detailPvMax({vie:5,endu:4,role:'Gardien',max:22});
 assert.equal(JSON.stringify(pv.slice(3)),JSON.stringify([['Endu × Vie','4 × 5 = 20'],['Classe (Gardien)','+ 2'],['Total','22']]));
 ctxD.bonusDe=(a,t,i)=>i===null?{dmg:2}:{dmg:2};const dg=ctxD.detailDegats({dmg:0});
 assert.equal(JSON.stringify(dg.map(x=>x[0])),JSON.stringify(['Dégâts','Base','Talents','Total']),'les +2 viennent d’un talent, la base dit 0');}
{assert.ok(src.includes("const utilisable=o.category!=='weapon'&&o.category!=='armor'&&o.category!=='ammo'&&o.category!=='treasure'&&o.category!=='ressource'&&o.category!=='restes'&&o.category!=='cle'&&peutEquiper&&actors.includes(a);")
  &&src.includes("if(utilisable){fermerBulle();employerDepuisFiche(a,o);return}")&&src.includes("function employerDepuisFiche(a,o){")&&!src.includes("b.className='gear-utiliser'"),'un objet s’utilise d’un clic');
 assert.ok(src.includes("const NIVEAUX_TALENTS=false;")&&src.includes("niv.textContent=NIVEAUX_TALENTS?'Niv. '+(t.level||1):'';")&&src.includes('<select id="talent-sort" aria-label="Tri" hidden>')
  &&src.includes("niv.textContent=NIVEAUX_TALENTS?'Niv. '+(t.level||1):'';")&&src.includes("'<input type=\"hidden\" name=\"level\" value=\"'"),'les niveaux de talent se cachent, le câblage reste');
 const ctxK={catalog:{motsCles:['Allié : vert','Feu : orange','Ennemi = #123456','Sans couleur','Gel']},STAT_TINTS:{pv:'1,2,3',dmg:'4,5,6',def:'0,0,0',endu:'0,0,0',vie:'0,0,0',xp:'0,0,0'},ETATS_JEU:gearApi.ETATS_JEU};
 vm.createContext(ctxK);vm.runInContext(src.slice(src.indexOf('const TEINTE_ETAT_MOT='),src.indexOf('function texteEnrichi(')),ctxK);
 const t={get:x=>ctxK.motsCles().couleur(x)};
 assert.equal([t.get('Allié'),t.get('Feu'),t.get('Ennemi'),t.get('Sans couleur'),t.get('Gel')].join('|'),'#2f7a4b|#c2692a|#123456|var(--accent)|#2f8fae','la couleur des mots clés : nommée, en code, ou celle du thème ; un mot du jeu se recolore, ou garde la sienne sans couleur');}
/* v0.272 — Une arme sans nombre de mains en tient une ; les munitions ont leur emplacement, sous la
   main droite, et donnent aux armes à distance un dé et un état ; la pastille de classe se présente
   au survol et ouvre l'arbre au clic ; le Catalogue officiel quitte l'armurerie. */
{const I={e:{id:'e',category:'weapon'},b:{id:'b',category:'armor',slot:'shield'}};
 const ctxM={objetDe:id=>I[id]||null,weaponHands:gearApi.weaponHands,emplacementDe:gearApi.emplacementDe,gearCount:(a,id)=>(a.weapons||[]).filter(x=>x===id).length,armuresDe:gearApi.armuresDe,catalog:{items:Object.values(I)},placesLibres:()=>1};
 vm.createContext(ctxM);vm.runInContext(src.slice(src.indexOf('function mainsPrises(a)'),src.indexOf('/* Faire de la place à un emplacement')),ctxM);
 const a={inventaire:['e','e','b'],weapons:['e'],shieldId:'b'};ctxM.prendArme(a,I.e);assert.equal(a.weapons.join('+')+'/'+a.shieldId,'e/b','une arme sans nombre de mains ne chasse plus le bouclier');}
{const items=[{id:'arc',name:'Arc',category:'weapon',ranged:true,hands:2,dice:{white:1,bone:1}},{id:'ep',name:'Épée',category:'weapon',hands:1,dice:{white:2}},
  {id:'fl',name:'Flèches de feu',category:'ammo',munDe:'red',etat:'Feu'}];
 const h={weapons:['arc'],munitionId:'fl'};const tir=gearApi.gearAttacks(h,items)[0];
 assert.equal(tir.dice.red+'/'+tir.dice.white+'/'+tir.dice.bone+'/'+tir.etats.join(',')+'/'+tir.munition,'1/1/1/Feu/fl','la munition : un dé rouge et Feu au tir');
 assert.match(tir.name,/Arc · Flèches de feu/);
 const cac=gearApi.gearAttacks({weapons:['ep'],munitionId:'fl'},items)[0];assert.equal(cac.dice.red+'/'+cac.etats.length+'/'+cac.munition,'0/0/null','le contact n’en a que faire');
 assert.equal(gearApi.gearAttacks({weapons:['arc']},items)[0].dice.red,0,'sans munition, rien de plus');}
{assert.ok(src.includes("if(place&&n0>=1&&n0<=2){const v=document.createElement('i');v.className='die-sq die-munition';")&&src.includes("p.append(dicePips(o.dice,o.etat,col==='ranged'&&!o.lancer));")
  &&feuille.includes('.die-sq.die-munition{background:none;border:1.5px dashed var(--line-strong);'),'le dé vide des armes à distance');
 assert.ok(src.includes("['munitions','Munitions',munition],['anneau','Anneau',anneaux[0]||null],")&&src.includes("if(cle==='anneau'){groupeAnneaux.append(pl);")
  &&src.includes("else if(o.category==='ammo')a.munitionId=a.munitionId===o.id?'':o.id;")&&src.includes("sel('Dé ajouté aux armes à distance','munDe',")
  &&feuille.includes('.corps .anneaux-groupe{grid-column:2 / 4;display:flex;justify-content:flex-end;gap:4px;box-sizing:border-box;padding-right:max(0px,calc((100% - 6px) / 4 - 34.5px))}')&&vivant.includes("'shieldId','munitionId',"),'l’emplacement des munitions');
 assert.ok(src.includes("const ouvre=()=>{if(typeof peutVoirArbres==='function'&&peutVoirArbres(a))openArbres(a);else if(view==='mj')openArbresClasse(nomCl)};")
  &&src.includes("k.textContent='Bonus de PV max';")&&!src.includes('armory-official')
  &&feuille.includes('.calcul-bulle{display:flex;flex-direction:column;gap:3px;min-width:220px;font-size:13px;background:var(--panel);'),'la pastille de classe, la bulle lisible, plus de Catalogue officiel');}
/* v0.273 — Les mots clés prennent leur pluriel, et ceux du MJ se lisent quelle que soit la casse ;
   la description d'un talent ne dit plus ce qu'il débloque. */
{const ctxP={catalog:{motsCles:['Attaque : rouge','Attaque critique : violet','Allié']},STAT_TINTS:{pv:'1,2,3',dmg:'4,5,6',def:'0,0,0',endu:'0,0,0',vie:'0,0,0',xp:'0,0,0'},ETATS_JEU:gearApi.ETATS_JEU,
  document:{createElement:()=>({className:'',textContent:'',style:{color:''}})}};vm.createContext(ctxP);
 vm.runInContext(src.slice(src.indexOf('const TEINTE_ETAT_MOT='),src.indexOf('function talentDetail(t)')),ctxP);
 const el={k:[],replaceChildren(){this.k=[]},append(...x){this.k.push(...x.map(y=>typeof y==='string'?y:'['+y.textContent+(y.style.color?'|'+y.style.color:'')+']'))}};
 ctxP.texteEnrichi(el,'Deux attaques, une Attaque critique, des attaques critiques, ATTAQUE ; les alliés gagnent 2 Dégâts et des Actions ; la vie reste.');
 assert.equal(el.k.join(''),'Deux [attaques|#b8352f], une [Attaque critique|#7a5cb8], des [attaques critiques|#7a5cb8], [ATTAQUE|#b8352f] ; les [alliés|var(--accent)] gagnent 2 [Dégâts|rgb(4,5,6)] et des [Actions] ; la vie reste.');
 ctxP.texteEnrichi(el,'Feux et Gels : 1d6+2, +3.');assert.equal(el.k.join(''),'[Feux|#c2503a] et [Gels|#2f8fae] : [1d6+2], [+3].');
 assert.ok(!src.includes("ligne('Débloque : '"),'plus de « Débloque » dans la description d’un talent');}
/* v0.274 — Le dernier anneau se centre sous la main gauche ; la munition portée remplit la place vide du dé de l'arme à distance. */
{assert.ok(src.includes("function remplitMunition(p,a,o){")&&src.includes(" if(portes(o))remplitMunition(p,a,o);")&&src.includes("const p=remplitMunition(gearCarre(o.deux,1,1),a,o.deux);")
  &&src.includes("place.classList.remove('die-munition');place.classList.add('die-charge');place.style.setProperty('--face',dieFace(k));"),'la munition remplit la place vide');}
/* v0.275 — Une pièce d'équipement à effet peut être passive : elle agit tant qu'elle est portée, sans bouton. */
{const items=[{id:'an',name:'Anneau d’Argent',category:'armor',slot:'anneau',effet:'invulnerabilite',mode:'passif',params:{contre:'etat',etat:'Gel'}},
  {id:'bo',name:'Bouclier béni',category:'armor',slot:'shield',effet:'invulnerabilite',mode:'passif',params:{contre:'des',des:'red'}},
  {id:'ca',name:'Cape',category:'armor',slot:'dos',effet:'etat',mode:'passif',params:{etat:'Invisible'}},
  {id:'po',name:'Potion',category:'object',effet:'soin',mode:'passif',params:{}},
  {id:'ac',name:'Anneau actif',category:'armor',slot:'anneau',effet:'invulnerabilite',params:{contre:'etat',etat:'Feu'}}];
 assert.equal(gearApi.modeObjet(items[0]),'passif');assert.equal(gearApi.modeObjet(items[3]),'actif','un consommable, ou un effet sans passif, reste actif');assert.equal(gearApi.modeObjet(items[4]),'actif');
 assert.match(gearApi.phraseDeObjet(items[0]),/Tant qu’il porte la pièce, le porteur est <b>insensible<\/b> à <b>Gel<\/b>/);
 const h={armures:['an','ca','ac'],shieldId:'bo'};const pp=gearApi.passifsPortes(h,items);
 assert.equal(JSON.stringify(pp),JSON.stringify({etats:['Gel'],des:['red'],donnes:['Invisible']}),'ce que confèrent les pièces portées');
 assert.equal(JSON.stringify(gearApi.passifsPortes({armures:[]},items)),JSON.stringify({etats:[],des:[],donnes:[]}),'rangée dans le sac, la pièce ne fait rien');
 const eff=page.slice(page.indexOf('function effetsPassifs(){'),page.indexOf('/* Le combat finit de lui-même'));const journal=[];
 const ctxE={loading:false,items:()=>items,passifsPortes:gearApi.passifsPortes,hasState:(a,e)=>(a.states||[]).includes(e),setState:(a,e,on)=>{a.states=(a.states||[]).filter(x=>x!==e);if(on)a.states.push(e)},log:t=>journal.push(t),nomNum:a=>a.name,actors:[]};
 vm.createContext(ctxE);vm.runInContext(eff,ctxE);const b={name:'Thorik',armures:['an','ca'],states:['Gel']};ctxE.actors.push(b);
 ctxE.effetsPassifs();assert.equal(b.states.join(',')+'|'+b.etatsPassifs.join(','),'Invisible|Invisible','le Gel se dissipe, la cape donne Invisible');
 b.states=[];ctxE.effetsPassifs();assert.equal(b.states.join(','),'','un état donné et perdu ne revient pas tant qu’on garde la pièce');
 b.states=['Invisible'];b.armures=['an'];ctxE.effetsPassifs();assert.equal(b.states.join(',')+'|'+b.etatsPassifs.join(','),'|','ôtée, la cape reprend son état');
 assert.ok(src.includes("if(modeObjet(o)==='passif')return;")&&src.includes("if(f.mode)a.mode=f.mode.value==='passif'?'passif':'actif';")
  &&src.includes("[['actif','Actif — un bouton en combat'],['passif','Passif — permanent tant que porté']]")&&page.includes("const gardes=[],ecartes=[],portes=[...passifsPortes(b,items()).des,...desRefuses(talentsCodes(b))];"),'le passif : pas de bouton, sa phrase, son réglage, les dés écartés');}
/* v0.275 (suite) — Un écu de DEF seulement pour ce qui en donne, ou une armure de corps, ou un bouclier ; l'icône de l'effet, barrée pour une insensibilité. */
{assert.ok(src.includes("if((Number(o.def)||0)>0||['torse','shield'].includes(emplacementDe(o)))bas.append(shieldBadge(o.def||0));")
  &&src.includes("const eff=pastilleEffet(o);if(eff)bas.append(eff);")&&src.includes("if(code.cle==='invulnerabilite')return pastilleInsensible(p);")
  &&feuille.includes('.effet-pastille.barre::after{')&&feuille.includes('.cat-pill .effet-pastille .etat-inflige img{position:absolute;inset:0;width:100%;height:100%;'),'l’écu à zéro disparaît des bijoux, l’effet se montre, barré s’il protège');}
/* v0.276 — Les chemins de l'arbre ne se lisent plus à travers le nom des talents. */
{assert.ok(feuille.includes('.arbre-grille .arbre-niv{background:var(--panel-2);padding:1px 6px;border-radius:6px}')&&feuille.includes('.arbre-grille{--case-l:74px;--case-h:88px;position:relative;z-index:1;'),'le niveau masque la ligne qui passe dessous');}
/* v0.278 — Le domaine chez les joueurs : sans friches ni contours, la troupe sur deux colonnes, le
   bâtiment choisi allumé, le journal sans les étapes que le MJ a posées. Les inscriptions de la
   carte ; l'infobulle des bijoux allégée ; l'inventaire se remplit d'icônes. */
{const C=require('./combat.js'),fief=fs.readFileSync('domaine.js','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 // Une construction payée par les joueurs se lit ; une étape posée par le MJ ne se lit pas ; l'ancien journal se trie.
 const D=C.normaliseDomaine({finances:{journal:[{t:1,libelle:'Construction — Cartographe : Fondations',montant:0},{t:2,libelle:'Construction — Forge : Fondations',montant:-50},{t:3,libelle:'Butin',montant:0},{t:4,libelle:'x',montant:0,par:'joueurs'},{t:5,libelle:'y',montant:3,par:'bidule'}]}});
 assert.deepEqual(D.finances.journal.map(e=>e.par||''),['mj','','','joueurs',''],'une construction gratuite d’avant est l’œuvre du MJ');
 assert.deepEqual(D.finances.journal.filter(C.ligneDesJoueurs).map(e=>e.t),[2,3,4,5]);
 const b=D.batiments[0];b.couts=[0,0,0];assert.equal(C.construire(D,b),true);assert.equal(D.finances.journal.at(-1).par,'joueurs','bâtir, c’est les joueurs — même gratuit');
 assert.equal(C.normaliseDomaine(structuredClone(D)).finances.journal.at(-1).par,'joueurs','le relu ne le reprend pas au MJ');
 const n=D.finances.journal.length;assert.equal(C.avancerEtape(b),true);assert.equal(b.etape,2);assert.equal(D.finances.journal.length,n,'le MJ pose une étape sans ligne');
 b.etape=3;assert.equal(C.avancerEtape(b),false);assert.equal(C.avancerEtape(null),false);
 // Les inscriptions : par défaut sur les parchemins, bornées, gardées au relu.
 assert.deepEqual(C.normaliseDomaine(null).carte.cartouches,{nom:[13,6.9],sous:[13,11.2],habitants:[79,90.9],visiteurs:[79,94.1]});
 assert.deepEqual(C.cartouchesValides({nom:[120,-4],sous:'x'}).nom,[100,0]);assert.deepEqual(C.cartouchesValides({sous:'x'}).sous,[13,11.2]);
 assert.deepEqual(C.normaliseDomaine({carte:{cartouches:{habitants:[20,10]}}}).carte.cartouches.habitants,[20,10]);
 const ctxN={};vm.createContext(ctxN);vm.runInContext(fief.slice(fief.indexOf('function nomEnDeux('),fief.indexOf('function dessineCartouches(')),ctxN);
 assert.deepEqual([...ctxN.nomEnDeux('Lamuline (Domaine)')],['Lamuline','Domaine']);assert.deepEqual([...ctxN.nomEnDeux('Lamuline')],['Lamuline','Domaine']);
 assert.deepEqual([...ctxN.nomEnDeux('Le Domaine')],['Le Domaine','']);
 assert.ok(fief.includes("const batimentChoisissable=b=>!!b&&(mjDom()||b.etape>0);")&&fief.includes(" const liste=domaine.batiments.filter(batimentChoisissable);")
  &&fief.includes("{sel:sel>=0?sel:null,jeu:true,inerte:b=>!batimentChoisissable(b),")&&fief.includes("if(b&&!batimentChoisissable(b))return;")
  &&fief.includes("['dom-editer','dom-export','dom-import','dom-contours'].forEach(id=>$(id).hidden=!mj);")&&fief.includes("plan.classList.toggle('sans-contours',!(mj&&domContours));")
  &&fief.includes("boite.classList.toggle('en-grille',!mjDom());")&&feuille.includes('#dom-aventuriers.en-grille{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));'),'les joueurs : pas de friche, pas de contours, la troupe en deux colonnes');
 assert.ok(fief.includes("v.setAttribute('class','dom-lueur');v.setAttribute('filter','url(#dom-lueur-flou)');")&&!fief.includes('dom-voile')&&feuille.includes('#dom-plan .dom-zone.sel,#dom-plan.sans-contours .dom-zone.sel{stroke:transparent;fill:transparent}')
  &&feuille.includes('.dom-bat.sel{border-color:var(--accent);border-left-color:var(--t,var(--accent));'),'le bâtiment choisi s’allume, sur le plan et dans la liste');
 assert.ok(fief.includes("const lignes=(mjDom()?f.journal:f.journal.filter(ligneDesJoueurs))")&&fief.includes("avance.onclick=()=>{if(avancerEtape(b)){renderDomaine();sauveDomaine()}};")
  &&fief.includes(" const reste=[1,2,3].filter(e=>e>b.etape);")&&!fief.includes("'Coût des étapes : '"),'le journal des joueurs sans les étapes du MJ');
 assert.ok(fief.includes(" dessineCartouches(etiquettes,opts);")&&fief.includes("deplaceCartouche:(k,pt)=>{pushDomUndo();domaine.carte.cartouches[k]=pt;renderDomaineEditeur();sauveDomaine()}")
  &&fief.includes("habitants:accorde(compte('habitant'),'habitant'),visiteurs:accorde(compte('visiteur'),'visiteur')};")&&feuille.includes("#dom-plan,#dom-canvas{container-type:inline-size}")
  &&feuille.includes(".dom-cartouche.c-nom{font:700 3.1cqw/1.05 'Killam',Georgia,serif;"),'les inscriptions de la carte, en Killam, glissées dans l’éditeur');
 assert.ok(!src.includes("'Passif : agit tant que la pièce est portée'")&&!src.includes("ligne('DEF '+(o.def||0)")
  &&feuille.includes('.cat-carte .nom-carte{font:600 11px/1.2 system-ui;text-align:center;color:var(--ink);max-width:84px;overflow-wrap:anywhere;min-height:2.4em;display:flex;align-items:center;justify-content:center}'),'l’infobulle des bijoux allégée, les noms centrés');
 assert.ok(src.includes("function carteAjout(a,o,clic){")&&src.includes("liste.forEach(o=>grille.append(pickerMode==='gear'?carteAjout(a,o,clic):pastille(o)));")&&!src.includes('Clique un objet pour l’ajouter')
  &&src.includes("$('picker-note').hidden=mode==='gear';"),'l’inventaire se remplit d’icônes, sans mode d’emploi');}
/* v0.279 — Les inscriptions se décorrèlent : nom, qualité, habitants, visiteurs — quatre textes,
   chacun sa place. Les deux blocs d'avant se défont là où leurs lignes s'écrivaient. */
{const C=require('./combat.js');
 assert.deepEqual(C.cartouchesValides({titre:[20,10],gens:[70,80]}),{nom:[20,8.4],sous:[20,12.7],habitants:[70,78.4],visiteurs:[70,81.6]},'les deux blocs d’avant se défont en quatre');
 assert.deepEqual(C.cartouchesValides({titre:[20,10],nom:[5,5]}).nom,[5,5],'une place posée l’emporte sur l’ancien bloc');}
/* v0.280 — L'arbre de talents décrit un talent au survol, dans la bulle de la fiche ; le logo d'un
   talent se choisit parmi toutes les images du dossier, rangées par famille. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 // Les images sans préfixe sont toutes déclarées, extension comprise.
 const lire=nom=>JSON.parse(src.match(new RegExp('const '+nom+'=(\\[[^\\]]*\\]);'))[1].replace(/'/g,'"'));
 const ext=l=>l==='DEGATS'?'.webp':'.png';
 const autres=fs.readdirSync('img').filter(f=>/\.(png|webp)$/i.test(f)&&!/^(weapon|spell|item|attack|ressource)_/.test(f)).sort();
 assert.deepEqual([...lire('LOGOS_ETATS'),...lire('LOGOS_DIVERS')].map(l=>l+ext(l)).sort(),autres,'LOGOS_ETATS et LOGOS_DIVERS doivent lister les autres images : '+autres.join(', '));
 assert.ok(src.includes("const EXTENSIONS_LOGO={DEGATS:'.webp'};")&&src.includes("function poseLogo(im,l){im.onerror=null;if(estIconePlanche(l)){poseIcone(im,l);return}im.src=imgUrl(fichierLogo(l));")&&src.includes("  +selLogos('Logo','logo',t.logo||'')")
  &&src.includes(" t.logo=f.logo&&(logoValide(f.logo.value)||LOGOS_ELEMENTAIRES.includes(f.logo.value))?f.logo.value:'';")
  &&src.includes("const FAMILLES_LOGOS=[['Élémentaire — suit l’élément',LOGOS_ELEMENTAIRES],...DOSSIERS_LOGOS.map(([d,nom])=>[nom,LOGOS_DOSSIERS[d]]),['Talents',LOGOS_TALENT],['Attaques',LOGOS_ATTAQUE],['Équipement',LOGOS_EQUIPEMENT],['Objets',LOGOS_OBJET],['Ressources',LOGOS_RESSOURCES],['États',LOGOS_ETATS],['Divers',LOGOS_DIVERS]];"),'le logo d’un talent : toutes les images, par famille');
 const ctxL={};vm.createContext(ctxL);vm.runInContext(fs.readFileSync('planches.js','utf8').match(/const estIconePlanche=[^\n]*/)[0]+'\n'+src.match(/const estLogoDossier=[^\n]*/)[0]+'\n'+src.slice(src.indexOf('const NOMS_LOGOS='),src.indexOf('// Un menu de logos en familles'))+';this.nomLogo=nomLogo;',ctxL);
 assert.deepEqual(['BLINDAGE INITIAL','SAIGNEE','DEF 3','weapon_cape_elfique','DEGATS','weapon_cuir_epais','talents/brise_glace.png'].map(ctxL.nomLogo),['Blindage initial','Saignée','DEF 3','Cape elfique','Dégâts','Cuir épais','Brise glace']);
 assert.ok(src.includes("surveille(b,()=>{const d=bulleNoeud(t,verrou,b.noteBulle);ouvrirBulle(b,d,'bulle-talent'")&&!src.includes("b.title=t.name+' — '+[talentType(t)[2]")
  &&src.includes("(ancre.closest('dialog[open]')||document.body).append(bulleEl);")&&feuille.includes(".talent-bulle-nom b{font:700 14px 'Killam'"),'l’arbre décrit ses talents au survol, dans sa fenêtre');}
/* v0.281 — La bulle d'un nœud de l'arbre n'écrit jamais la nature du talent. Chaque objet porte
   deux ressources et un prix en or, saisis à l'armurerie et lus nulle part ailleurs. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes(" tete.append(nom);d.append(tete);")&&!src.includes("nat.textContent=bonus?'Bonus':talentType(t)[2]"),'la bulle de l’arbre tait la nature du talent');
 const CR=require('./combat.js'),ctxR={MATERIAUX:[...CR.MATERIAUX],cleRessource:CR.cleRessource,CLE_MATERIAU:CR.CLE_MATERIAU,structuredClone};vm.createContext(ctxR);vm.runInContext(src.slice(src.indexOf('const RESSOURCES_DEFAUT='),src.indexOf('function normalizeCatalog('))+';this.listeRessources=listeRessources;this.ressourceValide=ressourceValide;this.normaliseRessources=normaliseRessources;this.migreRessources=migreRessources;',ctxR);
 const J=x=>JSON.stringify(x);
 assert.equal(J(ctxR.listeRessources().map(r=>r[1])),J(['Acier','Argent','Bois','Bronze','Corde','Cuir','Diamant','Fer','Or','Pierre','Verre']),'les ressources, par ordre alphabétique, Fer compris');
 assert.deepEqual([...ctxR.normaliseRessources([{cle:'fer',nom:'Fer noir'},{cle:'fer',nom:'Doublon'},{cle:'Mauvaise clé',nom:'X'},{cle:'mithril',nom:'fer noir'}]).map(r=>r.cle+'='+r.nom)],['fer=Fer noir'],'une clé et un nom uniques, une clé bien formée');
 assert.equal(ctxR.normaliseRessources(undefined).length,11);
 assert.deepEqual(CR.normaliseReserve({acier:3,or:5,mithril:2,'eclat-rubis':1,'eclat-rubis-eteinte':4,'Mauvais':1}),{acier:3,mithril:2,'eclat-rubis':1},'la réserve garde les matériaux créés, jamais l’or');
 /* v0.329 — Les ressources deviennent des pièces de l'Armurerie, sous leur clé ; les pièces qui en
    sont faites passent du nom à la clé. Les renommer ne défait rien ; les supprimer toutes ne les
    fait pas revenir. */
 const cat={items:[{id:'a',name:'Épée',category:'weapon',ressource1:'Fer',ressource2:'bois'}],ressources:[{cle:'fer',nom:'Fer'},{cle:'bois',nom:'Bois'},{cle:'mithril',nom:'Mithril'}]};
 ctxR.migreRessources(cat);ctxR.catalog=cat;
 assert.equal(J(cat.items.filter(o=>o.category==='ressource').map(o=>o.id+'|'+o.cle+'|'+o.name)),J(['ressource-fer|fer|Fer','ressource-bois|bois|Bois','ressource-mithril|mithril|Mithril']));
 assert.equal(cat.items[0].ressource1+'/'+cat.items[0].ressource2,'fer/bois','l’épée cite ses ressources par leur clé');
 assert.ok(cat.ressourcesPosees===true&&!('ressources' in cat));
 cat.items[1].name='Fer noir';ctxR.migreRessources(cat);assert.equal(cat.items[0].ressource1,'fer','renommée, la ressource reste celle de l’épée');
 assert.equal(ctxR.ressourceValide('fer'),'fer');assert.equal(ctxR.ressourceValide('Mithril'),'');
 cat.items.push({id:'z',name:'Fer',category:'ressource',cle:'fer'});ctxR.migreRessources(cat);assert.equal(cat.items.at(-1).cle,'fer-2','deux ressources, deux clés');
 cat.items=cat.items.filter(o=>o.category!=='ressource');ctxR.migreRessources(cat);
 assert.ok(!cat.items.some(o=>o.category==='ressource')&&cat.items[0].ressource1==='','supprimées, elles ne reviennent pas ; l’épée n’en cite plus');
 const neuf={items:[]};ctxR.migreRessources(neuf);assert.equal(neuf.items.length,11);assert.ok(neuf.items.some(o=>o.id==='ressource-fer'&&o.cle==='fer'&&o.name==='Fer'));
 assert.ok(src.includes("if(o.category==='ressource'){o.ressource1='';o.ressource2=''}else{o.ressource1=resV(o.ressource1);o.ressource2=resV(o.ressource2)}")&&src.includes("o.price=Math.max(0,Math.min(999999,Math.trunc(Number(o.price))||0))")
  &&src.includes(":field(a.category==='restes'?'Valeur (or)':'Prix (or)','price',a.price||0,'number','min=\"0\" max=\"999999\" step=\"1\"'))")
  &&src.includes(":sel('Ressource 1','ressource1',ressourceValide(a.ressource1),[['','— aucune —'],...listeRessources()])")
  &&src.includes("+sel('Ressource 2','ressource2',ressourceValide(a.ressource2),[['','— aucune —'],...listeRessources()]))")
  &&src.includes(" for(const k of ['ressource1','ressource2'])if(f[k])a[k]=ressourceValide(f[k].value);")
  &&src.includes("if(a.category==='ressource'&&!(typeof a.cle==='string'&&CLE_MATERIAU.test(a.cle)))a.cle=cleLibre(a.name,new Set(ressourcesJeu().map(r=>r.cle)));"),'ressources et prix au formulaire de l’objet');}
/* v0.282 — Au formulaire d'un objet, Mains revient sur la ligne de la rareté ; prix et ressources ont la leur. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("  +(a.category==='ressource'?'':sel('Rareté','rarete',rareteDe(a),RARETES))\n  +(arme&&!a.lancer?sel('Mains','hands',")&&src.includes("  +'<div class=\"edit-grid prix-ressources\">'\n  +(a.category==='ressource'?'<p class=\"valeur-guide\">Valeur : <b>'")
  &&fs.readFileSync('editor.css','utf8').includes('.edit-grid.prix-ressources{margin-top:12px}'),'prix et ressources sur une ligne, Mains avec la rareté');}
/* v0.283 — Les ressources : l'or, les gemmes (trois tailles, quatre variétés, allumées ou éteintes)
   et les matériaux. Le domaine tient ses matériaux et ses gemmes — son or est son trésor — ; un
   aventurier porte son or et ses gemmes. Le MJ corrige d'un clic, la troupe lit en direct. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),fief=fs.readFileSync('domaine.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.equal(C.CLES_GEMMES.length,15,'3 tailles × 5 variétés — les éteintes en sommeil');
 assert.ok(C.CLES_GEMMES.includes('brome-saphir')&&C.CLES_GEMMES.includes('brisure-rubis')&&!C.CLES_GEMMES.some(k=>k.endsWith('-eteinte')));
 assert.deepEqual(C.CLES_RICHESSES.slice(0,2),['or','brisure-citrine']);
 assert.ok(!C.CLES_RESSOURCES_DOMAINE.includes('or')&&C.CLES_RESSOURCES_DOMAINE.includes('acier')&&C.CLES_RESSOURCES_DOMAINE.includes('eclat-diamant'),'l’or du domaine est son trésor');
 assert.equal(C.CLES_RESSOURCES_DOMAINE.length,25);
 assert.equal(C.nomGemme('eclat','emeraude',true),'Éclats d’émeraude, éteintes');assert.equal(C.nomGemme('brome','rubis',false),'Brômes de rubis');
 assert.equal(C.lisCompte('1 200'),1200);assert.equal(C.lisCompte('-3'),0);assert.equal(C.lisCompte('abc'),0);assert.equal(C.lisCompte(5e9),999999);
 assert.deepEqual(C.normaliseCompte({or:'5',x:3,'eclat-rubis':-2,'brisure-saphir':0,'brome-diamant':2.7,'brome-diamant-eteinte':4},C.CLES_RICHESSES),{or:5,'brome-diamant':2},'une éteinte quitte la bourse');
 assert.deepEqual(C.normaliseDomaine(null).ressources,{});
 assert.deepEqual(C.normaliseDomaine({ressources:{or:9,bois:12,'eclat-rubis':3}}).ressources,{bois:12,'eclat-rubis':3});
 assert.ok(src.includes("a.reposPris=a.reposPris===true;a.horsCarte=a.horsCarte===true;a.richesses=normaliseCompte(a.richesses,CLES_RICHESSES);")
  &&src.includes("const listeRessources=()=>ressourcesJeu().map(r=>[r.cle,r.nom]).sort((x,y)=>x[1].localeCompare(y[1],'fr'));"),'les richesses se relisent et voyagent en direct');
 assert.ok(src.includes("function grilleGemmes(compte,poser,qui){")&&src.includes("function blocRichesses(a){")&&src.includes("const poser=view==='mj'?(k,v)=>{poseCompte(a.richesses,k,v);out.replaceWith(blocRichesses(a));")
  &&fief.includes("function renderDomRessources(){")&&fief.includes("const poser=mj?(k,v)=>{poseCompte(r,k,v);renderDomRessources();sauveDomaine()}:null;")
  &&fief.includes("ressourcesJeu().filter(x=>x.cle!=='or').forEach(({cle:k,nom:m,piece})=>{"),'les compteurs : sur la carte de l’aventurier, au domaine');
 const ctxP={lisCompte:C.lisCompte};vm.createContext(ctxP);vm.runInContext(src.slice(src.indexOf('function poseCompte('),src.indexOf('// Les richesses d\'un aventurier, sur sa carte')),ctxP);
 const compte={or:4};assert.equal(ctxP.poseCompte(compte,'or','12'),12);ctxP.poseCompte(compte,'eclat-rubis','0');ctxP.poseCompte(compte,'or','');
 assert.deepEqual({...compte},{},'un compte à zéro disparaît');}
/* v0.284 — Les bâtiments servent construits et intacts. Le lieu d'un aventurier est sur sa fiche :
   son joueur l'y déplace, « S'y déplacer ». Le Magasin vend ce que l'armurerie coche « Magasin »,
   et rachète à 50 % du prix, arrondi en dessous, avec l'or de l'aventurier présent. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),fief=fs.readFileSync('domaine.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const B=(etape,etat,fonction)=>({etape,etat,fonction});
 assert.equal(C.fonctionActive(B(3,'','magasin')),true);
 assert.deepEqual([B(2,'','magasin'),B(0,'','magasin'),B(3,'feu','magasin'),B(3,'abandonne','magasin'),B(3,'',''),null].map(C.fonctionActive),[false,false,false,false,false,false],'construit et intact, sinon rien');
 assert.equal(C.fonctionParNom('Magasin'),'magasin');assert.equal(C.fonctionParNom('Forge'),'');
 const D=C.normaliseDomaine({batiments:[{nom:'Magasin'},{nom:'Magasin',fonction:''},{nom:'Échoppe',fonction:'magasin'},{nom:'X',fonction:'bidule'}]});
 assert.deepEqual(D.batiments.map(b=>b.fonction),['magasin','','magasin',''],'un Magasin d’avant le devient une fois ; ensuite le MJ choisit');
 assert.equal(C.normaliseDomaine(null).batiments.find(b=>b.nom==='Magasin').fonction,'magasin');
 assert.deepEqual([7,10,1,0,'x',99].map(p=>C.prixVente({price:p})),[3,5,0,0,0,49],'la moitié, arrondie en dessous');assert.equal(C.prixVente({price:10},75),7);
 const a={richesses:{or:20}};assert.deepEqual(C.peutAcheter(a,{price:15,magasin:true}),{ok:true,prix:15,manque:0,enVente:true});
 assert.deepEqual(C.peutAcheter(a,{price:25,magasin:true}),{ok:false,prix:25,manque:5,enVente:true});assert.equal(C.peutAcheter(a,{price:5}).ok,false,'hors magasin, pas d’achat');
 assert.equal(C.ajouteOr(a,-15),5);assert.equal(C.ajouteOr(a,-9),0);assert.deepEqual(a.richesses,{},'l’or ne descend pas sous zéro, et un compte nul disparaît');assert.equal(C.ajouteOr(a,3),3);
 assert.ok(fief.includes("const lieuDe=a=>!a?'':typeof a.lieuDomaine==='string'?a.lieuDomaine:((domaine.aventuriers[a.id]||{}).lieu||'');")
  &&fief.includes("if(typeof enLigne!=='undefined'&&enLigne)return typeof monSiege!=='undefined'&&monSiege===a.id;"),'le lieu voyage avec l’aventurier, et son joueur seul le déplace');
 assert.ok(fief.includes("function blocDeplacements(b){const troupe=actors.filter(a=>a.hero);if(!troupe.length||!batimentConstruit(b))return null;")
  &&fief.includes("quoi.textContent=ici?'Ici':'S’y déplacer';")&&fief.includes("function finFiche(boite,b){")&&(fief.match(/boite\.append\(qui\);finFiche\(boite,b\)\}/g)||[]).length===2,'un bouton par aventurier, sur chaque fiche');
 assert.ok(fief.includes("if(!fonctionActive(b)){")&&fief.includes("if(b.fonction==='magasin')blocMagasin(out,b);")
  &&fief.includes("const enVente=(catalog.items||[]).filter(o=>o&&o.magasin===true)")&&fief.includes("ici.fonction!=='magasin'||!fonctionActive(ici))return;")
  &&fief.includes("ajouteOr(a,-p.prix);ajouterInventaire(a,o);")&&fief.includes("retirerInventaire(a,o);ajouteOr(a,v);"),'le magasin : présent, construit, intact');
 assert.ok(src.includes("o.magasin=o.magasin===true;")&&src.includes("<input name=\"magasin\" type=\"checkbox\" '+(a.magasin===true?'checked':'')+'>Magasin — achetable au magasin du domaine</label>'")
  &&src.includes(" if(f.magasin)a.magasin=f.magasin.checked;"),'la case Magasin de l’armurerie');}
/* v0.285 — La Citrine, cinquième variété ; les gemmes ont un prix, par taille et par variété ;
   la grille se lit par variété, de la moins chère à la plus chère. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8');
 assert.deepEqual(C.VARIETES_GEMMES.map(([k])=>k),['citrine','emeraude','saphir','rubis','diamant']);
 assert.deepEqual(C.TAILLES_GEMMES.map(([t])=>C.VARIETES_GEMMES.map(([v])=>C.valeurGemme(t,v,false))),[[5,10,15,20,50],[25,50,75,100,250],[50,100,150,200,500]],'les prix de Valentin');
 assert.equal(C.valeurGemme('eclat','rubis',true),0,'une éteinte n’a pas de prix');
 assert.equal(C.valeurGemmes({or:999,'brisure-citrine':2,'eclat-rubis':1,'brome-diamant':1,'brome-diamant-eteinte':4}),610);
 assert.equal(C.nomGemme('brisure','citrine',false),'Brisures de citrine');
 assert.ok(src.includes("varietes.forEach(([v,nv])=>{const r=corps.insertRow();r.className='g-'+v;")&&src.includes("if(total){const c=t.createCaption();c.textContent='Valeur des gemmes'+(GEMMES_ETEINTES?' allumées':'')+' : '")
  &&fs.readFileSync('editor.css','utf8').includes('.g-citrine{--g:#e2b12a}'),'la grille par variété, et sa valeur');}
/* v0.286 — Les icônes des gemmes : img/ressource_<taille>_<variété>.png, déclarées comme les autres
   logos, dans chaque case de la grille et en tête de chaque variété ; grises pour les éteintes. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8');
 const declares=JSON.parse(src.match(/const LOGOS_RESSOURCES=(\[[^\]]*\]);/)[1].replace(/'/g,'"')).sort();
 const fichiers=fs.readdirSync('img').filter(f=>/^ressource_.*\.png$/.test(f)).map(f=>f.replace(/\.png$/,'')).sort();
 assert.deepEqual(declares,fichiers,'LOGOS_RESSOURCES doit lister img/ressource_*.png : '+fichiers.join(', '));
 const attendues=C.TAILLES_GEMMES.flatMap(([t])=>C.VARIETES_GEMMES.map(([v])=>C.iconeGemme(t,v))).sort();
 assert.deepEqual(attendues,fichiers.filter(f=>/^ressource_(brisure|eclat|gemme)_/.test(f)),'chaque gemme a son icône, et chaque icône sa gemme');
 assert.equal(C.iconeGemme('brome','rubis'),'ressource_gemme_rubis');
 const ctxL={TAILLES_GEMMES:C.TAILLES_GEMMES,VARIETES_GEMMES:C.VARIETES_GEMMES,FICHIERS_TAILLES:C.FICHIERS_TAILLES};vm.createContext(ctxL);
 vm.runInContext(fs.readFileSync('planches.js','utf8').match(/const estIconePlanche=[^\n]*/)[0]+'\n'+src.match(/const estLogoDossier=[^\n]*/)[0]+'\n'+src.slice(src.indexOf('const NOMS_LOGOS='),src.indexOf('// Un menu de logos en familles'))+';this.nomLogo=nomLogo;',ctxL);
 assert.deepEqual(['ressource_eclat_rubis','ressource_gemme_emeraude','ressource_brisure_citrine'].map(ctxL.nomLogo),['Éclat de rubis','Brôme d’émeraude','Brisure de citrine']);
 assert.ok(src.includes("el.append(iconeDeGemme(ta,v,eteinte),(eteinte?' ':'')+n);")&&src.includes("th.append(iconeDeGemme('brome',v,false),nom);")
  &&fs.readFileSync('editor.css','utf8').includes('table.gemmes .gem-eteinte .gem-ico{width:11px;height:11px;filter:grayscale(1)'),'les icônes dans la grille, grises pour les éteintes');}
/* v0.287 — Les gemmes éteintes sont en sommeil : une gemme se dépense tout entière. Elles quittent
   les comptes, la grille n'a plus leur ligne ; un drapeau les ramènerait partout. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8');
 assert.equal(C.GEMMES_ETEINTES,false);
 assert.deepEqual(C.normaliseDomaine({ressources:{'eclat-rubis':3,'eclat-rubis-eteinte':2}}).ressources,{'eclat-rubis':3},'les éteintes quittent aussi la réserve du domaine');
 assert.ok(src.includes("[false,...(GEMMES_ETEINTES?[true]:[])].forEach(eteinte=>{"),'la grille sans leur ligne');}
/* v0.288 — Les paliers : trois par talent, un pour un bonus. Le palier 1 est le talent ; les
   suivants gardent ce qu'ils ne redisent pas. Chaque palier a son coût en PT. L'arbre montre
   trois points sous l'icône, un clic monte d'un palier, « − » redescend ; la bulle compare le
   palier tenu au suivant ; l'éditeur a une colonne par palier. Le moteur joue le palier tenu. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 // Les paliers sont en sommeil ; on les rallume ici pour vérifier le modèle qui dort.
 C.PALIERS.actifs=true;
 const t={id:'o',effet:'orbes',params:{orbes:1},effects:'Un orbe',couts:[1,2,'x'],paliers:{2:{params:{orbes:2},effects:''},3:{effects:'Trois orbes'}}};
 assert.equal(C.paliersDe(t),3);assert.equal(C.paliersDe({effet:'bonus'}),1);
 assert.equal(C.talentAuPalier(t,1),t,'le palier 1 est le talent lui-même');
 assert.deepEqual([2,3].map(n=>{const x=C.talentAuPalier(t,n);return [x.params.orbes,x.effects,x.palier]}),[[2,'Un orbe',2],[2,'Trois orbes',3]],'ce qu’un palier ne redit pas, il le garde');
 assert.equal(C.talentAuPalier(t,9).palier,3);assert.equal(C.talentAuPalier({effet:'bonus',params:{}},3).palier,undefined,'un bonus reste à son palier unique');
 const a={talents:['o'],paliersTalents:{o:2}};
 assert.equal(C.palierDe(a,t),2);assert.equal(C.palierDe({talents:['o']},t),1);assert.equal(C.palierDe({talents:[]},t),0);assert.equal(C.palierDe({talents:['o'],paliersTalents:{o:7}},t),3);
 assert.deepEqual([1,2,3].map(n=>C.coutPalier(t,n)),[1,2,0]);assert.equal(C.ptDepenses(a,[t]),3);assert.equal(C.ptDepenses({talents:['o'],paliersTalents:{o:3}},[t]),3);
 assert.deepEqual(C.talentsAuPalier(a,[t]).map(x=>x.params.orbes),[2],'le moteur joue le palier tenu');
 assert.deepEqual(C.normalisePaliersActeur({talents:['o','p'],paliersTalents:{o:3,p:1,q:2,r:'x'}}),{o:3},'un palier 1 ne s’écrit pas ; un talent oublié perd le sien');
 assert.ok(fs.readFileSync('combat.js','utf8').includes("function bonusDe(a,talents,items){const out=bonusTalents(talentsAuPalier(a,talents)"),'la table et les bonus jouent le palier ; il voyage en direct');
 assert.ok(src.includes("a.paliersTalents=normalisePaliersActeur(a);"),'paliers relus, au catalogue et sur la fiche');
 assert.ok(src.includes("function dessineReglagesTalent(){")&&src.includes("placeholder=\"Comme le palier '+(n-1)+'\"")&&src.includes("const propres=!!q&&JSON.stringify(q)!==JSON.stringify(avant);")&&feuille.includes('.paliers-table{'),'l’éditeur : une colonne par palier, le coût en PT');
 assert.ok(src.includes("// Seul le texte du MJ : la phrase du moteur se lit dans l'éditeur, pas dans la bulle.")
  &&src.includes("a.talents=reste;a.paliersTalents=normalisePaliersActeur(a);")&&feuille.includes('.arbre-paliers i.on{')&&feuille.includes('.paliers-bulle.n2{grid-template-columns:1fr auto 1fr}'),'l’arbre : points, clic, « − », bulle comparée');}
/* v0.289 — Brise en trois paliers cumulés, contre une cible qui porte l'état : la DEF ignorée,
   puis retirée pour de bon après l'attaque, puis les dégâts doublés. La bulle de l'arbre montre
   le palier tenu, une flèche, le suivant ; rien d'appris, le premier seul. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const B=(palier,etat='Feu',perte=1)=>({code:C.TALENTS_CODES.brise,params:{etat,perte},talent:{palier}});
 const gel={states:['Feu']};
 assert.deepEqual(C.briseContre([B(undefined)],gel),{palier:1,etat:'Feu',ignore:true,perte:0,double:false},'palier 1 : la DEF ignorée');
 assert.deepEqual(C.briseContre([B(2,'Feu',2)],gel),{palier:2,etat:'Feu',ignore:true,perte:2,double:false},'palier 2 : et la DEF retirée');
 assert.deepEqual(C.briseContre([B(3)],gel),{palier:3,etat:'Feu',ignore:true,perte:1,double:true},'palier 3 : cumulé, et doublé');
 assert.deepEqual(C.briseContre([B(3,'Gel'),B(1)],gel).palier,1,'seule compte la Brise dont l’état est là');
 assert.equal(C.briseContre([B(3)],{states:[]}).ignore,false);assert.equal(C.briseLaGarde([B(2)],gel),true);
 const ph=n=>C.phraseTalent('brise',{etat:'Feu',perte:2},n);
 assert.ok(!ph(1).includes('retirent')&&ph(2).includes('<b>retirent 2 DEF</b>')&&!ph(2).includes('double')&&ph(3).includes('<b>le double de dégâts</b>'),'la phrase suit le palier');
 assert.ok(page.includes("const brisee=brise.perte&&!r.failed?brise.perte:0;if(brisee)b.defBrisee=(Math.trunc(Number(b.defBrisee))||0)+brisee;")
  &&page.includes("def,solidite:solide,double,total},suite);")&&page.includes("if(detail.double)plus('× 2 — Brise','double');")
  &&vivant.includes("solidite:!!detail.solidite,double:!!detail.double,total:detail.total||0}"),'Brise à la table : doublée, la DEF retirée, dite au journal, en direct');
 assert.ok(src.includes("g.className='paliers-bulle liste';")
  &&fs.readFileSync('editor.css','utf8').includes('.paliers-bulle.liste .palier-num{')&&!fs.readFileSync('editor.css','utf8').includes('.paliers-bulle.liste .palier-col'),'v0.324 : les paliers d’un talent appris en liste, I, II, III');}
/* v0.290 — Le Mystique choisit un élément — Feu, Gel, Foudre —, au MJ de le fixer. Ses talents
   élémentaires s'écrivent une fois, avec des accolades ; leur état suit l'élément ; la colonne
   « Élémentaire » peut naître de la fusion des trois colonnes d'avant. Les gemmes d'un aventurier
   ne montrent que ce qu'il a, sans cases ; le « + » du MJ lui ajoute or et gemmes. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.deepEqual(C.ELEMENTS.map(e=>[e.cle,e.etat,e.mot,e.logo]),[['feu','Feu','feu','feu'],['gel','Gel','glace','gel'],['foudre','Foudre','foudre','foudre']]);
 assert.equal(C.classeElementaire('Mystique'),true);assert.equal(C.classeElementaire('Gardien'),false);
 const [F,G,Z]=C.ELEMENTS;
 assert.deepEqual([F,G,Z].map(e=>C.remplaceElement('Brise{mot} · {Mot} · {élément} · {element} · {état} · spell_orbes_{logo}',e)),
  ['Brisefeu · Feu · Feu · Feu · Feu · spell_orbes_feu','Briseglace · Glace · Gel · Gel · Gel · spell_orbes_gel','Brisefoudre · Foudre · Foudre · Foudre · Foudre · spell_orbes_foudre']);
 assert.equal(C.remplaceElement('Brise{mot}',null),'Brise{mot}');
 const t={id:'b',name:'Brise{mot}',effet:'brise',elementaire:true,params:{etat:'Feu',perte:1},effects:'Contre {état}',logo:'spell_orbes_{logo}',paliers:{2:{effects:'',params:{etat:'Feu',perte:2}}}};
 const g=C.talentPourElement(t,G);
 assert.deepEqual([g.name,g.effects,g.logo,g.params.etat,g.paliers[2].params.etat,g.paliers[2].params.perte],['Briseglace','Contre Gel','spell_orbes_gel','Gel','Gel',2],'élémentaire : mots, logo et état suivent');
 const libre={...t,elementaire:undefined};assert.equal(C.talentPourElement(libre,G).params.etat,'Feu','sans la case, l’état réglé reste');
 const neutre={id:'x',name:'Forge',params:{etat:'Feu'}};assert.equal(C.talentPourElement(neutre,G),neutre);assert.equal(C.estElementaire(neutre),false);assert.equal(C.estElementaire(libre),true);
 assert.deepEqual(C.talentsAuPalier({talents:['b'],element:'foudre',paliersTalents:{b:2}},[t]).map(x=>[x.name,x.params.etat,x.params.perte]),[['Brisefoudre','Foudre',1]],'la table joue l’élément, puis le palier ; la DEF retirée, réglage commun, reste celle du palier 1');
 assert.ok(vivant.includes("const CHAMPS_ACTEUR_MJ=['vu','revealed','hidden','numero','element','pnj','alignement','alignementJeu','debutTour'];")
  &&src.includes("if(a.element!==undefined&&!elementDe(a))delete a.element;"),'l’élément voyage, au MJ seul');
 assert.ok(src.includes("function choixElement(a,classe,rendre){")&&src.includes("if(elementaire)tete.append(choixElement(a,classe));")&&src.includes("b.disabled=!peut;")
  &&src.includes("(sansElement&&estElementaire(t)?VERROU_ELEMENT:'')")&&src.includes("const tp=talentAuPalier(vu(t),n),c=coutPalier(t,n)")
  &&src.includes(".filter(c=>!(a&&elementaire&&!c.liste.length)).forEach(c=>grille.append(colonne(c,classe===GENERIQUES)));")
  &&src.includes("name=\"elementaire\""),'l’arbre, la fiche et l’éditeur suivent l’élément');
 assert.ok(src.includes(".filter(r=>ELEMENTS.every(e=>LOGOS_TOUS.includes(r+'_'+e.logo))).map(r=>r+'_{logo}');")&&page.includes("const teinte=etat||(elementDe(a)||{}).etat||'';"),'le logo et l’orbe suivent l’élément ; les dés restent les leurs');
 /* v0.301 : sur la carte d'un aventurier, ses gemmes en ligne, sans tableau ni valeur en or. */
 assert.ok(src.includes("function ligneGemmes(compte,poser,qui){const l=document.createElement('div');l.className='gemmes-ligne';")&&src.includes("return l.childElementCount?l:null}")
  &&src.includes("const g=ligneGemmes(a.richesses,poser,a.name);")&&!src.includes('possedees')&&src.includes("function openRichesses(a){if(view!=='mj'||!a)return;")
  &&src.includes("poseCompte(a.richesses,k,(a.richesses[k]||0)+signe*n);")&&fs.readFileSync('editor.css','utf8').includes('.gemmes-ligne{display:flex;flex-wrap:wrap;'),'les gemmes possédées en ligne, et le « + » du MJ');}
/* v0.291 — Un talent se supprime depuis le plan de l'arbre ; ce qui pendait sous lui remonte.
   Plus de fusion ni de phrase d'aperçu. Seule une classe du jeu a un arbre : ni les adversaires,
   ni les génériques. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("function retireDeLArbre(t){")&&src.includes(" detacheDeLArbre(t);t.horsArbre=true;t.prerequis='';return true}")
  &&!src.includes('async function supprimeTalent('),'le talent se retire de l’arbre, sans s’effacer ; ses lignes s’en vont');
 assert.ok(!src.includes('fusionElementaire')&&!src.includes('Aperçu de l’arbre sous chaque élément'),'ni fusion, ni phrase d’aperçu');
 assert.ok(src.includes("function aUnArbre(f){return !!f&&f!==GENERIQUES&&(catalog.classes||[]).some(c=>c&&c.name===f)}")&&src.includes("if(view==='mj'&&aUnArbre(famille)){const rouage=")
  &&src.includes("function peutVoirArbres(a){a=acteurCourant(a);return !!a&&!!a.hero&&"),'un arbre pour les classes seules');
 const ctxA={GENERIQUES:'Génériques',catalog:{classes:[{name:'Mystique'},{name:'Gardien'}]}};vm.createContext(ctxA);
 const deb=src.indexOf('function aUnArbre(');vm.runInContext(src.slice(deb,src.indexOf('\n',deb)),ctxA);
 assert.deepEqual(['Mystique','Gardien','Génériques','Gobelins','',undefined].map(x=>ctxA.aUnArbre(x)),[true,true,false,false,false,false]);}
/* v0.292 — Le domaine ne se perd plus. Une fenêtre qui voit une autre enregistrer n'enregistre
   plus rien ; un domaine vide n'en efface pas un plein ; un domaine qui a du contenu se garde aussi
   en secours, que l'onglet propose de reprendre. L'import des cartes reconnaît les autres fichiers. */
{const fief=fs.readFileSync('domaine.js','utf8'),src=fs.readFileSync('editor.js','utf8'),cartes2=fs.readFileSync('maps.js','utf8');
 const C=require('./combat.js');
 const ctxP={};vm.createContext(ctxP);vm.runInContext(fief.slice(fief.indexOf('function poidsDomaine('),fief.indexOf('/* ---------- Le domaine de secours')),ctxP);
 const vierge=C.normaliseDomaine(null);assert.equal(ctxP.poidsDomaine(vierge),0,'le domaine d’origine ne pèse rien');
 assert.ok(ctxP.poidsDomaine(C.normaliseDomaine({nom:'Lamuline',carte:{calques:['x']},batiments:[{nom:'T',etape:3,zone:[[0,0],[1,0],[1,1]]}]}))>100,'des calques, des zones : un domaine précieux');
 assert.ok(ctxP.poidsDomaine(C.normaliseDomaine({nom:'Lamuline'}))>0&&ctxP.poidsDomaine(null)===0);
 assert.ok(fief.includes(" if(poidsDomaine(d)>0||poidsDomaine(domaine)===0)domaine=d;domSel=null;domPageSel=null};")&&fs.readFileSync('shared.js','utf8').includes("poidsDomaine(d)>0||poidsDomaine(domaine)===0)domaine=d;"),'un domaine vide n’efface pas un domaine plein');
 assert.ok(fief.includes("const saveNowSansSecours=saveNow;saveNow=function(){saveNowSansSecours();gardeSecoursDomaine()};")&&fief.includes("tx.objectStore('state').put(rec,'domaine:secours');")
  &&fief.includes("||poidsDomaine(domaine)<=0)return;")&&fief.includes("b.textContent='⟲ Reprendre ce domaine';")
  &&fief.includes("o.genre==='campagne'&&o.partie&&o.partie.domaine?o.partie.domaine:"),'le domaine de secours, et l’import depuis une campagne');
 assert.ok(src.includes("function saveNow(){if(ongletPerime){")&&src.includes("marqueSession();try{const tx=db.transaction('state','readwrite'),st=tx.objectStore('state'),s=snapshot();")
  &&src.includes("window.addEventListener('storage',e=>{if(e.key!=='amertume-session-marque'||!e.newValue)return;")&&src.includes("if(document.visibilityState==='visible'&&ongletPerime)relireSession()"),'une fenêtre périmée n’écrase plus la partie');
 assert.ok(cartes2.includes("Array.isArray(o.actors)&&Array.isArray(o.maps)?o.maps.filter(m=>m&&typeof m==='object'):null;")&&cartes2.includes("Ce fichier est un export du domaine : reprends-le dans l’onglet Domaine")
  &&cartes2.includes('Le domaine n’y est pas : il s’exporte depuis son onglet, et la partie entière depuis les Paramètres.'),'l’import des cartes reconnaît les autres fichiers');
 assert.ok(cartes2.includes("Array.isArray(o.actors)?'Ce fichier est une sauvegarde globale de la partie, sans carte à importer ici."),'une sauvegarde globale sans carte le dit');}
/* v0.293 — Retirer un talent de l'arbre ne l'efface plus : il reste au catalogue, dans la
   réserve sous l'arbre, d'où il se replace d'un glisser. La suppression définitive se fait
   depuis la réserve. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const ctxR={view:'mj',LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],estBonus:t=>!!t&&t.effet==='bonus',catalog:{talents:[{id:'a',name:'A',pos:{x:0,y:0},liens:['b']},{id:'b',name:'B',pos:{x:0,y:1},liens:['c','g']},
  {id:'c',name:'C',pos:{x:0,y:2}},{id:'g',name:'G',pos:{x:-1,y:2}},{id:'k',name:'+1',effet:'bonus',chemin:{de:'b',dir:'ne',rang:1}},{id:'k2',name:'+2',effet:'bonus',chemin:{de:'b',dir:'ne',rang:2}}]}};
 vm.createContext(ctxR);vm.runInContext(src.slice(src.indexOf('function posDe('),src.indexOf('/* Les colonnes d\'une classe : deux, toujours'))+src.slice(src.indexOf('// Un petit rond dont le talent, ou le petit rond d\'avant'),src.indexOf('function placerTalent('))
  +src.slice(src.indexOf('function retireDeLArbre('),src.indexOf('function renderArbres(){')),ctxR);
 const T=id=>ctxR.catalog.talents.find(t=>t.id===id);
 assert.equal(ctxR.retireDeLArbre(T('b')),true);
 assert.ok(T('b').horsArbre===true&&T('b').prerequis===''&&!T('b').pos&&!T('b').liens&&ctxR.catalog.talents.length===6,'le talent retiré reste au catalogue, sans case ni ligne');
 assert.ok(!T('a').liens&&T('c').pos&&T('g').pos,'la ligne qui menait à lui s’efface ; ses suivants restent en place, devenus des départs');
 assert.ok(T('k').horsArbre&&!T('k').chemin&&T('k2').horsArbre&&!T('k2').chemin,'les petits ronds de ses chemins quittent l’arbre');
 assert.equal(ctxR.retireDeLArbre(T('b')),false,'un talent déjà retiré ne se retire pas deux fois');
 assert.ok(src.includes("function colonnesArbre(classe){const talents=(catalog.talents||[]).filter(t=>t&&talentFamily(t)===classe&&!t.horsArbre&&!lisChemin(t));")
  &&src.includes(" t.famille=famille;t.voie=voie;t.prerequis='';delete t.horsArbre;delete t.branche;"),'hors de l’arbre, il n’y paraît plus ; replacé, il y revient');
 /* v0.294 — Ni réserve sous l'arbre, ni mention au catalogue : un talent retiré se remet
    dans l'arbre par son formulaire, « Place dans l'arbre ». */
 assert.ok(src.includes("if(!a)outils.append(ico('✕','Retirer '+vu(t).name+' de l’arbre, sans l’effacer du catalogue'")
  &&!src.includes('arbre-reserve')&&!src.includes('cat-hors')&&!css.includes('.arbre-reserve')&&!src.includes('dest.horsArbre'),'plus de réserve, plus de mention');
 assert.ok(!src.includes("f.branche.value==='hors'")
  &&src.includes("if(t.horsArbre!==true)delete t.horsArbre;"),'le formulaire retire et replace');}
/* v0.295 — L'éditeur de talents en boîtes colorées, sans spécialisation, place ni prérequis :
   l'arbre assemble. Les effets câblés se lisent et se réorganisent par palier (les volets de
   Brise), les réglages communs s'écrivent une fois, l'état d'un talent élémentaire suit le
   Mystique. Les accolades valent dans le nom, casse et accents indifférents. La bulle d'un
   talent s'ouvre au survol dans l'onglet Talents, MJ compris. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.deepEqual(C.voletsDe({effet:'brise'}),{ignore:1,perte:2,double:3},'les volets de Brise, à leurs paliers d’origine');
 assert.deepEqual(C.voletsDe({effet:'brise',volets:{ignore:2,perte:0,double:1}}),{ignore:2,perte:0,double:1},'le MJ les réorganise, 0 pour jamais');
 const R=(palier,volets)=>({code:C.TALENTS_CODES.brise,params:{etat:'Feu',perte:3},talent:{palier,effet:'brise',volets}});
 assert.deepEqual(C.briseContre([R(1,{ignore:2,perte:0,double:1})],{states:['Feu']}),{palier:1,etat:'Feu',ignore:false,perte:0,double:true},'palier 1 réorganisé : le double, sans la garde');
 assert.deepEqual(C.briseContre([R(2,{ignore:2,perte:0,double:1})],{states:['Feu']}),{palier:2,etat:'Feu',ignore:true,perte:0,double:true},'palier 2 : la garde s’ouvre, la DEF n’est jamais retirée');
 assert.ok(C.phraseTalent('brise',{etat:'Feu'},1,{ignore:2,perte:0,double:0}).includes('rien encore à ce palier')&&C.phraseTalent('brise',{etat:'Feu'},2,{ignore:2,perte:0,double:0}).includes('<b>ignorent sa DEF</b>.'),'la phrase suit les volets ouverts');
 const G=C.ELEMENTS[1];
 assert.deepEqual(['{Élément}','{MOT}','{Mot}','Brise{mot}','spell_{LOGO}','{Etat}'].map(x=>C.remplaceElement(x,G)),['Gel','GLACE','Glace','Briseglace','spell_gel','Gel'],'casse et accents indifférents');
 assert.ok(C.aDesAccolades('Invulnérable : {Élément}')&&C.estElementaire({name:'Brise{ÉLÉMENT}'}),'une accolade en capitales compte');
 assert.equal(C.talentAuPalier({effet:'brise',params:{etat:'Feu',perte:2},paliers:{3:{params:{etat:'Gel',perte:5}}}},3).params.etat,'Feu','un réglage commun reste celui du palier 1');
 assert.ok(!src.includes("'Prérequis — talent à posséder d’abord'")&&!src.includes("'Spécialisation','voie'")&&!src.includes("function optionsVoie(")&&!src.includes('voie-autre'),'ni spécialisation, ni place, ni prérequis au formulaire');
 assert.ok(src.includes('<section class="talent-boite b-identite"><h2 class="sous-titre">Identité</h2>')&&src.includes('<section class="talent-boite b-moteur t-seul"><h2 class="sous-titre">Mécanique du moteur</h2>')&&src.includes('<section class="talent-boite b-bonus b-seul">')
  &&css.includes('.talent-boite{--boite:#9d7b1e;')&&css.includes('.talent-boite.b-moteur{--boite:#3a6fc2}'),'quatre boîtes, chacune sa couleur');
 assert.ok(src.includes("d.volets={...d.volets,[c]:k===n?0:n};dessineReglagesTalent()")&&src.includes("params.filter(p=>reglageCommun(p)&&!p.volet).forEach(p=>{")
  &&src.includes("const cell=elem&&p.cle==='etat'?'<span class=\"suit-element\">L’élément du Mystique : Feu, Gel ou Foudre</span>")&&src.includes("function phrasesPaliers(){")
  &&src.includes("t.volets=voletsDe({effet:t.effet,volets:talentDraft.volets})")&&src.includes("...communsDe(t.effet,t.params)")&&css.includes('.volet-case.ici{'),'les volets par palier, les réglages communs, la phrase du moteur');
 assert.ok(src.includes("function nomAccolades(el,texte){")&&src.includes("nom.className='nom-carte';nomAccolades(nom,vu.name);")&&!src.includes("nom.className='arbre-nom'")
  &&src.includes("p.textContent='Selon l’élément : '+ELEMENTS.map(e=>remplaceElement(v,e)).join(' · ')")&&css.includes('.accolade{'),'les accolades du nom, en pastille ou remplies');
 assert.ok(src.includes("if(BULLES)surveille(p,()=>{const d=bulleTalent(t,{vu:x=>sous?talentPourElement(x,sous):x});ouvrirBulle(p,d,")
  &&!src.includes("m.className='palier-moteur'")&&src.includes("if(elem)h=enElementDuMystique(h,vals[n].etat);"),'la bulle au survol, dans l’onglet Talents aussi ; l’élément du Mystique sans élément');
 assert.ok(!src.includes('↩ Remettre dans l’arbre'),'le menu de tête a laissé la place aux « + »');}
/* v0.296 — Les orbes élémentaires par palier : l'état sur 6+, puis à chaque touche, puis en
   deux crans, trois volets que le MJ réorganise. Dans l'arbre, les « + » proposent un talent
   neuf ou un talent du catalogue, retiré de l'arbre, générique ou d'une autre classe. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8');
 const O=(palier,etat='Feu',volets)=>[{code:C.TALENTS_CODES.orbesfeu,params:{etat},talent:{palier,effet:'orbesfeu',volets}}];
 assert.deepEqual(C.etatOrbeAuPalier(O(undefined)),{etat:'Feu',six:true,crans:1},'palier 1 : l’état sur 6+');
 assert.deepEqual(C.etatOrbeAuPalier(O(2)),{etat:'Feu',six:false,crans:1},'palier 2 : à chaque touche');
 assert.deepEqual(C.etatOrbeAuPalier(O(3)),{etat:'Feu',six:false,crans:2},'palier 3 : deux crans');
 assert.equal(C.etatOrbeAuPalier(O(3,'Gel')).crans,1,'le Gel ne s’empile pas : un cran');
 assert.equal(C.etatOrbeAuPalier(O(1,'Feu',{six:0,touche:2,deux:3})),null,'réorganisé : rien au palier 1');
 assert.deepEqual([1,2,3].map(n=>C.ditEtatOrbe(C.etatOrbeAuPalier(O(n)))),['Feu sur 6+','Feu à la touche','Feu 2 à la touche']);
 assert.ok(page.includes("const k=pouvoir?crans(pouvoir.six?orbesAvecSix():pouvoir.blesse?orbesTouchant():n):0;")
  &&page.includes("else if(issue===true){if(k>1)ajouteEtat(b,e,k-1);pose=' + '+e+(k>1?' '+k:'')}}"),'la table pose l’état selon le palier, un cran par orbe du Déluge');
 assert.ok(src.includes("function ajouterDansArbre(dest){")&&src.includes("if(f!==dest.famille&&!t.horsArbre)videDeLArbre(t);")
  &&src.includes("ajouterDansArbre({famille:col.famille,voie:col.voie,pos:{x:pl.x,y:pl.y},de:")&&fs.readFileSync('editor.css','utf8').includes('.arbre-choix-liste{'),'les « + » de l’arbre prennent aussi un talent existant');}
/* v0.298 — Meneur câblé sur ses textes : l'allié le plus proche, où qu'il soit, d'un nombre
   fixe ou du bonus propre du porteur ; tous les alliés au contact. Les accolades se lisent
   même mal accentuées, et un logo à élément fixe suit celui du porteur. Talents et bestiaire
   en carrés, comme l'armurerie : la bulle au survol, plus de dépliant. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('editor.css','utf8');
 const sans=h=>h.replace(/<\/?b>/g,'');
 assert.deepEqual([{base:'fixe',valeur:1,combien:'un',portee:'partout'},{base:'porteur',combien:'un',portee:'partout'},{base:'porteur',combien:'tous',portee:'contact'}].map(p=>sans(C.phraseTalent('meneur',p))),
  ['Vous augmentez les dégâts de votre allié le plus proche de +1.','Vous augmentez les dégâts de votre allié le plus proche de vos dégâts.','Vous augmentez les dégâts de tous vos alliés au contact de vos dégâts.'],'les trois paliers de Meneur, tels qu’écrits');
 assert.ok(C.bonusDuMeneur({base:'porteur'})&&C.bonusDuMeneur({base:'porteur',quoi:'def'})&&!C.bonusDuMeneur({base:'porteur',quoi:'pv'})&&!C.bonusDuMeneur({}),'le bonus propre, sauf pour les PV');
 assert.ok(page.includes("function aPorteeMeneur(m,o,portee,size,murs){if(portee==='partout')return true;")&&page.includes("function propreBonusMeneur(m,quoi){const f=bonusFiche(m);")
  &&page.includes(":(Number(m.dmg)||0)+f.dmg;"),'n’importe où, et le bonus propre sans les autres meneurs');
 const G=C.ELEMENTS[1];
 assert.deepEqual((({name,logo,effects})=>[name,logo,effects])(C.talentPourElement({name:'Orbes de {élémént}',logo:'spell_orbes_feu',effects:'{Élement} et {truc}'},G)),['Orbes de Gel','spell_orbes_gel','Gel et {truc}'],'accents indifférents, accolade inconnue intacte, logo qui suit');
 assert.ok(!C.aDesAccolades('Le {truc}')&&C.aDesAccolades('{ETAT}'),'une accolade inconnue ne rend pas élémentaire');
 assert.ok(src.includes("p.className='cat-pill gear-carre talent-carre t-'+talentType(t)[0];")&&src.includes("if(mj){p.onclick=()=>openTalent(i);")&&src.includes("bloc.className='cat-col armurerie-grille'+(famille===GENERIQUES?' c-generique':'');")
  &&src.includes("bloc.className='cat-col armurerie-grille c-'+key;")&&src.includes("if(BULLES)surveille(p,()=>ouvrirBulle(p,bulleModele(m),'bulle-modele'));")&&src.includes("function bulleModele(m){")&&css.includes('.cat-pill.gear-carre.talent-carre{border:3px solid var(--teinte,#8a8474);width:69px;height:69px;min-width:0;min-height:0;padding:0;border-radius:50%}'),'talents et bestiaire en carrés');
 assert.ok(!src.includes('function talentBloc(')&&!src.includes('bestiaireOuverts')&&!src.includes('talentCorrige'),'plus de dépliant au clic');}
/* v0.299 — Le palier d'un talent tenu, en chiffre romain à la Killam après son nom : dans le
   titre de sa bulle, sur la fiche, sur les boutons de la table. */
{const src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(page.includes("const ROMAINS_PALIER=['','','II','III'];")&&!page.includes("function nomAvecPalier(")
  &&page.includes("palier:paliersDe(talent)>1&&talent.palier>1?talent.palier:0,")&&page.includes("geste(String(t.texte||t.talent.name),"),'les boutons de la table sont des ronds : le palier se lit dans la bulle du talent');
 assert.ok(src.includes("carte.append(talentRond(t,logo),n);return carte}")&&fs.readFileSync('editor.css','utf8').includes('.cat-carte.talent-carte .nom-carte.nom-rond,.sac-carte .nom-sac{display:none}')&&!src.includes('nom-texte')
  &&css.includes(".palier-romain{margin-left:.3em;font:inherit;"),'dans la bulle et sur la fiche, dans la police du nom');}
/* v0.300 — Un talent élémentaire choisit un logo par élément ; sans logo propre, l'ancien
   logo suit l'élément comme avant. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8');
 const t={name:'Orbes de {élément}',elementaire:true,logo:'spell_orbes_feu',logos:{feu:'a_feu',gel:'b_glace'}};
 assert.deepEqual(C.ELEMENTS.map(e=>C.talentPourElement(t,e).logo),['a_feu','b_glace','spell_orbes_foudre'],'le logo de l’élément, sinon celui qui suit');
 assert.ok(src.includes("+'<div class=\"edit-grid logos-elements t-seul\" id=\"logos-elements\" hidden>'+ELEMENTS.map(e=>selLogos('Logo · '+e.nom,'logo_'+e.cle,(t.logos||{})[e.cle]||'',true)).join('')+'</div>'")
  &&src.includes("$('logos-elements').hidden=!oui;menuLogo.closest('label').hidden=oui;")
  &&src.includes("if(Object.keys(logos).length){t.logos=logos;t.logo=logos[ELEMENTS.find(e=>logos[e.cle]).cle]}else delete t.logos;")
  &&src.includes("function selLogos(label,key,value,sansElementaires){")&&src.includes("ELEMENTS.forEach(e=>{const v=t.logos[e.cle];if(typeof v==='string'&&v&&v.length<=100)o[e.cle]=v});"),'trois menus de logo, un par élément, enregistrés et relus');}
/* v0.302 — Invulnérable refuse un état ou une couleur de dés, et prend pour logo, tout seul,
   le jeton de l'état ou le dé barré de rouge, comme les anneaux de l'armurerie. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const inv=(p)=>[{code:C.TALENTS_CODES.invulnerable,params:p}];
 assert.deepEqual(C.desRefuses(inv({contre:'des',des:'black'})),['black'],'insensible aux dés Mortels');
 assert.ok(!C.etatRefuse(inv({contre:'des',etat:'Feu'}),'Feu')&&C.etatRefuse(inv({contre:'etat',etat:'Feu'}),'Feu')&&C.etatRefuse(inv({etat:'Gel'}),'Gel')&&!C.desRefuses(inv({etat:'Gel'})).length,'un état, ou des dés, jamais les deux');
 assert.ok(C.phraseTalent('invulnerable',{contre:'des',des:'red'}).includes('<b>insensible aux dés Lourds</b>'));
 assert.ok(src.includes("function pastilleInsensible(p){let el=null,titre='';")&&src.includes("const p=talentRond(t,logoTalent({...vu,logo:remplaceElement(vu.logo||'',sous||ELEMENTS[0])}));")
  &&css.includes('.arbre-rond .effet-pastille.logo-auto{width:72%;height:72%}'),'le logo automatique, barré de rouge');}
/* v0.303 — Une attaque spéciale inflige autant d'états qu'on en coche ; l'état unique
   d'avant se lit toujours, et les modèles posés sur une carte gardent la liste. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8');
 assert.deepEqual(C.cleanMonster({name:'X',attacks:[{name:'A',etats:['Feu','Poison','Coma','Feu']},{name:'B',etat:'Gel'},{name:'C'}]}).attacks.map(a=>[a.etat,a.etats]),
  [['Feu',['Feu','Poison']],['Gel',['Gel']],[undefined,undefined]],'la liste gardée, les inconnus et les doublons écartés');
 assert.deepEqual(C.attackChoices({attacks:[{name:'A',etats:['Feu','Poison'],etat:'Feu'},{name:'B',etat:'Gel'}]},[]).map(a=>a.etats),[['Feu','Poison'],['Gel']],'la table pose tous les états');
 assert.ok(src.includes("+ETATS_JEU.map(e=>'<label class=\"etat-case\"><input type=\"checkbox\" name=\"ax'+i+'\" value=\"'+esc(e)+'\"'+(etatsAttaque(a).includes(e)?' checked':'')+'>'+esc(e)+'</label>').join('')+'</div>'")
  &&src.includes("const etatsAttaque=a=>Array.isArray(a&&a.etats)?a.etats:(a&&a.etat?[a.etat]:[]);"),'des cases, une par état');}
/* v0.304 — La bulle d'un modèle montre ses attaques : états infligés, dés, bonus de dégâts ;
   sans arme ni attaque spéciale, ses propres dés. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("const choix=attackChoices(eq,catalog.items||[]),attaques=choix.length?choix:propres;")
  &&src.includes("[...(at.etats||[])].reverse().forEach(e=>{const p=etatPastille(e);if(p)pips.prepend(p)});")
  &&src.includes("const bas=desEtBonus(at.dice,at.useOwnDamage===false?0:bonus),pips=bas.querySelector('.pips');")&&src.includes("if(sait('attaques'))rangAttaques(d,attaques,sait('dmg')?Number(m.damage)||0:0);")
  &&!src.includes("ligne('Attaques spéciales : '"),'les attaques de la bulle, avec dés et états');}
/* v0.305 — Le dossier img/talents : ses icônes paraissent seules dans le menu Logo d'un
   talent (la liste vient de GitHub, le dépôt étant public). Un chemin à dossier s'encode
   morceau par morceau, et le suffixe d'élément se remplace aussi devant une extension. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8');
 const ctxD={};vm.createContext(ctxD);vm.runInContext(fs.readFileSync('planches.js','utf8').match(/const estIconePlanche=[^\n]*/)[0]+'\n'+src.match(/const estLogoDossier=[^\n]*/)[0]+';this.estLogoDossier=estLogoDossier;',ctxD);
 assert.deepEqual(['talents/brise_glace.png','talents/orbe.webp','talents/a b.png','talents/../x.png','spell_orbes','talents/x.gif'].map(ctxD.estLogoDossier),[true,true,false,false,false,false],'une icône du dossier : un nom sûr et une image, rien au-dessus');
 assert.ok(fs.existsSync('img/talents/README.md')&&src.includes("fetch('https://api.github.com/repos/'+depot+'/git/trees/main?recursive=1'")&&src.includes("const fichierLogo=l=>estLogoDossier(l)?l:l+(EXTENSIONS_LOGO[l]||'.png');")
  &&src.includes("function logoImage(l,liste,cls){if(!l||!(liste.includes(l)||estLogoDossier(l)))return null;")&&page.includes("function imgUrl(nom){return './img/'+String(nom).split('/').map(encodeURIComponent).join('/')+'?v='+IMG_V}"),'le dossier des talents, lu sur GitHub, servi morceau par morceau');
 assert.equal(C.talentPourElement({name:'x',elementaire:true,logo:'talents/orbe_feu.png'},C.ELEMENTS[1]).logo,'talents/orbe_gel.png','le suffixe d’élément devant l’extension');
 assert.ok(fs.existsSync('img/weapon_cuir_epais.png'),'le cuir épais, câblé');}
/* v0.306 — Une icône du dossier des talents que le site n'a pas encore publiée se reprend
   au dépôt, où elle est dès l'envoi ; les aperçus du formulaire passent par là aussi. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("if(depot)im.onerror=()=>{im.onerror=null;im.src='https://raw.githubusercontent.com/'+depot+'/main/img/'+l.split('/').map(encodeURIComponent).join('/')}}")
  &&src.includes("apercu.hidden=!l;if(l)poseLogo(apercu,l)};")&&src.includes("im.hidden=!m.value;if(m.value)poseLogo(im,m.value)};")
  &&src.includes("im.className='logo-equip'+(cls?' '+cls:'');poseLogo(im,l);"),'le secours des icônes pas encore publiées');}
/* v0.307 — La colonne du Mystique, dans l'onglet Talents : Feu, Gel, Foudre dans sa barre, et
   ses talents montrés sous l'élément choisi, sans pastille d'accolade. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const elem=classeElementaire(famille)?(ELEMENTS.find(e=>e.cle===elementApercu)||ELEMENTS[0]):null;")
  &&src.includes("if(elem){const c=choixElement(null,famille,renderTalents);c.classList.add('compact');h.append(c)}")
  &&src.includes("lot.forEach(([t])=>r.append(talentRow(t,place.get(t.id),elem)))")&&src.includes("nom.className='nom-carte';nomAccolades(nom,vu.name);")
  &&src.includes("b.onclick=ev=>{ev.stopPropagation();elementApercu=e.cle;(rendre||renderArbres)()}")&&css.includes('.cat-col h3 .elements-bloc.compact{'),'Feu, Gel, Foudre dans la barre du Mystique');}
/* v0.308 — « Se relever » prend l'allure des boutons d'action ; le nom d'un talent sans dés se centre en
   hauteur contre son logo. (Au sol verrouille de nouveau le token depuis la v0.514.) */
{const page=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(page.includes("log(nomNum(a)+' se relève : Mouvement dépensé, Action encore disponible.',{ton:'etat'});render();scheduleSave()},'btn-action btn-mvt')}")
  &&css.includes('button.choix-attaque .nom{display:block;white-space:nowrap}'),'Se relever en bouton d’action, nom centré');}
/* v0.514 — Au sol : le token est verrouillé, MJ compris, jusqu'à ce que le combattant se relève (un Mouvement) ;
   le bouton Se relever porte l'icône de l'état. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes(" return controlled(i)&&(view===\"mj\"&&tenu||!hasState(actors[i],'Au sol'))&&(view===\"mj\"||(!tenu&&!tokensLocked&&!hasState(actors[i],'Gel')))&&!gelDebut(actors[i])}")
  &&page.includes("const ic=imageEtat('Au sol');if(ic&&ic.tagName==='IMG')ic.className='logo-equip';")
  &&page.includes("geste('Se relever',ic||'⤴','Remet le combattant debout.',!enCombat()||pointsRestants(a,'mouvement')>0,()=>{"),'Au sol verrouille le token ; Se relever à son icône');}
/* v0.309 — Une tuile de talent n'écrit plus sa nature sous son logo. */
{const src=fs.readFileSync('editor.js','utf8');const tuile=src.slice(src.indexOf('function talentRow('),src.indexOf('\nfunction ',src.indexOf('function talentRow(')+10));
 assert.ok(!tuile.includes("b.className='t-badge'")&&tuile.includes("const nature=talentType(t)[2],mj=view==='mj';")&&!fs.readFileSync('editor.css','utf8').includes('.talent-carre .t-badge'),'pas d’abrégé sous le logo');}
/* v0.310 — Quatre dossiers d'icônes se câblent seuls : talents, équipement, objets, attaques.
   Une seule demande à GitHub les liste tous ; un logo déjà choisi reste offert dans son menu,
   même si la liste n'est pas venue, et l'enregistrer ne l'efface pas. */
{const src=fs.readFileSync('editor.js','utf8');
 const dossiers=[...src.match(/const DOSSIERS_LOGOS=(\[[^\n]*\]);/)[1].matchAll(/\['([a-z]+)','/g)].map(m=>m[1]);
 const motif=src.match(/const estLogoDossier=l=>\/\^\(([a-z|]+)\)/)[1].split('|');
 assert.deepEqual(motif,dossiers,'le motif des logos de dossier suit la liste des dossiers');
 dossiers.forEach(d=>assert.ok(fs.existsSync('img/'+d+'/README.md'),'img/'+d+' a sa notice'));
 const ctxD={};vm.createContext(ctxD);vm.runInContext(fs.readFileSync('planches.js','utf8').match(/const estIconePlanche=[^\n]*/)[0]+'\n'+src.match(/const estLogoDossier=[^\n]*/)[0]+';this.e=estLogoDossier;',ctxD);
 assert.deepEqual(['equipement/hache_runes.png','objets/potion.webp','attaques/morsure.png','talents/x.png','autre/x.png','equipement/a/b.png'].map(ctxD.e),[true,false,false,true,false,false],'v0.311 : les deux dossiers, talents et équipement, rien d’autre');
 assert.ok(!fs.existsSync('img/objets')&&!fs.existsSync('img/attaques'),'ni dossier objets, ni dossier attaques');
 assert.ok(src.includes("const familles=[...famillesPlanches(),...FAMILLES_LOGOS],garde=value&&!familles.some(([,l])=>l.includes(value));")&&src.includes("return o&&estLogoDossier(o.logo)&&!l.includes(o.logo)?[o.logo,...l]:l}")
  &&src.includes("function logosItem(o){const c=o&&o.category,d=[...iconesPlanches('equipement'),...iconesPlanches('divers'),...iconesPlanches(''),...iconesPlanches('talents'),...iconesPlanches('ombrelame'),...LOGOS_DOSSIERS.equipement];")
  &&src.includes(".filter(f=>f&&f.type==='blob'&&String(f.path).startsWith('img/'));")&&src.includes("const liste=arbre.map(f=>String(f.path).slice(4))"),'chaque menu prend son dossier, et garde le logo en place');}
/* v0.312 — L'aperçu du logo dans le formulaire de l'Armurerie ajoutait « .png » au nom : une
   icône de img/equipement, qui porte déjà son extension, devenait « x.png.png », introuvable.
   Aucune adresse d'image de logo ne se bâtit plus en ajoutant « .png » à la main. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("const montre=()=>{const l=menuLogo.value;apercu.hidden=!l;if(l)poseLogo(apercu,l)};")&&!/imgUrl\(l\+'\.png'\)/.test(src),'l’aperçu de l’Armurerie garde l’extension');}
/* v0.313, puis v0.361 — L'arbre fait foi : une ligne ne mène qu'à un talent de sa colonne, chaque
   talent a sa case, le bonus d'une ligne disparue quitte l'arbre. Plus de « Requiert » dans les bulles ; un nœud de bonus ne redit pas son nom ;
   les ronds de l'arbre prennent le fond de leur nature ; les talents du catalogue sont ronds. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),C=require('./combat.js');
 const morceau=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
 const ctxA={GENERIQUES:'Génériques',VOIES_MAX:3,LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],estBonus:t=>!!t&&t.effet==='bonus',talentFamily:t=>(t&&t.famille||'').trim()||'Génériques',cleClasse:C.cleClasse,talentCode:C.talentCode,talentsDependants:C.talentsDependants,
  catalog:{classes:[{name:'Gardien'}],voies:{Gardien:['Rempart','Assaut','']},talents:[
   {id:'m',name:'Gardien',famille:'Gardien',type:'mait',pos:{x:0,y:0}},{id:'r',name:'Rempart',famille:'Gardien',type:'pass',voie:'Rempart',pos:{x:0,y:0},liens:['s','p']},
   {id:'s',name:'Sous Rempart',famille:'Gardien',type:'act',voie:'Rempart',pos:{x:0,y:0}},{id:'p',name:'Provocation',famille:'Gardien',type:'act',voie:'Assaut'},
   {id:'x',name:'Ailleurs',famille:'Mage',type:'act'},{id:'k',name:'+1',famille:'Gardien',type:'pass',effet:'bonus',chemin:{de:'r',dir:'s',rang:1}}]}};
 vm.createContext(ctxA);vm.runInContext(morceau('/* Une classe a toujours toutes ses colonnes','const arbresDialog='),ctxA);
 const T=id=>ctxA.catalog.talents.find(t=>t.id===id);
 assert.equal(ctxA.accordeArbres(),true);
 assert.equal(JSON.stringify(T('r').liens),'["s"]','une ligne vers une autre colonne s’efface');
 assert.deepEqual(['m','r','s','p'].map(id=>JSON.stringify(T(id).pos)),['{"x":0,"y":0}','{"x":0,"y":0}','{"x":0,"y":1}','{"x":0,"y":0}'],'une case chacun : le second venu descend, le sans-case en reçoit une');
 assert.ok(T('k').horsArbre&&!T('k').chemin,'un petit rond sur le chemin d’une ligne quitte l’arbre');assert.equal(T('x').pos,undefined,'hors des classes, rien ne bouge');
 assert.equal(ctxA.accordeArbres(),false,'une seconde fois : plus rien à accorder');
 /* v0.493 — L'IA des adversaires est mise de côté dans ia.js, qu'aucune page ne charge : rien du site n'en
   parle. Reste la correction d'une attaque animée qui coûtait deux Actions, et « Tour suivant » en fonction. */
 {const ia=fs.readFileSync('ia.js','utf8');assert.doesNotThrow(()=>new Function(ia),'ia.js compile');assert.ok(ia.includes('function tourDesAdversaires(')&&ia.includes('function choixCibleIA('),'l’IA est gardée dans ia.js');
  [page,src,fs.readFileSync('combat.js','utf8'),fs.readFileSync('live.js','utf8'),fs.readFileSync('maps.js','utf8')].forEach(t=>['ia-adversaires','iaAdversaires','iaDoitJouer','reactionsIA','frappePar','planifieTourIA','iaDe(','normaliseIa','IA_CIBLAGES','ia_cible'].forEach(k=>assert.ok(!t.includes(k),'plus de trace de l’IA : '+k)));
  assert.ok(!page.includes('ia.js'),'ia.js n’est pas chargé');
  assert.ok(page.includes("$('next').onclick=()=>{if(view!=='mj')return;tourSuivant()};")&&src.includes("{cle:'menace',nom:'Menace',type:'choix',opts:MENACES,"),'attaque à une seule Action, tour suivant, colonne Menace');}
 /* v0.491 — Mitraille : un passif ; chaque orbe lancé en fait partir un autre, gratuit, sur l'autre adversaire le
   plus proche ; améliorations : un adversaire de plus, un orbe de plus. */
 {const T=C.TALENTS_CODES;assert.equal(T.mitraille.type,'pass');assert.equal(T.mitraillecibles.pour,'mitraille');assert.equal(T.mitrailleorbes.nom,'Mitraille — un orbe de plus');
  assert.equal(C.texteBrut(C.phraseTalent('mitraille',{})),'Quand le porteur lance un orbe, il lance automatiquement un orbe sur l’autre adversaire le plus proche.');
  assert.ok(C.texteBrut(C.phraseTalent('mitraille',{cibles:2,orbes:2})).includes('2 orbes sur les 2 autres adversaires les plus proches'));}
 assert.ok(page.includes("orbe(a,p,talent,{cible:k,n:m.orbes,mitraille:true,logo:opts.logo})")&&page.includes("function mitrailleDe(a){"),'Mitraille branchée sur le lancer d’orbe');
 /* v0.490 — Les niveaux de l'arbre : posés sur une ligne entre talents, ils ferment le talent d'après tant que
   l'aventurier n'a pas ce niveau. */
 {const ctxN={DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},lisChemin:()=>null,posDe:t=>t&&t.pos||null};vm.createContext(ctxN);
  vm.runInContext(src.slice(src.indexOf('const liensDe='),src.indexOf('function cheminsDe('))+src.slice(src.indexOf('function entreesDe('),src.indexOf('/* Ce qu\'on tient encore d\'une liste'))+';this.verrouArbre=verrouArbre;this.poseNiveauLien=poseNiveauLien;this.niveauLien=niveauLien;',ctxN);
  const A={id:'A',name:'A',pos:{x:0,y:0},liens:['B']},B={id:'B',name:'B',pos:{x:0,y:1}},L=[A,B];
  assert.equal(ctxN.verrouArbre(['A'],L,B,1),'','sans niveau, la ligne mène');
  ctxN.poseNiveauLien(B,A,3);assert.equal(JSON.stringify(A.niveaux),'{"B":3}','le niveau tient sur le talent d’où part la ligne');assert.equal(ctxN.niveauLien(B,A),3);
  assert.equal(ctxN.verrouArbre(['A'],L,B,2),'Niveau 3','niveau 2 : fermé');assert.equal(ctxN.verrouArbre(['A'],L,B,3),'','niveau 3 : ouvert');
  ctxN.poseNiveauLien(A,B,1);assert.equal(A.niveaux,undefined,'sous 2, le niveau s’ôte');}
 assert.ok(src.includes("(libre?'':verrouArbre(a.talents,col.liste,t,Number(a.level)||1))")&&src.includes("b.className='arbre-niveau'+(n?'':' vide')")&&feuille.includes('.arbre-col>.arbre-niveau{position:absolute;'),'les niveaux de l’arbre');
 /* v0.487 — Munitions équipées toutes ensemble ; bulle d'arme à distance avec sa place de munition et le bonus de
   dégâts du porteur ; l'écu de DEF garde sa forme. */
 assert.ok(src.includes("o.category==='ammo'?(o.id===a.munitionId?(comptes.get(o)||0):0)")&&src.includes("p.append(dicePips(o.dice,o.etat,col==='ranged'&&!o.lancer));")
  &&src.includes("b.className='bonus';b.textContent='+ '+degatsDe(a);")&&feuille.includes('.gear-detail .gear-def .ecu{width:auto;height:22px;'),'munitions en bloc, bulle d’arme complète, écu non déformé');
 /* v0.486 — Les bonus de la barre de talents comme dans l'arbre : sans rond, la valeur en bas à droite, un petit +. */
 assert.ok(feuille.includes('.talent-ameliorations .cat-pill.gear-carre.talent-carre.bonus-rond{border-color:transparent;border-width:0;background:transparent;box-shadow:none}')&&feuille.includes('.talent-ameliorations .cat-pill.bonus-rond>:is(svg,img,.bonus-lettres){width:100%;height:100%}')
  &&feuille.includes(".talent-ameliorations .cat-pill.bonus-rond .bonus-valeur::before{content:'+';"),'bonus de la barre comme dans l’arbre');
 /* v0.485 — Bulles sans texte ajouté : les notes au seul objet ; une munition, son dé, sa quantité et sa valeur ;
   l'écu de DEF à la taille des dés. 99 exemplaires au plus d'une pièce ; chaque tir consomme sa munition. */
 {const ctxI={};vm.createContext(ctxI);vm.runInContext(src.slice(src.indexOf('const INVENTAIRE_MAX='),src.indexOf('function retirerInventaire('))+';this.ajouterInventaire=ajouterInventaire;',ctxI);
  const a={inventaire:Array(98).fill('f')};assert.equal(ctxI.ajouterInventaire(a,{id:'f'}),true);assert.equal(ctxI.ajouterInventaire(a,{id:'f'}),false);assert.equal(a.inventaire.length,99,'99 au plus');}
 assert.ok(src.includes(" if(col==='object')ligne(o.notes);")&&!src.includes("ligne('Munition : '")&&page.includes("if(munitionTiree&&typeof retirerInventaire==='function'){const o=objetDe(munitionTiree);if(o)retirerInventaire(a,o)}")
  &&fs.readFileSync('domaine.js','utf8').includes(" if(inventairePlein(a,o)||uniqueAilleurs(o,a))return;ajouteOr(a,-p.prix);")&&feuille.includes('.gear-detail .gear-def .ecu{width:auto;height:22px;'),'bulles sans texte, munitions comptées, 99 au plus');
 /* v0.484 — « XP visible » au MJ seul ; plus d'XP au survol d'un rond ; le cartouche d'XP de la bulle en rouge
   quand l'aventurier n'a pas de quoi payer. */
 assert.ok(src.includes("arbresXp.hidden=view!=='mj'||(arbresEnMasse&&!a);poseXpVisible();")&&src.includes("arbresDialog.classList.toggle('xp-visible',xpVisible&&view==='mj');")
  &&!feuille.includes('.arbre-plan>.arbre-noeud:hover>.arbre-cout')&&feuille.includes('.talent-bulle-nom .cout-xp.trop-cher{'),'XP de l’arbre : MJ seul, sans survol, rouge si trop cher');
 /* v0.483 — Bulle d'une pièce : dés ou DEF au-dessus de l'or, puis la description du MJ, rien d'automatique.
   La Vie et les PV sous leur maximum, légèrement rouges. */
 assert.ok(src.includes("p.className='gear-des';p.append(dicePips(o.dice,o.etat,col==='ranged'&&!o.lancer));")&&src.includes(" if(col==='object')ligne(o.notes);")&&!src.includes("ligne(o.effects||o.notes||'Effet à préciser dans l’armurerie.')")
  &&page.includes("const vieEntamee=a=>(Number(a&&a.vie)||0)<(Number(a&&(a.vieMax??a.vie))||0);")&&page.includes("tuiles[0].classList.toggle('sous-max',(Number(a.hp)||0)<(Number(a.max)||0));")
  &&feuille.includes('.stat-row.en-icones .stat-tile.avec-icone.sous-max strong{color:#ffa69a}'),'bulle d’objet sans texte automatique, Vie et PV entamés en rouge');
 /* v0.481 — Une partie enregistrée qui ne se pose pas n'est jamais écrasée : l'écriture reste bloquée. */
 assert.ok(src.includes("catch(e){sessionLue=false;noterSauvegarde('Partie enregistrée illisible : '+e.message+' Rien n’est écrit par-dessus.',true)}};")
  &&src.includes("if(db&&!sessionLue){noterSauvegarde('La partie enregistrée n’est pas encore lue : rien n’est écrit par-dessus.',true);return}"),'partie illisible : rien par-dessus');
 /* v0.479 — « Inventaire + » au-dessus du bloc, l'inventaire à hauteur du corps, six icônes par ligne ; l'icône
   portée plus bas, ses dés devant ; anneaux et amulette sans symbole d'effet. */
 assert.ok(feuille.includes('.corps-sac{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);')&&feuille.includes('.corps-sac>.sac .sac-ligne{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));')
  &&feuille.includes('.corps-sac>.corps .cat-pill.gear-carre>:is(.marque-porte,.gear-bas,.pips){display:none}')&&!src.includes("titre.className='gear-rangee-titre sac-titre'"),'inventaire en haut, six par ligne');
 /* v0.478 — {bleu}, {Mystique}… dans une description : l'icône du dé, sans rendre le talent élémentaire. */
 {const ctxD={};vm.createContext(ctxD);vm.runInContext(src.slice(src.indexOf('const DES_ACCOLADES='),src.indexOf('function deDansTexte('))+';this.deAccolade=deAccolade;',ctxD);
  assert.deepEqual(['bleu','Bleu','BLEU','mystique','Léger','os','noir','Phase','constructor','element'].map(ctxD.deAccolade),[3,3,3,3,1,1,5,6,-1,-1],'couleurs et noms de dés, casse et accents ignorés');
  assert.equal(C.aDesAccolades('Lance {bleu} et {rouge}'),false,'un dé n’est pas une accolade d’élément');
  assert.ok(src.includes("lignes.push(desEnImages(e(nomEnClair(t.effects))));")&&feuille.includes('.die-sq.de-texte{display:inline-block;'),'le dé dans le texte, à l’écran et au PDF');}
 /* v0.477 — Sur la fiche, l'équipement aux deux tiers, l'inventaire au tiers de droite, à sa taille. */
 assert.ok(feuille.includes('.corps-sac>.sac{grid-column:2;grid-row:1;')
  &&feuille.includes('.sac .cat-pill.gear-carre,.sac .cat-pill.gear-carre:not(.talent-carre):not(.best-carre){width:36px;min-width:36px;height:36px;'),'équipement et inventaire côte à côte');
 /* v0.476 — Le trait d'un bonus, plus fin, va sous son icône ; un petit « + » devant sa valeur, sans la déplacer. */
 assert.ok(src.includes("g.setAttribute('class','chemin'+(lien?'':' petit')+(estBonusEl(A)||estBonusEl(B)?' bonus':'')+(pris(de,vers)?' pris':'')+(caches.has(vers.id)?(voitTout?' cache-mj':' cache-joueur'):''));")
  &&src.includes("r:i&&i.width?Math.min(i.width,i.height)*.22:r.width/2-2}};")&&feuille.includes('.arbre-chemins .chemin.bonus .trait{stroke-width:1.5}')&&feuille.includes('.arbre-plan>.arbre-noeud.petit.bonus::before{display:none}')
  &&feuille.includes(".arbre-plan>.arbre-noeud.petit.bonus .arbre-rond b.bonus-valeur::before{content:'+';position:absolute;right:100%;"),'trait fin sous l’icône, petit + devant la valeur');
 /* v0.475 — Un bonus de l'arbre : l'icône et la valeur seules ; la valeur plus petite, dans le coin bas droit. */
 assert.ok(feuille.includes('.arbre-plan>.arbre-noeud.petit.bonus .arbre-rond,.arbre-plan>.arbre-noeud.petit.bonus:is(.acquis,.dispo,.verrou,.modele) .arbre-rond{border-color:transparent;background:transparent;box-shadow:none}')
  &&feuille.includes('.arbre-plan>.arbre-noeud.petit.bonus .arbre-rond b.bonus-valeur{left:71%;top:71%;font-size:15px;-webkit-text-stroke-width:3px}')
  &&feuille.includes('.arbre-rond .bonus-valeur,.arbre-noeud.petit.bonus .arbre-rond b.bonus-valeur{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#fff;font:900 18px/1 system-ui;'),'bonus de l’arbre sans rond, valeur dans le coin');
 /* v0.474 — Chez un aventurier, un talent inaccessible ou trop cher est plus transparent qu'un talent à prendre. */
 assert.ok(feuille.includes('.arbre-plan>.arbre-noeud.verrou .arbre-rond,.arbre-plan>.arbre-noeud.petit.bonus.verrou .arbre-rond{filter:grayscale(1);opacity:.3}')
  &&feuille.includes('.arbre-plan>.arbre-noeud:is(.dispo,.verrou) .arbre-rond,.arbre-plan>.arbre-noeud.petit.bonus:is(.dispo,.verrou) .arbre-rond{border-style:dashed;opacity:.55;filter:none}'),'inaccessible : plus transparent');
 /* v0.473 — Le talent de départ reçoit des petits ronds en haut à gauche et à droite ; droit au-dessus, le trait du bandeau. */
 assert.ok(src.includes("if(d==='n'&&racines.has(t.id)&&!ch[d].petits.length)return;")&&!src.includes("if(dy<0&&racines.has(t.id)&&!ch[d].petits.length)return;"),'le départ a ses places du haut, sauf droit au-dessus');
 /* v0.471 — Une amélioration déplacée à la main sur un autre chemin emmène celles qui la suivaient ; sur
    son propre chemin, elle change de rang sans en perdre. */
 {const L=ctxA.catalog.talents;L.push({id:'a1',name:'A1',famille:'Gardien',voie:'Rempart',type:'ame',chemin:{de:'r',dir:'e',rang:1}},{id:'a2',name:'A2',famille:'Gardien',voie:'Rempart',type:'ame',chemin:{de:'r',dir:'e',rang:2}},
   {id:'a3',name:'A3',famille:'Gardien',voie:'Rempart',type:'ame',chemin:{de:'r',dir:'e',rang:3}},{id:'b1',name:'B1',famille:'Gardien',voie:'Rempart',type:'ame',chemin:{de:'s',dir:'o',rang:1}});
  const ch=id=>{const c=T(id).chemin;return c?c.de+'.'+c.dir+'.'+c.rang:'hors'};
  assert.equal(ctxA.placerTalent('a2',{famille:'Gardien',voie:'Rempart',chemin:{de:'s',dir:'o',rang:1}}),true);
  assert.deepEqual(['a1','a2','a3','b1'].map(ch),['r.e.1','s.o.1','s.o.2','s.o.3'],'la suivante suit, celle qui était là recule d’autant');
  assert.ok(!T('a3').horsArbre,'la suivante reste dans l’arbre');
  assert.equal(ctxA.placerTalent('a2',{famille:'Gardien',voie:'Rempart',chemin:{de:'s',dir:'o',rang:2}}),true);
  assert.deepEqual(['a2','a3','b1'].map(ch),['s.o.2','s.o.1','s.o.3'],'sur son chemin, elle change de rang sans rien perdre');
  L.splice(L.length-4,4)}
 assert.ok(!src.includes("ligne('↳ Requiert : '+socle)")&&src.includes("function arbreChange(){accordeArbres();")
  &&!src.includes("niv.textContent=t.name&&t.name!==libelleBonus(p,true)"),'plus de Requiert, plus de doublon sous un bonus');
 assert.ok(css.includes('.arbre-noeud.t-act:not(.bonus) .arbre-rond{background:#cfdcea}')&&css.includes('.arbre-noeud.t-ame:not(.bonus) .arbre-rond{background:#d3e5cd}'),'le rond a le fond de sa nature');}
/* v0.330 — Le guide des prix, le prix suggéré ; les ressources sans effet ni rareté choisie ; le
   magasin d'un clic ; les grandes images publiées à part. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),fief=fs.readFileSync('domaine.js','utf8'),part=fs.readFileSync('shared.js','utf8'),C=require('./combat.js');
 const ctxG={OBJETS_CODES:{soin:{cle:'soin',nom:'Soin'},etat:{cle:'etat',nom:'État'}},keys:['white','bone','red','blue','green','black','yellow'],types:['Simple','Léger','Lourd','Mystique','Soin','Mortel','Phase','Faille'],
  itemColumn:o=>o.category==='weapon'?(o.ranged?'ranged':'melee'):o.category,weaponHands:o=>o.ranged?2:(o.hands===2?2:1),objetCode:o=>o&&({soin:{cle:'soin',nom:'Soin'}})[o.effet]||null,
  normaliseBonusEquip:l=>l||[],CARACS_EQUIP:[['pv','PV max'],['def','DEF']],rareteDe:o=>o.category==='ressource'?'ressource':o.rarete||'commun',NOM_RARETE:r=>({rare:'Rare',ressource:'Ressource'})[r]||'Commun',
  ressourcesJeu:()=>[{cle:'fer',nom:'Fer',piece:{price:8}},{cle:'cuir',nom:'Cuir',piece:{price:4}}]};vm.createContext(ctxG);
 vm.runInContext(src.slice(src.indexOf('const CATS_PRIX='),src.indexOf('// À côté d\'un prix : la suggestion'))+';this.normaliseGuidePrix=normaliseGuidePrix;this.prixSuggere=prixSuggere;this.detailPrix=detailPrix;',ctxG);
 const g=ctxG.normaliseGuidePrix({des:{red:'12',white:-3,blue:'x'},def:25.4,rarete:{rare:200,epique:5000},effets:{soin:40}});
 assert.equal(JSON.stringify([g.des.red,g.des.white,g.des.blue,g.def,g.rarete.rare,g.rarete.epique,g.effets.soin,g.effets.etat,g.rarete.ressource]),JSON.stringify([12,0,20,25,200,1000,40,25,100]),'le guide se relit : bornes, défauts, un prix par effet');
 const epee={category:'weapon',hands:2,dice:{white:2,red:1},etat:'Feu',ressource1:'fer',ressource2:'cuir',rarete:'rare',effet:'soin',bonus:[{carac:'pv',valeur:2}]};
 const sp=ctxG.prixSuggere(epee,g);
 // base 5 + 2 blancs 0 + 1 rouge 12 + deux mains 5 + Feu 15 + Soin 40 + 2 PV 20 + Fer 8 + Cuir 4 = 109, × 2 (rare) = 218
 assert.equal(sp.total,218,'la somme, multipliée par la rareté');assert.ok(ctxG.detailPrix(sp).includes('1 dé Lourd : 12')&&ctxG.detailPrix(sp).includes('Rare : × 2')&&ctxG.detailPrix(sp).endsWith('= 218 or'));
 assert.equal(ctxG.prixSuggere({category:'armor',def:3,rarete:'commun'},g).total,10+75,'une armure : sa base et sa DEF');
 assert.equal(ctxG.prixSuggere({category:'ressource',ressource1:'fer'},g).total,0,'une ressource ne compte pas d’autres ressources');
 assert.ok(src.includes(" c.guidePrix=normaliseGuidePrix(c.guidePrix);")&&src.includes("function renderGuidePrix(){")&&src.includes("function renderArmory(){renderBiblioObjets();renderGuidePrix();")
  &&src.includes("if(c.cle==='price'){const b=boutonSuggestion(),maj=()=>majSuggestion(b,o,c.lit(o));maj();majLigne.push(maj);")&&src.includes("sug.onclick=()=>pourTous(c,o=>c.ecrit(o,prixSuggere(o).total),'Prix suggérés par le guide')")
  &&src.includes("const ligne=document.createElement('span');ligne.className='prix-ligne';f.price.before(ligne);ligne.append(f.price,b);")&&css.includes('.prix-suggere{'),'le prix suggéré, en masse et au formulaire');
 // Les ressources : leur rareté à elles, ni effet, ni usage, ni bonus.
 assert.equal(C.rareteDe({category:'ressource',rarete:'epique'}),'ressource');assert.equal(C.rareteDe({category:'object',rarete:'ressource'}),'commun');assert.equal(C.NOM_RARETE('ressource'),'Ressource');
 assert.ok(src.includes("if(o.category==='ressource'||o.category==='restes'||o.category==='cle'){o.effet='';o.params={};o.bonus=[];o.usage='libre';delete o.mode}")&&src.includes("  +(a.category==='ressource'||a.category==='restes'||a.category==='cle'?'':''\n  +'<h2 class=\"sous-titre\">Effet appliqué par le moteur</h2>'")
  &&src.includes("{cle:'rarete',nom:'Rareté',type:'choix',opts:RARETES,pour:faite,")&&css.includes('.cat-pill.r-ressource{background:#efe2cc;'),'une ressource : ni effet, ni usage, ni bonus ; sa rareté brun clair');
 // Le magasin : l'objet se clique, plus de bouton.
 assert.ok(fief.includes("const agit=e=>{e.preventDefault();if(actif)faire()};p.onclick=agit;")&&fief.includes(" carte.append(p,nom);if(sous)carte.append(sous);return carte}")&&!fief.includes("btn.className='dom-achat'"),'acheter ou vendre d’un clic sur l’objet');
 // Les grandes images : envoyées à part, relues et vérifiées.
 assert.ok(part.includes("const envoi=await envoieImages(value);const packed=SharedData.pack(envoi.value);")&&part.includes("const data=await rechargeImages(SharedData.validate(SharedData.unpack(chunks,m.bytes)),gen);")
  &&part.includes("if(!SharedData.estImage(url)||await empreinte(url)!==h)throw Error('Image publiée invalide.');")&&part.includes("indexedDB.open('amertume-images',1)"),'les grandes images voyagent à part');}
/* v0.331 — Modifier en masse : un clic sur un en-tête trie, un second inverse ; le tri standard
   revient à l'ordre de l'Armurerie. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("let armoryMasse=false,armoryNeuf=null,masseTri=null;")&&src.includes("std.onclick=()=>{masseTri=null;gardeTris();renderArmory()};")
  &&src.includes("b.onclick=()=>{masseTri=actif?{cle,sens:-masseTri.sens}:{cle,sens:1};gardeTris();renderArmory()};")&&src.includes("tete.append(enTete('piece','Pièce'),...COLS.map(c=>enTete(c.cle,c.nom)));")
  &&src.includes("sort((A,B)=>(A[1]===null)-(B[1]===null)||(A[1]===null?0:cmp(A[1],B[1])*masseTri.sens)||A[2]-B[2])"),'le tableau se trie par colonne, et revient au tri standard');}
/* v0.332 — La valeur d'une ressource ne se règle qu'au guide des prix : le mode en masse n'y
   touche plus, ni ligne par ligne, ni pour toutes ; une opération pour toutes s'annule. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("{cle:'price',nom:'Prix (or)',type:'nombre',max:999999,pour:faite,lit:o=>o.price||0,")&&src.includes("const pourTous=(c,fn,dit)=>{const cibles=liste.map(([o])=>o).filter(o=>vaut(c,o));")
  &&src.includes("masseAnnule={dit,avant:cibles.map(o=>structuredClone(o))};cibles.forEach(fn);")&&src.includes("u.textContent='↶ Annuler : '+masseAnnule.dit;")
  &&src.includes("CATS_PRIX.filter(([k])=>k!=='ressource'&&k!=='restes').forEach(")&&src.includes(" if($('item-form').elements.price){const f=$('item-form').elements,b=boutonSuggestion(),maj="),'le prix d’une ressource ne se règle qu’au guide ; l’opération pour toutes s’annule');}
/* v0.333 — Les menus des ressources montrent l'icône de chacune, devant son nom : le select reste,
   caché, et garde la valeur ; un bouton et une liste à icônes le pilotent. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function menuIcones(sel,icone){")&&src.includes("sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))")
  &&src.includes("if(c.cle==='ressource1'||c.cle==='ressource2')menuIcones(el,iconeRessource)")&&src.includes("['ressource1','ressource2'].forEach(k=>{const s=$('item-form').elements[k];if(s)menuIcones(s,iconeRessource)});")
  &&css.includes('.menu-icones-natif{display:none!important}')&&css.includes('.menu-icones-liste{position:fixed;'),'les ressources, icône comprise, dans leurs menus');}
/* v0.334 — La tannerie : les Restes, la coche Tanneur et sa recette, la fonction de bâtiment, et
   les dépôts des joueurs versés à la réserve une seule fois par le MJ. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),fief=fs.readFileSync('domaine.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const J=x=>JSON.stringify(x);
 assert.equal(J(C.rendementReste({category:'restes',ressource1:'cuir',rendement1:3,ressource2:'tissu',rendement2:0})),J({cuir:3,tissu:1}),'un reste donne ses ressources à son rendement');
 assert.equal(J(C.rendementReste({category:'object',ressource1:'cuir'})),J({}));
 assert.equal(J(C.normaliseRecette([{cle:'cuir',qte:2},{cle:'cuir',qte:1},{cle:'Mauvais',qte:1},{cle:'mithril',qte:1},{cle:'fer',qte:500}],new Set(['cuir','fer']))),J([{cle:'cuir',qte:3},{cle:'fer',qte:99}]),'une recette : ressources connues, une ligne chacune, bornée');
 assert.equal(J(C.appliqueDelta({cuir:2},{cuir:-5,fer:3,or:9})),J({fer:3}),'la réserve ne descend jamais sous zéro, et n’a pas d’or');
 assert.equal(J(C.manqueRecette({cuir:1},{recette:[{cle:'cuir',qte:3},{cle:'fer',qte:1}]})),J([['cuir',2],['fer',1]]));
 assert.equal(J(C.recetteDelta({recette:[{cle:'cuir',qte:2}]})),J({cuir:-2}));
 assert.equal(C.normaliseDepots([{id:'a',delta:{cuir:3,or:5}},{id:'mauvais id!',delta:{cuir:1}},{id:'b',delta:{}},{id:'c',delta:{fer:-2}}]).map(e=>e.id+J(e.delta)).join(' '),'a{"cuir":3} c{"fer":-2}','un dépôt identifié, sans or, jamais vide');
 const d=C.normaliseDomaine({batiments:[{nom:'Tannerie',fonction:''},{nom:'Magasin',fonction:''}]});
 assert.equal(d.batiments.map(b=>b.fonction).join(','),'tannerie,','la Tannerie devient la tannerie, une fois');
 d.batiments[0].fonction='';assert.equal(C.normaliseDomaine(d).batiments[0].fonction,'','ensuite, le MJ choisit');
 assert.equal(J(C.normaliseDomaine({depotsVus:['a','mauvais id!','b']}).depotsVus),J(['a','b']));
 assert.ok(src.includes("function itemColumn(a){return a.category==='cle'?'cle':a.category==='restes'?'restes':")&&src.includes("['ressource','Ressources'],['restes','Restes'],['treasure','Trésors']];")
  &&src.includes("o.tanneur=o.tanneur===true&&o.category!=='ressource'&&o.category!=='restes';o.recette=normaliseRecette(o.recette,clesR);")
  &&src.includes("?sel('Donne','ressource1',ressourceValide(a.ressource1),")&&src.includes("function dessineRecette(){")&&src.includes("if($('recette-lignes'))a.recette=lireRecette();")
  &&src.includes("{cle:'tanneur',nom:'Tanneur',type:'case',")&&src.includes("groupe('Restes',filtre(o=>o.category==='restes'),porte,gearPill,clic);"),'les Restes et la recette du tanneur, à l’Armurerie');
 assert.ok(fief.includes("if(b.fonction==='tannerie')blocTannerie(out,b);")&&fief.includes("function versDomaine(a,delta){if(mjDom()){appliqueDelta(")
  &&fief.includes("function recueilleDepots(redessine=true){if(!mjDom())return false;")&&fief.includes("const mj=mjDom(),r=mj?(domaine.ressources||(domaine.ressources={})):reserveVue();")
  &&vivant.includes("function appliquerSalle(d,complet){appliquerSalleSeule(d,complet);if(d&&estMJ()&&typeof recueilleDepots==='function')recueilleDepots()}"),'la tannerie, et les dépôts versés par le MJ');}
/* v0.335 — Un lot de table : repos courts au niveau, repos long, 0 VIE hors de la carte, états
   effacés sauf le Blindage, Lamevent au contact rejoint, Provocation socle à socle, Orbes sans
   dégâts, vaincus retirés, cinq cibles, et la liste des cartes au nom seul. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const ctxR={statesOf:a=>a.states||[],setState:(a,e,p)=>{a.states=(a.states||[]).filter(x=>x!==e);if(p)a.states.push(e)}};vm.createContext(ctxR);
 vm.runInContext(page.match(/function leveEtats\(a,finCombat,garder\)\{[^\n]*\n[^\n]*/)[0]+'\n'+page.match(/function reposMax\(a\)[^\n]*/)[0]+'\n'+page.match(/function reposRestants\(a\)[^\n]*/)[0],ctxR);
 const h={states:['Feu','Blindage','Poison','Coma','Invisible'],etatsPassifs:['Invisible']};
 assert.equal(ctxR.leveEtats(h).join(','),'Feu,Poison','tout s’en va, sauf le Blindage, le coma et ce qu’une pièce portée donne');assert.equal(h.states.join(','),'Blindage,Coma,Invisible');
 assert.equal(ctxR.reposMax({level:3}),3,'un repos court par niveau');assert.equal(ctxR.reposMax({}),1);assert.equal(ctxR.reposRestants({level:3,reposCourts:0}),3);assert.equal(ctxR.reposRestants({level:3,reposCourts:1}),2);
 assert.ok(page.includes("if(a.vie<=0){poseCibles(a,[]);log(nomNum(a)+' n’a plus de VIE : il est mort.',{ton:'degats'})}")
  &&src.includes("function reposLong(){if(view!=='mj')return;")&&src.includes("$('hero-repos-long').onclick=reposLong;")&&carto.includes("heros.forEach(a=>{a.horsCarte=false;delete a.retire;a.reposCourts=0;"),'0 VIE : hors de la carte jusqu’au repos long ; repos courts rendus à la carte rechargée');
 assert.ok(page.includes("function noteContactsDepart(a){if(!a||!enCombat())return;")&&page.includes("const contacts=adversairesAuContact(a).filter(([b])=>!avant||!avant.has(b.id));")
  &&page.includes("const arret=tokenOf(a)/2+tokenOf(b)/2+1;")&&page.includes("function cheminVersContact(b,a,size){")
  &&page.includes("if(!r.hit||!r.damage){floatNumber(b,'0','nul');let pose0='',suite0='';"),'Lamevent, Provocation et Orbes');
 assert.ok(page.includes("function retirerVaincus(){if(view!=='mj')return;")&&page.includes("function reposCourtTous(){if(view!=='mj')return;")&&page.includes("#pv-layer .pv.dead{opacity:.45;filter:grayscale(1)}")
  &&page.includes("function mouvementEpuise(a){return enCombat()&&!!a&&pointsRestants(a,'mouvement')<=0}"),'boutons de camp, cinq cibles, jauges pâles, Analyser au Mouvement');
 assert.ok(carto.includes("if(deux||mapTool==='objet'){mapSel=dessous;renderCanvas();openObjet(dessous.i);e.preventDefault();return}}")&&!carto.includes("det.textContent=matiereDe(m).length")
  &&feuille.includes('.map-row.live{background:#dcebd9;'),'un objet posé se rouvre ; la liste des cartes au nom seul');}
/* v0.336 — Les planches Restes 1 et Restes 2 ; pour l'icône d'un reste, elles passent en tête du
   menu et de la grille, chacune sous son nom. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(fs.existsSync('img/planches/restes_1.webp')&&fs.existsSync('img/planches/restes_2.webp'),'les deux planches de restes sont au dépôt');
 assert.ok(src.includes("const PLANCHES_EN_TETE={restes:[/restes/i],ressource:[/restes/i],weapon:[/armes/i],ammo:[/armes/i],armor:[/armures/i,/armes[ _-]*0*6\\b/i]};")&&src.includes(" planchesEnTete(o).forEach(f=>{")
  &&src.includes("+selGrille(planchesEnTete(a).length?selGroupes('Logo','logo',a.logo||'',groupesLogosItem(a)):")&&src.includes("groupesLogosItem(o).filter(([,l])=>l.length).map("),'les planches de restes en tête pour un reste');}
/* v0.337 — Un « + » à l'en-tête de chaque colonne de l'Armurerie ouvre l'éditeur sur une pièce
   neuve de cette catégorie. La famille de talents « Génériques » disparaît : un talent resté sans
   classe se range sous « Sans classe », qui ne paraît que s'il en reste un. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("function openItem(i=null,apres=null,defauts=null){")&&src.includes("plus.onclick=e=>{e.stopPropagation();openItem(null,null,PIECE_NEUVE[key])};h.append(plus)}")
  &&src.includes("const PIECE_NEUVE={melee:{category:'weapon',ranged:false,hands:1,"),'le + de chaque colonne de l’Armurerie');
 assert.ok(src.includes("return [...classes,...autres,...(orphelins?[GENERIQUES]:[])]}")&&src.includes("const nomFamille=f=>f===GENERIQUES?'Sans classe':f;")
  &&src.includes("  const tete=classe?[classe]:[];")&&src.includes(" const tete=!draft.hero?[ADVERSAIRES]:sienne&&toutes.includes(sienne)?[sienne]:[];")&&!src.includes("famille:GENERIQUES,type:'act'"),'plus de famille Génériques');}
/* v0.338 — L'onglet Talents range chaque classe en rangées, une par type : Maîtrise, Actions,
   Réactions, Passifs, Améliorations. Un bouton « Noms », commun à l'Armurerie, aux Talents, au
   Bestiaire et aux Aventuriers, montre ou cache les noms sous les cartes ; son choix vaut partout. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("ORDRE_TYPES_TALENTS.forEach(k=>{const lot=ordre.filter(([t])=>talentType(t)[0]===k);if(!lot.length)return;")
  &&css.includes('.talent-rangee{flex-basis:100%;display:flex;flex-wrap:wrap;')&&css.includes('.talent-rangee .cat-carte{width:auto;min-width:0}'),'une rangée par type de talent');
 assert.ok(src.includes("let nomsCaches=false;try{nomsCaches=localStorage.getItem('amertume-noms')==='0'}catch(e){}")&&src.includes("[armoryPage,talentsPage,bestiaryPage,heroesPage].forEach(p=>{const a=p.querySelector('.cat-actions');if(a)a.prepend(boutonNoms())});")
  &&css.includes('body.sans-noms :is(#armory-page,#talents-page,#bestiary-page,#heroes-page) .nom-carte{display:none}'),'un bouton Noms commun aux quatre pages');}
/* v0.339 — Les planches Armures 1 à 5, en tête pour l'icône d'une armure ; les Restes en tête aussi
   pour une ressource. Un reste vaut 25 % de ce que ses composants rapportent, arrondi en dessous. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok([1,2,3,4,5].every(i=>fs.existsSync('img/planches/armures_'+i+'.webp')),'les cinq planches Armures sont au dépôt');
 const ctxP={OBJETS_CODES:{},keys:['white'],types:['Simple'],itemColumn:o=>o.category,weaponHands:()=>1,objetCode:()=>null,normaliseBonusEquip:l=>l||[],CARACS_EQUIP:[],
  rareteDe:o=>o.rarete||'commun',NOM_RARETE:r=>r,lisQte:v=>Math.max(1,Math.min(99,Math.trunc(Number(v))||1)),
  ressourcesJeu:()=>[{cle:'cuir',nom:'Cuir',piece:{price:4}},{cle:'corde',nom:'Corde',piece:{price:2}}]};vm.createContext(ctxP);
 vm.runInContext(src.slice(src.indexOf('const CATS_PRIX='),src.indexOf('// À côté d\'un prix : la suggestion'))+';this.prixSuggere=prixSuggere;this.normaliseGuidePrix=normaliseGuidePrix;',ctxP);
 const peau={category:'restes',ressource1:'cuir',rendement1:3,ressource2:'corde',rendement2:1,rarete:'rare'};
 assert.equal(ctxP.prixSuggere(peau,ctxP.normaliseGuidePrix({})).total,3,'3 Cuir à 4 + 1 Corde à 2 = 14 ; 25 %, arrondi en dessous : 3 — ni base, ni rareté');
 assert.equal(ctxP.prixSuggere(peau,ctxP.normaliseGuidePrix({restes:50})).total,7,'la part se règle au guide');
 assert.ok(src.includes("const PLANCHES_EN_TETE={restes:[/restes/i],ressource:[/restes/i],weapon:[/armes/i],ammo:[/armes/i],armor:[/armures/i,/armes[ _-]*0*6\\b/i]};")&&src.includes(" champ(fr,'Un reste vaut',()=>G().restes,v=>{G().restes=v},'%');"),'les planches en tête selon la catégorie ; la part des restes au guide');}
/* v0.340 — Les tris restent d'une session à l'autre ; plus de pointillés entre les rangées de talents. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const TRIS_GARDES=[['armory-sort','armurerie'],['bestiary-sort','bestiaire'],['talent-sort','talents']];")&&src.includes("localStorage.setItem('amertume-tris',JSON.stringify(o))")
  &&!css.includes('.talent-rangee+.talent-rangee{border-top'),'les tris gardés, les rangées sans trait');}
/* v0.342 — Les planches Armes 02 à 06, en tête pour l'icône d'une arme ou d'une munition. Armes 06
   porte aussi des armures : pour une armure, elle suit les planches Armures. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok([2,3,4,5,6].every(i=>fs.existsSync('img/planches/armes_0'+i+'.webp')),'les cinq planches Armes sont au dépôt');
 const fichiers=['planches/armures_2.webp','planches/armes_06.webp','planches/restes_1.webp','planches/armes_02.webp','planches/armurerie_01.webp','planches/armures_1.webp','planches/armes_03.webp'];
 const ctxA={planchesDuCatalogue:()=>fichiers.map(fichier=>({fichier})),nomPlanche:f=>{const n=f.replace(/^planches\//,'').replace(/\.[a-z]+$/i,'').replace(/[_-]+/g,' ');return n[0].toUpperCase()+n.slice(1)}};vm.createContext(ctxA);
 vm.runInContext(src.slice(src.indexOf('const PLANCHES_EN_TETE='),src.indexOf('// Les groupes du menu des logos d\'une pièce'))+';this.planchesEnTete=planchesEnTete;',ctxA);
 const noms=o=>ctxA.planchesEnTete(o).map(f=>ctxA.nomPlanche(f)).join(', ');
 assert.equal(noms({category:'weapon'}),'Armes 02, Armes 03, Armes 06','une arme : les planches Armes, dans l’ordre, sans Armures ni Armurerie');
 assert.equal(noms({category:'ammo'}),'Armes 02, Armes 03, Armes 06','une munition : les planches Armes aussi');
 assert.equal(noms({category:'armor'}),'Armures 1, Armures 2, Armes 06','une armure : les Armures, puis Armes 06, une seule fois');
 assert.equal(noms({category:'restes'}),'Restes 1','un reste : les Restes seulement');
 assert.equal(noms({category:'object'}),'','un objet : aucune planche en tête');}
/* v0.343 — Un adversaire porte tout ce qu'il possède : chaque arme, sa variante ; la meilleure pièce
   de chaque emplacement. Un % de butin par pièce ; retiré de la carte, ce qui tombe va à l'aventurier
   le plus proche. La bulle d'un modèle : petites tuiles, talents en petits ronds. Le Bestiaire en masse. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),C=require('./combat.js');
 const items=[{id:'m',name:'Massue',category:'weapon',hands:2},{id:'g',name:'Griffes',category:'weapon'},{id:'p',name:'Peau',category:'armor',slot:'torse',def:2},
  {id:'c',name:'Cuir',category:'armor',slot:'torse',def:3},{id:'b1',name:'Rondache',category:'armor',slot:'shield',def:1},{id:'b2',name:'Pavois',category:'armor',slot:'shield',def:2},
  {id:'f',name:'Flèches',category:'ammo'},{id:'r',name:'Peau de troll',category:'restes'}];
 const ctxE={EMPLACEMENTS:C.EMPLACEMENTS,emplacementDe:C.emplacementDe};vm.createContext(ctxE);
 vm.runInContext(src.slice(src.indexOf('function equipementAdversaire('),src.indexOf('// Ce qu\'il portait avant ce choix'))+';this.equipementAdversaire=equipementAdversaire;',ctxE);
 const eq=ctxE.equipementAdversaire({inventaire:['m','g','m','p','c','b1','b2','f','r','inconnu']},items);
 assert.equal(JSON.stringify({...eq}),JSON.stringify({weapons:['m','g'],armures:['c'],shieldId:'b2',munitionId:'f'}),'toutes ses armes, le meilleur torse, le meilleur bouclier, sa munition');
 assert.deepEqual(C.attackChoices({hero:false,...eq,attacks:[]},items).map(x=>x.name),['Massue','Griffes'],'deux armes, deux variantes');
 assert.equal(C.defenseOf({hero:false,def:5,...eq},items),5,'DEF : Cuir 3 et Pavois 2, pas les pièces en double');
 const ctxB={actors:[],log:t=>ctxB.journal.push(t),journal:[],document:{dispatchEvent(){}},Event:class{},objetDe:id=>items.find(o=>o.id===id)||null,
  ajouterInventaire:(a,o)=>{a.inventaire??=[];a.inventaire.push(o.id)}};vm.createContext(ctxB);
 vm.runInContext(src.slice(src.indexOf('const lisPourcent='),src.indexOf('/* Les familles où l\'on puise'))+src.slice(src.indexOf('function plurielMot('),src.indexOf('/* Un adversaire retiré de la scène laisse son XP'))+src.slice(src.indexOf('function butinDesRetires('),src.indexOf('/* Rejouer la même rencontre'))
  +';this.normaliseButin=normaliseButin;this.butinDesRetires=butinDesRetires;',ctxB);
 assert.equal(JSON.stringify(ctxB.normaliseButin({m:'150',g:0,p:-4,r:33.4,z:50},['m','g','p','r'])),JSON.stringify({m:100,r:33}),'bornée à 0-100, zéro ne s\'écrit pas, pièce possédée seulement');
 const pres={name:'Brom',hero:true,x:10,y:10,hp:5},loin={name:'Ysa',hero:true,x:60,y:10,hp:5},mort={name:'Kel',hero:true,x:11,y:10,hp:0},dehors={name:'Tam',hero:true,x:10,y:11,hp:5,horsCarte:true};
 ctxB.actors.push(pres,loin,mort,dehors);
 const troll={name:'Troll',hero:false,x:12,y:10,inventaire:['m','r','r','p'],butin:{m:100,r:100,p:0}};
 let n=0;ctxB.butinDesRetires([troll],()=>(n++%2)*0.5);
 assert.deepEqual(pres.inventaire,['m','r','r'],'le plus proche des vivants sur la carte ramasse ce qui tombe');
 assert.ok(!loin.inventaire&&!mort.inventaire&&!dehors.inventaire,'ni le lointain, ni le tombé, ni l’absent');
 assert.equal(ctxB.journal[0],'Brom trouve ⟦m⟧ ⟦r⟧ ×2 (Troll).','une ligne au journal');
 ctxB.journal.length=0;ctxB.butinDesRetires([{name:'Rat',hero:false,x:0,y:0,inventaire:['m'],butin:{m:40}}],()=>0.4);
 assert.equal(ctxB.journal.length,0,'40 % : un tirage à 40 ne tombe pas');
 assert.ok(src.includes("xpDesRetires(partants);butinDesRetires(partants);")&&src.includes("butin:normaliseButin(m.butin),bourse:normaliseBourse(m.bourse),...(m.pnj?{pnj:true,alignement:alignementDe(m),...(m.unique===true?{unique:true}:{})}:{})}}\nfunction fromMonster(m){const a=baseActor(false);Object.assign(a,profilDuModele(m));equipeAdversaire(a);")
  &&src.includes(" if(!a.hero){equipeAdversaire(a);a.butin=normaliseButin(a.butin,a.inventaire)}")
  &&src.includes("const CATS_INV_ADV=[['armes','Armes',")&&src.includes("if(!draft.hero){inventaireAdversaire(boite,draft,refreshEquip);if($('restes-edit'))inventaireAdversaire($('restes-edit'),draft,refreshEquip,'restes');return}"),'inventaire d’adversaire : familles, pioche, butin, tout porté');
 assert.ok(src.includes("r.classList.add('mini');const n=nomEnClair(t.name);r.title=n;")&&css.includes('.bulle-modele .stat-tile strong{font-size:22px;line-height:1.05;margin-top:1px}')
  &&css.includes('.cat-pill.gear-carre.talent-carre.mini{width:28px;height:28px;'),'la bulle : petites tuiles, talents en petits ronds');
 assert.ok(src.includes('<button id="bestiary-masse" type="button" aria-pressed="false"')&&src.includes("function tableMasseBestiaire(boite,liste){")
  &&src.includes("if(masse){barreMasseBestiaire(cols);tableMasseBestiaire(cols,tous);bulleOrpheline()}}")&&src.includes("if(masseTriBest)o.masseBest=masseTriBest;")
  &&css.includes('#bestiary-cols.en-masse{display:block}'),'le Bestiaire en masse');}
/* v0.344 — L'inventaire d'un adversaire en petits carrés, pioche comprise ; le Bestiaire en masse
   modifie aussi ses attaques spéciales, ses talents et son inventaire, dans un panneau ; la bulle
   d'un modèle n'écrit plus type, famille et socle sous son nom. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function inventaireAdversaire(boite,cible,apres,genre){")&&src.includes("const p=gearCarre(o,n,0);p.classList.remove('dispo');p.classList.add('petit');")
  &&src.includes("liste.forEach(o=>{const p=carreInventaire(o,compte(o.id));p.classList.add('inv-pioche');")&&!src.includes("p.classList.add('mini','inv-pioche')")
  &&css.includes('.cat-pill.gear-carre.petit:not(.talent-carre):not(.best-carre){width:auto;min-width:52px;min-height:52px;height:52px;'),'des petits carrés, plus de languettes');
 assert.ok(src.includes("{cle:'attaques',nom:'Attaques',type:'panneau',")&&src.includes("{cle:'talents',nom:'Talents',type:'panneau',")&&src.includes("{cle:'inventaire',nom:'Inventaire',type:'panneau',")
  &&src.includes("if(quoi==='inventaire'||quoi==='restes')inventaireAdversaire(corps,m,()=>{equipeAdversaire(m);m.butin=normaliseButin(m.butin,m.inventaire);fini()},quoi);")
  &&src.includes("const dessine=()=>choixTalents(boite,m,filtre.value,")&&src.includes("form.onchange=()=>{lis();fini()};")
  &&src.includes("function lisAttaques(form,liste){const f=form.elements;")&&src.includes("function htmlAttaques(liste){return liste.map((a,i)=>"),'attaques, talents et inventaire au tableau en masse');
 assert.ok(!src.includes("ligne([TYPE_NOMS[m.type]||'Standard'"),'la bulle sans type, famille ni socle');}
/* v0.345 — Dans la bulle d'un modèle, PV, dégâts et XP en plus gros sans grandir les tuiles ; son
   inventaire en petits carrés sous ses talents. Au tableau en masse, le jeton montre la bulle au
   survol et change d'image au clic. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("if(!comptes.size)return;const rang=document.createElement('div');rang.className='bulle-inventaire';")&&src.includes("c.append(logoEquipement(o)||glyphePiece(itemColumn(o)));")
  &&src.includes(" if(logo)p.append(logo);else p.append(glyphePiece(col));")
  &&src.includes("surveille(jeton,()=>ouvrirBulle(jeton,bulleModele(m),'bulle-modele'));")&&src.includes("openImage(x,'token',url=>{m.image=url;pose();sauveBestiaire([m])})")&&css.includes('.inv-mini{position:relative;flex:none;width:26px;height:26px;'),'l’inventaire dans la bulle ; au tableau en masse, la bulle au survol du jeton et son image au clic');}
/* v0.346 — Les restes d'un adversaire ont leur champ à eux, au formulaire comme dans le tableau en
   masse. Au journal, une ligne de butin surligne ses pièces comme de l'équipement, leur nombre avec
   elles et pas en rouge, la bulle au survol. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function inventaireAdversaire(boite,cible,apres,genre){boite.replaceChildren();boite.classList.add('inv-adv');const restes=genre==='restes',dugenre=o=>estReste(o)===restes;")
  &&src.includes('<h2 class="sous-titre">Restes</h2><div id="restes-edit"></div>')&&src.includes("{cle:'restes',nom:'Restes',type:'panneau',")
  &&!src.includes("['restes','Restes',o=>o.category==='restes']"),'les restes à part');
 assert.ok(src.includes("+' ('+listeNombree([...g.de].map(f=>f.name))+').',{ton:'butin'}));")
  &&css.includes('.j-objet{display:inline-block;'),'le butin au journal');
 // decorate en machine virtuelle : les pièces en pastilles, « ×3 » avec elles, aucun chiffre rouge.
 const el=()=>({kids:[],attrs:{},className:'',textContent:'',style:{},append(...x){this.kids.push(...x)},setAttribute(k,v){this.attrs[k]=v},classList:{contains:c=>false}});
 const ctxJ={actors:[{id:'h',name:'Éla',hero:true},{id:'g',name:'Gobelin',vu:true}],nomNum:o=>o.name,actorTint:()=>'#123',J_KEYS:{},rareteDe:()=>'commun',
  catalog:{items:[{id:'r',name:'Rapière'},{id:'d',name:'Dent de Gobelin'},{id:'d2',name:'Dent de Gobelin'}]},document:{createElement:()=>{const e=el();return e}}};
 vm.createContext(ctxJ);vm.runInContext(page.slice(page.indexOf('function decorate(li,text){'),page.indexOf('let logRound=null;'))+';this.decorate=decorate;',ctxJ);
 /* v0.370 — Une pièce trouvée part au journal sous son identifiant, « ⟦id⟧ » : le journal n'en
    montre que le logo, son nombre à côté ; nom et reste dans la bulle — celle de cette pièce-là,
    jamais d'une homonyme. */
 const li={kids:[],append(...x){this.kids.push(...x)},classList:{contains:c=>c==='ton-butin'}};
 ctxJ.decorate(li,'Éla trouve ⟦r⟧ ×2 ⟦d2⟧ (Gobelin).');
 const vus=li.kids.map(x=>typeof x==='string'?x:x.attrs&&x.attrs['aria-label']?'['+x.attrs['aria-label']+':'+x.kids.map(y=>typeof y==='string'?y:y.textContent).join('')+']':(x.className||'?')+'['+x.textContent+']');
 assert.equal(vus.join(''),'j-name[Éla] trouve [Rapière ×2:◈×2] [Dent de Gobelin:◈] (j-name[Gobelin]).','le logo seul, son nombre à côté, le nom pour le lecteur d’écran');
 const piece=li.kids.find(x=>x.attrs&&x.attrs['aria-label']==='Dent de Gobelin');assert.ok(piece&&!piece.kids.some(y=>typeof y==='string'&&y.includes('Dent')),'aucun nom écrit');}
/* v0.347 — Meute, passif d'adversaire : un allié dans sa zone de contact, et le porteur double son
   bonus de dégâts. */
{const C=require('./combat.js'),m=C.TALENTS_CODES.meute;
 assert.ok(m&&m.type==='pass'&&m.monstre===true&&!m.params.length&&/double son bonus de dégâts/.test(m.phrase({})),'Meute déclarée, passif d’adversaire');
 const ctxM={actors:[],talentsCodes:a=>(a.meute?[{code:{cle:'meute'},params:{}}]:[]),mapSize:()=>({width:800,height:600}),walls:()=>[],tokenOf:()=>40,alive:a=>a.hp>0,
  inContact:(a,o)=>Math.hypot(a.x-o.x,a.y-o.y)<=5,wallsBetween:(a,o)=>!!o.derriere,bonusFiche:()=>({dmg:1}),auraMeneur:()=>0};vm.createContext(ctxM);
 vm.runInContext(page.slice(page.indexOf('function degatsDe(a)'),page.indexOf('function competenceDe(a,k)'))+';this.degatsDe=degatsDe;',ctxM);
 const loup={name:'Loup',hero:false,meute:true,dmg:2,hp:5,x:0,y:0},frere={name:'Loup 2',hero:false,dmg:2,hp:5,x:3,y:0},heros={name:'Éla',hero:true,hp:5,x:1,y:0};
 ctxM.actors.push(loup,heros);assert.equal(ctxM.degatsDe(loup),3,'seul, ou un adversaire au contact : 2 + 1');
 ctxM.actors.push(frere);assert.equal(ctxM.degatsDe(loup),6,'un allié au contact : le bonus double');
 assert.equal(ctxM.degatsDe(frere),3,'l’allié sans Meute ne double rien');
 frere.hp=0;assert.equal(ctxM.degatsDe(loup),3,'un allié à terre ne compte pas');frere.hp=5;
 frere.x=9;assert.equal(ctxM.degatsDe(loup),3,'hors de la zone de contact, rien');frere.x=3;
 frere.derriere=true;assert.equal(ctxM.degatsDe(loup),3,'un mur entre eux, rien');
 assert.ok(fs.readFileSync('editor.js','utf8').includes("l.push(['Meute (allié au contact)','× 2']);"),'le détail des dégâts le dit');}
/* v0.348 — Bulle d'un modèle : ses attaques sans « · distance », et attaques, talents et inventaire
   chacun sur son bloc. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("n.textContent=at.name||'Attaque';")&&!src.includes("(at.range==='distance'?' · distance':'')")
  &&css.includes('.bulle-modele .bulle-attaques,.bulle-modele .bulle-talents,.bulle-modele .bulle-inventaire{box-sizing:border-box;width:100%;margin:2px 0 0;padding:6px 7px;border-radius:8px;background:#ffffff73;'),'la bulle en blocs, sans la portée');}
/* v0.349 — Des ronds bien ronds : les boutons des intitulés de camp ne se laissent plus écraser par
   la ligne, et les billes d'Action et de Mouvement ont une taille paire, sans rétrécir. */
assert.ok(page.includes('button.ajout-camp{margin-left:auto;flex:none;box-sizing:border-box;width:20px;height:20px;')
 &&page.includes('.pastilles .pt{display:block;flex:none;width:8px;height:8px;border-radius:50%;'),'des ronds qui restent ronds');
/* v0.350-351 — Les cases d'équipement toutes à la même hauteur, le logo centré quand rien n'est
   dessous ; les pièces du butin sur la ligne du journal ; la valeur d'un reste, « 7 » et la pièce
   d'or, sans sa conversion. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(css.includes('.cat-pill.gear-carre:not(.talent-carre):not(.best-carre){height:73px}')&&!css.includes('justify-content:flex-start;padding-top:6px}')
  &&css.includes('.j-objet{display:inline-block;')
  &&src.includes("v.append(n,' ',piece);d.append(v)}")&&!src.includes("'Se convertit en : '"),'cases égales, butin aligné, or en pièces');}
/* v0.352 — La planche Caractéristiques ; une icône par compétence, choisie par le MJ sur la page
   Aventuriers, la même devant le nom de la compétence sur toutes les fiches. */
{const src=fs.readFileSync('editor.js','utf8'),C=require('./combat.js');
 assert.ok(fs.existsSync('img/planches/caracteristiques_1.webp'),'la planche Caractéristiques est au dépôt');
 const ctxC={COMPETENCES:C.COMPETENCES};vm.createContext(ctxC);
 vm.runInContext(src.slice(src.indexOf('function normaliseIconesCompetences('),src.indexOf('function iconesCompetences()'))+';this.n=normaliseIconesCompetences;',ctxC);
 assert.deepEqual([...ctxC.n(['planches/caracteristiques_1.webp#4',7,'a"b'])],['planches/caracteristiques_1.webp#4','','',...Array(C.COMPETENCES.length-3).fill('')],'une icône par compétence, rien d’autre');
 assert.equal(ctxC.n(null).length,C.COMPETENCES.length,'autant de places que de compétences');
 assert.ok(src.includes("c.iconesCompetences=normaliseIconesCompetences(c.iconesCompetences);")&&src.includes('<button id="hero-icones-comp" type="button"')
  &&src.includes("planchesDuCatalogue().map(p=>p.fichier).filter(f=>rang(f)>=0)")
  &&page.includes(" skillNames.forEach((name,i)=>{const b=typeof rondCompetence==='function'?rondCompetence(a,i,true):"),'les icônes des compétences sur les fiches');}
/* v0.564 — Arbre : un seul petit rond par chemin, plus de place offerte après celui qui y est ; les petits ronds s'écartent
   un peu de leur talent (0,43 case au lieu de 0,37). Les séries d'avant restent à leur place. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("if(ch[d].petits.length)return;const r=1,{x,y}=bout(p,d,r);")&&src.includes("const bout=(p,d,r)=>{const [dx,dy]=DIRS[d],n=Math.hypot(dx,dy),k=.43+(r-1)*.29;"),'un petit rond par chemin, plus écarté');}
/* v0.674 — Gardien : Boutoir et Coup de Bouclier, avec leurs améliorations. */
{const C10=require('./combat.js'),idx=fs.readFileSync('index.html','utf8');
 [['boutoirtous','boutoir'],['boutoirimpact','boutoir'],['coupbouclierplus','coupbouclier'],['coupboucliernoir','coupbouclier']].forEach(([k,p])=>assert.equal(C10.TALENTS_CODES[k].pour,p,k));
 assert.match(C10.phraseTalent('boutoirtous',{},2),/deux fois/);assert.match(C10.phraseTalent('boutoirimpact',{},2),/lui aussi/);
 assert.ok(idx.includes('function boutoir(a,p,talent){')&&idx.includes("q[porteEffet(c,'coupboucliernoir')?5:2]+=porteEffet(c,'coupbouclierplus')?2:1;"),'Boutoir et Coup de Bouclier câblés');}
/* v0.673 — La feuille d'aventurier n'a plus de bloc Richesses : son or est en bas à gauche du schéma d'inventaire. Une carte se
   lie à un bâtiment du domaine, dont la fiche l'ouvre sur la table, au MJ. */
{const C9=require('./combat.js'),ed=fs.readFileSync('editor.js','utf8'),dom=fs.readFileSync('domaine.js','utf8');
 assert.equal(C9.cleanMap({name:'A',batiment:'b1'}).batiment,'b1');
 assert.ok(!ed.includes("sousTitre('Richesses'")&&ed.includes("or.className='or-corps'")&&dom.includes("x.onclick=()=>{openBattleMap(m.id);showPage('table')}")&&fs.readFileSync('maps.js','utf8').includes("$('map-batiment').onchange="),'or du schéma, cartes des bâtiments');}
/* v0.672 — Les lieux de l'éditeur de cartes : des cartes rassemblées sous un nom, sans toucher aux autres. La quête d'un objet ou
   d'un PNJ voyage avec l'export des cartes. */
{const C8=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8');
 assert.equal(C8.cleanMap({name:'A',lieu:'  Tour  '}).lieu,'Tour');assert.equal('lieu' in C8.cleanMap({name:'B'}),false);
 const m=C8.cleanMap({name:'C',objets:[{nom:'O',quete:'q1'}],foes:[{x:1,y:1,quete:'q2',tpl:{name:'P'}}]});assert.equal(m.objets[0].quete,'q1');assert.equal(m.foes[0].quete,'q2');
 assert.ok(carto.includes('function poseLieuCarte(m,lieu){')&&carto.includes("const lieuxDesCartes=()=>")&&carto.includes('<select id="map-lieu"></select>'),'les lieux');}
/* v0.671 — Le journal du trésor tait les constructions ; le MJ lit aussi la réserve en inventaire et la corrige à part. Une quête
   est au domaine ou dans une région ; sa récompense est faite d'or, de gemmes et de pièces, donnée une fois quand elle réussit. Un
   objet de carte ou un PNJ débloque une quête cachée. */
{const C7=require('./combat.js'),dom=fs.readFileSync('domaine.js','utf8'),carto=fs.readFileSync('maps.js','utf8');
 const q=C7.normaliseQuete({ou:'region',carte:'c1',lieu:'b1',gains:{bourse:[{k:'or',n:2,f:6}],items:['x',3]}});
 assert.deepEqual([q.ou,q.carte,q.lieu,q.gains.bourse.length,q.gains.items],['region','c1','',1,['x']]);
 assert.ok(dom.includes(".filter(e=>!/^Construction — /.test(e.libelle));")&&dom.includes('function donneRecompense(q){if(q.donnee)return;q.donnee=true;')&&dom.includes('function debloqueQuete(a,id){')
  &&carto.includes("if(pres&&o.quete&&typeof debloqueQuete==='function')debloqueQuete(a,o.quete);")&&carto.includes("$('foe-quete').onchange=")
  &&fs.readFileSync('index.html','utf8').includes("if(!seulFoudre&&typeof quetesAuContact==='function')quetesAuContact(a);"),'quêtes : lieux, récompenses, déblocage');}
/* v0.670 — Au domaine, les joueurs lisent les ressources comme sur une fiche, seulement ce qui y est ; les quêtes, globales ou d'un
   bâtiment, se prennent par les aventuriers et se lisent au journal. */
{const C6=require('./combat.js'),dom=fs.readFileSync('domaine.js','utf8');
 const d=C6.normaliseDomaine({quetes:[{titre:'Rats',lieu:'b1',statut:'xx'},null,{id:'q2',titre:'',statut:'reussie'}]});
 assert.equal(d.quetes.length,2);assert.equal(d.quetes[0].statut,'proposee');assert.equal(d.quetes[1].titre,'Quête');assert.equal(d.quetes[1].statut,'reussie');
 assert.ok(dom.includes(" renderRessourcesLues(boite,r);if(mj){")&&dom.includes('function carteQuete(q,avecLieu){')&&dom.includes("$('dom-journal-quetes').onclick=")&&fs.readFileSync('live.js','utf8').includes("'quetesPrises'"),'ressources lues et quêtes');}
/* v0.669 — Sorti d'un piège qui inflige Au sol, l'aventurier n'est plus Au sol. */
assert.ok(fs.readFileSync('maps.js','utf8').includes("if((p.etats||[]).includes('Au sol')&&hasState(a,'Au sol'))setState(a,'Au sol',false);"),'sorti du piège, debout');
/* v0.668 — La bulle du rond Enjamber se lit comme celle d'une action : Enjamber le piège, ou Sortir du piège ; le test requis. */
assert.ok(fs.readFileSync('maps.js','utf8').includes("const nom=tenuParPiege(a)===p?'Sortir du piège':'Enjamber le piège',dit='Test de '+skillNames[k]+' requis.';"),'la bulle d’Enjamber');
/* v0.666 — Le rond Enjamber se reprend au bout des petits boutons de la barre d'actions, cerné d'une aura à sa couleur. */
{const carto=fs.readFileSync('maps.js','utf8');
 assert.ok(carto.includes("barre=document.createElement('span');barre.id='actions-contexte';row.append(barre);")&&carto.includes("(dansBarre?barre:calque).append(b)")&&fs.readFileSync('editor.css','utf8').includes('@keyframes auraContexte'),'le bouton contextuel dans la barre');}
/* v0.665 — Les planches Actions dans les menus d'icônes des caractéristiques et compétences, après les leurs. */
assert.ok(fs.readFileSync('editor.js','utf8').includes("/action/i.test(nomPlanche(f))||/action/i.test(f)?1:-1;"),'les planches Actions dans les icônes des caracs');
/* v0.664 — Trois planches Actions et une planche de talents ; la catégorie Actions ; une planche nommée d'une catégorie et d'un
   numéro y range ses icônes à la découpe. */
{const pl=fs.readFileSync('planches.js','utf8');
 assert.ok(['actions_1','actions_2','actions_3','talents_20'].every(n=>fs.existsSync('img/planches/'+n+'.webp'))&&pl.includes(".replace(/\\d+$/,''))||[''])[0];"),'les planches Actions et Talents');}
/* v0.663 — Invisible prend fin quand on attaque, joue un talent ou crie. */
{const idx=fs.readFileSync('index.html','utf8');
 assert.ok(idx.includes("const dit=avecTalent(ctx,()=>fn(a,params,talent));finInvisible(a);")&&idx.includes("ajouteBilan(a,'coups',1);finInvisible(a);")&&idx.includes(" a.crie=true;finInvisible(a);"),'Invisible prend fin');}
/* v0.661 — Les statistiques comptent les dégâts réels du coup, au-delà des PV qui restaient à la cible. */
{const idx=fs.readFileSync('index.html','utf8');
 assert.ok(idx.includes("compteDegats(de===undefined?auteurCoup:de,a,perdu>0?Math.max(perdu,Math.trunc(n)):0);")&&idx.includes("compteDegats(a,b,lost>0?Math.max(lost,damage):0);"),'les dégâts réels comptent');}
/* v0.660 — Une cible tuée par un coup, Coupure ou Insaisissable ne reçoit pas les états qui viennent après les dégâts. */
{const idx=fs.readFileSync('index.html','utf8');
 assert.ok(idx.includes("if(!r.failed&&!blocked&&lost>0){if(b.hp>0)afflictions.forEach(")&&idx.includes("if(b.hp>0)etats.forEach(e=>{const issue=infligeEtat(b,e);")&&idx.includes("if(poison&&b.hp>0&&")&&idx.includes("if(e.hp>0)for(let i=0;i<n;i++)if(infligeEtat(e,'Poison')===true)k++;"),'pas d’état sur un mort');}
/* v0.659 — Insaisissable : Coupure d'Adieu, Ombre fuyante. */
{const C5=require('./combat.js'),idx=fs.readFileSync('index.html','utf8');
 assert.ok(C5.TALENTS_CODES.insaisisadieu.pour==='insaisissable'&&C5.TALENTS_CODES.insaisisombre.pour==='insaisissable','les améliorations');
 assert.match(C5.phraseTalent('insaisisadieu',{},2),/à volonté/);assert.match(C5.phraseTalent('insaisisombre',{},2),/Invisible et Onde/);
 assert.ok(idx.includes("actors.forEach(o=>regenerer(o,'fin'));actors.forEach(ombreFuyante);")&&idx.includes(" coupureAdieu(a,avant,c);if(!poison&&!degats)return;"),'câblées');}
/* v0.658 — Coupure : Empoisonnée, Profonde, Fatale. */
{const C4=require('./combat.js'),idx=fs.readFileSync('index.html','utf8');
 ['lameventpoison','lameventprofonde','lameventfatale'].forEach(k=>assert.equal(C4.TALENTS_CODES[k].pour,'lamevent',k));
 assert.match(C4.phraseTalent('lameventprofonde',{},2),/triple/);assert.match(C4.phraseTalent('lameventfatale',{},2),/1 PA et 1 PM/);assert.match(C4.phraseTalent('lameventpoison',{},1),/le plus proche/);
 assert.ok(idx.includes("if(fatale&&tues&&enCombat()&&a.coupureFatale!==round){")&&idx.includes("return degatsDe(a)*(pr?voletOuvert(pr,'triple')?3:2:1)+(p.bonus|0)}"),'Coupure câblée');}
/* v0.656 — PA et PM sont des bonus de caractéristique de l'arbre, à l'icône réglable ; Point supplémentaire quitte la bibliothèque. */
{const C3=require('./combat.js'),idx=fs.readFileSync('index.html','utf8'),ed=fs.readFileSync('editor.js','utf8');
 assert.ok(C3.TALENTS_CODES.bonus.params[0].options.some(([k])=>k==='pa')&&C3.TALENTS_CODES.bonus.params[0].options.some(([k])=>k==='pm')&&C3.TALENTS_CODES.pointsupp.retire===true,'PA et PM en bonus');
 assert.equal(C3.libelleBonus({carac:'pa',valeur:1}),'+1 PA');assert.equal(C3.libelleBonus({carac:'pm',valeur:2}),'+2 PM');
 assert.ok(idx.includes("c.filter(t=>t.code.cle==='bonus'&&k&&t.params&&t.params.carac===k)")&&ed.includes("['pa','Point d’Action'],['pm','Point de Mouvement']];"),'PA et PM comptés, icônes réglables');}
/* v0.655 — Impulsion et ses améliorations ; « +1 PA » et « +1 PM » montent avec leur point. */
{const C2=require('./combat.js'),idx=fs.readFileSync('index.html','utf8');
 assert.ok(C2.TALENTS_CODES.impulsiontour.pour==='impulsion'&&C2.TALENTS_CODES.impulsionallie.pour==='impulsion','Impulsion');
 assert.equal(C2.pointsMax({points:{action:1},paBonus:1},'action'),2);assert.equal(C2.pointsMax({points:{action:1},paBonus:1},'action',true),1);
 assert.ok(idx.includes("if(vers.hp===0){ajouteBilan(de,'abat',1);impulsion(de,vers)}")&&idx.includes("floatNumber(a,'+1 PM','gain');")&&idx.includes("pt.className='pt '+(pa?'action':'mvt');el.append(pt);el.style.color=pa?'#3f8fe0':'#cf9152'"),'Impulsion câblée');}
/* v0.654 — Les états posés par un coup montent au-dessus de la cible, après ses dégâts. */
assert.ok(fs.readFileSync('index.html','utf8').includes(" posesDits.forEach(e=>floatNumber(b,'✦ '+e,'perte'));"),'les états du coup montent');
/* v0.653 — Lame empoisonnée, Poison au contact : l'adversaire le plus proche, puis tous ceux de la zone de contact au palier 2. */
assert.match(C.phraseTalent('lamepoisoncontact',{},1),/l’adversaire le plus proche/);assert.match(C.phraseTalent('lamepoisoncontact',{},2),/tous les adversaires/);
assert.ok(fs.readFileSync('index.html','utf8').includes("const touches=voletOuvert(contact,'tous')?autres:autres.slice(0,1);"),'Poison au contact : tous au palier 2');
/* v0.652 — Le Poison en violet : ses dégâts qui montent, et le mot dans les bulles. */
assert.ok(fs.readFileSync('index.html','utf8').includes("couleurFlottant=COULEURS_ETATS.Poison;")&&fs.readFileSync('editor.js','utf8').includes("Poison:'#9b4fc0',"),'le Poison en violet');
/* v0.651 — Course mortelle va toujours à l'adversaire le plus proche ; déjà à son contact, le porteur ne bouge pas. */
assert.ok(fs.readFileSync('index.html','utf8').includes("const cands=vusPourMouvement(a,false).filter(j=>actors[j]);"),'Course mortelle : le plus proche, quoi qu’il arrive');
/* v0.650 — La bulle d'un piège quitte le piège, pour tout le monde, et se pose sur le rond Enjamber. */
{const carto=fs.readFileSync('maps.js','utf8'),rp=carto.slice(carto.indexOf('function renderPieges('),carto.indexOf('function renderEnjamber('));
 assert.ok(!rp.includes('surveille(')&&carto.includes("surveille(b,()=>bulleAction(b,{nom,dit}))"),'la bulle du piège sur le rond Enjamber');}
/* v0.649 — Insaisissable n'est pas arrêté au contact ; ses améliorations frappent ceux qu'il quitte, Poison 1 puis 2 et son bonus
   de dégâts. Ombrelame, le talent, s'appelle Coupure ; son amélioration double ses dégâts contre un adversaire au contact d'un allié. */
{const C=require('./combat.js'),idx=fs.readFileSync('index.html','utf8'),ed=fs.readFileSync('editor.js','utf8');
 assert.ok(idx.includes("if(porteEffet(talentsCodes(a),'insaisissable'))return null;")&&idx.includes("if(porteEffet(talentsCodes(a),'insaisissable')){quitteInsaisissable(a,avant);return}")&&idx.includes('function quitteInsaisissable(a,avant){'),'Insaisissable');
 assert.ok(C.TALENTS_CODES.insaisispoison.pour==='insaisissable'&&C.TALENTS_CODES.insaisisdegats.pour==='insaisissable'&&C.TALENTS_CODES.lameventdouble.pour==='lamevent','les améliorations');
 assert.equal(C.TALENTS_CODES.lamevent.nom,'Coupure');assert.equal(C.effetParNom('Ombrelame'),'lamevent');assert.match(C.phraseTalent('insaisispoison',{},2),/Poison 2/);
 assert.ok(ed.includes("if(c.coupure!==1){")&&idx.includes("*(double&&entoure(b)?2:1)"),'Coupure');}
/* v0.648 — En combat, l'arbre d'un aventurier ne se change pas, sauf par le MJ. Le nombre d'adversaires d'Ombrelame devient une
   amélioration. Course mortelle, Bondissement, Découpe et Lame empoisonnée, avec leurs améliorations. Le Poison inflige un dégât par
   cran. La catégorie d'icônes de la classe d'un talent passe en tête de ses menus de logos. */
{const C=require('./combat.js'),idx=fs.readFileSync('index.html','utf8'),ed=fs.readFileSync('editor.js','utf8'),pl=fs.readFileSync('planches.js','utf8');
 assert.ok(!C.TALENTS_CODES.lamevent.params.some(p=>p.cle==='cibles')&&C.TALENTS_CODES.lameventcibles.pour==='lamevent','Ombrelame : les adversaires frappés en amélioration');
 [['coursechoix','coursemortelle'],['courseombrelame','coursemortelle'],['bondissementlibre','bondissement'],['bondissementfrappe','bondissement'],['decoupedegats','decoupe'],['decoupeplus','decoupe'],['lamepoisonplus','lameempoisonnee'],['lamepoisoncontact','lameempoisonnee']]
  .forEach(([k,p])=>assert.equal(C.TALENTS_CODES[k].pour,p,k+' améliore '+p));
 assert.ok(C.TALENTS_CODES.coursemortelle.attaque&&C.TALENTS_CODES.lameempoisonnee.attaque&&C.TALENTS_CODES.bondissement.type==='reac'&&C.TALENTS_CODES.decoupe.type==='pass','les quatre talents');
 assert.match(C.phraseTalent('lamepoisonplus',{},2),/Poison 3/);assert.match(C.phraseTalent('lamepoisonplus',{},1),/Poison 2/);assert.match(C.phraseTalent('decoupeplus',{},2),/\+3/);
 assert.ok(idx.includes("if(hasState(a,'Poison')){const n=compteEtat(a,'Poison');couleurFlottant=COULEURS_ETATS.Poison;let r;try{r=subitDegatsEtat(a,'Poison',n)}")&&!idx.includes("effectDice(a,5,"),'le Poison : un dégât par cran');
 assert.ok(idx.includes("function frappeOmbrelame(a,p,frappes){")&&idx.includes("function courseMortelle(a,p,talent){")&&idx.includes("function bondissement(a,p,talent){")&&idx.includes("function lameEmpoisonnee(a,p,talent){")
  &&idx.includes("function noteDecoupe(a,b,quoi){")&&idx.includes("if(!hasState(a,'Affaibli')&&activeAttack(a).useOwnDamage!==false)bonus+=decoupeContre(a,b);")
  &&idx.includes("b.bondissement={de:a.id,tour:round};")&&fs.readFileSync('live.js','utf8').includes("'revanche','traction','bondissement','decoupe',"),'les talents d’Ombrelame câblés');
 assert.ok(ed.includes("function figeEnCombat(){return view!=='mj'&&typeof enCombat==='function'&&enCombat()}")&&ed.includes("if(m||figeEnCombat())return;"),'l’arbre figé en combat');
 assert.ok(pl.includes("function iconesClasseEnTete(select,famille){")&&pl.includes("if(tete)groupe(tete.label,[...tete.children],false);"),'la catégorie de la classe en tête');}
/* v0.647 — Avec la Sélection, la hitbox d'un piège passe devant le départ, la matière et le halo d'une lumière ; son nom dans la
   fiche du piège la choisit sur la carte. Choisir un token d'un clic redessine les ronds Enjamber. La planche OMBRELAME et sa
   catégorie. */
{const carto=fs.readFileSync('maps.js','utf8'),idx=fs.readFileSync('index.html','utf8'),pl=fs.readFileSync('planches.js','utf8');
 assert.ok(carto.includes("function hitboxSous(p){")&&carto.includes("if(hb&&(!dessous||dessous.kind==='start'||dessous.kind==='matiere'||(dessous.kind==='lumiere'&&!surCoeur)))dessous=hb}")
  &&carto.includes("mapTool='select';mapSel={kind:'declencheur',i,k};")&&fs.readFileSync('editor.css','utf8').includes('.hitbox.selected{z-index:3}'),'la hitbox se reprend');
 assert.ok(/function pickNow\(i\)\{[\s\S]*?renderEnjamber\(\);\n return true\}/.test(idx),'les ronds Enjamber suivent le token choisi');
 assert.ok(pl.includes("['ombrelame','Ombrelame'],['actions','Actions']]")&&pl.includes("{nom:'',cat:catNom}")&&fs.existsSync('img/planches/OMBRELAME.webp'),'la planche OMBRELAME');}
/* v0.646 — Sorti du fond d'un piège par un test réussi, l'aventurier regagne la place d'où le piège l'avait happé, ou à défaut le
   premier point libre hors du piège. */
{const carto=fs.readFileSync('maps.js','utf8');
 assert.ok(carto.includes("o.avantPiege={x:depuis.x,y:depuis.y};")&&carto.includes("if(ok&&dedans){const de={x:a.x,y:a.y},q=sortieDuPiege(a,p);")&&carto.includes("function sortieDuPiege(o,p){"),'on ressort du piège à sa place d’avant');}
/* v0.644 — La hitbox d'un piège : un rectangle à part de son icône, qu'on étire en travers d'un passage ; elle compte comme le
   piège, bloque l'aventurier tant qu'il ne l'a pas enjambé et ne se montre qu'au MJ. La glissade le long d'un piège ne traverse
   plus ni mur ni terrain impraticable. */
{const carto=fs.readFileSync('maps.js','utf8'),C=require('./combat.js');
 assert.equal(C.cleanMap({pieges:[{id:'p',nom:'P',x:1,y:1,w:2,h:2,declencheurs:[{id:'h',type:'bloc',x:0,y:0,w:10,h:20}]}]}).pieges[0].declencheurs[0].type,'bloc','la hitbox voyage avec le piège');
 assert.ok(carto.includes("if((p.declencheurs||[]).some(d=>d.type==='bloc'&&polyTouchesDisc(rectHitbox(d).map(px),c,r)))return 'contact';")
  &&carto.includes("['bloc','+ Hitbox de blocage']")&&carto.includes("type:mapTool==='piegebloc'?'bloc':'zone'")&&carto.includes("if(d.type==='bloc'&&!mj)return;")
  &&carto.includes("el.className='shape declencheur zone'+(d.type==='bloc'?' hitbox':'')")&&!fs.readFileSync('editor.css','utf8').includes('.zone.bloc{')
  &&carto.includes("if(murs.length&&(segmentHitsPolys(q,fin,murs)||")&&carto.includes("(p.declencheurs||[]).some(d=>d.type==='bloc'&&polyInReach(a,rectHitbox(d),size,tokenOf(a)))"),'la hitbox du piège');}
/* v0.643 — Ce qui se prend au sol — lumière posée ou fixe, objet de carte, coffre — se réserve d'abord sur la table, par une
   transaction : deux tables qui le prennent au même instant, une seule l'a. Un bouton montre ou cache au MJ le terrain
   impraticable. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(vif.includes("function reserveSurTable(marque){if(!enLigne||!salleRef)return Promise.resolve(true);")&&vif.includes("const neuf=marque(Array.isArray(d&&d.doors)?d.doors.slice():[]);if(!neuf)return false;")
  &&carto.includes("prisSurTable(marque,()=>recupereLumiereFait(a,l,pieces))}")&&carto.includes(",()=>recupereObjetFait(a,o))}")&&carto.includes("if(v&8)return null;arr[i]=v|8|2;return arr},()=>ouvreCoffreFait(c,h))}")
  &&carto.includes("if(typeof inventairePlein==='function'&&pieces.every(it=>inventairePlein(a,it)))return;"),'une prise au sol, une seule fois');
 assert.ok(carto.includes("const impratBtn=icone('impraticables-vue','🚧','Cacher le terrain impraticable');")&&carto.includes(" impratBtn.hidden=!m||!impraticableDe(m).length;"),'le bouton du terrain impraticable');}
/* v0.642 — Le terrain impraticable : une couche que le MJ seul voit, en pointillés rouges, qui arrête le pas comme un mur sans
   couper la vue ; rectangle, contour libre, trait et gomme. Le rond Enjamber prend la taille d'un gros bouton de la barre. */
{const carto=fs.readFileSync('maps.js','utf8'),C=require('./combat.js');
 const m={};C.ajouteImpraticable(m,[[10,10],[20,10],[20,20],[10,20]]);assert.equal(C.impraticableDe(m).length,1);
 C.retireImpraticable(m,[[14,0],[16,0],[16,30],[14,30]]);assert.equal(m.impraticable.length,2,'la gomme coupe le terrain en deux');
 assert.equal(C.cleanMap(m).impraticable.length,2,'il voyage avec la carte');assert.ok(!('impraticable' in C.cleanMap({})),'une carte sans terrain impraticable reste la même');
 assert.ok(page.includes("function obstaclesDuPas(px){")&&page.includes(" const polys=obstaclesDuPas(px);")&&page.includes("function cheminVers(r,p){const size=mapSize(),murs=obstaclesDuPas(")
  &&carto.includes("function renderImpraticables(){")&&carto.includes("if(!m||view!=='mj'||!impratVisible||(typeof oeilJoueur==='function'&&oeilJoueur()))return;")
  &&carto.includes('<button data-tool="imprat">Impraticable</button><button data-tool="impratlibre">Impraticable libre</button><button data-tool="impratligne">Ligne impraticable</button><button data-tool="impratgomme">Gomme d’impraticable</button>'),'le terrain impraticable');
 assert.ok(page.includes("#piege-boutons button.btn-action.rond.btn-enjamber{position:absolute;width:58px;height:58px;font-size:26px;")&&page.includes("#piege-boutons{position:absolute;inset:0;z-index:6;pointer-events:none}"),'le rond Enjamber en gros bouton, au-dessus des textes');}
/* v0.641 — Le rond Enjamber garde, à l'écran, la taille d'un petit bouton de la barre d'action, quel que soit le zoom. */
assert.ok(page.includes("$('map-view').style.setProperty('--dezoom',String(1/mapZoom));")&&page.includes("#piege-boutons button.btn-action.rond.btn-enjamber{position:absolute;width:58px;height:58px;font-size:26px;transform:translate(-50%,-50%) scale(var(--dezoom,1));"),'le rond Enjamber à la taille d’un bouton de la barre');
/* v0.640 — Le jeu à plusieurs : les PV partent en différence additionnée par Firestore, l'état du tour d'un joueur est daté et le
   MJ écarte ce qui arrive d'un tour révolu, le début et la fin d'un combat interrompent les gestes, un coup dont la cible est
   tombée entre-temps passe à l'adversaire suivant, la remise au tour 1 ne clôt plus le combat, la table en ligne a le dernier
   mot avant la fin ; le piège connu ne se grignote plus et se longe ; le rond Enjamber suit le geste. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(vif.includes("firebase.firestore.FieldValue.increment(b[k]-a[k]):b[k]});")&&vif.includes("if(tour&&!estMJ()&&typeof cleTour==='function')maj['actors.'+id+'.tourVu']=cleTour()});")
  &&vif.includes("const perime=estMJ()&&!neuf&&typeof e.tourVu==='string'&&cleIci!==null&&e.tourVu!==cleIci;")&&vif.includes("if(typeof a.hp==='number'&&a.hp<0){a.hp=0;if(estMJ()&&typeof e.hp==='number'&&e.hp<0)gardes.push([id,'hp',e.hp])}")
  &&vif.includes("...(typeof numeroCombat!=='undefined'?{cb:numeroCombat}:{})};"),'les PV additionnés, le tour daté');
 assert.ok(page.includes("function interromptGestes(){")&&page.includes("if(commence||finit)interromptGestes();if(commence&&!spect)numeroCombat++;")
  &&vif.includes("if(basculeMode&&typeof interromptGestes==='function')interromptGestes();"),'le début et la fin d’un combat interrompent les gestes');
 assert.ok(page.includes("const idsVises=vises.map(j=>actors[j]&&actors[j].id);")&&page.includes("if(opts.vises&&!opts.vises.some(j=>actors[j]&&alive(actors[j]))){vises=cibleAutomatique(a,portee);opts={...opts,vises:null}}"),'le coup passe à l’adversaire suivant');
 assert.ok(page.includes(" combatEngage=false;if(finCombatPrevue){clearTimeout(finCombatPrevue);finCombatPrevue=0}")&&vif.includes("function adversairesDeboutTable(){"),'le combat ne finit pas sur un adversaire encore debout');
 assert.ok(carto.includes("const bute=(k,c)=>{const d=k.ecart(c);return d<r&&d<Math.min(k.d0,r)-.01};")&&carto.includes("function mesureEcartPiege(p,size){")&&carto.includes("if(cle===enjamberCle&&calque.isConnected&&(!barre||barre.isConnected))return;"),'le piège connu se longe, le rond suit le geste');}
/* v0.639 — Les flèches sans rendu complet à chaque appui ; les Points de vie sous les Combattants ; Échanger et Changer
   d'armes en exploration aussi ; Enjamber au centre du piège ; un piège connu arrête l'aventurier, l'échec l'y précipite et
   il n'en sort qu'en réussissant le test, en subissant de nouveau ses états à chaque échec. */
{const carto=fs.readFileSync('maps.js','utf8');
 assert.ok(page.includes("function pasVisible(a){")&&page.includes("bruitDePas(a,[{x:x0,y:y0},{x:a.x,y:a.y}])}pasVisible(a);")&&page.includes("if(!renduClavier){saveChecks();savePool()}selected=i;"),'le pas d’une flèche se voit aussitôt');
 assert.ok(page.includes("ech.hidden=arm.hidden=!a||!a.hero||!!a.horsCarte;")&&page.includes("if(enCombat())depensePoint(a,'mouvement');fermerBulle();apresEchange()"),'Échanger et Changer d’armes en exploration');
 assert.ok(carto.includes("function ecartAuPiege(p,c,size){")&&carto.includes("return {p:mur.p,...pct(fin),bloque:true}}")
  &&page.includes("if(piegeClavier&&!piegeClavier.bloque)declenchePiege(")&&carto.includes("b.style.top=(p.y+p.h/2)+'%'}")
  &&carto.includes("if(quoi==='enjambement'&&!ok){declenchePiege(p,a,true);return}")&&carto.includes("if(!p||p.desamorce||(!piegeArme(p)&&!p.enjambement)||"),'le piège connu bloque, on n’en sort qu’en l’enjambant');}
/* v0.638 — L'arrêt au contact se fait à la sortie : entré à plus de moitié dans la zone d'un adversaire, le socle qui en ressort
   s'arrête au bord, une fois par adversaire et par tour. La barre de mouvement est celle du token sélectionné. */
assert.ok(page.includes("if(tokenDistance(a,o,size)<=contactRadius(tokenOf(o)))eng.add(o.id);continue}")&&page.includes("if(!eng.has(o.id))continue;eng.delete(o.id);if(s===0||faits.has(o.id))continue;")
 &&page.includes("const a=actors[selected]||null;barreMouvement(a,a?resteMouvement(a):0)}"),'l’arrêt en sortie de zone, une fois ; la barre du token sélectionné');
/* v0.637 — La barre de mouvement, l'arrêt au contact, le gel du début de combat, les flèches d'un mètre, Échanger un objet et
   Changer d'armes, le verrou des armes en combat, le glisser d'une fiche à l'autre, Enjamber au-dessus du piège, le bruit coupé. */
{const src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(page.includes('<div id="barre-mouvement" hidden aria-hidden="true"></div>')&&page.includes("function traceMouvement(a,r){if(a&&r&&r.combat&&r.tk)barreMouvement(a,r.metres-r.long/r.tk);else majBarreMouvement();")
  &&page.includes("[...el.children].forEach((p,n)=>p.classList.toggle('pris',n>=plein));el.hidden=false}"),'la barre de mouvement, un point par mètre');
 assert.ok(page.includes("function arretAuContact(a,de){")&&page.includes("if(arretContact){t.onpointerup(e);return}")&&page.includes("if(regle&&regle.combat){const h=arretAuContact(a,{x:x0,y:y0});if(h){a.x=h.x;a.y=h.y}}"),'entrer au contact d’un adversaire arrête le geste');
 assert.ok(page.includes("function gelDebut(a){if(!enCombat()||!a)return false;")&&page.includes("&&!gelDebut(actors[i])}")&&page.includes("ferme=debut&&!ouvertureCombat(a),gele=!debut&&gelDebut(a);")
  &&page.includes("debout().forEach(o=>{o.debutTour=round});")&&vif.includes("'alignementJeu','debutTour'];"),'le début de combat et le début de tour gèlent les autres');
 assert.ok(page.includes("const mx=100*tk/sz.width,my=100*tk/sz.height,dirs={ArrowLeft:[-mx,0],ArrowRight:[mx,0],ArrowUp:[0,-my],ArrowDown:[0,my]};")
  &&page.includes(" t.onkeydown=e=>pasClavier(i,e)")&&page.includes("const a=actors[selected];if(!a||!document.querySelector('#map-view .token[data-id=\"'+CSS.escape(a.id)+'\"]'))return;pasClavier(selected,e)});"),'les flèches : un mètre par appui, même sans focus');
 assert.ok(page.includes('id="echanger" hidden>')&&page.includes('id="changer-armes" hidden>')&&page.includes("function cibleEchange(a){")&&src.includes("['echanger','Échanger un objet'],['armes','Changer d’armes']];")
  &&src.includes("function verrouEquip(a,o){")&&src.includes("&&tout&&peutEquiper&&!verrouEquip(a,o);"),'Échanger un objet, Changer d’armes, et le verrou des armes en combat');
 assert.ok(src.includes("objetGlisse={de:a.id,id:o.id}")&&src.includes("retirerInventaire(de,o);if(!ajouterInventaire(a,o)){ajouterInventaire(de,o);return}"),'un objet glissé d’une fiche à l’autre');
 assert.ok(carto.includes("function renderEnjamber(){")&&carto.includes("testPiege(a,p,'enjambement')};(dansBarre?barre:calque).append(b)}))}")&&page.includes("if(typeof renderEnjamber==='function')renderEnjamber();"),'Enjamber, au-dessus du piège');
 assert.ok(carto.includes("const bruitBtn=icone('bruit-bascule','🔊','Désactiver le bruit');")&&carto.includes("||(typeof bruitCoupe!=='undefined'&&bruitCoupe))return 0;")
  &&vif.includes("bruitCoupe=d.fogReset.bruitOff===true;")&&page.includes("localStorage.getItem('amertume-bruit-coupe')==='1'"),'le bruit coupé pour toute la table');}
/* v0.635 — L'Analyse déjà faite pendant ce combat se dit à la deuxième personne. */
assert.ok(page.includes(":dejà?'Vous avez déjà analysé '+nomNum(proie)+' pendant ce combat.'")&&page.includes("log('Vous avez déjà analysé '+nomNum(o)+' pendant ce combat.',{local:true});return}"),'déjà analysé');
/* v0.633 — « Cacher » à côté du niveau d'une ligne : ce qui en descend n'est plus, chez les joueurs, que des ronds flous. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function talentsCaches(liste){")&&src.includes("function basculeCache(de,vers){")&&src.includes("l.append(c,'Cacher');")
  &&css.includes('.arbre-noeud.cache-joueur{filter:blur(3px);pointer-events:none}'),'cacher la suite d’une ligne');
 // v0.634 — Désactivé : ni case, ni flou.
 assert.ok(src.includes("const CACHER_ARBRE=false;")&&src.includes("function talentsCaches(liste){if(!CACHER_ARBRE)return new Set();")&&src.includes("if(mj&&CACHER_ARBRE){"),'Cacher désactivé');}
/* v0.632 — Un adversaire tout analysé ne s'analyse plus, et la case qui apprend sa dernière chose le dit ; plus de 🎲 à l'Analyse. */
assert.ok(page.includes("function analyseComplete(o){const s=connuDe(o);return INFOS_ANALYSE.every(([k])=>s.has(k))}")
 &&page.includes("+(neufs.length&&analyseComplete(o)?'\\n'+o.name+' est entièrement analysé !':''),{ton:'talent'});")
 &&page.includes(":proie&&analyseComplete(proie)?nomNum(proie)+' est entièrement analysé.'"),'l’adversaire entièrement analysé');
/* v0.631 — La DEF connue d'un adversaire paraît dans la colonne des combattants ; l'XP de l'Analyse se lit dans sa case du journal. */
assert.ok(page.includes("if(!jamaisVu&&(view==='mj'||connait(a,'def')))b.querySelector('.vie-ligne').append(shieldBadge(defOf(a)));")
 &&page.includes("+(gagne?'\\nLe groupe gagne '+gain+' XP.':'')"),'la DEF connue, l’XP dans la case de l’Analyse');
/* v0.630 — La bulle d'un token aux chiffres de la fiche, la vie sur toute la largeur, les Attaques spéciales à découvrir à part. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("chiffres.className='stat-row en-icones';")&&src.includes("else inconnuBulle(d,'Attaques spéciales');")&&src.includes("function rangAttaques(d,attaques,bonus){")
  &&css.includes('.bulle-comb-vie{margin:4px 0 2px;width:100%;flex:1 1 100%;align-self:stretch}')&&css.includes('.bulle-comb-vie .lifebar{display:flex;align-items:center;width:100%;height:18px;margin:0}'),'la bulle à la manière de la fiche');}
/* v0.629 — L'Analyse : un test de Savoir, chaque réussite une chose au hasard parmi six, apprise pour tout le type ; la première
   fois, 10 % de l'XP de l'adversaire au groupe, au moins 1 ; un aventurier n'analyse un type qu'une fois par combat ; le Bestiaire
   efface tout. La bulle d'un token au survol, « ? » pour l'inconnu, chez le MJ aussi. Fouiller exige un socle qui déborde. */
{const src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(page.includes("const INFOS_ANALYSE=[['pv','PV max'],['def','DEF'],['dmg','Bonus de dégâts'],['attaques','Attaques spéciales'],['xp','XP'],['talents','Talents'],['equip','Équipement']];")
  &&page.includes("for(let n=0;n<jet.reussites&&restants.length;n++)tires.push(restants.splice(Math.floor(Math.random()*restants.length),1)[0]);")
  &&page.includes("(neufs.length?'\\n'+neufs.map(x=>'- '+dit[x]()).join('\\n'):'\\nAucune information nouvelle.')")
  &&page.includes("const k=skillNames.indexOf('Savoir'),jet=skillRoll(valeurCompetence(a,k)-1,d6);")
  &&page.includes("const gain=neufs.length*Math.max(1,Math.round((Math.trunc(Number(o.xp))||0)/10))")
  &&page.includes("const cle=cleAnalyse(o);if((a.analysesFaites||[]).includes(cle))")&&vif.includes("'connu','analysesFaites','debutTour','avantPiege'];"),'l’Analyse par le Savoir');
 assert.ok(src.includes("function bulleCombattant(o){")&&src.includes("const sait=k=>typeof connait!=='function'||connait(o,k);")&&src.includes("'Analysez un adversaire pour en savoir davantage à son sujet !'")
  &&page.includes("if(typeof bulleCombattant==='function'){t.removeAttribute('title');survolToken(t,a)}")&&src.includes("function oublierAnalyses(){delete catalog.analyses;")
  &&src.includes("id=\"bestiary-analyses\""),'la bulle du token, le Bestiaire qui oublie');
 assert.ok(carto.includes("dedans=aireMulti(Clipper.difference(D,U))<=Math.max(1,tout*.002)")&&page.includes("if(typeof zoneFouillee==='function'&&zoneFouillee(a))return;zone=zonePerception(a)}"),'Fouiller, le socle qui déborde');}
/* v0.628 — Fouiller, en exploration seulement et sans rien coûter, est seul à fouiller : zone de fouille, objets révélés. Un rond
   de compétence ne fait que jeter les dés. */
assert.ok(page.includes("function testSkill(i,fouille){")&&page.includes("let zone=null;if(fouille&&i===PERCEPTION_RANG&&a.hero")&&page.includes("if(zone&&typeof objetsDecouverts==='function')objetsDecouverts(")
 &&page.includes("const fou=$('fouiller');fou.hidden=!a||!a.hero||enCombat();")&&page.includes("||enCombat())return;testSkill(PERCEPTION_RANG,true)};"),'Fouiller seul fouille, en exploration');
/* v0.626 — Le MJ voit toujours un coffre caché : un contour en pointillés au-dessus du brouillard et du noir. Chez un joueur, le token
   d'un autre qu'on tente de déplacer dit « Ce n’est pas moi ! », et son aventurier est en vert dans la colonne des combattants.
   Les adversaires crient aussi, et chaque cri, tiré au hasard, se lit au journal. */
{const carto=fs.readFileSync('maps.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(carto.includes("if(mj&&!oeil&&!coffreVisible(c)&&!c.ouvert){const o=document.createElementNS(nsSVG,'polygon');o.setAttribute('class','coffre-cache-mj');")
  &&carto.includes("caches.replaceChildren();if(!m)return;")&&css.includes('#coffres-caches .coffre-cache-mj{'),'le coffre caché, chez le MJ, au-dessus du brouillard');
 assert.ok(page.includes("else if(e.button===0&&view!=='mj'&&!controlled(i))tenteBloque(a,e,'Ce n’est pas moi !');")
  &&page.includes("else if(dirs[e.key]&&!e.repeat&&view!=='mj'&&!controlled(i))floatNumber(a,'Ce n’est pas moi !','nul',true);"),'« Ce n’est pas moi ! »');
 assert.ok(page.includes("(view!=='mj'&&a.hero&&i===owner&&!(typeof spectateur==='function'&&spectateur())?' mien':'')")&&page.includes('.actor.mien .actor-nom strong{color:var(--green)}'),'son aventurier en vert');
 assert.ok(page.includes("const cri=$('crier');cri.hidden=!a||!!a.orbeStatique||(!a.hero&&!controlled(selected));")&&page.includes("if(a.hero)log(nomNum(a)+' pousse un cri : '+auHasard(CRIS_TROUPE));")
  &&page.includes("log(nomNum(a)+' pousse un '+genre+' : '+auHasard(CRIS_ADVERSES[genre]))"),'les cris, au journal, pour tous');}
/* v0.625 — Le bruit vaut pour tout adversaire pas encore révélé, qu'il voie l'aventurier ou non : voir dans le noir ne l'empêche plus
   d'entendre. Au sol, un token qu'on tente de déplacer le dit : « Au Sol ! ». */
{const carto=fs.readFileSync('maps.js','utf8');
 assert.ok(!carto.includes('voitBruiteur')&&carto.includes("  &&places.some(s=>Math.hypot((a.x-s.x)/100*W,(a.y-s.y)/100*H)<=Rp));"),'le bruit, sans condition de vue');}
assert.ok(page.includes("function auSolBloque(i){const a=actors[i];return !!a&&controlled(i)&&hasState(a,'Au sol')&&!canMove(i)&&(alive(a)||view==='mj')}")
 &&page.includes("if(!geste)return;if(e.button===0&&auSolBloque(i))tenteBloque(a,e,'Au Sol !');")&&page.includes("lot.forEach(k=>{if(auSolBloque(k))floatNumber(actors[k],'Au Sol !','nul',true)})")
 &&page.includes("if(dirs[e.key]&&!e.repeat&&auSolBloque(i))floatNumber(a,'Au Sol !','nul',true);"),'« Au Sol ! » à qui tente de déplacer');
/* v0.624 — Un tir qui porte le Feu, le Gel ou la Foudre part en boule de son élément, comme un orbe, ici et sur toutes les tables. */
assert.ok(page.includes("const elem=(activeAttack(a).etats||[]).find(e=>['Feu','Gel','Foudre'].includes(e));")
 &&page.includes("duree=Math.max(duree,volOrbe(a,actors[j],'',elem)||0);if(typeof diffuserEffet==='function')diffuserEffet('orbe',a,actors[j],'|'+elem);return}"),'le tir élémentaire, en orbe');
/* v0.624 — Le bruit des pas, comme la révélation : une seule tentative, la première fois qu'un aventurier entre à portée d'un
   adversaire, 5 m sans porte, 10 m à travers une porte close. Le « ! » ne vaut qu'avant la révélation. */
{const carto=fs.readFileSync('maps.js','utf8');
 assert.ok(carto.includes("&&!a.vu&&campDe(a)==='adverse'&&!deja(a)")&&carto.includes("function oublieEntendus(){actors.forEach(a=>{if(a&&a.entendu&&(a.vu||!alive(a)))delete a.entendu})}")
  &&page.includes("if(a.entendu&&!a.vu&&campDe(a)==='adverse'&&!t.classList.contains('unseen')){"),'une fois, avant la révélation');}
/* v0.622 — Le bruit. Un adversaire qui ne voit pas un combattant l'entend si le chemin du son, plié aux angles des murs, tient
   dans la portée : 10 m pour des pas, 15 m pour un coup au contact, 20 m pour un cri ; un tir ne s'entend pas. Une porte close
   n'en laisse passer qu'une fois sur deux, et ainsi de suite. Celui qui entend porte un « ! » jusqu'à ce qu'il voie la troupe.
   Le bouton Crier, une fois entre deux combats ; un test de Ruse réussi rend discret 50, 100, puis 100 m de plus par réussite. */
{const K=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.deepEqual([K.BRUIT_PAS,K.BRUIT_PAS_PORTE,K.BRUIT_ATTAQUE,K.BRUIT_CRI],[5,10,15,20]);assert.deepEqual([0,1,2,3,4,-1,'x'].map(K.metresDiscretion),[0,50,100,200,300,0,0]);
 assert.ok(carto.includes("function terrainDuBruit(){")&&carto.includes("function traverseBruit(t,p,q){")&&carto.includes("function propageBruit(t,sources,R){")
  &&carto.includes("if(k+x<pr.K&&v+l<=pr.Rk[k+x?1:0])best=Math.max(best,Math.pow(.5,k+x))")&&carto.includes("proches.forEach(a=>{const c=chanceEntendre(t,pr,a);if(!(c>0))return;\n  if(unefois)a.ecoutes=[...(Array.isArray(a.ecoutes)?a.ecoutes:[]),qui.id].slice(-24);\n  if(Math.random()<c){a.entendu=Date.now();n++}});")
  &&carto.includes("return places.length?faisBruit(o,places,[BRUIT_PAS,BRUIT_PAS_PORTE],true):0}")&&carto.includes("try{computeFog();oublieEntendus();renderBeforeMaps();"),'le son, ses portes, ses pas');
 assert.ok(page.includes("if(!(r0&&r0.ranged)&&typeof faisBruit==='function')faisBruit(a,[{x:a.x,y:a.y}],BRUIT_ATTAQUE);")
  &&page.includes("if(skillNames[i]==='Ruse'&&a.hero&&jet.reussites>0)a.discret=metresDiscretion(jet.reussites);")
  &&page.includes("if(traces&&typeof bruitDePas==='function')lot.forEach((k,n)=>{const o=actors[k],tr=traces[n];if(o&&tr)bruitDePas(o,[...tr,{x:o.x,y:o.y}])});")
  &&page.includes("if(typeof bruitDePas==='function')bruitDePas(o,[depart,{x:o.x,y:o.y}]);const h=piegeAuPassage(o,depart);"),'coups, Ruse, pas à la main et imposés');
 assert.ok(page.includes('<button class="btn-action btn-crier rond" id="crier" hidden>📢</button>')&&page.includes(" if(typeof faisBruit==='function')faisBruit(a,[{x:a.x,y:a.y}],BRUIT_CRI);render();scheduleSave()};")
  &&page.includes("  actors.forEach(a=>{delete a.crie;delete a.entendu;delete a.ecoutes;delete a.analysesFaites})}")&&css.includes('button.btn-crier{--fond:#b9772c;color:#fff}'),'Crier, une fois entre deux combats');
 assert.ok(page.includes("if(a.entendu&&!a.vu&&campDe(a)==='adverse'&&!t.classList.contains('unseen')){const e=document.createElement('span');e.className='entendu'")&&css.includes('#pv-layer .entendu{')
  &&vif.includes("'tenuPar','entendu','discret','crie','ecoutes','connu','analysesFaites','debutTour','avantPiege'];"),'le « ! », sur toutes les tables');}
/* v0.621 — Happé par un piège toujours actif, un combattant y est tenu : il n'en sort qu'en l'enjambant, et un enjambement
   réussi le libère pour de bon. Le MJ l'en sort toujours à la main, même au sol, sans règle de mouvement ni point dépensé. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(carto.includes("function tenuParPiege(o){if(!o||!o.tenuPar)return null;")&&carto.includes("o.x=c.x;o.y=c.y;if(p.actif||p.enjambement)o.tenuPar=p.id}")
  &&carto.includes("p.id])].slice(-60);delete a.tenuPar}")&&vif.includes("'etatsPieges','tenuPar','entendu','discret','crie','ecoutes','connu','analysesFaites','debutTour','avantPiege'];"),'tenu par le piège, libéré par l’enjambement');
 assert.ok(page.includes(" return controlled(i)&&(view===\"mj\"&&tenu||!hasState(actors[i],'Au sol'))&&(view===\"mj\"||(!tenu&&!tokensLocked&&!hasState(actors[i],'Gel')))&&!gelDebut(actors[i])}")
  &&page.includes("const libere=view==='mj'&&typeof tenuParPiege==='function'&&!!tenuParPiege(a);")&&page.includes("   else if(!libere)lot.forEach(k=>{const o=actors[k];if(o)depensePoint(o,'mouvement')});")
  &&page.includes("   if(libere&&typeof tenuParPiege==='function')tenuParPiege(a);"),'le MJ l’en sort toujours');}
/* v0.620 — Un clic sur un piège lui parvient enfin : la carte ne capture plus le geste. Un joueur au contact d'un piège qu'il
   n'a qu'à enjamber lance le test d'un clic ; manqué, le piège part sur lui. La table mesure sa carte une fois par rendu, par
   pas de glissement et par image reçue, et non plus à chaque appel. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(page.includes("e.target.closest('#map-coffres')||e.target.closest('#map-pieges'))return;"),'le clic atteint le piège');
 assert.ok(carto.includes("if(!mj&&entrees.length===1&&p.enjambement&&entrees[0][0].startsWith('Enjamber')){entrees[0][1]();return}"),'un clic, le test d’enjambement');
 assert.ok(page.includes("function figeCadre(fn){if(cadreFige)return fn();cadreFige=mesureCadre();try{return fn()}finally{cadreFige=null}}")
  &&page.includes("function mapSize(){const r=cadreFige||$('map').getBoundingClientRect();return {width:r.width,height:r.height}}")
  &&page.includes(" {const pasBrut=t.onpointermove;t.onpointermove=e=>figeCadre(()=>pasBrut(e))}")&&page.includes("figeCadre(()=>document.querySelectorAll('#pv-layer .pv').forEach(j=>placeJauge(j)))")
  &&carto.includes(" applyMapRatio();const dehors=cadreFige;cadreFige=mesureCadre();")&&carto.includes("if(applyMapRatio()&&cadreFige)cadreFige=mesureCadre();")
  &&vif.includes("function glisseUneImage(){if(typeof figeCadre==='function'&&!cadreFige)return figeCadre(glisseUneImage);"),'la carte se mesure une fois');
 assert.ok(page.includes("function ajusteNomFiche(){if(nomAAjuster)return;nomAAjuster=requestAnimationFrame(")&&!page.includes("for(let f=25;f>=17&&n.scrollWidth>n.clientWidth;f--)"),'le nom se cale à l’image suivante');}
/* v0.619 — Les dégâts d'un piège, posé ou de coffre : fixes, ou « xdy », tirés à chaque fois qu'il part. */
{const K=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8');
 assert.deepEqual(K.lisFormuleDegats('2d6'),{degats:0,degatsDes:{n:2,f:6}});assert.deepEqual(K.lisFormuleDegats(' 3 '),{degats:3});assert.deepEqual(K.lisFormuleDegats('3d1'),{degats:3},'un dé d’une face, c’est un nombre');
 assert.equal(K.lisFormuleDegats('deux'),null);assert.deepEqual(K.lisFormuleDegats('40D200'),{degats:0,degatsDes:{n:20,f:100}});
 assert.equal(K.formuleDegats({degats:4}),'4');assert.equal(K.formuleDegats({degats:0,degatsDes:{n:1,f:8}}),'1d8');assert.equal(K.formuleDegats({}),'0');
 assert.deepEqual(K.tireDegats({degatsDes:{n:3,f:6}},()=>.5),{total:12,jets:[4,4,4]});assert.deepEqual(K.tireDegats({degats:5}),{total:5,jets:[]});
 assert.deepEqual(K.cleanPiege({id:'p',x:1,y:1,w:2,h:2,degatsDes:{n:2,f:8}}).degatsDes,{n:2,f:8});assert.ok(!('degatsDes' in K.cleanPiege({id:'p',x:1,y:1,w:2,h:2,degatsDes:{n:2,f:1}})));
 assert.deepEqual(K.cleanMap({coffres:[{id:'c',x:1,y:1,w:2,h:2,piege:2,degatsDes:{n:1,f:10}}]}).coffres[0].degatsDes,{n:1,f:10});
 assert.ok(carto.includes("const jet=tireDegats(p),deg=issue==='moitie'?Math.floor(jet.total/2):jet.total;")&&carto.includes("+field('Dégâts','degats',formuleDegats(p),'text','pattern=")
  &&carto.includes("+field('Dégâts du piège','degats',formuleDegats(c),'text','pattern=")&&carto.includes("const jet=tireDegats(c);"),'fixes ou aux dés, à la table et dans les fiches');}
/* v0.616 — Pièges : au contact, la victime est happée au centre du piège ; « Toujours actif », il ne se grise pas et ne se
   franchit qu'en l'enjambant ; un enjambement réussi vaut pour toujours. Les états d'un piège survivent au combat que son pas
   déclenche, et l'état d'un piège ne revient plus en arrière sur un écho du réseau. Le journal : plus de retrait d'inventaire,
   chaque nombre à la couleur de ce qu'il compte, « Le groupe gagne x XP ». Un rond de compétence lance son test en combat aussi.
   Tirs, sorts et orbes passent entre ceux de son camp. Blocage libre dans l'éditeur. La rareté Inhabituel, verte. */
{const K=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const p=K.cleanPiege({id:'f',x:1,y:1,w:4,h:4,actif:true});assert.equal(p.actif,true);assert.deepEqual(p.enjambement,{comp:0,reussites:1},'toujours actif, il s’enjambe');
 assert.equal(K.cleanPiege({id:'f',x:1,y:1,w:4,h:4}).actif,undefined);
 assert.equal(K.RARETES.map(([k])=>k).join(),'commun,inhabituel,rare,mystique,epique');assert.equal(K.rareteDe({rarete:'inhabituel'}),'inhabituel');assert.equal(K.NOM_RARETE('inhabituel'),'Inhabituel');
 assert.ok(css.includes('.cat-pill.r-inhabituel{background:#d9e7cd;')&&css.includes('.gear-detail.r-inhabituel{background:#d9e7cd;border-left-color:#4f8a52}')&&src.includes("rarete:{commun:100,inhabituel:125,"),'Inhabituel, au vert des potions');
 // Les nombres du journal.
 const ctx={};vm.createContext(ctx);vm.runInContext(page.match(/function genreNombre\(t,i,j\)\{[\s\S]*?\n return ''\}/)[0]+';this.g=(t,n)=>{const i=t.indexOf(n);return genreNombre(t,i,i+n.length)}',ctx);
 assert.equal(ctx.g('Le groupe gagne 9 XP (3 Kobolds).','9'),' j-tresor');assert.equal(ctx.g('Le groupe gagne 9 XP (3 Kobolds).','3'),'');
 assert.equal(ctx.g('Éla trouve 4 or.','4'),' j-tresor');assert.equal(ctx.g('2 éclats de rubis','2'),' j-tresor');assert.equal(ctx.g('4 orbes','4'),'');
 assert.equal(ctx.g('Kobold : 5/7 PV.','5'),' j-pv');assert.equal(ctx.g('Kobold : 5/7 PV.','7'),' j-pv');
 assert.equal(ctx.g('Éla · Ruse : 0 réussite','0'),' j-ko');assert.equal(ctx.g('Éla · Ruse : 2 réussites','2'),' j-ok');
 assert.equal(ctx.g('Piège — 3 dégâts','3'),' j-perte');assert.equal(ctx.g('−1 Agilité','1'),' j-perte');assert.equal(ctx.g('à 10 m','10'),'');
 assert.ok(page.includes(".j-num{font-weight:800;color:var(--ink)}.j-num.j-perte{color:#b4553a}.j-num.j-tresor{color:#9d7b1e}")&&page.includes("f.className='j-face '+(Number(v)>=6?'six':Number(v)>=4?'ok':'ko');")
  &&css.includes('.j-test .j-face.six{color:#3577b8}'),'les couleurs du journal');
 assert.ok(src.includes(" log('Le groupe gagne '+xp+' XP ('+listeNombree(vaincus.map(f=>f.name))+').');")&&!src.includes(' se défait de ')&&!src.includes(" reçoit et équipe "),'le journal sans l’inventaire');
 assert.ok(page.includes("  b.onclick=()=>{if(sansPA)return;testSkill(i)};")&&page.includes("const sansPA=enCombat()&&(actionPrise(a)||gelDebut(a));")&&css.includes('#skills .fouillee,#skills .sans-pa{'),'le rond de compétence, en combat aussi, grisé sans Action');
 assert.ok(page.includes("alive(o)&&!memeCamp(o,a)),size,token);return {ok:!blocked.length,ranged:true,"),'la ligne de vue passe entre ceux de son camp');
 assert.ok(carto.includes('<button data-tool="blocagelibre">Blocage libre</button>')&&carto.includes("else if(mode==='blocagelibre')ajouteMatiere(mapDraft,forme);")
  &&carto.includes("if(mapTool==='lasso'||mapTool==='blocagelibre'||"),'le blocage libre');
 // Les pièges.
 assert.ok(carto.includes(" if(!p.actif)p.declenche=true;if(p.cache)p.revele=true;")&&carto.includes("const depuis=contact&&issue!=='esquive'?{x:o.x,y:o.y}:null;if(depuis){const c=centrePiege(p);o.avantPiege={x:depuis.x,y:depuis.y};o.x=c.x;o.y=c.y;if(p.actif||p.enjambement)o.tenuPar=p.id}")
  &&carto.includes(" floatNumber(o,'Piège !','perte');if(issue==='esquive')setTimeout(()=>floatNumber(o,'Esquive !','gain'),650);")
  &&carto.indexOf(" log('Piège ! '+p.nom+' se déclenche sur '")<carto.indexOf(" if(essai)log(essai,{dice:true,ton:'competence'});")
  &&carto.includes("contact:touchePiege(p,c,r,size)==='contact'}}")&&carto.includes("armes=m.pieges.filter(p=>piegeArme(p)&&!franchis.includes(p.id))")
  &&carto.includes("if(ok){a.franchis=[...new Set([...(Array.isArray(a.franchis)?a.franchis:[]),p.id])].slice(-60);delete a.tenuPar}")&&carto.includes("coche('actif','Toujours actif',!!p.actif)"),'happé, toujours actif, enjambé pour toujours');
 assert.ok(carto.includes("if(etats.length&&!enCombat())o.etatsPieges=")&&page.includes("if(commence&&!spect)actors.forEach(a=>{leveEtats(a,true,a.etatsPieges);a.ignition=''});"),'les états d’un piège passent le début du combat');
 const ctxL={statesOf:a=>a.states.slice(),setState:(a,e,on)=>{if(!on)a.states=a.states.filter(x=>x!==e)}};vm.createContext(ctxL);vm.runInContext(page.match(/function leveEtats\(a,finCombat,garder\)\{[^\n]*\n[^\n]*/)[0]+';this.leveEtats=leveEtats',ctxL);
 const h={states:['Saignée','Feu'],etatsPieges:['Saignée']};assert.equal(ctxL.leveEtats(h,true,h.etatsPieges).join(),'Feu');assert.equal(h.states.join(),'Saignée');assert.ok(!('etatsPieges' in h));
 assert.ok(vif.includes("'malusPieges','enjambe','franchis','etatsPieges','tenuPar','entendu','discret','crie','ecoutes','connu','analysesFaites','debutTour','avantPiege'];")&&vif.includes("if(r&&(Number(r.e)||0)===e&&drapeauxPiege(p)!==e){gardesPieges.push([v.t,e]);return}")
  &&vif.includes("gardesPieges.forEach(([t,e])=>{const x=(base.doors||[]).find(y=>y&&typeof y==='object'&&y.t===t);if(x)x.e=e});"),'l’état d’un piège ne revient pas en arrière');}
/* v0.615 — Pièges : un outil de l'éditeur de cartes. Un piège de toute taille, en jeton, en jeton imagé ou en image seule ;
   visible ou caché ; déclenché au contact ou à distance par une zone ou un fil liés ; détecté par Perception ou Ruse ;
   désamorçable, évitable, enjambable ; dégâts, états et pertes de caractéristique, permanentes ou jusqu'au repos ;
   grisé une fois déclenché ou désamorcé, réamorçable avec le talent Réamorceur. */
{const K=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),src=fs.readFileSync('editor.js','utf8');
 const p=K.cleanPiege({id:'p1',x:10,y:10,w:5,h:5,detection:{comp:1,reussites:0},desamorcage:{comp:2,reussites:3},evitement:{comp:0,reussites:2,issue:'moitie'},
  declencheurs:[{id:'f',type:'fil',x1:1,y1:1,x2:1,y2:1},{id:'f2',type:'fil',x1:1,y1:1,x2:5,y2:1},{id:'z',type:'zone',x:2,y:2,w:3,h:3}],degats:'4',etats:['Saignée','zzz'],caracs:[{carac:'comp',comp:'0',valeur:1,duree:'repos'}]});
 assert.equal(p.affichage,'jeton');assert.equal(p.contact,true);assert.equal(p.nom,'Piège');assert.equal(p.cache,undefined);
 assert.deepEqual(p.detection,{comp:3,reussites:1},'une détection hors Perception et Ruse revient à Perception');
 assert.deepEqual(p.desamorcage,{comp:5,reussites:3},'un désamorçage hors Ruse, Technique et Force revient à Ruse');
 assert.deepEqual(p.evitement,{comp:0,reussites:2,issue:'moitie'});assert.equal(p.enjambement,undefined);
 assert.deepEqual(p.declencheurs.map(d=>d.type),['fil','zone'],'un fil sans longueur tombe');assert.equal(p.degats,4);assert.deepEqual(p.etats,['Saignée']);
 assert.equal(K.cleanPiege({x:1,y:1,w:2,h:2,affichage:'image',contact:false,cache:true,reamorcable:true,image:'javascript:x'}).image,undefined,'une image douteuse tombe');
 assert.deepEqual(K.cleanPertes([{carac:'zzz',valeur:500,duree:'x'}]),[{carac:'pv',valeur:99,comp:'0',duree:'perm'}]);
 assert.equal(K.cleanMap({pieges:[{x:1,y:1,w:2,h:2},null]}).pieges.length,1);assert.deepEqual(K.cleanMap({}).pieges,[]);
 const a={vie:6,endu:3,talents:[],malusPieges:[{carac:'comp',comp:'0',valeur:1,duree:'repos'},{carac:'vie',valeur:1,duree:'perm'}]};
 assert.deepEqual(K.bonusDe(a,[]),{pv:0,endu:0,vie:-1,def:0,dmg:0,skills:[-1,0,0,0,0,0,0,0]},'les pertes se retranchent de la fiche');
 assert.equal(K.vieDe(a,[]),5);assert.deepEqual(K.malusDe({}),[]);assert.ok(K.TALENT_CODES?K.TALENT_CODES.reamorcage:fs.readFileSync('combat.js','utf8').includes("reamorcage:{cle:'reamorcage',nom:'Réamorceur',type:'pass',"),'le talent Réamorceur');
 assert.ok(carto.includes('<button data-tool="piege">Piège</button>')&&carto.includes('function openPiege(i){')&&carto.includes('function declencheursEl(i,p){')
  &&carto.includes('function piegeAuPassage(o,de){')&&carto.includes('function declenchePiege(p,o,contact){')&&carto.includes('function renderPieges(){')
  &&carto.includes("diffuserEffet('piegecarte',o,null,String(m.pieges.indexOf(p)));"),'les pièges dans l’éditeur et à la table');
 assert.ok(page.includes("function piegeApresMouvement(o,depart){")&&(page.match(/const piege=piegeApresMouvement\([ab],depart\);compteDistance/g)||[]).length===4
  &&page.includes("const piegeClavier=typeof piegeAuPassage==='function'?piegeAuPassage(a,{x:x0,y:y0}):null;"),'chaque mouvement s’arrête au piège');
 assert.ok(vif.includes("...(m.pieges||[]).map(p=>({t:p.id,e:drapeauxPiege(p)}))]")
  &&vif.includes("else if(rec.effet==='piegecarte'&&typeof explosionPiege==='function')"),'l’état des pièges voyage');
 assert.ok(src.includes("a.malusPieges=a.malusPieges.filter(b=>b&&b.duree!=='repos');"),'un repos efface les pertes temporaires');}
/* v0.614 — Retirer de l'inventaire un objet en plusieurs exemplaires : on choisit combien, ou tout. Les bulles des boutons de la
   carte : le nom, comme pour un talent, puis une phrase qui suit l'état du bouton. Chez le MJ, un champ que le document de la
   table ne porte pas encore — l'XP — part au prochain envoi : une XP remise à zéro arrive chez les joueurs. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),src=fs.readFileSync('editor.js','utf8');
 assert.ok(page.includes("function demanderNombre(texte,max,ok){")&&page.includes("$('combien-tout').onclick=()=>fin(max);$('combien-oui').onclick=()=>fin(lu());")
  &&src.includes("if(reste>1&&typeof demanderNombre==='function')n=await demanderNombre(question,reste,'Retirer');")&&src.includes("if(!n)return;for(let k=0;k<n;k++)retirerInventaire(a,o);"),'combien retirer, ou tout');
 assert.ok(carto.includes("'distances-vue':()=>['Distances',(distancesOn?'Masque':'Affiche')+' les distances sur les flèches de ciblage.'],")
  &&carto.includes("d.className='talent-detail large bulle-etat bulle-bouton-texte';")&&carto.includes("t.className='talent-bulle-nom'")
  &&carto.includes("if(b&&b===boutonSurvole)requestAnimationFrame(()=>{if(b===boutonSurvole)bulleBouton(b)})"),'la bulle d’un bouton : son nom, puis ce qu’il fait');
 assert.ok(vif.indexOf("const change=complet||JSON.stringify(base)!==avant;")<vif.indexOf("CHAMPS_VIVANTS.forEach(k=>{if(recu[k]===undefined&&e[k]!==undefined)delete e[k]})")
  &&vif.includes("if(estMJ())Object.entries(base.actors).forEach(([id,e])=>{const recu=d.actors&&d.actors[id];if(!recu){delete base.actors[id];return}"),'ce que le document ne porte pas encore part du MJ');}
/* v0.613 — La barre de la carte : les bascules de vue en icônes seules, de la taille des autres ; le zoom à droite ; chaque bouton
   dit ce qu'il fait dès le survol, dans une bulle du site, et sa bulle suit son état. */
{const carto=fs.readFileSync('maps.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(['id="portees">◎</button>','id="fouilles-vue">🔍</button>','id="distances-vue">📏</button>','id="coffres-bulles" hidden>🧰</button>'].every(s=>page.includes(s))
  &&!page.includes('.toggle-portees{font:600 13px system-ui'),'les bascules en icônes seules');
 assert.ok(carto.includes("document.querySelector('.mapbar .zoom-bar').before(fogBar);")&&page.includes('.mapbar-h1 .zoom-bar{margin-left:auto}')&&page.includes('#fog-bar{margin-left:auto}'),'le zoom tout à droite');
 assert.ok(carto.includes("function bulleBouton(b){let nom='',dit=texteBouton(b);")&&carto.includes("ouvrirBulle(b,d,'bulle-talent bulle-bouton')")
  &&carto.includes(".observe(barreCarte,{subtree:true,attributes:true,attributeFilter:['title']});")&&carto.includes("if(e.pointerType==='touch')return;")
  &&page.includes('<button id="zoom-reset" title="Ajuster la carte au cadre">Ajuster</button>')&&css.includes('.bulle-bouton .talent-detail.bulle-bouton-texte{'),'les bulles des boutons de la carte');}
/* v0.612 — Un bouton du MJ, sur la barre de la carte, active ou désactive l'obscurité de la carte pour toute la table. Ce que
   l'onglet Aventuriers règle voyage dans les deux sens : XP, niveau, compétences, VIE, Endurance, espèce ; et l'onglet
   Aventuriers comme l'arbre de talents ouverts se redessinent sur ce qui arrive, sans couper une saisie ni un glissement. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 assert.ok(carto.includes("function carteObscure(){const m=currentMap();return !!m&&!m.obscuriteOff&&obscuriteDe(m).length>0}")
  &&carto.includes("const noirBtn=icone('obscurite-bascule','🌑','Désactiver l’obscurité');")
  &&carto.includes("noirBtn.onclick=()=>{const m=currentMap();if(!m)return;if(m.obscuriteOff)delete m.obscuriteOff;else m.obscuriteOff=true;")
  &&carto.includes(" noirBtn.hidden=!m||!obscuriteDe(m).length;"),'le bouton de l’obscurité');
 assert.ok(vif.includes("...(m&&m.obscuriteOff?{noirOff:true}:{}),")&&vif.includes("const off=d.fogReset.noirOff===true;"),'l’obscurité désactivée voyage avec la remise du brouillard, sans clé nouvelle');
 assert.ok(["'xp'","'level'","'skills'","'endu'","'vieMax'","'pvBonus'","'sexe'","'race'"].every(k=>vif.slice(vif.indexOf('const CHAMPS_VIVANTS='),vif.indexOf('const CHAMPS_MJ=')).includes(k)),'les réglages de l’onglet Aventuriers voyagent');
 assert.ok(vif.includes("if(change){render();rafraichitFiches()}")&&vif.includes("if(document.body.classList.contains('page-heroes')&&typeof renderHeroes==='function')renderHeroes();")
  &&vif.includes("if(typeof arbresDialog!=='undefined'&&arbresDialog.open&&typeof renderArbres==='function')renderArbres()")
  &&vif.includes("if(pressionTenue||(typeof champsOuverts!=='undefined'&&champsOuverts>0)||(typeof arbreGlisse!=='undefined'&&arbreGlisse)){fichesTimer=setTimeout(encore,250);return}"),'les fiches ouvertes suivent, sans couper un geste');
 assert.ok(vif.includes("scheduleSave=function(){scheduleSaveAvantTable.apply(this,arguments);pousserPlusTard()};"),'ce qui s’enregistre part en ligne');}
/* v0.611 — Un adversaire qui possède deux armes de contact à une main, ou plus, les manie ensemble : une seule attaque, dés
   cumulés, « Dague ×2 » ou « Dague + Épée ». Les exemplaires se comptent dans son inventaire. */
{const C=require('./combat.js'),A=[{id:'dg',name:'Dague',category:'weapon',hands:1,dice:{white:1}},{id:'ep',name:'Épée',category:'weapon',hands:1,dice:{red:1}},
  {id:'ma',name:'Massue',category:'weapon',hands:2,dice:{black:1}},{id:'ar',name:'Arc',category:'weapon',ranged:true,dice:{white:1}}];
 const noms=a=>C.attackChoices({hero:false,attacks:[],...a},A).map(x=>x.name);
 assert.deepEqual(noms({weapons:['dg'],inventaire:['dg','dg']}),['Dague ×2'],'deux dagues, une attaque');
 assert.equal(C.chosenAttack({hero:false,weapons:['dg'],inventaire:['dg','dg'],attacks:[]},A).dice.white,2,'deux dés blancs');
 assert.deepEqual(noms({weapons:['dg'],inventaire:['dg']}),['Dague'],'une seule dague, rien ne change');
 assert.deepEqual(noms({weapons:['dg','ep'],inventaire:['dg','ep','dg']}),['Dague ×2','Épée'],'une troisième garde sa variante');
 assert.deepEqual(noms({weapons:['ma','dg','ep','ar'],inventaire:['ma','dg','ep','ar']}),['Massue','Dague + Épée','Arc'],'deux mains et distance à part');
 assert.deepEqual(noms({weapons:['ma','ar'],inventaire:['ma','ar']}),['Massue','Arc'],'sans deux armes à une main, comme avant');}
/* v0.610 — Le logo du token, en grand à gauche du nom dans la fiche de la table : hors du flux, il ne grandit pas la ligne et
   ne pousse rien ; le nom reste sur sa ligne et rapetisse s'il est trop long. */
assert.ok(page.includes('<div class="sheet-head"><span class="avatar sheet-logo" id="sheet-logo" hidden></span><h1 id="name"></h1>')
 &&page.includes(".sheet-head{position:relative}.sheet-head .sheet-logo{position:absolute;left:0;top:50%;width:52px;height:52px;margin-top:-26px;")
 &&page.includes(".sheet.a-logo .sheet-head h1{flex:0 1 auto;min-width:0;line-height:39px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}")
 &&page.includes("lg.style.borderColor=lg.style.color=teinte;lg.hidden=false;$('sheet').classList.add('a-logo')}")
 &&page.includes("$('sheet').classList.remove('regard','secret','a-logo');$('sheet-logo').hidden=true;"),'le logo du token dans la fiche');
/* v0.609 — Un même adversaire ne frappe qu'une fois d'opportunité par tour, même si l'on entre et sort plusieurs fois de son
   contact. Le début et la fin du combat s'annoncent chez les joueurs connectés ; le journal ne redit plus « Tour 1. ». Une
   fiche d'aventurier seule prend la place. Le MJ envoie toute la troupe sur l'onglet ouvert, d'un viseur sous l'onglet ; et
   choisit la Page d'Accueil des joueurs, où ils arrivent en début de session. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),part=fs.readFileSync('shared.js','utf8');
 assert.ok(page.includes("function opportunitesDuTour(a){const o=a&&a.opportunitesSubies;return o&&o.tour===round&&Array.isArray(o.ids)?o.ids:[]}")
  &&page.includes("const deja=opportunitesDuTour(a);if(e.id&&deja.includes(e.id))return;if(e.id)a.opportunitesSubies={tour:round,ids:[...deja,e.id]};")
  &&vif.includes("'mvtReste','mvtTour','opportunitesSubies',"),'une opportunité par adversaire et par tour, retenue en ligne');
 {const ctxO={round:3};vm.createContext(ctxO);vm.runInContext(page.slice(page.indexOf('function opportunitesDuTour('),page.indexOf('function degatsOpportunite(')),ctxO);
  assert.deepEqual([...ctxO.opportunitesDuTour({opportunitesSubies:{tour:3,ids:['g']}})],['g']);assert.equal(ctxO.opportunitesDuTour({opportunitesSubies:{tour:2,ids:['g']}}).length,0,'un nouveau tour rend le coup')}
 assert.ok(page.includes("log(enCombat()?'⚔ Le combat commence.':bilan?'Fin du combat :':'Fin du combat.',bilan?{bilan}:undefined);")&&!page.includes("Le combat commence. Tour 1."),'le journal ne redit plus Tour 1');
 assert.ok(vif.includes("if(modeConnu&&avant!==mode&&typeof annonceFlottante==='function')annonceFlottante(mode==='combat'?'⚔ Début du combat !':'🕊 Fin du combat');modeConnu=true}")
  &&vif.includes(" modeConnu=ongletConnu=false;ongletVu=null;envoiOnglet=null;"),'le combat qui commence ou finit s’annonce chez les joueurs');
 assert.ok(src.includes(" grille.classList.toggle('une-fiche',heros.length===1);")&&css.includes(".hero-grid.une-fiche{grid-template-columns:minmax(0,880px)!important}"),'une fiche seule prend la place');
 assert.ok(vif.includes("function envoyerOnglet(p){if(!estMJ()||!enLigne||!p)return;envoiOnglet={page:String(p),pn:Date.now()};pousserPlusTard()}")
  &&vif.includes("if(ongletConnu&&pn!==null&&pn!==ongletVu&&typeof showPage==='function')showPage(String(d.fogReset.page||'table'));ongletVu=pn;ongletConnu=true}")
  &&carto.includes("const montre=!!b&&view==='mj'&&typeof estMJ==='function'&&estMJ()&&typeof enLigne!=='undefined'&&enLigne&&ongletsJoueurs().includes(p);")
  &&carto.includes("tabs.querySelectorAll('button[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));"),'le viseur du MJ envoie la troupe sur l’onglet');
 assert.ok(src.includes("if(typeof c.pageAccueil!=='string'||!ONGLETS.some(([k])=>k===c.pageAccueil)||c.pageAccueil==='maps')delete c.pageAccueil;")
  &&src.includes("accueilAFaire=!sessionStorage.getItem('amertume-session');")&&src.includes("if(typeof admin!=='undefined'&&admin)return;const p=cat.pageAccueil;")
  &&part.includes(" if(typeof accueilDeSession==='function')accueilDeSession()}")&&src.includes("Page d’Accueil : <select id=\"page-accueil\"></select>"),'la Page d’Accueil des joueurs');}
/* v0.608 — La table en ligne, vue des joueurs. Une carte neuve approche chaque joueur de son aventurier ; la vue ne bouge pas
   quand la carte est masquée ; un bouton Centrer. Les mots flottants voyagent avec le journal, sauf les refus, et un socle
   caché ne parle pas chez un joueur. Les socles reçus glissent, position vraie gardée pour l'envoi. Sans filtre de canevas
   (Safari), le noir et le brouillard se floutent à la main. Un joueur assis ne voit que son aventurier ; la sauvegarde
   globale est au MJ. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),src=fs.readFileSync('editor.js','utf8');
 assert.ok(page.includes("function applyMapZoom(){const m=$('map'),w=m.clientWidth,h=m.clientHeight;if(!w||!h)return;")
  &&page.includes("function centrerSurSelection(){")&&page.includes('<button id="zoom-centre" title="Centrer sur le token sélectionné"')
  &&page.includes("if(!w||!h){approcheEnAttente=a.id;return}")&&carto.includes("  if(typeof approcheEnAttente!=='undefined'&&approcheEnAttente){"),'la vue de la carte : gardée, centrée, approchée au retour');
 assert.ok(vif.includes("if(carteNeuve&&typeof resetMapZoom==='function')setTimeout(resetMapZoom,0);")&&page.includes(" $('map-view').style.transform='translate(0px,0px) scale(1)';$('zoom-label').textContent='100 %';applyMapZoom()}"),'une carte neuve se montre toute entière, à 100 %, partout');
 assert.ok(vif.includes("floatNumber=function(cible,texte,genre,seul){floatNumberLocal(cible,texte,genre);")&&vif.includes("  else if(rec.effet==='flottant')flottantRecu(rec);")
  &&vif.includes("if(!el||el.hidden||['unseen','veiled','hors-carte','cachemj'].some(c=>el.classList.contains(c)))return}")
  &&page.includes("floatNumber(a,'Plus de Mouvement','nul',true)")&&carto.includes("floatNumber(a,'Action déjà dépensée','nul',true)"),'les mots flottants partagés, les refus gardés');
 assert.ok(vif.includes("const GLISSE_RETARD=220,glissements=new Map();")&&vif.includes("  if(glissements.has(a.id)){const v=glissements.get(a.id).cible;e.x=v.x;e.y=v.y}")
  &&vif.indexOf("aGlisser.forEach(a=>{const e=d.actors[a.id];glisseVers(a,e.x,e.y)});")<vif.indexOf("  base=etatVivant();\n  const change=complet"),'les socles reçus glissent, la vraie position repart');
 assert.ok(src.includes("const troupe=actors.filter(a=>a.hero&&(!assis||a.id===siege));")&&src.includes(" $('bloc-sauvegarde-globale').hidden=view!=='mj';"),'un joueur assis : son aventurier seul, pas de sauvegarde globale');
 // Le flou à la main : une marche devient une pente, et l'encre ne se perd pas.
 const ctxF={};vm.createContext(ctxF);vm.runInContext(carto.slice(carto.indexOf('function boiteFlou('),carto.indexOf('// Dessine « src » flouté')),ctxF);
 const w=40,h=3,a=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=20;x<w;x++)a[y*w+x]=255;const total=a.reduce((s,v)=>s+v,0);
 ctxF.boiteFlou(a,w,h,2);ctxF.boiteFlou(a,w,h,2);ctxF.boiteFlou(a,w,h,2);const ligne=[...a.slice(w,2*w)];
 assert.ok(ligne.filter(v=>v>5&&v<250).length>=6&&ligne.every((v,i)=>!i||v>=ligne[i-1]-1e-3),'une pente régulière');assert.ok(Math.abs(a.reduce((s,v)=>s+v,0)-total)/total<.02,'l’encre se garde');}
/* v0.607 — À droite des bottes, dans le schéma d'équipement de l'aventurier, sa distance de mouvement, objets compris. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("if(cle==='bottes'&&a.hero){const m=document.createElement('span');m.className='mouvement-corps';")
  &&src.includes("e.textContent='Mouvement\\u00a0: ';")&&src.includes("v.textContent=String(+distanceMouvement(a,catalog.items||[]).toFixed(1)).replace('.',',')+'\\u00a0m';")
  &&css.includes(".corps-sac>.corps .mouvement-corps{top:12px;height:50px;left:calc(50% + 31px)}"),'la distance de mouvement à droite des bottes');}
/* v0.604 — Le mouvement se compte sur le chemin parcouru, et un point de Mouvement donne la distance de mouvement à dépenser
   par à-coups pendant le tour : ce reste voyage en ligne et s'efface au tour suivant. Une lumière éteinte reste sur la carte,
   grisée, et le MJ la rallume ; prise, elle n'est plus là. Le feu éclaire sur quatre mètres : l'état Feu, un orbe de feu posé,
   un mur de feu tout du long. Rapide est désactivé. */
{const carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(vif.includes("'orbeStatique','nyctalope','mouvement','mvtReste','mvtTour',"),'le reste du mouvement voyage en ligne');
 assert.ok(page.includes("delete a.revanche;delete a.traction;delete a.bondissement;delete a.decoupe;delete a.impulsion;delete a.coupureFatale;delete a.adieu;delete a.mvtReste;delete a.mvtTour;delete a.opportunitesSubies;mouvementRapide(a)});")&&page.includes("actors.forEach(a=>{a.checks=[0,0,0];delete a.mvtReste;delete a.mvtTour;"),'un nouveau tour l’efface');
 assert.ok(page.includes("   if(drag.regle&&!appliqueRegleMouvement(a,drag.regle))jusquALaBorne(a,drag.regle,g,(x,y)=>moveActor(a,x,y,view==='mj',enMain,true))}")
  &&page.includes("fleche.setAttribute('d','M'+pts.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L'));"),'la main va jusqu’à la limite, la flèche suit le chemin');
 assert.equal(C.TALENTS_CODES.rapide.retire,true,'Rapide retiré de la bibliothèque');
 assert.ok(page.includes("function mouvementRapide(a){if(!a)return;a.mvtBonus=0;a.paBonus=0}"),"Rapide ne donne plus rien");
 assert.equal(C.cleanLumiere({id:'l',nom:'T',x:1,y:2,rayon:3,eteinte:true,prise:true}).prise,true);assert.equal(C.cleanLumiere({id:'l',x:1,y:2,rayon:3,prise:'x'}).prise,undefined);
 assert.ok(carto.includes(" (m.lumieres||[]).forEach(l=>{if(!l||l.prise)return;")&&css.includes(".token.lumiere.eteinte{")&&carto.includes("delete copie.eteinte;delete copie.prise;"),'éteinte, grisée ; prise, absente');
 assert.ok(carto.includes("const LUMIERE_FEU=4;")&&carto.includes("const feu=hasState(a,'Feu')||(a.orbeStatique&&a.orbeStatique.etat==='Feu')?LUMIERE_FEU:0;")
  &&carto.includes("mursEnJeu().forEach(([,mur])=>{if(String(mur.etat)!=='Feu')return;"),'le feu éclaire');
 // v0.605 — À découvert, la ligne droite du départ au socle, quel que soit le geste ; un mur contourné la plie à son angle.
 const regle=page.slice(page.indexOf('let mouvementClavier=null;'),page.indexOf('function contactsDe(a)'));
 const cx={round:1,performance:{now:()=>1e6},nomNum:a=>a.name,currentMap:()=>null,enCombat:()=>true,items:()=>[],tokenPx:()=>10,mapSize:()=>({width:1000,height:1000}),distanceMouvement:()=>99,
  wallsInPixels:()=>cx.murs||[],obstaclesDuPas:()=>cx.murs||[],segmentHitsPolys:C.segmentHitsPolys,contoursOf:C.contoursOf,shapeContains:C.shapeContains,pointsUses:()=>0,pointsRestants:()=>1,zoneDe:()=>1,floatNumber(){},log(){}};vm.createContext(cx);vm.runInContext(regle,cx);
 const geste=(pts,o=[20,20])=>{const g={x:o[0],y:o[1]},r=cx.regleMouvement(g);for(const [x,y] of pts){g.x=o[0]+x;g.y=o[1]+y;cx.appliqueRegleMouvement(g,r)}cx.dernier=r;return r.long/10};
 const ligne=(a,b,pas)=>{const o=[],n=Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/pas);for(let k=1;k<=n;k++)o.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);return o};
 [[.125,.0833],[.2,.05],[.3,.02],[.05,.3]].forEach(([u,v])=>assert.ok(Math.abs(geste([...ligne([0,0],[3,0],u),...ligne([3,0],[1,0],v)])-1)<.01,'aller-retour '+u+'/'+v));
 assert.ok(Math.abs(geste([...ligne([0,0],[3,0],.1),...ligne([3,0],[3,3],.1)])-Math.hypot(3,3))<.01,'un L : la ligne droite');
 assert.ok(Math.abs(geste([...ligne([0,0],[3,0],.1),...ligne([3,0],[3,2],.1),...ligne([3,2],[0,2],.1)])-2)<.01,'un U : la ligne droite');
 assert.ok(geste(Array.from({length:120},(_,k)=>[2*Math.sin(k/120*2*Math.PI),2-2*Math.cos(k/120*2*Math.PI)]))<.3,'un tour complet : presque rien');
 // Le schéma : parti de (20,80), il monte au coin du mur (40,30) puis tourne à droite ; la ligne se plie à l'angle.
 cx.murs=[{contours:[[[400,300],[700,300],[700,900],[400,900]]]}];
 const coin=geste([...ligne([0,0],[17,-48],.3),...ligne([17,-48],[18,-52],.3),...ligne([18,-52],[30,-56],.3),...ligne([30,-56],[40,-60],.3)],[20,80]);
 assert.ok(Math.abs(coin-(Math.hypot(200,500)+Math.hypot(200,100))/10)<.01&&cx.dernier.chemin.length===3,'plié à l’angle du mur : '+coin);
 const deplie=geste([...ligne([0,0],[17,-48],.3),...ligne([17,-48],[18,-52],.3),...ligne([18,-52],[30,-56],.3),...ligne([30,-56],[16,-54],.3)],[20,80]);
 assert.ok(Math.abs(deplie-Math.hypot(160,540)/10)<.01&&cx.dernier.chemin.length===2,'revenu en vue du départ, la ligne se déplie');
 // Un pilier contourné par le bas : deux plis, un à chaque angle.
 cx.murs=[{contours:[[[450,200],[550,200],[550,600],[450,600]]]}];
 const pilier=geste([...ligne([0,0],[10,14],.3),...ligne([10,14],[30,16],.3),...ligne([30,16],[50,14],.3),...ligne([50,14],[60,0],.3)],[20,50]);
 assert.ok(Math.abs(pilier-(Math.hypot(250,100)*2+100)/10)<.01&&cx.dernier.chemin.length===4,'autour du pilier : '+pilier);
 /* v0.606 — Un mur tracé à la main : une face gauche toute en bosses, une encoche, posés de biais. Le plus court chemin
    longe la face par ses bosses saillantes, ne plonge jamais dans l'encoche ni dans la matière, et se plie au coin du bas ;
    un segment posé sur un bord ne le coupe pas, malgré les arrondis. */
 const face=[];for(let k=0;k<=60;k++){const s=k/60,y=300+s*500,x=400+Math.sin(s*37)*6+(y>520&&y<640?60*Math.sin((y-520)/120*Math.PI):0);face.push([x,y])}
 const forme=[...face,[800,800],[800,300]];cx.murs=[{contours:[forme]}];
 const main=geste([...ligne([0,0],[6,10],.3),...ligne([6,10],[7,35],.3),...ligne([7,35],[7,60],.3),...ligne([7,60],[9,66],.3),...ligne([9,66],[20,66],.3)],[30,20]);
 const plis=cx.dernier.chemin.slice(1,-1);
 assert.ok(main<75&&plis.length>=1&&plis.every(p=>p[0]<=400&&!C.shapeContains({contours:[forme]},[p[0]-.5,p[1]])),'le long de la face, au coin du bas : '+main+' '+JSON.stringify(plis));
 // Le long d'un bord, un point de la ligne est sur la matière à un arrondi près : il compte comme dehors.
 const auBord=q=>forme.some((u,i)=>{const v=forme[(i+1)%forme.length],dx=v[0]-u[0],dy=v[1]-u[1],l=dx*dx+dy*dy,s=l?Math.max(0,Math.min(1,((q[0]-u[0])*dx+(q[1]-u[1])*dy)/l)):0;return Math.hypot(q[0]-u[0]-dx*s,q[1]-u[1]-dy*s)<.5});
 const tout=cx.dernier.chemin;for(let i=1;i<tout.length;i++)for(let k=1;k<20;k++){const q=[tout[i-1][0]+(tout[i][0]-tout[i-1][0])*k/20,tout[i-1][1]+(tout[i][1]-tout[i-1][1])*k/20];
  assert.ok(!C.shapeContains({contours:[forme]},q)||auBord(q),'la ligne ne traverse pas la matière')}
 cx.murs=null;}
/* v0.603 — Le mouvement limité. Neuf mètres pour tous, une autre distance par créature au bestiaire, et les objets cochés
   « Bonus de Mouvement » l'allongent pour qui les porte. Du « Révélé » à la fin du combat, chaque mouvement coûte un point
   et ne va pas plus loin que cette distance ; une flèche le suit, du départ à l'arrivée. Le MJ peut l'imposer aux
   aventuriers en exploration. Il déplace aussi à la main les objets posés au sol. */
{const src=fs.readFileSync('editor.js','utf8'),ia=fs.readFileSync('ia.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),vif=fs.readFileSync('live.js','utf8');
 const items=[{id:'b',name:'Bottes',category:'armor',bonusMouvement:3},{id:'p',name:'Plume',category:'object',bonusMouvement:1.5},{id:'t',name:'Torche',category:'object',lumiere:4}];
 assert.equal(C.DISTANCE_MOUVEMENT,9);
 assert.equal(C.distanceMouvement({hero:true,inventaire:['b','p'],armures:[]},items),10.5,'une armure non portée ne compte pas');
 assert.equal(C.distanceMouvement({hero:true,inventaire:['b','p'],armures:['b']},items),13.5);
 assert.equal(C.distanceMouvement({hero:false,mouvement:6,inventaire:['b']},items),9,'sa distance au bestiaire, plus ce qu’il porte');
 assert.equal(C.distanceMouvement({hero:true,mouvement:4},[]),9,'un aventurier part de neuf mètres');
 assert.deepEqual([C.bonusMouvementDe({bonusMouvement:99}),C.bonusMouvementDe({}),C.bonusMouvementDe({bonusMouvement:-2})],[40,0,0]);
 assert.equal(C.objetsLumineux({hero:true,inventaire:['t','b'],weapons:[]},items).map(o=>o.id).join(','),'t','les lumières, comme avant');
 assert.equal(C.cleanMonster({name:'A',mouvement:12}).mouvement,12);assert.equal(C.cleanMonster({name:'A',mouvement:9}).mouvement,undefined);assert.equal(C.cleanMonster({name:'A',mouvement:null}).mouvement,undefined);
 assert.ok(src.includes("field('Mouvement (m)','mouvement',mouvementPropre(a),'number','min=\"0\" max=\"99\" step=\"0.5\"')")
  &&src.includes("if(f.mouvement&&!a.hero){const v=Number(f.mouvement.value);if(!Number.isFinite(v)||v===DISTANCE_MOUVEMENT)delete a.mouvement;"),'la distance au bestiaire');
 assert.ok(src.includes(">Bonus de Mouvement</label>'+field('Bonus (m)','bonusMouvement',")&&src.includes("o.bonusMouvement=bonusMouvementDe(o);if(!o.bonusMouvement)delete o.bonusMouvement;")
  &&src.includes("if(f.bonusMouvementOn){if(f.bonusMouvementOn.checked)a.bonusMouvement="),'la case Bonus de Mouvement des objets');
 assert.ok(vif.includes("'nyctalope','mouvement',")&&vif.includes("...(typeof mouvementLimiteExplo!=='undefined'&&mouvementLimiteExplo?{limite:true}:{}),\n  ...(envoiOnglet?{page:envoiOnglet.page,pn:envoiOnglet.pn}:{}),...(m&&m.obscuriteOff?{noirOff:true}:{}),")
  &&vif.includes("mouvementLimiteExplo=d.fogReset.limite===true;"),'la distance et la limite voyagent en ligne, sans clé nouvelle');
 assert.ok(page.includes("const regle=lot0.length===1&&!libere&&mouvementBorne(a)?regleMouvement(a):null;")&&page.includes("traceMouvement(null);\n  if(bloque){if(moved)skipClick=true;return}")
  &&page.includes(" t.onpointercancel=()=>{gesteActif=null;drag=null;window.socleEnMain=null;traceMouvement(null)};")&&page.includes("   if(regle&&regle.combat){if(cout>0)depensePoint(a,'mouvement',cout)}"),'le geste à la main');
 assert.ok(page.includes('<path id="aim-mouvement" class="aim-fleche mvt" marker-end="url(#shot-mvt)"/>')&&page.includes('<marker id="shot-mvt"')
  &&page.includes("#aim .aim-fleche.mvt{stroke:#cf9152;")&&page.includes("lab.setAttribute('class','aim-dist on mvt')}"),'la flèche du mouvement, à la couleur du Mouvement');
 assert.ok(page.includes("const k=mouvementClavier,suite=k&&k.id===a.id&&!k.regle.combat&&performance.now()-k.t<1500")&&page.includes("   if(regle.combat){if(cout>0)depensePoint(a,'mouvement',cout);a.lameventPret=round}"),'au clavier, une suite de pas puise dans le même reste');
 assert.ok(ia.includes("const borne=!appliqueRegleMouvement(a,regle);if(borne)jusquALaBorne(a,regle,q,(u,v)=>moveActor(a,u,v,false,ignorer,true));")&&ia.includes("  if(borne)break}")
  &&ia.includes(" const cout=soldeRegleMouvement(a,regle);if(cout>0)depensePoint(a,'mouvement',cout);")&&ia.includes("q=borneMouvement(regle,{x:x/size.width*100,y:y/size.height*100},{x:a.x,y:a.y});moveActor(e,q.x,q.y,false,ignorer,true);"),'l’IA sous la même règle');
 assert.ok(carto.includes("const limiteBtn=icone('mouvement-limite','👣','Mouvement limité');")&&carto.includes("localStorage.setItem('amertume-mouvement-limite',mouvementLimiteExplo?'1':'0')")
  &&carto.includes(" limiteBtn.classList.toggle('on',!!mouvementLimiteExplo);")&&src.includes("'amertume-fouilles','amertume-mouvement-limite','amertume-bruit-coupe','amertume-impraticables'];"),'le bouton du MJ, gardé avec les réglages de l’appareil');
 assert.ok(carto.includes("  if(view==='mj'&&l.pose){let g=null;")&&carto.includes("if(!bouge)return;t._glisse=true;setTimeout(()=>{render();saveMaps()},0)};")
  &&carto.includes("t.onclick=e=>{e.stopPropagation();if(t._glisse){t._glisse=false;return}"),'le MJ déplace les objets posés');
 const noms=['objetsQuiComptent','DISTANCE_MOUVEMENT','bonusMouvementDe','mouvementPropre','distanceMouvement','mouvementLimiteExplo','mouvementBorne','borneMouvement','traceMouvement','mouvementClavier','limiteBtn'];
 const decl=n=>new RegExp('(?:function|const|let|var)\\s+'+n+'\\b','g');
 noms.forEach(n=>{const k=['combat.js','index.html','maps.js','editor.js','live.js','ia.js','shared.js','shared-data.js','campagnes.js','domaine.js','planches.js'].reduce((s,f)=>s+(fs.readFileSync(f,'utf8').match(decl(n))||[]).length,0);assert.equal(k,1,'un seul '+n)});}
/* v0.602 — Sans arme, un aventurier frappe quand même : l'Attaque à mains nues, un dé Os et ses dégâts, s'il n'a pas ses
   propres attaques sur sa fiche. Ses dés paraissent dans les bulles de la table et de l'onglet Aventuriers ; l'icône que le
   MJ a choisie pour l'Attaque sans arme y paraît aussi, sur le bouton, la piste de dés et la carte Attaque. */
{const src=fs.readFileSync('editor.js','utf8');
 const nue=gearApi.gearAttacks({hero:true,weapons:[]},[]);
 assert.equal(nue.length,1);assert.equal(nue[0].name,'Attaque');assert.equal(nue[0].dice.bone,1);assert.equal(Object.values(nue[0].dice).reduce((s,n)=>s+n,0),1);
 assert.ok(nue[0].mainsNues&&nue[0].useOwnDamage&&nue[0].range==='contact','un dé Os, au contact, et les dégâts');
 assert.deepEqual(gearApi.gearAttacks({weapons:[]},[]),[]);assert.deepEqual(gearApi.gearAttacks({hero:false,weapons:[]},[]),[]);
 assert.deepEqual(gearApi.gearAttacks({hero:true,weapons:[],attacks:[{name:'Morsure',dice:{white:2}}]},[]),[],'ses propres attaques frappent, comme avant');
 assert.equal(gearApi.chosenAttack({hero:true,weapons:[]},[]).dice.bone,1);
 assert.ok(src.includes("function logosDeAttaque(at){")&&src.includes("actuelle?logosDeAttaque(actuelle):null")&&src.includes("survol(b,at.dice,bonusDe(at),at.useOwnDamage!==false,logosDeAttaque(at));")
  &&src.includes("function carteAttaque(a){const at=typeof activeAttack==='function'?activeAttack(a):null,l=logosDeAttaque(at)[0];"),'l’icône de l’Attaque sans arme, partout où l’Attaque se montre');}
/* v0.601 — Aucun bord de mur ne se devine plus dans le noir, quelle que soit la façon dont l'obscurité a été posée. Pour
   l'affichage seul, la pierre et les portes closes vont à l'espace libre le plus proche et noircissent s'il est noir ; un
   mince filet clair contre la pierre ou entre deux obscurités compte pour noir. Le calque du noir peint cette grille avec
   l'obscurité ; la règle, elle, ne connaît que l'obscurité dessinée. */
{const carto=fs.readFileSync('maps.js','utf8');
 const m={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[45,10],[45,90],[10,90]],[[60,10],[90,10],[90,90],[60,90]]]}],doors:[],
  obscurite:[{anneaux:[[[10.6,10.6],[44.4,10.6],[44.4,89.4],[10.6,89.4]]]}]};
 const p=C.noirDeLaPierre(m,320),at=(x,y)=>p.data[Math.floor(y/100*p.rows)*p.cols+Math.floor(x/100*p.cols)];
 assert.deepEqual([at(30,50),at(10.3,50),at(47,50),at(5,50)],[1,1,1,1],'la salle noire, son filet, et la pierre qui la borde');
 assert.deepEqual([at(58,50),at(75,50),at(95,50)],[0,0,0],'la pierre qui donne sur la salle claire, et la salle claire, restent');
 assert.ok(!C.dansObscurite(m,[10.3,50])&&!C.dansObscurite(m,[47,50]),'la règle ne connaît que l’obscurité dessinée');
 // Une porte ouverte est de l'espace libre ; close, elle est de la pierre.
 const d={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[45,10],[45,90],[10,90]],[[55,10],[90,10],[90,90],[55,90]],[[44,45],[56,45],[56,55],[44,55]]]}],doors:[{x:45,y:46,w:10,h:8,open:true}],obscurite:[]};
 assert.ok(C.noirDeLaPierre(d,200).data.every(v=>!v),'sans obscurité, rien');
 assert.ok(carto.includes(" const c1=m.id+'|'+W+'x'+H+'|'+obscuriteKey(m)+'|'+geometryKey(m),f=toileCache(nuitFondue,W,H);")
  &&carto.includes("  {const pierre=noirDeLaPierre(m),g=document.createElement('canvas');g.width=pierre.cols;g.height=pierre.rows;"),'le calque du noir la peint');}
/* v0.600 — Ce qu'un œil voit dans le noir se fond vers son bord, du même dégradé qu'une lumière. Une lumière qui contient
   des objets montre l'icône du premier qui a un logo, sinon le signe de sa famille ; la flamme reste aux lumières vides.
   Le MJ choisit, avec les autres icônes, celle de l'Attaque d'un aventurier sans arme en main. */
{const carto=fs.readFileSync('maps.js','utf8'),src=fs.readFileSync('editor.js','utf8');
 assert.ok(carto.includes("    const cx=o.x/100*NW,cy=o.y/100*NH,g=c.createRadialGradient(cx,cy,0,cx,cy,r*kk);lumiereDegrade(r,demi).forEach(([s,v])=>g.addColorStop(s,'rgba(0,0,0,'+v+')'));c.fillStyle=g}"),'le bord de la zone de contact, fondu');
 assert.ok(carto.includes("function iconeDeLumiere(l){")&&carto.includes(" return typeof glyphePiece==='function'&&typeof itemColumn==='function'?glyphePiece(itemColumn(pieces[0])):null}")
  &&carto.includes(" const im=iconeDeLumiere(l);\n if(im){im.classList.add('logo-objet');coeur.append(im)}else coeur.textContent='🔥';"),'l’icône de l’objet contenu');
 assert.ok(src.includes(" if(typeof c.logoAttaqueBase!=='string'||!c.logoAttaqueBase||c.logoAttaqueBase.length>120)delete c.logoAttaqueBase;")
  &&src.includes("selGrille(selGroupes('Attaque sans arme','attaque-base',catalog.logoAttaqueBase||'',groupes))")
  &&src.includes("function logosDeAttaque(at){const l=at&&Array.isArray(at.logos)?at.logos:[];return l.length?l:at&&at.mainsNues&&typeof catalog!=='undefined'&&catalog.logoAttaqueBase?[catalog.logoAttaqueBase]:[]}"),'l’icône de l’Attaque sans arme');}
/* v0.599 — Ce que la lumière éclaire hors de la vue de la troupe se grise : la part éclairée du noir, hors des champs de
   vision, reprend la moitié de son noir, et le jeton d'une lumière hors de vue pâlit comme un objet. Pendant un glissement,
   ce que la lumière qui bouge découvre ou recouvre paraît ou s'efface aussitôt, socle, jauge et zone de contact ensemble ;
   un adversaire jamais vu ainsi aperçu est révélé au lâcher. */
{const page=fs.readFileSync('index.html','utf8'),carto=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(carto.includes("function lumiereEnVue(l){const m=currentMap();if(!fogVis||!m||m.fogOff)return true;")
  &&carto.includes("  const enVue=lumiereEnVue(l),vuTroupe=enVue||seenAt(l.x,l.y);")&&carto.includes("t.className='token lumiere'+(!enVue?' veiled':'')+(l.eteinte?' eteinte':'');")
  &&carto.includes("gc.drawImage(nuitFondue.cv,0,0);gc.globalCompositeOperation='destination-out';gc.drawImage(nuit,0,0);")
  &&carto.includes("gc.globalCompositeOperation='source-over';c.globalAlpha=.5;c.drawImage(g,0,0);c.globalAlpha=1}")
  &&carto.includes(" const cle=[nuitPercee.cle,NW,NH,joueur,fogCalcul,yeux.map("),'la lumière hors de vue, grisée');
 assert.ok(page.includes("const apercusEnGeste=new Set();\nfunction visibilitesEnGeste(){")
  &&page.includes("const cls=joueur?'unseen':(a.hidden?'cachemj':'veiled');t.classList.toggle(cls,cache);if(t._pv)t._pv.classList.toggle(cls,cache)})}")
  &&page.includes("||troupeVoit(a)||apercusEnGeste.has(a.id)));\n apercusEnGeste.clear();")
  &&page.includes("drag.image=0;visibilitesEnGeste();updateRing();")&&vivant.includes("if(typeof visibilitesEnGeste==='function')visibilitesEnGeste();"),'les socles suivent la lumière pendant le geste');}
/* v0.598 — Une lumière posée passe devant les socles dans la page : tout ce qui retrouvait le socle d'un combattant par
   son rang — le glissement, la sélection, la taille des socles, le focus au clavier — ne compte plus qu'eux, et le socle
   glissé suit enfin la souris. Un rond qui apporte son icône la garde, même avec sa propre bulle : deux objets lumineux,
   deux icônes. Un objet posé au sol montre sa bulle au survol, dès qu'il est dans la zone de contact d'un aventurier. */
{const page=fs.readFileSync('index.html','utf8'),carto=fs.readFileSync('maps.js','utf8');
 assert.ok(!/querySelectorAll\('#map-view \.token'\)/.test(page)&&!/querySelectorAll\('\.token'\)\[/.test(page)
  &&page.includes("const socles=document.querySelectorAll('#map-view .token:not(.lumiere)');")&&page.includes("render();refocusToken(a);"),'les socles par leur rang, sans les lumières');
 assert.ok(page.includes("(bulle&&typeof glyphe==='string'&&typeof logoArmeEquipee==='function'?logoArmeEquipee(a):null)"),'chaque rond garde son icône');
 assert.ok(carto.includes("  if(l.pose&&piece&&typeof surveille==='function')surveille(t,()=>{if(!actors.some(a=>a&&a.hero&&alive(a)&&!a.horsCarte&&lumiereAPortee(a,l)))return;"),'la bulle de l’objet au sol, au contact');}
/* v0.597 — Le remplissage d'obscurité gagne la pierre : chaque case de mur ou de porte va à l'espace libre le plus proche,
   et noircit si c'est la zone remplie ou une obscurité déjà posée ; aucun mur clair ne se devine plus entre deux salles
   noires. Le noir a sa propre toile, au-dessus du brouillard, et suit le socle qu'on glisse, image après image, avec les
   halos. Poser la Source de lumière est un geste de Mouvement : 1 PM en combat, gratuit en exploration ; sa bulle montre
   l'objet sous son titre. Analyser n'est là qu'en combat. Une lumière posée passe sous les combattants. */
{const page=fs.readFileSync('index.html','utf8'),carto=fs.readFileSync('maps.js','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 // Deux salles noires et la pierre entre elles ; une salle claire garde sa face de mur.
 const m={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[30,10],[30,90],[10,90]],[[40,10],[60,10],[60,90],[40,90]],[[70,10],[90,10],[90,90],[70,90]]]}],doors:[]};
 C.remplitObscurite(m,[20,50],100);C.remplitObscurite(m,[50,50],100);
 assert.ok(C.dansObscurite(m,[35,50])&&C.dansObscurite(m,[20,50])&&C.dansObscurite(m,[50,50]),'le mur entre deux salles noires est noir');
 assert.ok(C.dansObscurite(m,[62,50])&&!C.dansObscurite(m,[68,50])&&!C.dansObscurite(m,[80,50]),'le mur qui donne sur la salle claire garde sa face');
 assert.ok(carto.includes("function renderNuit(){const cv=toileNuit(),m=currentMap(),size=mapSize();")
  &&carto.includes("   if(Number.isFinite(r)){const poly=reachPolygon(o,formes,r,size.width,size.height,72);if(poly.length<3)return;")
  &&feuille.includes("#nuit{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}")
  &&vivant.includes(" if(typeof renderNuit==='function'){renderHalos();renderNuit()}\n if(glissements.size)glisseImage=requestAnimationFrame(glisseUneImage);"),'le noir sur sa toile, qui suit le glissement');
 assert.ok(page.includes(" const rev=$('reveal');rev.hidden=!a||!a.hero||!enCombat();"),'Analyser, en combat seulement');
 assert.ok(src.includes(" if(objet){const p=document.createElement('p');p.className='bulle-objet';const c=gearCarre(objet,1,false);")
  &&page.includes("bulleAction(b,{nom:'Poser la Source de lumière',points:enCombat()?{pa:0,pm:1}:null,objet:o})"),'la bulle montre l’objet');
 assert.ok(carto.includes("  vue.insertBefore(t,vue.querySelector('.token:not(.lumiere)'))})}"),'la lumière posée sous les combattants');}
/* v0.596 — Le noir se peint du même noir que l'inexploré : rien ne distingue une zone obscure d'un mur jamais vu. Un
   aventurier qui porte ce qui éclaire peut le poser au sol, d'un petit rond à l'icône de l'objet : l'objet quitte
   l'inventaire et éclaire où il est, jusqu'à ce qu'on le ramasse au contact. Posé, il voyage en ligne à la suite des
   lumières de la carte, sans clé de plus. La fiche de la table montre ses objets en petits carrés, comme le sac. */
{const page=fs.readFileSync('index.html','utf8'),carto=fs.readFileSync('maps.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const items=[{id:'t',name:'Torche',category:'objet',lumiere:5},{id:'l',name:'Lanterne',category:'weapon',hands:1,lumiere:8},{id:'x',name:'Caillou',category:'objet'}];
 assert.deepEqual(C.objetsLumineux({hero:true,inventaire:['t','t','l','x'],weapons:[]},items).map(o=>o.id),['t'],'la torche une fois, la lanterne rangée non');
 assert.deepEqual(C.objetsLumineux({hero:true,inventaire:['t','l'],weapons:['l']},items).map(o=>o.id),['t','l']);
 assert.equal(C.lumierePortee({hero:true,inventaire:['t','l'],weapons:['l']},items),8);assert.deepEqual(C.objetsLumineux(null,items),[]);
 assert.equal(C.cleanLumiere({id:'a',nom:'Torche',x:1,y:2,rayon:4,items:['t'],pose:true}).pose,true);assert.ok(!('pose' in C.cleanLumiere({pose:'oui'})));
 assert.ok(carto.includes("nc.fillStyle='rgb(6,9,11)';")&&carto.includes("ctx.fillStyle='rgba(6,9,11,'+(inconnu/255).toFixed(3)+')';"),'le même noir que l’inexploré');
 assert.ok(carto.includes("function poserLumiere(a,o){const m=currentMap();if(!a||!o||!m||a.horsCarte||!lumiereDe(o)||!(a.inventaire||[]).includes(o.id))return;")
  &&carto.includes(" m.lumieres.push(cleanLumiere({id:crypto.randomUUID(),nom:o.name,x:a.x,y:a.y,rayon:lumiereDe(o),items:[o.id],pose:true}));")
  &&carto.includes(" if(l.pose){const m=currentMap(),k=m?(m.lumieres||[]).indexOf(l):-1;if(k>=0)m.lumieres.splice(k,1);")
  &&carto.includes("ajouterInventaire(a,it)!==false")&&carto.includes(" if(!l.pose)bouton(l.eteinte?'Rallumer':'Éteindre',"),'poser, ramasser');
 assert.ok(page.includes("geste('Poser la Source de lumière',ic||(typeof glyphePiece==='function'?glyphePiece(itemColumn(o)):'◈'),'',!enCombat()||pointsRestants(a,'mouvement')>0,()=>{")&&page.includes("if(enCombat()){saveChecks();savePool();depensePoint(a,'mouvement')}poserLumiere(a,o)},'btn-action btn-mvt',null,null,null,bulle);"),'le rond Poser la Source de lumière');
 assert.ok(vivant.includes("function lumiereAuSol(l){return {n:l.nom,o:(l.items||[])[0]||'',p:l.id,r:l.rayon,x:l.x,y:l.y}}")
  &&vivant.includes("...(m.lumieres||[]).filter(l=>l&&l.pose).map(lumiereAuSol),")
  &&vivant.includes("if(cleIci!==cleRecue&&!(envoyees&&cle(envoyees)===cleRecue)){const avant=new Map(ici.map(l=>[l.id,l]));")
  &&!/'(posees|auSol|lumieresPosees)'/.test(fs.readFileSync('firestore-online.rules','utf8')),'au sol, en ligne, sans clé nouvelle');
 assert.ok(feuille.includes("#gear .cat-pill.gear-carre,#gear .cat-pill.gear-carre:not(.talent-carre):not(.best-carre){width:28px;min-width:28px;height:28px;min-height:28px;")
  &&feuille.includes("#gear .cat-pill.gear-carre .exemplaires{position:absolute;top:auto;right:-6px;bottom:-6px;"),'les objets de la fiche, comme le sac');}
/* v0.595 — Le noir n'est plus le brouillard de vue. Il se peint à part, par-dessus : plein chez un joueur, sauf ce que
   chaque œil voit dans le noir ; un voile chez le MJ. Il se referme derrière l'aventurier : la mémoire ne retient, dans le
   noir, que les cases éclairées. Son bord se fond sur un demi-mètre ; une lumière s'assombrit peu à peu de son cœur à son
   bord, puis tombe au noir sur son dernier demi-mètre. Le brouillard, le noir et les halos ne se repeignent plus qu'au
   changement. L'infobulle d'un objet qui éclaire dit « Lumière 3m ». */
{const carto=fs.readFileSync('maps.js','utf8'),src=fs.readFileSync('editor.js','utf8');
 const ctx={};vm.createContext(ctx);vm.runInContext(carto.slice(carto.indexOf('function lumiereDegrade('),carto.indexOf('function calqueNuit(')),ctx);
 const g=ctx.lumiereDegrade(132,22);assert.equal(g[0].join(),'0,1');assert.equal(g[g.length-1].join(),'1,0');
 assert.ok(g.every((s,i)=>!i||(s[0]>g[i-1][0]&&s[1]<g[i-1][1])),'un dégradé qui ne fait que s’assombrir');
 assert.ok(Math.abs(g[2][0]-(132-22)/132)<1e-9&&g[2][1]>.5,'encore clair à un demi-mètre du bord');assert.equal(ctx.lumiereDegrade(10,22).length,3,'une toute petite lumière');
 assert.ok(carto.includes(" const peinte=[m.id,fogCalcul,fogMemTick,W,H,view,owner,oeilJoueur()].join('|');\n if(cv._peinte===peinte)return;cv._peinte=peinte;")
  &&carto.includes(" fogKey=cle;fogCalcul++;")&&carto.includes("c.putImageData(img,0,0);fogDirty=false;fogMemTick++}")
  &&carto.includes("+geometryKey(m);if(cv._peinte===cle)return;cv._peinte=cle;"),'rien ne se repeint sans changement');
 assert.ok(carto.includes("let nuitFondue={cle:'',cv:null},nuitPercee={cle:'',cv:null},nuitGrise={cle:'',cv:null};")
  &&carto.includes("fc.clearRect(0,0,W,H);dessineFloute(fc,large,-e,-e,large.width,large.height,flou,[6,9,11])}")
  &&carto.includes(" const nuit=calqueNuit(NW,NH);if(!nuit)return;")&&!/const lum=document\.createElement\('canvas'\)/.test(carto),'le noir à part, fondu, en cache');
 assert.ok(src.includes(" if(lumiereDe(o))ligne('Lumière '+String(lumiereDe(o)).replace('.',',')+'m','gear-lumiere');"),'Lumière 3m dans l’infobulle');}
/* v0.594 — Remplir d'obscurité ne laisse plus de liseré clair le long des murs : deux rangs de cases de mur ou de porte
   qui touchent la zone s'y ajoutent, sans jamais passer dans une autre zone. Le bord d'une lumière se fond sur un
   demi-mètre de part et d'autre de son rayon ; la règle reste au rayon. La validation liste d'un coup toutes les
   chaînes de test devenues absentes des sources. */
{const carto=fs.readFileSync('maps.js','utf8'),outil=fs.readFileSync('verif.cjs','utf8');
 const salle=[];for(let k=0;k<40;k++){const a=k/40*Math.PI*2;salle.push([50+30*Math.cos(a)+3*Math.sin(3*a),50+26*Math.sin(a)])}
 const m={ratio:16/9,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],salle]}],doors:[]};C.remplitObscurite(m,[40,50]);
 let rates=0;for(let k=0;k<salle.length;k++){const a=salle[k],b=salle[(k+1)%salle.length];for(let t=0;t<1;t+=.1){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,dx=50-x,dy=50-y,L=Math.hypot(dx,dy);
  if(!C.dansObscurite(m,[x+dx/L*.08,y+dy/L*.08]))rates++}}
 assert.equal(rates,0,'aucun liseré clair contre les murs');
 const f={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[49.5,10],[49.5,90],[10,90]],[[50.5,10],[90,10],[90,90],[50.5,90]]]}],doors:[]};
 C.remplitObscurite(f,[30,50],320);assert.ok(C.dansObscurite(f,[49.4,50])&&!C.dansObscurite(f,[50.7,50]),'le noir mord le mur, pas la pièce voisine');
 assert.ok(carto.includes("function calqueNuit(W,H){")&&carto.includes("lumiereDegrade(l.rayon,demi).forEach(([o,v])=>g.addColorStop(o,'rgba(0,0,0,'+v+')'));"),'le fondu des lumières');
 assert.ok(outil.includes("function chainesAbsentes(){")&&outil.includes("if(refaire)break;if(f==='checks.cjs')chainesAbsentes();process.exit(1)}"),'toutes les chaînes absentes d’un coup');}
/* v0.593 — Remplir d'obscurité va par zone : celle que découpent les murs, les portes et les séparations, et que
   réunissent les regroupements ; la case d'une séparation qui touche la zone en fait partie, et dans une miette il inonde
   à l'ancienne. Une source de lumière prise dans la matière éclaire depuis le point libre le plus proche : son halo ne
   traverse ni n'empiète sur un mur, à la table comme dans l'éditeur, où le halo se découpe. Une lumière se duplique. */
{const carto=fs.readFileSync('maps.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const m={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[90,10],[90,90],[10,90]]]}],doors:[],zonesCoupures:[{x1:50,y1:10,x2:50,y2:90}],zonesLiens:[]};
 C.remplitObscurite(m,[30,50],64);assert.ok(C.dansObscurite(m,[30,50])&&!C.dansObscurite(m,[70,50])&&C.dansObscurite(m,[5,5])&&!C.dansObscurite(m,[95,50]),'la séparation borne le remplissage ; la pierre va à l’espace libre le plus proche');
 C.remplitObscurite(m,[70,50],64);assert.ok(C.dansObscurite(m,[70,50])&&C.dansObscurite(m,[50.8,50]),'l’autre côté, sans fente claire entre les deux');
 const d={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[40,10],[40,90],[10,90]],[[60,10],[90,10],[90,90],[60,90]]]}],doors:[],zonesCoupures:[],zonesLiens:[{x1:25,y1:50,x2:75,y2:50}]};
 C.remplitObscurite(d,[25,50],64);assert.ok(C.dansObscurite(d,[25,50])&&C.dansObscurite(d,[75,50])&&C.dansObscurite(d,[50,50]),'un regroupement : les deux pièces d’un coup, et le mur qui les sépare');
 const f={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[14,10],[14,14],[10,14]]]}],doors:[]};
 C.remplitObscurite(f,[12,12],64);assert.ok(C.dansObscurite(f,[12,12]),'une miette s’inonde à l’ancienne');
 // Une source dans un mur éclaire depuis le point libre le plus proche, et ses rayons n'entrent pas dans le mur.
 const mur={contours:[[[40,40],[60,40],[60,60],[40,60]]]},p=C.pointLibre({x:41,y:50},[mur]);
 assert.ok(p&&(p.x<40||p.x>60||p.y<40||p.y>60)&&C.pointLibre({x:50,y:50},[mur])===null&&C.pointLibre({x:50,y:20},[mur]).x===50);
 assert.ok(!C.reachPolygon(p,[mur],20,100,100,72).some(q=>q[0]>40.01&&q[0]<59.99&&q[1]>40.01&&q[1]<59.99),'le halo n’empiète pas sur le mur');
 assert.ok(carto.includes(" const libre=s=>{const p=pointLibre(s,formes);return p?{...s,x:p.x,y:p.y}:null};")
  &&carto.includes(" const p=pointLibre(l,walls())||l;return inContact(a,l,size,tokenOf(a),tokenPx()*SOCLE_TAILLES.small)&&!wallsBetween(a,p,walls())}")
  &&carto.includes("function lumiereEl(i,l,formes){")&&carto.includes("  const poly=o&&W&&H?reachPolygon(o,formes||[],socle*l.rayon+3,W,H,72):[];")
  &&carto.includes(" {const formes=mapShapes(m).formes;(m.lumieres||[]).forEach((l,i)=>c.append(lumiereEl(i,l,formes)))}")
  &&feuille.includes(".shape.lumiere .lumiere-halo{position:absolute;inset:0;box-sizing:border-box;border-radius:50%;border:1px dashed #d9a85a;")&&feuille.includes(".shape.lumiere.selected{outline:none}"),'les halos bornés par les murs et les portes');
 assert.ok(carto.includes('<button id="lumiere-double" hidden>⧉ Dupliquer la lumière</button>')&&carto.includes("$('lumiere-edit').hidden=$('lumiere-double').hidden=!lum;")
  &&carto.includes("$('lumiere-double').onclick=()=>{const l=mapSel&&mapSel.kind==='lumiere'&&shapeAt(mapSel);if(!l)return;pushUndo();")
  &&carto.includes(" const copie=structuredClone(l);copie.id=crypto.randomUUID();delete copie.eteinte;"),'dupliquer une lumière');
 assert.ok(carto.includes("obscurremplir:'Clique dans une zone : toute la zone — telle que la découpent les murs, les portes et les séparations, et que la réunissent les regroupements — devient noire d’un coup.',"));}
/* v0.592 — Les lumières dans le noir. Un objet de l'Armurerie porte un champ « Lumière : x m » : arme, armure ou munition
   n'éclaire que tenue ou portée par un aventurier ; tout autre objet éclaire depuis l'inventaire ; un adversaire éclaire
   avec tout ce qu'il a. Sur une carte, l'outil Lumière pose un point lumineux, nommé, au rayon tiré à la poignée, qui peut
   contenir un objet ; à la table, un halo chaud et à peine teinté repousse l'obscurité en rayon, arrêté par les murs, et
   le petit jeton au cœur du halo se prend au contact : l'objet rejoint l'inventaire, la lumière s'éteint ; le MJ l'éteint,
   la rallume ou la donne. Éteinte, elle voyage avec les portes ; la carte rouverte la rallume. */
{const src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 // La portée d'un porteur : le plus grand rayon de ce qui éclaire.
 const items=[{id:'t',name:'Torche',category:'objet',lumiere:5},{id:'l',name:'Lanterne',category:'weapon',hands:1,lumiere:8},{id:'c',name:'Casque',category:'armor',lumiere:2},{id:'b',name:'Bougie',category:'ammo',lumiere:1},{id:'x',name:'Caillou',category:'objet'}];
 const h={hero:true,inventaire:['t','l','c','b','x'],weapons:[]};
 assert.equal(C.lumierePortee(h,items),5,'la torche éclaire depuis l’inventaire, la lanterne rangée non');
 assert.equal(C.lumierePortee({...h,weapons:['l']},items),8,'la lanterne tenue');
 assert.equal(C.lumierePortee({...h,inventaire:['c','x'],armures:['c']},items),2,'le casque porté');
 assert.equal(C.lumierePortee({...h,inventaire:['b','x'],munitionId:'b'},items),1,'la munition choisie');
 assert.equal(C.lumierePortee({...h,inventaire:['l','c','x']},items),0,'rien de tenu, rien d’allumé');
 assert.equal(C.lumierePortee({hero:false,inventaire:['l']},items),8,'un adversaire éclaire avec tout ce qu’il a');
 assert.equal(C.lumierePortee(null,items)+C.lumierePortee(h,null)+C.lumierePortee({hero:true},items),0);
 assert.equal([C.lumiereDe({lumiere:'7'}),C.lumiereDe({lumiere:99}),C.lumiereDe({}),C.lumiereDe(null)].join(),'7,40,0,0');
 // Une lumière de carte, nettoyée ; au plus cent par carte.
 assert.deepEqual(C.cleanLumiere({id:'a',nom:'',x:150,y:-3,rayon:0,items:['t',5,''],eteinte:true}),{id:'a',nom:'Torche',x:100,y:0,rayon:3,items:['t'],eteinte:true});
 assert.deepEqual(C.cleanLumiere({nom:'Feu',x:10,y:20,rayon:60}),{id:'',nom:'Feu',x:10,y:20,rayon:40,items:[]});
 assert.equal(C.cleanMap({lumieres:Array.from({length:120},(_,i)=>({id:'l'+i,x:1,y:1}))}).lumieres.length,100);assert.deepEqual(C.cleanMap({}).lumieres,[]);
 // L'Armurerie et le catalogue.
 assert.ok(src.includes("field('Lumière (m)','lumiere',lumiereDe(a),'number','min=\"0\" max=\"40\"')")&&src.includes("['qty','price','hands','def','lumiere']")
  &&src.includes("  o.lumiere=lumiereDe(o);if(!o.lumiere)delete o.lumiere;"),'le champ Lumière des objets');
 // L'éditeur de cartes : l'outil, la fiche, la poignée du rayon.
 assert.ok(carto.includes("lumiere:'Lumière',")&&carto.includes('<button data-tool="lumiere">Lumière</button>')&&carto.includes('<button id="lumiere-edit" hidden>✎ Modifier la lumière</button>')
  &&carto.includes(" m.obscurite??=[];m.impraticable??=[];m.lumieres??=[];m.lumieres.forEach(l=>{l.id||=crypto.randomUUID();l.items??=[];l.rayon=Math.max(.5,Math.min(40,Number(l.rayon)||3))});")
  &&carto.includes("function openLumiere(i){const m=mapDraft,l=m&&m.lumieres&&m.lumieres[i];if(!l||view!=='mj')return;")
  &&carto.includes(" if(d.kind==='lumiere'&&d.grip==='rayon'){const r=$('map-canvas').getBoundingClientRect(),socle=Math.max(8,r.width*echelleSocle(mapDraft)/100);"),'l’outil Lumière');
 // La table : les sources, les halos sous le brouillard, le jeton, la prise, le menu du MJ.
 assert.ok(carto.includes("function sourcesLumiere(){const m=currentMap();if(!m)return [];const tk=tokenPx(),items=typeof catalog!=='undefined'?catalog.items||[]:[],formes=activeObstacles();")
  &&carto.includes(" const l=(m.lumieres||[]).filter(x=>x&&!x.eteinte).map(x=>libre({x:x.x,y:x.y,rayon:x.rayon*tk})).filter(Boolean);")
  &&carto.includes("  const p=Math.max(lumierePortee(a,items),feu);if(p>0){const s=libre({x:a.x,y:a.y,rayon:p*tk});if(s)l.push(s)}});")
  &&carto.includes("function toileHalos(){let cv=$('halos');if(!cv){cv=document.createElement('canvas');cv.id='halos';cv.setAttribute('aria-hidden','true');$('fog').before(cv)}return cv}")
  &&carto.includes("function renderHalos(){const cv=toileHalos(),m=currentMap(),size=mapSize();")
  &&carto.includes("g.addColorStop(0,'rgba(255,226,176,.30)');g.addColorStop(.55,'rgba(255,216,156,.16)');g.addColorStop(1,'rgba(255,206,136,0)');")
  &&carto.includes("function clesLumieres(){return sourcesLumiere().map(l=>l.x.toFixed(2)+','+l.y.toFixed(2)+','+Math.round(l.rayon)).join(';')}")
  &&feuille.includes("#halos{position:absolute;")&&feuille.includes(".token.lumiere{background:#fff3d6;border-color:#d9a85a;"),'les halos');
 assert.ok(carto.includes("function recupererLumiere(a,l){if(!a||!l||l.eteinte)return;")&&carto.includes(" else{l.eteinte=true;l.prise=true;log(nomNum(a)+' prend '+pris.map(it=>'⟦'+it.id+'⟧').join(' ')+' : '+l.nom+' s’éteint.',{ton:'butin'})}")
  &&carto.includes("bouton(l.eteinte?'Rallumer':'Éteindre',()=>{if(l.eteinte){delete l.eteinte;delete l.prise}else l.eteinte=true;")
  &&carto.includes(" vue.querySelectorAll('.token.lumiere').forEach(t=>t.remove());renderHalos();if(!m)return;")&&carto.includes(" renderPortes();renderCoffres();renderPieges();renderObjets();renderLumieres()}")
  &&carto.includes("(m.objets||[]).forEach(o=>{delete o.pris});(m.lumieres||[]).forEach(l=>{delete l.eteinte;delete l.prise});"),'la prise, le menu, la carte rouverte');
 assert.ok(vivant.includes("...(m.lumieres||[]).filter(l=>l&&!l.pose).map(l=>l.prise?2:l.eteinte?1:0),")&&vivant.includes("fixes.forEach((l,k)=>{const v=d.doors[n3+k];if(v===2){l.eteinte=true;l.prise=true}else if(v===1){l.eteinte=true;delete l.prise}else if(v===0){delete l.eteinte;delete l.prise}});"),'éteinte, en ligne');}
/* v0.591 — L'obscurité et la vision dans le noir. Sur une carte, une seconde matière, dessinée au rectangle, au contour libre,
   au remplissage d'une pièce, effacée à la gomme : dans le noir, on ne voit que sa zone de contact, ce qui est éclairé, et
   jusqu'où porte sa vision dans le noir ; les alliés hors de vue s'effacent chez les joueurs, et on ne vise que ce qu'on voit.
   Aveugle ramène chacun à sa zone de contact. Les adversaires sont nyctalopes, sauf réglage contraire. Talent Vision dans le
   noir, et ses améliorations : augmentée, Prédateur des Ombres, dont les dés se lancent au coup. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 // La matière de l'obscurité : union, gomme, test d'un point, remplissage d'une pièce close.
 const m={ratio:1,matiere:[{anneaux:[[[0,0],[100,0],[100,100],[0,100]],[[10,10],[60,10],[60,60],[10,60]]]}],doors:[]};
 assert.equal(C.obscuriteDe(m).length,0);C.remplitObscurite(m,[20,20],64);
 assert.equal(m.obscurite.length,1);assert.ok(C.dansObscurite(m,[30,30])&&C.dansObscurite(m,[80,80])&&C.dansObscurite(m,[5,5]),'la pièce remplie, et la pierre qui n’entoure qu’elle');
 C.remplitObscurite(m,[5,5],64);assert.equal(m.obscurite.length,1,'un clic dans un mur ne remplit rien');
 C.retireObscurite(m,[[20,20],[40,20],[40,40],[20,40]]);assert.ok(!C.dansObscurite(m,[30,30])&&C.dansObscurite(m,[15,15]),'la gomme');
 C.ajouteObscurite(m,[[70,70],[90,70],[90,90],[70,90]]);assert.ok(C.dansObscurite(m,[80,80])&&m.obscurite.every(p=>!('verrou' in p)),'le rectangle, sans verrou');
 assert.equal(C.cleanMap({obscurite:[{anneaux:[[[1,1],[2,1],[2,2]]],verrou:true}]}).obscurite.length,1,'l’obscurité voyage avec la carte');
 assert.deepEqual(C.cleanMap({}).obscurite,[]);
 // La grille à juge : seules les cases acceptées.
 {const g=new Uint8Array(100),n=C.fillPolygonGridSi(g,10,10,[[0,0],[100,0],[100,100],[0,100]],(i,j)=>i<5);assert.equal(n,50)}
 // Les codes du talent.
 const T=C.TALENTS_CODES;assert.equal(T.visionnoir.type,'pass');assert.equal(T.visionaugmentee.pour,'visionnoir');assert.equal(T.predateurombres.pour,'visionnoir');
 assert.equal(T.predateurombres.nom,'Vision dans le noir — Prédateur des Ombres');
 assert.ok(T.predateurombres.params.find(p=>p.cle==='forme').options.map(([k])=>k).join()==='fixe,des,niveau,vie,endu,pv,def,degats','toutes les caractéristiques, en menu');
 assert.deepEqual(C.predateurDe({forme:'des',nb:2,faces:8}),{forme:'des',x:1,nb:2,faces:8});assert.equal(C.predateurDe({forme:'ailleurs'}).forme,'fixe');
 assert.ok(T.visionaugmentee.phrase({m1:10,m2:16},2,{loin:2}).includes('16 m')&&T.visionaugmentee.phrase({m1:10,m2:16},1,{loin:2}).includes('10 m'));
 assert.deepEqual(C.cleanMonster({name:'A',nyctalope:false}).nyctalope,false);assert.ok(!('nyctalope' in C.cleanMonster({name:'A'})));
 // Les outils de l'éditeur, le rendu, la table.
 assert.ok(carto.includes('<button data-tool="obscur">Obscurité</button><button data-tool="obscurlibre">Obscurité libre</button><button data-tool="obscurremplir">Remplir d’obscurité</button><button data-tool="obscurgomme">Gomme d’obscurité</button>')
  &&carto.includes("if(mode==='obscurlibre')ajouteObscurite(mapDraft,forme);else if(mode==='obscurgomme')retireObscurite(mapDraft,forme);else if(mode==='blocagelibre')ajouteMatiere(mapDraft,forme);else retireMatiere(mapDraft,forme);")
  &&carto.includes("if(mapTool==='obscurremplir'){pushUndo();")&&carto.includes("if(r.obscur){ajouteObscurite(mapDraft,forme);mapSel=null}")&&carto.includes(" m.obscurite??=[];")
  &&carto.includes("c.append(svgMatiere([obs.flatMap(p=>p.anneaux)],null,'obscur-skin'))")&&feuille.includes(".obscur-skin path.fond{fill:#05070a;fill-opacity:.62;stroke:none}"),'les outils d’obscurité');
 assert.ok(carto.includes("function rayonVision(a){const base=contactRadius(tokenOf(a));")&&carto.includes(" if(!a.hero)return a.orbeStatique||a.nyctalope===false?base:Infinity;")
  &&carto.includes("function voitSocle(o,b){")&&carto.includes("function voitPoint(o,x,y){")&&carto.includes("function eclaireA(x,y){")&&carto.includes("function dansLeNoir(a){return !!a&&carteObscure()&&!eclaireA(a.x,a.y)}")
  &&carto.includes("return visionInPixels().some((p,k)=>polyTouchesDisc(p,c,r)&&(!yeux[k]||voitSocle(yeux[k],a)))}")&&carto.includes("return fogTroupePx.some((p,k)=>polyTouchesDisc(p,c,r)&&(!yeux[k]||voitSocle(yeux[k],a)))}")
  &&carto.includes("  if(!voitPoint(o.qui,x,y))return false;")&&carto.includes("neuf+=fillPolygonGridSi(fogSeen,d.w,d.h,p,(i,j)=>{if(M&&M.data[j*d.w+i]!==1)return false;if(!aveugle)return true;")
  &&carto.includes("  ctx.save();trace(ctx,poly);ctx.clip();ctx.beginPath();ctx.arc(o.x/100*W,o.y/100*H,rayonVision(o)*k,0,Math.PI*2);ctx.fill();ctx.restore()});")&&carto.includes(" cv.style.opacity=joueur?'1':'.5'}"),'la vision dans le noir, et son rendu');
 assert.ok(page.includes("if(typeof voitSocle==='function'&&!voitSocle(a,b))return {ok:false,ranged:true,text:'cible dans le noir'};")
  &&page.includes(" ||(a.hero&&view!=='mj'&&owner!==i&&typeof carteObscure==='function'&&carteObscure()&&typeof partySees==='function'&&!partySees(a))}")
  &&page.includes(" if(blinded(a)&&loin&&!mapSize().width)return 'Aveugle : ne voit rien au-delà de sa zone de contact.';")
  &&page.includes("  case 'Aveugle':return 'Ne voit rien au-delà de sa zone de contact : ne peut viser que ce qui s’y trouve.';")
  &&page.includes("  if(typeof voitSocle==='function'&&!voitSocle(a,o))return false;\n  const qui=provoque?o:a;")
  &&page.includes("&&(typeof voitSocle!=='function'||voitSocle(c,o)));")&&page.includes("&&(typeof voitSocle!=='function'||voitSocle(m,o));"),'on ne vise que ce qu’on voit ; Aveugle');
 assert.ok(page.includes("+compteEtat(a,'Furie')+bonusPredateur(a);return meuteActive(a)?bonus*2:bonus}")&&page.includes("function visionNoirDe(a){")
  &&page.includes("const aug=c.find(x=>x.code.cle==='visionaugmentee');if(aug)m=Math.max(m,")&&page.includes("function desPredateur(a){")
  &&page.includes("+(Math.trunc(Number(opts.bonusEnPlus))||0)+(predateur?predateur.total:0);"),'le talent et ses améliorations');
 assert.ok(src.includes("'<label class=\"field-check\"><input name=\"nyctalope\" type=\"checkbox\" '+(a.nyctalope===false?'':'checked')+'>Vision dans le noir</label>'")
  &&src.includes("if(f.nyctalope){if(f.nyctalope.checked)delete a.nyctalope;else a.nyctalope=false}")&&src.includes("{cle:'nyctalope',nom:'Vision dans le noir',type:'choix',")
  &&src.includes("...(m.nyctalope===false?{nyctalope:false}:{}),...(mouvementPropre({mouvement:m.mouvement})!==DISTANCE_MOUVEMENT?")&&src.includes("...(a.nyctalope===false?{nyctalope:false}:{}),...(mouvementPropre({mouvement:a.mouvement})!==DISTANCE_MOUVEMENT?")&&vivant.includes("'orbeStatique','nyctalope',"),'le réglage des adversaires');}
/* v0.590 — La marque « ! » d'un talent de début de combat : le seul rond jaune, sans contour blanc ni brun, par-dessus la
   barre de PV. Le Mouvement passe à un brun plus clair, aussi coloré. La piste de dés prend la moitié de la rangée ; chaque
   jet y tient sur une ligne, aussi grand que la place le permet, le bonus au bout, aligné en colonne ; trop de dés, et la
   ligne se coupe en rangées égales, le bonus jamais seul ; rien ne déborde, et les dés restent carrés. */
{const page=fs.readFileSync('index.html','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(feuille.includes("#pv-layer .debut-marque{position:absolute;transform:translate(-50%,-80%);")&&!/\.debut-marque\{[^}]*border:2px solid #fff/.test(feuille)
  &&page.includes("if(t.classList.contains('hors-carte'))marque.hidden=true;couchePV().append(marque);t._marque=marque}")
  &&page.includes("function suitLaJauge(el){const m=el&&el._marque;if(m){m.style.left=el.style.left;m.style.top=el.style.top}"),'la marque par-dessus la jauge');
 assert.ok(feuille.includes("button.btn-analyse,button.btn-analyse.on,button.btn-mvt{--fond:#cf9152;")&&!/#bd7a3e/.test(feuille+page),'le Mouvement plus clair');
 assert.ok(feuille.includes("@media(min-width:701px){.actions-rangee{grid-template-columns:minmax(0,1fr) minmax(max-content,1fr)}}")
  &&page.includes("for(let taille=42;taille>=18&&!plan;taille-=2)plan=essai(taille,false);")&&page.includes("for(let taille=42;taille>=14&&!plan;taille-=2)plan=essai(taille,true);")
  &&page.includes("if(e.bonus&&r.length>1)suit.unshift(r.pop());")&&page.includes("const fx=e.bonus?bordD-e.w/2:curseur+e.w/2;")
  &&page.includes("el.style.borderRadius=Math.round(taille*.26)+'px'")&&page.includes("tray.style.minHeight='';const size=tray.getBoundingClientRect();"),'la piste de dés en ordre');}
/* v0.589 — Orbe statique, une Action du Mystique : un de ses orbes posé sur un point qu'il voit, 1 PV, DEF 0, du camp de son
   porteur ; au début de chaque tour, son état à tous les adversaires de sa zone de contact. Un seul à la fois. Améliorations :
   il lance gratuitement des orbes, autant que le porteur en possède au palier 2 ; il rampe du niveau du porteur en mètres vers
   l'adversaire le plus proche, et laisse un doublon au palier 2. Il ne joue pas de tour, n'est ni dans la liste ni au bilan, et
   s'efface avec le combat. */
{const page=fs.readFileSync('index.html','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const T=C.TALENTS_CODES;assert.equal(T.orbestatique.type,'act');assert.equal(T.orbestatiquelance.pour,'orbestatique');assert.equal(T.orbestatiquerampant.pour,'orbestatique');
 assert.equal(T.orbestatiquelance.nom,'Orbe statique — lance des orbes');assert.deepEqual(T.orbestatiquerampant.volets,[{cle:'doublon',nom:'Laisse un doublon à sa place d’avant',palier:2}]);
 assert.deepEqual(C.coutTalent({type:'act',effet:'orbestatique'}),{pa:1,pm:0},'une Action');
 assert.equal(C.campDe({orbeStatique:{camp:'troupe'}}),'troupe');assert.equal(C.campDe({orbeStatique:{camp:'adverse'}}),'adverse');
 assert.ok(C.hostiles({hero:true},{orbeStatique:{camp:'adverse'}})&&!C.hostiles({hero:true},{orbeStatique:{camp:'troupe'}}),'du camp de son porteur');
 assert.ok(page.includes("const TALENTS_EFFETS={orbestatique:{fn:orbeStatique,")&&page.includes("function nouvelOrbeStatique(a,etat,x,y,copie){const o=baseActor(false);")
  &&page.includes("hp:1,max:1,def:0,dmg:0,pool:[0,0,0,0,0,0,0],attacks:[],weapons:[]")&&page.includes("if(wallsBetween(a,pt,walls())){log(nomNum(a)+' ne voit pas ce point")
  &&page.includes("avant.forEach(o=>{o.hp=0;floatNumber(o,'Dissipé','nul')});"),'la pose, en vue, un seul à la fois');
 assert.ok(page.includes("async function orbesStatiquesDuTour(){if(orbesStatiquesEnCours||view!=='mj'||!enCombat())return;")
  &&page.includes("if(!rampe(o,b,niveau*tokenPx()))continue;")&&page.includes("if(voletOuvert(r,'doublon')){const c=nouvelOrbeStatique(a,o.orbeStatique.etat,avant.x,avant.y,true);")
  &&page.includes("const n=voletOuvert(lance,'tous')?orbesDuTour(a,codes):Math.max(1,Math.trunc(Number(lance.params&&lance.params.n))||1);")
  &&page.includes("orbe(a,orbesT.params,orbesT.talent,{cible:j,n:1,statique:true,depuis:o});await pauseOrbe(1100)}")
  &&page.includes("const gratuit=!!(opts.mitraille||opts.ricochet||opts.statique);")&&page.includes("const contacts=opts.statique?[]:contactsDe(a);"),'le début du tour, pas à pas');
 assert.ok(page.includes("if(effaceOrbesStatiques(false))render();orbesStatiquesDuTour()}")&&page.includes("if((commence||finit)&&!spect)effaceOrbesStatiques(true);")
  &&page.includes("function remiseAuTourUn(){round=1;renonceGeste();effaceOrbesStatiques(true);"),'effacé avec le combat');
 assert.ok(page.includes("function tourEpuise(){const debout=actors.filter(o=>alive(o)&&!o.orbeStatique);")&&page.includes("function defOf(a){if(a&&a.orbeStatique)return 0;")
  &&page.includes("function peutFrapperOpportunite(e){return !!e&&alive(e)&&!e.orbeStatique&&")&&page.includes("&&a.vu&&alive(a)&&!a.orbeStatique).length}")
  &&page.includes("if(de&&de!==vers&&enCombat()&&!vers.orbeStatique){")&&page.includes("if(a.orbeStatique)b.hidden=true;")&&page.includes("if(a.orbeStatique)jauge.hidden=true;"),'pas un combattant');
 assert.ok(vivant.includes("'mursElem','talentsJoues','orbeStatique',")&&feuille.includes(".token.orbe-statique .orbe-coeur{position:absolute;inset:15%;")
  &&feuille.includes(".token.orbe-statique.dead{display:none}")&&feuille.includes(".token.rampe{transition:left 1s ease-in-out,top 1s ease-in-out}"),'en ligne et sur la carte');}
/* v0.588 — L'en-tête range les états du combattant en deux cartouches, ceux des anciennes cibles : les états subis dans le
   rouge clair, ceux qui servent dans le vert clair, chacun seulement s'il en a ; les icônes gardent leur taille et les boutons
   descendent. La bulle d'Analyser dit son effet, son point de Mouvement et le jeton de l'adversaire visé. Essai v3 : les jetons
   des cibles flottent à droite de la bulle, centrés, derrière une petite flèche plate. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const tete=page.slice(page.indexOf('function renderTargets(){'),page.indexOf('function tourEpuise(){'));
 assert.ok(tete.includes("const bon=e=>ONDE_EXCLUS.includes(e)||e==='Gardé';")&&tete.includes("[[liste.filter(e=>!bon(e)),'adverses'],[liste.filter(bon),'allies']].forEach(([l,camp])=>{if(!l.length)return;")
  &&tete.includes("g.className='etats-tete cibles-groupe '+camp;")&&feuille.includes(".etat-tete{position:relative;display:grid;place-items:center;width:30px;height:30px;"),'deux cartouches, les icônes à leur taille');
 assert.ok(page.includes("rev.dataset.refus=refus;")&&page.includes("dit:'Révèle à toute la table les PV, la DEF et les dégâts de l’adversaire visé.',riche:rev.dataset.riche||'',note:rev.dataset.refus||'',")
  &&page.includes("points:{pa:0,pm:1},a:qui,cibles:j===null?[]:[j]})})}"),'la bulle d’Analyser');
 assert.ok(feuille.includes(".bulle-cibles{position:absolute;top:50%;left:100%;transform:translateY(-50%);margin-left:8px;")&&feuille.includes(".bulle-cibles::before{content:'';")
  &&src.includes("deborde=j?j.getBoundingClientRect().width+10:0;"),'les jetons à droite de la bulle, derrière la flèche');}
/* v0.587 — Le bouton du Mouvement prend un brun plus vif, qu'on ne confond plus avec un bouton grisé ; les pastilles de PM et
   les points de coût suivent. */
{const feuille=fs.readFileSync('editor.css','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.ok(feuille.includes("button.btn-analyse,button.btn-analyse.on,button.btn-mvt{--fond:#cf9152;")&&feuille.includes("button.btn-talent.t-mvt{--fond:#cf9152}")
  &&page.includes(".pastilles .mvt{background:#cf9152}")&&!/#b98b61/.test(feuille+page),'le Mouvement en brun vif');}
/* v0.586 — Les jetons des cibles ne poussent plus le texte de la bulle : ils montent au-dessus d'elle, ne mordant sur son bord
   que de 8 pixels, et la bulle garde sa marge d'avant. */
{const feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(!feuille.includes(":has(>.bulle-cibles){padding-top"),'le texte à sa place');}
/* v0.585 — L'en-tête de la barre d'action montre les états du combattant sélectionné lui-même, pas ceux de sa cible ; les
   jetons des cibles grossissent encore de 30 %. */
{const page=fs.readFileSync('index.html','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const tete=page.slice(page.indexOf('function renderTargets(){'),page.indexOf('function tourEpuise(){'));
 assert.ok(tete.includes("const liste=statesOf(a).filter(e=>e!=='Coma');if(!liste.length)return;")&&tete.includes("compteEtat(a,etat)")
  &&!tete.includes('ciblesDe(')&&!tete.includes('ciblesAttaque('),'l’en-tête dit les états du combattant');
 assert.ok(feuille.includes(".jeton-cible{position:relative;display:grid;place-items:center;width:47px;height:47px;")&&feuille.includes(".bulle-cibles{position:absolute;"),'des jetons de 47 pixels');}
/* v0.584 — Les jetons des cibles grossissent et passent au coin haut droit de la bulle. L'en-tête suit la cible que le coup
   prendrait quand aucune n'est désignée. Le Mouvement passe au beige tirant vers le brun, et Se relever, qui coûte un point de
   Mouvement, en prend la couleur. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(page.includes("scheduleSave()},'btn-action btn-mvt')}")&&page.includes(".pastilles .mvt{background:#cf9152}")
  &&!/#e0a04a|#b77b31|#f2e2c4/.test(feuille+page+src),'le Mouvement en beige brun, Se relever compris');}
/* v0.583 — L'en-tête de la barre d'action ne montre plus les cibles : les états de la cible désignée, en icônes, le compte
   d'un état qui se cumule en pastille, et au survol ce que l'état fait, ses valeurs comprises. Les cibles d'un geste se lisent
   à ses jetons, à cheval sur le coin haut gauche de sa bulle : celles que le coup ou le talent prendrait. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const tete=page.slice(page.indexOf('function renderTargets(){'),page.indexOf('function tourEpuise(){'));
 assert.ok(!tete.includes("b.className='cible'")&&!tete.includes('setTarget(')&&tete.includes("s.className='etat-tete'")&&tete.includes("className:'pastille-etat'")
  &&tete.includes("surveille(s,()=>bulleEtat(s,a,etat))")&&feuille.includes(".targets:not(:has(.etat-tete)){display:none}"),'les états du combattant dans l’en-tête');
 const x={actors:[],alive:o=>o&&o.hp>0,nomNum:o=>o.name};vm.createContext(x);
 vm.runInContext(page.slice(page.indexOf('function descriptionEtat('),page.indexOf("/* L'écu de DEF")),x);
 const o={id:'m',name:'Gobelin',hp:5,states:['Feu','Poison','Saignée','Furie','Foudre','Gardé','Ciblage'],cumuls:{Feu:3,Poison:1,Furie:2,Foudre:2},bleed:4};
 x.actors=[o,{id:'g',name:'Brann',hp:9,garde:'m'}];
 assert.equal(x.descriptionEtat(o,'Feu'),'À chaque nouveau tour, subit 3 dés noirs de dégâts, sans DEF.');
 assert.equal(x.descriptionEtat(o,'Poison'),'Après chacune de ses Actions, subit 1 dégât, sans DEF.');
 assert.equal(x.descriptionEtat(o,'Saignée'),'Chaque coup qui le touche lui inflige 4 dégâts de plus.');
 assert.equal(x.descriptionEtat(o,'Furie'),'+2 aux dégâts de ses coups.');
 assert.ok(x.descriptionEtat(o,'Foudre').endsWith('S’éteint dans 2 tours.'));
 assert.equal(x.descriptionEtat(o,'Gardé'),'Sous la garde de Brann.');
 assert.equal(x.descriptionEtat(o,'Ciblage'),'','sans effet en jeu, rien à dire');
 assert.ok(src.includes("function bulleEtat(ancre,o,etat){")&&src.includes("function jetonsCibles(a,liste){")&&src.includes("des=null,cout=false,palier=0,points=true,cibles=null}={}){")
  &&src.includes("points:{pa:1,pm:0},a,cibles:typeof ciblesAttaque==='function'?ciblesAttaque(a,at.range==='distance'?'distance':'contact'):null}));")
  &&src.includes("points:t.cout||false,cibles:t.cibles?t.cibles():null,")&&page.includes("cibles:()=>ciblesDuGeste(a,code.cle,params,talent),")
  &&page.includes("points:t.cout||false,cibles:t.cibles()})};")
  &&feuille.includes(".bulle-cibles{position:absolute;")&&feuille.includes(".jeton-cible.adverse{border-color:#c2604f;"),'les jetons des cibles sur les bulles');
 assert.ok(page.includes("function ciblesAttaque(a,portee){")&&page.includes("function ciblesDuGeste(a,cle,p,talent){")
  &&page.includes("if(cle==='orbes'){const al=alliePourIgnition(a);return al!==null?[al]:un(cibleOrbe(a))}")
  &&page.includes("return TALENTS_CODES[cle]&&TALENTS_CODES[cle].attaque?ciblesAttaque(a,portee):[]}"),'qui chaque geste viserait');}
/* v0.581 — Essai : les points de coût se placent juste à gauche du nom du talent, dans toutes les bulles, et plus dans le coin. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const s=pointsDeCout(c);if(s)tete.prepend(s)}")&&src.includes(" {const s=pointsDeCout(points);if(s)tete.prepend(s)}")
  &&feuille.includes(".talent-bulle-nom .cout-points{margin:0 -2px 0 0;display:inline-flex;gap:3px;align-self:center;flex:none;position:relative;top:-2px}"),'les points à gauche du nom');}
/* v0.580 — Le Mouvement prend les teintes brunes et beiges du bouton de PM, comme l'Action le bleu de son bouton : bouton
   à l'ocre d'Analyser, bulles, cartes, arbre et noms en brun sur beige. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(feuille.includes(".talent-detail.t-mvt{--teinte:#8a6440;background:#eee2d4;")&&feuille.includes(".bulle:has(.t-mvt){--bulle-bord:#eee2d4}")
  &&!feuille.includes('#2e9a8f')&&src.includes("const TEINTES_TALENTS={act:'#4f7fb5',mvt:'#8a6440',"),'le Mouvement en brun et beige');}
/* v0.579 — À la table aussi, la bulle d'un talent dit son coût en points, après ses dés s'il en a : celui que la table fait
   payer ; la bulle d'une attaque, son point d'Action. */
{const src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function pointsDeCout(c){if(!c||!(c.pa>0||c.pm>0))return null;")&&src.includes("vu:x=>talentPourElement(x,elementDe(a)),points:t.cout||false,")&&page.includes("return {talent,code,params,rangee,logo,cout,"),'le coût à la table');}
/* v0.578 — Dans la bulle d'un talent — fiche, onglet Talents, arbre —, son coût à la table en haut à droite : un point
   bleu par PA, un point ocre par PM ; pas dans la barre d'action, où les dés tiennent ce coin. Dans l'arbre, le
   cartouche d'XP monte à cheval sur le bord haut de la bulle, à droite. */
{const src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("s.className='cout-points';")
  &&feuille.includes(".talent-bulle-nom .cout-xp{position:absolute;top:0;right:12px;transform:translateY(-50%);")
  &&feuille.includes(".talent-bulle-nom .cout-points .pt.action{background:#3f8fe0}.talent-bulle-nom .cout-points .pt.mvt{background:#cf9152}"),'le coût en points, l’XP à cheval');}
/* v0.577 — Variables dans les descriptions de talents : {orbes}, {desorbe}, {endu}, {vie}, {pv}, {degats}, {def}, {niveau},
   {pa}, {pm}, accents et casse ignorés. Chez un combattant, sa valeur du moment, à la couleur de sa caractéristique ;
   sans combattant, le nom de la variable, souligné de points. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const VARIABLES_TALENT={")&&src.includes(" orbes:{teinte:'#3f7bc0',val:a=>orbesDuTour(a)},")&&src.includes(" endu:{stat:'endu',val:a=>enduAffichee(a)},")
  &&src.includes(" degats:{stat:'dmg',val:a=>degatsDe(a)},")&&src.includes("function texteEnrichi(el,texte,noms,a=null){")
  &&src.includes("el.append(c>=0?deDansTexte(c):motVariable(d[1],v,a));")&&src.includes("texteEnrichi(e,tp.effects,noms,a);")&&src.includes("texteEnrichi(e,tx,noms,a);g.append(e)};")
  &&feuille.includes(".mot-variable.sans-valeur{text-decoration:underline dotted;"),'les variables des descriptions');}
/* v0.576 — Coût des talents : une Action en PA, 1 par défaut, 0 pour une mécanique gratuite (Orbes, Charge) ; un nouveau
   type, Mouvement, en PM, 1 par défaut ; le MJ règle l'un ou l'autre de 0 à 9. Un talent ne se joue qu'une fois par tour en
   combat, même gratuit, sauf les Orbes mystiques, autant qu'il reste d'orbes ; ensuite il est grisé. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8'),partage=fs.readFileSync('shared.js','utf8');
 assert.deepEqual(C.coutTalent({type:'act'}),{pa:1,pm:0});assert.deepEqual(C.coutTalent({type:'act',effet:'orbes'}),{pa:0,pm:0});assert.deepEqual(C.coutTalent({type:'act',effet:'charge'}),{pa:0,pm:0});
 assert.deepEqual(C.coutTalent({type:'act',coutPA:3}),{pa:3,pm:0});assert.deepEqual(C.coutTalent({type:'mvt'}),{pa:0,pm:1});assert.deepEqual(C.coutTalent({type:'mvt',coutPM:0}),{pa:0,pm:0});
 assert.equal(C.coutTalent({type:'mait'}),null);assert.equal(C.coutTalent({type:'act',coutPA:12}).pa,1,'hors bornes, le défaut');
 assert.ok(src.includes("const TALENT_TYPES=[['act','ACT','Action'],['mvt','MVT','Mouvement'],")&&src.includes("const ORDRE_TYPES_TALENTS=['mait','act','mvt','reac','crit','pass','ame'];")
  &&src.includes("const GLYPHES_TALENT={act:'⚔',mvt:'➜',")&&src.includes("['coutPA','coutPM'].forEach(k=>{if(!(Number.isInteger(t[k])&&t[k]>=0&&t[k]<=9))delete t[k]});")
  &&src.includes('<label id="cout-action-champ" hidden><span id="cout-action-nom">Coût (PA)</span>')&&src.includes("nom.textContent=ty==='mvt'?'Coût (PM)':'Coût (PA)';")
  &&feuille.includes("button.btn-talent.t-mvt{--fond:#cf9152}")&&feuille.includes(".arbre-noeud.t-mvt{--teinte:#8a6440}"),'le type Mouvement et le coût à l’éditeur');
 assert.ok(page.includes("const TALENT_TYPES_CLES=['act','mvt','reac','pass','crit','mait','ame'];")&&page.includes("function dejaJoue(a,talent,code){return enCombat()&&!!a&&!!talent&&!(code&&code.cle==='orbes')")
  &&page.includes("const bloque=deja||manquePA||manquePM;")&&page.includes("if(dit===null){if(!ctx.pris&&!placementEnCours&&!fermeFormesMur)marqueTalent(a,talent,code);return}")
  &&page.includes("const pa=opts.sansAction?0:ctxT?ctxT.pa:1;")&&page.includes("if(ctx)payeTalent(ctx);else if(rangeeTalent(talent)==='attaques'")
  &&page.includes("const ctx=talentEnCours;\n viserCible('✦ Clique sur la carte pour poser '+m.name,(vise,q)=>{if(ctx)payeTalent(ctx);")
  &&(page.match(/a\.talentsJoues=\[\];/g)||[]).length>=3&&vivant.includes("'mursElem','talentsJoues',")&&partage.includes("'mursElem','talentsJoues',"),'une fois par tour, payé à la fin du geste');}
/* v0.575 — Mur d'élément : la forme se choisit en petites bulles rondes au-dessus du bouton, à sa couleur — 2 et un trait,
   3 et un trait coudé, 4 et un carré fermé —, plus de menu. Un clic ailleurs, Échap ou un autre geste les referme. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(!page.includes("menuCarte(nom,choix.map(")
  &&page.includes("function renonceGeste(){if(fermeFormesMur)fermeFormesMur();")&&page.includes("b.className='btn-action rond forme-mur';")
  &&page.includes("if(fond)b.style.setProperty('--fond',fond);")&&page.includes("const FORMES_MUR={2:'<path d=\"M5 17L19 7\"/>")
  &&src.includes("b.dataset.talent=t.talent&&t.talent.id||'';")&&feuille.includes("button.btn-action.rond.forme-mur{width:40px;height:40px;"),'les formes en bulles au-dessus du bouton');}
/* v0.574 — Recommencer le combat (↺) efface aussi les murs d'éléments ; un nouveau combat efface ce qui restait sur le terrain :
   murs, états des combattants, charges d'Ignition. Une pose en cours y renonce. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes(",commence=mode!=='combat'&&neuf==='combat',")&&page.includes(" if(commence&&!spect)actors.forEach(a=>{leveEtats(a,true,a.etatsPieges);a.ignition=''});")
  &&page.includes("a.orbesGardes=0;a.mursElem=[];a.garde=null;a.contactsDepart=null;"),'un combat qui recommence ou commence repart d’un terrain propre');}
/* v0.573 — Mur d'élément : un autre talent, ou une attaque, fait renoncer à la pose en cours ; chaque segment mesure au plus le
   niveau de l'aventurier qui le dresse, en mètres, sans limite pour un adversaire ; dès le premier point, un trait suit la souris
   avec sa distance, rouge au-delà, et un clic trop loin ne pose rien. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes("function viserCible(annonce,fn,refus,annule){renonceGeste();")&&page.includes("placementEnCours={poser,echap,annule};"),'un autre geste fait renoncer à la pose');
 assert.ok(page.includes("max=a.hero?Math.max(1,Math.trunc(Number(a.level))||1):Infinity;")&&page.includes("if(pts.length&&segmentsGuide(murEnCours,p).some(([u,w])=>distanceM(u,w)>max)){suivant();return}")
  &&page.includes("if(m.zone&&m.pts.length===m.total-1)l.push([q,m.pts[0]]);")&&page.includes("const d=distanceM(u,w),trop=d>m.max,")
  &&page.includes("#aim .mur-guide.trop-long{stroke:#e0483c;")&&page.includes("carte.removeEventListener('pointermove',suit)"),'la longueur au niveau, le trait qui suit la souris');}
/* v0.572 — Mur d'élément, une action du Mystique : 2 orbes, deux clics sur la carte, un trait de l'élément visible de toute la
   table ; tout adversaire qui le traverse ou le touche subit l'état 2. Améliorations : les dégâts de l'état, doublés au palier 2 ;
   3 orbes pour deux segments, puis 4 pour une zone à quatre coins. Les murs tombent à la fin du combat. */
{const T=C.TALENTS_CODES,page=fs.readFileSync('index.html','utf8'),vivant=fs.readFileSync('live.js','utf8'),partage=fs.readFileSync('shared.js','utf8'),ia=fs.readFileSync('ia.js','utf8');
 assert.equal(T.murelem.type,'act');assert.equal(T.murdegats.pour,'murelem');assert.equal(T.murzone.pour,'murelem');
 assert.deepEqual(C.voletsDe({effet:'murdegats'}),{double:2});assert.deepEqual(C.voletsDe({effet:'murzone'}),{zone:2});
 assert.ok(C.phraseTalent('murelem',{etat:'Gel'}).includes('Gel 2')&&C.phraseTalent('murzone',{},2).includes('zone à quatre coins')&&!C.phraseTalent('murzone',{},1).includes('zone'));
 const mur={pts:[[0,0],[100,0]]},zone={pts:[[0,0],[100,0],[100,100],[0,100]],zone:true};
 assert.ok(C.franchitMur(mur,[[50,-50],[50,50]],10)&&C.franchitMur(mur,[[50,-50],[50,-8]],10)&&!C.franchitMur(mur,[[50,-50],[50,-20]],10),'traverser ou toucher le mur');
 assert.ok(!C.franchitMur(mur,[[50,5],[60,5]],10)&&C.franchitMur(mur,[[50,5],[50,40],[50,5]],10),'qui s’y tient ne le franchit qu’en y revenant');
 assert.ok(C.franchitMur(zone,[[-50,50],[50,50]],5)&&!C.franchitMur(zone,[[40,50],[60,50]],5)&&C.toucheMur(zone,[50,50],5),'la zone, comme les murs');
 assert.ok(page.includes('<svg id="murs-elem" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>')
  &&page.includes("function viserCible(annonce,fn,refus,annule){")&&page.includes("a.orbes=orbesLances(a)+v.orbes;")&&page.includes("pts:pts.map(q=>({x:+q.x.toFixed(2),y:+q.y.toFixed(2)}))")
  &&page.includes("if(deg){const j=effectDice(o,5,2),total=j.total*(voletOuvert(deg,'double')?2:1);dit+=' '+subitDegatsEtat(o,e,total).dit}")
  &&page.includes("a.orbesGardes=0;a.mursElem=[];")&&page.includes("renderCombat();dessineMursElem();"),'le mur posé, dessiné, effacé à la fin du combat');
 assert.ok((page.match(/passeMurs\(/g)||[]).length>=7&&page.includes("chemin.push({x:o.x,y:o.y})")&&ia.includes("passeMurs(a,[depart,{x:a.x,y:a.y}])"),'chaque déplacement passe les murs');
 assert.ok(vivant.includes("'auraPv','mursElem',")&&partage.includes("'orbesGardes','mursElem',"),'le mur voyage avec son porteur');}
/* v0.571 — Les paliers d'XP se règlent à la main, dans les Paramètres, au MJ : la partie les porte, le niveau des aventuriers
   les suit. Contagion — au contact, puis en vue au palier 2. Dans l'arbre, les lignes tiennent aux cases : un talent qui
   part vers une place libre laisse les siennes à sa case, vide ; posé sur une case prise, les deux cases échangent ce
   qu'elles portent, pas leurs lignes. */
{const src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8'),partage=fs.readFileSync('shared.js','utf8'),T=C.TALENTS_CODES;
 assert.ok(C.niveauxXpValides(C.NIVEAUX_XP)&&!C.niveauxXpValides([0,300,200,...C.NIVEAUX_XP.slice(3)])&&!C.niveauxXpValides([5,...C.NIVEAUX_XP.slice(1)])&&!C.niveauxXpValides(C.NIVEAUX_XP.slice(1)),'des paliers qui montent, le premier à 0');
 assert.equal(C.niveauDeXp(400),2,'sans réglage, ceux d’origine');
 assert.ok(src.includes("if(!niveauxXpValides(c.niveauxXp)||c.niveauxXp.every((v,i)=>v===NIVEAUX_XP[i]))delete c.niveauxXp;")
  &&src.includes("+'<div id=\"bloc-niveaux\" hidden><div class=\"divider\"></div><h3 class=\"reglage-titre\">Niveaux d’XP</h3><div id=\"niveaux-xp\" class=\"niveaux-xp\"></div></div>'")
  &&src.includes("$('bloc-niveaux').hidden=view!=='mj';")&&src.includes("catalog.niveauxXp=l2;normalizeCatalog(catalog);niveauxHeros();")
  &&src.includes("function niveauxHeros(){actors.forEach(a=>{if(a&&a.hero)a.level=niveauDeXp(a.xp)})}")
  &&src.includes("catalog=normalizeCatalog(s.catalog);niveauxHeros();")&&partage.includes("catalog=structuredClone(remote.catalog);if(typeof niveauxHeros==='function')niveauxHeros();")
  &&src.includes(" const seuils=seuilsXp();"),'les paliers d’XP à la main');
 assert.deepEqual(C.voletsDe({effet:'contagioncontact'}),{vue:2});assert.ok(T.contagionvue.retire);
 assert.ok(C.phraseTalent('contagioncontact',{},2).includes('visibles')&&C.phraseTalent('contagioncontact',{},1).includes('au contact'));
 assert.ok(page.includes("vue=porteEffet(codes,'contagionvue')||codes.some(x=>x.code.cle==='contagioncontact'&&voletOuvert(x,'vue'))"),'Contagion en vue au palier 2');
 assert.ok(src.includes("function echangeCases(a,b){")&&src.includes("function laisseLignes(t){")&&src.includes("if(ailleurs){laisseLignes(t);detacheDeLArbre(t)}")
  &&src.includes(" if(occ&&avant){echangeCases(t,occ);")&&src.includes(" const reste=avant&&!ailleurs?laisseLignes(t):null;")&&src.includes(" if(avant)petitsHorsDesLignes(t);"),'les lignes tiennent aux cases');}
/* v0.570 — Améliorations du Mystique en deux paliers : Éruption — dégâts, doublés au palier 2 ; Invulnérable — ignore
   les dégâts d'un état, qui soignent au palier 2 ; Corps élémentaire, à chaque attaque au contact, puis à toute attaque,
   même à distance. Les anciennes améliorations restent comprises des talents qui les portent, hors des listes. */
{const T=C.TALENTS_CODES,page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 assert.deepEqual(C.voletsDe({effet:'eruptiondegats'}),{double:2});assert.deepEqual(C.voletsDe({effet:'ignoredegats'}),{soin:2});assert.deepEqual(C.voletsDe({effet:'corpselem'}),{distance:2});
 assert.equal(T.ignoredegats.pour,'invulnerable');assert.equal(T.ignoredegats.type,'ame');assert.ok(T.eruptiondouble.retire&&T.soinetat.retire&&!T.soinetatdouble.retire);
 assert.ok(!(T.corpselem.params||[]).some(p=>p.cle==='quand'),'plus de réglage « Quand »');
 assert.ok(C.phraseTalent('eruptiondegats',{},2).includes('doublés')&&!C.phraseTalent('eruptiondegats',{},1).includes('doublés'));
 assert.ok(C.phraseTalent('ignoredegats',{etat:'Gel'},2).includes('soignent')&&C.phraseTalent('ignoredegats',{etat:'Gel'},1).includes('ignore les dégâts'));
 assert.ok(C.phraseTalent('corpselem',{etat:'Feu'},2).includes('même à distance')&&C.phraseTalent('corpselem',{etat:'Feu'},1).includes('au contact'));
 assert.equal(C.effetParNom('Ignore les dégâts'),'ignoredegats');assert.equal(C.effetParNom('Ignore les dégâts — soin ×2'),'soinetatdouble');
 assert.ok(page.includes("function corpsElementaire(a,b,auContact){if(!a||!b||a===b||!hostiles(a,b))return '';")&&page.includes("let brule=corpsElementaire(a,b,rangeOf(a)!=='distance');")
  &&page.includes("const poserOrbe=()=>{const corpsO=corpsElementaire(a,b,false);")&&page.includes("apres+=corpsElementaire(a,b,true);")
  &&page.includes("(a.hp===0?' 💀':'')+corpsElementaire(e,a,true))})}")&&!page.includes("corpsE.params.quand"),'Corps élémentaire à chaque attaque');
 assert.ok(page.includes("porteEffet(c,'soinetat')||ignores.some(x=>voletOuvert(x,'soin'))?1:0;")
  &&page.includes("codes.some(x=>x.code.cle==='eruptiondegats'&&voletOuvert(x,'double'))"),'les paliers en jeu');
 assert.ok(src.includes(".filter(c=>c.cle!=='bonus'&&!c.retire).map(c=>{")&&src.includes(".filter(c=>c.cle!=='bonus'&&(!c.retire||c.cle===valeur))"),'les anciennes hors des listes');}
/* v0.569 — Au MJ, sous le total d'XP d'un arbre de classe : le total par tranches de niveau, d'après les niveaux marqués
   sur les lignes ; un petit rond compte avec son talent. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes('function niveauxRequis(classe){')&&src.includes("const n=Math.max(req.get(u.id),niveauLien(u,v)||1);")
  &&src.includes("e.textContent='Niv. '+(fin===undefined?s+'+':fin-1>s?s+'-'+(fin-1):s)+' : '"),'le total par tranches de niveau');}
/* v0.568 — Un bonus tiré vers un petit rond vide (place libre, case vide, remplissage) y pose une copie de lui-même ;
   l'original reste. Sur un rond occupé, les deux échangent leurs places, comme avant. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("if(tire&&estBonus(tire)&&dest.chemin&&(!autre||estVide(autre))){const copie={...structuredClone(tire),id:crypto.randomUUID()};delete copie.chemin;delete copie.horsArbre;"),'la copie du bonus');}
/* v0.567 — Deux talents sous un même identifiant : la copie exacte s'en va au chargement, une autre prend un identifiant
   à elle ; l'éditeur de talents retrouve le talent ouvert par son identifiant, pas par sa place dans la liste. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes("if(JSON.stringify(d)===JSON.stringify(t))return false;t.id=crypto.randomUUID();vus.set(t.id,t);return true});if(l.length!==c.talents.length)c.talents=l}")
  &&src.includes("if(talentIndex!==null&&talentEdite){const k=catalog.talents.findIndex(x=>x&&x.id===talentEdite);if(k>=0)talentIndex=k}"),'les doublons et l’éditeur');}
/* v0.566 — Journal : la tête de mort suit le nom de la victime, sur la ligne de l'attaque, au lieu d'une ligne à elle. */
{const page=fs.readFileSync('index.html','utf8');assert.ok(page.includes("if(mort)suite=String(suite).replace(/\\s*💀/g,'').trim();")&&page.includes("li.append(' ',nom(b),...(mort?[' 💀']:[]),' : ');"),'la tête de mort après le nom');}
/* v0.565 — Pas de billes de palier sous un bonus de l'arbre : seulement sous les petits ronds des améliorations. */
{const src=fs.readFileSync('editor.js','utf8');assert.ok(src.includes("if(max>1&&t.effet!=='bonus'){b.classList.add('a-paliers');"),'pas de billes sous un bonus');}
/* v0.563 — Fiche d'aventurier : un bonus compte sa valeur au palier tenu, dans le rond qui additionne les bonus identiques. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("forEach(x=>{const p=paramsTalent(talentAuPalier(x,palierDe(a,x)))||{},carac=p.carac||'pv',k=carac+(carac==='comp'?':'+p.comp:'');"),'la valeur au palier tenu');}
/* v0.561 — Siphon (Mystique) : un adversaire tué par un orbe rend aussitôt un orbe ; un de plus, ou au palier 2 un par cran
   de l'élément du lanceur sur la cible tuée, un au moins (v0.562) ; un soin de x dés verts. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),T=C.TALENTS_CODES;
 assert.ok(T.siphon.type==='pass'&&T.siphonplus.pour==='siphon'&&T.siphonsoin.pour==='siphon','les trois effets');
 assert.ok(C.phraseTalent('siphonplus',{},1,{parelement:2}).includes('<b>+1 orbe</b>.')&&C.phraseTalent('siphonplus',{},2,{parelement:2}).includes('par cran de son <b>élément</b>')
  &&C.phraseTalent('siphonsoin',{des:3},2).includes('3 dés verts'),'les phrases');
 assert.ok(page.includes("const gain=1+(plus?voletOuvert(plus,'parelement')?Math.max(1,crans):1:0),avant=orbesLances(a);a.orbes=Math.max(0,avant-gain);")
  &&page.includes("if(b.hp===0&&hostiles(b,a))siphon(a,Math.max(cransAvant,element?compteEtat(b,element):0))};"),'le moteur');}
/* v0.560 — Lamevent s'appelle Ombrelame partout : la classe, ses arbres, ses talents et leurs textes, ses aventuriers, les
   noms de ses effets (l'ancien nom retrouve encore l'effet). Flèches vers l'arbre de la classe voisine ; dans l'onglet
   Talents, les talents d'une classe dans un cadre à sa couleur, qui ouvre l'arbre. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.equal(C.TALENTS_CODES.lamevent.nom,'Coupure');assert.equal(C.effetParNom('Lamevent'),'lamevent');assert.equal(C.effetParNom('Ombrelame'),'lamevent');
 assert.ok(!page.includes('Lamevent')&&src.includes("function normalizeCatalog(c){c||={};c.items||=[];c.monsters||=[];c.talents||=[];migreOmbrelame(c);")
  &&src.includes("a.role=ombrelame(a.role);")&&fs.readFileSync('catalog.js','utf8').includes('"name": "Ombrelame"'),'le nouveau nom, et la conversion des données');
 assert.ok(src.includes("if(i>=0&&l.length>1)openArbresClasse(l[(i+sens+l.length)%l.length])};arbresDialog.append(b);return b});")&&src.includes("noteArbres('');renderArbres();if(!arbresDialog.open)arbresDialog.showModal()}")
  &&feuille.includes('#arbres .arbres-fleche{position:fixed;'),'les flèches');
 assert.ok(src.includes("cadre.onclick=e=>{if(!e.target.closest('.cat-carte,button'))openArbresClasse(famille)}")&&feuille.includes('.talents-cadre{padding:10px;'),'le cadre des talents');}
/* v0.559 — Un bonus d'Endurance posé dans l'arbre vaut +2 ; le compteur des bonus de l'arbre tient sur trois lignes :
   caractéristiques (Vie, Endu, PV, Dégâts, DEF), orbes et propres à une classe, compétences par ordre alphabétique. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const v=carac==='endu'?2:1,params={carac,valeur:v,")&&src.includes("name:'+'+v+' '+nom,"),'Endurance à +2');
 assert.ok(src.includes("const CARACS=['vie','endu','pv','dmg','def'],")&&src.includes("groupes[k.startsWith('comp:')?2:CARACS.includes(k)?0:1].push(e)")
  &&src.includes(".localeCompare(nomComp('comp:'+y.p.comp),'fr')")&&feuille.includes('#arbres .dialog-head .arbres-bonus-ligne{display:flex;'),'trois lignes');}
/* v0.558 — La piste des dés : une ligne qui ne tient pas passe à la rangée suivante, le « + » du critique avec ses dés ; la
   place des visages d'après ceux qui paraissent ; la piste change de largeur, le dernier lancer s'y repose sans tomber. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes("if(avant&&w&&dernierJet&&$('dice-tray').childElementCount)rollOnBoard(...dernierJet,true)"),'la piste ne déborde plus');}
/* v0.556 — Ricochet (Mystique) : un orbe qui ne passe pas la DEF repart de sa cible vers l'adversaire le plus proche d'elle
   et relance ses dés ; des rebonds en plus ; un critique rebondit aussi, deux orbes au palier 2. Sans coût d'orbe. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),T=C.TALENTS_CODES;
 assert.ok(T.ricochet.type==='pass'&&T.ricochetplus.pour==='ricochet'&&T.ricochetcritique.pour==='ricochet','les trois effets');
 assert.ok(C.phraseTalent('ricochetplus',{fois:2},1).includes('2 fois</b> supplémentaires')&&C.phraseTalent('ricochetcritique',{},2,{double:2}).includes('deux orbes')&&!C.phraseTalent('ricochetcritique',{},1,{double:2}).includes('deux orbes'),'les phrases');
 assert.ok(page.includes("const duree=volOrbe(opts.depuis||a,b,des.couleur,teinte);")
  &&page.includes("if(!r.hit)ricocher(a,p,talent,opts,b,1);return}")&&page.includes("if(cc)ricocher(a,p,talent,opts,b,voletOuvert(cc,'double')?2:1)")
  &&page.includes("const poser=()=>{poserOrbe();if(!opts.ricochet)opportuniteAuTir(a,contacts,'sort')};"),'le moteur');}
/* v0.555 — Orbes mystiques, dés en plus : chaque orbe lance x dés Mystiques supplémentaires, x réglé à chaque palier ;
   ils s'ajoutent aux siens, ou à côté d'eux s'ils sont d'une autre couleur. La clé reste « orbes2des ». */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8');
 const tenus=x=>[{code:C.TALENTS_CODES.orbes,params:{orbes:1,des:1}},...x.map(([cle,params])=>({code:C.TALENTS_CODES[cle],params}))];
 const d1=C.desOrbe(tenus([['orbes2des',{des:2}]])),d2=C.desOrbe(tenus([['orbes2des',{des:1}],['orbesrouges',{}]]));
 assert.deepEqual(C.poolOrbe(d1,2),{blue:6});
 assert.deepEqual(C.poolOrbe(d2,1),{red:1,blue:1});assert.equal(C.texteDesOrbe(d1),'3 dés Mystiques');assert.equal(C.texteDesOrbe(d2),'1 dé Lourd et 1 dé Mystique');
 assert.ok(C.phraseTalent('orbes2des',{des:1},1).includes('1 dé Mystique</b> supplémentaire.')&&C.phraseTalent('orbes2des',{des:2},2).includes('2 dés Mystiques</b> supplémentaires.'),'la phrase');
 assert.ok(page.includes("for(let o=0;o<n;o++){for(let i=0;i<des.n;i++)tous.push([d6(),c]);for(let i=0;i<des.plus;i++)tous.push([d6(),cm])}")&&page.includes("Math.floor(tous.indexOf(dice[i])/Math.max(1,parOrbe))"),'le jet');}
/* v0.552 — Seul un invité de table, venu par son lien ou assis à elle, est rangé d'office en vue joueur. Ni la
   publication reçue sans compte MJ reconnu, ni une identité anonyme seule ne basculent plus l'appareil du MJ. */
{const part=fs.readFileSync('shared.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(part.includes("const enJoueur=()=>{if(admin||vueChoisie()||!(typeof tableVoulue!=='undefined'&&tableVoulue))return;")
  &&vivant.includes("function spectateur(){if(estMJ())return false;\n return enLigne||tableVoulue}"),'seul un invité passe en vue joueur');}
/* v0.551 — La vue est retenue sur l'appareil, comme l'onglet : recharger la rend telle quelle, et un appareil qui en a une
   n'est plus jeté en vue joueur faute de compte MJ reconnu. Un onglet que seul le MJ ouvre fait de l'appareil celui du MJ. */
{const page=fs.readFileSync('index.html','utf8'),part=fs.readFileSync('shared.js','utf8'),cartes=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(page.includes("view=vueChoisie()==='player'?'player':'mj',")&&page.includes("view=$('view').value;retiensVue(view);")&&page.includes('<select id="view" autocomplete="off">'),'la vue retenue');
 assert.ok(cartes.includes("if(p!=='table'&&!vueChoisie()&&!ongletsJoueurs().includes(p))retiensVue('mj');")
  &&vivant.includes("else if(vueImposee&&!spectateur()){vueImposee=false;view=vueChoisie()||'mj';"),'jamais jeté en vue joueur');}
/* v0.549 — Deux paliers au plus pour une amélioration ou un bonus : la troisième colonne se cache, ce qu'elle gardait reste.
   Recharger ne jette plus le MJ en vue joueur sur la table : on attend que son compte soit reconnu, la table qu'il a
   ouverte ne se rouvre qu'en MJ, une identité anonyme sans lien de table s'efface. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8'),part=fs.readFileSync('shared.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(src.includes("let html='<table class=\"paliers-table'+(trois?'':deux?' deux-paliers':' un-palier')+'\">")&&feuille.includes('.paliers-table.deux-paliers tr>:nth-child(n+4){display:none}')
  &&src.includes("return n===3?'<div hidden>'+champs+'</div>':champs}).join('')+'</div>'"),'deux colonnes, deux champs');
 assert.ok(part.includes("auth.onAuthStateChanged(async user=>{admin=false;adminConnu=!user;")&&part.includes("render();rendPage();status("),'la vue attend le compte');
 assert.ok(vivant.includes("if(!lien){if(deja&&deja.isAnonymous)try{await auth.signOut()}catch(e){}")&&vivant.includes("document.addEventListener('amertume-mj-change',rouvre);rouvre();return}"),'la table du MJ se rouvre en MJ');}
/* v0.548 — Thésaurisation (Mystique) : les orbes non lancés à la fin du tour restent au tour suivant, tous, ils s'accumulent (v0.550) ;
   +x orbes en plus s'il en garde au moins un (v0.554) ; un soin de 1d6, puis 3d6, par orbe non lancé, avant les orbes en plus (v0.553). */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),T=C.TALENTS_CODES;
 assert.ok(T.thesaurisation&&T.thesaurisation.type==='pass'&&T.thesaurisationfois.pour==='thesaurisation'&&T.thesaurisationsoin.pour==='thesaurisation','les trois effets');
 assert.ok(C.phraseTalent('thesaurisationfois',{orbes:1},1).includes('+1 orbe</b>')&&C.phraseTalent('thesaurisationfois',{orbes:3},2).includes('+3 orbes</b>')
  &&C.phraseTalent('thesaurisationsoin',{},1,{trois:2}).includes('1d6')&&C.phraseTalent('thesaurisationsoin',{},2,{trois:2}).includes('3d6'),'les phrases à chaque palier');
 assert.ok(page.includes("function orbesDuTour(a,c){const n=orbesPermis(c||talentsCodes(a));return n?n+orbesGardes(a):0}")&&!/orbesPermis\(talentsCodes\(a\)\)/.test(page)
  &&page.includes("const n=Math.max(0,orbesDuTour(a,c)-orbesLances(a));a.orbesGardes=n+(plus&&n>0?Math.max(1,Math.trunc(plus.params&&plus.params.orbes)||1):0);")
  &&page.includes("actors.forEach(o=>regenerer(o,'fin'));actors.forEach(ombreFuyante);actors.forEach(thesauriser);round++;"),'le moteur');
 assert.ok(fs.readFileSync('live.js','utf8').includes("'orbes','orbesGardes',")&&fs.readFileSync('shared.js','utf8').includes("'orbes','orbesGardes',"),'les orbes gardés voyagent');}
/* v0.547 — Les deux bulles d'un palier, centrées, restent dans l'arbre ; grisé, le palier pas encore accessible ou dépassé ;
   au dernier, le précédent et lui. Ailleurs, la bulle ne lit que le palier tenu. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const k=a?palierDe(a,t):0,n=Math.max(1,Math.min(k,max-1));")&&src.includes("if(p<k||p>k+1)d.classList.add('grisee');return d};")
  &&src.includes("d.append(une(n,note),f,une(n+1));return d};"),'la paire de bulles et leurs couleurs');
 assert.ok(src.includes("const cadre=bulleEl.querySelector('.bulles-paliers')&&bulleEl.closest('#arbres')")&&!src.includes('bulle-ancree')
  &&feuille.includes('.bulle:has(>.bulles-paliers)::after{display:none}'),'centrées, dans l’arbre');
 assert.ok(src.includes("const montres=palier||a?[palier||Math.max(1,k)]:Array.from({length:max},"),'ailleurs, le seul palier tenu');}
/* v0.546 — Un rond à paliers de l'arbre : deux bulles, le palier tenu — le premier s'il n'est pas pris — puis, après une
   petite flèche, le suivant. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("const bulleNoeud=(t,verrou,note)=>{const max=paliersDe(t);"),'les deux bulles d’un palier');
 assert.ok(feuille.includes('.bulles-paliers{display:flex;')&&feuille.includes('.bulles-paliers>.palier-suite{'),'la flèche');}
/* v0.545 — Les paliers, pour les améliorations et les bonus seuls : « Paliers » coché, deux, et trois si le troisième a
   un coût, un texte ou des réglages ; les talents restent à un palier. Billes sous le petit rond, montée au clic. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),avant=C.PALIERS.actifs;C.PALIERS.actifs=false;
 const P=t=>C.paliersDe(t);
 assert.ok(P({type:'act',paliersActifs:true,couts:[1,2,3]})===1&&P({type:'pass',paliersActifs:true})===1&&P({type:'ame'})===1,'un talent, ou une amélioration sans la case, reste à un palier');
 assert.ok(P({type:'ame',paliersActifs:true})===2&&P({type:'ame',paliersActifs:true,couts:[0,0,5]})===2&&P({type:'ame',paliersActifs:true,paliers:{3:{effects:'x'}}})===2,'une amélioration à paliers : deux au plus');
 assert.ok(P({type:'pass',effet:'bonus',params:{carac:'dmg',valeur:1}})===1&&P({type:'pass',effet:'bonus',paliersActifs:true,paliers:{3:{params:{carac:'dmg',valeur:3}}}})===2,'un bonus à paliers : deux au plus');
 assert.ok(C.talentAuPalier({type:'pass',effet:'bonus',paliersActifs:true,params:{carac:'dmg',valeur:1},paliers:{2:{params:{carac:'dmg',valeur:2}}}},2).params.valeur===2,'la valeur d’un bonus suit son palier');
 assert.ok(src.includes("name=\"paliersActifs\"")&&src.includes("name=\"b_paliers\"")&&src.includes("if(acquis&&palierDe(a,t)<paliersDe(t)){const n=palierDe(a,t)+1;")&&src.includes("const pal={};if(t.effet!=='bonus'||t.paliersActifs===true)"),'l’éditeur et l’arbre');C.PALIERS.actifs=avant;}
/* v0.544 — La fin du combat ne dit plus « Plus un adversaire debout » ni la liste des états effacés ; ils s'effacent quand même. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(!page.includes('Plus un adversaire debout : le combat prend fin.')&&!page.includes('les états s’effacent (')&&page.includes('actors.forEach(a=>leveEtats(a,true));'),'la fin du combat, sans ces deux lignes');}
/* v0.543 — L'amélioration tenue qui remplace le texte d'un talent remplace aussi sa ligne dans la bulle de l'Attaque. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes('function ameliorationsTenues(a,t){')&&src.includes("const y=!lisChemin(x)&&ameliorationsTenues(a,x).remplace||x;")&&src.includes('if(a&&!cout&&!lisChemin(t)){const {ams,remplace}=ameliorationsTenues(a,t);'),'la même amélioration fait le texte des deux bulles');}
/* v0.542 — « Fin du combat : Statistiques. » ; plus de « Début du tour » ; pas de séparateur de tour hors combat. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes("bilan?'Fin du combat :':'Fin du combat.',bilan?{bilan}:undefined")&&page.includes("b.textContent='Statistiques';")&&page.includes("li.append(' ',b,'.')"),'la fin du combat');
 assert.ok(!page.includes("log('Début du tour '")&&page.includes("function separateurTour(j){if(rejeuJournal||logRound===round||!enCombat())return;")&&page.includes("bilanPartis=[];logRound=null}"),'les tours au journal');}
/* v0.541 — Stats de Combat : une distinction tient en deux lignes, le nom du combattant en bulle au survol de son token. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(!src.includes("'stats-prix-qui'")&&src.includes("jeton.setAttribute('aria-label',p.top.nom);")&&src.includes("ouvrirBulle(jeton,d,'bulle-talent')"),'le nom au survol du token');}
/* v0.540 — Le compteur des bonus de l'arbre en icônes chiffrées, deux lignes au plus, le nom en bulle. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("c.className='arbres-bonus-n';boite.className='bonus-ico';if(ic)boite.append(remplitCase(ic));")&&src.includes("ouvrirBulle(c,d,'bulle-talent')"),'le compteur condensé');}
/* v0.539 — Stats de Combat : le token du combattant désigné à chaque distinction, l'icône des Dégâts après les dégâts de
   chaque camp, « Mise à Mort » au lieu de « mis à terre ». */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(!src.includes("el('span','stats-medaille',p.ico)")
  &&src.includes("i.src=imgUrl('DEGATS.webp');i.alt='';i.draggable=false;v.append(' ',i)")&&src.includes("['abat','Mise à Mort']];")&&!src.includes("'mis à terre'"),'tokens, icône des Dégâts, Mise à Mort');}
/* v0.538 — Bulle d'un bonus « + 2 <icône> Endu » ; sous le total d'XP de l'arbre, ce qu'il donne de chaque caractéristique ;
   un talent posé sur un autre, ou une amélioration sur une autre, échangent leurs places. */
{const src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("if(talent&&c!=='pa'&&c!=='pm'){const t=nom.textContent;nom.textContent=t.charAt(0).toUpperCase()+t.slice(1).toLowerCase()}")&&src.includes("boite.append(remplitCase(ic));plus.after(' ',boite)}"),'la bulle d’un bonus');
 assert.ok(src.includes('function nomBonusArbre(p,n){')&&src.includes("l.className='arbres-bonus';")&&feuille.includes('#arbres .dialog-head .arbres-bonus{'),'le compteur des bonus de l’arbre');
 assert.ok(src.includes('function echangeTalents(id,b){')&&src.includes('if(autre&&echangeTalents(id,autre)){arbreChange();return}')&&src.includes("[a.liens,b.liens]=[b.liens,a.liens];"),'l’échange de places');}
/* v0.537 — Stats de Combat : chaque combattant compte ses chiffres là où le geste a lieu, ils voyagent avec lui ; la fin
   du combat les fige dans sa ligne du journal, que « Stats de Combat » ouvre chez chacun. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),ia=fs.readFileSync('ia.js','utf8');
 assert.ok(page.includes('function encaisse(a,n,de){')&&page.includes('compteDegats(de===undefined?auteurCoup:de,a,perdu>0?Math.max(perdu,Math.trunc(n)):0);')&&page.includes("compteDegats(a,b,lost>0?Math.max(lost,damage):0);")
  &&page.includes("auteurCoup=a;queueMicrotask(()=>{auteurCoup=null});ajouteBilan(a,'coups',1);")&&page.includes("ajouteBilan(a,'crit',1)")&&page.includes("applyHeal=function(a,m){const g=soinSansBilan(a,m);if(g>0)ajouteBilan(a,'soin',g);return g}"),'les compteurs de dégâts, coups, critiques et soins');
 assert.ok((page.match(/compteDistance\(/g)||[]).length>=7&&ia.includes("compteDistance(a,depart);if(typeof passeMurs==='function')passeMurs(a,[depart,{x:a.x,y:a.y}]);afterMove(a);"),'la distance, là où un mouvement connaît son départ');
 assert.ok(page.includes('bilan:r.detail&&r.detail.bilan||undefined'),'le bilan figé au journal, rejoué');
 assert.ok(vivant.includes("'enrage','bilan',\n 'xp','level','skills','endu','vieMax','pvBonus','sexe','race','malusPieges','enjambe','franchis','etatsPieges','tenuPar','entendu','discret','crie','ecoutes','connu','analysesFaites','debutTour','avantPiege'];")&&vivant.includes("...(meta&&meta.bilan?{detail:{bilan:meta.bilan}}:{})")&&vivant.includes('bilan:rec.detail&&typeof rec.detail===\'object\'&&rec.detail.bilan||undefined'),'en ligne : les compteurs et la ligne du bilan');
 assert.ok(src.includes('function lisBilan(o){')&&src.includes('function ouvrirStatsCombat(brut){const b=lisBilan(brut);if(!b)return;'),'la fenêtre');
 // Le bilan venu d'ailleurs est relu : chiffres bornés, noms coupés, camp connu.
 {const vm=require('vm'),deb=src.indexOf('function lisBilan(o){'),fin=src.indexOf('const statsDialog=');const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(deb,fin)+';this.r=lisBilan({tours:"3",liste:[{nom:"x".repeat(99),camp:"pirate",inf:-4,sub:"12",pic:1e9},null]});',ctx);
  assert.ok(ctx.r.tours===3&&ctx.r.liste.length===1&&ctx.r.liste[0].nom.length===60&&ctx.r.liste[0].camp==='adverse'&&ctx.r.liste[0].inf===0&&ctx.r.liste[0].sub===12&&ctx.r.liste[0].pic===1e6,'le bilan relu');}}
/* v0.536 — Les talents de mouvement voient par-dessus les alliés de celui qui se déplace ; une cible repoussée heurte tout
   socle vivant ; la piste des dés défile, sans titre. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes('function vusPourMouvement(a,provoque){')&&page.includes('function cibleCharge(a){const vues=vusPourMouvement(a,false);')&&page.includes('const vues=vusPourMouvement(a,true);'),'Charge et Provocation voient par-dessus les alliés');
 assert.ok(page.includes('function moveActor(a,xp,yp,libre,ignorer,traverse,heurte){')&&page.includes('soclesOccupes(a,size,ignorer,!heurte)')&&page.includes('moveActor(b,vise.x,vise.y,false,null,false,true);'),'la poussée heurte tous les socles');
 assert.ok(!page.includes('<div class="eyebrow">Dégâts</div>')&&page.includes('.piste-des{display:flex;flex-direction:column;gap:8px;height:220px;overflow:hidden auto}')&&page.includes("$('piste-des').scrollTop=0;"),'la piste défile, sans titre');}
/* v0.535 — Le rond de remplissage de l'arbre : ni talent ni amélioration, une case vide colorée, à l'icône « ? » réglable
   une fois pour toutes ; il tient lignes et petits ronds, un talent posé dessus les reprend, l'onglet Talents l'ignore. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes('const estRemplissage=t=>estVide(t)&&t.remplissage===true;')&&src.includes('function poseRemplissage(dest,couleur){const v=caseVideA(dest);if(v){v.remplissage=true;v.couleur=couleur;return true}')
  &&src.includes("COULEURS_REMPLISSAGE.forEach(k=>{const b=document.createElement('button');")&&src.includes("ico('✕','Supprimer ce rond de remplissage',()=>{delete t.remplissage;delete t.couleur;arbreChange()})"),'le rond de remplissage');
 assert.ok(src.includes("if(t.remplissage!==true||t.vide!==true){delete t.remplissage;delete t.couleur}")&&src.includes("selGroupes('Remplissage','remplissage',catalog.logoRemplissage||'',groupes)")
  &&src.includes("c.liste.forEach(t=>{if(estVide(t)&&!estRemplissage(t))return;"),'sa couleur, son icône, ses petits ronds');}
/* v0.533 — Les dés de dégâts au bout de la ligne du titre des bulles, sans retour à la ligne ; la Charge et la Provocation
   ne laissent pas de cible derrière elles ; l'élan du socle au contact, un peu plus ample. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function desAuTitre(tete,des){des.classList.add('bulle-des');tete.classList.add('avec-des');tete.append(des)}")&&(src.match(/desAuTitre\(tete,/g)||[]).length===4
  &&feuille.includes('.bulle:has(.talent-bulle-nom.avec-des){min-width:min-content}')&&feuille.includes('.talent-detail .talent-bulle-nom .bulle-des .pips{flex-wrap:nowrap}'),'les dés sur la ligne du titre');
 const ch=page.slice(page.indexOf('function charge(a,p,talent){'),page.indexOf('const TALENTS_EFFETS={'));
 assert.ok(!ch.includes('poseCibles('),'ni la Charge ni la Provocation ne désignent leur cible');
 assert.ok(page.includes("l=tokenOf(de)*.38;")&&page.includes("],300,0);\n return 120}"),'l’élan plus ample');}
/* v0.532 — Espace retire tous les ciblages de la carte, au MJ, touche réglable ; la sauvegarde globale emporte aussi
   les campagnes, le journal, les réglages de l'appareil et le domaine de secours, et les repose à l'import. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),camp=fs.readFileSync('campagnes.js','utf8'),dom=fs.readFileSync('domaine.js','utf8');
 assert.ok(page.includes("vue:'m',decible:'espace'};")&&page.includes("actors.forEach(a=>poseCibles(a,[]));render();scheduleSave()")&&page.includes("if(view!=='mj'||")&&src.includes("c.id='rac-decible'"),'Espace retire les ciblages, au MJ, réglable');
 assert.ok(src.includes('async function exporterTout(){')&&src.includes('Object.assign(s,await x.lit())')&&src.includes('await x.pose(s)')
  &&src.includes("{nom:'le journal',")&&src.includes("{nom:'les réglages',")&&dom.includes("{nom:'le domaine de secours',")&&camp.includes("{nom:'les campagnes',"),'les annexes de la sauvegarde globale');
 assert.ok(camp.includes('if(c&&(c.modifie||0)>=t)continue;')&&src.includes("localStorage.getItem(k)===null)localStorage.setItem(k,r[k])"),'l’import n’écrase ni une campagne plus récente ni un réglage de l’appareil');}
/* v0.531 — Les noms des talents d'un arbre à la couleur de leur nature dans les bulles des siens ; un adversaire relevé
   hors combat relance le combat ; des mètres entiers ; le coup du socle au contact ; le choc d'une cible repoussée qui bute ;
   la poussée de la Charge tenue par toute amélioration de poussée. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(src.includes("const bonus=t.effet==='bonus',noms=bonus?null:nomsDeLArbre(t);"),'les bulles passent les noms de l’arbre');
 {const vm=require('vm'),deb=src.indexOf('const TEINTES_TALENTS='),fin=src.indexOf('function motsDans(');
  const T=[{id:'c',name:'Charge',famille:'Destructeur',type:'act'},{id:'e',name:'Enragement',famille:'Destructeur',type:'pass'},{id:'o',name:'Orbe',famille:'Mage',type:'act'}];
  const ctx={catalog:{talents:T},lisChemin:t=>t.chemin||null,talent:id=>T.find(t=>t.id===id),talentFamily:t=>t.famille||'Génériques',estVide:()=>false,estBonus:()=>false,
   talentType:t=>[t.type],ACCOLADES:/\{([^}]+)\}/,sorteAccolade:()=>false,libelleAccolade:k=>k};
  vm.createContext(ctx);vm.runInContext(src.slice(deb,fin)+';this.n=nomsDeLArbre(catalog.talents[1]);',ctx);
  const vus=[...'Après une CHARGE, l’Orbe, la Chargeuse et **Charge**.'.matchAll(ctx.n.rx)].map(x=>x[0]);
  assert.ok(JSON.stringify(vus)==='["CHARGE","**Charge**"]'&&ctx.n.couleur('CHARGE')==='#4f7fb5'&&ctx.n.couleur('enragement')==='#8a8474','Charge en bleu d’Action ; ni l’Orbe d’un autre arbre, ni la Chargeuse, ni le gras');}
 assert.ok(page.includes("if(!enCombat()&&revenus.some(a=>campDe(a)==='adverse'&&a.vu&&!a.hidden&&!a.horsCarte))"),'un adversaire relevé relance le combat');
 assert.ok(page.includes("function distanceM(a,b){return Math.floor(metres(a,b,mapSize(),tokenPx()))}")&&page.includes("lab.textContent=d+' m';")&&page.includes("m=venu?Math.floor(metres(depart,a,size,tokenPx())):0"),'des mètres entiers, arrondis par défaut');
 assert.ok(!page.includes('vfx-taillade')&&!page.includes('function volBalayage(')&&vivant.includes("coupDeToken(acteurDuJournal(rec.a),acteurDuJournal(rec.b))"),'le coup du socle remplace la taillade');
 assert.ok(page.includes("chocImpact(b,a,bouge?170:0)")&&vivant.includes("rec.effet==='choc'"),'le choc d’une cible qui bute, ici et en face');
 assert.ok(page.includes("repousse=loin||impact||porteEffet(codes,'chargerepousse')"),'toute amélioration de poussée repousse');}
/* v0.530 — Charge : l'élan en deux crans, la moitié puis toute la distance ; l'impact, double des dégâts d'opportunité
   contre un mur ou un adversaire. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8');const K=C.TALENTS_CODES;
 assert.ok(/moitié de la distance/.test(K.chargeelan.phrase({}))&&/la distance parcourue/.test(K.chargeelan.phrase({part:'tout'}))&&K.chargeelan.params[0].defaut==='moitie','l’élan, moitié par défaut');
 assert.ok(K.chargeimpact&&K.chargeimpact.type==='ame'&&/double/.test(K.chargeimpact.phrase({})),'l’impact');
 assert.ok(page.includes("const elan=parts.length?Math.floor(m*Math.max(...parts)):0")&&page.includes("info.bloque=contre?'adversaire':wallsBetween(b,vise,walls())?'mur':''"),'élan en deux crans, impact contre mur ou adversaire');}
/* v0.529 — Un bouton de talent grisé dit pourquoi dans sa bulle ; la vérification ne rejoue que les jeux dont les sources ont changé. */
{const src=fs.readFileSync('editor.js','utf8'),verif=require('fs').readFileSync('verif.cjs','utf8');
 assert.ok(!src.includes("note:t.peut?'':t.titre"),'aucune raison de refus dans la bulle d’un talent : seul le texte du MJ');
 assert.ok(verif.includes("CACHE='.git/verif-cache.json'")&&verif.includes("const LIT={'des-checks.cjs':['combat.js']};")&&verif.includes("if(!garde)cache[f]={k,dit}")&&verif.includes("process.argv.includes('--tout')"),'la vérification en cache, par empreinte');}
/* v0.528 — Le dernier lancer reste sur la piste jusqu'au suivant ; une attaque sans ciblage préalable ne laisse pas de cible ;
   un bouton « Distances » montre ou cache les distances des flèches, pour chacun. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(!page.includes("diceTimer=setTimeout(")&&page.includes("const avant=ciblesDe(a).slice(),designee=avant.includes(i);\n if(!designee)setTarget(i);\n if(ciblesDe(a).includes(i))attack();\n if(!designee){poseCibles(a,avant);render()}}"),'les dés restent, la cible ne reste pas');
 assert.ok(page.includes('id="distances-vue">📏</button>')&&page.includes("localStorage.getItem('amertume-distances')!=='0'")&&page.includes("$('aim').classList.toggle('sans-distances',!distancesOn)")
  &&page.includes("#aim.sans-distances .aim-dist{display:none!important}"),'le bouton des distances');}
/* v0.527 — Chiffre de distance réduit de 30 %. Charge, action du Destructeur : un mouvement jusqu'au contact puis une
   attaque au contact, pour un seul point de Mouvement ; l'élan en bonus de dégâts ; la cible repoussée hors de la zone,
   puis de la distance parcourue. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 const K=C.TALENTS_CODES;assert.ok(K.charge.type==='act'&&K.charge.gratuit===true&&['chargeelan','chargerepousse','chargerepoussedist'].every(k=>K[k]&&K[k].type==='ame'),'Charge et ses trois améliorations');
 assert.ok(src.includes("charge:'Destructeur',chargeelan:'Destructeur',chargerepousse:'Destructeur',chargerepoussedist:'Destructeur'"),'chez le Destructeur');
 assert.ok(page.includes("lab.style.fontSize=Math.max(6.3,tokenPx()*.154).toFixed(1)+'px';"),'le chiffre, 30 % plus petit');
 assert.ok(page.split("actionPriseAuDepart=true;if(pa)depensePoint(a,'action',pa);").length===3&&page.includes("const pa=opts.sansAction?0:ctxT?ctxT.pa:1;"),'l’attaque de la Charge ne prend pas l’Action, et porte son élan');
 assert.ok(page.includes("attack({vises:[j],sansAction:true,bonusEnPlus:elan,")&&page.includes("de>0?d+de:0)+2;"),'un point de Mouvement, l’élan, la poussée');}
/* v0.526 — Le chiffre de distance plus petit, et à la couleur du ciblage : bleu clair s'il part, rouge clair s'il est bloqué. */
{const page=fs.readFileSync('index.html','utf8');assert.ok(page.includes("#aim .aim-dist.etat-ok{fill:#a9d2f7}#aim .aim-dist.etat-no{fill:#f6a59c}"),'taille et couleur du chiffre');}
/* v0.525 — L'unité de distance : le diamètre d'un socle moyen vaut 1 m. Sur le trait de ciblage, la distance de centre
   à centre, à une décimale. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8');
 const size={width:1000,height:500};assert.equal(C.metres({x:10,y:50},{x:40,y:50},size,50),6,'300 px pour un socle de 50 px : 6 m');
 assert.equal(C.metres({x:0,y:0},{x:0,y:20},size,50),2,'en hauteur aussi, de centre à centre');assert.equal(C.metres({x:0,y:0},{x:1,y:1},size,0),0,'sans carte mesurée, 0');
 assert.ok(page.includes("if(k){if(fleche._dist)fleche._dist.remove();fleche.remove()}")&&page.includes("#aim .aim-dist.on{display:block}"),'la distance sur chaque trait, éteinte avec lui');}
/* v0.524 — Furie : un état empilable, +1 aux dégâts du combattant par cran ; son icône se choisit comme celle de Gardé. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 const a={states:[]};assert.ok(C.cumulable('Furie')&&C.ETATS_JEU.includes('Furie'),'empilable, et posable par un effet');
 C.infligeEtat(a,'Furie');C.infligeEtat(a,'Furie');C.infligeEtat(a,'Furie');assert.equal(C.compteEtat(a,'Furie'),3,'trois crans');
 const b={states:['Onde']};assert.ok(C.infligeEtat(b,'Furie')===true&&C.hasState(b,'Onde'),'l’Onde ne l’absorbe pas');
 assert.ok(page.includes("'Foudre','Furie','Gardé'")&&page.includes("const GLYPHES_ETATS={'Gardé':'🛡','Furie':'💢'};")
  &&page.includes("'Furie':'#e2463c'}"),'dans les dégâts, au menu, son glyphe, sa couleur');
 assert.ok(src.includes("selGrille(selGroupes('Furie','etat-furie',(catalog.logosEtats||{})['Furie']||'',groupes))")&&src.includes("const etat=nom==='etat-garde'?'Gardé':'Furie'"),'son icône se choisit');}
/* v0.523 — Enragement, passif de Destructeur : chaque critique ajoute +1 aux dégâts du porteur jusqu'à la fin du
   combat, +2 avec son amélioration ; le compte repart de zéro quand le combat finit ou que la rencontre repart. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(C.TALENTS_CODES.enragement.type==='pass'&&C.TALENTS_CODES.enragementplus.type==='ame'&&/\+2/.test(C.TALENTS_CODES.enragementplus.phrase({})),'le passif et son amélioration');
 assert.ok(src.includes("enragement:'Destructeur',enragementplus:'Destructeur'"),'rangés chez le Destructeur');
 const ctx={combat:true,enCombat:()=>ctx.combat,porteEffet:C.porteEffet||((c,k)=>c.some(t=>t.code.cle===k)),flots:[],floatNumber:(a,t)=>ctx.flots.push(t),
  talentsCodes:a=>a.codes.map(k=>({code:{cle:k},params:{}}))};vm.createContext(ctx);
 vm.runInContext(page.slice(page.indexOf('function enrage(a){'),page.indexOf('function mouvementRapide(a){'))+';this.enrage=enrage;',ctx);
 const d={codes:['enragement']},d2={codes:['enragement','enragementplus']},autre={codes:[]};
 ctx.enrage(d);ctx.enrage(d);ctx.enrage(d2);ctx.enrage(autre);
 assert.ok(d.enrage===2&&d2.enrage===2&&!autre.enrage&&ctx.flots.join('|')==='+1 Dégâts|+1 Dégâts|+2 Dégâts','+1 par critique, +2 amélioré, rien sans le talent');
 ctx.combat=false;ctx.enrage(d);assert.equal(d.enrage,2,'hors combat, rien');
 assert.ok(page.includes("if(r.critical){implosion(a);orbesDuCritique(a);enrage(a)}")
  &&page.includes("a.contactsDepart=null;a.enrage=0;")&&page.includes("a.ignition='';a.enrage=0;"),'dans les dégâts, à chaque critique, remis à zéro, en ligne');}
/* v0.522 — Maîtrise Point supplémentaire : +1 point d'Action ou de Mouvement à chaque tour. Dans l'arbre, une ligne
   peut sauter un gros rond vide pour relier deux talents à deux cases l'un de l'autre, en droite ligne. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),page=fs.readFileSync('index.html','utf8');
 const k=C.TALENTS_CODES.pointsupp;assert.ok(k&&k.type==='mait'&&/\+1 point d’Action/.test(k.phrase({}))&&/de Mouvement/.test(k.phrase({quoi:'mouvement'})),'la maîtrise déclarée');
 globalThis.pointsDeTalents=(a,q)=>a.maitrise===q?1:0;
 const h={points:{action:1,mouvement:1,objet:1},maitrise:'action'};
 assert.deepEqual([C.pointsMax(h,'action'),C.pointsMax(h,'mouvement'),C.pointsMax(h,'action',true)],[2,1,1],'+1 Action, la fiche garde 1');
 h.points.action=4;assert.equal(C.pointsMax(h,'action'),5,'au-delà du plafond');delete globalThis.pointsDeTalents;
 assert.ok(src.includes("a.points={action:pointsMax(a,'action',true),mouvement:pointsMax(a,'mouvement',true),objet:pointsMax(a,'objet',true)};")
  &&page.includes("+c.filter(t=>t.code.cle==='pointsupp'&&((t.params&&t.params.quoi)||'action')===quoi).length}"),'la fiche ne garde que sa base');
 // L'arbre : la ligne qui saute une case vide.
 const ctx={DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],LIENS_MAX:4,petitsDe:()=>[]};vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('function posDe(t){'),src.indexOf('const liensDe='))+'const liensDe=t=>Array.isArray(t&&t.liens)?t.liens:[];'
  +src.slice(src.indexOf('function dirVers(p,q){'),src.indexOf('function lisChemin(t){'))+src.slice(src.indexOf('function basculeLien(de,vers,liste){'),src.indexOf('/* Les colonnes d\'une classe'))+';this.basculeLien=basculeLien;this.dirLien=dirLien;',ctx);
 const haut={id:'h',pos:{x:0,y:0}},bas={id:'b',pos:{x:0,y:2}},loin={id:'l',pos:{x:0,y:3}},biais={id:'d',pos:{x:1,y:2}},liste=[haut,bas,loin,biais];
 assert.equal(ctx.basculeLien(haut,bas,liste),'ajoute','deux cases plus bas, la case du milieu libre');
 assert.ok(ctx.basculeLien(haut,loin,liste)==='loin'&&ctx.basculeLien(haut,biais,liste)==='loin','trois cases, ou de biais : non');
 const milieu={id:'m',pos:{x:0,y:1}};assert.equal(ctx.basculeLien(bas,haut,[...liste,milieu]),'loin','un talent au milieu : la ligne ne saute pas');
 assert.ok(src.includes("const r=basculeLien(de,t,col.liste);")&&src.includes("occupe.add((p.x+q.x)/2+','+(p.y+q.y)/2)"),'au tracé, et la case sautée ne s’offre plus');}
/* v0.521 — L'or et les gemmes au tableau en masse du Bestiaire ; un PNJ qui bascule en adverse sous les yeux de
   la troupe est révélé et lance le combat ; la vérification tourne en parallèle. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),verif=require('fs').readFileSync('verif.cjs','utf8');
 assert.ok(src.includes("{cle:'bourse',nom:'Or et gemmes',type:'panneau',tri:m=>normaliseBourse(m.bourse).length},")&&src.includes("else if(quoi==='bourse')corps.append(editeurBourse(m,fini));")
  &&src.includes("else if(quoi==='bourse'){const l=ligneBourse(m.bourse);if(l)b.append(l)}")&&src.includes("bourse:'Or et gemmes'"),'la colonne Or et gemmes');
 assert.ok(page.includes("()=>{a.alignementJeu=k;basculeAdverse(a);render();scheduleSave()}")&&page.includes("function basculeAdverse(a){if(campDe(a)!=='adverse'||!alive(a)||a.hidden||")
  &&page.includes("floatNumber(a,'Révélé !','nul');log(nomNum(a)+' est révélé.',{ton:'reveal'});\n if(!enCombat())setTimeout(()=>{if(!enCombat())basculerMode('combat',true)},0)}"),'adverse en vue : révélé, et le combat');
 // Le basculement, joué : en vue il révèle et lance le combat ; hors de vue, rien.
 const ctx={alive:a=>a.hp>0,hasState:()=>false,prochainNumero:()=>1,nomNum:a=>a.name,flots:[],floatNumber:(a,t)=>ctx.flots.push(t),journal:[],log:t=>ctx.journal.push(t),
  combat:false,enCombat:()=>ctx.combat,basculerMode:m=>{ctx.combat=m==='combat'},setTimeout:f=>f(),vue:true,troupeVoit:()=>ctx.vue};vm.createContext(ctx);
 vm.runInContext(page.slice(page.indexOf('function basculeAdverse(a){'),page.indexOf('\n',page.indexOf('if(!enCombat())setTimeout(()=>{if(!enCombat())basculerMode(\'combat\',true)},0)}',page.indexOf('function basculeAdverse(a){'))))+';this.basculeAdverse=basculeAdverse;',ctx);
 const pnj={name:'Orvel',pnj:true,alignement:'neutre',alignementJeu:'adverse',hp:5};ctx.basculeAdverse(pnj);
 assert.ok(pnj.vu===true&&ctx.flots[0]==='Révélé !'&&ctx.journal[0]==='Orvel est révélé.'&&ctx.combat,'en vue : Révélé !, et le combat');
 ctx.flots.length=0;ctx.combat=false;ctx.vue=false;ctx.basculeAdverse({name:'Ysol',pnj:true,alignementJeu:'adverse',hp:5});
 ctx.basculeAdverse({name:'Mira',pnj:true,alignementJeu:'allie',hp:5});ctx.vue=true;ctx.basculeAdverse({name:'Mira',pnj:true,alignementJeu:'allie',hp:5});
 assert.ok(!ctx.flots.length&&!ctx.combat,'hors de vue, ou allié : rien');
 assert.ok(verif.includes("JEUX=['checks.cjs','des-checks.cjs','shared-checks.cjs','id-checks.cjs']")&&verif.includes('await Promise.all(JEUX.map(lance))'),'les jeux de tests en parallèle');}
/* v0.520 — Cinq jetons par ligne au Bestiaire ; un outil PNJ à l'éditeur de cartes ; un PNJ unique n'existe qu'en un
   exemplaire sur une carte ; et sur la table, le MJ change l'alignement d'un PNJ le temps de la rencontre. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const p={pnj:true,alignement:'neutre'};assert.equal(C.campDe(p),'neutre');p.alignementJeu='allie';
 assert.ok(C.alignementDe(p)==='allie'&&C.campDe(p)==='troupe'&&p.alignement==='neutre','l’alignement du moment l’emporte, le modèle reste');
 assert.equal(C.alignementDe({pnj:true,alignement:'neutre',alignementJeu:'bof'}),'neutre');
 const t=C.cleanMap({foes:[{x:1,y:1,tpl:{name:'Garde',pnj:true,alignement:'allie',unique:true}},{x:2,y:2,tpl:{name:'Loup',unique:true}}]}).foes;
 assert.ok(t[0].tpl.unique===true&&!('unique' in t[1].tpl),'un PNJ seul garde « unique »');
 // Le Bestiaire : cinq colonnes par catégorie.
 assert.ok(feuille.includes('#bestiary-cols .cat-col.armurerie-grille{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));')&&feuille.includes('#bestiary-cols .cat-pill.gear-carre.best-carre{width:100%;max-width:69px;height:auto;aspect-ratio:1}'),'cinq jetons par ligne');
 // La fiche : la case Unique ; le modèle garde l'alignement du Bestiaire, pas celui du moment.
 assert.ok(src.includes('>Unique</label>\':\'\')')&&src.includes("if(a.pnj&&f.unique){if(f.unique.checked)a.unique=true;else delete a.unique}")
  &&src.includes("alignement:alignementDe({pnj:true,alignement:a.alignement}),...(a.unique===true?{unique:true}:{})")&&src.includes("'pool','pnj','alignement','unique','mouvement'])]"),'la case Unique');
 assert.ok(src.includes("if(m.pnj&&m.unique===true&&actors.some(a=>a&&!a.hero&&a.template===m.id)){")&&src.includes("const n=m.pnj&&m.unique===true?1:"),'sur la table, un seul exemplaire');
 // L'éditeur de cartes : l'outil PNJ, sa liste, l'unique, la couleur.
 assert.ok(mp.includes('<button data-tool="pnj">PNJ</button><select id="map-pnj-tpl"')&&mp.includes("catalog.monsters.forEach((m,i)=>$(m.pnj?'map-pnj-tpl':'map-foe-tpl').add(")
  &&mp.includes("if(mapTool==='foe'||mapTool==='pnj'){")&&mp.includes("const deja=t.pnj&&t.unique===true?mapDraft.foes.findIndex(f=>f&&f.tpl&&f.tpl.id===t.id):-1;")
  &&mp.includes("if(t&&t.pnj&&t.unique===true){if(uniques.has(t.id))return;uniques.add(t.id)}")&&feuille.includes('.shape.foe.al-allie{'),'l’outil PNJ');
 // La fiche de table : le bouton d'alignement, au MJ ; en ligne, au MJ seul.
 assert.ok(page.includes('<button type="button" class="sheet-class" id="pnj-camp" hidden></button>')&&page.includes("function pnjCamp(a){const b=$('pnj-camp');b.hidden=!(a&&a.pnj&&view==='mj');")&&vivant.includes("'alignementJeu','debutTour'];")&&/CHAMPS_ACTEUR_MJ=\[[^\]]*'alignementJeu'/.test(vivant),'l’alignement du moment');}
/* v0.519 — L'or et les gemmes d'un adversaire, d'un PNJ ou d'un coffre, tirés aux dés : une bourse de lignes
   « x d y », avec, pour un adversaire, la chance qu'elle tombe. Tirée au retrait de l'adversaire, ou à
   l'ouverture du coffre. */
{const C=require('./combat.js'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 assert.deepEqual(C.normaliseBourse([{k:'or',n:2,f:6,p:150},{k:'eclat-rubis',n:1,f:0},{k:'cuivre',n:1,f:6},{k:'or',n:0,f:6},'x']),[{k:'or',n:2,f:6,p:100},{k:'eclat-rubis',n:1,f:1}],'bornée, clés connues, sans ligne vide');
 assert.deepEqual(C.normaliseBourse([{k:'or',n:3,f:4,p:20}],false),[{k:'or',n:3,f:4}],'un coffre ne garde pas de chance');
 let n=0;const seq=[.1,.99,.5,.7,0];assert.deepEqual(C.tireBourse([{k:'or',n:2,f:6,p:50},{k:'eclat-rubis',n:1,f:4,p:50},{k:'brisure-citrine',n:1,f:4}],()=>seq[n++]),{or:10,'brisure-citrine':1},'la chance d’abord, puis chaque dé');
 assert.deepEqual(C.tireBourse([{k:'or',n:30,f:1}],()=>.99),{or:30},'30d1, trente tout rond');
 assert.deepEqual(C.phraseRichesses({or:12,'eclat-rubis':1,'brisure-citrine':3}),['12 or','3 brisures de citrine','1 éclat de rubis'],'en mots, au singulier comme au pluriel');
 const m=C.cleanMap({foes:[{x:1,y:1,bourse:[{k:'or',n:1,f:6,p:40}],tpl:{name:'Gob',bourse:[{k:'or',n:3,f:4,p:20}]}}],coffres:[{x:1,y:1,w:2,h:2,bourse:[{k:'or',n:2,f:6,p:10}]}]});
 assert.ok(m.foes[0].bourse[0].p===40&&m.foes[0].tpl.bourse[0].n===3&&JSON.stringify(m.coffres[0].bourse)==='[{"k":"or","n":2,"f":6}]','la carte garde les bourses');
 // Au retrait : la bourse tombe à l'aventurier le plus proche, avec ses pièces, sur la même ligne du journal.
 const ctx={actors:[],log:t=>ctx.journal.push(t),journal:[],document:{dispatchEvent(){}},Event:class{},objetDe:()=>null,ajouterInventaire(){},ajouteOr:C.ajouteOr};vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('const lisPourcent='),src.indexOf('/* Les familles où l\'on puise'))+src.slice(src.indexOf('function plurielMot('),src.indexOf('/* Un adversaire retiré de la scène laisse son XP'))+src.slice(src.indexOf('function butinDesRetires('),src.indexOf('/* Rejouer la même rencontre'))+';this.butinDesRetires=butinDesRetires;',ctx);
 const brom={name:'Brom',hero:true,x:10,y:10,hp:5,richesses:{or:3}};ctx.actors.push(brom,{name:'Ysa',hero:true,x:80,y:10,hp:5});
 ctx.butinDesRetires([{name:'Gobelin',hero:false,x:12,y:10,bourse:[{k:'or',n:2,f:6,p:100},{k:'eclat-rubis',n:1,f:1,p:100}]}],()=>.5);
 assert.equal(JSON.stringify(brom.richesses),JSON.stringify({or:11,'eclat-rubis':1}),'8 or et un éclat de rubis');
 assert.equal(ctx.journal[0],'Brom trouve 8 or, 1 éclat de rubis (Gobelin).');
 ctx.journal.length=0;ctx.butinDesRetires([{name:'Rat',hero:false,x:12,y:10,bourse:[{k:'or',n:1,f:6,p:30}]}],()=>.5);assert.equal(ctx.journal.length,0,'30 % : un tirage à 50 ne tombe pas');
 // L'éditeur : dans l'inventaire de tout adversaire, PNJ compris, et au coffre ; le modèle et la carte la portent.
 assert.ok(src.includes("boite.append(possede,...(restes?[]:[editeurBourse(cible,apres)]),barre,grille);")&&src.includes("function editeurBourse(cible,apres,avecChance=true){")
  &&src.includes("bourse:normaliseBourse(m.bourse),")&&src.includes("bourse:normaliseBourse(a.bourse),")&&src.includes("if(bourse.length)a.bourse=[...normaliseBourse(a.bourse),...bourse];"),'l’éditeur et le modèle');
 assert.ok(mp.includes("$('coffre-bourse').append(editeurBourse(bourse,null,false));")&&mp.includes("c.richesses={};const b=normaliseBourse(bourse.bourse,false);")
  &&mp.includes("Object.entries(tireBourse(c.bourse)).forEach(([k,v])=>{rich[k]=(Math.trunc(Number(rich[k]))||0)+v});")&&mp.includes("const des=ligneBourse(c.bourse);")
  &&mp.includes("f.bourse=normaliseBourse(f.bourse);if(!f.bourse.length)delete f.bourse;"),'le coffre tire sa bourse à l’ouverture, l’adversaire posé garde la sienne');
 assert.ok(feuille.includes('.bourse-gemme{width:26px;height:26px;'),'en ligne, et en petit');}
/* v0.518 — Les PNJ du Bestiaire : un alignement, allié, neutre ou adverse. Allié, il combat avec la troupe et se
   range parmi les Aventuriers ; neutre, il se tient entre les deux et peut s'en prendre à la troupe ; adverse, il
   est un adversaire. Son socle et sa barre de PV prennent la couleur de son alignement. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),ed=fs.readFileSync('editor.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),feuille=fs.readFileSync('editor.css','utf8');
 const h={hero:true},m={},al={pnj:true,alignement:'allie'},ne={pnj:true,alignement:'neutre'},ad={pnj:true,alignement:'adverse'};
 assert.deepEqual([h,m,al,ne,ad].map(C.campDe),['troupe','adverse','troupe','neutre','adverse'],'chacun son camp');
 assert.equal(C.alignementDe({pnj:true}),'neutre','un PNJ sans alignement lu est neutre');
 assert.equal(C.alignementDe({pnj:true,alignement:'bof'}),'neutre');
 assert.ok(C.hostiles(h,m)&&C.hostiles(h,ne)&&C.hostiles(h,ad)&&C.hostiles(al,m)&&C.hostiles(al,ne),'la troupe et ses alliés affrontent neutres et adversaires');
 assert.ok(!C.hostiles(h,al)&&!C.hostiles(ne,m)&&!C.hostiles(ad,m)&&!C.hostiles(m,m),'ni entre alliés, ni entre neutres et adversaires');
 assert.ok(C.memeCamp(h,al)&&C.memeCamp(ad,m)&&!C.memeCamp(ne,m)&&C.duCoteTroupe(al)&&!C.duCoteTroupe(ne));
 const t=C.cleanMap({foes:[{x:1,y:1,tpl:{name:'Marchand',pnj:true,alignement:'allie'}},{x:2,y:2,tpl:{name:'Loup'}}]}).foes;
 assert.ok(t[0].tpl.pnj===true&&t[0].tpl.alignement==='allie'&&!('pnj' in t[1].tpl),'la carte garde l’alignement de son PNJ');
 // Le Bestiaire : une colonne PNJ, un bouton, l'alignement dans la fiche, porté du modèle à la créature et retour.
 assert.ok(ed.includes("['boss','Boss'],['pnj','PNJ']];")&&ed.includes("filter(([m])=>(key==='pnj'?!!m.pnj:!m.pnj&&(m.type||'standard')===key)")
  &&ed.includes('<button id="bestiary-pnj">+ Nouveau PNJ</button>')&&ed.includes("$('bestiary-pnj').onclick=()=>openActor(null,false,null,true,true);")
  &&ed.includes("if(templateNeuf&&pnj)Object.assign(draft,{name:'Nouveau PNJ',role:'PNJ',pnj:true,alignement:'neutre'});")
  &&ed.includes("+(a.pnj?sel('Alignement','alignement',alignementDe({pnj:true,alignement:a.alignement}),ALIGNEMENTS)+'<label class=\"field-check\"><input name=\"unique\" type=\"checkbox\" '+(a.unique===true?'checked':'')+'>Unique</label>':'')"),'la colonne, le bouton et le menu Alignement');
 assert.ok(ed.includes("butin:normaliseButin(m.butin),bourse:normaliseBourse(m.bourse),...(m.pnj?{pnj:true,alignement:alignementDe(m),...(m.unique===true?{unique:true}:{})}:{})}}")&&ed.includes("butin:normaliseButin(a.butin,a.inventaire),bourse:normaliseBourse(a.bourse),...(a.pnj?{pnj:true,alignement:alignementDe({pnj:true,alignement:a.alignement}),...(a.unique===true?{unique:true}:{})}:{})}}")
  &&ed.includes("'pool','pnj','alignement','unique','mouvement'])]")&&ed.includes("if(!neuf.pnj){delete a.pnj;delete a.alignement}if(!neuf.unique)delete a.unique;"),'l’alignement suit le modèle sur la table');
 // Un allié tué ne rapporte pas d'XP ; la troupe lit ses PV.
 assert.ok(ed.includes("const vaincus=partants.filter(f=>f&&!duCoteTroupe(f)&&")&&page.includes("function hpKnown(o){return view==='mj'||connait(o,'pv')}")&&page.includes("function connait(o,k){return !!o&&(!!o.hero||duCoteTroupe(o)||connuDe(o).has(k))}"));
 // La table : trois groupes ; seul un adverse lance le combat et le tient ouvert.
 assert.ok(page.includes("(duCoteTroupe(a)?troupe:campDe(a)==='neutre'?neutres:adverses).push(b);")&&page.includes("if(neutres.some(b=>!b.hidden))groupe('Neutres',neutres);")
  &&page.includes("if(!enCombat()&&reveles.some(a=>campDe(a)==='adverse'))"),'les groupes et le combat');
 assert.ok(!/\b\w+(?:\[\w+\])?\.hero(?:!==|===)\w+(?:\[\w+\])?\.hero\b/.test(page),'plus aucun camp lu au seul drapeau d’aventurier');
 // Les couleurs : socle et barre, liste, fiche et jauge.
 assert.ok(page.includes(".token.pnj.al-allie{background:#2b4466;border-color:#8fb6e0}")&&page.includes(".token.pnj.al-neutre{background:#5c4a1e;border-color:#dcc074}")
  &&page.includes("#pv-layer .pv.al-allie i,.lifebar.foe.al-allie .lifebar-fill{")&&page.includes("if(a.pnj)jauge.classList.add('al-'+alignementDe(a));")
  &&page.includes("lifebar(ratio(a),known?String(a.hp):'',a.hero,a.pnj?alignementDe(a):'')")&&feuille.includes('.best-carre.al-allie{--type:#8fb6e0}'),'les couleurs de l’alignement');
 // En ligne : l'alignement voyage, et seul le MJ l'écrit.
 const champs=JSON.parse(vivant.match(/const CHAMPS_VIVANTS=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"')),mj=JSON.parse(vivant.match(/const CHAMPS_ACTEUR_MJ=(\[[\s\S]*?\]);/)[1].replace(/'/g,'"'));
 assert.ok(['pnj','alignement'].every(k=>champs.includes(k)&&mj.includes(k)),'pnj et alignement suivent la table, au MJ seul');}
/* v0.517 — Les mots flottants : un état à la couleur de son icône ; posés ensemble sur un socle, l'un au-dessus de l'autre. */
{const page=fs.readFileSync('index.html','utf8');
 assert.ok(page.includes("const COULEURS_ETATS={'Poison':'#b968d3','Blindage':'#689fd3','Feu':'#f0903a','Foudre':'#f2d14a','Gel':'#8fd3f7',")
  &&page.includes("if(etat&&COULEURS_ETATS[etat])el.style.color=COULEURS_ETATS[etat];")
  &&page.includes("el.style.top='calc('+cible.y+'% - '+(tokenOf(cible)*.62+rang*fs*1.1)+'px)';"),'couleur des états et pile des mots');}
/* v0.516 — Dominateur, générique : contre les adversaires avec l'état réglé, le double, +x ou +xdx de dégâts, ou pas d'échec. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 const ph=p=>C.texteBrut(C.phraseTalent('dominateur',p));
 assert.deepEqual([ph({mode:'double',etat:'Feu'}),ph({mode:'plus',etat:'Poison',x:3}),ph({mode:'des',etat:'Saignée',nb:2,faces:'8'}),ph({})],
  ['Le porteur double ses dégâts contre les adversaires avec Feu.','Le porteur augmente ses dégâts de +3 contre les adversaires avec Poison.',
   'Le porteur augmente ses dégâts de +2d8 contre les adversaires avec Saignée.','Le porteur n’effectue pas d’échec contre les adversaires avec Au sol.'],'les quatre réglages');
 assert.deepEqual(C.dominateurDe({x:99,nb:0,faces:'7'}),{mode:'sansechec',etat:'Au sol',x:20,nb:1,faces:6},'bornes');
 const v=C.variablesPhrase('dominateur',C.paramsTalent({effet:'dominateur',params:{mode:'des'}})),vus=[...v.variables.map(x=>x.cle),...v.hors];
 C.TALENTS_CODES.dominateur.params.forEach(p=>assert.ok(vus.includes(p.cle),'dominateur : '+p.cle+' se règle dans la bibliothèque'));
 assert.ok(page.includes("let domDit='';if(domP&&(dom==='plus'||dom==='des')&&!r.failed&&r.hit){")&&!src.includes("dominateur:'Lamevent'"),'câblé à la frappe, rangé aux Génériques');}
/* v0.515 — Un adversaire caché le reste jusqu'à ce que le MJ le révèle, qu'il frappe, ou qu'il bouge sous les yeux de la
   troupe ; la case Caché de l'éditeur vaut aussitôt pour la carte ouverte. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),mp=fs.readFileSync('maps.js','utf8');
 assert.equal(C.cleanMap({id:'m',name:'M',foes:[{id:'p1',x:1,y:1,tpl:{id:'t',name:'T',pv:3}}]}).foes[0].id,'p1','la pose garde son identifiant');
 assert.ok(mp.includes("if(!f.id)f.id=crypto.randomUUID();a.pose=f.id;")&&mp.includes("const a=adversaireDeLaTable(mapDraft,f);if(a){a.hidden=f.cache===true;render();scheduleSave()}"),'la case Caché suit sur la table');
 assert.ok(page.includes("a.hidden=false;a.vu=true;")&&page.includes("function reveleEnBougeant(a){"),'frapper ou bouger en vue le trahit');}
/* v0.513 — Glissant : qui finit son mouvement sur le token du porteur tombe Au sol, et le porteur caché est révélé. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8');
 const g=C.TALENTS_CODES.glissant;assert.ok(g&&g.monstre===true&&g.type==='pass','Glissant : talent d’adversaire passif');
 assert.equal(C.texteBrut(C.phraseTalent('glissant',{})),'Un adversaire qui finit son mouvement sur le token du porteur subit Au sol. Le porteur est ensuite révélé s’il était caché.');
 assert.ok(page.includes("&&!(hostiles(o,a)&&typeof talentsCodes==='function'&&porteEffet(talentsCodes(o),'glissant'))")&&page.includes("function glissade(a){")
  &&page.includes("croises.forEach(([k],n)=>{const o=actors[k],d=departs[n];if(o&&d&&Math.hypot(o.x-d.x,o.y-d.y)>=.05){glissade(o);reveleEnBougeant(o)}});")&&page.includes("glissantsReveles();finDeCombatAuto();"),'la glissade, en fin de mouvement');}
/* v0.512 — Armes de lancer : à distance, une main, sans munition ; lancées, elles passent à la cible ; au contact,
   elles se manient sans donner d'occasion. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 const items=[{id:'jav',name:'Javelot',category:'weapon',ranged:true,lancer:true,hands:1,dice:{white:1,red:1}},{id:'epee',name:'Épée',category:'weapon',ranged:false,hands:1,dice:{white:1}},
  {id:'arc',name:'Arc',category:'weapon',ranged:true,hands:2,dice:{white:2}},{id:'fl',name:'Flèches',category:'ammo',munDe:'red'}];
 const ch=C.attackChoices({hero:true,weapons:['epee','jav'],munitionId:'fl'},items),j=ch.find(x=>x.lancer==='jav');
 assert.ok(j&&j.range==='distance'&&j.munition===null&&j.dice.red===1&&ch.find(x=>x.range==='contact').name==='Épée','le javelot : son bouton, à distance, sans munition');
 assert.ok(C.attackChoices({hero:false,weapons:['jav']},items).some(x=>x.lancer==='jav'),'un adversaire lance aussi');
 assert.ok(page.includes("const lancer=activeAttack(a).lancer||null,lanceAuContact=!!lancer&&vises.every(j=>contactsDe(a).includes(actors[j]));")
  &&page.includes("if(o){retirerInventaire(a,o);if(b)ajouterInventaire(b,o)}")&&page.includes("porteeForcee=null;"),'lancée, elle passe à la cible ; au contact, elle reste');
 assert.ok(src.includes("['lancer','Arme de lancer']")&&src.includes("if(a.lancer){a.hands=1;a.usesAmmo=false}"),'le type Arme de lancer à la fiche');}
/* v0.511 — Fiche d'adversaire : le convertisseur de dés et un second Enregistrer, en haut. */
{const src=fs.readFileSync('editor.js','utf8');
 assert.ok(src.includes('<form id="actor-form"><div class="form-actions" id="actor-haut" hidden><button type="button" id="actor-conversion" class="conversion-bouton">🎲</button><button type="submit" class="primary">Enregistrer la fiche</button></div><div id="actor-fields"></div>')
  &&src.includes("$('actor-haut').hidden=!!draft.hero;")&&src.includes("b.onclick=()=>{renderConversion();conversionDialog.showModal();"),'convertisseur et Enregistrer en haut de la fiche d’adversaire');}
/* v0.510 — Un aventurier ne quitte que la table : sa fiche reste, son token revient ; le supprimer pour de bon se fait à
   l'onglet Aventuriers, en tapant SUPPRIMER. Sept talents par ligne à l'onglet Talents. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8'),css=fs.readFileSync('editor.css','utf8'),vivant=fs.readFileSync('live.js','utf8');
 assert.ok(src.includes("tous.filter(i=>actors[i].hero).forEach(i=>retireDeLaTable(actors[i]));")&&src.includes("function retireDeLaTable(a){")&&src.includes("a.horsCarte=true;a.retire=true;"),'retirer un aventurier ne le supprime pas');
 assert.ok(src.includes("if(mot.trim()!=='SUPPRIMER')return")&&src.includes("const suppr=ico('✕','Supprimer',()=>{const souci=supprimerAventurier(a);")&&src.includes("actors[editing].hero?supprimerAventurier(actors[editing]):removeActor(editing)"),'supprimer pour de bon : SUPPRIMER, à l’onglet Aventuriers');
 assert.ok(mp.includes("heros.forEach(a=>{a.horsCarte=false;delete a.retire;")&&src.includes("jeton.onclick=()=>ramenerSurLaTable(a)"),'le token revient : carte rechargée, ou clic à l’onglet Aventuriers');
 assert.ok(page.includes('function alive(a){return a.hp>0&&!hasState(a,"Coma")&&!a.horsCarte}')&&page.includes("if(!(a.hero&&a.retire))(duCoteTroupe(a)?troupe:campDe(a)==='neutre'?neutres:adverses).push(b);")&&vivant.includes("'horsCarte','retire',"),'hors de la table, il n’y est pas');
 assert.ok(css.includes('.talent-rangee{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));'),'sept talents par ligne');}
/* v0.509 — Gerbe de feu quand un piège part ; cadenas sur un coffre trouvé verrouillé ; pièces uniques. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8');
 const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('const INVENTAIRE_MAX='),src.indexOf('/* Dans l\'inventaire à remplir'))
  +';this.ajouterInventaire=ajouterInventaire;this.estUnique=estUnique;this.syncEquipped=()=>{};this.gearCount=()=>0;this.armuresDe=a=>a.armures||[];',ctx);
 const cle={id:'k',category:'cle'},libre={id:'k2',category:'cle',unique:false},obj={id:'o',category:'object'};
 assert.deepEqual([ctx.estUnique(cle),ctx.estUnique(libre),ctx.estUnique(obj),ctx.estUnique({...obj,unique:true})],[true,false,false,true],'une clé est unique d’office, décochable');
 const A={id:'a',hero:true,inventaire:['k']},B={id:'b',hero:true,inventaire:[]};ctx.actors=[A,B];
 assert.deepEqual([ctx.ajouterInventaire(A,cle),ctx.ajouterInventaire(B,cle),A.inventaire,B.inventaire],[false,true,[],['k']],'jamais deux, et elle passe au nouveau porteur');
 assert.deepEqual([ctx.ajouterInventaire(B,libre),ctx.ajouterInventaire(B,libre)],[true,true],'décochée, elle se double');
 assert.ok(page.includes('function explosionPiege(centre){')&&mp.includes("diffuserEffet('piege',h,null,")&&vivant.includes("rec.effet==='piege'&&typeof explosionPiege==='function'"),'la gerbe du piège, partout');
 assert.ok(mp.includes("c.tente=true;log(")&&mp.includes("if(c.tente&&coffreVerrouille(c)&&!c.ouvert){")&&mp.includes("$('fog').before(k)")&&vivant.includes("['tente',16]"),'le cadenas, sous le brouillard, partagé');
 assert.ok(src.includes("p.classList.add('unique-pris')")&&src.includes("'>Unique</label>'"),'la case Unique et la coche de l’Armurerie');
 // normalizeCatalog la lit au chargement, bien avant sa ligne : une déclaration de fonction, jamais une constante.
 assert.ok(src.includes('function estUnique(o){')&&!/const estUnique\s*=/.test(src),'estUnique est hissée');}
/* v0.508 — Bulle des coffres au survol, bouton du MJ ; noms groupés au journal ; touche M de la vue ; la fin du combat
   et les PV max se jugent quelle que soit la vue de qui tient la partie. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8');
 const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function plurielMot('),src.indexOf('/* Un adversaire retiré de la scène laisse son XP')),ctx);
 assert.equal(ctx.listeNombree(['Nuée de Rats','Nuée de Rats','Nuée de Rats','Nuée de Rats','Gobelin']),'4 Nuées de Rats, Gobelin');
 assert.deepEqual(['Rôdeur famélique','Loup-garou','Cheval','Rôdeur des ruines','Souris','Esprit d’ombre'].map(ctx.plurielNom),['Rôdeurs faméliques','Loups-garous','Chevaux','Rôdeurs des ruines','Souris','Esprits d’ombre']);
 assert.ok(mp.includes("surveille(el,()=>{if(mj?!bullesCoffresMJ:!coffreAPortee(heroActif(),c))return;")&&page.includes('id="coffres-bulles" hidden>'),'la bulle des coffres, au bouton du MJ');
 assert.ok(page.includes("e.preventDefault();sel.value=sel.value==='mj'?'player':'mj';sel.onchange()});"),'la touche de la vue');
 assert.ok(!page.includes("function finDeCombatAuto(){if(!enCombat()||view!=='mj'")&&src.includes("function synchronisePV(){if(typeof spectateur==='function'&&spectateur())return false;"),'les automatismes ne dépendent plus de la vue');}
/* v0.507 — Le Blindage absorbe toute source de dégâts, puis disparaît : opportunité, talents, états, pièges. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),mp=fs.readFileSync('maps.js','utf8');
 const b={hp:5,max:5,states:['Blindage']};
 assert.deepEqual([C.applyDamage(b,3),b.hp,b.states.includes('Blindage'),C.applyDamage(b,3),b.hp],[0,5,false,3,2],'le Blindage absorbe une fois, puis disparaît');
 const c={hp:5,max:5,states:['Blindage']};assert.deepEqual([C.applyDamage(c,0),c.states.includes('Blindage')],[0,true],'zéro dégât ne le consomme pas');
 assert.ok((page.match(/encaisse\(/g)||[]).length>=10&&mp.includes("encaisse(o,jet.total,null)"),'toutes les sources passent par le Blindage');}
/* v0.506 — Coffres : calque sous le brouillard, sans contour ni anneau au clic ; bulle du MJ en icônes ; un joueur ouvre
   d'un clic ; l'Action payée même quand le MJ ouvre ; le combat part à toute révélation ; prix des ressources ; clés et
   objets propres à un adversaire posé. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),mp=fs.readFileSync('maps.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const m=C.cleanMap({id:'m',name:'M',foes:[{x:1,y:1,tpl:{id:'t',name:'Gob',pv:5},inventaire:['k1','k1',3],butin:{k1:150,autre:20}},{x:2,y:2,tpl:{id:'t',name:'Gob',pv:5}}]});
 assert.deepEqual([m.foes[0].inventaire,m.foes[0].butin,'inventaire' in m.foes[1]],[['k1','k1'],{k1:100},false],'un adversaire posé garde ses objets propres');
 assert.ok(page.indexOf('<svg id="map-coffres"')>0&&page.indexOf('<svg id="map-coffres"')<page.indexOf('<canvas id="fog"')&&page.includes("e.target.closest('#map-coffres')||e.target.closest('#map-pieges'))return;"),'le calque des coffres sous le brouillard');
 assert.ok(mp.includes("el.onmousedown=e=>e.preventDefault();")&&mp.includes("if(mj)menuCoffre(c,e.clientX,e.clientY);else ouvreCoffreJoueur(c)}")&&mp.includes("function ouvreCoffreJoueur(c){"),'le clic du joueur ouvre');
 assert.ok(src.includes("el instanceof SVGElement&&el.getClientRects().length>0")&&src.includes("if(col==='restes'||col==='ressource'||")&&src.includes("['cles','Clés',o=>o.category==='cle']"),'bulle SVG, prix des ressources, clés');
 assert.ok(src.includes("function ajoutePropres(a,p){")&&src.includes("neuf=ajoutePropres(fromMonster(m),a.propres);")&&mp.includes("a.propres={inventaire:[...(f.inventaire||[])],butin:{...(f.butin||{})},...(bourse.length?{bourse}:{})};ajoutePropres(a,a.propres)")
  &&mp.includes("inventaireAdversaire($('foe-objets-corps'),f,()=>saveMaps());"),'objets propres d’un adversaire');}
/* v0.505 — Nuée : finir son mouvement sur un token, traverser les adversaires ; corriger un modèle ne rend plus
   inconnus les adversaires en jeu, et le combat ne se juge que sur la Table ; un aventurier mort ne se soigne plus. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8');
 assert.equal(C.texteBrut(C.phraseTalent('nuee',{})),'Le porteur peut finir son mouvement sur un token et traverser les tokens adverses.');
 const mort={hero:true,vie:0,hp:0,max:6,states:['Coma']},vif={hero:true,vie:2,hp:1,max:6,states:[]},bete={hero:false,hp:1,max:6,states:[]};
 assert.deepEqual([C.applyHeal(mort,5),mort.hp,C.applyHeal(vif,3),vif.hp,C.applyHeal(bete,2)],[0,0,3,4,2],'un mort ne gagne aucun PV');
 assert.ok(src.includes("function profilDuModele(m){return {template:m.id,")&&src.includes("gouverne.forEach(k=>{a[k]=neuf[k]});"),'le modèle ne gouverne que son profil');
 assert.ok(page.includes("// Ailleurs que sur la Table de jeu, le combat ne se juge pas : il attend qu'on y revienne.\n if([...document.body.classList].some(c=>c.startsWith('page-')))return;"),'pas de fin de combat hors de la Table');
 assert.ok(page.includes("function hpDe(a,delta){if(delta>0&&estMort(a))return;")&&page.includes("&&!estMort(a)&&(a.hp<a.max||statesOf(a).length))")
  &&page.includes("function reposCourt(a){if(estMort(a))return;")&&page.includes(":estMort(a)?a.name+' est mort : seul le MJ le ressuscite.'"),'un mort : ni soin, ni repos');}
/* v0.504 — En combat, un test de compétence et l'ouverture d'un coffre coûtent l'Action ; coffres fins, ronds ou tournés,
   dupliqués, piège signalé au MJ, contenu au survol du MJ, invisibles hors de la vue de la troupe ; fiche à cases ; Clés. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),
  mp=fs.readFileSync('maps.js','utf8'),dom=fs.readFileSync('domaine.js','utf8');
 const rond=C.coffrePolygon({x:10,y:10,w:10,h:10,rond:true},1),carre=C.coffrePolygon({x:10,y:10,w:10,h:10},1);
 assert.ok(rond.length===24&&carre.length===4,'un coffre rond est une ellipse, un coffre droit un rectangle');
 const m=C.cleanMap({id:'m',name:'M',coffres:[{id:'c',x:1,y:1,w:5,h:5,a:30,rond:true,cleId:'k1',items:Array(120).fill('o'),revele:true}],doors:[{x:1,y:1,w:4,h:1,keyLocked:true,cleId:'k1'}]});
 const c=m.coffres[0];assert.ok(c.a===30&&c.rond===true&&c.cleId==='k1'&&c.items.length===99&&!('revele' in c),'le coffre garde rotation, forme, clé et nombres');
 assert.equal(m.doors[0].cleId,'k1','une porte garde sa clé');
 assert.ok(page.includes("$('skills').hidden=!a.hero;")&&page.includes("const enCombatNow=enCombat();if(enCombatNow){if(actionPrise(a)||gelDebut(a))return;depensePoint(a,'action')}")
  &&page.includes("if(enCombatNow){afterAction(a);render();scheduleSave()}}"),"un test de compétence coûte l’Action en combat, et ne se fait pas sans elle");
 assert.ok(mp.includes("||!payeAction(a))return;")&&mp.includes("if(h&&!payeAction(h))return;")&&mp.includes("function payeAction(a)"),'tester ou ouvrir un coffre coûte l’Action en combat');
 assert.ok(mp.includes("if((!mj||oeil)&&(!coffreVisible(c)||!enVue))return;")&&mp.includes("className='coffre-alerte'")&&mp.includes("$('coffre-double').onclick"),'coffres : vue, piège, double');
 assert.ok(mp.includes("data-si=\"ferme\"")&&mp.includes("b.hidden=!f[b.dataset.si].checked")&&mp.includes("$('coffre-bourse').append(editeurBourse(bourse,null,false));")
  &&mp.includes("const CATS_COFFRE=")&&mp.includes("l.className='coffre-contenu-bulle';comptes.forEach((n,o)=>l.append(carreInventaire(o,n)));"),'la fiche du coffre : cases, gemmes, contenu');
 assert.ok(mp.includes("const aLaCle=(a,id)=>")&&mp.includes("parCle=!mj&&d.keyLocked&&!!d.cleId&&aLaCle(heroActif(),d.cleId)"),'une clé ouvre coffres et portes');
 assert.ok(src.includes("['object','Objets'],['cle','Clés'],")&&src.includes("cle:{category:'cle',name:'Nouvelle clé'}")&&src.includes("['object','Objet'],['cle','Clé'],")
  &&dom.includes("'object','cle','ressource'"),'la catégorie Clés à l’Armurerie');
 assert.ok(css.includes('#map-coffres .coffre{fill:rgba(140,72,16,.32);stroke:none;')&&css.includes('.shape.coffre.rond{border-radius:50%}')&&css.includes('#map-coffres .coffre.voile{'),'contour fin, rond, voile');}
/* v0.503 — Barre de PV de la fiche sans animation ; éditeur d'adversaire : attaques spéciales d'abord, ses talents en tête ;
   bibliothèque en colonnes ; six talents d'adversaires : Nuée, Dévorant, Épines, Tourbillon, Péril, Éclaboussure. */
{const C=require('./combat.js'),page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 ['nuee','devorant','epines','tourbillon','peril','eclaboussure'].forEach(k=>{const c=C.TALENTS_CODES[k];assert.ok(c&&c.monstre===true&&c.type==='pass',k+' : talent d’adversaire passif')});
 assert.equal(C.texteBrut(C.phraseTalent('devorant',{montant:'plus',x:2})),'Le porteur inflige son bonus de dégâts + 2 aux socles adverses qu’il fait entrer dans sa zone de contact, même en passant.');
 assert.equal(C.texteBrut(C.phraseTalent('peril',{effet:'moitie',seuil:25})),'Sous 25 % de ses PV, le porteur divise par deux ses dégâts.');
 assert.equal(C.texteBrut(C.phraseTalent('eclaboussure',{quoi:'fixe',x:3,cible:'contact',quand:'contact'})),'Quand il subit une attaque au contact, le porteur inflige 3 dégâts à tous les adversaires au contact.');
 assert.deepEqual(['bonus','plus','double','fixe'].map(m=>C.montantDegats({montant:m,x:2},3)),[3,5,6,2],'les montants réglables');
 assert.deepEqual([C.degatsPeril(4,{hp:4,max:10},{seuil:50}),C.degatsPeril(5,{hp:4,max:10},{seuil:50,effet:'moitie'}),C.degatsPeril(4,{hp:6,max:10},{seuil:50})],[8,3,4],'Péril sous le seuil seulement');
 ['devorant','epines','peril','eclaboussure'].forEach(k=>{const v=C.variablesPhrase(k,C.paramsTalent({effet:k,params:{}})),vus=[...v.variables.map(x=>x.cle),...v.hors];
  C.TALENTS_CODES[k].params.forEach(p=>assert.ok(vus.includes(p.cle),k+' : '+p.cle+' se règle dans la bibliothèque'))});
 assert.ok(page.includes("if(typeof talentsCodes==='function'&&porteEffet(talentsCodes(a),'nuee'))return [];")&&page.includes("function contactsNouveaux(a,nouveaux){")
  &&page.includes("contactsNouveaux(o,[...set].filter(x=>!init.has(x)))")&&page.includes("porteEffet(talentsCodes(a),'tourbillon')")
  &&page.includes("const t=degatsPeril(total,a,peril.params);")&&page.includes("talentsCodes(b).find(x=>x.code.cle==='eclaboussure')"),'les six talents branchés');
 assert.ok(css.includes('#sheet #hpfill{transition:none}')&&src.includes("[['nom','Effet'],['talents',''],['dit','Ce qu’il fait']")&&src.includes("tdTal.append(l)}")
  &&src.includes("const tete=!draft.hero?[ADVERSAIRES]:")&&src.indexOf('<h2>Attaques spéciales</h2>')<src.indexOf('sous-titre">Talents<button type="button" id="add-talent"'),'fiche, éditeur, bibliothèque');}
/* v0.502 — Adversaires cachés depuis l'éditeur ; « Révélé ! » à chaque découverte ; passages secrets trouvés par la
   Perception, au nombre de réussites choisi ; coffres : tracés comme des portes, cachés, verrouillés, piégés, pleins. */
{const C=require('./combat.js'),carto=fs.readFileSync('maps.js','utf8'),vivant=fs.readFileSync('live.js','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.equal(C.doorHiddenFrom({secret:true,open:false,decouvert:true},false),false,'un passage découvert se voit');
 assert.equal(C.doorLockedFor({secret:true,open:false,decouvert:true},false),false,'et s’ouvre comme une porte');
 assert.equal(C.doorPierces({secret:true,open:false,decouvert:true}),true);assert.equal(C.doorPierces({secret:true,open:false}),false);
 const m=C.packMaps([{name:'A',doors:[{x:1,y:1,w:5,h:2,secret:true,perception:3,decouvert:true}],foes:[{x:1,y:1,cache:true,tpl:{name:'G'}}],
  coffres:[{x:10,y:10,w:4,h:3,nom:'Malle',cache:true,perception:2,verrou:2,piege:2,degats:3,etats:['Feu','Rien'],items:['epee'],richesses:{or:12,'brisure-citrine':2,faux:9},ouvert:true,revele:true}]}]).maps[0];
 assert.equal(m.doors[0].perception,3);assert.ok(!('decouvert' in m.doors[0]),'la découverte reste à la partie');assert.equal(m.foes[0].cache,true);
 const c=m.coffres[0];assert.deepEqual([c.nom,c.cache,c.perception,c.verrou,c.piege,c.degats,c.etats.join(),c.items.join(),JSON.stringify(c.richesses)],
  ['Malle',true,2,2,2,3,'Feu','epee','{"or":12,"brisure-citrine":2}'],'le coffre voyage avec la carte');
 assert.ok(!('ouvert' in c)&&!('revele' in c),'ce qui lui est arrivé en partie, non');
 assert.ok(carto.includes("if(f.cache)a.hidden=true;actors.push(a)});")&&page.includes("menuCarte(a.name,[['Révéler à la troupe',()=>{a.hidden=false;render();scheduleSave()}]]")
  &&!carto.includes("'Découvert !'")&&carto.includes("d.decouvert=true;floatNumber(centreForme(d),'Révélé !','nul')")&&carto.includes("c.revele=true;floatNumber(centreForme(c),'Révélé !','nul')")
  &&carto.includes("if(o.visible)floatNumber({x:o.x,y:o.y,socle:o.taille},'Révélé !','nul');"),'les révélations');
 assert.ok(vivant.includes("...(m.coffres||[]).map(c=>(c.revele?1:0)|(c.deverrouille?2:0)|(c.desamorce?4:0)|(c.ouvert?8:0)|(c.tente?16:0))")&&vivant.includes("else if(v===2||v===3){p.open=v===3;p.decouvert=true}"),'la table partage portes découvertes et coffres');
 // Les règles du coffre : verrou et piège égaux, l'un défait l'autre ; distincts, chacun le sien.
 const ctx={Math,c:null};vm.createContext(ctx);vm.runInContext(carto.match(/const coffreVisible=[^\n]*/)[0]+';this.v=coffreVerrouille;this.a=coffreArme;',ctx);
 assert.equal(ctx.v({verrou:2}),true);assert.equal(ctx.v({verrou:2,deverrouille:true}),false);assert.equal(ctx.v({verrou:0}),false);assert.equal(ctx.a({piege:1}),true);assert.equal(ctx.a({piege:1,desamorce:true}),false);
 assert.ok(carto.includes("if(coffreArme(c)&&c.piege===c.verrou){c.desamorce=true;")&&carto.includes("if(coffreVerrouille(c)&&c.verrou===c.piege){c.deverrouille=true;")
  &&carto.includes("function ouvrirCoffre(c,h,parMJ){if(!c||c.ouvert||(coffreVerrouille(c)&&!parMJ))return;")&&carto.includes("dansZoneCoffre(o,c)"),'verrou, piège, ouverture');}
/* v0.501 — Fiche : « + » serré sur les dégâts, valeurs des bonus du bloc Talents plus grandes ; pastilles d'équipement
   à la couleur de la rareté ; pastilles grises dans une bulle de talent grisée. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("ecrire('.stat-tile.t-dmg strong','+\\u202F'+degatsDe(a));")&&src.includes("['dmg','Dég.','+\\u202F'+degatsDe(a)],['xp','XP',a.xp||0]]\n  .map(t=>statTile(...t));")
  &&css.includes('.hero-card .talent-ameliorations .cat-pill.bonus-rond .bonus-valeur{left:70%;top:70%;font-size:14px;')
  &&css.includes('.gear-detail .gear-bonus::before{background:var(--rarete,#7d7a74);')&&css.includes('.talent-detail.grisee{--pastille:#8f8a80!important}'),'les retouches de la fiche et des pastilles');}
/* v0.500 — Blindage ne s'empile pas ; Gardien pose l'état Gardé, à l'image choisie par le MJ ; les talents de début
   de combat ne servent qu'au premier tour avant que la troupe bouge ou agisse, marqués sur la carte et dans la
   barre ; un aventurier sans VIE est mort : fiche grise, tête de mort, seul le MJ y touche et le ressuscite. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),C=require('./combat.js');
 const b={states:[]};C.infligeEtat(b,'Blindage');assert.equal(C.infligeEtat(b,'Blindage'),false);C.setState(b,'Blindage',true);assert.equal(b.states.join(),'Blindage','un seul Blindage à la fois');
 assert.ok(page.includes("setState(o,'Gardé',true);")&&!src.includes("a.states=a.states.filter(s=>s!=='Gardé')")
  &&page.includes("function imageEtat(etat){const choisi=typeof catalog!=='undefined'&&catalog.logosEtats&&catalog.logosEtats[etat];")
  &&src.includes("selGroupes('Gardé','etat-garde',")&&src.includes("c.logosEtats={};"),'Gardé, et son image au choix');
 const ctxO={round:1,enCombat:()=>true,actors:[{hero:true,checks:[0,0,0]},{hero:false,checks:[1,0,0]}]};vm.createContext(ctxO);
 vm.runInContext(page.match(/function ouvertureCombat\(qui\)[^\n]*\n[^\n]*/)[0]+'\n'+page.match(/const talentDebut=[^\n]*/)[0]+';this.t=talentDebut;',ctxO);
 assert.equal(ctxO.ouvertureCombat(),true,'un adversaire qui agit ne ferme rien');
 ctxO.actors[0].checks=[0,1,0];assert.equal(ctxO.ouvertureCombat(),false,'un aventurier qui bouge ferme le début du combat');
 ctxO.actors[0].checks=[0,0,0];ctxO.actors[0].orbes=1;assert.equal(ctxO.ouvertureCombat(),false,'un orbe lancé aussi');
 ctxO.actors[0].orbes=0;ctxO.round=2;assert.equal(ctxO.ouvertureCombat(),false,'passé le premier tour, plus du combat');
 ctxO.round=1;ctxO.actors.push({hero:true,checks:[0,1,0]});assert.equal(ctxO.ouvertureCombat(ctxO.actors[0]),true,'chacun garde son début de combat tant qu’il n’a pas agi');assert.equal(ctxO.ouvertureCombat(ctxO.actors[2]),false,'celui qui a agi a fermé le sien');ctxO.actors.pop();
 assert.deepEqual([{effet:'gardien'},{effet:'gardien',debutCombat:false},{debutCombat:true},{}].map(ctxO.t),[true,false,true,false]);
 assert.ok(page.includes("peut:libre,rayonne:debut&&libre,")&&page.includes("if(b&&t.rayonne)b.classList.add('debut-combat')")
  &&page.includes("className:'debut-marque',textContent:'!'")&&src.includes("if(t.rayonne)b.classList.add('debut-combat');")&&src.includes('name="debutCombat"'),'les talents de début de combat');
 assert.ok(page.includes("function estMort(a){return !!a&&a.hero===true&&a.vie!==undefined&&a.vie!==null&&Math.trunc(Number(a.vie))<=0}")
  &&page.includes("+(estMort(a)?' mort':'')")&&src.includes("if(estMort(a)){c.classList.add('mort');")&&src.includes("function ressusciter(a){if(view!=='mj'||!estMort(a))return;")
  &&src.includes("if(verrou||(estMort(a)&&view!=='mj')||figeEnCombat())return;")&&src.includes("troupe.forEach(a=>{if(estMort(a))return;"),'un aventurier mort');}
/* v0.499 — L'Attaque, talent de base de tout aventurier, en tête de sa fiche ; ce qui l'améliore s'ajoute à sa
   bulle et à celle de la barre d'Actions, une pastille devant, à la couleur foncée de la nature du talent. Tous
   les états s'en vont à la fin d'un combat ; le tour qui commence ne parle plus des activations. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const ctxA={estBonus:t=>!!t&&t.effet==='bonus'};vm.createContext(ctxA);
 vm.runInContext(src.slice(src.indexOf('const EFFETS_SUR_ATTAQUE='),src.indexOf('function lignesAttaque('))+';this.f=ameliorAttaque;',ctxA);
 assert.deepEqual([{type:'pass',pourAttaque:true},{type:'ame',effet:'tenailles'},{type:'ame',effet:'tenailles',pourAttaque:false},{type:'act',pourAttaque:true},{type:'pass',effet:'bonus',pourAttaque:true},{type:'pass'}].map(ctxA.f),
  [true,true,false,false,false,false],'passifs et améliorations cochés, ou câblés sur les attaques');
 assert.ok(src.includes("const attaque=cases&&a.hero?carteAttaque(a):null;if(attaque)out.append(attaque);")&&src.includes("talentCarte({id:'attaque',name:'Attaque',type:'act'},l?logoAttaque(l):null)")
  &&src.includes("lignes:voit?lignesAttaque(a):null")&&src.includes("lisChemin(x).de===t.id&&!ameliorAttaque(x));")
  &&src.includes('name="pourAttaque"')&&src.includes("if(typeof t.pourAttaque!=='boolean')delete t.pourAttaque;"),'l’Attaque sur la fiche et ses améliorations');
 assert.ok(css.includes('.talent-detail .palier-effet.amelioration::before{background:color-mix(in srgb,var(--pastille,var(--teinte,#4f7fb5)) 85%,#000);')&&css.includes('.talent-detail.p-act{--pastille:#4f7fb5}'),'la pastille à la couleur de la nature');
 const ctxE={statesOf:a=>a.states||[],setState:(a,e,p)=>{a.states=(a.states||[]).filter(x=>x!==e);if(p)a.states.push(e)}};vm.createContext(ctxE);
 vm.runInContext(page.match(/function leveEtats\(a,finCombat,garder\)\{[^\n]*\n[^\n]*/)[0],ctxE);
 const h={states:['Feu','Blindage','Coma','Invisible'],etatsPassifs:['Invisible']};
 assert.equal(ctxE.leveEtats(h,true).join(','),'Feu,Blindage','fin du combat : le Blindage aussi');assert.equal(h.states.join(','),'Coma,Invisible');
 assert.ok(!page.includes('Activations réinitialisées'),'fin de combat et début de tour');}
/* v0.498 — Un repos court par niveau, le nombre restant sous le bouton (« 2 », pas « 2/2 ») ; un seul entre deux
   combats, que la fin du combat rouvre. La planche des caractéristiques principales se découpe en cinq. */
{const page=fs.readFileSync('index.html','utf8'),src=fs.readFileSync('editor.js','utf8'),carto=fs.readFileSync('maps.js','utf8'),calc=fs.readFileSync('planches-calcul.js','utf8');
 assert.ok(page.includes("function reposMax(a){return Math.max(1,Math.trunc(Number(a&&a.level))||1)}")&&page.includes("a.reposCourts=Math.min(reposMax(a),(Math.trunc(Number(a.reposCourts))||0)+1);a.reposPris=true;")
  &&page.includes("enCombat()||reposRestants(a)<=0||a.reposPris===true||!alive(a)")&&page.includes("String(reposRestants(a)))}")
  &&page.includes(":reposRestants(a)<=0?'Plus de repos court : ils reviennent au repos long.'"),'le repos court : la réserve au niveau, un par combat');
 assert.ok(src.includes("a.reposCourts=0;a.reposPris=false;reposer(a,'long');")&&carto.includes("heros.forEach(a=>{a.horsCarte=false;delete a.retire;a.reposCourts=0;a.reposPris=false;"),'repos long et carte rechargée rendent tout');
 assert.ok(fs.existsSync('img/planches/caracteristiques_2.webp')&&calc.includes("votants=gros.filter(k=>k.c>=grosMax*.05);"),'la planche et la taille des icônes sans les éclats');
 const cc={};vm.createContext(cc);vm.runInContext(calc+';this.d=detecteGrille;this.cs=casesDe;',cc);
 // Une rangée de trois icônes, dont la dernière éclatée en petits morceaux : trois cases, pas plus.
 const W=300,H=100,A=new Uint8Array(W*H),carre=(x0,y0,w,h)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)A[y*W+x]=255};
 carre(10,10,80,80);carre(110,10,80,80);carre(220,25,50,50);[[205,12],[275,12],[205,82],[275,82],[240,6],[240,88]].forEach(([x,y])=>carre(x,y,6,6));
 const g=cc.d({W,H,A});assert.equal(g.lignes+'x'+g.colonnes,'1x3','les éclats ne font pas de cases');assert.equal(cc.cs({W,H,A},g.bx,g.by).length,3);}
/* v0.497 — Sur la fiche, les icônes de bonus remplissent leur rond comme l'éclat des dégâts ; dans la bulle
   d'un bonus de talent, l'icône vient devant et la compétence s'écrit comme sur la fiche. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(css.includes('.hero-card .talent-ameliorations .cat-pill.gear-carre.talent-carre.bonus-rond>.logo-equip{width:100%;height:100%}')
  &&src.includes("if(l)r.append(remplitCase(l));")&&src.includes("function remplitCase(el){"),'les icônes de bonus à la même taille');
 assert.ok(src.includes("nom.textContent=c==='comp'?(talent?String(skillNames[k]||''):String(skillNames[k]||'').toUpperCase())")&&src.includes("libelleBonusEl(g.p,{talent:g.t})")&&css.includes('.bonus-libelle .bonus-ico{'),'la bulle d’un bonus : icône, compétence comme sur la fiche');}
/* v0.496 — Retirer ou supprimer un talent de l'arbre laisse sa case vide : ses lignes, ses niveaux et ses petits
   ronds restent ; la case se traverse ; un talent posé dessus reprend le tout. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 const T=[{id:'A',name:'A',pos:{x:0,y:0},liens:['B']},{id:'B',name:'B',pos:{x:0,y:1},liens:['C'],niveaux:{C:3}},{id:'C',name:'C',pos:{x:0,y:2}},
  {id:'k',name:'+1',effet:'bonus',chemin:{de:'B',dir:'ne',rang:1}},{id:'k2',name:'+2',effet:'bonus',chemin:{de:'B',dir:'ne',rang:2}}];
 let n=0;const ctxV={view:'mj',crypto:{randomUUID:()=>'v'+(++n)},LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],estBonus:t=>!!t&&t.effet==='bonus',catalog:{talents:T}};
 vm.createContext(ctxV);vm.runInContext(src.slice(src.indexOf('function posDe('),src.indexOf("/* Les colonnes d'une classe : deux, toujours"))+src.slice(src.indexOf("// Un petit rond dont le talent, ou le petit rond d'avant"),src.indexOf('/* Placer un talent dans un arbre'))
  +src.slice(src.indexOf('function retireDeLArbre('),src.indexOf('/* La bulle d\'un talent'))+';this.videDeLArbre=videDeLArbre;this.reprendCase=reprendCase;this.laisseCaseVide=laisseCaseVide;this.verrouArbre=verrouArbre;this.atteintsDepuis=atteintsDepuis;',ctxV);
 const X=id=>ctxV.catalog.talents.find(t=>t.id===id);
 assert.equal(ctxV.videDeLArbre(X('B')),true);
 const V=X('v1');
 assert.ok(V&&V.vide===true&&V.pos.x===0&&V.pos.y===1&&V.liens.join()==='C'&&V.niveaux.C===3,'la case vide garde la place, les lignes et les niveaux');
 assert.ok(X('B').horsArbre&&!X('B').pos&&!X('B').liens&&X('A').liens.join()==='v1','le talent part ; la ligne qui menait à lui mène à la case');
 assert.ok(X('k').chemin.de==='v1'&&X('k2').chemin.de==='v1'&&!X('k').horsArbre&&!X('k2').horsArbre,'ses bonus restent sur leur chemin');
 const L=[X('A'),V,X('C')];
 assert.equal(ctxV.verrouArbre(['A'],L,X('C'),1),'Niveau 3','la case se traverse, ses niveaux tiennent');assert.equal(ctxV.verrouArbre(['A'],L,X('C'),3),'');
 assert.ok(ctxV.atteintsDepuis(['A','C'],L,null).has('C'),'ce qu’on tenait au-delà reste tenu');
 assert.equal(ctxV.verrouArbre(['A'],L,X('k')),'','le bonus de la case s’ouvre depuis un talent tenu');assert.ok(ctxV.verrouArbre([],L,X('k')),'fermé sinon');
 const D={id:'D',name:'D',pos:{x:0,y:1}};ctxV.catalog.talents.push(D);ctxV.reprendCase(D,V);
 assert.ok(!X('v1')&&D.liens.join()==='C'&&D.niveaux.C===3&&X('A').liens.join()==='D'&&X('k').chemin.de==='D'&&X('k2').chemin.rang===2,'un talent posé dessus reprend tout');
 ctxV.laisseCaseVide(X('k'));const P=X('v2');
 assert.ok(P&&P.vide&&P.chemin.de==='D'&&P.chemin.rang===1&&X('k2').chemin.rang===2,'un bonus ôté laisse aussi sa place');
 assert.ok(src.includes("if(occ&&estVide(occ)&&ailleurs)reprendCase(t,occ);")&&src.includes("el=estVide(t)?noeudVide(t,c,false):noeudArbre(t,c,libre)")
  &&src.includes("laisseCaseVide(t);catalog.talents.splice(catalog.talents.indexOf(t),1);talentDialog.close();")&&src.includes("if(t.vide!==true)delete t.vide;")
  &&css.includes('.arbre-plan>.arbre-noeud.vide .arbre-rond{'),'câblé dans l’arbre, le formulaire et le catalogue');}
/* v0.495 — Le bonus d'une compétence, dans l'arbre comme dans la bulle d'un objet, a la couleur
   de son rond sur la fiche (la teinte de son logo, la sienne à défaut) ; dans la bulle d'un objet,
   il s'écrit en Killam. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("if(c==='comp'){nom.classList.add('bonus-comp');nom.style.setProperty('--tint',tint);nom.style.color='rgb(var(--tint))';")
  &&src.includes("const l=iconesCompetences()[k],ico=l?logoCompetence(k):null;if(ico)teinteLogoSur(nom,ico,l)}"),'la teinte du rond de la fiche');
 assert.ok(css.includes(".gear-detail .gear-bonus .bonus-comp{font-family:'Killam',Georgia,serif}"),'Killam dans la bulle d’objet');}
/* v0.494 — La scène de base ne paraît plus au rechargement : le voile de chargement est dans la
   page dès le premier affichage. La planche Compétences est au dépôt et se propose en tête des
   icônes de compétences, comme la planche Caractéristiques. */
{const src=fs.readFileSync('editor.js','utf8'),html=fs.readFileSync('index.html','utf8');
 assert.ok(/<body><div id="busy-cover">Chargement de la partie enregistrée…<\/div>/.test(html),'le voile est là avant la scène');
 assert.ok(src.includes("const cover=document.getElementById('busy-cover')||")&&!src.includes("const cover=document.createElement('div');cover.id='busy-cover'"),'editor.js reprend le voile de la page');
 assert.ok(fs.existsSync('img/planches/competences_1.webp'),'la planche Compétences est au dépôt');
 const ctxG={catalog:{planches:[{fichier:'planches/competences_1.webp',cases:[[0,0,1,1]],icones:[]},{fichier:'planches/talents_1.webp',cases:[[0,0,1,1]],icones:[]}]},FAMILLES_LOGOS:[]};vm.createContext(ctxG);
 const pl=fs.readFileSync('planches.js','utf8');
 vm.runInContext(pl.slice(pl.indexOf('const CATS_ICONES='),pl.indexOf('function normalisePlanches('))+';'+src.slice(src.indexOf('function groupesLogosCompetence('),src.indexOf('/* ---------- La conversion des dégâts'))+';this.g=groupesLogosCompetence;',ctxG);
 assert.equal(ctxG.g()[0][0],'Competences 1','la planche Compétences en tête des choix');
 assert.ok(!ctxG.g()[0][1].includes('planches/talents_1.webp#1'),'une autre planche reste à sa place');}
/* v0.353 — Les huit compétences en ronds sous « Compétences » : le logo, teinté de sa couleur
   dominante, la valeur en pastille au bas — 1, plus ce que l'aventurier y a gagné ; le test lance
   autant de dés. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("function rondCompetence(a,k,clic){")&&src.includes("function teinteDominante(im){")&&src.includes("r.style.setProperty('--tint',SKILL_TINTS[k]);")
  &&css.includes('.comp-val{position:absolute;left:50%;bottom:-12px;transform:translateX(-50%);box-sizing:border-box;width:21px;height:21px;border-radius:50%;')&&css.includes('border:2.5px solid rgb(var(--tint));'),'les ronds des compétences');
 const ctxV={bonusFiche:()=>({skills:[0,2,0,0,0,0,0,0]})};vm.createContext(ctxV);
 vm.runInContext(page.slice(page.indexOf('function competenceDe(a,k)'),page.indexOf('function vieAffichee(a)'))+';this.v=valeurCompetence;',ctxV);
 assert.equal(ctxV.v({skills:[0,0,0,0,0,0,0,0]},0),1,'sans rien, une compétence vaut 1');
 assert.equal(ctxV.v({skills:[0,1,0,0,0,0,0,0]},1),4,'1 + 1 point + 2 de bonus');}
/* v0.354 — Chez le MJ, un clic gauche sur une compétence l'augmente, un clic droit la baisse, jamais
   sous 1 ; au-dessus de 1, le chiffre doré ; la valeur en bulle ronde qui touche le bord du rond ;
   la bulle de la compétence au survol, son nom et sa valeur. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("r.onclick=()=>change(1);r.oncontextmenu=e=>{e.preventDefault();change(-1)};")&&src.includes("a.skills[k]=readStat('skill',avant+pas,avant);")
  &&src.includes("v.className='comp-val'+(valeurCompetence(a,k)>1?' haute':'');")&&src.includes("val.textContent='Valeur : '+valeurCompetence(a,k);")
  &&css.includes('.comp-val.haute{color:#2f7d45;'),'régler les compétences au clic, chiffre vert, bulle au survol');}
/* v0.355 — La fiche de la table ne montre plus l'équipement porté, seulement les objets de combat ;
   dans la barre d'action, attaques et talents ont le bouton d'une ligne des réactions, dés dessous. */
{const src=fs.readFileSync('editor.js','utf8'),C=require('./combat.js');
 const ctxO={EQUIPEMENTS:C.EQUIPEMENTS,objetCode:C.objetCode};vm.createContext(ctxO);vm.runInContext(src.slice(src.indexOf('const objetDeCombat='),src.indexOf('function gearPills('))+';this.f=objetDeCombat;',ctxO);
 const effet=Object.keys(C.OBJETS_CODES||{})[0];
 assert.ok(effet,'au moins un effet d’objet connu');
 assert.equal(ctxO.f({category:'object',effet}),true,'une potion à effet sert en combat');
 assert.equal(ctxO.f({category:'object'}),false,'un objet sans effet ne sert pas');
 assert.equal(ctxO.f({category:'weapon',effet}),false,'une arme, même à effet, n’en est pas');
 assert.ok(page.includes("$('gear').replaceChildren(typeof gearPills==='function'?gearPills(a,false,true):")&&src.includes("const equipement=combat?[]:armurerie.filter(([o])=>tout||portes(o));")
  &&!src.includes("c.className='attaque-carte'"),'objets de combat, boutons d’attaque d’une ligne');}
/* v0.356 — La bulle de valeur plus bas, verte au-dessus de 1 ; les talents sous les compétences ;
   plus de double trait au-dessus des fiches ; deux arbres par classe au lieu de trois. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes('const VOIES_MAX=2;')&&css.includes('#heroes-page .cat-head{border-bottom:0;padding-bottom:6px}')&&css.includes('.comp-val.haute{color:#2f7d45;'),'deux arbres, un seul trait, le vert');}
/* v0.357, puis v0.361 — Les bonus de caractéristique se posent au milieu des lignes de l'arbre :
   optionnels, à leur prix, activables dès que le talent d'où part la ligne est pris ; ils tombent
   avec lui, et quittent l'arbre avec leur ligne. */
{const src=fs.readFileSync('editor.js','utf8');
 /* v0.381 — Le sphérier : un petit rond — bonus ou amélioration — se pose sur un chemin d'un talent
    (talent, direction, rang), d'autres le suivent ; chacun attend le précédent, le premier son talent. */
 const T=[{id:'o',name:'Orbes',famille:'M',pos:{x:0,y:0},liens:['g']},{id:'g',name:'Braise',famille:'M',pos:{x:0,y:1}},{id:'d',name:'Cendre',famille:'M',pos:{x:1,y:0}},
  {id:'b1',name:'+1 PV',effet:'bonus',famille:'M',chemin:{de:'o',dir:'ne',rang:1}},{id:'b2',name:'+1 DEF',effet:'bonus',famille:'M',chemin:{de:'o',dir:'ne',rang:2}},{id:'b3',name:'+2 PV',effet:'bonus',famille:'M'},
  {id:'b4',name:'+1 Vie',effet:'bonus',famille:'M',chemin:{de:'zz',dir:'n',rang:1}}];
 const ctxB={catalog:{talents:T},LIENS_MAX:4,DIRS:{n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],so:[-1,1],o:[-1,0],no:[-1,-1]},DIRS_DROITES:['n','e','s','o'],estBonus:t=>!!t&&t.effet==='bonus'};vm.createContext(ctxB);
 vm.runInContext(src.slice(src.indexOf('function posDe('),src.indexOf("/* Les colonnes d'une classe : deux, toujours"))+src.slice(src.indexOf("// Un petit rond dont le talent, ou le petit rond d'avant"),src.indexOf('/* Placer un talent dans un arbre'))
  +';this.lisChemin=lisChemin;this.petitsDe=petitsDe;this.departChemin=departChemin;this.precedentChemin=precedentChemin;this.sansBonusOrphelins=sansBonusOrphelins;this.basculeLien=basculeLien;this.verrouArbre=verrouArbre;this.cheminsDe=cheminsDe;',ctxB);
 assert.equal(JSON.stringify(ctxB.lisChemin(T[3])),'{"de":"o","dir":"ne","rang":1}');assert.equal(ctxB.lisChemin(T[5]),null,'un bonus sans chemin n’est sur aucun chemin');
 assert.equal(ctxB.lisChemin({chemin:'o>g'}),null,'l’ancien format ne se lit plus : la migration le convertit');
 assert.equal(ctxB.petitsDe(T[0],'ne').map(t=>t.id).join(','),'b1,b2');assert.equal(ctxB.petitsDe(T[0],'s').length,0);
 assert.equal(ctxB.departChemin(T[3]).id,'o');assert.equal(ctxB.departChemin(T[6]),null,'sans talent au départ, pas de chemin');
 assert.equal(ctxB.precedentChemin(T[4]).id,'b1');assert.equal(ctxB.precedentChemin(T[3]),null);
 assert.equal(ctxB.verrouArbre([],T,T[3]),'Orbes');assert.equal(ctxB.verrouArbre(['o'],T,T[3]),'');
 assert.equal(ctxB.verrouArbre(['o'],T,T[4]),'+1 PV','le second attend le premier');assert.equal(ctxB.verrouArbre(['o','b1'],T,T[4]),'');
 assert.equal(ctxB.cheminsDe(T,T[0]).s.lien.id,'g','la ligne vers la case du dessous tient le chemin sud');assert.equal(ctxB.cheminsDe(T,T[0]).ne.petits.length,2);
 assert.equal(JSON.stringify(ctxB.sansBonusOrphelins(['o','b1','b2','b3'])),JSON.stringify(['o','b1','b2','b3']));
 assert.equal(JSON.stringify(ctxB.sansBonusOrphelins(['o','b2','b3'])),JSON.stringify(['o','b3']),'sans le premier, le second tombe ; un bonus hors chemin reste');
 assert.equal(JSON.stringify(ctxB.sansBonusOrphelins(['b1','b2'])),'[]','sans le talent, tout le chemin tombe');
 assert.equal(ctxB.basculeLien(T[0],T[2]),'ajoute','Cendre est la case de droite');assert.equal(ctxB.basculeLien(T[2],T[1]),'loin','en diagonale : pas de ligne');
 assert.ok(src.includes("reste=sansChuteArbre(a,sansBonusOrphelins(reste));")&&src.includes("&&!t.horsArbre&&!lisChemin(t));")&&src.includes("if(d.chemin)t.chemin=d.chemin;"),'les petits ronds');}
/* v0.358 — Dans la barre d'action, attaques et talents d'attaque sont des ronds, comme les talents
   d'une fiche, à la couleur de l'action ; le nom dans la bulle, les dés dessous. Sur la table, plus
   de nom sous les ronds de talents. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8');
 assert.ok(src.includes("b.className=t.classe+' choix-attaque rond';")&&src.includes("b.className='btn-action choix-attaque rond'+(i===(retenu<liste.length?retenu:0)?' on':'');")
  &&css.includes('.cat-carte.talent-carte .nom-carte.nom-rond,.sac-carte .nom-sac{display:none}'),'les attaques en ronds, pas de nom sur la table');}
/* v0.359 — Les ronds de la barre d'action gardent la face pleine du bouton d'action, sans anneau ;
   Analyser, Repos court, Dégel, Se relever et les réactions en ronds aussi. Le rond d'attaque ne
   montre que l'arme de la main droite, et plus de jeton de dégâts après le bonus. Sur la fiche,
   plus de « + » aux Compétences ni à l'Équipement ; il passe à l'Inventaire. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.ok(css.includes('button.btn-action.rond,button.btn-action.rond.inerte{position:relative;width:58px;height:58px;')
  &&css.includes('button.btn-action.rond.on,button.btn-action.rond.on:hover:not(:disabled){box-shadow:var(--relief)}')
  &&!css.includes('button.choix-attaque.rond')&&!/button\.btn-action\.rond[^{]*\{[^}]*0 0 0 2px var\(--panel\)/.test(css)&&!css.includes('.attaque-carte .dmg-ico'),'la face pleine du bouton d’action, en disque, sans anneau');
 assert.ok(src.includes("logosDeAttaque(at).slice(0,1).forEach(l=>{const im=logoAttaque(l,'bouton');if(im)logos.append(im)});")
  &&src.includes("if(jeton){const ico=document.createElement('img');ico.className='dmg-ico';")&&src.includes("desEtBonus(at.dice,at.useOwnDamage===false?0:bonus)"),'la main droite seule ; le jeton de dégâts reste à la bulle des monstres');
 assert.ok(page.includes('<button class="btn-action btn-analyse rond" id="reveal" hidden>🔍</button>')&&page.includes("function poseRond(b,centre,nom,dit,compte,bulle){")
  &&page.includes("poseRond(rev,centreRond('analyser','🔍'),dejà?'Analysé':'Analyser',")
  &&page.includes("poseRond(b,im||glyphe,nom,titre,compteDuTexte(nom),bulle);")&&page.includes("geste('Dégel','❄',")&&page.includes("geste('Se relever',ic||'⤴',")
  &&page.includes("(b.dataset.nom||b.textContent)")&&!page.includes("rev.textContent=")&&!page.includes("repos.textContent="),'Analyser, Repos court, gestes et réactions en ronds, nommés dans la bulle');
 assert.ok(src.includes("const titreComp=sousTitre('Compétences');")&&src.includes("const titreKit=sousTitre('Inventaire','Ajouter à l’inventaire de '+a.name,view==='mj'?()=>openPicker(a,'gear'):null);")
  &&src.includes("sousTitre('Inventaire','Ajouter à l’inventaire de '+a.name,view==='mj'?()=>openPicker(a,'gear'):null)")
  &&!src.includes("'Ajouter un point de compétence à '"),'le « + » quitte Compétences et Équipement pour l’Inventaire');}
/* v0.360 — Deux lignes d'Actions : en gros ronds les attaques, les actions et les réactions ; en petits,
   dessous, les maîtrises, Analyser, le Repos court. Les dés de dégâts et le bonus du combattant pris
   passent au-dessus de la piste, dans le bloc Dés ; un rond qui frappe y montre les siens au survol. */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.ok(src.includes("const talents=[...gros.filter(b=>b.rangee==='attaques'),...gros.filter(b=>b.rangee==='reactions')];")
  &&!page.includes("filter(b=>b.rangee==='reactions')")&&!page.includes('rangee-ronds')&&!css.includes('rangee-ronds')
  &&css.includes('.attack-row button.btn-action.rond,.attack-row button.btn-action.rond.inerte{width:42px;height:42px;font-size:19px}'),'gros ronds pour agir et réagir, petits pour les maîtrises et les gestes');
 assert.ok(src.includes("const voit=!!a&&(view==='mj'||(typeof connait==='function'?connait(a,'attaques'):a.hero||duCoteTroupe(a)||!!a.revealed));")
  
  &&src.includes("if(marked.size>1){boite.replaceChildren();boite.hidden=true;montreDesCombattant(null);return}")
  &&css.includes('.des-combattant{display:flex;align-items:center;min-height:26px}.des-combattant[hidden]{display:none}'),'les dés du combattant au-dessus de la piste, ceux du rond survolé le temps du survol');
 {const m=page.match(/function compteDuTexte\(t\)\{[^\n]*\}/);assert.ok(m,'compteDuTexte introuvable');const ctx={};vm.runInNewContext(m[0]+';this.f=compteDuTexte',ctx);
  assert.equal(ctx.f('Orbes mystiques 1/1'),'1');assert.equal(ctx.f('Garde 2 / 3'),'2');assert.equal(ctx.f('Riposte'),'');assert.equal(ctx.f(null),'');}
 assert.ok(page.includes("poseRond(b,im||glyphe,nom,titre,compteDuTexte(nom),bulle);")&&src.includes("const compte=typeof compteDuTexte==='function'?compteDuTexte(t.texte):'';"),'le compte d’un talent en pastille sur son rond');}
/* v0.361 — La bulle d'un bouton de la barre d'action est celle d'un talent, à la couleur du bouton ;
   une attaque, et un talent qui frappe, y montrent leurs dés et leur bonus. Plus de titre « Actions ». */
{const src=fs.readFileSync('editor.js','utf8'),css=fs.readFileSync('editor.css','utf8'),page=fs.readFileSync('index.html','utf8');
 assert.ok(src.includes("const fond=getComputedStyle(b).getPropertyValue('--fond').trim();if(fond)d.style.setProperty('--teinte',fond);")&&!page.includes("'cat-detail bulle-attaque-corps'")
  &&css.includes('.talent-detail.bulle-action{background:color-mix(in srgb,var(--teinte,#3f7bc0) 24%,#fff);border-left:4px solid var(--teinte,#3f7bc0)}')
  &&css.includes('.talent-detail .bulle-des{display:flex;align-items:center;gap:7px;margin:0 0 6px}'),'la bulle d’action, celle d’un talent, avec les dés');
 assert.ok(!page.includes('titre-actions')&&!page.includes('actions-head')&&!page.includes('body.sombre .attack-row')&&page.includes('.choix-attaques[hidden]{display:none}.attack-row{display:flex;'),'plus de titre « Actions »');}
/* v0.362 — Quatre effets de plus pour le Mystique : Déluge (une action, tous les orbes restants sur
   un même adversaire), Éruption (un passif élémentaire : l'orbe fait éclater l'état sur les voisins
   de la cible), Implosion (un critique rend 1 point d'Action), Dégâts élémentaires (le bonus de
   dégâts s'ajoute aux orbes). */
{const C=require('./combat.js');
 const d=C.TALENTS_CODES.deluge,e=C.TALENTS_CODES.eruption,i=C.TALENTS_CODES.implosion,g=C.TALENTS_CODES.degatselem;
 assert.ok(d&&d.type==='act'&&!d.gratuit&&!d.params.length&&!d.monstre,'Déluge : une action, qui coûte');
 assert.ok(e&&e.type==='pass'&&e.params.map(p=>p.cle).join()==='etat'&&C.paramsTalent({effet:'eruption',params:{}}).etat==='Feu','Éruption : un passif, son état, Feu par défaut');
 assert.ok(i&&i.type==='pass'&&!i.params.length&&g&&g.type==='pass'&&!g.params.length,'Implosion et Dégâts élémentaires : des passifs sans réglage');
 assert.ok(C.phraseTalent('deluge',{}).includes('<b>tous ses orbes</b>')&&C.phraseTalent('eruption',{etat:'Gel'}).includes('portant <b>Gel</b>')
  &&C.phraseTalent('implosion',{}).includes('<b>1 point d’Action</b>')&&C.phraseTalent('degatselem',{}).includes('<b>bonus de dégâts</b>'),'chacun se dit en une phrase');
 assert.equal(C.effetParNom('Déluge'),'deluge');assert.equal(C.effetParNom('Éruption'),'eruption');assert.equal(C.effetParNom('Implosion'),'implosion');
 // Éruption suit l'élément du Mystique, comme Orbes de feu.
 const t={id:'e',name:'Éruption',effet:'eruption',elementaire:true,params:{etat:'Feu'}};
 assert.equal(C.talentPourElement(t,C.ELEMENTS[1]).params.etat,C.ELEMENTS[1].etat,'l’état de l’Éruption suit l’élément');}
/* Chaque script du site se compile en entier : un nom déclaré deux fois dans le même bloc ne se
   voit qu'à la compilation du fichier, et bloquait tout le chargement de la page. */
{for(const f of ['combat.js','catalog.js','planches-calcul.js','planches.js','editor.js','maps.js','domaine.js','campagnes.js','shared-data.js','shared.js','live.js','planches-worker.js']){
  try{new vm.Script(fs.readFileSync(f,'utf8'),{filename:f})}catch(e){assert.fail(f+' ne se compile pas : '+e.message)}}
 const page=fs.readFileSync('index.html','utf8'),blocs=[...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 blocs.forEach((js,i)=>{try{new vm.Script(js,{filename:'index.html#'+i})}catch(e){assert.fail('index.html, script '+i+' : '+e.message)}});}
/* Paliers en sommeil : tout talent se joue, se lit et se paie à son palier 1 ; un palier 2 ou 3
   retenu par un aventurier, ou écrit au catalogue, reste en place sans agir. */
{const C=require('./combat.js');C.PALIERS.actifs=false;
 const t={id:'o',effet:'orbes',params:{orbes:1},effects:'Un orbe',couts:[1,2,3],paliers:{2:{params:{orbes:2},effects:'Deux orbes'}}};
 const a={talents:['o'],paliersTalents:{o:2}};
 assert.equal(C.paliersDe(t),1);assert.equal(C.palierDe(a,t),1);assert.equal(C.talentAuPalier(t,3),t,'le palier 1, quoi qu’on demande');
 assert.deepEqual(C.talentsAuPalier(a,[t]).map(x=>x.params.orbes),[1],'le moteur joue le palier 1');
 assert.equal(C.ptDepenses(a,[t]),1,'seul le palier 1 se paie');
 assert.deepEqual(C.normalisePaliersActeur(a),{o:2},'le palier retenu reste écrit, pour quand les paliers reviendront');}
console.log('1964 vérifications passées : dimensions PNG/JPEG/WebP, catalogue, dégâts, édition de fiche, contact, ligne de vue et matière exacte.');
