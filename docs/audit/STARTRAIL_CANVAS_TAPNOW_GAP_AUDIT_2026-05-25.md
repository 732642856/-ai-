# STARTRAIL_CANVAS_TAPNOW_GAP_AUDIT

日期：2026-05-25  
项目：Startrail Canvas / 星轨画布  
范围：基于当前代码库与 TapNow 对标分析，对产品能力、工程完成度、伪完成点、主链路风险与后续排期做审计。  
原则：本轮不以实现功能为主；只做梳理、审计、查漏补缺、形成可执行计划。

---

## 0. 结论先行

Startrail Canvas 现在已经不是“空壳画布”。它有一条相对成型的前期创作主链路：

```text
剧本 / Prompt Source → ShotNode → ImageNode → Storyboard Composite → Asset Library / Export
```

其中最成熟的是：

1. **无限画布基础**：React Flow 画布、节点、边、选择、右键菜单、浮动工具条都已具备。
2. **图片资产持久化**：localStorage 只存轻量节点结构，图片 Blob 进入 IndexedDB；已有 sanitization 防线。
3. **分镜拆分与 Shot 生图**：Source 可以拆成 ShotNode，ShotNode 可以单独出图并生成 ImageNode 血缘。
4. **多选 Shot → 一张 Composite ImageNode**：产品语义已基本理清，主按钮是“生成一张分镜图”，次按钮才是“分别生成单图”。
5. **AI Chat / Canvas Actions 雏形**：AI 可以读画布摘要，也能返回部分结构化 action，让画布新增、更新、连接、运行节点。

但它距离 TapNow 式“可用的 AI 创作操作系统”还有明显差距。核心差距不是 UI，而是：

- **命令没有统一执行总线**：Slash Menu 更像 prompt shortcut，不是完整 command bus。
- **Agent 不具备稳定多步规划能力**：现在有 action parser 和 apply layer，但没有 plan / preview / approval / rollback / diff。
- **视频链路伪完成风险最高**：已有 VideoNode、workflow template、Seedance 等文案，但真实视频生成、轮询、结果持久化、错误恢复未生产化。
- **素材库是本地轻量库，不是可复用资产系统**：缺少资产引用关系、跨项目复用、资产版本、来源血缘。
- **模板系统缺失**：目前只有硬编码“前期工作流”，不是用户可选择、可保存、可复用的模板体系。
- **成本感知停留在记录层**：已有 usage store / estimate，但没有在高成本操作前做显式预算、确认、消耗反馈。

### 推荐下一步

先做 **P3-Fix：多选合成逻辑补测试 + 验证 + 报告**，不要急着上复杂设置面板，也不要马上接视频 API。

原因很简单：分镜链路是当前最接近产品闭环的地方。先把它打磨成“用户明确知道点一下会发生什么、不会浪费算力、结果可追踪、刷新不丢”的稳定链路，才值得往 Agent、模板、视频扩展。

---

## 1. 审计依据与代码证据

### 1.1 主要代码入口

| 模块 | 文件 | 证据 / 说明 |
|---|---|---|
| 主画布 | `apps/web/src/app/canvas/StarCanvas.tsx` | 节点注册、分镜拆分、生图、合成、导出、AI actions、workflow template 均集中在此 |
| 节点类型 | `components/canvas/types.ts` | CanvasNodeData / CanvasNodeKind / AssetItem 等核心类型 |
| Shot UI | `components/nodes/ShotNode.tsx` | 三段式 UI：剧本文本 / 生图 Prompt / 输出状态 |
| Grid UI | `components/nodes/StoryboardGridNode.tsx` | 九宫格状态显示、缩略图、缺图 / 生成中 / 失败 |
| 图片节点 | `components/nodes/ImageNode.tsx` | 图片上传、生成、预览、尺寸、hover toolbar |
| 添加节点面板 | `components/toolbar/AddNodePanel.tsx` | TapNow 风格节点入口，含文本 / 图像 / 视频 / 声音 / 工具 |
| 素材库 | `components/canvas/AssetLibraryPanel.tsx` | 本地素材库、分类、搜索、收藏、删除、拖拽 |
| Chat 面板 | `components/chat/ChatPanel.tsx` | 读取画布摘要、SSE、附件、actions 应用 |
| Slash Menu | `components/chat/SlashCommandMenu.tsx` | 命令 UI 和命令定义 |
| Slash 类型 | `types/slash-commands.ts` | command category / modelType / minSelection / actionType 等类型 |
| Canvas Actions | `features/canvas/actions/chatActions.ts` | create/update/connect/select/focus/run/delete action 类型 |
| Workflow Runner | `hooks/useWorkflowRunner.ts` | 工作流节点执行、文本 / 图像 / mock 视频分析、用量记录 |
| 持久化 | `hooks/useCanvasPersistence.ts` | localStorage + IndexedDB hydrate/save |
| 清洗 | `src/lib/storage/sanitizePersistedCanvas.ts` | runtime URL / base64 清洗 |
| 本地合成 | `utils/storyboardGridComposer.ts` | canvas.toDataURL 输出多格图 |
| 图片生成 API | `app/api/ai/generate-image/route.ts` | 文生图 / 图生图端点封装，返回 data:image 或 url |
| 用量记录 | `features/canvas/usage/useAIUsageStore.ts` | AI 用量记录，仅记录不扣费 |
| 成本估算 | `features/canvas/usage/estimateCost.ts` | text/image/video 估算逻辑 |
| 运行面板 | `components/workflow/WorkflowRunPanel.tsx` | 工作流运行状态可视化 |

