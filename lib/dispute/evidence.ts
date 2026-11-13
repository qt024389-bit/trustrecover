import { createHash } from "crypto";
import type { EvidenceFileMeta } from "./types";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_EVIDENCE_FILES = 5;

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

export async function processUploadedEvidenceFiles(
  files: File[]
): Promise<{ processed: EvidenceFileMeta[]; errors: string[] }> {
  const processed: EvidenceFileMeta[] = [];
  const errors: string[] = [];

  if (files.length > MAX_EVIDENCE_FILES) {
    errors.push(`Chỉ cho phép tải lên tối đa ${MAX_EVIDENCE_FILES} tệp bằng chứng.`);
    return { processed, errors };
  }

  for (const file of files) {
    if (!file || file.size === 0) continue;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push(
        `Tệp "${file.name}" vượt quá giới hạn 5MB (${(file.size / 1024 / 1024).toFixed(2)}MB).`
      );
      continue;
    }

    const mime = file.type || "application/octet-stream";
    const isAllowed =
      ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
      /\.(txt|json|csv|md|log|pdf|png|jpg|jpeg|webp)$/i.test(file.name);

    if (!isAllowed) {
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
    if (
      TEXT_READABLE_MIMES.some((prefix) => mime.startsWith(prefix)) ||
      /\.(txt|json|csv|md|log)$/i.test(file.name)
    ) {
      extractedTextPreview = buffer.toString("utf-8").slice(0, 1500);
    }

    let inlineDataBase64: string | undefined = undefined;
    if (
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      /\.(png|jpg|jpeg|webp|pdf)$/i.test(file.name)
    ) {
      inlineDataBase64 = buffer.toString("base64");
    }

    processed.push({
      fileName: file.name,
      mimeType: mime === "application/octet-stream" && /\.png$/i.test(file.name) ? "image/png" : mime === "application/octet-stream" && /\.(jpg|jpeg)$/i.test(file.name) ? "image/jpeg" : mime === "application/octet-stream" && /\.pdf$/i.test(file.name) ? "application/pdf" : mime,
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