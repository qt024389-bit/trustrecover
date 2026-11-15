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
  "Chạy thử kịch bản tranh chấp mẫu cho tôi xem",
  "Tôi muốn kiểm tra file báo cáo .json có bị sửa không",
  "Xem danh sách hồ sơ đã neo trên Avalanche Fuji",
];

export default function TrustRecoverCopilot({
  onExecuteAction,
}: TrustRecoverCopilotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(
    "Xin chào! Bạn muốn làm gì trên TRUSTRECOVER? Cứ mô tả tự nhiên, mình sẽ mở đúng chức năng và điền sẵn giúp bạn."
  );

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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#0b1220] text-white shadow-2xl shadow-cyan-950/50">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-4 py-3">
            <div>
              <div className="text-xs font-bold text-cyan-300">
                Trợ lý Điều hướng AI
              </div>
              <div className="text-[10px] text-slate-400">
                Tự mở chức năng & điền sẵn dữ liệu
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 p-4 text-xs">
            {reply && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/25 p-3 leading-relaxed text-slate-200">
                {reply}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Gợi ý bấm nhanh:
              </div>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => sendPrompt(qp)}
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-white"
                >
                  → {qp}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendPrompt(input);
              }}
              className="flex gap-2 pt-1"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập việc bạn muốn làm..."
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-xl bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                {loading ? "..." : "Đi"}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-3 text-xs font-bold text-slate-950 shadow-xl shadow-cyan-500/30 transition hover:bg-cyan-300"
      >
        <span>✦</span>
        <span>{open ? "Thu gọn Trợ lý" : "Trợ lý AI TrustRecover"}</span>
      </button>
    </div>
  );
}