/* eslint-disable react-refresh/only-export-components */
import React from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets.tech/api/v1";
const AUTH_STORAGE_KEY = "promarkets_demo_user";

// ==================== TYPES ====================
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  loggedOut?: boolean;
  data: T;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  state: string;
  zip: string;
  isVerified: boolean;
  verificationStatus: "pending" | "verified" | "rejected";
  cash: number;
  portfolio: number;
  hasFirstDeposit: boolean;
}

export interface DepositCreateData {
  orderId: string;
  invoiceId: string | number;
  invoiceUrl: string;
}

export interface DepositOrder {
  _id: string;
  orderId: string;
  invoiceId: string;
  paymentId: string | null;
  userId: string;
  amountUsd: number;
  status: string;
  credited: boolean;
  createdAt: string;
}

export interface TradeItem {
  _id: string;
  userEmail: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  marketId: string;
  marketName: string;
  tokenId: string;
  side: string;
  shares: number;
  entryPrice: number;
  cost: number;
  closePrice: number | null;
  payout: number;
  pnl: number;
  status: "OPEN" | "CLOSED" | "SETTLED_WIN" | "SETTLED_LOSS";
  closedAt: string | null;
  createdAt: string;
}

export interface WithdrawItem {
  _id: string;
  userEmail: string;
  idempotencyKey: string;
  amountUsd: number;
  feeUsd: number;
  netAmountUsd: number;
  currency: string;
  walletAddress: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | "CANCELLED";
  processedAt: string | null;
  createdAt: string;
}

