// test/rules/horde-convert.test.mjs
//
// «В Орду»: дубль существа Ордой. Считалка чистая — на вход система актора, на
// выход система Орды. Главное, что здесь проверяется: боец не должен ослабеть
// от превращения в толпу (характеристики переезжают ИТОГОМ, а не голой базой)
// и не должен потерять то, чем воюет (Навыки рангом, снаряжение предметами).

import { describe, it, expect } from "vitest";
import { hordeSystemFrom, hordeNameFrom, hordeItemsFrom,
         actorSystemFromHorde, actorNameFromHorde,
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

// «В Персонажа» — обратное превращение (не настоящий откат, см. комментарий
// у actorSystemFromHorde): проверяем то немногое, что Орда хранит без потерь
// (Раны из Магнитуды, Ранг навыков, Групповые навыки, Размер), и что всё
// остальное (вид/архетип/текстовые Черты) уходит в Заметки, а не теряется.
describe("actorSystemFromHorde", () => {
  const horde = {
    speciesName: "Астартес", faction: "III когорта", descriptor: "Тактик",
    characteristics: { s: { total: 48, bonus: 4 }, ag: { total: 35, bonus: 3 } },
    skills: { dodge: { rank: "trained" }, awareness: { rank: "veteran" } },
    groupSkills: { commonLore: [{ specialty: "Империум", rank: "trained" }] },
    magnitude: { value: 14, start: 20 },
    sizeMod: 1,
    traits: "Стойкий",
    notes: "Ветеран III когорты"
  };

  it("характеристики переезжают Итогом в Базу, Продвижение и Сверхъестественное — нулём", () => {
    const s = actorSystemFromHorde(horde);
    expect(s.characteristics.s).toEqual({ base: 48, advance: 0, supernatural: 0, total: 48, bonus: 4, cost: 0 });
  });

  it("Влияния у Орды не было — характеристика не восстанавливается", () => {
    expect(actorSystemFromHorde(horde).characteristics.inf).toBeUndefined();
  });

  it("навыки переезжают рангом, для всех навыков схемы", () => {
    const s = actorSystemFromHorde(horde);
    expect(s.skills.dodge).toEqual({ rank: "trained", cost: 0 });
    expect(s.skills.charm).toEqual({ rank: "untrained", cost: 0 });
    expect(Object.keys(s.skills).sort()).toEqual(Object.keys(SKILLS_DEF).sort());
  });

  it("групповые навыки переезжают записями со специализацией", () => {
    expect(actorSystemFromHorde(horde).groupSkills.commonLore)
      .toEqual([{ specialty: "Империум", rank: "trained", cost: 0 }]);
  });

  it("Магнитуда становится Ранами: начальная — максимумом, текущая — текущими", () => {
    expect(actorSystemFromHorde(horde).wounds).toEqual({ value: 14, max: 20 });
  });

  it("текущие Раны не превышают максимум и не уходят в минус", () => {
    expect(actorSystemFromHorde({ magnitude: { value: 99, start: 20 } }).wounds).toEqual({ value: 20, max: 20 });
    expect(actorSystemFromHorde({ magnitude: { value: -5, start: 12 } }).wounds.value).toBe(0);
  });

  it("Размер возвращается из sizeMod", () => {
    expect(actorSystemFromHorde(horde).size).toBe(1);
  });

  it("Фракция у Персонажа/Демона — предметы-Фракции, не строка: не структурное поле", () => {
    expect(actorSystemFromHorde(horde).faction).toBeUndefined();
  });

  it("вид/фракция/архетип/текстовые Черты — не структурные поля, а справка в Заметках", () => {
    const s = actorSystemFromHorde(horde);
    expect(s.notes).toContain("Вид (из Орды): Астартес");
    expect(s.notes).toContain("Фракция (из Орды): III когорта");
    expect(s.notes).toContain("Архетип/особенность (из Орды): Тактик");
    expect(s.notes).toContain("Черты (текст, из Орды): Стойкий");
    expect(s.notes).toContain("Ветеран III когорты");
  });

  it("пустой ввод не падает", () => {
    expect(() => actorSystemFromHorde({})).not.toThrow();
    expect(actorSystemFromHorde({}).notes).toBe("");
  });
});

describe("actorNameFromHorde", () => {
  it("снимает суффикс «— Орда», добавленный hordeNameFrom", () => {
    expect(actorNameFromHorde("Сол Гореш — Орда")).toBe("Сол Гореш");
    expect(actorNameFromHorde("Кровопускатель — Орда")).toBe("Кровопускатель");
  });

  it("имя без суффикса остаётся как есть", () => {
    expect(actorNameFromHorde("Толпа рабов")).toBe("Толпа рабов");
  });

  it("пустое имя не роняет, даёт заглушку", () => {
    expect(actorNameFromHorde("")).toBe("Существо");
    expect(actorNameFromHorde()).toBe("Существо");
  });
});
