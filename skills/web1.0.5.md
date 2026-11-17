# FormaSpace 第四步：本地混元真实生成的前端对接

> 给本地前端 AI 执行：在现有工作台中接入真实生成，保留已完成的登录、上传和页面设计，不重建项目。
>
> 核对依据：2026-11-17 查看 xiyeeee/formaspace-server 的远程版本 963923f，其公开代码仍只有 DISABLED/MOCK。HUNYUAN_LOCAL 是上一轮要求本地后端实现的新模式，尚未在此仓库确认。开始前必须读取本地后端最新 docs/generation-api.md、docs/hunyuan-local-integration.md 和实际 VO，确认真实模式已完成；不得把本文示例当成已上线接口。

## 1. 接入原则

React 只调用 Spring Boot。Java 负责调用本地混元 Gradio、等待结果、保存 GLB。前端不访问 7860，不调用 Gradio 的上传/SSE 接口，不拿 Python 任务 ID，不读取本地磁盘路径。

本轮前端继续 HTTP 轮询，不新增 WebSocket、实时点云预览或假进度。生成中保留演示点云等待动效，完成后切换真实 GLB。真实模型无贴图时允许显示灰色模型，不用演示贴图掩盖结果。

前端本地开发默认后端 8080，Vite 页面通常 5173。沿用已有 baseURL 或 /api 代理；代理保留 /api，避免重复前缀。后端指向 Gradio 的地址仅为后端配置，不进入 VITE_ 变量。

所有以下接口使用 Authorization: Bearer <token>。沿用现有 401 处理，无 Cookie/CSRF 步骤。ID 为字符串，UTC 时间转本地展示。JSON 沿用 ApiResponse；二进制响应不走 JSON 解包。

## 2. 已核对的业务接口

| 方法与路径 | 输入 | 成功 |
| --- | --- | --- |
| GET /api/generation/capabilities | 无 | ApiResponse<GenerationCapabilities> |
| POST /api/files/upload | FormData 的 file 字段 | 201 ApiResponse<FileUploadVO> |
| GET /api/files/{id}/content | 无 | 图片二进制 |
| POST /api/generation/tasks | JSON + Idempotency-Key | 首次201，重放200，TaskVO |
| GET /api/generation/tasks/{id} | 无 | TaskVO |
| GET /api/generation/tasks | page、size、可选status | PageResult<TaskVO> |
| GET /api/assets/{id} | 无 | ModelAssetVO |
| GET /api/assets/{id}/model | 无 | GLB二进制 |
| GET /api/assets/{id}/download | 无 | 附件二进制 |

没有取消任务、删除、改名、完整作品列表或实时点云接口，不创建假请求。

## 3. TypeScript 类型

以下按已检查代码定义；真实模式字段需与本地最新后端确认。不存在的字段不能靠猜测补齐。

