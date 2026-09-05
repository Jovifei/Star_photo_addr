"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PlannerRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = params ? `/?${params}` : "/";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <main className="planner-loading" role="status" aria-live="polite">
      正在转入今夜观测决策台…
    </main>
  );
}

export default function PlannerClient() {
  return (
    <Suspense fallback={<main className="planner-loading">正在转入今夜观测决策台…</main>}>
      <PlannerRedirect />
    </Suspense>
  );
}
