const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const DIR=path.resolve(__dirname,'..'),RED={util:{cloneMessage:structuredClone}};
function execute(file,f,msg,t=100000){
 const fn=new Function('flow','node','msg','Date','RED',fs.readFileSync(path.join(DIR,file),'utf8'));
 return fn({get:k=>f[k],set:(k,v)=>f[k]=v},{status:()=>{}},msg,{now:()=>t,parse:Date.parse},RED);
}
test('HA completion is distinct from device acknowledgement; event identity is retained',()=>{
 const f={},msg={payload:500,cycleId:'synthetic-1',ts:99000};
 const request=execute('BLE_Audit_inputLimit.js',f,msg,100000);
 execute('BLE_Audit_HA_Abschluss.js',f,request,100025);
 execute('BLE_Audit_HA_Fehler.js',f,{...request,error:{message:'synthetic error',source:{name:'Input Limit'}}},100050);
 f.batt_ble_diag_poll={ready:{value:true,valid:true,pollTs:99990,haUpdatedTs:90000},
  inputLimit:{value:500,valid:true,pollTs:99990,haUpdatedTs:100010}};
 const status={ts:100000,mode:'REGEL_LADEN',inputs:{},outputs:{chargeW:500,dischargeW:0},
  batteryDirection:{payload:1},snapshotAttachment:{matched:true},snapshot:{cycleId:'synthetic-1'},
  batteryHttp:{fake:true},batteryHttpEvents:[{fake:true}]};
 const out=execute('Zusatzdaten_BLE.js',f,{payload:status},100100).payload;
 assert(!('batteryHttp' in out));assert(!('batteryHttpEvents' in out));
 assert.equal(out.batteryBle.deviceWriteAcknowledgement,null);
 assert.equal(out.batteryBle.eventCount,3);
 assert.equal(out.batteryBle.eventsSincePreviousCapture[1].requestEventSeq,1);
 assert.equal(out.batteryBle.eventsSincePreviousCapture[1].haCallDurationMs,25);
 assert.equal(out.batteryBle.observed.ready.haStateAgeMs,10100);
 assert.equal(out.batteryBle.observed.ready.pollAgeMs,110);
 assert.equal(out.batteryBle.limitReadback.inputLimit.matchesCurrentRequest,true);
 assert.equal(out.batteryBle.limitReadback.inputLimit.matchingStateObservedAfterHaCallMs,10);
 assert.equal(out.batteryBle.limitReadback.outputLimit.valueW,null);
 assert.equal(f.batt_ble_audit_pending.length,0);
 // Captured events remain unchanged when later requests arrive.
 execute('BLE_Audit_inputLimit.js',f,{payload:510,cycleId:'synthetic-2'},100200);
 assert.equal(out.batteryBle.eventCount,3);assert.equal(out.batteryBle.haCalls.seq,3);
});
test('bounded diagnostic buffer reports omissions',()=>{
 const f={};for(let i=0;i<205;i++)execute('BLE_Audit_outputLimit.js',f,{payload:0},100000+i);
 assert.equal(f.batt_ble_audit_pending.length,200);
 assert.equal(f.batt_ble_audit_state.droppedDiagnosticEvents,5);
});
test('unknown telemetry is not converted to a confirmed zero',()=>{
 const f={};execute('inputLimit_Ruecklesewert.js',f,{payload:null,data:{state:'unavailable'}},100000);
 assert.equal(f.batt_ble_diag_poll.inputLimit.value,null);
 assert.equal(f.batt_ble_diag_poll.inputLimit.valid,false);
 f.batt_ble_ready=false;
 assert.equal(execute('BLE_Bereitschaft_Diagnose.js',f,{payload:'off',data:{}},100000),null);
 assert.equal(f.batt_ble_diag_poll.ready.value,false);
 const inputs={p_zaehler:1,p_batterie:90,p_solar:300,p_haus:211};
 f.snapshot_last_diagnostic={state:'ok',cycleId:'same',ts:99000,values:inputs};
 let out=execute('Zusatzdaten_BLE.js',f,{payload:{ts:100000,inputs,
  snapshotCycle:{regulatorCycleId:'same'},outputs:{chargeW:100,dischargeW:0}}},100100).payload;
 assert.equal(out.snapshotAttachment.matched,true);assert.equal(out.snapshot_age_ms,1000);
 out=execute('Zusatzdaten_BLE.js',f,{payload:{ts:100000,inputs,
  snapshotCycle:{regulatorCycleId:'different'},outputs:{chargeW:100,dischargeW:0}}},100100).payload;
 assert.equal(out.snapshot,null);assert.equal(out.snapshotAttachment.matched,false);
});

test('missing BLE observers remain visible as missing coverage',()=>{
 let out=execute('Zusatzdaten_BLE.js',{}, {payload:{ts:100000,inputs:{},outputs:{chargeW:300,dischargeW:0},
   snapshotAttachment:{matched:false},batteryHttp:{legacy:true}}}).payload;
 assert.equal(out.batteryBle.schema,'1.1');
 assert.equal(out.batteryBle.ready.value,null);
 assert.equal(out.batteryBle.diagnosticCoverage.allObserversPresent,false);
 assert.equal(out.batteryBle.diagnosticCoverage.missingObserved.length,8);
 assert.equal(out.batteryBle.diagnosticCoverage.snapshotFrozenInRegulator,false);
 assert.equal(out.batteryBle.deviceWriteAcknowledgement,null);
 const values={ready:false,soc:50,batteryPower:0,packState:0,socLimit:0,acMode:1,inputLimit:300,outputLimit:0};
 const f={batt_ble_diag_poll:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:v,valid:true,pollTs:99990}]))};
 out=execute('Zusatzdaten_BLE.js',f,{payload:{ts:100000,inputs:{},outputs:{chargeW:300,dischargeW:0},
   snapshotAttachment:{matched:true},snapshot:{ts:99900}}}).payload;
 assert.equal(out.batteryBle.diagnosticCoverage.allObserversPresent,true);
 assert.equal(out.batteryBle.diagnosticCoverage.allObservedStatesValid,true);
 assert.equal(out.batteryBle.ready.value,false);
 assert.equal(out.batteryBle.diagnosticCoverage.haCallAuditObserved,false);
});
