import type { Metadata } from "next";
import CloudSeaClient from "./CloudSeaClient";
import "./cloudsea.css";

export const metadata: Metadata = {
  title: "高山云海条件地图｜压力层云层与逆温证据",
  description:
    "基于 Open-Meteo surface weather 与压力层数值模式剖面，展示全国名山晨昏云海条件指数、模式云底/云顶、山顶相对云层位置与逆温证据；结果不是探空实测或实拍样本校准的事件概率。",
};

export default function CloudSeaPage() {
  return <CloudSeaClient />;
}
