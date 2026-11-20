const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),full=fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8');
const body=full.slice(0,full.indexOf('const legacy='))+full.slice(full.indexOf('function capacityStateKey('));
const KEY='file:batt_eff_state_v6_draft';
function rig(code=body,initial){
 let now=Date.parse('2026-11-16T10:00:00Z');const data=initial||new Map(),ctx=new Map();
 const flow={get:(k,s='memoryOnly')=>data.get(s+':'+k),set:(k,v,s='memoryOnly')=>data.set(s+':'+k,v)};
 for(const [k,v]of Object.entries({batt_min_s:20,netz_laden:false,b_entladen:false,regelung:true,regler_batt_min_confirmed:false,batt_max:false,p_solar:0,p_haus:300}))if(flow.get(k)===undefined)flow.set(k,v);
 class Clock extends Date{static now(){return now;}}
 const node={status(){},error(){},warn(){}};
 const fn=new vm.Script('(function(msg'+(code===body?',legacy':'')+'){'+code+'})').runInNewContext({Date:Clock,Intl,flow,context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)},node});
 let seq=0;
 const tick=({dt=2000,p=0,soc=50,valid=true,flags={},message={}}={})=>{
  now+=dt;seq++;for(const[k,v]of Object.entries(flags))flow.set(k,v);
  const r={timestamp:new Date(now).toISOString(),interval_accepted:valid,power_w:p,soc_now_raw_pct:soc,eta_pct:4.5};
  for(const[k,v]of Object.entries({snapshot_last_ok_cycleId:String(seq),snapshot_last_ok_ts:now,snapshot_last_ok_triggerTs:now-100,snapshot_last_battery_source:valid?'fresh':'esp',snapshot_last_battery_fresh:valid,snapshot_last_ok_quality:'good',p_batterie:p,batt_level:soc,batt_level_ts:now}))flow.set(k,v);
  return fn({...message,_eff:{ts:now,soc,socTs:now}},[{}, {payload:4.5,result:r},{}]);
 };
 return{tick,flow,data,fn,state:()=>data.get(KEY),get now(){return now},run:msg=>fn(msg,[])};
}
function runSection(r,{p=2400,start=50,end=60,seconds=1500,flags={netz_laden:true}}={}){
 r.tick({p,soc:start,flags});
 let out;for(let t=2;t<=seconds;t+=2)out=r.tick({p,soc:start+(end-start)*t/seconds,flags});return out;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('seed is 80 even when legacy balance is 4.5; source output has four ports',()=>{const r=rig(),o=r.tick();assert.equal(o.length,4);assert.equal(o[2].payload.type,"efficiency_sources_v6");assert.equal(o[3].result.reason,"initialized_80");assert.equal(o[0].payload,80);assert.equal(o[1].payload,4.5);assert.equal(r.flow.get('la_ela_es_mean_7d','file'),80);});
test('seed is persistent and survives reboot without overwriting learned estimates',()=>{const r=rig();r.tick();r.state().seed=79;const b=rig(body,new Map(JSON.parse(JSON.stringify([...r.data]))));assert.equal(b.tick().at(0).payload,79);});
test('rest SOC loss does not teach discharge and reduces provenance',()=>{const r=rig();r.tick({soc:70});r.state().inventory.solar=1;r.state().inventory.unknown-=1;r.tick({soc:68});assert.equal(r.state().records.length,0);assert.ok(r.state().inventory.solar<1);assert.equal(r.flow.get('la_ela_es_mean_7d','file'),80);});
test('net then household discharge replaces seed with measured product',()=>{
 const r=rig();r.tick();runSection(r);assert.equal(r.state().records.length,1);
 const out=runSection(r,{p:-400,start:60,end:50,seconds:7200,flags:{netz_laden:false,b_entladen:true}});
 assert.equal(out[0].result.reason,'measured');assert.equal(out[0].payload,80);
 close(out[0].result.estimates.net.eta,.864);close(out[0].result.estimates.discharge.eta,.8/.864);
});
test('solar learning remains separate from net',()=>{const r=rig();r.tick();runSection(r,{p:1000,seconds:3600,flags:{netz_laden:false,p_solar:1400,p_haus:400}});assert.equal(r.state().records[0].kind,'solar');assert.equal(r.state().estimates.net,undefined);});
test('blocked discharge cannot teach even with negative AC power and falling SOC',()=>{const r=rig();r.tick();runSection(r,{p:-400,start:60,end:50,seconds:7200,flags:{netz_laden:false,b_entladen:false}});assert.equal(r.state().records.length,0);});
test('minimum SOC block prevents discharge learning',()=>{const r=rig();r.tick();runSection(r,{p:-400,start:60,end:50,seconds:7200,flags:{b_entladen:true,netz_laden:false,regler_batt_min_confirmed:true}});assert.equal(r.state().records.length,0);});
test('unknown controls do not learn',()=>{const r=rig();r.tick();runSection(r,{flags:{netz_laden:true,b_entladen:null}});assert.equal(r.state().records.length,0);});
test('small SOC hubs do not teach',()=>{const r=rig();r.tick();runSection(r,{end:55});assert.equal(r.state().records.length,0);});
test('discharge starts with fresh SOC after idle drift',()=>{const r=rig();r.tick({soc:70});r.tick({soc:65});r.tick({soc:65,p:-400,flags:{b_entladen:true}});assert.equal(r.state().segment.soc,65);});
test('200W start must hold for 60 seconds',()=>{const r=rig();r.tick();r.tick({p:200,flags:{netz_laden:true}});for(let n=0;n<20;n++)r.tick({p:200});assert.equal(r.state().segment.confirmed,false);r.tick({p:199});assert.equal(r.state().segment,null);});
test('low-power timeout excludes tail from the learning section',()=>{const r=rig();r.tick();runSection(r,{end:59});for(let n=0;n<61;n++)r.tick({p:0,soc:59});assert.equal(r.state().segment,null);assert.equal(r.state().records.length,0);});
test('large SOC reversal discards open section',()=>{const r=rig();r.tick();runSection(r,{end:55});r.tick({p:2400,soc:53});assert.equal(r.state().segment,null);assert.equal(r.state().rejected.at(-1).reason,'soc_reversal');});
test('source failure ends section and invalidates provenance on recovery',()=>{const r=rig();r.tick();runSection(r,{end:55});r.state().inventory.solar=.5;r.tick({valid:false});assert.equal(r.state().segment,null);const out=r.tick({soc:55});assert.equal(out[2].payload.solar_stored_kwh,0);});
test('long gap never integrates across unknown interval',()=>{const r=rig();r.tick();r.tick({p:2400,flags:{netz_laden:true}});r.tick({p:2400,soc:60,dt:20000});assert.equal(r.state().records.length,0);assert.equal(r.state().segment,null);});
test('sub-200W solar charges can build provenance without teaching efficiency',()=>{
 const r=rig();r.tick({flags:{p_solar:450,p_haus:300}});
 for(let n=0;n<2400;n++)r.tick({p:150,soc:n<2200?50:52});
 assert.equal(r.state().records.length,0);assert.ok(r.state().inventory.solar>.17);
});
test('SOC rise without AC input never creates solar inventory',()=>{const r=rig();r.tick();for(let n=0;n<40;n++)r.tick({soc:52});assert.equal(r.state().inventory.solar,0);assert.ok(r.state().inventory.unknown>4.32);});
test('unconfirmed higher SOC step is not credited with prior confirmation',()=>{const r=rig();r.tick({flags:{p_solar:500,p_haus:300}});for(let n=0;n<1800;n++)r.tick({p:200});for(let n=0;n<29;n++)r.tick({p:200,soc:51});r.tick({p:200,soc:52});r.tick({p:200,soc:52});r.tick({p:200,soc:52});assert.ok(r.state().inventory.solar<=.0864+1e-9);});
test('mixed net/PV input splits inventory even during net mode',()=>{
 const r=rig();r.tick({flags:{netz_laden:true,p_solar:1500,p_haus:300}});
 for(let n=0;n<160;n++)r.tick({p:2400,soc:n<100?50:51});
 close(r.state().inventory.solar,r.state().inventory.net);assert.ok(r.state().inventory.solar>0);
});
test('idle compensation receives no solar credit',()=>{const r=rig();r.tick({flags:{p_solar:500,p_haus:300}});for(let n=0;n<2000;n++)r.tick({p:100,soc:n<1900?50:51,flags:{regler_idle_compensation_v436:{phase:'tracking',lastValidTs:r.now+2000}}});assert.equal(r.state().inventory.solar,0);});
test('solar first debit, preserving net source until solar used',()=>{const r=rig();r.tick();const i=r.state().inventory;i.solar=.5;i.net=1;i.unknown=2.82;r.tick({p:-400});assert.ok(r.state().inventory.solar<.5);assert.equal(r.state().inventory.net,1);});
test('expired measured estimates do not silently reseed to 80',()=>{const r=rig();r.tick();r.state().estimates={net:{eta:.9,at:r.now-91*86400000,count:3,hub:30,phases:2},discharge:{eta:.9,at:r.now-91*86400000,count:3,hub:30,phases:2}};const o=r.tick();assert.equal(o[0].payload,null);assert.equal(o[0].result.reason,'stale');});
test('invalid persisted state fails without destroying it or resetting 80',()=>{const r=rig();r.tick();r.state().signature='wrong';assert.equal(r.tick()[0].payload,null);assert.equal(r.state().signature,'wrong');});
test('generated function retains original balance output and isolates old mean writer',()=>{const r=rig(fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8'));const o=r.tick();assert.equal(o[0].payload,80);assert.equal(o.length,4);assert.equal(r.flow.get('la_ela_es_mean_7d','file'),80);assert.ok(r.flow.get('batt_eff_state_v4','file'));});
test('imports contain precisely generated function and no server configuration',()=>{const nodes=JSON.parse(fs.readFileSync(path.join(root,'calculation-import.json')));assert.equal(nodes.length,1);assert.equal(nodes[0].outputs,4);assert.equal(nodes[0].func,fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8'));});
const release=fs.readFileSync(path.join(root,'solar-release.js'),'utf8');
test('output 3 controls only the solar flag, with hysteresis on every invocation',()=>{
 const r=rig(release);
 for(const [amount,expected] of [[0,false],[.086399,false],[.0864,true],[.02,true],[0,false],[.02,false]]){
  const msg={payload:{type:'efficiency_sources_v6',at:r.now,valid:true,capacity_kwh:8.64,solar_available_kwh:amount}};
  assert.equal(r.run(msg).payload,expected);
  assert.equal(r.flow.get('b_entladen_solar'),expected);
  assert.equal(r.flow.get('b_entladen'),false);
 }
});
test('invalid, expired or future source clears the solar flag and preserves base permission',()=>{
 const r=rig(release);r.flow.set('b_entladen',true);
 const src={type:'efficiency_sources_v6',at:r.now,valid:true,capacity_kwh:8.64,solar_available_kwh:1};
 for(const payload of [null,false,{}, {...src,valid:false},{...src,at:r.now-6501},{...src,at:r.now+1},{...src,solar_available_kwh:'1'}]){
  r.flow.set('b_entladen_solar',true);
  assert.equal(r.run({payload}).payload,false);
  assert.equal(r.flow.get('b_entladen_solar'),false);
  assert.equal(r.flow.get('b_entladen'),true);
 }
});
test('pending solar credit cannot cross into idle compensation',()=>{const r=rig();r.tick({flags:{p_solar:500,p_haus:300}});for(let n=0;n<1600;n++)r.tick({p:200});for(let n=0;n<40;n++)r.tick({p:0,soc:51,flags:{regler_idle_compensation_v436:{phase:'tracking',lastValidTs:r.now+2000}}});assert.equal(r.state().inventory.solar,0);});
test('generated calculation ignores duplicate snapshots without blocking new learning',()=>{const code=fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8');const r=rig(code);r.tick();r.tick();const count=r.state().records.length;assert.equal(r.fn({_eff:{ts:r.now,soc:50,socTs:r.now}},[]),null);assert.equal(r.state().records.length,count);assert.equal(r.state().blocked,false);});
test('generated calculation pauses on bad data while seed remains available',()=>{const r=rig(fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8'));r.tick();r.tick();const out=r.tick({valid:false});assert.equal(out[0].payload,80);assert.equal(out[2].payload.valid,false);assert.equal(r.state().blocked,true);});
test('no individual efficiency invented while only one direction learned',()=>{const r=rig();r.tick();const out=runSection(r);assert.equal(out[0].payload,80);assert.equal(out[0].result.estimates.discharge.eta,null);assert.equal(out[0].result.reason,'initialized_80');});
test('network low-power charging cannot teach 2400W charging efficiency',()=>{const r=rig();r.tick();runSection(r,{p:1000,seconds:3600});assert.equal(r.state().estimates.net,undefined);assert.ok(r.state().rejected.some(x=>x.reason==='net_average_low'));});
test('true >100 percent section is rejected rather than clamped',()=>{const r=rig();r.tick();runSection(r,{p:2000,seconds:1200});assert.equal(r.state().records.length,0);});
test('hard transition interrupts an unqualified section without carrying SOC to next one',()=>{const r=rig();r.tick();runSection(r,{end:55});r.tick({p:0,soc:54,flags:{netz_laden:false}});r.tick({p:2400,soc:54,flags:{netz_laden:true}});assert.equal(r.state().segment.soc,54);assert.equal(r.state().segment.input,0);});

test('reserve follows current SOC limit and caps mixed solar inventory once',()=>{
 const r=rig();r.tick({soc:21});
 Object.assign(r.state().inventory,{solar:.4,net:.5,unknown:.9});
 for(const [limit,expected] of [[20,.0864],[21,0],[22,0],['10',.4],[0,.4],[100,0]]){
  const out=r.tick({soc:21,flags:{batt_min_s:limit}})[2].payload;
  close(out.reserve_kwh,8.64*Number(limit)/100);close(out.solar_available_kwh,expected);
 }
 for(const limit of [undefined,null,'',false,101,-1]){
  const o=r.tick({soc:21,flags:{batt_min_s:limit}});
  assert.equal(o[2].payload.valid,false);assert.equal(o[2].payload.solar_available_kwh,0);assert.equal(o[0].payload,80);
 }
});
test('both calculations use the configured constant and release starts at one SOC point',()=>{
 const r=rig(fs.readFileSync(path.join(root,'battery-efficiency-v6.js'),'utf8'));
 r.tick();assert.equal(r.flow.get('batt_capacity_kwh','file'),8.64);
 r.flow.set('batt_capacity_kwh',5.76,'file');r.tick();assert.equal(r.flow.get('batt_capacity_kwh','file'),8.64);
 const other=rig(full.replace('BATTERIE_KAPAZITAET_KWH = 8.64','BATTERIE_KAPAZITAET_KWH = 5.76'),r.data);
 other.tick();const o=other.tick();assert.equal(other.flow.get('batt_capacity_kwh','file'),5.76);
 close(o[2].payload.reserve_kwh,1.152);assert.equal(o[1].result.capacity_kwh,5.76);
 const g=rig(release);for(const [amount,expected] of [[.0575,false],[5.76/100,true],[0,false]]){
  assert.equal(g.run({payload:{...o[2].payload,at:g.now,solar_available_kwh:amount}}).payload,expected);
 }
 r.flow.set('batt_capacity_kwh','unavailable','file');r.tick();assert.equal(r.flow.get('batt_capacity_kwh','file'),8.64);
});

test('source output connects to the release import and reports missing minimum SOC',()=>{
 const calc=JSON.parse(fs.readFileSync(path.join(root,'calculation-import.json')))[0];
 const gate=JSON.parse(fs.readFileSync(path.join(root,'solar-release-import.json')))[0];
 assert.deepEqual(calc.wires[2],[gate.id]);assert.equal(calc.z,gate.z);assert.equal(gate.func,release);
 const r=rig();const inv=r.tick({flags:{batt_min_s:undefined}})[2].payload;
 assert.equal(inv.valid,false);assert.match(inv.reason,/batt_min_s/);
});
