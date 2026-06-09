/**
 * 六层身份锚点系统 — 改编自 Moyin Creator 设计模式
 * 
 * 设计思想：从「自然语言描述」递进到「可计算精确值」
 *   - 前三层：语言描述（可被 LLM 理解）
 *   - 第四层：Hex 精确色值（可直接对接 Stable Diffusion / ComfyUI）
 *   - 第五层：皮肤纹理（微观细节）
 *   - 第六层：发型锚点（发际线 + 层次）
 *
 * 强制约束：第三层（uniqueMarks 物理辨识标记）为必填项
 *   - 这是最强锚点，如"左眼下方2cm处的痣"
 *   - 防止 AI 生成时角色"漂移"
 */

// ========= 六层锚点数据结构 =========

export interface SkeletalLayer {
  faceShape: string;    // 脸型："圆脸" | "方脸" | "鹅蛋脸" | "心形脸"
  jawline: string;      // 下颌线："分明" | "圆润" | "尖翘"
  cheekbones: string;   // 颧骨："高" | "平" | "宽"
}

export interface FeaturesLayer {
  eyeShape: string;    // 眼型："丹凤眼" | "杏眼" | "圆眼" | "桃花眼"
  eyeDetails: string;   // 眼细节："单眼皮" | "内双" | "外双" | "双眼皮深度"
  noseShape: string;   // 鼻型："直鼻" | "翘鼻" | "蒜头鼻" | "鹰钩鼻"
  lipShape: string;     // 唇型："薄唇" | "厚唇" | "M字唇" | "樱桃唇"
}

export interface UniqueMarksLayer {
  marks: string[];      // 必填：物理辨识标记，如 ["左眼下方2cm处有一颗痣", "右眉尾有一道小疤痕"]
  scars: string[];      // 疤痕位置描述
  tattoos: string[];    // 纹身位置描述
  birthmarks: string[]; // 胎记位置描述
}

export interface ColorAnchorsLayer {
  iris: string;        // 虹膜色：Hex，如 "#4A2C2A"
  hair: string;         // 发色：Hex，如 "#1A1A1A"
  skin: string;         // 肤色：Hex，如 "#F5D0A6"
  lips: string;         // 唇色：Hex，如 "#C86B6B"
  eyebrows: string;     // 眉色：Hex，如 "#2B1B0A"
}

export interface SkinTextureLayer {
  skinTexture: string;   // 皮肤纹理："细腻" | "毛孔明显" | "有雀斑" | "晒伤痕迹"
  poreDetail: string;   // 毛孔细节
  wrinkleDetail: string; // 皱纹细节（年龄相关）
  lightingReaction: string; // 光线反应："反光明显" | "哑光" | "半哑光"
}

export interface HairAnchorLayer {
  hairlineType: string;  // 发际线："M字额" | "平额" | "圆额" | "后退发际线"
  hairLayers: string;   // 发量层次："厚厚" | "薄" | "中等" | "头顶稀疏"
  hairTexture: string;   // 发质："直" | "卷" | "波浪" | "自然卷"
  uniqueHairMark: string; // 独特发部标记："一缕白发" | "鬓角特别长"
}

// ========= 完整六层身份锚点 =========

export interface IdentityAnchors {
  skeletal: SkeletalLayer;
  features: FeaturesLayer;
  uniqueMarks: UniqueMarksLayer;   // 必填层
  colorAnchors: ColorAnchorsLayer;
  skinTexture: SkinTextureLayer;
  hair: HairAnchorLayer;
}

// ========= 负面提示词互补系统 =========

export interface CharacterNegativePrompt {
  avoid: string[];       // 要排除的特征：["金发", "胡子", "眼镜"]
  styleExclusions: string[]; // 风格排除：["anime style", "cartoon", "3D render"]
  identityPollution: string[]; // 身份污染排除：如 ["different person", "face changed"]
}

// ========= 角色圣经增强（含六层锚点） =========

export interface EnhancedCharacterBible {
  characterName: string;
  aliases: string[];
  role: string;           // 定位："主角" | "配角" | "反派"
  
  // 六层身份锚点（核心一致性保障）
  identityAnchors: IdentityAnchors;
  
  // 负面提示词互补
  negativePrompt: CharacterNegativePrompt;
  
  // 原有字段保留
  visualSignature: string;  // 视觉签名（自然语言摘要）
  costume: string;         // 服装描述
  props: string[];         // 道具列表
  bodyType: string;        // 体型特征
  colorPalette: string[];  // 色彩方案
  backstory: string;       // 背景故事
  arcDescription: string;   // 弧线描述
  
  // 视图参考图（三视图 Base64 或 URL）
  referenceImages: {
    front?: string;
    side?: string;
    back?: string;
    threeQuarter?: string;
  };
  
  // 变体系统（服装/年龄阶段变化）
  variations: CharacterVariation[];
  
  // 元数据
  version: number;
  lastUpdated: number;  // timestamp
  complianceScore?: number; // 合规评分（0-100）
}

export interface CharacterVariation {
  id: string;
  name: string;           // "日常装" | "战斗装" | "青年版"
  description: string;
  identityAnchorsOverride?: Partial<IdentityAnchors>; // 部分覆盖（如换装不改变脸）
  referenceImage?: string;
  episodeRange?: [number, number]; // 适用集数范围
}

// ========= 构建辅助函数 =========

