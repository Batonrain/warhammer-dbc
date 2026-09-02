// test/rules/eternal-war.test.mjs
//
// wdbc-173l: Талант «The Eternal War / Вечная Война» — дуэль с Кровожадом/ХС
// даёт +3×T.b аблативных Ран до конца битвы с ним.

import { describe, it, expect } from "vitest";
import { isEternalWarItem, eternalWarGrant, eternalWarClear, eternalWarShrinkToFit }
  from "../../module/rules/eternal-war.mjs";

describe("isEternalWarItem", () => {
  it("узнаёт Талант по книжному двуязычному имени", () => {
    expect(isEternalWarItem({ type: "talent", name: "The Eternal War / Вечная Война" })).toBe(true);
  });
  it("не путает с другим Талантом", () => {
    expect(isEternalWarItem({ type: "talent", name: "Sekhmet / Сехмет" })).toBe(false);
  });
});

describe("eternalWarGrant: 3×T.b, одноразово (не складывается)", () => {
  it("с нуля", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(eternalWarGrant(system, 0, 5)).toEqual({ ablative: 15, ablativeMax: 15, contribution: 15 });
  });

  it("повторный вызов заменяет прошлый вклад, не складывает", () => {
    const system = { wounds: { ablative: 15, ablativeMax: 15 } };
    expect(eternalWarGrant(system, 15, 6)).toEqual({ ablative: 18, ablativeMax: 18, contribution: 18 });
  });

  it("не трогает посторонний аблатив", () => {
    const system = { wounds: { ablative: 18, ablativeMax: 18 } }; // 3 постороннего + 15 своего
    expect(eternalWarGrant(system, 15, 5)).toMatchObject({ ablative: 18, contribution: 15 }); // 3+15
  });
});

describe("eternalWarClear: конец битвы — сброс в 0", () => {
  it("сбрасывает свой вклад", () => {
    const system = { wounds: { ablative: 15, ablativeMax: 15 } };
    expect(eternalWarClear(system, 15)).toEqual({ ablative: 0, ablativeMax: 0, contribution: 0 });
  });
  it("своего вклада не было — null", () => {
    const system = { wounds: { ablative: 3, ablativeMax: 3 } };
    expect(eternalWarClear(system, 0)).toBeNull();
  });
});

describe("eternalWarShrinkToFit: доля не больше, чем реально осталось", () => {
  it("пул уменьшился (урон) — доля ужимается вслед", () => {
    const system = { wounds: { ablative: 10, ablativeMax: 15 } };
    expect(eternalWarShrinkToFit(system, 15)).toEqual({ ablativeMax: 10, contribution: 10 });
  });
});
