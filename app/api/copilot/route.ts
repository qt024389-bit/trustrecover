import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { checkRateLimit } from "@/lib/security/rateLimit";

const COPILOT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    targetTab: {
      type: Type.STRING,
      enum: ["dashboard", "cases", "analysis", "audit", "settings"],
    },
    autoFill: {
      type: Type.OBJECT,
      properties: {
        txHash: { type: Type.STRING },
        userClaim: { type: Type.STRING },
        claimedAmountAvax: { type: Type.STRING },
        claimedRecipient: { type: Type.STRING },
        loadDemo: { type: Type.BOOLEAN },
      },
    },
  },
  required: ["reply", "targetTab"],
};

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
    let imageBase64: string | null = null;
    let imageMime = "image/png";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = String(formData.get("message") || "").trim();
      const file = formData.get("image");
      if (file instanceof File && file.size > 0) {
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: "Ảnh đính kèm không được vượt quá 5MB." },
            { status: 400 }
          );
        }
        const buf = Buffer.from(await file.arrayBuffer());
        imageBase64 = buf.toString("base64");
        imageMime = file.type || "image/png";
      }
    } else {
      const body = await request.json().catch(() => null);
      message = String(body?.message || "").trim();
    }

    if (!message && !imageBase64) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập yêu cầu hoặc đính kèm hình ảnh." },
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
    const models = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

    const systemInstruction = `
Bạn là Trợ lý Điều hướng Thông minh (AI Copilot) của website TRUSTRECOVER trên Avalanche Fuji Testnet.
Người dùng có thể nhập chữ, hoặc đính kèm hình ảnh (ảnh chụp ví, ảnh giao dịch, ảnh tin nhắn, ảnh lỗi) để yêu cầu bạn phân tích và thực hiện giúp.
Hãy chọn đúng targetTab:
- "dashboard": Xem tổng quan.
- "cases": Xem hồ sơ đã neo on-chain, tra cứu ngược.
- "analysis": Khiếu nại, phân tích tranh chấp, đọc bằng chứng từ ảnh/text, hoặc chạy kịch bản mẫu (loadDemo=true).
- "audit": Kiểm tra nhanh mã giao dịch (txHash) trên Fuji hoặc kiểm chứng file báo cáo .json.
- "settings": Xem cấu hình hoặc quản lý quyền Reviewer.

Nếu có hình ảnh đính kèm:
- Đọc kỹ mọi chữ, mã 0x (txHash 66 ký tự hoặc địa chỉ ví 42 ký tự), số tiền AVAX, và nội dung tranh chấp/lỗi trong ảnh.
- Tự động điền các thông tin trích xuất được vào autoFill (txHash, claimedRecipient, claimedAmountAvax, userClaim).
- Nếu ảnh là yêu cầu làm theo giao diện/hành động cụ thể, tóm tắt ngắn gọn trong reply (1-2 câu tiếng Việt) bạn đã đọc được gì từ ảnh và đã chuyển người dùng tới tab nào.
`.trim();

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      {
        text: message || "Hãy đọc hình ảnh đính kèm này, trích xuất thông tin giao dịch/khiếu nại và đưa tôi đến chức năng phù hợp.",
      },
    ];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: imageMime, data: imageBase64 } });
    }

    let responseText: string | undefined;
    for (const model of models) {
      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: COPILOT_SCHEMA,
              temperature: 0.1,
            },
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 20000)),
        ]);
        responseText = res.text;
        if (responseText) break;
      } catch {
        continue;
      }
    }

    if (!responseText) {
      throw new Error("Trợ lý AI đang bận tạm thời, vui lòng thử lại sau vài giây.");
    }

    const parsed = JSON.parse(responseText);
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