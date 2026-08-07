"use client";

/** Loading overlay shown while the dark-sky map expands. */
export default function MapSetup({ hidden }: { hidden: boolean }) {
  return (
    <div className={`map-setup${hidden ? " hidden" : ""}`} role="status">
      <div>
        <div className="loader" />
        <b>正在展开全球暗夜地图</b>
        <span>同时准备全球 2015 参考层与中国 2024 增强层…</span>
      </div>
    </div>
  );
}
