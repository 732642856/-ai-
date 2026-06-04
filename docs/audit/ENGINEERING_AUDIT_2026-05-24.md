# Startrail Canvas / 星轨画布工程级自检与修复报告

生成时间：2026-05-24  
项目路径：`/Users/wuyongnaren/Projects/starcanvas-main/`  
检查范围：`apps/web` 前端主应用、AI 图片生成链路、画布持久化、分镜/九宫格链路、工程脚本与依赖风险。

---

## 1. 结论摘要

本轮继续完成了工程级自检中的 P0/P1 修复与验证，重点不是新增产品功能，而是把已经暴露的工程风险收口：

- TypeScript：通过。
- ESLint：已从“无法启动”修复为“可执行且 0 error，仅 warning”。
- Test：通过，`220 tests / 30 suites / 0 fail`。
- Build：通过，Next.js webpack 生产构建成功。
- localStorage 图片持久化：新增集中清洗工具，覆盖顶层与嵌套字段，避免 `blob:` / `data:image` / 大型 base64 写入 localStorage。
- AI 生成快照：新增统一 `createGenerationSnapshot` 工具，并接入 ImageNode / StarCanvas 图生图变体入口。
- 新增测试：补充 `sanitizePersistedCanvas` 与 `createGenerationSnapshot` 测试。

仍建议后续处理：现有 ESLint warning、Prettier 全仓格式不一致、`pnpm audit` 因 npm mirror registry 不支持 audit endpoint 而无法完成、`knip/depcheck` 的候选项需要人工确认后再删。

---

## 2. 技术栈判断

根据根目录和 `apps/web` 配置判断：

- 包管理：pnpm `10.33.0`。
- Monorepo：Turborepo。
- 前端框架：Next.js `16.2.6` App Router。
- React：React `19.2.4`。
- 类型系统：TypeScript strict mode。
- 画布：React Flow `@xyflow/react` v12。
- 状态管理：Zustand。
- 样式：Tailwind CSS v4 + 自定义 `DESIGN_TOKENS`。
- 测试：Node 内置 test runner：`node --test --experimental-strip-types`。
- 图片持久化：IndexedDB 存 Blob，localStorage 存轻量节点 JSON。

---

## 3. 主要目录结构

核心目录与职责：

- `apps/web/src/app/`：Next.js App Router 页面与 API routes。
- `apps/web/src/app/canvas/`：星轨画布主功能区。
- `apps/web/src/app/canvas/StarCanvas.tsx`：画布主组件，节点/边、菜单、快捷键、AI 变体、分镜流程核心入口。
- `apps/web/src/app/canvas/components/nodes/`：自定义节点组件，包括 `ImageNode`、`ContentNode`、`ShotNode`、`StoryboardGridNode`、`WorkflowNode`。
- `apps/web/src/app/canvas/hooks/`：画布拖拽、持久化、工作流运行、Chat 附件等 hooks。
- `apps/web/src/app/canvas/utils/`：分镜解析、九宫格合成、节点执行、布局等工具。
- `apps/web/src/lib/ai/`：AI 配置、请求清洗、错误归一化、生成快照工具。
- `apps/web/src/lib/assets/`：本地图片 IndexedDB 存储。
- `apps/web/src/lib/images/`：参考图预处理。
- `apps/web/src/lib/storage/`：本轮新增 localStorage 持久化清洗工具。

---

## 4. 核心数据流

### 4.1 图片上传 / AI 图片生成数据流

1. 用户上传图片或 AI 返回 `data:image`。
2. 前端通过 `persistImageFile()` / `persistImageDataUrl()` 写入 IndexedDB。
3. 节点只保存 `assetId`、`persistence`、`source`、尺寸、prompt、generation metadata。
4. 页面恢复时 `hydrateImageNodes()` 根据 `assetId` 从 IndexedDB 恢复 objectURL。
5. 保存 localStorage 前统一调用 `sanitizeNodesForPersistence()`，剥离运行期 URL 与大型 inline 图片数据。

### 4.2 图生图数据流

1. 图片节点存在 `assetId`。
2. 前端从 IndexedDB 读取 Blob。
3. `prepareReferenceImageForGeneration()` 压缩/缩放参考图。
4. `/api/ai/generate-image` 图生图走 `/images/edits` multipart/form-data。
5. 成功结果写 IndexedDB，并记录 `generation` / `generationOutput`。

