function record(event) {
  const state = flow.get("batt_ble_audit_state") || {seq:0,counters:{},lastByCommand:{}};
  state.seq = Number(state.seq || 0) + 1;
  event.eventSeq = state.seq;
  state.counters[event.stage] = Number(state.counters[event.stage] || 0) + 1;
  const per = state.lastByCommand[event.command] || {};
  per[event.stage] = event;
  state.lastByCommand[event.command] = per;
  const pending = flow.get("batt_ble_audit_pending") || [];
  pending.push(event);
  if (pending.length > 200) {
    const lost = pending.length - 200;
    pending.splice(0, lost);
    state.droppedDiagnosticEvents = Number(state.droppedDiagnosticEvents || 0) + lost;
  }
  flow.set("batt_ble_audit_state", state);
  flow.set("batt_ble_audit_pending", pending);
}
const command = "acMode";
const rawValue = msg.payload?.data?.value;
const value = typeof rawValue === "number" || (typeof rawValue === "string" && rawValue.trim() !== "") ? Number(rawValue) : NaN;
const event = {stage:"ha_call_requested", command, value:Number.isFinite(value)?value:null,
  ts:Date.now(), requestedTs:Number.isFinite(msg.ts)?msg.ts:null,
  cycleId:msg.cycleId == null ? null : String(msg.cycleId),
  directionRepeat:msg.acModeRepeat ?? null};
record(event);
msg.batteryBleAudit = {command, value:event.value, requestEventSeq:event.eventSeq,
  requestTs:event.ts, cycleId:event.cycleId};
return msg;
