import copy
import math
import unittest
from cloudsea_ncss import normalize_ncss_point, merge_ncss_subsets, ncss_url


def fixture():
    def var(values, dimensions=(), units=None):
        return dict(values=values, dimensions=list(dimensions), shape=[len(values)] if dimensions else [],
                    attrs={'units':units} if units else {})
    variables = {
        'reftime':var([0],units='Hour since 2026-08-31T00:00:00Z'),
        'time2':var([24],['time2'],'Hour since 2026-08-31T00:00:00Z'),
        'latitude':var([44.25],['latitude'],'degrees_north'),
        'longitude':var([288.75],['longitude'],'degrees_east'),
        'isobaric':var([85000,95000],['isobaric'],'Pa'),
        'isobaric1':var([85000],['isobaric1'],'Pa'),
        'Geopotential_height_isobaric':var([1532.927,590.696],['time2','isobaric','latitude','longitude'],'gpm'),
        'Temperature_isobaric':var([285.29825,289.16385],['time2','isobaric','latitude','longitude'],'K'),
        'Relative_humidity_isobaric':var([60.4,62.4],['time2','isobaric','latitude','longitude'],'%'),
        'Total_cloud_cover_isobaric':var([0],['time2','isobaric1','latitude','longitude'],'%'),
        'Geopotential_height_surface':var([775],['time2','latitude','longitude'],'gpm'),
    }
    # Shapes follow CF coordinate lengths, not the helper's flat input count.
    dims={'time2':1,'latitude':1,'longitude':1,'isobaric':2,'isobaric1':1}
    for item in variables.values():item['shape']=[dims[d] for d in item['dimensions']]
    return dict(dimensions=list(dims.items()),variables=variables,globalAttrs={})


class NcssTests(unittest.TestCase):
    def normalize(self, data=None):
        return normalize_ncss_point(data or fixture(),44.2708,-71.3035,'2026-08-31T00:00Z','2026-09-01T00:00Z')

    def test_native_units_and_longitude(self):
        result=self.normalize()
        self.assertEqual(result['longitude'],-71.25)
        self.assertAlmostEqual(result['hourly']['temperature_950hPa'][0],16.01385,places=4)
        self.assertAlmostEqual(result['hourly']['relative_humidity_950hPa'][0],62.4)
        self.assertAlmostEqual(result['elevation'],775.0945,places=3)

    def test_distinct_cloud_axis_is_joined_by_pressure_not_array_position(self):
        result=self.normalize()
        self.assertEqual(result['hourly']['cloud_cover_850hPa'],[0])
        self.assertEqual(result['hourly']['cloud_cover_950hPa'],[None])
        self.assertEqual(result['hourly']['precipitation'],[None])

    def test_wrong_run_and_valid_time_refused(self):
        with self.assertRaises(ValueError):
            normalize_ncss_point(fixture(),44.27,-71.3,'2026-09-01T00:00Z','2026-09-01T00:00Z')
        with self.assertRaises(ValueError):
            normalize_ncss_point(fixture(),44.27,-71.3,'2026-08-31T00:00Z','2026-09-01T01:00Z')

    def test_unknown_geopotential_unit_refused(self):
        data=fixture();data['variables']['Geopotential_height_surface']['attrs']['units']='m2/s2'
        with self.assertRaises(ValueError):self.normalize(data)

    def test_no_missing_cloud_or_precipitation_zero_filling(self):
        data=fixture();data['variables'].pop('Total_cloud_cover_isobaric')
        result=self.normalize(data)
        self.assertIsNone(result['hourly']['cloud_cover_850hPa'][0])
        self.assertIsNone(result['hourly']['precipitation'][0])

    def test_shared_grid_mismatch_refused(self):
        first=fixture();second=copy.deepcopy(first)
        second['variables']['latitude']['values']=[44.5]
        with self.assertRaises(ValueError):merge_ncss_subsets(first,second)

    def test_d084001_non_native_hour_request_refused(self):
        with self.assertRaises(ValueError):ncss_url('2026-08-31T00:00Z',23,44.26,44.24,-71.26,-71.24)
        self.assertIn('f024.grib2',ncss_url('2026-08-31T00:00Z',24,44.26,44.24,-71.26,-71.24))

    def test_wrong_region_cannot_snap_to_distant_subset(self):
        with self.assertRaises(ValueError):
            normalize_ncss_point(fixture(),51.8,10.6,'2026-08-31T00:00Z','2026-09-01T00:00Z')

    def test_accumulation_midpoint_is_not_the_forecast_valid_time(self):
        data=fixture();v=data['variables']
        v['time1']=dict(dimensions=['time1'],shape=[1],values=[21],attrs={'units':'Hour since 2026-08-31T00:00:00Z','bounds':'time1_bounds'})
        v['time1_bounds']=dict(dimensions=['time1','bounds2'],shape=[1,2],values=[18,24],attrs={'units':'Hour since 2026-08-31T00:00:00Z'})
        v['Total_precipitation_surface_Mixed_intervals_Accumulation']=dict(dimensions=['time1','latitude','longitude'],shape=[1,1,1],values=[6],attrs={'units':'kg.m-2'})
        result=self.normalize(data)
        self.assertIsNone(result['hourly']['precipitation'][0])
        self.assertEqual(result['sourceMetadata']['precipitation']['intervalHours'],6)
        self.assertEqual(result['sourceMetadata']['precipitation']['intervalMeanMmPerHour'],1)

if __name__=='__main__':unittest.main()
