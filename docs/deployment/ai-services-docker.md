# StarCanvas 后端AI服务 Docker 部署指南

## 概述

StarCanvas 使用了多个需要 GPU 的 AI 模型服务。这些服务以 Docker 容器方式运行在独立服务器上，
通过环境变量配置 URL，由 Next.js API Route 做 BFF 代理转发。

## 服务架构

```
用户浏览器 ──→ Next.js (apps/web) ──→ API Route (BFF)
                                          │
                                    ┌─────┼──────────────┐
                                    │     │              │
                              ┌─────▼┐ ┌─▼────┐  ┌─────▼──┐
                              │MuseTalk│ │SadTalker│  │VoxCPM2│
                              │(口型同步)│ │(说话头)  │  │  (TTS) │
                              └───────┘ └──────┘  └────────┘
```

## 服务清单

| 服务 | 端口 | GPU要求 | 环境变量 | 许可证 |
|------|------|---------|----------|--------|
| MuseTalk-API | 8090 | RTX 4090+ | `TALKING_PHOTO_SERVICE_URL` | MIT |
| SadTalker-API | 8091 | RTX 3060+ | `TALKING_PHOTO_SERVICE_URL` | Apache-2.0 |
| VoxCPM2 TTS | 8092 | 无需GPU | `VOXCPM_BASE_URL` | MIT |

## 快速部署

### 1. MuseTalk（推荐，MIT协议）

```bash
# 拉取 MuseTalk-API Docker 镜像
docker pull ruxirig/musetalk-api:latest

# 运行（需要 NVIDIA GPU + CUDA 12.x）
docker run --gpus all -p 8090:8090 \
  -e USE_PERSISTENT_MEMORY=true \
  ruxirig/musetalk-api:latest

# 验证
curl -X POST http://localhost:8090/api/generate \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64>","text":"你好世界","mode":"lip-sync"}'
```

### 2. SadTalker（轻量级备选）

```bash
git clone https://github.com/kenwaytis/faster-SadTalker-API.git
cd faster-SadTalker-API
docker-compose up -d
# 服务启动在 localhost:8091
```

### 3. VoxCPM2 TTS（已部署）

当前 StarCanvas 已有 VoxCPM2 TTS 服务的完整实现（`/api/ai/tts`），配置 `VOXCPM_BASE_URL` 环境变量即可。

## 环境变量配置

在 `apps/web/.env.local` 中添加：

```env
# 数字人服务（MuseTalk / SadTalker / LivePortrait）
TALKING_PHOTO_SERVICE_URL=http://localhost:8090

# VoxCPM2 TTS（已有，如未配置可跳过）
VOXCPM_BASE_URL=http://localhost:8092
```

## 角色一致性服务（未来）

IP-Adapter 和 InstantID 需要 ComfyUI + 自定义工作流部署，方案如下：

```bash
# 使用 ComfyUI + 自定义工作流
docker run --gpus all -p 8188:8188 comfyui:latest

# 加载工作流：
# - IP-Adapter workflow (identity-preserving)
# - InstantID workflow (face-swap)
# - ControlNet workflow (pose-guided)
```

## GPU 资源估算

| 同时服务数 | 最小 GPU | 推荐 GPU |
|-----------|----------|----------|
| 1个口型同步 | RTX 3060 12GB | RTX 4090 24GB |
| 口型同步+说话头 | RTX 4090 24GB | A100 40GB |
| 全部4个服务 | A100 40GB | 双 A100 |
