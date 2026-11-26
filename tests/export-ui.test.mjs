import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),app=fs.readFileSync('src/app.js','utf8');
const section=html.match(/<section id="assessment"[\s\S]*?<\/section>/)?.[0]||'';
assert(section.includes('id="exportPdf"'));assert(section.includes('id="exportScope"'));
assert.equal((html.match(/id="exportPdf"/g)||[]).length,1);
for(const id of ['preview','finalOne','finalAll','exportOne','exportAll','exports','privateApproval','externalArchive','unsignedTools','archiveSigned','approvalPortal'])assert(!html.includes('id="'+id+'"'),id);
assert(app.includes("$('exportPdf').onclick=exportPdf"));assert(app.includes('createStaffPdf(s,p,workspace,PERIODS)'));assert(app.includes("status:'BELUM_DISAHKAN'"));assert(app.includes("if(archived?.current)return"));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
for(const m of app.matchAll(/\$\('([^']+)'\)/g)){assert(ids.includes(m[1])||['evidence','scoreBox','pendingNote'].includes(m[1]),'Missing element: '+m[1]);}
console.log('Single direct export control, removed approval UI and DOM wiring passed');