import React, { useState, useEffect, useMemo, useRef } from "react";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const LINE_COLORS = ["#60a5fa", "#2563eb", "#eab308", "#f97316"] as const;

// ---------- Types ----------
export interface PolymarketTag {
  id?: string;
  label?: string;
  slug?: string;
}

export interface PolymarketMarket {
  id: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: string[] | string;
  outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string;
  active?: boolean;
  closed?: boolean;
}

export interface PolymarketEvent {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  endDate?: string;
  category?: string;
  volume?: number | string;
  volume24hr?: number | string;
  tags?: PolymarketTag[];
  markets?: PolymarketMarket[];
}

interface HotTopic {
  rank: number;
  name: string;
  slug: string;
  volume: number;
  topEvent: PolymarketEvent;
}

interface OutcomeItem {
  id: string;
  marketId: string;
  name: string;
  prob: number;
  pct: number;
  tokenId: string | null;
  color: string;
}

interface PricePoint {
  t: number;
  p: number;
}

export interface PerpsDashboardProps {
  onSelectEvent?: (event: PolymarketEvent) => void;
  onExploreAll?: () => void;
  onOpenRewards?: () => void;
}

// ---------- Helpers ----------
function safeParseArray<T = string>(val: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed: unknown = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function formatCompactVol(vol: number | string | undefined): string {
  const num = Number(vol) || 0;
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return `$${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `$${Math.round(num)}`;
}

function formatEndDate(iso?: string): string {
  if (!iso) return "Open";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Open";
  return `Ends ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function shortPillTitle(title = ""): string {
  const cleaned = title
    .replace(/^(Will |Who will |What |Which )/i, "")
    .replace(/\?$/, "")
    .trim();
  return cleaned.length > 22 ? `${cleaned.slice(0, 20).trim()}…` : cleaned;
}

function buildFallbackSeries(
  endProb: number,
  count = 48,
  seed = 1,
): PricePoint[] {
  const now = Math.floor(Date.now() / 1000);
  const step = 300; // 5-min ticks
  const arr: PricePoint[] = [];
  const start = Math.max(0.05, Math.min(0.95, 0.5 + ((seed % 3) - 1) * 0.08));
  for (let i = 0; i < count; i++) {
    const t = now - (count - 1 - i) * step;
    const progress = i / (count - 1);
    const wave =
      Math.sin((i + seed * 2) * 0.5) * 0.045 +
      Math.cos((i + seed) * 0.9) * 0.02;
    const p =
      i === count - 1
        ? endProb
        : Math.max(
            0.02,
            Math.min(0.98, start * (1 - progress) + endProb * progress + wave),
          );
    arr.push({ t, p });
  }
  return arr;
}

export default function PerpsDashboard({
  onSelectEvent,
  onExploreAll,
  onOpenRewards,
}: PerpsDashboardProps) {
  const [slides, setSlides] = useState<PolymarketEvent[]>([]);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyCache, setHistoryCache] = useState<
    Record<string, Record<string, PricePoint[]>>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set());

  const fetchingCacheRef = useRef<Set<string>>(new Set());

  // 1. Fetch Top Trending Events + Build Live Hot Topics (Fast single request)
  useEffect(() => {
    const controller = new AbortController();

    async function loadTrending() {
      try {
        const res = await fetch(
          `${GAMMA_API}/events?active=true&closed=false&order=volume24hr&ascending=false&limit=25`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Failed to load trending");
        const data: unknown = await res.json();
        const events: PolymarketEvent[] = Array.isArray(data)
          ? (data as PolymarketEvent[])
          : (data as { events?: PolymarketEvent[] }).events || [];

        // Top 12 highest 24h-volume events for carousel (Index 0 = #1 trending)
        const topSlides = events.slice(0, 12);
        setSlides(topSlides);

        // Aggregate top 5 Hot Topics by 24h volume from live Polymarket tags
        const topicMap = new Map<string, Omit<HotTopic, "rank">>();
        events.forEach((ev) => {
          const vol24 = Number(ev.volume24hr || ev.volume || 0);
          const tag = ev.tags?.[0];
          const label = tag?.label || ev.category;
          if (!label || label.toLowerCase() === "all") return;
          const slug = tag?.slug || label.toLowerCase();

          const existing = topicMap.get(label);
          if (existing) {
            existing.volume += vol24;
          } else {
            topicMap.set(label, {
              name: label,
              slug,
              volume: vol24,
              topEvent: ev,
            });
          }
        });

        const rankedTopics: HotTopic[] = Array.from(topicMap.values())
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 5)
          .map((t, idx) => ({ ...t, rank: idx + 1 }));

        setHotTopics(rankedTopics);
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("Banner fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadTrending();
    return () => controller.abort();
  }, []);

  // 2. Auto-advance Carousel (pauses on hover)
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [slides.length, isPaused]);

  const activeEvent = slides[activeIndex] || null;
  const prevIndex =
    slides.length > 0 ? (activeIndex - 1 + slides.length) % slides.length : 0;
  const nextIndex = slides.length > 0 ? (activeIndex + 1) % slides.length : 0;

  // Extract Top 4 Outcomes for Active Slide
  const topOutcomes = useMemo<OutcomeItem[]>(() => {
    if (!activeEvent) return [];
    const activeMkts = (activeEvent.markets || []).filter(
      (m) => m.active !== false && m.closed !== true,
    );
    const list = activeMkts.length > 0 ? activeMkts : activeEvent.markets || [];

    // If single binary market, show its two outcomes (e.g. Yes / No)
    if (list.length === 1) {
      const m = list[0];
      const names = safeParseArray<string>(m.outcomes, ["Yes", "No"]);
      const prices = safeParseArray<string>(m.outcomePrices, ["0.5", "0.5"]);
      const tokens = safeParseArray<string>(m.clobTokenIds, []);
      return names.slice(0, 2).map((name, idx) => {
        const prob = parseFloat(prices[idx]) || 0;
        return {
          id: `${m.id}-${idx}`,
          marketId: m.id,
          name,
          prob,
          pct: Math.round(prob * 100),
          tokenId: tokens[idx] || null,
          color: LINE_COLORS[idx % LINE_COLORS.length],
        };
      });
    }

    // Multi-outcome event: sort by highest probability, take top 4
    return list
      .map((m, idx) => {
        const prices = safeParseArray<string>(m.outcomePrices, ["0.5", "0.5"]);
        const tokens = safeParseArray<string>(m.clobTokenIds, []);
        const prob = parseFloat(prices[0]) || 0;
        return {
          id: m.id || `o-${idx}`,
          marketId: m.id,
          name: m.groupItemTitle || m.question || `Option ${idx + 1}`,
          prob,
          pct: Math.round(prob * 100),
          tokenId: tokens[0] || null,
        };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 4)
      .map((o, idx) => ({
        ...o,
        color: LINE_COLORS[idx % LINE_COLORS.length],
      }));
  }, [activeEvent]);

  // 3. Fetch & Cache Live CLOB Chart History for Active Slide
  useEffect(() => {
    if (!activeEvent || topOutcomes.length === 0) return;
    if (
      historyCache[activeEvent.id] ||
      fetchingCacheRef.current.has(activeEvent.id)
    ) {
      return;
    }

    const eventId = activeEvent.id;
    fetchingCacheRef.current.add(eventId);
    let cancelled = false;

    async function loadSlideChart() {
      const entries: Array<[string, PricePoint[]]> = await Promise.all(
        topOutcomes.map(async (item, idx): Promise<[string, PricePoint[]]> => {
          if (!item.tokenId) {
            return [item.id, buildFallbackSeries(item.prob, 48, idx + 1)];
          }
          try {
            const res = await fetch(
              `${CLOB_API}/prices-history?market=${encodeURIComponent(
                item.tokenId,
              )}&interval=1d&fidelity=15`,
            );
            if (!res.ok) throw new Error("CLOB fail");
            const json = (await res.json()) as {
              history?: Array<{ t: number | string; p: number | string }>;
            };
            const hist = Array.isArray(json.history) ? json.history : [];
            if (hist.length < 4) {
              return [item.id, buildFallbackSeries(item.prob, 48, idx + 1)];
            }
            return [
              item.id,
              hist
                .slice(-60)
                .map((pt) => ({ t: Number(pt.t), p: Number(pt.p) })),
            ];
          } catch {
            return [item.id, buildFallbackSeries(item.prob, 48, idx + 1)];
          }
        }),
      );

      if (!cancelled) {
        setHistoryCache((prev) => ({
          ...prev,
          [eventId]: Object.fromEntries(entries),
        }));
      }
    }

    loadSlideChart();
    return () => {
      cancelled = true;
    };
  }, [activeEvent, topOutcomes, historyCache]);

  const activeSeriesMap: Record<string, PricePoint[]> =
    (activeEvent && historyCache[activeEvent.id]) || {};

  // Chart Dimensions & X-Axis Labels
  const chartW = 460;
  const chartH = 195;

  const xLabels = useMemo<string[]>(() => {
    const firstSeries =
      topOutcomes
        .map((o) => activeSeriesMap[o.id])
        .find((s): s is PricePoint[] => Boolean(s && s.length >= 4)) ||
      buildFallbackSeries(0.5, 48, 1);

    const indices = [0.05, 0.22, 0.4, 0.57, 0.74, 0.91].map((r) =>
      Math.min(firstSeries.length - 1, Math.floor(r * firstSeries.length)),
    );

    return indices.map((i) =>
      new Date(firstSeries[i].t * 1000)
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        .replace(" ", "")
        .toLowerCase(),
    );
  }, [topOutcomes, activeSeriesMap]);

  // Description / Context lines for bottom-left of carousel card
  const contextSnippets = useMemo(() => {
    if (!activeEvent) return [];
    const desc = (activeEvent.description || "").trim();
    const lines = desc
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 20)
      .slice(0, 2);

    if (lines.length > 0) {
      return lines.map((text, idx) => ({
        source: idx === 0 ? "Market Resolution Rules" : "Live Polymarket Feed",
        time: idx === 0 ? "Active" : "24h",
        headline: text.length > 92 ? `${text.slice(0, 90)}…` : text,
      }));
    }

    return [
      {
        source: "Polymarket Live",
        time: "Updated",
        headline: `24h trading volume at ${formatCompactVol(
          activeEvent.volume24hr || activeEvent.volume,
        )} across ${activeEvent.markets?.length || 1} market(s).`,
      },
    ];
  }, [activeEvent]);

  const toggleBookmark = (
    id: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-[#0c0e13] text-white font-sans antialiased pt-6 pb-4 px-4 md:px-6">
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: TRENDING CAROUSEL ================= */}
        <div
          className="lg:col-span-8 flex flex-col gap-3.5"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Main Featured Card */}
          {loading || !activeEvent ? (
            <div className="bg-[#171b22] border border-white/[0.06] rounded-2xl p-6 min-h-[372px] animate-pulse flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10" />
                <div className="h-6 bg-white/10 rounded w-2/3" />
              </div>
              <div className="grid grid-cols-12 gap-6 my-6">
                <div className="col-span-5 space-y-4">
                  <div className="h-5 bg-white/10 rounded" />
                  <div className="h-5 bg-white/10 rounded" />
                  <div className="h-5 bg-white/10 rounded" />
                  <div className="h-5 bg-white/10 rounded" />
                </div>
                <div className="col-span-7 h-48 bg-white/[0.06] rounded-xl" />
              </div>
            </div>
          ) : (
            <div
              onClick={() => onSelectEvent?.(activeEvent)}
              className="bg-[#171b22] hover:bg-[#191e26] border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-5 md:p-6 shadow-2xl transition-colors cursor-pointer"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3.5 min-w-0">
                  {(activeEvent.icon || activeEvent.image) && (
                    <img
                      src={activeEvent.icon || activeEvent.image}
                      alt={activeEvent.title}
                      className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover bg-white/10 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        {activeIndex === 0
                          ? "#1 Trending"
                          : `#${activeIndex + 1} Trending`}
                      </span>
                      {activeEvent.tags?.[0]?.label && (
                        <span className="text-[11px] text-gray-400 font-medium">
                          {activeEvent.tags[0].label}
                        </span>
                      )}
                    </div>
                    <h1 className="text-lg md:text-[22px] font-bold text-white tracking-tight truncate">
                      {activeEvent.title}
                    </h1>
                  </div>
                </div>

                {/* Copy & Bookmark Icons */}
                <div className="flex items-center gap-1 text-gray-400 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText(
                        `${window.location.origin}/#/event/${activeEvent.slug}`,
                      );
                      setCopiedId(activeEvent.id);
                      window.setTimeout(() => setCopiedId(null), 1400);
                    }}
                    title="Copy market link"
                    className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors relative"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 stroke-current fill-none"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                        strokeLinecap="round"
                      />
                    </svg>
                    {copiedId === activeEvent.id && (
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] bg-white text-black px-1.5 py-0.5 rounded font-bold">
                        Copied
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => toggleBookmark(activeEvent.id, e)}
                    title="Bookmark"
                    className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`w-4 h-4 ${
                        bookmarks.has(activeEvent.id)
                          ? "fill-white stroke-white"
                          : "fill-none stroke-current"
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
              </div>

              {/* Card Split Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                {/* Left Outcomes + Context Feed */}
                <div className="md:col-span-5 flex flex-col justify-between">
                  <div className="space-y-3">
                    {topOutcomes.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-[14px] font-medium text-gray-200 truncate">
                          {o.name}
                        </span>
                        <span className="text-[18px] font-bold text-white tabular-nums shrink-0">
                          {o.pct}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Context / News Snippets */}
                  <div className="mt-5 pt-3 space-y-2.5 relative overflow-hidden">
                    {contextSnippets.map((item, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                          <span className="px-1 py-[1px] bg-white/[0.08] text-gray-300 rounded text-[9px] font-bold">
                            PM
                          </span>
                          <span>{item.source}</span>
                          <span>·</span>
                          <span>{item.time}</span>
                        </p>
                        <p className="text-[12px] text-gray-300 leading-snug line-clamp-2">
                          {item.headline}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 text-xs text-gray-400 font-medium tabular-nums">
                    {formatCompactVol(
                      activeEvent.volume24hr || activeEvent.volume,
                    )}{" "}
                    Vol
                  </div>
                </div>

                {/* Right Multi-Line Chart */}
                <div className="md:col-span-7 flex flex-col justify-between">
                  {/* Chart Legend */}
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mb-3">
                    {topOutcomes.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: o.color }}
                        />
                        <span className="text-gray-300 truncate max-w-[115px]">
                          {o.name}
                        </span>
                        <span className="text-white font-bold tabular-nums">
                          {o.pct}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SVG Lines + Y Axis */}
                  <div className="flex items-stretch">
                    <div className="flex-1 relative">
                      <svg
                        viewBox={`0 0 ${chartW} ${chartH}`}
                        className="w-full h-[195px] overflow-visible"
                        preserveAspectRatio="none"
                      >
                        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                          <line
                            key={r}
                            x1="0"
                            y1={r * chartH}
                            x2={chartW}
                            y2={r * chartH}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                            strokeDasharray="2 4"
                          />
                        ))}

                        {topOutcomes.map((o, idx) => {
                          const s =
                            activeSeriesMap[o.id] ||
                            buildFallbackSeries(o.prob, 48, idx + 1);
                          if (s.length < 2) return null;

                          const d = s
                            .map((pt, i) => {
                              const x = (i / (s.length - 1)) * chartW;
                              const y = Math.max(
                                3,
                                Math.min(chartH - 3, chartH - pt.p * chartH),
                              );
                              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(
                                1,
                              )}`;
                            })
                            .join(" ");

                          const lastPt = s[s.length - 1];
                          const lastY = Math.max(
                            3,
                            Math.min(chartH - 3, chartH - lastPt.p * chartH),
                          );

                          return (
                            <g key={o.id}>
                              <path
                                d={d}
                                fill="none"
                                stroke={o.color}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx={chartW}
                                cy={lastY}
                                r="3.2"
                                fill={o.color}
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Right Y-Axis Ticks */}
                    <div className="flex flex-col justify-between pl-2.5 h-[195px] text-[11px] text-gray-400 tabular-nums select-none">
                      <span>100%</span>
                      <span>75%</span>
                      <span>50%</span>
                      <span>25%</span>
                      <span>0%</span>
                    </div>
                  </div>

                  {/* X-Axis Labels */}
                  <div className="flex items-center justify-between pr-10 mt-2 text-[11px] text-gray-400 select-none">
                    {xLabels.map((lbl, idx) => (
                      <span key={idx}>{lbl}</span>
                    ))}
                  </div>

                  {/* Footer Meta: End Date + Polymarket */}
                  <div className="flex items-center justify-end gap-2 mt-3 text-xs text-gray-400">
                    <span>{formatEndDate(activeEvent.endDate)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-semibold">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5 stroke-current fill-none"
                        strokeWidth="1.8"
                      >
                        <path d="M5 4v16l7-4V8L5 4zm7 4l7-4v16l-7-4V8z" />
                      </svg>
                      Promarket
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Carousel Pagination & Prev/Next Event Pills */}
          {slides.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === activeIndex
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/25 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>

              {/* Prev / Next Event Pills */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveIndex(prevIndex)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#171b22] border border-white/[0.08] text-xs font-medium text-gray-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="w-3 h-3 stroke-current fill-none"
                    strokeWidth="1.8"
                  >
                    <path d="M10 3L5 8l5 5" strokeLinecap="round" />
                  </svg>
                  <span className="truncate max-w-[140px]">
                    {shortPillTitle(slides[prevIndex]?.title)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveIndex(nextIndex)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#171b22] border border-white/[0.08] text-xs font-medium text-gray-300 hover:text-white hover:border-white/20 transition-colors"
                >
                  <span className="truncate max-w-[140px]">
                    {shortPillTitle(slides[nextIndex]?.title)}
                  </span>
                  <svg
                    viewBox="0 0 16 16"
                    className="w-3 h-3 stroke-current fill-none"
                    strokeWidth="1.8"
                  >
                    <path d="M6 3l5 5-5 5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: PROMOS + DYNAMIC HOT TOPICS ================= */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* Promo Card 1: First Deposit Bonus Spin Offer */}
          <div
            onClick={() => (onOpenRewards ? onOpenRewards() : onExploreAll?.())}
            className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#1b1811] via-[#141821] to-[#101818] p-5 cursor-pointer hover:border-amber-400/60 transition-all group"
          >
            {/* Ambient Gold / Emerald Glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 82% 75%, rgba(251, 191, 36, 0.22) 0%, rgba(16, 185, 129, 0.08) 40%, transparent 72%)",
              }}
            />

            {/* Decorative Mini Spin Wheel */}
            <div className="absolute -right-5 -bottom-6 w-28 h-28 pointer-events-none opacity-85 group-hover:rotate-45 transition-transform duration-700">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full drop-shadow-lg"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="#0b0e14"
                  stroke="#fbbf24"
                  strokeWidth="3"
                />
                <path d="M50 50 L50 6 A44 44 0 0 1 81 19 Z" fill="#14532d" />
                <path d="M50 50 L81 19 A44 44 0 0 1 94 50 Z" fill="#1e293b" />
                <path d="M50 50 L94 50 A44 44 0 0 1 81 81 Z" fill="#f59e0b" />
                <path d="M50 50 L81 81 A44 44 0 0 1 50 94 Z" fill="#1f2430" />
                <path d="M50 50 L50 94 A44 44 0 0 1 19 81 Z" fill="#047857" />
                <path d="M50 50 L19 81 A44 44 0 0 1 6 50 Z" fill="#1e293b" />
                <path d="M50 50 L6 50 A44 44 0 0 1 19 19 Z" fill="#312e81" />
                <path d="M50 50 L19 19 A44 44 0 0 1 50 6 Z" fill="#1f2430" />
                <circle
                  cx="50"
                  cy="50"
                  r="13"
                  fill="#0b0e14"
                  stroke="#fbbf24"
                  strokeWidth="2.5"
                />
                <text
                  x="50"
                  y="51"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fbbf24"
                  fontSize="10"
                  fontWeight="900"
                >
                  ₿
                </text>
              </svg>
            </div>

            <div className="relative z-10 pr-16">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="inline-block text-[10px] font-extrabold tracking-wider uppercase bg-amber-500/20 border border-amber-400/35 text-amber-300 px-2 py-0.5 rounded">
                  NOV 1 – JAN 1
                </span>
                <span className="inline-block text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded">
                  First Deposit Bonus
                </span>
              </div>

              <h3 className="text-[17px] font-bold text-white leading-snug">
                Spin &amp; Win up to{" "}
                <span className="text-amber-400">$2,500 in BTC</span>
              </h3>
              <p className="text-[13px] font-semibold text-emerald-400 mt-1 flex items-center gap-1">
                <span>Deposit to unlock your spin</span>
                <span className="group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </p>
            </div>
          </div>

          {/* Promo Card 2 */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 cursor-pointer hover:border-white/20 transition-colors">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 18% 10%, rgba(124, 58, 237, 0.25) 0%, transparent 55%)",
              }}
            />
            <svg
              viewBox="0 0 360 80"
              className="absolute inset-x-0 top-6 w-full opacity-30 pointer-events-none"
              fill="none"
            >
              <path d="M0 10 Q180 35 360 15" stroke="#8b5cf6" strokeWidth="1" />
            </svg>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow">
                  <div className="grid grid-cols-2 gap-[2px]">
                    <span className="w-1.5 h-1.5 bg-white/90 rounded-[1px]" />
                    <span className="w-1.5 h-1.5 bg-white/50 rounded-[1px]" />
                    <span className="w-1.5 h-1.5 bg-white/50 rounded-[1px]" />
                    <span className="w-1.5 h-1.5 bg-white/90 rounded-[1px]" />
                  </div>
                </div>
                <h3 className="text-[16px] font-bold text-white">
                  Build a combo
                </h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[260px]">
                Combine multiple predictions in a combo to win big
              </p>
            </div>
          </div>

          {/* Dynamic Hot Topics */}
          <div className="pt-1">
            <button
              type="button"
              onClick={onExploreAll}
              className="flex items-center gap-1.5 text-[16px] font-bold text-white mb-2.5 hover:text-gray-200 transition-colors"
            >
              <span>Hot topics</span>
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 stroke-gray-400 fill-none"
                strokeWidth="2"
              >
                <path d="M6 3l5 5-5 5" strokeLinecap="round" />
              </svg>
            </button>

            <div className="space-y-0.5">
              {hotTopics.map((topic) => (
                <button
                  key={topic.rank}
                  type="button"
                  onClick={() =>
                    topic.topEvent && onSelectEvent?.(topic.topEvent)
                  }
                  className="w-full flex items-center justify-between py-2 px-1 rounded-lg hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-medium text-gray-500 w-3 text-left tabular-nums">
                      {topic.rank}
                    </span>
                    <span className="text-[13px] font-bold text-white truncate">
                      {topic.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-gray-400 tabular-nums">
                      {formatCompactVol(topic.volume)} today
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      className="w-3.5 h-3.5 fill-[#ef4444]"
                    >
                      <path d="M11.6 2.2c.4 2.1-.6 3.7-1.9 4.9-1 1-1.7 2-1.5 3.3.1.9.7 1.6 1.5 1.8.9.2 1.8-.3 2.2-1.2.3-.7.2-1.5 0-2.2 1.8 1.2 3.1 3.3 3.1 5.6 0 3.1-2.4 5.6-5.5 5.6S4 17.5 4 14.4c0-2.5 1.3-4.6 3.1-6.5 1.5-1.5 3-3.1 4.5-5.7z" />
                    </svg>
                    <svg
                      viewBox="0 0 16 16"
                      className="w-3 h-3 stroke-gray-500 group-hover:stroke-gray-300 fill-none transition-colors"
                      strokeWidth="1.8"
                    >
                      <path d="M6 3l5 5-5 5" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onExploreAll}
              className="w-full mt-3.5 py-2.5 rounded-full bg-[#13161c] border border-white/[0.08] text-xs font-semibold text-white hover:bg-white/[0.06] hover:border-white/20 transition-colors"
            >
              Explore all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
