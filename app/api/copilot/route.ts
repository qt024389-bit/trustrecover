import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { extractText } from "unpdf";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rateLimit";

const OVERALL_COPILOT_DEADLINE_MS = 48_000;
const MIN_REMAINING_MS = 3_500;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIMODAL_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "text/plain",
  "application/json",
  "text/csv",
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const COPILOT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    targetTab: {
      type: Type.STRING,
      enum: ["none", "dashboard", "cases", "analysis", "audit", "settings"],
    },
    autoFill: {
      type: Type.OBJECT,
      properties: {
        network: { type: Type.STRING },
        txHash: { type: Type.STRING },
        userClaim: { type: Type.STRING },
        claimedAmountAvax: { type: Type.STRING },
        claimedAsset: { type: Type.STRING },
        claimedRecipient: { type: Type.STRING },
        claimedSender: { type: Type.STRING },
        loadDemo: { type: Type.BOOLEAN },
      },
    },
  },
  required: ["reply", "targetTab"],
};

const CopilotZodSchema = z.object({
  reply: z.string().min(1).max(1500),
  targetTab: z.enum(["none", "dashboard", "cases", "analysis", "audit", "settings"]),
  autoFill: z
    .object({
      network: z.enum(["fuji", "dispatch", "mainnet"]).optional(),
      txHash: z.string().max(100).optional(),
      userClaim: z.string().max(1000).optional(),
      claimedAmountAvax: z.string().max(64).optional(),
      claimedAsset: z.string().max(32).optional(),
      claimedRecipient: z.string().max(100).optional(),
      claimedSender: z.string().max(100).optional(),
      loadDemo: z.boolean().optional(),
    })
    .optional(),
});

function logCopilotStage(data: {
  stage: string;
  durationMs: number;
  status: "OK" | "ERROR";
  model?: string;
  mimeType?: string;
  sizeBytes?: number;
  errorCode?: string;
}) {
  console.log(JSON.stringify({ service: "TRUSTRECOVER_COPILOT", ...data }));
}

