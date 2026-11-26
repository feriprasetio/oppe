import assert from 'node:assert/strict';import fs from 'node:fs';import {PERIODS,indicators,score,ended,key,status,ruleFor,resultFor,demoValue,parseActual,migrateChair,applyBatch} from '../src/model.js';const p=JSON.parse(fs.readFileSync('data/professions.json','utf8'));assert.equal(p.length,49);assert.equal(PERIODS.length,12);assert.equal(PERIODS[0].id,'2024-1');assert.equal(PERIODS[11].id,'2026-4');for(const prof of p){const i=indicators(prof);assert.equal(new Set(i.map(x=>x.id)).size,i.length);assert.equal(score(prof,{items:{stale:{result:'Baik'}}}).n,0);const a={items:Object.fromEntries(i.map(x=>[x.id,{value:demoValue(x),result:'Baik'}]))};assert.equal(score(prof,a).pct,100);assert.equal(score(prof,a).missing,0)}assert(!ended(PERIODS[11],new Date(2026,10,26)));console.log('OPPE model tests passed');

import {normalizeMapping,signerSet,isHead,fresh} from '../src/model.js';
const fake=(name,role)=>({name,role,nip:''});const head={id:'head',sourceRow:30,name:'Kepala',group:'excel-29'},staff={id:'staff',sourceRow:34,name:'Staf',group:'excel-34'},committee={id:'chair',sourceRow:94,name:'Ketua',group:'excel-34'};
const state=normalizeMapping({...fresh(),staff:[head,staff,committee],signers:{'excel-29':{reviewer:fake('Atasan instalasi','Kepala Instalasi'),supervisor:fake('Kasi','Kepala Seksi'),committee:fake('Ketua','Ketua Komite')},'excel-34':{reviewer:fake('Kepala','Kepala Ruang'),committee:fake('Ketua','Ketua Komite')}}});
assert.equal(isHead(head),true);assert.equal(signerSet(state,head,PERIODS[0]).reviewer.name,'Kasi');assert.equal(signerSet(state,staff,PERIODS[0]).reviewer.name,'Kepala');assert.equal(state.signers['excel-34'].supervisor.name,'Kasi');assert.equal(signerSet(state,committee,PERIODS[0]).committee.name,undefined);assert(signerSet(state,committee,PERIODS[0]).warnings.length);assert.equal(signerSet({...state,overrides:{[key(head,PERIODS[0])]:{supervisor:fake('Kepala','Kepala Seksi')}}},head,PERIODS[0]).reviewer.name,undefined);console.log('Hierarchy and self-assessment checks passed');

for(const prof of p)for(const i of indicators(prof)){assert(ruleFor(i),prof.name+' '+i.trigger);assert.equal(resultFor(i,demoValue(i)),'Baik',i.name);assert.equal(resultFor(i,''),'');assert.equal(resultFor(i,'abc'),'');}
const cases=[
 [{name:'Keluhan dari pasien',trigger:'> 2 kali'},'2','Baik'],[{name:'Keluhan dari pasien',trigger:'> 2 kali'},'3','Kurang'],
 [{name:'Keluhan manajemen',trigger:'≥ 1 kali'},'0','Baik'],[{name:'Keluhan manajemen',trigger:'≥ 1 kali'},'1','Kurang'],
 [{name:'Kepatuhan',trigger:'< 100%'},'100%','Baik'],[{name:'Kepatuhan',trigger:'< 95%'},'94,9','Kurang'],
 [{name:'Kepatuhan',trigger:'< 95%'},'95','Baik'],[{name:'Penolakan spesimen',trigger:'< 2  %'},'2','Kurang'],
 [{name:'Penolakan spesimen',trigger:'< 2  %'},'1,9','Baik'],[{name:'Kepatuhan turnaround time',trigger:'> 90 %'},'90','Kurang'],
 [{name:'Kepatuhan turnaround time',trigger:'> 90 %'},'90.1','Baik'],[{name:'Response Time Penanganan',trigger:'> 4 jam'},'4','Baik'],
 [{name:'Pertemuan ilmiah',trigger:'2 kali/tahun'},'2','Baik'],[{name:'Pertemuan ilmiah',trigger:'2 kali/tahun'},'1','Kurang'],
 [{name:'Kepatuhan',trigger:'< 100%'},'101',''],[{name:'Keluhan',trigger:'> 2 kali'},'0.5',''],[{name:'Keluhan',trigger:'> 2 kali'},'2%','']
];for(const [i,v,expected] of cases)assert.equal(resultFor(i,v),expected,JSON.stringify([i,v]));
const person={id:'a',name:'Test chair',sourceRow:89,employeeId:'TEST',group:'excel-89'},old={id:'b',name:'Old chair',sourceRow:94,employeeId:'OLD',group:'excel-89'};
const workspace={...fresh(),staff:[person,old],signers:{'excel-89':{committee:{name:'Old chair'}}},overrides:{[key(old,PERIODS[0])]:{committee:{name:'Old chair'}}}};
assert(migrateChair(workspace));assert.equal(workspace.signers['excel-89'].committee.name,'Test chair');assert.equal(workspace.overrides[key(old,PERIODS[0])].committee,undefined);assert(!signerSet(workspace,person,PERIODS[0]).committee.name);
const subject={id:'batch',professionId:p[0].id},i=indicators(p[0])[0];applyBatch(workspace,subject,p[0],{items:{[i.id]:{value:'0'}},evidence:'Fictional test'});assert.equal(PERIODS.filter(q=>workspace.assessments[key(subject,q)]?.items[i.id]?.result==='Baik').length,12);assert.equal(score(p[0],workspace.assessments[key(subject,PERIODS[0])]).n,1);console.log('Automatic scoring for 493 indicators, 12-period batch and local chair migration passed');
