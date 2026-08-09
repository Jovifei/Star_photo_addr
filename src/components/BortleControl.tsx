"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ASSET_UNAVAILABLE_HINT, hasDarkSkyLayer } from "@/lib/assets";
import { BORTLE_CLASSES } from "@/data/viirsMeta";
import BortleHelpPopover from "@/components/BortleHelpPopover";

/**
 * Bortle layer toggle + B1–B9 colour strip + help entry.
 *
 * When no dark-sky raster is installed the toggle is rendered disabled with an
 * explicit "无数据" label, rather than silently doing nothing when clicked.
 */
export default function BortleControl() {
  const { state, toggleBortle } = useStore();
  const [help, setHelp] = useState(false);
  const available = hasDarkSkyLayer();
  const on = available && state.bortleEnabled;

  return (
    <div className={`bortle-control${on ? " on" : ""}`}>
      <button
        type="button"
        className={`bortle-toggle${on ? " on" : ""}`}
        onClick={toggleBortle}
        aria-pressed={on}
        disabled={!available}
        title={available ? "切换波特尔暗空图层" : ASSET_UNAVAILABLE_HINT}
        style={available ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
      >
        <span className="switch" />
        波特尔暗空
        {!available && (
          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--muted)" }}>
            无数据
          </span>
        )}
      </button>
      <div
        className="bortle-strip"
        aria-hidden="true"
        style={available ? undefined : { opacity: 0.35 }}
      >
        {BORTLE_CLASSES.map((klass) => (
          <i
            key={klass.level}
            title={`B${klass.level} ${klass.name}`}
            style={{ background: klass.color }}
          />
        ))}
      </div>
      <button
        type="button"
        className="bortle-help"
        aria-label="波特尔说明"
        onClick={() => setHelp(true)}
      >
        ?
      </button>
      <BortleHelpPopover open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
