# 星轨画布 AI 代码深度审计报告

> 审计时间：2026-06-05 | 审计范围：全仓库 AI 相关代码  
> 审计方法：逐文件源码级审查，基于 GitHub raw 内容 + 目录结构扫描

---

## 一、AI 调用架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (Browser)                            │
│  callAiChat() / checkAiHealth() / getAiConfig()                 │
│  → fetch("/api/ai/chat") / fetch("/api/ai/chat/stream")        │
│  → localStorage 局部覆盖 (startrails_provider_*)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────────┐
│                   Next.js API Route (服务端)                      │
│  /api/ai/chat         → 非流式代理 → OpenAI 兼容 API             │
│  /api/ai/chat/stream  → SSE 流式代理 → OpenAI 兼容 API           │
│  /api/ai/generate-image → 文生图/图生图代理 (含重试)              │
│  /api/ai/health       → 连接测试 (GET/POST)                      │
│  /api/ai/config       → 安全配置返回 (GET, 不含 API Key)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (Bearer Token)
┌──────────────────────────▼──────────────────────────────────────┐
│               OpenAI 兼容 API (中转站/官方)                       │
│  /v1/chat/completions  → 文本/多模态对话                          │
│  /v1/images/generations → 图片生成                               │
│  /v1/images/edits       → 图生图                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、20 项 AI 能力逐项审计

