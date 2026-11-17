# 本地混元对接

前端复用现有 Spring Boot 业务接口，不直接请求 Gradio。支持 DISABLED、MOCK、HUNYUAN_LOCAL 三种 capabilities 模式。

## 本次变更

- `src/features/generation/types.ts`：能力响应接受 HUNYUAN_LOCAL。
- `src/features/generation/lib/generation-settings.ts`：真实模式按 generationAvailable 与 SINGLE_IMAGE 能力开放生成，继续使用服务端档位和参数限制。
- `src/features/generation/components/model-viewport.tsx`：真实模式显示混元模型，历史模拟任务仍标记演示。
- `src/features/generation/components/upload-panel.tsx`：模型未就绪时提示上传与历史仍可用。
- `src/features/generation/lib/generation-errors.ts`：推理失败、超时、引用丢失、协议异常与提交不确定提示。

上传、幂等提交、GLB Blob 预览与鉴权下载复用现有实现，无新增项目依赖。本轮同时补齐：

- 只显示后端返回的质量档位，种子上下限和固定参数由 capabilities 决定；去背景按服务端默认值初始化，固定时禁用编辑。
- 临时网络错误和 503 保留上次任务状态，按 5/10/20/30 秒退避并读取 Retry-After；404/401 停止自动轮询。长时间执行只提示稍后查看，不伪造失败或进度。
- 待确认提交刷新后展示原源图与参数快照，继续使用原 UUID 和原请求；重新选图清理旧任务视口。
- 历史卡片读取作品详情，作品名称和 simulated 取实际记录；源图明确标注，避免误认模型缩略图。
- 预览与下载校验 GLB 2 文件头及声明长度，下载文件名安全兜底；切换模型释放所有场景的几何体、材质和贴图。

## 验证记录

2026-11-17，使用本机现有 Node 20.20.2，`npm run lint` 与 `npm run build` 通过；未安装依赖或变更锁文件。构建保留 Three.js chunk 大于 500 KB 的已有警告。

额外执行能力/请求契约检查：真实模式可生成，未就绪与 DISABLED 不可生成，MOCK 继续可用；仅开放服务端 STANDARD；固定 seed 正确映射，贴图保持 false；超范围参数拒绝。

相邻 Java 工程已有独立真实客户端验证记录：成功调用运行中的 mini/MPS Gradio，5 步、guidance=5、octree=128、numChunks=1000、seed=1234，获得 1,846,496 字节真实 GLB，并校验结构与 mesh。该记录只覆盖后端推理客户端，不覆盖本轮前端业务链路。

本轮前端检查时 `127.0.0.1:8080` 未启动，尚未完成账号→上传→创建业务任务→作品入库→assetId→浏览器预览/下载验收；编译、接口替身和独立客户端成功不能代替该链路。数据库与模型部署说明见后端 `docs/hunyuan-local-integration.md`。


## 本轮前端检查与契约差异

`pnpm lint`、`pnpm build` 通过。临时 Chromium 脚本以本地接口替身检查：JWT/FormData 上传、UUID 提交、503 后恢复轮询直至成功、自包含 GLB 解析与鉴权下载、提交断网后刷新并复用原 key/请求、源图快照恢复、服务未就绪时禁用生成但保留上传，以及 404 后停止轮询。分别检查 HUNYUAN_LOCAL 查看旧模拟作品、MOCK/DISABLED 查看旧真实作品的标记。浏览器脚本与测试文件仅放临时目录，未向产品代码加入样例数据；这些结果不等于真实推理验收。

`web1.0.5.md` 开头引用的远程版本仍只有两种模式；本轮已核对本地后端最新 API 文档和 VO，实际包含 HUNYUAN_LOCAL。新增推理错误码为 INFERENCE_FAILED、INFERENCE_PROTOCOL_ERROR、INFERENCE_REFERENCE_LOST、INFERENCE_TIMEOUT、SUBMISSION_UNCERTAIN，均已补充前端提示。继续只调用 Spring Boot 的 `/api`，未增加 Gradio、7860、SSE 或本地磁盘访问。
