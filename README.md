# 星轨画布 (StarTrails Canvas) 项目交接包

**交接日期：** 2026-05-18（2026-05-20 补充同步 WorkBuddy 画布文档）
**项目路径：** `/Users/wuyongnaren/WorkBuddy/2026-05-16-task-32/creative-canvas`
**主文件：** `apps/web/src/app/canvas/page.tsx` (5734 行)

---

## 📂 交接包结构

```
星轨项目交接包-2026-05-18/
├── apps/
│   ├── web/              # Next.js 前端（React Flow 画布）
│   └── api/               # NestJS 后端
├── packages/
│   ├── canvas/            # prompt-analyzer
│   ├── providers/         # AI 模型路由
│   ├── shared/            # 共享类型
│   └── billing/          # 计费
├── docs/                  # ← WorkBuddy 画布产出的文档（2026-05-20 同步）
│   ├── tapnow-video-flow.md        # TapNow 真实使用流程说明
│   ├── tapnow-doc1-extracted.md    # TapNow 流程 docx 提取版
│   ├── tapnow-doc2-extracted.md    # 画布与 Chat 互动 docx 提取版
│   ├── tapnow-doc3-extracted.md    # TapNow 流程 docx 提取版（第二版）
│   └── tapnow-canvas-chat.md       # PRD + 技术架构 + 开发任务清单
├── .workbuddy/memory/      # WorkBuddy 工作记忆
├── star-canvas-prompt.md   # 星轨画布优化任务 prompt
├── README.md
└── ...
```

---

## 📋 本次新增功能 (2026-05-18)

### ✅ Phase 1: 文本节点可自由缩放和编辑

**实现：** `ResizableNode` 组件（NodeResizer + 双击编辑）
**位置：** page.tsx 第 332-472 行
- 所有 8 种节点类型统一注册为 `ResizableNode`
- 双击节点 → 编辑 → 保存/取消
- AI 更新节点时同步重建 `data.label` JSX

### ✅ Phase 2: 图片节点 → Prompt 节点自动连线

**实现：** `generatePromptFromImageNode()` 函数
**位置：** page.tsx 第 1617-1745 行
- 选中图片节点时，右侧显示「分析这张图，生成 Prompt」按钮
- AI 分析图片 → 生成英文生图 Prompt → 自动创建 Prompt 节点 → 自动连线

### ✅ Phase 3: AI 改写选中节点

**实现：** `aiRewriteSelectedNode()` + 三个 apply 函数
**位置：** page.tsx 第 1747-1963 行
- 选中 Prompt/Text 节点时，右侧显示「AI 改写这个节点」按钮
- 显示三种处理：替换原节点 / 追加到原节点 / 新建节点

---

## 🏗 项目架构

```
creative-canvas/
├── apps/
│   ├── web/              # Next.js 前端（React Flow 画布）
│   │   └── src/app/canvas/page.tsx  ← 核心文件
│   └── api/               # NestJS 后端
├── packages/
│   ├── canvas/            # prompt-analyzer
│   ├── providers/         # AI 模型路由
│   ├── shared/            # 共享类型
│   └── billing/          # 计费
└── package.json           # pnpm workspace
```

**核心技术栈：** React Flow ^12.10.0, Next.js, NestJS, Prisma

---

## 🚀 运行方式

```bash
cd /path/to/creative-canvas
pnpm install

# 后端
cd apps/api && pnpm run start:dev

# 前端（新窗口）
cd apps/web && pnpm run dev
```

---

## 📝 继续优化方向

1. **Phase 2 增强**：批量从多个图片节点生成 Prompt
2. **Phase 3 增强**：支持用户自定义改写指令
3. **Context Menu**：右键图片节点可直接触发"生成 Prompt"
4. **拖拽**：图片节点拖拽到画布自动生成 Prompt 节点

---

## ⚠️ 未提交的代码改动（2026-05-19 画布优化）

以下 14 个文件有未提交的修改（732 行新增），是 WorkBuddy 画布中完成的优化：

| 文件 | 改动 |
|------|------|
| `apps/web/src/app/canvas/StarCanvas.tsx` | +412 帮助面板、dagre 布局、状态管理 |
| `apps/web/src/app/canvas/components/chat/ChatPanel.tsx` | +88 历史面板、showHistoryFromOutside |
| `apps/web/src/app/canvas/components/canvas/types.ts` | +80 节点类型扩展 |
| `apps/web/src/app/api/ai/chat/stream/route.ts` | +110 SSE 流式响应 |
| `apps/web/src/app/canvas/hooks/useChatAttachments.ts` | +53 附件处理 |
| `apps/web/src/app/canvas/components/canvas/EmptyCanvasGuide.tsx` | +18 空画布引导 |
| `apps/web/src/app/page.tsx` | +43 首页优化 |
| 其他 7 个文件 | 各项 UI 修复和紫色残留清除 |

**建议**：新窗口打开项目后，先 `git add -A && git commit` 提交这些改动。

---

## 📄 docs/ 目录说明（2026-05-20 同步）

从 WorkBuddy 画布同步的 5 份 TapNow 对标分析文档：

| 文件 | 内容 | 行数 |
|------|------|------|
| `tapnow-video-flow.md` | TapNow 从 0 制作视频的完整使用流程 | 2016 |
| `tapnow-doc1-extracted.md` | TapNow 流程说明 docx 提取版 | 2020 |
| `tapnow-doc2-extracted.md` | 画布与 Chat 互动分析 + PRD + 技术架构 | 3912 |
| `tapnow-doc3-extracted.md` | TapNow Studio 操作指南 | 2296 |
| `tapnow-canvas-chat.md` | 对标 TapNow 的 PRD + 技术架构 + 开发任务清单 | 3908 |
