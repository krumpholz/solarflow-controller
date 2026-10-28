# V4.31-SIM-ZERO6-TEST: Last-/PV-Deltas nur beobachten

Gezielte PackState-Testfassung vom 28.10.2026. [Analyse Log25](Analyse_Log25_DE.md).

ZERO5-TEST hielt 23 W ausgehend von −18 W und erreichte +4…+5 W. Nach zehn Sekunden beendete jedoch die zusätzliche Hausdelta-Schwelle von 25 W den Versuch: abgeleitete Hausleistung +53 W gegenüber Start, bei weiterhin regulären Anforderungen 0/0 W. PackState blieb Entladen; Restentladung kam zurück.

## Änderung gegenüber ZERO5-TEST

**Reine PV-/Lastabweichungen beenden diesen Test nicht mehr.** Die früheren 15-/25-W-Schwellen dienen nur noch der Diagnose. Ein erneuter kurzer Abbruch allein durch diese Schwellen entfällt. Keine Änderung der normalen PI-Parameter oder Fenster.

Unverändert:

- Start nur bei aktiver Regelung, regulärem 0/0-W-Bedarf, bestätigtem AC-Modus Ist=1 und sechs Sekunden frisch gemessener Batterie ≤−10 W.
- Startauftrag einmalig `min(100, ceil(abs(negative Batterieleistung)+5))` W, beispielsweise −18 W →23 W; Wert festhalten.
- Kein Zeitlimit, kein Taktlimit, kein Abbruch bei erster gemessener Leistung ≥−3 W.
- Rücknahme bei gültigem PackState-Wechsel vom bei Beginn erfassten Entladen (2) auf Laden (1) oder Standby (0). Danach acht Sekunden 0 W und keine Wiederholung derselben Episode.
- OFF/Netzladen/Ladesperre bzw. volle Batterie, Verlust frischer Batterie-Rückmeldung oder von AC-Modus Ist=1 behalten Vorrang.
- Neue positive Entladeanforderung oder deutlicher regulärer Ladebedarf übernehmen. Kleine berechnete Ladeanforderungen bis Testauftrag+15 W werden als mögliche eigene Rückwirkung behandelt und durch den Testauftrag ersetzt; damit kann eine kleine echte Überschussladung während des länger laufenden Tests verzögert werden.
- Während Test/Abklingen bleiben reguläre Sollwerthistorie und Integratoren bei 0, damit keine eigene Kleinladung dauerhaft in HOLD verriegelt wird.

**Test beobachten. Ohne PackState-Wechsel oder anderen Vorrang kann die Anforderung bestehen bleiben. Regler ausschalten beendet sie mit 0 W.** Bei ungültigem Snapshot/Laufzeitfehler weiterhin keine neuen Stellnachrichten, aber Diagnose; das Gerät kann den letzten Auftrag halten. Kein autonomer Watchdog.

## Einbau

Nur Regler-Function-Code aus `Regler_V4_31_SIM_ZERO6_TEST.txt` ersetzen oder den einzelnen Function-Node aus `NodeRED_Regler_V4_31_SIM_ZERO6_TEST_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge von oben: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. AC-Richtungsnode, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben. Neuer Kontext `regler_zero_idle_pulse_v431` ermöglicht den neuen Versuch trotz abgeschlossenem ZERO5-Test.

## Diagnose und nächster Log

`behaviorVersion=4.31-SIM-ZERO6-TEST`. Zusätzlich unter `zeroPowerIdle`:

- `signalChangeAbortEnabled=false`;
- `signalChangeObserved`: frühere Schwelle überschritten, ohne Abbruch;
- `solarDeltaSincePulseStartW`, `houseDeltaSincePulseStartW`: Abweichungen, bei nicht bestehender Episode `null`;
- unverändert Startwert, gehaltener Auftrag, PackState, Versuchsdauer und erster Leistungsnullpunkt.

`pulseElapsedMs` läuft während des Versuchs und friert beim erfolgreichen bzw. signalbedingten Ende mit `pulseStoppedTs` ein. Zeitgrenze/Frist bleibt `null`. Neue normale Leistungsphase bzw. OFF setzt die Episode zurück; dann kann die Dauer nicht mehr als fortlaufender Versuchsdatensatz gelesen werden.

Aufzeichnen, bis PackState wechselt oder der Versuch bewusst beendet wird. Nach Wechsel/Rücknahme weiter beobachten: bleibt die Restentladung weg? Der bisherige gesamte Log25 dauert 62 Sekunden, aber der eigentliche Auftrag nur zehn Sekunden. Eine PackState-Verzögerung lässt sich daraus nicht kalibrieren.

## Prüfung

23 gezielte Offline-Testgruppen bestanden. Wiedergabe der Originalversion auf Log25 reproduziert 32/32 Leistungsanforderungen exakt. Die neue Fassung hält unter den fest aufgezeichneten Eingängen über die alte Abbruchstelle hinaus; keine Vorhersage der dann veränderten Anlage. Deaktivierter Testauftrag: 5.324 historische Regelaufrufe unverändert gegenüber ZERO1, 66 Diagnose-Abbrüche ohne Stellnachrichten. Anlagenwirkung weiterhin offen; Modell V16 unverändert.

```sh
node --test tests/pack-test.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
node tests/private-log25.cjs /pfad/zum/simulationsordner
```

Die beiden Replay-Skripte benötigen private Logs und vorhandene Simulationsdateien; Rohlogs werden nicht veröffentlicht.
