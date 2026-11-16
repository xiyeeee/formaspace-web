# FormaSpace 第三步：工作台首页搭建与接口对接

> 直接交给前端项目中的 AI 执行。先检查现有代码和 AGENTS.md，再修改工程。
>
> 本文依据后端第三步开发要求编写，尚未核对实际后端实现。请优先读取后端生成的 docs/generation-api.md 或 OpenAPI，确认能力接口、参数快照和作品 VO 的具体结构。本文明确标注的建议结构不能冒充已上线契约。联调发现差异先记录和统一，不静默猜字段。

## 1. 本轮目标

在已有 React + TypeScript 工程中，沿用已经完成的登录、JWT、请求封装和路由守卫，实现：

进入工作台 → 读取能力和历史任务 → 选择图片 → 上传 → 设置生成参数 → 创建任务 → 轮询 → 获取作品 → GLB 预览和下载。

保持现有登录页面和动效。不要重搭工程，不创建第二套鉴权，不把腾讯模型或密钥放到浏览器。

真实推理尚未接入，本轮后端模式是 DISABLED/MOCK。前端可以真实上传和对接 mock 任务，但不能声称模型由图片真实生成。不调用腾讯 Python 服务，所有业务请求都经过 Spring Boot。

## 2. 首页设计

使用用户提供的工作台截图作为视觉参考：深灰黑背景、细分隔线、荧光黄绿主色、中央大展示区，不做白色后台管理表格。品牌统一为 FormaSpace，不沿用截图中的 VISION 3D。

区域：

| 区域 | 组件与行为 |
| --- | --- |
| 顶栏 | 品牌、工作台、我的作品入口、当前用户头像和退出 |
| 窄侧栏 | 创作选中态、资产入口；未实现设置不做假跳转 |
| 左面板 | 单图上传、预览/替换/移除、质量档位、贴图开关、高级设置、生成按钮 |
| 中央视口 | 空状态/演示点云、处理状态、GLB 预览、旋转缩放与重置、全屏 |
| 右面板 | 历史任务卡片、当前作品信息、参数/属性、下载 |

左侧约 300～340px，右侧约 280～320px，中央自适应，视口内部滚动，避免整个页面被撑宽。窄屏折叠为抽屉或上下布局，保证生成操作可访问。

图中多图、积分余额、积分消耗、预计 10～30 秒均未有业务支持，本轮不展示虚假数值。多图可隐藏或禁用并标注暂未支持；不做可点击后无反馈的控件。

右侧当前只有任务列表接口，不是完整作品列表：用任务卡片展示历史，成功任务通过 assetId 获取作品。没有真实缩略图时使用源图片或占位，不生成假模型缩略图，不请求未定义的 GET /api/assets 列表。

## 3. 依赖和组件

复用已有 shadcn/ui、图标、表单、状态管理、请求缓存库。3D 优先沿用现有 Three.js / React Three Fiber 方案；没有时选择一种统一实现，可使用 three、@react-three/fiber、@react-three/drei，并确认版本兼容。

不要同时维护两套 Three.js 生命周期。不要为了页面重装已有依赖。参考结构可按项目调整：

```text
src/features/workbench/
  WorkbenchPage.tsx
  components/UploadPanel.tsx
  components/GenerationSettings.tsx
  components/ModelViewport.tsx
  components/GenerationStatus.tsx
  components/TaskHistory.tsx
  components/AssetDetails.tsx
  hooks/useTaskPolling.ts
  api.ts
  types.ts
```

## 4. 通信规则与接口总览

沿用现有 API baseURL，/api 前缀只拼一次。所有下列接口都需 Authorization: Bearer <token>。不启用 Cookie 凭证，不获取 CSRF Token。ID 全程字符串，时间为 ISO 8601。

JSON 使用现有 ApiResponse<T>：code、message、data；成功 code=OK。二进制接口成功直接返回文件，不包 ApiResponse。失败可能返回 JSON、非 JSON 或无响应，统一兜底。

| 方法与路径 | 作用 | 成功返回 |
| --- | --- | --- |
| GET /api/generation/capabilities | 参数与运行能力 | JSON，具体结构核对后端 |
| POST /api/files/upload | 单图片上传，form-data file | FileUploadVO，201 或已有约定 |
| GET /api/files/{id}/content | 自有源图 | 图片二进制 |
| POST /api/generation/tasks | 创建任务 | TaskVO，首次 201，幂等重放 200 |
| GET /api/generation/tasks/{id} | 查询任务 | TaskVO |
| GET /api/generation/tasks | 当前用户历史任务 | PageResult<TaskVO> |
| GET /api/assets/{id} | 成功作品详情 | 作品 VO，结构核对后端 |
| GET /api/assets/{id}/model | 模型预览文件 | GLB 二进制 |
| GET /api/assets/{id}/download | 下载文件 | 附件二进制 |

任务列表查询：page=1、size=20，可选 status。分页结构沿用 records、total、page、size，以实际文档为准。没有取消/删除/重命名接口，不擅自实现这些请求。

## 5. 能力驱动参数界面

进入首页先 GET /api/generation/capabilities。

