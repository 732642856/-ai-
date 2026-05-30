// ============================================================================
// Image Provider Capabilities
// Lightweight model/provider capability map for text-to-image and image-to-image.
// ============================================================================

export interface ImageProviderCapability {
  provider: string
  model: string
  supportsTextToImage: boolean
  supportsImageToImage: boolean
  maxInputImageBytes: number
  maxInputImageSide: number
  acceptedInputMimeTypes: string[]
}

const DEFAULT_IMAGE_CAPABILITY: ImageProviderCapability = {
  provider: "default",
  model: "unknown",
  supportsTextToImage: true,
  supportsImageToImage: false,
  maxInputImageBytes: 1.8 * 1024 * 1024,
  maxInputImageSide: 1536,
  acceptedInputMimeTypes: ["image/jpeg", "image/webp", "image/png"],
}

const CAPABILITY_BY_MODEL: Record<string, Omit<ImageProviderCapability, "model">> = {
  "gpt-image-2": {
    provider: "copse",
    supportsTextToImage: true,
    supportsImageToImage: true,
    maxInputImageBytes: 1.8 * 1024 * 1024,
    maxInputImageSide: 1536,
    acceptedInputMimeTypes: ["image/jpeg", "image/webp", "image/png"],
  },
}

export function getImageProviderCapability(model: string): ImageProviderCapability {
  const normalizedModel = model.trim() || DEFAULT_IMAGE_CAPABILITY.model
  const capability = CAPABILITY_BY_MODEL[normalizedModel]
  if (!capability) {
    return {
      ...DEFAULT_IMAGE_CAPABILITY,
      model: normalizedModel,
    }
  }

  return {
    ...capability,
    model: normalizedModel,
  }
}

export function assertImageToImageSupported(capability: ImageProviderCapability): void {
  if (!capability.supportsImageToImage) {
    const error = new Error("Current provider does not support image-to-image")
    ;(error as Error & { code?: string; provider?: string; status?: number }).code = "UNSUPPORTED_IMAGE_TO_IMAGE"
    ;(error as Error & { code?: string; provider?: string; status?: number }).provider = capability.provider
    throw error
  }
}
