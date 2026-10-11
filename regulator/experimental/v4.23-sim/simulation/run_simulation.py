"""Conditional charging replay for a local JSONL field log. Does not contact the plant."""
import argparse,json,subprocess
from pathlib import Path
import numpy as np
from plant import response
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--log',type=Path,required=True)
p.add_argument('--output',type=Path,required=True,help='New JSON output filename')
a=p.parse_args()
if a.output.exists():p.error('Choose a new output file; existing output is preserved')
rows=[json.loads(s) for s in a.log.read_text().splitlines() if s.strip()]
if len(rows)<6:p.error('At least six regulator-status rows are required')
if any(r['mode']!='REGEL_LADEN' or r['outputs']['dischargeW']!=0 for r in rows):p.error('This plant model is calibrated for charging only')
zero=rows[0]['ts']/1000;times={k:[] for k in ['tz','tb']};fallback=[]
for i,r in enumerate(rows):
 snap=r.get('snapshot');valid=isinstance(snap,dict) and snap.get('cycleId')==r['snapshotCycle']['snapshotLastOkCycleId'] and all(snap.get('values',{}).get(k)==r['inputs'][k] for k in ['p_zaehler','p_batterie','p_solar','p_haus'])
 for k,topic in [('tz','p_zaehler'),('tb','p_batterie')]:
  ts=snap['rxTsByTopic'][topic] if valid else r['snapshotCycle']['lastOkTs']
  times[k].append(ts/1000-zero)
 if not valid:fallback.append(i)
d={'rows':rows,'tc':np.array([r['ts']/1000-zero for r in rows]),'tz':np.array(times['tz']),'tb':np.array(times['tb']),
 'u':np.array([r['outputs']['chargeW'] for r in rows]),'b':np.array([r['inputs']['p_batterie'] for r in rows]),
 'z':np.array([r['inputs']['p_zaehler'] for r in rows]),'initial':rows[0]['controlBase']['lastChargeW']}
if any(np.any(np.diff(d[k])<=0) for k in ['tc','tz','tb']):p.error('Receive/control times must be strictly increasing')
base=Path(__file__).resolve().parents[1];model=json.loads((base/'Regler_Modell_V5.json').read_text())
dataset={'rows':rows,**{k:d[k].tolist() for k in ['tc','tz','tb']},'initial':d['initial'],
 'net':(d['z']-response(d,model['nominal']['grid'],'grid')).tolist(),'batteryNoise':[0]*len(rows),
 'recoveryIndex':0,'recoveryEnd':len(rows)}
candidates=[{'name':'V4.22 core','constants':{'chargeCenterTrimTimingToleranceMs':0}},
 {'name':'V4.23 candidate'},
 {'name':'4W fine step','constants':{'chargeCenterTrimMaxStepW':4}},
 {'name':'2W fine step','constants':{'chargeCenterTrimMaxStepW':2}},
 {'name':'8s fine wait','constants':{'chargeCenterTrimWaitMs':8000}}]
q={'dataset':dataset,'models':model['ensemble'],'candidates':candidates,'trajectories':True}
res=json.loads(subprocess.run(['node',str(Path(__file__).with_name('simulate.cjs'))],input=json.dumps(q),text=True,capture_output=True,check=True).stdout)
outside=any(v!=0 for cases in res for run in cases for v in run['trajectory']['D'])
out={'scope':'Offline reconstructed disturbance, fixed across all candidates; not an independent PV/house forecast.',
 'snapshot_time_fallback_indices':fallback,'outside_charging_calibration':outside,
 'models':[m['name'] for m in model['ensemble']],'candidates':candidates,'results':res}
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2,allow_nan=False))
print('Created:',a.output)
if outside:print('Warning: a candidate requested discharge; its plant trajectory is outside calibration')