读取 mode、generationAvailable、simulated、modelId、supportedInputModes、qualityPresets、textureSupported、removeBackgroundSupported、advancedParameters、uploadConstraints。

后端要求已确定字段含义，但 qualityPresets、advancedParameters、uploadConstraints 的内部 JSON 尚需看实际文档。本轮用一个适配函数转换为统一 UI 类型；不散落尝试多个字段名的兼容代码。

| 控件 | 对接方式 |
| --- | --- |
| 标准/精细 | STANDARD/HIGH，仅启用后端返回可用档位 |
| 生成贴图 | textureSupported=false 时关闭并禁用，说明当前环境未启用 |
| 去除背景 | 根据 removeBackgroundSupported 控制 |
| 随机种子 | 随机开关开启时 seed=null；关闭时填整数 0～2147483647 |
| 推理步数 | 输入范围按能力接口；空表示使用预设 |
| 引导强度 | 有限数值，范围按能力接口；空表示预设 |
| 几何分辨率 | 从 allowedValues 下拉选择，不允许任意整数 |

advancedParameters 中不支持的参数不能提交显式覆盖值。num_chunks、目标面数、多图、本轮没有的贴图分辨率不添加为可用控件。

切换质量时保留用户明确覆盖的高级参数，并提供“恢复预设”清空覆盖值。有效预览参数按“质量预设 + 显式覆盖”展示，最终以后端 resolvedParameters 为准。

DISABLED：允许上传和查看历史，但生成禁用，提示生成服务暂未启用。MOCK：显著显示“演示模式”，生成按钮可用且能力允许时正常提交。能力请求失败时禁用提交并显示重试，不把失败当成所有参数都支持。

## 6. 图片上传

支持点击、拖拽，单张图片。根据 uploadConstraints 设置 accept、大小和像素校验；默认后端支持 JPEG/PNG，不能照截图默认放行 WebP。

本地创建 Object URL 立即预览；选择图片后上传，上传成功才设置 sourceFileId。form-data 字段为 file；浏览器发送时不要手动固定 multipart Content-Type，否则缺失 boundary。

```ts
const form = new FormData();
form.append('file', file);
// 调用现有请求层，自动带 JWT；让浏览器设置 multipart boundary。
```

FileUploadVO：id、originalName、contentType、sizeBytes、previewUrl（可空）。previewUrl 为空不是失败。

替换图片时取消旧上传或用选择版本号忽略迟到响应，防止旧文件 ID 覆盖新图。移除只清理前端选择，不调用不存在的删除接口；已有任务的源图不因此删除。

上传中、失败、成功分别展示。没有可靠上传字节事件时不伪造上传百分比。避免在上传超时后自动重复上传造成多份文件。

服务器图片通过带 JWT 的二进制请求获取 Blob 再创建 Object URL；普通 img 标签不会自动带 Authorization。替换、卸载后释放旧 URL，避免泄漏。

## 7. 创建生成任务与幂等

POST /api/generation/tasks，额外请求头 Idempotency-Key: <UUID>。

```json
{
  "sourceFileId":"123",
  "quality":"STANDARD",
  "generateTexture":false,
  "advancedOptions":{
    "removeBackground":true,
    "seed":null,
    "inferenceSteps":null,
    "guidanceScale":null,
    "octreeResolution":null
  }
}
```

不传 userId、provider、status、内部文件路径。按后端约定处理整体 advancedOptions 的 null；不支持去背景时具体禁用值须以能力契约确认，不能强行提交 true。

每次逻辑生成只创建一个 UUID，保存该 key 与不可变请求快照。超时/断网时结果未知，用户点击“重试确认”必须复用原 key 和原请求；不能换 key 再发。确认失败后主动重新生成或修改参数提交才产生新 key。

对于结果未知的提交，先解决旧提交，不允许编辑请求后继续复用旧 key。可在 sessionStorage 保存不含秘密的待确认 key/请求，刷新后显式恢复确认，按用户隔离，退出清理。

201 和 200 均按成功读取同一 TaskVO。提交中禁用按钮，429 展示任务上限，409 提示请求冲突并重新获取状态；不自动循环提交。

TaskVO 包含：id、sourceFileId、status、progress、simulated、requestedParameters、resolvedParameters、assetId、errorCode、errorMessage、createdAt、startedAt、finishedAt。

requestedParameters / resolvedParameters 的嵌套结构按实际后端确定。不要仅凭本文猜测快照是否包括 sourceFileId。响应中的实际 seed/步数/分辨率用于属性展示，不用当前配置重算历史任务。

## 8. 状态轮询和点云

| 状态 | 界面 |
| --- | --- |
| PENDING | 等待处理 |
| SUBMITTING | 正在提交生成 |
| PROCESSING | 正在生成 |
| SUCCEEDED | 获取作品并加载 GLB |
| FAILED | 展示可读原因，可使用原图重新创建任务 |

progress 为 null 时使用不定进度动画，不显示假百分比；非空且有效才显示 0～100%。后端没有预计耗时，不显示承诺倒计时。

