"""Recover only failed development/validation main-file reads from NOAA bytes."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import threading
import time
from cloudsea_dense_download import RAW, OUT, SITES
from cloudsea_grib_main import prepare_main_tasks, decode_main_ranges
from cloudsea_grib_b import download_b_tasks

LOCK=threading.Lock()

def recover(run,lead,old=None):
    directory=RAW/run[:10].replace('-','')/'native-main'/f'f{lead:03d}'
    path=directory/'points-main.json'
    if old and old['status']=='OK' and path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==old['sha256']:return old
    errors=[]
    for attempt in range(1,4):
        try:
            plan=prepare_main_tasks(run,lead,directory)
            receipts=download_b_tasks(plan['tasks'],parallel=4)
            if not all(r['sourceValidated'] for r in receipts):raise RuntimeError('Native MAIN byte-range validation failed')
            with LOCK:data=decode_main_ranges([r['path'] for r in receipts],run,lead,SITES)
            data.update(plan=plan,receipts=receipts)
            path.write_text(json.dumps(data,indent=2),encoding='utf-8')
            return dict(runUtc=run,lead=lead,status='OK',path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),receipts=receipts,index=plan['index'],attempt=attempt,earlierErrors=errors)
        except (ValueError,RuntimeError,OSError) as error:
            errors.append(dict(attempt=attempt,error=str(error)[:500]))
            if attempt<3:time.sleep(2*attempt)
    return dict(runUtc=run,lead=lead,status='ERROR',errors=errors)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['development','validation'],default='development')
    args=parser.parse_args()
    original=json.loads((OUT/f'dense-manifest-{args.phase}-dap.json').read_text())
    jobs=sorted({(r['runUtc'],r['lead']) for r in original if r['kind']=='full' and r['status']!='OK'})
    target=OUT/f'dense-main-recovery-{args.phase}.json'
    previous=json.loads(target.read_text()) if target.exists() else []
    old={(r['runUtc'],r['lead']):r for r in previous}
    result=[]
    print(f'Exact original MAIN recovery: {len(jobs)} unique run/lead pairs, four-point output, two workers',flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        pending=[pool.submit(recover,run,lead,old.get((run,lead))) for run,lead in jobs]
        for future in as_completed(pending):
            record=future.result();result.append(record)
            with (OUT/f'dense-main-recovery-{args.phase}-attempts.jsonl').open('a',encoding='utf-8') as history:history.write(json.dumps(record)+'\n')
            target.write_text(json.dumps(sorted(result,key=lambda r:(r['runUtc'],r['lead'])),indent=2),encoding='utf-8')
            print(f'[{len(result)}/{len(jobs)}] {record["runUtc"]} f{record["lead"]:03d} {record["status"]}',flush=True)
    if any(r['status']!='OK' for r in result):raise SystemExit(1)

if __name__=='__main__':main()
