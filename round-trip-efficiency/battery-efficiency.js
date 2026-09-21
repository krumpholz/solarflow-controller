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
    counterToleranceKWh: 0.02,      // Allow asynchronous/quantized reporting.
    minChargeKWh: 0.1,             // Do not divide by a near-zero throughput.
    cycleTimeoutMs: 4000,
    maxIntervalMs: 120000,          // Longer gaps start a new baseline.
    maxSocAgeMs: 15000,
    requireSocTimestamp: false,     // Set true after adding batt_level_ts.
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
        state = {version: 3, unit: "kWh", fingerprint, last: null, days: []};
        reason = "configuration_changed_new_baseline";
    }
    const prev = state.last;
    if (prev && sample.ts <= prev.ts) return failure("non_increasing_sample_time");
    state.days = state.days.filter(d => ordinal(sample.date) - ordinal(d.date) >= 0 && ordinal(sample.date) - ordinal(d.date) <= 6);
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
            // With no last_reset attribute, require evidence that EACH daily
            // counter reset. A previously zero counter may remain zero.
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
            // Use a current endpoint, not a delayed ten-minute median.
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
    // One versioned object contains both totals and their matching baseline.
    // localfilesystem must have cache:true. Its own flush interval limits I/O.
    flow.set(STATE, state, FILE);
    flow.set("batt_eff_last_completed_v3", now, MEM);
    const sum = key => state.days.reduce((total, d) => total + d[key], 0);
    const charge = sum("charge"), discharge = sum("discharge"), delta = sum("delta");
    const rawPct = charge > 0 ? (discharge + delta) / charge * 100 : null;
    const enough = charge >= CFG.minChargeKWh;
    const plausible = rawPct !== null && finite(rawPct) && rawPct >= 0 && rawPct <= 100;
    const valid = acceptedInterval && enough && plausible;
    const eta = valid ? rounded(rawPct, 1) : null;
    const quality = !acceptedInterval ? reason : !enough ? "insufficient_charge_energy" : !plausible ? "efficiency_out_of_range" : "estimate_available";
    flow.set("sum_batt_la_7d", rounded(charge), FILE);
    flow.set("sum_batt_ela_7d", rounded(discharge), FILE);
    flow.set("la_ela_es", eta, FILE);
    const result = {
        version: 3, valid, reason: quality, interval_status: reason,
        timestamp: new Date(sample.ts).toISOString(),
        eta_pct: eta, eta_raw_pct: rounded(rawPct, 3),
        days_used: state.days.filter(d => d.intervals > 0).length,
        window: "today_and_previous_six_local_calendar_days",
        window_complete: false,
        sum_charge_kwh_7d: rounded(charge), sum_discharge_kwh_7d: rounded(discharge),
        delta_stored_energy_kwh: rounded(delta), losses_kwh: rounded(charge - discharge - delta),
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
