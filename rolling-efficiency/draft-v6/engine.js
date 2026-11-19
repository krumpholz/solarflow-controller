// v6.0.0-draft.1. Called by the generated Node-RED Function, after the unchanged v5 balance.
// Units: kWh, W, milliseconds, SOC percentage points. No device commands here.
const C = Object.freeze({capacity:8.64, seed:80, startCharge:200, holdCharge:100,
 startDischarge:30, holdDischarge:15, startMs:60000, stopMs:120000,
 minMs:600000, socHub:10, minCharge:.8, minDischarge:.1, netAverage:1800,
 maxGap:10000, sourceAge:6500, socConfirm:60000, maxReverseSoc:1,
 learnDays:30, archiveDays:90, maxRecords:2048, inventoryReserve:.0864,
 // Provisional inventory debit only; NOT a learned discharge efficiency.
 provisionalDebit:.8});
const KEY='batt_eff_state_v6_draft', FILE='file', NOW=Date.now(), DAY=86400000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const num=x=>typeof x==='number'?x:typeof x==='string'&&x.trim()!==''?Number(x):NaN;
const flag=x=>x===true||x===1||x==='true'||x==='1'?true:
 x===false||x===0||x==='false'||x==='0'?false:null;
const clone=x=>JSON.parse(JSON.stringify(x));
const round=x=>finite(x)?Math.round(x*10)/10:null;
const signature=JSON.stringify(C);
function energy(a,b,dt){
 const scale=dt/3600000000;
 if(a>=0&&b>=0)return[(a+b)/2*scale,0];
 if(a<=0&&b<=0)return[0,-(a+b)/2*scale];
 const f=Math.abs(a)/(Math.abs(a)+Math.abs(b));
 const x=Math.abs(a)*f/2*scale,y=Math.abs(b)*(1-f)/2*scale;
 return a>0?[x,y]:[y,x];
}
function sane(s){
 if(!s||s.schema!==1||s.signature!==signature||!finite(s.created)||!Array.isArray(s.records)||s.records.length>C.maxRecords)return false;
 if(!s.records.every(r=>['net','solar','discharge'].includes(r.kind)&&[r.start,r.end,r.input,r.output,r.stored,r.hub].every(finite)&&r.end>=r.start&&r.input>=0&&r.output>=0&&r.stored>0&&r.hub>=C.socHub))return false;
 if(!s.estimates||!s.rejected||!Array.isArray(s.rejected))return false;
 for(const v of Object.values(s.estimates))if(!v||!finite(v.eta)||v.eta<=0||v.eta>1||!finite(v.at))return false;
 if(s.last&&![s.last.t,s.last.p,s.last.soc].every(finite))return false;
 if(s.segment&&![s.segment.start,s.segment.soc,s.segment.extreme,s.segment.input,s.segment.output,s.segment.end,s.segment.endSoc].every(finite))return false;
 if(s.inventory){const i=s.inventory;
  if(![i.net,i.solar,i.unknown,i.anchor,i.soc].every(finite)||[i.net,i.solar,i.unknown].some(v=>v<0)||i.soc<0||i.soc>100||!i.pending||!Object.values(i.pending).every(v=>finite(v)&&v>=0))return false;
 }
 return true;
}
let s;
try{
 s=flow.get(KEY,FILE);
 if(s!=null&&!sane(s))throw Error('invalid_draft_state_or_configuration');
 if(!s)s={schema:1,version:'6.0.0-draft.1',signature,created:NOW,seed:C.seed,
  last:null,segment:null,records:[],estimates:{},rejected:[],inventory:null,phase:0};
 // Clone: only a completed update is committed to persistent state.
 s=clone(s);
 const source=legacy?.[1]?.result;
 const t=source?Date.parse(source.timestamp):NaN;
 const p=source?.power_w,soc=source?.soc_now_raw_pct;
 const snapshotValid=!!source&&source.interval_accepted===true&&finite(t)&&NOW>=t&&NOW-t<=C.sourceAge&&finite(p)&&finite(soc);
 const read=k=>flow.get(k);
 const controls={net:flag(read('netz_laden')),allow:flag(read('b_entladen')),
  on:flag(read('regelung')),min:flag(read('regler_batt_min_confirmed')),max:flag(read('batt_max'))};
 const idle=read('regler_idle_compensation_v436');
 controls.idle=!!(idle&&idle.phase==='tracking'&&finite(idle.lastValidTs)&&NOW-idle.lastValidTs>=0&&NOW-idle.lastValidTs<=C.sourceAge);
 const controlsKnown=Object.values(controls).every(v=>typeof v==='boolean');
 const solar=num(read('p_solar')),house=num(read('p_haus'));
 function classify(power){
  if(!controlsKnown||controls.idle||controls.max||!(controls.on||controls.net))return 'unknown';
  if(controls.net)return 'net';
  return finite(solar)&&finite(house)&&solar>=0&&solar-house>0&&power>0?'solar':'unknown';
 }
 function reject(reason,seg){s.rejected.push({at:NOW,reason,kind:seg?.kind||null});s.rejected=s.rejected.slice(-20);}
 function finish(seg,reason){
  if(!seg)return;
  const hub=seg.kind==='discharge'?seg.soc-seg.endSoc:seg.endSoc-seg.soc;
  const stored=C.capacity*hub/100,ms=seg.end-seg.start;
  const input=seg.input,output=seg.output;
  // Never use a mixed-direction energy balance to infer a directional efficiency.
  const opposite=seg.kind==='discharge'?input:output;
  if(!seg.confirmed||ms<C.minMs||hub+1e-9<C.socHub||
   (seg.kind==='discharge'?output<C.minDischarge:input<C.minCharge))return reject('section_too_small',seg);
  if(opposite>1e-9)return reject('mixed_direction',seg);
  if(seg.kind!=='discharge'&&input*3600000000/ms<C.startCharge)return reject('charge_average_low',seg);
  if(seg.kind==='net'&&input*3600000000/ms<C.netAverage)return reject('net_average_low',seg);
  const eta=seg.kind==='discharge'?output/stored:stored/input;
  if(!finite(eta)||eta<=0||eta>1+1e-11)return reject('section_efficiency_out_of_range',seg);
  s.records.push({kind:seg.kind,start:seg.start,end:seg.end,input,output,stored,hub,phase:seg.phase,reason});
  if(s.records.length>C.maxRecords)s.records.shift();
 }
 function begin(kind,q){return{kind,start:q.t,soc:q.soc,extreme:q.soc,input:0,output:0,end:q.t,endSoc:q.soc,
  confirmed:false,low:null,phase:s.phase};}
 function updateLearning(q,prev,ch,dis){
  const canDis=controlsKnown&&controls.on&&!controls.net&&controls.allow&&!controls.min&&!controls.idle;
  const kind=classify(q.p);
  let a=s.segment;
  if(a){
   const denied=a.kind==='discharge'?!canDis:kind!==a.kind;
   const reverse=a.kind==='discharge'?q.p>0:q.p<0;
   if(denied||reverse){finish(a,'mode_change');s.segment=null;s.phase++;a=null;}
  }
  if(a){
   const reversal=a.kind==='discharge'?q.soc-a.extreme:a.extreme-q.soc;
   if(reversal>C.maxReverseSoc){reject('soc_reversal',a);s.segment=null;s.phase++;return;}
   a.extreme=a.kind==='discharge'?Math.min(a.extreme,q.soc):Math.max(a.extreme,q.soc);
   const magnitude=a.kind==='discharge'?-q.p:q.p;
   const start=a.kind==='discharge'?C.startDischarge:C.startCharge;
   const hold=a.kind==='discharge'?C.holdDischarge:C.holdCharge;
   if(!a.confirmed&&magnitude<start){s.segment=null;return;}
   if(a.confirmed&&magnitude<hold){
    if(!a.low)a.low={since:prev.t,section:clone({...a,low:null})};
    if(q.t-a.low.since>=C.stopMs){finish(a.low.section,'low_power');s.segment=null;s.phase++;return;}
   }else a.low=null;
   a.input+=ch;a.output+=dis;a.end=q.t;a.endSoc=q.soc;
   if(q.t-a.start>=C.startMs)a.confirmed=true;
   const hub=a.kind==='discharge'?a.soc-q.soc:q.soc-a.soc;
   if(!a.low&&hub>=C.socHub&&q.t-a.start>=C.minMs&&
    (a.kind==='discharge'?a.output>=C.minDischarge:a.input>=C.minCharge)){
    finish(a,'completed_hub');s.segment=begin(a.kind,q);s.segment.confirmed=true;
   }
   return;
  }
  if(canDis&&q.p<=-C.startDischarge)s.segment=begin('discharge',q);
  else if(kind!=='unknown'&&q.p>=C.startCharge)s.segment=begin(kind,q);
 }
 function estimates(){
  s.records=s.records.filter(r=>r.end>=NOW-C.archiveDays*DAY);
  const result={};
  for(const kind of ['net','solar','discharge']){
   const rows=s.records.filter(r=>r.kind===kind&&r.end>=NOW-C.learnDays*DAY);
   if(rows.length){
    const numerator=rows.reduce((a,r)=>a+(kind==='discharge'?r.output:r.stored),0);
    const denominator=rows.reduce((a,r)=>a+(kind==='discharge'?r.stored:r.input),0);
    s.estimates[kind]={eta:numerator/denominator,at:Math.max(...rows.map(r=>r.end)),count:rows.length,
     hub:rows.reduce((a,r)=>a+r.hub,0),phases:new Set(rows.map(r=>r.phase)).size};
   }
   const v=s.estimates[kind];
   if(v){const age=NOW-v.at;result[kind]={...v,age_days:age/DAY,
    status:age>C.archiveDays*DAY?'expired':age>C.learnDays*DAY?'stale':v.count>=3&&v.phases>=2&&v.hub>=30?'confirmed':'provisional',
    usable:age<=C.learnDays*DAY};}
   else result[kind]={eta:null,status:'unlearned',usable:false};
  }
  return result;
 }
 let e=estimates();
 function inventory(q,ch,dis,continuity){
  if(!s.inventory){s.inventory={net:0,solar:0,unknown:C.capacity*q.soc/100,soc:q.soc,anchor:q.soc,
    pending:{net:0,solar:0,unknown:0},candidate:null};return;}
  const i=s.inventory;
  const clear=()=>{i.pending={net:0,solar:0,unknown:0};i.anchor=q.soc;i.candidate=null;};
  const total=()=>i.net+i.solar+i.unknown;
  const cap=()=>{const target=C.capacity*q.soc/100,n=total();if(n>target&&n>0){const f=target/n;i.net*=f;i.solar*=f;i.unknown*=f;}};
  if(!continuity){
   // A gap may hide a whole discharge/recharge cycle: provenance is unknowable.
   i.net=0;i.solar=0;i.unknown=C.capacity*q.soc/100;clear();i.soc=q.soc;return;
  }
  const debitEfficiency=e.discharge.usable?e.discharge.eta:C.provisionalDebit;
  // Pending evidence must never survive a mode change into a later SOC correction.
  const mode=controls.idle?'idle':controls.net?'net':controls.on?'solar':'off';
  if(i.mode!==undefined&&i.mode!==mode)clear();
  i.mode=mode;
  if(controls.idle||!controlsKnown)clear();
  if(Math.abs(q.p)<5){
   if(!i.quietSince)i.quietSince=q.t;
   if(q.t-i.quietSince>=C.stopMs)clear();
  }else i.quietSince=null;
  let debit=dis/debitEfficiency;
  for(const k of ['solar','unknown','net']){const used=Math.min(i[k],debit);i[k]-=used;debit-=used;}
  if(dis>0){clear();}
  else{
   let pv=0;
   // Synchronized snapshot-derived PV surplus; mode alone cannot establish origin.
   const provenance=controlsKnown&&!controls.idle&&(controls.on||controls.net)&&finite(solar)&&finite(house)&&solar>=0;
   if(provenance&&q.p>0)pv=Math.max(0,Math.min(1,(solar-house)/q.p));
   const pvEnergy=provenance?ch*pv:0;
   i.pending.solar+=pvEnergy;
   if(provenance)i.pending.net+=ch-pvEnergy;else i.pending.unknown+=ch;
   if(q.soc<i.anchor){clear();}
   else if(q.soc>i.anchor){
    if(!i.candidate)i.candidate={soc:q.soc,since:q.t};
    if(q.soc<i.candidate.soc)i.candidate={soc:q.soc,since:q.t};
    if(q.t-i.candidate.since>=C.socConfirm){
     // Only the level held for 60s is confirmed. A newer higher step waits again.
     const delta=C.capacity*(i.candidate.soc-i.anchor)/100;
     const measured=i.pending.net+i.pending.solar+i.pending.unknown;
     const credit=Math.min(delta,measured); // no gain > measured AC input
     const weights={net:i.pending.net*(e.net.usable?e.net.eta:1),
      solar:i.pending.solar*(e.solar.usable?e.solar.eta:1),unknown:i.pending.unknown};
     const sum=weights.net+weights.solar+weights.unknown;
     if(sum>0)for(const k of ['net','solar','unknown'])i[k]+=credit*weights[k]/sum;
     i.unknown+=Math.max(0,delta-credit);
     // Do not reuse AC evidence for a later SOC increase.
     const confirmed=i.candidate.soc;
     i.pending={net:0,solar:0,unknown:0};i.anchor=confirmed;i.candidate=null;
    }
   }else i.candidate=null;
  }
  cap();i.soc=q.soc;
 }
 let live=false;
 if(snapshotValid){
  const q={t,p,soc};const prev=s.last;
  if(!prev||t>prev.t){
   const continuity=!!prev&&t-prev.t<=C.maxGap&&!s.blocked;
   let ch=0,dis=0;
   if(continuity)[ch,dis]=energy(prev.p,p,t-prev.t);
   if(!continuity){if(s.segment)reject('measurement_gap',s.segment);s.segment=null;s.phase++;}
   if(continuity&&controlsKnown)updateLearning(q,prev,ch,dis);
   else if(!controlsKnown){s.segment=null;s.phase++;}
   e=estimates();inventory(q,ch,dis,continuity);
   s.last=q;s.blocked=false;live=controlsKnown;
  }else live=controlsKnown&&!s.blocked&&t===prev.t;
 }else{
  if(s.segment)reject('invalid_measurement',s.segment);
  s.segment=null;s.blocked=true;
 }
 e=estimates();
 function plan(kind){
  if(e[kind].usable&&e.discharge.usable)return{pct:100*e[kind].eta*e.discharge.eta,status:'measured',usable:true};
  if(e[kind].eta===null||e.discharge.eta===null){
   // Initial seed remains until both directions have actually been learned.
   const expired=[e[kind],e.discharge].some(v=>v.status==='expired'||v.status==='stale');
   return{pct:expired?null:s.seed,status:expired?'stale':'initialized_80',usable:!expired};
  }
  return{pct:null,status:'stale',usable:false};
 }
 const net=plan('net'),pv=plan('solar');
 const i=s.inventory;
 const available=live&&i?Math.max(0,i.solar-C.inventoryReserve):0;
 const sources={version:s.version,at:NOW,valid:live,solar_stored_kwh:i?.solar??0,
  solar_available_kwh:available,net_stored_kwh:i?.net??0,unknown_stored_kwh:i?.unknown??0,
  reserve_kwh:C.inventoryReserve,inventory_debit_method:e.discharge.usable?'learned':'provisional_80_percent',
  source_allocation:'virtual_solar_first',controls};
 const result={version:s.version,valid:net.usable,reason:net.status,eta_plan_net_pct:round(net.pct),
  eta_plan_solar_pct:round(pv.pct),solar_plan_status:pv.status,source_valid:snapshotValid,
  learning_controls_valid:controlsKnown,estimates:e,active_section:s.segment?{kind:s.segment.kind,
   soc_start:s.segment.soc,soc_now:s.segment.endSoc,confirmed:s.segment.confirmed}:null,
  recent_rejections:s.rejected,source_inventory:sources};
 flow.set(KEY,s,FILE);
 flow.set('la_ela_es_mean_7d',round(net.pct),FILE);
 flow.set('batt_eff_plan_solar_pct',round(pv.pct),FILE);
 flow.set('batt_eff_sources_v6',sources,FILE);
 node.status({fill:net.usable?'green':'yellow',shape:net.status==='measured'?'dot':'ring',text:`V6 Entwurf | Netz ${round(net.pct)??'?'}% | ${net.status}`});
 return [{payload:round(net.pct),result},legacy?.[1]??{payload:null},
  {payload:{type:'efficiency_sources_v6',...sources}},{payload:round(net.pct),result}];
}catch(error){
 node.error(`V6 Entwurf: ${error.message}`);
 try{flow.set('la_ela_es_mean_7d',null,FILE);flow.set('batt_eff_sources_v6',{valid:false,at:NOW},FILE);}catch(_){}
 return[{payload:null,result:{valid:false,reason:error.message}},legacy?.[1]??{payload:null},
  {payload:{type:'efficiency_sources_v6',valid:false,at:NOW}},{payload:null,result:{valid:false,reason:error.message}}];
}
