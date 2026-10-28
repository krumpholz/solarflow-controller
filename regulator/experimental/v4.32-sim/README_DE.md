# V4.32-SIM-IDLE2: dynamisch gemessene Ruhekompensation mit Zehn-Minuten-Prüfung

28.10.2026. [Auswertung Log26](Analyse_Log26_DE.md). ZERO6 hielt23W und maß durchgehend+5W, PackState blieb über die protokollierten zwei Minuten Entladen. Die neue Fassung ersetzt den Umschaltversuch durch gemessene Kompensation. **Kein fester18W-Wert, kein5W-Reserveaufschlag, keine PackState-Abbruchbedingung.**

## Messung und Ausgleich

Nur wenn der normale Regler gültig 0W Laden und0W Entladen berechnet und AC-Modus Ist1 sowie frische Batteriemessung vorliegen:

1. Lade-/Entladeauftrag0/0W ausgeben. **8 Sekunden einschwingen lassen.**
2. Danach vier frische Messungen aus verschiedenen Regeltakten erfassen. Bei normalem2s-Takt liegen sie ungefähr bei8/10/12/14s nach Beginn. Median der vier Werte, also Mittel der beiden mittleren Werte, bilden.
3. Bei negativem Median dessen Betrag laden: `min(100, max(0, round(-Median)))` W. Beispiel−18W→18W. Bei0W oder positivem Median0W. Keine Totzone oder Reserve; auf ganze Watt runden, weil die vorhandenen Stellnachrichten ganzzahlig sind. Die100W-Sonderfallgrenze bleibt erhalten, Begrenzung wird diagnostiziert.
4. Diesen Wert halten. Gemessene0W **während** der Kompensation sind deren gewünschte Wirkung und löschen den Auftrag nicht.
5. Nach jeweils **600 Sekunden ab Ende der letzten Messung** am nächsten gültigen Aufruf wieder0W ausgeben. Erneut8s warten und vier Werte messen. Ist ohne Kompensation jetzt0W erreicht, bleibt die nächste Phase bei0W; bleibt Restentladung, wird ihre aktuelle Höhe übernommen. Auch eine0W-Phase wird nach zehn Minuten neu geprüft.

Die reguläre Prüfung unterbricht die Kompensation bei normalem Takt etwa14 Sekunden. Einschwing- und Probenzeit sind eine nachvollziehbare Wahl auf Basis der bislang beobachteten Stellreaktion, noch keine separat live validierte universelle Anlagenzeit. Bei einer Aufruf-/Messlücke über3s während der Prüfung beginnt die Einschwingphase neu; alte und neue Proben werden nicht vermischt. Ein doppelter Aufruf desselben Regeltakts zählt nicht als zweite Probe.

## Vorrang der normalen Regelung

Jede normale positive Lade- oder Entladeanforderung hat sofort Vorrang, auch kleine Ladeleistungen. Die alte Echo-Unterdrückung bis Auftrag+15W entfällt. Eine unterbrochene Ruheepisode wird verworfen; beim nächsten0/0W-Bedarf beginnt eine neue0W-Messung. Der Zehn-Minuten-Termin ist damit an eine ununterbrochene Ruheepisode gebunden.

OFF, Netzladen und volle Batterie/Ladesperre behalten unverändert Vorrang. Ohne bestätigten AC-Modus Ist1 oder ohne frische Batteriemessung keine Kompensation; bei frischer Rückkehr neu messen. Entladesperre bzw. Mindest-SOC sind keine Ladesperre. PV-/Hausänderungen werden nicht allein zu Abbruchgründen, solange der normale Bedarf weiter0/0W beträgt. PackState bleibt nur Diagnose.

Während übernommener Ruhephasen bleiben normale Sollwerthistorie und Integratoren0. Die zusätzliche Ladeanforderung wird nicht als gewöhnliche PI-Ladeleistung gespeichert. Die Strategie schätzt einen Offset und hält ihn; sie integriert nicht im2s-Takt die eigene Leistungsrückwirkung.

## Anzeige und Diagnose

`behaviorVersion=4.32-SIM-IDLE2`. `mode` und der Node-Status zeigen die tatsächlich ausgeführte Aktivität:

- `RUHEPRUEFUNG`:0W anfordern, einschwingen/messen;
- `RUHEKOMPENSATION`: gemessenen negativen Offset ausgleichen;
- `RUHE_0W`: ohne Ausgleich gemessene0W oder positive Grundmessung.

`logicalMode` hält die interne Richtungsentscheidung getrennt fest. `batteryStatus.batt_packState` bleibt unveränderte Geräte-Rückmeldung; er wird nicht künstlich auf Laden umgeschrieben.

Neu `idleCompensation`: Phase (`inactive`/`probe`/`compensate`), aktueller Grund, Median, vier Messwerte, Probenanzahl, geschätzte/angeforderte Leistung, Begrenzung, Prüfbeginn und nächster Termin. `regularOutputs` und `regulatorMemoryOutputs` trennen regulären Bedarf von tatsächlichen `outputs`. Bei Probe bzw. ohne Ausgleich kann `active=false` sein, obwohl `ownsIdleOutputs=true` die Mess-/Ruhephase anzeigt. `zeroPowerIdle.pulseActive=false` dokumentiert das Ende der alten Impulsstrategie.

Bei verworfenen Snapshots/Laufzeitfehlern bleiben wie bisher alle Stellnachrichten aus und nur Diagnose wird ausgegeben. Die Diagnose zeigt den zuletzt vorbereiteten Zustand, keine Gerätebestätigung. Ohne gültige Regleraufrufe gibt es keine autonome Zehn-Minuten-Abschaltung; die Prüfung beginnt erst beim nächsten gültigen Aufruf. Eine solche Verzögerung ist von der realen Geräteübernahme zusätzlich zu unterscheiden.

## Einbau und Live-Prüfung

Nur Regler-Function-Code aus `Regler_V4_32_SIM_IDLE2.txt` ersetzen oder `NodeRED_Regler_V4_32_SIM_IDLE2_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. Richtungsnode, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben.

Beim Einsetzen während des bisherigen23W-Auftrags gibt die neue Fassung zunächst0W aus und misst neu. Sie übernimmt weder23W noch fest18W aus altem Kontext. Im Log mindestens den Start, die vollständige erste Messung und eine Zehn-Minuten-Prüfung samt anschließender Reaktion erfassen. Sollprüfung:0W→Restentladung messen→passender Ausgleich→Batterie nahe0W→nach zehn Minuten0W-Messung→Ausgleich beibehalten, ändern oder entfernen.

## Offline-Prüfung

23 gezielte Testgruppen bestanden: unterschiedliche Offsets, Median, Übergang aus laufenden23W, periodische Prüfung bei weiter−18W/neuen−24W/natürlichen0W, Probenlücken, doppelte Takte, alle bisherigen Vorränge, Fehler und Importgleichheit. Ein einfacher synthetischer Prüfstand mit sechs Sekunden Stellverzögerung prüft die vollständige Folge von23W/+5W über18W/0W bis zum Wegfall der Grundentladung und periodischer Entfernung der Kompensation. Dies bestätigt die Logik unter dieser Modellannahme, keine reale Anlagenreaktion.

Bei deaktivierter Ruhekompensation:5.324 historische ausgeführte Aufrufe unverändert gegenüber ZERO1,66 Diagnose-Abbrüche weiterhin ohne Stellnachrichten. ModellV16 bleibt unverändert.

```sh
node --test tests/idle-compensation.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```
