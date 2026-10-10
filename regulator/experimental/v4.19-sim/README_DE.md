# Regler V4.19-SIM – Test an der Anlage steht aus

[English](README.md) | **Deutsch**

Vollständiger anlagenspezifischer Node-RED-Funktionscode, abgeleitet aus V4.18 und dem Nachtlog vom 10.10.2026. Die Auswahl ist im Modell geprüft, aber noch nicht an der Anlage bestätigt. Reglerrevision 4.19-SIM ist unabhängig von der Versionsnummer der Wirkungsgradberechnung.

## Dateien

- [Regler_V4_19_SIM.js](Regler_V4_19_SIM.js): vollständiger Funktionsinhalt.
- [Regler_V4_19_SIM.txt](Regler_V4_19_SIM.txt): identischer Inhalt als Textdatei zum Öffnen, Speichern und Kopieren.
- [Regler_Analyse_DE.md](Regler_Analyse_DE.md): vollständige Analyse und Modellgrenzen.
- [Regler_Parameter.json](Regler_Parameter.json): ausgewählte Simulationsparameter.
- [Messdaten](Regler_Messdaten.svg) und [Simulationsvergleich](Regler_Simulation.svg).

## Änderungen gegenüber V4.18

- Die Feinregelung führt die letzte ausgegebene Anforderung zur eigenen Fenstermitte. HOLD setzt zusätzlich eine Mittenabweichung von höchstens 2 W und frische, nachgeführte Batterietelemetrie voraus. Im ausgewerteten Entladefenster 0 bis +15 W liegt die Mitte bei +7,5 W.
- Bei PV bis 50 W steigt die normale Entlade-Aufwärtsrampe von 300 auf 1.200 W je Regeltakt; der normale P-Anteil beträgt dort 0,80.
- Bei einer großen noch ausstehenden Batteriereaktion hält der Regler die letzte Anforderung bis zu 6 s, statt denselben Import wiederholt nachzukorrigieren.
- Starker Export erhält unter einer Tracking- oder Bestätigungsbedingung P = 1,00. Kleine Fehler werden höchstens um 2 W im Fenster beziehungsweise 6 W nahe außerhalb korrigiert, frühestens 6 s nach der letzten Änderung.
- Die Optimierung ist auf PV bis 50 W begrenzt. Beobachtet wurde nur 0 W. Oberhalb davon bleiben die ursprünglichen Lade- und Entladepfade aktiv; Fenstergrenzen, SOC-Sperren und Richtungslogik bleiben erhalten.

Im nominalen Modell sinkt die mittlere absolute Mittenabweichung von 43,60 auf 32,88 W. Import- und Exportenergie sinken ebenfalls. Der Zeitanteil im ursprünglichen Fenster fällt jedoch von 83,24 auf 81,56 %, weil kleine Grenzüberschreitungen durch die vorsichtige Feinführung länger bestehen können. Das sind bedingte Simulationsergebnisse; der Anlagentest steht aus.

## In den vorhandenen Node einsetzen

1. Den bestehenden Regler-Node oder Flow als Rückkehrmöglichkeit exportieren.
2. Den gesamten Function-Inhalt durch die JS- oder TXT-Datei ersetzen. Den vorhandenen Flow-Tab, Snapshot-Eingang und Kontext beibehalten.
3. Vier Ausgänge und die vorhandene Verdrahtung beibehalten: **1 Richtung, 2 Laden W, 3 Entladen W, 4 Status**. Keinen zusätzlichen periodischen Regler starten.
4. Deployen und zunächst den Nachtbetrieb mit PV nahe 0 W beobachten. Im Status muss Version `4.19-SIM` erscheinen; die Mitte wird weiterhin aus den vorhandenen Fenstergrenzen berechnet.

Diese Datei ist kein eigenständiger Flow-Import. Sie benötigt die anlagenspezifischen Mess-Snapshots, Freigaben, SOC-/Richtungszustände und den vorhandenen Schreibpfad des V4.18-Nodes.

## Nächster Test

Den bisherigen Lastablauf mit einer Last von ungefähr 1 kW und anschließend ungefähr 2 kW jeweils ein- und ausschalten; zwischen den Wechseln ausregeln lassen. Danach mindestens 30 Minuten ruhigen Nachtbetrieb erfassen. Zählerleistung, Batterietelemetrie, Sollwerte, Fenstergrenzen, HOLD und den neuen `centerTrim`-Status mitschreiben. Falls im Schreibpfad verfügbar, zusätzlich HTTP-Sendezeit, Antworten und angewendete Sollwerte erfassen.

Verglichen werden Zeit und Energie bis zur Rückkehr ins Fenster, zusätzliche Gegenspitzen nach dem ersten Lastimpuls sowie Mittelwert und Streuung um +7,5 W im ruhigen Betrieb. Ladebetrieb und PV-Sprünge benötigen eigene Logs. Die erste Spitze eines unbekannten Lastsprungs lässt sich wegen der Mess- und Stellverzögerung nicht vollständig verhindern.

Die 525 Originalpunkte wurden exakt reproduziert, und 14 Prüfgruppen bestanden einschließlich Vergleich des finalen Codes mit dem Kandidaten in fünf Modellvarianten. Das ist keine Feldtestbestätigung. Private Rohlogs und Anlagenexporte werden nicht veröffentlicht.
