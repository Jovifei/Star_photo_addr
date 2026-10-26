"""Strict one-viewpoint/UTC-slot visual pairing; no fitting or label selection."""
import argparse
import copy
import csv
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/cloudsea-source-resolution-20261025'
IMAGES = Path('E:/Claude_allow/Download/starphoto-dense-cohort-20261025/camera-development/validation')


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def epoch(value):
    instant = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if instant.tzinfo is None:
        raise ValueError('Absolute UTC clock required')
    return int(instant.timestamp())


def unique(rows, key):
    result = {}
    for row in rows:
        ident = row[key]
        if ident in result:
            raise ValueError(f'Duplicate {key}: {ident}')
        result[ident] = row
    return result


def pair_rows(receipts, labels, predictions, score_field='score'):
    sources = unique(receipts, 'id')
    observed = unique(labels, 'id')
    predicted = {}
    for row in predictions:
        if row['site'] != 'SNB':
            raise ValueError('Prediction viewpoint differs from the camera')
        instant = row['epoch']
        if instant in predicted:
            raise ValueError('Duplicate viewpoint/UTC prediction')
        if epoch(row['time']) != instant or epoch(row['runUtc']) + row['leadHours']*3600 != instant:
            raise ValueError('Prediction run/valid clock mismatch')
        run = dt.datetime.fromtimestamp(epoch(row['runUtc']), dt.timezone.utc)
        valid = dt.datetime.fromtimestamp(instant, dt.timezone.utc)
        if run.hour != 0 or valid.date()-run.date() != dt.timedelta(days=1):
            raise ValueError('Expected preceding-day 00UTC run')
        predicted[instant] = row
    if set(observed) - set(sources):
        raise ValueError('Labels without image receipts')
    rows = []
    for ident, source in sorted(sources.items()):
        label = observed.get(ident, dict(label='UNKNOWN', subtype='missing_label'))
        if label['label'] not in ('POSITIVE', 'NEGATIVE', 'UNKNOWN'):
            raise ValueError('Invalid visual label')
        if label.get('image_sha256') != source.get('image_sha256') and ident in observed:
            raise ValueError('Image/label hash mismatch')
        instant = epoch(source['expected_utc_slot'])
        verified = source.get('status') == 'OK' and source.get('clock_status') == 'SOURCE_HEADER_SUPPORTED'
        if verified and source.get('capture_utc_inferred') != source['expected_utc_slot']:
            raise ValueError('Source clock differs from frozen slot')
        if label['label'] != 'UNKNOWN' and not verified:
            raise ValueError('Determinate label needs verified source clock')
        item = predicted.pop(instant, {})
        value = item.get(score_field)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 100):
            raise ValueError('Invalid score; missing is distinct from zero')
        if value is not None and not item.get('sourceReady'):
            raise ValueError('Score without qualified source')
        rows.append(dict(id=ident, date=source.get('date', ident[10:18]),
                         epoch=instant, time=source['expected_utc_slot'], label=label['label'],
                         subtype=label.get('subtype'), score=value, sourceReady=item.get('sourceReady', False)))
    if predicted:
        raise ValueError('Predictions outside the frozen camera slots')
    return rows


def summarize(rows, threshold=60):
    positive = [r for r in rows if r['label'] == 'POSITIVE']
    negative = [r for r in rows if r['label'] == 'NEGATIVE']
    high = [r for r in rows if r['score'] is not None and r['score'] >= threshold]
    tp = sum(r['label'] == 'POSITIVE' for r in high)
    fp = sum(r['label'] == 'NEGATIVE' for r in high)
    unknown_high = sum(r['label'] == 'UNKNOWN' for r in high)
    withheld = sum(r['score'] is None for r in positive)
    return dict(total=len(rows), threshold=threshold, positive=len(positive), negative=len(negative),
                unknown=sum(r['label'] == 'UNKNOWN' for r in rows),
                sourceReady=sum(r['sourceReady'] for r in rows),
                scored=sum(r['score'] is not None for r in rows), high=len(high), tp=tp, fp=fp,
                lowScoreFn=len(positive)-tp-withheld, positiveWithheld=withheld,
                positiveSourceMissing=sum(not r['sourceReady'] for r in positive),
                highUnknown=unknown_high, highFogObstructed=sum(r['label'] == 'NEGATIVE' and r.get('subtype') == 'fog_enclosed' for r in high),
                positiveDates=len({r['date'] for r in positive}), highDates=len({r['date'] for r in high}),
                precisionKnownHigh=tp/(tp+fp) if tp+fp else None,
                recallIncludingWithheld=tp/len(positive) if positive else None,
                highUnknownFraction=unknown_high/len(high) if high else None,
                falseAlarmFractionKnownHigh=fp/(tp+fp) if tp+fp else None)


