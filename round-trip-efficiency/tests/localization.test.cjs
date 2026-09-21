const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
test('German functions embed exactly the English executable core', () => {
    for (const name of ['battery-efficiency', 'prepare-cycle']) {
        const en = fs.readFileSync(path.join(root, name+'.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l=>l.split('//')[0].trimEnd()).join('\n').trim();
        const de = fs.readFileSync(path.join(root, name+'_DE.js'), 'utf8');
        const core = de.split('const ausgabe = (function(msg, node) {\n')[1].split('\n})(msg, knotenDeutsch);')[0].trim();
        assert.equal(core, en);
    }
});
test('German errors and diagnostics are readable while machine codes stay stable', () => {
    const statuses=[];
    const fn = new vm.Script('(function(msg){'+fs.readFileSync(path.join(root,'battery-efficiency_DE.js'),'utf8')+'})')
        .runInNewContext({flow:{set(){}},node:{status:s=>statuses.push(s),error(){}},Date});
    const out=fn({});
    assert.equal(out[0].result.reason,'missing_or_expired_cycle');
    assert.equal(out[0].result.grund,'Messzyklus fehlt oder ist abgelaufen');
    assert.equal(statuses[0].text,out[0].result.grund);
});
test('German alternative preserves graph, context and sensor entity references', () => {
    const en=JSON.parse(fs.readFileSync(path.join(root,'flow.json'),'utf8'));
    const de=JSON.parse(fs.readFileSync(path.join(root,'flow_DE.json'),'utf8'));
    assert.equal(en.length,de.length);
    for(let i=0;i<en.length;i++)for(const key of ['id','z','type','wires','server','entity_id','entityConfig','repeat','outputs'])
        assert.deepEqual(de[i][key],en[i][key]);
    const cfg=de.find(n=>n.type==='ha-entity-config');
    assert.equal(cfg.haConfig.find(x=>x.property==='name').value,'Lade Entlade Effizenz');
});
