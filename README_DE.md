# SolarFlow Controller

[English](README.md) | **Deutsch**

Batterie-Wirkungsgradüberwachung mit Node-RED für SolarFlow-Anlagen. **Release v5.1.0** ergänzt einen zeitgewichteten gleitenden 7-Tage-Mittelwert der bisherigen SOC-korrigierten 168-Stunden-Energiebilanz. Der geglättete Wert liegt an Ausgang 1, die bisherige Bilanz an Ausgang 2 und die Diagnose an Ausgang 3. Dieses Repository enthält die Auswertung und eine gesonderte experimentelle Regler-Testvariante. Der Snapshot-Builder bleibt anlagenspezifisch.

## Regler-Feldtest und nächste Testvariante V4.20-SIM

Die [neue Feldtest- und Modellanalyse](regulator/experimental/v4.20-sim/Regler_Feldtest_Analyse_DE.md) prüft V4.19-SIM an der Anlage. Die ruhige Mittenregelung funktioniert; Lastanstiege besitzen noch einen langsamen Nachlauf. Die [V4.20-Anleitung](regulator/experimental/v4.20-sim/README_DE.md), der [vollständige Code](regulator/experimental/v4.20-sim/Regler_V4_20_SIM.js), die [bytegleiche Textkopie](regulator/experimental/v4.20-sim/Regler_V4_20_SIM.txt) und die [aktualisierten Modellparameter](regulator/experimental/v4.20-sim/Regler_Modell_V2.json) stellen die nächste simulierte Testvariante bereit. Der eigene V4.20-Anlagentest steht aus. Die [bisherigen V4.19-Dateien](regulator/experimental/v4.19-sim/README_DE.md) bleiben verfügbar. Diese Reglerrevisionen sind unabhängig vom Wirkungsgrad-Release v5.1.0.

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

