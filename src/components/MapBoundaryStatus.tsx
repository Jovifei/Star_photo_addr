"use client";

import { Layers3 } from "lucide-react";
import { hasAsset } from "@/lib/assets";

/** Honest status for administrative boundaries without fabricating outlines. */
export default function MapBoundaryStatus() {
  const hasTianditu = Boolean(
    process.env.NEXT_PUBLIC_TIANDITU_TOKEN?.trim(),
  );
  const hasLocalBoundaries = hasAsset("boundaries");
  const available = hasTianditu || hasLocalBoundaries;
  if (!available) return null;

  const label = hasTianditu
    ? "天地图境界：国家 / 省市随缩放显示"
    : "本地授权行政边界：随缩放显示";

  return (
    <div
      className="map-boundary-status available"
      title={label}
      role="status"
    >
      <Layers3 size={13} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );

}
