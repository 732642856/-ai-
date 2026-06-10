/**
 * Returns a stable function reference of the same type.
 * Extracted from Excalidraw (MIT License).
 * Copyright (c) 2020 Excalidraw, Inc.
 */
import { useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useStableCallback = <T extends (...args: any[]) => any>(
  userFn: T,
) => {
  const stableRef = useRef<{ userFn: T; stableFn?: T }>({ userFn });
  stableRef.current.userFn = userFn;

  if (!stableRef.current.stableFn) {
    stableRef.current.stableFn = ((...args: unknown[]) =>
      stableRef.current.userFn(...args)) as T;
  }

  return stableRef.current.stableFn as T;
};
