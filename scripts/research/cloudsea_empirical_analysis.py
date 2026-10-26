"""Independent summit observation pairing and train-only selection; no product edits."""
from collections import Counter, defaultdict
import csv
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import random
import re
import zipfile
import argparse
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
RAW = Path('E:/Claude_allow/Download/starphoto-empirical-20261024')
OUT = ROOT / 'reports/empirical-calibration-20261024'
START = int(dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc).timestamp())
END = int(dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc).timestamp())
PERIOD = '202609'

def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result != -999 else None
    except (ValueError, TypeError):
        return None

def mwn_label(row):
    """MWN-only /// convention. No generic METAR or RMK interpretation."""
    body = row.get('metar', '').split(' RMK')[0]
    tokens = body.split()
    visibility = number(row.get('vsby'))
    if visibility is None or visibility < 0:
        return dict(undercast=None, obstructed=None, reason='missing_visibility')
    clouds = re.findall(r'\b(FEW|SCT|BKN|OVC)(///|\d{3})(?:CB|TCU)?\b', body)
    # Word boundary does not follow '/', so handle those groups separately.
    below = re.findall(r'(?<!\S)(FEW|SCT|BKN|OVC)///(?=\s|$)', body)
    fog_any = any(re.fullmatch(r'[+-]?(?:[A-Z]{2})?FG', t) for t in tokens)
    vertical = any(re.fullmatch(r'VV(?:\d{3}|///)', t) for t in tokens)
    at_station = any(height == '000' for _, height in clouds)
    obscured = ('FG' in tokens and visibility <= .625) or (vertical and visibility <= 1)
    clear_view = visibility >= 10 and not fog_any and not vertical and not at_station
    extensive = any(x in ('BKN', 'OVC') for x in below)
    if obscured:
        target, reason = False, 'summit_obscured'
    elif clear_view and extensive:
        target, reason = True, 'extensive_below_summit'
    elif clear_view and ('SKC' in tokens or (below and not extensive)):
        target, reason = False, 'clear_or_only_sparse_below'
    else:
        target, reason = None, 'ambiguous_or_unreported_below'
    return dict(undercast=target, obstructed=True if obscured else False if clear_view else None,
                reason=reason, visibilityM=visibility * 1609.344, visibilitySM=visibility,
                below=below, metar=row.get('metar', ''))