### 1.2 当前重要事实

- `StarCanvas.tsx` 中 `nodeTypes` 已注册：`image`、`content`、`workflow`、`shot`、`storyboardGrid`。
- `AddNodePanel.tsx` 的注释写着“只保留已接线、可立即使用的入口”，但视频 / 声音 / composition 中仍存在“看起来能做、实际只是意图节点”的风险。
- `useCanvasPersistence.ts` 保存前调用 `sanitizeNodesForPersistence(nodes)`。
- `sanitizePersistedCanvas.ts` 会移除 `blob:`、`data:image`、`data:video`、`data:audio` 等 runtime URL。
- `storyboardGridComposer.ts` 会返回 `canvas.toDataURL("image/png")`，因此调用方必须立即 `persistImageDataUrl`，不能让 dataURL 进入节点持久化层。
- `generateImageFromPrompt.ts` 已把 `data:image` 结果转存 IndexedDB，返回 objectURL + assetId。
- `ChatPanel.tsx` 会生成节点摘要、读取选中节点，并解析 AI 返回的 canvas actions。
- `chatActions.ts` 的 action 类型目前是轻量 action，不包含复杂 plan、diff、rollback、confirm schema。
- `useWorkflowRunner.ts` 里有 `generateMockFrameUrls` 与 `runMockVideoAnalyze`，说明视频分析部分仍带 mock / 预演性质。

---

## 2. 当前产品能力地图

