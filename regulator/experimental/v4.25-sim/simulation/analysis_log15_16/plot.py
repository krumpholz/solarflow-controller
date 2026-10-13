from common import *
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
rows=read(16);t=np.array([(r['ts']-rows[0]['ts'])/60000 for r in rows]);a=lambda k:np.array([r['inputs'][k] if executed(r) else np.nan for r in rows])
fig,ax=plt.subplots(3,1,figsize=(12,9),sharex=True,constrained_layout=True)
fig.suptitle('Log 16 · beginnende PV und Wechsel Entladen → Laden\nV4.25-SIM-DIAG1 · 13.10.2026 · Messung, keine Prognose',fontsize=15)
ax[0].plot(t,a('p_solar'),label='PV',color='#dd9a14');ax[0].plot(t,a('p_batterie'),label='Batterie (+ Laden)',color='#176c9c');ax[0].plot(t,a('p_haus'),label='Haus (abgeleitet)',color='#68736b',alpha=.7)
ax[0].set_ylabel('Leistung [W]');ax[0].legend(loc='upper left',ncol=3)
ax[1].plot(t,a('p_zaehler'),label='Zähler (+ Import)',color='#176c9c');switch=t[461]
ax[1].fill_between([0,switch],0,15,color='#68ad86',alpha=.18);ax[1].fill_between([switch,t[-1]],-5,15,color='#68ad86',alpha=.18,label='Sollwertfenster')
ax[1].plot([0,switch,switch,t[-1]],[7.5,7.5,5,5],'--',color='#478252',label='Zielmitte')
ax[1].set_ylabel('Netzleistung [W]');ax[1].legend(loc='lower left',ncol=3)
ax[2].step(t,[r['outputs']['chargeW'] if executed(r) else np.nan for r in rows],where='post',label='Lade-Sollwert',color='#cf651c');ax[2].step(t,[r['outputs']['dischargeW'] if executed(r) else np.nan for r in rows],where='post',label='Entlade-Sollwert',color='#597297')
for x in ax:
 x.grid(alpha=.16);x.axvline(switch,color='#875391',ls=':',lw=1.3)
 for i,r in enumerate(rows):
  if not executed(r):x.axvline(t[i],color='#ba4c43',alpha=.3,lw=1)
ax[2].set_ylabel('Anforderung [W]');ax[2].set_xlabel('Minuten seit 08:12:41 MESZ');ax[2].legend(loc='upper left')
ax[1].annotate('−67 W bei Ladefreigabe',xy=(switch,-67),xytext=(11.2,-51),arrowprops={'arrowstyle':'->','color':'#555'})
fig.savefig(OUT/'Log16_Verlauf.png',dpi=160);plt.close(fig)
rows=read(15);t=np.array([(r['ts']-rows[0]['ts'])/60000 for r in rows]);fig,ax=plt.subplots(figsize=(12,3.8),constrained_layout=True)
ax.axhspan(0,15,color='#68ad86',alpha=.18,label='Fenster 0…15 W');ax.axhline(7.5,color='#478252',ls='--',label='Ziel +7,5 W');ax.plot(t,[r['inputs']['p_zaehler'] for r in rows],color='#176c9c',label='Zähler')
ax.set(title='Log 15 · ruhige Entladung bei 8–22 W PV · 99,32 % im Fenster',xlabel='Minuten seit 07:43:37 MESZ',ylabel='Netzleistung [W]');ax.legend(ncol=3,loc='lower right');ax.grid(alpha=.15)
fig.savefig(OUT/'Log15_Fenstermitte.png',dpi=160);plt.close(fig)
