import type { CharacterIdentityAsset, CharacterBibleData } from "@/app/canvas/components/canvas/types";

export type CharacterIdentitySummary = {
  id: string;
  name: string;
  role?: string;
  headline: string;
  details: string[];
};

export type EditableCharacterIdentityField =
  | "name"
  | "role"
  | "visualSignature"
  | "costume"
  | "props";

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

export function parseCharacterIdentityListInput(value: string): string[] {
  return unique(value.split(/[、,，\n]/g));
}

export function formatCharacterIdentityListInput(values: string[] | undefined): string {
  return unique(values ?? []).join("、");
}

export function createDefaultCharacterIdentity(index: number): CharacterIdentityAsset {
  return {
    id: `manual-character-${Date.now()}-${index + 1}`,
    name: `角色${index + 1}`,
    visualSignature: "",
    costume: "",
  };
}

export function updateCharacterIdentityField(
  identities: CharacterIdentityAsset[] | undefined,
  index: number,
  field: EditableCharacterIdentityField,
  value: string,
): CharacterIdentityAsset[] {
  const next = [...(identities ?? [])];
  const current = next[index] ?? createDefaultCharacterIdentity(index);

  if (field === "props") {
    const props = parseCharacterIdentityListInput(value);
    next[index] = props.length > 0 ? { ...current, props } : { ...current, props: undefined };
    return next;
  }

  const clean = cleanText(value);
  next[index] = { ...current, [field]: clean || undefined };
  return next;
}

export function appendDefaultCharacterIdentity(
  identities: CharacterIdentityAsset[] | undefined,
): CharacterIdentityAsset[] {
  const next = [...(identities ?? [])];
  next.push(createDefaultCharacterIdentity(next.length));
  return next;
}

function truncateText(value: string, maxLength = 64): string {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1)}…`;
}

export function summarizeCharacterIdentities(
  identities: CharacterIdentityAsset[] | undefined,
  maxIdentities = 3,
): CharacterIdentitySummary[] {
  return (identities ?? [])
    .filter((identity) => cleanText(identity.name))
    .slice(0, maxIdentities)
    .map((identity, index) => {
      const name = cleanText(identity.name);
      const role = cleanText(identity.role);
      const aliases = unique(identity.aliases ?? []);
      const props = unique(identity.props ?? []);
      const traits = unique(identity.physicalTraits ?? []);
      const palette = unique(identity.colorPalette ?? []);
      const visualSignature = cleanText(identity.visualSignature);
      const costume = cleanText(identity.costume);
      const details = unique([
        aliases.length ? `别名 ${aliases.slice(0, 2).join("/")}` : "",
        visualSignature ? `识别 ${truncateText(visualSignature)}` : "",
        costume ? `服装 ${truncateText(costume)}` : "",
        props.length ? `道具 ${props.slice(0, 3).join("、")}` : "",
        traits.length ? `特征 ${traits.slice(0, 2).join("、")}` : "",
        palette.length ? `色彩 ${palette.slice(0, 3).join("、")}` : "",
      ]).slice(0, 4);

      return {
        id: cleanText(identity.id) || `character-${index + 1}`,
        name,
        role: role || undefined,
        headline: role ? `${name} · ${role}` : name,
        details,
      };
    });
}

/**
 * 为图像生成构建角色一致性提示词片段（英文，用于注入 Stable Diffusion / DALL·E 提示词）
 * 对标 TapNow NBP 一致性 + 小云雀资产联动
 */
export function buildCharacterConsistencyPrompt(
  identities: CharacterIdentityAsset[] | undefined,
): string {
  if (!identities?.length) return "";

  const chars = identities
    .filter((id) => cleanText(id.name))
    .slice(0, 5); // 最多 5 个角色避免提示词过长

  if (chars.length === 0) return "";

  const lines: string[] = [];
  for (const char of chars) {
    const name = cleanText(char.name);
    const role = cleanText(char.role);
    const signature = cleanText(char.visualSignature);
    const costume = cleanText(char.costume);
    const props = unique(char.props ?? []);
    const traits = unique(char.physicalTraits ?? []);
    const palette = unique(char.colorPalette ?? []);

    const parts: string[] = [];
    if (signature) parts.push(signature);
    if (costume) parts.push(`wearing ${costume}`);
    if (props.length) parts.push(`with ${props.slice(0, 2).join(", ")}`);
    if (traits.length) parts.push(traits.slice(0, 2).join(", "));
    if (palette.length) parts.push(`color palette: ${palette.slice(0, 2).join(", ")}`);

    if (parts.length === 0) continue;

    const label = role ? `${name} (${role})` : name;
    lines.push(`${label}: ${parts.join(". ")}`);
  }

  if (lines.length === 0) return "";

  // 用方括号包裹让 AI 理解这是角色约束而非场景描述
  return `[Character consistency requirements: ${lines.join("; ")}]`;
}

/**
 * 为单个角色构建图像生成提示词描述（英文，用于 Ideogram / SD / DALL·E）
 * 从 CharacterBibleData 提取关键视觉信息，生成连贯的英文描述
 */
export function buildCharacterIdentitySummary(char: CharacterBibleData): string {
  const parts: string[] = [];

  // 主体身份
  const identityParts: string[] = [];
  if (char.name) identityParts.push(char.name);
  if (char.role) identityParts.push(`(${char.role})`);
  if (identityParts.length) parts.push(identityParts.join(" "));

  // 外貌特征
  if (char.visualSignature) parts.push(char.visualSignature);
  if (char.physicalTraits?.length) parts.push(char.physicalTraits.join(", "));

  // 服装
  if (char.costume) parts.push(`wearing ${char.costume}`);

  // 道具
  if (char.props?.length) parts.push(`holding ${char.props.join(", ")}`);

  // 色彩
  if (char.colorPalette?.length) parts.push(`color palette: ${char.colorPalette.join(", ")}`);

  // 背景故事（简短，避免提示词过长）
  if (char.backstory) {
    const shortBackstory = char.backstory.slice(0, 120);
    parts.push(`character background: ${shortBackstory}${char.backstory.length > 120 ? "..." : ""}`);
  }

  // 人物弧光（简短）
  if (char.arcDescription) {
    const shortArc = char.arcDescription.slice(0, 80);
    parts.push(`character arc: ${shortArc}${char.arcDescription.length > 80 ? "..." : ""}`);
  }

  return parts.join(". ");
}
