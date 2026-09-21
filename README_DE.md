# SolarFlow – Dynamische Batterie- und Netzleistungsregelung

[English](README.md) | **Deutsch**

Node-RED-Regelungsprojekt für SolarFlow-Batteriesysteme. Es verbindet Messwerte und Batterie-Steuerungsentitäten aus Home Assistant, um Laden, Entladen und Netzleistung zu regeln.

> Unabhängiges, inoffizielles Community-Projekt. Es besteht keine Verbindung zu Zendure; das Projekt wird von Zendure weder gesponsert noch zertifiziert oder unterstützt.

## Projektstand

Das Repository enthält einen [Flow zur SOC-korrigierten Wirkungsgradschätzung über sieben Tage](round-trip-efficiency/README_DE.md), die Einbauanleitung auf Deutsch und Englisch sowie automatisierte Regressionstests. Dieses Auswertungswerkzeug sendet keine Steuerbefehle an die Batterie. Eine Prüfung in einer laufenden Anlage steht noch aus.

Die eigentliche Node-RED-Lade-/Entladeregelung wurde hier noch nicht veröffentlicht.

## Ziel

Die Regelung soll den PV-Eigenverbrauch erhöhen und die gemessene Netzleistung nahe einem einstellbaren Zielwert um null halten. Im Mittelpunkt steht ein stabiler Betrieb bei wechselnder Hauslast und Solarerzeugung.

Zum vorgesehenen Funktionsumfang gehören:

- Laden mit verfügbarem PV-Überschuss.
- Entladen zur Deckung des Hausverbrauchs innerhalb eingestellter Leistungs- und SOC-Grenzen.
- Ein einstellbares Netzleistungsfenster mit stabilem Haltezustand.
- Begrenzte Leistungsrampen und bestätigte Richtungswechsel zur Verringerung von Schwingungen.
- Reaktion auf plötzliche Lastanstiege und fallende PV-Leistung.
- Prüfung des Messwertalters und Überwachung des angeforderten gegenüber dem gemeldeten Batteriemodus.

Diese Punkte beschreiben den Projektumfang. Das Verhalten einer konkreten Version, Standardwerte, unterstützte Hardware und Prüfergebnisse werden zusammen mit dem veröffentlichten Regelungsflow dokumentiert. Netzleistung nahe null ist ein Regelungsziel, keine Garantie für vollständig vermiedenen Bezug oder Einspeisung.

## Systemübersicht

| Bestandteil | Aufgabe |
| --- | --- |
| Netzzähler und PV-Messungen | Liefern die Rückmeldung für den Regelkreis. |
| Home Assistant | Stellt Messwerte und Batterie-Steuerungsentitäten bereit. |
| Node-RED | Führt die Regelung aus und berechnet Leistungs- und Modusanforderungen. |
| Kommunikationsintegration der Batterie | Übermittelt Anforderungen und meldet den Gerätezustand zurück. |
| SolarFlow-Batteriesystem | Führt unterstützte Befehle innerhalb seiner Gerätegrenzen aus. |

Der zugehörige [ESPHome SolarFlow BLE Controller](https://github.com/krumpholz/esphome-solarflow-ble) stellt eine lokale BLE-Kommunikationsschnittstelle bereit. Dieses Repository enthält die übergeordnete Energieregelung. Die BLE-Firmware wird in ihrem eigenen Repository gepflegt.

## Vorgesehene Umgebung

- Node-RED und Home Assistant.
- Netz-, PV- und Batterieleistungsmessungen mit bekannten Einheiten und Vorzeichen.
- Rückmeldung von Ladezustand und Betriebszustand der Batterie.
- Eine kompatible Schnittstelle für Lade-/Entladegrenzen und Betriebsarten.

Die genauen Abhängigkeiten, Entitätszuordnungen, unterstützten Versionen und Importanweisungen für die Regelung folgen mit deren erster Flow-Veröffentlichung. Bei bestehenden Anlagen müssen Entitäten und Parameter individuell geprüft werden.

## Vorzeichen der Leistung

Für die Regelung ist folgende vereinheitlichte Konvention vorgesehen:

| Messwert | Positiv | Negativ |
| --- | --- | --- |
| Netzleistung | Netzbezug | Netzeinspeisung |
| Batterieleistung | Laden | Entladen |

PV-Erzeugung wird als nichtnegative Leistung in Watt angegeben. Datenquellen können andere Vorzeichen verwenden. Prüfe und vereinheitliche die Werte vor dem Aktivieren der Regelung.

## Betriebshinweise

Lies die [Haftungs- und Betriebshinweise](DISCLAIMER_DE.md), bevor du später veröffentlichten Regelungscode einsetzt.

- Herstellerschutzfunktionen und Hardwaregrenzen müssen wirksam bleiben.
- Prüfe Messrichtung, Einheiten, Zeitstempel, Leistungsgrenzen und SOC-Grenzen deiner Anlage.
- Vermeide widersprüchliche Befehle mehrerer Automationen oder Anwendungen.
- Prüfe Start, Kommunikationsausfall, veraltete Messwerte und Wiederanlauf vor unbeaufsichtigtem Betrieb.
- Das Deaktivieren einer Automation oder ein Kommunikationsausfall setzt den zuletzt von der Batterie angenommenen Befehl nicht zwangsläufig zurück.

Das Projekt stellt keinen zertifizierten Netzschutz bereit und ersetzt kein Batteriemanagementsystem.

## Dateien im Repository

| Datei | Inhalt |
| --- | --- |
| [round-trip-efficiency](round-trip-efficiency/README_DE.md) | Wirkungsgrad-Auswertung, Einbau, Migration und Tests |
| [LICENSE](LICENSE) | MIT-Lizenz im englischen Original |
| [NOTICE_DE.md](NOTICE_DE.md) | Unabhängigkeit des Projekts und Markenhinweise |
| [DISCLAIMER_DE.md](DISCLAIMER_DE.md) | Einsatzbereich, Betriebsverantwortung und Gewährleistungsausschluss |
| [CONTRIBUTING_DE.md](CONTRIBUTING_DE.md) | Hinweise zur Mitarbeit und zu Fehlermeldungen |
| [CHANGELOG_DE.md](CHANGELOG_DE.md) | Änderungshistorie |
| [.gitignore](.gitignore) | Ausschluss üblicher lokaler Zugangsdaten und erzeugter Dateien |

## Mitarbeit

Fehlermeldungen, Verbesserungen der Dokumentation und Beiträge sind willkommen. Siehe [CONTRIBUTING_DE.md](CONTRIBUTING_DE.md). Entferne Zugangsdaten und persönliche Anlagendaten aus allen geteilten Flows und Protokollen.

## Lizenz und Unabhängigkeit

Veröffentlicht unter der [MIT-Lizenz](LICENSE).

Zendure, SolarFlow und andere Produktnamen gehören ihren jeweiligen Rechteinhabern. Sie werden ausschließlich zur Beschreibung der Kompatibilität und des Zusammenspiels verwendet. Eine Verbindung zum Hersteller oder dessen Unterstützung wird nicht behauptet. Siehe [NOTICE_DE.md](NOTICE_DE.md).