// ==================== HELPERS ====================
function syncLocalUserCash(
  cash: number | undefined,
  userPatch?: Partial<UserProfile>,
) {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw && !userPatch?.email) return;
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const nextCash =
      typeof cash === "number"
        ? `$${Math.max(0, cash).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : prev.cash;

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        ...prev,
        ...(userPatch?.username ? { username: userPatch.username } : {}),
        ...(userPatch?.email ? { email: userPatch.email } : {}),
        ...(nextCash !== undefined ? { cash: nextCash } : {}),
      }),
    );
    window.dispatchEvent(new Event("promarkets-auth-change"));
  } catch {
    // ignore storage errors
  }
}

function clearLocalUser() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event("promarkets-auth-change"));
  } catch {
    // ignore storage errors
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    if (json.loggedOut) clearLocalUser();
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json;
}

// ==================== QUERY CLIENT & PROVIDER ====================
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function PromarketsQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ==================== QUERY KEYS ====================
export const queryKeys = {
  user: (email: string) => ["user", email.toLowerCase()] as const,
  depositStatus: (orderId: string) => ["deposit", "status", orderId] as const,
  trades: (email: string, status?: string, eventId?: string) =>
    ["trades", email.toLowerCase(), status || "ALL", eventId || "ALL"] as const,
  withdraws: (email: string) => ["withdraws", email.toLowerCase()] as const,
};

// ==================== 1. USER QUERIES & MUTATIONS ====================

// GET /api/v1/users/:email
export function useUserProfileQuery(email?: string | null) {
  return useQuery({
    queryKey: queryKeys.user(email || ""),
    enabled: Boolean(email),
    queryFn: async () => {
      const res = await apiRequest<UserProfile>(
        `/users/${encodeURIComponent(email!)}`,
      );
      syncLocalUserCash(res.data.cash, res.data);
      return res.data;
    },
  });
}

// POST /api/v1/users/signup
export function useSignupMutation() {
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      username?: string;
    }) => {
      const res = await apiRequest<UserProfile>("/users/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncLocalUserCash(res.data.cash, res.data);
      return res.data;
    },
  });
}

// POST /api/v1/users/login
export function useLoginMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const res = await apiRequest<UserProfile>("/users/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncLocalUserCash(res.data.cash, res.data);
      qc.setQueryData(queryKeys.user(res.data.email), res.data);
      return res.data;
    },
  });
}

// POST /api/v1/users/verify
export function useVerifyUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      firstName: string;
      lastName: string;
      address: string;
      state: string;
      zip: string;
    }) => {
      const res = await apiRequest<UserProfile>("/users/verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.user(user.email), user);
    },
  });
}

// PATCH /api/v1/users/cash
export function useUpdateCashMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      cash?: number;
      portfolio?: number;
    }) => {
      const res = await apiRequest<UserProfile>("/users/cash", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      syncLocalUserCash(res.data.cash, res.data);
      return res.data;
    },
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.user(user.email), user);
    },
  });
}

// ==================== 2. DEPOSIT QUERIES & MUTATIONS ====================

// POST /api/v1/deposit/create
export function useCreateDepositMutation() {
  return useMutation({
    mutationFn: async (payload: { amountUsd: number; userId: string }) => {
      const res = await apiRequest<DepositCreateData>("/deposit/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.data;
    },
  });
}

// GET /api/v1/deposit/status/:orderId (polls every 5s while pending)
export function useDepositStatusQuery(orderId?: string | null) {
  return useQuery({
    queryKey: queryKeys.depositStatus(orderId || ""),
    enabled: Boolean(orderId),
    queryFn: async () => {
      const res = await apiRequest<DepositOrder>(
        `/deposit/status/${encodeURIComponent(orderId!)}`,
      );
      return res.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        !status ||
        status === "waiting" ||
        status === "confirming" ||
        status === "confirmed" ||
        status === "sending"
      ) {
        return 5000;
      }
      return false;
    },
  });
}

// ==================== 3. TRADE QUERIES & MUTATIONS ====================

// GET /api/v1/trades/:email?status=...&eventId=...
export function useTradesQuery(
  email?: string | null,
  filters?: { status?: string; eventId?: string },
) {
  return useQuery({
    queryKey: queryKeys.trades(email || "", filters?.status, filters?.eventId),
    enabled: Boolean(email),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.eventId) params.set("eventId", filters.eventId);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiRequest<TradeItem[]>(
        `/trades/${encodeURIComponent(email!)}${qs}`,
      );
      return res.data;
    },
  });
}

// POST /api/v1/trades/buy
export function useBuyTradeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      eventId: string;
      eventSlug?: string;
      eventTitle?: string;
      marketId: string;
      marketName: string;
      tokenId: string;
      side: string;
      amountUsd: number;
      price: number;
    }) => {
      const res = await apiRequest<{ trade: TradeItem; cash: number }>(
        "/trades/buy",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["trades", vars.email.toLowerCase()] });
      qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
    },
  });
}

// POST /api/v1/trades/sell
export function useSellTradeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      marketId: string;
      side: string;
      amountUsd: number;
      price: number;
    }) => {
      const res = await apiRequest<{
        trade: TradeItem;
        proceeds: number;
        cash: number;
      }>("/trades/sell", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["trades", vars.email.toLowerCase()] });
      qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
    },
  });
}

// POST /api/v1/trades/close
export function useCloseTradeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      tradeId: string;
      closePrice: number;
    }) => {
      const res = await apiRequest<{
        trade: TradeItem;
        proceeds: number;
        cash: number;
      }>("/trades/close", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["trades", vars.email.toLowerCase()] });
      qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
    },
  });
}

// POST /api/v1/trades/settle
export function useSettleTradesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email?: string;
      tokenId: string;
      result: 0 | 1;
    }) => {
      const res = await apiRequest<{
        settledCount: number;
        totalPayout: number;
        cash: number | null;
      }>("/trades/settle", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (res.data.cash !== null) syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      if (vars.email) {
        qc.invalidateQueries({
          queryKey: ["trades", vars.email.toLowerCase()],
        });
        qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
      } else {
        qc.invalidateQueries({ queryKey: ["trades"] });
      }
    },
  });
}

// ==================== 4. WITHDRAW QUERIES & MUTATIONS ====================

// GET /api/v1/withdraws/:email
// eslint-disable-next-line react-refresh/only-export-components
export function useWithdrawsQuery(email?: string | null) {
  return useQuery({
    queryKey: queryKeys.withdraws(email || ""),
    enabled: Boolean(email),
    queryFn: async () => {
      const res = await apiRequest<WithdrawItem[]>(
        `/withdraws/${encodeURIComponent(email!)}`,
      );
      return res.data;
    },
  });
}

// POST /api/v1/withdraws/request
export function useRequestWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      amountUsd: number;
      currency: string;
      walletAddress: string;
      idempotencyKey?: string;
    }) => {
      const res = await apiRequest<{ withdraw: WithdrawItem; cash: number }>(
        "/withdraws/request",
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            idempotencyKey: payload.idempotencyKey || crypto.randomUUID(),
          }),
        },
      );
      syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.withdraws(vars.email) });
      qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
    },
  });
}

// POST /api/v1/withdraws/cancel
export function useCancelWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      withdrawId: string;
    }) => {
      const res = await apiRequest<{ withdraw: WithdrawItem; cash: number }>(
        "/withdraws/cancel",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      syncLocalUserCash(res.data.cash);
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.withdraws(vars.email) });
      qc.invalidateQueries({ queryKey: queryKeys.user(vars.email) });
    },
  });
}
