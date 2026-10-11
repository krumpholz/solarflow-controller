// Erwartet: msg.payload = vollständiges Regler-Statusobjekt

if (
    !msg.payload ||
    typeof msg.payload !== "object" ||
    Array.isArray(msg.payload)
) {
    return null;
}

const status = msg.payload;

function bool(v, d = false) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;

    if (typeof v === "string") {
        const s = v.trim().toLowerCase();

        if (
            s === "true" ||
            s === "1" ||
            s === "on" ||
            s === "yes"
        ) {
            return true;
        }

        if (
            s === "false" ||
            s === "0" ||
            s === "off" ||
            s === "no"
        ) {
            return false;
        }
    }

    return d;
}

function num(v, d = 0) {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
}

// --------------------------------------------------
// Wirksame Richtung direkt aus dem Reglerstatus lesen.
//
// antiflip.effectiveDir ist die tatsächlich nach
// DirectionGuard und AntiFlip wirksame Richtung.
const effectiveRichtung = num(
    status.antiflip?.effectiveDir ??
    status.meta?.effectiveRichtung ??
    status.flowValues?.effectiveRichtung ??
    status.effectiveRichtung ??
    flow.get("effectiveRichtung") ??
    flow.get("richtung"),
    0
);

// Intern bestätigte Roh-Richtung vor DirectionGuard
// und AntiFlip.
//
// Im aktuellen Reglerstatus heißt dieses Feld:
// directionDecision.storedDir
const rawRichtung = num(
    status.directionDecision?.storedDir ??
    status.directionDecision?.rawOutputDir ??
    status.meta?.rawRichtung ??
    status.flowValues?.rawRichtung ??
    flow.get("regler_dir_richtung"),
    0
);

// --------------------------------------------------
// Steuerzustände.
//
// Flow-Werte werden bevorzugt verwendet.
// Der Regler-Modus dient als sicherer Fallback.
const netzLaden = bool(
    flow.get("netz_laden"),
    status.mode === "NETZ_LADEN"
);

const regelung = bool(
    flow.get("regelung"),
    status.mode === "REGEL_LADEN" ||
    status.mode === "REGEL_ENTLADEN"
);

// b_entladen ist im Reglerstatus zuverlässig vorhanden.
// Dadurch funktioniert der Logger auch dann korrekt,
// wenn Zusatzdatenblock und Regler nicht denselben
// Flow-Kontext verwenden.
const bEntladen = bool(
    status.loadStepDetection?.checks?.b_entladen ??
    status.meta?.b_entladen ??
    flow.get("b_entladen"),
    false
);

// --------------------------------------------------
// SOC-Zustände.
//
// batt_min_raw:
// ungefiltertes Eingangssignal aus der SOC-Auswertung
//
// batt_min:
// tatsächlich wirksame, zeitlich bestätigte Sperre
const battMinRaw = bool(
    status.socBlock?.batt_min_raw ??
    status.meta?.batt_min_raw ??
    flow.get("batt_min"),
    false
);

const battMin = bool(
    status.socBlock?.batt_min ??
    status.meta?.batt_min,
    false
);

const battMinPending = bool(
    status.socBlock?.batt_min_pending ??
    status.meta?.batt_min_pending,
    false
);

const battMinConfirmMs = num(
    status.socBlock?.batt_min_confirm_ms,
    0
);

const battMinRawSinceTs = num(
    status.socBlock?.batt_min_raw_since_ts,
    0
);

const battMinRawDurationMs = num(
    status.socBlock?.batt_min_raw_duration_ms,
    0
);

const battMax = bool(
    status.socBlock?.batt_max ??
    status.meta?.batt_max ??
    flow.get("batt_max"),
    false
);

const socBlock = bool(
    status.socBlock?.soc_block ??
    (battMin || battMax),
    false
);

// --------------------------------------------------
// Vorhandenes meta-Objekt nicht überschreiben,
// sondern gezielt ergänzen.
const existingMeta =
    status.meta &&
        typeof status.meta === "object" &&
        !Array.isArray(status.meta)
        ? status.meta
        : {};