```ts
type GenerationMode = 'DISABLED' | 'MOCK' | 'HUNYUAN_LOCAL';
type Quality = 'STANDARD' | 'HIGH';
type TaskStatus = 'PENDING' | 'SUBMITTING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
interface ApiResponse<T> { code: string; message: string; data: T }
interface PageResult<T> { records: T[]; total: number; page: number; size: number }

interface ParameterCapability {
  supported: boolean;
  defaultValue: boolean | number | null;
  minimum: number | null;
  maximum: number | null;
  allowedValues: number[] | null;
}
interface GenerationCapabilities {
  mode: GenerationMode;
  generationAvailable: boolean;
  simulated: boolean;
  modelId: string | null;
  profileId: string;
  simulationNotice: string | null;
  supportedInputModes: string[];
  qualityPresets: Partial<Record<Quality, {
    simulated: boolean;
    inferenceSteps: number;
    guidanceScale: number;
    octreeResolution: number;
  }>>;
  textureSupported: boolean;
  removeBackgroundSupported: boolean;
  advancedParameters: Record<string, ParameterCapability>;
  maximumVoxelSteps: number;
  uploadConstraints: {
    formats: string[];
    maximumBytes: number;
    maximumPixels: number;
  };
}
interface AdvancedOptions {
  removeBackground: boolean;
  seed: number | null;
  inferenceSteps: number | null;
  guidanceScale: number | null;
  octreeResolution: number | null;
}
interface CreateGenerationRequest {
  sourceFileId: string;
  quality: Quality;
  generateTexture: boolean;
  advancedOptions: AdvancedOptions;
}
interface ResolvedParameters {
  schemaVersion: number;
  profileId: string;
  quality: Quality;
  generateTexture: boolean;
  removeBackground: boolean;
  seed: number;
  inferenceSteps: number;
  guidanceScale: number;
  octreeResolution: number;
  numChunks: number;
  format: string;
}
interface GenerationTask {
  id: string;
  sourceFileId: string;
  status: TaskStatus;
  progress: number | null;
  simulated: boolean;
  requestedParameters: CreateGenerationRequest | null;
  resolvedParameters: ResolvedParameters | null;
  assetId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
interface FileUploadVO {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  previewUrl: string | null;
}
interface ModelAssetVO {
  id: string;
  generationTaskId: string;
  name: string;
  format: string;
  sizeBytes: number;
  simulated: boolean;
  modelUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
}
```

qualityPresets 当前是 map，值中没有 enabled，不能用不存在的 enabled 控制。可用档位按返回 key 展示；如后端本地改了结构，先同步类型。

## 4. 初始化与能力

登录后加载 capabilities 和历史任务，保留用户正在编辑的草稿。

| 模式 | 页面处理 |
| --- | --- |
| DISABLED | 上传/历史可用，生成禁用并说明服务未启用 |
| MOCK | 显示演示标记，结果保持演示身份 |
| HUNYUAN_LOCAL | 不显示模拟说明；generationAvailable=true 才允许提交 |

模式为真实不代表服务一定可用，必须检查 generationAvailable；服务不可用展示重试。旧后端只返回 MOCK 时，不在前端伪造真实模式。

任务/作品是否为演示以各自 simulated 为准，不能用当前运行模式覆盖历史数据。真实模式下查看旧 mock 作品仍显示“演示结果”。

能力默认值和可选值动态驱动：质量、贴图、去背景、种子、步数、引导强度、几何分辨率。固定去背景或不支持高级设置时按后端约定固定或禁用，禁止接收 UI 值却不发送。

本地先关闭贴图，不直接复制 mock 的 HIGH、5/10 步和分辨率作为真实推荐。参数预设随部署变化；历史任务属性从 resolvedParameters 读取。

## 5. 上传和提交

上传图片为 FormData，只追加 file；不要手写 multipart boundary。默认已核对后端只支持JPEG/PNG，10MiB、1600万像素，最终以能力为准。可选图即本地预览，上传成功后保存 fileId；只有上传完成才允许生成。

替换/移除图片时使旧上传响应失效，不能让旧 fileId 覆盖新图。源图 URL 为空正常，服务器图片用 JWT 获取 Blob。

创建请求例子：

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

POST /api/generation/tasks，Idempotency-Key 使用标准UUID。请求码201/200均成功。空高级数值传 null，不转为0或NaN。显式覆盖值服从能力范围和 maximumVoxelSteps 组合限制；后端仍最终校验。

一次逻辑提交保存 key 和请求快照。超时意味着结果未知：使用原key、原请求再次确认，不能换key自动重提。用户真正重新生成时才创建新key。未解决的提交禁止编辑后复用旧key；刷新如恢复待确认提交，按账号隔离且不存Token到任务快照。

提交按钮 loading 防重入；只保存 taskId 不要等 GLB 才结束创建请求。上传和创建POST不自动无界重试。

## 6. 轮询与进度

PENDING→等待，SUBMITTING→提交中，PROCESSING→生成中，SUCCEEDED→读取结果，FAILED→显示原因。

每次查询结束后间隔2～3秒再请求，避免重叠；终态停止。切换任务、退出、卸载时取消或忽略旧请求。浏览器后台可暂停，恢复后立即刷新。

