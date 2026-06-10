# StarCanvas 真实能力矩阵 — 全网深度探索报告（2026-06-10）

## 一、探索范围

| 维度 | 已执行 |
|------|--------|
| 本地全目录扫描 | 主干 123 源文件 + 开发版 68 文件 + 历史版 5+30 文件 |
| 桌面副本扫描 | StarCanvas-v2、星轨画布文件库、DirectorOS-tapnow复刻版 |
| GitHub 远端对比 | 全分支差异对比（250 文件差异 → 仅 18 文件本地不存在） |
| WorkBuddy 旧 sessions | 24 个 session 目录，筛选出 4 份高价值报告并迁移 |
| 竞争产品深度对标 | TapNow / 小云雀 2.0 / ArcReel / Moyin Creator |
| 开源代码全网检索 | 已克隆参考库（excalidraw/tldraw/comfyui/xyflow）+ GitHub 检索 |

## 二、GitHub 远端检查结论

| 检查项 | 结果 |
|--------|------|
| 远端分支 | 3 个（main, starcanvas-ai-film-workflow-20260608, starcanvas-pr1-safe-sync-20260608） |
| 本地未存在文件 | 仅 18 个（全为 docs/ 和 2 个已在不同路径存在的工具文件） |
| 关键结论 | **远端无本地缺失的功能代码**。lib/agents/* 已在 main 分支跟踪，与远端一致。 |

## 三、散落副本价值判断

| 副本 | 发现 | 行动 |
|------|------|------|
| 开发版 DrawNode.tsx | 手绘原型，未完成 | 只借鉴，SketchNode 已覆盖加强 |
| Desktop DirectorOS | FastAPI 模板库 | 只借鉴 workflow template schema，不直接迁移 |
| V0/V1 历史版 | 全部为主干子集 | 不迁移 |
| WorkBuddy session 报告 | 4 份高价值审计/对标/优化文档 | ✓ 已迁移到 `docs/audit/session-migration/` |

## 四、竞争产品功能对标

### StarCanvas 已实现（比竞品更强或持平）

| 功能 | TapNow | 小云雀 2.0 | ArcReel | StarCanvas | 对比 |
|------|--------|-----------|---------|-----------|------|
| 无限画布节点编辑 | ✅ | ❌ | ✅ | ✅ | **持平** |
| 30+ nodeKind 节点类型 | 5 类 | - | - | **30 种** | **大幅领先** |
| 15 种情绪→镜头策略 | ❌ | ❌ | ❌ | **已实现** | **独有** |
| 生产队列/交接报告 | ❌ | ❌ | ❌ | **已实现** | **独有** |
| 多供应商标价管理 | ❌ | ❌ | ✅ | **已实现** | **持平** |
| 角色一致性方案 | ✅ | ✅ | ✅ | ✅ | **持平** |
| 分镜合成网格图 | ✅ | ✅ | ✅ | ✅ | **持平** |
| 视频工作流 | ✅ | ✅ | ✅ | ✅ | **持平** |
| 字幕导出 | ❌ | ✅ | ❌ | ✅ | **持平** |

### StarCanvas 真正缺失的 P0 功能（按实现成本排序）

| 优先级 | 功能 | 竞品证据 | 已有基础设施 | 构建成本 |
|--------|------|----------|-------------|---------|
| **P0-1** | **焦点编辑面板**（蒙版重绘） | TapNow 魔法棒 | `FocusEditPanel.tsx` 已存在，路由已存在 | **半天，纯前端** |
| **P0-2** | **角色三视图面板** | 小云雀2.0 | `/api/ai/generate-character-view` 已存在 | **1 天，纯前端 UI** |
| **P0-3** | **@ 资产调用自动完成** | 小云雀 2.0 | `react-mentions` 可直接用，AssetPanel 已存在 | **半天，纯前端** |
| **P0-4** | **镜头参数化面板**（景别/角度/焦距） | 小云雀 2.0 | `AngleControlPanel.tsx` 存在，有数据模型 | **半天，UI 集成** |
| **P1-1** | **姿势参考编辑器** | TapNow 火柴人 | `PoseEditor.tsx`/`PoseReferenceEditor.tsx` 已存在 | **半天，打磨** |
| **P1-2** | **画风库/风格库 Preset** | 小云雀 100+ 画风 | `react-grid-gallery` (MIT) 可直接用 | **半天** |
| **P1-3** | **首尾帧控制 UI** | 小云雀/TapNow | Vidu API 已有参数 | **半天** |
| **P1-4** | **分镜时间线面板** | TapNow | 暂无 timeline 组件 | **1 天** |
| **P1-5** | **光影参数面板** | 小云雀 2.0 | `react-control-panel` (MIT)| **半天** |

## 五、可直接复用的开源包

| 包名 | 许可证 | 功能 | 复用方式 |
|------|--------|------|---------|
| `react-mentions` | BSD-3-Clause | @ 自动完成 | `npm install` 直接使用 |
| `react-grid-gallery` | MIT | 画风库网格选择 | `npm install` 直接使用 |
| `react-control-panel` | MIT | 参数面板组件 | `npm install` 直接使用 |
| `openpose-skeleton-editor` | MIT | 姿势编辑器 | 复制 `src/` 核心组件到项目 |
| excalidraw `exportToCanvas` | MIT | Canvas→图片导出 | 复制 utils 层的 export 函数 |
| xyflow CustomNode 示例 | MIT | 自定义节点模式 | 参考代码模式 |

## 六、推荐实施队列

### 第一梯队（P0，总计 2.5 天工作量）

```
1. @资产调用自动完成（react-mentions, 半天）
2. 角色三视图前端 UI（纯面板，1 天）
3. 焦点编辑面板集成（已有 FocusEditPanel，半天）
4. 镜头参数化面板（AspectRatio/景别/角度 Selector，半天）
```

### 第二梯队（P1，总计 2.5 天工作量）

```
5. 画风库 Preset 选择器（react-grid-gallery，半天）
6. 姿势参考编辑器打磨（已有 PoseEditor，半天）
7. 分镜时间线面板（tldraw/excalidraw 帧管理参考，1 天）
8. 首尾帧/光影参数面板（react-control-panel，半天）
```

## 七、Project Context 更新总结

- `docs/audit/session-migration/` — 4 份从 WorkBuddy session 迁移的审计/对标报告
- `docs/audit/StarCanvas_散落副本功能碎片清点_2026-06-09.md` — 散落副本审计
- `docs/audit/StarCanvas_真实能力矩阵_全网深度探索报告_2026-06-10.md` — 本报告

## 八、Git 仓库现状

- 当前有 17 个修改文件 + 5 个未跟踪（SketchNode/tone.d.ts/film-crew test/continuityGuard/散落副本报告）
- 建议先审查并提交本轮工作，再开启下一轮 P0 实施
- `lib/agents/` 3 个文件已在 `main` 跟踪，不存在"远端没有"的情况
- GitHub 远端分支 `starcanvas-ai-film-workflow-20260608` 仅多 1 个 commit（`afe2313`），不包含缺失功能代码
