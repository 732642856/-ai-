# OPEN_CANVAS_REFERENCE_AUDIT

日期：2026-05-25  
项目：StarCanvas / 星轨画布  
阶段：P4C 前置审计  
结论：本轮不写业务代码，先用开源画布项目校准 P4C 的产品与工程方案。

---

## 1. 本轮问题

StarCanvas 已完成 P4B：用户可以在 `content/storyboard` 节点里点击「AI 生成文字分镜」，复用 `/api/ai/chat` 与 `split-storyboard` 自动生成 ShotNode。

但用户纠正了一个更关键的产品语义：

```text
错误链路：一句想法 → 直接生成文字分镜 → ShotNode
正确链路：一句想法 → 完整故事 → 文字分镜 → ShotNode
```

同时，当前文字节点仍偏固定输入框体验：

```text
节点尺寸靠默认值或手动 resize
长文本不能自然铺开浏览
编辑态和阅读态没有明确区分
故事 / 文字分镜这种文档型内容被塞在小 textarea 里
```

P4C 若继续就地硬改，容易把自由画布做成表单集合。因此需要先参考成熟开源画布项目。

---

## 2. 审计目标

本轮目标不是实现 P4C，而是回答这些设计问题：

1. 长文本节点如何自适应尺寸？
2. 文档型节点如何在无限画布上浏览？
3. 节点内容如何区分编辑态 / 阅读态？
4. 大文本节点应该自动撑高、内部滚动，还是折叠展开？
5. 文本节点是否应采用固定宽度 + 高度自增？
6. 节点 resize 后如何同步内部布局和连接线？
7. 画布节点如何表达 `Idea → Story → Storyboard → Shot` 创作链路？
8. AI 节点如何展示输入、输出、运行中、失败状态？
9. 哪些交互模式可以直接迁移到 StarCanvas？
10. 哪些东西不适合照搬？

---

## 3. 参考项目清单

| 项目 | 类型 | 本轮关注点 |
|---|---|---|
| tldraw | 无限画布 / 白板 SDK | text shape、auto-size、fixed-width、编辑态、resize |
| Excalidraw | 白板工具 | 文本容器、轻量 UI、箭头绑定、自动尺寸 UX 陷阱 |
| React Flow / XYFlow | 节点画布库 | NodeResizer、NodeResizeControl、custom node、handles |
| AFFiNE / BlockSuite | 文档 + Edgeless 画布 | 文档块、长文本、block/view 分离、edgeless text |
| Flowise / Langflow / Dify | AI workflow 画布 | AI 节点输入输出、运行状态、日志、错误与 trace |

---

## 4. tldraw 审计

### 4.1 可借鉴点

#### A. Text shape 有两种尺寸模式

tldraw 文本 shape 通过 `autoSize` 区分两种模式：

```text
auto-size：宽度随内容增长，不自动换行，适合标签、标题、短注释。
fixed-width：宽度固定，文本自动换行，高度随内容增长，适合段落、长描述、callout。
```

这直接对应 StarCanvas：

```text
Idea 节点：短文本，可轻量 auto-size / 小卡片。
Story 节点：长文本，fixed-width + height grows。
Storyboard Text 节点：长结构化文本，fixed-width + height grows。
ShotNode：结构化卡片，不应无限撑高。
```

#### B. 点击创建短文本，拖拽创建固定宽文本

tldraw 中：

```text
点击画布 → 创建 auto-sized text。
横向拖拽 → 创建 fixed-width text，拖拽距离决定宽度。
```

StarCanvas 不一定照搬创建方式，但应借用心智：

```text
短文本是轻便便签。
长文本是固定宽文档块。
```

#### C. 编辑态与选择态分开

tldraw 支持：

```text
双击文本 / 选中后 Enter → 进入编辑态
Escape / Cmd+Enter → 退出编辑态
```

这对 StarCanvas 很关键。当前 `ContentNode` 默认就是 textarea，点击节点与编辑文本混在一起，导致：

```text
画布选择、拖拽、文字编辑三者容易冲突。
```

P4C 应考虑：

```text
阅读态：展示完整文本，适合浏览和移动。
编辑态：textarea 或轻编辑器，适合修改。
```

#### D. resize 语义清楚

tldraw 的文本 resize 不是一锅粥：

```text
左右边缘拖拽：调整宽度；auto-size 转 fixed-width；高度重新测量。
角点拖拽：整体 scale。
```

StarCanvas P4C 可以先只做：

