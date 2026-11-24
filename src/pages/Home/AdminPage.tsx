/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

type TabType = "dashboard" | "withdraws" | "deposits" | "users";

interface AdminStats {
  totalDepositUsd: number;
  totalDepositCount: number;
  pendingDepositCount: number;
  totalWithdrawUsd: number;
  totalWithdrawCount: number;
  pendingWithdrawCount: number;
  totalUsers: number;
  verifiedUsersCount: number;
}

interface DepositItem {
  _id: string;
  orderId: string;
  invoiceId: string;
  invoiceUrl?: string | null;
  paymentId?: string | null;
  userId: string;
  amountUsd: number;
  status: string;
  credited: boolean;
  createdAt: string;
}

interface WithdrawItem {
  _id: string;
  withdrawId: string;
  email: string;
  amountUsd: number;
  coin: string;
  walletAddress: string;
  status: "pending" | "processing" | "completed" | "rejected";
  createdAt: string;
}

interface UserItem {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  isVerified: boolean;
  verificationStatus?: string;
  cash: number;
  portfolio: number;
  createdAt: string;
}

function formatUsd(val: number | undefined): string {
  const num = Number(val) || 0;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const styles =
    s === "completed" || s === "finished" || s === "verified"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : s === "processing" || s === "confirming"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
        : s === "rejected" || s === "failed" || s === "expired"
          ? "bg-red-500/15 text-red-400 border-red-500/30"
          : "bg-amber-500/15 text-amber-400 border-amber-500/30";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [stats, setStats] = useState<AdminStats>({
    totalDepositUsd: 0,
    totalDepositCount: 0,
    pendingDepositCount: 0,
    totalWithdrawUsd: 0,
    totalWithdrawCount: 0,
    pendingWithdrawCount: 0,
    totalUsers: 0,
    verifiedUsersCount: 0,
  });
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [wdFilter, setWdFilter] = useState<string>("all");
  const [dpFilter, setDpFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editCash, setEditCash] = useState<string>("");

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/overview`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load admin data");
      }
      setStats(json.data.stats);
      setDeposits(json.data.deposits || []);
      setWithdraws(json.data.withdraws || []);
      setUsers(json.data.users || []);
    } catch (err) {
      setError((err as Error).message || "Error loading admin overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleWithdrawStatus = async (
    withdrawId: string,
    status: "processing" | "completed" | "rejected",
  ) => {
    setActionId(withdrawId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/withdraw/${withdrawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update withdraw");
      }
      await fetchOverview();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleDepositAction = async (
    orderId: string,
    action: "credit" | "fail",
  ) => {
    setActionId(orderId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/deposit/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update deposit");
      }
      await fetchOverview();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleSaveUserCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionId(editingUser.email);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(editingUser.email)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cash: Number(editCash) }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update user");
      }
      setEditingUser(null);
      await fetchOverview();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const q = search.trim().toLowerCase();

  const filteredWithdraws = useMemo(() => {
    return withdraws.filter((w) => {
      const matchesStatus = wdFilter === "all" || w.status === wdFilter;
      const matchesSearch =
        !q ||
        w.email.toLowerCase().includes(q) ||
        w.withdrawId.toLowerCase().includes(q) ||
        w.walletAddress.toLowerCase().includes(q) ||
        w.coin.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [withdraws, wdFilter, q]);

  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      const matchesStatus = dpFilter === "all" || d.status === dpFilter;
      const matchesSearch =
        !q ||
        d.userId.toLowerCase().includes(q) ||
        d.orderId.toLowerCase().includes(q) ||
        d.invoiceId.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [deposits, dpFilter, q]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.city || "").toLowerCase().includes(q) ||
        (u.state || "").toLowerCase().includes(q)
      );
    });
  }, [users, q]);

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#0e1015] text-white px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Overview of deposits, withdrawal requests, and registered users
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== "dashboard" && (
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email, ID, address..."
                  className="bg-[#161922] border border-[#2a2e39] rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-[#315cf5] w-56"
                />
              </div>
            )}

            <button
              type="button"
              onClick={fetchOverview}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161922] border border-[#2a2e39] hover:bg-[#1e222e] text-xs font-semibold text-gray-200 transition-colors"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#262a34] pb-3">
          {[
            {
              id: "dashboard",
              label: "Dashboard",
              icon: LayoutDashboard,
            },
            {
              id: "withdraws",
              label: `WD Requests (${stats.totalWithdrawCount})`,
              icon: ArrowUpRight,
              badge: stats.pendingWithdrawCount,
            },
            {
              id: "deposits",
              label: `DP Requests (${stats.totalDepositCount})`,
              icon: ArrowDownLeft,
              badge: stats.pendingDepositCount,
            },
            {
              id: "users",
              label: `Users (${stats.totalUsers})`,
              icon: Users,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSearch("");
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#315cf5] text-white"
                    : "bg-[#161922] border border-[#2a2e39] text-gray-300 hover:text-white hover:bg-[#1d212d]"
                }`}
              >
                <Icon size={15} />
                {tab.label}
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading && deposits.length === 0 && withdraws.length === 0 ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-[#315cf5]" size={28} />
          </div>
        ) : (
          <>
            {/* ================= DASHBOARD TAB ================= */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                      <span>Total Deposit (DP)</span>
                      <ArrowDownLeft size={16} className="text-emerald-400" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                      {formatUsd(stats.totalDepositUsd)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {stats.totalDepositCount} total •{" "}
                      {stats.pendingDepositCount} waiting
                    </p>
                  </div>

                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                      <span>Total Withdraw (WD)</span>
                      <ArrowUpRight size={16} className="text-amber-400" />
                    </div>
                    <p className="text-2xl font-bold text-amber-400 tabular-nums">
                      {formatUsd(stats.totalWithdrawUsd)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {stats.totalWithdrawCount} total •{" "}
                      {stats.pendingWithdrawCount} pending
                    </p>
                  </div>

                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                      <span>Total Users</span>
                      <Users size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {stats.totalUsers}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {stats.verifiedUsersCount} verified accounts
                    </p>
                  </div>

                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
                      <span>Net Platform Balance</span>
                      <Wallet size={16} className="text-purple-400" />
                    </div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {formatUsd(
                        stats.totalDepositUsd - stats.totalWithdrawUsd,
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Total DP minus Total WD
                    </p>
                  </div>
                </div>

                {/* Recent WD + DP Previews */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-white">
                        Latest WD Requests
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab("withdraws")}
                        className="text-xs text-blue-400 hover:underline font-semibold"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {withdraws.slice(0, 5).map((w) => (
                        <div
                          key={w._id}
                          className="flex items-center justify-between bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {w.email}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {w.coin.replace("_", " ")} •{" "}
                              {formatDate(w.createdAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-bold text-white tabular-nums mb-1">
                              {formatUsd(w.amountUsd)}
                            </p>
                            <StatusBadge status={w.status} />
                          </div>
                        </div>
                      ))}
                      {withdraws.length === 0 && (
                        <p className="text-xs text-gray-400">
                          No withdrawal requests yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-white">
                        Latest DP Requests
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab("deposits")}
                        className="text-xs text-blue-400 hover:underline font-semibold"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {deposits.slice(0, 5).map((d) => (
                        <div
                          key={d._id}
                          className="flex items-center justify-between bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3.5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {d.userId}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              #{d.invoiceId} • {formatDate(d.createdAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-bold text-white tabular-nums mb-1">
                              {formatUsd(d.amountUsd)}
                            </p>
                            <StatusBadge status={d.status} />
                          </div>
                        </div>
                      ))}
                      {deposits.length === 0 && (
                        <p className="text-xs text-gray-400">
                          No deposit requests yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= WITHDRAW REQUESTS TAB ================= */}
            {activeTab === "withdraws" && (
              <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">
                    Withdraw Requests ({filteredWithdraws.length})
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "all",
                      "pending",
                      "processing",
                      "completed",
                      "rejected",
                    ].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setWdFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                          wdFilter === st
                            ? "bg-[#315cf5] text-white"
                            : "bg-[#1b1e27] text-gray-300 hover:text-white"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-400 border-b border-[#262a34]">
                      <tr>
                        <th className="py-3 pr-4">WD ID / Date</th>
                        <th className="py-3 pr-4">User Email</th>
                        <th className="py-3 pr-4">Coin</th>
                        <th className="py-3 pr-4">Wallet Address</th>
                        <th className="py-3 pr-4">Amount</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222631]">
                      {filteredWithdraws.map((w) => (
                        <tr key={w._id} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4">
                            <p className="font-mono text-white">
                              {w.withdrawId}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {formatDate(w.createdAt)}
                            </p>
                          </td>
                          <td className="py-3 pr-4 font-medium text-white">
                            {w.email}
                          </td>
                          <td className="py-3 pr-4 font-semibold text-blue-400">
                            {w.coin.replace("_", " ")}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-300 max-w-[170px] truncate">
                                {w.walletAddress}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopy(w.withdrawId, w.walletAddress)
                                }
                                className="text-gray-400 hover:text-white"
                                title="Copy address"
                              >
                                {copiedId === w.withdrawId ? (
                                  <Check
                                    size={13}
                                    className="text-emerald-400"
                                  />
                                ) : (
                                  <Copy size={13} />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-bold text-white tabular-nums">
                            {formatUsd(w.amountUsd)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={w.status} />
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {w.status === "pending" && (
                                <button
                                  type="button"
                                  disabled={actionId === w.withdrawId}
                                  onClick={() =>
                                    handleWithdrawStatus(
                                      w.withdrawId,
                                      "processing",
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-semibold"
                                >
                                  Process
                                </button>
                              )}
                              {w.status !== "completed" &&
                                w.status !== "rejected" && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={actionId === w.withdrawId}
                                      onClick={() =>
                                        handleWithdrawStatus(
                                          w.withdrawId,
                                          "completed",
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionId === w.withdrawId}
                                      onClick={() =>
                                        handleWithdrawStatus(
                                          w.withdrawId,
                                          "rejected",
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 font-semibold"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredWithdraws.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-gray-400"
                          >
                            No withdraw requests found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================= DEPOSIT REQUESTS TAB ================= */}
            {activeTab === "deposits" && (
              <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-white">
                    Deposit Requests ({filteredDeposits.length})
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {["all", "waiting", "confirming", "finished", "failed"].map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setDpFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                            dpFilter === st
                              ? "bg-[#315cf5] text-white"
                              : "bg-[#1b1e27] text-gray-300 hover:text-white"
                          }`}
                        >
                          {st}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-400 border-b border-[#262a34]">
                      <tr>
                        <th className="py-3 pr-4">Order ID / Date</th>
                        <th className="py-3 pr-4">User</th>
                        <th className="py-3 pr-4">Invoice ID</th>
                        <th className="py-3 pr-4">Amount</th>
                        <th className="py-3 pr-4">Credited</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222631]">
                      {filteredDeposits.map((d) => (
                        <tr key={d._id} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4">
                            <p className="font-mono text-white max-w-[200px] truncate">
                              {d.orderId}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {formatDate(d.createdAt)}
                            </p>
                          </td>
                          <td className="py-3 pr-4 font-medium text-white">
                            {d.userId}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-gray-300">
                                {d.invoiceId}
                              </span>
                              {d.invoiceUrl && (
                                <a
                                  href={d.invoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                  title="Open NOWPayments invoice"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-bold text-white tabular-nums">
                            {formatUsd(d.amountUsd)}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={
                                d.credited
                                  ? "text-emerald-400 font-semibold"
                                  : "text-gray-400"
                              }
                            >
                              {d.credited ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="py-3 text-right">
                            {!d.credited && d.status !== "failed" && (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={actionId === d.orderId}
                                  onClick={() =>
                                    handleDepositAction(d.orderId, "credit")
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold"
                                >
                                  Credit
                                </button>
                                <button
                                  type="button"
                                  disabled={actionId === d.orderId}
                                  onClick={() =>
                                    handleDepositAction(d.orderId, "fail")
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 font-semibold"
                                >
                                  Fail
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredDeposits.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-gray-400"
                          >
                            No deposit requests found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================= USERS TAB ================= */}
            {activeTab === "users" && (
              <div className="bg-[#161922] border border-[#2a2e39] rounded-2xl p-5 space-y-4">
                <h2 className="text-base font-bold text-white">
                  Users ({filteredUsers.length})
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-400 border-b border-[#262a34]">
                      <tr>
                        <th className="py-3 pr-4">User</th>
                        <th className="py-3 pr-4">Email</th>
                        <th className="py-3 pr-4">Location</th>
                        <th className="py-3 pr-4">Verified</th>
                        <th className="py-3 pr-4">Cash</th>
                        <th className="py-3 pr-4">Joined</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222631]">
                      {filteredUsers.map((u) => (
                        <tr key={u._id} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-semibold text-white">
                            {u.username ||
                              `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                              "-"}
                          </td>
                          <td className="py-3 pr-4 text-gray-300">{u.email}</td>
                          <td className="py-3 pr-4 text-gray-400">
                            {[u.city, u.state, u.zip]
                              .filter(Boolean)
                              .join(", ") || "-"}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge
                              status={
                                u.isVerified
                                  ? "verified"
                                  : u.verificationStatus || "pending"
                              }
                            />
                          </td>
                          <td className="py-3 pr-4 font-bold text-[#22c55e] tabular-nums">
                            {formatUsd(u.cash)}
                          </td>
                          <td className="py-3 pr-4 text-gray-400">
                            {formatDate(u.createdAt)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setEditCash(String(u.cash || 0));
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#252a36] hover:bg-[#313747] text-gray-200 font-semibold"
                            >
                              Edit Cash
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-8 text-center text-gray-400"
                          >
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit User Cash Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveUserCash}
            className="w-full max-w-sm bg-[#161922] border border-[#2a2e39] rounded-2xl p-6 space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-white">
                Update User Cash
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {editingUser.email}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Cash Balance (USD)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editCash}
                onChange={(e) => setEditCash(e.target.value)}
                required
                className="w-full h-10 bg-[#1b1e27] border border-[#2d313d] rounded-xl px-3 text-sm text-white outline-none focus:border-[#315cf5]"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionId === editingUser.email}
                className="flex-1 py-2.5 rounded-xl bg-[#315cf5] hover:bg-[#416bff] text-xs font-semibold text-white"
              >
                {actionId === editingUser.email ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