| 能力域 | 具体能力 | 当前是否存在 | 入口在哪里 | 涉及文件 | 当前完成度 | 用户是否可感知 | 主要问题 | 对标 TapNow 差距 |
|---|---:|---:|---|---|---:|---:|---|---|
| 无限画布 | 缩放、拖拽、节点、边、背景 | 是 | `/canvas` 主页面 | `StarCanvas.tsx` | 80% | 是 | 画布层能力集中在单一大组件，后续可维护性压力大 | TapNow 更像完整创作工作台，布局与操作一致性更强 |
| 节点系统 | content / image / workflow / shot / storyboardGrid | 是 | 左侧添加面板、右键、AI actions | `StarCanvas.tsx`, `types.ts` | 75% | 是 | 节点语义混杂，workflow 节点有“意图节点”和“可执行节点”混用 | TapNow 的节点能力边界通常更明确 |
| 添加节点 | TapNow 风格添加面板 | 是 | 左侧 Toolbar → Add Node | `AddNodePanel.tsx` | 70% | 是 | 部分入口看起来可生产内容，但实际只是草稿 / 意图 | TapNow 入口通常和可执行能力绑定更紧 |
| 右键菜单 | 节点 / 边 / 画布菜单 | 是 | 右键节点 / 画布 / 边 | `NodeContextMenu.tsx`, `CanvasContextMenu.tsx`, `EdgeContextMenu.tsx` | 70% | 是 | 功能入口较多，能力成熟度不一致 | TapNow 操作分层更清晰，低成熟功能通常不会强展示 |
| 分镜拆分 | Source / Storyboard → ShotNode | 是 | 节点右键“拆分镜头” | `storyboardParser.ts`, `layoutStoryboardShots.ts`, `StarCanvas.tsx` | 80% | 是 | 解析质量依赖输入格式，缺少可编辑 shot list 表格 | TapNow 更偏结构化 workflow / batch pipeline |
| Shot UI | 剧本文本 / Prompt / 输出状态 | 是 | ShotNode | `ShotNode.tsx` | 85% | 是 | 状态可视化已有，但失败恢复 / 重试策略还不完整 | TapNow 更强调任务状态和结果复用 |
| Shot 单独出图 | ShotNode → ImageNode | 是 | Shot 右键 / 事件 | `handleGenerateShotImage`, `createShotImageNode.ts` | 80% | 是 | 需要继续验证 prompt、asset、edge 一致性 | TapNow 对批量和血缘显示更稳定 |
| 多选 Shot 合成 | 多个 Shot → 一张 Composite ImageNode | 部分存在 | 多选浮动条 / 右键 | `handleComposeSelectedShots` | 65% | 是 | 当前混合情况逻辑应改为“全部有图才本地合成，否则一次模型生成” | TapNow 更重视批量语义和算力成本控制 |
| 九宫格状态 | Grid 节点展示 ready/missing/failed | 是 | StoryboardGridNode | `StoryboardGridNode.tsx` | 75% | 是 | Grid 与新 composite ImageNode 语义还需统一 | TapNow 结果节点 / 网格预览更像正式产物 |
| 图片生成 | 文生图 / 图生图 | 是 | ImageNode / Workflow / API route | `imageGeneration.ts`, `generate-image/route.ts` | 75% | 是 | provider 兼容依赖大量诊断日志，图生图仍需视觉 QA | TapNow 通常把模型能力和失败提示包装得更产品化 |
| 图片持久化 | IndexedDB 存 Blob，localStorage 存轻量 JSON | 是 | 自动 | `localImageStore.ts`, `useCanvasPersistence.ts`, `sanitizePersistedCanvas.ts` | 85% | 间接可感知 | 需要继续补 composite 本地合成安全测试 | TapNow 若有云资产，应跨设备 / 跨项目更完整 |
| 素材库 | 分类、搜索、收藏、删除、拖拽 | 是 | 左侧素材库 / 右键保存 | `AssetLibraryPanel.tsx`, `canvasStore.ts` | 55% | 是 | 本地轻量库，不是资产系统；缺少版本、来源、跨项目 | TapNow 的 Asset / library 更像生产资产管理 |
| Chat Copilot | 读取画布摘要、附件、SSE | 是 | 右侧 Chat Panel | `ChatPanel.tsx`, `useChatSSE.ts` | 65% | 是 | 对话历史是 mock，本地状态不是真持久会话 | TapNow Copilot 更像持续项目上下文代理 |
| Canvas Actions | AI 创建 / 更新 / 连接 / 聚焦 / 运行节点 | 是 | AI 返回 `canvas-actions` | `chatActions.ts`, `applyChatActions` | 55% | 部分可感知 | 缺少 plan preview、diff、撤销、执行权限层 | TapNow Agent 操作应更像可审计任务流 |
| Slash Commands | Slash 菜单与命令列表 | 是 | ChatInput slash | `SlashCommandMenu.tsx`, `slash-commands.ts` | 45% | 是 | 多数命令是菜单项 / prompt shortcut，未统一接入 command bus | TapNow 的 slash / quick command 应能稳定触发具体动作 |
| 工作流执行 | 单节点 / 上游 / 下游 / 全链路执行 | 部分存在 | 右键菜单 / WorkflowRunPanel | `useWorkflowRunner.ts`, `execution-plan.ts` | 60% | 是 | 部分节点真实执行，部分节点只是文本处理或 mock | TapNow 对 workflow 的状态、输入输出、重试更强 |
| 运行状态 | RunPanel 显示 running/success/failed | 是 | WorkflowRunPanel | `WorkflowRunPanel.tsx` | 70% | 是 | 缺少完整日志、重试、成本、耗时汇总 | TapNow 更强调作业队列和任务结果管理 |
| AI 用量 | 记录 token / image / video 估算 | 是 | store 层 | `useAIUsageStore.ts`, `estimateCost.ts` | 50% | 弱 | 仅记录，不扣费，不做预算确认 | TapNow 点数 / token 消耗通常更前置可见 |
| 导出 | 导出前期 JSON 包 | 是 | 顶部 / 工具按钮 | `handleExportProjectPackage` | 60% | 是 | 导出偏 JSON，缺少导入、资产打包、恢复校验 | TapNow 更可能支持项目级导出 / 分享 / 复用 |
| 模板 | 一键前期工作流 | 部分存在 | AddNodePanel → 前期工作流 | `handleCreateVideoWorkflow` | 35% | 是 | 硬编码模板，不是模板系统 | TapNow 模板体系通常是核心增长和复用能力 |
| 视频生成 | video-generation 节点 | 表层存在 | AddNodePanel / Workflow | `useWorkflowRunner.ts`, workflow defaults | 25% | 是 | 真实视频 API、轮询、结果文件、错误处理不完整 | TapNow 若支持视频，必须是高成本可执行任务 |
| 版本历史 | Node run history | 部分存在 | HistoryPanel | `NodeHistoryPanel.tsx`, run history store | 45% | 部分 | 节点级历史有，画布版本 / 项目快照缺 | TapNow 更可能有完整历史 / 回滚 / fork |

