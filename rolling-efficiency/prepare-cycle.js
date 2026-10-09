// Node-RED Function body for v5.1.0, two outputs: calculation / diagnostics.
// Run on the same flow tab as the SOC writer and snapshot builder.
// Use the existing timer after SOC capture; do not query daily counters.
const now = Date.now();
function number(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())) return null;
    const n=Number(v); return Number.isFinite(n) ? n : null;
}
try {
    const seq = (context.get("sequence", "memoryOnly") || 0) + 1;
    context.set("sequence", seq, "memoryOnly");
    const boot = context.get("boot", "memoryOnly") || now;
    context.set("boot", boot, "memoryOnly");
    // Capture once; preserve the original observation timestamp, even if invalid.
    msg._eff = {
        id: `${now}-${seq}`, ts: now,
        soc: number(flow.get("batt_level", "memoryOnly")),
        socTs: number(flow.get("batt_level_ts", "memoryOnly"))
    };
    msg.payload = null;
    const completed = number(flow.get("batt_eff_last_completed_v4", "memoryOnly"))
        ?? number(flow.get("batt_eff_last_completed_v3", "memoryOnly")) ?? boot;
    let warning = null;
    if (now - completed > 15000) {
        flow.set("la_ela_es", null, "file");
        // The calculation alone manages the mean and its clock-based expiry.
        warning = {payload: null, result: {valid: false, source_valid: false, reason: "measurement_timeout", timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}};
        node.status({fill: "red", shape: "ring", text: "No completed measurement cycle"});
    } else {
        node.status({fill: "blue", shape: "dot", text: "Reading battery power snapshot"});
    }
    return [msg, warning];
} catch (err) {
    node.error(`Context configuration error: ${err.message}`);
    return [null, {payload: null, result: {valid: false, source_valid: false, reason: "context_configuration_error", timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}}];
}
