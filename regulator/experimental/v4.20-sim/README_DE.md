# Regler V4.20-SIM: nächster Test nach V4.19-Feldlog

[English](README.md) | **Deutsch**

V4.19-SIM wurde in einem rund 20-minütigen Nachtlog an der Anlage beobachtet.
Die Mittenregelung funktioniert: im letzten ruhigen Abschnitt liegt die
Netzleistung im Mittel bei +7,72 W, die mittlere absolute Abweichung von der
Fenstermitte +7,5 W bei 0,79 W. Das Fenster 0 bis +15 W wird dort durchgehend
eingehalten. Die Lastabfälle kehren nach etwa 6 s ins Fenster zurück;
Lastanstiege benötigen noch etwa 28 beziehungsweise 34 s.

**V4.20-SIM ist eine neue simulierte Testvariante. Ihr eigener Anlagentest steht aus.**
Sie ändert nur `centerTrimMaxOutsideStepW` von 6 auf 15 W. Damit kann die
Feinführung den kleinen Importnachlauf knapp außerhalb des Fensters schneller
beseitigen. Im Fenster bleiben maximal 2 W pro Feinänderung, 6 s Wartezeit
und die Mitte ±2 W als HOLD-Bedingung erhalten. Fenster, SOC-Sperren,
Richtungslogik und die vier Function-Ausgänge sind unverändert.

## Dateien

- [Vollständige Function-Datei](Regler_V4_20_SIM.js)
- [Bytegleiche Textdatei zum Kopieren](Regler_V4_20_SIM.txt)
- [Detaillierte Feldtest- und Modellanalyse](Regler_Feldtest_Analyse_DE.md)
- [Aktualisierte Modellparameter](Regler_Modell_V2.json)
- [Reglerparameter und Änderungsumfang](Regler_Parameter.json)
- [Mess- und Simulationsergebnisse](Regler_Feldtest_Ergebnisse.json)
- [Vorherige V4.19-Testversion](../v4.19-sim/README_DE.md)

## Modell und Grenzen

Das angepasste Modell verwendet getrennte Zähler-/Batterie-Empfangszeiten,
richtungsabhängige begrenzte Stellbewegungen, eine Batterietelemetriekennlinie
und episodebezogene effektive Verzögerungen. Die vollständige Kalibrierung
verwendet das gesamte Nachtlog. Ihre geringe Anpassungsabweichung ist keine
unabhängige Validierung zukünftiger Stellfolgen. Reale HTTP-Sende-/ACK- und
Anwendungszeiten sind im Log weiterhin leer; die Hauslast ist rekonstruiert.

In beiden richtigen Logs und acht Modellfällen je Log sinkt die mittlere
absolute Abweichung mit der kleinen Änderung. Im nominalen neuen Modell
verkürzt sich die Rückkehr nach Lastanstiegen um ungefähr 6 s. Die Gesamt-MAE
sinkt dort um etwa 1,5 %. In einem Sensitivitätsvergleich wird eine negative
Nachlaufspitze bis zu 9 W größer. Eine Verbesserung jeder Spitze ist damit
nicht belegt. Größere allgemeine P-/Rampen-Erhöhungen werden nicht empfohlen.

Ruhiger Betrieb liegt nahe einer sinnvollen praktischen Grenze. Für
Lastsprünge ist eine natürliche globale Optimierungsgrenze nicht nachgewiesen:
die erste unbekannte Lastspitze ist kausal unvermeidbar, ein Teil des späteren
Importnachlaufs wird aber durch die Regelparameter verursacht.

![Feldtest V4.19](Regler_Feldtest.svg)

![Angepasstes Modell und simulierte V4.20](Regler_Modellvergleich.svg)

## In Node-RED testen

1. Vorhandene V4.19-Function sichern.
2. Den vollständigen Inhalt der `.txt` oder `.js` in dieselbe Function einsetzen.
   Vier Ausgänge, Verdrahtung und die vorhandenen Flow-Variablen beibehalten.
3. Nachtlastablauf mit etwa 1 kW und 2 kW wiederholen und jeweils ausregeln
   lassen. Anschließend mindestens 30 Minuten ruhigen Betrieb erfassen.
4. Rückkehr ins ursprüngliche Fenster, Gegenspitzen und Fehlerenergie
   vergleichen. Ziel bleibt die tatsächliche Fenstermitte +7,5 W.
5. Den Schreibpfad um echte Sende-/Antwort-/Anwendungszeiten ergänzen, sofern
   die Geräteschnittstelle dies liefert. Die vorhandene Schreiblogik muss dafür
   separat geprüft werden.

Neun Prüfgruppen bestehen, darunter Originalwiedergabe, Gleichheit der
vollständigen V4.20-Datei mit dem Kandidaten in allen 16 Modellfällen sowie
Snapshot-, SOC-, Netzlade- und Ausgangsgrenzen. Beide Logs betreiben nur
PV = 0 W und Entladen. Laden, PV-Sprünge und Richtungs-/SOC-Übergänge sind
damit weiterhin nicht im Feld validiert. Die zusätzliche 2,6-kW-Simulation
prüft nur die Ausgangsbegrenzung.

Das private Reproduktionspaket enthält die beiden richtigen Logs und die
Modell-/Simulationsskripte. Rohlogs und Anlagenexporte werden nicht in dieses
öffentliche Repository übernommen. Diese Reglerrevision ist unabhängig vom
Wirkungsgrad-Release v5.1.0.
