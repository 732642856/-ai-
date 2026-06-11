# StarCanvas 综合资产盘点报告 — 2026-06-11

> 地毯式扫描结果：所有 StarCanvas 相关文件、目录、GitHub 信息汇总

---

## 1. 主项目目录: `/Users/wuyongnaren/Projects/StarCanvas/`

**组织结构（12 个一级目录）:**

```
StarCanvas/
├── 00_INBOX_待整理/              ← 空目录（无待处理文件）
├── 00_INDEX_总索引/              ← 索引文件目录
├── 01_MAIN_主干/                 ← 主开发分支（V2 最新代码）
├── 01_MAIN_开发版/               ← 开发中版本分支
├── 02_ARCHIVE_历史版本/           ← V0 + V1 历史版本
├── 03_REFERENCES_参考资料/        ← 竞品分析、开源测试等
├── 04_EXPORTS_交付物/            ← 交付包/zip备份
├── 05_SECRETS_LOCAL_本地密钥勿上传/ ← 本地环境备份
├── 06_V2_PLANNING/               ← V2 规划文档
├── 99_TRASH_REVIEW_待确认废弃/    ← 空目录
└── 整理日志-2026-05-22.md         ← 41KB
```

### 1.1 00_INBOX_待整理
- **空目录** — 所有文件已被处理

### 1.2 00_INDEX_总索引
```
2026-05-24_round2_manifest/       ← 17个审计清单（manifest、checksums、duplicate report等）
AUDIT_ROUND2_SUMMARY.md           ← 1.6KB
CURRENT_MAIN_PROJECT.md           ← 2.3KB
G0_运行时验收记录.md               ← 1.6KB
GIT_SYNC_LOG.md                   ← 1KB
NEXT_SESSION_PROMPT.md            ← 2.4KB
PROJECT_MAP.md                    ← 1.8KB
README_总览.md                     ← 2.2KB
```
**重点关注:** `NEXT_SESSION_PROMPT.md` 是供下一轮 AI 会话用的 Prompt

### 1.3 01_MAIN_主干 - 主代码（CURRENT）
```
starcanvas/
├── .git/                         ← Git 仓库（主分支: main）
├── .github/                      ← GitHub Actions
├── .workbuddy/                   ← WorkBuddy 记忆（18个审计文件 + memory/）
├── apps/
│   ├── api/                      ← NestJS API 后端
│   └── web/                      ← Next.js 16 前端应用 ← **核心代码**
├── docs/
│   ├── audit/                    ← 29个审计报告（含 session-migration/）
│   ├── deployment/               ← Docker 部署指南
│   ├── handoff/                  ← 交接文档
│   └── reference/tapnow/         ← TapNow 对标参考
├── packages/
│   ├── billing/                  ← 计费模块
│   ├── canvas/                   ← 画布核心（prompt-analyzer.ts）
│   ├── providers/                ← AI 供应商抽象
│   └── shared/                   ← 共享类型/工具
├── scripts/                      ← 6个脚本（CLI、审计、健康检查等）
├── STAR_CANVAS_AI_PROMPT.md      ← 15KB AI Prompt
├── STAR_CANVAS_SPEC.md           ← 15KB 规格说明书
├── RELEASE_NOTES_v0.1.0.md       ← v0.1.0 发布说明
├── bug-report-2026-06-10.md      ← 18KB Bug 报告
├── 深度地毯式扫描综合报告_2026-06-10.md  ← 10KB
└── 星轨画布真实能力清点与对标报告_2026-06-10.md ← 19KB
```

**`apps/web/src/` 核心结构:**
```
src/
├── app/
│   ├── api/ai/                   ← 20个 API 端点
│   │   ├── generate-panorama/    ← ← **新！全景生成 API（6月10日）**
│   │   ├── generate-image/
│   │   ├── generate-video/
│   │   ├── chat/stream/         ← SSE 流式聊天
│   │   ├── bible-director/
│   │   ├── camera-control/
│   │   ├── focus-edit/
│   │   ├── ... 共20个端点
│   └── canvas/                   ← 主画布界面
│       ├── StarCanvas.tsx        ← **317KB** 主组件文件
│       ├── components/           ← 11个子组件目录
│       ├── hooks/                ← 12个hooks
│       └── stores/               ← 8个状态管理
├── lib/
│   ├── agents/                   ← AI Agent 系统
│   ├── ai/                       ← AI 服务层
│   ├── cinematic/                ← 影视管线规则
│   ├── storyboard/               ← 故事板逻辑
│   └── ...
├── config/
├── hooks/
└── types/
```

