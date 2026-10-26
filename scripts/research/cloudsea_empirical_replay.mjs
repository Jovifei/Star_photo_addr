// Research-only replay: the production scorer is unchanged. All matching is UTC.
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
registerHooks({ resolve(specifier, context, next) {
  let target;
  if (specifier.startsWith('@/')) target = path.join(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) target = fileURLToPath(new URL(specifier, context.parentURL));
  if (target && !path.extname(target)) {
    for (const suffix of ['.ts', '.js', '/index.ts']) {
      if (fs.existsSync(target + suffix)) return next(pathToFileURL(target + suffix).href, context);
    }
  }
  return next(specifier, context);
} });
const { evaluateCloudSeaWindow } = await import(pathToFileURL(path.join(root, 'src/lib/cloudsea.ts')).href);
const { parsePressureForecast } = await import(pathToFileURL(path.join(root, 'src/lib/pressure.ts')).href);
const out = path.join(root, 'reports/empirical-calibration-20261024', ...(process.argv.includes('--october') ? ['october'] : []));
const suffix = process.argv.includes('--native') ? '-native' : '';
const sites = JSON.parse(fs.readFileSync(path.join(out, 'sites.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(out, `forecast-manifest${suffix}.json`), 'utf8'));
const rows = [];
for (const item of manifest) {
  if (item.status !== 'OK') throw new Error(`Invalid manifest: ${item.validDate}`);
  const rawText = fs.readFileSync(item.path, 'utf8');
  if (createHash('sha256').update(rawText).digest('hex') !== item.sha256) throw new Error('Raw forecast hash mismatch');
  const payload = JSON.parse(rawText);
  for (const [si, site] of sites.entries()) {
    const raw = payload[si];
    for (const [field, unit] of Object.entries({time:'unixtime', relative_humidity_2m:'%', cloud_cover_low:'%', cloud_cover_mid:'%', cloud_cover_high:'%', wind_speed_10m:'m/s', precipitation:'mm'})) {
      if (raw.hourly_units[field] !== unit) throw new Error(`Unexpected ${field} units`);
    }
    const pressure = parsePressureForecast(raw, site.id, 'gfs');
    const hourly = { ...raw.hourly, time: pressure.hourly.map(h => h.time) };
    const runEpoch = Date.parse(item.runUtc) / 1000;
    let count = 0;
    for (const [index, epoch] of raw.hourly.time.entries()) {
      const leadHours = (epoch - runEpoch) / 3600;
      if (leadHours < 24 || leadHours >= 48) continue;
      const time = new Date(epoch * 1000).toISOString();
      if (!time.startsWith(item.validDate)) throw new Error('UTC valid date mismatch');
      const result = evaluateCloudSeaWindow(site, hourly, [Number(time.slice(11, 13))], pressure, item.validDate);
      if (pressure.hourly[index].epochSeconds !== epoch) throw new Error('Pressure time mismatch');
      const profile = pressure.profilesByEpoch[String(epoch)];
      const completeLevels = profile.filter(level => [level.cloudCover, level.humidity, level.temperature, level.heightMsl].every(Number.isFinite));
      const aboveTop = result.cloudTopM === null ? [] : completeLevels.filter(level => level.heightMsl > result.cloudTopM + 25 && level.cloudCover < 55 && level.humidity < 90).sort((a,b) => a.heightMsl-b.heightMsl);
      const nextClearLevelM = aboveTop[0]?.heightMsl ?? null;
      rows.push({ site: site.id, epoch, time, date: item.validDate, runUtc: item.runUtc, leadHours,
        split: item.validDate <= '2026-09-20' ? 'train' : 'test', score: result.score,
        position: result.cloudPosition, cloudBaseM: result.cloudBaseM, cloudTopM: result.cloudTopM,
        altitudeDiffM: result.altitudeDiffM, pressureStatus: result.pressureStatus, coverage: result.coverage,
        rh: raw.hourly.relative_humidity_2m[index], lowCloud: raw.hourly.cloud_cover_low[index],
        precipitation: raw.hourly.precipitation[index], wind: raw.hourly.wind_speed_10m[index],
        responseElevation: raw.elevation, stationElevation: site.altitude,
        latitude: raw.latitude, longitude: raw.longitude,
        completePressureLevels: completeLevels.map(level => level.pressure),
        nextClearLevelM,
        summitWithinUnresolvedCloudTop: result.cloudPosition === 'above' && (nextClearLevelM === null || site.altitude < nextClearLevelM),
      });
      count++;
    }
    if (count !== 24) throw new Error(`Expected 24 valid hours: ${site.id} ${item.validDate} got ${count}`);
  }
}
fs.writeFileSync(path.join(out, `forecast-scores${suffix}.json`), JSON.stringify(rows, null, 2));
console.log(JSON.stringify({ rows: rows.length, dates: manifest.length, sites: sites.length,
  nullScores: rows.filter(r => r.score === null).length, artifact: `forecast-scores${suffix}.json` }));
