# V4.35-SIM-IDLE5-NET60-HOLD60

28.10.2026. Der Impuls zielt auf **60W reale Batterieladung am vorhandenen Modbus-Messpunkt**. Die Ladeanforderung wird einmal bei Beginn berechnet und während des gesamten Versuchs einschließlich Nachhaltezeit unverändert ausgegeben. Ein PackState-Wechsel beendet den Impuls nicht mehr sofort: ab dem ersten gültig beobachteten Wechsel eine weitere Minute halten.

## Startberechnung

```js
Startauftrag = Math.round(letzterLadeauftrag + 60 - gemesseneBatterieleistung);
Startauftrag = Math.max(0, Math.min(batt_power_max, Startauftrag));
```

| Letzter Ladeauftrag | Startmessung | Berechneter Auftrag |
|---:|---:|---:|
|0W|−24W|84W|
|24W|0W|84W|
|60W|+36W|84W|
|18W|0W|78W|

Das zweite Beispiel berücksichtigt eine bereits laufende Nullkompensation; sie darf nicht übersehen oder doppelt addiert werden. Das dritte erlaubt den Versionswechsel während eines bisherigen60W-Versuchs. Als Referenz gilt vorrangig der höchstens6s alte zuletzt vorbereitete Ladeauftrag aus dem aktuellen bzw. IDLE4-/IDLE3-/IDLE2-Kontext, sofern die Entladeanforderung0 war. Sonst den verfügbaren Kompensationswert bzw.0W verwenden. Alle Referenzdaten werden diagnostiziert.

**Wichtig:** Der vorbereitete Auftrag ist keine Gerätebestätigung. Die Startrechnung setzt voraus, dass die Messung den zugrunde gelegten Auftrag bereits ungefähr abbildet. Sie beschreibt die aus Logs gestützte lokale additive Wirkung und garantiert bei Verzögerung, anderer Kennlinie oder Begrenzung keine exakt60W. Wie gewünscht keine weitere Amplitudenänderung während des Versuchs. Leistung auf die bestehende physikalische Reglergrenze begrenzen, aktuell2400W; eine Begrenzung wird ausdrücklich markiert. Die100W-Grenze der normalen Ruhekompensation bleibt davon getrennt bestehen.

## Zeitfolge

1. Nur bei aktivem normalem0/0W-Bedarf, bestätigtem AC-Modus Ist1, frischer Batteriemessung und gültigem PackState2 beginnen.
2. Berechneten Auftrag ausgeben. **Bis zu60s auf einen gültigen PackState-Wechsel zu1/Laden oder0/Standby warten.** Gemessene positive Leistung allein startet keine Nachhaltezeit.
3. Erfolgt der erste beobachtete Wechsel vor Ablauf dieser Frist, den gleichen Auftrag **ab diesem Zeitpunkt weitere60s halten**. Weitere PackState-Wechsel oder Rückwechsel verlängern diese Frist nicht. Beispiel: Wechsel nach12s→Ende nach72s. Wechsel nach58s→Ende nach118s.
4. Wird vor Ablauf der ersten Minute kein Wechsel erfasst, Impuls beenden und die normale laufende Nullkompensation wieder übernehmen. Kein erneuter Versuch in derselben unveränderten Ruheepisode.
5. Nach vollständig gehaltener Nachlade-Minute ebenfalls zur Nullkompensation zurückkehren. Deren Feedback war während des Impulses pausiert und beginnt nach8s Einschwingen wieder mit vier frischen Proben.

Damit beträgt die Sollwertsequenz im Erfolgsfall maximal knapp zwei Minuten, im erfolglosen Fall eine Minute. Ein erst am/ nach dem Fristablauf erstmals beobachteter Wechsel verlängert die fehlgeschlagene Wartephase nicht mehr.

Auch bei einem Wechsel direkt auf Standby gilt in dieser Fassung die ausdrücklich gewünschte60s-Nachhaltephase. Der gespeicherte Fallback wird dabei bereits auf0W gesetzt; der tatsächliche Versuchswert endet erst nach der Haltezeit bzw. bei einem anderen Vorrang. Danach bleibt der Auftrag0W, sofern die reale Messung0W bleibt. Sollte echte Restentladung zurückkehren, gleicht die Nullregelung sie wieder aus. Standby wird nicht allein durch ein Label als elektrisch verlustfrei angenommen.

## Vorrang und Fehlerbehandlung

**Jede normale positive Lade-/Entladeanforderung hat sofort Vorrang**, auch während der Nachhaltephase. OFF, Netzladen und volle Batterie/Ladesperre behalten Vorrang. Verlust bestätigten AC-Modus1 oder frischer Batteriemessung beendet den Versuch ohne automatisches Wiederholen bei Datenrückkehr. Eine echte neue normale Leistungsphase bzw. Betriebswechsel ermöglicht später eine neue Ruheepisode.

Bei ungültigem Snapshot/Laufzeitfehler unverändert nur Diagnose, keine neuen Stellnachrichten. Das Gerät kann den letzten Auftrag halten. Ablauf einer Warte-/Haltefrist wird **beim nächsten gültigen Regleraufruf** umgesetzt; kein autonomer Geräte-Watchdog. Übertragungs-/Geräteverzögerungen kommen hinzu. Zeitangaben beschreiben die Sollwertsequenz und nicht einen garantierten physischen Abschaltzeitpunkt bei ausgefallener Regelung.

