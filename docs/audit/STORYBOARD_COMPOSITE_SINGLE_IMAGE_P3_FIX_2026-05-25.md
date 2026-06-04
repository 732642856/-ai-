# STORYBOARD_COMPOSITE_SINGLE_IMAGE_P3_FIX_2026-05-25

日期：2026-05-25  
项目：Startrail Canvas / 星轨画布  
任务：P3-Fix：多选 Shot 生成“一张多格分镜图”逻辑修正、补测试、完整验证和报告。

---

## 1. 本轮目标

本轮只修复和验证多选 Shot 后主按钮“生成一张分镜图”的核心语义：

```text
全部选中 Shot 都已有可用单图 → 本地合成一张多格分镜图
否则 → 只调用一次模型，生成一张完整多格分镜图
```

明确不做：视频 API、阿里云百炼新模型、角色参考图系统、多格设置面板、Slash command、Agent、资产库重构、依赖升级、全仓 Prettier、大重构 StarCanvas。

---

## 2. 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/web/src/app/canvas/StarCanvas.tsx` | `handleComposeSelectedShots` 改为使用纯函数判断合成分支；移除 `imageUrls.some(...)` 语义；接入 composite edge helper |
| `apps/web/src/lib/storyboard/storyboardComposite.ts` | 新增 storyboard composite 纯函数：本地合成判断、布局计算、prompt 构建、edge 创建/去重、Shot 图片 URL 查找 |
| `apps/web/src/lib/storyboard/storyboardComposite.test.ts` | 新增 P3-Fix 核心测试，覆盖分支判断、4 Shot 2×2、prompt、edge 去重、图片 URL 查找 |
| `apps/web/src/lib/storage/sanitizePersistedCanvas.test.ts` | 增加 composite ImageNode 持久化安全测试，确认 runtime URL / dataURL 被清理，assetId 和 lineage metadata 保留 |

---

## 3. 修正点：some → every(Boolean)

### 修正前风险

旧逻辑：

```ts
const result = imageUrls.some((url) => url)
  ? await composeStoryboardGrid(...)
  : await generateImageFromPrompt(...)
```

这会导致混合情况错误：

```text
Shot 01 有图
Shot 02 没图
Shot 03 有图
Shot 04 没图
```

只要存在任意一张图，就会进入本地合成分支，造成空格、缺图、风格断裂，且不符合“主按钮只生成一张完整分镜图”的 MVP 语义。

### 修正后逻辑

新增纯函数：

```ts
export function shouldComposeStoryboardLocally(
  imageUrls: Array<string | null | undefined>,
): boolean {
  return imageUrls.length > 0 && imageUrls.every(Boolean);
}
```

`StarCanvas.tsx` 中现在使用：

```ts
const shouldUseLocalCompose = shouldComposeStoryboardLocally(imageUrls);

const result = shouldUseLocalCompose
  ? await composeStoryboardGrid(...)
  : await generateImageFromPrompt(...);
```

语义变为：

- `[]` → false
- `[undefined, undefined]` → false
- `["a", undefined]` → false
- `["a", "b"]` → true

---

## 4. 当前主按钮行为

主按钮：**生成一张分镜图**

行为：

1. 读取当前选中的 ShotNode。
2. 获取每个 Shot 的已有单图 URL。
3. 计算 composite layout。
4. 构建“只输出一张完整图片，不要拆成多张单图”的 composite prompt。
5. 判断 `shouldComposeStoryboardLocally(imageUrls)`。
6. 全部有图时走本地合成。
7. 不全部有图时走一次模型生成。
8. 创建一个 Composite ImageNode。
9. 为所有选中 Shot 创建到 Composite ImageNode 的 `storyboard-composite` edge。

主按钮不会调用 `handleGenerateShotImage`，不会批量补单图。

---

## 5. 当前次按钮行为

次按钮：**分别生成单图**

行为仍保持原语义：

1. 遍历选中的 Shot。
2. 过滤出缺少单图的 Shot。
3. 对缺图 Shot 调用 `handleGenerateShotImage`。
4. 每个 Shot 生成 / 更新自己的 ImageNode。
5. 使用原有 Shot → Image 关系语义：`generated-image`。
6. 不创建 composite ImageNode。
7. 不使用 `storyboard-composite` relation。

本轮没有改变次按钮逻辑。

---

## 6. 全部已有单图时的处理逻辑

输入：

```text
选中 4 个 Shot
4 个 Shot 都能找到 imageUrl
```

行为：

```text
shouldComposeStoryboardLocally(imageUrls) === true
→ composeStoryboardGrid()
→ canvas.toDataURL()
→ persistImageDataUrl()
→ IndexedDB assetId + objectURL
→ Composite ImageNode
```

安全点：

- `canvas.toDataURL()` 的结果不会直接写入 node.data.imageUrl。
- 它会先进入 `persistImageDataUrl()`。
- node.data.imageUrl 使用 objectURL。
- node.data.assetId 保留 IndexedDB 资产引用。
- localStorage 保存前由 `sanitizeNodesForPersistence()` 移除 objectURL。

---

## 7. 全部没有单图时的处理逻辑

输入：

