"""Bounded, prediction-blind Sonnblick September 2026 public-image cohort.

Raw imagery and labels stay outside Git, under the owner-approved download root.
This module never opens forecast, score, prediction, or validation-period files.
"""
from __future__ import annotations

import argparse
import datetime as dt
from email.utils import parsedate_to_datetime
import hashlib
import io
from itertools import groupby
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
APPROVED = Path('E:/Claude_allow/Download/starphoto-dense-cohort-20261025/camera-development')
VALIDATION = APPROVED/'validation'
HOURS = (8, 11, 14, 17)
BASE = 'https://www.foto-webcam.eu/webcam/sonnblick/'
CREDIT = 'Source: www.foto-webcam.eu | ' + BASE
CAMERA = dict(id='sonnblick', latitude=47.053979, longitude=12.957484,
              elevation_m=3106, heading_degrees=200,
              information_url=BASE+'infos/')


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def cohort_dates(dates: list[dt.date]) -> list[dict]:
    rows = []
    for day in dates:
        for hour in HOURS:
            local = dt.datetime.combine(day, dt.time(hour))
            inferred = local.replace(tzinfo=dt.timezone(dt.timedelta(hours=2)))
            ident = f'sonnblick-{local:%Y%m%d-%H%M}'
            rows.append(dict(id=ident, date=f'{local:%Y-%m-%d}',
                official_local_time_from_filename=f'{local:%Y-%m-%dT%H:%M:00}',
                clock_offset_hypothesis='+02:00',
                expected_utc_slot=inferred.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z'),
                source_url=BASE+f'{local:%Y/%m/%d/%H%M}_la.jpg',
                archive_url=BASE+f'{local:%Y/%m/%d/%H%M}', filename=ident+'.jpg'))
    return rows


def cohort(start_day: int = 1, end_day: int = 30) -> list[dict]:
    """Only the predeclared development month; no validation date argument exists."""
    if not 1 <= start_day <= end_day <= 30:
        raise ValueError('Only September 1-30, 2026 development dates are allowed')
    return cohort_dates([dt.date(2026,9,day) for day in range(start_day,end_day+1)])


def validation_cohort() -> list[dict]:
    dates = ([dt.date(2026,8,day) for day in range(1,32)] +
             [dt.date(2026,10,day) for day in range(11,21)])
    return cohort_dates(dates)


def clock_evidence(last_modified: str | None, expected_utc: str) -> dict:
    """Capture minute is supported only by an agreeing source-server clock.

    Last-Modified is asset write time, not shutter time. Allow 0-120 seconds of
    processing delay. The explicit inferred UTC remains null on missing/mismatch.
    """
    result = dict(clock_status='UNVERIFIED', capture_utc_inferred=None,
                  source_clock_delta_seconds=None,
                  clock_basis='official filename + official HTTP Last-Modified; UTC+02 inference')
    try:
        modified = parsedate_to_datetime(last_modified or '')
        if modified.tzinfo is None:
            return result
        expected = dt.datetime.fromisoformat(expected_utc.replace('Z','+00:00'))
        delta = (modified-expected).total_seconds()
        result['source_clock_delta_seconds'] = delta
        result['last_modified_utc'] = modified.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')
        if 0 <= delta <= 120:
            result.update(clock_status='SOURCE_HEADER_SUPPORTED', capture_utc_inferred=expected_utc)
    except (ValueError, TypeError, OverflowError):
        pass
    return result


def output_root(value: str | Path = APPROVED) -> Path:
    path = Path(value).resolve()
    allowed = APPROVED.resolve()
    if path != allowed and allowed not in path.parents:
        raise ValueError(f'Output must remain under {allowed}')
    return path


def source_identity() -> dict:
    revision = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    return dict(source_git_sha=revision, helper_sha256=sha256(Path(__file__).read_bytes()))


def write_json(path: Path, value) -> None:
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temporary.replace(path)


