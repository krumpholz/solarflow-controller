// Conditional closed-loop study. Full regulator function; no live IO.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=root+'/results_regler_log17_20';
const {source}=require('../analysis_log15_16/source.cjs');
const {initial}=require(root+'/analysis_log11/initial.cjs');
const {advance}=require(root+'/analysis_log9/project/analysis_pv_no_shift/plant.cjs');
const modelPath=[path.resolve(root,'../Regler_Modell_V14.json'),root+'/results_regler_log15_16/Regler_Modell_V14.json'].find(p=>fs.existsSync(p));
const model=JSON.parse(fs.readFileSync(modelPath));
const logs=Object.fromEntries([8,9,11,15,16,17,18,19,20].map(n=>[n,fs.readFileSync(root+'/upload/regler_event_log_'+n+'.jsonl','utf8').trim().split('\n').map(JSON.parse)]));
const valid=r=>r.execution?.controlExecuted!==false;
const clock=r=>(r.execution?.enteredTs??(r.snapshotCycle.lastOkTs+r.snapshotCycle.ageMs))/1000;
const sampleClock=(r,key)=>(r.snapshot?.rxTsByTopic?.[key]??r.snapshotCycle.lastOkTs)/1000;
const candidates=[
 {name:'baseline',constants:{}},
 {name:'trim2_10',constants:{highPvTrimMaxStepW:2}},
 {name:'trim2_6',constants:{highPvTrimMaxStepW:2,highPvTrimWaitMs:6000}},
 {name:'trim3_10',constants:{highPvTrimMaxStepW:3}},
 {name:'ramp30',constants:{stepUpChargeHighPVW:30}},
 {name:'ramp40',constants:{stepUpChargeHighPVW:40}},
 {name:'ramp60',constants:{stepUpChargeHighPVW:60}},
 {name:'lead1_5',constants:{highPvFallLeadTicks:1.5}},
 {name:'lead3_5',constants:{highPvFallLeadTicks:3.5}},
 {name:'ramp40_trim2',constants:{stepUpChargeHighPVW:40,highPvTrimMaxStepW:2}},
 {name:'exportP_7',constants:{errGainChargeExportHighPV:.7,errGainChargeExportVeryHighPV:.7}},
 {name:'adaptiveRamp60',constants:{},adaptive:true},
 {name:'fallCap_05',constants:{},fallCap:.5},
 {name:'fallCap_1',constants:{},fallCap:1},
 {name:'ramp30_fallCap1',constants:{stepUpChargeHighPVW:30},fallCap:1},
 {name:'trim3_fallCap1',constants:{highPvTrimMaxStepW:3},fallCap:1}
];
function code(v){let s=source;for(const [k,value] of Object.entries(v.constants||{})){const re=new RegExp('(const '+k+' = )[^;]+;');if(!re.test(s))throw Error('Missing constant '+k);s=s.replace(re,(_,p)=>p+value+';');}
 if(v.adaptive){const old='? stepUpChargeHighPVW : stepUpChargeW';if(!s.includes(old))throw Error('Missing ramp expression');s=s.replace(old,'? ((p_zaehler < -150 && snapshotBatteryFresh && loadStepBatteryDeltaValid && loadStep_dSolar >= 0 && Math.abs(loadStep_dLoadEst) <= 25) ? 60 : stepUpChargeHighPVW) : stepUpChargeW');}
 if(v.fallCap)s=s.replace('// Runden + Speichern', `// Experimental final demand ceiling for a measured PV decline.
if (mode === "REGEL_LADEN" && highPvExportEdgeActive && snapshotBatteryFresh && batt_acMode === 1 && loadStepHavePrev && loadStepBatteryDeltaValid && lastChargeW > holdMinActiveW && loadStep_dSolar < -4 && p_zaehler - loadStep_dSolar > p_target) {
 const reduction = Math.min(stepDownChargeActiveW, Math.max(0, -loadStep_dSolar + p_zaehler - p_target) * ${v.fallCap});
 chargeW = Math.min(chargeW, Math.max(0, lastChargeW - reduction));
}
// Runden + Speichern`);
 return s;
}
const functions=candidates.map(v=>new Function('flow','node','msg','Date','RED',code(v)));
class SignedPlant {
 constructor(r,env,physical=false){this.env=env;this.physical=physical;this.at=sampleClock(r,physical?'p_zaehler':'p_batterie');this.y=r.inputs.p_batterie;this.q=[];this.last=-Infinity;this.dir=r.batteryStatus.batt_acMode===1?1:2;this.u=this.dir===1?r.controlBase.lastChargeW:r.controlBase.lastDischargeW;this.configure(this.dir,this.u);if(!this.u&&physical)this.y=env.idle;}
 configure(dir,u){this.dir=dir;this.m={...(this.physical&&this.env.gridPath==='fast'?(dir===1?model.charging.grid:model.discharging.grid):(dir===1?(this.env.chargeModel||model.charging.battery):model.discharging.battery))};this.sign=dir===1?1:-1;this.target=u && !(dir===1 && u<(this.env.minCharge||0))?this.sign*Math.max(0,this.m.gain*u+this.m.bias):(this.physical?this.env.idle:-19);}
 evolve(t){const dt=Math.max(0,t-this.at);this.y=this.sign*advance(this.sign*this.y,this.sign*this.target,dt,this.m);this.at=t;}
 sample(t){while(this.q.length&&this.q[0].t<=t){const e=this.q.shift();this.evolve(e.t);this.configure(e.dir,e.u);}this.evolve(t);return this.y;}
 command(t,dir,u){if(dir===this.cmdDir&&u===this.cmdU)return;const old=this.cmdU??this.u;const m=this.physical&&this.env.gridPath==='fast'?(dir===1?model.charging.grid:model.discharging.grid):(dir===1?(this.env.chargeModel||model.charging.battery):model.discharging.battery);const at=Math.max(t+(dir===1?0:.074)+(u>old?m.delay_up:m.delay_down)*this.env.delay,this.last+1e-6);this.q.push({t:at,dir,u});this.last=at;this.cmdDir=dir;this.cmdU=u;}
}
function reconstruct(rows,env){let b,g;return rows.map((r,i)=>{if(!valid(r))return null;if(!i||(!r.execution&&+r.snapshotCycle.regulatorCycleShort!==+rows[i-1].snapshotCycle.regulatorCycleShort+1)){b=new SignedPlant(r,env);g=new SignedPlant(r,env,true);}
 const bp=b.sample(sampleClock(r,'p_batterie')),gp=g.sample(sampleClock(r,'p_zaehler'));
 const dir=r.mode==='REGEL_LADEN'?1:2,u=dir===1?r.outputs.chargeW:r.outputs.dischargeW;b.command(clock(r),dir,u);g.command(clock(r),dir,u);
 return {net:r.inputs.p_zaehler-gp,residual:r.inputs.p_batterie-bp};});}
