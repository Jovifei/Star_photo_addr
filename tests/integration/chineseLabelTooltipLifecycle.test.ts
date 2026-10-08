// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Browser } from 'leaflet';
import { MapContainer, useMap } from 'react-leaflet';
import type { Map } from 'leaflet';
const state = vi.hoisted(() => ({ visible: [0, 1] }));
vi.mock('@/lib/labelLayout', () => ({ spacedLabelIndices: () => state.visible }));
import ChineseLabelLayer from '@/components/ChineseLabelLayer';
const initialCapabilities = { svg: Browser.svg, any3d: Browser.any3d };
let observer: MutationObserver | undefined;
let map: Map;
function MapRef() { map = useMap(); return null; }
afterEach(() => {
  observer?.disconnect();
  cleanup();
  Object.assign(Browser, initialCapabilities);
  state.visible = [0, 1];
  vi.unstubAllEnvs();
});
it('real Leaflet and React-Leaflet preserve names across portal deletion and the 200ms host fade', async () => {
  vi.stubEnv('NEXT_PUBLIC_TIANDITU_TOKEN', '');
  // jsdom has no SVG/3D capability detection. Enable the production fade path
  // without mocking Leaflet hosts, React portals, events or removal timing.
  Object.assign(Browser, { svg: true, any3d: true });
  const audit: string[] = [];
  observer = new MutationObserver(() => {
    for (const el of document.querySelectorAll('[role=tooltip]')) {
      if (!(el.getAttribute('aria-label')?.trim() || el.textContent?.trim())) audit.push(el.outerHTML);
    }
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  render(createElement(MapContainer, { center: [35, 105], zoom: 4, fadeAnimation: true, style: { width: 375, height: 812 } }, createElement(MapRef), createElement(ChineseLabelLayer)));
  const hosts = [...document.querySelectorAll<HTMLElement>('.chinese-fallback-label')];
  expect(hosts).toHaveLength(2);
  expect(hosts.map(el => el.textContent)).toEqual(['中国', '北京']);
  expect(screen.getByRole('tooltip', { name: '中国' })).toBe(hosts[0]);
  expect(screen.getByRole('tooltip', { name: '北京' })).toBe(hosts[1]);
  await act(async () => { state.visible = []; map.fire('moveend'); });
  expect(hosts.every(el => el.isConnected)).toBe(true);
  expect(hosts.map(el => el.textContent)).toEqual(['', '']);
  expect(hosts.map(el => el.style.opacity)).toEqual(['0', '0']);
  expect(screen.getByRole('tooltip', { name: '中国' })).toBe(hosts[0]);
  expect(screen.getByRole('tooltip', { name: '北京' })).toBe(hosts[1]);
  expect(audit).toEqual([]);
  await act(async () => { await new Promise(r => setTimeout(r, 240)); });
  expect(hosts.every(el => !el.isConnected)).toBe(true);
  observer.disconnect();
});
