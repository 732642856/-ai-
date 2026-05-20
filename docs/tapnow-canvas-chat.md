根据《TapNow 从 0 制作一条视频的真实使用流程说明》分析，TapNow 的核心不是普通白板，也不只是 Chat 操作节点，而是：

> **一个以 AI 视频制作为目标的节点式多模态生产工作台。**

它的真实逻辑应该是：

```text

素材节点

↓

AI 分析 / 脚本节点

↓

分镜节点

↓

生图节点

↓

图生视频节点

↓

音频 / 字幕 / 音乐节点

↓

合成节点

↓

最终视频节点

```

Chat 和画布节点的关系也不是简单的「创建 / 修改节点」，而是：

```text

Chat / AI 输入框 = 指令入口 + 上下文调度器

Canvas = 视频生产流程图

Node = 一个素材、任务、模型调用、生成结果或合成步骤

Edge = 素材 / 文本 / 音频 / 视频的数据传递关系

```

所以我们要把需求从「通用节点协同」升级为：

> **面向 AI 视频制作的 Chat + Canvas + 多模态节点工作流系统。**

下面我重新优化成三份更贴近 TapNow 的文档：

1. **优化版 PRD 产品需求文档**

2. **优化版技术架构设计文档**

3. **专门给 Claude Code 的分阶段开发任务清单**

---

# 一、优化版 PRD 产品需求文档

# 星轨画布：AI 视频节点工作台 PRD

## 1. 产品定位

「星轨画布」不是普通聊天工具，也不是普通白板，而是一个面向 AI 视频创作的节点式工作台。

用户可以把图片、文字、音频、视频等素材放到画布上，通过 AI 对话和节点连线，把素材逐步加工成：

1. 角色设定；

2. 剧情脚本；

3. 分镜脚本；

4. 生图提示词；

5. 分镜图片；

6. 视频片段；

7. 旁白音频；

8. 字幕；

9. 背景音乐；

10. 最终成片。

产品的核心体验是：

> 用户不是在线性时间轴里剪视频，而是在画布上通过节点搭建视频生成流程。AI 能读取画布素材、理解节点关系、生成新的节点，并驱动节点一步步执行，最后合成完整视频。

---

## 2. TapNow 式核心体验拆解

根据 TapNow 的真实流程，用户使用产品时会经历以下阶段：

```text

打开画布

↓

上传角色图 / 产品图 / 参考图

↓

AI 读取画布素材

↓

创建视频目标文本节点

↓

AI 生成脚本

↓

脚本拆分为分镜节点

↓

分镜节点连接角色图，生成分镜图片

↓

分镜图片连接视频节点，生成视频片段

↓

旁白文本连接语音节点，生成音频

↓

字幕文本连接字幕节点

↓

视频片段、音频、字幕、音乐连接合成节点

↓

生成最终视频

↓

哪里不满意，回到对应节点重跑

```

这意味着系统必须支持：

1. 多模态素材节点；

2. AI 读取节点内容；

3. 节点之间的数据流连接；

4. 按节点类型执行不同任务；

5. 生成结果继续作为新节点输入；

6. 局部重跑，而不是整条视频重做；

7. Chat / AI 输入框可以引用节点和创建节点；

8. 最终通过合成节点生成视频。

---

## 3. 产品目标

## 3.1 MVP 目标

MVP 先实现一条最小可用的视频生产链路：

```text

图片素材节点

↓

文本目标节点

↓

AI 分镜生成

↓

分镜文本节点

↓

生图节点

↓

图片结果节点

↓

图生视频节点

↓

视频结果节点

```

MVP 要支持：

1. 上传图片形成图片节点；

2. 新建 Text 文本节点；

3. AI 能读取选中节点或 @ 引用节点；

4. Chat / AI 输入框能生成脚本或分镜；

5. AI 能把长脚本拆成多个分镜节点；

6. 支持创建生图节点；

7. 生图节点可以接收图片节点和文本节点作为输入；

8. 生图节点执行后生成图片结果；

9. 支持创建图生视频节点；

10. 图生视频节点可以接收图片结果和运动提示词；

11. 图生视频节点执行后生成视频结果；

12. 节点有执行状态；

13. 连线表示真实输入输出关系；

14. 用户可以从失败或不满意的节点局部重跑。

---

## 3.2 第二阶段目标

第二阶段增加完整视频生产能力：

1. 旁白文本节点；

2. 语音生成节点；

3. 字幕节点；

4. 背景音乐上传；

5. 视频合成节点；

6. 最终视频输出节点；

7. 多个视频片段按顺序合成；

8. 支持字幕、旁白、音乐混合；

9. 支持导出 MP4。

---

## 3.3 第三阶段目标

第三阶段增加高级创作体验：

1. 一键从素材生成完整视频工作流；

2. 自动拆分分镜；

3. 自动创建生图 / 视频节点；

4. 批量执行节点；

5. 节点失败自动提示修复；

6. 视频项目模板；

7. 角色一致性管理；

8. 多模型选择；

9. 节点版本历史；

10. 工作流复用。

---

# 4. 页面布局需求

参考 TapNow，主界面建议分为 5 个区域。

---

## 4.1 中间：黑色网格画布

画布是核心工作区，用于放置所有节点。

节点类型包括：

1. 图片素材节点；

2. 文本节点；

3. AI 分析节点；

4. 脚本节点；

5. 分镜节点；

6. 生图节点；

7. 图片结果节点；

8. 视频生成节点；

9. 视频结果节点；

10. 音频节点；

11. 字幕节点；

12. 合成节点；

13. 最终视频节点。

画布必须支持：

1. 拖拽节点；

2. 缩放；

3. 平移；

4. 连接节点；

5. 节点多选；

6. 节点运行状态；

7. 节点预览；

8. 节点重命名；

9. 节点删除；

10. 局部执行。

---

## 4.2 左侧：竖向工具栏

左侧工具栏提供高频入口：

```text

+             新建节点

文件夹         上传素材

列表           节点 / 素材 / 任务列表

对话气泡       打开 Chat 面板

历史           历史记录 / 版本

头像           账号入口

```

MVP 优先实现：

1. `+` 新建节点；

2. 文件夹上传素材；

3. Chat 面板入口。

---

## 4.3 右侧：AI Chat 面板

右侧 Chat 面板类似 TapNow 的 `Greeting` 面板。

作用：

1. 读取当前画布内容；

2. 回答用户问题；

3. 分析图片节点；

4. 生成脚本；

5. 生成分镜；

6. 修改节点内容；

7. 创建新节点；

8. 展示 AI 操作结果；

9. 通过 `@` 引用节点；