```text
选中 4 个 Shot
0 个 Shot 有可用单图
```

行为：

```text
shouldComposeStoryboardLocally(imageUrls) === false
→ generateImageFromPrompt()
→ 只调用一次 /api/ai/generate-image
→ 生成一张完整 2×2 多格分镜图
→ Composite ImageNode
```

不会：

- 不调用 `handleGenerateShotImage` 4 次。
- 不逐个生成单图。
- 不创建 4 个单图 ImageNode。
- 不先生成单图再合成。

---

## 8. 混合情况处理逻辑

输入：

```text
选中 4 个 Shot
其中 1～3 个 Shot 有单图，剩余 Shot 缺图
```

行为：

```text
shouldComposeStoryboardLocally(imageUrls) === false
→ generateImageFromPrompt()
→ 只调用一次模型生成完整多格分镜图
```

这是本轮最关键修正。混合情况不再进入本地合成分支。

---

## 9. 4 Shot → 2×2 默认规则

新增纯函数：

```ts
getStoryboardCompositeLayout(shotCount)
```

当前规则：

| Shot 数量 | columns | rows | label |
|---:|---:|---:|---|
| 1 | 1 | 1 | 1x1 |
| 2 | 2 | 1 | 2x1 |
| 3 | 3 | 1 | 3x1 |
| 4 | 2 | 2 | 2x2 |
| 5+ | 3 | ceil(n/3) | 3xN |

测试已覆盖 4 Shot → 2×2。

---

## 10. Composite ImageNode 数据结构说明

Composite ImageNode 的核心 data 字段：

```ts
{
  title: `${selectedShotNodes.length} 格分镜图`,
  imageUrl: result.imageUrl,
  assetId: result.assetId,
  nodeKind: "ai-generated-image",
  source: "generated",
  sourceType: "shot",
  sourcePrompt,
  prompt: compositePrompt,
  generation: completedSnapshot,
  generationId: requestId,
  generatedAt: completedAt,
  generationOutput: {
    type: "storyboard-composite",
    sourceShotIds: shotNodeIds,
    layout: { columns: cols, rows },
  },
  persistence: result.assetId ? "indexeddb" : "remote",
}
```

说明：

- `generationOutput.type = "storyboard-composite"` 标识这是多 Shot 合成结果。
- `sourceShotIds` 保留来源 Shot 列表。
- `layout` 保留布局信息。
- `assetId` 存在时表示图片实际在 IndexedDB 中。
- `imageUrl` 可能是 objectURL 或 remote URL，但保存到 localStorage 前会被清理。

---

## 11. storyboard-composite edge 说明

新增 helper：

```ts
createStoryboardCompositeEdges({
  sourceShotIds,
  compositeNodeId,
  existingEdges,
  removePreviousCompositeEdgesForSources,
  edgeStyle,
})
```

每条 edge：

```ts
{
  id: `edge-compose-${shotId}-${compositeNodeId}`,
  source: shotId,
  target: compositeNodeId,
  type: "creative",
  animated: true,
  data: {
    relation: "storyboard-composite",
    sourceType: "shot",
    targetType: "image",
  },
}
```

---

## 12. 重复 edge 防护

当前防护包含两层：

1. `sourceShotIds` 会先去重。
2. 对同一个 `source -> compositeNodeId` pair，如果已有 `storyboard-composite` edge，不再重复创建。

当前 `StarCanvas.tsx` 仍沿用 MVP 策略：

```ts
removePreviousCompositeEdgesForSources: true
```

含义：

- 新建 composite 时，会移除这些 Shot 指向旧 composite 的 `storyboard-composite` edge。
- 保留它们的 `generated-image` 单图 edge。
- 优点：画布不会出现多条旧 composite 血缘线干扰当前版本。
- 风险：旧 Composite ImageNode 仍存在，但旧 lineage edge 会被移除。若后续要做版本历史，应改为“每个 composite 内不重复，但不同版本 composite 保留各自 edge”。

---

## 13. 图片持久化安全检查

本轮确认：

- 本地合成使用 `composeStoryboardGrid()` 返回 `data:image/png;base64,...`。
- 调用方立即使用 `persistImageDataUrl()` 写入 IndexedDB。
- Composite ImageNode 写入 `imageUrl: persisted.objectUrl` 与 `assetId: persisted.assetId`。
- `useCanvasPersistence.ts` 保存前调用 `sanitizeNodesForPersistence(nodes)`。
- `sanitizePersistedCanvas.ts` 会移除：
  - `blob:`
  - `data:image`
  - `data:video`
  - `data:audio`
  - `base64`
  - `b64_json`
  - `generation.referenceImage.dataUrl/base64`
  - `generationOutput.outputImageUrl` 等深层 runtime URL 字段。

新增测试确认 composite 场景下：

- `imageUrl: blob:...` 被移除。
- `generation.referenceImage.dataUrl/base64` 被移除。
- `generationOutput.outputImageUrl: data:image...` 被移除。
- `assetId`、`persistence`、`sourceShotIds`、`layout` 等 lineage metadata 保留。

结论：本轮未发现新的 `blob:` / `data:image` / base64 持久化风险。

