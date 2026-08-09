"use client";

import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  label: string;
  passed: boolean;
}

function compute(targetISO: string): Countdown {
  const target = new Date(targetISO).getTime();
  const now = Date.now();
  const totalMs = target - now;
  const passed = totalMs <= 0;
  const abs = Math.abs(totalMs);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  const label = `${days} 天 ${hours} 小时 ${minutes} 分`;
  return { days, hours, minutes, seconds, totalMs, label, passed };
}

/** Live countdown to `targetISO`, refreshed every second. */
export function useCountdown(targetISO: string): Countdown {
  const [countdown, setCountdown] = useState<Countdown>(() => compute(targetISO));

  useEffect(() => {
    const timer = setInterval(() => setCountdown(compute(targetISO)), 1000);
    return () => clearInterval(timer);
  }, [targetISO]);

  return countdown;
}
