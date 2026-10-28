# V4.27-SIM-ZERO2: begrenzter Ladeimpuls zum Verlassen der Restentladung

28.10.2026. Testfassung auf Basis V4.26-SIM-ZERO1. Die Rückmeldung lautet: Regler auf Laden, Batteriestatus noch Entladen, ungefähr −18 W. **ZERO2 ergänzt einen einmaligen 6-W-Ladeimpuls mit früher Rücknahme über PackState oder Batterieleistung.** 6 W entsprechen dem zuvor vom Nutzer beobachteten wirksamen kleinen Ladeauftrag. Die Wirksamkeit der automatischen Sequenz muss an der Anlage bestätigt werden.

## Einbau

- [Vollständiger Function-Code als TXT](Regler_V4_27_SIM_ZERO2.txt)
- [Identischer JavaScript-Code](Regler_V4_27_SIM_ZERO2.js)
- [Einzelner Function-Node zum Import](NodeRED_Regler_V4_27_SIM_ZERO2_Import.json)
- [Gezielte Tests](validation/ZeroPulse_Tests.json)
- [Differenzprüfung bei deaktiviertem Impuls](validation/ZeroPulse_Disabled_Regression.json)

Nur den Regler-Function-Code ersetzen. Vier Ausgänge von oben: **1 Richtung → vorhandener AC-Modus-Node, 2 Ladeleistung, 3 Entladeleistung, 4 Diagnose/Logger**. Beim Import denselben Flow-Tab und dieselben Verbindungen verwenden; nur einen Regler betreiben. AC-Richtungsnode, Zusatzdiagnose und Logger werden nicht ausgetauscht.

## Ablauf

1. Bei regulären 0 W Laden / 0 W Entladen wird weiter AC-Modus 1 angefordert.
2. Erst wenn **AC-Modus Ist = 1**, eine frische Batteriemessung höchstens −10 W zeigt und dieser Zustand über mindestens sechs Sekunden gültig beobachtet wurde, darf der Impuls beginnen. `PackState=Entladen` allein bestätigt den AC-Modus nicht.
3. Einmalig **6 W Laden**, kein Entladen. Der Sollwertimpuls endet nach höchstens zwei verschiedenen gültigen Regeltakten oder nach vier Sekunden beim nächsten gültigen Aufruf.
4. Früher beenden, sobald nach Impulsbeginn ein gültiger PackState von **2 → 1 (Lädt)** oder **2 → 0 (Standby)** wechselt. Eine frische Batterieleistung ab −3 W beendet ebenfalls früher. Ein bereits vor Beginn gemeldeter PackState 1 gilt nicht als neue Bestätigung; fehlende Werte werden nicht als Standby gewertet.
5. Danach 0 W und eine achtsekündige Abklingphase. Keine automatische Wiederholungsserie bei unverändertem Restverbrauch. Ein neuer regulärer Leistungsbetrieb kann eine spätere neue Episode ermöglichen.

Der PackState ist damit ein zusätzlicher früher Abbruchgrund, keine Bedingung, auf die unbegrenzt gewartet wird. In Log 20 wurde er erst rund 40 s nach Beginn der Umschaltung aktualisiert; so lange wird der Sollwertimpuls nicht verlängert.

## Vorrang und Rückwirkung

OFF, Netzladen und die Ladesperre `batt_max` unterbinden bzw. beenden den Impuls. Positiver Entladebedarf oder deutlicher normaler Ladebedarf übernehmen sofort die Kontrolle. Mindest-SOC/Entladesperre blockieren weiterhin Entladung; sie sind keine Sperre gegen erlaubtes Laden.

Eine erkannte PV-/Laständerung beendet den Impuls ebenfalls. Kleine berechnete Ladeanforderungen bis 21 W werden während Impuls/Abklingen als mögliche Rückwirkung behandelt und auf den Impuls bzw. danach 0 W begrenzt; größere Ladeanforderungen erhalten Vorrang. Dadurch kann auch eine kleine echte Überschussladung während dieser kurzen Phase verzögert werden. Neue Entladung wird niemals deswegen unterdrückt.

