> 28.10.2026: [V4.31-SIM-ZERO6-TEST](regulator/experimental/v4.31-sim/README_DE.md): PV-/Hausdeltas nur protokollieren. Log25 brach nach zehn Sekunden wegen +53 W Hausdelta ab, ohne regulären Leistungsbedarf. PackState-Test hält darüber hinaus; weiter ohne Timeout/Leistungsnullpunkt-Abbruch. Test beobachten, nur Regler ersetzen.

> 28.10.2026: [V4.30-SIM-ZERO5-TEST](regulator/experimental/v4.30-sim/README_DE.md): gezielter PackState-Test ohne 60-s-Frist und ohne Abbruch am Leistungsnullpunkt. Log24 brach bereits nach sechs Sekunden am Leistungsnullpunkt ab. Kleinen Startauftrag halten, übrige Vorränge beibehalten; Test beobachten. Nur Regler ersetzen.

> 28.10.2026: Aktuelle Testfassung [V4.29-SIM-ZERO4](regulator/experimental/v4.29-sim/README_DE.md): Restentladung + 5 W Reserve beim Start festhalten (−18 W → 23 W), PackState/Leistung als Rückmeldung, bis 60 Sekunden. Nur Regler ersetzen.

> 28.10.2026: Neue Testfassung [V4.28-SIM-ZERO3](regulator/experimental/v4.28-sim/README_DE.md): 5 W, PackState/Leistung als Rückmeldung, bis 60 Sekunden; 10 W separat konfigurierbar. Nur Regler ersetzen.

# SolarFlow Controller

[English](README.md) | **Deutsch**

Batterie-Wirkungsgradüberwachung mit Node-RED für SolarFlow-Anlagen. **Release v5.1.0** ergänzt einen zeitgewichteten gleitenden 7-Tage-Mittelwert der bisherigen SOC-korrigierten 168-Stunden-Energiebilanz. Der geglättete Wert liegt an Ausgang 1, die bisherige Bilanz an Ausgang 2 und die Diagnose an Ausgang 3. Dieses Repository enthält die Auswertung und eine gesonderte experimentelle Regler-Testvariante. Der Snapshot-Builder bleibt anlagenspezifisch.

## Aktueller Regler: V4.27-SIM-ZERO2 (Live-Test) und Simulationsmodell V16

**28.10.2026 — V4.27-SIM-ZERO2:** [Code und Einbau](regulator/experimental/v4.27-sim/README_DE.md). Einmaliger6W-Ladeimpuls bei bestätigtem AC-Modus Laden und fortbestehender Restentladung; höchstens zwei gültige Takte, früheres Ende bei PackState-Wechsel oder gemessener Leistungsnull. 19 Offline-Testgruppen bestanden. Hardwarewirkung steht noch zur Live-Prüfung aus; nur Reglercode ersetzen.

**28.10.2026 — V4.26-SIM-ZERO1:** [Code und Einbau](regulator/experimental/v4.26-sim/README_DE.md). Bei finalen 0 W Laden und 0 W Entladen wird im aktiven Betrieb die Laderichtung angefordert. Kein positiver Ladeimpuls. Zehn gezielte Testgruppen und 5.324 ausgeführte historische Aufrufe geprüft; die Hardwarewirkung bei 0 W muss noch live bestätigt werden. Nur den Regler-Function-Code ersetzen.

**14.10.2026 — Logs 21–23 / Modell V16:** [Analyse und Optimierungsprüfung](regulator/experimental/v4.25-sim/validation/log21-23/Log21_23_Analyse_DE.md). 1.775 Entscheidungen exakt reproduziert, 16 Änderungen in 3.048 geschlossenen Simulationen untersucht. V16 ergänzt einen lokal validierten Telemetrieoffset als Unsicherheit. Modellgestützte Nachführung und kleine Importkorrekturen werden nicht als neuer Anlagenstand übernommen. **Regler bleibt V4.25-SIM-DIAG1; kein Codeaustausch nötig.**

