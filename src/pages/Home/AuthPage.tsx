import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithPopup, signOut, type UserCredential } from "firebase/auth";
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  X,
  MapPin,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { auth, googleProvider, isFirebaseConfigured } from "../../firebase"; // <-- adjust path to your src/firebase.ts

const AUTH_STORAGE_KEY = "promarkets_demo_user";
const API_BASE =
  import.meta.env.VITE_API_URL || "https://promarkets-blue.vercel.app/api/v1";

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
] as const;

export interface AuthUser {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  provider: "Google";
  portfolio: string;
  cash: string;
  isVerified?: boolean;
}

interface BackendUserResponse {
  success: boolean;
  loggedOut?: boolean;
  message?: string;
  data?: {
    username?: string;
    email?: string;
    city?: string;
    cash?: number;
    portfolio?: number;
    isVerified?: boolean;
  };
}

interface AddressSuggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  address: string;
  city?: string;
  stateCode: string;
  zip: string;
}

interface AuthPageProps {
  mode?: "login" | "signup";
}

function formatUsd(val: number | undefined): string {
  const num = Number(val) || 0;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Formats up to 9 digits as XXX-XX-XXXX
function formatSsn(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

async function sendWelcomeEmail(user: AuthUser): Promise<string> {
  if (!user.email) return "No email returned";

  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (serviceId && templateId && publicKey) {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: user.email,
          to_name: user.username,
          subject: "Welcome to Promarkets!",
          message: `Hi ${user.username}, welcome to Promarkets! Your Google account is now verified and ready to trade live prediction markets.`,
        },
      }),
    });
    if (res.ok) return "EmailJS SMTP";
  }

  const backendMailer = import.meta.env.VITE_WELCOME_EMAIL_API;
  if (backendMailer) {
    const res = await fetch(backendMailer, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        name: user.username,
        provider: user.provider,
      }),
    });
    if (res.ok) return "Backend Mailer";
  }

  return "Promarkets Welcome Service";
}

