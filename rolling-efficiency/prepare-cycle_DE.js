/*
 * Batterie Wirkungsgrad – gleitende 168 Stunden, Version 4.0.
 * Deutsche Oberfläche, identischer englischer Rechenkern. MIT-Lizenz.
 * Kapazität und Leistung oben im CFG des Rechenkerns prüfen.
 * Snapshot-Werte aus dem Standard-Flow-Speicher, SOC aus memoryOnly.
 * Neuer Puffer: batt_eff_state_v4 im Dateispeicher file mit Cache.
 * Vorhandener V3-Puffer wird einmal übernommen und nicht verändert.
 * Alte Tageswerte: gleichmäßige zeitliche Gewichtung als Übergangsnäherung.
 * Minutenpuffer: älteste angeschnittene Minute anteilig gewichten.
 * Zwei Ausgänge: HA-Wirkungsgrad / Diagnose. Anleitung: README_DE.md.
 */
const DE_TEXTE = {
    "missing_or_expired_cycle": "Messzyklus fehlt oder ist abgelaufen",
    "inconsistent_cycle_snapshot": "Widersprüchliche SOC-Daten im Messzyklus",
    "unexpected_entity": "Unbekannte oder falsche Entität",
    "invalid_energy_value": "Ungültiger Energiewert",
    "energy_unit_must_be_kWh": "Energieeinheit muss kWh sein",
    "invalid_counter_reset_timestamp": "Ungültiger Zeitstempel der Zählerrücksetzung",
    "daily_counter_not_reset_for_today": "Tageszähler noch nicht für heute zurückgesetzt",
    "incomplete_previous_cycle": "Vorheriger Messzyklus unvollständig",
    "invalid_soc": "Ladezustand fehlt oder ist ungültig",
    "soc_timestamp_required": "Zeitstempel des Ladezustands erforderlich",
    "stale_or_future_soc": "SOC-Zeitstempel veraltet oder in der Zukunft",
    "invalid_capacity": "Ungültige Batteriekapazität",
    "invalid_persisted_state_requires_review": "Gespeicherter Zustand ungültig – bitte prüfen",
    "baseline_initialized": "Ausgangspunkt für neue Messintervalle gesetzt",
    "configuration_changed_new_baseline": "Konfiguration geändert – neuer Ausgangspunkt",
    "non_increasing_sample_time": "Messzeitpunkt liegt nicht nach der letzten Messung",
    "waiting_for_daily_counter_resets": "Warte auf Rücksetzung beider Tageszähler",
    "new_day_boundary_excluded": "Tageswechselintervall ausgeschlossen",
    "measurement_gap_excluded": "Messlücke ausgeschlossen",
    "counter_reset_interval_excluded": "Intervall mit Zählerrücksetzung ausgeschlossen",
    "counter_jump_interval_excluded": "Intervall mit Zählersprung ausgeschlossen",
    "counter_energy_pending": "Energiezuwachs zurückgestellt – Messausgangspunkt bleibt erhalten",
    "counter_decrease_pending": "Sinkender Zählerstand ohne Rücksetzungsnachweis – warte auf Klärung",
    "invalid_energy_guard_configuration": "Ungültige Einstellung der Energie-Plausibilitätsprüfung",
    "soc_jump_rejected": "Unplausibler SOC-Sprung verworfen",
    "confirmed_soc_jump_interval_excluded": "Bestätigter SOC-Sprung – Intervall ausgeschlossen",
    "interval_accepted": "Messintervall übernommen",
    "legacy_soc_boundaries_missing": "SOC-Grenzen der übernommenen Historie fehlen",
    "insufficient_charge_energy": "Ladeenergie für Berechnung noch zu gering",
    "efficiency_out_of_range": "Wirkungsgrad außerhalb des gültigen Bereichs",
    "estimate_available": "Wirkungsgradschätzung verfügbar",
    "legacy_estimate_available": "Schätzung mit übernommener Historie – historische Genauigkeit ungeprüft",
    "context_or_runtime_error": "Kontext- oder Ausführungsfehler",
    "measurement_timeout": "Zeitüberschreitung bei der Messung",
    "context_configuration_error": "Fehler in der Kontextkonfiguration",
    "imported": "Übernommen",
    "no_legacy_data": "Keine bisherigen Pufferdaten vorhanden",
    "skipped_configuration_change": "Wegen Konfigurationsänderung nicht erneut übernommen",
    "No completed measurement cycle": "Kein abgeschlossener Messzyklus",
    "Requesting paired daily counters": "Zusammengehörige Tageszähler werden abgefragt",
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
const now = Date.now();
const number = v => (typeof v === "number" && Number.isFinite(v)) ? v :
    (typeof v === "string" && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())) ? Number(v) : null;
try {
    const seq = (context.get("sequence", "memoryOnly") || 0) + 1;
    context.set("sequence", seq, "memoryOnly");
    const boot = context.get("boot", "memoryOnly") || now;
    context.set("boot", boot, "memoryOnly");

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

})(msg, knotenDeutsch);
// Bestehende maschinenlesbare Diagnosefelder erhalten; deutsche Texte ergänzen.
if (Array.isArray(ausgabe)) {
    for (const nachricht of ausgabe) {
        if (!nachricht || !nachricht.result) continue;
        const r = nachricht.result;
        r.grund = deutsch(r.reason);
        if (r.interval_status) r.intervallstatus = deutsch(r.interval_status);
        if (r.legacy_migration) r.pufferuebernahme = deutsch(r.legacy_migration.status);
        if (r.detail) r.detail = deutsch(r.detail);
    }
}
return ausgabe;
