# 星轨画布 Starrail Canvas — 完整规划文档

> 文档版本：v1.0 | 日期：2026-05-24
> 目标：完整对标 TapNow 全部实用功能 + 手绘/分镜/导演级 AI Agent 增强

---

## SECTION 1：产品目标确认

星轨画布的目标复述：

1. **不是选择性参考 TapNow**，而是完整实现 TapNow 教程视频中展示的全部实用功能
2. **在 TapNow 基础上增强**：
   - 手绘板 / 触控笔 / 鼠标绘图能力
   - 画布内直接绘制、标注、修改、补充分镜
   - AI Agent 像导演、分镜师、摄影师、美术指导一样工作
   - 主动利用开源项目加速开发，不闭门造车
3. **AI Agent 必须能操作画布**（通过结构化 actions），不只是聊天
4. **最终产品形态**：从想法、脚本、草图 → 角色、分镜、镜头、视频、资产管理的完整创作工作流

---

## SECTION 2：TapNow 全功能对标表

| # | TapNow 功能 | 星轨当前状态 | 差距 | 星轨实现形态 | 优先级 | 复杂度 |
|---|---|---|---|---|---|---|
| 1 | 无限画布（缩放/平移） | ✅ React Flow 已实现 | 无 | 现有 React Flow 基础 | 已完成 | 低 |
| 2 | 文本节点 ContentNode | ✅ 已实现 | 需增强：内联 AI 编辑 | 节点内 AI 流式输出 | P0 | 中 |
| 3 | 图片节点 ImageNode | ✅ 已实现壳 | 缺：AI 生成图片、参数面板 | 对接图片生成 API | P0 | 中 |
| 4 | 视频节点 VideoNode | ❌ 未实现 | 全部 | 新建 VideoNode + 视频生成 API | P1 | 高 |
| 5 | 音频节点 AudioNode | ❌ 未实现 | 全部 | 新建 AudioNode | P2 | 低 |
| 6 | 内联 AI 文本生成 | ⚠️ 有 ChatPanel 但节点内无内联输入 | 缺：节点内 AI 输入框 | ContentNode 底部内联 AI 栏 | P0 | 中 |
| 7 | AI 图片生成（节点内触发） | ❌ mock 模式，无真实生成 | 全部 | 对接 OpenAI/DALL-E 或 ComfyUI | P0 | 中 |
| 8 | AI 视频生成 | ❌ 未实现 | 全部 | 对接视频生成 API | P1 | 高 |
| 9 | 多模型选择 | ❌ 未实现 | 全部 | 参数面板 + 模型选择器 | P1 | 中 |
| 10 | 分辨率/比例选择 | ❌ 未实现 | 全部 | 参数面板 | P1 | 低 |
| 11 | 参数面板 | ❌ 未实现 | 全部 | 侧边栏参数面板 | P1 | 中 |
| 12 | Slash 命令系统 | ⚠️ 有 slashCommandData.ts，但 ChatInput 未完整触发 | 缺：命令执行逻辑 | ChatInput 内 `/` 菜单 + 执行 | P0 | 中 |
| 13 | 节点右键菜单 | ⚠️ 代码中提到但未实现 | 全部 | React Flow node 自定义上下文菜单 | P0 | 中 |
| 14 | 边右键菜单 | ⚠️ 代码中提到但未实现 | 全部 | React Flow edge 自定义上下文菜单 | P1 | 低 |
| 15 | 框选多节点 | ⚠️ React Flow 有基础框选 | 缺：批量操作 UI | 多选 + 批量操作面板 | P0 | 中 |
| 16 | 多节点批量操作 | ❌ 未实现 | 全部 | 批量生成/总结/导出 | P1 | 中 |
| 17 | AI Agent 侧边栏 | ⚠️ ChatPanel 存在但未对齐 Agent 能力 | 缺：上下文理解、计划模式 | 增强 ChatPanel 为 Agent 面板 | P0 | 高 |
| 18 | Ask / Max / Preview 模式 | ⚠️ AGENT_MODES 常量已定义，未实现切换 | 缺：三种模式执行逻辑 | Agent 模式切换 + 执行器 | P0 | 高 |
| 19 | 资产库 | ❌ 未实现 | 全部 | 资产库面板 + 拖拽复用 | P1 | 高 |
| 20 | 保存为资产 | ❌ 未实现 | 全部 | 右键保存节点为资产 | P1 | 中 |
| 21 | 资产拖拽复用 | ❌ 未实现 | 全部 | 从资产库拖入画布 | P1 | 中 |
| 22 | 模板系统 | ❌ 未实现 | 全部 | 模板库 + 应用模板 | P2 | 高 |
| 23 | 项目管理 | ❌ 未实现 | 全部 | 项目列表 + 多画布 | P1 | 高 |
| 24 | Source Trace / 生成历史 | ⚠️ 类型已定义，未完整实现 | 缺：历史 UI + 追溯 | Source Trace 面板 | P1 | 中 |
| 25 | 分享 / 导出 | ❌ 未实现 | 全部 | 导出 JSON/PNG/PDF | P2 | 中 |
| 26 | 协作 | ❌ 未实现 | 全部 | WebSocket + Y.js | P2 | 高 |
| 27 | Token / 成本提示 | ❌ 未实现 | 全部 | 成本估算 UI | P1 | 低 |
| 28 | 节点状态显示（dot） | ⚠️ 类型已定义，未完整实现 | 缺：状态 dot UI | 节点状态指示灯 | P0 | 低 |
| 29 | 加载状态 | ⚠️ ChatPanel 有 streaming 状态 | 需对齐节点级别 | 节点内 loading spinner | P0 | 低 |
| 30 | 错误状态 | ⚠️ ChatPanel 有 error 显示 | 需对齐节点级别 | 节点内 error banner | P0 | 低 |
| 31 | 自动布局 | ❌ 未实现 | 全部 | dagre 自动布局 | P1 | 中 |
| 32 | 角色/场景/风格一致性 | ❌ 未实现 | 全部 | 资产管理 + Prompt 模板 | P1 | 高 |

