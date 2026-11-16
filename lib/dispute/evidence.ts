import { createHash } from "crypto";
import { extractText } from "unpdf";
import type { EvidenceFileMeta } from "./types";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_MULTIMODAL_INLINE_BYTES = 3 * 1024 * 1024; // An toàn dưới trần 4.5MB Vercel
export const MAX_EVIDENCE_FILES = 5;
const MAX_TEXT_CHARS = 3500;

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

const TEXT_READABLE_MIMES = [
  "text/plain",
  "application/json",
  "text/csv",
  "text/markdown",
];

function normalizeMime(rawMime: string, fileName: string): string {
  if (rawMime && rawMime !== "application/octet-stream") return rawMime;
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.(jpg|jpeg)$/i.test(fileName)) return "image/jpeg";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.json$/i.test(fileName)) return "application/json";
  if (/\.csv$/i.test(fileName)) return "text/csv";
  if (/\.md$/i.test(fileName)) return "text/markdown";
  return "text/plain";
}

function logEvidenceStage(data: {
  stage: string;
  durationMs: number;
  status: "OK" | "ERROR";
  mimeType: string;
  sizeBytes: number;
  errorCode?: string;
}) {
  console.log(JSON.stringify({ service: "TRUSTRECOVER_EVIDENCE", ...data }));
}

export async function processUploadedEvidenceFiles(
  files: File[]
): Promise<{ processed: EvidenceFileMeta[]; errors: string[] }> {
  const processed: EvidenceFileMeta[] = [];
  const errors: string[] = [];

  if (files.length > MAX_EVIDENCE_FILES) {
    errors.push(`Chỉ cho phép tải lên tối đa ${MAX_EVIDENCE_FILES} tệp bằng chứng.`);
    return { processed, errors };
  }

  let totalInlineBytes = 0;

  for (const file of files) {
    if (!file || file.size === 0) continue;
    const t0 = Date.now();
    const mime = normalizeMime(file.type || "", file.name);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      logEvidenceStage({
        stage: "FILE_PROCESSING",
        durationMs: Date.now() - t0,
        status: "ERROR",
        mimeType: mime,
        sizeBytes: file.size,
        errorCode: "FILE_TOO_LARGE",
      });
      errors.push(
        `Tệp "${file.name}" vượt quá giới hạn 5MB (${(file.size / 1024 / 1024).toFixed(2)}MB).`
      );
      continue;
    }

    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
      /\.(txt|json|csv|md|log|pdf|png|jpg|jpeg|webp)$/i.test(file.name);

    if (!isAllowed) {
      logEvidenceStage({
        stage: "FILE_PROCESSING",
        durationMs: Date.now() - t0,
        status: "ERROR",
        mimeType: mime,
        sizeBytes: file.size,
        errorCode: "UNSUPPORTED_MIME",
      });
      errors.push(
        `Tệp "${file.name}" có định dạng không được hỗ trợ (${mime}). Chỉ hỗ trợ TXT, JSON, CSV, MD, LOG, PDF, PNG, JPG, WEBP.`
      );
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256Hex =
      "0x" + createHash("sha256").update(buffer).digest("hex");

    let extractedTextPreview: string | undefined = undefined;
    let inlineDataBase64: string | undefined = undefined;

    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = mime.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    const isText =
      TEXT_READABLE_MIMES.some((prefix) => mime.startsWith(prefix)) ||
      /\.(txt|json|csv|md|log)$/i.test(file.name);

    if (isText) {
      extractedTextPreview = buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS);
    } else if (isPdf) {
      try {
        const pdfRes = await extractText(new Uint8Array(buffer), { mergePages: true });
        const txt = (
          Array.isArray(pdfRes.text) ? pdfRes.text.join("\n") : String(pdfRes.text || "")
        ).trim();
        if (txt.length >= 80) {
          extractedTextPreview = txt.slice(0, MAX_TEXT_CHARS);
        }
      } catch {
        // Fallback sang multimodal bên dưới nếu không tách được text
      }
      if (!extractedTextPreview) {
        if (totalInlineBytes + file.size > MAX_MULTIMODAL_INLINE_BYTES) {
          logEvidenceStage({
            stage: "FILE_PROCESSING",
            durationMs: Date.now() - t0,
            status: "ERROR",
            mimeType: mime,
            sizeBytes: file.size,
            errorCode: "PDF_SCAN_PAYLOAD_LIMIT",
          });
          errors.push(
            `PDF scan "${file.name}" quá lớn để xử lý multimodal (${(file.size / 1024 / 1024).toFixed(2)}MB). Vui lòng nén dưới 3MB hoặc tách trang.`
          );
          continue;
        }
        inlineDataBase64 = buffer.toString("base64");
        totalInlineBytes += file.size;
      }
    } else if (isImage) {
      if (totalInlineBytes + file.size > MAX_MULTIMODAL_INLINE_BYTES) {
        logEvidenceStage({
          stage: "FILE_PROCESSING",
          durationMs: Date.now() - t0,
          status: "ERROR",
          mimeType: mime,
          sizeBytes: file.size,
          errorCode: "IMAGE_PAYLOAD_LIMIT",
        });
        errors.push(
          `Tổng dung lượng ảnh gửi phân tích vượt ngưỡng 3MB ("${file.name}"). Vui lòng nén nhỏ ảnh trước khi tải lên.`
        );
        continue;
      }
      inlineDataBase64 = buffer.toString("base64");
      totalInlineBytes += file.size;
    }

    logEvidenceStage({
      stage: "FILE_PROCESSING",
      durationMs: Date.now() - t0,
      status: "OK",
      mimeType: mime,
      sizeBytes: file.size,
    });

    processed.push({
      fileName: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      sha256CommitmentHash: sha256Hex,
      integrityNote:
        "SHA-256 chỉ chứng minh tính toàn vẹn nội dung tệp so với phiên bản đã cam kết, không tự động chứng minh nội dung trong tệp là xác thực.",
      extractedTextPreview,
      inlineDataBase64,
    });
  }

  return { processed, errors };
}