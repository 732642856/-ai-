# Startrail Canvas 本地开发启动指南

## 快速启动

```bash
cd /Users/wuyongnaren/Projects/starcanvas-main
NODE_OPTIONS="" HTTPS_PROXY="" HTTP_PROXY="" nohup pnpm dev > /tmp/starcanvas-dev.log 2>&1 &
```

前台启动（查看实时日志）：
```bash
cd /Users/wuyongnaren/Projects/starcanvas-main
NODE_OPTIONS="" HTTPS_PROXY="" HTTP_PROXY="" pnpm dev
```

## 必须清理的环境变量

| 变量 | 问题 | 处理 |
|------|------|------|
| `NODE_OPTIONS` | 包含 `--use-system-ca`，Node 24 不支持，启动立即失败 | `NODE_OPTIONS=""` |
| `HTTP_PROXY` / `HTTPS_PROXY` | 指向 `127.0.0.1:7899`，代理会拦截 AI API 请求，图片生成（长连接 ~2min）会超时 | `HTTP_PROXY="" HTTPS_PROXY=""` |

**三个变量必须同时清空**，否则图片生成会 "fetch failed"。

## 项目信息

| 项目 | 值 |
|------|------|
| 项目类型 | Next.js 16.2.6 + pnpm monorepo (Turborepo) |
| 包管理器 | pnpm 10.33.0 |
| 前端应用目录 | `apps/web` |
| 正确启动命令 | `NODE_OPTIONS="" HTTPS_PROXY="" HTTP_PROXY="" pnpm dev` |
| 实际 dev server URL | `http://localhost:3000` |
| 星轨画布页面路径 | `/canvas` |
| 完整画布 URL | `http://localhost:3000/canvas` |

## 路由结构

- `/` — 首页 (`apps/web/src/app/page.tsx`)
- `/canvas` — 星轨画布 (`apps/web/src/app/canvas/page.tsx`)

## 环境变量

`.env.local` 已存在于 `apps/web/.env.local`，包含 AI Provider 配置（copse.top 中转站）。
缺少 AI Key 不影响画布 UI 的打开和操作，只影响 AI 生成功能。

## 图片生成注意事项

- `copse.top` 的 `/images/generations`（gpt-image-2）响应时间约 2 分钟
- 代码中 `AI_REQUEST_TIMEOUT_MS` 设为 120000ms（120s），可能不够，建议改为 180000ms（180s）
- `/chat/completions` 响应很快（几秒），不受影响
- 直连（无代理）可以正常工作，代理模式下长连接会超时

## 端口

默认端口 3000。如果被占用，Next.js 会自动切换到其他端口（如 3456）。
启动后请以终端输出的 `Local:` URL 为准，不要凭经验猜。

## 禁止事项

- 不要混用 npm/yarn/bun，只用 pnpm
- 不要同时启动多个 dev server
- 不要猜测端口，以终端输出为准
- 不要在 `NODE_OPTIONS` 包含 `--use-system-ca` 的情况下启动（Node 24 不兼容）
- 不要带着 HTTP_PROXY/HTTPS_PROXY 启动（会导致图片生成 fetch failed）
