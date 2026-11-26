import {randomBytes,scryptSync} from 'node:crypto';
import fs from 'node:fs';
const password=fs.readFileSync(0,'utf8').replace(/\r?\n$/,'');if(password.length<12)throw Error('Minimal 12 karakter');
const salt=randomBytes(24).toString('hex');console.log(salt+':'+scryptSync(password,salt,64).toString('hex'));
