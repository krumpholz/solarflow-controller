"""Erzeugt die deutsche Oberfläche aus dem unveränderten englischen Rechenkern."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
TEXT = {
    "missing_or_expired_cycle": "Messzyklus fehlt oder ist abgelaufen",
    "inconsistent_cycle_snapshot": "Widersprüchliche SOC-Daten im Messzyklus",
    "unexpected_entity": "Unbekannte oder falsche Entität",
    "invalid_energy_value": "Ungültiger Energiewert",
    "energy_unit_must_be_kWh": "Energieeinheit muss kWh sein",
    "invalid_counter_reset_timestamp": "Ungültiger Zeitstempel der Zählerrücksetzung",
    "daily_counter_not_reset_for_today": "Tageszähler noch nicht für heute zurückgesetzt",
    "incomplete_previous_cycle": "Vorheriger Messzyklus unvollständig",
    "invalid_soc": "Ladezustand fehlt oder ist ungültig",
    "soc_timestamp_required": "Zeitstempel des Ladezustands erforderlich",
    "stale_or_future_soc": "SOC-Zeitstempel veraltet oder in der Zukunft",
    "invalid_capacity": "Ungültige Batteriekapazität",
    "invalid_persisted_state_requires_review": "Gespeicherter Zustand ungültig – bitte prüfen",
    "baseline_initialized": "Ausgangspunkt für neue Messintervalle gesetzt",
    "configuration_changed_new_baseline": "Konfiguration geändert – neuer Ausgangspunkt",
    "non_increasing_sample_time": "Messzeitpunkt liegt nicht nach der letzten Messung",
    "legacy_history_imported_new_baseline": "Vorhandene Historie übernommen – neuer Messausgangspunkt",
    "waiting_for_daily_counter_resets": "Warte auf Rücksetzung beider Tageszähler",
    "new_day_boundary_excluded": "Tageswechselintervall ausgeschlossen",
    "measurement_gap_excluded": "Messlücke ausgeschlossen",
    "counter_reset_interval_excluded": "Intervall mit Zählerrücksetzung ausgeschlossen",
    "counter_jump_interval_excluded": "Intervall mit Zählersprung ausgeschlossen",
    "soc_jump_rejected": "Unplausibler SOC-Sprung verworfen",
    "confirmed_soc_jump_interval_excluded": "Bestätigter SOC-Sprung – Intervall ausgeschlossen",
    "interval_accepted": "Messintervall übernommen",
    "legacy_soc_boundaries_missing": "SOC-Grenzen der übernommenen Historie fehlen",
    "insufficient_charge_energy": "Ladeenergie für Berechnung noch zu gering",
    "efficiency_out_of_range": "Wirkungsgrad außerhalb des gültigen Bereichs",
    "estimate_available": "Wirkungsgradschätzung verfügbar",
    "legacy_estimate_available": "Schätzung mit übernommener Historie – historische Genauigkeit ungeprüft",
    "context_or_runtime_error": "Kontext- oder Ausführungsfehler",
    "measurement_timeout": "Zeitüberschreitung bei der Messung",
    "context_configuration_error": "Fehler in der Kontextkonfiguration",
    "imported": "Übernommen",
    "no_legacy_data": "Keine bisherigen Pufferdaten vorhanden",
    "skipped_configuration_change": "Wegen Konfigurationsänderung nicht erneut übernommen",
    "No completed measurement cycle": "Kein abgeschlossener Messzyklus",
    "Requesting paired daily counters": "Zusammengehörige Tageszähler werden abgefragt",
    "Legacy migration: invalid calendar date; original data retained": "Pufferübernahme: ungültiges Datum; Originaldaten bleiben erhalten",
    "Legacy migration: future date; check the runtime timezone/clock": "Pufferübernahme: Datum liegt in der Zukunft; Zeitzone und Uhrzeit prüfen",
    "Legacy migration: invalid energy value; original data retained": "Pufferübernahme: ungültiger Energiewert; Originaldaten bleiben erhalten",
    "Legacy migration requires the original version-2 seven-slot kWh ring": "Pufferübernahme benötigt den ursprünglichen kWh-Ring der Version 2 mit sieben Speicherplätzen",
}

HEADER = """/*
 * Batterie-Wirkungsgrad – deutsche Alternative mit identischer Berechnung.
 * Automatisch erzeugt mit build-german-flow.py; Änderungen am Rechenkern
 * gehören in die englischen Quelldateien, danach beide Fassungen erzeugen.
 * MIT-Lizenz. Unabhängiges Projekt; siehe ../NOTICE_DE.md.
 * Anleitung und Pufferübernahme: README_DE.md.
 *
 * Vorbereitung: SOC einmal aufnehmen und beide Tageszähler gemeinsam abfragen.
 * Berechnung: Nur zusammengehörige Energie- und SOC-Intervalle einbeziehen.
 * Vorhandenen v2-Puffer einmal übernehmen, sichern und nicht doppelt zählen.
 * Summen und Messausgangspunkt gemeinsam im Dateispeicher ablegen.
 * Ungültige Eingaben und unklare Intervalle nicht als Energie verbuchen.
 * null am Sensorausgang bedeutet Unbekannt, nicht null Prozent Wirkungsgrad.
 * Kapazität 8.640 kWh und maximale Leistung 2.4 kW an die Anlage anpassen.
 * requireSocTimestamp nach Ergänzen von batt_level_ts auf true setzen.
 * Technische Schlüssel bleiben für bestehende Auswertungen unverändert.
 * Deutsche Diagnosefelder: grund, intervallstatus und pufferuebernahme.
 */