**Tageslogs 17–20, Modell V15:** [Auswertung und Feintuning](regulator/experimental/v4.25-sim/validation/log17-20/Log17_20_Analyse_DE.md). High-/Very-High-PV und der große Lastsprung sind jetzt geprüft. 2.361 Regelentscheidungen exakt reproduziert; 15 Änderungen in insgesamt 2.440 bedingten Simulationen untersucht. Neue lokale Tageskennlinie, getrennte Umschaltzeiten; **Regler bleibt V4.25-SIM-DIAG1, kein Codeaustausch nötig**.

**Validierung 13.10.2026 — Logs 15/16:** [Analyse und Simulation](regulator/experimental/v4.25-sim/validation/log15-16/Log15_16_Analyse_DE.md). Log 16 bestätigt die Abbruchdiagnose live. Modell V14 ergänzt den schwachen Tagesanlauf und den Wechsel Entladen→Laden. 1.188 Reglerentscheidungen exakt reproduziert, 1.001 bedingte Simulationsläufe; keine Parameteränderung übernommen. Regler bleibt V4.25-SIM-DIAG1, kein Node-Tausch nötig.

**Diagnose-Update vom 13.10.2026:** [V4.25-SIM-DIAG1](regulator/experimental/v4.25-sim/DIAG1_DE.md) gibt bei jedem empfangenen 2-s-Reglertrigger einen Status aus, auch bei Snapshot-Abbruch oder synchronem Laufzeitfehler. Die drei Stellpfade und alle Schutzgrenzen behalten ihr Verhalten. Geprüft mit zehn Testgruppen, 1.395 unveränderten Stellentscheidungen im Offline-Vergleich sowie dem vorhandenen Zusatzdaten-/Logger-V2-Pfad. Nur den Regler-Function-Code austauschen.

Die [aktuelle Arbeitsbasis](regulator/experimental/v4.25-sim/README_DE.md) enthält High-PV-Regelung ohne Fensterverschiebung, gezielte schnelle Entladekorrektur bei Lastabfall und das um Ladeaufnahmebegrenzung sowie vollen Standby-Start erweiterte Modell V13. V4.25 ist in Logs12/13 mit insgesamt 795 exakt reproduzierten Entscheidungen geprüft. [Änderungen seit V4.23 und offene Feintuning-Punkte](regulator/experimental/v4.25-sim/CHANGELOG_DE.md) trennen Feldnachweis, lokale Modellanpassung und verbleibende Grenzen. Ein physikalisches Optimum ist nicht nachgewiesen. Die Wirkungsgrad-Komponente v5.1.0 bleibt eigenständig.

## V4.21-Feldvalidierung und Simulationsmodell V4

Die [neue Feldvalidierung](regulator/experimental/v4.21-sim/validation-logs-3-4/README_DE.md) prüft 1.188 V4.21-Punkte mit PV 288–2.036 W und gesperrter Entladung: kein Richtungswechsel und sofortige Ladeanforderung nach allen drei Lastabfällen. Der [vollständige Code](regulator/experimental/v4.21-sim/Regler_V4_21_SIM.js) und die [bytegleiche Textkopie](regulator/experimental/v4.21-sim/Regler_V4_21_SIM.txt) bleiben unverändert. Das [Simulationsmodell V4](regulator/experimental/v4.21-sim/validation-logs-3-4/Regler_Modell_V4.json) ergänzt passende Empfangszeiten, einen eigenen Standby-Telemetriewert und PV-Zeitlage-Unsicherheit; schnellere Rampenversuche werden nicht übernommen. Nachtbetrieb, freigegebene Entladung und anhaltendes High-PV-Laden bleiben außerhalb dieser Feldvalidierung. Die [ursprüngliche Tagesanalyse](regulator/experimental/v4.21-sim/Regler_Tagesanalyse_DE.md) und [vorherige Nachtanalyse](regulator/experimental/v4.20-sim/README_DE.md) bleiben verfügbar. Reglerrevisionen sind unabhängig vom Wirkungsgrad-Release v5.1.0.

## Unterstützung

