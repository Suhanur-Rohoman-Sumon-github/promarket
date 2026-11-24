/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

import {
  Search,
  ChevronDown,
  ChevronRight,
  Gift,
  Bell,
  Menu,
  X,
  CandlestickChart,
  Loader2,
  Info,
  Trophy,
  CircleDollarSign,
  Plug,
  Moon,
  Settings,
  Terminal,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase"; // adjust path

const POLY_API = "https://gamma-api.polymarket.com";
const AUTH_STORAGE_KEY = "promarkets_demo_user";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

interface UserProfile {
  id?: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  isVerified?: boolean;
  cash: number;
  portfolio: number;
  hasFirstDeposit?: boolean;
}

function getStoredEmail(): string | null {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as { email?: string };
    return parsed?.email ? String(parsed.email).toLowerCase().trim() : null;
  } catch {
    return null;
  }
}

function formatUsd(val: number | undefined): string {
  const num = Number(val) || 0;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface SearchMarket {
  outcomePrices?: string | string[];
}

interface SearchEvent {
  id: string;
  slug: string;
  title: string;
  icon?: string;
  image?: string;
  markets?: SearchMarket[];
}

const categories = [
  "Trending",
  "Combos",
  "Breaking",
  "New",
  "Politics",
  "Sports",
  "Crypto",
  "Esports",
  "Iran",
  "Finance",
  "Geopolitics",
  "Tech",
  "Elections",
  "Culture",
  "Economy",
  "Weather",
  "Mentions",
  "Art",
] as const;

function safeParseArray(val: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") {
    try {
      const parsed: unknown = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as string[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [userEmail, setUserEmail] = useState<string | null>(() =>
    getStoredEmail(),
  );
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const syncEmail = () => {
      setUserEmail(getStoredEmail());
    };

    window.addEventListener("promarkets-auth-change", syncEmail);
    window.addEventListener("storage", syncEmail);

    return () => {
      window.removeEventListener("promarkets-auth-change", syncEmail);
      window.removeEventListener("storage", syncEmail);
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setUser(null);
      return;
    }

    const controller = new AbortController();

    const fetchUser = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/users/${encodeURIComponent(userEmail)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          if (res.status === 404) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setUser(null);
          }
          return;
        }
        const json = (await res.json()) as {
          success?: boolean;
          data?: UserProfile;
        };
        if (json.success && json.data) {
          setUser(json.data);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setUser(null);
        }
      }
    };

    fetchUser();

    return () => controller.abort();
  }, [userEmail, location.pathname]);

  useEffect(() => {
    const openDeposit = () => navigate("/deposit");
    window.addEventListener("open-deposit-modal", openDeposit);
    return () => window.removeEventListener("open-deposit-modal", openDeposit);
  }, [navigate]);

  const [authModal, setAuthModal] = useState<"login" | "signup" | null>(null);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const [search, setSearch] = useState<string>("");
  const [results, setResults] = useState<SearchEvent[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const activeCategory = (() => {
    if (location.pathname === "/") return "Trending";
    if (location.pathname === "/sports") return "Sports";
    if (location.pathname.startsWith("/category/")) {
      return decodeURIComponent(location.pathname.replace("/category/", ""));
    }
    return "";
  })();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setDropdownOpen(false);
        setMenuOpen(false);
        setAuthModal(null);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${POLY_API}/public-search?q=${encodeURIComponent(q)}&limit_per_type=8`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as
          | { events?: SearchEvent[] }
          | SearchEvent[];
        const events = Array.isArray(data)
          ? data
          : Array.isArray(data?.events)
            ? data.events
            : [];
        setResults(events);
        setDropdownOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth).catch(() => {});
    }
    setUserEmail(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event("promarkets-auth-change"));
    setMenuOpen(false);
  };

  const goToPage = (path: string) => {
    setMenuOpen(false);
    setMobileOpen(false);
    setDropdownOpen(false);
    navigate(path);
  };

  const handleCategoryClick = (cat: string) => {
    setDropdownOpen(false);
    setMobileOpen(false);
    if (cat === "Trending") navigate("/");
    else navigate(`/category/${encodeURIComponent(cat)}`);
  };

  const handleSelectEvent = (ev: SearchEvent) => {
    setDropdownOpen(false);
    setMobileOpen(false);
    navigate(`/event/${encodeURIComponent(ev.slug)}`, {
      state: { event: ev },
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      setDropdownOpen(false);
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0e1015] text-white border-b border-[#292c34]">
        <div className="h-[58px] px-3 md:px-5 flex items-center gap-4">
          {/* Logo */}
          <button
            type="button"
            onClick={() => handleCategoryClick("Trending")}
            className="flex items-center gap-2 shrink-0 text-left"
          >
            <svg width="22" height="25" viewBox="0 0 22 25" fill="none">
              <path d="M2 5L19 1V11L2 15V5Z" stroke="white" strokeWidth="2" />
              <path
                d="M2 15L19 11V23L2 19V15Z"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
            <Link to="/" className="text-lg font-bold text-white">
              <span className="text-[19px] font-semibold tracking-tight cursor-pointer">
                Promarkets
              </span>
            </Link>
            <span className="hidden sm:block text-[#444750] mx-2">|</span>
          </button>

          {/* Search */}
          <div
            ref={searchWrapperRef}
            className="flex-1 flex justify-center min-w-0 relative"
          >
            <div className="w-full max-w-[480px] relative">
              <div className="w-full h-10 bg-[#1b1e27] rounded-xl flex items-center px-3 gap-2 focus-within:ring-1 focus-within:ring-[#454b5a]">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  value={search}
                  onFocus={() => results.length > 0 && setDropdownOpen(true)}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search polymarkets..."
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                />
                {searching ? (
                  <Loader2
                    size={15}
                    className="text-gray-400 animate-spin shrink-0"
                  />
                ) : search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setResults([]);
                      setDropdownOpen(false);
                    }}
                    className="text-gray-400 hover:text-white text-xs px-1"
                  >
                    ✕
                  </button>
                ) : (
                  <span className="hidden sm:block text-xs text-gray-500 bg-[#272a34] px-2 py-1 rounded">
                    /
                  </span>
                )}
              </div>

              {dropdownOpen && search.trim() && (
                <div className="absolute left-0 right-0 top-12 bg-[#161922] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
                  {results.length === 0 && !searching ? (
                    <div className="p-4 text-xs text-gray-400 text-center">
                      No markets found for "{search}"
                    </div>
                  ) : (
                    <>
                      {results.map((ev) => {
                        const firstMkt = ev.markets?.[0];
                        const pct = firstMkt
                          ? Math.round(
                              (parseFloat(
                                safeParseArray(firstMkt.outcomePrices)[0] ||
                                  "0",
                              ) || 0) * 100,
                            )
                          : null;

                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => handleSelectEvent(ev)}
                            className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.06] text-left border-b border-white/[0.04] last:border-b-0 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {(ev.icon || ev.image) && (
                                <img
                                  src={ev.icon || ev.image}
                                  alt={ev.title}
                                  className="w-8 h-8 rounded-lg object-cover bg-white/10 shrink-0"
                                />
                              )}
                              <span className="text-xs font-semibold text-white truncate">
                                {ev.title}
                              </span>
                            </div>
                            {pct !== null && (
                              <span className="text-xs font-bold text-emerald-400 tabular-nums shrink-0">
                                {pct}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate(
                            `/search?q=${encodeURIComponent(search.trim())}`,
                          );
                        }}
                        className="w-full py-2.5 text-center text-xs font-semibold text-blue-400 hover:bg-white/[0.04] bg-[#12151c]"
                      >
                        View all results for "{search.trim()}" →
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side */}
          <div
            ref={accountMenuRef}
            className="flex items-center gap-2.5 shrink-0 relative"
          >
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-4 mr-1">
                  <button
                    type="button"
                    onClick={() => goToPage("/withdraw")}
                    title="Click to withdraw funds"
                    className="text-right leading-tight px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] font-medium text-gray-400">
                      Cash
                    </p>
                    <p className="text-sm font-bold text-[#22c55e] tabular-nums">
                      {formatUsd(user.cash)}
                    </p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => goToPage("/deposit")}
                  className="bg-[#315cf5] hover:bg-[#416bff] px-4 h-9 rounded-xl text-sm font-semibold transition-colors"
                >
                  Deposit
                </button>

                <button
                  type="button"
                  onClick={() => goToPage("/rewards")}
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-[#30333d] hover:bg-[#20232b] text-gray-300 hover:text-white"
                >
                  <Gift size={18} />
                </button>

                <button
                  type="button"
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-[#30333d] hover:bg-[#20232b] text-gray-300 hover:text-white"
                >
                  <Bell size={18} />
                </button>

                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  title={user.username}
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 via-indigo-400 to-purple-500 border border-white/15 shrink-0 hover:ring-2 hover:ring-white/30 transition-all"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => goToPage("/help")}
                  className="hidden md:flex items-center gap-1.5 text-sm font-medium text-gray-200 hover:text-white mr-2 transition-colors"
                >
                  <Info size={15} className="text-gray-400" />
                  How it works
                </button>

                <button
                  type="button"
                  onClick={() => goToPage("/login")}
                  className="px-3 h-9 rounded-xl text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
                >
                  Log in
                </button>

                <button
                  type="button"
                  onClick={() => goToPage("/signup")}
                  className="bg-[#315cf5] hover:bg-[#416bff] px-4 h-9 rounded-xl text-sm font-semibold text-white transition-colors"
                >
                  Sign up
                </button>

                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-[#20232b] text-gray-200 transition-colors"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="w-5 h-5 stroke-current"
                    strokeWidth="1.8"
                  >
                    <path d="M3 7.5h14M3 12.5h14" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[#20232b]"
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 top-12 w-[250px] bg-[#161922] border border-[#2a2e39] rounded-2xl shadow-2xl py-2 z-50 text-sm">
                {user && (
                  <>
                    <div className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 via-indigo-400 to-purple-500 shrink-0" />
                        <span className="font-bold text-white truncate">
                          {user.username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToPage("/support")}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06]"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                    <div className="my-1.5 border-t border-[#262a34]" />
                  </>
                )}

                <div className="px-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => goToPage("/leaderboard")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white font-semibold hover:bg-white/[0.06] transition-colors"
                  >
                    <Trophy size={16} className="text-amber-400" />
                    Leaderboard
                  </button>

                  <button
                    type="button"
                    onClick={() => goToPage("/rewards")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white font-semibold hover:bg-white/[0.06] transition-colors"
                  >
                    <CircleDollarSign size={16} className="text-emerald-400" />
                    Rewards
                  </button>

                  <button
                    type="button"
                    onClick={() => goToPage("/apis")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white font-semibold hover:bg-white/[0.06] transition-colors"
                  >
                    <Plug size={16} className="text-pink-400" />
                    APIs
                  </button>

                  {user && (
                    <>
                      <button
                        type="button"
                        onClick={() => goToPage("/refer")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white font-semibold hover:bg-white/[0.06] transition-colors"
                      >
                        <Gift size={16} className="text-purple-400" />
                        Refer &amp; Earn
                      </button>

                      <button
                        type="button"
                        onClick={() => goToPage("/builders")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white font-semibold hover:bg-white/[0.06] transition-colors"
                      >
                        <Terminal size={16} className="text-gray-400" />
                        Builders
                      </button>
                    </>
                  )}

                  <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-white font-semibold">
                    <span className="flex items-center gap-3">
                      <Moon size={16} className="text-blue-400" />
                      Dark mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setDarkMode((d) => !d)}
                      className={`w-10 h-5.5 rounded-full p-0.5 transition-colors flex items-center ${
                        darkMode
                          ? "bg-[#315cf5] justify-end"
                          : "bg-gray-600 justify-start"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow" />
                    </button>
                  </div>
                </div>

                <div className="my-2 border-t border-[#262a34]" />

                <div className="px-1.5 space-y-0.5 text-[13px] text-gray-300 font-medium">
                  {[
                    { label: "Accuracy", path: "/accuracy" },
                    ...(user ? [{ label: "Support", path: "/support" }] : []),
                    { label: "Status", path: "/status" },
                    { label: "Documentation", path: "/docs" },
                    { label: "Help Center", path: "/help" },
                    { label: "Trust & Safety Hub", path: "/trust" },
                    { label: "Terms of Use", path: "/terms" },
                  ].map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => goToPage(item.path)}
                      className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>🇺🇸</span>
                      <span>English</span>
                    </span>
                    <ChevronRight size={14} className="text-gray-500" />
                  </button>
                </div>

                {user && (
                  <>
                    <div className="my-2 border-t border-[#262a34]" />
                    <div className="px-1.5">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Categories */}
        <nav className="hidden lg:flex h-[42px] items-stretch px-3 md:px-5 gap-5 overflow-x-auto scrollbar-none">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryClick(category)}
              className={`relative flex items-center whitespace-nowrap text-sm font-semibold transition-colors ${
                activeCategory === category
                  ? "text-white"
                  : "text-[#a7aab4] hover:text-white"
              }`}
            >
              {category === "Combos" && (
                <CandlestickChart size={17} className="mr-2" />
              )}
              {category === "Politics" && (
                <span className="mr-2 text-[#454953]">|</span>
              )}
              {category}
              {activeCategory === category && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleCategoryClick("Trending")}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white whitespace-nowrap"
          >
            More <ChevronDown size={15} />
          </button>
        </nav>

        {/* Mobile Categories */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#292c34] bg-[#11141b] p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={`text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? "bg-[#252a36] text-white"
                      : "text-gray-400 hover:bg-[#20232b] hover:text-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Demo Auth Modal */}
      {authModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161922] border border-[#2a2e39] rounded-2xl p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setAuthModal(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h2 className="text-lg font-bold text-white mb-1">
              {authModal === "login"
                ? "Log in to Promarkets"
                : "Create Demo Account"}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Demo credentials are pre-filled below—click Sign in to test the
              logged-in navbar.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