function run(rows,env,ci,forcing=null){let f,b,g,lastDir,readback,pending=[],trace=[],resets=0;
 for(let i=0;i<rows.length;i++){const r=rows[i],now=clock(r)*1000;
  if(!i||(!r.execution&&+r.snapshotCycle.regulatorCycleShort!==+rows[i-1].snapshotCycle.regulatorCycleShort+1)){f=initial(r);b=new SignedPlant(r,env);g=new SignedPlant(r,env,true);lastDir=r.batteryStatus.batt_acMode;readback=lastDir;pending=[];resets++;}
  if(!valid(r)){continue;} // Known skip: no controller/commands. Plant queues keep evolving.
  while(pending.length&&pending[0].t<=now)readback=pending.shift().dir;
  const B=b.sample(sampleClock(r,'p_batterie'))+(forcing&&env.residual?forcing[i].residual:0);
  const physical=g.sample(sampleClock(r,'p_zaehler'));
  const net=forcing?forcing[i].net:r.inputs.p_zaehler-r.inputs.p_batterie;
  const z=net+physical,pv=r.inputs.p_solar;
  const inputs={p_zaehler:Math.round(z),p_batterie:Math.round(B),p_solar:pv,p_haus:Math.round(pv+z-B)};
  const cycle=r.snapshotCycle.regulatorCycleId;
  Object.assign(f,r.thresholds,{regelung:r.meta.regelung,netz_laden:r.meta.netz_laden,b_entladen:r.meta.b_entladen,batt_min:r.meta.batt_min_raw,batt_max:r.meta.batt_max},inputs,{batt_acMode:readback,batt_packState:readback===1?1:2,snapshot_last_battery_fresh:true,snapshot_last_battery_source:'fresh',snapshot_last_ok_ts:r.snapshotCycle.lastOkTs,snapshot_last_ok_cycleId:cycle,regler_expected_cycleId:cycle,snapshot_last_diagnostic:{state:'ok',cycleId:cycle,ts:r.snapshotCycle.lastOkTs,values:inputs}});
  const output=functions[ci]({get:k=>f[k],set:(k,v)=>{f[k]=v;}},{status:()=>{},error:e=>{throw e;}},{cycleId:cycle},{now:()=>now},{util:{cloneMessage:structuredClone}});
  const s=output[3].payload;if(s.execution.controlExecuted===false)throw Error('Unexpected simulated skip');
  const dir=s.mode==='REGEL_LADEN'?1:2,u=dir===1?output[1].payload:output[2].payload;
  if(dir!==lastDir){pending.push({t:now+env.readback*1000,dir});lastDir=dir;}
  b.command(now/1000,dir,u);g.command(now/1000,dir,u);
  trace.push({i,t:(now-clock(rows[0])*1000)/1000,z,B,pv,u,dir,target:s.targets.p_target,lo:dir===1?s.effectiveWindows.charge.p_o_s_in_eff:s.effectiveWindows.discharge.p_o_b_out_eff,hi:dir===1?s.effectiveWindows.charge.p_o_max_eff:s.effectiveWindows.discharge.p_o_max_eff});
 }
 return trace;
}
function score(trace,predicate=x=>x.t>=30){let duration=0,mae=0,inside=0,importWh=0,exportWh=0,min=Infinity,max=-Infinity,changes=0,flips=0,positive=0,above15=0;
 for(let i=0;i<trace.length-1;i++){const x=trace[i],y=trace[i+1];if(!predicate(x))continue;const dt=y.t-x.t;if(y.i!==x.i+1)continue;duration+=dt;mae+=dt*Math.abs(x.z-x.target);inside+=dt*(x.z>=x.lo&&x.z<=x.hi);positive+=dt*(x.z>0);above15+=dt*(x.z>15);importWh+=dt*Math.max(x.z,0)/3600;exportWh+=dt*Math.max(-x.z,0)/3600;min=Math.min(min,x.z);max=Math.max(max,x.z);changes+=x.u!==y.u;flips+=x.dir!==y.dir;}
 return {duration,mae:mae/duration,windowPct:inside/duration*100,positivePct:positive/duration*100,above15Pct:above15/duration*100,importWh,exportWh,min,max,changes,flips,firstChargeS:trace.find(x=>x.dir===1)?.t??null};}
