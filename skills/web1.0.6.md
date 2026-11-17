请直接修改 FormaSpace React + TypeScript 前端，接入Java原生WebSocket，展示真实进度、中间点云和最终模型。

只修改前端，不修改Java或Python。先检查AGENTS.md、已有工作台、JWT、请求层、任务轮询和Three.js实现，复用现有组件。

首先读取Java最新docs/frontend-realtime-api.md；它必须与本提示词协议一致。后端未实现时可以使用显式开发测试工具，但默认不能用mock冒充真实接通。

## 1. 目标

继续HTTP上传和创建任务，新增：

获取一次性ticket → 连接Java WS → 订阅业务任务 → 真实采样进度 → 完整中间点云 → 最终模型。

浏览器只连接Spring Boot，不连接Python，不读取Python服务令牌、inferenceTaskId、本机路径。

原生WebSocket JSON，不使用STOMP/SockJS。不重做登录、工作台或现有模型下载。

## 2. 建立连接

使用现有JWT请求：

POST /api/ws/tickets

成功201，ApiResponse.data：

{
"ticket":"<随机票据>",
"expiresIn":30,
"webSocketPath":"/ws/generation"
}

构造：
ws://<Java服务地址>/ws/generation?ticket=<编码后的ticket>

HTTPS页面必须wss。可复用同源代理；Vite代理必须支持ws:true，现有HTTP代理不能误改。

- 不把长期JWT放URL。
- 不尝试给浏览器原生WebSocket设置Authorization。
- ticket不进持久化、不打印日志、不复用。
- 每次重新建连都领取新ticket。
- 30秒仅为票据握手有效期，不是连接时长。
- 前端公开环境变量不存服务端秘密。
- 连接失败不要盲目退出登录，先检查ticket HTTP请求结果。

## 3. 客户端消息

打开连接后发送：

{
"protocolVersion":1,
"type":"subscribe",
"taskId":"456"
}

取消订阅：

{
"protocolVersion":1,
"type":"unsubscribe",
"taskId":"456"
}

每连接只订阅一个任务，切换时先取消旧订阅再订阅新任务，忽略不属于当前taskId的迟到消息。

取消订阅、离开页面、断开WS不能调用取消推理接口。

心跳：
{
"protocolVersion":1,
"type":"ping",
"requestId":"<随机字符串>"
}

建议每25秒发送，等待匹配pong，超时关闭并重连；考虑页面后台定时器节流，恢复可见时重新检查连接，避免无限重连。

## 4. 消息分类和类型

业务事件：

{
"protocolVersion":1,
"taskId":"456",
"sequence":12,
"type":"sampling_step",
"stage":"sampling",
"completedSteps":10,
"totalSteps":30,
"previewVersion":0,
"timestamp":"<UTC ISO-8601>",
"payload":{}
}

taskId为Java业务ID，字符串。

事件及stage：

- task_queued / queued。
- task_started / preprocessing。
- sampling_step / sampling。
- preview_started / preview_decoding。
- preview_ready / sampling。
- preview_failed / sampling。
- finalizing / final_decoding。
- result_saving / result_saving。
- task_completed / completed。
- task_failed / failed。

控制消息：

- task_snapshot：有sequence，但不增加业务序号。
- pong：requestId，无sequence。
- error：code、message、可选taskId，无sequence。
- connection_status：taskId、payload.connectionState，无sequence。

先区分消息类型，再处理序号，不能把pong当成非法业务消息。

定义明确TypeScript联合类型和运行时数据检查，不能只JSON.parse后强制断言。拒绝未知协议版本、非法坐标和超大消息，提供可读错误。

## 5. 首快照和序号

订阅后第一条该任务消息是task_snapshot：

{
"protocolVersion":1,
"taskId":"456",
"sequence":12,
"type":"task_snapshot",
"stage":"sampling",
"completedSteps":10,
"totalSteps":30,
"previewVersion":0,
"timestamp":"<UTC ISO-8601>",
"payload":{
"status":"PROCESSING",
"simulated":false,
"connectionState":"CONNECTED",
"latestPreview":null,
"assetId":null,
"error":null
}
}

status沿用Java：
PENDING、SUBMITTING、PROCESSING、SUCCEEDED、FAILED。

connectionState表示Java↔Python：
CONNECTED、RECONNECTING、DISCONNECTED。

单独维护浏览器↔Java的WS连接状态，不把两段混为一个。

序号：

- 按任务记录lastSequence。
- 新订阅/重连先接受快照建立基线，快照可以跳号。
- 对同一连接的增量：旧/重复忽略；大于lastSequence+1则重新订阅获取快照。
- 恢复操作需防抖，反复缺号则重新建连，禁止循环风暴。
- 同序号快照仍要恢复缺失点云或终态结果，不能直接全部忽略。
- 防止旧连接、旧任务消息覆盖新连接状态。
- 不让旧事件把已完成任务改回处理中。

不要求历史重放，靠快照恢复最新状态。

## 6. 进度展示

显示：

- queued：等待处理。
- preprocessing：图片预处理。
- sampling：形状采样。
- preview_decoding：正在提取中间预览。
- final_decoding：生成最终网格。
- result_saving：保存模型。
- completed/failed：终态。

completedSteps/totalSteps仅表示采样阶段，例如24/30。

允许显示“形状采样80%”，不能写成“整项任务80%”。30/30后仍显示最终解码或保存，收到Java task_completed才可展示业务成功。

