# Log11: Prüfung und Optimierungsentscheidung für den Ladebetrieb

## Ergebnis

**Keine zusätzliche Änderung des Lade-Reglers freigegeben.** Die getesteten Anpassungen erzielen kleine Vorteile in der bedingten Feldsimulation, verschlechtern aber unabhängige Rausch-/Störfälle. Die vorhandene Ladeabstimmung bleibt erhalten. Der bereits gelieferte **V4.25-SIM-Kandidat** kann als nächster Live-Test verwendet werden; er enthält ausschließlich die separat geprüfte Lastabfall-Anpassung. Es wird keine neue V4.26 erzeugt.

Das ist kein Nachweis eines physikalischen Optimums. Gerade die zeitweise Exportneigung und die Wolkenübergänge lassen Verbesserungspotenzial erkennen. Die jetzige Modellgüte trägt eine zusätzliche kleine Parameterkorrektur jedoch nicht zuverlässig.

## Was der Log tatsächlich enthält

Original`regler_event_log_11.jsonl`,SHA-256`e3d584e4017d521524dc0ea97ab4deee8343e0aa449da702bb053070d2c48556`.

- 12.10.2026,13:44:04–14:04:01 MESZ;581 Punkte,alleV4.24-SIM.
- PV315–1454W;540 Lade-/41 Entladepunkte. Entladung durchgehend freigegeben.
- 296 Ladepunkte im gewünschten PV-Bereich350–450W, entsprechend590,703s integrierten Intervallen.
- Insgesamt461 Normal-PV-Ladepunkte unter720W und79 High-/Very-High-Ladepunkte; darunter49High und30VeryHigh. Die hohen PV-Abschnitte sind dynamisch,keine ruhige Hoch-PV-Referenz.
- Großer Lastanstieg bei Zeile313,großer Abfall bei350. Damit ist es kein durchgehend reiner Lade-Log.
- Zwölf fehlende Zyklen in elf Lücken; Zeitspanne1196,655s,auswertbare zusammenhängende Intervalle1146,572s. Keine Energieintegration über Lücken.

## Messwerte zum gewünschten Ladebetrieb

Positives Netzsignal bedeutet Import,negatives Export. Geltendes Ladefenster **−5…+15W**, Ziel **+5W**.

| Auswahl | Punkte | Netzmittel | Im Fenster | Innerhalb Ziel±2W | Mittlerer absoluter Zielfehler |
|---|---:|---:|---:|---:|---:|
| Laden bei350–450W PV |296|+2,48W|73,68%|38,42%|8,60W|
| Davon ruhigere Abschnitte |176|+3,22W|89,32%|51,06%|4,73W|
| Gesamtes Normal-PV-Laden315–719W |461|−0,20W|63,18%|30,89%|17,67W|
| Davon ruhigere Abschnitte |235|+1,05W|83,81%|48,17%|6,48W|

Ruhiger bedeutet mindestens40s nach einer Loglücke bzw.|dLoadEst|>40W oder|dSolar|>30W. Diese Auswahl beruht auf Störungen, nicht auf günstigen Netzresultaten. Langsame PV-Rampen können weiterhin enthalten sein.

Die gewünschte Mitte wird damit noch nicht durchgehend erreicht. Der ruhige350–450W-Teil liegt1,78W unter dem Ziel,also etwas auf der Exportseite. Das Gesamtmittel allein würde die Abweichungen bei Wolken und Richtungswechseln verbergen. Der reine350–450W-Teil enthält auch Rückkehrphasen nach höheren PV-Werten.

![Messung und Gegenprüfung](sandbox:/workspace/scratch/4dde54cbfaec/results_regler_log11/Log11_Regelverhalten.png)

## Diagnose und vollständiger Code-Replay

Alle Kern-Snapshots und Batteriemessungen frisch,keine Zyklusabweichung;alle angehängten Snapshots passend. Alle acht BLE-Beobachter gültig,BLE bereit,keine HTTP-Diagnose.285HA-Aufrufe mit285Abschlüssen,keine Fehler/Sequenzkonflikte. MedianHA-Dauer114ms,Maximum1436ms. HA-Abschluss ist keine physikalische Gerätebestätigung.

V4.24 wird mit allen581 Punkten exakt reproduziert: Stellwerte,Richtung,Modus,HOLD,Integrator und angewendete Feinregelung; keine Konfigurationsabweichung. Nach Lücken werden die **vor dem Tick** liegenden Bestätigungszähler rekonstruiert. Der High-PV-Integrator berücksichtigt dabei den geloggten kausalen PV-Vorhalt. Ohne diese Zustandsrekonstruktion wäre der Replay an Lücken fehlerhaft.

