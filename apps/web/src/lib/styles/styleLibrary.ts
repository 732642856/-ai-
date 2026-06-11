// ============================================================================
// Style Library — 100+ 影视级画风库
// ============================================================================
// 数据来源：awesome-seedance (CC BY 4.0) + 影视行业标准画风分类
// 对标：小云雀短剧 Agent 2.0 100+影视画风库
// ============================================================================

export interface StylePreset {
  id: string
  name: string
  nameEn: string
  category: StyleCategory
  visualReference: string // 导演/电影/视觉参考
  promptEnhancement: string // 注入prompt的风格描述
  tags: string[]
  colorPalette?: string // 色调描述
  aspectRatio?: string // 推荐画幅比
}

export type StyleCategory =
  | "cinematic"
  | "advertising"
  | "anime"
  | "drama"
  | "experimental"
  | "documentary"
  | "photography"

export interface StyleCategoryMeta {
  id: StyleCategory
  name: string
  nameEn: string
  icon: string
  description: string
}

// ============================================================================
// Category Definitions
// ============================================================================

export const STYLE_CATEGORIES: StyleCategoryMeta[] = [
  { id: "cinematic", name: "电影感", nameEn: "Cinematic Film", icon: "🎬", description: "好莱坞大片、艺术电影、类型片风格" },
  { id: "advertising", name: "广告商业", nameEn: "Commercial", icon: "📺", description: "品牌广告、产品宣传、MG动画" },
  { id: "anime", name: "动漫动画", nameEn: "Anime & Animation", icon: "🎨", description: "日式动漫、3D动画、艺术动画" },
  { id: "drama", name: "短剧网络剧", nameEn: "Web Drama", icon: "📱", description: "竖屏短剧、微短剧、网剧风格" },
  { id: "experimental", name: "视觉特效", nameEn: "VFX & Experimental", icon: "✨", description: "超现实、视觉特效、实验影像" },
  { id: "documentary", name: "纪实纪录", nameEn: "Documentary", icon: "📹", description: "纪录片、Vlog、真实感拍摄" },
  { id: "photography", name: "摄影风格", nameEn: "Photography", icon: "📷", description: "各类摄影风格与质感" },
]

// ============================================================================
// Style Presets — 30+ 影视级风格（来自 awesome-seedance CC BY 4.0 + 扩展）
// ============================================================================