10. 点击回复中的节点引用定位画布节点。

输入框提示：

```text

描述操作或用 @ 引用...

```

示例输入：

```text

请读取当前画布上的所有图片节点，并告诉我每张图片适合用来做什么视频角色。

```

或者：

```text

@菲菲姐三视图 请分析这个角色的外貌、服装、年龄感、气质，并生成角色设定。

```

---

## 4.4 底部：AI 模型输入窗口

TapNow 里有一个底部大型 AI 输入窗口，这个窗口和右侧 Chat 的定位略有不同。

建议区分为：

### 右侧 Chat

偏向：

1. 对话；

2. 解释；

3. 分析；

4. 操作历史；

5. 节点引用；

6. 任务反馈。

### 底部 AI 输入框

偏向：

1. 对当前选中节点执行生成；

2. 快速创建内容；

3. 调用模型生成脚本 / 图片 / 视频；

4. 支持模型选择；

5. 支持发送执行任务。

底部输入框 UI：

```text

描述任何你想要生成的内容

[模型选择：Gemini / GPT / Claude / 生图模型 / 视频模型]

[语音输入]

[生成数量]

[消耗点数]

[发送按钮]

```

MVP 可以先把右侧 Chat 和底部输入框共用同一套 AI 调用逻辑，只是在 UI 上区分入口。

---

## 4.5 左下角：画布控制区

包括：

1. 小地图；

2. 网格开关；

3. 适配视图；

4. 缩放滑杆；

5. 帮助入口。

MVP 可以只保留缩放和适配视图。

---

# 5. 核心节点类型设计

这是比前一版更重要的地方。

TapNow 的节点不是泛泛的 text / ai / task，而是围绕视频制作链路设计。

---

## 5.1 素材节点

### ImageAssetNode 图片素材节点

来源：

1. 用户上传；

2. AI 生图结果；

3. 截图；

4. 外部链接导入。

内容：

1. 图片预览；

2. 文件名；

3. 图片 URL；

4. 尺寸；

5. 描述；

6. AI 识别结果；

7. 标签，例如角色、场景、道具、Logo。

示例：

```text

菲菲姐三视图

[图片预览]

```

用途：

1. 作为角色参考；

2. 作为场景参考；

3. 作为生图输入；

4. 作为图生视频输入。

---

## 5.2 TextNode 文本节点

用于承载：

1. 视频目标；

2. 角色设定；

3. 剧情大纲；

4. 分镜脚本；

5. 生图提示词；

6. 视频运动提示词；

7. 旁白文案；

8. 字幕文案。

文本节点必须支持：

1. 标题；

2. 富文本或 Markdown；

3. H1 / H2 / H3；

4. 列表；

5. 加粗；

6. 复制；

7. 扩展查看。

---

## 5.3 ScriptNode 脚本节点

专门用于长脚本。

字段包括：

1. 视频主题；

2. 时长；

3. 风格；

4. 角色；

5. 剧情大纲；

6. 旁白；

7. 分镜结构。

可以由 AI 从素材和视频目标生成。

---

## 5.4 StoryboardNode 分镜节点

每个分镜建议一个节点。

字段：

```text

镜头编号

时长

画面描述

角色动作

镜头运动

旁白

字幕

生图提示词

视频运动提示词

```

示例：

```text

分镜 01｜4 秒

画面：未来军事基地入口，暴力守卫站在金属门前。

角色：守卫保持站立姿势。

镜头：低角度缓慢推进。

字幕：这座基地，从不允许陌生人靠近。

生图提示词：写实电影感，未来军事基地入口……

视频运动提示词：镜头缓慢向前推进，警示灯闪烁……

```

---

## 5.5 ImageGenerationNode 生图节点

作用：

```text

角色参考图 + 场景参考图 + 分镜提示词 → 分镜图片

```

输入：

1. 图片参考输入；

2. 文本提示词输入；

3. 风格输入；

4. 参数输入。

输出：

1. 一张或多张图片结果；

2. 生成日志；

3. 使用模型；

4. 参数记录。

参数：

```text

模型

比例：9:16 / 16:9 / 1:1

生成数量

风格

参考图强度

角色一致性

清晰度

```

---

## 5.6 GeneratedImageNode 图片结果节点

由生图节点生成。

内容：

1. 图片预览；

2. 所属分镜；

3. 使用的提示词；

4. 来源节点；

5. 生成时间；

6. 可重新生成；

7. 可选择其中一张作为最终图。

---

## 5.7 VideoGenerationNode 图生视频节点

作用：

```text

分镜图片 + 运动提示词 → 视频片段

```

输入：

1. 图片输入；

2. 运动提示词；

3. 可选角色参考；

4. 可选风格参数。

输出：

1. 视频片段；

2. 封面；

3. 时长；

4. 生成日志。

参数：

```text

模型

时长

比例

动作强度

镜头运动

保持主体稳定

帧率

```

---

## 5.8 GeneratedVideoNode 视频结果节点

由视频生成节点生成。

内容：

1. 视频预览；

2. 播放按钮；

3. 时长；

4. 来源图片；

5. 运动提示词；

6. 生成参数；

7. 可重新生成；

8. 可加入合成。

---

## 5.9 VoiceOverTextNode 旁白文本节点

用于存放旁白文案。

可以由脚本或分镜自动提取。

---

## 5.10 AudioGenerationNode 语音生成节点

作用：

```text

旁白文本 → 旁白音频

```

参数：

```text

语言

声音

情绪

语速

音量

```

输出：

1. 音频文件；

2. 波形；

3. 时长。

---

## 5.11 SubtitleNode 字幕节点

作用：

```text

旁白文本 / 分镜字幕 → 字幕轨道

```

参数：

```text

字体

颜色

位置

大小

是否高亮关键词

```

输出：

1. 字幕文件；

2. 字幕预览；

3. 时间轴信息。

---

## 5.12 MusicNode 背景音乐节点

来源：

1. 用户上传；

2. AI 生成；

3. 素材库选择。

字段：

1. 音频预览；

2. 音量；

3. 淡入淡出；

4. 循环方式。

---

## 5.13 VideoComposeNode 视频合成节点

作用：

```text

多个视频片段 + 旁白 + 字幕 + 背景音乐 + Logo → 最终视频

```

输入：

1. 视频片段列表；

2. 音频；

3. 字幕；

4. 音乐；

5. Logo；

6. 转场配置。

参数：

```text

画幅

分辨率

帧率

格式

转场

字幕开关

音频混合

```

输出：

1. 最终视频；

2. 渲染状态；

3. 下载链接。

---

