# 本地环境配置说明

## 重要提醒

**真实 API Key 不随项目复制，需要手动创建配置文件。**

## 你需要做的事

### 1. 创建 `.env.local`

在以下路径手动创建：

```
apps/web/.env.local
```

### 2. 参考示例文件

复制示例文件并填入真实 Key：

```bash
cp apps/web/.env.example apps/web/.env.local
```

然后用编辑器打开 `apps/web/.env.local`，将占位符替换为真实值。

### 3. 安全规则

- ❌ **不要把 `.env.local` 提交到 Git**（`.gitignore` 已自动排除 `.env.*`）
- ❌ **不要把 API Key 写入任何文档、报告或截图**
- ❌ **不要把 `.env.local` 分享给他人**
- ✅ 只在本机保留 `.env.local`

### 4. 当前中转站

项目使用 copse.top 代理：
- URL: `https://copse.top/v1`
- 模型: gpt-5.4, gpt-5.4-mini, gpt-5.5, gpt-image-2

### 5. 启动方式

```bash
cd ~/Projects/StarCanvas/01_MAIN_主干/starcanvas
NODE_OPTIONS="" npm run dev
```

注意：`NODE_OPTIONS=--use-system-ca` 会阻止 Node.js 启动，必须清空。
