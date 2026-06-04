# MANUAL_IMAGE_ACCEPTANCE_2026-05-25

## 结论

本次尝试启动并准备执行浏览器手动验收，但当前环境无法由助手自动接管浏览器完成真实页面操作。

原因：

1. 项目已有 Next dev server 正在运行：`http://localhost:3000/canvas`。
2. 再次启动时 Next 提示：端口 3000 已被 PID 5995 占用，并拒绝启动第二个 dev server。
3. 当前环境未安装可用的 `agent-browser` CLI。
4. 当前环境未安装可用的 `playwright-cli` CLI，项目内也未发现 Playwright 依赖。
5. 为遵守“不新增依赖、不污染环境、不改项目配置”的原则，本次没有安装浏览器自动化工具，也没有强行引入 Playwright/jsdom。

因此，本报告记录的是“验收准备状态”，不是完整手动验收结果。

## 已确认项

| 项目 | 结果 |
|---|---|
| dev server | 已存在运行中的服务 |
| 本地地址 | `http://localhost:3000/canvas` |
| 重复启动 | 被 Next 拒绝，提示已有 dev server |
| agent-browser | 当前 shell 中不可用 |
| playwright-cli | 当前 shell 中不可用 |
| 项目 Playwright 依赖 | 未发现 |

## 需要人工在浏览器执行的验收清单

请打开：

```text
http://localhost:3000/canvas
```

然后按以下项目记录结果：

```text
手动验收结果：

1. 上传单张图片：通过/失败
2. 刷新恢复：通过/失败
3. localStorage blob 检查：false/true
4. localStorage data:image 检查：false/true
5. 多图上传删除：通过/失败
6. 图生图 payload 是否包含 blob:：否/是
7. 图生图后 localStorage 是否污染：否/是
8. 失败生成 loading 是否恢复：通过/失败
9. 控制台是否有红色错误：无/有
10. 备注：
```

Console 检查命令：

```js
JSON.stringify(localStorage).includes('blob:')
```

期望：

```js
false
```

```js
JSON.stringify(localStorage).includes('data:image')
```

期望：

```js
false
```

如果发现污染，执行：

```js
Object.entries(localStorage)
  .filter(([k, v]) => v.includes('base64') || v.includes('data:image') || v.includes('blob:'))
  .map(([k, v]) => ({
    key: k,
    hasBlob: v.includes('blob:'),
    hasDataImage: v.includes('data:image'),
    hasBase64: v.includes('base64'),
    length: v.length,
    sample: v.slice(0, 300)
  }))
```

## 是否可以进入下一阶段

建议：

- 若人工浏览器验收全部通过，可以进入 `ESLint warning cleanup`。
- 若发现 localStorage 含 `blob:` / `data:image`，应先回到持久化清洗链路继续修。
- 若图生图 payload 含 `blob:`，应先修 `prepareReferenceImageForGeneration` / 图生图入口。
- 若失败生成 loading 卡住，应先进入 AI 错误归一化专项，而不是 ESLint cleanup。