---

## 3. TapNow 对标差距分析

| TapNow 能力 | TapNow 中的体验 | Startrail 当前状态 | 差距类型 | 用户影响 | 是否适合 Startrail | 建议优先级 | 实现复杂度 | 推荐处理方式 |
|---|---|---|---|---|---:|---:|---:|---|
| AI Canvas 操作 | 用户说目标，AI 读画布、规划、改节点、连接、运行 | 有 Chat + actions 雏形 | Agent 深度不足 | 用户会觉得“能聊但不够会干活” | 是 | P1 | 中 | 建立 action plan → preview → apply → report 的闭环 |
| Slash Command | `/生成分镜`、`/扩写`、`/合并节点` 等直接触发动作 | 有菜单和类型，执行层不完整 | Command Bus 缺失 | 命令看起来多，但部分不真正执行 | 是 | P1 | 中 | 建立统一 command registry，隐藏未接线命令 |
| 批量生成 | 选多个对象后一次批量处理或合成 | Shot composite 部分完成 | 批量语义仍需测试固化 | 容易浪费算力、产物混乱 | 是 | P0 | 低-中 | 先完成 P3-Fix，明确本地合成 / 单次模型生成规则 |
| 成本确认 | 高成本任务前提示点数 / token | usage store 有，UI 弱 | 产品化不足 | 用户不确定一次点击会花多少 | 是 | P1 | 中 | 高成本 command 增加预算提示与确认 |
| 工作流模板 | 用户从模板创建完整创作流 | 只有硬编码前期工作流 | 模板系统缺失 | 难复用成功链路 | 是 | P2 | 中 | 先做本地模板 JSON，再考虑云模板 |
| Asset Library | 素材可归档、复用、拖回画布 | 有本地素材库 | 资产系统不足 | 素材不能稳定跨项目复用 | 是 | P1 | 中 | 加 assetId/source/version/usedBy/referencedBy 元数据 |
| 视频生成 | 输入图 / 文本，排队生成视频结果 | 节点存在，真实链路未完成 | 伪完成 | 用户以为能生成视频但得不到结果 | 是，但不要现在做深 | P2/P3 | 高 | 先降级标注为“前期预演意图”，不要强展示为已接线能力 |
| 运行历史 | 每次生成有输入、输出、模型、耗时、成本 | 节点 run history 部分有 | 不完整 | 难以追溯为什么生成这个结果 | 是 | P1 | 中 | 统一 generation snapshot + run history + output asset |
| 自动布局 | 一键整理画布 | 有 quickLayout / 自动布局命令 | 接入不完整 | 大画布会乱 | 是 | P1 | 低 | 明确入口，支持 selected-only / all-canvas |
| 结果网格 | 多图结果可一屏比较 / 选中 / 保存 | GridNode 有状态，Composite ImageNode 有结果 | 结果选择能力弱 | 用户难以做多版本比较 | 是 | P2 | 中 | Composite/ImageResult 增加 compare / save / regenerate |
| 项目导入导出 | 完整项目包、可恢复资产 | 只有 JSON 导出 | 完整性不足 | 换设备或重开项目会丢资产上下文 | 是 | P2 | 中-高 | 先做导入校验，再做 asset bundle |
| 权限与安全 | AI 改画布前可确认，危险动作保护 | run_node 有 allowAIAutoRun，delete 较直接 | 安全层不足 | AI action 可能误删或误改 | 是 | P1 | 中 | 所有破坏性 action 进入 pending confirmation |