### 4.3 分镜九宫格数据流

1. 文本节点右键“拆成镜头”或“拆成镜头并建九宫格”。
2. `storyboardParser.ts` 解析 JSON、结构化镜头、编号列表、Markdown 表格。
3. 生成 `shot` 节点和可选 `storyboardGrid` 节点。
4. 单镜头节点生成图片，图片写 IndexedDB。
5. 九宫格节点读取 9 个镜头图片，用 canvas 合成输出，再写 IndexedDB。

---

## 5. 最高风险模块

| 风险等级 | 模块 | 风险说明 | 本轮状态 |
|---|---|---|---|
| P0 | localStorage 持久化 | 若写入 `data:image` 或 `blob:`，会导致刷新失效、localStorage 超限、页面恢复异常 | 已新增集中清洗工具和测试 |
| P0 | AI 图生图入口 | 若参考图被忽略，会退化成文生图；若错误直接展示 HTML，用户体验差 | 已走 `/images/edits`，错误归一化已存在 |
| P1 | 分镜/九宫格节点 | 镜头图片 URL 可能嵌套保存在 `shot.generatedImageUrl` / `storyboardGrid.outputImageUrl` | 已纳入深层清洗 |
| P1 | ESLint 工程配置 | ESLint 9 缺 flat config 导致 lint 无法运行 | 已修复为可运行 |
| P1 | objectURL 生命周期 | objectURL 有注册表，但节点删除时尚未全面 revoke | 待后续专项处理 |
| P2 | Prettier | 全仓已有大量文件不符合当前 Prettier 输出 | 记录风险，未全仓改格式 |
| P2 | 依赖清理 | knip/depcheck 发现候选 unused 项，存在误报风险 | 记录风险，未盲删 |

---

## 6. 使用的检查工具与结果

| 工具/命令 | 结果 | 说明 |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 通过 | lockfile up to date；有 electron build scripts ignored warning |
| TypeScript `tsc --noEmit` | 通过 | 最终 exit code 0 |
| ESLint `pnpm --filter web lint` | 通过 | 从缺 config 修复到 0 error / 32 warnings |
| Test `pnpm --filter web test` | 通过 | `220 tests / 30 suites / 220 pass / 0 fail` |
| Build `pnpm --filter web build` | 通过 | Next.js 16 webpack 构建成功 |
| `pnpm audit --audit-level moderate` | 未完成 | registry `npmmirror` 无 audit endpoint，不应盲目切 registry |
| `depcheck` | 有候选项 | 根 devDependencies 被标记 unused，可能为 workspace 误报 |
| `madge --circular` | 通过 | 106 files，无循环依赖 |
| `knip --workspace apps/web` | 有候选项 | unused files/deps/exports 候选较多，需人工确认 |
| `npm-check-updates` | 仅查看 | patch/minor 更新存在，未盲升 |
| Prettier check | 未通过 | 109 个文件风格与 Prettier 不一致，未全仓改动 |

---

## 7. 本轮实际修复内容

### 7.1 修复 ESLint 9 无法运行

新增：

- `apps/web/eslint.config.mjs`

结果：

- 修复前：ESLint 报错找不到 `eslint.config.(js|mjs|cjs)`，无法启动。
- 修复后：ESLint 可运行，最终 `0 errors / 32 warnings`。

说明：

- React 19 compiler 相关规则（`react-hooks/purity`、`refs`、`set-state-in-effect`）当前作为 warning 处理，避免一次性大范围改动已有组件行为。

### 7.2 新增 localStorage 深层清洗工具

新增：

- `apps/web/src/lib/storage/sanitizePersistedCanvas.ts`
- `apps/web/src/lib/storage/sanitizePersistedCanvas.test.ts`

能力：

- 清洗顶层字段：`imageUrl`、`assetUrl`、`thumbnailUrl` 等。
- 清洗嵌套字段：`shot.generatedImageUrl`、`storyboardGrid.outputImageUrl`、`generation.referenceImage.dataUrl/base64`、`generationOutput.images[]` 等。
- 清洗运行期 URL：`blob:`。
- 清洗大型 inline 媒体：`data:image`、`data:video`、`data:audio`。
- 提供 `findRuntimeUrlLeaks()` 供开发环境健康检查。

### 7.3 接入 useCanvasPersistence

修改：

- `apps/web/src/app/canvas/hooks/useCanvasPersistence.ts`

变化：

