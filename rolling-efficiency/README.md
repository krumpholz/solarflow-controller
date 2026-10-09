# Battery efficiency and rolling 7-day mean – release v5.1.0

Release **v5.1.0** uses calculation revision **5.1**, energy-buffer schema **4** and additive mean-history schema **1**. Existing energy and V5 mean buffers continue to be used. Output order is mean / original / diagnostics; only installations without a mean buffer begin a new mean history.

**English** | [Deutsch](README_DE.md)

A rolling 168-hour energy balance using signed battery power from the `1.3-SOLAR-G-ESP-BATT-FALLBACK` snapshot builder. Daily energy counters are no longer inputs. The Function has three outputs: **7-day mean, original efficiency, diagnostics**, in that order. The counter-based version remains available in [release v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency).

## Upgrade an existing installation

1. Export the old flow and back up Node-RED context. Keep the same flow tab, context stores and configured battery capacity. Only one calculation may write the efficiency state.
2. Replace the **entire** calculation body with [battery-efficiency.js](battery-efficiency.js) or its [German equivalent](battery-efficiency_DE.js). Set **three outputs**, `capacityKWh` and `maxPowerKW`; defaults are 8.640 kWh and 2.4 kW. Version 5.1 requires an SOC timestamp by default (`requireSocTimestamp: true`).
3. Replace **Capture SOC and Start Measurement Cycle** with [prepare-cycle.js](prepare-cycle.js), set **two outputs**, and connect its output 1 **directly** to the calculation. Remove both daily-counter queries from this path. Preparation preserves the original `batt_level_ts`; it does not refresh that timestamp.
4. Use the installation's **existing common timer**: write SOC and its timestamp, then invoke preparation approximately **one second later**. The power snapshot must already be complete. A fixed delay does not guarantee successful requests, so snapshot checks remain active. The imported Inject node is a manual test button; it has **no repeat and no startup injection**. Keep the existing periodic trigger running even if new SOC or power measurements fail.
5. Connect calculation output **1 directly to the mean sensor** and any automation, output **2 directly to the existing efficiency sensor**, and output **3** to diagnostics. Both sensors read State = `msg.payload`. No data-preparation Function or API node is needed.
6. Preparation's warning output **2** goes to **diagnostics only**. Optionally also connect it directly to the **existing efficiency sensor** to mark that sensor unknown. Never connect warnings to the mean sensor. The watchdog clears only `la_ela_es`; the calculation alone manages `la_ela_es_mean_7d`.
7. Retain the existing ha-sensor and its Entity config. Add only [sensor-mean.json](sensor-mean.json) to create a separate mean sensor without importing a second calculation/server. For a fresh installation use [flow.json](flow.json). Select the existing HA server in each Entity config and install the required Companion integration. When replacing the previous API flow, remove its API/preparation nodes and retain only one writer for each sensor.

