# 星轨画布 Chat ↔ Canvas 交互审计报告

> 日期：2026-05-21
> 目标：让 Chat 能操作画布（创建/修改/连接/运行节点），实现类似 TapNow 的能力

---

## 一、当前 Chat 实现审计

### 1. Chat 组件在哪里？

| 文件 | 职责 |
|------|------|
| `components/chat/ChatPanel.tsx` | Chat 主面板 UI，管理消息列表、会话状态 |
| `components/chat/ChatInput.tsx` | 输入框组件（模型选择、附件、发送） |
| `hooks/useChatSSE.ts` | SSE 流式通信 hook |
| `hooks/useChatAttachments.ts` | 附件管理 hook |
| `api/ai/chat/stream/route.ts` | 后端 AI 聊天路由 |

### 2. Chat 输入如何发送给 AI？

```
用户输入 → ChatPanel.handleSend() 
  → useChatSSE.sendMessage(message, context)
    → POST /api/ai/chat/stream { message, model, context }
      → route.ts 用 buildSystemPrompt() 构建系统提示
      → 调用 copse.top/v1/chat/completions（SSE流式）
      → 逐字返回 { content: "char" }
```

### 3. AI 返回结果目前是什么格式？

SSE 事件流，每行 `data: { content: "x" }`，最后 `data: { done: true }`。

对于图片模型（gpt-image-2）还有：
- `data: { type: "image_generated", imageUrl, prompt, model }`
- `data: { type: "status", content: "🎨 正在生成..." }`

### 4. 是否只支持纯文本 reply？

**是。** AI 只返回纯文本字符串，追加到 assistant message 的 `content` 字段。
图片生成会附带 `generatedImage` 对象，但无法返回结构化的操作指令。

### 5. 是否支持 tool calling / function calling / actions？

**不支持。** 
- `useChatSSE.ts` 只处理 `parsed.content` 和 `parsed.type === "image_generated"`
- `route.ts` 直接转发 AI 的流式文本，没有解析 action 的逻辑
- 虽然 `types.ts` 已经定义了 `CanvasActionType` 和 `CanvasAction` 接口，但**从未被使用**

### 6. Chat 是否能访问当前画布状态？

**能读取，不能写入。**
- `ChatPanel` 接收 `canvasNodes` prop（所有节点数组）
- `handleSend()` 构建 `canvasContext`，包含：
  - `selectedNodeId` — 当前选中节点 ID
  - `selectedNode` — 选中节点的完整数据快照
  - `nodes` — 所有节点数据（最多30个）
  - `mentionedNodes` — 被 @ 提到的节点
  - `canvasStats` — 统计信息
  - `attachments` — 附件信息
- 这些数据只作为 system prompt 的上下文发给 AI，AI 只能"看到"但无法"操作"

### 7. Chat 是否能访问当前选中节点？

**能读取。** `selectedNode` 通过 props 传入，数据发送给 AI。

### 8. Chat 是否能引用节点 ID？

**能传递给 AI，但 AI 回复中不会携带可执行的节点操作。** AI 可能说"我帮你修改节点 xxx"，但实际不会执行任何操作。

### 9. Chat 回复是否可以携带按钮或操作建议？

**目前没有。** 回复只有纯文本气泡 + 图片 + 复制/赞/踩按钮。

---

## 二、当前画布状态管理审计

### 1-2. 节点和连线数据存在哪里？

| 数据 | 存储位置 | 类型 |
|------|----------|------|
| 节点 | `StarCanvas` 的 `useNodesState()` | React Flow 的 Node[] |
| 连线 | `StarCanvas` 的 `useEdgesState()` | React Flow 的 Edge[] |

**注意：** 节点和连线数据存在 `StarCanvasInner` 组件的局部 state 中，不在 Zustand store 里。
Zustand store (`canvasStore.ts`) 只管理 viewport、selection、contextMenu、assetLibrary 等全局状态。

### 3-7. 节点操作方式

| 操作 | 实现位置 | 方式 |
|------|----------|------|
| 创建节点 | `StarCanvas` 各处 | `setNodes(nds => [...nds, newNode])` |
| 更新节点 | `useWorkflowRunner.updateNodeData()` | `setNodes(nds => nds.map(...))` |
| 删除节点 | `StarCanvas.handleDeleteNode()` | `setNodes(nds => nds.filter(...))` |
| 连接节点 | `StarCanvas.onConnect()` | `setEdges(eds => addEdge(..., eds))` |
| 选中节点 | `onSelectionChange` → `setSelectedNodeId()` | Zustand store |

### 8. 如何移动视口定位节点？

`reactFlowInstance.fitView()` 或 `reactFlowInstance.setViewport()`，
通过 `screenToFlowPosition()` 计算位置。

