// Execute the complete Node-RED Function with the logged input schema.
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
function clock(r){
 const c=r.centerTrim;
 if(!c)return r.ts;
 return r.mode==='REGEL_ENTLADEN'&&r.outputs.dischargeW===r.controlBase.lastDischargeW
   ?c.lastChangeTs+c.ageMs:c.lastChangeTs;
}
function seed(r){
 const f={...r.thresholds,...r.meta};
 const d=r.loadStepDetection.delta,x=r.inputs;
 let previousI=r.integrator.iChargeW;
 if(r.mode==='REGEL_LADEN'&&!r.hold){
  const p=r.chargeParams.active;
  if(Math.abs(r.err.err)>=p.iErrMinWCharge)
    previousI=Math.max(0,previousI-p.iGainCharge*r.err.err);
  else if(p.iDecayHoldCharge>0)previousI/=p.iDecayHoldCharge;
 }else if(r.mode==='REGEL_LADEN'&&r.hold)previousI/=r.cfg.iDecayHoldCharge;
 Object.assign(f,{
  lastChargeW:r.controlBase.lastChargeW,lastDischargeW:r.controlBase.lastDischargeW,
  iChargeW:previousI,iDischargeW:r.integrator.iDischargeW,
  af_activeDir:r.antiflip.activeDir,af_pendingDir:0,af_count:0,af_lastSwitchTs:r.antiflip.lastSwitchTs,
  regler_dir_richtung:r.directionDecision.storedDir,regler_dir_pendingDir:0,regler_dir_pendingCnt:0,
  holdEntryCountCharge:r.holdDebug?.mode==='charge'&&r.holdDebug.eligible?Math.max(0,r.holdDebug.entryCountCharge-1):0,
  holdEntryCountDischarge:r.holdDebug?.mode==='discharge'&&r.holdDebug.eligible?Math.max(0,r.holdDebug.entryCountDischarge-1):0,
  loadStep_prev_p_zaehler:x.p_zaehler-d.dZ,loadStep_prev_p_solar:x.p_solar-d.dSolar,
  loadStep_prev_p_batterie:x.p_batterie-d.dBatt,loadStep_prev_battery_fresh:true,
  loadStep_prev_sollSigned:r.controlBase.lastChargeW-r.controlBase.lastDischargeW,
  loadStep_prev2_sollSigned:r.controlBase.lastChargeW-r.controlBase.lastDischargeW-d.dSoll,
  pvFollow_prev_p_solar:x.p_solar-r.pvFollowGuard.solar.dSolar,
  regler_center_trim_last_change_ts:clock(r)-(r.centerTrim?.ageMs??0),
 });
 if(r.chargeCenterTrim){f.regler_charge_trim_last_change_ts=r.ts-r.chargeCenterTrim.ageMs;f.regler_charge_trim_stable_count=0;f.regler_charge_trim_pv_class=r.pvFollowGuard.pvClass;}
 return f;
}
function compile(file='Regler_V4_23_SIM.js',constants={},transform=null){
 let code=fs.readFileSync(path.resolve(ROOT,file),'utf8');
 for(const [k,v]of Object.entries(constants)){
  const re=new RegExp('(const '+k+' = )[^;]+;');
  if(!re.test(code))throw Error('Unknown constant '+k);
  code=code.replace(re,(_,p)=>p+JSON.stringify(v)+';');
 }
 if(transform)code=transform(code);
 return {code,fn:new Function('flow','node','msg','Date',code)};
}
function tick(ctrl,f,r,inputs=r.inputs,options={}){
 const now=options.now??clock(r);
 Object.assign(f,r.thresholds,{netz_laden:r.meta.netz_laden,regelung:r.meta.regelung,
  b_entladen:r.meta.b_entladen,batt_min:r.meta.batt_min_raw,batt_max:r.meta.batt_max},inputs,{
  batt_acMode:r.batteryStatus.batt_acMode,batt_packState:r.batteryStatus.batt_packState,
  snapshot_last_battery_fresh:options.fresh??r.batteryMeasurement.fresh,
  snapshot_last_battery_source:options.fresh===false?'held':r.batteryMeasurement.source,
  snapshot_last_ok_ts:options.snapshotTs??r.snapshotCycle.lastOkTs,
  snapshot_last_ok_cycleId:options.cycle??String(r.ts)
 });
 return ctrl.fn({get:k=>f[k],set:(k,v)=>{f[k]=v;}},{status:()=>{}},
  {cycleId:String(r.ts)},{now:()=>now});
}
module.exports={ROOT,clock,seed,compile,tick};