## Modellprüfung

Das Batteriemodell wird zunächst ohne hinzugefügten Messresidual geprüft. Für eine kleine lokale Offsetanpassung werden die ersten240s verwendet; spätere Normal-PV-Punkte bleiben für die Prüfung zurückgehalten. Sechs Sekunden nach jedem neuen Modellabschnitt werden nicht gewertet.108 Trainings-/319 Prüfpunkte.

| Batteriemodell | Trainings-RMSE | Prüf-RMSE | Prüf-MAE |
|---|---:|---:|---:|
| Ursprüngliche Kennlinie |3,96W|7,39W|3,15W|
| Lokaler Offset ausLog8 |7,83W|10,61W|7,89W|
| Neu angepasster Offset |4,01W|7,53W|2,72W|

Der neue Offset würde von−19,268 auf−18,305W wechseln. Er verbessert die MAE, verschlechtert aber die RMSE und die größeren Abweichungen. Der ruhigere Teil hat bereits mit dem ursprünglichen ModellRMSE3,91W. Es wird **keine neue globale Kennlinie** übernommen. Die Log8-Korrektur bleibt als lokal begrenzter Unsicherheitsfall erhalten; sie darf nicht allein wegen ähnlicher PV-Höhe auf jeden Tag übertragen werden.

ModellV11 dokumentiert diese Gültigkeitsgrenzen und Prüfwerte. Physikalische Koeffizienten werden nicht künstlich passend gemacht. Ohne unabhängigen Hauslastzähler ist der Netzpfad nicht unabhängig identifiziert.

## Optimierungsprüfung

28 Kombinationen/Varianten wurden geprüft: Trimmschritt1–4W,Wartezeit4/6/8s,Zielband±1/±2W sowie Normal-PV-Exportverstärkung0,85/0,95/1,05/1,15. Auswahl anhand der ersten240s ausLog11 über drei Modellvarianten. Bewertet wurden Zielabweichung,Fenstertreffer und Stellaktivität.

Anschließend wurden die späteren Log11-Abschnitte sowieLog8 undLog5 über neun Anlagenmodelle mit/ohne festen Batterie-Residual geprüft. Die Simulation führt den vollständigen Regler aus. Netzstörung und Residual sind innerhalb jedes Modellvergleichs für alle Kandidaten gleich. Die Ladephase nach dem großen Richtungswechsel wird erst abZeile364 wieder simuliert; der gemischte Wechsel selbst ist nicht belastbar modelliert. Alle Lücken setzen den Zustand neu auf. High-PV-Ticks werden für die kausale Vorgeschichte mitgerechnet, jedoch nicht als Normal-PV-Ergebnis gewertet.

Eine genaue V4.24-Netzreproduktion in dieser Konstruktion ist eine Replay-Prüfung, keine unabhängige Anlagenvalidierung. Auf Log11 stimmen im nominalen Modell alle nachgerechneten Ladebefehle und Netzwerte der eingeschlossenen Ladeabschnitte mit dem Baseline-Log überein.

Der Trainingsgewinner **4W alle6s, Zielband±1W** verbessert auf späteren Normal-PV-Abschnitten die bedingte Simulation etwas: MAE19,23→18,99W,Fenster59,31→59,89%,Ziel±2W29,31→33,50% (Mittel über neun Modelle,mit festem Residual; ausschließlich ausgewählte Normal-PV-Ticks). Die ruhige Teilmenge verbessert ihre MAE8,09→7,78W. Auch ältere Logs zeigen kleine bedingte Vorteile. Das sind noch keine Live-Ergebnisse und die Absolutwerte unterscheiden sich wegen Segment-/Anlaufmasken von der Messwerttabelle.

Die anschließende Prüfung umfasst sechs bekannte physikalische Normal-PV-Szenarien über neun Modelle:konstantePV,Messrauschen,PV-Rampe,PV-Welle,Laststufen undPV-Stufen. Je Fall werden nach30s Einlaufzeit570s ausgewertet. Es wird kein gemessener Residual hinzugefügt.

| Variante | Mittlere MAE über54 synthetische Fälle | Entscheidung |
|---|---:|---|
| Bestehende V4.24-Ladeabstimmung |5,230W|beibehalten|
| Trim4W,6s,Band±1W |5,386W|verworfen|
| Trim4W,6s,Band±2W |5,440W|verworfen|
| Normal-PV-Export-P1,05 |5,404W|verworfen|

