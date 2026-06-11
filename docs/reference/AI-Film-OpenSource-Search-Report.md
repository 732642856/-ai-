# AI影视创作/制片/短剧生成 开源项目深度搜索报告

> 搜索时间: 2026-06-10 | 已排除已知项目: ArcReel, Moyin Creator, ComfyUI Frontend, Remotion, forge-film, story-shot-agent

---

## 一、AI短剧/影视生成平台（前端+后端全栈）

### 1. Pixelle-Video ⭐⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/AIDC-AI/Pixelle-Video |
| **Stars** | 21.9k |
| **License** | Apache-2.0 |
| **技术栈** | Python 80.7% + HTML 18.4%, FastAPI后端, Streamlit Web UI, ComfyUI工作流引擎, Docker部署 |
| **核心功能** | 输入主题→全自动生成视频文案→AI配图/视频→语音解说→BGM→一键合成。ComfyKit统一封装媒体生成能力，原子模块可灵活替换 |

**可复用组件:**
- ✅ **ComfyKit接口层**: 所有媒体生成能力(TTS/图像/视频)统一封装在ComfyUI工作流JSON后面，每个能力对应一个JSON → **StarCanvas可直接借鉴此抽象模式**
- ✅ **原子能力灵活组合架构**: 支持替换图像/视频/TTS/VLM等任意模块
- ✅ **Docker一键部署方案**: 生产级容器化方案
- ✅ **MkDocs文档体系**

**StarCanvas兼容性:** 后端Python生态，前端Streamlit不可直接复用。但**ComfyKit工作流抽象+原子模块替换模式**高度可借鉴，可在Next.js层实现相同的JSON工作流调度器。

---

### 2. Toonflow ⭐⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/HBAI-Ltd/Toonflow-app |
| **Gitee镜像** | https://gitee.com/HBAI-Ltd/Toonflow-app |
| **Stars** | 9.8k |
| **License** | Apache-2.0 (附补充商业协议) |
| **技术栈** | TypeScript 99.7%, Express 5, SQLite(better-sqlite3/knex), Vercel AI SDK, Socket.IO, Electron 40, Sharp |
| **核心功能** | 无限画布生产工作台, 三层Agent协作(决策/执行/监督), 持久化Agent记忆(ONNX向量检索), 章节事件图谱驱动改编, Skill文件化配置 |

**可复用组件:**
- ✅ **无限画布生产工作台**: 以类无限画布组织剧本/角色/分镜/素材/视频节点 → **与StarCanvas的@xyflow/react画布理念完全一致，架构可深度参考**
- ✅ **三层Agent协作体系**: 决策层→执行层→监督层，带质量审阅与修订反馈 → **可直接借鉴到StarCanvas的多Agent编排**
- ✅ **章节事件图谱**: 自动提取原著事件结构化存储 → **StarCanvas剧本解析可复用此模式**
- ✅ **Skill文件化配置**: 提示词外化为Markdown Skill文件 → **StarCanvas可借鉴为可插拔的Agent配置系统**
- ✅ **可编程供应商系统**: 设置中心直接编写TypeScript逻辑即时生效
- ✅ **Socket.IO实时通信**: 生成进度实时推送

**StarCanvas兼容性:** ⭐⭐⭐⭐⭐ **极高**。同为TypeScript+Electron生态，无限画布理念一致。核心差异在Toonflow用Express+SQLite后端，StarCanvas用Next.js，但Agent架构/事件图谱/Skill配置等可全面复用。

---

### 3. ViMax ⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/HKUDS/ViMax |
| **Stars** | 9.6k |
| **License** | MIT |
| **技术栈** | Python 94.8%, TypeScript 4.9%, uv包管理, 多LLM(OpenAI/Gemini), Nanobanana图像, Veo视频 |
| **核心功能** | 多智能体视频框架(导演/编剧/制片人/视频生成器), Idea2Video/Novel2Video/Script2Video/AutoCameo四种模式 |

