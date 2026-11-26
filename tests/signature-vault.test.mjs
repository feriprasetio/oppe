import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createAssetVault} from '../backend/signature-vault.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oppe-asset-test-'));try{
 const v=createAssetVault(dir,'a'.repeat(64)),a={id:'reviewer-a',permissions:['reviewer']},b={id:'reviewer-b',permissions:['committee']},admin={id:'admin',permissions:['admin']};
 const image='data:image/png;base64,AAAA',second='data:image/png;base64,BBBB';
 assert.equal(v.get(a),null);assert.throws(()=>v.save(admin,image));const first=v.save(a,image);
 assert.equal(v.get(b),null);assert.equal(v.forApproval(a,first.digest),image);assert.throws(()=>v.forApproval(b,first.digest));
 const content=fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]));assert(!content.includes(Buffer.from(image)));assert.equal(fs.statSync(path.join(dir,fs.readdirSync(dir)[0])).mode&0o777,0o600);
 v.save(a,second);assert.throws(()=>v.forApproval(a,first.digest));v.remove(a);assert.equal(v.get(a),null);assert.throws(()=>v.forApproval(a,first.digest));assert.throws(()=>createAssetVault(dir,'invalid'));
 console.log('Personal asset isolation, encryption, revision binding and deletion tests passed');
}finally{fs.rmSync(dir,{recursive:true,force:true})}