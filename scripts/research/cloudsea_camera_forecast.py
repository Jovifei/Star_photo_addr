"""Same candidate, one visual camera, exact fixed runs; no image labels read."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import json
from pathlib import Path
import threading
from urllib.parse import urlencode
from cloudsea_dense_download import RAW, OUT, fetch, date_range, SURFACE
from cloudsea_dap import dap_url, decode_dap_ascii
from cloudsea_ncss import normalize_ncss_point
from cloudsea_grib_b import prepare_b_tasks, download_b_tasks, decode_b_ranges
from cloudsea_grib_main import fetch_main_points, decode_main_ranges

SITE=dict(id='SNB',name='Sonnblick SW camera',latitude=47.053979,longitude=12.957484,altitude=3106,timezone='Europe/Vienna')
LEADS=(30,33,36,39)
BOUNDS=(47.01,46.99,12.99,13.01)
LOCK=threading.Lock()

def load(path):return json.loads(Path(path).read_text())
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def api_task(day,kind,model,hourly,native=True):
    run=day-dt.timedelta(days=1)
    params=dict(latitude=SITE['latitude'],longitude=SITE['longitude'],models=model,run=f'{run}T00:00',forecast_hours=48,
        hourly=hourly,cell_selection='nearest',wind_speed_unit='ms',timezone='UTC',timeformat='unixtime')
    if native:params['elevation']='nan'
    return dict(date=str(day),runUtc=f'{run}T00:00:00Z',kind=kind,expectedPoints=1,
        path=str(RAW/f'{run:%Y%m%d}'/'camera-snb'/f'{kind}.json'),
        url='https://single-runs-api.open-meteo.com/v1/forecast?'+urlencode(params))

def one_day(day,previous,main_recovery,saved=None):
    run=day-dt.timedelta(days=1);run_utc=f'{run}T00:00:00Z'
    if saved and (saved['date']!=str(day) or saved['runUtc']!=run_utc):
        raise ValueError('Resume identity does not match requested day/run')
    hours=list(saved.get('hours',[])) if saved else []
    if len({h['lead'] for h in hours})!=len(hours) or any(h['lead'] not in LEADS for h in hours):
        raise ValueError('Resume identity has duplicate or unexpected leads')
    if len(hours)==len(LEADS):return saved
    records=list(saved.get('sources',[])) if saved else []
    metadata=[]
    for kind,model,fields,native in [('snb-surface','ncep_gfs013',SURFACE,True),('snb-terrain','ncep_gfs025','geopotential_height_850hPa',True)]:
        task=api_task(day,kind,model,fields,native);record=fetch(task,previous.get(task['url']));records.append(record);metadata.append(record)
    if any(r['status']!='OK' for r in metadata):return dict(date=str(day),runUtc=run_utc,site=SITE,hours=hours,sources=records,error='source metadata missing')
    surface=load(metadata[0]['path']);terrain=load(metadata[1]['path'])
    ready={h['lead'] for h in hours}
    for lead in LEADS:
        if lead in ready:continue
        valid=(dt.datetime.fromisoformat(run_utc.replace('Z','+00:00'))+dt.timedelta(hours=lead)).isoformat()
        recovery=main_recovery.get((str(run),lead))
        try:
            if recovery:
                with LOCK:
                    main=decode_main_ranges([r['path'] for r in recovery['receipts']],run_utc,lead,[SITE])['points'][SITE['id']]
                raw=dict(main,elevation=terrain['elevation'],timezone='UTC',utc_offset_seconds=0)
                source_hashes=[recovery['sha256']]
            else:
                task=dict(date=str(day),runUtc=run_utc,lead=lead,box='SNB',kind='full',
                    path=str(RAW/f'{run:%Y%m%d}'/'camera-snb'/f'f{lead:03d}-main.txt'),url=dap_url(run_utc,lead,BOUNDS,low_troposphere=True))
                record=fetch(task,previous.get(task['url']));records.append(record)
                if record['status']!='OK':
                    main=fetch_main_points(run_utc,lead,[SITE])['points'][SITE['id']]
                    raw=dict(main,elevation=terrain['elevation'],timezone='UTC',utc_offset_seconds=0)
                    source_hashes=[]
                else:
                    raw=normalize_ncss_point(decode_dap_ascii(record['path'],run_utc,valid),SITE['latitude'],SITE['longitude'],run_utc,valid)
                    source_hashes=[record['sha256']]
            if abs(raw['latitude']-terrain['latitude'])>1e-5 or abs(raw['longitude']-terrain['longitude'])>1e-5:raise ValueError('Native camera grid mismatch')
            if raw['elevation'] is None:raw['elevation']=terrain['elevation']
            plan=prepare_b_tasks(run_utc,lead,RAW/f'{run:%Y%m%d}'/'companion-b'/f'f{lead:03d}',provider='google')
            receipts=download_b_tasks(plan['tasks'],parallel=4)
            if not all(r['sourceValidated'] for r in receipts):raise ValueError('Native bridge source invalid')
            with LOCK:bridge=decode_b_ranges([r['path'] for r in receipts],run_utc,lead,[SITE])['points'][SITE['id']]
            if bridge['latitude']!=raw['latitude'] or bridge['longitude']!=raw['longitude'] or bridge['hourly']['time']!=raw['hourly']['time']:raise ValueError('Main/B camera identity mismatch')
            raw['hourly'].update({k:v for k,v in bridge['hourly'].items() if k!='time'})
            raw['hourly_units'].update(bridge['hourly_units'])
            epoch=raw['hourly']['time'][0]
            index=surface['hourly']['time'].index(epoch)
            for field in SURFACE.split(','):
                raw['hourly'][field]=[surface['hourly'][field][index]]
                raw['hourly_units'][field]=surface['hourly_units'][field]
            raw['sourceMetadata']['surfaceModel']='ncep_gfs013'
            raw['sourceMetadata']['missingFields']=[k for k,v in raw['hourly'].items() if k!='time' and v[0] is None]
            hours.append(dict(lead=lead,raw=raw,rawHashes=source_hashes+[r['sha256'] for r in receipts],
                surfaceGrid=dict(providerModel='ncep_gfs013',latitude=surface['latitude'],longitude=surface['longitude'],elevation=surface['elevation']),
                pressureGrid=dict(providerModel='ncep_gfs025',latitude=raw['latitude'],longitude=raw['longitude'],elevation=raw['elevation'])))
        except (ValueError,RuntimeError,OSError) as error:
            records.append(dict(date=str(day),lead=lead,status='ERROR',error=str(error),kind='camera-hour'))
    return dict(date=str(day),runUtc=run_utc,site=SITE,hours=sorted(hours,key=lambda h:h['lead']),sources=records)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['development','validation'],default='development');parser.add_argument('--limit',type=int)
    args=parser.parse_args()
    if args.phase=='validation' and not (OUT/'camera-candidate-frozen.json').exists():raise SystemExit('Freeze candidate before independent validation')
    dates=list(date_range('2026-09-01','2026-09-30')) if args.phase=='development' else list(date_range('2026-08-01','2026-08-31'))+list(date_range('2026-10-11','2026-10-20'))
    if args.limit:dates=dates[:args.limit]
    target=OUT/f'camera-inputs-{args.phase}.json'
    existing=load(target)['records'] if target.exists() else []
    saved={r['date']:r for r in existing}
    previous={s['url']:s for r in existing for s in r.get('sources',[]) if s.get('status')=='OK' and 'url' in s}
    completed={r['date']:r for r in existing if len(r['hours'])==4}
    recovery_path=OUT/f'dense-main-recovery-{args.phase}.json'
    recovery={(r['runUtc'][:10],r['lead']):r for r in load(recovery_path) if r['status']=='OK'} if recovery_path.exists() else {}
    result=dict(saved)
    if len(completed)<len(dates):
        import eccodes  # Fail before any downloads if the decoding environment is missing.
        print(f'Decoder ready; resuming {len(dates)-len(completed)} incomplete dates',flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending={pool.submit(one_day,day,previous,recovery,saved.get(str(day))):day for day in dates if str(day) not in completed}
        finished=len(completed)
        for future in as_completed(pending):
            record=future.result();result[record['date']]=record;finished+=1
            temporary=target.with_suffix('.json.tmp')
            temporary.write_text(json.dumps(dict(records=sorted(result.values(),key=lambda r:r['date']),expectedLeads=LEADS,qualification='SAME_NATIVE_CANDIDATE_VISUAL_CAMERA'),indent=2),encoding='utf-8')
            temporary.replace(target)
            print(f'[{finished}/{len(dates)}] {record["date"]} source-ready {len(record["hours"])}/4',flush=True)
    print(f'camera records={len(result)}, source-hours={sum(len(r["hours"]) for r in result.values())}/{len(dates)*4}',flush=True)

if __name__=='__main__':main()
