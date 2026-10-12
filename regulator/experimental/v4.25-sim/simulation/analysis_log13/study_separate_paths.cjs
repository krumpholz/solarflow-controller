// Closed-loop sensitivity on measured external net load; no measured battery residual.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const {initial,tick}=require(root+'/analysis_log11/initial.cjs');const {advance,target}=require(root+'/analysis_log9/project/analysis_pv_no_shift/plant.cjs');
const rows=fs.readFileSync(root+'/upload/regler_event_log_13.jsonl','utf8').trim().split('\n').map(JSON.parse);
const src=fs.readFileSync(root+'/results_regler_log10/Regler_V4_25_SIM.txt','utf8');const model=JSON.parse(fs.readFileSync(root+'/restored_pv/project/results_regler_log6/Regler_Modell_V6.json'));
class Gated {
 constructor(m,gate,start){this.m=m;this.gate=gate;this.at=start;this.y=0;this.target=0;this.last=-1e20;this.q=[];}
 advance(t){this.y=t<=this.gate?0:advance(this.y,this.target,Math.max(0,t-Math.max(this.at,this.gate)),this.m);this.at=t;}
 sample(t){while(this.q.length&&this.q[0].at<=t){const e=this.q.shift();this.advance(e.at);this.target=e.target;}this.advance(t);return this.y;}
 command(t,u,prev){if(u===prev)return;const at=Math.max(t+.09+(u>prev?this.m.delay_up:this.m.delay_down),this.last+1e-6);this.last=at;this.q.push({at,target:u?target(u,this.m):0});}
}
const variants=[];for(const p of [.6,.8,1.0])for(const ramp of [600,900,1200])variants.push({p,ramp});
const results=[];let t0=rows[5].ts/1000;
for(const variant of variants){
 const code=src.replace('const errGainDischargePV = 0.80;','const errGainDischargePV = '+variant.p+';').replace('const stepUpDischargeLoadStepW = 900;','const stepUpDischargeLoadStepW = '+variant.ramp+';');
 const fn=new Function('flow','node','msg','Date','RED',code);
 for(const gate of [7.2,8,9.2])for(const noise of [0,5]){
  const f=initial(rows[0]);let prev=0;const b=new Gated(model.discharging.battery,t0+gate,rows[0].ts/1000-2);const g=new Gated(model.discharging.grid,t0+gate,rows[0].ts/1000-2);
  const trace=[];
  for(let i=0;i<rows.length;i++){
   const r=rows[i],now=Math.min(r.ts,r.snapshotCycle.lastOkTs+r.snapshotCycle.ageMs),sec=now/1000;
   const rx=r.snapshot?.cycleId===r.snapshotCycle.regulatorCycleId?r.snapshot.rxTsByTopic:{};
   const bs=(rx?.p_batterie??r.snapshotCycle.lastOkTs)/1000,gs=(rx?.p_zaehler??r.snapshotCycle.lastOkTs)/1000;
   const B=-b.sample(bs),net=r.inputs.p_zaehler-r.inputs.p_batterie,z=net-g.sample(gs)+noise*Math.sin(i*2.3);
   const input={...r.inputs,p_batterie:Math.round(B),p_zaehler:Math.round(z),p_haus:Math.round(net+r.inputs.p_solar)};
   const out=tick(fn,f,r,input,now);const u=out[2].payload;b.command(sec,u,prev);g.command(sec,u,prev);prev=u;
   trace.push({t:r.ts/1000-t0,z,u,B});
  }
  const sum=(pred,fn)=>trace.slice(0,-1).reduce((s,x,i)=>s+(pred(x)?fn(x)*(trace[i+1].t-x.t):0),0);
  const pred=x=>x.t>=30;const dur=sum(pred,()=>1);
  results.push({...variant,gate,noise,importFirst20Wh:sum(x=>x.t>=0&&x.t<20,x=>Math.max(0,x.z))/3600,exportFirst20Wh:sum(x=>x.t>=0&&x.t<20,x=>Math.max(0,-x.z))/3600,settledMAE:sum(pred,x=>Math.abs(x.z-7.5))/dur,settledWindow:100*sum(pred,x=>x.z>=0&&x.z<=15?1:0)/dur,minAfterStart:Math.min(...trace.filter(x=>x.t>=10).map(x=>x.z)),firstCommand:trace[5].u});
 }
}
const summary=variants.map(v=>{const a=results.filter(x=>x.p===v.p&&x.ramp===v.ramp);const mean=k=>a.reduce((s,x)=>s+x[k],0)/a.length;return {...v,meanImportFirst20Wh:mean('importFirst20Wh'),meanExportFirst20Wh:mean('exportFirst20Wh'),meanSettledMAE:mean('settledMAE'),meanSettledWindow:mean('settledWindow')};});
fs.writeFileSync(root+'/results_regler_log13/Log13_Separate_Pfade_Verworfen.json',JSON.stringify({scope:'54 conditional closed-loop scenarios, same measured net load/PV, 3 startup gates and 2 deterministic noise levels; one full-start event, not independent field validation. Battery and grid normal models retained; logged flags/status reused because direction policy unchanged.',summary,results},null,2));console.log(JSON.stringify(summary,null,2));