```text
左右/整体宽度 resize → 固定宽度变更 → 高度按内容重新估算。
```

暂不做复杂 scale。

#### E. 空文本退出编辑态可自动清理

tldraw 退出编辑态时，如果文本为空，会删除空 shape，避免画布垃圾。

StarCanvas 不应对 AI 入口节点直接自动删除，但可用于：

```text
普通临时 text 节点
空白 idea 便签
未来快速文本工具
```

### 4.2 关键实现启发

P4C 可引入轻量数据字段，而不是全量 tldraw 模型：

```ts
type TextCanvasMode = "auto" | "fixed-width";
type TextInteractionMode = "view" | "editing";

{
  displayWidth: number;
  displayHeight?: number;
  textCanvasMode?: TextCanvasMode;
  textInteractionMode?: TextInteractionMode;
  autoHeight?: boolean;
  maxAutoHeight?: number;
}
```

渲染层：

```css
fixed-width 长文本：white-space: pre-wrap; overflow-wrap: break-word;
auto 短文本：white-space: pre-wrap，但限制 max-width，避免无限横向增长。
```

### 4.3 不建议照搬

1. 不引入 tldraw 作为底层引擎。
2. 不重写 React Flow 架构。
3. 不上完整 rich text / TipTap。
4. 不做角点 scale 的复杂文本缩放。
5. 不把所有 ContentNode 都改成 tldraw shape。

---

## 5. Excalidraw 审计

### 5.1 可借鉴点

#### A. 文本元素和文本容器要区分

Excalidraw 程序化 API 区分：

```ts
// 独立文本
{ type: "text", x, y, text }

// 图形容器 label
{ type: "rectangle", x, y, label: { text } }
```

StarCanvas 也应区分：

```text
独立文档型文本节点：Idea / Story / Storyboard Text
结构化业务节点里的 label：Shot 标题、edge label、状态标签
```

不要把所有文本都塞进一个泛化 textarea。

#### B. 容器尺寸可由文本驱动

Excalidraw 文档说明：如果文本容器没有提供尺寸，会根据 label 尺寸计算容器大小。

P4C 可借鉴：

```text
AI 生成完整故事后，Story 节点根据文本长度自动更新 displayHeight。
AI 生成文字分镜后，Storyboard Text 节点根据镜头数自动更新 displayHeight。
```

#### C. 箭头绑定和 label 是一等功能

Excalidraw 箭头可以绑定元素，也可以带 label。StarCanvas 当前 React Flow edge 已能连接节点，但语义标签还不够产品化。

P4C/P5 可考虑：

```text
Idea → Story：edge label = 生成故事
Story → Storyboard Text：edge label = 生成文字分镜
Storyboard Text → Shot：edge label = 拆分镜头
```

这比只有线更利于用户理解创作链路。

#### D. 自动尺寸有 UX 陷阱

Excalidraw issue #4450 反映一个关键问题：

```text
文本编辑自动改变形状大小，可能违背用户对形状尺寸的控制感。
```

因此 StarCanvas 不应无脑自动撑高所有节点。应区分：

```text
文档型节点：允许内容驱动高度。
结构化卡片节点：保持稳定卡片，内部滚动或展开。
用户手动 resize 后：尊重用户尺寸，不再强制覆盖。
```

### 5.2 不建议照搬

1. 不照搬手绘风格。
2. 不把 AI 节点做成纯白板 shape。
3. 不让所有容器被文本强制撑开。
4. 不用导出图片替代结构化节点数据。

---

## 6. React Flow / XYFlow 审计

### 6.1 可借鉴点

StarCanvas 当前技术栈就是 React Flow，因此这里最有工程价值。

#### A. NodeResizer 适合 MVP

React Flow 官方 `<NodeResizer />` 可直接放在自定义节点内部：

```tsx
<NodeResizer minWidth={100} minHeight={30} />
```

当前 `ContentNode` 和 `ShotNode` 已经使用 NodeResizer，并且只在 selected 时显示，这是正确方向。

#### B. 可设置 resize 约束

可用 props：

```text
minWidth / minHeight / maxWidth / maxHeight
keepAspectRatio
autoScale
shouldResize
onResizeStart / onResize / onResizeEnd
```

P4C 需要用 resize 生命周期做两件事：

```text
1. 用户手动 resize 后，写入 displayWidth/displayHeight 或 textLayout.userResized。
2. 如果用户手动定高，后续 AI 自动高度不要强行覆盖。
```

