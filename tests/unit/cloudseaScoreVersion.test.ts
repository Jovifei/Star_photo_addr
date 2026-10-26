import { describe, expect, it } from "vitest";
import * as cloudsea from "@/lib/cloudsea";

describe("CloudSea browser score qualification",()=>{
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
