import React, { useState, useEffect } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import CategoryPage from "./CategoryPage";
import MarketDetailPage from "./MarketDetail";



const GAMMA_API = "https://gamma-api.polymarket.com";

export function CategoryRoute() {
  const { category } = useParams();
  const navigate = useNavigate();

  return (
    <CategoryPage
      category={decodeURIComponent(category || "Politics")}
      onSelectEvent={(ev, marketId = null, side = "Yes") =>
        navigate(`/event/${encodeURIComponent(ev.slug)}`, {
          state: { event: ev, marketId, side },
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
      onSelectEvent={(ev, marketId = null, side = "Yes") =>
        navigate(`/event/${encodeURIComponent(ev.slug)}`, {
          state: { event: ev, marketId, side },
        })
      }
    />
  );
}

export function EventDetailRoute() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const stateEvent = location.state?.event || null;
  const [event, setEvent] = useState(stateEvent);
  const [loading, setLoading] = useState(!stateEvent);
  const [error, setError] = useState("");

  // Sync if user clicks a Related Market or another search result while already on /event/:slug
  useEffect(() => {
    if (location.state?.event && location.state.event.slug === slug) {
      setEvent(location.state.event);
      setLoading(false);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Direct URL visit or page refresh: fetch event by slug from Polymarket
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const found = Array.isArray(data) ? data[0] : data;
        if (!found) throw new Error("Market not found.");
        setEvent(found);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load market.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, location.state]);

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
      event={event}
      initialMarketId={location.state?.marketId || null}
      initialSide={location.state?.side || "Yes"}
      onBack={() => navigate(-1)}
      onSelectEvent={(ev) =>
        navigate(`/event/${encodeURIComponent(ev.slug)}`, {
          state: { event: ev },
        })
      }
    />
  );
}
