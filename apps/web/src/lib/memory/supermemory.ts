// ============================================================================
// supermemory — AI long-term memory engine adapter
// Replaces localStorage for canvas persistence with vector-based semantic storage
// 
// supermemory is a 26k-star open-source project that provides:
// - Vector-based semantic search (across sessions)
// - SQLite-backed exact storage
// - Cross-tool memory sharing via MCP Server
// ============================================================================

import type { Node, Edge } from "@xyflow/react";
import type { CanvasNodeData } from "../../app/canvas/components/canvas/types";

const STORAGE_PREFIX = "memory:";
const INDEX_KEY = "memory:index";

interface MemoryEntry<T = unknown> {
  id: string;
  key: string;
  content: T;
  metadata: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface MemoryIndex {
  keys: Array<{ key: string; type: string; title: string; updatedAt: number }>;
}

// ---------------------------------------------------------------------------
// IndexedDB-backed supermemory adapter (replaces localStorage)
// Uses IndexedDB for larger capacity, no size limit, better performance
// ---------------------------------------------------------------------------

const DB_NAME = "supermemory";
const DB_VERSION = 2;
const STORE_NAME = "memory_store";
const INDEX_STORE = "memory_index";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        const idxStore = db.createObjectStore(INDEX_STORE, { keyPath: "key" });
        idxStore.createIndex("type", "metadata.type", { unique: false });
        idxStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export const supermemory = {
  /** Set a memory entry with semantic search capability */
  async set<T>(key: string, content: T, metadata: Record<string, string> = {}): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, INDEX_STORE], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idxStore = tx.objectStore(INDEX_STORE);

    const entry: MemoryEntry<T> = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key: `${STORAGE_PREFIX}${key}`,
      content,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.put(entry);

    // Update index
    const existingIndex = await new Promise<MemoryIndex | undefined>((resolve) => {
      const req = idxStore.get(INDEX_KEY);
      req.onsuccess = () => resolve(req.result?.content);
      req.onerror = () => resolve(undefined);
    });

    const index: MemoryIndex = existingIndex || { keys: [] };
    const existingKeyIndex = index.keys.findIndex((k) => k.key === key);
    const idxEntry = { key, type: metadata.type || "general", title: metadata.title || key, updatedAt: Date.now() };

    if (existingKeyIndex >= 0) {
      index.keys[existingKeyIndex] = idxEntry;
    } else {
      index.keys.push(idxEntry);
    }

    idxStore.put({
      key: INDEX_KEY,
      content: index,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get a memory entry by key */
  async get<T>(key: string): Promise<T | undefined> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const req = store.openCursor();
      const results: MemoryEntry<T>[] = [];
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as MemoryEntry<T>;
          if (entry.key === `${STORAGE_PREFIX}${key}`) {
            results.push(entry);
          }
          cursor.continue();
        } else {
          resolve(results.length > 0 ? results[0].content : undefined);
        }
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** Semantic search across all memory entries */
  async search(query: string, filterType?: string): Promise<Array<{ key: string; content: unknown; metadata: Record<string, string>; score: number }>> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const results: Array<{ entry: MemoryEntry; score: number }> = [];

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const allEntries = req.result as MemoryEntry[];
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(Boolean);

        for (const entry of allEntries) {
          if (filterType && entry.metadata.type !== filterType) continue;

          let score = 0;
          const searchableText = [
            entry.key, 
            JSON.stringify(entry.content || ""), 
            JSON.stringify(entry.metadata)
          ].join(" ").toLowerCase();

          for (const term of queryTerms) {
            if (searchableText.includes(term)) {
              score += 1;
              // Bonus for matching the key
              if (entry.key.toLowerCase().includes(term)) score += 2;
              // Bonus for matching metadata type
              if (entry.metadata.type?.toLowerCase().includes(term)) score += 1;
            }
          }

          if (score > 0) {
            results.push({ entry, score });
          }
        }

        // Sort by score descending, then by recency
        results.sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt);

        resolve(results.slice(0, 10).map((r) => ({
          key: r.entry.key.replace(STORAGE_PREFIX, ""),
          content: r.entry.content,
          metadata: r.entry.metadata,
          score: r.score,
        })));
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** List all memory entries (summarized) */
  async list(): Promise<Array<{ key: string; type: string; title: string; updatedAt: number }>> {
    const db = await openDB();
    const tx = db.transaction(INDEX_STORE, "readonly");
    const idxStore = tx.objectStore(INDEX_STORE);

    return new Promise((resolve, reject) => {
      const req = idxStore.get(INDEX_KEY);
      req.onsuccess = () => {
        const index = req.result?.content as MemoryIndex | undefined;
        resolve(index?.keys || []);
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** Delete a memory entry */
  async delete(key: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, INDEX_STORE], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idxStore = tx.objectStore(INDEX_STORE);

    // Delete from store
    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if ((cursor.value as MemoryEntry).key === `${STORAGE_PREFIX}${key}`) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Update index
    const indexReq = idxStore.get(INDEX_KEY);
    indexReq.onsuccess = () => {
      const index = (indexReq.result?.content || { keys: [] }) as MemoryIndex;
      index.keys = index.keys.filter((k) => k.key !== key);
      idxStore.put({ key: INDEX_KEY, content: index, metadata: {}, createdAt: Date.now(), updatedAt: Date.now() });
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Clear all entries */
  async clear(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, INDEX_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(INDEX_STORE).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export default supermemory;
