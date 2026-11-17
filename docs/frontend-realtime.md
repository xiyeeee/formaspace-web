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
