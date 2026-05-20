const workflowSteps = [
  "输入创意 / 主题 / 类型方向",
  "拆成分镜与镜头草稿",
  "上传参考图和视觉素材",
  "生成关键画面 / 首帧方案",
  "整理前期项目包 JSON",
  "交给星轨画布（后期）继续精修",
]

const modules = [
  { name: "创意构思", desc: "从一句话、类型感、人物关系和情绪出发，沉淀可执行的创作方向" },
  { name: "分镜草稿", desc: "火柴人也能用：姿态站位 + AI 背景 + 镜头意图，自动补全 Prompt" },
  { name: "视觉设计", desc: "关键帧、首帧、角色/场景参考图和风格板统一管理" },
  { name: "素材包", desc: "把脚本、分镜、图片、视频和音频整理成前期项目包" },
  { name: "交接后期", desc: "通过 startrails-project.json 交给星轨画布（后期）做节奏和成片精修" },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 lg:px-10">
        <nav className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-4">
            <img src="/startrails-icon.svg" alt="StarTrails 星轨图标" className="h-14 w-14 rounded-[1.25rem] border border-white/10 object-cover shadow-xl shadow-cyan-950/40" />
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">StarTrails</p>
              <h1 className="mt-2 text-xl font-semibold">星轨画布（前期）</h1>
            </div>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
创意构思 / 分镜草稿 / 视觉设计
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
前期闭环：从一句灵感到分镜草稿、关键画面和交接包
            </div>
            <h2 className="max-w-3xl text-5xl font-semibold tracking-tight text-white lg:text-7xl">
先把灵感变成能交给后期的分镜和画面。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              星轨画布（前期）专注创意构思、分镜草稿和视觉设计：把主题、人物关系、火柴人站位、参考图、首帧和风格板沉淀到同一张画布里，最后整理成 startrails-project.json，交给星轨画布（后期）继续做成片节奏和细节精修。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/canvas"
                className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
              >
进入前期画布
              </a>
              <a
                href="/api-placeholder"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
查看交接说明
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-cyan-950/30">
            <div className="rounded-[1.5rem] border border-white/10 bg-zinc-950 p-5">
              <div className="mb-5 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-300" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-sm text-zinc-500">canvas.mvp</span>
              </div>
              <div className="relative min-h-[430px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.14)_1px,transparent_0)] [background-size:24px_24px]">
                <div className="absolute left-6 top-8 w-56 rounded-2xl border border-purple-300/30 bg-purple-300/10 p-4">
                  <p className="text-xs text-purple-200">Storyboard Node</p>
                  <p className="mt-2 text-sm text-white">火柴人站位：人物在前景，AI 生成霓虹巷口背景。</p>
                  <p className="mt-2 text-xs text-purple-100/70">火柴人层 / AI 背景层 / 标注层</p>
                </div>
                <div className="absolute right-7 top-24 w-60 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
                  <p className="text-xs text-cyan-200">Prompt Analyzer + BYOK</p>
                  <p className="mt-2 text-sm text-white">从火柴人、草图、一句话、参考图反推完整 Prompt</p>
                  <p className="mt-2 text-xs text-cyan-100/70">OpenAI Compatible · 自配中转站</p>
                </div>
                <div className="absolute bottom-8 left-20 right-10 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-4">
                  <p className="text-xs text-emerald-200">Handoff Package</p>
                  <p className="mt-2 text-sm text-white">整理创意、分镜、参考图和关键画面，导出给后期继续精修。</p>
                </div>
                <div className="absolute left-[260px] top-[115px] h-px w-28 rotate-12 bg-cyan-300/50" />
                <div className="absolute right-[190px] top-[250px] h-px w-32 rotate-[125deg] bg-emerald-300/50" />
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-4 border-t border-white/10 pt-6 md:grid-cols-2 lg:grid-cols-5">
          {modules.map((item) => (
            <div key={item.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold text-white">{item.name}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-4 text-sm font-medium text-zinc-300">前期工程闭环</p>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {workflowSteps.map((step, index) => (
              <div key={step} className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-300">
                <span className="mb-2 block text-xs text-cyan-300">0{index + 1}</span>
                {step}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
