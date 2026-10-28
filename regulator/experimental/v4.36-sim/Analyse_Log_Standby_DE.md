# V4.36-SIM-IDLE6-NOPULSE – Rückbau der Impulsstrategie und Standby-Recherche

Stand: 28.10.2026. Nur Regler-Function austauschen; vier Ausgänge und Verdrahtung unverändert. Keine Änderung am BLE-Controller, keine Anlagenansteuerung durch diese Arbeit.

## Ausgewerteter Logteil

Datei `regler_log_20min(2).jsonl`: ausschließlich Zeilen551–598 mit V4.35, 20:45:05.331 bis20:46:39.631 MEZ (94.300s). Zeilen1–550 sind ältere V4.20/V4.34 und wurden für die Bewertung vollständig ausgeschlossen. Der aktuelle Teil umfasst48 Aufrufe:43 ausgeführt,5 wegen Zyklusabweichung und zu altem Snapshot übersprungen,0 Laufzeitfehler. Trotz Dateiname kein20-Minuten-Nachweis.

| Zeit MEZ | Ladeanforderung | gemessene Batterie | PackState / Ereignis |
|---|---:|---:|---|
| 20:45:15 |84W|−24W|2; Impuls beginnt |
| 20:45:21 |84W|+60W|2; reales Ladeziel erreicht |
| 20:45:23 |84W|+60W|1; Halteminute beginnt |
| 20:46:23 |0W|+60W|1; Halteminute beendet |
| 20:46:29 |0W|−24W|1; physische Restentladung trotz Anzeige Laden |
| 20:46:35 |0W|−24W|2; Anzeige folgt später |
| 20:46:37–39 |24W|−24W|2; Nullausgleich wieder eingeschaltet, Stellreaktion noch nicht enthalten |

Die Haltezeit beträgt aus den internen Ausführungszeiten60.009s nach beobachtetem Wechsel; gesamter Impuls68.263s. Der Auftrag84W ergibt bei diesem Betriebspunkt tatsächlich +60W. Damit ist eine zu geringe Impulsleistung als Erklärung dieses Versuchs ausgeschlossen. Die Haltestrategie wurde umgesetzt, führte hier aber nicht zu dauerhaftem Standby. Kein gültiger aktueller Datensatz zeigt PackState0. Ein anderer Versuch mit anderer Dauer ist damit nicht grundsätzlich widerlegt; es fehlt jedoch eine belastbare Grundlage für weiteres Impuls-Tuning.

Die5 Snapshot-Ausfälle liegen während des Impulses. Bei diesen Aufrufen gab es nur Diagnose, keine neuen Stellnachrichten. Der vorhandene Auftrag blieb am Gerät möglich. Die Haltefrist wurde beim nächsten gültigen Takt korrekt beendet; Ausfälle sind in diesem Versuch nicht die Ursache des Rückfalls.

Die Datei verwendet weiterhin den älteren Zusatzlogger: `snapshot=null`, bei aktuellen gültigen Zeilen `snapshotAttachment.matched=false`, keine vollständige neue BLE-Zusatzdiagnose und kein `b_entladen` im reduzierten meta-Objekt. Der direkte Reglerstatus reicht für die obige Impulsbewertung. SmartMode, AC/DC-Zustand und Einzelpackströme lassen sich damit nicht abschließend prüfen. Gemessene Modbus0W wären außerdem kein Beweis für abgeschaltete interne Elektronik.

## Änderung V4.36

Die Impulssteuerung ist entfernt, einschließlich Startberechnung für+60W, Wartephase, PackState-gesteuerter Halteminute, Timeout, Wiederbewaffnung und Speicherung alter Kick-Kontexte. Es gibt keinen periodischen Zehn-Minuten-Test. `idleChargeKick` bleibt nur als eindeutige Diagnose `enabled=false`, `active=false`, `phase=removed`; `zeroPowerIdle.pulseEnabled/pulseActive=false`, `pulseW=0`.

Der laufende Nullausgleich bleibt: neuer Zusatzauftrag = begrenze(runde(bisheriger Zusatzauftrag − Median der Batteriemessung),0…100W). Kein Reserveaufschlag, keine zusätzliche Totzone. Nach Stelländerungen8s einschwingen lassen, danach4 frische Messungen aus unterschiedlichen Takten auswerten. Bei unverändertem Auftrag folgen weitere Viererfenster. Jede normale positive Lade-/Entladeanforderung, Netzladen, OFF und Ladesperre haben weiterhin Vorrang. Nur bestätigter AC-Modus1 und frische Batterie-Rückmeldung erlauben den Ausgleich; interne PI-Speicher enthalten den Zusatzauftrag nicht.