---

## 14. 新增 / 修改测试说明

### 新增：`storyboardComposite.test.ts`

覆盖：

1. `shouldComposeStoryboardLocally`
   - `[] → false`
   - `[undefined, null] → false`
   - `["a", undefined] → false`
   - `["a", "b"] → true`

2. `getStoryboardCompositeLayout`
   - 4 Shot → 2×2
   - 3 Shot → 3×1
   - 5 Shot → 3×2

3. `buildStoryboardCompositePrompt`
   - prompt 包含 `生成一张 2x2 的电影分镜图`
   - prompt 包含 `只输出一张完整图片，不要拆成多张单图`
   - sourcePrompt 按镜头顺序拼接

4. `createStoryboardCompositeEdges`
   - 每个 Shot 创建一条 `storyboard-composite` edge
   - 重复 Shot id 去重
   - 已有同 pair edge 不重复创建
   - 可移除旧 composite edge 且保留 `generated-image` edge

5. `getShotImageUrlFromCanvas`
   - 优先使用 `shot.generatedImageUrl`
   - fallback 到 linked image node 的 `sourceShotId`

### 修改：`sanitizePersistedCanvas.test.ts`

新增 composite ImageNode 持久化安全测试。

---

## 15. 完整验证命令结果

### typecheck

命令：

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web typecheck
```

结果：通过，exit code 0。

### lint

命令：

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint
```

结果：通过，exit code 0。

备注：仍有既有 warning，数量 32，非本轮新增阻塞项；无 error。

### test

命令：

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
```

结果：通过。

最终统计：

```text
tests 255
suites 40
pass 255
fail 0
cancelled 0
skipped 0
todo 0
```

### build

命令：

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

结果：通过，exit code 0。

Next.js 16.2.6 production build compiled successfully。

---

## 16. 手动验收步骤

建议手动验收：

### A. 全部已有单图

1. 创建 / 拆分 4 个 ShotNode。
2. 分别生成 4 张单图，确保每个 Shot 都有对应 ImageNode。
3. 多选 4 个 ShotNode。
4. 点击“生成一张分镜图”。
5. 预期：
   - 不调用模型生成完整图。
   - 本地合成一张 2×2 图。
   - 只新增一个 Composite ImageNode。
   - 4 个 Shot 都连接到这个 Composite ImageNode。

### B. 全部没有单图

1. 创建 4 个 ShotNode，但不生成单图。
2. 多选 4 个 ShotNode。
3. 点击“生成一张分镜图”。
4. 预期：
   - 只调用一次模型生成。
   - 不生成 4 张单图。
   - 只新增一个 Composite ImageNode。
   - edge relation 均为 `storyboard-composite`。

### C. 混合情况

1. 4 个 Shot 中只给 1～3 个生成单图。
2. 多选 4 个 ShotNode。
3. 点击“生成一张分镜图”。
4. 预期：
   - 不进入本地合成。
   - 不批量补单图。
   - 只调用一次模型生成完整 2×2 图。
   - 只新增一个 Composite ImageNode。

### D. 次按钮

1. 多选多个 Shot。
2. 点击“分别生成单图”。
3. 预期：
   - 逐个 Shot 生成 / 更新自己的 ImageNode。
   - 不创建 Composite ImageNode。
   - 不创建 `storyboard-composite` edge。

### E. 持久化安全

1. 生成 composite 图后刷新页面。
2. 检查 localStorage `startrails_canvas`。
3. 预期：不包含 `blob:`、`data:image`、大 base64。

---

## 17. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 旧 composite edge 会被移除 | 当前 MVP 策略会移除选中 Shot 指向旧 composite 的 edge | 后续如果做版本历史，需要保留不同 composite 版本的 edge |
| 主流程仍在 `StarCanvas.tsx` 内 | 已抽部分纯函数，但主 handler 仍在大组件中 | 后续可继续抽 composite node creation 纯函数 |
| 组件级交互未做浏览器自动化测试 | 本轮以纯函数测试 + build 验证为主 | 后续可用 Playwright 做手动路径自动化 |
| localStorage 安全依赖 sanitizer | 当前机制有效，但仍需持续测试新增字段 | 每次新增图片字段都要补 sanitize test |
| lint 仍有既有 warning | 32 个 warning 非本轮新增 | 可后续单独做 lint cleanup，不要混入 P3-Fix |

---

## 18. 是否可以进入“多格分镜设置面板 MVP”

可以进入，但建议先手动验收一次 A/B/C/D 四种场景。

进入 P3B 的前提已满足：

- typecheck 通过。
- lint 通过，无 error。
- test 通过，255 tests / 40 suites / 255 pass。
- build 通过。
- `imageUrls.some(...)` 语义已移除。
- 混合情况已变为一次模型生成完整多格图。
- localStorage / generation snapshot 未发现新增图片持久化风险。

P3B 建议范围仍保持克制：

```text
布局：Auto / 2×2 / 1×4 / 4×1
显示镜头编号：开关
统一风格 Prompt：文本框
生成策略：自动 / 始终调用模型生成
```

暂时不要做角色参考图、视频、Agent、资产库重构、多模型高级参数。
