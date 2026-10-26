"""Read bounded NCSS CDF1/2 subsets; preserve native grids, units and intervals.

Research adapter only. NCAR d084001 contains fixed GFS 0.25-degree forecast
files at 3-hour lead steps. No interpolation or missing-data filling is done.
"""
from datetime import datetime, timezone, timedelta
import math
from pathlib import Path
import re
import struct
from urllib.parse import urlencode

NCSS_FIELDS = (
    'Relative_humidity_isobaric', 'Temperature_isobaric',
    'Geopotential_height_isobaric', 'Total_cloud_cover_isobaric',
    'Geopotential_height_surface', 'Visibility_surface',
    'Low_cloud_cover_low_cloud', 'Medium_cloud_cover_middle_cloud',
    'High_cloud_cover_high_cloud', 'Temperature_height_above_ground',
    'Relative_humidity_height_above_ground',
    'u-component_of_wind_height_above_ground', 'v-component_of_wind_height_above_ground',
    'Total_precipitation_surface_Mixed_intervals_Accumulation',
)


def ncss_url(run_utc, lead_hours, north, south, west, east, fields=NCSS_FIELDS):
    run = _datetime(run_utc)
    if lead_hours % 3 or lead_hours < 0:
        raise ValueError('d084001 forecast leads must be nonnegative 3-hour steps')
    path = (f'https://tds.gdex.ucar.edu/thredds/ncss/grid/files/d084001/'
            f'{run:%Y/%Y%m%d}/gfs.0p25.{run:%Y%m%d%H}.f{lead_hours:03d}.grib2')
    return path + '?' + urlencode(dict(var=','.join(fields), time=(run+timedelta(hours=lead_hours)).isoformat().replace('+00:00','Z'),
        north=north, south=south, west=west, east=east, accept='netcdf3', addLatLon='true'))


def decode_netcdf3(path):
    """Decode the fixed-size classic/64-bit-offset files returned by NCSS.

    Record variables and CDF5 are deliberately refused, rather than decoded
    with an incorrect record stride. NCSS grid subsets use fixed dimensions.
    """
    data = Path(path).read_bytes()
    if data[:3] != b'CDF' or len(data) < 8 or data[3] not in (1, 2):
        raise ValueError('Expected CDF1/2, not an HTTP error or another format')
    version, offset = data[3], 4
    formats = {1:('b',1), 2:('c',1), 3:('h',2), 4:('i',4), 5:('f',4), 6:('d',8)}

    def integer():
        nonlocal offset
        result = struct.unpack_from('>I', data, offset)[0]
        offset += 4
        return result

    def string():
        nonlocal offset
        length = integer()
        result = data[offset:offset+length].decode('utf-8')
        offset += (length+3)//4*4
        return result

    def attributes():
        nonlocal offset
        tag, count = integer(), integer()
        if tag not in (0, 12):
            raise ValueError('Invalid CDF attribute list')
        result = {}
        for _ in range(count):
            name, kind, count = string(), integer(), integer()
            fmt, size = formats[kind]
            length = count*size
            result[name] = (data[offset:offset+length].decode('utf-8') if kind == 2
                            else list(struct.unpack_from('>'+fmt*count, data, offset)))
            offset += (length+3)//4*4
        return result

    records = integer()
    tag, count = integer(), integer()
    if tag not in (0, 10):
        raise ValueError('Invalid CDF dimension list')
    dimensions = [(string(), integer()) for _ in range(count)]
    if any(size == 0 for _, size in dimensions):
        raise ValueError('Unlimited/record dimensions require a record-aware reader')
    global_attributes = attributes()
    tag, count = integer(), integer()
    if tag not in (0, 11):
        raise ValueError('Invalid CDF variable list')
    variables = {}
    for _ in range(count):
        name = string()
        dimension_ids = [integer() for _ in range(integer())]
        attrs, kind, vsize = attributes(), integer(), integer()
        if version == 1:
            begin = integer()
        else:
            begin = struct.unpack_from('>Q', data, offset)[0]
            offset += 8
        shape = [dimensions[i][1] for i in dimension_ids]
        fmt, size = formats[kind]
        length = math.prod(shape)
        if begin+length*size > len(data):
            raise ValueError(f'Truncated CDF variable {name}')
        values = list(struct.unpack_from('>'+fmt*length, data, begin))
        variables[name] = dict(dimensions=[dimensions[i][0] for i in dimension_ids],
                               shape=shape, attrs=attrs, values=values, storageBytes=vsize)
    return dict(dimensions=dimensions, globalAttrs=global_attributes, variables=variables, records=records)


