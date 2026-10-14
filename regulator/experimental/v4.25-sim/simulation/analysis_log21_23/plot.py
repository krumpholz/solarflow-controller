from common import *
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.size':9,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(3,2,figsize=(14,9),constrained_layout=True)
fig.suptitle('Tageslogs 21–23 · V4.25-SIM-DIAG1 unverändert\nMesswerte · 14.10.2026 · positiv: Netzimport / Batterieladung',fontsize=15)
for j,n in enumerate(range(21,24)):
 rs=read(n);t=np.array([(r['ts']-rs[0]['ts'])/60000 for r in rs]);get=lambda k:np.array([r['inputs'][k] if executed(r) else np.nan for r in rs]);a,b=axes[j]
 a.plot(t,get('p_solar'),color='#d69510',label='PV');a.plot(t,get('p_batterie'),color='#277593',label='Batterie');a.set(title=f'Log {n} · {local(rs[0]["ts"])[11:16]}–{local(rs[-1]["ts"])[11:16]} MESZ',ylabel='Leistung [W]')
 b.plot(t,get('p_zaehler'),color='#277593',lw=1,label='Zähler');lo=np.array([0 if r['mode']=='REGEL_ENTLADEN' else -5 for r in rs]);b.fill_between(t,lo,15,color='#63a578',alpha=.2,label='Fenster');b.plot(t,[r['targets']['p_target'] if executed(r) else np.nan for r in rs],color='#467a4e',ls='--',lw=1,label='Betriebsziel');b.set(title='Netzleistung und Ziel',ylabel='Zähler [W]')
 for ax in [a,b]:ax.grid(alpha=.16);ax.set_xlabel('Minuten seit Logbeginn')
 if j==0:a.legend(ncol=2);b.legend(ncol=3)
fig.savefig(OUT/'Logs21_23_Verlauf.png',dpi=135);plt.close(fig)
