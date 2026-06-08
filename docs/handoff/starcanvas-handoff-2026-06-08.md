# StarCanvas / 星轨画布 — 项目续接交接文档

> 更新时间：2026-06-08 16:30 GMT+8  
> 适用仓库：`https://github.com/732642856/-ai-`  
> 当前基线提交：`c1c7332 feat: P1-P2 full push — subtitle timeline, PDF print, video composition, export formats, Docker`

---

## 1. 项目定位

StarCanvas（星轨画布）是面向华语影视工作者的 AI Native 无限画布工具，目标是覆盖：

1. 剧本导入与 AI 分析
2. 角色 / 场景 / 视觉风格 Bible
3. 分镜拆解与镜头语言设计
4. 一键生图与多镜头批量生成
5. 图生视频 / 文生视频
6. 配音、字幕、视频合成
7. 项目包、PDF、字幕、交接文档导出

产品方向不是传统制片管理，不以拍摄日程、剧组管理、预算跟踪为核心；当前优先级是 AI 全流程影视创作落地。

---

## 2. 本机项目路径

```bash
/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
```

主力开发目录：

```bash
apps/web/
```

原则上只改 `apps/web`，`apps/api` 与 `packages/*` 目前作为实验或共享层，除非明确需要，不做大范围改动。

---

## 3. 技术栈与约束

- Next.js 16 App Router
- React 19
- TypeScript strict
- Zustand
- React Flow / `@xyflow/react`
- TailwindCSS v4
- pnpm monorepo，不更换包管理器

关键工程约束：

1. 不做无关重构，不删除不确定文件。
2. 所有 API Key 只允许服务端持有或本地开发显式配置，不能写入 Git 历史、测试报告或前端公开文件。
3. 多镜头分镜生图必须保持 direct-only：一次 multi-panel image API 请求，不允许静默 fallback 到逐镜头多次请求，避免浪费额度。
4. ReactFlow 节点更新必须优先使用 `setNodes` 函数式更新；若更新后立即读取节点，同步 `nodesRef.current`，避免 stale read。
5. 单元测试优先 `node:test` + `node:assert/strict`。不要为普通纯逻辑测试新增 Vitest 依赖。

---

## 4. 当前已在 main 的核心能力

### 4.1 分镜与角色一致性

- Director Agent 分析剧本并生成场景 / 分镜结构。
- `ShotNode` 支持分镜字段展示、编辑和生图入口。
- Character Identity / Character Asset Library 已有基础能力，用于多镜头角色外观一致性。
- `storyboardImagePrompt.ts` 支持角色一致性注入。
- `shot-to-ideogram-prompt.ts` 已用于将分镜转换为 Ideogram 风格提示词。

### 4.2 批量生图与生产队列

- `StoryboardBatchProgressOverlay` 支持批量分镜生图进度。
- `ProductionRunQueuePanel` 支持项目生产运行队列展示。
- `useProductionRunExecutor` 支持开始、中止、失败继续、重试、跳过。
- 生产队列动作包括分镜生图、配音、字幕、交接警告检查。

### 4.3 视频、字幕、导出

- 已有视频工作流模板、视频节点、字幕格式化、视频合成、PDF 分镜导出、项目包导出等能力。
- 当前 main 最新提交已包含字幕时间线、PDF 打印、视频合成、导出格式与 Docker 相关增量。

### 4.4 Vidu / Ideogram / 配音

- Ideogram 生图 API 已进入当前仓库。
- Vidu 相关 API 层已进入当前仓库，但仍需进一步确认前端执行链路是否完整调用 `/api/ai/generate-video-vidu`。
- TTS / voice_clone / OmniVoice 方向已有接口和 UI 支撑，但真实模型接入仍需继续验证。

---

## 5. 本轮已补上传的遗漏信息

本轮把开发版与散落目录中有长期价值、且不涉及运行时代码冲突的文档补入主仓库：

- `docs/audit/星轨画布_技术审计与差距分析报告.md`
- `docs/audit/星轨画布_画布能力20项审计报告.md`
- `docs/audit/TapNow能力矩阵_星轨画布对比分析.md`
- `docs/audit/星轨画布_数据模型审计报告.md`
- `docs/audit/星轨画布_AI代码深度审计报告.md`
- `docs/handoff/starcanvas-handoff-2026-06-08.md`

