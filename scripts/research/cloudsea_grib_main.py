"""Bounded native GFS025 main-file fallback for unavailable GDEX point subsets.

The existing companion decoder validates identical native message/unit/grid/time
contracts. This adapter changes the actual resource and its source attestation,
never the decoded values or the companion-B implementation.
"""
import json
from pathlib import Path

from cloudsea_grib_b import (
    _run_date, _download_directory, _fetch, _cached_source,
    b_url, PROVIDERS, plan_b_ranges, download_b_tasks, decode_b_ranges,
)

RAW = Path('E:/Claude_allow/Download/starphoto-dense-cohort-20261025')
MAIN_LEVELS = (1000,975,950,925,900,850,800,750,700,650,600,550,500)
MAX_BYTES = 96*1024*1024


def main_url(run,lead,index=False,provider='google'):
    # b_url validates the absolute cycle, lead and explicit public NOAA mirror.
    return b_url(run,lead,index,provider).replace('.pgrb2b.0p25.','.pgrb2.0p25.')


def prepare_main_tasks(run,lead,directory=None,levels=MAIN_LEVELS,max_bytes=MAX_BYTES,index_path=None,provider='google'):
    run=_run_date(run)
    directory=_download_directory(directory or RAW/f'{run:%Y%m%d}'/'native-main'/f'f{lead:03d}')
    source_url=main_url(run,lead,index=True,provider=provider)
    if index_path is None:
        index_path=directory/f'main-{run:%Y%m%d%H}-f{lead:03d}-{provider}.idx'
        index_source=_fetch(source_url,index_path)
    else:
        index_path=Path(index_path)
        _download_directory(index_path.parent)
        index_source=_cached_source(source_url,index_path)
        if index_source is None:
            raise ValueError('Supplied main-file index needs its actual validated fetch receipt')
    ranges=plan_b_ranges(index_path.read_text(),run,lead,levels,max_bytes)
    tasks=[dict(entry,url=main_url(run,lead,provider=provider),provider=provider,runUtc=run.isoformat(),leadHours=lead,
        path=str(directory/f'main-{run:%Y%m%d%H}-f{lead:03d}-{entry["start"]}-{entry["end"]}.grib2')) for entry in ranges]
    return dict(index=index_source,provider=provider,levels=list(levels),plannedBytes=sum(r['expectedBytes'] for r in ranges),tasks=tasks)


def decode_main_ranges(paths,run,lead,points,levels=MAIN_LEVELS):
    expected_urls={main_url(run,lead,provider=provider) for provider in PROVIDERS}
    sources=[]
    for path in paths:
        path=Path(path)
        receipt_path=path.with_suffix(path.suffix+'.source.json')
        receipt=json.loads(receipt_path.read_text())
        if receipt.get('url') not in expected_urls:
            raise ValueError('Main-file decoder requires the exact native main product/cycle/lead source')
        # Reuse all hash, length, successful-response and byte-range checks.
        source=_cached_source(receipt['url'],path,receipt['bytes'],receipt['rangeStart'],receipt['rangeEnd'])
        if source is None:
            raise ValueError('Main-file raw/source receipt is missing')
        sources.append(source)
    result=decode_b_ranges(paths,run,lead,points,levels)
    for point in result['points'].values():
        point['sourceMetadata']['provider']='NOAAGFS025pgrb2 main'
        point['sourceMetadata']['sourceUrls']=sorted({source['url'] for source in sources})
    return dict(result,sources=sources)


def fetch_main_points(run,lead,points,directory=None,levels=MAIN_LEVELS,max_bytes=MAX_BYTES,timeout=60,parallel=4,provider='google'):
    plan=prepare_main_tasks(run,lead,directory,levels,max_bytes,provider=provider)
    receipts=download_b_tasks(plan['tasks'],timeout=timeout,parallel=parallel)
    failed=[receipt for receipt in receipts if not receipt['sourceValidated']]
    if failed:
        raise RuntimeError(f'{len(failed)} main-file ranges failed; original partials and receipts retained')
    result=decode_main_ranges([task['path'] for task in plan['tasks']],run,lead,points,levels)
    return dict(result,plan=plan,receipts=receipts)
