// test/apps/skillful-torture.test.mjs
//
// module/apps/skillful-torture.mjs (wdbc-sk8s) — helper-функции Skillful
// Torture/Искусная Пытка: isDrukhari, interrogateIntTotal, extraTiers,
// drukhariNearby, grantTortureBenefit, tortureBenefitAvailable/
// markTortureBenefitUsed. Сам диалог (showSkillfulTortureDialog) не
// юнит-тестируется — то же соглашение проекта, что у attack-dialog.mjs/
// healing.mjs (слишком тяжёлый DialogV2-пайплайн).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  isDrukhari, interrogateIntTotal, extraTiers, drukhariNearby,
  grantTortureBenefit, tortureBenefitAvailable, markTortureBenefitUsed, hasSkillfulTorture
} from "../../module/apps/skillful-torture.mjs";

function actor({ race = "human", ynnariPast = "", harlequinPast = "", intTotal = 30, wpBonus = 4,
  interrogateRank = "trained", fateVal = 0, fateMax = 10, charDamage = {}, talent = false } = {}) {
  const flags = {};
  const data = {
    name: "Тестовый",
    items: talent ? [{ type: "talent", name: "Skillful Torture / Искусная Пытка" }] : [],
    system: {
      race, ynnariPast, harlequinPast,
      characteristics: {
        int: { total: intTotal }, wp: { bonus: wpBonus, total: wpBonus * 10 + 5 },
        ws: {}, bs: {}, s: {}, t: {}, ag: {}, per: {}, fel: {}
      },
      skills: { interrogate: { rank: interrogateRank } },
      fate: { value: fateVal, max: fateMax },
      charDamage: { ...charDamage }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  data.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split(".");
      let cur = data;
      for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
      cur[parts.at(-1)] = value;
    }
  };
  return data;
}

afterEach(() => { globalThis.game.combat = undefined; delete globalThis.canvas; });

describe("hasSkillfulTorture", () => {
  it("определяет владение Талантом", () => {
    expect(hasSkillfulTorture(actor({ talent: true }))).toBe(true);
    expect(hasSkillfulTorture(actor({ talent: false }))).toBe(false);
  });
});

describe("isDrukhari", () => {
  it("раса drukhari — друкхари", () => {
    expect(isDrukhari(actor({ race: "drukhari" }))).toBe(true);
  });
  it("не-друкхари раса без Прошлого — не друкхари", () => {
    expect(isDrukhari(actor({ race: "human" }))).toBe(false);
  });
  it("Иннари с Прошлым drukhari — друкхари", () => {
    expect(isDrukhari(actor({ race: "ynnari", ynnariPast: "drukhari" }))).toBe(true);
  });
  it("Арлекин с Прошлым drukhari — друкхари", () => {
    expect(isDrukhari(actor({ race: "harlequin", harlequinPast: "drukhari" }))).toBe(true);
  });
  it("Иннари с другим Прошлым — не друкхари", () => {
    expect(isDrukhari(actor({ race: "ynnari", ynnariPast: "aeldari" }))).toBe(false);
  });
});

describe("interrogateIntTotal", () => {
  it("Int.total + бонус ранга Навыка (НЕ Воля по умолчанию)", () => {
    // trained = +10 (SKILL_RANKS, module/constants/characteristics.mjs)
    const a = actor({ intTotal: 40, interrogateRank: "trained" });
    expect(interrogateIntTotal(a)).toBe(50);
  });
  it("без ранга (untrained) — штраф -20", () => {
    const a = actor({ intTotal: 40, interrogateRank: "untrained" });
    expect(interrogateIntTotal(a)).toBe(20);
  });
});

describe("extraTiers", () => {
  it("margin < 3 — 0 тиров", () => {
    expect(extraTiers(0)).toBe(0);
    expect(extraTiers(2)).toBe(0);
  });
  it("margin 3-5 — 1 тир, 6-8 — 2 тира", () => {
    expect(extraTiers(3)).toBe(1);
    expect(extraTiers(5)).toBe(1);
    expect(extraTiers(6)).toBe(2);
  });
  it("отрицательный/некорректный margin — 0", () => {
    expect(extraTiers(-5)).toBe(0);
    expect(extraTiers(undefined)).toBe(0);
  });
});

describe("drukhariNearby", () => {
  it("в бою — комбатанты-друкхари, дедуп по актору", () => {
    const d1 = actor({ race: "drukhari" });
    const human = actor({ race: "human" });
    globalThis.game.combat = { combatants: [{ actor: d1 }, { actor: human }, { actor: d1 }] };
    d1.id = "d1"; human.id = "h1";
    expect(drukhariNearby()).toEqual([d1]);
  });

  it("вне боя — друкхари на сцене", () => {
    const d1 = actor({ race: "drukhari" });
    d1.id = "d1";
    globalThis.canvas = { scene: { tokens: { contents: [{ actor: d1 }] } } };
    expect(drukhariNearby()).toEqual([d1]);
  });
});

describe("grantTortureBenefit", () => {
  it("лечит только повреждённые (charDamage < 0) Характеристики, не превышая 0", () => {
    const a = actor({ charDamage: { s: -8, t: -2 }, fateVal: 1, fateMax: 10 });
    return grantTortureBenefit(a, [5]).then(({ totalHeal, pain }) => {
      expect(totalHeal).toBe(5);
      expect(pain).toBe(2); // база: 1 бросок → 2 Боли
      expect(a.system.charDamage.s).toBe(-3);
      expect(a.system.charDamage.t).toBe(0); // -2+5=3, но клэмп в 0
      expect(a.system.charDamage.ws).toBeUndefined(); // не тронут — не был повреждён
      expect(a.system.fate.value).toBe(3); // 1+2
    });
  });

  it("несколько тиров — суммирует лечение и Боль", async () => {
    const a = actor({ charDamage: { s: -20 }, fateVal: 0, fateMax: 10 });
    const { totalHeal, pain } = await grantTortureBenefit(a, [4, 3, 5]);
    expect(totalHeal).toBe(12);
    expect(pain).toBe(4); // 2 база + 2 доп. тира
    expect(a.system.charDamage.s).toBe(-8);
    expect(a.system.fate.value).toBe(4);
  });

  it("Боль не превышает максимум", async () => {
    const a = actor({ fateVal: 9, fateMax: 10 });
    const { pain } = await grantTortureBenefit(a, [1]);
    expect(pain).toBe(2);
    expect(a.system.fate.value).toBe(10);
  });
});

describe("tortureBenefitAvailable / markTortureBenefitUsed — дневной лимит по W.b получателя", () => {
  it("W.b <= 0 — недоступно вовсе", () => {
    expect(tortureBenefitAvailable(actor({ wpBonus: 0 }))).toBe(false);
  });

  it("доступно, пока не исчерпан личный W.b лимит за сутки", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = actor({ wpBonus: 2 });
    expect(tortureBenefitAvailable(a)).toBe(true);
    await markTortureBenefitUsed(a);
    expect(tortureBenefitAvailable(a)).toBe(true);
    await markTortureBenefitUsed(a);
    expect(tortureBenefitAvailable(a)).toBe(false);
  });

  it("новые сутки — лимит снова полный", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = actor({ wpBonus: 1 });
    await markTortureBenefitUsed(a);
    expect(tortureBenefitAvailable(a)).toBe(false);
    globalThis.game.time = { worldTime: 86400 + 1 };
    expect(tortureBenefitAvailable(a)).toBe(true);
  });
});
