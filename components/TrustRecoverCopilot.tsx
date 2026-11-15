"use client";

import React, { useEffect, useRef, useState } from "react";

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
  "Mở hàng chờ Trọng tài On-Chain để Reviewer bỏ phiếu",
  "Kiểm tra giao dịch trên Avalanche Fuji hoặc Dispatch L1",
  "Tôi muốn kiểm tra file báo cáo .json có bị sửa không",
];

function HeronLogoIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="copilotHeronGrad" x1="8" y1="14" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <ellipse
        cx="32"
        cy="35"
        rx="23"
        ry="9"
        transform="rotate(-22 32 35)"
        stroke="#0891B2"
        strokeWidth="2.8"
      />
      <path
        d="M11 21C15 17 22 17 29 19L37 22C39 16 36 12 32 10C37 9 43 11 45 15L54 14L46 18C47 24 43 31 35 35L28 53L25 55V33C20 30 14 27 11 21Z"
        fill="url(#copilotHeronGrad)"
      />
    </svg>
  );
}

export default function TrustRecoverCopilot({
  onExecuteAction,
}: TrustRecoverCopilotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(
    "Xin chào! Bạn có thể nhập yêu cầu, đính kèm ảnh hoặc tệp (.pdf, .json, .txt, .csv), mình sẽ đưa bạn tới đúng chức năng và điền sẵn dữ liệu."
  );

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPos({
      x: 28,
      y: Math.max(20, window.innerHeight - 190),
    });
  }, []);

  function onPointerDownDrag(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, input, textarea, label")) {
      return;
    }
    startDrag(e);
  }

  function startDrag(e: React.PointerEvent) {
    if (!pos) return;
    draggingRef.current = true;
    movedRef.current = false;
    offsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!draggingRef.current) return;
    movedRef.current = true;
    const width = containerRef.current?.offsetWidth || 64;
    const height = containerRef.current?.offsetHeight || 64;
    const maxX = Math.max(12, window.innerWidth - width - 12);
    const maxY = Math.max(12, window.innerHeight - height - 12);
    setPos({
      x: Math.min(maxX, Math.max(12, e.clientX - offsetRef.current.x)),
      y: Math.min(maxY, Math.max(12, e.clientY - offsetRef.current.y)),
    });
  }

  function handlePointerUp() {
    draggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  async function sendPrompt(textToSend: string, fileToSend?: File | null) {
    const q = textToSend.trim();
    const f = fileToSend === undefined ? attachedFile : fileToSend;
    if ((!q && !f) || loading) return;
    setLoading(true);
    setReply(null);

    try {
      const formData = new FormData();
      formData.append("message", q);
      if (f) {
        formData.append("file", f);
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
        if ((json.data.targetTab && json.data.targetTab !== "none") || json.data.autoFill) {
          onExecuteAction({
            targetTab: json.data.targetTab && json.data.targetTab !== "none" ? json.data.targetTab : "analysis",
            autoFill: json.data.autoFill,
          });
        }
        setInput("");
        setAttachedFile(null);
      }
    } catch {
      setReply("Lỗi kết nối tới Trợ lý AI.");
    } finally {
      setLoading(false);
    }
  }

  if (!pos) return null;

  const isLeftSide =
    typeof window !== "undefined" ? pos.x < window.innerWidth / 2 : true;
  const isTopSide =
    typeof window !== "undefined" ? pos.y < window.innerHeight / 2 : false;

  return (
    <div
      ref={containerRef}
      style={{ left: pos.x, top: pos.y }}
      className={`fixed z-50 flex select-none ${
        isTopSide ? "flex-col-reverse" : "flex-col"
      } ${isLeftSide ? "items-start" : "items-end"}`}
    >
      {open && (
        <div
          className={`${
            isTopSide ? "mt-3" : "mb-3"
          } w-[350px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl`}
        >
          <div
            onPointerDown={onPointerDownDrag}
            title="Nhấn giữ chuột để kéo Trợ lý sang vị trí khác"
            className="flex cursor-grab items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 active:cursor-grabbing"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 ring-1 ring-cyan-500/20">
                <HeronLogoIcon size={20} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900">
                  Trợ lý AI TrustRecover
                </div>
                <div className="text-[10px] text-slate-500">
                  Giữ thanh này để kéo • Đọc ảnh/tệp & tự điền
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 p-4 text-xs">
            {reply && (
              <div className="rounded-xl border border-cyan-600/20 bg-cyan-50 p-3 leading-relaxed text-slate-800">
                {reply}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Gợi ý bấm nhanh:
              </div>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={loading}
                  onClick={() => sendPrompt(qp, null)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-700 transition hover:border-cyan-500/40 hover:bg-cyan-50 hover:text-cyan-800"
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
              className="space-y-2 pt-1"
            >
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập việc bạn muốn làm hoặc đính kèm tệp/ảnh..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-600 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="cursor-pointer truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100">
                  <span>
                    {attachedFile
                      ? `📎 ${attachedFile.name}`
                      : "+ Tải tệp / ảnh"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.txt,.json,.csv,.md,.log"
                    className="hidden"
                    onChange={(e) => setAttachedFile(e.target.files?.[0] || null)}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 rounded-xl bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? "Đang đọc..." : "Thực hiện →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nut tron Icon Logo bay theo trang web (khong can chu) */}
      <button
        type="button"
        onPointerDown={startDrag}
        onClick={() => {
          if (!movedRef.current) setOpen((v) => !v);
        }}
        title="Bấm để mở/thu gọn hoặc nhấn giữ chuột để kéo"
        aria-label="Mở Trợ lý AI TrustRecover"
        className="flex h-13 w-13 cursor-grab items-center justify-center rounded-full border border-slate-200 bg-white shadow-xl transition hover:scale-105 hover:border-cyan-500/50 hover:shadow-2xl active:cursor-grabbing"
      >
        <HeronLogoIcon size={28} />
      </button>
    </div>
  );
}