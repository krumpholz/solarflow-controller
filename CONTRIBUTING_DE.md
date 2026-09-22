# Mitarbeit

[English](CONTRIBUTING.md) | **Deutsch**

Beiträge zu SolarFlow Controller sind willkommen.

## Fehlermeldungen

Damit sich ein Problem nachvollziehen lässt, gib bitte Folgendes an:

- Repository-Commit und Berechnungsrevision.
- Versionen von Node-RED, Home Assistant und den betroffenen Integrationen.
- Batteriemodell und Firmwareversion.
- Erwartetes und tatsächliches Verhalten.
- Ein kurzes, bereinigtes Diagnoseprotokoll, zugehörige Lade-/Entladezählerstände, SOC und Zeitstempel.

Nenne Einheiten, Vorzeichenkonventionen und Abtastintervalle. Veröffentliche keine Passwörter, Zugriffstokens, privaten Schlüssel, Gerätekennungen oder persönlichen Netzwerkdetails.

## Änderungen

Halte Änderungen auf ein klares Ziel begrenzt und erkläre ihre Auswirkungen auf Berechnung, Zustandskompatibilität und Eingabebehandlung. Verwende synthetische Daten in Beispielen und Regressionstests.

Erhalte den Hinweis auf die Unabhängigkeit des Projekts und bestehende Urheberrechtshinweise. Beiträge werden unter der MIT-Lizenz dieses Repositorys bereitgestellt.

## Node-RED-Flows teilen

Prüfe das vollständige exportierte JSON vor dem Commit. Entferne Zugangsdaten, anlagenspezifische Servereinstellungen, private URLs und Kennungen. Verwende deutlich markierte Platzhalter, wo eine individuelle Konfiguration erforderlich ist.

Füge keine produktiven Node-RED-Zugangsdaten-Dateien oder Laufzeitzustände hinzu.

## Wartung für Entwickler

Die Regressionstestquellen liegen in `round-trip-efficiency/tests/`. Vom Repository-Hauptverzeichnis mit Node.js ausführen:

```sh
TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
EFFICIENCY_LANGUAGE=de TZ=Europe/Berlin node --test round-trip-efficiency/tests/efficiency.test.cjs
node --test round-trip-efficiency/tests/localization.test.cjs
```

Englische Funktionsquellen bearbeiten und ihre Kopien in `flow.json` sowie im Textdownload der Berechnung synchronisieren. Mit `python round-trip-efficiency/build-german-flow.py` deutsche Quellen und Export neu erzeugen. Beide Sprachversionen und das bestehende Zustandsschema erhalten, sofern keine ausdrückliche Kompatibilitätsänderung dokumentiert wird. Simulationen zertifizieren keine Messgenauigkeit.

## V4 Entwicklung

```sh
python rolling-efficiency/build.py
TZ=Europe/Berlin node --test rolling-efficiency/tests/*.test.cjs
```
