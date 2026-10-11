# V4.22-SIM: solar midpoint trim and BLE diagnostics

Update: [field log 5 and V4.23](../v4.23-sim/README.md) now validate V4.22 normal-PV charging. V4.23 adds timing tolerance and diagnostic coverage; the original V4.22 source below is preserved.


**English** | [Deutsch](README_DE.md)

Experimental version of the separate PI controller. No field test of this revision and no plant deployment. Battery-efficiency release v5.1.0 remains unchanged.

V4.21 holds charging after two samples anywhere inside the solar window. V4.22 adds corrections of at most 3 W, at least 6 s apart, toward the **currently effective window midpoint** under settled, fresh conditions. With the previous −5…+15 W base settings, targets are +5 W below 720 W PV, −13 W from 720 to below 1050 W, and −17 W at or above 1050 W. Current configured bounds are used. Night behavior, P/I parameters, large ramps, PV guards and discharge permissions are preserved.

[Complete function](Regler_V4_22_SIM.js) · [Pasteable text](Regler_V4_22_SIM.txt) · [Detailed German analysis](Solar_BLE_V4_22_Analyse.md) · [Model](Regler_Modell_V4_BLE.json) · [Results](Regler_V4_22_Ergebnisse.json)

![Solar comparison](Solar_BLE_V4_22_Vergleich.svg)

## Installation

Replace the entire text in the existing controller Function node. Keep its four outputs and flow context. `chargeCenterTrimEnabled=false` disables only the new charging trim. The controller also works before the new transport diagnostics are installed; missing snapshot diagnostics remain explicitly missing without affecting control.

Generic diagnostics are published here. Use the supplied installation-specific instructions and added nodes privately; real plant exports do not belong in this repository. Ordinary JSON import of regular nodes is not promised to update them in place. Replace existing Function texts and deliberately insert diagnostic pass-through nodes.

- `Messwerte_berechnen_BLE.js`: existing snapshot builder with an additional diagnostic copy; **11 outputs**. Actual installation-specific measurement acquisition remains external.
- `Zusatzdaten_BLE.js`: existing extra-data logger with HTTP fields removed, `batteryBle` and a checked snapshot; **one output**.
- `BLE_Audit_inputLimit.js`, `BLE_Audit_outputLimit.js`, `BLE_Audit_acMode.js`: insert after each RBE/direction node, immediately before its existing HA control action. Each has **one pass-through output**; replace the previous direct connection.
- `BLE_Audit_HA_Abschluss.js`: outputs of the three HA control actions. `BLE_Audit_HA_Fehler.js`: a Catch scoped exclusively to those actions. These functions emit no control messages.
- `BLE_Bereitschaft_Diagnose.js`: after both existing ready Change nodes; forward to the existing ESP queries only when ready is true. Add `msg.data=entity` to Current-State outputs.
- `inputLimit_Ruecklesewert.js`, `outputLimit_Ruecklesewert.js`: separate HA Current-State queries of the **existing** input/output number entities, with `msg.payload=entityState` and `msg.data=entity`. Do not guess entity identifiers.

Installation-specific SOC/pack/AC/battery observers are provided privately and their device identities are not published here. Capture unthrottled controller output 4 before the existing JSONL logger. Do not overwrite the snapshot carried by that status later.

## Evidence and limits

Eight synthetic tests plus 1,767 daytime and 1,108 nighttime input samples were checked. Disabling the solar addition preserves the previous control core; enabling it does not alter the night core. 108 conditional simulations compare three daytime logs, six plant models and six parameter variants. The selected version improves target MAE on all 18 log/model combinations; its advantage is small in parts of the fast-PV log. Largest positive peak increases: 4 W on log 2, 0 W on log 3 and 2 W on log 4. Additional trim during small ongoing native command changes was rejected for weaker transfer and up to 21 W added import peak.

BLE component delays were not refitted without new measured transport timestamps. A successful HA action is not a device write ACK. The inspected BLE controller's HA number states are device readbacks; matching value and time order are not message-ID correlation. A universal optimization limit or overshoot-free operation under arbitrary sunlight has not been established.

```sh
node --test regulator/experimental/v4.22-sim/tests/*.test.cjs
```

The eight synthetic tests also run in the existing Node 22/24 and UTC/Berlin CI matrix. Private field logs are not committed.