## 5.14 FinalVideoNode 最终视频节点

内容：

1. 最终视频预览；

2. 导出按钮；

3. 下载链接；

4. 分辨率；

5. 时长；

6. 文件大小。

---

# 6. 节点连接规则

TapNow 里的连线不是装饰，它表示数据流。

所以每个节点需要输入端口和输出端口。

---

## 6.1 端口类型

```text

image       图片

text        文本

script      脚本

storyboard  分镜

prompt      提示词

video       视频

audio       音频

subtitle    字幕

music       音乐

metadata    元数据

any         任意

```

---

## 6.2 典型连接规则

### 图片素材到 AI 分析

```text

ImageAssetNode.image → AIAnalysisNode.imageInput

```

### 图片素材到生图节点

```text

ImageAssetNode.image → ImageGenerationNode.referenceImages

```

### 分镜节点到生图节点

```text

StoryboardNode.imagePrompt → ImageGenerationNode.prompt

```

### 生图结果到图生视频

```text

GeneratedImageNode.image → VideoGenerationNode.imageInput

```

### 分镜节点到图生视频

```text

StoryboardNode.motionPrompt → VideoGenerationNode.motionPrompt

```

### 图生视频到合成

```text

GeneratedVideoNode.video → VideoComposeNode.videoClips

```

### 旁白文本到语音

```text

VoiceOverTextNode.text → AudioGenerationNode.textInput

```

### 语音到合成

```text

AudioGenerationNode.audio → VideoComposeNode.voiceOver

```

### 字幕到合成

```text

SubtitleNode.subtitle → VideoComposeNode.subtitles

```

### 音乐到合成

```text

MusicNode.audio → VideoComposeNode.backgroundMusic

```

---

## 6.3 连线校验

系统必须判断节点能不能连接。

例如：

允许：

```text

图片 → 生图节点

文本 → 生图节点

图片 → 视频节点

视频 → 合成节点

音频 → 合成节点

字幕 → 合成节点

```

不允许或需要转换：

```text

视频 → 文本节点

音频 → 生图节点

图片 → 字幕节点

```

如果用户连线不合法，应提示：

```text

这个连接不兼容。图片节点可以连接到生图节点或视频生成节点，但不能直接连接到字幕节点。

```

---

# 7. Chat / AI 面板功能需求

## 7.1 AI 读取画布

用户输入：

```text

请读取当前画布上的所有图片节点，并告诉我每张图片适合用来做什么视频角色。

```

系统应该：

1. 收集画布中的图片节点；

2. 将图片 URL / 缩略图 / 已有描述传给多模态模型；

3. AI 输出分析；

4. 可选择把分析结果保存为 TextNode 或 ScriptNode。

---

## 7.2 @ 引用节点

输入框支持：

```text

@菲菲姐三视图 请分析这个角色，并生成角色设定。

```

用户输入 `@` 后弹出节点列表：

```text

菲菲姐三视图

暴力守卫三视图

视频目标

分镜 01

生图 01

```

选择后，消息中插入节点引用。

AI 调用时自动带上该节点上下文。

---

## 7.3 AI 生成视频脚本

用户输入：

```text

请基于 @菲菲姐三视图 和 @暴力守卫三视图，生成一条 30 秒竖屏科幻短片脚本。

要求：

1. 6 个镜头

2. 每个镜头包含时长、画面、动作、镜头运动、旁白、字幕、生图提示词、视频运动提示词

3. 保持角色一致

4. 不要血腥

```

系统输出：

1. Chat 中展示脚本；

2. 提供按钮：

```text

保存为脚本节点

拆分为分镜节点

```

3. 用户点击后创建节点。

---

## 7.4 AI 拆分分镜

用户可以让 AI 把脚本拆成多个 StoryboardNode。

输出：

```text

分镜 01

分镜 02

分镜 03

分镜 04

分镜 05

分镜 06

```

每个分镜节点包含：

1. 时长；

2. 画面描述；

3. 角色动作；

4. 镜头运动；

5. 字幕；

6. 生图提示词；

7. 视频运动提示词。

节点自动排列在画布中间区域。

---

## 7.5 AI 创建生图节点

用户可以输入：

```text

请为每个分镜创建对应的生图节点，并连接角色参考图和分镜节点。

```

系统应：

1. 为每个分镜创建一个 ImageGenerationNode；

2. 将角色图连接到每个生图节点；

3. 将对应分镜连接到对应生图节点；

4. 生图节点默认参数为 9:16；

5. 等待用户逐个点击生成，或确认后批量生成。

---

## 7.6 AI 创建视频节点

用户可以输入：

```text

请为每个分镜图片创建图生视频节点，时长按分镜设置，动作强度中低。

```

系统应：

1. 为每张分镜图片创建 VideoGenerationNode；

2. 连接图片结果；

3. 连接分镜运动提示词；

4. 设置视频比例 9:16；

5. 等待用户确认执行。

---

## 7.7 AI 创建合成节点

用户输入：

```text

请把这些视频片段、旁白、字幕和背景音乐合成一条完整视频。

```

系统应：

1. 创建 VideoComposeNode；

2. 按分镜顺序连接所有视频；

3. 连接旁白音频；

4. 连接字幕；

5. 连接音乐；

6. 设置输出参数；

7. 用户确认后执行合成。

---

# 8. 节点执行需求

每个可执行节点都需要有运行按钮。

可执行节点包括：

1. AIAnalysisNode；

2. ImageGenerationNode；

3. VideoGenerationNode；

4. AudioGenerationNode；

5. SubtitleNode；

6. VideoComposeNode。

---

## 8.1 节点状态

节点状态包括：

```text

idle       未运行

ready      输入已满足，可以运行

running    执行中

done       执行完成

error      执行失败

stale      上游节点变化，需要重新运行

queued     排队中

```

---

## 8.2 状态变化

例如生图节点：

```text

idle

↓ 输入连接完成

ready

↓ 点击生成

queued / running

↓ 成功

done

↓ 上游分镜修改

stale

```

---

## 8.3 上游变化触发 stale

如果分镜节点改了，连接它的生图节点应该标记为：

```text

stale / 上游内容已变化，建议重新生成

```

如果图片结果改了，连接它的视频节点也应标记 stale。

---

# 9. 从 0 制作视频的用户主流程

这是产品必须支持的真实主流程。

---

## 9.1 上传素材

用户点击左侧文件夹，上传：

```text

菲菲姐三视图.png

暴力守卫三视图.png

```

系统在画布上生成两个 ImageAssetNode。

---

## 9.2 AI 分析素材

用户在右侧 Chat 输入：