**可复用组件:**
- ✅ **多Agent协作流程**: Director→Screenwriter→Producer→VideoGenerator角色分工 → **Agent编排逻辑可复用到StarCanvas**
- ✅ **Novel2Video改编引擎**: 智能叙事压缩+角色追踪+逐场景适配 → **小说→剧本→分镜的流程可参考**
- ✅ **AutoCameo个人形象**: 上传照片→客串角色 → **角色一致性方案的参考实现**
- ✅ **Idea2Video端到端**: 一句话→完整视频的自动化链路

**StarCanvas兼容性:** ⭐⭐⭐ 中等。后端Python框架，但Agent协作的架构设计（角色定义、任务流转、一致性检查）可直接映射到StarCanvas的Zustand状态机。TypeScript部分（4.9%）可能含前端代码可参考。

---

### 4. LocalMiniDrama ⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/xuanyustudio/LocalMiniDrama |
| **Stars** | 624 |
| **License** | MIT |
| **技术栈** | JavaScript 63.1%, Vue 34.2%, Electron 28, Express, SQLite(better-sqlite3), Element Plus, Pinia |
| **核心功能** | 8步一站式(故事→剧本→角色→场景→道具→分镜→图/视频→合成), @图片N引用机制, 全局素材库跨项目复用, 多AI服务商支持 |

**可复用组件:**
- ✅ **@图片N引用机制**: 全能片段中`@图片N`引用资产 → **这是StarCanvas需要的@mention/资产引用系统的直接参考实现！**
- ✅ **全局素材库**: 角色/场景/道具跨项目复用 → **资产管理系统可参考**
- ✅ **8步流水线**: 完整的短剧生产链路
- ✅ **一键流水线**: 智能跳过已有内容+失败重试(最多3次)
- ✅ **多AI服务商配置**: DashScope/Volcengine/Kling/Gemini/Vidu等

**StarCanvas兼容性:** ⭐⭐⭐ 中等偏上。Vue生态不可直接复用代码，但**@图片N引用机制的设计模式**可直接在React中重新实现。素材库和流水线设计也可参考。

---

### 5. shortdrama-pipeline ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/drasstry/shortdrama-pipeline |
| **Stars** | 106 |
| **License** | 未标注 |
| **技术栈** | Python 100%, FastAPI, SQLite, 火山方舟(Seed 2.0/Seedream/Seedance 2.0), ffmpeg |
| **核心功能** | 中文短剧后端自动化链路: 剧本→人物→视频, 人工审核门槛, Fake模式无API Key也能跑 |

**可复用组件:**
- ✅ **状态机驱动的生产链路**: 剧本确认→人物确认→视频生成，带审核门槛 → **StarCanvas的Zustand状态机可参考此流程控制**
- ✅ **脚本质检**: 自动生成warning-only质量报告 → **质量检查逻辑可复用**
- ✅ **项目续生产**: 复用已批准资产继续生成
- ✅ **CLI + API双模式**: FastAPI接口设计

**StarCanvas兼容性:** ⭐⭐ 低。纯Python后端，但**状态机流程+质检逻辑**的设计思想可直接映射到StarCanvas前端状态管理。

---

### 6. Story-Flicks ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/alecm20/story-flicks |
| **Stars** | 2.4k |
| **License** | 未标注 |
| **技术栈** | Python 79.9%(FastAPI) + TypeScript 15.8%(React + Ant Design + Vite) |
| **核心功能** | 一键生成高清故事短视频, 多AI模型提供商, 多语言语音支持 |

**可复用组件:**
- ✅ **React前端模板**: Ant Design + Vite + React → 可参考其组件结构
- ✅ **多模型配置模式**: OpenAI/Aliyun/DeepSeek/Ollama/SiliconFlow切换
- ✅ **视频合成管线**: 文案→配图→音频→字幕→合成

**StarCanvas兼容性:** ⭐⭐⭐ 中等。React+Vite前端可部分参考，但Ant Design与StarCanvas的Next.js+TailwindCSS体系不同。

---

### 7. HuobaoDrama (火宝短剧) ⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/gangrammer/huobao |
| **Stars** | ~0 (新项目) |
| **License** | CC BY-NC-SA 4.0 ⚠️ 非商业 |
| **技术栈** | Vue 52.2% + Go 36.4%(Gin/GORM/SQLite) + TypeScript 9%, DDD领域驱动设计 |
| **核心功能** | Go+Vue3全栈短剧平台, 剧本解析→角色分镜→视频合成, Docker一键部署 |

