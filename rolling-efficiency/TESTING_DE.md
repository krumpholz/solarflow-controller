# Prüfung der Berechnung und automatisierte Tests

[English](TESTING.md) | **Deutsch**

## Geprüfte Energiebilanz

Die bisherige Integration der vorzeichenbehafteten Leistung, getrennte Dreiecke am Nulldurchgang, tatsächliche Zeitabstände, Vorzeichen der SOC-Änderung und Umrechnung in kWh bleiben erhalten. Beispiel: 2.400 W über zwei Sekunden ergeben 0,001333333 kWh. Die Formel bleibt `100 × (Entladeenergie_kWh + Speicheränderung_kWh) / Ladeenergie_kWh`; der neue Ausgang mittelt deren gültige Prozentwerte und führt keine andere Energiebilanzformel ein.

Gleiche Energie-/SOC-Intervalle, Ausschlüsse, doppelte Snapshots, dauerhafte Puffer und V3-Übernahme sind durch die bisherigen Regressionstests abgedeckt. Nennkapazität und gemessener SOC bleiben Annahmen: Ein Mittelwert kann weder den tatsächlichen Energieinhalt rekonstruieren noch systematische BMS-Fehler beseitigen. Das Ergebnis ist eine SOC-korrigierte Bilanz und keine zertifizierte Zyklusmessung.

Ein neuer Grenzwerttest reproduzierte eine falsche Ablehnung im bisherigen Code: Die binäre Gleitkomma-Subtraktion des SOC konnte einen rechnerisch exakten 100-%-Wert minimal überschreiten. Die Korrektur behandelt Überschreitungen innerhalb von 1e-9 Prozentpunkten an 0/100. Getrennte Tests lehnen echte Überschreitungen weiterhin ab. Die Mindestladeenergie bleibt 0,1 kWh.

## Lokal ausführen

Keine zusätzlichen Testbibliotheken erforderlich. Python 3 erzeugt Oberflächen/Flows; Node.js liefert den eingebauten Test-Runner (CI: Versionen 22 und 24):

```sh
python3 rolling-efficiency/build.py
TZ=UTC node --test rolling-efficiency/tests/*.test.cjs
TZ=Europe/Berlin node --test rolling-efficiency/tests/*.test.cjs
```

Im Repository-Stamm ausführen. Nach dem Build müssen `battery-efficiency_DE.js`, `prepare-cycle_DE.js`, `flow.json`, `flow_DE.json`, `sensor-mean.json` und `sensor-mean_DE.json` mit dem eingecheckten Stand übereinstimmen. GitHub Actions prüft dies vor den Tests. Beide Sprachfassungen führen denselben zentralen Rechenkern aus.

## Mittelwert- und Integrationstests

Die Testsammlung enthält **144 Tests**, einschließlich der bisherigen 70 Fälle. Beide Sprachfassungen werden mit synthetischen Daten und einem simulierten Node-RED-Kontext im Arbeitsspeicher ausgeführt.

