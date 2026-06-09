"use client";

/**
 * 将任意图片 URL 转为 base64 data URL。
 *
 * - `data:` → 直接返回（已经是 data URL）
 * - `blob:` → 通过 fetch + FileReader 读取为 base64
 * - `http(s):` → 通过 fetch 请求再转 base64
 * - 其他格式 → 抛出错误
 */
export async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;

  if (url.startsWith("blob:") || url.startsWith("http")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read blob as base64"));
      reader.readAsDataURL(blob);
    });
  }

  throw new Error(`Unsupported image URL format: ${url.slice(0, 50)}`);
}
