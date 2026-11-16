import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { FluidCursorBackground } from '@/components/effects/fluid-cursor/fluid-cursor-background'

export const FluidCursorPage = () => {
  const [intensity, setIntensity] = useState(1)
  const [resetKey, setResetKey] = useState(0)
  return (
    <main className="relative isolate min-h-svh overflow-clip bg-[#f1f2fa] font-sans text-[#484555]">
      <FluidCursorBackground key={resetKey} intensity={intensity} className="-z-10" />
      <header className="flex items-center justify-between gap-5 p-6 md:p-10">
        <Link to="/login" className="inline-flex items-center gap-2 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-violet-400"><ArrowLeft size={16} />返回登录页</Link>
        <span className="text-[10px] tracking-[0.24em] text-[#858092]">FORMASPACE / EXPERIMENTS</span>
      </header>
      <section className="pointer-events-none absolute bottom-12 left-6 max-w-96 md:bottom-16 md:left-10">
        <p className="mb-3 text-[10px] tracking-[0.25em] text-[#938b9e]">IRIDESCENT FLUID</p>
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">让光，沿指尖流动。</h1>
        <p className="mt-4 text-sm leading-7 text-[#8a8494]">移动鼠标，留下轻盈的虹彩轨迹。<br />停下来，让它慢慢消散。</p>
      </section>
      <aside data-fluid-controls className="absolute right-6 top-24 flex w-56 flex-col gap-4 rounded-2xl border border-white/80 bg-white/65 p-5 text-xs shadow-lg shadow-[#61507a0a] backdrop-blur-lg md:right-10">
        <p className="text-[10px] tracking-widest text-[#938b9e]">效果预览参数</p>
        <label htmlFor="fluid-intensity" className="flex justify-between">强度 <span>{intensity.toFixed(1)}</span></label>
        <input id="fluid-intensity" type="range" min="0.4" max="2" step="0.1" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="w-full accent-[#a39ac4]" />
        <button type="button" onClick={() => setResetKey((value) => value + 1)} className="flex items-center justify-center gap-2 rounded-lg border border-[#d8d3e3] py-2 focus-visible:outline-2 focus-visible:outline-violet-400"><RotateCcw size={13} />清空轨迹</button>
        <p className="leading-5 text-[#9a93a4]">触屏设备与减少动效模式保留静态背景。</p>
      </aside>
    </main>
  )
}