**可复用组件:**
- ✅ **DDD领域驱动设计**: API层→应用服务层→领域层→基础设施层 → **架构分层可参考**
- ⚠️ 非商业License限制复用范围

**StarCanvas兼容性:** ⭐ 低。Vue+Go生态差异大，且CC BY-NC-SA 4.0不可商用。仅DDD架构设计可参考。

---

### 8. Jellyfish (Gitee) ⭐⭐
| 属性 | 详情 |
|------|------|
| **Gitee** | https://gitee.com/longyoubc/Jellyfish |
| **Stars** | 7 |
| **License** | Apache-2.0 |
| **技术栈** | Python 41.3% + TSX 36.0% + TypeScript 21.6% |
| **核心功能** | 一站式AI短剧生产工具, 剧本输入→智能分镜→角色/场景/道具一致性→AI视频→后期剪辑→导出成片 |

**可复用组件:**
- ✅ **TSX + TypeScript前端**: 可能含React组件可直接参考
- ✅ **一致性管理模块**: 角色/场景/道具一致性方案
- ✅ **后期剪辑+导出**: 完整的后期流程

**StarCanvas兼容性:** ⭐⭐⭐ 中等。TSX前端部分可能有可参考的React组件，但项目成熟度低。

---

## 二、分镜/Storyboard专用工具

### 9. Storyboard-Copilot (分镜助手) ⭐⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/henjicc/Storyboard-Copilot |
| **Stars** | 593 |
| **License** | 未标注 |
| **技术栈** | React 18 + TypeScript 79.2% + **@xyflow/react** + Zustand + TailwindCSS + Tauri 2 + Rust 17.7% + SQLite |
| **核心功能** | 基于节点画布的AI分镜工作台, 自动持久化, 可扩展架构(新AI模型/工具/节点) |

**可复用组件:**
- ✅ **@xyflow/react + Zustand画布架构** → **与StarCanvas技术栈完全一致！可直接参考其节点注册/数据流/渲染组件模式**
- ✅ **可扩展架构**: `src/features/canvas/models/image/<provider>/`下的模型注册方式 → **StarCanvas的模型接入可复用**
- ✅ **分层数据流**: UI → Store → Application Service → Command/API → Persistence → **与StarCanvas的Zustand架构高度一致**
- ✅ **自动持久化**: projectStore驱动的自动保存 → **SQLite持久化方案可参考**
- ✅ **i18n国际化**: react-i18next + 中英文语言包

**StarCanvas兼容性:** ⭐⭐⭐⭐⭐ **极高**。**这是最接近StarCanvas技术栈的项目！** 同为@xyflow/react + Zustand + TailwindCSS，节点注册、数据流、持久化方案可直接复用或深度参考。Tauri 2桌面端方案也是Electron的优质替代参考。

---

### 10. AI-Storyboard-Generator ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/dseditor/AI-storyboard-generator |
| **Stars** | 15 |
| **License** | MIT |
| **技术栈** | React 19 + TypeScript 90.4% + Vite + Gemini API + ComfyUI + FFmpeg.wasm |
| **核心功能** | 6种创意模式分镜生成, 双图像提供商(Gemini+ComfyUI), 视频后处理(FFmpeg合并) |

**可复用组件:**
- ✅ **FFmpeg.wasm客户端视频合并**: 无需后端即可合并视频 → **StarCanvas可直接集成此方案做本地视频合成**
- ✅ **6种创意模式**: 人物特写/场景人物/物体特写/叙事场景/动画风格/自由风格 → **分镜模板系统可参考**
- ✅ **ZIP项目管理**: 导出/导入/追加合并 → **项目持久化方案**

**StarCanvas兼容性:** ⭐⭐⭐⭐ 高。React 19 + TypeScript + Vite与StarCanvas前端栈高度兼容。FFmpeg.wasm方案可直接集成。

---