没有步数时不定进度，不用计时器涨到99%。同步预览期间采样暂停属于正常行为。

## 7. 点云推送与恢复

preview_ready.payload：

{
"sourceStep":24,
"pointCount":5000,
"positions":[[0.1,0.2,0.3]],
"positionsPath":"/api/generation/tasks/456/previews/1",
"decodeSeconds":6.2
}

外层previewVersion为1。

示例坐标仅示意，真实pointCount必须等于positions长度。校验：

- 最多5000点。
- 每点3个有限数字。
- 版本比当前已应用版本新。
- taskId仍为当前选中任务。

将positions转成Float32Array，使用THREE.BufferGeometry和THREE.Points展示。不要将latent当坐标，不逐次独立居中缩放。

保持统一模型坐标系、相机和容器变换。不同预览采样点没有一一对应关系，第一版使用淡入淡出，不把同索引点强行插值造成乱飞。

生成初期保留演示粒子；收到真实点云才替换，不能每10%伪造更新。只有一次第24步预览也正常。

快照latestPreview：

{
"version":1,
"sourceStep":24,
"pointCount":5000,
"positionsPath":"/api/generation/tasks/456/previews/1"
}

重连发现新版本但没有坐标时，带JWT请求：

GET /api/generation/tasks/{taskId}/previews/{version}

响应ApiResponse.data：

{
"taskId":"456",
"previewVersion":1,
"sourceStep":24,
"pointCount":5000,
"positions":[[0.1,0.2,0.3]]
}

按同一校验与渲染路径处理。

区分“已通知版本”和“已成功展示版本”：下载/解析失败不能提前标记已应用，允许同版本重试。HTTP迟到结果不能覆盖更新版本或其他任务。

preview_failed且fatal=false：

- 保留已有点云或等待动效。
- 显示轻量提示。
- 不把整任务改FAILED。
- 等待后续事件。

## 8. 最终结果

result_saving时继续等待。

task_completed.payload：
{
"status":"SUCCEEDED",
"assetId":"789"
}

Java已保存作品后才发送此事件。使用已有作品详情、带JWT的模型读取和下载接口加载GLB。

终态快照为SUCCEEDED也走相同完成路径；重复事件不重复发起多份模型加载。

真实无贴图模型允许灰色材质展示。模型加载失败显示“预览加载失败，可重试”，不能把任务改成推理失败。

task_failed.payload：
{
"status":"FAILED",
"code":"INFERENCE_FAILED",
"message":"可对外展示的错误"
}

显示错误并允许用户主动创建新任务。不能因为WS断开重新创建推理。

## 9. 重连、权限和退出

连接状态：
connecting、subscribing、connected、reconnecting、closed。

- 指数退避并带抖动，最大间隔建议30秒。
- 每次重连重新获取ticket、重新subscribe。
- 同一时间只保留一个连接和一个重连定时器。
- 终态且结果协调完成后可主动关闭。
- React StrictMode下避免重复订阅和遗留连接。

关闭码：

- 1000：根据是否主动关闭决定，不盲目重连。
- 1008：策略拒绝，停止自动重试并提示。
- 1009：消息过大，停止无限重试并报告。
- 1013：慢连接/过载，退避重连。
- 4001：重新通过ticket接口验证登录；401时清理认证，成功时新票据重连。

浏览器可能只报告1006，不能据此认定JWT失效。网络/503不清空有效登录。

Java↔Python connection_status=RECONNECTING仅提示推理连接恢复中，不中断浏览器WS，不判任务失败。

退出登录：
关闭连接、取消心跳/重连、忽略旧异步响应、释放点云和模型资源，清理当前用户状态。

## 10. HTTP兜底和页面恢复

保留原任务详情接口用于初始化、刷新恢复和WS不可用时的临时轮询。

WS稳定后停止重复高频轮询；恢复快照按序号协调，旧HTTP响应不能覆盖新WS状态。

WS缺失只影响实时通知，不影响后台推理。轮询读取后端实际已有字段，不假设HTTP详情必然包含WS所有字段。

获取ticket404表示Java实时接口尚未部署，明确提示或切换现有轮询，不静默装作实时已接通。

## 11. 实现建议与验收

复用现有请求层/状态管理/Three.js：

- websocket-client.ts：连接、票据、心跳、重连。
- generation-events.ts：协议类型、校验、事件处理。
- useGenerationRealtime.ts：页面生命周期。
- PointCloudPreview：点云资源更新。
  具体目录按现有项目调整，不重复造基础框架。

不在每帧React setState，不把点坐标放入localStorage，不打印完整事件、票据和Token。

验证：

1. HTTP创建任务后订阅收到首快照。
2. 真实步数逐步更新。
3. 第24步5000点替换等待粒子。
4. 30/30后继续最终解码和保存，Java完成后才加载GLB。
5. 断线重连通过快照和HTTP恢复点云。
6. 重复/乱序/缺号处理正确。
7. 切换任务、刷新、退出无迟到覆盖和资源泄漏。
8. 不能订阅其他用户任务。
9. Python断线与浏览器断线分别显示。
10. Mock、真实推理、前端协议测试清楚区分。
11. TypeScript、构建通过。

完成后输出修改文件、实际协议差异、验证步骤和未验证项。未运行真实Java/Python服务不得声称完整实时链路成功。
