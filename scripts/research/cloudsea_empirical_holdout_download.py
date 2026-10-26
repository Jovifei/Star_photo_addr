"""Public raw human observations for predeclared fresh holdout, no label tuning."""
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse

RAW = Path('E:/Claude_allow/Download/starphoto-empirical-20261024')
source = json.loads((RAW / 'mwn-provenance.json').read_text())
query = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(source['sources'][0]['url']).query))
query.update(month1='10', day1='1', month2='10', day2='11')
# Duplicate report_type arguments request routine + special observations.
query.pop('report_type', None)
url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?' + urllib.parse.urlencode(query) + '&report_type=3&report_type=4'
path = RAW / 'mwn-202610.csv'
result = subprocess.run(['curl.exe','--silent','--show-error','--fail-with-body','--retry','2','--retry-all-errors','--connect-timeout','15','--max-time','60',url,'--output',str(path)],capture_output=True,text=True)
if result.returncode:
    raise RuntimeError(result.stderr)
data = path.read_bytes()
if not data.startswith(b'station,valid,'):
    raise ValueError('Unexpected observation CSV')
record = dict(filename=path.name,url=url,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),verifiedAtUtc=dt.datetime.now(dt.timezone.utc).isoformat())
provenance = dict(station=source['station'],periodUtc=dict(startInclusive='2026-10-01T00:00:00Z',endExclusive='2026-10-11T00:00:00Z'),sources=[record],qualification='FRESH_FIXED_HOLDOUT_NO_TUNING')
(RAW/'mwn-provenance-october.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
print(json.dumps(record))
