# Canvas Snapshot Safety Guard - 2026-05-25

## 1. 本轮目标

为 StarCanvas 已完成的“工作记录定位 + 手动关键版本快照 MVP”补齐持久化安全与恢复防护，避免将图片大数据、运行时 URL、base64、不可序列化对象或结构损坏的快照写入/恢复。

本轮明确不做：

- 自动关键节点快照
- 资产库重构
- 图片 IndexedDB 持久化链路重构
- docx/pdf 文档解析
- 新依赖引入

## 2. 修改文件

新增：

```text
apps/web/src/app/canvas/utils/canvasSnapshotSanitizer.ts
apps/web/src/app/canvas/utils/canvasSnapshotSanitizer.test.ts
apps/web/src/app/canvas/stores/useCanvasSnapshotStore.test.ts
```

修改：

```text
apps/web/src/app/canvas/types/canvas-snapshot.ts
apps/web/src/app/canvas/stores/useCanvasSnapshotStore.ts
apps/web/src/app/canvas/StarCanvas.tsx
```

## 3. Sanitizer 规则

保存快照前统一调用 `sanitizeAndValidateCanvasSnapshot()`。

核心规则：

1. 复用现有 `sanitizeNodesForPersistence()` 清理节点数据。
2. 保留普通 JSON metadata。
3. 保留 `assetId`、尺寸、来源、prompt、lineage 等安全元数据。
4. 移除 `blob:` 运行时 URL。
5. 移除 `data:image` / `data:video` / `data:audio`。
6. 移除常见 base64 字段，例如 `dataUrl`、`base64`、`b64_json`。
7. 移除 `generation.raw` 内可能出现的大图字段。
8. 重新计算 `nodeCount` / `edgeCount`。
9. 补齐 `schemaVersion: 1`。
10. 非法 viewport 会被移除，不阻断节点/连线快照保存。

当前策略下，普通 remote URL 若不属于运行时 URL，会按现有项目持久化策略保留。

## 4. Validate 规则

恢复或写入前使用 `validateCanvasSnapshot()` 校验：

1. snapshot 必须是对象。
2. `id` 必须是非空字符串。
3. `title` 必须是非空字符串。
4. `createdAt` 必须是合法时间。
5. `schemaVersion` 必须等于当前版本 `1`。
6. `nodes` / `edges` 必须是数组。
7. `viewport` 若存在，必须满足 `x/y/zoom` 均为有限数字且 `zoom > 0`。
8. 每个 node 必须有非空 `id`。
9. 每个 node 必须有合法 `position.x/y`。
10. 每条 edge 必须有非空 `id`、`source`、`target`。
11. edge 的 `source/target` 必须能在节点集合中找到。
12. 校验后不得残留 `blob:` / `data:image` 等运行时 URL。
13. 单个快照估算体积不得超过 4MB。

## 5. localStorage 安全检查

快照存储 key：

```text
startrails_canvas_snapshots:current
```

写入前会先：

```text
snapshot -> sanitize -> validate -> trim -> JSON.stringify -> localStorage.setItem
```

因此正常路径下 localStorage 不应出现：

```text
blob:
data:image
大段 base64 图片字段
```

## 6. 4MB 限制处理

`useCanvasSnapshotStore` 不再“直接保存失败就保持内存状态”，而是调用 `trimSnapshotsForStorage()`：

1. 先清理并校验每个快照。
2. 按时间倒序排列。
3. 最多取 30 个。
4. 逐个加入，若加入后总 JSON 超过 4MB，则跳过该快照。
5. 将最终可安全保存的快照列表写入 localStorage。

这保证了内存状态与 localStorage 状态一致，避免 UI 显示了实际没有保存的快照。

## 7. 30 个快照处理

最多保留 30 个快照：

```text
MAX_SNAPSHOTS = 30
```

超过后保留最新 30 个，旧快照自动淘汰。

## 8. corrupted localStorage 处理

`loadSnapshots()` 捕获 JSON parse 或结构异常：

```text
corrupted localStorage -> []
```

