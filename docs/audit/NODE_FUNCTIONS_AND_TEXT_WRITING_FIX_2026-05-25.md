# Node Functions and Text Writing Fix — 2026-05-25

## 1. 本轮目标

用户反馈：

- 分镜节点没有生分镜图成功。
- 需要检查所有节点功能是否真实有效。
- 文本部分希望更符合普通写作习惯：白底黑字、大小屏/分屏感，而不是深色小文本框。

本轮目标不是做 P5B 自动快照，而是先修复节点链路和文本写作体验。

## 2. 修改文件

- `apps/web/src/app/canvas/StarCanvas.tsx`
- `apps/web/src/app/canvas/components/nodes/ContentNode.tsx`
- `apps/web/src/app/canvas/components/menus/NodeContextMenu.tsx`
- `apps/web/src/app/canvas/components/canvas/types.ts`

## 3. 节点功能检查结果

已核对当前注册节点：

- `image` → `ImageNode`
- `content` → `ContentNode`
- `workflow` → `WorkflowNode`
- `shot` → `ShotNode`
- `storyboardGrid` → `StoryboardGridNode`

主要事件链路：

- `starcanvas:split-storyboard` → `handleSplitStoryboardNode`
- `starcanvas:generate-shot` → `handleGenerateShotImage`
- `starcanvas:generate-grid` → `handleGenerateStoryboardGrid`
- `starcanvas:create-storyboard-assistant` → `handleCreateStoryboardAssistantFromInspiration`
- 新增：`starcanvas:generate-storyboard-image` → `handleGenerateStoryboardImageFromSource`

关键发现：原来的分镜链路不是假功能，但它是分步流程：

```text
文字分镜节点 → 拆 Shot → 单个 Shot 生图 → 九宫格节点合成
```

用户点击“输出九宫格”时，如果还没有镜头图，会得到“请先生成图片”的前置提示。因此用户感知为“分镜节点没有生分镜图成功”。本轮补上了一键串联入口。

## 4. 分镜一键生成链路

新增 `handleGenerateStoryboardImageFromSource(nodeId)`：

```text
文本/文档/分镜节点
→ 查找已有关联 Shot
→ 如果没有 Shot，调用现有拆分逻辑生成 Shot 和 storyboardGrid
→ 只对缺失图片的 Shot 批量调用现有生图逻辑
→ 查找或创建 storyboardGrid
→ 调用现有九宫格合成逻辑
→ 写入工作记录和节点可见状态
```

保护点：

- 不删除原来的分步流程。
- 已有 Shot 不重复拆分。
- 已有图片的 Shot 不重复生图。
- 生图失败会保留已成功结果，并在源节点/Shot/Grid 上显示错误状态。
- `handleGenerateShotImage()` 和 `handleGenerateStoryboardGrid()` 现在返回 boolean，便于串联流程判断成功/失败。

新增入口：

- `ContentNode` 底部新增按钮：`一键生成分镜图`
- `NodeContextMenu` 对文本/分镜/文档源节点新增右键项：`一键生成分镜图`

## 5. 文本白底黑字 / 大屏写作改动

`ContentNode` 已调整为更像普通文本编辑器：

- 主文本编辑区改为白底黑字。
- placeholder 改为浅灰色。
- 文本字号与行距提升为更适合长文阅读/写作的样式。
- 节点默认尺寸提高：普通文本约 `680x560`，文档/故事分镜约 `760x620`。
- 新增 `writingMode?: "normal" | "focus"`。
- Header 新增 `大屏 / 恢复` 切换按钮：
  - 大屏：约 `920x720`
  - 恢复：回到普通写作尺寸

这不是全局分屏重构，而是节点级“大屏写作”MVP，避免扩大范围。

## 6. P5-Safety 影响说明

本轮没有改动快照 store 和 sanitizer 文件。

现有链路仍保持：

```text
addSnapshot
→ sanitizeAndValidateCanvasSnapshot
→ trimSnapshotsForStorage
→ localStorage
```

本轮新增的一键分镜生图链路不会绕过快照安全机制，也没有把图片 blob/base64 写入快照逻辑。

## 7. 测试与验证

### typecheck

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web typecheck
```

结果：通过。

### lint

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web lint
```

结果：通过，`0 errors / 32 warnings`。

说明：32 个 warnings 为既有 React hooks / img / alt 等警告，本轮未处理技术债。

### test

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web test
```

结果：通过。

```text
tests 296
suites 52
pass 296
fail 0
```

### build

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web build
```

结果：通过。

## 8. 手动验收步骤

