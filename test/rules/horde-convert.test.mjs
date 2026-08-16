// test/rules/horde-convert.test.mjs
//
// «В Орду»: дубль существа Ордой. Считалка чистая — на вход система актора, на
// выход система Орды. Главное, что здесь проверяется: боец не должен ослабеть
// от превращения в толпу (характеристики переезжают ИТОГОМ, а не голой базой)
// и не должен потерять то, чем воюет (Навыки рангом, снаряжение предметами).

import { describe, it, expect } from "vitest";
import { hordeSystemFrom, hordeNameFrom, hordeItemsFrom,
         HORDE_KEPT_ITEM_TYPES } from "../../module/rules/horde-convert.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Астартес: база 40, но Unnatural Strength поднял итог до 48. */
const astartes = {
  characteristics: {
    s:   { base: 40, advance: 5, supernatural: 3, total: 48, bonus: 4 },
    ag:  { base: 35, total: 35, bonus: 3 },
    inf: { base: 30, total: 30, bonus: 3 }
  },
  skills: { dodge: { rank: "trained" }, awareness: { rank: "veteran" } },
  wounds: { value: 14, max: 20 },
  absorption: { body: 11, head: 9, toughnessBonus: 8 },
  size: 1,
  notes: "Ветеран III когорты"
};

describe("hordeSystemFrom", () => {
  it("характеристики переезжают итогом, а не базой", () => {
    const s = hordeSystemFrom(astartes);
    expect(s.characteristics.s).toEqual({ base: 48, advance: 0, total: 48, bonus: 4 });
  });

  it("Влияния у Орды нет — характеристика не переносится", () => {
    expect(hordeSystemFrom(astartes).characteristics.inf).toBeUndefined();
  });

  it("навыки переезжают рангом, и переносятся все — не только заполненные", () => {
    const s = hordeSystemFrom(astartes);
    expect(s.skills.dodge.rank).toBe("trained");
    expect(s.skills.awareness.rank).toBe("veteran");
    expect(s.skills.charm.rank).toBe("untrained");
    expect(Object.keys(s.skills).sort()).toEqual(Object.keys(SKILLS_DEF).sort());
  });

  it("групповые навыки переезжают записями со специализацией", () => {
    const s = hordeSystemFrom({
      groupSkills: {
        commonLore: [{ specialty: "Империум", rank: "trained", cost: 200, grantedRank: "knows" }],
        trade:      [{ specialty: "Кузнец", rank: "knows", char: "s" }]
      }
    });
    // Цена и «выдано архетипом» с собой не едут: покупок за опыт у Орды нет.
    expect(s.groupSkills.commonLore).toEqual([{ specialty: "Империум", rank: "trained", total: -20 }]);
    expect(s.groupSkills.trade[0].char).toBe("s");
  });

  it("записи без специализации не переносятся, а пустые группы остаются списками", () => {
    const s = hordeSystemFrom({ groupSkills: { operate: [{ specialty: "", rank: "trained" }] } });
    expect(s.groupSkills.operate).toEqual([]);
    expect(s.groupSkills.linguistics).toEqual([]);
  });

  it("Раны становятся Магнитудой: максимум — стартовой, текущие — текущей", () => {
    expect(hordeSystemFrom(astartes).magnitude).toEqual({ value: 14, start: 20 });
  });

  it("Магнитуда не превышает стартовую и не уходит в минус", () => {
    expect(hordeSystemFrom({ wounds: { value: 99, max: 20 } }).magnitude).toEqual({ value: 20, start: 20 });
    expect(hordeSystemFrom({ wounds: { value: -5, max: 12 } }).magnitude.value).toBe(0);
    expect(hordeSystemFrom({}).magnitude).toEqual({ value: 0, start: 0 });
  });

  it("лист без текущих Ран даёт Орду в полном составе", () => {
    expect(hordeSystemFrom({ wounds: { max: 30 } }).magnitude).toEqual({ value: 30, start: 30 });
  });

  it("поглощение берётся по торсу — все попадания по Орде идут туда", () => {
    expect(hordeSystemFrom(astartes).absorption).toBe(11);
  });

  it("Размер существа уезжает в sizeMod — Орде он нужен для SPD", () => {
    expect(hordeSystemFrom(astartes).sizeMod).toBe(1);
  });

  it("Бесстрашного Орда не ломается", () => {
    const fearless = [{ type: "talent", name: "Fearless / Бесстрашный" }];
    expect(hordeSystemFrom(astartes, fearless).immuneFear).toBe(true);
    expect(hordeSystemFrom(astartes, [{ type: "talent", name: "Меткий" }]).immuneFear).toBe(false);
    expect(hordeSystemFrom(astartes).immuneFear).toBe(false);
  });

  it("подписи шапки приходят снаружи, заметки — от оригинала", () => {
    const s = hordeSystemFrom(astartes, [], { speciesName: "Астартес", descriptor: "Тактик" });
    expect(s.speciesName).toBe("Астартес");
    expect(s.descriptor).toBe("Тактик");
    expect(s.notes).toBe("Ветеран III когорты");
  });
});

describe("hordeItemsFrom", () => {
  const items = [
    { type: "weapon", name: "Болтер" }, { type: "armor", name: "Силовая броня" },
    { type: "talent", name: "Меткий" }, { type: "trait", name: "Размер (1)" },
    { type: "gear",   name: "Ремень" },
    { type: "psychicPower", name: "Молния" }, { type: "archetype", name: "Тактик" },
    { type: "mentalDisorder", name: "Паранойя" }
  ];

  it("берёт снаряжение, Таланты и Черты", () => {
    expect(hordeItemsFrom(items).map(i => i.name))
      .toEqual(["Болтер", "Силовая броня", "Меткий", "Размер (1)", "Ремень"]);
  });

  it("личное — психосилы, архетип, расстройства — не переезжает", () => {
    const kept = hordeItemsFrom(items).map(i => i.type);
    for (const t of ["psychicPower", "archetype", "mentalDisorder"]) expect(kept).not.toContain(t);
  });

  it("перечень типов и фильтр не расходятся", () => {
    for (const type of HORDE_KEPT_ITEM_TYPES)
      expect(hordeItemsFrom([{ type, name: "x" }])).toHaveLength(1);
  });
});

describe("hordeNameFrom", () => {
  it("оригинал узнаётся в имени дубля", () => {
    expect(hordeNameFrom("Сол Гореш")).toBe("Сол Гореш — Орда");
    expect(hordeNameFrom("  Кровопускатель ")).toBe("Кровопускатель — Орда");
    expect(hordeNameFrom("")).toBe("Существо — Орда");
  });
});