| Bereich | Geprüfter Nachweis |
| --- | --- |
| Zeitgewichtung | 80→84 % über 2 s und 84→76 % über 8 s ergeben 80,4 %; Unterteilung desselben linearen Verlaufs verändert das Integral nicht |
| Genauigkeit und Grenzen | Ungerundete Prozentwerte gehen ein; 0 % ist gültig; exakte 0/100-Grenzen bleiben gültig, echte Überschreitungen werden ausgeschlossen |
| Minutenaufteilung | Das lineare Prozent-Zeit-Integral bleibt beim Überschreiten einer Minutengrenze erhalten |
| Ungültige Daten | Ersatzwerte, SOC-Sprünge und unplausible Wirkungsgrade ergänzen keine Mittelwertdauer; `null` wird nicht als Null-Prozent-Wert gerechnet |
| Fehler und Wiederaufnahme | Mittelwert bleibt aus gültiger Historie verfügbar, bisherige Ausgabe null; Lücken werden weder gehalten noch als 0 % ergänzt |
| Start und Update | Energie-/Übernahmehistorie bleibt bestehen; V3/V4-Historie erzeugt keine erfundenen früheren Mittelwert-Messpunkte |
| Neustart und Rückkehr | JSON-Speicherung erhält die Mittelwerthistorie; Duplikate verlängern sie nicht; zwischenzeitlicher V4-Betrieb überbrückt keine fehlende Mittelwerthistorie |
| Siebentagefenster | Vorgegebene vollständige 168-Stunden-Puffer verlieren nur den ältesten Anteil; Lücken verhindern Vollständigkeit; nach acht Tagen Ausfall ist die Historie ausgelaufen |
| Speicher und Beschädigung | Beide vollständigen Puffer bleiben begrenzt und überstehen Speicherung; beschädigter Mittelwertzustand erzeugt ungültige Ausgabe ohne Löschen der Energiehistorie |
| Flows und Watchdog | Drei Ausgänge, direkte ha-sensor-Nutzlasten, getrennte Konfigurationen, null gegenüber echter Null; Watchdog erhält Mittelwertschlüssel, Warnung nur Diagnose; manueller Inject ohne Wiederholung |
| Sprache und Sommerzeit | Erzeugte Funktionskörper entsprechen den Quellen; das UTC-Fenster bleibt beim Europe/Berlin-Sommerzeitwechsel 168 Stunden lang |

Die Siebentagetests verwenden deterministische synthetische Minutenhistorien und prüfen Verarbeitung, Ablauf alter Daten, Abdeckung und Speicherung. Dies ist kein siebentägiger Echtzeitbetrieb an der Hardware. Anlage der HA-Sensoren, BLE-Zeitverhalten und tatsächliche SOC-Genauigkeit müssen mit dem aktualisierten Flow an der Anlage beobachtet werden. Das Repository enthält keine persönlichen Betriebsprotokolle oder Zugangsdaten.

## Zusätzliche Verfügbarkeits- und Sensortests in v5.1

Zusätzliche Fälle prüfen den originalen, eine Sekunde alten SOC-Zeitstempel mit standardmäßig verpflichtender Zeitstempelprüfung, ungültigen SOC/Zahlenüberlauf, weiterlaufende Timer-Auswertung bei Ausfällen, zeitanteiligen Fensterrand bei ungültigem SOC, vollständiges Auslaufen, Speicherung während eines Fehlers, Wiederaufnahme ohne Überbrückung, aktuell zu geringe Ladeenergie und nicht sicher nutzbare Laufzeit-/Kontextfehler. Sensorfälle prüfen direkte State = msg.payload-Verdrahtung, vom aktuellen Quellzustand unabhängige Mittelwertgültigkeit, echte Null gegenüber null, getrennte übereinstimmende Entity configs, bisherige Sensoridentität und den kleinen Mittelwertimport mit vorhandenem Server ohne weitere Berechnung. Warnungs- und Catch-Pfade bleiben standardmäßig an der Diagnose. Release 5.1.0 / Berechnung 5.1 / Energie-Schema 4 / Mittelwert-Schema 1 werden getrennt geprüft.

Der Betreiber meldete am 09.10.2026 den Live-Test des Ersatznodes für die SOC-Vorbereitung. Dies bestätigt dessen Einsatz im vorhandenen Ablauf und keinen vollständigen Test des neuen Sensor-/Mittelwertflows oder siebentägigen Hardwarelauf. CI nutzt weiterhin synthetische Daten ohne HA-Zugangsdaten.

Die Sensoranpassung bei gleicher Version verändert weder Rechen-/SOC-Quellen noch Pufferschemata. Diese Tests prüfen Exportkonfiguration und Berechnungsnachrichten, keine angemeldete HA-/Companion-Sitzung. Tatsächliche Sensoranlage und null-zu-unbekannt-Verarbeitung benötigen weiterhin die installierte Integration.
