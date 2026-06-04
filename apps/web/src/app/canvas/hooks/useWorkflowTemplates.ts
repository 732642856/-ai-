// ============================================================================
// useWorkflowTemplates — 画布工作流模板管理
// - 保存当前画布为命名模板
// - 加载模板到画布
// - 导出/导入 JSON 文件
// - 模板存储在 localStorage: startrails_workflow_templates
// ============================================================================
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "../components/canvas/types";
import { sanitizeNodesForPersistence } from "@/lib/storage/sanitizePersistedCanvas";

const STORAGE_KEY = "startrails_workflow_templates";
const MAX_TEMPLATES = 50;

export interface WorkflowTemplate {
  id: string;
  name: string;
  createdAt: number;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  nodeCount: number;
  edgeCount: number;
}

// ---------------------------------------------------------------------------
// Helper: generate unique ID
// ---------------------------------------------------------------------------
function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useWorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load templates from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTemplates(parsed);
        }
      }
    } catch (err) {
      console.error("[WorkflowTemplates] Failed to load templates:", err);
    }
    setIsLoaded(true);
  }, []);

  // Persist to localStorage
  const persist = useCallback((items: WorkflowTemplate[]) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error("[WorkflowTemplates] Failed to persist templates:", err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Save current canvas as template
  // ---------------------------------------------------------------------------
  const saveAsTemplate = useCallback(
    (name: string, nodes: Node<CanvasNodeData>[], edges: Edge[]) => {
      const sanitizedNodes = sanitizeNodesForPersistence(nodes);
      const template: WorkflowTemplate = {
        id: generateTemplateId(),
        name: name.trim() || "未命名工作流",
        createdAt: Date.now(),
        nodes: sanitizedNodes,
        edges,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      };

      const updated = [template, ...templates].slice(0, MAX_TEMPLATES);
      setTemplates(updated);
      persist(updated);
      return template;
    },
    [templates, persist],
  );

  // ---------------------------------------------------------------------------
  // Delete a template
  // ---------------------------------------------------------------------------
  const deleteTemplate = useCallback(
    (templateId: string) => {
      const updated = templates.filter((t) => t.id !== templateId);
      setTemplates(updated);
      persist(updated);
    },
    [templates, persist],
  );

  // ---------------------------------------------------------------------------
  // Rename a template
  // ---------------------------------------------------------------------------
  const renameTemplate = useCallback(
    (templateId: string, newName: string) => {
      const updated = templates.map((t) =>
        t.id === templateId ? { ...t, name: newName.trim() || "未命名工作流" } : t,
      );
      setTemplates(updated);
      persist(updated);
    },
    [templates, persist],
  );

  // ---------------------------------------------------------------------------
  // Export template as JSON file (download)
  // ---------------------------------------------------------------------------
  const exportAsJSON = useCallback((templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const exportData = {
      format: "starcanvas-workflow-template",
      version: 1,
      exportedAt: Date.now(),
      template: {
        id: template.id,
        name: template.name,
        createdAt: template.createdAt,
        nodes: template.nodes,
        edges: template.edges,
      },
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `starcanvas-workflow-${template.name.replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [templates]);

  // ---------------------------------------------------------------------------
  // Import template from JSON
  // Returns the imported template or null if invalid
  // ---------------------------------------------------------------------------
  const importFromJSON = useCallback(
    (jsonString: string): WorkflowTemplate | null => {
      try {
        const data = JSON.parse(jsonString);

        // Validate format
        if (!data || typeof data !== "object") return null;

        if (data.format === "starcanvas-workflow-template" && data.version === 1) {
          // Modern format
          const t = data.template;
          if (!t || !Array.isArray(t.nodes) || !Array.isArray(t.edges)) return null;

          const template: WorkflowTemplate = {
            id: generateTemplateId(),
            name: t.name || "导入的工作流",
            createdAt: Date.now(),
            nodes: t.nodes,
            edges: t.edges,
            nodeCount: t.nodes.length,
            edgeCount: t.edges.length,
          };

          const updated = [template, ...templates].slice(0, MAX_TEMPLATES);
          setTemplates(updated);
          persist(updated);
          return template;
        }

        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          // Legacy format — raw persisted canvas
          const template: WorkflowTemplate = {
            id: generateTemplateId(),
            name: data.name || "导入的工作流",
            createdAt: Date.now(),
            nodes: data.nodes,
            edges: data.edges,
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
          };

          const updated = [template, ...templates].slice(0, MAX_TEMPLATES);
          setTemplates(updated);
          persist(updated);
          return template;
        }

        return null;
      } catch {
        return null;
      }
    },
    [templates, persist],
  );

  return {
    templates,
    isLoaded,
    saveAsTemplate,
    deleteTemplate,
    renameTemplate,
    exportAsJSON,
    importFromJSON,
  };
}

export default useWorkflowTemplates;
