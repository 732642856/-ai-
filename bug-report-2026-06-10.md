# StarCanvas 代码质量检查报告

**检查日期**: 2026-06-10
**技术栈**: Next.js 16 + React 19 + TypeScript + @xyflow/react v12 + Zustand v5 + TailwindCSS v4
**检查范围**: `apps/web/src` + `packages`

---

## 1. TypeScript 类型问题

### BUG-1-1: `any` 类型严重滥用 — useWorkflowRunner.ts
- **文件**: `apps/web/src/app/canvas/hooks/useWorkflowRunner.ts`
- **位置**: L209, L447-448, L452, L460, L462, L479, L506
- **问题描述**: 连续性检查逻辑中大量使用 `any` 类型，包括 `parsed: any`、`parsedScriptData: any`、`shotSequenceData: any`、`(n: any)`、`(nds: any[])` 等，完全丧失了类型安全。
- **严重程度**: P1
- **修复建议**: 定义具体的 script/shot 解析类型接口，如 `ParsedScriptData` / `ShotSequenceData`，替换所有 `any`。

### BUG-1-2: `any` 类型滥用 — StarCanvas.tsx
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L483-484 (node type props), L4339 (`_: any`), L6798 (`(l: any)`)
- **问题描述**: 节点渲染props和回调参数使用 `any`。
- **严重程度**: P1
- **修复建议**: 使用 `@xyflow/react` 的 `NodeProps<CanvasNodeData>` 等具体类型。

### BUG-1-3: `any` 类型滥用 — API 路由
- **文件**: `apps/web/src/app/api/ai/bible-director/route.ts`
- **位置**: L18
- **问题描述**: `const input = body as BibleDirectorInput & { _providerOverrides?: any }`，`_providerOverrides` 使用 `any`。
- **严重程度**: P1
- **修复建议**: 定义 `AiProviderOverrides` 接口替换 `any`。

### BUG-1-4: `any` 类型滥用 — 工具服务
- **文件**: `apps/web/src/app/canvas/utils/ttsService.ts`
- **位置**: L266 (`kokoroTtsInstance: any`), L523 (`shot?: any`), L539 (`characterIdentities?: any[]`)
- **问题描述**: TTS实例和函数参数使用 `any`。
- **严重程度**: P2
- **修复建议**: 定义 `KokoroTtsInstance` 和 `CharacterIdentity` 接口。

### BUG-1-5: 错误捕获块中的 `any` 类型泛滥
- **文件**: 遍布全项目（>30处）
- **位置**: `StarCanvas.tsx`, `useWorkflowRunner.ts`, `imageGeneration.ts`, `videoGenerationService.ts`, `autoAgentService.ts`, `generate-character-view/route.ts` 等
- **问题描述**: 几乎所有 `catch (error: any)` 都使用了 `any` 而非 `unknown` + 类型守卫。
- **严重程度**: P2
- **修复建议**: 统一使用 `catch (error: unknown)`，配合 `error instanceof Error ? error.message : String(error)` 提取错误信息。

### BUG-1-6: 类型断言 `as` 滥用
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L512, L826, L1585, L1854, L1991, L2005, L2081 等
- **问题描述**: 频繁使用 `(node.data || {}) as Record<string, unknown>`、`as Node<CanvasNodeData>[]` 等类型断言。部分可以通过泛型参数或类型守卫避免。
- **严重程度**: P2
- **修复建议**: 优先使用类型守卫函数（如 `isCanvasNodeData`）或泛型约束，减少 `as` 使用。

---

## 2. React 问题

### BUG-2-1: setInterval 缺少 clearInterval cleanup — 内存泄漏
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L625-667
- **问题描述**: `useEffect(() => { const timer = window.setInterval(...) })` 中定义了周期性定时器，但 **没有返回 cleanup 函数** 来 `clearInterval(timer)`。组件卸载后定时器会持续运行，引发内存泄漏和 setState-on-unmounted 风险。
- **严重程度**: P0
- **修复建议**: 在 useEffect 中返回 `() => clearInterval(timer)`。

