const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const DIR=path.resolve(__dirname,'..');
const SOURCE=fs.readFileSync(path.join(DIR,'Regler_V4_22_SIM.js'),'utf8');
const RED={util:{cloneMessage:structuredClone}};
function compile(src=SOURCE){return new Function('flow','node','msg','Date','RED',src);}
const run=compile();
function state(C=300){return {p_o_s_in:-5,p_o_max:15,p_o_b_out:0,netz_laden:false,
 regelung:true,b_entladen:false,batt_min:false,batt_max:false,lastChargeW:C,lastDischargeW:0,
 af_activeDir:1,af_lastSwitchTs:1,regler_dir_richtung:1,richtung:1,
 batt_acMode:1,batt_packState:1,iChargeW:0,iDischargeW:0};}
function call(f,t,pv,z,b,opts={}){
 const cycle='synthetic-'+t;
 Object.assign(f,{p_solar:pv,p_zaehler:z,p_batterie:b,p_haus:pv+z-b,
  snapshot_last_ok_cycleId:cycle,snapshot_last_ok_ts:t-(opts.age??100),
  snapshot_last_battery_fresh:opts.fresh??true,snapshot_last_battery_source:opts.fresh===false?'esp':'modbus'});
 f.snapshot_last_diagnostic={state:'ok',cycleId:cycle,ts:t-100,values:{p_solar:pv,p_zaehler:z,p_batterie:b,p_haus:pv+z-b}};
 const out=(opts.fn??run)({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{}},{cycleId:cycle},{now:()=>t},RED);
 return out;
}
function advance(y,target,dt,m){
 if(dt<=0)return y;const e=target-y;if(Math.abs(e)<1e-12)return target;
 const tau=e>0?m.tau_up:m.tau_down,rate=e>0?m.rate_up:m.rate_down,s=Math.sign(e);
 const linear=Math.max(0,(Math.abs(e)-rate*tau)/rate);
 if(dt<=linear)return y+s*rate*dt;
 if(linear>0)return target-s*rate*tau*Math.exp(-(dt-linear)/tau);
 return target-e*Math.exp(-dt/tau);
}
class Plant{
 constructor(m,u,at){this.m=m;this.at=at;this.target=u*(m.gain??1)+(m.bias??0);this.y=this.target;this.queue=[];this.last=-1e20;}
 sample(t){while(this.queue.length&&this.queue[0].at<=t){const e=this.queue.shift();this.y=advance(this.y,this.target,e.at-this.at,this.m);this.at=e.at;this.target=e.target;}
  this.y=advance(this.y,this.target,t-this.at,this.m);this.at=t;return this.y;}
 command(t,u,old){if(u===old)return;const at=Math.max(t+(u>old?this.m.delay_up:this.m.delay_down),this.last+1e-6);this.last=at;
  this.queue.push({at,target:u===0&&this.m.idle_bias!==undefined?this.m.idle_bias:u*(this.m.gain??1)+(this.m.bias??0)});}
}
const nominal={grid:{tau_up:.266,tau_down:.128,delay_up:1.167,delay_down:2.340,rate_up:481,rate_down:80,gain:1,bias:0},
 battery:{tau_up:.08,tau_down:.232,delay_up:3.054,delay_down:4.220,rate_up:1162,rate_down:136,gain:1.01313,bias:-19.268,idle_bias:-18}};