Die vorhandene einmalige Rücknahme auf0W beim **gültig gemeldeten Eintritt** in PackState0 bleibt erhalten. Danach entscheidet wieder die Batteriemessung. Ein dauerhaft alter PackState0 verhindert somit keine Korrektur einer erneut gemessenen Restentladung. PackState1/2 beeinflussen die Kompensationshöhe nicht. Fehlende PackState-Werte werden nicht als Standby ausgelegt. Diese Rücknahme ist kein Standby-Befehl.

Neuer Kontext `regler_idle_compensation_v436`. Beim Versionswechsel wird höchstens6s alter, plausibler gespeicherter Nullausgleich aus V4.35/34/33 (oder passender V4.32-Kontext) übernommen, **niemals der alte Impulsauftrag84W**. Proben werden verworfen und8s Einschwingen neu begonnen. Ohne frischen Kontext beginnt die Ermittlung bei0W. Ein laufender alter Impuls wird beim nächsten gültigen V4.36-Takt durch den Nullausgleich/normalen Auftrag ersetzt. Bei ungültigen Daten unverändert nur Diagnose, keine neue Stellnachricht; kein unabhängiger Watchdog.

## Recherche: welche Möglichkeiten sind tatsächlich belegt?

### 1. Beste belegte Spur: gezielte0W-Konfiguration mit SmartMode0

In Zendure-HA Issue683 (SF2400 AC, Batterieentladung trotz0W) bestätigten Nutzer die Behebung mit1.1.4-pre2. Der dazu zeitlich passende Commit `a1a2089343714523e7d24d2021fa727ad38ecaee` vom22.08.2025 heißt „Fix power drain“. Sein0W-Zweig änderte gleichzeitig SmartMode1→0, beide Leistungsgrenzen0 und das Property `acmode` auf korrektes `acMode:1`. **Es wurden mehrere Dinge zugleich korrigiert; der historische Erfolg beweist nicht isoliert die Wirkung von SmartMode0.**

Der aktuell geprüfte Zendure-HA-Code implementiert weiter:

- `charge(0)`: SmartMode0 bei unbenutztem Offgrid-Ausgang, AC-Modus1, inputLimit0, outputLimit0.
- `power_off()`: SmartMode0 unter derselben Bedingung, AC-Modus2, beide Grenzen0.
- Bei Leistungsbedarf SmartMode1 und entsprechende Richtung/Leistungsgrenze.

Das sind konkrete implementierte Wege, keine Dokumentation eines universellen Standby-Kommandos. Issue1083 beschreibt spätere Rückfälle, zeitweise Erfolg von OFF und teils erst21–35min später ruhige Einzelpacks. Daher keine Garantie für deine Geräte-/BMS-Firmware und kein bewiesenes Ein-Minuten-Abschaltintervall. Offgrid-Status muss vor einem solchen Versuch bekannt sein.

### 2. Dein BLE-Controller verhindert diesen SmartMode0-Zustand derzeit

Geprüft `solarflow_ble_controller.yaml` in `krumpholz/esphome-solarflow-ble`, letzte Dateiänderung `c75879ab4f4c3905a07fbe8bc2422958ef9f45a2`:

- AC-Sollwert und Schreibprüfung lassen1/2 zu, kein0.
- Bei gemeldetem SmartMode ungleich1 wird `solarflow_ready=false`.
- Die Automatik schreibt nach750ms wieder SmartMode1, mit weiteren Bereitschaftsprüfungen.

Ein externer einmaliger SmartMode0-Befehl würde deshalb bei Erkennung wieder aufgehoben. Der Node-RED-Regler kann den gewünschten Zustand mit seinen vier bestehenden Ausgängen nicht vollständig herstellen. Ein sinnvoller nächster Standby-Test braucht eine bewusste BLE-Standby-Funktion, die SmartMode0 zulässt, beide Grenzen0 setzt, beim Wiederanlauf SmartMode1/Readiness kontrolliert und konkurrierende zyklische Normalbefehle sauber koordiniert. Kein paralleler zweiter Controller.

### 3. AC-Modus0: implementiert, aber schwächer belegt

Aktueller ioBroker-Adapter `ZenSdkIobDevice.ts` setzt bei0W beide Grenzen0 und nach2s AC-Modus0; SmartMode bleibt1. Der frühere verzögerte SmartMode0-Code ist auskommentiert. Sein Changelog6.0.0 vom07.10.2026 sagt ausdrücklich, der Einfluss von dauerhaftem SmartMode auf den Standby-Verbrauch sei unklar.

Hersteller-zenSDK dokumentiert für AC-Modus jedoch nur1…2. Daher ist AC-Modus0 kein herstellerseitig dokumentierter, sicher für deinen SF2400 AC nachgewiesener Weg. Er wird von deinem BLE-Controller zusätzlich abgelehnt. Nicht ungeprüft als Ersatz eingebaut.

