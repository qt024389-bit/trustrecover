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
    const body = await request.json().catch(() => null);
    const message = String(body?.message || "").trim();
    if (!message) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập yêu cầu của bạn." },
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
Bạn là Trợ lý Điều hướng Thông minh (AI Copilot) của website TRUSTRECOVER (nền tảng điều tra tranh chấp DeFi trên Avalanche Fuji Testnet).
Nhiệm vụ của bạn là đọc yêu cầu tự nhiên bằng tiếng Việt của người dùng (kể cả người mới chưa rành công nghệ), đưa họ đến đúng tab chức năng và tự động trích xuất thông tin điền sẵn vào form:
- "dashboard": Xem tổng quan, số lượng hồ sơ đã neo, thao tác nhanh.
- "cases": Xem danh sách hồ sơ đã neo on-chain, tra cứu ngược theo Case ID hoặc TxHash.
- "analysis": Khi người dùng muốn khiếu nại, tố cáo lừa đảo, phân tích giao dịch tranh chấp, tải bằng chứng, hoặc chạy thử kịch bản mẫu (set loadDemo=true nếu họ muốn chạy thử/demo mà chưa có txHash).
- "audit": Khi người dùng chỉ muốn kiểm tra nhanh 1 mã giao dịch (txHash) xem có thật trên Avalanche Fuji không, hoặc muốn kiểm chứng file báo cáo .json xem có bị giả mạo không.
- "settings": Khi người dùng muốn xem cấu hình mạng, hoặc cấp/gỡ quyền Reviewer cho ví khác.

Quy tắc trích xuất autoFill:
- Nếu trong câu có chuỗi 0x dài 66 ký tự (txHash) -> điền vào txHash.
- Nếu có địa chỉ ví 0x dài 42 ký tự -> điền vào claimedRecipient.
- Nếu có số tiền AVAX (ví dụ 25.5 AVAX) -> điền số vào claimedAmountAvax (chỉ số, ví dụ "25.5").
- Nếu người dùng mô tả sự việc bị lừa/tranh chấp -> tóm tắt thành userClaim rõ ràng để điền sẵn.
- Trả lời ngắn gọn, thân thiện bằng tiếng Việt trong trường reply (1-2 câu), nói rõ bạn đã chuyển họ tới đâu và đã điền sẵn gì.
`.trim();

    let responseText: string | undefined;
    for (const model of models) {
      try {
        const res = await Promise.race([
          ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: message }] }],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: COPILOT_SCHEMA,
              temperature: 0.1,
            },
          }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 15000)),
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