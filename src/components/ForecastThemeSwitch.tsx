"use client";

import { useRouter, usePathname } from "next/navigation";
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
  { id: "cloud", label: "云海", hint: "前往云海预测专区", icon: Mountains },
];

/**
 * Cross-product prediction-theme switch.
 * Clicking "云海" smoothly navigates to the dedicated /cloudsea workspace.
 */
export default function ForecastThemeSwitch({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { state, setForecastTheme } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  const currentTheme = pathname === "/cloudsea" ? "cloud" : state.forecastTheme;

  const handleClick = (themeId: ForecastTheme) => {
    setForecastTheme(themeId);
    if (themeId === "cloud" && pathname !== "/cloudsea") {
      router.push("/cloudsea");
    } else if (themeId === "star" && pathname === "/cloudsea") {
      router.push("/");
    }
  };

  return (
    <div
      className={`forecast-theme-switch${currentTheme === "cloud" ? " theme-cloud" : ""}${compact ? " compact" : ""}`}
      role="group"
      aria-label="预测主题"
      data-theme={currentTheme}
    >
      {THEMES.map((theme) => {
        const Icon = theme.icon;
        const active = currentTheme === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            aria-pressed={active}
            className={active ? "active" : ""}
            onClick={() => handleClick(theme.id)}
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
