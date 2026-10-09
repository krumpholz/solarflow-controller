# SolarFlow Controller v5.0.0 — vorbereitete Veröffentlichung

[English](RELEASE_NOTES.md) | **Deutsch**

## Änderungen gegenüber v4.0.0

- Zeitgewichteten gleitenden **7-Tage-Mittelwert** der bisherigen SOC-korrigierten 168-Stunden-Energiebilanz ergänzt. Ungerundete gültige Prozentwerte werden mit tatsächlichen Zeitabständen linear integriert. Erst die Ausgabe wird auf eine Nachkommastelle gerundet.
- **Drei Ausgänge in neuer Reihenfolge:** 1 = Mittelwert, 2 = bisheriger Wirkungsgrad, 3 = Diagnose. Der Import enthält einen neuen HA-Mittelwertsensor. Die bisherigen Sensor-IDs und der Kontextschlüssel des bisherigen Wirkungsgrads bleiben erhalten.
- Begrenzte Minutenaggregate und Mittelwert-Ausgangspunkt werden im vorhandenen dauerhaften V4-Zustand gespeichert. Energiehistorie, V3-Übernahme und Ausschlussdiagnose laufen weiter; der Prozentmittelwert beginnt beim Update mit neuen Beobachtungen.
- Ungültige Messungen werden aus beiden Historien und ungültige Wirkungsgradwerte aus dem Mittelwert ausgeschlossen; Fehler und Watchdog-Timeout setzen beide Ausgabewerte zurück. Keine Fortschreibung eines alten Wertes über eine Ausfallzeit.
- Gleitkomma-Überschreitungen an exakten 0/100-%-Grenzen mit 1e-9 Prozentpunkten Rechentoleranz korrigiert. Tatsächlich unplausible Ergebnisse bleiben ungültig.
- Mittelwertabdeckung, bisherige Aufbauzeit und Vollständigkeit des Fensters ausgewiesen. Die älteste angeschnittene Minute wird wie im Energiepuffer gleichmäßig gewichtet.
- Automatisierte Regressionstests erweitert und eine GitHub-Actions-Matrix für reproduzierbaren Build sowie UTC/Berlin ergänzt. Beide Sprachfassungen und Import-Flows werden aus dem zentralen Rechenkern erzeugt.

## Umstieg

Die [Anleitung](rolling-efficiency/README_DE.md) beachten. Die Berechnungsfunktion auf drei Ausgänge stellen und den bisherigen Sensor auf **Ausgang 2**, die Diagnose auf **Ausgang 3** umstecken. **Ausgang 1** liefert den neuen Mittelwert. SOC-/Watchdog-Code ersetzen und dessen Warnungsausgang mit beiden Sensoren und der Diagnose verbinden. Kapazität, Flow-Tab und Kontext erhalten; nur eine Berechnung betreiben.

Release v5.0.0 verwendet Berechnungsrevision **5.0**, Energie-Pufferschema **4** und ergänztes Mittelwert-Pufferschema **1**. Die geänderte Ausgangsreihenfolge begründet den Sprung der Hauptversion. Aus den bisherigen Energiesummen lässt sich kein zuverlässiger historischer Prozentmittelwert rekonstruieren.

Der Mittelwert beginnt nach zwei aufeinanderfolgenden gültigen Wirkungsgradbeobachtungen und wächst danach auf volle sieben Tage. `mean_window_complete` erfordert 168 Stunden gültig abgedeckter Zeit innerhalb des jüngsten 168-Stunden-Fensters. Die Glättung dämpft kurzfristige Schwankungen, behält aber systematische SOC-Fehler und reagiert langsam auf dauerhafte Änderungen: Gemittelt wird eine Bilanz, die selbst bereits sieben Tage umfasst.

Dieses Release ist zur Prüfung vorbereitet; ein abgeschlossener Siebentage-Feldtest wird damit nicht behauptet. Die synthetischen automatisierten Regressionstests sind in [TESTING_DE.md](rolling-efficiency/TESTING_DE.md) dokumentiert. Historische Übernahme und Minutengrenzen-Gewichtung bleiben Näherungen; die Kennzahl bleibt eine SOC-korrigierte Energiebilanz.
