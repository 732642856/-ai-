/**
 * Tests for Voice Clone service configuration and models.
 * Validates Python service structure without needing Python runtime.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
describe("Voice Clone — Dockerfile", () => {
  const dockerfile = fs.readFileSync(path.join(SERVICE_DIR, "Dockerfile"), "utf-8");

  it("使用 python:3.12-slim 基础镜像", () => {
    assert.ok(dockerfile.includes("python:3.12-slim"));
  });

  it("暴露 8765 端口", () => {
    assert.ok(dockerfile.includes("8765"));
  });

  it("创建非 root 用户", () => {
    assert.ok(dockerfile.includes("useradd") || dockerfile.includes("adduser"));
    assert.ok(dockerfile.includes("voiceclone"));
  });

  it("包含 HEALTHCHECK", () => {
    assert.ok(dockerfile.includes("HEALTHCHECK"));
  });

  it("CMD 启动 uvicorn", () => {
    assert.ok(dockerfile.includes("uvicorn"));
  });
});

describe("Voice Clone — requirements.txt", () => {
  const requirements = fs.readFileSync(path.join(SERVICE_DIR, "requirements.txt"), "utf-8");

  it("包含 fastapi", () => {
    assert.ok(requirements.includes("fastapi"));
  });

  it("包含 uvicorn", () => {
    assert.ok(requirements.includes("uvicorn"));
  });

  it("包含 httpx", () => {
    assert.ok(requirements.includes("httpx"));
  });
});

describe("Voice Clone — .env.example", () => {
  const env = fs.readFileSync(path.join(SERVICE_DIR, ".env.example"), "utf-8");

  it("包含 OMNIVOICE_SPACE_URL", () => {
    assert.ok(env.includes("OMNIVOICE_SPACE_URL"));
  });

  it("包含 VOICE_CLONE_DATA_DIR", () => {
    assert.ok(env.includes("VOICE_CLONE_DATA_DIR"));
  });
});
