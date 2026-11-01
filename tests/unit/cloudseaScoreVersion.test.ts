import { describe, expect, it } from "vitest";
import * as cloudsea from "@/lib/cloudsea";

describe("CloudSea browser score qualification",()=>{
  it.each(["cs-taizijian","cs-qianniugang","cs-longwangshan","cs-guniujiang","cs-lushan","cs-donglingshan"])(
    "withholds old-coordinate weather for %s", id=>{
      const win={...cloudsea.CLOUD_SEA_EMPTY_WINDOW,score:94,lowCloud:85,humidity:90,
        coverage:{expectedHours:4,surfaceValidHours:4,scoreableHours:4,pressureHours:4}};
      const snapshot={date:"2026-11-01",model:"gfs",scoreVersion:"cloudsea-native-conservative-v3",generatedAt:new Date().toISOString(),source:"cached",stale:false,
        sites:{[id]:{morning:win,evening:win}}} as cloudsea.CloudSeaSnapshot;
      expect(cloudsea.qualifyCloudSeaSnapshot(snapshot).sites[id].morning).toMatchObject({
        score:null,lowCloud:null,humidity:null,coverage:{expectedHours:4,surfaceValidHours:0,pressureHours:0},
      });
    });
  it("handles a legacy provenance object without a source map",()=>{
    const win={...cloudsea.CLOUD_SEA_EMPTY_WINDOW,score:94,lowCloud:85};
    const snapshot={date:"2026-11-01",model:"gfs",scoreVersion:"cloudsea-native-conservative-v3",generatedAt:new Date().toISOString(),source:"cached",stale:false,
      provenance:{version:1},sites:{"cs-lushan":{morning:win,evening:win}}} as unknown as cloudsea.CloudSeaSnapshot;
    expect(cloudsea.qualifyCloudSeaSnapshot(snapshot).sites["cs-lushan"].morning).toMatchObject({score:null,lowCloud:null});
  });
  it("withholds v3 scores made with the former Taizijian coordinates",()=>{
    const win={...cloudsea.CLOUD_SEA_EMPTY_WINDOW,score:94,peakScore:94,lowCloud:85,midCloud:10,highCloud:5,humidity:90,windSpeed:2,
      pressureStatus:"available" as const,coverage:{expectedHours:4,surfaceValidHours:4,scoreableHours:4,pressureHours:4}};
    const sourceTime={provider:"Open-Meteo" as const,dataset:"surface" as const,model:"gfs" as const,sourceFetchedAt:"2026-11-01T00:00:00Z",providerRunAt:null,observedAt:null};
    const snapshot={date:"2026-11-01",model:"gfs",scoreVersion:"cloudsea-native-conservative-v3",generatedAt:new Date().toISOString(),source:"cached",stale:false,
      pressureQualitySchema:"pressure-provider-issues-v1",pressureQualityValidatorVersion:"pressure-validator-v1",
      surface:{status:"available",availableSites:2,totalSites:2,failedSites:0},
      pressure:{status:"available",receivedSites:2,partialSites:0,availableSites:2,totalSites:2,failedSites:0},
      provenance:{version:1,sourcesBySite:{"cs-taizijian":[sourceTime],"cs-fuzhishan":[sourceTime]}},
      sites:{"cs-taizijian":{morning:win,evening:win},"cs-fuzhishan":{morning:win,evening:win}}} as cloudsea.CloudSeaSnapshot;
    const result=cloudsea.qualifyCloudSeaSnapshot(snapshot);
    expect(result.stale).toBe(true);
    expect(result.sites["cs-taizijian"].morning).toMatchObject({score:null,peakScore:null,lowCloud:null,humidity:null,windSpeed:null,
      pressureStatus:"unavailable",coverage:{expectedHours:4,surfaceValidHours:0,scoreableHours:0,pressureHours:0}});
    expect(result.sites["cs-fuzhishan"].morning).toMatchObject({score:null,lowCloud:85});
    expect(result.surface).toMatchObject({status:"partial",availableSites:1,totalSites:2,failedSites:1});
    expect(result.pressure).toMatchObject({status:"partial",receivedSites:1,availableSites:1,totalSites:2,failedSites:1});
    expect(result.provenance?.sourcesBySite["cs-taizijian"]).toEqual([]);
    expect(snapshot.sites["cs-taizijian"].morning.score).toBe(94);

    const missing = {...win,humidity:undefined} as unknown as cloudsea.CloudSeaWindowScore;
    const incomplete = cloudsea.qualifyCloudSeaSnapshot({...snapshot,sites:{
      "cs-taizijian":{morning:win,evening:win},"cs-fuzhishan":{morning:missing,evening:missing},
    }});
    expect(incomplete.surface).toMatchObject({status:"unavailable",availableSites:0,totalSites:2,failedSites:2});
    const invalid = {...win,humidity:101};
    const outOfRange = cloudsea.qualifyCloudSeaSnapshot({...snapshot,sites:{
      "cs-taizijian":{morning:win,evening:win},"cs-fuzhishan":{morning:invalid,evening:invalid},
    }});
    expect(outOfRange.surface).toMatchObject({status:"unavailable",availableSites:0,totalSites:2,failedSites:2});
  });
  it("withholds the pre-RH75 cached scoring version",()=>{
    const win={...cloudsea.CLOUD_SEA_EMPTY_WINDOW,score:94,peakScore:94,lowCloud:85};
    const snapshot={date:"2026-10-26",model:"gfs",scoreVersion:"cloudsea-native-resolution-v2",generatedAt:new Date().toISOString(),source:"cached",stale:false,sites:{x:{morning:win,evening:win}}} as cloudsea.CloudSeaSnapshot;
    expect(cloudsea.qualifyCloudSeaSnapshot(snapshot).sites.x.morning).toMatchObject({score:null,peakScore:null,lowCloud:85});
  });
  it("withholds a legacy cached high score while preserving weather facts",()=>{
    expect(typeof cloudsea.qualifyCloudSeaSnapshot).toBe("function");
    const win={...cloudsea.CLOUD_SEA_EMPTY_WINDOW,score:94,peakScore:98,conditionLabel:"94/100",lowCloud:85};
    const snapshot={date:"2026-10-25",model:"gfs",generatedAt:new Date().toISOString(),source:"Open-Meteo",stale:false,sites:{x:{morning:win,evening:win}}} as cloudsea.CloudSeaSnapshot;
    const result=cloudsea.qualifyCloudSeaSnapshot(snapshot);
    expect(result.sites.x.morning).toMatchObject({score:null,peakScore:null,cloudPosition:"unknown",lowCloud:85});
    expect(result.stale).toBe(true);
    expect(result.refreshError).toContain("评分版本");
    expect(cloudsea.qualifyCloudSeaSnapshot({...snapshot,scoreVersion:cloudsea.CLOUD_SEA_SCORE_VERSION})).toMatchObject({stale:false,sites:{x:{morning:{score:94}}}});
  });
});
