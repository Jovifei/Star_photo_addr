import unittest

from cloudsea_camera_analysis import pair_rows, summarize


def receipt(ident='sonnblick-20260801-0800'):
    return dict(id=ident, expected_utc_slot='2026-08-01T06:00:00Z',
                capture_utc_inferred='2026-08-01T06:00:00Z',
                status='OK', clock_status='SOURCE_HEADER_SUPPORTED', image_sha256='abc')


def score(value=None, **overrides):
    return dict(site='SNB', epoch=1785564000, time='2026-08-01T06:00:00.000Z',
                runUtc='2026-07-31T00:00:00Z', leadHours=30,
                score=value, sourceReady=True, **overrides)


class CameraAnalysisTests(unittest.TestCase):
    def test_rejects_duplicate_predictions_instead_of_selecting_best_score(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            pair_rows([receipt()], [], [score(10), score(95)])

    def test_rejects_another_station_instead_of_joining_only_on_time(self):
        row = score(95)
        row['site'] = 'MWN'
        with self.assertRaisesRegex(ValueError, 'viewpoint'):
            pair_rows([receipt()], [], [row])

    def test_rejects_wrong_initialization_even_with_matching_valid_time(self):
        row = score(95)
        row['runUtc'] = '2026-08-01T00:00:00Z'
        with self.assertRaisesRegex(ValueError, 'run'):
            pair_rows([receipt()], [], [row])

    def test_unverified_clock_cannot_be_a_determinate_label(self):
        item = receipt()
        item['clock_status'] = 'UNVERIFIED'
        label = dict(id=item['id'], image_sha256='abc', label='POSITIVE')
        with self.assertRaisesRegex(ValueError, 'clock'):
            pair_rows([item], [label], [score(95)])

    def test_missing_prediction_is_preserved_as_withheld(self):
        item = receipt()
        label = dict(id=item['id'], image_sha256='abc', label='POSITIVE')
        rows = pair_rows([item], [label], [])
        result = summarize(rows)
        self.assertEqual(result['positive'], 1)
        self.assertEqual(result['positiveWithheld'], 1)
        self.assertEqual(result['recallIncludingWithheld'], 0)
        self.assertIsNone(result['precisionKnownHigh'])

    def test_unknown_high_does_not_enter_known_high_precision(self):
        rows = [dict(label='POSITIVE', score=90, sourceReady=True, subtype='deck', date='2026-08-01'),
                dict(label='UNKNOWN', score=90, sourceReady=True, date='2026-08-02'),
                dict(label='POSITIVE', score=None, sourceReady=False, date='2026-08-03'),
                dict(label='POSITIVE', score=8, sourceReady=True, date='2026-08-04')]
        result = summarize(rows)
        self.assertEqual((result['tp'], result['fp'], result['lowScoreFn'], result['positiveWithheld']), (1, 0, 1, 1))
        self.assertEqual(result['precisionKnownHigh'], 1)
        self.assertEqual(result['recallIncludingWithheld'], 1/3)
        self.assertEqual(result['highUnknownFraction'], 1/2)


if __name__ == '__main__':
    unittest.main()