status.meta = {
    ...existingMeta,

    // Für bestehende Auswertungen beibehalten.
    richtung: effectiveRichtung,

    // Tatsächlich wirksame Richtung nach
    // DirectionGuard und AntiFlip.
    effectiveRichtung,

    // Intern bestätigte Roh-Richtung vor
    // DirectionGuard und AntiFlip.
    rawRichtung,

    netz_laden: netzLaden,
    regelung,
    b_entladen: bEntladen,

    // Ungefilterter SOC-Minimalzustand.
    // Dieser Wert darf den Regler noch nicht sperren.
    batt_min_raw: battMinRaw,

    // Tatsächlich wirksame und zeitlich bestätigte
    // Entladesperre.
    batt_min: battMin,

    // Rohwert liegt an, Bestätigungszeit ist aber
    // noch nicht erreicht.
    batt_min_pending: battMinPending,

    batt_min_confirm_ms:
        battMinConfirmMs,

    batt_min_raw_since_ts:
        battMinRawSinceTs,

    batt_min_raw_duration_ms:
        battMinRawDurationMs,

    batt_max: battMax,
    soc_block: socBlock
};

// --------------------------------------------------
// Vorhandenes flowValues-Objekt ebenfalls erhalten.
const existingFlowValues =
    status.flowValues &&
        typeof status.flowValues === "object" &&
        !Array.isArray(status.flowValues)
        ? status.flowValues
        : {};

status.flowValues = {
    ...existingFlowValues,

    // Die im Reglerstatus gespeicherten Werte gehören
    // garantiert zum selben Reglerzyklus.
    //
    // Flow-Werte werden nur noch als Fallback verwendet.
    lastChargeW:
        num(
            status.controlBase?.lastChargeW ??
            flow.get("lastChargeW"),
            0
        ),

    lastDischargeW:
        num(
            status.controlBase?.lastDischargeW ??
            flow.get("lastDischargeW"),
            0
        ),

    p_zaehler:
        num(
            status.inputs?.p_zaehler ??
            flow.get("p_zaehler"),
            0
        ),

    p_batterie:
        num(
            status.inputs?.p_batterie ??
            flow.get("p_batterie"),
            0
        ),

    p_solar:
        num(
            status.inputs?.p_solar ??
            flow.get("p_solar"),
            0
        ),

    p_haus:
        num(
            status.inputs?.p_haus ??
            flow.get("p_haus"),
            0
        ),

    effectiveRichtung,
    rawRichtung,

    netz_laden: netzLaden,
    regelung,
    b_entladen: bEntladen,

    batt_min_raw: battMinRaw,
    batt_min: battMin,
    batt_min_pending: battMinPending,
    batt_min_raw_duration_ms:
        battMinRawDurationMs,

    batt_max: battMax,
    soc_block: socBlock
};