function isTransientError(err: unknown): { transient: boolean; code: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === "AbortError") {
    return { transient: true, code: "ABORT_TIMEOUT" };
  }
  if (msg.includes("ABORT_TIMEOUT") || msg.includes("Timeout")) {
    return { transient: true, code: "TIMEOUT" };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return { transient: true, code: "HTTP_429" };
  }
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
    return { transient: true, code: "HTTP_503" };
  }
  if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
    return { transient: false, code: "HTTP_400" };
  }
  if (msg.includes("404") || msg.includes("not found")) {
    return { transient: false, code: "HTTP_404" };
  }
  return { transient: false, code: "AI_ERROR" };
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit("copilot:" + clientIp, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau 1 phút." },
      { status: 429 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let fileBase64: string | null = null;
    let fileMime = "image/png";
    let fileSizeBytes = 0;
    let extractedFileText: string | null = null;
    let attachedFileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = String(formData.get("message") || "").trim();
      const rawFile = formData.get("file") || formData.get("image");
      if (rawFile instanceof File && rawFile.size > 0) {
        const fileStart = Date.now();
        fileSizeBytes = rawFile.size;
        attachedFileName = rawFile.name;
        const rawMime = rawFile.type || "application/octet-stream";

        if (rawFile.size > MAX_FILE_SIZE_BYTES) {
          logCopilotStage({
            stage: "COPILOT_FILE_PROCESSING",
            durationMs: Date.now() - fileStart,
            status: "ERROR",
            mimeType: rawMime,
            sizeBytes: rawFile.size,
            errorCode: "FILE_TOO_LARGE",
          });
          return NextResponse.json(
            { success: false, error: "Tệp đính kèm không được vượt quá 5MB." },
            { status: 400 }
          );
        }

        const isAllowed =
          ALLOWED_MIME_PREFIXES.some((p) => rawMime.startsWith(p)) ||
          /\.(txt|json|csv|md|log|pdf|png|jpg|jpeg|webp)$/i.test(rawFile.name);
        if (!isAllowed) {
          logCopilotStage({
            stage: "COPILOT_FILE_PROCESSING",
            durationMs: Date.now() - fileStart,
            status: "ERROR",
            mimeType: rawMime,
            sizeBytes: rawFile.size,
            errorCode: "UNSUPPORTED_MIME",
          });
          return NextResponse.json(
            { success: false, error: `Định dạng tệp "${rawFile.name}" (${rawMime}) không được hỗ trợ.` },
            { status: 400 }
          );
        }

        const buf = Buffer.from(await rawFile.arrayBuffer());
        const isPdf = rawMime === "application/pdf" || /\.pdf$/i.test(rawFile.name);
        const isImg = rawMime.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(rawFile.name);

        if (isPdf) {
          fileMime = "application/pdf";
          try {
            const pdfRes = await extractText(new Uint8Array(buf), { mergePages: true });
            const txt = (Array.isArray(pdfRes.text) ? pdfRes.text.join("\n") : String(pdfRes.text || "")).trim();
            if (txt.length >= 80) {
              extractedFileText = txt.slice(0, 3500);
            }
          } catch {
            // Fallback sang multimodal cho PDF scan
          }
          if (!extractedFileText) {
            if (rawFile.size > MAX_MULTIMODAL_BYTES) {
              return NextResponse.json(
                { success: false, error: "PDF scan vượt quá ngưỡng multimodal 3MB, vui lòng nén hoặc tách trang." },
                { status: 400 }
              );
            }
            fileBase64 = buf.toString("base64");
          }
        } else if (isImg) {
          if (rawFile.size > MAX_MULTIMODAL_BYTES) {
            return NextResponse.json(
              { success: false, error: "Ảnh đính kèm vượt quá ngưỡng multimodal 3MB, vui lòng giảm kích thước ảnh." },
              { status: 400 }
            );
          }
          fileBase64 = buf.toString("base64");
          fileMime =
            rawMime !== "application/octet-stream"
              ? rawMime
              : /\.png$/i.test(rawFile.name)
              ? "image/png"
              : /\.webp$/i.test(rawFile.name)
              ? "image/webp"
              : "image/jpeg";
        } else {
          fileMime = rawMime;
          extractedFileText = buf.toString("utf-8").slice(0, 3500);
        }

        logCopilotStage({
          stage: "COPILOT_FILE_PROCESSING",
          durationMs: Date.now() - fileStart,
          status: "OK",
          mimeType: fileMime,
          sizeBytes: rawFile.size,
        });
      }
    } else {
      const body = await request.json().catch(() => null);
      message = String(body?.message || "").trim();
    }

    if (!message && !fileBase64 && !extractedFileText) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập yêu cầu hoặc đính kèm tệp/ảnh." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY chưa được cấu hình trên server." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.5-flash"];
    const deadlineAt = Date.now() + OVERALL_COPILOT_DEADLINE_MS;

    const systemInstruction = `
Bạn là AI Copilot của TRUSTRECOVER (Avalanche Mainnet 43114, Fuji 43113, Dispatch L1 779672).
Chọn targetTab đúng ý định:
- "dashboard": Tổng quan.
- "cases": Hồ sơ on-chain (TrustRecoverRegistry v2) & Hàng chờ Trọng tài (TrustRecoverArbitration).
- "analysis": Phân tích tranh chấp, đọc tệp/ảnh bằng chứng, hoặc chạy mẫu (loadDemo=true).
- "audit": Kiểm tra nhanh txHash, giải mã ERC-20/ABI/AWM, hoặc xác minh .json.
- "settings": Cấu hình & quyền Reviewer.

Khi có tệp/ảnh đính kèm, trích xuất chính xác vào autoFill (không bỏ trống nếu tệp có ghi):
- network: "mainnet" (43114), "fuji" (43113), hoặc "dispatch" (779672).
- txHash: mã giao dịch 0x (66 ký tự).
- claimedAmountAvax: CHỈ phần số thuần không dấu phẩy (VD: "16000", "4.9894").
- claimedAsset: "AVAX" | "WETH.e" | "USDC" | "WBTC.e" | "USDT.e" | "USD".
- claimedRecipient: địa chỉ ví nhận 0x (42 ký tự).
- claimedSender: địa chỉ người gửi/hợp đồng khai thác 0x (nếu có).
- userClaim: tóm tắt nội dung khiếu nại 1-2 câu (dưới 250 ký tự), KHÔNG chép nguyên văn trích dẫn dài.

Trả lời reply tối đa 2 câu bằng tiếng Việt; đặt targetTab="none" nếu người dùng chỉ hỏi đáp.`.trim();

    let promptText =
      message ||
      "Hãy đọc tệp/hình ảnh đính kèm này, trích xuất thông tin giao dịch/khiếu nại và điền vào biểu mẫu.";
    if (extractedFileText) {
      promptText += `\n\n[Nội dung tệp "${attachedFileName}"]:\n${extractedFileText}`;
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: promptText },
    ];
    if (fileBase64) {
      parts.push({ inlineData: { mimeType: fileMime, data: fileBase64 } });
    }

    let validatedData: z.infer<typeof CopilotZodSchema> | null = null;
    let lastError: unknown = null;

    for (const model of models) {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs < MIN_REMAINING_MS) {
        lastError = new Error("Đã hết ngân sách thời gian (48s) của Trợ lý AI.");
        break;
      }

      const perCap = fileBase64 ? 22_000 : 14_000;
      const attemptTimeoutMs = Math.min(remainingMs, perCap);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
      const t0 = Date.now();

      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: COPILOT_SCHEMA,
            temperature: 0.3,
            abortSignal: controller.signal,
          },
        });

        const raw = (res.text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        if (!raw) throw new Error("INVALID_COPILOT_JSON: Phản hồi AI rỗng.");

        let rawJson: unknown;
        try {
          rawJson = JSON.parse(raw);
        } catch {
          throw new Error("INVALID_COPILOT_JSON: Đầu ra không phải JSON hợp lệ.");
        }

        const parsed = CopilotZodSchema.safeParse(rawJson);
        if (!parsed.success) {
          throw new Error(
            `INVALID_COPILOT_JSON: Sai cấu trúc (${parsed.error.issues[0]?.path.join(".") || "root"}).`
          );
        }

        validatedData = parsed.data;
        logCopilotStage({
          stage: "COPILOT_AI_CALL",
          durationMs: Date.now() - t0,
          status: "OK",
          model,
          mimeType: attachedFileName ? fileMime : undefined,
          sizeBytes: fileSizeBytes || undefined,
        });
        break;
      } catch (err) {
        const { transient, code } = isTransientError(err);
        logCopilotStage({
          stage: "COPILOT_AI_CALL",
          durationMs: Date.now() - t0,
          status: "ERROR",
          model,
          mimeType: attachedFileName ? fileMime : undefined,
          sizeBytes: fileSizeBytes || undefined,
          errorCode: code,
        });
        lastError = err;
        if (!transient) {
          break;
        }
        if (code === "HTTP_503" && deadlineAt - Date.now() > MIN_REMAINING_MS + 600) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    if (!validatedData) {
      const msg = lastError instanceof Error ? lastError.message : "Trợ lý AI không phản hồi hợp lệ.";
      return NextResponse.json(
        {
          success: false,
          error: msg.replace(/AIza[A-Za-z0-9_-]+|AQ[A-Za-z0-9_-]+/g, "[REDACTED_KEY]"),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: validatedData }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi xử lý yêu cầu Trợ lý AI.";
    return NextResponse.json(
      {
        success: false,
        error: message.replace(/AIza[A-Za-z0-9_-]+|AQ[A-Za-z0-9_-]+/g, "[REDACTED_KEY]"),
      },
      { status: 500 }
    );
  }
}