# STORYBOARD_SPLIT_ORDER_TITLE_P1_2026-05-25

## 1. 本轮目标

P1 目标是把已经跑通的 Shot → Image 血缘链路，进一步整理为更清楚的分镜视觉结构：

- 拆分文字分镜后，ShotNode 按 `order` 稳定排列。
- ShotNode 标题统一为 `镜头 01 / 简短标题`。
- Source Storyboard/Text 节点到每个 ShotNode 建立带语义的 edge。
- ShotNode 首次生成 ImageNode 时，ImageNode 贴近对应 ShotNode，不再飞到画布上方或远处。
- 不改 AI 生成接口、不重构 ImageNode、不做多选合成、不升级依赖、不全仓格式化。

## 2. 当前链路审计结果

| 文件 | 函数/组件 | 当前职责 | 发现 | P1 处理 |
|---|---|---|---|---|
| `apps/web/src/app/canvas/utils/storyboardParser.ts` | `parseStoryboardTextToShots` | 从文本/JSON/表格解析 shots | 数据层已有 `order/title/description/visualPrompt/sourceStoryboardNodeId`，最后按 order 排序 | 复用，不改解析器大逻辑 |
| `apps/web/src/app/canvas/StarCanvas.tsx` | `handleSplitStoryboardNode` | 创建 ShotNode / GridNode / edge | 位置已有 3 列雏形，但列距偏紧，标题直接使用 parser 原始标题 | 接入标题规范化和布局 helper |
| `apps/web/src/lib/storyboard/createShotImageNode.ts` | `createShotImageNode` | 创建/更新 Shot 对应 ImageNode 和 edge | P0 后已有血缘，但首次 ImageNode x 偏移为 `shotWidth + 320`，视觉距离偏远 | 改为 `shotWidth + 80` |
| `apps/web/src/app/canvas/components/nodes/ShotNode.tsx` | `ShotNode` | 展示 Shot 内容和生成按钮 | P0 已标注剧本文本/生图 Prompt | 本轮不继续改 UI |

## 3. 修改文件列表

| 文件 | 修改内容 | 原因 | 风险 | 验证方式 |
|---|---|---|---|---|
| `apps/web/src/app/canvas/StarCanvas.tsx` | `handleSplitStoryboardNode` 接入 `createNormalizedShotTitle/getStoryboardShotPosition/getStoryboardGridPosition/createStoryboardSourceEdge` | 统一拆分后的标题、位置和 Source → Shot edge 语义 | 该文件已有大量未格式化历史差异，需避免无关改动继续扩大 | typecheck/lint/test/build |
| `apps/web/src/lib/storyboard/createShotImageNode.ts` | 首次 ImageNode 默认位置从 `shot.x + shotWidth + 320` 改为 `shot.x + shotWidth + 80` | 让 ImageNode 更贴近对应 Shot，降低长斜线 | 如果用户手动拖过旧 ImageNode，不能重置位置；当前逻辑保留 existing position | 单测覆盖更新旧节点保留位置 |

## 4. 新增文件列表

| 文件 | 职责 |
|---|---|
| `apps/web/src/lib/storyboard/layoutStoryboardShots.ts` | 分镜标题规范化、Shot 三列布局、Grid 位置、Source → Shot edge 元数据 |
| `apps/web/src/lib/storyboard/layoutStoryboardShots.test.ts` | 覆盖标题规范化、三列布局、Grid 位置、Source → Shot edge metadata |

## 5. 数据结构变化

本轮不新增核心类型字段，只规范已有字段的使用：

| 数据位置 | 字段 | 说明 |
|---|---|---|
| `ShotNode.data.title` | `镜头 01 / 简短标题` | 用于节点标题展示 |
| `ShotNode.data.shot.title` | `镜头 01 / 简短标题` | 与 data.title 保持一致 |
| `ShotNode.data.sourceStoryboardNodeId` | source node id | 明确来源 Storyboard/Text 节点 |
| `Edge.data.relation` | `storyboard-shot` | Source → Shot 的语义关系 |
| `Edge.data.sourceType` | `storyboard` | 来源类型 |
| `Edge.data.targetType` | `shot` | 目标类型 |

## 6. 标题规范化策略

新增 `createNormalizedShotTitle()`：

```ts
title = `镜头 ${String(order).padStart(2, "0")} / ${shortTitle}`
```

`shortTitle` 来源优先级：

1. `shot.title`
2. `shot.description`
3. `shot.visualPrompt`
4. fallback：`未命名镜头`

清洗规则：

