# 🌌 星轨画布（StarCanvas）—— AI 开发平台系统提示词

> **使用方式**：将本文档完整粘贴为 AI Agent 的 System Prompt / Project Context，Agent 即可直接参与本项目开发。

---

## 一、项目定义

```
项目名称：星轨画布 / StarCanvas
仓库路径：/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
技术栈：Next.js 16 App Router · TypeScript · ReactFlow (@xyflow/react) · TailwindCSS · Zustand
项目类型：AI 原生可视化创作工具
核心价值链：剧本/故事 → AI 自动拆解为角色+分镜 → 批量 AI 生图 → 组装绘本/故事板
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
│                                          #   runWorkflow / runNode / runAgent / generateImage
│
├── components/
│   └── nodes/
│       ├── AgentNode.tsx                   # Director Agent 节点组件（130 行）
│       ├── ImageNode.tsx                   # 图片生成节点组件
│       └── ...                            # 其他节点类型
│
├── canvas/
│   ├── types.ts                           # CanvasNodeData 类型定义
│   │                                      # nodeToneStyles 节点视觉风格配置
│   └── stores/
│       └── useCanvasSnapshotStore.ts       # undo/redo 快照存储
│
├── stores/                                # Zustand 状态管理
│
└── utils/
    ├── imageGeneration.ts                 # 图片生成工具函数
    ├── imageGeneration.test.ts            # 440 tests (38 test files)
    ├── storyboardGridComposer.ts          # 分镜合成核心
    ├── storyboardGridComposer.test.ts     # 14 tests
    ├── graph-traversal.ts                 # 图遍历算法
    ├── graph-traversal.test.ts            # 29 tests
    └── videoWorkflowTemplate.ts           # 视频工作流模板（规划中）
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

### 4.1 CanvasNodeData

```typescript
interface CanvasNodeData {
  // ── 通用字段 ──
  label?: string
  type?: string
  nodeKind?: string
  status?: 'idle' | 'running' | 'done' | 'error' | 'pending'
  content?: string
  error?: string

  // ── Agent 专用 ──
  agentStatus?: 'idle' | 'running' | 'done' | 'error'
  agentOutput?: string                    // LLM 原始输出
  _childNodeIds?: string[]                // 自动编排创建的子节点 ID 列表
  _batchProgress?: string                 // 批量生图进度（如 "5/20"）

  // ── 图片专用 ──
  imageUrl?: string
  prompt?: string
  model?: string
  sourceImage?: string                    // IP-Adapter 参考图 data URL

  // ── 分镜专用 ──
  shotIndex?: number
  shotDescription?: string
  characterIds?: string[]

  // ── 角色专用 ──
  characterName?: string
  characterDescription?: string
  referenceImageUrl?: string              // IP-Adapter 参考图（规划中）

  // ── 内部回调 ──
  _onDataChange?: (partial: Partial<CanvasNodeData>) => void
}
```

### 4.2 Agent 输出 JSON 格式

```json
{
  "title": "作品标题",
  "characters": [
    { "id": "char_1", "name": "小明", "description": "8岁男孩，短发，穿蓝色T恤", "role": "主角" }
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
          "description": "小明站在学校门口，背着书包",
          "dialogue": "今天一定要交作业！",
          "action": "小明快步走向校门",
          "duration": "4"
        }
      ]
    }
  ]
}
```

---

## 五、核心引擎：useWorkflowRunner.ts

### 5.1 函数清单

| 函数 | 职责 |
|------|------|
| `runWorkflow()` | 运行整个工作流，按拓扑序执行步骤 |
| `executeStep()` | 执行单个步骤，按 `nodeKind` 分发到具体执行器 |
| `runNode()` | 单节点执行入口 |
| `runAgent()` | Agent 执行：LLM 流式调用 → JSON 解析 → 自动编排 |
| `runAgentFromCanvas()` | 画布级公共 API，校验输入后委托 `runNode` |
| `generateImage()` | 图片生成：调 API → 节点状态更新 → 回写 imageUrl |
| `runWithConcurrency()` | 并发控制器 |

### 5.2 节点状态机

```
idle ──→ running ──→ done
                     ↗
           pending ──→ running ──→ done
  ↑                                  │
  └──────── error ←──────────────────┘
```

### 5.3 模块级桥接变量

```typescript
// 位置：StarCanvas.tsx 模块顶层
// 用途：跨组件通信，因 ReactFlow nodeTypes 注册在组件树外，无法使用 Context

let _runAgentFn: ((nodeId: string) => void) | undefined
let _runBatchGenerateFn: ((nodeIds: string[]) => Promise<void>) | undefined

// Undo/redo stacks
interface UndoEntry { nodes: Node<CanvasNodeData>[]; edges: Edge[] }
const _undoStack: UndoEntry[] = []
const _redoStack: UndoEntry[] = []
const MAX_UNDO = 50
```

---

## 六、架构约束与设计模式

### 6.1 跨组件通信规则

```
约束：节点组件（AgentNode、ImageNode 等）不得直接调用 hooks
模式：画布层 StarCanvas 通过 props 注入回调

