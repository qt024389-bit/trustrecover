"use client";

import React, { useState } from "react";
import TrustRecoverLogo from "@/components/TrustRecoverLogo";
import DisputeIntelligenceWorkspace, { WorkspacePrefill } from "@/components/DisputeIntelligenceWorkspace";
import TrustRecoverCopilot, { CopilotActionPayload } from "@/components/TrustRecoverCopilot";
import FujiTransactionVerifier from "@/components/FujiTransactionVerifier";
import OnChainStatsAndCases from "@/components/OnChainStatsAndCases";
import ReviewerManagerPanel from "@/components/ReviewerManagerPanel";
import ReportIntegrityVerifier from "@/components/ReportIntegrityVerifier";
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
  { id: "dashboard", label: "Tổng quan", icon: "◆" },
  { id: "cases", label: "Hồ sơ tranh chấp", icon: "▤" },
  { id: "analysis", label: "Phân tích bằng chứng", icon: "◎" },
  { id: "audit", label: "Kiểm tra Avalanche", icon: "⛓" },
  { id: "settings", label: "Cài đặt", icon: "⚙" },
];

const TAB_META: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Tổng quan",
    subtitle: "Theo dõi hồ sơ tranh chấp, dữ liệu on-chain và tiến trình xử lý.",
  },
  cases: {
    title: "Hồ sơ tranh chấp",
    subtitle: "Danh sách hồ sơ đã được neo bất biến trên Avalanche Fuji Testnet.",
  },
  analysis: {
    title: "Phân tích bằng chứng",
    subtitle: "Không gian điều tra hợp nhất AskPay • DoubtStamp • LEGALMIND.",
  },
  audit: {
    title: "Kiểm tra Avalanche",
    subtitle: "Tra cứu trực tiếp giao dịch Fuji C-Chain và kiểm tra hợp đồng v2.",
  },
  settings: {
    title: "Cài đặt hệ thống",
    subtitle: "Thông tin mạng lưới, Smart Contract và cấu hình vận hành AI.",
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dashboard");
  const [workspacePrefill, setWorkspacePrefill] = useState<WorkspacePrefill | null>(null);
  const [auditPrefill, setAuditPrefill] = useState<{ nonce: number; txHash: string } | null>(null);

  function handleCopilotAction(action: CopilotActionPayload) {
    setActiveTab(action.targetTab);
    const nonce = Date.now();
    if (action.targetTab === "analysis" && action.autoFill) {
      setWorkspacePrefill({ nonce, ...action.autoFill });
    } else if (action.targetTab === "audit" && action.autoFill?.txHash) {
      setAuditPrefill({ nonce, txHash: action.autoFill.txHash });
    }
  }
  const currentMeta = TAB_META[activeTab];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080d18] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        {/* Sidebar ben trai: Phan Logo hoa lien mach, Khong gian lam viec nen trang */}
        <aside className="flex w-full shrink-0 flex-col justify-between border-b border-slate-200 bg-white text-slate-900 lg:w-72 lg:border-b-0 lg:border-r">
          <div>
            <div className="border-b border-slate-100 px-6 pt-6 pb-5">
              <TrustRecoverLogo />
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Nền tảng AI điều tra & hỗ trợ xử lý tranh chấp DeFi
              </p>
            </div>

            <div className="p-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-900">
                KHÔNG GIAN LÀM VIỆC
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
                          ? "border border-cyan-600/30 bg-cyan-50 font-semibold text-cyan-700 shadow-sm"
                          : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <span className="text-xs">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="m-6 mt-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              TRẠNG THÁI MẠNG
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Avalanche Fuji
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chain ID {TRUSTRECOVER_FUJI_CHAIN_ID} • Mạng thử nghiệm
            </p>
          </div>
        </aside>

        {/* Main Content Area: Nen toi Dark Navy diu mat */}
        <section className="flex min-w-0 flex-1 flex-col justify-between bg-[#080d18] p-6 text-white lg:p-8">
          <div>
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  TRUSTRECOVER / {currentMeta.title}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-white">
                  {currentMeta.title}
                </h2>
                <p className="mt-1.5 text-sm text-slate-400">
                  {currentMeta.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("analysis")}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                + Tạo hồ sơ mới
              </button>
            </header>

            {/* TAB 1: TONG QUAN */}
            <div className={activeTab === "dashboard" ? "block space-y-8" : "hidden"}>
              <OnChainStatsAndCases />

              <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Thao tác nhanh
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Bắt đầu điều tra bằng AI hoặc kiểm tra giao dịch trên Fuji
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cases")}
                      className="text-xs text-cyan-300 hover:underline"
                    >
                      Xem tất cả →
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("analysis")}
                      className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-left transition hover:bg-cyan-500/15"
                    >
                      <div className="text-sm font-semibold text-cyan-300">
                        Chạy điều tra tranh chấp AI
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Đối chiếu lời khai, tải bằng chứng và xác minh trên Fuji.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("audit")}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"
                    >
                      <div className="text-sm font-semibold text-white">
                        Xác minh mã giao dịch Fuji
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Kiểm tra block, receipt, phí gas và nhật ký ERC-20.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-6">
                  <h3 className="text-lg font-semibold text-white">
                    Kiến trúc điều tra AI
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    AI điều tra. Bằng chứng được đối chiếu. Avalanche lưu dấu vết
                    kiểm toán minh bạch. Kiểm duyệt viên con người xác nhận kết quả.
                  </p>
                  <div className="mt-4 space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span>01 • AskPay</span>
                      <span className="text-cyan-300">Phân tích giao dịch</span>
                    </div>
                    <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span>02 • DoubtStamp</span>
                      <span className="text-cyan-300">Đối chiếu bằng chứng</span>
                    </div>
                    <div className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                      <span>03 • LEGALMIND</span>
                      <span className="text-cyan-300">Hướng dẫn xử lý</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB 2: HO SO TRANH CHAP */}
            <div className={activeTab === "cases" ? "block" : "hidden"}>
              <OnChainStatsAndCases />
            </div>

            {/* TAB 3: PHAN TICH BANG CHUNG */}
            <div className={activeTab === "analysis" ? "block" : "hidden"}>
              <DisputeIntelligenceWorkspace copilotPrefill={workspacePrefill} />
            </div>

            {/* TAB 4: KIEM TRA AVALANCHE */}
            <div className={activeTab === "audit" ? "block space-y-6" : "hidden"}>
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
              <ReportIntegrityVerifier />
              <FujiTransactionVerifier prefillTxHash={auditPrefill} />
            </div>

            {/* TAB 5: CAI DAT */}
            <div className={activeTab === "settings" ? "grid gap-4 sm:grid-cols-2" : "hidden"}>
              <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs">
                <h3 className="text-sm font-semibold text-white">
                  Cấu hình Blockchain
                </h3>
                <div className="mt-3 space-y-2 text-slate-300">
                  <div>Mạng lưới: Avalanche Fuji C-Chain</div>
                  <div>Chain ID: {TRUSTRECOVER_FUJI_CHAIN_ID}</div>
                  <div className="break-all font-mono text-cyan-300">
                    Hợp đồng: {TRUSTRECOVER_REGISTRY_ADDRESS}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs">
                <h3 className="text-sm font-semibold text-white">
                  Chính sách AI & Bảo mật
                </h3>
                <div className="mt-3 space-y-2 text-slate-300">
                  <div>Luồng xử lý AI: AskPay • DoubtStamp • LEGALMIND</div>
                  <div>Bảo vệ API Key phía Server: Đang bật</div>
                  <div>Giới hạn tần suất: 15 lượt / phút / IP</div>
                  <div>Giới hạn tải bằng chứng: Tối đa 5 tệp (5MB/tệp)</div>
                </div>
              </div>
              <ReviewerManagerPanel />
            </div>
          </div>

          <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
            TRUSTRECOVER © 2026 · Nền tảng AI điều tra & hỗ trợ xử lý tranh chấp DeFi
          </footer>
        </section>
      </div>
          <TrustRecoverCopilot onExecuteAction={handleCopilotAction} />
    </main>
  );
}