### BUG-2-2: addEventListener/removeEventListener 函数引用不匹配
- **文件**: `apps/web/src/app/canvas/components/nodes/VideoNode.tsx`
- **位置**: L114-120
- **问题描述**: cleanup 中 `video.removeEventListener("ended", () => setCurrentSubtitle(""))` 使用了新的箭头函数，与 addEventListener 时传入的不是同一个引用，**无法真正移除事件监听器**。
- **严重程度**: P1
- **修复建议**: 将 `ended` 和 `pause` 的 handler 定义为具名函数或常量，确保引用一致。

### BUG-2-3: useCallback 空依赖导致闭包陷阱
- **文件**: `apps/web/src/app/canvas/components/chat/ChatPanel.tsx`
- **位置**: L280
- **问题描述**: `const scrollToBottom = useCallback(() => { ... }, [])` 空依赖，内部引用的 `messagesEndRef` 是稳定的，但如果后续添加其他状态依赖会捕获旧值。
- **严重程度**: P2
- **修复建议**: 确认 `messagesEndRef` 是否足够稳定；如有其他依赖需补充到依赖数组。

### BUG-2-4: useEffect 依赖数组包含不稳定对象引用
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L47-58
- **问题描述**: `useEffect(..., [selectedBibleCharacterId, bibleCharacters])` 依赖 `bibleCharacters` 数组。每次 store 更新（即使无关字段变化）若数组引用改变，会导致 effect 重新运行，频繁 `setEdit`。
- **严重程度**: P1
- **修复建议**: 使用 Zustand 的 selector 仅订阅 `selectedBibleCharacterId`，或在 effect 内部通过 ref 比对实际内容变化。

### BUG-2-5: useEffect 依赖 data 对象字段但传入整个 data
- **文件**: `apps/web/src/app/canvas/components/nodes/ContentNode.tsx`
- **位置**: L304-306
- **问题描述**: `useEffect(() => setEditContent(data.content || data.prompt || ""), [data.content, data.prompt])`。虽然解构了字段，但 `data` 作为 props 每次渲染都是新对象，依赖项若从 `data` 解构在 React 19 中通常安全，但如果父组件传递新引用频繁会导致不必要的 effect 运行。
- **严重程度**: P2
- **修复建议**: 确认父组件是否使用了稳定的 `data` 引用；考虑使用 `useMemo` 稳定 data 对象。

### BUG-2-6: useEffect 依赖大量不稳定函数引用
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L4064-4165
- **问题描述**: settings/event listeners 的 useEffect 依赖了 `workflowRunner` 等对象，若引用不稳定会导致频繁注册/注销事件监听。
- **严重程度**: P2
- **修复建议**: 将事件处理函数提取为 useCallback 稳定引用，或减少 useEffect 的依赖数量。

---

## 3. 逻辑问题

### BUG-3-1: TODO / FIXME 标记
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L7327
- **内容**: `// TODO: 接入真实登录`
- **严重程度**: P2

- **文件**: `apps/web/src/app/canvas/utils/videoGenerationService.ts`
- **位置**: L197
- **内容**: `// TODO: Replace with real API call when API key is configured`
- **严重程度**: P2

### BUG-3-2: 生产环境残留大量 console 语句
- **文件**: 遍布 API 路由和前端组件
- **位置**: 
  - `generate-image/route.ts`: L242, L256, L271-272, L281, L285, L347-368, L388, L395, L406, L411, L422, L446, L461-467, L515（>30处）
  - `focus-edit/route.ts`: L167, L174, L185, L190, L197, L242
  - `chat/stream/route.ts`: L552, L695, L713
  - `generate-with-pose/route.ts`: L150, L242, L303
  - `StarCanvas.tsx`: L2306, L3664, L4601, L4719, L5348, L5633, L6190, L6359, L6611
  - `useWorkflowRunner.ts`: L525, L584, L1088, L1437, L1646, L1708, L1731, L1737
- **问题描述**: API 路由中存在大量 `console.info`/`console.debug` 用于调试，在生产环境会泄露内部状态（如 image URL 前缀、请求体结构、上游 endpoint 等）。
- **严重程度**: P1
- **修复建议**: 使用 logger 工具封装，根据 `NODE_ENV` 自动禁用 debug/info 级别日志。

