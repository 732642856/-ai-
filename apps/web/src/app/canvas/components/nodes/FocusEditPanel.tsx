// ============================================================================
// FocusEditPanel - 局部重绘/焦点编辑弹窗组件
// 使用 react-canvas-masker 绘制蒙版，调用 AI 进行局部编辑
// ============================================================================
"use client";

import { useState, useRef, useCallback } from "react";
import { MaskEditor, toMask } from "react-canvas-masker";
import {
  X,
  Wand2,
  Undo2,
  Redo2,
  Eraser,
  Loader2,
  Check,
} from "lucide-react";
import { DESIGN_TOKENS } from "../../styles/designSystem";
import { toDataUrl } from "../../utils/toDataUrl";

interface FocusEditPanelProps {
  /** 原始图片 URL */
  imageUrl: string;
  /** 可选 assetId */
  assetId?: string;
  /** 编辑完成回调（返回新图片 URL） */
  onResult: (resultImageUrl: string) => void;
  /** 关闭弹窗 */
  onClose: () => void;
}

export default function FocusEditPanel({
  imageUrl,
  onResult,
  onClose,
}: FocusEditPanelProps) {
  const maskEditorRef = useRef<any>(null);
  const [instruction, setInstruction] = useState("");
  const [brushSize, setBrushSize] = useState(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!instruction.trim() || !maskEditorRef.current?.maskCanvas) return;

    setIsGenerating(true);
    setError(null);

    try {
      // 将 imageUrl 转为 data URL（blob URL 会导致后端无法访问）
      let dataUrl = imageUrl;
      if (!imageUrl.startsWith("data:")) {
        try {
          dataUrl = await toDataUrl(imageUrl);
        } catch {
          throw new Error("图片未持久化，请先保存");
        }
      }

      // Extract mask as base64 from the mask canvas
      const maskCanvas = maskEditorRef.current.maskCanvas as HTMLCanvasElement;
      const maskBase64 = toMask(maskCanvas);

      const res = await fetch("/api/ai/focus-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: dataUrl,
          maskBase64,
          instruction: instruction.trim(),
          model: "gpt-image-2",
          size: "1024x1024",
          requestId: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          typeof errData.error === "string"
            ? errData.error
            : errData.error?.userMessage || "生成失败"
        );
      }

      const result = await res.json();
      if (!result.imageUrl) throw new Error("No image data returned");

      setResultUrl(result.imageUrl);
      onResult(result.imageUrl);
    } catch (err: any) {
      setError(err?.message || "生成失败");
    } finally {
      setIsGenerating(false);
    }
  }, [instruction, imageUrl, onResult]);

  const handleUndo = useCallback(() => {
    maskEditorRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    maskEditorRef.current?.redo();
  }, []);

  const handleClear = useCallback(() => {
    maskEditorRef.current?.clear();
  }, []);

  const handleApplyResult = useCallback(() => {
    if (resultUrl) {
      onResult(resultUrl);
      onClose();
    }
  }, [resultUrl, onResult, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[860px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: DESIGN_TOKENS.panelSolid,
          borderColor: DESIGN_TOKENS.border,
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2">
            <Wand2 size={18} strokeWidth={1.5} style={{ color: DESIGN_TOKENS.accent }} />
            <span
              className="text-sm font-medium"
              style={{ color: DESIGN_TOKENS.textPrimary }}
            >
              焦点编辑
            </span>
            <span
              className="text-xs"
              style={{ color: DESIGN_TOKENS.textMuted }}
            >
              · 在图片上涂抹选中区域，输入修改指令
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Body: two-column layout ── */}
        <div className="flex flex-1 gap-4 overflow-auto p-4">
          {/* Left: Mask Editor */}
          <div className="flex-1">
            <div
              className="overflow-hidden rounded-xl"
              style={{
                border: `1px solid ${DESIGN_TOKENS.border}`,
                backgroundColor: "rgba(0,0,0,0.3)",
                minHeight: "400px",
                maxHeight: "550px",
              }}
            >
              <MaskEditor
                src={imageUrl}
                canvasRef={maskEditorRef}
                cursorSize={brushSize}
                onCursorSizeChange={setBrushSize}
                maskColor="#ffffff"
                maskOpacity={0.45}
                onDrawingChange={() => {}}
                maxWidth={1024}
                maxHeight={1024}
                crossOrigin="anonymous"
              />
            </div>

            {/* ── Mask tool buttons ── */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleUndo}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                style={{
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.textSecondary,
                }}
              >
                <Undo2 size={13} strokeWidth={1.5} />
                <span>撤销</span>
              </button>
              <button
                onClick={handleRedo}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                style={{
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.textSecondary,
                }}
              >
                <Redo2 size={13} strokeWidth={1.5} />
                <span>重做</span>
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                style={{
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.textSecondary,
                }}
              >
                <Eraser size={13} strokeWidth={1.5} />
                <span>清除蒙版</span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span
                  className="text-[11px]"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  画笔大小
                </span>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-20 accent-violet-500"
                  style={{ cursor: "pointer" }}
                />
                <span
                  className="w-6 text-center text-[11px]"
                  style={{ color: DESIGN_TOKENS.textMuted }}
                >
                  {brushSize}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Preview / Result */}
          <div className="flex w-[280px] flex-shrink-0 flex-col gap-3">
            {/* Instruction input */}
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: DESIGN_TOKENS.border }}
            >
              <label
                className="mb-1.5 block text-[11px] font-medium"
                style={{ color: DESIGN_TOKENS.textSecondary }}
              >
                修改指令
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例如：添加蝴蝶结、变成蓝色"
                className="nodrag nopan nowheel w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none"
                style={{
                  borderColor: DESIGN_TOKENS.border,
                  color: DESIGN_TOKENS.textPrimary,
                  minHeight: "80px",
                }}
                rows={3}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !instruction.trim()}
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40"
              style={{
                backgroundColor: instruction.trim()
                  ? DESIGN_TOKENS.accent
                  : "rgba(255,255,255,0.08)",
                color: "#fff",
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>编辑中...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} strokeWidth={1.5} />
                  <span>生成</span>
                </>
              )}
            </button>

            {/* Result preview */}
            {resultUrl && (
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: DESIGN_TOKENS.border }}
              >
                <label
                  className="mb-1.5 block text-[11px] font-medium"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  编辑结果
                </label>
                <div
                  className="mb-2 flex items-center justify-center overflow-hidden rounded-lg"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.2)",
                    minHeight: "120px",
                  }}
                >
                  <img
                    src={resultUrl}
                    alt="编辑结果"
                    className="max-h-[200px] object-contain"
                  />
                </div>
                <button
                  onClick={handleApplyResult}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.2)",
                    color: "#34d399",
                  }}
                >
                  <Check size={14} strokeWidth={1.5} />
                  <span>应用结果</span>
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-lg px-3 py-2"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
              >
                <span className="text-[11px] text-red-300/70">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer hint ── */}
        <div
          className="border-t px-4 py-2"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div
            className="text-[11px]"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            提示：用画笔在图片上涂抹要修改的区域，然后输入描述。滚轮调整画笔大小，Space+拖拽平移画布。
          </div>
        </div>
      </div>
    </>
  );
}
