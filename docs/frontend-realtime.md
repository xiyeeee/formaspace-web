# 工作台实时进度与中间点云

## 实现范围与当前契约差异

仅修改 React / TypeScript 前端，没有修改 Java 或 Python，也没有改变图片上传、创建任务、作品与模型下载接口。

已读取邻近 Java 仓库最新 `docs/frontend-realtime-api.md`。该文档明确浏览器侧 `/api/ws/tickets` 和 `/ws/generation` 尚未实现，目前只有 Java↔Python 实时消费、内部事件、受保护点云 HTTP 恢复及任务详情的实时字段。浏览器目标协议与用户文档一致，但尚不是当前已部署行为。

因此默认 `VITE_GENERATION_WS_ENABLED=false`，不调用未实现的票据或 WS，使用当前真实 HTTP 字段和点云接口。后端部署票据与浏览器 WS 后，设置 `VITE_GENERATION_WS_ENABLED=true` 并重启前端即可启用已完成的客户端。隔离 WS 测试使用独立开发进程显式开启此开关；默认没有前端 mock，不直连 Python，不读取推理实例 ID、本地路径或服务令牌。

当前 HTTP 与目标 WS 的明确差异在边界处理：HTTP `saving_result` 映射为页面 `result_saving`；HTTP 七种连接状态分别展示，WS 仍严格校验 CONNECTED/RECONNECTING/DISCONNECTED 三种；HTTP 无浏览器序号，不能冒充 WS 快照。旧 HTTP 阶段未知时忽略该阶段字段、保留业务任务；采样总数 0 也不会拒绝整个任务或显示 0/0 百分比。公开 `PYTHON_REALTIME` 模式已纳入解析。

启用 WS 后若 ticket 返回 404，明确提示“实时接口尚未部署，正在定时查询任务状态”，继续 HTTP 轮询，不显示为已连接。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `src/features/generation/lib/realtime/protocol-values.ts` | 共用阶段、推理连接状态与预览元数据契约 |
| `src/features/generation/lib/realtime/generation-events.ts` | Zod 联合类型、消息大小/坐标/步数/地址校验、序号跟踪与点云转换 |
| `src/features/generation/lib/realtime/realtime-api.ts` | 一次性票据、带 JWT 点云恢复、同 Java 来源的安全 WS URL |
| `src/features/generation/lib/realtime/websocket-client.ts` | 单连接、订阅、心跳、退避重连、关闭码与可见性处理 |
| `src/features/generation/lib/realtime/generation-realtime.ts` | 当前任务状态、快照协调、点云下载/重试、终态去重与 HTTP 状态协调 |
| `src/features/generation/hooks/use-generation-realtime.ts` | React / StrictMode / 当前用户生命周期与外部状态订阅 |
| `src/features/generation/components/point-cloud-preview.tsx` | 原始坐标 BufferGeometry、Points、两层交叉淡化及 GPU 资源释放 |
| `src/features/generation/components/generation-realtime-status.tsx` | 分别展示浏览器↔Java、Java↔Python 连接状态及恢复入口 |
| `src/features/generation/components/model-viewport.tsx` | 分阶段进度、真实/演示点云标识、最终模型加载与失败区分 |
| `src/features/generation/components/viewport-scene.tsx` | 共用相机、轨道控制、点云与 GLB 容器变换 |
| `src/features/generation/hooks/use-task-query.ts` | 实时稳定后停轮询，失联时恢复，首次详情失败仍可退避重试 |
| `src/features/generation/pages/studio-page.tsx` | 创建后的订阅、当前任务派生状态、结果协调与退出清理 |
| `src/features/generation/components/task-history.tsx` | 选中任务以协调后的状态呈现，旧历史响应不回退该卡片 |
| `src/features/generation/types.ts` | 增加 PYTHON_REALTIME；按实际 Java VO 可选读取 stage、completedSteps、totalSteps、latestPreview、connectionState |
| `src/features/generation/lib/generation-presentation.ts` | 实时生成模式标识 |
| `src/features/generation/workbench.css` | 连接提示、采样阶段进度布局 |
| `vite.config.ts`、`.env.example` | 保留 HTTP 代理，为 `/ws` 新增 `ws:true` 与部署说明 |

## 协议与连接

