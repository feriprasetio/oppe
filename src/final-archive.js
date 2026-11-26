import {PERIODS,indicators,key,score,ended,signerSet,resolvedItem} from './model.js';
const DB='oppe-private-final-v1',STORE='signed';
export function finalReadiness(state,staff,profession,now=new Date()){
 if(!staff||!profession)return [{period:'-',message:'Pilih staf dan profesi'}];
 const problems=[],pending=state.batchEdits?.[staff.id];
 if(pending&&(Object.keys(pending.items||{}).length||Object.hasOwn(pending,'areas')||Object.hasOwn(pending,'evidence')))problems.push({period:'Semua',message:'Perubahan bersama belum disimpan'});
 for(const p of PERIODS){
  const a=state.assessments[key(staff,p)],s=signerSet(state,staff,p);
  const m=[];
  if(!ended(p,now))m.push('periode belum berakhir');
  if(a?.provisional)m.push('hasil sementara belum divalidasi ulang');
  if(!a||score(profession,a).missing)m.push('capaian belum lengkap / tidak valid');
  if(!a?.evidence?.trim())m.push('referensi bukti belum dicatat');
  if(staff.needsReview||s.warnings?.length||!s.reviewer?.name||!s.committee?.name)m.push('mapping penilai belum sahih');
  if(m.length)problems.push({period:p.label,message:m.join('; ')});
 }
 return problems;
}
export function snapshot(state,staff,profession){
 return JSON.stringify({schema:1,staff:{id:staff.id,name:staff.name,employeeId:staff.employeeId,professionId:staff.professionId,unit:staff.unit,job:staff.job},profession:profession.name,indicators:indicators(profession).map(i=>({id:i.id,name:i.name,trigger:i.trigger})),periods:PERIODS.map(p=>{const a=state.assessments[key(staff,p)]||{},s=signerSet(state,staff,p);return {id:p.id,areas:a.areas||[],evidence:a.evidence||'',provisional:!!a.provisional,items:indicators(profession).map(i=>{const v=resolvedItem(i,a.items?.[i.id]);return {id:i.id,value:v.value??'',result:v.result,note:v.note??''}}),reviewer:s.reviewer,committee:s.committee};})});
}
export async function digest(bytes){const b=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}
function openDB(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'staffId'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
async function transaction(mode,fn){const db=await openDB();try{return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode);let result;const q=fn(t.objectStore(STORE));q.onsuccess=()=>{result=q.result};q.onerror=()=>reject(q.error);t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('Transaksi arsip dibatalkan'))})}finally{db.close()}}
export const getSigned=id=>transaction('readonly',s=>s.get(id));
export const deleteSigned=id=>transaction('readwrite',s=>s.delete(id));
export const clearSigned=()=>transaction('readwrite',s=>s.clear());
export async function archiveSigned({state,staff,profession,file,reference,operator,confirmed}){
 if(!confirmed||!reference.trim()||!operator.trim())throw Error('Catat referensi persetujuan, petugas, dan konfirmasi pemeriksaan dokumen.');
 const blockers=finalReadiness(state,staff,profession);if(blockers.length)throw Error(blockers[0].period+': '+blockers[0].message);
 if(file.size>40*1024*1024)throw Error('PDF maksimal 40 MB.');
 const bytes=await file.arrayBuffer();
 const doc=await window.PDFLib.PDFDocument.load(bytes);
 if(doc.getPageCount()!==12)throw Error('Dokumen bertanda tangan harus berisi tepat 12 halaman.');
 const record={staffId:staff.id,bytes,sourceName:file.name,reference:reference.trim(),operator:operator.trim(),recordedAt:new Date().toISOString(),snapshotHash:await digest(snapshot(state,staff,profession)),pdfHash:await digest(bytes),pageCount:12,reviewType:'manual_operator_attestation'};
 await transaction('readwrite',s=>s.put(record));return record;
}
export async function checkedSigned(state,staff,profession){
 if(!staff||!profession)return null;
 const record=await getSigned(staff.id);if(!record)return null;
 const same=record.snapshotHash===await digest(snapshot(state,staff,profession));
 const intact=record.pdfHash===await digest(record.bytes);
 return {...record,current:same&&intact&&!finalReadiness(state,staff,profession).length};
}
