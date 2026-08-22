"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ASSET_UNAVAILABLE_HINT, hasDarkSkyLayer } from "@/lib/assets";
import { BORTLE_CLASSES } from "@/data/viirsMeta";
import BortleHelpPopover from "@/components/BortleHelpPopover";

/** Bortle/SQM is optional local data; VIIRS visual tiles remain independent. */
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
        title={available ? "切换本地 Bortle/SQM 暗空图层" : ASSET_UNAVAILABLE_HINT}
        style={available ? undefined : { opacity: 0.72, cursor: "not-allowed" }}
      >
        <span className="switch" />
        {available ? "Bortle / SQM" : "暗夜数值栅格"}
        {!available && (
          <span className="bortle-unavailable-label">
            未安装
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
        aria-label="Bortle、SQM 与未安装说明"
        onClick={() => setHelp(true)}
      >
        ?
      </button>
      <BortleHelpPopover open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
