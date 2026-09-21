/*
 * Seven-Day SOC-Adjusted Battery Efficiency Estimate — v3
 * MIT licensed. Independent community project; see ../NOTICE.md.
 * Node-RED Function body, TWO outputs: HA state / detailed diagnostics.
 * Use prepare-cycle.js before BOTH current-state nodes. See README.md.
 * Daily kWh counters are differenced from a paired baseline. SOC changes
 * are accumulated only over the SAME accepted intervals, never across gaps.
 * A null payload means Unknown; it is never a manufactured 0% or 100%.
 */
const CFG = {
    chargeEntity: "sensor.batterie_lade_energie_pro_tag",
    dischargeEntity: "sensor.batterie_entlade_energie_pro_tag",
    capacityKWh: 8.640,             // INSTALLATION VALUE: 3 x 2.880 kWh.
    maxPowerKW: 2.4,                // Maximum charge/discharge power.
    powerSafetyFactor: 1.20,       // Plausibility allowance, NOT a device power setting.
    maxReportingDelayMs: 120000,   // Configurable reporting-lag allowance, not a HA guarantee.
    counterStepKWh: 0.1,           // Conservative resolution allowance; use actual source resolution.
    minChargeKWh: 0.1,             // Do not divide by a near-zero throughput.
    cycleTimeoutMs: 4000,
    maxIntervalMs: 120000,          // Longer gaps start a new baseline.
    maxSocAgeMs: 120000,           // Allow delayed SOC reports; timestamp must reflect source observation.
    requireSocTimestamp: false,     // Set true after adding batt_level_ts.
    socStepTolerancePct: 2,
    socRebaseConfirmations: 3,
    socConfirmationMaxGapMs: 15000, // Confirmation polls must remain consecutive.
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
function failure(reason, details = {}) {
    flow.set("la_ela_es", null, FILE);
    node.status({fill: "yellow", shape: "ring", text: reason});
    const out = {payload: null, result: {valid: false, reason, timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false, ...details}};
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
        (s.last === null || validSample(s.last)) &&
        (!s.energyGuard || (finite(s.energyGuard.at) && s.energyGuard.at > 0 && (!s.last || s.energyGuard.at >= s.last.ts) &&
            (s.energyGuard.pendingSince === undefined || (finite(s.energyGuard.pendingSince) && s.energyGuard.pendingSince <= s.energyGuard.at)) && finite(s.energyGuard.charge) && s.energyGuard.charge >= 0 &&
            finite(s.energyGuard.discharge) && s.energyGuard.discharge >= 0 && typeof s.energyGuard.signature === "string")) &&
        Array.isArray(s.days) && s.days.length <= 7 &&
        new Set(s.days.map(d => d.date)).size === s.days.length &&
        s.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
            [d.charge, d.discharge, d.coveredMs, d.gaps, d.gapMs, d.intervals].every(v => finite(v) && v >= 0) &&
            Number.isInteger(d.intervals) && Number.isInteger(d.gaps) && finite(d.delta));
}
// Import the original kWh ring ONCE. Never delete or overwrite its keys.
// Imported energy remains useful even when its SOC boundaries are unknown.
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
    // Retain all slots, including dates outside the active seven-day window.
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
        // Walk oldest to newest so a later duplicate date wins deterministically.
        for (let i = 1; i <= 7; i++) add(ring.slots[(ring.head + i + 7) % 7], true);
    }
    add(sources.snapshot, false); // A completed ring day takes precedence.
    add(sources.live, true);      // Live memory is preferred over an older snapshot.
    for (const [date, record] of records) {
        const existing = state.days.find(d => d.date === date);
        if (existing) {
            // A previous v3 deployment normally began AFTER the frozen legacy
            // live record. Recover its prefix if the interval ledger proves
            // that neither direction overlaps it (no gaps/resets on that day).
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
            // Already measured v3 intervals may overlap a legacy day's total.
            // Do not add overlapping totals. Preserve the raw legacy record in
            // the backup and expose the conflict instead of double-counting.
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
    if (finished && cycle.ts <= finished.ts) return null; // duplicate or delayed cycle
    if (pending && cycle.ts < pending.ts) return null;
    const lostPair = pending && pending.id !== cycle.id;
    if (!pending || pending.id !== cycle.id) pending = {id: cycle.id, ts: cycle.ts, soc: cycle.soc, socTs: cycle.socTs};
    if (cycle.ts !== pending.ts || cycle.soc !== pending.soc || cycle.socTs !== pending.socTs) return failure("inconsistent_cycle_snapshot");
    const entity = msg.data && msg.data.entity_id;
    const side = entity === CFG.chargeEntity ? "charge" : entity === CFG.dischargeEntity ? "discharge" : null;
    if (!side) return failure("unexpected_entity");
    // Check the original HA state before any numeric conversion by a node.
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
    if (pending[side]) return null; // accept each direction only once per cycle
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
    if (!finite(CFG.maxPowerKW) || CFG.maxPowerKW <= 0 || !finite(CFG.powerSafetyFactor) || CFG.powerSafetyFactor < 1 ||
        !finite(CFG.maxReportingDelayMs) || CFG.maxReportingDelayMs < 0 || !finite(CFG.counterStepKWh) || CFG.counterStepKWh < 0) {
        return failure("invalid_energy_guard_configuration");
    }
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
    // A bounded allowance absorbs delayed/rounded counter updates. It refills
    // only at the physical power limit plus reserve, not once per message.
    // One allowance per direction; unused allowance cannot grow without limit.
    const rateKWhPerMs = CFG.maxPowerKW * CFG.powerSafetyFactor / 3600000;
    const burstKWh = rateKWhPerMs * CFG.maxReportingDelayMs + CFG.counterStepKWh;
    const guardSignature = JSON.stringify([CFG.maxPowerKW, CFG.powerSafetyFactor, CFG.maxReportingDelayMs, CFG.counterStepKWh]);
    let guard = state.energyGuard;
    if (!guard || guard.signature !== guardSignature) {
        guard = {at: prev ? prev.ts : sample.ts, charge: burstKWh, discharge: burstKWh, signature: guardSignature};
    }
    if (sample.ts < guard.at) return failure("non_increasing_sample_time");
    const observationGapMs = sample.ts - guard.at;
    guard.charge = Math.min(burstKWh, guard.charge + observationGapMs * rateKWhPerMs);
    guard.discharge = Math.min(burstKWh, guard.discharge + observationGapMs * rateKWhPerMs);
    guard.at = sample.ts;
    state.energyGuard = guard;
    function pendingEnergy(reason, dc, dd) {
        // Persist only the allowance/observation time, NOT new counter or SOC
        // endpoints. Recovery can therefore include the complete deferred delta.
        guard.pendingSince = guard.pendingSince ?? sample.ts;
        flow.set(STATE, state, FILE);
        flow.set("batt_eff_last_completed_v3", now, MEM);
        return failure(reason, {calculation_revision: "3.2", pending_since: guard.pendingSince,
            deferred_charge_kwh: rounded(dc, 6), deferred_discharge_kwh: rounded(dd, 6),
            energy_guard: {max_power_kw: CFG.maxPowerKW, safety_factor: CFG.powerSafetyFactor,
                burst_allowance_kwh: rounded(burstKWh, 6), charge_available_kwh: rounded(guard.charge, 6),
                discharge_available_kwh: rounded(guard.discharge, 6)}, baseline_preserved: true});
    }
    let acceptedInterval = false;
    if (prev) {
        const dt = sample.ts - prev.ts;
        const dc = sample.charge - prev.charge, dd = sample.discharge - prev.discharge;
        if (sample.date !== prev.date) {
            // With no last_reset attribute, require evidence that EACH daily
            // counter reset. A previously zero counter may remain zero.
            const resetSeen = side => sample[`${side}Reset`] !== null || sample[side] < prev[side] || (prev[side] === 0 && sample[side] === 0);
            if (!resetSeen("charge") || !resetSeen("discharge")) return failure("waiting_for_daily_counter_resets");
            reason = "new_day_boundary_excluded";
        } else if (observationGapMs > CFG.maxIntervalMs) {
            reason = "measurement_gap_excluded";
        } else if (sample.chargeReset !== prev.chargeReset || sample.dischargeReset !== prev.dischargeReset) {
            reason = "counter_reset_interval_excluded";
        } else if (dc < -1e-9 || dd < -1e-9) {
            return pendingEnergy("counter_decrease_pending", dc, dd);
        } else if (dc > guard.charge + 1e-9 || dd > guard.discharge + 1e-9) {
            return pendingEnergy("counter_energy_pending", dc, dd);
        } else {
            // Use a current endpoint, not a delayed ten-minute median.
            const allowedStep = CFG.socStepTolerancePct + CFG.maxPowerKW * CFG.powerSafetyFactor * dt / 3600000 / CFG.capacityKWh * 100;
            if (Math.abs(soc - prev.soc) > allowedStep) {
                let candidate = context.get("socCandidate", MEM);
                candidate = candidate && sample.ts > candidate.ts && sample.ts - candidate.ts <= CFG.socConfirmationMaxGapMs &&
                    Math.abs(soc - candidate.soc) <= CFG.socConfirmationTolerancePct ?
                    {soc, ts: sample.ts, count: candidate.count + 1} : {soc, ts: sample.ts, count: 1};
                context.set("socCandidate", candidate, MEM);
                if (candidate.count < CFG.socRebaseConfirmations) return pendingEnergy("soc_jump_rejected", dc, dd);
                reason = "confirmed_soc_jump_interval_excluded";
            } else {
                day.charge += Math.max(0, dc);
                day.discharge += Math.max(0, dd);
                guard.charge = Math.max(0, guard.charge - Math.max(0, dc));
                guard.discharge = Math.max(0, guard.discharge - Math.max(0, dd));
                day.delta += CFG.capacityKWh * (soc - prev.soc) / 100;
                day.coveredMs += dt;
                day.intervals++;
                acceptedInterval = true;
                reason = "interval_accepted";
            }
        }
        if (!acceptedInterval) { day.gaps++; day.gapMs += dt; }
    }
    if (!acceptedInterval) { guard.charge = burstKWh; guard.discharge = burstKWh; }
    delete guard.pendingSince;
    context.set("socCandidate", null, MEM);
    state.last = sample;
    // One versioned object contains both totals and their matching baseline.
    // localfilesystem must have cache:true. Its own flush interval limits I/O.
    flow.set(STATE, state, FILE);
    flow.set("batt_eff_last_completed_v3", now, MEM);
    const sum = key => state.days.reduce((total, d) => total + d[key], 0);
    const charge = sum("charge"), discharge = sum("discharge");
    const legacyDays = state.days.filter(d => d.legacy);
    const legacySocMissing = legacyDays.some(d => !d.legacySocKnown ||
        !finite(d.legacySocStart) || !finite(d.legacySocEnd) ||
        d.legacySocStart < 0 || d.legacySocStart > 100 || d.legacySocEnd < 0 || d.legacySocEnd > 100);
    // Preserve the original first/last-SOC method for imported history only.
    // Do not rewrite the stored per-day deltas: they also include NEW intervals.
    // Recompute the legacy adjustment as days expire, never compound it.
    let legacyAdjustment = 0;
    const legacyBoundaryGaps = [];
    if (!legacySocMissing && legacyDays.length > 0) {
        const individualLegacyDelta = legacyDays.reduce((total, d) =>
            total + CFG.capacityKWh * (d.legacySocEnd - d.legacySocStart) / 100, 0);
        const legacyWindowDelta = CFG.capacityKWh *
            (legacyDays[legacyDays.length - 1].legacySocEnd - legacyDays[0].legacySocStart) / 100;
        legacyAdjustment = legacyWindowDelta - individualLegacyDelta;
        for (let i = 1; i < legacyDays.length; i++) {
            const before = legacyDays[i - 1], after = legacyDays[i];
            const socGap = after.legacySocStart - before.legacySocEnd;
            if (socGap !== 0 || ordinal(after.date) - ordinal(before.date) !== 1) {
                legacyBoundaryGaps.push({from_date: before.date, to_date: after.date,
                    previous_end_soc_pct: before.legacySocEnd, next_start_soc_pct: after.legacySocStart,
                    difference_pct_points: socGap});
            }
        }
    }
    const delta = sum("delta") + legacyAdjustment;
    const rawPct = charge > 0 ? (discharge + delta) / charge * 100 : null;
    const enough = charge >= CFG.minChargeKWh;
    const plausible = rawPct !== null && finite(rawPct) && rawPct >= 0 && rawPct <= 100;
    const valid = (acceptedInterval || (migrated && !prev)) && enough && plausible && !legacySocMissing;
    const eta = valid ? rounded(rawPct, 1) : null;
    const quality = legacySocMissing ? "legacy_soc_boundaries_missing" :
        !(acceptedInterval || (migrated && !prev)) ? reason : !enough ? "insufficient_charge_energy" :
        !plausible ? "efficiency_out_of_range" : legacyDays.length ? "legacy_estimate_available" : "estimate_available";
    flow.set("sum_batt_la_7d", rounded(charge), FILE);
    flow.set("sum_batt_ela_7d", rounded(discharge), FILE);
    flow.set("la_ela_es", eta, FILE);
    const result = {
        version: 3, calculation_revision: "3.2", valid, reason: quality, interval_status: reason,
        energy_guard: {max_power_kw: CFG.maxPowerKW, safety_factor: CFG.powerSafetyFactor,
            reporting_delay_ms: CFG.maxReportingDelayMs, counter_step_kwh: CFG.counterStepKWh,
            burst_allowance_kwh: rounded(burstKWh, 6), charge_available_kwh: rounded(guard.charge, 6),
            discharge_available_kwh: rounded(guard.discharge, 6)},
        estimate_basis: legacyDays.length ? "legacy_window_endpoints_plus_new_intervals" : "measured_intervals",
        historical_accuracy_verified: false,
        legacy_boundary_gaps: legacyBoundaryGaps,
        legacy_adjustment_kwh: legacySocMissing ? null : rounded(legacyAdjustment, 6),
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
    node.status({fill: valid && !legacyDays.length ? "green" : "yellow", shape: valid ? "dot" : "ring",
        text: valid ? `${eta}% | ${result.days_used}d | ${result.covered_hours}h` : quality});
    return [msg, clone(msg)];
} catch (err) {
    node.error(`Efficiency calculation stopped: ${err.message}`);
    const out = {payload: null, result: {valid: false, reason: "context_or_runtime_error", detail: err.message,
        timestamp: new Date(now).toISOString(), covered_hours: null, soc_freshness_verified: false}};
    return [out, clone(out)];
}
