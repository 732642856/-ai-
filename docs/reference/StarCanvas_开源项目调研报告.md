# StarCanvas 开源项目调研报告

> 调研日期：2026-06-10
> 调研目标：为 StarCanvas（星轨画布）寻找可直接复用的开源项目
> 筛选原则：**优先 MIT/Apache/BSD 许可证**，排除 GPL/AGPL

---

## 目录

1. [视频合成引擎（最紧急）](#1-视频合成引擎最紧急)
2. [Chat→Canvas 桥接层](#2-chatcanvas-桥接层)
3. [角色三视图/一致性](#3-角色三视图一致性)
4. [紫微斗数/命理引擎](#4-紫微斗数命理引擎)
5. [节点式工作流UI](#5-节点式工作流ui)
6. [社区/模板系统](#6-社区模板系统)
7. [一键拉片/视频分析](#7-一键拉片视频分析)
8. [剪映草稿导出](#8-剪映草稿导出)
9. [运镜控制/镜头语言](#9-运镜控制镜头语言)
10. [配音/口型同步](#10-配音口型同步)

---

## 1. 视频合成引擎（最紧急）

### 1.1 ffmpeg.wasm —— 浏览器端 FFmpeg
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/ffmpegwasm/ffmpeg.wasm |
| **许可证** | MIT |
| **Stars** | 17.6k |
| **语言** | C / TypeScript / WebAssembly |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— StarCanvas 核心视频合成引擎 |
| **可复用模块** | 完整 FFmpeg 命令行在浏览器中的 WebAssembly 实现，可直接用于视频剪切、拼接、转码、叠加字幕、混音等操作。`@ffmpeg/ffmpeg` + `@ffmpeg/util` 可直接作为 npm 依赖引入。 |

### 1.2 OpenReel Video —— 浏览器端视频编辑器
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/Augani/openreel-video |
| **许可证** | MIT |
| **Stars** | 3.4k |
| **语言** | TypeScript / React |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 可直接作为前端视频编辑参考实现 |
| **可复用模块** | 完整的客户端视频编辑器，包含时间轴、轨道管理、剪辑、转场等 UI 组件和逻辑。可作为 StarCanvas 视频合成节点的 UI 参考和底层逻辑复用。 |

### 1.3 Remotion —— React 程序化视频生成
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/remotion-dev/remotion |
| **许可证** | 双许可证（免费许可证 + 商业公司许可证） |
| **Stars** | 49.6k |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐ 高 —— 参考其 React→视频渲染架构 |
| **可复用模块** | ⚠️ **不可直接复制代码**，但可免费使用其 npm 包。值得参考其 `remotion` 核心渲染管道、`<Composition>` 组件设计、以及基于 Puppeteer/浏览器截图的视频帧渲染方案。 |

### ❌ 排除项
| 项目 | 原因 |
|:---|:---|
| LosslessCut | GPL-2.0 许可证，不可直接复制代码 |

---

## 2. Chat→Canvas 桥接层

### 2.1 Open Agent Builder —— Firecrawl 可视化 AI 工作流构建器
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/firecrawl/open-agent-builder |
| **许可证** | MIT |
| **Stars** | 2.3k |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 直接对应 Chat→节点图 转换需求 |
| **可复用模块** | 完整的拖拽式 AI Agent 工作流编辑器，包含节点定义、连线逻辑、状态管理、执行引擎。其节点数据结构和「对话式创建节点」的交互模式可直接参考。 |

### 2.2 OpenCanvas —— 开源 AI 画布
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/opencanvasai/OpenCanvas |
| **许可证** | MIT |
| **Stars** | 9 |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐ 高 —— 名称和需求高度匹配 |
| **可复用模块** | 虽然 Stars 较少，但项目定位就是「面向创作者的开源节点式 AI 工作流构建器」。其画布交互层、节点模板系统、AI 对话集成逻辑可供参考。 |

---

## 3. 角色三视图/一致性

### 3.1 Consistent Character —— AI 角色一致性生成
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/oftenliu/consistent-character |
| **许可证** | MIT |
| **Stars** | 3 |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐ 高 —— 直接解决角色一致性需求 |
| **可复用模块** | 从单张照片生成高度一致的角色多视角图像。其图像处理管线、姿态控制逻辑、面部特征锁定算法可直接参考或集成为 StarCanvas 的角色节点后端。 |

### 3.2 CharacterGen —— 3D 角色多视角生成
| 属性 | 详情 |
|:---|:---|
| **项目页** | https://charactergen.github.io/ |
| **论文** | https://arxiv.org/html/2402.17214 |
| **许可证** | 需确认（论文项目，通常随代码附带） |
| **关联度** | ⭐⭐⭐ 中 —— 生成 3D 角色 mesh 和多视角一致图像 |
| **可复用模块** | 单图输入生成 3D 姿态统一的角色网格。若代码开源，其多视角姿态归一化（pose canonicalization）模块对角色三视图生成有价值。 |

### 3.3 InstantCharacter —— 腾讯混元角色一致性
| 属性 | 详情 |
|:---|:---|
| **来源** | 腾讯 Hunyuan + InstantX 团队 |
| **许可证** | 需确认 |
| **关联度** | ⭐⭐⭐ 中 —— 参考图像 + 文本描述生成一致角色 |
| **可复用模块** | 作为 ComfyUI 工作流节点存在，可参考其跨帧特征锁定和参考图像注入机制。 |

> **注**：角色一致性领域目前高质量开源实现较少，多数为研究论文或 ComfyUI 工作流。建议以 `consistent-character` 为基础，结合 StarCanvas 自研的 Prompt 锁定和 Seed 固化策略。

---

## 4. 紫微斗数/命理引擎

### 4.1 iztro —— 轻量级紫微斗数排盘库
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/SylarLong/iztro |
| **许可证** | MIT |
| **Stars** | 3.8k |
| **语言** | TypeScript（99.5%） |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 可直接嵌入 StarCanvas 作为角色命理计算引擎 |
| **可复用模块** | 完整的紫微斗数排盘算法、宫位计算、星曜分布、四化飞星、大限流年。可直接作为 npm 包引入，为角色生成命理属性数据。API 设计清晰，支持阳历/农历输入。 |

### 4.2 ziwei-doushu —— 倪海夏《天纪》体系排盘引擎
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/Renhuai123/ziwei-doushu |
| **许可证** | MIT |
| **Stars** | 2.1k |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 更完整的命理知识体系 |
| **可复用模块** | 基于倪海夏《天纪》的完整排盘系统，包含四化系统、格局知识库、古籍原文数据、51.8 万条命盘样本数据。其「格局知识库」和「古籍原文」对 StarCanvas 角色命理文案生成非常有价值。 |

---

## 5. 节点式工作流UI

### 5.1 React Flow (xyflow) —— 节点式 UI 基础库
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/xyflow/xyflow |
| **许可证** | MIT |
| **Stars** | 37k |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— StarCanvas 已基于 React Flow 开发 |
| **可复用模块** | 核心依赖库无需多说。可关注其 `examples` 目录中的自定义节点、边类型、迷你地图、背景网格、Dnd 拖拽面板等实现。此外 `@xyflow/react` v12 新增的画布协同、节点分组、子流（subflow）功能值得升级使用。 |

### 5.2 Open Agent Builder —— 节点式 AI 工作流（重复提及，见第2节）
| 属性 | 详情 |
|:---|:---|
| **可复用模块** | 其完整的节点渲染器、属性面板、执行状态反馈 UI、节点错误高亮等组件设计，对 StarCanvas 的「TapNow 风格」画布有很高的参考价值。 |

### ❌ 排除项
| 项目 | 原因 |
|:---|:---|
| ComfyUI | GPL-3.0 许可证，Stars 116k，不可直接复制代码 |

---

## 6. 社区/模板系统

### 6.1 n8n —— 工作流自动化平台
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/n8n-io/n8n |
| **许可证** | Sustainable Use License (fair-code) |
| **Stars** | 192k |
| **语言** | TypeScript |
| **关联度** | ⭐⭐⭐⭐ 高 —— 工作流模板市场标杆 |
| **可复用模块** | ⚠️ 非 MIT，但源代码完全开放且允许自托管。其工作流 JSON 数据结构、模板导入/导出机制、节点凭证管理系统、版本控制逻辑、以及 n8n.io/workflows 模板市场的社区运营模式，对 StarCanvas 工作流克隆和社区生态建设有极高参考价值。 |

### 6.2 Open Agent Builder —— 模板系统（重复提及）
| 属性 | 详情 |
|:---|:---|
| **可复用模块** | 其工作流模板的序列化/反序列化逻辑、节点配置快照机制，可作为 StarCanvas 「工作流克隆」功能的基础参考。 |

> **注**：纯 MIT 许可证的「节点图模板市场」开源项目较少。建议参考 n8n 的运营模式自研，配合 React Flow 的 `toObject()` / `addNodes()` API 实现工作流导入导出。

---

## 7. 一键拉片/视频分析

### 7.1 PySceneDetect —— 视频场景/镜头检测
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/Breakthrough/PySceneDetect |
| **许可证** | BSD-3-Clause（类 MIT，可商用） |
| **Stars** | 4.9k |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 上传视频自动拆解分镜的核心引擎 |
| **可复用模块** | 内容感知场景检测算法、自适应阈值检测、关键帧提取、视频自动切分。提供 Python API 和命令行工具，可包装为 StarCanvas 后端微服务。与 FFmpeg 集成可实现自动分镜切片。 |

### 7.2 ShotDetection —— 长视频镜头检测
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/AnyiRao/ShotDetection |
| **许可证** | 基于 PySceneDetect（BSD） |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐ 高 —— 针对电影/长视频优化 |
| **可复用模块** | 针对复杂长视频（如电影）的镜头边界检测优化，可补充 PySceneDetect 在影视级内容上的检测精度。 |

---

## 8. 剪映草稿导出

### 8.1 pyJianYingDraft —— 剪映草稿生成工具
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/GuanYixuan/pyJianYingDraft |
| **许可证** | Apache-2.0 |
| **Stars** | 3.4k |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 直接实现剪映草稿导出需求 |
| **可复用模块** | 完整的剪映（CapCut 国内版）草稿文件生成库，支持音视频素材、文本、转场、动画、音频淡入淡出、气泡/花字等。可编程构建自动化剪辑流水线，直接集成到 StarCanvas 导出节点。 |

### 8.2 JyDraft —— 剪映草稿 + 云端渲染
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/HTWMedia/JyDraft |
| **许可证** | Apache-2.0 |
| **Stars** | 81 |
| **语言** | C# |
| **关联度** | ⭐⭐⭐⭐ 高 —— 补充云端并发渲染能力 |
| **可复用模块** | 除了生成剪映草稿外，还支持通过云端并发渲染导出视频。其云端渲染调度逻辑和 CapCut 自动化操作接口可作为 StarCanvas 云端导出服务的参考。 |

---

## 9. 运镜控制/镜头语言

> **搜索结论**：该方向目前缺乏可直接复用的 MIT/Apache 开源实现。多数相关项目为：
> - 学术研究（arXiv 论文）
> - 闭源商业软件
> - 游戏引擎中的摄像机控制模块（如 Unity Cinemachine，但为商业引擎组件）

### 建议方案
| 方案 | 说明 |
|:---|:---|
| **自研参数化运镜 DSL** | 参考电影镜头语言（推/拉/摇/移/跟/升/降/环绕），设计 JSON/YAML 格式的运镜参数描述语言 |
| **参考 Blender 摄像机动画** | Blender 为 GPL，但其运镜数学公式（贝塞尔曲线插值、欧拉角/四元数插值）是公开算法 |
| **参考 Three.js 摄像机控制器** | MIT 许可证，`OrbitControls`、`FlyControls`、`TrackballControls` 等实现可作为 3D 运镜参数化的基础 |

---

## 10. 配音/口型同步

### 10.1 MuseTalk —— 实时高保真唇同步
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/TMElyralab/MuseTalk |
| **许可证** | MIT |
| **Stars** | 6k |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 腾讯音乐出品，质量可靠 |
| **可复用模块** | 实时（30fps+）音频驱动唇形同步，基于 latent 空间修复技术，支持中/英/日多语言。可直接作为 StarCanvas 角色配音节点的后端服务，实现「上传音频 + 角色照片 → 口型同步视频」。 |

### 10.2 SadTalker —— 单图说话头生成
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/OpenTalker/SadTalker |
| **许可证** | Apache-2.0 |
| **Stars** | 13.9k |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐⭐ 极高 —— 成熟稳定的说话头方案 |
| **可复用模块** | 从单张静态人像和音频生成头部说话视频，支持 3D 面部关键点驱动、表情生成、头部姿态控制。其 `FaceVid2Vid` 渲染器和 `ExpNet` 表情网络可作为 StarCanvas 角色动画引擎的核心模块。 |

### 10.3 LatentSync —— 端到端唇同步扩散模型
| 属性 | 详情 |
|:---|:---|
| **GitHub** | https://github.com/bytedance/LatentSync |
| **许可证** | Apache-2.0 |
| **Stars** | 5.8k |
| **语言** | Python |
| **关联度** | ⭐⭐⭐⭐ 高 —— 字节跳动出品，高分辨率输出 |
| **可复用模块** | 基于 Stable Diffusion 潜在扩散模型的端到端唇同步框架，无需中间表示（如 3DMM），直接音频→高分辨率视频唇部运动生成。对高质量角色配音场景有优势。 |

### ❌ 排除项
| 项目 | 原因 |
|:---|:---|
| Wav2Lip (Rudrabha) | 13k Stars，但**无明确开源许可证**，仅限个人/研究/非商业用途，不可直接复制 |

---

## 总结：可直接集成/复制的项目清单

| 优先级 | 方向 | 项目 | 许可证 | Stars | 集成难度 |
|:---|:---|:---|:---|:---|:---|
| P0 | 视频合成 | ffmpeg.wasm | MIT | 17.6k | 低（npm 包） |
| P0 | 视频合成 | OpenReel Video | MIT | 3.4k | 中（参考代码） |
| P0 | 节点式UI | React Flow (xyflow) | MIT | 37k | 低（已在用） |
| P0 | 命理引擎 | iztro | MIT | 3.8k | 低（npm 包） |
| P0 | 命理引擎 | ziwei-doushu | MIT | 2.1k | 低（npm 包） |
| P0 | 口型同步 | MuseTalk | MIT | 6k | 中（Python 服务） |
| P0 | 口型同步 | SadTalker | Apache-2.0 | 13.9k | 中（Python 服务） |
| P1 | Chat→Canvas | Open Agent Builder | MIT | 2.3k | 中（参考架构） |
| P1 | 一键拉片 | PySceneDetect | BSD-3 | 4.9k | 中（Python 服务） |
| P1 | 剪映导出 | pyJianYingDraft | Apache-2.0 | 3.4k | 中（Python 服务） |
| P1 | 口型同步 | LatentSync | Apache-2.0 | 5.8k | 中（Python 服务） |
| P2 | Chat→Canvas | OpenCanvas | MIT | 9 | 低（参考代码） |
| P2 | 角色一致性 | consistent-character | MIT | 3 | 高（需适配） |
| P2 | 剪映导出 | JyDraft | Apache-2.0 | 81 | 中（C# 参考） |
| P2 | 社区模板 | n8n | fair-code | 192k | 中（参考模式） |

---

## ⚠️ 需排除的 GPL/AGPL/无许可证项目

| 项目 | Stars | 许可证 | 排除原因 |
|:---|:---|:---|:---|
| ComfyUI | 116k | GPL-3.0 | 强 copyleft，不可复制代码 |
| LosslessCut | 41.2k | GPL-2.0 | 强 copyleft，不可复制代码 |
| Wav2Lip | 13k | 无明确许可证 | 仅限非商业，不可复制 |

---

## 建议的集成路线图

### 第一阶段（MVP）
1. **视频合成**：以 `ffmpeg.wasm` 为核心，在浏览器端实现基础剪辑/拼接/字幕叠加
2. **画布基础**：基于 `React Flow` 完善 TapNow 风格节点交互
3. **命理计算**：集成 `iztro` 实现角色出生日期→紫微命盘→属性面板

### 第二阶段（功能扩展）
4. **Chat→Canvas**：参考 `Open Agent Builder` 的节点创建/连接逻辑，实现自然语言驱动画布
5. **一键拉片**：后端部署 `PySceneDetect`，将上传视频自动拆分为分镜节点
6. **剪映导出**：集成 `pyJianYingDraft`，支持一键导出剪映草稿

### 第三阶段（AI 增强）
7. **口型同步**：部署 `MuseTalk` / `SadTalker` 服务，实现角色配音+口型同步
8. **角色一致性**：基于 `consistent-character` 或自研 Prompt 工程，实现角色三视图锁定
9. **运镜控制**：自研参数化运镜 DSL，参考 Three.js 摄像机控制器实现预览
