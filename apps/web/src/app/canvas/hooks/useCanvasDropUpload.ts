/**
 * useCanvasDropUpload - 拖拽图片到画布
 * 支持：
 * - 从桌面拖拽图片到画布
 * - 多图同时拖入
 * - 视觉反馈 overlay
 */

import { useCallback, useState, type DragEvent } from "react";
import { useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { generateId } from "../utils/generateId";
import { persistImageFile } from "@/lib/assets/localImageStore";
import {
  createDocumentNode,
  isTextDocumentFile,
  readTextDocumentFile,
} from "@/lib/documents/textDocumentImport";
export interface ImageFileMeta {
  id: string;
  file: File;
  src: string;
  name: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  /** IndexedDB asset ID (set after persistImageFile) */
  assetId: string;
}

export interface DropPosition {
  x: number;
  y: number;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_DROP_LABEL = "支持 JPG、PNG、WebP、GIF、TXT、Markdown";
const IMAGE_NODE_TITLE_HEIGHT = 22;
const IMAGE_NODE_SIZE = {
  minWidth: 120,
  minHeight: 96,
  maxWidth: 220,
  maxHeight: 180,
};

export function useCanvasDropUpload(
  setNodes: (updater: (nodes: Node[]) => Node[]) => void,
  dismissCanvasHint?: () => void,
  onDocumentsImported?: (nodes: Node[]) => void,
) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const reactFlow = useReactFlow();

  // 读取图片文件元数据。注意：这里只控制画布展示尺寸，不压缩、不改写用户原图。
  const readImageFile = useCallback(
    async (file: File): Promise<ImageFileMeta> => {
      if (!file.type.startsWith("image/")) {
        throw new Error("不是图片文件");
      }

      const metadataUrl = URL.createObjectURL(file);
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            URL.revokeObjectURL(metadataUrl);
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          };
          image.onerror = () => {
            URL.revokeObjectURL(metadataUrl);
            reject(new Error("图片加载失败"));
          };
          image.src = metadataUrl;
        },
      );

      // Persist to IndexedDB so images survive page refresh. The returned objectUrl
      // is the only runtime preview URL handed to the node; localStorage save strips it.
      const { assetId, objectUrl } = await persistImageFile(file, {
        width: dimensions.width,
        height: dimensions.height,
      });

      const meta: ImageFileMeta = {
        id: generateId(),
        file,
        src: objectUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.width / dimensions.height,
        assetId,
      };

      return meta;
    },
    [],
  );

  // 计算节点尺寸
  const calculateNodeSize = useCallback((width: number, height: number) => {
    let nodeWidth = width;
    let nodeHeight = height;

    // 按比例缩放，限制上传图在画布上的默认展示尺寸，避免大图撑爆节点。
    if (nodeWidth > IMAGE_NODE_SIZE.maxWidth) {
      const ratio = IMAGE_NODE_SIZE.maxWidth / nodeWidth;
      nodeWidth = IMAGE_NODE_SIZE.maxWidth;
      nodeHeight = nodeHeight * ratio;
    }

    if (nodeHeight > IMAGE_NODE_SIZE.maxHeight) {
      const ratio = IMAGE_NODE_SIZE.maxHeight / nodeHeight;
      nodeHeight = IMAGE_NODE_SIZE.maxHeight;
      nodeWidth = nodeWidth * ratio;
    }

    return {
      width: Math.max(nodeWidth, IMAGE_NODE_SIZE.minWidth),
      height: Math.max(nodeHeight, IMAGE_NODE_SIZE.minHeight),
    };
  }, []);

  // 从文件创建 ImageNode
  const createImageNodeFromFile = useCallback(
    (fileMeta: ImageFileMeta, position: { x: number; y: number }): Node => {
      const { width, height } = calculateNodeSize(
        fileMeta.width,
        fileMeta.height,
      );

      const node: Node = {
        id: fileMeta.id,
        type: "image",
        position,
        data: {
          title: fileMeta.name,
          imageUrl: fileMeta.src,
          assetId: fileMeta.assetId,
          fileName: fileMeta.name,
          fileSize: fileMeta.size,
          mimeType: fileMeta.mimeType,
          imageWidth: fileMeta.width,
          imageHeight: fileMeta.height,
          displayWidth: width,
          displayHeight: height,
          aspectRatio: fileMeta.aspectRatio,
          nodeKind: "uploaded-image",
          source: "upload",
          persistence: "indexeddb",
          createdAt: Date.now(),
        },
        measured: {
          width,
          height: height + IMAGE_NODE_TITLE_HEIGHT,
        },
      };

      return node;
    },
    [calculateNodeSize],
  );

  // 从多个文件创建节点
  const createImageNodesFromFiles = useCallback(
    (
      files: ImageFileMeta[],
      basePosition: { x: number; y: number },
    ): Node[] => {
      const nodes: Node[] = [];
      const OFFSET = 40;

      files.forEach((fileMeta, index) => {
        const position = {
          x: basePosition.x + index * OFFSET,
          y: basePosition.y + index * OFFSET,
        };
        nodes.push(createImageNodeFromFile(fileMeta, position));
      });

      return nodes;
    },
    [createImageNodeFromFile],
  );

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 检查是否有可导入文件（图片或纯文本文档）
    const hasSupportedFiles = Array.from(e.dataTransfer.items).some((item) => {
      if (item.kind !== "file") return false;
      if (item.type.startsWith("image/")) return true;
      const file = item.getAsFile();
      return file ? isTextDocumentFile(file) : false;
    });

    if (hasSupportedFiles) {
      setIsDragOver(true);
      setDragError(null);
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 只有当真正离开画布时才隐藏 overlay
    const relatedTarget = e.relatedTarget as HTMLElement;
    const canvas = e.currentTarget as HTMLElement;

    if (!canvas.contains(relatedTarget)) {
      setIsDragOver(false);
      setDragError(null);

    }
  }, []);

  // 处理放置
  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragOver(false);
      setDragError(null);

      // 获取放置位置（画布坐标）
      const canvasPosition = reactFlow.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      // 获取文件列表
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      const documentFiles = files.filter(isTextDocumentFile);

      if (imageFiles.length === 0 && documentFiles.length === 0) {
        setDragError(`请拖入可支持文件：${SUPPORTED_DROP_LABEL}`);
        return;
      }

      // 检查图片大小
      const oversizedFiles = imageFiles.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        setDragError(`图片过大，请压缩后再试（最大 20MB）`);
        console.warn(
          "[DEBUG_DROP_UPLOAD] Oversized files:",
          oversizedFiles.map((f) => f.name),
        );
        return;
      }

      try {
        const [imageMetas, importedDocuments] = await Promise.all([
          Promise.all(imageFiles.map(readImageFile)),
          Promise.all(documentFiles.map(readTextDocumentFile)),
        ]);

        const imageNodes = createImageNodesFromFiles(imageMetas, canvasPosition);
        const documentNodes = importedDocuments.map((document, index) =>
          createDocumentNode({
            id: generateId(),
            document,
            position: {
              x: canvasPosition.x + (imageNodes.length + index) * 40,
              y: canvasPosition.y + (imageNodes.length + index) * 40,
            },
          }),
        );
        const nodes = [...imageNodes, ...documentNodes];

        setNodes((nds) => [...nds, ...nodes]);
        if (documentNodes.length > 0) {
          onDocumentsImported?.(documentNodes);
        }
        dismissCanvasHint?.();

      } catch (error: any) {
        console.error("[DEBUG_DROP_UPLOAD] Error processing files:", error);
        setDragError(error?.message || "文件处理失败，请重试");
      }
    },
    [
      reactFlow,
      readImageFile,
      createImageNodesFromFiles,
      setNodes,
      dismissCanvasHint,
      onDocumentsImported,
    ],
  );

  // 清除错误
  const clearError = useCallback(() => {
    setDragError(null);
  }, []);

  return {
    isDragOver,
    dragError,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearError,
  };
}
