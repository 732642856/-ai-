# @creative-canvas/providers

Provider 抽象包，用于沉淀星轨画布未来后端化的 AI Provider 接口与适配层。

## 当前状态

- experimental / non-blocking。
- 当前不属于 `apps/web` 默认交付链路。
- 已纳入 pnpm workspace，避免包漂移。
- 如需检查，可运行 `pnpm typecheck:all`，或由依赖它的 `apps/api` 单独检查。

正式进入主线前，需要补齐稳定 API、测试与构建产物策略。