### BUG-3-3: 未使用变量
- **文件**: `apps/web/src/app/canvas/utils/continuityGuard.ts`
- **位置**: L304
- **问题描述**: `const propPattern = /.../g;` 定义后未使用（实际使用的是 L311 的 `localPattern`）。
- **严重程度**: P2
- **修复建议**: 删除未使用的 `propPattern`。

### BUG-3-4: CSS group-hover 缺少 group 类
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L238
- **问题描述**: `<button className="... opacity-0 group-hover:opacity-100">`，但父级 `<div>` 缺少 `group` 类，hover 时删除按钮永远不会显示。
- **严重程度**: P1
- **修复建议**: 在父级 div 添加 `group` 类，或改用其他交互方式显示删除按钮。

### BUG-3-5: fetch 后未检查响应状态
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L115-124
- **问题描述**: `await fetch("/api/ai/bible-director", ...)` 后直接 `await res.json()`，**未检查 `res.ok`**。如果服务端返回 4xx/5xx，会导致 `data` 解析为错误响应体，后续 `data.parsed` 访问可能产生误导性结果。
- **严重程度**: P1
- **修复建议**: 添加 `if (!res.ok) throw new Error(...)` 检查。

### BUG-3-6: 使用原生 alert() 不符合现代 UI 实践
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L76
- **问题描述**: `alert(\`角色锚点不完整：\n${validation.errors.join("\n")}\`)`
- **严重程度**: P2
- **修复建议**: 使用组件内联错误提示或 toast 通知替代原生 alert。

### BUG-3-7: 非空断言操作符 `!` 滥用
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L417, L425, L433, L448, L456, L464, L472, L488-494, L516 等
- **问题描述**: 六层身份锚点的 onChange 中大量使用 `prev.identityAnchors!` 和 `...prev.identityAnchors!.skeletal` 等非空断言。如果 `identityAnchors` 为 undefined 会运行时崩溃。
- **严重程度**: P1
- **修复建议**: 使用可选链 `?.` 配合默认值，或确保初始化时一定有 `identityAnchors`。

### BUG-3-8: 数组 key 使用索引
- **文件**: `apps/web/src/app/canvas/components/nodes/ContentNode.tsx`
- **位置**: L173
- **问题描述**: `issues.map((issue, idx) => <div key={idx} ...>)`，如果 issues 列表发生排序或增删，React 的 diff 算法可能无法正确复用 DOM。
- **严重程度**: P2
- **修复建议**: 使用 `issue.shotId || issue.sceneId || idx` 作为 key，确保唯一性。

### BUG-3-9: 异步操作中 setNodes 闭包可能捕获旧状态
- **文件**: `apps/web/src/app/canvas/hooks/useWorkflowRunner.ts`
- **位置**: L506-522
- **问题描述**: 在 `executeStep` 的异步流中直接调用 `setNodes(...)` 来更新 `runMeta`。如果此时用户同时触发其他节点更新，setNodes 的函数式更新虽然安全，但 continuity 检查发生在成功回调内部，**没有检查当前组件是否已卸载**。
- **严重程度**: P2
- **修复建议**: 在 executeStep 中维护一个 `isMounted` ref 或 AbortController，组件卸载时跳过后续状态更新。

### BUG-3-10: `process.env.NEXT_PUBLIC_VIDEO_BACKEND as any`
- **文件**: `apps/web/src/app/canvas/hooks/useWorkflowRunner.ts`
- **位置**: L1138
- **问题描述**: 使用 `as any` 绕过类型检查。
- **严重程度**: P2
- **修复建议**: 定义 `VideoBackend` 联合类型，如 `'kling' | 'vidu' | 'mock'`。

---

## 4. 最近添加功能的问题

### BUG-4-1: continuityGuard.ts 正则表达式定义重复
- **文件**: `apps/web/src/app/canvas/utils/continuityGuard.ts`
- **位置**: L304, L311
- **问题描述**: L304 的正则 `propPattern` 未使用，L311 在循环内部定义 `localPattern`。虽然不影响功能，但代码冗余。
- **严重程度**: P2
- **修复建议**: 删除 L304 的未使用变量。

