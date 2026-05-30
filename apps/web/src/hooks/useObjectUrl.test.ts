import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import React, { StrictMode } from "react";
import { useObjectUrl } from "./useObjectUrl.ts";

function Probe({ blob }: { blob?: Blob | null }) {
  const url = useObjectUrl(blob);
  return React.createElement("img", { src: url ?? undefined, alt: "preview" });
}

describe("useObjectUrl", () => {
  it("renders with a null URL during SSR when blob is null", () => {
    const html = renderToString(React.createElement(Probe, { blob: null }));

    assert.match(html, /preview/);
    assert.doesNotMatch(html, /blob:/);
  });

  it("does not create object URLs during SSR", () => {
    const html = renderToString(
      React.createElement(Probe, {
        blob: new Blob(["a"], { type: "image/png" }),
      }),
    );

    assert.match(html, /preview/);
    assert.doesNotMatch(html, /blob:/);
  });

  it("is safe to include under React StrictMode during SSR", () => {
    const html = renderToString(
      React.createElement(
        StrictMode,
        null,
        React.createElement(Probe, {
          blob: new Blob(["a"], { type: "image/png" }),
        }),
      ),
    );

    assert.match(html, /preview/);
  });
});
