"""Bounded NOAA GFS025 companion-B byte ranges and native point extraction.

Planning/downloading uses only the standard library and curl. Decoding lazily
imports ecCodes from the isolated weather-calibration environment. No global
packages, approximate vertical interpolation or missing-value filling.
"""
from collections import Counter
from datetime import datetime, timezone, timedelta
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlsplit

BRIDGE_LEVELS = (875,825,775,725)
INDEX_FIELDS = ('HGT','TMP','RH','TCDC')
NATIVE_UNITS = {'gh':'gpm','t':'K','r':'%','tcc':'%'}
OUTPUT_FIELDS = {'gh':'geopotential_height','t':'temperature','r':'relative_humidity','tcc':'cloud_cover'}
APPROVED_DOWNLOAD_ROOT = Path('E:/Claude_allow/Download')
PROVIDERS = {
    'aws':'https://noaa-gfs-bdp-pds.s3.amazonaws.com/',
    'google':'https://storage.googleapis.com/global-forecast-system/',
    'azure':'https://noaagfs.blob.core.windows.net/gfs/',
}


def _run_date(value):
    date=datetime.fromisoformat(value.replace('Z','+00:00')) if isinstance(value,str) else value
    if date.tzinfo is None:
        raise ValueError('GFS reference time must be absolute')
    date=date.astimezone(timezone.utc)
    if date.minute or date.second or date.microsecond or date.hour not in (0,6,12,18):
        raise ValueError('Expected an exact native GFS initialization cycle')
    return date


def b_url(run,lead,index=False,provider='aws'):
    run=_run_date(run)
    if not isinstance(lead,int) or not 0<=lead<=384:
        raise ValueError('Invalid native GFS forecast lead')
    if provider not in PROVIDERS:
        raise ValueError('Expected an explicitly supported NOAA dissemination provider')
    return (f'{PROVIDERS[provider]}gfs.{run:%Y%m%d}/{run:%H}/atmos/'
            f'gfs.t{run:%H}z.pgrb2b.0p25.f{lead:03d}'+('.idx' if index else ''))


def canonical_b_resource_key(url):
    """Whitelist only the public NOAA mirror paths for this exact GRIB product."""
    try:
        parsed=urlsplit(url)
        if parsed.scheme!='https' or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.port not in (None,443):
            return None
        key=None
        for prefix in PROVIDERS.values():
            known=urlsplit(prefix)
            if parsed.hostname==known.hostname and parsed.path.startswith(known.path):
                key=parsed.path[len(known.path):]
                break
        match=re.fullmatch(r'gfs\.(\d{8})/(\d{2})/atmos/gfs\.t(\d{2})z\.pgrb2b\.0p25\.f(\d{3})(?:\.idx)?',key or '')
        if not match or match[2]!=match[3] or int(match[4])>384:
            return None
        _run_date(datetime.strptime(match[1]+match[2],'%Y%m%d%H').replace(tzinfo=timezone.utc))
        return key
    except (ValueError,TypeError):
        return None


def plan_b_ranges(index_text,run,lead,levels=BRIDGE_LEVELS,max_bytes=32*1024*1024):
    """Select four native fields, merge only truly contiguous wanted messages."""
    run=_run_date(run)
    records=[]
    for line in index_text.splitlines():
        if not line.strip():
            continue
        parts=line.split(':')
        if len(parts)<6:
            raise ValueError('Malformed NOAA GRIB inventory')
        records.append(dict(offset=int(parts[1]),cycle=parts[2],field=parts[3],level=parts[4],forecast=parts[5]))
    if any(a['offset']>=b['offset'] for a,b in zip(records,records[1:])):
        raise ValueError('NOAA GRIB inventory offsets are not strictly increasing')
    selected=[]
    for i,row in enumerate(records):
        match=re.fullmatch(r'(\d+) mb',row['level'])
        if row['field'] not in INDEX_FIELDS or not match or int(match[1]) not in levels:
            continue
        if row['cycle']!=f'd={run:%Y%m%d%H}' or row['forecast']!=(f'{lead} hour fcst' if lead else 'anl'):
            raise ValueError('NOAA inventory cycle or valid lead mismatch')
        if i+1==len(records):
            raise ValueError('Cannot bound the final GRIB message without object length')
        selected.append(dict(field=row['field'],level=int(match[1]),start=row['offset'],end=records[i+1]['offset']-1))
    expected={(field,level) for field in INDEX_FIELDS for level in levels}
    counts=Counter((r['field'],r['level']) for r in selected)
    if set(counts)!=expected or any(count!=1 for count in counts.values()):
        raise ValueError('Missing or duplicate requested native B-file messages')
    ranges=[]
    for message in selected:
        if ranges and message['start']==ranges[-1]['end']+1:
            ranges[-1]['end']=message['end'];ranges[-1]['messages'].append(message)
        else:
            ranges.append(dict(start=message['start'],end=message['end'],messages=[message]))
    for entry in ranges:
        entry['expectedBytes']=entry['end']-entry['start']+1
    if sum(r['expectedBytes'] for r in ranges)>max_bytes:
        raise ValueError('Selected companion-B data exceeds the declared byte budget')
    return ranges