Der künstliche 6-W-Sollwert wird nicht in `lastChargeW` oder die Sollwerthistorie der regulären PI-Regelung übernommen. Während der übernommenen Nullphase werden die Integratoren zurückgesetzt. So können die eigene Leistungsmessung und kleine Netzschwankungen den Impuls nicht über HOLD als dauerhafte 6-/8-W-Ladung verriegeln. Die interne Richtungswahl/AntiFlip werden dafür nicht auf Laden umgeschrieben.

## Zeitgrenze und Fehlerbehandlung

Die bestehende Regel bleibt erhalten: Bei verworfenem Snapshot oder Laufzeitfehler keine neuen Stellnachrichten, aber Diagnose. **Vier Sekunden sind deshalb eine Grenze der Sollwertsequenz bei weiter eintreffenden gültigen Aufrufen, kein autonomer Geräte-Watchdog.** Fällt der Regler oder die Messung aus, kann das Gerät seinen letzten Sollwert länger halten; beim nächsten gültigen Aufruf wird ein abgelaufener Impuls zurückgenommen. Bei zwei normalen 2-s-Takten liegt die Sollwertdauer höchstens bei ungefähr vier Sekunden. Geräte- und Übertragungsverzögerungen können hiervon abweichen.

## Diagnose

`version=4.27-SIM`, `behaviorVersion=4.27-SIM-ZERO2`, `diagnosticVersion=4.27-SIM-DIAG1`. Bestehende Diagnosezähler werden fortgeführt. `zeroPowerIdle` ergänzt:

- `pulsePhase`: `idle`, `pulse`, `settle`, `done`;
- `pulseReason`, insbesondere `waiting_ac_mode_1`, `confirming_residual_discharge`, `bounded_charge_pulse`;
- `pulseStopReason`, insbesondere `pack_state_left_discharge`, `battery_power_cleared`, `tick_limit`, `wall_time_limit`;
- PackState bei Beginn/aktuell und `packStateValid`;
- regulär berechnete, ausgegebene und im Regler gespeicherte Leistungen.

Bei Diagnose-only-Aufrufen enthält `zeroPowerIdle.retainedState` nur den zuletzt vorbereiteten Zustand; das ist kein neuer Stellbefehl und keine Gerätebestätigung. `execution.controlExecuted` und `outputs` bleiben maßgeblich.

**Wenn `waiting_ac_mode_1` stehen bleibt**, muss die AC-Richtungsansteuerung bzw. deren Ist-Rückmeldung geprüft werden. Ein Ladeimpuls wird bei gemeldetem AC-Modus 2 nicht versucht. PackState und AC-Modus sind getrennte Signale.

## Prüfung und nächster Live-Test

19 gezielte Offline-Testgruppen prüfen Startbedingungen, PackState-Übergänge, Abbruch, Einmaligkeit, eigene Leistungsrückwirkung, Zeitgrenzen, Fehler, Sperren und Importdatei. Bei deaktiviertem Impuls stimmen Leistungswerte, Richtungswerte und regulärer Kontext in 5.324 historischen ausgeführten Aufrufen mit ZERO1 überein; 66 Diagnose-Abbrüche bleiben ohne Stellnachrichten. Das beweist nicht die Wirkung des aktivierten Impulses am Gerät.

Der nächste Log sollte AC-Modus Ist, PackState, Batterieleistung und `zeroPowerIdle` gemeinsam erfassen: 0/0 W → bestätigtes Laden → 6 W → früher PackState-/Leistungswechsel oder Zeitgrenze → 0 W. Prüfen, ob −18 W verschwinden und auch nach der Abklingphase ausbleiben.

```sh
node --test tests/zero-pulse.test.cjs
node tests/regression-disabled.cjs ../v4.25-sim/simulation
```

Der zweite Befehl benötigt die privaten Logs 15–23 im dortigen `upload/`. `zeroIdlePulseEnabled=false` deaktiviert den Impuls; ZERO1-Laderichtung bei 0/0 W bleibt erhalten. Alternativ ZERO1 erneut einfügen.
