const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const paths=[path.resolve(root,'../Regler_V4_25_SIM_DIAG1.js'),root+'/publish_v425_diagnostics/regulator/experimental/v4.25-sim/Regler_V4_25_SIM_DIAG1.js'];
const filename=paths.find(p=>fs.existsSync(p));
if(!filename)throw new Error('Regler_V4_25_SIM_DIAG1.js not found');
module.exports={source:fs.readFileSync(filename,'utf8'),filename};
