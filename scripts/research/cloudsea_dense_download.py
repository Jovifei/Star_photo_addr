"""Bounded public fixed-run cohort; exact URL/SHA resume. Never reads labels."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import time
from urllib.parse import urlencode
from cloudsea_ncss import ncss_url, decode_netcdf3
from cloudsea_dap import dap_url, decode_dap_ascii
import uuid
import shutil

ROOT = Path(__file__).resolve().parents[2]
RAW = Path('E:/Claude_allow/Download/starphoto-dense-cohort-20261025')
OUT = ROOT/'reports/cloudsea-source-resolution-20261025'
SITES = [dict(id='MWN',latitude=44.2708,longitude=-71.3035,altitude=1910,timezone='America/New_York'),
         dict(id='00722',latitude=51.7986,longitude=10.6183,altitude=1135,timezone='Europe/Berlin'),
         dict(id='01358',latitude=50.4285,longitude=12.9534,altitude=1213,timezone='Europe/Berlin'),
         dict(id='02290',latitude=47.8009,longitude=11.0108,altitude=977,timezone='Europe/Berlin')]
BOXES = dict(MWN=(44.26,44.24,-71.26,-71.24),DE=(52,47.75,10.5,13.25))
FIELDS = dict(profile=('Relative_humidity_isobaric','Temperature_isobaric','Geopotential_height_isobaric'),cloud=('Total_cloud_cover_isobaric',))
SURFACE = 'cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,wind_speed_10m,precipitation'

def date_range(start,end):
    day=dt.date.fromisoformat(start)
    while day<=dt.date.fromisoformat(end):
        yield day
        day+=dt.timedelta(days=1)

def tasks(dates,transport='ncss'):
    for valid in dates:
        run=valid-dt.timedelta(days=1)
        directory=RAW/f'{run:%Y%m%d}'
        for kind,model,hourly in [('surface','ncep_gfs013',SURFACE),('terrain','ncep_gfs025','geopotential_height_850hPa')]:
            params=dict(latitude=','.join(str(s['latitude']) for s in SITES),longitude=','.join(str(s['longitude']) for s in SITES),models=model,
                run=f'{run}T00:00',forecast_hours=48,hourly=hourly,elevation=','.join('nan' for _ in SITES),
                cell_selection='nearest',wind_speed_unit='ms',timezone='UTC',timeformat='unixtime')
            yield dict(date=str(valid),runUtc=f'{run}T00:00:00Z',kind=kind,path=str(directory/f'{kind}.json'),
                url='https://single-runs-api.open-meteo.com/v1/forecast?'+urlencode(params))
        for lead in range(24,48,3):
            for box,bounds in BOXES.items():
                if transport=='dap':
                    yield dict(date=str(valid),runUtc=f'{run}T00:00:00Z',lead=lead,box=box,kind='full',
                        path=str(directory/f'f{lead:03d}-{box}-low-native.txt'),url=dap_url(f'{run}T00:00:00Z',lead,bounds,low_troposphere=True))
                    continue
                for kind,fields in FIELDS.items():
                    yield dict(date=str(valid),runUtc=f'{run}T00:00:00Z',lead=lead,box=box,kind=kind,
                        path=str(directory/f'f{lead:03d}-{box}-{kind}.nc'),url=ncss_url(f'{run}T00:00:00Z',lead,*bounds,fields=fields))

def fetch(task,previous):
    path=Path(task['path']);path.parent.mkdir(parents=True,exist_ok=True)
    if previous and previous.get('status')=='OK' and path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==previous['sha256']:
        return previous
    if previous and task['kind']=='full':
        valid=(dt.datetime.fromisoformat(task['runUtc'].replace('Z','+00:00'))+dt.timedelta(hours=task['lead'])).isoformat()
        for error in previous.get('errors',[]):
            retained=Path(error['raw'])
            if not retained.exists():continue
            try:
                decode_dap_ascii(retained,task['runUtc'],valid)
                shutil.copyfile(retained,path)
                return dict(task,status='OK',sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,
                    retrievedUtc=error['retrievedUtc'],recoveredFrom=str(retained),recovery='VALID_RAW_RECOVERED_AFTER_CF_TIME_NAME_PARSER_FIX')
            except ValueError:pass
    errors=[]
    for attempt in range(1,4):
        acquired=dt.datetime.now(dt.timezone.utc).isoformat()
        temporary=path.with_suffix(path.suffix+f'.attempt{attempt}-{uuid.uuid4().hex[:8]}')
        call=subprocess.run(['curl.exe','--silent','--show-error','--fail-with-body','--connect-timeout','12','--max-time','60',
            '--max-filesize','4000000','--header','Cache-Control: no-cache',task['url'],'--output',str(temporary)],capture_output=True,text=True)
        try:
            if call.returncode:raise ValueError(call.stderr.strip())
            if task['kind']=='full':
                valid=(dt.datetime.fromisoformat(task['runUtc'].replace('Z','+00:00'))+dt.timedelta(hours=task['lead'])).isoformat()
                decode_dap_ascii(temporary,task['runUtc'],valid)
            elif path.suffix=='.nc':
                decoded=decode_netcdf3(temporary)
                if not any(name in decoded['variables'] for name in FIELDS[task['kind']]):raise ValueError('Requested variables missing')
            else:
                payload=json.loads(temporary.read_text())
                entries=payload if isinstance(payload,list) else [payload]
                expected=task.get('expectedPoints',4)
                if len(entries)!=expected:raise ValueError('Unexpected coordinate response count')
                if any(item.get('utc_offset_seconds')!=0 for item in entries):raise ValueError('Expected UTC')
            temporary.replace(path)
            return dict(task,status='OK',sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,retrievedUtc=acquired,attempt=attempt,earlierErrors=errors)
        except (ValueError,KeyError,OSError) as error:
            errors.append(dict(attempt=attempt,error=str(error)[:300],raw=str(temporary),retrievedUtc=acquired))
            if call.returncode==0 or 'error: 400' in call.stderr:
                break  # A schema/URL defect is not repaired by retrying the same data.
            if attempt<3:time.sleep(2*attempt)
    return dict(task,status='ERROR',errors=errors)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--phase',choices=['development','validation'],default='development')
    parser.add_argument('--limit',type=int)
    parser.add_argument('--transport',choices=['ncss','dap'],default='ncss')
    args=parser.parse_args()
    dates=list(date_range('2026-09-01','2026-09-30')) if args.phase=='development' else list(date_range('2026-08-01','2026-08-31'))+list(date_range('2026-10-11','2026-10-20'))
    if args.limit:dates=dates[:args.limit]
    OUT.mkdir(parents=True,exist_ok=True)
    suffix='-dap' if args.transport=='dap' else ''
    manifest=OUT/f'dense-manifest-{args.phase}{suffix}.json'
    old=json.loads(manifest.read_text()) if manifest.exists() else []
    by_url={r['url']:r for r in old}
    for history_path in OUT.glob(f'dense-download-{args.phase}*-attempts.jsonl'):
        for line in history_path.read_text(encoding='utf-8').splitlines():
            record=json.loads(line)
            if record['status']=='OK' or by_url.get(record['url'],{}).get('status')!='OK':by_url[record['url']]=record
    jobs=list(tasks(dates,args.transport));results=[]
    (OUT/'dense-sites.json').write_text(json.dumps(SITES,indent=2),encoding='utf-8')
    print(f'{args.phase}: {len(dates)} dates, {len(jobs)} requests, two bounded workers; observation labels untouched',flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending={pool.submit(fetch,t,by_url.get(t['url'])):t for t in jobs}
        for future in as_completed(pending):
            result=future.result();results.append(result)
            with (OUT/f'dense-download-{args.phase}{suffix}-attempts.jsonl').open('a',encoding='utf-8') as history:
                history.write(json.dumps(result)+'\n')
            manifest.write_text(json.dumps(sorted(results,key=lambda r:r['path']),indent=2),encoding='utf-8')
            print(f'[{len(results)}/{len(jobs)}] {result["date"]} {result.get("lead","")} {result.get("box","")} {result["kind"]} {result["status"]}',flush=True)
    print(f'OK={sum(r["status"]=="OK" for r in results)} ERROR={sum(r["status"]!="OK" for r in results)}',flush=True)
    if any(r['status']!='OK' for r in results):raise SystemExit(1)

if __name__=='__main__':main()
