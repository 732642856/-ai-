# P4C：故事分镜助手节点

日期：2026-05-25

## 1. 本轮目标

根据用户纠正，P4C 不继续粗暴叠加功能，而是把已有 P4B 的“一键文字分镜”改造成更符合创作习惯的阶段式故事分镜助手：

```text
一句想法
→ AI 生成完整故事
→ 根据完整故事生成文字分镜
→ 用户确认后拆成 ShotNode
```

本轮继续遵守：

- 不接新模型
- 不新增依赖
- 不做 Agent
- 不做视频
- 不做资产库
- 不重写画布底层
- 不新增平行入口
- 不新写 Shot 创建逻辑

## 2. 开源参考如何落地

本轮没有忘记 `OPEN_CANVAS_REFERENCE_AUDIT` 的结论，采用了这些参考原则：

### tldraw

采用 `fixed-width + height grows` 心智：

- 想法阶段保持较小卡片。
- 故事 / 文字分镜阶段使用固定宽度，内容越多高度越大。
- 不让长故事继续困在小 textarea 中。

### AFFiNE / BlockSuite

采用 document block 心智：

- 完整故事和文字分镜是画布上的可阅读文本块。
- 它仍然是 React Flow 节点，不引入完整 block editor。

### React Flow

继续使用现有 custom node / `displayWidth` / `displayHeight` / `NodeResizer` 体系。

### Excalidraw

避免粗暴控制：

- 不新增一堆入口和按钮。
- 用户手动 resize 的长期尊重机制留作下一步更精细处理。

## 3. 产品语义调整

之前 P4B 的主链路偏短：

```text
一句想法 → AI 生成文字分镜 → 自动拆 Shot
```

现在 P4C 调整为：

```text
idea 阶段：生成完整故事
story 阶段：生成文字分镜
storyboard-text 阶段：拆成 Shot
```

用户始终只看到一个主按钮，不会同时面对多个重复按钮。

## 4. UI 入口说明

没有新增入口，只改文案：

- 左侧添加节点面板：`AI 生成文字分镜` → `故事分镜助手`
- 画布空白右键：`AI 生成文字分镜` → `故事分镜助手`

入口语义变成：

```text
从一句想法生成完整故事，再生成文字分镜
```

## 5. 节点阶段规则

`content/storyboard` 节点新增轻量阶段字段：

```ts
storyboardAssistantStage?: "idea" | "story" | "storyboard-text"
autoSizeMode?: "auto" | "fixed-width-height-grows" | "manual"
```

不新增 `IdeaNode` / `StoryNode` / `StoryboardTextNode` 三个节点类型，避免重复和粗暴扩张。

## 6. 主按钮显示规则

同一个 `content/storyboard` 节点内只显示一个阶段按钮：

| 阶段 | 标签 | 主按钮 | 行为 |
|---|---|---|---|
| idea | 故事想法 | 生成完整故事 | idea → story |
| story | 完整故事 | 生成文字分镜 | story → storyboard-text |
| storyboard-text | 文字分镜 | 拆成 Shot | 触发既有 split-storyboard |

按钮状态：

- 空文本：disabled
- 生成中：显示对应 loading 文案
- 失败：保留原文本并显示错误

## 7. 执行链路

新增共享执行函数：

```ts
runStoryboardAssistantCommand()
```

行为：

```text
idea:
  buildFullStoryPrompt()
  → /api/ai/chat
  → 更新节点内容为完整故事
  → stage = story
  → 自动计算 displayWidth/displayHeight

story:
  buildStoryToStoryboardPrompt()
  → /api/ai/chat
  → 更新节点内容为文字分镜
  → stage = storyboard-text
  → 自动计算 displayWidth/displayHeight

storyboard-text:
  不调用 AI
  → 触发 starcanvas:split-storyboard
```

## 8. split-storyboard 复用说明

P4C 没有新写 Shot 创建逻辑。

`storyboard-text` 阶段点击“拆成 Shot”时，仍然触发：

```text
starcanvas:split-storyboard
```

由 `StarCanvas.handleSplitStoryboardNode()` 继续负责：

- 分镜解析
- ShotNode 创建
- Source → Shot edge/relation
- 布局

## 9. 长文本自适应策略

新增纯函数：

```ts
estimateStoryboardTextNodeSize()
```

初版规则：