def download(start_day=1, end_day=30, output=APPROVED, delay=2.0, timeout=30, plan=None) -> list[dict]:
    """One worker, >=2 seconds between requests, at most 120 declared images.

    Resume verifies existing bytes against receipts. An HTTP access gate halts
    immediately. No protected ZIP endpoint, authentication, retries, or fallbacks.
    """
    if delay < 2:
        raise ValueError('Public-source request delay must be at least two seconds')
    out = output_root(output)
    out.mkdir(parents=True,exist_ok=True)
    plan = plan or cohort(start_day,end_day)
    plan_path = out/'predeclared-cohort.json'
    if plan_path.exists() and json.loads(plan_path.read_text(encoding='utf-8')) != plan:
        raise ValueError('Existing predeclared cohort differs; refusing to overwrite')
    write_json(plan_path,plan)
    identity = source_identity()
    (out/('helper-source-'+identity['helper_sha256']+'.py')).write_bytes(Path(__file__).read_bytes())
    manifest_path = out/'manifest.json'
    prior = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else []
    receipts = {row['id']:row for row in prior}
    selected = plan
    last_request = None
    for index, item in enumerate(selected,1):
        path = out/item['filename']
        old = receipts.get(item['id'])
        if old and old.get('status')=='OK' and path.exists() and sha256(path.read_bytes())==old.get('image_sha256'):
            print(f'[{index}/{len(selected)}] verified existing {item["id"]}',flush=True)
            continue
        if last_request is not None:
            time.sleep(max(0,delay-(time.monotonic()-last_request)))
        last_request = time.monotonic()
        row = dict(item,**identity,retrieved_utc=dt.datetime.now(dt.timezone.utc).isoformat(),
                   credit=CREDIT,camera=CAMERA)
        if old:
            row['prior_attempts']=old.get('prior_attempts',[])+[
                {key:old.get(key) for key in ('status','http_status','error','retrieved_utc','helper_sha256')}]
        print(f'[{index}/{len(selected)}] downloading {item["id"]}',flush=True)
        gated = False
        try:
            request = Request(item['source_url'],headers={'User-Agent':'CodexResearchLocalAnalysis/1.0'})
            with urlopen(request,timeout=timeout) as response:
                row.update(http_status=response.status,
                           last_modified=response.headers.get('Last-Modified'),
                           content_type=response.headers.get('Content-Type'),
                           content_length=response.headers.get('Content-Length'),
                           response_date=response.headers.get('Date'))
                if response.geturl()!=item['source_url']:
                    raise ValueError('Unexpected redirect; source identity not verified')
                data = response.read(2_000_001)
                if len(data)>2_000_000:
                    raise ValueError('Preview exceeds the bounded two MB limit')
                if (row['content_type'] or '').split(';')[0].strip()!='image/jpeg':
                    raise ValueError('Response is not a JPEG')
                with Image.open(io.BytesIO(data)) as im:
                    dimensions=list(im.size)
                    im.verify()
                if dimensions != [816,459]:
                    raise ValueError(f'Unexpected preview dimensions {dimensions}')
                row.update(clock_evidence(row['last_modified'],item['expected_utc_slot']))
                row.update(status='OK',image_sha256=sha256(data),bytes=len(data),dimensions=dimensions)
                path.write_bytes(data)
        except HTTPError as error:
            row.update(status='HTTP_ERROR',http_status=error.code,error=str(error),
                       clock_status='UNVERIFIED',capture_utc_inferred=None)
            gated = error.code in (401,403,429)
        except (OSError,URLError,ValueError) as error:
            row.update(status='ERROR',error=str(error),clock_status='UNVERIFIED',capture_utc_inferred=None)
        receipts[item['id']]=row
        write_json(manifest_path,[receipts[key] for key in sorted(receipts)])
        print(f'[{index}/{len(selected)}] {row["status"]} {row.get("clock_status")}',flush=True)
        if gated:
            raise RuntimeError(f'Public-source access gate HTTP {row["http_status"]}; stopped without bypass')
    return [receipts[item['id']] for item in selected]


