# Seven-Day SOC-Adjusted Battery Efficiency Estimate

**English** | [Deutsch](README_DE.md)

A Node-RED monitoring flow that estimates battery energy efficiency from daily charging/discharging counters and state of charge (SOC). It does not send battery control commands.

**Status:** reviewed implementation with automated simulated-context tests. Not yet validated in a live Home Assistant/Node-RED installation. This is an estimate, not a certified round-trip efficiency measurement.

## Choose the flow language

Use [flow.json](flow.json) for English or [flow_DE.json](flow_DE.json) for German node names, status/error messages and code explanations. The German alternative restores the original node/sensor labels, including `Batterie Wirkungsgrad` and `Lade Entlade Effizenz`. **Run only one version**: both share the same graph references and context keys. Verify the existing HA entity mapping after import.

Calculation and migration behavior are identical. Technical diagnostic keys and codes stay compatible; German messages add `grund`, `intervallstatus` and `pufferuebernahme`, plus the HA attribute `diagnose`. Generate the alternative with `python round-trip-efficiency/build-german-flow.py`. Its executable core is taken unchanged from the English sources.

## Files

| File | Purpose |
| --- | --- |
| [flow_DE.json](flow_DE.json) | Complete German flow alternative |
| [battery-efficiency_DE.js](battery-efficiency_DE.js) | German calculation Function |
| [prepare-cycle_DE.js](prepare-cycle_DE.js) | German preparation Function |
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
- Existing version-2 kWh history is imported once, including the live day or snapshot. The first paired measurement establishes the baseline for NEW intervals; existing history is retained separately in the same ledger.
- Energy differences and SOC differences use the same accepted interval endpoints. The delayed ten-minute median has been removed.
- Totals and their matching baseline are kept together in one automatically persisted state object.
- A gap or reset starts a new segment. Its unmeasured energy and SOC change are both excluded.
- Out-of-range estimates are reported as diagnostics; the HA sensor becomes Unknown instead of showing a clipped 0% or 100%.
- The default flow uses English comments, names and status messages; the German alternative provides a German interface and code explanations; documentation is available in English and German. Existing German entity IDs and compatibility context keys remain unchanged so their references still work.

## Installation and upgrade

1. Back up your existing flow and persistent context. Disable the old efficiency calculation before enabling this replacement. Keep the original flow tab and its context: migration reads the history from that tab.
2. Check the context stores below. If they already exist, do not restart before migration: the latest legacy live day is in memoryOnly. If a restart is necessary, first save the live day with the old snapshot switch and let the file store flush; otherwise only an existing snapshot and completed ring days can be recovered.
3. Import `flow.json` (English) or `flow_DE.json` (German) **onto the existing flow tab that supplies `flow.batt_level`**. A new tab has a different flow context. Select your existing Home Assistant server in both Current State nodes and the entity configuration; avoid leaving duplicate old and new estimators connected to the same sensor.
4. Review `CFG.capacityKWh`: the supplied **8.640 kWh** is the original installation's value, not a universal default. Review `maxPowerKW` and counter resolution as well.
5. Check both energy entity IDs in the Current State nodes and in `CFG`. They must be daily cumulative energy counters in **kWh**, resetting at local midnight. The calculation also checks the entity's `unit_of_measurement` attribute. Current State nodes use string state type so invalid source states remain distinguishable.
6. Ensure the external SOC writer supplies a finite percentage from 0 to 100 to `batt_level` in `memoryOnly`. Do not divide this percentage by ten unless the upstream value is actually in tenths of a percent.
7. Prefer adding `batt_level_ts` as described below and enabling `requireSocTimestamp`. It is optional by default to accommodate the supplied flow's existing interface.
8. Set the Node-RED runtime timezone to the same timezone used for the daily sensor resets, for example `Europe/Berlin` when appropriate. Restart after changing the runtime timezone.
9. Deploy and check the diagnostic output. The included Inject node runs every five seconds. On a fresh installation, the first complete measurement produces Unknown. With valid imported history, it can display the inherited estimate immediately. New interval accumulation starts with the next accepted interval.
10. Verify the HA sensor name/entity and any dashboards that used the previous sensor. The exported friendly name is `Battery Efficiency Estimate` in English and the original `Lade Entlade Effizenz` in German; preserve your existing entity mapping if required.

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

For each accepted NEW interval:

```text
charge energy       = current daily charge counter - previous counter
discharge energy    = current daily discharge counter - previous counter
stored energy delta = capacity_kWh * (current SOC - previous SOC) / 100
```

