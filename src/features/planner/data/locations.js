export const PRESET_LOCATIONS = [
  { id: "qianniugang", name: "牵牛岗", latitude: 30.026, longitude: 119.007, elevation: 1489.9 },
  { id: "taizijian", name: "太子尖", latitude: 30.1734, longitude: 118.9057, elevation: 1557 },
  { id: "baizhangling", name: "百丈岭", latitude: 30.1839, longitude: 119.0129, elevation: 1558 },
  { id: "fanzengjian", name: "饭甑尖", latitude: 30.1899, longitude: 118.8154, elevation: 1349.6 },
  { id: "meiganling", name: "梅干岭", latitude: 30.1866, longitude: 118.8257, elevation: 1158 },
  { id: "tianhuangping", name: "天荒坪", latitude: 30.4694, longitude: 119.5978, elevation: 958.4 },
  { id: "andingshan", name: "安顶山", latitude: 29.9886, longitude: 120.0954, elevation: 790.2 },
  { id: "simingshan", name: "四明山", latitude: 29.6352, longitude: 120.9819, elevation: 1018 },
  { id: "qingmeijian", name: "青梅尖", latitude: 28.8422, longitude: 120.4464, elevation: 1314 },
  { id: "kuocangshan", name: "括苍山", latitude: 28.8101, longitude: 120.9221, elevation: 1382.6 },
  { id: "xingchenshan", name: "星辰山", latitude: 28.2656, longitude: 119.3788, elevation: 1000 },
  { id: "niucaoshan", name: "牛草山", latitude: 31.047, longitude: 116.259, elevation: 1442 },
].map((location) => ({ ...location, timezone: "Asia/Shanghai", source: "参考点位" }));

export function createLocation({ name, latitude, longitude, elevation, timezone = "Asia/Shanghai", source = "自定义" }) {
  const numericElevation = Number(elevation);
  return {
    id: `custom-${Date.now()}`,
    name: name.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    elevation: Number.isFinite(numericElevation) ? numericElevation : null,
    timezone,
    source,
  };
}
