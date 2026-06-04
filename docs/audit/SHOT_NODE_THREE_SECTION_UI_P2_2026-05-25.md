# SHOT_NODE_THREE_SECTION_UI_P2_2026-05-25

## 1. 本轮目标

P2 目标：在不重做视觉风格、不引入新 UI 库、不改 AI 接口的前提下，把 ShotNode 内部表达整理为更清楚的三段式：

1. 剧本文本
2. 生图 Prompt
3. 输出状态

解决用户的核心困惑：

- 生图到底参考哪块文字？
- 点了生成以后现在处于什么状态？
- 图片是否已经生成到右侧 ImageNode？
- 失败时哪里看错误？

## 2. 当前 ShotNode 审计结果

| 区域 | P2 前状态 | 问题 | P2 处理 |
|---|---|---|---|
| Header 状态 | 显示 `shot.status` 或 `draft` | 偏技术字段，用户不直观 | 改为中文状态：待生成/生成中/已出图/失败 |
| 剧本文本 | 已有 label，但层级不明显 | 用户仍可能不知道这是原剧本 | 改为 `1. 剧本文本`，并标注“镜头画面原文” |
| 生图 Prompt | 已有 label 和提示 | 优先级说明还不够明确 | 改为 `2. 生图 Prompt`，标注“优先用于生成；为空时使用剧本文本” |
| 输出 | 错误和缩略图分散显示 | 状态、错误、成功提示不在一个区块 | 新增 `3. 输出状态` 区块统一承载 loading/failed/succeeded/idle |
| Loading | 按钮 spinner | 节点内部缺少状态说明 | 输出区增加“正在生成图片，成功后会更新右侧图片节点” |
| 成功 | 显示缩略图和“已生成右侧图片节点” | 信息可用但不集中 | 移入输出区，显示 ImageNode id（如有） |
| 失败 | 直接显示错误文本 | 没有明确“生成失败”前缀 | 输出区显示 `生成失败：...` |

## 3. 修改文件列表

| 文件 | 修改内容 | 原因 | 风险 | 验证方式 |
|---|---|---|---|---|
| `apps/web/src/app/canvas/components/nodes/ShotNode.tsx` | 增加 `hasGeneratedImage/statusLabel`；将内容整理为三段式 section；输出区统一展示生成中/成功/失败/待生成 | 提升分镜节点可理解性，减少“点了之后不知道发生什么”的困惑 | 只是 UI 最小整理，不改生成链路；节点高度可能需要用户拉大或滚动查看 | typecheck/lint/test/build + 浏览器手动验收 |

## 4. 数据结构变化

本轮没有新增数据字段，只读取已有字段：

| 字段 | 用途 |
|---|---|
| `shot.status` | 兼容旧状态：generating/done/error |
| `shot.generationStatus` | 新状态：generating/succeeded/failed |
| `shot.generatedImageUrl` | 缩略图展示 |
| `shot.generatedImageAssetId` | 判断已有生成资产 |
| `shot.generatedImageNodeId` | 判断右侧 ImageNode 已创建，并显示引用 |
| `shot.errorMessage` | 失败提示 |
| `shot.generationError` | 失败提示 |

## 5. UI 行为说明

### 待生成

输出区显示：

```text
尚未生成图片。点击下方按钮后，会在本镜头右侧创建图片节点。
```

### 生成中

输出区显示 spinner 和说明：

```text
正在生成图片，成功后会更新右侧图片节点
```

按钮禁用，避免重复点击并发创建多个 ImageNode。

### 成功

输出区显示：

```text
已生成右侧图片节点：{generatedImageNodeId}
```

如果当前有 `generatedImageUrl`，继续显示小缩略图。

### 失败

输出区显示：

```text
生成失败：{errorMessage || generationError}
```

## 6. 本轮没有做什么

- 没有重构 ShotNode 样式系统。
- 没有引入新组件库。
- 没有修改 AI 生成接口。
- 没有修改 ImageNode。
- 没有修改多选合成。
- 没有升级依赖。
- 没有全仓格式化。

## 7. 验证命令和结果

| 命令 | 结果 |
|---|---|
| `pnpm --filter web typecheck` | 通过 |
| `pnpm --filter web lint` | 0 error / 32 warnings（未高于当前基线） |
| `pnpm --filter web test` | 240 tests / 34 suites / 0 fail |
| `pnpm --filter web build` | 通过 |

备注：第一次 build 在收集 traces 阶段被 SIGTERM 中断，随后用更长 timeout 重新执行，第二次通过。

## 8. 手动验收步骤

1. 打开：`http://localhost:3000/canvas`
2. 新建/拆分出一个 ShotNode。
3. 观察 ShotNode：
   - 是否有 `1. 剧本文本`
   - 是否有 `2. 生图 Prompt`
   - 是否有 `3. 输出状态`
4. 两个文本都为空时点击生成：
   - 应显示 `生成失败：请先填写生图 Prompt 或镜头描述`
5. 填写剧本文本，不填 Prompt，点击生成：
   - 应使用剧本文本生成
   - 输出区显示生成中
   - 成功后右侧出现 ImageNode
   - 输出区显示已生成右侧图片节点
6. 填写 Prompt，再次生成：
   - 应优先使用 Prompt
   - 应更新已有 ImageNode，不重复创建
7. 模拟生成失败：
   - loading 结束
   - 输出区显示失败原因
   - 不创建空 ImageNode

## 9. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| ShotNode 内容变多 | 三段式会占更多垂直空间 | 当前节点内部可滚动；后续可增大默认高度或做折叠 |
| ImageNode id 对普通用户不友好 | 成功区显示 id 有助调试，但产品上略技术 | 后续可改为“点击定位图片节点” |
| 还没有节点内快捷定位 | 用户看到“右侧图片节点”后仍可能想一键跳转 | P3 可做“定位图片节点”按钮 |
| Prompt 与剧本文本还没有差异高亮 | 目前只是说明优先级 | 后续可展示“本次实际使用 Prompt” |

## 10. 后续建议

建议下一步进入 **P3：多选合成与九宫格状态整理**，但最好先做一次浏览器验收：

- 新拆分是否纵向排列舒服；
- ShotNode 三段式是否看得懂；
- 单镜头生成后右侧 ImageNode 是否贴近；
- localStorage 是否仍不包含 blob/data:image。

## 11. 非技术总结

这次解决的是 ShotNode 自己内部“不说人话”的问题。

现在一个分镜节点会明确告诉用户：

- 这里是原始剧本文本；
- 这里是生图 Prompt；
- 生图优先用 Prompt，空了才用剧本文本；
- 现在是待生成、生成中、已出图还是失败；
- 成功后图片会在右侧图片节点里。

还有哪些留到下一轮：

- 一键定位右侧图片节点；
- 九宫格/多选合成的状态展示；
- 旧画布节点整理；
- 更好的 ShotNode 折叠/展开体验。