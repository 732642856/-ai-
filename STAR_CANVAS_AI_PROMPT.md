# 🌌 星轨画布（StarCanvas）—— AI 开发平台工程提示词

> 用户提供的完整技术规格 + 竞品差距分析。2026-05-31 版本。
> 测试基线：**372 tests / 372 pass / 0 fail**

---

## 一、项目定义

```
项目名称：星轨画布 / StarCanvas
仓库路径：/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
技术栈：Next.js 14 App Router · TypeScript · ReactFlow (@xyflow/react) · TailwindCSS · Zustand
项目类型：AI 原生可视化创作工具
核心价值链：剧本/故事 → AI 自动拆解为角色+分镜 → 批量 AI 生图 → 组装绘本/故事板
对标产品：TapNow（AI 原生创意画布，含视频生成、Agent 侧栏、全局资产库等完整能力）
```

---

## 二、目录结构（关键文件）

```
apps/web/src/app/canvas/
├── StarCanvas.tsx                         # 画布主组件
│                                          #   ReactFlow Provider + 事件桥接
│                                          #   模块级桥接变量注入
│
├── hooks/
│   └── useWorkflowRunner.ts               # 工作流执行引擎（核心管线，1572 行）
│                                          #   runWorkflow / runNode / runAgent
│
├── components/
│   └── nodes/
│       ├── AgentNode.tsx                   # Director Agent 节点（130 行）
│       ├── ImageNode.tsx                   # 图片生成节点
│       └── ...                            # 其他节点类型
│
├── canvas/
│   ├── types.ts                           # CanvasNodeData + nodeToneStyles
│   └── stores/
│       └── useCanvasSnapshotStore.ts       # undo/redo 快照存储
│
├── stores/                                # Zustand 状态管理
│
└── utils/
    ├── imageGeneration.ts                 # 图片生成工具函数
    ├── imageGeneration.test.ts            # 372 tests
    ├── storyboardGridComposer.ts          # 分镜合成核心
    ├── storyboardGridComposer.test.ts     # 14 tests
    ├── graph-traversal.ts                 # 图遍历算法
    ├── graph-traversal.test.ts            # 29 tests
    └── videoWorkflowTemplate.ts           # 视频工作流模板
├── STAR_CANVAS_SPEC.md                    # 精简版项目规范
└── STAR_CANVAS_AI_PROMPT.md              # 本文件：完整版工程提示词
```

---

## 三、节点类型体系

```typescript
type NodeType =
  | 'workflow'             // 工作流容器
  | 'content'              // 内容/文本
  | 'agent'                // Director Agent（剧本拆解）
  | 'image'                // 图片生成
  | 'image-generation'     // 图片生成（别名）
  | 'character'            // 角色
  | 'storyboard'           // 分镜
  | 'video'                // 视频生成（规划中）
```

---

## 四、核心数据结构

### CanvasNodeData

```typescript
interface CanvasNodeData {
  // ── 通用 ──
  label?: string
  type?: string
  nodeKind?: string
  status?: 'idle' | 'running' | 'done' | 'error' | 'pending'
  content?: string
  error?: string

  // ── Agent 专用 ──
  agentStatus?: 'idle' | 'running' | 'done' | 'error'
  agentOutput?: string
  _childNodeIds?: string[]
  _batchProgress?: string

  // ── 图片专用 ──
  imageUrl?: string
  prompt?: string
  model?: string
  sourceImage?: string

  // ── 分镜专用 ──
  shotIndex?: number
  shotDescription?: string
  characterIds?: string[]

  // ── 角色专用 ──
  characterName?: string
  characterDescription?: string
  referenceImageUrl?: string

  // ── 内部回调 ──
  _onDataChange?: (partial: Partial<CanvasNodeData>) => void
}
```

### Agent 输出 JSON 格式

```json
{
  "characters": [
    { "id": "char_1", "name": "小明", "description": "8岁男孩，短发，穿蓝色T恤" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "location": "学校门口",
      "timeOfDay": "日",
      "mood": "阳光明媚",
      "shots": [
        {
          "shotNumber": 1,
          "shotType": "中景",
          "cameraMovement": "固定",
          "description": "小明站在学校门口",
          "dialogue": "今天一定要交作业！",
          "action": "快步走向校门",
          "duration": "4"
        }
      ]
    }
  ]
}
```

---

## 五、核心引擎：useWorkflowRunner.ts（1572 行）

### 函数清单

| 函数 | 职责 |
|------|------|
| `runWorkflow()` | 运行整个工作流，按拓扑序执行步骤 |
| `executeStep()` | 执行单个步骤，按 `nodeKind` 分发 |
| `runNode()` | 单节点执行入口 |
| `runAgent()` | Agent 执行：LLM 流式调用 → JSON 解析 → 自动编排 |
| `runAgentFromCanvas()` | 画布级公共 API，校验后委托 `runNode` |
| `generateImage()` | 图片生成：调 API → 状态更新 → 回写 imageUrl |
| `runWithConcurrency()` | 并发控制器 |

