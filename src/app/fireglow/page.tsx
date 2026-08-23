import type { Metadata } from "next";
import FireglowClient from "./FireglowClient";
import "./fireglow.css";

export const metadata: Metadata = {
  title: "火烧云概率地图｜逐霞 · 晨昏窗口预测",
  description:
    "今天/明天/后天与未来三日的晚霞朝霞概率分布，五级色阶地图、鲜艳度、金色/蓝色时刻与天文晨昏。",
};

export default function FireglowPage() {
  return <FireglowClient />;
}
