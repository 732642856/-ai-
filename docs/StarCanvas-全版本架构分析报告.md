# StarCanvas 全版本架构分析报告

> **产品架构整理顾问 + 技术负责人视角**
> 分析日期：2026-05-22
> 定位：仅分析和规划，不修改代码

---

## 零、前置发现：四个"版本"中有一个不是 StarCanvas

经过地毯式代码审查，四个目录的实际情况如下：

| 目录 | 实际身份 | 与 StarCanvas 关系 |
|------|---------|-------------------|
| `creative-canvas`（WorkBuddy） | **StarCanvas V-远古版** | 同一项目的始祖 |
| `星轨项目交接包-2026-05-18` | **StarCanvas V1-当前主干** | 当前主力开发版本 |
| `star-canvas`（WorkBuddy 2026-05-21） | **StarCanvas V1-过渡版** | 过渡版本，有独特功能 |
| `star-canvas-files` | ❌ **Infinite Canvas Studio** | **完全无关的另一个项目** |

**重要判断**：`star-canvas-files` 是一个由不同作者（wuli大雄/hero8152）开发的 **Python 后端 + Vanilla JS iframe 微前端** AI 创作工作室，名为 "Infinite Canvas Studio"。它的技术栈（Python、无构建系统、iframe 架构）与 StarCanvas（Next.js monorepo、React Flow 画布）完全不同。该目录中夹杂的 TypeScript 文件（types.ts、useWorkflowRunner.ts 等）是从 StarCanvas 复制过去的片段，不构成完整可运行应用。

**结论**：`star-canvas-files` 不参与后续版本对比分析。本次分析聚焦 3 个真正的 StarCanvas 版本。

---

## 一、版本识别

### V-远古版：creative-canvas

| 维度 | 详情 |
|------|------|
| **代号** | V-远古版 / creative-canvas |
| **路径** | `/WorkBuddy/2026-05-16-task-32/creative-canvas/` |
| **定位** | 第一个可运行的 StarCanvas 原型，全栈实验 |
| **技术栈** | Next.js (web, 端口3000) + NestJS 11 (api, 端口4000) + Prisma + PostgreSQL + Redis (Docker) |
| **包管理** | pnpm workspace + Turborepo |
| **核心依赖** | @xyflow/react, zustand, @react-three/fiber, dagger |
| **源码规模** | 38 个 TS/TSX 文件 |
| **Web 架构** | **单文件巨石架构** — `canvas/page.tsx` 长达 6,382 行 / 318KB |
| **API 架构** | 9 个模块：auth, organizations, projects, canvas, providers, generation, assets, usage, health |
| **数据库** | 12 个 Prisma 模型（User, Organization, Project, CanvasDocument, CanvasVersion, ProviderCredential, GenerationJob, UsageRecord, CreditLedgerEntry…）|
| **Packages** | 6 个共享包：billing, canvas, providers, shared, config, ui |
| **测试** | **0 个** |
| **文档** | 无 README，仅 `docs/MVP_IMPLEMENTATION_STATUS.md` |
| **运行状态** | ❌ 已停运，端口 3000 空闲 |
| **完成度** | 约 40% — 架构骨架完整，但大量 API 未接入前端 |
| **启动脚本** | `启动星轨.command`（桌面上的旧脚本） |

**核心特征**：后端设计雄心勃勃（组织、项目、积分账本、画布版本管理），但前端实现极少——所有 UI 逻辑塞在一个 6,382 行的 page.tsx 中，没有任何组件拆分。

---

### V1-过渡版：star-canvas（WorkBuddy 副本）

| 维度 | 详情 |
|------|------|
| **代号** | V1-过渡版 |
| **路径** | `/WorkBuddy/2026-05-21-01-00-38/star-canvas/` |
| **定位** | "星轨画布（前期）" — 视频创作前期工具 |
| **技术栈** | Next.js 16 + NestJS 11 + Prisma + PostgreSQL（与 V-远古版同根） |
| **核心依赖** | @xyflow/react v12, zustand v5, @react-three/fiber, dagger |
| **源码规模** | 68 个 TS/TSX 文件 |
| **Web 架构** | 组件化拆分：StarCanvas.tsx 1,850 行 + 独立 hooks/stores/utils |
| **API 架构** | 与 V-远古版相同 9 模块 |
| **Packages** | 5 个共享包（比 V-远古版少 config 和 ui，新增 billing 逻辑） |
| **测试** | **0 个** |
| **文档** | 无（README 在 git 历史中被删除） |
| **Git** | main 分支，2 个提交，有未提交修改 |
| **可运行性** | ⚠️ 理论可运行，但 .env.local 中 API key 是占位符 |

**核心特征**：引入了明确的"前期画布"产品定位，新增了 Cinematic Prompt Pipeline（电影级三层分析管道）、项目包导出（`startrails-project.json`）、视频工作流一键模板等差异化功能。

---

### V1-当前主干：星轨项目交接包-2026-05-18

