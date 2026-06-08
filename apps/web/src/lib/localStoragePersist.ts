// ============================================================================
// localStoragePersist — Shared persistence utilities for Zustand stores
// ============================================================================
// Eliminates repeated load/save/version-check boilerplate across all 5 stores.
// SSR-safe (noop when window is undefined).
// Includes QuotaExceededError defense.
// ============================================================================

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
      console.warn(
        `[localStoragePersist] ${opts.key}: data (${(json.length / 1024).toFixed(1)}KB) exceeds limit (${(maxSize / 1024).toFixed(0)}KB), skipping save.`,
      );
      return;
    }
    localStorage.setItem(opts.key, json);
  } catch (err) {
    console.warn(`[localStoragePersist] ${opts.key}: failed to save:`, err);
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
 * Remove data from localStorage. SSR-safe.
 */
export function clearPersistedState(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
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
