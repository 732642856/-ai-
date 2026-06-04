# STORYBOARD_COMPOSITE_SETTINGS_P3B_2026-05-25

日期：2026-05-25  
项目：Startrail Canvas / 星轨画布  
任务：P3B：多格分镜设置面板 MVP。

---

## 1. 本轮目标

在 P3-Fix 已稳定的基础上，给多选 Shot 后的“生成一张分镜图”增加一个克制版设置入口，让用户在当前画布会话内控制：

```text
布局、是否显示镜头编号、是否显示简短标题、统一风格 Prompt、生成策略
```

本轮明确不做：视频 API、角色参考图、资产库重构、Agent、依赖升级、全仓 Prettier、大规模重构。

---

## 2. 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/web/src/lib/storyboard/storyboardComposite.ts` | 新增 composite settings 类型、默认值、布局解析、生成策略判断、prompt 拼接扩展 |
| `apps/web/src/lib/storyboard/storyboardComposite.test.ts` | 补充默认设置、布局、策略、prompt、fallback 等纯函数测试 |
| `apps/web/src/app/canvas/StarCanvas.tsx` | 多选 Shot 浮动操作条新增“设置”按钮和轻量设置面板；生成时应用设置；Composite ImageNode 记录 `compositeSettings` |
| `apps/web/src/app/canvas/components/canvas/types.ts` | 新增 `StoryboardCompositeSettings` 类型，并在 `CanvasNodeData` 中加入 `compositeSettings` 字段 |

---

## 3. 新增类型和默认设置

新增类型：

```ts
export type StoryboardCompositeLayoutOption = "auto" | "2x2" | "1x4" | "4x1";

export type StoryboardCompositeStrategy =
  | "auto-compose-or-generate"
  | "always-generate-composite";

export type StoryboardCompositeSettings = {
  layout: StoryboardCompositeLayoutOption;
  showShotNumber: boolean;
  showShotTitle: boolean;
  stylePrompt: string;
  strategy: StoryboardCompositeStrategy;
};
```

默认设置：

```ts
export const DEFAULT_STORYBOARD_COMPOSITE_SETTINGS: StoryboardCompositeSettings = {
  layout: "auto",
  showShotNumber: true,
  showShotTitle: false,
  stylePrompt: "",
  strategy: "auto-compose-or-generate",
};
```

---

## 4. UI 入口说明

多选 2 个及以上 ShotNode 后，顶部浮动操作条现在显示：

```text
[分别生成单图] [设置] [生成一张分镜图]
```

`设置` 是独立按钮，没有做下拉按钮，保持 MVP 清楚、低风险。

---

## 5. 设置面板交互说明

点击 `设置` 后出现轻量面板：

```text
分镜图设置

布局：自动 / 2×2 四格 / 1×4 横排 / 4×1 竖排
显示信息：显示镜头编号 / 显示简短标题
统一风格 Prompt：多行文本框
生成策略：
- 自动：全部已有单图时本地合成，否则生成完整分镜图
- 始终调用模型生成完整分镜图

[取消] [应用]
```

交互规则：

- `应用`：更新当前会话内的设置，后续点击“生成一张分镜图”使用新设置。
- `取消`：丢弃草稿设置，不修改当前设置。
- MVP 不做跨刷新持久化。

---

## 6. 布局规则

新增：

```ts
getStoryboardCompositeLayout(shotCount, settings)
```

规则：

| 设置 | 行为 |
|---|---|
| `auto` + 1 shot | 1×1 |
| `auto` + 2 shots | 2×1 |
| `auto` + 3 shots | 3×1 |
| `auto` + 4 shots | 2×2 |
| `auto` + 5-6 shots | 3×2 |
| `auto` + 7-9 shots | 3×3 |
| `2x2` | 2 columns × 2 rows |
| `1x4` | 4 columns × 1 row |
| `4x1` | 1 column × 4 rows |

如果显式布局无法容纳全部 Shot，例如 `2x2` 但有 5 个 Shot，会 fallback 到 auto，并记录：

```ts
fallbackFrom: "2x2"
```

不会丢 Shot。

---

## 7. 生成策略规则

新增：

```ts
shouldUseLocalStoryboardCompose({ imageUrls, settings })
```

### auto-compose-or-generate

沿用 P3-Fix 行为：

```text
全部已有单图 → 本地合成
否则 → 一次模型生成完整分镜图
```

底层仍依赖：

```ts
imageUrls.length > 0 && imageUrls.every(Boolean)
```

### always-generate-composite

无论是否已有全部单图，都不走本地合成：

```text
只调用一次模型生成完整多格分镜图
```

这用于用户想强制获得统一画风的场景。

---

## 8. Prompt 拼接规则

`buildStoryboardCompositePrompt(shots, settings)` 现在会把设置写入 prompt：

- 只输出一张完整图片，不要拆成多张单图。
- 布局：自动 / 2×2 / 1×4 / 4×1 与实际 rows×cols。
- 是否显示镜头编号。
- 是否显示简短标题。
- 用户填写的统一风格要求。
- 每个 Shot 的 title / description / visualPrompt。

示例结构：

```text
生成一张 2x2 的电影分镜图，共 4 格。
只输出一张完整图片，不要拆成多张单图。
布局：auto，实际 2x2。
显示镜头编号：是。
显示简短标题：否。
统一风格要求：
cinematic noir storyboard, same protagonist, consistent lighting
镜头内容：
镜头 1: ...
```

