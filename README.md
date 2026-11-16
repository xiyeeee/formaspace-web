# 形境 · FormaSpace

第一阶段基础工程：在原 Vite + React + TypeScript 工程上初始化，页面为可导航占位。

## 启动

使用 pnpm 10，Node 满足 `^20.19.0 || >=22.12.0`（当前验证环境 Node 20.20.2）。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
```

按需复制 `.env.example` 为 `.env.local`；`*.local` 已被 `.gitignore` 忽略。
默认 API 前缀 `/api`，当前不配置后端代理。`VITE_` 变量公开给浏览器，不能存储服务端秘密。

## 已实现

- Tailwind CSS v4、shadcn/ui Radix Nova 中性深色主题，保留 CLI 生成的主题变量和组件。
- `@/` 别名同步配置于 Vite、根 tsconfig 和 app tsconfig。TypeScript 6 使用相对 paths，不引入已弃用的 baseUrl。
- StrictMode、QueryClientProvider、TooltipProvider、全局 Toaster。
- `/` 重定向 `/studio`；`/login`、`/register`、`/studio`、`/works` 可直接访问；未知路径展示 404，另有路由错误页面。
- 工作台上传参数 / 模型预览 / 任务历史三栏占位，小屏堆叠；登录注册视觉区 / 表单区占位。
- 焦点样式、跳至主要内容、减少动态效果支持；页脚按钮用于验证全局通知。

## 依赖用途

| 依赖 | 用途 |
| --- | --- |
| react-router 7 | 浏览器路由；8.x 要求 Node ≥22.22，故选兼容当前 Node 20 的 7.x |
| @tanstack/react-query | 服务端状态与后续轮询 |
| react-hook-form、zod、@hookform/resolvers | 后续表单与校验，当前仅安装 |
| react-dropzone | 后续图片拖拽上传，当前仅安装 |
| lucide-react、sonner | 图标、通知 |
| tailwindcss、@tailwindcss/vite | Tailwind v4 与构建集成 |
| radix-ui、class-variance-authority、cn | CLI 生成组件的交互、样式变体与类名合并 |
| shadcn、tw-animate-css、@fontsource-variable/geist、next-themes | CLI 主题样式、动画、本地字体和生成的通知组件依赖 |

已有 `@types/node`，未重复安装。保留原 React / Vite / TypeScript 版本约束；未安装 Three.js、状态库、Axios 或测试框架。

## 请求与状态约定

`src/lib/http.ts` 导出 `http.request<T>(path, options)`、`createHttpClient` 和 `ApiError`。

- `method` 支持 fetch 的方法；`json` 自动序列化并补充 Content-Type；`body` 接受 FormData 等 BodyInit，二者不能同时指定。
- 保留自定义 headers；FormData 默认不设置 Content-Type，由浏览器补充 boundary。
- 默认超时 15 秒，支持 `timeoutMs` 与 `signal`；区分网络、超时、取消、HTTP 和无效 JSON。
- 空响应 / 204 返回 undefined，JSON 返回完整结构，其余返回文本。泛型应来自正式接口契约；非 JSON 接口可指定 string，空响应可指定 void。
- ApiError 提供 status、message、可选 code、原始 payload；尚无后端错误契约，不猜测业务码或自动剥离响应。
- 通过 `createHttpClient({ getAccessToken })` 注入 token 获取方法，不保存 token；显式 Authorization 优先。
- 不自动重试、不全局弹出错误、不自动跳转登录。查询缓存新鲜期 1 分钟、回收期 5 分钟，最多重试 1 次；401 / 403 / 取消不重试；mutation 不重试。

当前页面不执行任何业务请求。

## 文件变更

- 配置：`package.json`、`pnpm-lock.yaml`、`vite.config.ts`、`tsconfig.json`、`tsconfig.app.json`、`eslint.config.js`、`components.json`、`.env.example`、`index.html`。
- 入口与样式：`src/main.tsx`、`src/App.tsx`、`src/index.css`；移除演示用 `src/App.css`。
- 应用：`src/app/{router,providers,error-page}.tsx`。
- 共享布局：`src/components/layout/{app-layout,empty-panel,auth-placeholder}.tsx`。
- 页面：`src/features/auth/pages/{login-page,register-page}.tsx`、`src/features/generation/pages/studio-page.tsx`、`src/features/works/pages/works-page.tsx`。
- 基础设施：`src/lib/{utils,env,http,query-client}.ts`、`src/types/vite-env.d.ts`。
- CLI 生成的 17 个 UI 组件：button、input、label、card、tabs、separator、tooltip、dialog、alert-dialog、dropdown-menu、select、slider、switch、progress、badge、skeleton、sonner。
- 文档与图标：`README.md`、`public/formaspace.svg`。已有设计资源保留。

ESLint 仅对生成组件的 buttonVariants、badgeVariants、tabsListVariants 放行 Fast Refresh 导出限制，业务规则保持原配置。

## 验证

- `pnpm lint`、`pnpm build` 通过，`pnpm dev` 正常启动。
- 本地 Chromium 检查 320 / 375 / 768 / 1440px 下的首页跳转、登录、注册、作品与 404；页面无横向溢出，深色主题、导航、Button 和通知正常，无控制台错误，无业务 API 请求。
- 临时浏览器脚本验证请求 JSON、headers、token 注入、FormData、204、空响应、文本、HTTP 错误、无效 JSON、网络错误、超时、取消和重试策略；检查未连接真实服务，未向工程添加测试依赖。

## 部署与下一阶段

部署时为前端页面路由配置回退到 `index.html`，API 路径必须先匹配后端，不能回退到前端 HTML。实际代理与托管配置待部署环境确定。

尚未实现真实登录注册、验证码、模型生成、上传、任务历史、作品数据或完整点云场景。下一阶段按确认的设计稿完善页面，再按后端契约接入接口；Three.js 场景届时通过 lazy/Suspense 加载。

shadcn 配置参考：[官方 Vite 安装说明](https://ui.shadcn.com/docs/installation/vite)。