```text

请分析当前画布上的图片节点，告诉我这些素材适合做什么视频角色。

```

AI 输出分析，并提供：

```text

保存为角色设定节点

```

---

## 9.3 创建视频目标

用户点击 `+` 新建 TextNode，输入：

```text

我要制作一条 30 秒竖屏科幻短片。

角色：菲菲姐和暴力守卫。

主题：菲菲姐误入未来军事基地，被暴力守卫拦截，最后发现她其实掌握关键权限。

风格：写实电影感、科幻、紧张但不血腥。

镜头数量：6 个。

```

---

## 9.4 生成脚本

用户在底部 AI 输入框输入：

```text

基于选中的角色图和视频目标，生成 6 个镜头的短片脚本。

```

系统生成 ScriptNode。

---

## 9.5 拆分分镜

用户点击：

```text

拆分为分镜节点

```

系统创建：

```text

分镜 01

分镜 02

分镜 03

分镜 04

分镜 05

分镜 06

```

---

## 9.6 生成分镜图片

用户点击：

```text

为每个分镜创建生图节点

```

系统创建：

```text

生图 01

生图 02

生图 03

生图 04

生图 05

生图 06

```

并自动连接：

```text

角色图 → 生图节点

分镜节点 → 生图节点

```

用户逐个点击生成。

生成结果形成：

```text

分镜图 01

分镜图 02

...

```

---

## 9.7 生成视频片段

系统创建：

```text

视频生成 01

视频生成 02

...

```

连接：

```text

分镜图 01 → 视频生成 01

分镜 01 → 视频生成 01

```

生成结果：

```text

视频片段 01

视频片段 02

...

```

---

## 9.8 添加旁白、字幕、音乐

用户创建旁白节点：

```text

旁白文案

```

连接到语音节点：

```text

旁白文案 → 语音生成

```

生成音频。

字幕节点从旁白或分镜字幕生成。

背景音乐通过上传形成 MusicNode。

---

## 9.9 合成最终视频

用户创建合成节点：

```text

视频片段 01

视频片段 02

...

旁白音频

字幕

背景音乐

→ 视频合成

```

点击合成，生成 FinalVideoNode。

---

# 10. MVP 验收标准

MVP 不必一次做到完整 TapNow，但至少要验证一条核心链路：

```text

上传图片

→ AI 分析图片

→ 生成视频目标 / 脚本

→ 拆分分镜

→ 创建生图节点

→ 执行生图

→ 创建视频节点

→ 执行图生视频

```

MVP 验收清单：

1. 可以上传图片并形成图片节点；

2. 图片节点可以被 Chat 读取；

3. Chat 支持 @ 引用图片节点；

4. 可以创建视频目标 TextNode；

5. AI 可以基于图片节点和目标文本生成脚本；

6. 脚本可以保存为 ScriptNode；

7. 脚本可以拆分为多个 StoryboardNode；

8. 可以为分镜创建 ImageGenerationNode；

9. 生图节点可以连接角色图和分镜节点；

10. 生图节点可以执行，并生成图片结果节点；

11. 可以创建 VideoGenerationNode；

12. 视频节点可以连接图片结果和运动提示词；

13. 视频节点可以执行，并生成视频结果节点；

14. 节点有 ready / running / done / error / stale 状态；

15. 上游节点修改后，下游节点变为 stale；

16. Chat 可以解释当前画布流程；

17. 点击 Chat 中的节点引用可以定位节点。

---

# 二、优化版技术架构设计文档

# 星轨画布 AI 视频节点工作台技术架构

## 1. 技术架构核心变化

前一版是通用节点系统，这一版需要升级为：

```text

多模态节点系统

+

端口连接系统

+

AI 上下文构建系统

+

节点执行系统

+

媒体生成任务系统

+

Chat 编排系统

```

核心原则：

1. 节点是数据和任务的载体；

2. 连线是端口之间的数据流；

3. Chat 不直接改画布，而是产生结构化 actions；

4. 节点执行不直接写死在 UI 内，而是通过 Node Executor；

5. AI 生成图片、视频、音频都属于异步任务；

6. 每个生成结果都应该可追溯来源；

7. 上游内容变化后，下游节点应 stale；

8. 用户可以局部重跑。

---

# 2. 总体架构

```text

┌────────────────────────────────────────────────────────┐

│                       UI Layer                         │

│                                                        │

│  Left Toolbar   Canvas Editor   Right Chat   Bottom AI  │

│                                                        │

└───────────────┬────────────────────────────────────────┘

│

▼

┌────────────────────────────────────────────────────────┐

│                       App Store                        │

│                                                        │

│ nodes / edges / ports / selectedNodeIds                 │

│ chatMessages / pendingActions / jobs                    │

│ activeContext / viewport / mediaAssets                  │

└───────┬──────────────┬───────────────┬─────────────────┘

│              │               │

▼              ▼               ▼

┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐

│ContextBuilder│ │ActionExecutor│ │NodeExecutionEngine    │

└──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘

│                │                    │

▼                ▼                    ▼

┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐

│ AI Chat Svc  │ │ Canvas Store │ │ Media Generation Svc  │

└──────────────┘ └──────────────┘ └──────────────────────┘

│

▼

Image / Video / Audio APIs

```

---

# 3. 核心数据模型

## 3.1 NodeBase

所有节点共享基础字段：

```ts

type NodeStatus =

| "idle"

| "ready"

| "queued"

| "running"

| "done"

| "error"

| "stale";

type NodeKind =

| "image_asset"

| "text"

| "script"

| "storyboard"

| "ai_analysis"

| "image_generation"

| "generated_image"

| "video_generation"

| "generated_video"

| "voiceover_text"

| "audio_generation"

| "generated_audio"

| "subtitle"

| "music"

| "video_compose"

| "final_video";

type CanvasNodeBase = {

id: string;

kind: NodeKind;

title: string;

position: { x: number; y: number };

size?: { width: number; height: number };

status: NodeStatus;

inputPorts: NodePort[];

outputPorts: NodePort[];

createdAt: number;

updatedAt: number;

metadata?: Record<string, any>;

};

```

---

## 3.2 NodePort

```ts

type PortDataType =

| "image"

| "text"

| "script"

| "storyboard"

| "prompt"

| "video"

| "audio"

| "subtitle"

| "music"

| "json"

| "any";

type NodePort = {

id: string;

nodeId: string;

name: string;

direction: "input" | "output";

dataType: PortDataType;

required?: boolean;

multiple?: boolean;

};

```

示例：

