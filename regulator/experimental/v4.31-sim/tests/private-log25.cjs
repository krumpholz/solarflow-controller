// Requires private Log25 and previous controller source; publishes only aggregate validation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sim=path.resolve(process.argv[2]||'.');
const {initial}=require(path.join(sim,'analysis_log11/initial.cjs'));
const rows=fs.readFileSync(path.join(sim,'upload/regler_event_log_25.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
function instrument(s){return s.replace('const centerTrimNowTs = Date.now();','const centerTrimNowTs = Date.centerNow();').replace('const chargeTrimNowTs = Date.now();','const chargeTrimNowTs = Date.chargeNow();');}
const oldPath=process.argv[3]?path.resolve(process.argv[3]):path.resolve(root,'../v4.30-sim/Regler_V4_30_SIM_ZERO5_TEST.js');
const oldFn=new Function('flow','node','msg','Date','RED',instrument(fs.readFileSync(oldPath,'utf8'))),newFn=new Function('flow','node','msg','Date','RED',instrument(fs.readFileSync(path.join(root,'Regler_V4_31_SIM_ZERO6_TEST.js'),'utf8')));
let a=initial(rows[0]),b=structuredClone(a),differences=0,firstDifference=null,oldExact=0,candidateActive=0;
function phase(r,key,mode,out,last,now){const c=r[key];return !c?now:r.mode===mode&&r.outputs[out]===r.controlBase[last]?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
for(let i=0;i<rows.length;i++){
 const r=rows[i],sc=r.snapshotCycle,now=r.execution.enteredTs;
 for(const f of [a,b])Object.assign(f,r.thresholds,r.meta,r.inputs,{batt_min:r.meta.batt_min_raw,batt_acMode:r.batteryStatus.batt_acMode,batt_packState:r.batteryStatus.batt_packState,snapshot_last_ok_cycleId:sc.snapshotLastOkCycleId,snapshot_last_ok_ts:sc.lastOkTs,regler_expected_cycleId:sc.regulatorCycleId,regler_expected_triggerTs:r.execution.triggerTsFromFlow,snapshot_last_battery_fresh:r.batteryMeasurement.fresh,snapshot_last_battery_source:r.batteryMeasurement.source});
 const clock={now:()=>now,centerNow:()=>phase(r,'centerTrim','REGEL_ENTLADEN','dischargeW','lastDischargeW',now),chargeNow:()=>phase(r,'chargeCenterTrim','REGEL_LADEN','chargeW','lastChargeW',now)};
 const run=(fn,f)=>fn({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{},error:e=>{throw e;}},{cycleId:sc.regulatorCycleId},clock,{util:{cloneMessage:structuredClone}});
 const x=run(oldFn,a),y=run(newFn,b);
 assert.deepEqual({chargeW:x[1].payload,dischargeW:x[2].payload},r.outputs,'baseline row'+i);oldExact++;
 if(x[1].payload!==y[1].payload||x[2].payload!==y[2].payload){differences++;firstDifference??=i;}
 if(y[3].payload.zeroPowerIdle.pulseActive)candidateActive++;
 if(i>=15){assert.equal(y[1].payload,23);assert.equal(y[2].payload,0);assert.equal(y[3].payload.zeroPowerIdle.pulsePhase,'pulse');}
}
const result={log:25,records:rows.length,baseline:'4.30-SIM-ZERO5-TEST',candidate:'4.31-SIM-ZERO6-TEST',baselineExactPowerReproductions:oldExact,changedPowerInvocations:differences,firstChangedRow:firstDifference,candidatePulseInvocations:candidateActive,method:'Open-loop replay of recorded inputs. Candidate keeps23W on recorded feedback; this does not predict actual battery/PackState response after altered actuation.',hardwareValidated:false};
fs.writeFileSync(path.join(root,'validation/Log25_Replay.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
