from common import *
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.size':9,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(4,2,figsize=(14,12),constrained_layout=True)
fig.suptitle('Tageslogs 17–20 · V4.25-SIM-DIAG1 unverändert\nMesswerte · 13.10.2026 · positiv: Netzimport / Batterieladung',fontsize=15)
for j,n in enumerate(range(17,21)):
 rs=read(n);t=np.array([(r['ts']-rs[0]['ts'])/60000 for r in rs]);get=lambda k:np.array([r['inputs'][k] if executed(r) else np.nan for r in rs]);a,b=axes[j]
 a.plot(t,get('p_solar'),color='#d69510',label='PV');a.plot(t,get('p_batterie'),color='#277593',label='Batterie');a.set(title=f'Log {n} · {local(rs[0]["ts"])[11:16]}–{local(rs[-1]["ts"])[11:16]} MESZ',ylabel='Leistung [W]')
 b.plot(t,get('p_zaehler'),color='#277593',lw=1,label='Zähler');lo=np.array([0 if r['mode']=='REGEL_ENTLADEN' else -5 for r in rs]);b.fill_between(t,lo,15,color='#63a578',alpha=.2,label='Fenster');b.plot(t,[r['targets']['p_target'] if executed(r) else np.nan for r in rs],color='#467a4e',ls='--',lw=1,label='Betriebsziel');b.set(title='Netzleistung und Ziel',ylabel='Zähler [W]')
 for ax in [a,b]:ax.grid(alpha=.16);ax.set_xlabel('Minuten seit Logbeginn')
 if j==0:a.legend(ncol=2);b.legend(ncol=3)
fig.savefig(OUT/'Tageslogs_17_20.png',dpi=135);plt.close(fig)
rs=read(20);ids=list(range(550,599));t=np.array([(rs[i]['ts']-rs[564]['ts'])/1000 for i in ids]);fig,axes=plt.subplots(3,1,figsize=(12,8),sharex=True,constrained_layout=True)
fig.suptitle('Log 20 · Lastsprung und Wechsel Laden → Entladen\nZeitnull: 14:02:55,226 MESZ · erste Reglerreaktion',fontsize=14)
a=axes[0];a.plot(t,[rs[i]['inputs']['p_zaehler'] if executed(rs[i]) else np.nan for i in ids],label='Zähler',color='#2a7999');a.axhspan(0,15,color='#63a578',alpha=.2);a.set_ylabel('Netzleistung [W]');a.legend()
a=axes[1];a.plot(t,[rs[i]['inputs']['p_batterie'] if executed(rs[i]) else np.nan for i in ids],label='Batterie gemessen',color='#2a7999');a.step(t,[rs[i]['outputs']['chargeW']-rs[i]['outputs']['dischargeW'] if executed(rs[i]) else np.nan for i in ids],where='post',label='Anforderung (+ Laden / − Entladen)',color='#be7721');a.set_ylabel('Batterie [W]');a.legend()
a=axes[2];a.step(t,[rs[i]['batteryStatus']['batt_acMode'] if executed(rs[i]) else np.nan for i in ids],where='post',label='AC-Modus',color='#2a7999');a.step(t,[rs[i]['batteryStatus']['batt_packState'] if executed(rs[i]) else np.nan for i in ids],where='post',label='PackState',color='#92568e',ls='--');a.set_yticks([1,2],['Laden','Entladen']);a.legend();a.set_xlabel('Sekunden seit erster Reglerreaktion')
for a in axes:a.grid(alpha=.16);a.axvline(0,color='#555',ls=':')
fig.savefig(OUT/'Log20_Lastwechsel.png',dpi=140);plt.close(fig)
