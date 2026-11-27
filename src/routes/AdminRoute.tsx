/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import NotFoundPage from "../pages/Home/NotFoundPage";
import { getFirebaseToken } from "../utils/getFirebaseToken"; // adjust path if placed elsewhere

const AUTH_STORAGE_KEY = "promarkets_demo_user";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

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

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = getStoredEmail();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    email ? "loading" : "denied",
  );

  useEffect(() => {
    if (!email) {
      setStatus("denied");
      return;
    }

    const controller = new AbortController();

    const verifyAdmin = async () => {
      try {
        const token = await getFirebaseToken();
        if (controller.signal.aborted) return;

        if (!token) {
          setStatus("denied");
          return;
        }

        const res = await fetch(
          `${API_BASE}/users/${encodeURIComponent(email)}`,
          {
            signal: controller.signal,
            cache: "no-store",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) {
          setStatus("denied");
          return;
        }

        const json = await res.json();
        if (controller.signal.aborted) return;

        console.log(json);

        const roles = json?.data?.roles;
        const isAdmin =
          roles === "admin" ||
          (Array.isArray(roles) && roles.includes("admin"));

        setStatus(json?.success && isAdmin ? "allowed" : "denied");
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setStatus("denied");
        }
      }
    };

    verifyAdmin();

    return () => controller.abort();
  }, [email]);

  if (status === "loading") {
    return (
      <div className="min-h-[calc(100vh-100px)] bg-[#0e1015] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#315cf5]" size={28} />
      </div>
    );
  }

  if (status === "denied") {
    return <NotFoundPage />;
  }

  return <>{children}</>;
}
