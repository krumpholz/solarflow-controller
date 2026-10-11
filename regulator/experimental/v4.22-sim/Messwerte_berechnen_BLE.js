/************************************************************
 * SNAPSHOT BUILDER / DIAGNOSE
 * RELEASE 1.3-ESP-BATT-FALLBACK
 *
 * Eingänge:
 *   msg.cycleId
 *   msg.triggerTs
 *   msg.topic      -> p_zaehler | p_batterie |
 *                     p_batterie_fail |
 *                     p_solar_s | p_solar_t
 *   msg.payload    -> Zahlenwert
 *   msg.rxTs       -> optional Empfangszeit
 *
 * Ausgänge:
 *   [0]  p_zaehler
 *   [1]  p_batterie
 *   [2]  p_solar_s
 *   [3]  p_solar_t
 *   [4]  p_solar
 *   [5]  p_haus
 *   [6]  p_batt_out
 *   [7]  p_batt_in
 *   [8]  p_zaehler_out
 *   [9]  p_zaehler_in
 *   [10] Diagnoseobjekt
 *
 * Batterielogik:
 *  - Primärquelle bleibt die zyklusfrische Modbus-Messung p_batterie.
 *  - Fehlt sie nur vorübergehend, wird NICHT sofort auf ESP umgeschaltet.
 *  - Erst ein explizites p_batterie_fail für denselben Cycle erlaubt
 *    den ESP-Fallback.
 *  - ESP-Fallback:
 *      flow.snapshot_esp_battery
 *      flow.batt_ble_ready === true
 *      max. 6500 ms alt
 *  - Der alte Hold des letzten Modbus-Batteriewerts wird NICHT mehr benutzt.
 *  - ESP gilt als gültiger Ersatzwert, aber NICHT als zyklusfrische
 *    Batteriemessung für schnelle Regler-/Lastsprunglogik.
 *  - Reject/Qualität basieren weiterhin nur auf:
 *      p_zaehler, p_solar_s, p_solar_t
 ************************************************************/

const VERSION = "1.3-ESP-BATT-FALLBACK";

// --------------------------------------------------
// Frisch erforderlich:
const REQUIRED_FRESH = ["p_zaehler", "p_solar_s", "p_solar_t"];

// Batterie separat:
const BATTERY_TOPIC = "p_batterie";
const BATTERY_FAIL_TOPIC = "p_batterie_fail";

// Für eingehende Nachrichten erlaubt:
const ALLOWED_TOPICS = [
    "p_zaehler",
    "p_batterie",
    "p_batterie_fail",
    "p_solar_s",
    "p_solar_t"
];

// --------------------------------------------------
// Grenzwerte
const MAX_SPREAD_MS = 120;
const MAX_LATENCY_MS = 450;
const MAX_CYCLE_AGE_MS = 5000;

// ESP-Telemetrie kommt ungefähr alle 5 s.
// 6500 ms = etwas Reserve, ohne einen alten Wert lange weiterzuverwenden.
const ESP_BATTERY_MAX_AGE_MS = 6500;

// Nur Diagnose / Missing-Zählung:
// Modbus-Client-Timeout liegt bei 500 ms.
const BATTERY_WAIT_WARN_MS = 600;

const EXCELLENT_SPREAD_MS = 40;
const EXCELLENT_LATENCY_MS = 200;

const GOOD_SPREAD_MS = 70;
const GOOD_LATENCY_MS = 350;

// --------------------------------------------------
// Log-Größen
const SPREAD_LOG_SIZE = 200;
const REJECT_LOG_SIZE = 100;
const ERROR_LOG_SIZE = 50;

// --------------------------------------------------
function ensureTopicMap(obj) {
    obj = obj || {};
    return {
        p_zaehler: Number(obj.p_zaehler || 0),
        p_batterie: Number(obj.p_batterie || 0),
        p_solar_s: Number(obj.p_solar_s || 0),
        p_solar_t: Number(obj.p_solar_t || 0)
    };
}

function ensureQualityMap(obj) {
    obj = obj || {};
    return {
        excellent: Number(obj.excellent || 0),
        good: Number(obj.good || 0),
        borderline: Number(obj.borderline || 0),
        rejected: Number(obj.rejected || 0)
    };
}

