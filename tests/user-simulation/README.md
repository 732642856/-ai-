# StarCanvas 真人用户模拟测试套件

基于对标应用（TapNow/小云雀2.0/ArcReel）的**真实用户教程和操作流程**，
使用 AI 驱动的浏览器自动化工具模拟真实用户行为，持续优化 StarCanvas 用户体验。

---

## 工具矩阵

| 工具 | 许可证 | 用途 | 运行方式 |
|------|--------|------|---------|
| **browser-use** (18.2k⭐) | MIT | AI Agent 操控浏览器模拟真实用户 | `python ai_simulation.py --mode ai` |
| **Playwright** | Apache-2.0 | 确定性 e2e + UX 流程测试 | `npx playwright test ux-simulation.spec.ts` |
| **OpenReplay** | MIT | 会话录制回放 + 用户行为分析 | 自部署追踪器（可选） |

---

## 测试场景（对照真实用户教程）

| # | 场景 | 对标来源 | 难度 | 步骤数 |
|---|------|---------|------|--------|
| 1 | TapNow 基础创作流程 | TapNow B站教程 + CSDN测评 + 腾讯新闻Agent教程 | Easy | 10 |
| 2 | 小云雀2.0 短剧全流程 | 小云雀知乎实测教程 + smzdm + tahou教程 | Medium | 10 |
| 3 | ArcReel 多Agent编排 | ArcReel 官网文档 + freshcrate评测 | Hard | 9 |
| 4 | TapNow 「/」快捷命令 | TapNow uisdc深度测评 + Cinema Lab | Easy | 6 |
| 5 | 综合压力场景 | 综合三种产品的用户行为模式 | Hard | 14 |

---

## 快速开始

### 1. Playwright 测试（推荐首选用）

```bash
# 安装
npx playwright install chromium

# 运行所有 UX 测试
npx playwright test tests/user-simulation/ux-simulation.spec.ts

# 运行单个场景
npx playwright test tests/user-simulation/ux-simulation.spec.ts -g "TapNow"

# 带 UI 模式
npx playwright test tests/user-simulation/ux-simulation.spec.ts --ui
```

### 2. browser-use AI 模拟（需要 StarCanvas 运行中）

```bash
# 安装
pip install "browser-use[core]"
playwright install chromium

# 启动 StarCanvas
cd apps/web && npm run dev

# AI 模拟所有场景
python tests/user-simulation/ai_simulation.py --scenario all --mode ai

# AI 模拟单个场景
python tests/user-simulation/ai_simulation.py --scenario tapnow_onboarding --mode ai

# 降级模式（无需 browser-use）
python tests/user-simulation/ai_simulation.py --scenario all --mode simple
```

### 3. 场景定义器（仅列出场景）

```bash
python tests/user-simulation/run_simulation.py --list
```

---

## 测试覆盖的用户体验维度

| 维度 | 检测项 | 来源教程 |
|------|--------|---------|
| **首屏加载** | 画布加载 < 3s，工具栏按钮齐全 | TapNow B站教程 |
| **节点操作** | 添加/连线/运行/删除节点流畅 | 小云雀知乎教程 |
| **风格库** | 7大分类30+风格可浏览和选择 | 小云雀 smzdm 教程 |
| **分镜列表** | 表格/网格切换，排序，状态显示 | 小云雀 tahou 教程 |
| **快捷命令** | 28个SlashCommand可搜索和触发 | TapNow uisdc 测评 |
| **角度控制** | 拖拽旋转流畅，8方向吸附 | TapNow Cinema Lab |
| **版本管理** | 快照保存/对比/恢复 | ArcReel 官网文档 |
| **多面板** | 同时打开不冲突，z-index正常 | 综合压力测试 |
| **导出功能** | 剪映/FFmpeg 脚本/合成导出 | ArcReel + 小云雀 |

---

## 测试报告

报告输出到 `tests/user-simulation/reports/`：

- `summary_*.json` — 汇总报告
- `{scenario}_*.json` — 场景详细报告
- `{scenario}_*.md` — Markdown 可读报告

截图输出到 `tests/user-simulation/screenshots/`。

---

## 持续改进

每次对 StarCanvas 做 UX 修改后，运行测试套件对照教程数据验证：

```bash
# 全量测试（Playwright + AI模拟）
npx playwright test tests/user-simulation/ && python tests/user-simulation/ai_simulation.py
```
