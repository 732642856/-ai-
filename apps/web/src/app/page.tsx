const workflowSteps = [
  "登录 / 创建工作区",
  "新建项目与星轨画布",
  "配置 OpenAI Compatible API Key",
  "手绘分镜或 Prompt 节点发起生成",
  "结果节点回写画布",
  "保存作品并记录用量",
]

const modules = [
  { name: "Canvas", desc: "React Flow 星轨画布、节点、边、视口与作品沉淀" },
  { name: "Storyboard", desc: "火柴人也能用：姿态站位 + AI 背景 + 镜头意图，自动补全 Prompt" },
  { name: "BYOK", desc: "自配中转站 / API Key，加密存储，连接测试" },
  { name: "Billing", desc: "平台点数与 BYOK 用量分账，成本提示" },
  { name: "Teams", desc: "组织、成员、角色权限，为商业化预留" },
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
              <h1 className="mt-2 text-xl font-semibold">星轨 · Tapnow-like AI 创作画布</h1>
            </div>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
            SaaS / BYOK / 三端预留
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              MVP 第一闭环：从提示词到结果节点，再到用量记录
            </div>
            <h2 className="max-w-3xl text-5xl font-semibold tracking-tight text-white lg:text-7xl">
              把灵感、草图、提示词和镜头连成一条星轨。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              StarTrails 星轨不是简单复刻 Tapnow，也不是单机小玩具。这个工程从第一天就按 Web、iOS、macOS 与 SaaS
              计费权限体系来搭，先把 BYOK 低成本生成闭环跑通，再叠加导演手绘分镜。哪怕用户只会画火柴人，也能用姿态站位配合 AI 背景完成镜头设计。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/canvas"
                className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
              >
                进入画布原型
              </a>
              <a
                href="/api-placeholder"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                查看 API 模块说明
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
                  <p className="text-xs text-emerald-200">Image / Video Result + Usage</p>
                  <p className="mt-2 text-sm text-white">生成概念图或视频结果回写画布，并记录 token、成本、计费模式。</p>
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
          <p className="mb-4 text-sm font-medium text-zinc-300">当前工程闭环</p>
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