- 使用现有受保护请求层 `POST /api/ws/tickets`，读取 ticket / expiresIn / webSocketPath，票据不入查询缓存、持久化或日志。
- 只接受 `/ws/generation` 路径，以 API baseURL 的 Java 来源构建 WS URL，HTTPS 页面强制 wss。长期 JWT 仅在票据和 HTTP 请求头中使用。
- 原生 JSON 消息，不引入 STOMP、SockJS 或第二套鉴权。每个连接订阅一个任务；任务切换先退订并关闭旧连接，再用新票据订阅新任务。
- 心跳每 25 秒发 ping，匹配 requestId 的 pong 才清除 10 秒超时。后台暂停心跳与重连定时器，恢复可见时检查连接。过期票据不会被当成连接寿命。
- 重连指数退避并带抖动，间隔最大 30 秒，连续失败有界；新连接总是重新领取票据。1008/1009 停自动重试，1013 退避，4001 经 ticket HTTP 重新验证。1006 不清登录，401 由现有 revision 鉴权处理。
- 新订阅等待快照；增量旧序号忽略，缺号防抖退订/重订阅，反复缺号升级为新连接，持续异常停自动恢复。快照可跳号，同序号快照仍处理预览和结果恢复。
- 控制消息先分类，不要求 pong/error/connection_status 带 sequence。未知版本/类型、非法坐标、超过 2 MiB 的 WS 文本给出可读错误并保留 HTTP 查询。

## 进度与结果

真实步数仅显示“形状采样 24/30 · 80%”。30/30 后继续显示最终网格解码或保存阶段，不能提前成功。没有步数时使用不定进度。中间预览失败不将任务改成 FAILED；浏览器断线与 Java↔Python 断线分别展示。

WS 状态覆盖旧 HTTP 非终态，HTTP 终态不会被旧 WS 增量回退；实时终态协调已有任务和历史查询，不调用创建接口。重复完成事件不会产生多份模型请求。成功后沿用 assetId → 作品详情 → 带 JWT 的 GLB 接口；模型预览失败保留任务成功状态。

HTTP 详情的实时字段全部可选。若后端尚未部署浏览器 WS，但已经返回这些字段，轮询可展示真实步数，并经已存在的受保护点云接口恢复真实预览。不会假设详情必然包含它们，也不会从等待时间推算进度。

## 点云与坐标

- 每份预览 1～5000 点，每点恰好三个可表示为 Float32 的有限数字，pointCount 等于坐标数组长度。恢复响应还校验 taskId、版本、sourceStep、点数与通知一致。
- HTTP 地址由业务 taskId/version 构建，收到的 positionsPath 必须对应同一地址，不访问任意外部 URL。
- notifiedPreviewVersion 和 appliedPreviewVersion 分开记录。获取或校验失败不推进 applied；Points 实际绘制后才确认已展示版本。同版本可手动重试；旧下载不能覆盖新版本或其他任务。
- 第一份真实点云只计算一次任务容器变换，后续预览及 GLB 共用该变换、相机和轨道控制；原始坐标不改写，不逐次独立居中缩放。最终模型先到时沿用现有模型适配相机机制。
- 更新使用最多两层 Points 交叉淡化，不将同索引点强行插值。旧层淡出后释放 geometry/material，卸载清理全部层。减少动态效果时直接切换，后台停止渲染。
- 等待点云在真实坐标到达前保留，并明确标为示意；Mock 的中间点云和结果单独标为演示，不冒充真实推理。

## 验证

已执行 lint / TypeScript / Vite 构建。默认 HTTP 模式另外验证了不发票据请求、5000 点恢复、saving_result、七种推理连接状态及旧任务可空字段。显式启用 WS 的隔离 Chromium 仅在测试会话拦截 HTTP/WS，验证：

1. ticket + 首快照、控制消息和增量序号。
2. 未知版本、非法坐标、点数不匹配和超大文本拒绝。
3. 5000 点实际渲染及“采样阶段百分比”。
4. WS 稳定后停止高频轮询，缺号重订阅。
5. 中间预览非致命失败、HTTP 恢复失败、同序号快照重试成功。
6. 断线使用不同的新票据重连，不在 URL 携带 JWT。
7. Java↔Python 恢复消息不打断浏览器 WS。
8. 30/30 → 最终解码 → 保存 → task_completed 后才读取模型；重复读取去重，旧 HTTP 处理中不回退成功。
9. 票据 404 后不退出登录，恢复 HTTP 轮询和真实字段/点云读取。
10. 切换任务忽略旧帧，退出后没有继续领取票据。

