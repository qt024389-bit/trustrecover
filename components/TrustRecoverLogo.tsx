import React from "react";

export default function TrustRecoverLogo() {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width="44"
        height="44"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="TrustRecover AI Logo"
      >
        <defs>
          <linearGradient id="trWingGrad" x1="8" y1="14" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="50%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="trOrbitGrad" x1="10" y1="36" x2="54" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891B2" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>

        {/* Orbital blockchain ring */}
        <ellipse
          cx="32"
          cy="35"
          rx="23"
          ry="9"
          transform="rotate(-22 32 35)"
          stroke="url(#trOrbitGrad)"
          strokeWidth="2.4"
        />

        {/* Stylized Heron / Crane forming a T */}
        <path
          d="M11 21C15 17 22 17 29 19L37 22C39 16 36 12 32 10C37 9 43 11 45 15L54 14L46 18C47 24 43 31 35 35L28 53L25 55V33C20 30 14 27 11 21Z"
          fill="url(#trWingGrad)"
        />
        <path
          d="M11 21C17 18 24 19 31 23L25 28C19 27 14 25 11 21Z"
          fill="#38BDF8"
          fillOpacity="0.85"
        />

        {/* Two blockchain nodes */}
        <polygon points="15,34 19,32 23,34 23,38 19,40 15,38" fill="#4F46E5" />
        <polygon points="44,36 49,33.5 54,36 54,41 49,43.5 44,41" fill="#7C3AED" />
      </svg>

      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight text-slate-900">
          TrustRecover{" "}
          <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">
            AI
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          DeFi Dispute Intelligence
        </div>
      </div>
    </div>
  );
}