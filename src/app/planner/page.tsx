import type { Metadata } from "next";
import PlannerClient from "./PlannerClient";

export const metadata: Metadata = {
  title: "星野决策｜星空与云海摄影天气决策",
  description: "比较 7/14 天观测夜、推荐点位、星空窗口与云海潜力。",
};

export default function PlannerPage() {
  return <PlannerClient />;
}
