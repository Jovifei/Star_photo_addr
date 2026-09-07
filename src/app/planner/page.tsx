import type { Metadata } from "next";
import PlannerClient from "./PlannerClient";

export const metadata: Metadata = {
  title: "观星计划兼容入口｜逐星",
  description: "历史观星计划链接的兼容跳转入口；地点、模型与时次上下文会转入统一的今夜观测决策台。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlannerPage() {
  return <PlannerClient />;
}
