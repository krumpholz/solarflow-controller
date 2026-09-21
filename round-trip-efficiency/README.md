# Seven-Day SOC-Adjusted Battery Efficiency

**English** | [Deutsch](README_DE.md)

Node-RED monitoring flow for battery energy efficiency. It reads daily energy counters and state of charge (SOC), calculates an energy balance and publishes a percentage to Home Assistant. It sends no battery control commands.

**Publication candidate: calculation revision 3.3.** Automated simulated-context tests are provided. Earlier revisions have received limited live feedback; final deployment acceptance remains pending. The percentage is a calculated SOC-based estimate, not a certified round-trip measurement.

## What is created automatically?

| Item | Created by importing this flow? |
| --- | --- |
| Daily charge/discharge energy input sensors | **No.** They must already exist in Home Assistant; instructions below. |
| Battery power or SOC measurement | **No.** A device integration or meter must supply real measurements. |
| `flow.batt_level` and optional `flow.batt_level_ts` | **No.** An external SOC writer on the same flow tab supplies them. |
| Context stores `memoryOnly` and `file` | **No.** Configure Node-RED before deployment. |
| Efficiency result sensor | The included HA Sensor node can create it after server/entity configuration and deployment, with the companion integration installed. |

Pasting only the calculation JavaScript into a Function node creates no HA entities and does not provide the required measurement-cycle metadata. New users import the complete flow. Existing revision-3.2 installations can replace only the calculation Function body.

## Dependencies and external inputs

