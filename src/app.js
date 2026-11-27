import {PERIODS,GROUPS,ROLES,AREAS,indicators,key,score,ended,signerSet,rawSignerSet,isHead,normalizeMapping,isSelf,status,fresh,validatePack,ruleFor,resultFor,parseActual,demoValue,migrateChair,applyBatch,resolvedItem,signerKey,signatureFor,signedCount,signReport,fillEvidence} from './model.js';
import {createStaffPdf} from './pdf-renderer.js';
import {importWorkbook} from './xlsx-import.js';
import {checkedSigned,clearSigned} from './final-archive.js';
const $=id=>document.getElementById(id),KEY='oppe-digital-v2',OLD='oppe-digital-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=fresh(),professions=[],editing=null,busy=false,toastTimer;
try{const raw=localStorage.getItem(KEY);if(raw){state={...fresh(),...JSON.parse(raw)}}else{const old=JSON.parse(localStorage.getItem(OLD)||'null');if(old){state.staff=(old.staff||[]).map(s=>({...s,group:s.professionId,needsReview:true}));state.assessments=old.assessments||{}}}}catch(e){console.error(e)}
normalizeMapping(state);if(state.chairRevision!==41&&migrateChair(state)){state.chairRevision=41;}state.batchEdits=state.batchEdits||{};
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500)}
function store(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch(e){toast('Penyimpanan gagal. Unduh backup sebelum menutup halaman.');return false}}
const prof=id=>professions.find(p=>p.id===id),staff=()=>state.staff.find(s=>s.id===$('staffSelect').value),period=()=>PERIODS[0];
const current=()=>staff()?state.assessments[key(staff(),period())]:null;
const pending=s=>((state.batchEdits??={})[s.id]??={items:{}});
const records=s=>PERIODS.map(p=>state.assessments[key(s,p)]||{items:{},areas:[]});
const uniform=xs=>xs.every(x=>JSON.stringify(x)===JSON.stringify(xs[0]));
function options(rows,placeholder='Pilih…'){return '<option value="">'+esc(placeholder)+'</option>'+rows.map(([v,n])=>'<option value="'+esc(v)+'">'+esc(n)+'</option>').join('')}
function selectOptions(id,rows,placeholder){const old=$(id).value;$(id).innerHTML=options(rows,placeholder);if(rows.some(r=>r[0]===old))$(id).value=old}
function renderStats(){const n=state.staff.length,complete=state.staff.reduce((sum,s)=>sum+PERIODS.filter(p=>{const a=state.assessments[key(s,p)];return !!a&&score(prof(s.professionId),a).missing===0}).length,0);$('stats').innerHTML=[['Tenaga kesehatan',n],['Profesi aktif',new Set(state.staff.map(s=>s.professionId)).size],['Target halaman',n*12],['Periode terisi lengkap',complete]].map(([n,v])=>'<div class="stat"><span>'+n+'</span><b>'+v.toLocaleString('id-ID')+'</b></div>').join('');const groups={};for(const s of state.staff)groups[s.professionId]=(groups[s.professionId]||0)+1;$('distribution').innerHTML='<div class="distribution">'+Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([id,n])=>'<span class="chip">'+esc(prof(id)?.name||id)+' · '+n+'</span>').join('')+'</div>'}
function renderStaff(){const q=$('search').value.toLowerCase(),f=$('filter').value;const list=state.staff.filter(s=>(!f||s.professionId===f)&&[s.name,s.employeeId,s.unit,s.job].join(' ').toLowerCase().includes(q));$('staffTable').innerHTML='<table><thead><tr><th>Nama / NIP</th><th>Profesi</th><th>Unit kerja</th><th>Periode</th><th></th></tr></thead><tbody>'+list.map(s=>'<tr><td><strong>'+esc(s.name)+'</strong><br><small>'+esc(s.employeeId||'NIP kosong')+'</small>'+(s.needsReview?'<br><small class="warn">Perlu validasi</small>':'')+'</td><td>'+esc(prof(s.professionId)?.name||'Belum terpetakan')+'</td><td>'+esc(s.unit)+'</td><td>'+PERIODS.filter(p=>state.assessments[key(s,p)]).length+'/12</td><td><button data-open="'+esc(s.id)+'">Nilai</button> <button class="secondary" data-edit="'+esc(s.id)+'">Edit</button></td></tr>').join('')+'</tbody></table>'+(list.length?'':'<p>Belum ada staf yang cocok. Impor paket mapping lokal.</p>')}
function refresh(){selectOptions('staffSelect',state.staff.map(s=>[s.id,s.name+' · '+(prof(s.professionId)?.name||'')]),'Pilih staf');renderStats();renderStaff();renderAssessment();renderSigners();renderPeriods()}
function resultBadge(i,value){const r=resultFor(i,value);return r||(!String(value??'').trim()?'Belum dinilai':ruleFor(i)?'Capaian tidak valid':'Aturan perlu verifikasi')}
function batchValue(s,i,field){const e=pending(s).items[i.id];if(e&&Object.hasOwn(e,field))return {value:e[field],mixed:false,pending:true};const values=records(s).map(a=>String(a.items?.[i.id]?.[field]??''));return uniform(values)?{value:values[0],mixed:false}:{value:'',mixed:true}}
function sharedValue(s,field,fallback){const e=pending(s);if(Object.hasOwn(e,field))return {value:e[field],mixed:false};const xs=records(s).map(a=>a[field]??fallback);return uniform(xs)?{value:xs[0],mixed:false}:{value:fallback,mixed:true}}
function renderAssessment(){
 const s=staff(),p=prof(s?.professionId);
 if(!s||!p){$('assessmentMeta').textContent='Pilih staf untuk membuka formulir.';$('assessmentForm').innerHTML='';return}
 const areas=sharedValue(s,'areas',[]),evidence=sharedValue(s,'evidence','');
 $('assessmentMeta').innerHTML='<p><strong>'+esc(p.name)+'</strong> · '+esc(s.unit||'Unit belum diisi')+'</p><div class="batch-note"><strong>Pengisian bersama 12 periode</strong><p>Isi capaian yang benar-benar sama di seluruh periode. Untuk angka yang berbeda, buka rincian triwulan pada indikator. Perubahan bersama disimpan di browser sebagai isian sementara sampai dikonfirmasi.</p></div>';
 let str='<h3>Wilayah kerja</h3>'+(areas.mixed?'<p class="warn">Wilayah kerja sebelumnya berbeda antarperiode. Ubah hanya jika sama.</p>':'')+'<div class="distribution">'+AREAS.map(v=>'<label class="chip"><input type="checkbox" data-area="'+esc(v)+'" '+(areas.value.includes(v)?'checked':'')+'>'+esc(v)+'</label>').join('')+'</div>';
 for(const g of GROUPS){const rows=indicators(p).filter(i=>i.category===g);if(!rows.length)continue;
 str+='<h3>Indikator '+esc(g)+'</h3><div class="scroll assessment-scroll"><table><thead><tr><th>No</th><th>Indikator</th><th>Trigger / standar</th><th>Capaian aktual bersama</th><th>Hasil otomatis</th><th>Catatan (lokal)</th></tr></thead><tbody>'+rows.map(i=>{
 const v=batchValue(s,i,'value'),note=batchValue(s,i,'note'),r=ruleFor(i),result=v.mixed?'Bervariasi':resultBadge(i,v.value);
 const rule=r?'Baik jika '+r.pass+' '+r.n+' '+r.unit:'Aturan belum didukung';
 const detail=PERIODS.map(q=>{const x=state.assessments[key(s,q)]?.items?.[i.id]||{};return '<label class="quarter-input"><span>'+esc(q.label)+(ended(q)?'':' · berjalan')+'</span><input data-detail="'+esc(i.id)+'" data-quarter="'+q.id+'" value="'+esc(x.value??'')+'" inputmode="decimal" placeholder="'+esc(r?.unit||'Capaian')+'"><small data-detail-result="'+esc(q.id)+'">'+esc(resultBadge(i,x.value))+'</small></label>'}).join('');
 return '<tr data-row="'+esc(i.id)+'"><td>'+i.number+'</td><td>'+esc(i.name)+'<details class="quarter-details"><summary>Rincian 12 triwulan</summary><div class="quarter-grid">'+detail+'</div></details></td><td>'+esc(i.trigger)+'<br><small>'+esc(rule)+'</small></td><td><input data-item="'+esc(i.id)+'" data-field="value" value="'+esc(v.value)+'" inputmode="decimal" placeholder="'+esc(v.mixed?'Bervariasi — lihat rincian':r?.unit||'Isi capaian')+'" aria-label="Capaian"><small>'+(r?.window==='tahun'?'Jumlah aktual dalam tahun terkait':r?.window==='bulan'?'Capaian aktual per bulan':'Capaian periode terkait')+'</small></td><td><span class="auto-result" data-result="'+esc(i.id)+'">'+esc(result)+'</span></td><td><textarea data-item="'+esc(i.id)+'" data-field="note" placeholder="'+(note.mixed?'Catatan berbeda antarperiode':'Catatan')+'" aria-label="Catatan">'+esc(note.value)+'</textarea></td></tr>'
 }).join('')+'</tbody></table></div>'}
 str+='<label>Referensi bukti / sumber pengukuran<textarea id="evidence" placeholder="'+(evidence.mixed?'Bukti berbeda antarperiode — isi hanya bila sumber sama':'Sumber data untuk 12 periode')+'">'+esc(evidence.value)+'</textarea></label><div id="scoreBox"></div><p class="muted" id="pendingNote"></p>';
 $('assessmentForm').innerHTML=str;renderScore();
}
function renderScore(){
 const s=staff(),el=$('scoreBox');if(!s||!el)return;const p=prof(s.professionId),rs=records(s).map(a=>score(p,a));const n=rs.filter(r=>!r.missing).length;const pendingFields=pending(s),items=Object.keys(pendingFields.items||{}).length;
 el.innerHTML='<div class="score"><span>Periode lengkap: <b>'+n+'/12</b></span><span>Indikator terisi: <b>'+rs.reduce((n,r)=>n+r.n,0)+'/'+rs.reduce((n,r)=>n+r.total,0)+'</b></span><span>Skor per periode tersedia pada ringkasan ekspor</span></div>';
 $('pendingNote').textContent=items||Object.hasOwn(pendingFields,'areas')||Object.hasOwn(pendingFields,'evidence')?'Ada perubahan bersama yang belum diterapkan ke 12 periode. Tekan Simpan penilaian 12 periode.':'Tidak ada perubahan bersama yang belum diterapkan.';
}
function editAssessment(el){
 const s=staff();if(!s)return;const p=prof(s.professionId),e=pending(s);
 if(el.dataset.detail){const i=indicators(p).find(x=>x.id===el.dataset.detail);if(i)el.parentElement.querySelector('[data-detail-result]').textContent=resultBadge(i,el.value);return}
 if(el.dataset.item){const i=indicators(p).find(x=>x.id===el.dataset.item);if(!i)return;(e.items[i.id]??={})[el.dataset.field]=el.value;if(el.dataset.field==='value'){const out=el.closest('tr').querySelector('[data-result]');out.textContent=resultBadge(i,el.value);out.dataset.grade=resultFor(i,el.value)}}
 else if(el.dataset.area)e.areas=AREAS.filter(v=>[...$('assessmentForm').querySelectorAll('[data-area]:checked')].some(x=>x.dataset.area===v));
 else if(el.id==='evidence')e.evidence=el.value;else return;
 store();renderScore();renderExport();
}
function saveDetail(el){
 if(!el.dataset.detail)return;const s=staff();if(!s)return;const p=prof(s.professionId),i=indicators(p).find(x=>x.id===el.dataset.detail),q=PERIODS.find(x=>x.id===el.dataset.quarter);if(!i||!q)return;
 if(el.value.trim()&&parseActual(el.value,ruleFor(i))===null){toast('Capaian tidak valid; periksa satuan dan angka.');return}
 const k=key(s,q),a=state.assessments[k]||{staffId:s.id,professionId:s.professionId,year:q.year,quarter:q.quarter,items:{},areas:[]};
 if(!ended(q))a.provisional=true;
 a.items[i.id]={...(a.items[i.id]||{}),value:el.value,result:resultFor(i,el.value)};a.updatedAt=new Date().toISOString();state.assessments[k]=a;store();
 el.parentElement.querySelector('[data-detail-result]').textContent=resultBadge(i,el.value);const shared=batchValue(s,i,'value'),row=el.closest('tr'),input=row.querySelector('[data-item][data-field="value"]');
 input.value=shared.value;input.placeholder=shared.mixed?'Bervariasi — lihat rincian':ruleFor(i)?.unit||'Capaian';row.querySelector('[data-result]').textContent=shared.mixed?'Bervariasi':resultBadge(i,shared.value);renderScore();renderPeriods();renderStats();renderStaff();
}
function saveBatch(){
 const s=staff();if(!s)return toast('Pilih staf dahulu.');const p=prof(s.professionId),e=pending(s);
 if(!Object.keys(e.items||{}).length&&!Object.hasOwn(e,'areas')&&!Object.hasOwn(e,'evidence'))return toast('Tidak ada perubahan bersama untuk diterapkan.');
 for(const i of indicators(p)){const v=e.items[i.id]?.value;if(v!==undefined&&String(v).trim()&&parseActual(v,ruleFor(i))===null)return toast('Capaian tidak valid: '+i.name);}
 if(!confirm('Terapkan perubahan bersama ke semua 12 triwulan? Pastikan nilai dan bukti yang dimasukkan benar-benar berlaku pada tiap periode. Perubahan akan mengganti kolom terkait yang sudah tersimpan. Triwulan yang masih berjalan tetap sementara.'))return;
 applyBatch(state,s,p,e);delete state.batchEdits[s.id];if(store())toast('Perubahan diterapkan ke 12 periode.');refresh();
}
function renderSigners(){const s=staff();if(!s){$('signerForm').innerHTML='<p>Pilih staf dahulu.</p>';$('signerWarning').textContent='';return}const data=$('scope').value==='person'?rawSignerSet(state,s,period()):(state.signers[s.group]||{});$('signerForm').innerHTML=Object.entries(ROLES).map(([k,r])=>'<div class="signcard"><h3>'+r+'</h3>'+['name','role','nip'].map((f,i)=>'<label>'+['Nama','Jabatan','NIP'][i]+'<input data-role="'+k+'" data-field="'+f+'" value="'+esc(data[k]?.[f]||'')+'"></label>').join('')+(data[k]?.proposed?'<p class="warn">Usulan: konfirmasi pejabat sebelum menyimpan.</p>':'')+sigBox(k,data[k])+'</div>').join('');const resolved=signerSet(state,s,period());$('signerWarning').innerHTML='<h3>Susunan PDF: dua penandatangan</h3><p>'+esc(resolved.head?'Kepala ruang/unit → Kepala Seksi':resolved.direct?'Penilaian langsung oleh Kepala Seksi':'Staf → Kepala ruang/unit')+'</p><p><strong>Penilai:</strong> '+esc(resolved.reviewer.name||'Belum ditetapkan')+'<br><strong>Komite:</strong> '+esc(resolved.committee.name||'Belum ditetapkan')+'</p>'+(resolved.warnings.length?'<p class="warn">'+esc(resolved.warnings.join('; '))+'</p>':'')}
function sigBox(role,person){const sig=signatureFor(state,person||{}),k=signerKey(person||{});if(!k)return '<p class="muted">Isi nama/NIP lalu simpan mapping untuk mengunggah TTD.</p>';return '<div class="sigbox">'+(sig?'<img alt="TTD '+esc(person.name)+'" src="'+esc(sig.image)+'"><small>TTD tersimpan · izin '+esc(new Date(sig.consentAt).toLocaleDateString('id-ID'))+(sig.consentNote?' · '+esc(sig.consentNote):'')+'</small>':'<small>Belum ada TTD — PDF memakai garis kosong.</small>')+'<div class="actions"><label class="filebtn secondary">'+(sig?'Ganti TTD':'Unggah TTD')+'<input type="file" accept="image/png,image/jpeg" data-sigupload="'+role+'"></label>'+(sig?'<button type="button" class="danger" data-sigdel="'+role+'">Hapus TTD</button>':'')+'</div></div>'}
function cardPerson(role){const p={};for(const el of $('signerForm').querySelectorAll('[data-role="'+role+'"]'))p[el.dataset.field]=el.value.trim();return p}
// Gambar TTD: dikecilkan, latar (putih/abu/berwarna/foto) dibuat transparan, tepi kosong dipotong, disimpan PNG.
async function loadImage(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(Error('Gambar tidak dapat dibaca.'));i.src=src})}
async function prepSignature(file){if(!/^image\/(png|jpeg)$/.test(file.type))throw Error('Gunakan gambar PNG atau JPG.');if(file.size>5*1024*1024)throw Error('Gambar TTD maksimal 5 MB.');const url=URL.createObjectURL(file);try{return cleanSignature(await loadImage(url))}finally{URL.revokeObjectURL(url)}}
function cleanSignature(img){
 const sc=Math.min(1,700/img.naturalWidth,300/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);const d=g.getImageData(0,0,w,h),px=d.data;
 // Warna latar = median piksel tepi gambar; tinta = piksel yang jelas lebih gelap/berbeda dari latar.
 const edge=[];const take=(x,y)=>{const o=(y*w+x)*4;edge.push([px[o],px[o+1],px[o+2]])};for(let x=0;x<w;x+=2){take(x,0);take(x,h-1)}for(let y=0;y<h;y+=2){take(0,y);take(w-1,y)}
 const med=k=>{const v=edge.map(e=>e[k]).sort((a,b)=>a-b);return v[v.length>>1]||255},bg=[med(0),med(1),med(2)],lum=(r,gg,b)=>.299*r+.587*gg+.114*b,bgL=lum(...bg);
 const lo=Math.max(18,Math.min(45,bgL*.16)),hi=lo*2.6;let x0=w,y0=h,x1=-1,y1=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4,L=lum(px[o],px[o+1],px[o+2]),dist=Math.hypot(px[o]-bg[0],px[o+1]-bg[1],px[o+2]-bg[2]),dark=bgL-L,score=Math.max(dark,dist*.55);
  if(score<lo||dark<lo*.6){px[o+3]=0;continue}px[o+3]=score>=hi?255:Math.round(255*(score-lo)/(hi-lo));
  if(px[o+3]>40){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(x1<0||(x1-x0)<8||(y1-y0)<4)throw Error('Coretan TTD tidak terdeteksi pada gambar.');
 g.putImageData(d,0,0);const out=document.createElement('canvas'),m=4;out.width=x1-x0+1+m*2;out.height=y1-y0+1+m*2;out.getContext('2d').drawImage(c,x0,y0,x1-x0+1,y1-y0+1,m,m,x1-x0+1,y1-y0+1);return out.toDataURL('image/png')}
async function importExcelSignatures(list){if(!list?.length)return '';const names=[...new Set(list.map(x=>x.name))];
 if(!confirm('Ditemukan '+list.length+' gambar TTD di Excel ('+names.length+' orang: '+names.slice(0,6).join(', ')+(names.length>6?', …':'')+').\nPasang sebagai TTD otomatis? Pemilik TTD sudah memberi izin.'))return '';
 state.signatures??={};let ok=0,fail=[];const at=new Date().toISOString();
 for(const x of list){const k=signerKey(x);if(!k)continue;try{state.signatures[k]={image:cleanSignature(await loadImage(x.image)),name:x.name,nip:x.nip||'',role:x.role||'',consentAt:at,consentNote:'Diimpor dari Excel mapping'};ok++}catch{fail.push(x.name)}}
 return ' · '+ok+' TTD dari Excel terpasang'+(fail.length?' ('+fail.length+' gagal dibersihkan: '+fail.join(', ')+')':'')}
async function uploadSignature(input){const role=input.dataset.sigupload,file=input.files[0];input.value='';if(!file)return;const person=cardPerson(role),k=signerKey(person);if(!k)return toast('Isi nama atau NIP penanda tangan dahulu.');
 if(!confirm('Konfirmasi: '+person.name+(person.nip?' (NIP '+person.nip+')':'')+' sudah memberi izin TTD-nya dipasang otomatis pada PDF OPPE yang penilaiannya lengkap?'))return;
 try{const image=await prepSignature(file);state.signatures??={};state.signatures[k]={image,name:person.name,nip:person.nip||'',role:person.role||'',consentAt:new Date().toISOString(),consentNote:'Izin pemilik TTD dikonfirmasi admin'};if(store())toast('TTD '+person.name+' tersimpan.');renderSigners();renderExport()}catch(e){toast(e.message)}}
function deleteSignature(role){const person=cardPerson(role),k=signerKey(person);if(!k||!state.signatures?.[k])return;if(!confirm('Hapus TTD '+person.name+'? PDF berikutnya kembali memakai garis kosong.'))return;delete state.signatures[k];store();renderSigners();renderExport();toast('TTD dihapus.')}
function renderPeriods(){
 const s=staff();$('periodGrid').innerHTML=PERIODS.map(p=>{const a=s&&state.assessments[key(s,p)],r=s&&score(prof(s.professionId),a);return '<div class="period"><strong>'+p.label+'</strong>'+(!ended(p)?'Berjalan · ':'')+(r?.n?r.n+'/'+r.total+' · '+r.pct.toFixed(1)+'%':'Belum dinilai')+'</div>'}).join('');renderExport();
}
function hasPending(s){const e=state.batchEdits?.[s.id];return !!(e&&(Object.keys(e.items||{}).length||Object.hasOwn(e,'areas')||Object.hasOwn(e,'evidence')))}
function renderExport(){
 if(busy)return;
 const all=$('exportScope').value==='all',s=staff(),n=all?state.staff.length:s?1:0;
 $('exportPdf').disabled=!n;$('exportPdf').textContent=all?'Ekspor PDF (ZIP)':'Ekspor PDF';
 const inline=$('inlineExportState');inline.dataset.state='neutral';
 inline.textContent=n?(all?n+' staf · '+(n*12)+' halaman dalam ZIP.':'1 PDF · 12 halaman · Triwulan I 2024 – Triwulan IV 2026.')+' '+exportSignNote(all,s):'Pilih staf untuk ekspor PDF.';
}
function exportSignNote(all,s){if(all)return 'TTD dipasang otomatis pada triwulan yang lengkap bila TTD kedua penanda tangan sudah diunggah.';const p=prof(s.professionId);if(!p)return '';const r=signReport(state,s,p),why=Object.entries(r.reasons).filter(([k])=>k!=='PERIODE BELUM SELESAI').map(([k,n])=>n+' triwulan '+k.toLowerCase()).join(', ');return (r.signed?r.signed+' dari 12 triwulan bertanda tangan otomatis.':'Belum ada triwulan yang bertanda tangan.')+(why?' Belum TTD: '+why+'.':'')+(r.missingSig.length?' TTD belum diunggah: '+r.missingSig.join(', ')+'.':'')}
function download(bytes,name,type){const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
const filename=s=>'OPPE_'+s.name.replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_|_$/g,'')+'_'+s.id.slice(-12)+'_2024-2026.pdf';
async function documentBytes(s,p,workspace){
 if(!p)throw Error('Profesi belum terpetakan.');
 // Preserve already archived signed bytes when they match the active assessment.
 // A failed archive lookup must not prevent ordinary PDF generation.
 let archived=null;try{archived=await checkedSigned(workspace,s,p)}catch{}
 if(archived?.current)return {bytes:archived.bytes,name:filename(s).replace('.pdf','_FINAL.pdf'),status:'ARSIP_BERTANDA_TANGAN'};
 return {bytes:await createStaffPdf(s,p,workspace,PERIODS),name:filename(s),status:'BELUM_DISAHKAN'};
}
async function exportPdf(){
 if(busy)return;const all=$('exportScope').value==='all',list=all?[...state.staff]:staff()?[staff()]:[],inline=$('inlineExportState');
 if(!list.length)return toast('Pilih staf dahulu.');
 if(list.some(hasPending))return toast('Simpan penilaian 12 periode sebelum ekspor.');
 const workspace=structuredClone(state),selected=list.map(s=>workspace.staff.find(x=>x.id===s.id));
 busy=true;$('exportPdf').disabled=true;$('exportScope').disabled=true;$('progress').hidden=!all;$('progress').max=selected.length;$('progress').value=0;
 inline.textContent='Membuat dokumen...';inline.dataset.state='neutral';
 try{
  if(!all){const s=selected[0],d=await documentBytes(s,prof(s.professionId),workspace);download(d.bytes,d.name,'application/pdf');inline.textContent=d.status==='ARSIP_BERTANDA_TANGAN'?'PDF arsip bertanda tangan 12 halaman diunduh.':(n=>n?'PDF 12 halaman dibuat · '+n+' triwulan bertanda tangan otomatis.':'PDF 12 halaman dibuat. Tanda tangan belum dibubuhkan.')(signedCount(workspace,s,prof(s.professionId)));inline.dataset.state='ready';return}
  if(!window.JSZip)throw Error('Mesin ZIP tidak tersedia.');
  const zip=new window.JSZip(),report=[];let n=0;
  for(const s of selected){const p=prof(s.professionId);try{const d=await documentBytes(s,p,workspace);zip.file(p.name.replace(/[^\p{L}\p{N}]+/gu,'_')+'/'+d.name,d.bytes);report.push({staffId:s.id,nama:s.name,profesi:p.name,halaman:12,status:d.status})}catch(e){report.push({staffId:s.id,nama:s.name,status:'GAGAL',pesan:e.message})}
  $('progress').value=++n;inline.textContent=n+'/'+selected.length+' staf diproses';await new Promise(r=>setTimeout(r,0))}
  const count=report.filter(r=>r.halaman===12).length;if(!count)throw Error('Tidak ada PDF berhasil dibuat.');
  zip.file('manifest.json',JSON.stringify(report,null,2));download(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),'OPPE_RSUD_SSMA_2024-2026.zip','application/zip');
  const signed=report.filter(r=>r.status==='ARSIP_BERTANDA_TANGAN').length;inline.textContent=count+' PDF berhasil · '+signed+' arsip bertanda tangan · '+(count-signed)+' belum ditandatangani · '+(selected.length-count)+' gagal. Periksa manifest.';inline.dataset.state='ready';
 }catch(e){inline.textContent='Ekspor gagal: '+e.message;inline.dataset.state='pending';toast(e.message)}
 finally{busy=false;$('exportPdf').disabled=false;$('exportScope').disabled=false;$('progress').hidden=true}
}
function editStaff(s){editing=s?.id||null;for(const [id,v] of [['staffName',s?.name],['staffNip',s?.employeeId],['staffProfession',s?.professionId],['staffJob',s?.job],['staffUnit',s?.unit],['staffGroup',s?.group]])$(id).value=v||'';$('mappingVerified').checked=!!s&&!s.needsReview;$('staffHead').checked=!!s&&isHead(s,state.signers[s.group]||{});$('directSection').checked=!!s&&s.directSection===true;if(s)$('saveStaff').closest('details').open=true}
function init(){store();$('exportScope').onchange=renderExport;$('exportPdf').onclick=exportPdf;const opts=professions.map(p=>[p.id,p.name]);selectOptions('filter',opts,'Semua profesi');selectOptions('staffProfession',opts,'Pilih profesi');$('staffSelect').addEventListener('change',()=>{renderAssessment();renderSigners();renderPeriods()});$('search').addEventListener('input',renderStaff);$('filter').addEventListener('change',renderStaff);
$('staffTable').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.open){$('staffSelect').value=b.dataset.open;renderAssessment();renderSigners();renderPeriods();location.hash='assessment'}if(b.dataset.edit)editStaff(state.staff.find(s=>s.id===b.dataset.edit))});
$('saveStaff').onclick=()=>{const s={name:$('staffName').value.trim(),employeeId:$('staffNip').value.trim(),professionId:$('staffProfession').value,job:$('staffJob').value.trim(),unit:$('staffUnit').value.trim(),group:$('staffGroup').value.trim()||$('staffProfession').value,needsReview:!$('mappingVerified').checked,isHead:$('staffHead').checked,directSection:$('directSection').checked};if(!s.name||!prof(s.professionId)){toast('Nama dan profesi wajib diisi.');return}if(editing){const old=state.staff.find(x=>x.id===editing);if(old.professionId!==s.professionId&&PERIODS.some(p=>state.assessments[key(old,p)])){toast('Profesi tidak dapat diubah setelah ada penilaian.');return}Object.assign(old,s)}else state.staff.push({...s,id:crypto.randomUUID()});store();editStaff(null);refresh();toast('Data staf disimpan')};$('cancelStaff').onclick=()=>editStaff(null);
$('assessmentForm').addEventListener('input',e=>editAssessment(e.target));$('assessmentForm').addEventListener('change',e=>{if(e.target.dataset.detail)saveDetail(e.target);else editAssessment(e.target)});$('saveAssessment').onclick=saveBatch;
$('scope').onchange=renderSigners;$('bulkEvidenceBtn').onclick=()=>{const t=$('bulkEvidence').value.trim();if(!t)return toast('Isi teks referensi bukti dahulu.');if(!confirm('Isi referensi bukti "'+t+'" pada semua triwulan yang sudah dinilai tetapi buktinya masih kosong (seluruh staf)?'))return;const n=fillEvidence(state,t);if(store()){refresh();renderExport();toast(n?n+' triwulan diisi referensi buktinya.':'Tidak ada triwulan dengan bukti kosong.')}};$('signerForm').addEventListener('change',e=>{if(e.target.dataset.sigupload)uploadSignature(e.target)});$('signerForm').addEventListener('click',e=>{const b=e.target.closest('[data-sigdel]');if(b)deleteSignature(b.dataset.sigdel)});$('saveSigners').onclick=()=>{const s=staff();if(!s)return toast('Pilih staf dahulu.');const data={};for(const el of $('signerForm').querySelectorAll('[data-role]')){(data[el.dataset.role]??={})[el.dataset.field]=el.value.trim()}if($('scope').value==='person'){if(!confirm('Terapkan mapping penandatangan ini untuk seluruh 12 periode staf?'))return;for(const q of PERIODS)state.overrides[key(s,q)]=structuredClone(data)}else state.signers[s.group]=data;store();renderSigners();renderExport();toast('Mapping tersimpan')};

