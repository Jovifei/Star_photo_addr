"""Independent final receipt: public raw matches, frozen choice, preserved reports."""
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'reports/empirical-calibration-20261024'
RAW = Path('E:/Claude_allow/Download/starphoto-empirical-20261024')
UTC = dt.timezone.utc

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    freeze = load(OUT/'candidate-frozen-before-october.json')
    assert digest(OUT/'calibration-train-selection-native.json') == freeze['nativeSelectionSha256']
    assert load(OUT/'october/calibration-train-selection-native.json')['frozenSelectionSha256'] == freeze['nativeSelectionSha256']
    reports = load(ROOT/'reports/cloudsea-release-20261023/original-reports-before.json')
    for row in reports:
        assert digest(ROOT/row['path']) == row['sha256'], row['path']
    public_results = {}
    manifests = []
    for label, directory, count in [('september',OUT,2880),('october_holdout',OUT/'october',960)]:
        public_results[label] = {}
        for version, suffix in [('original',''),('native_candidate','-native')]:
            result = load(directory/f'empirical-results{suffix}.json')
            scores = load(directory/f'forecast-scores{suffix}.json')
            pairs = load(directory/f'paired-hourly{suffix}.json')
            assert len(scores) == len(pairs) == result['planned'] == count
            assert len({(r['site'],r['epoch']) for r in pairs}) == count
            for item in load(directory/f'forecast-manifest{suffix}.json'):
                assert digest(Path(item['path'])) == item['sha256']
                assert item['status']=='OK'
                manifests.append(item)
            public_results[label][version] = dict(planned=result['planned'],paired=result['paired'],
                MWN=result['groups']['MWN_all'],
                localWindows={k:v for k,v in result['localWindows'].items() if '_all_' in k},
                stationCoverage={s:result['groups'][f'{s}_all']['observationMatched'] for s in ['MWN','00722','01358','02290']},
                stationHigh60={s:result['groups'][f'{s}_all']['high60'] for s in ['MWN','00722','01358','02290']})
    # Do not reuse the analysis label helper: directly verify all 34 fresh false alarms.
    with (RAW/'mwn-202610.csv').open(newline='',encoding='utf-8') as handle:
        observations=list(csv.DictReader(handle))
    observed=[]
    for row in observations:
        epoch=int(dt.datetime.strptime(row['valid'],'%Y-%m-%d %H:%M').replace(tzinfo=UTC).timestamp())
        observed.append((epoch,row))
    all_pairs=load(OUT/'october/paired-hourly-native.json')
    high=[r for r in all_pairs if r['site']=='MWN' and r['score'] is not None and r['score']>=60]
    assert len(high)==34
    for row in high:
        epoch, raw=min(observed,key=lambda item:(abs(item[0]-row['epoch']),item[0]))
        assert abs(epoch-row['epoch'])<=1200
        body=raw['metar'].split(' RMK')[0].split()
        # Freezing fog uses FZFG; those cases are independently corroborated by VV.
        assert (float(raw['vsby'])<=.625 and 'FG' in body) or (float(raw['vsby'])<=1 and any(re.fullmatch(r'VV(?:\d{3}|///)', token) for token in body))
        assert row['metar']==raw['metar'] and row['undercast'] is False and row['obstructed'] is True
    assert sum(r['score']>=80 for r in high)==21
    assert all(r['summitWithinUnresolvedCloudTop'] for r in all_pairs if r['score'] is not None and r['score']>=60)
    source_diff=subprocess.check_output(['git','diff','--name-only','--','src','public','package.json','package-lock.json','next.config.ts'],cwd=ROOT,text=True)
    assert not source_diff, source_diff
    examples=[next(r for r in all_pairs if r['site']=='MWN' and r['time'].startswith('2026-10-08T14:')),
              next(r for r in all_pairs if r['site']=='MWN' and r.get('undercast') is True)]
    receipt=dict(status='CANDIDATE_REJECTED_INDEPENDENT_HOLDOUT_FAILED',
        generatedUtc=dt.datetime.now(UTC).isoformat(),sourceRevision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        sourceProductDiffEmpty=True,originalReportsPreserved=len(reports),
        cohort=dict(september='2026-09-01..30 UTC',freshHoldout='2026-10-01..10 UTC',leadHours='24..47',model='gfs_seamless',
                    fixedRuns=len(manifests),sameObservationHoursAcrossVariants=True,underCastEndpoint='MWN human extensive below-summit cloud, not photographic beauty'),
        freeze=freeze, independentFalseAlarmsChecked=34, independentRawDifferences=0,
        results=public_results,examples=examples,
        limitations=['MWN grid changes with elevation=nan; compare whole response pipelines, not single-factor causal mask effect',
                     'DWD recent QN1 formal-only QC; IEM little QC',
                     'Missing and ambiguous labels retained; no score/100 probability calibration',
                     'Few positive weather dates, region/season limited; not China-site acceptance',
                     'All high native candidate hours have unresolved cloud-top/summit interval',
                     'Original code still misses observed events; rejecting candidate does not qualify original algorithm'],
        sources=dict(forecastDocs='https://open-meteo.com/en/docs/single-runs-api',elevationDocs='https://open-meteo.com/en/docs?past_days=1',
                     observationDecoder='https://mountwashington.org/metar-the-secrets-of-weather-decoded/',
                     mwnSeptember=load(RAW/'mwn-provenance.json'),mwnOctober=load(RAW/'mwn-provenance-october.json'),
                     dwd=load(RAW/'dwd-source-manifest.json')))
    target=ROOT/'docs/evidence/EMPIRICAL_CLOUDSEA_CALIBRATION_20261025.json'
    target.write_text(json.dumps(receipt,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(dict(status=receipt['status'],fixedRuns=len(manifests),preserved=len(reports),rawFalseAlarmChecks=len(high),target=str(target)),indent=2))

if __name__=='__main__':
    main()
