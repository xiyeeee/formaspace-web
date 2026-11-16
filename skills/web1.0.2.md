# FormaSpace 前端账号接口对接文档

> 状态：根据《FormaSpace-Step-02-Auth.md》编写的前后端约定，尚未核对后端实际代码或完成联调。后端实现后以项目生成的 docs/auth-api.md 为准，发现差异先核对再接入，不用静默兼容掩盖问题。
>
> 可直接交给前端 AI：在现有 React + TypeScript 项目中实现本文功能，沿用已有路由、状态管理、请求库与 UI 组件，不重复搭建工程，不改动无关页面。保持现有设计稿风格。

## 1. 范围

完成注册页、登录页、当前用户恢复、受保护路由、退出与异常反馈。

本轮只有四个账号接口。不实现找回密码、刷新 Token、第三方登录、用户资料编辑；不要为未实现按钮请求不存在的接口。上传和模型生成后续对接。

注册五个字段：邮箱、用户名、邮箱验证码、密码、确认密码。注册成功后进入登录页，不自动登录。登录两个字段：用户名或邮箱、密码。

## 2. 通信约定

| 项目 | 约定 |
| --- | --- |
| 开发后端 | 示例 http://localhost:8080，实际以配置为准 |
| API 前缀 | /api，只拼接一次 |
| 请求类型 | JSON，Content-Type: application/json |
| 登录凭证 | Authorization: Bearer <accessToken> |
| Cookie | 不依赖登录 Cookie，不开启 withCredentials |
| CSRF | 无需先获取 CSRF Token |
| ID | 字符串，不转成 Number |
| 时间 | ISO 8601 UTC，展示时转为用户本地时间 |
| 成功判断 | HTTP 2xx 且 code === 'OK' |

建议前端环境变量 VITE_API_BASE_URL=/api。开发时由 Vite 把 /api 代理到后端，保留 /api 前缀，不错误 rewrite。生产可由反向代理提供同源 /api；跨域直连则由后端配置精确 CORS 来源。

VITE_ 变量会进入浏览器，不能放 JWT 签名密钥、SMTP 密码或验证码摘要密钥。

统一响应：

```ts
export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
}

export interface UserVO {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatarUrl: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export interface SendEmailCodeRequest {
  email: string;
  purpose: 'REGISTER';
}
export interface EmailCodeSendVO { retryAfterSeconds: number }

export interface RegisterRequest {
  email: string;
  username: string;
  verificationCode: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest { account: string; password: string }
export interface LoginVO {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // 秒
  user: UserVO;
}
```

失败时 data 可为 null；网络断开、代理错误可能没有标准 JSON，错误处理必须能兜底，不能盲目读取 response.data.message。

## 3. 发送注册验证码

POST /api/auth/email-codes，公开，不附带 Authorization。

```json
{"email":"example@qq.com","purpose":"REGISTER"}
```

成功 HTTP 200：

```json
{"code":"OK","message":"如可处理，验证码将发送至该邮箱，请查收","data":{"retryAfterSeconds":60}}
```

前端行为：

1. 只校验邮箱格式，不要求先填写其他注册字段。
2. 请求期间禁用发送按钮，防止重复点击。
3. 成功后显示后端提示，根据 retryAfterSeconds 开始重发倒计时，不硬编码为 60 秒。
4. 使用截止时间计算剩余秒数，避免后台标签页定时器暂停导致漂移；卸载时清理定时器。
5. 倒计时与发送时使用的邮箱绑定。编辑邮箱后清空已填验证码；不得把旧邮箱的发送状态当成新邮箱已验证。后端仍有 IP 和邮箱限流。
6. 失败不得显示发送成功。超时意味着结果未知，提示稍后查看邮箱或重试，不自动连续重发。
7. 429 根据 Retry-After 秒数禁用重试；跨域读取该头需要后端 Access-Control-Expose-Headers: Retry-After。读不到时给出通用稍后重试提示，不编造等待时间。

验证码是 6 位数字字符串，可能以 0 开头。输入使用文本类型，可设置 inputMode="numeric"、autoComplete="one-time-code"，禁止转数字。默认 5 分钟有效，以后端配置为准；重发后旧码失效。

发送响应不能用于判断邮箱是否已注册，不实现“这个邮箱一定存在/不存在”的推断。

## 4. 注册

POST /api/auth/register，公开，不附带 Authorization。

