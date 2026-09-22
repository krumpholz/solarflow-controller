# Battery efficiency from power – version 4.1

**English** | [Deutsch](README_DE.md)

A rolling 168-hour energy balance using signed battery power from the `1.3-SOLAR-G-ESP-BATT-FALLBACK` snapshot builder. Daily energy counters are no longer inputs. The Function has two outputs: efficiency and diagnostics. The counter-based version remains available in [round-trip-efficiency](../round-trip-efficiency/README.md).

## Upgrade an existing installation

1. Export the old flow and back up Node-RED context. Stay on the same flow tab so that the existing buffer remains accessible.
2. Replace the **entire** calculation Function body with [battery-efficiency.js](battery-efficiency.js), or [battery-efficiency_DE.js](battery-efficiency_DE.js) for German. Keep two outputs. Set `capacityKWh` and `maxPowerKW` for the installation; defaults are 8.640 kWh and 2.4 kW.
3. Connect output 1 of **Capture SOC and Start Measurement Cycle** directly to the calculation Function. Remove the two daily-counter queries from this calculation path. Do not run the old calculation as a parallel writer to the same context/output sensor.
4. To process every two-second snapshot, connect **output 11 (diagnostics, index 10)** of **Messwerte berechnen V1.3** to the SOC capture input. Disconnect the old five-second timer as the main trigger for this branch. The snapshot builder emits diagnostics after writing the complete successful snapshot. Keep its other existing connections.
5. Keep calculation output 1 connected to the existing HA sensor and output 2 to diagnostics. The existing SOC capture code remains compatible: V4 also updates its original watchdog key. Its old status text still mentions counters; [prepare-cycle.js](prepare-cycle.js) provides appropriate V4 wording.
6. Optionally retain a separate two-second timer into SOC capture as a watchdog. Repeated snapshot IDs do not integrate again. If snapshots stop, polling produces `null` rather than leaving an old percentage displayed indefinitely. The full import includes this timer. Without a continuing trigger, a Function cannot report the failure of its own incoming messages.

**Replacing only the calculation code and bypassing the counters works as a minimal change.** With the original five-second polling trigger, however, only those selected power samples are integrated. Intermediate two-second snapshots have already been overwritten in flow context. The event-driven connection in step 4 processes every successful snapshot.

For a new installation, import [flow.json](flow.json) or [flow_DE.json](flow_DE.json), activate only one language, place it on the snapshot/SOC writer's flow tab and select the existing Home Assistant server. The export does not include the installation-specific Modbus builder, devices or network configuration. An existing measurement setup must supply the contract below.

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
| `batt_level_ts` | Optional SOC observation time, Unix milliseconds; if present, at most 120 seconds old |

SOC capture forwards these values through `msg._eff`. Without that object, the calculation reads the SOC keys directly. The BLE sensor `sensor.bluetooth_solarflow_solarflow_batterie_soc` can continue to feed **SOC -> EMS**. A timestamp generated on every HA poll proves only polling recency, not a new measurement at the BLE device. `soc_freshness_verified` checks only the age of the supplied timestamp.

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

The complete V4 state is stored in `flow.batt_eff_state_v4`, store `file`: minute aggregates, power/SOC baseline, migration marker and exclusion counters. Filesystem writes are delayed; a sudden power loss can lose unflushed seconds. A restart reads the persisted buffer, does not import V3 again and ignores replayed snapshot cycles. A gap longer than ten seconds is excluded from both sides of the balance. Only one active calculation Function may write this state.

Compatibility output keys in `file` remain `sum_batt_la_7d`, `sum_batt_ela_7d` (kWh) and `la_ela_es` (percent or `null`).

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

**The oldest partial minute is weighted uniformly by temporal overlap.** Its original second-by-second energy/SOC distribution is no longer available after aggregation. This deliberate approximation affects at most one minute and is disclosed by `boundary_weighting`. Charge, discharge, stored-energy change and coverage use the same weight. A whole day no longer drops out at midnight. SOC steps, load changes and the window boundary can still change the result; the percentage is not artificially smoothed.

### Plausibility and missing data

