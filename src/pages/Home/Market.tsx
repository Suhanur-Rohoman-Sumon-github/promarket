import React, { useState, useEffect, useRef, useCallback } from "react";

const POLY_API = "https://gamma-api.polymarket.com";
const PAGE_SIZE = 20;

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

function formatVolume(vol) {
  const num = Number(vol) || 0;
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M Vol.`;
  }
  if (num >= 1_000) return `$${Math.round(num / 1_000)}K Vol.`;
  return `$${Math.round(num)} Vol.`;
}

function toPercent(priceStr) {
  const p = parseFloat(priceStr);
  if (Number.isNaN(p)) return 0;
  return Math.max(0, Math.min(100, Math.round(p * 100)));
}

export function SemiGauge({ percent, label = "Chance" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 22;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const strokeColor = clamped >= 50 ? "#22c55e" : "#ef4444";

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-14 h-8 flex items-end justify-center">
        <svg viewBox="0 0 56 32" className="w-14 h-8 overflow-visible">
          <path
            d="M 6 28 A 22 22 0 0 1 50 28"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M 6 28 A 22 22 0 0 1 50 28"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <span className="absolute bottom-0 text-[13px] font-bold text-white tabular-nums leading-none">
          {clamped}%
        </span>
      </div>
      <span className="text-[10px] text-gray-400 mt-1">{label}</span>
    </div>
  );
}

function CardFooter({ event, subLabel, bookmarked, onToggleBookmark }) {
  const isLive =
    event.live || event.title?.toLowerCase().includes("up or down");

  return (
    <div className="flex items-center justify-between pt-3 mt-auto text-[12px] text-gray-400">
      <div className="flex items-center gap-1.5 min-w-0">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[#ef4444] font-semibold shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="tabular-nums font-medium text-gray-400 shrink-0">
            {formatVolume(event.volume || event.volume24hr)}
          </span>
        )}
        {subLabel && (
          <>
            <span className="text-gray-600">·</span>
            <span className="truncate text-gray-400">{subLabel}</span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(event.id);
        }}
        title="Bookmark market"
        className="p-1 -mr-1 text-gray-500 hover:text-white transition-colors shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 ${
            bookmarked ? "fill-white stroke-white" : "fill-none stroke-current"
          }`}
          strokeWidth="1.8"
        >
          <path
            d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function MarketCard({ event, bookmarked, onToggleBookmark, onOpenDetail }) {
  const activeMarkets = (event.markets || []).filter(
    (m) => m.active !== false && m.closed !== true,
  );
  const marketsToUse =
    activeMarkets.length > 0 ? activeMarkets : event.markets || [];

  const firstMarket = marketsToUse[0];
  if (!firstMarket) return null;

  const firstOutcomes = safeParseArray(firstMarket.outcomes, ["Yes", "No"]);
  const firstPrices = safeParseArray(firstMarket.outcomePrices, ["0.5", "0.5"]);

  const isBinaryYesNo =
    marketsToUse.length === 1 &&
    firstOutcomes.length === 2 &&
    ["yes", "no", "up", "down"].includes(firstOutcomes[0]?.toLowerCase());

  const isSingleMatchup =
    marketsToUse.length === 1 &&
    firstOutcomes.length === 2 &&
    !["yes", "no", "up", "down"].includes(firstOutcomes[0]?.toLowerCase());

  const isThreeWaySports =
    marketsToUse.length === 3 &&
    marketsToUse.some((m) =>
      (m.groupItemTitle || m.question || "").toLowerCase().includes("draw"),
    );

  const primaryTag = event.tags?.[0]?.label;

  // 1. MATCHUP CARD
  if (isSingleMatchup || isThreeWaySports) {
    let team1, team2, pct1, pct2, hasDraw;
    if (isThreeWaySports) {
      const nonDraw = marketsToUse.filter(
        (m) => !(m.groupItemTitle || "").toLowerCase().includes("draw"),
      );
      hasDraw = true;
      team1 = nonDraw[0]?.groupItemTitle || "Home";
      team2 = nonDraw[1]?.groupItemTitle || "Away";
      pct1 = toPercent(safeParseArray(nonDraw[0]?.outcomePrices)[0]);
      pct2 = toPercent(safeParseArray(nonDraw[1]?.outcomePrices)[0]);
    } else {
      hasDraw = false;
      team1 = firstOutcomes[0];
      team2 = firstOutcomes[1];
      pct1 = toPercent(firstPrices[0]);
      pct2 = toPercent(firstPrices[1]);
    }

    return (
      <div
        onClick={() => onOpenDetail(event, firstMarket.id, "Yes")}
        className="bg-[#181c24] hover:bg-[#1d222c] border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col justify-between transition-all min-h-[184px] cursor-pointer"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {event.icon || event.image ? (
                <img
                  src={event.icon || event.image}
                  alt={team1}
                  className="w-6 h-6 rounded-md object-cover bg-white/5 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {team1.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[14px] font-semibold text-white truncate">
                {team1}
              </span>
            </div>
            <span className="text-[15px] font-bold text-white tabular-nums">
              {pct1}%
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                {team2.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[14px] font-semibold text-white truncate">
                {team2}
              </span>
            </div>
            <span className="text-[15px] font-bold text-white tabular-nums">
              {pct2}%
            </span>
          </div>
        </div>

        <div
          className={`grid gap-2 mt-4 ${hasDraw ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(event, marketsToUse[0]?.id, "Yes");
            }}
            className="py-2 px-2 rounded-lg bg-[#16363c] hover:bg-[#1c464e] text-[#4ad4de] text-[12px] font-semibold truncate transition-colors"
          >
            {team1}
          </button>
          {hasDraw && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(event, marketsToUse[1]?.id, "Yes");
              }}
              className="py-2 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-gray-300 text-[12px] font-semibold transition-colors"
            >
              DRAW
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(
                event,
                marketsToUse[hasDraw ? 2 : 0]?.id,
                hasDraw ? "Yes" : "No",
              );
            }}
            className="py-2 px-2 rounded-lg bg-[#3b1c22] hover:bg-[#4e242c] text-[#f06b76] text-[12px] font-semibold truncate transition-colors"
          >
            {team2}
          </button>
        </div>

        <CardFooter
          event={event}
          subLabel={primaryTag}
          bookmarked={bookmarked}
          onToggleBookmark={onToggleBookmark}
        />
      </div>
    );
  }

  // 2. BINARY GAUGE CARD
  if (isBinaryYesNo) {
    const labelA = firstOutcomes[0];
    const labelB = firstOutcomes[1];
    const pctA = toPercent(firstPrices[0]);

    return (
      <div
        onClick={() => onOpenDetail(event, firstMarket.id, labelA)}
        className="bg-[#181c24] hover:bg-[#1d222c] border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col justify-between transition-all min-h-[184px] cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            {(event.icon || event.image) && (
              <img
                src={event.icon || event.image}
                alt={event.title}
                className="w-9 h-9 rounded-lg object-cover bg-white/5 shrink-0"
              />
            )}
            <h3 className="text-[14px] font-semibold text-white leading-snug line-clamp-2">
              {event.title}
            </h3>
          </div>
          <SemiGauge percent={pctA} label={labelA === "Up" ? "Up" : "Chance"} />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(event, firstMarket.id, labelA);
            }}
            className="py-2 rounded-lg bg-[#163628] hover:bg-[#1c4835] text-[#3dd68c] text-[13px] font-semibold transition-colors"
          >
            {labelA}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(event, firstMarket.id, labelB);
            }}
            className="py-2 rounded-lg bg-[#42181a] hover:bg-[#571f22] text-[#f2645a] text-[13px] font-semibold transition-colors"
          >
            {labelB}
          </button>
        </div>

        <CardFooter
          event={event}
          subLabel={primaryTag}
          bookmarked={bookmarked}
          onToggleBookmark={onToggleBookmark}
        />
      </div>
    );
  }

  // 3. MULTI-OUTCOME CARD
  const topMarkets = [...marketsToUse]
    .sort((a, b) => {
      const pa = parseFloat(safeParseArray(a.outcomePrices)[0] || 0);
      const pb = parseFloat(safeParseArray(b.outcomePrices)[0] || 0);
      return pb - pa;
    })
    .slice(0, 2);

  return (
    <div
      onClick={() => onOpenDetail(event, topMarkets[0]?.id, "Yes")}
      className="bg-[#181c24] hover:bg-[#1d222c] border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col justify-between transition-all min-h-[184px] cursor-pointer"
    >
      <div className="flex items-start gap-2.5 mb-3">
        {(event.icon || event.image) && (
          <img
            src={event.icon || event.image}
            alt={event.title}
            className="w-9 h-9 rounded-lg object-cover bg-white/5 shrink-0"
          />
        )}
        <h3 className="text-[14px] font-semibold text-white leading-snug line-clamp-2">
          {event.title}
        </h3>
      </div>

      <div className="space-y-2">
        {topMarkets.map((mkt) => {
          const prices = safeParseArray(mkt.outcomePrices, ["0", "1"]);
          const pct = toPercent(prices[0]);
          const rowLabel = mkt.groupItemTitle || mkt.question;

          return (
            <div
              key={mkt.id}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-[13px] text-gray-200 truncate flex-1">
                {rowLabel}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] font-bold text-white tabular-nums mr-1">
                  {pct}%
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(event, mkt.id, "Yes");
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#163628] hover:bg-[#1c4835] text-[#3dd68c] text-[11px] font-semibold transition-colors"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(event, mkt.id, "No");
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#42181a] hover:bg-[#571f22] text-[#f2645a] text-[11px] font-semibold transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <CardFooter
        event={event}
        subLabel={primaryTag}
        bookmarked={bookmarked}
        onToggleBookmark={onToggleBookmark}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#181c24] border border-white/[0.05] rounded-2xl p-4 min-h-[184px] flex flex-col justify-between animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/[0.07] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-white/[0.08] rounded w-4/5" />
          <div className="h-3.5 bg-white/[0.06] rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2.5 my-3">
        <div className="h-6 bg-white/[0.05] rounded-lg" />
        <div className="h-6 bg-white/[0.05] rounded-lg" />
      </div>
      <div className="h-3 bg-white/[0.05] rounded w-1/4" />
    </div>
  );
}

export default function PolymarketExplorePage({ onSelectEvent }) {
  const [events, setEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookmarks, setBookmarks] = useState(() => new Set());

  const sentinelRef = useRef(null);
  const abortRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchEvents = useCallback(async (nextOffset, reset = false) => {
    if (reset && abortRef.current) abortRef.current.abort();
    if (!reset && isFetchingRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    isFetchingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        active: "true",
        closed: "false",
        order: "volume24hr",
        ascending: "false",
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });

      const res = await fetch(`${POLY_API}/events?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Polymarket API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const batch = Array.isArray(data) ? data : data.events || [];

      setEvents((prev) => {
        if (reset) return batch;
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...batch.filter((e) => !seen.has(e.id))];
      });

      const next = nextOffset + batch.length;
      setOffset(next);
      setHasMore(batch.length === PAGE_SIZE && next < 2000);
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Unable to fetch from Polymarket API.");
    } finally {
      if (abortRef.current === controller) {
        isFetchingRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchEvents(0, true);
    return () => abortRef.current?.abort();
  }, [fetchEvents]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          fetchEvents(offset, false);
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [offset, hasMore, fetchEvents]);

  const toggleBookmark = (id) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="bg-[#0e1218] text-white font-sans antialiased">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-5">
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {events.map((event) => (
            <MarketCard
              key={event.id}
              event={event}
              bookmarked={bookmarks.has(event.id)}
              onToggleBookmark={toggleBookmark}
              onOpenDetail={(ev, mktId, side) =>
                onSelectEvent?.(ev, mktId, side)
              }
            />
          ))}

          {loading &&
            Array.from({ length: events.length === 0 ? 12 : 4 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} />
            ))}
        </div>

        <div
          ref={sentinelRef}
          className="h-14 flex items-center justify-center mt-4"
        />
      </div>
    </section>
  );
}
