/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import CategoryPage, { type PolyEvent } from "./CategoryPage";
import MarketDetailPage from "./MarketDetail";

const GAMMA_API = "https://gamma-api.polymarket.com";

export interface RoutePolyEvent extends PolyEvent {
  slug?: string;
}

interface EventRouteState {
  event?: RoutePolyEvent;
  marketId?: string | null;
  side?: "Yes" | "No";
}

export function CategoryRoute() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  return (
    <CategoryPage
      category={decodeURIComponent(category || "Politics")}
      onSelectEvent={(
        ev: RoutePolyEvent,
        marketId?: string,
        side: "Yes" | "No" = "Yes",
      ) =>
        navigate(`/event/${encodeURIComponent(ev.slug || ev.id)}`, {
          state: { event: ev, marketId: marketId ?? null, side },
        })
      }
    />
  );
}

export function SearchRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";

  return (
    <CategoryPage
      category="Search"
      searchQuery={q}
      onSelectEvent={(
        ev: RoutePolyEvent,
        marketId?: string,
        side: "Yes" | "No" = "Yes",
      ) =>
        navigate(`/event/${encodeURIComponent(ev.slug || ev.id)}`, {
          state: { event: ev, marketId: marketId ?? null, side },
        })
      }
    />
  );
}

export function EventDetailRoute() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = (location.state as EventRouteState | null) || null;
  const stateEvent = routeState?.event || null;

  const [event, setEvent] = useState<RoutePolyEvent | null>(stateEvent);
  const [loading, setLoading] = useState<boolean>(!stateEvent);
  const [error, setError] = useState<string>("");

  // Sync if user clicks a Related Market or another search result while already on /event/:slug
  useEffect(() => {
    if (routeState?.event && routeState.event.slug === slug) {
      setEvent(routeState.event);
      setLoading(false);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!slug) {
      setLoading(false);
      setError("Market not found.");
      return;
    }

    // Direct URL visit or page refresh: fetch event by slug from Polymarket
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<RoutePolyEvent[] | RoutePolyEvent>;
      })
      .then((data) => {
        if (cancelled) return;
        const found = Array.isArray(data) ? data[0] : data;
        if (!found) throw new Error("Market not found.");
        setEvent(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load market.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, routeState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1016] text-white p-8 flex items-center justify-center text-sm text-gray-400">
        Loading market details...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0d1016] text-white p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-red-400">{error || "Market not found."}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-xl bg-[#2563eb] text-xs font-bold"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <MarketDetailPage
      event={{ ...event, title: event.title ?? "" }}
      initialMarketId={routeState?.marketId || null}
      initialSide={routeState?.side || "Yes"}
      onBack={() => navigate(-1)}
      onSelectEvent={(ev: RoutePolyEvent) =>
        navigate(`/event/${encodeURIComponent(ev.slug || ev.id)}`, {
          state: { event: ev },
        })
      }
    />
  );
}
