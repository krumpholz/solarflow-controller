from common import *
import sys,copy
from scipy.optimize import least_squares
sys.path.insert(0,str(ROOT/'analysis_log6'));from physics import advance
base=json.loads(BASE_MODEL_PATH.read_text())
rows={n:read(n) for n in [8,11,15,16,17,18,19,20]}
def error(e):
 e=np.asarray(e);e=e[np.isfinite(e)]
 return {'points':len(e),'rmseW':float(np.sqrt(np.mean(e*e))),'maeW':float(np.mean(abs(e))),'biasW':float(np.mean(e)),'p95AbsW':float(np.quantile(abs(e),.95))} if len(e) else {'points':0}
def response(n,m):
 rs=rows[n];pred=np.full(len(rs),np.nan);ok=np.zeros(len(rs),bool);y=None;previous=None
 for i,r in enumerate(rs):
  if not executed(r):continue
  if r['mode']!='REGEL_LADEN':y=None;continue
  tc,tb,tz=clocks(r)
  def goal(u):return m.get('idle_bias',-18) if u==0 else m['gain']*u+m['bias']+m.get('hinge',0)*max(0,u-650)
  if y is None or (not r.get("execution") and previous is not None and int(r["snapshotCycle"]["regulatorCycleShort"])!=previous+1):
   y=r['inputs']['p_batterie'];at=tb;old=r['controlBase']['lastChargeW'];target=goal(old);q=[];last=-1e30;start=tb
  while q and q[0][0]<=tb:
   when,v=q.pop(0);y=advance(y,target,max(0,when-at),m);at=when;target=v
  y=advance(y,target,max(0,tb-at),m);at=tb;pred[i]=y;ok[i]=tb-start>=12
  u=r['outputs']['chargeW']
  if u!=old:
   when=max(tc+(m['delay_up'] if u>old else m['delay_down']),last+1e-6);q.append((when,goal(u)));last=when;old=u
  previous=int(r["snapshotCycle"]["regulatorCycleShort"])
 return pred,ok
b0=copy.deepcopy(base['charging']['battery']);observed={n:np.array([r['inputs']['p_batterie'] if executed(r) else np.nan for r in rs]) for n,rs in rows.items()}
mask={n:response(n,b0)[1] for n in rows}
train={n:mask[n]&np.array([r['ts']<rows[n][0]['ts']+600000 for r in rows[n]]) for n in [17,19]}
def unpack(x):return {**b0,'gain':x[0],'bias':x[1],'hinge':x[2] if len(x)>2 else 0}
def objective(x):
 m=unpack(x);return np.concatenate([(observed[n]-response(n,m)[0])[train[n]] for n in [17,19]])
f=least_squares(objective,[b0['gain'],b0['bias']],bounds=([.90,-60],[1.10,20]),loss='soft_l1',f_scale=3)
h=least_squares(objective,[b0['gain'],b0['bias'],0],bounds=([.9,-60,-.1],[1.1,20,.1]),loss='soft_l1',f_scale=3)
models={'V14_nominal':b0,'old_normal_local':base['chargingNormalPVLocal']['battery'],'old_high_local':base['chargingHighPVLocal']['battery'],'affine_candidate':unpack(f.x),'hinge_candidate':unpack(h.x)}
result={}
for name,m in models.items():
 result[name]={'model':m,'validation':{}}
 for n in [8,11,16,17,18,19,20]:
  p,v=response(n,m);hold=v&~train[n] if n in train else v
  result[name]['validation']['log'+str(n)]=error((observed[n]-p)[hold])
  if n in train:result[name]['validation']['train'+str(n)]=error((observed[n]-p)[train[n]])
(OUT/'Log17_20_Kalibrierung.json').write_text(json.dumps({'training':'First10min of logs17 and19; chronological remainder plus logs16,18,20 held out. Only gain/bias or continuous hinge at650W fitted. All existing dynamics fixed.','models':result},indent=2)+'\n')
np.savez(OUT/'battery_predictions.npz',**{f'log{n}_{name}':response(n,m)[0] for n in [8,11,16,17,18,19,20] for name,m in models.items()})
print(json.dumps({name:{'model':v['model'],'validation':{n:{k:round(x,3) if isinstance(x,float) else x for k,x in e.items() if k in ['rmseW','maeW','biasW']} for n,e in v['validation'].items()}} for name,v in result.items()},indent=2))
