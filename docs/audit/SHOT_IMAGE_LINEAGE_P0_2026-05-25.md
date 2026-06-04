# SHOT IMAGE LINEAGE P0 报告

日期：2026-05-25
项目：Startrail Canvas / 星轨画布

## 1. 本轮目标

本轮只做 P0 产品修复：**点击任意 ShotNode 的“生成图片”后，必须在该 ShotNode 右侧创建或更新一个 ImageNode，并通过 edge 建立 Shot → Image 血缘链路。**

不做范围：不重构完整 ShotNode UI、不做完整多选合成、不升级依赖、不全仓格式化、不改 AI 模型接口。

## 2. 当前 Shot 生图链路审计结果

| 文件 | 函数/组件 | 当前职责 | 当前生成结果保存在哪里 | 是否创建 ImageNode | 是否创建 edge | 风险 |
|---|---|---|---|---|---|---|
| `components/nodes/ShotNode.tsx` | `ShotNode` | 展示镜头描述、visualPrompt、生成按钮、小缩略图 | 读取 `shot.generatedImageUrl` | 否，仅派发事件 | 否 | 文案不清楚，用户不知道生图实际使用哪个字段；结果藏在节点内部小预览 |
| `StarCanvas.tsx` | `handleGenerateShotImage` | 接收 ShotNode 生成事件并调用图片生成 | `shot.generatedImageUrl`、`shot.generatedImageNodeId`、ImageNode data | 是 | 是 | 旧逻辑标题使用 shot title + “画面”；prompt 未 trim；空 prompt 未阻止；重复节点只依赖 `generatedImageNodeId`，缺少 sourceShotId/edge 兜底 |
| `utils/imageGeneration.ts` | `generateImageFromPrompt` | 调用 `/api/ai/generate-image`，把 data:image 持久化到 IndexedDB | 返回 display objectURL + assetId | 否 | 否 | objectURL 只应用于运行期显示，必须靠 sanitize 避免持久化污染 |
| `components/nodes/ImageNode.tsx` | `ImageNode` | 展示图片、支持图生图 | `data.imageUrl` / `assetId` | 自身是显示节点 | 自身不创建 Shot edge | 可显示 objectURL；持久化由 canvas sanitize 兜底 |
| `lib/ai/createGenerationSnapshot.ts` | `createImageGenerationSnapshot` | 记录生成血缘快照，清理 reference runtime URL | `generation` | 否 | 否 | 可复用，避免 base64/blob 进入快照 |
| `lib/storage/sanitizePersistedCanvas.ts` | `sanitizePersistedNodeData` | 深层清理 blob/data:image 等运行期 URL | localStorage 保存前清理 | 否 | 否 | 需要确认新增 lineage 字段不被误删，assetId 保留 |

重点问题回答：

1. ShotNode 点击“生成图片”调用 `window.dispatchEvent("starcanvas:generate-shot")`，最终进入 `StarCanvas.tsx` 的 `handleGenerateShotImage`。
2. 实际 prompt 现在规范为 `shot.visualPrompt?.trim() || shot.description?.trim()`。
3. 生成结果写入 Shot 的 `generatedImageUrl/generatedImageAssetId/generatedImageNodeId/generationStatus/lastGeneratedAt`，并写入右侧 ImageNode。
4. 如果生成结果有 `assetId`，会保存到 Shot 和 ImageNode。
5. 运行期 `generatedImageUrl/imageUrl` 可能是 objectURL，仅用于 UI 显示；持久化时会被 sanitize 清理。
6. 现在会创建或更新独立 ImageNode。
7. 默认位置在 ShotNode 右侧：`x = shotNode.position.x + shotWidth + 320`，拿不到宽度时使用 displayWidth/300。
8. 现在会创建 Shot → Image edge，并写入 `data.relation = "generated-image"`。
9. 失败时 ShotNode 写入 `status: "error"`、`generationStatus: "failed"`、`errorMessage/generationError`，loading 会结束。
10. localStorage 持久化前通过 `sanitizePersistedCanvas` 清理 blob/data:image；新增测试覆盖 lineage 字段保留。

## 3. 修改文件列表

| 文件 | 修改内容 | 原因 | 风险 | 验证方式 |
|---|---|---|---|---|
| `apps/web/src/app/canvas/StarCanvas.tsx` | 重写 `handleGenerateShotImage` 的核心链路：空 prompt 拦截、创建 generation snapshot、调用 helper 创建/更新 ImageNode、创建/更新 lineage edge、失败写入错误状态 | 让 Shot 单镜头出图结果显式出现在右侧，并具备血缘 | 改动集中在已有函数，影响 Shot 生图路径 | typecheck/lint/test/build |
| `apps/web/src/app/canvas/components/nodes/ShotNode.tsx` | 最小 UI 文案增强：增加“剧本文本”“生图 Prompt”“为空时使用剧本文本”；成功后提示“已生成右侧图片节点” | 让 prompt 来源更清楚，避免用户误解 | 增加一个 `<img>` warning，但全局 warning 仍为 32 | lint/build |
| `apps/web/src/app/canvas/components/canvas/types.ts` | 补充 Shot 和 CanvasNodeData 的来源血缘字段 | 让 TypeScript 知道 ImageNode lineage 字段 | 类型字段均为可选，兼容旧数据 | typecheck |
| `apps/web/src/lib/storage/sanitizePersistedCanvas.test.ts` | 新增 lineage metadata 保留与 runtime URL 清洗测试 | 防止 sourceShot/sourcePrompt 被误删，防止 blob 持久化 | 无 | test |

