const path=require('path');const root=path.resolve(__dirname,'..');const {seed,tick}=require(root+'/analysis_log9/project/analysis_pv_no_shift/runtime.cjs');
function initial(r){const f=seed(r);if(r.directionDecision.pendingDir)f.regler_dir_pendingCnt=Math.max(0,r.directionDecision.pendingCnt-1);if(r.antiflip.pendingDir && !r.antiflip.switchedThisTick)f.af_count=Math.max(0,r.antiflip.count-1);
 if(r.mode==='REGEL_ENTLADEN'){
  const pv=r.inputs.p_solar>=300?'PV':'',err=r.inputs.p_zaehler-r.targets.p_target;
  const decay=r.cfg['iDecayHoldDischarge'+pv];
  f.iDischargeW=r.holdDebug.confirmed||Math.abs(err)<r.cfg['iErrMinWDischarge'+pv]
   ? r.integrator.iDischargeW/decay : Math.max(0,r.integrator.iDischargeW-r.cfg['iGainDischarge'+pv]*err);
 }
 if(r.mode==='REGEL_LADEN'){
  let I=r.integrator.iChargeW;
  if(r.holdDebug.confirmed)I/=r.cfg.iDecayHoldCharge;
  else{
   const side=(r.inputs.p_solar>=720?r.chargeParams.sideHysteresis.after==='import':r.inputs.p_zaehler>r.effectiveWindows.charge.p_o_max_eff)?'Import':'Export';const cls=r.inputs.p_solar>=1050?'VeryHighPV':r.inputs.p_solar>=720?'HighPV':r.inputs.p_solar<280&&side==='Export'?'LowPV':'';const k=side+cls;
   const g=r.cfg['iGainCharge'+k],min=r.cfg['iErrMinWCharge'+k],decay=r.cfg['iDecayHoldCharge'+k];
   const err=r.targets.p_target-r.inputs.p_zaehler-(r.highPvControl?.pvTrend?.advanceW||0);
   I=Math.abs(err)>=min?Math.max(0,I-g*err):I/decay;
  }
  f.iChargeW=I;
  f.regler_charge_trim_pv_class=r.chargeCenterTrim.classStable?(r.inputs.p_solar>=1050?'veryhighpv':r.inputs.p_solar>=720?'highpv':'normal'):null;
 }
 return f;
}

module.exports={initial,tick};