// --------------------------------------------------
// BLE/HA-Diagnose. Ein HA-Dienstabschluss bestätigt keinen BLE-Schreibvorgang.
const now = Date.now();
function clone(v, fallback = null) {
  try { return v == null ? fallback : RED.util.cloneMessage(v); }
  catch (_) { return fallback; }
}
delete status.batteryHttp;
delete status.batteryHttpEvents;
const pending = flow.get("batt_ble_audit_pending");
const events = clone(Array.isArray(pending) ? pending : [], []);
const rawState = flow.get("batt_ble_audit_state") || {};
const rawPoll = flow.get("batt_ble_diag_poll") || {};
const observed = {};
for (const [key, raw] of Object.entries(rawPoll)) {
  const p = clone(raw, {});
  const age = p.haUpdatedTs == null ? null : now - p.haUpdatedTs;
  p.haStateAgeMs = age != null && age >= 0 ? age : null;
  p.pollAgeMs = Number.isFinite(p.pollTs) && now >= p.pollTs ? now - p.pollTs : null;
  p.ageMeaning = "HA state age; unchanged states can be old without a failed BLE link";
  observed[key] = p;
}
const wantedDir = status.batteryDirection?.payload ?? null;
function readback(key, requestedW) {
  const p = observed[key], request = rawState.lastByCommand?.[key]?.ha_call_requested;
  const matchesLatest = p?.valid && request ? p.value === request.value : null;
  const elapsed = matchesLatest === true && Number.isFinite(p.haUpdatedTs) && p.haUpdatedTs >= request.ts
    ? p.haUpdatedTs - request.ts : null;
  return {
    valueW:p?.valid ? p.value : null,
    matchesCurrentRequest:p?.valid ? p.value === requestedW : null,
    matchesLatestHaCall:matchesLatest,
    matchingStateObservedAfterHaCallMs:elapsed,
    mismatchAgeMs:matchesLatest === false && Number.isFinite(request.ts) ? Math.max(0,now-request.ts) : null,
    meaning:"Reported device property; timed equality is not a correlated write ACK."
  };
}
status.batteryBle = {
  schema: "1.1", transport: "Home Assistant / ESPHome / BLE",
  capturedTs: now, regulatorTs: status.ts,
  cycleId: status.snapshotCycle?.regulatorCycleId ?? null,
  requested: {
    acMode: wantedDir,
    inputLimitW: status.outputs?.chargeW ?? null,
    outputLimitW: status.outputs?.dischargeW ?? null
  },
  ready: {
    value: observed.ready?.valid ? observed.ready.value : null,
    pollAgeMs: observed.ready?.pollAgeMs ?? null,
    haStateAgeMs: observed.ready?.haStateAgeMs ?? null
  },
  observed,
  acModeStateMatchesRequested: observed.acMode?.valid && wantedDir != null
    ? observed.acMode.value === wantedDir : null,
  limitReadback: {
    inputLimit: readback("inputLimit",status.outputs?.chargeW),
    outputLimit: readback("outputLimit",status.outputs?.dischargeW)
  },
  deviceWriteAcknowledgement: null,
  haCalls: clone(rawState, {}),
  eventsSincePreviousCapture: events,
  eventCount: events.length,
  meaning: "Events retain their own cycle/time; a successful HA call is not a BLE ACK."
};
flow.set("batt_ble_audit_pending", []);
// Das Snapshotobjekt wird bereits IM Regler eingefroren. Kein späterer Kontextwert.
// Auch ein fehlender/nicht passender Snapshot bleibt ausdrücklich fehlend.
// Kompatibilität beim getrennten Einbau der Diagnose mit einem älteren Regler.
if (!status.snapshotAttachment) {
  const candidate = flow.get("snapshot_last_diagnostic");
  const expected = status.snapshotCycle?.regulatorCycleId;
  const matched = candidate?.state === "ok" && expected != null &&
    candidate.cycleId === expected &&
    ["p_zaehler","p_batterie","p_solar","p_haus"].every(k => candidate.values?.[k] === status.inputs?.[k]);
  status.snapshot = matched ? clone(candidate) : null;
  status.snapshotAttachment = {matched,capturedTs:now,expectedCycleId:expected ?? null,
    availableCycleId:candidate?.cycleId ?? null,source:"logger_compatibility"};
}
if (!status.snapshotAttachment?.matched) status.snapshot = null;
const snapshotAge = status.snapshot?.ts != null ? status.ts - status.snapshot.ts : null;
status.snapshot_age_ms = Number.isFinite(snapshotAge) && snapshotAge >= 0 ? snapshotAge : null;
// Diagnoseabdeckung getrennt von Gerätefunktion und Schreibbestätigung ausweisen.
const expectedObserved = ["ready","soc","batteryPower","packState","socLimit","acMode","inputLimit","outputLimit"];
const missingObserved = expectedObserved.filter(k => !Object.prototype.hasOwnProperty.call(observed,k));
const invalidObserved = expectedObserved.filter(k => observed[k] && observed[k].valid !== true);
const stalePollObserved = expectedObserved.filter(k => observed[k] &&
  (observed[k].pollAgeMs == null || observed[k].pollAgeMs > 6500));
status.batteryBle.diagnosticCoverage = {
  loggerSchema:"1.1", expectedObserved, missingObserved, invalidObserved, stalePollObserved,
  allObserversPresent:missingObserved.length === 0,
  allObservedStatesValid:missingObserved.length === 0 && invalidObserved.length === 0,
  snapshotFrozenInRegulator:status.snapshotAttachment?.matched === true &&
    status.snapshotAttachment?.source !== "logger_compatibility",
  haCallAuditObserved:Number.isFinite(rawState.seq) && rawState.seq > 0,
  haCallAuditMeaning:"No audit events can also mean no changed command since context initialization.",
  meaning:"Coverage describes contributed diagnostic records, not device readiness or a write ACK."
};
return msg;
