# Mitwirken

[English](CONTRIBUTING.md) | **Deutsch**

Rechenänderungen gehören in `rolling-efficiency/battery-efficiency.js`, Änderungen der SOC-Erfassung in `rolling-efficiency/prepare-cycle.js`. `flow-template.json` enthält Knoteneinstellungen ohne eingebetteten Code; `localize.py` und `build.py` erzeugen die deutschen Oberflächen und beide Import-Flows. Erzeugten Funktionscode nicht unabhängig bearbeiten.

Im Stammverzeichnis ausführen:

```sh
python3 rolling-efficiency/build.py
node --test rolling-efficiency/tests/*.test.cjs
```

Beide READMEs und Release-Hinweise konsistent halten. Kompatibilität gespeicherter Zustände erhalten und Änderungen der Übernahme prüfen. Änderungen an Integration, Ausschlussgrenzen, SOC-Behandlung und Zeitgewichtung erläutern. Erzeugte Dateien müssen zu ihren Quellen passen und der Build muss reproduzierbar sein.

Fehlerberichte benötigen ein minimales Beispiel mit Konfiguration, Softwareversionen und bereinigter Diagnose. Keine Zugangsdaten, persönlichen Live-Puffer, Anlagenexporte oder Betriebsprotokolle einchecken. Regressionstests verwenden synthetische Daten.

Beiträge stehen unter der [MIT-Lizenz](LICENSE). Siehe [Projekthinweise](NOTICE_DE.md).
