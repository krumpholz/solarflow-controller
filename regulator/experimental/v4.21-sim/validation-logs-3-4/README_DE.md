# V4.21-Feldvalidierung und Simulationsmodell V4

[English](README.md) | **Deutsch**

Zwei neue Anlagenlogs vom 11.10.2026 zeigen den unveränderten V4.21-Code:
12:24–12:44 Uhr mit PV 501–2.036 W und 13:04–13:24 Uhr mit PV 288–628 W.
Bei durchgehend gesperrter Entladung bleiben alle Entladeanforderungen 0 W
und die Richtung Laden/Standby. Alle drei Lastabfälle führen am ersten
verfügbaren Regeltakt wieder zu einer Ladeanforderung. Im ruhigeren Log
beginnen drei folgende Fensterpunkte nach 18 beziehungsweise 12 Sekunden.

Das bestätigt die neue Richtungslogik in diesen Betriebsbedingungen.
Es bestätigt weder die Nachtänderung noch erlaubtes Entladen oder anhaltendes
Very-High-PV-Laden: die meisten hohen PV-Punkte liegen unter hoher Hauslast
im Ladestillstand. Der erste Solarabschnitt des ruhigeren Logs liegt bei
−4,53 W Mittel, 12,41 W MAE zur +5-W-Mitte und 38,02 % Fensterzeit.
Gewollter Netzbezug während gesperrter Entladung wird separat bewertet.

## Modellverbesserungen

- Passende Snapshot-Empfangszeiten und korrekt initialisierter HOLD/I-Zustand;
  der veraltete zusätzlich angehängte Snapshot der ersten Zeile wird isoliert.
- Eigenes −18-W-Standby-Telemetrieniveau aus 37 Trainingspunkten ohne Log 4.
  Log-4-Batteriemodell-MAE sinkt von 1,62 auf 1,22 W; aktive Dynamik bleibt
  fast unverändert. Die bisherigen nominalen Stellantworten bleiben erhalten.
- Neue kalibrierte relative PV-Phase und Varianten ohne Phase beziehungsweise
  mit separaten String-Phasen. Im späteren Prüfabschnitt sinkt RMSE gegenüber
  der bisherigen Phase von 87,81 auf 62,32 W; ohne Phase sind es 59,86 W.
  Das zeigt verbleibende Zeitlage-/Hauslastunsicherheit.
- Asymmetrische Fenster auch bei wechselnder PV-Klasse und erlaubter
  stationärer Zielbereich bei Entladesperre.

Die negative relative PV-Phase dient ausschließlich der Offline-Rekonstruktion.
Der Regler erhält keinen zukünftigen PV-Wert. Hausleistung ist eine abgeleitete
Bilanz, kein unabhängiger Sensor; echte Befehls-/ACK-/Anwendungszeiten fehlen.
Geschlossene Wiedergabe nutzt eine aus dem Log rekonstruierte, für alle
Varianten feste Nettolast und ist keine unabhängige Solar-/Lastvorhersage.

## Parameter bleiben unverändert

Höhere PV-Aufwärtsschritte verbessern den schnellen Log, können im Modell
aber die positive Gegenspitze um bis zu 105 W erhöhen. Eine 90-W-Laderampe
verschlechtert den früheren und den ruhigeren Log. Beide Versuche bleiben
Diagnosefälle; kein neuer Regler wird daraus erzeugt. Eine natürliche
Tages-Optimierungsgrenze ist nicht nachgewiesen.

## Dateien und Prüfung

- [Ausführliche Analyse](Regler_V4_21_Feldvalidierung_DE.md)
- [Modell V4 einschließlich Grenzen und alternativer Fits](Regler_Modell_V4.json)
- [Aggregierte Mess-/Simulationsergebnisse](Regler_V4_21_Validierung_Ergebnisse.json)
- [Prüfergebnis](verification.json)
- [Unveränderter vollständiger V4.21-Code](../Regler_V4_21_SIM.js)

Acht zusätzliche Prüfgruppen bestehen: 1.767 genaue Codevergleichspunkte,
darunter 1.188 V4.21-Feldpunkte; 30 geschlossene Wiedergaben und 45 Diagnosefälle
mit eingehaltenen Ausgangsgrenzen und Entladesperre. Python und JavaScript
erzeugen dieselben 591 ungerundeten Batteriewerte. Ein privates Paket enthält
die drei richtigen Tageslogs und die ausführbare Reproduktion. Rohlogs und
Anlagenexporte werden nicht veröffentlicht. Wirkungsgrad-Release v5.1.0
und Reglercode bleiben unverändert.

![Feldvalidierung](Regler_V4_21_Feldvalidierung.svg)

![Modellprüfung](Regler_Modell_V4_Pruefung.svg)
