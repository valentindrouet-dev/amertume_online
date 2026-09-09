const assert=require('node:assert/strict');const {pack,unpack,validate}=require('./shared-data.js');
const source={text:'Éla 🐉'.repeat(70000)};const p=pack(source);assert.ok(p.chunks.length>1);assert.deepEqual(unpack(p.chunks,p.bytes),source);assert.throws(()=>unpack(p.chunks.slice(1),p.bytes));assert.throws(()=>pack({s:'x'.repeat(17*1024*1024)}));
const valid={schema:1,catalog:{items:[],monsters:[]},actors:[{name:'Éla',hero:true,pool:[1,0,0,0,0,0,0],skills:Array(8).fill(1),hp:3,max:4,def:2,dmg:1,x:20,y:20}]};assert.equal(validate(valid),valid);assert.throws(()=>validate({...valid,actors:[]}));assert.throws(()=>validate({...valid,mapImage:'javascript:alert(1)'}));assert.throws(()=>validate({...valid,catalog:{items:[{id:'" onclick="bad'}],monsters:[]}}));assert.throws(()=>validate(JSON.parse('{"schema":1,"actors":[],"__proto__":{}}')));assert.equal(validate({...valid,maps:[{id:'m',name:'Ruines',walls:[{x:1,y:1,w:5,h:5}],doors:[],foes:[],start:null}]}).maps.length,1);
assert.throws(()=>validate({...valid,maps:[{id:'m',name:'X',walls:[{x:1,y:1,w:'grand',h:5}],doors:[],foes:[]}]}));
assert.throws(()=>validate({...valid,maps:'non'}));
// Le rayon des talents est facultatif, mais s'il est là c'est une liste de taille tenue.
assert.equal(validate({...valid,catalog:{items:[],monsters:[],talents:[{id:'t1',name:'Course'}]}}).catalog.talents.length,1);
assert.equal(validate({...valid,catalog:{items:[],monsters:[]}}).catalog.talents,undefined);
assert.throws(()=>validate({...valid,catalog:{items:[],monsters:[],talents:'non'}}));
assert.throws(()=>validate({...valid,catalog:{items:[],monsters:[],talents:Array(2001).fill({id:'t'})}}));
assert.throws(()=>validate({...valid,catalog:{items:[],monsters:[],talents:[{id:'sale id'}]}}));
console.log('Partage : 17 contrôles passés (Unicode, blocs, limite, schéma, images et identifiants).');
