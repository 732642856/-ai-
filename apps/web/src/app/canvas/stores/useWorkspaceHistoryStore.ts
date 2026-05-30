import { create } from "zustand";
import type {
  WorkspaceHistoryEvent,
  WorkspaceHistoryStorage,
} from "../types/workspace-history";

const STORAGE_KEY = "startrails_workspace_history:current";
const STORAGE_VERSION = 1;
const MAX_EVENTS = 300;

function loadEvents(): WorkspaceHistoryEvent[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as WorkspaceHistoryStorage;
    if (data.version !== STORAGE_VERSION || !Array.isArray(data.events)) {
      return [];
    }
    return data.events;
  } catch {
    return [];
  }
}

function saveEvents(events: WorkspaceHistoryEvent[]): void {
  try {
    if (typeof window === "undefined") return;
    const data: WorkspaceHistoryStorage = {
      version: STORAGE_VERSION,
      events,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("[WorkspaceHistory] Failed to save events:", error);
  }
}

interface WorkspaceHistoryState {
  events: WorkspaceHistoryEvent[];
  append: (event: WorkspaceHistoryEvent) => void;
  clear: () => void;
  reload: () => void;
}

export const useWorkspaceHistoryStore = create<WorkspaceHistoryState>()((set, get) => ({
  events: loadEvents(),

  append: (event) => {
    const next = [event, ...get().events]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, MAX_EVENTS);
    saveEvents(next);
    set({ events: next });
  },

  clear: () => {
    saveEvents([]);
    set({ events: [] });
  },

  reload: () => {
    set({ events: loadEvents() });
  },
}));
