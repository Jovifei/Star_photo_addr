from pathlib import Path
import tempfile
import unittest
from urllib.parse import unquote
from cloudsea_dap import dap_url, decode_dap_ascii
from cloudsea_ncss import normalize_ncss_point


def fixture(low_troposphere=False):
    axes = {'time2': [24], 'isobaric': [85000,95000], 'isobaric1':[85000], 'lat':[44.5,44.25], 'lon':[288.5,288.75]}
    fields = {
        'Relative_humidity_isobaric':(['time2','isobaric','lat','lon'], [80,81,82,83,90,91,92,93]),
        'Temperature_isobaric':(['time2','isobaric','lat','lon'], [280,281,282,283,284,285,286,287]),
        'Geopotential_height_isobaric':(['time2','isobaric','lat','lon'], [1500,1501,1502,1503,500,501,502,503]),
        'Total_cloud_cover_isobaric':(['time2','isobaric1','lat','lon'], [0,5,10,15]),
        'Geopotential_height_surface':(['time2','lat','lon'], [775,776,777,778]),
    }
    if low_troposphere:
        levels=[50000,55000,60000,65000,70000,75000,80000,85000,90000,92500,95000,97500,100000]
        axes['isobaric']=levels;axes['isobaric1']=levels
        for name,(dims,values) in list(fields.items()):
            if 'isobaric' in dims or 'isobaric1' in dims:fields[name]=(dims,[values[0]]*(13*4))
    header=['Dataset {','Float64 reftime;', 'Float64 time2[time2 = 1];',f'Float32 isobaric[isobaric = {len(axes["isobaric"])}];',f'Float32 isobaric1[isobaric1 = {len(axes["isobaric1"])}];']
    data=['reftime, 0.0','time2[1]','24',f'isobaric[{len(axes["isobaric"])}]',','.join(str(v) for v in axes['isobaric']),f'isobaric1[{len(axes["isobaric1"])}]',','.join(str(v) for v in axes['isobaric1'])]
    import itertools
    for name,(dims,values) in fields.items():
        shape=[len(axes[d]) for d in dims]
        declaration=''.join(f'[{d} = {len(axes[d])}]' for d in dims)
        maps='\n'.join(f'Float32 {d}[{d} = {len(axes[d])}];' for d in dims)
        header.append(f'Grid {{ ARRAY: Float32 {name}{declaration}; MAPS: {maps} }} {name};')
        data.append(name+'.'+name+''.join(f'[{n}]' for n in shape))
        offset=0
        for indices in itertools.product(*(range(n) for n in shape[:-1])):
            data.append(''.join(f'[{i}]' for i in indices)+', '+','.join(str(v) for v in values[offset:offset+shape[-1]]))
            offset+=shape[-1]
        for d in dims:data.extend([f'{name}.{d}[{len(axes[d])}]',','.join(str(v) for v in axes[d])])
    header.append('} files/d084001/2026/20260831/gfs.0p25.2026083100.f024.grib2;')
    return '\n'.join(header+['---------------------------------------------']+data)


class DapTests(unittest.TestCase):
    def decode(self,text=None,run='2026-08-31T00:00Z',valid='2026-09-01T00:00Z'):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'point.ascii';path.write_text(text or fixture())
            return decode_dap_ascii(path,run,valid)

    def test_url_encodes_brackets_and_uses_real_grid_maps(self):
        url=dap_url('2026-08-31T00:00Z',24,dict(north=44.26,south=44.24,west=-71.26,east=-71.24))
        self.assertNotIn('[',url)
        projection=unquote(url)
        self.assertIn('Relative_humidity_isobaric[0][0:40][183:183][1155:1155]',projection)
        self.assertNotIn(',latitude',projection)
        self.assertNotIn(',longitude',projection)

    def test_multicell_rows_maps_and_distinct_cloud_axis(self):
        decoded=self.decode()
        normalized=normalize_ncss_point(decoded,44.2708,-71.3035,'2026-08-31T00:00Z','2026-09-01T00:00Z')
        self.assertEqual(normalized['hourly']['relative_humidity_950hPa'],[93])
        self.assertAlmostEqual(normalized['hourly']['temperature_950hPa'][0],13.85)
        self.assertEqual(normalized['hourly']['cloud_cover_850hPa'],[15])
        self.assertEqual(normalized['hourly']['cloud_cover_950hPa'],[None])
        self.assertIn('static',decoded['globalAttrs']['unit_schema_provenance'])

    def test_instant_time_axis_name_can_change_between_forecast_files(self):
        text=fixture().replace('time2','time').replace('f024.grib2','f027.grib2').replace('\n24\n','\n27\n')
        result=self.decode(text,valid='2026-09-01T03:00Z')
        self.assertEqual(result['variables']['time']['values'],[27])

    def test_missing_row_is_rejected(self):
        with self.assertRaises(ValueError):self.decode(fixture().replace('[0][0], 775,776',''))

    def test_wrong_reference_and_valid_lead_rejected(self):
        with self.assertRaises(ValueError):self.decode(run='2026-09-01T00:00Z')
        with self.assertRaises(ValueError):self.decode(valid='2026-09-01T03:00Z')
        with self.assertRaises(ValueError):self.decode(run='2026-08-31T00:00:30Z',valid='2026-09-01T00:00:30Z')

    def test_inconsistent_map_is_rejected(self):
        with self.assertRaises(ValueError):self.decode(fixture().replace('Temperature_isobaric.lon[2]\n288.5,288.75','Temperature_isobaric.lon[2]\n288.5,289.0'))

    def test_duplicate_row_is_rejected(self):
        with self.assertRaises(ValueError):self.decode(fixture().replace('[0][0], 775,776','[0][0], 775,776\n[0][0], 775,776'))

    def test_http_error_and_non_native_forecast_hour_rejected(self):
        with self.assertRaises(ValueError):self.decode('<html>503</html>')
        with self.assertRaises(ValueError):dap_url('2026-08-31T00:00Z',23,(44.26,44.24,-71.26,-71.24))

    def test_low_troposphere_native_slices_and_coordinate_drift(self):
        projection=unquote(dap_url('2026-08-31T00:00Z',24,(44.26,44.24,-71.26,-71.24),low_troposphere=True))
        self.assertIn('Relative_humidity_isobaric[0][28:40]',projection)
        self.assertIn('Total_cloud_cover_isobaric[0][9:21]',projection)
        self.assertIn(',isobaric[28:40],isobaric1[9:21]',projection)
        result=self.decode(fixture(low_troposphere=True))
        self.assertEqual(len(result['variables']['isobaric']['values']),13)
        with self.assertRaises(ValueError):self.decode(fixture(low_troposphere=True).replace('50000,55000','49900,55000'))

if __name__=='__main__':unittest.main()