Install Node-RED and `node-red-contrib-home-assistant-websocket`, connect it to your Home Assistant server, and install/configure the companion [Node-RED integration](https://github.com/zachowj/hass-node-red) in HA for the output sensor. The export declares websocket package 0.80.3; this is the source-export version, not a universal compatibility guarantee. The Node-RED add-on and the HA companion integration are separate components. See [HA Sensor node requirements](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html).

For HACS installation: search for `hass-node-red`, download it, restart HA, then add **Node-RED Companion** under **Settings → Devices & services → Add integration**. Follow the companion project's linked installation instructions if installing manually.

| External input | Required value / location | Supplied by |
| --- | --- | --- |
| `sensor.batterie_lade_energie_pro_tag` | Nonnegative daily cumulative **charge energy**, unit exactly `kWh`; resets at local midnight | HA device integration or helpers |
| `sensor.batterie_entlade_energie_pro_tag` | Nonnegative daily cumulative **discharge energy**, unit exactly `kWh`; resets at local midnight | HA device integration or helpers |
| `batt_level` | Number or numeric string, 0–100 **percent**, flow context, store `memoryOnly` | External SOC acquisition |
| `batt_level_ts` | Optional numeric Unix time in **milliseconds**, same flow/store | External SOC acquisition; required when `requireSocTimestamp: true` |
| `CFG.capacityKWh` | Actual battery capacity in kWh | User configuration in calculation Function |
| `CFG.maxPowerKW` | Maximum charge/discharge power in kW; check both directions | User configuration |
| Runtime timezone | Same local timezone as HA daily resets | Node-RED / HA configuration |

The energy IDs are examples retained for compatibility. If your IDs differ, change **both Current State nodes and `CFG.chargeEntity` / `CFG.dischargeEntity`**. An entity's friendly name alone is insufficient. Match SOC, capacity and both counters to the same battery system and measurement boundary. PV generation and household/grid consumption are not substitutes for battery charge/discharge energy.

There are **no required global context variables**. `batt_min_s`, `batt_max_s`, regulator mode, price blocks and battery control variables are not inputs to this calculation. `_eff` cycle metadata is created internally by the preparation Function. Do not manually prepopulate the persistent calculation state.

## Prepare the two daily energy sensors in Home Assistant

### A. Daily battery energy already exists

Reuse it if it has the correct direction, unit `kWh`, midnight reset and measurement boundary. Check actual states and attributes under **Developer tools → States**, including availability and `last_reset` when supplied. Convert Wh to kWh correctly upstream if needed; do not simply relabel the unit.

### B. Separate cumulative charge/discharge energy totals already exist

Create two **Utility Meter** helpers under **Settings → Devices & services → Helpers → Create helper**. Select the respective cumulative kWh input, daily reset, no reset offset, no tariffs, net consumption off and delta values off. For monotonically increasing lifetime inputs, disable periodically resetting; adapt that option if the source really resets. Leave “always available” off so source outages are not intentionally hidden. Verify the resulting entity IDs and map them into the flow. The first helper day contains only energy since setup. See [Utility Meter](https://www.home-assistant.io/integrations/utility_meter/).

### C. Only battery power in watts exists

Split signed battery power into two nonnegative signals before integrating: for **positive = charging**, charge power is `max(P, 0)` and discharge power is `max(-P, 0)`. Reverse the sign convention if your device uses the opposite one. Never integrate signed net power as if it were two separate energy counters.

Create one **Integral** helper for each directional power sensor. For W inputs select prefix `k`, time unit `h`, precision 3 and maximum sub-interval 60 seconds. Use `left` for a held, stepwise power signal; assess another method for a different sampling model. This produces two cumulative kWh totals, then create the daily Utility Meters from section B. See [Integral helper](https://www.home-assistant.io/integrations/integration/).

An optional complete YAML example is provided in [examples/home-assistant-energy.yaml](examples/home-assistant-energy.yaml). It uses `sensor.batterie_power` as a **placeholder for your real signed W measurement**. Replace it; verify every generated entity ID (existing names can cause suffixes), and adjust downstream `source` references as necessary. Merge `template`, `sensor` and `utility_meter` sections with existing configuration rather than duplicating top-level keys. Check HA configuration before applying/restarting. Do not create duplicate helpers if equivalent inputs already exist. The template availability condition prevents an unavailable source from being presented as a genuine zero-power reading; see [Template sensors](https://www.home-assistant.io/integrations/template/).

The example does not create a physical meter, SOC source or missing historical energy. A frozen but numeric power sensor can still produce incorrect integrated energy. Source health must be monitored upstream. Software integration is approximate and may not recover outages; compare the counters with the device's energy records. Keep both measurement directions on the same AC or DC boundary, including any intended auxiliary consumption.

## Supply SOC on the same Node-RED tab

Use your real battery SOC integration or measurement receiver and feed a validated percent value to an external Function node on the **same tab** as this flow. The writer is not included because the source is installation-specific. This example assumes `msg.payload` is the newly received SOC, not a whole HA event object:

```js
const raw = msg.payload;
const soc = (typeof raw === "number" ||
    (typeof raw === "string" && raw.trim() !== "")) ? Number(raw) : NaN;
if (!Number.isFinite(soc) || soc < 0 || soc > 100) {
    flow.set("batt_level", null, "memoryOnly");
    flow.set("batt_level_ts", null, "memoryOnly");
    return null;
}
flow.set("batt_level", soc, "memoryOnly");
flow.set("batt_level_ts", Date.now(), "memoryOnly");
return msg;
```

Set that timestamp only on receipt of a real current measurement; for delayed messages use a trustworthy source observation timestamp instead. Repeatedly reading an old cached HA state does not make it fresh. A state-change-only event may not arrive when SOC stays constant, so it cannot by itself prove periodic source freshness. If freshness cannot be established, supply only `batt_level`, clear any stale `batt_level_ts`, and leave `requireSocTimestamp: false`; diagnostics then explicitly report unverified freshness. With a timestamp present, readings older than `maxSocAgeMs` (120 seconds) or in the future are rejected even in optional mode. Scale tenths-of-percent only if that is actually the source unit. Repopulate the memory values after a Node-RED restart.

## Context storage and installation

Configure named stores in Node-RED `settings.js`, merging with existing settings. Keep the Node-RED user directory on persistent storage. Restart Node-RED if its settings changed.

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: { module: "localfilesystem", config: { cache: true, flushInterval: 30 } }
}
```

The Functions require synchronous cached access. Disk writes are batched; abrupt power loss can lose unflushed updates. This is not a disk-durability guarantee. See [Node-RED filesystem context](https://nodered.org/docs/api/context/store/localfilesystem).

1. Prepare both daily kWh sensors, SOC writer and context stores above.
2. Import **one** language: [flow.json](flow.json) or [flow_DE.json](flow_DE.json), on the SOC writer's tab. Both exports share IDs/context keys and must not run concurrently.
3. Select your HA server in both Current State nodes and the output entity configuration. Replace or remove the imported server placeholder; configure the connection for your add-on or standalone installation. Never publish credentials.
4. Match both input entity IDs in nodes and code. Current State outputs must retain the HA entity object in `msg.data` and string state in `msg.payload`; do not overwrite `_eff`.
5. Set capacity and power for your hardware. **8.640 kWh and 2.4 kW are example defaults, not automatic device detection.** Review delay/resolution settings below.
6. Match the Node-RED timezone to HA, e.g. `Europe/Berlin` where appropriate. Keep the included five-second polling trigger and two-output wiring.
7. Deploy, enable the diagnostic Debug node and inspect the output sensor in HA. Its friendly name is `Battery Efficiency Estimate` (EN) / `Lade Entlade Effizenz` (DE); its actual entity ID is assigned by HA and may differ or acquire a suffix. Reuse existing mappings when updating.

The Current State nodes read existing entities. Only the HA Sensor node publishes the result entity; it requires the configured companion integration. JavaScript-only updates to an existing calculation do not create another sensor.

## Calculation, partial buffers and interpretation

The first complete valid pair stores a baseline and publishes Unknown. Later accepted pairs contribute:

```text
charge   = current charge counter - previous accepted charge counter
output   = current discharge counter - previous accepted discharge counter
delta    = capacity_kWh * (current SOC - previous accepted SOC) / 100
eta (%)  = 100 * (sum(output) + sum(delta)) / sum(charge)
loss kWh = sum(charge) - sum(output) - sum(delta)
```

The window is **today plus the preceding six local calendar days**. New users start empty: no personal values or old v2 buffers are imported. A percentage is published once at least 0.1 kWh included charge energy is available, the current interval is accepted, SOC inputs are valid, and the result is finite and between 0 and 100%. **A full seven-day buffer is not required.** Earlier energy from the initial day is excluded because its matching SOC baseline is unknown. Example: 1.0 kWh charge, 0.7 kWh discharge, +0.1 kWh stored energy gives 80%.

The status shows percentage, days used and covered hours without an appended “estimate” label. Days used is not a count of complete days. `window_complete` remains false because midnight intervals and outages can be excluded; this is not a guaranteed 168-hour measurement. Invalid results are Unknown, never clipped to 0 or 100%. Both outputs carry the result; the second feeds diagnostics. The documented HA Sensor maps null to Unknown; verify that behavior in your installed versions.

SOC is only an estimate of stored energy. The formula assumes approximately linear SOC-to-energy conversion and a correct capacity. One point at 8.640 kWh corresponds to 0.0864 kWh; the 0.1 kWh startup threshold is not an accuracy guarantee. BMS recalibrations, quantization, source timing and missing intervals can materially affect short windows. Large detected SOC jumps are confirmed then excluded with their matching energy interval; smaller or gradual recalibrations may remain undetected. Separate charge/discharge efficiencies are not measured, and unequal endpoint SOC does not constitute a full AC-to-AC round-trip test.

## Delays, resets and restarts

| Parameter | Default | Meaning |
| --- | --- | --- |
| `maxPowerKW` | 2.4 | Physical power basis, both directions |
| `powerSafetyFactor` | 1.20 | 20% plausibility reserve; no hardware power setting |
| `maxReportingDelayMs` | 120000 | Reporting delay allowance |
| `counterStepKWh` | 0.1 | Conservative resolution allowance; use actual source resolution |
| `maxIntervalMs` | 120000 | Maximum gap between valid paired observations |
| `maxSocAgeMs` | 120000 | Maximum age of an available SOC timestamp |
| `requireSocTimestamp` | false | Set true only with a reliable timestamp writer |

Each energy direction gets a bounded allowance: `2.4 × 1.20 × 120 / 3600 + 0.1 = 0.196 kWh`. Accepted increments consume it; elapsed time replenishes it at 2.88 kW, capped at 0.196 kWh. It persists across normal restarts, rather than granting a fresh tolerance on every poll. HA polling does not guarantee fresh device measurements; the 120-second allowance must match actual source behavior.

| Event | Behavior |
| --- | --- |
| Energy increment above available allowance, or decrease without reset evidence | Unknown; retain the last accepted baseline and defer the entire difference. Recovery can include it later. A persistent jump above the maximum allowance does not become valid just by waiting. |
| Real paired-observation outage longer than 120 seconds | Keep history, exclude energy and SOC change across the gap, then rebaseline. |
| Midnight or confirmed counter reset | Exclude the boundary interval and rebaseline both counters and SOC together. |
| Excessive SOC jump | Defer; three consistent consecutive candidate pairs establish a new baseline, excluding the jump interval. |
| Same-day Node-RED restart with a recent valid observation | Continue from persistent state after inputs return. |
| Capacity, input entity mapping or runtime timezone changes | Archive the previous state and start a new baseline. |

If `last_reset` is present, it must belong to the current local day. Without it, both daily counters must show reset evidence at midnight. Unreported intra-day resets are not always detectable. A HA-only restart does not clear Node-RED context; a longer data outage still invokes gap handling. The preparation watchdog reports missing completed cycles after 15 seconds while Node-RED continues running. Daily-counter design intentionally excludes some energy across boundaries and outages.

## Persistent state and upgrading an existing installation

| Context key | Store | Role |
| --- | --- | --- |
| `batt_eff_state_v3` | `file` | Daily totals, last accepted sample, persistent energy allowance |
| `batt_eff_previous_state_v3` | `file` | Most recent archive after configuration change |
| `sum_batt_la_7d`, `sum_batt_ela_7d` | `file` | Included energy sums in kWh |
| `la_ela_es` | `file` | Current percentage or null |
| `batt_eff_last_completed_v3` | `memoryOnly` | Internal watchdog timestamp |

These are internal outputs, not required external variables. Included sums can differ from raw daily counters because unobserved/excluded intervals are not counted.

Revision 3.3 has **no automatic v2 migration** and never reads the old ring/live/snapshot keys. Existing v3 state is retained on the same tab/stores with unchanged capacity, IDs and timezone. Compatibility evaluation for records already marked `legacy` remains until they expire naturally; their window-endpoint SOC adjustment, existing migration metadata and uncertainty flags are preserved. Nothing is reimported. New users never acquire those records from this distribution.

For an existing 3.2 deployment, back up the flow/context, replace only the body of the calculation Function with [battery-efficiency.js](battery-efficiency.js) or [battery-efficiency_DE.js](battery-efficiency_DE.js), preserve your CFG values and deploy the modified node. Do not delete state or reimport a second flow for this update. Schema `version: 3` stays compatible; diagnostics identify `calculation_revision: "3.3"`.

For the final deployment check, capture diagnostics after deployment, after a real charge-counter increase, after a discharge increase, after midnight and after a controlled restart. Check input values against included increments, `interval_status`, `excluded_intervals`, `energy_guard`, SOC freshness and persistence. A known measurement gap may legitimately exclude an interval; investigate unexpected exclusions. Share logs without credentials. The final live acceptance is pending.

## Files and verification

Function sources: [calculation](battery-efficiency.js), [preparation](prepare-cycle.js); German equivalents have `_DE` suffixes. The existing [text download](function%20node%20-%20Round-Trip%20Efficiency.txt) matches the English calculation. `build-german-flow.py` generates the German interface from the identical executable core. [VALIDATION.md](VALIDATION.md) documents test scope. This flow has no embedded user energy history.
