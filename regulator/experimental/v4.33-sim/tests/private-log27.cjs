// Private input log required; publish aggregate validation only. Exclude the old forced-zero probe.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sim=path.resolve(process.argv[2]||'.');
const {initial}=require(path.join(sim,'analysis_log11/initial.cjs'));
const all=fs.readFileSync(path.join(sim,'upload/regler_event_log_27.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const probe=all.findIndex(r=>r.idleCompensation?.probeReason==='periodic_10min'&&r.idleCompensation.phase==='probe');
assert(probe>0);const rows=all.slice(0,probe);
const source=fs.readFileSync(path.join(root,'Regler_V4_33_SIM_IDLE3.js'),'utf8').replace('const centerTrimNowTs = Date.now();','const centerTrimNowTs = Date.centerNow();').replace('const chargeTrimNowTs = Date.now();','const chargeTrimNowTs = Date.chargeNow();');
const fn=new Function('flow','node','msg','Date','RED',source),f=initial({...rows[0],mode:rows[0].logicalMode});
f.regler_idle_compensation_v432={schema:2,phase:'compensate',compensationW:18,preparedChargeW:18,preparedDischargeW:0,preparedTs:rows[0].execution.enteredTs-2000};
function phase(r,key,mode,out,last,now){const c=r[key];return !c?now:r.logicalMode===mode&&r.outputs[out]===r.controlBase[last]?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
let executed=0,skipped=0;
for(const r of rows){const sc=r.snapshotCycle,now=r.execution.enteredTs,run=r.execution.controlExecuted;
 Object.assign(f,r.thresholds||{},r.meta,r.inputs,{batt_min:r.meta.batt_min_raw,batt_acMode:r.batteryStatus?.batt_acMode??f.batt_acMode,batt_packState:r.batteryStatus?.batt_packState??f.batt_packState,snapshot_last_ok_cycleId:sc.snapshotLastOkCycleId,snapshot_last_ok_ts:sc.lastOkTs,regler_expected_cycleId:sc.regulatorCycleId,regler_expected_triggerTs:r.execution.triggerTsFromFlow,snapshot_last_battery_fresh:r.batteryMeasurement?.fresh??true,snapshot_last_battery_source:r.batteryMeasurement?.source??'fresh'});
 if(!run)Object.assign(f,r.measurementAtDecision.storedInputs);
 const clock={now:()=>now,centerNow:()=>phase(r,'centerTrim','REGEL_ENTLADEN','dischargeW','lastDischargeW',now),chargeNow:()=>phase(r,'chargeCenterTrim','REGEL_LADEN','chargeW','lastChargeW',now)};
 const o=fn({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{},error:e=>{throw e;}},{cycleId:sc.regulatorCycleId},clock,{util:{cloneMessage:structuredClone}});
 if(!run){assert.deepEqual(o.slice(0,3),[null,null,null]);skipped++;continue;}
 assert.equal(o[1].payload,18);assert.equal(o[2].payload,0);assert.equal(o[0].payload,1);assert.equal(o[3].payload.mode,'RUHEKOMPENSATION');assert.equal(f.lastChargeW,0);executed++;
}
const result={log:27,candidate:'4.33-SIM-IDLE3',records:rows.length,executed,skipped,powerDifferences:0,scope:'Recorded steady compensation section before the old periodic zero probe. Fresh IDLE2 state transferred. All measured battery feedback0W; emitted power remains identical.',excludedFromRow:probe,limitation:'The forced-zero probe and subsequent affected feedback cannot be treated as input to unchanged18W actuation. New drift correction is tested separately with synthetic plants.',hardwareValidation:'Candidate itself not yet deployed.'};
fs.writeFileSync(path.join(root,'validation/Log27_Steady_Replay.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
