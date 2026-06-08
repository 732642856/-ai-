/**
 * 浏览器端 PDF/DOCX/TXT 文件解析引擎
 *
 * 依赖：
 *   - mammoth (DOCX → text)
 *   - pdfjs-dist (PDF → text)
 *
 * 使用方式：
 *   const { text, type } = await parseDocument(file)
 */

export interface ParseResult {
  text: string
  type: "pdf" | "docx" | "txt" | "unknown"
  fileName: string
  fileSize: number
  pageCount?: number // PDF 页数
  wordCount: number
}

// ============================================================
// TXT — 直接用 FileReader 读取
// ============================================================
async function parseTXT(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("TXT 读取失败"))
    reader.readAsText(file, "utf-8")
  })
}

// ============================================================
// DOCX — 使用 mammoth 提取纯文本
// ============================================================
async function parseDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  // @ts-ignore — mammoth has no type declarations
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

// ============================================================
// PDF — 使用 pdfjs-dist 提取文本（浏览器端）
// ============================================================
async function parsePDF(file: File): Promise<{ text: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer()
  // @ts-ignore — pdfjs-dist has no type declarations
  const pdfjsLib = await import("pdfjs-dist")

  // 设置 worker 路径（使用 CDN 版本）
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const pageCount = pdf.numPages
  const textParts: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(" ")
    textParts.push(pageText)
  }

  return { text: textParts.join("\n\n"), pageCount }
}

// ============================================================
// 主入口 — 自动识别并解析
// ============================================================
export async function parseDocument(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  const fileName = file.name
  const fileSize = file.size

  let text = ""
  let type: ParseResult["type"] = "unknown"
  let pageCount: number | undefined

  const raw = await file.slice(0, Math.min(file.size, 256)).text()

  switch (ext) {
    case "txt": {
      text = await parseTXT(file)
      type = "txt"
      break
    }
    case "docx": {
      text = await parseDOCX(file)
      type = "docx"
      break
    }
    case "pdf": {
      const result = await parsePDF(file)
      text = result.text
      pageCount = result.pageCount
      type = "pdf"
      break
    }
    default: {
      // 尝试按文本读取
      if (raw.includes("\n") || raw.length > 0) {
        text = await parseTXT(file)
        type = "txt"
      } else {
        throw new Error(`不支持的文件格式: .${ext}`)
      }
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length

  return { text, type, fileName, fileSize, pageCount, wordCount }
}