// --------------------------------------------------
// Fehler-/Timeout-Messages früh abfangen
const now = Date.now();

if (
    msg &&
    (
        msg.type === "error" ||
        msg.error ||
        (msg.payload && typeof msg.payload === "object" && msg.payload.type === "error") ||
        (msg.__enc__ === true && msg.type === "error")
    )
) {
    let errorStats = flow.get("snapshot_error_stats") || {
        errorCount: 0,
        timeoutCount: 0,
        lastErrorTs: 0,
        lastErrorMessage: "",
        lastErrorName: ""
    };

    let errorLog = flow.get("snapshot_error_log") || [];

    const errObj =
        (msg.payload && typeof msg.payload === "object" && msg.payload.data) ? msg.payload.data :
            (msg.data && typeof msg.data === "object") ? msg.data :
                (msg.error && typeof msg.error === "object") ? msg.error :
                    {};

    const errName = String(errObj.name || msg.name || "Error");
    const errMessage = String(errObj.message || msg.message || "unknown error");

    errorStats.errorCount++;
    if (/timed out/i.test(errMessage)) {
        errorStats.timeoutCount++;
    }
    errorStats.lastErrorTs = now;
    errorStats.lastErrorMessage = errMessage;
    errorStats.lastErrorName = errName;

    flow.set("snapshot_error_stats", errorStats);

    errorLog.push({
        ts: now,
        name: errName,
        message: errMessage
    });

    if (errorLog.length > ERROR_LOG_SIZE) {
        errorLog.shift();
    }

    flow.set("snapshot_error_log", errorLog);

    node.status({
        fill: "red",
        shape: "ring",
        text: `ERR ${errName}: ${errMessage}`
    });

    return null;
}

// --------------------------------------------------
const cycleId = String(msg.cycleId || "");
if (!cycleId) return null;

const cycleShort = cycleId.slice(-6);

// --------------------------------------------------
let store = flow.get("snapshot_store") || {};
let spreadLog = flow.get("spread_log") || [];
let rejectLog = flow.get("snapshot_reject_log") || [];

let statsRaw = flow.get("snapshot_diag_stats") || {};

let diagStats = {
    okCount: Number(statsRaw.okCount || 0),
    rejectedCount: Number(statsRaw.rejectedCount || 0),
    incompleteCount: Number(statsRaw.incompleteCount || 0),

    missingCountByTopic: ensureTopicMap(statsRaw.missingCountByTopic),
    slowestCountByTopic: ensureTopicMap(statsRaw.slowestCountByTopic),
    rejectedCountBySlowestTopic: ensureTopicMap(statsRaw.rejectedCountBySlowestTopic),
    worstLatencyByTopic: ensureTopicMap(statsRaw.worstLatencyByTopic),

    qualityCount: ensureQualityMap(statsRaw.qualityCount)
};

// --------------------------------------------------
// Alte Cycles aufräumen
for (const id of Object.keys(store)) {
    const entry = store[id];
    const created = Number(entry?.created || 0);

    if (!created || now - created > MAX_CYCLE_AGE_MS) {
        delete store[id];
    }
}

// --------------------------------------------------
if (!store[cycleId]) {
    store[cycleId] = {
        created: now,
        triggerTs: Number(msg.triggerTs || now),
        values: {},
        lastTopic: null,
        incompleteCounted: false,
        batteryFailed: false,
        batteryFailRxTs: 0
    };
}

// --------------------------------------------------
const topic = String(msg.topic || "");
const rxTs = Number(msg.rxTs || now);
const triggerTs = Number(msg.triggerTs || store[cycleId].triggerTs || now);

if (!ALLOWED_TOPICS.includes(topic)) return null;

// --------------------------------------------------
store[cycleId].triggerTs = Number.isFinite(triggerTs) ? triggerTs : now;
store[cycleId].lastTopic = topic;

