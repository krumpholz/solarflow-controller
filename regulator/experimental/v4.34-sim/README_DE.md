# V4.34-SIM-IDLE4-KICK60: einmal60W/maximal60s, danach laufende Nullnachregelung

28.10.2026. Ergänzung der mit Logs28/29 validierten IDLE3-Ruhekompensation nach Nutzerwunsch. Kein Standby-Befehl über SmartMode/AC-Modus0; die bestehende BLE-Schnittstelle mit AC-Modus1 und Ladeleistung wird weiterverwendet.

## Ablauf

1. Nur bei normalem0/0W-Bedarf, bestätigtem AC-Modus Ist1, frischer Batteriemessung und gültigem PackState2/Entladen einen Versuch beginnen.
2. **60W als gesamten Ladeauftrag**, nicht60W zusätzlich zur Kompensation. Höchstens60s ab Beginn. Die normale Sollwerthistorie bleibt0W; ein vorheriger Kompensationswert wird separat erhalten.
3. Bei gültigem PackState-Wechsel auf1/Laden oder0/Standby früher beenden. Gemessene0W oder positive Batterieleistung allein beenden den Versuch nicht.
4. Bei PackState1 oder Zeitablauf: bisherigen Kompensationswert wieder ausgeben,8s Stellreaktion abwarten und danach die IDLE3-Nullnachregelung fortführen. Falls kein frischer alter Wert vorliegt, beginnt diese bei0W und lernt den Bedarf wie bisher.
5. **Bei PackState0/Standby den Zusatzauftrag einmalig auf0W setzen.** Anschließend ebenfalls die Batterieleistung weiter nachregeln. Bleibt sie0W, bleibt der Auftrag0W. Kehrt echte Restentladung zurück, darf die Nachregelung sie wieder ausgleichen, auch wenn das Statuslabel noch Standby lautet.
6. Ohne erfolgreichen Wechsel keine weitere Versuchsserie in derselben Ruhephase. Die laufende Kompensation hat kein Zeitlimit und keine Zehn-Minuten-Prüfung. Eine neue normale Leistungsphase bzw. OFF/Betriebswechsel ermöglicht später eine neue Ruheepisode mit einem neuen Einzelversuch.

Ein erst nach dem60s-Zeitablauf eintreffender Standby-Wechsel setzt den Zusatzauftrag ebenfalls einmalig auf0W. Ein bereits bei Eintritt gemeldeter PackState0/1 startet keinen60W-Versuch.

## Warum Standby ausdrücklich0W anfordert

Die bisherige Rechnung lautet `neuer Auftrag = alter Auftrag − gemessene Batterieleistung`. Nimmt das Gerät im Standby einen vorhandenen18W-Auftrag nicht mehr auf und die Messung bleibt0W, würde diese Rechnung allein weiterhin18W ergeben. Deshalb stellt der bestätigte Wechsel auf Standby **einmal** Soll0 her. Danach entscheidet wieder die frische Leistungsmessung. Der tatsächliche PackState wird niemals künstlich umgeschrieben.

## Vorrang unverändert

Jede positive normale Lade- oder Entladeanforderung übernimmt sofort, auch kleine Ladeleistungen. OFF, Netzladen, volle Batterie/Ladesperre behalten Vorrang. Fehlende AC-Bestätigung oder fehlende frische Batteriemessung beenden einen aktiven Versuch; Rückkehr der Daten löst nicht automatisch denselben Versuch erneut aus. Mindest-SOC/Entladesperren sind weiterhin keine Sperren gegen erlaubtes Laden.

Die eigene60W-Leistung und ihre Stellnachwirkung dürfen den Nullregler nicht verstellen. Deshalb werden dessen Proben während des Versuchs verworfen und die Nachregelung erst nach dem anschließenden8s-Einschwingen wieder ausgewertet. Eigener Sollwertspeicher und PI-Integratoren bleiben wie bei IDLE3 getrennt. PV-/Hausdeltas allein brechen den Versuch nicht ab; neuer tatsächlicher Reglerbedarf schon.

## Zeitgrenze bei ungültigen Daten

Die bisherige Fehlerpolitik bleibt erhalten: Bei verworfenem Snapshot/Laufzeitfehler nur Diagnose, keine neuen Stellnachrichten. **60s begrenzen die Sollwertsequenz bei weiter eintreffenden gültigen Aufrufen.** Ohne gültige Aufrufe kann das Gerät seinen letzten Auftrag länger halten; ein abgelaufener Versuch wird beim nächsten gültigen Aufruf beendet. Kein unabhängiger Gerätetimer oder zusätzlicher Watchdog. Übertragung und Geräteübernahme können zusätzliche Verzögerung verursachen.

## Einbau

