/* V6 draft: place between the EXISTING permission decision and its consumers.
 * Input 1: msg.payload boolean = ORIGINAL decision (never this node's output).
 * Input 2: calculation output 3, every existing timer tick, same flow tab.
 * Optional msg.solar_override_allowed boolean: external hard reserve/vacation
 * interlock; defaults false until explicitly supplied. Keep this distinct from
 * the economic base permission. Existing minimum-SOC/OFF protections remain.
 * Writes b_entladen. Do not keep another writer downstream of this node.
 * No device commands. No new timer. Requires current valid source inventory.
 */
const now=Date.now(),FILE='file',KEY='batt_eff_release_v6';
const flag=v=>v===true||v===1||v==='true'||v==='1'?true:v===false||v===0||v==='false'||v==='0'?false:null;
let saved=flow.get(KEY,FILE)||{base:false,solarInterlock:false,solarActive:false};
let s={...saved};
if(typeof msg.payload==='boolean')s.base=msg.payload;
else if(msg.payload?.type!=='efficiency_sources_v6'){node.warn('V6 Freigabe erwartet Boolean oder Berechnungsausgang 4');return null;}
if(typeof msg.solar_override_allowed==='boolean')s.solarInterlock=msg.solar_override_allowed;
const inv=flow.get('batt_eff_sources_v6',FILE);
const fresh=inv?.valid===true&&Number.isFinite(inv.at)&&now>=inv.at&&now-inv.at<=6500;
const on=flag(flow.get('regelung'))===true;
const net=flag(flow.get('netz_laden'));
const min=flag(flow.get('regler_batt_min_confirmed'));
const safe=on&&net===false&&min===false;
const amount=fresh&&Number.isFinite(inv.solar_available_kwh)?inv.solar_available_kwh:0;
// Start with >=2 SOC points of solar inventory; stop with 1 point reserve left.
s.solarActive=!!(safe&&s.solarInterlock&&fresh&&(s.solarActive?amount>0:amount>=.0864));
const effective=safe&&(s.base||s.solarActive);
flow.set(KEY,s,FILE);flow.set('b_entladen',effective);
msg.payload=effective;
msg.efficiency_release={base:s.base,solar:s.solarActive,hard_interlock:s.solarInterlock,source_fresh:fresh};
return msg;