---

## 9. Composite ImageNode metadata 说明

生成的 Composite ImageNode 现在记录：

```ts
compositeSettings: settings,
generationOutput: {
  type: "storyboard-composite",
  sourceShotIds,
  layout: {
    columns,
    rows,
    label,
    requestedLayout,
    fallbackFrom,
  },
  strategy: settings.strategy,
  localCompose: shouldUseLocalCompose,
}
```

这些都是普通 JSON 元数据，不包含图片二进制。

---

## 10. 本地合成支持和限制

当前本地合成支持：

- 使用设置中的 layout columns。
- 根据 `auto / 2x2 / 1x4 / 4x1` 生成对应网格。
- 全部已有单图且策略为 `auto-compose-or-generate` 时走本地合成。

当前限制：

- 本轮没有大改 `composeStoryboardGrid()` 的文字叠加逻辑。
- 因此本地合成暂不在图片上绘制镜头编号 / 简短标题。
- `showShotNumber` / `showShotTitle` 会影响模型生成 prompt，并记录到 metadata。
- 如果用户需要本地拼接图也直接烧录编号/标题，建议后续单独做“小型 canvas overlay”任务，不要混入 P3B。

---

## 11. 新增 / 修改测试

`storyboardComposite.test.ts` 新增/更新覆盖：

1. 默认设置测试。
2. 布局解析：
   - auto + 4 shots → 2×2。
   - 2×2 / 1×4 / 4×1 显式布局。
   - 2×2 + 5 shots → fallback auto，不丢 Shot。
3. 策略测试：
   - auto + 全部有图 → 本地合成。
   - auto + 部分缺图 → 模型生成。
   - always-generate-composite + 全部有图 → 仍模型生成。
4. Prompt 测试：
   - 包含“只输出一张完整图片，不要拆成多张单图”。
   - 包含布局语义。
   - 包含镜头编号和标题显示要求。
   - 包含 stylePrompt。
   - fallback 布局会写入 prompt。
5. 既有 edge 创建、去重、generated-image 保留、Shot 图片 URL 查找测试保持通过。

---

## 12. 验证命令结果

### typecheck

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web typecheck
```

结果：通过，exit code 0。

### lint

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web lint
```

结果：通过，exit code 0。  
备注：仍有 32 个既有 warning，0 error；本轮未引入阻塞性 lint error。

### test

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
```

结果：通过。

```text
tests 262
suites 42
pass 262
fail 0
cancelled 0
skipped 0
todo 0
```

### build

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web build
```

结果：通过，exit code 0。  
Next.js 16.2.6 production build compiled successfully。

---

## 13. 手动验收步骤

### A. 默认行为不变

1. 不打开设置面板。
2. 选中 4 个 Shot。
3. 点击“生成一张分镜图”。

预期：默认仍是 2×2；只输出一个 Composite ImageNode。

### B. 选择 1×4

1. 多选 4 个 Shot。
2. 打开设置。
3. 选择 `1×4 横排`。
4. 点击应用。
5. 点击“生成一张分镜图”。

预期：prompt / metadata / 本地合成 columns 使用 1×4 横排语义；只输出一个 ImageNode。

### C. 始终调用模型生成

1. 4 个 Shot 都已有单图。
2. 打开设置。
3. 选择“始终调用模型生成完整分镜图”。
4. 点击“生成一张分镜图”。

预期：不走本地合成；只调用一次模型；只输出一个 Composite ImageNode。

### D. 统一风格 Prompt

1. 打开设置。
2. 输入：

```text
cinematic noir storyboard, same protagonist, consistent lighting
```

3. 点击应用。
4. 生成一张分镜图。

预期：composite prompt 包含该风格描述；ImageNode metadata 记录 `compositeSettings.stylePrompt`。

### E. 取消不生效

1. 打开设置。
2. 改布局或风格 Prompt。
3. 点击取消。

预期：后续生成仍使用取消前的设置。

---

## 14. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| 本地合成暂不烧录编号/标题 | settings 影响 prompt 和 metadata，但本地 canvas 合成仍只拼图 | 后续单独做 canvas overlay，不要混入本轮 |
| 设置不跨刷新 | MVP 只要求当前会话生效 | 若用户反馈需要记忆，再存 Zustand/localStorage，但必须确认安全字段 |
| UI 未做浏览器自动化测试 | 本轮主要依赖 typecheck/build 和纯函数测试 | 手动验收 A-E 后再进入 P4 |
| 旧 lint warning 仍存在 | 32 个 warning 非本轮新增 | 后续单独 cleanup，不要混在功能迭代里 |
| StarCanvas 仍偏大 | P3B 只做局部接入，未大拆组件 | 后续若继续加面板，应考虑抽组件，但不要现在重构 |

---

## 15. 是否可以进入 P4 Slash Command MVP

可以，但建议先完成一次 P3B 手动验收。

进入 P4 前置条件已经满足：

- typecheck 通过。
- lint 通过，0 error。
- test 通过，262 tests / 42 suites / 262 pass。
- build 通过。
- 设置是普通 JSON，不包含图片二进制。
- 没有恢复 `imageUrls.some(...)` 错误判断。
- 没有新增 blob/data:image/base64 持久化风险。

P4 建议范围继续克制：

```text
TextNode / ShotNode 内输入 /
出现命令菜单
支持 summarize / expand / rewrite / split storyboard / generate image
```

不要一开始做全局 Agent。
