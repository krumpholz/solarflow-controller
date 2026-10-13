const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=root+'/results_regler_log15_16';
const {initial}=require(root+'/analysis_log11/initial.cjs');
const source=require('./source.cjs').source.replace('const centerTrimNowTs = Date.now();','const centerTrimNowTs = Date.centerNow();').replace('const chargeTrimNowTs = Date.now();','const chargeTrimNowTs = Date.chargeNow();');
// Only replay uses observed intra-invocation clock phases, never command/output overrides.
function phaseTime(r,key,mode,output,previous,otherwise){const c=r[key];return !c?otherwise:r.mode===mode&&r.outputs[output]===r.controlBase[previous]?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
const fn=new Function('flow','node','msg','Date','RED',source),results=[];
for(const n of [15,16]){
 const rows=fs.readFileSync(root+'/upload/regler_event_log_'+n+'.jsonl','utf8').trim().split('\n').map(JSON.parse);
 let f;const differences=[];let resets=0,skips=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],run=r.execution?.controlExecuted!==false;
  if(!i||(+r.snapshotCycle.regulatorCycleShort!==+rows[i-1].snapshotCycle.regulatorCycleShort+1)) {f=initial(r);resets++;}
  const sc=r.snapshotCycle;
  const now=sc.lastOkTs+sc.ageMs;
  Object.assign(f,r.thresholds||{},r.meta,{...r.inputs},
    {batt_min:r.meta.batt_min_raw,batt_acMode:r.batteryStatus?.batt_acMode??f.batt_acMode,batt_packState:r.batteryStatus?.batt_packState??f.batt_packState,
     snapshot_last_ok_cycleId:sc.snapshotLastOkCycleId,snapshot_last_ok_ts:sc.lastOkTs,
     regler_expected_cycleId:sc.regulatorCycleId,regler_expected_triggerTs:r.execution?.triggerTsFromFlow,
     snapshot_last_diagnostic:r.snapshot||r.measurementAtDecision?.lastAcceptedSnapshot,
     snapshot_last_battery_fresh:r.batteryMeasurement?.fresh??true,snapshot_last_battery_source:r.batteryMeasurement?.source??'fresh'});
  if(!run)Object.assign(f,r.measurementAtDecision.storedInputs);
  const output=fn({get:k=>f[k],set:(k,v)=>{f[k]=v;}},{status:()=>{},error:e=>{throw e;}},{cycleId:sc.regulatorCycleId},{now:()=>now,centerNow:()=>phaseTime(r,'centerTrim','REGEL_ENTLADEN','dischargeW','lastDischargeW',now),chargeNow:()=>phaseTime(r,'chargeCenterTrim','REGEL_LADEN','chargeW','lastChargeW',now)},{util:{cloneMessage:structuredClone}});
  const s=output[3].payload;
  if(!run){skips++;if(output.slice(0,3).some(x=>x!==null))differences.push({row:i,key:'unexpected control'});continue;}
  for(const [key,a,b]of [
   ['charge',output[1].payload,r.outputs.chargeW],['discharge',output[2].payload,r.outputs.dischargeW],
   ['direction',output[0]?.payload??null,r.batteryDirection.sendsOutput?r.batteryDirection.payload:null],
   ['mode',s.mode,r.mode],['target',s.targets.p_target,r.targets.p_target],
   ['iCharge',s.integrator.iChargeW,r.integrator.iChargeW],['iDischarge',s.integrator.iDischargeW,r.integrator.iDischargeW]]){
   if(typeof a==='number'&&typeof b==='number'?Math.abs(a-b)>1e-7:a!==b)differences.push({row:i,key,actual:a,logged:b});
  }
 }
 results.push({log:n,records:rows.length,executed:rows.length-skips,skips,resets,differences});
}
fs.writeFileSync(out+'/Log15_16_Replay.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({...r,differences:r.differences.slice(0,12),differenceCount:r.differences.length})),null,2));