测试数据和测试 GLB 不作为默认产品数据，没有向 Java/Python 发送推理请求。本轮未进行真实浏览器↔Java WS 全链路、跨用户订阅权限、生产 wss/代理、实际 25 秒心跳和高频持续预览压力验证。Java 票据与 WS 端点、独立浏览器序号与 Origin/归属校验仍是完整真实联调前置项；文档目前明确标记这些能力未实现。

## 2026-11-18 默认连接策略更新

Java 最新 frontend-realtime-api.md 已确认票据和浏览器 WS 实现，前端默认启用 WS。仅显式设置 VITE_GENERATION_WS_ENABLED=false 时关闭；原文关于后端未部署及默认关闭的说明为上一轮状态，已由本段取代。连接失败仍使用 HTTP 兜底。

## 仅 WebSocket 更新任务状态

按最新要求移除 HTTP 状态轮询与断线降级，不再从 HTTP 详情更新阶段、步数或预览。任务详情仅作一次初始化，终态由 WS 协调；断线只重连 WS，不定时请求任务详情。上传、创建任务、票据、点云恢复、作品和模型文件仍使用其正式 HTTP 接口。


## 多阶段真实预览（2026-11-18）

后端新任务默认三阶段：30 步在 12/18/24 步生成 1000/2500/5000 点（64/96/128）。六阶段 12/15/18/21/24/27（1000/1500/2500/3500/4500/5000 点）完整保留，Java 设置 `REALTIME_PREVIEW_STAGE_COUNT=6` 并重启即可用于新任务；默认值 3，仅允许 3 或 6。已有单版、三版、六版任务均按自己的持久计划继续，前端版本数没有三版上限，不需要切换配置。协议仍为 v1，浏览器按递增 previewVersion 替换，不假定固定点数、固定 sourceStep 或只有 version=1。普通阶段失败保留旧版，成功版连续编号；第一成功版可能来自后续阶段。HTTP 恢复路径不变，后端保留各成功版本。

新版分包未收齐时保留当前点云；收齐后用 KD 树做一次一对一近邻匹配，已经可见的旧点在约 0.75 秒内移动到新版真实点位，再以每秒 800 点补出未匹配的新点。保持单个点云对象，不再对旧点淡出，也不从零重新扫描整版。移动只是显示层过渡，不代表模型真实推理轨迹；最终点位完整覆盖后端真实新版，未匹配点不从零坐标生成。减少动态效果时直接替换。快速下一版从当前可见位置继续匹配，暂停时不推进动画，换任务及卸载时释放 GPU 资源。坐标归一化锁定首次预览，保留 OrbitControls 旋转/缩放，最终 GLB 加载后显示模型。过期版本/较旧 HTTP 请求不会覆盖新版，后到预览不将任务终态回退为 PROCESSING。

此前真实模型链路由 Java 原生 WS 客户端验证了三版、50 点分包、重连与最终 GLB。点位移动本轮通过 build/lint，并用临时 Playwright/Chromium 挂载实际 React/Three 组件、输入此前真实的三版点云验证：等待分包时旧 1000 点不变；移动时仍为同一对象且 1000 点不淡出；逐步补点至 5000；快速下一版、暂停恢复、换任务和减少动效正常；最终逐点覆盖真实目标、相机不变、无浏览器错误。匹配单次约 4～7 毫秒，不在逐帧重复计算。浏览器验收使用受控组件输入，未重跑整应用与真实后端网络链路，也未新增仓库测试依赖。第 6 步实测无真实表面，后端将默认首版后移到第 12 步，不以假点云填补。


### 机器人搬运旧点

同一组三个点云机器人也参与旧点位调整：搬运期间分别负责一组已显示点，跟随这些点的当前显示位置移动，以持续连接光束和夹持亮点表达搬运；调整结束后切回新增点打印。机器人只是显示引导，不改变真实匹配终点，也不代表推理过程的真实物理轨迹。暂停时机器人同步停止；减少动效时不挂载机器人。每个机器人只新增一个低面数夹持亮点，继续复用原机器人模型、光束及向量缓存。


