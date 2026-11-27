// Import original workbook locally. The source layout is fixed; reject shifted or incompatible workbooks.
import {normalizeMapping,migrateChair} from './model.js';
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
 const committee={...person(89),role:'Ketua Komite Nakes Lain'};const staff=[],signers={};
 for(const [start,end,pid,judge,sup] of specs){const group='excel-'+start;signers[group]={reviewer:person(judge),supervisor:sup?{name:(rows[sup[0]]?.H||'').replace(/^Nama:\s*/i,''),role:(rows[sup[1]]?.H||'').replace(/^Jabatan\s*:\s*/i,''),nip:(rows[sup[2]]?.H||'').replace(/^NIP\s*[.:]?\s*/i,'')}:{},committee};for(let r=start;r<=end;r++){const a=rows[r];if(!a?.B||!/^\d+$/.test(a.A||''))throw Error('Baris staf tidak valid: '+r);const j=(a.C||'').toLowerCase();let p=pid;if(pid===39)p=j.includes('wicara')?48:j.includes('okupasi')?49:39;if(pid===34)p=j.includes('asisten')?35:34;if(pid===38&&j.includes('perawat'))p=27;staff.push({id:'mapping-row-'+r,name:clean(a.B),employeeId:a.E||'',job:a.C||'',unit:a.D||'',group,professionId:'profession-'+String(p).padStart(2,'0'),sourceRow:r,needsReview:p===27||!judge||!sup||r===judge})}}
 if(staff.length!==146)throw Error('Jumlah staf berbeda dari workbook sumber');
 const people=[];for(const r of Object.keys(rows).map(Number))if(rows[r]?.B&&/^\d{10,}$/.test(String(rows[r]?.E||'').replace(/\D/g,'')))people.push({row:r,col:1,...person(r)});
 for(const [,,,,sup] of specs)if(sup){const sp={name:(rows[sup[0]]?.H||'').replace(/^Nama:\s*/i,''),role:(rows[sup[1]]?.H||'').replace(/^Jabatan\s*:\s*/i,''),nip:(rows[sup[2]]?.H||'').replace(/^NIP\s*[.:]?\s*/i,'')};if(sp.name)for(const r of sup)people.push({row:r,col:7,...sp})}
 const pack=normalizeMapping({schema:'oppe-local-pack-v2',staff,signers,assets:{},mappingRevision:4});migrateChair(pack);
 pack.signatureImages=await sheetImages(zip,people);return pack;
}

// Gambar TTD yang ditempel di sheet1: dicocokkan ke orang pada baris jangkar gambar (nama di B, NIP di E)
// atau ke blok kepala seksi (kolom H). Gambar yang tidak jelas pemiliknya diabaikan.
async function rels(zip,path){const f=zip.file(path);if(!f)return {};const out={};for(const r of tags(parse(await f.async('string')),'Relationship'))out[r.getAttribute('Id')]=r.getAttribute('Target');return out}
const resolve=(base,target)=>{if(target.startsWith('/'))return target.slice(1);const parts=base.split('/');parts.pop();for(const seg of target.split('/')){if(seg==='..')parts.pop();else if(seg!=='.')parts.push(seg)}return parts.join('/')}
export function matchAnchor(people,from,to,col){const span=p=>p.row>=from&&p.row<=to;const near=(p,d)=>Math.abs(p.row-from)<=d||Math.abs(p.row-to)<=d;const side=col>=6?people.filter(p=>p.col===7):people.filter(p=>p.col!==7);
 for(const pool of [side,people]){const hit=pool.filter(span);const named=[...new Map(hit.map(p=>[p.nip||p.name,p])).values()];if(named.length===1)return named[0];if(named.length>1){named.sort((a,b)=>Math.abs(a.row-from)-Math.abs(b.row-from));return named[0]}const close=pool.filter(p=>near(p,1)).sort((a,b)=>Math.abs(a.row-from)-Math.abs(b.row-from));if(close.length)return close[0]}return null}
export async function sheetImages(zip,people){const out=[];const sr=await rels(zip,'xl/worksheets/_rels/sheet1.xml.rels');
 for(const t of Object.values(sr)){if(!/drawings\/drawing\d+\.xml$/.test(t))continue;const dpath=resolve('xl/worksheets/sheet1.xml',t),df=zip.file(dpath);if(!df)continue;const dr=await rels(zip,dpath.replace(/([^/]+)$/,'_rels/$1.rels'));const d=parse(await df.async('string'));
  for(const anchor of [...tags(d,'twoCellAnchor'),...tags(d,'oneCellAnchor')]){const from=tags(anchor,'from')[0],to=tags(anchor,'to')[0],blip=tags(anchor,'blip')[0];if(!from||!blip)continue;
   const num=(n,k)=>Number(tags(n,k)[0]?.textContent||0);const r0=num(from,'row')+1,c0=num(from,'col'),r1=to?num(to,'row')+1:r0;const target=dr[blip.getAttribute('r:embed')||blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed')];if(!target)continue;
   const mpath=resolve(dpath,target),mf=zip.file(mpath),ext=(mpath.split('.').pop()||'').toLowerCase(),mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',webp:'image/webp'}[ext];if(!mf||!mime)continue;
   const who=matchAnchor(people,r0,r1,c0);if(!who)continue;out.push({row:r0,col:c0,name:who.name,nip:who.nip,role:who.role,image:'data:'+mime+';base64,'+await mf.async('base64')})}}
 return out}
