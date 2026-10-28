// Replay private live validation logs; no raw household data is published.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sim=path.resolve(process.argv[2]||'.');
const sourcePath=process.argv[3]?path.resolve(process.argv[3]):path.join(root,'Regler_V4_36_SIM_IDLE6_NOPULSE.js');
const {initial}=require(path.join(sim,'analysis_log11/initial.cjs'));
const source=fs.readFileSync(sourcePath,'utf8').replace('const centerTrimNowTs = Date.now();','const centerTrimNowTs = Date.centerNow();').replace('const chargeTrimNowTs = Date.now();','const chargeTrimNowTs = Date.chargeNow();').replace('const zeroIdleNow = Date.now();','const zeroIdleNow = Date.idleNow();');
const fn=new Function('flow','node','msg','Date','RED',source),results=[];
function phase(r,key,mode,out,last,now){const c=r[key];return !c?now:r.logicalMode===mode&&r.outputs[out]===r.controlBase[last]?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
for(const n of [28,29]){
 const rows=fs.readFileSync(path.join(sim,'upload/regler_event_log_'+n+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse),r0=rows[0],z=r0.idleCompensation,now0=r0.execution.enteredTs;
 assert(z.sampleCount>0&&z.lastEvaluationTs<now0);const f=initial({...r0,mode:r0.logicalMode});
 // Both recordings begin part-way through a sampling window: undo only the first appended sample.
 f.regler_idle_compensation_v436={schema:3,phase:'tracking',compensationW:z.estimatedW,startedTs:z.startedTs,settleUntilTs:z.settleUntilTs,lastValidTs:r0.execution.previousEnteredTs,lastEvaluationTs:z.lastEvaluationTs,samples:z.sampleBatteryW.slice(0,-1),lastWindow:z.lastSampleBatteryW,lastSampleCycle:'preceding-cycle',medianBatteryW:z.medianBatteryW,correctionW:z.correctionW,rawCandidateW:z.rawCandidateW,bound:z.bound,initialSource:z.initialSource};
 let executed=0,skipped=0,corrections=0,discharge=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],sc=r.snapshotCycle,now=r.execution.enteredTs,run=r.execution.controlExecuted;
  Object.assign(f,r.thresholds||{},r.meta,r.inputs,{batt_min:r.meta.batt_min_raw,batt_acMode:r.batteryStatus?.batt_acMode??f.batt_acMode,batt_packState:r.batteryStatus?.batt_packState??f.batt_packState,snapshot_last_ok_cycleId:sc.snapshotLastOkCycleId,snapshot_last_ok_ts:sc.lastOkTs,regler_expected_cycleId:sc.regulatorCycleId,regler_expected_triggerTs:r.execution.triggerTsFromFlow,snapshot_last_battery_fresh:r.batteryMeasurement?.fresh??true,snapshot_last_battery_source:r.batteryMeasurement?.source??'fresh'});
  if(!run)Object.assign(f,r.measurementAtDecision.storedInputs);
  const idle=r.idleCompensation;
  const clock={now:()=>now,centerNow:()=>phase(r,'centerTrim','REGEL_ENTLADEN','dischargeW','lastDischargeW',now),chargeNow:()=>phase(r,'chargeCenterTrim','REGEL_LADEN','chargeW','lastChargeW',now),idleNow:()=>idle?.lastEvaluationTs>=now?idle.lastEvaluationTs:idle?.settleUntilTs>=now+7990?idle.settleUntilTs-8000:now};
  const before=f.regler_idle_compensation_v436.compensationW;
  const o=fn({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{},error:e=>{throw e;}},{cycleId:sc.regulatorCycleId},clock,{util:{cloneMessage:structuredClone}});
  if(!run){assert.deepEqual(o.slice(0,3),[null,null,null]);assert.equal(o[3].payload.execution.controlExecuted,false);skipped++;continue;}
  assert.deepEqual({chargeW:o[1].payload,dischargeW:o[2].payload},r.outputs,'powers log'+n+' row'+i);
  assert.equal(o[0]?.payload??null,r.batteryDirection.payload,'direction log'+n+' row'+i);
  assert.equal(o[3].payload.mode,r.mode,'mode log'+n+' row'+i);
  const iz=o[3].payload.idleCompensation;assert.equal(iz.estimatedW,idle.estimatedW);assert.equal(iz.phase,idle.phase);
  if(iz.phase==='tracking'&&iz.estimatedW!==before)corrections++;
  if(o[2].payload>0){discharge++;assert.equal(iz.phase,'inactive');assert.equal(o[1].payload,0);}
  executed++;
 }
 results.push({log:n,records:rows.length,executed,skipped,powerDifferences:0,directionDifferences:0,modeDifferences:0,feedbackCorrections:corrections,normalDischargeInvocations:discharge});
}
const summary={version:'4.36-SIM-IDLE6-NOPULSE with pulse strategy removed',method:'Same-source replay with recorded input and observed trim/idle clock phases. First partial sampling window seeded from recorded diagnostic fields. No fitted plant response or counterfactual actuation.',logs:results,totals:results.reduce((a,r)=>{for(const k of ['records','executed','skipped','feedbackCorrections','normalDischargeInvocations'])a[k]=(a[k]||0)+r[k];return a;},{}),scope:'Idle tracking, small live corrections and permitted discharge handover validated. Ordinary positive PV charging handover is absent from these two logs.'};
fs.writeFileSync(path.join(root,'validation/Logs28_29_Replay.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
