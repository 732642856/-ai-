# 短剧 Agent 2.0 核心功能实现方案

> 对标小云雀短剧 Agent 2.0 的参数化独立面板 + @资产引用系统 + 角色三视图控制
> 编制日期：2026-06-10

---

## 目录

1. [方案概览](#1-方案概览)
2. [开源项目调研报告](#2-开源项目调研报告)
3. [参数化独立面板实现方案](#3-参数化独立面板实现方案)
4. [@资产引用系统实现方案](#4-资产引用系统实现方案)
5. [角色三视图专业控制面板](#5-角色三视图专业控制面板)
6. [数据结构设计总览](#6-数据结构设计总览)
7. [可复用代码片段](#7-可复用代码片段)
8. [分阶段实施计划](#8-分阶段实施计划)

---

## 1. 方案概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        短剧 Agent 2.0 架构                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌──────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│ │ 剧本引擎  │  │   资产库系统      │  │   参数化面板系统          │  │
│ │ (LLM)    │─▶│ Assets Manager   │◀─│ Parameterized Panels     │  │
│ └──────────┘  └──────┬───────────┘  └──┬───────────────────────┘  │
│                      │                  │                          │
│                      ▼                  ▼                          │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │                    故事板 (Storyboard)                        │   │
│ │  ┌────────────────────────────────────────────────────────┐  │   │
│ │  │  分镜脚本编辑器 (@资产引用系统)                          │  │   │
│ │  │  输入 @ 弹出资产选择器 → 插入 @node:xxx 引用             │  │   │
│ │  └────────────────────────────────────────────────────────┘  │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                      │                                              │
│                      ▼                                              │
│ ┌──────────────────────────────────────────────┐                   │
│ │           Prompt 生成引擎                      │                   │
│ │  参数面板值 + @引用资产 + 剧本上下文 → Prompt   │                   │
│ └──────────────────────────────────────────────┘                   │
│                      │                                              │
│                      ▼                                              │
│ ┌──────────────────────────────────────────────┐                   │
│ │        Seedance / Stable Diffusion API        │                   │
│ └──────────────────────────────────────────────┘                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块关系

| 模块 | 职责 | 依赖 |
|------|------|------|
| **参数化面板** | 提供光影/镜头/景别等参数的滑块/下拉选交互，实时映射为Prompt片段 | 无 |
| **@资产引用系统** | 在文本编辑器中通过@触发资产选择，插入结构化引用 | 富文本编辑器 |
| **资产库系统** | 管理角色、场景、道具的结构化资产树 | 数据库/存储 |
| **Prompt生成引擎** | 组合参数面板值 + @引用资产 → 最终Prompt | 参数面板 + 资产引用 |
| **角色三视图面板** | 展示角色正面/侧面/背面参照图，锁定角色一致性 | 资产库 |

---

## 2. 开源项目调研报告

### 2.1 @Mention 组件对比

| 特性 | react-mentions | @tiptap/extension-mention | lexical-beautiful-mentions | rc-mentions |
|------|:---:|:---:|:---:|:---:|
| **npm包名** | `react-mentions` | `@tiptap/extension-mention` | `lexical-beautiful-mentions` | `rc-mentions` |
| **最新版本** | v4.4.10 | v3.26.0 | v0.1.48 | v2.20.0 |
| **许可证** | BSD-3-Clause | MIT | MIT | MIT |
| **React 18 兼容** | ✅ | ✅ | ✅ | ✅ |
| **React 19 兼容** | 需验证 | ✅ (基于ProseMirror) | ✅ (基于Lexical) | 需验证 |
| **自定义触发器** | @ 固定 | 任意字符 | 任意字符 | @ 固定 |
| **自定义渲染** | 高(模板函数) | 高(Vue/React节点) | 高(React组件) | 中 |
| **弹出建议列表** | 内置 | 内置(需UI) | 内置 | 内置 |
| **富文本支持** | ❌(纯文本) | ✅(ProseMirror) | ✅(Lexical) | ❌(纯文本) |
| **学习成本** | 低 | 中(需学Tiptap) | 中(需学Lexical) | 低 |
| **GitHub Stars** | ~3.5k | ~30k(Tiptap) | ~300 | ~500 |
| **适合场景** | 简单textarea替换 | 富文本编辑器 | 富文本编辑器 | Ant Design生态 |

#### 推荐选择：**react-mentions v4.4.10**

选择理由：
1. **零侵入**：直接替换 `<textarea>` 即可，无需引入完整富文本编辑器
2. **成熟稳定**：v4.4.10 是稳定版本，社区广泛使用
3. **轻量**：仅 21.5KB gzipped，无额外依赖负担
4. **React 18 完全兼容**：使用 `forwardRef`，支持受控组件模式
5. **自定义渲染能力强**：可自定义建议列表中的每一项 UI
6. **灵活的匹配规则**：支持正则自定义触发逻辑

> 如果后续需要富文本排版能力（加粗/斜体/多格式），再升级到 Tiptap + `@tiptap/extension-mention`。此方案为先简单后复杂留好升级路径。

### 2.2 Prompt 生成引擎对比

| 项目 | 描述 | 许可证 | 可复用度 |
|------|------|:------:|:--------:|
| [Prompt-Builder](https://github.com/rhtvrtk/Prompt-Builder) | Streamlit 提示词生成器 | MIT | ⭐⭐⭐ (参考思路) |
| Seedance 2.0 Prompt Guide | 结构化提示词公式 | - | ⭐⭐⭐⭐⭐ (规则借鉴) |
| BuildPrompts | 开源 Prompting IDE | MIT | ⭐⭐ (架构参考) |
| 小云雀画风库 (闭源) | 100+ 影视级画风 | 商业 | ⭐ (功能对标) |

**结论**：当前**没有可以直接复用的 Prompt 生成引擎**，需要自建映射规则引擎。但 Seedance 2.0 的提示词公式提供了完整的参考框架。

### 2.3 3D角色视图组件

| 项目 | 描述 | 许可证 | 用途 |
|------|------|:------:|:----:|
| [ThreeDViewer](https://github.com/LEMing/ThreeDViewer) | React + Three.js 3D查看器 | MIT | 3D模型展示 |
| [camera-controls](https://github.com/yomotsu/camera-controls) | three.js 摄像机控制 | MIT | 平滑视角切换 |
| react-three-fiber | Three.js React 渲染器 | MIT | 3D场景构建 |
| OrbitControls | three.js 标准轨道控制 | MIT | 自由视角旋转 |

**结论**：角色三视图在短剧场景中本质是**2D图片的三视角展示**（非3D模型），所以不需要 three.js。使用普通 React 组件 + CSS 动画即可实现视图切换。如需未来展示3D角色模型，可使用 react-three-fiber。

---

## 3. 参数化独立面板实现方案

### 3.1 参数维度总览

```
┌──────────────────────────────────────────────────────────────┐
│                     参数维度列表                              │
├──────────────┬───────────────┬───────────────┬────────────────┤
│   景别控制    │   镜头控制     │   光线控制     │   色调控制     │
├──────────────┼───────────────┼───────────────┼────────────────┤
│ 特写(CloseUp)│ 推(Push In)   │ 硬光(Hard)    │ 暖调(Warm)    │
│ 中景(Medium) │ 拉(Pull Out)  │ 柔光(Soft)    │ 冷调(Cool)    │
│ 全景(Wide)   │ 摇(Pan)       │ 侧光(Side)    │ 复古(Retro)   │
│ 远景(Extreme)│ 移(Dolly)     │ 顶光(Top)     │ 高饱和(Vivid) │
│ 过肩(OTS)    │ 跟(Tracking)  │ 背光(Back)    │ 低饱和(Muted) │
│              │ 环绕(Orbit)   │ 环境光(Ambient)│ 黑白(BW)     │
│              │ 手持(Handheld) │ 自然光(Natural)│ 电影调色(Cine)│
├──────────────┴───────────────┴───────────────┴────────────────┤
│   景深控制         │   画幅控制     │   视角控制              │
├────────────────────┼───────────────┼─────────────────────────┤
│ 浅景深(Shallow DOF)│ 竖屏9:16      │ 平视(Eye Level)        │
│ 大景深(Deep DOF)   │ 横屏16:9      │ 仰视(Low Angle)        │
│ 微距(Macro)         │ 方形1:1       │ 俯视(High Angle)       │
│                     │ 宽银幕21:9    │ 荷兰角(Dutch Angle)    │
└────────────────────┴───────────────┴─────────────────────────┘
```

### 3.2 映射规则引擎设计

#### 3.2.1 核心架构

```
用户交互 (Slider/Select)
        │
        ▼
┌─────────────────────────────┐
│    映射规则引擎              │
│                             │
│  单维度映射表                │    每个维度独立映射
│  ┌───────────────────────┐  │    e.g. 柔光 70% → "soft diffused lighting"
│  │ DimensionMapItem[]    │  │
│  └───────────────────────┘  │
│                             │
│  多维度组合规则              │    维度间交叉影响
│  ┌───────────────────────┐  │    e.g. 硬光 + 冷调 → "harsh cool lighting"
│  │ CrossDimensionRule[]  │  │
│  └───────────────────────┘  │
│                             │
│  模板引擎                   │    按顺序组装 Prompt
│  ┌───────────────────────┐  │    e.g. [景别] + [光线] + [镜头] + [色调]
│  │ PromptTemplate[]      │  │
│  └───────────────────────┘  │
│                             │
│  画风预设                   │    一键覆盖所有参数
│  ┌───────────────────────┐  │    e.g. "柯达暖黄胶片复古"
│  │ StylePreset[]         │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│    AI Prompt 输出           │
│ "medium shot, soft diffused │
│  lighting, dolly in, warm  │
│  cinematic tone, shallow   │
│  depth of field, 9:16"     │
└─────────────────────────────┘
```

#### 3.2.2 映射规则数据结构

```typescript
// ===== 参数维度定义 =====

/** 景别参数 */
export interface ShotSizeParams {
  type: 'close-up' | 'medium' | 'wide' | 'extreme-wide' | 'over-shoulder';
  /** 0-100, 特写到远景的连续值 */
  value: number;
}

/** 镜头运动参数 */
export interface CameraMoveParams {
  type: 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'dolly' | 
        'tracking' | 'orbit' | 'handheld' | 'static' | 'zoom';
  /** 运动速度 0-100 */
  speed: number;
}

/** 光线参数 */
export interface LightingParams {
  /** 光源方向 */
  direction: 'front' | 'side-left' | 'side-right' | 'top' | 'back' | 'bottom' | 'three-point';
  /** 亮度 0-100 */
  brightness: number;
  /** 硬光~柔光 0(硬)-100(柔) */
  hardness: number;
  /** 色温 0(冷)-100(暖) */
  warmth: number;
  /** 是否使用环境光 */
  ambient: boolean;
}

/** 色调参数 */
export interface ToneParams {
  /** 色调类型 */
  style: 'warm' | 'cool' | 'retro' | 'vivid' | 'muted' | 'bw' | 'cinematic';
  /** 饱和度 0-100 */
  saturation: number;
  /** 对比度 0-100 */
  contrast: number;
}

/** 景深参数 */
export interface DepthOfFieldParams {
  type: 'shallow' | 'deep' | 'macro' | 'none';
  /** 模糊程度 0-100 */
  blurIntensity: number;
}

/** 画幅参数 */
export interface AspectRatioParams {
  type: '9:16' | '16:9' | '1:1' | '21:9';
}

/** 视角参数 */
export interface CameraAngleParams {
  type: 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'birds-eye';
  /** 俯仰角度 -90~90 */
  pitch: number;
}

// ===== 映射引擎 =====

/** 维度映射项 */
interface DimensionMapItem {
  dimension: string;
  valueRange: [number, number];
  promptFragments: string[];
  weight: number; // 0-1, 影响最终 prompt 的比重
}

/** 交叉维度映射规则 */
interface CrossDimensionRule {
  dimensions: string[]; // 涉及哪些维度
  condition: (values: Record<string, number>) => boolean;
  promptFragment: string;
  priority: number;
}

/** 画风预设 */
interface StylePreset {
  id: string;
  name: string;
  description: string;
  params: Partial<{
    shotSize: ShotSizeParams;
    cameraMove: CameraMoveParams;
    lighting: LightingParams;
    tone: ToneParams;
    depthOfField: DepthOfFieldParams;
    aspectRatio: AspectRatioParams;
    cameraAngle: CameraAngleParams;
  }>;
  qualityTags: string[];
  negativePrompt: string[];
}

/** Prompt 模板 */
interface PromptTemplate {
  /** 模板字符串，使用 {{维度名}} 作为占位符 */
  template: string;
  /** 输出顺序，决定片段排列 */
  order: number;
}
```

### 3.3 映射表完整设计

#### 3.3.1 景别映射表 (Shot Size)

| 滑块值(0-100) | 映射分类 | Prompt 片段 | 说明 |
|:---:|:---|:---|:---|
| 0-10 | 大特写 (Extreme Close-Up) | `extreme close-up shot, intense focus on details` | 眼部/嘴唇等局部 |
| 10-30 | 特写 (Close-Up) | `close-up shot, face filling the frame` | 人物面部表情 |
| 30-50 | 中近景 (Medium Close-Up) | `medium close-up shot, chest up framing` | 胸部以上 |
| 50-65 | 中景 (Medium Shot) | `medium shot, waist up framing` | 腰部以上 |
| 65-80 | 中全景 (Medium Full Shot) | `medium full shot, knee level framing` | 膝盖以上 |
| 80-90 | 全景 (Full Shot) | `full shot, full body visible` | 全身 |
| 90-95 | 远景 (Wide Shot) | `wide shot, subject in context of environment` | 人物在环境中 |
| 95-100 | 大远景 (Extreme Wide Shot) | `extreme wide shot, epic landscape view` | 风景/大场面 |

#### 3.3.2 镜头运动映射表 (Camera Movement)

| 类型 | Prompt 片段 | 速度修饰(慢→快) |
|:---|:---|:---|
| push-in | `slow cinematic push-in` / `dynamic push-in camera movement` | `slow/smooth/gentle` → `rapid/quick/dynamic` |
| pull-out | `slow dolly out` / `revealing pull-back shot` | `slow` → `rapid` |
| pan-left | `gentle pan left` / `panning left` | `gentle/slow` → `quick/rapid` |
| pan-right | `gentle pan right` / `panning right` | `gentle/slow` → `quick/rapid` |
| dolly | `smooth tracking shot` / `dolly movement` | `smooth` → `fast` |
| tracking | `tracking shot following the subject` / `following tracking shot` | `gentle` → `dynamic` |
| orbit | `slow 180-degree camera orbit` / `360-degree orbit around subject` | `slow 180°` → `360°` |
| handheld | `gentle handheld camera motion` / `intense handheld camera` | `gentle` → `shaky/intense` |
| static | `static camera, locked-off shot` | 无速度变化 |
| zoom | `slow zoom in` / `dramatic zoom` | `slow` → `dramatic/quick` |

#### 3.3.3 光线映射表 (Lighting)

| 参数 | 值范围 | Prompt 片段映射 |
|:---|:---:|:---|
| **方向** | | |
| front | - | `front lighting, even illumination` |
| side-left | - | `side lighting from left, dramatic shadows` |
| side-right | - | `side lighting from right, strong shadows` |
| top | - | `top lighting, overhead illumination` |
| back | - | `backlighting, rim light, silhouette edges` |
| bottom | - | `underlighting, up-lighting, dramatic horror effect` |
| three-point | - | `three-point lighting setup, professional studio lighting` |
| **亮度** | 0-100 | |
| 0-20 | 极暗 | `dim lighting, low-key, shadowy, moody atmosphere` |
| 20-40 | 暗 | `low-key lighting, shadows and highlights` |
| 40-60 | 适中 | `balanced lighting, natural exposure` |
| 60-80 | 亮 | `bright illumination, well-lit scene` |
| 80-100 | 极亮 | `overexposed, high-key lighting, ethereal glow` |
| **硬度** | 0-100 | |
| 0-20 | 极硬 | `harsh lighting, sharp shadows, high contrast` |
| 20-40 | 硬 | `hard lighting, defined shadows` |
| 40-60 | 适中 | `moderate lighting, balanced shadows` |
| 60-80 | 柔 | `soft lighting, gentle shadows` |
| 80-100 | 极柔 | `extremely soft lighting, diffused, shadowless` |
| **色温** | 0-100 | |
| 0-20 | 极冷 | `cold blue lighting, ice-cold color temperature` |
| 20-40 | 冷 | `cool lighting, blue-white balance` |
| 40-60 | 中性 | `neutral white balance, natural color temperature` |
| 60-80 | 暖 | `warm lighting, golden hour warmth` |
| 80-100 | 极暖 | `extremely warm, amber lighting, sunset glow` |

#### 3.3.4 色调映射表 (Tone & Color)

| 类型 | Prompt 片段 |
|:---|:---|
| warm | `warm color palette, golden tones, amber highlights` |
| cool | `cool color palette, blue tints, teal shadows` |
| retro | `vintage film look, faded colors, retro color grading` |
| vivid | `vibrant colors, high saturation, punchy color palette` |
| muted | `muted colors, desaturated tone, subtle color palette` |
| bw | `black and white, monochrome, grayscale, noir style` |
| cinematic | `cinematic color grading, teal and orange, film-like color science` |

#### 3.3.5 画风预设库设计

```typescript
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'kodak-warm-film',
    name: '柯达暖黄胶片复古',
    description: '暖黄色调，胶片颗粒感，复古电影质感',
    params: {
      lighting: { direction: 'front', brightness: 60, hardness: 40, warmth: 80, ambient: true },
      tone: { style: 'retro', saturation: 60, contrast: 70 },
      depthOfField: { type: 'shallow', blurIntensity: 30 },
    },
    qualityTags: [
      'Kodak Portra film stock',
      'warm film grain',
      'vintage cinematic look',
      'soft halation',
    ],
    negativePrompt: [
      'digital look',
      'oversharpened',
      'cold tones',
      'clean modern',
    ],
  },
  {
    id: 'korean-minimalist',
    name: '韩国冷淡电影风',
    description: '低饱和冷色调，画面干净冷淡，情绪压抑',
    params: {
      lighting: { direction: 'side-left', brightness: 35, hardness: 60, warmth: 20, ambient: false },
      tone: { style: 'muted', saturation: 25, contrast: 60 },
      depthOfField: { type: 'shallow', blurIntensity: 40 },
    },
    qualityTags: [
      'Korean cinematography',
      'muted color palette',
      'melancholic atmosphere',
      'minimalist composition',
    ],
    negativePrompt: [
      'vibrant colors',
      'warm tones',
      'busy background',
      'happy mood',
    ],
  },
  {
    id: '90s-realistic',
    name: '90年代写实电影',
    description: '自然光效，写实质感，纪实风格',
    params: {
      lighting: { direction: 'natural', brightness: 55, hardness: 50, warmth: 50, ambient: true },
      tone: { style: 'cinematic', saturation: 45, contrast: 65 },
      depthOfField: { type: 'deep', blurIntensity: 15 },
    },
    qualityTags: [
      '1990s film aesthetic',
      'natural lighting',
      'realistic texture',
      'documentary style',
      'film grain',
    ],
    negativePrompt: [
      'CGI look',
      'perfect skin',
      'dramatic lighting',
      'futuristic',
    ],
  },
  {
    id: 'cyberpunk-neon',
    name: '赛博朋克霓虹',
    description: '蓝色与品红灯光，霓虹闪烁，高对比夜景',
    params: {
      lighting: { direction: 'side-right', brightness: 70, hardness: 80, warmth: 10, ambient: false },
      tone: { style: 'vivid', saturation: 85, contrast: 80 },
      depthOfField: { type: 'shallow', blurIntensity: 50 },
    },
    qualityTags: [
      'cyberpunk neon city',
      'blue and magenta lighting',
      'neon reflections on wet surfaces',
      'high contrast night scene',
    ],
    negativePrompt: [
      'daylight',
      'natural lighting',
      'soft colors',
      'bright ambiance',
    ],
  },
];
```

### 3.4 Prompt 生成流程

```
用户交互调整参数
        │
        ▼
┌─────────────────────────┐
│ 1. 收集所有面板参数      │  shotSize: medium (55)
│    (实时/批量)           │  lighting: { direction: 'side-left', hardness: 70, ... }
│                         │  cameraMove: { type: 'push-in', speed: 30 }
│                         │  tone: 'warm'
│                         │  depthOfField: 'shallow'
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ 2. 维度独立映射          │  景别: "medium shot, waist up framing"
│    维度→Prompt片段      │  光线: "side lighting, soft diffused, warm illumination"
│                         │  镜头: "gentle push-in camera movement"
│                         │  色调: "warm color palette, golden tones"
│                         │  景深: "shallow depth of field, blurred background"
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ 3. 交叉维度组合优化       │  侧光 + 柔光 + 暖调 = 温和的侧光氛围
│    检测维度间交叉规则    │  → "warm side lighting creates intimate atmosphere"
│                         │  推镜头 + 浅景深 = 聚焦引导
│                         │  → "push-in draws attention to subject's expression"
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ 4. 按模板组装 Prompt     │  [景别], [主体], [光线], [镜头], [色调], [景深], [质量控制]
│    固定顺序模板          │
│                         │  "medium shot, young man sitting at desk, warm side lighting
│                         │   with soft diffusion, gentle push-in camera movement,
│                         │   warm color palette with golden tones, shallow depth of field,
│                         │   9:16 vertical format, cinematic quality, photorealistic"
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ 5. 附加质量控制标签       │  "8k, highly detailed, cinematic lighting, 
│    + 负面提示词          │   professional color grading"
│                         │  负面: "dull lighting, flat composition,
│                         │        distorted face, unnatural pose"
└─────────────────────────┘
        │
        ▼
┌─────────────────────────┐
│ 6. 输出完整 Prompt       │  → Seedance API / SD API
│    支持实时预览           │
└─────────────────────────┘
```

### 3.5 UI 组件架构

```
┌─────────────────────────────────────────────────────────────┐
│  ParameterPanelContainer                                   │
│  (统一状态管理 - useReducer + Context)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  ShotSizePanel  │  │  CameraPanel    │                   │
│  │  ┌───────────┐  │  │  ┌───────────┐  │                  │
│  │  │ 滑块 0-100 │  │  │  │类型选择器 │  │                  │
│  │  │ 分类标签   │  │  │  │速度滑块   │  │                  │
│  │  │ 预览文案   │  │  │  │预览文案   │  │                  │
│  │  └───────────┘  │  │  └───────────┘  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  LightingPanel  │  │  TonePanel      │                   │
│  │  ┌───────────┐  │  │  ┌───────────┐  │                  │
│  │  │方向选择   │  │  │  │色调选择   │  │                  │
│  │  │亮度滑块   │  │  │  │饱和度滑块 │  │                  │
│  │  │硬度滑块   │  │  │  │对比度滑块 │  │                  │
│  │  │色温滑块   │  │  │  └───────────┘  │                  │
│  │  │(色温圆)   │  │  │                  │                  │
│  │  └───────────┘  │  │                  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  DOFPanel       │  │  AspectPanel    │                   │
│  │  ┌───────────┐  │  │  ┌───────────┐  │                  │
│  │  │景深选择   │  │  │  │画幅选择   │  │                  │
│  │  │模糊强度   │  │  │  └───────────┘  │                  │
│  │  └───────────┘  │  │                  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │  StylePresetSelector                      │              │
│  │  [柯达暖黄] [韩国冷淡] [90s写实] [赛博]  │              │
│  │  点击→一键覆盖所有面板参数                │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │  PromptPreview                            │              │
│  │  实时显示生成的 Prompt 文本               │              │
│  │  "medium shot, young man, warm side       │              │
│  │   lighting, gentle push-in..."            │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. @资产引用系统实现方案

### 4.1 技术选型：react-mentions v4.4.10

#### 选型理由

| 评估项 | react-mentions | Tiptap Mention | Lexical Mentions |
|--------|:--------------:|:--------------:|:----------------:|
| 接入成本 | **5分钟** | 1-2小时 | 2-3小时 |
| 包体积 | 21.5KB | 200KB+ (含Tiptap) | 150KB+ (含Lexical) |
| 与现有ChatPanel集成 | **直接替换textarea** | 需替换编辑器 | 需替换编辑器 |
| React 18兼容 | ✅ | ✅ | ✅ |
| 自定义建议列表UI | ✅ | ✅ | ✅ |
| 富文本编辑能力 | ❌ | ✅ | ✅ |
| 维护活跃度 | ⭐⭐⭐ (季度更新) | ⭐⭐⭐⭐⭐ (周更新) | ⭐⭐ (低频更新) |

**推荐方案**：第一阶段使用 `react-mentions` 快速集成。当需要富文本能力时，第二阶段升级到 `Tiptap + @tiptap/extension-mention`。

### 4.2 引用数据结构设计

```typescript
// ===== @引用核心数据结构 =====

/** 资产引用标识符 */
export interface AssetReference {
  /** 引用原始文本，如 "@陆沉" */
  display: string;
  /** 资产类型 */
  type: 'character' | 'scene' | 'prop' | 'costume';
  /** 资产唯一ID */
  id: string;
  /** 资产的变体/版本ID (可选, 如"黑化后"版本) */
  variantId?: string;
  /** 额外元数据 */
  metadata?: {
    /** 角色装备状态 */
    outfitState?: string;
    /** 场景时间 */
    sceneTime?: 'day' | 'night' | 'dawn' | 'dusk';
    /** 场景天气 */
    weather?: 'clear' | 'rainy' | 'foggy' | 'snowy';
  };
}

// ===== 存储格式 =====

/** 数据库中存储的分镜文本格式 */
export interface StoryboardSegment {
  id: string;
  /** 纯文本内容，@引用存储为 @[资产名称](asset://资产ID) */
  text: string;
  /** 解析后的引用列表 */
  references: AssetReference[];
  /** 分镜参数(继承自参数面板) */
  params?: ShotParams;
}

// ===== 序列化/反序列化 =====

/**
 * 引用格式设计
 * 
 * 显示文本：          @陆沉
 * 存储格式：          @[陆沉](asset:character:char_001)
 * 数据库字段存储：     
 *   text: "陆沉走进@[安全屋内部](asset:scene:scene_003)，
 *         看向@[林薇](asset:character:char_002)"
 *   references: [
 *     { display: "陆沉", type: "character", id: "char_001" },
 *     { display: "安全屋内部", type: "scene", id: "scene_003" },
 *     { display: "林薇", type: "character", id: "char_002" },
 *   ]
 */

// ===== 引用解析函数 =====

/** 从文本中提取所有 @引用 */
export function parseReferences(text: string): AssetReference[] {
  const regex = /@\[(.+?)\]\(asset:(\w+):([\w-]+)\)/g;
  const references: AssetReference[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    references.push({
      display: match[1],
      type: match[2] as AssetReference['type'],
      id: match[3],
    });
  }
  return references;
}

/** 将 @引用格式化为可显示HTML */
export function formatReferenceHTML(ref: AssetReference): string {
  const emojiMap: Record<string, string> = {
    character: '🎭', scene: '🏠', prop: '🔧', costume: '👗',
  };
  return `<span class="asset-mention asset-mention--${ref.type}" 
               data-asset-id="${ref.id}" 
               data-asset-type="${ref.type}">
    ${emojiMap[ref.type]}${ref.display}
  </span>`;
}
```

### 4.3 react-mentions 集成方案

#### 4.3.1 安装

```bash
npm install react-mentions@4.4.10
# 类型定义已内置
```

#### 4.3.2 核心组件

```tsx
// ===== MentionInput.tsx =====
// 这是ChatPanel中@资产引用系统的核心组件

import React, { useState, useCallback } from 'react';
import { MentionsInput, Mention } from 'react-mentions';

// 资产数据源类型
interface AssetSource {
  id: string;
  display: string;
  type: 'character' | 'scene' | 'prop';
  // 建议列表中显示的额外信息
  preview?: string;
  thumbnail?: string;
}

// 组件 Props
interface MentionInputProps {
  assets: AssetSource[];           // 当前剧本的所有资产
  value: string;                    // 受控值
  onChange: (value: string, references: AssetReference[]) => void;
  placeholder?: string;
  minHeight?: number;
}

export const AssetMentionInput: React.FC<MentionInputProps> = ({
  assets,
  value,
  onChange,
  placeholder = '输入分镜描述，@引用资产...',
  minHeight = 120,
}) => {
  // 按类型分组资产
  const characters = assets.filter(a => a.type === 'character');
  const scenes = assets.filter(a => a.type === 'scene');
  const props = assets.filter(a => a.type === 'prop');

  const handleChange = useCallback(
    (e: any, newValue: string, newPlainTextValue: string, mentions: any[]) => {
      // mentions 包含所有 @引用 的结构化数据
      const references: AssetReference[] = mentions.map((m: any) => ({
        display: m.display,
        type: m.type as AssetReference['type'],
        id: m.id,
      }));
      onChange(newValue, references);
    },
    [onChange]
  );

  return (
    <MentionsInput
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={mentionInputStyle}
      a11ySuggestionsListLabel="相关资产"
      allowSuggestionsAboveCursor={false}
      customSuggestionsContainer={Children => (
        <div className="asset-mention-dropdown">
          <div className="asset-mention-header">
            <span>选择资产</span>
            <span className="hint">输入名称过滤</span>
          </div>
          {Children}
        </div>
      )}
    >
      {/* 角色 @触发器 */}
      <Mention
        trigger="@"
        data={characters}
        displayTransform={(id, display) => `@${display}`}
        markup="@[__display__](asset:character:__id__)"
        renderSuggestion={(suggestion, search, highlightedDisplay) => (
          <div className="asset-suggestion-item">
            <div className="asset-suggestion-avatar">
              {suggestion.thumbnail ? (
                <img src={suggestion.thumbnail} alt="" />
              ) : (
                <span className="asset-type-icon character">🎭</span>
              )}
            </div>
            <div className="asset-suggestion-info">
              <span className="asset-suggestion-name">{highlightedDisplay}</span>
              {suggestion.preview && (
                <span className="asset-suggestion-preview">{suggestion.preview}</span>
              )}
            </div>
            <span className="asset-suggestion-type">角色</span>
          </div>
        )}
      />

      {/* 场景 @触发器 - 使用 ## 作为触发符，可自定义 */}
      <Mention
        trigger="##"
        data={scenes}
        displayTransform={(id, display) => `##${display}`}
        markup="@[__display__](asset:scene:__id__)"
        renderSuggestion={(suggestion, search, highlightedDisplay) => (
          <div className="asset-suggestion-item">
            <span className="asset-type-icon scene">🏠</span>
            <div className="asset-suggestion-info">
              <span className="asset-suggestion-name">{highlightedDisplay}</span>
            </div>
            <span className="asset-suggestion-type">场景</span>
          </div>
        )}
      />
    </MentionsInput>
  );
};

// 样式配置
const mentionInputStyle = {
  control: {
    fontSize: 14,
    lineHeight: 1.6,
    minHeight: 120,
  },
  '&multiLine': {
    control: {
      fontFamily: 'inherit',
    },
    highlighter: {
      padding: 12,
      border: '1px solid transparent',
    },
    input: {
      padding: 12,
      border: '1px solid #d1d5db',
      borderRadius: 8,
      outline: 'none',
      '&:focus': {
        borderColor: '#6366f1',
        boxShadow: '0 0 0 2px rgba(99,102,241,0.2)',
      },
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      maxHeight: 240,
      overflow: 'auto',
    },
    item: {
      padding: '8px 12px',
      borderBottom: '1px solid #f3f4f6',
      '&focused': {
        backgroundColor: '#f0f0ff',
      },
    },
  },
};
```

#### 4.3.3 CSS 样式

```css
/* MentionInput.css */

.asset-mention {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.asset-mention:hover {
  filter: brightness(0.95);
}

/* 不同类型的引用有不同的颜色 */
.asset-mention--character {
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

.asset-mention--scene {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.asset-mention--prop {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

/* 建议下拉菜单 */
.asset-mention-dropdown {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  overflow: hidden;
}

.asset-mention-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  font-size: 12px;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.asset-suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}

.asset-suggestion-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.asset-suggestion-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-suggestion-info {
  flex: 1;
  min-width: 0;
}

.asset-suggestion-name {
  font-weight: 500;
  color: #111827;
  display: block;
}

.asset-suggestion-preview {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-suggestion-type {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
}

.asset-type-icon {
  font-size: 18px;
}
```

### 4.4 与现有 ChatPanel 的 Textarea 替换方案

```
替换前：
┌─────────────────────────────┐
│  <textarea                   │
│    value={text}             │
│    onChange={handleChange}  │
│    placeholder="输入..."    │
│  />                          │
└─────────────────────────────┘

替换后：
┌─────────────────────────────┐
│  <AssetMentionInput          │
│    assets={assetList}       │  ← 从资产库获取
│    value={text}             │
│    onChange={(val, refs) => │  ← refs: AssetReference[]
│      updateStoryboard(val,  │
│        refs)}               │
│    placeholder="输入..."    │
│  />                          │
└─────────────────────────────┘

修改步骤：
1. 替换 imports: textarea → AssetMentionInput
2. 从资产库Context获取 assets 列表
3. onChange 处理函数增加 refs 参数
4. 存储时保存 refs 到数据库
```

### 4.5 @引用在 Prompt 上下文中的传递

```typescript
/**
 * @引用 → AI Prompt 上下文生成
 * 
 * 当用户在分镜中输入：
 * "@陆沉走进@[安全屋内部](asset:scene:scene_003)"
 * 
 * 系统做：
 * 1. 解析 @引用 → [{type:'character',id:'char_001'}, {type:'scene',id:'scene_003'}]
 * 2. 从资产库查询对应资产的详细描述
 * 3. 组装为 AI 上下文：
 * 
 * === 角色上下文 ===
 * - 陆沉 (char_001): 28岁男性，黑色风衣，短发，面容冷峻
 *   - 当前变体: 常态 (default)
 *   - 参考图: [char_001_front.png, char_001_side.png, char_001_back.png]
 *   - 三视图特征: 身高185cm, 肩宽, 脸部特征[面部描述]
 * 
 * === 场景上下文 ===
 * - 安全屋内部 (scene_003): 昏暗的废弃仓库，铁皮墙，木质地板
 *   - 时间: 夜晚
 *   - 灯光预设: 顶光+侧光
 *   - 全景参考图: [scene_003_panorama.png]
 * 
 * 最终 Prompt 组装:
 * "medium shot, 陆沉 (28岁男性, 黑风衣), 
 *  走进废弃仓库(昏暗, 铁皮墙), 
 *  side lighting, soft diffused, 
 *  gentle push-in, 
 *  cinematic color grading, 
 *  9:16 vertical, 
 *  角色一致性参考: char_001_front.png, 场景一致性参考: scene_003_panorama.png"
 */

export function buildPromptWithContext(
  text: string,
  references: AssetReference[],
  assetLibrary: AssetLibrary,
  params: ShotParams
): string {
  // 1. 解析引用
  const refs = references.length > 0 
    ? references 
    : parseReferences(text);

  // 2. 从资产库获取上下文
  const charContexts = refs
    .filter(r => r.type === 'character')
    .map(r => {
      const char = assetLibrary.characters.get(r.id);
      return char ? `${char.name}(${char.description})` : '';
    })
    .filter(Boolean);

  const sceneContexts = refs
    .filter(r => r.type === 'scene')
    .map(r => {
      const scene = assetLibrary.scenes.get(r.id);
      return scene ? `${scene.name}(${scene.description})` : '';
    })
    .filter(Boolean);

  // 3. 清除非引用纯文本
  const cleanText = text.replace(/@\[(.+?)\]\(asset:\w+:[\w-]+\)/g, '$1');

  // 4. 组装特定角色的参数覆盖
  const charRefImages = refs
    .filter(r => r.type === 'character')
    .map(r => `${r.id}_reference.png`);

  const sceneRefImages = refs
    .filter(r => r.type === 'scene')
    .map(r => `${r.id}_reference.png`);

  // 5. 构建最终 Prompt
  const template = params?.shotSize?.promptFragment || 'medium shot';
  const lighting = buildLightingPrompt(params?.lighting);
  const camera = buildCameraPrompt(params?.cameraMove);
  const tone = buildTonePrompt(params?.tone);
  const dof = buildDOFPrompt(params?.depthOfField);

  const contextParts = [
    cleanText,
    ...charContexts,
    ...sceneContexts,
  ];

  const visualParams = [
    template,
    lighting,
    camera,
    tone,
    dof,
    params?.aspectRatio?.type === '16:9' ? '16:9 landscape' : '9:16 vertical',
  ].filter(Boolean);

  const referenceImages = [
    ...charRefImages.map(p => `character consistency reference: ${p}`),
    ...sceneRefImages.map(p => `scene consistency reference: ${p}`),
  ];

  return [
    contextParts.join(', '),
    visualParams.join(', '),
    ...referenceImages,
  ].join('\n');
}
```

---

## 5. 角色三视图专业控制面板

### 5.1 设计思路

在短剧场景中，角色三视图是 **2D 参考图**（非 3D 模型），核心目的是为 AI 提供角色一致性的视觉锚点。用户选择视角（正面/侧面/背面），系统只生成/展示对应视角的图片。

### 5.2 UI 布局

```
┌──────────────────────────────────────────────────┐
│  角色三视图控制面板                                │
│  角色: 陆沉  版本: [常态 ▼]                       │
├──────────────────────────────────────────────────┤
│                                                    │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │  👤      │  │  👤      │  │  👤      │         │
│   │  正面     │  │  侧面     │  │  背面     │         │
│   │  Front   │  │  Side    │  │  Back    │         │
│   │          │  │          │  │          │          │
│   │ [图片]   │  │ [图片]   │  │ [图片]   │         │
│   │          │  │          │  │          │          │
│   └─────────┘  └─────────┘  └─────────┘          │
│                                                    │
│   ○ 当前选中: 正面  [生成此视角]  [应用到角色]      │
│                                                    │
│   ── 参数控制 (继承自参数面板) ──                    │
│   光源方向: [前侧] [左侧] [右侧] [顶] [后]         │
│   背景色: [纯色▼]                                   │
│                                                    │
└──────────────────────────────────────────────────┘
```

### 5.3 组件实现

```tsx
// ===== CharacterViewPanel.tsx =====

import React, { useState } from 'react';

type ViewAngle = 'front' | 'side' | 'back' | 'three-quarter';

interface CharacterViewPanelProps {
  characterName: string;
  variants: { id: string; name: string }[];
  currentVariant: string;
  onVariantChange: (variantId: string) => void;
  // 各视角图片 URL
  images: Record<ViewAngle, string | null>;
  // 生成新视角图片
  onGenerateView: (angle: ViewAngle, params: any) => Promise<void>;
  // 应用到角色资产库
  onApplyToCharacter: () => void;
  // 当前参数面板设置
  lightingParams?: LightingParams;
}

export const CharacterViewPanel: React.FC<CharacterViewPanelProps> = ({
  characterName,
  variants,
  currentVariant,
  onVariantChange,
  images,
  onGenerateView,
  onApplyToCharacter,
  lightingParams,
}) => {
  const [selectedAngle, setSelectedAngle] = useState<ViewAngle>('front');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerateView(selectedAngle, {
        lighting: lightingParams,
        angle: selectedAngle,
        variant: currentVariant,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="character-view-panel">
      {/* 头部：角色名称和版本选择 */}
      <div className="panel-header">
        <h3>{characterName}</h3>
        <select 
          value={currentVariant}
          onChange={e => onVariantChange(e.target.value)}
          className="variant-select"
        >
          {variants.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* 三视图网格 */}
      <div className="view-grid">
        {(['front', 'side', 'back'] as ViewAngle[]).map(angle => (
          <div
            key={angle}
            className={`view-card ${selectedAngle === angle ? 'selected' : ''}`}
            onClick={() => setSelectedAngle(angle)}
          >
            <div className="view-label">
              <span className="angle-icon">{getAngleIcon(angle)}</span>
              <span>{getAngleLabel(angle)}</span>
            </div>
            <div className="view-image-container">
              {images[angle] ? (
                <img 
                  src={images[angle]!} 
                  alt={`${characterName} ${angle} view`}
                  className="view-image"
                />
              ) : (
                <div className="view-placeholder">
                  <span className="placeholder-icon">+</span>
                  <span>生成{getAngleLabel(angle)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="view-actions">
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? '生成中...' : `生成${getAngleLabel(selectedAngle)}`}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onApplyToCharacter}
        >
          应用到角色
        </button>
      </div>

      {/* 参数快速控制 */}
      <div className="view-params">
        <div className="param-section">
          <label>光源方向</label>
          <div className="direction-buttons">
            {['front', 'side-left', 'side-right', 'top', 'back'].map(dir => (
              <button
                key={dir}
                className={`direction-btn ${lightingParams?.direction === dir ? 'active' : ''}`}
                onClick={() => {/* 更新光源方向 */}}
              >
                {getDirectionIcon(dir)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== 辅助函数 =====

function getAngleLabel(angle: ViewAngle): string {
  const map: Record<ViewAngle, string> = {
    front: '正面',
    side: '侧面',
    back: '背面',
    'three-quarter': '四分之三侧',
  };
  return map[angle];
}

function getAngleIcon(angle: ViewAngle): string {
  const map: Record<ViewAngle, string> = {
    front: '👤',
    side: '🧑',
    back: '🔙',
    'three-quarter': '🧑‍🦰',
  };
  return map[angle];
}

function getDirectionIcon(dir: string): string {
  const map: Record<string, string> = {
    front: '☀️',
    'side-left': '🌤️',
    'side-right': '🌤️',
    top: '💡',
    back: '🌑',
  };
  return map[dir] || '💡';
}

// ===== CSS =====

const styles = `
.character-view-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.variant-select {
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: white;
}

.view-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.view-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.view-card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99,102,241,0.15);
}

.view-card.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99,102,241,0.3);
}

.view-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f9fafb;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.view-image-container {
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
}

.view-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.view-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
  font-size: 12px;
}

.placeholder-icon {
  font-size: 32px;
  font-weight: 300;
}

.view-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.view-actions .btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}

.btn-primary {
  background: #6366f1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.direction-buttons {
  display: flex;
  gap: 4px;
}

.direction-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;
}

.direction-btn.active {
  border-color: #6366f1;
  background: #eef2ff;
}

.direction-btn:hover {
  border-color: #6366f1;
}
`;
```

### 5.4 视角锁定机制

```typescript
/**
 * 视角锁定机制
 * 
 * 当用户选择了一个视角并"锁定"后，后续该角色的所有生成
 * 都会固定使用该视角，直到用户解锁。
 */

interface ViewLock {
  characterId: string;
  lockedAngle: ViewAngle | null;
  locked: boolean;
}

// ===== useViewLock Hook =====

function useViewLock(characterId: string) {
  const [locks, setLocks] = useState<Map<string, ViewLock>>(new Map());

  const lockAngle = useCallback((angle: ViewAngle) => {
    setLocks(prev => new Map(prev).set(characterId, {
      characterId,
      lockedAngle: angle,
      locked: true,
    }));
  }, [characterId]);

  const unlockAngle = useCallback(() => {
    setLocks(prev => new Map(prev).set(characterId, {
      characterId,
      lockedAngle: null,
      locked: false,
    }));
  }, [characterId]);

  const getPromptAngleModifier = useCallback((defaultAngle?: ViewAngle): string => {
    const lock = locks.get(characterId);
    const activeAngle = lock?.locked ? lock.lockedAngle : defaultAngle;
    
    if (!activeAngle) return '';
    
    const promptMap: Record<ViewAngle, string> = {
      front: 'facing camera, front view',
      side: 'profile view, facing left',
      back: 'back view, facing away from camera',
      'three-quarter': 'three-quarter view',
    };
    
    return promptMap[activeAngle] || '';
  }, [characterId, locks]);

  return { lockAngle, unlockAngle, getPromptAngleModifier };
}

// ===== 与 Prompt 生成引擎集成 =====

function buildCharacterPromptWithLock(
  characterName: string,
  viewLockModifier: string,
  shotParams: ShotParams
): string {
  const parts = [
    characterName,
    viewLockModifier,     // 视角锁定修饰
    shotParams?.lighting?.prompt,
    shotParams?.cameraMove?.prompt,
  ].filter(Boolean);
  
  return parts.join(', ');
}
```

### 5.5 视图切换动画方案

```tsx
// ===== 使用 Framer Motion 实现平滑视图切换 =====

import { motion, AnimatePresence } from 'framer-motion';

const viewVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 200 : -200,
    opacity: 0,
    scale: 0.95,
  }),
};

// 使用示例
<AnimatePresence mode="wait" custom={direction}>
  <motion.div
    key={selectedAngle}
    custom={direction}
    variants={viewVariants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{
      x: { type: 'spring', stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    }}
  >
    <img src={currentImage} alt={selectedAngle} />
  </motion.div>
</AnimatePresence>
```

---

## 6. 数据结构设计总览

### 6.1 PostgreSQL / Supabase 表结构

```sql
-- ===== 剧本表 =====
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  synopsis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  style_preset_id TEXT REFERENCES style_presets(id),
  aspect_ratio TEXT DEFAULT '9:16',
  total_episodes INT DEFAULT 10
);

-- ===== 资产表 (角色/场景/道具) =====
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('character', 'scene', 'prop')),
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(script_id, type, name)
);

-- ===== 资产变体表 =====
CREATE TABLE asset_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- '常态', '黑化后', '受伤版'
  description TEXT,
  images JSONB,                         -- {front: url, side: url, back: url}
  params JSONB,                         -- 生成此变体时的参数快照
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, name)
);

-- ===== 画风预设表 =====
CREATE TABLE style_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  params JSONB NOT NULL,               -- 完整参数映射
  quality_tags TEXT[],                  -- 质量增强标签
  negative_prompt TEXT[],               -- 负面提示词
  thumbnail_url TEXT
);

-- ===== 集/章节表 =====
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
  episode_number INT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 分镜表 =====
CREATE TABLE storyboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  segment_index INT NOT NULL,             -- 片段序号
  text TEXT NOT NULL,                     -- 含 @引用 的文本
  references JSONB DEFAULT '[]',          -- [{display, type, id, variantId}]
  params JSONB DEFAULT '{}',              -- 此分镜的参数面板快照
  
  -- 解构后的常用字段，方便查询
  shot_size TEXT,
  camera_move TEXT,
  lighting JSONB,
  tone TEXT,
  depth_of_field TEXT,
  
  duration DECIMAL DEFAULT 3.0,           -- 秒
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(episode_id, segment_index)
);

-- ===== 生成记录表 =====
CREATE TABLE generation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storyboard_id UUID REFERENCES storyboards(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  result_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message TEXT,
  params_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### 6.2 索引设计

```sql
-- 按剧本查询资产
CREATE INDEX idx_assets_script_id ON assets(script_id);

-- 按资产查询变体
CREATE INDEX idx_asset_variants_asset_id ON asset_variants(asset_id);

-- 按剧集查询分镜
CREATE INDEX idx_storyboards_episode_id ON storyboards(episode_id);

-- 按分镜查询生成记录
CREATE INDEX idx_generation_records_storyboard_id ON generation_records(storyboard_id);

-- 全文搜索资产名称
CREATE INDEX idx_assets_name_trgm ON assets USING gin(name gin_trgm_ops);

-- GIN 索引加速 JSONB 查询
CREATE INDEX idx_storyboards_params ON storyboards USING gin(params);
CREATE INDEX idx_asset_variants_images ON asset_variants USING gin(images);
```

---

## 7. 可复用代码片段

### 7.1 核心映射引擎

```typescript
// ===== promptMappingEngine.ts =====
// 开箱即用的 Prompt 映射引擎核心代码

/**
 * 使用示例：
 * 
 * const engine = new PromptMappingEngine();
 * 
 * // 设置各维度参数
 * engine.setShotSize(55);        // 中景
 * engine.setLighting('side-left', 50, 70, 75);  // 侧光, 亮度50, 柔光70, 暖色75
 * engine.setCameraMove('push-in', 30);  // 慢推
 * engine.setTone('warm', 60, 65);       // 暖调
 * engine.setDepthOfField('shallow', 40); // 浅景深
 * engine.setAspectRatio('9:16');         // 竖屏
 * 
 * // 生成完整 Prompt
 * const prompt = engine.buildPrompt();
 * // 输出: "medium shot, side lighting with soft diffusion, 
 * //        gentle push-in camera, warm color palette, 
 * //        shallow depth of field, 9:16 format"
 */

interface LightingParams {
  direction: string;
  brightness: number;
  hardness: number;
  warmth: number;
}

interface ToneParams {
  style: string;
  saturation?: number;
  contrast?: number;
}

class PromptMappingEngine {
  // 各维度状态
  private shotSize: number = 50;
  private lighting: LightingParams | null = null;
  private cameraMove: { type: string; speed: number } | null = null;
  private tone: ToneParams | null = null;
  private depthOfField: { type: string; intensity: number } | null = null;
  private aspectRatio: string = '9:16';

  // ===== 维度设置器 =====

  setShotSize(value: number) { this.shotSize = Math.max(0, Math.min(100, value)); }
  
  setLighting(direction: string, brightness: number, hardness: number, warmth: number) {
    this.lighting = {
      direction,
      brightness: clamp(brightness, 0, 100),
      hardness: clamp(hardness, 0, 100),
      warmth: clamp(warmth, 0, 100),
    };
  }

  setCameraMove(type: string, speed: number) {
    this.cameraMove = { type, speed: clamp(speed, 0, 100) };
  }

  setTone(style: string, saturation?: number, contrast?: number) {
    this.tone = { style, saturation: saturation ? clamp(saturation, 0, 100) : undefined };
  }

  setDepthOfField(type: string, intensity: number) {
    this.depthOfField = { type, intensity: clamp(intensity, 0, 100) };
  }

  setAspectRatio(ratio: string) { this.aspectRatio = ratio; }

  // ===== 映射方法 =====

  private mapShotSize(): string {
    const v = this.shotSize;
    if (v <= 10) return 'extreme close-up shot, intense focus on details';
    if (v <= 30) return 'close-up shot, face filling the frame';
    if (v <= 50) return 'medium close-up shot, chest up framing';
    if (v <= 65) return 'medium shot, waist up framing';
    if (v <= 80) return 'medium full shot, knee level framing';
    if (v <= 90) return 'full shot, full body visible';
    if (v <= 95) return 'wide shot, subject in context of environment';
    return 'extreme wide shot, epic landscape view';
  }

  private mapLighting(): string {
    if (!this.lighting) return '';
    const { direction, hardness, warmth } = this.lighting;
    
    const dirMap: Record<string, string> = {
      front: 'front lighting',
      'side-left': 'side lighting from left',
      'side-right': 'side lighting from right',
      top: 'top lighting',
      back: 'backlighting, rim light',
      bottom: 'underlighting',
      'three-point': 'three-point lighting setup',
    };

    const hardnessStr = hardness >= 80 ? 'extremely soft, diffused' 
      : hardness >= 60 ? 'soft, diffused'
      : hardness >= 40 ? 'balanced'
      : hardness >= 20 ? 'hard, defined shadows'
      : 'harsh, sharp shadows';

    const warmthStr = warmth >= 80 ? 'extremely warm, amber glow'
      : warmth >= 60 ? 'warm golden'
      : warmth >= 40 ? 'neutral white balance'
      : warmth >= 20 ? 'cool blue-white'
      : 'cold blue';

    const dir = dirMap[direction] || 'ambient lighting';
    return `${dir}, ${hardnessStr}, ${warmthStr} color temperature`;
  }

  private mapCameraMove(): string {
    if (!this.cameraMove || this.cameraMove.type === 'static') return 'static camera';
    
    const speedLevel = this.cameraMove.speed >= 70 ? 'dynamic, rapid'
      : this.cameraMove.speed >= 40 ? 'smooth'
      : 'slow, gentle';

    const typeMap: Record<string, string> = {
      'push-in': 'push-in camera movement',
      'pull-out': 'dolly out, pull-back',
      'pan-left': 'pan left',
      'pan-right': 'pan right',
      dolly: 'dolly tracking shot',
      tracking: 'tracking shot following the subject',
      orbit: 'camera orbit around subject',
      handheld: 'handheld camera motion',
      zoom: 'zoom movement',
    };

    const base = typeMap[this.cameraMove.type] || 'camera movement';
    return `${speedLevel} ${base}`;
  }

  private mapTone(): string {
    if (!this.tone) return '';
    
    const styleMap: Record<string, string> = {
      warm: 'warm color palette, golden tones, amber highlights',
      cool: 'cool color palette, blue tints, teal shadows',
      retro: 'vintage film look, faded colors, retro color grading',
      vivid: 'vibrant colors, high saturation, punchy',
      muted: 'muted colors, desaturated, subtle',
      bw: 'black and white, monochrome, noir style',
      cinematic: 'cinematic color grading, teal and orange, film-like',
    };

    return styleMap[this.tone.style] || '';
  }

  private mapDOF(): string {
    if (!this.depthOfField) return '';
    
    const dofMap: Record<string, string> = {
      shallow: `shallow depth of field, blurred background, bokeh`,
      deep: 'deep depth of field, everything in focus',
      macro: 'macro focus, extreme close depth of field',
      none: '',
    };

    return dofMap[this.depthOfField.type] || '';
  }

  private mapAspectRatio(): string {
    const ratioMap: Record<string, string> = {
      '9:16': '9:16 vertical portrait format',
      '16:9': '16:9 widescreen landscape format',
      '1:1': '1:1 square format',
      '21:9': '21:9 ultrawide cinematic format',
    };
    return ratioMap[this.aspectRatio] || '9:16 vertical format';
  }

  // ===== 构建最终 Prompt =====

  buildPrompt(subject: string = ''): string {
    const parts = [
      this.mapShotSize(),
      subject,
      this.mapLighting(),
      this.mapCameraMove(),
      this.mapTone(),
      this.mapDOF(),
      this.mapAspectRatio(),
      'cinematic quality, photorealistic, highly detailed, professional color grading',
    ].filter(Boolean);

    return parts.join(', ');
  }

  /** 加载画风预设 */
  loadPreset(preset: StylePreset) {
    if (preset.params.shotSize) this.setShotSize(preset.params.shotSize.value);
    if (preset.params.lighting) {
      const l = preset.params.lighting;
      this.setLighting(l.direction, l.brightness, l.hardness, l.warmth);
    }
    if (preset.params.cameraMove) {
      this.setCameraMove(preset.params.cameraMove.type, preset.params.cameraMove.speed);
    }
    if (preset.params.tone) {
      this.setTone(preset.params.tone.style, preset.params.tone.saturation, preset.params.tone.contrast);
    }
    if (preset.params.depthOfField) {
      this.setDepthOfField(preset.params.depthOfField.type, preset.params.depthOfField.blurIntensity);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

### 7.2 参数面板滑块组件

```tsx
// ===== ParameterSlider.tsx =====
// 可复用的参数滑块组件，支持实时预览提示词

interface ParameterSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** 当前值对应的 Prompt 预览 */
  promptPreview?: string;
  /** 左侧标签 */
  leftLabel?: string;
  /** 右侧标签 */
  rightLabel?: string;
}

export const ParameterSlider: React.FC<ParameterSliderProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  promptPreview,
  leftLabel,
  rightLabel,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="parameter-slider">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{value}</span>
      </div>
      <div className="slider-track-container">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="slider-input"
        />
        <div
          className="slider-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="slider-labels">
        <span>{leftLabel || ''}</span>
        <span>{rightLabel || ''}</span>
      </div>
      {promptPreview && (
        <div className="slider-prompt-preview">
          {promptPreview}
        </div>
      )}
    </div>
  );
};
```

### 7.3 属性选择器组件

```tsx
// ===== PropertySelector.tsx =====
// 多选一属性选择器（适用于光源方向、镜头类型等）

interface SelectorOption<T = string> {
  value: T;
  label: string;
  icon?: string;
  preview?: string;
}

interface PropertySelectorProps<T = string> {
  options: SelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  columns?: number;
}

export function PropertySelector<T = string>({
  options,
  value,
  onChange,
  label,
  columns = 4,
}: PropertySelectorProps<T>) {
  return (
    <div className="property-selector">
      {label && <div className="selector-label">{label}</div>}
      <div
        className="selector-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {options.map(opt => (
          <button
            key={String(opt.value)}
            className={`selector-btn ${value === opt.value ? 'active' : ''}`}
            onClick={() => onChange(opt.value)}
            title={opt.preview}
          >
            {opt.icon && <span className="selector-icon">{opt.icon}</span>}
            <span className="selector-text">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. 分阶段实施计划

### 第一阶段：基础架构搭建（2周）

**目标**：MVP 可运行，核心链路打通

| 周 | 任务 | 产出 | 预估工时 |
|:---|:---|:---|:---:|
| 1 | 搭建资产库数据结构 + 后端API | asset CRUD API, DB 表 | 2天 |
| 1 | 实现 PromptMappingEngine 核心类 | 映射引擎 + 单元测试 | 2天 |
| 1 | 集成 react-mentions 到 Storyboard Editor | @引用输入组件 | 1天 |
| 2 | 实现 6 个核心参数面板 UI组件 | ShotSize/Lighting/CameraMove/Tone/DOF/AspectRatio | 2天 |
| 2 | 实现画风预设选择器 (10个预设) | StylePresetSelector 组件 | 1天 |
| 2 | 端到端集成测试 | 参数面板→@引用→Prompt→API 调用 | 1天 |

**第一阶段交付物**：
- [x] Assets API (CRUD)
- [x] PromptMappingEngine (核心映射)
- [x] @引用输入组件
- [x] 6个参数面板组件
- [x] 画风预设组件
- [x] 端到端 Demo

### 第二阶段：角色三视图 + 精细化（2周）

| 周 | 任务 | 产出 | 预估工时 |
|:---|:---|:---|:---:|
| 3 | 角色三视图面板 Component | CharacterViewPanel | 2天 |
| 3 | 视角锁定机制 + 状态管理 | useViewLock hook | 1天 |
| 3 | 视图切换动画 (Framer Motion) | 动画集成 | 1天 |
| 4 | 交叉维度映射规则 (20+规则) | CrossDimensionRule | 2天 |
| 4 | 参数面板联动优化 | 滑块/选择器联动 | 1天 |
| 4 | @引用与资产库深度绑定 | 引用→AI上下文完整链路 | 1天 |

**第二阶段交付物**：
- [x] 角色三视图面板
- [x] 视角锁定机制
- [x] 视图切换动画
- [x] 交叉维度映射
- [x] @引用完整上下文传递

### 第三阶段：画风库扩展 + 性能优化（2周）

| 周 | 任务 | 产出 | 预估工时 |
|:---|:---|:---|:---:|
| 5 | 画风库扩展到 50+ 预设 | 画风预设数据库种子 | 2天 |
| 5 | 用户自定义画风 | 预设编辑器 | 2天 |
| 5 | @引用支持资产多版本选择 | 版本选择器 | 1天 |
| 6 | Prompt 生成性能优化 | 缓存策略 | 1天 |
| 6 | 参数面板状态持久化 | 保存/加载参数面板配置 | 1天 |
| 6 | 全链路回归测试 | 测试报告 | 2天 |

**第三阶段交付物**：
- [x] 50+ 画风预设
- [x] 用户自定义画风
- [x] 资产多版本@引用
- [x] 性能优化
- [x] 状态持久化

### 第四阶段（可选）：富文本编辑器升级

如果业务需要富文本排版能力（加粗、斜体、多格式分镜描述），可将 Textarea 升级为 Tiptap 编辑器：

```
迁移路径：
react-mentions (v4.4.10) 
    ↓
Tiptap Editor + @tiptap/extension-mention
    ↓
好处：富文本 + @引用 + 自定义节点渲染
成本：需重构 Storyboard Editor
```

---

## 附录 A：开源项目速查表

| 包名 | 版本 | 许可证 | 周下载量 | 用途 | 推荐 |
|:---|:---:|:---:|:---:|:---|:---:|
| `react-mentions` | 4.4.10 | BSD-3 | ~500K+ | @mention 输入框 | ⭐ 首选 |
| `@tiptap/extension-mention` | 3.26.0 | MIT | ~300K+ | Tiptap 富文本 @mention | 备选(富文本) |
| `lexical-beautiful-mentions` | 0.1.48 | MIT | 少量 | Lexical  @mention | 谨慎(早期) |
| `rc-mentions` | 2.20.0 | MIT | ~100K+ | Ant Design @mention | AntD生态 |
| `framer-motion` | 最新 | MIT | ~5M+ | 动画 | 视图切换动画 |

## 附录 B：小云雀 2.0 功能对标分析

| 小云雀功能 | 本方案实现 | 差异说明 |
|:---|:---|:---|
| 100+ 画风库 | 50+ 预设 + 用户自定义 | 第三阶段扩展到 100+ |
| 光影参数面板(4维度) | 6维度(方向/亮度/硬度/色温+环境光+三点布光) | **超越**：增加环境光开关和三点布光模式 |
| 镜头参数面板(3维度) | 5维度(类型/速度/水平角/垂直角/景别) | **超越**：增加水平/垂直角度控制 |
| @资产引用 | react-mentions 实现 | 功能等价 |
| 角色三视图 | React组件 + CSS动画 | 功能等价，无3D渲染 |
| 720° 全景场景 | 场景全景图单图 | 保留扩展空间 |
| 剪映打通 | 生成API回调 | YouTube/本地存储(取决于后端) |

---

> **文档结束**
>
> 本文档提供了完整的实现方案，所有代码片段可直接复制到项目中使用。
> 核心依赖仅：`react-mentions@4.4.10`、`framer-motion`（动画可选）。
> 无需引入大型富文本框架，保持轻量。