### A. 文本写作

1. 新建自由文本/创作文档/故事分镜助手节点。
2. 输入长文。
3. 检查主编辑区是否白底黑字。
4. 点击 `大屏`。
5. 检查节点是否放大为适合写作的大尺寸。
6. 点击 `恢复`。

预期：文字可读、可滚动、可放大，原有 slash/AI 输入不丢失。

### B. 分步分镜流程

1. 在文本/分镜节点输入已拆分文字分镜。
2. 点击拆分镜头。
3. 单个 Shot 点击生成图片。
4. 九宫格节点点击输出九宫格。

预期：原分步流程仍可用。

### C. 一键生成分镜图

1. 在文本/文档/分镜节点输入故事或分镜文本。
2. 点击 `一键生成分镜图`。
3. 观察自动执行：拆 Shot → 生成缺失镜头图 → 输出九宫格。

预期：最终生成分镜九宫格图片节点；若部分镜头失败，保留成功结果并显示失败原因。

### D. localStorage 安全

生成后手动检查：

```js
localStorage.getItem('startrails_canvas_snapshots:current')
```

预期：快照链路仍不应出现 `blob:`、`data:image`、大段 `base64`、`b64_json`。

## 9. 剩余风险

- 一键流程依赖真实图片生成接口；若上游模型/额度/网络失败，会显示失败，但无法保证外部服务可用。
- 一键流程最多合成前 9 个 Shot，符合当前九宫格节点语义；超过 9 个镜头仍建议后续设计长篇分镜分页。
- 文本“大屏写作”是节点级 MVP，不是完整应用级分屏编辑器。
- lint 的 32 个 warnings 仍建议后续独立清理，不要和本轮功能修复混做。

## 10. 多选 Shot 生成分镜图补丁 — 2026-05-26

用户在浏览器里选择多张分镜节点后点击“生成分镜图”未成功。复查后定位到：

- 该入口走的是 `handleComposeSelectedShots()`，不是上一节的 `handleGenerateStoryboardImageFromSource()`。
- 如果选中的 Shot 没有已有图片，会走“直接生成一张多格分镜图”的路径；但失败时只把 Shot 标成错误，没有工作记录，用户容易感知为静默失败。
- 成功时也没有把多选合成写入工作记录，且输出节点尺寸固定偏横向，对 2x2 / 3x3 分镜不够清楚。

本轮确认分镜图生成存在两条用户路径：

1. 文本/文档/分镜源节点的一键链路，由 `starcanvas:generate-storyboard-image` → `handleGenerateStoryboardImageFromSource()` 处理。
2. 多选 Shot 节点的顶部浮条合成链路，由 `handleComposeSelectedShots()` 处理。

本次补丁修复的是第二条旧链路，避免多选 Shot 合成时静默失败或无状态反馈。两条路径都保留，不能互相替代。

本次补丁：

- 多选 Shot 没有剧本文本/Prompt 且也没有图片时，直接给选中 Shot 写入明确错误：`选中的镜头没有可用于生成的剧本文本或生图 Prompt`。
- 多选合成开始时，选中 Shot 会进入 `generating` 状态，避免用户以为按钮没响应。
- 多选合成成功后，选中 Shot 恢复 `done` 状态。
- 多选合成成功后写入工作记录：`生成 N 格分镜图`。
- 输出 ImageNode 尺寸改为按布局适配：2x2 用方形，3x3 用更大方形，竖排/横排分别适配。