### BUG-4-2: continuityGuard.ts 时间映射不完整
- **文件**: `apps/web/src/app/canvas/utils/continuityGuard.ts`
- **位置**: L243-251
- **问题描述**: `timeOrder` 只有英文键，`chineseTimeOrder` 映射了中文到英文，但如果 `timeOfDay` 传入其他语言或格式（如 `"清晨"` 之外的中文变体），检测会失败。
- **严重程度**: P2
- **修复建议**: 扩展 `chineseTimeOrder` 覆盖更多变体，或添加 fallback 处理。

### BUG-4-3: continuityGuard.ts `collectShotText` 缺少空值保护
- **文件**: `apps/web/src/app/canvas/utils/continuityGuard.ts`
- **位置**: L345-347
- **问题描述**: `collectShotText` 假设 `shot.instructions.fragments` 总是存在。如果上游数据格式不匹配（如 fragments 为 undefined），`.map()` 会抛出异常。
- **严重程度**: P1
- **修复建议**: 使用 `(shot.instructions?.fragments ?? []).map(...)` 进行空值保护。

### BUG-4-4: ContentNode.tsx 的 img 标签缺少 onError
- **文件**: `apps/web/src/app/canvas/components/nodes/ContentNode.tsx`
- **位置**: L949
- **问题描述**: `<img src={data.storyboardOutputImageUrl} alt="分镜图" className="..." />` 如果图片加载失败（URL 过期、网络错误），没有错误处理，会显示破裂图标。
- **严重程度**: P2
- **修复建议**: 添加 `onError` 处理器，加载失败时显示占位图或错误提示。

### BUG-4-5: AddNodePanel.tsx 中 `continuity-report` 节点类型未验证注册
- **文件**: `apps/web/src/app/canvas/components/toolbar/AddNodePanel.tsx`
- **位置**: L283
- **问题描述**: 注册了 `"continuity-report"` 节点 kind，但未在代码中确认对应的 workflow 节点处理逻辑是否已完整实现。
- **严重程度**: P2
- **修复建议**: 确认 `useWorkflowRunner.ts` 和 `canvasStore` 中已处理 `"continuity-report"` 的渲染和执行逻辑。

### BUG-4-6: useWorkflowRunner.ts 中 ContinuityGuard 动态导入错误处理
- **文件**: `apps/web/src/app/canvas/hooks/useWorkflowRunner.ts`
- **位置**: L443-526
- **问题描述**: `await import("../utils/continuityGuard")` 被包裹在 `try-catch` 中，但 catch 只捕获了 guard 运行错误。如果模块加载失败（如网络问题导致 chunk 丢失），错误会被吞掉但用户看不到连续性检查已跳过。
- **严重程度**: P2
- **修复建议**: 将 import 失败和 guard 运行失败的错误分别记录，并在 runMeta 中标记 `continuityChecked: false` 与失败原因。

---

## 5. API 路由问题

### BUG-5-1: `/api/ai/tts` 缺少顶层 try-catch
- **文件**: `apps/web/src/app/api/ai/tts/route.ts`
- **位置**: L64+
- **问题描述**: POST handler 从 L64 开始，L80 解析 body，但整个 handler **没有 try-catch**。如果 `req.json()` 抛出异常（如请求体不是有效 JSON），Next.js 会返回未处理的 500 错误，且没有 SSE 格式的错误响应。
- **严重程度**: P1
- **修复建议**: 将整个 handler 逻辑包裹在 try-catch 中，catch 块返回 SSE 格式的 error 事件。

### BUG-5-2: `/api/ai/bible-director` 输入验证缺失
- **文件**: `apps/web/src/app/api/ai/bible-director/route.ts`
- **位置**: L17
- **问题描述**: `const body = await request.json()` 后没有验证 `body` 的结构，直接 `as BibleDirectorInput`。如果客户端发送恶意/错误结构，可能导致后续逻辑崩溃。
- **严重程度**: P1
- **修复建议**: 使用 Zod 或手动验证 `body.task`、`body.script` 等必填字段。

### BUG-5-3: API 路由中 API 密钥空值未提前拦截
- **文件**: `apps/web/src/app/api/ai/generate-image/route.ts`, `generate-with-pose/route.ts`, `generate-character-view/route.ts`
- **位置**: 各路由顶部常量定义
- **问题描述**: 部分路由在 `API_KEY = process.env.XXX || ""` 后，直到发起 upstream fetch 前才检查空值，但在此之前可能已经进行了大量计算和日志输出。
- **严重程度**: P2
- **修复建议**: 在 handler 入口处优先检查 `!API_KEY`，立即返回 500 配置错误。

