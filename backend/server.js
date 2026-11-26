import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID} from 'node:crypto';
import PDFLib from 'pdf-lib';
import {createAssetVault,canManageAsset} from './signature-vault.js';
import {createStaffPdf} from '../src/pdf-renderer.js';
import {PERIODS} from '../src/model.js';
import {hash,passwordMatches,validateConfig,buildRequest,duties,mayRead,allApproved,acceptApproval} from './approval-core.js';
const root=path.dirname(fileURLToPath(import.meta.url)),origin=new URL(process.env.OPPE_ORIGIN||'https://oppe.invalid').origin;
if(!process.env.OPPE_CONFIG||!process.env.OPPE_DATA_DIR||!process.env.OPPE_ORIGIN||!origin.startsWith('https://'))throw Error('Set OPPE_CONFIG, OPPE_DATA_DIR dan OPPE_ORIGIN HTTPS');
const config=validateConfig(JSON.parse(fs.readFileSync(process.env.OPPE_CONFIG,'utf8'))),catalog=JSON.parse(fs.readFileSync(path.join(root,'../data/professions.json'),'utf8')),store=path.resolve(process.env.OPPE_DATA_DIR);
fs.mkdirSync(store,{recursive:true,mode:0o700});if((fs.statSync(store).mode&0o077)!==0)throw Error('Direktori data harus privat (chmod 700)');
const assetVault=process.env.OPPE_ASSET_KEY?createAssetVault(path.join(store,'signature-assets'),process.env.OPPE_ASSET_KEY):null;
globalThis.window={PDFLib};const sessions=new Map(),attempts=new Map(),locks=new Set(),ID=/^[0-9a-f-]{36}$/;
const publicUser=u=>({id:u.id,name:u.name,role:u.role,permissions:u.permissions});
const file=(id,ext)=>{if(!ID.test(id))throw Error('ID dokumen tidak valid');return path.join(store,id+ext)};
const read=id=>JSON.parse(fs.readFileSync(file(id,'.json'),'utf8'));
function write(id,doc){const temp=file(id,'.tmp');fs.writeFileSync(temp,JSON.stringify(doc),{mode:0o600});fs.renameSync(temp,file(id,'.json'))}
function writeBytes(id,ext,bytes){const temp=file(id,ext+'.tmp');fs.writeFileSync(temp,bytes,{mode:0o600});fs.renameSync(temp,file(id,ext))}
const list=()=>fs.readdirSync(store).filter(x=>x.endsWith('.json')&&ID.test(x.slice(0,-5))).map(x=>read(x.slice(0,-5)));
const safe=(s)=>String(s||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);
function reply(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value))}
function bytes(res,body,name){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','inline; filename="'+safe(name)+'.pdf"');res.end(body)}
function current(req){const t=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-oppe='))?.slice(12),s=sessions.get(t);if(!s||s.expires<Date.now()){if(t)sessions.delete(t);return null}const u=config.accounts.find(a=>a.id===s.id);return u?{u,t}:null}
async function body(req,max=8*1024*1024){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Error('Content-Type harus application/json');let chunks=[],n=0;for await(const chunk of req){n+=chunk.length;if(n>max)throw Error('Permintaan terlalu besar');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
function metadata(d,u){return {id:d.id,staff:d.staff,reviewHash:d.reviewHash,createdAt:d.createdAt,approvedCount:Object.keys(d.approvals).length,requiredCount:new Set(Object.values(d.assignments).flatMap(x=>[x.reviewer,x.committee])).size,myDuties:duties(d,u.id).length,myApproved:!!d.approvals[u.id],final:!!d.finalHash,finalHash:d.finalHash||null}}
async function finalPdf(d){
 const original=fs.readFileSync(file(d.id,'.review.pdf'));if(hash(original)!==d.reviewHash)throw Error('Integritas PDF sumber gagal');
 const out=await PDFLib.PDFDocument.load(original),font=await out.embedFont(PDFLib.StandardFonts.Helvetica),bold=await out.embedFont(PDFLib.StandardFonts.HelveticaBold),black=PDFLib.rgb(.12,.12,.12),white=PDFLib.rgb(1,1,1),images={};
 for(const [id,a] of Object.entries(d.approvals)){images[id]=await out.embedPng(a.image)}
 for(let i=0;i<PERIODS.length;i++){const page=out.getPage(i),q=PERIODS[i],h=page.getHeight(),y=d.positions[i].sigY;
  page.drawRectangle({x:14,y:h-94,width:582,height:14,color:white});
  page.drawText('ARSIP PERSETUJUAN INTERNAL - TANDA TANGAN GAMBAR', {x:112,y:h-91,size:9,font:bold,color:black});
  for(const [r,j] of [['committee',0],['reviewer',1]]){const id=d.assignments[q.id][r],im=images[id],a=d.approvals[id],scale=Math.min(120/im.width,26/im.height),cx=22+j*290+137.5;page.drawImage(im,{x:cx-im.width*scale/2,y:h-y-47,width:im.width*scale,height:im.height*scale});const date=a.approvedAt.slice(0,10);page.drawText('Disetujui '+date,{x:cx-35,y:h-y-84,size:7,font,color:black})}
  page.drawRectangle({x:14,y:0,width:582,height:18,color:white});page.drawText('OPPE | '+q.label+' | Arsip internal - bukan TTE tersertifikasi',{x:145,y:7,size:7,font,color:black});
 }
 out.setSubject('Internal approval; not a certified digital signature');const result=Buffer.from(await out.save());writeBytes(d.id,'.final.pdf',result);d.finalHash=hash(result);d.finalizedAt=new Date().toISOString();
 // Do not retain reusable signature bitmaps in records after document generation.
 for(const a of Object.values(d.approvals))delete a.image;
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{
 const u=new URL(req.url,origin),p=u.pathname;
 if(req.method==='GET'&&['/','/portal.js','/portal.css'].includes(p)){const name=p==='/'?'portal.html':p.slice(1);res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)));return}
 if(req.method!=='GET'&&req.headers.origin!==origin)return reply(res,403,{error:'Origin tidak diizinkan'});
 if(req.method==='POST'&&p==='/api/login'){
  const x=await body(req,4096),id=String(x.id||'').slice(0,80),pw=String(x.password||'').slice(0,256),ip=req.socket.remoteAddress||'local',k=ip+'|'+id,old=attempts.get(k);
  if(old&&old.until>Date.now()&&old.n>=8)return reply(res,429,{error:'Terlalu banyak percobaan. Coba kembali nanti.'});
  const a=config.accounts.find(x=>x.id===id),ok=passwordMatches(pw,a?.passwordHash||'00000000000000000000000000000000:'+('00'.repeat(64)));
  if(!a||!ok){attempts.set(k,{n:old&&old.until>Date.now()?old.n+1:1,until:Date.now()+15*60*1000});return reply(res,401,{error:'Login gagal'})}
  attempts.delete(k);const previous=current(req);if(previous)sessions.delete(previous.t);const token=randomBytes(32).toString('hex');sessions.set(token,{id:a.id,expires:Date.now()+30*60*1000});res.setHeader('Set-Cookie','__Host-oppe='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800');return reply(res,200,publicUser(a));
 }
 const session=current(req);if(!session)return reply(res,401,{error:'Login diperlukan'});const user=session.u;
 if(req.method==='POST'&&p==='/api/logout'){sessions.delete(session.t);res.setHeader('Set-Cookie','__Host-oppe=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(res,200,{ok:true})}
 if(req.method==='GET'&&p==='/api/me')return reply(res,200,publicUser(user));
 if(p==='/api/my-signature'||p==='/api/my-signature/remove'){
  if(!canManageAsset(user))return reply(res,403,{error:'Khusus akun penandatangan'});
  if(!assetVault)return reply(res,503,{error:'Penyimpanan aset privat belum dikonfigurasi'});
  if(req.method==='GET'&&p==='/api/my-signature'){const a=assetVault.get(user);return reply(res,200,a?{image:a.image,digest:a.digest,updatedAt:a.updatedAt}:null)}
  if(req.method==='POST'){
   const x=await body(req,1000000);
   if(x.confirmed!==true||!passwordMatches(String(x.password||'').slice(0,256),user.passwordHash))return reply(res,403,{error:'Konfirmasi pemilik dan kata sandi diperlukan'});
   if(p.endsWith('/remove')){assetVault.remove(user);return reply(res,200,{ok:true})}
   if(typeof x.image!=='string'||x.image.length>800000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(x.image))throw Error('PNG tidak valid');
   const trial=await PDFLib.PDFDocument.create(),im=await trial.embedPng(x.image);if(im.width>1200||im.height>600||im.width<10||im.height<10)throw Error('Dimensi tanda tangan tidak valid');
   const a=assetVault.save(user,x.image);return reply(res,200,{digest:a.digest,updatedAt:a.updatedAt});
  }
  return reply(res,405,{error:'Metode tidak diizinkan'});
 }
 if(req.method==='GET'&&p==='/api/documents')return reply(res,200,list().filter(d=>mayRead(d,user)).map(d=>metadata(d,user)));
 if(req.method==='POST'&&p==='/api/submit'){
  if(!user.permissions.includes('admin'))return reply(res,403,{error:'Khusus administrator'});
  const x=await body(req);if(x.schema!=='oppe-approval-request-v1'||!Array.isArray(x.requests)||x.requests.length<1||x.requests.length>150)throw Error('Paket tidak valid');
  const report=[];for(const r of x.requests){try{const built=buildRequest(config,catalog,r),positions=[],pdf=Buffer.from(await createStaffPdf(built.staff,built.profile,built.state,PERIODS,false,{review:true,positions})),id=randomUUID();if(positions.length!==12)throw Error('Posisi tanda tangan tidak lengkap');const doc={id,staff:{id:built.staff.id,name:built.staff.name,profession:built.profile.name},assignments:built.assignments,positions,reviewHash:hash(pdf),createdAt:new Date().toISOString(),submittedBy:user.id,approvals:{}};writeBytes(id,'.review.pdf',pdf);write(id,doc);report.push({staffId:r.staffId,id,status:'submitted'})}catch(e){report.push({staffId:r.staffId,error:e.message})}}return reply(res,200,report);
 }
 const m=/^\/api\/documents\/([0-9a-f-]{36})\/(review|final|approve)$/.exec(p);
 if(m){const [,id,action]=m;if(!fs.existsSync(file(id,'.json')))return reply(res,404,{error:'Dokumen tidak ditemukan'});const d=read(id);if(!mayRead(d,user))return reply(res,403,{error:'Tidak berwenang'});
  if(req.method==='GET'&&action==='review'){const b=fs.readFileSync(file(id,'.review.pdf'));if(hash(b)!==d.reviewHash)throw Error('Integritas gagal');return bytes(res,b,'OPPE_'+d.staff.name+'_REVIEW')}
  if(req.method==='GET'&&action==='final'){if(!d.finalHash)return reply(res,409,{error:'Belum seluruh pejabat menyetujui'});const b=fs.readFileSync(file(id,'.final.pdf'));if(hash(b)!==d.finalHash)throw Error('Integritas gagal');return bytes(res,b,'OPPE_'+d.staff.name+'_FINAL')}
  if(req.method==='POST'&&action==='approve'){
   if(locks.has(id))return reply(res,409,{error:'Dokumen sedang diproses'});locks.add(id);
   try{const x=await body(req,1000000),latest=read(id);if(x.confirmed!==true)throw Error('Konfirmasi hasil dan PDF diperlukan');if(!duties(latest,user.id).length)return reply(res,403,{error:'Tidak berwenang menyetujui'});
    // Decode and embed before accepting; reject malformed images, no public assets.
    const image=x.assetDigest?(assetVault?.forApproval(user,x.assetDigest)):x.image;
    if(!image)throw Error('Aset tanda tangan tidak tersedia.');
    const trial=await PDFLib.PDFDocument.create(),im=await trial.embedPng(image);if(im.width>1200||im.height>600||im.width<10||im.height<10)throw Error('Dimensi tanda tangan tidak valid');
    acceptApproval(latest,user,x.reviewHash,image);if(allApproved(latest))await finalPdf(latest);write(id,latest);return reply(res,200,metadata(latest,user));
   }finally{locks.delete(id)}
  }
 }
 return reply(res,404,{error:'Endpoint tidak ditemukan'});
 }catch(e){return reply(res,400,{error:e.message||'Permintaan gagal'})}
});
server.requestTimeout=120000;server.listen(Number(process.env.PORT||8080),'127.0.0.1',()=>console.log('OPPE private portal listening on loopback'));
setInterval(()=>{const now=Date.now();for(const [k,v] of sessions)if(v.expires<now)sessions.delete(k);for(const [k,v] of attempts)if(v.until<now)attempts.delete(k)},60000).unref();
