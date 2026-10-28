# V4.30-SIM-ZERO5-TEST: PackState beobachten, ohne Zeitgrenze

Gezielte Testfassung vom 28.10.2026. [Analyse des Kurzlogs 24](Analyse_Log24_DE.md): ZERO4 gab bei −18 W korrekt 23 W Laden aus, nahm aber bereits nach sechs Sekunden wegen gemessener +5 W zurück. PackState blieb Entladen, die Restentladung kehrte zurück. Die 60-s-Frist war nicht der Abbruchgrund.

## Änderungen für diesen Test

- Dynamischer Startauftrag unverändert: Betrag der frischen Restentladung +5 W, auf ganze Watt aufrunden, maximal 100 W. −18 W → 23 W. Startwert während des Versuchs halten.
- **Keine 60-s-Frist und kein Taktlimit.**
- **Kein vorzeitiges Beenden bei Leistungsnullpunkt.** Sonst würde der Log24-Abbruch weiterhin nach sechs Sekunden auftreten. Leistungsnullpunkt ≥−3 W wird nur protokolliert.
- Erfolgreiche Rücknahme bei gültigem PackState-Wechsel vom bei Beginn erfassten Entladen (2) auf Laden (1) oder Standby (0). Danach acht Sekunden 0-W-Abklingen, keine automatische Wiederholung derselben Episode.
- Test gezielt beobachten. Ohne Statuswechsel oder anderen Abbruchgrund bleibt der kleine Auftrag bestehen. Regler ausschalten beendet den Auftrag mit 0 W. Keine autonome Zeitabschaltung.

Start weiterhin nur bei regulärem 0/0-W-Bedarf, bestätigtem AC-Modus Ist=1 und mindestens sechs Sekunden frisch gemessener Restentladung ≤−10 W. Ein bereits vor Versuchsbeginn gemeldeter PackState Laden gilt nicht als neuer Wechsel. Neuer Kontext `regler_zero_idle_pulse_v430` ermöglicht den neuen Versuch nach ZERO4.

## Vorrang bleibt erhalten

OFF, volle Batterie/Ladesperre, Netzladen und neuer normaler Leistungsbedarf haben Vorrang. Positive Entladeanforderung übernimmt sofort. Verlust frischer Batterie-Rückmeldung oder von AC-Modus Ist=1 beendet den Versuch. PV-Änderung >15 W oder Änderung der abgeleiteten Hausleistung >25 W gegenüber Start führt weiterhin in die Null-Abklingphase. Diese Gründe können den Test auch ohne PackState-Wechsel beenden; `pulseStopReason` prüfen.

Kleine regulär berechnete Ladeanforderungen bis zum gespeicherten Versuchswert+15 W gelten während Versuch/Abklingen als mögliche eigene Rückwirkung. Sie werden durch den Testauftrag ersetzt, danach durch 0 W. Größerer regulärer Ladebedarf übernimmt. Bei langem Test kann dies eine kleine echte Überschussladung länger verzögern. Normale Sollwerthistorie bleibt 0 W, Integratoren werden zurückgesetzt; der künstliche Auftrag wird nicht als Dauerladung in HOLD gespeichert.

Bei verworfenem Snapshot/Laufzeitfehler unverändert keine Stellnachrichten, aber Diagnose. Das Gerät kann dann den letzten Auftrag halten. Bei Wiederkehr gültiger Daten entscheidet PackState bzw. einer der übrigen Abbruchgründe; es gibt in dieser Testfassung keine nachträgliche Frist-Rücknahme.

## Einbau

Nur den Regler-Function-Code aus `Regler_V4_30_SIM_ZERO5_TEST.txt` ersetzen oder den einzelnen Function-Node aus `NodeRED_Regler_V4_30_SIM_ZERO5_TEST_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. AC-Richtungsnode, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben.

## Diagnose für den nächsten Log

`version=4.30-SIM`, `behaviorVersion=4.30-SIM-ZERO5-TEST`. Unter `zeroPowerIdle`:

- `testOnly=true`, `pulseTimeoutEnabled=false`, `batteryPowerEarlyStopEnabled=false`;
- Zeitgrenze/Restzeit/Frist `null` statt irreführender 0-Sekunden-Frist;
- `pulseStartedTs`, `pulseStoppedTs`, `pulseElapsedMs`: Laufzeit bis jetzt bzw. bis zum protokollierten Ende;
- `batteryPowerCleared`, `batteryPowerFirstClearedTs`: aktueller bzw. erster Leistungsnullpunkt, ohne Abbruch;
- Startwert und gehaltene Ladeanforderung, aktueller PackState, Phase und Abbruchgrund;
- `pulseReason=waiting_pack_state_test_no_timeout`, solange der Versuch aktiv ist.

Bitte über den PackState-Wechsel hinaus aufzeichnen: 23 W halten → PackState-Wechsel/anderer Abbruch → 0 W → bleibt Restentladung weg? Wenn kein Wechsel eintritt, ist genau diese Beobachtung zusammen mit der protokollierten Dauer relevant. HA-Erfolg/Limit-Readback und PackState sind getrennte Signale, keine identische Gerätebestätigung.

## Offline-Prüfung

20 gezielte Testgruppen bestanden: Halten über 60 s und zehn Minuten, kein Abbruch durch +5 W, später PackState-Wechsel, Restentladung ohne Wiederholung, Sperren/Betriebsvorrang, Fehlermeldungen und identischer Importcode. Die Zehn-Minuten-Sequenz prüft nur Softwarelogik, keine Anlagenwirkung. Bei deaktiviertem Versuch 5.324 historische ausgeführte Aufrufe gegenüber ZERO1 unverändert; 66 Diagnose-Abbrüche weiterhin ohne Stellnachrichten. Modell V16 bleibt unverändert.

```sh
node --test tests/pack-test.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```