$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25*1024*1024)throw Error('File terlalu besar (maks 25 MB)');const raw=/\.xlsx$/i.test(file.name)?await importWorkbook(file):JSON.parse(await file.text()),sigImages=raw.signatureImages||[];delete raw.signatureImages;const x=normalizeMapping(validatePack(raw,professions));migrateChair(x);if(x.schema==='oppe-backup-v2'){if(!confirm('Pulihkan backup dan ganti seluruh workspace lokal?'))return;state={...fresh(),staff:x.staff,assessments:x.assessments||{},signers:x.signers||{},overrides:x.overrides||{},assets:x.assets||{},signatures:x.signatures||{},batchEdits:x.batchEdits||{},chairRevision:41}}else{const m=new Map(state.staff.map(s=>[s.id,s]));for(const s of x.staff){const old=m.get(s.id);if(!old)m.set(s.id,s);else if(x.mappingRevision>=3){old.isHead=s.isHead;old.directSection=s.directSection;old.needsReview=s.needsReview}}state.staff=[...m.values()];if(x.mappingRevision>=3&&confirm('Terapkan mapping penilai terbaru? Penilaian tersimpan tidak diubah. Mapping kelompok akan diperbarui; override per periode tetap dipertahankan.'))state.signers={...state.signers,...x.signers};else state.signers={...x.signers,...state.signers};normalizeMapping(state);migrateChair(state);state.chairRevision=41;state.assets={...state.assets,...x.assets}}const sigNote=await importExcelSignatures(sigImages);if(store())toast(x.staff.length+' staf dalam paket berhasil diproses'+sigNote);refresh()}catch(e){toast('Impor gagal: '+e.message)}finally{$('importFile').value=''}};
$('backupBtn').onclick=()=>download(JSON.stringify({...state,schema:'oppe-backup-v2'},null,2),'OPPE_BACKUP_PRIVAT.json','application/json');$('clearBtn').onclick=async()=>{if(confirm('Hapus seluruh data lokal, termasuk arsip PDF bertanda tangan? Pastikan backup dan PDF final telah diunduh.')){try{await clearSigned();localStorage.removeItem(KEY);localStorage.removeItem(OLD);state=fresh();state.batchEdits={};refresh();toast('Data lokal dihapus')}catch(e){toast(e.message)}}};
refresh()}
fetch(new URL('../data/professions.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Katalog tidak tersedia');return r.json()}).then(d=>{if(!Array.isArray(d)||d.length!==49)throw Error('Katalog profesi tidak lengkap');professions=d;init()}).catch(e=>toast(e.message));
