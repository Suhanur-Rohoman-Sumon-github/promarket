import React from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-100px)] bg-[#0e1015] text-white flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-[#315cf5] mb-2">404</p>
      <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-sm text-gray-400 max-w-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-5 py-2.5 rounded-xl bg-[#315cf5] hover:bg-[#416bff] text-sm font-semibold text-white transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
