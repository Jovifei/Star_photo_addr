"use client";

/** Loading overlay shown while the dark-sky map expands. */
export default function MapSetup({ hidden }: { hidden: boolean }) {
  return (
    <div className={`map-setup${hidden ? " hidden" : ""}`} role="status">
      <div>
        <div className="loader" />
        <b>正在加载地图图层</b>
        <span>暗色底图、地点与可用数据源准备中…</span>
      </div>
    </div>
  );
}
