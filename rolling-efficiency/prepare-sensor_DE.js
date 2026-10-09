/*
 * Normalen HA-Sensor über den Standard-API-Knoten schreiben.
 * Keine Node-RED-Companion-Integration erforderlich. MIT-Lizenz.
 * Entitäts-IDs oben konfigurieren; Automatik vor der Aufbereitung abzweigen.
 */
const DE_TEXTE = {
    "invalid_soc": "Ladezustand fehlt oder ist ungültig",
    "soc_timestamp_required": "Zeitstempel des Ladezustands erforderlich",
    "stale_or_future_soc": "SOC-Zeitstempel veraltet oder in der Zukunft",
    "baseline_initialized": "Ausgangspunkt für neue Messintervalle gesetzt",
    "measurement_gap_excluded": "Messlücke ausgeschlossen",
    "interval_accepted": "Messintervall übernommen",
    "legacy_soc_boundaries_missing": "SOC-Grenzen der übernommenen Historie fehlen",
    "insufficient_charge_energy": "Ladeenergie für Berechnung noch zu gering",
    "efficiency_out_of_range": "Wirkungsgrad außerhalb des gültigen Bereichs",
    "context_or_runtime_error": "Kontext- oder Ausführungsfehler",
    "measurement_timeout": "Zeitüberschreitung bei der Messung",
    "context_configuration_error": "Fehler in der Kontextkonfiguration",
    "imported": "Übernommen",
    "No completed measurement cycle": "Kein abgeschlossener Messzyklus",
    "valid_measurement_resumed": "Gültige Messung wieder aufgenommen",
    "invalid_configuration": "Ungültige Konfiguration",
    "invalid_v4_state_or_configuration": "V4-Puffer oder Konfiguration ungültig – bitte prüfen",
    "expired_soc_capture": "SOC-Aufnahme abgelaufen",
    "missing_or_stale_snapshot": "Snapshot fehlt oder ist veraltet",
    "battery_fallback_excluded": "ESP-Ersatzwert ausgeschlossen",
    "invalid_battery_power": "Batterieleistung ungültig oder zu hoch",
    "soc_jump_pending": "SOC-Sprung wird geprüft",
    "confirmed_soc_jump_excluded": "Bestätigter SOC-Sprung ausgeschlossen",
    "migration_baseline_initialized": "Puffer übernommen, neuer Messausgangspunkt gesetzt",
    "calculation_available": "Wirkungsgrad berechnet",
    "no_v3_data": "Kein V3-Puffer vorhanden – Neustart",
    "disabled": "Übernahme deaktiviert",
    "invalid_v3_state": "V3-Puffer ungültig",
    "invalid_v3_cutover": "V3-Messzeitpunkt ungültig oder neuer als Snapshot",
    "v3_configuration_mismatch": "V3-Kapazität, Entitäten oder Zeitzone stimmen nicht überein",
    "mean_baseline_initialized": "Mittelwert-Ausgangspunkt gesetzt – nächstes gültiges Intervall abwarten",
    "mean_available": "Gleitender 7-Tage-Mittelwert berechnet",
    "mean_history_expired": "Keine gültigen Mittelwertintervalle mehr im 7-Tage-Fenster",
    "mean_history_unavailable": "Mittelwerthistorie nicht sicher verfügbar",
    "invalid_mean_history": "Mittelwerthistorie ungültig",
    "Invalid sensor entity ID": "Ungültige Sensor-Entitäts-ID",
    "Reading battery power snapshot": "Batterieleistung aus Snapshot wird gelesen"
};

function deutsch(text) {
    if (typeof text !== "string") return text;
    if (DE_TEXTE[text]) return DE_TEXTE[text];
    for (const [en, de] of [
        ["Efficiency calculation stopped: ", "Wirkungsgradberechnung angehalten: "],
        ["Context configuration error: ", "Fehler in der Kontextkonfiguration: "]
    ]) {
        if (text.startsWith(en)) return de + deutsch(text.slice(en.length));
    }
    return text.replace(/(\d+)d \|/, "$1 Tage |")
        .replace(/([\d.]+)h$/, "$1 Std.");
}
// Nur die Anzeige übersetzen; Speicherwerte und Berechnungen unverändert lassen.
const knotenDeutsch = {
    status: status => node.status({...status, text: deutsch(status.text)}),
    error: (...args) => node.error(deutsch(args[0]), ...args.slice(1))
};
const ausgabe = (function(msg, node) {
const SENSOR = {
    meanEntityId: "sensor.battery_efficiency_mean_7d",
    originalEntityId: "sensor.battery_efficiency",
    meanName: "Batterie Wirkungsgrad 7-Tage-Mittelwert",
    originalName: "Lade Entlade Effizenz"
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

})(msg, knotenDeutsch);
// Bestehende maschinenlesbare Diagnosefelder erhalten; deutsche Texte ergänzen.
if (Array.isArray(ausgabe)) {
    for (const nachricht of ausgabe) {
        if (!nachricht || !nachricht.result) continue;
        const r = nachricht.result;
        r.grund = deutsch(r.reason);
        if (r.mean_reason) r.mittelwertgrund = deutsch(r.mean_reason);
        if (r.source_reason) r.quellgrund = deutsch(r.source_reason);
        if (r.interval_status) r.intervallstatus = deutsch(r.interval_status);
        if (r.legacy_migration) r.pufferuebernahme = deutsch(r.legacy_migration.status);
        if (r.detail) r.detail = deutsch(r.detail);
    }
}
return ausgabe;
