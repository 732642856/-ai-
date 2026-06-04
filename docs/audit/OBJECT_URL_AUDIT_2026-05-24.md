# OBJECT_URL_AUDIT_2026-05-24

## 1. 本轮目标

本轮只做 objectURL / blob URL 生命周期专项修复，不做新功能、不做 UI 大改、不升级依赖、不全仓格式化、不清理 unrelated ESLint warnings。

目标：确保上传、预览、生成、刷新恢复、删除图片节点过程中，临时 `blob:` URL 有明确创建与释放策略，不进入 localStorage，不进入生成快照，不传给后端 AI 接口。

## 2. 搜索结果概览

本轮复查关键词包括：`URL.createObjectURL`、`createObjectURL`、`URL.revokeObjectURL`、`revokeObjectURL`、`blob:`、`objectUrl`、`objectURL`、`previewUrl`、`imageUrl`、`assetUrl`、`generatedImageUrl`、`outputImageUrl`。

最终非测试代码统计：

| 项 | 数量 |
|---|---:|
| `createObjectURL` 使用点 | 9 |
| `revokeObjectURL` 使用点 | 15 |
| blob/data image 相关命中 | 62 |

## 3. objectURL 使用地图

| 文件 | 代码位置 | 创建/释放/保存/传输 | 当前用途 | 风险等级 | 是否修改 |
|---|---:|---|---|---|---|
| `apps/web/src/lib/assets/localImageStore.ts` | 约 16-73 | 创建/释放/Registry | IndexedDB 图片 Blob 恢复后生成运行时预览 URL | 高 | 已修改 |
| `apps/web/src/app/canvas/hooks/useCanvasPersistence.ts` | 约 34-128 | 使用 hydrate 结果 | 刷新恢复时从 IDB 恢复图片预览 | 中 | 复查，沿用 registry |
| `apps/web/src/app/canvas/StarCanvas.tsx` | 约 1167-1181 | 创建/释放 | 文件选择上传时读取图片尺寸 | 中 | 已修改 |
| `apps/web/src/app/canvas/StarCanvas.tsx` | 约 1400-1408 | 创建/释放 | 导出 JSON 包下载链接 | 低 | 已复查，已有立即 revoke |
| `apps/web/src/app/canvas/hooks/useCanvasDropUpload.ts` | 约 62-71 | 创建/释放 | 拖拽上传时读取图片尺寸 | 中 | 已修改 |
| `apps/web/src/app/canvas/hooks/useChatAttachments.ts` | 约 45, 99, 113, 123 | 创建/释放 | Chat 附件预览 | 中 | 复查，已有删除/清空释放；剩余卸载清理为后续可增强项 |
| `apps/web/src/app/canvas/utils/video-metadata.ts` | 约 15, 34, 40, 53 | 创建/释放 | 视频文件读取元数据、视频对象 URL 包装 | 中 | 复查；metadata 已释放；`createVideoObjectUrl` 标注调用方负责释放 |
| `apps/web/src/lib/images/prepareReferenceImage.ts` | 约 88-103 | 创建/释放 | 图生图参考图 Blob 解码 | 低 | 复查，onload/onerror 均释放 |
| `apps/web/src/lib/images/objectUrlRegistry.ts` | 新增 | 创建/释放/测试辅助 | 管理由本应用创建的可控 objectURL | 低 | 新增 |
| `apps/web/src/hooks/useObjectUrl.ts` | 新增 | 创建/释放/hook | Blob/File 预览 hook，依赖变化或卸载自动释放 | 低 | 新增 |

## 4. 风险判断

| 风险类型 | 发现 | 处理 |
|---|---|---|
| 内存泄漏 | 上传尺寸读取阶段创建的临时 URL 之前只在 error 分支释放，成功分支没有释放 | 已在 `StarCanvas.tsx` 与 `useCanvasDropUpload.ts` 成功/失败分支都 revoke metadata URL |
| IDB 预览泄漏 | `localImageStore` 已有 registry，但缺少全量 teardown 清理与测试辅助 | 已补 `revokeAllTrackedObjectUrls()` 与 `getTrackedObjectUrlCount()`；主画布卸载时统一释放 |
| 重复创建 | hydrate 同一 assetId 会替换旧 URL；registry 会先 revoke 旧 URL | 已保留并补强 prev !== url 防护 |
| 持久化污染 | `blob:` / `data:image` 可能存在更深字段，如 `previewUrl`、`referenceImage.url`、`generationOutput.images[]` | 已补强 `sanitizePersistedCanvas.ts` 与测试 |
| 生成快照污染 | `referenceImage` 可能被传入 blob/data 字段 | 已在 `createGenerationSnapshot.ts` 内清洗运行时图片 payload |
| AI 请求风险 | 图生图请求实际使用 `prepareReferenceImageForGeneration` 产出的 `dataUrl` 发送给后端；不是把 blob URL 直接发给后端 | 已复查；snapshot 不保留 blob/data 字段 |
| 误释放 | 不能 revoke http/https/data URL，也不能 revoke 外部未知 blob URL | 新增 `objectUrlRegistry.ts` 只 revoke registry 自己创建的 URL；hook 使用该 registry |

