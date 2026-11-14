"use client";

import React, { useState } from "react";
import DisputeIntelligenceWorkspace from "@/components/DisputeIntelligenceWorkspace";
import FujiTransactionVerifier from "@/components/FujiTransactionVerifier";
import OnChainStatsAndCases from "@/components/OnChainStatsAndCases";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_FUJI_CHAIN_ID,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";

type WorkspaceTab =
  | "dashboard"
  | "cases"
  | "analysis"
  | "audit"
  | "settings";

const NAV_ITEMS: { id: WorkspaceTab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◆" },
  { id: "cases", label: "Dispute Cases", icon: "▤" },
  { id: "analysis", label: "Evidence Analysis", icon: "◎" },
  { id: "audit", label: "Avalanche Audit", icon: "⛓" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

const TAB_META: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Monitor disputes, on-chain records and recovery progress.",
  },
  cases: {
    title: "Dispute Cases",
    subtitle: "Immutable case records anchored on Avalanche Fuji Testnet.",
  },
  analysis: {
    title: "Evidence Analysis",
    subtitle: "Unified AskPay • DoubtStamp • LEGALMIND investigation workspace.",
  },
  audit: {
    title: "Avalanche Audit",
    subtitle: "Verify raw Fuji C-Chain transactions and inspect Registry v2.",
  },
  settings: {
    title: "Settings",
    subtitle: "Network, Smart Contract, and AI pipeline runtime configuration.",
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dashboard");
  const currentMeta = TAB_META[activeTab];

  return (
    <main className="min-h-screen bg-[#080d18] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        {/* Sidebar Navigation */}
        <aside className="flex w-full flex-col justify-between border-b border-white/10 bg-[#0b1220] p-6 lg:w-72 lg:border-b-0 lg:border-r">
          <div>
            <div className="mb-8">
              <h1 className="text-xl font-bold tracking-wider text-cyan-300">
                TRUSTRECOVER
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                AI-powered DeFi dispute intelligence
              </p>
            </div>

            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              WORKSPACE
            </p>

            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? "border border-cyan-400/25 bg-cyan-400/10 font-medium text-cyan-300"
                        : "border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111b2d] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              NETWORK STATUS
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Avalanche Fuji
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Chain ID {TRUSTRECOVER_FUJI_CHAIN_ID} • Testnet
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex flex-1 flex-col justify-between p-6 lg:p-10">
          <div>
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">
                  TRUSTRECOVER / {currentMeta.title}
                </p>
                <h2 className="mt-1 text-3xl font-bold">{currentMeta.title}</h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  {currentMeta.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("analysis")}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                + New Dispute
              </button>
            </header>

            {/* TAB 1: DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="space-y-8">
                <OnChainStatsAndCases />

                <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Quick Actions
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Start an AI investigation or verify a Fuji transaction
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("cases")}
                        className="text-xs text-cyan-300 hover:underline"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("analysis")}
                        className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-left transition hover:bg-cyan-500/15"
                      >
                        <div className="text-sm font-semibold text-cyan-300">
                          Run AI Dispute Pipeline
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Analyze claim, upload evidence & verify on Fuji.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("audit")}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
                      >
                        <div className="text-sm font-semibold text-white">
                          Verify Fuji TxHash
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          Inspect raw block, receipt, gas & ERC-20 logs.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
                    <h3 className="text-lg font-semibold">AI Intelligence</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      AI investigates. Evidence is checked. Avalanche anchors an
                      auditable case history. Human reviewers validate outcomes.
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span>01 • AskPay</span>
                        <span className="text-cyan-300">Tx Intelligence</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span>02 • DoubtStamp</span>
                        <span className="text-cyan-300">Evidence Check</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span>03 • LEGALMIND</span>
                        <span className="text-cyan-300">Recovery Guide</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DISPUTE CASES */}
            {activeTab === "cases" && <OnChainStatsAndCases />}

            {/* TAB 3: EVIDENCE ANALYSIS */}
            {activeTab === "analysis" && <DisputeIntelligenceWorkspace />}

            {/* TAB 4: AVALANCHE AUDIT */}
            {activeTab === "audit" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs">
                  <div className="font-semibold text-white">
                    TrustRecoverRegistry v2 (Avalanche Fuji Testnet)
                  </div>
                  <p className="mt-1 text-slate-400">
                    Hợp đồng thông minh lưu trữ lịch sử kiểm duyệt bất biến với phân quyền{" "}
                    <span className="font-mono text-cyan-300">onlyReviewer</span>.
                  </p>
                  <a
                    href={`${SNOWTRACE_FUJI_URL}/address/${TRUSTRECOVER_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block break-all font-mono text-cyan-300 underline"
                  >
                    {TRUSTRECOVER_REGISTRY_ADDRESS} ↗
                  </a>
                </div>
                <FujiTransactionVerifier />
              </div>
            )}

            {/* TAB 5: SETTINGS */}
            {activeTab === "settings" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs">
                  <h3 className="text-sm font-semibold text-white">
                    Blockchain Configuration
                  </h3>
                  <div className="mt-3 space-y-2 text-slate-300">
                    <div>Network: Avalanche Fuji C-Chain</div>
                    <div>Chain ID: {TRUSTRECOVER_FUJI_CHAIN_ID}</div>
                    <div className="break-all font-mono text-cyan-300">
                      Contract: {TRUSTRECOVER_REGISTRY_ADDRESS}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs">
                  <h3 className="text-sm font-semibold text-white">
                    AI & Security Policy
                  </h3>
                  <div className="mt-3 space-y-2 text-slate-300">
                    <div>AI Pipeline: AskPay • DoubtStamp • LEGALMIND</div>
                    <div>Server-side API Key Isolation: Enabled</div>
                    <div>Rate Limit: 15 requests / minute / IP</div>
                    <div>Max Evidence Upload: 5 files (5MB each)</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
            TRUSTRECOVER © 2026 · AI-powered DeFi dispute intelligence
          </footer>
        </section>
      </div>
    </main>
  );
}