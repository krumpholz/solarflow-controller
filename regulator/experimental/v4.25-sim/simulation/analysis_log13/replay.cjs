const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pkg=root+'/analysis_log9/project';
const {seed,tick}=require(pkg+'/analysis_pv_no_shift/runtime.cjs');
const rows=fs.readFileSync(root+'/upload/regler_event_log_13.jsonl','utf8').trim().split('\n').map(JSON.parse);
const files=[root+'/results_regler_log10/Regler_V4_25_SIM.txt',root+'/results_regler_log10/Regler_V4_25_SIM.txt'];
const fn=files.map(p=>new Function('flow','node','msg','Date','RED',fs.readFileSync(p,'utf8')));
const {initial}=require('../analysis_log11/initial.cjs');
const loggedErrors=[],candidateErrors=[],cfgDifferences=[],events=[];let states,resets=0;
for(let i=0;i<rows.length;i++){
 const r=rows[i];if(!i||Number(r.snapshotCycle.regulatorCycleShort)!==Number(rows[i-1].snapshotCycle.regulatorCycleShort)+1){states=[initial(r),initial(r)];resets++;}
 const out=fn.map((f,k)=>tick(f,states[k],r,r.inputs,Math.min(r.ts,r.snapshotCycle.lastOkTs+r.snapshotCycle.ageMs)));if(!out[0])throw Error('Null at row '+i+' ts '+r.ts+' clock '+(r.centerTrim.lastChangeTs+r.centerTrim.ageMs));const s=out[0][3].payload,n=out[1][3].payload;
 const fields=[['chargeW',out[0][1].payload,r.outputs.chargeW],['dischargeW',out[0][2].payload,r.outputs.dischargeW],
 ['direction',out[0][0].payload,r.batteryDirection.payload],['mode',s.mode,r.mode],['hold',s.hold,r.hold],
 ['chargeTrimApplied',s.chargeCenterTrim.applied,r.chargeCenterTrim.applied],['dischargeTrimApplied',s.centerTrim.applied,r.centerTrim.applied],
 ['iCharge',s.integrator.iChargeW,r.integrator.iChargeW],['iDischarge',s.integrator.iDischargeW,r.integrator.iDischargeW]];
 for(const[k,a,b]of fields)if(typeof a==='number'?Math.abs(a-b)>1e-7:a!==b)loggedErrors.push({row:i,key:k,actual:a,logged:b});
 for(const[k,a,b]of [['charge',out[0][1].payload,out[1][1].payload],['discharge',out[0][2].payload,out[1][2].payload],['direction',out[0][0].payload,out[1][0].payload],['mode',s.mode,n.mode],['hold',s.hold,n.hold],['target',s.targets.p_target,n.targets.p_target]])
  if(a!==b)candidateErrors.push({row:i,key:k,baseline:a,candidate:b});
 if(!i)for(const[k,value]of Object.entries(r.cfg))if(JSON.stringify(value)!==JSON.stringify(s.cfg[k]))cfgDifferences.push({key:k,logged:value,source:s.cfg[k]});
 events.push({row:i,chargeW:out[1][1].payload,dischargeW:out[1][2].payload});
}
const result={rows:rows.length,resets,loggedErrors,candidateErrors,cfgDifferences};
fs.writeFileSync(root+'/results_regler_log13/Log13_Replay.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,loggedErrors:loggedErrors.slice(0,20),candidateErrors:candidateErrors.slice(0,10)},null,2));
