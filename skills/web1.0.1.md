# FormaSpace 前端实施文档 · 第一步：基础工程初始化

## 目标与范围

项目名称：形境 · FormaSpace。前端目录：formaspace-web。
已有 Vite + React + TypeScript 项目，在现有工程上修改，不重新创建。
本阶段完成依赖、样式、路由、请求基础和页面占位，为下一步登录注册及首页设计提供可运行的基础。不实现真实登录，不连接模型服务，不制作完整点云动画。

## 1. 先检查现有工程

执行前读取 package.json、pnpm-lock.yaml、vite.config.ts、tsconfig*.json 和 src 目录。
确认 Node 满足当前 Vite 的 engines 要求，确认 React 与后续 Three Fiber 版本兼容。
保留现有有效配置及用户代码，不盲目覆盖文件，不无故升级 React、Vite 或 TypeScript。
使用 pnpm，保留 pnpm-lock.yaml，不混用 npm/yarn 锁文件。已有依赖无需重复添加。
以下样式步骤按 Tailwind CSS v4 编写；如工程已有 v3，先说明现状及迁移影响，不混合两版配置。

## 2. 安装依赖

在 formaspace-web 目录执行：

```bash
pnpm add react-router @tanstack/react-query react-hook-form zod @hookform/resolvers lucide-react sonner react-dropzone
pnpm add tailwindcss @tailwindcss/vite
pnpm add -D @types/node
```

依赖职责：

| 依赖 | 职责 |
|---|---|
| react-router | 客户端页面路由 |
| @tanstack/react-query | 服务端数据缓存、请求状态及后续任务轮询 |
| react-hook-form、zod、@hookform/resolvers | 登录注册及参数表单校验 |
| lucide-react | 界面图标 |
| sonner | 全局通知 |
| react-dropzone | 后续图片拖拽上传 |
| tailwindcss、@tailwindcss/vite | Tailwind v4 样式与 Vite 集成 |

3D 依赖留到开始实现视觉场景时安装：

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

安装前检查 peerDependencies，选与现有 React 兼容的版本，不使用 --force 或忽略兼容性报错。
本阶段不需要 Zustand、Axios、Redux 或额外动画库；请求先用 fetch。

## 3. 配置 Tailwind 和路径别名

在现有 vite.config.ts 中合并以下配置，保留已有插件：

```ts
import { fileURLToPath, URL } from "node:url"
import tailwindcss from "@tailwindcss/vite"

// defineConfig 内：
plugins: [react(), tailwindcss()],
resolve: {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
},
```

在 tsconfig.json 以及实际用于 src 编译的 tsconfig.app.json 的 compilerOptions 中合并：

```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

在 src/index.css 引入：

```css
@import "tailwindcss";
```

确认 main.tsx 引入该样式。清理 Vite 演示样式中的居中布局、根节点最大宽度及默认按钮样式，避免影响全屏工作台。

## 4. 初始化 shadcn/ui

完成 Tailwind 和别名后运行：

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card tabs separator tooltip dialog alert-dialog dropdown-menu select slider switch progress badge skeleton sonner
```

选择适合深色界面的中性色基础，启用 CSS variables。
如 CLI 选项变化，按当前官方提示操作；不要重新创建项目。
使用 CLI 生成的组件及其所需依赖，不手动伪造同名组件。
核查 components.json、src/lib/utils.ts、src/components/ui 及全局 CSS。
CLI 会写入主题变量与相关导入，后续编辑不要用一段简化 CSS 覆盖它们。
通过语义变量 background、foreground、primary、muted、border 统一配色。

## 5. 业务目录

按实际需要创建文件，不生成大量空文件：

```text
src/
├── app/
│   ├── router.tsx
│   └── providers.tsx
├── features/
│   ├── auth/pages/
│   │   ├── login-page.tsx
│   │   └── register-page.tsx
│   ├── generation/pages/studio-page.tsx
│   ├── works/pages/works-page.tsx
│   └── viewer/
├── components/
│   ├── ui/
│   └── layout/
├── lib/
│   ├── utils.ts
│   ├── env.ts
│   ├── http.ts
│   └── query-client.ts
├── types/
│   └── vite-env.d.ts
├── main.tsx
└── index.css
```

若 Vite 已有 src/vite-env.d.ts，保留原文件并在其中补充类型，无需另建重复文件。
业务类型靠近业务放置，types 只容纳真正共享的类型。

## 6. Provider 与路由