这些文档主要补齐：

1. TapNow 类 AI 影视创作能力矩阵。
2. StarCanvas 画布能力逐项差距。
3. AI 调用、安全、缓存、成本控制、持久化等代码审计。
4. 数据模型与 Script / CharacterBible / SceneBible / VisualStyleBible 缺口。
5. 当前项目续接规则与工程约束。

---

## 6. 已确认仍缺失、但不应直接覆盖合并的功能

PR #1 和旧开发版中存在以下候选文件，但不能直接 `checkout` 覆盖当前 main：

- `CharacterBiblePanel.tsx`
- `SceneBiblePanel.tsx`
- `VisualStyleBiblePanel.tsx`
- `ScriptImportPanel.tsx`
- `StoryboardShotEditorPanel.tsx`
- `bible-context.ts`
- `canvasIndexedDB.ts`
- `canvasPersistence.ts`
- `canvasStore.ts`

原因：当前 main 已经过后续多轮开发，`StarCanvas.tsx`、`canvasStore`、`types.ts`、`useWorkflowRunner`、视频 / 配音 / 导出链路都已有新结构。旧文件直接覆盖会造成类型冲突或功能回退。

正确路线是：

1. 阅读当前 main 的 `canvas/types.ts`、`canvasStore.ts`、`StarCanvas.tsx`。
2. 抽取旧文件中的交互设计和字段思路。
3. 按当前 main 架构重建轻量 `ScriptImportPanel` 与 Character / Scene / Visual Style Bible 面板。
4. 再补单元测试和必要的 E2E route mock。

---

## 7. 下一步优先路线

### P1：补齐剧本导入 + Bible 面板

目标：从“已有分镜 / 生图 / 视频 / 配音能力”前移到“用户真实从剧本开始”。

建议拆分：

1. `ScriptImportPanel`：支持粘贴剧本文本，后续再扩展 PDF / DOCX / FDX。
2. Character Bible：集中管理角色姓名、身份、外貌、服装、参考图、声音意图。
3. Scene Bible：集中管理地点、时代、光线、道具、氛围、连续性注意事项。
4. Visual Style Bible：项目级色调、摄影风格、构图、镜头语言和生图风格。
5. 将 Bible 信息注入分镜导演、图片 prompt、视频 prompt 与配音简报。

### P1：验证 Vidu 前端执行链路

确认点：

- 画布 VideoNode / workflow runner 是否能选择 Vidu。
- `/api/ai/generate-video-vidu` 是否被真实前端路径调用。
- 新增不消耗真实额度的 Playwright / unit route mock，避免测试耗费 API 额度。

### P2：把 AI 结果持久化与成本控制做成安全底座

建议：

- 继续使用 IndexedDB 保存画布与生成结果。
- 对 AI 调用增加请求级预算、并发控制与错误归一化。
- 保持 FOSS 路线，不加入商业付费墙。

---

## 8. 常用命令

```bash
# 查看仓库状态
git -C "/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas" status --short --branch

# 查看最新提交
git -C "/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas" log -5 --oneline

# TypeScript 检查
pnpm -C "/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas/apps/web" exec tsc --noEmit --project tsconfig.json --tsBuildInfoFile /tmp/starcanvas-web-tsconfig.tsbuildinfo

# 单元测试
pnpm -C "/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas/apps/web" test

# diff 空白检查
git -C "/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas" --no-pager diff --check
```

---

## 9. 接手前检查清单

1. 确认当前分支是 `main` 且工作区干净。
2. 先读本交接文档与 `docs/audit/` 中最新审计文档。
3. 不要直接恢复 PR #1 的删除项。
4. 不要把旧开发版的 `StarCanvas.tsx` / `canvasStore.ts` 覆盖到当前 main。
5. 从当前 main 架构出发重建缺失能力。

---

## 10. 一句话总结

当前 main 已经拥有分镜、生图、视频、配音、字幕、导出和生产队列的后段能力；剩余最关键遗漏是把“剧本导入 + Character / Scene / Visual Style Bible”按当前架构补上，并确认 Vidu 从 API 层贯通到画布执行链路。