export default function AuthPage({ mode = "login" }: AuthPageProps) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [loadingGoogle, setLoadingGoogle] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Identity verification modal state
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [stateCode, setStateCode] = useState<string>("NY");
  const [zip, setZip] = useState<string>("");
  const [ssn, setSsn] = useState<string>(""); // kept in memory only, never persisted
  const [showSsn, setShowSsn] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>("");

  // Address autocomplete state
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddress, setLoadingAddress] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const skipLookupRef = useRef<boolean>(false);
  const addressBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        addressBoxRef.current &&
        !addressBoxRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Fetch US address suggestions (backend primary + Photon direct fallback)
  useEffect(() => {
    if (!pendingUser) return;
    if (skipLookupRef.current) {
      skipLookupRef.current = false;
      return;
    }

    const query = address.trim();
    if (query.length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingAddress(true);
      try {
        let list: AddressSuggestion[] = [];

        try {
          const res = await fetch(
            `${API_BASE}/users/address-search?q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          );
          if (res.ok) {
            const json = (await res.json()) as { data?: AddressSuggestion[] };
            if (Array.isArray(json.data)) list = json.data;
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === "AbortError") throw err;
        }

        if (list.length === 0) {
          const phRes = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(
              query,
            )}&limit=8&lang=en&bbox=-179.15,18.91,-66.93,71.39`,
            { signal: controller.signal },
          );
          if (phRes.ok) {
            const phJson = (await phRes.json()) as {
              features?: Array<{
                properties?: {
                  osm_id?: number;
                  countrycode?: string;
                  housenumber?: string;
                  street?: string;
                  name?: string;
                  city?: string;
                  town?: string;
                  county?: string;
                  state?: string;
                  postcode?: string;
                };
              }>;
            };
            list = (phJson.features || [])
              .filter((f) => f.properties?.countrycode === "US")
              .slice(0, 6)
              .map((f, idx) => {
                const p = f.properties || {};
                const streetLine = [p.housenumber, p.street]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const cityName = p.city || p.town || p.county || "";
                const matchedState = US_STATES.find(
                  (st) =>
                    st.name.toLowerCase() === (p.state || "").toLowerCase() ||
                    st.code === (p.state || "").toUpperCase(),
                );
                const sCode = matchedState?.code || "";
                const zip5 = String(p.postcode || "")
                  .replace(/\D/g, "")
                  .slice(0, 5);
                const mainText = streetLine || p.name || cityName;

                return {
                  id: `direct-${p.osm_id || idx}`,
                  mainText,
                  secondaryText: [cityName, sCode, zip5]
                    .filter(Boolean)
                    .join(", "),
                  address: streetLine || p.name || mainText,
                  city: cityName,
                  stateCode: sCode,
                  zip: zip5,
                };
              })
              .filter((item) => Boolean(item.mainText));
          }
        }

        setSuggestions(list);
        setDropdownOpen(list.length > 0);
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setLoadingAddress(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, pendingUser]);

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    skipLookupRef.current = true;
    setAddress(item.address || item.mainText);

    const pickedCity =
      item.city?.trim() || item.secondaryText.split(",")[0]?.trim() || "";
    if (pickedCity) {
      setCity(pickedCity);
    }

    if (item.stateCode && US_STATES.some((st) => st.code === item.stateCode)) {
      setStateCode(item.stateCode);
    }

    if (item.zip && item.zip.length === 5) {
      setZip(item.zip);
    } else if (item.stateCode && pickedCity) {
      try {
        const zRes = await fetch(
          `https://api.zippopotam.us/us/${item.stateCode}/${encodeURIComponent(
            pickedCity,
          )}`,
        );
        if (zRes.ok) {
          const zJson = (await zRes.json()) as {
            places?: Array<{ "post code"?: string }>;
          };
          const foundZip = String(zJson.places?.[0]?.["post code"] || "").slice(
            0,
            5,
          );
          if (foundZip.length === 5) setZip(foundZip);
        }
      } catch {
        // ignore zip lookup failure
      }
    }

    setSuggestions([]);
    setDropdownOpen(false);
  };

  const handleZipChange = async (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 5);
    setZip(clean);

    if (clean.length === 5) {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
        if (res.ok) {
          const json = (await res.json()) as {
            places?: Array<{
              "state abbreviation"?: string;
              "place name"?: string;
            }>;
          };
          const place = json.places?.[0];
          const abbr = place?.["state abbreviation"]?.toUpperCase();
          if (abbr && US_STATES.some((st) => st.code === abbr)) {
            setStateCode(abbr);
          }
          if (place?.["place name"] && !city.trim()) {
            setCity(place["place name"]);
          }
        }
      } catch {
        // ignore zip lookup error
      }
    }
  };

  const completeLogin = async (authUser: AuthUser) => {
    const deliveredVia = await sendWelcomeEmail(authUser);

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ email: authUser.email }),
    );
    window.dispatchEvent(new Event("promarkets-auth-change"));
    window.dispatchEvent(
      new CustomEvent("promarkets-welcome-email", {
        detail: {
          email: authUser.email,
          username: authUser.username,
          provider: "Google",
          deliveredVia,
        },
      }),
    );

    navigate("/");
  };

  const forceLogout = async (message: string) => {
    if (auth) {
      await signOut(auth).catch(() => {});
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event("promarkets-auth-change"));
    setPendingUser(null);
    setSuggestions([]);
    setDropdownOpen(false);
    setSsn("");
    setShowSsn(false);
    setError(message);
  };

  const handleGoogleLogin = async () => {
    setError("");
    setVerifyError("");

    if (!isFirebaseConfigured || !auth) {
      setError(
        "Firebase is not configured yet. Add VITE_FIREBASE_* keys to your .env file to launch Google login.",
      );
      return;
    }

    setLoadingGoogle(true);

    try {
      const result: UserCredential = await signInWithPopup(
        auth,
        googleProvider,
      );
      const fbUser = result.user;

      const userEmail = (fbUser.email || fbUser.providerData?.[0]?.email || "")
        .toLowerCase()
        .trim();

      if (!userEmail) {
        await forceLogout("Google did not return an email address.");
        return;
      }

      const displayName =
        fbUser.displayName || userEmail.split("@")[0] || "Trader";

      const nameParts = displayName.trim().split(/\s+/);
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");

      const res = await fetch(`${API_BASE}/users/google-auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: userEmail,
          username: displayName,
        }),
      });

      const json = (await res.json()) as BackendUserResponse;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "Failed to save user on server.");
      }

      const backendUser = json.data;
      const authUser: AuthUser = {
        uid: fbUser.uid,
        username: backendUser.username || displayName,
        email: userEmail,
        photoURL: fbUser.photoURL || undefined,
        provider: "Google",
        portfolio: formatUsd(backendUser.portfolio),
        cash: formatUsd(backendUser.cash),
        isVerified: Boolean(backendUser.isVerified),
      };

      if (authUser.isVerified) {
        await completeLogin(authUser);
        return;
      }

      setPendingUser(authUser);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === "auth/popup-closed-by-user") {
        setError("Google sign-in popup was closed before completing.");
      } else if (firebaseErr.code === "auth/operation-not-allowed") {
        setError("Google sign-in is not enabled in your Firebase Console.");
      } else {
        setError(firebaseErr.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingUser) return;

    setVerifyError("");

    const ssnDigits = ssn.replace(/\D/g, "");
    if (ssnDigits.length !== 9) {
      setVerifyError("Please enter a valid 9-digit Social Security Number.");
      return;
    }

    setVerifying(true);

    try {
      const res = await fetch(`${API_BASE}/users/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: pendingUser.email,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          address: address.trim(),
          city: city.trim(),
          state: stateCode,
          zip: zip.trim(),
          ssn: ssnDigits,
        }),
      });

      const json = (await res.json()) as BackendUserResponse;

      // Clear the SSN from memory as soon as the request is done
      setSsn("");
      setShowSsn(false);

      if (!res.ok || !json.success || json.loggedOut) {
        await forceLogout(
          json.message || "Verification failed. You have been logged out.",
        );
        return;
      }

      const verifiedUser: AuthUser = {
        ...pendingUser,
        username:
          `${firstName.trim()} ${lastName.trim()}`.trim() ||
          pendingUser.username,
        cash: formatUsd(json.data?.cash),
        portfolio: formatUsd(json.data?.portfolio),
        isVerified: true,
      };

      setPendingUser(null);
      await completeLogin(verifiedUser);
    } catch (err: unknown) {
      setVerifyError(
        err instanceof Error
          ? err.message
          : "Network error while verifying identity.",
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#0d1016] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-[410px] bg-[#161922] border border-[#2a2e39] rounded-2xl p-7 shadow-2xl">
        {/* Logo + Heading */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-11 h-11 rounded-xl bg-[#0e1015] border border-white/10 flex items-center justify-center mb-4">
            <svg width="20" height="22" viewBox="0 0 22 25" fill="none">
              <path d="M2 5L19 1V11L2 15V5Z" stroke="white" strokeWidth="2" />
              <path
                d="M2 15L19 11V23L2 19V15Z"
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-xs text-gray-400 mt-1.5">
            {isSignup
              ? "Sign up using your Google account"
              : "Log in with your verified Google account"}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Continue with Google */}
        <button
          type="button"
          disabled={loadingGoogle}
          onClick={handleGoogleLogin}
          className="w-full h-12 rounded-xl bg-white hover:bg-gray-100 disabled:opacity-60 text-[#111318] font-semibold text-sm flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
        >
          {loadingGoogle ? (
            <>
              <Loader2 size={18} className="animate-spin text-[#111318]" />
              Connecting to Google...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.91 6.72-4.91z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {/* Toggle Login / Signup */}
        <p className="text-center text-xs text-gray-400 mt-6">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-400 hover:underline font-semibold"
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="text-blue-400 hover:underline font-semibold"
              >
                Sign up
              </Link>
            </>
          )}
        </p>

        <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-gray-300">
            Terms of Use
          </Link>{" "}
          and will complete identity verification.
        </p>
      </div>

      {/* ================= VERIFY YOUR IDENTITY MODAL ================= */}
      {pendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161922] border border-white/[0.12] p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Verify Your Identity
                  </h2>
                  <p className="text-xs text-gray-400 truncate max-w-[260px]">
                    {pendingUser.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={verifying}
                onClick={() =>
                  forceLogout(
                    "Verification cancelled. You have been logged out.",
                  )
                }
                aria-label="Cancel verification"
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {verifyError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            <form
              onSubmit={handleVerifySubmit}
              className="space-y-3"
              autoComplete="off"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    First Name
                  </label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Last Name
                  </label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Street Address with Working Autocomplete */}
              <div ref={addressBoxRef} className="relative">
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Street Address
                </label>
                <div className="relative">
                  <input
                    required
                    autoComplete="off"
                    value={address}
                    onFocus={() => {
                      if (suggestions.length > 0) setDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDropdownOpen(false);
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddress(val);
                      if (val.trim().length < 3) {
                        setSuggestions([]);
                        setDropdownOpen(false);
                      }
                    }}
                    placeholder="Start typing US address..."
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl pl-3 pr-9 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {loadingAddress ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <MapPin size={15} />
                    )}
                  </div>
                </div>

                {dropdownOpen && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[68px] z-50 rounded-xl bg-[#10131a] border border-white/15 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-white/[0.07] border-b border-white/[0.05] last:border-b-0 flex items-start gap-2.5 transition-colors cursor-pointer"
                      >
                        <MapPin
                          size={14}
                          className="text-blue-400 shrink-0 mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {item.mainText}
                          </p>
                          {item.secondaryText && (
                            <p className="text-[11px] text-gray-400 truncate">
                              {item.secondaryText}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* City */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  City
                </label>
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Lyman"
                  className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    US State
                  </label>
                  <select
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                  >
                    {US_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                    5-Digit ZIP Code
                  </label>
                  <input
                    required
                    maxLength={5}
                    pattern="\d{5}"
                    value={zip}
                    onChange={(e) => handleZipChange(e.target.value)}
                    placeholder="04002"
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums"
                  />
                </div>
              </div>

              {/* Social Security Number */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1">
                  Social Security Number (SSN)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Lock size={14} />
                  </div>
                  <input
                    required
                    type={showSsn ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="off"
                    name="ssn-verify"
                    maxLength={11}
                    pattern="\d{3}-?\d{2}-?\d{4}"
                    value={ssn}
                    onChange={(e) => setSsn(formatSsn(e.target.value))}
                    placeholder="XXX-XX-XXXX"
                    className="w-full bg-[#0d1016] border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white outline-none focus:border-blue-500 tabular-nums tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSsn((v) => !v)}
                    aria-label={showSsn ? "Hide SSN" : "Show SSN"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showSsn ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Used only to verify your identity. It is not stored.
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() =>
                    forceLogout(
                      "Verification cancelled. You have been logged out.",
                    )
                  }
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-sm font-semibold text-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 py-2.5 rounded-xl bg-[#315cf5] hover:bg-[#416bff] disabled:opacity-60 text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify & Continue"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