"""

def without_comments(source):
    # These two controlled source files have no // inside executable strings.
    # Refuse unsupported changes rather than silently changing string values.
    source = re.sub(r'/\*.*?\*/', '', source, flags=re.S)
    lines = []
    for line in source.splitlines():
        if '//' in line:
            code, comment = line.split('//', 1)
            if code.count('"') % 2 or code.count("'") % 2 or code.count('`') % 2:
                raise ValueError('Kommentarposition nicht eindeutig: ' + line)
            line = code.rstrip()
        lines.append(line)
    return '\n'.join(lines).strip() + '\n'

def localize(source):
    translations = json.dumps(TEXT, ensure_ascii=False, indent=4)
    return HEADER + 'const DE_TEXTE = ' + translations + ';\n' + r'''
function deutsch(text) {
    if (typeof text !== "string") return text;
    if (DE_TEXTE[text]) return DE_TEXTE[text];
    for (const [en, de] of [
        ["Efficiency calculation stopped: ", "Wirkungsgradberechnung angehalten: "],
        ["Context configuration error: ", "Fehler in der Kontextkonfiguration: "]
    ]) {
        if (text.startsWith(en)) return de + deutsch(text.slice(en.length));
    }
    return text.replace("% estimate |", "% geschätzt |")
        .replace(/(\d+)d \|/, "$1 Tage |")
        .replace(/([\d.]+)h$/, "$1 Std.");
}
// Nur die Anzeige übersetzen; Speicherwerte und Berechnungen unverändert lassen.
const knotenDeutsch = {
    status: status => node.status({...status, text: deutsch(status.text)}),
    error: (...args) => node.error(deutsch(args[0]), ...args.slice(1))
};
const ausgabe = (function(msg, node) {
''' + without_comments(source) + r'''
})(msg, knotenDeutsch);
// Bestehende maschinenlesbare Diagnosefelder erhalten; deutsche Texte ergänzen.
if (Array.isArray(ausgabe)) {
    for (const nachricht of ausgabe) {
        if (!nachricht || !nachricht.result) continue;
        const r = nachricht.result;
        r.grund = deutsch(r.reason);
        if (r.interval_status) r.intervallstatus = deutsch(r.interval_status);
        if (r.legacy_migration) r.pufferuebernahme = deutsch(r.legacy_migration.status);
        if (r.detail) r.detail = deutsch(r.detail);
    }
}
return ausgabe;
'''

def build():
    calculation = localize((ROOT / 'battery-efficiency.js').read_text())
    prepare = localize((ROOT / 'prepare-cycle.js').read_text())
    (ROOT / 'battery-efficiency_DE.js').write_text(calculation)
    (ROOT / 'prepare-cycle_DE.js').write_text(prepare)
    nodes = json.loads((ROOT / 'flow.json').read_text())
    names = {
        '2aa6785d888b744e': 'Batterie Lade Energie Täglich',
        'f95f0118d1ac8e2e': 'Batterie Entlade Energie Täglich',
        'e46be25028e13f5d': 'Batterie Wirkungsgrad',
        '0e16d9dcd078a8e9': 'Lade Entlade Effizenz',
        'bb523511b4c4476f': 'S Lade Entlade Effizenz',
        'efftrigger000003': 'Messung alle 5 Sekunden',
        'effprepare000003': 'SOC erfassen und Messzyklus starten',
        'effdiagnostics03': 'Wirkungsgrad Diagnose',
        'effinstructions3': 'Anleitung lesen: gleicher Flow-Tab wie batt_level; Kapazität und Kontextspeicher prüfen'
    }
    for n in nodes:
        if n['id'] in names: n['name'] = names[n['id']]
        if n['id'] == 'e46be25028e13f5d':
            n.update(func=calculation, outputLabels=['Wirkungsgrad / HA-Sensor', 'Diagnose'])
        if n['id'] == 'effprepare000003':
            n.update(func=prepare, outputLabels=['Energiezähler abfragen', 'Fehlende Messung / Diagnose'])
        if n['type'] == 'server': n['statusSeparator'] = 'am:'
        if n['type'] == 'ha-entity-config':
            for row in n['haConfig']:
                if row['property'] == 'name': row['value'] = 'Lade Entlade Effizenz'
        if n['type'] == 'ha-sensor':
            n['attributes'].append({'property':'diagnose', 'value':'result.grund', 'valueType':'msg'})
        if n['type'] == 'comment':
            n['info'] = ('Deutsche Alternative: nur diese ODER die englische Version betreiben. '
                'Auf denselben Flow-Tab wie flow.batt_level importieren. Vorhandene Kontextspeicher '
                'memoryOnly und file mit Cache verwenden. Home-Assistant-Server auswählen. '
                'Die bisherige SOC-Erfassung liegt außerhalb dieses Exports. batt_level_ts nur '
                'beim Eingang einer echten SOC-Messung aktualisieren. Alte Berechnung vor dem '
                'Aktivieren abschalten. Für die Pufferübernahme vorher möglichst nicht neu starten. '
                'Vollständige Einbau- und Migrationsanleitung: round-trip-efficiency/README_DE.md.')
    (ROOT / 'flow_DE.json').write_text(json.dumps(nodes, indent=2, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    build()
