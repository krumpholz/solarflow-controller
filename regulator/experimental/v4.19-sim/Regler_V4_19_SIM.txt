/**
 * REGLER V4.19-SIM — Testvariante aus der Simulation vom 10.10.2026.
 * Vier Ausgänge wie V4.18: Richtung, Laden W, Entladen W, Status.
 * Optimierung aktiv bei PV <= 50 W. Oberhalb davon ursprüngliche V4.18-Regelung.
 * Fenstergrenzen und Sollmitten bleiben aus dem Flow; kein Zielwert auf 0 W umgestellt.
 * Grobregelung: P=0.80, max. 1200 W/Tick aufwärts, bis 6 s auf Tracking warten.
 * Deutlicher Export: P=1.00 erst bei Tracking oder Exportbestätigung.
 * Feinregelung bis 30 W Abweichung: letzte Anforderung vorsichtig zur Mitte führen.
 * HOLD nur in der Mitte +/-2 W; max. 2 W Korrektur im Fenster,
 * max. 6 W nahe außerhalb, mindestens 6 s nach der letzten Stelländerung.
 * SOC-Sperren, Snapshotprüfung, Richtungslogik und vier Ausgänge bleiben erhalten.
 * Das Modell ist näherungsweise; reale Bestätigung steht aus.
 */
const VERSION = "4.19-SIM";

// Optimierung aus dem Nachtlog vom 10.10.2026; nur bei PV <= 50 W aktiv.
// Simulationsergebnis, noch keine Validierung an der realen Anlage.
const optimizedPvMaxW = 50;
const errGainDischargeOptimized = 0.80;
const stepUpDischargeOptimizedW = 1200;
const errGainDischargeLargeExport = 1.00;
const dischargeLargeExportThresholdW = 150;
const dischargePendingToleranceW = 180;
const dischargePendingMaxWaitMs = 6000;
const centerTrimBandW = 2;
const centerTrimOuterBandW = 30;
const centerTrimMaxStepW = 2;
const centerTrimMaxOutsideStepW = 6;
const centerTrimWaitMs = 6000;
const centerTrimGain = 1;
const centerTrimTrackingToleranceW = 20;


// ----------------- Konstanten
const batt_power_max = 2400;

// ----------------- GETRENNTE RAMPEN 3.3
// Laden bewusst deutlich ruhiger.
// Ziel:
//  - weniger Nachschwingen nach Last-aus
//  - weniger charge_import/export-Flattern
//  - ruhigeres Einschwingen in stabilen Zustand
//
// Entladen bleibt dynamischer,
// damit Lastsprünge weiterhin sauber abgefangen werden.

// ----------------- Laden
const stepUpChargeW = 60;              // 80 110 130 180 240 300 360 520 400 500 380 320 220 max Erhöhung Ladeleistung pro Tick
const stepDownChargeW = 130;           // 160 240 2000 1600 1500 1300 max Absenkung Ladeleistung pro Tick
const stepDownChargeHighPVW = 360;     // 320 260
const stepDownChargeVeryHighPVW = 480; // 400 320

// ----------------- Entladen
const stepUpDischargeW = 300;          // 240 300 360 520 400 500 380 320 220 max Erhöhung Entladeleistung pro Tick
const stepUpDischargeLoadStepW = 900;  // V4.2: nur bei bestätigtem Lastsprung / Latch schneller Entladeaufbau

// ----------------- DYNAMISCHER ENTLADE-STEP-DOWN 4.8
// Im normalen Entlade-Regelbetrieb wird der Sollwert bewusst gedämpft abgesenkt.
// Dadurch kann ein einzelner Exportimpuls bei träger Batterie den Entladesollwert
// nicht mehr sofort vollständig auf 0 W zusammenbrechen lassen.
//
// Der schnelle Step-down bleibt für echte Lastabfälle und deutlichen Export erhalten,
// damit nach dem Abschalten einer großen Last kein langer Export-Rebound entsteht.
const stepDownDischargeNormalW = 250;  // W/Tick normale Absenkung der Entladeleistung
const stepDownDischargeFastW = 2000;   // W/Tick schnelle Absenkung bei echtem Lastabfall / starkem Export

// Freigabeschwellen für den schnellen Entlade-Step-down.
// Vorzeichen Zähler:
//   positiv = Import
//   negativ = Export
const dischargeFastStepDownExportW = 250;    // W: schneller Abbau bei p_zaehler < -250 W
const dischargeFastStepDownLoadDropW = 500;  // W/Tick: schneller Abbau bei dLoadEst < -500 W
// ----------------- FAST-STEP-DOWN EXPORTBESTÄTIGUNG 4.9
//
// Ein einzelner Exportwert darf bei einer trägen Batterie nicht sofort
// den maximal schnellen 2000-W-Step-down freigeben.
const dischargeFastExportConfirmTicks = 2;

// Batterie gilt als ausreichend am bisherigen Sollwert angekommen,
// wenn Ist-Entladeleistung und letzter Sollwert maximal so weit abweichen.
const dischargeFastBattTrackingToleranceW = 180;

// Kompatibilität für bestehende Logs und Statusfelder.
// Das bisherige Feld stepDownDischargeW bleibt erhalten und zeigt weiterhin
// den maximal möglichen schnellen Step-down.
const stepDownDischargeW = stepDownDischargeFastW;

// ----------------- Kompatibilität für bestehende Logs/Status
// Alte Felder bleiben erhalten.
// Die echte Regelung nutzt:
//
//  Laden:
//   - stepUpChargeW
//   - stepDownChargeW beziehungsweise PV-abhängige Lade-Step-down-Werte
//
//  Entladen:
//   - stepUpDischargeW beziehungsweise stepUpDischargeLoadStepW
//   - stepDownDischargeNormalW im normalen Regelbetrieb
//   - stepDownDischargeFastW nur bei echtem Lastabfall oder starkem Export
//
// stepDownW bleibt als Kompatibilitätsfeld auf dem maximalen schnellen Wert.
const stepUpW = stepUpChargeW;
const stepDownW = stepDownDischargeFastW;

// ----------------- LOW-PV Schwellwert
const pvLowThreshold = 280; // W 220

// ----------------- HIGH-PV Schwellwert
const pvHighThreshold = 720; // W 800

// ----------------- VERY-HIGH-PV Schwellwert
const pvVeryHighThreshold = 1050; // W

// ----------------- HIGH-/VERY-HIGH-PV FENSTERVERSCHIEBUNG 2.5
// Das Ladefenster wird bei hoher PV exportseitig verschoben.
// Beispiel Basisfenster [-10 .. +5]:
//  High-PV Offset 15 W      -> [-25 .. -10]
//  Very-High-PV Offset 25 W -> [-35 .. -20]
// Dadurch wird Import reduziert, ohne den Regler aggressiver zu machen.
const pvWindowOffsetHighPV = 18;      // W 15
const pvWindowOffsetVeryHighPV = 22;  // W 24 22 28 30 25

// ----------------- PV Schwellwert Entladen
const pvDischargeThreshold = 300; // W

// ----------------- HIGH-/VERY-HIGH-PV SEITEN-HYSTERESE 3.2
// Nur für die Import-/Export-Seitenwahl im Ladezweig.
// Low-/Normal-PV bleiben exakt unverändert.
// High-/Very-High-PV bekommen eine kleine Hysterese gegen 1-2-Tick-Flattern
// zwischen charge_import_* und charge_export_*.
const chargeSideHystHighPV = 10;      // 12 10 6 W, nur High-PV
const chargeSideHystVeryHighPV = 14;  // 16 14 18 20 24 16 8 W, nur Very-High-PV

// ----------------- INTERNE RICHTUNGSENTSCHEIDUNG 3.1
// Übernommen aus dem bisherigen vorgelagerten Richtungsnode.
// Diese Logik erzeugt die Roh-Richtung desiredDirRaw.
// Danach prüfen DirectionGuard und AntiFlip die endgültige effectiveRichtung.
const solar_min = 50;           // W Mindest-PV für LADEN

// getrennte Hysterese
const margin_chargeW = 10;          // ENTLADEN -> LADEN
const margin_dischargeW = 140;      // LADEN -> ENTLADEN normal
const margin_dischargeLowPVW = 10;  // V4.5: LADEN -> ENTLADEN bei Low-PV früher freigeben

// asymmetrische Confirm-Zeiten der internen Richtungsentscheidung
const confirm_toDischargeN = 10;        // LADEN -> ENTLADEN normal
const confirm_toDischargeLowPVN = 3;    // V4.5: LADEN -> ENTLADEN bei Low-PV schneller bestätigen
const confirm_toChargeN = 3;            // ENTLADEN -> LADEN

// Zusatzsicherung: ab welchem Export ENTLADEN verboten ist
const exportBlockW = 0;         // W: wenn p_zaehler < exportBlockW => niemals ENTLADEN

// ----------------- Richtungs-Schutz 2.1
// Wechsel ENTLADEN -> LADEN nur zulassen, wenn echter Überschuss vorliegt
const dirGuard_chargeMarginW = 35;               // zusätzlicher Export unter p_o_b_out erforderlich
const dirGuard_surplusMarginW = 40;              // 50 60 80 PV muss Hauslast um diesen Wert übersteigen
const dirGuard_maxBattDischargeForChargeW = 220; // 160 120 solange Batterie noch stärker entlädt, nicht auf LADEN wechseln

// ----------------- HOLD-Bestätigung 2.2
const holdConfirmTicks = 2; // HOLD-Eintritt erst nach 2 bestätigten Ticks im Fenster

// getrennte Fehler-Skalierung Laden / Entladen
// Laden jetzt asymmetrisch:
//  - Importseite  : p_zaehler > p_o_max_eff
//      - Normal       : p_solar < pvHighThreshold
//      - High PV      : pvHighThreshold <= p_solar < pvVeryHighThreshold
//      - Very High PV : p_solar >= pvVeryHighThreshold
//  - Exportseite  : p_zaehler <= p_o_max_eff
//      - Low PV       : p_solar < pvLowThreshold
//      - Normal       : pvLowThreshold <= p_solar < pvHighThreshold
//      - High PV      : pvHighThreshold <= p_solar < pvVeryHighThreshold
//      - Very High PV : p_solar >= pvVeryHighThreshold
const errGainChargeImport = 1.02;              // 1.14 1.18 1.12 1.11 1.10 1.09 1.08 1.07 1.06 1.03 0.99 1.00 1.01 1.02 1.02 1.03 1.04 1.05 1.06 1.07 1.08 1.09 1.08 1.00
const errGainChargeImportHighPV = 1.00;        // 1.04 1.10 1.08 1.16 NEU 2.5: High-PV Import mit Very-High-PV zusammengeführt
const errGainChargeImportVeryHighPV = 1.04;    // 1.06 1.04 1.02 1.00 0.94 0.90 0.94 1.00 1.02 1.10 1.18 1.25 NEU 2.5: Very-High-PV Import nicht mehr aggressiver, Offset übernimmt Importsicherheit
const errGainChargeExport = 1.00;              // 0.98 1.02 1.08 1.19 1.21 1.22 1.23 1.24 1.25 1.27 1.29 1.31 1.33 1.31 1.33 1.34 1.33 1.32 1.31 1.28 1.18 1.14 Normal-PV Export
const errGainChargeExportLowPV = 0.93;         // 0.94 0.92 0.90 0.94 0.88 1.00 1.10 1.20 1.39 1.39 1.41 1.43 1.44 1.43 1.45 1.44 1.36 Low-PV Export 1.34 1.26
const errGainChargeExportHighPV = 0.98;        // 1.02 1.06 1.13 1.15 1.17 1.20 1.25 1.24 1.23 1.20 High-PV Export
const errGainChargeExportVeryHighPV = 0.94;    // 0.93 0.92 0.94** 0.90 0.88 0.92 1.00 1.04  1.08 1.20 1.24 1.30 1.34 Very-High-PV Export
const errGainDischarge = 0.86;                 // 0.91 0.89 0.93 0.92** 0.91 0.93 0.95 0.99 0.97 - 0.91 war die Untergrenze
const errGainDischargePV = 0.80;               // 0.86 0.90 0.88 0.91 0.96 0.96* 0.98 0.99 1.01 1.02 1.03 1.03 1.03 1.04 1.02 0.94 1.02 1.08 1.18

// ----------------- I-Komponente Parameter
// Laden getrennt optimiert
// Importseite: Bezug aktiv abbauen
const iGainChargeImport = 0.0014;    // 0.0014 0.0014 0.0018 0.0022 0.0023 0.0025 0.0026 0.0028 0.0030 0.0032 0.0035 0.0038 0.0040 0.0045 0.0035
const iMaxWChargeImport = 2;         // 2 1 2 2 2 3 3 4 5 6 7 8 9 10 8
const iErrMinWChargeImport = 8;      // 9 10 12 11 10 9 9 8 7 6 5 4 4 3 4
const iDecayHoldChargeImport = 0.35; // 0.35 0.35 0.50 0.54 0.58 0.62 0.64 0.68 0.72 0.75 0.78 0.80 0.82 0.085 0.82

// High-PV Importseite: bei hoher PV nicht leicht positiv im Import stehen bleiben
const iGainChargeImportHighPV = 0.0014;      // NEU 2.3: bewusst klein wie Normal-Import
const iMaxWChargeImportHighPV = 2;           // NEU 2.3: keine zusätzliche Integrator-Öffnung
const iErrMinWChargeImportHighPV = 8;        // NEU 2.3: identisch Normal-Import
const iDecayHoldChargeImportHighPV = 0.35;   // NEU 2.3: identisch Normal-Import

// Very-High-PV Importseite: bei sehr hoher PV stärker P-geführt Richtung Exportgrenze
const iGainChargeImportVeryHighPV = 0.0014;      // NEU 2.3: I klein lassen gegen Schwingneigung
const iMaxWChargeImportVeryHighPV = 2;           // NEU 2.3: keine zusätzliche Integrator-Öffnung
const iErrMinWChargeImportVeryHighPV = 8;        // NEU 2.3: identisch Normal-Import
const iDecayHoldChargeImportVeryHighPV = 0.35;   // NEU 2.3: identisch Normal-Import

// Exportseite: Exportsprünge zulassen, weicher zurückführen
const iGainChargeExport = 0.0076;       // 0.0080 0.0074 0.0072 0.0074 0.0072** 0.0065 0.0078 0.0106  0.0112 0.0116 0.0118 0.0122 0.0126 0.0132 0.0138 0.0143 0.0150 0.0145 0.0153 0.0154 0.0153 0.0152 0.0150 0.0140 0.0115 0.0105 Normal-PV Export
const iMaxWChargeExport = 13;           // 11 10 9 10 9** 8 11 16 18 19 20 21 22 24 26 27 29 28 30 28 24 22 Normal-PV Export
const iErrMinWChargeExport = 8;         // 9 11 10 10 9 10** 9 8 8 7 6 5 4 4 3 3 2 unverändert
const iDecayHoldChargeExport = 0.77;    // 0.76 0.77 0.76** 0.74 0.80 0.885 0.900 0.910 0.915 0.925 0.935 0.945 0.995 0.962 0.968 0.965 0.971 0.97 0.965 0.96 Normal-PV Export

// Low-PV Exportseite: bei wenig PV Fenstermitte besser treffen
const iGainChargeExportLowPV = 0.0070;      // 0.0065** 0.0060 0.0054 0.0048 0.0074 0.0078 0.0076 0.0065 0.0100 0.0140 0.0208 0.0220 0.0235 0.0240 0.0230 0.0245 0.024 0.020 0.018 0.015
const iMaxWChargeExportLowPV = 12;          // 10 6 11 13 12 10 16 22 38 41 42 40 43 42 36 32 28
const iErrMinWChargeExportLowPV = 7;        // 8 9 12 8 7 6 5 4 3 2 2
const iDecayHoldChargeExportLowPV = 0.84;   // 0.80 0.72 0.86 0.89 0.88 0.86 0.92 0.0940 0.974 0.982 0.9865 0.9875 0.985 0.9885 0.988 0.985 0.982 0.975

// High-PV Exportseite: bei hoher PV Fenstermitte besser treffen
const iGainChargeExportHighPV = 0.0058;     // 0.0072 0.0088 0.0096 0.0102 0.0112 0.0129 0.0128 0.0127 0.0125 0.0120
const iMaxWChargeExportHighPV = 8;          // 12 16 18 20 23 27 26
const iErrMinWChargeExportHighPV = 7;       // 6 5 4 2
const iDecayHoldChargeExportHighPV = 0.84;  // 0.910 0.930 0.940 0.952 0.969 0.968

// Very-High-PV Exportseite: bei sehr hoher PV Import vermeiden und High-PV-Niveau erreichen
const iGainChargeExportVeryHighPV = 0.0052;     // 0.0048 0.0066 0.0075 0.0092 0.0105 0.0135 0.0160
const iMaxWChargeExportVeryHighPV = 6;          // 5 10 13 18 22 28 34
const iErrMinWChargeExportVeryHighPV = 8;       // 9 7 6 4 2
const iDecayHoldChargeExportVeryHighPV = 0.78;  // 0.74 0.80 0.85 0.930 0.945 0.968 0.975

// Gemeinsame Lade-Parameter für Blockierung / Speicherung / HOLD-Basis
const iDecayBlockedCharge = 0.35;

// Gemeinsame Lade-HOLD-Parameter
// HOLD soll unverändert und stabil auf dem zuletzt erreichten Ladepunkt arbeiten.
// Dafür nutzen wir einen gemeinsamen konservativen HOLD-Abbau.
const iDecayHoldCharge = 0.86;
const iMaxWCharge = Math.max(
  iMaxWChargeImport,
  iMaxWChargeImportHighPV,
  iMaxWChargeImportVeryHighPV,
  iMaxWChargeExport,
  iMaxWChargeExportLowPV,
  iMaxWChargeExportHighPV,
  iMaxWChargeExportVeryHighPV
);

// Entladen getrennt optimiert
const iGainDischarge = 0.0008;     // 0.0010 0.0012 0.0011 0.0015 0.0014 0.0015 0.0015 0.0016 0.0017 0.0018 0.0019 0.0020 0.0022 0.0024 0.0022 (1kW sprung besser)
const iMaxWDischarge = 2;          // 3 4 4 5 5** 5 6 7 8 9 10 11
const iErrMinWDischarge = 16;      // 14 12 13 14 13 14 14 13 12 11 10 9 8 9 (1kW sprung besser)
const iDecayHoldDischarge = 0.28;  // 0.32 0.36 0.44 0.42 0.44 0.40 0.46 0.50 0.54 0.58 0.62 0.66 0.70 0.66 (1kW sprung besser)
const iDecayBlockedDischarge = 0.35;

// PV-Entladen: bei hoher PV Import vermeiden und Moduskippen reduzieren
const iGainDischargePV = 0.0011;     // 0.0013 0.0012 0.0015 0.0023 0.0026 0.0029 0.0032 0.0036 0.0040 0.0037 0.0040 0.0042 0.0058 0.0038 0.0045 0.0065
const iMaxWDischargePV = 2;          // 3 3 4 5 6 7 8 9 11 9 11 12 22 14 18 28
const iErrMinWDischargePV = 16;      // 14 15 13 12 11 10 9 8 9 8 8 6 7 6 5
const iDecayHoldDischargePV = 0.22;  // 0.26 0.24 0.28 0.34 0.40 0.45 0.50 0.56 0.64 0.60 0.64 0.68 0.78 0.72 0.74 0.78

