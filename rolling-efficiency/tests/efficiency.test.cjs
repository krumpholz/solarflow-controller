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
function result(out){assert.ok(out);assert.equal(out.length,3);return out[1].result;}
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
 test(language+' explicit legacy option permits missing timestamp but never verifies it',()=>{const r=rig({code:code.replace('requireSocTimestamp: true','requireSocTimestamp: false')});const o=r.tick({message:{_eff:{ts:r.now+2000,soc:50,socTs:null}}});assert.equal(result(o).soc_freshness_verified,false);});
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

test('legacy SOC capture watchdog key remains supported',()=>{
 const r=rig();r.tick();
 const prep=fs.readFileSync(path.join(ROOT,'prepare-cycle.js'),'utf8').replaceAll('batt_eff_last_completed_v4','batt_eff_last_completed_v3');
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
  assert.equal(nodes.find(n=>n.type==='inject').repeat,'');
  assert.equal(nodes.find(n=>n.type==='inject').once,false);
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

for (const lang of ['','_DE']) {
 const code=fs.readFileSync(path.join(ROOT,`battery-efficiency${lang}.js`),'utf8');
 test(lang+' repeated failures form one persisted episode with the original cause',()=>{
  let r=rig({code});r.tick();let o;
  for(let i=0;i<20;i++)o=result(r.tick({source:'esp'}));
  assert.equal(o.recent_exclusions.length,1);assert.equal(o.recent_exclusions[0].open,true);
  assert.equal(o.exclusion_counts_by_reason.battery_fallback_excluded,1);
  r=rig({code,time:r.now,data:new Map(JSON.parse(JSON.stringify([...r.data])))});
  o=result(r.tick());const e=o.recent_exclusions[0];assert.equal(e.open,false);assert.equal(e.excluded_ms,42000);
  assert.equal(e.excluded_intervals,1);assert.equal(e.causes.battery_fallback_excluded.observations,20);
  assert.equal(e.causes.measurement_gap_excluded,undefined);
  assert.equal(e.causes.battery_fallback_excluded.last_values.battery_source,'esp');
  if(lang)assert.equal(e.ursachen[0].grund,'ESP-Ersatzwert ausgeschlossen');
 });
 test(lang+' ten-entry ring evicts oldest but retains lifetime cause counts',()=>{
  const r=rig({code});r.tick();let o;
  for(let i=0;i<12;i++){r.tick({p:3000+i});o=result(r.tick());}
  assert.equal(o.recent_exclusions.length,10);assert.equal(o.recent_exclusions[0].id,12);
  assert.equal(o.recent_exclusions[9].id,3);assert.equal(o.exclusion_counts_by_reason.invalid_battery_power,12);
  assert.equal(o.recent_exclusions[0].causes.invalid_battery_power.last_values.max_absolute_power_w,2880);
 });
 test(lang+' confirmed SOC jump aggregates three intervals with exact duration and limits',()=>{
  const r=rig({code});r.tick({soc:50});r.tick({soc:80});r.tick({soc:80});const o=result(r.tick({soc:80}));
  const e=o.recent_exclusions[0];assert.equal(e.open,false);assert.equal(e.excluded_intervals,3);
  assert.equal(e.excluded_ms,6000);assert.equal(e.resolution,'confirmed_soc_jump_excluded');
  assert.equal(o.exclusion_counts_by_reason.soc_jump_pending,1);
  const v=e.causes.soc_jump_pending.first_values;close(v.allowed_change_pct_points,2+2.88*2/3600/8.64*100);
  assert.equal(v.previous_soc_pct,50);assert.equal(v.current_soc_pct,80);
 });
 test(lang+' mixed causes within one gap are kept separately without double counting its time',()=>{
  const r=rig({code});r.tick();r.tick({source:'esp'});r.tick({p:3000});const o=result(r.tick());
  const e=o.recent_exclusions[0];assert.equal(o.recent_exclusions.length,1);assert.equal(e.excluded_ms,6000);
  assert.equal(Object.keys(e.causes).length,2);assert.equal(o.exclusion_counts_by_reason.invalid_battery_power,1);
 });
 test(lang+' upgrade of existing v4 keeps energy and records old exclusion totals without invented causes',()=>{
  const r=rig({code});r.tick();r.tick();const s=r.state();delete s.exclusionLog;s.excludedIntervals=7;s.excludedMs=62896;
  const before=JSON.stringify(s.buckets);r.boot();r.tick({id:s.last.id});
  assert.equal(JSON.stringify(s.buckets),before);assert.equal(s.exclusionLog.previous_intervals,7);
  assert.equal(s.exclusionLog.previous_ms,62896);assert.equal(s.exclusionLog.events.length,0);
  const o=result(r.tick());assert.equal(o.excluded_intervals,7);assert.equal(o.recent_exclusions.length,0);
 });
 test(lang+' transient SOC spike closes at the excluded endpoint, not the next accepted interval',()=>{
  const r=rig({code});r.tick();r.tick({soc:80});const end=r.now;const o=result(r.tick());
  const e=o.recent_exclusions[0];assert.equal(e.excluded_ms,2000);assert.equal(e.end_ts,end);
  assert.equal(e.open,false);assert.equal(e.resolution,'valid_measurement_resumed');
 });
 test(lang+' missing snapshot carries measured age and configured limit',()=>{
  const r=rig({code});r.tick();const ts=r.now;const o=result(r.tick({dt:8000,ts}));
  const v=o.recent_exclusions[0].causes.missing_or_stale_snapshot.last_values;
  assert.equal(v.age_ms,8000);assert.equal(v.max_age_ms,6500);
 });
 test(lang+' long gap and migration each record their actual interval',()=>{
  const r=rig({code});r.flow.set('batt_eff_state_v3',v3(r.now,[day(local(r.now))]),'file');
  const first=result(r.tick());assert.equal(first.recent_exclusions[0].excluded_ms,2000);
  const out=result(r.tick({dt:20000}));assert.equal(out.recent_exclusions[0].causes.measurement_gap_excluded.last_values.interval_ms,20000);
  assert.equal(out.recent_exclusions[0].excluded_ms,20000);
 });
 test(lang+' diagnostic copies cannot mutate the persistent ring',()=>{
  const r=rig({code});r.tick();const out=r.tick({p:3000});out[0].result.recent_exclusions[0].excluded_ms=999;
  assert.equal(r.state().exclusionLog.events[0].excluded_ms,0);assert.equal(out[1].result.recent_exclusions[0].excluded_ms,0);
 });
}

 test('exported Function bodies exactly match canonical language sources',()=>{
  for(const lang of ['', '_DE']) {
   const nodes=JSON.parse(fs.readFileSync(path.join(ROOT,`flow${lang}.json`),'utf8'));
   for(const [id,file] of [['v4e46be25028e13f5d','battery-efficiency'],['v4effprepare000003','prepare-cycle'],['v51effmeanprep01','prepare-sensor'],['v51effrawprep001','prepare-sensor']]) {
    assert.equal(nodes.find(n=>n.id===id).func,fs.readFileSync(path.join(ROOT,`${file}${lang}.js`),'utf8'));
   }
  }
 });

// Independent synthetic energy history yields eta=80 with no new power flow.
// One kWh charged / 0.8 kWh discharged across 100 minute records.
function meanRig(code=body) {
 const r=rig({code});r.tick({dt:0,p:0});const s=r.state(),t=r.now;
 for(let i=100;i>0;i--)s.buckets.push([t-i*60000,t-(i-1)*60000,.01,.008,0,60000,30]);
 r.boot();const out=r.tick({p:0});close(result(out).eta_raw_pct,80);
 return {r,out,eta:(pct,dt=2000)=>r.tick({p:0,soc:50+(pct-80)/8.64,dt})};
}
function fullMean(r,value=80) {
 const m=r.state().mean,t=r.now;
 m.created=t-168*H;m.buckets=[];
 for(let i=10080;i>0;i--)m.buckets.push([t-i*60000,t-(i-1)*60000,value*60000,60000]);
}
for (const language of ['EN','DE']) {
 const code=language==='EN'?body:fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8');
 test(language+' three outputs: mean first, original second, diagnostics third',()=>{
  const {r,out,eta}=meanRig(code);assert.equal(out[0].payload,null);assert.equal(out[0].result.valid,false);
  assert.equal(out[1].payload,80);assert.equal(out[2].payload,80);assert.equal(out[0].result.source_valid,true);
  assert.equal(out[0].result.reason,'mean_baseline_initialized');
  const next=eta(84);assert.equal(next[0].payload,82);assert.equal(next[1].payload,84);
  assert.equal(next[2].payload,84);assert.equal(next[0].result.valid,true);
  assert.equal(r.flow.get('la_ela_es','file'),84);assert.equal(r.flow.get('la_ela_es_mean_7d','file'),82);
  if(language==='DE')assert.equal(next[0].result.grund,'Gleitender 7-Tage-Mittelwert berechnet');
 });
 test(language+' elapsed time weights irregular intervals rather than sample counts',()=>{
  const {r,eta}=meanRig(code);eta(84,2000);const out=eta(76,8000);
  close(out[0].payload,80.4);close(out[0].result.mean_covered_hours,10000/H,1e-6);
  close(r.state().mean.buckets.reduce((sum,b)=>sum+b[2],0),82*2000+80*8000,1e-6);
 });
 test(language+' linear trace mean is invariant under additional samples',()=>{
  const a=meanRig(code),b=meanRig(code);a.eta(84,8000);
  for(const v of [81,82,83,84])b.eta(v,2000);
  close(a.r.state().mean.buckets[0][2],b.r.state().mean.buckets[0][2],1e-6);
  assert.equal(a.r.state().mean.buckets[0][3],b.r.state().mean.buckets[0][3]);
 });
 test(language+' mean uses unrounded raw eta, including the zero-percent endpoint',()=>{
  const {r,eta}=meanRig(code);eta(80.049);const out=eta(80.049);
  close(r.state().mean.last.eta,80.049,1e-9);assert.equal(out[1].payload,80);
  close(r.state().mean.buckets.reduce((sum,b)=>sum+b[2],0)/4000,80.03675,1e-9);
  const zero=rig({code});zero.tick({p:2400});let z;
  for(let i=0;i<80;i++)z=zero.tick({p:2400});assert.equal(z[0].payload,0);
 });
 test(language+' mean splits a linear interval at the minute boundary without losing area',()=>{
  const {r,eta}=meanRig(code);r.tick({p:0,dt:54000});eta(80);eta(80);
  const start=r.now,old=r.state().mean.buckets.reduce((sum,b)=>sum+b[2],0);
  eta(86,6000);const m=r.state().mean;
  assert.equal(start%60000,0);close(m.buckets.reduce((sum,b)=>sum+b[2],0)-old,83*6000,1e-6);
  // Start 4 seconds before a minute ends, then cross it in six seconds.
  r.tick({p:0,soc:50+6/8.64,dt:10000});r.tick({p:0,soc:50+6/8.64,dt:10000});
  r.tick({p:0,soc:50+6/8.64,dt:10000});r.tick({p:0,soc:50+6/8.64,dt:10000});
  r.tick({p:0,soc:50+6/8.64,dt:10000});const before=m.buckets.reduce((sum,b)=>sum+b[2],0);
  assert.equal(r.now%60000,56000);eta(80,6000);
  close(m.buckets.reduce((sum,b)=>sum+b[2],0)-before,83*6000,1e-6);
  assert.equal(m.buckets.at(-2)[1]%60000,0);
 });
 test(language+' failures retain the mean and clear the original without filling missing time',()=>{
  const {r,eta}=meanRig(code);eta(80);const before=JSON.stringify(r.state().mean.buckets);
  const bad=r.tick({source:'esp',p:0});assert.equal(bad[0].payload,80);assert.equal(bad[1].payload,null);
  assert.equal(bad[0].result.valid,true);assert.equal(bad[0].result.source_valid,false);
  assert.equal(bad[0].result.reason,'mean_available');assert.equal(bad[0].result.source_reason,'battery_fallback_excluded');
  assert.equal(bad[2].result.reason,'battery_fallback_excluded');assert.equal(r.state().mean.last,null);
  assert.equal(r.flow.get('la_ela_es_mean_7d','file'),80);assert.equal(JSON.stringify(r.state().mean.buckets),before);
  assert.equal(r.tick({p:0})[0].payload,80);eta(80);assert.equal(JSON.stringify(r.state().mean.buckets),before);
  const out=eta(80);assert.equal(out[0].payload,80);assert.equal(r.state().mean.buckets.reduce((s,b)=>s+b[3],0),4000);
  assert.equal(out[0].result.mean_window_complete,false);
 });
 test(language+' out-of-range efficiency and SOC jumps never contribute to mean history',()=>{
  const {r,eta}=meanRig(code);eta(90);const before=JSON.stringify(r.state().mean.buckets);
  const bad=eta(101);assert.equal(result(bad).reason,'efficiency_out_of_range');assert.equal(bad[0].payload,85);
  assert.equal(JSON.stringify(r.state().mean.buckets),before);assert.equal(r.state().mean.last,null);
  eta(90);assert.equal(JSON.stringify(r.state().mean.buckets),before);eta(90);
  const duration=r.state().mean.buckets.reduce((s,b)=>s+b[3],0);
  r.tick({p:0,soc:80});r.tick({p:0,soc:80});r.tick({p:0,soc:80});
  assert.equal(r.state().mean.buckets.reduce((s,b)=>s+b[3],0),duration);assert.equal(r.state().mean.last,null);
 });
 test(language+' duplicate valid snapshots do not change any mean sample or duration',()=>{
  const {r,eta}=meanRig(code);eta(80);const before=JSON.stringify(r.state());
  assert.equal(r.tick({p:0,id:r.state().last.id,soc:51}),null);assert.equal(JSON.stringify(r.state()),before);
 });
 test(language+' serialized restart retains the mean and does not manufacture restart coverage',()=>{
  const {r,eta}=meanRig(code);eta(80);const before=r.state().mean.buckets.reduce((s,b)=>s+b[3],0);
  const resumed=rig({code,time:r.now,data:new Map(JSON.parse(JSON.stringify([...r.data])))});
  const out=resumed.tick({p:0});assert.equal(out[0].payload,80);
  assert.equal(resumed.state().mean.buckets.reduce((s,b)=>s+b[3],0),before+2000);
  resumed.boot();resumed.tick({p:0,dt:30000});assert.equal(resumed.state().mean.last,null);
  assert.equal(resumed.state().mean.buckets.reduce((s,b)=>s+b[3],0),before+2000);
 });
 test(language+' upgrade retains V4 energy but begins a new empty mean history',()=>{
  const {r}=meanRig(code);const s=r.state();delete s.mean;
  const energy=JSON.stringify(s.buckets.slice(0,100)),migration=JSON.stringify(s.migration),excluded=s.excludedIntervals;
  r.boot();const out=r.tick({p:0});assert.equal(out[1].payload,80);assert.equal(out[0].payload,null);
  assert.equal(JSON.stringify(s.buckets.slice(0,100)),energy);assert.equal(JSON.stringify(s.migration),migration);
  assert.equal(s.excludedIntervals,excluded);assert.equal(s.mean.buckets.length,0);assert.equal(s.mean.created,r.now);
 });
 test(language+' V3 migration supplies an initial eta but cannot invent seven days of mean samples',()=>{
  const r=rig({code});r.flow.set('batt_eff_state_v3',v3(r.now,[day(local(r.now),1,.8)]),'file');
  const out=r.tick({p:0});assert.equal(out[1].payload,80);assert.equal(out[0].payload,null);
  assert.equal(r.state().mean.buckets.length,0);assert.equal(out[0].result.mean_history_hours,0);
  assert.equal(r.tick({p:0})[0].payload,80);
 });
 test(language+' rolling mean retires exactly the oldest fraction and remains bounded',()=>{
  const {r}=meanRig(code);fullMean(r);const m=r.state().mean;m.buckets[0][2]=60*60000;
  r.boot();const out=r.tick({p:0});const expected=(80*168*H-20*(60000-2000))/(168*H);
  close(out[0].result.eta_mean_7d_raw_pct,Number(expected.toFixed(3)),1e-9);
  assert.equal(out[0].result.mean_window_complete,true);assert.equal(out[0].result.mean_coverage_pct,100);
  assert.equal(out[0].result.mean_covered_hours,168);assert.equal(out[0].result.mean_partial_boundary_bucket,true);
  assert.ok(m.buckets.length<=10081);assert.ok(JSON.stringify(r.state()).length<2000000);
 });
 test(language+' a missing interval cannot be counted as a complete mean window',()=>{
  const {r}=meanRig(code);fullMean(r);r.state().mean.buckets[20][2]-=80*2000;r.state().mean.buckets[20][3]-=2000;
  r.boot();const out=r.tick({p:0});assert.equal(out[0].payload,80);assert.equal(out[0].result.mean_window_complete,false);
  close(out[0].result.mean_covered_hours,Number((168-2000/H).toFixed(6)),1e-9);
 });
 test(language+' an eight-day outage expires all mean records instead of displaying stale efficiency',()=>{
  const {r,eta}=meanRig(code);eta(80);const out=r.tick({p:0,dt:8*24*H});assert.equal(out[0].payload,null);
  assert.equal(r.state().mean.buckets.length,0);assert.equal(out[0].result.mean_covered_hours,0);
  assert.equal(out[0].result.eta_mean_7d_raw_pct,null);
 });
 test(language+' corrupted mean state fails closed without discarding the original energy buffer',()=>{
  for(const bad of [null,{}, {version:1,created:1,last:null,buckets:[[2,1,0,1]]},
   {version:1,created:1,last:null,buckets:[[1,2,101,1]]},
   {version:1,created:1,last:{ts:Date.parse('2030-01-01T00:00:00Z'),eta:80},buckets:[]}]) {
   const {r}=meanRig(code),s=r.state(),before=JSON.stringify(s.buckets);s.mean=bad;r.boot();
   const out=r.tick({p:0});assert.equal(result(out).reason,'invalid_v4_state_or_configuration');
   assert.equal(out[0].payload,null);assert.equal(JSON.stringify(s.buckets),before);
  }
 });
 test(language+' mean output and diagnostics are independent copies of mutable metadata',()=>{
  const {r,eta}=meanRig(code),out=eta(80);out[0].result.eta_mean_7d_pct=999;
  assert.equal(out[1].result.eta_mean_7d_pct,80);assert.equal(out[2].result.eta_mean_7d_pct,80);
  out[1].result.recent_exclusions.push({id:999});assert.equal(out[2].result.recent_exclusions.length,0);
  assert.equal(r.state().exclusionLog.events.length,0);
 });
 test(language+' UTC window duration stays 168 hours across local DST transitions',()=>{
  const r=rig({code,time:new Date(2026,9,25,3,10).getTime()});r.tick({p:0});const t=r.now,s=r.state();
  for(let i=100;i>0;i--)s.buckets.push([t-i*60000,t-(i-1)*60000,.01,.008,0,60000,30]);
  r.boot();r.tick({p:0});fullMean(r);r.boot();const out=r.tick({p:0});
  assert.equal(Date.parse(out[0].result.mean_window_end)-Date.parse(out[0].result.mean_window_start),168*H);
  assert.equal(out[0].result.mean_window_complete,true);
 });
}

test('both flows use standard HA API nodes and route warnings only to diagnostics',()=>{
 for(const lang of ['', '_DE']) {
  const nodes=JSON.parse(fs.readFileSync(path.join(ROOT,`flow${lang}.json`),'utf8'));
  const calc=nodes.find(n=>n.id==='v4e46be25028e13f5d');assert.equal(calc.outputs,3);
  assert.equal(calc.outputLabels.length,3);
  assert.deepEqual(calc.wires,[['v51effmeanprep01'],['v51effrawprep001'],['v4effdiagnostics03']]);
  assert.equal(nodes.some(n=>['ha-sensor','ha-entity-config','api-current-state'].includes(n.type)),false);
  const warning=nodes.find(n=>n.id==='v4effprepare000003').wires[1];
  assert.deepEqual(warning,['v4effdiagnostics03']);
  assert.equal(nodes.filter(n=>n.type==='ha-api').length,2);
  for(const n of nodes.filter(n=>n.type==='ha-api')) {
   assert.equal(n.version,1);assert.equal(n.protocol,'http');assert.equal(n.method,'post');
   assert.equal(n.responseType,'json');assert.equal(n.dataType,'json');
   assert.match(n.path,/^states\/sensor\./);
   assert.equal(n.outputProperties[0].property,'ha_state');
  }
  assert.deepEqual(nodes.find(n=>n.type==='catch').wires,[['v4effdiagnostics03']]);
 }
});
test('watchdog clears only original output key and never declares mean history invalid',()=>{
 for(const lang of ['', '_DE']) {
  const r=rig(),ctx=new Map();class Clock extends Date{static now(){return r.now;}}
  const prep=fs.readFileSync(path.join(ROOT,`prepare-cycle${lang}.js`),'utf8');
  const f=new vm.Script('(function(msg){'+prep+'})').runInNewContext({Date:Clock,flow:r.flow,context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)},node:{status(){},error(){}}});
  f({});r.tick({dt:16000,p:null});
  r.flow.set('la_ela_es',80,'file');r.flow.set('la_ela_es_mean_7d',79,'file');
  const out=f({});assert.equal(out[1].payload,null);
  assert.equal(out[1].result.valid,false);assert.equal(out[1].result.mean_valid,undefined);
  assert.equal(out[1].result.reason,'measurement_timeout');assert.equal(r.flow.get('la_ela_es','file'),null);
  assert.equal(r.flow.get('la_ela_es_mean_7d','file'),79);
 }
});