Wenn dir dieses Projekt hilft, kannst du die Pflege und Weiterentwicklung unterstützen:

[![Auf Ko-fi unterstützen](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/krumpholzopensource)

Deine Unterstützung hilft dabei, das Projekt zu pflegen, zu testen, zu dokumentieren und frei verfügbar zu halten.

## Einstieg

1. Die [Installations- und Berechnungsanleitung](rolling-efficiency/README_DE.md) lesen.
2. Die dokumentierten Snapshot- und SOC-Kontextvariablen auf demselben Flow-Tab bereitstellen. Leistung in Watt: positiv beim Laden, negativ beim Entladen.
3. Batteriekapazität, Leistungsgrenzen und dauerhaften Kontextspeicher konfigurieren. [flow_DE.json](rolling-efficiency/flow_DE.json) importieren, den Home-Assistant-Server auswählen und den vorhandenen Timer nach der SOC-Erfassung anschließen.
4. Nur eine Wirkungsgradberechnung betreiben. Bei bestehenden Installationen zuerst die Umstiegsanleitung beachten.

Benötigt werden Node-RED, `node-red-contrib-home-assistant-websocket` und eine funktionierende HA-Serververbindung. Beide ha-sensor-Knoten erhalten die numerischen Berechnungsausgaben direkt; ein Sensor-Aufbereitungsnode entfällt. Dafür wird die [hass-node-red Companion-Integration](https://github.com/zachowj/hass-node-red), Version 1.1.0 oder neuer, in Home Assistant benötigt. Ein Flow-Import erzeugt weder die Eingabemesswerte noch den externen Snapshot-Builder. Tageszähler für Lade- und Entladeenergie sind nicht mehr erforderlich. Neue Installationen rechnen, sobald genügend gültige Ladeenergie vorhanden ist; sieben Tage Wartezeit sind nicht erforderlich.

## Sensor-Anbindung angepasst, Version unverändert

Der aktuelle `main`-Zweig verwendet die bereitgestellte einfache Sensorvorlage: State = `msg.payload`, `%`, leere Attribute/Ausgabefelder und getrennte Entity configs. Bei einer bestehenden Installation nur [sensor-mean_DE.json](rolling-efficiency/sensor-mean_DE.json) importieren und Berechnungsausgang **1** direkt anschließen. Der bisherige Sensor bleibt an Ausgang **2**. Siehe [direkte Verdrahtung](rolling-efficiency/WIRING_DE.md).

Release-Version **5.1.0** und Berechnungsrevision **5.1** bleiben unverändert. Der veröffentlichte Tag `v5.1.0` und dessen Release-Downloads enthalten weiterhin den ursprünglichen API-basierten Stand; für die angepasste Sensorverdrahtung die hier verlinkten Dateien aus `main` verwenden.

## Enthalten

- Getrennte Integration von Lade- und Entladeenergie mit tatsächlichen Messzeitabständen und vorzeichenbehafteter Leistung.
- Zeitgewichteter 7-Tage-Mittelwert aus ungerundeten gültigen Wirkungsgradwerten mit dauerhafter Historie und ausgewiesener Abdeckung.
- Gleitender Minutenpuffer, SOC-Korrektur, Leistungs- und Aktualitätsprüfungen sowie Ausschluss unklarer Intervalle.
- Dauerhafte Historie und einmalige Übernahme kompatibler V3-Puffer ohne Veränderung des Originals.
- Diagnose der letzten zehn Ausschlussereignisse mit Ursachen.
- Gleichwertige [deutsche](rolling-efficiency/flow_DE.json) und [englische](rolling-efficiency/flow.json) Flows und Anleitungen.

Release v5.1.0 enthält Berechnungsrevision 5.1 und Energie-Pufferschema 4 mit einem ergänzten Mittelwert-Pufferschema 1. Vorhandene V4-Energie- und V5-Mittelwertpuffer bleiben kompatibel. Mittelwerthistorie beginnt nur ohne vorhandenen Mittelwertpuffer neu. Beim Umstieg von V4 muss auf die seit V5 geänderte Ausgangsreihenfolge umverdrahtet werden.

## Umstieg von v5.0.0

Release v5.1.0 (Berechnung 5.1) hält Ausgang 1 bei kurzen SOC-/Quellausfällen aus gültiger gespeicherter Mittelwerthistorie verfügbar. Neue Aufnahme pausiert, Altdaten laufen zeitabhängig aus; Fehler tragen weder Nullwerte noch gehaltene Messintervalle bei. Berechnung, SOC-/Watchdog-Node und Sensorpfade gemeinsam ersetzen. Energie- und Mittelwerthistorie bleiben erhalten. Standardmäßig ist der originale SOC-Zeitstempel erforderlich; eine eine Sekunde alte Beobachtung wird unterstützt. Den vorhandenen gemeinsamen Timer ohne zusätzlichen periodischen Timer verwenden. Siehe [Verdrahtungsschema](rolling-efficiency/WIRING_DE.md).

## Umstieg von v4.0.0

Die Berechnungsfunktion auf **drei Ausgänge** stellen. Ausgang 1 mit dem neuen Mittelwertsensor oder einer Automatik verbinden, den bisherigen Wirkungsgradsensor von Ausgang 1 auf **Ausgang 2** und die Diagnose von Ausgang 2 auf **Ausgang 3** umstecken. Flow-Tab, Kontextspeicher und eingestellte Kapazität beibehalten. Den SOC-/Watchdog-Knoten gemäß [Anleitung](rolling-efficiency/README_DE.md) aktualisieren, damit der Watchdog die Diagnose warnt und nur den bisherigen Wirkungsgradschlüssel zurücksetzt. Den bisherigen Sensor samt Entity config beibehalten und den neuen Mittelwertsensor an Ausgang 1 ergänzen. Beide lesen direkt State = msg.payload ohne Aufbereitungsnode. Den Energiepuffer nicht löschen.

Der Mittelwert steht nach dem ersten aufeinanderfolgenden Paar gültiger Wirkungsgradwerte bereit. Anfangs umfasst er weniger als sieben Tage. `mean_window_complete` zeigt ein vollständig abgedecktes 168-Stunden-Mittelwertfenster an; Lücken vermindern die Abdeckung. Die Glättung beseitigt keine systematischen SOC-Fehler und macht das Ergebnis nicht zu einer zertifizierten Roundtrip-Messung.

## Umstieg von v3.3.0

Die Tageszählerabfragen durch den Snapshot-Eingangspfad aus der [Anleitung](rolling-efficiency/README_DE.md) ersetzen. Flow-Tab, Kontextspeicher, Kapazität und bestehenden Puffer beibehalten. Übernommene Tageshistorie wird innerhalb des jeweiligen historischen Tages gleichmäßig verteilt und läuft schrittweise aus. Vergangene Zwei-Sekunden-Messungen lassen sich daraus nicht rekonstruieren.

Die alte Fassung mit Tageszählern bleibt in [v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency) erhalten; der aktuelle Wirkungsgrad-Dateibaum enthält ausschließlich die leistungsbasierte Umsetzung.

Siehe [Release-Hinweise](RELEASE_NOTES_DE.md), [Änderungsverlauf](CHANGELOG_DE.md) und [Mitwirken](CONTRIBUTING_DE.md).

## Umfang und Lizenz

Das Ergebnis ist eine berechnete SOC-korrigierte Energiebilanz und keine zertifizierte Wirkungsgradmessung vollständiger Zyklen. SOC-Auflösung, BMS-Neukalibrierung, Zeitversatz und ausgeschlossene Daten beeinflussen die Genauigkeit. Siehe [Berechnungsgrenzen](rolling-efficiency/README_DE.md) und [Umfang und Gewährleistung](DISCLAIMER_DE.md).

Unabhängiges Community-Projekt ohne Verbindung zu oder Unterstützung durch Zendure. Siehe [Projekthinweise](NOTICE_DE.md). Der [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) wird separat gepflegt.

[MIT-Lizenz](LICENSE) · [Deutsche Erläuterung](LICENSE_DE.md)




