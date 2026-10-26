"""Fixed, outcome-blind September cohort. Raw public downloads stay on approved E: path."""
import datetime as dt
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[2]
RAW = Path('E:/Claude_allow/Download/starphoto-empirical-20261024')
OUT = ROOT / 'reports/empirical-calibration-20261024'
SITES = [
    dict(id='MWN', name='Mount Washington', latitude=44.2708, longitude=-71.3035, altitude=1910, timezone='America/New_York', source='IEM NH_ASOS MWN'),
    dict(id='00722', name='Brocken', latitude=51.7986, longitude=10.6183, altitude=1135, timezone='Europe/Berlin', source='DWD CDC visibility station list'),
    dict(id='01358', name='Fichtelberg', latitude=50.4285, longitude=12.9534, altitude=1213, timezone='Europe/Berlin', source='DWD CDC visibility station list'),
    dict(id='02290', name='Hohenpeissenberg', latitude=47.8009, longitude=11.0108, altitude=977, timezone='Europe/Berlin', source='DWD CDC visibility station list'),
]
LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500]
FIELDS = ['relative_humidity_2m', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'precipitation', 'wind_speed_10m'] + [
    f'{field}_{level}hPa' for level in LEVELS
    for field in ['cloud_cover', 'relative_humidity', 'temperature', 'geopotential_height']
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--native', action='store_true', help='Separate diagnostic: elevation=nan (native grid height), not product behavior')
    parser.add_argument('--limit', type=int, default=30)
    parser.add_argument('--october', action='store_true', help='Fresh 10-day holdout, never used to select September candidate')
    args = parser.parse_args()
    out = OUT / 'october' if args.october else OUT
    RAW.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'sites.json').write_text(json.dumps(SITES, indent=2), encoding='utf-8')
    suffix = '-native' if args.native else ''
    manifest_path = out / f'forecast-manifest{suffix}.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    manifest = []
    count = min(args.limit, 10) if args.october else args.limit
    for day in range(count):
        valid = dt.date(2026, 10 if args.october else 9, 1) + dt.timedelta(days=day)
        run = valid - dt.timedelta(days=1)
        filename = RAW / f'gfs-{run:%Y%m%d}-00-4sites{suffix}.json'
        params = dict(latitude=','.join(str(s['latitude']) for s in SITES), longitude=','.join(str(s['longitude']) for s in SITES),
                      models='gfs_seamless', run=f'{run}T00:00', forecast_hours=48, hourly=','.join(FIELDS),
                      timezone='UTC', timeformat='unixtime', wind_speed_unit='ms')
        if args.native:
            params['elevation'] = ','.join('nan' for _ in SITES)
        url = 'https://single-runs-api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode(params)
        prior = next((r for r in old if r['url'] == url and r['status'] == 'OK'), None)
        if prior and filename.exists() and hashlib.sha256(filename.read_bytes()).hexdigest() == prior['sha256']:
            row = prior
        else:
            acquired = dt.datetime.now(dt.timezone.utc).isoformat()
            print(f'[{day+1}/{count}] downloading {valid}', flush=True)
            result = subprocess.run(['curl.exe', '--silent', '--show-error', '--fail-with-body', '--retry', '2', '--retry-all-errors', '--retry-delay', '2', '--connect-timeout', '15', '--max-time', '60', url, '--output', str(filename)], capture_output=True, text=True)
            data = filename.read_bytes() if filename.exists() else b''
            row = dict(url=url, path=str(filename), runUtc=f'{run}T00:00:00Z', validDate=str(valid), retrievedUtc=acquired,
                       status='OK' if result.returncode == 0 else 'ERROR', exit=result.returncode,
                       stderr=result.stderr[:400], bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            if result.returncode == 0:
                try:
                    payload = json.loads(data)
                    if not isinstance(payload, list) or len(payload) != len(SITES):
                        raise ValueError('Expected exactly four site responses')
                    for site, response in zip(SITES, payload):
                        if abs(response['latitude'] - site['latitude']) > .3 or abs(response['longitude'] - site['longitude']) > .3:
                            raise ValueError('Returned grid coordinate mismatch')
                        if response.get('timezone') not in ['GMT', 'UTC'] or response.get('utc_offset_seconds') != 0:
                            raise ValueError('Expected UTC response')
                except (ValueError, KeyError) as error:
                    row['status'] = 'INVALID'
                    row['error'] = str(error)
        manifest.append(row)
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        with (out / f'forecast-download-attempts{suffix}.jsonl').open('a', encoding='utf-8') as history:
            history.write(json.dumps(row) + '\n')
        print(f'[{day+1}/{count}] {valid} {row["status"]} {row["bytes"]} bytes', flush=True)
    if any(row['status'] != 'OK' for row in manifest):
        raise SystemExit('Some exact runs failed; failures retained, no silent date substitution')

if __name__ == '__main__':
    main()
