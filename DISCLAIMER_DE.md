# Umfang und Gewährleistung

[English](DISCLAIMER.md) | **Deutsch**

SolarFlow Controller ist ein inoffizielles Community-Projekt. Es besteht keine Verbindung zu Zendure; das Projekt wird von Zendure weder gesponsert noch zertifiziert oder unterstützt. Produktnamen und Marken gehören den jeweiligen Rechteinhabern.

Der derzeit in diesem Repository enthaltene Bestandteil berechnet den Batterie-Wirkungsgrad. Er liest Messwerte und veröffentlicht einen Home-Assistant-Sensor; er sendet keine Lade-, Entlade-, Leistungsgrenzen- oder Betriebsmodusbefehle.

Das Ergebnis hängt von Zählergenauigkeit, Messgrenzen, eingestellter Batteriekapazität, SOC-Schätzung, BMS-Neukalibrierung, Quellenzeitversatz und ausgeschlossenen Intervallen ab. Es ist keine zertifizierte Wirkungsgradmessung und garantiert weder eine bestimmte Energieeinsparung noch einen bestimmten Eigenverbrauch. Formel und Datenbehandlung stehen in der Komponentenanleitung.

Nutzer sind dafür verantwortlich, Eingaben, Einheiten, Kapazität, Leistungsgrenzen, Zeitzone und dauerhaften Speicher auf ihre Anlage abzustimmen. Die Auswertung ersetzt weder Herstellerschutzfunktionen noch Batteriemanagement oder zertifizierten Netzschutz. Separate Automationen, die das Ergebnis verwenden, müssen Unbekannt und nicht verfügbare Daten angemessen behandeln.

Die Software wird ohne Gewährleistung gemäß der [MIT-Lizenz](LICENSE) bereitgestellt.
