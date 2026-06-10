# v0.1.0 — 初始发布

StarCanvas（星轨画布）首个公开版本。搭载节点工作流的 AI 驱动影视创作工具。

## 核心能力

### 🎬 创作管线
- **节点式工作流**：Text → Script → Storyboard → Image Generation → Video Generation → Audio → Subtitle → Composition
- **AI 对话驱动**：Chat 可读取画布状态、解析 AI 回复中的结构操作、创建/连接/修改节点
- **7 角色 Film Crew Agent 流水线**

### 🎨 专业控制
- **Cinema Lab**：多角度控制、姿势参考、焦点编辑、运镜控制
- **参数化运镜**：景别/镜头运动/光线/色调/景深/画幅比 6 维参数控制
- **角色三视图**：正/侧/背三视图生成 + 视角锁定 + 风格选择
- **紫微斗数角色设计**：基于出生信息的命盘 → 性格自动映射

### 🔍 质量控制
- **ContinuityGuard**：六维连续性检查引擎
- **角色 Bible**：六层身份锚点系统（骨相/五官/辨识标记/色值/皮肤纹理/发型）

### 📦 导出
- **浏览器端视频合成**：基于 ffmpeg.wasm，拼接片段 + 叠加音频 + 字幕合成
- **剪映草稿导出**：draft_content.json + 素材 ZIP 包
- **一键拉片**：上传视频 → AI 拆解为分镜 → 导入画布

### 🏗 开源基建
- MIT License
- CI pipeline（lint + typecheck + test + build）
- Issue/PR 模板
- 贡献者指南
- 测试基线 515 项，全部通过

## 快速开始

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
# 编辑 .env.local 填写 AI Provider 配置
pnpm dev
```

## 鸣谢

- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — 浏览器端视频合成
- [iztro](https://github.com/SylarLong/iztro) — 紫微斗数排盘引擎
- [@xyflow/react](https://github.com/xyflow/xyflow) — 节点画布引擎
- [TapNow](https://app.tapnow.ai) — 交互设计参考
