// ============================================================================
// Reference Image Preparation
// Resize and compress local Blob/File before sending it to image-generation APIs.
// ============================================================================

export interface PrepareReferenceImageOptions {
  maxSide?: number
  maxBytes?: number
  mimeType?: "image/jpeg" | "image/webp" | "image/png"
  quality?: number
}

export interface PreparedReferenceImage {
  dataUrl: string
  mimeType: string
  width: number
  height: number
  byteSize: number
  originalByteSize: number
  compressed: boolean
}

export class ReferenceImagePreparationError extends Error {
  code: "REFERENCE_IMAGE_TOO_LARGE" | "REFERENCE_IMAGE_DECODE_FAILED" | "CANVAS_UNAVAILABLE"
  detail: string
  originalByteSize?: number
  byteSize?: number
  maxBytes?: number

  constructor(params: {
    code: ReferenceImagePreparationError["code"]
    message: string
    detail: string
    originalByteSize?: number
    byteSize?: number
    maxBytes?: number
  }) {
    super(params.message)
    this.name = "ReferenceImagePreparationError"
    this.code = params.code
    this.detail = params.detail
    this.originalByteSize = params.originalByteSize
    this.byteSize = params.byteSize
    this.maxBytes = params.maxBytes
  }
}

const DEFAULT_MAX_SIDE = 1536
const DEFAULT_MAX_BYTES = 1.8 * 1024 * 1024
const DEFAULT_MIME_TYPE = "image/jpeg" as const
const DEFAULT_QUALITY = 0.8

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ReferenceImagePreparationError({
            code: "CANVAS_UNAVAILABLE",
            message: "无法压缩参考图",
            detail: "浏览器未能从画布导出图片。",
          }))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"))
    reader.readAsDataURL(blob)
  })
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new ReferenceImagePreparationError({
        code: "REFERENCE_IMAGE_DECODE_FAILED",
        message: "无法读取参考图",
        detail: "参考图解码失败，请换一张 PNG、JPEG 或 WebP 图片。",
        originalByteSize: blob.size,
      }))
    }
    img.src = objectUrl
  })
}

async function decodeImage(blob: Blob): Promise<{
  source: ImageBitmap | HTMLImageElement
  width: number
  height: number
  close?: () => void
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // Fall through to HTMLImageElement fallback.
    }
  }

  const img = await loadImageElement(blob)
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

function getTargetSize(width: number, height: number, maxSide: number): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height)
  if (longest <= maxSide) return { width, height, resized: false }

  const scale = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  }
}

async function drawToCompressedBlob(params: {
  source: ImageBitmap | HTMLImageElement
  width: number
  height: number
  mimeType: string
  quality: number
}): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = params.width
  canvas.height = params.height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new ReferenceImagePreparationError({
      code: "CANVAS_UNAVAILABLE",
      message: "无法压缩参考图",
      detail: "浏览器不支持当前图片压缩所需的 Canvas 能力。",
    })
  }

  ctx.drawImage(params.source, 0, 0, params.width, params.height)
  return canvasToBlob(canvas, params.mimeType, params.quality)
}

export async function prepareReferenceImageForGeneration(
  blob: Blob,
  options: PrepareReferenceImageOptions = {},
): Promise<PreparedReferenceImage> {
  if (!isBrowser()) {
    throw new ReferenceImagePreparationError({
      code: "CANVAS_UNAVAILABLE",
      message: "无法在当前环境处理参考图",
      detail: "参考图压缩需要浏览器 Canvas 环境。",
      originalByteSize: blob.size,
    })
  }

  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const mimeType = options.mimeType ?? DEFAULT_MIME_TYPE
  const quality = options.quality ?? DEFAULT_QUALITY
  const originalByteSize = blob.size

  const decoded = await decodeImage(blob)
  try {
    const target = getTargetSize(decoded.width, decoded.height, maxSide)
    const canReuseOriginal =
      !target.resized &&
      originalByteSize <= maxBytes &&
      blob.type === mimeType

    const preparedBlob = canReuseOriginal
      ? blob
      : await drawToCompressedBlob({
          source: decoded.source,
          width: target.width,
          height: target.height,
          mimeType,
          quality,
        })

    if (preparedBlob.size > maxBytes) {
      throw new ReferenceImagePreparationError({
        code: "REFERENCE_IMAGE_TOO_LARGE",
        message: "参考图过大",
        detail: `参考图压缩后仍超过限制：${Math.round(preparedBlob.size / 1024)}KB / ${Math.round(maxBytes / 1024)}KB。`,
        originalByteSize,
        byteSize: preparedBlob.size,
        maxBytes,
      })
    }

    return {
      dataUrl: await blobToDataUrl(preparedBlob),
      mimeType: preparedBlob.type || mimeType,
      width: target.width,
      height: target.height,
      byteSize: preparedBlob.size,
      originalByteSize,
      compressed: !canReuseOriginal || preparedBlob.size !== originalByteSize,
    }
  } finally {
    decoded.close?.()
  }
}