---

## SECTION 3：星轨新增增强能力清单

| 增强能力 | 用户价值 | 与 TapNow 差异 | 推荐实现方式 | 优先级 | 复杂度 |
|---|---|---|---|---|---|
| 手绘板 / 压感绘图 | 专业分镜师工作流 | TapNow 无此能力 | tldraw（嵌入 React Flow）或 Fabric.js | P0 | 高 |
| DrawNode / SketchNode | 草图直接变节点 | TapNow 无 | tldraw 作为自定义 React Flow 节点 | P0 | 高 |
| 图片标注修改 | 精确控制 AI 生成结果 | TapNow 无 | Canvas API + 标注 → 重发 prompt | P1 | 中 |
| 草图转图片 | 从草图生成正式图 | TapNow 有类似能力 | perfect-freehand → OpenAI vision → DALL-E | P0 | 中 |
| 草图转分镜 | 手绘分镜→正式分镜 | TapNow 无 | 草图识别 + 分镜生成 Agent | P1 | 高 |
| StoryboardShotNode | 专业分镜镜头节点 | TapNow 无专门分镜节点 | 新建节点类型 + 分镜字段 | P0 | 中 |
| SceneNode | 场景管理 | TapNow 无 | 新建节点类型 | P1 | 低 |
| CharacterNode | 角色管理 | TapNow 无 | 新建节点类型 + 角色一致性 | P1 | 中 |
| CameraPlanNode | 镜头规划 | TapNow 无 | 新建节点类型 | P2 | 中 |
| 分镜自动生成 | 脚本→分镜全流程 | TapNow 有部分 | 多步骤 Agent 工作流 | P0 | 高 |
| Shot List 生成 | 导出行业格式 | TapNow 无 | 节点数据 → 表格导出 | P1 | 低 |
| 导演 Agent | 叙事/节奏/视觉建议 | TapNow 的 Agent 较通用 | 专门 director agent prompt + tool calling | P1 | 高 |
| 分镜师 Agent | 剧本→镜头拆解 | TapNow 无专门分镜师 | 专门 storyboard agent prompt | P0 | 高 |
| 摄影师 Agent | 景别/机位/光线建议 | TapNow 无 | 专门 cinematographer agent | P1 | 高 |
| 美术指导 Agent | 风格/色彩/参考图管理 | TapNow 无 | 专门 production designer agent | P2 | 高 |
| Prompt 工程师 Agent | 优化 AI 生成 prompt | TapNow 有基础 | 专门 prompt engineer agent | P1 | 中 |
| Agent 结构化 actions | Agent 直接操作画布 | TapNow 有基础，星轨需更强 | JSON Schema actions + 执行器 | P0 | 高 |
| Preview 模式 | 草稿节点确认后落地 | TapNow 的 Max 模式不涵盖 | 半透明节点 + 确认按钮 | P0 | 中 |
| Agent 操作回滚 | 误操作可撤销 | TapNow 有基础 undo | Command Pattern + Source Trace | P0 | 中 |
| Agent 执行日志 | 透明化 AI 操作 | TapNow 有部分 | 日志面板 + 节点高亮 | P1 | 低 |

