"use client";

import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { ClipboardPaste, FileText, Loader2, Scissors, Sparkles, Upload, X } from "lucide-react";
import { DESIGN_TOKENS } from "../../styles/designSystem";
import { isTextDocumentFile, readTextDocumentFile } from "@/lib/documents/textDocumentImport";

export type ScriptImportPayload = {
  title: string;
  text: string;
  source: "paste" | "file";
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  splitToShots: boolean;
  openBibleAfterImport: boolean;
};

type ScriptImportPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onImportScript: (payload: ScriptImportPayload) => void;
};

type ImportedFileState = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

function countCharacters(text: string): number {
  return text.replace(/\s+/g, "").length;
}

function createDefaultTitle(fileName?: string): string {
  const trimmed = fileName?.replace(/\.[^.]+$/, "").trim();
  return trimmed || "导入剧本";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ScriptImportPanel({ isOpen, onClose, onImportScript }: ScriptImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("导入剧本");
  const [text, setText] = useState("");
  const [fileState, setFileState] = useState<ImportedFileState | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [splitToShots, setSplitToShots] = useState(true);
  const [openBibleAfterImport, setOpenBibleAfterImport] = useState(true);

  const characterCount = useMemo(() => countCharacters(text), [text]);
  const canImport = text.trim().length > 0 && !isParsing;

  const reset = useCallback(() => {
    setTitle("导入剧本");
    setText("");
    setFileState(null);
    setError(null);
    setIsParsing(false);
    setSplitToShots(true);
    setOpenBibleAfterImport(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const parseFile = useCallback(async (file: File) => {
    if (!isTextDocumentFile(file)) {
      setError("当前 main 架构先接入 TXT / Markdown 剧本文档；PDF/DOCX 请先转成文本再导入。");
      return;
    }

    setIsParsing(true);
    setError(null);
    try {
      const document = await readTextDocumentFile(file);
      setTitle(createDefaultTitle(document.fileName));
      setText(document.text);
      setFileState({
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
      });
    } catch (err: any) {
      setError(err?.message || "剧本文档解析失败");
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    parseFile(file);
  }, [parseFile]);

  const handleImport = useCallback(() => {
    const sourceText = text.trim();
    if (!sourceText) {
      setError("请先粘贴剧本文本，或导入 TXT / Markdown 剧本文件。");
      return;
    }

    onImportScript({
      title: title.trim() || createDefaultTitle(fileState?.fileName),
      text: sourceText,
      source: fileState ? "file" : "paste",
      fileName: fileState?.fileName,
      fileSize: fileState?.fileSize,
      mimeType: fileState?.mimeType,
      splitToShots,
      openBibleAfterImport,
    });
    reset();
    onClose();
  }, [fileState, onClose, onImportScript, openBibleAfterImport, reset, splitToShots, text, title]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6" data-testid="script-import-panel">
      <button
        type="button"
        aria-label="关闭导入剧本面板"
        className="absolute inset-0 cursor-default bg-black/60"
        onClick={handleClose}
      />

      <section
        className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
          boxShadow: DESIGN_TOKENS.shadowPanel,
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: DESIGN_TOKENS.accentSoft }}>
              <FileText size={18} strokeWidth={1.7} style={{ color: DESIGN_TOKENS.accentHover }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: DESIGN_TOKENS.text }}>
                导入剧本并进入 AI 分析
              </h2>
              <p className="mt-1 text-xs leading-5" style={{ color: DESIGN_TOKENS.textMuted }}>
                按当前 main 架构导入为「故事分镜」源节点，可立即拆分 Shot，并打开 Character / Scene / Visual Bible 面板继续统一设定。
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 transition hover:bg-white/10"
            onClick={handleClose}
            title="关闭"
          >
            <X size={16} strokeWidth={1.7} style={{ color: DESIGN_TOKENS.textMuted }} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <aside className="space-y-3">
              <button
                type="button"
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-7 text-center transition hover:bg-white/5"
                style={{ borderColor: DESIGN_TOKENS.borderStrong }}
                onClick={() => fileInputRef.current?.click()}
              >
                {isParsing ? (
                  <Loader2 size={28} className="animate-spin" style={{ color: DESIGN_TOKENS.accentHover }} />
                ) : (
                  <Upload size={28} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accentHover }} />
                )}
                <span className="mt-3 text-sm font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  选择剧本文件
                </span>
                <span className="mt-1 text-[11px] leading-4" style={{ color: DESIGN_TOKENS.textMuted }}>
                  TXT / Markdown · 1MB 内
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                className="hidden"
                onChange={handleFileChange}
              />

              {fileState ? (
                <div className="rounded-2xl border p-3" style={{ borderColor: DESIGN_TOKENS.border, backgroundColor: DESIGN_TOKENS.card }}>
                  <div className="flex items-center gap-2 text-xs font-medium" style={{ color: DESIGN_TOKENS.text }}>
                    <FileText size={14} />
                    <span className="truncate">{fileState.fileName}</span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {formatFileSize(fileState.fileSize)} · {fileState.mimeType}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border p-3 text-[11px] leading-5" style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}>
                  也可以直接在右侧粘贴完整剧本文本。PDF/DOCX 会在后续 OCR/解析链路补齐；当前先用纯文本闭环。
                </div>
              )}

              <label className="flex items-start gap-2 rounded-2xl border p-3 text-xs" style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}>
                <input
                  type="checkbox"
                  checked={splitToShots}
                  onChange={(event) => setSplitToShots(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  导入后自动拆分 Shot
                  <span className="block pt-1 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    使用现有 parseStoryboardTextToShots，不新增高冲突流程。
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-2xl border p-3 text-xs" style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}>
                <input
                  type="checkbox"
                  checked={openBibleAfterImport}
                  onChange={(event) => setOpenBibleAfterImport(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  同时打开 Bible 面板
                  <span className="block pt-1 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    导入后立即整理角色、场景和视觉风格。
                  </span>
                </span>
              </label>
            </aside>

            <main className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                  项目 / 剧本标题
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border bg-black/30 px-4 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.text }}
                  placeholder="例如：隐门探案 第 1 集"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="text-xs font-medium" style={{ color: DESIGN_TOKENS.textSecondary }}>
                    剧本文本
                  </label>
                  <span className="text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
                    {characterCount} 字
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    setError(null);
                    if (!fileState) setTitle((current) => current || "导入剧本");
                  }}
                  className="min-h-[360px] w-full resize-none rounded-2xl border bg-black/35 px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
                  style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
                  placeholder="粘贴剧本、故事梗概、文字分镜或场次文本……"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {error}
                </div>
              ) : null}
            </main>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4" style={{ borderColor: DESIGN_TOKENS.border }}>
          <div className="flex items-center gap-2 text-[11px]" style={{ color: DESIGN_TOKENS.textMuted }}>
            <ClipboardPaste size={13} />
            <span>导入不会触发外部 AI 请求；拆分 Shot 走本地解析。</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-xs transition hover:bg-white/10"
              style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textMuted }}
              onClick={handleClose}
            >
              取消
            </button>
            <button
              type="button"
              disabled={!canImport}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: DESIGN_TOKENS.accent, color: "#fff" }}
              onClick={handleImport}
              data-testid="script-import-submit"
            >
              {splitToShots ? <Scissors size={14} /> : <Sparkles size={14} />}
              {splitToShots ? "导入并拆分 Shot" : "导入到画布"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