def _datetime(value):
    date = datetime.fromisoformat(value.replace('Z', '+00:00')) if isinstance(value,str) else value
    if date.tzinfo is None:
        raise ValueError('Absolute UTC identity requires a timezone')
    return date.astimezone(timezone.utc)


def _epochs(variable):
    match = re.fullmatch(r'(seconds?|minutes?|hours?|days?) since (.+)', variable['attrs'].get('units',''), re.I)
    if not match:
        raise ValueError('Unsupported CF absolute time units')
    scale = {'s':1,'m':60,'h':3600,'d':86400}[match[1][0].lower()]
    base = _datetime(match[2]).timestamp()
    return [base+value*scale for value in variable['values']]


def _height(value, units):
    if value is None:
        return None
    if units in ('m','meter','metre','meters','metres'):
        return value
    if units == 'gpm':
        # Standard geopotential height -> approximate geometric height.
        radius = 6356766.0
        return radius*value/(radius-value)
    raise ValueError(f'Unknown height units {units}; do not assume geopotential m²/s²')


def merge_ncss_subsets(*subsets):
    """Combine split variable groups from one attested file/grid/time.

    The caller retains the common dataset URL and raw hashes. Shared CF axes
    must be identical; a nearby model or another forecast cannot be spliced in.
    """
    variables, dimensions = {}, {}
    for subset in subsets:
        for name,size in subset['dimensions']:
            if name in dimensions and dimensions[name] != size:
                raise ValueError(f'NCSS dimension mismatch: {name}')
            dimensions[name] = size
        for name,variable in subset['variables'].items():
            if name in variables:
                old = variables[name]
                if old['dimensions'] != variable['dimensions'] or old['values'] != variable['values'] or old['attrs'].get('units') != variable['attrs'].get('units'):
                    raise ValueError(f'NCSS shared axis/variable mismatch: {name}')
            else:
                variables[name] = variable
    return dict(dimensions=list(dimensions.items()),variables=variables,globalAttrs=subsets[0]['globalAttrs'])