def gate(result):
    # Declared before accessing holdout labels; no post-result threshold changes.
    checks = dict(atLeast10PositiveSlots=result['positive'] >= 10,
                  atLeast3PositiveDates=result['positiveDates'] >= 3,
                  atLeast20KnownHighSlots=result['tp']+result['fp'] >= 20,
                  atLeast3HighDates=result['highDates'] >= 3,
                  unknownHighAtMost20Percent=result['highUnknownFraction'] is not None and result['highUnknownFraction'] <= .2,
                  precisionAtLeast75Percent=result['precisionKnownHigh'] is not None and result['precisionKnownHigh'] >= .75,
                  captureIncludingWithheldAtLeast40Percent=result['recallIncludingWithheld'] is not None and result['recallIncludingWithheld'] >= .4,
                  fogObstructionAtMost10Percent=result['high'] > 0 and result['highFogObstructed']/result['high'] <= .1)
    return dict(status='PASS' if all(checks.values()) else 'NOT_QUALIFIED', checks=checks)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-name', default='camera-holdout-results-20261026')
    args = parser.parse_args()
    if Path(args.output_name).name != args.output_name:
        raise ValueError('Expected an output basename')
    freeze = load(OUT/'camera-candidate-frozen.json')
    if not all(digest(ROOT/file) == sha for file, sha in freeze['source_files'].items()):
        raise ValueError('Frozen candidate changed')
    receipts = load(IMAGES/'manifest.json')
    labels = load(IMAGES/'labels.json')
    review = load(OUT/'visual-holdout-independent-review-20261026.json')
    if not review['prediction_blind'] or review['scope']['reviewed_observations'] != 164:
        raise ValueError('Complete prediction-blind review required')
    if digest(IMAGES/'labels.json') != review['inputs']['sha256']['labels'] or digest(IMAGES/'manifest.json') != review['inputs']['sha256']['manifest']:
        raise ValueError('Reviewed original labels or receipts changed')
    corrected = unique(copy.deepcopy(labels), 'id')
    for change in review['suggested_changes']:
        item = corrected[change['id']]
        if change['image_sha256'] != item['image_sha256'] or change['original']['label'] != item['label']:
            raise ValueError('Correction identity mismatch')
        suggested = change['suggested']
        item.update(label=suggested['label'], subtype=suggested['subtype'], reason=suggested['visual_reason'])
    corrected = list(corrected.values())
    from cloudsea_camera_download import validation_cohort
    declared = validation_cohort()
    if {r['id'] for r in receipts} != {r['id'] for r in declared} or len(receipts) != 164:
        raise ValueError('Source cohort differs from predeclared dates/slots')
    plan = unique(declared, 'id')
    if any(r['expected_utc_slot'] != plan[r['id']]['expected_utc_slot'] for r in receipts):
        raise ValueError('Frozen observation slot mismatch')
    predictions = load(OUT/'camera-scores-validation.json')
    rows = pair_rows(receipts, corrected, predictions)
    metrics = {}
    for name, observed in [('original_labels', labels), ('reviewed_labels', corrected)]:
        metrics[name] = {}
        for model, field in [('candidate', 'score'), ('old_rules_on_candidate_inputs', 'legacyCorrectedInputScore'), ('main_levels_only', 'mainOnlyScore')]:
            paired = pair_rows(receipts, observed, predictions, field)
            metrics[name][model] = {period: {str(t): summarize(selected, t) for t in (60, 80)}
                for period, selected in [('all', paired), ('august', [r for r in paired if r['time'].startswith('2026-08')]), ('october', [r for r in paired if r['time'].startswith('2026-10')])]}
    result = dict(createdUtc=dt.datetime.now(dt.timezone.utc).isoformat(), candidate=freeze['candidate'],
                  frozenSourceMatches=True, humanGroundTruth=False,
                  labelReviewBeforePairing=True, metrics=metrics,
                  releaseGate=gate(metrics['reviewed_labels']['candidate']['all']['60']),
                  sha256={name: digest(file) for name, file in dict(candidateFreeze=OUT/'camera-candidate-frozen.json',
                      predictions=OUT/'camera-scores-validation.json', inputs=OUT/'camera-inputs-validation.json',
                      originalLabels=IMAGES/'labels.json', visualReview=OUT/'visual-holdout-independent-review-20261026.json',
                      manifest=IMAGES/'manifest.json', analysis=Path(__file__)).items()},
                  limitations=['Assistant visual labels, not independent human adjudication.',
                      'One Austrian camera and its SW field of view; not validation for all Chinese viewpoints.',
                      'Old-rule comparator uses candidate native inputs; not archived deployed predictions.',
                      'No high predictions means precision is unavailable, not 100 percent.',
                      'Slots from a weather episode are correlated; no independent-hour uncertainty claim.',
                      'Live API normalization equivalence still needs verification before any release.'])
    (OUT/f'{args.output_name}.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    (OUT/f'{args.output_name}-reviewed-labels.json').write_text(json.dumps(corrected, indent=2)+'\n', encoding='utf-8')
    with (OUT/f'{args.output_name}-paired.csv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps(dict(candidate=result['metrics']['reviewed_labels']['candidate'],
                         oldRules=result['metrics']['reviewed_labels']['old_rules_on_candidate_inputs']['all'],
                         releaseGate=result['releaseGate']), indent=2))


if __name__ == '__main__':
    main()
