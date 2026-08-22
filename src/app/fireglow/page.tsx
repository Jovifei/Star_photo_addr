import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import FireglowClient from "./FireglowClient";
import "./fireglow.css";

export const metadata: Metadata = {
  title: "火烧云预测｜晨昏窗口地图",
  description:
    "按傍晚晚霞与清晨朝霞窗口，查看全国观测点的火烧云潜力评分、最佳时次与云层结构。",
};

export default function FireglowPage() {
  return (
    <div className="app-shell">
      <TopBar />
      <FireglowClient />
    </div>
  );
}