// ----------------- HOLD Absicherung
const holdMinActiveW = 20; // 30 50 HOLD nur wenn letzter Sollwert sinnvoll > 0

// ----------------- ANTI-FLIP Parameter
const antiFlipEnabled = true;

// ----------------- ASYMMETRISCHES ANTI-FLIP 2.4
// LADEN -> ENTLADEN bleibt streng gegen kurze Fehlentlade-Bursts.
// ENTLADEN -> LADEN wird schneller bestätigt, damit nach Lastabfall
// bei starkem Export zügiger zurück in den Lademodus gewechselt wird.
const antiFlip_confirmN_toDischarge = 10;      // LADEN -> ENTLADEN normal
const antiFlip_confirmN_toDischargeLowPV = 3;  // V4.5: LADEN -> ENTLADEN bei Low-PV schneller bestätigen
const antiFlip_confirmN_toCharge = 3;          // ENTLADEN -> LADEN
const antiFlip_minHoldMs = 5000;               // 3000 2500 2000 Mindestzeit zwischen zwei Switches (0 = aus)

// ----------------- LASTSPRUNGERKENNUNG 3.5
// Ziel:
//  - Nur LADEN -> ENTLADEN beschleunigen.
//  - p_haus wird NICHT verwendet.
//  - Ein Lastsprung wird aus der solarbereinigten Zähleränderung erkannt:
//      dLoadEst = Δp_solar + Δp_zaehler - Δp_batterie
//  - Wenn Solar nicht springt, Batterie-Istwert nicht stark springt
//    und der Sollwert nicht stark geändert wurde, ist ein starker positiver
//    Zählersprung sehr wahrscheinlich ein echter Lastsprung.
//  - Das Laden darf weiterhin auf 0 W zurückfahren.
//  - Die Umschaltung auf Entladen wird aber bei sicherem Lastsprung
//    schneller freigegeben.
const loadStepDetectionEnabled = true;
const loadStepToDischargeW = 500;            // W Lastsprunggrenze für LADEN -> ENTLADEN
const loadStepSolarStableW = 120;            // W Solar darf nicht stark springen
const loadStepBattStableW = 300;             // 180 W Batterie-Ist darf nicht stark springen
const loadStepSollStableW = 180;             // W Sollwert darf nicht stark geregelt worden sein
const loadStepImportMinW = 80;               // W Import oberhalb Fenster muss eindeutig sein
// Ein Lastsprung ist als Delta-Ereignis normalerweise nur in einem Tick sichtbar.
// Die weitere Wirkung wird anschließend durch Richtungslatch und Kick-Hold gehalten.
const loadStepConfirmTicks = 1;
const loadStepChargeFirstImportMarginW = 30; // W: Entladen nur wenn Import auch ohne aktuelles Laden bleiben würde
const chargeFirstHardBlockReleaseW = 25;     // W: harte zNoCharge-Sperre erst bei eindeutigem Export nach Ladestopp
// Kompatibilitäts-/Debugfeld.
// dLoadEst dient nur zur Erkennung des Lastsprungs und wird nicht
// zusätzlich auf das bereits vollständige Leistungsdefizit addiert.
const loadStepKickFactor = 0;
const loadStepKickReserveW = 25;            // 100 W zusätzliche Reserve für Lastsprung-Entlade-Kick

// ----------------- LASTSPRUNGERKENNUNG KICK-HOLD 4.9
//
// Der erkannte Lastsprungwert wird nur kurz gehalten.
// Nicht über den gesamten 8-Tick-Richtungslatch, weil eine Last
// zwischenzeitlich auch wieder wegfallen kann.
const loadStepKickHoldTicks = 3;

// Bei eindeutigem Lastabfall oder deutlichem Export wird der
// gespeicherte Kick sofort freigegeben.
const loadStepKickAbortExportW = 150;

// ----------------- PV-FOLLOW-GUARD 3.6
// Ziel:
//  - Nur Ladeleistungs-Erhöhungen bei High-/Very-High-PV begrenzen.
//  - Kurze PV-Spitzen / Wolkenlücken sollen die Batterie nicht sofort hochziehen.
//  - PV-Abfall und Importkorrektur bleiben schnell und unverändert.
//  - PI-Regler, Fenster, HOLD, DirectionGuard und Lastsprungerkennung bleiben unverändert.
const pvFollowGuardEnabled = true;
const pvFollowStableBandW = 90;                  // W: Solar gilt innerhalb dieses Δ-Bandes als stabil
const pvFollowFallAbortW = 90;                   // W: erst ein deutlicher Solar-Abfall setzt die Bestätigung zurück
const pvFollowRiseMarginW = 30;                  // W: Guard greift nur bei echter Ladeleistungs-Erhöhung
const pvFollowStableTicksHighPV = 4;             // ca. 8 s bei 2-s-Takt
const pvFollowStableTicksVeryHighPV = 5;         // ca. 10 s bei 2-s-Takt
const pvFollowUnconfirmedStepHighPVW = 45;       // W/Tick max. Lade-Erhöhung ohne bestätigte stabile PV
const pvFollowUnconfirmedStepVeryHighPVW = 30;   // W/Tick max. Lade-Erhöhung ohne bestätigte stabile PV
const pvFollowFallStepDownW = 900;               // W/Tick schneller Ladeabbau, wenn der PI-Rohwert wirklich fällt
const pvFollowFallLatchTicks = 2;                // Ticks: PV-Fall-Erkennung kurz über Klassengrenzen weiterführen
const pvFollowFallExtraReserveW = 0;             // Kompatibilitätsfeld: zusätzlicher chargeRaw-Fall-Kick ist deaktiviert
const pvFollowFallKeepChargeW = 25;              // W: Fall-Nachlauf bei Importseite + echter Batterieladung

// ----------------- Helpers
function n(v, d = 0) {
  v = Number(v);
  return Number.isFinite(v) ? v : d;
}
function b(v, d = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "on" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "off" || s === "no") return false;
  }
  return d;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function fmtW(v) {
  if (!Number.isFinite(v)) return "?";
  return String(Math.round(v));
}
function inWindow(z, lo, hi) {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return (z >= a && z <= b);
}
function acModeTxt(v) {
  if (v === 1) return "Laden";
  if (v === 2) return "Entladen";
  return "Undef";
}
function packStateTxt(v) {
  if (v === 0) return "Standby";
  if (v === 1) return "Lädt";
  if (v === 2) return "Entlädt";
  return "Undef";
}
// Asymmetrisches Rampenlimit: hoch mit stepUp, runter mit stepDown
function rampAsym(target, last, stepUp, stepDown) {
  if (!Number.isFinite(target)) target = 0;
  if (!Number.isFinite(last)) last = 0;

  if (target > last) {
    return Math.min(target, last + stepUp);
  } else if (target < last) {
    return Math.max(target, last - stepDown);
  }
  return target;
}

// ----------------- Steuerwerte (flow)
const netz_laden = b(flow.get("netz_laden"), false);
const regelung = b(flow.get("regelung"), false);
const b_entladen = b(flow.get("b_entladen"), false);

// ----------------- SNAPSHOT-CYCLE-HANDSHAKE 4.9
//
// Der Regler wird 1 s nach dem Mess-Trigger mit derselben cycleId
// aufgerufen.
//
// Er darf im normalen Regelbetrieb nur rechnen, wenn der
// Snapshot-Builder für genau diese cycleId einen erfolgreichen
// Snapshot in die Flow-Werte geschrieben hat.
//
// Dadurch wird verhindert, dass nach einem abgelehnten oder
// unvollständigen Snapshot nochmals mit den alten Messwerten
// des vorherigen Zyklus geregelt wird.
// cycleId bevorzugt aus der verzögerten Trigger-Nachricht lesen.
//
// Falls ein Delay-/Trigger-/Change-Node die zusätzliche
// Message-Eigenschaft entfernt hat, auf die im Zyklus-Erzeuger
// gespeicherte aktuelle cycleId zurückfallen.
const regulatorCycleIdFromMsg =
  String(
    msg.cycleId ?? ""
  );

const regulatorCycleIdFromFlow =
  String(
    flow.get("regler_expected_cycleId") ?? ""
  );

const regulatorCycleId =
  regulatorCycleIdFromMsg ||
  regulatorCycleIdFromFlow;

const snapshotLastOkCycleId =
  String(
    flow.get("snapshot_last_ok_cycleId") || ""
  );

const snapshotLastOkTs =
  n(
    flow.get("snapshot_last_ok_ts"),
    0
  );

const snapshotAgeMs =
  snapshotLastOkTs > 0
    ? Date.now() - snapshotLastOkTs
    : Number.POSITIVE_INFINITY;

const snapshotCycleMatch =
  regulatorCycleId !== "" &&
  snapshotLastOkCycleId !== "" &&
  regulatorCycleId === snapshotLastOkCycleId;

// 1 s Reglerverzögerung plus ausreichende Reserve.
// Normalerweise liegt das Snapshot-Alter beim Regleraufruf
// ungefähr bei 800 bis 1000 ms.
const snapshotMaxAgeForControlMs = 1800;

const snapshotAgeOk =
  snapshotAgeMs >= 0 &&
  snapshotAgeMs <= snapshotMaxAgeForControlMs;

const snapshotFreshForControl =
  snapshotCycleMatch &&
  snapshotAgeOk;

// Normalregelung nur mit einem erfolgreichen Snapshot
// des aktuellen Zyklus ausführen.
//
// REGELUNG AUS und NETZLADEN werden nicht blockiert:
// Diese beiden Zustände müssen auch ohne gültigen Mess-Snapshot
// sicher verarbeitet werden können.
if (
  regelung &&
  !netz_laden &&
  !snapshotFreshForControl
) {
  const regulatorCycleStatus =
    regulatorCycleId !== ""
      ? regulatorCycleId.slice(-6)
      : "LEER";

  const snapshotCycleStatus =
    snapshotLastOkCycleId !== ""
      ? snapshotLastOkCycleId.slice(-6)
      : "LEER";

  const snapshotAgeStatus =
    Number.isFinite(snapshotAgeMs)
      ? Math.round(snapshotAgeMs)
      : -1;

  node.status({
    fill: "yellow",
    shape: "ring",
    text:
      "Snap R=" +
      regulatorCycleStatus +
      " S=" +
      snapshotCycleStatus +
      " M=" +
      (snapshotCycleMatch ? "1" : "0") +
      " A=" +
      snapshotAgeStatus
  });

  return null;
}

// ----------------- BATTERIE-FRISCHE DES SNAPSHOTS

const snapshotBatteryFresh =
  b(
    flow.get("snapshot_last_battery_fresh"),
    false
  );

const snapshotBatterySource =
  String(
    flow.get("snapshot_last_battery_source") ||
    "unknown"
  );

const snapshotBatteryHoldAgeMs =
  n(
    flow.get(
      "snapshot_last_battery_hold_age_ms"
    ),
    0
  );

// ----------------- SOC_BLOCK 4.15
//
// flow.batt_min ist der ungefilterte Zustand aus der
// SOC-Auswertung. Der SOC wird nur alle 5 s aktualisiert.
// Ein einzelner fehlerhafter SOC-Wert darf den Entladeausgang
// deshalb nicht sofort auf 0 W setzen.
//
// batt_min wird erst wirksam, wenn batt_min_raw mindestens
// 8 s ohne Unterbrechung true bleibt. Bei 5-s-SOC-Abtastung
// sind damit mindestens zwei aufeinanderfolgende niedrige
// SOC-Messungen erforderlich.
//
// Die Freigabe erfolgt sofort beim ersten wieder gültigen
// batt_min_raw=false.
const battMinConfirmMs = 8000;

const batt_min_raw = b(
  flow.get("batt_min"),
  false
);

const battMinFilterNowTs = Date.now();

let battMinRawSinceTs = n(
  flow.get("regler_batt_min_raw_since_ts"),
  0
);

if (!batt_min_raw) {
  battMinRawSinceTs = 0;
}
else if (
  battMinRawSinceTs <= 0 ||
  battMinRawSinceTs > battMinFilterNowTs
) {
  battMinRawSinceTs = battMinFilterNowTs;
}

const battMinRawDurationMs =
  batt_min_raw && battMinRawSinceTs > 0
    ? Math.max(
      0,
      battMinFilterNowTs - battMinRawSinceTs
    )
    : 0;

const batt_min =
  batt_min_raw &&
  battMinRawDurationMs >= battMinConfirmMs;

// Bestätigten SOC-Minimalzustand für den nachgelagerten
// Node "AC-Mode Soll / Ist" separat bereitstellen.
//
// flow.batt_min bleibt der ungefilterte Rohwert.
flow.set(
  "regler_batt_min_confirmed",
  batt_min
);

const battMinPending =
  batt_min_raw &&
  !batt_min;

flow.set(
  "regler_batt_min_raw_since_ts",
  battMinRawSinceTs
);

const batt_max = b(
  flow.get("batt_max"),
  false
); // Batterie voll -> Laden sperren

const soc_block =
  batt_min ||
  batt_max; // nur als Sammel-Flag (Status/Logging)

// ----------------- Fensterparameter (flow, Defaults wie vorgegeben)
const p_o_s_in = n(flow.get("p_o_s_in"), -10);
const p_o_b_out = n(flow.get("p_o_b_out"), -5);
const p_o_max = n(flow.get("p_o_max"), 5);

// Zielwerte (Mittelwerte)
const p_o_s_in_m = (p_o_max + p_o_s_in) / 2;   // Laden-Ziel
const p_o_b_out_m = (p_o_max + p_o_b_out) / 2; // Entladen-Ziel

// ----------------- Messwerte (flow)
const p_zaehler = n(flow.get("p_zaehler"));    // + Bezug, - Einspeisung
const p_batterie = n(flow.get("p_batterie"));  // signed: <0 entladen, >0 laden
const p_solar = n(flow.get("p_solar"));        // PV-Leistung (W) wie in deinem Flow gespeichert
const p_haus = n(flow.get("p_haus"));          // Hausleistung (W) wie in deinem Flow gespeichert
const lowPvOptimActive = p_solar <= optimizedPvMaxW;

// ----------------- Batteriestatus aus 5s Status-Node
// Wird nur für Status/Debug genutzt. Die Regelung selbst bleibt auf den 2s-Messwerten.
const batt_acMode = n(flow.get("batt_acMode"), 0);       // 1 Input/Laden, 2 Output/Entladen
const batt_packState = n(flow.get("batt_packState"), 0); // 0 Standby, 1 Laden, 2 Entladen

// ----------------- Letzte Sollwerte (flow) für HOLD + Rampe
// Wird ab 3.5 bereits vor der Richtungsentscheidung gelesen,
// damit die Lastsprungerkennung prüfen kann, ob der Sollwert
// im vorherigen Tick stark geregelt wurde.
let lastChargeW = n(flow.get("lastChargeW"), 0);
let lastDischargeW = n(flow.get("lastDischargeW"), 0);

// ----------------- SYMMETRISCHE SOLLWERTBASIS 4.13
//
// Beide Regelrichtungen verwenden dieselbe Auswahlregel:
//
//  - Batterie-Messwert frisch:
//      aktuelle reale Batterie-Leistung als Basis
//
//  - Batterie-Messwert gehalten:
//      letzter tatsächlich ausgegebener Sollwert als Basis
//
// Dadurch wird ein gehaltener Batterie-Istwert nicht nochmals
// als aktuelle Messung verarbeitet. Gleichzeitig bleiben Lade-
// und Entladezweig logisch exakt spiegelbildlich.
const battChargeNowForControl =
  Math.max(
    0,
    p_batterie
  );

const battDisNowForControl =
  Math.max(
    0,
    -p_batterie
  );

const chargeControlBaseW =
  snapshotBatteryFresh
    ? battChargeNowForControl
    : lastChargeW;

const dischargeControlBaseW =
  snapshotBatteryFresh
    ? battDisNowForControl
    : lastDischargeW;

const controlBaseSource =
  snapshotBatteryFresh
    ? "battery_fresh"
    : "last_output_battery_held";

// ----------------- HIGH-/VERY-HIGH-PV FENSTERVERSCHIEBUNG 2.5
// Die Fensterverschiebung gilt nur für das Ladefenster.
// Das Entladefenster bleibt exakt unverändert.
const pvWindowOffsetW =
  (p_solar >= pvVeryHighThreshold) ? pvWindowOffsetVeryHighPV :
    (p_solar >= pvHighThreshold) ? pvWindowOffsetHighPV :
      0;

const chargeWindowPvClass =
  (p_solar >= pvVeryHighThreshold) ? "veryhighpv" :
    (p_solar >= pvHighThreshold) ? "highpv" :
      "normal";

// Effektives Ladefenster:
// Basisfenster bleibt im Status erhalten.
// Effektivfenster wird für Lade-HOLD, Lade-Ziel und Lade-Import/Export-Erkennung verwendet.
const p_o_s_in_charge_eff = p_o_s_in - pvWindowOffsetW;
const p_o_max_charge_eff = p_o_max - pvWindowOffsetW;
const p_o_s_in_m_charge_eff = (p_o_s_in_charge_eff + p_o_max_charge_eff) / 2;

// Entladefenster unverändert
const p_o_b_out_discharge_eff = p_o_b_out;
const p_o_max_discharge_eff = p_o_max;
const p_o_b_out_m_discharge_eff = p_o_b_out_m;

// ----------------- LASTSPRUNGERKENNUNG 3.5
// Keine Nutzung von p_haus.
// Erkennung nur über:
//  - aktuelle Änderung am Zähler
//  - aktuelle Änderung Solar
//  - aktuelle Änderung Batterie-Ist
//  - vorherige Änderung des Sollwertes
//
// Interpretation:
//  Wenn Solar nicht springt und Batterie/Sollwert nicht stark geregelt wurden,
//  dann ist ein starker positiver solarbereinigter Zählersprung ein echter Lastsprung.
let loadStepPrevZ = Number(flow.get("loadStep_prev_p_zaehler"));
let loadStepPrevSolar = Number(flow.get("loadStep_prev_p_solar"));
let loadStepPrevBatt = Number(flow.get("loadStep_prev_p_batterie"));
let loadStepPrevBatteryFresh =
  b(
    flow.get("loadStep_prev_battery_fresh"),
    false
  );

let loadStepPrevSollSigned = Number(flow.get("loadStep_prev_sollSigned"));
let loadStepPrev2SollSigned = Number(flow.get("loadStep_prev2_sollSigned"));

const loadStepHavePrev =
  Number.isFinite(loadStepPrevZ) &&
  Number.isFinite(loadStepPrevSolar) &&
  Number.isFinite(loadStepPrevBatt);

// Für eine exakte Laständerung müssen sowohl der aktuelle
// als auch der vorherige Batteriewert frisch gemessen sein.
//
// Bei einem gehaltenen Batterie-Wert darf dLoadEst weiterhin
// geloggt werden, aber nicht für Lastsprung-FastConfirm,
// Kick oder schnellen Lastabfall verwendet werden.
const loadStepBatteryDeltaValid =
  snapshotBatteryFresh &&
  loadStepPrevBatteryFresh;

const loadStepHaveSollPrev =
  Number.isFinite(loadStepPrevSollSigned) &&
  Number.isFinite(loadStepPrev2SollSigned);

