# SLASH_COMMAND_MVP_P4_2026-05-25

日期：2026-05-25  
项目：Startrail Canvas / 星轨画布  
任务：P4：Slash Command MVP。

---

## 1. 本轮目标

实现克制版 Slash Command MVP：

```text
TextNode / ShotNode 内部编辑时输入 /
→ 显示节点内命令菜单
→ 支持常用文本创作命令和已有分镜/图片链路
```

本轮明确不做：全局 Agent、canvas 空白处命令、视频命令、新模型 SDK、依赖升级、全仓 Prettier、大规模重构。

---

## 2. 修改文件

| 文件 | 修改内容 |
|---|---|
| `apps/web/src/lib/slashCommands/slashCommands.ts` | 新增 Slash Command 类型、命令列表、目标过滤、slash query 解析、命令文本移除、prompt 构建 |
| `apps/web/src/lib/slashCommands/slashCommands.test.ts` | 新增纯函数测试 |
| `apps/web/src/lib/slashCommands/runSlashTextCommand.ts` | 新增轻量文本命令 adapter，复用 `/api/ai/chat` |
| `apps/web/src/app/canvas/components/menus/InlineSlashCommandMenu.tsx` | 新增节点内轻量命令菜单 UI |
| `apps/web/src/app/canvas/components/nodes/ContentNode.tsx` | TextNode 主文本编辑区接入 `/` 命令菜单和执行逻辑 |
| `apps/web/src/app/canvas/components/nodes/ShotNode.tsx` | ShotNode 剧本文本区接入 `/` 命令菜单和执行逻辑 |
| `apps/web/src/app/canvas/StarCanvas.tsx` | 新增 `starcanvas:split-storyboard` 事件监听，复用既有 `handleSplitStoryboardNode`；继续复用 `starcanvas:generate-shot` 单图生成事件 |

---

## 3. Slash Command 支持范围

本轮只支持：

```text
TextNode
ShotNode
```

暂不支持：

```text
ImageNode
VideoNode
AssetNode
Canvas 空白处全局命令
```

---

## 4. 命令列表

新增命令定义：

```ts
export type SlashCommandId =
  | "summarize"
  | "expand"
  | "rewrite"
  | "split-storyboard"
  | "generate-image";
```

命令列表：

| id | 中文 | 描述 |
|---|---|---|
| `summarize` | 总结 | 将当前内容总结为更短版本 |
| `expand` | 扩写 | 扩写当前内容，增加画面细节 |
| `rewrite` | 改写 | 改写为更清晰的影视分镜描述 |
| `split-storyboard` | 拆成分镜 | 将文本拆分为多个镜头 |
| `generate-image` | 生成图片 | 为当前镜头生成一张图片 |

---

## 5. TextNode 支持命令

TextNode 可用：

```text
summarize
expand
rewrite
split-storyboard
```

TextNode 不显示：

```text
generate-image
```

---

## 6. ShotNode 支持命令

ShotNode 可用：

```text
summarize
expand
rewrite
generate-image
```

ShotNode 不显示：

```text
split-storyboard
```

---

## 7. UI 交互说明

在 TextNode 主文本区或 ShotNode “剧本文本”区输入：

```text
/
```

会显示节点内轻量菜单。

继续输入：

```text
/exp
```

会过滤命令，例如匹配 `expand / 扩写`。

菜单显示：

```text
命令中文 label
命令 description
```

点击菜单项可执行命令。

---

## 8. 键盘交互说明

支持：

| 键 | 行为 |
|---|---|
| ArrowDown | 选择下一个命令 |
| ArrowUp | 选择上一个命令 |
| Enter | 执行当前命令 |
| Escape | 关闭菜单 |

`Enter` 仅在 slash menu 打开且有命令时拦截；普通编辑行为不额外改变。

---

## 9. 各命令执行逻辑

### summarize / expand / rewrite

适用：TextNode / ShotNode。

执行逻辑：

```text
移除用户输入的 /xxx
↓
构建命令 prompt
↓
调用 /api/ai/chat
↓
成功：更新当前节点文本
失败：保留原文本并显示错误
```

prompt 规则：

- summarize：总结为更短、更清晰版本。
- expand：增加影视画面、动作、情绪、环境细节。
- rewrite：改写为更适合影视分镜描述。

### split-storyboard

适用：TextNode。

执行逻辑：

```text
移除 /split-storyboard 文本
↓
派发 starcanvas:split-storyboard 事件
↓
StarCanvas 复用 handleSplitStoryboardNode(nodeId)
```

输出继续沿用现有：

```text
TextNode / Source → ShotNode
storyboard-shot relation
```

没有重写一套 Shot 创建逻辑。

### generate-image

适用：ShotNode。

执行逻辑：

```text
移除 /generate-image 文本
↓
派发 starcanvas:generate-shot 事件
↓
StarCanvas 复用 handleGenerateShotImage(nodeId)
```

