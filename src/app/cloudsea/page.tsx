import type { Metadata } from "next";
import CloudSeaClient from "./CloudSeaClient";
import "./cloudsea.css";

export const metadata: Metadata = {
  title: "云海条件地图 Beta｜高山云层 · 晨昏云海条件指数",
  description:
    "全国名山云海条件指数、真实相对湿度与低云数据，并结合地形启发式估算云底/云顶层位；结果为 Beta 条件判断，不是现场校准概率。",
};

export default function CloudSeaPage() {
  return <CloudSeaClient />;
}
