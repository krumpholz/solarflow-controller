# V4.23-SIM: field log 5, timing tolerance and BLE diagnostic coverage

**English** | [Deutsch](README_DE.md)

V4.22 approaches the effective midpoint during settled solar charging. The new field log has 583 charging records, PV 248–624 W and a −5…+15 W window (target +5 W): time-weighted target MAE 10.61 W overall and 2.04 W in a quiet section entirely inside the window. BLE audit/readback records are still missing. This log does not newly validate large house-load jumps, high PV or discharging.

V4.23 retains P/I, ramps and protection. Solar fine control adds 2 ms tolerance around the nominal six-second deadline. BLE schema 1.1 exposes missing observers and the controller-frozen snapshot status. **This maintenance candidate has not yet been field-tested.**

- [Complete four-output Function text](Regler_V4_23_SIM.txt), [JS source](Regler_V4_23_SIM.js)
- [Detailed German field analysis](Log5_V4_23_Analyse.md), [aggregate results](Log5_V4_23_Ergebnisse.json)
- [V5 model with eight plant cases](Regler_Modell_V5.json)
- [BLE diagnostic logger](Zusatzdaten_BLE.txt), [snapshot builder](Messwerte_berechnen_BLE.js)

The diagnostic logger must feed the actual unthrottled status/log writer. The snapshot builder and all eight observers must contribute in the same flow context. A later legacy logger must not reattach HTTP fields or snapshots. Before recording, verify `batteryBle.schema=1.1`, `diagnosticCoverage.allObserversPresent=true` and `snapshotAttachment.matched=true`. Unchanged HOLD does not need new HA calls; HA completion is not a BLE write ACK. Installation-specific observers and node exports stay in the personal installation package.

## Local conditional replay

Requires Node.js and Python with NumPy. No raw field logs are published. Supply a local complete regulator-status JSONL log:

```sh
python3 simulation/run_simulation.py --log /absolute/path/regulator.jsonl --output /absolute/path/new_simulation.json
node --test tests/*.test.cjs
```

The external net disturbance is reconstructed from the log and fixed across candidates. This is conditional replay, not independent forecasting. The battery model represents reported telemetry, not AC/DC efficiency. The new quiet model improves log 5 and log 3 but worsens log 4; the previous nominal model is retained. The plant is calibrated for charging and warns about discharge requests. Neither the simulator nor the offline patcher sends commands to the installation.