```ts

const imageGenerationInputPorts = [

{

id: "referenceImages",

name: "参考图",

direction: "input",

dataType: "image",

multiple: true

},

{

id: "prompt",

name: "提示词",

direction: "input",

dataType: "prompt",

required: true

}

];

```

---

## 3.3 CanvasEdge

连线应该连接端口，而不只是连接节点。

```ts

type CanvasEdge = {

id: string;

sourceNodeId: string;

sourcePortId: string;

targetNodeId: string;

targetPortId: string;

dataType: PortDataType;

createdAt: number;

updatedAt: number;

metadata?: Record<string, any>;

};

```

---

## 3.4 ImageAssetNodeData

```ts

type ImageAssetNodeData = {

url: string;

thumbnailUrl?: string;

fileName: string;

width?: number;

height?: number;

description?: string;

tags?: string[];

role?: "character" | "scene" | "prop" | "logo" | "reference";

};

```

---

## 3.5 TextNodeData

```ts

type TextNodeData = {

content: string;

format?: "plain" | "markdown" | "richtext";

};

```

---

## 3.6 ScriptNodeData

```ts

type ScriptNodeData = {

theme: string;

durationSec?: number;

aspectRatio?: "9:16" | "16:9" | "1:1";

style?: string;

characters?: string[];

content: string;

};

```

---

## 3.7 StoryboardNodeData

```ts

type StoryboardNodeData = {

shotNumber: number;

durationSec: number;

visualDescription: string;

characterAction: string;

cameraMovement: string;

voiceover?: string;

subtitle?: string;

imagePrompt: string;

motionPrompt: string;

};

```

---

## 3.8 ImageGenerationNodeData

```ts

type ImageGenerationNodeData = {

model?: string;

prompt?: string;

aspectRatio: "9:16" | "16:9" | "1:1";

count: number;

style?: string;

referenceStrength?: number;

consistencyMode?: boolean;

outputNodeIds?: string[];

};

```

---

## 3.9 GeneratedImageNodeData

```ts

type GeneratedImageNodeData = {

url: string;

thumbnailUrl?: string;

prompt: string;

sourceNodeId: string;

seed?: string;

model?: string;

selected?: boolean;

};

```

---

## 3.10 VideoGenerationNodeData

```ts

type VideoGenerationNodeData = {

model?: string;

durationSec: number;

aspectRatio: "9:16" | "16:9" | "1:1";

motionPrompt: string;

motionStrength?: "low" | "medium" | "high";

stabilizeSubject?: boolean;

outputNodeId?: string;

};

```

---

## 3.11 GeneratedVideoNodeData

```ts

type GeneratedVideoNodeData = {

url: string;

thumbnailUrl?: string;

durationSec: number;

sourceNodeId: string;

prompt?: string;

model?: string;

};

```

---

## 3.12 VideoComposeNodeData

```ts

type VideoComposeNodeData = {

aspectRatio: "9:16" | "16:9" | "1:1";

resolution: "720p" | "1080p" | "4k";

fps: 24 | 25 | 30 | 60;

format: "mp4" | "mov";

transition?: "none" | "fade" | "cut";

outputNodeId?: string;

};

```

---

# 4. ChatAction 重新设计

这一版的 action 要围绕视频生产流程。

```ts

type ChatAction =

| CreateNodeAction

| UpdateNodeAction

| ConnectNodesAction

| AnalyzeCanvasAction

| SplitScriptToStoryboardsAction

| CreateImageGenerationPipelineAction

| CreateVideoGenerationPipelineAction

| RunNodeAction

| RunNodesAction

| CreateComposeNodeAction

| FocusNodeAction

| SelectNodesAction;

```

---

## 4.1 创建节点

```ts

type CreateNodeAction = {

type: "create_node";

payload: {

kind: NodeKind;

title: string;

data: any;

position?: { x: number; y: number };

};

};

```

---

## 4.2 连接节点

```ts

type ConnectNodesAction = {

type: "connect_nodes";

payload: {

sourceNodeId: string;

sourcePortId: string;

targetNodeId: string;

targetPortId: string;

};

};

```

---

## 4.3 拆分分镜

```ts

type SplitScriptToStoryboardsAction = {

type: "split_script_to_storyboards";

payload: {

scriptNodeId?: string;

storyboards: Array<{

shotNumber: number;

durationSec: number;

visualDescription: string;

characterAction: string;

cameraMovement: string;

voiceover?: string;

subtitle?: string;

imagePrompt: string;

motionPrompt: string;

}>;

};

};

```

---

## 4.4 创建生图流水线

```ts

type CreateImageGenerationPipelineAction = {

type: "create_image_generation_pipeline";

payload: {

storyboardNodeIds: string[];

referenceImageNodeIds: string[];

defaultParams: {

aspectRatio: "9:16" | "16:9" | "1:1";

count: number;

style?: string;

model?: string;

};

};

};

```

---

## 4.5 创建视频流水线

```ts

type CreateVideoGenerationPipelineAction = {

type: "create_video_generation_pipeline";

payload: {

generatedImageNodeIds: string[];

storyboardNodeIds?: string[];

defaultParams: {

aspectRatio: "9:16" | "16:9" | "1:1";

durationSec?: number;

motionStrength?: "low" | "medium" | "high";

model?: string;

};

};

};

```

---

## 4.6 执行节点

```ts

type RunNodeAction = {

type: "run_node";

payload: {

nodeId: string;

};

};

```

---

## 4.7 批量执行节点

```ts

type RunNodesAction = {

type: "run_nodes";

payload: {

nodeIds: string[];

mode: "sequential" | "parallel";

};

};

```

批量运行必须确认。

---

# 5. Context Builder 重新设计

TapNow 这种产品的上下文不是只传文字，而是多模态上下文。

```ts

type CanvasAIContext = {

selectedNodes: NodeContext[];

mentionedNodes: NodeContext[];

connectedNodes: NodeContext[];

canvasSummary: {

nodeCount: number;

imageCount: number;

textCount: number;

storyboardCount: number;

videoCount: number;

};

edges: EdgeContext[];

};

```

---

## 5.1 NodeContext

```ts

type NodeContext = {

id: string;

kind: NodeKind;

title: string;

status: NodeStatus;

dataSummary: string;

textContent?: string;

media?: Array<{

type: "image" | "video" | "audio";

url: string;

thumbnailUrl?: string;

}>;

};

```

---

## 5.2 上下文来源优先级

AI 输入时，上下文优先级：

```text

1. 用户 @ 引用的节点

2. 当前选中的节点

3. 与这些节点直接连接的上游 / 下游节点

4. 当前画布摘要

5. 最近编辑的节点

```

不要默认把整个画布所有内容都塞给 AI，尤其是视频、图片节点较多时。

