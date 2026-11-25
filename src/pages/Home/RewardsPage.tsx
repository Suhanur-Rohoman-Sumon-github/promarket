/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircleDollarSign,
  Gift,
  CheckCircle2,
  Bitcoin,
  Sparkles,
  Lock,
  X,
  Zap,
  Calendar,
  Clock,
  UserPlus,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

const AUTH_STORAGE_KEY = "promarkets_demo_user";

export interface SpinRecord {
  day: number;
  amount: number;
  spunAt: number;
}

interface DbUser {
  id?: string;
  username?: string;
  email: string;
  cash: number;
  portfolio?: number;
  hasFirstDeposit: boolean;
  spins: SpinRecord[];
}

export interface RewardsPageProps {
  userEmail?: string;
  hasFirstDeposit?: boolean;
  onDepositClick?: () => void;
  onSignupClick?: () => void;
  onClaimBonus?: (amountUsd: number, day: number) => Promise<void> | void;
}

interface SpinSegment {
  amount: number;
  label: string;
  gradStart: string;
  gradEnd: string;
  textColor: string;
  subColor: string;
}

const SPIN_SEGMENTS: SpinSegment[] = [
  {
    amount: 3,
    label: "$3",
    gradStart: "#14532d",
    gradEnd: "#052e16",
    textColor: "#6ee7b7",
    subColor: "#34d399",
  },
  {
    amount: 100,
    label: "$100",
    gradStart: "#1e293b",
    gradEnd: "#0f172a",
    textColor: "#93c5fd",
    subColor: "#60a5fa",
  },
  {
    amount: 15,
    label: "$15",
    gradStart: "#1f2430",
    gradEnd: "#12151c",
    textColor: "#f3f4f6",
    subColor: "#9ca3af",
  },
  {
    amount: 2500,
    label: "$2,500",
    gradStart: "#fbbf24",
    gradEnd: "#b45309",
    textColor: "#090b10",
    subColor: "#451a03",
  },
  {
    amount: 5,
    label: "$5",
    gradStart: "#1f2430",
    gradEnd: "#12151c",
    textColor: "#f3f4f6",
    subColor: "#9ca3af",
  },
  {
    amount: 500,
    label: "$500",
    gradStart: "#047857",
    gradEnd: "#064e3b",
    textColor: "#ecfdf5",
    subColor: "#6ee7b7",
  },
  {
    amount: 50,
    label: "$50",
    gradStart: "#1e293b",
    gradEnd: "#0f172a",
    textColor: "#e2e8f0",
    subColor: "#94a3b8",
  },
  {
    amount: 1500,
    label: "$1,500",
    gradStart: "#4338ca",
    gradEnd: "#1e1b4b",
    textColor: "#e0e7ff",
    subColor: "#a5b4fc",
  },
];

const SLICE_DEG = 360 / SPIN_SEGMENTS.length;
const SPIN_DURATION_MS = 4800;
const ALWAYS_WIN_AMOUNT = 3;
const MAX_SPIN_DAYS = 5;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getSessionEmail(propEmail?: string): string | null {
  if (propEmail?.trim()) return propEmail.trim();
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed?.email?.trim() || null;
  } catch {
    return null;
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildSlicePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(
    2,
  )} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

