// Offline complete Node-RED Function execution, without network or BLE calls.
const fs=require('node:fs');
function clock(r){const c=r.centerTrim;return !c?r.ts:r.mode==='REGEL_ENTLADEN'&&r.outputs.dischargeW===r.controlBase.lastDischargeW?c.lastChangeTs+c.ageMs:c.lastChangeTs;}
function seed(r){
 const f={...r.thresholds,...r.meta},x=r.inputs,d=r.loadStepDetection.delta;
 let I=r.integrator.iChargeW;
 const p=r.chargeParams?.active;
 if(r.mode==='REGEL_LADEN'){
  if(r.hold)I/=r.cfg.iDecayHoldCharge;
  else if(p?.iGainCharge>0&&Math.abs(r.err.err)>=p.iErrMinWCharge)I=Math.max(0,I-p.iGainCharge*r.err.err);
  else if(p?.iDecayHoldCharge>0)I/=p.iDecayHoldCharge;
 }
 Object.assign(f,{lastChargeW:r.controlBase.lastChargeW,lastDischargeW:r.controlBase.lastDischargeW,
  iChargeW:I,iDischargeW:r.integrator.iDischargeW,
  af_activeDir:r.antiflip.activeDir,af_pendingDir:r.antiflip.pendingDir,af_count:r.antiflip.count,
  af_lastSwitchTs:r.antiflip.lastSwitchTs,regler_dir_richtung:r.directionDecision.storedDir,
  regler_dir_pendingDir:r.directionDecision.pendingDir||0,regler_dir_pendingCnt:r.directionDecision.pendingCount||0,
  holdEntryCountCharge:r.holdDebug?.mode==='charge'&&r.holdDebug.eligible?Math.max(0,r.holdDebug.entryCountCharge-1):0,
  holdEntryCountDischarge:r.holdDebug?.mode==='discharge'&&r.holdDebug.eligible?Math.max(0,r.holdDebug.entryCountDischarge-1):0,
  loadStep_prev_p_zaehler:x.p_zaehler-d.dZ,loadStep_prev_p_solar:x.p_solar-d.dSolar,
  loadStep_prev_p_batterie:x.p_batterie-d.dBatt,loadStep_prev_battery_fresh:true,
  loadStep_prev_sollSigned:r.controlBase.lastChargeW-r.controlBase.lastDischargeW,
  loadStep_prev2_sollSigned:r.controlBase.lastChargeW-r.controlBase.lastDischargeW-d.dSoll,
  pvFollow_prev_p_solar:x.p_solar-r.pvFollowGuard.solar.dSolar,
  lastChargeSideHV:r.chargeParams?.sideHysteresis?.before||'none',
  regler_center_trim_last_change_ts:clock(r)-(r.centerTrim?.ageMs??0),
  regler_charge_trim_last_change_ts:clock(r)-(r.chargeCenterTrim?.ageMs??0),
  regler_charge_trim_stable_count:Math.max(0,(r.chargeCenterTrim?.stableCount??0)-1),
  regler_charge_trim_pv_class:r.inputs.p_solar>=1050?'veryhighpv':r.inputs.p_solar>=720?'highpv':'normal',
  pvFollowGuardCnt:Math.max(0,(r.pvFollowGuard?.count??0)-1),
  pvFollowFallLatchCnt:r.pvFollowGuard?.fallLatchCnt??0,
  pvFollowFallKeepWasActive:r.pvFollowGuard?.fallKeepActive??false});
 if(r.version==='4.23-SIM'&&!String(r.snapshotCycle.regulatorCycleId).startsWith('sim-')&&r.mode==='REGEL_LADEN'){
  if(r.holdDebug.confirmed)f.iChargeW=r.integrator.iChargeW/r.cfg.iDecayHoldCharge;
  else {const side=r.chargeParams.sideHysteresis.after==='import'?'Import':'Export';
   const cls=r.inputs.p_solar>=1050?'VeryHighPV':r.inputs.p_solar>=720?'HighPV':r.inputs.p_solar<280&&side==='Export'?'LowPV':'';
   const k=side+cls,e=r.targets.p_target-r.inputs.p_zaehler;
   f.iChargeW=Math.abs(e)>=r.cfg['iErrMinWCharge'+k]?Math.max(0,r.integrator.iChargeW-r.cfg['iGainCharge'+k]*e):r.integrator.iChargeW/r.cfg['iDecayHoldCharge'+k];}
  if(!r.chargeCenterTrim.classStable)f.regler_charge_trim_pv_class=null;
 }
 return f;
}
function tick(fn,f,r,inputs=r.inputs,now=clock(r)){
 const cycle=r.snapshotCycle.regulatorCycleId;
 Object.assign(f,r.thresholds,{netz_laden:r.meta.netz_laden,regelung:r.meta.regelung,
  b_entladen:r.meta.b_entladen,batt_min:r.meta.batt_min_raw,batt_max:r.meta.batt_max},inputs,{
  batt_acMode:r.batteryStatus.batt_acMode,batt_packState:r.batteryStatus.batt_packState,
  snapshot_last_battery_fresh:r.batteryMeasurement.fresh,
  snapshot_last_battery_source:r.batteryMeasurement.source,
  snapshot_last_ok_ts:r.snapshotCycle.lastOkTs,snapshot_last_ok_cycleId:cycle,
  snapshot_last_diagnostic:{state:'ok',cycleId:cycle,ts:r.snapshotCycle.lastOkTs,values:inputs}});
 return fn({get:k=>f[k],set:(k,v)=>{f[k]=v;}},{status:()=>{}},{cycleId:cycle},{now:()=>now},
  {util:{cloneMessage:v=>structuredClone(v)}});
}
module.exports={clock,seed,tick};