def mwn_observations():
    result = {}
    discarded = Counter()
    with (RAW / f'mwn-{PERIOD}.csv').open(newline='', encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            instant = dt.datetime.strptime(row['valid'], '%Y-%m-%d %H:%M').replace(tzinfo=dt.timezone.utc)
            epoch = int(instant.timestamp())
            nearest = (epoch + 1800) // 3600 * 3600
            delta = abs(epoch - nearest)
            if delta > 1200 or not START <= nearest < END:
                discarded['outside_20min_or_month'] += 1
                continue
            label = dict(mwn_label(row), site='MWN', epoch=nearest, observationUtc=instant.isoformat(),
                         offsetSeconds=epoch-nearest, quality='IEM_as_is_little_QC')
            prior = result.get(nearest)
            if prior is None or (delta, epoch) < (abs(prior['offsetSeconds']), nearest + prior['offsetSeconds']):
                result[nearest] = label
            else:
                discarded['duplicate'] += 1
    return result, dict(discarded)

def dwd_rows(product, station):
    with zipfile.ZipFile(RAW / f'dwd-{product}-{station}.zip') as archive:
        member = next(n for n in archive.namelist() if n.startswith('produkt_'))
        data = archive.read(member)
        try:
            text = data.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = data.decode('cp1252')  # DWD German WW_Text product uses legacy encoding.
    result = {}
    for raw in csv.DictReader(io.StringIO(text), delimiter=';'):
        row = {k.strip(): v.strip() for k, v in raw.items()}
        date = row['MESS_DATUM']
        if not date.startswith(PERIOD):
            continue
        epoch = int(dt.datetime.strptime(date, '%Y%m%d%H').replace(tzinfo=dt.timezone.utc).timestamp())
        if not START <= epoch < END:
            continue
        if epoch in result:
            raise ValueError(f'Duplicate DWD station-hour {station} {date}')
        if row['STATIONS_ID'].zfill(5) != station:
            raise ValueError('DWD station identity mismatch')
        result[epoch] = row
    return result

def dwd_observations(station):
    visibility = dwd_rows('visibility', station)
    weather = dwd_rows('weather_phenomena', station)
    result = {}
    for epoch, row in visibility.items():
        vv = number(row['V_VV'])
        ww = number(weather.get(epoch, {}).get('WW'))
        valid = vv is not None and vv >= 0 and row['QN_8'] in {'1', '2', '3', '5', '7', '8', '9', '10'}
        blocked = True if valid and vv < 1000 else False if valid and vv >= 10000 else None
        result[epoch] = dict(site=station, epoch=epoch, observationUtc=dt.datetime.fromtimestamp(epoch, dt.timezone.utc).isoformat(),
                             offsetSeconds=0, obstructed=blocked, undercast=None, visibilityM=vv, ww=ww,
                             currentFogConfirmed=valid and vv < 1000 and ww == 130,
                             quality=f'DWD_QN{row["QN_8"]}_recent_provisional', reason='visibility_only_not_cloudsea')
    return result

def ratio(n, d):
    return n / d if d else None

def confusion(rows, label, prediction):
    counts = Counter(tp=0, fp=0, fn=0, tn=0, unknownLabel=0, withheldPositive=0, withheldNegative=0)
    for row in rows:
        actual = row.get(label)
        pred = prediction(row)
        if actual is None:
            counts['unknownLabel'] += 1
        elif pred is None:
            counts['withheldPositive' if actual else 'withheldNegative'] += 1
        else:
            counts['tp' if actual and pred else 'fn' if actual else 'fp' if pred else 'tn'] += 1
    tp, fp, fn, tn = (counts[k] for k in ('tp', 'fp', 'fn', 'tn'))
    return dict(counts, precision=ratio(tp, tp+fp), recall=ratio(tp, tp+fn), missRate=ratio(fn, tp+fn),
                falseAlarmRatio=ratio(fp, tp+fp), falsePositiveRate=ratio(fp, fp+tn),
                recallIncludingWithheld=ratio(tp, tp+fn+counts['withheldPositive']),
                balancedAccuracy=((tp/(tp+fn)+tn/(tn+fp))/2 if tp+fn and tn+fp else None))

def recommended(row, threshold=60, rh_threshold=None):
    if row['score'] is None:
        return None
    return row['score'] >= threshold and (rh_threshold is None or row['rh'] < rh_threshold)

def high_score(rows, threshold, rh_threshold=None):
    selected = [r for r in rows if recommended(r, threshold, rh_threshold)]
    positive = sum(r.get('undercast') is True for r in selected)
    negative = sum(r.get('undercast') is False for r in selected)
    return dict(issued=len(selected), knownHit=positive, knownFalse=negative,
                unknown=len(selected)-positive-negative, knownLabelHitRate=ratio(positive, positive+negative),
                hitFractionLowerBound=ratio(positive, len(selected)),
                hitFractionUpperBound=ratio(len(selected)-negative, len(selected)),
                obstructed=sum(r.get('obstructed') is True for r in selected),
                unobstructed=sum(r.get('obstructed') is False for r in selected))

def bootstrap(rows, label, prediction, metric, seed=241025):
    """Whole-UTC-date cluster percentile interval, not independent-hour binomial CI."""
    groups = defaultdict(list)
    for row in rows:
        groups[row['date']].append(row)
    days = list(groups)
    rng, samples = random.Random(seed), []
    for _ in range(2000):
        sampled = [row for day in rng.choices(days, k=len(days)) for row in groups[day]]
        value = confusion(sampled, label, prediction).get(metric)
        if value is not None:
            samples.append(value)
    samples.sort()
    return dict(method='2000_UTC_date_cluster_percentile_95pct', dates=len(days), validReplicates=len(samples),
                low=samples[int(.025*(len(samples)-1))] if samples else None,
                high=samples[int(.975*(len(samples)-1))] if samples else None)

def select_training_guard(train):
    # Rule and candidate family frozen in plan before opening paired forecast results.
    mwn = [r for r in train if r['site'] == 'MWN']
    baseline = confusion(mwn, 'undercast', lambda r: recommended(r))
    candidates = []
    for rh in (85, 90, 95, 100):
        metrics = confusion(mwn, 'undercast', lambda r: recommended(r, rh_threshold=rh))
        blocked_high = sum(recommended(r, rh_threshold=rh) is True and r.get('obstructed') is True for r in train)
        candidates.append(dict(rh=rh, undercast=metrics, allSiteObstructedRecommendations=blocked_high))
    eligible = [c for c in candidates if baseline['tp'] > 0 and c['undercast']['tp'] >= .8 * baseline['tp']]
    base_blocked = sum(recommended(r) is True and r.get('obstructed') is True for r in train)
    best = min(eligible, key=lambda c: (c['allSiteObstructedRecommendations'], c['undercast']['fp'], -c['undercast']['tp'], -c['rh'])) if eligible else None
    selected = best['rh'] if best and best['allSiteObstructedRecommendations'] < base_blocked else None
    return dict(primary='MWN_extensive_below_summit', baseline=baseline,
                baselineAllSiteObstructedRecommendations=base_blocked, candidates=candidates,
                selectedRh=selected, reason='training_guard_selected' if selected else 'no_eligible_demonstrated_training_improvement',
                heldoutUsedForSelection=False)

def main():
    global OUT, START, END, PERIOD
    parser = argparse.ArgumentParser()
    parser.add_argument('--native', action='store_true')
    parser.add_argument('--october', action='store_true')
    args = parser.parse_args()
    suffix = '-native' if args.native else ''
    september_out = OUT
    if args.october:
        PERIOD = '202610'
        START = int(dt.datetime(2026, 10, 1, tzinfo=dt.timezone.utc).timestamp())
        END = int(dt.datetime(2026, 10, 11, tzinfo=dt.timezone.utc).timestamp())
        OUT = OUT / 'october'
    expected = (END-START)//3600*4
    forecast = json.loads((OUT / f'forecast-scores{suffix}.json').read_text())
    if len(forecast) != expected or len({(r['site'], r['epoch']) for r in forecast}) != expected:
        raise ValueError(f'Expected complete four-site {expected}-hour forecast cohort')
    manifest = json.loads((OUT / f'forecast-manifest{suffix}.json').read_text())
    if len(manifest) != expected//96 or any(x['status'] != 'OK' for x in manifest):
        raise ValueError('Incomplete exact-run forecast archive')
    for item in manifest:
        if hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Forecast raw hash mismatch')
    for item in json.loads((RAW / 'dwd-source-manifest.json').read_text()):
        if hashlib.sha256(Path(item['file']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('DWD raw hash mismatch')
    mwn_manifest = json.loads((RAW / ('mwn-provenance-october.json' if args.october else 'mwn-provenance.json')).read_text())
    for item in mwn_manifest['sources']:
        if hashlib.sha256((RAW / item['filename']).read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('MWN raw hash mismatch')
    mwn, discarded = mwn_observations()
    observations = {'MWN': mwn} | {s: dwd_observations(s) for s in ('00722', '01358', '02290')}
    paired = []
    for row in forecast:
        assert START <= row['epoch'] < END and 24 <= row['leadHours'] < 48
        assert row['split'] == ('train' if row['date'] <= '2026-09-20' else 'test')
        obs = observations[row['site']].get(row['epoch'])
        paired.append(dict(row, **{k:v for k,v in (obs or {}).items() if k not in ('site', 'epoch')}, observationMatched=obs is not None))
    train = [r for r in paired if r['split'] == 'train']
    if args.october:
        frozen_path = september_out / f'calibration-train-selection{suffix}.json'
        selection = json.loads(frozen_path.read_text())
        selection = dict(selection, freshHoldout=True, frozenSelectionSha256=hashlib.sha256(frozen_path.read_bytes()).hexdigest())
    else:
        selection = select_training_guard(train)
    # Selection is materialized before held-out metrics; frozen rule cannot depend on test rows.
    (OUT / f'calibration-train-selection{suffix}.json').write_text(json.dumps(selection, indent=2), encoding='utf-8')
    rh = selection['selectedRh']
    results = dict(qualification='INDEPENDENT_OBSERVATION_PILOT_NOT_CHINA_PROBABILITY_CALIBRATION',
                   planned=expected, paired=sum(r['observationMatched'] for r in paired), mwnDiscarded=discarded,
                   calibration=selection, groups={})
    sites = {s['id']:s for s in json.loads((OUT/'sites.json').read_text())}
    results['localWindows'] = {}
    for site in ('MWN', '00722', '01358', '02290', 'ALL'):
        for split in ('train', 'test', 'all'):
            rows = [r for r in paired if (site=='ALL' or r['site']==site) and (split=='all' or r['split']==split)]
            key = f'{site}_{split}'
            result = dict(planned=len(rows), observationMatched=sum(r['observationMatched'] for r in rows),
                          scored=sum(r['score'] is not None for r in rows), positions=dict(Counter(r['position'] for r in rows)),
                          observedObstructed=sum(r.get('obstructed') is True for r in rows),
                          observedUnobstructed=sum(r.get('obstructed') is False for r in rows),
                          observedUndercast=sum(r.get('undercast') is True for r in rows),
                          undercastPositiveDates=sorted({r['date'] for r in rows if r.get('undercast') is True}),
                          inCloudVsVisibilityObstruction=confusion(rows,'obstructed',lambda r: None if r['position']=='unknown' else r['position']=='in'),
                          high60=high_score(rows,60), high80=high_score(rows,80),
                          knownObstructedHigh60=sum(recommended(r) is True and r.get('obstructed') is True for r in rows))
            if site == 'MWN':
                result['undercast60'] = confusion(rows,'undercast',lambda r: recommended(r))
                result['undercast80'] = confusion(rows,'undercast',lambda r: recommended(r,80))
                result['calibrated60'] = confusion(rows,'undercast',lambda r: recommended(r,rh_threshold=rh))
                result['calibratedHigh60'] = high_score(rows,60,rh)
                result['precision95'] = bootstrap(rows,'undercast',lambda r: recommended(r),'precision')
                result['recall95'] = bootstrap(rows,'undercast',lambda r: recommended(r),'recall')
            if split == 'test':
                result['calibratedObstructedHigh60'] = sum(recommended(r,rh_threshold=rh) is True and r.get('obstructed') is True for r in rows)
            results['groups'][key]=result
    for site in ('MWN','00722','01358','02290'):
        for split in ('train','test','all'):
            for window, hours in [('morning',{5,6,7,8}),('evening',{17,18,19})]:
                rows = [r for r in paired if r['site']==site and (split=='all' or r['split']==split)
                        and dt.datetime.fromtimestamp(r['epoch'],dt.timezone.utc).astimezone(ZoneInfo(sites[site]['timezone'])).hour in hours]
                results['localWindows'][f'{site}_{split}_{window}'] = dict(planned=len(rows),
                    observedUndercast=sum(r.get('undercast') is True for r in rows),
                    undercast60=confusion(rows,'undercast',lambda r: recommended(r)),high60=high_score(rows,60),high80=high_score(rows,80))
    (OUT / f'paired-hourly{suffix}.json').write_text(json.dumps(paired,indent=2),encoding='utf-8')
    columns = ['site','time','runUtc','leadHours','split','score','position','rh','lowCloud','cloudBaseM','cloudTopM','stationElevation','responseElevation','observationMatched','observationUtc','offsetSeconds','visibilityM','undercast','obstructed','reason','quality','ww','metar']
    with (OUT/f'paired-hourly{suffix}.csv').open('w',newline='',encoding='utf-8-sig') as handle:
        writer=csv.DictWriter(handle,fieldnames=columns,extrasaction='ignore');writer.writeheader();writer.writerows(paired)
    (OUT/f'empirical-results{suffix}.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({k:results[k] for k in ['planned','paired']},indent=2))
    for key in ['MWN_all','MWN_test','ALL_all','ALL_test']:
        result=results['groups'][key]
        print(key,json.dumps({k:result[k] for k in ['scored','observedUndercast','high60','high80','inCloudVsVisibilityObstruction']},ensure_ascii=False))
    print('TRAIN_SELECTED_RH',rh)

if __name__=='__main__':
    main()
