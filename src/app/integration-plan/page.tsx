import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IntegrationPlanPage from "@/components/integration-plan/IntegrationPlanPage";

export const metadata: Metadata = {
  title: "逐星内部集成审计",
  description: "逐星研发阶段的内部集成与发布审计页面。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <IntegrationPlanPage />;
}