#### C. NodeResizeControl 可用于后续定制

MVP 继续用 NodeResizer。后续若需要 Apple / Jobs 极简风格控制点，再换 NodeResizeControl。

#### D. handles 与节点尺寸联动

如果 handle 固定在节点边缘，简单 resize 通常可用。若 handle 数量或位置随内容变化，应关注 `useUpdateNodeInternals()`。

P4C 初版不建议动态改变 handle 数量，只改变节点高度，降低风险。

### 6.2 StarCanvas 当前差距

当前 `ContentNode.tsx`：

```text
- 节点默认 width=420。
- displayHeight 有值时固定高度。
- 没有 displayHeight 时 textarea 自己 autoResize 到 maxHeight=420。
- 外层节点并不会真正根据内容自动写入 displayHeight。
- 默认就是编辑态 textarea，没有阅读态。
- AI 生成文字分镜后立即 split，缺少完整 Story 中间节点。
```

当前 `ShotNode.tsx`：

```text
- 固定 340×360。
- 内部区域 overflow-y-auto。
- 三段式结构合理。
- 不适合作为无限撑高节点。
```

当前 `CanvasNodeData`：

```text
- 已有 displayWidth/displayHeight。
- 暂无 text layout / contentRole / editingMode 字段。
```

### 6.3 不建议照搬

1. 不要以为 NodeResizer 解决长文本体验，它只解决外框尺寸。
2. 不要把运行态直接和布局态混在一个字段里。
3. 不要在 P4C 动态改变大量 handles。

---

## 7. AI Workflow 项目审计：Flowise / Langflow / Dify

### 7.1 可借鉴点

#### A. AI 节点是可执行能力单元

Flowise 将 AI workflow 组织为 Assistant、Chatflow、Agentflow。其启发是：

```text
节点不只是 UI 卡片，而是有输入、输出、配置、运行状态的能力单元。
```

StarCanvas 已有 `runMeta` 六态模型，这是好基础。

#### B. 输入 / 输出分区

AI workflow 节点通常区分：

```text
输入：prompt、上下文、素材、上游结果
配置：model、参数、工具
输出：文本、图片、日志、错误
```

P4C 的 Story 节点不应只有一个混合 textarea，而应至少在语义上区分：

```text
seed idea
full story output
storyboard text output
```

但 UI 不必一次做成复杂表单。

#### C. 运行状态、错误和日志要节点级展示

Flowise/Dify 强调 execution logs、visual debugging、trace。StarCanvas 当前有 `NodeRunStatusIndicator` 和 `runMeta`，但 P4B 的一键按钮使用局部 `isGenerating`，没有写入统一 runMeta。

P4C 可以逐步统一：

```text
生成故事：runMeta.running → succeeded/failed
生成文字分镜：runMeta.running → succeeded/failed
错误显示在节点内，同时保留原文本
```

#### D. 不要过早上完整 Agentflow

Flowise 的 Agentflow 很强，但 P4C 只需要线性创作链路：

```text
Idea → Story → Storyboard Text → Shot
```

暂不需要分支、循环、复杂工具、MCP 节点。

### 7.2 不建议照搬

1. 不引入完整 workflow engine。
2. 不复制低代码节点库。
3. 不把 trace/log 全塞进节点本体。
4. 不在 P4C 做多 Agent。

---

## 8. 文档白板项目审计：AFFiNE / BlockSuite / AppFlowy

### 8.1 可借鉴点

#### A. 文档和画布可以共享 block 思想

AFFiNE 文档说明：

```text
写文章时，每一行是 block。
在 edgeless canvas 中，一个 shape 也是 block。
block 是抽象数据，用户看到的是不同 view。
```

这对 StarCanvas 很关键：

```text
完整故事不应该只是 textarea 字符串。
它应该是画布上的文档块 view。
```

P4C 可先用轻量纯文本实现文档块，不引入完整 block editor。

#### B. 长文本应该像 document block，而不是小节点

Story / Storyboard Text 更接近文档块：

```text
可阅读
可编辑
可连接
可被拆分
可作为下游生成输入
```

这和 ShotNode 不同。ShotNode 是结构化镜头卡片。

#### C. Edgeless text block 是几何元素

BlockSuite 的 `EdgelessTextBlockModel` 继承图形块模型，并实现几何接口。这说明文档型文本在画布上也应有：

```text
坐标
宽高
颜色/样式
选择边界
连接/几何能力
```