使用 createBrowserRouter 和 RouterProvider，统一从 react-router 导入。
QueryClient 在组件外创建，Provider 统一装配；挂载一个全局 Toaster。
保留 React.StrictMode，添加基本错误页面，页面导出方式保持一致。

| 路径 | 行为 |
|---|---|
| / | 跳转 /studio |
| /login | 登录页占位 |
| /register | 注册页占位 |
| /studio | 生成工作台占位 |
| /works | 我的作品占位 |
| 其他路径 | 404 页面 |

此时不加虚假鉴权守卫，不生成演示 token。所有占位页面可直接访问，并提供可点击导航。
生产环境使用 BrowserRouter 时，需要部署端将前端页面路径回退到 index.html，API 路径不能回退。
登录页和工作台不能静态导入 Three.js 场景；下一阶段通过 lazy/Suspense 按需加载。

## 7. 环境变量与请求封装

新增 .env.example：

```dotenv
VITE_APP_NAME=FormaSpace
VITE_API_BASE_URL=/api
```

VITE_ 变量会暴露给浏览器，禁止放腾讯密钥、JWT 签名密钥、邮箱密码等秘密。
本地私有配置放 .env.local 并确认被 git 忽略。
实际后端地址尚未确认，不凭空填写服务器或代理地址；需要代理时用实际后端地址配置。

实现类型化 fetch 封装：

- 支持 GET、POST 等方法、JSON、FormData、AbortSignal 和合理的超时。
- JSON 请求才自动设置 Content-Type；FormData 让浏览器生成 multipart boundary。
- 正确处理 204、空响应、非 JSON 响应、HTTP 错误和网络错误。
- 暴露统一的 ApiError（status、message 及可选业务码）。
- 保留传入 headers；不在控制台记录密码、验证码或 token。
- 后端响应结构尚未提供，不假定一定是 code/data/message，也不擅自剥离响应。
- 为后续 Authorization: Bearer token 留出可注入入口，本阶段不决定持久化策略、不实现刷新 token。
- 登录和发送验证码等 POST 请求不自动重试；401 处理避免循环跳转和重复通知。

QueryClient 设置温和的缓存策略，查询失败最多有限重试；401/403 不重试，mutation 默认不重试。
暂不发送任何真实业务接口请求，也不在页面加载时制造请求失败提示。

## 8. 基础视觉

使用深色主题，产品名称统一 FormaSpace / 形境。
工作台预留：左侧上传参数、中间预览区域、右侧任务历史。
登录页预留：左侧视觉场景、右侧表单区域。
本阶段只做简洁占位和布局骨架，完整效果以第二阶段设计稿为准。
小屏允许面板堆叠，不出现横向溢出；按钮具备焦点样式和可访问名称。
设置 prefers-reduced-motion 支持，为后续粒子动效准备降级方式。
没有安装或提供 UI UX Pro Max 时，不宣称已调用该能力，也不要阻塞工程初始化。

## 9. 验收

执行现有工程提供的检查：

```bash
pnpm lint
pnpm build
pnpm dev
```

如没有 lint 脚本，说明缺失并使用现有检查工具，不伪造检查结果。
通过本地浏览器确认：

- 登录、注册、工作台、作品页面可打开、导航正常。
- 未知地址显示 404；深色主题、Tailwind、shadcn Button 和通知可正常渲染。
- 无 Vite 默认布局残留，无横向溢出，无控制台异常。
- 不产生真实登录或生成请求，不伪造已完成的业务功能。

完成后输出：修改文件列表、依赖及用途、检查结果、尚未完成事项。
本阶段不需要引入测试框架。

## 可直接发给 AI 的执行指令

请在当前 formaspace-web 项目中，按照本文完成第一阶段基础工程初始化。先读取并判断现有配置，再进行最小必要修改。直接落实依赖、Tailwind、shadcn/ui、别名、目录、Provider、路由、环境变量示例及 fetch 封装。页面仅完成可导航占位，不做完整设计和真实业务。保留用户已有代码，处理版本兼容，不使用 --force。最终执行 lint/build 并如实报告结果。

## 后续第二步

读取已确认的设计稿，实现登录注册和首页工作台；加入交互点云、图片上传及明确标注的模拟生成流程，再根据后端接口文档接入真实鉴权和任务数据。

## 官方参考

- shadcn/ui + Vite：https://ui.shadcn.com/docs/installation/vite
- React Router：https://reactrouter.com/start/declarative/installation

整理日期：2026-11-16。安装时以现有工程版本与依赖兼容要求为准。