- 移除局部 `sanitizeNodesForSave()`。
- 保存前统一调用 `sanitizeNodesForPersistence(nodes)`。
- dev 模式保存前用 `findRuntimeUrlLeaks()` 扫描深层泄漏路径。
- 修正 ESLint 禁用注释格式，避免被乱码解析成未知 rule。

### 7.4 新增统一生成快照工具

新增：

- `apps/web/src/lib/ai/createGenerationSnapshot.ts`
- `apps/web/src/lib/ai/createGenerationSnapshot.test.ts`

用途：

- 统一记录图片生成请求来源与状态：`requestId`、`mode`、`userPrompt`、`model`、`size`、`sourceNodeId`、`sourceAssetId`、`referenceImage`、`status`、`createdAt`。
- 避免 ImageNode / StarCanvas 各自手写 snapshot 结构导致字段不一致。

### 7.5 接入 ImageNode 和 StarCanvas

修改：

- `apps/web/src/app/canvas/components/nodes/ImageNode.tsx`
- `apps/web/src/app/canvas/StarCanvas.tsx`

变化：

- `ImageNode` 删除本地 `createImageGenerationSnapshot()`，改为复用 `@/lib/ai/createGenerationSnapshot`。
- `StarCanvas` 图生图变体入口也改用统一 snapshot 工具。

### 7.6 补充测试

新增测试覆盖：

- 顶层 URL 清洗。
- 嵌套 `shot.generatedImageUrl` / `storyboardGrid.outputImageUrl` 清洗。
- `generation.referenceImage.dataUrl/base64` 清洗但保留 metadata。
- 数组中的 `data:image` 清洗。
- 生成快照字段与来源 metadata 保留。

---

## 8. TypeScript 类型检查结果

最终执行：

```bash
NODE_OPTIONS="" /usr/local/bin/node /Users/wuyongnaren/Projects/starcanvas-main/node_modules/typescript/bin/tsc --noEmit -p /Users/wuyongnaren/Projects/starcanvas-main/apps/web/tsconfig.json
```

结果：通过，exit code 0。

---

## 9. ESLint 结果

最终执行：

```bash
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint
```

结果：通过，exit code 0。

剩余 warning 类型：

- React hooks dependency warning。
- React 19 compiler/purity warning。
- `<img>` 建议替换为 Next `<Image />`。
- 个别图片缺少 alt。

这些 warning 不阻断构建，但建议后续单独做一轮 lint cleanup，不建议和当前 P0/P1 修复混在一起大改 UI 组件。

---

## 10. 测试结果

最终执行：

```bash
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
```

结果：通过。

```text
tests 220
suites 30
pass 220
fail 0
```

提示：Node 报 `[MODULE_TYPELESS_PACKAGE_JSON]` warning，原因是测试文件使用 ESM 语法但 `apps/web/package.json` 未声明 `type: module`。当前不建议盲加，因为可能影响 Next / CommonJS 解析行为；作为 P2 记录即可。

---

## 11. 生产构建结果

最终执行：