### 11. Storyboard-AI ⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/dizzafizza/Storyboard-AI |
| **Stars** | 3 |
| **License** | GPL-3.0 / MIT (标注不一致) |
| **技术栈** | React 18 + TypeScript + Tailwind CSS + Vite + OpenAI(GPT-4+DALL-E 3) |
| **核心功能** | 100%客户端隐私优先分镜生成, 高级时间线编辑器, 电影镜头类型, 导演备注 |

**可复用组件:**
- ✅ **高级时间线编辑器**: 内置时间线组件 → **可参考其实现**
- ✅ **电影镜头类型系统**: 特写/广角/过肩镜头等分类
- ✅ **隐私优先架构**: 100%客户端运行

**StarCanvas兼容性:** ⭐⭐⭐ 中等。React+TS+Tailwind可参考，但项目规模太小，更多是设计参考而非代码复用。

---

## 三、AI角色一致性 / 视频生成模型

### 12. JoyAI-Echo (京东) ⭐⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/jd-opensource/JoyAI-Echo |
| **Stars** | 1.3k |
| **License** | LTX-2 Community License ⚠️ 仅学术/非商业 |
| **技术栈** | Python 100%, PyTorch 2.8, CUDA 12.8, Gemma-3-12b-it文本编码器, LTX-2.3基础视频生成器, DMD蒸馏加速 |
| **核心功能** | 跨模态音视频记忆库(5分钟一致性), DMD 7.5x加速, ComfyUI集成, 对话式交互编辑 |

**可复用组件:**
- ✅ **ComfyUI节点包**: 官方推理管道的ComfyUI节点 → **StarCanvas可集成此ComfyUI工作流**
- ✅ **跨模态记忆库设计**: 基于先前视觉身份+语音上下文为每个新镜头提供条件 → **角色一致性方案的核心参考**
- ✅ **提示增强器**: 短故事→完整镜头提示的模板系统
- ✅ **YAML配置+CLI覆盖**: 灵活的推理参数管理

**StarCanvas兼容性:** ⭐⭐ 低（代码层面），但**ComfyUI节点+一致性方案设计**是高价值参考。LTX-2 License限制商业使用。

---

### 13. CharaConsist ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/Murray-Wang/CharaConsist |
| **Stars** | 162 |
| **License** | 未标注 |
| **技术栈** | Jupyter Notebook 99.8% + Python 0.2%, FLUX.1-dev, diffusers |
| **核心功能** | 无训练的细粒度角色一致性, 前景+背景可选保留, 固定/多背景/混合背景三类场景 |

**可复用组件:**
- ✅ **无训练掩码提取+点匹配策略**: 可作为图像编辑工具复用
- ✅ **三类一致性场景**: 固定背景/多背景跨场景/混合背景 → **StarCanvas角色一致性模块的场景分类参考**

**StarCanvas兼容性:** ⭐ 低。纯研究代码，但一致性策略的**设计分类**可映射到StarCanvas的参数面板。

---

### 14. MovieAgent ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/showlab/MovieAgent |
| **Stars** | 338 |
| **License** | 未标注 |
| **技术栈** | Python 98.7%, GPT-4o, ROICtrl+StoryDiffusion(角色定制), SVD/HunyuanVideo_I2V(视频) |
| **核心功能** | 层次化CoT推理的自动化电影生成, 导演/编剧/故事板/场景经理多Agent |

**可复用组件:**
- ✅ **层次化CoT推理流程**: Director→Screenwriter→Storyboard Artist→Scene Manager → **可映射为StarCanvas的Agent工作流**
- ✅ **角色一致性方案**: ROICtrl + StoryDiffusion的实现路径
- ✅ **自动化管线**: 故事线→场景→摄影→角色互动

**StarCanvas兼容性:** ⭐⭐ 低。纯Python研究框架，但Agent角色分工和CoT推理流程的设计思想可参考。

---

### 15. FilmAgent ⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/amankton/filmagent |
| **Stars** | 较少 |
| **License** | 未标注 |
| **技术栈** | LLM多Agent + Unity 3D沙盒 |
| **核心功能** | 3D虚拟空间中的端到端电影自动化, 模拟导演/编剧/演员/摄影师 |

**可复用组件:**
- ✅ **3D虚拟制片流程**: Unity集成方案
- ✅ **多Agent角色模拟**: 影视制作团队角色分工

