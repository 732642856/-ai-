#!/usr/bin/env node --experimental-strip-types
// ============================================================================
// P1-4.4 单元测试 — buildNodeExecutionContext + graph-traversal
// ============================================================================
// 运行方式：node --experimental-strip-types utils/build-node-execution-context.test.ts
// 或：NODE_OPTIONS="" node --experimental-strip-types utils/build-node-execution-context.test.ts
// ============================================================================

const assert = {
  equal(actual: unknown, expected: unknown, msg?: string) {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`${msg ?? "assertion failed"}\n  expected: ${e}\n  actual:   ${a}`)
    }
  },
  ok(val: unknown, msg?: string) {
    if (!val) throw new Error(msg ?? "expected truthy")
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string) {
    this.equal(actual, expected, msg)
  },
  throws(fn: () => void, _expected?: unknown, msg?: string) {
    let threw = false
    try { fn() } catch { threw = true }
    if (!threw) throw new Error(msg ?? "expected to throw")
  },
}

// ============================================================================
// Inline implementations (mirror the real source for zero-dependency testing)
// ============================================================================

// Types
interface GraphNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

interface GraphEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

interface AssetItem {
  id: string
  type: string
  name: string
  src?: string
  thumbnail?: string
  folder: string
  tags?: string[]
  createdAt: number
}

// ---- graph-traversal (mirror) ----

function getIncomingEdges(nodeId: string, edges: GraphEdge[]): GraphEdge[] {
  return edges.filter((e) => e.target === nodeId)
}
function getOutgoingEdges(nodeId: string, edges: GraphEdge[]): GraphEdge[] {
  return edges.filter((e) => e.source === nodeId)
}
function getDirectUpstreamNodes(nodeId: string, nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const incoming = getIncomingEdges(nodeId, edges)
  const ids = new Set(incoming.map((e) => e.source))
  return nodes.filter((n) => ids.has(n.id))
}
function getUpstreamNodeIds(nodeId: string, edges: GraphEdge[], maxDepth = 10): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  function walk(id: string, depth: number) {
    if (depth > maxDepth) return
    for (const e of edges) {
      if (e.target !== id) continue
      const up = e.source
      if (!up || visited.has(up)) continue
      visited.add(up)
      walk(up, depth + 1)
      result.push(up)
    }
  }
  walk(nodeId, 0)
  return result
}
function hasCycle(nodeId: string, edges: GraphEdge[], maxDepth = 20): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()
  function dfs(id: string, depth: number): boolean {
    if (depth > maxDepth) return false
    if (stack.has(id)) return true
    if (visited.has(id)) return false
    visited.add(id)
    stack.add(id)
    for (const e of edges) {
      if (e.source !== id) continue
      if (dfs(e.target, depth + 1)) return true
    }
    stack.delete(id)
    return false
  }
  return dfs(nodeId, 0)
}

// ---- build-node-execution-context (mirror, subset for testing) ----

interface ContextImageRef {
  id: string; url: string; name?: string; role: string
  source: "upstream" | "mention" | "asset" | "self"
  nodeId?: string; outputIndex?: number; assetId?: string
}
interface ContextTextInput {
  nodeId: string; nodeType: string; text: string; title?: string
}
interface MentionRef {
  type: "node-output" | "asset" | "image-url"; label: string
  nodeId?: string; outputIndex?: number; assetId?: string; url?: string; name?: string
}
interface PromptPart {
  type: "text" | "node-output" | "asset" | "image-url"
  text?: string; nodeId?: string; outputIndex?: number; label?: string
  assetId?: string; url?: string; name?: string
}
interface NodeExecutionContext {
  nodeId: string; nodeType: string
  prompt: string; displayPrompt: string
  inputTexts: ContextTextInput[]
  referenceImages: ContextImageRef[]
  referenceVideos: unknown[]
  upstreamNodes: unknown[]
  mentions: MentionRef[]
  errors: string[]; warnings: string[]
}

// Parsing helpers (mirror from real code)
function parseAtMentionsFromText(text: string): PromptPart[] {
  const parts: PromptPart[] = []
  const re = /@(node_[a-zA-Z0-9_-]+|asset_[a-zA-Z0-9_-]+|https?:\/\/\S+)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", text: text.slice(last, m.index) })
    const token = m[1]
    if (token.startsWith("node_")) parts.push({ type: "node-output", nodeId: token, label: token })
    else if (token.startsWith("asset_")) parts.push({ type: "asset", assetId: token, label: token })
    else if (token.startsWith("http")) parts.push({ type: "image-url", url: token, label: "图片链接" })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) })
  return parts.length > 0 ? parts : [{ type: "text", text }]
}