StarCanvasInner（持有 useWorkflowRunner）
  └── nodeTypes 包装函数
       └── AgentNode
            props.onRunAgent(nodeId)
            props.onBatchGenerate(nodeIds)
       └── ImageNode
            props.onGenerateClick(nodeId)

桥接链路：
  StarCanvasInner mount → 设置模块级变量 _runAgentFn / _runBatchGenerateFn
  nodeTypes 包装函数 → 读取模块级变量 → 作为 prop 传入节点组件
  节点组件内事件 → 调用 prop 回调 → 到达画布层的 handler
```

### 6.2 状态管理架构

```
Zustand Stores:
  ├── useWorkflowStore          # 工作流全局状态
  ├── useCanvasSnapshotStore    # undo/redo 快照（已建）
  └── [其他 store]

ReactFlow 内置状态:
  ├── nodes[]                   # 画布节点（data: CanvasNodeData）
  └── edges[]                   # 连线

状态更新规则:
  1. 同步 UI 操作 → setNodes / setEdges → ReactFlow 重渲染
  2. 异步任务 → 更新节点 data.status → 驱动视觉反馈（边框颜色/脉冲动画）
  3. Agent 编排 → 批量 setNodes 一次性创建多个节点 + 连线
```

### 6.3 布局算法

```
当前：quickLayout（3 列网格排列，在 dagre-layout.ts 中实现）
输入：nodes[] + edges[] + 列数
输出：Node[]（带坐标的节点，edges 需要单独 setEdges）

未来可选：dagre 有向图布局 / elkjs 分层布局
```

---

## 七、已交付功能清单

### Phase 1 — DirectorAgent 节点 ✅

```
- AgentNode.tsx 组件（拖入画布 + 剧本输入框 + 流式输出展示）
- LLM 调用：剧本文本 → 角色列表 + 场景/分镜列表（JSON 流式输出）
- 四态可视化：idle / running / done / error
- 模型解析：getDefaultImageModel() → cache → fallback 三级兜底
- 错误处理：空 catch → warn + 全失败异常
```

### Phase 2 — 自动编排 ✅

```
- Agent JSON 输出 → 自动创建角色 ContentNode + 分镜 shot 节点
- quickLayout() 自动布局（3 列网格）
- 自动连线：Agent → 角色 / Agent → 分镜
- 回写 agentStatus: 'done' + _childNodeIds 到 Agent 节点 data
```

### Phase 2.5 — AgentNode ↔ WorkflowRunner 桥接 ✅

```
- useWorkflowRunner：runWorkflow 过滤条件加入 type='agent'
- runAgentFromCanvas() 公共 API（校验输入 → 委托 runNode）
- AgentNode：运行按钮通过 onRunAgent 回调接入画布层
- StarCanvas：模块级桥接变量注入 + hasWorkflowNodes 包含 agent
```

### Phase 3 — 批量生图入口 + 进度可视化 ✅

```
- Agent 编排完成后自动选中新节点（selected: true）
- AgentNode 底部"一键生图"按钮（显示子节点数量 + 实时进度 _batchProgress）
- handleBatchGenerateShots：逐个调用 generateImageFromPrompt
- 生成完成后自动创建 ImageNode 结果节点 + 连线
- 每个 ImageNode 显示图片、prompt、模型信息
- _runBatchGenerateFn 模块级桥接
```

### Undo/Redo ✅

```
- 模块级 undo/redo 栈（各 50 条上限）
- Keyboard: Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做
- Auto-capture: deleteSelectedElements, deleteNode, deleteEdge, handleAddNode, duplicateNode
- nodesRef.current / edgesRef.current 同步恢复
```

### SourceImage 支持 ✅

```
- generateImageFromPrompt 新增 sourceImage 参数（data URL）
- 透传到 /api/ai/generate-image 实现 image-to-image
- 测试覆盖：1 个 test 验证 request body 包含 sourceImage
```


### 完整闭环路径（已验证通过）

```
拖入 Agent 节点
  → 粘贴剧本文本（8000+ 字）
  → 点击"🚀 运行分析"
  → LLM 流式输出 JSON（角色 + 分镜逐行流出）
  → 自动编排：20 个分镜节点展开 + 角色节点 + 紫色连线
  → 新节点高亮选中
  → AgentNode 底部出现"🖼️ 一键生图 (20 个分镜)"
  → 点击 → 节点逐个生图 → 进度显示 "5/20"
  → 节点视觉反馈：灰 → 蓝/脉冲（running） → 绿（done）
  → 每个分镜右侧生成 ImageNode 结果 + 连线
  → 闭环完成 ✅