## 4. 新增文件列表

| 文件 | 内容 | 原因 | 验证方式 |
|---|---|---|---|
| `apps/web/src/lib/storyboard/createShotImageNode.ts` | 纯函数 helper：根据 shotNode、existingNodes、existingEdges 和 generationResult 输出 ImageNode、Edge、create/update 模式 | 把 Shot → Image 结构生成逻辑从 UI 状态更新中拆出，便于测试 | typecheck/test |
| `apps/web/src/lib/storyboard/createShotImageNode.test.ts` | 覆盖创建 ImageNode、创建 edge、通过 sourceShotId 更新、通过 generated-image edge 更新、无 order fallback 标题 | 保证 P0 核心血缘逻辑稳定 | test |

## 5. 数据结构变化

### ShotNode `data.shot`

新增/规范以下可选字段：

```ts
generatedImageAssetId?: string
generationStatus?: "idle" | "generating" | "succeeded" | "failed"
generationError?: string
lastGeneratedAt?: string
```

### ImageNode `data`

新增/规范以下可选字段：

```ts
sourceType: "shot"
sourceShotId: string
sourceStoryboardNodeId?: string
sourceShotOrder?: number
sourceShotTitle?: string
sourcePrompt: string
generatedAt: string
generationId?: string
assetId?: string
model?: string
generation?: ImageGenerationSnapshot
generationOutput?: {
  prompt: string
  finalPrompt?: string
  model?: string
  sourceShotId: string
  sourceStoryboardNodeId?: string
  generatedAt: string
}
```

### Edge `data`

```ts
{
  relation: "generated-image",
  sourceType: "shot",
  targetType: "image",
  prompt: string,
  generatedAt: string
}
```

## 6. 生成成功链路说明

1. 用户点击 ShotNode 的“生成图片”。
2. ShotNode 派发 `starcanvas:generate-shot` 事件。
3. `StarCanvas.tsx` 进入 `handleGenerateShotImage(nodeId)`。
4. 读取 shot，并计算：`prompt = shot.visualPrompt?.trim() || shot.description?.trim()`。
5. 创建 `createImageGenerationSnapshot`，ShotNode 状态改为 `generating`。
6. 调用 `generateImageFromPrompt`。
7. 如果 API 返回 data:image，则 `generateImageFromPrompt` 先存入 IndexedDB，返回 `objectUrl + assetId`。
8. 调用 `createShotImageNode` 生成或更新右侧 ImageNode 和 lineage edge。
9. 更新 ShotNode：`generatedImageUrl/generatedImageAssetId/generatedImageNodeId/status/generationStatus/lastGeneratedAt`。
10. 更新或插入 ImageNode，更新或插入 Shot → Image edge。

## 7. 生成失败链路说明

- 空 prompt：不调用生成接口，直接写入错误：`请先填写生图 Prompt 或镜头描述`。
- API/网络失败：ShotNode 写入 `status: "error"`、`generationStatus: "failed"`、`errorMessage`、`generationError`。
- 失败时不会创建空 ImageNode。
- finally 由状态流结束 loading；ShotNode 根据 `shot.status === "generating"` 控制按钮禁用。

## 8. ImageNode 创建/更新策略

优先级：

1. `shot.generatedImageNodeId` 指向的节点存在 → 更新。
2. 已有 ImageNode 满足 `node.data.sourceShotId === shotNode.id` → 更新。
3. 已有 edge 满足 `edge.source === shotNode.id && edge.data.relation === "generated-image"` → 更新该 edge target。
4. 都找不到 → 在 ShotNode 右侧创建新 ImageNode。

标题规则：

- 有 `shot.order`：`镜头 03 图片`
- 无 `shot.order`：`分镜图片`

## 9. Edge 创建/更新策略

- edge source 永远是 ShotNode id。
- edge target 是关联 ImageNode id。
- edge id：`edge-generated-image-${shotNode.id}-${imageNode.id}`。
- 重复生成时过滤同 id 或相同 source/target/relation 的旧 edge，再写入新的 edge，避免重复血缘边堆积。

## 10. 如何避免重复生成多个 ImageNode

- 重复点击时不只依赖 `shot.generatedImageNodeId`。
- 还通过 `imageNode.data.sourceShotId` 和 `edge.data.relation === "generated-image"` 兜底。
- 找到旧 ImageNode 时 helper 返回 `mode: "update"`，状态更新中替换旧节点 data，而不是 concat 新节点。

## 11. 如何保证不持久化 blob/data:image