function steady(pv,startError,model=nominal,noise=0){
 const target=pv>=1050?-17:pv>=720?-13:5,C=300,t0=100000;
 const f=state(C),g=new Plant(model.grid,C,-.1),b=new Plant(model.battery,C,-.1);
 const net=target+startError-C;const rows=[];let old=C;
 for(let i=0;i<=180;i++){
  const t=i*2,Z=Math.round(net+g.sample(t-.1)+noise*Math.sin(i*.3)),B=Math.round(b.sample(t-.1));
  const out=call(f,t0+t*1000,pv,Z,B),s=out[3].payload,U=out[1].payload;
  rows.push({t,Z,U,trim:s.chargeCenterTrim,hold:s.hold,D:out[2].payload});
  g.command(t,U,old);b.command(t,U,old);old=U;
 }
 return {target,rows};
}
test('effective midpoint of every PV window; quiet settling from either side',()=>{
 for(const pv of [200,400,850,1200])for(const e of [-18,-7,7]){
  const q=steady(pv,e),tail=q.rows.slice(-30);
  assert(tail.every(r=>Math.abs(r.Z-q.target)<=2),JSON.stringify({pv,e,tail:tail.slice(-3)}));
  assert(q.rows.every(r=>r.D===0&&r.U>=0&&r.U<=2400));
  for(const r of q.rows.filter(r=>r.trim.applied)){
   assert(Math.abs(r.trim.stepW)<=3);assert(r.trim.ageMs>=6000);
  }
  assert(tail.every(r=>r.U===tail[0].U));
 }
});
test('slower plant and small measurement variation remain bounded',()=>{
 const slow=structuredClone(nominal);
 for(const k of ['grid','battery'])for(const d of ['delay_up','delay_down'])slow[k][d]+=1.5;
 for(const pv of [400,850,1200]){
  const q=steady(pv,-18,slow,1);
  assert(q.rows.slice(-30).every(r=>Math.abs(r.Z-q.target)<=3));
  assert(q.rows.every(r=>r.Z<=q.target+4));
 }
});
test('large load, OFF, full battery, stale snapshot and held battery',()=>{
 let f=state(300),o=call(f,100000,400,900,280);
 assert(o[1].payload<=170);assert.equal(o[2].payload,0);assert.equal(o[3].payload.chargeCenterTrim.active,false);
 f=state(300);f.regelung=false;o=call(f,100000,1200,-500,280);
 assert.equal(o[1].payload,0);assert.equal(o[2].payload,0);
 f=state(300);f.batt_max=true;o=call(f,100000,1200,-500,280);
 assert.equal(o[1].payload,0);assert.equal(o[2].payload,0);
 f=state(300);assert.equal(call(f,100000,400,0,280,{age:1801}),null);
 f=state(300);for(let i=0;i<10;i++){
  o=call(f,100000+i*2000,400,0,280,{fresh:false});
  assert.equal(o[3].payload.chargeCenterTrim.active,false);
 }
 f=state(300);f.batt_acMode=2;for(let i=0;i<10;i++){
  o=call(f,100000+i*2000,400,0,280);
  assert.equal(o[3].payload.chargeCenterTrim.active,false);
 }
});
test('PV jumps and a class change interrupt fine control',()=>{
 const f=state(300);let o;
 for(let i=0;i<10;i++)o=call(f,100000+i*2000,700,0,280);
 o=call(f,120000,740,-18,280);
 assert.equal(o[3].payload.chargeCenterTrim.active,false);
 assert.equal(o[3].payload.chargeCenterTrim.stableCount,0);
 o=call(f,122000,900,-13,280);
 assert.equal(o[3].payload.chargeCenterTrim.active,false);
});
test('snapshot is copied with matching cycle and values',()=>{
 const f=state(300),o=call(f,100000,400,0,280),s=o[3].payload;
 assert.equal(s.snapshotAttachment.matched,true);
 f.snapshot_last_diagnostic.values.p_zaehler=99;
 assert.equal(s.snapshot.values.p_zaehler,0);
 const wrong=compile(SOURCE.replace('const diagnosticSnapshot = flow.get("snapshot_last_diagnostic");','const diagnosticSnapshot = {state:"ok",cycleId:"wrong",values:{}};'));
 const w=call(state(),100000,400,0,280,{fn:wrong})[3].payload;
 assert.equal(w.snapshot,null);assert.equal(w.snapshotAttachment.matched,false);
});

module.exports={compile,call,state,steady,advance,Plant};
