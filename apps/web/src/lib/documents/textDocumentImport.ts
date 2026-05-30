import type { Node } from "@xyflow/react";
import type { CanvasNodeData } from "@/app/canvas/components/canvas/types";

export const TEXT_DOCUMENT_MAX_BYTES = 1024 * 1024;

const TEXT_DOCUMENT_EXTENSIONS = new Set(["txt", "md", "markdown"]);
const TEXT_DOCUMENT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

export type ImportedTextDocument = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  text: string;
  uploadedAt: string;
};

export function getFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName.trim().toLowerCase());
  return match?.[1] ?? "";
}

export function isTextDocumentFile(file: Pick<File, "name" | "type">): boolean {
  const extension = getFileExtension(file.name);
  return (
    TEXT_DOCUMENT_EXTENSIONS.has(extension) ||
    TEXT_DOCUMENT_MIME_TYPES.has(file.type)
  );
}

export async function readTextDocumentFile(file: File): Promise<ImportedTextDocument> {
  if (!isTextDocumentFile(file)) {
    throw new Error("暂只支持 TXT 和 Markdown 文档");
  }

  if (file.size > TEXT_DOCUMENT_MAX_BYTES) {
    throw new Error("文档过大，请先拆分或压缩到 1MB 以内");
  }

  const text = await file.text();
  const normalizedText = text.replace(/^\uFEFF/, "").trim();

  if (!normalizedText) {
    throw new Error("文档内容为空");
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || `text/${getFileExtension(file.name) || "plain"}`,
    text: normalizedText,
    uploadedAt: new Date().toISOString(),
  };
}

export function estimateDocumentNodeSize(text: string): { width: number; height: number } {
  const width = 560;
  const charsPerLine = Math.max(28, Math.floor((width - 64) / 14));
  const lines = text.split(/\n/);
  const wrappedLines = lines.reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  const chromeHeight = 210;
  const lineHeight = 22;
  return {
    width,
    height: Math.min(1180, Math.max(420, wrappedLines * lineHeight + chromeHeight)),
  };
}

export function createDocumentNode(input: {
  id: string;
  document: ImportedTextDocument;
  position: { x: number; y: number };
}): Node<CanvasNodeData> {
  const size = estimateDocumentNodeSize(input.document.text);

  return {
    id: input.id,
    type: "content",
    position: input.position,
    width: size.width,
    height: size.height,
    measured: size,
    data: {
      title: input.document.fileName,
      nodeKind: "document",
      content: input.document.text,
      prompt: input.document.text,
      summary: `上传文档 · ${Math.round(input.document.fileSize / 1024)} KB`,
      fileName: input.document.fileName,
      fileSize: input.document.fileSize,
      mimeType: input.document.mimeType,
      uploadedAt: input.document.uploadedAt,
      autoSizeMode: "fixed-width-height-grows",
      displayWidth: size.width,
      displayHeight: size.height,
      source: "upload",
      createdAt: Date.now(),
    },
  };
}
