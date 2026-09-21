const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'battery-efficiency.js'), 'utf8');
function legacy(h, slots) {
    h.stores.file.batt_eff_ring_7d = {version: 2, unit: 'kWh', size: 7, head: slots.length - 1,
        slots: slots.concat(Array.from({length: 7-slots.length}, () => ({date:null, chargeKWh:0, dischargeKWh:0, socStart:null, socEnd:null})))};
}
const oldDay = (date, c=5, d=4, start=50, end=50) => ({date, chargeKWh:c, dischargeKWh:d, socStart:start, socEnd:end});
function harness(options = {}) {
    let time = new Date(2026, 8, 20, 12).getTime();
    const stores = {file: {}, memoryOnly: {}};
    let ctx = {};
    const errors = [];
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [time])); }
        static now() { return time; }
    }
    const flow = {get(k, s) { if (!stores[s]) throw Error('Missing store'); return stores[s][k]; },
        set(k, v, s) { if (!stores[s]) throw Error('Missing store'); stores[s][k] = v; }};
    const context = {get: k => ctx[k], set: (k, v) => ctx[k] = v};
    const sandbox = vm.createContext({Date: Clock, Intl, flow, context,
        node: {status() {}, error: e => errors.push(e)}});
    const fn = new vm.Script('(function(msg) {' + (options.source || source) + '\n})').runInContext(sandbox);
    let seq = 0;
    function resetStamp() { return new Clock(new Clock().getFullYear(), new Clock().getMonth(), new Clock().getDate()).toISOString(); }
    function messages(charge, discharge, soc = 50, attrs = {}) {
        const cycle = {id: String(++seq), ts: time, soc, socTs: time};
        return [charge, discharge].map((v, i) => ({_eff: {...cycle}, payload: v,
            data: {entity_id: i ? 'sensor.batterie_entlade_energie_pro_tag' : 'sensor.batterie_lade_energie_pro_tag',
                state: v, attributes: {unit_of_measurement: 'kWh', last_reset: resetStamp(), ...attrs}}}));
    }
    return {stores, errors, flow, context, sandbox, fn, messages,
        advance: ms => time += ms, setTime: t => time = t,
        time: () => time,
        restart() { ctx = {}; stores.memoryOnly = {}; stores.file = JSON.parse(JSON.stringify(stores.file)); },
        pair(c, d, s = 50, attrs) { const m = messages(c, d, s, attrs); fn(m[0]); return fn(m[1]); }};
}
function seed(h) { h.pair(5, 4); }
function grow(h) {
    let out;
    for (let i = 1; i <= 3; i++) { h.advance(60000); out = h.pair(5 + i * .04, 4 + i * .032); }
    return out;
}
test('partial-day baseline excludes earlier energy; 80% known balance', () => {
    const h = harness(); const first = h.pair(5, 4);
    assert.equal(first[0].payload, null);
    assert.equal(first[0].result.sum_charge_kwh_7d, 0);
    const out = grow(h)[0]; assert.equal(out.payload, 80);
    assert.equal(out.result.sum_charge_kwh_7d, .12);
    assert.equal(out.result.covered_hours, .05);
});
test('pairs may arrive in reverse order and publish only once', () => {
    const h = harness(); const m = h.messages(5, 4);
    assert.equal(h.fn(m[1]), null); assert.notEqual(h.fn(m[0]), null);
    assert.equal(h.fn(m[0]), null);
});
test('invalid energy does not overwrite stored totals', () => {
    for (const value of ['unavailable', 'unknown', '', ' ', null, undefined, true, [], {}, NaN, Infinity, -1, '0x20']) {
        const h = harness(); seed(h); grow(h); const before = JSON.stringify(h.stores.file.batt_eff_state_v3);
        h.advance(5000); const m = h.messages(value, 4.1);
        assert.equal(h.fn(m[0])[0].payload, null);
        assert.equal(JSON.stringify(h.stores.file.batt_eff_state_v3), before);
    }
});
test('original HA state takes precedence over coerced numeric payload', () => {
    const h = harness(); const m = h.messages(0, 0); m[0].data.original_state = 'unavailable';
    assert.equal(h.fn(m[0])[0].result.reason, 'invalid_energy_value');
});
test('numeric strings accepted, units enforced', () => {
    const h = harness(); assert.equal(h.pair('5.0', '4.0')[0].result.interval_status, 'baseline_initialized');
    h.advance(5000); const m = h.messages(5, 4, 50, {unit_of_measurement: 'Wh'});
    assert.equal(h.fn(m[0])[0].result.reason, 'energy_unit_must_be_kWh');
});
test('null, blank, boolean and out-of-range SOC are rejected', () => {
    for (const soc of [null, undefined, '', true, -1, 101, Infinity]) {
        const h = harness(); const m = h.messages(5, 4); m.forEach(x => x._eff.soc = soc);
        h.fn(m[0]); assert.equal(h.fn(m[1])[0].result.reason, 'invalid_soc');
    }
});
test('SOC operating limits do not invalidate physically valid SOC', () => {
    const h = harness(); h.stores.memoryOnly.batt_min_s = 70;
    assert.equal(h.pair(5, 4, 20)[0].result.interval_status, 'baseline_initialized');
});
test('stale and future SOC timestamps rejected; missing timestamp explicit', () => {
    for (const shift of [-15001, 1]) {
        const h = harness(), m = h.messages(5, 4); m.forEach(x => x._eff.socTs += shift);
        h.fn(m[0]); assert.equal(h.fn(m[1])[0].result.reason, 'stale_or_future_soc');
    }
    const h = harness(), m = h.messages(5, 4); m.forEach(x => x._eff.socTs = null);
    h.fn(m[0]); assert.equal(h.fn(m[1])[0].result.soc_freshness_verified, false);
});
test('strict SOC timestamp mode rejects missing timestamp', () => {
    const h = harness({source: source.replace('requireSocTimestamp: false', 'requireSocTimestamp: true')});
    const m = h.messages(5, 4); m.forEach(x => x._eff.socTs = null);
    h.fn(m[0]); assert.equal(h.fn(m[1])[0].result.reason, 'soc_timestamp_required');
});
test('SOC spike never enters the energy balance; confirmed jump rebases', () => {
    const h = harness(); seed(h);
    for (let i = 1; i <= 3; i++) {
        h.advance(5000); const out = h.pair(5, 4, 60)[0];
        assert.equal(out.payload, null);
        assert.equal(out.result.reason, i < 3 ? 'soc_jump_rejected' : 'confirmed_soc_jump_interval_excluded');
    }
    assert.equal(h.stores.file.batt_eff_state_v3.days[0].delta, 0);
    assert.equal(h.stores.file.batt_eff_state_v3.last.soc, 60);
});
test('isolated SOC spike recovers using the last accepted endpoint', () => {
    const h = harness(); seed(h); h.advance(5000); h.pair(5, 4, 60);
    h.advance(5000); const out = h.pair(5.002, 4.001, 50)[0];
    assert.equal(out.result.delta_stored_energy_kwh, 0);
    assert.equal(out.result.sum_charge_kwh_7d, .002);
});
test('same-day restart continues a matching persisted energy/SOC baseline', () => {
    const h = harness(); seed(h); grow(h); const before = h.stores.file.batt_eff_state_v3.days[0].charge;
    h.restart(); h.advance(60000); const out = h.pair(5.16, 4.128)[0];
    assert.equal(out.payload, 80); assert.equal(out.result.sum_charge_kwh_7d, .16);
    assert.ok(h.stores.file.batt_eff_state_v3.days[0].charge > before);
});
test('crash rollback to flushed same-day state does not double-count', () => {
    const h = harness(); seed(h); grow(h);
    const flushed = JSON.parse(JSON.stringify(h.stores.file));
    h.advance(30000); h.pair(5.14, 4.112);
    h.stores.file = flushed; h.restart(); h.advance(30000);
    assert.equal(h.pair(5.16, 4.128)[0].result.sum_charge_kwh_7d, .16);
});
test('long downtime excludes both missing energy and matching SOC change', () => {
    const h = harness(); seed(h); grow(h); h.advance(3600000);
    const out = h.pair(6, 4.5, 70)[0];
    assert.equal(out.payload, null); assert.equal(out.result.reason, 'measurement_gap_excluded');
    assert.equal(out.result.sum_charge_kwh_7d, .12); assert.equal(out.result.delta_stored_energy_kwh, 0);
});
test('daily rollover and cross-day restart preserve measured history', () => {
    const h = harness(); seed(h); grow(h); h.restart();
    h.setTime(new Date(2026, 8, 21, 0, 0, 5).getTime());
    const out = h.pair(.001, 0, 60)[0];
    assert.equal(out.result.reason, 'new_day_boundary_excluded');
    assert.equal(out.result.sum_charge_kwh_7d, .12); assert.equal(out.result.delta_stored_energy_kwh, 0);
    h.advance(60000); const next = h.pair(.041, .032, 60)[0]; assert.equal(next.payload, 80);
});
test('daily reset metadata must belong to the current local day', () => {
    const h = harness(); const m = h.messages(5, 4, 50, {last_reset: new Date(2026, 8, 19).toISOString()});
    assert.equal(h.fn(m[0])[0].result.reason, 'daily_counter_not_reset_for_today');
});
test('without reset metadata both counters must show rollover evidence', () => {
    const h = harness(); h.pair(5, 4, 50, {last_reset: null});
    h.setTime(new Date(2026, 8, 21, 0, 0, 5).getTime());
    assert.equal(h.pair(5, 0, 50, {last_reset: null})[0].result.reason, 'waiting_for_daily_counter_resets');
    h.advance(5000); assert.equal(h.pair(0, 0, 50, {last_reset: null})[0].result.reason, 'new_day_boundary_excluded');
});
test('intra-day reset and impossible counter jump are excluded', () => {
    const h = harness(); seed(h); grow(h); h.advance(5000);
    assert.equal(h.pair(0, 0)[0].result.reason, 'counter_reset_interval_excluded');
    h.advance(5000); const out = h.pair(100, 100)[0];
    assert.equal(out.result.reason, 'counter_jump_interval_excluded');
    assert.equal(out.result.sum_charge_kwh_7d, .12);
});
test('zero throughput is unknown, not zero percent', () => {
    const h = harness(); h.pair(0, 0); h.advance(60000); const out = h.pair(0, 0)[0];
    assert.equal(out.payload, null); assert.equal(out.result.eta_raw_pct, null);
});
test('out-of-range efficiency is visible in diagnostics and never clamped', () => {
    const h = harness(); seed(h); grow(h); h.advance(60000);
    const out = h.pair(5.16, 4.128, 52)[0];
    assert.equal(out.payload, null); assert.ok(out.result.eta_raw_pct > 100);
    assert.equal(out.result.reason, 'efficiency_out_of_range');
});
test('SOC correction uses aligned endpoints without median lag', () => {
    const h = harness(); seed(h); grow(h); h.advance(60000);
    const out = h.pair(5.18, 4.116, 50.25)[0];
    assert.equal(out.result.delta_stored_energy_kwh, .022);
    assert.equal(out.payload, 76.4);
});
test('old days expire by calendar date, including missing days', () => {
    const h = harness(); seed(h); grow(h);
    h.setTime(new Date(2026, 8, 27, 12).getTime()); const out = h.pair(0, 0)[0];
    assert.equal(out.result.sum_charge_kwh_7d, 0); assert.equal(out.result.days_used, 0);
    assert.equal(out.result.daily_intervals.length, 1);
});
test('corrupt persisted data rejected without destructive overwrite', () => {
    const h = harness(); seed(h); h.stores.file.batt_eff_state_v3.last.soc = null;
    h.advance(5000); assert.equal(h.pair(5, 4)[0].result.reason, 'invalid_persisted_state_requires_review');
    assert.equal(h.stores.file.batt_eff_state_v3.last.soc, null);
});
test('empty legacy ring remains untouched during migration', () => {
    const h = harness(); h.stores.file.batt_eff_ring_7d = {version: 2, unit: 'kWh', head: -1, slots: Array.from({length:7},()=>({date:null})), sentinel: 'keep'};
    seed(h); assert.equal(h.stores.file.batt_eff_ring_7d.sentinel, 'keep');
    assert.equal(h.stores.file.batt_eff_state_v3.days[0].charge, 0);
});
test('changed capacity archives old state and starts a new baseline', () => {
    const h = harness(); seed(h); h.stores.file.batt_eff_state_v3.fingerprint = 'other capacity';
    h.advance(5000); assert.equal(h.pair(5, 4)[0].result.reason, 'configuration_changed_new_baseline');
    assert.equal(h.stores.file.batt_eff_previous_state_v3.fingerprint, 'other capacity');
});
test('missing, expired and future cycles rejected', () => {
    const h = harness(); assert.equal(h.fn({})[0].result.reason, 'missing_or_expired_cycle');
    const m = h.messages(5, 4); h.advance(4001);
    assert.equal(h.fn(m[0])[0].result.reason, 'missing_or_expired_cycle');
    const n = h.messages(5, 4); n[0]._eff.ts++;
    assert.equal(h.fn(n[0])[0].result.reason, 'missing_or_expired_cycle');
});
test('incomplete cycles never mix directions; late responses ignored', () => {
    const h = harness(); const old = h.messages(1, 1); h.fn(old[0]); h.advance(1000);
    const current = h.messages(5, 4); assert.equal(h.fn(current[0])[0].result.reason, 'incomplete_previous_cycle');
    assert.equal(h.fn(old[1]), null); const out = h.fn(current[1])[0];
    assert.equal(out.result.sum_charge_kwh_7d, 0);
    assert.equal(h.stores.file.batt_eff_state_v3.last.discharge, 4);
});
test('missing context store produces an unknown state, not a numeric result', () => {
    const h = harness(); delete h.stores.file; const out = h.pair(5, 4)[0];
    assert.equal(out.payload, null); assert.equal(out.result.reason, 'context_or_runtime_error');
});
test('prepare function snapshots SOC once and watchdog clears stale result', () => {
    const h = harness(); h.stores.memoryOnly.batt_level = 51;
    const prepare = new vm.Script('(function(msg){' + fs.readFileSync(path.join(root, 'prepare-cycle.js'), 'utf8') + '})').runInContext(h.sandbox);
    const a = prepare({}); assert.equal(a[0]._eff.soc, 51); assert.equal(a[1], null);
    h.advance(16000); assert.equal(prepare({})[1].result.reason, 'measurement_timeout');
    assert.equal(h.stores.file.la_ela_es, null);
});
test('DST calendar rollover excludes boundary without a 24-hour assumption', () => {
    const h = harness(); h.setTime(new Date(2026, 9, 24, 23, 59).getTime()); seed(h);
    h.setTime(new Date(2026, 9, 25, 0, 1).getTime());
    assert.equal(h.pair(0, 0)[0].result.reason, 'new_day_boundary_excluded');
    h.setTime(new Date(2026, 9, 26, 0, 1).getTime());
    assert.equal(h.pair(0, 0)[0].result.reason, 'new_day_boundary_excluded');
});
test('export contains synchronized functions and resolved wiring/config references', () => {
    const nodes = JSON.parse(fs.readFileSync(path.join(root, 'flow.json'), 'utf8'));
    const ids = new Set(nodes.map(n => n.id)); assert.equal(ids.size, nodes.length);
    for (const n of nodes) {
        for (const wires of n.wires || []) for (const id of wires) assert.ok(ids.has(id), id);
        if (n.server) assert.ok(ids.has(n.server));
        if (n.entityConfig) assert.ok(ids.has(n.entityConfig));
        if (n.type === 'function') assert.equal(n.outputs, 2);
    }
    assert.equal(nodes.find(n => n.id === 'e46be25028e13f5d').func, source);
    assert.equal(nodes.find(n => n.id === 'effprepare000003').func, fs.readFileSync(path.join(root, 'prepare-cycle.js'), 'utf8'));
    assert.equal(fs.readFileSync(path.join(root, 'function node - Round-Trip Efficiency.txt'), 'utf8'), source);
    for (const n of nodes.filter(n => n.type === 'api-current-state')) {
        assert.equal(n.state_type, 'str'); assert.equal(n.blockInputOverrides, true);
    }
});
test('exported preparation and calculation execute together with paired HA responses', () => {
    const h = harness(); const nodes = JSON.parse(fs.readFileSync(path.join(root, 'flow.json'), 'utf8'));
    const prepare = new vm.Script('(function(msg){' + nodes.find(n => n.id === 'effprepare000003').func + '})').runInContext(h.sandbox);
    h.stores.memoryOnly.batt_level = 50; h.stores.memoryOnly.batt_level_ts = h.time();
    const request = prepare({})[0]; const msgs = h.messages(5, 4);
    msgs.forEach(m => m._eff = JSON.parse(JSON.stringify(request._eff)));
    assert.equal(h.fn(msgs[0]), null); assert.equal(h.fn(msgs[1])[0].result.reason, 'baseline_initialized');
});
test('maximum seven calendar day buckets; eighth day removes the oldest', () => {
    const h = harness();
    for (let day = 20; day <= 27; day++) {
        h.setTime(new Date(2026, 8, day, 12).getTime()); h.pair(0, 0);
        for (let i = 1; i <= 3; i++) { h.advance(60000); h.pair(i * .04, i * .032); }
    }
    const days = h.stores.file.batt_eff_state_v3.days;
    assert.equal(days.length, 7); assert.equal(days[0].date, '2026-09-21');
    assert.ok(Math.abs(days.reduce((s,d)=>s+d.charge,0) - .84) < 1e-10);
});
test('legacy history and live day are used on first output and originals retained', () => {
    const h = harness(); legacy(h, [oldDay('2026-09-18'),oldDay('2026-09-19')]);
    h.stores.memoryOnly.batt_eff_today_live = oldDay('2026-09-20', 1, .8);
    const original = JSON.stringify(h.stores.file.batt_eff_ring_7d);
    const out = h.pair(1, .8)[0];
    assert.equal(out.payload,80); assert.equal(out.result.sum_charge_kwh_7d,11);
    assert.equal(out.result.days_used,3); assert.equal(out.result.legacy_days_in_window,3);
    assert.equal(out.result.covered_hours,0);
    assert.equal(JSON.stringify(h.stores.file.batt_eff_ring_7d),original);
    assert.equal(h.stores.file.batt_eff_legacy_backup_v3.live.chargeKWh,1);
    h.advance(60000); const next=h.pair(1.04,.832)[0];
    assert.equal(next.result.sum_charge_kwh_7d,11.04); assert.equal(next.payload,80);
});
test('snapshot fallback survives restart; live source takes precedence without double counting', () => {
    const h=harness();legacy(h,[]);
    h.stores.file.batt_eff_today_live_snapshot=oldDay('2026-09-20',1,.8);
    h.stores.memoryOnly.batt_eff_today_live=oldDay('2026-09-20',2,1.6);
    assert.equal(h.pair(2,1.6)[0].result.sum_charge_kwh_7d,2);
    h.restart();h.advance(60000);
    assert.equal(h.pair(2.04,1.632)[0].result.sum_charge_kwh_7d,2.04);
    const other=harness();legacy(other,[]);other.stores.file.batt_eff_today_live_snapshot=oldDay('2026-09-20',1,.8);
    assert.equal(other.pair(2,1.6)[0].result.sum_charge_kwh_7d,1);
});
test('legacy null SOC preserves energy but never invents efficiency', () => {
    const h=harness();legacy(h,[oldDay('2026-09-19',5,4,null,50)]);
    const out=h.pair(0,0)[0];assert.equal(out.payload,null);
    assert.equal(out.result.sum_charge_kwh_7d,5);assert.equal(out.result.eta_raw_pct,null);
    assert.equal(out.result.reason,'legacy_soc_boundaries_missing');
    h.setTime(new Date(2026,8,26,12).getTime());
    assert.equal(h.pair(0,0)[0].result.legacy_soc_boundaries_missing,false);
});
test('all original slots backed up; only active calendar days included', () => {
    const h=harness();legacy(h,[oldDay('2026-09-13'),oldDay('2026-09-14'),oldDay('2026-09-19')]);
    const out=h.pair(0,0)[0];assert.equal(out.result.sum_charge_kwh_7d,10);
    assert.equal(h.stores.file.batt_eff_legacy_backup_v3.ring.slots[0].date,'2026-09-13');
});
test('malformed legacy energy and unsupported units stop rather than erase history', () => {
    for(const bad of ['energy','unit']) {
        const h=harness();legacy(h,[oldDay('2026-09-19')]);
        if(bad==='energy')h.stores.file.batt_eff_ring_7d.slots[0].chargeKWh='unknown';
        else h.stores.file.batt_eff_ring_7d.unit='Wh';
        assert.equal(h.pair(0,0)[0].payload,null);
        assert.equal(h.stores.file.batt_eff_state_v3,undefined);
        assert.ok(h.stores.file.batt_eff_legacy_backup_v3);
    }
});
test('upgrade of already-running v3 restores disjoint legacy prefix exactly once', () => {
    const h=harness();seed(h);grow(h);
    delete h.stores.file.batt_eff_state_v3.legacyMigration; // previously published v3 schema
    legacy(h,[oldDay('2026-09-19')]);h.stores.memoryOnly.batt_eff_today_live=oldDay('2026-09-20',5,4);
    h.advance(60000);const out=h.pair(5.16,4.128)[0];
    assert.equal(out.result.sum_charge_kwh_7d,10.16);assert.equal(out.payload,80);
    h.restart();h.advance(60000);assert.equal(h.pair(5.20,4.16)[0].result.sum_charge_kwh_7d,10.20);
});
test('unprovable overlapping legacy day archived and flagged, never added twice', () => {
    const h=harness();seed(h);grow(h);delete h.stores.file.batt_eff_state_v3.legacyMigration;
    legacy(h,[]);h.stores.memoryOnly.batt_eff_today_live=oldDay('2026-09-20',5.1,4.08);
    h.advance(60000);const out=h.pair(5.16,4.128)[0];
    assert.equal(out.result.sum_charge_kwh_7d,.16);
    assert.deepEqual(Array.from(out.result.legacy_migration.overlappingDates),['2026-09-20']);
    assert.equal(h.stores.file.batt_eff_legacy_backup_v3.live.chargeKWh,5.1);
});
test('completed ring day beats stale snapshot; previous-day live record retained', () => {
    const h=harness();legacy(h,[oldDay('2026-09-18',5,4)]);
    h.stores.file.batt_eff_today_live_snapshot=oldDay('2026-09-18',2,1.6);
    h.stores.memoryOnly.batt_eff_today_live=oldDay('2026-09-19',3,2.4);
    assert.equal(h.pair(0,0)[0].result.sum_charge_kwh_7d,8);
});
