# Prüfung — Veröffentlichungskandidat Revision 3.3

[English](VALIDATION.md) | **Deutsch**

## Automatisierte Prüfungen

Vom Repository-Hauptverzeichnis mit Node.js ausführen:

```sh
TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
EFFICIENCY_LANGUAGE=de TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
node --test round-trip-efficiency/tests/localization.test.cjs
```

**47 Tests je Sprache plus 3 Sprachprüfungen: 97 erfolgreiche Testausführungen, keine Fehler.** Die echten Funktionskörper laufen mit kontrollierter Zeit und simulierten Node-RED-Speichern. Entfallene v2-Importtests wurden durch Prüfungen des leeren Starts und der v3-Kompatibilität ersetzt. Persönliche Verlaufsdaten sind nicht in den Testdaten enthalten.

Geprüfte Fälle:

- Neuinstallation ignoriert v2-Ring-/Live-/Snapshot-Schlüssel und erstellt kein Migrationsbackup; gültige Ergebnisse entstehen bereits mit einem Tag berücksichtigter Intervalle.
- Vorhandene v3-Historie, SOC-Korrekturen und Metadaten bleiben bei Neustarts ohne erneuten Import oder wiederholte Addition erhalten und fallen nach Kalendertagen heraus.
- Bestehender v3-Zustand ohne optionale Energietoleranz erhält diese an Ort und Stelle.
- Bekannte Energiebilanz, passende SOC-Korrektur, ungültige Eingaben, Einheiten und Zeitstempelgrenzen.
- Reihenfolge der Messpaare, doppelte/unvollständige Zyklen, verspätete Antworten, Überwachung sowie Übereinstimmung von Exportverdrahtung und Quellen.
- SOC-Spitzen, bestätigte neue Ausgangspunkte, Neustart, ältere gespeicherte Zwischenstände, Ausfälle, Tagesrücksetzung und Zeitumstellung.
- Verzögerte minutenweise/grobe Zähleraktualisierungen, unabhängige Richtungen, wiederholt überhöhte Zuwächse, spätere Übernahme, fallende Zähler und begrenzte Behandlung dauerhafter Sprünge.
- Beschädigter Zustand, geänderte Konfiguration, fehlender Energiedurchsatz, ungültiger Ergebnisbereich und Siebentagefenster.
- Identischer ausführbarer Rechenkern beider Sprachen, deutsche Diagnosen und gleiche Graph-/Entitätsreferenzen.

Das optionale Home-Assistant-YAML wird auf Syntax geprüft; Vorzeichen- und Verfügbarkeitslogik der Templates wurden manuell geprüft (nicht in HA ausgeführt). Dies ersetzt kein Laden in eine echte HA-Installation. Eine echte Leistungsquelle und geprüfte Entitäts-IDs sind erforderlich. Es wird nicht behauptet, dass der Node-RED-Import diese Eingaben anlegt.

## Verbleibende Live-Prüfungen

Für frühere Revisionen liegen einzelne Nutzerrückmeldungen vor. Für Revision 3.3 steht die geplante Deploy-/Log-Prüfung noch aus. Tatsächliche HA-, Websocket- und Begleitintegrationsversionen, Einheiten/Rücksetzungsmetadaten, Quellenaktualisierung, Entitätszuordnung, Ausgabe Unbekannt bei null, SOC-Erfassung, Kontextpersistenz, Mitternacht und Neustart prüfen. Neustartsimulationen testen keine echte Datenträgerbeständigkeit. Kapazität, SOC-/BMS-Verhalten und Messgrenzen bestimmen die Messunsicherheit.

Die Inbetriebnahmeschritte stehen in [README_DE.md](README_DE.md). Dies ist ein Bericht über simulierte Implementierungsprüfungen, keine Hardwareabnahme oder Zertifizierung der Wirkungsgradgenauigkeit.
