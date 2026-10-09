# Mitwirken

[English](CONTRIBUTING.md) | **Deutsch**

Rechenänderungen gehören in `rolling-efficiency/battery-efficiency.js`, Änderungen der SOC-Erfassung in `rolling-efficiency/prepare-cycle.js`. `flow-template.json` enthält Knoteneinstellungen ohne eingebetteten Code; `localize.py` und `build.py` erzeugen die deutschen Oberflächen und beide Import-Flows. Erzeugten Funktionscode nicht unabhängig bearbeiten.

Im Stammverzeichnis ausführen:

```sh
python3 rolling-efficiency/build.py
node --test rolling-efficiency/tests/*.test.cjs
TZ=Europe/Berlin node --test rolling-efficiency/tests/*.test.cjs
```

Beide READMEs und Release-Hinweise konsistent halten. Kompatibilität gespeicherter Zustände erhalten und Änderungen der Übernahme prüfen. Änderungen an Integration, Ausschlussgrenzen, SOC-Behandlung und Zeitgewichtung erläutern. Erzeugte Dateien müssen zu ihren Quellen passen und der Build muss reproduzierbar sein.

Mittelwerttests müssen Zeitgewichtung, ungerundete Quellenwerte, ausgeschlossene Lücken, Aufbauabdeckung, dauerhafte Speicherung und Ausgangsreihenfolge prüfen. Die Tests in UTC und Europe/Berlin ausführen; CI prüft zusätzlich Node.js 22 und 24. Siehe [Testbeschreibung](rolling-efficiency/TESTING_DE.md). Einen Feldtest nur bei entsprechender tatsächlicher Betriebserprobung angeben.

Fehlerberichte benötigen ein minimales Beispiel mit Konfiguration, Softwareversionen und bereinigter Diagnose. Keine Zugangsdaten, persönlichen Live-Puffer, Anlagenexporte oder Betriebsprotokolle einchecken. Regressionstests verwenden synthetische Daten.

Beiträge stehen unter der [MIT-Lizenz](LICENSE). Siehe [Projekthinweise](NOTICE_DE.md).