// signed Sollwert:
//  Laden    positiv
//  Entladen negativ
const loadStepSollSignedNow = lastChargeW - lastDischargeW;

// Änderung Messwerte
const loadStep_dZ = loadStepHavePrev ? (p_zaehler - loadStepPrevZ) : 0;
const loadStep_dSolar = loadStepHavePrev ? (p_solar - loadStepPrevSolar) : 0;
const loadStep_dBatt = loadStepHavePrev ? (p_batterie - loadStepPrevBatt) : 0;

// Änderung Sollwert aus dem vorherigen Tick
const loadStep_dSoll = loadStepHaveSollPrev
  ? (loadStepPrevSollSigned - loadStepPrev2SollSigned)
  : 0;

// ----------------- EXAKTE LASTÄNDERUNG 4.9
//
// Verwendete Leistungsbilanz:
//
//   p_haus = p_solar + p_zaehler - p_batterie
//
// Daraus folgt für die Änderung:
//
//   Δp_haus = Δp_solar + Δp_zaehler - Δp_batterie
//
// Vorzeichen:
//   p_zaehler  positiv = Netzbezug
//   p_batterie positiv = Laden
//   p_batterie negativ = Entladen
//
// Dadurch werden Solar- und Batterieänderungen korrekt aus der
// erkannten Hauslaständerung berücksichtigt.
const loadStep_dLoadEst =
  loadStepHavePrev
    ? (
      loadStep_dSolar +
      loadStep_dZ -
      loadStep_dBatt
    )
    : 0;

// Für die Erkennung nehmen wir die aktuell wirksame Richtung,
// soweit vorhanden. Falls AntiFlip noch nicht initialisiert ist,
// wird auf die gespeicherte interne Richtung zurückgefallen.
const loadStepCurrentDir = n(
  flow.get("af_activeDir"),
  n(flow.get("regler_dir_richtung"), n(flow.get("richtung"), 2))
);

let loadStepCntToDischarge = n(flow.get("loadStepCntToDischarge"), 0);

// ----------------- CHARGE-FIRST-SCHUTZ 3.9a
// Bevor ein Lastsprung LADEN -> ENTLADEN per FastConfirm oder Latch auslösen darf,
// wird geprüft, ob der aktuelle Import nur durch laufendes Batterieladen entsteht.
//
// zNoCharge:
//  geschätzter Zählerwert, wenn die Batterie in diesem Tick nicht laden würde.
//
// Harte Sperre:
//  Wenn Batterieladung aktiv ist und zNoCharge <= 0 W,
//  dann würde ein reiner Ladestopp bereits Export oder 0 W erzeugen.
//  In diesem Fall müssen Candidate, Confirm und Latch hart gelöscht werden.
const loadStepBattChargeNow = Math.max(0, p_batterie);
const loadStepZNoCharge = p_zaehler - loadStepBattChargeNow;

// ----------------- ADAPTIVES LASTSPRUNGER-ZIEL 4.9
//
// Gesuchtes gesamtes Entladeziel:
//
//   aktuelle Entladeleistung
// + verbleibender Netzbezug ohne laufendes Batterieladen
// + kleine Reaktionsreserve
//
// Beispiele:
//
// Batterie lädt:
//   p_batterie = +300 W
//   p_zaehler  = +1000 W
//   Ziel       = 0 + (1000 - 300) + 100 = 800 W
//
// Batterie entlädt bereits:
//   p_batterie = -600 W
//   p_zaehler  = +100 W
//   Ziel       = 600 + 100 + 100 = 800 W
//
// Dadurch bleibt das Ziel beim Übergang von Laden über Standby
// zum Entladen konsistent, ohne dLoadEst doppelt einzurechnen.
const loadStepBattDisNow = Math.max(0, -p_batterie);

const loadStepKickAdaptiveTargetW = clamp(
  loadStepBattDisNow +
  loadStepZNoCharge -
  p_o_b_out_m_discharge_eff +
  loadStepKickReserveW,
  0,
  batt_power_max
);

const loadStepChargeFirstHardBlocked =
  regelung &&
  !netz_laden &&
  loadStepBattChargeNow > 0 &&
  loadStepZNoCharge <= -chargeFirstHardBlockReleaseW;

const loadStepChargeFirstMarginBlocked =
  loadStepCurrentDir === 1 &&
  loadStepBattChargeNow > holdMinActiveW &&
  loadStepZNoCharge <= loadStepChargeFirstImportMarginW;

const loadStepChargeFirstBlocked =
  loadStepChargeFirstHardBlocked ||
  loadStepChargeFirstMarginBlocked;

// ----------------- SOLAR-KOMPATIBILITÄT LASTSPRUNGERKENNUNG 4.17
//
// dLoadEst enthält die Solaränderung bereits vollständig:
//
//   dLoadEst = dSolar + dZ - dBatt
//
// Ein Solarabfall darf einen sehr deutlichen, solarbereinigten
// Lastanstieg deshalb nicht pauschal blockieren.
//
// Bei starkem Solarabfall wird lediglich verlangt, dass der
// erkannte Lastanstieg zusätzlich größer als der Solarabfall ist.
const loadStepSolarFallW = Math.max(
  0,
  -loadStep_dSolar
);

const loadStepSolarCompatible =
  loadStep_dSolar >= -loadStepSolarStableW ||
  loadStep_dLoadEst >
  (
    loadStepToDischargeW +
    loadStepSolarFallW
  );

const loadStepCandidateRawToDischarge =
  loadStepDetectionEnabled &&
  regelung &&
  !netz_laden &&
  loadStepHavePrev &&
  loadStepBatteryDeltaValid &&
  loadStepCurrentDir === 1 &&
  b_entladen &&
  !batt_min &&
  // !batt_max && Sonst wird Lastsprungerkennung bei voller Batterie blockiert wenn Solar nicht reicht
  loadStep_dLoadEst > loadStepToDischargeW &&
  // Ein starker Solar-Fall blockiert nur dann, wenn der
  // solarbereinigte Lastanstieg nicht deutlich genug ist.
  loadStepSolarCompatible &&
  // Batterie darf beim Lastsprung von Laden Richtung 0 oder Entladen laufen.
  // Nur ein starker positiver Batteriesprung Richtung mehr Laden soll blockieren.
  loadStep_dBatt <= loadStepBattStableW &&
  Math.abs(loadStep_dSoll) <= loadStepSollStableW &&
  p_zaehler > (p_o_max_discharge_eff + loadStepImportMinW);

const loadStepCandidateToDischarge =
  loadStepCandidateRawToDischarge &&
  !loadStepChargeFirstBlocked;

// LASTSPRUNGERKENNUNG 3.5 FIX
// Der Lastsprung ist meist nur 1 Tick sichtbar.
// Deshalb wird ein erkannter Lastsprung für einige Ticks gehalten,
// damit interne Richtungsentscheidung und AntiFlip sicher reagieren können.
const loadStepLatchTicks = 8; // ca. 16 s bei 2s-Takt

let loadStepLatchToDischarge = n(flow.get("loadStepLatchToDischarge"), 0);

// Gespeichertes Lastsprung-Kick-Ziel
let loadStepKickHoldCnt =
  n(flow.get("loadStepKickHoldCnt"), 0);

let loadStepKickLatchedTargetW =
  n(flow.get("loadStepKickLatchedTargetW"), 0);

// ----------------- LASTSPRUNGERKENNUNG LATCH + KICK-HOLD 4.12

if (loadStepCandidateToDischarge) {
  loadStepCntToDischarge = Math.min(
    loadStepCntToDischarge + 1,
    loadStepConfirmTicks
  );

  // Richtungssituation so lange halten, bis die wirksame
  // Richtung tatsächlich ENTLADEN erreicht hat.
  loadStepLatchToDischarge =
    loadStepLatchTicks;

  // Das Leistungsziel wird ausschließlich aus der aktuellen
  // Leistungsbilanz gebildet.
  //
  // dLoadEst dient nur zur Lastsprungerkennung und wird hier
  // nicht nochmals als Leistung addiert.
  loadStepKickLatchedTargetW =
    loadStepKickAdaptiveTargetW;

  loadStepKickHoldCnt =
    loadStepKickHoldTicks;
}
else {
  loadStepCntToDischarge = 0;

  // Sämtliche Lastsprungzustände hart löschen, sobald
  // Entladen nicht mehr zulässig oder die Erkennung deaktiviert ist.
  const loadStepHardReset =
    !loadStepDetectionEnabled ||
    !regelung ||
    netz_laden ||
    !b_entladen ||
    batt_min ||
    loadStepChargeFirstBlocked;

  if (loadStepHardReset) {
    loadStepLatchToDischarge = 0;
    loadStepKickHoldCnt = 0;
    loadStepKickLatchedTargetW = 0;
  }
  else {
    // Richtungslatch normal abbauen, solange die wirksame
    // Umschaltung auf ENTLADEN noch nicht erreicht wurde.
    loadStepLatchToDischarge = Math.max(
      0,
      loadStepLatchToDischarge - 1
    );

    const loadStepKickAbortByLoadDrop =
      loadStepHavePrev &&
      loadStepBatteryDeltaValid &&
      loadStep_dLoadEst <
      -dischargeFastStepDownLoadDropW;

    const loadStepKickAbortByExport =
      p_zaehler <
      -loadStepKickAbortExportW;

    const loadStepKickAbort =
      loadStepKickAbortByLoadDrop ||
      loadStepKickAbortByExport;

    if (loadStepKickAbort) {
      loadStepKickHoldCnt = 0;
      loadStepKickLatchedTargetW = 0;
    }
    else if (loadStepKickHoldCnt > 0) {
      loadStepKickHoldCnt = Math.max(
        0,
        loadStepKickHoldCnt - 1
      );

      if (loadStepKickHoldCnt > 0) {
        // Das adaptive Ziel nur mit einem aktuell frisch
        // gemessenen Batteriewert neu berechnen.
        //
        // Bei Battery-Hold bleibt das zuletzt zuverlässig
        // berechnete Kick-Ziel unverändert erhalten.
        if (snapshotBatteryFresh) {
          loadStepKickLatchedTargetW =
            loadStepKickAdaptiveTargetW;
        }
      }
      else {
        loadStepKickLatchedTargetW = 0;
      }
    }
    else {
      loadStepKickLatchedTargetW = 0;
    }
  }
}

// Muss "let" sein, weil der Charge-First-Block und die spätere
// Latch-Verbrauchslogik die Bestätigung im selben Tick löschen können.
let loadStepToDischargeConfirmed =
  loadStepDetectionEnabled &&
  regelung &&
  !netz_laden &&
  b_entladen &&
  !batt_min &&
  !loadStepChargeFirstBlocked &&
  (
    loadStepCandidateToDischarge ||
    loadStepLatchToDischarge > 0
  );

flow.set(
  "loadStepCntToDischarge",
  loadStepCntToDischarge
);

flow.set(
  "loadStepLatchToDischarge",
  loadStepLatchToDischarge
);

flow.set(
  "loadStepKickHoldCnt",
  loadStepKickHoldCnt
);

flow.set(
  "loadStepKickLatchedTargetW",
  loadStepKickLatchedTargetW
);

// ----------------- INTERNE RICHTUNGSENTSCHEIDUNG 3.1
// Bisheriger vorgelagerter Richtungsnode ist hier integriert.
// Wichtig:
// - Diese Logik erzeugt nur die Roh-Richtung desiredDirRaw.
// - Die finale Batterie-Richtung kommt weiterhin erst nach DirectionGuard + AntiFlip.
// - Bei NETZLADEN wird sofort LADEN angefordert.
// - Bei REGELUNG AUS wird keine Richtung angefordert.
let dirLogic_richtung = n(flow.get("regler_dir_richtung"), n(flow.get("richtung"), 2)); // Default ENTLADEN
if (dirLogic_richtung !== 1 && dirLogic_richtung !== 2) dirLogic_richtung = 2;

let dirLogic_pendingDir = n(flow.get("regler_dir_pendingDir"), 0);
let dirLogic_pendingCnt = n(flow.get("regler_dir_pendingCnt"), 0);

// Schwellwerte:
// LADEN -> ENTLADEN bei klarem Netzbezug oberhalb der effektiven Ladefenster-Obergrenze.
// Dadurch ist die PV-Fensterverschiebung V2.5 auch in der Richtungsentscheidung konsistent.
// ENTLADEN -> LADEN bleibt wie bisher an die Entlade-/Exportgrenze gekoppelt.
const dirLogic_lowPvDischargeActive = (p_solar < pvLowThreshold);

const activeMarginDischargeW =
  dirLogic_lowPvDischargeActive ? margin_dischargeLowPVW : margin_dischargeW;

const activeConfirmToDischargeN =
  dirLogic_lowPvDischargeActive ? confirm_toDischargeLowPVN : confirm_toDischargeN;

const dirLogic_th_toDischarge =
  p_o_max_charge_eff + activeMarginDischargeW;

const dirLogic_th_toCharge =
  p_o_b_out_discharge_eff - margin_chargeW;
const dirLogic_pvOk = (p_solar > solar_min);
const dirLogic_exportBlock = (p_zaehler < exportBlockW);

function dirLogicRequiredConfirmN(curDir, wantDir) {
  if (curDir === 1 && wantDir === 2) return activeConfirmToDischargeN;
  if (curDir === 2 && wantDir === 1) return confirm_toChargeN;
  return Math.max(confirm_toChargeN, activeConfirmToDischargeN);
}

let dirLogic_desired = 0; // 0 = halten
let dirLogic_reason = "hold";

if (netz_laden) {
  // NETZLADEN-OVERRIDE (EXKLUSIV, SOFORT, HART)
  // Richtung aktiv und sofort auf LADEN erzwingen.
  dirLogic_richtung = 1;
  dirLogic_pendingDir = 0;
  dirLogic_pendingCnt = 0;
  dirLogic_reason = "netz_laden=true -> force Richtung Laden";
}
else if (!regelung) {
  // Regler aus: keine Roh-Richtung anfordern.
  // Die gespeicherte Richtung bleibt für den nächsten Start erhalten,
  // aber pending Confirm wird gelöscht.
  dirLogic_pendingDir = 0;
  dirLogic_pendingCnt = 0;
  dirLogic_reason = "regelung=false -> keine Richtung";
}
else {
  // NORMALE RICHTUNGSLOGIK
  if (dirLogic_richtung === 1) {
    // aktuell LADEN

    // LASTSPRUNGERKENNUNG 3.5:
    // Bei sicher erkanntem Lastsprung wird LADEN -> ENTLADEN sofort angefordert.
    // Das ersetzt nicht die normale Richtungslogik, sondern ist nur ein Fast-Path
    // für echte Lastsprünge mit starkem Importdruck.
    if (loadStepToDischargeConfirmed) {
      dirLogic_desired = 2;
      dirLogic_reason = "Lastsprung > " + loadStepToDischargeW + "W erkannt -> Entladen anfordern";
    }

    // Zusatzanpassung V3.1:
    // Wenn Laden durch batt_max gesperrt ist, Entladen erlaubt ist,
    // die Batterie nicht leer ist und echter Import oberhalb des Entladefensters anliegt,
    // wird Entladen angefordert. Dadurch bleibt der Regler bei voller Batterie
    // nicht wirkungslos in LADEN stehen.
    else if (
      batt_max &&
      !batt_min &&
      b_entladen &&
      !dirLogic_exportBlock &&
      p_zaehler > p_o_max_discharge_eff
    ) {
      dirLogic_desired = 2;
      dirLogic_reason = "batt_max=true und Import -> Entladen anfordern";
    }
    else if (!dirLogic_pvOk) {
      // PV weg -> zurück zu ENTLADEN, aber NICHT bei Export
      if (!dirLogic_exportBlock) {
        dirLogic_desired = 2;
        dirLogic_reason = "PV unter solar_min -> Entladen anfordern";
      } else {
        dirLogic_reason = "PV unter solar_min, aber ExportBlock -> Richtung halten";
      }
    }
    else if (p_zaehler > dirLogic_th_toDischarge) {
      // klarer Netzbezug -> ENTLADEN, aber niemals bei Export
      if (!dirLogic_exportBlock) {
        dirLogic_desired = 2;
        dirLogic_reason = "Zähler > th_toDischarge -> Entladen anfordern";
      } else {
        dirLogic_reason = "Zähler > th_toDischarge, aber ExportBlock -> Richtung halten";
      }
    } else {
      dirLogic_reason = "Laden halten";
    }
  } else {
    // aktuell ENTLADEN
    // Wechsel zu LADEN nur bei PV ausreichend und genügend links im Fenster
    if (dirLogic_pvOk && p_zaehler < dirLogic_th_toCharge) {
      dirLogic_desired = 1;
      dirLogic_reason = "PV ok und Zähler < th_toCharge -> Laden anfordern";
    } else {
      dirLogic_reason = "Entladen halten";
    }
  }

  // Confirm-Logik der internen Richtungsentscheidung
  // LASTSPRUNGERKENNUNG 3.5:
  // Bei bestätigtem Lastsprung wird die interne Richtung LADEN -> ENTLADEN
  // ohne die lange confirm_toDischargeN-Wartezeit freigegeben.
  if (dirLogic_desired === 0) {
    dirLogic_pendingDir = 0;
    dirLogic_pendingCnt = 0;
  } else {
    const loadStepFastConfirm =
      loadStepToDischargeConfirmed &&
      dirLogic_richtung === 1 &&
      dirLogic_desired === 2;

    const confirmN = loadStepFastConfirm
      ? 1
      : dirLogicRequiredConfirmN(dirLogic_richtung, dirLogic_desired);

    if (dirLogic_pendingDir === dirLogic_desired) {
      dirLogic_pendingCnt += 1;
    } else {
      dirLogic_pendingDir = dirLogic_desired;
      dirLogic_pendingCnt = 1;
    }

    if (dirLogic_pendingCnt >= confirmN) {
      dirLogic_richtung = dirLogic_desired;
      dirLogic_pendingDir = 0;
      dirLogic_pendingCnt = 0;
      dirLogic_reason += loadStepFastConfirm
        ? " -> Lastsprung-FastConfirm"
        : " -> bestätigt";
    }
  }
}

// ----------------- INTERNE ROH-RICHTUNG SPEICHERN
// Wichtig:
//  - regler_dir_richtung ist nur die intern bestätigte Roh-Richtung.
//  - DirectionGuard und AntiFlip haben zu diesem Zeitpunkt noch nicht gewirkt.
//  - flow.richtung darf deshalb hier NICHT beschrieben werden.
//  - flow.richtung wird erst nach Berechnung von effectiveRichtung gesetzt.
flow.set("regler_dir_richtung", dirLogic_richtung);
flow.set("regler_dir_pendingDir", dirLogic_pendingDir);
flow.set("regler_dir_pendingCnt", dirLogic_pendingCnt);

// Roh-Richtung für DirectionGuard + AntiFlip:
// - Netzladen fordert 1
// - Regelung aus fordert 0
// - sonst die intern bestätigte Richtung
let desiredDirRaw = netz_laden ? 1 : (regelung ? dirLogic_richtung : 0);

// ----------------- Letzte I-Zustände (flow)
let iChargeW = n(flow.get("iChargeW"), 0);
let iDischargeW = n(flow.get("iDischargeW"), 0);

// ----------------- HOLD Bestätigungszähler 2.2 (flow)
let holdEntryCountCharge = n(flow.get("holdEntryCountCharge"), 0);
let holdEntryCountDischarge = n(flow.get("holdEntryCountDischarge"), 0);

