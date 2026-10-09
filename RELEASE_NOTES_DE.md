# SolarFlow Controller v5.1.0

[English](RELEASE_NOTES.md) | **Deutsch**

Release **5.1.0** enthält Berechnungsrevision **5.1**, Energie-Pufferschema **4** und Mittelwert-Schema **1**. Kompatible Energiehistorie und vorhandene V5-Mittelwerthistorie bleiben erhalten.

## Aktuelle Sensoranpassung auf main, Version unverändert

Die aktuellen Importe verwenden direkt die bereitgestellte einfache **ha-sensor**-Vorlage: State = `msg.payload`, Einheit `%`, leere Attribute/Ausgabefelder, Resend/Debug aus und getrennte Entity configs. Ausgang **1** führt zum Mittelwertsensor, **2** zum bisherigen Sensor und **3** zur Diagnose. API-Nodes und Sensor-Aufbereitungsfunktionen entfallen. Diese Sensoren benötigen `hass-node-red` Companion-Integration **1.1.0+** in HA.

Bei bestehender Installation nur [sensor-mean_DE.json](rolling-efficiency/sensor-mean_DE.json) importieren, in dessen Entity config den vorhandenen Server auswählen und Berechnungsausgang 1 anschließen. Bisherigen Sensor samt Entity config an Ausgang 2 beibehalten. Siehe [Anleitung](rolling-efficiency/README_DE.md) und [direkte Verdrahtung](rolling-efficiency/WIRING_DE.md).

Diese Konfigurations-/Dokumentationskorrektur verändert weder VERSION, Berechnungsrevision, Rechen-/SOC-Code noch gespeicherte Historie. Der veröffentlichte Tag `v5.1.0` und vorhandene Release-Downloads bleiben der ursprüngliche API-basierte Stand. Angepasste Dateien liegen auf `main`; kein Tag oder früherer Download wird ersetzt.

## Berechnungsänderungen gegenüber v4.0.0

- Dauerhaften, zeitgewichteten gleitenden **7-Tage-Mittelwert** ungerundeter gültiger Prozentwerte der bisherigen SOC-korrigierten 168-Stunden-Bilanz ergänzen. **Ausgang 1 = Mittelwert, Ausgang 2 = bisheriger Wirkungsgrad, Ausgang 3 = Diagnose.**
- Gültige Mittelwerthistorie bei kurzen SOC-/Quellausfällen verfügbar halten. Aufnahme pausieren und Interpolations-Ausgangspunkt löschen. Zeitabhängigen Ablauf fortsetzen; Abdeckung, Quellgültigkeit und Messwertalter ausweisen. Fehlende Werte ergeben weder 0 % noch gehaltene Intervalle mit erfundener Abdeckung.
- Originalen SOC-Zeitstempel erhalten und standardmäßig verlangen. Vorhandenen gemeinsamen Timer etwa eine Sekunde später nutzen. Keine Tageszählerabfragen oder zusätzlicher periodischer Timer; importierter Inject nur manuell.
- Fehlende-Messung-Warnungen an die Diagnose führen, optional zusätzlich an den bisherigen Sensor. Kein Warnungskabel zum Mittelwert; Watchdog setzt nur den bisherigen Wirkungsgradschlüssel zurück.
- Leistungsintegration, SOC-Korrektur, V3-Übernahme und Ausschlussdiagnose erhalten. Nur Gleitkomma-Überschreitungen innerhalb von 1e-9 Prozentpunkten an exakten 0/100-%-Grenzen auflösen; echte Bereichsüberschreitungen bleiben ungültig.
- **144 automatisierte Tests**, deutsche/englische Gesamt- und Sensorimporte, Installationsanleitungen und Verdrahtungsschemata bereitstellen. GitHub Actions prüft Node.js 22/24 in UTC/Berlin. Neue Versionen werden nach erfolgreichen Main-Tests veröffentlicht; bestehende Releases bleiben erhalten.

## Umstieg und Prüfung

Flow-Tab, Kontextspeicher, Kapazität und beide Historien erhalten; nur eine Berechnung betreiben. V3/V4-Energiehistorie ergibt keine früheren Mittelwert-Messpunkte. Ein neuer Mittelwert benötigt zwei aufeinanderfolgende gültige Wirkungsgradbeobachtungen, keine sieben Tage. Fehlende, abgelaufene oder nicht sicher nutzbare Mittelwerthistorie ergibt null; Vollständigkeitsflags beschreiben gemessene Abdeckung statt vergangener Aufbauzeit.

Der Betreiber meldete den Live-Test des Ersatznodes für die SOC-Vorbereitung. Die synthetische Testsuite behauptet keinen angemeldeten HA-Sensortest oder siebentägigen Hardwarelauf. Siehe [Prüfung](rolling-efficiency/TESTING_DE.md). Glättung beseitigt keine systematischen SOC-/Kapazitätsfehler und reagiert langsamer auf dauerhafte Änderungen, weil die zugrunde liegende Bilanz bereits sieben Tage umfasst.
