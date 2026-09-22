# SolarFlow Controller

[English](README.md) | **Deutsch**

Node-RED-Werkzeuge für SolarFlow-Batteriesysteme und Home Assistant.

> Unabhängiges, inoffizielles Community-Projekt. Es besteht keine Verbindung zu Zendure; das Projekt wird von Zendure weder gesponsert noch zertifiziert oder unterstützt.

## Leistungsintegration mit gleitendem Fenster (V4)

Die neue [168-Stunden-Berechnung aus Leistung](rolling-efficiency/README_DE.md) nutzt den vorhandenen Regler-Snapshot, übernimmt einen V3-Puffer mit ausdrücklich dokumentierter Übergangsnäherung und liefert bereits vor Ablauf von sieben Tagen Ergebnisse. [Deutscher Flow](rolling-efficiency/flow_DE.json) · [Englischer Flow](rolling-efficiency/flow.json).

Die veröffentlichte Fassung mit Tageszählern bleibt unten und als [v3.3.0](https://github.com/krumpholz/solarflow-controller/releases/tag/v3.3.0) verfügbar. Die nachstehenden Eingabevoraussetzungen gelten für V3; V4 verwendet die [Snapshot-Eingaben](rolling-efficiency/README_DE.md#erforderliche-externe-werte).

## Verfügbarer Bestandteil

Das Repository enthält einen **Flow für den SOC-korrigierten Batterie-Wirkungsgrad über sieben Tage**, auf Deutsch und Englisch. Er berechnet eine Energiebilanz aus täglichen Lade-/Entladezählern und dem Ladezustand der Batterie, speichert seinen Messzustand über Neustarts hinweg und veröffentlicht einen Prozentwert in Home Assistant.

**Hier beginnen:** [Einbau und Berechnung](round-trip-efficiency/README_DE.md) · [Deutscher Flow](round-trip-efficiency/flow_DE.json) · [Englischer Flow](round-trip-efficiency/flow.json)

Der enthaltene Flow wertet den Wirkungsgrad aus und sendet keine Batterie-Steuerbefehle. Eine Lade-/Entlade- und Netzleistungsregelung ist in diesem Repository nicht enthalten.

## Voraussetzungen

- Home Assistant und Node-RED mit den Home-Assistant-Websocket-Knoten.
- Getrennte tägliche Lade- und Entladeenergiezähler in kWh.
- Batterie-SOC in Prozent, auf demselben Node-RED-Flow-Tab bereitgestellt.
- Eingestellte Batteriekapazität, Leistungsgrenzen, Zeitzone und dauerhafte Kontextspeicher.
- Die Node-RED-Begleitintegration in Home Assistant für den Ergebnissensor.

Die [Komponentenanleitung](round-trip-efficiency/README_DE.md) nennt alle externen Eingaben und erklärt das Erstellen der Energiesensoren, die SOC-Bereitstellung und die Ausgabe. Eingabesensoren werden beim Flow-Import nicht angelegt. Neuinstallationen beginnen mit dem ersten gültigen Messpaar; ein vollständig gefüllter Siebentagepuffer ist für die erste Ausgabe nicht erforderlich.

## Zugehöriges BLE-Projekt

Der [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) stellt eine separate lokale Kommunikationsschnittstelle bereit. Firmware und Einbauanleitung werden dort gepflegt. Die Wirkungsgrad-Auswertung kann dessen Messwerte oder eine andere geeignete Quelle mit passenden Einheiten und Messgrenzen verwenden.

## Umfang und Einordnung

Das Ergebnis verwendet gemessene Energiezähler und eine kapazitätsbasierte SOC-Korrektur. SOC-Auflösung, BMS-Neukalibrierung, Quellenzeitversatz und fehlende Intervalle beeinflussen die Genauigkeit. Es handelt sich nicht um eine zertifizierte AC-zu-AC-Roundtrip-Messung. Siehe Berechnungsanleitung und [Hinweise zu Umfang und Gewährleistung](DISCLAIMER_DE.md).

## Wegweiser durch das Repository

| Ablage | Inhalt |
| --- | --- |
| [round-trip-efficiency](round-trip-efficiency/README_DE.md) | Flow, Funktionsquellen, Einbau und Berechnungsbeschreibung |
| [Energiesensor-Beispiel](round-trip-efficiency/examples/home-assistant-energy.yaml) | Optionale HA-Konfiguration von vorzeichenbehafteter Batterieleistung zu kWh-Tageszählern |
| [CHANGELOG_DE.md](CHANGELOG_DE.md) | Änderungshistorie |
| [CONTRIBUTING_DE.md](CONTRIBUTING_DE.md) | Fehlermeldungen, Mitarbeit und Entwicklerhinweise |
| [NOTICE_DE.md](NOTICE_DE.md) | Unabhängigkeit und Markenhinweise |
| [DISCLAIMER_DE.md](DISCLAIMER_DE.md) | Umfang, Messgrenzen und Gewährleistung |
| [LICENSE](LICENSE) | MIT-Lizenz |

## Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE). Produktnamen gehören den jeweiligen Rechteinhabern und beschreiben ausschließlich die Kompatibilität. Siehe [NOTICE_DE.md](NOTICE_DE.md).
