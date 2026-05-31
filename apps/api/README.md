# StarCanvas API

这是星轨画布未来云端化的后端雏形，基于 NestJS + Prisma 构建。当前包含：

- 用户 / 组织
- 项目 / 画布文档 / 画布版本
- Provider Key 管理
- 生成任务
- 用量记录
- Canvas Agent Planner 后端版本

## 当前状态

- 暂不被 `apps/web` 主链路依赖。
- 暂不进入默认构建、默认类型检查或默认测试门槛。
- 可通过 `pnpm typecheck:api`、`pnpm build:api`、`pnpm lint:api` 单独检查。
- 等账号、云端同步、计费、多端协作进入主线后，再正式纳入默认质量门槛。

## 工程边界

本应用已纳入 pnpm workspace，目的是避免“Git 中存在但包管理器不可见”的长期漂移；但它仍是 experimental / non-blocking 模块，不应阻塞当前主产品 `apps/web` 的交付。