## 5. 修改过的文件

| 文件 | 问题 | 风险 | 修复方式 | 验证方式 |
|---|---|---|---|---|
| `apps/web/src/lib/assets/localImageStore.ts` | registry 缺少全量释放与测试计数；代码容错较弱 | IDB 恢复 URL 在页面级生命周期结束后可能残留 | 新增 `revokeAllTrackedObjectUrls()`、`getTrackedObjectUrlCount()`，集中 revoke 包装 | typecheck/test/build |
| `apps/web/src/app/canvas/StarCanvas.tsx` | 上传读取尺寸的 metadata objectURL 成功后未释放 | 上传多图后 metadata 临时 URL 泄漏 | 成功和失败均 revoke metadata URL；实际节点预览改用 `persistImageFile` 返回的 tracked objectUrl；组件卸载时清理所有 tracked URL | typecheck/lint/test/build |
| `apps/web/src/app/canvas/hooks/useCanvasDropUpload.ts` | 拖拽上传读取尺寸的 metadata objectURL 成功后未释放 | 拖拽多图泄漏临时 URL | 成功和失败均 revoke metadata URL；节点预览使用 `persistImageFile` 返回的 tracked objectUrl | typecheck/lint/test/build |
| `apps/web/src/lib/storage/sanitizePersistedCanvas.ts` | 未显式覆盖 `previewUrl/resultUrl` 等字段 | blob/data 深层持久化污染 | 增加 `previewUrl`、`resultUrl` 清洗字段；任意深层 runtime URL 检测仍保留 | 单测 + 全量测试 |
| `apps/web/src/lib/ai/createGenerationSnapshot.ts` | snapshot 输入可携带运行时图片字段 | generation snapshot 持久化污染 | 清洗 `url/src/dataUrl/base64/b64_json/imageUrl/assetUrl/previewUrl` 中的 blob/data image | 单测 + 全量测试 |
| `apps/web/eslint.config.mjs` | 新增 hook 会触发 `set-state-in-effect` warning | warning 数量增加 | 对 `src/hooks/useObjectUrl.ts` 做窄范围规则豁免并写明原因，保持总 warning 仍为 32 | lint |

## 6. 新增文件

| 文件 | 用途 |
|---|---|
| `apps/web/src/hooks/useObjectUrl.ts` | 通用 Blob/File → objectURL hook，依赖变化或组件卸载自动释放；本轮先作为可复用工具落地 |
| `apps/web/src/hooks/useObjectUrl.test.ts` | SSR 安全性测试；由于当前测试环境没有 jsdom，不做 DOM mount hook 测试 |
| `apps/web/src/lib/images/objectUrlRegistry.ts` | 轻量 objectURL registry，只管理由本应用创建的 objectURL，避免误释放外部 URL |
| `apps/web/src/lib/images/objectUrlRegistry.test.ts` | 覆盖 create/revoke/revokeAll、不重复 revoke、不 revoke http/data/外部 blob URL |

## 7. 新增/补充测试

| 测试文件 | 覆盖点 |
|---|---|
| `apps/web/src/lib/images/objectUrlRegistry.test.ts` | 创建 objectURL、只 revoke registry 管理的 URL、不重复 revoke、revokeAll、http/data/外部 blob 不误释放 |
| `apps/web/src/hooks/useObjectUrl.test.ts` | SSR 下 null URL、SSR 不创建 objectURL、StrictMode SSR 安全 |
| `apps/web/src/lib/storage/sanitizePersistedCanvas.test.ts` | `previewUrl`、`generation.referenceImage.url`、`generationOutput.images[]`、深层 `outputImageUrl` 清洗；保留 `assetId/mimeType/width/height` |
| `apps/web/src/lib/ai/createGenerationSnapshot.test.ts` | snapshot 不持久化 `blob:` / `data:image` 的 referenceImage 字段 |