// ----------------- Aktive Ladeparameter (Debug/Status)
let chargeParamSet = "hold";
let activeErrGainCharge = 0;
let activeIGainCharge = 0;
let activeIMaxCharge = iMaxWCharge;
let activeIErrMinCharge = 0;
let activeIDecayHoldCharge = iDecayHoldCharge;
let activePvLowCharge = false;
let activePvHighCharge = false;
let activePvVeryHighCharge = false;
let activeImportPvHighCharge = false;
let activeImportPvVeryHighCharge = false;

// ----------------- Aktive Entladeparameter (Debug/Status)
let dischargeParamSet = "normal";
let activeErrGainDischarge = errGainDischarge;
let activeIGainDischarge = iGainDischarge;
let activeIMaxDischarge = iMaxWDischarge;
let activeIErrMinDischarge = iErrMinWDischarge;
let activeIDecayHoldDischarge = iDecayHoldDischarge;
let activePvDischarge = false;

// ----------------- Vereinfachter aktiver Sollwertsatz für Log-Auswertung
let activeControlSet = "unset";        // z.B. charge_export_lowpv / discharge_pv / hold_charge
let activeControlFamily = "none";      // charge / discharge / force / off
let activeControlTargetSide = "none";  // import / import_highpv / import_veryhighpv / export / lowpv / highpv / veryhighpv / pv / hold / blocked / none

// ----------------- HOLD Debug 2.2
let holdEligible = false;      // Fenster + Mindestleistung erfüllt
let holdConfirmed = false;     // Bestätigung erfüllt
let holdConfirmMode = "none";  // charge / discharge / none

// =========================================================
// ANTI-FLIP LOGIK -> effectiveRichtung
// =========================================================

// Persistente AntiFlip-States zuerst lesen,
// damit der Richtungs-Schutz 2.1 den aktuellen aktiven Zustand kennt
let af_activeDir = n(flow.get("af_activeDir"), 0);     // wirksame Richtung
let af_pendingDir = n(flow.get("af_pendingDir"), 0);   // aktuell zu bestätigende Richtung
let af_count = n(flow.get("af_count"), 0);             // confirm counter
let af_lastSwitchTs = n(flow.get("af_lastSwitchTs"), 0);

const nowTs = Date.now();

let af_switched = false;
let af_blockedByHold = false;

// ----------------- CHARGE-FIRST-DIRECTION-BLOCK 3.9a
// Ziel:
//  - Wenn ein Wechsel auf Entladen angefordert wird,
//    aber ein Stoppen der aktuellen Batterieladung bereits ausreichen würde,
//    wird Entladen vollständig gesperrt.
//  - Zusätzlich werden interne Richtung, Direction-Pending, AntiFlip-Pending
//    und Lastsprung-Latch hart gelöscht.
const chargeFirstDirBattChargeNow = loadStepBattChargeNow;
const chargeFirstDirZNoCharge = loadStepZNoCharge;

const chargeFirstDirBlockToDischarge =
  regelung &&
  !netz_laden &&
  chargeFirstDirBattChargeNow > 0 &&
  chargeFirstDirZNoCharge <= 0 &&
  (
    desiredDirRaw === 2 ||
    loadStepToDischargeConfirmed ||
    af_pendingDir === 2 ||
    af_activeDir === 1
  );

if (chargeFirstDirBlockToDischarge) {
  // Gewünschte Richtung für diesen Tick hart auf LADEN setzen.
  desiredDirRaw = 1;

  // Interne Roh-Richtung sofort auf LADEN zurücksetzen.
  dirLogic_richtung = 1;
  dirLogic_pendingDir = 0;
  dirLogic_pendingCnt = 0;

  flow.set(
    "regler_dir_richtung",
    dirLogic_richtung
  );

  flow.set(
    "regler_dir_pendingDir",
    dirLogic_pendingDir
  );

  flow.set(
    "regler_dir_pendingCnt",
    dirLogic_pendingCnt
  );

  // Einen noch aktiven Entladezustand sofort beenden.
  //
  // Nur desiredDirRaw = 1 reicht nicht aus:
  // DirectionGuard und AntiFlip könnten die wirksame Richtung
  // andernfalls weiterhin auf ENTLADEN halten.
  if (af_activeDir !== 1) {
    af_activeDir = 1;
    af_lastSwitchTs = nowTs;
    af_switched = true;
  }

  af_pendingDir = 0;
  af_count = 0;

  // Alte Entlade-Regelzustände vollständig löschen.
  lastDischargeW = 0;
  iDischargeW = 0;
  holdEntryCountDischarge = 0;

  // Sämtliche Lastsprungzustände löschen.
  loadStepCntToDischarge = 0;
  loadStepLatchToDischarge = 0;
  loadStepKickHoldCnt = 0;
  loadStepKickLatchedTargetW = 0;

  // Die bereits weiter oben berechnete Bestätigung muss
  // für den aktuellen Tick ebenfalls gelöscht werden.
  loadStepToDischargeConfirmed = false;

  flow.set(
    "loadStepCntToDischarge",
    loadStepCntToDischarge
  );

  flow.set(
    "loadStepLatchToDischarge",
    loadStepLatchToDischarge
  );

  flow.set(
    "loadStepKickHoldCnt",
    loadStepKickHoldCnt
  );

  flow.set(
    "loadStepKickLatchedTargetW",
    loadStepKickLatchedTargetW
  );
}

// ----------------- Richtungs-Schutz 2.1
// Messwert-Helfer für Richtungs-Schutz
const battDisNowMeas = (p_batterie < 0) ? (-p_batterie) : 0;
const dirGuard_exportThreshold = p_o_b_out - dirGuard_chargeMarginW;
const dirGuard_exportOk = (p_zaehler < dirGuard_exportThreshold);
const dirGuard_surplusOk = (p_solar > (p_haus + dirGuard_surplusMarginW));
const dirGuard_battOk = (battDisNowMeas < dirGuard_maxBattDischargeForChargeW);

// Default: gewünschte Richtung unverändert übernehmen
let desiredDir = desiredDirRaw;

// Schutz nur für Wechsel ENTLADEN -> LADEN anwenden
// Wenn wirksam aktuell ENTLADEN ist und extern LADEN gewünscht wird,
// dann nur freigeben, wenn echter PV-Überschuss vorliegt und Batterie
// nicht mehr nennenswert entlädt.
let dirGuardActive = false;
let dirGuardBlocked = false;

if (
  regelung &&
  !netz_laden &&
  desiredDirRaw === 1 &&
  af_activeDir === 2
) {
  dirGuardActive = true;

  if (!(dirGuard_exportOk && dirGuard_surplusOk && dirGuard_battOk)) {
    desiredDir = 2; // Wechsel auf LADEN blockieren, ENTLADEN beibehalten
    dirGuardBlocked = true;
  }
}

// Anti-Flip wird nur angewendet, wenn regelung=true und kein Force-Netzladen
// (im OFF/NETZ_LADEN wird sauber zurückgesetzt)
if (!antiFlipEnabled || netz_laden || !regelung) {
  af_activeDir = (netz_laden || !regelung) ? 0 : desiredDir;
  af_pendingDir = 0;
  af_count = 0;
  // lastSwitchTs lassen wir stehen (harmlos), aber aktivDir wird klar definiert
} else {
  // Wenn keine gültige gewünschte Richtung -> active behalten, aber pending/counter resetten
  if (desiredDir === 0) {
    af_pendingDir = 0;
    af_count = 0;
    // af_activeDir bleibt wie er ist
  } else {
    // Wenn active ungültig -> sofort initialisieren
    if (!(af_activeDir === 1 || af_activeDir === 2)) {
      af_activeDir = desiredDir;
      af_pendingDir = 0;
      af_count = 0;
      af_lastSwitchTs = nowTs;
      af_switched = true;

      // beim ersten Setzen: sauberes Starten
      lastChargeW = 0;
      lastDischargeW = 0;
      iChargeW = 0;
      iDischargeW = 0;
      holdEntryCountCharge = 0;
      holdEntryCountDischarge = 0;
    }
    // Normalfall: active gültig
    else if (desiredDir === af_activeDir) {
      // stabil: pending reset
      af_pendingDir = 0;
      af_count = 0;
    } else {
      // mismatch: Wechsel nur nach richtungsabhängigem confirmN UND minHoldMs

      // LASTSPRUNGERKENNUNG 3.5:
      // Bei sicherem Lastsprung darf LADEN -> ENTLADEN die Mindest-Haltezeit
      // und die lange AntiFlip-Bestätigung umgehen.
      // Das gilt ausschließlich für 1 -> 2.
      const antiFlipLoadStepFast =
        loadStepToDischargeConfirmed &&
        af_activeDir === 1 &&
        desiredDir === 2;

      const holdOk =
        antiFlipLoadStepFast ||
        (antiFlip_minHoldMs <= 0) ||
        ((nowTs - af_lastSwitchTs) >= antiFlip_minHoldMs);

      // ASYMMETRISCHES ANTI-FLIP 2.4:
      // - Zielrichtung 2 = ENTLADEN -> strengere Bestätigung
      // - Zielrichtung 1 = LADEN    -> schnellere Bestätigung
      const activeAntiFlipConfirmToDischargeN =
        (p_solar < pvLowThreshold)
          ? antiFlip_confirmN_toDischargeLowPV
          : antiFlip_confirmN_toDischarge;

      const antiFlip_requiredConfirmN =
        antiFlipLoadStepFast ? 1 :
          (desiredDir === 2) ? activeAntiFlipConfirmToDischargeN :
            (desiredDir === 1) ? antiFlip_confirmN_toCharge :
              activeAntiFlipConfirmToDischargeN;

      if (!holdOk) {
        af_blockedByHold = true;
        // nicht zählen, nicht pending wechseln -> nur warten
        // (damit der Counter nicht "vorläuft")
      } else {
        if (af_pendingDir !== desiredDir) {
          af_pendingDir = desiredDir;
          af_count = 1;
        } else {
          af_count = af_count + 1;
        }

        if (af_count >= antiFlip_requiredConfirmN) {
          af_activeDir = desiredDir;
          af_pendingDir = 0;
          af_count = 0;
          af_lastSwitchTs = nowTs;
          af_switched = true;

          // WICHTIG: beim Richtungswechsel Altwerte hart nullen (Anti-Flip-Teil)
          lastChargeW = 0;
          lastDischargeW = 0;
          iChargeW = 0;
          iDischargeW = 0;
          holdEntryCountCharge = 0;
          holdEntryCountDischarge = 0;
        }
      }
    }
  }
}

const effectiveRichtung =
  (antiFlipEnabled && regelung && !netz_laden)
    ? af_activeDir
    : desiredDir;

// ----------------- LASTSPRUNGER-RICHTUNGSLATCH VERBRAUCHEN 4.12
//
// Sobald die wirksame Richtung ENTLADEN erreicht hat, ist der
// Richtungslatch erfüllt und muss sofort gelöscht werden.
//
// Der getrennte Leistungs-Kick darf über loadStepKickHoldCnt
// noch für seine kurze Restdauer weiterlaufen.
let loadStepDirectionLatchConsumed = false;

if (
  loadStepLatchToDischarge > 0 &&
  effectiveRichtung === 2
) {
  loadStepDirectionLatchConsumed = true;

  loadStepCntToDischarge = 0;
  loadStepLatchToDischarge = 0;
  loadStepToDischargeConfirmed = false;

  flow.set(
    "loadStepCntToDischarge",
    loadStepCntToDischarge
  );

  flow.set(
    "loadStepLatchToDischarge",
    loadStepLatchToDischarge
  );
}

// ----------------- WIRKSAME RICHTUNG SPEICHERN
// Ab hier haben interne Richtungsentscheidung, Charge-First-Schutz,
// DirectionGuard und AntiFlip vollständig gewirkt.
//
// Nur diese Richtung darf von Anzeigen oder nachgelagerten Nodes
// als tatsächlich wirksame Batterierichtung verwendet werden.
flow.set("richtung", effectiveRichtung);
flow.set("effectiveRichtung", effectiveRichtung);

// AntiFlip-Zustände persistieren
flow.set("af_activeDir", af_activeDir);
flow.set("af_pendingDir", af_pendingDir);
flow.set("af_count", af_count);
flow.set("af_lastSwitchTs", af_lastSwitchTs);

// ----------------- Statusvariablen
let mode = "OFF";
let reason = "";
let hold = false;
let p_target = 0;

let err = 0;
let errEff = 0;
let iEff = 0;

let chargeRaw = 0;
let dischargeRaw = 0;

// ----------------- ENTLADEN TRACKING-GUARD 4.11
let dischargeRawFromBatteryW = 0;
let dischargeRawFromLastW = 0;
let dischargeTrackingDemandW = 0;

let dischargeTrackingDeltaW = 0;
let dischargeBatteryUnderTracking = false;

let dischargeTrackingHoldActive = false;
let dischargeExportRawGuardActive = false;
let dischargeImportRawGuardActive = false;
let dischargeImportGuardFloorW = 0;
let chargeImportRawGuardActive = false;
let chargeExportRawGuardActive = false;

// ----------------- Lastsprung-Entlade-Kick Debug 3.9b
let loadStepKickActive = false;
let loadStepKickBaseW = 0;
let loadStepKickAddW = 0;
let loadStepKickTargetW = 0;
let loadStepKickBeforeDischargeRaw = 0;
let loadStepKickAfterDischargeRaw = 0;

// ----------------- HIGH-/VERY-HIGH-PV Seiten-Hysterese Debug 3.2
// Muss außerhalb der Lade-Regellogik deklariert werden,
// damit Status und Node-Status die Werte in jedem Modus kennen.
let chargeSideHystActive = false;
let chargeSideHystW = 0;
let chargeSideBefore = "none";
let chargeSideAfter = "none";
let chargeSideReason = "not in charge mode";

// =========================================================
// REGELLOGIK
// =========================================================

