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
/* v0.330 — Les grandes images partent à part : la publication n'en garde qu'une référence. */
{const S=require('./shared-data.js');const grande='data:image/webp;base64,'+'A'.repeat(S.SEUIL_IMAGE+10),petite='data:image/png;base64,QUJD';
 const h='a'.repeat(64),ref=S.refImage(h,2);assert.equal(ref,'amertume-image:'+h+':2');assert.deepEqual(S.lisRef(ref),{h,parts:2});
 assert.equal(S.lisRef('amertume-image:xyz:2'),null);assert.equal(S.lisRef('amertume-image:'+h+':0'),null);
 const v={...valid,mapImage:grande,maps:[{id:'m',name:'X',image:grande,walls:[],doors:[],foes:[]}],domaine:{carte:{calques:[grande,null,petite]}},icones:{'planches/a.webp#1':petite}};
 assert.deepEqual([...S.grandesImages(v)],[grande],'une seule grande image, même citée trois fois ; les petites restent');
 const leger=S.remplace(v,new Map([[grande,ref]]));
 assert.equal(leger.mapImage,ref);assert.equal(leger.maps[0].image,ref);assert.equal(leger.domaine.carte.calques[0],ref);assert.equal(leger.domaine.carte.calques[2],petite);assert.equal(v.mapImage,grande,'l’original ne change pas');
 assert.equal(S.validate(leger),leger,'une référence tient lieu d’image');assert.deepEqual([...S.refsImages(leger)],[ref]);
 assert.throws(()=>S.validate({...valid,mapImage:'amertume-image:pas-une-empreinte:1'}));
 assert.deepEqual(S.remplace(leger,new Map([[ref,grande]])),{...v},'et redevient l’image');
 assert.throws(()=>S.pack({t:'x'.repeat(S.MAX+1)}),/16,1 Mo, pour une limite de 16 Mo/);}
console.log('Partage : 29 contrôles passés (Unicode, blocs, limite, schéma, images et identifiants).');
