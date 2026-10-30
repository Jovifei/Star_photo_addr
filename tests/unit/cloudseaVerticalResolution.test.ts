import { describe, expect, it } from "vitest";
import { deriveCloudSeaVerticalEvidence, evaluateCloudSeaWindow } from "@/lib/cloudsea";
import { PRESSURE_LEVELS, type PressureForecastResponse, type PressureLevelSample } from "@/lib/pressure";
import type { CloudSeaSite } from "@/lib/cloudseaSites";

const time = "2026-10-08T14:00";
const site: CloudSeaSite = { id: "summit", name: "Summit", latitude: 44.27, longitude: -71.30, altitude: 1910, area: "test", province: "test", viewpoint: "test", description: "test" };
const sample = (pressure: number, heightMsl: number, cloudy: boolean): PressureLevelSample => ({ pressure, heightMsl, cloudCover: cloudy ? 85 : 5, humidity: cloudy ? 97 : 55, temperature: 10-heightMsl*.006 });
const sparse = [sample(1000,100,false),sample(925,800,false),sample(850,1400,true),sample(700,2965,false),sample(600,4200,false),sample(500,5500,false)];
const dense = [sample(1000,100,false),sample(975,300,false),sample(950,500,true),sample(925,750,true),sample(900,1000,false),sample(850,1500,false),sample(800,2000,false),sample(700,3000,false),sample(600,4200,false),sample(500,5500,false)];
function score(profile: PressureLevelSample[], lowCloud = 90, native = true, nativeLevels: readonly number[] = PRESSURE_LEVELS) {
  const fetchedAt = new Date().toISOString();
  const pressure = Object.assign({ locationId: site.id, modelElevation: 100, timezone: "UTC", utcOffsetSeconds: 0, fetchedAt, source: "Open-Meteo", model: "gfs", stale: false, qualitySchema: "pressure-provider-issues-v1", qualityValidatorVersion: "pressure-validator-v1", qualityValidatedAt: fetchedAt, hourly: [{time,temperature:10}], profiles: {[time]:profile} } as PressureForecastResponse,
    native ? { nativeGridElevationM: 100, verticalReference: "native-grid-v2", qualifiedPressureLevels: nativeLevels } : {});
  return evaluateCloudSeaWindow(site,{time:[time],cloud_cover_low:[lowCloud],cloud_cover_mid:[5],cloud_cover_high:[5],relative_humidity_2m:[98],wind_speed_10m:[2],precipitation:[0]},[14],pressure,"2026-10-08");
}
describe("CloudSea actual cloud-top resolution",()=>{
  it("does not turn an unresolved 1400–2965m cloud top into a 1910m summit high score",()=>{
    const result=score(sparse);
    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.summary).toContain("未解析");
    expect(deriveCloudSeaVerticalEvidence(sparse,100,1910)).toMatchObject({profileAvailable:true,resolution:"ambiguous"});
  });
  it("keeps a resolved below-summit cloud deck despite surface low-cloud zero",()=>{
    const result=score(dense,0);
    expect(result.cloudPosition).toBe("above");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.cloudTopM).toBe(750);
    expect(result.cloudTopUpperM).toBe(1000);
    expect(result.altitudeDiffM).toBe(910);
  });
  it("does not use an unproven/default DEM as native grid orography",()=>{
    expect(score(dense,90,false).score).toBeNull();
  });
  it("treats another cloudy deck or its transition enclosing the summit as obstruction or unknown",()=>{
    const multiple=dense.map(x=>x.pressure===850?sample(850,1500,true):x);
    expect(score(multiple).cloudPosition).not.toBe("above");
    expect(score(multiple).score ?? 0).toBeLessThan(60);
  });
  it("does not turn humidity-only moisture into positive cloud-sea support",()=>{
    const moist=dense.map(x=>({...x,cloudCover:5}));
    expect(score(moist).score ?? 0).toBeLessThan(60);
  });
  it("requires actual sampling near the summit, not merely six distant complete levels",()=>{
    const highSite={...site,altitude:3660};
    const evidence=deriveCloudSeaVerticalEvidence(dense,100,highSite.altitude);
    expect(evidence).toMatchObject({profileAvailable:true,resolution:"ambiguous"});
  });
  it("uses dense thermodynamic clear bounds without inventing missing cloud fractions",()=>{
    const profile=[...sparse,{...sample(825,1750,false),cloudCover:null},{...sample(800,2000,false),cloudCover:null}];
    const result=score(profile);
    expect(result.cloudPosition).toBe("above");
    expect(result.cloudTopUpperM).toBe(1750);
    expect(result.altitudeDiffM).toBe(160);
    const moist=profile.map(level=>level.cloudCover===null?{...level,humidity:88}:level);
    expect(score(moist).cloudPosition).toBe("unknown");
  });
  it("does not assume summit clearance inside thermodynamic-only moist samples",()=>{
    const unresolved=dense.map(level=>[825,800].includes(level.pressure)?{...level,cloudCover:null,humidity:88}:level);
    unresolved.push({...sample(825,1750,false),cloudCover:null,humidity:88});
    expect(score(unresolved).cloudPosition).toBe("unknown");
  });
  it("does not use additional unqualified levels to claim validated resolution",()=>{
    const profile=[...sparse,{...sample(825,1750,false),cloudCover:null},{...sample(800,2000,false),cloudCover:null}];
    expect(score(profile,90,true,[1000,975,950,925,900,850,800,750,700,650,600,550,500]).cloudPosition).toBe("unknown");
  });
  it("reports conservative integer bounds for fractional model heights",()=>{
    const result=score(dense.map(level=>level.pressure===900?{...level,heightMsl:1000.2}:level));
    expect(result.cloudTopUpperM).toBe(1001);
    expect(result.altitudeDiffM).toBe(909);
  });
  it("keeps a single sampled cloud layer's displayed base below its top",()=>{
    const profile=dense.map(level=>({...level,
      heightMsl:level.pressure===900?1026:level.heightMsl,
      cloudCover:level.pressure===900?85:0,
      humidity:level.pressure===900?97:55,
    }));
    const result=score(profile);
    expect(result.cloudPosition).toBe("above");
    expect(result.cloudBaseM).toBe(1000);
    expect(result.cloudBaseM!).toBeLessThanOrEqual(result.cloudTopM!);
  });
  it("always clears the cloud-top upper bound even when sampled-layer rounding says above",()=>{
    const profile=[sample(1000,100,false),sample(975,500,false),sample(950,1000,false),sample(925,1724,true),sample(900,1800,false),sample(850,1900,false),sample(800,2500,false),sample(700,3100,false)];
    expect(deriveCloudSeaVerticalEvidence(profile,0,1860)).toMatchObject({profileAvailable:true,resolution:"ambiguous",layer:null});
  });
  it("does not treat low cloud fraction with humid air as a clear cloud-top bound",()=>{
    const profile=[
      {...sample(1000,186,false),cloudCover:0,humidity:86.1},
      {...sample(975,401,false),cloudCover:0,humidity:86.1},
      {...sample(950,620,false),cloudCover:0,humidity:86.1},
      {...sample(925,844,false),cloudCover:0,humidity:86.1},
      {...sample(900,1073,false),cloudCover:0,humidity:86.1},
      {...sample(850,1549,false),cloudCover:0,humidity:86.1},
      {...sample(800,2049,false),cloudCover:13.8,humidity:89.7},
      {...sample(775,2308,false),cloudCover:47,humidity:96.5},
      {...sample(750,2574,false),cloudCover:58.2,humidity:96.6},
      {...sample(725,2848,false),cloudCover:2.5,humidity:84.6},
      {...sample(700,3130,false),cloudCover:14,humidity:80.6},
      {...sample(650,3722,false),cloudCover:0.3,humidity:44.9},
    ];
    expect(deriveCloudSeaVerticalEvidence(profile,1945.6,3106)).toMatchObject({profileAvailable:true,resolution:"ambiguous",layer:null});
    const pressure=Object.assign({locationId:site.id,modelElevation:1945.6,timezone:"UTC",utcOffsetSeconds:0,fetchedAt:new Date().toISOString(),source:"Open-Meteo",model:"gfs",stale:false,qualitySchema:"pressure-provider-issues-v1",qualityValidatorVersion:"pressure-validator-v1",qualityValidatedAt:new Date().toISOString(),hourly:[{time,temperature:10}],profiles:{[time]:profile}} as PressureForecastResponse,{
      nativeGridElevationM:1945.6,verticalReference:"native-grid-v2",qualifiedPressureLevels:PRESSURE_LEVELS,
    });
    const result=evaluateCloudSeaWindow({...site,altitude:3106},{time:[time],cloud_cover_low:[100],cloud_cover_mid:[5],cloud_cover_high:[5],relative_humidity_2m:[90],wind_speed_10m:[2.8],precipitation:[0]},[14],pressure,"2026-10-08");
    expect(result.score).toBeNull();
  });
  it("never promotes a cloudy sample below attested native terrain",()=>{
    const profile=dense.map(level=>({...level,cloudCover:level.pressure===975?85:0,humidity:level.pressure===975?97:50}));
    expect(deriveCloudSeaVerticalEvidence(profile,325,1910).layer).toBeNull();
  });
});