### BUG-5-4: `/api/ai/chat/stream` 错误时泄露内部信息
- **文件**: `apps/web/src/app/api/ai/chat/stream/route.ts`
- **位置**: L713
- **问题描述**: `console.error("[Chat SSE Route Error]", error)` 可能将上游 API 的完整错误响应（含敏感信息）打印到服务端日志。
- **严重程度**: P2
- **修复建议**: 日志中只记录脱敏后的错误类型和 message，不直接打印完整 error 对象。

---

## 6. 数据流问题

### BUG-6-1: StarCanvas 全量订阅 Zustand Store 导致不必要重渲染
- **文件**: `apps/web/src/app/canvas/StarCanvas.tsx`
- **位置**: L565-570
- **问题描述**: `const { viewport, setViewport, fitViewOnce, ...bibleCharacters... } = useCanvasStore()` 一次性解构了 store 中几乎所有状态。Zustand v5 虽然支持订阅细粒度更新，但这种全量解构意味着 **任何字段变化都会触发 StarCanvas 重渲染**。
- **严重程度**: P1
- **修复建议**: 使用多个细粒度的 `useCanvasStore(selector)` 调用，或定义稳定的 selector 函数。例如：
  ```ts
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const bibleCharacters = useCanvasStore(s => s.bibleCharacters)
  ```

### BUG-6-2: CharacterBiblePanel 订阅 bibleCharacters 导致频繁重渲染
- **文件**: `apps/web/src/app/canvas/components/panels/CharacterBiblePanel.tsx`
- **位置**: L27-34
- **问题描述**: `const { bibleCharacters, selectedBibleCharacterId, ... } = useCanvasStore()` 订阅了 `bibleCharacters` 数组。如果其他 Bible 相关操作（如更新场景/风格）意外触发了数组引用变化，面板会重渲染。
- **严重程度**: P1
- **修复建议**: 使用 selector 精确订阅所需字段，避免全量解构。

### BUG-6-3: useWorkflowRunner.executeStep 依赖数组包含 updateNodeData
- **文件**: `apps/web/src/app/canvas/hooks/useWorkflowRunner.ts`
- **位置**: L1287
- **问题描述**: `executeStep` 的 `useCallback` 依赖 `[updateNodeData, setNodes, setEdges]`。`updateNodeData` 本身依赖 `setNodes`，引用相对稳定，但每次 `useWorkflowRunner` 重新执行时这些函数引用可能变化，导致 `executeStep` 重建。
- **严重程度**: P2
- **修复建议**: 确认 `setNodes/setEdges` 来自 `@xyflow/react` 的 `useReactFlow()` 是否提供稳定引用；如果稳定则无需改动，否则应使用 `useRef` 缓存。

### BUG-6-4: canvasStore 中状态更新是 immutable 的 — 正确
- **文件**: `apps/web/src/app/canvas/stores/canvasStore.ts`
- **位置**: L176-200
- **问题描述**: 资产库和 Bible 系统的更新使用了展开运算符生成新对象/数组，状态更新是 immutable 的。符合 Zustand 最佳实践。
- **严重程度**: 无问题
- **修复建议**: 无需修复，继续保持。

---

## 汇总统计

| 严重程度 | 数量 |
|---------|------|
| P0 阻塞 | 1 |
| P1 重要 | 16 |
| P2 建议 | 18 |

## 优先修复建议

1. **立即修复 P0**: StarCanvas.tsx 的 setInterval 缺少 cleanup（BUG-2-1）。
2. **本周修复 P1**: 
   - VideoNode 事件监听器移除失败（BUG-2-2）
   - CharacterBiblePanel 的 group-hover 和 fetch 错误处理（BUG-3-4, BUG-3-5）
   - useWorkflowRunner 的 any 类型替换（BUG-1-1）
   - API 路由输入验证和 try-catch（BUG-5-1, BUG-5-2）
   - Zustand 全量订阅导致的重渲染（BUG-6-1, BUG-6-2）
3. **渐进优化 P2**: 清理生产环境 console、any 类型收敛、alert 替换为 UI 提示。