StarCanvas 已有 React Flow node 的位置和宽高基础，可轻量实现。

### 8.2 不建议照搬

1. 不引入完整 BlockSuite。
2. 不把 StarCanvas 改成文档编辑器。
3. 不在 P4C 做多 block 富文本、协作、复杂引用。
4. 不把每一段都拆成独立 React Flow 节点，否则画布会爆炸。

---

## 9. StarCanvas 当前实现差距

### 9.1 `ContentNode.tsx`

当前状态：

```text
- 一个组件同时承担 text / prompt / storyboard。
- 默认就是 textarea 编辑态。
- storyboard 节点底部有“AI 生成文字分镜”按钮。
- 按钮当前直接 idea → storyboard text → split Shot。
- 无完整 Story 中间层。
- 无阅读态。
- 长文本只在 textarea 内滚动，不会自然撑开节点。
- NodeResizer 已有，但没有 resize 生命周期持久化策略。
```

关键问题：

```text
ContentNode 目前是输入框，不是文档型画布节点。
```

### 9.2 `ShotNode.tsx`

当前状态：

```text
- 结构化三段式 UI：剧本文本 / 生图 Prompt / 输出状态。
- 固定卡片尺寸 + 内部滚动。
- 有生成图片按钮和 slash command。
```

判断：

```text
ShotNode 不应该走长文本自动撑高路线。
它应该保持稳定卡片，允许局部滚动/展开。
```

### 9.3 `StarCanvas.tsx`

当前状态：

```text
- NODE_DEFAULT_SIZE.content = 420×360。
- 新建 content/storyboard 节点标题为“AI 文字分镜”。
- 已有 split-storyboard 事件监听和 Shot 拆分链路。
```

差距：

```text
缺少 Idea → Story → Storyboard Text 的中间节点创建逻辑。
缺少 Story 节点 / StoryboardText 节点的布局策略。
缺少边语义 label 或 relation 显性表达。
```

### 9.4 `CanvasNodeData`

已有：

```ts
displayWidth?: number
displayHeight?: number
runMeta?: NodeRunMeta
content?: string
prompt?: string
nodeKind?: CanvasNodeKind
```

缺少：

```ts
contentRole?: "idea" | "story" | "storyboard-text"
textLayout?: {
  mode: "auto" | "fixed-width"
  autoHeight: boolean
  userResized?: boolean
  maxAutoHeight?: number
  collapsed?: boolean
}
sourceIdeaNodeId?: string
sourceStoryNodeId?: string
```

这些字段不一定一次全加，但 P4C 方案应围绕这些语义设计。

### 9.5 `slashCommands/*`

当前状态：

```text
- generate-storyboard-text 仍是从创意/剧情直接生成文字分镜。
- runGenerateTextStoryboardCommand 成功后立即 triggerSplitStoryboard。
```

差距：

```text
命令语义与用户纠正后的链路不一致。
应拆为：generate-full-story、story-to-storyboard-text、split-storyboard。
```

---

## 10. 可直接迁移的交互模式

### 10.1 fixed-width + height grows

直接采用 tldraw fixed-width 思路：

```text
Story / Storyboard Text 节点固定宽度。
文本自动换行。
节点高度根据内容增长。
超过最大高度再内部滚动或折叠。
```

推荐初始值：

```text
Story 节点宽度：560-680
Storyboard Text 节点宽度：620-760
最小高度：260
自动高度上限：900-1200
```

### 10.2 阅读态 / 编辑态分离

P4C 最好引入轻量状态：

```text
阅读态：div 渲染 pre-wrap 文本，节点可拖拽、连接、选择。
编辑态：textarea，禁用拖拽，支持 / 命令。
```

进入方式：

```text
双击正文 / 点击编辑按钮 → 编辑态
Esc / Cmd+Enter / 失焦保存 → 阅读态
```

MVP 可以先做：

```text
story/storyboard 长文本节点默认阅读态；点击“编辑”才显示 textarea。
```

### 10.3 用户手动 resize 后尊重用户尺寸

借鉴 Excalidraw issue 的教训：

```text
自动高度只在系统生成内容时触发。
用户手动 resize 后设置 userResized=true。
后续不要强制覆盖 displayHeight，除非用户点击“适应内容”。
```

### 10.4 AI 输出先成为画布节点，再进入下一步

P4C 推荐链路：

```text
IdeaNode
  → AI 生成完整故事
StoryNode
  → 根据故事生成文字分镜
StoryboardTextNode
  → 拆成 Shot
ShotNode[]
```