| # | AI 能力项 | 当前实现 | 证据文件 | 风险 | 改造建议 |
|---|-----------|----------|----------|------|----------|
| **1** | **真实 LLM 调用** | ✅ 已实现。非流式 + SSE 流式两种模式，均通过 `/api/ai/chat` 和 `/api/ai/chat/stream` 代理到 OpenAI 兼容 API | `apps/web/src/app/api/ai/chat/route.ts` (非流式), `apps/web/src/app/api/ai/chat/stream/route.ts` (SSE) | 单点依赖：API 不可用则全部功能瘫痪 | 增加多 Provider 故障转移（OpenAI → Gemini → 国产模型） |
| **2** | **模型服务** | 🟡 仅支持 OpenAI 兼容协议。`AiProviderType` 硬编码为 `"openai-compatible"`，无其他厂商路由 | `apps/web/src/lib/ai/provider-config.ts` L17: `export type AiProviderType = "openai-compatible"` | 无法切换 Gemini/Claude/国产模型；厂商锁定风险 | 扩展 `AiProviderType` 为枚举，实现厂商路由层（Provider Router） |
| **3** | **API Key 配置** | ✅ 三层设计：(1) 服务端 `.env` → `AI_API_KEY`；(2) 兼容旧变量 `OPENAI_API_KEY`；(3) 前端 localStorage 局部覆盖，通过请求体 `_providerOverrides` 传递 | `provider-config.ts` L22-23, `client.ts` P2-5B 段 | localStorage 存储 API Key 有泄露风险（XSS 攻击） | 前端局部覆盖仅在 localhost 允许；增加 HttpOnly Cookie 方案 |
| **4** | **环境变量** | ✅ 7 个变量：`AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL`, `AI_DEFAULT_IMAGE_MODEL`, `AI_VIDEO_MODEL`, `AI_REQUEST_TIMEOUT_MS`，及兼容旧变量 `NEXT_PUBLIC_API_BASE_URL`, `OPENAI_API_KEY` | `provider-config.ts` L20-28 | `NEXT_PUBLIC_API_BASE_URL` 会打包到浏览器 bundle，暴露内网地址 | 移除 `NEXT_PUBLIC_` 前缀变量，仅用服务端变量 |
| **5** | **Prompt 位置** | ✅ (1) 分镜导演 System Prompt 在 `storyboard-director-agent.ts` 约 80 行；(2) 图片 Prompt 构建在 `storyboardImagePrompt.ts`；(3) SSE 流式对话的 System Prompt 在 `route.ts` 内嵌 | `storyboard-director-agent.ts` `STORYBOARD_DIRECTOR_SYSTEM_PROMPT`, `storyboardImagePrompt.ts` `buildStoryboardImagePrompt()` | Prompt 硬编码在 TS 文件中，修改需重新部署 | 将 Prompt 移至数据库或配置文件，支持 A/B 测试 |
| **6** | **Prompt 结构化** | ✅ 高度结构化。分镜导演 Prompt 包含 4 个步骤（场景分析→人物关系→情绪曲线→镜头方案），每个步骤有详细子规则；图片 Prompt 有 5 层注入（导演层/场景层/角色层/连续性层/风格层） | `storyboard-director-agent.ts` 完整 Prompt, `storyboardImagePrompt.ts` `describeDirectorLayer()` / `describeScene()` / `describeCharacterIdentities()` / `describeContinuity()` | Prompt 版本管理缺失，修改历史不可追溯 | 实现 Prompt 版本化存储 + 效果对比 |
| **7** | **要求模型返回 JSON** | ✅ 明确要求。System Prompt：`"只输出 JSON，不要前言、解释、Markdown 代码块"`；`parseDirectorJson()` 自动剥离 Markdown 代码块包裹 | `storyboard-director-agent.ts` Prompt 末尾, `parseDirectorJson()` 函数 | 依赖 LLM 遵守指令，无结构化输出保证（无 `response_format: json_object`） | 增加 `response_format: { type: "json_object" }` 参数；增加 JSON Schema 约束 |
| **8** | **JSON Schema 校验** | 🔴 无 JSON Schema。使用"弱校验"——枚举白名单 + 数值 clamp + 缺失字段补全默认值。15 种情绪、8 种场景功能、5 种景别、6 种机位、10 种运镜均有 `normalize*()` 函数 | `storyboard-director-agent.ts` `normalizeEmotion()`, `normalizeSceneFunction()`, `normalizeShotSize()`, `normalizeCameraAngle()`, `normalizeCameraMovement()`, `clampNumber()` | LLM 输出格式异常时静默替换为默认值，可能丢失导演意图 | 引入 Zod 或 JSON Schema 校验；校验失败时重新请求 LLM（最多 2 次） |
| **9** | **失败重试** | 🟡 图片生成有重试（指数退避 + 抖动，默认最多 2 次，触发条件 429/5xx）；文本/分镜生成无重试 | `apps/web/src/app/api/ai/generate-image/route.ts` 重试逻辑段；`storyboard-director-agent.ts` 无重试 | 分镜生成是核心功能，LLM 偶发失败会导致整个工作流中断 | 为所有 AI 调用增加统一重试中间件（指数退避 + jitter） |
| **10** | **流式输出** | ✅ 完整实现 SSE。逐字符 yield 实现打字机效果；兼容多种 API 格式（OpenAI delta/content、通用 content/text）；支持图片 URL yield | `apps/web/src/app/api/ai/chat/stream/route.ts` `streamFromRealAPI()` 约 80 行 | 流断开后无法恢复，需用户手动重试 | 增加断线重连机制（Last-Event-ID）；增加流式进度指示 |
| **11** | **错误处理** | ✅ 完善的错误归一化体系。`NormalizedAiError` 接口统一上游错误（401→unauthorized, 429→rate_limited, 5xx→upstream_error）和客户端错误（AbortError→timeout, TypeError→network_error） | `apps/web/src/lib/ai/errors.ts` 144 行，`normalizeUpstreamError()`, `normalizeClientError()` | 错误信息对用户不够友好（技术性太强）；无错误聚合上报 | 增加用户友好错误提示映射；集成 Sentry/日志收集 |
| **12** | **Token 成本控制** | 🔴 无。仅在 API 响应中透传 `usage` 字段，无请求前 Token 预算检查、无单用户配额、无成本追踪、无告警 | `apps/web/src/app/api/ai/chat/route.ts` L58-60 仅 `usage: data.usage`, `apps/web/src/app/api/ai/chat/stream/route.ts` 仅 `[USAGE]` marker 透传 | 无法控制成本；恶意用户可无限调用；无计费基础 | 实现请求级 Token 估算（tiktoken）+ 用户配额 + 日/月预算告警 |
| **13** | **速率限制** | 🔴 完全无。无 API 速率限制、无并发控制、无 IP/用户级限流 | 全项目搜索无 `rate`/`limit`/`throttle`/`ratelimit` 相关代码 | 生产环境易被滥用/DDoS；上游 API 被限流后无降级 | 实现 `rate-limiter-flexible`（内存版→Redis 版）；并发队列 |
| **14** | **缓存** | 🔴 几乎无。仅客户端内存缓存模型名（`_cachedDefaultModel` 等），无 AI 响应缓存、无 Prompt 结果缓存、无图片缓存 | `apps/web/src/lib/ai/client.ts` `_cachedDefaultModel` / `_cachedDefaultImageModel` / `_cachedVideoModel` | 重复请求浪费 Token；相同 Prompt 重复调用 | 实现 LRU 缓存层（相同 Prompt+参数 → 缓存结果）；图片 CDN 缓存 |
| **15** | **AI 结果持久化** | 🔴 无。分镜导演生成的 `StoryboardPlan`（scenes/shots/emotionalCurve）仅存在 Zustand 内存中，刷新即丢失 | `apps/web/src/app/canvas/stores/canvasStore.ts` 无持久化中间件 | **致命问题**：用户花费 Token 生成的结果刷新后全部丢失 | P0：实现 IndexedDB 自动保存 + Zustand persist 中间件 |
| **16** | **AI 结果可编辑** | 🟡 部分。画布支持节点拖拽和基础编辑，但无结构化编辑面板（无法修改单个镜头的景别/机位/情绪等字段）；编辑后无 Save 触发 | `StoryboardGridNode.tsx` 节点渲染；但无属性编辑面板 | 用户无法精确调整 AI 生成结果 | 实现分镜属性编辑面板（Shot Property Panel），双向绑定 CinematicShot 字段 |
| **17** | **编辑后影响后续生成** | 🔴 无。编辑后的结果不会反馈给 LLM 作为上下文，重新生成时不会考虑用户修改 | 无 feedback loop 代码 | 编辑与生成完全割裂，用户修改无法被 AI 学习 | 实现编辑历史作为 Few-Shot 示例注入后续 Prompt |
| **18** | **局部重新生成** | 🔴 无。无法单独重新生成某个镜头，必须重新运行整个分镜导演 Agent | 无单镜头重新生成按钮/API | 修改单个镜头需重跑全部分镜（浪费 Token + 时间） | 实现单镜头 Re-Generate 功能：仅发送该镜头上下文给 LLM |
| **19** | **上下文一致性** | 🟡 部分。SSE 流式对话支持注入画布节点上下文（最多 20 个节点摘要 + 附件信息）；但无跨会话记忆、无长对话上下文管理 | `apps/web/src/app/api/ai/chat/stream/route.ts` `context` 参数处理段 | 多轮对话会丢失上下文（无滑动窗口/摘要策略） | 实现对话记忆层（滑动窗口 + 关键信息摘要）；支持 @提及节点 |
| **20** | **角色/场景/风格记忆** | 🟡 角色记忆有框架（Character Asset Library），场景/风格记忆无。`characterAssetLibrary.ts` 实现了从所有镜头收集角色、去重合并、批量补丁更新；但无场景 Bible、无风格 Bible、无 IP-Adapter | `apps/web/src/lib/storyboard/characterAssetLibrary.ts` 180 行 | 多镜头角色外观无法保证一致（仅靠文字描述）；场景风格无法统一 | P2：实现 Scene Bible + Style Bible；P3：集成 IP-Adapter/ControlNet |