for(const language of ['EN','DE']) {
 const code=language==='EN'?body:fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8');
 test(language+' exact 100-percent arithmetic endpoint remains valid through SOC integration',()=>{
  const {r,eta}=meanRig(code);eta(90);const out=eta(100);
  assert.equal(out[1].payload,100);assert.equal(result(out).valid,true);
  eta(100);r.boot();assert.equal(eta(100)[1].payload,100);
 });
}

for(const language of ['EN','DE']) {
 const code=language==='EN'?body:fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8');
 test(language+' exact zero-percent endpoint is accepted, but real overshoot remains invalid',()=>{
  const {eta}=meanRig(code);for(const v of [64,48,32,16])eta(v);
  const zero=eta(0);assert.equal(zero[1].payload,0);assert.equal(result(zero).valid,true);
  const below=eta(-0.00001);assert.equal(below[0].result.valid,true);assert.equal(below[1].payload,null);
  assert.equal(result(below).reason,'efficiency_out_of_range');
  const b=meanRig(code);b.eta(90);b.eta(100);const above=b.eta(100.00001);
  assert.equal(above[1].payload,null);assert.equal(result(above).reason,'efficiency_out_of_range');
 });
}

for(const language of ['EN','DE']) {
 const code=language==='EN'?body:fs.readFileSync(path.join(ROOT,'battery-efficiency_DE.js'),'utf8');
 test(language+' both complete seven-day buffers survive serialization within a bounded storage budget',()=>{
  const {r}=meanRig(code),s=r.state(),t=r.now;fullMean(r);s.buckets=[];
  for(let i=10080;i>0;i--)s.buckets.push([t-i*60000,t-(i-1)*60000,.01,.008,0,60000,30]);
  const serialized=JSON.stringify([...r.data]);assert.ok(serialized.length<2500000);
  const b=rig({code,time:r.now,data:new Map(JSON.parse(serialized))}),out=b.tick({p:0});
  assert.equal(out[0].payload,80);assert.equal(out[0].result.mean_window_complete,true);
  assert.equal(result(out).window_complete,true);assert.ok(b.state().buckets.length<=10081);
  assert.ok(b.state().mean.buckets.length<=10081);
 });
 test(language+' re-upgrade after a V4 writer advanced its baseline excludes the missing mean interval',()=>{
  const {r,eta}=meanRig(code);eta(80);const s=r.state(),before=JSON.stringify(s.mean.buckets);
  s.last={...s.last,ts:r.now+2000,id:'v4-writer-cycle'};r.boot();const out=r.tick({p:0,dt:4000});
  assert.equal(result(out).valid,true);assert.equal(out[0].payload,80);
  assert.equal(JSON.stringify(s.mean.buckets),before);assert.equal(s.mean.last.ts,r.now);
  r.tick({p:0});assert.equal(s.mean.buckets.reduce((sum,b)=>sum+b[3],0),4000);
 });
}

