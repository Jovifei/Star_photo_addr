"use client";
import { useEffect, useState } from "react";
import { buildProductHref, readProductLinkContext } from "@/lib/productRoutes";
import { locationIdentity, resolveLocationTransfer, type IdentityPoint, type LocationSourceScope } from "@/lib/locationIdentity";

/** Topic maps are client-only. URL selections preserve coordinates even outside the catalogue. */
export function useTopicContext<T extends IdentityPoint>(catalogue: readonly T[], scope: LocationSourceScope, baseDate: string) {
  const [incoming] = useState(() => readProductLinkContext(new URLSearchParams(window.location.search)));
  const transfer = incoming.identity ? resolveLocationTransfer(incoming.identity, catalogue, scope) : null;
  const requestedDate = incoming.night ?? incoming.forecastTime?.slice(0, 10);
  const offset = requestedDate ? Math.round((Date.parse(requestedDate + "T12:00:00Z") - Date.parse(baseDate + "T12:00:00Z")) / 86400000) : 0;
  return { incoming, transfer, initialRange: offset >= 0 && offset <= 2 ? offset as 0 | 1 | 2 : 0,
    dateNotice: requestedDate && (offset < 0 || offset > 2 || !Number.isFinite(offset))
      ? "所选日期超出本入口三日预报范围；当前显示今日，原选择未用于评分。" : null };
}
export function usePublishTopicContext<T extends IdentityPoint>(
  path: "/fireglow" | "/cloudsea", catalogue: readonly T[], scope: LocationSourceScope,
  selectedId: string | null, point: { latitude: number; longitude: number } | null,
  date: string, phase: "morning" | "evening", incoming: ReturnType<typeof readProductLinkContext>,
) {
  useEffect(() => {
    const site = catalogue.find(item => item.id === selectedId);
    const sameIncomingPoint = point && incoming.identity &&
      point.latitude === incoming.identity.latitude && point.longitude === incoming.identity.longitude;
    const identity = site ? locationIdentity(site, scope)
      : sameIncomingPoint ? incoming.identity
      : point ? locationIdentity({ ...point, name: "所选坐标" }, "coordinate") : null;
    const href = buildProductHref(path, { identity, night: date, phase, contextVersion: 2,
      forecastTime: date + (phase === "morning" ? "T05:00" : "T20:00") });
    if (window.location.pathname + window.location.search !== href) window.history.replaceState(null, "", href);
  }, [path, catalogue, scope, selectedId, point, date, phase, incoming]);
}
