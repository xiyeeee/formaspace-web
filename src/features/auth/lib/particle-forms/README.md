# 点云形态模块

每种形态独立维护 Shader、展示时长、镜头与构图，公共的粒子变形 / 着色 / 渲染循环不放在形态模块里。

| 文件 | 形态 |
| --- | --- |
| tornado.ts | 龙卷风，以及首屏静态占位采样 |
| jellyfish.ts | 当前播放：六只水母错落漂动、伞盖收缩和触须摆动 |
| lotus.ts | 备用荷花模块，保留实现，当前未注册播放 |
| river.ts | 宽河道、水面流动与三只点云帆船 |
| whale.ts | 当前播放：大鲸鱼缓游、尾鳍上下摆动与胸鳍起伏 |
| astronaut.ts | 备用宇航员模块，保留实现，当前未注册播放 |
| butterfly.ts | 备用蝴蝶群模块，保留实现，当前未注册播放 |
| index.ts | 注册顺序、默认首屏形态 |
| types.ts | 形态、镜头与首屏采样契约 |

## 增加形态

1. 新建形态文件，参考相邻模块导出符合 ParticleFormDefinition 的定义：id、label、holdSeconds、entryPoint、shader、camera。
2. 在 index.ts 导入定义并加入 particleForms，位置即循环播放顺序。

时间线的阶段数 / 时长、镜头选择、Shader 分发索引会自动跟随注册表，不需要另外增加数字分支或修改渲染组件。

Shader 入口统一为：

```glsl
ParticleForm uniqueFormName(vec4 seed, float time, float age)
```

- seed：同一批粒子的四个固定随机种子，范围 0–1。
- time：该形态独立的运动时钟，每次入场从 0 开始；入场目标冻结为 0，展示阶段推进，离场变形期间冻结在展示末帧。适合循环流动 / 扇翅，不应依赖其他形态的累计时间。
- age：当前形态的年龄，包含进入该形态的过渡时间，适合开花 / 单向飞行。
- 返回 ParticleForm(point, visibility, color)，位置在形态局部坐标中，颜色按现有模块的线性 RGB 约定。

公共 PI、TAU 和 ParticleForm 结构定义在 ../shaders/particle-form-common.ts。入口和辅助函数名需在所有注册模块中唯一；辅助函数使用形态名前缀。

更换首屏形态时，需要提供 InitialParticleFormDefinition 的 sampleInitialPosition，并同步 index.ts 的 initialParticleForm。CPU 占位应对应该形态在 time=0 的 GPU 位置，避免刷新时突然换图。

../shaders/particle-forms.ts 只负责组装公共片段与各形态片段、生成 getForm 分发函数。运行时仍使用同一批种子、同一个 Points 和连续变形流程；拆分文件没有增加 Canvas 或绘制对象。

修改形态后执行现有 lint / build，并在浏览器简短查看 Shader 编译和形态切换。无需为每个形态增加 React 组件。

## 无宣传文字时的构图

可选 presentation 配置每个形态的 scale、offset（局部 XY 偏移）与 brightness（透明度增益），默认分别为 1、[0, 0]、1。当前与目标形态先各自应用配置，再进行粒子变形，避免在切换边界突然缩放或跳位。龙卷风控制顶部边界，水母适度扩展分布，河流强化水面层次，鲸鱼放大并保持尾鳍完整；统一构图中心略向左上移动。首屏 SVG 同步使用龙卷风的缩放与偏移。背景冷色柔光由 CSS 静态径向渐变实现，没有增加粒子数、绘制对象或表单改动。
