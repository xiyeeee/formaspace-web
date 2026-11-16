# 形境 · FormaSpace

React 19 + TypeScript 6 + Vite 8，使用 Tailwind CSS v4、shadcn/ui 与 React Router 7。当前已完成基础工程、沉浸式登录页和四个账号接口的前端对接；上传和生成工作台仍为占位。

## 运行

使用 pnpm 10，Node 满足 `^20.19.0 || >=22.12.0`（当前验证 Node 20.20.2）。

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm build
```

开发默认将 `/api` 原样代理到后端默认地址 `http://127.0.0.1:8080`。可以复制 `.env.example` 为 `.env.local` 并调整 `API_PROXY_TARGET`，随后重启开发服务。`*.local` 已被忽略；`VITE_` 变量公开给浏览器，不得放服务端秘密。

## 页面与鉴权

- `/login`：点云环带背景、用户名或邮箱登录、密码显示、表单校验与错误反馈。
- `/register`：邮箱验证码和五字段注册；注册后返回登录页。
- `/studio`、`/works`：登录后访问，当前为布局占位。
- `/`：转工作台；未知地址显示 404。
- 刷新通过 `/api/auth/me` 验证会话；失败可重试。退出只清理前端状态，不调用虚构接口。

Token 使用内存 + sessionStorage，不保存密码、验证码或用户资料；sessionStorage 可被同源脚本读取，不等价于安全 Cookie，不承诺跨标签页同步退出。

## 工程约定

- `@/` 别名在 Vite 和 TypeScript paths 中同步；TypeScript 6 不再增加已弃用的 baseUrl。
- CLI 生成的 shadcn 组件位于 `src/components/ui/`，保持主题变量。业务代码复用既有组件。
- `http.request` 处理通用 fetch、FormData、超时 / 取消和 HTTP 错误；`apiRequest` 适配统一后端响应，账号 API 统一返回解包后的 data。
- 查询新鲜期 1 分钟、回收期 5 分钟，最多重试 1 次；401 / 403 / 取消不重试，mutation 不重试。
- Three.js 场景单独懒加载；移动端、减少动效与 WebGL 不可用提供降级。新增依赖仅 three、@react-three/fiber 9、@types/three，与 React 19 配对。

接口核对、修改文件、实际契约差异、截图与验证边界见 [账号对接说明](docs/auth-integration.md)。按用户要求未进行线上联调，临时浏览器拦截测试不代表真实邮件或账号流程已联调成功。

生产环境需为 `/api` 配置真实反向代理；前端页面路由回退到 index.html，API 路径不能回退。跨域直连需精确 CORS，并由后端暴露 Retry-After。

登录页现为龙卷风 → 水母群 → 河流与小船 → 宇航员挥手的连续点云变形，见 [形态变换说明](docs/particle-morph.md)。虹彩流体作为轻量辅助保留，浅色独立预览见 `/effects/fluid-cursor`。
