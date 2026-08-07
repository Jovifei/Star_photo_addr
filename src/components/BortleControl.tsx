"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { BORTLE_CLASSES } from "@/data/viirsMeta";
import BortleHelpPopover from "@/components/BortleHelpPopover";

/** Bortle layer toggle + B1–B9 colour strip + help entry. */
export default function BortleControl() {
  const { state, toggleBortle } = useStore();
  const [help, setHelp] = useState(false);

  return (
    <div className={`bortle-control${state.bortleEnabled ? " on" : ""}`}>
      <button
        type="button"
        className={`bortle-toggle${state.bortleEnabled ? " on" : ""}`}
        onClick={toggleBortle}
        aria-pressed={state.bortleEnabled}
      >
        <span className="switch" />
        波特尔暗空
      </button>
      <div className="bortle-strip" aria-hidden="true">
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
