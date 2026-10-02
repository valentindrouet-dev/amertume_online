/* La conversion des dégâts de D&D 5.5 en poignées d'Amertüme : ses tests tirent des milliers de lancers et
   tournent à part, en même temps que checks.cjs — verif.cjs les lance ensemble. */
const assert=require('assert/strict'),C=require('./combat.js');
{ const r=C.conversionDegats('2d6');assert.equal(r.propositions.length,6);
 r.propositions.forEach(p=>{assert.ok(Math.abs(p.moyenne-7)<0.6,'proche de 7');assert.equal(p.bonus,undefined,'des dés seuls')});
 assert.ok(r.propositions.some(p=>JSON.stringify(p.des)==='{"white":2}'),'2d6 : deux dés simples parmi les propositions');
 assert.equal(new Set(r.propositions.map(p=>Object.keys(p.des).sort().join('+'))).size,6,'six mélanges différents');
 assert.equal(C.conversionDegats('3d8+4').moyenne,13.5,'un bonus tapé n’entre pas dans la moyenne');
 C.conversionDegats('3d8').propositions.forEach(p=>assert.ok(Math.abs(p.moyenne-13.5)<1&&p.n<=5,'proche de 13,5'));
 ['8d6','10d6'].forEach(t=>assert.ok(C.conversionDegats(t).propositions.every(p=>p.n<=5&&Object.values(p.des).reduce((x,y)=>x+y,0)<=5),t+' : cinq dés au plus'));
 assert.ok(C.conversionDegats('3d8').propositions.some(p=>Object.keys(p.des).length>1),'des poignées panachées');
 assert.equal(C.conversionDegats('3d8').def,undefined,'une valeur absolue, sans DEF');
 ['2d6','3d8','7d6'].forEach(t=>assert.ok(C.conversionDegats(t).propositions.every(p=>!p.des.black),t+' : pas de Mortel sous 25'));
 assert.ok(C.conversionDegats('8d6').propositions.every(p=>(p.des.black||0)<=1)&&C.conversionDegats('10d6').propositions.every(p=>(p.des.black||0)<=3),'un Mortel de plus tous les 5 points');
 assert.deepEqual(C.moyennePoignee({red:2,white:1},3),C.moyennePoignee({red:2,white:1},3),'le hasard est semé');}
console.log('Conversion des dés : poignées, moyennes et Mortels vérifiés.');