- The 2,400 W limit plus 20% reserve permits at most 2,880 W in either direction. Values above the limit are rejected, not clamped.
- Reject snapshots older than 6.5 seconds, invalid inputs and ESP fallback values. Reused ESP telemetry or a different measurement boundary must not be treated as a fresh Modbus measurement.
- Accept at most ten seconds between valid points. Shorter gaps are interpolated. Longer gaps and explicitly invalid intervening observations start a new baseline, excluding matching energy and SOC changes together.
- Reject an SOC change exceeding two percentage points plus the physically permitted change with 20% reserve. Three consecutive similar observations confirm a new SOC baseline. Gradual BMS corrections below this threshold cannot all be detected.
- Negative efficiency or values above 100% produce `null`, never a clamped 0/100. The configured 8.640 kWh is installation-specific, not a universal SolarFlow capacity.

## V3 buffer migration

At the first valid measurement, optionally read `batt_eff_state_v3` from `file`. Capacity, previous entity IDs and Node-RED timezone must match the V3 fingerprint. A mismatch produces diagnostics instead of silently importing incompatible data. `CFG.importV3 = false` deliberately starts without migration and still leaves V3 untouched.

Import the available daily charge/discharge totals and stored-energy deltas. For legacy-tagged records already present in V3, also retain V3's correction between legacy SOC boundaries, assigning each correction to the later legacy day. Missing required SOC boundaries invalidate results while affected records remain in the window.

V3 has no intra-day time series. The transition therefore distributes each imported total uniformly over its local calendar day; the final day ends at the last saved V3 measurement. This does not repair historical inaccuracies. Old totals expire proportionally, which can differ from the old calendar-day display, especially when the imported buffer was already stale. All imported data expires no later than 168 hours after the last V3 measurement.

V4 begins power integration at a new baseline. Do not retrospectively fill the time between the last V3 point and the first V4 snapshot using an assumed power value. There is no overlapping or double-counted integration. `legacy_migration`, `imported_*` and `legacy_days_in_window` disclose migration. `covered_hours` includes only newly accepted power intervals because historical time coverage is unknown.

**The original V3 buffer remains unchanged.** On rollback, it is therefore current only up to the migration time; V4 does not maintain V3 daily records. Existing V4 state always takes precedence. Do not delete V4 casually to force another import.

## New users and Home Assistant

Without V3 records, the first valid sample establishes the baseline. Once accepted intervals contain at least **0.1 kWh of charge energy** and yield a plausible balance, output a number without waiting seven days. Discharging alone initially lacks the necessary denominator. The threshold prevents division by a near-zero throughput; it does not guarantee accuracy over a short observation period.

The old `sensor.batterie_lade_energie_pro_tag` and `sensor.batterie_entlade_energie_pro_tag` inputs are no longer queried or created. The HA output sensor still requires `node-red-contrib-home-assistant-websocket`, the **Node-RED Companion Integration** in Home Assistant and a working server connection. With that setup, the imported `ha-sensor` and entity configuration create the output sensor; existing names can affect its final entity ID. Replacing just the calculation Function preserves the existing output sensor.

`window_complete` requires a full 168-hour window covered by newly accepted intervals; valid output can occur much earlier. `excluded_*` counts exclusions since the V4 start, not just within the current window. Partial-minute coverage at the window edge has the same documented approximation.

## References

- [Node-RED filesystem context](https://nodered.org/docs/api/context/store/localfilesystem)
- [Home Assistant sensor node](https://zachowj.github.io/node-red-contrib-home-assistant-websocket/node/sensor.html)
- [Node-RED Companion Integration](https://github.com/zachowj/hass-node-red)

[MIT license](../LICENSE) · [Trademark notice](../NOTICE.md) · [Scope and warranty](../DISCLAIMER.md)

## Exclusion diagnostics from version 4.1

Upgrade by replacing the complete calculation Function body. Keep wiring, capacity and existing context. As an alternative to the snapshot diagnostic output, the regulator's existing two-second trigger after its one-second delay can trigger SOC capture. A fixed delay cannot guarantee completed requests; snapshot validation therefore remains active.

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

The update adds diagnostic fields to existing V4 state while retaining energy history, migration markers and exclusion totals. `exclusion_log_since` records logging start; `exclusions_before_logging` records prior totals whose causes cannot be reconstructed. Filesystem durability is the same as for the energy buffer. Missing or damaged context stores can also prevent persistent error logging.