export function RewardsPage({
  userEmail,
  hasFirstDeposit: controlledDeposit,
  onDepositClick,
  onSignupClick,
  onClaimBonus,
}: RewardsPageProps) {
  const navigate = useNavigate();

  const [activeEmail, setActiveEmail] = useState<string | null>(() =>
    getSessionEmail(userEmail),
  );
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [justWonDay, setJustWonDay] = useState<number | null>(null);
  const [ledTick, setLedTick] = useState<number>(0);
  const spinTimerRef = useRef<number | null>(null);

  // Fetch user, hasFirstDeposit, cash, and spins directly from MongoDB
  const fetchUserFromDatabase = useCallback(async (email: string | null) => {
    if (!email) {
      setDbUser(null);
      return;
    }

    setIsLoadingDb(true);
    setSpinError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/users/${encodeURIComponent(email)}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);
      

      if (!res.ok || !json?.success || !json?.data) {
        
        setIsSpinning(false);
        setSpinError(
          json?.message || json?.error || `Server error (${res.status})`,
        );
        return;
      }

      if (json?.success && json?.data) {
        setDbUser({
          ...json.data,
          cash: Number(json.data.cash || 0),
          hasFirstDeposit: Boolean(json.data.hasFirstDeposit),
          spins: Array.isArray(json.data.spins) ? json.data.spins : [],
        });
      }
    } catch (err) {
      console.error("Network error loading rewards from database:", err);
      setSpinError(`Cannot reach ${API_BASE_URL}. Check server port & CORS.`);
    } finally {
      setIsLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    const email = getSessionEmail(userEmail);
    setActiveEmail(email);
    fetchUserFromDatabase(email);
  }, [userEmail, fetchUserFromDatabase]);

  // Re-fetch directly from database whenever auth or deposit changes
  useEffect(() => {
    const handleSync = () => {
      const email = getSessionEmail(userEmail);
      setActiveEmail(email);
      fetchUserFromDatabase(email);
    };

    window.addEventListener("promarkets-auth-change", handleSync);
    window.addEventListener("promarkets-deposit-success", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("promarkets-auth-change", handleSync);
      window.removeEventListener("promarkets-deposit-success", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [userEmail, fetchUserFromDatabase]);

  const isLoggedIn = Boolean(activeEmail);
  const spins: SpinRecord[] = dbUser?.spins ?? [];
  const hasFirstDeposit =
    isLoggedIn &&
    (Boolean(controlledDeposit) ||
      Boolean(dbUser?.hasFirstDeposit) ||
      Number(dbUser?.cash || 0) > 0 ||
      spins.length > 0);

  const completedCount = spins.length;
  const isAllCompleted = completedCount >= MAX_SPIN_DAYS;
  const lastSpin = completedCount > 0 ? spins[completedCount - 1] : null;
  const remainingMs =
    lastSpin && !isAllCompleted
      ? Math.max(0, lastSpin.spunAt + COOLDOWN_MS - now)
      : 0;
  const canSpinNow =
    isLoggedIn &&
    hasFirstDeposit &&
    !isAllCompleted &&
    remainingMs === 0 &&
    !isSpinning;
  const currentDay = Math.min(MAX_SPIN_DAYS, completedCount + 1);
  const totalWonUsd = spins.reduce((sum, s) => sum + s.amount, 0);

  // Live 1-second countdown for the 24h cooldown
  useEffect(() => {
    if (!lastSpin || isAllCompleted) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [lastSpin, isAllCompleted]);

  // Chasing LED bulbs animation around the wheel rim
  useEffect(() => {
    if (!isModalOpen) return;
    const speed = isSpinning ? 90 : 450;
    const id = window.setInterval(() => {
      setLedTick((t) => (t + 1) % 24);
    }, speed);
    return () => window.clearInterval(id);
  }, [isModalOpen, isSpinning]);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
    };
  }, []);

  const handleSignupRedirect = () => {
    setIsModalOpen(false);
    if (onSignupClick) {
      onSignupClick();
      return;
    }
    navigate("/signup");
  };

  const handleDepositUnlock = () => {
    if (!isLoggedIn) {
      handleSignupRedirect();
      return;
    }
    if (onDepositClick) {
      onDepositClick();
      return;
    }
    setIsModalOpen(false);
    window.dispatchEvent(new Event("open-deposit-modal"));
  };

  const triggerSpin = () => {
    if (!canSpinNow || !activeEmail) return;

    setSpinError(null);

    const winIndex = SPIN_SEGMENTS.findIndex(
      (s) => s.amount === ALWAYS_WIN_AMOUNT,
    );
    const sliceCenter = winIndex * SLICE_DEG + SLICE_DEG / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (((360 - sliceCenter) % 360) + 360) % 360;
    const deltaMod = (desiredMod - currentMod + 360) % 360;
    const jitter = (Math.random() - 0.5) * 10;

    const nextRotation = rotation + 360 * 7 + deltaMod + jitter;
    const spunDay = completedCount + 1;

    setIsSpinning(true);
    setJustWonDay(null);
    setRotation(nextRotation);

    spinTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: activeEmail }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success || !json?.data) {
          setIsSpinning(false);
          setSpinError(json?.message || "Unable to claim spin reward.");
          return;
        }

        const updatedDbUser: DbUser = {
          ...json.data,
          cash: Number(json.data.cash || 0),
          hasFirstDeposit: Boolean(json.data.hasFirstDeposit),
          spins: Array.isArray(json.data.spins) ? json.data.spins : [],
        };

        setIsSpinning(false);
        setNow(Date.now());
        setJustWonDay(spunDay);
        setDbUser(updatedDbUser);

        window.dispatchEvent(
          new CustomEvent("promarkets-user-updated", { detail: updatedDbUser }),
        );
        await onClaimBonus?.(ALWAYS_WIN_AMOUNT, spunDay);
      } catch {
        setIsSpinning(false);
        setSpinError("Network error while claiming your spin bonus.");
      }
    }, SPIN_DURATION_MS + 120);
  };

  const sortedTiers = [3, 5, 15, 50, 100, 500, 1500, 2500];
  const cx = 180;
  const cy = 180;
  const radius = 152;
  const ledCount = 24;

  return (
    <div className="min-h-screen bg-[#0d1016] text-white py-8 px-4 md:px-6">
      <div className="max-w-[1160px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-start gap-3.5 border-b border-white/[0.07] pb-5">
          <div className="w-11 h-11 rounded-xl bg-[#161a22] border border-white/[0.08] flex items-center justify-center shrink-0">
            <CircleDollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Rewards
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Unlock your 5-Day First Deposit Bonus spin streak and earn daily
              USDC liquidity rewards.
            </p>
          </div>
        </div>

        {/* ================= FIRST DEPOSIT BONUS HERO CARD ================= */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-[#1b1912] via-[#151822] to-[#101819] p-6 md:p-8 shadow-2xl">
          <div
            className="pointer-events-none absolute -top-28 -right-20 w-96 h-96 rounded-full opacity-25 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, #fbbf24 0%, #10b981 50%, transparent 75%)",
            }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5" />
                  First Deposit Bonus
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />5 Daily Spins
                </div>
              </div>

              <div>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white flex flex-wrap items-center gap-2.5">
                  <span>Win up to</span>
                  <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-emerald-300 bg-clip-text text-transparent inline-flex items-center gap-1.5">
                    $2,500 in BTC
                    <Bitcoin className="w-8 h-8 text-amber-400 shrink-0" />
                  </span>
                </h2>
                <p className="text-sm text-gray-300/90 mt-2 max-w-xl">
                  Deposit your first amount to unlock a 5-day bonus spin
                  calendar. Spin once every 24 hours for instant Bitcoin
                  rewards.
                </p>
              </div>

              {/* Prize Pills */}
              <div className="flex flex-wrap gap-2">
                {sortedTiers.map((amt) => {
                  const isJackpot = amt === 2500;
                  const isWon =
                    isLoggedIn && spins.some((s) => s.amount === amt);
                  return (
                    <span
                      key={amt}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tabular-nums border ${
                        isWon
                          ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20"
                          : isJackpot
                            ? "bg-amber-500/15 border-amber-400/40 text-amber-300"
                            : "bg-[#0d1016]/80 border-white/[0.08] text-gray-200"
                      }`}
                    >
                      ${amt.toLocaleString()}
                    </span>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {!isLoggedIn ? (
                  <button
                    type="button"
                    onClick={handleSignupRedirect}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-110 text-black font-black text-sm shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign Up, Deposit &amp; Get Up to $2,500
                  </button>
                ) : isLoadingDb && !dbUser ? (
                  <div className="px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs text-gray-300 font-semibold">
                    Loading rewards from database...
                  </div>
                ) : !hasFirstDeposit ? (
                  <button
                    type="button"
                    onClick={handleDepositUnlock}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-extrabold text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    Deposit First Amount to Unlock Spin
                  </button>
                ) : isAllCompleted ? (
                  <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/35">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">
                        5-Day Bonus Completed: ${totalWonUsd.toLocaleString()}{" "}
                        in BTC!
                      </p>
                      <p className="text-xs text-emerald-300">
                        All 5 daily spins claimed &amp; credited.
                      </p>
                    </div>
                  </div>
                ) : remainingMs > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#111622] border border-amber-400/30 text-amber-300 font-bold text-sm cursor-pointer hover:border-amber-400/60 transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    <span className="tabular-nums">
                      Day {currentDay} Unlocks in {formatCountdown(remainingMs)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setJustWonDay(null);
                      setSpinError(null);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-110 text-black font-black text-sm shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Open Spin Wheel (Day {currentDay} of {MAX_SPIN_DAYS})
                  </button>
                )}

                {hasFirstDeposit && (
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-xs font-semibold text-gray-200 transition-colors cursor-pointer"
                  >
                    Open Spin Wheel
                  </button>
                )}
              </div>

              {spinError && (
                <p className="text-xs text-red-400 font-medium pt-1">
                  {spinError}
                </p>
              )}
            </div>

            {/* Right Mini Wheel Preview */}
            <div className="lg:col-span-4 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  if (hasFirstDeposit) {
                    setIsModalOpen(true);
                  } else {
                    handleDepositUnlock();
                  }
                }}
                className="group relative w-48 h-48 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                aria-label="Open First Deposit Spin Wheel"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/30 to-emerald-500/30 blur-xl group-hover:opacity-100 opacity-75 transition-opacity" />
                <svg
                  viewBox="0 0 360 360"
                  className="w-full h-full relative z-10"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 10}
                    fill="#0b0e14"
                    stroke="#fbbf24"
                    strokeWidth="6"
                  />
                  {SPIN_SEGMENTS.map((seg, i) => (
                    <path
                      key={seg.amount}
                      d={buildSlicePath(
                        cx,
                        cy,
                        radius,
                        i * SLICE_DEG,
                        (i + 1) * SLICE_DEG,
                      )}
                      fill={seg.gradStart}
                      stroke="rgba(255,255,255,0.18)"
                      strokeWidth="2"
                    />
                  ))}
                  <circle
                    cx={cx}
                    cy={cy}
                    r="42"
                    fill="#0b0e14"
                    stroke="#fbbf24"
                    strokeWidth="5"
                  />
                  <text
                    x={cx}
                    y={cy + 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fbbf24"
                    fontSize="18"
                    fontWeight="900"
                  >
                    SPIN
                  </text>
                </svg>
                {!hasFirstDeposit && (
                  <div className="absolute inset-0 z-20 rounded-full bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-amber-500/25 border border-amber-400/50 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-amber-300" />
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ================= 5-DAY SPIN CALENDAR (ONLY WHEN hasFirstDeposit === true) ================= */}
        {isLoggedIn && hasFirstDeposit && (
          <div className="bg-[#161a22] border border-white/[0.08] rounded-2xl p-5 md:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    5-Day Spin Calendar
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isAllCompleted
                      ? "All 5 daily bonus spins claimed!"
                      : remainingMs > 0
                        ? `Next spin unlocks in ${formatCountdown(remainingMs)} (24h cooldown)`
                        : `Day ${currentDay} spin is unlocked and ready now!`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold tabular-nums">
                  {completedCount} / {MAX_SPIN_DAYS} Days Claimed
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold tabular-nums">
                  Total: ${totalWonUsd} BTC
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: MAX_SPIN_DAYS }).map((_, idx) => {
                const dayNum = idx + 1;
                const record = spins[idx];
                const isClaimed = Boolean(record);
                const isNextDay =
                  !isAllCompleted && dayNum === completedCount + 1;
                const isReadyNow = isNextDay && remainingMs === 0;
                const isWaiting24h = isNextDay && remainingMs > 0;

                return (
                  <div
                    key={dayNum}
                    className={`relative rounded-2xl p-4 border transition-all flex flex-col justify-between min-h-[126px] ${
                      isClaimed
                        ? "bg-emerald-500/10 border-emerald-400/35"
                        : isReadyNow
                          ? "bg-amber-500/15 border-amber-400/60 shadow-lg shadow-amber-500/10"
                          : isWaiting24h
                            ? "bg-[#111622] border-amber-400/25"
                            : "bg-[#0e1118] border-white/[0.06] opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300">
                        Day {dayNum}
                      </span>
                      {isClaimed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isReadyNow ? (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      ) : isWaiting24h ? (
                        <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </div>

                    <div className="mt-3">
                      {isClaimed ? (
                        <>
                          <p className="text-lg font-black text-emerald-300 tabular-nums">
                            +${record.amount} BTC
                          </p>
                          <p className="text-[11px] text-emerald-400/80 font-medium mt-0.5">
                            Claimed
                          </p>
                        </>
                      ) : isReadyNow ? (
                        <>
                          <p className="text-sm font-black text-amber-300">
                            Ready to Spin!
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setJustWonDay(null);
                              setSpinError(null);
                              setIsModalOpen(true);
                            }}
                            className="mt-1.5 w-full py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold cursor-pointer transition-colors"
                          >
                            Spin Now
                          </button>
                        </>
                      ) : isWaiting24h ? (
                        <>
                          <p className="text-sm font-bold text-amber-300 tabular-nums">
                            {formatCountdown(remainingMs)}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Unlocks in 24h
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-400">
                            Up to $2,500
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Locked
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= REWARDS SUMMARY STATS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Your 5-Day Bonus Earned",
              value: totalWonUsd > 0 ? `$${totalWonUsd} BTC` : "Up to $2,500",
              sub: !isLoggedIn
                ? "Sign up & deposit to unlock"
                : !hasFirstDeposit
                  ? "Deposit to unlock Day 1 spin"
                  : isAllCompleted
                    ? "5/5 daily spins completed"
                    : remainingMs > 0
                      ? `Next spin in ${formatCountdown(remainingMs)}`
                      : `Day ${currentDay} of ${MAX_SPIN_DAYS} spin ready`,
            },
            {
              label: "Total Rewards Pool",
              value: "$125,000 / wk",
              sub: "Across eligible markets",
            },
            {
              label: "Your Liquidity Score",
              value: "0 pts",
              sub: "Place orders near midpoint",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5"
            >
              <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-emerald-400 mt-1 tabular-nums">
                {stat.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ================= SPIN WHEEL MODAL (ONLY WHEN hasFirstDeposit === true) ================= */}
        {isModalOpen && hasFirstDeposit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => !isSpinning && setIsModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[490px] rounded-3xl p-[1.5px] bg-gradient-to-b from-amber-400/60 via-emerald-400/30 to-white/10 shadow-[0_0_80px_rgba(245,158,11,0.22)]"
            >
              <div className="relative rounded-[23px] bg-[#0e121a] p-6 md:p-7 overflow-hidden">
                <div
                  className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-48 rounded-full opacity-30 blur-3xl"
                  style={{
                    background:
                      "radial-gradient(circle, #fbbf24 0%, #10b981 60%, transparent 80%)",
                  }}
                />

                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 z-30 p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.15] disabled:opacity-40 text-gray-300 transition-colors cursor-pointer"
                  aria-label="Close spin wheel modal"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="relative z-10 text-center space-y-1.5 mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5" />
                    Day {justWonDay ?? currentDay} of {MAX_SPIN_DAYS} · Bonus
                    Wheel
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Win up to{" "}
                    <span className="text-amber-400">$2,500 in BTC</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    $3 · $5 · $15 · $50 · $100 · $500 · $1,500 · $2,500
                  </p>
                </div>

                <div className="relative mx-auto w-[310px] h-[310px] sm:w-[340px] sm:h-[340px] flex items-center justify-center my-2">
                  <div
                    className={`absolute inset-2 rounded-full transition-opacity duration-500 blur-2xl ${
                      isSpinning
                        ? "bg-amber-400/35 opacity-100"
                        : "bg-amber-500/15 opacity-80"
                    }`}
                  />

                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_12px_rgba(251,191,36,0.65)]">
                    <svg width="36" height="38" viewBox="0 0 36 38">
                      <defs>
                        <linearGradient
                          id="pointerGold"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="55%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#b45309" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M18 35 L4 6 Q18 11 32 6 Z"
                        fill="url(#pointerGold)"
                        stroke="#090b10"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      <circle cx="18" cy="11" r="3" fill="#fffbeb" />
                    </svg>
                  </div>

                  <svg
                    viewBox="0 0 360 360"
                    className="absolute inset-0 w-full h-full z-20 pointer-events-none"
                  >
                    <defs>
                      <linearGradient id="rimMetal" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fde68a" />
                        <stop offset="40%" stopColor="#d97706" />
                        <stop offset="75%" stopColor="#78350f" />
                        <stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius + 14}
                      fill="none"
                      stroke="url(#rimMetal)"
                      strokeWidth="12"
                    />
                    {Array.from({ length: ledCount }).map((_, idx) => {
                      const pos = polarToCartesian(
                        cx,
                        cy,
                        radius + 14,
                        (idx * 360) / ledCount,
                      );
                      const active =
                        idx % 3 === ledTick % 3 ||
                        (justWonDay !== null && idx % 2 === ledTick % 2);
                      return (
                        <circle
                          key={idx}
                          cx={pos.x}
                          cy={pos.y}
                          r={active ? 3.8 : 2.6}
                          fill={
                            active
                              ? idx % 2 === 0
                                ? "#fef08a"
                                : "#34d399"
                              : "#451a03"
                          }
                        />
                      );
                    })}
                  </svg>

                  <div
                    className="relative z-10 w-full h-full rounded-full"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: isSpinning
                        ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.08, 0.88, 0.14, 1)`
                        : "none",
                    }}
                  >
                    <svg viewBox="0 0 360 360" className="w-full h-full">
                      <defs>
                        {SPIN_SEGMENTS.map((seg, idx) => (
                          <linearGradient
                            key={seg.amount}
                            id={`segGrad-${idx}`}
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="1"
                          >
                            <stop offset="0%" stopColor={seg.gradStart} />
                            <stop offset="100%" stopColor={seg.gradEnd} />
                          </linearGradient>
                        ))}
                        <radialGradient
                          id="glassSheen"
                          cx="35%"
                          cy="28%"
                          r="70%"
                        >
                          <stop
                            offset="0%"
                            stopColor="rgba(255,255,255,0.22)"
                          />
                          <stop
                            offset="55%"
                            stopColor="rgba(255,255,255,0.03)"
                          />
                          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
                        </radialGradient>
                        <radialGradient id="hubGold" cx="40%" cy="35%" r="65%">
                          <stop offset="0%" stopColor="#fef08a" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#92400e" />
                        </radialGradient>
                      </defs>

                      {SPIN_SEGMENTS.map((seg, idx) => {
                        const start = idx * SLICE_DEG;
                        const end = start + SLICE_DEG;
                        const mid = start + SLICE_DEG / 2;

                        return (
                          <g key={seg.amount}>
                            <path
                              d={buildSlicePath(cx, cy, radius, start, end)}
                              fill={`url(#segGrad-${idx})`}
                              stroke="rgba(255,255,255,0.22)"
                              strokeWidth="1.8"
                            />
                            <g transform={`rotate(${mid} ${cx} ${cy})`}>
                              <text
                                x={cx}
                                y={cy - radius * 0.69}
                                fill={seg.textColor}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={seg.amount >= 1000 ? "15" : "18"}
                                fontWeight="900"
                              >
                                {seg.label}
                              </text>
                              <text
                                x={cx}
                                y={cy - radius * 0.52}
                                fill={seg.subColor}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="9"
                                fontWeight="800"
                                letterSpacing="1"
                              >
                                BTC
                              </text>
                            </g>
                          </g>
                        );
                      })}

                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="url(#glassSheen)"
                        pointerEvents="none"
                      />

                      <circle
                        cx={cx}
                        cy={cy}
                        r="36"
                        fill="#0b0e14"
                        stroke="url(#hubGold)"
                        strokeWidth="5"
                      />
                      <circle cx={cx} cy={cy} r="24" fill="url(#hubGold)" />
                      <text
                        x={cx}
                        y={cy + 1}
                        fill="#090b10"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="13"
                        fontWeight="900"
                      >
                        ₿
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="relative z-20 mt-5 text-center space-y-3">
                  {spinError && (
                    <p className="text-xs text-red-400 font-medium">
                      {spinError}
                    </p>
                  )}

                  {justWonDay !== null ? (
                    <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 p-4 space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 text-emerald-300 font-black text-base">
                        <CheckCircle2 className="w-5 h-5" />
                        Day {justWonDay}: You Won ${ALWAYS_WIN_AMOUNT} in BTC!
                      </div>
                      <p className="text-xs text-gray-300 tabular-nums">
                        {isAllCompleted
                          ? `All ${MAX_SPIN_DAYS} days completed! Total earned: $${totalWonUsd} BTC.`
                          : `Come back in ${formatCountdown(remainingMs)} to spin Day ${currentDay}.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="mt-2 px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer"
                      >
                        View 5-Day Calendar
                      </button>
                    </div>
                  ) : isAllCompleted ? (
                    <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/40 p-4 space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 text-emerald-300 font-black text-base">
                        <CheckCircle2 className="w-5 h-5" />
                        All 5 Daily Spins Claimed!
                      </div>
                      <p className="text-xs text-gray-300">
                        Total BTC Bonus Earned: ${totalWonUsd.toLocaleString()}
                      </p>
                    </div>
                  ) : remainingMs > 0 ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        disabled
                        className="w-full py-3.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-amber-300 font-extrabold text-sm flex items-center justify-center gap-2 tabular-nums opacity-85 cursor-not-allowed"
                      >
                        <Clock className="w-4 h-4" />
                        Next Spin in {formatCountdown(remainingMs)}
                      </button>
                      <p className="text-[11px] text-gray-400">
                        Day {currentDay} of {MAX_SPIN_DAYS} unlocks 24 hours
                        after your last spin.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isSpinning}
                      onClick={triggerSpin}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-110 disabled:opacity-60 text-black font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isSpinning
                        ? "Spinning..."
                        : `SPIN DAY ${currentDay} & WIN BTC`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RewardsPage;