```bash
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

结果：通过。

构建路由：

- `/`
- `/_not-found`
- `/api/ai/chat`
- `/api/ai/chat/stream`
- `/api/ai/config`
- `/api/ai/generate-image`
- `/api/ai/health`
- `/canvas`

---

## 12. localStorage / 图片持久化专项结论

本轮前的风险：

- 原 `useCanvasPersistence.ts` 只清洗 `node.data.imageUrl` / `node.data.assetUrl`。
- 新增分镜链路后，图片 URL 可能藏在：
  - `shot.generatedImageUrl`
  - `storyboardGrid.outputImageUrl`
  - `generation.referenceImage.dataUrl`
  - `generationOutput.images[]`

本轮后：

- localStorage 保存前统一深层清洗。
- 清洗工具有独立单元测试。
- 开发环境保存前会扫描剩余运行期 URL 泄漏并 `console.warn` 出具体路径。

结论：P0 localStorage 大型图片数据泄漏风险已明显降低。

---

## 13. AI 图片生成链路专项结论

已确认/已有能力：

- 文生图走 `/images/generations`。
- 图生图走 `/images/edits` multipart/form-data。
- 参考图从 IndexedDB Blob 读取，不发送浏览器 `blob:` URL 给服务端。
- 参考图上传前会压缩并限制大小。
- 错误经 `normalizeGenerationError()` 归一化，避免 UI 展示 HTML 错误页。
- 请求快照现在有统一工具。

仍建议后续增强：

- `ContentNode` 文生图入口和 `useWorkflowRunner` 入口也可进一步统一接入 `createGenerationSnapshot`，目前本轮只处理 ImageNode 与 StarCanvas 图生图变体入口。
- `imageGeneration.ts` 可进一步复用 `normalizeGenerationError()`，让分镜单镜头生成错误展示与 ImageNode 完全一致。

---

## 14. 依赖与安全风险结论

### 14.1 audit

`pnpm audit` 当前失败不是依赖本身报漏洞，而是 registry 问题：

```text
ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS
https://registry.npmmirror.com/-/npm/v1/security/audits/quick doesn't exist
```

建议：如需完成安全审计，临时使用官方 npm registry 做只读 audit，不要在当前任务里盲目改 registry 或自动升级依赖。

### 14.2 npm-check-updates

根目录：

- `pnpm 10.33.0 -> 10.33.4` patch 可用。
- 根 devDependencies 使用 `latest`，ncu 报 Invalid comparator，建议后续把 root devDependency 从 `latest` 固定为明确版本。

`apps/web`：

- `@xyflow/react ^12.10.0 -> ^12.10.2`
- `react 19.2.4 -> 19.2.6`
- `react-dom 19.2.4 -> 19.2.6`
- `zustand ^5.0.9 -> ^5.0.13`
- `@types/dagre ^0.7.52 -> ^0.7.54`

本轮未升级，因为用户要求不是依赖升级，且图片/画布链路正在敏感验证阶段。

### 14.3 depcheck / knip

发现 unused candidates，但不建议盲删：

- `@creative-canvas/canvas` 可能是 workspace 预留包或动态引用。
- `eslint-config-next` 在本轮新增 flat config 后已被实际使用。
- 若干 unused files / exports 可能是测试、动态入口、后续功能预留。

建议后续单独做“死代码清理 PR”，每删一类都跑完整测试和手动画布验证。

---

## 15. 剩余问题与下一步建议

### 建议优先级 P1

1. **objectURL 生命周期专项**
   - 节点删除时应尝试 revoke 对应 objectURL。
   - 当前 `localImageStore.ts` 有相关工具，但删除节点链路未全面接入。

2. **Lint warning cleanup**
   - 处理 hooks dependency warning。
   - 处理缺 alt 的图片。
   - 对 React compiler warning 做判断：是真问题就改，暂不适配就保留 warning。

3. **统一 AI 生成错误展示**
   - `imageGeneration.ts` 也接入 `normalizeGenerationError()`。
   - `ContentNode` / `ShotNode` / `WorkflowRunner` 的错误格式进一步统一。

### 建议优先级 P2

4. **Prettier 全仓格式策略**
   - 当前 Prettier check 显示 109 个文件不一致。
   - 不建议和功能修复混在一个提交里做全仓格式化。
   - 建议单独开一次纯格式化提交。

5. **固定 root devDependency 版本**
   - 根 `package.json` 目前使用 `latest`，不利于可复现构建。

6. **处理 Node test ESM warning**
   - 不建议盲加 `type: module`。
   - 可考虑让 test runner 或 TS 配置更明确地处理 ESM。

---

## 16. 本轮关键新增/修改文件

新增：

- `apps/web/eslint.config.mjs`
- `apps/web/src/lib/storage/sanitizePersistedCanvas.ts`
- `apps/web/src/lib/storage/sanitizePersistedCanvas.test.ts`
- `apps/web/src/lib/ai/createGenerationSnapshot.ts`
- `apps/web/src/lib/ai/createGenerationSnapshot.test.ts`

修改：

- `apps/web/src/app/canvas/hooks/useCanvasPersistence.ts`
- `apps/web/src/app/canvas/components/nodes/ImageNode.tsx`
- `apps/web/src/app/canvas/StarCanvas.tsx`

---

## 17. 验证命令清单

```bash
# TypeScript
NODE_OPTIONS="" /usr/local/bin/node /Users/wuyongnaren/Projects/starcanvas-main/node_modules/typescript/bin/tsc --noEmit -p /Users/wuyongnaren/Projects/starcanvas-main/apps/web/tsconfig.json

# ESLint
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint

# Test
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test

# Build
NODE_OPTIONS="" pnpm --dir "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

最终状态：全部通过；ESLint 仍有 warning，非 error。
