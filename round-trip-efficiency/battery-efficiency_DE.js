/*
 * Batterie-Wirkungsgrad – deutsche Alternative mit identischer Berechnung.
 * Automatisch erzeugt mit build-german-flow.py; Änderungen am Rechenkern
 * gehören in die englischen Quelldateien, danach beide Fassungen erzeugen.
 * MIT-Lizenz. Unabhängiges Projekt; siehe ../NOTICE_DE.md.
 * Anleitung und Pufferübernahme: README_DE.md.
 *
 * Vorbereitung: SOC einmal aufnehmen und beide Tageszähler gemeinsam abfragen.
 * Berechnung: Nur zusammengehörige Energie- und SOC-Intervalle einbeziehen.
 * Vorhandenen v2-Puffer einmal übernehmen, sichern und nicht doppelt zählen.
 * Summen und Messausgangspunkt gemeinsam im Dateispeicher ablegen.
 * Ungültige Eingaben und unklare Intervalle nicht als Energie verbuchen.
 * null am Sensorausgang bedeutet Unbekannt, nicht null Prozent Wirkungsgrad.
 * Kapazität 8.640 kWh und maximale Leistung 2.4 kW an die Anlage anpassen.
 * requireSocTimestamp nach Ergänzen von batt_level_ts auf true setzen.
 * Technische Schlüssel bleiben für bestehende Auswertungen unverändert.
 * Deutsche Diagnosefelder: grund, intervallstatus und pufferuebernahme.
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
    "legacy_history_imported_new_baseline": "Vorhandene Historie übernommen – neuer Messausgangspunkt",
    "waiting_for_daily_counter_resets": "Warte auf Rücksetzung beider Tageszähler",
    "new_day_boundary_excluded": "Tageswechselintervall ausgeschlossen",
    "measurement_gap_excluded": "Messlücke ausgeschlossen",
    "counter_reset_interval_excluded": "Intervall mit Zählerrücksetzung ausgeschlossen",
    "counter_jump_interval_excluded": "Intervall mit Zählersprung ausgeschlossen",
    "soc_jump_rejected": "Unplausibler SOC-Sprung verworfen",
    "confirmed_soc_jump_interval_excluded": "Bestätigter SOC-Sprung – Intervall ausgeschlossen",
    "interval_accepted": "Messintervall übernommen",
    "legacy_soc_boundaries_missing": "SOC-Grenzen der übernommenen Historie fehlen",
    "insufficient_charge_energy": "Ladeenergie für Berechnung noch zu gering",
    "efficiency_out_of_range": "Wirkungsgrad außerhalb des gültigen Bereichs",
    "estimate_available": "Wirkungsgradschätzung verfügbar",
    "context_or_runtime_error": "Kontext- oder Ausführungsfehler",
    "measurement_timeout": "Zeitüberschreitung bei der Messung",
    "context_configuration_error": "Fehler in der Kontextkonfiguration",
    "imported": "Übernommen",
    "no_legacy_data": "Keine bisherigen Pufferdaten vorhanden",
    "skipped_configuration_change": "Wegen Konfigurationsänderung nicht erneut übernommen",
    "No completed measurement cycle": "Kein abgeschlossener Messzyklus",
    "Requesting paired daily counters": "Zusammengehörige Tageszähler werden abgefragt",
    "Legacy migration: invalid calendar date; original data retained": "Pufferübernahme: ungültiges Datum; Originaldaten bleiben erhalten",
    "Legacy migration: future date; check the runtime timezone/clock": "Pufferübernahme: Datum liegt in der Zukunft; Zeitzone und Uhrzeit prüfen",
    "Legacy migration: invalid energy value; original data retained": "Pufferübernahme: ungültiger Energiewert; Originaldaten bleiben erhalten",
    "Legacy migration requires the original version-2 seven-slot kWh ring": "Pufferübernahme benötigt den ursprünglichen kWh-Ring der Version 2 mit sieben Speicherplätzen"
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
    return text.replace("% estimate |", "% geschätzt |")
        .replace(/(\d+)d \|/, "$1 Tage |")
        .replace(/([\d.]+)h$/, "$1 Std.");
}
// Nur die Anzeige übersetzen; Speicherwerte und Berechnungen unverändert lassen.
const knotenDeutsch = {
    status: status => node.status({...status, text: deutsch(status.text)}),
    error: (...args) => node.error(deutsch(args[0]), ...args.slice(1))
};
const ausgabe = (function(msg, node) {
const CFG = {
    chargeEntity: "sensor.batterie_lade_energie_pro_tag",
    dischargeEntity: "sensor.batterie_entlade_energie_pro_tag",
    capacityKWh: 8.640,
    maxPowerKW: 2.4,
    counterToleranceKWh: 0.02,
    minChargeKWh: 0.1,
    cycleTimeoutMs: 4000,
    maxIntervalMs: 120000,
    maxSocAgeMs: 15000,
    requireSocTimestamp: false,
    socStepTolerancePct: 2,
    socRebaseConfirmations: 3,
    socConfirmationTolerancePct: 1
};
const MEM = "memoryOnly", FILE = "file";
const STATE = "batt_eff_state_v3";
const now = Date.now();
const clone = value => JSON.parse(JSON.stringify(value));
function num(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
const finite = v => typeof v === "number" && Number.isFinite(v);
const rounded = (v, digits = 3) => v === null ? null : Number(v.toFixed(digits));
function dateOf(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ordinal(date) {
    const parts = date.split("-").map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000;
}
function failure(reason) {
    flow.set("la_ela_es", null, FILE);
    node.status({fill: "yellow", shape: "ring", text: reason});
    const out = {payload: null, result: {valid: false, reason, timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}};
    return [out, clone(out)];
}
function validSample(s) {
    return s && finite(s.ts) && s.ts > 0 && s.date === dateOf(s.ts) &&
        finite(s.charge) && s.charge >= 0 && finite(s.discharge) && s.discharge >= 0 &&
        finite(s.soc) && s.soc >= 0 && s.soc <= 100 &&
        [s.chargeReset, s.dischargeReset].every(v => v === null || (finite(v) && v >= 0));
}
function validState(s) {
    return s && s.version === 3 && s.unit === "kWh" && typeof s.fingerprint === "string" &&
        (s.last === null || validSample(s.last)) && Array.isArray(s.days) && s.days.length <= 7 &&
        new Set(s.days.map(d => d.date)).size === s.days.length &&
        s.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
            [d.charge, d.discharge, d.coveredMs, d.gaps, d.gapMs, d.intervals].every(v => finite(v) && v >= 0) &&
            Number.isInteger(d.intervals) && Number.isInteger(d.gaps) && finite(d.delta));
}


function migrateLegacy(state, sample) {
    if (state.legacyMigration) return false;
    const sources = {
        ring: flow.get("batt_eff_ring_7d", FILE) ?? null,
        live: flow.get("batt_eff_today_live", MEM) ?? null,
        snapshot: flow.get("batt_eff_today_live_snapshot", FILE) ?? null
    };
    const report = {at: sample.ts, importedDates: [], overlappingDates: [], source: "legacy_v2", coverageKnown: false};
    if (!sources.ring && !sources.live && !sources.snapshot) {
        state.legacyMigration = {...report, status: "no_legacy_data"};
        return false;
    }

    if (!flow.get("batt_eff_legacy_backup_v3", FILE)) {
        flow.set("batt_eff_legacy_backup_v3", clone({at: sample.ts, ...sources}), FILE);
    }
    const records = new Map();
    function add(slot, overwrite) {
        if (!slot || slot.date === null) return;
        if (typeof slot.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) ||
            new Date(ordinal(slot.date) * 86400000).toISOString().slice(0, 10) !== slot.date) {
            throw Error("Legacy migration: invalid calendar date; original data retained");
        }
        const age = ordinal(sample.date) - ordinal(slot.date);
        if (age < 0) throw Error("Legacy migration: future date; check the runtime timezone/clock");
        if (age > 6) return;
        const charge = num(slot.chargeKWh), discharge = num(slot.dischargeKWh);
        if (charge === null || discharge === null || charge < 0 || discharge < 0) {
            throw Error("Legacy migration: invalid energy value; original data retained");
        }
        const start = num(slot.socStart), end = num(slot.socEnd);
        const known = start !== null && end !== null && start >= 0 && start <= 100 && end >= 0 && end <= 100;
        if (overwrite || !records.has(slot.date)) records.set(slot.date, {charge, discharge, start, end, known});
    }
    if (sources.ring) {
        const ring = sources.ring;
        if (ring.version !== 2 || ring.unit !== "kWh" || !Array.isArray(ring.slots) ||
            ring.slots.length !== 7 || !Number.isInteger(ring.head) || ring.head < -1 || ring.head > 6) {
            throw Error("Legacy migration requires the original version-2 seven-slot kWh ring");
        }

        for (let i = 1; i <= 7; i++) add(ring.slots[(ring.head + i + 7) % 7], true);
    }
    add(sources.snapshot, false);
    add(sources.live, true);
    for (const [date, record] of records) {
        const existing = state.days.find(d => d.date === date);
        if (existing) {



            const last = state.last;
            if (last && last.date === date && existing.gaps === 0 && !existing.legacy &&
                record.charge <= last.charge - existing.charge + 1e-9 &&
                record.discharge <= last.discharge - existing.discharge + 1e-9) {
                existing.charge += record.charge;
                existing.discharge += record.discharge;
                existing.delta += record.known ? CFG.capacityKWh * (record.end - record.start) / 100 : 0;
                Object.assign(existing, {legacy: true, legacySocKnown: record.known,
                    legacySocStart: record.start, legacySocEnd: record.end});
                report.importedDates.push(date);
                continue;
            }



            report.overlappingDates.push(date);
            continue;
        }
        state.days.push({date, charge: record.charge, discharge: record.discharge,
            delta: record.known ? CFG.capacityKWh * (record.end - record.start) / 100 : 0,
            coveredMs: 0, gaps: 0, gapMs: 0, intervals: 0,
            legacy: true, legacySocKnown: record.known,
            legacySocStart: record.start, legacySocEnd: record.end});
        report.importedDates.push(date);
    }
    state.legacyMigration = {...report, status: "imported"};
    return report.importedDates.length > 0;
}
try {
    const cycle = msg._eff;
    if (!cycle || typeof cycle.id !== "string" || !finite(cycle.ts) || now < cycle.ts || now - cycle.ts > CFG.cycleTimeoutMs) {
        return failure("missing_or_expired_cycle");
    }
    let pending = context.get("pending", MEM);
    const finished = context.get("finished", MEM);
    if (finished && cycle.ts <= finished.ts) return null;
    if (pending && cycle.ts < pending.ts) return null;
    const lostPair = pending && pending.id !== cycle.id;
    if (!pending || pending.id !== cycle.id) pending = {id: cycle.id, ts: cycle.ts, soc: cycle.soc, socTs: cycle.socTs};
    if (cycle.ts !== pending.ts || cycle.soc !== pending.soc || cycle.socTs !== pending.socTs) return failure("inconsistent_cycle_snapshot");
    const entity = msg.data && msg.data.entity_id;
    const side = entity === CFG.chargeEntity ? "charge" : entity === CFG.dischargeEntity ? "discharge" : null;
    if (!side) return failure("unexpected_entity");

    const data = msg.data || {};
    const raw = Object.prototype.hasOwnProperty.call(data, "original_state") ? data.original_state :
        Object.prototype.hasOwnProperty.call(data, "state") ? data.state : msg.payload;
    const value = num(raw);
    if (value === null || value < 0) return failure("invalid_energy_value");
    if (!data.attributes || data.attributes.unit_of_measurement !== "kWh") return failure("energy_unit_must_be_kWh");
    let reset = null;
    if (data.attributes.last_reset !== undefined && data.attributes.last_reset !== null) {
        reset = Date.parse(data.attributes.last_reset);
        if (!finite(reset) || reset > now) return failure("invalid_counter_reset_timestamp");
        if (dateOf(reset) !== dateOf(cycle.ts)) return failure("daily_counter_not_reset_for_today");
    }
    if (pending[side]) return null;
    pending[side] = {value, reset};
    context.set("pending", pending, MEM);
    if (!pending.charge || !pending.discharge) return lostPair ? failure("incomplete_previous_cycle") : null;
    context.set("pending", null, MEM);
    context.set("finished", {ts: cycle.ts}, MEM);
    const soc = num(pending.soc), socTs = num(pending.socTs);
    if (soc === null || soc < 0 || soc > 100) return failure("invalid_soc");
    if (socTs === null && CFG.requireSocTimestamp) return failure("soc_timestamp_required");
    if (socTs !== null && (socTs > cycle.ts || cycle.ts - socTs > CFG.maxSocAgeMs)) return failure("stale_or_future_soc");
    if (!finite(CFG.capacityKWh) || CFG.capacityKWh <= 0) return failure("invalid_capacity");
    const sample = {ts: cycle.ts, date: dateOf(cycle.ts), soc,
        charge: pending.charge.value, discharge: pending.discharge.value,
        chargeReset: pending.charge.reset, dischargeReset: pending.discharge.reset};
    const fingerprint = JSON.stringify([CFG.capacityKWh, CFG.chargeEntity, CFG.dischargeEntity,
        Intl.DateTimeFormat().resolvedOptions().timeZone]);
    const saved = flow.get(STATE, FILE);
    if (saved !== undefined && saved !== null && !validState(saved)) return failure("invalid_persisted_state_requires_review");
    let state = saved ? clone(saved) : {version: 3, unit: "kWh", fingerprint, last: null, days: []};
    let reason = "baseline_initialized";
    if (state.fingerprint !== fingerprint) {
        flow.set("batt_eff_previous_state_v3", state, FILE);
        state = {version: 3, unit: "kWh", fingerprint, last: null, days: [],
            legacyMigration: {status: "skipped_configuration_change"}};
        reason = "configuration_changed_new_baseline";
    }
    const prev = state.last;
    if (prev && sample.ts <= prev.ts) return failure("non_increasing_sample_time");
    state.days = state.days.filter(d => ordinal(sample.date) - ordinal(d.date) >= 0 && ordinal(sample.date) - ordinal(d.date) <= 6);
    const migrated = migrateLegacy(state, sample);
    if (migrated && !prev) reason = "legacy_history_imported_new_baseline";
    let day = state.days.find(d => d.date === sample.date);
    if (!day) {
        day = {date: sample.date, charge: 0, discharge: 0, delta: 0, coveredMs: 0, gaps: 0, gapMs: 0, intervals: 0};
        state.days.push(day);
    }
    state.days.sort((a, b) => a.date.localeCompare(b.date));
    let acceptedInterval = false;
    if (prev) {
        const dt = sample.ts - prev.ts;
        const dc = sample.charge - prev.charge, dd = sample.discharge - prev.discharge;
        if (sample.date !== prev.date) {


            const resetSeen = side => sample[`${side}Reset`] !== null || sample[side] < prev[side] || (prev[side] === 0 && sample[side] === 0);
            if (!resetSeen("charge") || !resetSeen("discharge")) return failure("waiting_for_daily_counter_resets");
            reason = "new_day_boundary_excluded";
        } else if (dt > CFG.maxIntervalMs) {
            reason = "measurement_gap_excluded";
        } else if (sample.chargeReset !== prev.chargeReset || sample.dischargeReset !== prev.dischargeReset || dc < 0 || dd < 0) {
            reason = "counter_reset_interval_excluded";
        } else if (dc > CFG.maxPowerKW * dt / 3600000 + CFG.counterToleranceKWh || dd > CFG.maxPowerKW * dt / 3600000 + CFG.counterToleranceKWh) {
            reason = "counter_jump_interval_excluded";
        } else {

            const allowedStep = CFG.socStepTolerancePct + CFG.maxPowerKW * dt / 3600000 / CFG.capacityKWh * 100;
            if (Math.abs(soc - prev.soc) > allowedStep) {
                let candidate = context.get("socCandidate", MEM);
                candidate = candidate && sample.ts > candidate.ts && sample.ts - candidate.ts <= CFG.maxSocAgeMs &&
                    Math.abs(soc - candidate.soc) <= CFG.socConfirmationTolerancePct ?
                    {soc, ts: sample.ts, count: candidate.count + 1} : {soc, ts: sample.ts, count: 1};
                context.set("socCandidate", candidate, MEM);
                if (candidate.count < CFG.socRebaseConfirmations) return failure("soc_jump_rejected");
                reason = "confirmed_soc_jump_interval_excluded";
            } else {
                day.charge += dc;
                day.discharge += dd;
                day.delta += CFG.capacityKWh * (soc - prev.soc) / 100;
                day.coveredMs += dt;
                day.intervals++;
                acceptedInterval = true;
                reason = "interval_accepted";
            }
        }
        if (!acceptedInterval) { day.gaps++; day.gapMs += dt; }
    }
    context.set("socCandidate", null, MEM);
    state.last = sample;


    flow.set(STATE, state, FILE);
    flow.set("batt_eff_last_completed_v3", now, MEM);
    const sum = key => state.days.reduce((total, d) => total + d[key], 0);
    const charge = sum("charge"), discharge = sum("discharge"), delta = sum("delta");
    const rawPct = charge > 0 ? (discharge + delta) / charge * 100 : null;
    const enough = charge >= CFG.minChargeKWh;
    const legacySocMissing = state.days.some(d => d.legacy && !d.legacySocKnown);
    const plausible = rawPct !== null && finite(rawPct) && rawPct >= 0 && rawPct <= 100;
    const valid = (acceptedInterval || (migrated && !prev)) && enough && plausible && !legacySocMissing;
    const eta = valid ? rounded(rawPct, 1) : null;
    const quality = legacySocMissing ? "legacy_soc_boundaries_missing" :
        !(acceptedInterval || (migrated && !prev)) ? reason : !enough ? "insufficient_charge_energy" :
        !plausible ? "efficiency_out_of_range" : "estimate_available";
    flow.set("sum_batt_la_7d", rounded(charge), FILE);
    flow.set("sum_batt_ela_7d", rounded(discharge), FILE);
    flow.set("la_ela_es", eta, FILE);
    const result = {
        version: 3, valid, reason: quality, interval_status: reason,
        timestamp: new Date(sample.ts).toISOString(),
        eta_pct: eta, eta_raw_pct: legacySocMissing ? null : rounded(rawPct, 3),
        days_used: state.days.filter(d => d.intervals > 0 || d.legacy).length,
        legacy_migration: clone(state.legacyMigration),
        legacy_days_in_window: state.days.filter(d => d.legacy).length,
        legacy_soc_boundaries_missing: legacySocMissing,
        window: "today_and_previous_six_local_calendar_days",
        window_complete: false,
        sum_charge_kwh_7d: rounded(charge), sum_discharge_kwh_7d: rounded(discharge),
        delta_stored_energy_kwh: legacySocMissing ? null : rounded(delta),
        losses_kwh: legacySocMissing ? null : rounded(charge - discharge - delta),
        capacity_kwh: CFG.capacityKWh, soc_now_raw_pct: soc, soc_now_eff_pct: soc,
        soc_freshness_verified: socTs !== null,
        reset_metadata_verified: sample.chargeReset !== null && sample.dischargeReset !== null,
        covered_hours: rounded(sum("coveredMs") / 3600000, 6),
        excluded_intervals: sum("gaps"), excluded_gap_hours: rounded(sum("gapMs") / 3600000, 6),
        interval_accepted: acceptedInterval,
        daily_intervals: clone(state.days)
    };
    msg.payload = eta;
    msg.result = result;
    node.status({fill: valid ? "green" : "yellow", shape: valid ? "dot" : "ring",
        text: valid ? `${eta}% estimate | ${result.days_used}d | ${result.covered_hours}h` : quality});
    return [msg, clone(msg)];
} catch (err) {
    node.error(`Efficiency calculation stopped: ${err.message}`);
    const out = {payload: null, result: {valid: false, reason: "context_or_runtime_error", detail: err.message,
        timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}};
    return [out, clone(out)];
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