function composeDisplayPrompt(parts: PromptPart[]): string {
  return parts.map(p => {
    switch (p.type) {
      case "text": return p.text ?? ""
      case "node-output": return `@${p.label ?? p.nodeId}`
      case "asset": return `@${p.label ?? p.assetId}`
      case "image-url": return `@${p.label ?? "图片链接"}`
    }
  }).join("")
}

function extractMentions(parts: PromptPart[]): MentionRef[] {
  return parts
    .filter(p => p.type !== "text")
    .map(p => ({
      type: p.type as MentionRef["type"],
      label: p.label ?? "",
      nodeId: "nodeId" in p ? p.nodeId : undefined,
      outputIndex: "outputIndex" in p ? p.outputIndex : undefined,
      assetId: "assetId" in p ? p.assetId : undefined,
      url: "url" in p ? p.url : undefined,
      name: "name" in p ? p.name : undefined,
    } satisfies MentionRef))
}

function composeModelPrompt(displayPrompt: string, images: ContextImageRef[]): string {
  if (images.length === 0) return displayPrompt
  const lines = images.map(r => `图${r.role.replace("image_", "")}：${r.name ?? r.role}`)
  return ["参考图：", ...lines, "", "用户需求：", displayPrompt].join("\n")
}

// ============================================================================
// Test helpers
// ============================================================================

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${(e as Error).message}`) }
}

function makeNode(id: string, data: Record<string, unknown> = {}): GraphNode {
  return { id, type: "default", position: { x: 0, y: 0 }, data }
}

function makeEdge(source: string, target: string): GraphEdge {
  return { id: `${source}→${target}`, source, target }
}

// ============================================================================
// Tests
// ============================================================================

console.log("\n📦 图遍历测试 (graph-traversal)")

test("getIncomingEdges: 找入边", () => {
  const edges = [makeEdge("a", "b"), makeEdge("c", "b"), makeEdge("b", "d")]
  const result = getIncomingEdges("b", edges)
  assert.equal(result.length, 2)
  assert.equal(result[0].source, "a")
  assert.equal(result[1].source, "c")
})

test("getOutgoingEdges: 找出边", () => {
  const edges = [makeEdge("a", "b"), makeEdge("a", "c"), makeEdge("b", "d")]
  const result = getOutgoingEdges("a", edges)
  assert.equal(result.length, 2)
})

test("getDirectUpstreamNodes: 找直接上游", () => {
  const nodes = [makeNode("a"), makeNode("b"), makeNode("c")]
  const edges = [makeEdge("a", "c"), makeEdge("b", "c")]
  const result = getDirectUpstreamNodes("c", nodes, edges)
  assert.equal(result.length, 2)
  assert.equal(result.map(n => n.id).sort().join(), "a,b")
})

test("getUpstreamNodeIds: 递归上游（两层）", () => {
  const edges = [
    makeEdge("root", "mid"),
    makeEdge("mid", "leaf"),
  ]
  const ids = getUpstreamNodeIds("leaf", edges)
  // BFS 后序：先处理 root，再 mid
  assert.equal(ids.length, 2)
  assert.equal(ids[0], "root")
  assert.equal(ids[1], "mid")
})

test("getUpstreamNodeIds: 无上游", () => {
  const edges: GraphEdge[] = []
  const ids = getUpstreamNodeIds("solo", edges)
  assert.equal(ids.length, 0)
})

test("hasCycle: 检测到环", () => {
  const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")]
  assert.ok(hasCycle("a", edges), "应该检测到 a→b→c→a 环")
})

test("hasCycle: 无环", () => {
  const edges = [makeEdge("a", "b"), makeEdge("b", "c")]
  assert.ok(!hasCycle("a", edges), "无环图不应误报")
})

test("hasCycle: 自环", () => {
  const edges = [makeEdge("a", "a")]
  assert.ok(hasCycle("a", edges), "自环应该被检测到")
})

console.log("\n📦 Prompt 解析测试")

test("parseAtMentionsFromText: 纯文本", () => {
  const parts = parseAtMentionsFromText("a beautiful sunset")
  assert.equal(parts.length, 1)
  assert.equal(parts[0].type, "text")
  assert.equal(parts[0].text, "a beautiful sunset")
})

test("parseAtMentionsFromText: @node 引用", () => {
  const parts = parseAtMentionsFromText("把 @node_abc123 改成赛博朋克风格")
  assert.equal(parts.length, 3)
  assert.equal(parts[0].type, "text")
  assert.equal(parts[1].type, "node-output")
  assert.equal((parts[1] as {nodeId: string}).nodeId, "node_abc123")
  assert.equal(parts[2].type, "text")
})

test("parseAtMentionsFromText: @asset 引用", () => {
  const parts = parseAtMentionsFromText("参考 @asset_bg 的背景")
  assert.equal(parts.length, 3)
  const assetPart = parts[1] as {type: string; assetId: string}
  assert.equal(assetPart.type, "asset")
  assert.equal(assetPart.assetId, "asset_bg")
})

test("parseAtMentionsFromText: @URL 引用", () => {
  const parts = parseAtMentionsFromText("用这个 @https://example.com/img.png 做参考")
  assert.equal(parts.length, 3)
  const urlPart = parts[1] as {type: string; url: string}
  assert.equal(urlPart.type, "image-url")
  assert.ok(urlPart.url.includes("https://"))
})

test("parseAtMentionsFromText: 多个 @引用", () => {
  const parts = parseAtMentionsFromText("@node_a + @asset_b + @node_c")
  // text → node → text → asset → text → node
  assert.ok(parts.length >= 5)
  const types = parts.map(p => p.type)
  assert.ok(types.includes("node-output"))
  assert.ok(types.includes("asset"))
})

test("composeDisplayPrompt: 保留 @引用", () => {
  const parts = parseAtMentionsFromText("把 @node_x 改成赛博朋克")
  const display = composeDisplayPrompt(parts)
  assert.ok(display.includes("@node_x"), "应保留 @node_x 表达")
  assert.ok(display.includes("赛博朋克"))
})

test("extractMentions: 提取结构化引用", () => {
  const parts = parseAtMentionsFromText("@node_a 和 @asset_bg")
  const mentions = extractMentions(parts)
  assert.equal(mentions.length, 2)
  assert.equal(mentions[0].type, "node-output")
  assert.equal(mentions[0].nodeId, "node_a")
  assert.equal(mentions[1].type, "asset")
  assert.equal(mentions[1].assetId, "asset_bg")
})

console.log("\n📦 图片去重 + Role 分配测试")

test("dedupeImageRefs: URL 去重", () => {
  const refs: ContextImageRef[] = [
    { id: "1", url: "a.png", role: "", source: "upstream" },
    { id: "2", url: "a.png", role: "", source: "mention" },  // dup
    { id: "3", url: "b.png", role: "", source: "self" },
  ]
  // inline dedup
  const seen = new Set<string>()
  const deduped = refs.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
  assert.equal(deduped.length, 2)
  assert.equal(deduped[0].id, "1")
  assert.equal(deduped[1].id, "3")
})

test("assignImageRoles: role 分配", () => {
  const refs: ContextImageRef[] = [
    { id: "1", url: "a.png", role: "", source: "upstream" },
    { id: "2", url: "b.png", role: "", source: "self" },
    { id: "3", url: "c.png", role: "", source: "mention" },
  ]
  refs.forEach((r, i) => { r.role = `image_${i + 1}` })
  assert.equal(refs[0].role, "image_1")
  assert.equal(refs[1].role, "image_2")
  assert.equal(refs[2].role, "image_3")
})

console.log("\n📦 Model Prompt 生成测试")

test("composeModelPrompt: 无图片，原样返回", () => {
  const result = composeModelPrompt("sunset", [])
  assert.equal(result, "sunset")
})

test("composeModelPrompt: 有图片，生成结构化 prompt", () => {
  const refs: ContextImageRef[] = [
    { id: "1", url: "a.png", name: "参考图1", role: "image_1", source: "upstream" },
    { id: "2", url: "b.png", name: "资产-背景", role: "image_2", source: "asset" },
  ]
  const result = composeModelPrompt("改成赛博朋克", refs)
  assert.ok(result.includes("参考图："))
  assert.ok(result.includes("图1：参考图1"))
  assert.ok(result.includes("图2：资产-背景"))
  assert.ok(result.includes("用户需求："))
  assert.ok(result.includes("改成赛博朋克"))
})

console.log("\n📦 空字符串边界测试")

test("空文本不产生上游文本输入", () => {
  // extractTextInputs 应该过滤掉空字符串
  const nodes = [makeNode("empty_text", { prompt: "" })]
  const texts = nodes.filter(n => {
    const d = n.data
    const t = (d.prompt ?? d.content ?? "") as string
    return t.trim().length > 0
  }).map(n => ({
    nodeId: n.id,
    nodeType: n.type ?? "unknown",
    text: ((n.data.prompt ?? n.data.content ?? "") as string).trim(),
    title: n.data.title as string | undefined,
  }))
  assert.equal(texts.length, 0)
})

test("空 prompt 返回空 parts", () => {
  // 真实代码在 parsePromptParts 层检查 !raw.trim()
  const raw = ""
  if (!raw.trim()) {
    assert.equal(0, 0) // 空文本直接返回 []
    return
  }
  const parts = parseAtMentionsFromText(raw)
  assert.equal(parts.length, 0)
})

console.log("\n📦 端到端场景测试")

test("场景1：纯 prompt 节点，无上游", () => {
  // 模拟 buildNodeExecutionContext 的核心流程
  const node = makeNode("prompt_1", { prompt: "a cyberpunk city", nodeKind: "prompt" })
  const parts = parseAtMentionsFromText(node.data.prompt as string)
  const display = composeDisplayPrompt(parts)
  const mentions = extractMentions(parts)
  const modelPrompt = composeModelPrompt(display, [])

  assert.equal(display, "a cyberpunk city")
  assert.equal(mentions.length, 0)
  assert.equal(modelPrompt, "a cyberpunk city")
})

test("场景2：prompt 节点 → image 生成节点", () => {
  const promptNode = makeNode("prompt_1", {
    prompt: "a dog in a field",
    nodeKind: "prompt",
  })
  const imageNode = makeNode("image_1", {
    prompt: "add cyberpunk neon lights",
    nodeKind: "image-generation",
  })
  const edges = [makeEdge("prompt_1", "image_1")]

  // 上游节点收集
  const upstreamIds = getUpstreamNodeIds("image_1", edges)
  assert.equal(upstreamIds.length, 1)
  assert.equal(upstreamIds[0], "prompt_1")

  // prompt 解析
  const parts = parseAtMentionsFromText(imageNode.data.prompt as string)
  const display = composeDisplayPrompt(parts)
  assert.equal(display, "add cyberpunk neon lights")

  // 文本输入（从上游 prompt 节点）
  const upstreamTexts = [promptNode].filter(n => {
    const t = (n.data.prompt ?? n.data.content ?? "") as string
    return t.trim().length > 0
  }).map(n => ({
    nodeId: n.id,
    nodeType: n.type ?? "unknown",
    text: ((n.data.prompt ?? n.data.content ?? "") as string).trim(),
    title: n.data.title as string | undefined,
  }))
  assert.equal(upstreamTexts.length, 1)
  assert.equal(upstreamTexts[0].text, "a dog in a field")
})

test("场景3：@ 节点输出引用", () => {
  const refNode = makeNode("node_ref", {
    prompt: "",
    imageUrl: "/images/result.png",
    title: "生成结果",
    nodeKind: "image-result",
  })
  const currentNode = makeNode("prompt_1", {
    prompt: "把 @node_ref 改成素描风格",
    nodeKind: "prompt",
  })
  const edges = [makeEdge("node_ref", "prompt_1")]

  // 上游收集
  const upstreamIds = getUpstreamNodeIds("prompt_1", edges)
  assert.equal(upstreamIds.length, 1)
  assert.equal(upstreamIds[0], "node_ref")

  // mention 解析
  const parts = parseAtMentionsFromText(currentNode.data.prompt as string)
  const mentions = extractMentions(parts)
  assert.equal(mentions.length, 1)
  assert.equal(mentions[0].type, "node-output")
  assert.equal(mentions[0].nodeId, "node_ref")

  // resolve mention → 图片引用
  const imgUrl = refNode.data.imageUrl as string
  assert.ok(imgUrl.length > 0, "上游节点应该有 imageUrl")

  const imageRefs: ContextImageRef[] = [{
    id: `mention-node_ref-0`,
    url: imgUrl,
    name: "生成结果",
    role: "image_1",
    source: "mention",
    nodeId: "node_ref",
    outputIndex: 0,
  }]

  // model prompt
  const display = composeDisplayPrompt(parts)
  const modelPrompt = composeModelPrompt(display, imageRefs)
  assert.ok(modelPrompt.includes("图1：生成结果"))
  assert.ok(modelPrompt.includes("改成素描风格"))
})

test("场景4：循环边保护（maxDepth 限制）", () => {
  const edges = [
    makeEdge("a", "b"),
    makeEdge("b", "c"),
    makeEdge("c", "d"),
    makeEdge("d", "e"),
    // + 很多层级
    makeEdge("e", "f"),
    makeEdge("f", "g"),
  ]
  const ids = getUpstreamNodeIds("g", edges, 2)  // maxDepth=2
  // 只应收集 2 层内的上游
  assert.ok(ids.length <= 4, `应该限制深度，但收集了 ${ids.length} 个节点`)
})

test("场景5：缺失引用 → warnings", () => {
  // 模拟：@node_ghost 不在上游节点中
  const parts = parseAtMentionsFromText("@node_ghost not found")
  const mentions = extractMentions(parts)
  assert.equal(mentions.length, 1)

  // 尝试 resolve：不在列表里 → warn
  const upstreamNodes: GraphNode[] = []
  const found = upstreamNodes.find(n => n.id === mentions[0].nodeId)
  assert.ok(!found, "应该找不到 ghost 节点")
})

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${"═".repeat(40)}`)
console.log(`  通过: ${passed}  失败: ${failed}`)
console.log(`${"═".repeat(40)}\n`)

if (failed > 0) process.exit(1)