---

# 6. Node Execution Engine

必须有统一节点执行器。

```ts

async function runNode(nodeId: string): Promise<NodeExecutionResult>

```

根据节点 kind 分发：

```ts

switch (node.kind) {

case "image_generation":

return runImageGenerationNode(node);

case "video_generation":

return runVideoGenerationNode(node);

case "audio_generation":

return runAudioGenerationNode(node);

case "video_compose":

return runVideoComposeNode(node);

}

```

---

## 6.1 生图节点执行流程

```text

检查输入端口

↓

收集参考图

↓

收集分镜 imagePrompt

↓

合成最终 prompt

↓

调用生图 API

↓

创建 GeneratedImageNode

↓

连接 ImageGenerationNode → GeneratedImageNode

↓

状态 done

```

---

## 6.2 视频节点执行流程

```text

检查图片输入

↓

收集 motionPrompt

↓

调用图生视频 API

↓

轮询任务状态

↓

创建 GeneratedVideoNode

↓

连接 VideoGenerationNode → GeneratedVideoNode

↓

状态 done

```

---

## 6.3 合成节点执行流程

```text

按连接顺序收集视频片段

↓

收集旁白、字幕、音乐

↓

调用合成服务

↓

创建 FinalVideoNode

↓

状态 done

```

---

# 7. Job 系统

图片、视频、音频生成都是异步任务。

```ts

type GenerationJob = {

id: string;

nodeId: string;

type: "image" | "video" | "audio" | "compose";

status: "queued" | "running" | "succeeded" | "failed";

progress?: number;

providerJobId?: string;

error?: string;

createdAt: number;

updatedAt: number;

};

```

---

# 8. Stale 机制

当节点更新后，需要递归标记下游节点 stale。

```ts

function markDownstreamStale(nodeId: string) {

const downstream = getDownstreamNodes(nodeId);

downstream.forEach(node => {

if (isExecutableOrGenerated(node)) {

updateNodeStatus(node.id, "stale");

}

});

}

```

示例：

```text

修改 分镜 01

↓

生图 01 stale

↓

分镜图 01 stale

↓

视频生成 01 stale

↓

视频片段 01 stale

↓

视频合成 stale

```

---

# 9. 端口兼容校验

```ts

function canConnect(sourcePort, targetPort): boolean {

if (sourcePort.direction !== "output") return false;

if (targetPort.direction !== "input") return false;

if (targetPort.dataType === "any") return true;

return sourcePort.dataType === targetPort.dataType;

}

```

需要支持一些特殊映射：

```text

storyboard.imagePrompt → prompt input

storyboard.motionPrompt → prompt input

music → audio input

generated_video → video input

```

---

# 三、给 Claude Code 的优化版分阶段开发任务清单

下面这版更适合你直接发给 Claude Code。

---

```text

你现在是我的资深全栈工程师、AI 视频产品架构师和节点式画布系统专家。

我正在开发一个应用，名称是「星轨画布」。

我想实现的不是普通 Chat + 白板，而是类似 TapNow 的 AI 视频节点工作台。

请你把 TapNow 的真实工作流理解为：

用户上传图片、视频、音频等素材到画布上，这些素材会成为节点。

用户通过 Chat 或底部 AI 输入框让 AI 读取画布素材、分析图片、生成视频脚本、拆分分镜。

然后用户把角色图、分镜文本连接到生图节点，生成分镜图片。

再把分镜图片和运动提示词连接到图生视频节点，生成视频片段。

最后把多个视频片段、旁白、字幕、背景音乐连接到视频合成节点，生成最终视频。

核心链路是：

图片素材节点

→ AI 分析 / 文本目标

→ 脚本节点

→ 分镜节点

→ 生图节点

→ 图片结果节点

→ 图生视频节点

→ 视频结果节点

→ 音频 / 字幕 / 音乐

→ 视频合成节点

→ 最终视频节点

请不要把这个功能理解成普通知识图谱或普通聊天画布。

这是一个多模态 AI 视频生产流程图。

```

---

## 阶段 0：只读分析项目

```text

请先只读分析项目，不要修改代码。

请重点找出：

1. 当前是否已有画布系统。

2. 当前是否已有节点数据结构。

3. 当前是否已有连线数据结构。

4. 当前连线是否支持端口，如果不支持，如何扩展。

5. 当前是否已有图片上传功能。

6. 当前是否已有视频 / 音频上传功能。

7. 当前是否已有 Chat 面板。

8. 当前是否已有底部 AI 输入框。

9. 当前是否已有 AI 调用封装。

10. 当前是否已有图片生成 API。

11. 当前是否已有视频生成 API。

12. 当前是否已有音频生成 API。

13. 当前是否已有异步任务 / job 机制。

14. 当前是否已有节点运行状态。

15. 当前是否已有节点预览能力，例如图片预览、视频预览。

16. 当前是否已有项目保存 / 持久化。

17. 当前状态管理方式是什么。

18. 当前项目适合如何接入 TapNow 式工作流。

请输出：

一、项目结构分析

二、画布模块分析

三、节点系统分析

四、连线系统分析

五、媒体上传分析

六、Chat / AI 输入分析

七、AI 服务分析

八、异步任务分析

九、状态管理分析

十、MVP 接入建议

十一、风险评估

本阶段不要修改代码。

```

---

## 阶段 1：设计 TapNow 式 MVP 技术方案

```text

请基于阶段 0 的结果，设计 TapNow 式 AI 视频节点工作台 MVP。

MVP 要实现的链路是：

上传图片

→ 图片素材节点

→ Chat / AI 读取图片节点

→ 生成视频脚本

→ 保存为脚本节点

→ 拆分为多个分镜节点

→ 创建生图节点

→ 生图节点连接角色图和分镜节点

→ 执行生图节点

→ 生成图片结果节点

→ 创建图生视频节点

→ 图生视频节点连接图片结果和分镜节点

→ 执行视频节点

→ 生成视频结果节点

请设计：

1. NodeKind 类型。

2. NodeData 类型。

3. NodePort 类型。

4. CanvasEdge 类型。

5. ChatAction 类型。

6. ContextBuilder。

7. ActionExecutor。

8. NodeExecutionEngine。

9. Job 系统。

10. Stale 机制。

11. UI 改造点。

12. 文件修改计划。

13. 实现顺序。

14. 测试计划。

注意：

- 如果当前项目没有真实生图 / 视频 API，可以先做 mock provider，但接口要预留真实 API 接入。

- 不要硬编码 API Key。

- 不要一次性重构全部系统。

- 优先复用现有画布和节点系统。

- 在我确认前不要大规模修改代码。

```

