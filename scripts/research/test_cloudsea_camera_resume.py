import datetime as dt
import unittest
from unittest.mock import patch

import cloudsea_camera_forecast as camera


class CameraResumeTests(unittest.TestCase):
    def test_complete_day_keeps_all_four_hours_without_network(self):
        saved = dict(date='2026-08-01', runUtc='2026-07-31T00:00:00Z',
                     site=camera.SITE, hours=[dict(lead=lead) for lead in camera.LEADS],
                     sources=[dict(status='OK', url='saved-receipt')])
        with patch.object(camera, 'fetch', side_effect=AssertionError('network')):
            actual = camera.one_day(dt.date(2026, 8, 1), {}, {}, saved)
        self.assertEqual(actual, saved)

    def test_partial_retry_does_not_erase_known_hours_when_surface_fails(self):
        saved = dict(date='2026-08-01', runUtc='2026-07-31T00:00:00Z',
                     site=camera.SITE, hours=[dict(lead=30), dict(lead=36), dict(lead=39)],
                     sources=[dict(status='OK', url='original-receipt')])
        with patch.object(camera, 'fetch', return_value=dict(status='ERROR')):
            actual = camera.one_day(dt.date(2026, 8, 1), {}, {}, saved)
        self.assertEqual(actual['hours'], saved['hours'])
        self.assertIn(saved['sources'][0], actual['sources'])

    def test_rejects_resume_from_another_day(self):
        saved = dict(date='2026-08-02', runUtc='2026-08-01T00:00:00Z', hours=[])
        with self.assertRaisesRegex(ValueError, 'identity'):
            camera.one_day(dt.date(2026, 8, 1), {}, {}, saved)


if __name__ == '__main__':
    unittest.main()
