// test/combat/blade-shield.test.mjs
//
// wdbc-bwf9: Парирование психосил Талантом «Щит Клинков». Условие книжное и
// двойное — Талант на персонаже И разрешённый предмет ИМЕННО В РУКАХ; здесь
// проверяются обе половины по отдельности, потому что каждая по отдельности
// уже встречалась в жалобах («Талант есть, а кнопка не работает»).

import { describe, it, expect } from "vitest";

import { canParryPsychic, psychicParryOutcome, hasBladeShield, psychicParryTool,
         BLADE_SHIELD_CAPABILITY, PSYCHIC_PARRY_TOOL_CAPABILITY,
         PSYCHIC_PARRY_WEAK_CAPABILITY } from "../../module/combat/blade-shield.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

const withCapability = (key, extra = {}) => ({
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }, ...extra
});

/** Оружие в руке (equipped + требует руку) с записью Конструктора. */
function tool(name, keys = [], quality = "common") {
  return {
    id: name, type: "weapon", name,
    system: { equipped: true, weaponClass: "melee", meleeCategory: "Меч", grips: "1р", quality },
    getFlag: (_ns, k) => (k === "mechanics"
      ? keys.map((key, i) => ({ id: `g${i}`, operator: "AND",
          entries: [{ id: `e${i}`, kind: "capability", capabilityKey: key, label: "" }] }))
      : null)
  };
}

/** Оружие БЕЗ записи — обычный меч. */
const plainSword = tool("Меч", []);

function actor(items) {
  return { items: Object.assign([...items], { contents: items }) };
}

const talent = { id: "t", type: "talent", ...withCapability(BLADE_SHIELD_CAPABILITY) };

describe("canParryPsychic: условие из двух половин (wdbc-bwf9)", () => {
  it("ни Таланта, ни клинка — отказ, и назван именно Талант", () => {
    const res = canParryPsychic(actor([plainSword]));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Щит Клинков");
  });

  it("Талант есть, но в руках обычный меч — отказ, и назван предмет", () => {
    const res = canParryPsychic(actor([talent, plainSword]));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("ноктикового щита");
  });

  it("клинок есть, но Таланта нет — отказ", () => {
    const res = canParryPsychic(actor([tool("Ведьмин Клинок", [PSYCHIC_PARRY_TOOL_CAPABILITY])]));
    expect(res.ok).toBe(false);
  });

  it("Талант + подходящий клинок в руках — можно, и предмет назван", () => {
    const blade = tool("Ведьмин Клинок", [PSYCHIC_PARRY_TOOL_CAPABILITY]);
    const res = canParryPsychic(actor([talent, blade]));
    expect(res.ok).toBe(true);
    expect(res.tool.name).toBe("Ведьмин Клинок");
    expect(res.weakens).toBe(false);
  });

  it("НЕ надетый клинок не считается — в рюкзаке психосилу не отбить", () => {
    const stowed = tool("Ведьмин Клинок", [PSYCHIC_PARRY_TOOL_CAPABILITY]);
    stowed.system.equipped = false;
    expect(canParryPsychic(actor([talent, stowed])).ok).toBe(false);
  });

  it("ослабление — только у Poor.Q, обычное качество развеивает целиком", () => {
    const keys = [PSYCHIC_PARRY_TOOL_CAPABILITY, PSYCHIC_PARRY_WEAK_CAPABILITY];
    expect(canParryPsychic(actor([talent, tool("Ноктиковый щит", keys, "poor")])).weakens).toBe(true);
    expect(canParryPsychic(actor([talent, tool("Ноктиковый щит", keys, "common")])).weakens).toBe(false);
  });
});

describe("hasBladeShield / psychicParryTool по отдельности", () => {
  it("Талант виден на акторе", () => {
    expect(hasBladeShield(actor([talent]))).toBe(true);
    expect(hasBladeShield(actor([]))).toBe(false);
  });

  it("инструмент ищется среди занимающих руки", () => {
    const blade = tool("Ведьмин Клинок", [PSYCHIC_PARRY_TOOL_CAPABILITY]);
    expect(psychicParryTool(actor([plainSword, blade]))?.name).toBe("Ведьмин Клинок");
    expect(psychicParryTool(actor([plainSword]))).toBeNull();
  });
});

describe("psychicParryOutcome: что даёт успех (wdbc-bwf9)", () => {
  it("провал не отменяет и не ослабляет ничего", () => {
    expect(psychicParryOutcome(false, 3, false, 5)).toEqual({ negated: false, ePRLeft: 5, drop: 0 });
  });

  it("успех обычным инструментом нивелирует силу целиком, сколько бы степеней ни было", () => {
    expect(psychicParryOutcome(true, 1, false, 7)).toEqual({ negated: true, ePRLeft: 0, drop: 7 });
  });

  it("Poor.Q ноктик снижает эPR на число успехов, а не отменяет", () => {
    expect(psychicParryOutcome(true, 2, true, 5)).toEqual({ negated: false, ePRLeft: 3, drop: 2 });
  });

  it("Poor.Q, дожавший эPR до нуля, всё-таки отменяет силу", () => {
    expect(psychicParryOutcome(true, 4, true, 3)).toEqual({ negated: true, ePRLeft: 0, drop: 3 });
  });
});

describe("имена возможностей значатся в реестре", () => {
  it("оба новых имени известны Конструктору", () => {
    expect(isKnownCapability(PSYCHIC_PARRY_TOOL_CAPABILITY)).toBe(true);
    expect(isKnownCapability(PSYCHIC_PARRY_WEAK_CAPABILITY)).toBe(true);
  });
});