function capture(r,code) {
 const ctx=new Map();class Clock extends Date{static now(){return r.now;}}
 return new vm.Script('(function(msg){'+code+'})').runInNewContext({Date:Clock,flow:r.flow,
  context:{get:k=>ctx.get(k),set:(k,v)=>ctx.set(k,v)},node:{status(){},error(){}}});
}
function sensor(code,errors=[]) {
 return new vm.Script('(function(msg){'+code+'})').runInNewContext({
  node:{status(){},error:(...args)=>errors.push(args)}});
}
for(const lang of ['', '_DE']) {
 const code=fs.readFileSync(path.join(ROOT,`battery-efficiency${lang}.js`),'utf8');
 const prep=fs.readFileSync(path.join(ROOT,`prepare-cycle${lang}.js`),'utf8');
 const format=fs.readFileSync(path.join(ROOT,`prepare-sensor${lang}.js`),'utf8');
 test(lang+' existing timer accepts SOC observed one second before capture without restamping it',()=>{
  const r=rig({code});r.flow.set('batt_level',42.5,'memoryOnly');
  r.flow.set('batt_level_ts',r.now-1000,'memoryOnly');const out=capture(r,prep)({payload:123});
  assert.equal(out[0]._eff.socTs,r.now-1000);assert.equal(out[0]._eff.ts,r.now);
  assert.equal(out[0]._eff.soc,42.5);assert.equal(out[0].payload,null);assert.equal(out[1],null);
  r.flow.set('batt_level',90,'memoryOnly');assert.equal(out[0]._eff.soc,42.5);
  const calculated=r.tick({dt:0,p:0,soc:42.5,message:out[0]});
  assert.equal(result(calculated).soc_freshness_verified,true);
  assert.equal(result(calculated).reason,'insufficient_charge_energy');
 });
 test(lang+' missing mandatory SOC timestamp pauses collection but retains historical mean',()=>{
  const {r,eta}=meanRig(code);eta(80);const before=JSON.stringify(r.state().mean.buckets);
  const out=r.tick({p:0,message:{_eff:{ts:r.now+2000,soc:50,socTs:null}}});
  assert.equal(out[0].payload,80);assert.equal(out[1].payload,null);
  assert.equal(out[0].result.source_reason,'soc_timestamp_required');
  assert.equal(out[0].result.mean_collection_paused,true);
  assert.equal(JSON.stringify(r.state().mean.buckets),before);
 });
 test(lang+' SOC capture forwards invalid readings for historical evaluation and rejects numeric overflow',()=>{
  const r=rig({code}),run=capture(r,prep);
  for(const v of [null,'unknown','',true,'1e999',Infinity]) {
   r.flow.set('batt_level',v,'memoryOnly');const out=run({});
   assert.ok(out[0]);assert.equal(out[0]._eff.soc,null);
  }
 });
 test(lang+' short source failures retain mean availability without contributing zero or held samples',()=>{
  for(const args of [{soc:null},{p:null},{p:3000},{source:'esp'},
   {dt:8000,meta:{snapshot_last_ok_quality:'invalid'}},
   {message:{_eff:{ts:Date.parse('2026-09-22T10:00:06Z'),soc:50,socTs:0}}}]) {
   const {r,eta}=meanRig(code);eta(80);const before=JSON.stringify(r.state().mean.buckets);
   const out=r.tick({p:0,...args});assert.equal(out[0].payload,80);
   assert.equal(out[0].result.valid,true);assert.equal(out[0].result.source_valid,false);
   assert.equal(out[0].result.reason,'mean_available');assert.equal(out[1].payload,null);
   assert.equal(r.state().mean.last,null);assert.equal(JSON.stringify(r.state().mean.buckets),before);
   assert.equal(r.flow.get('la_ela_es_mean_7d','file'),80);
  }
 });
 test(lang+' continuing timer moves the window and discloses sample age during a SOC outage',()=>{
  const {r,eta}=meanRig(code);eta(80);const end=r.now,before=JSON.stringify(r.state().mean.buckets);
  let out;for(let i=0;i<20;i++)out=r.tick({p:0,soc:null});
  assert.equal(out[0].payload,80);assert.equal(out[0].result.mean_sample_age_seconds,40);
  assert.equal(out[0].result.mean_last_sample_at,new Date(end).toISOString());
  assert.equal(Date.parse(out[0].result.mean_window_end),r.now);
  assert.equal(Date.parse(out[0].result.mean_window_end)-Date.parse(out[0].result.mean_window_start),168*H);
  assert.equal(JSON.stringify(r.state().mean.buckets),before);
 });
 test(lang+' partial oldest mean bucket expires against the clock while SOC remains invalid',()=>{
  const {r}=meanRig(code);fullMean(r);r.state().mean.buckets[0][2]=60*60000;r.boot();
  const out=r.tick({p:0,soc:null,dt:30000}),coverage=168*H-30000;
  close(out[0].result.eta_mean_7d_raw_pct,Number(((80*coverage-20*30000)/coverage).toFixed(3)));
  close(out[0].result.mean_covered_hours,Number((coverage/H).toFixed(6)));
  assert.equal(out[0].result.mean_window_complete,false);assert.equal(out[0].result.mean_sample_age_seconds,30);
 });
 test(lang+' all expired history becomes unknown during an ongoing outage',()=>{
  const {r,eta}=meanRig(code);eta(80);const out=r.tick({p:0,soc:null,dt:8*24*H});
  assert.equal(out[0].payload,null);assert.equal(out[0].result.valid,false);
  assert.equal(out[0].result.reason,'mean_history_expired');assert.equal(out[0].result.source_reason,'invalid_soc');
  assert.equal(r.state().mean.buckets.length,0);assert.equal(r.flow.get('la_ela_es_mean_7d','file'),null);
 });
 test(lang+' serialized restart during an outage retains mean and does not bridge recovery',()=>{
  const {r,eta}=meanRig(code);eta(80);const duration=r.state().mean.buckets.reduce((s,b)=>s+b[3],0);
  const restored=rig({code,time:r.now,data:new Map(JSON.parse(JSON.stringify([...r.data])))});
  const out=restored.tick({soc:null,p:0});assert.equal(out[0].payload,80);
  restored.tick({p:0});restored.tick({p:0});
  assert.equal(restored.state().mean.buckets.reduce((s,b)=>s+b[3],0),duration);
  restored.tick({p:0});assert.equal(restored.state().mean.buckets.reduce((s,b)=>s+b[3],0),duration+2000);
 });
 test(lang+' runtime/context failure cannot claim that mean history is trusted',()=>{
  const {r,eta}=meanRig(code);eta(80);const original=r.flow.get;
  const duration=r.state().mean.buckets.reduce((s,b)=>s+b[3],0);
  r.flow.get=(k,...args)=>{if(k==='p_batterie')throw Error('context read failed');return original(k,...args);};
  const out=r.tick({p:0});assert.equal(out[0].payload,null);
  assert.equal(out[0].result.reason,'mean_history_unavailable');
  assert.equal(out[0].result.source_reason,'context_or_runtime_error');
  assert.equal(r.flow.get('la_ela_es_mean_7d','file'),null);
  r.flow.get=original;const resumed=r.tick({p:0});
  assert.equal(result(resumed).interval_status,'measurement_gap_excluded');
  assert.equal(resumed[0].payload,80);
  assert.equal(r.state().mean.buckets.reduce((s,b)=>s+b[3],0),duration);
 });
 test(lang+' mean can remain available after charge throughput becomes insufficient',()=>{
  const {r,eta}=meanRig(code);eta(80);r.state().buckets=[];r.boot();
  const out=r.tick({p:0});assert.equal(out[0].payload,80);assert.equal(out[1].payload,null);
  assert.equal(out[0].result.source_reason,'insufficient_charge_energy');
 });
 test(lang+' API payload publishes retained mean with valid true and source valid false',()=>{
  const {r,eta}=meanRig(code);eta(80);const out=r.tick({soc:null,p:0});
  const request=sensor(format)(out[0]).payload;
  assert.equal(request.protocol,'http');assert.equal(request.method,'post');
  assert.equal(request.path,'/states/sensor.battery_efficiency_mean_7d');
  assert.equal(request.data.state,'80');assert.equal(request.data.attributes.valid,true);
  assert.equal(request.data.attributes.source_valid,false);assert.equal(request.data.attributes.collection_paused,true);
  assert.equal(request.data.attributes.quality,'mean_available');
  assert.equal(request.data.attributes.unit_of_measurement,'%');assert.equal(request.data.attributes.state_class,'measurement');
  assert.equal(request.data.attributes.sample_age_seconds,2);
 });
 test(lang+' API payload accepts true zero but maps invalid readings to unknown',()=>{
  const run=sensor(format);
  assert.equal(run({payload:0,result:{valid:true,output:'mean_7d'}}).payload.data.state,'0');
  for(const value of [null,undefined,'0',true,NaN,Infinity,-1,101]) {
   const request=run({payload:value,result:{valid:true}}).payload;
   assert.equal(request.data.state,'unknown');assert.equal(request.data.attributes.valid,false);
  }
  assert.equal(run({payload:80,result:{valid:false}}).payload.data.state,'unknown');
 });
 test(lang+' optional watchdog sensor path addresses only the original sensor',()=>{
  const r=rig({code}),run=capture(r,prep);run({});r.tick({dt:16000,soc:null});
  const warning=run({})[1],request=sensor(format)(warning).payload;
  assert.equal(request.path,'/states/sensor.battery_efficiency');assert.equal(request.data.state,'unknown');
 });
 test(lang+' sensor target IDs are configurable and invalid domains stop the request',()=>{
  const errors=[],good=format.replace('sensor.battery_efficiency_mean_7d','sensor.mein_mittelwert');
  assert.equal(sensor(good)({payload:80,result:{valid:true,output:'mean_7d'}}).payload.path,'/states/sensor.mein_mittelwert');
  const bad=format.replace('sensor.battery_efficiency_mean_7d','switch.battery');
  assert.equal(sensor(bad,errors)({payload:80,result:{valid:true,output:'mean_7d'}}),null);assert.equal(errors.length,1);
 });
 test(lang+' release and calculation versions advance while persisted schemas stay compatible',()=>{
  const {r,eta}=meanRig(code),out=eta(80);
  for(const msg of out){assert.equal(msg.result.release_version,'5.1.0');assert.equal(msg.result.calculation_revision,'5.1');}
  assert.equal(r.state().version,4);assert.equal(r.state().mean.version,1);
  assert.equal(fs.readFileSync(path.join(ROOT,'..','VERSION'),'utf8').trim(),'5.1.0');
 });
}