**`apps/web/src/app/api/ai/chat/stream/route.ts.bak`**
- **26KB** 备份文件（2026-05-24）
- 当前 `route.ts` 28KB（2026-06-10）
- 备份可能包含旧版流式逻辑

### 1.4 01_MAIN_开发版 - 开发中分支
```
starcanvas/
├── .git/                         ← Git 仓库（master 分支）
├── apps/web/                     ← Next.js 前端
│   └── src/app/canvas/
│       ├── StarCanvas.tsx        ← **92KB**（较主干的317KB更简洁）
│       ├── components/           ← 11个子组件
│       ├── hooks/                ← 10个hooks
│       ├── stores/               ← 商店状态
│       └── utils/                ← 18个工具
├── docs/audit/                   ← 5个审计报告（较主干旧版本）
├── packages/
│   ├── canvas/                   ← 画布包
│   └── shared/                   ← 共享包
├── PLAN.md                       ← 32KB 开发计划
└── package.json
```

**关键发现:** 开发版 StarCanvas.tsx 仅 92KB，而主干版 317KB。说明开发版是较早的版本。

### 1.5 02_ARCHIVE_历史版本
```
V0-old_creative-canvas/           ← 初始版本（完整 NestJS + Web）
│   ├── apps/api/dist/            ← 已编译的 API（含 modules/）
│   ├── apps/api/src/modules/     ← 源码（assets, auth, canvas, generation, projects, providers, usage）
│   ├── apps/web/                 ← 旧版前端
│   └── packages/                 ← 旧版包
V1-tx_star-canvas/                ← 过渡版本
│   ├── apps/                     ← 精简版
│   └── packages/                 ← 旧版包
deprecated-review/                ← 空目录
related-but-not-main/             ← 空目录
transition-sources/               ← 空目录
valid-starcanvas-history/         ← 空目录
```

### 1.6 03_REFERENCES_参考资料
```
├── acceptance/                   ← 验收清单（5KB）
├── api-docs/                     ← 空目录
├── design-notes/                 ← 设计笔记
├── open-source-bug-testing-lab/  ← 11个开源项目测试副本
│   ├── arcreel/                  ← 全新 Agent 框架（含 22个 skills）
│   ├── argos/                    ← E2E 测试框架
│   ├── excalidraw/               ← 白板
│   ├── tldraw/                   ← 画布
│   ├── xyflow/                   ← 流程图
│   ├── comfyui-frontend/         ← ComfyUI
│   ├── playwright/               ← 测试
│   ├── msw/                      ← Mock Service Worker
│   ├── chrome-devtools-mcp/      ← Chrome DevTools MCP
│   ├── moyin-creator/            ← 墨印创作
│   └── penshot/                  ← 截图
├── prompts/                      ← Prompt 模板
├── reports/                      ← 7个分析报告
├── screenshots/                  ← 截图
└── 可复用代码模块深度分析报告_2026-06-10.md ← 13KB
```

### 1.7 04_EXPORTS_交付物
```
generated-reports/                ← 空目录
handoff-packages/                 ← 空目录
zip-backups/
  └── 星轨项目交接包-2026-05-17.zip ← 1.3MB
```

### 1.8 05_SECRETS_LOCAL
```
env-backups/                      ← 环境变量备份（空）
```

