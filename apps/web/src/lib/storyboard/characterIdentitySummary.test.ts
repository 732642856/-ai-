import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDefaultCharacterIdentity,
  buildCharacterConsistencyPrompt,
  formatCharacterIdentityListInput,
  parseCharacterIdentityListInput,
  summarizeCharacterIdentities,
  updateCharacterIdentityField,
} from "./characterIdentitySummary.ts";

void describe("summarizeCharacterIdentities", () => {
  void it("creates compact UI summaries from character identity assets", () => {
    const summaries = summarizeCharacterIdentities([
      {
        id: "char-linxia",
        name: "女主林夏",
        aliases: ["红衣女主", "钥匙持有者"],
        role: "protagonist",
        visualSignature: "young woman with sharp oval face, short black bob haircut, anxious eyes, small mole under left eye",
        costume: "same red wool coat with brass buttons",
        props: ["old brass key", "black shoulder bag"],
        physicalTraits: ["slim silhouette"],
        colorPalette: ["deep red", "cold blue corridor light"],
      },
    ]);

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.id, "char-linxia");
    assert.equal(summaries[0]?.headline, "女主林夏 · protagonist");
    assert.deepEqual(summaries[0]?.details, [
      "别名 红衣女主/钥匙持有者",
      "识别 young woman with sharp oval face, short black bob haircut, anxi…",
      "服装 same red wool coat with brass buttons",
      "道具 old brass key、black shoulder bag",
    ]);
  });

  void it("filters empty identities and limits visible summaries", () => {
    const summaries = summarizeCharacterIdentities([
      { id: "empty", name: " " },
      { id: "a", name: "角色A" },
      { id: "b", name: "角色B" },
      { id: "c", name: "角色C" },
      { id: "d", name: "角色D" },
    ], 2);

    assert.deepEqual(summaries.map((summary) => summary.name), ["角色A", "角色B"]);
  });

  void it("parses and formats editable list fields", () => {
    assert.deepEqual(parseCharacterIdentityListInput("钥匙、黑包, 红衣，钥匙\n冷光"), [
      "钥匙",
      "黑包",
      "红衣",
      "冷光",
    ]);
    assert.equal(formatCharacterIdentityListInput(["钥匙", "黑包", "钥匙", " "]), "钥匙、黑包");
  });

  void it("updates editable fields without mutating the source array", () => {
    const source = [{ id: "char-1", name: "旧角色", props: ["旧道具"] }];
    const renamed = updateCharacterIdentityField(source, 0, "name", " 新角色 ");
    const propsUpdated = updateCharacterIdentityField(renamed, 0, "props", "钥匙、黑包");

    assert.equal(source[0]?.name, "旧角色");
    assert.equal(renamed[0]?.name, "新角色");
    assert.deepEqual(propsUpdated[0]?.props, ["钥匙", "黑包"]);
  });

  void it("creates default editable identities", () => {
    const identities = appendDefaultCharacterIdentity(undefined);

    assert.equal(identities.length, 1);
    assert.match(identities[0]?.id ?? "", /^manual-character-/);
    assert.equal(identities[0]?.name, "角色1");
  });
});

void describe("buildCharacterConsistencyPrompt", () => {
  const sampleIdentities = [
    {
      id: "char-1",
      name: "林夏",
      aliases: [],
      role: "protagonist" as const,
      visualSignature: "young woman with sharp oval face, short black bob haircut",
      costume: "red wool coat with brass buttons",
      props: ["brass key", "black bag"],
      physicalTraits: ["slim silhouette", "anxious eyes"],
      colorPalette: ["deep red", "cold blue"],
    },
    {
      id: "char-2",
      name: "陈默",
      aliases: [],
      role: "antagonist" as const,
      visualSignature: "tall man with scarred left cheek, military posture",
      costume: "dark trench coat",
      props: ["silver lighter"],
      physicalTraits: ["broad shoulders"],
      colorPalette: ["dark grey", "crimson"],
    },
  ];

  void it("builds prompt with visual details for each character", () => {
    const prompt = buildCharacterConsistencyPrompt(sampleIdentities);

    assert.ok(prompt.startsWith("[Character consistency requirements:"), `Unexpected start: ${prompt.substring(0, 40)}`);
    assert.match(prompt, /林夏 \(protagonist\)/);
    assert.match(prompt, /sharp oval face/);
    assert.match(prompt, /red wool coat/);
    assert.match(prompt, /brass key, black bag/);
    assert.match(prompt, /陈默 \(antagonist\)/);
    assert.match(prompt, /scarred left cheek/);
    assert.match(prompt, /dark trench coat/);
    assert.match(prompt, /deep red, cold blue/);
    assert.match(prompt, /dark grey, crimson/);
  });

  void it("returns empty string for undefined or empty array", () => {
    assert.equal(buildCharacterConsistencyPrompt(undefined), "");
    assert.equal(buildCharacterConsistencyPrompt([]), "");
  });

  void it("skips identities with empty name", () => {
    const prompt = buildCharacterConsistencyPrompt([
      { id: "bad", name: "", visualSignature: "invisible" },
      ...sampleIdentities,
    ]);
    assert.ok(!prompt.includes("invisible"), "Empty-name identity should be skipped");
    assert.match(prompt, /林夏/);
  });

  void it("caps at 5 characters to keep prompt concise", () => {
    const manyChars = Array.from({ length: 8 }, (_, i) => ({
      id: `char-${i}`,
      name: `角色${i + 1}`,
      visualSignature: `very tall with ${i} features`,
    }));
    const prompt = buildCharacterConsistencyPrompt(manyChars);
    // Only first 5 should appear
    assert.match(prompt, /角色1/);
    assert.match(prompt, /角色5/);
    assert.ok(!prompt.includes("角色6"), "Should cap at 5 characters");
  });

  void it("still works with minimal identities (name only)", () => {
    const prompt = buildCharacterConsistencyPrompt([
      { id: "min", name: "只有名字" },
    ]);
    // Should not crash, but also should not include "(角色名)" nonsense
    assert.equal(prompt, "");
  });
});
