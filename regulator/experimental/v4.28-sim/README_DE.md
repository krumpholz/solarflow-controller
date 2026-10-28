# V4.28-SIM-ZERO3: 5 W bis zur Rückmeldung, höchstens 60 Sekunden

Testfassung vom 28.10.2026 auf Basis V4.27-SIM-ZERO2. Der bisherige kurze Ladeimpuls hat laut Anlagentest nicht umgeschaltet; ohne neuen Log ist nicht geklärt, ob er tatsächlich ausgegeben wurde. Diese Fassung ersetzt die bisherige Grenze von zwei Takten/vier Sekunden durch eine Zeitgrenze von 60 Sekunden.

## Einbau und Versuch

Nur den Regler-Function-Code durch `Regler_V4_28_SIM_ZERO3.txt` ersetzen. Alternativ den einzelnen Function-Node aus `NodeRED_Regler_V4_28_SIM_ZERO3_Import.json` importieren und anstelle des bisherigen Reglers verbinden. Vier Ausgänge: Richtung, Ladeleistung, Entladeleistung, Diagnose. Richtungsnode, Logger und Zusatzdiagnose bleiben bestehen; nur einen Regler betreiben.

1. Reguläre Anforderung 0 W Laden / 0 W Entladen: weiterhin AC-Modus Laden anfordern.
2. Start erst bei AC-Modus Ist=1 und mindestens sechs Sekunden frisch beobachteter Restentladung von mindestens 10 W.
3. Einmalig 5 W Laden anfordern. Kein Taktlimit; die absolute Frist liegt 60 Sekunden nach Impulsbeginn.
4. Führende Rückmeldung: ein gültiger PackState wechselt vom bei Beginn erfassten Entladen (2) auf Laden (1) oder Standby (0). Dann 0 W. Erreicht die frische Batterieleistung früher mindestens −3 W, ebenfalls sofort 0 W. Diese Toleranz vermeidet das Warten auf exakt 0 W.
5. Ohne Rückmeldung nach 60 Sekunden auf 0 W; danach acht Sekunden Abklingphase. Keine automatische Wiederholung und keine automatische Erhöhung auf 10 W in derselben Nullleistungsphase.

Für einen **separaten zweiten Test mit 10 W** im Regler diese eine Zeile ändern:

```js
const zeroIdlePulseW = 10;
```

Standard ist 5 W. Die neue Version benutzt einen eigenen Zustandskontext, damit eine abgeschlossene ZERO2-Episode den ersten ZERO3-Versuch nicht sperrt. Ein erneuter Test nach erfolglosem ZERO3 benötigt eine neue reguläre Betriebsphase oder das gezielte Löschen von `flow.regler_zero_idle_pulse_v428`. Ein bloßer neuer Loggerstart setzt die Episode nicht zurück. Nicht wiederholt deployen, um eine automatische Versuchsserie zu erzeugen.

## Vorrang und Rückwirkung

OFF, Netzladen, volle Batterie/Ladesperre, neuer Entladebedarf und deutlicher normaler Ladebedarf haben Vorrang. Verlust der frischen Batterie-Rückmeldung oder des bestätigten AC-Modus beendet den Versuch. PV-Änderungen über 15 W oder Änderungen der abgeleiteten Hausleistung über 25 W gegenüber Impulsbeginn führen ebenfalls in die Null-Abklingphase. Ein aktiver Versuch kann deshalb vor 60 Sekunden enden, ohne dass die Umschaltung gelungen ist: den Abbruchgrund prüfen.

Kleine berechnete Ladeleistungen bis Impulsleistung+15 W werden während Versuch und Abklingen als mögliche eigene Rückwirkung behandelt; die normale Sollwerthistorie bleibt 0 W und Integratoren werden zurückgesetzt. Das verhindert dauerhaft verriegelte Kleinladung. Es kann während des längeren Versuchs eine kleine echte Ladeanforderung verzögern. Neuer Entladebedarf übernimmt sofort.

## Diagnose

`version=4.28-SIM`, `behaviorVersion=4.28-SIM-ZERO3`. Unter `zeroPowerIdle`:

- `pulseConfiguredW`, `pulseActive`, `pulsePhase`, `pulseRemainingMs`, `pulseMaxMs`;
- `pulseReason`, `pulseStopReason`, insbesondere `waiting_ac_mode_1`, `pack_state_left_discharge`, `battery_power_cleared`, `wall_time_limit`, `confirmation_lost`, `pv_or_load_changed`;
- `packStateAtPulseStart`, `actualPackState`, `packStateValid`;
- `regularOutputs`, `regulatorMemoryOutputs` sowie tatsächliche Sollausgänge in `outputs`.

Für den Live-Test diese Felder mit AC-Modus Ist und Batterieleistung aufzeichnen. Eine ausgesendete 5-W-Anforderung ist keine Bestätigung, dass das Gerät sie übernommen hat. PackState am Start bereits Laden gilt nicht als neuer Wechsel.

## Zeitgrenze und Fehler

Bei ungültigem Snapshot oder Laufzeitfehler bleiben Stellnachrichten wie bisher aus; Diagnose läuft weiter. Die 60 Sekunden gelten für die Sollwertsequenz bei weiter eintreffenden gültigen Aufrufen. Ohne weitere gültige Aufrufe kann das Gerät den letzten Auftrag länger halten; ein abgelaufener Auftrag wird am nächsten gültigen Aufruf zurückgenommen. Kein unabhängiger Geräte-Watchdog.

## Prüfung

22 gezielte Offline-Testgruppen einschließlich spätem PackState nach 40 Sekunden, früherem Leistungsnullpunkt und separater 10-W-Konfiguration. Alle bestanden. Bei deaktiviertem Impuls: 5.324 historische ausgeführte Aufrufe unverändert gegenüber ZERO1; 66 Diagnose-Abbrüche weiterhin ohne Stellnachrichten. Das ist keine Live-Bestätigung der aktivierten Sequenz und keine neue Kalibrierung des Anlagenmodells.

```sh
node --test tests/zero-pulse.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```
