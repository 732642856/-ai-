"use client";

import { useEffect, useState } from "react";
import {
  createManagedObjectUrl,
  revokeManagedObjectUrl,
} from "../lib/images/objectUrlRegistry.ts";

/**
 * Creates a browser object URL for a Blob/File and revokes it when the source
 * changes or the owning component unmounts.
 *
 * The returned URL is runtime-only. Never persist it to localStorage or send it
 * to backend APIs; persist the underlying Blob/File through IndexedDB instead.
 */
export function useObjectUrl(blob?: Blob | File | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }

    let revoked = false;
    const url = createManagedObjectUrl(blob);
    setObjectUrl(url);

    return () => {
      if (!revoked) {
        revokeManagedObjectUrl(url);
        revoked = true;
      }
    };
  }, [blob]);

  return objectUrl;
}