说明：当前项目测试脚本是 Node 原生 test runner，没有 jsdom/Testing Library。为了不新增依赖、不改测试框架，本轮没有强行引入 DOM mount hook 测试，而是把 revoke 核心行为下沉到纯 TS registry 并覆盖。

## 8. 为什么这样修

1. 尺寸读取用的 objectURL 是短生命周期，只用于 `Image.onload/onerror`，因此应在成功和失败分支立即释放。
2. 节点真正显示用的 objectURL 来自 IndexedDB asset registry，生命周期应跟 asset/画布页面绑定，而不是跟一次 metadata 读取绑定。
3. `sanitizePersistedCanvas` 是 localStorage 最后一层闸门，应深层清洗所有运行时 URL 和大型 inline 图片 payload。
4. `createGenerationSnapshot` 是生成记录入口，应从源头阻止 referenceImage 的 blob/data payload 被记录。
5. 对外部 URL 的 revoke 必须保守；只 revoke 本应用创建并登记过的 URL，避免误伤仍在使用的图片。

## 9. 验证命令和结果

| 命令 | 结果 |
|---|---|
| `NODE_OPTIONS="" pnpm --dir /Users/wuyongnaren/Projects/starcanvas-main --filter web typecheck` | 通过 |
| `NODE_OPTIONS="" pnpm --dir /Users/wuyongnaren/Projects/starcanvas-main --filter web lint` | 通过，0 error / 32 warnings |
| `NODE_OPTIONS="" pnpm --dir /Users/wuyongnaren/Projects/starcanvas-main --filter web test` | 通过，230 tests / 31 suites / 230 pass |
| `NODE_OPTIONS="" pnpm --dir /Users/wuyongnaren/Projects/starcanvas-main --filter web build` | 通过 |

补充：曾尝试新增完整 hook DOM mount 测试，但当前 Node test 环境没有 `document/jsdom`，因此改为纯 registry 测试 + SSR hook 测试，避免为本专项引入新依赖或改测试框架。

## 10. 手动验证清单

本轮未启动浏览器手动点击验证，以下为需要在页面完成的验收清单：

| 场景 | 预期 |
|---|---|
| 上传一张图片 | 图片显示正常；控制台无错误；localStorage 无 `blob:` / `data:image` |
| 上传多张图片 | 节点显示正常；删除/切换后页面不卡；无明显持续内存上涨 |
| 删除图片节点 | 节点消失；不影响其他图片节点；控制台无 revoke 相关错误 |
| 刷新恢复 | 图片通过 `assetId` 从 IndexedDB 恢复；不依赖旧 blob URL；localStorage 无 `blob:` |
| 图生图 | 请求 payload 不含 `blob:`；snapshot 不含 `blob:` / `data:image`；失败不保存坏 URL |
| 旧数据兼容 | 旧 localStorage 若含 `blob:` / `data:image`，保存时被 sanitize 清掉，不白屏 |

## 11. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| Chat 附件卸载清理 | `useChatAttachments` 删除/清空时会 revoke，但 hook 自身暂未在组件卸载时自动 clear | 下一轮可在不改行为前提下补一个 unmount cleanup |
| `createVideoObjectUrl` 调用方负责释放 | 工具函数只创建不释放，注释已说明调用方负责 | 后续视频资产专项时统一梳理视频 objectURL |
| `useObjectUrl` 尚未接入 UI 组件 | 本轮新增为通用工具，但当前主图片链路仍主要依赖 `localImageStore` registry | 后续新增 Blob/File 独立预览组件时必须使用该 hook |
| 手动浏览器验证未执行 | 本轮以代码与自动化验证为主 | 建议下一步启动 dev server 做 localStorage/图生图 payload 手动验收 |

## 12. 后续建议

1. 先按本报告第 10 节做一次浏览器手动验收。
2. 如果验收通过，可以进入 ESLint warning cleanup。
3. ESLint cleanup 前建议先固定基线：当前仍是 0 error / 32 warnings。
4. 后续图生图稳定性专项应继续检查：参考图预处理、失败重试、错误归一化、生成状态回滚。

## 非技术总结

这次主要解决的是：图片临时地址用完不关、保存数据里混入临时地址、生成记录里夹带临时图片内容这些隐患。

对用户的好处：上传和恢复图片更稳，多图操作更不容易越用越卡，刷新后不再依赖已经失效的 `blob:` 地址，AI 图生图记录也更干净。

现在图片相关还剩的风险：需要补一次真实浏览器手动验收，另外 Chat 附件和视频 objectURL 可以后续继续细化。

如果手动验收通过，下一步可以开始做 ESLint warnings cleanup。