```

---

## 八、当前缺口（按优先级排序）

| 优先级 | 缺口 | 说明 | 涉及文件 |
|--------|------|------|----------|
| **P0** | undo/redo 工具栏按钮 | 快捷键已实装，缺工具栏 UI 按钮 + 灰化状态 | StarCanvas.tsx |
| **P1** | 批量生图全局进度条 | 当前只有单节点状态 + AgentNode 文本进度，缺全局 UI 进度条 | StarCanvas.tsx, 新建 BatchProgressBar.tsx |
| **P1** | 批量生图错误重试 | 单节点失败后跳过，无重试机制 | useWorkflowRunner.ts |
| **P2** | 角色一致性 | 同一角色在不同分镜中视觉不一致，需 IP-Adapter / reference image | ImageNode.tsx, useWorkflowRunner.ts |
| **P2** | runAgent 角色图片自动创建 | Agent JSON 中 character.description → 自动调用生图 API | useWorkflowRunner.ts |
| **P3** | 节点属性面板 | 侧栏编辑面板（选中节点 → 编辑 prompt/model/参数） | 新建 PropertyPanel.tsx, StarCanvas.tsx |
| **P3** | 右键菜单 | 节点右键操作（删除/复制/重跑/导出） | StarCanvas.tsx, 新建 ContextMenu.tsx |
| **P3** | 画布小地图 | 缩略图导航（minimap） | StarCanvas.tsx |
| **P4** | 视频生成管线 | 图片 → 视频模型 API，Timeline 视图 | 新建 VideoNode.tsx, Timeline.tsx |
| **P5** | 登录/云同步 | 用户系统 + 项目 CRUD + 云存储 | 全新模块 |
| **P5** | 错误边界 | 组件崩溃不白屏，显示错误信息 + 重试按钮 | 新建 ErrorBoundary.tsx |

---

## 九、工程规范

### 9.1 提交规范

```
格式：type(scope): description

type:  feat | fix | refactor | perf | style | docs | test | chore
scope: agent | workflow | image | canvas | ui | infra | storyboard

示例：
  feat(agent): add DirectorAgent node with script parsing
  fix(workflow): include agent type in runWorkflow filter
  refactor(canvas): extract node type styles to shared config
```

### 9.2 质量门槛

```
提交前必须通过：
  tsc                    # TypeScript 类型检查零错误
  440 tests / 440 pass   # 全量测试通过

仓库根目录：
  /Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas
```

### 9.3 编码约束

```
1. 不破坏现有闭环（Phase 1→2→2.5→3→undo→batch 链路）
2. 遵循跨组件通信模式（模块级桥接变量 + props 注入）
3. 节点组件内禁止直接调用 useWorkflowRunner
4. 所有异步操作必须更新节点 status 字段
5. setNodes 使用函数式更新（避免闭包陷阱）
6. 新增模块级变量时，在组件 unmount 时清理（置 null）
7. 错误处理：不允许空 catch 块，至少 console.warn
8. 不改动 apps/api、packages/providers、packages/billing（experimental）
9. 不要重构，不要删除文件，不要混用包管理器
```

### 9.4 视觉规范

```
节点状态 → 边框样式映射（nodeToneStyles，定义在 types.ts）：
  idle:     灰色边框
  running:  蓝色边框 + 脉冲动画
  done:     绿色边框
  error:    红色边框
  pending:  浅灰虚线边框

Agent 主题色：紫色（rgba(168, 85, 247, ...)）
```

---

## 十、关键设计决策记录

| 编号 | 决策 | 选择 | 原因 |
|------|------|------|------|
| D1 | 跨组件通信方式 | 模块级变量桥接 | ReactFlow nodeTypes 注册在组件树外，无法使用 Context |
| D2 | 批量生图策略 | 串行执行 | API 限流控制 + 状态管理简单；`runWithConcurrency` 已预留并发能力 |
| D3 | Agent 输出格式 | JSON 流式 | 结构化、可解析、可扩展；`{ characters, storyboard }` 双数组 |
| D4 | 布局算法 | quickLayout 3 列网格 | 简单可靠，MVP 阶段够用 |
| D5 | undo/redo | 模块级栈（非 Zustand） | 避免 store 序列化 overhead，纯内存操作 |
| D6 | 快照上限 | 50 条 | 内存控制，足够常规操作回退 |
| D7 | sourceImage 参数路径 | generateImageFromPrompt → /api/ai/generate-image | 最小侵入改动，不破坏现有调用方 |

---

## 十一、给 Agent 的任务接收格式

当需要 AI 开发平台执行任务时，使用以下格式：

```
任务：[具体任务描述]
优先级：P0 / P1 / P2 / P3 / P4 / P5
涉及文件：[文件列表]
约束：
- [约束条件]
验收标准：
- [可验证的条件]
```

**示例：**

```
任务：实装 undo/redo 快捷键和工具栏按钮
优先级：P0
涉及文件：StarCanvas.tsx
约束：
- 不破坏现有闭环
- 快捷键 Ctrl+Z 撤销 / Ctrl+Y 重做
- 工具栏增加 undo/redo 按钮
- tsc 零错误 + 440 tests 全通过
验收标准：
- 画布操作（拖拽/创建/删除节点）后 Ctrl+Z 可撤销
- 撤销后 Ctrl+Y 可重做
- 快照不超过 50 条
- tsc 零错误 + 全量测试通过
```

---

> 最后更新：2026-05-31
