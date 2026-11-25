import React from "react";
import { Link } from "react-router-dom"; // For Next.js, use: import Link from "next/link";

const PaymentCancelled: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-8 text-center shadow-2xl">
        {/* Cancelled X Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/30">
          <svg
            className="h-8 w-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        {/* Title & Message */}
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Payment Cancelled
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Your deposit was cancelled or timed out. No balance was credited and
          you can try again anytime.
        </p>

        {/* Status Notice */}
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          Transaction Not Completed
        </div>

        {/* Primary Button */}
        <Link
          to="/deposit" // Change to "/" if your deposit modal is on the home page (use `href=` for Next.js)
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.99]"
        >
          Try Deposit Again
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>

        {/* Secondary Link */}
        <Link
          to="/" // For Next.js, change `to="/"` to `href="/"`
          className="mt-4 inline-block text-xs text-gray-400 hover:text-gray-200 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default PaymentCancelled;
