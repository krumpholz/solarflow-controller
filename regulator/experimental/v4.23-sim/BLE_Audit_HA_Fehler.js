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
const request = msg.batteryBleAudit || {};
record({stage:"ha_call_error", command:request.command || "unknown", value:request.value ?? null,
  ts:Date.now(), cycleId:request.cycleId ?? null, requestEventSeq:request.requestEventSeq ?? null,
  message:String(msg.error?.message || "HA action error"), sourceName:msg.error?.source?.name ?? null});
return null;
