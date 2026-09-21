# Seven-Day SOC-Adjusted Battery Efficiency Estimate

A Node-RED monitoring flow that estimates battery energy efficiency from daily charging/discharging counters and state of charge (SOC). It does not send battery control commands.

**Status:** reviewed implementation with automated simulated-context tests. Not yet validated in a live Home Assistant/Node-RED installation. This is an estimate, not a certified round-trip efficiency measurement.

## Files

| File | Purpose |
| --- | --- |
| [flow.json](flow.json) | Importable flow, including trigger, paired requests, calculation, diagnostics and HA sensor |
| [battery-efficiency.js](battery-efficiency.js) | Calculation Function body; two outputs |
| [prepare-cycle.js](prepare-cycle.js) | SOC snapshot, cycle ID and missing-response watchdog; two outputs |
| [function node - Round-Trip Efficiency.txt](function%20node%20-%20Round-Trip%20Efficiency.txt) | Identical copy of the calculation Function body for the existing download path |
| [tests/efficiency.test.cjs](tests/efficiency.test.cjs) | Automated regression scenarios |
| [VALIDATION.md](VALIDATION.md) | Validation scope and remaining installation checks |

**Upgrade the complete flow.** Replacing only the old Function body is insufficient: the new calculation requires the cycle metadata supplied by the preparation node and has two outputs.

## What changed from the supplied flow

The original export included two independent Current State nodes, the calculation Function, an HA sensor and configuration nodes. It did not include a polling trigger or the node that writes `flow.batt_level`.

- Both energy readings now belong to one numbered request cycle. Incomplete, duplicate and delayed responses cannot silently mix different cycles.
- Unknown, unavailable, blank, boolean, non-finite and negative energy values are rejected. Null SOC is never converted to zero.
- The first paired measurement establishes a baseline. Earlier daily energy is excluded because its matching start SOC is unknown.
- Energy differences and SOC differences use the same accepted interval endpoints. The delayed ten-minute median has been removed.
- Totals and their matching baseline are kept together in one automatically persisted state object.
- A gap or reset starts a new segment. Its unmeasured energy and SOC change are both excluded.
- Out-of-range estimates are reported as diagnostics; the HA sensor becomes Unknown instead of showing a clipped 0% or 100%.
- Comments, node names, status messages and documentation are in English. Existing German entity IDs and compatibility context keys remain unchanged so their references still work.

## Installation and upgrade

1. Back up your existing flow and persistent context. Disable the old efficiency calculation before enabling this replacement.
2. Configure the context stores below and restart Node-RED if the settings changed.
3. Import `flow.json` **onto the existing flow tab that supplies `flow.batt_level`**. A new tab has a different flow context. Select your existing Home Assistant server in both Current State nodes and the entity configuration; avoid leaving duplicate old and new estimators connected to the same sensor.
4. Review `CFG.capacityKWh`: the supplied **8.640 kWh** is the original installation's value, not a universal default. Review `maxPowerKW` and counter resolution as well.
5. Check both energy entity IDs in the Current State nodes and in `CFG`. They must be daily cumulative energy counters in **kWh**, resetting at local midnight. The calculation also checks the entity's `unit_of_measurement` attribute. Current State nodes use string state type so invalid source states remain distinguishable.
6. Ensure the external SOC writer supplies a finite percentage from 0 to 100 to `batt_level` in `memoryOnly`. Do not divide this percentage by ten unless the upstream value is actually in tenths of a percent.
7. Prefer adding `batt_level_ts` as described below and enabling `requireSocTimestamp`. It is optional by default to accommodate the supplied flow's existing interface.
8. Set the Node-RED runtime timezone to the same timezone used for the daily sensor resets, for example `Europe/Berlin` when appropriate. Restart after changing the runtime timezone.
9. Deploy and check the diagnostic output. The included Inject node runs every five seconds. The first complete measurement intentionally produces Unknown; accumulation starts with the next accepted interval.
10. Verify the HA sensor name/entity and any dashboards that used the previous sensor. The exported friendly name is now `Battery Efficiency Estimate`; preserve your existing entity mapping if required.

