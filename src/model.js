export const PERIODS=Array.from({length:12},(_,i)=>({year:2024+Math.floor(i/4),quarter:i%4+1,id:(2024+Math.floor(i/4))+'-'+(i%4+1),label:'Triwulan '+['I','II','III','IV'][i%4]+' '+(2024+Math.floor(i/4))}));
export const GROUPS=['Perilaku','Pengembangan Profesionalisme','Kinerja Klinis/Profesional Primer'];
export const ROLES={committee:'Ketua Komite Tenaga Kesehatan Lainnya',reviewer:'Kepala ruang/unit',supervisor:'Kepala seksi / atasan penilai'};
export const AREAS=['Pelayanan Bedah Sentral','Pelayanan Rawat Jalan','Pelayanan Intensive Care','Pelayanan Gawat Darurat','Pelayanan Rawat Inap','Pelayanan Penunjang'];
export function indicators(p){const seen={};return (p?.indicators||[]).map(i=>{const k=i.category+'-'+i.number;seen[k]=(seen[k]||0)+1;return {...i,id:k+(seen[k]>1?'#'+seen[k]:'')}})}
export function key(staff,period){return staff.id+'::'+period.year+'::'+period.quarter}
export function score(p,a){const rows=indicators(p);const r=rows.map(i=>resolvedItem(i,a?.items?.[i.id])).filter(x=>['Baik','Kurang'].includes(x?.result));const good=r.filter(x=>x.result==='Baik').length;const pct=r.length?good/r.length*100:null;return {good,n:r.length,total:rows.length,pct,category:pct===null?'Belum dinilai':pct>=90?'Sangat Baik':pct>=70?'Baik':pct>=60?'Cukup':'Kurang',missing:rows.length-r.length}}
export function ended(period,now=new Date()){return now>=new Date(period.year,period.quarter*3,1)}
// Row references are the structural mapping in the uploaded workbook, never personal data.
const HEAD_ROWS=new Set([4,11,18,29,30,31,32,68,74,80,89,113,130,151,154,162,168]);
export function isHead(staff,raw={}){return typeof staff.isHead==='boolean'?staff.isHead:HEAD_ROWS.has(Number(staff.sourceRow))||isSelf(raw.reviewer,staff)||/\b(?:kepala\s+(?:ruang|unit|instalasi)|ka\s*\.\s*(?:ru|ins|instalasi|ruangan)|koordinator)\b/i.test(staff.unit||'')}
export function normalizeMapping(pack){const groups=pack.signers||{};for(const g of ['excel-34','excel-53','excel-55'])if(groups[g]&&!groups[g].supervisor?.name&&groups['excel-29']?.supervisor?.name)groups[g].supervisor={...groups['excel-29'].supervisor};if(groups['excel-166']&&groups['excel-162']){if(!groups['excel-166'].reviewer?.name)groups['excel-166'].reviewer={...groups['excel-162'].reviewer,proposed:true};if(!groups['excel-166'].supervisor?.name)groups['excel-166'].supervisor={...groups['excel-162'].supervisor,proposed:true}}for(const g of ['excel-145','excel-148'])if(groups[g]&&!groups[g].supervisor?.name&&groups['excel-130']?.supervisor?.name)groups[g].supervisor={...groups['excel-130'].supervisor,proposed:true};for(const s of pack.staff||[]){if(!Number.isInteger(Number(s.sourceRow))||!s.sourceRow)continue;if(typeof s.isHead!=='boolean')s.isHead=HEAD_ROWS.has(Number(s.sourceRow));if(!s.isHead&&Number(s.sourceRow)===78)s.directSection=true}return pack}
export function rawSignerSet(state,staff,period){return {...(state.signers[staff.group]||{}),...(state.overrides[key(staff,period)]||{})}}
export function signerSet(state,staff,period){const raw=rawSignerSet(state,staff,period),head=isHead(staff,raw),direct=staff.directSection===true;let reviewer=(head||direct)?raw.supervisor:raw.reviewer;let committee=raw.committee;const warnings=[];if(!reviewer?.name)warnings.push(head||direct?'Kepala seksi/atasan belum ditetapkan':'Kepala ruangan belum ditetapkan');if(reviewer?.proposed){warnings.push('Penilai usulan belum dikonfirmasi');reviewer={}}if(head&&reviewer?.name&&!/\b(?:kepala\s+seksi|kasi)\b/i.test(reviewer.role||'')){warnings.push('Atasan di Excel bukan Kepala Seksi; konfirmasi kewenangan');reviewer={}}if(isSelf(reviewer,staff)){warnings.push('Penilai tidak boleh menilai diri sendiri');reviewer={}}if(!committee?.name)warnings.push('Ketua komite/pengganti belum ditetapkan');if(isSelf(committee,staff)){warnings.push('Ketua komite yang dinilai memerlukan pengganti berwenang');committee={}}if(committee?.name&&reviewer?.name&&isSelf(committee,{name:reviewer.name,employeeId:reviewer.nip||''})){warnings.push('Kedua penandatangan harus berbeda');committee={}}return {reviewer:reviewer||{},committee:committee||{},head,direct,warnings}}