搬运效果验证：build/lint 通过；临时 Chromium 挂载实际 React/Three 组件并使用真实三阶段点云，确认搬运期机器人/光束/夹持点可见且持续移动，补点期回到打印，暂停位置不变，减少动效无机器人；同时复验了单点云、完整 5000 点目标覆盖、相机保留和快速连续版本，无浏览器错误。此为受控组件验收，未重跑真实后端网络链路。


### 六版连续更新验收

已使用本次 mini/MPS 真实 12/15/18/21/24/27 步点云，在临时 Chromium 挂载当前 React/Three 组件逐版验收。版本 1～6 均能通过前端协议解析，等待下一版分包时旧点不变；收齐后保留同一个点云对象，由机器人搬运旧点并打印新增点。每版最终坐标完整覆盖真实目标，机器人完成后继续待命、关闭光束，镜头不重置；六版无浏览器错误。既有匹配/机器人源文件本轮未改，只确认了没有三版上限。build/lint 通过，没有新增测试依赖。日志 /tmp/formaspace-six-browser.log。

后端独立测试库真实协议链路已核对六版 WS 完整帧、50 点分包与 HTTP 读取逐点一致、首版后重连与最终作品完成。总推理约 88.89 秒，无 OOM，最终 GLB 与此前同 seed 三阶段结果哈希一致；更多预览增加同步解码开销，不加速推理。后端真实协议客户端为 JDK 原生 WS，与这里的受控组件验收分开，不宣称完整 React 页面与真实后台网络同时联调。


## 构建耗时与估算

构建进度旁新增“已用”“预计总时长约”，排队时显示等待时间；成功和失败后显示冻结的实际耗时。仅使用 Java 任务 createdAt/startedAt/finishedAt：排队等待与运行分开，实际运行耗时为 finishedAt-startedAt，包含中间预览、最终网格和 Java 下载/保存，不使用 Python summary 秒数替代。页面刷新按同一时间戳恢复；终态缺少 finishedAt 时先核对，不拿浏览器收到事件时间冒充实际结束。

字段边界：createdAt→startedAt 的 Java 排队不计入运行耗时；startedAt 是 Java 开始提交的时间，如果随后在上游队列等待或重试，该部分已包含在业务运行耗时里，现有 API 不能进一步拆出纯 GPU 时间。界面不把这个数声称为纯模型推理时间。

估算复用当前已加载的历史列表，无额外历史查询或外部服务。仅选成功且相同 profile（隔离模式）、simulated、质量、分辨率、numChunks、贴图/去背景、guidanceScale，步数相差不超过约 25% 的记录；至少两个样本，以耗时四分位数加余量给出经验范围。真实采样速度可抬高总时长下限，但不把采样外推当作完整推理结束。历史计划可能是旧三版或新六版，设备、输入和负载也会改变耗时，所以范围不是承诺或统计置信区间。无足够记录显示“正在估算”，超出范围显示继续处理，不将剩余时间压成零。

到达 30/30 仍显示最终网格或保存阶段，现有采样百分比及点云打印条不被改成整体任务百分比。任务时间戳在初始详情/历史中缺失时，可在 WS 开始和终态各触发一次对应阶段的详情查询，仅提取起止时间；不从这些读取更新状态、步数或阶段，不恢复 HTTP 状态轮询。查询按用户/任务/阶段缓存，无自动重试、聚焦或重连刷新。计时每秒仅更新文字，后台及卸载清除定时器，回到前台按墙钟恢复已用时间。

验证：build/lint、纯计时算法检查通过（排队/运行分离、刷新恢复、终态冻结、数据不足、历史过滤、采样速度下限、30/30 最终阶段及超时）。临时 Chromium 挂载实际 ModelViewport，使用受控任务时间戳/历史、真实中间点云与受控 HTTP 时间字段验证：成功/失败实际耗时冻结、排队文案、估算与数据不足、30/30 未完成、构建卡片及 360px 窄屏不溢出；开始/终态时间字段合计两次读取且不轮询，后台/卸载无计时器，无浏览器错误。不是新的真实模型运行或完整后端网络验收。

截图：`/tmp/formaspace-timing-building.png`（构建卡片），`/tmp/formaspace-timing-running.png`（采样阶段）；日志 `/tmp/formaspace-timing-browser.log`。截图中的历史时间数据是隔离测试输入，不作为产品默认估时。