输出继续沿用现有：

```text
ShotNode → ImageNode
relation = generated-image
```

不会创建 `storyboard-composite`。

---

## 10. 复用现有链路说明

本轮没有新增图片生成链路，也没有新增分镜拆分链路。

复用关系：

| Slash Command | 复用链路 |
|---|---|
| `split-storyboard` | `handleSplitStoryboardNode` |
| `generate-image` | `handleGenerateShotImage` |
| `summarize/expand/rewrite` | 现有非流式 `/api/ai/chat` 代理 |

这避免了重复实现、重复持久化和重复 edge 语义。

---

## 11. 新增 / 修改测试说明

新增：`apps/web/src/lib/slashCommands/slashCommands.test.ts`

覆盖：

1. `getSlashCommandsForTarget`
   - TextNode 返回 summarize / expand / rewrite / split-storyboard。
   - ShotNode 返回 summarize / expand / rewrite / generate-image。
   - TextNode 不返回 generate-image。
   - ShotNode 不返回 split-storyboard。
   - query 可按英文 id、中文 label / description 过滤。

2. `parseSlashQuery`
   - `hello /exp` + cursor at end → query = exp。
   - `/` → query = empty。
   - `hello /` → query = empty。
   - cursor 不在 slash command 中 → null。
   - slash 后含空格 → null。

3. `removeSlashCommandFromText`
   - 移除 `/expand`。
   - 保留其他正文。
   - 不误删正文。

4. `buildSlashCommandPrompt`
   - summarize prompt 包含总结要求和原文。
   - expand prompt 包含影视细节扩写要求和原文。
   - rewrite prompt 包含影视分镜改写要求和原文。

---

## 12. 持久化安全检查

本轮新增的 Slash Command metadata / state 不写入 localStorage。

文本命令只更新普通文本字段：

```text
content
prompt
shot.description
```

生成图片命令复用既有 `handleGenerateShotImage`：

- 图片持久化仍走 IndexedDB / assetId / sanitizer。
- 不新增 `blob:` / `data:image` / base64 写入路径。

结论：本轮未发现新的持久化风险。

---

## 13. 验证命令结果

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
备注：仍有 32 个既有 warning，0 error；本轮未新增阻塞性 lint error。

### test

```bash
NODE_OPTIONS="" pnpm -C "/Users/wuyongnaren/Projects/starcanvas-main" --filter web test
```

结果：通过。

```text
tests 273
suites 47
pass 273
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

## 14. 手动验收步骤

### A. TextNode 输入 `/`

预期：

```text
显示 总结 / 扩写 / 改写 / 拆成分镜
不显示 生成图片
```

### B. ShotNode 输入 `/`

预期：

```text
显示 总结 / 扩写 / 改写 / 生成图片
不显示 拆成分镜
```

### C. TextNode 输入 `/exp` 并执行

预期：

```text
调用扩写
成功后更新当前 TextNode 文本
失败时保留原文本并显示错误
```

### D. TextNode 执行 split-storyboard

预期：

```text
生成多个 ShotNode
建立 TextNode → ShotNode 血缘
复用现有 storyboard-shot relation
```

### E. ShotNode 执行 generate-image

预期：

```text
生成或更新单张 ImageNode
relation = generated-image
不生成 storyboard-composite
```

### F. 键盘交互

预期：

```text
ArrowDown / ArrowUp 可切换命令
Enter 执行当前命令
Escape 关闭菜单
```

---

## 15. 剩余风险

| 风险 | 说明 | 建议 |
|---|---|---|
| UI 尚未做浏览器自动化测试 | 本轮以纯函数测试和完整构建验证为主 | 进入 P5 前建议人工验收 A-F |
| 文本命令直接替换当前文本 | MVP 简单直接，但缺少撤销/对比 | 后续可做“生成为新 TextNode”或版本历史 |
| ShotNode 文本命令只作用于剧本文本区 | 暂不对生图 Prompt 区触发 slash | 后续可按反馈扩展到 visualPrompt |
| 菜单位置是节点内固定浮层 | 未做精确光标定位 | MVP 可接受，后续可优化跟随光标 |
| `/api/ai/chat` 失败依赖上游错误 | 已保留原文本 | 后续可接更明确的 toast 系统 |

---

## 16. 是否可以进入 P5：右键菜单统一 + 保存为资产入口

可以，但建议先人工验收 P4 的 TextNode / ShotNode slash menu。

进入 P5 前置条件已满足：

- typecheck 通过。
- lint 通过，0 error。
- test 通过，273 tests / 47 suites / 273 pass。
- build 通过。
- 没有新增图片持久化风险。
- `/generate-image` 复用单图生成链路。
- `/split-storyboard` 复用既有分镜拆分链路。

P5 建议范围继续克制：

```text
右键菜单统一
保存为资产入口统一
Composite ImageNode 来源查看入口
不要做资产库重构
```
