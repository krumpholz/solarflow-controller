# V4.23-SIM: Feldlog 5, Zeittoleranz und BLE-Diagnoseabdeckung

[English](README.md) | **Deutsch**

V4.22 trifft bei ruhiger Solarleistung die effektive Fenstermitte. Der neue Feldlog enthält 583 Ladezyklen mit PV 248…624 W und Fenster −5…+15 W (Mitte +5 W): gesamte mittlere absolute Zielabweichung 10,61 W, im ruhigen Abschnitt 2,04 W bei vollständig eingehaltenem Fenster. Es fehlen noch die BLE-Audit-/Rücklesedaten. Große Hauslastsprünge und High-PV-Entladung werden hier nicht neu validiert.

V4.23 behält P/I, Rampen und Schutzlogik. Die Solar-Feinführung erhält 2 ms Toleranz am nominalen 6-s-Zeitpunkt. BLE-Schema 1.1 zeigt fehlende Beobachter und den Status des im Regler eingefrorenen Snapshots an. **Diese Wartungsfassung ist noch nicht an der Anlage getestet.**

- [Vollständiger Function-Code, 4 Ausgänge](Regler_V4_23_SIM.txt), [JS](Regler_V4_23_SIM.js)
- [Ausführliche Feldanalyse](Log5_V4_23_Analyse.md), [aggregierte Ergebnisse](Log5_V4_23_Ergebnisse.json)
- [Modell V5 mit acht Anlagenvarianten](Regler_Modell_V5.json)
- [BLE-Zusatzdatenlogger](Zusatzdaten_BLE.txt), [Snapshot-Builder](Messwerte_berechnen_BLE.js)

Der Zusatzdatenlogger muss am tatsächlich geschriebenen ungedrosselten Statuspfad liegen. Snapshot-Builder und acht Beobachter müssen Daten im gleichen Flow-Kontext liefern. Kein älterer Logger darf anschließend wieder HTTP-Felder/Snapshots ergänzen. `batteryBle.schema=1.1`, `diagnosticCoverage.allObserversPresent=true` und `snapshotAttachment.matched=true` vor der nächsten Aufnahme prüfen. Unverändertes HOLD erfordert keine neuen HA-Aufrufe; HA-Abschluss ist kein BLE-Schreib-ACK. Anlagenspezifische Observer-/Node-Exporte bleiben im persönlichen Einbaupaket.

## Lokale bedingte Simulation

Node.js sowie Python mit NumPy werden benötigt. Keine Rohlogs sind im Repository enthalten. Einen eigenen vollständigen Reglerstatus-JSONL-Log lokal angeben:

```sh
python3 simulation/run_simulation.py --log /absoluter/pfad/regler.jsonl --output /absoluter/pfad/neue_simulation.json
node --test tests/*.test.cjs
```

Die Simulation rekonstruiert den äußeren Netto-Störverlauf aus dem Log und hält ihn zwischen Kandidaten konstant. Das ist eine bedingte Gegenrechnung, keine unabhängige Prognose. Das Batteriemodell beschreibt Rückmeldetelemetrie, keinen AC/DC-Wirkungsgrad. Die neue ruhige Modellvariante verbessert Log 5 und Log 3, verschlechtert aber Log 4; das bisherige Nominalmodell bleibt deshalb erhalten. Die Simulation ist auf Laden kalibriert und warnt bei Entladeanforderungen. Weder dieser Code noch der Offline-Patcher sendet etwas zur Anlage.
