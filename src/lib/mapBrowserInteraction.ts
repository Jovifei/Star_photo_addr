import { COMPACT_BROWSER_QUERY } from "./pageScrollLock";

type Handler = { enabled: () => boolean; enable: () => unknown; disable: () => unknown };
export interface BrowserMap {
  dragging: Handler;
  scrollWheelZoom: Handler;
  touchZoom: Handler;
  doubleClickZoom: Handler;
  getContainer: () => HTMLElement;
  invalidateSize: (options: { pan: boolean; debounceMoveend: boolean }) => unknown;
}

/** Own only interaction mode and canvas dimensions, never weather/map data. */
export function bindMapBrowserInteraction(
  map: BrowserMap,
  button: HTMLButtonElement,
  setControlVisible: (visible: boolean) => void,
): () => void {
  const container = map.getContainer();
  const doc = container.ownerDocument;
  const view = doc.defaultView;
  if (!view) return () => undefined;
  const query = view.matchMedia(COMPACT_BROWSER_QUERY);
  const handlers = [map.dragging, map.scrollWheelZoom, map.touchZoom, map.doubleClickZoom];
  const enabled = handlers.map((handler) => handler.enabled());
  let interactive = false;
  let frame = 0;
  let disposed = false;
  let width = 0;
  let height = 0;
  const sync = () => {
    const scrollPage = query.matches && !interactive;
    container.classList.toggle("map-page-scroll", scrollPage);
    container.dataset.gestureMode = scrollPage ? "page" : "map";
    handlers.forEach((handler, index) => {
      if (scrollPage || !enabled[index]) handler.disable();
      else handler.enable();
    });
    button.textContent = interactive ? "完成 · 滑动页面" : "移动地图";
    button.setAttribute("aria-pressed", String(interactive));
    button.setAttribute("aria-label", interactive ? "完成移动地图，恢复页面滑动" : "移动地图，开启地图拖动");
    button.title = "默认单指上下滑动页面；移动地图后可点完成、按 Escape 或点地图外退出";
  };
  const finish = () => { if (interactive) { interactive = false; sync(); } };
  const toggle = () => { interactive = !interactive; sync(); };
  const breakpoint = () => { interactive = false; setControlVisible(query.matches); sync(); };
  const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") finish(); };
  const outside = (event: PointerEvent) => {
    if (event.target instanceof Node && !container.contains(event.target)) finish();
  };
  const resize = () => {
    if (frame || disposed) return;
    frame = view.requestAnimationFrame(() => {
      frame = 0;
      const box = container.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || (box.width === width && box.height === height)) return;
      width = box.width; height = box.height;
      map.invalidateSize({ pan: false, debounceMoveend: true });
    });
  };
  // Element resizing (sheet/orientation/layout) is not always a window resize.
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(container);
  button.addEventListener("click", toggle);
  query.addEventListener("change", breakpoint);
  doc.addEventListener("keydown", keydown);
  doc.addEventListener("pointerdown", outside, true);
  view.addEventListener("resize", resize);
  breakpoint();
  resize();
  return () => {
    disposed = true;
    observer?.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
    button.removeEventListener("click", toggle);
    query.removeEventListener("change", breakpoint);
    doc.removeEventListener("keydown", keydown);
    doc.removeEventListener("pointerdown", outside, true);
    view.removeEventListener("resize", resize);
    container.classList.remove("map-page-scroll");
    delete container.dataset.gestureMode;
    handlers.forEach((handler, index) => { if (enabled[index]) handler.enable(); else handler.disable(); });
  };
}