### 节点状态机

```
idle ──→ running ──→ done
                     ↗
           pending ──→ running ──→ done
  ↑                                  │
  └──────── error ←──────────────────┘
```

### 模块级桥接变量

```typescript
// 位置：StarCanvas.tsx 模块顶层
// 用途：因 ReactFlow nodeTypes 注册在组件树外，无法使用 Context

let _runAgentFn: ((nodeId: string) => void) | undefined
let _runBatchGenerateFn: ((nodeIds: string[]) => Promise<void>) | undefined

interface UndoEntry { nodes: Node<CanvasNodeData>[]; edges: Edge[] }
const _undoStack: UndoEntry[] = []       // Ctrl+Z 栈，50 条上限
const _redoStack: UndoEntry[] = []       // Ctrl+Y 栈
```

---

## 六、架构约束与设计模式

### 跨组件通信

```
约束：节点组件不得直接调用 hooks
模式：画布层 StarCanvas 通过 props 注入回调

StarCanvasInner（持有 useWorkflowRunner）
  └── nodeTypes 包装函数
       └── AgentNode  →  props.onRunAgent / props.onBatchGenerate
       └── ImageNode  →  props.onGenerateClick

桥接链路：
  StarCanvasInner mount → 设置模块级变量
  nodeTypes 包装函数 → 读取模块级变量 → 作为 prop 传入节点组件
  节点组件内事件 → 调用 prop 回调 → 到达画布层 handler
```

### 状态更新规则

```
1. 同步 UI → setNodes/setEdges → ReactFlow 重渲染
2. 异步任务 → 更新 data.status → 驱动视觉反馈（边框色+脉冲动画）
3. Agent 编排 → 批量 setNodes 一次性创建多节点 + 连线
```

### 布局算法

```
当前：quickLayout（3 列网格排列，dagre-layout.ts）
未来：dagre / elkjs 有向图自动布局
```

---

## 七、已交付功能清单

### Phase 1 → Phase 3 完整闭环 ✅

```
拖入 Agent → 粘贴剧本 → 运行分析 → LLM 流式 JSON
→ 自动编排（角色+分镜节点 + 连线 + 布局）
→ 节点高亮选中
→ 一键批量生图（进度显示 "5/20"）
→ 逐个出图 → 创建 ImageNode 结果节点 + 连线
→ 完成 ✅
```

### Undo/Redo ✅

```
Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做
5 个 mutation 点自动捕获：deleteNode / deleteEdge / deleteSelected / addNode / duplicateNode
```

### SourceImage 支持 ✅

```
generateImageFromPrompt 新增 sourceImage 参数（data URL）
透传到 /api/ai/generate-image
```

---

## 八、竞品差距全景（对标 TapNow）

### 关键数据

| 维度 | 星轨画布 | TapNow |
|------|---------|--------|
| 已有能力 | 18 项 | 60 项 |
| 无差距 | 18 项 | — |
| 中等差距 | 16 项 | — |
| 高差距（完全缺失） | 20 项 | — |

### 五大核心缺口

| 缺口 | 描述 | TapNow 能力 | 影响 |
|------|------|------------|------|
| **1. AI 视频管线** | 图生视频完全缺失 | Seedance 2.0 / Kling 3.0 + 条件视频生成 | 故事→视频最后一公里 |
| **2. 对话式 Agent 侧栏** | Agent 单次执行，无持续对话 | Chat Panel + Ask/Max 模式 + Agent 直接操控画布 | 无法迭代式创作 |
| **3. 全局资产库** | 无持久化，画布独立 | 分类资产树 + 右键保存 + 拖拽复用 + 一致性锁定 | 长项目角色一致性 |
| **4. Slash 命令系统** | 无快捷命令 | 节点内 `/` 弹出命令面板（九宫格/三视图/光影） | 交互效率差距 |
| **5. 框选多节点聚合** | 仅 Agent 创建后自动选中 | lasso 框选 → 浮动面板 → 合并生成 | 无法自由组合 |

### 完整差距矩阵

```
能力维度                    星轨画布    TapNow    差距
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【画布基础】
无限画布缩放/平移            ✅        ✅       无
节点拖拽/移动/选中           ✅        ✅       无
节点连线/快捷布局            ✅        ✅       无
自动对齐/snap-to-grid       ❌        ✅       中
小地图 Minimap              ❌        ✅       低
右键上下文菜单               ❌        ✅       中
框选后批量操作面板           ❌        ✅       高
节点折叠/展开               ❌        ✅       低

【节点类型】
文本/Agent/图片/角色/分镜    ✅        ✅       无
视频生成节点                ❌        ✅       高
上传/文件节点               ❌        ✅       中

【AI 生图】
文生图 + 模型选择            ✅        ✅       无
批量生图                    ✅        ✅       无
分辨率/比例选择              ❌        ✅       中
Slash 命令宏                ❌        ✅       高
九宫格变体/三视图/局部重绘    ❌        ✅       高
相机/镜头模拟滑块            ❌        ✅       中
参考图/IP-Adapter           ❌        ✅       高

【AI 视频】全部缺失
图生视频/多节点条件/          ❌        ✅       高
模型选择/时长分辨率控制       ❌        ✅       高

【Agent 能力】
剧本解析+自动编排            ✅        ✅       无
对话式侧栏/Ask-Max/          ❌        ✅       高
操控画布/读上下文            ❌        ✅       高

【资产管理】全部缺失
全局资产库/分类/             ❌        ✅       高
保存复用/一致性锁定           ❌        ✅       高

【进度反馈】
节点状态视觉反馈             ✅        ✅       无
全局进度条/Token用量/重试     ❌        ✅       中

【历史版本】
Undo/Redo（快捷键已实装）    ⚠️按钮    ✅       中
版本历史                    ❌        ✅       中

【协作/导出/基础设施】全部缺失
分享协作/导出/模板库/         ❌        ✅       高
登录/云同步/错误边界          ❌        ✅       中
```