---

## 4. 伪完成问题表

| 伪完成点 | 文件 / 组件 | 当前表现 | 为什么是假完成 | 用户看到什么 | 应该是什么 | 优先级 | 修复建议 |
|---|---|---|---|---|---|---:|---|
| 视频生成入口 | `AddNodePanel.tsx`, `useWorkflowRunner.ts` | 有“动效预演 / Video Generation”入口 | 真实视频 API、轮询、视频结果持久化未完整生产化 | 用户以为能生成视频 | 明确标注“前期预演意图 / 暂未生成成片”，或隐藏 | P0/P1 | 短期降级文案；中期接真实 video job 系统 |
| Slash 命令列表 | `SlashCommandMenu.tsx`, `slash-commands.ts` | 命令很多：生成视频、合并节点、自动布局等 | 命令定义不等于命令执行；缺统一 registry | 用户选命令后预期强动作 | 只展示已接线命令；未接线标 beta / disabled | P1 | 建 command registry：command → handler → validation → result |
| 前期工作流模板 | `handleCreateVideoWorkflow` | 一键生成完整工作流节点 | 模板是硬编码节点串，不是模板系统 | 用户以为有模板库 | 本地模板系统 + 可保存自定义模板 | P2 | 抽出 workflow template JSON schema |
| 素材库 | `AssetLibraryPanel.tsx`, `canvasStore.ts` | 有分类、搜索、收藏、拖拽 | 本地轻量元数据，缺资产血缘 / 跨项目 / 版本 | 用户以为素材安全归档 | 明确本地项目素材库，增加 asset source/version | P1 | 强化 AssetItem schema，接入 IndexedDB asset metadata |
| Chat 历史 | `ChatPanel.tsx` | 有“Greeting / 角色设计讨论 / 分镜规划”会话 | 初始 conversations 是模拟数据 | 用户以为历史真实存在 | 真持久会话，或移除 mock 历史 | P1 | localStorage / IndexedDB 保存 conversations；移除假数据 |
| AI Agent | `ChatPanel.tsx`, `chatActions.ts`, `applyChatActions` | AI 可返回 actions 并应用 | 只是轻量 action 执行器，不是 Agent planning | 用户以为 AI 能全面操控项目 | 计划预览、确认、执行报告、失败回滚 | P1 | 引入 action plan 生命周期 |
| 视频分析 | `useWorkflowRunner.ts` | 有 `video-analyze` 节点 | 存在 `runMockVideoAnalyze` | 用户以为真实分析视频 | 明确 mock / demo，或接真实抽帧与视觉模型 | P2 | UI 标注 beta；禁止在正式链路中伪装为完成 |
| AI 用量 | `useAIUsageStore.ts`, `estimateCost.ts` | 有用量记录和估算 | 仅记录，不扣费、不预算、不确认 | 用户无法预判成本 | 高成本动作前显示预计消耗 | P1 | 在 image/video/batch command 前加 cost preview |
| 导出项目包 | `handleExportProjectPackage` | 导出 JSON | 图片 asset 不一定可跨设备恢复，导入缺失 | 用户以为完整备份 | 导出 manifest + assets bundle + import verifier | P2 | 先做导入校验和缺失 asset 报告 |
| 多选合成混合情况 | `handleComposeSelectedShots` | 有图时本地合成，否则模型生成 | 当前 `some(url)` 会导致部分有图就半本地合成 | 混合结果出现空格 / 风格断裂 | 只有全部有单图才本地合成，否则单次模型生成完整多格图 | P0 | 改为 `imageUrls.every(Boolean)` 并补测试 |

---

## 5. 主链路审计

目标链路：

```text
剧本 Source → ShotNode → ImageNode → VideoNode → Asset Library / Export
```

### 5.1 剧本 Source → ShotNode

当前状态：较成熟。

已具备：

