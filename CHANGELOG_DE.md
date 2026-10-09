# Änderungsverlauf

[English](CHANGELOG.md) | **Deutsch**

## v5.1.0 — 09.10.2026

- Ausgang 1 bleibt bei kurzen SOC-/Quellausfällen aus gültiger Mittelwerthistorie verfügbar. Neue Aufnahme pausiert, ihr Interpolations-Ausgangspunkt wird gelöscht und das 168-Stunden-Fenster läuft weiter. Keine Nullwerte oder gehaltenen Messintervalle ergänzen.
- Mittelwertgültigkeit von der aktuellen Quellgültigkeit trennen; Aufnahmestatus, letztes gültiges Intervall und Alter ausgeben. Fehlende, abgelaufene oder nicht sicher nutzbare Historie bleibt unbekannt.
- Companion-Sensor-/Entitätsknoten durch normale HA-API-Schreibzugriffe mit vorgeschalteten Aufbereitungsfunktionen ersetzen. Keine Custom Integration `hass-node-red` erforderlich. Einheit %, Messwertklasse, Abdeckung und Quellinformationen ausgeben.
- SOC-Vorbereitung erhält den ursprünglichen Zeitstempel und setzt bei Watchdog-Timeout nur den bisherigen Wirkungsgradschlüssel zurück. Warnung standardmäßig an Diagnose; Anschluss an bisherigen Sensor optional. Vorhandenen gemeinsamen Timer nach einer Sekunde SOC-Abstand verwenden; Import ergänzt nur manuellen Test-Inject.
- SOC-Zeitstempel standardmäßig erforderlich. Release **5.1.0**, Berechnungsrevision **5.1**, Energie-Schema **4** und Mittelwert-Schema **1** unterscheiden; kompatible Energie- und V5-Mittelwertpuffer erhalten.
- Beide Sprachfassungen mit **144 Tests** prüfen, deutsche/englische Installations- und Verdrahtungsanleitungen aktualisieren und versionierte Release-Dateien nach erfolgreicher Main-CI veröffentlichen.

## v5.0.0 — Entwicklungsentwurf, nicht veröffentlicht (09.10.2026)

- Zeitgewichteten gleitenden **7-Tage-Mittelwert** aus ungerundeten gültigen SOC-korrigierten Wirkungsgradwerten ergänzt. Die tatsächliche Zeit bestimmt die Gewichtung; ungültige Werte und Messlücken gehen nicht ein.
- **Geänderte Ausgangsreihenfolge:** Ausgang 1 = Mittelwert, Ausgang 2 = bisheriger Wirkungsgrad, Ausgang 3 = Diagnose. Import-Flows enthalten einen eigenen HA-Mittelwertsensor und setzen bei Watchdog-Timeouts beide Sensoren zurück.
- Bestehende V4-Energiehistorie, V3-Übernahmemarker und Ausschlussdiagnose erhalten. Begrenzte dauerhafte Minutenaggregate für den Mittelwert ergänzt; keine Prozentwerthistorie vor dem Update erfunden.
- Mittelwertabdeckung, Aufbauzeit, Vollständigkeit des Fensters und die Näherung an der angeschnittenen Minutengrenze ausgewiesen. Bisherige Energiebilanz und SOC-Korrekturformel beibehalten.
- Gleitkomma-Überschreitungen an rechnerisch exakten 0/100-%-Grenzen mit 1e-9 Prozentpunkten Rechentoleranz korrigiert; tatsächlich unplausible Werte bleiben ungültig.
- Regressionstests für Mittelwert, Neustart, Übernahme, Sommerzeitwechsel, Ausgangsreihenfolge und Flow-Verbindungen sowie GitHub-Actions-Prüfungen in UTC und Europe/Berlin ergänzt. Deutscher und englischer Code samt Flows werden weiterhin aus einem Rechenkern erzeugt.

## v4.0.0 — 2026-09-23

- Gleitende **168 Stunden** ersetzen das Fenster aus sieben Kalendertagen. Alte Daten verlassen den Puffer schrittweise; um Mitternacht entfällt nicht mehr ein ganzer Tag.
- Lade- und Entladeenergie werden aus gemessener vorzeichenbehafteter Batterieleistung mit tatsächlichen Zeitstempeln berechnet, einschließlich Richtungswechseln. Tagesenergiezähler sind keine Eingabe mehr.
- Dauerhafte Minutenwerte erhalten die Historie über Neustarts. Kompatible V3-Historie wird einmal übernommen; bestehende V4-Puffer werden weiterverwendet.
- Neue Nutzer erhalten nach ausreichend gültiger Ladeenergie einen Wert, ohne sieben Tage warten zu müssen.
- Die letzten zehn Ausschlussereignisse erläutern verworfene Daten mit Dauer, Ursachen, Messwerten und Grenzwerten.
- Deutsche und englische Anleitungen und Flows sind abgestimmt. Überholte V3-Laufzeitdateien und Build-Abhängigkeiten wurden aus dem aktuellen Dateibaum entfernt; v3.3.0 bleibt verfügbar.

## v3.3.0 — 2026-09-22

Erste Veröffentlichung: SOC-korrigierte Auswertung von Lade- und Entladetageszählern über sieben lokale Kalendertage, dauerhafter V3-Puffer sowie deutsche und englische Flows.
