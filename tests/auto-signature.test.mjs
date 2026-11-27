import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import {createRequire} from 'node:module';
import {createStaffPdf} from '../src/pdf-renderer.js';import {PERIODS,fresh,indicators,key,demoValue,resultFor,signerKey,signatureFor,signedCount} from '../src/model.js';
const require=createRequire(import.meta.url);globalThis.window={PDFLib:require('/tmp/oppe-vendor/node_modules/pdf-lib')};
// PNG 2x1 hitam, dibuat tanpa dependensi.
function png(){const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1}return ~c>>>0};const chunk=(t,d)=>{const len=Buffer.alloc(4);len.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c])};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6;const raw=Buffer.from([0,0,0,0,255,0,0,0,255]);return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64')}
const profiles=JSON.parse(fs.readFileSync('data/professions.json','utf8')),p=profiles[0];
const staff={id:'t1',name:'STAF FIKTIF',employeeId:'DEMO',unit:'Unit',professionId:p.id,group:'g'};
const reviewer={name:'Kepala Fiktif',role:'Kepala Ruang',nip:'198001012005011001'},committee={name:'Ketua Fiktif',role:'Ketua Komite',nip:'197501012000011002'};
const state={...fresh(),staff:[staff],signers:{g:{reviewer,committee}}};
// Lengkapi triwulan pertama saja.
const q=PERIODS[0],items={};for(const i of indicators(p)){const v=demoValue(i)||'1';items[i.id]={value:v,result:resultFor(i,v)}}
state.assessments[key(staff,q)]={items,areas:[],evidence:'Rekap logbook',staffId:staff.id};
assert.equal(signedCount(state,staff,p),0,'tanpa TTD tidak ada yang ditandatangani');
const image=png();
state.signatures[signerKey(reviewer)]={image,consentAt:'2026-11-26T00:00:00Z'};
assert.equal(signedCount(state,staff,p),0,'satu TTD saja belum cukup');
state.signatures[signerKey(committee)]={image,consentAt:'2026-11-26T00:00:00Z'};
assert.equal(signedCount(state,staff,p),1,'hanya triwulan lengkap yang ditandatangani');
assert.equal(signatureFor(state,{name:'kepala   FIKTIF',nip:'1980 0101 2005 0110 01'})?.image,image,'cocok berdasarkan NIP');
assert.equal(signatureFor({signatures:{[signerKey(reviewer)]:{image}}},reviewer),null,'tanpa catatan izin TTD tidak dipakai');
const doc=await window.PDFLib.PDFDocument.load(await createStaffPdf(staff,p,state,PERIODS));assert.equal(doc.getPageCount(),12);
const count=d=>d.getPages().map(pg=>{const xo=pg.node.Resources()?.lookup(window.PDFLib.PDFName.of('XObject'));return xo?xo.keys().length:0}),imgs=count(doc);
assert.equal(imgs[0],2,'halaman lengkap memuat TTD Ketua Komite dan Penilai');assert(imgs.slice(1).every(n=>n===0),'halaman belum lengkap tanpa TTD');
const demo=await window.PDFLib.PDFDocument.load(await createStaffPdf(staff,p,state,PERIODS,true));assert(count(demo).every(n=>n===0),'mode simulasi tidak pernah memakai TTD');
console.log('Auto-signature: only complete, verified quarters with consented signatures are signed');
{const {signReport}=await import('../src/model.js');const st=structuredClone(state);for(const a of Object.values(st.assessments))delete a.evidence;
let r=signReport(st,staff,p);assert.equal(r.signed,1,'TTD tidak menunggu referensi bukti');
for(const a of Object.values(st.assessments))delete a.items[Object.keys(a.items)[0]];r=signReport(st,staff,p);assert.equal(r.signed,0);assert.equal(r.reasons['BELUM LENGKAP'],11,'indikator kosong tidak ditandatangani');
const s2=structuredClone(state);delete s2.signatures[signerKey(committee)];r=signReport(s2,staff,p);assert.deepEqual(r.missingSig,[committee.name]);console.log('Sign report passed')}
{const {matchAnchor}=await import('../src/xlsx-import.js');const people=[{row:18,col:1,name:'Kepala A',nip:'1'},{row:19,col:1,name:'Staf B',nip:'2'},{row:18,col:7,name:'Kasi C',nip:'3'},{row:19,col:7,name:'Kasi C',nip:'3'},{row:20,col:7,name:'Kasi C',nip:'3'}];
assert.equal(matchAnchor(people,19,19,5)?.name,'Staf B','gambar di baris staf');assert.equal(matchAnchor(people,18,20,8)?.name,'Kasi C','gambar di blok kepala seksi kolom H');assert.equal(matchAnchor(people,40,41,5),null,'gambar jauh dari nama diabaikan');console.log('Excel signature anchor matching passed')}