| 维度 | 详情 |
|------|------|
| **代号** | V1-当前主干 |
| **路径** | `/Desktop/星轨项目交接包-2026-05-18/` |
| **定位** | AI 驱动的节点工作流画布，当前主力开发版本 |
| **技术栈** | Next.js 15 + @xyflow/react v12 + Zustand + TailwindCSS v3 + SSE |
| **包管理** | pnpm workspace + Turborepo |
| **源码规模** | **71 个** web 源文件 + 完整 lib 层 |
| **Web 架构** | 深度组件化：8 个组件目录（canvas/chat/history/menus/nodes/panels/toolbar/workflow） |
| **Hooks** | 7 个专用 hooks（useCanvasDropUpload, useChatSSE, useWorkflowRunner, useHistoryDrop…）|
| **Stores** | 2 个 Zustand stores |
| **Features** | 4 个 feature 模块（actions/runtime/persistence/usage） |
| **Types** | 6 个独立类型文件 |
| **测试** | **160 个**，全部通过 ✅ |
| **TypeScript** | 0 个编译错误 ✅ |
| **构建** | `next build` 成功 ✅ |
| **AI 接入** | copse.top 代理，4 个模型，真实 API 已验证 ✅ |
| **可运行性** | ✅ 正在 3001 端口运行 |
| **Git** | GitHub 仓库 `732642856/-ai-`，提交 `078bcfe` |
| **启动脚本** | `启动星轨画布（前期）.command` |

**核心特征**：工程化程度最高的版本。功能闭环完整（节点→工作流→执行→历史→拖回），有完善的类型系统和测试覆盖，是目前最能稳定运行和继续发展的版本。

---

## 二、能力盘点

按 7 大分类，将三个真实 StarCanvas 版本的能力全部拆解：

### 2.1 基础能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| 项目启动/构建 (pnpm+turbo) | ✅ | ✅ | ✅ |
| Next.js App Router | ✅ 旧版 | ✅ 新版 | ✅ |
| 本地持久化 (localStorage) | ✅ | ✅ 4级降级 | ✅ |
| 路由 (/canvas) | ✅ | ✅ | ✅ |
| 组件化拆分 | ❌ 单文件 | ✅ 初步拆分 | ✅ 深度拆分 |
| 类型系统 | 基础 | 完善 | ✅ 最完善（泛型/discriminated union） |
| 配置管理 (.env) | ✅ | ✅ | ✅ 双模式 |
| 设计 Token (designSystem.ts) | ❌ | ✅ | ✅ |
| NestJS 后端 | ✅ | ✅ | ✅（已有但前端未依赖） |
| Prisma 数据库 | ✅ 12模型 | ✅ 12模型 | ✅ 相同 |

### 2.2 AI 能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| AI 模型接入 | 基础 | ✅ | ✅ 完善 |
| Provider 抽象层 | ✅ | ✅ | ✅ |
| BYOK (Bring Your Own Key) | ❌ | ✅ | ✅ |
| 双模式 Provider (Server/Local) | ❌ | ❌ | ✅ **独有** |
| copse.top 中转站代理 | ❌ | 占位 | ✅ 已验证 |
| SSE 流式输出 | ❌ | ✅ | ✅ |
| Chat → Canvas Actions 解析 | ❌ | ✅ | ✅ 完善 |
| 多模态 Chat (vision) | ❌ | ✅ 后端路由 | ✅ 前端接入 |
| Prompt 自动增强 (中→英) | ❌ | ✅ | ✅ |
| AI 图片生成 | ❌ | ✅ | ✅ (gpt-image-2) |
| AI 视频分析 | ❌ | ❌ | ✅ **独有** |
| AI 视频元数据提取 | ❌ | ❌ | ✅ |
| AI 变体生成 | ❌ | ✅ | ✅ |
| 用量记账 (Usage Metering) | ❌ | ❌ | ✅ **独有** |
| 用量统计面板 | ❌ | ❌ | ✅ |
| AI 安全策略 (autoRun 默认关) | ❌ | ❌ | ✅ |
| API Health Check | ✅ 基础 | ✅ | ✅ 增强 (POST+Override) |

### 2.3 工作流能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| 节点创建/编辑/删除 | ✅ | ✅ | ✅ |
| 多种节点类型 | 3种 | 3种 (含ContentNode合并) | 3种 |
| Edge 连线 | ✅ | ✅ | ✅ |
| Edge handle → mediaRole 语义映射 | ❌ | ❌ | ✅ **独有** |
| 工作流执行引擎 | ❌ | ✅ 4步 | ✅ 完整 |
| 工作流运行器 (useWorkflowRunner) | ❌ | ✅ 基础 | ✅ 完善 |
| ExecutionPlan 五模式 | ❌ | ❌ | ✅ **独有** |
| 级联执行 | ❌ | ❌ | ✅ |
| DAG 拓扑排序 | ❌ | ✅ | ✅ |
| Node Run History | ❌ | ❌ | ✅ |
| WorkflowRunPanel (时间线) | ❌ | ❌ | ✅ **独有** |
| 视频工作流一键模板 (10节点) | ❌ | ✅ **独有** | ❌ |
| 6态 runMeta | ❌ | ❌ | ✅ **独有** |
| run_node 自动/手动模式 | ❌ | ❌ | ✅ |
| 并行执行组检测 | ❌ | ✅ | ✅ |

