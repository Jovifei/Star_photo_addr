"use client";

import { Mountain as Mountains, Moon } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ForecastTheme } from "@/lib/types";

const THEMES: Array<{
  id: ForecastTheme;
  label: string;
  hint: string;
  icon: typeof Moon;
}> = [
  { id: "star", label: "星空", hint: "按天文观测条件评分", icon: Moon },
  { id: "cloud", label: "云海", hint: "按低云云海潜力评分", icon: Mountains },
];

/**
 * Cross-product prediction-theme switch (star vs cloud-sea, fire glow later).
 * One component, one position convention: title area on the planner, under
 * the search card on the map — so the lens control never migrates between
 * releases.
 */
export default function ForecastThemeSwitch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { state, setForecastTheme } = useStore();

  return (
    <div
      className={`forecast-theme-switch${state.forecastTheme === "cloud" ? " theme-cloud" : ""}${compact ? " compact" : ""}`}
      role="group"
      aria-label="预测主题"
      data-theme={state.forecastTheme}
    >
      {THEMES.map((theme) => {
        const Icon = theme.icon;
        const active = state.forecastTheme === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={active}
            className={active ? "active" : ""}
            onClick={() => setForecastTheme(theme.id)}
            title={theme.hint}
          >
            <Icon size={compact ? 14 : 15} aria-hidden="true" />
            <span>{theme.label}</span>
          </button>
        );
      })}
    </div>
  );
}