不要再直接：

```text
IdeaNode → ShotNode[]
```

### 10.5 节点关系显性化

边 relation 建议：

```text
idea-to-story
story-to-storyboard-text
storyboard-text-to-shot
generated-image
storyboard-composite
```

UI 可先不显示 label，但数据关系应先写清楚。

### 10.6 AI 运行状态统一

P4C 应逐步减少局部 `isGenerating` 的孤岛状态，将节点生成状态写入：

```ts
runMeta: {
  runStatus: "running" | "succeeded" | "failed";
  message?: string;
  error?: string;
  source?: "ai";
}
```

---

## 11. 不建议迁移的部分

1. 不引入 tldraw 作为底层画布。
2. 不引入 Excalidraw 手绘风 UI。
3. 不引入完整 BlockSuite / AFFiNE 编辑器。
4. 不引入完整 TipTap / ProseMirror 富文本。
5. 不复制 Flowise / Dify 的完整 workflow engine。
6. 不在 P4C 做 Agent、多模型参数面板、复杂工具调用。
7. 不把长故事拆成每段一个 React Flow 节点。
8. 不让所有节点都自动无限撑高。
9. 不覆盖用户手动 resize 的尺寸意图。
10. 不绕开现有 `split-storyboard` 和 edge relation 创建逻辑。

---

## 12. P4C 推荐方案

### 12.1 P4C 名称

```text
P4C：Idea → Story → Storyboard Text 自适应文本画布
```

### 12.2 核心产品链路

```text
用户输入一个想法
↓
点击「AI 生成完整故事」
↓
创建 / 更新 Story 文档节点，节点自动按文本高度展开
↓
点击「根据故事生成文字分镜」
↓
创建 / 更新 Storyboard Text 文档节点，节点自动按镜头文本高度展开
↓
用户确认后点击「拆成 Shot」
↓
复用既有 split-storyboard，生成 ShotNode
```

MVP 不建议自动一口气拆 Shot。原因：

```text
用户需要先浏览完整故事和文字分镜，确认后再拆。
这更符合创作工具，而不是生成黑盒。
```

### 12.3 节点类型策略

不建议立刻新增 React component。建议先复用 `ContentNode`，但增加语义字段：

```ts
contentRole?: "idea" | "story" | "storyboard-text";
```

显示名：

```text
contentRole=idea：故事想法
contentRole=story：完整故事
contentRole=storyboard-text：文字分镜
```

如果后续 ContentNode 过重，再拆：

```text
DocumentTextNode
StoryboardTextNode
```

### 12.4 文本尺寸策略

采用 tldraw 思路的简化版：

```text
Idea：小卡片，宽 420，高 240-360。
Story：fixed-width + height grows，宽 640，最大自动高 1000。
Storyboard Text：fixed-width + height grows，宽 720，最大自动高 1100。
ShotNode：固定卡片 + 内部滚动，不自动无限撑高。
```

高度估算 MVP：

```ts
estimatedLines = sum(wrappedLinesByCharCount)
height = clamp(minHeight, estimatedLines * lineHeight + chromeHeight, maxAutoHeight)
```

先用纯函数估算，不引入 DOM measure / canvas measure。

### 12.5 阅读态 / 编辑态

P4C MVP 建议：

```text
Story / Storyboard Text 默认阅读态。
双击正文或点击“编辑”进入编辑态。
编辑态使用 textarea。
退出编辑保存文本并重新估算高度。
```

普通 idea 节点可以继续偏编辑态，但生成后 Story/Storyboard Text 应以阅读为主。

### 12.6 按钮策略

`contentRole=idea`：

```text
AI 生成完整故事
```

`contentRole=story`：

```text
根据故事生成文字分镜
```

`contentRole=storyboard-text`：

```text
拆成 Shot
```

不要再用一个「AI 生成文字分镜」覆盖全部阶段。

### 12.7 生成策略

新增共享命令函数，而不是把逻辑写在组件里：

```text
runGenerateFullStoryCommand
runGenerateStoryboardFromStoryCommand
```

复用：

```text
/api/ai/chat
runSlashTextCommand 或其底层 fetch
```

### 12.8 Edge / relation 策略

创建节点时建立：

```text
Idea → Story：relation idea-to-story
Story → Storyboard Text：relation story-to-storyboard-text
Storyboard Text → Shot：relation storyboard-shot 或 storyboard-text-to-shot
```