```json
{
  "email":"example@qq.com",
  "username":"xiye",
  "verificationCode":"012345",
  "password":"example-password",
  "confirmPassword":"example-password"
}
```

成功 HTTP 201，ApiResponse<UserVO>。响应没有 JWT。

字段规则：

| 字段 | 前端校验 |
| --- | --- |
| email | 必填，合法邮箱；去首尾空白，不擅自改写邮箱内部内容 |
| username | 必填，3～32 位，正则 ^[A-Za-z0-9_]{3,32}$ |
| verificationCode | 必填，正则 ^[0-9]{6}$ |
| password | 必填，8～64 字符；不 trim，不强制大小写与特殊符号组合 |
| confirmPassword | 必填，与 password 完全一致 |

用户名唯一性大小写不敏感，由后端最终判断。昵称不单独要求注册输入，默认使用用户名。

提交时禁用按钮并显示 loading，等待请求结束再恢复。成功提示“注册成功，请登录”，跳转 /login，可用非持久化路由状态预填账号；不把密码、验证码放进 URL 或浏览器存储。

失败保留便于修正的表单内容。验证码过期提示重新发送，不清空所有字段。注册请求不要自动重试；网络中断可能发生在后端已成功创建账号之后，应提示尝试登录确认。

## 5. 登录

POST /api/auth/login，公开，不附带旧 Authorization。

```json
{"account":"xiye","password":"example-password"}
```

account 也可填邮箱。前端只要求 account 非空并去首尾空白，不对它一律施加邮箱校验。password 不 trim，不在登录时套用只适合注册的用户名格式规则。

成功 HTTP 200：

```json
{
  "code":"OK",
  "message":"success",
  "data":{
    "accessToken":"<JWT>",
    "tokenType":"Bearer",
    "expiresIn":7200,
    "user":{
      "id":"123",
      "email":"example@qq.com",
      "username":"xiye",
      "nickname":"xiye",
      "avatarUrl":null,
      "status":"ACTIVE",
      "createdAt":"2026-11-16T02:00:00Z"
    }
  }
}
```

保存 Token 和用户状态，再跳转站内目标页或首页。expiresIn 单位为秒，7200 只是默认示例。前端时间只用于体验优化，后端是否接受 Token 才是最终依据。

账号不存在、密码错误、账号禁用统一为 HTTP 401 / INVALID_CREDENTIALS，页面展示“账号或密码错误”。这是登录表单错误，不触发全局登录失效跳转。

## 6. 获取当前用户

GET /api/auth/me，无请求体，必须携带 Authorization。

成功 HTTP 200，ApiResponse<UserVO>。前端禁止把本地缓存用户资料当成已通过身份验证。

刷新页面后的流程：

1. 没有 Token：直接进入匿名状态，不请求 me。
2. 有 Token：进入 checking 状态，请求 me，避免页面闪现登录页。
3. me 成功：更新用户状态，进入 authenticated。
4. me 返回 401：清理登录状态，进入 anonymous。
5. me 网络错误或 503：显示加载失败和重试，不误判为凭证失效，也不显示受保护数据。

请求完成前退出或切换账号时，必须取消或忽略旧的 me 响应，避免把退出后的状态重新设为已登录。可使用 AbortController 或认证状态版本号。

## 7. Token 状态与存储

第一版建议 accessToken 使用内存 + sessionStorage：支持当前标签页刷新恢复，通常关闭标签页后结束，不提供“记住我”。这属于前端新增建议，不是后端强制约定；若项目已经有明确策略，先核对再统一。

- sessionStorage 中的 Token 能被同源 JavaScript 读取，无法抵御 XSS；不要误写成安全 Cookie 等价物。
- 不存储密码、验证码；不把 Token 放 URL、埋点、console、错误上报或持久化调试快照。
- 受保护请求发送前从认证模块读取当前 Token，避免拦截器捕获旧值。
- 不需要前端解 JWT 才能鉴权；如读取 exp，只用于界面提示，不能当成服务端验证。
- 退出清空内存、sessionStorage、用户信息及当前用户的请求缓存，跳转登录页。
- 没有后端 logout 或 refresh 接口，不请求、不伪造。
- 前端退出不能撤销被复制的 Token；Token 过期重新登录。
- sessionStorage 不提供可靠的跨标签页退出同步，本轮不承诺该行为。

## 8. 请求封装和 401

