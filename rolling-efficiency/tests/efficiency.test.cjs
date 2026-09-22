const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');
const body=fs.readFileSync(path.join(ROOT,'battery-efficiency.js'),'utf8');
const H=3600000;
function rig({time=Date.parse('2026-09-22T10:00:00Z'),data=new Map(),code=body}={}) {
 let clock=time,ctx=new Map(),fn,seq=0;
 const flow={get:(k,s='memoryOnly')=>data.get(s+':'+k),set:(k,v,s='memoryOnly')=>data.set(s+':'+k,v)};
 function boot(){ctx=new Map();class Clock extends Date {constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
 fn=new vm.Script('(function(msg){'+code+'})').runInNewContext({Date:Clock,Intl,flow,context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)},node:{status(){},error(){}}});}
 boot();
 function tick({dt=2000,p=1000,soc=50,source='fresh',id,ts,meta={},message}={}) {
  clock+=dt; seq++;
  const vals={snapshot_last_ok_cycleId:id||`${clock}-${seq}`,snapshot_last_ok_ts:ts??clock,
   snapshot_last_ok_triggerTs:(ts??clock)-100,snapshot_last_battery_source:source,
   snapshot_last_battery_fresh:source==='fresh',snapshot_last_ok_quality:'good',p_batterie:p,...meta};
  for(const[k,v]of Object.entries(vals))flow.set(k,v);
  flow.set('batt_level',soc,'memoryOnly');flow.set('batt_level_ts',clock,'memoryOnly');
  return fn(message||{_eff:{ts:clock,soc,socTs:clock,id:`capture-${clock}`}});
 }
 return {tick,boot,flow,data,run:m=>fn(m),get now(){return clock},state:()=>flow.get('batt_eff_state_v4','file')};
}
function result(out){assert.ok(out);return out[0].result;}
function close(a,b,eps=1e-9){assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function v3(time,days){return {version:3,unit:'kWh',fingerprint:JSON.stringify([8.64,'sensor.batterie_lade_energie_pro_tag','sensor.batterie_entlade_energie_pro_tag',Intl.DateTimeFormat().resolvedOptions().timeZone]),last:{ts:time,date:local(time),soc:50,charge:1,discharge:1},days};}
function local(t){const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function day(date,c=1,d=.8,delta=0,extra={}){return {date,charge:c,discharge:d,delta,coveredMs:0,gaps:0,gapMs:0,intervals:0,...extra};}
for(const language of ['EN','DE']) {
 const code=language==='EN'?body:fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8');
 test(language+' 2400 W for 2 s = 1.333333 Wh',()=>{const r=rig({code});r.tick({p:2400});r.tick({p:2400});close(r.state().buckets[0][2],2400*2/3600000);});
 test(language+' zero crossing integrates two triangles, not net energy',()=>{const r=rig({code});r.tick({p:2400});const out=r.tick({p:-2400});close(r.state().buckets[0][2],2400/3600000/2);close(r.state().buckets[0][3],2400/3600000/2);assert.equal(result(out).interval_accepted,true);});
 test(language+' irregular 3.7 s interval uses measured elapsed time',()=>{const r=rig({code});r.tick({p:1000});r.tick({p:2000,dt:3700});close(r.state().buckets[0][2],1500*3.7/3600000);});
 test(language+' fresh installation outputs before seven days',()=>{const r=rig({code});assert.equal(result(r.tick({p:2400})).valid,false);let out;for(let i=0;i<76;i++)out=r.tick({p:2400});assert.equal(result(out).valid,true);assert.equal(result(out).window_complete,false);assert.equal(result(out).eta_pct,0);});
 test(language+' duplicate snapshot cannot integrate twice or update SOC',()=>{const r=rig({code});r.tick({id:'a'});const before=JSON.stringify(r.state());assert.equal(r.tick({id:'a',soc:51}),null);assert.equal(JSON.stringify(r.state()),before);});
 test(language+' future, stale, invalid or implausible power is not integrated',()=>{for(const args of [{p:NaN},{p:null},{p:''},{p:true},{p:2881},{ts:Date.now()+1e12},{source:'esp'}]){const r=rig({code});r.tick();assert.equal(result(r.tick(args)).valid,false);assert.equal(r.state().buckets.length,0);}});
 test(language+' fallback excludes gap in both energy and SOC',()=>{const r=rig({code});r.tick();r.tick({source:'esp',soc:51});assert.equal(result(r.tick({soc:52})).interval_status,'measurement_gap_excluded');assert.equal(r.state().buckets.length,0);r.tick({soc:52});close(r.state().buckets[0][4],0);});
 test(language+' long outage keeps history without inventing energy',()=>{const r=rig({code});r.tick();r.tick();const c=r.state().buckets[0][2];const out=r.tick({dt:600000,soc:60});assert.equal(result(out).interval_status,'measurement_gap_excluded');close(r.state().buckets[0][2],c);});
 test(language+' persisted restart rejects replay, then continues once',()=>{let r=rig({code});r.tick({id:'old'});r.tick({id:'latest'});const serialized=JSON.stringify([...r.data]);r=rig({code,time:r.now,data:new Map(JSON.parse(serialized))});assert.equal(r.tick({id:'latest'}),null);r.tick({id:'next'});close(r.state().buckets.reduce((s,b)=>s+b[2],0),1000*6/3600000);});
 test(language+' SOC jump needs three distinct samples and excludes affected energy',()=>{const r=rig({code});r.tick({soc:50});assert.equal(result(r.tick({soc:80})).reason,'soc_jump_pending');assert.equal(result(r.tick({soc:80})).reason,'soc_jump_pending');assert.equal(result(r.tick({soc:80})).interval_status,'confirmed_soc_jump_excluded');r.tick({soc:80});assert.equal(r.state().excludedIntervals,3);close(r.state().buckets[0][4],0);close(r.state().buckets[0][2],1000*2/3600000);});
 test(language+' transient SOC spike is not counted as stored energy',()=>{const r=rig({code});r.tick({soc:50});r.tick({soc:80});r.tick({soc:50});close(r.state().buckets[0][4],0);});
 test(language+' missing timestamp permitted but never verified',()=>{const r=rig({code});const o=r.tick({message:{_eff:{ts:r.now+2000,soc:50,socTs:null}}});assert.equal(result(o).soc_freshness_verified,false);});
 test(language+' stale SOC cannot be made fresh by power polling',()=>{const r=rig({code});r.tick();const o=r.tick({message:{_eff:{ts:r.now+2000,soc:50,socTs:r.now-130000}}});assert.equal(result(o).reason,'stale_or_future_soc');});
 test(language+' v3 import preserves totals, legacy correction and original buffer',()=>{const r=rig({code});const t=r.now;const d0=new Date(t);d0.setDate(d0.getDate()-1);const old=v3(t,[day(local(+d0),1,.8,-2.2464,{legacy:true,legacySocKnown:true,legacySocStart:82,legacySocEnd:56}),day(local(t),4,2,-.864,{legacy:true,legacySocKnown:true,legacySocStart:88,legacySocEnd:78})]);r.flow.set('batt_eff_state_v3',old,'file');const before=JSON.stringify(old);const out=result(r.tick());close(out.sum_charge_kwh_7d,5);close(out.delta_stored_energy_kwh,-.3456);assert.equal(JSON.stringify(old),before);r.boot();const after=result(r.tick());close(after.imported_charge_kwh,5);});
 test(language+' missing legacy SOC stays invalid',()=>{const r=rig({code});r.flow.set('batt_eff_state_v3',v3(r.now,[day(local(r.now),1,.8,0,{legacy:true,legacySocKnown:false})]),'file');assert.equal(result(r.tick()).reason,'legacy_soc_boundaries_missing');});
 test(language+' migration capacity mismatch fails without creating v4',()=>{const r=rig({code});const old=v3(r.now,[day(local(r.now))]);old.fingerprint=old.fingerprint.replace('8.64','5.76');r.flow.set('batt_eff_state_v3',old,'file');assert.equal(result(r.tick()).detail,language==='EN'?'v3_configuration_mismatch':'V3-Kapazität, Entitäten oder Zeitzone stimmen nicht überein');assert.equal(r.state(),undefined);});
 test(language+' midnight never drops a whole new day',()=>{const r=rig({code,time:new Date(2026,8,22,23,59,55).getTime()});r.tick();r.tick();const out=result(r.tick());close(out.sum_charge_kwh_7d,1000*4/3600000,1e-6);assert.equal(r.state().excludedIntervals,0);assert.equal(r.state().buckets.length,2);});
 test(language+' minute split preserves linear zero crossing and SOC totals',()=>{const r=rig({code,time:Date.parse('2026-09-22T10:00:56Z')});r.tick({p:2000,soc:50});r.tick({p:-1000,soc:51,dt:6000});const bs=r.state().buckets;assert.equal(bs.length,2);close(bs.reduce((a,b)=>a+b[2],0),2000*4/2/3600000);close(bs.reduce((a,b)=>a+b[3],0),1000*2/2/3600000);close(bs.reduce((a,b)=>a+b[4],0),.0864);});
 test(language+' persisted corruption fails closed',()=>{const r=rig({code});r.tick();r.state().buckets=[[3,2,0,0,0,0,0]];r.boot();assert.equal(result(r.tick()).reason,'invalid_v4_state_or_configuration');});
 test(language+' rolling boundary prorates the oldest minute',()=>{const r=rig({code});r.tick();const s=r.state();const start=r.now-168*H;s.buckets=[[start,start+60000,.06,.03,0,60000,30]];r.boot();const o=result(r.tick({p:0,dt:30000}));close(o.sum_charge_kwh_7d,.03);close(o.sum_discharge_kwh_7d,.015);assert.equal(o.partial_boundary_bucket,true);r.tick({p:0,dt:30000});assert.equal(r.state().buckets.length,0);});
 test(language+' old daily data expires gradually and is never reimported',()=>{const r=rig({code,time:new Date(2026,8,22,12).getTime()});const date=local(r.now-6*24*H);r.flow.set('batt_eff_state_v3',v3(r.now,[day(date,2,1.6)]),'file');r.tick();const o=result(r.tick({dt:24*H}));close(o.imported_charge_kwh,1-2000/86400000*2,1e-6);r.tick({dt:7*24*H});assert.equal(r.state().migration.records.length,0);r.boot();assert.equal(result(r.tick()).legacy_days_in_window,0);});
}

test('old SOC capture works unchanged and its watchdog remains satisfied',()=>{
 const r=rig();r.tick();
 const prep=fs.readFileSync(path.join(ROOT,'../round-trip-efficiency/prepare-cycle.js'),'utf8');
 const ctx=new Map();class Clock extends Date{static now(){return r.now;}}
 const f=new vm.Script('(function(msg){'+prep+'})').runInNewContext({Date:Clock,flow:r.flow,context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)},node:{status(){},error(){}}});
 for(let i=0;i<12;i++) {r.tick();const pair=f({});assert.equal(pair[1],null);assert.equal(r.run(pair[0]),null);}
});
test('all generated function bodies compile and both graphs have no dangling references',()=>{
 for(const lang of ['','_DE']) {
  const nodes=JSON.parse(fs.readFileSync(path.join(ROOT,`flow${lang}.json`),'utf8'));
  const ids=new Set(nodes.map(n=>n.id));
  for(const n of nodes){
   if(n.type==='function')new vm.Script('(function(msg){'+n.func+'})');
   for(const wire of n.wires||[])for(const id of wire)assert.ok(ids.has(id),id);
   if(n.server)assert.ok(ids.has(n.server));if(n.entityConfig)assert.ok(ids.has(n.entityConfig));
  }
  assert.equal(nodes.some(n=>n.type==='api-current-state'),false);
  assert.equal(nodes.find(n=>n.type==='inject').repeat,'2');
 }
});
test('German wrapper contains the identical executable calculation core',()=>{
 const en=body.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(l=>l.split('//')[0].trimEnd()).join('\n').trim();
 const de=fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8').split('const ausgabe = (function(msg, node) {\n')[1].split('\n})(msg, knotenDeutsch);')[0].trim();
 assert.equal(en,de);
});
test('stale snapshot after successful input marks a real integration gap',()=>{
 const r=rig();r.tick();const out=r.tick({dt:8000,ts:r.now});assert.equal(result(out).reason,'missing_or_stale_snapshot');
 assert.equal(result(r.tick()).interval_status,'measurement_gap_excluded');assert.equal(r.state().buckets.length,0);
});
test('negative discharge to positive charge splits both triangles',()=>{
 const r=rig();r.tick({p:-1000});r.tick({p:2000,dt:6000});const b=r.state().buckets;
 close(b.reduce((s,x)=>s+x[2],0),2000*4/2/3600000);close(b.reduce((s,x)=>s+x[3],0),1000*2/2/3600000);
});
test('out-of-range SOC never gets clamped into a valid sample',()=>{
 for(const soc of [-1,101,null,'',true,'unknown']){const r=rig();assert.equal(result(r.tick({soc})).reason,'invalid_soc');assert.equal(r.state(),undefined);}
});
test('short restart reproduces the uninterrupted balance exactly',()=>{
 const a=rig(),b=rig();for(let i=0;i<100;i++) {const args={p:i<50?1800:-1200,soc:50+(i<50?i:100-i)*.001};a.tick(args);b.tick(args);if(i===65)b.boot();}
 assert.equal(JSON.stringify(a.state()),JSON.stringify(b.state()));
});
test('persisted full window remains bounded and only its edge is retired',()=>{
 const r=rig({time:Date.parse('2026-09-22T10:00:00Z')});r.tick({dt:0,p:0});const s=r.state(),t=r.now;
 for(let i=10080;i>0;i--)s.buckets.push([t-i*60000,t-(i-1)*60000,.01,.008,0,60000,30]);
 r.boot();const o=result(r.tick({p:0}));assert.ok(r.state().buckets.length<=10081);assert.equal(o.window_complete,true);
 close(o.sum_charge_kwh_7d,100.8-.01*2000/60000,1e-6);
 assert.ok(JSON.stringify(s).length<1500000,'minute buffer exceeds expected storage budget');
});
test('DST import respects actual local day duration rather than assuming 24 hours',()=>{
 const time=new Date(2026,9,25,23,50).getTime();const r=rig({time});r.flow.set('batt_eff_state_v3',v3(time,[day('2026-10-25')]),'file');r.tick();
 const d=r.state().migration.records[0];close(d.end-d.start,time-new Date(2026,9,25).getTime());
});