def contacts(start_day=1,end_day=30,output=APPROVED,plan=None) -> list[Path]:
    """Original aspect ratio, no cropping, source credit on every contact sheet."""
    out=output_root(output)
    receipts={r['id']:r for r in json.loads((out/'manifest.json').read_text(encoding='utf-8'))}
    sheets=[]
    plan = plan or cohort(start_day,end_day)
    for date,items in groupby(plan,key=lambda item:item['date']):
        items=list(items)
        canvas=Image.new('RGB',(1632,1030),'#161616')
        draw=ImageDraw.Draw(canvas)
        draw.text((10,8),CREDIT,fill='white')
        for index,item in enumerate(items):
            x=(index%2)*816;y=35+(index//2)*495
            row=receipts.get(item['id'],{})
            draw.text((x+8,y),f'{item["id"]} LOCAL | {row.get("clock_status","MISSING")}',fill='white')
            path=out/item['filename']
            if row.get('status')=='OK' and path.exists():
                data=path.read_bytes()
                if sha256(data)!=row['image_sha256']:
                    raise ValueError('Image hash differs from receipt')
                with Image.open(io.BytesIO(data)) as im:
                    canvas.paste(im.convert('RGB'),(x,y+22))
            else:
                draw.text((x+20,y+180),'IMAGE UNAVAILABLE = UNKNOWN',fill='white')
        target=out/f'contact-{date.replace("-","")}.jpg'
        canvas.save(target,quality=94)
        sheets.append(target)
    return sheets


def validate_labels(output=APPROVED) -> dict:
    out=output_root(output)
    receipts={r['id']:r for r in json.loads((out/'manifest.json').read_text(encoding='utf-8'))}
    rows=json.loads((out/'labels.json').read_text(encoding='utf-8'))
    seen=set()
    for row in rows:
        ident=row['id']
        if ident in seen or ident not in receipts:
            raise ValueError('Duplicate or unreceipted label')
        seen.add(ident)
        source=receipts[ident]
        if row['image_sha256']!=source.get('image_sha256'):
            raise ValueError('Label hash differs from downloaded image')
        if source['status']=='OK' and sha256((out/source['filename']).read_bytes())!=row['image_sha256']:
            raise ValueError('Actual image bytes differ from label hash')
        if row['label'] not in ('POSITIVE','NEGATIVE','UNKNOWN') or not row.get('reason'):
            raise ValueError('Label or reason invalid')
        if row.get('confidence') not in ('high','medium','low'):
            raise ValueError('Confidence invalid')
        if row.get('prediction_blind') is not True:
            raise ValueError('Prediction-blind declaration missing')
        if row['label']!='UNKNOWN' and (source['status']!='OK' or source['clock_status']!='SOURCE_HEADER_SUPPORTED'):
            raise ValueError('Determinate label requires downloaded image and source-clock support')
    return dict(labels=len(rows),downloaded=len(receipts),
                counts={label:sum(r['label']==label for r in rows) for label in ('POSITIVE','NEGATIVE','UNKNOWN')},
                unlabelled_ids=sorted(set(receipts)-seen))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=('plan','download','contacts','validate-labels',
        'validation-download','validation-contacts','validation-validate-labels'))
    parser.add_argument('--start-day',type=int,default=1)
    parser.add_argument('--end-day',type=int,default=5)
    parser.add_argument('--output')
    parser.add_argument('--delay',type=float,default=2)
    args=parser.parse_args()
    validation = args.action.startswith('validation-')
    plan = validation_cohort() if validation else cohort(args.start_day,args.end_day)
    output = args.output or str(VALIDATION if validation else APPROVED)
    if args.action=='plan':
        print(json.dumps(plan,indent=2))
    elif args.action=='download':
        rows=download(args.start_day,args.end_day,output,args.delay,plan=plan)
        print(json.dumps(dict(requested=len(rows),ok=sum(r['status']=='OK' for r in rows),
            clock_supported=sum(r.get('clock_status')=='SOURCE_HEADER_SUPPORTED' for r in rows))))
    elif args.action=='contacts':
        print('\n'.join(map(str,contacts(args.start_day,args.end_day,output,plan=plan))))
    elif args.action=='validation-download':
        rows=download(output=output,plan=plan,delay=args.delay)
        print(json.dumps(dict(requested=len(rows),ok=sum(r['status']=='OK' for r in rows),
            clock_supported=sum(r.get('clock_status')=='SOURCE_HEADER_SUPPORTED' for r in rows))))
    elif args.action=='validation-contacts':
        print('\n'.join(map(str,contacts(output=output,plan=plan))))
    else:
        print(json.dumps(validate_labels(output),indent=2))


if __name__=='__main__':
    main()