- `generateImageFromPrompt` 遇到 `data:image` 先写入 IndexedDB，返回 `objectUrl + assetId`。
- ImageNode/ShotNode 运行期可能持有 objectURL 用于显示，但 localStorage 保存前通过 `sanitizePersistedCanvas` 清理：
  - `imageUrl`
  - `assetUrl`
  - `generatedImageUrl`
  - `outputImageUrl`
  - `generationOutput.images[]`
  - `generation.referenceImage.url/dataUrl/base64`
- 新增测试确认：
  - `imageUrl = blob:` 被清理。
  - `shot.generatedImageUrl = blob:` 被清理。
  - `assetId/sourceShotId/sourceStoryboardNodeId/sourcePrompt/generatedAt` 保留。
  - `shot.generatedImageAssetId` 保留。

## 12. 新增测试

| 测试文件 | 覆盖内容 |
|---|---|
| `createShotImageNode.test.ts` | 创建 ImageNode；标题为 `镜头 03 图片`；位置在右侧；data 包含 sourceShotId/sourcePrompt/generatedAt；edge source/target/relation 正确；存在 sourceShotId 时 update；存在 generated-image edge 时 update；无 order fallback 标题 |
| `sanitizePersistedCanvas.test.ts` | 清理 runtime image URL；保留 lineage metadata；保留 assetId 和 generatedImageAssetId |

## 13. 验证命令和结果

| 命令 | 结果 |
|---|---|
| `pnpm --filter web typecheck` | 通过 |
| `pnpm --filter web lint` | 0 error / 32 warnings，通过；warning 数未高于当前 32 |
| `pnpm --filter web test` | 235 tests / 33 suites，0 fail，通过 |
| `pnpm --filter web build` | 通过，Next.js production build success |

## 14. 手动验收步骤

1. 打开：`http://localhost:3000/canvas`
2. 新建或拆分出一个 ShotNode。
3. 在 ShotNode 中填写：
   - 剧本文本：`白天的天安门广场，红墙金瓦，游客缓慢走过。`
   - 生图 Prompt：`cinematic wide shot of Tiananmen Square in daylight, red walls, golden roof, realistic`
4. 点击生成图片。

通过标准：

- ShotNode 显示生成中。
- 生成成功后，ShotNode 右侧出现 ImageNode。
- ImageNode 显示图片。
- ImageNode 标题是 `镜头 XX 图片`。
- ShotNode 和 ImageNode 有连线。
- `JSON.stringify(localStorage).includes('blob:')` 返回 `false`。
- `JSON.stringify(localStorage).includes('data:image')` 返回 `false`。

重复生成验收：

1. 再次点击同一个 ShotNode 的生成图片。
2. 通过标准：更新已有 ImageNode，不无限创建重复 ImageNode；血缘线保持一条合理关系边。

Prompt fallback 验收：

1. 清空 visualPrompt，只保留剧本文本，再生成。
2. 通过标准：使用剧本文本作为 prompt，能生成图片。

空 prompt 验收：

1. 清空 visualPrompt 和 description，再生成。
2. 通过标准：不调用生成接口；显示错误：`请先填写生图 Prompt 或镜头描述`。

失败验收：

1. 模拟 API 失败或断网。
2. 通过标准：loading 结束；ShotNode 显示错误；不创建空 ImageNode；localStorage 不污染。

## 15. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| ImageNode 运行期 `imageUrl` 仍可能是 objectURL | 用于 UI 显示是必要的；持久化依赖 sanitize 清理 | 后续可让 hydrate 流程更明确区分 displayUrl 与 persisted assetId |
| `generateImageFromPrompt` 返回结构较薄 | 目前只统一返回 imageUrl/assetId，缺少 requestId/usage 等完整 metadata | 后续 P2/P3 可统一图片生成结果类型 |
| ShotNode UI 仍不是三段式完整设计 | 本轮只做最小 label/提示增强 | P2 再系统整理 ShotNode UI |
| Storyboard Source → Shot 顺序/标题仍未整理 | 不在本轮范围 | 进入 P1 处理 |
| 多选合成依赖 `generatedImageUrl` | 目前已可用，但更理想是从 ImageNode/assetId 读取 | P3 处理 Grid 和批量链路 |

## 16. 后续建议

建议进入 P1：**拆分顺序和标题整理**。

P1 目标：

- Source Storyboard → Shot 有清晰 edge。
- Shot 按原文顺序稳定排列。
- 标题统一为：`镜头 01 / 简短标题`。
- `order/sourceStoryboardNodeId/title/description/visualPrompt` 字段可靠。
- 节点标题不再是一整段长文本。

## 非技术总结

这次解决的是：**用户点击某个分镜的“生成图片”后，不再需要猜图片去哪了。**

现在行为应该是：

```text
Shot 03 ───→ 镜头 03 图片
```

用户会看到：

- 当前分镜正在生成；
- 成功后右侧出现图片节点；
- 图片节点标题清楚；
- 分镜和图片之间有线；
- 再点一次会更新同一张结果节点，不会无限堆重复图。

还留到下一轮的问题：

- 分镜拆分顺序；
- Shot 标题规范；
- Source Storyboard 到 Shot 的连线；
- ShotNode UI 三段式重构；
- 多选合成和九宫格体验完善。

结论：P0 已完成，可以进入 P1：拆分顺序和标题整理。
