"use client";

import React, { useState } from "react";

export interface CopilotActionPayload {
  targetTab: "dashboard" | "cases" | "analysis" | "audit" | "settings";
  autoFill?: {
    txHash?: string;
    userClaim?: string;
    claimedAmountAvax?: string;
    claimedRecipient?: string;
    loadDemo?: boolean;
  };
}

interface TrustRecoverCopilotProps {
  onExecuteAction: (action: CopilotActionPayload) => void;
}

const QUICK_PROMPTS = [
  "Chạy thử kịch bản mẫu",
  "Kiểm tra file .json chống giả mạo",
  "Xem hồ sơ đã neo trên Fuji",
];

export default function TrustRecoverCopilot({
  onExecuteAction,
}: TrustRecoverCopilotProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  async function sendPrompt(textToSend: string) {
    const q = textToSend.trim();
    if (!q || loading) return;
    setLoading(true);
    setReply(null);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setReply(json.error || "Không thể xử lý yêu cầu lúc này.");
      } else {
        setReply(json.data.reply);
        onExecuteAction({
          targetTab: json.data.targetTab,
          autoFill: json.data.autoFill,
        });
        setInput("");
      }
    } catch {
      setReply("Lỗi kết nối tới Trợ lý AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-cyan-500/25 bg-[#0e1729] p-4 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt(input);
        }}
        className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
      >
        <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-cyan-300">
          <span>✦</span>
          <span>Trợ lý AI:</span>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập việc bạn muốn làm (vd: Tôi bị lừa mất 25 AVAX ở giao dịch 0x..., hoặc Mở kiểm tra báo cáo)..."
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {loading ? "Đang điều hướng..." : "Thực hiện →"}
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-400">Gợi ý nhanh:</span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => sendPrompt(qp)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
          >
            {qp}
          </button>
        ))}
      </div>

      {reply && (
        <div className="mt-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-100">
          ✦ {reply}
        </div>
      )}
    </div>
  );
}