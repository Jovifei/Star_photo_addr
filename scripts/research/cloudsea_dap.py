"""Bounded GDEX GFS025 DAP2 ASCII extraction, compatible with cloudsea_ncss.

DAP ASCII supplies dimensions, maps and values but does not carry units. The
units below are a STATIC VERIFIED SCHEMA from the same d084001 GRIB product's
NCSS dataset.xml, not attributes observed in each ASCII response. Never apply
this adapter to another product or to a renamed unverified variable.
"""
from datetime import datetime, timezone, timedelta
import math
from pathlib import Path
import re
from urllib.parse import quote

FIELDS = {
    'Relative_humidity_isobaric':'%',
    'Temperature_isobaric':'K',
    'Geopotential_height_isobaric':'gpm',
    'Total_cloud_cover_isobaric':'%',
    'Geopotential_height_surface':'gpm',
}
_ALIAS = {'lat':'latitude','lon':'longitude'}
_ARRAY = re.compile(r'^([A-Za-z_]\w*(?:\.\w+)?)((?:\[\d+\])+)$')
_DIMENSION = re.compile(r'\[(\w+)\s*=\s*(\d+)\]')
_GRID = re.compile(r'Grid\s*\{\s*ARRAY:\s*\w+\s+(\w+)((?:\[\w+\s*=\s*\d+\])+)\s*;\s*MAPS:(.*?)\}\s*(\w+)\s*;',re.S)
_DECLARATION = re.compile(r'(?:Float32|Float64|Int32)\s+(\w+)((?:\[\w+\s*=\s*\d+\])*)\s*;')


def _date(value):
    result=datetime.fromisoformat(value.replace('Z','+00:00')) if isinstance(value,str) else value
    if result.tzinfo is None:
        raise ValueError('Fixed-run time requires an absolute timezone')
    return result.astimezone(timezone.utc)


def dap_url(run,lead,bounds,low_troposphere=False):
    """bounds is {north,south,west,east} or that four-value sequence.

    Bounds select nearest native quarter-degree centres, matching the bounded
    NCSS boxes. No dateline-spanning boxes or hourly interpolated files.
    """
    run=_date(run)
    if lead<0 or lead%3 or run.minute or run.second:
        raise ValueError('d084001 requires an exact run and native 3-hour forecast lead')
    north,south,west,east=([bounds[k] for k in ('north','south','west','east')]
                           if isinstance(bounds,dict) else bounds)
    if not all(math.isfinite(x) for x in (north,south,west,east)) or not -90<=south<=north<=90:
        raise ValueError('Illegal latitude bounds')
    west,east=west%360,east%360
    if west>east:
        raise ValueError('Split boxes that cross the prime meridian/dateline')
    nearest=lambda value:math.floor(value+.5)
    i0,i1=nearest((90-north)*4),nearest((90-south)*4)
    j0,j1=nearest(west*4),min(1439,nearest(east*4))
    if i1<i0 or j1<j0:
        raise ValueError('Empty native grid bounds')
    if (i1-i0+1)*(j1-j0+1)>4096:
        raise ValueError('Split oversized research grid boxes before downloading')
    section=f'[{i0}:{i1}][{j0}:{j1}]'
    profile_slice='28:40' if low_troposphere else '0:40'
    cloud_slice='9:21' if low_troposphere else '0:21'
    axes=['isobaric[28:40]','isobaric1[9:21]'] if low_troposphere else ['isobaric','isobaric1']
    projection=','.join([f'{field}[0][{cloud_slice if field=="Total_cloud_cover_isobaric" else profile_slice}]{section}'
                          for field in FIELDS if field!='Geopotential_height_surface']+
                        [f'Geopotential_height_surface[0]{section}',*axes,'reftime','time2'])
    base=(f'https://tds.gdex.ucar.edu/thredds/dodsC/files/d084001/'
          f'{run:%Y/%Y%m%d}/gfs.0p25.{run:%Y%m%d%H}.f{lead:03d}.grib2.ascii?')
    return base+quote(projection,safe=',:')


def _numeric(text):
    try:
        return [float(value.strip()) for value in text.split(',')]
    except ValueError as error:
        raise ValueError('DAP response contains nonnumeric data') from error


