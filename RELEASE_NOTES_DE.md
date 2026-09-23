# SolarFlow Controller v4.0.0

[English](RELEASE_NOTES.md) | **Deutsch**

## Änderungen gegenüber v3.3.0

- Gleitende **168 Stunden** ersetzen das Fenster aus sieben Kalendertagen. Alte Daten verlassen den Puffer schrittweise; um Mitternacht entfällt nicht mehr ein ganzer Tag.
- Lade- und Entladeenergie werden aus gemessener vorzeichenbehafteter Batterieleistung mit tatsächlichen Zeitstempeln berechnet, einschließlich Richtungswechseln. Tagesenergiezähler sind keine Eingabe mehr.
- Dauerhafte Minutenwerte erhalten die Historie über Neustarts. Kompatible V3-Historie wird einmal übernommen; bestehende V4-Puffer werden weiterverwendet.
- Neue Nutzer erhalten nach ausreichend gültiger Ladeenergie einen Wert, ohne sieben Tage warten zu müssen.
- Die letzten zehn Ausschlussereignisse erläutern verworfene Daten mit Dauer, Ursachen, Messwerten und Grenzwerten.
- Deutsche und englische Anleitungen und Flows sind abgestimmt. Überholte V3-Laufzeitdateien und Build-Abhängigkeiten wurden aus dem aktuellen Dateibaum entfernt; v3.3.0 bleibt verfügbar.

## Umstieg

Die [Anleitung](rolling-efficiency/README_DE.md) beachten: Snapshot-Eingang statt der beiden Tageszählerabfragen verwenden, Kontextspeicher und bestehende Historie erhalten und nur eine Berechnung betreiben. Regler/Snapshot-Quelle müssen die dokumentierten Kontextvariablen bereits bereitstellen. Release v4.0.0 enthält Berechnungsrevision **4.1**, Pufferschema **4**.

Die Berechnung wurde im Betrieb erprobt und verfügt über automatisierte Regressionstests. Übernommene Tageshistorie bleibt eine Näherung; das Release behauptet keinen abgeschlossenen 168-Stunden-Feldtest und keine zertifizierte Messgenauigkeit. Quellenzeitversatz, BMS-Korrekturen und fehlende Messwerte bleiben relevant.
