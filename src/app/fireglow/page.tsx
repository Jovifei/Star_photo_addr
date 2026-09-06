import type { Metadata } from "next";
import FireglowClient from "./FireglowClient";
import "./fireglow.css";

export const metadata: Metadata = {
  title: "火烧云条件地图｜逐霞 · 晨昏窗口条件指数",
  description:
    "今天/明天/后天与未来三日的晚霞朝霞条件指数分布、鲜艳度、金色/蓝色时刻与天文晨昏；指数尚未完成长期实拍概率校准。",
};

export default function FireglowPage() {
  return <FireglowClient />;
}
