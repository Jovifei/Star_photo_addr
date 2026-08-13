"use client";

import { CheckCircle2, ClipboardCheck, X } from "lucide-react";
import { ratingColor, ratingLabel } from "@/lib/stargazingFinder";
import type { FinderEvaluation, FinderLocation } from "@/lib/stargazingFinderTypes";
import styles from "./stargazing-finder.module.css";

interface FinderReviewModalProps {
  locations: FinderLocation[];
  evaluations: Map<string, FinderEvaluation>;
  onClose: () => void;
}

export default function FinderReviewModal({ locations, evaluations, onClose }: FinderReviewModalProps) {
  const grouped = locations.reduce<Record<string, FinderLocation[]>>((groups, location) => {
    (groups[location.province] ??= []).push(location);
    return groups;
  }, {});
  const checked = locations.filter((location) => evaluations.get(location.id)?.rating !== "unknown").length;
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.reviewModal} role="dialog" aria-modal="true" aria-labelledby="finder-review-title">
        <header className={styles.reviewHeader}>
          <div><span className={styles.detailEyebrow}><ClipboardCheck size={14} aria-hidden="true" /> 数据复查</span><h2 id="finder-review-title">观星地点复查清单</h2><p>共 {locations.length} 个地点 · 已加载 {checked} · 待加载 {locations.length - checked}</p></div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭复查"><X size={18} /></button>
        </header>
        <div className={styles.reviewBody}>
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, "zh-CN")).map(([province, provinceLocations]) => (
            <section key={province} className={styles.reviewGroup}>
              <h3>{province}<small>{provinceLocations.length} 个地点</small></h3>
              <div className={styles.reviewRows}>
                {provinceLocations.map((location) => {
                  const rating = evaluations.get(location.id)?.rating ?? "unknown";
                  return <div className={styles.reviewRow} key={location.id}><span className={styles.reviewDot} style={{ background: ratingColor(rating) }} aria-hidden="true" /><strong>{location.name}</strong><span>B{location.bortle}</span><span style={{ color: ratingColor(rating) }}>{ratingLabel(rating)}</span>{rating !== "unknown" && <CheckCircle2 size={14} aria-label="已加载" />}</div>;
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
