import type { Map as LeafletMap } from "leaflet";

/** Keep Leaflet's canvas in sync with a resizing sheet or rotated viewport.
 * Gesture handlers remain in Leaflet's default interactive mode. */
export function observeMapViewport(map: LeafletMap): () => void {
  const container = map.getContainer();
  const view = container.ownerDocument.defaultView;
  if (!view) return () => undefined;

  let frame = 0;
  let width = 0;
  let height = 0;
  let disposed = false;
  const resize = () => {
    if (frame || disposed) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      const box = container.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || (box.width === width && box.height === height)) return;
      width = box.width;
      height = box.height;
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(container);
  view.addEventListener("resize", resize);
  resize();
  return () => {
    disposed = true;
    observer?.disconnect();
    view.removeEventListener("resize", resize);
    if (frame) view.cancelAnimationFrame(frame);
  };
}