使用项目已有 Axios 或 fetch；不要两套并存。请求层应显式区分 public 和 protected 请求，而不是按所有 /auth 路径一刀切。

| 请求 | Authorization | 401 处理 |
| --- | --- | --- |
| email-codes、register、login | 不添加 | 页面内展示错误 |
| me 和后续业务接口 | 添加 | 当前认证失效时统一清理、跳转 |

要求：

- 设置合理超时，区分网络失败和业务失败。
- 对外 API 函数统一返回解包后的 data，或统一保留 ApiResponse，选择一种并明确；建议返回 data，避免页面混用 response.data.data。
- 即使 HTTP 2xx，code 不是 OK 也按失败处理。
- 多个请求同时 401，只清理和提示一次；在登录页不重复跳转。
- 旧 Token 请求晚到的 401，不能清掉用户刚登录得到的新 Token；按请求使用的 Token/认证版本判断。
- 登录、注册、发送验证码等 POST 不自动重试，不写刷新 Token 队列。
- 如保留 redirect 参数，只接受受保护的站内相对路径；拒绝外部 URL、//、反斜线和编码绕过。优先使用已知路由白名单，避免开放重定向。
- CORS、网络断开和代理 502 可能拿不到后端 JSON，提供通用错误；不把它们都提示成密码错误。

## 9. 错误处理表

部分错误码在后端实施文档中尚未固定，表内已注明，联调前对照 docs/auth-api.md 确认。

| HTTP / code | 页面处理 |
| --- | --- |
| 400 / VALIDATION_ERROR（待确认具体码） | 展示字段错误或 message；不假设已有 fieldErrors 结构 |
| 400 / VERIFICATION_INVALID | 验证码无效或已过期，允许重发 |
| 401 / INVALID_CREDENTIALS | 登录页显示账号或密码错误 |
| 401 / 鉴权失败码待确认 | 受保护请求按当前认证版本清理状态 |
| 403 / 权限码待确认 | 提示无权访问，不能一律退出登录 |
| 409 / 重复账号码待确认 | 展示邮箱或用户名冲突提示 |
| 429 / RATE_LIMITED | 显示重试等待，避免连续提交 |
| 503 / MAIL_UNAVAILABLE | 提示邮件服务暂不可用 |
| 503 / 其他服务故障码待确认 | 稍后重试，不清除有效登录 |
| 500、非 JSON、无响应 | 通用失败提示，允许用户重试 |

## 10. 前端文件建议

按已有结构适配，避免重复安装依赖和复制 UI：

```text
src/
  api/auth.ts
  types/auth.ts
  lib/http.ts
  features/auth/
    auth-store.ts
    token-storage.ts
    LoginForm.tsx
    RegisterForm.tsx
    useEmailCodeCountdown.ts
  routes/RequireAuth.tsx
```

已有 Zustand、Context、React Router、表单库时直接复用。未安装时选最少必要方案，不为四个接口堆叠依赖。

路由守卫至少区分 checking、authenticated、anonymous、恢复失败待重试，不能用单个 isLoggedIn 布尔值表示所有状态。默认业务首页路径以现有路由为准，不硬编码不存在的 /dashboard。

表单应有 label、键盘操作、提交 loading、错误提示与密码显示切换。密码字段允许粘贴和密码管理器；登录密码 autocomplete=current-password，注册密码与确认密码使用 new-password，用户名使用 username。

## 11. 联调检查

- 五项注册校验与确认密码一致性。
- 验证码前导零不丢失，重发倒计时与邮箱变更正确。
- 注册成功后不直接进入已登录状态。
- 用户名、邮箱两种登录都可用。
- 受保护请求携带正确请求头，公开请求无旧 Token。
- 刷新恢复由 me 校验，加载时无页面闪跳。
- 错误密码不产生循环跳转；并发 401 只处理一次；旧请求不破坏新登录。
- 网络错误和 503 不误删 Token，退出清理当前用户缓存。
- Token 过期后重新登录；没有 refresh、logout、csrf 或未实现 password/reset 请求。
- 429 可恢复，跨域可读取 Retry-After。
- 构建、TypeScript 检查通过；后端不可用时明确未完成真实联调。
- Mock 如有必须显式开发开关且默认不冒充真实后端；交付时标清真实与模拟测试。

完成后输出修改文件、实际接口差异、验证结果与未完成项。不要因为页面能跳转就声称账号流程已联调成功。
