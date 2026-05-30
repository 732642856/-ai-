// ============================================================================
// localImageStore — IndexedDB-based local image asset storage
// Stores image Blobs independently from canvas node JSON,
// so localStorage never exceeds its 4MB limit.
// ============================================================================
"use client";

const DB_NAME = "startrail-assets";
const DB_VERSION = 1;
const STORE_NAME = "images";

// ---------------------------------------------------------------------------
// Object URL registry — prevents memory leaks from unreleased blob URLs
// ---------------------------------------------------------------------------

const objectUrlRegistry = new Map<string, string>();

function revokeObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore browser cleanup failures; the URL may already be invalid.
  }
}

function trackObjectUrl(assetId: string, url: string): string {
  // Revoke previous URL for the same asset if it exists. A later hydrate/upload
  // replaces the preview URL for that asset across canvas node data.
  const prev = objectUrlRegistry.get(assetId);
  if (prev && prev !== url) {
    revokeObjectUrl(prev);
  }
  objectUrlRegistry.set(assetId, url);
  return url;
}

function createTrackedObjectUrl(assetId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  return trackObjectUrl(assetId, url);
}

/** Revoke a tracked object URL. Call when an image asset is explicitly removed. */
export function revokeTrackedObjectUrl(assetId: string): void {
  const url = objectUrlRegistry.get(assetId);
  if (url) {
    revokeObjectUrl(url);
    objectUrlRegistry.delete(assetId);
  }
}

/** Revoke all tracked object URLs, usually during full canvas teardown/reset. */
export function revokeAllTrackedObjectUrls(): void {
  for (const url of objectUrlRegistry.values()) {
    revokeObjectUrl(url);
  }
  objectUrlRegistry.clear();
}

/** Get the currently tracked object URL for an asset (if any). */
export function getTrackedObjectUrl(assetId: string): string | undefined {
  return objectUrlRegistry.get(assetId);
}

/** Test/debug helper: number of active IndexedDB preview object URLs. */
export function getTrackedObjectUrlCount(): number {
  return objectUrlRegistry.size;
}

export type LocalImageAsset = {
  id: string;
  blob: Blob;
  fileName?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  updatedAt: number;
};

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function saveLocalImageAsset(
  asset: LocalImageAsset,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalImageAsset(
  id: string,
): Promise<LocalImageAsset | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLocalImageAsset(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a data:image/...;base64,... string to a Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Save an image file to IndexedDB and return the assetId + objectURL.
 * This is the primary entry point for all upload flows.
 */
export async function persistImageFile(
  file: File,
  options?: {
    width?: number;
    height?: number;
  },
): Promise<{ assetId: string; objectUrl: string }> {
  const assetId = crypto.randomUUID();
  const blob =
    file instanceof Blob
      ? file
      : new Blob([file as BlobPart], { type: (file as File).type });

  await saveLocalImageAsset({
    id: assetId,
    blob,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    width: options?.width,
    height: options?.height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const objectUrl = createTrackedObjectUrl(assetId, blob);
  return { assetId, objectUrl };
}

/**
 * Save a base64 data URL to IndexedDB and return the assetId + objectURL.
 * Used for AI-generated images and old data migration.
 */
export async function persistImageDataUrl(
  dataUrl: string,
  options?: {
    fileName?: string;
    width?: number;
    height?: number;
  },
): Promise<{ assetId: string; objectUrl: string; blob: Blob }> {
  const blob = dataUrlToBlob(dataUrl);
  const assetId = crypto.randomUUID();

  await saveLocalImageAsset({
    id: assetId,
    blob,
    mimeType: blob.type,
    size: blob.size,
    width: options?.width,
    height: options?.height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const objectUrl = createTrackedObjectUrl(assetId, blob);
  return { assetId, objectUrl, blob };
}

/**
 * Hydrate a single image node by loading its asset from IndexedDB.
 * Returns the objectURL if found, or null if not found.
 */
export async function hydrateImageAsset(
  assetId: string,
): Promise<string | null> {
  try {
    const asset = await getLocalImageAsset(assetId);
    if (!asset) return null;
    return createTrackedObjectUrl(assetId, asset.blob);
  } catch {
    console.warn(`[localImageStore] Failed to hydrate asset ${assetId}`);
    return null;
  }
}
