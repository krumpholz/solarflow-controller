# SolarFlow Controller v5.1.0

[English](RELEASE_NOTES.md) | **Deutsch**

Release **5.1.0** enthält Berechnungsrevision **5.1**, Energie-Pufferschema **4** und Mittelwert-Schema **1**. Kompatible Energiehistorie und vorhandene V5-Mittelwerthistorie bleiben erhalten.

## Änderungen gegenüber v4.0.0

- Dauerhaften, zeitgewichteten gleitenden **7-Tage-Mittelwert** ungerundeter gültiger Prozentwerte der bisherigen SOC-korrigierten 168-Stunden-Bilanz ergänzen. **Ausgang 1 = Mittelwert, Ausgang 2 = bisheriger Wirkungsgrad, Ausgang 3 = Diagnose.**
- Gültige gespeicherte Mittelwerthistorie bei kurzen SOC-/Quellausfällen verfügbar halten. Aufnahme pausieren und Interpolations-Ausgangspunkt löschen. Zeitfenster weiterlaufen lassen, abgelaufene Intervalle entfernen und Abdeckung, Quellgültigkeit sowie Messwertalter ausweisen. Fehlende Werte weder als 0 % einrechnen noch durch gehaltene Werte mit erfundener Abdeckung ersetzen.
- Companion-Sensoren durch Aufbereitungsfunktionen und **normale Home-Assistant-API**-Schreibzugriffe ersetzen. Keine Custom Integration `hass-node-red` erforderlich. Dies sind Sensorzustände ohne Entitätsregistereintrag/Unique-ID; nach HA-Neustart stellt das nächste erfolgreiche Schreiben sie wieder her.
- SOC-Vorbereitung aktualisieren: originalen Zeitstempel erhalten, in der Berechnung standardmäßig verlangen und vorhandenen gemeinsamen Timer etwa eine Sekunde später nutzen. Tageszählerabfragen entfernen. Importierter Inject nur manuell.
- Ausgang „fehlende Messung“ an die Diagnose führen. Verbindung zum bisherigen Sensor optional; keine Warnungsverbindung zum Mittelwertsensor. Watchdog setzt nur den bisherigen Wirkungsgradschlüssel zurück.
- Leistungsintegration, SOC-Korrektur, V3-Übernahme und Ausschlussdiagnose beibehalten. Nur Gleitkomma-Überschreitungen innerhalb von 1e-9 Prozentpunkten an exakten 0/100-%-Grenzen auflösen; echte Bereichsüberschreitungen bleiben ungültig.
- **144 automatisierte Tests**, deutsche/englische Importflows, Installationsanleitungen und Verdrahtungsschemata bereitstellen. GitHub Actions prüft Node.js 22/24 in UTC/Berlin und veröffentlicht versionierte Release-Dateien nach erfolgreichen Main-Tests.

## Umstieg

Berechnung, SOC-Vorbereitung und Sensorpfade gemeinsam gemäß [Anleitung](rolling-efficiency/README_DE.md) und [Verdrahtung](rolling-efficiency/WIRING_DE.md) ersetzen. Drei Berechnungs- und zwei Vorbereitungsausgänge einstellen. Kapazität, Leistungsgrenzen, originalen SOC-Zeitstempel und Sensor-Entitäts-IDs konfigurieren; in beiden API-Nodes den vorhandenen HA-Server auswählen. Automatik an Berechnungsausgang 1 vor der API-Aufbereitung abzweigen. Flow-Tab/Kontext beibehalten und nur einen Schreiber betreiben.

Bei V3/V4 mit reiner Energiehistorie beginnt der Mittelwert mit neuen gültigen Intervallen. Aus dem v5.0.0-Entwicklungsentwurf bleiben beide Historien ohne Rücksetzung erhalten. Der Aufbau benötigt zwei aufeinanderfolgende gültige Wirkungsgradbeobachtungen, keine sieben Tage. Ohne verbleibende gültige Historie oder bei nicht sicher nutzbarem Zustand/Konfiguration/Laufzeit wird Ausgang 1 unbekannt. Vollständigkeitsflags zeigen tatsächliche Intervallabdeckung statt vergangener Aufbauzeit.

Der Betreiber hat den Ersatznode für die SOC-Vorbereitung live getestet. Die synthetische Testsuite behauptet keinen Live-Gesamttest der HA-Anbindung oder siebentägigen Hardwarelauf. Siehe [Prüfung](rolling-efficiency/TESTING_DE.md). Glättung beseitigt keine systematischen SOC-/Kapazitätsfehler und reagiert langsamer auf dauerhafte Änderungen, weil die zugrunde liegende Bilanz bereits sieben Tage umfasst.