### 1.9 06_V2_PLANNING
```
22 个规划文档（共约 200KB）:
├── Bug-Backlog
├── Main-Verification-Report
├── Phase-6A Redundancy-Audit
├── Phase-6B-1 Cleanup-Report
├── Phase-6B-2 Isolation-Audit
├── Phase-6B-3 Workspace-Isolation-Report
├── Phase-6B-4 Post-Isolation-Review
├── Phase-6B-5 Providers-Billing-Isolation-Report
├── Phase-7 Final-Cinematic-Pipeline-Integration-Report
├── Phase-7A Cinema-Pipeline-Audit
├── Phase-7B Cinematic-Types-Migration-Report
├── Phase-7C Cinematic-Pure-Functions-Migration-Report
├── Phase-7D Runner-Integration-Audit-Report
├── Phase-7E Runner-Minimal-Integration-Report
├── Phase-7F Cinematic-Integration-Tests-Report
├── StarCanvas-Acceptance-Checklist
├── StarCanvas-Alpha-Audit
├── StarCanvas-资料盘点报告
├── StarCanvas-全版本架构分析报告
├── V2-Roadmap
├── chat-canvas-integration-audit
└── 整理日志
```

### 1.10 99_TRASH_REVIEW_待确认废弃
- **空目录**

---

## 2. `/Users/wuyongnaren/Projects/starcanvas-main/`

**不是 symlink！** 它是 `01_MAIN_主干/starcanvas/` 的**完整副本**（同一文件结构，同一 git 历史）

---

## 3. 桌面 `~/Desktop/`

```
Desktop/
├── StarCanvas-v2/                ← Symlink → /Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
├── StarCanvas Audit Round2 2026-05-23/  ← 10个审计 JSON/TXT 文件
├── starcanvas-handoff-prompt.md  ← 16KB 交接 Prompt
└── 星轨画布文件库/                ← ← **重要！有额外文件**
    ├── DirectorOS-tapnow复刻版/   ← TapNow 参考
    ├── star-canvas-files/        ← ← **重要！独立文件**
    │   ├── components/
    │   │   ├── canvas/
    │   │   │   ├── StarCanvas.tsx     ← **66KB**（旧版画布组件）
    │   │   │   ├── WorkflowNode.tsx
    │   │   │   ├── NodeContextMenu.tsx
    │   │   │   └── types.ts
    │   │   └── panels/
    │   │       ├── HistoryPanel.tsx
    │   │       └── VideoAnalysisPreview.tsx
    │   ├── hooks/useWorkflowRunner.ts  ← 14KB
    │   ├── types/
    │   │   ├── execution-context.ts
    │   │   └── video-analysis.ts
    │   ├── utils/
    │   │   ├── build-node-execution-context.ts
    │   │   ├── execution-plan.ts
    │   │   ├── execution-plan-video.test.ts
    │   │   ├── graph-traversal.ts
    │   │   ├── mock-video-analyzer.ts
    │   │   └── video-metadata.ts
    │   └── index.html, app.js, canvas.js, main.js, style.css
    ├── director-os/              ← DirectorOS 参考
    ├── vsr-env/                  ← Python VSR 环境（含 panorama 管道）
    │   └── lib/python3.11/site-packages/modelscope/pipelines/cv/
    │       ├── panorama_depth_estimation_s2net_pipeline.py
    │       └── text_to_360panorama_image_pipeline.py
    ├── TapNow*.docx              ← TapNow 参考文档（3个，共144KB）
    └── *.command                 ← 启动脚本
```

---

## 4. `~/Downloads/`
- **无 StarCanvas 相关文件**

---

## 5. `.workbuddy/` 记忆文件

**9 个记忆文件包含 StarCanvas 引用:**
```
1c53b836-..._memory.md
2fc4801d-..._memory.md
48f4c0df-..._memory.md
50249115-..._memory.md
b00f3bee-..._memory.md
baba7376-..._memory.md
e2374078-..._memory.md
f796d01c-..._memory.md
fc834482-..._memory.md
```

**项目内 `.workbuddy/` 记忆:**
```
starcanvas/.workbuddy/memory/
├── 2026-05-18.md  (9.5KB)
├── 2026-05-19.md  (6.6KB)
└── 2026-05-20.md  (1.2KB)
```

---

## 6. WorkBuddy Session 目录（含 StarCanvas 数据）

以下历史会话目录包含相关文件：