Nur den Regler-Function-Code aus `Regler_V4_34_SIM_IDLE4_KICK60.txt` ersetzen oder den einzelnen Node aus `NodeRED_Regler_V4_34_SIM_IDLE4_KICK60_Import.json` anstelle des bisherigen Reglers verbinden. Vier Ausgänge: **Richtung, Ladeleistung, Entladeleistung, Diagnose**. BLE-Firmware, Richtungsnode, Zusatzdiagnose und Logger bleiben bestehen. Nur einen Regler betreiben.

Frischen IDLE3-Kompensationswert beim Versionswechsel übernehmen: gültiger Kontext, gleichlautende zuletzt vorbereitete Ladeanforderung, Entladeanforderung0 und Alter höchstens6s. Sonst normaler Nullstart. Neuer Kontext für die Nachregelung `regler_idle_compensation_v434`, für den Einzelversuch `regler_idle_charge_kick_v434`. Ein Logger-Neustart setzt die Versuchsverriegelung nicht zurück.

## Diagnose

`behaviorVersion=4.34-SIM-IDLE4-KICK60`. Während60W zeigt die Anzeige **RUHE_LADEIMPULS**, danach RUHEKOMPENSATION bzw.RUHE_0W. Interne Richtungsentscheidung bleibt separat unter `logicalMode`.

`idleChargeKick` enthält:

- `enabled`, `active`, `phase` (`ready`/`active`/`done`), `attempted`;
- Beginn, Frist, Restzeit und Ende;
- `stopReason`: `pack_state_left_discharge`, `time_limit`, `confirmation_lost`;
- PackState samt Rohwertgültigkeit, gespeicherten Kompensationswert und Feedback-Pause;
- reguläre Leistungsanforderungen zur Erklärung einer Vorrangübernahme.

`idleCompensation` bleibt die Diagnose der Nullnachregelung; `zeroPowerIdle.pulseActive/pulseW` beschreibt nun korrekt den aktiven60W-Versuch. Bei Diagnose-only sind die gespeicherten Zustände nur zuletzt vorbereitete Werte, kein neuer Befehl und kein Geräte-ACK.

## Einordnung des Screenshots vom27./28.Oktober

Am rechten Ende erscheint Standby nach einer deutlichen Ladephase, einem SOC-Anstieg von ungefähr5 auf20% und anschließendem Plateau. Davor bleibt PackState auch bei sehr kleiner dargestellter Leistung lange Entladen. Das stützt einen Test nach deutlicher Ladung, beweist aber **keine feste20%-Schwelle, Ladeleistung oder Wartezeit**.

Die Grafik enthält weder Stellanforderungen/AC-Modus noch SOC-Sperren/SmartMode und keine exakten Übergangszeitpunkte. Die dargestellte Leistungskurve läuft während des SOC-Anstiegs negativ; ihr Vorzeichen darf nicht ungeprüft mit der positiven Ladeleistung der Regler-Modbusmessung gleichgesetzt werden. Zudem zeigt sie einen historischen Zeitraum vor den aktuellen IDLE3-Live-Logs. Daraus lässt sich kein gesicherter firmwareinterner Standby-Mechanismus ableiten. Die Beobachtung des Nutzers, dass ein einmal erreichter Standby hält, wird durch explizite0W-Anforderung beim Statuswechsel berücksichtigt und anschließend anhand der Messung überprüft.

Der60W-Test kann einen PackState-Wechsel sichtbar machen, garantiert ihn aber nicht. AnlagenmodellV16 bleibt unverändert; kein unbeobachteter Standby-Timer wird in das Modell hineinkalibriert.

## Prüfung

**41 Offline-Testgruppen bestanden:**19 neue Versuchs-/Standby-Fälle und22 bestehende Nachregelungsfälle mit deaktiviertem Zusatzversuch. Geprüft werden Frist, frühe PackState-Rücknahme, später Standby, echte Rückkehr der Restentladung, keine Wiederholungsserie, Fallback ohne eigene60W-Rückwirkung, normale Vorränge, Daten-/Laufzeitfehler und exakter Importcode.

Mit nur deaktiviertem60W-Versuch stimmen alle1195 ausgeführten Aufrufe aus Logs28/29 einschließlich der fünf Korrekturen und88 Entladeübernahmen weiterhin exakt überein; vier Diagnose-Abbrüche bleiben ohne Stellnachrichten. Mit komplett deaktivierter Ruheregelung stimmen5324 historische Ausführungen mit ZERO1 überein,66 Abbrüche bleiben Diagnose-only. Die aktivierte60W-Sequenz ist noch nicht live validiert.

```sh
node --test tests/kick60.test.cjs tests/idle-tracking.test.cjs
node tests/private-logs28-29.cjs /pfad/zum/simulationsordner
node tests/regression-disabled.cjs /pfad/zum/simulationsordner
```

Für den nächsten Log den vollständigen Versuch und die anschließende Ruhephase erfassen:60W→PackState-Wechsel oder60s→Fallback/0W→stabile Messung. Rohlogs bleiben privat.
