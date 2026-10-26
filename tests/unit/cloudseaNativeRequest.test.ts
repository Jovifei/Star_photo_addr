import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPressureForecastBatchUrl, fetchPressureForecastBatch, parsePressureForecast, PRESSURE_LEVELS } from "@/lib/pressure";
import { providerUnits } from "../fixtures/providerUnits";
afterEach(()=>vi.unstubAllGlobals());

function nativeResponses(){
  const time=[Date.parse("2026-10-25T05:00+08:00")/1000];
  const hourly:Record<string,unknown>={time,cloud_cover_low:[null],cloud_cover_mid:[null],cloud_cover_high:[null],relative_humidity_2m:[null],wind_speed_10m:[null],precipitation:[null]};
  for(const level of PRESSURE_LEVELS){hourly[`cloud_cover_${level}hPa`]=[10];hourly[`relative_humidity_${level}hPa`]=[50];hourly[`temperature_${level}hPa`]=[5];hourly[`geopotential_height_${level}hPa`]=[100+(1000-level)*10];}
  const pressure={latitude:44.25,longitude:-71.25,elevation:775,timezone:"Asia/Shanghai",utc_offset_seconds:28800,hourly,hourly_units:providerUnits("unixtime")};
  const surface={...pressure,latitude:44.223892,elevation:791,hourly:{time,cloud_cover_low:[80],cloud_cover_mid:[10],cloud_cover_high:[5],relative_humidity_2m:[85],wind_speed_10m:[2],precipitation:[0]}};
  return {pressure,surface};
}

describe("request-attested CloudSea native height",()=>{
  it("keeps GFS025 pressure terrain separate when surface fields require GFS013",async()=>{
    const {pressure,surface}=nativeResponses();
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(new URL(String(input)).searchParams.get("models")==="ncep_gfs013"?surface:pressure),{status:200}));
    vi.stubGlobal("fetch",fetcher);
    const result=await fetchPressureForecastBatch([{id:"x",latitude:44.27,longitude:-71.30}],"2026-10-25",undefined,"gfs",true);
    expect(result.surface?.x.cloud_cover_low).toEqual([80]);
    expect(result.surface?.x.sourceGrid).toMatchObject({providerModel:"ncep_gfs013",elevation:791});
    expect(result.data.x).toMatchObject({nativeGridElevationM:775,providerModel:"ncep_gfs025"});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("requests native terrain and surface/pressure together for CloudSea",()=>{
    const url=new URL(buildPressureForecastBatchUrl([{id:"x",latitude:44.27,longitude:-71.30},{id:"y",latitude:51.8,longitude:10.6}],"2026-10-25","gfs",true));
    expect(url.searchParams.get("elevation")).toBe("nan,nan");
    expect(url.searchParams.get("hourly")).toContain("cloud_cover_low");
    expect(url.searchParams.get("hourly")).toContain("geopotential_height_825hPa");
    expect(url.searchParams.get("wind_speed_unit")).toBe("ms");
    expect(url.searchParams.get("models")).toBe("ncep_gfs025");
    expect(url.searchParams.get("cell_selection")).toBe("nearest");
  });
  it("does not infer native terrain from an ordinary API elevation field",()=>{
    const hourly:Record<string,unknown>={time:[1792886400]};
    for(const level of PRESSURE_LEVELS){
      hourly[`cloud_cover_${level}hPa`]=[10];hourly[`relative_humidity_${level}hPa`]=[50];
      hourly[`temperature_${level}hPa`]=[5];hourly[`geopotential_height_${level}hPa`]=[1000+(1000-level)*10];
    }
    const raw={elevation:1306,timezone:"UTC",utc_offset_seconds:0,hourly,hourly_units:providerUnits("unixtime")};
    expect(parsePressureForecast(raw,"x","gfs").nativeGridElevationM).toBeUndefined();
    expect(parsePressureForecast(raw,"x","gfs",true)).toMatchObject({nativeGridElevationM:1306,verticalReference:"native-grid-v2"});
  });
  it("rejects finite no-data elevation sentinels and impossible ground heights",()=>{
    const {pressure}=nativeResponses();
    for(const elevation of [-9999,10001])expect(()=>parsePressureForecast({...pressure,elevation},"x","gfs",true)).toThrow(/elevation/);
  });
  it.each([503,"count",429] as const)("retains native pressure facts if surface fallback fails: %s",async(failure)=>{
    const {pressure}=nativeResponses();
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
      if(new URL(String(input)).searchParams.get("models")==="ncep_gfs025")return Response.json(pressure);
      return failure==="count"?Response.json([]):Response.json({reason:"surface unavailable"},{status:failure,headers:{"Retry-After":"1"}});
    }));
    const result=await fetchPressureForecastBatch([{id:"x",latitude:44.27,longitude:-71.30}],"2026-10-25",undefined,"gfs",true);
    expect(result.data.x.nativeGridElevationM).toBe(775);
    expect(result.surface?.x.cloud_cover_low).toEqual([null]);
    expect(result.surfaceErrors?.x).toEqual(expect.any(String));
  });
});