Beim engen Band verschlechtert sich insbesondere der Fall mit Messrauschen:MAE2,69→2,96W,AnteilZiel±2W46,74→36,10%. Bei PV-Wellen steigt dieMAE17,65→18,39W. Ein Vorteil bei der konstanten ruhigenPV und einzelnen Feldabschnitten reicht deshalb nicht aus. Die beiden weiteren Varianten waren vorab bereits in der28er-Kandidatenmenge und wurden als konservativere Alternativen gegengeprüft; auch sie liefern keinen robusten Gesamtvorteil. Die zusätzliche Gegenprüfung wird nicht als unberührter Beweis einer nachträglich ausgewählten Abstimmung dargestellt.

**Es wird keine zusätzliche Ladeparameteränderung inV4.25 eingebaut.** Damit vermeiden wir, eine kleine Verbesserung dieses Logs durch schlechteres Verhalten bei Rauschen oder Wolken zu erkaufen. Dies ist die Entscheidung für die getesteten Kandidaten, kein mathematischer Nachweis, dass jede andere Abstimmung schlechter sein muss.

## High-PV: erstmals reale V4.24-Dynamik vorhanden

Bei allen79 High-/Very-High-Punkten ist`highPvControl.active=true`,Fensterverschiebung0W undArbeitsziel−5W. Die neue Logik ist damit real aktiviert und diagnostisch korrekt.

Die Leistung springt jedoch schnell. In diesen ausgewählten High-PV-Intervallen:Netzmittel−184,1W,84,42% Zeit ohne Import,Export8,324Wh,Import0,447Wh,Netz−756…+189W. Beim weiteren PV-Abfall treten nach Rückkehr inNormal-PV noch größere Importabweichungen auf. Die langsameHigh-PV-Aufwärtsrampe20W/Takt kann steile PV-Anstiege nicht vollständig aufnehmen. Das erklärt einen wesentlichen Teil der Exportphasen,beweist aber keinen optimalen Rampenwert.

Das Ziel einer sehr zuverlässigen Importvermeidung ist bei diesen schnellen Übergängen noch nicht vollständig erfüllt. Es gibt keine ruhigen High-PV-Punkte nach dem festgelegten40s-Kriterium. Dieser Log ist daher ein dynamischer Belastungstest,keine Bestätigung einer ruhigenRegellage an−5W. High-PV-Parameter werden aus der Normal-PV-Optimierung nicht beiläufig verändert.

## Zweite Bestätigung des Lastabfall-Befunds

Bei Zeile350 fällt die bilanzierte Hauslast um2186W auf85W. PV316W,Batterie−1951W,Netz−2182W. Trotz etwa231W PV-Überschuss ohne Batterieentladung fordertV4.24 noch199W Entladung an:

`1951 + 0,8 × (−2182 −7,5) ≈199,4W`.

Die vorbereiteteV4.25-Regel erkennt diesen großen frischen Lastabfall mit verbleibendem PV-Überschuss und setzt das Entladesoll im ersten betroffenen Tick auf0W. Auf denselben eingefrorenen Logeingängen verändert sich genau dieser Stellwert; alle übrigen Stellwerte,Richtungen,HOLD-Zustände und Ziele sind gleich.

Direkt danach fehlt ein Zyklus. Der Replay wird dort aus dem beobachtetenV4.24-Zustand neu gestartet. Deshalb wird keine lückenlose V4.25-Trajektorie über diese Pause behauptet und keine zusätzliche Einsparung für den zweiten Lastabfall aus diesem offenen Replay berechnet. Insbesondere bleibt die erste beobachtete Exportspitze kausal vor der neuen Stellwirkung bestehen.

## Nächster Live-Stand

Der bereits gelieferteV4.25-SIM-Kandidat bleibt unverändert:

SHA-256`70935e53246a01031ad4d93a2959d8b7580b6b267873f43bbcbf62100aed22f0`.

Nur die bestehende Regler-Function ersetzen; Diagnosenodes bleiben bestehen. Vier Ausgänge:Richtung/Laden/Entladen/Status. Kein neuer Code für den Ladezweig nötig. Ein eigener V4.26-Stand wäre nach dieser Prüfung nicht begründet.

Für die nächste Live-Validierung sind die ruhigen350–450W-Ladeabschnitte und der große Lastabfall weiterhin relevant. Zusätzlich sollten steilePV-Anstiege/-Abfälle und eine längere ruhigeHigh-PV-Phase separat beurteilt werden. Der Regler wurde hier nicht an der Anlage installiert und nicht aufGitHub veröffentlicht.
