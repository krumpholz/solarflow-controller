# SolarFlow Controller

[English](README.md) | **Deutsch**

Batterie-Wirkungsgradüberwachung mit Node-RED für SolarFlow-Anlagen. **Release v5.0.0** ergänzt einen zeitgewichteten gleitenden 7-Tage-Mittelwert der bisherigen SOC-korrigierten 168-Stunden-Energiebilanz. Der geglättete Wert liegt an Ausgang 1, die bisherige Bilanz an Ausgang 2 und die Diagnose an Ausgang 3. Dieses Repository enthält die Auswertung; der anlagenspezifische Regler und Snapshot-Builder sind nicht enthalten.

## Unterstützung

Wenn dir dieses Projekt hilft, kannst du die Pflege und Weiterentwicklung unterstützen:

[![Auf Ko-fi unterstützen](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/krumpholzopensource)

Deine Unterstützung hilft dabei, das Projekt zu pflegen, zu testen, zu dokumentieren und frei verfügbar zu halten.

## Einstieg

1. Die [Installations- und Berechnungsanleitung](rolling-efficiency/README_DE.md) lesen.
2. Die dokumentierten Snapshot- und SOC-Kontextvariablen auf demselben Flow-Tab bereitstellen. Leistung in Watt: positiv beim Laden, negativ beim Entladen.
3. Batteriekapazität, Leistungsgrenzen und dauerhaften Kontextspeicher konfigurieren. [flow_DE.json](rolling-efficiency/flow_DE.json) importieren, den Home-Assistant-Server auswählen und den Snapshot-Auslöser anschließen.
4. Nur eine Wirkungsgradberechnung betreiben. Bei bestehenden Installationen zuerst die Umstiegsanleitung beachten.

Benötigt werden Node-RED, `node-red-contrib-home-assistant-websocket` und für den Ausgabesensor die Node-RED-Companion-Integration in Home Assistant. Ein Flow-Import erzeugt weder die Eingabemesswerte noch den externen Snapshot-Builder. Tageszähler für Lade- und Entladeenergie sind nicht mehr erforderlich. Neue Installationen rechnen, sobald genügend gültige Ladeenergie vorhanden ist; sieben Tage Wartezeit sind nicht erforderlich.

## Enthalten

- Getrennte Integration von Lade- und Entladeenergie mit tatsächlichen Messzeitabständen und vorzeichenbehafteter Leistung.
- Zeitgewichteter 7-Tage-Mittelwert aus ungerundeten gültigen Wirkungsgradwerten mit dauerhafter Historie und ausgewiesener Abdeckung.
- Gleitender Minutenpuffer, SOC-Korrektur, Leistungs- und Aktualitätsprüfungen sowie Ausschluss unklarer Intervalle.
- Dauerhafte Historie und einmalige Übernahme kompatibler V3-Puffer ohne Veränderung des Originals.
- Diagnose der letzten zehn Ausschlussereignisse mit Ursachen.
- Gleichwertige [deutsche](rolling-efficiency/flow_DE.json) und [englische](rolling-efficiency/flow.json) Flows und Anleitungen.

Release v5.0.0 enthält Berechnungsrevision 5.0 und Energie-Pufferschema 4 mit einem ergänzten Mittelwert-Pufferschema 1. Vorhandene V4-Energiepuffer bleiben kompatibel; die neue Mittelwerthistorie beginnt beim Update. Die geänderte Ausgangsreihenfolge erfordert eine neue Verdrahtung und begründet den Sprung der Hauptversion.

## Umstieg von v4.0.0

Die Berechnungsfunktion auf **drei Ausgänge** stellen. Ausgang 1 mit dem neuen Mittelwertsensor oder einer Automatik verbinden, den bisherigen Wirkungsgradsensor von Ausgang 1 auf **Ausgang 2** und die Diagnose von Ausgang 2 auf **Ausgang 3** umstecken. Flow-Tab, Kontextspeicher und eingestellte Kapazität beibehalten. Den SOC-/Watchdog-Knoten gemäß [Anleitung](rolling-efficiency/README_DE.md) aktualisieren, damit ein Timeout beide Sensoren zurücksetzt. Den Energiepuffer nicht löschen.

Der Mittelwert steht nach dem ersten aufeinanderfolgenden Paar gültiger Wirkungsgradwerte bereit. Anfangs umfasst er weniger als sieben Tage. `mean_window_complete` zeigt ein vollständig abgedecktes 168-Stunden-Mittelwertfenster an; Lücken vermindern die Abdeckung. Die Glättung beseitigt keine systematischen SOC-Fehler und macht das Ergebnis nicht zu einer zertifizierten Roundtrip-Messung.

## Umstieg von v3.3.0

Die Tageszählerabfragen durch den Snapshot-Eingangspfad aus der [Anleitung](rolling-efficiency/README_DE.md) ersetzen. Flow-Tab, Kontextspeicher, Kapazität und bestehenden Puffer beibehalten. Übernommene Tageshistorie wird innerhalb des jeweiligen historischen Tages gleichmäßig verteilt und läuft schrittweise aus. Vergangene Zwei-Sekunden-Messungen lassen sich daraus nicht rekonstruieren.

Die alte Fassung mit Tageszählern bleibt in [v3.3.0](https://github.com/krumpholz/solarflow-controller/tree/v3.3.0/round-trip-efficiency) erhalten; der aktuelle Dateibaum enthält ausschließlich die leistungsbasierte Umsetzung.

Siehe [Release-Hinweise](RELEASE_NOTES_DE.md), [Änderungsverlauf](CHANGELOG_DE.md) und [Mitwirken](CONTRIBUTING_DE.md).

## Umfang und Lizenz

Das Ergebnis ist eine berechnete SOC-korrigierte Energiebilanz und keine zertifizierte Wirkungsgradmessung vollständiger Zyklen. SOC-Auflösung, BMS-Neukalibrierung, Zeitversatz und ausgeschlossene Daten beeinflussen die Genauigkeit. Siehe [Berechnungsgrenzen](rolling-efficiency/README_DE.md) und [Umfang und Gewährleistung](DISCLAIMER_DE.md).

Unabhängiges Community-Projekt ohne Verbindung zu oder Unterstützung durch Zendure. Siehe [Projekthinweise](NOTICE_DE.md). Der [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) wird separat gepflegt.

[MIT-Lizenz](LICENSE) · [Deutsche Erläuterung](LICENSE_DE.md)
