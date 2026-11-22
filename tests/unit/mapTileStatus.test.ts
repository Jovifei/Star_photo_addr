// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GridLayer, layerGroup, point } from "leaflet";
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import MapTileStatus from "@/components/MapTileStatus";

const { useMap } = vi.hoisted(() => ({ useMap: vi.fn() }));
vi.mock("react-leaflet", () => ({ useMap }));
afterEach(cleanup);

it("keeps the warning when moveend precedes the end of a tile zoom", async () => {
  const failed = new GridLayer();
  const healthy = new GridLayer();
  const map = layerGroup([failed, healthy]);
  useMap.mockReturnValue(map);
  const coords = Object.assign(point(212, 105), { z: 8 });
  const broken = { coords, tile: document.createElement("img") };
  const replacement = { coords, tile: document.createElement("img") };
  const redraw = vi.spyOn(failed, "redraw").mockImplementation(() => failed.fire("tileunload", broken));
  const redrawHealthy = vi.spyOn(healthy, "redraw");
  render(createElement(MapTileStatus));

  await act(async () => {
    map.fire("zoomstart").fire("movestart").fire("moveend");
    failed.fire("tileerror", broken);
  });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重试地图图层" })); });
  expect(redraw).toHaveBeenCalledTimes(1);
  expect(redrawHealthy).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeNull();

  await act(async () => {
    failed.fire("tileloadstart", replacement);
    map.fire("zoomend").fire("moveend");
    healthy.fire("tileload", replacement);
  });
  expect(screen.queryByRole("status")).not.toBeNull();

  await act(async () => { failed.fire("tileload", replacement); });
  expect(screen.queryByRole("status")).toBeNull();
});
