// Diagnose getrennt vom bestehenden Regler-/SOC-Kontext speichern.
{
  const raw = msg.payload;
  const numeric = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "") ? Number(raw) : NaN;
  const valid = Number.isFinite(numeric) && (numeric >= 0 && numeric <= 2400);
  const value = valid ? numeric : null;
  const entity = msg.data && typeof msg.data === "object" ? msg.data : {};
  const updated = Date.parse(entity.last_updated || "");
  const reported = Date.parse(entity.last_reported || "");
  const poll = flow.get("batt_ble_diag_poll") || {};
  poll["outputLimit"] = {
    value, valid, rawState: String(entity.state ?? raw), pollTs: Date.now(),
    haUpdatedTs: Number.isFinite(updated) ? updated : null,
    haReportedTs: Number.isFinite(reported) ? reported : null
  };
  flow.set("batt_ble_diag_poll", poll);
}
return null;
