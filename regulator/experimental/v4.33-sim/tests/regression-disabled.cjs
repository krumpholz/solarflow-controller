// Differential replay with private historical logs. Run with optional simulation-root argument.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),simRoot=process.argv[2]?path.resolve(process.argv[2]):path.resolve(root,'../v4.25-sim/simulation');
const {initial}=require(path.join(simRoot,'analysis_log11/initial.cjs'));
const read=p=>fs.readFileSync(p,'utf8');
function instrument(s){return s.replace('const centerTrimNowTs = Date.now();','const centerTrimNowTs = Date.centerNow();').replace('const chargeTrimNowTs = Date.now();','const chargeTrimNowTs = Date.chargeNow();');}
const oldFn=new Function('flow','node','msg','Date','RED',instrument(read(path.resolve(root,'../v4.26-sim/Regler_V4_26_SIM_ZERO1.js'))));
const newFn=new Function('flow','node','msg','Date','RED',instrument(read(path.join(root,'Regler_V4_33_SIM_IDLE3.js')).replace('const zeroIdleCompensationEnabled = true;','const zeroIdleCompensationEnabled = false;')));
function phase(r,key,mode,output,previous,otherwise){const c=r[key];return !c?otherwise:r.mode===mode&&r.outputs[output]===r.controlBase[previous]?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
function state(f){const c=structuredClone(f);delete c.regler_diag_v425_d1;delete c.regler_idle_compensation_v433;return c;}
const result=[];
for(const n of [15,16,17,18,19,20,21,22,23]){
 const rows=read(path.join(simRoot,'upload/regler_event_log_'+n+'.jsonl')).trim().split('\n').map(JSON.parse);
 let a,b,executed=0,skips=0,changed=0,zeros=0,resets=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],sc=r.snapshotCycle,run=r.execution?.controlExecuted!==false;
  const count=r=>Number(r.snapshotCycle.regulatorCycleId.split('-').at(-1));
  const gap=i&&(r.execution?r.execution.invocationSequence!==rows[i-1].execution.invocationSequence+1:count(r)!==count(rows[i-1])+1);
  if(!i||gap){a=initial(r);b=structuredClone(a);resets++;}
  const now=sc.lastOkTs+sc.ageMs;
  const update=f=>{Object.assign(f,r.thresholds||{},r.meta,r.inputs,{batt_min:r.meta.batt_min_raw,batt_acMode:r.batteryStatus?.batt_acMode??f.batt_acMode,batt_packState:r.batteryStatus?.batt_packState??f.batt_packState,snapshot_last_ok_cycleId:sc.snapshotLastOkCycleId,snapshot_last_ok_ts:sc.lastOkTs,regler_expected_cycleId:sc.regulatorCycleId,regler_expected_triggerTs:r.execution?.triggerTsFromFlow,snapshot_last_diagnostic:r.snapshot||r.measurementAtDecision?.lastAcceptedSnapshot,snapshot_last_battery_fresh:r.batteryMeasurement?.fresh??true,snapshot_last_battery_source:r.batteryMeasurement?.source??'fresh'});if(!run)Object.assign(f,r.measurementAtDecision.storedInputs);};
  update(a);update(b);
  const clock={now:()=>now,centerNow:()=>phase(r,'centerTrim','REGEL_ENTLADEN','dischargeW','lastDischargeW',now),chargeNow:()=>phase(r,'chargeCenterTrim','REGEL_LADEN','chargeW','lastChargeW',now)};
  const invoke=(fn,f)=>fn({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{},error:e=>{throw e;}},{cycleId:sc.regulatorCycleId},clock,{util:{cloneMessage:structuredClone}});
  const x=invoke(oldFn,a),y=invoke(newFn,b);assert.deepEqual(state(b),state(a),'unchanged controller state log'+n+' row'+i);
  assert.equal(y.length,4);assert.deepEqual(y[1],x[1]);assert.deepEqual(y[2],x[2]);
  if(!run){skips++;assert.deepEqual(y.slice(0,3),[null,null,null]);assert.equal(y[3].payload.execution.controlExecuted,false);continue;}
  executed++;const sx=x[3].payload,sy=y[3].payload;
  assert.equal(sy.mode,sx.mode);assert.deepEqual(sy.targets,sx.targets);assert.deepEqual(sy.integrator,sx.integrator);
  const zero=['REGEL_LADEN','REGEL_ENTLADEN','NETZ_LADEN'].includes(sx.mode)&&x[1].payload===0&&x[2].payload===0;
  assert.equal(sy.zeroPowerIdle.active,zero);if(zero)zeros++;
  assert.equal(y[0]?.payload??null,zero?1:x[0]?.payload??null);
  if((y[0]?.payload??null)!==(x[0]?.payload??null)){changed++;assert.equal(sx.mode,'REGEL_ENTLADEN');assert.equal(x[2].payload,0);}
 }
 result.push({log:n,records:rows.length,executed,skips,resets,zeroDemandInvocations:zeros,changedDirectionInvocations:changed,powerAndStateDifferences:0});
}
const summary={baseline:'V4.26-SIM-ZERO1',candidate:'V4.33-SIM-IDLE3 with pulse disabled',method:'Differential replay: same frozen measured inputs and observed trim clock phases. Not a closed-loop hardware forecast.',logs:result,total:result.reduce((s,r)=>{for(const k of ['records','executed','skips','zeroDemandInvocations','changedDirectionInvocations'])s[k]=(s[k]||0)+r[k];return s;},{}),hardwareValidation:'Pulse enabled behaviour tested separately with synthetic sequences. Real device response remains pending. Disabling the pulse reproduces ZERO1 power and direction behaviour.'};
fs.writeFileSync(path.join(root,'validation/ZeroPulse_Disabled_Regression.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