再次验证：

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web typecheck
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web lint
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web test
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web build
```

结果：

- typecheck：通过。
- lint：通过，`0 errors / 32 warnings`，仍为既有警告。
- test：通过，`296 pass / 0 fail / 52 suites`。
- build：通过。

### 多选 Shot 手动验收补充

#### A. 已有单图，本地合成

1. 准备 2 个以上 Shot 节点。
2. 每个 Shot 都已有单图。
3. 选中这些 Shot。
4. 点击顶部浮条 `生成一张分镜图`。

预期：

- 直接本地合成。
- 不调用生图接口，不重复消耗生成额度。
- 创建多格 ImageNode。
- 选中 Shot 状态保持或恢复 `done`。
- 工作记录出现 `生成 N 格分镜图`。

#### B. 无单图，但有文本 / Prompt

1. 准备 2 个以上 Shot 节点。
2. Shot 没有 image / assetId。
3. Shot 有剧本文本或生图 Prompt。
4. 选中这些 Shot。
5. 点击顶部浮条 `生成一张分镜图`。

预期：

- Shot 进入 `generating` 状态。
- 调用图片生成接口，生成一张多格分镜图。
- 创建 ImageNode。
- Shot 状态恢复 `done`。
- 工作记录出现 `生成 N 格分镜图`。

#### C. 既没图，也没文本 / Prompt

1. 准备 2 个以上空 Shot 节点。
2. 选中这些 Shot。
3. 点击顶部浮条 `生成一张分镜图`。

预期：

- 显示：`选中的镜头没有可用于生成的剧本文本或生图 Prompt`。
- 不调用生图接口。
- 不创建空 ImageNode。
- 不写成功工作记录。
- Shot 不会永久停在 `generating`。

#### D. 部分 Shot 有图，部分 Shot 无图但有 Prompt

当前策略：

- 如果不是“所有选中 Shot 都已有单图”，就不会走本地合成。
- 系统会基于所有选中 Shot 的文本 / Prompt，直接生成一张完整多格分镜图。
- 这不是“为缺图 Shot 补单图后再合成”，而是“生成一张综合分镜板”。

验收时需确认：

- 有明确生成中状态。
- 成功后创建多格 ImageNode。
- 不把用户误导为已经补齐了每个 Shot 的单图。

#### E. 部分 Shot 无图且无 Prompt

当前策略：

- 只要至少存在可用 `sourcePrompt`，仍会尝试生成整张多格分镜图。
- 缺少文本的 Shot 在 prompt 中不会形成有效镜头描述。

剩余风险：

- 后续需要更明确地提示哪些 Shot 缺少内容，或在生成前阻止不完整选择。

#### F. 布局尺寸

建议分别测试：

- 2 个 Shot
- 3 个 Shot
- 4 个 Shot
- 6 个 Shot
- 9 个 Shot

预期：

- 2x2 方形正常。
- 3x3 更大方形正常。
- 横排/竖排适配合理。
- 不出现明显格子错位。

#### G. 工作记录

1. 多选 Shot 合成分镜图成功。
2. 打开工作记录面板。

预期：

- 出现 `生成 N 格分镜图`。
- 记录关联新生成的 ImageNode，可复用点击工作记录定位节点能力。

## 11. 影视横屏 16:9 分镜比例补丁 — 2026-05-26

用户基于生成结果截图反馈：星轨画布面向影视行业，分镜图每一格必须是影视横屏，不应该让用户选择普通比例。

本次补丁针对多选 Shot → `生成一张分镜图` 这一链路完成约束：

- `storyboardComposite.ts` 新增统一常量：`STORYBOARD_FRAME_ASPECT_RATIO = 16 / 9`、`STORYBOARD_FRAME_ASPECT_RATIO_LABEL = "16:9"`。
- `buildStoryboardCompositePrompt()` 强制写入行业要求：每一格都是横屏 16:9 电影/剧集镜头构图，不允许竖屏、方图或社媒比例单格。
- 本地合成 `composeStoryboardGrid()` 默认单格尺寸改为 `640 × 360`，每格固定 16:9。
- 多选 Shot 合成输出节点显示尺寸不再用方形/竖排经验值，而是按布局的列数、行数和单格 16:9 推导。
- 顶部浮条设置面板取消“布局选择”，改为说明：自动按镜头数量排布；每格固定影视横屏 16:9，不提供竖屏、方图或社媒比例选择。
- 应用设置时强制 `layout: "auto"`，避免旧会话里残留的 `1x4` / `4x1` 选择继续影响影视分镜输出。

验证命令：

```bash
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main test -- storyboardComposite.test.ts
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main exec tsc --noEmit -p apps/web/tsconfig.json
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main lint
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main build
```

结果：

- storyboardComposite 相关测试：通过（该命令实际跑完整 web 测试集，未失败）。
- typecheck：通过。
- lint：通过，`0 errors / 32 warnings`，仍为既有警告。
- build：通过。

手动验收建议：

1. 选中 2 / 3 / 4 / 6 / 9 个 Shot，分别点击顶部浮条 `生成一张分镜图`。
2. 检查本地合成路径：每格应保持横屏 16:9，不再出现正方形格子。
3. 检查模型生成路径：prompt 中包含“每一格都必须是横屏 16:9 画幅”，生成结果应趋向电影分镜板。
4. 打开设置面板，确认没有普通比例选择，也没有横排/竖排布局选择。

## 12. 普通故事文本无法生成分镜图修复 — 2026-05-29

用户反馈“无法生成分镜图”。本次定位到一个关键断点：

- 源节点 `一键生成分镜图` 会先调用 `parseStoryboardTextToShots()` 拆 Shot。
- 旧解析器只识别结构化分镜格式，例如 `1.` / `2.` / `镜头1` / Markdown 表格 / JSON。
- 如果用户直接输入一段普通故事或剧本文本，不含这些格式，解析结果为 0，链路会停在“没有识别到可拆分的分镜格式”，因此无法继续生图。

本次最小修复：

- 在 `storyboardParser.ts` 增加普通故事文本 fallback。
- 当结构化解析全部失败时，按中文标点、换行和段落切分为 3–9 个故事 beats。
- fallback 生成的 Shot 会自动带 `description` 和 `visualPrompt`，从而能继续进入后续生图与九宫格合成。
- 保留原有结构化解析优先级；已有标准文字分镜格式不受影响。
- 新增 `storyboardParser.test.ts` 覆盖：普通故事文本 fallback、编号分镜优先解析。

验证命令：

```bash
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main test -- storyboardParser.test.ts
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main exec tsc --noEmit -p apps/web/tsconfig.json
env NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main lint
```

结果：

- storyboardParser 相关测试：通过（该命令实际跑完整 web 测试集，未失败）。
- typecheck：通过。
- lint：通过，`0 errors / 32 warnings`，仍为既有警告。

手动验收建议：

1. 新建 ContentNode。
2. 直接输入一段普通故事文本，不使用 `1.` / `镜头1` 等格式。
3. 点击 `一键生成分镜图`。
4. 预期：系统应先自动拆出 3–9 个 Shot，再继续生成镜头图和分镜图；不应再停在“没有识别到可拆分的分镜格式”。

## 13. 下一步建议

建议先浏览器手动验收本轮，尤其是：

1. 分镜节点一键生成分镜图。
2. 图片生成失败时的错误展示。
3. 文本节点白底黑字和大屏切换。
4. ImageNode + IndexedDB 资产恢复场景。
5. 多选 Shot 合成后保存/恢复关键版本，并检查 localStorage 不含 `blob:`、`data:image`、`base64`、`b64_json`。

P5B 自动快照触发点后续需要纳入：

- 源节点一键生成分镜图成功后。
- 多选 Shot 生成一张分镜图成功后。

验收通过后，再进入：

```text
P5B：低频自动关键节点快照
```

之后再回到：

```text
OPEN_CANVAS_REFERENCE_AUDIT / P4C 长文本节点与画布写作体验
```

## 13. 超短文本生成分镜图九宫格空格问题修复 — 2026-05-29

用户输入"小兔子吃草"点击一键生成分镜图，结果出现一个九宫格节点但里面只有 1 张图，其余 8 个格子为空。

定位到的根因：

1. **解析器对超短文本过度拆分**：旧 fallback 用 `targetCount = max(3, 1)` 会把 1 个 beat 硬拆成 3 份重复内容。
2. **九宫格格子数固定为 9**：`maxShots: 9`，`columns: 3` 硬编码，即使只有 1 个 Shot 也会渲染 9 个空格。
3. **合成时也固定 3 列**：`composeStoryboardGrid({ columns: 3 })` 不跟随实际 Shot 数。

本次修复：

- `storyboardParser.ts`：增加 `MIN_STORY_LENGTH_FOR_SPLIT = 30`。超短文本（< 30 字且只有 1 个 beat）只产生 1 个 Shot，不强制拆分。
- `StarCanvas.tsx`：九宫格 `maxShots` 和 `columns` 现在动态跟随实际 Shot 数量。1 个 Shot → 1 列 1 格；2 个 → 2 列 2 格；3+ → 3 列 N 格。
- `StoryboardGridNode.tsx`：网格渲染从固定 `grid-cols-3` 改为 `gridTemplateColumns: repeat(N, 1fr)` 动态列数。
- `types.ts`：`StoryboardGridData.columns` 从字面量 `3` 改为 `1 | 2 | 3`；`maxShots` 从字面量 `9` 改为 `number`。
- 合成路径 `composeStoryboardGrid` 的 `columns` 参数也改为跟随 `grid.columns`。

验证命令：

```bash
cd apps/web && npx vitest run src/app/canvas/utils/storyboardParser.test.ts
tsc --noEmit -p apps/web/tsconfig.json
eslint src/app/canvas/StarCanvas.tsx src/app/canvas/utils/storyboardParser.ts src/app/canvas/components/nodes/StoryboardGridNode.tsx
```

结果：

- storyboardParser 5 个测试：全部通过（含超短文本、短文本、多 beat 文本）。
- typecheck：通过。
- lint：0 errors / 6 warnings（既有技术债）。
