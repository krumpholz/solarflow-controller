# Änderungshistorie

[English](CHANGELOG.md) | **Deutsch**

## Noch nicht als Release veröffentlicht

### Geändert

- Veröffentlichungskandidat Revision 3.3: automatische v2-Historienübernahme entfernt; Neuinstallationen beginnen leer, vorhandener v3-Zustand bleibt kompatibel. Persönliche Historie in Regressionstests durch synthetischen Zustand ersetzt. Zweisprachige Einbauanleitungen mit externen Variablen, HA-Eingabesensoren, SOC-Erfassung, Ausgabeintegration und abschließenden Deploy-Prüfungen überarbeitet; optionales YAML für Energie-Helfer ergänzt. 47 Regressionstests je Sprache und drei Sprachprüfungen bestanden.

- Nachgestellten Zusatz „geschätzt“ im Function-Status beider Sprachversionen entfernt; Berechnung, Start mit Teilpuffer und Aussagegrenzen erläutert. Berechnungsrevision bleibt 3.2.

- Berechnungsrevision 3.2: dauerhaft gespeicherte, begrenzte Energietoleranz für verzögerte/gerundete HA-Aktualisierungen (2400 W, 20 % Reserve, 120 Sekunden Meldetoleranz, angenommene Auflösung 0,1 kWh). Auffällige Zuwächse ohne Verlust des Ausgangspunkts zurückstellen; echte Abfrageausfälle unterscheiden, Rücksetzungen prüfen, SOC-Zeitstempel bis 120 Sekunden zulassen. Vorhandene Historie bleibt erhalten. 55 Regressionstests je Sprache und drei Sprachprüfungen bestanden.

- Berechnungsrevision 3.1: Historische SOC-Korrektur wieder anhand der Fenstergrenzen; neue Intervalle bleiben unverändert. Vorhandener migrierter Puffer wird weiterverwendet. Historische Unsicherheiten werden ausdrücklich angezeigt. 44 Regressionstests je Sprache und drei Sprachprüfungen bestanden.

- Vorhandene Wirkungsgrad-Historie bleibt durch einmalige Übernahme des v2-Ringpuffers, Live-Tagesstands und Snapshots erhalten. Ergänzt wurden eine vollständige Sicherung der Originaldaten sowie Schutz vor Doppelzählungen und Überschneidungen.
- Regressionstests auf 41 bestandene Tests erweitert, einschließlich einmaliger Migration trotz Neustart.

### Hinzugefügt

- Separate deutsche Flow-Alternative mit ursprünglichen Knotennamen, deutschen Status-/Fehlermeldungen und reproduzierbarer Erzeugung aus dem englischen Rechenkern; 85 erfolgreiche Testausführungen über beide Sprachen und zusätzliche Sprachprüfungen.

- Vollständige deutsche Zweitfassungen der Projektbeschreibung, Einbau- und Migrationsanleitung, des Prüfberichts und der übrigen Projektdokumentation, jeweils mit gegenseitigen Sprachverweisen.
- Version 3 der SOC-korrigierten Wirkungsgrad-Auswertung: zusammengehörige Messpaare, intervallbasierte Energie-/SOC-Bilanz, automatische persistente Speicherung, vorsichtiger Umgang mit Rücksetzungen und Lücken sowie ausdrücklich als ungültig markierte Ergebnisse.
- Importierbarer englischer Node-RED-Auswertungsflow, Einbauanleitung und Regressionstests mit simuliertem Kontext.
- Bisheriger Downloadpfad der Textdatei mit aktualisiertem Function-Code beibehalten; der vollständige Flow muss aktualisiert werden.
- Anfängliche englische README mit Projektumfang und aktuellem Veröffentlichungsstand.
- MIT-Lizenz entsprechend der Lizenzwahl des zugehörigen BLE-Controllers.
- Hinweise zur Unabhängigkeit, zu Markenrechten und zur Betriebsverantwortung.
- Hinweise zur Mitarbeit sowie Ausschlüsse für lokale Zugangsdaten und erzeugte Dateien.

Der eigentliche Regelungsflow wurde in diesem Repository noch nicht veröffentlicht.
