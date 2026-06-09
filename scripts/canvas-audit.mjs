import { chromium } from "playwright-core";
import { writeFileSync } from "fs";

const BASE = "http://localhost:3000";

async function audit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  page.on("response", (resp) => {
    if (!resp.ok() && resp.status() >= 400) {
      networkFailures.push({ url: resp.url(), status: resp.status() });
    }
  });

  // ─── 1. 首页 ───
  console.log("\n📄 [1/5] 首页 /");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 15000 });
  await page.screenshot({ path: "/tmp/canvas-audit-home.png", fullPage: false });
  const homeTitle = await page.title();
  console.log(`   Title: ${homeTitle}`);

  // ─── 2. Canvas 页 ───
  console.log("\n📄 [2/5] Canvas /canvas");
  await page.goto(`${BASE}/canvas`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/canvas-audit-canvas.png", fullPage: false });

  // Check for React Scan toolbar
  const hasReactScan = await page.evaluate(() => {
    return typeof (window as any).__REACT_SCAN__ !== "undefined";
  });
  console.log(`   React Scan active: ${hasReactScan}`);

  // Check for key UI elements
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasCanvas = bodyText.toLowerCase().includes("canvas") || bodyText.toLowerCase().includes("画布");
  const hasWorkflow = bodyText.toLowerCase().includes("workflow") || bodyText.toLowerCase().includes("工作流");
  console.log(`   Canvas visible: ${hasCanvas}`);
  console.log(`   Workflow visible: ${hasWorkflow}`);

  // Check localStorage for supermemory data
  const hasSupermemory = await page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open("supermemory");
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  });
  console.log(`   supermemory IndexedDB: ${hasSupermemory}`);

  // Check Sentry
  const hasSentry = await page.evaluate(() => {
    return typeof (window as any).Sentry !== "undefined";
  });
  console.log(`   Sentry loaded: ${hasSentry}`);

  // Check localStorage persistence
  const hasLocalStorageCanvas = await page.evaluate(() => {
    return localStorage.getItem("startrails_canvas") !== null;
  });
  console.log(`   Canvas persistence (localStorage): ${hasLocalStorageCanvas}`);

  // ─── 3. 检查所有 AI 接口路由 ───
  console.log("\n📄 [3/5] API routes");
  const routes = [
    "/api/ai/chat",
    "/api/ai/config",
    "/api/ai/generate-image",
    "/api/ai/generate-video",
    "/api/ai/generate-video-vidu",
    "/api/ai/tts",
    "/api/ai/health",
  ];
  for (const route of routes) {
    try {
      const resp = await page.request.get(route);
      console.log(`   ${route} → ${resp.status()} ${resp.statusText()}`);
    } catch (e) {
      console.log(`   ${route} → ERROR: ${e.message}`);
    }
  }

  // ─── 4. 控制台错误 ───
  console.log(`\n📄 [4/5] Console errors (${consoleErrors.length})`);
  for (const err of consoleErrors.slice(0, 10)) {
    console.log(`   ❌ ${err.slice(0, 200)}`);
  }

  // ─── 5. 网络失败 ───
  console.log(`\n📄 [5/5] Network failures (${networkFailures.length})`);
  for (const nf of networkFailures.slice(0, 10)) {
    console.log(`   ⚠️  ${nf.status} ${nf.url.slice(0, 100)}`);
  }

  // ─── 截图保存 ───
  console.log("\n📸 Screenshots saved to /tmp/canvas-audit-*.png");

  await browser.close();
}

audit().catch((e) => {
  console.error("Audit failed:", e.message);
  process.exit(1);
});