---

## SECTION 4：开源项目调研与推荐

### 4.1 无限画布 / 节点编辑

| 开源项目 | 优点 | 缺点 | 协议 | 集成难度 | 推荐度 |
|---|---|---|---|---|---|
| **React Flow (xyflow)** | 已使用；专业节点编辑；活跃维护 | 不是自由绘图画布 | MIT | 低（已集成） | ⭐⭐⭐⭐⭐ |
| **tldraw** | 专业级绘图；支持压感；可嵌入；MIT | React 组件，需嵌入 React Flow 节点 | MIT | 中 | ⭐⭐⭐⭐⭐ |
| **Excalidraw** | 手绘风格；协作内置；活跃 | 架构独立，嵌入复杂 | MIT | 高 | ⭐⭐⭐ |
| **Fabric.js** | 成熟 Canvas 库；自由绘图能力强 | 维护放缓；无 React 集成 | MIT | 中 | ⭐⭐⭐ |

**推荐结论**：
- 画布核心：**继续用 React Flow**（已集成，专业节点编辑）
- 手绘能力：**嵌入 tldraw 作为 DrawNode 的内容**（tldraw 可嵌入 React Flow 自定义节点）
- 压感笔刷：**perfect-freehand**（轻量，配合 tldraw）

---

### 4.2 手绘 / 压感

| 开源项目 / npm 包 | 优点 | 缺点 | 协议 | 集成难度 | 推荐度 |
|---|---|---|---|---|---|
| **tldraw** | 完整绘图方案；压感；协作 | 包体积较大 | MIT | 中 | ⭐⭐⭐⭐⭐ |
| **perfect-freehand** | 极轻量；手绘笔触；React 友好 | 需自己构建 UI | MIT | 低 | ⭐⭐⭐⭐ |
| **rough.js** | 手绘风格渲染 | 不是绘图工具，是渲染器 | MIT | 低 | ⭐⭐⭐ |
| **Fabric.js** | 功能全面 | 较重；React 集成需自己写 | MIT | 中 | ⭐⭐⭐ |
| **react-konva** | Canvas 高性能；支持笔刷 | Konva 学习曲线 | MIT | 中 | ⭐⭐⭐⭐ |
| **Pointer Events API** | 原生压感支持 | 需自己处理所有逻辑 | 无（浏览器标准） | 高 | ⭐⭐⭐ |

**推荐结论**：
- DrawNode：**tldraw 嵌入**（最完整方案）
- 轻量笔刷：**perfect-freehand**（配合 Canvas API）
- 压感：**Pointer Events API**（`event.pressure` + `event.tangentialPressure`）

---

### 4.3 分镜 / 视频编辑

| 开源项目 | 优点 | 缺点 | 协议 | 集成难度 | 推荐度 |
|---|---|---|---|---|---|
| **Remotion** | React 组件式视频编辑；编程控制 | 学习曲线陡 | MIT | 高 | ⭐⭐⭐⭐ |
| **ffmpeg.wasm** | 浏览器内视频处理 | 性能受限；包大 | LGPL | 中 | ⭐⭐⭐ |
| 无专门开源分镜编辑器 | — | 市场空白 | — | — | — |

**推荐结论**：
- 分镜编辑：**自研 StoryboardShotNode + 横向故事板布局**（无直接可用开源，需自研）
- 视频预览：**Remotion**（React 组件式，与项目技术栈一致）
- 视频处理：**ffmpeg.wasm**（浏览器内，无需服务端）

---

### 4.4 AI Agent / Tool Calling

