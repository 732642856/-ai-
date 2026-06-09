// ============================================================================
// supermemory — AI long-term memory engine adapter
// 
// V2: Upgraded to real semantic vector search using transformers.js
// - Embeddings generated in-browser via transformers.js (Xenova)
// - Cosine similarity for ranking (not keyword matching)
// - IndexedDB for persistent storage
// - Fallback to keyword matching if transformers.js not loaded
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
  embedding?: number[]; // Vector embedding
  createdAt: number;
  updatedAt: number;
}

interface MemoryIndex {
  keys: Array<{ key: string; type: string; title: string; updatedAt: number }>;
}

// ---------------------------------------------------------------------------
// IndexedDB setup
// ---------------------------------------------------------------------------

const DB_NAME = "supermemory";
const DB_VERSION = 3; // Bumped for embedding column
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
// Embedding engine (transformers.js)
// ---------------------------------------------------------------------------

let embeddingPipeline: any = null;
let embeddingLoading = false;

/**
 * Get or initialize the embedding pipeline.
 * Uses a small model (all-MiniLM-L6-v2) for fast browser inference.
 */
async function getEmbeddingPipeline() {
  if (embeddingPipeline) return embeddingPipeline;
  if (embeddingLoading) {
    while (embeddingLoading) await new Promise((r) => setTimeout(r, 100));
    return embeddingPipeline;
  }
  embeddingLoading = true;
  try {
    const { pipeline } = await import("@xenova/transformers");
    // Use a small, fast embedding model suitable for browser
    embeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true,
    });
    return embeddingPipeline;
  } catch (e) {
    console.warn("[supermemory] Failed to load embedding model, falling back to keyword search:", e);
    return null;
  } finally {
    embeddingLoading = false;
  }
}

/**
 * Generate embedding vector from text.
 * Returns null if embedding pipeline is unavailable.
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const pipe = await getEmbeddingPipeline();
    if (!pipe) return null;
    
    const result = await pipe(text, { pooling: "mean", normalize: true });
    // Extract the embedding vector from the Tensor
    const data = result.data as Float32Array;
    return Array.from(data);
  } catch {
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Fallback keyword search (original implementation).
 */
function keywordSearch(
  query: string,
  entries: MemoryEntry[],
  filterType?: string,
): Array<{ entry: MemoryEntry; score: number }> {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(Boolean);
  const results: Array<{ entry: MemoryEntry; score: number }> = [];

  for (const entry of entries) {
    if (filterType && entry.metadata.type !== filterType) continue;
    let score = 0;
    const searchableText = [
      entry.key,
      JSON.stringify(entry.content || ""),
      JSON.stringify(entry.metadata),
    ].join(" ").toLowerCase();

    for (const term of queryTerms) {
      if (searchableText.includes(term)) {
        score += 1;
        if (entry.key.toLowerCase().includes(term)) score += 2;
        if (entry.metadata.type?.toLowerCase().includes(term)) score += 1;
      }
    }
    if (score > 0) results.push({ entry, score });
  }

  return results.sort((a, b) => b.score - a.score || b.entry.updatedAt - a.entry.updatedAt);
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

    // Generate embedding from content + metadata
    const searchableText = `${key} ${JSON.stringify(content)} ${JSON.stringify(metadata)}`;
    const embedding = await generateEmbedding(searchableText);

    const entry: MemoryEntry<T> = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key: `${STORAGE_PREFIX}${key}`,
      content,
      metadata,
      embedding: embedding || undefined,
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

  /** Semantic vector search across all memory entries */
  async search(query: string, filterType?: string): Promise<Array<{ key: string; content: unknown; metadata: Record<string, string>; score: number }>> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = async () => {
        const allEntries = req.result as MemoryEntry[];

        // Filter by type
        const filtered = filterType
          ? allEntries.filter((e) => e.metadata.type === filterType)
          : allEntries;

        // 1. Try vector search if embeddings are available
        const queryEmbedding = await generateEmbedding(query);

        if (queryEmbedding && filtered.some((e) => e.embedding)) {
          // Vector search: compute cosine similarity
          const scored = filtered
            .map((entry) => ({
              entry,
              score: entry.embedding
                ? cosineSimilarity(queryEmbedding, entry.embedding)
                : 0,
            }))
            .filter((r) => r.score > 0.15) // Threshold: only meaningful matches
            .sort((a, b) => b.score - a.score);

          resolve(scored.slice(0, 10).map((r) => ({
            key: r.entry.key.replace(STORAGE_PREFIX, ""),
            content: r.entry.content,
            metadata: r.entry.metadata,
            score: Math.round(r.score * 1000) / 1000,
          })));
        } else {
          // 2. Fallback: keyword search
          const keywordResults = keywordSearch(query, filtered);
          resolve(keywordResults.slice(0, 10).map((r) => ({
            key: r.entry.key.replace(STORAGE_PREFIX, ""),
            content: r.entry.content,
            metadata: r.entry.metadata,
            score: r.score,
          })));
        }
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
