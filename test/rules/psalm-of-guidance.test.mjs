// test/rules/psalm-of-guidance.test.mjs
//
// wdbc-1rno.5 (находка 8/12): hasPsalmOfGuidance/actorHasEquippedCognisWeapon/
// psalmCognitionCost/canSpendCognition/spendCognition — без Foundry.

import { describe, it, expect } from "vitest";
import {
  hasPsalmOfGuidance, actorHasEquippedCognisWeapon, psalmCognitionCost,
  canSpendCognition, spendCognition, PSALM_OF_GUIDANCE_CAPABILITY
} from "../../module/rules/psalm-of-guidance.mjs";

const psalmItem = () => ({ type: "techPower", name: "Psalm of the Guidance / Псалом Наставления", flags: {} });
const psalmByKey = () => ({
  type: "techPower", name: "Переименовали в паке",
  // isItemActive (apps/effects.mjs) требует techPower miracleType:"passive"
  // (или sustained) — Псалом Наставления в паке именно такой.
  system: { miracleType: "passive" },
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: PSALM_OF_GUIDANCE_CAPABILITY }
  ] }] } }
});
const cognisWeapon = (equipped = true) => ({
  type: "weapon", name: "Ружьё с духом", system: { equipped, weaponProps: [{ key: "cognis" }] }
});
const plainWeapon = () => ({ type: "weapon", name: "Обычное ружьё", system: { equipped: true, weaponProps: [] } });

describe("hasPsalmOfGuidance", () => {
  it("находит по имени", () => {
    expect(hasPsalmOfGuidance({ items: [psalmItem()] })).toBe(true);
  });
  it("находит по capabilityKey", () => {
    expect(hasPsalmOfGuidance({ items: [psalmByKey()] })).toBe(true);
  });
  it("нет Техночуда — false", () => {
    expect(hasPsalmOfGuidance({ items: [] })).toBe(false);
  });
});

describe("actorHasEquippedCognisWeapon", () => {
  it("экипированное Cognis-оружие — true", () => {
    expect(actorHasEquippedCognisWeapon({ items: [cognisWeapon()] })).toBe(true);
  });
  it("Cognis-оружие, но НЕ экипировано — false", () => {
    expect(actorHasEquippedCognisWeapon({ items: [cognisWeapon(false)] })).toBe(false);
  });
  it("обычное оружие без Cognis — false", () => {
    expect(actorHasEquippedCognisWeapon({ items: [plainWeapon()] })).toBe(false);
  });
  it("нет оружия вовсе — false, не падает", () => {
    expect(actorHasEquippedCognisWeapon({ items: [] })).toBe(false);
    expect(actorHasEquippedCognisWeapon(null)).toBe(false);
  });
});

describe("psalmCognitionCost", () => {
  const actorWith = items => ({ items });

  it("есть Техночудо и Cognis-оружие — 1 для Полу-, 2 для Полного", () => {
    const actor = actorWith([psalmItem(), cognisWeapon()]);
    expect(psalmCognitionCost(actor, "half")).toBe(1);
    expect(psalmCognitionCost(actor, "full")).toBe(2);
  });

  it("есть Техночудо, но нет экипированного Cognis-оружия — null", () => {
    expect(psalmCognitionCost(actorWith([psalmItem(), plainWeapon()]), "half")).toBeNull();
  });

  it("есть Cognis-оружие, но нет Техночуда — null", () => {
    expect(psalmCognitionCost(actorWith([cognisWeapon()]), "half")).toBeNull();
  });
});

describe("canSpendCognition/spendCognition", () => {
  function actorWithCognition(value) {
    const a = { system: { cognition: { value } }, update: async data => {
      if (data["system.cognition.value"] !== undefined) a.system.cognition.value = data["system.cognition.value"];
    } };
    return a;
  }

  it("хватает — true, списывает", async () => {
    const actor = actorWithCognition(3);
    expect(canSpendCognition(actor, 2)).toBe(true);
    expect(await spendCognition(actor, 2)).toBe(true);
    expect(actor.system.cognition.value).toBe(1);
  });

  it("не хватает — false, не списывает", async () => {
    const actor = actorWithCognition(1);
    expect(canSpendCognition(actor, 2)).toBe(false);
    expect(await spendCognition(actor, 2)).toBe(false);
    expect(actor.system.cognition.value).toBe(1);
  });
});