def _download_directory(directory):
    path=Path(directory).resolve()
    if not path.is_relative_to(APPROVED_DOWNLOAD_ROOT.resolve()):
        raise ValueError('Raw downloads must remain in E:/Claude_allow/Download')
    path.mkdir(parents=True,exist_ok=True)
    return path


def _cached_source(url,target,expected_bytes=None,start=None,end=None):
    target=Path(target)
    metadata_path=target.with_suffix(target.suffix+'.source.json')
    if target.exists():
        if not metadata_path.exists():
            raise ValueError(f'Existing raw file has no source receipt; preserved: {target}')
        metadata=json.loads(metadata_path.read_text())
        actual=target.read_bytes()
        old_key,new_key=canonical_b_resource_key(metadata['url']),canonical_b_resource_key(url)
        mirror_reuse=(start is not None and old_key is not None and old_key==new_key and not old_key.endswith('.idx'))
        if (metadata['url']!=url and not mirror_reuse) or hashlib.sha256(actual).hexdigest()!=metadata['sha256'] or len(actual)!=metadata['bytes']:
            raise ValueError(f'Existing raw file/source identity changed; preserved: {target}')
        if not metadata.get('sourceValidated') or metadata.get('rangeStart')!=start or metadata.get('rangeEnd')!=end:
            raise ValueError('Cached source status or byte-range identity mismatch')
        if expected_bytes is not None and metadata['bytes']!=expected_bytes:
            raise ValueError('Cached raw range length mismatch')
        if metadata['url']!=url:
            # Keep the actual original source URL and its on-disk receipt.
            return dict(metadata,cached=True,requestedUrl=url,cacheSourceEquivalent=True,canonicalResourceKey=new_key)
        return dict(metadata,cached=True)
    return None


def _new_attempt(url,target,expected_bytes=None,start=None,end=None):
    target=Path(target)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    partial=target.with_name(target.name+f'.attempt-{stamp}.part')
    headers=partial.with_suffix('.headers')
    return dict(url=url,target=target,partial=partial,headers=headers,expectedBytes=expected_bytes,
                start=start,end=end,fetched=datetime.now(timezone.utc).isoformat())


def _curl_segment(attempt,timeout,write_out):
    command=['--silent','--show-error','--fail-with-body','--connect-timeout','10',
             '--max-time',str(timeout),'--max-filesize',str(attempt['expectedBytes'] or 1024*1024),
             '--dump-header',str(attempt['headers']),'--write-out',write_out,
             '--url',attempt['url'],'--output',str(attempt['partial'])]
    if attempt['start'] is not None:
        command[0:0]=['--header',f'Range: bytes={attempt["start"]}-{attempt["end"]}']
    return command


