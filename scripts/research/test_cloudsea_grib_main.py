import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from cloudsea_grib_main import MAIN_LEVELS, main_url, prepare_main_tasks, decode_main_ranges


def index_fixture():
    rows=[]; offset=0
    for level in reversed(MAIN_LEVELS):
        for field in ('HGT','TMP','RH','TCDC','UGRD'):
            rows.append(f'{len(rows)+1}:{offset}:d=2026091900:{field}:{level} mb:39 hour fcst:')
            offset+=10
    return '\n'.join(rows)


class MainGribTests(unittest.TestCase):
    def test_main_google_url_is_not_the_companion_b_resource(self):
        self.assertEqual(main_url('2026-09-19T00:00Z',39),
            'https://storage.googleapis.com/global-forecast-system/gfs.20260919/00/atmos/gfs.t00z.pgrb2.0p25.f039')
        self.assertTrue(main_url('2026-09-19T00:00Z',39,index=True).endswith('.f039.idx'))
        for run, lead in [('2026-09-19T01:00Z',39),('2026-09-19T00:00Z',385)]:
            with self.assertRaises(ValueError):main_url(run,lead)

    def test_plan_uses_the_exact_main_index_and_only_wanted_messages(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            def fetch(url,target,*args,**kwargs):
                Path(target).write_text(index_fixture())
                return dict(url=url,path=str(target),sourceValidated=True)
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_main._fetch',side_effect=fetch) as network:
                plan=prepare_main_tasks('2026-09-19T00:00Z',39,root)
                self.assertEqual(plan['plannedBytes'],len(MAIN_LEVELS)*40)
                self.assertEqual(len(plan['tasks']),len(MAIN_LEVELS))
                self.assertTrue(network.call_args.args[0].endswith('pgrb2.0p25.f039.idx'))
                self.assertTrue(all(t['url']==main_url('2026-09-19T00:00Z',39) for t in plan['tasks']))
                self.assertTrue(all(len(t['messages'])==4 and all(m['field']!='UGRD' for m in t['messages']) for t in plan['tasks']))
                with self.assertRaises(ValueError):prepare_main_tasks('2026-09-19T00:00Z',39,root,max_bytes=100)

    def test_decode_preserves_values_and_attests_main_source_from_actual_receipts(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); raw=root/'main.grib2'; data=b'GRIBxxxx7777';raw.write_bytes(data)
            receipt=dict(url=main_url('2026-09-19T00:00Z',39),path=str(raw),bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(),sourceValidated=True,rangeStart=0,rangeEnd=11)
            raw.with_suffix('.grib2.source.json').write_text(json.dumps(receipt))
            result=dict(points={'MWN':dict(hourly={'temperature_850hPa':[3.5]},sourceMetadata={'provider':'NOAA GFS025 pgrb2b'})},messages=[{'level':850}])
            with patch('cloudsea_grib_main.decode_b_ranges',return_value=result) as decode:
                decoded=decode_main_ranges([raw],'2026-09-19T00:00Z',39,[{'id':'MWN','latitude':44.27,'longitude':-71.30}])
                self.assertEqual(decoded['points']['MWN']['hourly']['temperature_850hPa'],[3.5])
                self.assertEqual(decoded['points']['MWN']['sourceMetadata']['provider'],'NOAAGFS025pgrb2 main')
                self.assertEqual(decode.call_args.args[-1],MAIN_LEVELS)
                self.assertEqual(decoded['sources'][0]['url'],receipt['url'])
                receipt['url']=receipt['url'].replace('pgrb2.','pgrb2b.')
                raw.with_suffix('.grib2.source.json').write_text(json.dumps(receipt))
                with self.assertRaises(ValueError):decode_main_ranges([raw],'2026-09-19T00:00Z',39,[])
                receipt['url']=main_url('2026-09-18T00:00Z',39)
                raw.with_suffix('.grib2.source.json').write_text(json.dumps(receipt))
                with self.assertRaises(ValueError):decode_main_ranges([raw],'2026-09-19T00:00Z',39,[])

    def test_cached_index_requires_its_same_actual_main_url_receipt(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); index=root/'main.idx'; data=index_fixture().encode();index.write_bytes(data)
            receipt=dict(url=main_url('2026-09-19T00:00Z',39,index=True),path=str(index),bytes=len(data),
                sha256=hashlib.sha256(data).hexdigest(),sourceValidated=True,rangeStart=None,rangeEnd=None)
            metadata=index.with_suffix('.idx.source.json');metadata.write_text(json.dumps(receipt))
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run') as network:
                plan=prepare_main_tasks('2026-09-19T00:00Z',39,root,index_path=index)
                self.assertTrue(plan['index']['cached'])
                network.assert_not_called()
                receipt['url']=receipt['url'].replace('pgrb2.','pgrb2b.')
                metadata.write_text(json.dumps(receipt))
                with self.assertRaises(ValueError):prepare_main_tasks('2026-09-19T00:00Z',39,root,index_path=index)
                receipt['url']=main_url('2026-09-19T00:00Z',39,index=True,provider='aws')
                metadata.write_text(json.dumps(receipt))
                with self.assertRaises(ValueError):prepare_main_tasks('2026-09-19T00:00Z',39,root,index_path=index)


if __name__=='__main__':unittest.main()
