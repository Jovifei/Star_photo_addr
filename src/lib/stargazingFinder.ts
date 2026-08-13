import type {
  FinderAnalysis,
  FinderEvaluation,
  FinderHour,
  FinderHourlyData,
  FinderLocation,
  FinderMode,
  FinderRating,
  FinderWeatherRecord,
} from "./stargazingFinderTypes";

export const FINDER_SOURCE = "darkmap.cn / IUCN / 中国绿发会 / VIIRS";

const WMO_CODE_MAP: Record<number, { type: string; cloudy: boolean }> = {
  0: { type: "晴", cloudy: false },
  1: { type: "少云", cloudy: false },
  2: { type: "多云", cloudy: true },
  3: { type: "阴", cloudy: true },
  45: { type: "雾", cloudy: true },
  48: { type: "雾凇", cloudy: true },
  51: { type: "毛毛雨", cloudy: true },
  53: { type: "毛毛雨", cloudy: true },
  55: { type: "毛毛雨", cloudy: true },
  56: { type: "冻毛毛雨", cloudy: true },
  57: { type: "冻毛毛雨", cloudy: true },
  61: { type: "小雨", cloudy: true },
  63: { type: "中雨", cloudy: true },
  65: { type: "大雨", cloudy: true },
  66: { type: "冻雨", cloudy: true },
  67: { type: "冻雨", cloudy: true },
  71: { type: "小雪", cloudy: true },
  73: { type: "中雪", cloudy: true },
  75: { type: "大雪", cloudy: true },
  77: { type: "雪粒", cloudy: true },
  80: { type: "阵雨", cloudy: true },
  81: { type: "阵雨", cloudy: true },
  82: { type: "阵雨", cloudy: true },
  85: { type: "阵雪", cloudy: true },
  86: { type: "阵雪", cloudy: true },
  95: { type: "雷暴", cloudy: true },
  96: { type: "雷暴", cloudy: true },
  99: { type: "雷暴", cloudy: true },
};

export function wmoToType(code: number | null): string {
  return code === null ? "—" : WMO_CODE_MAP[code]?.type ?? "未知";
}

export function wmoIsCloudy(code: number | null): boolean {
  return code === null ? true : WMO_CODE_MAP[code]?.cloudy ?? true;
}

function isoDatePlusDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nullable(values: Array<number | null> | undefined, index: number): number | null {
  return values?.[index] ?? null;
}