// --------------------------------------------------
// Expliziter Modbus-Batteriefehler.
//
// Dieser Marker enthält KEINEN Leistungswert.
// Er erlaubt nur für genau diesen Cycle den ESP-Fallback.
// --------------------------------------------------
if (topic === BATTERY_FAIL_TOPIC) {
    store[cycleId].batteryFailed = true;
    store[cycleId].batteryFailRxTs =
        Number.isFinite(rxTs) ? rxTs : now;

    flow.set("snapshot_store", store);
} else {
    // Payload prüfen
    const value = Number(msg.payload);

    // Nur finite Messwerte speichern
    if (Number.isFinite(value)) {
        store[cycleId].values[topic] = {
            value,
            rxTs: Number.isFinite(rxTs) ? rxTs : now
        };

        flow.set("snapshot_store", store);
    } else {
        // Nicht-finite Batteriemessung wie einen Ausfall behandeln.
        // Für andere Messgrößen wird die Nachricht verworfen.
        if (topic === BATTERY_TOPIC) {
            store[cycleId].batteryFailed = true;
            store[cycleId].batteryFailRxTs =
                Number.isFinite(rxTs) ? rxTs : now;

            flow.set("snapshot_store", store);
        } else {
            return null;
        }
    }
}

// --------------------------------------------------
// Prüfung: frische Pflichtwerte vorhanden?
const values = store[cycleId].values;
const freshComplete = REQUIRED_FRESH.every(k => values[k]);

if (!freshComplete) {
    const missing = REQUIRED_FRESH.filter(k => !values[k]);
    const ageMs = now - store[cycleId].triggerTs;

    if (ageMs > 120) {
        node.status({
            fill: "grey",
            shape: "ring",
            text: `Zy=${cycleShort} ${Object.keys(values).length}/4 fehlt:${missing.join(",")}`
        });

        // nur einmal pro Cycle zählen
        if (!store[cycleId].incompleteCounted) {
            store[cycleId].incompleteCounted = true;

            diagStats.incompleteCount++;

            for (const m of missing) {
                diagStats.missingCountByTopic[m]++;
            }

            flow.set("snapshot_diag_stats", diagStats);
            flow.set("snapshot_store", store);
        }
    }

    return null;
}

// --------------------------------------------------
// Frische Pflichtwerte für Qualitäts-/Reject-Bewertung
const freshEntries = REQUIRED_FRESH.map(k => ({
    topic: k,
    rxTs: Number(values[k].rxTs),
    value: Number(values[k].value)
}));

const freshRxList = freshEntries.map(x => x.rxTs);

const minRxTs = Math.min(...freshRxList);
const maxRxTs = Math.max(...freshRxList);

const spreadMs = maxRxTs - minRxTs;
const maxLatencyMs = maxRxTs - store[cycleId].triggerTs;

const slowest = freshEntries.reduce((a, b) => a.rxTs >= b.rxTs ? a : b).topic;
diagStats.slowestCountByTopic[slowest]++;

// --------------------------------------------------
const latencyByTopic = {};
const rxTsByTopic = {};

for (const e of freshEntries) {
    const lat = e.rxTs - store[cycleId].triggerTs;

    latencyByTopic[e.topic] = lat;
    rxTsByTopic[e.topic] = e.rxTs;

    if (lat > diagStats.worstLatencyByTopic[e.topic]) {
        diagStats.worstLatencyByTopic[e.topic] = lat;
    }
}

// --------------------------------------------------
// BATTERIEQUELLE
//
// Priorität 1:
//   zyklusfrische Modbus-Messung.
//
// Priorität 2:
//   ESP-Batterieleistung, aber NUR wenn für diesen Cycle
//   ein expliziter Modbus-Batteriefehler gemeldet wurde.
//
// Wichtig:
// Fehlt p_batterie nur deshalb, weil die Modbus-Antwort noch unterwegs ist,
// wird gewartet. So kann der langsamere ESP-Wert die aktuelle
// Modbus-Messung nicht versehentlich verdrängen.
// --------------------------------------------------
let batterySource = "none";

// Name für Kompatibilität zum bestehenden Regler beibehalten.
// Bei source="esp" enthält er das echte Alter des ESP-Werts.
let batteryHoldAgeMs = 0;

let batteryFreshInCycle = false;

let batteryValue;
let batteryRxTs;