---

## 阶段 2：实现多模态节点类型和端口系统

```text

请实现或扩展节点类型系统。

至少支持这些 NodeKind：

1. image_asset

2. text

3. script

4. storyboard

5. image_generation

6. generated_image

7. video_generation

8. generated_video

9. audio_generation

10. generated_audio

11. subtitle

12. music

13. video_compose

14. final_video

实现 NodePort：

端口数据类型包括：

1. image

2. text

3. script

4. storyboard

5. prompt

6. video

7. audio

8. subtitle

9. music

10. json

11. any

CanvasEdge 必须连接 sourceNodeId/sourcePortId 到 targetNodeId/targetPortId。

请实现端口兼容校验：

例如：

- image 可以连接到 image_generation 的 referenceImages。

- prompt 可以连接到 image_generation 的 prompt。

- image 可以连接到 video_generation 的 imageInput。

- video 可以连接到 video_compose 的 videoClips。

- audio 可以连接到 video_compose 的 voiceOver 或 backgroundMusic。

- subtitle 可以连接到 video_compose 的 subtitles。

完成后请保证原有画布功能不被破坏。

```

---

## 阶段 3：实现图片上传形成 ImageAssetNode

```text

请实现图片上传后自动生成 ImageAssetNode。

ImageAssetNode 需要显示：

1. 图片标题。

2. 图片预览。

3. 文件名。

4. 图片 URL。

5. 可选尺寸。

6. 可重命名。

上传成功后，节点出现在当前画布视口中心或合适位置。

节点 output port 至少包括：

image 输出口

metadata 输出口

请确保图片节点可以被选中、拖拽、连接和被 Chat 引用。

```

---

## 阶段 4：实现 Chat / AI 读取画布节点和 @ 引用

```text

请实现 Chat 输入框的 @ 节点引用能力。

用户输入 @ 时，弹出当前画布节点列表。

用户选择节点后，消息中插入节点引用。

AI 调用前通过 ContextBuilder 收集：

1. @ 引用节点。

2. 当前选中节点。

3. 和引用节点直接连接的上下游节点。

4. 画布摘要。

图片节点上下文需要包含图片 URL 或可供多模态模型读取的信息。

请实现 Chat 可以回答：

“请分析当前画布上的图片节点，告诉我这些素材适合做什么视频角色。”

如果没有真实多模态模型，先用 mock 返回，但接口要保留真实模型调用。

```

---

## 阶段 5：实现脚本生成和 ScriptNode

```text

请实现用户通过 Chat 或底部 AI 输入框生成视频脚本。

用户输入示例：

基于 @菲菲姐三视图 和 @暴力守卫三视图，生成一条 30 秒竖屏科幻短片脚本。

要求 6 个镜头，每个镜头包含时长、画面描述、角色动作、镜头运动、旁白、字幕、生图提示词、视频运动提示词。

AI 返回后：

1. Chat 中展示脚本。

2. 提供“保存为脚本节点”按钮。

3. 点击后创建 ScriptNode。

ScriptNode 需要保存：

1. 视频主题。

2. 时长。

3. 风格。

4. 角色。

5. 脚本正文。

```

---

## 阶段 6：实现脚本拆分为分镜节点

```text

请实现将 ScriptNode 拆分为多个 StoryboardNode。

每个 StoryboardNode 包含：

1. shotNumber

2. durationSec

3. visualDescription

4. characterAction

5. cameraMovement

6. voiceover

7. subtitle

8. imagePrompt

9. motionPrompt

用户可以通过：

1. Chat 输入“把这个脚本拆成分镜节点”

2. 或点击 ScriptNode 上的“拆分为分镜”按钮

系统创建多个 StoryboardNode，并自动排布在脚本节点右侧。

每个 StoryboardNode 至少有：

- prompt 输出口

- storyboard 输出口

- text 输出口

```

---

## 阶段 7：实现生图节点 ImageGenerationNode

```text

请实现 ImageGenerationNode。

它的输入端口包括：

1. referenceImages: image，多输入

2. prompt: prompt 或 text，必填

输出端口包括：

1. generatedImages: image

节点 UI 需要显示：

1. 模型选择

2. 比例：9:16 / 16:9 / 1:1

3. 生成数量

4. 风格

5. 参考图强度

6. 运行按钮

7. 状态：idle / ready / queued / running / done / error / stale

执行逻辑：

1. 检查是否连接了 prompt。

2. 收集参考图和分镜 imagePrompt。

3. 调用 image generation provider。

4. 如果没有真实 API，使用 mock provider 返回占位图。

5. 生成 GeneratedImageNode。

6. 自动连接 ImageGenerationNode 到 GeneratedImageNode。

```

---

## 阶段 8：一键为分镜创建生图流水线

```text

请实现一个动作：

create_image_generation_pipeline

用户可以选中多个 StoryboardNode，然后点击：

“为分镜创建生图节点”

系统应：

1. 为每个 StoryboardNode 创建一个 ImageGenerationNode。

2. 将对应 StoryboardNode 连接到 ImageGenerationNode 的 prompt 输入。

3. 将选中的角色 ImageAssetNode 连接到每个 ImageGenerationNode 的 referenceImages 输入。

4. 自动排布节点。

5. 默认比例为 9:16。

6. 不要自动批量运行，除非用户确认。

```

---

## 阶段 9：实现图生视频节点 VideoGenerationNode

```text

请实现 VideoGenerationNode。

输入端口：

1. imageInput: image，必填

2. motionPrompt: prompt 或 text，可选但建议

输出端口：

1. generatedVideo: video

节点 UI：

1. 模型选择

2. 时长

3. 比例

4. 动作强度 low / medium / high

5. 保持主体稳定

6. 运行按钮

7. 状态显示

执行逻辑：

1. 收集输入图片。

2. 收集 motionPrompt。

3. 调用 video generation provider。

4. 如果没有真实 API，使用 mock provider 返回占位视频。

5. 创建 GeneratedVideoNode。

6. 自动连接 VideoGenerationNode 到 GeneratedVideoNode。

```

---

## 阶段 10：一键为图片结果创建视频流水线

```text

请实现 create_video_generation_pipeline。

用户选择多个 GeneratedImageNode 和对应 StoryboardNode 后，可以点击：

“创建视频节点”

系统应：

1. 为每个 GeneratedImageNode 创建一个 VideoGenerationNode。

2. 连接 GeneratedImageNode.image 到 VideoGenerationNode.imageInput。

3. 如果能匹配 StoryboardNode，则连接 StoryboardNode.motionPrompt 到 VideoGenerationNode.motionPrompt。

4. 默认比例 9:16。

5. 默认动作强度 medium 或 low。

6. 自动排布在图片节点右侧。

7. 不自动批量运行，除非用户确认。

```

