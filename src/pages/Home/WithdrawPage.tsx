import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

const MIN_WITHDRAW = 30;
const QUICK_AMOUNTS = [30, 50, 100, 250];
const AUTH_STORAGE_KEY = "promarkets_demo_user";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

const COINS = [
  { id: "USDT_TRC20", name: "USDT", network: "TRC20" },
  { id: "USDT_ERC20", name: "USDT", network: "ERC20" },
  { id: "ETH", name: "Ethereum", network: "ETH" },
  { id: "BTC", name: "Bitcoin", network: "BTC" },
  { id: "LTC", name: "Litecoin", network: "LTC" },
  { id: "SOL", name: "Solana", network: "SOL" },
] as const;

interface WithdrawRecord {
  withdrawId: string;
  amountUsd: number;
  coin: string;
  walletAddress: string;
  status: string;
  createdAt: string;
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

export default function WithdrawPage() {
  const navigate = useNavigate();
  const userEmail = getStoredEmail();

  const [cash, setCash] = useState<number>(0);
  const [coin, setCoin] = useState<string>("USDT_TRC20");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState<string>("30");
  const [history, setHistory] = useState<WithdrawRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    if (!userEmail) return;

    fetch(`${API_BASE}/users/${encodeURIComponent(userEmail)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setCash(Number(json.data.cash) || 0);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/withdraw/user/${encodeURIComponent(userEmail)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setHistory(json.data);
        }
      })
      .catch(() => {});
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!userEmail) {
      setError("Please log in first to withdraw funds.");
      return;
    }

    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
      setError(`Minimum withdraw is $${MIN_WITHDRAW}.00`);
      return;
    }

    if (amount > cash) {
      setError("Insufficient cash balance.");
      return;
    }

    if (!walletAddress.trim() || walletAddress.trim().length < 10) {
      setError("Please enter a valid receiving wallet address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/withdraw/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          amountUsd: amount,
          coin,
          walletAddress: walletAddress.trim(),
        }),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Server error (${res.status})`);
      }

      setCash(Number(json.data.cash) || 0);
      setHistory((prev) => [json.data.withdraw, ...prev]);
      setWalletAddress("");
      setSuccessMsg(
        `Withdrawal of ${formatUsd(amount)} via ${coin.replace("_", " ")} submitted!`,
      );

      // Refresh Navbar balance
      window.dispatchEvent(new Event("promarkets-auth-change"));
    } catch (err) {
      setError((err as Error).message || "Failed to submit withdrawal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#0e1015] text-white px-4 py-10 flex flex-col items-center gap-6">
      <div className="w-full max-w-md bg-[#161922] border border-[#2a2e39] rounded-2xl p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Withdraw Funds</h1>
            <p className="text-xs text-gray-400 mt-1">
              Minimum withdraw:{" "}
              <span className="text-white font-semibold">$30.00</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400">Available Cash</p>
            <p className="text-sm font-bold text-[#22c55e] tabular-nums">
              {formatUsd(cash)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Coin Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Select Coin
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCoin(c.id);
                    setError("");
                  }}
                  className={`py-2.5 px-2 rounded-xl text-left border transition-colors ${
                    coin === c.id
                      ? "bg-[#315cf5]/20 border-[#315cf5] text-white"
                      : "bg-[#1b1e27] border-[#2d313d] text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{c.name}</p>
                  <p className="text-[10px] text-gray-400">{c.network}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Wallet Address */}
          <div>
            <label
              htmlFor="wallet-address"
              className="block text-xs font-semibold text-gray-300 mb-2"
            >
              Receiving {coin.replace("_", " ")} Address
            </label>
            <input
              id="wallet-address"
              type="text"
              value={walletAddress}
              onChange={(e) => {
                setWalletAddress(e.target.value);
                setError("");
              }}
              placeholder={`Enter your ${coin.replace("_", " ")} wallet address`}
              required
              className="w-full h-11 bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 text-sm text-white outline-none focus:border-[#315cf5]"
            />
          </div>

          {/* Quick Amounts */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Quick Amount
            </label>
            <div className="grid grid-cols-5 gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setAmountUsd(String(amt));
                    setError("");
                  }}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    Number(amountUsd) === amt
                      ? "bg-[#315cf5] border-[#315cf5] text-white"
                      : "bg-[#1b1e27] border-[#2d313d] text-gray-300 hover:border-gray-500"
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAmountUsd(cash > 0 ? String(cash) : "30");
                  setError("");
                }}
                className="py-2 rounded-xl text-xs font-semibold border bg-[#1b1e27] border-[#2d313d] text-gray-300 hover:border-gray-500 transition-colors"
              >
                Max
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="withdraw-amount"
              className="block text-xs font-semibold text-gray-300 mb-2"
            >
              Withdraw Amount (USD)
            </label>
            <div className="relative flex items-center bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 focus-within:border-[#315cf5]">
              <span className="text-gray-400 font-semibold mr-1.5">$</span>
              <input
                id="withdraw-amount"
                type="number"
                min={MIN_WITHDRAW}
                step="0.01"
                value={amountUsd}
                onChange={(e) => {
                  setAmountUsd(e.target.value);
                  setError("");
                }}
                placeholder="30.00"
                required
                className="w-full h-11 bg-transparent outline-none text-white font-semibold tabular-nums"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Minimum amount:{" "}
              <span className="text-white font-semibold">$30.00</span>
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#315cf5] hover:bg-[#416bff] disabled:opacity-60 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing Withdrawal...
              </>
            ) : (
              "Request Withdraw"
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Crypto payouts sent directly to your wallet
          </div>
        </form>
      </div>

      {/* Recent Withdrawals */}
      {history.length > 0 && (
        <div className="w-full max-w-md bg-[#161922] border border-[#2a2e39] rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-bold text-white mb-3">
            Recent Withdrawals
          </h2>
          <div className="space-y-2.5">
            {history.map((item) => (
              <div
                key={item.withdrawId}
                className="flex items-center justify-between bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {formatUsd(item.amountUsd)} • {item.coin.replace("_", " ")}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate max-w-[220px]">
                    {item.walletAddress}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 capitalize shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
