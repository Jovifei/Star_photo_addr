// Offline candidate and exact archived-source controls; never writes old reports.
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const legacyRoot=path.join(root,'tmp/cloudsea-baseline-ba73851-20261025');
const legacyPrefix=pathToFileURL(legacyRoot+'/').href;
registerHooks({resolve(specifier,context,next){
  let target;
  if(specifier.startsWith('@/'))target=path.join(context.parentURL?.startsWith(legacyPrefix)?legacyRoot:root,'src',specifier.slice(2));
  else if(specifier.startsWith('.'))target=fileURLToPath(new URL(specifier,context.parentURL));
  if(target&&!path.extname(target))for(const suffix of ['.ts','.js','/index.ts'])if(fs.existsSync(target+suffix))return next(pathToFileURL(target+suffix).href,context);
  return next(specifier,context);
}});
const current=await import(pathToFileURL(path.join(root,'src/lib/cloudsea.ts')).href);
const legacy=await import(pathToFileURL(path.join(legacyRoot,'src/lib/cloudsea.ts')).href);
const {parsePressureForecast,PRESSURE_LEVELS}=await import(pathToFileURL(path.join(root,'src/lib/pressure.ts')).href);
const phase=process.argv.includes('--validation')?'validation':'development';
const camera=process.argv.includes('--camera');
const out=path.join(root,'reports/cloudsea-source-resolution-20261025');
if(camera && phase==='validation'){
  const frozen=JSON.parse(fs.readFileSync(path.join(out,'camera-candidate-frozen.json'),'utf8'));
  for(const [file,sha] of Object.entries(frozen.source_files)){
    const actual=createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
    if(actual!==sha)throw new Error(`Frozen candidate changed: ${file}`);
  }
}
const input=JSON.parse(fs.readFileSync(path.join(out,camera?'camera-inputs-'+phase+'.json':'dense-inputs-'+phase+'-b.json'),'utf8'));
const oldRows=JSON.parse(fs.readFileSync(path.join(root,'reports/empirical-calibration-20261024/forecast-scores.json'),'utf8'));
const archived=new Map(oldRows.map(r=>[r.site+'|'+r.epoch,r]));
const mainLevels=[1000,975,950,925,900,850,800,750,700,650,600,550,500];
const results=[];
for(const record of input.records){
  if(camera && record.site.id!=='SNB')throw new Error('Camera replay requires the attested SNB viewpoint');
  if(new Set(record.hours.map(hour=>hour.lead)).size!==record.hours.length)throw new Error('Duplicate source forecast lead');
  for(const lead of input.expectedLeads ?? [24,27,30,33,36,39,42,45]){
    const epoch=Date.parse(record.runUtc)/1000+lead*3600;
    const time=new Date(epoch*1000).toISOString();
    const hour=record.hours.find(h=>h.lead===lead);
    const original=archived.get(record.site.id+'|'+epoch);
    const base={site:record.site.id,date:record.date,time,epoch,runUtc:record.runUtc,leadHours:lead,
      score:null,position:'unknown',sourceReady:false,
      archivedOriginalScore:original?.score??null,archivedOriginalPosition:original?.position??'unknown'};
    if(!hour){results.push({...base,inputError:'Missing attested MAIN/B/surface sources'});continue;}
    try{
      const raw=hour.raw;
      if(Date.parse(raw.sourceMetadata?.runUtc)!==Date.parse(record.runUtc) ||
        Date.parse(raw.sourceMetadata?.validUtc)/1000!==epoch || raw.hourly.time.length!==1 || raw.hourly.time[0]!==epoch){
        throw new Error('Native source reference/valid epoch mismatch');
      }
      const pressure=parsePressureForecast(raw,record.site.id,'gfs',true);
      pressure.providerModel='ncep_gfs025';
      pressure.qualifiedPressureLevels=PRESSURE_LEVELS;
      const hourly={...raw.hourly,time:pressure.hourly.map(h=>h.time)};
      const args=[record.site,hourly,[Number(time.slice(11,13))],pressure,record.date];
      const candidate=current.evaluateCloudSeaWindow(...args);
      const old=legacy.evaluateCloudSeaWindow(...args);
      const mainOnly=current.evaluateCloudSeaWindow(record.site,hourly,[Number(time.slice(11,13))],{...pressure,qualifiedPressureLevels:mainLevels},record.date);
      results.push({...base,sourceReady:true,score:candidate.score,position:candidate.cloudPosition,
        cloudBaseM:candidate.cloudBaseM,cloudTopM:candidate.cloudTopM,cloudTopUpperM:candidate.cloudTopUpperM,altitudeDiffM:candidate.altitudeDiffM,
        summary:candidate.summary,coverage:candidate.coverage,
        legacyCorrectedInputScore:old.score,legacyCorrectedInputPosition:old.cloudPosition,
        mainOnlyScore:mainOnly.score,mainOnlyPosition:mainOnly.cloudPosition,
        lowCloud:raw.hourly.cloud_cover_low[0],rh:raw.hourly.relative_humidity_2m[0],wind:raw.hourly.wind_speed_10m[0],
        surfaceGrid:hour.surfaceGrid,pressureGrid:hour.pressureGrid,rawHashes:hour.rawHashes});
    }catch(error){results.push({...base,inputError:String(error)});}
  }
}
const output=(camera?'camera-scores-':'dense-scores-')+phase+'.json';
fs.writeFileSync(path.join(out,output),JSON.stringify(results,null,2));
console.log(JSON.stringify({phase,plannedRows:results.length,sourceReady:results.filter(r=>r.sourceReady).length,
  scored:results.filter(r=>r.score!==null).length,high60:results.filter(r=>r.score!==null&&r.score>=60).length,
  legacyCorrectedHigh60:results.filter(r=>r.legacyCorrectedInputScore>=60).length,
  mainOnlyHigh60:results.filter(r=>r.mainOnlyScore>=60).length,
  output}));
