/* v0.969 — Import d'adversaires au Bestiaire, depuis un texte « Clé : valeur ».
   Un bloc par adversaire, séparés par une ligne « --- ». Le bouton « Modèle d'import » télécharge le texte à remplir,
   chaque clé y est expliquée ; « Importer » lit un fichier ou un texte collé. Un adversaire du même nom qu'un adversaire
   du Bestiaire — casse et accents ignorés — est un doublon : le MJ choisit, pour chacun, de remplacer l'existant ou
   d'ignorer l'import. Un talent cité est relié s'il existe ; inconnu, il est créé en coquille, sans mécanique, dans la
   famille Adversaires, à câbler ensuite dans l'éditeur de talents. Armes, armures et objets se relient par leur nom. */
(function(){
const cle=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
const oui=v=>/^(oui|o|yes|y|vrai|true|1|x)$/i.test(cle(v));
const entier=(v,min,max,def)=>{const n=Math.round(Number(String(v).replace(',','.').replace(/[^\d.\-]/g,'')));return Number.isFinite(n)&&String(v).trim()!==''?Math.max(min,Math.min(max,n)):def};
const CHOIX={
 type:{standard:'standard',elite:'alpha',alpha:'alpha',solitaire:'solitaire',boss:'boss'},
 socle:{petit:'small',p:'small',small:'small',moyen:'medium',m:'medium',medium:'medium',grand:'large',g:'large',large:'large',enorme:'huge',huge:'huge',tg:'huge'},
 nature:{vivant:'vivant','mort-vivant':'mortvivant','mort vivant':'mortvivant',mortvivant:'mortvivant',mecanique:'mecanique'},
 menace:{'plus proche':'closest',proche:'closest',closest:'closest','pv bas':'pvLow',pvlow:'pvLow','pv haut':'pvHigh','pv hauts':'pvHigh',pvhigh:'pvHigh','def basse':'defLow',deflow:'defLow'},
 alignement:{allie:'allie',neutre:'neutre',adverse:'adverse',hostile:'adverse',ennemi:'adverse'},
 portee:{contact:'contact','au contact':'contact',distance:'distance','a distance':'distance'},
 cibles:{'une cible':'one',une:'one',one:'one','1':'one',toutes:'all','toutes les cibles':'all',all:'all'},
 typeTalent:{passif:'pass',pass:'pass',action:'act',act:'act','action bonus':'abon',bonus:'abon',abon:'abon',reaction:'reac',reac:'reac',mouvement:'mvt',mvt:'mvt'}};
const DES={blanc:'white',blancs:'white',simple:'white',simples:'white',os:'bone',leger:'bone',legers:'bone',beige:'bone',beiges:'bone',ivoire:'bone',
 rouge:'red',rouges:'red',lourd:'red',lourds:'red',bleu:'blue',bleus:'blue',mystique:'blue',mystiques:'blue',vert:'green',verts:'green',soin:'green',
 noir:'black',noirs:'black',mortel:'black',mortels:'black',jaune:'yellow',jaunes:'yellow',phase:'yellow'};
const ETATS=()=>(typeof ETATS_JEU!=='undefined'?ETATS_JEU:[]);
const etatImport=v=>ETATS().find(e=>cle(e)===cle(v))||null;
const objetImport=nom=>(catalog.items||[]).find(o=>o&&!o.forge&&cle(o.name)===cle(nom))||(catalog.items||[]).find(o=>o&&cle(o.name)===cle(nom))||null;

/* Le modèle : toutes les clés d'un adversaire, chacune expliquée, puis un exemple complet. */
function modeleImport(){const ext=(typeof EXTENSIONS!=='undefined'?EXTENSIONS:[]).map(([k])=>k).join(' | ');
 return ['# ===== Amertüme Online · Modèle d’import d’adversaires =====',
 '# Un bloc par adversaire. Les blocs se séparent par une ligne qui ne contient que ---',
 '# Une ligne par caractéristique : « Clé : valeur ». Les lignes qui commencent par # sont ignorées.',
 '# Seul le Nom est obligatoire ; une clé absente prend la valeur par défaut indiquée entre crochets.',
 '# Les clés Attaque, Talent, Arme, Armure, Objet et Bourse se répètent : une ligne par élément.',
 '# Un adversaire du même nom qu’un adversaire du Bestiaire est un doublon : l’import demande de le remplacer ou de l’ignorer.',
 '#',
 '# Nom : texte                                   (obligatoire)',
 '# Famille : texte                               [vide] — Bête, Mort-vivant, Gobelinoïde…',
 '# Type : standard | élite | solitaire | boss    [standard]',
 '# PNJ : oui | non                               [non]',
 '# Alignement : allié | neutre | adverse         [neutre] — PNJ seulement',
 '# Unique : oui | non                            [non] — PNJ seulement',
 '# Sexe : texte                                  [vide]',
 '# Race : texte                                  [vide]',
 '# Nature : vivant | mort-vivant | mécanique     [vivant]',
 '# Extension : '+ext+'   [aucune]',
 '# Socle : petit | moyen | grand | énorme        [moyen]',
 '# PV : nombre                                   [1]',
 '# DEF : 0 à '+(typeof DEF_MAX!=='undefined'?DEF_MAX:6)+'                                    [0]',
 '# Bonus DEF : 0 à '+(typeof DEF_MAX!=='undefined'?DEF_MAX:6)+'                              [0] — s’ajoute à la DEF, même sous une armure',
 '# Dégâts : nombre                               [0] — bonus de dégâts ajouté aux attaques',
 '# XP : nombre                                   [0]',
 '# Mouvement : mètres                            ['+(typeof DISTANCE_MOUVEMENT!=='undefined'?DISTANCE_MOUVEMENT:9)+']',
 '# Vision dans le noir : oui | non               [oui]',
 '# Rapide : oui | non                            [non]',
 '# Esquive : oui | non                           [non]',
 '# Menace : plus proche | PV bas | PV haut | DEF basse   [plus proche] — qui il vise en priorité',
 '# Image : adresse https://… ou img/…            [aucune]',
 '# Notes : texte libre                           [vide]',
 '#',
 '# Attaque : Nom | portée | dés | cibles | options…',
 '#    portée : contact | distance',
 '#    dés : nombre et couleur, séparés par des virgules — blanc, os, rouge, bleu, vert, noir, jaune (ou simple, léger, lourd, mystique, soin, mortel, phase)',
 '#    cibles : une cible | toutes',
 '#    options, chacune facultative : états : Feu, Poison… | sans dégâts | armure : 2 | texte : effet libre',
 '#    exemple : Attaque : Morsure | contact | 2 rouge, 1 blanc | une cible | états : Saignée',
 '#',
 '# Talent : Nom                                  — relié s’il existe au catalogue ; sinon, créé sur la mécanique du moteur de ce nom (Régénération, Meute, Nuée…)',
 '# Talent : Nom | type | texte                   — inconnu, il est créé sans mécanique, à câbler dans l’éditeur de talents',
 '#    type : passif | action | action bonus | réaction | mouvement   [passif]',
 '#',
 '# Arme : nom d’une arme de l’Armurerie          — équipée',
 '# Armure : nom d’une armure de l’Armurerie      — équipée',
 '# Bouclier : nom d’un bouclier de l’Armurerie   — équipé',
 '# Objet : nom | quantité | chance de butin %    — dans son inventaire ; [1] [25 %]',
 '#    une arme, une armure ou un bouclier équipés peuvent aussi avoir leur ligne Objet, pour leur chance de butin',
 '# Bourse : or | 2d6 | 100 %                     — ce qu’il laisse : or, ou une gemme brisure|eclat|brome-citrine|emeraude|saphir|rubis|diamant (ex. eclat-rubis)',
 '# Forge : chance % | min | max                  — pièces forgées qu’il peut porter : chance 0 à 100, de min à max affixes (0 à 4)',
 '',
 'Nom : Gobelin pillard',
 'Famille : Gobelinoïde',
 'Type : standard',
 'PNJ : non',
 'Nature : vivant',
 'Extension : ',
 'Socle : petit',
 'PV : 8',
 'DEF : 2',
 'Bonus DEF : 0',
 'Dégâts : 1',
 'XP : 6',
 'Mouvement : 9',
 'Vision dans le noir : oui',
 'Rapide : non',
 'Esquive : oui',
 'Menace : PV bas',
 'Image : ',
 'Notes : Attaque en bande, fuit à la moitié de ses PV.',
 'Attaque : Coutelas | contact | 2 blanc | une cible',
 'Attaque : Fronde | distance | 1 blanc, 1 os | une cible | états : Affaibli',
 'Talent : Meute',
 'Talent : Lâcheté | passif | Sous la moitié de ses PV, il fuit le combat.',
 'Objet : Ration | 1 | 50',
 'Bourse : or | 1d6 | 100',
 '---',
 'Nom : ',
 ''].join('\n')}

/* La lecture : des blocs, puis des fiches de modèle, avec les avertissements de chacun. */
function lisImport(texte){const blocs=String(texte||'').replace(/\r/g,'').split(/\n\s*-{3,}\s*(?:\n|$)/);const out=[];
 blocs.forEach((b,ib)=>{const lignes=b.split('\n').map(l=>l.replace(/\s+#.*$/,'').trim()).filter(l=>l&&!l.startsWith('#'));if(!lignes.length)return;
  const r={champs:{},repetes:{attaque:[],talent:[],arme:[],armure:[],bouclier:[],objet:[],bourse:[]},avis:[]};
  lignes.forEach(l=>{const i=l.indexOf(':');if(i<0){r.avis.push('ligne sans « : » ignorée : '+l);return}
   const k=cle(l.slice(0,i)),v=l.slice(i+1).trim();
   if(r.repetes[k]!==undefined){if(v)r.repetes[k].push(v)}else r.champs[k]=v});
  out.push(r)});
 return out.map(construis)}
const CLES_CONNUES=['nom','famille','type','pnj','alignement','unique','sexe','race','nature','extension','socle','pv','def','bonus def','degats','xp','mouvement','vision dans le noir','rapide','esquive','menace','image','notes','forge'];
function construis(r){const c=r.champs,avis=r.avis,nom=(c.nom||'').trim();
 Object.keys(c).forEach(k=>{if(!CLES_CONNUES.includes(k))avis.push('clé inconnue ignorée : '+k)});
 const choix=(k,v,def)=>{if(!v)return def;const x=CHOIX[k][cle(v)];if(x===undefined){avis.push(k+' inconnu(e) : « '+v+' », '+def+' retenu');return def}return x};
 const m={name:nom,family:(c.famille||'').slice(0,60),type:choix('type',c.type,'standard'),socle:choix('socle',c.socle,'medium'),
  sexe:c.sexe||'',race:c.race||'',pv:entier(c.pv,1,99999,1),def:entier(c.def,0,DEF_MAX,0),damage:entier(c.degats,0,999,0),xp:entier(c.xp,0,999999,0),
  menace:choix('menace',c.menace,'closest'),rapide:oui(c.rapide),esquive:oui(c.esquive),notes:c.notes||'',talents:[],attacks:[],image:null,
  weapons:[],armures:[],shieldId:'',inventaire:[],butin:{},bourse:[]};
 const db=entier(c['bonus def'],0,DEF_MAX,0);if(db>0)m.defBonus=db;
 if(c['vision dans le noir']&&!oui(c['vision dans le noir']))m.nyctalope=false;
 if(c.mouvement){const v=Number(String(c.mouvement).replace(',','.').replace(/[^\d.]/g,''));if(Number.isFinite(v)&&v!==DISTANCE_MOUVEMENT)m.mouvement=Math.max(0,Math.min(99,Math.round(v*2)/2))}
 const nat=choix('nature',c.nature,'vivant');if(nat!=='vivant')m.nature=nat;
 if(c.extension){const e=(typeof EXTENSIONS!=='undefined'?EXTENSIONS:[]).find(([k,n])=>cle(k)===cle(c.extension)||cle(n)===cle(c.extension));if(e)m.extension=e[0];else avis.push('extension inconnue : '+c.extension)}
 if(c.image){if(/^(https:\/\/|img\/|data:image\/)/.test(c.image))m.image=c.image;else avis.push('image ignorée (adresse https://… ou img/… attendue)')}
 if(oui(c.pnj)){m.pnj=true;m.alignement=choix('alignement',c.alignement,'neutre');if(oui(c.unique))m.unique=true}
 if(c.forge){const p=c.forge.split('|').map(x=>x.trim());const f=normaliseForgeAdv({chance:p[0]===''?null:entier(p[0],0,100,null),min:entier(p[1],0,4,0),max:entier(p[2],1,4,4)});if(f)m.forge=f}
 // Les attaques.
 r.repetes.attaque.forEach(l=>{const p=l.split('|').map(x=>x.trim());const at={name:(p[0]||'Attaque').slice(0,100),dice:Object.fromEntries(DICE_KEYS.map(k=>[k,0])),range:choix('portee',p[1],'contact'),targets:choix('cibles',p[3],'one'),useOwnDamage:true,etats:[]};
  (p[2]||'').split(/[,+]/).map(x=>x.trim()).filter(Boolean).forEach(d=>{const mm=d.match(/^(\d+)\s*(?:d[eé]s?\s*)?(.+)$/i)||d.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
   let n=1,coul=d;if(mm){if(/^\d+$/.test(mm[1])){n=+mm[1];coul=mm[2]}else{coul=mm[1];n=+mm[2]}}const k=DES[cle(coul).replace(/^de\s+/,'')];
   if(!k){avis.push('dé inconnu dans « '+at.name+' » : '+d);return}at.dice[k]=Math.min(12,at.dice[k]+n)});
  if(!DICE_KEYS.some(k=>at.dice[k]>0))avis.push('attaque « '+at.name+' » sans dé');
  p.slice(4).forEach(o=>{const oc=cle(o);
   if(oc.startsWith('etats')||oc.startsWith('etat')){o.slice(o.indexOf(':')+1).split(',').map(x=>x.trim()).filter(Boolean).forEach(e=>{const s=etatImport(e);if(s){if(!at.etats.includes(s))at.etats.push(s)}else avis.push('état inconnu dans « '+at.name+' » : '+e)})}
   else if(oc==='sans degats'||oc==='sans bonus')at.useOwnDamage=false;
   else if(oc.startsWith('armure'))at.armure=entier(o.slice(o.indexOf(':')+1),0,99,0);
   else if(oc.startsWith('texte'))at.effectText=o.slice(o.indexOf(':')+1).trim();
   else avis.push('option inconnue dans « '+at.name+' » : '+o)});
  if(at.etats.length)at.etat=at.etats[0];else delete at.etats;if(!at.armure)delete at.armure;
  m.attacks.push(at)});
 // L'équipement et l'inventaire, par leur nom dans l'Armurerie.
 const pose=(liste,quoi,fn)=>liste.forEach(l=>{const n=l.split('|')[0].trim(),o=objetImport(n);if(!o){avis.push(quoi+' introuvable dans l’Armurerie : '+n);return}fn(o,l)});
 pose(r.repetes.arme,'arme',o=>m.weapons.push(o.id));
 pose(r.repetes.armure,'armure',o=>m.armures.push(o.id));
 pose(r.repetes.bouclier,'bouclier',o=>{m.shieldId=o.id});
 pose(r.repetes.objet,'objet',(o,l)=>{const p=l.split('|').map(x=>x.trim()),q=entier(p[1],1,99,1);for(let k=0;k<q;k++)m.inventaire.push(o.id);if(p[2]!==undefined&&p[2]!=='')m.butin[o.id]=entier(p[2],0,100,25)});
 [...m.weapons,...m.armures,m.shieldId].filter(Boolean).forEach(id=>{const besoin=[...m.weapons,...m.armures,m.shieldId].filter(x=>x===id).length;for(let k=m.inventaire.filter(x=>x===id).length;k<besoin;k++)m.inventaire.push(id)});
 m.butin=normaliseButin(m.butin,m.inventaire);
 r.repetes.bourse.forEach(l=>{const p=l.split('|').map(x=>x.trim()),k=cle(p[0]).replace(/\s+/g,'-'),d=(p[1]||'').match(/^(\d+)\s*d\s*(\d+)$/i);
  if(!CLES_RICHESSES.includes(k)){avis.push('bourse : richesse inconnue « '+p[0]+' »');return}if(!d){avis.push('bourse : dés attendus sous la forme 2d6 pour « '+p[0]+' »');return}
  m.bourse.push({k,n:+d[1],f:+d[2],...(p[2]?{p:entier(p[2],0,100,100)}:{})})});
 m.bourse=normaliseBourse(m.bourse);
 return {modele:m,talents:r.repetes.talent,avis}}

/* Les talents : reliés par leur nom ; inconnus, créés en coquille dans la famille Adversaires. */
function relieTalents(m,lignes,rapport){lignes.forEach(l=>{const p=l.split('|').map(x=>x.trim()),nom=p[0];if(!nom)return;
 const t=(catalog.talents||[]).find(x=>x&&cle(nomEnClair(x.name))===cle(nom));
 if(t){if(!m.talents.includes(t.id))m.talents.push(t.id);return}
 // Pas au catalogue, mais une mécanique du moteur porte ce nom : le talent est créé, câblé sur elle.
 const codes=typeof TALENTS_CODES!=='undefined'?Object.values(TALENTS_CODES).filter(c=>c&&(cle(c.nom)===cle(nom)||cle(c.nom)===cle(nom+' (adversaire)'))):[],code=codes.find(c=>c.monstre)||codes[0]||null;
 if(code){const n={id:crypto.randomUUID(),name:nom.slice(0,120),famille:typeof ADVERSAIRES!=='undefined'?ADVERSAIRES:'Adversaires',type:code.type||'pass',level:1,effet:code.cle,effects:(p[2]||'').slice(0,600),logo:'',params:{},couts:[0,0,0]};
  catalog.talents.push(n);m.talents.push(n.id);rapport.cables.push(nom);return}
 const ty=CHOIX.typeTalent[cle(p[1]||'passif')]||'pass';
 const n={id:crypto.randomUUID(),name:nom.slice(0,120),famille:typeof ADVERSAIRES!=='undefined'?ADVERSAIRES:'Adversaires',type:ty,level:1,effects:(p[2]||'').slice(0,600),notes:'Importé sans mécanique : à câbler dans l’éditeur de talents.',logo:'',params:{},couts:[0,0,0]};
 catalog.talents.push(n);m.talents.push(n.id);rapport.coquilles.push(nom)})}

/* L'import : les doublons d'abord, puis tout s'écrit d'un coup. */
let lu=null;
const dlg=dialog('import-adversaires','Importer des adversaires','<form id="import-adv-form"><p class="muted">Colle le texte rempli d’après le modèle, ou choisis un fichier .txt.</p>'
 +'<textarea name="texte" rows="14" spellcheck="false"></textarea>'
 +'<div class="form-actions"><button type="button" id="import-adv-fichier-btn">Choisir un fichier</button><input type="file" id="import-adv-fichier" accept=".txt,text/plain" hidden><button class="primary">Lire</button></div>'
 +'<div id="import-adv-doublons"></div><p class="form-error" id="import-adv-erreur" role="status" aria-live="polite"></p></form>');
$('import-adv-fichier-btn').onclick=()=>{$('import-adv-fichier').value='';$('import-adv-fichier').click()};
$('import-adv-fichier').onchange=async()=>{const f=$('import-adv-fichier').files[0];if(!f)return;$('import-adv-form').elements.texte.value=await f.text()};
$('import-adv-form').onsubmit=e=>{e.preventDefault();if(view!=='mj')return;const err=$('import-adv-erreur'),box=$('import-adv-doublons');err.textContent='';box.replaceChildren();
 const l=lisImport($('import-adv-form').elements.texte.value),sansNom=l.filter(x=>!x.modele.name);lu=l.filter(x=>x.modele.name);
 if(!lu.length){err.textContent='Aucun adversaire lisible : chaque bloc doit avoir au moins « Nom : … ».';return}
 // Doublons : contre le Bestiaire, et dans le fichier lui-même.
 const vus=new Map();lu.forEach(x=>{const k=cle(x.modele.name);x.existant=(catalog.monsters||[]).find(m=>cle(m.name)===k)||null;x.repete=vus.has(k);vus.set(k,true)});
 const doublons=lu.filter(x=>x.existant||x.repete);
 if(!doublons.length){importe(sansNom.length);return}
 const t=document.createElement('div');t.className='import-doublons';const h=document.createElement('h3');h.textContent=doublons.length+' doublon'+(doublons.length>1?'s':'');t.append(h);
 doublons.forEach(x=>{const r=document.createElement('label');r.className='import-doublon';const n=document.createElement('span');n.textContent=x.modele.name+(x.repete?' (deux fois dans le texte)':'');
  const s=document.createElement('select');[['ignorer','Ignorer'],['remplacer','Remplacer l’existant']].forEach(([v,lab])=>s.add(new Option(lab,v)));s.onchange=()=>{x.choix=s.value};x.choix='ignorer';r.append(n,s);t.append(r)});
 const a=document.createElement('div');a.className='form-actions';
 const tous=(v)=>{doublons.forEach(x=>x.choix=v);t.querySelectorAll('select').forEach(s=>s.value=v)};
 const b1=document.createElement('button');b1.type='button';b1.textContent='Tout ignorer';b1.onclick=()=>tous('ignorer');
 const b2=document.createElement('button');b2.type='button';b2.textContent='Tout remplacer';b2.onclick=()=>tous('remplacer');
 const b3=document.createElement('button');b3.type='button';b3.className='primary';b3.textContent='Importer';b3.onclick=()=>importe(sansNom.length);
 a.append(b1,b2,b3);t.append(a);box.append(t)};
function importe(sansNom){const rapport={crees:0,remplaces:0,ignores:0,coquilles:[],cables:[],avis:[]};const faits=new Map(),remplaces=[];
 lu.forEach(x=>{const k=cle(x.modele.name);
  // Un nom répété dans le texte : la dernière occurrence retenue l'emporte si « remplacer », sinon la première reste.
  const deja=faits.get(k)||x.existant;
  if(deja&&x.choix!=='remplacer'){rapport.ignores++;return}
  relieTalents(x.modele,x.talents,rapport);x.avis.forEach(a=>rapport.avis.push(x.modele.name+' : '+a));
  if(deja){const i=catalog.monsters.indexOf(deja);const m={...x.modele,id:deja.id};if(i>=0)catalog.monsters[i]=m;else catalog.monsters.push(m);faits.set(k,m);rapport.remplaces++;remplaces.push(m)}
  else{const m={...x.modele,id:crypto.randomUUID()};catalog.monsters.push(m);faits.set(k,m);rapport.crees++}});
 normalizeCatalog(catalog);
 // Remplacé, un modèle met à jour ceux qui combattent déjà sous son nom.
 remplaces.forEach(m=>{if(typeof syncFromTemplate==='function')try{syncFromTemplate(m)}catch(e){}});
 renderCatalogPages();if(typeof render==='function')render();scheduleSave();document.dispatchEvent(new Event('amertume-content-changed'));
 const ligne='Import d’adversaires : '+rapport.crees+' créé'+(rapport.crees>1?'s':'')+', '+rapport.remplaces+' remplacé'+(rapport.remplaces>1?'s':'')+', '+rapport.ignores+' ignoré'+(rapport.ignores>1?'s':'')
  +(sansNom?', '+sansNom+' bloc'+(sansNom>1?'s':'')+' sans nom':'')+(rapport.cables.length?'. Talents créés sur leur mécanique : '+[...new Set(rapport.cables)].join(', '):'')+(rapport.coquilles.length?'. Talents créés sans mécanique : '+[...new Set(rapport.coquilles)].join(', '):'')+'.';
 log(ligne,{local:true});rapport.avis.forEach(a=>log('Import · '+a,{local:true}));
 const box=$('import-adv-doublons');box.replaceChildren();const p=document.createElement('p');p.className='import-rapport';p.textContent=ligne;box.append(p);
 if(rapport.avis.length){const u=document.createElement('ul');u.className='import-avis';rapport.avis.forEach(a=>{const li=document.createElement('li');li.textContent=a;u.append(li)});box.append(u)}
 lu=null}
function telechargeModele(){const url=URL.createObjectURL(new Blob([modeleImport()],{type:'text/plain;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='modele-import-adversaires.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
// Les deux boutons, en tête du Bestiaire.
{const act=document.querySelector('#bestiary-page .cat-actions');if(act){
 const m=document.createElement('button');m.type='button';m.id='bestiary-modele';m.textContent='📄 Modèle d’import';m.title='Télécharger le texte à remplir pour importer des adversaires';m.onclick=telechargeModele;
 const i=document.createElement('button');i.type='button';i.id='bestiary-import';i.textContent='⇧ Importer';i.title='Importer des adversaires depuis un texte rempli d’après le modèle';
 i.onclick=()=>{if(view!=='mj')return;$('import-adv-form').reset();$('import-adv-doublons').replaceChildren();$('import-adv-erreur').textContent='';lu=null;dlg.showModal()};
 const avant=$('bestiary-pnj');if(avant)act.insertBefore(m,avant),act.insertBefore(i,avant);else act.append(m,i)}}
Object.assign(window,{modeleImport,lisImport});
})();