Die laufende Nullkompensation bleibt ohne Zehn-Minuten-Prüfung erhalten. Ihr vorheriger Wert wird während des Ladeversuchs nicht durch dessen eigene positive Leistung auf0W heruntergeregelt. Ein frischer IDLE4-Fallback wird beim Versionswechsel übernommen, auch wenn der zuletzt vorbereitete tatsächliche Auftrag noch zum alten Impuls gehörte. Fehlt ein gelernter Wert, startet der Fallback wie bisher bei0W und lernt die verbleibende Restentladung nach Einschwingen/Messfenster neu.

## Einbau

Nur den Regler-Function-Code aus `Regler_V4_35_SIM_IDLE5_NET60_HOLD60.txt` ersetzen oder den einzelnen Node aus `NodeRED_Regler_V4_35_SIM_IDLE5_NET60_HOLD60_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. BLE-Firmware, Richtungsnode, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben.

Neuer Nachregelungskontext `regler_idle_compensation_v435`, Versuchskontext `regler_idle_charge_kick_v435`. Beim Einsetzen beginnt ein neuer Versuch in der nächsten erlaubten Ruheepisode mit PackState2; die vorige IDLE4-Versuchsverriegelung wird nicht übernommen.

## Diagnose

`behaviorVersion=4.35-SIM-IDLE5-NET60-HOLD60`, weiterhin vier Ausgänge und Diagnose in jedem empfangenen Takt nach bestehender Fehlerpolitik.

Unter `idleChargeKick`:

- `phase`: `ready`, `waiting`, `holding`, `done`;
- `targetBatteryW=60` und getrennt `latchedCommandW/configuredW`, z.B.84W;
- `referenceChargeW`, `referenceSource`, `batteryWAtStart`, `unclampedCommandW`, `commandLimited`;
- Start, erste Wartefrist, beobachteter Wechsel, PackState beim Wechsel, aktuelle Endfrist;
- `waitMaxMs=60000`, `holdAfterTransitionMs=60000`;
- `stopReason`: `no_transition_timeout`, `post_transition_hold_complete`, `confirmation_lost`;
- Restzeit bezieht sich in `waiting` auf die Wartefrist und in `holding` auf die Nachhaltefrist.

Die Anzeige bleibt während beider Impulsphasen RUHE_LADEIMPULS. `idleCompensation` hält den normalen Fallback getrennt fest. Bei ungültigen Daten sind gespeicherte Kontextwerte nur zuletzt vorbereitete Werte, kein aktueller Geräte-ACK.

## Einordnung des letzten Kurzlogs

Die Datei `regler_log_20min(1).jsonl` enthält532 ältereV4.20-Datensätze und nur18 aktuelleV4.34-Datensätze über34s. Im aktuellen Versuch: Start19:56:48 mit60W bei−24W, Messung anschließend+36W, PackState-Wechsel aufLaden um19:57:00. IDLE4 beendet daher korrekt nach12s; nach Rücknahme kehren−24W zurück. Der aktuelle Ausschnitt endet vor der vierten Fallback-Probe. Kein bestätigter Standby und keine vollständige einminütige Ladung sind darin enthalten.

Die neue Fassung adressiert genau die gewünschte Änderung: ungefähr84W statt60W beim selben Ausgangszustand und weitere60s nach dem beobachteten Wechsel. Ob dies dauerhaft Standby herstellt, bleibt live zu prüfen. Eine neue PackState-/Standby-Kennlinie wird daraus nicht in AnlagenmodellV16 hineinkalibriert.

## Prüfung

44 Offline-Testgruppen bestanden:22 neue Start-/Haltefälle und22 bestehende Nachregelungsfälle mit deaktiviertem Versuch. Geprüft: Rechnung mit/ohne bereits laufende Kompensation, Übergang aus altem Impuls, konstante Amplitude, Wechsel nach12/58s, Fristablauf, PackState-Flattern, Standby-Nachhalten, sämtliche normalen Vorränge und Fehlersituationen. Synthetischer verzögerter Prüfstand erreicht bei24W Grundbedarf aus84W Anforderung60W Messleistung und kehrt nach dem Halten auf24W/0W zurück. Das ist eine Modellannahmenprüfung, keine Live-Zusage.

Mit deaktiviertem Versuch bleiben1195 ausgeführte Aufrufe der Logs28/29 exakt reproduziert, vier Abbrüche Diagnose-only. Bei vollständig deaktivierter Ruheregelung bleiben5324 historische Ausführungen gegenüber ZERO1 unverändert,66 Abbrüche Diagnose-only. ModellV16 unverändert.

```sh
node --test tests/net60-hold.test.cjs tests/idle-tracking.test.cjs
node tests/private-logs28-29.cjs /pfad/zum/simulationsordner
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```

Für den nächsten vollständigen Log: Startberechnung, tatsächliche Messleistung, erster PackState-Wechsel, ganze Nachhalteminute und mindestens eine anschließende Fallback-Messfolge erfassen. Rohlogs bleiben privat.