The supplied export declares `node-red-contrib-home-assistant-websocket` **0.80.3**. The HA Sensor node also requires the companion Node-RED integration in Home Assistant. This package version is the source export's dependency, not a claim of a completed runtime compatibility test.

### Context storage

Merge this configuration into Node-RED's `settings.js`; preserve any other stores you already use:

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: { module: "localfilesystem", config: { cache: true, flushInterval: 30 } }
}
```

The functions use synchronous context access, so the file store must have caching enabled. Each accepted paired sample updates the cached persistent state; the store batches disk writes. No manual snapshot switch is needed. Sudden power loss can still lose unflushed data. See [Node-RED's localfilesystem documentation](https://nodered.org/docs/api/context/store/localfilesystem).

### SOC timestamp

In your **actual SOC acquisition node**, after validating a newly received SOC measurement, update these values together:

```js
// socPercent must already be validated as a number in the range 0..100.
flow.set("batt_level", socPercent, "memoryOnly");
flow.set("batt_level_ts", Date.now(), "memoryOnly");
```

Only refresh the timestamp when a real measurement arrives. Reading an old cached SOC every five seconds does not make it fresh. The preparation node copies both values once into the shared request cycle.

With a timestamp, the calculation rejects SOC more than 15 seconds old or from the future. Without one, the result explicitly reports `soc_freshness_verified: false`. Set `requireSocTimestamp: true` to refuse unverified SOC entirely. The optional timestamp writer is not included because the original SOC acquisition flow was not supplied.

Current State returns HA's last known entity state, not a guaranteed fresh device measurement. Cycle pairing coordinates requests; it does not make the underlying device measurements physically simultaneous. Unchanged energy counters can be legitimate, so `last_updated` alone is not used as a freshness timeout. Source availability and correct energy integration must be checked upstream. See the [Current State documentation](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/current-state.html).

## Calculation and interpretation

For each accepted interval:

```text
charge energy       = current daily charge counter - previous counter
discharge energy    = current daily discharge counter - previous counter
stored energy delta = capacity_kWh * (current SOC - previous SOC) / 100
```

Within today and the previous six **local calendar days**, the flow sums only accepted intervals:

```text
estimated efficiency (%) = 100 * (sum(discharge) + sum(stored energy delta)) / sum(charge)
estimated losses (kWh)   = sum(charge) - sum(discharge) - sum(stored energy delta)
```

This is an SOC-adjusted energy-balance estimate. It assumes stored energy is approximately proportional to SOC and the configured capacity reflects the battery being measured. It does not measure separate charging and discharging efficiencies. With different start/end SOC, it is not equivalent to a complete AC-to-AC round-trip test. Confirm whether the source counters measure AC energy, DC energy, and any auxiliary consumption; the submitted flow does not establish those measurement boundaries.

Operating SOC limits are not physical measurement validity limits: a real SOC below a configured minimum may still be a valid reading. `batt_min_s` and `batt_max_s` are therefore no longer used to reject or clamp SOC. The nominal-capacity correction in the old formula already algebraically cancelled those limits.

SOC is quantized and may be recalibrated by the BMS. At 8.640 kWh, one percentage point represents 0.0864 kWh in this model. The 0.1 kWh minimum charge threshold is only a numerical guard; it is not an accuracy guarantee. Low-throughput estimates can remain noisy or out of range. Longer measured periods generally reduce the relative effect of endpoint quantization, but gaps and repeated rebaselining add uncertainty.

## Gaps, resets and restart behavior

| Situation | Behavior |
| --- | --- |
| Initial deployment, or no v3 history | Start from current paired counters and SOC; do not include energy from earlier today. |
| Restart on the same day, latest persisted sample at most 120 seconds old | Continue from the stored matching baseline, including increments since that sample. |
| Longer gap | Preserve previous measured totals; exclude the gap's energy and SOC change; establish a new baseline. |
| Local midnight | Preserve prior measured intervals; exclude the interval spanning the daily reset; begin at a new paired baseline. |
| Counter decreases or its reset timestamp changes | Exclude that interval and rebaseline both counters and SOC together. |
| Implausibly large energy increment | Exclude the interval and rebaseline; do not count a counter jump as physical energy. |
| SOC jump beyond configured tolerance plus elapsed-time power allowance | Reject it without updating the energy baseline. Three consecutive coherent candidate pairs trigger rebaselining, excluding the jump interval. |
| Capacity, entity IDs or runtime timezone changed | Preserve the previous v3 state in an archive key and start a new baseline. |

When `last_reset` is present, it must identify the current local day. Without it, crossing midnight requires observed reset evidence for both counters. If a reset occurred during an outage and the counter has already exceeded its previous value, the flow cannot infer the reset; it waits instead of inventing continuity. Providing reliable reset metadata is preferable. An intra-day reset that is not reported and has already regrown beyond the prior counter value cannot always be detected.

Midnight gaps and initial partial days are intentional with the available daily counters. `window_complete` is always false; `covered_hours` describes included intervals. This is neither seven guaranteed complete days nor a rolling 168-hour measurement. `excluded_gap_hours` counts the elapsed gaps detected when a new baseline is established; it does not include time before the initial baseline and is not a completeness percentage. Continuous lifetime energy counters would be needed for a more complete midnight-spanning design.

## Outputs and persistent data

The calculation Function has two outputs:

1. HA state message: `msg.payload` is a plausible estimate rounded to one decimal, or `null` (Unknown) for invalid data, insufficient throughput, a new baseline or an out-of-range estimate. The HA sensor retains quality and timestamp attributes.
2. Diagnostic message: the same payload plus `msg.result`, including raw efficiency, energy sums, estimated losses, interval coverage, reset/SOC timestamp verification and daily interval totals. Enable the supplied Debug node when commissioning.

An incomplete pair normally produces no output while waiting for its second response. Missing responses are caught by later cycles and the 15-second watchdog. The watchdog depends on Node-RED and its Inject node continuing to run; it cannot run while Node-RED itself is stopped. `timestamp` on an error is the diagnostic time, not proof of a fresh measurement.

The documented HA Sensor behavior maps a null state to Unknown. Confirm this with your installed integration during commissioning. See the [Sensor documentation](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html).

| Context key | Store | Meaning |
| --- | --- | --- |
| `batt_eff_state_v3` | `file` | Versioned daily interval totals and matching last sample |
| `batt_eff_previous_state_v3` | `file` | Most recent state archived after a configuration change |
| `sum_batt_la_7d` | `file` | Sum of included charging intervals, kWh |
| `sum_batt_ela_7d` | `file` | Sum of included discharging intervals, kWh |
| `la_ela_es` | `file` | Current plausible estimate or null |
| `batt_eff_last_completed_v3` | `memoryOnly` | Watchdog completion timestamp |

The two compatibility energy sums now represent **included interval energy**, not unconditional daily-counter totals. Existing consumers must account for that change. On an input failure, the energy sums retain their last accepted values while the efficiency is invalidated.

Old `batt_eff_ring_7d`, `batt_eff_today_live` and `batt_eff_today_live_snapshot` data are not deleted or automatically migrated: their original measurement boundaries cannot be verified. The new estimator starts fresh. Multiple instances on one flow tab require distinct context keys.

## License and project independence

MIT; see [LICENSE](../LICENSE). This is an independent community project, not affiliated with or endorsed by Zendure. See [NOTICE.md](../NOTICE.md) and [DISCLAIMER.md](../DISCLAIMER.md).