/** 创建默认的六层身份锚点（用于新角色初始化）*/
export function createDefaultIdentityAnchors(): IdentityAnchors {
  return {
    skeletal: { faceShape: '', jawline: '', cheekbones: '' },
    features: { eyeShape: '', eyeDetails: '', noseShape: '', lipShape: '' },
    uniqueMarks: { marks: [], scars: [], tattoos: [], birthmarks: [] }, // 必填，初始化为空
    colorAnchors: { iris: '', hair: '', skin: '', lips: '', eyebrows: '' },
    skinTexture: { skinTexture: '', poreDetail: '', wrinkleDetail: '', lightingReaction: '' },
    hair: { hairlineType: '', hairLayers: '', hairTexture: '', uniqueHairMark: '' },
  };
}

/** 验证六层锚点完整性 — 第三层（uniqueMarks）为必填 */
export function validateIdentityAnchors(anchors: IdentityAnchors): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { uniqueMarks, colorAnchors } = anchars;

  // 第三层：强制至少一个物理辨识标记
  const totalMarks = [
    ...uniqueMarks.marks,
    ...uniqueMarks.scars,
    ...uniqueMarks.tattoos,
    ...uniqueMarks.birthmarks,
  ];
  if (totalMarks.length === 0) {
    errors.push('第三层（物理辨识标记）为必填项，请至少填写一项（如"左眼下方有痣"）');
  }

  // 第四层：Hex 色值格式校验
  const hexFields = [
    { key: 'iris', value: colorAnchors.iris },
    { key: 'hair', value: colorAnchors.hair },
    { key: 'skin', value: colorAnchors.skin },
    { key: 'lips', value: colorAnchors.lips },
    { key: 'eyebrows', value: colorAnchors.eyebrows },
  ];
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  for (const { key, value } of hexFields) {
    if (value && !hexPattern.test(value)) {
      errors.push(`第四层色值 "${key}" 格式错误，请使用 Hex 格式（如 #4A2C2A）`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** 将六层锚点编译为 AI 提示词（正向） */
export function compileIdentityPrompt(anchars: IdentityAnchors): string {
  const parts: string[] = [];

  // 第一层 + 第二层：外貌描述
  const { skeletal, features } = anchars;
  if (skeletal.faceShape) parts.push(`face shape: ${skeletal.faceShape}, jawline: ${skeletal.jawline}`);
  if (features.eyeShape) parts.push(`eyes: ${features.eyeShape}, ${features.eyeDetails}`);
  if (features.noseShape) parts.push(`nose: ${features.noseShape}`);
  if (features.lipShape) parts.push(`lips: ${features.lipShape}`);

  // 第三层：物理辨识标记（最强锚点，放在最前面）
  const { uniqueMarks } = anchars;
  const allMarks = [...uniqueMarks.marks, ...uniqueMarks.scars, ...uniqueMarks.tattoos];
  if (allMarks.length > 0) {
    parts.unshift(`IDENTITY MARKS: ${allMarks.join('; ')}`);
  }

  // 第四层：精确色值
  const { colorAnchors } = anchars;
  const colorParts: string[] = [];
  if (colorAnchors.iris) colorParts.push(`iris ${colorAnchors.iris}`);
  if (colorAnchors.hair) colorParts.push(`hair ${colorAnchors.hair}`);
  if (colorAnchors.skin) colorParts.push(`skin ${colorAnchors.skin}`);
  if (colorAnchors.lips) colorParts.push(`lips ${colorAnchors.lips}`);
  if (colorParts.length > 0) parts.push(`color references: ${colorParts.join(', ')}`);

  // 第五层：皮肤纹理
  const { skinTexture } = anchars;
  if (skinTexture.skinTexture) parts.push(`skin texture: ${skinTexture.skinTexture}, ${skinTexture.lightingReaction}`);

  // 第六层：发型锚点
  const { hair } = anchars;
  if (hair.hairlineType) parts.push(`hair: ${hair.hairlineType}, ${hair.hairTexture}${hair.uniqueHairMark ? `, unique: ${hair.uniqueHairMark}` : ''}`);

  return parts.join('; ');
}

/** 将负面提示词编译为 AI 负面提示词字符串 */
export function compileNegativePrompt(negative: CharacterNegativePrompt): string {
  return [...negative.avoid, ...negative.styleExclusions, ...negative.identityPollution].join(', ');
}

/** 从自然语言描述推断色值（简易映射表，可扩展为 AI 调用） */
export function inferColorHex(description: string): string {
  const colorMap: Record<string, string> = {
    '黑色': '#1A1A1A', '黑色': '#000000',
    '深棕': '#3B2F2F', '棕色': '#4A3728', '浅棕': '#8B7355',
    '深蓝': '#1A2B4A', '蓝色': '#4A6FA5', '浅蓝': '#87CEEB',
    '深绿': '#1A3C2A', '绿色': '#4A7A5A', '浅绿': '#90EE90',
    '深灰': '#2B2B2B', '灰色': '#808080', '浅灰': '#D3D3D3',
    '白色': '#FFFFFF', '米白': '#F5F0E8',
    '粉红': '#F5C6C6', '红色': '#C62D2D', '深红': '#8B1A1A',
    '紫色': '#6A4C9A', '黄色': '#E8D44A', '金色': '#D4A843',
  };
  
  for (const [key, hex] of Object.entries(colorMap)) {
    if (description.includes(key)) return hex;
  }
  return ''; // 未匹配到，需要用户手动填写
}