---

## 阶段 11：实现节点状态和 stale 机制

```text

请实现节点状态：

idle

ready

queued

running

done

error

stale

规则：

1. 可执行节点输入满足时变为 ready。

2. 点击运行后变为 queued/running。

3. 成功后 done。

4. 失败后 error。

5. 上游节点内容或媒体变化后，下游节点变为 stale。

示例：

修改 StoryboardNode 后：

对应 ImageGenerationNode stale

GeneratedImageNode stale

VideoGenerationNode stale

GeneratedVideoNode stale

请实现 markDownstreamStale。

```

---

## 阶段 12：实现 Chat 操作画布的结构化 Actions

```text

请实现 AIResult：

{

reply: string,

actions?: ChatAction[],

nodeRefs?: string[]

}

支持以下 actions：

1. create_node

2. update_node

3. connect_nodes

4. split_script_to_storyboards

5. create_image_generation_pipeline

6. create_video_generation_pipeline

7. run_node

8. run_nodes

9. focus_node

10. select_nodes

所有 actions 必须校验。

高风险动作必须确认。

高风险包括：

1. 批量运行多个生图节点。

2. 批量运行多个视频节点。

3. 覆盖节点内容。

4. 删除节点。

5. 合成最终视频。

```

---

## 阶段 13：实现节点引用点击定位

```text

Chat 回复中支持节点引用：

[菲菲姐三视图](node:node-id)

点击后：

1. 选中节点。

2. 高亮节点。

3. 画布移动到节点。

4. 可选打开节点详情面板。

如果节点不存在，显示提示，不要崩溃。

```

---

## 阶段 14：第二阶段，完整视频合成链路

```text

MVP 完成后，再实现：

1. VoiceOverTextNode

2. AudioGenerationNode

3. GeneratedAudioNode

4. SubtitleNode

5. MusicNode

6. VideoComposeNode

7. FinalVideoNode

实现链路：

旁白文本 → 语音生成 → 音频结果

字幕文本 → 字幕节点

背景音乐上传 → MusicNode

多个视频片段 + 音频 + 字幕 + 音乐 → 视频合成 → 最终视频

VideoComposeNode 需要支持：

1. 视频片段排序。

2. 画幅。

3. 分辨率。

4. 帧率。

5. 格式。

6. 转场。

7. 音频混合。

8. 输出最终 MP4。

```

---

# 四、最重要的产品理解修正

你可以把下面这段作为项目总说明，放到需求文档最前面。

```text

星轨画布要实现的是 TapNow 式 AI 视频节点工作台，而不是普通的 Chat + 白板。

在这个系统中：

1. 画布不是普通白板，而是视频生产流程图。

2. 节点不是普通卡片，而是素材、提示词、模型任务、生成结果或合成步骤。

3. 连线不是普通关系线，而是图片、文本、音频、视频等数据的输入输出流。

4. Chat 不是普通聊天，而是 AI 编排器，可以读取画布、引用节点、生成脚本、拆分分镜、创建节点和连接节点。

5. 底部 AI 输入框是快速生成入口，用于基于当前上下文调用模型。

6. 节点可以执行，例如生图、图生视频、语音生成、视频合成。

7. 每个节点的输出都可以继续作为后续节点的输入。

8. 用户修改某个上游节点后，只需要重跑相关下游节点，不需要整条视频重做。

9. 最终目标是让用户从图片/文字素材出发，一步步生成完整视频。

```

---

# 五、MVP 最小可做版本建议

如果你想控制开发风险，我建议 MVP 不要一上来就做完整视频合成，而是先做这条链路：

```text

图片上传

→ 图片节点

→ Chat 分析图片

→ 生成脚本节点

→ 拆分分镜节点

→ 创建生图节点

→ mock 生图 / 真实生图

→ 图片结果节点

→ 创建图生视频节点

→ mock 视频 / 真实视频

→ 视频结果节点

```

暂时不做：

1. 音频生成；

2. 字幕生成；

3. 背景音乐；

4. 最终合成；

5. 时间轴；

6. 批量自动执行；

7. 复杂 Agent。

这样能最快验证 TapNow 的核心体验：

> **素材放到画布上，AI 理解素材，生成分镜，再通过节点生成图片和视频。**

---

# 六、你现在可以直接发给 Claude Code 的短版提示词

如果你想简洁一点，就发这段：

```text

请重新理解我的需求。

我要做的不是普通 Chat + Canvas，而是类似 TapNow 的 AI 视频节点工作台。

真实流程是：

用户上传角色图、产品图、参考图到画布，形成图片素材节点。

用户通过 Chat 或底部 AI 输入框让 AI 读取画布素材，分析图片，生成视频脚本。

脚本可以保存为 ScriptNode，并拆成多个 StoryboardNode。

每个 StoryboardNode 包含时长、画面描述、角色动作、镜头运动、旁白、字幕、生图提示词、视频运动提示词。

用户可以为每个分镜创建 ImageGenerationNode，把角色图和分镜提示词连接进去，生成 GeneratedImageNode。

然后把 GeneratedImageNode 和分镜运动提示词连接到 VideoGenerationNode，生成 GeneratedVideoNode。

后续再把多个视频片段、旁白、字幕、背景音乐连接到 VideoComposeNode，生成 FinalVideoNode。

请先只读分析当前项目，看是否已有：

1. 画布

2. 节点

3. 连线

4. 端口

5. 图片上传

6. Chat

7. AI 调用

8. 生图 API

9. 视频 API

10. 异步任务

11. 节点状态

12. 媒体预览

然后设计 TapNow 式 MVP：

图片上传

→ 图片节点

→ Chat 读取图片

→ 生成脚本节点

→ 拆分分镜节点

→ 创建生图节点

→ 执行生图生成图片结果节点

→ 创建图生视频节点

→ 执行视频生成视频结果节点

注意：

连线必须表示真实数据流，最好支持 sourcePort 和 targetPort。

节点需要有 inputPorts 和 outputPorts。

节点状态需要支持 idle、ready、queued、running、done、error、stale。

Chat 返回结构化 actions，但不能直接执行高风险操作。

如果没有真实生图/视频 API，先做 mock provider，但接口要预留真实 API。

在我确认前不要大规模修改代码。

```

---

这样优化后，需求就更贴近 TapNow 的真实流程了：

**不是“AI 帮我管理节点”，而是“AI 帮我在节点式画布里生产视频”。**