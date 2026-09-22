# Änderungshistorie

## 4.0 — Gleitende Leistungsintegration

- `rolling-efficiency/` ergänzt die Leistungsintegration über gleitende 168 Stunden.
- Richtungswechsel und Minutengrenzen getrennt integrieren; anteilige Gewichtung der ältesten angeschnittenen Minute ausweisen.
- Passenden V3-Zustand einmalig einschließlich vorhandener Legacy-SOC-Korrekturen übernehmen; historische Tagessummen zeitanteilig auslaufen lassen.
- V3-Puffer und vorhandene Schnittstelle zum Ausgabesensor erhalten.
- Funktionscode, Flows und Anleitung auf Deutsch und Englisch bereitstellen.


[English](CHANGELOG.md) | **Deutsch**

Die folgenden Revisionen beziehen sich auf die Wirkungsgradberechnung, nicht auf die separat gepflegte BLE-Firmware. Das dauerhafte Zustandsschema bleibt Version 3.

## 3.3

- Neuinstallationen beginnen mit dem ersten gültigen Messpaar; automatische v2-Historienübernahme entfernt.
- Bestehender v3-Zustand bleibt kompatibel, einschließlich Auswertung bereits gespeicherter historischer Datensätze bis zu deren Ablauf.
- Deutsche und englische Flows, Einbauanleitungen, Übersicht externer Variablen und optionales YAML für HA-Energiesensoren.
- Kompakter Function-Status ohne nachgestelltes „geschätzt“; Berechnungsannahmen stehen in der README.
- Repository-Übersicht und Begleitdokumentation beschreiben die enthaltene Auswertung und ihre tatsächlichen Voraussetzungen.

## 3.2

- Dauerhaft gespeicherte, begrenzte Toleranzen für verzögerte und gerundete HA-Energieaktualisierungen.
- Vorgaben: 2,4 kW, 20 % Reserve, 120 Sekunden Meldetoleranz und 0,1 kWh Auflösungstoleranz.
- Auffällige Zählerzuwächse ohne Fortschreiben des akzeptierten Ausgangspunkts zurückstellen; Abfrageausfälle und bestätigte Rücksetzungen unterscheiden.
- Zulässiges SOC-Zeitstempelalter von 120 Sekunden.

## 3.1

- SOC-Korrektur anhand der Fenstergrenzen bereits übernommener Historie; neue Messintervalle behalten ihre Bilanzierung.
- Ausdrückliche Diagnose historischer SOC-Grenzdifferenzen und Unsicherheit.

## Erste v3-Implementierung

- Zusammengehörige Messzyklen, passende Energie-/SOC-Intervalle und automatischer dauerhafter Zustand.
- Deutsche/englische Oberflächen und Dokumentation; MIT-Lizenz und Hinweise zur Unabhängigkeit.
- Der anfängliche v2-Import wurde mit Revision 3.3 entfernt.