### 4. Was sich direkt nicht erzwingen lässt

Hersteller-zenSDK führt PackState und Einzelpackzustand als **nur lesbar**. Kein belegter schreibbarer PackState0-/Sleep-Befehl gefunden. SmartMode ist in der Herstellerbeschreibung als Flash-Schreibverhalten dokumentiert, nicht als zugesicherter Standby-Schalter. `gridOffMode` betrifft den Offgrid-Ausgang; das ist kein belegtes Ausschalten der gesamten Batterie-/Wechselrichterelektronik.

Für die eindeutige Prüfung des nächsten Versuchs braucht es rückgelesene Werte für SmartMode, AC-Modus, inputLimit/outputLimit, acStatus/dcStatus, Offgrid-Zustand sowie möglichst Leistung/Strom/Zustand je Pack. Erfolg wäre dauerhaft kein negativer Batteriestrom nach abgeklungener Reaktion und tatsächliche Zustandsrückmeldung; ein Sollwert0 oder eine einzelne aggregierte0W-Meldung reicht nicht. Bei mehreren Packs kann gleichzeitiges internes Laden/Entladen durch Summenbildung verborgen bleiben.

**Bewertung:** Eine besser belegte Alternative zum Ladeimpuls existiert als getesteter Integrationsweg mit SmartMode0 und0W-Grenzen. Eine universell nachgewiesene Lösung für deine konkrete BLE-/Gerätefirmware existiert in den geprüften Quellen nicht. Der nächste sachlich begründete Versuch liegt im BLE-Standby-Management, nicht in noch längeren Ladeimpulsen. Diese Version implementiert ausschließlich den verlangten Rückbau und bewahrt den bereits funktionierenden Nullausgleich.

## Primärquellen (abgerufen28.10.2026)

- Hersteller-Propertydefinition: https://github.com/Zendure/zenSDK/blob/main/docs/en_properties.md
- SF2400-AC-Fehler samt bestätigter Behebung: https://github.com/Zendure/Zendure-HA/issues/683
- Zugehöriger Fix-Diff: https://github.com/Zendure/Zendure-HA/commit/a1a2089343714523e7d24d2021fa727ad38ecaee
- Spätere Rückfälle/Grenzen: https://github.com/Zendure/Zendure-HA/issues/1083
- Aktueller Zendure-HA-Code, Dateiänderung `aa6e93b6e74cd76732f24accd703bd0e6697b894`: https://github.com/Zendure/Zendure-HA/blob/aa6e93b6e74cd76732f24accd703bd0e6697b894/custom_components/zendure_ha/device.py
- Dein BLE-Controller: https://github.com/krumpholz/esphome-solarflow-ble/blob/c75879ab4f4c3905a07fbe8bc2422958ef9f45a2/solarflow_ble_controller.yaml
- ioBroker-Implementation: https://github.com/nograx/ioBroker.zendure-solarflow/blob/c496f3972064a4013b3d067eda7249109ff21b7f/src/models/deviceModels/ZenSdkIobDevice.ts
- ioBroker-Changelog: https://github.com/nograx/ioBroker.zendure-solarflow#changelog

## Validierung / Grenzen

27 Offline-Testgruppen: Rückbau ohne zeitgesteuerten Impuls, Migration ohne Übernahme eines aktiven84W-Auftrags, Standby-Eintritt, ungültiger PackState, laufende Rückmeldung, Grenzen, Vorrang normaler Anforderungen, Datenlücken und Diagnose-only bei Fehlern. Import und TXT enthalten exakt den getesteten Code.

Historischer Differenztest bei abgeschaltetem Nullausgleich:5390 Datensätze,5324 ausgeführte Takte,66 korrekte Auslassungen, keine Leistungs-/normalen Zustandsabweichungen gegen ZERO1. Das beweist die Erhaltung der normalen Regelung, nicht physikalischen Standby.

Mit aktivem Nullausgleich: Logs28/29 ergeben1195 identische Leistungs-/Richtungs-/Modus-Ausgaben und4 Auslassungen; enthalten laufende kleine Korrekturen und Übergang in echte Entladung. Keine gewöhnliche positive PV-Ladung in diesen beiden Logs. Der aktuelle84W-Impulslog wird nicht als geschlossene Simulation der neuen0W-Strategie missbraucht: seine Batteriemessungen sind Folge anderer Stellbefehle.

Anlagenmodell bleibtV16. Der aktuelle Versuch stützt am beobachteten kleinen Ladebetriebspunkt den lokalen Zusammenhang Batterie≈Ladeauftrag−24W, belegt aber keine allgemeine Standby-Zustandsdynamik. Kein erfundener Standby-Timer und keine neue globale Modellkalibrierung aus diesem kurzen Versuch.