### 2.4 画布能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| React Flow 画布 | ✅ | ✅ | ✅ |
| 拖拽节点 | ✅ | ✅ | ✅ |
| 视口缩放/平移 | ✅ | ✅ | ✅ |
| 右键菜单 (CanvasContextMenu) | ❌ | ✅ | ✅ |
| 节点右键菜单 (NodeContextMenu) | ❌ | ✅ | ✅ |
| 键盘快捷键 | ❌ | ✅ | ✅ |
| dagre 自动布局 | ✅ | ✅ | ✅ |
| 框选/多选 | ❌ | ✅ | ✅ |
| 拖放上传 (本地文件) | ❌ | ✅ | ✅ |
| 剪贴板 (复制/粘贴/剪切) | ❌ | ✅ | ✅ |
| 自定义贝塞尔曲线 (动画光点) | ❌ | ✅ | ✅ |
| 空画布引导 (EmptyCanvasGuide) | ❌ | ✅ | ✅ |
| 网格/吸附 | ❌ | ✅ | ✅ |
| History → Canvas 拖回创建节点 | ❌ | ❌ | ✅ **独有** |
| 节点悬浮工具栏 (ImageHoverToolbar) | ❌ | ✅ | ✅ |
| 画布 Drop Overlay | ❌ | ❌ | ✅ |

### 2.5 素材能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| 图片节点 (ImageNode) | ✅ | ✅ | ✅ |
| 图片预览/裁剪 | ❌ | ✅ | ✅ |
| 素材库面板 (AssetLibrary) | ❌ | ✅ | ✅ |
| 素材分类/文件夹 | ❌ | ❌ 类型定义 | ✅ |
| 视频输入节点 | ❌ | ❌ | ✅ **独有** |
| 视频抽帧/预览 | ❌ | ❌ | ✅ |
| 视频分析结果嵌入 | ❌ | ❌ | ✅ |
| 分镜系统 (Storyboard) | ❌ | ✅ 类型定义 | ❌ |
| Previs3D 分析 | ❌ | ✅ 类型定义 | ❌ |

### 2.6 用户体验

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| ChatPanel (AI 对话) | ❌ | ✅ | ✅ |
| ChatInput (多行输入/附件) | ❌ | ✅ | ✅ |
| ChatAttachmentPreview | ❌ | ❌ | ✅ |
| SettingsPanel (Provider 配置) | ❌ | ✅ 基础 | ✅ 双模式 |
| 主题 (dark/light) | ❌ | ❌ | ❌ (未实现) |
| 国际化 (i18n) | ❌ | ❌ | ❌ |
| 加载状态/骨架屏 | ❌ | ✅ | ✅ |
| 错误提示 | ❌ | ✅ | ✅ |
| 帮助面板 (快捷键说明) | ❌ | ✅ 基础 | ❌ |
| 运行状态显示 (节点色标) | ❌ | ✅ | ✅ |
| WorkflowRun 时间线面板 | ❌ | ❌ | ✅ |
| HistoryPanel (历史记录) | ❌ | ❌ | ✅ |
| History 渲染器注册表 | ❌ | ❌ | ✅ |
| VideoAnalysisPreview Compact | ❌ | ❌ | ✅ |
| 待确认运行 (pending_confirmation) | ❌ | ❌ | ✅ |
| AI AutoRun 开关 | ❌ | ❌ | ✅ |

### 2.7 工程能力

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 |
|------|:---:|:---:|:---:|
| TypeScript 严格模式 | ❌ | ❌ | ✅ |
| tsc --noEmit 0 错误 | ❌ | ❌ | ✅ |
| 单元测试 | 0 | 0 | **160** ✅ |
| 测试框架 | 无 | 无 | Node --experimental-strip-types |
| 类型文件独立 | ❌ 1个 | ✅ 4个 | ✅ 6个 |
| Discriminated Union 类型 | ❌ | ❌ | ✅ |
| 构建成功 (next build) | ⚠️ 未知 | ⚠️ 未知 | ✅ 验证通过 |
| .gitignore 安全配置 | ✅ | ❌ .env.local 已跟踪 | ✅ |
| 无 API Key 泄露 | ✅ | ⚠️ 占位符未清理 | ✅ 已验证 |
| CI/CD | ❌ | ❌ | ❌ |
| README/文档 | 仅 MVP 状态 | ❌ | ❌ |
| Design Token 常量 | ❌ | ✅ | ✅ |

---

## 三、相似能力合并分析

### 重复能力矩阵

| 能力 | V-远古版 | V1-过渡版 | V1-当前主干 | 最佳实现 | 是否合并 | 合并建议 | 废弃原因 |
|------|:---:|:---:|:---:|------|:---:|------|------|
| 画布节点渲染 | ✅ 巨石 | ✅ 初步拆分 | ✅ 深度拆分 | **V1-当前** | 废弃前两个 | 直接使用 V1-当前架构 | 代码质量差距巨大 |
| 工作流执行引擎 | ❌ | ✅ 基础 | ✅ 完善 | **V1-当前** | 废弃过渡版 | 吸收过渡版工作流模板 | V1-当前功能更完整 |
| AI Chat SSE | ❌ | ✅ | ✅ 增强 | **V1-当前** | 合并 | V1-当前有 usage 追踪 | - |
| AI Provider 配置 | ✅ 基础 | ✅ BYOK | ✅ 双模式 | **V1-当前** | 废弃前两个 | 双模式是超集 | 包含所有前代能力 |
| 素材库 | ❌ | ✅ 基础 | ✅ 完善 | **V1-当前** | 废弃过渡版 | 类型系统更完善 | - |
| localStorage 持久化 | ✅ | ✅ 4级降级 | ✅ | **V1-过渡版** | 吸收到 V1-当前 | V1-过渡版的4级降级策略更好 | - |
| dagre 自动布局 | ✅ | ✅ | ✅ | 相同 | 保留一个 | 代码基本一致 | - |
| 视频生成 API 路由 | ✅ | ✅ | ❌ 纯前端 | **V1-过渡版** | 暂不合并 | V1-过渡版有完整后端路由 | V1-当前用前端 SSE |
| Canvas Actions 解析 | ❌ | ✅ 基础 | ✅ 完善 | **V1-当前** | 废弃过渡版 | V1-当前有 discriminated union 类型 | - |
| 节点 Context 构建 | ❌ | ✅ | ✅ 增强 | **V1-当前** | 废弃过渡版 | V1-当前有 handle→mediaRole 映射 | - |
| 分镜/Previs3D 类型 | ❌ | ✅ | ❌ | **V1-过渡版** | 保留为类型库 | 这些类型定义有价值 | 当前版本不需要 |

