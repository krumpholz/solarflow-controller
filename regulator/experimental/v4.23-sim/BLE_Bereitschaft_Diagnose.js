// Diagnose getrennt vom bestehenden Regler-/SOC-Kontext speichern.
{
  const raw = msg.payload;
  const valid = raw === "on" || raw === "off" || raw === true || raw === false;
  const value = valid ? (raw === "on" || raw === true) : null;
  const entity = msg.data && typeof msg.data === "object" ? msg.data : {};
  const updated = Date.parse(entity.last_updated || "");
  const reported = Date.parse(entity.last_reported || "");
  const poll = flow.get("batt_ble_diag_poll") || {};
  poll["ready"] = {
    value, valid, rawState: String(entity.state ?? raw), pollTs: Date.now(),
    haUpdatedTs: Number.isFinite(updated) ? updated : null,
    haReportedTs: Number.isFinite(reported) ? reported : null
  };
  flow.set("batt_ble_diag_poll", poll);
}
return flow.get("batt_ble_ready") === true ? msg : null;
