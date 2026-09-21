/** Viewport-bound dialogs share one lock; page gestures remain native outside them. */
export const COMPACT_BROWSER_QUERY = "(max-width: 1199px)";

type LockState = { count: number; restore: () => void };
const locks = new WeakMap<Document, LockState>();

export function lockPageScroll(doc: Document = document): () => void {
  const existing = locks.get(doc);
  if (existing) {
    existing.count += 1;
  } else {
    const view = doc.defaultView;
    if (!view || !doc.body) return () => undefined;
    const body = doc.body;
    const html = doc.documentElement;
    const x = view.scrollX;
    const y = view.scrollY;
    const properties = ["position", "top", "left", "width", "overflow"] as const;
    const previous = properties.map((key) => [key, body.style.getPropertyValue(key), body.style.getPropertyPriority(key)]);
    const htmlOverflow = html.style.getPropertyValue("overflow");
    const htmlPriority = html.style.getPropertyPriority("overflow");
    body.style.setProperty("position", "fixed");
    body.style.setProperty("top", `${-y}px`);
    body.style.setProperty("left", `${-x}px`);
    body.style.setProperty("width", "100%");
    body.style.setProperty("overflow", "hidden");
    html.style.setProperty("overflow", "hidden");
    locks.set(doc, {
      count: 1,
      restore: () => {
        for (const [key, value, priority] of previous) {
          if (value) body.style.setProperty(key, value, priority);
          else body.style.removeProperty(key);
        }
        if (htmlOverflow) html.style.setProperty("overflow", htmlOverflow, htmlPriority);
        else html.style.removeProperty("overflow");
        // Do not let a site's optional smooth-anchor CSS animate restoration.
        const behavior = html.style.getPropertyValue("scroll-behavior");
        const priority = html.style.getPropertyPriority("scroll-behavior");
        html.style.setProperty("scroll-behavior", "auto", "important");
        view.scrollTo(x, y);
        if (behavior) html.style.setProperty("scroll-behavior", behavior, priority);
        else html.style.removeProperty("scroll-behavior");
      },
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const state = locks.get(doc);
    if (!state || --state.count > 0) return;
    locks.delete(doc);
    state.restore();
  };
}

/** Rotation/desktop resize changes the lock too, without reopening the dialog. */
export function lockCompactPageScroll(doc: Document = document): () => void {
  const query = doc.defaultView?.matchMedia(COMPACT_BROWSER_QUERY);
  if (!query) return () => undefined;
  let release: (() => void) | undefined;
  const sync = () => {
    if (query.matches && !release) release = lockPageScroll(doc);
    else if (!query.matches && release) { release(); release = undefined; }
  };
  query.addEventListener("change", sync);
  sync();
  return () => { query.removeEventListener("change", sync); release?.(); };
}
