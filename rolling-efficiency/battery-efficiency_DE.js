/*
 * Batterie Wirkungsgrad – gleitende 168 Stunden, Version 4.1.
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
    "v3_configuration_mismatch": "V3-Kapazität, Entitäten oder Zeitzone stimmen nicht überein"
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
const CFG = {
    capacityKWh: 8.640,
    maxPowerKW: 2.4,
    powerSafetyFactor: 1.20,
    minChargeKWh: 0.1,
    maxSnapshotAgeMs: 6500,
    maxIntervalMs: 10000,
    maxSocAgeMs: 120000,
    requireSocTimestamp: false,
    socStepTolerancePct: 2,
    socRebaseConfirmations: 3,
    socConfirmationTolerancePct: 1,
    socConfirmationMaxGapMs: 15000,
    importV3: true,
    chargeEntityV3: "sensor.batterie_lade_energie_pro_tag",
    dischargeEntityV3: "sensor.batterie_entlade_energie_pro_tag"
};
const MEM = "memoryOnly", FILE = "file", KEY = "batt_eff_state_v4";
const HOUR = 3600000, WINDOW = 168 * HOUR, BUCKET = 60000;
const now = Date.now();
const finite = v => typeof v === "number" && Number.isFinite(v);
const copy = x => JSON.parse(JSON.stringify(x));
const round = (x, n = 6) => finite(x) ? Number(x.toFixed(n)) : null;
function number(x) {
    if (finite(x)) return x;
    if (typeof x !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(x.trim())) return null;
    const v = Number(x); return finite(v) ? v : null;
}
function diagnosticValue(v) {
    if (v===undefined) return "undefined";
    if (v===null || typeof v==="boolean" || finite(v)) return v;
    return typeof v==="string" ? v.slice(0,120) : String(v).slice(0,120);
}
function localDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dayStart(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error("invalid_v3_state");
    const [y,m,d] = s.split("-").map(Number), ts = new Date(y,m-1,d).getTime();
    if (localDate(ts) !== s) throw Error("invalid_v3_state");
    return ts;
}
function overlap(start, end, from, to) {
    return Math.max(0, Math.min(end,to)-Math.max(start,from));
}

function energy(p0, p1, ms) {
    const scale = ms / 3600000000;
    if (p0 >= 0 && p1 >= 0) return [(p0+p1)*0.5*scale, 0];
    if (p0 <= 0 && p1 <= 0) return [0, -(p0+p1)*0.5*scale];
    const f = Math.abs(p0)/(Math.abs(p0)+Math.abs(p1));
    const a = Math.abs(p0)*f*0.5*scale, b = Math.abs(p1)*(1-f)*0.5*scale;
    return p0 > 0 ? [a,b] : [b,a];
}
function migrate(old, timestamp) {
    const empty = {at:timestamp, status:CFG.importV3 ? "no_v3_data" : "disabled", records:[], source_last_ts:null};
    if (!CFG.importV3 || old == null) return empty;
    if (old.version !== 3 || old.unit !== "kWh" || !Array.isArray(old.days) || old.days.length > 7 ||
        new Set(old.days.map(d=>d.date)).size !== old.days.length) throw Error("invalid_v3_state");
    const fp = JSON.parse(old.fingerprint);
    if (!Array.isArray(fp) || fp[0] !== CFG.capacityKWh || fp[1] !== CFG.chargeEntityV3 || fp[2] !== CFG.dischargeEntityV3 ||
        fp[3] !== Intl.DateTimeFormat().resolvedOptions().timeZone) throw Error("v3_configuration_mismatch");
    if (!old.last) {
        if (old.days.length) throw Error("invalid_v3_state");
        return empty;
    }
    const cut = old.last.ts;
    if (!finite(cut) || cut <= 0 || cut > timestamp || old.last.date !== localDate(cut) ||
        !finite(old.last.soc) || old.last.soc < 0 || old.last.soc > 100 ||
        ![old.last.charge,old.last.discharge].every(v=>finite(v)&&v>=0)) throw Error("invalid_v3_cutover");
    const sorted = copy(old.days).sort((a,b)=>a.date.localeCompare(b.date));
    let previousLegacy = null;
    const records = [];
    for (const d of sorted) {
        const start = dayStart(d.date), next = new Date(start); next.setDate(next.getDate()+1);
        const end = Math.min(next.getTime(),cut);
        if (start > cut || ![d.charge,d.discharge,d.coveredMs,d.gaps,d.gapMs,d.intervals].every(v=>finite(v)&&v>=0) || !finite(d.delta)) throw Error("invalid_v3_state");
        let delta = d.delta, known = true;
        if (d.legacy) {
            known = d.legacySocKnown === true && [d.legacySocStart,d.legacySocEnd].every(v=>finite(v)&&v>=0&&v<=100);
            if (previousLegacy) {
                known = known && previousLegacy.known;
                if (known) delta += CFG.capacityKWh*(d.legacySocStart-previousLegacy.end)/100;
            }
            previousLegacy = {end:d.legacySocEnd, known};
        }
        if (end <= start) {
            if (d.charge || d.discharge || d.delta) throw Error("invalid_v3_state");
            continue;
        }
        records.push({date:d.date,start,end,charge:d.charge,discharge:d.discharge,delta,known});
    }

    return {at:timestamp,status:"imported",source_last_ts:cut,records,
        original_dates:sorted.map(d=>d.date),coverage_known:false,
        distribution:"uniform_within_each_local_day",source_legacy_migration:old.legacyMigration || null};
}
function validState(s, signature) {
    if (!s || s.version!==4 || s.unit!=="kWh" || s.signature!==signature || !finite(s.created) ||
        !Array.isArray(s.buckets) || s.buckets.length>10082 || !s.migration || !Array.isArray(s.migration.records) ||
        s.migration.records.length>7 || !finite(s.excludedMs) || s.excludedMs<0 || !Number.isInteger(s.excludedIntervals) || s.excludedIntervals<0 || typeof s.blocked!=="boolean") return false;
    if (s.candidate && (![s.candidate.ts,s.candidate.soc].every(finite) ||
        !Number.isInteger(s.candidate.count) || s.candidate.count<1)) return false;
    if (s.exclusionLog) {
        const a=s.exclusionLog;
        if (!finite(a.since) || !Number.isInteger(a.next_id) || a.next_id<1 ||
            !Number.isInteger(a.previous_intervals) || a.previous_intervals<0 || !finite(a.previous_ms) || a.previous_ms<0 ||
            !a.counts || !Object.values(a.counts).every(v=>Number.isInteger(v)&&v>=0) ||
            !Array.isArray(a.events) || a.events.length>10) return false;
        if (a.events.some((e,i)=>!Number.isInteger(e.id) || !finite(e.start_ts) ||
            !finite(e.first_seen) || !finite(e.last_seen) || typeof e.open!=="boolean" ||
            (e.open && i!==a.events.length-1) || !finite(e.excluded_ms) || e.excluded_ms<0 ||
            !Number.isInteger(e.excluded_intervals) || e.excluded_intervals<0 ||
            (e.end_ts!==null && !finite(e.end_ts)) || !e.causes ||
            !Object.values(e.causes).every(c=>Number.isInteger(c.observations)&&c.observations>0 &&
                finite(c.first_seen)&&finite(c.last_seen)&&c.first_values&&c.last_values))) return false;
    }
    let lastEnd = 0;
    for (const b of s.buckets) {
        if (!Array.isArray(b) || b.length!==7 || !b.every(finite) || b[0]<lastEnd || b[1]<=b[0] || b[1]-b[0]>BUCKET ||
            b[2]<0 || b[3]<0 || b[5]<0 || b[5]>b[1]-b[0]+0.001 || b[6]<0) return false;
        lastEnd=b[1];
    }
    for (const d of s.migration.records) if (![d.start,d.end,d.charge,d.discharge,d.delta].every(finite) ||
        d.end<=d.start || d.charge<0 || d.discharge<0 || typeof d.known!=="boolean") return false;
    const p=s.last;
    if (p && (![p.ts,p.power,p.soc].every(finite) || p.soc<0 || p.soc>100 || typeof p.id!=="string")) return false;
    return true;
}
let state;

function audit() {
    if (!state) return null;
    if (!state.exclusionLog) state.exclusionLog={since:now,previous_intervals:state.excludedIntervals,
        previous_ms:state.excludedMs,next_id:1,counts:{},events:[]};
    return state.exclusionLog;
}
function currentEvent() {
    const a=audit(), e=a && a.events[a.events.length-1];
    return e && e.open ? e : null;
}
function note(reason, details={}, start=state && state.last ? state.last.ts : now) {
    const a=audit(); if (!a) return null;
    let e=currentEvent();
    if (!e) {
        e={id:a.next_id++,start_ts:start,first_seen:now,last_seen:now,end_ts:null,
            open:true,excluded_ms:0,excluded_intervals:0,causes:{}};
        a.events.push(e); if(a.events.length>10) a.events.shift();
    }
    e.last_seen=now;
    if (!Object.prototype.hasOwnProperty.call(e.causes,reason)) {
        e.causes[reason]={observations:0,first_seen:now,last_seen:now,first_values:details,last_values:details};
        a.counts[reason]=(a.counts[reason]||0)+1;
    }
    const c=e.causes[reason]; c.observations++;c.last_seen=now;c.last_values=details;
    return e;
}
function accountExclusion(start,end) {
    const e=currentEvent(); if(!e) return;
    e.excluded_ms+=end-start;e.excluded_intervals++;e.end_ts=end;
}
function closeEvent(resolution) {
    const e=currentEvent();if(e){e.open=false;e.resolution=resolution;e.closed_at=now;}
}
function auditOutput() {
    const a=audit();
    return {exclusion_log_since:a ? new Date(a.since).toISOString():null,
        exclusions_before_logging:a ? {intervals:a.previous_intervals,duration_ms:a.previous_ms}:null,
        exclusion_counts_by_reason:a ? copy(a.counts):{},
        exclusion_counts_scope:"events_per_cause_since_logging_started",
        recent_exclusions:a ? copy(a.events).reverse().map(e=>({...e,
            started_at:new Date(e.start_ts).toISOString(),
            last_seen_at:new Date(e.last_seen).toISOString(),
            ended_at:e.end_ts===null?null:new Date(e.end_ts).toISOString()})):[]};
}
function save() { flow.set(KEY,state,FILE); }
function fail(reason, detail, block = true, values = {}) {
    try {
        if (state && state.last && block) { note(reason,{...values,...(detail ? {error_message:String(detail).slice(0,500)} : {})}); state.blocked=true; save(); }
        flow.set("la_ela_es",null,FILE);
    } catch (error) { detail = error.message; }
    node.status({fill:"yellow",shape:"ring",text:reason});
    const out={payload:null,result:{version:4,calculation_revision:"4.1",valid:false,reason,
        timestamp:new Date(now).toISOString(),detail,covered_hours:null,soc_freshness_verified:false,...auditOutput()}};
    return [out,copy(out)];
}
try {
    if (![CFG.capacityKWh,CFG.maxPowerKW,CFG.minChargeKWh].every(v=>finite(v)&&v>0) ||
        !finite(CFG.powerSafetyFactor) || CFG.powerSafetyFactor<1) return fail("invalid_configuration");
    const signature=JSON.stringify([CFG.capacityKWh,"snapshot-p_batterie-positive-charge",BUCKET,WINDOW]);
    const saved=flow.get(KEY,FILE);


    if (saved != null) {
        if (saved.signature!==signature || context.get("validatedState",MEM)!==saved) {
            if (!validState(saved,signature)) return fail("invalid_v4_state_or_configuration");
            context.set("validatedState",saved,MEM);
        }
        state=saved;
        audit();
    }
    const cycle=msg._eff;
    if (cycle && (!finite(cycle.ts) || cycle.ts>now || now-cycle.ts>CFG.maxSnapshotAgeMs)) return fail("expired_soc_capture",undefined,true,{capture_ts:cycle.ts,age_ms:finite(cycle.ts)?now-cycle.ts:null,max_age_ms:CFG.maxSnapshotAgeMs});
    const rawSoc=cycle ? cycle.soc : flow.get("batt_level",MEM);
    const soc=number(rawSoc);
    const socTs=number(cycle ? cycle.socTs : flow.get("batt_level_ts",MEM));
    const captureTs=cycle ? cycle.ts : now;
    if (soc===null || soc<0 || soc>100) return fail("invalid_soc",undefined,true,{raw_soc:diagnosticValue(rawSoc),soc_pct:soc,min_pct:0,max_pct:100});
    if (socTs===null && CFG.requireSocTimestamp) return fail("soc_timestamp_required",undefined,true,{soc_timestamp_required:true});
    if (socTs!==null && (socTs>captureTs || captureTs-socTs>CFG.maxSocAgeMs)) return fail("stale_or_future_soc",undefined,true,{soc_ts:socTs,capture_ts:captureTs,age_ms:captureTs-socTs,max_age_ms:CFG.maxSocAgeMs});

    const id=flow.get("snapshot_last_ok_cycleId");
    const ts=number(flow.get("snapshot_last_ok_ts"));
    const trigger=number(flow.get("snapshot_last_ok_triggerTs"));
    const source=flow.get("snapshot_last_battery_source");
    const fresh=flow.get("snapshot_last_battery_fresh");
    const rawPower=flow.get("p_batterie");
    const power=number(rawPower);
    const quality=flow.get("snapshot_last_ok_quality");
    if (typeof id!=="string" || !id || ts===null || trigger===null || trigger>ts || ts>now ||
        now-ts>CFG.maxSnapshotAgeMs || ts-trigger>CFG.maxSnapshotAgeMs ||
        !["excellent","good","borderline"].includes(quality)) return fail("missing_or_stale_snapshot",undefined,true,{snapshot_ts:ts,trigger_ts:trigger,age_ms:ts===null?null:now-ts,latency_ms:ts===null||trigger===null?null:ts-trigger,max_age_ms:CFG.maxSnapshotAgeMs,cycle_id:typeof id==="string"?id:null,quality:typeof quality==="string"?quality:null});
    if (source!=="fresh" || fresh!==true) return fail("battery_fallback_excluded",undefined,true,{battery_source:typeof source==="string"?source:null,battery_fresh:fresh===true,power_w:power,required_source:"fresh",cycle_id:id});
    if (power===null || Math.abs(power)>CFG.maxPowerKW*1000*CFG.powerSafetyFactor) return fail("invalid_battery_power",undefined,true,{raw_power:diagnosticValue(rawPower),power_w:power,max_absolute_power_w:CFG.maxPowerKW*1000*CFG.powerSafetyFactor,cycle_id:id});
    if (!state) {
        const migration=migrate(flow.get("batt_eff_state_v3",FILE),ts);
        state={version:4,unit:"kWh",signature,created:ts,last:null,blocked:false,buckets:[],migration,
            excludedIntervals:0,excludedMs:0,candidate:null};


        context.set("validatedState",state,MEM);
    }
    audit();
    const prev=state.last;
    if (prev && (id===prev.id || ts<=prev.ts)) return null;
    const sample={id,ts,power,soc};
    let reason="baseline_initialized",accepted=false;
    if (prev) {
        const dt=ts-prev.ts;
        if (state.blocked || dt>CFG.maxIntervalMs) {
            reason="measurement_gap_excluded";

            if (!currentEvent()) note(reason,{interval_ms:dt,max_interval_ms:CFG.maxIntervalMs,
                previous_failure_cause_unavailable:state.blocked},prev.ts);
        }
        else {
            const allowed=CFG.socStepTolerancePct + CFG.maxPowerKW*CFG.powerSafetyFactor*dt/HOUR/CFG.capacityKWh*100;
            if (Math.abs(soc-prev.soc)>allowed) {
                note("soc_jump_pending",{previous_soc_pct:prev.soc,current_soc_pct:soc,
                    change_pct_points:soc-prev.soc,allowed_change_pct_points:allowed,
                    interval_ms:dt,required_confirmations:CFG.socRebaseConfirmations},prev.ts);
                const c=state.candidate;
                state.candidate=c && ts>c.ts && ts-c.ts<=CFG.socConfirmationMaxGapMs && Math.abs(soc-c.soc)<=CFG.socConfirmationTolerancePct ?
                    {ts,soc,count:c.count+1} : {ts,soc,count:1};


                state.last={id,ts,power,soc:prev.soc};
                state.excludedIntervals++; state.excludedMs+=dt;
                if (state.candidate.count<CFG.socRebaseConfirmations) {
                    accountExclusion(prev.ts,ts);
                    save(); return fail("soc_jump_pending", undefined, false);
                }
                reason="confirmed_soc_jump_excluded";

                state.excludedIntervals--; state.excludedMs-=dt;
            } else {
                accepted=true; reason="interval_accepted";
                const ds=CFG.capacityKWh*(soc-prev.soc)/100;
                for (let a=prev.ts;a<ts;) {
                    const end=Math.min(ts,(Math.floor(a/BUCKET)+1)*BUCKET);
                    const f0=(a-prev.ts)/dt,f1=(end-prev.ts)/dt;
                    const [ch,dis]=energy(prev.power+(power-prev.power)*f0,prev.power+(power-prev.power)*f1,end-a);
                    let b=state.buckets[state.buckets.length-1];
                    if (!b || Math.floor(b[0]/BUCKET)!==Math.floor(a/BUCKET)) {
                        b=[a,end,0,0,0,0,0]; state.buckets.push(b);
                    }
                    b[1]=end;b[2]+=ch;b[3]+=dis;b[4]+=ds*(end-a)/dt;b[5]+=end-a;b[6]++;
                    a=end;
                }
            }
        }
        if (!accepted) {
            state.excludedIntervals++;state.excludedMs+=dt;accountExclusion(prev.ts,ts);
            closeEvent(reason);
        } else closeEvent("valid_measurement_resumed");
    } else if (state.migration.source_last_ts!==null && ts>state.migration.source_last_ts) {
        note("migration_baseline_initialized",{previous_v3_ts:state.migration.source_last_ts,
            first_v4_ts:ts},state.migration.source_last_ts);
        accountExclusion(state.migration.source_last_ts,ts);closeEvent("migration_baseline_initialized");
        state.excludedIntervals++;state.excludedMs+=ts-state.migration.source_last_ts;
        reason="migration_baseline_initialized";
    }
    state.last=sample;state.blocked=false;state.candidate=null;
    const from=ts-WINDOW;
    while (state.buckets.length && state.buckets[0][1]<=from) state.buckets.shift();
    state.migration.records=state.migration.records.filter(d=>d.end>from);
    let charge=0,discharge=0,delta=0,covered=0,partial=false;
    for (const b of state.buckets) {
        const f=overlap(b[0],b[1],from,ts)/(b[1]-b[0]);
        charge+=b[2]*f;discharge+=b[3]*f;delta+=b[4]*f;covered+=b[5]*f;
        if (f>0 && f<1) partial=true;
    }
    let importedCharge=0,importedDischarge=0,importedDelta=0,legacyMissing=false;
    for (const d of state.migration.records) {
        const f=overlap(d.start,d.end,from,ts)/(d.end-d.start);
        importedCharge+=d.charge*f;importedDischarge+=d.discharge*f;importedDelta+=d.delta*f;
        if (f>0 && !d.known) legacyMissing=true;
    }
    charge+=importedCharge;discharge+=importedDischarge;delta+=importedDelta;
    const raw=charge>0 ? 100*(discharge+delta)/charge : null;
    const enough=charge+1e-12>=CFG.minChargeKWh;
    const plausible=finite(raw) && raw>=0 && raw<=100;
    const hasImported=state.migration.records.length>0;
    const valid=enough && plausible && !legacyMissing && (accepted || (hasImported && !prev));
    const resultReason=legacyMissing ? "legacy_soc_boundaries_missing" : !enough ? "insufficient_charge_energy" :
        !plausible ? "efficiency_out_of_range" : valid ? "calculation_available" : reason;
    const eta=valid ? round(raw,1) : null;
    save();

    flow.set("batt_eff_last_completed_v3",now,MEM);
    flow.set("batt_eff_last_completed_v4",now,MEM);
    flow.set("sum_batt_la_7d",round(charge,3),FILE);
    flow.set("sum_batt_ela_7d",round(discharge,3),FILE);
    flow.set("la_ela_es",eta,FILE);
    const result={version:4,calculation_revision:"4.1",valid,reason:resultReason,interval_status:reason,
        timestamp:new Date(ts).toISOString(),eta_pct:eta,eta_raw_pct:round(raw,3),
        window:"rolling_168_hours",window_start:new Date(from).toISOString(),window_end:new Date(ts).toISOString(),
        window_complete:!hasImported && covered>=WINDOW-1,days_used:round(covered/86400000,3),
        sum_charge_kwh_7d:round(charge),sum_discharge_kwh_7d:round(discharge),delta_stored_energy_kwh:round(delta),
        losses_kwh:round(charge-discharge-delta),capacity_kwh:CFG.capacityKWh,
        soc_now_raw_pct:soc,soc_now_eff_pct:soc,soc_freshness_verified:socTs!==null,
        power_w:power,battery_source:source,snapshot_cycle_id:id,snapshot_age_ms:now-ts,
        integration_interval_ms:prev ? ts-prev.ts : null,integration_method:"linear_signed_power_zero_crossing",
        power_time_basis:"snapshot_completion",soc_time_basis:"latest_at_capture",
        covered_hours:round(covered/HOUR),interval_accepted:accepted,
        excluded_intervals:state.excludedIntervals,excluded_gap_hours:round(state.excludedMs/HOUR),
        exclusion_scope:"since_v4_start",bucket_seconds:BUCKET/1000,buffer_buckets:state.buckets.length,
        boundary_weighting:"uniform_within_oldest_partial_minute",partial_boundary_bucket:partial,
        legacy_days_in_window:state.migration.records.length,legacy_soc_boundaries_missing:legacyMissing,
        legacy_migration:{status:state.migration.status,at:state.migration.at,source:"batt_eff_state_v3",
            source_last_ts:state.migration.source_last_ts,distribution:state.migration.distribution || null},
        imported_charge_kwh:round(importedCharge),imported_discharge_kwh:round(importedDischarge),
        imported_delta_kwh:round(importedDelta),historical_accuracy_verified:false,...auditOutput()};
    const out={payload:eta,result};
    node.status({fill:valid && !hasImported ? "green":"yellow",shape:valid?"dot":"ring",
        text:valid?`${eta}% | 168h | ${round(covered/HOUR,2)}h`:resultReason});
    return [out,copy(out)];
} catch(err) {
    node.error(`Efficiency calculation stopped: ${err.message}`);
    return fail("context_or_runtime_error",err.message);
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

if (Array.isArray(ausgabe)) {
    for (const nachricht of ausgabe) {
        for (const ereignis of nachricht?.result?.recent_exclusions || []) {
            ereignis.ursachen = Object.keys(ereignis.causes).map(code => ({code, grund:deutsch(code)}));
            if (ereignis.resolution) ereignis.abschluss = deutsch(ereignis.resolution);
        }
    }
}
return ausgabe;

