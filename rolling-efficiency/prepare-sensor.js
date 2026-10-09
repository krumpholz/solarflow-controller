/*
 * Prepare a normal Home Assistant state sensor through the standard API node.
 * No Node-RED Companion integration required. Configure entity IDs here.
 * Connect automations to calculation output 1 before this payload conversion.
 */
const SENSOR = {
    meanEntityId: "sensor.battery_efficiency_mean_7d",
    originalEntityId: "sensor.battery_efficiency",
    meanName: "Battery Efficiency 7-Day Mean",
    originalName: "Battery Efficiency"
};
const r=msg.result || {}, mean=r.output==="mean_7d";
const entityId=mean ? SENSOR.meanEntityId : SENSOR.originalEntityId;
if (!/^sensor\.[a-z0-9_]+$/.test(entityId)) {
    node.error("Invalid sensor entity ID",msg);
    return null;
}
const value=msg.payload;
const valid=r.valid===true && typeof value==="number" && Number.isFinite(value) && value>=0 && value<=100;
const attributes={
    friendly_name:mean ? SENSOR.meanName : SENSOR.originalName,
    icon:"mdi:battery-sync",unit_of_measurement:"%",state_class:"measurement",
    valid,quality:r.reason || "missing_diagnostics",last_measurement:r.timestamp || null,
    release_version:r.release_version || "5.1.0",calculation_revision:r.calculation_revision || "5.1",
    covered_hours:(mean ? r.mean_covered_hours : r.covered_hours) ?? null
};
if (r.grund) attributes.quality_de=r.grund;
if (mean) Object.assign(attributes,{
    coverage_pct:r.mean_coverage_pct ?? null,window_complete:r.mean_window_complete===true,
    source_valid:r.source_valid===true,source_reason:r.source_reason || null,
    collection_paused:r.mean_collection_paused===true,
    last_valid_mean_sample:r.mean_last_sample_at || null,
    sample_age_seconds:r.mean_sample_age_seconds ?? null,
    window_start:r.mean_window_start || null,window_end:r.mean_window_end || null
});
else attributes.soc_freshness_verified=r.soc_freshness_verified===true;
msg.payload={
    protocol:"http",method:"post",path:`/states/${entityId}`,
    data:{state:valid ? String(value) : "unknown",attributes}
};
return msg;