每次请求结束后间隔 2～3 秒查询，避免 setInterval 导致请求重叠。终态停止；切换任务、退出或卸载时取消/忽略旧请求。页面后台可暂停轮询，恢复后立即刷新；页面离开不发送取消任务。

网络故障/503 暂停或退避并允许重试，不把任务设为 FAILED。401 交给现有鉴权；404 停止并提示任务不可访问。服务端状态才是真相。

本轮没有实时阶段、采样步数、点云预览接口，不请求不存在的 preview/progress 路径：

- 生成前和生成中可用演示点云或抽象粒子、扫描光环，必须能看出是等待动效。
- 不每 10% 伪造一次真实点云。
- 成功加载 GLB 后，可表面采样生成真实点云，再平滑切换实体模型。
- mock 返回演示 GLB 时持续标记“演示结果”，不能称为上传图片的真实重建。

## 9. 历史、恢复与模型展示

进入工作台加载当前用户任务第一页，使用任务列表恢复进行中的任务。列表筛选只接受单状态时，不传逗号拼接状态；按需分别查询或从未筛选页读取，并提供分页入口。

路由可保存 ?taskId=字符串，刷新按详情恢复当前任务。只用后端记录恢复，不把 localStorage 中的用户对象当权限证明。切换历史任务显示只读参数快照，不覆盖正在编辑的新任务草稿。

SUCCEEDED 且有 assetId 后获取作品。任务成功但 assetId 缺失属于接口异常，显示重试，不造 ID。

GLB：带 JWT GET /assets/{id}/model 获取 ArrayBuffer，用 GLTFLoader.parse 加载，或 Blob URL 交给加载器。当前约定是自包含 GLB；若结果需要外部贴图/缓冲文件，须扩展受控资源协议，不能忽略外部资源加载失败。

适配相机、居中、合理缩放；支持 OrbitControls 旋转缩放、重置、全屏、网格开关。材质/线框控件只有实际实现才启用。不能对 skinned/复杂网格假设任意切换都无副作用。

真实点云如实现：更新世界矩阵，遍历网格，转换到统一坐标；优先表面面积采样、控制点数，不把所有模型顶点无限渲染。模型加载失败提供重试且保留任务成功状态，区分生成失败和预览失败。

释放 Object URL、geometry、material、texture、动画循环和控制器；切换任务忽略旧模型响应，设置像素比与粒子预算上限，避免每帧 React setState。

下载：带 JWT GET /assets/{id}/download，以 Blob 下载；文件名优先读取 Content-Disposition，并做安全兜底，默认 model-<assetId>.glb。跨域读取需后端 expose Content-Disposition。错误 Blob 要尝试识别 JSON 后展示错误，不能把 401 JSON 下载成 glb。成功二进制请求不走 JSON 解包。

## 10. 错误反馈

| HTTP/建议业务码 | 行为 |
| --- | --- |
| 400 / INVALID_GENERATION_PARAMETERS | 定位参数错误，保留草稿 |
| 400 / UNSUPPORTED_CAPABILITY | 提示选项未支持并刷新能力 |
| 401 | 沿用现有失效处理；旧 Token 请求不能清掉新登录 |
| 404 | 文件/任务/作品不可用，不泄露归属信息 |
| 409 / IDEMPOTENCY_CONFLICT | 不自动换 key 重试，检查请求快照 |
| 413 | 提示图片大小超限 |
| 415 | 提示图片格式不支持 |
| 429 / GENERATION_LIMIT_REACHED | 提示已有任务，刷新历史 |
| 503 / INFERENCE_UNAVAILABLE | 生成服务未启用或不可用，允许稍后重试 |
| FAILED + MOCK_RESULT_NOT_CONFIGURED | 演示结果未配置，说明需后端配置 |
| 网络失败/非 JSON | 通用错误，区分上传失败与任务提交结果未知 |

错误码为后端开发建议值，联调以最终 docs/generation-api.md 为准。不要假设已有 fieldErrors 字段。使用用户可读提示，不显示堆栈与磁盘路径。

## 11. 验收和交付

验证：

1. 登录后进入符合设计稿的四区工作台，空状态完整。
2. 图片点击/拖拽、替换/移除、上传失败、迟到响应处理正确。
3. 能力控制所有参数，禁用项不错误提交，null 和随机种子不转成 0。
4. 创建任务首次/重放成功；超时重试相同 key 和请求，不重复创建。
5. 轮询不重叠，切换、刷新、退出正确清理，失败和终态正确展示。
6. DISABLED 禁用生成；MOCK 明确演示，不能伪装真实推理。
7. 有演示模型时完整预览/下载，无模型时展示后端失败。
8. GLB 和图片携带 JWT，Blob/Object URL 无明显泄漏。
9. 无取消、删除、积分、实时点云等未定义接口请求。
10. TypeScript、构建通过；后端未启动或接口未完成时，列出未联调项，不声称全部通过。

修改完成后输出文件清单、实际采用的 API 类型、后端契约差异和验证结果。可使用显式开发样例辅助画 UI，但默认走真实后端；前端样例、后端 mock、真实模型三种状态不得混淆。
