"""Download only four native companion pressure levels; preserve range receipts."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import json
from pathlib import Path
import threading
import time
from cloudsea_dense_download import RAW, OUT, SITES, date_range
from cloudsea_grib_b import prepare_b_tasks, download_b_tasks, decode_b_ranges

DECODE_LOCK=threading.Lock()

def fetch_hour(valid,lead,old=None,provider='aws',parallel=1):
    run=valid-dt.timedelta(days=1)
    run_utc=f'{run}T00:00:00Z'
    directory=RAW/f'{run:%Y%m%d}'/'companion-b'/f'f{lead:03d}'
    output=directory/'native-points.json'
    if old and old['status']=='OK' and output.exists() and hashlib.sha256(output.read_bytes()).hexdigest()==old['sha256']:
        return old
    errors=[]
    for attempt in range(1,4):
        try:
            plan=prepare_b_tasks(run_utc,lead,directory,provider=provider)
            receipts=download_b_tasks(plan['tasks'],parallel=parallel)
            if not all(r.get('sourceValidated') for r in receipts):
                raise RuntimeError('Companion range failed validation: '+'; '.join(str(r.get('error') or r.get('stderr')) for r in receipts if not r.get('sourceValidated')))
            with DECODE_LOCK:
                data=decode_b_ranges([r['path'] for r in receipts],run_utc,lead,SITES)
            output.write_text(json.dumps(data,indent=2),encoding='utf-8')
            return dict(date=str(valid),runUtc=run_utc,lead=lead,status='OK',path=str(output),
                sha256=hashlib.sha256(output.read_bytes()).hexdigest(),plannedBytes=plan['plannedBytes'],
                downloadedBytes=sum(r['bytes'] for r in receipts if not r['cached']),receipts=receipts,
                index=plan['index'],attempt=attempt,earlierErrors=errors,requestedProvider=provider,rangeParallelism=parallel)
        except (ValueError,RuntimeError,OSError) as error:
            errors.append(dict(attempt=attempt,error=str(error)[:500],atUtc=dt.datetime.now(dt.timezone.utc).isoformat()))
            if attempt<3:time.sleep(2*attempt)
    return dict(date=str(valid),runUtc=run_utc,lead=lead,status='ERROR',errors=errors)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--phase',choices=['development','validation'],default='development')
    parser.add_argument('--limit',type=int)
    parser.add_argument('--provider',choices=['aws','google','azure'],default='aws')
    parser.add_argument('--parallel',type=int,choices=[1,2,3,4],default=1)
    args=parser.parse_args()
    dates=list(date_range('2026-09-01','2026-09-30')) if args.phase=='development' else list(date_range('2026-08-01','2026-08-31'))+list(date_range('2026-10-11','2026-10-20'))
    if args.limit:dates=dates[:args.limit]
    target=OUT/f'dense-b-manifest-{args.phase}.json'
    history=OUT/f'dense-b-{args.phase}-attempts.jsonl'
    old=json.loads(target.read_text()) if target.exists() else []
    previous={(r['date'],r['lead']):r for r in old}
    if history.exists():
        for line in history.read_text(encoding='utf-8').splitlines():
            r=json.loads(line)
            if r['status']=='OK':previous[(r['date'],r['lead'])]=r
    jobs=[(day,lead) for day in dates for lead in range(24,48,3)]
    results=[]
    print(f'Native companion B: {len(jobs)} forecast hours, four ranges per hour, two workers; labels untouched',flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(fetch_hour,day,lead,previous.get((str(day),lead)),args.provider,args.parallel) for day,lead in jobs]
        for future in as_completed(futures):
            record=future.result();results.append(record)
            with history.open('a',encoding='utf-8') as handle:handle.write(json.dumps(record)+'\n')
            target.write_text(json.dumps(sorted(results,key=lambda r:(r['date'],r['lead'])),indent=2),encoding='utf-8')
            print(f'[{len(results)}/{len(jobs)}] {record["date"]} f{record["lead"]:03d} {record["status"]} newBytes={record.get("downloadedBytes",0)}',flush=True)
    print(f'OK={sum(r["status"]=="OK" for r in results)} ERROR={sum(r["status"]!="OK" for r in results)}',flush=True)
    if any(r['status']!='OK' for r in results):raise SystemExit(1)

if __name__=='__main__':main()
