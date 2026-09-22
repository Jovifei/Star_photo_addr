export interface LabelBox { x: number; y: number; width: number; height: number }

/** Preserve priority order and avoid overlapping orientation labels. */
export function spacedLabelIndices(boxes: LabelBox[], width: number, height: number): number[] {
  const chosen: number[] = [];
  boxes.forEach((box, index) => {
    if(box.x - box.width / 2 < 0 || box.x + box.width / 2 > width ||
      box.y - box.height / 2 < 0 || box.y + box.height / 2 > height) return;
    if(chosen.some(i => Math.abs(box.x - boxes[i].x) < (box.width + boxes[i].width)/2 + 8 &&
      Math.abs(box.y - boxes[i].y) < (box.height + boxes[i].height)/2 + 8)) return;
    chosen.push(index);
  });
  return chosen;
}