export function isSelf(s,staff){return !!s?.name&&(s.name.trim().toLowerCase()===staff.name.trim().toLowerCase()||!!(s.nip&&staff.employeeId&&s.nip.replace(/\s/g,'')===staff.employeeId.replace(/\s/g,'')&&s.nip.replace(/\s/g,'').length>=10))}
export function status(p,a,period,staff,signers){if(!ended(period))return 'PERIODE BELUM SELESAI';if(a?.provisional)return 'CAPAIAN SEMENTARA - PERLU VALIDASI ULANG';if(!a||score(p,a).missing)return 'BELUM LENGKAP';if(staff.needsReview||signers.warnings?.length||!signers.reviewer?.name||!signers.committee?.name)return 'MAPPING PERLU VERIFIKASI';if(!a.evidence?.trim())return 'BUKTI BELUM DICATAT';return 'MENUNGGU PENGESAHAN'}
export const fresh=()=>({version:2,staff:[],assessments:{},signers:{},overrides:{},assets:{},signatures:{}});
export function validatePack(x,professions){if(!x||!['oppe-local-pack-v2','oppe-backup-v2'].includes(x.schema)||!Array.isArray(x.staff))throw Error('Format paket tidak sesuai.');const ids=new Set(),pids=new Set(professions.map(p=>p.id));for(const s of x.staff){if(!s.id||!s.name||!pids.has(s.professionId)||ids.has(s.id))throw Error('Identitas/profesi tidak valid atau ID ganda: '+String(s.name||''));ids.add(s.id)}return x}

// OPPE working interpretation: distinguish adverse triggers from direct performance targets.
export function ruleFor(i){
 const raw=String(i?.trigger||'').trim().replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/\s+/g,'');
 const m=/^(>=|<=|>|<|=)?(\d+(?:[.,]\d+)?)(%|kali(?:\/(?:tahun|periode|bulan))?|kejadian|menit|jam)$/.exec(raw);
 if(!m)return null;
 const [,op='',num,unit]=m,n=Number(num.replace(',','.')),name=String(i.name||'').toLowerCase();
 const adverse=/keluhan|pengulangan pemeriksaan|waktu tunggu|response time/.test(name);
 const reject=/penolakan spesimen/.test(name);
 let pass;
 if(reject&&op==='<')pass='<'; // direct maximum rejection rate
 else if(adverse&&op==='>')pass='<=';
 else if(adverse&&op==='>=')pass='<';
 else if(!adverse&&op==='<')pass='>=';
 else if(!adverse&&op==='<=')pass='>';
 else if(!adverse&&(op==='>'||op==='>='))pass=op;
 else if(!op||op==='=')pass=n===0?'=':'>=';
 else return null;
 return {pass,n,unit,window:unit.endsWith('/tahun')?'tahun':unit.endsWith('/bulan')?'bulan':'periode',interpretation:reject||(!adverse&&op.startsWith('>'))?'Target langsung':op?'Batas trigger':'Target langsung'};
}
export function parseActual(value,rule){
 if(!rule||value===null||value===undefined||String(value).trim()==='')return null;
 const raw=String(value).trim().toLowerCase().replace(/\s+/g,'');
 const m=/^(\d+(?:[.,]\d+)?)(%|kali(?:\/(?:tahun|periode|bulan))?|kejadian|menit|jam)?$/.exec(raw);
 if(!m)return null;
 const v=Number(m[1].replace(',','.')),u=m[2];
 if(!Number.isFinite(v)||v<0||(u&&u!==rule.unit&&!(u==='kali'&&rule.unit.startsWith('kali/'))))return null;
 if(rule.unit==='%'&&v>100)return null;
 if((rule.unit.startsWith('kali')||rule.unit==='kejadian')&&!Number.isInteger(v))return null;
 return v;
}
export function resultFor(i,value){
 const rule=ruleFor(i),v=parseActual(value,rule);
 if(v===null)return '';
 const {pass,n}=rule,ok=pass==='>='?v>=n:pass==='>'?v>n:pass==='<='?v<=n:pass==='<'?v<n:v===n;
 return ok?'Baik':'Kurang';
}
export function demoValue(i){const r=ruleFor(i);if(!r)return '';const step=r.unit.startsWith('kali')||r.unit==='kejadian'?1:.1;return String(r.pass==='>'?r.n+step:r.pass==='<'?Math.max(0,r.n-step):r.n);}
export function resolvedItem(i,v){return {...v,result:resultFor(i,v?.value)}}

