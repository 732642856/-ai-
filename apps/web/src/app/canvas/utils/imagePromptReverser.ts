// ============================================================================
// Image Prompt Reverser — 图片反推提示词 (P3-5A)
// 将图片 URL / data URL 发送到 AI，AI 分析图片内容并返回高质量的生图提示词。
// ============================================================================
"use client";

import { callAiChat } from "@/lib/ai/client";
import { getLocalImageAsset } from "@/lib/assets/localImageStore";
import { toDataUrl } from "./toDataUrl";

/** 将 Blob 转为 base64 data URL */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob as base64"));
    reader.readAsDataURL(blob);
  });
}

/** 从远程 URL 获取图片并转为 base64 data URL */
async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  return blobToBase64(blob);
}

/**
 * 将图片转换为适合 AI vision 的 base64 data URL。
 *
 * 如果提供了 assetId，优先从 IndexedDB 读取原始 blob（避免 blob URL 失效）；
 * 否则直接 fetch imageUrl。
 */
export async function imageUrlToBase64(
  imageUrl: string,
  assetId?: string,
): Promise<string> {
  // 如果已有 data URL，直接返回
  if (imageUrl.startsWith("data:")) return imageUrl;

  // 有 assetId 时从 IndexedDB 读取原始 blob
  if (assetId) {
    const asset = await getLocalImageAsset(assetId);
    if (asset?.blob) return blobToBase64(asset.blob);
  }

  // 否则通过 toDataUrl 获取（支持 blob / http / data）
  return toDataUrl(imageUrl);
}

/** 系统级反推 prompt，告诉 AI 如何分析图片 */
const REVERSE_SYSTEM_PROMPT =
  "Analyze this image and describe it in detail as a high-quality image generation prompt. Output ONLY the prompt text. Include: subject, composition, lighting, style, mood, color palette, technique keywords (e.g. 8K, cinematic lighting, photorealistic). Keep under 200 words.";

/**
 * 将指定图片反推为生图提示词。
 *
 * @param imageUrl  - 图片 URL (blob URL / 远程 URL / data URL)
 * @param options.assetId - IndexedDB asset ID (可选，用于从本地存储读取原始图片)
 * @returns AI 返回的提示词文本
 */
export async function reverseImageToPrompt(
  imageUrl: string,
  options?: { assetId?: string },
): Promise<string> {
  const dataUrl = await imageUrlToBase64(imageUrl, options?.assetId);

  const response = await callAiChat({
    messages: [
      { role: "system", content: REVERSE_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
    temperature: 0.7,
    timeoutMs: 120_000,
  });

  return response.content.trim();
}