- 文本 / Prompt / Storyboard 节点可作为源。
- `parseStoryboardTextToShots` 可以把剧本文本拆成 shot 数据。
- `layoutStoryboardShots.ts` 已处理标题、顺序、位置。
- ShotNode UI 能区分剧本文本、Prompt、生成状态。

主要问题：

- 解析仍依赖文本结构，缺少“拆分后可编辑的 Shot List 表格”。
- Source 和 Shot 的 relation 需要进一步规范化，方便后续 Agent 追踪。
- 长剧本拆分后的布局、折叠、分组仍需产品化。

建议：

- P1 增加 Shot List 编辑面板，而不是继续堆更多节点入口。
- 每个 Shot 保留稳定 `sourceNodeId`、`order`、`sceneId`、`shotId`。

### 5.2 ShotNode → ImageNode

当前状态：较成熟，值得继续打磨成标杆链路。

已具备：

- Shot 单独生图。
- 生成后在画布右侧创建 ImageNode。
- 通过 `generated-image` relation 建立 Shot → Image 血缘。
- ImageNode 持有 `generation` snapshot、`assetId`、`sourcePrompt`。

主要问题：

- 失败后的 retry / fallback 还不够显性。
- 生成成本、模型、尺寸在 UI 中可见性不够。
- 批量 Shot 生成与 composite 生成必须严格区分。

建议：

- P0/P1 继续补测试：单图生成、重复生成更新、edge 去重、prompt 保留。
- UI 明确：单个 Shot 的按钮是“生成单图”，多选主按钮是“生成一张分镜图”。

### 5.3 多个 ShotNode → Composite ImageNode

当前状态：产品语义已对，但实现仍需 P3-Fix 稳定。

正确产品语义：

```text
选中 4 个 ShotNode → 点击“生成一张分镜图” → 只产出 1 个 2×2 Composite ImageNode
```

不是：

```text
先生成 4 张单图 → 再合成 1 张图 → 总共 5 张图
```

当前发现的关键风险：

```ts
const result = imageUrls.some((url) => url)
  ? await composeStoryboardGrid(...)
  : await generateImageFromPrompt(...)
```

这会造成“只要有任意一张单图，就走本地合成”。混合情况下会出现空格、风格断裂，也违背用户希望的方案 A。

应改为：

```ts
const allShotsHaveImages = imageUrls.every(Boolean)

const result = allShotsHaveImages
  ? await composeStoryboardGrid(...)
  : await generateImageFromPrompt(...)
```

推荐规则：

| 情况 | 应走路径 | 原因 |
|---|---|---|
| 所有 Shot 都已有单图 | 本地 canvas 合成 | 不额外消耗模型，速度快 |
| 没有任何单图 | 单次模型生成完整多格图 | 只调用一次模型，不生成多张单图 |
| 部分有单图、部分无单图 | 单次模型生成完整多格图 | 避免空格 / 风格断裂 / 半成品 |

P3-Fix 必须补测试。

### 5.4 ImageNode → VideoNode

当前状态：不建议现在作为主链路推进。

已具备：

- `video-generation` workflow 节点。
- 默认模型文案如 Seedance 2.0。
- Workflow order 中有 video sample frames、video analyze、video generation、video result。

问题：

- 没有完整真实 video job：提交任务、轮询、取消、失败、结果 URL、文件持久化。
- 视频分析中存在 mock 逻辑。
- 高成本视频任务缺少预算确认。

建议：

- 短期把 VideoNode 定义为“前期预演意图节点”，不要让用户误以为已能稳定出片。
- 等分镜图链路稳定后，再接入视频 API。
- 视频 API 接入前必须先设计 job schema：`jobId/status/progress/resultAssetId/error/cost/startedAt/completedAt`。

### 5.5 Asset Library / Export

当前状态：有产品雏形，但还不是生产资产系统。

已具备：

- 素材库面板。
- 分类、搜索、收藏、删除。
- 拖拽素材回画布。
- JSON 项目包导出。

主要问题：

- 素材库元数据和图片资产存储之间需要更强关联。
- localStorage metadata + IndexedDB blob 的完整性校验不足。
- 导出 JSON 不等于完整可恢复项目包。
- 缺少导入能力、缺失 asset 检测、跨设备恢复策略。

建议：

