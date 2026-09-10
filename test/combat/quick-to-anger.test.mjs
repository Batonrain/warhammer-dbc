// test/combat/quick-to-anger.test.mjs
//
// Warp-Touched/Затронутый Варпом, субмутация 8 «Вспыльчивость» (wdbc-5inv,
// khorne): «При получении атаки... персонаж должен пройти тест на W+0 или
// впасть в Ярость». Хук — та же единая точка урона, что уже взводит флаг
// Pacifism (combat/damage.mjs::applyDamageToActor), см. test/combat/
// pacifism.test.mjs за образец харнесса.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { QUICK_TO_ANGER_CAPABILITY } from "../../module/rules/quick-to-anger.mjs";

function characterActor({ hasGift = false, inRage = false, wpTotal = 40, wounds = 30 } = {}) {
  const items = hasGift ? [{
    id: "mut1", name: "Warp-Touched / Затронутый Варпом", type: "mutation",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: QUICK_TO_ANGER_CAPABILITY, label: "" }
    ] }] } }
  }] : [];
  const flags = {};
  const updates = [];
  return {
    id: "char1", name: "Затронутый Варпом", type: "character", updates,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { bonus: 0, total: wpTotal } },
      wounds: { value: wounds, critical: 0, max: wounds },
      inRage
    },
    items: Object.assign([...items], { contents: items }),
    getFlag: (scope, key) => (scope === "warhammer-dbc" ? flags[key] : undefined),
    async setFlag(scope, key, value) { if (scope === "warhammer-dbc") flags[key] = value; },
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
      if (data["system.inRage"] !== undefined) this.system.inRage = data["system.inRage"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Культист", weaponName: "Нож", ...over
});

beforeEach(() => { resetCaptured(); captured.nextRoll = 50; });

// Вспыльчивость катается ДО остальной обработки урона (она же тоже постит
// свою карточку) — своя карточка ищется по заголовку, не по позиции в chat.
const angerCard = () => captured.chat.find(c => c.content.includes("Вспыльчивость"));

describe("applyDamageToActor катает Вспыльчивость (wdbc-5inv)", () => {
  it("без субмутации — своей карточки нет (обычная карточка урона есть)", async () => {
    const actor = characterActor({ hasGift: false });
    await applyDamageToActor(actor, damage());
    expect(angerCard()).toBeUndefined();
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("с субмутацией, провал (W 40, бросок 90) — впадает в Ярость", async () => {
    const actor = characterActor({ hasGift: true, wpTotal: 40 });
    captured.nextRoll = 90;
    await applyDamageToActor(actor, damage());
    expect(actor.system.inRage).toBe(true);
    expect(angerCard().content).toContain("Провал");
  });

  it("с субмутацией, успех (W 40, бросок 10) — Ярость не наступает", async () => {
    const actor = characterActor({ hasGift: true, wpTotal: 40 });
    captured.nextRoll = 10;
    await applyDamageToActor(actor, damage());
    expect(actor.system.inRage).toBeFalsy();
    expect(angerCard().content).toContain("Успех");
  });

  it("персонаж уже в Ярости — тест не катается повторно", async () => {
    const actor = characterActor({ hasGift: true, inRage: true });
    captured.nextRoll = 90;
    await applyDamageToActor(actor, damage());
    expect(angerCard()).toBeUndefined();
  });
});
