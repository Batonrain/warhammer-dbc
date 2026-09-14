// test/combat/cast-out-of-death-damage.test.mjs
//
// Cast Out of Death / Изгнанный из Смерти (wdbc-1rno, Нургл): интеграция в
// combat/damage.mjs::applyDamageToActor — кнопка «Констатировать смерть»
// заменяется строкой, дедлайн регенерации выставляется на 7ч. Не действует
// против варп-оружия. Сама регенерация (тик по worldTime) — в
// test/rules/cast-out-of-death.test.mjs (чистая логика).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../critical-tables.mjs", () => ({
  getCriticalEffect: () => "Голова цели взрывается — цель умирает мгновенно."
}));

import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { CAST_OUT_OF_DEATH_FLAG } from "../../module/rules/cast-out-of-death.mjs";

/** Подставной Персонаж, опционально с Даром «Cast Out of Death». */
function characterActor({ wounds = -5, critical = 25, capabilityKeys = [] } = {}) {
  const items = capabilityKeys.map((key, i) => ({
    id: `cod-item-${i}`, name: "Изгнанный из Смерти", type: "mutation",
    system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const flags = {};
  return {
    id: "char1", name: "Нургломант", type: "character", uuid: "Actor.char1",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      wounds: { value: 0, critical, max: 20 }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 50, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(() => { resetCaptured(); game.time = { worldTime: 1000 }; });

describe("Cast Out of Death: замена кнопки «Констатировать смерть»", () => {
  it("без Дара — обычная кнопка смерти, дедлайн не ставится", async () => {
    const actor = characterActor({ capabilityKeys: [] });
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-crit-death-btn");
    expect(card).not.toContain("Изгнанный из Смерти");
    expect(actor.getFlag("warhammer-dbc", CAST_OUT_OF_DEATH_FLAG)).toBeUndefined();
  });

  it("с Даром — кнопка смерти заменена строкой, дедлайн выставлен на +7ч", async () => {
    const actor = characterActor({ capabilityKeys: ["gift.nurgle.castOutOfDeath"] });
    await applyDamageToActor(actor, damage());
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("wh-crit-death-btn");
    expect(card).toContain("Изгнанный из Смерти");
    expect(actor.getFlag("warhammer-dbc", CAST_OUT_OF_DEATH_FLAG)).toBe(1000 + 7 * 3600);
  });

  it("с Даром, но варп-оружие (warpSoak) — исключение книги, обычная кнопка смерти, дедлайн не ставится", async () => {
    const actor = characterActor({ capabilityKeys: ["gift.nurgle.castOutOfDeath"] });
    await applyDamageToActor(actor, damage({ warpSoak: true }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-crit-death-btn");
    expect(card).not.toContain("Изгнанный из Смерти");
    expect(actor.getFlag("warhammer-dbc", CAST_OUT_OF_DEATH_FLAG)).toBeUndefined();
  });
});
