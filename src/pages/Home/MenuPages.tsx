import React, { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Plug,
  Gift,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  HelpCircle,
  Activity,
  BookOpen,
  MessageSquare,
  Search,
  ChevronDown,
  Key,
  Send,
  ArrowUpRight,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

const GAMMA_API = "https://gamma-api.polymarket.com";

interface PageShellProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function PageShell({
  icon: Icon,
  iconColor = "text-blue-400",
  title,
  subtitle,
  children,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#0d1016] text-white py-8 px-4 md:px-6">
      <div className="max-w-[1160px] mx-auto space-y-6">
        <div className="flex items-start gap-3.5 border-b border-white/[0.07] pb-5">
          <div className="w-11 h-11 rounded-xl bg-[#161a22] border border-white/[0.08] flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ==================== 1. LEADERBOARD (RANDOMIZED) ==================== */
type LeaderboardTab = "Profit" | "Volume";
type LeaderboardPeriod = "Today" | "Weekly" | "Monthly" | "All";

interface LeaderboardRow {
  rank: number;
  name: string;
  addr: string;
  volumeNum: number;
  profitNum: number;
  volume: string;
  profit: string;
  winRate: string;
  avatarGrad: string;
}

const TRADER_PREFIXES = [
  "Alpha",
  "Macro",
  "Quant",
  "Poly",
  "Sigma",
  "Delta",
  "Sharp",
  "Apex",
  "Whale",
  "Edge",
  "Vortex",
  "Nova",
  "Kinetix",
  "Orbit",
  "Prime",
  "Zenith",
] as const;

const TRADER_SUFFIXES = [
  "Trader",
  "Seeker",
  "Desk",
  "Capital",
  "Bot",
  "Flow",
  "Mind",
  "Pro",
  "Vault",
  "Pulse",
  "King",
  "X",
] as const;

const AVATAR_GRADIENTS = [
  "from-blue-500 to-purple-500",
  "from-emerald-400 to-cyan-500",
  "from-amber-400 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-sky-400",
  "from-violet-500 to-fuchsia-500",
] as const;

function randomHex(len: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function formatUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function generateRandomLeaderboard(
  period: LeaderboardPeriod,
  count = 8,
): LeaderboardRow[] {
  const scale =
    period === "Today"
      ? 0.04
      : period === "Weekly"
        ? 0.16
        : period === "Monthly"
          ? 0.45
          : 1;

  const usedNames = new Set<string>();
  const rows: LeaderboardRow[] = [];

  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-useless-assignment
    let name = "";
    do {
      const p =
        TRADER_PREFIXES[Math.floor(Math.random() * TRADER_PREFIXES.length)];
      const s =
        TRADER_SUFFIXES[Math.floor(Math.random() * TRADER_SUFFIXES.length)];
      const num =
        Math.random() > 0.45 ? String(Math.floor(Math.random() * 90 + 10)) : "";
      name = `${p}${s}${num}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const volumeNum = Math.round(
      (2_500_000 + Math.random() * 45_000_000) * scale,
    );
    const profitRatio = 0.08 + Math.random() * 0.16;
    const profitNum = Math.round(volumeNum * profitRatio);
    const winRate = `${Math.floor(56 + Math.random() * 26)}%`;
    const addr = `0x${randomHex(4)}...${randomHex(4)}`;
    const avatarGrad =
      AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)];

    rows.push({
      rank: i + 1,
      name,
      addr,
      volumeNum,
      profitNum,
      volume: formatUsdCompact(volumeNum),
      profit: `+$${profitNum.toLocaleString()}`,
      winRate,
      avatarGrad,
    });
  }

  return rows;
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardTab>("Profit");
  const [period, setPeriod] = useState<LeaderboardPeriod>("All");
  const [rows, setRows] = useState<LeaderboardRow[]>(() =>
    generateRandomLeaderboard("All"),
  );

  const handlePeriodChange = (p: LeaderboardPeriod) => {
    setPeriod(p);
    setRows(generateRandomLeaderboard(p));
  };

  const sortedRows = useMemo(() => {
    return [...rows]
      .sort((a, b) =>
        tab === "Profit"
          ? b.profitNum - a.profitNum
          : b.volumeNum - a.volumeNum,
      )
      .map((row, idx) => ({ ...row, rank: idx + 1 }));
  }, [rows, tab]);

  return (
    <PageShell
      icon={Trophy}
      iconColor="text-amber-400"
      title="Leaderboard"
      subtitle="Top traders ranked by realized profit and trading volume."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-[#161a22] border border-white/[0.07] rounded-xl p-1">
          {(["Profit", "Volume"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t
                  ? "bg-[#2c3340] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {(["Today", "Weekly", "Monthly", "All"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p
                  ? "bg-white/[0.12] text-white"
                  : "bg-[#161a22] text-gray-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRows(generateRandomLeaderboard(period))}
            title="Refresh rankings"
            className="p-2 rounded-lg bg-[#161a22] text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold text-gray-400 border-b border-white/[0.07]">
          <span className="col-span-1">Rank</span>
          <span className="col-span-5">Trader</span>
          <span className="col-span-2 text-right">Volume</span>
          <span className="col-span-2 text-right">Win Rate</span>
          <span className="col-span-2 text-right">{tab}</span>
        </div>

        <div className="divide-y divide-white/[0.05]">
          {sortedRows.map((row) => (
            <div
              key={`${row.name}-${row.addr}`}
              className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
            >
              <span className="col-span-1 font-bold text-sm tabular-nums text-gray-300">
                #{row.rank}
              </span>
              <div className="col-span-5 flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${row.avatarGrad} shrink-0`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {row.name}
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {row.addr}
                  </p>
                </div>
              </div>
              <span className="col-span-2 text-right text-sm text-gray-300 tabular-nums">
                {row.volume}
              </span>
              <span className="col-span-2 text-right text-sm text-gray-300 tabular-nums">
                {row.winRate}
              </span>
              <span className="col-span-2 text-right text-sm font-bold text-emerald-400 tabular-nums">
                {tab === "Profit" ? row.profit : row.volume}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/* ==================== 2. REWARDS (FIRST DEPOSIT BTC SPIN) ==================== */

/* ==================== 3. APIs ==================== */
export function ApisPage() {
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("pm_live_demo_8f39a1c4e9b2");
  const [testResult, setTestResult] = useState<string>("");

  const copyText = (txt: string, id: string) => {
    navigator.clipboard?.writeText(txt);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const runLiveTest = async () => {
    setTestResult("Fetching...");
    try {
      const res = await fetch(`${GAMMA_API}/events?limit=1&active=true`);
      const data = (await res.json()) as Array<{
        title?: string;
        volume?: number;
      }>;
      setTestResult(
        JSON.stringify(
          data[0]?.title
            ? { title: data[0].title, volume: data[0].volume }
            : data,
          null,
          2,
        ),
      );
    } catch (e) {
      setTestResult(
        `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  };

  return (
    <PageShell
      icon={Plug}
      iconColor="text-pink-400"
      title="APIs"
      subtitle="Programmatic access to live Polymarket events, orderbooks, and CLOB price feeds."
    >
      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Demo API Key
          </p>
          <p className="text-sm font-mono text-white mt-1">{apiKey}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copyText(apiKey, "key")}
            className="px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold flex items-center gap-1.5"
          >
            {copiedKey === "key" ? <Check size={14} /> : <Copy size={14} />}
            {copiedKey === "key" ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() =>
              setApiKey(`pm_live_${Math.random().toString(36).slice(2, 14)}`)
            }
            className="px-3.5 py-2 rounded-xl bg-[#315cf5] hover:bg-[#416bff] text-xs font-semibold flex items-center gap-1.5"
          >
            <Key size={14} /> Regenerate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            name: "Gamma Markets API",
            url: "https://gamma-api.polymarket.com/events?active=true&limit=20",
            desc: "Events, tags, volumes, and search queries.",
          },
          {
            name: "CLOB Price History API",
            url: "https://clob.polymarket.com/prices-history?market=<TOKEN_ID>&interval=1w",
            desc: "Historical probability ticks & real-time orderbook prices.",
          },
        ].map((ep) => (
          <div
            key={ep.name}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 space-y-2.5"
          >
            <h3 className="font-bold text-white text-sm">{ep.name}</h3>
            <p className="text-xs text-gray-400">{ep.desc}</p>
            <div className="bg-[#0e1015] border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between gap-2">
              <code className="text-[11px] text-blue-300 truncate">
                {ep.url}
              </code>
              <button
                type="button"
                onClick={() => copyText(ep.url, ep.name)}
                className="text-gray-400 hover:text-white shrink-0"
              >
                {copiedKey === ep.name ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Live Endpoint Tester</h3>
          <button
            type="button"
            onClick={runLiveTest}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
          >
            Test Gamma API
          </button>
        </div>
        {testResult && (
          <pre className="bg-[#0e1015] border border-white/[0.06] rounded-xl p-3 text-xs text-emerald-300 overflow-x-auto">
            {testResult}
          </pre>
        )}
      </div>
    </PageShell>
  );
}

/* ==================== 4. REFER & EARN ==================== */
export function ReferPage() {
  const [copied, setCopied] = useState<boolean>(false);
  const refLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=su9854`
      : "";

  return (
    <PageShell
      icon={Gift}
      iconColor="text-purple-400"
      title="Refer & Earn"
      subtitle="Invite friends and earn 10% of trading fees plus bonus reward multipliers."
    >
      <div className="bg-gradient-to-r from-[#19162b] via-[#161a22] to-[#161a22] border border-purple-500/30 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Your Referral Link</h2>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            readOnly
            value={refLink}
            className="flex-1 bg-[#0d1016] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 font-mono outline-none"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(refLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#315cf5] hover:bg-[#416bff] text-sm font-bold flex items-center justify-center gap-2"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Friends Invited", value: "0" },
          { label: "Referred Volume", value: "$0.00" },
          { label: "Total Earned", value: "$0.00" },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5"
          >
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* ==================== 5. BUILDERS ==================== */
export function BuildersPage() {
  return (
    <PageShell
      icon={Terminal}
      iconColor="text-gray-300"
      title="Builders"
      subtitle="Build bots, analytics dashboards, and custom trading terminals on top of prediction markets."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Builder Rebates",
            desc: "Earn fee shares on every matched order routed through your app.",
          },
          {
            title: "Gasless Relayer",
            desc: "Sponsor transactions seamlessly for your users with relayer keys.",
          },
          {
            title: "Real-Time WebSockets",
            desc: "Sub-100ms orderbook diffs and trade stream subscriptions.",
          },
        ].map((b) => (
          <div
            key={b.title}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 space-y-2"
          >
            <h3 className="font-bold text-white">{b.title}</h3>
            <p className="text-xs text-gray-400 leading-relaxed">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold">Quick Start SDK</h3>
        <pre className="bg-[#0e1015] border border-white/[0.06] rounded-xl p-4 text-xs text-blue-300 overflow-x-auto">
          {`npm install @polymarket/clob-client ethers

const res = await fetch("https://gamma-api.polymarket.com/events?active=true&limit=20");
const markets = await res.json();`}
        </pre>
      </div>
    </PageShell>
  );
}

/* ==================== 6. ACCURACY ==================== */
export function AccuracyPage() {
  const stats = [
    { label: "4 Hours Before Resolution", value: "94.2%" },
    { label: "1 Day Before Resolution", value: "91.8%" },
    { label: "1 Week Before Resolution", value: "88.5%" },
    { label: "Brier Score (Lower is Better)", value: "0.084" },
  ];

  return (
    <PageShell
      icon={CheckCircle2}
      iconColor="text-emerald-400"
      title="Accuracy"
      subtitle="Historical calibration & forecasting performance across resolved markets."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5"
          >
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5">
        <h3 className="text-sm font-bold mb-3">
          Calibration Curve (Predicted vs Actual Outcome)
        </h3>
        <svg viewBox="0 0 600 200" className="w-full h-48">
          <line
            x1="40"
            y1="170"
            x2="560"
            y2="20"
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4 4"
          />
          <path
            d="M 40 168 Q 170 135 300 95 T 560 22"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x="45" y="188" fill="#9ca3af" fontSize="11">
            0% Predicted
          </text>
          <text x="275" y="188" fill="#9ca3af" fontSize="11">
            50%
          </text>
          <text x="515" y="188" fill="#9ca3af" fontSize="11">
            100%
          </text>
        </svg>
      </div>
    </PageShell>
  );
}

/* ==================== 7. SUPPORT ==================== */
export function SupportPage() {
  const [subject, setSubject] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!subject.trim() || !msg.trim()) return;
    setSent(true);
    setSubject("");
    setMsg("");
  };

  return (
    <PageShell
      icon={MessageSquare}
      iconColor="text-blue-400"
      title="Support"
      subtitle="Need help with a deposit, order, or market resolution? Message our team."
    >
      <div className="max-w-xl bg-[#161a22] border border-white/[0.07] rounded-2xl p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Deposit pending)"
            className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <textarea
            rows={4}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Describe your issue..."
            className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#315cf5] hover:bg-[#416bff] text-sm font-bold inline-flex items-center gap-2"
          >
            <Send size={15} /> Submit Ticket
          </button>
          {sent && (
            <p className="text-xs text-emerald-400">
              Support ticket submitted! Our team typically replies within 2
              hours.
            </p>
          )}
        </form>
      </div>
    </PageShell>
  );
}

/* ==================== 8. STATUS ==================== */
export function StatusPage() {
  const [latency, setLatency] = useState<number | "Offline" | null>(null);

  useEffect(() => {
    const start = performance.now();
    fetch(`${GAMMA_API}/events?limit=1`)
      .then((r) => {
        if (r.ok) setLatency(Math.round(performance.now() - start));
      })
      .catch(() => setLatency("Offline"));
  }, []);

  const services = [
    {
      name: "Gamma Markets API",
      status: latency === "Offline" ? "Degraded" : "Operational",
      ping:
        latency === null
          ? "Checking..."
          : typeof latency === "number"
            ? `${latency}ms`
            : latency,
    },
    { name: "CLOB Matching Engine", status: "Operational", ping: "42ms" },
    { name: "WebSocket Live Feed", status: "Operational", ping: "18ms" },
    { name: "Deposits & Settlements", status: "Operational", ping: "Normal" },
  ];

  return (
    <PageShell
      icon={Activity}
      iconColor="text-emerald-400"
      title="System Status"
      subtitle="Real-time health and latency across trading infrastructure."
    >
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-sm flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        All Systems Operational
      </div>

      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl divide-y divide-white/[0.06]">
        {services.map((s) => (
          <div key={s.name} className="p-4 flex items-center justify-between">
            <span className="font-semibold text-sm text-white">{s.name}</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-400 tabular-nums">{s.ping}</span>
              <span className="text-emerald-400 font-bold">{s.status}</span>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* ==================== 9. DOCUMENTATION ==================== */
const DOC_TOPICS = {
  Overview:
    "Promarkets aggregates live prediction market events where shares trade between $0.01 and $0.99 and resolve to $1.00 if the outcome occurs.",
  "Order Types":
    "Place instant Market orders at best available liquidity or resting Limit orders to qualify for daily liquidity rewards.",
  "Gamma API":
    "Query https://gamma-api.polymarket.com/events with active=true, closed=false, limit, and offset for paginated markets.",
  Resolution:
    "Markets resolve strictly according to the published resolution rules using verified public primary sources.",
} as const;

type DocTopicKey = keyof typeof DOC_TOPICS;

export function DocumentationPage() {
  const [topic, setTopic] = useState<DocTopicKey>("Overview");

  return (
    <PageShell
      icon={BookOpen}
      iconColor="text-blue-400"
      title="Documentation"
      subtitle="Platform guides, trading mechanics, and API specifications."
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-3 space-y-1">
          {(Object.keys(DOC_TOPICS) as DocTopicKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTopic(k)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                topic === k
                  ? "bg-[#1c2029] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="md:col-span-9 bg-[#161a22] border border-white/[0.07] rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold">{topic}</h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            {DOC_TOPICS[topic]}
          </p>
        </div>
      </div>
    </PageShell>
  );
}

/* ==================== 10. HELP CENTER ==================== */
export function HelpCenterPage() {
  const [q, setQ] = useState<string>("");
  const [openIdx, setOpenIdx] = useState<number>(0);

  const faqs = [
    {
      q: "How do shares work?",
      a: "Each Yes or No share trades between 1¢ and 99¢ and settles for $1.00 if correct, or $0.00 otherwise.",
    },
    {
      q: "Can I sell before a market resolves?",
      a: "Yes! You can sell your shares at the current market price anytime before resolution.",
    },
    {
      q: "How are prices determined?",
      a: "Prices reflect real-time supply and demand on the central limit orderbook (e.g., 65¢ = 65% implied probability).",
    },
    {
      q: "Are there any trading fees?",
      a: "Standard prediction markets charge zero maker fees, letting limit order traders earn liquidity rewards.",
    },
  ].filter((f) => f.q.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageShell
      icon={HelpCircle}
      iconColor="text-cyan-400"
      title="Help Center"
      subtitle="Frequently asked questions and quick trading tutorials."
    >
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help articles..."
          className="w-full bg-[#161a22] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2.5">
        {faqs.map((f, idx) => (
          <div
            key={f.q}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
              className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm"
            >
              <span>{f.q}</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${openIdx === idx ? "rotate-180" : ""}`}
              />
            </button>
            {openIdx === idx && (
              <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed">
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* ==================== 11. TRUST & SAFETY HUB ==================== */
export function TrustSafetyPage() {
  return (
    <PageShell
      icon={ShieldCheck}
      iconColor="text-emerald-400"
      title="Trust & Safety Hub"
      subtitle="Market integrity, smart contract security, and transparent resolution standards."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: "Non-Custodial Settlements",
            desc: "Funds settle transparently on-chain with verifiable smart contract proofs.",
          },
          {
            title: "Independent Audits",
            desc: "Core exchange contracts undergo regular third-party security audits.",
          },
          {
            title: "Anti-Manipulation Monitoring",
            desc: "Automated surveillance detects wash trading and abnormal orderbook activity.",
          },
          {
            title: "Clear Resolution Criteria",
            desc: "Every market publishes explicit primary sources and edge-case rules upfront.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-5 space-y-1.5"
          >
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              {item.title} <ArrowUpRight size={14} className="text-gray-400" />
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/* ==================== 12. TERMS OF USE ==================== */
export function TermsPage() {
  return (
    <PageShell
      icon={FileText}
      iconColor="text-gray-300"
      title="Terms of Use"
      subtitle="Last updated: November 2026"
    >
      <div className="bg-[#161a22] border border-white/[0.07] rounded-2xl p-6 space-y-4 text-xs text-gray-300 leading-relaxed">
        <section>
          <h3 className="text-sm font-bold text-white mb-1">
            1. Acceptance of Terms
          </h3>
          <p>
            By accessing or using Promarkets, you agree to comply with these
            Terms of Use and all applicable laws in your jurisdiction.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-white mb-1">
            2. Risk Disclosure
          </h3>
          <p>
            Prediction market trading involves financial risk. Share prices
            fluctuate based on market sentiment and may settle at $0.00.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-white mb-1">
            3. Market Resolution
          </h3>
          <p>
            All markets settle strictly according to the resolution criteria
            displayed on each event detail page.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
