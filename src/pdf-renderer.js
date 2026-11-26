import {PERIODS,GROUPS,ROLES,AREAS,indicators,key,score,signerSet,status,resolvedItem} from './model.js';
const W=609.9874,H=936;
const clean=s=>String(s??'').replace(/[≥]/g,'>=').replace(/[≤]/g,'<=').replace(/[−–—]/g,'-').replace(/[✓✔☐☑]/g,'').replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
export async function createStaffPdf(staff,prof,state,periods=PERIODS,demo=false){
 if(!window.PDFLib)throw Error('Mesin PDF tidak tersedia. Muat ulang aplikasi.');
 const {PDFDocument,StandardFonts,rgb}=window.PDFLib,doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const black=rgb(.08,.08,.08),gray=rgb(.92,.92,.92),muted=rgb(.37,.37,.37);const images={};
 for(const k of ['city','hospital','watermark'])if(state.assets?.[k]){try{images[k]=await doc.embedPng(state.assets[k])}catch{}}
 for(const period of periods){
  const page=doc.addPage([W,H]),a=state.assessments[key(staff,period)]||{},summary=score(prof,a),signers=signerSet(state,staff,period);
  function text(str,x,top,size=9,opts={}){const f=opts.bold?bold:font;let s=clean(str);const max=opts.max||W-x-14;while(size>5.8&&f.widthOfTextAtSize(s,size)>max)size-=.25;if(f.widthOfTextAtSize(s,size)>max){while(s.length&&f.widthOfTextAtSize(s+'...',size)>max)s=s.slice(0,-1);s+='...'}let xx=opts.center?x+(max-f.widthOfTextAtSize(s,size))/2:x;page.drawText(s,{x:xx,y:H-top-size,size,font:f,color:opts.color||black,opacity:opts.opacity||1})}
  function line(x1,y1,x2,y2,w=.65){page.drawLine({start:{x:x1,y:H-y1},end:{x:x2,y:H-y2},thickness:w,color:black})}
  function rect(x,y,w,h,fill){page.drawRectangle({x,y:H-y-h,width:w,height:h,borderWidth:.65,borderColor:black,...(fill?{color:fill}:{})})}
  function check(x,y,yes=false){rect(x,y,7,7);if(yes){line(x+1,y+4,x+3,y+6,1);line(x+3,y+6,x+8,y-1,1)}}
  function wrap(str,f,size,width){let out=[],s='';for(const word of clean(str).split(/\s+/)){if(s&&f.widthOfTextAtSize(s+' '+word,size)>width){out.push(s);s=word}else s+=(s?' ':'')+word}if(s)out.push(s);return out}
  function img(k,x,y,w,h,opacity=1){if(!images[k])return;const im=images[k],scale=Math.min(w/im.width,h/im.height);page.drawImage(im,{x:x+(w-im.width*scale)/2,y:H-y-h+(h-im.height*scale)/2,width:im.width*scale,height:im.height*scale,opacity})}
  img('watermark',114,330,382,445,.10);img('city',18,12,70,63);img('hospital',521,9,70,67);
  text('On Going Proffesional Practice Evaluation',95,13,15,{bold:true,center:true,max:420});text('Staff Medis dan Tenaga Kesehatan',95,32,14,{bold:true,center:true,max:420});text('Rumah Sakit Umum Daerah Sultan Syarif Mohamad Alkadrie',91,52,11.5,{center:true,max:428});line(14,77,596,77,1.8);
  text(demo?'SIMULASI - DATA FIKTIF - BUKAN HASIL PENILAIAN':status(prof,a,period,staff,signers),15,82,8,{center:true,max:580,bold:true,color:muted});
  const labels=[['Nama Staf',staff.name],['NIP / ID',staff.employeeId||'-'],['Profesi / SMF',prof.name],['Unit kerja',staff.unit||'-']];
  labels.forEach((r,i)=>{text(r[0],17,99+i*17,9,{bold:true,max:113});text(':',130,99+i*17,9);text(r[1],143,99+i*17,9,{max:449})});
  text('Wilayah Kerja',17,171,9,{bold:true,max:113});text(':',130,171,9);
  AREAS.forEach((v,i)=>{const col=i<3?0:1, row=i%3,x=143+col*225,y=170+row*13;check(x,y+1,(a.areas||[]).includes(v));text(v,x+11,y,8.2,{max:208})});
  text('Periode Penilaian',17,213,9,{bold:true,max:115});text(':',130,213,9);[1,2,3,4].forEach((q,i)=>{let x=143+(i%2)*120,y=211+Math.floor(i/2)*13;check(x,y+1,q===period.quarter);text('Triwulan '+['I','II','III','IV'][i],x+11,y,8.2,{max:104})});text('Tahun '+period.year,440,218,9,{bold:true,max:135});
  const left=15,right=595,cols=[15,47,353,423,477,595];let y=247;const all=indicators(prof);
  const active=GROUPS.map(g=>({g,rows:all.filter(i=>i.category===g)})).filter(v=>v.rows.length);
  const rowPlan=active.map(g=>({...g,rows:g.rows.map(i=>({...i,wrapped:wrap(i.name,font,8.6,cols[2]-cols[1]-10)}))}));
  const totalLines=rowPlan.reduce((n,g)=>n+g.rows.reduce((s,i)=>s+Math.max(1,i.wrapped.length),0),0);
  const rowCount=all.length;const base=Math.min(24,Math.max(13,(420-23*active.length-9*(totalLines-rowCount))/Math.max(1,rowCount)));
  for(const g of rowPlan){rect(left,y,right-left,20,gray);text('No.',cols[0]+3,y+5,8.6,{bold:true,max:28,center:true});text('Indikator '+(g.g===GROUPS[2]?'Kinerja Klinis Primer':g.g),cols[1]+4,y+5,8.7,{bold:true,max:300});text('Trigger',cols[2],y+5,8.5,{bold:true,center:true,max:70});text('Hasil',cols[3],y+5,8.5,{bold:true,center:true,max:54});text('Keterangan',cols[4],y+5,8.5,{bold:true,center:true,max:118});y+=20;
   for(const i of g.rows){const v=resolvedItem(i,a.items?.[i.id]),h=base+Math.max(0,i.wrapped.length-1)*9;const mid=y+(h-9)/2;text(i.number,cols[0],mid,8.5,{center:true,max:32});i.wrapped.forEach((s,j)=>text(s,cols[1]+3,y+(h-i.wrapped.length*9)/2+j*9,8.6,{max:300}));text(i.trigger,cols[2]+2,mid,8.1,{center:true,max:66});text(v.value||'-',cols[3]+2,mid,8.1,{center:true,max:50});check(cols[4]+5,mid+1,v.result==='Baik');text('Baik',cols[4]+15,mid,8.1,{max:39});check(cols[4]+55,mid+1,v.result==='Kurang');text('Kurang',cols[4]+65,mid,8.1,{max:48});line(left,y+h,right,y+h,.6);y+=h}
   y+=7;
  }
  y+=3;const xs=[15,143,273,407,595],heads=['Jumlah Penilaian Baik','Jumlah Indikator Dinilai','Total Nilai OPPE (%)','Kategori'];for(let j=0;j<4;j++){rect(xs[j],y,xs[j+1]-xs[j],24);text(heads[j],xs[j]+2,y+7,8.2,{bold:true,center:true,max:xs[j+1]-xs[j]-4});rect(xs[j],y+24,xs[j+1]-xs[j],48)}
  [summary.good,summary.n,summary.pct===null?'-':summary.pct.toFixed(2)+'%'].forEach((v,j)=>text(v,xs[j]+3,y+42,12,{bold:true,center:true,max:xs[j+1]-xs[j]-6}));
  ['Sangat Baik (90-100%)','Baik (70-<90%)','Cukup (60-<70%)','Kurang (<60%)'].forEach((c,j)=>{check(xs[3]+7,y+28+j*10.5,summary.category===['Sangat Baik','Baik','Cukup','Kurang'][j]);text(c,xs[3]+18,y+27+j*10.5,8,{max:165})});y+=80;
  if(a.evidence)text('Referensi bukti: '+a.evidence,17,y,7.4,{max:575});y+=12;
  const sigY=Math.max(y,785);const slots=[['committee',0],['reviewer',1]];
  slots.forEach(([role,j])=>{const x=22+j*290,s=signers[role]||{};text(role==='committee'?'Mengetahui,':'Penilai,',x,sigY,9,{bold:true,center:true,max:275});text(role==='committee'?'Ketua Komite Tenaga Kesehatan Lainnya':s.role||(signers.head||signers.direct?'Kepala Seksi':'Kepala Ruangan / Unit'),x,sigY+13,8.4,{center:true,max:275});line(x+38,sigY+54,x+237,sigY+54,.6);text(s.name||'____________________________',x,sigY+58,9,{center:true,max:275});text(s.nip?'NIP. '+s.nip:'Nama / NIP',x,sigY+70,8,{center:true,max:275})});
  if(sigY+85>H-12)throw Error('Layout melebihi halaman untuk '+prof.name);
  text('OPPE | '+period.label+' | '+(demo?'SIMULASI':'BELUM DISAHKAN'),15,H-17,6.8,{color:muted,max:580,center:true});
 }
 const bytes=await doc.save();if(doc.getPageCount()!==periods.length)throw Error('Jumlah halaman tidak sesuai');return bytes;
}
