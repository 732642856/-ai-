# TEXT_STORYBOARD_ONE_CLICK_P4B_2026-05-25

## 1. 本轮目标

实现克制版 P4B：一键文字分镜生成面板。

目标是让用户创建“AI 生成文字分镜”节点后，不需要记住输入 `/`，也能直接点击按钮完成：

```text
当前文本 / 一句故事想法
→ /api/ai/chat 生成结构化文字分镜
→ 复用既有 split-storyboard
→ 自动生成 ShotNode
```

本轮不接新模型、不新增依赖、不做 Agent、不做视频、不做资产库、不做复杂参数面板、不重构 StarCanvas 大结构。

## 2. 修改文件

```text
apps/web/src/app/canvas/components/nodes/ContentNode.tsx
apps/web/src/lib/slashCommands/runGenerateTextStoryboardCommand.ts
apps/web/src/lib/slashCommands/runGenerateTextStoryboardCommand.test.ts
apps/web/src/lib/slashCommands/runSlashTextCommand.ts
apps/web/src/lib/storyboard/layoutStoryboardShots.test.ts
```

另外，P4-Fix 已在此前修改：

```text
apps/web/src/app/canvas/StarCanvas.tsx
apps/web/src/app/canvas/components/menus/CanvasContextMenu.tsx
apps/web/src/app/canvas/components/toolbar/AddNodePanel.tsx
apps/web/src/app/canvas/components/nodes/ShotNode.tsx
apps/web/src/lib/storyboard/layoutStoryboardShots.ts
apps/web/src/lib/slashCommands/slashCommands.ts
apps/web/src/lib/slashCommands/slashCommands.test.ts
```

## 3. UI 入口说明

P4B 新增的入口只出现在：

```text
content/storyboard 节点底部
```

按钮文案：

```text
AI 生成文字分镜
```

生成中状态：

```text
AI 生成中...
```

普通 `content/text` 或 `content/prompt` 节点不显示该按钮。

## 4. 一键按钮显示规则

```text
node.data.nodeKind === "storyboard" → 显示按钮
node.data.nodeKind !== "storyboard" → 不显示按钮
```

按钮可用规则：

```text
当前主文本为空或只有空白 → disabled
正在生成中 → disabled
当前主文本非空且未生成中 → enabled
```

空文本时按钮 title 提示：

```text
请先输入一句故事想法或剧情梗概
```

非空文本时按钮 title 提示：

```text
生成文字分镜并自动拆成 Shot 节点
```

## 5. 执行链路说明

按钮点击后调用共享函数：

```ts
runGenerateTextStoryboardCommand({
  text,
  nodeId,
  updateNodeText,
  triggerSplitStoryboard,
})
```

内部链路：

```text
1. trim 当前节点主文本
2. 空文本直接抛错，不调用 AI
3. 调用 runSlashTextCommand({ commandId: "generate-storyboard-text" })
4. runSlashTextCommand 继续复用 /api/ai/chat
5. 成功后 updateNodeText(result)
6. 触发 triggerSplitStoryboard(nodeId)
7. StarCanvas 既有事件监听调用 handleSplitStoryboardNode(nodeId)
8. 既有 split-storyboard 逻辑创建 ShotNode 和 lineage edge
```

## 6. 与 Slash Command 的复用关系

Slash Command 的 `AI 生成文字分镜` 不再单独写一套流程，而是复用：

```ts
handleGenerateTextStoryboard(cleanedText)
```

按钮也复用同一个：

```ts
handleGenerateTextStoryboard(editContent)
```

二者最终都进入：

```ts
runGenerateTextStoryboardCommand(...)
```

因此 P4B 没有产生第二套 AI 文字分镜逻辑。

## 7. split-storyboard 复用说明

P4B 没有新写 Shot 创建逻辑，没有绕开 edge / relation 创建逻辑。

仍然通过原事件：