export const STYLE_PRESETS: StylePreset[] = [
  // ========================================================================
  // CINEMATIC FILM — 电影感
  // ========================================================================
  {
    id: "cinematic-night-rain",
    name: "雨夜赛车",
    nameEn: "Rain Night Racing",
    category: "cinematic",
    visualReference: "Le Mans 66 / Michael Mann",
    promptEnhancement: "cinematic night scene, rain-slicked asphalt, dramatic lighting, high-stakes sports atmosphere, shallow depth of field, anamorphic lens flare, 8K photorealistic",
    tags: ["雨景", "赛车", "夜景", "戏剧性"],
    colorPalette: "深蓝+橙红对比, 高反差",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-epic-desert",
    name: "史诗沙漠",
    nameEn: "Epic Desert",
    category: "cinematic",
    visualReference: "Dune / Denis Villeneuve / IMAX 70mm",
    promptEnhancement: "IMAX 70mm film aesthetic, epic desert landscape, gritty realism, desaturated color palette, massive scale, atmospheric haze, golden hour light, photorealistic cinematic composition",
    tags: ["沙漠", "史诗", "IMAX", "粗粝感"],
    colorPalette: "沙漠金+灰白去饱和",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-wong-kar-wai",
    name: "王家卫港风",
    nameEn: "Wong Kar-wai Style",
    category: "cinematic",
    visualReference: "王家卫 / 花样年华 / 重庆森林",
    promptEnhancement: "90s Hong Kong art cinema aesthetic, retro film grain, yellow-green color tint, step-printing effect, melancholic atmosphere, neon reflections on wet streets, shallow depth of field, intimate framing",
    tags: ["港风", "复古", "霓虹", "忧郁"],
    colorPalette: "黄绿调+霓虹红",
    aspectRatio: "1.85:1",
  },
  {
    id: "cinematic-blade-runner",
    name: "赛博朋克",
    nameEn: "Cyberpunk Noir",
    category: "cinematic",
    visualReference: "Blade Runner 2049 / Roger Deakins",
    promptEnhancement: "cyberpunk aesthetic, neon-lit streets, volumetric fog, rain-soaked urban landscape, holographic advertisements, teal and orange color grade, Roger Deakins lighting style, 8K cinematic",
    tags: ["赛博朋克", "霓虹", "科幻", "雨夜"],
    colorPalette: "青橙对比+霓虹紫",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-jurassic",
    name: "侏罗纪冒险",
    nameEn: "Jurassic Adventure",
    category: "cinematic",
    visualReference: "Jurassic Park / Spielberg",
    promptEnhancement: "Spielberg-style epic adventure, lush jungle environment, dramatic backlight, lens flare, wonder and awe atmosphere, sweeping camera movement, golden sunlight through foliage",
    tags: ["冒险", "丛林", "史诗", "暖光"],
    colorPalette: "丛林绿+金色逆光",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-top-gun",
    name: "壮志凌云",
    nameEn: "Top Gun Aerial",
    category: "cinematic",
    visualReference: "Top Gun: Maverick / aerial cinematography",
    promptEnhancement: "aerial cinematography, fighter jet action, dramatic sky lighting, high-speed motion, intense contrast, sun flare, cockpit POV, crisp 8K detail, military precision",
    tags: ["航空", "军事", "高速", "天空"],
    colorPalette: "蓝天+金属银+橙光",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-indiana-jones",
    name: "印第安纳探险",
    nameEn: "Indiana Jones Adventure",
    category: "cinematic",
    visualReference: "Indiana Jones / ancient temple exploration",
    promptEnhancement: "classic adventure film aesthetic, ancient temple ruins, warm torchlight, dust particles in light beams, mysterious atmosphere, wide establishing shots, golden age Hollywood color grade",
    tags: ["冒险", "古庙", "暖光", "经典"],
    colorPalette: "暖金+棕褐+土色",
    aspectRatio: "2.35:1",
  },
  {
    id: "cinematic-western",
    name: "西部史诗",
    nameEn: "Epic Western",
    category: "cinematic",
    visualReference: "The Searchers / John Ford / Sergio Leone",
    promptEnhancement: "epic western cinematography, vast canyon landscapes, dramatic sky, dust and heat haze, silhouette shots against sunset, wide anamorphic framing, sepia-toned color grade, gritty texture",
    tags: ["西部", "峡谷", "黄昏", "剪影"],
    colorPalette: "橙棕+深褐+暗蓝",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-disaster",
    name: "灾难大片",
    nameEn: "Disaster Epic",
    category: "cinematic",
    visualReference: "Roland Emmerich / tidal wave destruction",
    promptEnhancement: "epic disaster film aesthetic, massive tidal wave, dramatic storm clouds, destruction scale, handheld camera shake, desaturated cold color palette, photorealistic water physics",
    tags: ["灾难", "巨浪", "风暴", "冷调"],
    colorPalette: "灰蓝+暗绿+白浪",
    aspectRatio: "2.39:1",
  },
  {
    id: "cinematic-interstellar",
    name: "星际太空",
    nameEn: "Interstellar Space",
    category: "cinematic",
    visualReference: "Interstellar / Gravity / space cinematography",
    promptEnhancement: "space cinematography, zero-gravity environment, stark contrast between light and void, lens flare from distant stars, IMAX scale, scientific accuracy, emotional isolation, Hans Zimmer-level gravitas",
    tags: ["太空", "科幻", "史诗", "IMAX"],
    colorPalette: "深黑+银白+暗蓝",
    aspectRatio: "2.39:1",
  },

  // ========================================================================
  // ADVERTISING & COMMERCIAL — 广告商业
  // ========================================================================
  {
    id: "ad-fashion",
    name: "时尚大片",
    nameEn: "Fashion Commercial",
    category: "advertising",
    visualReference: "Chanel / Gucci / luxury fashion advertising",
    promptEnhancement: "luxury fashion commercial aesthetic, high-key studio lighting, clean composition, elegant slow motion, metallic and marble textures, sophisticated color palette, premium product focus",
    tags: ["时尚", "奢侈", "高端", "棚拍"],
    colorPalette: "黑白+金属金+大理石灰",
    aspectRatio: "16:9",
  },
  {
    id: "ad-minimalist",
    name: "MUJI极简",
    nameEn: "Minimalist Lifestyle",
    category: "advertising",
    visualReference: "MUJI / Apple / minimalist brand advertising",
    promptEnhancement: "minimalist brand aesthetic, clean white space, natural light, soft shadows, zen composition, warm wood textures, lifestyle product placement, Japanese simplicity philosophy",
    tags: ["极简", "日式", "生活", "自然光"],
    colorPalette: "米白+原木+浅灰",
    aspectRatio: "16:9",
  },
  {
    id: "ad-motion-graphics",
    name: "MG动画",
    nameEn: "Motion Graphics",
    category: "advertising",
    visualReference: "Apple keynote / modern motion graphics",
    promptEnhancement: "3D motion graphics style, clean geometric shapes, smooth easing animations, gradient color transitions, minimalist UI elements, dynamic typography, product showcase with fluid camera movement",
    tags: ["动态图形", "3D", "几何", "科技"],
    colorPalette: "渐变紫蓝+纯白",
    aspectRatio: "16:9",
  },

  // ========================================================================
  // ANIME & ANIMATION — 动漫动画
  // ========================================================================
  {
    id: "anime-shonen",
    name: "热血少年漫",
    nameEn: "Shonen Battle Anime",
    category: "anime",
    visualReference: "Dragon Ball / Naruto / Jujutsu Kaisen",
    promptEnhancement: "shonen anime style, dynamic action poses, speed lines, impact frames, vibrant cel shading, exaggerated perspective, energy aura effects, dramatic camera angles, intense facial expressions",
    tags: ["热血", "战斗", "日漫", "动态"],
    colorPalette: "高饱和红+蓝+黄",
    aspectRatio: "16:9",
  },
  {
    id: "anime-ghibli",
    name: "吉卜力治愈",
    nameEn: "Ghibli Style",
    category: "anime",
    visualReference: "宫崎骏 / 吉卜力工作室",
    promptEnhancement: "Studio Ghibli animation style, hand-drawn aesthetic, soft watercolor backgrounds, warm natural lighting, detailed environmental art, gentle character expressions, nostalgic atmosphere, pastoral landscapes",
    tags: ["治愈", "手绘", "自然", "怀旧"],
    colorPalette: "柔和绿+天蓝+暖黄",
    aspectRatio: "16:9",
  },
  {
    id: "anime-mecha",
    name: "机甲科幻",
    nameEn: "Mecha Anime",
    category: "anime",
    visualReference: "Gundam / Evangelion / mecha genre",
    promptEnhancement: "mecha anime style, detailed mechanical parts, metallic rendering, dramatic explosion effects, cockpit interior shots, scale contrast between robot and environment, cel-shaded 3D hybrid rendering",
    tags: ["机甲", "科幻", "战斗", "金属"],
    colorPalette: "金属灰+警示红+能量蓝",
    aspectRatio: "16:9",
  },
  {
    id: "anime-van-gogh",
    name: "梵高印象派",
    nameEn: "Van Gogh Animation",
    category: "anime",
    visualReference: "梵高 / Loving Vincent / 后印象派",
    promptEnhancement: "Van Gogh post-impressionism animation style, heavy impasto brushstrokes, swirling paint texture, vivid blue-yellow contrast, oil painting aesthetic in motion, expressive color usage, emotional visual language",
    tags: ["艺术", "油画", "印象派", "表现"],
    colorPalette: "深蓝+明黄+翠绿",
    aspectRatio: "16:9",
  },
  {
    id: "anime-stylized-3d",
    name: "风格化3D",
    nameEn: "Stylized 3D Animation",
    category: "anime",
    visualReference: "Spider-Verse / Arcane / Puss in Boots 2",
    promptEnhancement: "stylized 3D animation, non-photorealistic rendering, hand-painted textures, exaggerated proportions, dynamic frame rate changes, painterly lighting, graphic novel aesthetic, bold color palette",
    tags: ["3D", "风格化", "手绘贴图", "美式"],
    colorPalette: "高饱和+漫画网点",
    aspectRatio: "16:9",
  },

  // ========================================================================
  // WEB DRAMA — 短剧网络剧
  // ========================================================================
  {
    id: "drama-vertical-romance",
    name: "竖屏霸总",
    nameEn: "Vertical CEO Drama",
    category: "drama",
    visualReference: "抖音/快手竖屏短剧 / 霸总题材",
    promptEnhancement: "vertical short drama style, portrait 9:16 composition, dramatic emotional close-ups, fast-cut editing rhythm, high-contrast lighting, luxury mansion interiors, intense eye contact, dramatic music video aesthetic",
    tags: ["竖屏", "霸总", "情感", "快节奏"],
    colorPalette: "暖金+深红+暗蓝",
    aspectRatio: "9:16",
  },
  {
    id: "drama-rain-emotional",
    name: "雨夜虐恋",
    nameEn: "Rain Night Melodrama",
    category: "drama",
    visualReference: "微短剧情感戏 / 韩剧风格",
    promptEnhancement: "emotional melodrama style, rain-soaked night scenes, extreme close-up of tears and rain, dramatic slow motion, blue-tinted cold color grade, shallow depth of field, emotional outburst moments, handheld camera intimacy",
    tags: ["情感", "雨景", "特写", "虐心"],
    colorPalette: "冷蓝+苍白+暗灰",
    aspectRatio: "9:16",
  },
  {
    id: "drama-period-qing",
    name: "清宫古装",
    nameEn: "Qing Dynasty Court",
    category: "drama",
    visualReference: "甄嬛传 / 延禧攻略 / 清宫剧",
    promptEnhancement: "Qing dynasty court drama aesthetic, ornate palace interiors, silk and embroidery detail, warm candlelight ambiance, symmetrical composition, muted jewel tone color palette, period-accurate costume design, cinematic widescreen framing",
    tags: ["古装", "宫廷", "清宫", "华美"],
    colorPalette: "朱红+明黄+翠玉绿",
    aspectRatio: "16:9",
  },

  // ========================================================================
  // VFX & EXPERIMENTAL — 视觉特效
  // ========================================================================
  {
    id: "vfx-surreal-megalophobia",
    name: "超现实巨物",
    nameEn: "Surreal Megalophobia",
    category: "experimental",
    visualReference: "Dune sandworm / Arrival / Lovecraftian scale",
    promptEnhancement: "surreal megalophobia aesthetic, impossibly large entities, realistic physics rendering, scale contrast with tiny human figures, atmospheric fog and dust, Hollywood SFX quality, epic visual spectacle",
    tags: ["超现实", "巨物", "恐惧", "史诗"],
    colorPalette: "灰黄+暗棕+迷雾白",
    aspectRatio: "2.39:1",
  },
  {
    id: "vfx-fluid-morph",
    name: "流体变形",
    nameEn: "Fluid Morph Transition",
    category: "experimental",
    visualReference: "AI fluid morph / seamless image transition",
    promptEnhancement: "fluid morph transition, seamless shape transformation, liquid metal aesthetic, organic form flow, surreal metamorphosis, high-frame-rate smooth motion, abstract sculptural evolution",
    tags: ["变形", "流体", "抽象", "转场"],
    colorPalette: "金属银+液态紫+有机绿",
    aspectRatio: "16:9",
  },
  {
    id: "vfx-orbital-collision",
    name: "轨道碰撞",
    nameEn: "Orbital Collision Physics",
    category: "experimental",
    visualReference: "Gravity / Interstellar debris / space physics",
    promptEnhancement: "orbital collision physics simulation, realistic debris field, zero-gravity ragdoll motion, dramatic lighting in vacuum, slow-motion destruction, scientific accuracy, IMAX space cinematography",
    tags: ["太空", "物理", "爆炸", "碎屑"],
    colorPalette: "深空黑+银白碎屑+蓝地球光",
    aspectRatio: "2.39:1",
  },

  // ========================================================================
  // DOCUMENTARY — 纪实纪录
  // ========================================================================
  {
    id: "doc-mockumentary",
    name: "伪纪录片",
    nameEn: "Mockumentary Style",
    category: "documentary",
    visualReference: "The Office / What We Do in the Shadows",
    promptEnhancement: "mockumentary style, handheld camera shake, natural available light, direct-to-camera address, zoom lens aesthetic, slightly desaturated color, documentary realism, intimate character moments, vlog-style authenticity",
    tags: ["手持", "真实", "喜剧", "自然光"],
    colorPalette: "自然色+轻微去饱和",
    aspectRatio: "16:9",
  },
  {
    id: "doc-nature",
    name: "自然纪录",
    nameEn: "Nature Documentary",
    category: "documentary",
    visualReference: "BBC Planet Earth / David Attenborough",
    promptEnhancement: "BBC nature documentary style, macro close-up detail, golden hour wildlife photography, ultra-telephoto compression, slow motion animal behavior, pristine natural lighting, 8K detail, immersive soundscape visual",
    tags: ["自然", "动物", "特写", "金光"],
    colorPalette: "自然绿+金色阳光+深蓝天空",
    aspectRatio: "16:9",
  },

  // ========================================================================
  // PHOTOGRAPHY — 摄影风格
  // ========================================================================
  {
    id: "photo-film-noir",
    name: "黑色电影",
    nameEn: "Film Noir",
    category: "photography",
    visualReference: "黑白胶片 / 40年代好莱坞黑色电影",
    promptEnhancement: "classic film noir aesthetic, high-contrast black and white, venetian blind shadow patterns, dramatic chiaroscuro lighting, smoke-filled rooms, low-angle compositions, hard-boiled detective atmosphere, silver gelatin print texture",
    tags: ["黑白", "高反差", "阴影", "复古"],
    colorPalette: "纯黑白+银灰纹理",
    aspectRatio: "1.85:1",
  },
  {
    id: "photo-kodachrome",
    name: "柯达克罗姆",
    nameEn: "Kodachrome Vintage",
    category: "photography",
    visualReference: "Kodachrome 64 / 70年代彩色胶片",
    promptEnhancement: "Kodachrome 64 film aesthetic, warm saturated colors, slight magenta shift, fine film grain, vintage 1970s color palette, golden hour warmth, nostalgic Americana feel, analog photography texture",
    tags: ["胶片", "复古", "饱和", "怀旧"],
    colorPalette: "暖红+金黄+品红偏移",
    aspectRatio: "3:2",
  },
  {
    id: "photo-cinematic-portrait",
    name: "电影人像",
    nameEn: "Cinematic Portrait",
    category: "photography",
    visualReference: "Annie Leibovitz / cinematic portrait photography",
    promptEnhancement: "cinematic portrait photography, dramatic Rembrandt lighting, shallow f/1.4 depth of field, professional studio setup, hair light separation, editorial magazine quality, emotional eye contact, 85mm portrait lens compression",
    tags: ["人像", "棚拍", "戏剧光", "杂志"],
    colorPalette: "暖肤+深背景+眼神光",
    aspectRatio: "4:5",
  },
]

// ============================================================================
// Helpers
// ============================================================================

export function getStylesByCategory(category: StyleCategory): StylePreset[] {
  return STYLE_PRESETS.filter((s) => s.category === category)
}

export function getStyleById(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((s) => s.id === id)
}

export function searchStyles(query: string): StylePreset[] {
  const q = query.toLowerCase()
  return STYLE_PRESETS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.visualReference.toLowerCase().includes(q),
  )
}

/**
 * 将风格prompt注入到已有的视觉提示词中
 */
export function applyStyleToPrompt(basePrompt: string, styleId: string): string {
  const style = getStyleById(styleId)
  if (!style) return basePrompt
  return `${basePrompt.trim()}, ${style.promptEnhancement}`
}
