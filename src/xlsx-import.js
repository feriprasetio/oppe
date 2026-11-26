// Import original workbook locally. The source layout is fixed; reject shifted or incompatible workbooks.
const specs=[[4,9,32,4,[4,5,6]],[11,16,40,11,[10,11,12]],[18,27,39,18,[18,19,20]],[29,32,34,29,[28,29,30]],[34,51,34,30,null],[53,53,35,31,null],[55,66,34,32,null],[68,72,33,68,[68,69,70]],[74,76,41,74,[73,74,75]],[78,78,31,null,[77,78,79]],[80,87,36,80,[81,82,83]],[89,110,38,89,[88,89,90]],[113,128,30,113,[112,113,114]],[130,143,28,130,[129,130,131]],[145,146,28,null,null],[148,149,29,null,null],[151,152,44,151,[150,151,152]],[154,160,37,154,[156,157,158]],[162,164,43,162,[162,163,164]],[166,166,45,null,null],[168,170,47,168,[169,170,171]]];
const headers={3:/anastesi/i,10:/gizi/i,17:/fisioterapi/i,28:/farmasi/i,33:/depo farmasi ranap/i,52:/gudang farmasi/i,54:/farmasi rawat jalan/i,67:/terapis gigi/i,73:/elektromedik/i,77:/psikologi/i,79:/radiologi/i,88:/laboratorium/i,112:/ruang bersalin/i,129:/ranap kebidanan/i,144:/kenanga kasturi/i,147:/poli obsgyn/i,150:/epidemiologi/i,153:/perekam medis/i,161:/sanitarian/i,165:/pembimbing kesehatan/i,167:/promosi kesehatan/i};
const clean=s=>String(s||'').replace(/\s*\(\s*Penilai OPPE[^)]*\)\s*/ig,'').trim();
function parse(xml){const d=new DOMParser().parseFromString(xml,'application/xml');if(d.querySelector('parsererror'))throw Error('XML Excel tidak dapat dibaca');return d}
const tags=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
export async function importWorkbook(file){
 if(!window.JSZip)throw Error('Pembaca Excel belum tersedia');
 const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
 const sheet=zip.file('xl/worksheets/sheet1.xml');if(!sheet)throw Error('Sheet sumber tidak ditemukan');
 const shared=zip.file('xl/sharedStrings.xml');const strings=shared?tags(parse(await shared.async('string')),'si').map(x=>tags(x,'t').map(t=>t.textContent).join('')):[];
 const rows={};for(const row of tags(parse(await sheet.async('string')),'row')){const r=Number(row.getAttribute('r'));const obj={};for(const c of tags(row,'c')){const col=(c.getAttribute('r')||'').replace(/\d/g,'');const t=c.getAttribute('t'),v=tags(c,'v')[0]?.textContent||'';obj[col]=String(t==='s'?strings[Number(v)]||'':t==='inlineStr'?tags(c,'t').map(t=>t.textContent).join(''):v).trim()}rows[r]=obj}
 if(!/nama/i.test(rows[2]?.B||'')||!/jabatan/i.test(rows[2]?.C||'')||!/nip/i.test(rows[2]?.E||''))throw Error('Header Excel bukan template mapping OPPE sumber');
 for(const [r,re] of Object.entries(headers))if(!re.test(rows[r]?.B||''))throw Error('Susunan Excel berbeda pada baris '+r+'. Gunakan paket JSON yang sudah dipetakan.');
 const person=r=>r?{name:clean(rows[r]?.B),nip:rows[r]?.E||'',role:rows[r]?.D||''}:{};
 const committee={...person(94),role:'Ketua Komite Nakes Lain'};const staff=[],signers={};
 for(const [start,end,pid,judge,sup] of specs){const group='excel-'+start;signers[group]={reviewer:person(judge),supervisor:sup?{name:(rows[sup[0]]?.H||'').replace(/^Nama:\s*/i,''),role:(rows[sup[1]]?.H||'').replace(/^Jabatan\s*:\s*/i,''),nip:(rows[sup[2]]?.H||'').replace(/^NIP\s*[.:]?\s*/i,'')}:{},committee};for(let r=start;r<=end;r++){const a=rows[r];if(!a?.B||!/^\d+$/.test(a.A||''))throw Error('Baris staf tidak valid: '+r);const j=(a.C||'').toLowerCase();let p=pid;if(pid===39)p=j.includes('wicara')?48:j.includes('okupasi')?49:39;if(pid===34)p=j.includes('asisten')?35:34;if(pid===38&&j.includes('perawat'))p=27;staff.push({id:'mapping-row-'+r,name:clean(a.B),employeeId:a.E||'',job:a.C||'',unit:a.D||'',group,professionId:'profession-'+String(p).padStart(2,'0'),sourceRow:r,needsReview:p===27||!judge||!sup||r===judge||r===94})}}
 if(staff.length!==146)throw Error('Jumlah staf berbeda dari workbook sumber');
 return {schema:'oppe-local-pack-v2',staff,signers,assets:{}};
}