if (netz_laden) {
  mode = "NETZ_LADEN";
  reason = "netz_laden=true -> force charge max";
  hold = false;

  p_target = p_o_s_in_m_charge_eff;

  chargeRaw = batt_power_max;
  dischargeRaw = 0;
  iChargeW = 0;
  iDischargeW = 0;
  iEff = 0;
  holdEntryCountCharge = 0;
  holdEntryCountDischarge = 0;

  chargeParamSet = "force";
  activeErrGainCharge = 0;
  activeIGainCharge = 0;
  activeIMaxCharge = iMaxWCharge;
  activeIErrMinCharge = 0;
  activeIDecayHoldCharge = iDecayHoldCharge;
  activePvLowCharge = false;
  activePvHighCharge = false;
  activePvVeryHighCharge = false;
  activeImportPvHighCharge = false;
  activeImportPvVeryHighCharge = false;

  dischargeParamSet = "normal";
  activeErrGainDischarge = errGainDischarge;
  activeIGainDischarge = iGainDischarge;
  activeIMaxDischarge = iMaxWDischarge;
  activeIErrMinDischarge = iErrMinWDischarge;
  activeIDecayHoldDischarge = iDecayHoldDischarge;
  activePvDischarge = false;

  activeControlSet = "force_charge";
  activeControlFamily = "force";
  activeControlTargetSide = "charge";

  // im Force-Modus: Entladen sofort 0 halten
  lastDischargeW = 0;

  // SOC_BLOCK: Netzladen beenden wenn Batterie voll
  if (batt_max) {
    chargeRaw = 0;
    lastChargeW = 0;
    iChargeW = 0;
  }
}
else if (!regelung) {
  mode = "OFF";
  reason = "regelung=false -> outputs 0, no battery direction output";
  hold = false;

  p_target = 0;

  chargeRaw = 0;
  dischargeRaw = 0;

  chargeParamSet = "off";
  activeErrGainCharge = 0;
  activeIGainCharge = 0;
  activeIMaxCharge = iMaxWCharge;
  activeIErrMinCharge = 0;
  activeIDecayHoldCharge = iDecayHoldCharge;
  activePvLowCharge = false;
  activePvHighCharge = false;
  activePvVeryHighCharge = false;
  activeImportPvHighCharge = false;
  activeImportPvVeryHighCharge = false;

  dischargeParamSet = "normal";
  activeErrGainDischarge = errGainDischarge;
  activeIGainDischarge = iGainDischarge;
  activeIMaxDischarge = iMaxWDischarge;
  activeIErrMinDischarge = iErrMinWDischarge;
  activeIDecayHoldDischarge = iDecayHoldDischarge;
  activePvDischarge = false;

  activeControlSet = "off";
  activeControlFamily = "off";
  activeControlTargetSide = "none";

  // Reset für sauberen Neustart und sauberes Ausschalten auch bei hoher Last
  // Wichtig: Die Batterie-Sollwerte werden auf 0 gesetzt und gespeichert.
  // Ausgang [0] sendet im OFF-Zustand nichts, damit kein ungültiger acMode=0 entsteht.
  lastChargeW = 0;
  lastDischargeW = 0;
  iChargeW = 0;
  iDischargeW = 0;
  iEff = 0;
  holdEntryCountCharge = 0;
  holdEntryCountDischarge = 0;
}
else if (effectiveRichtung === 1) {
  mode = "REGEL_LADEN";
  p_target = p_o_s_in_m_charge_eff;

  // Richtungswechsel auf LADEN -> Entlade-HOLD-Zähler zurücksetzen
  holdEntryCountDischarge = 0;

  // Basis = aktuelle Ladeleistung (nur wenn p_batterie > 0)
  const battChargeNow = (p_batterie > 0) ? p_batterie : 0;

  // Aktiven asymmetrischen Parametersatz bestimmen
  // Importseite: oberhalb der oberen effektiven Fensterschwelle p_o_max_charge_eff aktiv abbauen
  // Import High-PV / Very-High-PV: bei hoher PV mit zusammengeführtem moderatem P-Anteil
  // Exportseite: bei/unterhalb der oberen effektiven Fensterschwelle p_o_max_charge_eff Exportsprünge zulassen, weicher zurückführen
  // Low-PV Exportseite: bei wenig PV die Fenstermitte besser treffen
  // High-PV Exportseite: bei hoher PV die effektive Fenstermitte besser treffen
  // Very-High-PV Exportseite: bei sehr hoher PV Import vermeiden und High-PV-Niveau erreichen
  //
  // V3.2: Import-/Export-Seitenwahl Laden
  // Low-/Normal-PV bleiben exakt wie bisher.
  // Nur High-/Very-High-PV bekommen eine kleine Hysterese gegen 1-2-Tick-Flattern
  // zwischen charge_import_* und charge_export_*.
  const isVeryHighPV = (p_solar >= pvVeryHighThreshold);
  const isHighPV = (!isVeryHighPV && p_solar >= pvHighThreshold);

  // letzter Lade-Seitenzustand nur für High-/Very-High-PV
  let lastChargeSideHV = flow.get("lastChargeSideHV") || "none"; // import/export/none

  let onImportSide;

  chargeSideHystActive = false;
  chargeSideHystW = 0;
  chargeSideBefore = lastChargeSideHV;
  chargeSideAfter = "none";
  chargeSideReason = "Low/Normal-PV: altes Verhalten";

  if (isVeryHighPV || isHighPV) {
    chargeSideHystActive = true;
    chargeSideHystW = isVeryHighPV ? chargeSideHystVeryHighPV : chargeSideHystHighPV;

    if (lastChargeSideHV === "import") {
      // Wenn zuletzt Importzweig aktiv war, erst deutlich unter die untere Fenstergrenze
      // auf Exportzweig wechseln. Das verhindert kurzes Hin-und-Her bei hoher PV.
      onImportSide = !(p_zaehler < (p_o_s_in_charge_eff - chargeSideHystW));
      chargeSideReason = onImportSide
        ? "HV-Hysterese: Importseite halten"
        : "HV-Hysterese: Import -> Export bestätigt";
    } else if (lastChargeSideHV === "export") {
      // Wenn zuletzt Exportzweig aktiv war, erst deutlich über die obere Fenstergrenze
      // auf Importzweig wechseln.
      onImportSide = (p_zaehler > (p_o_max_charge_eff + chargeSideHystW));
      chargeSideReason = onImportSide
        ? "HV-Hysterese: Export -> Import bestätigt"
        : "HV-Hysterese: Exportseite halten";
    } else {
      // Initial wie bisher
      onImportSide = (p_zaehler > p_o_max_charge_eff);
      chargeSideReason = "HV-Hysterese: Initial wie altes Verhalten";
    }

    chargeSideAfter = onImportSide ? "import" : "export";
    flow.set("lastChargeSideHV", chargeSideAfter);
  } else {
    // Low-/Normal-PV: exakt altes Verhalten
    onImportSide = (p_zaehler > p_o_max_charge_eff);
    chargeSideAfter = "none";
    flow.set("lastChargeSideHV", "none");
  }

  const onImportVeryHighPvSide = (onImportSide && isVeryHighPV);
  const onImportHighPvSide = (onImportSide && isHighPV);

  const onLowPvExportSide = (!onImportSide && p_solar < pvLowThreshold);
  const onVeryHighPvExportSide = (!onImportSide && isVeryHighPV);
  const onHighPvExportSide = (!onImportSide && isHighPV);

  let errGainCharge;
  let iGainCharge;
  let iMaxWChargeActive;
  let iErrMinWCharge;
  let iDecayHoldChargeActive;

  if (onImportVeryHighPvSide) {
    errGainCharge = errGainChargeImportVeryHighPV;
    iGainCharge = iGainChargeImportVeryHighPV;
    iMaxWChargeActive = iMaxWChargeImportVeryHighPV;
    iErrMinWCharge = iErrMinWChargeImportVeryHighPV;
    iDecayHoldChargeActive = iDecayHoldChargeImportVeryHighPV;
    chargeParamSet = "import_veryhighpv";
    activePvLowCharge = false;
    activePvHighCharge = false;
    activePvVeryHighCharge = true;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = true;

    activeControlSet = "charge_import_veryhighpv";
    activeControlFamily = "charge";
    activeControlTargetSide = "import_veryhighpv";
  } else if (onImportHighPvSide) {
    errGainCharge = errGainChargeImportHighPV;
    iGainCharge = iGainChargeImportHighPV;
    iMaxWChargeActive = iMaxWChargeImportHighPV;
    iErrMinWCharge = iErrMinWChargeImportHighPV;
    iDecayHoldChargeActive = iDecayHoldChargeImportHighPV;
    chargeParamSet = "import_highpv";
    activePvLowCharge = false;
    activePvHighCharge = true;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = true;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_import_highpv";
    activeControlFamily = "charge";
    activeControlTargetSide = "import_highpv";
  } else if (onImportSide) {
    errGainCharge = errGainChargeImport;
    iGainCharge = iGainChargeImport;
    iMaxWChargeActive = iMaxWChargeImport;
    iErrMinWCharge = iErrMinWChargeImport;
    iDecayHoldChargeActive = iDecayHoldChargeImport;
    chargeParamSet = "import";
    activePvLowCharge = false;
    activePvHighCharge = false;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_import";
    activeControlFamily = "charge";
    activeControlTargetSide = "import";
  } else if (onLowPvExportSide) {
    errGainCharge = errGainChargeExportLowPV;
    iGainCharge = iGainChargeExportLowPV;
    iMaxWChargeActive = iMaxWChargeExportLowPV;
    iErrMinWCharge = iErrMinWChargeExportLowPV;
    iDecayHoldChargeActive = iDecayHoldChargeExportLowPV;
    chargeParamSet = "export_lowpv";
    activePvLowCharge = true;
    activePvHighCharge = false;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_export_lowpv";
    activeControlFamily = "charge";
    activeControlTargetSide = "lowpv";
  } else if (onVeryHighPvExportSide) {
    errGainCharge = errGainChargeExportVeryHighPV;
    iGainCharge = iGainChargeExportVeryHighPV;
    iMaxWChargeActive = iMaxWChargeExportVeryHighPV;
    iErrMinWCharge = iErrMinWChargeExportVeryHighPV;
    iDecayHoldChargeActive = iDecayHoldChargeExportVeryHighPV;
    chargeParamSet = "export_veryhighpv";
    activePvLowCharge = false;
    activePvHighCharge = false;
    activePvVeryHighCharge = true;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_export_veryhighpv";
    activeControlFamily = "charge";
    activeControlTargetSide = "veryhighpv";
  } else if (onHighPvExportSide) {
    errGainCharge = errGainChargeExportHighPV;
    iGainCharge = iGainChargeExportHighPV;
    iMaxWChargeActive = iMaxWChargeExportHighPV;
    iErrMinWCharge = iErrMinWChargeExportHighPV;
    iDecayHoldChargeActive = iDecayHoldChargeExportHighPV;
    chargeParamSet = "export_highpv";
    activePvLowCharge = false;
    activePvHighCharge = true;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_export_highpv";
    activeControlFamily = "charge";
    activeControlTargetSide = "highpv";
  } else {
    errGainCharge = errGainChargeExport;
    iGainCharge = iGainChargeExport;
    iMaxWChargeActive = iMaxWChargeExport;
    iErrMinWCharge = iErrMinWChargeExport;
    iDecayHoldChargeActive = iDecayHoldChargeExport;
    chargeParamSet = "export";
    activePvLowCharge = false;
    activePvHighCharge = false;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "charge_export";
    activeControlFamily = "charge";
    activeControlTargetSide = "export";
  }

  activeErrGainCharge = errGainCharge;
  activeIGainCharge = iGainCharge;
  activeIMaxCharge = iMaxWChargeActive;
  activeIErrMinCharge = iErrMinWCharge;
  activeIDecayHoldCharge = iDecayHoldChargeActive;

  dischargeParamSet = "normal";
  activeErrGainDischarge = errGainDischarge;
  activeIGainDischarge = iGainDischarge;
  activeIMaxDischarge = iMaxWDischarge;
  activeIErrMinDischarge = iErrMinWDischarge;
  activeIDecayHoldDischarge = iDecayHoldDischarge;
  activePvDischarge = false;

  // HOLD-Eintritt 2.2 im effektiven Ladefenster: [p_o_s_in_charge_eff .. p_o_max_charge_eff]
  holdEligible = inWindow(p_zaehler, p_o_s_in_charge_eff, p_o_max_charge_eff) && lastChargeW > holdMinActiveW;
  holdConfirmMode = "charge";

  if (holdEligible) {
    holdEntryCountCharge = Math.min(holdEntryCountCharge + 1, holdConfirmTicks);
  } else {
    holdEntryCountCharge = 0;
  }

  holdConfirmed = (holdEntryCountCharge >= holdConfirmTicks);

  if (holdConfirmed) {
    hold = true;
    reason = "HOLD: Z im effektiven Ladefenster (2Tick bestätigt)";

    // HOLD bleibt unverändert auf gemeinsamem Lade-HOLD-Abbau
    iChargeW = clamp(iChargeW * iDecayHoldCharge, 0, iMaxWCharge);
    iDischargeW = 0;
    iEff = iChargeW;

    chargeParamSet = "hold";
    activeErrGainCharge = 0;
    activeIGainCharge = 0;
    activeIMaxCharge = iMaxWCharge;
    activeIErrMinCharge = 0;
    activeIDecayHoldCharge = iDecayHoldCharge;
    activePvLowCharge = false;
    activePvHighCharge = false;
    activePvVeryHighCharge = false;
    activeImportPvHighCharge = false;
    activeImportPvVeryHighCharge = false;

    activeControlSet = "hold_charge";
    activeControlFamily = "charge";
    activeControlTargetSide = "hold";

    if (lastChargeW > 0) {
      chargeRaw = lastChargeW;   // exakt halten
    } else {
      chargeRaw = battChargeNow; // HOLD-Fallback
    }
    dischargeRaw = 0;

    err = 0; errEff = 0;
  } else {
    hold = false;

    // Fehler: Ziel - Ist(Zähler) (positiv => mehr laden)
    // V2.5: Ziel ist die effektive Ladefenster-Mitte.
    err = (-p_zaehler + p_target);
    errEff = errGainCharge * err;

    // sehr kleine I-Komponente
    if (Math.abs(err) >= iErrMinWCharge) {
      iChargeW = clamp(iChargeW + (iGainCharge * err), 0, iMaxWChargeActive);
    } else {
      iChargeW = clamp(iChargeW * iDecayHoldChargeActive, 0, iMaxWChargeActive);
    }
    iDischargeW = clamp(iDischargeW * iDecayBlockedCharge, 0, iMaxWDischarge);
    iEff = iChargeW;

    chargeRaw =
      chargeControlBaseW +
      errEff +
      iChargeW;

    // Liegt der Zähler auf der Importseite des Zielwerts,
    // darf die Ladeanforderung nicht gegenüber dem letzten
    // ausgegebenen Sollwert erhöht werden.
    //
    // Die Sollwertbasis selbst bleibt unverändert.
    if (
      p_zaehler > p_target &&
      chargeRaw > lastChargeW
    ) {
      // Importseite:
      // Ladeanforderung darf nicht weiter steigen.
      chargeRaw = lastChargeW;
      chargeImportRawGuardActive = true;
    }
    else if (
      p_zaehler < p_target &&
      chargeRaw < lastChargeW
    ) {
      // Exportseite:
      // Ladeanforderung darf nicht sinken.
      chargeRaw = lastChargeW;
      chargeExportRawGuardActive = true;
    }

    dischargeRaw = 0;

    if (holdEligible && !holdConfirmed) {
      reason = "WAIT_HOLD: effektives Ladefenster noch nicht 2Tick bestätigt";
    } else {
      reason = onImportVeryHighPvSide
        ? "ADJ: außerhalb effektivem Ladefenster (Importseite Very-High-PV)"
        : (onImportHighPvSide
          ? "ADJ: außerhalb effektivem Ladefenster (Importseite High-PV)"
          : (onImportSide
            ? "ADJ: außerhalb effektivem Ladefenster (Importseite)"
            : (onLowPvExportSide
              ? "ADJ: außerhalb effektivem Ladefenster (Exportseite Low-PV)"
              : (onVeryHighPvExportSide
                ? "ADJ: außerhalb effektivem Ladefenster (Exportseite Very-High-PV)"
                : (onHighPvExportSide
                  ? "ADJ: außerhalb effektivem Ladefenster (Exportseite High-PV)"
                  : "ADJ: außerhalb effektivem Ladefenster (Exportseite)")))));
    }
  }

  // im Laden immer Entladen sofort 0 + reset lastDischarge
  lastDischargeW = 0;

  // SOC_BLOCK: Laden sperren wenn Batterie voll
  if (batt_max) {
    chargeRaw = 0;
    lastChargeW = 0;
    iChargeW = 0;
    iEff = 0;
    holdEntryCountCharge = 0;
  }
}
else if (effectiveRichtung === 2) {
  mode = "REGEL_ENTLADEN";
  p_target = p_o_b_out_m_discharge_eff;

  // Richtungswechsel auf ENTLADEN -> Lade-HOLD-Zähler zurücksetzen
  holdEntryCountCharge = 0;

  // Basis = aktuelle Entladeleistung (positiv dargestellt)
  const battDisNow = (p_batterie < 0) ? (-p_batterie) : 0;

  chargeParamSet = "discharge";
  activeErrGainCharge = 0;
  activeIGainCharge = 0;
  activeIMaxCharge = iMaxWCharge;
  activeIErrMinCharge = 0;
  activeIDecayHoldCharge = iDecayHoldCharge;
  activePvLowCharge = false;
  activePvHighCharge = false;
  activePvVeryHighCharge = false;
  activeImportPvHighCharge = false;
  activeImportPvVeryHighCharge = false;

  const onPvDischarge = (p_solar >= pvDischargeThreshold);

  let errGainDischargeActive;
  let iGainDischargeActive;
  let iMaxWDischargeActive;
  let iErrMinWDischargeActive;
  let iDecayHoldDischargeActive;

  if (onPvDischarge) {
    errGainDischargeActive = errGainDischargePV;
    iGainDischargeActive = iGainDischargePV;
    iMaxWDischargeActive = iMaxWDischargePV;
    iErrMinWDischargeActive = iErrMinWDischargePV;
    iDecayHoldDischargeActive = iDecayHoldDischargePV;
    dischargeParamSet = "discharge_pv";
    activePvDischarge = true;

    activeControlSet = "discharge_pv";
    activeControlFamily = "discharge";
    activeControlTargetSide = "pv";
  } else {
    errGainDischargeActive = lowPvOptimActive ? errGainDischargeOptimized : errGainDischarge;
    iGainDischargeActive = iGainDischarge;
    iMaxWDischargeActive = iMaxWDischarge;
    iErrMinWDischargeActive = iErrMinWDischarge;
    iDecayHoldDischargeActive = iDecayHoldDischarge;
    dischargeParamSet = "discharge";
    activePvDischarge = false;

    activeControlSet = "discharge";
    activeControlFamily = "discharge";
    activeControlTargetSide = "normal";
  }

  activeErrGainDischarge = errGainDischargeActive;
  activeIGainDischarge = iGainDischargeActive;
  activeIMaxDischarge = iMaxWDischargeActive;
  activeIErrMinDischarge = iErrMinWDischargeActive;
  activeIDecayHoldDischarge = iDecayHoldDischargeActive;

  if (!b_entladen) {
    hold = false;
    reason = "b_entladen=false -> discharge blocked";

    chargeRaw = 0;
    dischargeRaw = 0;

    // Reset damit kein Altwert bleibt
    lastChargeW = 0;
    lastDischargeW = 0;
    iChargeW = 0;
    iDischargeW = 0;
    holdEntryCountDischarge = 0;

    activeControlSet = "discharge_blocked";
    activeControlFamily = "discharge";
    activeControlTargetSide = "blocked";

    err = 0; errEff = 0;
    iEff = 0;
  } else {
    // HOLD-Eintritt 2.2 im Entladefenster: [p_o_b_out .. p_o_max]
    // V2.5: Entladefenster bleibt unverändert.
    holdEligible = inWindow(p_zaehler, p_o_b_out_discharge_eff, p_o_max_discharge_eff) && (!lowPvOptimActive || (Math.abs(p_zaehler - p_target) <= centerTrimBandW && Math.abs(battDisNow-lastDischargeW) <= centerTrimTrackingToleranceW)) && lastDischargeW > holdMinActiveW;
    holdConfirmMode = "discharge";

    if (holdEligible) {
      holdEntryCountDischarge = Math.min(holdEntryCountDischarge + 1, holdConfirmTicks);
    } else {
      holdEntryCountDischarge = 0;
    }

    holdConfirmed = (holdEntryCountDischarge >= holdConfirmTicks);

    if (holdConfirmed) {
      hold = true;
      reason = "HOLD: Z im Entladefenster (2Tick bestätigt)";

      iDischargeW = clamp(iDischargeW * iDecayHoldDischargeActive, 0, iMaxWDischargeActive);
      iChargeW = 0;
      iEff = iDischargeW;

      chargeRaw = 0;

      activeControlSet = "hold_discharge";
      activeControlFamily = "discharge";
      activeControlTargetSide = "hold";

      if (lastDischargeW > 0) {
        dischargeRaw = lastDischargeW; // exakt halten
      } else {
        dischargeRaw = battDisNow;     // HOLD-Fallback
      }

      err = 0; errEff = 0;
    } else {
      hold = false;

      // Fehler: Ist(Zähler) - Ziel (positiv => mehr entladen)
      err = (p_zaehler - p_target);
      errEff = errGainDischargeActive * err;
      // Correct a large confirmed/settled export event without changing fine-loop gain.
      if (snapshotBatteryFresh && lowPvOptimActive && p_zaehler < p_o_b_out_discharge_eff - dischargeLargeExportThresholdW && (Math.abs(battDisNow-lastDischargeW) <= dischargeFastBattTrackingToleranceW || n(flow.get("dischargeFastExportCnt"),0) >= 1)) {
        errEff = errGainDischargeLargeExport * err;
        activeErrGainDischarge = errGainDischargeLargeExport;
        activeControlSet = "discharge_export_fast";
      }

      // sehr kleine I-Komponente
      if (Math.abs(err) >= iErrMinWDischargeActive) {
        iDischargeW = clamp(iDischargeW + (iGainDischargeActive * err), 0, iMaxWDischargeActive);
      } else {
        iDischargeW = clamp(iDischargeW * iDecayHoldDischargeActive, 0, iMaxWDischargeActive);
      }
      iChargeW = clamp(iChargeW * iDecayBlockedDischarge, 0, iMaxWCharge);
      iEff = iDischargeW;

      // ----------------- SYMMETRISCHE ENTLADESOLLBASIS 4.13
      //
      // Spiegelbild zum Ladezweig:
      //
      //   Laden:
      //     Ladebasis + Zielabweichung + I-Anteil
      //
      //   Entladen:
      //     Entladebasis + Zielabweichung + I-Anteil
      //
      // Es findet keine Umschaltung der Regelbasis zwischen
      // Batterie-Istwert, letztem Sollwert und Bedarfswert statt.

      dischargeRawFromBatteryW =
        battDisNow +
        errEff +
        iDischargeW;

      dischargeRawFromLastW =
        lastDischargeW +
        errEff +
        iDischargeW;

      // Der rechnerische aktuelle Gesamtbedarf bleibt ausschließlich
      // als Diagnosewert erhalten. Er greift nicht mehr regelnd ein.
      dischargeTrackingDemandW = clamp(
        loadStepBattDisNow +
        loadStepZNoCharge -
        p_target,
        0,
        batt_power_max
      );

      dischargeTrackingDeltaW =
        battDisNow -
        lastDischargeW;

      dischargeBatteryUnderTracking =
        lastDischargeW > 0 &&
        dischargeTrackingDeltaW <
        -dischargeFastBattTrackingToleranceW;

      // Der bisherige Tracking- und Export-Raw-Guard wird nicht mehr
      // auf den Sollwert angewendet. Damit bleibt die Sollwertbasis
      // im gesamten Entladezweig einheitlich.
      dischargeTrackingHoldActive = false;
      dischargeExportRawGuardActive = false;

      dischargeRaw =
        dischargeControlBaseW +
        errEff +
        iDischargeW;

      // Liegt der Zähler auf der Exportseite des Zielwerts,
      // darf die Entladeanforderung nicht gegenüber dem letzten
      // ausgegebenen Sollwert erhöht werden.
      //
      // Die Sollwertbasis selbst bleibt unverändert.
      if (
        p_zaehler < p_target &&
        dischargeRaw > lastDischargeW
      ) {
        // Exportseite:
        // Entladeanforderung darf nicht weiter steigen.
        dischargeRaw = lastDischargeW;
        dischargeExportRawGuardActive = true;
      }
      else if (p_zaehler > p_target) {
        // Importseite:
        // Der Sollwert darf nicht unter den aktuell aus der
        // Leistungsbilanz berechneten Bedarf fallen.
        //
        // Ein alter höherer Sollwert darf nach einem Lastabfall
        // aber nicht blind gehalten werden.
        dischargeImportGuardFloorW = Math.min(
          lastDischargeW,
          dischargeTrackingDemandW
        );

        if (
          dischargeRaw <
          dischargeImportGuardFloorW
        ) {
          dischargeRaw =
            dischargeImportGuardFloorW;

          dischargeImportRawGuardActive = true;
        }
      }

      chargeRaw = 0;

      // ----------------- LASTSPRUNGERKENNUNG ENTLADE-KICK 4.9
      //
      // Das Kick-Ziel wird nicht aus dLoadEst aufgebaut.
      // Verwendet wird das aktuelle, leistungsbilanziell
      // berechnete und kurz gehaltene Ziel.

      loadStepKickBeforeDischargeRaw =
        dischargeRaw;

      loadStepKickTargetW = clamp(
        loadStepKickLatchedTargetW,
        0,
        batt_power_max
      );

      loadStepKickActive =
        loadStepKickHoldCnt > 0 &&
        effectiveRichtung === 2 &&
        regelung &&
        !netz_laden &&
        b_entladen &&
        !batt_min &&
        !loadStepChargeFirstBlocked &&
        p_zaehler >= p_target &&
        loadStepKickTargetW > dischargeRaw;

      if (loadStepKickActive) {
        dischargeRaw = Math.max(
          dischargeRaw,
          loadStepKickTargetW
        );
      }

      loadStepKickBaseW =
        Math.max(
          0,
          loadStepZNoCharge
        );

      loadStepKickAddW = Math.max(
        0,
        loadStepKickTargetW -
        loadStepKickBaseW
      );

      loadStepKickAfterDischargeRaw =
        dischargeRaw;

      if (holdEligible && !holdConfirmed) {
        reason = "WAIT_HOLD: Entladefenster noch nicht 2Tick bestätigt";
      } else {
        reason = onPvDischarge
          ? "ADJ: außerhalb Entladefenster (PV)"
          : "ADJ: außerhalb Entladefenster";

        if (loadStepKickActive) {
          reason += " -> Lastsprung-Entlade-Kick";
        }
      }

      // im Entladen immer Laden sofort 0 + reset lastCharge
      lastChargeW = 0;
    }
  }

  // SOC_BLOCK: Entladen sperren wenn Batterie leer
  if (batt_min) {
    dischargeRaw = 0;
    lastDischargeW = 0;
    iDischargeW = 0;
    iEff = 0;
    holdEntryCountDischarge = 0;
  }
}
else {
  mode = "OFF";
  reason = "richtung unset (expected 1 or 2) -> outputs 0, no battery direction output";
  hold = false;

  p_target = 0;

  chargeRaw = 0;
  dischargeRaw = 0;

  chargeParamSet = "unset";
  activeErrGainCharge = 0;
  activeIGainCharge = 0;
  activeIMaxCharge = iMaxWCharge;
  activeIErrMinCharge = 0;
  activeIDecayHoldCharge = iDecayHoldCharge;
  activePvLowCharge = false;
  activePvHighCharge = false;
  activePvVeryHighCharge = false;
  activeImportPvHighCharge = false;
  activeImportPvVeryHighCharge = false;

  dischargeParamSet = "normal";
  activeErrGainDischarge = errGainDischarge;
  activeIGainDischarge = iGainDischarge;
  activeIMaxDischarge = iMaxWDischarge;
  activeIErrMinDischarge = iErrMinWDischarge;
  activeIDecayHoldDischarge = iDecayHoldDischarge;
  activePvDischarge = false;

  activeControlSet = "unset";
  activeControlFamily = "off";
  activeControlTargetSide = "none";

  // Reset damit beim Ausschalten / ungültiger Richtung keine Altwerte stehen bleiben
  lastChargeW = 0;
  lastDischargeW = 0;
  iChargeW = 0;
  iDischargeW = 0;
  holdEntryCountCharge = 0;
  holdEntryCountDischarge = 0;
  err = 0; errEff = 0;
  iEff = 0;
}

