# 🎬 星轨画布 (StarCanvas)

**AI-Native 影视创作画布** — 对标 TapNow 的专业分镜创作平台。

> 用你自己的中转站 API key，零成本跑通从剧本到分镜到出图的完整创作链路。

---

## 核心能力

| 层级 | 能力 | 完成度 |
|------|------|--------|
| **创作输入** | 剧本/文本输入、参考图上传 | 🟡 部分实现 |
| **剧本理解** | AI 人物识别、情绪曲线、场景拆分 | 🟡 35% |
| **导演决策** | 情绪→镜头策略映射、镜头推荐 | 🟡 30% |
| **分镜生成** | 专业分镜字段、提示词管线 | ✅ **60%**（最强模块） |
| **一致性系统** | 角色圣经 / 场景圣经 / 视觉风格圣经 | ✅ **新完成** |
| **文生图** | OpenAI 兼容协议、中转站支持 | ✅ 已实现 |
| **编辑控制** | 单镜头编辑、重绘、改景别/机位 | 🔴 25% |
| **项目管理** | 画布保存/恢复（IndexedDB） | ✅ 已实现（无限容量） |
| **导出交付** | PDF/Excel/JSON | 🔴 待实现 |

---

## 快速启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000) → 点击"进入前期画布"

### 配置你的中转站 API

点击左下角用户头像 → **设置** → 填入：
- **API Base URL**：你的中转站地址（如 `https://your-proxy.com/v1`）
- **API Key**：你的 key
- 添加需要的模型（文本/图像/视频）

---

## 项目结构

```
starcanvas/
├── apps/web/               # Next.js 前端
│   └── src/app/canvas/     # 主画布
│       ├── components/     # UI 组件
│       │   ├── canvas/     # 画布层（AssetLibrary/EmptyGuide）
│       │   ├── chat/       # AI 对话面板
│       │   ├── history/    # 节点执行历史
│       │   ├── menus/      # 右键菜单
│       │   ├── nodes/      # 自定义节点（Content/Image/Workflow）
│       │   ├── panels/     # 设置/Bible 面板
│       │   ├── preview/    # Prompt 预览
│       │   ├── toolbar/    # 工具栏
│       │   └── workflow/   # 工作流面板
│       ├── hooks/          # 自定义 hooks
│       ├── stores/         # Zustand 状态管理
│       ├── types/          # 类型定义
│       └── utils/          # 工具函数
├── packages/
│   ├── shared/             # 共享类型和工具
│   └── canvas/             # 画布核心引擎
├── docs/audit/             # 5份技术审计报告
└── <各配置文件>
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 15 + React 19 | 前端框架 |
| @xyflow/react 12 | 画布引擎（React Flow） |
| Zustand | 状态管理 |
| pnpm + Turborepo | Monorepo 工具链 |
| Tailwind CSS | 样式 |
| Lucide Icons | 图标库 |

---

## 审计报告

5 份完整技术审计报告保存在 `docs/audit/`：

1. **技术审计与差距分析** — P0-P3 开发路线图（22项任务）
2. **TapNow 能力矩阵对比** — 11 大模块 × 112 项能力逐项对比
3. **AI 代码深度审计** — 20 项 AI 能力源码级审查
4. **画布 20 项能力审计** — React Flow 画布功能评估
5. **数据模型审计** — 数据架构现状与规划

---

## 许可证

MIT
