// Offline tests. No Node-RED server, network connection or device command.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const baseDir=path.resolve(__dirname,'..');
const original=new Function('flow','node','msg','Date','RED',fs.readFileSync(path.join(baseDir,'Regler_V4_25_SIM.js'),'utf8'));
const revised=new Function('flow','node','msg','Date','RED',fs.readFileSync(path.join(baseDir,'Regler_V4_25_SIM_DIAG1.js'),'utf8'));
const clone=structuredClone;
const now=1791841503306;
const cycle='1791841502306-344184';
const diagKey='regler_diag_v425_d1';
function seed(){
 const f={regelung:true,netz_laden:false,b_entladen:true,batt_min:false,batt_max:false,
  p_zaehler:40,p_solar:0,p_batterie:-400,p_haus:440,
  p_o_s_in:-5,p_o_b_out:0,p_o_max:15,
  lastChargeW:0,lastDischargeW:400,af_activeDir:2,af_pendingDir:0,
  af_count:0,af_lastSwitchTs:now-60000,regler_dir_richtung:2,
  batt_acMode:2,batt_packState:2,regler_batt_min_confirmed:false,
  snapshot_last_ok_ts:now-700,snapshot_last_ok_cycleId:cycle,
  regler_expected_cycleId:cycle,regler_expected_triggerTs:now-1000,
  snapshot_last_battery_fresh:true,snapshot_last_battery_source:'fresh'};
 f.snapshot_last_diagnostic={state:'ok',ts:now-700,cycleId:cycle,
  values:Object.fromEntries(['p_zaehler','p_batterie','p_solar','p_haus'].map(k=>[k,f[k]]))};
 return f;
}
function invoke(fn,f,{time=now,msg={cycleId:cycle,triggerTs:now-1000},faultKey=null,redFault=false}={}){
 const errors=[],statuses=[];
 class Clock extends Date {static now(){return time;}}
 const flow={get:k=>{if(k===faultKey)throw Error('injected '+k);return f[k];},set:(k,v)=>{f[k]=v;}};
 const RED={util:{cloneMessage:v=>{if(redFault)throw Error('injected clone');return clone(v);}}};
 const output=fn(flow,{status:s=>statuses.push(s),error:(e,m)=>errors.push({e,m})},msg,Clock,RED);
 return {output,errors,statuses};
}
function controlState(f){const copy=clone(f);delete copy[diagKey];return copy;}
function compare(f,options={}){
 const before=clone(f),a=clone(f),b=clone(f);
 const old=invoke(original,a,options),next=invoke(revised,b,options);
 assert.deepEqual(controlState(b),a,'all non-diagnostic flow state must remain identical');
 if(old.output===null){
  assert.deepEqual(next.output.slice(0,3),[null,null,null]);
  assert.equal(next.output[3].payload.execution.controlExecuted,false);
  assert.deepEqual(controlState(b),before,'snapshot skip must not advance any controller state');
 }else{
  assert.deepEqual(next.output.slice(0,3),old.output.slice(0,3),'complete control messages must stay identical');
  const s=clone(next.output[3].payload);
  for(const key of ['execution','diagnosticVersion','diagnosticOnly','inputsValidForControl'])delete s[key];
  assert.deepEqual(s,old.output[3].payload,'existing normal status fields must remain identical');
 }
 assert.equal(next.output.length,4);
 assert.equal(next.output[3].payload.execution.outputEmitted[3],true);
 assert.equal(next.errors.length,0);
 return {next,b};
}
test('normal charge/discharge, PV, full battery, energy-saving and held battery retain all outputs and controller memory',()=>{
 const scenarios=[{},
  {p_solar:450,p_zaehler:-30,p_batterie:200,p_haus:220,af_activeDir:1,regler_dir_richtung:1,lastChargeW:200,lastDischargeW:0,batt_acMode:1},
  {p_solar:1200,p_zaehler:12,p_batterie:650,p_haus:562,af_activeDir:1,regler_dir_richtung:1,lastChargeW:650,lastDischargeW:0,batt_acMode:1},
  {batt_max:true},{b_entladen:false},{batt_min:true},
  {snapshot_last_battery_fresh:false,snapshot_last_battery_source:'held',snapshot_last_battery_hold_age_ms:1900}];
 for(const patch of scenarios)compare({...seed(),...patch});
});
test('snapshot age boundary 0 and 1800 accepted; 1801 and a future timestamp rejected',()=>{
 for(const age of [0,1800,1801,-1]){
  const {next}=compare({...seed(),snapshot_last_ok_ts:now-age});
  assert.equal(next.output[3].payload.execution.controlExecuted,age>=0&&age<=1800);
  if(age===1801)assert.ok(next.output[3].payload.execution.reasons.includes('snapshot_too_old'));
  if(age===-1)assert.ok(next.output[3].payload.execution.reasons.includes('snapshot_timestamp_in_future'));
 }
});
test('missing timestamp, missing expected ID, mismatched cycle and simultaneous age failures stay diagnostic only',()=>{
 const cases=[
  [{snapshot_last_ok_ts:0},undefined,'snapshot_missing'],
  [{regler_expected_cycleId:''},{},'expected_cycle_missing'],
  [{snapshot_last_ok_cycleId:'old'},undefined,'snapshot_cycle_mismatch'],
  [{snapshot_last_ok_cycleId:'old',snapshot_last_ok_ts:now-2001},undefined,'snapshot_too_old']];
 for(const [patch,msg,reason] of cases){
  const {next}=compare({...seed(),...patch},msg?{msg}:{});
  assert.ok(next.output[3].payload.execution.reasons.includes(reason));
  assert.equal(next.output[3].payload.snapshot,null);
  assert.equal(next.output[3].payload.inputs.p_zaehler,null);
  assert.equal(next.output[3].payload.outputs.chargeW,null);
 }
});
test('regulation off and forced grid charge retain their existing snapshot-check exemptions',()=>{
 for(const patch of [{regelung:false},{netz_laden:true},{regelung:false,netz_laden:true}]){
  const {next}=compare({...seed(),...patch,snapshot_last_ok_cycleId:'old',snapshot_last_ok_ts:0});
  assert.equal(next.output[3].payload.execution.controlExecuted,true);
 }
});
test('message cycle remains authoritative; flow fallback and both trigger times are visible',()=>{
 let result=compare({...seed(),regler_expected_cycleId:'newer'},{msg:{cycleId:cycle,triggerTs:123}}).next;
 assert.equal(result.output[3].payload.execution.cycleIdSource,'msg');
 assert.equal(result.output[3].payload.execution.cycleIdFromFlow,'newer');
 assert.equal(result.output[3].payload.execution.triggerTsFromMsg,123);
 result=compare(seed(),{msg:{}}).next;
 assert.equal(result.output[3].payload.execution.cycleIdSource,'flow');
 assert.equal(result.output[3].payload.execution.triggerTsFromFlow,now-1000);
});
test('every received 2-second tick, including consecutive skips and recovery, emits exactly one diagnostic',()=>{
 const f=seed();const outcomes=[];
 for(let i=0;i<5;i++){
  const id='1791841502306-'+(344184+i),time=now+2000*i;
  f.regler_expected_cycleId=id;
  if(i===0||i===4){f.snapshot_last_ok_cycleId=id;f.snapshot_last_ok_ts=time-700;}
  const r=invoke(revised,f,{time,msg:{cycleId:id}}).output;
  assert.equal(r.length,4);assert.ok(r[3].payload);
  const e=r[3].payload.execution;outcomes.push(e.outcome);
  assert.equal(e.invocationSequence,i+1);assert.equal(e.intervalMs,i?2000:null);
 }
 assert.deepEqual(outcomes,['executed','skipped_snapshot','skipped_snapshot','skipped_snapshot','executed']);
 assert.deepEqual(Object.fromEntries(['invocations','executed','skippedSnapshot','errors'].map(k=>[k,f[diagKey][k]])),
  {invocations:5,executed:2,skippedSnapshot:3,errors:0});
});
test('rejection reason, pending inputs and old accepted snapshot remain explicitly labelled observations',()=>{
 const f={...seed(),snapshot_last_ok_cycleId:'previous'};
 f.snapshot_reject_log=[{cycleId:cycle,reason:'latency',maxLatencyMs:451},{cycleId:'other',reason:'spread'}];
 f.snapshot_store={[cycle]:{triggerTs:now-1000,values:{p_zaehler:{value:7,rxTs:now-300}}}};
 const s=compare(f).next.output[3].payload;
 assert.equal(s.measurementAtDecision.rejectionForCycle.maxLatencyMs,451);
 assert.deepEqual(s.measurementAtDecision.missingFreshTopics,['p_solar_s','p_solar_t']);
 assert.equal(s.measurementAtDecision.lastAcceptedSnapshot.cycleId,cycle);
 f.snapshot_store[cycle].values.p_zaehler.value=99;
 assert.equal(s.measurementAtDecision.pendingCycle.values.p_zaehler.value,7,'diagnostic must be frozen');
});
test('synchronous controller error emits no control message, preserves original partial state and reaches Catch',()=>{
 for(const options of [{faultKey:'p_zaehler'},{redFault:true}]){
  const a=seed(),b=seed();
  assert.throws(()=>invoke(original,a,options),/injected/);
  const result=invoke(revised,b,options);
  assert.deepEqual(result.output.slice(0,3),[null,null,null]);
  assert.equal(result.output[3].payload.execution.outcome,'runtime_error');
  assert.equal(result.output[3].payload.retainedControlState.mayBePartiallyUpdated,true);
  assert.equal(result.errors.length,1);
  assert.equal(result.errors[0].m.cycleId,cycle);
  assert.deepEqual(controlState(b),a);
 }
});
test('unavailable diagnostic context cannot alter a successful controller decision',()=>{
 const f=seed();const old=invoke(original,clone(f));
 const next=invoke(revised,f,{faultKey:diagKey});
 assert.deepEqual(next.output.slice(0,3),old.output.slice(0,3));
 assert.equal(next.output[3].payload.execution.diagnosticAccessErrors[0].key,diagKey);
});
test('import remains one function, four outputs and byte-identical function source',()=>{
 const imported=JSON.parse(fs.readFileSync(path.join(baseDir,'NodeRED_Regler_V4_25_SIM_DIAG1_Import.json'),'utf8'));
 assert.equal(imported.length,1);assert.equal(imported[0].outputs,4);
 assert.deepEqual(imported[0].wires,[[],[],[],[]]);
 assert.equal(imported[0].func,fs.readFileSync(path.join(baseDir,'Regler_V4_25_SIM_DIAG1.js'),'utf8'));
});
