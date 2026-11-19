// Eingang: msg.payload von Ausgang 3 der V6-Wirkungsgradberechnung.
const bilanz = msg.payload;
const jetzt = Date.now();
const gueltig = bilanz?.type === "efficiency_sources_v6"
    && bilanz.valid === true
    && Number.isFinite(bilanz.at)
    && bilanz.at <= jetzt
    && jetzt - bilanz.at <= 6500
    && Number.isFinite(bilanz.solar_available_kwh);

// solar_available_kwh enthält bereits den Abzug der Reserve.
const bisherAktiv = flow.get("b_entladen_solar") === true;
const solarFreigabe = gueltig && (bisherAktiv
    ? bilanz.solar_available_kwh > 0
    : bilanz.solar_available_kwh >= 0.0864);

flow.set("b_entladen_solar", solarFreigabe);
msg.payload = solarFreigabe;
return msg;