Within today and the previous six **local calendar days**, the flow sums accepted new intervals plus explicitly marked imported legacy records:

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
| No v3 history | Import the existing v2 kWh ring and live day/snapshot once, if present; then establish the baseline for new intervals. Without legacy data, start from current counters and SOC. |
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
| `batt_eff_legacy_backup_v3` | `file` | Original ring, live day and snapshot retained before migration, including older dates |
| `batt_eff_previous_state_v3` | `file` | Most recent state archived after a configuration change |
| `sum_batt_la_7d` | `file` | Imported charging history plus included new intervals, kWh |
| `sum_batt_ela_7d` | `file` | Imported discharging history plus included new intervals, kWh |
| `la_ela_es` | `file` | Current plausible estimate or null |
| `batt_eff_last_completed_v3` | `memoryOnly` | Watchdog completion timestamp |

The two compatibility energy sums represent **imported history plus included new interval energy**, not unconditional current daily-counter totals. Existing consumers must account for that change. On an input failure, the energy sums retain their last accepted values while the efficiency is invalidated.

### Automatic migration of the existing buffer

On the first valid paired cycle, the function reads the original `batt_eff_ring_7d` from `file`, `batt_eff_today_live` from `memoryOnly`, and `batt_eff_today_live_snapshot` from `file`. It stores a separate backup in `batt_eff_legacy_backup_v3` before converting anything. **The original keys are never changed or deleted.** All original slots remain in that backup; the active calculation includes today and the preceding six calendar days, exactly the original date window.

For a duplicated date, live memory takes precedence. A completed ring record takes precedence over an older snapshot. Migration copies recorded charge/discharge totals, and calculates each legacy record's SOC correction from its stored start/end SOC using the configured capacity. It cannot retrospectively repair quantization, previously filtered SOC, or null values that the old code already turned into numeric zero. Use the same capacity as the old installation.

A stored legacy day has no reliable measurement timestamps. Its duration is not counted in `covered_hours`. The handover gap between its stored counters and the first new paired baseline is not silently estimated. Thus a stale snapshot preserves the recorded history but cannot recover the unrecorded tail. If today's memory record and snapshot are both absent, completed ring days are still imported, but today's earlier SOC baseline cannot be recreated.

Calculation revision 3.1 uses the original first-start/last-end SOC principle for the imported history window. It adds a reporting adjustment to the stored daily deltas, without rewriting the ledger. New measured intervals retain their aligned energy/SOC accounting. The adjustment is recomputed as old days expire and never compounded into persistent state.

`legacy_adjustment_kwh` reports the adjustment and `legacy_boundary_gaps` lists historical SOC discontinuities. With legacy data, the reason is `legacy_estimate_available` and the status is yellow. This explicitly marks historical uncertainty, not necessarily a current measurement fault. `valid: true` means a numerically plausible estimate is available; `historical_accuracy_verified` remains false. The result need not exactly match the original display because an unmeasured handover interval is not reconstructed.

For an already-running v3 flow, replace only the full calculation Function body with [battery-efficiency.js](battery-efficiency.js) and deploy. Preserve its two outputs, wiring, context, capacity configuration and preparation node. Do not delete the buffer or force remigration. Upgrading the original old flow still requires the complete installation procedure.

Missing/invalid SOC boundaries retain the day's energy but produce Unknown efficiency (`legacy_soc_boundaries_missing`) while that day remains in the active window. Malformed energy values, unsupported units, or invalid dates stop migration rather than replacing history with zero. Inspect the error and original data before correcting them.

An already-running v3 installation can also import legacy days not yet represented. For today's overlapping date, a frozen legacy prefix is added only if the gap-free v3 ledger proves both energy directions are disjoint. Otherwise, the original record is retained in the backup and the date is reported in `legacy_migration.overlappingDates`; it is not added twice. Such a conflict needs review if its historical contribution must be reconstructed.

Migration is marked in the same persisted state as the imported totals, preventing repeated imports after restart. No reimport occurs after a configuration reset, because changing capacity/timezone/entity mapping may invalidate old assumptions. Normal seven-day expiration continues. Multiple instances on one flow tab require distinct context keys.

## License and project independence

MIT; see [LICENSE](../LICENSE). This is an independent community project, not affiliated with or endorsed by Zendure. See [NOTICE.md](../NOTICE.md) and [DISCLAIMER.md](../DISCLAIMER.md).

