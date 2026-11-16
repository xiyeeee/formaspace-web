# 登录页与账号接口对接

本轮以用户“完成登录页搭建、完成接口对接”为范围。`skills/web1.0.3.md` 中“只做演示、不接接口”与本轮请求冲突，采用其视觉规范，提交行为按真实接口实现，不生成演示 Token。

## 实现

- `/login`：独立的深色沉浸布局、形境品牌、半透明面板、账号 / 密码表单、显示密码、错误和提交状态、注册入口。
- Three.js + React Three Fiber 9，兼容当前 React 19。18,000 点的扭转曲面环带由缓存采样生成，shader 与 useFrame 更新，不逐帧修改 React 状态；最大 DPR 1.5，无阴影或后期处理。
- 场景与账号页面按需加载；移动端使用相同曲面的 SVG 静态投影；减少动效时停止连续运动和扰动；页面隐藏暂停渲染；WebGL 创建失败或上下文丢失时降级。没有使用设计稿截图作为背景。
- `/register`：邮箱、用户名、6 位验证码字符串、密码、确认密码；注册成功返回登录页并以路由 state 预填邮箱，不自动登录。
- 验证码先独立校验邮箱；发送成功显示后端消息，重发时间取后端值；编辑邮箱清除已填验证码，重发等待与发送邮箱关联。使用截止时间计算倒计时。
- 登录账号只 trim 和校验非空 / 最大长度；密码不 trim。注册密码校验 8–64 字符，用户名 3–32 位 ASCII 字母 / 数字 / 下划线；邮箱与后端 ASCII 限制对齐。
- `/studio`、`/works` 需要服务端确认的登录状态，保留原页面占位内容。
- Token 使用内存 + sessionStorage，不缓存用户资料。刷新仅在存在 Token 时请求 `/me`；checking / authenticated / anonymous / error 四种状态分开，网络失败保留 Token 并提供重试 / 退出。
- 退出取消恢复请求、清理 Token、用户与查询缓存。不请求不存在的 logout / refresh / reset 接口。
- 公开请求不带 Authorization；受保护请求读取当前会话。并发 401 通过认证 revision 只失效一次，旧会话请求不能清除新会话。
- 登录跳转只接受 `/studio`、`/works` 白名单，其他 redirect 值回到工作台。

## 以实际后端代码核对的契约

当前后端没有 `docs/auth-api.md`，`README.md` 与 `docs/auth-plan.md` 的“未实现”描述也落后于现有 Controller；本轮直接核对 `AuthController`、DTO / VO、`ErrorCode` 与安全配置，未改动后端正在进行的工作。

| 接口 | 请求 / 行为 |
| --- | --- |
| POST `/api/auth/email-codes` | `{email,purpose:'REGISTER'}`，200，data 为 retryAfterSeconds |
| POST `/api/auth/register` | 五字段 JSON，201，data 为 UserVO，无 Token |
| POST `/api/auth/login` | `{account,password}`，200，data 为 accessToken / tokenType / expiresIn / user |
| GET `/api/auth/me` | Bearer Token，200，data 为 UserVO |

`src/lib/http.ts` 保留通用响应处理；`src/lib/api-client.ts` 才校验 `{code,message,data}`，要求 code=OK，并通过业务 schema 校验后返回 data。HTTP 错误保留响应头和 payload，业务错误适配为 ApiError；不猜测其他接口格式。

文档与代码差异：

- 参数错误实际为 `INVALID_ARGUMENT`，冲突为 `CONFLICT`，鉴权失效为 `UNAUTHORIZED`，权限错误为 `FORBIDDEN`。
- 后端 LoginDTO 对密码还有 8–64 长度校验；前端登录按登录页规范只校验非空，后端若拒绝则显示参数错误。注册校验与后端一致，不静默修改密码。
- 后端对账号 / 邮箱会规范化为小写，前端仅按文档 trim 邮箱和登录账号，不改写邮箱内部内容。
- 后端验证码默认有效期为 5 分钟；前端不硬编码有效期或重发秒数。
- 后端会写 Retry-After，但当前 CORS 未配置 exposedHeaders。开发同源代理可读取；生产若跨域直连，需要后端暴露 Retry-After。读不到时不编造等待时间。

## 本地接入

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite 根据后端 `application.yml` 的默认监听地址，将 `/api` 代理至 `http://127.0.0.1:8080`，不 rewrite 前缀。可在 `.env.local` 配置仅供 Vite 使用的 `API_PROXY_TARGET`；`.env.example` 提供示例。更改后需重启 dev server。

`VITE_API_BASE_URL=/api`。生产环境需为 `/api` 配置真实反向代理，并为前端页面配置 index.html 回退。Cookie credentials 为 omit，不请求 CSRF。

## 本轮验证与边界

按用户要求仅执行必要检查，没有引入测试框架或实现运行时 Mock 开关。

- `pnpm lint`、`pnpm build` 通过。构建仍提示大 chunk：Three.js 场景已单独懒加载，未为消除警告更换渲染方案或屏蔽提示。
- 本地 Chromium 简短检查登录页、手机布局、空值提示、密码切换；临时浏览器拦截响应验证登录、me 恢复、退出、发送验证码与邮箱变更清码。这些属于隔离响应检查，不代表真实后端联调。
- 按用户要求未进行线上联调，也未发送真实邮件或创建账号。后端实际运行后的数据库 / SMTP / JWT 全流程与错误分支回归留待用户验证。
- 截图：`docs/previews/login-desktop.png`、`login-mobile.png`、`register-mobile.png`。
- 上传、模型生成、找回密码、验证码登录、第三方登录、用户协议页面均未扩展。

## 修改位置

- 路由 / Provider：`src/app/router.tsx`、`src/app/providers.tsx`。
- 业务布局：`src/components/layout/app-layout.tsx`（用户信息与退出）。
- 账号页面：`src/features/auth/pages/`。
- 表单 / 视觉 / 守卫：`src/features/auth/components/`、`src/features/auth/auth.css`。
- 接口 / 会话 / 校验 / 几何：`src/features/auth/lib/`、`src/features/auth/types.ts`。
- 请求边界：`src/lib/http.ts`、`src/lib/api-client.ts`。
- 配置 / 依赖：`vite.config.ts`、`.env.example`、`package.json`、`pnpm-lock.yaml`。

已有 skills 文件的重命名和新增保留，不擅自恢复或提交。

Three Fiber 版本搭配参考：[官方安装说明](https://r3f.docs.pmnd.rs/getting-started/installation)。