def decode_dap_ascii(path,run,valid):
    text=Path(path).read_text(encoding='utf-8')
    if not text.startswith('Dataset {'):
        raise ValueError('Expected a successful DAP Dataset, not an HTTP/error body')
    parts=re.split(r'^-{10,}\s*$',text,maxsplit=1,flags=re.M)
    if len(parts)!=2:
        raise ValueError('DAP DDS/data separator missing')
    header,body=parts
    identity=re.search(r'files/d084001/\d{4}/\d{8}/gfs\.0p25\.(\d{10})\.f(\d{3})\.grib2',header)
    run,valid=_date(run),_date(valid)
    if not identity or datetime.strptime(identity[1],'%Y%m%d%H').replace(tzinfo=timezone.utc)!=run or valid!=run+timedelta(hours=int(identity[2])):
        raise ValueError('DAP dataset does not match the requested reference/valid time')
    declarations={}
    grids={}
    for match in _GRID.finditer(header):
        name,dimensions,maps,label=match.groups()
        if name!=label or name not in FIELDS or name in grids:
            raise ValueError('Unknown/duplicate DAP Grid or array identity mismatch')
        dims=[(d,int(n)) for d,n in _DIMENSION.findall(dimensions)]
        grids[name]=dims
        declarations[f'{name}.{name}']=dims
        for axis,axis_dimensions in _DECLARATION.findall(maps):
            declarations[f'{name}.{axis}']=[(d,int(n)) for d,n in _DIMENSION.findall(axis_dimensions)]
    if set(grids)!=set(FIELDS):
        raise ValueError('DAP response must contain all four pressure fields and native orography')
    for name,dimensions in _DECLARATION.findall(_GRID.sub('',header)):
        if name not in ('reftime','isobaric','isobaric1') and not re.fullmatch(r'time\d*',name):
            raise ValueError('Unknown standalone DAP variable')
        declarations[name]=[(d,int(n)) for d,n in _DIMENSION.findall(dimensions)]
    blocks={}
    current=None
    for line in body.splitlines():
        line=line.strip()
        if not line:
            continue
        array=_ARRAY.fullmatch(line)
        scalar=re.fullmatch(r'([A-Za-z_]\w*(?:\.\w+)?),\s*(.+)',line)
        if array or scalar:
            key=array[1] if array else scalar[1]
            if key not in declarations or key in blocks:
                raise ValueError(f'Unknown/duplicate DAP block {key}')
            shape=[n for _,n in declarations[key]]
            if math.prod(shape)>1000000:
                raise ValueError('Oversized DAP block; expected a bounded point/region subset')
            if array and [int(n) for n in re.findall(r'\[(\d+)\]',array[2])]!=shape:
                raise ValueError('DAP data shape disagrees with DDS')
            current=dict(shape=shape,values=[None]*math.prod(shape),rows=set(),cursor=0)
            blocks[key]=current
            if scalar:
                if shape:
                    raise ValueError('DAP scalar block has array dimensions')
                current['values']=_numeric(scalar[2])
            continue
        if current is None:
            raise ValueError('DAP numeric row without a declared block')
        indexed=re.fullmatch(r'((?:\[\d+\])+),\s*(.+)',line)
        if indexed:
            indices=[int(i) for i in re.findall(r'\[(\d+)\]',indexed[1])]
            shape=current['shape']
            values=_numeric(indexed[2])
            if len(indices)!=len(shape)-1 or len(values)!=shape[-1] or any(i>=n for i,n in zip(indices,shape)):
                raise ValueError('DAP row index/length does not match declared dimensions')
            indices=tuple(indices)
            if indices in current['rows']:
                raise ValueError('Duplicate DAP row')
            current['rows'].add(indices)
            position=0
            for index,size in zip(indices,shape[:-1]):
                position=position*size+index
            position*=shape[-1]
        else:
            if len(current['shape'])!=1:
                raise ValueError('Multidimensional DAP data must carry row indices')
            values=_numeric(line)
            position=current['cursor']
            current['cursor']+=len(values)
        if position+len(values)>len(current['values']):
            raise ValueError('Too many DAP numeric values')
        current['values'][position:position+len(values)]=values
    if set(blocks)!=set(declarations):
        raise ValueError('DAP response omitted declared blocks')
    dimensions={}
    variables={}
    time_units=f'Hour since {run.isoformat().replace("+00:00","Z")}'
    def insert(name,dims,values):
        dims=[(_ALIAS.get(d,d),n) for d,n in dims]
        for dimension,size in dims:
            if dimension in dimensions and dimensions[dimension]!=size:
                raise ValueError('DAP map dimensions disagree across grids')
            dimensions[dimension]=size
        if name in variables:
            old=variables[name]
            if old['dimensions']!=[d for d,_ in dims] or old['values']!=values:
                raise ValueError(f'Inconsistent DAP coordinate map {name}')
            return
        unit=(time_units if name == 'reftime' or re.fullmatch(r'time\d*',name) else FIELDS.get(name) or
              {'latitude':'degrees_north','longitude':'degrees_east','isobaric':'Pa','isobaric1':'Pa'}.get(name))
        if unit is None:
            raise ValueError(f'Unknown static unit schema for {name}')
        variables[name]=dict(dimensions=[d for d,_ in dims],shape=[n for _,n in dims],
                             values=values,attrs={'units':unit})
    for key,block in blocks.items():
        values=block['values']
        if len(values)!=math.prod(block['shape']) or any(v is None for v in values):
            raise ValueError(f'Truncated DAP block {key}')
        name=key.split('.')[-1]
        insert(_ALIAS.get(name,name),declarations[key],values)
    native_times={dimension for dims in grids.values() for dimension,_ in dims if re.fullmatch(r'time\d*',dimension)}
    if variables['reftime']['values']!=[0.0] or not native_times or any(variables[axis]['values']!=[(valid-run).total_seconds()/3600] for axis in native_times):
        raise ValueError('DAP reference/valid coordinate values disagree with the requested run')
    if len(variables['isobaric']['values'])==len(variables['isobaric1']['values'])==13:
        expected=[50000.,55000.,60000.,65000.,70000.,75000.,80000.,85000.,90000.,92500.,95000.,97500.,100000.]
        if variables['isobaric']['values']!=expected or variables['isobaric1']['values']!=expected:
            raise ValueError('Selected low-troposphere pressure slices drifted from the verified native schema')
    return dict(dimensions=list(dimensions.items()),variables=variables,records=0,
        globalAttrs={'source':'NCAR GDEX d084001 / NOAA GFS025 DAP2 ASCII',
            'unit_schema_provenance':'static verified NCSS schema, not per-response ASCII attributes',
            'unit_schema_reference':'https://tds.gdex.ucar.edu/thredds/ncss/grid/files/d084001/2026/20260831/gfs.0p25.2026083100.f024.grib2/dataset.xml',
            'source_run_utc':run.isoformat(),'source_valid_utc':valid.isoformat()})