// Chair identity is resolved only from the user's locally imported source row, not public names/NIP.
export function migrateChair(pack){
 const chair=(pack.staff||[]).find(s=>Number(s.sourceRow)===89);
 if(!chair||!chair.name)return false;
 const person={name:chair.name,nip:chair.employeeId||'',role:'Ketua Komite Tenaga Kesehatan Lainnya'};
 const former=(pack.staff||[]).filter(s=>[11,94].includes(Number(s.sourceRow)));
 const groups=pack.signers||{};
 for(const [g,data] of Object.entries(groups))if(g.startsWith('excel-'))data.committee={...person};
 // Preserve explicitly configured replacements for periods, except the prior source-row-94 assignment.
 for(const [k,o] of Object.entries(pack.overrides||{}))if(o?.committee&&former.some(old=>isSelf(o.committee,old))&&!k.startsWith(chair.id+'::'))delete o.committee;
 return true;
}
export function applyBatch(state,staff,prof,edit){
 const rows=indicators(prof),changed=edit.items||{};
 for(const period of PERIODS){
  const k=key(staff,period),a=state.assessments[k]||{staffId:staff.id,professionId:staff.professionId,year:period.year,quarter:period.quarter,items:{},areas:[]};
  for(const i of rows){const patch=changed[i.id];if(!patch)continue;const prev=a.items[i.id]||{};const next={...prev,...patch};next.result=resultFor(i,next.value);a.items[i.id]=next;}
  if(edit.areas!==undefined)a.areas=[...edit.areas];
  if(edit.evidence!==undefined)a.evidence=edit.evidence;
  a.updatedAt=new Date().toISOString();if(!ended(period))a.provisional=true;
  else if(a.provisional&&rows.every(i=>Object.hasOwn(changed[i.id]||{},'value')&&resultFor(i,changed[i.id].value))&&edit.evidence?.trim())a.provisional=false;
  state.assessments[k]=a;
 }
}

// Tanda tangan otomatis: gambar TTD milik penanda tangan (bukan dari Excel), disimpan lokal
// bersama catatan izin pemiliknya. Dikunci pada identitas orang (NIP, atau nama bila NIP kosong).
export function signerKey(s){const nip=String(s?.nip||'').replace(/\D/g,'');if(nip.length>=10)return 'nip:'+nip;const name=String(s?.name||'').trim().toLowerCase().replace(/\s+/g,' ');return name?'name:'+name:''}
export function signatureFor(state,signer){const k=signerKey(signer),sig=k&&state?.signatures?.[k];return sig&&sig.image&&sig.consentAt?sig:null}
// TTD hanya dibubuhkan pada halaman yang penilaiannya lengkap dan mapping-nya sudah terverifikasi.
export function signablePeriod(p,a,period,staff,signers){return status(p,a,period,staff,signers)==='MENUNGGU PENGESAHAN'}
export function signedCount(state,staff,p,periods=PERIODS){let n=0;for(const q of periods){const a=state.assessments[key(staff,q)],sg=signerSet(state,staff,q);if(signablePeriod(p,a,q,staff,sg)&&signatureFor(state,sg.reviewer)&&signatureFor(state,sg.committee))n++}return n}
