// Node-RED Function body, two outputs: snapshot trigger / watchdog status.
// Run on the same flow tab as the existing batt_level writer.
const now = Date.now();
const number = v => (typeof v === "number" && Number.isFinite(v)) ? v :
    (typeof v === "string" && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())) ? Number(v) : null;
try {
    const seq = (context.get("sequence", "memoryOnly") || 0) + 1;
    context.set("sequence", seq, "memoryOnly");
    const boot = context.get("boot", "memoryOnly") || now;
    context.set("boot", boot, "memoryOnly");
    // Capture the SOC once; the calculation uses this SOC snapshot.
    msg._eff = {
        id: `${now}-${seq}`, ts: now,
        soc: number(flow.get("batt_level", "memoryOnly")),
        socTs: number(flow.get("batt_level_ts", "memoryOnly"))
    };
    msg.payload = null;
    const completed = flow.get("batt_eff_last_completed_v4", "memoryOnly") || boot;
    let warning = null;
    if (now - completed > 15000) {
        flow.set("la_ela_es", null, "file");
        warning = {payload: null, result: {valid: false, reason: "measurement_timeout", timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}};
        node.status({fill: "red", shape: "ring", text: "No completed measurement cycle"});
    } else {
        node.status({fill: "blue", shape: "dot", text: "Reading battery power snapshot"});
    }
    return [msg, warning];
} catch (err) {
    node.error(`Context configuration error: ${err.message}`);
    return [null, {payload: null, result: {valid: false, reason: "context_configuration_error", timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}}];
}
