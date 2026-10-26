"""Guard empirical labels/denominators against manufactured forecast skill."""
import unittest
from cloudsea_empirical_analysis import mwn_label, confusion, recommended, select_training_guard

class IndependentLabelTests(unittest.TestCase):
    def label(self, text, visibility='20'):
        return mwn_label({'metar': text, 'vsby': visibility})

    def test_below_summit_extensive_not_ordinary_overcast(self):
        self.assertIs(self.label('KMWN 010051Z 20SM BKN/// SCT090 RMK')['undercast'], True)
        self.assertIsNone(self.label('KMWN 010051Z 20SM BKN090 RMK')['undercast'])

    def test_rmk_valley_fog_not_summit_fog(self):
        row = self.label('KMWN 010051Z 20SM OVC/// RMK PTCHY VLY FG NW')
        self.assertIs(row['undercast'], True)
        self.assertIs(row['obstructed'], False)

    def test_patchy_and_zero_height_remain_ambiguous(self):
        self.assertIsNone(self.label('KMWN 010051Z 20SM BCFG BKN/// RMK')['undercast'])
        self.assertIsNone(self.label('KMWN 010051Z 20SM BKN/// FEW000 RMK')['undercast'])

    def test_obscured_summit_is_negative_cloudsea(self):
        row = self.label('KMWN 010051Z 1/4SM FG VV000 RMK', '.25')
        self.assertIs(row['obstructed'], True)
        self.assertIs(row['undercast'], False)

    def test_sparse_and_clear_are_explicit_negatives(self):
        self.assertIs(self.label('KMWN 010051Z 20SM FEW/// RMK')['undercast'], False)
        self.assertIs(self.label('KMWN 010051Z 20SM SKC RMK')['undercast'], False)
        self.assertIsNone(self.label('KMWN 010051Z 20SM RMK')['undercast'])

    def test_missing_visibility_not_clear(self):
        self.assertIsNone(self.label('KMWN 010051Z OVC/// RMK', 'M')['undercast'])

    def test_withheld_forecast_not_negative_and_missing_label_not_miss(self):
        rows = [dict(score=None, actual=True), dict(score=85, actual=None), dict(score=70, actual=True), dict(score=8, actual=True), dict(score=82, actual=False)]
        metrics = confusion(rows, 'actual', recommended)
        self.assertEqual([metrics[x] for x in ['tp','fp','fn','tn','unknownLabel','withheldPositive']], [1,1,1,0,1,1])
        self.assertEqual(metrics['recall'], .5)
        self.assertEqual(metrics['recallIncludingWithheld'], 1/3)

    def test_no_training_true_positive_means_no_fitted_guard(self):
        rows = [dict(site='MWN', score=80, rh=98, undercast=False, obstructed=True)]
        self.assertIsNone(select_training_guard(rows)['selectedRh'])

    def test_guard_selected_from_training_with_true_positive_retention(self):
        rows = [dict(site='MWN', score=80, rh=80, undercast=True, obstructed=False),
                dict(site='MWN', score=80, rh=98, undercast=False, obstructed=True)]
        choice = select_training_guard(rows)
        self.assertEqual(choice['selectedRh'], 95)
        self.assertIs(choice['heldoutUsedForSelection'], False)

if __name__ == '__main__':
    unittest.main()