// =========================================================
// Begrenzen (raw)
if (chargeRaw < 0) chargeRaw = 0;
if (dischargeRaw < 0) dischargeRaw = 0;

chargeRaw = clamp(chargeRaw, 0, batt_power_max);
dischargeRaw = clamp(dischargeRaw, 0, batt_power_max);

// =========================================================
// Asymmetrische Rampe (nur wenn NICHT HOLD; HOLD bleibt exakt)
let chargeW = 0;
let dischargeW = 0;

// PV-abhängige Down-Rampe für Laden:
// Low/Normal-PV bleibt weich, High-/VeryHigh-PV darf Ladeleistung schneller abbauen.
// Wichtig: Nur im REGEL_LADEN aktiv, damit NETZ_LADEN sein bisheriges Verhalten behält.
let stepDownChargeActiveW = stepDownChargeW;
let stepDownChargeActiveReason = "LOW_NORMAL_PV";

if (mode === "REGEL_LADEN") {
  if (p_solar >= pvVeryHighThreshold) {
    stepDownChargeActiveW = stepDownChargeVeryHighPVW;
    stepDownChargeActiveReason = "VERY_HIGH_PV";
  } else if (p_solar >= pvHighThreshold) {
    stepDownChargeActiveW = stepDownChargeHighPVW;
    stepDownChargeActiveReason = "HIGH_PV";
  }
} else if (mode === "NETZ_LADEN") {
  stepDownChargeActiveReason = "NETZ_LADEN_BASE";
} else {
  stepDownChargeActiveReason = "NOT_CHARGE_MODE";
}

// ----------------- PV-FOLLOW-GUARD 3.9
let pvFollowGuardActive = false;
let pvFollowGuardLimited = false;
let pvFollowGuardConfirmed = false;
let pvFollowGuardFallActive = false;
let pvFollowGuardFallRawActive = false;
let pvFollowGuardFallLatched = false;
let pvFollowGuardFallKeepActive = false;
let pvFollowGuardFallKeepCondition = false;
let pvFollowGuardFallStepApplied = false;
let pvFollowGuardFallKickApplied = false;
let pvFollowGuardReason = "inactive";
let pvFollowGuardCnt = n(flow.get("pvFollowGuardCnt"), 0);
let pvFollowFallLatchCnt = n(flow.get("pvFollowFallLatchCnt"), 0);
let pvFollowFallKeepWasActive = b(flow.get("pvFollowFallKeepWasActive"), false);
let pvFollowGuardRequiredTicks = 0;
let pvFollowGuardUnconfirmedStepW = 0;
let pvFollowChargeRawBefore = chargeRaw;
let pvFollowChargeRawAfter = chargeRaw;
let pvFollowChargeRawFallLimit = null;
let pvFollowStepDownBefore = stepDownChargeActiveW;
let pvFollowStepDownAfter = stepDownChargeActiveW;

const pvFollowPrevSolar = Number(flow.get("pvFollow_prev_p_solar"));
const pvFollowHavePrev = Number.isFinite(pvFollowPrevSolar);
const pvFollow_dSolar = pvFollowHavePrev ? (p_solar - pvFollowPrevSolar) : 0;

const pvFollowIsVeryHighPV = (mode === "REGEL_LADEN" && p_solar >= pvVeryHighThreshold);
const pvFollowIsHighPV = (mode === "REGEL_LADEN" && !pvFollowIsVeryHighPV && p_solar >= pvHighThreshold);
const pvFollowIsHighOrVeryHighPV = pvFollowIsHighPV || pvFollowIsVeryHighPV;

// Roh-Fallerkennung unabhängig von aktueller PV-Klasse.
// Wichtig für High/VeryHigh -> Normal: Der Fall darf nicht sofort inaktiv werden.
pvFollowGuardFallRawActive =
  pvFollowGuardEnabled &&
  mode === "REGEL_LADEN" &&
  !hold &&
  !batt_max &&
  pvFollowHavePrev &&
  pvFollow_dSolar < -pvFollowFallAbortW;

// PV-Fall-Nachlauf 4.6:
// Wenn nach einem erkannten PV-Fall noch Importseite anliegt
// und die Batterie real noch lädt, darf der Fall-Schutz nicht sofort enden.
// Wichtig:
//  - Diese Logik startet keinen neuen PV-Fall selbstständig.
//  - Sie hält nur einen bereits aktiven/gelatchten PV-Fall weiter.
//  - Dadurch wird kein normales Import-Regeln verändert.
pvFollowGuardFallKeepCondition =
  pvFollowGuardEnabled &&
  mode === "REGEL_LADEN" &&
  !hold &&
  !batt_max &&
  p_zaehler > p_o_max_charge_eff &&
  p_batterie > pvFollowFallKeepChargeW;

pvFollowGuardFallKeepActive =
  pvFollowGuardFallKeepCondition &&
  (
    pvFollowGuardFallRawActive ||
    pvFollowFallLatchCnt > 0 ||
    pvFollowFallKeepWasActive
  );

// Fall-Latch:
// Wenn PV schnell fällt, bleibt der Fall-Schutz noch wenige Ticks aktiv.
// Dadurch wirkt er auch dann weiter, wenn PV direkt unter pvHighThreshold fällt.
// V4.6:
// Wenn nach dem Fall weiterhin Importseite + echte Batterieladung vorhanden sind,
// bleibt der Fall-Schutz aktiv, bis diese Folge des PV-Falls abgebaut ist.
if (pvFollowGuardFallRawActive) {
  pvFollowFallLatchCnt = pvFollowFallLatchTicks;
} else if (pvFollowGuardFallKeepActive) {
  pvFollowFallLatchCnt = Math.max(1, pvFollowFallLatchCnt);
} else {
  pvFollowFallLatchCnt = Math.max(0, pvFollowFallLatchCnt - 1);
}

pvFollowGuardFallLatched = pvFollowFallLatchCnt > 0;

pvFollowGuardActive =
  pvFollowGuardEnabled &&
  mode === "REGEL_LADEN" &&
  !hold &&
  !batt_max &&
  (pvFollowIsHighOrVeryHighPV || pvFollowGuardFallLatched || pvFollowGuardFallKeepActive);

if (pvFollowGuardActive) {
  pvFollowGuardRequiredTicks = pvFollowIsVeryHighPV
    ? pvFollowStableTicksVeryHighPV
    : pvFollowStableTicksHighPV;

  pvFollowGuardUnconfirmedStepW = pvFollowIsVeryHighPV
    ? pvFollowUnconfirmedStepVeryHighPVW
    : pvFollowUnconfirmedStepHighPVW;

  pvFollowGuardFallActive =
    pvFollowGuardFallRawActive ||
    pvFollowGuardFallLatched ||
    pvFollowGuardFallKeepActive;

  if (pvFollowGuardFallActive) {
    pvFollowGuardCnt = 0;
    pvFollowGuardReason = pvFollowGuardFallRawActive
      ? "Solar fällt schnell -> Bestätigung zurücksetzen"
      : (pvFollowGuardFallKeepActive
        ? "Solar-Fall-Nachlauf aktiv: Importseite + Batterieladung -> Schutz weiterführen"
        : "Solar-Fall-Latch aktiv -> Schutz weiterführen");

    // Der aktuelle Zählerwert und der aktuelle Batterie-Istwert stammen
    // bereits aus dem Snapshot nach der PV-Änderung. Der PV-Abfall darf
    // deshalb nicht nochmals über dSolar von chargeRaw abgezogen werden.
    //
    // Der Fall-Schutz beschleunigt ausschließlich den Ladeabbau, wenn der
    // normale PI-Rohwert tatsächlich kleiner als der letzte Sollwert ist.
    // Die Berechnung von chargeRaw selbst bleibt vollständig beim PI-Regler.
    pvFollowChargeRawFallLimit = null;
    pvFollowGuardFallKickApplied = false;

    if (chargeRaw < lastChargeW) {
      stepDownChargeActiveW = Math.max(
        stepDownChargeActiveW,
        pvFollowFallStepDownW
      );

      pvFollowGuardFallStepApplied = true;
      pvFollowGuardReason +=
        " -> PI verlangt weniger Laden -> schneller Ramp-Down aktiv";
    } else {
      pvFollowGuardReason +=
        " -> PI verlangt keinen Ladeabbau";
    }

    pvFollowGuardReason +=
      " -> kein zusätzlicher chargeRaw-Fall-Kick";
  } else if (!pvFollowHavePrev || Math.abs(pvFollow_dSolar) <= pvFollowStableBandW) {
    pvFollowGuardCnt = Math.min(pvFollowGuardCnt + 1, pvFollowGuardRequiredTicks);
    pvFollowGuardReason = "Solar stabil -> Bestätigung zählt";
  } else {
    pvFollowGuardCnt = 0;
    pvFollowGuardReason = "Solar steigt/springt noch -> Erhöhung begrenzen";
  }

  pvFollowGuardConfirmed = pvFollowGuardCnt >= pvFollowGuardRequiredTicks;

  // Nur Ladeleistungs-Erhöhung begrenzen.
  // Reduzieren bleibt frei.
  // Importseite bleibt frei, damit Importkorrektur nicht verlangsamt wird.
  // Bei aktivem PV-Fall wurde oben bereits über die schnelle Down-Rampe entschieden.
  if (
    !pvFollowGuardConfirmed &&
    !pvFollowGuardFallActive &&
    p_zaehler <= p_o_max_charge_eff &&
    chargeRaw > (lastChargeW + pvFollowRiseMarginW)
  ) {
    chargeRaw = Math.min(chargeRaw, lastChargeW + pvFollowGuardUnconfirmedStepW);
    pvFollowGuardLimited = chargeRaw < pvFollowChargeRawBefore;
    pvFollowGuardReason += " -> chargeRaw begrenzt";
  } else if (pvFollowGuardConfirmed) {
    pvFollowGuardReason += " -> normale Lade-Rampe freigegeben";
  } else {
    pvFollowGuardReason += " -> kein Anstiegs-Eingriff";
  }
} else {
  pvFollowGuardCnt = 0;
  pvFollowGuardReason = "nicht aktiv";
}

pvFollowChargeRawAfter = chargeRaw;
pvFollowStepDownAfter = stepDownChargeActiveW;
flow.set("pvFollowGuardCnt", pvFollowGuardCnt);
flow.set("pvFollowFallLatchCnt", pvFollowFallLatchCnt);
flow.set("pvFollowFallKeepWasActive", pvFollowGuardFallKeepActive);

// ----------------- LASTSPRUNGERKENNUNG ENTLADE-UP-RAMPE 4.11
// Ziel:
//  - Der dischargeRaw-Kick hebt den Zielwert sofort an.
//  - Die erhöhte 900-W-Aufwärtsrampe gilt nur während des
//    kurzen Leistungs-Kick-Holds.
//  - Der längere Richtungslatch hält ausschließlich die Richtung
//    und darf die aggressive Leistungsrampe nicht verlängern.
//  - Außerhalb des Kick-Holds bleibt die normale 300-W-Rampe aktiv.
const loadStepDischargeRampActive =
  mode === "REGEL_ENTLADEN" &&
  !hold &&
  loadStepKickHoldCnt > 0 &&
  effectiveRichtung === 2 &&
  b_entladen &&
  !batt_min &&
  !loadStepChargeFirstBlocked &&
  dischargeRaw > lastDischargeW;

const stepUpDischargeActiveW = loadStepDischargeRampActive
  ? stepUpDischargeLoadStepW
  : (lowPvOptimActive ? stepUpDischargeOptimizedW : stepUpDischargeW);

// ----------------- DYNAMISCHER ENTLADE-STEP-DOWN 4.9
//
// Ziele:
//  - echter großer Lastabfall: sofort schneller Abbau
//  - einzelner Exportimpuls: noch kein schneller Abbau
//  - anhaltender Export: schneller Abbau erst nach Bestätigung
//  - Export durch Batterienachlauf: nicht vorschnell überreagieren

const battDisNowForStepDown =
  p_batterie < 0
    ? -p_batterie
    : 0;

// Abweichung zwischen tatsächlicher Batterieentladung
// und dem zuletzt ausgegebenen Entladesollwert.
const dischargeBattTrackingErrorW =
  Math.abs(
    battDisNowForStepDown -
    lastDischargeW
  );

const dischargeBattSettled =
  dischargeBattTrackingErrorW <=
  dischargeFastBattTrackingToleranceW;

// Persistenten Export-Bestätigungszähler lesen.
let dischargeFastExportCnt =
  n(flow.get("dischargeFastExportCnt"), 0);

// Exportkandidat nur während einer tatsächlich aktiven
// Entladeregelung außerhalb HOLD.
const dischargeFastExportCandidate =
  mode === "REGEL_ENTLADEN" &&
  !hold &&
  p_zaehler <
  -dischargeFastStepDownExportW;

if (dischargeFastExportCandidate) {
  dischargeFastExportCnt = Math.min(
    dischargeFastExportCnt + 1,
    dischargeFastExportConfirmTicks
  );
}
else {
  dischargeFastExportCnt = 0;
}

// Export löst den schnellen Step-down erst aus, wenn:
//  1. deutlicher Export über mehrere frische Regeltakte bestätigt ist
//  2. noch ein Entladesollwert oder eine reale Batterieentladung aktiv ist
//
// dischargeBattSettled bleibt ausschließlich als Debugwert erhalten.
// Eine verzögert nachlaufende Batterie darf den schnellen Exportabbau
// nicht mehr blockieren.
const dischargeFastStepDownByExport =
  dischargeFastExportCandidate &&
  dischargeFastExportCnt >=
  dischargeFastExportConfirmTicks &&
  (
    lastDischargeW > 0 ||
    battDisNowForStepDown > 0
  );

// Ein echter großer Lastabfall darf sofort wirken.
// Durch die korrigierte dLoadEst-Formel entspricht dies nun
// tatsächlich einer negativen Hauslaständerung.
const dischargeFastStepDownByLoadDrop =
  mode === "REGEL_ENTLADEN" &&
  !hold &&
  loadStepHavePrev &&
  loadStepBatteryDeltaValid &&
  dischargeBattSettled &&
  loadStep_dLoadEst <
  -dischargeFastStepDownLoadDropW;

const dischargeFastStepDownActive =
  dischargeFastStepDownByLoadDrop ||
  dischargeFastStepDownByExport;

const stepDownDischargeActiveW =
  dischargeFastStepDownActive
    ? stepDownDischargeFastW
    : stepDownDischargeNormalW;

// Export-Bestätigungszustand persistent speichern.
flow.set(
  "dischargeFastExportCnt",
  dischargeFastExportCnt
);

