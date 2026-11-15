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

export default function TrustRecoverCopilot({
  onExecuteAction,
}: TrustRecoverCopilotProps) {
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if ((!input.trim() && !imageFile) || loading) return;
    setLoading(true);
    setReply(null);

    try {
      const formData = new FormData();
      formData.append("message", input.trim());
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await fetch("/api/copilot", {
        method: "POST",
        body: formData,
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
        setImageFile(null);
      }
    } catch {
      setReply("Lỗi kết nối tới Trợ lý AI.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-6 mb-4 rounded-2xl border border-cyan-600/25 bg-slate-50 p-4 text-slate-900 shadow-sm">
      {/* Header co hinh dang Logo chim hac TrustRecover */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/20 ring-1 ring-cyan-600/20">
          <svg
            width="20"
            height="20"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 21C15 17 22 17 29 19L37 22C39 16 36 12 32 10C37 9 43 11 45 15L54 14L46 18C47 24 43 31 35 35L28 53L25 55V33C20 30 14 27 11 21Z"
              fill="#4F46E5"
            />
            <ellipse
              cx="32"
              cy="35"
              rx="23"
              ry="9"
              transform="rotate(-22 32 35)"
              stroke="#0891B2"
              strokeWidth="3"
            />
          </svg>
        </div>
        <div>
          <div className="text-xs font-extrabold text-slate-900">
            Trợ lý AI TrustRecover
          </div>
          <div className="text-[10px] text-slate-500">
            Nhập chữ hoặc gửi ảnh để tự thực hiện
          </div>
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-3 space-y-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Bạn muốn làm gì? (vd: Kiểm tra tx 0x..., hoặc chạy mẫu)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none"
        />

        <div className="flex items-center justify-between gap-2">
          <label className="cursor-pointer truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100">
            <span>{imageFile ? `🖼 ${imageFile.name}` : "+ Đưa ảnh vào"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Đang đọc..." : "Thực hiện →"}
          </button>
        </div>
      </form>

      {reply && (
        <div className="mt-2.5 rounded-xl border border-cyan-600/20 bg-cyan-50 p-2.5 text-[11px] leading-relaxed text-slate-800">
          {reply}
        </div>
      )}
    </div>
  );
}