### 合并策略总结

```
V-远古版 ──→ 完全废弃（架构设计保留为参考）
V1-过渡版 ──→ 提取3个独特能力 → V1-当前主干
                1. 4级 localStorage 降级策略
                2. 视频工作流一键模板
                3. Cinematic Prompt Pipeline (packages/canvas/prompt-analyzer.ts)
V1-当前主干 ──→ 保留为唯一主线
```

---

## 四、独特能力识别

### V-远古版 独有能力

| 独特能力 | 用户价值 | 技术价值 | 完成度 | 纳入 V2 | 优先级 |
|------|------|------|:---:|:---:|:---:|
| 完整的 NestJS 后端（9模块12表） | 多人协作/云端同步的理论基础 | 架构设计参考 | 40% | ❌ 不纳入 | — |
| packages/config + packages/ui | 统一配置和UI组件库 | 设计模式参考 | 30% | ❌ 不纳入 | — |
| Credit Ledger 积分账本 | 商业化计费基础 | 计费系统设计 | 20% | ❌ 不纳入 | — |

> **判断**：V-远古版的架构野心过大（云端多租户、积分计费），不适合单人本地开发产品。保留其设计文档作为参考即可。

### V1-过渡版 独有能力

| 独特能力 | 用户价值 | 技术价值 | 完成度 | 纳入 V2 | 优先级 |
|------|------|------|:---:|:---:|:---:|
| **Cinematic Prompt Pipeline** | 🔥 电影级 AI 生图质量 | 三层分析管道（分镜+火柴人+3D预览→合成 Prompt） | 70% | ✅ 纳入 | **P0** |
| **视频工作流一键模板** | 新用户10秒创建完整工作流 | 预设节点+连线模板 | 90% | ✅ 纳入 | **P0** |
| **startrails-project.json 导出** | 前期→后期交接的数据桥梁 | 结构化项目包格式 | 80% | ✅ 纳入 | P1 |
| **4级 localStorage 降级策略** | 大画布不会丢数据 | 完整→去base64→跳图片→放弃 | 100% | ✅ 纳入 | **P0** |
| ContentNode（合并 Prompt+Text） | 减少节点类型，降低认知负担 | 多模式节点设计 | 100% | ⚠️ 评估 | P2 |
| 帮助面板 (快捷键+鼠标操作) | 新用户上手引导 | 静态帮助 UI | 80% | ✅ 纳入 | P2 |
| 分镜/3D预览类型定义 | 视频创作的专业知识编码 | 完整的 Storyboard/Previs3D 类型 | 85% | ✅ 纳入为类型库 | P2 |

### V1-当前主干 独有能力

| 独特能力 | 用户价值 | 技术价值 | 完成度 | 纳入 V2 | 优先级 |
|------|------|------|:---:|:---:|:---:|
| **双模式 Provider (Server/Local)** | 团队共用+个人自用的灵活切换 | 运行时 merge + localStorage override | 100% | ✅ 核心保留 | P0 |
| **AI Usage Metering 用量记账** | 清楚知道花了多少钱 | 全链路 token 追踪+定价表 | 95% | ✅ 核心保留 | P0 |
| **Video Analysis Pipeline** | 视频→分镜→分析→画布的全闭环 | 抽帧+分析+预览+拖回 | 90% | ✅ 核心保留 | P0 |
| **WorkflowRunPanel 执行时间线** | 看到每一步执行的实时状态 | reducer + 事件流 + 时间线 UI | 100% | ✅ 核心保留 | P0 |
| **History Panel + 拖回画布** | 执行结果可复用 | MIME 拖拽协议 + historyOutputRenderers 注册表 | 100% | ✅ 核心保留 | P0 |
| **ExecutionPlan 五模式** | 灵活的执行策略（线性/级联/分组/跳过/并行） | 多执行模式引擎 | 95% | ✅ 核心保留 | P0 |
| **Edge handle → mediaRole 语义映射** | 连线自动赋予语义 | handle-resolver.ts | 100% | ✅ 核心保留 | P1 |
| **160 个测试** | 重构安全网 | Node --experimental-strip-types | 100% | ✅ 核心保留 | P0 |
| **TypedRawOutput 数据管道** | 节点输出可被通用渲染 | sanitizeHistoryRawOutput + isTypedRawOutput | 100% | ✅ 核心保留 | P1 |
| History 渲染器注册表 | 新节点类型零侵入扩展 | 注册表模式 | 100% | ✅ 核心保留 | P1 |

