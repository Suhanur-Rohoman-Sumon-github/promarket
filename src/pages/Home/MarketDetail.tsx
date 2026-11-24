/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo, useRef } from "react";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const WS_MARKET_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

const LINE_COLORS = ["#60a5fa", "#2563eb", "#eab308", "#f97316"] as const;

const TIMEFRAMES = [
  { label: "1H", interval: "1h", fidelity: 1 },
  { label: "6H", interval: "6h", fidelity: 5 },
  { label: "1D", interval: "1d", fidelity: 15 },
  { label: "1W", interval: "1w", fidelity: 60 },
  { label: "1M", interval: "1m", fidelity: 180 },
  { label: "ALL", interval: "max", fidelity: 720 },
] as const;

const AUTH_STORAGE_KEY = "promarkets_demo_user";
const POSITIONS_STORAGE_KEY = "pm_realtime_positions_v1";

// ---------- Types ----------
interface DemoUser {
  username?: string;
  email?: string;
  password?: string;
  portfolio?: string;
  cash?: string | number;
}

export interface MarketTag {
  id?: string;
  label?: string;
  slug?: string;
}

export interface MarketSubMarket {
  id: string;
  question?: string;
  groupItemTitle?: string;
  outcomes?: string[] | string;
  outcomePrices?: string[] | string;
  clobTokenIds?: string[] | string;
  positionIds?: string[] | string;
  active?: boolean;
  closed?: boolean;
  volume?: number | string;
  volumeNum?: number | string;
  image?: string;
  icon?: string;
}

export interface MarketEvent {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  endDate?: string;
  volume?: number | string;
  volume24hr?: number | string;
  tags?: MarketTag[];
  markets?: MarketSubMarket[];
}

export interface MarketDetailPageProps {
  event?: MarketEvent | null;
  initialMarketId?: string | null;
  initialSide?: string;
  onBack?: () => void;
  onSelectEvent?: (event: MarketEvent) => void;
}

interface OutcomeRow {
  id: string;
  name: string;
  yesLabel: string;
  noLabel: string;
  yesProb: number;
  noProb: number;
  pct: number;
  volume: number;
  image?: string;
  yesTokenId: string | null;
  noTokenId: string | null;
  closed: boolean;
  color: string;
  delta: number;
}

interface PricePoint {
  t: number;
  p: number;
}

interface LiveQuote {
  bid: number;
  ask: number;
  mid: number;
}

interface PositionItem {
  key: string;
  userId: string;
  tokenId: string;
  eventId: string;
  marketId: string;
  marketName: string;
  side: string;
  shares: number;
  cost: number;
}

