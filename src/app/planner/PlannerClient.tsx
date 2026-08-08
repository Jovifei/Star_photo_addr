"use client";

import dynamic from "next/dynamic";

// The migrated planner reads localStorage in state initialisers, so it must be
// mounted in the browser rather than prerendered on the server.
const PlannerApp = dynamic(
  () => import("@/features/planner/PlannerApp").then((module) => module.App),
  {
    ssr: false,
    loading: () => (
      <main className="planner-loading" role="status" aria-live="polite">
        正在载入星野决策…
      </main>
    ),
  },
);

export default function PlannerClient() {
  return <PlannerApp />;
}