---

## 五、版本优劣对比（满分5分）

| 评分维度 | V-远古版 | V1-过渡版 | V1-当前主干 | 说明 |
|------|:---:|:---:|:---:|------|
| **功能完整度** | 2/5 | 3.5/5 | **4.5/5** | V1-当前：AI、工作流、视频分析、用量追踪均闭环 |
| **代码质量** | 1/5 | 2.5/5 | **5/5** | V1-当前：0 tsc 错误，160 测试，类型系统完善 |
| **可维护性** | 1/5 | 2/5 | **4.5/5** | V1-远古：单文件 6382 行不可维护 |
| **用户体验** | 1.5/5 | 3/5 | **4/5** | V1-当前：运行面板、历史拖回、待确认机制 |
| **AI 接入成熟度** | 1/5 | 3/5 | **5/5** | V1-当前：双模式 + copse.top 已验 + 用量追踪 |
| **工作流能力** | 1/5 | 3/5 | **5/5** | V1-当前：五模式执行、级联、时间线 |
| **扩展性** | 1.5/5 | 3/5 | **4.5/5** | V1-当前：渲染器注册表 + discriminated union |
| **上线风险** | 🔴 极高 | 🟡 中等 | 🟢 低 | V1-当前：构建成功、测试覆盖、API 已验 |

### 打分理由

**V-远古版**：唯一价值是证明了全栈架构的可行性。前端巨石不可维护，后端过度设计，无测试，不建议以任何形式继续使用。

**V1-过渡版**：定位清晰（前期画布），有 3 个高质量独特功能（Cinematic Pipeline、工作流模板、项目导出），但整体代码质量不如当前主干，且无测试。适合作为"功能库"被吸收。

**V1-当前主干**：工程化水平遥遥领先。唯一短板是缺少主题/I18N/帮助面板等用户辅助功能（这些在过渡版中有），以及 `useWorkflowRunner` 中有 2 处模型名硬编码（已知问题）。

---

## 六、确定主干版本

### 推荐主干版本：**V1-当前主干**（星轨项目交接包-2026-05-18）

### 推荐理由

| 判断标准 | V1-当前主干表现 |
|------|------|
| **能否稳定启动** | ✅ 已验证，`启动星轨画布（前期）.command` 一键启动 |
| **核心架构是否清晰** | ✅ 8 组件目录 + 7 hooks + 4 features + 6 types，职责分明 |
| **是否具备最重要业务闭环** | ✅ 节点→工作流→执行→历史→拖回，完整闭环 |
| **是否方便吸收其他版本功能** | ✅ 渲染器注册表模式天然支持扩展；类型系统 ready for 新类型 |
| **测试和构建是否可靠** | ✅ 160 测试全过 + tsc 0 错 + build 成功 |

### 不推荐其他版本的理由

| 版本 | 不推荐理由 |
|------|------|
| V-远古版 | 6,382 行巨石组件不可维护；无测试；后端过度设计不适合单人开发；已停止维护 |
| V1-过渡版 | 无测试；代码整体不如 V1-当前干净；有未提交的 git 修改；.env.local 有占位符未清理 |

### 主干版需要吸收的功能（来自过渡版）

| 优先级 | 功能 | 来源 | 操作 |
|:---:|------|------|------|
| **P0** | Cinematic Prompt Pipeline | V1-过渡版 `packages/canvas/prompt-analyzer.ts` | 迁移到当前主干 packages/canvas |
| **P0** | 视频工作流一键模板 | V1-过渡版 StarCanvas.tsx `handleCreateVideoWorkflow()` | 提取为独立 feature 模块 |
| **P0** | 4级 localStorage 降级 | V1-过渡版 `canvasPersistence.ts` | 增强当前主干的持久化策略 |
| P1 | startrails-project.json 导出 | V1-过渡版 `buildProjectPackage()` | 添加为导出功能 |
| P1 | 分镜/Previs3D 类型定义 | V1-过渡版 packages/canvas | 合并到 types 目录 |
| P2 | 帮助面板 | V1-过渡版 快捷键+操作说明 UI | 重新实现 |
| P2 | 分镜系统 UI（如需） | V1-过渡版 类型+组件 | 评估是否需要 |

---

## 七、V2 合并方案

### 7.1 V2 产品定位

> **StarCanvas V2 = 一个人从灵感到成品的 AI 创意工作站**
>
> 不是另一个 AI 聊天工具，不是另一个画板。是一个以「节点工作流画布」为核心的创作工具，让创作者用可视化方式编排 AI 能力链，从文字→图像→视频→分析，全程可追踪、可复用、可迭代。

### 7.2 V2 核心功能列表

