import { initialData } from "./seed";
import type { AppData } from "./types";

/**
 * Persistence boundary for the UI store. Replace this browser adapter with a
 * server-side PostgreSQL implementation in Stage 2 without changing screens.
 */
export interface HrRepository {
  load(): AppData;
  save(data: AppData): void;
}

const STORAGE_KEY = "rrf-hr-nexus-demo-v1";
export const browserDemoRepository: HrRepository = {
  load() {
    if (typeof window === "undefined") return initialData;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AppData) : initialData;
    } catch {
      return initialData;
    }
  },
  save(data) {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};