const modbusBatteryEntry = values[BATTERY_TOPIC];

const modbusBatteryValid =
    !!(
        modbusBatteryEntry &&
        Number.isFinite(Number(modbusBatteryEntry.value)) &&
        Number.isFinite(Number(modbusBatteryEntry.rxTs))
    );

// --------------------------------------------------
// PRIORITÄT 1: aktuelle Modbus-Messung dieses Cycles
// --------------------------------------------------
if (modbusBatteryValid) {
    batterySource = "fresh";
    batteryFreshInCycle = true;

    batteryValue = Number(modbusBatteryEntry.value);
    batteryRxTs = Number(modbusBatteryEntry.rxTs);

    const batteryLatencyMs =
        batteryRxTs - store[cycleId].triggerTs;

    latencyByTopic[BATTERY_TOPIC] = batteryLatencyMs;
    rxTsByTopic[BATTERY_TOPIC] = batteryRxTs;

    if (
        Number.isFinite(batteryLatencyMs) &&
        batteryLatencyMs > diagStats.worstLatencyByTopic[BATTERY_TOPIC]
    ) {
        diagStats.worstLatencyByTopic[BATTERY_TOPIC] = batteryLatencyMs;
    }
}

// --------------------------------------------------
// PRIORITÄT 2: ESP-Fallback nur nach bestätigtem Modbus-Ausfall
// --------------------------------------------------
else if (store[cycleId].batteryFailed === true) {
    const espBattery =
        flow.get("snapshot_esp_battery") || null;

    const bleReady =
        flow.get("batt_ble_ready") === true;

    if (
        bleReady &&
        espBattery &&
        Number.isFinite(Number(espBattery.value)) &&
        Number.isFinite(Number(espBattery.rxTs))
    ) {
        const espValue = Number(espBattery.value);
        const espRxTs = Number(espBattery.rxTs);
        const espAgeMs = now - espRxTs;

        if (
            Number.isFinite(espAgeMs) &&
            espAgeMs >= 0 &&
            espAgeMs <= ESP_BATTERY_MAX_AGE_MS
        ) {
            batterySource = "esp";

            // ESP ist als Ersatzwert gültig,
            // aber NICHT als schnelle zyklusfrische Batteriemessung.
            batteryFreshInCycle = false;

            batteryValue = espValue;
            batteryRxTs = espRxTs;
            batteryHoldAgeMs = espAgeMs;

            latencyByTopic[BATTERY_TOPIC] = espAgeMs;
            rxTsByTopic[BATTERY_TOPIC] = espRxTs;

            if (
                espAgeMs > diagStats.worstLatencyByTopic[BATTERY_TOPIC]
            ) {
                diagStats.worstLatencyByTopic[BATTERY_TOPIC] = espAgeMs;
            }
        }
    }
}

// --------------------------------------------------
// Ohne aktuelle Modbus-Batterieleistung oder gültigen ESP-Fallback
// kein verwertbarer Snapshot.
// --------------------------------------------------
if (!Number.isFinite(batteryValue)) {
    const ageMs = now - store[cycleId].triggerTs;
    const batteryFailed = store[cycleId].batteryFailed === true;

    // Solange Modbus noch nicht als fehlgeschlagen markiert ist,
    // warten wir bis zur normalen Modbus-Antwort / zum Fehlerausgang.
    if (!batteryFailed) {
        if (ageMs > 120) {
            node.status({
                fill: "grey",
                shape: "ring",
                text: `Zy=${cycleShort} warte Batterie`
            });
        }

        return null;
    }

    // Modbus ist ausgefallen, aber ESP ist ebenfalls nicht nutzbar.
    if (ageMs > BATTERY_WAIT_WARN_MS) {
        node.status({
            fill: "red",
            shape: "ring",
            text: `Zy=${cycleShort} Batt Modbus fail + ESP fehlt/alt`
        });
    } else {
        node.status({
            fill: "yellow",
            shape: "ring",
            text: `Zy=${cycleShort} Batt fail, ESP nicht nutzbar`
        });
    }

    if (!store[cycleId].incompleteCounted) {
        store[cycleId].incompleteCounted = true;

        diagStats.incompleteCount++;
        diagStats.missingCountByTopic[BATTERY_TOPIC]++;

        flow.set("snapshot_diag_stats", diagStats);
        flow.set("snapshot_store", store);
    }

    return null;
}

