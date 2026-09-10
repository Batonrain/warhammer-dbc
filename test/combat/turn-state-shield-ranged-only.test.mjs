// test/combat/turn-state-shield-ranged-only.test.mjs
//
// Кровопомазанник (Дар Кхорна, wdbc-1rno) выдаёт щит-дефлектор ТОЛЬКО от
// стрелковых атак/взрывов — module/combat/damage.mjs::_rollActiveShield
// должен вовсе не рассматривать такой щит (flags.warhammer-dbc.
// turnStateShieldRangedOnly) против рукопашного попадания (melee:true), но
// применять его как обычно против стрелкового/взрывного (melee:false).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ rangedOnly = true } = {}) {
  const items = [{
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating: 99, overloadThreshold: 0,
      shieldType: "deflector", shieldNature: "warp"
    },
    flags: rangedOnly ? { "warhammer-dbc": { turnStateShieldRangedOnly: true } } : {},
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update() {}
  }];
  return {
    id: "char1", name: "Кровопомазанник", type: "character",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { bonus: 3 } },
      wounds: { value: 20, critical: 0, max: 20 }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "energy", hitLocation: "Торс",
  attackerName: "Враг", weaponName: "Оружие", ...over
});

beforeEach(resetCaptured);

describe("щит «только от стрелковых» (RANGED_ONLY_FLAG)", () => {
  it("рукопашное попадание (melee:true) — щит не рассматривается вовсе, урон проходит", async () => {
    const actor = characterActor({ rangedOnly: true });
    captured.dice = [1]; // если бы щит катился — 1 всегда блокирует (rating 99)
    await applyDamageToActor(actor, damage({ melee: true }));

    expect(captured.rolls.length).toBe(0); // щит не катился вовсе
    expect(actor.system.wounds.value).toBeLessThan(20); // урон реально прошёл
  });

  it("стрелковое попадание (melee:false) — щит рассматривается как обычно, блокирует", async () => {
    const actor = characterActor({ rangedOnly: true });
    captured.dice = [1]; // ≤ rating 99 → блокировано
    await applyDamageToActor(actor, damage({ melee: false }));

    expect(actor.system.wounds.value).toBe(20); // попадание аннулировано щитом
  });

  it("обычный щит (без флага) — рассматривается и от рукопашного попадания тоже", async () => {
    const actor = characterActor({ rangedOnly: false });
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ melee: true }));

    expect(actor.system.wounds.value).toBe(20); // обычный щит блокирует и рукопашное
  });
});