export function analyzeFinderNightWeather(
  targetDate: string,
  hourlyData: FinderHourlyData | null,
  mode: FinderMode,
): FinderAnalysis | null {
  if (!hourlyData?.time?.length) return null;
  const nextDate = isoDatePlusDays(targetDate, 1);
  const nightHours: FinderHour[] = [];
  const preHours: FinderHour[] = [];
  const postHours: FinderHour[] = [];

  hourlyData.time.forEach((time, index) => {
    const date = time.slice(0, 10);
    const hour = Number(time.slice(11, 13));
    const cloudLow = nullable(hourlyData.cloud_cover_low, index);
    const cloudMid = nullable(hourlyData.cloud_cover_mid, index);
    const cloudHigh = nullable(hourlyData.cloud_cover_high, index);
    const cloud = nullable(hourlyData.cloud_cover, index);
    const weatherCode = nullable(hourlyData.weather_code, index);
    const hasCompleteLayerData = cloudLow !== null && cloudMid !== null && cloudHigh !== null;
    const cloudy = hasCompleteLayerData
      ? cloudLow + cloudMid > (mode === "visual" ? 30 : 10) || cloudHigh > (mode === "visual" ? 70 : 30)
      : cloud !== null
        ? cloud > (mode === "visual" ? 50 : 30) || wmoIsCloudy(weatherCode)
        : wmoIsCloudy(weatherCode);
    const item: FinderHour = {
      time,
      timeLabel: time.slice(11, 16),
      date,
      hour,
      code: weatherCode,
      type: wmoToType(weatherCode),
      cloudy,
      cloud,
      cloudLow,
      cloudMid,
      cloudHigh,
      precip: nullable(hourlyData.precipitation, index),
      wind: nullable(hourlyData.wind_speed_10m, index),
      gust: nullable(hourlyData.wind_gusts_10m, index),
    };
    if ((date === targetDate && hour >= 19) || (date === nextDate && hour <= 4)) {
      nightHours.push(item);
    } else if (date === targetDate && hour >= 7 && hour <= 18) {
      preHours.push(item);
    } else if (date === nextDate && hour >= 4 && hour <= 15) {
      postHours.push(item);
    }
  });

  const cloudyTimes = (items: FinderHour[]) => items.filter((item) => item.cloudy).map((item) => `${item.timeLabel}(${item.type})`).join(", ");
  const nightCloudy = nightHours.filter((item) => item.cloudy);
  const preCloudy = preHours.filter((item) => item.cloudy);
  const postCloudy = postHours.filter((item) => item.cloudy);
  const visualNight = nightHours.filter((item) => (item.date === targetDate && item.hour >= 19) || (item.date === nextDate && item.hour === 0));
  const visualCloudy = visualNight.filter((item) => item.cloudy);
  const windValues = nightHours.flatMap((item) => item.wind === null ? [] : [item.wind]);
  const gustValues = nightHours.flatMap((item) => item.gust === null ? [] : [item.gust]);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const max = (values: number[]) => values.length ? Math.max(...values) : null;

  return {
    nightHours,
    preHours,
    postHours,
    nightCloudyCount: nightCloudy.length,
    nightTotal: nightHours.length,
    nightCloudyPct: nightHours.length ? nightCloudy.length / nightHours.length : 1,
    nightAllClear: nightCloudy.length === 0 && nightHours.length > 0,
    nightCloudyTimes: cloudyTimes(nightHours),
    preCloudyCount: preCloudy.length,
    preAllClear: preCloudy.length === 0 && preHours.length > 0,
    preCloudyTimes: cloudyTimes(preHours),
    postCloudyCount: postCloudy.length,
    postAllClear: postCloudy.length === 0 && postHours.length > 0,
    postCloudyTimes: cloudyTimes(postHours),
    nightMaxWind: max(windValues),
    nightAvgWind: average(windValues),
    strongWindTimes: nightHours.filter((item) => item.wind !== null && item.wind > 10).map((item) => `${item.timeLabel}(${item.wind?.toFixed(1)}m/s)`).join(", "),
    nightMaxGust: max(gustValues),
    strongGustTimes: nightHours.filter((item) => item.gust !== null && item.gust > 10).map((item) => `${item.timeLabel}(${item.gust?.toFixed(1)}m/s)`).join(", "),
    visualNightTotal: visualNight.length,
    visualCloudyCount: visualCloudy.length,
    visualCloudyPct: visualNight.length ? visualCloudy.length / visualNight.length : 1,
    visualAllClear: visualCloudy.length === 0 && visualNight.length > 0,
    visualCloudyTimes: cloudyTimes(visualNight),
    mode,
  };
}

export function evaluateFinderRating(analysis: FinderAnalysis | null, mode: FinderMode): FinderRating {
  if (!analysis || analysis.nightTotal === 0) return "unknown";
  const allClear = mode === "visual" ? analysis.visualAllClear : analysis.nightAllClear;
  const cloudyPct = mode === "visual" ? analysis.visualCloudyPct : analysis.nightCloudyPct;
  let rating: FinderRating = allClear && analysis.preAllClear && analysis.postAllClear
    ? "perfect"
    : allClear
      ? "great"
      : cloudyPct < 0.3
        ? "good"
        : cloudyPct <= 0.5 ? "fair" : "poor";
  if (analysis.nightMaxWind !== null && analysis.nightMaxWind > 8) {
    const levels: FinderRating[] = ["perfect", "great", "good", "fair", "poor"];
    rating = levels[Math.min(levels.indexOf(rating) + 2, levels.length - 1)] ?? "poor";
  }
  return rating;
}

export function finderRatingScore(rating: FinderRating, analysis: FinderAnalysis | null): number | null {
  if (rating === "unknown" || !analysis) return null;
  const cloudPct = analysis.mode === "visual" ? analysis.visualCloudyPct : analysis.nightCloudyPct;
  const base = { perfect: 96, great: 86, good: 74, fair: 58, poor: 28 }[rating];
  return Math.max(0, Math.min(100, Math.round(base - cloudPct * 10)));
}

