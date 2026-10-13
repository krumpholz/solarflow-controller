// Conditional closed-loop study. Full regulator function; no live IO.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=root+'/results_regler_log15_16';
const {source}=require('./source.cjs');
const {initial}=require(root+'/analysis_log11/initial.cjs');
const {advance}=require(root+'/analysis_log9/project/analysis_pv_no_shift/plant.cjs');
const model=JSON.parse(fs.readFileSync(out+'/Regler_Modell_V14.json'));
const logs=Object.fromEntries([15,16].map(n=>[n,fs.readFileSync(root+'/upload/regler_event_log_'+n+'.jsonl','utf8').trim().split('\n').map(JSON.parse)]));
const valid=r=>r.execution?.controlExecuted!==false;
const clock=r=>(r.execution?.enteredTs??(r.snapshotCycle.lastOkTs+r.snapshotCycle.ageMs))/1000;
const sampleClock=(r,key)=>(r.snapshot?.rxTsByTopic?.[key]??r.snapshotCycle.lastOkTs)/1000;
const candidates=[{name:'baseline'},{name:'Dtrim280',d:true},{name:'guard25',g:25},{name:'chargeStep5',c:5},{name:'chargeStep6',c:6},{name:'guard25_charge5',g:25,c:5},{name:'Dtrim_guard25_charge5',d:true,g:25,c:5}];
function code(v){let s=source;
 if(v.d)s=s.replace('mode === "REGEL_ENTLADEN" && lowPvOptimActive && b_entladen && !batt_min && lastDischargeW > holdMinActiveW', 'mode === "REGEL_ENTLADEN" && (lowPvOptimActive || (p_solar < 280 && loadStepBatteryDeltaValid && Math.abs(loadStep_dSolar) <= 15 && Math.abs(loadStep_dLoadEst) <= 15)) && b_entladen && !batt_min && lastDischargeW > holdMinActiveW');
 if(v.g)s=s.replace('p_haus + dirGuard_surplusMarginW','p_haus + ((p_solar < 280 && lastDischargeW === 0 && snapshotBatteryFresh && battDisNowMeas <= 30) ? '+v.g+' : dirGuard_surplusMarginW)');
 if(v.c)s=s.replace('highPvExportEdgeActive ? highPvTrimMaxStepW : chargeCenterTrimMaxStepW','highPvExportEdgeActive ? highPvTrimMaxStepW : (p_solar < 280 ? '+v.c+' : chargeCenterTrimMaxStepW)');
 return s;
}
const functions=candidates.map(v=>new Function('flow','node','msg','Date','RED',code(v)));
class SignedPlant {
 constructor(r,env,physical=false){this.env=env;this.physical=physical;this.at=sampleClock(r,physical?'p_zaehler':'p_batterie');this.y=r.inputs.p_batterie;this.q=[];this.last=-Infinity;this.dir=r.batteryStatus.batt_acMode===1?1:2;this.u=this.dir===1?r.controlBase.lastChargeW:r.controlBase.lastDischargeW;this.configure(this.dir,this.u);if(!this.u&&physical)this.y=env.idle;}
 configure(dir,u){this.dir=dir;this.m={...(dir===1?model.charging.battery:model.discharging.battery)};if(this.env.bias){this.m.bias=dir===1?-21:3.822943;}this.sign=dir===1?1:-1;this.target=u && !(dir===1 && u<(this.env.minCharge||0))?this.sign*Math.max(0,this.m.gain*u+this.m.bias):(this.physical?this.env.idle:-19);}
 evolve(t){const dt=Math.max(0,t-this.at);this.y=this.sign*advance(this.sign*this.y,this.sign*this.target,dt,this.m);this.at=t;}
 sample(t){while(this.q.length&&this.q[0].t<=t){const e=this.q.shift();this.evolve(e.t);this.configure(e.dir,e.u);}this.evolve(t);return this.y;}
 command(t,dir,u){if(dir===this.cmdDir&&u===this.cmdU)return;const old=this.cmdU??this.u;const m=dir===1?model.charging.battery:model.discharging.battery;const at=Math.max(t+(dir===1?0:.074)+(u>old?m.delay_up:m.delay_down)*this.env.delay,this.last+1e-6);this.q.push({t:at,dir,u});this.last=at;this.cmdDir=dir;this.cmdU=u;}
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
function score(trace,predicate=x=>x.t>=30){let duration=0,mae=0,inside=0,importWh=0,exportWh=0,min=Infinity,max=-Infinity,changes=0,flips=0;
 for(let i=0;i<trace.length-1;i++){const x=trace[i],y=trace[i+1];if(!predicate(x))continue;const dt=y.t-x.t;if(y.i!==x.i+1)continue;duration+=dt;mae+=dt*Math.abs(x.z-x.target);inside+=dt*(x.z>=x.lo&&x.z<=x.hi);importWh+=dt*Math.max(x.z,0)/3600;exportWh+=dt*Math.max(-x.z,0)/3600;min=Math.min(min,x.z);max=Math.max(max,x.z);changes+=x.u!==y.u;flips+=x.dir!==y.dir;}
 return {duration,mae:mae/duration,windowPct:inside/duration*100,importWh,exportWh,min,max,changes,flips,firstChargeS:trace.find(x=>x.dir===1)?.t??null};}
function synthetic(kind){const anchor=logs[16][0],tc=clock(anchor)*1000;return Array.from({length:450},(_,i)=>{const t=i*2;let pv=kind==='steady'?200:20+Math.min(t,700)*.5,house=110;
 if(kind==='early_cloud'&&t>=276&&t<284)pv=20;
 if(kind==='cloud'&&t>=420&&t<452)pv=55;
 if(kind==='cloud'&&t>=550&&t<558)pv=80;
 if(kind==='load_step'&&t>=420&&t<470)house+=180;
 if(kind==='boundary')pv=145+30*Math.sin(t/22);
 if(kind==='charge_gate'&&t>=420&&t<430)pv=90;
 if(kind==='fast_dawn')pv=20+Math.min(t,350);
 const r=structuredClone(anchor);r.ts=tc+t*1000;r.execution={controlExecuted:true,enteredTs:r.ts};r.snapshotCycle={...r.snapshotCycle,regulatorCycleId:'sim-'+i,regulatorCycleShort:i,lastOkTs:r.ts-800,ageMs:800};r.snapshot={cycleId:'sim-'+i,rxTsByTopic:{p_batterie:r.ts-850,p_zaehler:r.ts-800}};r.inputs={p_solar:pv,p_batterie:anchor.inputs.p_batterie,p_zaehler:house-pv+anchor.inputs.p_batterie,p_haus:house};return r;});}
function main(){
const envs=[];for(const idle of [-19,0])for(const delay of [.8,1.25])for(const bias of [false,true])envs.push({idle,delay,bias,readback:delay===.8?2:4});
envs.push({idle:-19,delay:1,bias:false,readback:2,minCharge:0});
for(const idle of [-19,0])for(const delay of [.8,1.25])envs.push({idle,delay,bias:false,readback:2,minCharge:60});
const results=[],traces={};
for(const n of [15,16])for(let ei=0;ei<envs.length;ei++){const forcing=reconstruct(logs[n],envs[ei]);for(const residual of [false,true]){const env={...envs[ei],residual};for(let ci=0;ci<candidates.length;ci++){const tr=run(logs[n],env,ci,forcing);results.push({case:'log'+n,env:ei,residual,candidate:candidates[ci].name,all:score(tr),dawn:score(tr,x=>x.pv>50&&x.t>=30),chargePeriod:n===16?score(tr,x=>x.i>=461):null});if(n===16&&ei===8&&residual&&[0,2,5,6].includes(ci))traces[candidates[ci].name]=tr;}}}
for(const kind of ['steady','cloud','load_step','boundary','charge_gate','fast_dawn','early_cloud'])for(let ei=0;ei<envs.length;ei++)for(let ci=0;ci<candidates.length;ci++)results.push({case:kind,env:ei,residual:false,candidate:candidates[ci].name,all:score(run(synthetic(kind),envs[ei],ci))});
const summaries=candidates.map(c=>{const pairs=results.filter(x=>x.candidate===c.name).map(x=>[x,results.find(b=>b.case===x.case&&b.env===x.env&&b.residual===x.residual&&b.candidate==='baseline')]);const summarize=ps=>{const mean=fn=>ps.reduce((s,p)=>s+fn(...p),0)/ps.length;return {scenarios:ps.length,meanMAEDelta:mean((a,b)=>a.all.mae-b.all.mae),worstMAEDelta:Math.max(...ps.map(([a,b])=>a.all.mae-b.all.mae)),meanWindowDelta:mean((a,b)=>a.all.windowPct-b.all.windowPct),meanImportWhDelta:mean((a,b)=>a.all.importWh-b.all.importWh),worstImportPeakDelta:Math.max(...ps.map(([a,b])=>a.all.max-b.all.max)),worstExtraFlips:Math.max(...ps.map(([a,b])=>a.all.flips-b.all.flips)),worstImportCase:ps.reduce((best,p)=>p[0].all.max-p[1].all.max>best[0].all.max-best[1].all.max?p:best)};};return {candidate:c.name,logs:summarize(pairs.filter(p=>p[0].case.startsWith('log'))),synthetic:summarize(pairs.filter(p=>!p[0].case.startsWith('log')))};});
fs.writeFileSync(out+'/Log15_16_ClosedLoop.json',JSON.stringify({scope:'Conditional sensitivity, full controller, signed delayed PT1, independently sampled grid/battery, endogenous AC-mode feedback. Net disturbance reconstructed per model using baseline open-loop response. With/without measured battery residual. Not independent field validation; single D-to-C event; high PV not covered.',candidates,envs,summaries,results},null,2)+'\n');
fs.writeFileSync(out+'/simulation_traces.json',JSON.stringify(traces));
const nominal=run(logs[16],{...envs[8],residual:true},0,reconstruct(logs[16],envs[8]));
const error=nominal.filter(x=>x.t>=30).map(x=>x.z-logs[16][x.i].inputs.p_zaehler);
console.log(JSON.stringify({nominalBaselineGridRMSE:Math.sqrt(error.reduce((s,x)=>s+x*x,0)/error.length),nominalBaselineMetrics:score(nominal)},null,2));
console.log(JSON.stringify(summaries.map(s=>({...s,logs:{...s.logs,worstImportCase:undefined},synthetic:{...s.synthetic,worstImportCase:undefined}})),null,2));

}
module.exports={SignedPlant,code,candidates,run,reconstruct,synthetic,score,logs,model};
if(require.main===module)main();