| 目录 | 内容 |
|------|------|
| `2026-05-16-task-32/` | creative-canvas |
| `2026-05-17-task-36/` | 4张 startrails-canvas 截图 |
| `2026-05-18-task-37/` | canvas-regression 报告 + 截图 + 脚本 |
| `2026-05-19-task-40/` | star-canvas 截图 + visual-verify-canvas.mjs |
| `2026-05-19-task-46/` | tapnow-canvas-chat.md |
| `2026-05-20-20-06-58/` | Infinite-Canvas |
| `2026-05-21-01-00-38/` | star-canvas |
| `2026-05-22-10-45-39/` | 3个 StarCanvas 审计文档 |
| `2026-06-06-09-39-40/` | ← **最大规模！** 多个副本、扫描结果、合并版本 |
| `2026-06-09-08-25-17/` | SPEC + AI_PROMPT |
| `2026-06-09-16-15-40/` | HTML 报告 + 竞品分析 |

**`2026-06-06-09-39-40/` 内关键残留:**
```
├── research/                     ← 大量扫描结果 JSON
├── starcanvas-main-sync-backup-20260608/  ← 备份副本
├── starcanvas-merged/            ← 合并版本
├── star-canvas/                  ← SPEC 副本
├── starcanvas-upload-tmp-20260608/  ← 上传临时文件
└── star-canvas-release/          ← 发布副本
```

---

## 7. GitHub: `github.com/732642856/starcanvas`

| 属性 | 值 |
|------|-----|
| 可见性 | 公开 |
| 主要语言 | TypeScript (94.9%) |
| Star/Watch/Fork | 0 |
| 许可证 | MIT |
| 最新发布 | **v0.1.0 (2026-06-10)** |

**最新 20 次 commit 要点:**
```
c50e687 → panorama deep integration (最新)
9b4479d → 720/360 panorama scene preview
0a00eaf → production workflow panels
0468a9f → v0.1.0 docs
25ef97d → 紫微斗数写回 Bible store
29b45f1 → Phase 1 基建 + ffmpeg 合成
7373e2a → merge 开发版 + 参数化面板
1e2c4c4 → 6项核心能力差距并行实现
f6e3400 → P0+P1 bug 修复
a4a211a → SketchNode + reference image
53b3242 → ContinuityGuard 六维连续性系统
...
71fd7e → Merge PR #2
```

---

## 8. 关键发现总结

### 最重要的"被留下"的文件

| 文件名 | 位置 | 大小 | 说明 |
|--------|------|------|------|
| `route.ts.bak` | `01_MAIN_主干/.../stream/` | 26KB | 旧版流式聊天路由备份 |
| `StarCanvas.tsx` (旧版) | `~/Desktop/星轨画布文件库/star-canvas-files/` | 66KB | **独立于主项目的画布组件！可能是已弃用的旧版本** |
| `star-canvas-files/` 全部 | 同上 | ~150KB | **完整的旧版前端应用（HTML+JS+CSS）** |
| `starcanvas-main-sync-backup-20260608/` | `WorkBuddy/2026-06-06-09-39-40/` | 完整项目 | 2026-06-08 的同步备份 |
| `starcanvas-merged/` | `WorkBuddy/2026-06-06-09-39-40/` | 完整项目 | 合并版本 |
| `starcanvas-upload-tmp-20260608/` | `WorkBuddy/2026-06-06-09-39-40/` | SPEC副本 | 上传临时文件 |

### 重复或冗余目录
1. **`/Users/wuyongnaren/Projects/starcanvas-main/`** = 完整副本 ← 与 `01_MAIN_主干/starcanvas/` 相同
2. **Desktop `StarCanvas-v2`** = symlink → 主目录
3. **`star-canvas-files/`** 在桌面上 = 可能是更早版本的隔离代码
4. WorkBuddy 会话目录中有多个重复副本

### 占空间最大的区域
1. `01_MAIN_主干/starcanvas/` — 完整项目（含 .git = ~260 个对象 + node_modules）
2. `02_ARCHIVE_历史版本/V0-old_creative-canvas/` — 完整旧项目（含 dist/）
3. `03_REFERENCES_参考资料/open-source-bug-testing-lab/` — 11个大型开源项目

### 推荐清理的冗余位置
1. `/Users/wuyongnaren/Projects/starcanvas-main/` — 与主代码完全相同
2. `WorkBuddy/` 中的 starcanvas-* 临时目录
3. `star-canvas-files/` 旧版代码 — 确认已不再需要即可删除
