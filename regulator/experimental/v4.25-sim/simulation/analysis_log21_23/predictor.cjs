// Experimental offline controller observer; intentionally not a production export.
function helper(p){return `
let predState = null;
if (regelung && !netz_laden && !batt_max && (af_activeDir === 1 || desiredDirRaw === 1)) {
 const predAt = snapshotLastOkTs;
 const stored = flow.get("sf_pending_charge_model_trial");
 predState = stored && stored.at <= predAt && predAt - stored.at < 10000
  ? structuredClone(stored) : {at:predAt,y:Math.max(0,p_batterie),target:lastChargeW,u:lastChargeW,q:[],lastArrival:0};
 const evolve = t => {const dt=Math.max(0,(t-predState.at)/1000);predState.y=predState.target+(predState.y-predState.target)*Math.exp(-dt/.25);predState.at=t;};
 while(predState.q.length && predState.q[0].at <= predAt){const e=predState.q.shift();evolve(e.at);predState.target=e.target;}
 evolve(predAt);
}
`;}
function commit(p){return `
if (mode === "REGEL_LADEN" && predState) {
 const u = Math.round(chargeW);
 if(u !== predState.u){const arrival=Math.max(nowTs+(u>predState.u?${p.up*1000}:${p.down*1000}),predState.lastArrival+1);predState.q.push({at:arrival,target:u});predState.lastArrival=arrival;predState.u=u;}
 flow.set("sf_pending_charge_model_trial",predState);
} else flow.set("sf_pending_charge_model_trial",null);
`;}
module.exports={helper,commit};
