import type { Metadata } from "next";
import PlannerClient from "./PlannerClient";

export const metadata: Metadata = {
  title: "观星计划｜多地点星空与云海天气决策",
  description: "比较 7/14 天观测夜、候选点位、星空窗口与云海潜力，形成可执行的观星计划。",
};

export default function PlannerPage() {
  return <PlannerClient />;
}