不会导致应用崩溃。

测试已覆盖 corrupted localStorage 场景。

## 9. 快照恢复防护

`StarCanvas.tsx` 恢复快照前新增保护：

```text
snapshot -> sanitizeAndValidateCanvasSnapshot(snapshot)
```

若失败：

- 不执行 `setNodes`
- 不执行 `setEdges`
- 不恢复 viewport
- 写入一条“恢复关键版本失败”的工作记录

若成功：

1. `setNodes(safeSnapshot.nodes)`
2. `setEdges(safeSnapshot.edges)`
3. 清空当前选中节点
4. `requestAnimationFrame` 后恢复 viewport
5. 写入“恢复关键版本”工作记录
6. 关闭工作记录面板

viewport 恢复失败不会阻断 nodes/edges 恢复；若无 viewport，则回退到 fitView。

## 10. 测试覆盖

新增 `canvasSnapshotSanitizer.test.ts`，覆盖：

1. `assetId` 保留。
2. 文本字段保留。
3. `blob:` 字段移除。
4. `data:image` 字段移除。
5. base64 图片字段移除。
6. generation raw image payload 移除。
7. 自动补齐 `schemaVersion`。
8. 重新计算 node/edge count。
9. 非法 viewport 清理。
10. 非法 edge source/target 拒绝。
11. 残留运行时 URL 的快照拒绝。
12. 超过 30 个快照保留策略。
13. 超过 4MB 快照跳过策略。

新增 `useCanvasSnapshotStore.test.ts`，覆盖：

1. corrupted localStorage 不崩溃。
2. 保存快照前清理 runtime image URL。
3. localStorage 不写入 `blob:` / `data:image`。
4. `assetId` 保留。
5. 最多保留 30 个快照。
6. 删除快照并持久化。
7. 超大快照被拒绝，已有安全快照保留。

## 11. 验证命令结果

### typecheck

命令：

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web typecheck
```

结果：通过。

### lint

命令：

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web lint
```

结果：通过，0 errors，32 warnings。

说明：warnings 为项目既有 React hooks / img alt / next image 等警告，不是本轮新增阻断错误。

### test

命令：

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web test
```

结果：通过。

统计：

```text
tests 296
suites 52
pass 296
fail 0
```

### build

命令：

```bash
NODE_OPTIONS="" pnpm -C /Users/wuyongnaren/Projects/starcanvas-main --filter web build
```

结果：通过。

Next.js 生产构建成功，`/canvas` 页面正常生成。

## 12. 手动验收步骤

### A. 保存关键版本

1. 打开 `/canvas`。
2. 创建 TextNode / ShotNode / ImageNode。
3. 打开工作记录面板。
4. 点击“保存当前画布版本”。

预期：关键版本列表新增一条，显示时间、节点数、连线数。

### B. 恢复关键版本

1. 保存快照。
2. 删除或移动节点。
3. 点击恢复快照。

预期：nodes / edges 恢复；viewport 恢复；写入“恢复关键版本”记录；面板关闭。

### C. localStorage 图片安全

1. 创建或生成 ImageNode。
2. 保存快照。
3. 检查 `localStorage.startrails_canvas_snapshots:current`。

预期：

```text
不出现 blob:
不出现 data:image
不出现大段 base64
保留 assetId / metadata
```

### D. corrupted localStorage

1. 手动写入非法 JSON 到 `startrails_canvas_snapshots:current`。
2. 刷新页面。

预期：页面不崩溃，快照列表为空。

## 13. 是否可以进入自动关键节点快照

建议：可以进入，但不要直接全量自动化。

推荐下一步：

```text
P5B：低频自动关键节点快照
```

只在少数高价值节点触发：

1. 手动上传文档后。
2. 生成完整故事后。
3. 拆 Shot 后。
4. 生成分镜图后。

并增加去重/节流策略：同类事件短时间内只保留一个快照，避免 localStorage 快速膨胀。

在进入 P5B 前，建议先做一次浏览器手动验收，尤其是 ImageNode + IndexedDB 资产缺失场景。