if (mode === "NETZ_LADEN" || mode === "REGEL_LADEN") {
  dischargeW = 0;

  if (hold) {
    chargeW = chargeRaw; // exakt lastChargeW bzw. Fallback
  } else {
    chargeW = rampAsym(chargeRaw, lastChargeW, stepUpChargeW, stepDownChargeActiveW);
  }
}
else if (mode === "REGEL_ENTLADEN") {
  chargeW = 0;

  if (hold) {
    dischargeW = dischargeRaw; // exakt lastDischargeW bzw. Fallback
  } else {
    dischargeW = rampAsym(
      dischargeRaw,
      lastDischargeW,
      stepUpDischargeActiveW,
      stepDownDischargeActiveW
    );
  }
}
else {
  chargeW = 0;
  dischargeW = 0;

  // OFF-Failsafe 3.0:
  // bei Regler aus / ungültiger Richtung wirklich nichts stehen lassen
  chargeRaw = 0;
  dischargeRaw = 0;
  lastChargeW = 0;
  lastDischargeW = 0;
  iChargeW = 0;
  iDischargeW = 0;
  iEff = 0;
}

// =========================================================

// Simulation-tested midpoint trim in normal discharge, only inside the original window.
const centerTrimNowTs = Date.now();
let centerTrimLastChangeTs = n(flow.get("regler_center_trim_last_change_ts"), centerTrimNowTs);
if (centerTrimLastChangeTs <= 0 || centerTrimLastChangeTs > centerTrimNowTs) centerTrimLastChangeTs = centerTrimNowTs;
const centerTrimAgeMs = centerTrimNowTs - centerTrimLastChangeTs;
const centerTrimErrorW = p_zaehler - p_target;
let centerTrimActive = false;
let centerTrimApplied = false;
let dischargeTrackingWaitActive = false;
let centerTrimStepW = 0;
const centerTrimTrackingErrorW = Math.abs(Math.max(0,-p_batterie) - lastDischargeW);
if (mode === "REGEL_ENTLADEN" && lowPvOptimActive && b_entladen && !batt_min && lastDischargeW > holdMinActiveW && (inWindow(p_zaehler, p_o_b_out_discharge_eff, p_o_max_discharge_eff) || Math.abs(centerTrimErrorW) <= centerTrimOuterBandW)) {
  centerTrimActive = true;
  dischargeW = lastDischargeW;
  const trimCentered = inWindow(p_zaehler, p_o_b_out_discharge_eff, p_o_max_discharge_eff) && Math.abs(centerTrimErrorW) <= centerTrimBandW;
  if (!trimCentered && snapshotBatteryFresh && centerTrimTrackingErrorW <= centerTrimTrackingToleranceW && centerTrimAgeMs >= centerTrimWaitMs) {
    const centerTrimStepLimitW = inWindow(p_zaehler, p_o_b_out_discharge_eff, p_o_max_discharge_eff) ? centerTrimMaxStepW : centerTrimMaxOutsideStepW;
    centerTrimStepW = clamp(centerTrimGain * centerTrimErrorW, -centerTrimStepLimitW, centerTrimStepLimitW);
    dischargeW = clamp(lastDischargeW + centerTrimStepW, 0, batt_power_max);
    centerTrimApplied = true;
  }
  hold = trimCentered && holdConfirmed;
  activeControlSet = hold ? "hold_discharge" : (centerTrimApplied ? "center_trim_discharge" : "center_wait_discharge");
  reason = hold ? "HOLD: Mitte bestätigt" : (centerTrimApplied ? "CENTER_TRIM: kleine Korrektur zur Mitte" : "CENTER_WAIT: Stellreaktion / Mitte abwarten");
}

if (mode === "REGEL_ENTLADEN" && lowPvOptimActive && b_entladen && !batt_min && snapshotBatteryFresh && p_zaehler > p_o_max_discharge_eff && lastDischargeW > Math.max(0,-p_batterie) + dischargePendingToleranceW && centerTrimAgeMs < dischargePendingMaxWaitMs) {
  dischargeW = lastDischargeW;
  hold = false;
  dischargeTrackingWaitActive = true;
  activeControlSet = "tracking_wait_discharge";
  reason = "TRACKING_WAIT: große Stellreaktion abwarten";
}

// Status der tatsächlich wirksamen Fein-/Warteführung.
if (centerTrimActive || dischargeTrackingWaitActive) {
  dischargeRaw = dischargeW;
  err = centerTrimErrorW;
  errEff = centerTrimApplied && !dischargeTrackingWaitActive ? centerTrimStepW : 0;
  iEff = 0;
  activeErrGainDischarge = centerTrimApplied && !dischargeTrackingWaitActive ? centerTrimGain : 0;
  activeIGainDischarge = 0;
}
// Runden + Speichern
chargeW = Math.round(chargeW);
dischargeW = Math.round(dischargeW);

// SOC_BLOCK FailSafe (hart am Ende)
if (batt_max) chargeW = 0;
if (batt_min) dischargeW = 0;

// OFF-Failsafe 3.0 nochmals hart nach SOC-Block:
// Auch bei sehr hoher Last bleiben Lade-/Entladeausgänge 0, wenn Regler aus ist.
if (mode === "OFF") {
  chargeW = 0;
  dischargeW = 0;
  lastChargeW = 0;
  lastDischargeW = 0;
  iChargeW = 0;
  iDischargeW = 0;
  iEff = 0;
}

if (mode !== "REGEL_ENTLADEN" || dischargeW !== lastDischargeW) centerTrimLastChangeTs = centerTrimNowTs;
flow.set("regler_center_trim_last_change_ts", centerTrimLastChangeTs);
flow.set("lastChargeW", chargeW);
flow.set("lastDischargeW", dischargeW);
flow.set("iChargeW", iChargeW);
flow.set("iDischargeW", iDischargeW);
flow.set("holdEntryCountCharge", holdEntryCountCharge);
flow.set("holdEntryCountDischarge", holdEntryCountDischarge);

// =========================================================
// Batterie-Richtung Sollausgang 4.17
//
// Der PI-Regler gibt in jedem gültigen Regeltakt ausschließlich
// die aktuell gewünschte Richtung an den nachgelagerten Node
// "AC-Mode Soll / Ist" aus.
//
// Dieser nachgelagerte Node entscheidet zentral:
//  - ob ein HTTP-Schreibbefehl erforderlich ist,
//  - ob PackState/AcMode bereits passen,
//  - wann nach 8 s erneut gesendet werden muss.
//
// Dadurch existiert nur eine einzige acMode-Zustands- und
// Wiederholungslogik. Der PI-Regler führt selbst keinen
// acMode-Retry und keine Duplikatunterdrückung mehr aus.
let batteryAcModeOut = null;
let batteryDirectionReason = "none";

if (mode === "NETZ_LADEN") {
  batteryAcModeOut = 1;
  batteryDirectionReason =
    "NETZ_LADEN -> Sollrichtung Laden";
}
else if (mode === "REGEL_LADEN") {
  batteryAcModeOut = 1;
  batteryDirectionReason =
    "REGEL_LADEN -> Sollrichtung Laden";
}
else if (mode === "REGEL_ENTLADEN") {
  batteryAcModeOut = 2;
  batteryDirectionReason =
    "REGEL_ENTLADEN -> Sollrichtung Entladen";
}
else {
  batteryAcModeOut = null;
  batteryDirectionReason =
    "OFF -> keine Sollrichtung ausgeben";
}

const batteryAcModeSendNow =
  batteryAcModeOut === 1 ||
  batteryAcModeOut === 2;