---

## 九、缺口优先级排序

```
P0  → Slash 命令系统（/命令面板）      对标 TapNow 核心交互效率
P0  → 批量生图全局进度条 + 错误重试     已有基础设施，改动量最小
P0  → Undo/Redo 工具栏按钮            快捷键已实装，缺 UI

P1  → 右键上下文菜单                   节点操作必备
P1  → 框选多节点聚合操作               对标 TapNow 高价值差异化
P1  → 分辨率/比例选择 + 自动对齐        生图参数控制基本能力

P2  → 对话式 Agent 侧栏               对标 TapNow 核心差异化
P2  → 全局资产库                       长项目角色一致性必需品
P2  → 节点属性面板                     编辑参数入口

P3  → AI 视频管线（图生视频+Timeline）  对标 TapNow 最核心差异化

P4  → 九宫格变体/三视图/IP-Adapter     专业创作工具
P4  → 相机/镜头模拟滑块                专业摄影控制

P5  → 登录/云同步/分享协作/模板库       SaaS 基础设施
P5  → 局部重绘/合规验证/版本历史        高级功能
```

---

## 十、工程规范

### 提交规范

```
格式：type(scope): description
type:  feat | fix | refactor | perf | style | docs | test | chore
scope: agent | workflow | image | canvas | ui | infra | storyboard
```

### 质量门槛

```
tsc --noEmit       # TypeScript 零错误
pnpm --filter web test  # 372 tests / 372 pass / 0 fail

仓库：/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
```

### 编码约束

```
1. 不破坏现有闭环（Phase 1→2→2.5→3→undo→batch 链路）
2. 遵循跨组件通信模式（模块级桥接变量 + props 注入）
3. 节点组件内禁止直接调用 useWorkflowRunner
4. 所有异步操作必须更新节点 status 字段
5. setNodes 使用函数式更新（避免闭包陷阱）
6. 错误处理：不允许空 catch 块，至少 console.warn
7. 不改动 apps/api、packages/providers、packages/billing
8. 不要重构，不要删除文件，不要混用包管理器
```

### 视觉规范

```
节点状态 → nodeToneStyles（types.ts 中定义）：
  idle:    灰色边框
  running: 蓝色边框 + 脉冲动画（animate-pulse）
  done:    绿色边框
  error:   红色边框
  pending: 浅灰虚线边框
Agent 主题色：紫色（rgba(168, 85, 247, ...)）
```

---

## 十一、TapNow 交互模式速查

> 以下为 TapNow 视频分析提取的交互模式，星轨画布开发时直接参考。

### 节点卡片微架构

```
+---------------------------+
|  [::] Title            X  |  ← 拖拽手柄 + 关闭按钮
+---------------------------+
|                           |
|    生成内容预览区域         |
|    （图片/视频/文本）       |
|                           |
+---------------------------+
| Model: Banana 2  [2K]     |  ← 内联元数据条
+---------------------------+
| [ + ] [ / ] [ ⭐ Save ]   |  ← Hover 悬浮快捷操作栏
+---------------------------+
```

### Slash 命令面板

```
触发：节点内按 / 键
内容：
  /多机位九宫格       Multi-Cam 9-Grid Variation
  /电影级光影修正     Cinematic Lighting Correction
  /角色三视图生成     Character Turnaround Sheets

星轨适配建议：
  /summarize          摘要
  /expand             扩写
  /bullets            要点
  /translate          翻译
  /generate-image     生图
  /generate-variants  变体
```

### Agent 侧栏模式

```
布局：Canvas（左 70%）+ Agent Chat Panel（右 30%）
模式切换：Max（直接执行）/ Ask（用户确认后执行）
交互：用户自然语言 → Agent 读画布上下文 → 操控画布
```

### 框选聚合操作

```
触发：lasso 框选多节点
面板：浮动气泡
  - 文本生成（合并摘要）
  - 图片生成（批量出图）
  - 视频生成（多节点条件输入）
```

### 资产库抽屉

```
位置：左侧滑出抽屉
分类：人物/场景/物品/风格
操作：右键保存 → 拖拽复用
```
