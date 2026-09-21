# Prüfbericht

[English](VALIDATION.md) | **Deutsch**

## Prüfumfang

Die Prüfung bezieht sich auf den bereitgestellten vollständigen Node-RED-Export mit der Abhängigkeit `node-red-contrib-home-assistant-websocket` 0.80.3. Dieser Export enthält die täglichen Lade-/Entladeenergie-Abfragen und den HA-Ausgabesensor, jedoch weder den regelmäßigen Auslöser noch den Knoten zur SOC-Erfassung.

Die Überarbeitung ergänzt zusammengehörige Messzyklen und eine versionierte Intervallbilanz. Der ältere kWh-Ringpuffer der Version 2 und der Live-Tagesstand beziehungsweise Snapshot werden einmalig übernommen. Eine vollständige Sicherung und die Kennzeichnung der Herkunft bleiben erhalten. Neue Intervalle verwenden das überarbeitete Berechnungsverfahren.

## Durchgeführte automatisierte Prüfungen

- Laufzeit: Node.js v24.19.0.
- Zeitzone: Europe/Berlin.
- Befehl im Stammverzeichnis des Repositorys: `TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs`.
- Ergebnis: **41 Tests bestanden; 0 fehlgeschlagen**.

Die Tests führen die tatsächlichen Function-Codes mit simuliertem Node-RED-Kontext, Status-/Fehlerverarbeitung und steuerbarer Uhr aus. Geprüft werden:

- Bekannte Energiebilanz mit 80 % Wirkungsgrad und zeitlich zugeordnete SOC-Korrektur.
- Einstieg während eines Tages ohne Anrechnung früherer, nicht zuordenbarer Energie.
- Ungültige Energie-/SOC-Werte und Typumwandlung ursprünglicher HA-Zustände.
- Einheitenprüfung sowie verpflichtende und optionale SOC-Zeitstempel.
- Umgekehrte Antwortreihenfolge, unvollständige Paare, Duplikate und verspätete Antworten.
- Ablehnung von SOC-Spitzen, Erholung und bestätigtes Festlegen eines neuen Ausgangspunkts.
- Neustart am selben Tag und Wiederherstellung aus einem simulierten älteren, bereits geschriebenen Speicherstand.
- Längere Ausfälle, Mitternachtswechsel, Neustart über Tagesgrenzen hinweg und Rücksetzungsinformationen der Tageszähler.
- Sinkende Zählerstände und unplausible Zählersprünge.
- Kein oder unzureichender Energiedurchsatz sowie Wirkungsgrade außerhalb des gültigen Bereichs ohne Begrenzung auf 0–100 %.
- Herausfallen alter Tage aus dem Sieben-Kalendertage-Fenster und Tagesgrenzen bei Zeitumstellung.
- Beschädigte Zustandsdaten, Konfigurationsänderungen und unveränderte ursprüngliche Altdaten.
- Fehlende Kontextspeicher, SOC-Momentaufnahme im Vorbereitungsknoten und Überwachung ausbleibender Messungen.
- Verweise im exportierten JSON, Verbindungen beider Ausgänge, exakte Übereinstimmung zwischen Function-Code, Quelldatei und Textkopie sowie gemeinsames Ausführen von Vorbereitung und Berechnung.

Zusätzliche Migrationstests prüfen die Wiederverwendung der Historie ab dem ersten Zyklus, den Snapshot als Ersatz, den Vorrang des Live-Standes, einmalige Übernahme trotz Neustart, unbekannte SOC-Grenzen, Sicherung aller Speicherplätze, Datumsfenster, ungültige Altdaten, Wiederherstellung eines nicht überlappenden älteren Abschnitts in einer bestehenden v3-Bilanz und ausdrücklich ausgewiesene Überschneidungen.

## Ergebnisse der Prüfung

Ungültige Eingaben überschreiben keine akzeptierte Energiehistorie. Zusammengehörige aktuelle Zählerstände bilden den Ausgangspunkt für weitere Differenzen. Jede neu aufsummierte SOC-Differenz ist demselben akzeptierten Intervall zugeordnet wie die zugehörigen Energiezähler. Neue Intervalle über nicht rekonstruierbare Rücksetzungen, längere Lücken oder bestätigte SOC-Sprünge werden nicht unbemerkt einbezogen.

Persistente Summen und ihr zugehöriger Ausgangspunkt werden als ein Objekt gespeichert. Die Neustarttests simulieren den Verlust des Arbeitsspeicherkontexts und einen älteren persistenten Speicherstand. Sie prüfen kein reales Dateisystem, keine Datenträgerbeständigkeit und kein tatsächlich abruptes Abschalten.

## Noch nicht an Hardware geprüft

- Import und Deploy mit den genauen Node-RED- und HA-Integrationsversionen der Anlage.
- Tatsächliche Zählereinheiten, Messgrenzen, Rücksetzungsinformationen und Aktualisierungsintervalle.
- Richtige HA-Sensorzuordnung und Umsetzung von null zu Unknown in den installierten Versionen.
- Aktualität der externen SOC-Erfassung und des optionalen Zeitstempel-Schreibknotens.
- Tatsächliche Konfiguration des persistenten Speichers sowie Start-/Stoppverhalten.
- Genauigkeit der Kapazität, SOC-Auflösung, BMS-Neukalibrierung und resultierende Messunsicherheit.

Die Implementierung wurde in einer simulierten Ausführungsumgebung geprüft. Das ist weder eine Hardwareabnahme noch ein Nachweis der Messgenauigkeit. Nimm den vollständigen Flow anhand der [Anleitung](README_DE.md) in Betrieb und beobachte die Diagnose, bevor du dich auf den angezeigten Schätzwert verlässt.

## Prüfung der deutschen Alternative

Dieselben 41 Regressionstests bestehen sowohl für die englische als auch für die deutsche Fassung (82 Testausführungen). Für Deutsch: `EFFICIENCY_LANGUAGE=de TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs`. Zusätzlich bestehen drei Sprachversionsprüfungen mit `node --test round-trip-efficiency/tests/localization.test.cjs`: identischer ausführbarer Rechenkern, deutsche Diagnose-/Statusmeldung bei unverändertem technischem Code sowie gleiche Verbindungen und Entitätsreferenzen. Insgesamt 85 bestandene Testausführungen. Die Live-Prüfung steht weiterhin aus.
