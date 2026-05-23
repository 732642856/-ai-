# V2 Development Baseline

**创建时间**：2026-05-22
**分支**：`v2-dev`
**创建人**：一楠

---

## 1. 分支名称

`v2-dev`

## 2. 基线来源

- **父分支**：`main`（提交 `17b4c89`）
- **main 状态**：已完成 Phase 0-4 整理和验证
  - Phase 0：标准目录结构创建
  - Phase 1：唯一主干安全复制（零真实 env 泄漏）
  - Phase 2：相关资料/报告/截图归档
  - Phase 3：非主干历史版本归档（V0-old + V1-tx）
  - Phase 4：主干验证通过

## 3. 主干验证摘要

| 验证项 | 结果 |
|--------|:---:|
| 基础结构（9 项） | ✅ |
| 安全检查（零 env 泄漏） | ✅ |
| `pnpm install --frozen-lockfile` | ✅ 712 包 |
| `tsc --noEmit` | ✅ 零错误 |
| 测试（7 文件） | ✅ 160/160 通过 |
| `next build --webpack` | ✅ 8 routes |

## 4. V2 开发范围

| Phase | 名称 | 说明 |
|-------|------|------|
| Phase 6 | 清理冗余 | 移除废弃代码、未使用依赖、死代码路径 |
| Phase 7 | 迁移 Cinema Pipeline | 从 V1-tx 迁移 Cinematic Prompt Pipeline |
| Phase 8 | 迁移视频模板 | 从 V1-tx 迁移视频相关模板和配置 |
| Phase 9 | 迁移 4 级降级 | 从 V1-tx 迁移 4 级降级持久化策略 |
| Phase 10 | 修复 P0 Bug | 修复已知 P0 Bug 并补充测试 |

## 5. 明确禁止

以下行为在所有 V2 阶段中严格禁止：

- ❌ 提交真实 `.env` / `.env.local` / `.env.*.local`
- ❌ 提交 API Key / Secret / Token
- ❌ 提交 `node_modules` / `.next` / `.turbo` / `coverage`
- ❌ 修改原始归档目录（`~/Projects/StarCanvas/02_ARCHIVE_历史版本/`）
- ❌ 在旧目录修 Bug（只在此仓库操作）
- ❌ 使用非主干副本作为开发基线
- ❌ `git add .`（必须按文件路径精确定位）
- ❌ `pnpm install` 不使用 `--frozen-lockfile`

## 6. 当前已知 P0 Bug

| ID | 描述 | 状态 |
|----|------|:---:|
| BUG-001 | 一键生成工作流后画布被清空 | 待修复（Phase 10） |
| BUG-002 | 三节点联合生图失败 | 待修复（Phase 10） |

## 7. 环境缺口

- 缺少 `apps/web/.env.local`
- 需按 `docs/LOCAL_ENV_SETUP.md` 手动创建后运行 `dev`
- 不影响类型检查、测试或构建

## 8. 分支策略

```
main (整理基线、已验证)
  └── v2-dev (V2 开发分支) ← 当前
        └── feature/phases (各阶段功能分支，按需创建)
```

**规则**：
- `main` 保持为已验证基线，不再直接提交功能代码
- 所有 V2 开发在 `v2-dev` 或其子分支进行
- 每完成一个 Phase，提交一次，保留可回滚的 Git 历史
- Phase 10 修复完毕后，合并回 `main`

## 9. Git 参考命令

```bash
# 环境变量安全 (每次操作后检查)
find . -name ".env" -o -name ".env.local" -o -name ".env.*.local"

# 安装依赖 (始终使用 frozen lockfile)
NODE_OPTIONS="" pnpm install --frozen-lockfile

# 类型检查
NODE_OPTIONS="" pnpm --filter web typecheck

# 运行测试
NODE_OPTIONS="" node --experimental-strip-types <test-file>

# 构建
NODE_OPTIONS="" pnpm --filter web build
```