### 9. 是否有统一的 canvas store？

**没有。** 
- UI 状态（viewport/selection/menu）→ Zustand `canvasStore`
- 节点/连线数据 → React Flow 的 `useNodesState/useEdgesState`（局部 state）
- 工作流执行 → `useWorkflowRunner` hook

**这是最大的架构问题：** ChatPanel 无法直接操作节点/连线，因为这些操作都封装在 `StarCanvasInner` 内部。

---

## 三、当前节点执行能力审计

### 1. 是否已有 run node 的逻辑？

**有。** `useWorkflowRunner` 可以按工作流顺序执行节点链。

### 2. 是否有节点状态 idle/running/done/error？

**有。** `CanvasNodeData.status?: WorkflowNodeStatus`，值为 `"draft" | "ready" | "running" | "done" | "error"`。
但只有 WorkflowNode 节点显示状态，普通 content/image 节点没有运行按钮。

### 3. 是否有异步任务系统？

**没有。** 没有任务队列、没有并发控制、没有进度回调。`useWorkflowRunner` 是同步循环。

### 4-5. 是否有生图/视频节点？

- **生图：** 有。`/api/ai/generate-image` 路由 + ImageNode 内的 AI 输入栏 + StarCanvas.handleAIVariant()
- **视频：** 有类型定义（`video-generation`, `video-result`），但**没有实际实现**

### 6. 是否有 API service 层？

**没有统一的 service 层。** API 调用分散在各处：
- `generate-image/route.ts` — 图片生成
- `chat/stream/route.ts` — 聊天 + 图片生成（双端点）
- `ContentNode.tsx` 内直接 fetch
- `ImageNode.tsx` 内直接 fetch
- `useWorkflowRunner` 内直接 fetch

---

## 四、为什么 Chat 现在不能操作画布

### 缺少的桥接层

| # | 缺少什么 | 说明 |
|---|---------|------|
| 1 | **CanvasActionExecutor** | 没有一个统一的执行器来处理"创建节点"、"连接节点"等操作 |
| 2 | **AI Action Schema** | AI 不知道应该返回什么格式的结构化指令 |
| 3 | **Action Parser** | 没有从 AI 回复中提取结构化 action 的解析器 |
| 4 | **Canvas Bridge API** | ChatPanel 没有 `onAction` callback 来通知画布执行操作 |
| 5 | **Canvas Store 扩展** | 节点/连线操作没有从 StarCanvas 暴露到外部可调用的接口 |
| 6 | **Action Confirmation** | 没有确认/拒绝机制（危险操作需要用户确认） |

### 根本原因

```
ChatPanel (右侧面板)
  ↓ 只读取 nodes 数据
  ↓ 没有回调可操作 nodes/edges
StarCanvasInner (画布主组件)
  ↓ nodes/edges 是 useNodesState/useEdgesState 局部 state
  ↓ 所有操作函数都是 useCallback 闭包
  ↓ 无法从外部调用
```

**问题本质：** ChatPanel 是 StarCanvas 的子组件，但它的 props 里只有 `onAddImageToCanvas`（添加图片到画布），没有通用的画布操作接口。

---

## 五、最小改造方案

### 目标能力

1. ✅ 读取当前选中节点（**已实现**）
2. 🆕 根据用户指令生成一个 TextNode
3. 🆕 更新当前选中节点内容
4. 🆕 创建一个 ImageGenerationNode 并连接
5. 🆕 运行 ImageGenerationNode 生图

### 架构设计

```
用户输入 → ChatPanel.handleSend()
  → POST /api/ai/chat/stream (附带 canvas context)
  → AI 返回: 纯文本 + [可选] JSON action block
  → useChatSSE 解析:
    - 文本部分 → 显示在气泡
    - action 部分 → 传给 onAction 回调
  → ChatPanel.onAction(actions)
  → StarCanvas.executeActions(actions)
    - create_node → setNodes(...)
    - update_node → setNodes(nds.map(...))
    - connect_nodes → setEdges(...)
    - generate_image → fetch API + setNodes(...)
```

### 推荐新增文件

| 文件 | 职责 |
|------|------|
| `hooks/useCanvasActions.ts` | 统一的画布操作 hook，封装 create/update/delete/connect/fitView |
| `types/canvasAction.ts` | Action 类型定义（已有雏形在 types.ts，需扩展） |

### 推荐修改文件