```
P0 — 必须有（最小可用）
├── 1. 节点工作流画布 (React Flow)
├── 2. 多种节点类型 (Content/Image/Workflow/Video)
├── 3. AI Chat Panel (SSE 流式)
├── 4. Chat → Canvas Actions (create/update/connect/run/delete node)
├── 5. 双模式 AI Provider (Server .env / Local Override)
├── 6. 工作流执行引擎 (useWorkflowRunner)
├── 7. ExecutionPlan 多模式 (线性/级联/分组/跳过/并行)
├── 8. WorkflowRunPanel 执行时间线
├── 9. History Panel + 拖回画布
├── 10. AI Usage Metering 用量记账
├── 11. 视频分析全链路 (输入→抽帧→分析→预览)
├── 12. Cinema Prompt Pipeline (从过渡版吸收)
├── 13. 视频工作流模板 (从过渡版吸收)
├── 14. 4级持久化降级 (从过渡版吸收)
```

### 7.3 V2 不做什么

| 不做 | 理由 |
|------|------|
| ❌ NestJS 后端 (PostgreSQL/Redis) | 单人本地产品不需要多租户数据库。前端 localStorage + API Routes 足够。`apps/api` 整体删除。 |
| ❌ 积分/计费/组织/多用户 | 单人产品，即使未来需要也应该是独立服务，不混入画布核心 |
| ❌ 3D 预览 (@react-three/fiber/three) | 当前未实现 UI，只有类型定义。移除依赖，减包体积 |
| ❌ ComfyUI 集成 | 当前只有类型定义，无实现 |
| ❌ iframe 微前端架构 | 那是 Infinite Canvas Studio 的架构，不是 StarCanvas 的路线 |
| ❌ 主题/I18N（初期） | 单人使用产品，中英文混合可接受，后续按需添加 |
| ❌ S3/云存储 | 单人本地产品，本地文件系统即可 |

### 7.4 V2 信息架构

```
star-canvas/  (monorepo)
├── apps/
│   └── web/                    ← 唯一 App（删除 apps/api）
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx              # 登陆页
│       │   │   ├── layout.tsx            # 全局布局
│       │   │   ├── canvas/
│       │   │   │   ├── page.tsx          # /canvas 路由入口
│       │   │   │   ├── StarCanvas.tsx    # 画布主组件
│       │   │   │   ├── components/
│       │   │   │   │   ├── canvas/       # 画布核心组件
│       │   │   │   │   ├── chat/         # AI 聊天
│       │   │   │   │   ├── history/      # 历史面板
│       │   │   │   │   ├── menus/        # 右键菜单
│       │   │   │   │   ├── nodes/        # 节点类型
│       │   │   │   │   ├── panels/       # 设置/分析面板
│       │   │   │   │   ├── toolbar/      # 工具栏
│       │   │   │   │   └── workflow/     # 工作流运行面板
│       │   │   │   ├── hooks/            # 专用 hooks
│       │   │   │   ├── stores/           # Zustand stores
│       │   │   │   ├── features/         # 功能模块
│       │   │   │   ├── types/            # 类型定义
│       │   │   │   ├── utils/            # 工具函数
│       │   │   │   └── styles/           # 设计 Token
│       │   │   └── api/
│       │   │       └── ai/               # AI API Routes (前端代理)
│       │   └── lib/
│       │       └── ai/                   # AI Client 共享库
│       └── public/
├── packages/
│   ├── canvas/                 # 画布领域逻辑 (Cinema Pipeline 等)
│   └── shared/                 # 共享类型和工具
└── tests/                      # 保持测试在 utils/ 中（当前策略）
```

### 7.5 V2 技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Next.js)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 画布 UI   │  │ Chat UI  │  │ Settings/History │  │
│  │@xyflow   │  │  SSE     │  │    Panels        │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │                 │             │
│  ┌────┴─────────────┴─────────────────┴──────────┐  │
│  │              Zustand Store                     │  │
│  │   canvasStore  │  runHistoryStore             │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │           Features / Actions                   │  │
│  │  chatActions  │  executionPlan  │  usageMeter │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │            Hooks (业务编排)                     │  │
│  │  useWorkflowRunner  │  useChatSSE  │  useDrop  │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │           lib/ai/client.ts                     │  │
│  │      统一 AI Client + Provider Merge          │  │
│  └────────────────────┬──────────────────────────┘  │
└───────────────────────┼─────────────────────────────┘
                        │ HTTP/SSE
┌───────────────────────┼─────────────────────────────┐
│              Next.js API Routes                      │
│  /api/ai/chat/stream  │  /api/ai/health             │
│  /api/ai/generate-image                             │
└───────────────────────┬─────────────────────────────┘
                        │
                  ┌─────┴─────┐
                  │ copse.top │  (OpenAI 兼容代理)
                  └───────────┘
```

### 7.6 V2 数据流

```
用户输入 (Chat) → SSE Stream → AI 响应 → 解析 canvas-actions JSON
                                              ↓
                              ChatCanvasAction (discriminated union)
                                              ↓
                              applyChatActions() → ApplyActionsReport
                                              ↓
                              Zustand Store 更新 → React Flow 重渲染
                                              ↓
                              节点状态变更 → 触发 WorkflowRun
                                              ↓
                              useWorkflowRunner.runNode()
                                              ↓
                              发送到 AI → 流式更新节点内容
                                              ↓
                              sanitizeHistoryRawOutput() → TypedRawOutput
                                              ↓
                              HistoryPanel 渲染器注册表匹配 → UI 渲染
                                              ↓
                              用户拖回画布 → 创建新 Prompt 节点
