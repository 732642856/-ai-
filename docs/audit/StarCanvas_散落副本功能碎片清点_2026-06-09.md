# StarCanvas 散落副本功能碎片清点（2026-06-09）

## 范围

本轮只读对比以下位置，避免重复造轮子：

- 主干：`/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_主干/starcanvas`
- 开发版：`/Users/wuyongnaren/Projects/StarCanvas/01_MAIN_开发版/starcanvas`
- 桌面副本：`/Users/wuyongnaren/Desktop/StarCanvas-v2`
- 桌面参考库：`/Users/wuyongnaren/Desktop/星轨画布文件库`
- 历史版本：`/Users/wuyongnaren/Projects/StarCanvas/02_ARCHIVE_历史版本/valid-starcanvas-history`

## 结论摘要

1. 主干已存在大量此前误判为缺失的功能：MiniMap、Undo/Redo、Slash、右键菜单、属性面板、AgentNode 前端入口等，不应重复实现。
2. 开发版存在 `DrawNode.tsx` 原型，但未完成节点数据回写；本轮已以主干 `SketchNode.tsx` 为基底吸收其思想，不直接复制。
3. 桌面 `DirectorOS-tapnow复刻版` 有模板库前后端参考，适合后续抽象“工作流模板库”，不适合直接迁移 FastAPI/React 页面代码。
4. TapNow docx 已有主干提取版，不重复迁移二进制文档。

## 发现项

| 来源 | 文件/目录 | 价值判断 | 处理建议 |
|---|---|---|---|
| 开发版 | `packages/canvas/src/nodes/DrawNode.tsx` | 手绘节点原型；有 `canvas.toDataURL('image/png')`，但未接入状态回写 | 只借鉴，不直接迁移；主干 `SketchNode.tsx` 已覆盖并增强 |
| 桌面参考库 | `DirectorOS-tapnow复刻版/backend/app/api/v1/endpoints/templates.py` | 模板分类、使用计数、官方/自定义模板思路 | 后续抽象 Next/TS 模板 schema 时借鉴 |
| 桌面参考库 | `DirectorOS-tapnow复刻版/frontend/src/app/dashboard/templates/page.tsx` | 模板库 UI：分类、筛选、使用模板入口 | 后续转为 StarCanvas 工作流模板面板参考 |
| 主干 | `apps/web/src/app/canvas/utils/videoWorkflowTemplate.ts` | 已有视频工作流模板生成器 | 后续扩展模板库时优先扩展此文件，而非新建孤立模板系统 |
| 主干 | `docs/reference/tapnow/*-extracted.md` | TapNow 文档已提取为 Markdown | 不迁移桌面 docx，避免重复文档 |

## 本轮已执行迁移/吸收

- `SketchNode.tsx` 已作为主干手绘节点实现：Pointer Events、压感记录、PNG 导出、节点数据持久化。
- `sketchImageDataUrl` 已接入 AI 生图参考图链路：可右键“草图生成参考图”，也可作为上游连接到图像生成节点时的 `sourceImage`。

## 后续推荐

1. 基于 `videoWorkflowTemplate.ts` 扩展“工作流模板库”，不要直接复制 DirectorOS 的 FastAPI 实现。
2. 为模板库增加：分类、模板元数据、使用计数、本地收藏、从当前画布保存为模板。
3. 继续清点历史版本中是否存在可迁移的“模板定义 JSON/TS”，但只迁移 MIT/自有代码或纯产品结构。
