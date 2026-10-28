# V4.29-SIM-ZERO4: Restentladung plus 5 W Reserve

Testfassung vom 28.10.2026 auf Basis ZERO3. Laut Anlagentest senkte die 5-W-Ladeanforderung die Restentladung von ungefähr −18 W auf −13 W, ohne den PackState umzuschalten. Das passt zu einer zunächst wirkenden Leistungskompensation; eine sichere physikalische Kennlinie oder dauerhafte Umschaltung ist damit noch nicht bestätigt.

## Neue Berechnung

Bei Beginn des einmaligen Ladeversuchs:

```js
pulseW = Math.min(100, Math.ceil(Math.max(0, -p_batterie) + 5));
```

Beispiele: −13 W → 18 W, −18 W → 23 W, −24 W → 29 W. Auf ganze Watt aufrunden. 100 W begrenzen ausschließlich diesen Sonderversuch; normale Ladegrenzen bleiben unverändert. Bei Begrenzung kann die Reserve nicht garantiert werden; Diagnose kennzeichnet dies.

Der frische Batteriewert beim tatsächlichen Impulsbeginn wird gespeichert. **Der daraus ermittelte Auftrag bleibt bis zum Ende desselben Versuchs konstant.** Eine kontinuierliche Neuberechnung würde bei eigener Messrückwirkung den Auftrag wieder reduzieren: −18 W → 23 W Auftrag → Messung nahe 0 W → nur noch 5 W Auftrag. Deshalb weder herunterregeln noch bei wachsender Restentladung automatisch hochregeln. Es gibt keine automatische Eskalations- oder Wiederholungsserie.

Bei annähernd additiver Wirkung würde 23 W aus −18 W ungefähr +5 W machen. Dies ist eine Arbeitshypothese für den Live-Test, keine zugesicherte Anlagenreaktion. Auch ein nach Rücknahme wiederkehrender Restverbrauch bleibt möglich.

## Ablauf und Rücknahme

- Start nur bei normaler aktiver Regelung, regulären Lade-/Entladeanforderungen 0/0 W, bestätigtem AC-Modus Ist=1 und über mindestens sechs Sekunden frisch beobachteter Batterieleistung ≤−10 W.
- Einmaligen dynamischen Auftrag beginnen und bis zur Rückmeldung halten, höchstens 60 Sekunden ab Beginn.
- PackState vom bei Beginn erfassten Entladen (2) auf Laden (1) oder Standby (0): auf 0 W zurücknehmen. Frische Batterieleistung ≥−3 W kann früher beenden. Die −3 W sind die unveränderte Nullpunkttoleranz.
- Anschließend acht Sekunden Abklingen mit 0 W; keine erneute Anforderung in derselben Episode, auch wenn −18 W wiederkommen. Das ist im nächsten Log ausdrücklich zu prüfen.
- Neue normale Leistungsphase bzw. Betriebswechsel können eine spätere neue Episode ermöglichen. Eigener Kontext `regler_zero_idle_pulse_v429` verhindert, dass ein abgeschlossener ZERO3-Versuch den neuen Test blockiert. Nur Logger neu starten setzt diese Episode nicht zurück.

## Einbau

Nur den Regler-Function-Code aus `Regler_V4_29_SIM_ZERO4.txt` ersetzen oder den einzelnen Function-Node aus `NodeRED_Regler_V4_29_SIM_ZERO4_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge von oben: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. AC-Richtungsnode, Zusatzdiagnose und Logger unverändert; nur einen Regler betreiben.

## Unveränderter Vorrang und Rückwirkung

OFF, Netzladen, volle Batterie/Ladesperre und neuer normaler Leistungsbedarf haben Vorrang. Neue positive Entladeanforderung übernimmt sofort. Kleine normale Ladeanforderungen bis zum gespeicherten Impulswert+15 W können während Versuch/Abklingen eigene Rückwirkung sein und werden durch die Versuchssequenz ersetzt; größere normale Ladeanforderungen übernehmen. Das kann kleine echte Ladeanforderungen vorübergehend verzögern.

Die normale Sollwerthistorie bleibt während des übernommenen Versuchs/Abklingens bei 0 W; Integratoren werden zurückgesetzt. Dadurch wird der künstliche Auftrag nicht als Dauerladung im Regler gespeichert. Die interne Richtungswahl/AntiFlip bleiben unverändert.

Fehlende frische Batteriemessung, Verlust von AC-Modus Ist=1, PV-Änderungen >15 W oder Änderungen der abgeleiteten Hausleistung >25 W gegenüber Impulsbeginn führen ebenfalls in die Null-Abklingphase. 60 Sekunden sind die Höchstdauer, keine Mindestdauer.

Bei ungültigem Snapshot/Laufzeitfehler weiterhin keine neuen Stellnachrichten, aber Diagnose. Die Rücknahme nach Ablauf erfolgt beim nächsten gültigen Aufruf; kein unabhängiger Geräte-Watchdog. Das Gerät kann bei ausbleibenden gültigen Aufrufen seinen letzten Auftrag länger halten.

## Diagnose und Live-Prüfung

`version=4.29-SIM`, `behaviorVersion=4.29-SIM-ZERO4`. `zeroPowerIdle` enthält zusätzlich:

- `batteryWAtPulseStart`: gemessener Startwert;
- `pulseConfiguredW`: gespeicherter Auftrag, `pulseW`: aktuell aktiver Versuchsauftrag;
- `pulseReserveW=5`, `pulseLimitW=100`, `pulseUnclampedW`, `pulseLimited`;
- Phase, verbleibende Zeit, tatsächlichen PackState, Start-PackState und Abbruchgrund;
- regulär berechnete und im Regler gespeicherte Leistungen. `outputs` zeigt die tatsächlichen Stellanforderungen.

Im nächsten Log prüfen: Startwert −18 W → Auftrag 23 W → AC-Ist/PackState und Batteriemessung → Rücknahme auf 0 W → bleibt die Restentladung weg? Bleibt der Auftrag aus, zuerst `pulseReason` prüfen. `waiting_ac_mode_1` bedeutet keine bestätigte Laderichtung. Ein ausgesendeter Sollwert bestätigt noch keine Übernahme durch das Gerät.

27 Offline-Testgruppen bestanden: unter anderem dynamische Startwerte, Aufrundung, Begrenzung, unverändertes Halten bei −18→−13 W, spätes PackState, früherer Nullpunkt, Rückkehr der Restentladung ohne Wiederholung, Fehler-/Sperrprioritäten und Importgleichheit. Bei deaktiviertem Versuch: 5.324 historische ausgeführte Aufrufe gegenüber ZERO1 unverändert; 66 Diagnose-Abbrüche weiterhin ohne Stellnachrichten. Keine Live-Validierung oder Neukalibrierung des Anlagenmodells V16.

```sh
node --test tests/zero-pulse.test.cjs
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```
