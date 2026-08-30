// test/documents/combatant-initiative-advantage.test.mjs
//
// wdbc-0tzr: Серый Человек/Oteshii кидает боевую Инициативу трижды и берёт
// лучший результат — механизм ОТДЕЛЬНЫЙ от Inf-Преимущества Эльданара
// (test/apps/creation.test.mjs), см. заголовок module/documents/combatant.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { WarhammerCombatant, applyInitiativeAdvantage,
         INITIATIVE_ADVANTAGE_CAPABILITY } from "../../module/documents/combatant.mjs";

beforeEach(resetCaptured);

describe("applyInitiativeAdvantage: подмена кубика формулы на «kh» (wdbc-0tzr)", () => {
  it("«1d10 + @initiative + @initiativeMod» → «3d10kh1 + …», N по умолчанию 3", () => {
    expect(applyInitiativeAdvantage("1d10 + @initiative + @initiativeMod"))
      .toBe("3d10kh1 + @initiative + @initiativeMod");
  });

  it("количество бросков настраивается явно", () => {
    expect(applyInitiativeAdvantage("1d10", 2)).toBe("2d10kh1");
  });

  it("подряд идущий кубик считается по count×rolls, а не отбрасывается", () => {
    expect(applyInitiativeAdvantage("2d10 + @mod", 3)).toBe("6d10kh1 + @mod");
  });
});

function combatantOf(actorHasAdvantage) {
  const traitItems = actorHasAdvantage ? [{
    id: "trait1", type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: INITIATIVE_ADVANTAGE_CAPABILITY, label: "" }
    ] }] } }
  }] : [];
  const actor = {
    items: Object.assign([...traitItems], { contents: traitItems }),
    getRollData: () => ({})
  };
  const c = Object.create(WarhammerCombatant.prototype);
  Object.defineProperty(c, "actor", { value: actor });
  c._getInitiativeFormula = () => "1d10 + @initiative + @initiativeMod";
  return c;
}

describe("WarhammerCombatant.getInitiativeRoll (wdbc-0tzr)", () => {
  it("без capability — обычная формула, без изменений", () => {
    const roll = combatantOf(false).getInitiativeRoll();
    expect(roll.formula).toBe("1d10 + @initiative + @initiativeMod");
  });

  it("с capability combat.initiativeAdvantage — формула подменяется на «kh»", () => {
    const roll = combatantOf(true).getInitiativeRoll();
    expect(roll.formula).toBe("3d10kh1 + @initiative + @initiativeMod");
  });

  it("явно переданная формула (override) тоже проходит через подмену", () => {
    const roll = combatantOf(true).getInitiativeRoll("1d10 + 5");
    expect(roll.formula).toBe("3d10kh1 + 5");
  });

  it("итог броска действительно берёт больший из трёх d10 (сквозная проверка через заглушку Roll)", async () => {
    // Заглушка Roll не разбирает @-переменные (rollData) — override без них,
    // сама подстановка @initiative/@initiativeMod уже покрыта тестами выше.
    const roll = combatantOf(true).getInitiativeRoll("1d10");
    captured.dice = [3, 9, 5]; // из трёх d10 лучший — 9
    await roll.evaluate();
    expect(roll.total).toBe(9);
  });
});