- P1：强化 AssetItem schema，至少包含 `assetId/sourceNodeId/sourcePrompt/generationId/createdFrom/usedBy`。
- P2：导出 manifest + assets bundle。
- P2：导入时做 asset 缺失报告。

---

## 6. P0 / P1 / P2 排期建议

### P0：立即做，先稳住当前主链路

| 任务 | 目标 | 涉及文件 | 验收标准 |
|---|---|---|---|
| P3-Fix 多选 composite 逻辑 | 主按钮只产出一张图，不浪费算力 | `StarCanvas.tsx` | 多选 4 Shot 后只有 1 个 Composite ImageNode |
| 混合情况改方案 A | 不全有单图时只调用一次模型生成完整多格图 | `handleComposeSelectedShots` | `some(url)` 改为 `every(Boolean)`，补测试 |
| Composite localStorage 安全测试 | 确认 `data:image` 不进入 localStorage | `sanitizePersistedCanvas.test.ts`, composite helper test | sanitize 后无 `blob:` / `data:image` / base64 |
| Edge 去重策略测试 | 每个 Shot 到同一 composite 只一条边 | `handleComposeSelectedShots` 可抽纯函数 | 重复合成不出现重复边 |
| UI 文案锁定 | 主按钮 / 次按钮语义清楚 | 浮动操作条、右键菜单 | 主：生成一张分镜图；次：分别生成单图 |

P0 验证命令：

```bash
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
```

### P1：下一阶段，补产品闭环

| 任务 | 目标 | 推荐方式 |
|---|---|---|
| Command Bus | Slash command 真正可执行 | `commandRegistry`：validate → estimateCost → confirm → execute → report |
| Agent Plan Preview | AI 操作画布前可审计 | actions 先生成计划卡片，用户确认后应用 |
| 高成本确认 | 防止误点图片 / 视频 / 批量生成 | image/video/batch 操作前显示预计成本 |
| 素材库血缘 | 让素材可追踪、可复用 | AssetItem 增加 source / generation / usedBy |
| Chat 历史真实化 | 移除 mock 历史 | localStorage/IndexedDB 保存 conversations |
| Auto Layout 接线 | 一键整理画布稳定可用 | selected-only / full-canvas 两种模式 |

### P2：产品扩展，不要抢在 P0/P1 前面

| 任务 | 目标 | 注意事项 |
|---|---|---|
| 多格分镜设置面板 MVP | 2×2 / 1×4 / 4×1 / Auto、显示编号、统一风格 Prompt | 只做 MVP，不做角色参考图高级链路 |
| 模板系统 | 工作流可保存 / 复用 | 从本地 JSON 模板开始 |
| 导入 / 导出完整项目包 | 支持资产恢复校验 | 先做 manifest，再做 assets bundle |
| 视频 API 接入 | 真实视频生成 | 必须先做 job schema、成本确认、轮询、失败恢复 |
| 版本 / 回滚 | 画布级版本历史 | 不要和 run history 混为一谈 |

---

## 7. 明确不建议现在做的事

### 7.1 不建议马上接视频 API

原因：

- 分镜主链路还没完全稳定。
- 视频是高成本、长耗时、失败率高任务。
- 没有 job schema、轮询、取消、重试、结果持久化前，接 API 会制造更多伪完成。

正确顺序：

```text
分镜图链路稳定 → Asset / Cost / Run History 稳定 → 再接视频 job
```

### 7.2 不建议马上做复杂角色参考图系统

原因：

- 角色一致性是大坑，需要 reference image、LoRA/Face ID、multi-image prompt、风格锚定等能力支撑。
- 当前更急的是“多 Shot 到一张分镜图”的可靠语义。

可以先做轻量版本：

- P3B 面板里只加“统一风格 Prompt”。
- 暂不做高级角色库 / 多参考图权重 / 风格锁定。

### 7.3 不建议大重构 StarCanvas.tsx

原因：

- 当前功能仍在密集试错，过早重构容易打断产品验证。
- 但可以逐步抽纯函数：composite planning、edge merge、node creation、command registry。

推荐策略：

```text
先抽可测试纯函数，不做大拆组件。
```

---

## 8. P3-Fix 详细验收清单

