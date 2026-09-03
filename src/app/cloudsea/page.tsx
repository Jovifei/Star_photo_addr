import type { Metadata } from "next";
import CloudSeaClient from "./CloudSeaClient";
import "./cloudsea.css";

export const metadata: Metadata = {
  title: "云海预测地图｜高山云顶 · 晨昏云海与日出预测",
  description:
    "全国名山高山云海概率分布、相对云层高度（云上/云中/云下）、逆温层推导、晨昏日出窗口与三日总览。",
};

export default function CloudSeaPage() {
  return <CloudSeaClient />;
}
