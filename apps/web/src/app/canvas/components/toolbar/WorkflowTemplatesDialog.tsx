/**
 * WorkflowTemplatesDialog — 工作流模板管理弹窗
 * - 保存/加载/删除/导出工作流模板
 * - 对标 TapNow 的克隆机制和 LibTV 的打组保存
 */

"use client"

import { useState, useCallback } from "react"
import {
  X,
  Save,
  Download,
  Upload,
  Trash2,
  FileJson,
  Copy,
  Clock,
  Layers,
  ArrowRightLeft,
} from "lucide-react"
import { DESIGN_TOKENS, ICON_CONFIG } from "../../styles/designSystem"
import type { WorkflowTemplate } from "../../hooks/useWorkflowTemplates"

interface WorkflowTemplatesDialogProps {
  isOpen: boolean
  onClose: () => void
  templates: WorkflowTemplate[]
  onSave: (name: string) => void
  onLoad: (template: WorkflowTemplate) => void
  onDelete: (templateId: string) => void
  onExport: (templateId: string) => void
  onImport: (jsonString: string) => void
}

export function WorkflowTemplatesDialog({
  isOpen,
  onClose,
  templates,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onImport,
}: WorkflowTemplatesDialogProps) {
  const [tab, setTab] = useState<"save" | "load">("save")
  const [saveName, setSaveName] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return
    onSave(saveName.trim())
    setSaveName("")
    setTab("load")
  }, [saveName, onSave])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const json = reader.result as string
          onImport(json)
          setImportError(null)
          setTab("load")
        } catch {
          setImportError("文件格式无效，请检查 JSON 结构")
        }
      }
      reader.onerror = () => {
        setImportError("文件读取失败")
      }
      reader.readAsText(file)

      // Reset input
      e.target.value = ""
    },
    [onImport],
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[70vh] w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "rgba(20,20,24,0.97)",
          borderColor: DESIGN_TOKENS.border,
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <div className="flex items-center gap-2.5">
            <Layers size={20} strokeWidth={2} style={{ color: DESIGN_TOKENS.accent }} />
            <span className="text-base font-semibold" style={{ color: DESIGN_TOKENS.textPrimary }}>
              工作流模板
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ color: DESIGN_TOKENS.textMuted }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b px-5"
          style={{ borderColor: DESIGN_TOKENS.border }}
        >
          <button
            onClick={() => setTab("save")}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === "save" ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
            }}
          >
            保存当前
            {tab === "save" && (
              <div
                className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: DESIGN_TOKENS.accent }}
              />
            )}
          </button>
          <button
            onClick={() => setTab("load")}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === "load" ? DESIGN_TOKENS.accent : DESIGN_TOKENS.textMuted,
            }}
          >
            加载模板
            {tab === "load" && (
              <div
                className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: DESIGN_TOKENS.accent }}
              />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "save" ? (
            <div className="space-y-4">
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  style={{ color: DESIGN_TOKENS.textSecondary }}
                >
                  模板名称
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                  }}
                  placeholder="例如：都市悬疑前5集管线"
                  className="w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderColor: DESIGN_TOKENS.border,
                    color: DESIGN_TOKENS.textPrimary,
                  }}
                  autoFocus
                />
              </div>

              <p className="text-xs leading-relaxed" style={{ color: DESIGN_TOKENS.textMuted }}>
                保存当前画布上的所有节点和连线为一个可复用模板。图片会保留引用（不保存原始文件）。
              </p>

              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
                style={{
                  backgroundColor: saveName.trim()
                    ? DESIGN_TOKENS.accent
                    : "rgba(255,255,255,0.08)",
                  color: saveName.trim() ? "#fff" : DESIGN_TOKENS.textMuted,
                  cursor: saveName.trim() ? "pointer" : "not-allowed",
                }}
              >
                <Save size={16} strokeWidth={2} />
                保存模板
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Import */}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors hover:bg-white/5"
                style={{ borderColor: DESIGN_TOKENS.border, color: DESIGN_TOKENS.textSecondary }}
              >
                <Upload size={16} strokeWidth={2} style={{ color: DESIGN_TOKENS.accent }} />
                导入 JSON 模板
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>

              {importError && (
                <p className="text-xs" style={{ color: "#ef4444" }}>
                  {importError}
                </p>
              )}

              {/* Template List */}
              {templates.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: DESIGN_TOKENS.textMuted }}>
                    暂无保存的模板
                  </p>
                  <p className="mt-1 text-xs" style={{ color: DESIGN_TOKENS.textMuted }}>
                    切换到「保存当前」创建第一个模板
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-white/5"
                      style={{ borderColor: DESIGN_TOKENS.border }}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate text-sm font-medium"
                          style={{ color: DESIGN_TOKENS.textPrimary }}
                        >
                          {template.name}
                        </div>
                        <div
                          className="mt-0.5 flex items-center gap-3 text-xs"
                          style={{ color: DESIGN_TOKENS.textMuted }}
                        >
                          <span className="flex items-center gap-1">
                            <Layers size={12} />
                            {template.nodeCount} 节点
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowRightLeft size={12} />
                            {template.edgeCount} 连线
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(template.createdAt).toLocaleDateString("zh-CN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => onLoad(template)}
                          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                          style={{ color: DESIGN_TOKENS.accent }}
                          title="加载此模板"
                        >
                          <Copy size={14} strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => onExport(template.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                          style={{ color: DESIGN_TOKENS.textSecondary }}
                          title="导出为 JSON"
                        >
                          <Download size={14} strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(template.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
                          style={{ color: "#ef4444" }}
                          title="删除模板"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 z-[60]" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} />
          <div
            className="fixed left-1/2 top-1/2 z-[70] flex w-[320px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-2xl"
            style={{
              backgroundColor: "rgba(20,20,24,0.98)",
              borderColor: DESIGN_TOKENS.border,
            }}
          >
            <p className="text-sm" style={{ color: DESIGN_TOKENS.textPrimary }}>
              确定要删除此模板吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg px-4 py-2 text-sm transition-colors hover:bg-white/10"
                style={{ color: DESIGN_TOKENS.textSecondary }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  onDelete(confirmDeleteId)
                  setConfirmDeleteId(null)
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "#ef4444",
                  color: "#fff",
                }}
              >
                删除
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default WorkflowTemplatesDialog