### 12.9 持久化策略

只新增文本和尺寸字段，不涉及图片：

```text
不会产生 blob/data:image/base64 风险。
```

注意：尺寸字段进入 localStorage 是正常的轻量 metadata。

---

## 13. P4C 预计改动文件

本轮不改代码。若进入 P4C，预计涉及：

```text
apps/web/src/app/canvas/components/canvas/types.ts
apps/web/src/app/canvas/components/nodes/ContentNode.tsx
apps/web/src/app/canvas/StarCanvas.tsx
apps/web/src/lib/slashCommands/slashCommands.ts
apps/web/src/lib/slashCommands/runSlashTextCommand.ts
apps/web/src/lib/slashCommands/runGenerateTextStoryboardCommand.ts 或新文件
apps/web/src/lib/storyboard/layoutStoryboardShots.ts
apps/web/src/lib/storyboard/* 新增文本尺寸估算 helper
apps/web/src/lib/slashCommands/*.test.ts
```

建议新增纯函数测试：

```text
estimateTextNodeSize.test.ts
generateStoryCommand.test.ts
generateStoryboardFromStoryCommand.test.ts
```

---

## 14. 风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 自动撑高导致画布失控 | 长故事可能生成很高节点 | 设置 maxAutoHeight，超出后内部滚动 / 折叠 |
| 用户 resize 被覆盖 | AI 生成后自动高度覆盖用户手动尺寸 | userResized=true 后不自动覆盖 |
| 编辑态与拖拽冲突 | textarea 抢事件，画布无法拖 | 阅读态/编辑态分离，编辑态加 nodrag/nopan |
| React Flow handle 位置异常 | 动态高度后连接线不更新 | 初版 handle 固定边缘；必要时用 updateNodeInternals |
| ShotNode 被误做成长文档 | Shot 是结构化卡片 | Shot 保持固定尺寸 + 内部滚动 |
| 命令语义混乱 | 旧 generate-storyboard-text 直达 Shot | 拆成 generate-full-story / story-to-storyboard-text / split |
| 内容生成失败 | 清空原文本或生成半成品节点 | 失败保留原文本，不创建下游节点 |
| P4C 范围膨胀 | 引入富文本、Agent、参数面板 | 严格纯文本 MVP，不新增依赖 |

---

## 15. 验证方式

### 自动验证

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web typecheck
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

### 纯函数测试建议

```text
1. estimateTextNodeSize：短文本、小故事、长故事、分镜文本高度估算正确。
2. generateFullStory prompt：从 idea 生成完整故事，不生成分镜。
3. storyToStoryboard prompt：从完整故事生成结构化文字分镜。
4. 空文本保护：按钮 disabled / command 抛明确错误。
5. userResized=true 时不覆盖 displayHeight。
```

### 手动验收建议

```text
A. 创建 Idea 节点，输入一句想法。
B. 点击 AI 生成完整故事。
C. 画布上出现 Story 节点，内容完整可读，节点自动撑高。
D. 点击根据故事生成文字分镜。
E. 画布上出现 Storyboard Text 节点，内容按镜头结构可读。
F. 点击拆成 Shot。
G. ShotNode 按顺序排列，尺寸稳定，不拥挤。
H. 手动 resize Story 节点后，再编辑文本，不应强行覆盖用户尺寸。
I. 失败时保留原节点文本，不创建半成品下游节点。
```

---

## 16. 最终结论

OPEN_CANVAS_REFERENCE_AUDIT 的结论是：

```text
StarCanvas 不应该继续把长文本塞进固定 textarea。
P4C 应采用 tldraw 的 fixed-width + height grows 思路，结合 AFFiNE 的 document block 心智，在 React Flow 现有节点体系内做轻量实现。
```

P4C 不应照搬任何一个项目，也不应重写底层画布。最小正确方案是：

```text
1. 修正产品链路：Idea → Story → Storyboard Text → ShotNode。
2. Story / Storyboard Text 作为文档型文本节点，固定宽度，高度随内容增长。
3. 引入阅读态 / 编辑态分离。
4. ShotNode 保持结构化卡片，不无限撑高。
5. 按钮语义拆成：生成完整故事、根据故事生成文字分镜、拆成 Shot。
6. 所有下游生成继续复用现有 /api/ai/chat 与 split-storyboard。
```

是否可以进入 P4C：可以，但必须按本报告的最小方案执行，避免引入富文本、Agent、视频、资产库或完整工作流引擎。