def _finish_attempt(attempt,exit_code,http_time_bytes,stderr,**details):
    target,partial,headers=attempt['target'],attempt['partial'],attempt['headers']
    start,end,expected_bytes=attempt['start'],attempt['end'],attempt['expectedBytes']
    data=partial.read_bytes() if partial.exists() else b''
    header_text=headers.read_text() if headers.exists() else ''
    status=http_time_bytes.split('|')[0]
    valid=(exit_code==0 and status==('206' if start is not None else '200'))
    if start is not None:
        valid=valid and len(data)==expected_bytes and bool(re.search(rf'content-range:\s*bytes {start}-{end}/\d+',header_text,re.I))
        valid=valid and data.startswith(b'GRIB') and data.endswith(b'7777')
    metadata=dict(url=attempt['url'],path=str(target),retrievedUtc=attempt['fetched'],curlExit=exit_code,
        httpTimeBytes=http_time_bytes,stderr=stderr,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),
        rangeStart=start,rangeEnd=end,sourceValidated=valid,attemptPath=str(partial),headersPath=str(headers),cached=False,**details)
    metadata['canonicalResourceKey']=canonical_b_resource_key(attempt['url'])
    partial.with_suffix('.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    if not valid:
        return dict(metadata,error=f'Download failed; retained {partial}')
    # No old raw file is replaced; a valid cache would have returned above.
    partial.rename(target)
    target.with_suffix(target.suffix+'.source.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    return metadata


def _fetch(url,target,expected_bytes=None,start=None,end=None,timeout=60):
    """One attempt. Caller owns bounded retries; every partial/header is retained."""
    cached=_cached_source(url,target,expected_bytes,start,end)
    if cached is not None:
        return cached
    attempt=_new_attempt(url,target,expected_bytes,start,end)
    command=['curl.exe',*_curl_segment(attempt,timeout,'%{http_code}|%{time_total}|%{size_download}')]
    result=subprocess.run(command,capture_output=True,text=True)
    metadata=_finish_attempt(attempt,result.returncode,result.stdout,result.stderr)
    if not metadata['sourceValidated']:
        raise RuntimeError(f'Companion-B download failed; retained {attempt["partial"]}: {result.stdout} {result.stderr}')
    return metadata


def prepare_b_tasks(run,lead,directory,levels=BRIDGE_LEVELS,max_bytes=32*1024*1024,index_path=None,provider='aws'):
    directory=_download_directory(directory)
    run=_run_date(run)
    source_url=b_url(run,lead,index=True,provider=provider)
    if index_path is None:
        index_path=directory/f'b-{run:%Y%m%d%H}-f{lead:03d}-{provider}.idx'
        index_source=_fetch(source_url,index_path)
    else:
        index_path=Path(index_path)
        if provider!='aws':
            receipt_path=index_path.with_suffix(index_path.suffix+'.source.json')
            if not receipt_path.exists():
                raise ValueError('Externally supplied mirror index needs its actual fetch receipt')
            _cached_source(source_url,index_path)
        index_source=dict(url=source_url,path=str(index_path),
                          sha256=hashlib.sha256(index_path.read_bytes()).hexdigest(),externallyFetched=True)
    ranges=plan_b_ranges(index_path.read_text(),run,lead,levels,max_bytes)
    tasks=[]
    for entry in ranges:
        tasks.append(dict(entry,url=b_url(run,lead,provider=provider),provider=provider,runUtc=run.isoformat(),leadHours=lead,
            path=str(directory/f'b-{run:%Y%m%d%H}-f{lead:03d}-{entry["start"]}-{entry["end"]}.grib2')))
    return dict(index=index_source,provider=provider,levels=list(levels),plannedBytes=sum(r['expectedBytes'] for r in ranges),tasks=tasks)


def download_b_task(task,timeout=60):
    _download_directory(Path(task['path']).parent)
    return _fetch(task['url'],task['path'],task['expectedBytes'],task['start'],task['end'],timeout)


def download_b_tasks(tasks,timeout=60,parallel=1):
    """ONE curl process: default TLS reuse or bounded concurrent ranges.

    Each transfer has its own deadline, output, headers, exit code and receipt.
    No --fail-early: one network failure must not discard other valid ranges.
    The caller checks every sourceValidated flag and owns bounded retries.
    """
    if not isinstance(parallel,int) or not 1<=parallel<=4:
        raise ValueError('Companion-B batch parallelism must be between one and four')
    if len({str(Path(t['path']).resolve()) for t in tasks})!=len(tasks):
        raise ValueError('Duplicate target paths in a B-file transfer batch')
    receipts=[None]*len(tasks);active={};command=['curl.exe']
    if parallel>1:
        command.extend(['--parallel','--parallel-max',str(parallel),'--parallel-immediate'])
    for position,task in enumerate(tasks):
        _download_directory(Path(task['path']).parent)
        cached=_cached_source(task['url'],task['path'],task['expectedBytes'],task['start'],task['end'])
        if cached is not None:
            receipts[position]=cached
            continue
        attempt=_new_attempt(task['url'],task['path'],task['expectedBytes'],task['start'],task['end'])
        if active:
            command.append('--next')
        active[position]=attempt
        write_out=f'{position}|%{{http_code}}|%{{time_total}}|%{{size_download}}|%{{exitcode}}|%{{num_connects}}|%{{time_starttransfer}}\n'
        command.extend(_curl_segment(attempt,timeout,write_out))
    if not active:
        return receipts
    result=subprocess.run(command,capture_output=True,text=True)
    transfer_results={}
    for line in result.stdout.splitlines():
        parts=line.split('|')
        if len(parts)>=5 and parts[0].isdigit() and int(parts[0]) in active:
            position=int(parts[0])
            if position in transfer_results:
                transfer_results[position]=None
                continue
            try:
                code=int(parts[4])
            except ValueError:
                transfer_results[position]=None
                continue
            try:
                connects=int(parts[5]) if len(parts)>5 else None
            except ValueError:
                connects=None
            try:
                ttfb=float(parts[6]) if len(parts)>6 else None
                if ttfb is not None and (not math.isfinite(ttfb) or ttfb<0):ttfb=None
            except ValueError:
                ttfb=None
            transfer_results[position]=(code,'|'.join(parts[1:4]),connects,ttfb)
    for position,attempt in active.items():
        transfer=transfer_results.get(position)
        exit_code,stats,connects,ttfb=transfer if transfer is not None else (result.returncode or 99,'000|0|0',None,None)
        receipts[position]=_finish_attempt(attempt,exit_code,stats,result.stderr,batchPosition=position,
            batchProcessExit=result.returncode,numConnects=connects,timeStartTransferSeconds=ttfb,
            batchParallelism=parallel,transferResultMissing=transfer is None)
    return receipts


def validate_b_metadata(metadata,run,lead,levels=BRIDGE_LEVELS):
    run=_run_date(run);valid=run+timedelta(hours=lead)
    short=metadata.get('shortName')
    if short not in NATIVE_UNITS or metadata.get('units')!=NATIVE_UNITS[short]:
        raise ValueError('Unexpected B-file variable or native units')
    level=metadata.get('level')
    if metadata.get('typeOfLevel')=='isobaricInPa':
        level=level/100
    elif metadata.get('typeOfLevel')!='isobaricInhPa':
        raise ValueError('Expected a native isobaric GRIB message')
    if level not in levels:
        raise ValueError('Unexpected companion-B pressure level')
    if (metadata.get('edition')!=2 or metadata.get('dataDate')!=int(run.strftime('%Y%m%d'))
        or metadata.get('dataTime')!=run.hour*100 or metadata.get('validityDate')!=int(valid.strftime('%Y%m%d'))
        or metadata.get('validityTime')!=valid.hour*100 or metadata.get('stepType')!='instant'
        or float(metadata.get('endStep',-1))!=lead):
        raise ValueError('Native GRIB reference, step or valid time mismatch')
    if (metadata.get('gridType')!='regular_ll' or metadata.get('Ni')!=1440 or metadata.get('Nj')!=721
        or metadata.get('iDirectionIncrementInDegrees')!=.25 or metadata.get('jDirectionIncrementInDegrees')!=.25
        or metadata.get('latitudeOfFirstGridPointInDegrees')!=90 or metadata.get('longitudeOfFirstGridPointInDegrees')!=0):
        raise ValueError('Expected the original regular global GFS025 grid')
    return short,int(level)


def normalize_grib_value(short,value,missing):
    if not math.isfinite(value) or (missing is not None and value==missing):
        return None
    if short=='t':
        value=value-273.15
        return value if -150<=value<=80 else None
    if short in ('r','tcc'):
        value=round(value,6)  # Remove binary packing epsilon, not invalid percentages.
        return value if 0<=value<=100 else None
    if short=='gh':
        if not -1500<=value<=50000:
            return None
        radius=6356766.0
        return radius*value/(radius-value)
    raise ValueError('Unknown GRIB field')


def decode_b_ranges(paths,run,lead,points,levels=BRIDGE_LEVELS):
    """Decode each global message once and extract all requested native cells."""
    import eccodes as ec
    run=_run_date(run);valid=run+timedelta(hours=lead)
    if len({p['id'] for p in points})!=len(points) or not points:
        raise ValueError('Expected nonempty unique point identifiers')
    for point in points:
        if not math.isfinite(point['latitude']) or not -90<=point['latitude']<=90 or not math.isfinite(point['longitude']) or not -180<=point['longitude']<=180:
            raise ValueError('Illegal requested point coordinates')
    started=time.monotonic();output={};messages=[];seen=set()
    keys=['shortName','units','typeOfLevel','level','edition','dataDate','dataTime','validityDate','validityTime',
          'stepType','endStep','gridType','Ni','Nj','iDirectionIncrementInDegrees','jDirectionIncrementInDegrees',
          'latitudeOfFirstGridPointInDegrees','longitudeOfFirstGridPointInDegrees']
    for path in paths:
        with Path(path).open('rb') as handle:
            while (message:=ec.codes_grib_new_from_file(handle)) is not None:
                try:
                    metadata={key:ec.codes_get(message,key) for key in keys}
                    short,level=validate_b_metadata(metadata,run,lead,levels)
                    if (short,level) in seen:
                        raise ValueError('Duplicate native field/pressure message')
                    seen.add((short,level));messages.append(metadata)
                    missing=ec.codes_get(message,'missingValue')
                    for point in points:
                        nearest=dict(ec.codes_grib_find_nearest(message,point['latitude'],point['longitude'],npoints=1)[0])
                        lat,lon,index=nearest['lat'],nearest['lon'],nearest['index']
                        if abs(lat-point['latitude'])>.126 or abs((lon-point['longitude']+180)%360-180)>.126:
                            raise ValueError('GRIB nearest point is outside the requested GFS025 cell')
                        expected_index=round((90-lat)*4)*1440+round((lon%360)*4)
                        if index!=expected_index:
                            raise ValueError('Nearest value and original global grid index disagree')
                        if point['id'] not in output:
                            output[point['id']]=dict(latitude=lat,longitude=(lon+180)%360-180,gridIndex=index,
                                hourly={'time':[int(valid.timestamp())]},hourly_units={'time':'unixtime'},
                                sourceMetadata=dict(provider='NOAA GFS025 pgrb2b',runUtc=run.isoformat(),validUtc=valid.isoformat(),
                                    nativeUnits=NATIVE_UNITS,nearestDistanceKm=nearest['distance'],
                                    heightConversion='native gpm -> geometric m, radius6356766',missingFields=[]))
                        target=output[point['id']]
                        if target['latitude']!=lat or target['longitude']!=(lon+180)%360-180 or target['gridIndex']!=index:
                            raise ValueError('Native B-file fields resolved to different cells')
                        field=f'{OUTPUT_FIELDS[short]}_{level}hPa'
                        value=normalize_grib_value(short,nearest['value'],missing)
                        target['hourly'][field]=[value]
                        target['hourly_units'][field]={'gh':'m','t':'°C','r':'%','tcc':'%'}[short]
                        if value is None:target['sourceMetadata']['missingFields'].append(field)
                finally:
                    ec.codes_release(message)
    if seen!={(short,level) for short in NATIVE_UNITS for level in levels}:
        raise ValueError('Missing native companion-B messages; no profile was fabricated')
    return dict(points=output,messages=messages,eccodesVersion=ec.codes_get_api_version(),decodeSeconds=time.monotonic()-started)
