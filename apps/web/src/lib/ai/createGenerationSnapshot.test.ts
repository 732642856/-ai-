import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createImageGenerationSnapshot } from "./createGenerationSnapshot.ts";

describe("createImageGenerationSnapshot", () => {
  it("creates a running text-to-image snapshot", () => {
    const snapshot = createImageGenerationSnapshot({
      requestId: "req-1",
      mode: "text-to-image",
      userPrompt: "cinematic frame",
      model: "gpt-image-2",
      size: "1792x1024",
    });

    assert.equal(snapshot.requestId, "req-1");
    assert.equal(snapshot.mode, "text-to-image");
    assert.equal(snapshot.status, "running");
    assert.equal(snapshot.completedAt, undefined);
    assert.match(snapshot.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps image-to-image provenance metadata", () => {
    const snapshot = createImageGenerationSnapshot({
      requestId: "req-2",
      mode: "image-to-image",
      userPrompt: "make a variation",
      model: "gpt-image-2",
      size: "1024x1024",
      sourceNodeId: "node-1",
      sourceAssetId: "asset-1",
      referenceImage: {
        assetId: "asset-1",
        width: 1024,
        height: 768,
        sentByteSize: 1200,
      },
    });

    assert.equal(snapshot.sourceNodeId, "node-1");
    assert.equal(snapshot.sourceAssetId, "asset-1");
    assert.equal(snapshot.referenceImage?.assetId, "asset-1");
    assert.equal(snapshot.referenceImage?.sentByteSize, 1200);
  });

  it("does not persist runtime blob URLs or inline image payloads in referenceImage", () => {
    const snapshot = createImageGenerationSnapshot({
      requestId: "req-3",
      mode: "image-to-image",
      userPrompt: "make a variation",
      model: "gpt-image-2",
      size: "1024x1024",
      sourceNodeId: "node-1",
      sourceAssetId: "asset-1",
      referenceImage: {
        assetId: "asset-1",
        url: "blob:http://localhost/reference",
        src: "blob:http://localhost/src",
        dataUrl: "data:image/png;base64,AAAA",
        base64: "data:image/png;base64,BBBB",
        imageUrl: "blob:http://localhost/image",
        mimeType: "image/png",
        width: 1024,
        height: 768,
        sentByteSize: 1200,
      },
    });

    assert.equal(snapshot.referenceImage?.assetId, "asset-1");
    assert.equal(snapshot.referenceImage?.mimeType, "image/png");
    assert.equal(snapshot.referenceImage?.width, 1024);
    assert.equal(snapshot.referenceImage?.height, 768);
    assert.equal(snapshot.referenceImage?.sentByteSize, 1200);
    assert.equal(snapshot.referenceImage?.url, undefined);
    assert.equal(snapshot.referenceImage?.src, undefined);
    assert.equal(snapshot.referenceImage?.dataUrl, undefined);
    assert.equal(snapshot.referenceImage?.base64, undefined);
    assert.equal(snapshot.referenceImage?.imageUrl, undefined);
    assert.doesNotMatch(JSON.stringify(snapshot), /blob:|data:image/);
  });
});