interface WsMessage {
  event_type?: string;
  asset_id?: string;
  best_bid?: string;
  best_ask?: string;
  price?: string;
  winning_asset_id?: string;
  price_changes?: Array<{
    asset_id: string;
    price?: string;
    best_bid?: string;
    best_ask?: string;
  }>;
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

function parseCashNumber(val: unknown): number {
  if (typeof val === "number")
    return Number.isFinite(val) ? Math.max(0, val) : 0;
  const cleaned = String(val ?? "0").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function formatCashString(amount: number): string {
  return `$${Math.max(0, amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readAuthIdentity(): {
  loggedIn: boolean;
  userId: string;
} {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { loggedIn: false, userId: "guest" };
    const user = JSON.parse(raw) as DemoUser;
    const email = String(user.email || "")
      .toLowerCase()
      .trim();
    return email
      ? { loggedIn: true, userId: email }
      : { loggedIn: false, userId: "guest" };
  } catch {
    return { loggedIn: false, userId: "guest" };
  }
}

async function syncBackendCash(email: string, nextCash: number): Promise<void> {
  if (!email || email === "guest") return;
  try {
    await fetch(`${API_BASE}/users/cash`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, cash: nextCash }),
    });
    window.dispatchEvent(new Event("promarkets-auth-change"));
  } catch {
    // ignore transient network errors
  }
}

function readStoredPositions(): Record<string, PositionItem> {
  try {
    const raw = localStorage.getItem(POSITIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PositionItem>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDollarVol(vol: number | string | undefined): string {
  const num = Number(vol) || 0;
  return `$${Math.round(num).toLocaleString("en-US")} Vol.`;
}

function formatCents(prob: number): string {
  const cents = Math.round((Number(prob) || 0) * 1000) / 10;
  return `${Number.isInteger(cents) ? cents : cents.toFixed(1)}¢`;
}

function formatDateShort(iso?: string): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAxisTime(unixSec: number, interval: string): string {
  const d = new Date(unixSec * 1000);
  if (interval === "1h" || interval === "6h" || interval === "1d") {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildFallbackSeries(
  endProb: number,
  count = 40,
  seed = 1,
): PricePoint[] {
  const now = Math.floor(Date.now() / 1000);
  const step = 6 * 3600;
  const arr: PricePoint[] = [];
  const val = Math.min(0.95, Math.max(0.05, endProb + ((seed % 3) - 1) * 0.08));
  for (let i = 0; i < count; i++) {
    const t = now - (count - 1 - i) * step;
    const wave = Math.sin((i + seed * 3) * 0.45) * 0.035;
    const progress = i / (count - 1);
    const p =
      i === count - 1
        ? endProb
        : Math.max(
            0.01,
            Math.min(0.99, val * (1 - progress) + endProb * progress + wave),
          );
    arr.push({ t, p });
  }
  return arr;
}

async function fetchClobHistoryWithFallback(
  tokenId: string,
  interval: string,
  fidelity: number,
  signal?: AbortSignal,
): Promise<PricePoint[] | null> {
  const attempts =
    interval === "max"
      ? [
          { interval: "max", fidelity },
          { interval: "max", fidelity: 60 },
          { interval: "1d", fidelity: 15 },
        ]
      : [{ interval, fidelity }];

  for (const attempt of attempts) {
    try {
      const url = `${CLOB_API}/prices-history?market=${encodeURIComponent(
        tokenId,
      )}&interval=${attempt.interval}&fidelity=${attempt.fidelity}`;
      const res = await fetch(url, { signal });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        history?: Array<{ t: number | string; p: number | string }>;
      };
      const hist = Array.isArray(json.history) ? json.history : [];
      if (hist.length >= 2) {
        return hist.map((pt) => ({
          t: Number(pt.t),
          p: Number(pt.p),
        }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  return null;
}

export default function MarketDetailPage({
  event,
  initialMarketId = null,
  initialSide = "Yes",
  onBack,
  onSelectEvent,
}: MarketDetailPageProps) {
  const [timeframe, setTimeframe] = useState<string>("1D");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [seriesMap, setSeriesMap] = useState<Record<string, PricePoint[]>>({});
  const [tradeTab, setTradeTab] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState<string>("");
  const [orderNotice, setOrderNotice] = useState<string>("");
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [relatedEvents, setRelatedEvents] = useState<MarketEvent[]>([]);
  const [relatedFilter, setRelatedFilter] = useState<string>("All");

  // Synced user identity + backend cash + positions + position modal
  const [authState, setAuthState] = useState(() => readAuthIdentity());
  const [cash, setCash] = useState<number>(0);
  const [loadingCash, setLoadingCash] = useState<boolean>(false);
  const cashRef = useRef<number>(0);
  useEffect(() => {
    cashRef.current = cash;
  }, [cash]);

  const [livePrices, setLivePrices] = useState<Record<string, LiveQuote>>({});
  const [resolvedMap, setResolvedMap] = useState<Record<string, 0 | 1>>({});
  const [positions, setPositions] = useState<Record<string, PositionItem>>(() =>
    readStoredPositions(),
  );
  const [modalPosKey, setModalPosKey] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const isLoggedIn = authState.loggedIn;
  const userId = authState.userId;

  const fetchUserCash = async (email: string) => {
    if (!email || email === "guest") {
      setCash(0);
      cashRef.current = 0;
      return;
    }
    setLoadingCash(true);
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        success?: boolean;
        data?: { cash?: number };
      };
      if (json.success && json.data) {
        const backendCash = parseCashNumber(json.data.cash);
        setCash(backendCash);
        cashRef.current = backendCash;
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingCash(false);
    }
  };

  // Load cash from backend & listen for auth/balance changes
  useEffect(() => {
    void fetchUserCash(userId);

    const syncAuth = () => {
      const next = readAuthIdentity();
      setAuthState(next);
      setPositions(readStoredPositions());
      void fetchUserCash(next.userId);
    };

    window.addEventListener("promarkets-auth-change", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("promarkets-auth-change", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, [userId]);

  // Parse active sub-markets sorted by highest Yes probability
  const outcomesList = useMemo<OutcomeRow[]>(() => {
    if (!event) return [];
    const raw = (event.markets || []).filter((m) => m.active !== false);
    const list = (raw.length > 0 ? raw : event.markets || []).map((m, idx) => {
      const prices = safeParseArray<string>(m.outcomePrices, ["0.5", "0.5"]);
      const outcomes = safeParseArray<string>(m.outcomes, ["Yes", "No"]);
      const clobTokens = safeParseArray<string>(m.clobTokenIds, []);
      const posTokens = safeParseArray<string>(m.positionIds, []);
      const tokens = clobTokens.length > 0 ? clobTokens : posTokens;

      const yesProb = parseFloat(prices[0]) || 0;
      const noProb = parseFloat(prices[1]) || Math.max(0, 1 - yesProb);

      return {
        id: m.id || `m-${idx}`,
        name:
          m.groupItemTitle || m.question || outcomes[0] || `Option ${idx + 1}`,
        yesLabel: outcomes[0] || "Yes",
        noLabel: outcomes[1] || "No",
        yesProb,
        noProb,
        pct: Math.round(yesProb * 100),
        volume: Number(m.volume || m.volumeNum || 0),
        image: m.image || m.icon || event.icon || event.image,
        yesTokenId: tokens[0] || null,
        noTokenId: tokens[1] || null,
        closed: Boolean(m.closed),
        color: LINE_COLORS[idx % LINE_COLORS.length],
        delta: (idx % 2 === 0 ? 1 : -1) * ((idx % 3) + 1),
      };
    });

    return list.sort((a, b) => b.yesProb - a.yesProb);
  }, [event]);

  const topChartOutcomes = useMemo(
    () => outcomesList.slice(0, 4),
    [outcomesList],
  );
  const topChartRef = useRef<OutcomeRow[]>(topChartOutcomes);
  useEffect(() => {
    topChartRef.current = topChartOutcomes;
  }, [topChartOutcomes]);

  // Selected outcome & side in Right Trade Card
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>(
    () => initialMarketId || topChartOutcomes[0]?.id || "",
  );
  const [selectedSide, setSelectedSide] = useState<string>(
    initialSide || "Yes",
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOutcomeId(initialMarketId || outcomesList[0]?.id || "");
    setSelectedSide(initialSide || "Yes");
    setAmount("");
    setOrderNotice("");
  }, [event?.id, initialMarketId, initialSide, outcomesList]);

  const activeOutcome =
    outcomesList.find((o) => o.id === selectedOutcomeId) || outcomesList[0];

  // 1. Live WebSocket for Real-Time Prices + Dynamic Chart Point Updates + Resolution
  useEffect(() => {
    const assetIds = outcomesList
      .flatMap((o) => [o.yesTokenId, o.noTokenId])
      .filter((id): id is string => Boolean(id));

    if (assetIds.length === 0) return;

    let ws: WebSocket | null = null;
    let pingTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let closedByCleanup = false;

    const pushLiveChartTick = (assetId: string, price: number) => {
      const chartList = topChartRef.current;
      const matchedYes = chartList.find((o) => o.yesTokenId === assetId);
      const matchedNo = chartList.find((o) => o.noTokenId === assetId);
      const target = matchedYes || matchedNo;
      if (!target) return;

      const yesP = matchedYes
        ? price
        : Math.max(0.005, Math.min(0.995, 1 - price));
      const nowSec = Math.floor(Date.now() / 1000);

      setSeriesMap((prev) => {
        const existing = prev[target.id];
        if (!existing || existing.length === 0) return prev;
        const last = existing[existing.length - 1];
        const nextSeries =
          nowSec - last.t >= 15
            ? [...existing.slice(-119), { t: nowSec, p: yesP }]
            : [...existing.slice(0, -1), { t: nowSec, p: yesP }];
        return { ...prev, [target.id]: nextSeries };
      });
    };

    const connect = () => {
      ws = new WebSocket(WS_MARKET_URL);

      ws.onopen = () => {
        setWsConnected(true);
        ws?.send(
          JSON.stringify({
            assets_ids: assetIds,
            type: "market",
            custom_feature_enabled: true,
          }),
        );
        pingTimer = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send("PING");
          }
        }, 10_000);
      };

      ws.onmessage = (evt: MessageEvent<string>) => {
        if (evt.data === "PONG") return;
        let msgs: WsMessage[];
        try {
          const parsed: unknown = JSON.parse(evt.data);
          msgs = Array.isArray(parsed)
            ? (parsed as WsMessage[])
            : [parsed as WsMessage];
        } catch {
          return;
        }

        msgs.forEach((msg) => {
          if (msg.event_type === "best_bid_ask" && msg.asset_id) {
            const bid = parseFloat(msg.best_bid || "0") || 0;
            const ask = parseFloat(msg.best_ask || "0") || 0;
            const mid = bid && ask ? (bid + ask) / 2 : ask || bid;
            const assetId = msg.asset_id;
            if (mid > 0) {
              setLivePrices((prev) => ({
                ...prev,
                [assetId]: { bid: bid || mid, ask: ask || mid, mid },
              }));
              pushLiveChartTick(assetId, mid);
            }
          }

          if (
            msg.event_type === "price_change" &&
            Array.isArray(msg.price_changes)
          ) {
            setLivePrices((prev) => {
              const next = { ...prev };
              msg.price_changes?.forEach((c) => {
                const p = parseFloat(c.price || "0") || 0;
                const bid =
                  parseFloat(c.best_bid || "0") || prev[c.asset_id]?.bid || p;
                const ask =
                  parseFloat(c.best_ask || "0") || prev[c.asset_id]?.ask || p;
                const mid = bid && ask ? (bid + ask) / 2 : p;
                if (mid > 0) {
                  next[c.asset_id] = {
                    bid: bid || mid,
                    ask: ask || mid,
                    mid,
                  };
                  pushLiveChartTick(c.asset_id, mid);
                }
              });
              return next;
            });
          }

          if (msg.event_type === "last_trade_price" && msg.asset_id) {
            const p = parseFloat(msg.price || "0") || 0;
            const assetId = msg.asset_id;
            if (p > 0) {
              setLivePrices((prev) => ({
                ...prev,
                [assetId]: {
                  bid: prev[assetId]?.bid || p,
                  ask: prev[assetId]?.ask || p,
                  mid: p,
                },
              }));
              pushLiveChartTick(assetId, p);
            }
          }

          if (msg.event_type === "market_resolved" && msg.winning_asset_id) {
            const winId = msg.winning_asset_id;
            const matched = outcomesList.find(
              (o) => o.yesTokenId === winId || o.noTokenId === winId,
            );
            setResolvedMap((prev) => {
              const next: Record<string, 0 | 1> = { ...prev, [winId]: 1 };
              if (matched) {
                if (matched.yesTokenId && matched.yesTokenId !== winId) {
                  next[matched.yesTokenId] = 0;
                }
                if (matched.noTokenId && matched.noTokenId !== winId) {
                  next[matched.noTokenId] = 0;
                }
              }
              return next;
            });
          }
        });
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) window.clearInterval(pingTimer);
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();
    return () => {
      closedByCleanup = true;
      setWsConnected(false);
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [outcomesList]);

  // 2. Poll Gamma Every 10s as Backup for Live Prices & Market Resolution Results
  useEffect(() => {
    if (!event?.slug) return;
    let cancelled = false;

    const checkResult = async () => {
      try {
        const res = await fetch(
          `${GAMMA_API}/events/slug/${encodeURIComponent(event.slug!)}`,
        );
        if (!res.ok) return;
        const ev = (await res.json()) as MarketEvent;
        if (cancelled) return;

        (ev.markets || []).forEach((m) => {
          const prices = safeParseArray<string>(m.outcomePrices, []);
          const clobTokens = safeParseArray<string>(m.clobTokenIds, []);
          const posTokens = safeParseArray<string>(m.positionIds, []);
          const tokens = clobTokens.length > 0 ? clobTokens : posTokens;

          const p0 = parseFloat(prices[0]);
          const p1 = parseFloat(prices[1]);

          if (m.closed && ((p0 === 1 && p1 === 0) || (p0 === 0 && p1 === 1))) {
            setResolvedMap((prev) => ({
              ...prev,
              ...(tokens[0] ? { [tokens[0]]: p0 as 0 | 1 } : {}),
              ...(tokens[1] ? { [tokens[1]]: p1 as 0 | 1 } : {}),
            }));
          } else {
            if (tokens[0] && Number.isFinite(p0) && p0 > 0) {
              setLivePrices((prev) =>
                prev[tokens[0]]
                  ? prev
                  : { ...prev, [tokens[0]]: { bid: p0, ask: p0, mid: p0 } },
              );
            }
            if (tokens[1] && Number.isFinite(p1) && p1 > 0) {
              setLivePrices((prev) =>
                prev[tokens[1]]
                  ? prev
                  : { ...prev, [tokens[1]]: { bid: p1, ask: p1, mid: p1 } },
              );
            }
          }
        });
      } catch {
        // ignore transient network errors
      }
    };

    checkResult();
    const id = window.setInterval(checkResult, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [event?.slug]);

  // 3. Auto-Settle User's Open Positions & Sync Payout to Backend Cash
  useEffect(() => {
    if (!isLoggedIn) return;
    const entries = Object.entries(positions);
    if (entries.length === 0) return;

    let payoutTotal = 0;
    let changed = false;
    const nextPositions: Record<string, PositionItem> = { ...positions };

    entries.forEach(([key, pos]) => {
      if (pos.userId !== userId) return;
      const result = resolvedMap[pos.tokenId];
      if (result === 1 || result === 0) {
        payoutTotal += pos.shares * result;
        delete nextPositions[key];
        changed = true;
      }
    });

    if (changed) {
      const updatedCash = Number((cashRef.current + payoutTotal).toFixed(2));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCash(updatedCash);
      cashRef.current = updatedCash;
      setPositions(nextPositions);
      try {
        localStorage.setItem(
          POSITIONS_STORAGE_KEY,
          JSON.stringify(nextPositions),
        );
      } catch {
        // ignore storage error
      }
      void syncBackendCash(userId, updatedCash);
      setOrderNotice(
        payoutTotal > 0
          ? `Market resolved! Settled +$${payoutTotal.toFixed(2)} payout to your cash.`
          : "Market resolved. Position settled at $0.00.",
      );
    }
  }, [resolvedMap, positions, isLoggedIn, userId]);

  // 4. Fetch & Auto-Refresh CLOB Price History for Top 4 Lines
  useEffect(() => {
    if (topChartOutcomes.length === 0) return;
    const controller = new AbortController();
    const tf = TIMEFRAMES.find((t) => t.label === timeframe) || TIMEFRAMES[2];

    async function loadHistory() {
      try {
        const entries: Array<[string, PricePoint[]]> = await Promise.all(
          topChartOutcomes.map(
            async (item, idx): Promise<[string, PricePoint[]]> => {
              if (!item.yesTokenId) {
                return [
                  item.id,
                  buildFallbackSeries(item.yesProb, 44, idx + 1),
                ];
              }
              const fetched = await fetchClobHistoryWithFallback(
                item.yesTokenId,
                tf.interval,
                tf.fidelity,
                controller.signal,
              );
              if (fetched && fetched.length >= 2) {
                return [item.id, fetched];
              }
              return [item.id, buildFallbackSeries(item.yesProb, 44, idx + 1)];
            },
          ),
        );

        if (!controller.signal.aborted) {
          setSeriesMap(Object.fromEntries(entries));
        }
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("Chart history error:", err);
        }
      }
    }

    loadHistory();

    const isShortTf =
      timeframe === "1H" || timeframe === "6H" || timeframe === "1D";
    const refreshId = isShortTf
      ? window.setInterval(loadHistory, 30_000)
      : undefined;

    return () => {
      controller.abort();
      if (refreshId) window.clearInterval(refreshId);
    };
  }, [topChartOutcomes, timeframe]);

  // 5. Fetch related markets from Polymarket
  useEffect(() => {
    if (!event?.id) return;
    let cancelled = false;
    const tagSlug =
      relatedFilter !== "All" ? relatedFilter : event.tags?.[0]?.slug || "tech";

    fetch(
      `${GAMMA_API}/events?active=true&closed=false&tag_slug=${encodeURIComponent(
        tagSlug,
      )}&limit=6&order=volume_24hr&ascending=false`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        setRelatedEvents(
          (data as MarketEvent[]).filter((e) => e.id !== event.id).slice(0, 4),
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [event, relatedFilter]);

  // Dynamic Chart Geometry Calculations
  const chartW = 720;
  const chartH = 250;

  const { minY, maxY, ticksY, baseTimeline } = useMemo(() => {
    let minVal = 1;
    let maxVal = 0;
    let longestSeries: PricePoint[] = [];

    topChartOutcomes.forEach((o) => {
      const s = seriesMap[o.id] || [];
      if (s.length > longestSeries.length) longestSeries = s;
      s.forEach((pt) => {
        if (pt.p < minVal) minVal = pt.p;
        if (pt.p > maxVal) maxVal = pt.p;
      });
    });

    if (longestSeries.length === 0 || minVal > maxVal) {
      minVal = 0;
      maxVal = 1;
    }

    const span = maxVal - minVal;
    const pad = Math.max(0.03, span * 0.15);
    const rawMinPct = Math.max(0, Math.floor(((minVal - pad) * 100) / 5) * 5);
    const rawMaxPct = Math.min(100, Math.ceil(((maxVal + pad) * 100) / 5) * 5);

    const finalMinPct =
      rawMaxPct - rawMinPct < 15 ? Math.max(0, rawMaxPct - 20) : rawMinPct;
    const finalMaxPct =
      rawMaxPct - finalMinPct < 15
        ? Math.min(100, finalMinPct + 20)
        : rawMaxPct;

    const totalRange = finalMaxPct - finalMinPct;
    const step = totalRange <= 25 ? 5 : totalRange <= 50 ? 10 : 20;
    const ticks: number[] = [];
    for (let v = finalMaxPct; v >= finalMinPct; v -= step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== finalMinPct) {
      ticks.push(finalMinPct);
    }

    return {
      minY: finalMinPct / 100,
      maxY: finalMaxPct / 100,
      ticksY: ticks,
      baseTimeline: longestSeries,
    };
  }, [topChartOutcomes, seriesMap]);

  const ySpan = Math.max(0.01, maxY - minY);
  const toChartY = (prob: number): number =>
    Math.max(
      3,
      Math.min(chartH - 3, chartH - ((prob - minY) / ySpan) * chartH),
    );

  const xTicks = useMemo(() => {
    if (baseTimeline.length < 4) return [];
    const indices = [0, 0.33, 0.66, 0.92].map((r) =>
      Math.min(baseTimeline.length - 1, Math.floor(r * baseTimeline.length)),
    );
    const tf = TIMEFRAMES.find((t) => t.label === timeframe) || TIMEFRAMES[2];
    return indices.map((i) => ({
      x: (i / Math.max(1, baseTimeline.length - 1)) * chartW,
      label: formatAxisTime(baseTimeline[i].t, tf.interval),
    }));
  }, [baseTimeline, timeframe]);

  const relatedTags = useMemo(() => {
    const tags = (event?.tags || [])
      .filter((t): t is { label: string; slug: string } =>
        Boolean(t?.label && t?.slug),
      )
      .slice(0, 4)
      .map((t) => ({ label: t.label, slug: t.slug }));
    return [{ label: "All", slug: "All" }, ...tags];
  }, [event]);

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0d1016] text-white flex flex-col items-center justify-center p-6">
        <p className="text-gray-400 text-sm mb-3">No market event selected.</p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold"
          >
            Back to Markets
          </button>
        )}
      </div>
    );
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (baseTimeline.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const idx = Math.round(ratio * (baseTimeline.length - 1));
    setHoverIdx(idx);
  };

  // Live Helper for Outcome Display & Trade Execution
  const getLiveOutcomeProb = (o: OutcomeRow, side: "yes" | "no"): number => {
    const token = side === "yes" ? o.yesTokenId : o.noTokenId;
    if (token && resolvedMap[token] !== undefined) {
      return resolvedMap[token];
    }
    if (token && livePrices[token]) {
      return livePrices[token].mid;
    }
    return side === "yes" ? o.yesProb : o.noProb;
  };

  const getPositionLivePrice = (pos: PositionItem): number => {
    const o = outcomesList.find((x) => x.id === pos.marketId);
    const isYes = pos.side === (o?.yesLabel || "Yes");
    if (pos.tokenId && resolvedMap[pos.tokenId] !== undefined) {
      return resolvedMap[pos.tokenId];
    }
    if (pos.tokenId && livePrices[pos.tokenId]?.bid) {
      return livePrices[pos.tokenId].bid;
    }
    return o ? getLiveOutcomeProb(o, isYes ? "yes" : "no") : 0.5;
  };

  const yesToken = activeOutcome?.yesTokenId ?? null;
  const noToken = activeOutcome?.noTokenId ?? null;

  const liveYesPrice =
    yesToken && resolvedMap[yesToken] !== undefined
      ? resolvedMap[yesToken]
      : (yesToken &&
          (tradeTab === "Buy"
            ? livePrices[yesToken]?.ask
            : livePrices[yesToken]?.bid)) ||
        activeOutcome?.yesProb ||
        0.5;

  const liveNoPrice =
    noToken && resolvedMap[noToken] !== undefined
      ? resolvedMap[noToken]
      : (noToken &&
          (tradeTab === "Buy"
            ? livePrices[noToken]?.ask
            : livePrices[noToken]?.bid)) ||
        activeOutcome?.noProb ||
        0.5;

  const isYesSelected = selectedSide === (activeOutcome?.yesLabel || "Yes");
  const activeTokenId = isYesSelected ? yesToken : noToken;
  const activePrice = isYesSelected ? liveYesPrice : liveNoPrice;

  const resolutionStatus =
    (yesToken && resolvedMap[yesToken] !== undefined) ||
    (noToken && resolvedMap[noToken] !== undefined)
      ? resolvedMap[yesToken ?? ""] === 1
        ? activeOutcome?.yesLabel || "Yes"
        : activeOutcome?.noLabel || "No"
      : null;

  const isMarketResolved = Boolean(resolutionStatus || activeOutcome?.closed);
  const posKey = `${userId}:${activeOutcome?.id || "none"}:${selectedSide}`;
  const currentPos = positions[posKey];
  const currentPosValue = currentPos ? currentPos.shares * activePrice : 0;

  const numAmount = parseFloat(amount) || 0;
  const estShares = activePrice > 0 ? numAmount / activePrice : 0;

  const persistPortfolio = (
    nextCash: number,
    nextPositions: Record<string, PositionItem>,
  ) => {
    setCash(nextCash);
    cashRef.current = nextCash;
    setPositions(nextPositions);
    try {
      localStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify(nextPositions),
      );
    } catch {
      // ignore storage errors
    }
    void syncBackendCash(userId, nextCash);
  };

  const handleClosePosition = (pos: PositionItem) => {
    if (!isLoggedIn) {
      setOrderNotice("Please log in to close a position.");
      setModalPosKey(null);
      return;
    }
    const closePrice = getPositionLivePrice(pos);
    const proceeds = Number((pos.shares * closePrice).toFixed(2));
    const nextPos: Record<string, PositionItem> = { ...positions };
    delete nextPos[pos.key];

    const nextCash = Number((cashRef.current + proceeds).toFixed(2));
    persistPortfolio(nextCash, nextPos);
    setModalPosKey(null);
    setOrderNotice(
      `Closed ${pos.shares.toFixed(2)} ${pos.side} shares — +$${proceeds.toFixed(
        2,
      )} added to cash.`,
    );
  };

  const handleExecuteTrade = () => {
    if (!isLoggedIn) {
      setOrderNotice("Please log in to place a trade.");
      return;
    }
    if (loadingCash) return;
    if (!activeOutcome) return;
    if (isMarketResolved) {
      setOrderNotice("Trading closed — this market has already resolved.");
      return;
    }
    if (tradeTab === "Buy" && cash <= 0) {
      window.dispatchEvent(new Event("open-deposit-modal"));
      return;
    }
    if (numAmount <= 0) {
      setOrderNotice("Enter an amount greater than $0.");
      return;
    }
    if (activePrice <= 0) {
      setOrderNotice("Price unavailable for this side.");
      return;
    }

    if (tradeTab === "Buy") {
      if (numAmount > cash) {
        setOrderNotice("Insufficient cash balance. Please deposit funds.");
        return;
      }
      const sharesBought = numAmount / activePrice;
      const nextCash = Number((cash - numAmount).toFixed(2));
      const existing = positions[posKey];
      const nextPos: Record<string, PositionItem> = {
        ...positions,
        [posKey]: {
          key: posKey,
          userId,
          tokenId: activeTokenId || posKey,
          eventId: event.id,
          marketId: activeOutcome.id,
          marketName: activeOutcome.name,
          side: selectedSide,
          shares: (existing?.shares || 0) + sharesBought,
          cost: (existing?.cost || 0) + numAmount,
        },
      };
      persistPortfolio(nextCash, nextPos);
      setAmount("");
      setOrderNotice(
        `Bought ${sharesBought.toFixed(2)} ${selectedSide} shares @ ${formatCents(
          activePrice,
        )} (Wins $${sharesBought.toFixed(2)} if ${selectedSide} wins)`,
      );
    } else {
      if (!currentPos || currentPos.shares <= 0) {
        setOrderNotice(`You do not own any ${selectedSide} shares to sell.`);
        return;
      }
      const maxUsd = currentPos.shares * activePrice;
      if (numAmount > maxUsd + 0.01) {
        setOrderNotice(`Max sellable value is $${maxUsd.toFixed(2)}.`);
        return;
      }
      const sharesToSell = Math.min(currentPos.shares, numAmount / activePrice);
      const proceeds = sharesToSell * activePrice;
      const remainingShares = currentPos.shares - sharesToSell;
      const nextPos: Record<string, PositionItem> = { ...positions };

      if (remainingShares <= 0.0001) {
        delete nextPos[posKey];
      } else {
        nextPos[posKey] = {
          ...currentPos,
          shares: remainingShares,
          cost: currentPos.cost * (remainingShares / currentPos.shares),
        };
      }

      const nextCash = Number((cash + proceeds).toFixed(2));
      persistPortfolio(nextCash, nextPos);
      setAmount("");
      setOrderNotice(
        `Sold ${sharesToSell.toFixed(2)} ${selectedSide} shares for +$${proceeds.toFixed(
          2,
        )}`,
      );
    }
  };

  const eventPositions = Object.values(positions).filter(
    (p) => p.eventId === event.id && p.userId === userId,
  );

  const modalPosition = modalPosKey ? (positions[modalPosKey] ?? null) : null;
  const modalLivePrice = modalPosition
    ? getPositionLivePrice(modalPosition)
    : 0;
  const modalValue = modalPosition ? modalPosition.shares * modalLivePrice : 0;
  const modalPnl = modalPosition ? modalValue - modalPosition.cost : 0;

  const highlightedOutcomeId = activeOutcome?.id || topChartOutcomes[0]?.id;

  const breadcrumb =
    (event.tags || [])
      .slice(0, 2)
      .map((t) => t.label)
      .join(" · ") || "Markets";

  return (
    <div className="min-h-screen bg-[#0d1016] text-white font-sans antialiased py-5 px-4 md:px-6">
      <div className="max-w-[1260px] mx-auto">
        {/* Top Bar: Back + Live Stream Indicator */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5 stroke-current fill-none"
              strokeWidth="2"
            >
              <path
                d="M10 3L5 8l5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Markets
          </button>

          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span className="text-gray-400">
              {wsConnected ? "Live Orderbook Feed" : "Connecting Live Feed..."}
            </span>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* ================= LEFT COLUMN (Header + Chart + Rows) ================= */}
          <div className="lg:col-span-8">
            {/* Title Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {(event.icon || event.image) && (
                  <img
                    src={event.icon || event.image}
                    alt={event.title}
                    className="w-12 h-12 rounded-xl object-cover bg-white/10 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-400 mb-0.5">
                    {breadcrumb}
                  </p>
                  <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">
                    {event.title}
                  </h1>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-2 text-gray-400 shrink-0 pt-1">
                <button
                  type="button"
                  title="Embed"
                  className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 stroke-current fill-none"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  title="Copy link"
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
                  {copied && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] bg-white text-black px-1.5 py-0.5 rounded font-semibold">
                      Copied
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setBookmarked((b) => !b)}
                  title="Bookmark"
                  className="p-2 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 ${bookmarked ? "fill-white stroke-white" : "fill-none stroke-current"}`}
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

            {/* Legend + Polymarket Watermark */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {topChartOutcomes.map((o) => {
                  const livePct = Math.round(
                    getLiveOutcomeProb(o, "yes") * 100,
                  );
                  const isFocused = highlightedOutcomeId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOutcomeId(o.id)}
                      className={`flex items-center gap-1.5 text-xs transition-opacity ${
                        isFocused
                          ? "opacity-100"
                          : "opacity-65 hover:opacity-100"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: o.color }}
                      />
                      <span className="text-gray-300 font-medium">
                        {o.name}
                      </span>
                      <span className="text-white font-bold tabular-nums">
                        {livePct}%
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 text-gray-500 text-sm font-semibold select-none">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 stroke-current fill-none"
                  strokeWidth="1.8"
                >
                  <path d="M5 4v16l7-4V8L5 4zm7 4l7-4v16l-7-4V8z" />
                </svg>
                Polymarket
              </div>
            </div>

            {/* Interactive Dynamic Multi-Line Chart */}
            <div className="relative select-none">
              <div className="flex items-stretch">
                <div
                  className="flex-1 relative cursor-crosshair"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <svg
                    viewBox={`0 0 ${chartW} ${chartH}`}
                    className="w-full h-[250px] overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      {topChartOutcomes.map((o) => (
                        <linearGradient
                          key={`area-${o.id}`}
                          id={`areaGrad-${o.id}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={o.color}
                            stopOpacity="0.24"
                          />
                          <stop
                            offset="100%"
                            stopColor={o.color}
                            stopOpacity="0"
                          />
                        </linearGradient>
                      ))}
                    </defs>

                    {/* Horizontal Dotted Grid */}
                    {ticksY.map((val) => {
                      const y = toChartY(val / 100);
                      return (
                        <line
                          key={val}
                          x1="0"
                          y1={y}
                          x2={chartW}
                          y2={y}
                          stroke="rgba(255,255,255,0.09)"
                          strokeWidth="1"
                          strokeDasharray="2 4"
                        />
                      );
                    })}

                    {/* Outcome Lines + Focused Area Fill + Pulsing Live End Dot */}
                    {topChartOutcomes.map((o) => {
                      const s = seriesMap[o.id] || [];
                      if (s.length < 2) return null;

                      const isFocused = highlightedOutcomeId === o.id;
                      const coords = s.map((pt, i) => ({
                        x: (i / (s.length - 1)) * chartW,
                        y: toChartY(pt.p),
                      }));

                      const linePath = coords
                        .map(
                          (pt, i) =>
                            `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`,
                        )
                        .join(" ");

                      const areaPath = `${linePath} L ${chartW} ${chartH} L 0 ${chartH} Z`;
                      const lastPt = coords[coords.length - 1];

                      return (
                        <g
                          key={o.id}
                          style={{
                            opacity: isFocused ? 1 : 0.6,
                            transition: "opacity 200ms ease",
                          }}
                        >
                          {isFocused && (
                            <path
                              d={areaPath}
                              fill={`url(#areaGrad-${o.id})`}
                            />
                          )}
                          <path
                            d={linePath}
                            fill="none"
                            stroke={o.color}
                            strokeWidth={isFocused ? "2.4" : "1.6"}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          {wsConnected && isFocused && (
                            <circle
                              cx={lastPt.x}
                              cy={lastPt.y}
                              r="7"
                              fill={o.color}
                              opacity="0.35"
                              className="animate-ping"
                              style={{
                                transformOrigin: `${lastPt.x}px ${lastPt.y}px`,
                              }}
                            />
                          )}
                          <circle
                            cx={lastPt.x}
                            cy={lastPt.y}
                            r={isFocused ? "4" : "3"}
                            fill={o.color}
                            stroke="#0d1016"
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })}

                    {/* Hover Crosshair & Dots */}
                    {hoverIdx !== null && baseTimeline[hoverIdx] && (
                      <g>
                        <line
                          x1={
                            (hoverIdx / Math.max(1, baseTimeline.length - 1)) *
                            chartW
                          }
                          y1="0"
                          x2={
                            (hoverIdx / Math.max(1, baseTimeline.length - 1)) *
                            chartW
                          }
                          y2={chartH}
                          stroke="rgba(255,255,255,0.28)"
                          strokeWidth="1"
                        />
                        {topChartOutcomes.map((o) => {
                          const s = seriesMap[o.id] || [];
                          const pt = s[Math.min(hoverIdx, s.length - 1)];
                          if (!pt) return null;
                          const cx =
                            (hoverIdx / Math.max(1, baseTimeline.length - 1)) *
                            chartW;
                          const cy = toChartY(pt.p);
                          return (
                            <circle
                              key={`dot-${o.id}`}
                              cx={cx}
                              cy={cy}
                              r="4.2"
                              fill={o.color}
                              stroke="#0d1016"
                              strokeWidth="1.5"
                            />
                          );
                        })}
                      </g>
                    )}
                  </svg>

                  {/* Hover Time + Floating Outcome Tooltip Pills */}
                  {hoverIdx !== null && baseTimeline[hoverIdx] && (
                    <div
                      className="absolute top-0 pointer-events-none z-20"
                      style={{
                        left: `${Math.min(
                          72,
                          Math.max(
                            4,
                            (hoverIdx / Math.max(1, baseTimeline.length - 1)) *
                              100,
                          ),
                        )}%`,
                      }}
                    >
                      <div className="text-[11px] font-medium text-gray-300 bg-[#0d1016]/90 px-2 py-0.5 rounded mb-2 whitespace-nowrap">
                        {formatTooltipTime(baseTimeline[hoverIdx].t)}
                      </div>
                      <div className="space-y-1">
                        {topChartOutcomes.map((o) => {
                          const s = seriesMap[o.id] || [];
                          const pt = s[Math.min(hoverIdx, s.length - 1)];
                          if (!pt) return null;
                          return (
                            <div
                              key={`tip-${o.id}`}
                              className="flex items-center gap-1.5 bg-[#1b2028]/95 border border-white/10 rounded px-2 py-0.5 text-[11px] font-bold text-white shadow whitespace-nowrap"
                            >
                              <span
                                className="w-1 h-3 rounded-full"
                                style={{ backgroundColor: o.color }}
                              />
                              <span>{o.name}</span>
                              <span className="tabular-nums">
                                {(pt.p * 100).toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-0 bg-[#1a1f28]/90 text-[10px] text-gray-400 px-2 py-0.5 rounded">
                    Source: Polymarket.com
                  </div>
                </div>

                {/* Dynamic Right Y-Axis */}
                <div className="flex flex-col justify-between pl-3 h-[250px] text-[11px] text-gray-400 tabular-nums">
                  {ticksY.map((val) => (
                    <span key={val} className="leading-none">
                      {val}%
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pr-12 mt-2 text-[11px] text-gray-400">
                {xTicks.map((t, i) => (
                  <span key={i}>{t.label}</span>
                ))}
              </div>
            </div>

            {/* Volume / End Date & Timeframes Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 py-4 mt-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-4 text-xs text-gray-400 tabular-nums">
                <span className="flex items-center gap-1.5 font-medium text-gray-300">
                  <svg viewBox="0 0 20 20" className="w-4 h-4 fill-gray-400">
                    <path d="M5 4h10v2a5 5 0 0 1-10 0V4zm-2 1h1v2H3a1 1 0 0 1 0-2zm13 0h1a1 1 0 0 1 0 2h-1V5zM9 12h2v3h3v2H6v-2h3v-3z" />
                  </svg>
                  {formatDollarVol(event.volume || event.volume24hr)}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 20 20"
                    className="w-3.5 h-3.5 stroke-gray-400 fill-none"
                    strokeWidth="1.8"
                  >
                    <circle cx="10" cy="10" r="7" />
                    <path d="M10 6v4l3 2" strokeLinecap="round" />
                  </svg>
                  {formatDateShort(event.endDate)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.label}
                    type="button"
                    onClick={() => setTimeframe(tf.label)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      timeframe === tf.label
                        ? "bg-white/[0.12] text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidate / Outcome Rows */}
            <div className="divide-y divide-white/[0.07]">
              {outcomesList.map((o) => {
                const isRowSelected = activeOutcome?.id === o.id;
                const liveYes = getLiveOutcomeProb(o, "yes");
                const liveNo = getLiveOutcomeProb(o, "no");
                const livePct = Math.round(liveYes * 100);
                const rowResolved =
                  (o.yesTokenId && resolvedMap[o.yesTokenId] !== undefined) ||
                  (o.noTokenId && resolvedMap[o.noTokenId] !== undefined) ||
                  o.closed;

                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedOutcomeId(o.id)}
                    className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 py-3.5 px-2 -mx-2 rounded-xl cursor-pointer transition-colors ${
                      isRowSelected
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {o.image ? (
                        <img
                          src={o.image}
                          alt={o.name}
                          className="w-10 h-10 rounded-lg object-cover bg-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                          {o.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-white truncate">
                            {o.name}
                          </p>
                          {rowResolved && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              Resolved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 tabular-nums">
                          {formatDollarVol(o.volume)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2 tabular-nums shrink-0">
                      <span className="text-xl font-bold text-white">
                        {livePct}%
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          o.delta >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {o.delta >= 0
                          ? `▲ ${o.delta}%`
                          : `▼ ${Math.abs(o.delta)}%`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOutcomeId(o.id);
                          setSelectedSide(o.yesLabel);
                        }}
                        className={`flex-1 sm:flex-none min-w-[116px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all tabular-nums ${
                          isRowSelected && selectedSide === o.yesLabel
                            ? "bg-[#16a34a] text-white ring-1 ring-emerald-300"
                            : "bg-[#14532d]/70 hover:bg-[#15803d] text-[#4ade80] hover:text-white"
                        }`}
                      >
                        Buy {o.yesLabel} {formatCents(liveYes)}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOutcomeId(o.id);
                          setSelectedSide(o.noLabel);
                        }}
                        className={`flex-1 sm:flex-none min-w-[116px] py-2.5 px-3 rounded-lg text-xs font-bold transition-all tabular-nums ${
                          isRowSelected && selectedSide === o.noLabel
                            ? "bg-[#dc2626] text-white ring-1 ring-red-300"
                            : "bg-[#7f1d1d]/50 hover:bg-[#991b1b] text-[#fca5a5] hover:text-white"
                        }`}
                      >
                        Buy {o.noLabel} {formatCents(liveNo)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= RIGHT COLUMN (Trade Box + Positions + Related) ================= */}
          <div className="lg:col-span-4 space-y-4">
            {/* Order Ticket Card */}
            <div className="bg-[#161a21] border border-white/[0.08] rounded-2xl p-4 shadow-xl">
              {/* Selected Outcome Header */}
              <div className="flex items-center justify-between gap-3 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {(activeOutcome?.image || event.icon) && (
                    <img
                      src={activeOutcome?.image || event.icon}
                      alt={activeOutcome?.name}
                      className="w-10 h-10 rounded-lg object-cover bg-white/10 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 truncate">
                      {event.title}
                    </p>
                    <p className="text-sm font-bold text-white truncate">
                      {activeOutcome?.name}{" "}
                      <span className="text-gray-400 mx-0.5">·</span>
                      <span
                        className={
                          isYesSelected ? "text-[#22c55e]" : "text-[#ef4444]"
                        }
                      >
                        {selectedSide}
                      </span>
                    </p>
                  </div>
                </div>

                {resolutionStatus && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold shrink-0">
                    Won: {resolutionStatus}
                  </span>
                )}
              </div>

              {/* Buy / Sell Tabs */}
              <div className="flex items-center justify-between border-b border-white/[0.08] mb-4">
                <div className="flex items-center gap-5">
                  {(["Buy", "Sell"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setTradeTab(tab);
                        setOrderNotice("");
                      }}
                      className={`pb-2.5 text-sm font-bold border-b-2 transition-colors ${
                        tradeTab === tab
                          ? "border-white text-white"
                          : "border-transparent text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-gray-300 pb-2">
                  Market · Live
                </span>
              </div>

              {/* Big Yes / No Toggle */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSide(activeOutcome?.yesLabel || "Yes")
                  }
                  className={`py-3 rounded-xl text-sm font-bold transition-all tabular-nums ${
                    isYesSelected
                      ? "bg-[#16a34a] text-white"
                      : "bg-[#222730] hover:bg-[#2a303c] text-gray-300"
                  }`}
                >
                  {activeOutcome?.yesLabel || "Yes"} {formatCents(liveYesPrice)}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSide(activeOutcome?.noLabel || "No")
                  }
                  className={`py-3 rounded-xl text-sm font-bold transition-all tabular-nums ${
                    !isYesSelected
                      ? "bg-[#dc2626] text-white"
                      : "bg-[#222730] hover:bg-[#2a303c] text-gray-300"
                  }`}
                >
                  {activeOutcome?.noLabel || "No"} {formatCents(liveNoPrice)}
                </button>
              </div>

              {/* Amount Input */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-bold text-white">Amount</p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    {loadingCash
                      ? "Loading..."
                      : `${formatCashString(cash)} cash`}
                    {tradeTab === "Sell" && currentPos
                      ? ` · $${currentPosValue.toFixed(2)} pos`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-3xl font-bold text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setOrderNotice("");
                    }}
                    className="w-28 bg-transparent text-right text-3xl font-bold text-white placeholder-gray-500 outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Quick +$ Chips + Max */}
              <div className="flex items-center justify-end gap-1.5 mb-5">
                {[1, 5, 10, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      setAmount((prev) => String((parseFloat(prev) || 0) + val))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#222730] hover:bg-[#2e3440] text-xs font-semibold text-gray-200 transition-colors"
                  >
                    +${val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const maxVal = tradeTab === "Buy" ? cash : currentPosValue;
                    setAmount(maxVal > 0 ? maxVal.toFixed(2) : "0");
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222730] hover:bg-[#2e3440] text-xs font-semibold text-blue-300 transition-colors"
                >
                  Max
                </button>
              </div>

              {/* Est Payout Row when amount > 0 */}
              {numAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-gray-300 bg-white/[0.04] rounded-xl px-3 py-2.5 mb-3 tabular-nums">
                  <span>
                    {tradeTab === "Buy"
                      ? "Est. shares / Payout if wins"
                      : "Est. shares sold"}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {estShares.toFixed(2)} shares
                    {tradeTab === "Buy" ? ` ($${estShares.toFixed(2)})` : ""}
                  </span>
                </div>
              )}

              {/* Primary CTA */}
              <button
                type="button"
                disabled={isMarketResolved || loadingCash}
                onClick={handleExecuteTrade}
                className={`w-full py-3 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  tradeTab === "Sell"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-[#2563eb] hover:bg-[#1d4ed8]"
                }`}
              >
                {isMarketResolved
                  ? `Resolved (${resolutionStatus || "Closed"})`
                  : !isLoggedIn
                    ? "Log in to Trade"
                    : loadingCash
                      ? "Loading Balance..."
                      : tradeTab === "Buy" && cash <= 0
                        ? "Deposit Cash"
                        : `${tradeTab} ${selectedSide}`}
              </button>

              {orderNotice && (
                <p className="text-xs text-blue-300 text-center mt-2.5 leading-relaxed">
                  {orderNotice}
                </p>
              )}
            </div>

            {/* Open Positions on this Event (Click to open Close modal) */}
            {eventPositions.length > 0 && (
              <div className="bg-[#161a21] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                {eventPositions.map((pos) => {
                  const liveP = getPositionLivePrice(pos);
                  const val = pos.shares * liveP;
                  const pnl = val - pos.cost;
                  return (
                    <div
                      key={pos.key}
                      onClick={() => {
                        setSelectedOutcomeId(pos.marketId);
                        setSelectedSide(pos.side);
                        setModalPosKey(pos.key);
                      }}
                      className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-transparent hover:border-white/[0.1] cursor-pointer tabular-nums transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-white truncate">
                          {pos.marketName} · {pos.side}
                        </p>
                        <p className="text-gray-400">
                          {pos.shares.toFixed(2)} shares · Max win $
                          {pos.shares.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-white">
                          ${val.toFixed(2)}
                        </p>
                        <p
                          className={
                            pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          }
                        >
                          {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-gray-500 text-center">
              By trading, you agree to the{" "}
              <span className="underline cursor-pointer">Terms of Use</span>.
            </p>

            {/* Related Markets Section */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-3 no-scrollbar">
                {relatedTags.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setRelatedFilter(t.slug)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      relatedFilter === t.slug
                        ? "bg-white/[0.14] text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {relatedEvents.map((rel) => {
                  const firstMkt = rel.markets?.[0];
                  const pct = firstMkt
                    ? Math.round(
                        (parseFloat(
                          safeParseArray<string>(firstMkt.outcomePrices)[0],
                        ) || 0) * 100,
                      )
                    : 50;

                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => onSelectEvent?.(rel)}
                      className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#161a21] hover:bg-[#1d222c] border border-white/[0.06] text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {(rel.icon || rel.image) && (
                          <img
                            src={rel.icon || rel.image}
                            alt={rel.title}
                            className="w-9 h-9 rounded-lg object-cover bg-white/10 shrink-0"
                          />
                        )}
                        <span className="text-[13px] font-semibold text-white line-clamp-2 leading-snug">
                          {rel.title}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= CLOSE POSITION MODAL ================= */}
      {modalPosition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setModalPosKey(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[#161a21] border border-white/[0.12] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 truncate">{event.title}</p>
                <h3 className="text-lg font-bold text-white mt-0.5 truncate">
                  {modalPosition.marketName}{" "}
                  <span className="text-gray-400">·</span>{" "}
                  <span
                    className={
                      modalPosition.side ===
                      (outcomesList.find((x) => x.id === modalPosition.marketId)
                        ?.yesLabel || "Yes")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                  >
                    {modalPosition.side}
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalPosKey(null)}
                aria-label="Dismiss modal"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-[#0d1016] border border-white/[0.07] p-4 space-y-2.5 text-sm tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Shares</span>
                <span className="font-semibold text-white">
                  {modalPosition.shares.toFixed(2)} shares
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Entry Cost</span>
                <span className="font-semibold text-gray-200">
                  ${modalPosition.cost.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current Price</span>
                <span className="font-semibold text-gray-200">
                  {formatCents(modalLivePrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Max Win</span>
                <span className="font-semibold text-gray-200">
                  ${modalPosition.shares.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-white/[0.07] pt-2.5 flex items-center justify-between">
                <span className="text-gray-300 font-semibold">
                  Remaining Value (to Cash)
                </span>
                <div className="text-right">
                  <span className="text-base font-bold text-white">
                    ${modalValue.toFixed(2)}
                  </span>
                  <span
                    className={`ml-2 text-xs font-bold ${
                      modalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    ({modalPnl >= 0 ? "+" : "-"}${Math.abs(modalPnl).toFixed(2)}
                    )
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setModalPosKey(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-sm font-semibold text-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleClosePosition(modalPosition)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-colors cursor-pointer"
              >
                Close (${modalValue.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
