# StarCanvas（星轨画布）

搭载节点工作流的 AI 驱动多模态资产编排画布。

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置 AI Provider
cp apps/web/.env.example apps/web/.env.local
# 编辑 apps/web/.env.local 填写你的中转站配置

# 3. 启动
pnpm dev
```

## 配置 AI Provider

StarCanvas 支持任何 OpenAI 兼容协议的中转站。

在 `apps/web/.env.local` 中配置：

```env
AI_BASE_URL=https://your-proxy.example.com/v1
AI_API_KEY=sk-your-key
AI_DEFAULT_MODEL=gpt-4o-mini
AI_DEFAULT_IMAGE_MODEL=gpt-image-2
AI_VIDEO_MODEL=              # 可选，不配则走 AI_DEFAULT_MODEL
AI_REQUEST_TIMEOUT_MS=120000
```

配置完毕后启动项目，所有 AI 请求通过后端代理中转，**API Key 不会暴露到浏览器**。

## 测试连接

启动后访问 `GET /api/ai/health` 验证中转站连接。

## 核心功能

- **节点工作流**：Prompt → 文本生成 → 图片生成 → 视频分析
- **历史记录**：每次运行结果结构化保存，支持类型化预览
- **拖拽编排**：历史结果可拖回画布创建 Prompt 节点继续编排
- **多模型支持**：可同时使用文本/图片/视频多个模型

## 项目结构

```
apps/
  web/         # Next.js 前端 + API Routes
    src/
      app/
        api/ai/          # AI 代理路由（chat, health, config, generate-image）
        canvas/          # 画布主应用
      lib/ai/            # AI Provider 统一模块（P2-5A）
  api/         # NestJS 后端（未来功能用）
packages/
  providers/   # AI Provider 类型定义
  canvas/      # 画布节点类型
  shared/      # 共享枚举
```

## 技术栈

- Next.js 16 + React 19 + TypeScript
- @xyflow/react v12（节点画布）
- Zustand（状态管理）
- TailwindCSS
- SSE（实时流式响应）
