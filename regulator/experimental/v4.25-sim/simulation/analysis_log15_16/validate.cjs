const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {SignedPlant,code,candidates,run,reconstruct,logs}=require('./study.cjs');
const env={idle:-19,delay:1,bias:false,readback:2,minCharge:0};
const r=logs[16][0],tc=r.execution.enteredTs/1000;
const b=new SignedPlant(r,env);b.y=b.target;const initial=b.y;b.command(tc,2,100);
const before=b.sample(tc+.074+b.m.delay_up-1e-6);assert.equal(before,initial,'actuation cannot precede its delay');
const after=b.sample(tc+10);assert(after<initial,'positive discharge command must reduce signed battery power');
assert(Math.abs(after+103.3306193546)<.001);
const physical=new SignedPlant(r,{...env,idle:0},true);physical.command(tc,2,0);assert(Math.abs(physical.sample(tc+10))<.001);
const telemetry=new SignedPlant(r,env);telemetry.command(tc,2,0);assert(Math.abs(telemetry.sample(tc+10)+19)<.001);
for(const c of candidates.slice(1))assert.notEqual(code(c),code(candidates[0]),'candidate replacement must take effect');
const tr=run(logs[16],{...env,residual:true},0,reconstruct(logs[16],env));
assert.equal(tr.length,594);const maxErr=Math.max(...tr.filter(x=>x.t>=30).map(x=>Math.abs(x.z-logs[16][x.i].inputs.p_zaehler)));assert(maxErr<1e-8,'residual-enabled nominal baseline must recover observations');
// This recovery is a consistency check, NOT independent predictive validation.
const result={checks:['actuation causality','discharge sign and steady gain/bias','physical zero-idle alternative','separate idle telemetry','all six candidate patches effective','five known skipped measurements excluded','nominal residual-enabled baseline consistency'],passed:true,maxBaselineGridErrorW:maxErr};
fs.writeFileSync(path.resolve(__dirname,'../results_regler_log15_16/Log15_16_Simulatorchecks.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
