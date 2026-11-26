import {PERIODS,AREAS,indicators,key,signerSet,score,resultFor,ended,fresh} from '../src/model.js';
import {finalReadiness} from '../src/final-archive.js';
import {createHash,scryptSync,timingSafeEqual} from 'node:crypto';
export const hash=v=>createHash('sha256').update(v).digest('hex');
export function passwordMatches(password,encoded){try{const [salt,hex]=encoded.split(':');const target=Buffer.from(hex,'hex');return target.length===64&&timingSafeEqual(scryptSync(password,salt,64),target)}catch{return false}}
const requireText=(v,max=500)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const roleSet=new Set(['reviewer','committee']);
export function validateConfig(config){
 if(!config||!Array.isArray(config.accounts)||!Array.isArray(config.staff))throw Error('Konfigurasi akun/staf tidak valid');
 const ids=new Set();
 for(const a of config.accounts){if(!/^[a-zA-Z0-9_.-]{3,80}$/.test(a.id)||ids.has(a.id)||!requireText(a.name)||!requireText(a.nip)||!requireText(a.role)||!Array.isArray(a.permissions)||a.permissions.some(p=>!['admin','reviewer','committee'].includes(p))||!/^([0-9a-f]{32,}):([0-9a-f]{128})$/.test(a.passwordHash||''))throw Error('Konfigurasi akun tidak valid');ids.add(a.id)}
 const staffIds=new Set();for(const s of config.staff){if(!requireText(s.id,120)||staffIds.has(s.id)||!requireText(s.name)||!requireText(s.professionId)||s.needsReview!==false)throw Error('Staf belum diverifikasi atau ID ganda');staffIds.add(s.id);for(const q of PERIODS){const x=assignment(s,q),r=config.accounts.find(a=>a.id===x.reviewer),c=config.accounts.find(a=>a.id===x.committee);if(!r?.permissions.includes('reviewer')||!c?.permissions.includes('committee')||r.id===c.id||samePerson(r,s)||samePerson(c,s))throw Error('Penugasan penandatangan tidak valid untuk '+s.id+' '+q.id);if((s.isHead||s.directSection)&&!/\b(?:kepala\s+seksi|kasi)\b/i.test(r.role))throw Error('Penilai kepala unit harus kepala seksi: '+s.id)}}
 return config;
}
function samePerson(a,s){const canon=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,'');return canon(a.name)===canon(s.name)||!!(canon(a.nip)&&canon(a.nip)===canon(s.employeeId))}
export const assignment=(s,p)=>s.assignments?.[p.id]||s.assignment||{};
export function buildRequest(config,catalog,request,now=new Date()){
 const source=config.staff.find(s=>s.id===request?.staffId);if(!source)throw Error('Staf tidak terdaftar dalam mapping privat');
 const profile=catalog.find(p=>p.id===source.professionId);if(!profile)throw Error('Profesi tidak valid');
 const staff={id:source.id,name:source.name,employeeId:source.employeeId||'',professionId:source.professionId,job:source.job||'',unit:source.unit||'',group:'approved',isHead:!!source.isHead,directSection:!!source.directSection,needsReview:false};
 const state=fresh(),assignments={};if(!Array.isArray(request.assessments)||request.assessments.length!==12||new Set(request.assessments.map(a=>a.period)).size!==12)throw Error('Paket wajib berisi 12 periode unik');
 const person=id=>{const a=config.accounts.find(a=>a.id===id);return {name:a.name,nip:a.nip,role:a.role}};
 for(const q of PERIODS){
  if(!ended(q,now))throw Error(q.label+': periode belum berakhir');
  const a=request.assessments.find(v=>v.period===q.id);if(!a||a.provisional||!requireText(a.evidence,2000)||!a.items||!Array.isArray(a.areas)||a.areas.some(v=>!AREAS.includes(v)))throw Error(q.label+': bukti, wilayah kerja atau status belum lengkap');
  const items={};for(const i of indicators(profile)){const v=a.items[i.id],r=resultFor(i,v?.value);if(!r)throw Error(q.label+': capaian tidak valid: '+i.name);const note=String(v.note??'');if(note.length>2000||String(v.value).length>80)throw Error('Input terlalu panjang');items[i.id]={value:String(v.value),result:r,note}}
  const k=key(staff,q),x=assignment(source,q);assignments[q.id]={reviewer:x.reviewer,committee:x.committee};
  state.assessments[k]={items,areas:[...new Set(a.areas)],evidence:a.evidence.trim(),provisional:false};state.overrides[k]={reviewer:person(x.reviewer),supervisor:person(x.reviewer),committee:person(x.committee)};
 }
 const issues=finalReadiness(state,staff,profile,now);if(issues.length)throw Error(issues[0].period+': '+issues[0].message);
 return {staff,profile,state,assignments};
}
export function duties(doc,accountId){const roles=[];for(const q of PERIODS){const a=doc.assignments[q.id];for(const r of roleSet)if(a[r]===accountId)roles.push({period:q.id,role:r})}return roles}
export function mayRead(doc,user){return user.permissions.includes('admin')||duties(doc,user.id).length>0}
export function allApproved(doc){return PERIODS.every(q=>[...roleSet].every(r=>doc.approvals[doc.assignments[q.id][r]]?.reviewHash===doc.reviewHash))}
export function acceptApproval(doc,user,reviewHash,image,now=new Date()){
 if(doc.finalHash)throw Error('Dokumen sudah final');
 if(reviewHash!==doc.reviewHash)throw Error('Versi PDF tidak cocok');
 if(!duties(doc,user.id).length)throw Error('Akun tidak berwenang atas dokumen ini');
 if(doc.approvals[user.id])throw Error('Dokumen telah disetujui oleh akun ini');
 if(typeof image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>800000)throw Error('Gambar PNG tidak valid atau terlalu besar');
 doc.approvals[user.id]={reviewHash,approvedAt:now.toISOString(),image,accountId:user.id};
 return doc;
}