| 验收项 | 期望 | 当前风险 | 建议测试 |
|---|---|---|---|
| 主按钮不批量生成单图 | 不调用 `handleGenerateShotImage` 多次 | 已修正方向，但需测试锁定 | mock `handleGenerateShotImage` 不应被调用 |
| 只生成一个 ImageNode | 多选 4 Shot → 1 个 Composite ImageNode | 需验证重复点击 / 失败场景 | 节点数量断言 |
| 全部已有单图时本地合成 | 调用 `composeStoryboardGrid` | 当前可实现 | mock compose 被调用一次 |
| 没有单图时一次模型生成 | 调用 `generateImageFromPrompt` 一次 | 当前可实现 | mock generate 被调用一次 |
| 混合情况方案 A | 不全有图 → 一次模型生成完整图 | 当前 `some(url)` 不符合 | 改 `every(Boolean)` 并测试 |
| 4 Shot 默认 2×2 | columns=2 rows=2 | 当前已按 4 特判 | layout 断言 |
| Edge 去重 | 不产生重复 relation edge | 当前会移除旧 source 的 composite edge，策略需确认 | 同一 composite 不重复 edge |
| localStorage 安全 | 无 `blob:` / `data:image` / base64 | `composeStoryboardGrid` 返回 dataURL，必须转存 IDB | sanitize test |
| UI 文案 | 主：生成一张分镜图；次：分别生成单图 | 已改文案，需锁定 | 组件文本测试或人工验收 |

---

## 9. 最小补丁建议

本轮不直接大改代码，但建议后续 P3-Fix 最小补丁包含以下内容：

### 9.1 修正混合情况判断

位置：`StarCanvas.tsx` → `handleComposeSelectedShots`

当前：

```ts
const result = imageUrls.some((url) => url)
  ? await composeStoryboardGrid(...)
  : await generateImageFromPrompt(...)
```

建议：

```ts
const allShotsHaveImages = imageUrls.every((url): url is string => Boolean(url))

const result = allShotsHaveImages
  ? await composeStoryboardGrid({ images: imageUrls, columns: cols }).then(...)
  : await generateImageFromPrompt({ prompt: compositePrompt, model, size })
```

### 9.2 抽出 composite planning 纯函数

建议新建或放入现有 storyboard util：

```ts
type CompositeMode = "local-compose" | "model-generate"

function planStoryboardComposite(input: {
  shotCount: number
  imageUrls: Array<string | null>
}): {
  columns: number
  rows: number
  mode: CompositeMode
}
```

这样测试不必挂 React Flow。

### 9.3 明确 edge 策略

当前策略会移除所有从选中 Shot 指向旧 composite 的 `storyboard-composite` edge。MVP 可接受，但报告里要写清楚：

- 优点：画布不乱，每个 Shot 当前只指向最新 composite。
- 缺点：旧 composite ImageNode 还在，但血缘边可能被移除。

如果要保留版本历史，后续应改成：

```text
每个 Composite ImageNode 内部不重复 edge；但不同版本 composite 可以保留各自 edge。
```

### 9.4 视频入口降级文案

位置：`AddNodePanel.tsx` / workflow defaults

建议短期把“动效预演”描述改得更诚实：

```text
记录动效预演意图，后续接入视频生成后可运行。
```

而不是让用户以为现在能稳定生成视频。

---

## 10. 最终建议

Startrail Canvas 当前最应该打造的不是“大而全的 AI 视频平台”，而是一个很锋利的前期创作画布：

```text
写剧本 → 拆镜头 → 生成关键画面 → 合成分镜图 → 归档素材 → 导出前期包
```

这条链路已经接近成立。下一步不要分散精力。

推荐顺序：

1. **立刻做 P3-Fix**：把多选 Shot → 一张分镜图的逻辑、测试、验证、报告补齐。
2. **再做 P3B 设置面板 MVP**：只做布局、编号、统一风格 Prompt、是否优先用已有单图。
3. **再补 Command Bus / Agent Plan Preview**：让 Chat 和 Slash 不只是“会说”，而是“可审计地做”。
4. **再强化素材库血缘和导入导出**。
5. **最后再接视频 API**。

一句话判断：

> Startrail Canvas 已经有一个值得继续打磨的核心产品骨架，但现在最大的风险是“入口和节点看起来比实际能力更成熟”。下一阶段应该先减少伪完成、固化分镜主链路、让每一次生成都可预期、可追踪、可恢复。