// =========================================================
// Status + Node-Status
const status = {
  centerTrim: {active: centerTrimActive, applied: centerTrimApplied, stepW: centerTrimStepW, errorW: centerTrimErrorW, ageMs: centerTrimAgeMs, lastChangeTs: centerTrimLastChangeTs, trackingErrorW: centerTrimTrackingErrorW, bandW: centerTrimBandW, outerBandW: centerTrimOuterBandW, maxStepW: centerTrimMaxStepW, maxOutsideStepW: centerTrimMaxOutsideStepW, waitMs: centerTrimWaitMs, gain: centerTrimGain, trackingWaitActive: dischargeTrackingWaitActive, pendingToleranceW: dischargePendingToleranceW, pendingMaxWaitMs: dischargePendingMaxWaitMs, optimizedPvMaxW},
  ts: Date.now(),
  version: VERSION,
  mode,
  hold,
  reason,
  cfg: {
    optimizedPvMaxW, errGainDischargeOptimized, stepUpDischargeOptimizedW,
    errGainDischargeLargeExport, dischargeLargeExportThresholdW,
    dischargePendingToleranceW, dischargePendingMaxWaitMs,
    centerTrimBandW, centerTrimOuterBandW, centerTrimMaxStepW,
    centerTrimMaxOutsideStepW, centerTrimWaitMs, centerTrimGain, centerTrimTrackingToleranceW,
    batt_power_max,

    // --- Laden asymmetrisch
    errGainChargeImport,
    errGainChargeImportHighPV,
    errGainChargeImportVeryHighPV,
    errGainChargeExport,
    errGainChargeExportLowPV,
    errGainChargeExportHighPV,
    errGainChargeExportVeryHighPV,
    iGainChargeImport,
    iMaxWChargeImport,
    iErrMinWChargeImport,
    iDecayHoldChargeImport,
    iGainChargeImportHighPV,
    iMaxWChargeImportHighPV,
    iErrMinWChargeImportHighPV,
    iDecayHoldChargeImportHighPV,
    iGainChargeImportVeryHighPV,
    iMaxWChargeImportVeryHighPV,
    iErrMinWChargeImportVeryHighPV,
    iDecayHoldChargeImportVeryHighPV,
    iGainChargeExport,
    iMaxWChargeExport,
    iErrMinWChargeExport,
    iDecayHoldChargeExport,
    iGainChargeExportLowPV,
    iMaxWChargeExportLowPV,
    iErrMinWChargeExportLowPV,
    iDecayHoldChargeExportLowPV,
    iGainChargeExportHighPV,
    iMaxWChargeExportHighPV,
    iErrMinWChargeExportHighPV,
    iDecayHoldChargeExportHighPV,
    iGainChargeExportVeryHighPV,
    iMaxWChargeExportVeryHighPV,
    iErrMinWChargeExportVeryHighPV,
    iDecayHoldChargeExportVeryHighPV,
    iDecayBlockedCharge,
    pvLowThreshold,
    pvHighThreshold,
    pvVeryHighThreshold,

    // --- HIGH-/VERY-HIGH-PV FENSTERVERSCHIEBUNG 2.5
    pvWindowOffsetHighPV,
    pvWindowOffsetVeryHighPV,

    // --- Laden gemeinsame HOLD-/Speicherparameter
    iDecayHoldCharge,
    iMaxWCharge,

    // --- Rampen 3.3
    stepUpChargeW,
    stepDownChargeW,
    stepDownChargeHighPVW,
    stepDownChargeVeryHighPVW,
    stepUpDischargeW,
    stepUpDischargeLoadStepW,
    stepDownDischargeW,

    // --- PV-Follow-Guard 3.6
    pvFollowGuardEnabled,
    pvFollowStableBandW,
    pvFollowFallAbortW,
    pvFollowRiseMarginW,
    pvFollowStableTicksHighPV,
    pvFollowStableTicksVeryHighPV,
    pvFollowUnconfirmedStepHighPVW,
    pvFollowUnconfirmedStepVeryHighPVW,
    pvFollowFallStepDownW,
    pvFollowFallLatchTicks,
    pvFollowFallExtraReserveW,
    pvFollowFallKeepChargeW,

    // --- Kompatibilität alte Logs
    stepUpW,
    stepDownW,

    // --- Entladen
    errGainDischarge,
    errGainDischargePV,
    iGainDischarge,
    iMaxWDischarge,
    iErrMinWDischarge,
    iDecayHoldDischarge,
    iGainDischargePV,
    iMaxWDischargePV,
    iErrMinWDischargePV,
    iDecayHoldDischargePV,
    pvDischargeThreshold,
    iDecayBlockedDischarge,

    // --- Richtungs-Schutz 2.1
    dirGuard_chargeMarginW,
    dirGuard_surplusMarginW,
    dirGuard_maxBattDischargeForChargeW,

    // --- HOLD-Bestätigung 2.2
    holdConfirmTicks,

    // --- Asymmetrisches Anti-Flip 2.4
    antiFlip_confirmN_toDischarge,
    antiFlip_confirmN_toDischargeLowPV,
    antiFlip_confirmN_toCharge,
    antiFlip_minHoldMs,

    holdMinActiveW,

    // --- Lastsprung-Entlade-Kick 4.1
    loadStepKickFactor,
    loadStepKickReserveW,

    // --- High-/Very-High-PV Seiten-Hysterese 3.2
    chargeSideHystHighPV,
    chargeSideHystVeryHighPV,

    // --- Interne Richtungsentscheidung 3.1
    solar_min,
    margin_chargeW,
    margin_dischargeW,
    margin_dischargeLowPVW,
    confirm_toDischargeN,
    confirm_toDischargeLowPVN,
    confirm_toChargeN,
    exportBlockW
  },

  // Basis-Schwellen bleiben unverändert
  thresholds: {
    p_o_s_in,
    p_o_b_out,
    p_o_max,
    p_o_s_in_m,
    p_o_b_out_m
  },

  // Effektive Fenster für die tatsächliche Regelung
  effectiveWindows: {
    charge: {
      pvClass: chargeWindowPvClass,
      pvWindowOffsetW,
      p_o_s_in_eff: p_o_s_in_charge_eff,
      p_o_max_eff: p_o_max_charge_eff,
      p_o_s_in_m_eff: p_o_s_in_m_charge_eff
    },
    discharge: {
      p_o_b_out_eff: p_o_b_out_discharge_eff,
      p_o_max_eff: p_o_max_discharge_eff,
      p_o_b_out_m_eff: p_o_b_out_m_discharge_eff
    }
  },

  targets: { p_target },
  err: { err, errEff, iEff },

  // --- Inputs (erweitert um p_solar + p_haus)
  inputs: { p_zaehler, p_batterie, p_solar, p_haus },

  // --- Batteriestatus aus 5s Status-Node
  batteryStatus: {
    batt_acMode,
    batt_acModeText: acModeTxt(batt_acMode),
    batt_packState,
    batt_packStateText: packStateTxt(batt_packState)
  },

  raw: { chargeRaw, dischargeRaw },
  outputs: { chargeW, dischargeW },

  // --- Rampen Debug 4.8
  ramps: {
    charge: {
      stepUpW: stepUpChargeW,
      stepDownW: stepDownChargeW,
      stepDownHighPVW: stepDownChargeHighPVW,
      stepDownVeryHighPVW: stepDownChargeVeryHighPVW,
      stepDownActiveW: stepDownChargeActiveW,
      stepDownActiveReason: stepDownChargeActiveReason
    },

    discharge: {
      stepUpW: stepUpDischargeActiveW,

      // neue getrennte Step-Down-Rampen
      stepDownNormalW: stepDownDischargeNormalW,
      stepDownFastW: stepDownDischargeFastW,
      stepDownActiveW: stepDownDischargeActiveW,

      fastActive: dischargeFastStepDownActive,
      fastByExport: dischargeFastStepDownByExport,
      fastByLoadDrop: dischargeFastStepDownByLoadDrop,

      exportThresholdW: dischargeFastStepDownExportW,
      loadDropThresholdW: dischargeFastStepDownLoadDropW
    },

    active:
      mode === "REGEL_LADEN" || mode === "NETZ_LADEN"
        ? {
          family: "charge",
          stepUpW: stepUpChargeW,
          stepDownW: stepDownChargeActiveW,
          stepDownBaseW: stepDownChargeW,
          stepDownHighPVW: stepDownChargeHighPVW,
          stepDownVeryHighPVW: stepDownChargeVeryHighPVW,
          reason: stepDownChargeActiveReason
        }
        : (
          mode === "REGEL_ENTLADEN"
            ? {
              family: "discharge",
              stepUpW: stepUpDischargeActiveW,
              stepDownW: stepDownDischargeActiveW,
              fastActive: dischargeFastStepDownActive
            }
            : {
              family: "off",
              stepUpW: 0,
              stepDownW: 0
            }
        )
  },

  // --- Batterie-Richtung Sollausgang 4.17
  batteryDirection: {
    outputIndex: 0,

    acMode:
      batteryAcModeOut,

    payload:
      batteryAcModeOut,

    reason:
      batteryDirectionReason,

    // Bedeutet ausschließlich:
    // Der PI-Regler gibt in diesem Tick die gewünschte
    // Richtung an "AC-Mode Soll / Ist" aus.
    //
    // Ob tatsächlich ein HTTP-Befehl gesendet wird,
    // entscheidet erst der nachgelagerte Node.
    sendsOutput:
      batteryAcModeSendNow,

    sendReason:
      batteryAcModeSendNow
        ? "desired_direction_tick"
        : "off_no_direction",

    statusAcMode:
      batt_acMode,

    statusPackState:
      batt_packState
  },

  // --- SOC_BLOCK 4.15
  socBlock: {
    soc_block,

    batt_min_raw,
    batt_min,
    batt_min_pending:
      battMinPending,

    batt_min_confirm_ms:
      battMinConfirmMs,

    batt_min_raw_since_ts:
      battMinRawSinceTs,

    batt_min_raw_duration_ms:
      battMinRawDurationMs,

    batt_max
  },

  // --- Integrator Debug
  integrator: {
    iChargeW,
    iDischargeW,
    iEff
  },

  // --- HOLD Debug 2.2
  holdDebug: {
    holdConfirmTicks,
    eligible: holdEligible,
    confirmed: holdConfirmed,
    mode: holdConfirmMode,
    entryCountCharge: holdEntryCountCharge,
    entryCountDischarge: holdEntryCountDischarge
  },

  // --- Vereinfachter aktiver Sollwertsatz für Log-Auswertung
  controlSet: {
    active: activeControlSet,
    family: activeControlFamily,
    targetSide: activeControlTargetSide,
    params: {
      errGain: (activeControlFamily === "charge")
        ? activeErrGainCharge
        : ((activeControlFamily === "discharge") ? activeErrGainDischarge : 0),
      iGain: (activeControlFamily === "charge")
        ? activeIGainCharge
        : ((activeControlFamily === "discharge") ? activeIGainDischarge : 0),
      iMaxW: (activeControlFamily === "charge")
        ? activeIMaxCharge
        : ((activeControlFamily === "discharge") ? activeIMaxDischarge : 0),
      iErrMinW: (activeControlFamily === "charge")
        ? activeIErrMinCharge
        : ((activeControlFamily === "discharge") ? activeIErrMinDischarge : 0),
      iDecayHold: (activeControlFamily === "charge")
        ? activeIDecayHoldCharge
        : ((activeControlFamily === "discharge") ? activeIDecayHoldDischarge : 0)
    }
  },

  // --- Lade-Parameter Debug
  chargeParams: {
    set: chargeParamSet,
    pvLowActive: activePvLowCharge,
    pvHighActive: activePvHighCharge,
    pvVeryHighActive: activePvVeryHighCharge,
    importPvHighActive: activeImportPvHighCharge,
    importPvVeryHighActive: activeImportPvVeryHighCharge,
    windowOffsetW: pvWindowOffsetW,
    effectiveWindow: {
      p_o_s_in_eff: p_o_s_in_charge_eff,
      p_o_max_eff: p_o_max_charge_eff,
      p_o_s_in_m_eff: p_o_s_in_m_charge_eff
    },
    sideHysteresis: {
      active: chargeSideHystActive,
      hystW: chargeSideHystW,
      before: chargeSideBefore,
      after: chargeSideAfter,
      reason: chargeSideReason
    },
    active: {
      errGainCharge: activeErrGainCharge,
      iGainCharge: activeIGainCharge,
      iMaxWCharge: activeIMaxCharge,
      iErrMinWCharge: activeIErrMinCharge,
      iDecayHoldCharge: activeIDecayHoldCharge
    }
  },

  // --- PV-Follow-Guard 3.9
  pvFollowGuard: {
    enabled: pvFollowGuardEnabled,
    active: pvFollowGuardActive,
    limited: pvFollowGuardLimited,
    confirmed: pvFollowGuardConfirmed,
    reason: pvFollowGuardReason,
    pvClass: pvFollowIsVeryHighPV ? "veryhighpv" : (pvFollowIsHighPV ? "highpv" : "normal"),
    count: pvFollowGuardCnt,
    requiredTicks: pvFollowGuardRequiredTicks,
    unconfirmedStepW: pvFollowGuardUnconfirmedStepW,
    fallActive: pvFollowGuardFallActive,
    fallRawActive: pvFollowGuardFallRawActive,
    fallLatched: pvFollowGuardFallLatched,
    fallKeepActive: pvFollowGuardFallKeepActive,
    fallKeepCondition: pvFollowGuardFallKeepCondition,
    fallKeepChargeW: pvFollowFallKeepChargeW,
    fallLatchCnt: pvFollowFallLatchCnt,
    fallLatchTicks: pvFollowFallLatchTicks,
    fallStepApplied: pvFollowGuardFallStepApplied,
    fallKickApplied: pvFollowGuardFallKickApplied,
    fallStepDownW: pvFollowFallStepDownW,
    fallExtraReserveW: pvFollowFallExtraReserveW,
    chargeRawFallLimit: pvFollowChargeRawFallLimit,
    stepDown: {
      before: pvFollowStepDownBefore,
      after: pvFollowStepDownAfter,
      activeReason: stepDownChargeActiveReason
    },
    solar: {
      current: p_solar,
      prev: pvFollowHavePrev ? pvFollowPrevSolar : null,
      dSolar: pvFollow_dSolar,
      stableBandW: pvFollowStableBandW,
      fallAbortW: pvFollowFallAbortW
    },
    chargeRaw: {
      before: pvFollowChargeRawBefore,
      after: pvFollowChargeRawAfter,
      lastChargeW,
      riseMarginW: pvFollowRiseMarginW
    }
  },

  // --- Entlade-Parameter Debug
  dischargeParams: {
    set: dischargeParamSet,
    pvActive: activePvDischarge,
    active: {
      errGainDischarge: activeErrGainDischarge,
      iGainDischarge: activeIGainDischarge,
      iMaxWDischarge: activeIMaxDischarge,
      iErrMinWDischarge: activeIErrMinDischarge,
      iDecayHoldDischarge: activeIDecayHoldDischarge
    }
  },

  // --- Symmetrische Sollwertbasis 4.14
  controlBase: {
    source:
      controlBaseSource,

    batteryFresh:
      snapshotBatteryFresh,

    chargeBaseW:
      chargeControlBaseW,

    dischargeBaseW:
      dischargeControlBaseW,

    battChargeNowW:
      battChargeNowForControl,

    battDisNowW:
      battDisNowForControl,

    lastChargeW,

    lastDischargeW,

    monotonicGuard: {
      chargeImportActive:
        chargeImportRawGuardActive,

      chargeExportActive:
        chargeExportRawGuardActive,

      dischargeImportActive:
        dischargeImportRawGuardActive,

      dischargeImportFloorW:
        dischargeImportGuardFloorW,

      dischargeExportActive:
        dischargeExportRawGuardActive
    }
  },

  // --- Entlade-Tracking-Guard 4.11
  dischargeTrackingGuard: {
    active:
      dischargeTrackingHoldActive,

    exportGuardActive:
      dischargeExportRawGuardActive,

    batteryUnderTracking:
      dischargeBatteryUnderTracking,

    battDisNowW:
      loadStepBattDisNow,

    lastDischargeW,

    trackingDeltaW:
      dischargeTrackingDeltaW,

    trackingToleranceW:
      dischargeFastBattTrackingToleranceW,

    demandW:
      dischargeTrackingDemandW,

    rawFromBatteryW:
      dischargeRawFromBatteryW,

    rawFromLastW:
      dischargeRawFromLastW,

    finalRawW:
      dischargeRaw,

    importOutsideWindow:
      p_zaehler >
      p_o_max_discharge_eff,

    exportBeyondTarget:
      p_zaehler <
      p_target
  },

  // --- Snapshot-Cycle-Handshake 4.9
  snapshotCycle: {
    regulatorCycleId,
    regulatorCycleShort:
      regulatorCycleId.slice(-6),

    snapshotLastOkCycleId,
    snapshotLastOkCycleShort:
      snapshotLastOkCycleId.slice(-6),

    cycleMatch:
      snapshotCycleMatch,

    lastOkTs:
      snapshotLastOkTs,

    ageMs:
      snapshotAgeMs,

    maxAgeMs:
      snapshotMaxAgeForControlMs,

    ageOk:
      snapshotAgeOk,

    freshForControl:
      snapshotFreshForControl
  },

  // --- Batterie-Messwertqualität 4.9
  batteryMeasurement: {
    source:
      snapshotBatterySource,

    fresh:
      snapshotBatteryFresh,

    held:
      snapshotBatterySource === "held",

    holdAgeMs:
      snapshotBatteryHoldAgeMs,

    previousFresh:
      loadStepPrevBatteryFresh,

    deltaValid:
      loadStepBatteryDeltaValid
  },

  // --- Richtungs-Schutz Debug 2.1
  directionDecision: {
    rawOutputDir: desiredDirRaw,
    storedDir: dirLogic_richtung,
    pendingDir: dirLogic_pendingDir,
    pendingCnt: dirLogic_pendingCnt,
    pendingRequiredN: dirLogic_pendingDir ? dirLogicRequiredConfirmN(dirLogic_richtung, dirLogic_pendingDir) : 0,
    desiredBeforeConfirm: dirLogic_desired,
    reason: dirLogic_reason,
    thresholds: {
      th_toDischarge: dirLogic_th_toDischarge,
      th_toCharge: dirLogic_th_toCharge,
      solar_min,
      exportBlockW,
      p_o_max_charge_eff,
      p_o_b_out_discharge_eff,
      p_o_max_discharge_eff,
      lowPvDischargeActive: dirLogic_lowPvDischargeActive,
      activeMarginDischargeW,
      margin_dischargeW,
      margin_dischargeLowPVW,
      activeConfirmToDischargeN,
      confirm_toDischargeN,
      confirm_toDischargeLowPVN
    },
    checks: {
      pvOk: dirLogic_pvOk,
      exportBlock: dirLogic_exportBlock
    }
  },

  // --- Charge-First Direction Block 3.9a
  chargeFirstDirectionBlock: {
    active: chargeFirstDirBlockToDischarge,
    battChargeNow: chargeFirstDirBattChargeNow,
    zNoCharge: chargeFirstDirZNoCharge,
    importMarginW: loadStepChargeFirstImportMarginW,
    desiredDirRawAfterBlock: desiredDirRaw,
    afActiveDir: af_activeDir,
    afPendingDir: af_pendingDir,
    latchToDischargeAfterBlock: loadStepLatchToDischarge
  },

  // --- Richtungs-Schutz Debug 2.1
  directionGuard: {
    rawDesiredDir: desiredDirRaw,
    guardedDesiredDir: desiredDir,
    active: dirGuardActive,
    blocked: dirGuardBlocked,
    exportThreshold: dirGuard_exportThreshold,
    exportOk: dirGuard_exportOk,
    surplusOk: dirGuard_surplusOk,
    battOk: dirGuard_battOk,
    battDisNow: battDisNowMeas
  },

  // --- Lastsprungerkennung 3.5
  loadStepDetection: {
    enabled: loadStepDetectionEnabled,
    candidateRawToDischarge: loadStepCandidateRawToDischarge,
    candidateToDischarge: loadStepCandidateToDischarge,
    confirmedToDischarge: loadStepToDischargeConfirmed,
    directionLatchConsumed:
      loadStepDirectionLatchConsumed,
    chargeFirst: {
      blocked: loadStepChargeFirstBlocked,
      hardBlocked: loadStepChargeFirstHardBlocked,
      marginBlocked: loadStepChargeFirstMarginBlocked,
      battChargeNow: loadStepBattChargeNow,
      zNoCharge: loadStepZNoCharge,
      importMarginW: loadStepChargeFirstImportMarginW
    },
    dischargeKick: {
      active: loadStepKickActive,

      factor: loadStepKickFactor,
      reserveW: loadStepKickReserveW,

      baseZNoChargeW: loadStepKickBaseW,
      battDisNowW: loadStepBattDisNow,
      addW: loadStepKickAddW,

      targetW: loadStepKickTargetW,
      adaptiveTargetW:
        loadStepKickAdaptiveTargetW,
      latchedTargetW:
        loadStepKickLatchedTargetW,

      holdCnt: loadStepKickHoldCnt,
      holdTicks: loadStepKickHoldTicks,
      abortExportW:
        loadStepKickAbortExportW,

      beforeDischargeRaw:
        loadStepKickBeforeDischargeRaw,
      afterDischargeRaw:
        loadStepKickAfterDischargeRaw,

      rampActive:
        loadStepDischargeRampActive,
      stepUpNormalW:
        stepUpDischargeW,
      stepUpActiveW:
        stepUpDischargeActiveW,
      stepUpLoadStepW:
        stepUpDischargeLoadStepW
    },
    countToDischarge: loadStepCntToDischarge,
    confirmTicks: loadStepConfirmTicks,
    latchToDischarge: loadStepLatchToDischarge,
    latchTicks: loadStepLatchTicks,
    thresholds: {
      loadStepToDischargeW,
      solarStableW: loadStepSolarStableW,
      battStableW: loadStepBattStableW,
      sollStableW: loadStepSollStableW,
      importMinW: loadStepImportMinW,
      chargeFirstImportMarginW: loadStepChargeFirstImportMarginW,
      loadStepKickFactor,
      loadStepKickReserveW
    },
    delta: {
      dZ: loadStep_dZ,
      dSolar: loadStep_dSolar,
      dBatt: loadStep_dBatt,
      dSoll: loadStep_dSoll,
      dLoadEst: loadStep_dLoadEst
    },
    checks: {
      havePrev: loadStepHavePrev,
      haveSollPrev: loadStepHaveSollPrev,
      batteryCurrentFresh:
        snapshotBatteryFresh,

      batteryPreviousFresh:
        loadStepPrevBatteryFresh,

      batteryDeltaValid:
        loadStepBatteryDeltaValid,

      solarCompatible:
        loadStepSolarCompatible,

      solarFallW:
        loadStepSolarFallW,

      currentDir: loadStepCurrentDir,

      b_entladen,

      batt_min_raw,
      batt_min,

      batt_min_pending:
        battMinPending,

      batt_min_raw_duration_ms:
        battMinRawDurationMs,

      batt_max,

      importOk:
        p_zaehler > (p_o_max_discharge_eff + loadStepImportMinW),

      // ---------- Dynamischer Entlade-Step-down 4.9
      dischargeStepDown: {
        normalW:
          stepDownDischargeNormalW,
        fastW:
          stepDownDischargeFastW,
        activeW:
          stepDownDischargeActiveW,

        fastActive:
          dischargeFastStepDownActive,

        byExport:
          dischargeFastStepDownByExport,
        byLoadDrop:
          dischargeFastStepDownByLoadDrop,

        exportCandidate:
          dischargeFastExportCandidate,
        exportConfirmCnt:
          dischargeFastExportCnt,
        exportConfirmTicks:
          dischargeFastExportConfirmTicks,

        exportThresholdW:
          dischargeFastStepDownExportW,
        loadDropThresholdW:
          dischargeFastStepDownLoadDropW,

        battDisNowW:
          battDisNowForStepDown,
        battTrackingErrorW:
          dischargeBattTrackingErrorW,
        battTrackingToleranceW:
          dischargeFastBattTrackingToleranceW,
        battSettled:
          dischargeBattSettled,

        dLoadEst:
          loadStep_dLoadEst,
        p_zaehler
      }
    }
  },

  // --- AntiFlip Debug
  antiflip: {
    enabled: antiFlipEnabled,
    confirmN_toDischarge: antiFlip_confirmN_toDischarge,
    confirmN_toDischargeLowPV: antiFlip_confirmN_toDischargeLowPV,
    confirmN_toDischargeActive:
      (p_solar < pvLowThreshold)
        ? antiFlip_confirmN_toDischargeLowPV
        : antiFlip_confirmN_toDischarge,
    confirmN_toCharge: antiFlip_confirmN_toCharge,
    minHoldMs: antiFlip_minHoldMs,
    desiredDirRaw,
    desiredDir,
    effectiveDir: effectiveRichtung,
    activeDir: af_activeDir,
    pendingDir: af_pendingDir,
    count: af_count,
    requiredConfirmN:
      (desiredDir === 2)
        ? ((p_solar < pvLowThreshold) ? antiFlip_confirmN_toDischargeLowPV : antiFlip_confirmN_toDischarge)
        : (desiredDir === 1)
          ? antiFlip_confirmN_toCharge
          : ((p_solar < pvLowThreshold) ? antiFlip_confirmN_toDischargeLowPV : antiFlip_confirmN_toDischarge),
    lastSwitchTs: af_lastSwitchTs,
    switchedThisTick: af_switched,
    blockedByMinHold: af_blockedByHold
  }
};

let fill = "grey";
let shape = "ring";
if (netz_laden) { fill = "blue"; shape = "dot"; }
else if (!regelung) { fill = "grey"; shape = "ring"; }
else if (mode === "REGEL_LADEN") { fill = "green"; shape = hold ? "ring" : "dot"; }
else if (mode === "REGEL_ENTLADEN") { fill = "yellow"; shape = hold ? "ring" : "dot"; }

node.status({
  fill,
  shape,
  text:
    `${mode}${hold ? " HOLD" : ""}` +
    ` Z=${fmtW(p_zaehler)}W` +
    ` PV=${fmtW(p_solar)}W` +
    ` H=${fmtW(p_haus)}W` +
    ` B=${fmtW(p_batterie)}W` +
    ` | C=${fmtW(chargeW)} D=${fmtW(dischargeW)}` +
    ` | RU=${mode === "REGEL_LADEN" || mode === "NETZ_LADEN" ? stepUpChargeW : (mode === "REGEL_ENTLADEN" ? stepUpDischargeActiveW : 0)}` +
    ` RDn=${mode === "REGEL_LADEN" || mode === "NETZ_LADEN" ? stepDownChargeActiveW : (mode === "REGEL_ENTLADEN" ? stepDownDischargeActiveW : 0)}` +
    `${mode === "REGEL_LADEN" || mode === "NETZ_LADEN" ? " RClass=" + stepDownChargeActiveReason : ""}` +
    ` | AC=${batteryAcModeOut === null ? "-" : batteryAcModeOut}` +
    ` | BattAC=${batt_acMode}(${acModeTxt(batt_acMode)})` +
    ` PS=${batt_packState}(${packStateTxt(batt_packState)})` +
    ` | I=${fmtW(iEff)}` +
    ` | HC=${holdEntryCountCharge}/${holdConfirmTicks}` +
    ` | HD=${holdEntryCountDischarge}/${holdConfirmTicks}` +
    ` | WOff=${fmtW(pvWindowOffsetW)}` +
    ` | LF=[${fmtW(p_o_s_in_charge_eff)}..${fmtW(p_o_max_charge_eff)}]` +
    ` | T=${fmtW(p_target)}` +
    ` | CS=${activeControlSet}` +
    `${chargeSideHystActive ? " HY" + chargeSideHystW : ""}` +
    `${pvFollowGuardActive ? " PF" + pvFollowGuardCnt + "/" + pvFollowGuardRequiredTicks : ""}` +
    `${pvFollowGuardLimited ? " PFLIM" : ""}` +
    `${pvFollowGuardFallStepApplied ? " PFDOWN" : ""}` +
    `${pvFollowGuardFallKickApplied ? " PFKICK" : ""}` +
    `${pvFollowGuardFallLatched ? " PFLATCH" + pvFollowFallLatchCnt : ""}` +
    `${chargeFirstDirBlockToDischarge ? " CFDIR" : ""}` +
    `${loadStepKickActive ? " LSKICK" : ""}` +
    `${loadStepDischargeRampActive ? " LSRAMP" : ""}` +
    ` | CP=${chargeParamSet}` +
    `${activePvLowCharge ? " LPV" : ""}` +
    `${activePvHighCharge ? " HPV" : ""}` +
    `${activePvVeryHighCharge ? " VHPV" : ""}` +
    `${activeImportPvHighCharge ? " IHPV" : ""}` +
    `${activeImportPvVeryHighCharge ? " IVHPV" : ""}` +
    ` | DP=${dischargeParamSet}` +
    `${activePvDischarge ? " DPV" : ""}` +
    ` | RD=${desiredDirRaw}` +
    `${dirLogic_pendingDir ? " rp" + dirLogic_pendingDir + ":" + dirLogic_pendingCnt : ""}` +
    ` | dir ${desiredDirRaw}->${desiredDir}->${effectiveRichtung}` +
    `${dirGuardBlocked ? " DG" : ""}` +
    `${af_pendingDir ? " p" + af_pendingDir + ":" + af_count : ""}` +
    `${loadStepToDischargeConfirmed ? " LS!" : (loadStepCntToDischarge ? " ls" + loadStepCntToDischarge : "")}` +
    `${af_blockedByHold ? " WAIT" : ""}`
});

// =========================================================
// LASTSPRUNGERKENNUNG 3.5 Historie speichern
// Messwerte für Δ-Bildung im nächsten Tick.
// Sollwert-Historie zweistufig, damit im nächsten Tick erkennbar ist,
// ob der Regler im vorherigen Tick den Sollwert stark geändert hat.
const loadStepOldPrevSollSigned = Number(flow.get("loadStep_prev_sollSigned"));
const loadStepNewSollSigned = chargeW - dischargeW;

flow.set("loadStep_prev_p_zaehler", p_zaehler);
flow.set("loadStep_prev_p_solar", p_solar);
flow.set("loadStep_prev_p_batterie", p_batterie);
flow.set(
  "loadStep_prev_battery_fresh",
  snapshotBatteryFresh
);

flow.set(
  "loadStep_prev2_sollSigned",
  Number.isFinite(loadStepOldPrevSollSigned) ? loadStepOldPrevSollSigned : loadStepNewSollSigned
);
flow.set("loadStep_prev_sollSigned", loadStepNewSollSigned);

// PV-FOLLOW-GUARD 3.6 Historie speichern
flow.set("pvFollow_prev_p_solar", p_solar);

// =========================================================
// Outputs
// [0] Gewünschte Batterie-Richtung für "AC-Mode Soll / Ist":
//     1 = Laden, 2 = Entladen
//     OFF: null, damit kein ungültiger acMode=0 weitergegeben wird.
// [1] Laden(W)
// [2] Entladen(W)
// [3] Status(obj)
return [
  batteryAcModeSendNow
    ? {
      payload:
        batteryAcModeOut,

      topic:
        "battery_acMode",

      source:
        "PI-Regler-4.19-SIM",

      reason:
        "desired_direction_tick",

      cycleId:
        regulatorCycleId,

      ts:
        Date.now()
    }
    : null,

  { payload: chargeW },
  { payload: dischargeW },
  { payload: status }
];
