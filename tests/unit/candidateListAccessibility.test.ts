// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { selectNight } = vi.hoisted(() => ({ selectNight: vi.fn() }));
vi.mock("@/hooks/useCandidateForecasts", () => ({ useCandidateForecasts: () => null }));
vi.mock("@/lib/store", () => ({
  cachedForecast: () => null,
  useStore: () => ({ selectNight, setCandidates: vi.fn(), state: {
    nightKeys: ["2026-10-04", "2026-10-05"], selectedNight: "2026-10-04",
    forecastCache: {}, selectedLocation: null, forecast: null, candidateForecastModel: "best_match",
  } }),
}));
import CandidateList from "@/components/CandidateList";
const candidate = { id: "a", name: "测试机位", latitude: 30, longitude: 120, elevation: 0, province: "浙江", adcode: 330100, city: "杭州", bortle: 4, kind: "curated", note: "fixture" };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  const onPick = vi.fn(), onRemove = vi.fn();
  const { container } = render(createElement(CandidateList, { candidates: [candidate], onPick, onRemove }));
  return { onPick, onRemove, card: container.querySelector(".candidate-card") as HTMLElement };
}
describe("candidate card independent controls", () => {
  it("uses a native selection button without nested controls", () => {
    const { onPick, card } = setup();
    const pick = within(card).getByRole("button", { name: "选择候选地点 测试机位" });
    expect(pick.tagName).toBe("BUTTON");
    expect(pick.querySelector("button, a, [tabindex], [role=button]")).toBeNull();
    fireEvent.click(pick);
    expect(onPick).toHaveBeenCalledExactlyOnceWith(candidate);
  });
  it.each(["Enter", " "])("does not hijack %s on date or remove controls", (key) => {
    const { onPick, onRemove, card } = setup();
    const nextNight = card.querySelectorAll(".mini-capsule")[1];
    fireEvent.keyDown(nextNight, { key });
    fireEvent.click(nextNight);
    expect(selectNight).toHaveBeenCalledExactlyOnceWith("2026-10-05");
    expect(onPick).not.toHaveBeenCalled();
    const remove = within(card).getByRole("button", { name: "从候选对比中移除 测试机位" });
    fireEvent.keyDown(remove, { key });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("a");
    expect(onPick).not.toHaveBeenCalled();
  });
  it("preserves pointer selection on card background", () => {
    const { card, onPick } = setup();
    fireEvent.click(card);
    expect(onPick).toHaveBeenCalledExactlyOnceWith(candidate);
  });
});
