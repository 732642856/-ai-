// ============================================================================
// Image Generation Snapshot
// Records user-visible generation provenance without storing binary image data.
// ============================================================================

export type ImageGenerationMode = "text-to-image" | "image-to-image";
export type ImageGenerationStatus = "running" | "succeeded" | "failed";

export interface ImageGenerationReferenceInfo {
  assetId?: string;
  sourceNodeId?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  originalByteSize?: number;
  sentByteSize?: number;
  compressed?: boolean;
  [key: string]: unknown;
}

export interface ImageGenerationSnapshotInput {
  requestId: string;
  mode: ImageGenerationMode;
  userPrompt: string;
  model: string;
  size: string;
  sourceNodeId?: string;
  sourceAssetId?: string;
  referenceImage?: ImageGenerationReferenceInfo;
}

export interface ImageGenerationSnapshot extends ImageGenerationSnapshotInput {
  enhancedPrompt?: string;
  status: ImageGenerationStatus;
  createdAt: string;
  completedAt?: string;
}

const RUNTIME_REFERENCE_KEYS = new Set([
  "url",
  "src",
  "dataUrl",
  "base64",
  "b64_json",
  "imageUrl",
  "assetUrl",
  "previewUrl",
]);

function isRuntimeImagePayload(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("blob:") || value.startsWith("data:image"))
  );
}

function sanitizeReferenceImage(
  referenceImage?: ImageGenerationReferenceInfo,
): ImageGenerationReferenceInfo | undefined {
  if (!referenceImage) return undefined;

  const clean: ImageGenerationReferenceInfo = {};
  for (const [key, value] of Object.entries(referenceImage)) {
    if (RUNTIME_REFERENCE_KEYS.has(key) && isRuntimeImagePayload(value)) {
      continue;
    }
    clean[key] = value;
  }

  return clean;
}

export function createImageGenerationSnapshot(
  input: ImageGenerationSnapshotInput,
): ImageGenerationSnapshot {
  return {
    requestId: input.requestId,
    mode: input.mode,
    userPrompt: input.userPrompt,
    enhancedPrompt: undefined,
    model: input.model,
    size: input.size,
    sourceNodeId: input.sourceNodeId,
    sourceAssetId: input.sourceAssetId,
    referenceImage: sanitizeReferenceImage(input.referenceImage),
    status: "running",
    createdAt: new Date().toISOString(),
    completedAt: undefined,
  };
}