```

### 7.7 V2 运行流程

```
1. 打开 /canvas → 加载 localStorage 中的画布数据
2. 看到空画布（或上次的节点图）
3. 左侧工具栏选择节点类型 → 拖到画布 → 双击编辑 Prompt
4. 打开 Chat 面板 → 发送消息给 AI
5. AI 返回 canvas-actions → 自动创建/更新节点、连线
6. 选中节点 → 右键 "运行" → 节点执行，实时看到流式输出
7. 执行结果出现在 History 面板 → 拖回画布继续编辑
8. 查看 WorkflowRunPanel → 看到完整执行时间线
9. 查看 Settings → 确认用量/切换 Provider
```

### 7.8 V2 风险点

| 风险 | 等级 | 缓解措施 |
|------|:---:|------|
| Cinema Pipeline 迁移后需重新测试 | 🟡 中 | 添加单元测试 |
| 删除 apps/api 后确认无前端依赖 | 🟢 低 | 当前前端已走 Next.js API Routes |
| @react-three/fiber 删除影响未知 | 🟢 低 | 搜索引用，确认无实际使用 |
| 模型名硬编码（已知问题） | 🟡 中 | 迁移到 Provider 配置统一管理 |
| 无 test script（已知问题） | 🟡 中 | 添加 vitest 或 jest 配置 |
| 单文件运行测试不稳定 | 🟡 中 | 统一测试运行器 |

---

## 八、迁移路线

### Phase 0：备份与审计

| 项目 | 内容 |
|------|------|
| **目标** | 确保所有版本安全备份，明确当前代码基线 |
| **涉及文件** | 全部 3 个版本目录 |
| **操作步骤** | 1. Git commit 当前主干所有未提交修改<br>2. 打 tag `v1-final`<br>3. 创建 `archive/` 目录，拷贝 V-远古版和 V1-过渡版代码<br>4. 记录各版本的 git hash |
| **验收标准** | `git status clean` + tag 存在 + archive 目录完整 |
| **风险** | 低 — 纯备份操作 |

### Phase 1：确定主干

| 项目 | 内容 |
|------|------|
| **目标** | 确认 V1-当前主干为唯一开发基线 |
| **涉及文件** | 全部项目文件 |
| **操作步骤** | 1. 在主干上创建 `v2-dev` 分支<br>2. 删除 `apps/api/` 整个目录<br>3. 删除 `packages/billing/`<br>4. 删除 `packages/config/` 和 `packages/ui/`（如存在）<br>5. 删除 `@react-three/fiber`、`@react-three/drei`、`three` 依赖<br>6. 更新 turbo.json、pnpm-workspace.yaml、根 package.json<br>7. 运行 `pnpm install && tsc --noEmit` |
| **验收标准** | tsc 0 错 + build 成功 + 160 测试全过 |
| **风险** | 🟡 中 — 删除后端和 3D 依赖需确认无隐式引用 |

### Phase 2：迁移高价值功能

| 项目 | 内容 |
|------|------|
| **目标** | 从 V1-过渡版吸收 3 个 P0 功能 |
| **涉及文件** | `packages/canvas/prompt-analyzer.ts`, StarCanvas.tsx, `canvasPersistence.ts` |
| **操作步骤** | 1. 迁移 Cinematic Prompt Pipeline → `packages/canvas/prompt-analyzer.ts`<br>2. 提取视频工作流模板 → `features/canvas/templates/videoWorkflow.ts`<br>3. 增强持久化策略 → 合并过渡版的4级降级逻辑<br>4. 为以上3个功能写测试（每个至少3个测试用例） |
| **验收标准** | 功能可用 + 测试通过 + tsc 0 错 |
| **风险** | 🟡 中 — 两个版本的 API 结构可能有差异需要适配 |

### Phase 3：删除重复功能

| 项目 | 内容 |
|------|------|
| **目标** | 删除已在 Phase 1-2 中被替代的代码 |
| **涉及文件** | 旧的持久化逻辑、重复的类型定义 |
| **操作步骤** | 1. 删除 V1-当前旧的持久化逻辑（被4级降级替代）<br>2. 删除重复的类型定义<br>3. 运行测试确认无破坏 |
| **验收标准** | 所有 160 测试保持通过 |
| **风险** | 🟢 低 — 大部分是简单删除 |

### Phase 4：统一状态管理和数据结构

| 项目 | 内容 |
|------|------|
| **目标** | 确保所有新功能使用统一的数据结构 |
| **涉及文件** | canvasStore, runHistoryStore, useAIUsageStore |
| **操作步骤** | 1. 将 Cinema Pipeline 输出统一到 TypedRawOutput 管道<br>2. 视频模板节点使用标准 CanvasNodeData<br>3. 添加对应的渲染器到 historyOutputRenderers 注册表 |
| **验收标准** | 新功能在 HistoryPanel 中可渲染 + 可拖回画布 |
| **风险** | 🟡 中 — 类型对齐需要仔细处理 |

### Phase 5：统一 AI Provider

| 项目 | 内容 |
|------|------|
| **目标** | 消除模型名硬编码，统一走 Provider 配置 |
| **涉及文件** | `useWorkflowRunner.ts` (~L276, L352), `lib/ai/client.ts` |
| **操作步骤** | 1. 将硬编码的 `gpt-5.5`/`gpt-image-2` 改为从 Provider 配置读取<br>2. Cinema Pipeline 如需特殊模型，通过配置指定<br>3. 添加覆盖测试 |
| **验收标准** | 切换 Provider 配置后，runNode 使用正确的模型 |
| **风险** | 🟢 低 — 改动范围小，有测试覆盖 |

### Phase 6：测试和验收

| 项目 | 内容 |
|------|------|
| **目标** | 确保 V2 功能完整且稳定 |
| **涉及文件** | 全部 |
| **操作步骤** | 1. 为 Cinema Pipeline 写 5+ 测试<br>2. 为视频模板写 3+ 测试<br>3. 为4级降级写 5+ 测试<br>4. 确保测试总数 ≥ 180<br>5. 运行完整回归测试<br>6. tsc --noEmit<br>7. next build<br>8. 浏览器手动验收 8 项核心清单 |
| **验收标准** | 测试全过 + tsc 0 错 + build 成功 + 浏览器验收通过 |
| **风险** | 🟢 低 — 以当前 160 测试为基础增量添加 |

### Phase 7：文档和发布

| 项目 | 内容 |
|------|------|
| **目标** | 产出可交付的 V2 版本 |
| **涉及文件** | 全部 |
| **操作步骤** | 1. 更新 README<br>2. 记录 CHANGELOG<br>3. 通过 GitHub 管理版本<br>4. 打 tag `v2.0.0-alpha` |
| **验收标准** | README 完整 + CHANGELOG 清晰 + tag 存在 |
| **风险** | 🟢 低 |

---

## 九、最终输出

### 1. 主干版本

> **V1-当前主干**（`星轨项目交接包-2026-05-18`）是唯一推荐作为 V2 基线的版本。

### 2. 功能合并清单

| 来源 | 功能 | V2 优先级 |
|------|------|:---:|
| V1-过渡版 | Cinematic Prompt Pipeline | **P0** |
| V1-过渡版 | 视频工作流一键模板 | **P0** |
| V1-过渡版 | 4级 localStorage 降级 | **P0** |
| V1-过渡版 | startrails-project.json 导出 | P1 |
| V1-过渡版 | 分镜/Previs3D 类型库 | P2 |
| V1-过渡版 | 帮助面板 UI | P2 |

### 3. 保留为实验分支

| 功能 | 原因 |
|------|------|
| V1-过渡版的 ContentNode 合并方案 | 评估是否比当前 3 节点类型更好 |
| V-远古版的 NestJS 后端架构设计 | 作为未来多人协作的架构参考 |

### 4. 废弃清单

| 废弃项 | 原因 |
|------|------|
| V-远古版全部代码 | 巨石不可维护，被 V1 完全取代 |
| V1-过渡版 apps/api | 单人产品不需要 NestJS 后端 |
| V1-过渡版 apps/web（吸收后） | 功能迁移后废弃 |
| 所有版本的 @react-three/fiber/three | 无实际 UI 使用 |
| 所有版本的积分/计费逻辑 | 单人产品不需要 |
| `启动星轨.command`（旧启动脚本） | 指向已废弃的 creative-canvas |
| `启动星轨画布（后期）.command` | 指向已废弃的 creative-canvas |
| `检查星轨.command` | 旧版诊断脚本 |
| `star-canvas-files` 目录 | 完全无关的另一个项目 |

### 5. V2 最小功能集（MVP）

```
必须包含（约 15 个核心功能）：
✅ 1. 节点工作流画布 (React Flow + 4种节点)
✅ 2. AI Chat Panel (SSE + canvas-actions 解析)
✅ 3. 双模式 AI Provider (Server/Local)
✅ 4. 工作流执行引擎 (useWorkflowRunner)
✅ 5. ExecutionPlan 多模式
✅ 6. WorkflowRunPanel 执行时间线
✅ 7. History Panel + 拖回画布
✅ 8. AI Usage Metering
✅ 9. 视频分析全链路
✅ 10. Cinema Prompt Pipeline
✅ 11. 视频工作流模板
✅ 12. 4级持久化降级
✅ 13. 右键菜单 + 快捷键
✅ 14. 素材库面板
✅ 15. 设置面板
```

### 6. V2 开发优先级

```
P0 (本次必须完成)
└── Phase 0-2: 备份、确定主干、迁移3个高价值功能

P1 (下一轮)
└── Phase 3-5: 删除重复、统一状态、统一Provider

P2 (后续迭代)
└── Phase 6-7: 测试验证、文档发布
```

### 7. 下一步 — 让 AI 编码助手做什么

> **第一优先级**：Phase 0-1（备份、确定主干、删除冗余）
>
> 具体任务：
> 1. 在当前主干创建 `v2-dev` 分支
> 2. 删除 `apps/api/`、`packages/billing/`、3D 依赖
> 3. 运行 `tsc --noEmit` 和全部测试，确保基线干净
> 4. 迁移 Cinema Prompt Pipeline（从过渡版拷贝 + 适配 + 写测试）
> 5. 迁移视频工作流模板（从过渡版提取 + 独立模块 + 写测试）
> 6. 增强持久化为 4 级降级（合并过渡版逻辑 + 写测试）

---

> 报告完成。以上分析基于三个真实 StarCanvas 版本的完整代码审查。
> 核心原则：**V1-当前主干为唯一基线，吸收过渡版 3 个高价值功能，删除所有冗余，聚焦单人本地创作产品定位。**