```ts
window.dispatchEvent(
  new CustomEvent("starcanvas:split-storyboard", {
    detail: { nodeId },
  }),
)
```

由 StarCanvas 中既有监听继续调用：

```ts
handleSplitStoryboardNode(nodeId)
```

因此 ShotNode 创建、Source → Shot edge、StoryboardGrid 等仍走原主链路。

## 8. 新增/修改测试

新增：

```text
apps/web/src/lib/slashCommands/runGenerateTextStoryboardCommand.test.ts
```

覆盖：

```text
1. 空文本时直接报错，不调用 updateNodeText / split-storyboard
2. AI 成功后更新节点文本
3. AI 成功后触发 split-storyboard
4. 请求 prompt 仍包含“可直接拆分为 Shot 节点”和用户原始故事想法
```

修改：

```text
apps/web/src/lib/storyboard/layoutStoryboardShots.test.ts
```

原因：P4-Fix 放大 ShotNode 布局 offset 后，旧测试硬编码 `x: 480` 失效；改为使用：

```ts
sourceNode.position.x + STORYBOARD_SHOT_LAYOUT.sourceOffsetX
```

测试语义更稳定，不再和具体数值重复绑定。

## 9. 验证命令结果

### typecheck

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web typecheck
```

结果：通过，0 error。

### lint

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint
```

结果：通过，0 error / 32 warnings。

32 个 warning 为既有技术债，主要包括：

```text
React hook dependency warnings
react-hooks/set-state-in-effect warnings
next/no-img-element warnings
jsx-a11y alt-text warnings
```

本轮未混入 TechDebt 修复。

### test

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
```

结果：通过。

```text
tests 276
suites 48
pass 276
fail 0
```

### build

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

结果：通过。

```text
Compiled successfully
TypeScript passed
/canvas route built
```

## 10. 手动验收步骤

### A. 添加节点 → AI 生成文字分镜

预期：

```text
节点出现
尺寸舒适
底部有 AI 生成文字分镜按钮
```

### B. 空文本

预期：

```text
按钮 disabled
不会调用 AI
```

### C. 输入一句故事想法

示例：

```text
一个迷路的小女孩在雨夜遇到会说话的狐狸
```

预期：

```text
按钮 enabled
点击后显示 AI 生成中...
```

### D. 成功生成

预期：

```text
主文本被替换为结构化文字分镜
自动生成多个 ShotNode
ShotNode 尺寸舒适
Text/storyboard Source → ShotNode 血缘正确
```

### E. 失败场景

预期：

```text
原文本保留
不生成半成品 Shot
节点内有错误提示
```

### F. Slash Command

预期：

```text
输入 / 仍可选择 AI 生成文字分镜
行为与底部按钮一致
```

## 11. 剩余限制

```text
1. 暂无分镜数量参数，保持自动 4-8 个镜头。
2. 暂无风格 / 角色 / 类型参数面板。
3. 暂无生成历史版本管理。
4. 暂无失败重试按钮，失败后用户可再次点击按钮。
5. 需要真实浏览器人工验收 UI 呈现和 AI 返回格式兼容性。
```

这些限制符合 P4B 的克制范围，不建议本轮扩大。

## 12. 是否可以进入 P5

可以。

建议路线：

```text
P4 ✅ Slash Command MVP
P4-Fix ✅ 节点默认尺寸 + AI 生成文字分镜入口
P4B ✅ 一键文字分镜生成面板
↓
P5：右键菜单统一 + 保存为资产入口
```

进入 P5 前建议先人工验收 P4B：重点确认按钮可见性、空文本 disabled、成功自动拆 Shot、失败保留原文本。

## 13. 持久化风险

本轮只生成和更新文本内容，并触发既有 split-storyboard。

未新增图片生成、未新增 data:image/blob URL、未修改图片持久化链路。

结论：

```text
未发现新的 blob/data:image/base64 持久化风险。
```
