# theseus-ship

盐言互动 · AI Interactive Reading 前端

## 技术栈
- React + TypeScript
- Vite
- Framer Motion
- @xyflow/react

## 本地开发

```bash
npm install
npm run dev
```

前端运行在 http://localhost:5173

## Render 部署

### 方式一：使用 Blueprint（推荐）

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 **Blueprints** → **New Blueprint Instance**
3. 选择 `theseus-ship` 仓库
4. Render 会自动读取 `render.yaml` 配置创建静态站点

### 方式二：手动创建 Static Site

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 **New** → **Static Site**
3. 选择 GitHub 仓库 `lrfighting/theseus-ship`
4. 配置：
   - **Name**: `theseus-ship`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
5. 添加环境变量（在 Dashboard → Environment）：
   | Key | Value | 说明 |
   |-----|-------|------|
   | `VITE_API_BASE` | `https://theseus-ship-service.onrender.com/api` | 后端 API 地址 |

> 如果后端地址不同，修改 `VITE_API_BASE` 为你的实际后端地址。

### 部署后地址

- 前端页面：`https://theseus-ship.onrender.com`
