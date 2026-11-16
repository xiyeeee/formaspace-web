# 点云形态模块

每种形态独立维护 Shader、展示时长与镜头，公共的粒子变形 / 着色 / 渲染循环不放在形态模块里。

| 文件 | 形态 |
| --- | --- |
| tornado.ts | 龙卷风，以及首屏静态占位采样 |
| jellyfish.ts | 当前播放：六只水母错落漂动、伞盖收缩和触须摆动 |
| lotus.ts | 备用荷花模块，保留实现，当前未注册播放 |
| river.ts | 宽河道、水面流动与三只点云帆船 |
| astronaut.ts | 当前播放：宇航员漂浮、抬臂挥手、头盔与宇航服轮廓 |
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
- time：仅在展示阶段推进的运动时钟，变形期间暂停，适合循环流动 / 扇翅。
- age：当前形态的年龄，包含进入该形态的过渡时间，适合开花 / 单向飞行。
- 返回 ParticleForm(point, visibility, color)，位置在形态局部坐标中，颜色按现有模块的线性 RGB 约定。

公共 PI、TAU 和 ParticleForm 结构定义在 ../shaders/particle-form-common.ts。入口和辅助函数名需在所有注册模块中唯一；辅助函数使用形态名前缀。

更换首屏形态时，需要提供 InitialParticleFormDefinition 的 sampleInitialPosition，并同步 index.ts 的 initialParticleForm。CPU 占位应对应该形态在 time=0 的 GPU 位置，避免刷新时突然换图。

../shaders/particle-forms.ts 只负责组装公共片段与各形态片段、生成 getForm 分发函数。运行时仍使用同一批种子、同一个 Points 和连续变形流程；拆分文件没有增加 Canvas 或绘制对象。

修改形态后执行现有 lint / build，并在浏览器简短查看 Shader 编译和形态切换。无需为每个形态增加 React 组件。
