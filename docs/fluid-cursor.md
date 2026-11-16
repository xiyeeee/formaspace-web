# 鼠标虹彩流体拖尾

已按本轮请求直接接入登录页，同时保留文档建议的独立浅色预览。没有改动登录表单、账号接口或鉴权行为；登录页原有点云和深色品牌布局保留。

## 入口

- `/login`：原点云场景上叠加偏暖白、浅紫的虹彩流体，复用同一个 Canvas 和 R3F 渲染循环。
- `/effects/fluid-cursor`：浅灰紫 `#f1f2fa` 背景，淡蓝 / 淡紫 / 浅粉配色，可调整强度并清空轨迹，无需登录。
- 截图：`docs/previews/fluid-login.png`、`docs/previews/fluid-light.png`。

## 实现与参数

本轮自行实现 TypeScript / GLSL 求解，没有复制或打包文档中 PavelDoGreat 项目的代码，因此没有新增第三方源码或许可证文件。继续使用项目已有 Three.js / React Three Fiber，不增加依赖。

1. 半拉格朗日速度平流、旋度、适量涡量约束。
2. 计算散度，14 次 Jacobi 压力迭代，减去压力梯度。
3. 用更新后的速度平流染料，时间衰减使用 exp(-rate × dt)。
4. 最终 Shader 从染料梯度构造近似法线，以柔和透明度、边缘虹彩和轻微 RGB 偏移表现薄膜质感。

速度、压力、染料分别使用 ping-pong render targets，读写不共享附件。网格长边 192，染料长边 768，按容器比例缩放；压力与投影采用相同的无穿透 / 压力无梯度边界约定。

数值纹理使用半浮点 RGBA、NoColorSpace、NearestFilter。初始化先检测颜色附件扩展并检查实际 framebuffer 完整性；平流使用手动双线性采样，不要求设备支持半浮点线性过滤。只在最终显示阶段进行输出颜色空间转换。

| 参数 | 当前默认 |
| --- | --- |
| 强度 | 预览 1.0，登录 1.1；预览工具范围 0.4–2.0 |
| 影响半径 | 短边的 2%–3.2%，随速度变化 |
| 速度范围 | 两轴钳制到 ±2 UV/s |
| 速度衰减 | 1.8 / 秒 |
| 染料衰减 | 1.65 / 秒，约数秒淡出；4 秒后清理残余场 |
| 涡量系数 | 0.018，旋度钳制至 ±80 |
| 时间步上限 | 1/30 秒 |
| 色散偏移 | 1.2 CSS 像素 |
| DPR | 最大 1.5 |

指针轨迹以解析线段距离注入，覆盖前后坐标之间整段路径，快速移动不依赖离散圆点拼接。首次进入、离开、失焦、恢复焦点、进入表单后重置上一位置；使用 Canvas 实际 boundingClientRect 换算坐标并翻转 Y。指针状态不触发逐帧 React 更新。

## 组件与生命周期

- `src/components/effects/fluid-cursor/fluid-cursor-background.tsx`：独立背景组件，支持 enabled、backgroundColor、palette、intensity、className。
- `fluid-pass.tsx`：嵌入现有 R3F Canvas 的渲染适配器，登录页使用该入口，避免创建第二个 WebGL 上下文。
- `fluid-engine.ts`：数值场、Pass 调度、指针注入与资源释放。
- `shaders/`：求解与最终显示分离。
- `src/features/effects/fluid-cursor-page.tsx`：独立预览和参数工具。
- `src/lib/use-media-query.ts`：将已有媒体查询 / 页面可见性 hook 移至共享层；原账号路径保留重导出。

尺寸变化由现有 R3F ResizeObserver 驱动，重新分配场纹理并释放旧资源。卸载清理所有监听、材质、几何体和 render targets；使用 R3F 循环，不增加 requestAnimationFrame。隐藏标签页暂停渲染，恢复时限制时间步并重置指针。减少动效与移动端关闭流体模拟；浮点附件不可用时保留原背景，上下文丢失时使用已有静态降级。

Canvas 为 pointer-events:none，不隐藏鼠标、不阻止触摸滚动。表单和预览工具区域停止注入，已有轨迹仍可自然衰减。

## 必要验证与差异

- `pnpm lint`、`pnpm build` 通过；沿用之前 Three.js 共享懒加载 chunk 的体积提示，未屏蔽构建警告。
- 本地 Chromium / SwiftShader 简短检查 1440×900：浅色预览与登录页拖尾可见，移动轨迹连续，停止 3 秒后基本消失，无控制台错误。
- 390×844 下登录表单仍能输入且无横向溢出，流体关闭。未做全面账号回归，未采集或宣称真机帧率。
- 与截图接近的是浅色透明染料和虹彩边缘；液体轮廓仍会随轨迹与速度变化，不保证逐像素复刻。
- 最终效果为独立着色的薄膜视觉；没有采样 HTML 或点云背景纹理，不声称产生真实背景折射。

参考渲染接口：[Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[R3F useFrame](https://r3f.docs.pmnd.rs/api/hooks)。