| 文件 | 改动 |
|------|------|
| `components/chat/ChatPanel.tsx` | 新增 `onAction` callback prop，显示 action 确认/结果 |
| `hooks/useChatSSE.ts` | 新增 `onAction` 回调，解析 AI 回复中的 action JSON |
| `api/ai/chat/stream/route.ts` | 修改 system prompt，告知 AI 可用的 action schema；解析 action |
| `StarCanvas.tsx` | 新增 `executeActions()` 函数，从 `useCanvasActions` 获取操作方法，传给 ChatPanel |
| `types.ts` | 扩展 `CanvasAction` 接口 |

### AI Action Schema 设计

```typescript
// AI 可以返回的结构化 action（嵌入在回复中）
type ChatResponseAction = 
  | { type: "create_node", nodeType: "content"|"image", nodeKind: CanvasNodeKind, title?: string, content?: string, position?: {x:number, y:number} }
  | { type: "update_node", nodeId: string, updates: Partial<CanvasNodeData> }
  | { type: "delete_node", nodeId: string }
  | { type: "connect_nodes", sourceId: string, targetId: string }
  | { type: "select_node", nodeId: string }
  | { type: "generate_image", prompt: string, sourceNodeId?: string, size?: string }
```

### AI 返回格式

```json
{
  "content": "好的，我来帮你创建一个提示词节点，并生成图片。",
  "actions": [
    { "type": "create_node", "nodeType": "content", "nodeKind": "prompt", "title": "角色设计", "content": "一个穿着..." },
    { "type": "connect_nodes", "sourceId": "node-xxx", "targetId": "新生成的节点ID" },
    { "type": "generate_image", "prompt": "角色设计提示词", "sourceNodeId": "新节点ID" }
  ]
}
```

### 实现流程

**方式：两阶段响应**

1. **AI 先思考**（用文本模型 gpt-5.5）→ 返回 `{ content: "解释文字", actions: [...] }`
2. **前端解析 actions** → 用户确认 → 逐个执行
3. **对于 generate_image action** → 前端调用 `/api/ai/generate-image` → 创建结果节点

这样做的优点：
- AI 只负责"决策"，不直接调用图片生成 API
- 前端有完整的控制权（确认、错误处理、状态更新）
- 不需要复杂的 function calling

### 风险点

| 风险 | 等级 | 对策 |
|------|------|------|
| AI 返回格式不稳定 | 高 | 使用 JSON schema 约束 + 解析容错 |
| 危险操作（删除节点）无确认 | 中 | 对 delete 操作强制弹出确认框 |
| Action 执行失败 | 中 | 逐个执行，失败的不影响已完成的 |
| AI 幻觉（引用不存在的 nodeId） | 高 | 执行前验证 nodeId 存在 |
| 打字卡顿（已有问题） | 中 | autoResize 优化 |

### 分阶段实施计划

#### Phase 1：基础设施（1天）
1. 新建 `useCanvasActions` hook — 封装所有画布操作
2. 修改 `StarCanvas.tsx` — 实例化 hook，传入 ChatPanel
3. 修改 `ChatPanel.tsx` — 新增 `onAction` callback prop

#### Phase 2：AI Action Schema（1天）
4. 设计 system prompt — 告知 AI 可用的 action 列表和 JSON 格式
5. 修改 `route.ts` — 解析 AI 回复中的 action JSON
6. 修改 `useChatSSE.ts` — 分离文本和 action

#### Phase 3：核心 Actions（1天）
7. 实现 `create_node` — 创建文本/提示词节点
8. 实现 `update_node` — 更新节点内容
9. 实现 `connect_nodes` — 连接两个节点
10. 实现 `generate_image` — 触发图片生成

#### Phase 4：体验优化（1天）
11. Action 确认 UI — 执行前显示"即将执行的操作"
12. 执行进度反馈 — Chat 中显示执行状态
13. 错误恢复 — 失败时回滚或提示

#### Phase 5：高级能力（2天）
14. `select_node` + `focus_canvas` — 定位到指定节点
15. 批量操作 — 一次创建多个节点
16. 工作流模板 — "帮我建一个分镜工作流"

---

## 六、参考项目 Infinite-Canvas 的启发

| 特点 | Infinite-Canvas 的做法 | 星轨可以借鉴 |
|------|----------------------|-------------|
| **图片生成** | 直接发送中文 prompt 到 API，不翻译 | ✅ copse.top 支持中文，去掉 prompt 增强翻译 |
| **节点类型** | 11种节点，每种有独立 UI | 星轨已有类似设计 |
| **API 调用** | 后端 Python 路由统一调度 | 星轨是 Next.js API route，架构类似 |
| **画布操作** | 纯 DOM + SVG 操作 | 星轨用 React Flow，更高级 |
| **批量生成** | 循环节点 + 并发执行 | 未来可以加入 |
| **确认机制** | 无（直接执行） | 星轨应该加确认 |