export function buildFinderRatingDetail(rating: FinderRating, analysis: FinderAnalysis | null, mode: FinderMode): string {
  if (!analysis || rating === "unknown") return "等待天气数据";
  const pct = Math.round((mode === "visual" ? analysis.visualCloudyPct : analysis.nightCloudyPct) * 100);
  const times = mode === "visual" ? analysis.visualCloudyTimes : analysis.nightCloudyTimes;
  const period = mode === "visual" ? "前半夜 19:00–00:00" : "夜间 19:00–04:00";
  if (rating === "perfect") return `${period}全晴，前后 12 小时全晴，完美观星条件`;
  if (rating === "great") return `${period}全晴，前后时段仍有云量变化`;
  if (rating === "good") return `${period}有云 ${pct}%${times ? `（${times}）` : ""}，基本可观测`;
  if (rating === "fair") return `${period}有云 ${pct}%${times ? `（${times}）` : ""}，观测条件一般`;
  return `${period}有云 ${pct}%${times ? `（${times}）` : ""}，不适合观测`;
}

const DANGER_LOCATIONS: Record<string, string> = {
  "泰山日观峰": "登山事故频发，每年数起坠崖事件",
  "黄山光明顶": "多起坠崖事故，部分路段险峻",
  "张家界天门山": "玻璃栈道危险，曾发生跳崖事件",
  "武功山金顶": "反穿路线迷路失温事故",
  "稻城亚丁": "高反死亡事故，违规穿越风险大",
  "贡嘎山西噶措": "徒步路线危险，多次山难事故",
  "香格里拉梅里雪山": "雨崩雪崩风险",
  "雅安牛背山": "山路险峻，徒步路线危险",
  "珠峰大本营": "极高海拔生命危险",
  "纳木错": "高反风险大，夜间极寒",
  "长白山天池": "山顶气候多变，迷路风险",
  "太白山": "高海拔徒步需专业装备",
  "五台山台顶": "台顶风大温差大，迷路风险",
  "神农架大九湖": "原始森林山区迷路风险",
};

const UNDERDEVELOPED_LOCATIONS = new Set([
  "阿里暗夜公园", "那曲暗夜公园", "纳木错", "珠峰大本营", "羊卓雍措", "林芝巴松措", "冷湖天文台", "玉树三江源", "果洛玛多", "茫崖俄博梁", "格尔木胡杨林", "大柴旦翡翠湖", "祁连山卓尔山", "门源仙米林场", "乌兰茶卡盐湖", "塔什库尔干", "喀什塔什库尔干", "和田民丰", "巴州且末", "罗布人村寨", "哈密巴里坤", "乌伦古湖", "稻城亚丁", "理塘毛垭草原", "贡嘎山西噶措", "色达五明佛学院", "党岭葫芦海", "甘孜措普沟", "怒江丙中洛", "保山腾冲", "巴丹吉林沙漠", "阿拉善巴丹吉林", "额济纳旗", "腾格里沙漠通湖", "呼伦贝尔陈巴尔虎", "库布齐沙漠", "漠河北极村", "大兴安岭呼中", "呼中苍山", "塔河十八站", "鹤岗萝北", "双鸭山饶河", "佳木斯同江", "敦煌雅丹", "白城通榆", "集安太极湾", "巫溪红池坝", "酉阳菖蒲盖", "黔东南雷公山", "龙南九连山", "上犹五指峰", "来宾金秀", "神农架大九湖",
]);

export function evaluateFinderHighAltWarning(location: FinderLocation) {
  const match = location.reason.match(/(?:海拔|平均海拔)\s*(\d{3,5})\s*(?:m|米)/);
  const altitude = location.elevation ?? (match ? Number(match[1]) : null);
  if (altitude === null) return null;
  if (altitude >= 4000) return { text: `高海拔地区（${altitude}m），注意高原反应和低温`, level: "danger", altitude };
  if (altitude >= 3000) return { text: `高海拔地区（${altitude}m），注意高原反应和低温`, level: "warning", altitude };
  if (altitude >= 2500) return { text: `中高海拔（${altitude}m），注意保暖`, level: "caution", altitude };
  if (altitude >= 2000) return { text: `高海拔（${altitude}m），注意保暖`, level: "info", altitude };
  return null;
}