**StarCanvas兼容性:** ⭐ 低。Unity 3D生态，但多Agent角色分工模型可参考。

---

## 四、关键通用组件

### 16. @xzdarcy/react-timeline-editor ⭐⭐⭐⭐⭐ (Timeline组件)
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/xzdarcy/react-timeline-editor |
| **Stars** | 750 |
| **License** | MIT |
| **技术栈** | TypeScript 79.9%, Less, React |
| **核心功能** | 时间轴动画编辑器, 拖拽/缩放/网格吸附/辅助线/无限滚动, TimelineRow+Action+Effect模型 |

**可复用组件:**
- ✅ **<Timeline>主组件**: 直接可用的React时间轴编辑器
- ✅ **TimelineRow + Action + Effect数据模型**: start/end时间+特效ID → **StarCanvas时间轴的完美起点**
- ✅ **拖拽+缩放+吸附交互**: 开箱即用的交互能力
- ✅ **MIT许可**: 无限制商业使用

**StarCanvas兼容性:** ⭐⭐⭐⭐⭐ **极高**。纯React+TypeScript组件，MIT许可，npm包`@xzdarcy/react-timeline-editor`可直接安装使用。**这是StarCanvas时间轴的最佳候选方案。**

---

### 17. video-editing-timeline ⭐⭐⭐⭐ (Timeline组件-视频专用)
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/pansyjs/video-editing-timeline |
| **Stars** | 97 |
| **License** | MIT |
| **技术栈** | TypeScript + Lerna多包, 提供React/Vue/原生三个版本 |
| **核心功能** | 专为视频编辑设计的时间线, 核心包<10K(gzip<3K), 自定义画布/刻度/时长 |

**可复用组件:**
- ✅ **video-editing-timeline-react**: 直接可用的React版本
- ✅ **超轻量**: gzip<3K, 不影响StarCanvas打包体积
- ✅ **视频编辑专用**: 比react-timeline-editor更贴近剪映的时间轴设计
- ✅ **MIT许可**: 无限制使用

**StarCanvas兼容性:** ⭐⭐⭐⭐⭐ **极高**。React版可直接集成，视频编辑专用的刻度/轨道设计更贴近StarCanvas需求。建议**与react-timeline-editor对比选型**。

---

### 18. rgb-curve ⭐⭐⭐⭐ (调色组件)
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/LittleBoy9/rgb-curve |
| **Stars** | 2 |
| **License** | MIT |
| **技术栈** | TypeScript 41.5% + HTML 58.5%, React(Vite), 零额外依赖 |
| **核心功能** | RGB曲线编辑器(Master/RGB四通道), 三次样条插值, 返回控制点+256值LUT, 暗色主题 |

**可复用组件:**
- ✅ **RGB曲线编辑器**: 直接可用的调色组件
- ✅ **LUT输出**: 返回256值LUT可直接用于像素处理 → **StarCanvas调色面板的核心组件**
- ✅ **零依赖**: gzip约6K, 极轻量
- ✅ **完整TypeScript支持**: 类型定义完善
- ✅ **JSON style props**: 可完全自定义样式

**StarCanvas兼容性:** ⭐⭐⭐⭐⭐ **极高**。纯React+TypeScript组件，MIT许可，零依赖，可直接npm install。**这是StarCanvas参数化调色面板的直接可用方案。**

---

### 19. react-mentions ⭐⭐⭐⭐ (@mention组件)
| 属性 | 详情 |
|------|------|
| **npm** | react-mentions |
| **GitHub** | 原signavio/react-mentions可能已迁移, npm包仍在维护 |
| **License** | BSD-3-Clause |
| **技术栈** | React, JavaScript |
| **核心功能** | textarea中的@mention和标签功能, 支持CSS Modules/内联样式, 生产级验证 |

**可复用组件:**
- ✅ **MentionsInput组件**: textarea中的@mention功能 → **StarCanvas资产引用系统的基础**
- ✅ **建议列表**: 触发@字符时弹出候选列表
- ✅ **生产级验证**: Signavio/Wix等企业级应用中使用
- ⚠️ BSD-3-Clause需保留版权声明

