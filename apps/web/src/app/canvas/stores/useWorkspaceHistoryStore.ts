import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  WorkspaceHistoryEvent,
  WorkspaceHistoryStorage,
} from "../types/workspace-history";
import {
  loadPersistedState,
  persistState,
} from "../../../lib/localStoragePersist.ts";

const STORAGE_KEY = "startrails_workspace_history:current";
const STORAGE_VERSION = 1;
const MAX_EVENTS = 300;

function loadEvents(): WorkspaceHistoryEvent[] {
  return loadPersistedState<WorkspaceHistoryStorage>(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, events: [] },
  ).events;
}

function saveEvents(events: WorkspaceHistoryEvent[]): void {
  persistState(
    { key: STORAGE_KEY, version: STORAGE_VERSION },
    { version: STORAGE_VERSION, events },
  );
}

interface WorkspaceHistoryState {
  events: WorkspaceHistoryEvent[];
  append: (event: WorkspaceHistoryEvent) => void;
  clear: () => void;
  reload: () => void;
}

export const useWorkspaceHistoryStore = create<WorkspaceHistoryState>()(
  devtools(
    (set, get) => ({
      events: loadEvents(),

      append: (event) => {
        const next = [event, ...get().events]
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, MAX_EVENTS);
        saveEvents(next);
        set({ events: next }, false, "appendWorkspaceEvent");
      },

      clear: () => {
        saveEvents([]);
        set({ events: [] }, false, "clearWorkspaceHistory");
      },

      reload: () => {
        set({ events: loadEvents() }, false, "reloadWorkspaceHistory");
      },
    }),
    { name: "workspaceHistory" },
  ),
);
