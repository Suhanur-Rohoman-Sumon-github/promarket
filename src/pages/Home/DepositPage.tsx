import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

const MIN_DEPOSIT = 15;
const QUICK_AMOUNTS = [15, 25, 50, 100, 250];
const AUTH_STORAGE_KEY = "promarkets_demo_user";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app";

export default function DepositPage() {
  const navigate = useNavigate();
  const [amountUsd, setAmountUsd] = useState<string>("15");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const user = (() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT) {
      setError(`Minimum deposit is $${MIN_DEPOSIT}.00`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/deposit/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amount,
          userId: user?.email || user?.username || "guest",
        }),
      });

      console.log(res);

      const text = await res.text();
      const json = text ? JSON.parse(text) : {};

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Server error (${res.status})`);
      }

      if (!json.data?.invoiceUrl) {
        throw new Error("Invoice URL not returned by server");
      }

      window.location.href = json.data.invoiceUrl;
    } catch (err) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#0e1015] text-white px-4 py-10 flex justify-center items-start">
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
            <h1 className="text-xl font-bold text-white">Deposit Funds</h1>
            <p className="text-xs text-gray-400 mt-1">
              Enter the USD amount you want to deposit
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              Quick Select
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
            </div>
          </div>

          <div>
            <label
              htmlFor="deposit-amount"
              className="block text-xs font-semibold text-gray-300 mb-2"
            >
              Deposit Amount (USD)
            </label>
            <div className="relative flex items-center bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 focus-within:border-[#315cf5]">
              <span className="text-gray-400 font-semibold mr-1.5">$</span>
              <input
                id="deposit-amount"
                type="number"
                min={MIN_DEPOSIT}
                step="0.01"
                value={amountUsd}
                onChange={(e) => {
                  setAmountUsd(e.target.value);
                  setError("");
                }}
                placeholder="15.00"
                required
                className="w-full h-11 bg-transparent outline-none text-white font-semibold tabular-nums"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Minimum deposit:{" "}
              <span className="text-white font-semibold">$15.00</span>
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-400">
              {error}
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
                Generating NOWPayments Invoice...
              </>
            ) : (
              "Generate Invoice"
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            Powered by NOWPayments
          </div>
        </form>
      </div>
    </div>
  );
}
