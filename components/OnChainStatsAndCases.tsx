"use client";

import React, { useEffect, useState } from "react";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";

interface AnchoredCaseItem {
  caseId: string;
  txHash: string;
  reportHash: string;
  verdict: string;
  reviewer: string;
  anchoredAt: number;
}

export default function OnChainStatsAndCases({ showList = true }: { showList?: boolean }) {
  const [totalCases, setTotalCases] = useState<number | null>(null);
  const [cases, setCases] = useState<AnchoredCaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOnChainRegistry() {
    setLoading(true);
    try {
      const res = await fetch("/api/registry/cases");
      const json = await res.json();
      if (json.success) {
        setTotalCases(json.totalCases);
        setCases(json.cases || []);
      }
    } catch {
      // keep silent fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOnChainRegistry();
  }, []);

  const filteredCases = cases.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.caseId.toLowerCase().includes(q) ||
      item.txHash.toLowerCase().includes(q) ||
      item.reviewer.toLowerCase().includes(q)
    );
  });

  const liveStats = [
    {
      label: "Hồ sơ đã neo On-Chain",
      value: loading ? "..." : String(totalCases ?? 0).padStart(2, "0"),
      note: "Xác thực trên TrustRecoverRegistry v2",
    },
    {
      label: "Mạng Avalanche Fuji",
      value: "43113",
      note: "Fuji C-Chain Testnet (RPC trực tiếp)",
    },
    {
      label: "Hệ thống AI điều tra",
      value: "3 Tầng",
      note: "AskPay • DoubtStamp • LEGALMIND",
    },
    {
      label: "Hợp đồng lưu trữ v2",
      value: `${TRUSTRECOVER_REGISTRY_ADDRESS.slice(0, 6)}...${TRUSTRECOVER_REGISTRY_ADDRESS.slice(-4)}`,
      note: "onlyReviewer • Lưu trữ bất biến",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live On-Chain Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111b2d] p-5"
          >
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-cyan-300">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
          </div>
        ))}
      </div>

      {/* Live On-Chain Anchored Cases */}
      <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111b2d] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Hồ sơ đã neo gần đây trên Avalanche Fuji
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Đọc trực tiếp từ Smart Contract{" "}
              <a
                href={`${SNOWTRACE_FUJI_URL}/address/${TRUSTRECOVER_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-cyan-300 underline"
              >
                {TRUSTRECOVER_REGISTRY_ADDRESS} ↗
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={loadOnChainRegistry}
            className="shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
          >
            ↻ Làm mới từ Fuji
          </button>
        </div>

        {/* Reverse Lookup Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tra cứu ngược theo Case ID, TxHash hoặc địa chỉ Reviewer (0x...)..."
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {loading ? (
          <p className="text-xs text-slate-400">
            Đang đọc dữ liệu từ Avalanche Fuji Testnet...
          </p>
        ) : filteredCases.length === 0 ? (
          <p className="text-xs text-slate-400">
            {cases.length === 0
              ? "Chưa có hồ sơ nào được neo trên Contract v2. Hãy qua tab Phân tích bằng chứng để điều tra và ký neo hồ sơ đầu tiên."
              : "Không tìm thấy hồ sơ nào khớp với từ khóa tra cứu."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCases.map((item) => (
              <div
                key={item.caseId}
                className="rounded-xl border border-white/5 bg-slate-950/60 p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-cyan-300">
                    {item.caseId}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                    {item.verdict}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 font-mono text-[11px] text-slate-400 sm:grid-cols-2">
                  <div className="truncate">
                    TxHash:{" "}
                    <a
                      href={`${SNOWTRACE_FUJI_URL}/tx/${item.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-300 underline hover:text-cyan-200"
                    >
                      {item.txHash} ↗
                    </a>
                  </div>
                  <div className="truncate">
                    Reviewer:{" "}
                    <a
                      href={`${SNOWTRACE_FUJI_URL}/address/${item.reviewer}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-300 underline hover:text-cyan-200"
                    >
                      {item.reviewer} ↗
                    </a>
                  </div>
                  <div className="truncate">ReportHash: {item.reportHash}</div>
                  <div>
                    Anchored:{" "}
                    {new Date(item.anchoredAt * 1000).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}