import { writeFileSync, mkdirSync } from "node:fs";
import { PRESET_LOCATIONS } from "../src/data/locations.js";
import { fetchPressureForecast, fetchSurfaceForecasts } from "../src/lib/openMeteo.js";

const loc = PRESET_LOCATIONS[0];
const surface = (await fetchSurfaceForecasts([loc], 14))[0];
const pressure = await fetchPressureForecast(loc, 7);

mkdirSync("tests/e2e/fixtures", { recursive: true });
writeFileSync(
  "tests/e2e/fixtures/open-meteo.json",
  JSON.stringify({ surface, pressure }, null, 2),
);
console.log(
  `captured: surface hours=${surface.hourly.length} elevation=${surface.modelElevation}m; pressure levels=${Object.values(pressure.profiles)[0].length}`,
);
