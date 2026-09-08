/* Conventions provisoires de résolution, détaillées dans l'interface. */
(function(root){
function resolveAttack({dice,def,dmg,round=1,criticalColor=0,roll}){
 const all=dice.map(d=>[...d]);
 if(!all.length||all.some(([v,c])=>!Number.isInteger(v)||v<1||v>6||![0,1,2,3,5,6].includes(c)))throw Error('Réserve offensive invalide');
 if(all.filter(([v,c])=>v===1&&c!==5).length>=2)return {dice:all,damage:0,failed:true,critical:false};
 const critical=all.filter(([v])=>v===6).length>=2;
 if(critical){if(!all.some(([,c])=>c===criticalColor))throw Error('Couleur critique absente');let v;let count=0;do{v=roll();all.push([v,criticalColor]);if(++count>=100&&v===6)throw Error('Limite de relances atteinte, attaque non appliquée');}while(v===6)}
 const counts={};all.forEach(([v])=>counts[v]=(counts[v]||0)+1);
 const kept=all.filter(([v,c])=>!(c===1&&counts[v]>1));const remaining={};kept.forEach(([v])=>remaining[v]=(remaining[v]||0)+1);
 let damage=0,hit=false;
 kept.forEach(([v,c])=>{if(c===2||c===5||v>def){hit=true;damage+=v*(c===3&&remaining[v]>1?2:c===6?Math.min(3,Math.max(1,round)):1)}});
 return {dice:all,damage:damage+(hit?dmg:0),failed:false,critical,hit};
}
if(typeof module!=='undefined')module.exports={resolveAttack};else root.resolveAttack=resolveAttack;
})(globalThis);