---

## 三、关键发现总结

### 3.1 架构优点

| 优点 | 详情 |
|------|------|
| **安全分层** | API Key 仅服务端持有，`getAiProviderConfigSafe()` 剥离 Key，前端仅知 `hasApiKey: boolean` |
| **错误归一化** | `NormalizedAiError` 统一 6 种错误码，上游/客户端分离处理 |
| **SSE 流式** | 完整的 ReadableStream 实现，逐字符推送，兼容多种 API 格式 |
| **分镜导演 Prompt 工程** | 4 步工作流 + 15 种情绪策略 + 8 种场景功能 + 5 种景别量化 + 4 项连续性检查 |
| **图片 Prompt 多层注入** | 导演层/场景层/角色身份层/连续性约束层/风格层，共 5 层拼接 |
| **图片生成重试** | 指数退避 + 随机抖动，可配置重试次数 |
| **角色资产库** | 归一化键值匹配 + 合并策略 + 批量补丁更新 |

### 3.2 架构缺陷

| 缺陷 | 严重程度 | 影响 |
|------|----------|------|
| **无 JSON Schema 校验** | 🔴 高 | LLM 输出格式异常时静默降级，可能丢失关键导演意图 |
| **分镜生成无重试** | 🔴 高 | 核心工作流中断后需用户手动重新触发 |
| **AI 结果不持久化** | 🔴 极高 | 刷新页面丢失所有生成结果，用户 Token 白费 |
| **无 Token 成本控制** | 🔴 高 | 无法预算、无法计费、可能被滥用 |
| **无速率限制** | 🔴 高 | 生产环境风险极高 |
| **无响应缓存** | 🟠 中 | 相同 Prompt 重复调用浪费 Token |
| **单 Provider 锁定** | 🟠 中 | 无法利用不同模型的优势 |
| **无角色/场景照片级一致性** | 🟠 中 | 多镜头角色外观靠文字描述，效果不稳定 |
| **编辑不回馈 AI** | 🟠 中 | 用户修正无法改进后续生成 |
| **Prompt 硬编码** | 🟡 低 | 迭代 Prompt 需改代码部署 |

