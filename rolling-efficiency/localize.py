"""Erzeugt die deutsche Oberfläche aus dem unveränderten englischen Rechenkern."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
TEXT = {
    "invalid_soc": "Ladezustand fehlt oder ist ungültig",
    "soc_timestamp_required": "Zeitstempel des Ladezustands erforderlich",
    "stale_or_future_soc": "SOC-Zeitstempel veraltet oder in der Zukunft",
    "baseline_initialized": "Ausgangspunkt für neue Messintervalle gesetzt",
    "measurement_gap_excluded": "Messlücke ausgeschlossen",
    "interval_accepted": "Messintervall übernommen",
    "legacy_soc_boundaries_missing": "SOC-Grenzen der übernommenen Historie fehlen",
    "insufficient_charge_energy": "Ladeenergie für Berechnung noch zu gering",
    "efficiency_out_of_range": "Wirkungsgrad außerhalb des gültigen Bereichs",
    "context_or_runtime_error": "Kontext- oder Ausführungsfehler",
    "measurement_timeout": "Zeitüberschreitung bei der Messung",
    "context_configuration_error": "Fehler in der Kontextkonfiguration",
    "imported": "Übernommen",
    "No completed measurement cycle": "Kein abgeschlossener Messzyklus"
}

HEADER = ""

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
    return text.replace(/(\d+)d \|/, "$1 Tage |")
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
