import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  Gift,
  RefreshCw,
} from "lucide-react";

const POLY_API = "https://gamma-api.polymarket.com";
const PAGE_SIZE = 21;

const CATEGORY_SLUG_MAP = {
  Politics: "politics",
  Crypto: "crypto",
  Esports: "esports",
  Iran: "iran",
  Finance: "finance",
  Geopolitics: "geopolitics",
  Tech: "tech",
  Elections: "elections",
  Culture: "pop-culture",
  Economy: "economy",
  Weather: "weather",
  Mentions: "mentions",
  Art: "art",
  Breaking: "breaking",
  Combos: "combos",
  New: "new",
};

const SUBCATEGORY_PRESETS = {
  Politics: [
    { label: "Trump", slug: "trump", count: 318 },
    { label: "Midterms", slug: "midterms", count: 506 },
    { label: "2028 Election", slug: "2028-presidential-election", count: 120 },
    { label: "Congress", slug: "congress", count: 46 },
    { label: "Gov Shutdown", slug: "gov-shutdown", count: 3 },
    { label: "Senate Elections", slug: "senate", count: 51 },
    { label: "House Elections", slug: "house", count: 361 },
    { label: "Global Elections", slug: "elections", count: 389 },
    { label: "Israel Election", slug: "israel", count: 33 },
    { label: "French Election", slug: "france", count: 34 },
  ],
  Crypto: [
    { label: "Bitcoin", slug: "bitcoin", count: 142 },
    { label: "Ethereum", slug: "ethereum", count: 84 },
    { label: "Solana", slug: "solana", count: 41 },
    { label: "Airdrops", slug: "airdrops", count: 29 },
    { label: "Memecoins", slug: "memecoins", count: 18 },
    { label: "ETF", slug: "etf", count: 24 },
  ],
};

function safeParseArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function formatVol(vol) {
  const num = Number(vol) || 0;
  if (num >= 1_000_000_000)
    return `$${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B Vol.`;
  if (num >= 1_000_000) return `$${Math.round(num / 1_000_000)}M Vol.`;
  if (num >= 1_000) return `$${Math.round(num / 1_000)}K Vol.`;
  return `$${Math.round(num)} Vol.`;
}

function SemiGauge({ percent }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 20;
  const c = Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = clamped >= 50 ? "#22c55e" : "#ef4444";

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-12 h-7 flex items-end justify-center">
        <svg viewBox="0 0 50 28" className="w-12 h-7 overflow-visible">
          <path
            d="M 5 25 A 20 20 0 0 1 45 25"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 5 25 A 20 20 0 0 1 45 25"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute bottom-0 text-[12px] font-bold text-white tabular-nums leading-none">
          {clamped}%
        </span>
      </div>
      <span className="text-[10px] text-gray-400 mt-0.5">chance</span>
    </div>
  );
}

