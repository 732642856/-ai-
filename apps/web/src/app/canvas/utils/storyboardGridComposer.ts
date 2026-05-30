import { STORYBOARD_FRAME_ASPECT_RATIO } from "@/lib/storyboard/storyboardComposite"

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("图片加载失败"))
    img.src = src
  })
}

export async function composeStoryboardGrid(input: {
  images: Array<string | null | undefined>
  columns?: number
  cellWidth?: number
  cellHeight?: number
  gap?: number
  background?: string
}) {
  const columns = input.columns || 3
  const cellWidth = input.cellWidth || 640
  const cellHeight = input.cellHeight || Math.round(cellWidth / STORYBOARD_FRAME_ASPECT_RATIO)
  const gap = input.gap ?? 12
  const rows = Math.ceil(input.images.length / columns)
  const width = columns * cellWidth + (columns + 1) * gap
  const height = rows * cellHeight + (rows + 1) * gap

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("无法创建分镜合成画布")

  ctx.fillStyle = input.background || "#080a10"
  ctx.fillRect(0, 0, width, height)

  for (let index = 0; index < input.images.length; index++) {
    const src = input.images[index]
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = gap + col * (cellWidth + gap)
    const y = gap + row * (cellHeight + gap)

    ctx.fillStyle = "#111827"
    ctx.fillRect(x, y, cellWidth, cellHeight)

    if (!src) continue
    try {
      const img = await loadImage(src)
      const scale = Math.max(cellWidth / img.width, cellHeight / img.height)
      const drawWidth = img.width * scale
      const drawHeight = img.height * scale
      const drawX = x + (cellWidth - drawWidth) / 2
      const drawY = y + (cellHeight - drawHeight) / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, cellWidth, cellHeight)
      ctx.clip()
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
      ctx.restore()
    } catch {
      ctx.fillStyle = "#334155"
      ctx.fillRect(x, y, cellWidth, cellHeight)
    }
  }

  return canvas.toDataURL("image/png")
}
