// ============================================================================
// localStoragePersist — Shared persistence utilities for Zustand stores
// ============================================================================
// Eliminates repeated load/save/version-check boilerplate across all 5 stores.
// SSR-safe (noop when window is undefined).
// Includes QuotaExceededError defense.
//
// IndexedDB upgrade (2026-06-10):
//  - persistState() now ALSO writes to IndexedDB (fire-and-forget)
//  - loadPersistedStateAsync() tries IndexedDB first, falls back to localStorage
//  - clearPersistedState() also clears IndexedDB
//  - migrateAllToIndexedDB() migrates all tracked keys in one pass
//
// IndexedDB provides ~250MB+ storage vs localStorage's 5MB, eliminating the
// base64-stripping workaround for canvas data.
// ============================================================================

import { getItem as idbGetItem, setItem as idbSetItem, removeItem as idbRemoveItem } from '../app/canvas/utils/canvasIndexedDB.ts'

// IndexedDB key prefix to avoid collision with canvasPersistence keys
const IDB_PREFIX = 'persist:'

export interface PersistenceOptions {
  /** localStorage key */
  key: string;
  /** Storage version for forward compatibility. Load will reject mismatched versions. */
  version: number;
  /** Max size in bytes before skipping save. Default: 4MB (4 * 1024 * 1024). */
  maxSizeBytes?: number;
}

/**
 * Load data from localStorage with version check.
 * Returns `defaultValue` on any error (missing key, parse failure, version mismatch, SSR).
 */