See the [wiring diagram](WIRING.md) and the [direct Home Assistant sensor setup](#direct-home-assistant-sensors). The external Modbus/snapshot builder and SOC writer are installation-specific and are not included in the import. Place the imported nodes on their flow tab. Activate only one language.

If there is no existing periodic calculation trigger, configure one approximately every two seconds after updating SOC. A trigger exclusively from the snapshot builder's output 11 processes successful snapshots promptly, but needs continuing timer invocations to evaluate retained mean history when snapshots stop. Use one main trigger path; do not add a second timer to an already paced installation. Replayed snapshot IDs do not integrate twice, but overwritten intermediate power samples cannot be reconstructed.

**Upgrade from v5.0.0:** retain both energy and mean histories; neither schema changes. Replace calculation, SOC preparation and sensor nodes together. From V4 or V3, existing compatible energy history is retained but mean history starts with new valid percentage intervals; earlier aggregate energy records cannot reconstruct past mean samples.

## External input contract

The supplied snapshot builder writes the following keys synchronously to the **default flow context store**. The calculation reads them together in a synchronous Function invocation.

| Key | Meaning |
| --- | --- |
| `p_batterie` | Measured battery power in W; positive charging, negative discharging; never a regulator setpoint |
| `snapshot_last_ok_cycleId` | Unique successful cycle identifier |
| `snapshot_last_ok_ts` | Snapshot completion time, Unix milliseconds |
| `snapshot_last_ok_triggerTs` | Start time of that measurement cycle |
| `snapshot_last_ok_quality` | `excellent`, `good` or `borderline` |
| `snapshot_last_battery_source` | Must be `fresh` |
| `snapshot_last_battery_fresh` | Must be `true` |

The explicit **`memoryOnly`** store supplies:

| Key | Meaning |
| --- | --- |
| `batt_level` | Battery SOC, 0–100 percent |
| `batt_level_ts` | SOC observation time, Unix milliseconds; required by default and at most 120 seconds old at capture |

SOC capture forwards these values through `msg._eff`. The original observation timestamp is retained. A one-second-old SOC timestamp is valid. With `requireSocTimestamp: true`, missing, future or expired timestamps pause collection; retained mean history can still be available. Set the option to false only for an explicit legacy setup without timestamps; unverified SOC freshness remains disclosed. Without that object, the calculation reads the SOC keys directly. The BLE sensor `sensor.bluetooth_solarflow_solarflow_batterie_soc` can continue to feed **SOC -> EMS**. A timestamp generated on every HA poll proves only polling recency, not a new measurement at the BLE device. `soc_freshness_verified` checks only the age of the supplied timestamp.

The separate `p_batt_in` and `p_batt_out` keys are unnecessary: both directions are derived from signed `p_batterie`. Use identical measurement boundaries in both directions. Do not mix AC measurements, DC telemetry and power setpoints.

## Context and restart behavior

Configure synchronous context stores, for example in Node-RED `settings.js`:

```js
contextStorage: {
    default: "memoryOnly",
    memoryOnly: { module: "memory" },
    file: {
        module: "localfilesystem",
        config: { cache: true, flushInterval: 30 }
    }
}
```

The complete V4 state is stored in `flow.batt_eff_state_v4`, store `file`: energy minute aggregates, power/SOC baseline, migration marker, exclusion counters and the additive `mean` object (schema 1, percentage-time integrals, coverage and last valid mean sample). Filesystem writes are delayed; a sudden power loss can lose unflushed seconds. A restart reads the persisted buffer, does not import V3 again and ignores replayed snapshot cycles. A gap longer than ten seconds is excluded from both sides of the balance. Only one active calculation Function may write this state.

Compatibility output keys in `file` remain `sum_batt_la_7d`, `sum_batt_ela_7d` (kWh) and `la_ela_es` (original percent or `null`). New `la_ela_es_mean_7d` contains the mean percent or `null`. Measurement failures clear the original key, while valid retained mean history remains published in the mean key. The watchdog never writes the mean key. Only absent, expired or untrusted mean history produces a null mean. The original key keeps its original meaning.

## Calculation and accuracy

For each accepted interval, linearly interpolate signed power between its endpoints using the actual time difference. With no direction change, this is trapezoidal integration:

`E_kWh = (P_previous + P_current) / 2 × dt_ms / 3,600,000,000`

At a direction change, split at the interpolated zero crossing and accumulate charging and discharging separately. At 2,400 W for two seconds the result is 0.001333333 kWh, or 1.333333 Wh. No integration method can exactly reconstruct unobserved changes between samples.

Accumulate stored-energy changes over the same accepted intervals:

`delta_stored_kWh = capacity_kWh × (SOC_current − SOC_previous) / 100`

Window totals determine the displayed value:

`efficiency_percent = 100 × (discharge_kWh + delta_stored_kWh) / charge_kWh`

`losses_kWh = charge_kWh − discharge_kWh − delta_stored_kWh`

Power timing uses **snapshot completion**, because the current flow context does not separately expose the battery receive timestamp. SOC uses the latest available value at capture. Diagnostics disclose `power_time_basis` and `soc_time_basis`. Source latency, SOC quantization, nominal capacity, BMS corrections and asynchronous measurements limit accuracy. This is an SOC-adjusted energy balance, not a certified full-cycle AC-to-AC round-trip efficiency measurement.

### Rolling window and storage size

The window ends at the latest processed snapshot and starts exactly 168 hours earlier, independently of midnight or DST. Split new intervals at minute boundaries, then sum within each minute without rounding. The buffer holds approximately 10,081 minute aggregates, bounding memory and filesystem write volume.

**The oldest partial minute is weighted uniformly by temporal overlap.** Its original second-by-second energy/SOC distribution is no longer available after aggregation. This deliberate approximation affects at most one minute and is disclosed by `boundary_weighting`. Charge, discharge, stored-energy change and coverage use the same weight. A whole day no longer drops out at midnight. SOC steps, load changes and the window boundary can still change the result; the original percentage on output 2 is not smoothed. Output 1 applies the separate mean described below.

### Plausibility and missing data

- The 2,400 W limit plus 20% reserve permits at most 2,880 W in either direction. Values above the limit are rejected, not clamped.
- Reject snapshots older than 6.5 seconds, invalid inputs and ESP fallback values. Reused ESP telemetry or a different measurement boundary must not be treated as a fresh Modbus measurement.
- Accept at most ten seconds between valid points. Shorter gaps are interpolated. Longer gaps and explicitly invalid intervening observations start a new baseline, excluding matching energy and SOC changes together.
- Reject an SOC change exceeding two percentage points plus the physically permitted change with 20% reserve. Three consecutive similar observations confirm a new SOC baseline. Gradual BMS corrections below this threshold cannot all be detected.
- Negative original efficiency or values above 100% produce `null` on output 2, never a clamped 0/100; retained mean availability is evaluated separately. Only arithmetic overshoot within **1e-9 percentage points** of an exact 0/100 boundary is resolved to that boundary to avoid false rejections from floating-point subtraction. The tolerance is disclosed by `efficiency_arithmetic_tolerance_pct`. The configured 8.640 kWh is installation-specific, not a universal SolarFlow capacity.

## Rolling 7-day percentage mean

Output 2 keeps the existing formula and validation. Output 1 averages its **unrounded valid percentages** over a separate rolling 168-hour window. This is time weighting, not weighting by the number of messages or by charging energy. A longer lasting valid value contributes proportionally more time.

For a consecutive accepted interval with valid endpoint percentages:

`weighted_percent_ms = (eta_previous + eta_current) / 2 × dt_ms`

`mean_percent = sum(weighted_percent_ms in window) / sum(valid covered_ms in window)`

The linear trace is split at minute boundaries before aggregation. At the oldest partial minute, its integral and covered time are weighted by the same overlap fraction. As with the energy buffer, the intra-minute distribution at that one boundary is approximate. Stored percentages and integrals are unrounded; only the published payload is rounded to one decimal place.

Example: 80 → 84% over 2 seconds contributes 82 × 2; 84 → 76% over 8 seconds contributes 80 × 8. The time-weighted result is **80.4%**. A simple sample-count average would give 80% and change when the polling rate changes.

### Availability, gaps and restart

- A first valid original percentage establishes the mean baseline. The next consecutive accepted interval with valid endpoints makes the mean available. No initial or historical percentage samples are fabricated.
- **Availability depends on valid retained mean intervals, independently of current SOC/source validity.** Brief SOC failures, stale power, fallback values, SOC jump checks, out-of-range original efficiency or insufficient charge throughput pause new collection but keep output 1 available when history remains. Output 2 can be null at the same time. Output 1 then reports `valid: true`, `source_valid: false`, `reason: mean_available` and the actual `source_reason`.
- Invalid or excluded intervals add no duration. Clear the interpolation baseline; the first subsequent valid original percentage sets a new baseline. Neither a held percentage nor 0% is inserted across the gap. Recovery does not bridge it.
- The mean window ends at the **current evaluation clock**, even during source failures. Continuing timer calls prune old data and update coverage/sample age. Its value can change as older intervals expire. If no valid mean intervals remain in the latest 168 hours, output 1 becomes null; corrupt state, configuration or runtime/context failures also cannot claim trusted mean availability.
- The SOC watchdog clears only the original output key. Its warning is a source diagnostic, not a statement that mean history is invalid. No warning wire enters the mean sensor path. Sensor errors go to diagnostics and do not reset calculation history.
- A restart retains mean history, including during a source outage. A short accepted interval can continue the persisted baseline; a gap over ten seconds cannot. Duplicate valid snapshots append no records and extend no coverage.
- Existing V5 mean history is reused. When upgrading V3/V4 energy-only state, the mean begins with new observations; existing energy aggregates cannot reconstruct earlier percentages.
- Startup can publish a partial window. A complete window requires 168 hours of valid covered intervals, with one millisecond of arithmetic tolerance; gaps remain visible until they leave the window. Elapsed `mean_history_hours` does not prove coverage.
- Both histories hold approximately 10,081 minute aggregates each. The oldest partial minute remains the disclosed uniform-overlap approximation.

### Outputs and diagnostics

All outputs use `msg.payload` for the published percentage or `null`, and `msg.result` for diagnostics. On output 1, `result.valid` and `result.reason` refer to the mean; `source_valid` and `source_reason` describe the original balance. Outputs 2 and 3 retain the original balance's `valid`/`reason` and include the mean fields as well. Returned metadata objects are independent copies.

| Output | Payload | Connection |
| --- | --- | --- |
| 1 | Rolling 7-day mean, percent | New HA mean sensor / automation |
| 2 | Existing SOC-adjusted 168-hour balance, percent | Existing HA efficiency sensor |
| 3 | Same payload as output 2, with combined diagnostics | Debug / diagnostic consumer |

| Mean diagnostic | Meaning |
| --- | --- |
| `eta_mean_7d_pct` | Published mean, one decimal place, or `null` |
| `eta_mean_7d_raw_pct` | Historical mean rounded to three decimals for diagnostics, even if current source is invalid |
| `mean_valid`, `mean_reason` | Whether a mean is currently usable and why |
| `mean_window_start`, `mean_window_end` | Exact UTC window boundaries, 168 hours apart |
| `mean_window_complete` | Full covered mean window; separate from original `window_complete` |
| `mean_covered_hours`, `mean_coverage_pct` | Valid mean intervals currently represented, excluding gaps |
| `mean_started_at`, `mean_history_hours` | History start and elapsed time; not proof of coverage |
| `mean_collection_paused` | Current original source is invalid; retained mean can still be valid |
| `mean_last_sample_at`, `mean_sample_age_seconds` | Last retained mean interval endpoint and its age |
| `mean_method`, `mean_source` | Linear, time-weighted average of the existing rolling balance |
| `mean_buffer_buckets`, `mean_partial_boundary_bucket`, `mean_boundary_weighting` | Storage and disclosed oldest-minute approximation |

For an automation that should wait for a fully covered week, a Function after **output 1** can filter with:

```js
if (msg.result?.mean_valid !== true || msg.result?.mean_window_complete !== true) return null;
if (typeof msg.payload !== "number" || !Number.isFinite(msg.payload) || msg.payload <= 0) return null;
msg.batteryEfficiencyFactor = msg.payload / 100; // e.g. 80% -> 0.80
return msg;
```

This prepares a factor for a downstream discharge-threshold calculation; it does not change any device setting. For partial-window use, choose an explicit required coverage rather than treating elapsed startup time as measured coverage.

The new mean smooths SOC quantization and short-term load-related fluctuations; it does not correct systematic SOC bias, uncertain capacity or the energy balance's physical limitations. It averages a value that already spans 168 hours, so lasting changes become visible more slowly. It is not a new cycle-based round-trip measurement. Automated validation and its limits are documented in [TESTING.md](TESTING.md).

## V3 buffer migration

At the first valid measurement, optionally read `batt_eff_state_v3` from `file`. Capacity, previous entity IDs and Node-RED timezone must match the V3 fingerprint. The `chargeEntityV3` / `dischargeEntityV3` settings are fingerprint checks for migration only, not daily-counter requests. A mismatch produces diagnostics instead of silently importing incompatible data. `CFG.importV3 = false` deliberately starts without migration and still leaves V3 untouched.

Import the available daily charge/discharge totals and stored-energy deltas. For legacy-tagged records already present in V3, also retain V3's correction between legacy SOC boundaries, assigning each correction to the later legacy day. Missing required SOC boundaries invalidate the original balance on output 2 while affected records remain in the window.

V3 has no intra-day time series. The transition therefore distributes each imported total uniformly over its local calendar day; the final day ends at the last saved V3 measurement. This does not repair historical inaccuracies. Old totals expire proportionally, which can differ from the old calendar-day display, especially when the imported buffer was already stale. All imported data expires no later than 168 hours after the last V3 measurement.

V4 begins power integration at a new baseline. Do not retrospectively fill the time between the last V3 point and the first V4 snapshot using an assumed power value. There is no overlapping or double-counted integration. `legacy_migration`, `imported_*` and `legacy_days_in_window` disclose migration. `covered_hours` includes only newly accepted power intervals because historical time coverage is unknown.

**The original V3 buffer remains unchanged.** On rollback, it is therefore current only up to the migration time; V4 does not maintain V3 daily records. Existing V4 state always takes precedence. Do not delete V4 casually to force another import.

## Direct Home Assistant sensors

The current flow uses **ha-sensor** and **ha-entity-config**, verified against `node-red-contrib-home-assistant-websocket` **0.80.3**, with a working HA server connection. These nodes require the [hass-node-red Companion integration](https://github.com/zachowj/hass-node-red), **1.1.0 or newer**, installed in Home Assistant. This matches the supplied existing sensor; removing preparation does not remove that dependency. Daily energy sensors are not queried or created.

For an existing calculation, import only [sensor-mean.json](sensor-mean.json), select the existing server in its Entity config, and wire **calculation output 1 directly to the new sensor**. This import contains only the mean sensor and its own Entity config; it references server `4c54b454.60653c` and the same flow tab. Re-select the server if yours has another ID. Keep the old sensor on output 2 with its original Entity config. The full flow preserves original node/config IDs `619074ace164b99e` / `bb523511b4c4476f`; the mean uses new IDs `0f55fb7a4d14af9f` / `71e17f5b60730d3d`. Node-RED IDs are not HA entity IDs; keep an existing Entity config to retain its integration identity.

| Setting | Both sensors |
| --- | --- |
| State | `msg.payload` (`stateType: msg`) |
| Attributes / output properties | Empty arrays |
| Input Override | `allow` |
| Entity type / unit | Sensor / `%` |
| Device class / state class | Empty, matching the supplied sensor |
| Resend / debug | Disabled, matching the supplied sensor |
| Entity config | Separate for each sensor; existing HA server |

Names distinguish the original and mean sensors. The Companion integration creates the new HA entity; use its actual entity ID from Home Assistant in dashboards/automations rather than assuming a fixed ID from its name. Do not reuse the old sensor's Entity config for the mean: both would write the same HA entity.

Numeric **0** remains a real 0% value; calculation **null** is sent directly and the sensor reports **unknown**. Valid retained means continue during brief SOC failures even with `result.source_valid: false`. No diagnostic attributes are configured; diagnostics remain in `msg.result` and on calculation output 3. An optional mean coverage attribute must read `msg.result.mean_covered_hours`, not the original `covered_hours`; SOC freshness describes the current source rather than mean availability.

Missing-measurement warnings go only to diagnostics by default. Their optional direct connection to the old sensor marks only that sensor unknown; never connect them to the mean sensor. Catch monitors the two sensors. With `resend: false`, recovery after HA restart depends on the next calculation update; continue the existing timer.

This sensor-only adjustment retains release **5.1.0**, calculation **5.1** and both state schemas. The published `v5.1.0` tag/downloads retain the original API-based release snapshot. Use current files on `main` for direct sensor wiring; no tag is moved or historical download replaced.

Without legacy records, sufficient valid intervals must first supply at least **0.1 kWh of charge energy** and a plausible original balance. The mean then needs a consecutive valid percentage interval; no seven-day startup wait is imposed. Discharge alone initially lacks the denominator. Partial-window output is possible and coverage remains disclosed.

`window_complete` describes newly accepted original power coverage. `mean_window_complete` describes mean interval coverage. `excluded_*` counts exclusions since the V4 start, rather than just inside the current window.

## References

- [Home Assistant Sensor node](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html)
- [Companion integration](https://github.com/zachowj/hass-node-red)
- [Node-RED filesystem context](https://nodered.org/docs/api/context/store/localfilesystem)

[MIT license](../LICENSE) · [Trademark notice](../NOTICE.md) · [Scope and warranty](../DISCLAIMER.md)

## Exclusion diagnostics

Replace calculation and SOC-preparation Functions and use the existing periodic timer one second after the SOC writer, as described above. Keep capacity and context. The snapshot builder continues to supply its flow context; no additional output-11 trigger is needed with this timer path. Its completion and freshness checks remain active.

`recent_exclusions` contains up to ten contiguous exclusion episodes, newest first, including an open episode. It is persisted inside `batt_eff_state_v4` in `file` and included in successful and failed calculation outputs. Duplicate valid snapshots still emit no message. Without an initial measurement baseline there is no interval to exclude; startup errors remain in the ordinary `reason` field.

| Field | Meaning |
| --- | --- |
| `id`, `started_at`, `last_seen_at`, `ended_at` | Episode identifier and UTC times; `end_ts`/`ended_at` is the last accounted excluded endpoint |
| `open` | Unresolved episode; final gap duration may only be known on recovery |
| `excluded_intervals`, `excluded_ms` | Accounted exclusions within this episode, never an extrapolated outage duration |
| `causes` | Technical cause codes with observation counts and first/latest values and limits |
| `ursachen` | German cause descriptions in the German version |
| `resolution`, `abschluss` | Closing status; German text is added by the German version |

Repeated failures until recovery form one episode. Different causes within the same gap retain their first/latest details. Recovery does not replace the original fallback cause with a generic gap code. Three SOC jump confirmations remain one episode containing three excluded intervals. Episode counts therefore differ from interval counts.

`exclusion_counts_by_reason` counts episodes per cause since logging began: each cause contributes once per episode. An episode with multiple causes contributes to each cause's counter. Counters survive eviction of older ring entries. Observation counts within an episode instead count actual failure invocations, including repeated polls of the same invalid snapshot.

The exclusion logger adds diagnostic fields to existing V4 state while retaining energy history, migration markers and exclusion totals. This release also adds the separate mean history. `exclusion_log_since` records logging start; `exclusions_before_logging` records prior totals whose causes cannot be reconstructed. Filesystem durability is the same as for the energy buffer. Missing or damaged context stores can also prevent persistent error logging.