| 开源项目 | 优点 | 缺点 | 协议 | 集成难度 | 推荐度 |
|---|---|---|---|---|---|
| **Vercel AI SDK** | 官方维护；streaming；tool calling；React 集成好 | 主要支持 OpenAI 兼容 API | MIT | 低 | ⭐⭐⭐⭐⭐ |
| **LangChain** | 功能全面；Agent 框架成熟 | 重量级；浏览器端使用复杂 | MIT | 高 | ⭐⭐⭐ |
| **LangGraph** | 复杂工作流；状态机 | 复杂；适合后端 | MIT | 高 | ⭐⭐⭐ |
| **CopilotKit** | React 集成；Agent 交互 UI | 较新；文档不全 | MIT | 中 | ⭐⭐⭐⭐ |
| **assistant-ui** | Agent 对话 UI 组件库 | 只处理 UI，不处理 Agent 逻辑 | MIT | 低 | ⭐⭐⭐ |

**推荐结论**：
- 前端 Agent 交互：**Vercel AI SDK**（最适合当前技术栈）
- Agent 后端框架：**LangGraph**（复杂多步骤工作流，放在后端 API route）
- Agent UI 组件：**CopilotKit**（可增强 ChatPanel）

---

### 4.5 协作 / 历史 / 状态同步

| 开源项目 | 优点 | 缺点 | 协议 | 集成难度 | 推荐度 |
|---|---|---|---|---|---|
| **Y.js** | 工业级 CRDT；多语言支持 | 学习曲线 | MIT | 高 | ⭐⭐⭐⭐⭐ |
| **Automerge** | CRDT；JSON 友好 | 性能不如 Y.js | MIT | 中 | ⭐⭐⭐ |
| **Liveblocks** | 开箱即用；React 集成好 | 云服务（需付费） | 商业+有限开源 | 低 | ⭐⭐⭐⭐ |
| **zustand-middlewares** | 无 CRDT，简单 undo | 不支持协作 | MIT | 低 | ⭐⭐⭐ |

**推荐结论**：
- MVP 阶段：**zustand `devtools` 中间件**（已使用，足够）
- 协作阶段：**Y.js + WebRTC**（自托管，无持续费用）
- 快速方案：**Liveblocks**（如果接受云服务）

---

### 4.6 综合推荐：MVP 技术栈

| 模块 | 推荐方案 | 理由 |
|---|---|---|
| 画布核心 | React Flow（现有） | 已集成；专业 |
| 手绘节点 | tldraw 嵌入 | 最完整；MIT；可嵌入 |
| 压感笔刷 | Pointer Events API + perfect-freehand | 原生支持；轻量 |
| 分镜编辑 | 自研 StoryboardShotNode | 无直接可用开源 |
| Agent 前端 | Vercel AI SDK | 最适合 Next.js |
| Agent 后端 | LangGraph | 复杂工作流 |
| 视频处理 | Remotion（编辑）+ ffmpeg.wasm（处理） | React 友好 |
| 协作（未来） | Y.js + WebRTC | 自托管；工业级 |

---

## SECTION 5：总体技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层（Next.js App Router）           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  StarCanvas  │  │  AssetLibrary  │  │  TemplatePanel │  │
│  │  (React Flow) │  │  (侧边栏)     │  │  (侧边栏)     │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │             │
│  ┌──────┴─────────────────┴─────────────────┐  │
│  │            Agent Panel (ChatPanel 增强版)      │  │
│  │  - 模式切换（Ask/Max/Preview）             │  │
│  │  - 上下文显示                                 │  │
│  │  - 执行日志                                 │  │
│  └──────┬──────────────────────────────────────┘  │
└─────────┼────────────────────────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────┐
│          │          状态管理层（Zustand）               │
│  ┌──────┴──────┐  ┌──────────────┐             │
│  │  canvasStore  │  │  assetStore   │             │
│  │  (节点/边/   │  │  (资产库)     │             │
│  │   选择/模式)  │  │                │             │
│  └──────┬──────┘  └──────┬───────┘             │
│         │                  │                           │
└─────────┼──────────────────┼───────────────────────┘
          │                  │