**StarCanvas兼容性:** ⭐⭐⭐⭐ 高。成熟稳定的React组件，但需要扩展为资产引用系统(从@人→@角色/@场景/@道具)。LocalMiniDrama的`@图片N`机制是更好的设计参考。

---

### 20. react-component/mentions (rc-mentions) ⭐⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/react-component/mentions |
| **License** | MIT |
| **技术栈** | React, TypeScript |

Ant Design的底层@mention组件，更轻量，MIT许可更友好。

---

## 五、全景/3D场景相关

### 21. panoramic-system-development (720全景编辑器) ⭐⭐
| 属性 | 详情 |
|------|------|
| **GitHub** | https://github.com/njdmznkj/panoramic-system-development |
| **Stars** | 较少 |
| **License** | 未标注 |
| **技术栈** | krpano全景引擎 |
| **核心功能** | 720全景开发编辑器, VR全景, krpano编辑器 |

**可复用组件:**
- ✅ **krpano全景集成方案**: 如StarCanvas需要720全景场景预览可参考
- ⚠️ krpano本身是商业软件

**StarCanvas兼容性:** ⭐ 低。krpano商业生态，但如果需要全景预览功能，集成思路可参考。

---

## 六、综合评估与StarCanvas集成优先级

### 优先级排序（可直接集成到StarCanvas的组件/项目）

| 优先级 | 项目/组件 | 复用方式 | 预估工时 |
|--------|----------|---------|---------|
| **P0** | Storyboard-Copilot | @xyflow/react+Zustand架构直接参考，节点注册/数据流/持久化方案复用 | 架构参考 |
| **P0** | @xzdarcy/react-timeline-editor | npm install直接使用，作为时间轴基础 | 1-2天集成 |
| **P0** | rgb-curve | npm install直接使用，作为调色面板核心 | 1天集成 |
| **P0** | video-editing-timeline-react | 与react-timeline-editor对比选型 | 1天评估 |
| **P1** | Toonflow | 无限画布+三层Agent+事件图谱架构参考 | 架构参考 |
| **P1** | AI-Storyboard-Generator | FFmpeg.wasm客户端视频合并方案 | 2-3天集成 |
| **P1** | LocalMiniDrama | @图片N资产引用机制设计模式参考 | 3-5天实现 |
| **P1** | react-mentions / rc-mentions | @mention基础功能，需扩展为资产引用 | 2-3天扩展 |
| **P2** | Pixelle-Video | ComfyKit工作流抽象模式参考 | 架构参考 |
| **P2** | ViMax | 多Agent协作流程(4角色)设计参考 | 架构参考 |
| **P2** | JoyAI-Echo | ComfyUI节点包+跨模态记忆库方案参考 | 后端集成 |
| **P3** | MovieAgent/FilmAgent | 层次化CoT推理流程参考 | 设计参考 |
| **P3** | CharaConsist | 一致性场景分类(3类)参考 | 设计参考 |
| **P3** | Jellyfish | TSX前端组件参考(项目成熟度低) | 按需 |

### StarCanvas技术栈映射总结

| StarCanvas需求 | 最佳开源参考 | 复用方式 |
|---------------|-------------|---------|
| **节点画布** | Storyboard-Copilot | 同为@xyflow/react+Zustand，架构直接参考 |
| **时间轴** | react-timeline-editor / video-editing-timeline-react | npm直接安装 |
| **调色面板** | rgb-curve | npm直接安装，LUT输出 |
| **@资产引用** | LocalMiniDrama(@图片N) + rc-mentions | 设计模式参考+基础组件 |
| **Agent编排** | Toonflow(三层) / ViMax(四角色) | 架构参考 |
| **工作流引擎** | Pixelle-Video(ComfyKit) | JSON工作流抽象模式 |
| **角色一致性** | JoyAI-Echo(跨模态记忆库) | ComfyUI集成方案 |
| **视频合成** | AI-Storyboard-Generator(FFmpeg.wasm) | 客户端合并方案 |
| **项目持久化** | Storyboard-Copilot(SQLite) / LocalMiniDrama(ZIP) | 持久化方案参考 |

---

*报告结束。共发现15+个新开源项目，4个可直接npm install的React组件。*