// --------------------------------------------------
spreadLog.push({
    ts: now,
    cycleId,
    spreadMs,
    maxLatencyMs,
    slowestTopic: slowest,
    batterySource,
    batteryHoldAgeMs
});

if (spreadLog.length > SPREAD_LOG_SIZE) {
    spreadLog.shift();
}

flow.set("spread_log", spreadLog);

// --------------------------------------------------
let p_zaehler = Number(values.p_zaehler.value);
let p_batterie = Number(batteryValue);
let p_solar_s = Number(values.p_solar_s.value);
let p_solar_t = Number(values.p_solar_t.value);

// --------------------------------------------------
// Reject-Kriterien nur für frische Pflichtwerte
const rejectBySpread = spreadMs > MAX_SPREAD_MS;
const rejectByLatency = maxLatencyMs > MAX_LATENCY_MS;

if (rejectBySpread || rejectByLatency) {
    diagStats.rejectedCount++;
    diagStats.qualityCount.rejected++;
    diagStats.rejectedCountBySlowestTopic[slowest]++;

    flow.set("snapshot_diag_stats", diagStats);

    rejectLog.push({
        ts: now,
        cycleId,
        cycleShort,
        spreadMs,
        maxLatencyMs,
        slowestTopic: slowest,
        batterySource,
        batteryHoldAgeMs,
        reason: rejectBySpread && rejectByLatency ? "spread+latency" :
            rejectBySpread ? "spread" : "latency",
        latencyByTopic
    });

    if (rejectLog.length > REJECT_LOG_SIZE) {
        rejectLog.shift();
    }

    flow.set("snapshot_reject_log", rejectLog);

    node.status({
        fill: "red",
        shape: "ring",
        text: `Zy=${cycleShort} rejected Δ=${spreadMs} L=${maxLatencyMs}`
    });

    delete store[cycleId];
    flow.set("snapshot_store", store);

    return null;
}

// --------------------------------------------------
// Qualitätsklassifikation nur aus frischen Pflichtwerten
let quality = "borderline";

if (spreadMs <= EXCELLENT_SPREAD_MS && maxLatencyMs <= EXCELLENT_LATENCY_MS) {
    quality = "excellent";
} else if (spreadMs <= GOOD_SPREAD_MS && maxLatencyMs <= GOOD_LATENCY_MS) {
    quality = "good";
}

diagStats.qualityCount[quality]++;

// --------------------------------------------------
// Abgeleitete Werte
let p_solar = p_solar_s + p_solar_t;
let p_haus = p_solar + p_zaehler - p_batterie;

let p_batt_out = Math.max(0, -p_batterie);
let p_batt_in = Math.max(0, p_batterie);

let p_zaehler_in = Math.max(0, p_zaehler);
let p_zaehler_out = Math.max(0, -p_zaehler);

// --------------------------------------------------
// Runden
p_solar = Math.round(p_solar);
p_haus = Math.round(p_haus);

p_batt_out = Math.round(p_batt_out);
p_batt_in = Math.round(p_batt_in);

p_zaehler_in = Math.round(p_zaehler_in);
p_zaehler_out = Math.round(p_zaehler_out);

p_zaehler = Math.round(p_zaehler);
p_batterie = Math.round(p_batterie);
p_solar_s = Math.round(p_solar_s);
p_solar_t = Math.round(p_solar_t);

// --------------------------------------------------
// Flow-Variablen setzen
flow.set("p_zaehler", p_zaehler);
flow.set("p_batterie", p_batterie);
flow.set("p_solar_s", p_solar_s);
flow.set("p_solar_t", p_solar_t);

flow.set("p_solar", p_solar);
flow.set("p_haus", p_haus);

flow.set("p_batt_out", p_batt_out);
flow.set("p_batt_in", p_batt_in);

flow.set("p_zaehler_out", p_zaehler_out);
flow.set("p_zaehler_in", p_zaehler_in);

