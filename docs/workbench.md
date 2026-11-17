# 工作台首页与生成接口

## 页面

`/studio` 为登录后工作台：顶栏与窄导航、图片及参数面板、中央三维视口、任务历史与只读作品属性。沿用登录品牌，采用石墨灰、暖白和黄绿色；桌面面板内部滚动，平板历史下移，手机采用上传 → 视口 → 历史的上下布局。

`/works` 从成功任务分页读取创作记录，卡片明确展示源图片，点击跳转 `/studio?taskId=...` 恢复任务并加载作品。没有调用不存在的作品列表接口。

未选择图片时提供演示点云；生成中的点云只代表等待状态。没有真实模型时不展示概念图冒充模型。没有积分、多图、删除、取消或预估耗时控件。登录动效保持原实现。

## 主要文件

| 文件 | 职责 |
| --- | --- |
| `src/components/layout/app-layout.tsx` | 登录后共享顶栏、品牌、导航与退出 |
| `src/features/generation/pages/studio-page.tsx` | 页面编排、草稿、路由恢复与查询缓存 |
| `src/features/generation/components/upload-panel.tsx` | 上传状态与生成入口 |
| `src/features/generation/components/generation-settings.tsx` | 能力驱动的质量与高级参数 |
| `src/features/generation/components/model-viewport.tsx` | 等待、进度、模型加载与预览错误反馈 |
| `src/features/generation/components/viewport-scene.tsx` | 复用 R3F，场景、轨道控制、网格与动画 |
| `src/features/generation/components/task-history.tsx` | 历史卡片、单状态筛选与分页 |
| `src/features/generation/components/asset-details.tsx` | 实际参数快照、受保护下载与安全文件名 |
| `src/features/generation/hooks/` | 上传、源图 Blob、提交确认、任务轮询、模型加载与清理 |
| `src/features/generation/lib/generation-api.ts` | 业务端点封装 |
| `src/features/generation/lib/generation-settings.ts` | 能力适配、预设及显式覆盖、范围与组合验证 |
| `src/features/generation/lib/generation-errors.ts` | 任务状态与用户错误提示 |
| `src/features/generation/lib/model-resources.ts` | 模型居中缩放与资源释放 |
| `src/features/generation/types.ts` | 已核对的 Zod 响应契约及 TypeScript 类型 |
| `src/features/generation/workbench.css` | 工作台样式与响应式布局 |
| `src/features/works/pages/works-page.tsx` | 基于成功任务的作品入口 |
| `src/lib/http.ts`、`src/lib/api-client.ts` | 复用 JSON 请求，扩展 FormData、附加请求头及二进制读取 |
| `src/lib/session-drafts.ts` | 按用户保存不含凭证的待确认提交，退出清理 |
| `src/app/router.tsx`、`src/features/auth/components/require-auth.tsx` | 工作台懒加载、登录跳转保留 taskId |
| `src/features/auth/lib/session-state.ts` | 退出或会话失效清理待确认记录 |

## 实际契约

依据相邻后端仓库 `formaspace-server/docs/generation-api.md`，并核对 `GenerationCapabilitiesVO`、`GenerationTaskVO`、`RequestedGenerationParameters`、`ResolvedGenerationParameters`、`ModelAssetVO` 与参数解析器。没有按前端建议文档猜字段。