┌─────────┼──────────────────┼───────────────────────┐
│          │          执行层                                  │
│  ┌──────┴──────┐  ┌──────┴──────┐             │
│  │ WorkflowRunner│  │  ActionExecutor             │  │
│  │  (计划/执行/ │  │  (结构化 action │             │
│  │   撤销/重做)  │  │   执行引擎)    │             │
│  └──────┬──────┘  └──────┬───────┘             │
│         │                  │                           │
│  ┌──────┴──────────────────┴──────┐             │
│  │        Source Trace Recorder          │             │
│  │  (每次 AI 调用记录)                │             │
│  └──────┬──────────────────────────┘             │
└─────────┼────────────────────────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────┐
│          │          外部服务层                           │
│  ┌──────┴──────┐  ┌──────────────┐             │
│  │  AI API Routes │  │  Image/Video  │             │
│  │  (Next.js API) │  │  Generation    │             │
│  │  - /api/ai/   │  │  Services      │             │
│  │    chat/stream  │  │  - DALL-E     │             │
│  │  - /api/ai/    │  │  - Sora       │             │
│  │    generate/     │  │  - ComfyUI     │             │
│  │    image         │  │  - Runway      │             │
│  └─────────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────┘
```

**数据流说明**：

1. **用户操作画布** → React Flow 事件 → `canvasStore` 更新 → 画布重渲染
2. **用户输入 AI 命令** → ChatPanel → `useChatSSE` → `/api/ai/chat/stream` → AI API → SSE 流式返回 → ChatPanel 显示
3. **Agent 生成 actions** → `WorkflowRunner` 解析 → `ActionExecutor` 执行 → `canvasStore` 更新 → Source Trace 记录
4. **Ask 模式** → Agent 生成计划 → 用户确认 → 执行
5. **Max 模式** → Agent 直接执行 → 画布更新
6. **Preview 模式** → Agent 生成草稿节点（半透明）→ 用户确认 → 正式节点

---

## SECTION 6：Agent Action Schema 设计

### 6.1 完整 Action 列表

#### create_node

```json
{
  "type": "create_node",
  "payload": {
    "id": "shot_001",
    "nodeType": "storyboard-shot",
    "position": { "x": 100, "y": 200 },
    "data": {
      "title": "Shot 01 - 雨夜城市",
      "description": "...",
      "shotSize": "远景",
      "cameraAngle": "高机位俯拍",
      "lens": "24mm",
      "cameraMovement": "缓慢推进",
      "lighting": "霓虹逆光",
      "mood": "孤独、压迫",
      "duration": "3-5s"
    }
  },
  "status": "pending",
  "undoable": true,
  "sourceTrace": {
    "prompt": "...",
    "model": "gpt-4o",
    "timestamp": 1716720000000
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `create_node` | Action 类型 |
| `payload.id` | `string` | 节点 ID（可选，未提供则自动生成） |
| `payload.nodeType` | `string` | 节点类型（content/image/storyboard-shot/draw/...） |
| `payload.position` | `{ x: number, y: number }` | 画布坐标 |
| `payload.data` | `Record<string, unknown>` | 节点数据（因节点类型而异） |
| `status` | `pending/executed/failed` | 执行状态 |
| `undoable` | `boolean` | 是否可撤销 |
| `sourceTrace` | `object` | 来源追溯 |

#### update_node

```json
{
  "type": "update_node",
  "payload": {
    "id": "shot_001",
    "data": {
      "title": "Shot 01 - 修正版",
      "duration": "4-6s"
    }
  },
  "status": "pending",
  "undoable": true
}
```

#### delete_node

```json
{
  "type": "delete_node",
  "payload": {
    "id": "shot_001"
  },
  "status": "pending",
  "undoable": true
}
```

#### create_edge

```json
{
  "type": "create_edge",
  "payload": {
    "source": "scene_01",
    "target": "shot_001",
    "type": "smoothstep"
  },
  "status": "pending",
  "undoable": true
}
```

#### generate_storyboard（复合 action）

```json
{
  "type": "generate_storyboard",
  "payload": {
    "script": "雨夜，孤独的侦探走在霓虹闪烁的街道上...",
    "numShots": 5,
    "style": "赛博朋克，暗色调",
    "position": { "x": 100, "y": 100 }
  },
  "status": "pending",
  "undoable": true,
  "subActions": [
    { "type": "create_node", "payload": { "nodeType": "storyboard-shot", ... } },
    { "type": "create_edge", "payload": { "source": "...", "target": "..." } }
  ]
}
```

---

### 6.2 Action 可执行性矩阵

| Action | 是否需要确认（Ask模式） | 是否可撤销 | Source Trace 记录内容 |
|---|---|---|---|
| `create_node` | 否（Max 模式直接执行） | 是 | prompt + 模型 + 参数 + 输出节点 ID |
| `update_node` | 否 | 是 | prompt + 修改字段 + 旧值 + 新值 |
| `delete_node` | **是**（破坏性操作） | 是 | 删除节点 ID + 原因 |
| `create_edge` | 否 | 是 | 源节点 + 目标节点 |
| `delete_edge` | 否 | 是 | 边 ID |
| `auto_layout` | 否 | 是 | 布局算法 + 受影响节点 |
| `generate_text` | 否 | 是 | prompt + 模型 + 输出文本 |
| `generate_image` | **是**（有成本） | 是 | prompt + 模型 + 分辨率 + 成本 |
| `generate_video` | **是**（高成本） | 是 | prompt + 模型 + 时长 + 成本 |
| `generate_storyboard` | **是**（多节点创建） | 是 | 脚本 + 镜头数 + 生成的节点 IDs |
| `save_as_asset` | 否 | 否 | 节点 ID + 资产类型 + 资产 ID |
| `apply_template` | **是**（大范围修改） | 是 | 模板 ID + 受影响节点 |

---

## SECTION 7：新增节点类型设计

### 7.1 StoryboardShotNode（分镜镜头节点）—— P0

**用途**：专业分镜创作的镜头节点

**核心字段**：
- `title`: string（镜头标题，如 "Shot 01 - 雨夜城市"）
- `shotNumber`: number（镜头编号）
- `description`: string（画面描述）
- `shotSize`: '远景' | '全景' | '中景' | '近景' | '特写'（景别）
- `cameraAngle`: string（机位：高机位/低机位/平视/...）
- `lens`: string（焦段：24mm/50mm/85mm/...）
- `cameraMovement`: string（镜头运动：推/拉/摇/移/...）
- `composition`: string（构图：三分法/对称/引导线/...）
- `lighting`: string（光线：逆光/侧光/顶光/...）
- `colorPalette`: string（色彩方案）
- `mood`: string（情绪）
- `dialogue`: string（台词）
- `soundEffect`: string（音效）
- `music`: string（音乐）
- `transition`: string（转场：切/淡入淡出/划变/...）
- `duration`: string（时长：3-5s）
- `referenceImage`: string（参考图 URL）
- `generatedImage`: string（AI 生成图 URL）
- `status`: 'draft' | 'review' | 'approved'（审批状态）

**UI 结构**：
```
┌─────────────────────────────────┐
│ Shot 01          [draft] ●   │  ← 标题 + 状态 dot
├─────────────────────────────────┤
│ [参考图/生成图]                        │  ← 图片区域（可点击重新生成）
├─────────────────────────────────┤
│ 景别：远景  机位：高机位俯拍        │
│ 焦段：24mm  运动：缓慢推进          │
│ 光线：霓虹逆光  情绪：孤独、压迫     │
├─────────────────────────────────┤
│ 画面描述：                          │
│ 赛博朋克城市雨夜，霓虹反射...       │
├─────────────────────────────────┤
│ 台词："我一直在找你..."             │
│ 音效：雨声、远处的警笛              │
│ 时长：3-5s  转场：淡入淡出           │
└─────────────────────────────────┘
│ [AI 改写] [重新生成图] [拆分为更多镜头] │  ← 节点内操作按钮
└─────────────────────────────────┘
```

**右键菜单**：
- 编辑
- 重新生成图片
- 生成镜头描述（AI）
- 拆分为更多镜头
- 复制到资产库
- 导出为分镜表一行
- 删除

**Slash 命令**：
- `/生成图片`
- `/重新生成`
- `/AI改写描述`
- `/拆分为镜头`
- `/导出分镜表`

**可执行 AI 操作**：
- 生成/重新生成图片
- AI 改写镜头描述
- 根据描述建议机位/焦段/运动
- 拆分为更多镜头（AI 自动）

**可连接对象**：SceneNode、CharacterNode、其他 StoryboardShotNode

---

### 7.2 DrawNode / SketchNode（手绘节点）—— P0

**用途**：手绘草图，可转为正式图片或分镜

**核心字段**：
- `strokes`: Array（笔划数据，tldraw 格式）
- `imageUrl`: string（导出为图片后的 URL）
- `usedFor`: 'reference' | 'image-source' | 'storyboard-sketch'（用途）
- `aiGeneratedImage`: string（AI 根据草图生成的结果）

**UI 结构**：
```
┌─────────────────────────────────┐
│ 🖊️ 手绘节点           [saved] ●  │
├─────────────────────────────────┤
│ [tldraw 绘图区域]                 │
│ 工具：笔 / 橡皮 / 直线 / 箭头    │
│ 颜色、粗细、透明度                  │
├─────────────────────────────────┤
│ [根据此草图生成图片]               │
│ [标注修改图片]                     │
│ [转为分镜草图]                   │
└─────────────────────────────────┘
```

**右键菜单**：导出为图片、清除、根据草图生成 AI 图片

---

### 7.3 VideoNode（视频节点）—— P1

**用途**：存储和预览视频素材

**核心字段**：
- `videoUrl`: string
- `duration`: number
- `thumbnail`: string
- `generationParams`: object（生成参数，如果是由 AI 生成的）

---

### 7.4 其余节点类型（SceneNode、CharacterNode 等）—— P1-P2

（详细设计见完整规划文档第二部分）

---

## SECTION 8：两周 MVP 计划

### P0：两周内必须完成

| 功能 | 用户价值 | MVP 范围 | 涉及模块 | 复杂度 | 验收标准 |
|---|---|---|---|---|---|
| Slash 命令完整实现 | 快速触发 AI 操作 | ChatInput `/` 菜单 + 12 个命令 | ChatInput, ChatPanel, StarCanvas | 中 | 输入 `/` 出现菜单；选择命令后执行对应 action |
| Agent Ask 模式 | 防止误操作 | 计划显示 + 确认 UI | ChatPanel, WorkflowRunner | 高 | Agent 返回计划；用户确认后执行 |
| Agent 创建/更新/删除节点 | 核心画布操作 | 3 个 action 执行器 | StarCanvas, canvasStore | 中 | AI 触发 `create_node` 后画布出现新节点 |
| 基础 StoryboardShotNode | 差异化功能 | 节点 UI + 字段显示 | packages/canvas | 中 | 画布能添加分镜节点；字段正确显示 |
| 基础 DrawNode | 手绘能力 | tldraw 嵌入 + 笔刷 | packages/canvas, DrawNode | 高 | 节点内可绘图；可导出为图片 |
| 分镜生成 Agent | 核心 AI 能力 | 脚本 → 多镜头节点 | ChatPanel, API route | 高 | 输入脚本，画布自动生成分镜节点 |
| 多节点选择操作 | 批量操作基础 | 框选 + 总结/生成 | StarCanvas, ChatPanel | 中 | 框选多个节点；Agent 可将其作为联合上下文 |
| Source Trace 基础 UI | 追溯能力 | 历史面板 + 点击定位 | ChatPanel, SourceTrace | 中 | 点击历史记录，画布定位到对应节点 |

### P1：下一阶段（第 3-4 周）

资产库、模板系统、VideoNode、图片标注修改、草图转图、自动布局、多模型参数面板、Preview 模式

### P2：后续（第 5-8 周）

完整视频生成、高级协作、完整时间线、高级压感、复杂资产版本管理、项目分享社区

---

## SECTION 9：工程落地路线

### 第一阶段：Slash 命令完整实现（3-4 天）

**目标**：`/` 触发命令菜单；选择命令后执行对应 action

**要读的文件**：
- `apps/web/src/app/canvas/components/chat/ChatInput.tsx`（已部分实现，需完善）
- `apps/web/src/app/canvas/components/chat/slashCommandData.ts`（已定义命令，需补充）
- `apps/web/src/app/canvas/StarCanvas.tsx`（handleChatAction 需增强）

**要改的文件**：
- `ChatInput.tsx`：完善 `/` 检测逻辑；命令筛选；键盘导航；执行回调
- `slashCommandData.ts`：补充所有 12+ 个命令定义
- `StarCanvas.tsx`：增强 `handleChatAction` 处理所有命令类型
- `canvasStore.ts`：补充 `executeAction` 方法

**要新增的 types**：
- `SlashCommand` 已有；需补充 `action.payload` 的完整 schema

**要新增的 components**：无（复用现有）

**是否涉及后端 API**：否（MVP 用 mock）

**如何影响 useWorkflowRunner**：需对接（第一阶段先直接执行，第二阶段接入 WorkflowRunner）

**如何影响 Source Trace**：每次 action 执行需记录到 Source Trace

**如何测试**：手动在 ChatInput 中输入 `/` 验证菜单弹出；选择命令验证画布响应

**如何 typecheck**：`pnpm run typecheck`

---

### 第二阶段：Agent Ask 模式 + 三种模式切换（3-4 天）

**目标**：Agent 返回计划 → 用户确认 → 执行

**要读的文件**：
- `packages/shared/src/types.ts`（`AGENT_MODES` 已定义）
- `apps/web/src/app/canvas/StarCanvas.tsx`（模式切换 UI）
- `apps/web/src/app/canvas/components/chat/ChatPanel.tsx`（Agent 消息 UI）

**要改的文件**：
- `StarCanvas.tsx`：添加模式切换按钮（Ask/Max/Preview）
- `ChatPanel.tsx`：Ask 模式下显示计划确认 UI
- `canvasStore.ts`：`setAgentMode` 已存在，需增强
- `useChatSSE.ts`：根据 agentMode 改变行为

**要新增的 components**：
- `AgentPlanConfirm.tsx`：计划确认面板
- `ModeSwitcher.tsx`：Ask/Max/Preview 切换器

**风险**：Agent 计划解析可能不准确 → 解决：JSON Schema 校验计划格式

---

（第三阶段到第六阶段的详细工程路线见完整规划文档第二部分）

---

## SECTION 10：第一步建议

### 第一阶段最应该先做的 3 个功能（按优先级排序）

#### 1. Slash 命令完整实现 + 基础 Agent actions 执行
- **为什么**：这是用户与 AI 交互的主要方式；TapNow 的核心差异化体验
- **涉及文件**：`ChatInput.tsx`、`slashCommandData.ts`、`StarCanvas.tsx`、`canvasStore.ts`
- **最小验收标准**：
  1. 在 ChatInput 中输入 `/`，出现命令菜单
  2. 用键盘 ↑↓ 选择，Enter 确认
  3. 选择 `/生成分镜` 后，画布自动创建 3-5 个 StoryboardShotNode
  4. 所有操作记录在 Source Trace（控制台）

#### 2. StoryboardShotNode 完整实现
- **为什么**：这是星轨画布与 TapNow 最大的差异化功能；分镜是影视创作的核心
- **涉及文件**：`packages/canvas/src/nodes/StoryboardShotNode.tsx`（已创建壳，需完善 UI）、`packages/canvas/src/nodes/index.ts`
- **最小验收标准**：
  1. 从节点面板拖拽或 AI 创建 StoryboardShotNode
  2. 节点显示所有分镜字段（景别、机位、焦段、运动、描述...）
  3. 节点内有关键操作按钮（重新生成图、AI 改写、拆分）
  4. 右键菜单包含分镜专用操作

#### 3. Agent Ask 模式（计划 → 确认 → 执行）
- **为什么**：Ask 模式是安全使用 AI 的基础；防止误操作；TapNow 有类似能力
- **涉及文件**：`ChatPanel.tsx`、`StarCanvas.tsx`、`canvasStore.ts`
- **最小验收标准**：
  1. ChatPanel 头部有模式切换（Ask/Max/Preview）
  2. Ask 模式下，Agent 返回计划（文字描述 + 将创建的节点列表）
  3. 用户点击「确认执行」后，节点才被创建
  4. 可点击「取消」中止

---

### 开始写代码前还需要确认什么

1. **AI API Key**：当前用的是 mock 模式，真实 AI 生成需要 `OPENAI_API_KEY`（或兼容接口）。你是否已配置？如果没有，MVP 阶段可以继续用 mock + 模拟数据。
2. **图片生成服务**：TapNow 支持 Midjourney、DALL-E、Stable Diffusion。星轨 MVP 应该先接哪个？
3. **StoryboardShotNode 的字段**：我上面列的字段是否符合你的分镜工作流？有没有需要增删的？
4. **DrawNode 技术方案**：推荐 tldraw 嵌入，你是否同意？还是倾向其他方案（Fabric.js、原生 Canvas）？

---

## 方向确认

> 星轨画布的目标是完整达到 TapNow 的全部实用功能，并在此基础上升级为支持手绘、分镜、导演级 AI Agent 和多模态创作流程的 AI 原生创意画布。
