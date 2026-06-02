import type { CharacterIdentityAsset } from "@/app/canvas/components/canvas/types";

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
