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

    (async () => {
      try {
        const dynamicImport = new Function("specifier", "return import(specifier)") as <T = any>(specifier: string) => Promise<T>;
        const [{ version: reactVersion }, { version: reactDomVersion }, { scan }] = await Promise.all([
          import("react"),
          import("react-dom"),
          dynamicImport<{ scan: (options: { enabled: boolean; log: boolean; showToolbar: boolean }) => void }>("react-scan"),
        ]);
        if (reactVersion !== reactDomVersion) return;
        scan({
          enabled: true,
          log: false,
          showToolbar: true,
        });
        (window as typeof window & { __REACT_SCAN__?: boolean }).__REACT_SCAN__ = true;
      } catch {
        // react-scan is optional in local dev and can lag behind React/Next bundling changes.
      }
    })();
  }, []);

  return null;
}
