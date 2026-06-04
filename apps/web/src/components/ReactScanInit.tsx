"use client";

import { useEffect } from "react";

/**
 * React Scan initialization — detects and highlights unnecessary re-renders
 * in development mode. Zero overhead in production.
 *
 * Install: pnpm add react-scan -D --filter web
 * Usage: Import this component in layout.tsx
 *
 * More: https://react-scan.com/ · https://github.com/aidenybai/react-scan
 */
export function ReactScanInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    import("react-scan")
      .then(({ scan }) => {
        scan({
          enabled: true,
          log: false,
          showToolbar: true,
        });
      })
      .catch(() => {
        // react-scan not installed — that's fine
      });
  }, []);

  return null;
}
