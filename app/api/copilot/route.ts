import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { checkRateLimit } from "@/lib/security/rateLimit";

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
    let extractedFileText: string | null = null;
    let attachedFileName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = String(formData.get("message") || "").trim();
      const rawFile = formData.get("file") || formData.get("image");
      if (rawFile instanceof File && rawFile.size > 0) {
        if (rawFile.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: "Tệp đính kèm không được vượt quá 5MB." },
            { status: 400 }
          );
        }
        attachedFileName = rawFile.name;
        const buf = Buffer.from(await rawFile.arrayBuffer());
        const mime = rawFile.type || "";
        if (
          mime.startsWith("image/") ||
          mime === "application/pdf" ||
          /\.(png|jpg|jpeg|webp|pdf)$/i.test(rawFile.name)
        ) {
          fileBase64 = buf.toString("base64");
          fileMime =
            mime ||
            (/\.pdf$/i.test(rawFile.name) ? "application/pdf" : "image/png");
        } else {
          extractedFileText = buf.toString("utf-8").slice(0, 3000);
        }
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
    const models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];

    const systemInstruction = `
Bạn là Trợ lý Điều hướng Thông minh (AI Copilot) của website TRUSTRECOVER trên mạng Avalanche (C-Chain Mainnet 43114, Fuji Testnet 43113, Dispatch L1 779672).
Người dùng có thể nhập chữ hoặc đính kèm hình ảnh/PDF/tệp văn bản (JSON, TXT, CSV, LOG) để yêu cầu bạn phân tích và thực hiện giúp.
Hãy chọn đúng targetTab:
- "dashboard": Xem tổng quan.
- "cases": Xem hồ sơ đã neo on-chain (TrustRecoverRegistry v2 0xccED...9D5F), tra cứu ngược, và Hàng chờ Trọng tài On-Chain (TrustRecoverArbitration 0xCc8E...4EC1) để Reviewer bỏ phiếu hoặc giải ngân ký quỹ AVAX.
- "analysis": Khiếu nại, phân tích tranh chấp, đọc bằng chứng từ ảnh/tệp, hoặc chạy kịch bản mẫu (loadDemo=true).
- "audit": Kiểm tra nhanh mã giao dịch (txHash) trên Avalanche Mainnet (43114), Fuji (43113) hoặc Dispatch L1 (779672), giải mã ERC-20/Verified ABI/Avalanche Warp Messaging, hoặc kiểm chứng file báo cáo .json.
- "settings": Xem cấu hình hoặc quản lý quyền Reviewer.

Nếu có tệp hoặc hình ảnh đính kèm:
- Đọc kỹ mọi chữ, mã 0x (txHash 66 ký tự hoặc địa chỉ ví 42 ký tự), số tiền AVAX, và nội dung trong tệp/ảnh.
- Tự động điền ĐẦY ĐỦ và CHÍNH XÁC các thông tin trích xuất được vào autoFill:
  + network: "mainnet" (nếu Avalanche C-Chain Mainnet / 43114), "fuji" (nếu Fuji / 43113), hoặc "dispatch" (nếu Dispatch L1 / 779672).
  + txHash: đúng mã giao dịch 0x...
  + claimedAmountAvax: BẮT BUỘC điền nếu tệp có số lượng, CHỈ điền phần số thuần không dấu phẩy (VD: "16000", "4.9894") (VD: "16000", "4.9894", "8000"), KHÔNG kèm chữ đơn vị.
  + claimedAsset: đúng đơn vị tiền tệ ("AVAX", "WETH.e", "USDC", "WBTC.e", "USDT.e", hoặc "USD").
  + claimedRecipient: BẮT BUỘC điền đúng địa chỉ ví nhận 0x... (42 ký tự) nếu tệp có ghi.
  + claimedSender: địa chỉ người gửi hoặc hợp đồng gửi/khai thác 0x... (nếu có trong tệp).
  + userClaim: nội dung khiếu nại đầy đủ, ghi rõ cả địa chỉ người gửi/hợp đồng gửi nếu có.
- Trò chuyện tự nhiên, thân thiện và giải thích rõ ràng bằng tiếng Việt như một chuyên gia hỗ trợ người dùng DeFi. Chỉ chọn targetTab khác "none" khi người dùng thực sự muốn mở tab, chạy mẫu hoặc điền biểu mẫu; nếu họ chỉ đang hỏi đáp/tìm hiểu thì đặt targetTab = "none" để không làm gián đoạn màn hình hiện tại.
`.trim();

    let promptText =
      message ||
      "Hãy đọc tệp/hình ảnh đính kèm này, trích xuất thông tin giao dịch/khiếu nại và đưa tôi đến chức năng phù hợp.";
    if (extractedFileText) {
      promptText += `\n\n[Nội dung tệp đính kèm "${attachedFileName}"]:\n${extractedFileText}`;
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: promptText },
    ];
    if (fileBase64) {
      parts.push({ inlineData: { mimeType: fileMime, data: fileBase64 } });
    }

    let responseText: string | undefined;
    let lastErrMsg = "";
    const attemptModels = [...models];
    for (const model of attemptModels) {
      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: COPILOT_SCHEMA,
              temperature: 0.45,
              maxOutputTokens: 8192,
            },
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT_14S")), 14000)),
        ]);
        responseText = res.text;
        if (responseText) break;
      } catch (err) {
        lastErrMsg = err instanceof Error ? err.message : String(err);
        if (!lastErrMsg.includes("429") && !lastErrMsg.includes("404") && (lastErrMsg.includes("503") || lastErrMsg.includes("UNAVAILABLE"))) {
          await new Promise((r) => setTimeout(r, 500));
        }
        continue;
      }
    }

    if (!responseText) {
      throw new Error(`Trợ lý AI đang bận tạm thời (${lastErrMsg.slice(0, 140) || "no_response"}).`);
    }

    const cleanJson = responseText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleanJson);
    return NextResponse.json({ success: true, data: parsed }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Không thể xử lý yêu cầu Copilot.",
      },
      { status: 500 }
    );
  }
}