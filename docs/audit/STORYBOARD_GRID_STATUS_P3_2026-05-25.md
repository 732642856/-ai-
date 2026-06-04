# STORYBOARD_GRID_STATUS_P3_2026-05-25

## 1. 本轮目标

P3 目标：在 P0/P1/P2 的基础上，先把 StoryboardGridNode 的状态表达做清楚，避免九宫格节点看起来像“空格子”，但不知道哪些镜头已有图、哪些缺图、哪些失败、是否已经合成。

本轮不做：

- 不重构 AI 生成接口；
- 不重做多选合成；
- 不做复杂 Agent pipeline；
- 不升级依赖；
- 不全仓格式化。

## 2. 当前九宫格链路审计结果

| 文件 | 函数/组件 | 当前职责 | P3 前问题 | P3 处理 |
|---|---|---|---|---|
| `StoryboardGridNode.tsx` | Grid 节点 UI | 展示 3x3 空格和输出按钮 | 每格永远显示“镜头 XX”，不展示每个 shot 的图片/缺失/失败状态 | 使用 `storyboardGrid.shotStates` 展示 ready/missing/generating/failed |
| `StarCanvas.tsx` | `handleSplitStoryboardNode` | 拆分时创建 GridNode | Grid 只保存 shotNodeIds，没有每个 shot 的状态快照 | 创建 Grid 时初始化 `shotStates` 为 missing |
| `StarCanvas.tsx` | `handleGenerateStoryboardGrid` | 合成九宫格输出 | 合成前只收集 imageUrls，Grid UI 不知道哪些镜头有图 | 合成前计算 `shotStates`，写入 Grid；成功/失败也保留状态快照 |
| `storyboardGridComposer.ts` | canvas 合成 | 把已有图片合成为 dataURL | 缺图格子会空着 | 本轮不改合成器，只增强 UI 状态表达 |

## 3. 修改文件列表

| 文件 | 修改内容 | 原因 | 风险 | 验证方式 |
|---|---|---|---|---|
| `apps/web/src/app/canvas/components/canvas/types.ts` | `StoryboardGridData` 新增可选 `shotStates` | 让 GridNode 能展示每个镜头格子的状态 | 只新增可选字段，兼容旧数据 | typecheck/build |
| `apps/web/src/app/canvas/components/nodes/StoryboardGridNode.tsx` | 新增 ready/missing/generating/failed 状态统计和格子展示；Header 改中文状态 | 用户能看懂哪些镜头有图、哪些缺图、哪些失败 | UI 更密集，但节点可 resize | typecheck/lint/build + 浏览器验收 |
| `apps/web/src/app/canvas/StarCanvas.tsx` | Grid 创建时初始化 shotStates；生成九宫格时从 ShotNode 计算最新 shotStates 并写回 Grid | Grid 状态与实际 Shot 图片同步 | 如果 Shot 后续单独生成，Grid 状态只在输出九宫格时刷新 | 手动验收 |

## 4. 数据结构变化

`StoryboardGridData` 新增：

```ts
shotStates?: Array<{
  shotNodeId: string
  order?: number
  title?: string
  status: "missing" | "generating" | "ready" | "failed"
  imageUrl?: string
  errorMessage?: string
}>
```

含义：

| status | 含义 | UI |
|---|---|---|
| `missing` | 该 Shot 还没有图片 | 角标“缺” |
| `generating` | 该 Shot 正在生成 | loading + 角标“生成” |
| `ready` | 该 Shot 已有图片 | 显示缩略图 + 角标“图” |
| `failed` | 该 Shot 生成失败 | 显示失败 + 角标“错” |

## 5. UI 行为说明

### Header 状态

Grid header 不再显示技术字段，而是：

- `合成中`
- `已合成`
- `失败`
- `x/y 已出图`

### 状态栏

Grid 顶部状态栏显示：

```text
镜头图片 3/9    等待合成
```

或：

```text
镜头图片 6/9    1 失败
```

### 格子状态

每个格子会根据 shotStates 显示：

- 已有图：缩略图
- 正在生成：spinner
- 失败：镜头编号 + 失败
- 缺图：镜头编号

## 6. 生成链路说明

### 拆分时

`handleSplitStoryboardNode` 创建 GridNode 时，会初始化：

```ts
shotStates: shotNodes.slice(0, 9).map(node => ({
  shotNodeId: node.id,
  order: node.data.shot?.order,
  title: node.data.shot?.title,
  status: "missing"
}))
```

### 点击“输出九宫格”时

`handleGenerateStoryboardGrid` 会重新读取所有关联 ShotNode，并计算最新状态：

```ts
ready     = shot.generatedImageUrl 存在
generating = shot.generationStatus/status 为 generating
failed    = shot.generationStatus/status 为 failed/error
missing   = 其他情况
```

然后写回 GridNode，UI 可立即反映当前状态。

## 7. 本轮没有解决的点

| 问题 | 说明 | 建议 |
|---|---|---|
| Grid 不会自动触发缺图生成 | 如果 9 个 Shot 还没图，点击 Grid 仍提示先生成镜头图片 | 下一轮可做“生成缺失镜头 + 合成”一键流程 |
| Shot 单独生成后 Grid 状态不会实时自动刷新 | 目前 Grid 状态在创建和点击输出时刷新 | 后续可在 Shot 生成成功后同步更新关联 Grid |
| 多选合成结果仍是独立 ImageNode | 还没把多选合成状态接入 GridNode | P4 可整理多选合成 |
| Grid 输出 edge metadata 仍可增强 | 当前只保证有 edge | 后续加 `relation: grid-output` |

## 8. 验证命令和结果

| 命令 | 结果 |
|---|---|
| `pnpm --filter web typecheck` | 通过 |
| `pnpm --filter web lint` | 0 error / 32 warnings |
| `pnpm --filter web test` | 240 tests / 34 suites / 0 fail |
| `pnpm --filter web build` | 通过 |

## 9. 手动验收步骤

1. 打开 `http://localhost:3000/canvas`。
2. 拆分一个 9 镜头分镜。
3. 检查 GridNode：
   - Header 应显示 `0/9 已出图`。
   - 每格显示镜头编号，并有“缺”状态角标。
4. 给其中 1～2 个 ShotNode 生成图片。
5. 点击 GridNode 的“输出九宫格”。
6. 检查 GridNode：
   - 状态栏显示 `镜头图片 1/9` 或 `2/9`。
   - 已出图格子显示缩略图。
   - 缺图格子仍显示镜头编号。
7. 如果全部没有图就点击输出：
   - 应显示错误提示：请先在镜头节点点击“生成图片”。
8. 全部生成后再输出：
   - 右侧出现九宫格输出 ImageNode。
   - Grid header 显示 `已合成`。

## 10. 非技术总结

这次解决的是九宫格节点“看起来像空白占位，不知道每个镜头进度”的问题。

现在九宫格能告诉用户：

- 9 个镜头里有几个已经出图；
- 哪些格子缺图；
- 哪些格子失败；
- 哪些格子已有缩略图；
- 当前是否已经合成输出。

还没做的是“一键把缺失镜头全部生成并合成”。这个建议放到下一轮 P4。