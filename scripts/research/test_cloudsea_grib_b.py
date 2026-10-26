import unittest
from pathlib import Path
import subprocess
import tempfile
import hashlib
import json
from unittest.mock import patch
from cloudsea_grib_b import plan_b_ranges, validate_b_metadata, normalize_grib_value, download_b_tasks, download_b_task, b_url, prepare_b_tasks


def index_fixture():
    rows=[];offset=0
    for level in (725,775,825,875):
        for field in ('HGT','TMP','RH','TCDC','UGRD'):
            rows.append(f'{len(rows)+1}:{offset}:d=2026083100:{field}:{level} mb:24 hour fcst:')
            offset+=10
    return '\n'.join(rows)


def metadata():
    return dict(shortName='r',units='%',typeOfLevel='isobaricInhPa',level=875,dataDate=20260831,dataTime=0,
        validityDate=20260901,validityTime=0,stepType='instant',endStep=24,edition=2,gridType='regular_ll',
        Ni=1440,Nj=721,iDirectionIncrementInDegrees=.25,jDirectionIncrementInDegrees=.25,
        latitudeOfFirstGridPointInDegrees=90,longitudeOfFirstGridPointInDegrees=0)


class GribBTests(unittest.TestCase):
    def test_contiguous_messages_form_four_exact_ranges(self):
        ranges=plan_b_ranges(index_fixture(),'2026-08-31T00:00Z',24)
        self.assertEqual(len(ranges),4)
        self.assertEqual(sum(r['expectedBytes'] for r in ranges),160)
        self.assertTrue(all(len(r['messages'])==4 for r in ranges))

    def test_missing_or_duplicate_message_is_not_filled(self):
        with self.assertRaises(ValueError):plan_b_ranges(index_fixture().replace(':TMP:725 mb:',':VGRD:725 mb:'),'2026-08-31T00:00Z',24)
        with self.assertRaises(ValueError):plan_b_ranges(index_fixture()+'\n21:200:d=2026083100:TMP:725 mb:24 hour fcst:\n22:210:d=2026083100:UGRD:725 mb:24 hour fcst:','2026-08-31T00:00Z',24)

    def test_reference_lead_and_download_budget_are_enforced(self):
        with self.assertRaises(ValueError):plan_b_ranges(index_fixture(),'2026-09-01T00:00Z',24)
        with self.assertRaises(ValueError):plan_b_ranges(index_fixture(),'2026-08-31T00:00Z',27)
        with self.assertRaises(ValueError):plan_b_ranges(index_fixture(),'2026-08-31T00:00Z',24,max_bytes=100)

    def test_grib_time_grid_and_units_are_verified(self):
        self.assertEqual(validate_b_metadata(metadata(),'2026-08-31T00:00Z',24,(725,775,825,875)),('r',875))
        for key,value in [('units','fraction'),('validityTime',300),('Ni',720),('iDirectionIncrementInDegrees',.5)]:
            altered=metadata();altered[key]=value
            with self.assertRaises(ValueError):validate_b_metadata(altered,'2026-08-31T00:00Z',24,(725,775,825,875))

    def test_native_values_convert_without_inventing_missing(self):
        self.assertAlmostEqual(normalize_grib_value('t',280,None),6.85)
        self.assertEqual(normalize_grib_value('r',100,None),100)
        self.assertIsNone(normalize_grib_value('r',9999,9999))
        self.assertIsNone(normalize_grib_value('t',float('nan'),None))
        self.assertIsNone(normalize_grib_value('tcc',120,None))
        self.assertGreater(normalize_grib_value('gh',1500,None),1500)

    def test_one_process_reuses_connections_and_preserves_per_transfer_failures(self):
        payload=b'GRIBxxxx7777'
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            tasks=[dict(url='https://example.test/file',path=str(root/f'range{i}.grib2'),expectedBytes=12,start=i*12,end=i*12+11) for i in range(3)]
            def fake_curl(command,**kwargs):
                segments=[];current=[]
                for item in command[1:]:
                    if item=='--next':segments.append(current);current=[]
                    else:current.append(item)
                segments.append(current)
                lines=[]
                for segment in segments:
                    position=int(segment[segment.index('--write-out')+1].split('|')[0])
                    output=Path(segment[segment.index('--output')+1]);output.write_bytes(payload)
                    header=Path(segment[segment.index('--dump-header')+1])
                    task=tasks[position]
                    content_range=f'bytes {task["start"]}-{task["end"]}/1000' if position!=1 else 'bytes 999-1010/1000'
                    header.write_text('HTTP/1.1 206 Partial Content\nContent-Range: '+content_range+'\n')
                    lines.append(f'{position}|206|0.1|12|0|{int(position==0)}')
                return subprocess.CompletedProcess(command,0,'\n'.join(lines)+'\n','')
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run',side_effect=fake_curl) as transport:
                receipts=download_b_tasks(tasks)
                self.assertEqual(transport.call_count,1)
                command=transport.call_args.args[0]
                self.assertEqual(command.count('--next'),2)
                self.assertNotIn('--parallel',command)
                self.assertEqual([r['sourceValidated'] for r in receipts],[True,False,True])
                self.assertTrue(Path(tasks[0]['path']).exists())
                self.assertFalse(Path(tasks[1]['path']).exists())
                self.assertTrue(Path(tasks[2]['path']).exists())
                self.assertTrue(Path(receipts[1]['attemptPath']).exists())
                transport.reset_mock()
                second=download_b_tasks(tasks)
                self.assertEqual(transport.call_count,1)
                self.assertEqual(transport.call_args.args[0].count('--next'),0)
                self.assertTrue(second[0]['cached']);self.assertTrue(second[2]['cached'])

    def test_missing_transfer_result_is_failed_not_silently_accepted(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            tasks=[dict(url='https://example.test/file',path=str(root/'range.grib2'),expectedBytes=12,start=0,end=11)]
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run',return_value=subprocess.CompletedProcess([],28,'','timeout')):
                receipt=download_b_tasks(tasks)[0]
            self.assertFalse(receipt['sourceValidated'])
            self.assertEqual(receipt['curlExit'],28)
            self.assertFalse(Path(tasks[0]['path']).exists())

    def test_process_failure_does_not_replace_individual_transfer_exit_codes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            tasks=[dict(url='https://example.test/file',path=str(root/f'range{i}.grib2'),expectedBytes=12,start=i*12,end=i*12+11) for i in range(2)]
            process=subprocess.CompletedProcess([],28,'0|206|1.0|12|0|1\n1|000|60|0|28|0\n','second transfer timed out')
            def finish(attempt,exit_code,stats,stderr,**details):
                return dict(sourceValidated=exit_code==0,curlExit=exit_code)
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run',return_value=process),patch('cloudsea_grib_b._finish_attempt',side_effect=finish):
                receipts=download_b_tasks(tasks)
            self.assertEqual([r['curlExit'] for r in receipts],[0,28])
            self.assertEqual([r['sourceValidated'] for r in receipts],[True,False])

    def test_explicit_known_provider_urls(self):
        expected='gfs.20260905/00/atmos/gfs.t00z.pgrb2b.0p25.f042'
        self.assertEqual(b_url('2026-09-05T00:00Z',42,provider='google'),'https://storage.googleapis.com/global-forecast-system/'+expected)
        self.assertEqual(b_url('2026-09-05T00:00Z',42,index=True,provider='azure'),'https://noaagfs.blob.core.windows.net/gfs/'+expected+'.idx')
        with self.assertRaises(ValueError):b_url('2026-09-05T00:00Z',42,provider='unverified')

    def test_known_mirror_cache_keeps_actual_source_and_rejects_another_key(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);target=root/'range.grib2';payload=b'GRIBxxxx7777';target.write_bytes(payload)
            aws=b_url('2026-09-05T00:00Z',42)
            source=dict(url=aws,path=str(target),bytes=len(payload),sha256=hashlib.sha256(payload).hexdigest(),
                        rangeStart=0,rangeEnd=11,sourceValidated=True)
            receipt=target.with_suffix('.grib2.source.json');receipt.write_text(json.dumps(source));original=receipt.read_bytes()
            task=dict(url=b_url('2026-09-05T00:00Z',42,provider='azure'),path=str(target),expectedBytes=12,start=0,end=11)
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run') as network:
                reused=download_b_task(task)
                self.assertEqual(reused['url'],aws)
                self.assertEqual(reused['requestedUrl'],task['url'])
                self.assertTrue(reused['cacheSourceEquivalent'])
                self.assertEqual(receipt.read_bytes(),original)
                wrong=dict(task,url=b_url('2026-09-06T00:00Z',42,provider='azure'))
                with self.assertRaises(ValueError):download_b_task(wrong)
                wrong=dict(task,url=task['url'].replace('noaagfs.blob.core.windows.net','noaagfs.blob.core.windows.net.evil.example'))
                with self.assertRaises(ValueError):download_b_task(wrong)
                network.assert_not_called()

    def test_each_provider_fetches_its_own_index(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            def fetch(url,target,*args,**kwargs):
                Path(target).write_text(index_fixture());return dict(url=url,path=str(target))
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b._fetch',side_effect=fetch) as network:
                plan=prepare_b_tasks('2026-08-31T00:00Z',24,root,provider='azure')
                self.assertTrue(network.call_args.args[1].name.endswith('-azure.idx'))
                self.assertTrue(plan['index']['url'].startswith('https://noaagfs.blob.core.windows.net/gfs/'))
                self.assertTrue(all(task['url'].startswith('https://noaagfs.blob.core.windows.net/gfs/') for task in plan['tasks']))

    def test_parallel_transfer_order_and_partial_cache_do_not_reorder_receipts(self):
        payload=b'GRIBxxxx7777'
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            tasks=[dict(url='https://example.test/file',path=str(root/f'range{i}.grib2'),expectedBytes=12,start=i*12,end=i*12+11) for i in range(4)]
            cached=Path(tasks[1]['path']);cached.write_bytes(payload)
            cached.with_suffix('.grib2.source.json').write_text(json.dumps(dict(url=tasks[1]['url'],path=str(cached),bytes=12,
                sha256=hashlib.sha256(payload).hexdigest(),rangeStart=12,rangeEnd=23,sourceValidated=True)))
            def fake_curl(command,**kwargs):
                segments=[];current=[]
                for item in command[1:]:
                    if item=='--next':segments.append(current);current=[]
                    else:current.append(item)
                segments.append(current)
                for segment in segments:
                    position=int(segment[segment.index('--write-out')+1].split('|')[0])
                    output=Path(segment[segment.index('--output')+1])
                    header=Path(segment[segment.index('--dump-header')+1])
                    if position==2:output.write_bytes(b'GRIB');header.write_text('')
                    else:
                        output.write_bytes(payload);task=tasks[position]
                        header.write_text(f'HTTP/1.1 206 Partial Content\nContent-Range: bytes {task["start"]}-{task["end"]}/1000\n')
                return subprocess.CompletedProcess(command,28,'3|206|1.3|12|0|1|0.3\n0|206|1.0|12|0|1|0.2\n2|000|60|4|28|0|0\n','range2 timed out')
            with patch('cloudsea_grib_b.APPROVED_DOWNLOAD_ROOT',root),patch('cloudsea_grib_b.subprocess.run',side_effect=fake_curl) as transport:
                receipts=download_b_tasks(tasks,parallel=4)
                command=transport.call_args.args[0]
                self.assertIn('--parallel',command);self.assertIn('--parallel-immediate',command)
                self.assertEqual(command[command.index('--parallel-max')+1],'4')
                self.assertEqual(command.count('--next'),2)
                self.assertEqual([r['sourceValidated'] for r in receipts],[True,True,False,True])
                self.assertTrue(receipts[1]['cached'])
                self.assertEqual(receipts[0]['timeStartTransferSeconds'],.2)
                self.assertEqual(receipts[3]['timeStartTransferSeconds'],.3)
        with self.assertRaises(ValueError):download_b_tasks([],parallel=5)

if __name__=='__main__':unittest.main()