- `GenerationCapabilitiesVO`：`qualityPresets` 为 STANDARD/HIGH 键的对象；`advancedParameters` 每项为 supported/defaultValue/minimum/maximum/allowedValues；`uploadConstraints` 为 formats/maximumBytes/maximumPixels。统一适配为可用质量档位、Dropzone accept 和生成可用状态。
- 后端另提供 `maximumVoxelSteps`，前端检查步数 × 分辨率³ 的组合；`profileId` 与 `simulationNotice` 用于参数属性和演示说明。MOCK 接受参数但不实际去背景、推理或生成贴图。
- `CreateGenerationDTO`：sourceFileId/quality/generateTexture/advancedOptions；明确覆盖才填数值，空值保持 null，保留 seed=0、guidanceScale=0。种子随机时为 null。不支持项不提交显式高级数值覆盖，去背景不可编辑时按后端返回的固定默认值提交。
- `GenerationTaskVO`：requestedParameters 包含 sourceFileId；resolvedParameters 是平铺实际参数，含 schemaVersion/profileId/numChunks/format。两者允许历史记录为 null；只读展示不重算。
- `FileUploadVO`：id/originalName/contentType/sizeBytes/previewUrl，允许 previewUrl=null。源图固定走受保护 content 接口，忽略 URL 猜测。
- `ModelAssetVO`：id/generationTaskId/name/format/sizeBytes/simulated/modelUrl/thumbnailUrl/createdAt。按 assetId 请求已定义的 model/download 端点。
- `PageResult<GenerationTaskVO>`：records/total/page/size。ID 全程字符串，分页从 1 开始，每页 20。

全部业务请求使用现有 `/api` baseURL 与 Bearer Token，不启用 Cookie、CSRF 或第二套会话。HTTP 200/201 JSON 按 `code=OK` 解包；图片与 GLB 成功响应按二进制读取，错误仍走 JSON/文本兜底。401 沿用会话 revision 校验，旧请求不清理新登录。

## 状态与生命周期

上传前按能力校验格式、字节数与像素数；成功才取得 sourceFileId。替换、移除或卸载会取消旧请求并通过版本号丢弃迟到结果。Object URL 在替换和卸载时释放，无上传百分比模拟。

创建任务先保存 UUID 与不可变请求快照，再发请求。超时、断网、服务错误或无法解析响应时保留确认记录，禁用编辑；刷新后可用原 key 和原请求重试。409 不自动换 key。用户核对历史后可显式放弃确认记录，但此操作不取消服务端任务。确认记录按用户隔离，退出时清理。

详情查询结束后用 setTimeout 等待 2.5 秒再查询，不使用 setInterval。网络、503 等临时错误保留上次任务并按 5/10/20/30 秒退避，兼顾 Retry-After；404、401 等不可重试错误和终态停止自动轮询。后台暂停，恢复前台重新查询；切换任务和卸载清理定时器，旧请求由查询缓存的 AbortSignal 取消。网络故障不改写服务端任务状态。

成功后先获取作品，再带 JWT 获取 GLB；GLTFLoader 解析自包含 GLB 2，拒绝外部资源。模型按边界居中缩放，支持旋转、缩放、重置、全屏和网格开关。没有伪造材质或线框控件。切换任务释放模型几何体、材质、贴图和动画混合器；DPR 上限 1.5，等待点云上限 3,800。减少动效时使用按需渲染，后台暂停渲染。

支持 DISABLED、MOCK、HUNYUAN_LOCAL，始终结合 generationAvailable 与单图能力判断可否生成；历史任务与作品的演示身份取各自 simulated。真实模式的能力驱动、错误码和本轮浏览器检查见 [混元对接说明](hunyuan-local-integration.md)。

## 验证与边界

- `pnpm lint`、`pnpm build` 通过；已有 Three/R3F 大分块警告仍存在。
- 本地 Chromium 使用临时路由拦截数据，验证空状态、JWT/FormData 上传、0/null 保留、断网后原 key/原请求重试、刷新恢复待确认提交、任务推进到成功、合法自包含 GLB 加载、带鉴权下载、taskId 刷新恢复、成功任务作品入口、DISABLED 禁用生成，以及手机无横向溢出。没有向产品代码注入默认样例数据。
- 本地后端 `http://127.0.0.1:8080` 未运行。本轮未做真实服务上传、MySQL 任务执行、实际后端 MOCK GLB、线上 CORS 或真实推理联调，不宣称这些已经通过。
- 不实现成功模型表面采样点云；等待示意与实际 GLB 直接切换。压缩模型解码扩展和外部贴图协议不在当前后端自包含 GLB 约定内。
