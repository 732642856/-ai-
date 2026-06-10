# StarCanvas（星轨画布）

> AI-driven multimodal asset orchestration on a node-based canvas.

搭载节点工作流的 AI 驱动多模态资产编排画布。对标 TapNow + 小云雀短剧 Agent 2.0 + LibreTV 的 AI 影视创作全流程工具。

**Status**: 515 tests passing · TypeScript strict · Next.js 16 · `main` branch

## Screen recording

![StarCanvas](https://img.shields.io/badge/StarCanvas-星轨画布-6366f1)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Next.js](https://img.shields.io/badge/Next.js-16-000000)
![MIT](https://img.shields.io/badge/License-MIT-green)
![Tests](https://img.shields.io/badge/Tests-515_✔️-success)
![Version](https://img.shields.io/badge/Version-v0.1.0-6366f1)

> 节点式 AI 影视创作工作台 · 对标 TapNow + 小云雀短剧 Agent 2.0

<!-- TODO: 跑通完整管线后替换为真实录屏 -->
![demo](https://via.placeholder.com/800x450/1a1a2e/ffffff?text=StarCanvas+Demo)

## Features

### 🎬 AI 影视创作管线

```
Text → Script → Storyboard → Image Generation → Video Generation → Audio → Subtitle → Composition
```

全流程节点式工作流，每一步可单独运行、重试、修改。

### 🎨 专业控制面板

- **Cinema Lab** — 多角度控制、姿势参考、焦点编辑、运镜控制
- **角色三视图** — 正/侧/背三视图生成 + 视角锁定
- **参数化运镜** — 景别/镜头运动/光线/色调/景深/画幅比 6 维参数控制
- **紫微斗数角色设计** — 基于出生信息的命盘→性格自动映射

### 🤖 AI 驱动

- 20 个 API 端点（文生图、图生视频、TTS、角色一致性、Bible导演等）
- 流式 SSE 对话（支持 tool calling + canvas actions）
- 7 角色 Film Crew Agent 流水线
- 四柱八字 → 十二宫 → 六层身份锚点

### 🔍 质量控制

- **ContinuityGuard** — 六维连续性检查引擎（时间/空间/角色/道具/情绪/逻辑）
- **角色 Bible** — 六层身份锚点系统（骨相/五官/辨识标记/色值/皮肤纹理/发型）
- **Stage Gate** — 质量验证机制

### 📦 导出集成

- **剪映草稿导出** — 生成 `draft_content.json` + 素材 ZIP 包
- **ffmpeg.wasm** — 浏览器端视频合成（片段拼接 + 音频叠加 + 字幕）
- **一键拉片** — 上传视频 → AI 拆解为分镜节点 → 导入画布
- 支持 Vidu 8 种图生视频模型 + OpenAI 兼容中转

## Quick Start

```bash
# 1. 安装依赖
pnpm install

# 2. 配置 AI Provider
cp apps/web/.env.example apps/web/.env.local
# 编辑 apps/web/.env.local 填写你的中转站配置

# 3. 启动开发服务器
pnpm dev

# 4. 浏览器打开 http://localhost:3000
```

## AI Provider 配置

支持任何 OpenAI 兼容协议的中转站（如 copse.top、API2D、OpenCat 等）。

```env
# 中转站配置
AI_BASE_URL=https://your-proxy.example.com/v1
AI_API_KEY=sk-your-key
AI_DEFAULT_MODEL=gpt-4o-mini
AI_DEFAULT_IMAGE_MODEL=gpt-image-2
```

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 16 App Router | 前端框架 |
| React 19 + TypeScript | UI |
| @xyflow/react v12 | 节点画布 |
| Zustand v5 | 状态管理 |
| Tailwind CSS v4 | 样式 |
| iztro | 紫微斗数排盘 |
| @ffmpeg/ffmpeg.wasm | 浏览器端视频合成 |
| Turborepo + pnpm | Monorepo 构建 |

## 开源协议

MIT License — 详见 [LICENSE](./LICENSE)。

## 参与贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