export function loadPersistedState<T>(
  opts: PersistenceOptions,
  defaultValue: T,
): T {
  try {
    if (typeof window === 'undefined') return defaultValue;
    const raw = localStorage.getItem(opts.key);
    if (!raw) return defaultValue;
    const data = JSON.parse(raw);
    if (data?.version !== opts.version) return defaultValue;
    return (data?.data ?? data) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Load typed storage wrapper (for stores that use { version, data } shape explicitly).
 */
export function loadStorageWrapper<T>(
  opts: PersistenceOptions,
  getData: (parsed: Record<string, unknown>) => T,
  defaultValue: T,
): T {
  try {
    if (typeof window === 'undefined') return defaultValue;
    const raw = localStorage.getItem(opts.key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== opts.version) return defaultValue;
    return getData(parsed as Record<string, unknown>);
  } catch {
    return defaultValue;
  }
}

/**
 * Save data to localStorage with size check and error handling.
 * Silently drops on QuotaExceededError or SSR.
 *
 * Also writes to IndexedDB as a fire-and-forget async operation,
 * providing a ~250MB+ storage tier that bypasses the 5MB localStorage limit.
 */
export function persistState<T>(
  opts: PersistenceOptions,
  data: T,
): void {
  try {
    if (typeof window === 'undefined') return;
    const json = JSON.stringify(data);
    const maxSize = opts.maxSizeBytes ?? 4 * 1024 * 1024;
    if (json.length > maxSize) {
      // Still try IndexedDB — it can handle larger payloads
      persistStateToIndexedDB(opts, data);
      console.warn(
        `[localStoragePersist] ${opts.key}: data (${(json.length / 1024).toFixed(1)}KB) exceeds localStorage limit (${(maxSize / 1024).toFixed(0)}KB), saved to IndexedDB only.`,
      );
      return;
    }
    localStorage.setItem(opts.key, json);
    // Async mirror to IndexedDB (fire-and-forget)
    persistStateToIndexedDB(opts, data);
  } catch (err) {
    // If localStorage fails (e.g. quota), still try IndexedDB
    persistStateToIndexedDB(opts, data);
    console.warn(`[localStoragePersist] ${opts.key}: localStorage save failed, saved to IndexedDB:`, err);
  }
}

/**
 * Save with a storage wrapper shape: { version, ...data }
 */
export function persistStorageWrapper<T extends Record<string, unknown>>(
  opts: PersistenceOptions,
  data: T,
): void {
  const wrapper = { version: opts.version, ...data };
  persistState(opts, wrapper);
}

/**
 * Remove data from localStorage AND IndexedDB. SSR-safe.
 */
export function clearPersistedState(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    // Also clear IndexedDB mirror
    idbRemoveItem(IDB_PREFIX + key).catch(() => { /* ignore */ });
  } catch {
    // ignore
  }
}

/**
 * Simple key-value storage (for boolean/string flags).
 */
export function getPersistedFlag(key: string, defaultValue: string): string {
  try {
    if (typeof window === 'undefined') return defaultValue;
    return localStorage.getItem(key) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Write a simple key-value pair to localStorage. SSR-safe. */
export function setPersistedFlag(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/**
 * Get current localStorage usage stats for diagnostic purposes.
 * Returns estimated total usage across all keys.
 */
export function getStorageStats(): { totalBytes: number; itemCount: number; keys: string[] } {
  try {
    if (typeof window === 'undefined') return { totalBytes: 0, itemCount: 0, keys: [] };
    let totalBytes = 0;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      keys.push(key);
      const value = localStorage.getItem(key);
      if (value) {
        totalBytes += key.length * 2 + value.length * 2; // UTF-16 estimate
      }
    }
    return { totalBytes, itemCount: keys.length, keys };
  } catch {
    return { totalBytes: 0, itemCount: 0, keys: [] };
  }
}

/**
 * Check if localStorage is approaching the 5MB quota (within 80%).
 */
export function isStorageNearQuota(): boolean {
  const { totalBytes } = getStorageStats();
  return totalBytes > 4 * 1024 * 1024; // > 4MB (80% of 5MB)
}

// ============================================================================
// IndexedDB async layer — transparent upgrade from localStorage
// ============================================================================

/**
 * Write state to IndexedDB asynchronously (fire-and-forget).
 * Uses "persist:" prefix to namespace keys separately from canvasPersistence.
 */
async function persistStateToIndexedDB<T>(
  opts: PersistenceOptions,
  data: T,
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const wrapper = { version: opts.version, data };
    await idbSetItem(IDB_PREFIX + opts.key, wrapper);
  } catch {
    // IndexedDB unavailable — localStorage is the fallback
  }
}

/**
 * Async version of loadPersistedState that tries IndexedDB first.
 * Falls back to localStorage if IndexedDB is unavailable or empty.
 *
 * Call this AFTER store initialization to hydrate from IndexedDB:
 * ```
 * loadPersistedStateAsync(opts, defaultValue).then(data => {
 *   if (data !== defaultValue) store.setState(data)
 * })
 * ```
 */
export async function loadPersistedStateAsync<T>(
  opts: PersistenceOptions,
  defaultValue: T,
): Promise<T> {
  try {
    if (typeof window === 'undefined') return defaultValue;

    // Try IndexedDB first
    const wrapper = await idbGetItem<{ version: number; data: T }>(IDB_PREFIX + opts.key);
    if (wrapper && wrapper.version === opts.version && wrapper.data !== undefined) {
      return wrapper.data;
    }
  } catch {
    // IndexedDB failed, fall through to localStorage
  }

  // Fallback: synchronous localStorage read
  return loadPersistedState(opts, defaultValue);
}

/**
 * Migrate all known persistence keys from localStorage to IndexedDB.
 *
 * Call once after app initialization to move existing data to the new storage tier.
 * After migration, localStorage remains as a fast sync fallback and IndexedDB
 * becomes the authoritative store for large payloads.
 */
export async function migrateAllToIndexedDB(keys: PersistenceOptions[]): Promise<void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  for (const opts of keys) {
    try {
      const raw = localStorage.getItem(opts.key);
      if (!raw) continue;

      // Check if IndexedDB already has this key
      const existing = await idbGetItem(IDB_PREFIX + opts.key);
      if (existing) continue; // Already migrated

      const data = JSON.parse(raw);
      const wrapper = {
        version: opts.version,
        data: data?.data ?? data,
      };
      await idbSetItem(IDB_PREFIX + opts.key, wrapper);
    } catch {
      // Skip corrupted keys
    }
  }
}
