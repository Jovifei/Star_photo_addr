"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import HourlyForecastMatrix, {
  buildNightTimes,
} from "@/components/HourlyForecastMatrix";
import { useAuxiliaryConditions } from "@/components/useAuxiliaryConditions";
import { aggregateForecastHour, getValuesAtTime } from "@/lib/cloudGrid";
import { NIGHT_END, NIGHT_START } from "@/lib/constants";
import {
  formatHourWithDate,
  formatNightLabel,
  HOURS_PER_NIGHT,
  isInNight,
  nightRangeKeys,
} from "@/lib/nighttime";
import { LIGHT_POLLUTION_ATTRIBUTION } from "@/lib/lightPollution";
import { evaluateNight } from "@/lib/scoring";
import { useStore } from "@/lib/store";
import type { SatelliteFrame } from "@/lib/types";

const RANGE_OPTIONS: Array<{ value: 1 | 5 | 7; label: string }> = [
  { value: 1, label: "ä»Šæ™š" },
  { value: 5, label: "5 å¤œ" },
  { value: 7, label: "7 å¤œ" },
];
const PLAY_INTERVAL_MS = 1500;

function buildSchedule(
  nightKeys: string[],
): Array<{ time: string; nightKey: string }> {
  return nightKeys.flatMap((nightKey) =>
    buildNightTimes(nightKey).map((time) => ({ time, nightKey })),
  );
}

function formatTimelineTime(time: string): string {
  if (!time) return "æš‚æ— ";
  if (time.length === 10) return time;
  // Provider and GIBS timestamps are already wall-clock labels for their
  // respective time domain. Format the string directly instead of reparsing
  // it in the browser timezone, which could shift an hour or differ on SSR.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(time);
  if (!match) return time.slice(11, 16);
  const [, , month, day, hour, minute] = match;
  return `${Number(month)}/${Number(day)} ${hour}:${minute}`;
}

function activeForecastTimeLabel(time?: string): string {
  if (!time) return "æš‚æ— ";
  return time.replace("T", " ");
}

