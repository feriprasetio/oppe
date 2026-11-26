import fs from 'node:fs';
import path from 'node:path';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
export function canManageAsset(user){return !!user?.id&&Array.isArray(user.permissions)&&user.permissions.some(p=>p==='reviewer'||p==='committee')}
export function createAssetVault(directory,keyHex){
 if(!/^[a-f0-9]{64}$/i.test(keyHex||''))throw Error('OPPE_ASSET_KEY must be 32 bytes in hex');
 const key=Buffer.from(keyHex,'hex'),dir=path.resolve(directory);
 fs.mkdirSync(dir,{recursive:true,mode:0o700});if((fs.statSync(dir).mode&0o077)!==0)throw Error('Asset directory must be private');
 function location(user){if(!canManageAsset(user))throw Error('Akun tidak berwenang mengelola aset');return path.join(dir,sha(user.id)+'.enc')}
 function get(user){
  const f=location(user);if(!fs.existsSync(f))return null;
  const b=fs.readFileSync(f),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAAD(Buffer.from(user.id));d.setAuthTag(b.subarray(12,28));
  const a=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'));
  if(a.owner!==user.id||sha(a.image)!==a.digest)throw Error('Integritas aset gagal');
  return a;
 }
 function save(user,image){
  const f=location(user);
  if(typeof image!=='string'||image.length>800000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image))throw Error('PNG tidak valid');
  const a={owner:user.id,image,digest:sha(image),updatedAt:new Date().toISOString()};
  const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(user.id));const payload=Buffer.concat([c.update(JSON.stringify(a),'utf8'),c.final()]);const temp=f+'.'+randomBytes(8).toString('hex')+'.tmp';
  try{fs.writeFileSync(temp,Buffer.concat([iv,c.getAuthTag(),payload]),{mode:0o600,flag:'wx'});fs.renameSync(temp,f)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}
  return a;
 }
 function remove(user){const f=location(user);if(fs.existsSync(f))fs.unlinkSync(f)}
 function forApproval(user,digest){const a=get(user);if(!a||a.digest!==digest)throw Error('Aset berubah atau belum tersedia. Periksa ulang pratinjau.');return a.image}
 return {get,save,remove,forApproval};
}
