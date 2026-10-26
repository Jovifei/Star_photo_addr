"""Join attested native 3-hour GFS025 profiles to fixed-run GFS013 surface."""
import argparse
from collections import defaultdict
import datetime as dt
import hashlib
import json
from pathlib import Path
from cloudsea_ncss import decode_netcdf3, merge_ncss_subsets, normalize_ncss_point
from cloudsea_dap import decode_dap_ascii
from cloudsea_dense_download import OUT, SITES

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['development','validation'],default='development')
    parser.add_argument('--with-b',action='store_true')
    args=parser.parse_args()
    manifest=[]
    for path in OUT.glob(f'dense-manifest-{args.phase}*.json'):manifest.extend(json.loads(path.read_text()))
    b_manifest_path=OUT/f'dense-b-manifest-{args.phase}.json'
    b_manifest=json.loads(b_manifest_path.read_text()) if args.with_b and b_manifest_path.exists() else []
    b_hours={(r['date'],r['lead']):r for r in b_manifest if r['status']=='OK'}
    main_path=OUT/f'dense-main-recovery-{args.phase}.json'
    main_records=json.loads(main_path.read_text()) if main_path.exists() else []
    main_hours={(r['runUtc'][:10],r['lead']):r for r in main_records if r['status']=='OK'}
    by_date=defaultdict(list)
    for record in manifest:by_date[record['date']].append(record)
    assembled=[];errors=[]
    for date,records in sorted(by_date.items()):
        successful={}
        for r in records:
            if r['status']!='OK':continue
            path=Path(r['path'])
            if hashlib.sha256(path.read_bytes()).hexdigest()!=r['sha256']:raise ValueError('Raw hash mismatch')
            successful[(r['kind'],r.get('box'),r.get('lead'))]=r
        source=successful.get(('surface',None,None));terrain=successful.get(('terrain',None,None))
        if not source or not terrain:
            errors.append(dict(date=date,error='missing surface or native terrain'))
            continue
        surfaces=json.loads(Path(source['path']).read_text());terrains=json.loads(Path(terrain['path']).read_text())
        run=source['runUtc']
        if run!=terrain['runUtc']:raise ValueError('Surface/native-grid run mismatch')
        groups={}
        for lead in range(24,48,3):
            valid=(dt.datetime.fromisoformat(run.replace('Z','+00:00'))+dt.timedelta(hours=lead)).isoformat()
            for box in ('MWN','DE'):
                full=successful.get(('full',box,lead))
                group=[full] if full else [successful.get((kind,box,lead)) for kind in ('profile','cloud')]
                if not all(group):
                    errors.append(dict(date=date,lead=lead,box=box,error='missing native profile subset'))
                    continue
                if any(r['runUtc']!=run for r in group):raise ValueError('NCSS source run mismatch')
                decoded=decode_dap_ascii(full['path'],run,valid) if full else merge_ncss_subsets(*(decode_netcdf3(r['path']) for r in group))
                groups[(box,lead)]=(decoded,valid,[r['sha256'] for r in group])
        for si,site in enumerate(SITES):
            surface=surfaces[si];terrain=terrains[si]
            if surface.get('hourly_units',{}).get('wind_speed_10m')!='m/s':raise ValueError('Surface wind units')
            box='MWN' if site['id']=='MWN' else 'DE'
            hours=[]
            for lead in range(24,48,3):
                item=groups.get((box,lead))
                if item:
                    decoded,valid,raw_hashes=item
                    normalized=normalize_ncss_point(decoded,site['latitude'],site['longitude'],run,valid)
                else:
                    recovered=main_hours.get((run[:10],lead))
                    if not recovered:continue
                    path=Path(recovered['path'])
                    if hashlib.sha256(path.read_bytes()).hexdigest()!=recovered['sha256']:raise ValueError('Recovered MAIN hash mismatch')
                    point=json.loads(path.read_text())['points'][site['id']]
                    normalized=dict(point,elevation=terrain['elevation'],timezone='UTC',utc_offset_seconds=0)
                    raw_hashes=[recovered['sha256']]
                # NCSS raw file has the exact 0.25-degree pressure grid. API
                # terrain metadata is requested independently for that domain.
                if abs(normalized['latitude']-terrain['latitude'])>1e-5 or abs(normalized['longitude']-terrain['longitude'])>1e-5:
                    raise ValueError(f'Pressure native grid mismatch {site["id"]}')
                if normalized['elevation'] is None:normalized['elevation']=terrain['elevation']
                if abs(normalized['elevation']-terrain['elevation'])>3:raise ValueError('Native orography/metadata mismatch')
                if args.with_b:
                    bridge=b_hours.get((date,lead))
                    if not bridge:
                        errors.append(dict(date=date,lead=lead,site=site['id'],error='missing native companion-B'))
                        continue
                    bridge_path=Path(bridge['path'])
                    if hashlib.sha256(bridge_path.read_bytes()).hexdigest()!=bridge['sha256']:raise ValueError('Companion-B normalized hash changed')
                    b=json.loads(bridge_path.read_text())['points'][site['id']]
                    if b['latitude']!=normalized['latitude'] or b['longitude']!=normalized['longitude'] or b['hourly']['time']!=normalized['hourly']['time']:
                        raise ValueError('Main/companion native grid or time mismatch')
                    normalized['hourly'].update({k:v for k,v in b['hourly'].items() if k!='time'})
                    normalized['hourly_units'].update(b['hourly_units'])
                    raw_hashes=raw_hashes+[bridge['sha256']]
                epoch=normalized['hourly']['time'][0]
                indices=[i for i,t in enumerate(surface['hourly']['time']) if t==epoch]
                if len(indices)!=1:raise ValueError('Surface does not contain exact absolute pressure time')
                index=indices[0]
                expected=int(dt.datetime.fromisoformat(run.replace('Z','+00:00')).timestamp())+lead*3600
                if epoch!=expected or not normalized['sourceMetadata']['validUtc'].startswith(date):raise ValueError('Run/valid UTC mismatch')
                # Use all six fields from one surface domain; never mix
                # per-field models, times or interpolated missing observations.
                for field in ['cloud_cover_low','cloud_cover_mid','cloud_cover_high','relative_humidity_2m','wind_speed_10m','precipitation']:
                    normalized['hourly'][field]=[surface['hourly'][field][index]]
                    normalized['hourly_units'][field]=surface['hourly_units'][field]
                normalized['sourceMetadata']['missingFields']=[k for k,v in normalized['hourly'].items() if k!='time' and v[0] is None]
                normalized['sourceMetadata']['surfaceModel']='ncep_gfs013'
                hours.append(dict(lead=lead,raw=normalized,rawHashes=raw_hashes,
                    surfaceGrid=dict(providerModel='ncep_gfs013',latitude=surface['latitude'],longitude=surface['longitude'],elevation=surface['elevation']),
                    pressureGrid=dict(providerModel='ncep_gfs025',latitude=terrain['latitude'],longitude=terrain['longitude'],elevation=normalized['elevation']),
                    surfaceSourceSha256=source['sha256'],terrainSourceSha256=successful[('terrain',None,None)]['sha256']))
            assembled.append(dict(date=date,runUtc=run,site=site,hours=hours))
    output=OUT/f'dense-inputs-{args.phase}{"-b" if args.with_b else ""}.json'
    output.write_text(json.dumps(dict(records=assembled,missing=errors,qualification='FIXED_RUN_NATIVE_3H_NOT_HOURLY_INTERPOLATION'),indent=2),encoding='utf-8')
    print(json.dumps(dict(siteDates=len(assembled),scorableSourceHours=sum(len(r['hours']) for r in assembled),missingGroups=len(errors),output=str(output))))

if __name__=='__main__':main()
