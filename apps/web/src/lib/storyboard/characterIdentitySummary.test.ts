import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDefaultCharacterIdentity,
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
