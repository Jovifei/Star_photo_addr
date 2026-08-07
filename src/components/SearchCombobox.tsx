"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

/** Debounced place search dropdown backed by /api/geocode. */
export default function SearchCombobox({
  onPick,
}: {
  onPick: (result: GeocodeResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/geocode?q=${encodeURIComponent(trimmed)}&count=8&language=zh`,
        { signal: controller.signal },
      )
        .then((res) => res.json())
        .then((data: { results?: GeocodeResult[] }) => {
          setResults(data.results ?? []);
          setOpen(true);
          setActive(-1);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (result: GeocodeResult) => {
    setQuery(result.name);
    setOpen(false);
    onPick(result);
  };

  const label = (r: GeocodeResult) =>
    [r.admin1, r.country].filter(Boolean).join(" · ");

  // Derived open state: only show the dropdown once the query is long enough.
  // Clearing it (query < 2 chars) is expressed here rather than via a synchronous
  // setState inside the effect, which the react-hooks rules forbid.
  const showResults = open && query.trim().length >= 2;

  return (
    <div className="search-combobox" ref={boxRef}>
      <label className="search-box">
        <span aria-hidden="true">⌕</span>
        <span className="sr-only">搜索地点、城市或观测点</span>
        <input
          aria-label="搜索地点、城市或观测点"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="place-search-results"
          aria-expanded={showResults}
          placeholder="搜索全球城市或地点"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (!showResults || !results.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (event.key === "Enter" && active >= 0) {
              event.preventDefault();
              choose(results[active]);
            }
          }}
        />
      </label>
      {showResults && (
        <ul className="suggestions" id="place-search-results">
          {loading && !results.length && (
            <li className="empty">搜索中…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="empty">无匹配结果</li>
          )}
          {results.map((result, index) => (
            <li
              key={result.id}
              className={index === active ? "active" : ""}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(result);
              }}
            >
              <span>{result.name}</span>
              <span className="sub">{label(result)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