export default function CategoryPage({
  category,
  searchQuery = "",
  onSelectEvent,
}) {
  const [subTags, setSubTags] = useState([]);
  const [selectedSub, setSelectedSub] = useState("all");
  const [localFilter, setLocalFilter] = useState("");
  const [showFilterBox, setShowFilterBox] = useState(false);
  const [sortBy, setSortBy] = useState("volume24hr");
  const [events, setEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState(() => new Set());

  const sentinelRef = useRef(null);
  const abortRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Reset sub-selection when category changes
  useEffect(() => {
    setSelectedSub("all");
    setLocalFilter("");
    setSortBy(category === "New" ? "startDate" : "volume24hr");
  }, [category, searchQuery]);

  // Fetch category events (auto-fallback to public-search if tag_slug is empty)
  const fetchCategoryEvents = useCallback(
    async (nextOffset, reset) => {
      if (reset && abortRef.current) abortRef.current.abort();
      if (!reset && isFetchingRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      isFetchingRef.current = true;
      setLoading(true);

      try {
        let batch = [];

        if (searchQuery) {
          const res = await fetch(
            `${POLY_API}/public-search?q=${encodeURIComponent(
              searchQuery,
            )}&limit_per_type=24`,
            { signal: controller.signal },
          );
          const data = await res.json();
          batch = Array.isArray(data?.events) ? data.events : [];
        } else {
          const activeSlug =
            selectedSub !== "all"
              ? selectedSub
              : CATEGORY_SLUG_MAP[category] || category.toLowerCase();

          const params = new URLSearchParams({
            active: "true",
            closed: "false",
            order: sortBy,
            ascending: "false",
            limit: String(PAGE_SIZE),
            offset: String(nextOffset),
          });

          if (
            !["New", "Breaking", "Trending"].includes(category) ||
            selectedSub !== "all"
          ) {
            params.set("tag_slug", activeSlug);
          }

          const res = await fetch(`${POLY_API}/events?${params.toString()}`, {
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            batch = Array.isArray(data) ? data : data.events || [];
          }

          // Fallback to public-search if a specific tag_slug returned nothing on page 0
          if (reset && batch.length === 0) {
            const fallbackQ = selectedSub !== "all" ? selectedSub : category;
            const sRes = await fetch(
              `${POLY_API}/public-search?q=${encodeURIComponent(
                fallbackQ,
              )}&limit_per_type=24`,
              { signal: controller.signal },
            );
            const sData = await sRes.json();
            batch = Array.isArray(sData?.events) ? sData.events : [];
          }
        }

        // Extract dynamic sub-tags from fetched events if no preset exists
        if (reset && !searchQuery) {
          const preset = SUBCATEGORY_PRESETS[category];
          if (preset) {
            setSubTags(preset);
          } else {
            const map = new Map();
            batch.forEach((ev) => {
              (ev.tags || []).forEach((t) => {
                if (!t?.label || !t?.slug || t.label === category) return;
                const prev = map.get(t.slug);
                map.set(t.slug, {
                  label: t.label,
                  slug: t.slug,
                  count: (prev?.count || 0) + 1,
                });
              });
            });
            setSubTags(Array.from(map.values()).slice(0, 14));
          }
        }

        setEvents((prev) => {
          if (reset) return batch;
          const seen = new Set(prev.map((e) => e.id));
          return [...prev, ...batch.filter((e) => !seen.has(e.id))];
        });

        const next = nextOffset + batch.length;
        setOffset(next);
        setHasMore(!searchQuery && batch.length === PAGE_SIZE && next < 2000);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        if (abortRef.current === controller) {
          isFetchingRef.current = false;
          setLoading(false);
        }
      }
    },
    [category, selectedSub, sortBy, searchQuery],
  );

  useEffect(() => {
    setEvents([]);
    setOffset(0);
    setHasMore(true);
    fetchCategoryEvents(0, true);
  }, [fetchCategoryEvents]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          fetchCategoryEvents(offset, false);
        }
      },
      { rootMargin: "450px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [offset, hasMore, fetchCategoryEvents]);

  const displayedEvents = localFilter.trim()
    ? events.filter((e) =>
        e.title?.toLowerCase().includes(localFilter.toLowerCase()),
      )
    : events;

  const toggleBookmark = (id, e) => {
    e.stopPropagation();
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0e1015] text-white">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-7 items-start">
        {/* LEFT SUBCATEGORY SIDEBAR */}
        {!searchQuery && (
          <aside className="w-full lg:w-[220px] shrink-0 space-y-1">
            <button
              onClick={() => setSelectedSub("all")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                selectedSub === "all"
                  ? "bg-[#1c2029] text-white"
                  : "text-gray-300 hover:bg-white/[0.04]"
              }`}
            >
              <span>All</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {events.length > 0 ? `${events.length}+` : ""}
              </span>
            </button>

            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
              {subTags.map((tag) => (
                <button
                  key={tag.slug}
                  onClick={() => setSelectedSub(tag.slug)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    selectedSub === tag.slug
                      ? "bg-[#1c2029] text-white"
                      : "text-gray-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="truncate">{tag.label}</span>
                  <span className="text-xs text-gray-500 ml-3 tabular-nums">
                    {tag.count}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* RIGHT CONTENT: TITLE + 3-COLUMN GRID */}
        <div className="flex-1 min-w-0 w-full">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4 mb-5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {searchQuery ? `Search: "${searchQuery}"` : category}
            </h1>

            <div className="flex items-center gap-2 text-gray-400">
              {showFilterBox && (
                <input
                  value={localFilter}
                  onChange={(e) => setLocalFilter(e.target.value)}
                  placeholder="Filter loaded..."
                  className="bg-[#1b1e27] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-40"
                />
              )}
              <button
                onClick={() => setShowFilterBox((s) => !s)}
                className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                title="Filter"
              >
                <Search size={17} />
              </button>
              <button
                onClick={() =>
                  setSortBy((s) =>
                    s === "volume24hr" ? "volume" : "volume24hr",
                  )
                }
                className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                title={`Sort: ${sortBy}`}
              >
                <SlidersHorizontal size={17} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                title="Bookmarks"
              >
                <Bookmark size={17} />
              </button>
            </div>
          </div>

          {/* 3-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {displayedEvents.map((ev) => {
              const activeMkts = (ev.markets || []).filter(
                (m) => m.active !== false && m.closed !== true,
              );
              const mkts =
                activeMkts.length > 0 ? activeMkts : ev.markets || [];
              if (!mkts.length) return null;

              const isSingleBinary = mkts.length === 1;
              const firstPrices = safeParseArray(mkts[0].outcomePrices, [
                "0.5",
                "0.5",
              ]);
              const firstPct = Math.round(
                (parseFloat(firstPrices[0]) || 0) * 100,
              );
              const topTwo = [...mkts]
                .sort(
                  (a, b) =>
                    parseFloat(safeParseArray(b.outcomePrices)[0] || 0) -
                    parseFloat(safeParseArray(a.outcomePrices)[0] || 0),
                )
                .slice(0, 2);

              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent?.(ev)}
                  className="bg-[#181b23] hover:bg-[#1d212b] border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col justify-between min-h-[175px] cursor-pointer transition-all"
                >
                  {isSingleBinary ? (
                    <>
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {(ev.icon || ev.image) && (
                            <img
                              src={ev.icon || ev.image}
                              alt={ev.title}
                              className="w-9 h-9 rounded-lg object-cover bg-white/10 shrink-0"
                            />
                          )}
                          <h3 className="text-[14px] font-semibold text-white leading-snug line-clamp-2">
                            {ev.title}
                          </h3>
                        </div>
                        <SemiGauge percent={firstPct} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent?.(ev, mkts[0].id, "Yes");
                          }}
                          className="py-2 rounded-lg bg-[#163628] hover:bg-[#1c4835] text-[#3dd68c] text-xs font-semibold"
                        >
                          Yes
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent?.(ev, mkts[0].id, "No");
                          }}
                          className="py-2 rounded-lg bg-[#42181a] hover:bg-[#571f22] text-[#f2645a] text-xs font-semibold"
                        >
                          No
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2.5 mb-3">
                        {(ev.icon || ev.image) && (
                          <img
                            src={ev.icon || ev.image}
                            alt={ev.title}
                            className="w-9 h-9 rounded-lg object-cover bg-white/10 shrink-0"
                          />
                        )}
                        <h3 className="text-[14px] font-semibold text-white leading-snug line-clamp-2">
                          {ev.title}
                        </h3>
                      </div>

                      <div className="space-y-2">
                        {topTwo.map((m) => {
                          const p = safeParseArray(m.outcomePrices, ["0", "1"]);
                          const pct = Math.round((parseFloat(p[0]) || 0) * 100);
                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-[13px] text-gray-200 truncate flex-1">
                                {m.groupItemTitle || m.question}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[13px] font-bold text-white tabular-nums mr-1">
                                  {pct}%
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectEvent?.(ev, m.id, "Yes");
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#163628] hover:bg-[#1c4835] text-[#3dd68c] text-[11px] font-semibold"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectEvent?.(ev, m.id, "No");
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#42181a] hover:bg-[#571f22] text-[#f2645a] text-[11px] font-semibold"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 mt-auto text-xs text-gray-400">
                    <span className="tabular-nums">
                      {formatVol(ev.volume || ev.volume24hr)}
                    </span>
                    <div className="flex items-center gap-2 text-gray-500">
                      <RefreshCw size={12} />
                      <Gift size={13} />
                      <button
                        onClick={(e) => toggleBookmark(ev.id, e)}
                        className="hover:text-white"
                      >
                        <Bookmark
                          size={13}
                          className={
                            bookmarks.has(ev.id) ? "fill-white text-white" : ""
                          }
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[#181b23] border border-white/[0.05] rounded-2xl p-4 h-[175px] animate-pulse"
                />
              ))}
          </div>

          <div ref={sentinelRef} className="h-12" />
        </div>
      </div>
    </div>
  );
}
