"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NearbySiteRanking from "@/components/NearbySiteRanking";

const PlannerApp = dynamic(
  () => import("@/features/planner/PlannerApp").then((module) => module.App),
  {
    ssr: false,
    loading: () => (
      <main className="planner-loading" role="status" aria-live="polite">
        正在载入观星计划…
      </main>
    ),
  },
);

function PlannerRuntime() {
  const searchParams = useSearchParams();
  const sessionKey = searchParams.toString();
  return (
    <>
      <PlannerApp key={sessionKey} />
      <NearbySiteRanking />
    </>
  );
}

export default function PlannerClient() {
  return (
    <Suspense fallback={<main className="planner-loading">正在载入观星计划…</main>}>
      <PlannerRuntime />
    </Suspense>
  );
}