---

## 四、改造优先级路线图

### P0 — 紧急（阻碍生产可用）
1. **AI 结果持久化**：Zustand persist 中间件 + IndexedDB → 预计 1 天
2. **分镜生成增加重试**：统一 AI 调用中间件（指数退避 + jitter）→ 预计 0.5 天
3. **JSON Schema 校验**：引入 Zod schema，校验失败自动重试 → 预计 1 天

### P1 — 高优先级（生产就绪要求）
4. **速率限制**：rate-limiter-flexible（内存版→Redis）→ 预计 1 天
5. **Token 成本控制**：tiktoken 估算 + 用户配额 + 预算告警 → 预计 2 天
6. **多 Provider 路由**：扩展 AiProviderType + Provider Router → 预计 2 天
7. **单镜头重新生成**：局部 Re-Generate API + UI 按钮 → 预计 1.5 天

### P2 — 中优先级（竞争力增强）
8. **角色/场景/风格 Bible**：持久化 Character Bible + Scene Bible + Style Bible → 预计 3 天
9. **AI 响应缓存**：LRU 缓存层（相同 Prompt+参数命中）→ 预计 1 天
10. **编辑反馈 AI 学习**：编辑历史作为 Few-Shot 注入 → 预计 2 天
11. **Prompt 配置化**：Prompt 模板库 + A/B 测试框架 → 预计 2 天
12. **IP-Adapter 集成**：角色参考图编码 + ControlNet 条件控制 → 预计 4 天

### P3 — 低优先级（长期规划）
13. **对话记忆层**：滑动窗口 + 关键信息摘要 → 预计 2 天
14. **视频模型集成**：Runway Gen-3/可灵 API → 预计 5 天
15. **多模态上下文**：图片参考 + 视频参考作为生成上下文 → 预计 3 天

---

## 五、AI 代码文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `apps/web/src/lib/ai/provider-config.ts` | ~160 | AI 提供商配置读取（环境变量 + 合并逻辑） |
| `apps/web/src/lib/ai/client.ts` | ~220 | 前端 AI 调用客户端（非流式 + 健康检查 + 配置） |
| `apps/web/src/lib/ai/errors.ts` | 144 | AI 错误归一化（上游/客户端两类） |
| `apps/web/src/lib/ai/index.ts` | ~20 | 统一导出入口 |
| `apps/web/src/app/api/ai/chat/route.ts` | ~80 | 非流式对话代理端点 |
| `apps/web/src/app/api/ai/chat/stream/route.ts` | ~400 | SSE 流式对话代理端点（含上下文注入 + 图片生成触发） |
| `apps/web/src/app/api/ai/generate-image/route.ts` | ~350 | 图片生成端点（含重试 + Prompt 增强 + 格式兼容） |
| `apps/web/src/app/api/ai/health/route.ts` | ~40 | 连接测试端点 |
| `apps/web/src/lib/storyboard-director-agent.ts` | 398 | 分镜导演 Agent（System Prompt + 解析 + 后处理） |
| `apps/web/src/lib/cinematic-rules.ts` | ~260 | 电影规则引擎（15 种情绪策略 + 4 项连续性检查） |
| `apps/web/src/lib/storyboard/storyboardImagePrompt.ts` | 149 | 图片 Prompt 5 层拼接构建器 |
| `apps/web/src/lib/storyboard/characterIdentitySummary.ts` | 139 | 角色身份摘要和 CRUD |
| `apps/web/src/lib/storyboard/characterAssetLibrary.ts` | 180 | 角色资产库（收集/合并/补丁更新） |
| `apps/web/src/lib/storyboard/productionRunQueue.ts` | 240 | 生产队列（单任务串行状态机） |
| `apps/web/src/app/canvas/hooks/useChatSSE.ts` | — | 前端 SSE 消费 Hook |