export default function CloudTimeline() {
  const { state, setCloud, selectNight } = useStore();
  const {
    cloudState,
    selectedNight,
    cloudGrid,
    forecast,
    selectedLocation,
    dataRefreshRevision,
  } = state;
  const [expanded, setExpanded] = useState(false);
  const nightKeys = useMemo(
    () => nightRangeKeys(selectedNight, cloudState.range),
    [selectedNight, cloudState.range],
  );
  const schedule = useMemo(() => buildSchedule(nightKeys), [nightKeys]);
  const isSatelliteMode = cloudState.overlayMode === "satellite-cloud";
  const isNightLightsMode = cloudState.overlayMode === "night-lights";
  const pointForecast =
    forecast?.metadata?.model === cloudState.model ? forecast : null;
  const gridForecast =
    cloudGrid?.model === cloudState.model
      ? (cloudGrid.forecasts[0] ?? null)
      : null;
  const forecastSource = pointForecast
    ? "å–æ ·ç‚¹"
    : gridForecast
      ? "åœ°å›¾é‡‡æ ·ç½‘æ ¼å¹³å‡"
      : "æš‚æ— æœ‰æ•ˆé¢„æŠ¥";
  const forecastHours = useMemo(
    () => pointForecast?.hourly ?? gridForecast?.hourly ?? [],
    [gridForecast, pointForecast],
  );
  const forecastTimeline = useMemo(
    () =>
      forecastHours
        .slice(0, 73)
        .map((hour) => ({ time: hour.time, nightKey: selectedNight })),
    [forecastHours, selectedNight],
  );
  const observationTimeline = state.satelliteFrames;
  const timelineItems = useMemo(
    () =>
      isNightLightsMode
        ? []
        : isSatelliteMode
          ? observationTimeline
          : forecastTimeline,
    [
      forecastTimeline,
      isNightLightsMode,
      isSatelliteMode,
      observationTimeline,
    ],
  );
  const timelineTicks = useMemo(() => {
    if (!timelineItems.length) return [];
    const tickCount = isSatelliteMode ? 5 : 4;
    return Array.from({ length: tickCount }, (_, index) => {
      const itemIndex = Math.round(
        (index * (timelineItems.length - 1)) / Math.max(1, tickCount - 1),
      );
      return timelineItems[itemIndex];
    });
  }, [isSatelliteMode, timelineItems]);
  const activeTimelineIndex = isSatelliteMode
    ? observationTimeline.findIndex(
        (frame) => frame.time === cloudState.activeObservationTime,
      )
    : forecastTimeline.findIndex(
        (item) => item.time === cloudState.activeForecastTime,
      );
  const safeTimelineIndex = timelineItems.length
    ? Math.min(
        Math.max(activeTimelineIndex >= 0 ? activeTimelineIndex : 0, 0),
        timelineItems.length - 1,
      )
    : 0;
  const activeTimelineTime = isSatelliteMode
    ? ((timelineItems[safeTimelineIndex] as SatelliteFrame | undefined)?.time ??
      null)
    : (timelineItems[safeTimelineIndex]?.time ?? null);
  const activeScheduleIndex = cloudState.activeForecastTime
    ? schedule.findIndex(
        (item) => item.time === cloudState.activeForecastTime,
      )
    : -1;
  const safeIndex = schedule.length
    ? Math.min(
        Math.max(activeScheduleIndex >= 0 ? activeScheduleIndex : 0, 0),
        schedule.length - 1,
      )
    : 0;
  const current = isSatelliteMode
    ? { time: activeTimelineTime ?? "", nightKey: selectedNight }
    : activeScheduleIndex >= 0
      ? schedule[safeIndex]
      : cloudState.activeForecastTime
        ? { time: cloudState.activeForecastTime, nightKey: selectedNight }
        : schedule[safeIndex];
  const displayNight = current?.nightKey ?? selectedNight;
  const matrixTimes = useMemo(
    () => buildNightTimes(displayNight),
    [displayNight],
  );
  const matrixHours = useMemo(
    () =>
      matrixTimes.map((time) => {
        const selectedHour = pointForecast?.hourly.find(
          (hour) => hour.time === time,
        );
        const gridHour =
          cloudGrid?.model === cloudState.model
            ? aggregateForecastHour(
                cloudGrid.forecasts.map((item) =>
                  item.hourly.find((hour) => hour.time === time),
                ),
                time,
              )
            : null;
        return selectedHour ?? gridHour ?? { time };
      }),
    [cloudGrid, cloudState.model, matrixTimes, pointForecast],
  );
  const activeForecastHour =
    forecastHours.find(
      (hour) => hour.time === cloudState.activeForecastTime,
    ) ?? null;
  const selectedMatrixTime = matrixTimes.includes(
    cloudState.activeForecastTime ?? "",
  )
    ? cloudState.activeForecastTime
    : null;
  // The expanded matrix is intentionally one night, while the compact rail is
  // a 72-hour forecast. Keep the summary/card bound to the actual active hour
  // even when the selected hour is outside the currently expanded night.
  const selectedHour =
    activeForecastHour ??
    matrixHours.find((hour) => hour.time === selectedMatrixTime) ??
    matrixHours[0];
  const activeSatelliteFrame = isSatelliteMode
    ? ((observationTimeline[safeTimelineIndex] as
        | SatelliteFrame
        | undefined) ?? null)
    : null;
  const nightSummary = useMemo(
    () =>
      pointForecast && selectedLocation
        ? evaluateNight(pointForecast, selectedLocation, displayNight)
        : null,
    [displayNight, pointForecast, selectedLocation],
  );
  const auxiliaryTargetTime =
    selectedMatrixTime ?? cloudState.activeForecastTime;
  const auxiliaryForecast = pointForecast ?? gridForecast;
  const { aqiValue, kpValue } = useAuxiliaryConditions({
    location: selectedLocation,
    targetTime: auxiliaryTargetTime,
    utcOffsetSeconds: auxiliaryForecast?.utcOffsetSeconds ?? 8 * 60 * 60,
    refreshRevision: dataRefreshRevision,
  });

  useEffect(() => {
    if (isNightLightsMode) return;
  ²È="25¥Ù•Q¥µ•±¥¹•Q¥µ”€üü€‹šjš^ƒš^Ûš²„‰ô(€€€€€€€€€€€€€½¹¡…¹”õì¡•Ù•¹Ð¤€ôø(€€€€€€€€€€€€€€€Í•ÑQ¥µ•±¥¹•%¹‘•à¡9Õµ‰•È¡•Ù•¹Ð¹Ñ…É•Ð¹Ù…±Õ”¤¤(€€€€€€€€€€€€€ô(€€€€€€€€€€€€¼ø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µ±…‰•±Ìˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆø(€€€€€€€€€€€€€íÑ¥µ•±¥¹•Q¥­Ì¹µ…À ¡¥Ñ•´°¥¹‘•à¤€ôø€ (€€€€€€€€€€€€€€€€ñÍÁ…¸­•äõí€‘í¥Ñ•´¹Ñ¥µ•ô´‘í¥¹‘•áõôø(€€€€€€€€€€€€€€€€€í¥Ñ•´ü¹Ñ¥µ”€ü™½Éµ…ÑQ¥µ•±¥¹•Q¥µ”¡¥Ñ•´¹Ñ¥µ”¤€è€‹šjš^€‰ô(€€€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€¥ô(€€€€€€€ì…¥ÍM…Ñ•±±¥Ñ•5½‘”€˜˜€…¥Í9¥¡Ñ1¥¡ÑÍ5½‘”€˜˜€ (€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µÉ…¹”ˆ(€€€€€€€€€€€É½±”ô‰É½ÕÀˆ(€€€€€€€€€€€…É¥„µ±…‰•°ô‹¦Šš*—–’sšVÀˆ(€€€€€€€€€€ø(€€€€€€€€€€€íI9}=AQ%=9L¹µ…À ¡½ÁÑ¥½¸¤€ôø€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€­•äõí½ÁÑ¥½¸¹Ù…±Õ•ô(€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õì(€€€€€€€€€€€€€€€€€±½Õ‘MÑ…Ñ”¹É…¹”€ôôô½ÁÑ¥½¸¹Ù…±Õ”€ü€‰…Ñ¥Ù”ˆ€è€ˆˆ(€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€…É¥„µÁÉ•ÍÍ•õí±½Õ‘MÑ…Ñ”¹É…¹”€ôôô½ÁÑ¥½¸¹Ù…±Õ•ô(€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹•I…¹”¡½ÁÑ¥½¸¹Ù…±Õ”¥ô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€í½ÁÑ¥½¸¹±…‰•±ô(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤¥ô(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€¥ô(€€€€€€€€ñÍÁ…¸(€€€€€€€€€±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µÕÉÉ•¹Ðˆ(€€€€€€€€€Ñ¥Ñ±”õí…Ñ¥Ù•Q¥µ•±¥¹•Q¥µ”€üüÕ¹‘•™¥¹•‘ô(€€€€€€€€ø(€€€€€€€€€í¥Í9¥¡Ñ1¥¡ÑÍ5½‘”(€€€€€€€€€€€€ü€‹¦vgš–>¢¾ò3š^ƒš^Û¦^Ó¢öÐˆ(€€€€€€€€€€€€è…Ñ¥Ù•Q¥µ•±¥¹•Q¥µ”(€€€€€€€€€€€€€€ü¥ÍM…Ñ•±±¥Ñ•5½‘”(€€€€€€€€€€€€€€€€ü™½Éµ…ÑQ¥µ•±¥¹•Q¥µ”¡…Ñ¥Ù•Q¥µ•±¥¹•Q¥µ”¤(€€€€€€€€€€€€€€€€è€‘í™½Éµ…Ñ9¥¡Ñ1…‰•°¡ÕÉÉ•¹Ð¹¹¥¡Ñ-•ä°ÑÉÕ”¥ô€‘í™½Éµ…Ñ!½ÕÉ]¥Ñ¡…Ñ”¡…Ñ¥Ù•Q¥µ•±¥¹•Q¥µ”°ÕÉÉ•¹Ð¹¹¥¡Ñ-•ä¥õ€(€€€€€€€€€€€€€€è€‹šjš^ƒš^Ûš²„‰ô(€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µÑ½±”ˆ(€€€€€€€€€…É¥„µ•áÁ…¹‘•õí•áÁ…¹‘•‘ô(€€€€€€€€€…É¥„µ½¹ÑÉ½±Ìô‰¡½ÕÉ±äµ™½É•…ÍÐµÁ…¹•°ˆ(€€€€€€€€€½¹±¥¬õì ¤€ôøÍ•ÑáÁ…¹‘• ¡Ù…±Õ”¤€ôø€…Ù…±Õ”¥ô(€€€€€€€€ø(€€€€€€€€€í•áÁ…¹‘•€ü€ (€€€€€€€€€€€€ñ¡•ÙÉ½¹½Ý¸Í¥é”õìÄÙô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€€ñ¡•ÙÉ½¹UÀÍ¥é”õìÄÙô…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆ€¼ø(€€€€€€€€€€¥ô(€€€€€€€€€€ñÍÁ…¸ùí•áÁ…¹‘•€ü€‹šRÛ¢ÖßšVÃš6¸ˆ€è€‹–ÆW–òšVÃš6¸‰ôð½ÍÁ…¸ø(€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€ð½‘¥Øø((€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µ‘…Ñ„µ…Éˆ…É¥„µ±¥Ù”ô‰Á½±¥Ñ”ˆø(€€€€€€€í¥Í9¥¡Ñ1¥¡ÑÍ5½‘”€ü€ (€€€€€€€€€€ðø(€€€€€€€€€€€€ñˆû–'šÆ‡š~O–~ë–ð½ˆø(€€€€€€€€€€€€ñÍÁ…¸ùY%%IL€ÈÀÈÌð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸û¦vgš–>¢–nû–Æð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€í1%!Q}A=11UQ%=9}QQI%	UQ%=9ôƒ
Üƒ’â7’î¢†£–º{š^Û–'šÆ‡š~OŽ	½ÉÑ±”ƒš"XME4ƒ–º{šÖ,(€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€ð¼ø(€€€€€€€€¤€è…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”€ü€ (€€€€€€€€€€ðø(€€€€€€€€€€€€ñˆû–6¯šb¢žšÖ,ð½ˆø(€€€€€€€€€€€€ñÍÁ…¸ùí…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”¹Í…Ñ•±±¥Ñ•ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸ùí…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”¹±…‰•±ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸ùí™½Éµ…ÑQ¥µ•±¥¹•Q¥µ”¡…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”¹Ñ¥µ”¥ôð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€ƒšv—šêC¾òií…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”¹Í½ÕÉ•ôƒ
Üí…Ñ¥Ù•M…Ñ•±±¥Ñ•É…µ”¹½Ù•É…•ô(€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€ð¼ø(€€€€€€€€¤€è€ (€€€€€€€€€€ðø(€€€€€€€€€€€€ñˆûšVÃ–ó¦Šš*”ƒ
Üí±½Õ‘MÑ…Ñ”¹µ½‘•°¹Ñ½UÁÁ•É…Í” ¥ôð½ˆø(€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€ƒ’êG¦=ìˆ€‰ô(€€€€€€€€€€€€€í…Ñ¥Ù•½É•…ÍÑ!½ÕÈü¹±½Õ‘½Ù•È€ôô¹Õ±°(€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€è€‘í5…Ñ ¹É½Õ¹¡…Ñ¥Ù•½É•…ÍÑ!½ÕÈ¹±½Õ‘½Ù•È¥ô•ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€ƒ¦f7šÂÑìˆ€‰ô(€€€€€€€€€€€€€í…Ñ¥Ù•½É•…ÍÑ!½ÕÈü¹ÁÉ•¥Á¥Ñ…Ñ¥½¸€ôô¹Õ±°(€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€è€‘í…Ñ¥Ù•½É•…ÍÑ!½ÕÈ¹ÁÉ•¥Á¥Ñ…Ñ¥½¸¹Ñ½¥á• Ä¥ôµµô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€ƒ¦Ž9ìˆ€‰ô(€€€€€€€€€€€€€í…Ñ¥Ù•½É•…ÍÑ!½ÕÈü¹Ý¥¹‘MÁ••€ôô¹Õ±°(€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€è€‘í…Ñ¥Ù•½É•…ÍÑ!½ÕÈ¹Ý¥¹‘MÁ••¹Ñ½¥á• Ä¥ô´½Íõìˆ€‰ô(€€€€€€€€€€€€€í…Ñ¥Ù•½É•…ÍÑ!½ÕÈü¹Ý¥¹‘¥É•Ñ¥½¸€ôô¹Õ±°(€€€€€€€€€€€€€€€€ü€ˆˆ(€€€€€€€€€€€€€€€€è€‘í5…Ñ ¹É½Õ¹¡…Ñ¥Ù•½É•…ÍÑ!½ÕÈ¹Ý¥¹‘¥É•Ñ¥½¸¥÷
Áô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ñÍµ…±°ø(€€€€€€€€€€€€€ƒšv—šêC¾òií™½É•…ÍÑM½ÕÉ•ôƒ
Ü=Á•¸µ5•Ñ•¼ƒ
Ýìˆ€‰ô(€€€€€€€€€€€€€í±½Õ‘MÑ…Ñ”¹µ½‘•°¹Ñ½UÁÁ•É…Í” ¥ôƒ
Üƒš^Û¦^Ó¾òh(€€€€€€€€€€€€€í…Ñ¥Ù•½É•…ÍÑQ¥µ•1…‰•°¡…Ñ¥Ù•½É•…ÍÑ!½ÕÈü¹Ñ¥µ”¥ô(€€€€€€€€€€€€ð½Íµ…±°ø(€€€€€€€€€€ð¼ø(€€€€€€€€¥ô(€€€€€€ð½‘¥Øø((€€€€€í•áÁ…¹‘•€˜˜€ (€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µ‰½‘äˆ¥ô‰¡½ÕÉ±äµ™½É•…ÍÐµÁ…¹•°ˆø(€€€€€€€€€ì…¥ÍM…Ñ•±±¥Ñ•5½‘”€˜˜€…¥Í9¥¡Ñ1¥¡ÑÍ5½‘”€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰±½Õµ¹¥¡ÐµÑ…‰Ìˆ(€€€€€€€€€€€€€É½±”ô‰Ñ…‰±¥ÍÐˆ(€€€€€€€€€€€€€…É¥„µ±…‰•°ô‹¢žšÖ/–’s¦'š.¤ˆ(€€€€€€€€€€€€ø(€€€€€€€€€€€€€í¹¥¡Ñ-•åÌ¹µ…À ¡¹¥¡Ñ-•ä¤€ôø€ (€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€­•äõí¹¥¡Ñ-•åô(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€É½±”ô‰Ñ…ˆˆ(€€€€€€€€€€€€€€€€€…É¥„µÍ•±•Ñ•õí‘¥ÍÁ±…å9¥¡Ð€ôôô¹¥¡Ñ-•åô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õí‘¥ÍÁ±…å9¥¡Ð€ôôô¹¥¡Ñ-•ä€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôø¡…¹•9¥¡Ð¡¹¥¡Ñ-•ä¥ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€í™½Éµ…Ñ9¥¡Ñ1…‰•°¡¹¥¡Ñ-•ä°ÑÉÕ”¥ô(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€ì…¥ÍM…Ñ•±±¥Ñ•5½‘”€˜˜€…¥Í9¥¡Ñ1¥¡ÑÍ5½‘”€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½ÕµÍÕµµ…Éäµ…Éˆ…É¥„µ±…‰•°ô‹–öO–&7–Â?š^ÛšFc¢šˆø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆû¢žšb–"ð½ˆø(€€€€€€€€€€€€€€€í¹¥¡ÑMÕµµ…Éäü¹Í½É”€ôô¹Õ±°€ü€‹ŠPˆ€è€‘í¹¥¡ÑMÕµµ…Éä¹Í½É•õô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆûšï’êG¦<ð½ˆø(€€€€€€€€€€€€€€€íÍ•±•Ñ•‘!½ÕÈü¹±½Õ‘½Ù•È€ôô¹Õ±°(€€€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€€€è€‘í5…Ñ ¹É½Õ¹¡Í•±•Ñ•‘!½ÕÈ¹±½Õ‘½Ù•È¥ô•ô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆû¢÷¢ž–ê˜ð½ˆø(€€€€€€€€€€€€€€€íÍ•±•Ñ•‘!½ÕÈü¹Ù¥Í¥‰¥±¥Ñä€ôô¹Õ±°(€€€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€€€è€‘ì¡Í•±•Ñ•‘!½ÕÈ¹Ù¥Í¥‰¥±¥Ñä€¼€ÄÀÀÀ¤¹Ñ½¥á• Ä¥ô­µô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆû¦Ž8ð½ˆø(€€€€€€€€€€€€€€€íÍ•±•Ñ•‘!½ÕÈü¹Ý¥¹‘MÁ••€ôô¹Õ±°(€€€€€€€€€€€€€€€€€€ü€‹ŠPˆ(€€€€€€€€€€€€€€€€€€è€‘íÍ•±•Ñ•‘!½ÕÈ¹Ý¥¹‘MÁ••¹Ñ½¥á• Ä¥ô´½Íô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆùE$ð½ˆø(€€€€€€€€€€€€€€€ì…Í•±•Ñ•‘1½…Ñ¥½¸ñð…Å¥Y…±Õ”€ôô¹Õ±°€ü€‹ŠPˆ€è…Å¥Y…±Õ•ô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆù-Àð½ˆø(€€€€€€€€€€€€€€€í­ÁY…±Õ”€ôô¹Õ±°€ü€‹ŠPˆ€è­ÁY…±Õ”¹Ñ½¥á• Ä¥ô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆûšr#žnàð½ˆø(€€€€€€€€€€€€€€€í¹¥¡ÑMÕµµ…Éäü¹µ½½¹A¡…Í”€üü€‹ŠP‰ô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ø(€€€€€€€€€€€€€€€€ñˆûšj_–’sžª_–>Œð½ˆø(€€€€€€€€€€€€€€€í¹¥¡ÑMÕµµ…Éäü¹Ý¥¹‘½Ý1…‰•°€üü€‹ŠP‰ô(€€€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€í¥ÍM…Ñ•±±¥Ñ•5½‘”€ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½Õµ½‰Í•ÉÙ…Ñ¥½¸µ¹½Ñ”ˆø(€€€€€€€€€€€€€ƒ–öO–&7’âë–6¯šb¢žšÖ/š^Û¦^Ó¢öÓ¾òo–"š6‹–"ÃŠs’êG¦?¦Šš*—Šw–B;š~—žr/šr«šv”€ÜÈ(€€€€€€€€€€€€€ƒ–Â?š^Û¦C–Â?š^Ûž~§¦b×Ž(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¤€è¥Í9¥¡Ñ1¥¡ÑÍ5½‘”€ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½Õµ½‰Í•ÉÙ…Ñ¥½¸µ¹½Ñ”ˆø(€€€€€€€€€€€€€ƒ–öO–&7’âèY%%IL€ÈÀÈÌ(€€€€€€€€€€€€€ƒ–'šÆ‡š~O¦vgš–>¢–nû–Æ¾òo–ºšÊ‡šr'¦C–Â?š^Ûš^Û¦^Ó–~¾ò3’â7–>’â;–’§šÂS¢¾–"Ž(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€€ñ!½ÕÉ±å½É•…ÍÑ5…ÑÉ¥à(€€€€€€€€€€€€€¹¥¡Ñ-•äõí‘¥ÍÁ±…å9¥¡Ñô(€€€€€€€€€€€€€¡½ÕÉÌõíµ…ÑÉ¥á!½ÕÉÍô(€€€€€€€€€€€€€Í•±•Ñ•‘Q¥µ”õíÍ•±•Ñ•‘5…ÑÉ¥áQ¥µ•ô(€€€€€€€€€€€€€½¹M•±•ÑQ¥µ”õíÍ•ÑÑ¥Ù•Q¥µ•ô(€€€€€€€€€€€€€±½…‘¥¹œõíÍÑ…Ñ”¹±½Õ‘É¥‘1½…‘¥¹ô(€€€€€€€€€€€€¼ø(€€€€€€€€€€¥ô(€€€€€€€€€íÍÑ…Ñ”¹±½Õ‘É¥‘1½…‘¥¹œ€˜˜€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰±½ÕµÑ¥µ•±¥¹”µ±½…‘¥¹œˆÉ½±”ô‰ÍÑ…ÑÕÌˆø(€€€€€€€€€€€€€ƒš¶–r£¦š‚ß’êG–nûšVÃš6»Š˜(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô(€€€€ð½Í•Ñ¥½¸ø(€€¤ì)ô()•áÁ½ÉÐì(€‰Õ¥±‘M¡•‘Õ±”°(€!=UIM}AI}9%!P°(€9%!Q}MQIP°(€9%!Q}9°(€¥Í%¹9¥¡Ð°(€•ÑY…±Õ•ÍÑQ¥µ”°)ôì(