def normalize_ncss_point(decoded, latitude, longitude, run_utc, valid_utc,
                         previous=None, use_interval_mean_precipitation=False):
    variables = decoded['variables']
    valid_epoch, run_epoch = _datetime(valid_utc).timestamp(), _datetime(run_utc).timestamp()
    if not any(abs(value-run_epoch)<1 for value in _epochs(variables['reftime'])):
        raise ValueError('NCSS reference time does not match requested fixed run')
    lat_axis, lon_axis = variables['latitude']['values'], variables['longitude']['values']
    lat_index = min(range(len(lat_axis)), key=lambda i: abs(lat_axis[i]-latitude))
    distance_lon = lambda x: abs((x-longitude+180)%360-180)
    lon_index = min(range(len(lon_axis)), key=lambda i: distance_lon(lon_axis[i]))
    if abs(lat_axis[lat_index]-latitude)>.126 or distance_lon(lon_axis[lon_index])>.126:
        raise ValueError('Requested point is outside its nearest GFS025 cell in this subset')

    def sample(name, pressure=None, height=None):
        variable = variables.get(name)
        if variable is None:
            return None
        flat = 0
        for dimension, size in zip(variable['dimensions'], variable['shape']):
            axis = variables.get(dimension)
            if dimension == 'latitude':
                index = lat_index
            elif dimension == 'longitude':
                index = lon_index
            elif dimension.startswith('time'):
                bounds = variables.get(axis.get('attrs',{}).get('bounds'))
                # Accumulation axes use interval midpoints (e.g. 21Z for
                # 18..24Z), while the native forecast file is valid at 24Z.
                times = (_epochs(dict(attrs=axis['attrs'],values=bounds['values']))[1::2]
                         if bounds else _epochs(axis))
                matches = [i for i,t in enumerate(times) if abs(t-valid_epoch)<1]
                if not matches:
                    raise ValueError(f'Variable {name} has no requested valid time')
                index = matches[0]
            elif dimension.startswith('isobaric'):
                units = axis['attrs'].get('units')
                if units not in ('Pa','hPa','millibar'):
                    raise ValueError('Unrecognized pressure units')
                target = pressure*(100 if units=='Pa' else 1) if pressure is not None else None
                matches = [i for i,v in enumerate(axis['values']) if target is not None and abs(v-target)<.01]
                if not matches:
                    return None
                index = matches[0]
            elif dimension.startswith('height_above_ground'):
                if axis['attrs'].get('units') not in ('m','meter'):
                    raise ValueError('Unrecognized above-ground height units')
                matches = [i for i,v in enumerate(axis['values']) if height is not None and abs(v-height)<.01]
                if not matches:
                    return None
                index = matches[0]
            elif size == 1:
                index = 0
            else:
                raise ValueError(f'Unrecognized non-singleton dimension {dimension}')
            flat = flat*size+index
        value = variable['values'][flat]
        missing = variable['attrs'].get('_FillValue',[])+variable['attrs'].get('missing_value',[])
        return value if math.isfinite(value) and value not in missing else None

    def converted(name, kind, pressure=None, height=None):
        value = sample(name, pressure, height)
        if value is None:
            return None
        unit = variables[name]['attrs'].get('units')
        if kind == 'temperature':
            if unit != 'K':
                raise ValueError('Expected native Kelvin temperature')
            return value-273.15
        if kind == 'height':
            return _height(value,unit)
        if kind == 'percent':
            if unit != '%':
                raise ValueError('Expected native percent')
            return value if 0<=value<=100 else None
        return value

    hourly, units = {'time':[int(valid_epoch)]}, {'time':'unixtime'}
    for field, native in [('cloud_cover_low','Low_cloud_cover_low_cloud'),('cloud_cover_mid','Medium_cloud_cover_middle_cloud'),
                          ('cloud_cover_high','High_cloud_cover_high'),('relative_humidity_2m','Relative_humidity_height_above_ground')]:
        hourly[field] = [converted(native,'percent',height=2)]
        units[field] = '%'
    hourly['temperature_2m'] = [converted('Temperature_height_above_ground','temperature',height=2)]
    units['temperature_2m'] = '°C'
    u, v = sample('u-component_of_wind_height_above_ground',height=10), sample('v-component_of_wind_height_above_ground',height=10)
    for native in ['u-component_of_wind_height_above_ground','v-component_of_wind_height_above_ground']:
        if native in variables and variables[native]['attrs'].get('units') not in ('m/s','m s-1'):
            raise ValueError('Expected native wind m/s')
    hourly['wind_speed_10m'] = [math.hypot(u,v) if u is not None and v is not None else None]
    units['wind_speed_10m'] = 'm/s'
    hourly['visibility'] = [sample('Visibility_surface')]
    units['visibility'] = variables.get('Visibility_surface',{}).get('attrs',{}).get('units','m')
    pressure_values = variables['isobaric']['values']
    pressure_unit = variables['isobaric']['attrs'].get('units')
    if pressure_unit not in ('Pa','hPa','millibar'):
        raise ValueError('Unrecognized pressure coordinate')
    levels = sorted({round(p/(100 if pressure_unit=='Pa' else 1)) for p in pressure_values if 500 <= p/(100 if pressure_unit=='Pa' else 1) <= 1000}, reverse=True)
    for level in levels:
        for field,native,kind,unit in [('cloud_cover','Total_cloud_cover_isobaric','percent','%'),
             ('relative_humidity','Relative_humidity_isobaric','percent','%'),
             ('temperature','Temperature_isobaric','temperature','°C'),
             ('geopotential_height','Geopotential_height_isobaric','height','m')]:
            key = f'{field}_{level}hPa'
            hourly[key], units[key] = [converted(native,kind,pressure=level)], unit
    precip_name = 'Total_precipitation_surface_Mixed_intervals_Accumulation'
    amount, period = sample(precip_name), None
    if amount is not None:
        if variables[precip_name]['attrs'].get('units') not in ('kg.m-2','kg m-2','mm'):
            raise ValueError('Unknown native precipitation amount units')
        time_dimension = next((d for d in variables[precip_name]['dimensions'] if d.startswith('time')),None)
        axis = variables.get(time_dimension,{})
        bounds = variables.get(axis.get('attrs',{}).get('bounds'))
        if bounds:
            times = _epochs(dict(attrs=axis['attrs'],values=bounds['values']))
            period = [times[0],times[-1]]
    if previous and amount is not None and period:
        if 'sourceMetadata' in previous:
            if abs(_datetime(previous['sourceMetadata']['runUtc']).timestamp()-run_epoch)>1:
                raise ValueError('Previous precipitation came from another fixed run')
            earlier = previous['sourceMetadata']['precipitation']
        else:
            instant = previous['variables'].get('time2')
            if instant is None:
                raise ValueError('Previous subset needs an attested instant time axis')
            earlier_epoch = max(_epochs(instant))
            if earlier_epoch >= valid_epoch:
                raise ValueError('Previous precipitation is not earlier than the current forecast')
            earlier = normalize_ncss_point(previous,latitude,longitude,run_utc,
                        datetime.fromtimestamp(earlier_epoch,timezone.utc).isoformat())['sourceMetadata']['precipitation']
        if earlier['periodEpochSeconds'] and earlier['periodEpochSeconds'][0] == period[0] and earlier['amountMm'] is not None:
            if amount+1e-5 < earlier['amountMm']:
                raise ValueError('Precipitation accumulation decreased within the same interval')
            amount, period = max(0,amount-earlier['amountMm']), [earlier['periodEpochSeconds'][1],period[1]]
    duration = (period[1]-period[0])/3600 if period else None
    mean_rate = amount/duration if amount is not None and duration and duration>0 else None
    hourly['precipitation'] = [mean_rate if duration==1 or use_interval_mean_precipitation else None]
    units['precipitation'] = 'mm'
    native_orography = sample('Geopotential_height_surface')
    orography_units = variables.get('Geopotential_height_surface',{}).get('attrs',{}).get('units')
    return dict(latitude=lat_axis[lat_index],longitude=(lon_axis[lon_index]+180)%360-180,
        elevation=_height(native_orography,orography_units),timezone='UTC',utc_offset_seconds=0,
        hourly=hourly,hourly_units=units,sourceMetadata=dict(provider='NCAR GDEX d084001 / native NOAA GFS025',
        model='ncep_gfs025',runUtc=_datetime(run_utc).isoformat(),validUtc=_datetime(valid_utc).isoformat(),
        nativeOrography=dict(value=native_orography,units=orography_units),
        heightConversion='gpm converted to geometric m with radius6356766; native m unchanged',
        sourceUnits={k:v['attrs'].get('units') for k,v in variables.items()},
        fieldMetadata={k:{a:b for a,b in v['attrs'].items() if a in ('units','cell_methods','coordinates','bounds','long_name')}
                       for k,v in variables.items()},
        precipitation=dict(amountMm=amount,periodEpochSeconds=period,intervalHours=duration,
            intervalMeanMmPerHour=mean_rate,usedIntervalMean=use_interval_mean_precipitation,
            qualification='NOT_AN_OBSERVED_OR_INSTANTANEOUS_HOURLY_AMOUNT'),
        missingFields=[k for k,v in hourly.items() if k!='time' and v[0] is None]))