progress=null 使用不定进度，不能按时间涨到99%；当前没有阶段、步数、中间点云字段，不能请求不存在路径。Java内部与Gradio通信的SSE不属于前端接口。

网络失败/503不等于任务失败：保留任务，退避并提示连接异常。404停止并提示不可访问；401沿用认证清理。失败状态由任务响应决定，即使 status=FAILED，详情HTTP仍可为200。

客户端等待过长提示“任务仍在执行，可稍后查看”，不主动把后端任务改FAILED。刷新用路由taskId读取详情恢复，任务列表作为历史入口。

## 7. 模型预览与下载

SUCCEEDED且assetId非空：获取作品详情，再带JWT获取 /api/assets/{id}/model。

成功响应为GLB，可取ArrayBuffer交GLTFLoader.parse，或Blob URL交加载器。JSON请求层不能误解包二进制；失败时识别JSON错误，不下载错误信息当模型。

modelUrl是受保护路径，不是公开链接。若baseURL已是/api，避免把完整/api路径再次拼接；推荐下载函数使用受控的相对业务路径。

真实无贴图结果使用正常灰色材质、灯光、相机适配。支持旋转、缩放、居中重置和预览失败重试；预览失败不将成功任务改成生成失败。加载自包含GLB，不自行拼接Python本地路径或Gradio临时文件URL。

下载GET /api/assets/{id}/download，以Blob触发下载。Content-Disposition文件名或安全兜底model-<id>.glb；跨域读取头需后端暴露该头。

对象URL在资源使用结束、替换或卸载时释放，不在加载器完成读取之前释放。销毁几何、纹理、材质和控制器；迟到模型响应不能覆盖新选中任务。

右侧列表用现有任务接口，成功卡片再取作品；无thumbnail显示源图/占位，不伪造模型缩略图。完整作品列表接口本轮尚未提供。

## 8. 错误与联调

已核对业务错误：

| HTTP | code/处理 |
| --- | --- |
| 400 | INVALID_ARGUMENT、INVALID_IMAGE、IMAGE_PIXEL_LIMIT_EXCEEDED、INVALID_GENERATION_PARAMETERS、UNSUPPORTED_CAPABILITY |
| 401 | UNAUTHORIZED，沿用已有逻辑 |
| 404 | NOT_FOUND，任务/文件/作品不存在或无权访问 |
| 409 | IDEMPOTENCY_CONFLICT，不能自动换key重提 |
| 413/415 | FILE_TOO_LARGE / UNSUPPORTED_FILE_TYPE |
| 429 | GENERATION_LIMIT_REACHED，刷新历史/稍后重试，读取Retry-After |
| 503 | INFERENCE_UNAVAILABLE、STORAGE_UNAVAILABLE、SERVICE_UNAVAILABLE |

真实客户端可能新增模型提交/执行/超时错误码，必须根据本地最新文档补齐，不假定名称。优先显示经过后端清洗的errorMessage，敏感内部错误不展示。未知code有通用兜底。

联调前提：混元独立单图生成成功；Java开启真实模式；数据库迁移通过；前端登录有效。文档示例中真实模式尚未确认时，不能只移除mock标记假装接通。

验收：

1. capabilities显示实际模式和能力，真实/模拟历史标记正确。
2. 上传新图片→创建任务→轮询→取得assetId→真实GLB预览下载。
3. 随机seed和生效参数能从任务回显，参数不被静默忽略。
4. 并发点击、网络超时重试不重复创建任务。
5. 模型服务关闭、异常、结果无效有可读反馈。
6. 刷新、切换任务、退出后无迟到状态覆盖。
7. 前端没有访问7860、Gradio上传/SSE或读取磁盘路径。
8. TypeScript和构建通过；真实生成未成功则明确未联调，不将stub/mock通过当成真实验证。

完成后汇报修改文件、与本地后端契约差异、实际跑通步骤和未完成项。实时点云与WebSocket另一步实现，本轮不扩展。
