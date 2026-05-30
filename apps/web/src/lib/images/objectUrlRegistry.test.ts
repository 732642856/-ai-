import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createManagedObjectUrl,
  getManagedObjectUrlCount,
  isBlobObjectUrl,
  revokeAllManagedObjectUrls,
  revokeManagedObjectUrl,
} from "./objectUrlRegistry.ts";

describe("objectUrlRegistry", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let counter: number;
  let revokeCalls: string[];

  beforeEach(() => {
    counter = 0;
    revokeCalls = [];
    URL.createObjectURL = ((blob: Blob) => {
      counter += 1;
      assert.ok(blob instanceof Blob);
      return `blob:managed-${counter}`;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      revokeCalls.push(url);
    }) as typeof URL.revokeObjectURL;
  });

  afterEach(() => {
    revokeAllManagedObjectUrls();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("detects blob object URLs only", () => {
    assert.equal(isBlobObjectUrl("blob:http://localhost/1"), true);
    assert.equal(isBlobObjectUrl("https://example.com/a.png"), false);
    assert.equal(isBlobObjectUrl("data:image/png;base64,AAAA"), false);
    assert.equal(isBlobObjectUrl(null), false);
  });

  it("creates and tracks managed URLs", () => {
    const url = createManagedObjectUrl(new Blob(["a"], { type: "image/png" }));

    assert.equal(url, "blob:managed-1");
    assert.equal(getManagedObjectUrlCount(), 1);
  });

  it("revokes only URLs created by the registry", () => {
    const url = createManagedObjectUrl(new Blob(["a"], { type: "image/png" }));

    revokeManagedObjectUrl("blob:external");
    revokeManagedObjectUrl("https://example.com/a.png");
    revokeManagedObjectUrl("data:image/png;base64,AAAA");
    revokeManagedObjectUrl(url);

    assert.deepEqual(revokeCalls, ["blob:managed-1"]);
    assert.equal(getManagedObjectUrlCount(), 0);
  });

  it("does not revoke the same managed URL twice", () => {
    const url = createManagedObjectUrl(new Blob(["a"], { type: "image/png" }));

    revokeManagedObjectUrl(url);
    revokeManagedObjectUrl(url);

    assert.deepEqual(revokeCalls, ["blob:managed-1"]);
  });

  it("revokes all active managed URLs", () => {
    createManagedObjectUrl(new Blob(["a"], { type: "image/png" }));
    createManagedObjectUrl(new Blob(["b"], { type: "image/png" }));

    revokeAllManagedObjectUrls();

    assert.deepEqual(revokeCalls, ["blob:managed-1", "blob:managed-2"]);
    assert.equal(getManagedObjectUrlCount(), 0);
  });
});