- 移除开头已有的 `镜头 01：` / `Shot 01:` 等前缀。
- 移除末尾标点。
- 最多保留 16 个字符，避免节点标题成为一整段长文本。

## 7. 布局策略

新增 `getStoryboardShotPosition()`：

```ts
x = source.x + 380
y = source.y + index * 320
```

按用户反馈，拆分后改为自上而下的一列顺序，更像剧本顺下来：

```text
Source Storyboard   Shot 01                    Grid
                    Shot 02
                    Shot 03
                    Shot 04
                    Shot 05
                    Shot 06
                    Shot 07
                    Shot 08
                    Shot 09
```

## 8. ImageNode 贴近策略

P0 中 ImageNode 首次创建位置为：

```ts
x = shot.x + shotWidth + 320
y = shot.y
```

P1 改为：

```ts
x = shot.x + shotWidth + 80
y = shot.y
```

注意：如果已经存在关联 ImageNode，仍保留用户手动拖动过的位置，不强制重排。

## 9. Edge 创建/更新策略

Source → Shot edge 改为：

```ts
{
  relation: "storyboard-shot",
  sourceType: "storyboard",
  targetType: "shot"
}
```

Shot → Image edge 继续沿用 P0：

```ts
{
  relation: "generated-image",
  sourceType: "shot",
  targetType: "image"
}
```

## 10. 新增测试

| 测试文件 | 覆盖内容 |
|---|---|
| `layoutStoryboardShots.test.ts` | 标题规范化为 `镜头 03 / ...`；去除已有镜头前缀；一列纵向布局；Grid 位置；Source → Shot edge metadata |
| `createShotImageNode.test.ts` | 更新 ImageNode 贴近位置断言；保留 P0 创建/更新/edge 测试 |

测试总数从 P0 的 235 增至 240。

## 11. 验证命令和结果

| 命令 | 结果 |
|---|---|
| `pnpm --filter web typecheck` | 通过 |
| `pnpm --filter web lint` | 0 error / 32 warnings（未高于当前基线） |
| `pnpm --filter web test` | 240 tests / 34 suites / 0 fail |
| `pnpm --filter web build` | 通过 |

## 12. 手动验收步骤

1. 打开：`http://localhost:3000/canvas`
2. 新建一个文本/Storyboard Source 节点，输入 1～9 条分镜。
3. 右键该源节点，执行拆分分镜。
4. 检查：
   - Shot 标题为 `镜头 01 / 简短标题`。
   - Shot 按顺序自上而下一列排列。
   - Source → 每个 Shot 有连线。
   - 九宫格节点在第三列 Shot 右侧。
5. 点击某个 Shot 的“生成图片”。
6. 检查：
   - ImageNode 出现在该 Shot 右侧较近位置。
   - Shot → Image 有连线。
   - 再次点击生成时更新已有 ImageNode，不重置手动拖动过的位置。

## 13. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 旧画布数据不会自动重排 | 本轮只影响新拆分出的 Shot，不迁移历史节点 | 如需整理旧画布，可后续做“整理当前分镜布局”命令 |
| 简短标题是规则截断，不是语义摘要 | 不调用 AI，避免引入不稳定和成本 | P2/P3 可考虑 AI 提炼标题，但必须可回退 |
| Source 节点标题只做轻量兜底 | 如果原节点已有标题，不强制改成 Source | 后续可新增 Storyboard Source 专用节点类型 |
| `StarCanvas.tsx` 已存在大量历史格式差异 | git diff 显示该文件有很多早前改动/格式差异 | 下一轮仍应只做定点修改，不全仓格式化 |

## 14. 后续建议

建议下一步进入 **P2：ShotNode UI 三段式整理**：

- 上方：剧本文本
- 中间：生图 Prompt
- 下方：输出状态 / 右侧图片节点链接 / 重试

暂时不要做复杂 Agent、视频、模板或完整 ComfyUI 化节点系统。

## 15. 非技术总结

这次解决的是：拆分出来的分镜不再像一堆散乱卡片，而是开始按顺序、短标题、稳定布局显示。

用户现在应该看到：

- 分镜标题更短：`镜头 01 / 天安门广场远景`
- 分镜节点按一列纵向顺序排列
- 原始剧本到每个分镜有线
- 点击生图后，图片节点更贴近对应分镜

仍留到下一轮的问题：

- ShotNode 内部 UI 还可以更清楚
- 旧画布节点不会自动重排
- 九宫格状态展示还不够产品化
- 多选合成还需要在 P3 继续整理

可以进入 P2。