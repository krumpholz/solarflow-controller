from common import *
x=json.loads((OUT/'Log15_16_ClosedLoop.json').read_text())
p=OUT/'Regler_Modell_V14.json';m=json.loads(p.read_text())
m['lowPowerDawnExtension']['closedLoopValidation']={
 'resultFile':'Log15_16_ClosedLoop.json',
 'sha256':hashlib.sha256((OUT/'Log15_16_ClosedLoop.json').read_bytes()).hexdigest(),
 'runs':len(x['results']),'candidatesIncludingReference':len(x['candidates']),'modelAlternatives':len(x['envs']),
 'adoptedControllerChange':False,'retainedController':'V4.25-SIM-DIAG1',
 'decision':'Retain current controller. Earlier switching reduces nominal export but worsens import peaks and direction changes in early-cloud sensitivity. Stronger trims are not uniformly better. No physical optimum established.',
 'limitations':'Single observed D-to-C transition; active charge commands60..285W. Reconstructed net load and optional reused residual are conditional counterfactual assumptions, not independent predictive evidence. No high-PV or full-battery recalibration.'}
p.write_text(json.dumps(m,indent=2)+'\n')
