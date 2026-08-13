import type { Metadata } from "next";
import IntegrationPlanPage from "@/components/integration-plan/IntegrationPlanPage";

export const metadata: Metadata = {
  title: "逐星两页产品闭环",
  description: "观星地图与星野决策的统一观测会话、数据快照和发布候选审计。",
};

export default function Page() {
  return <IntegrationPlanPage />;
}