export function evaluateFinderWindWarning(analysis: FinderAnalysis | null) {
  if (!analysis || analysis.nightMaxWind === null) return null;
  const wind = analysis.nightMaxWind;
  if (wind < 3.4) return { text: "夜间平均风速微风，观星条件优秀", level: "good" };
  if (wind < 8) return { text: "夜间平均风力适中，观星不受影响", level: "ok" };
  if (wind < 10.8) return { text: "夜间平均清风，注意保暖和三脚架稳定", level: "caution" };
  if (wind < 13.9) return { text: "夜间平均强风，设备晃动风险大", level: "warning" };
  if (wind < 17.2) return { text: "夜间平均疾风，不推荐户外观星", level: "danger" };
  return { text: "夜间平均大风，禁止户外观星", level: "danger" };
}

export function evaluateFinderWindRisk(analysis: FinderAnalysis | null) {
  if (!analysis || analysis.nightMaxWind === null || analysis.nightMaxWind < 5.5) return null;
  return { text: `夜间平均最大 ${analysis.nightMaxWind.toFixed(1)}m/s`, level: analysis.nightMaxWind > 8 ? "danger" : "warning", maxWind: analysis.nightMaxWind };
}

export function buildFinderHazardWarning(location: FinderLocation, analysis: FinderAnalysis | null): string {
  if (!analysis) return "";
  const warnings: string[] = [];
  const windRisk = evaluateFinderWindRisk(analysis);
  if (windRisk) warnings.push(windRisk.text);
  const rainHours = analysis.nightHours.filter((hour) => hour.precip !== null && hour.precip > 0.5);
  if (rainHours.length) warnings.push(`夜间有降水（${rainHours.map((hour) => hour.timeLabel).join(",")}）`);
  const altitude = evaluateFinderHighAltWarning(location);
  if (altitude) warnings.push(altitude.text);
  if (/沙漠|戈壁|雅丹|魔鬼城/.test(location.reason)) warnings.push("沙漠/戈壁地区，昼夜温差大，防风沙保暖");
  if (DANGER_LOCATIONS[location.name]) warnings.push(DANGER_LOCATIONS[location.name]);
  if (UNDERDEVELOPED_LOCATIONS.has(location.name)) warnings.push("商业开发不完善，出发前确认道路、补给与通讯");
  if (/无人区|保护区|天文台|大本营/.test(location.reason)) warnings.push("偏远地区，补给困难，注意交通安全和通讯畅通");
  return warnings.join("；");
}

export function evaluateFinderLocation(
  location: FinderLocation,
  record: FinderWeatherRecord | undefined,
  date: string,
  mode: FinderMode,
): FinderEvaluation {
  const analysis = analyzeFinderNightWeather(date, record?.hourly ?? null, mode);
  const rating = evaluateFinderRating(analysis, mode);
  return {
    analysis,
    rating,
    score: finderRatingScore(rating, analysis),
    ratingDetail: buildFinderRatingDetail(rating, analysis, mode),
    windWarning: evaluateFinderWindWarning(analysis),
    windRisk: evaluateFinderWindRisk(analysis),
    altitudeWarning: evaluateFinderHighAltWarning(location),
    hazardWarning: buildFinderHazardWarning(location, analysis),
  };
}

export function ratingLabel(rating: FinderRating): string {
  return {
    perfect: "完全符合",
    great: "非常符合",
    good: "比较符合",
    fair: "不太符合",
    poor: "完全不符",
    unknown: "暂无数据",
  }[rating];
}

export function ratingColor(rating: FinderRating): string {
  return {
    perfect: "#00e5ff",
    great: "#2196f3",
    good: "#4caf50",
    fair: "#ffc107",
    poor: "#ef5350",
    unknown: "#91a0b8",
  }[rating];
}