- idea：默认 420px 宽，最小高 300，最高 560
- story / storyboard-text：默认至少 560px 宽，最小高 420，最高 1180
- 根据换行数和估算视觉行数计算高度
- 超过上限后保留节点内部滚动

这对应 tldraw 的 fixed-width + height grows 思路。

## 10. 修改文件

```text
apps/web/src/app/canvas/StarCanvas.tsx
apps/web/src/app/canvas/components/canvas/types.ts
apps/web/src/app/canvas/components/nodes/ContentNode.tsx
apps/web/src/app/canvas/components/toolbar/AddNodePanel.tsx
apps/web/src/app/canvas/components/menus/CanvasContextMenu.tsx
apps/web/src/lib/storyboard/storyboardTextNode.ts
apps/web/src/lib/storyboard/storyboardTextNode.test.ts
apps/web/src/lib/slashCommands/runStoryboardAssistantCommand.ts
apps/web/src/lib/slashCommands/runStoryboardAssistantCommand.test.ts
apps/web/src/lib/slashCommands/slashCommands.ts
apps/web/src/lib/slashCommands/slashCommands.test.ts
apps/web/src/lib/slashCommands/runGenerateTextStoryboardCommand.test.ts
```

说明：部分 Slash Command 文件在 git 中仍显示为未追踪，是此前 P4/P4B 新增文件状态延续，不代表本轮新建了重复入口。

## 11. 测试

新增/调整测试：

```text
storyboardTextNode.test.ts
runStoryboardAssistantCommand.test.ts
slashCommands.test.ts
runGenerateTextStoryboardCommand.test.ts
```

覆盖：

- 阶段推断
- idea → story
- story → storyboard-text
- storyboard-text 阶段只拆 Shot，不调用 AI
- 长文本尺寸估算
- prompt 构建
- Slash Command 不再把旧“一键文字分镜”作为主入口

## 12. 验证结果

```text
新增纯函数测试：7 tests / 2 suites / 7 pass
pnpm --filter web typecheck：通过
pnpm --filter web lint：0 error / 32 warnings
pnpm --filter web test：283 tests / 50 suites / 283 pass / 0 fail
pnpm --filter web build：通过
```

32 个 warning 均为既有技术债，本轮不混修。

## 13. 持久化风险

本轮只处理文本内容、节点尺寸和阶段字段：

- 未新增图片生成
- 未新增 blob URL
- 未新增 data:image
- 未修改 IndexedDB 图片资产链路
- 未引入 base64 持久化风险

结论：未发现新的 `blob:` / `data:image` / base64 持久化风险。

## 14. 手动验收步骤

### A. 创建入口

```text
左侧添加节点面板 → 故事分镜助手
或
画布空白右键 → 故事分镜助手
```

预期：创建 `content/storyboard` 节点，标签为“故事想法”，主按钮为“生成完整故事”。

### B. idea → story

输入：

```text
一个迷路的小女孩在雨夜遇到会说话的狐狸
```

点击：

```text
生成完整故事
```

预期：节点内容变成完整故事，标签变成“完整故事”，按钮变成“生成文字分镜”，节点高度自动增加。

### C. story → storyboard-text

点击：

```text
生成文字分镜
```

预期：节点内容变成已拆分格式的文字分镜，标签变成“文字分镜”，按钮变成“拆成 Shot”，节点高度按内容增长。

### D. storyboard-text → ShotNode

确认文字分镜后点击：

```text
拆成 Shot
```

预期：复用原 split-storyboard，生成多个 ShotNode，并保持 source → Shot 血缘。

### E. 失败保护

AI 请求失败时：

- 保留原文本
- 不跳阶段
- 不生成半成品 Shot
- 显示错误提示

## 15. 剩余限制

- 阅读态 / 编辑态分离尚未完全实现；当前仍以 textarea 承载内容。
- 用户手动 resize 后完全锁定 `autoSizeMode: manual` 的机制还未做细。
- 旧 `runGenerateTextStoryboardCommand` 仍保留为兼容文件，但业务入口已转向阶段式 `runStoryboardAssistantCommand`。
- 后续可以进一步把 story/storyboard-text 展示成更强阅读感的文档块。

## 16. 是否可以进入 P5

建议先人工验收 P4C。

如果以下链路通过：

```text
故事分镜助手
→ 生成完整故事
→ 生成文字分镜
→ 拆成 Shot
```

并且长文本浏览体验基本舒服，再进入：

```text
P5：右键菜单统一 + 保存为资产入口
```
