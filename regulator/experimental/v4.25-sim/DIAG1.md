# V4.25-SIM-DIAG1: diagnostics for every received controller trigger

2026-10-13. Diagnostics-only extension of V4.25-SIM. `version` remains `4.25-SIM`; the added `diagnosticVersion` is `4.25-SIM-DIAG1`. The original source remains available for existing simulations and comparisons.

## Install

Replace the complete body of the existing controller Function with [Regler_V4_25_SIM_DIAG1.txt](Regler_V4_25_SIM_DIAG1.txt), or import the [single four-output Function](NodeRED_Regler_V4_25_SIM_DIAG1_Import.json) and replace the existing controller. Preserve output order: **1 direction, 2 charge watts, 3 discharge watts, 4 diagnostics**. Output 4 continues through the existing supplementary-data Function and Logger V2. Keep the 2-second trigger, its delay and the existing BLE diagnostic nodes. No other Function needs replacement. Run one controller only. Roll back using the original [V4.25 source](Regler_V4_25_SIM.txt).

## Existing rejection conditions

The installation's V1.3 snapshot builder waits for fresh grid/PV inputs and an available battery value through its existing fresh/fallback handling. It rejects fresh required inputs when receive-time spread exceeds **120 ms** or maximum trigger-to-reception latency exceeds **450 ms**. These quality limits concern grid and both PV measurements, not every BLE status field. `incompleteCount` also counts temporarily incomplete collections and is not a final lost-cycle count.

Normal control requires the expected cycle ID to match the last accepted snapshot and a snapshot age in **0–1,800 ms**. Missing IDs/timestamps, mismatched cycles, future timestamps and excessive age suppress control. Regulation-off and forced-grid-charge modes retain their existing exemptions. All checks and thresholds remain unchanged.

Log14's successful records have controller snapshot ages of **589–891 ms**, reception latencies of **210–382 ms** and spreads of **0–82 ms**. The 1,800-ms age limit has margin for those observations. The builder's 450/120-ms limits are relatively tight, but successful-only records cannot establish whether relaxing them would help. The cumulative accepted/rejected counts imply approximately 0.85% rejected snapshots, excluding final incomplete cycles. Across the observed 4.061-second gap, accepted count increases by two with no additional rejection. Its exact cause remains unproven. DIAG1 captures the missing decision evidence before considering threshold changes.

## Output and data contract

A snapshot skip now returns `[null, null, null, {payload: diagnostic}]`. In particular, it sends no zero-watt command. Integrators, ramps, SOC confirmation, direction counters and measurement history retain their previous skip behaviour. Only the dedicated `regler_diag_v425_d1` flow key records execution statistics.

Synchronous runtime exceptions also generate diagnostics and are reported using `node.error(error, msg)` to preserve Node-RED error/Catch handling. No control message is returned. Previously written controller context is not rolled back, matching the original exception behaviour; the diagnostic marks that memory as potentially partially updated.

| Field | Meaning |
|---|---|
| `execution.outcome` | `executed`, `skipped_snapshot`, `runtime_error` |
| `execution.controlExecuted` | Whether the control core completed normally |
| `execution.outputEmitted` | Four booleans, in output order |
| `execution.reasons` | Explicit cycle/age/missing-data/error reasons |
| `execution.enteredTs`, `finishedTs`, `intervalMs` | Invocation/completion timestamps and received-invocation interval |
| `execution.cycleIdFromMsg`, `cycleIdFromFlow`, `cycleIdSource` | Both cycle sources and the selected source |
| `execution.triggerTsFromMsg`, `triggerTsFromFlow` | Separate trigger timestamps |
| `execution.invocationSequence`, `counters` | Invocations, completed control, snapshot skips and exceptions |
| `snapshotCycle` | Actual evaluated snapshot guard decision |
| `measurementAtDecision` | On failure: old accepted snapshot, stored values, builder counts, matching rejection and pending cycle inputs |
| `retainedControlState` | On failure: observed context setpoints, never a new command or device acknowledgement |

Failure modes are `SKIP_SNAPSHOT` and `ERROR`, with `diagnosticOnly: true`. Their `inputs` and `outputs` are null-valued because no valid measurement was consumed and no new setpoint was emitted. Old/rejected/incomplete data is explicitly labelled in `measurementAtDecision` and never attached as a current successful snapshot.

Exclude records with `execution.controlExecuted === false` from control-quality/energy/model input calculations. Existing logger/supplementary-node compatibility summaries (`event_logger.z/pv/batt`, `flowValues`, BLE requested-limit comparisons) are not fresh measurements or new commands on those records. Use `execution`, `inputs`, `snapshotCycle` and labelled observations. Logger V2 continues to report charge/discharge inhibits separately from the snapshot guard.

## Timing and logging

One diagnostic is returned for every received invocation, including consecutive failures. The existing two-second trigger therefore produces two-second diagnostics subject to ordinary scheduling jitter. There is no independent timer. Missing triggers, a stopped runtime or externally aborted JavaScript cannot produce their own Function output; a later `intervalMs` exposes the gap.

Logger V2's **continuous/dauer** mode writes each diagnostic during an active recording. Event mode retains its existing filtering/buffering rules. Filename sequencing, recording duration and wiring are unchanged.

## Validation

Ten automated test groups cover normal conditions, snapshot boundaries, missing/mismatched IDs, exemptions, message-vs-flow cycle precedence, repeated skips/recovery, frozen observations, synchronous errors, diagnostic-context failure and import consistency. **1,395 records from logs11–14** produce identical complete control messages and original control context with V4.25 and DIAG1; existing normal status fields also agree. The user's supplementary-data Function plus Logger V2 produces four consecutive JSONL records for normal/skip/skip/normal, with empty control outputs during both skips.

See [results](validation/DIAG1_Validation.json). After checkout, run:

```sh
node --test regulator/experimental/v4.25-sim/tests/diagnostics-d1.test.cjs
```

These are offline differential and integration checks. A new live recording remains pending. This release does not claim new physical plant validation or change model V13, regulator tuning or efficiency component v5.1.0.