// --------------------------------------------------
// ERFOLGREICHEN SNAPSHOT FÜR DEN REGLER MARKIEREN
//
// Diese Werte werden ausschließlich nach einem vollständig
// verwertbaren und nicht verworfenen Snapshot gesetzt.
//
// Der verzögert ausgelöste Regler kann dadurch eindeutig prüfen,
// ob die Flow-Messwerte zum aktuellen Messzyklus gehören.
flow.set(
    "snapshot_last_ok_cycleId",
    cycleId
);

flow.set(
    "snapshot_last_ok_ts",
    now
);

flow.set(
    "snapshot_last_ok_triggerTs",
    store[cycleId].triggerTs
);

flow.set(
    "snapshot_last_ok_quality",
    quality
);

flow.set(
    "snapshot_last_battery_source",
    batterySource
);

flow.set(
    "snapshot_last_battery_fresh",
    batteryFreshInCycle
);

flow.set(
    "snapshot_last_battery_hold_age_ms",
    batteryHoldAgeMs
);

// Neuer, semantisch passender Name zusätzlich.
// Der alte Name bleibt für Regler-Kompatibilität bestehen.
flow.set(
    "snapshot_last_battery_fallback_age_ms",
    batteryHoldAgeMs
);

// --------------------------------------------------
diagStats.okCount++;
flow.set("snapshot_diag_stats", diagStats);

// --------------------------------------------------
let fill = "green";
if (quality === "good") fill = "green";
if (quality === "borderline") fill = "yellow";

// Ein erfolgreicher ESP-Fallback bleibt sichtbar.
if (batterySource === "esp") fill = "yellow";

node.status({
    fill,
    shape: "dot",
    text:
        `Zy=${cycleShort} ${quality} H=${p_haus} Δ=${spreadMs} L=${maxLatencyMs}` +
        (
            batterySource === "esp"
                ? ` batt=ESP(${Math.round(batteryHoldAgeMs)}ms)`
                : ""
        )
});

// --------------------------------------------------
const diag = {
    state: "ok",
    ts: now,
    version: VERSION,
    cycleId,
    cycleShort,
    quality,
    spreadMs,
    maxLatencyMs,
    slowestTopic: slowest,
    latencyByTopic,
    rxTsByTopic,
    sources: {
        p_zaehler: "fresh",
        p_batterie: batterySource,
        p_solar_s: "fresh",
        p_solar_t: "fresh"
    },
    holdInfo: {
        // Für Abwärtskompatibilität vorhanden.
        // Es wird kein alter Modbuswert mehr gehalten.
        batteryHeld: false,
        batteryHoldAgeMs
    },
    batteryFallback: {
        used: batterySource === "esp",
        source: batterySource,
        ageMs: batteryHoldAgeMs,
        modbusFailed: store[cycleId].batteryFailed === true,
        modbusFailRxTs: Number(store[cycleId].batteryFailRxTs || 0)
    },
    values: {
        p_zaehler,
        p_batterie,
        p_solar_s,
        p_solar_t,
        p_solar,
        p_haus,
        p_batt_out,
        p_batt_in,
        p_zaehler_out,
        p_zaehler_in
    },
    stats: diagStats
};

// Letzte akzeptierte Diagnose für zeitgleiche Kopie im Regler.
flow.set("snapshot_last_diagnostic", RED.util.cloneMessage(diag));

// --------------------------------------------------
delete store[cycleId];
flow.set("snapshot_store", store);

// --------------------------------------------------
return [
    { payload: p_zaehler, topic: "p_zaehler" },
    { payload: p_batterie, topic: "p_batterie" },
    { payload: p_solar_s, topic: "p_solar_s" },
    { payload: p_solar_t, topic: "p_solar_t" },
    { payload: p_solar, topic: "p_solar" },
    { payload: p_haus, topic: "p_haus" },
    { payload: p_batt_out, topic: "p_batt_out" },
    { payload: p_batt_in, topic: "p_batt_in" },
    { payload: p_zaehler_out, topic: "p_zaehler_out" },
    { payload: p_zaehler_in, topic: "p_zaehler_in" },
    { payload: diag }
];