const fit=JSON.parse(fs.readFileSync(out+'/Log17_20_Kalibrierung.json')).models.affine_candidate.model;
const envs=[];for(const gridPath of ['coupled','fast'])for(const delay of [.8,1.25])for(const chargeModel of [model.charging.battery,fit])envs.push({gridPath,delay,chargeModel,idle:-19,readback:2});
for(const gridPath of ['coupled','fast'])envs.push({gridPath,delay:1,chargeModel:fit,idle:-19,readback:2});
function synth(kind){const anchor=logs[19][0],start=clock(anchor)*1000;return Array.from({length:360},(_,i)=>{const t=i*2;let pv=800,house=100;
 if(kind==='steady')pv=850+4*Math.sin(t/20);
 if(kind==='ramp')pv=600+Math.min(t,400)*2.5;
 if(kind==='cloud')pv=t<160?1600:t<180?700:t<300?1500:900;
 if(kind==='small_drop')pv=1100-((t>=180&&t<300)?80:0);
 if(kind==='edge_noise')pv=800+20*Math.sin(t*.4);
 if(kind==='load_step'){pv=800;house=t>=240&&t<360?2200:100;}
 if(kind==='ramp_cloud'){pv=600+Math.min(t,400)*2.5;if(t>=280&&t<294)pv=650;}
 const r=structuredClone(anchor);r.ts=start+i*2000;r.execution={controlExecuted:true,enteredTs:r.ts,invocationSequence:i};r.snapshotCycle={...r.snapshotCycle,regulatorCycleId:'sim-'+i,regulatorCycleShort:i,lastOkTs:r.ts-800,ageMs:800};r.snapshot={cycleId:'sim-'+i,rxTsByTopic:{p_batterie:r.ts-850,p_zaehler:r.ts-800}};r.inputs={p_solar:pv,p_batterie:anchor.inputs.p_batterie,p_zaehler:house-pv+anchor.inputs.p_batterie,p_haus:house};return r;});}
function summarize(results){return candidates.map(c=>{const ps=results.filter(x=>x.candidate===c.name).map(x=>[x,results.find(b=>b.case===x.case&&b.env===x.env&&b.residual===x.residual&&b.candidate==='baseline')]);return {candidate:c.name,cases:ps.length,meanMAEDelta:ps.reduce((s,[a,b])=>s+a.all.mae-b.all.mae,0)/ps.length,meanImportWhDelta:ps.reduce((s,[a,b])=>s+a.all.importWh-b.all.importWh,0)/ps.length,worstImportPeakDelta:Math.max(...ps.map(([a,b])=>a.all.max-b.all.max)),worstExtraFlips:Math.max(...ps.map(([a,b])=>a.all.flips-b.all.flips)),worstMAEDelta:Math.max(...ps.map(([a,b])=>a.all.mae-b.all.mae))};});}
function main(){const results=[],traces={};
 for(const n of [15,16,17,18,19,20])for(let ei=0;ei<envs.length;ei++){const forcing=reconstruct(logs[n],envs[ei]);for(const residual of [true,false])for(let ci=0;ci<candidates.length;ci++){
  const tr=run(logs[n],{...envs[ei],residual},ci,forcing);
  results.push({case:'log'+n,env:ei,residual,candidate:candidates[ci].name,all:score(tr),high:score(tr,x=>x.pv>=720&&x.dir===1&&x.t>=30),lastDischarge:n===20?score(tr,x=>x.i>=564):null});
  if([19,20].includes(n)&&ei===9&&residual&&[0,1,2,5,11].includes(ci))traces[n+'_'+candidates[ci].name]=tr;
 }}
 const summary=summarize(results);fs.writeFileSync(out+'/Log17_20_Screening.json',JSON.stringify({scope:'Conditional full-controller sensitivity; six field logs, 10 plant alternatives, with/without fixed battery residual. Fast separate grid path versus coupled path. Not independent predictive proof.',envs,candidates,summary,results})+'\n');fs.writeFileSync(out+'/screening_traces.json',JSON.stringify(traces));console.log(JSON.stringify(summary,null,2));
}
module.exports={SignedPlant,code,candidates,run,reconstruct,logs,model,score,synth,envs,summarize};
if(require.main===module)main();
