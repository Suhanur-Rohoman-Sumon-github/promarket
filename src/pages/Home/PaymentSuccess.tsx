import React from "react";
import { Link } from "react-router-dom"; // For Next.js, use: import Link from "next/link";

const PaymentSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-8 text-center shadow-2xl">
        {/* Success Checkmark Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <svg
            className="h-8 w-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Title & Message */}
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Payment Successful!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Congratulations! You got rewarded. Your reward has been added to your
          account.
        </p>

        {/* Reward Badge */}
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
          Reward Unlocked — Ready to Claim
        </div>

        {/* Visit Reward Page Button */}
        <Link
          to="/rewards" // For Next.js, change `to="/reward"` to `href="/reward"`
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.99]"
        >
          Visit Reward Page
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

        {/* Optional Secondary Link */}
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

export default PaymentSuccess;
