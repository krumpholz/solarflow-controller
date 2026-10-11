const fs=require('fs');const {seed,compile,tick}=require('./controller.cjs');
const cached=new Map();
function controller(c){
 const key=JSON.stringify(c);
 if(!cached.has(key))cached.set(key,compile(c.file??'Regler_V4_23_SIM.js',c.constants??{}));
 return cached.get(key);
}
function advance(y,target,dt,m){
 if(dt<=0)return y;const e=target-y;if(Math.abs(e)<1e-12)return target;
 const tau=e>0?m.tau_up:m.tau_down,rate=e>0?m.rate_up:m.rate_down,s=Math.sign(e);
 const linear=Math.max(0,(Math.abs(e)-rate*tau)/rate);
 if(dt<=linear)return y+s*rate*dt;
 if(linear>0)return target-s*rate*tau*Math.exp(-(dt-linear)/tau);
 return target-e*Math.exp(-dt/tau);
}
function commandTarget(u,m){return u===0&&m.idle_bias!==undefined?m.idle_bias:u*(m.gain??1)+(m.bias??0);}
class Plant{
 constructor(m,initial,at,y=null){this.m=m;this.y=y??(commandTarget(initial,m));this.target=commandTarget(initial,m);this.at=at;this.last=-1e20;this.queue=[];}
 sample(t){
  while(this.queue.length&&this.queue[0].at<=t){const ev=this.queue.shift();this.y=advance(this.y,this.target,ev.at-this.at,this.m);this.at=ev.at;this.target=ev.target;}
  this.y=advance(this.y,this.target,t-this.at,this.m);this.at=t;return this.y;
 }
 command(t,u,old){if(u===old)return;const delay=u>old?this.m.delay_up:this.m.delay_down;
  const at=Math.max(t+delay,this.last+1e-6);this.last=at;
  this.queue.push({at,target:commandTarget(u,this.m)});
 }
}
function metrics(d,r,start=0,end=d.tc.length-1){
 let dur=0,mean=0,mae=0,maeFeasible=0,imp=0,exp=0,within=0,center=0,reachable=0,withinReach=0,changes=0,switches=0;
 for(let i=start;i<end;i++){
  const w=d.tc[i+1]-d.tc[i],z=r.Z[i],pv=d.rows[i].inputs.p_solar;
  const win=d.rows[i].effectiveWindows.charge,lo=win.p_o_s_in_eff,hi=win.p_o_max_eff,target=win.p_o_s_in_m_eff;
  const attainable=Math.min(Math.max(target,d.net[i]),d.net[i]+2400);const reach=d.net[i]<=hi&&d.net[i]+2400>=lo;
  dur+=w;mean+=w*z;mae+=w*Math.abs(z-target);maeFeasible+=w*Math.abs(z-attainable);
  imp+=w*Math.max(z,0)/3600;exp+=w*Math.max(-z,0)/3600;
  within+=w*(z>=lo&&z<=hi);center+=w*(Math.abs(z-target)<=2);
  reachable+=w*reach;withinReach+=w*reach*(z>=lo&&z<=hi);
  changes+=r.U[i]!== (i?r.U[i-1]:d.initial);switches+=r.Dir[i]!== (i?r.Dir[i-1]:1);
 }
 return {duration_s:dur,mean_W:mean/dur,raw_target_mae_W:mae/dur,feasible_target_mae_W:maeFeasible/dur,
  import_Wh:imp,export_Wh:exp,within_pct:within/dur*100,center_pct:center/dur*100,
  reachable_s:reachable,within_reachable_pct:withinReach/reachable*100,command_changes:changes,direction_changes:switches};
}
function simulate(d,c,m){
 const ctrl=controller(c),f=seed(d.rows[0]);
 const g=new Plant(m.grid,d.initial,d.tz[0]),b=new Plant(m.battery,d.initial,d.tb[0],d.rows[0].inputs.p_batterie);
 const r={Z:[],B:[],G:[],U:[],D:[],Dir:[],H:[],set:[]};let previous=d.initial;
 for(let i=0;i<d.tc.length;i++){
  const G=g.sample(d.tz[i]),B=Math.round(b.sample(d.tb[i])+d.batteryNoise[i]),Z=Math.round(d.net[i]+G);
  const old=d.rows[i],pv=old.inputs.p_solar;
  const out=tick(ctrl,f,old,{p_zaehler:Z,p_batterie:B,p_solar:pv,p_haus:pv+Z-B});
  if(!out)throw Error('Missing controller output');
  const U=out[1].payload,D=out[2].payload,s=out[3].payload;
  r.Z.push(Z);r.B.push(B);r.G.push(G);r.U.push(U);r.D.push(D);r.Dir.push(out[0].payload);r.H.push(s.hold);r.set.push(s.controlSet.active);
  g.command(d.tc[i],U,previous);b.command(d.tc[i],U,previous);previous=U;
 }
 const fall=d.recoveryIndex??316;
 let window=null;for(let i=fall;i<(d.recoveryEnd??379)-2;i++)if(r.Z.slice(i,i+3).every((z,j)=>{
   const w=d.rows[i+j].effectiveWindows.charge;return z>=w.p_o_s_in_eff&&z<=w.p_o_max_eff;
 })){window=d.tc[i]-d.tc[fall];break;}
 const firstCharge=r.U.findIndex((u,i)=>i>=fall&&u>0);
 return {all:metrics(d,r),recovery:metrics(d,r,fall,Math.min(d.tc.length-1,fall+35)),
         recovery_window_s:window,first_charge_after_fall_s:firstCharge<0?null:d.tc[firstCharge]-d.tc[fall],trajectory:r};
}
if(require.main===module){
 const q=JSON.parse(fs.readFileSync(0,'utf8'));
 const res=q.candidates.map(c=>q.models.map(m=>{const r=simulate(q.dataset,c,m);return q.trajectories?r:Object.fromEntries(Object.entries(r).filter(([k])=>k!=='trajectory'));}));
 process.stdout.write(JSON.stringify(res));
}
module.exports={simulate,metrics,Plant,advance,commandTarget};
