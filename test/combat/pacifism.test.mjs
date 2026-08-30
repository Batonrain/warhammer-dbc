// test/combat/pacifism.test.mjs
//
// wdbc-gzuf (Серый Человек): «крайне миролюбив» — не входит в Ярость, пока
// не атакован в этом бою. Два независимых куска проверяются здесь:
//   1. applyDamageToActor (damage.mjs) взводит флаг «атакован» только у
//      акторов с capability pacifism.requiresAttackToRage, и только один раз.
//   2. rollPacifismTest (pacifism.mjs) — тест Воли−20, успех проводит в
//      Ярость (обновляет актора), провал — нет.
// Гейт на сам чекбокс system.inRage (preUpdateActor/updateActor в
// warhammer-dbc.mjs) — та же категория, что «Пламенная вера», хук-обвязку
// без стенда Foundry не проверить, тестируется вручную в игре.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { rollPacifismTest, PACIFISM_ATTACKED_FLAG } from "../../module/combat/pacifism.mjs";

function characterActor({ pacifist = false, alreadyAttacked = false, wpTotal = 40, wounds = 30 } = {}) {
  const flags = { [PACIFISM_ATTACKED_FLAG]: alreadyAttacked };
  const items = pacifist ? [{
    id: "trait1", name: "Oteshii Physiology / Физиология Отеший", type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "pacifism.requiresAttackToRage", label: "" }
    ] }] } }
  }] : [];
  const updates = [];
  return {
    id: "char1", name: "Серый Человек", type: "character", updates,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { bonus: 0, total: wpTotal } },
      wounds: { value: wounds, critical: 0, max: wounds }
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

beforeEach(resetCaptured);

describe("applyDamageToActor взводит флаг «атакован» (wdbc-gzuf)", () => {
  it("не миролюбивый актор — флаг не трогается", async () => {
    const actor = characterActor({ pacifist: false });
    await applyDamageToActor(actor, damage());
    expect(actor.getFlag("warhammer-dbc", PACIFISM_ATTACKED_FLAG)).toBe(false);
  });

  it("миролюбивый актор — флаг взводится после первого попадания", async () => {
    const actor = characterActor({ pacifist: true });
    await applyDamageToActor(actor, damage());
    expect(actor.getFlag("warhammer-dbc", PACIFISM_ATTACKED_FLAG)).toBe(true);
  });

  it("уже атакован — повторный setFlag не зовётся зря", async () => {
    const actor = characterActor({ pacifist: true, alreadyAttacked: true });
    let setFlagCalls = 0;
    const origSetFlag = actor.setFlag.bind(actor);
    actor.setFlag = async (...args) => { setFlagCalls++; return origSetFlag(...args); };
    await applyDamageToActor(actor, damage());
    expect(setFlagCalls).toBe(0);
  });
});

describe("rollPacifismTest — тест Воли−20 (wdbc-gzuf)", () => {
  it("успех (бросок ≤ порога) — проводит в Ярость через actor.update", async () => {
    const actor = characterActor({ wpTotal: 40 }); // порог 20
    captured.dice = [15];
    const success = await rollPacifismTest(actor);
    expect(success).toBe(true);
    expect(actor.updates).toContainEqual(expect.objectContaining({ "system.inRage": true }));
  });

  it("провал (бросок > порога) — в Ярость не входит", async () => {
    const actor = characterActor({ wpTotal: 40 }); // порог 20
    captured.dice = [55];
    const success = await rollPacifismTest(actor);
    expect(success).toBe(false);
    expect(actor.updates).toHaveLength(0);
  });

  it("карточка в чат несёт итог теста", async () => {
    const actor = characterActor({ wpTotal: 40 });
    captured.dice = [15];
    await rollPacifismTest(actor);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("15");
  });
});
