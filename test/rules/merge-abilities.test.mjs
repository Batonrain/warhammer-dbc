// test/rules/merge-abilities.test.mjs
//
// Склейка одинаковых Талантов и Черт для показа на листе: один и тот же Талант
// приходит из нескольких источников, и в списке способностей он должен быть
// одной строкой — с общим рейтингом и со списком специализаций.
//
// Foundry здесь не нужен: функции работают с обычными объектами вида предмета.

import { describe, it, expect } from "vitest";
import { mergeKey, mergeAbilityItems, abilityLabel, mergeAbilityEffects }
  from "../../module/rules/merge-abilities.mjs";

let seq = 0;
const trait = (name, system = {}) => ({ id: `t${++seq}`, type: "trait", name, system });
const talent = (name, system = {}) => ({ id: `a${++seq}`, type: "talent", name, system });
const rated = (n, extra = {}) => ({ hasRating: true, rating: n, ...extra });

describe("ключ склейки", () => {
  it("не зависит от регистра и пробелов", () => {
    expect(mergeKey("Nimble / Проворный")).toBe(mergeKey(" nimble /  ПРОВОРНЫЙ "));
  });

  it("отбрасывает хвостовой рейтинг в скобках — и число, и заглушку (X)", () => {
    const base = mergeKey("Nimble / Проворный");
    expect(mergeKey("Nimble (10) / Проворный (10)")).toBe(base);
    expect(mergeKey("Nimble (X) / Проворный (Х)")).toBe(base);
  });

  it("специализацию в скобках НЕ отбрасывает — это разные покупки", () => {
    expect(mergeKey("Weapon Training (Bolt)")).not.toBe(mergeKey("Weapon Training (Las)"));
  });
});

describe("склейка рейтингов", () => {
  it("две одинаковые Черты по 5 дают одну строку с рейтингом 10", () => {
    const groups = mergeAbilityItems([
      trait("Nimble / Проворный", rated(5)),
      trait("Nimble / Проворный", rated(5))
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rating).toBe(10);
    expect(groups[0].ratingText).toBe("(10)");
    expect(groups[0].items).toHaveLength(2);
  });

  it("строка берёт id первого предмета — по нему открывают и удаляют источник", () => {
    const first = trait("Nimble / Проворный", rated(5));
    const groups = mergeAbilityItems([first, trait("Nimble / Проворный", rated(5))]);
    expect(groups[0].id).toBe(first.id);
  });

  it("рейтинг из имени в подписи не остаётся: он показан отдельно", () => {
    const groups = mergeAbilityItems([
      trait("Nimble (10) / Проворный (10)", rated(10)),
      trait("Nimble / Проворный", rated(10))
    ]);
    expect(groups[0].baseName).toBe("Nimble / Проворный");
    expect(groups[0].rating).toBe(20);
  });

  it("второй рейтинг (X/Y) складывается своей суммой", () => {
    const groups = mergeAbilityItems([
      trait("Deadly Natural Weapons / Смертельное Оружие",
        rated(2, { hasRating2: true, rating2: 1 })),
      trait("Deadly Natural Weapons / Смертельное Оружие",
        rated(3, { hasRating2: true, rating2: 2 }))
    ]);
    expect(groups[0].rating).toBe(5);
    expect(groups[0].rating2).toBe(3);
    expect(groups[0].ratingText).toBe("(5/3)");
  });

  it("без рейтинга подписи рейтинга нет", () => {
    const groups = mergeAbilityItems([trait("Amphibious / Амфибия")]);
    expect(groups[0].ratingText).toBe("");
  });
});

describe("склейка специализаций", () => {
  it("три Сопротивления становятся одним со списком в порядке выдачи", () => {
    const groups = mergeAbilityItems([
      talent("Resistance / Сопротивление", { specialization: "Poison" }),
      talent("Resistance / Сопротивление", { specialization: "Cold" }),
      talent("Resistance / Сопротивление", { specialization: "Heat" })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].specs).toEqual(["Poison", "Cold", "Heat"]);
    expect(abilityLabel(groups[0])).toBe("Resistance / Сопротивление (Poison, Cold, Heat)");
  });

  it("повторная специализация в список не попадает дважды", () => {
    const groups = mergeAbilityItems([
      talent("Heightened Senses / Усиленные Чувства", { specialization: "Sight" }),
      talent("Heightened Senses / Усиленные Чувства", { specialization: "Sight" })
    ]);
    expect(groups[0].specs).toEqual(["Sight"]);
  });

  it("цели Таланта (Hatred, Enemy) попадают в тот же список", () => {
    const groups = mergeAbilityItems([
      talent("Hatred / Ненависть", { targets: [{ name: "Тёмный Механикум" }] }),
      talent("Hatred / Ненависть", { targets: [{ name: "Техника" }] })
    ]);
    expect(groups[0].specs).toEqual(["Тёмный Механикум", "Техника"]);
  });

  it("специализации и рейтинг в подписи стоят рядом", () => {
    const groups = mergeAbilityItems([
      talent("Enemy / Враг", rated(1, { specialization: "Экклезиархия" })),
      talent("Enemy / Враг", rated(2, { specialization: "Экклезиархия" }))
    ]);
    expect(abilityLabel(groups[0])).toBe("Enemy / Враг (Экклезиархия) (3)");
  });
});

describe("специализация «Миньона Хаоса» — составная метка, не список (wdbc-cof)", () => {
  it("«Группа, Сила» одной покупки не режется по запятой на два обрывка", () => {
    const groups = mergeAbilityItems([
      talent("Minion of Chaos / Миньон Хаоса", { specialization: "Демон, Высший" })
    ]);
    expect(groups[0].specs).toEqual(["Демон, Высший"]);
  });

  it("разные покупки (разные пары) видны раздельно, не расползаются на фрагменты", () => {
    const groups = mergeAbilityItems([
      talent("Minion of Chaos / Миньон Хаоса", { specialization: "Демон, Высший" }),
      talent("Minion of Chaos / Миньон Хаоса", { specialization: "Человек, Низший" })
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].specs).toEqual(["Демон, Высший", "Человек, Низший"]);
  });

  it("для сравнения: обычный Талант с такой же кажущейся структурой по-прежнему режется по запятой", () => {
    const groups = mergeAbilityItems([
      talent("Resistance / Сопротивление", { specialization: "Cold, Heat" })
    ]);
    expect(groups[0].specs).toEqual(["Cold", "Heat"]);
  });
});

describe("что склеивать нельзя", () => {
  it("разные имена остаются разными строками", () => {
    const groups = mergeAbilityItems([
      talent("Jaded / Пресыщенный"), talent("Nerves of Steel / Стальные Нервы")
    ]);
    expect(groups).toHaveLength(2);
  });

  it("специализация, записанная прямо в имени, разделяет строки", () => {
    const groups = mergeAbilityItems([
      talent("Weapon Training (Bolt)"), talent("Weapon Training (Las)")
    ]);
    expect(groups).toHaveLength(2);
  });

  it("безымянные предметы не сливаются в одну строку", () => {
    const groups = mergeAbilityItems([talent(""), talent("")]);
    expect(groups).toHaveLength(2);
  });

  it("порядок строк — как пришли предметы", () => {
    const groups = mergeAbilityItems([
      talent("Quick Draw / Быстрое Выхватывание"),
      talent("Ambidextrous / Амбидекстр"),
      talent("Quick Draw / Быстрое Выхватывание")
    ]);
    expect(groups.map(g => g.baseName))
      .toEqual(["Quick Draw / Быстрое Выхватывание", "Ambidextrous / Амбидекстр"]);
  });
});

describe("сводка авто-эффектов склеенной строки", () => {
  it("бонусы характеристик складываются по каждой характеристике", () => {
    const fx = mergeAbilityEffects([
      trait("X", { effects: { charBonusStat: "s", charBonusValue: 1 } }),
      trait("X", { effects: { charBonusStat: "s", charBonusValue: 2 } }),
      trait("X", { effects: { charBonuses: [{ stat: "t", value: 3 }] } })
    ]);
    expect(fx.charBonus).toEqual({ s: 3, t: 3 });
  });

  it("Страх берётся максимумом — так же его считает актор", () => {
    const fx = mergeAbilityEffects([
      trait("X", { effects: { fearRating: 1 } }),
      trait("X", { effects: { fearRating: 3 } })
    ]);
    expect(fx.fearRating).toBe(3);
  });

  it("броня, Размер и Инициатива складываются", () => {
    const fx = mergeAbilityEffects([
      trait("X", { effects: { armourAll: 1, sizeMod: 1, initMod: 2 } }),
      trait("X", { effects: { armourAll: 2, sizeMod: 1, initMod: 3 } })
    ]);
    expect(fx.armourAll).toBe(3);
    expect(fx.sizeMod).toBe(2);
    expect(fx.initMod).toBe(5);
  });

  it("у предмета без механики сводка пустая", () => {
    const fx = mergeAbilityEffects([trait("X")]);
    expect(fx).toEqual({ charBonus: {}, armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0 });
  });
});

// wdbc-e2nm: миграция system.effects → ActiveEffect старое поле НЕ стирает, а
// актор у помеченного предмета его не читает. Сводка читала — и показывала
// «+3 Силы», которых в характеристиках уже нет.
describe("сводка мигрированного предмета берётся из ActiveEffect, не из старого поля", () => {
  const AP_ZONES = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];
  const migrated = (name, changes = [], system = {}, over = {}) => ({
    id: `m${++seq}`, type: "trait", name, system,
    flags: { "warhammer-dbc": { migratedEffect: true } },
    effects: [{ disabled: false, system: { changes }, ...over }]
  });
  const change = (key, value) => ({ key, value, type: "add" });
  const apAll = n => AP_ZONES.map(z => change(`system.armorBonus.${z}`, n));

  it("старое поле у помеченного предмета не считается вовсе", () => {
    // Ровно тот расходящийся случай из тикета: в старом поле +3 Силы,
    // в эффекте — ничего. Сводка обязана молчать, как молчит расчёт актора.
    const fx = mergeAbilityEffects([
      migrated("X", [], { effects: { charBonusStat: "s", charBonusValue: 3 } })
    ]);
    expect(fx.charBonus).toEqual({});
  });

  it("считается вклад ActiveEffect — надбавка к Бонусу характеристики", () => {
    const fx = mergeAbilityEffects([
      migrated("X", [change("system.characteristics.s.bonusFx", 2)])
    ]);
    expect(fx.charBonus).toEqual({ s: 2 });
  });

  it("пара «с флагом / без флага» одного имени складывается одной строкой", () => {
    const fx = mergeAbilityEffects([
      migrated("X", [change("system.characteristics.s.bonusFx", 2)]),
      trait("X", { effects: { charBonusStat: "s", charBonusValue: 1 } })
    ]);
    expect(fx.charBonus).toEqual({ s: 3 });
  });

  it("погашенный эффект не считается — актор его тоже не применяет", () => {
    const fx = mergeAbilityEffects([
      migrated("X", [change("system.characteristics.s.bonusFx", 2)], {}, { disabled: true })
    ]);
    expect(fx.charBonus).toEqual({});
  });

  it("Страх максимумом, Размер и Инициатива суммой — как у старого поля", () => {
    const fx = mergeAbilityEffects([
      migrated("X", [change("system.fearRating", 1), change("system.sizeMod", 1),
                     change("system.initiative", 2)]),
      migrated("X", [change("system.fearRating", 3), change("system.sizeMod", 1),
                     change("system.initiative", 3)])
    ]);
    expect(fx.fearRating).toBe(3);
    expect(fx.sizeMod).toBe(2);
    expect(fx.initMod).toBe(5);
  });

  it("armourAll — общий для всех шести зон AP: миграция разложила его по зонам", () => {
    const fx = mergeAbilityEffects([migrated("X", apAll(2))]);
    expect(fx.armourAll).toBe(2);
  });

  it("AP одной зоны общей бронёй не считается — её сводка не показывала и раньше", () => {
    const fx = mergeAbilityEffects([
      migrated("X", [change("system.armorBonus.head", 3)])
    ]);
    expect(fx.armourAll).toBe(0);
  });

  it("флаг читается и через getFlag живого документа, не только из сырых flags", () => {
    const doc = {
      id: "d1", type: "trait", name: "X",
      system: { effects: { charBonusStat: "s", charBonusValue: 3 } },
      getFlag: (scope, key) => scope === "warhammer-dbc" && key === "migratedEffect",
      effects: [{ disabled: false, system: { changes: [change("system.characteristics.t.bonusFx", 4)] } }]
    };
    expect(mergeAbilityEffects([doc]).charBonus).toEqual({ t: 4 });
  });
});

describe("подпись одного предмета — для вкладки «Развитие»", () => {
  it("специализация видна в строке, строки не склеиваются", () => {
    const items = [
      talent("Resistance / Сопротивление", { specialization: "Cold" }),
      talent("Resistance / Сопротивление", { specialization: "Heat" })
    ];
    const labels = items.map(i => abilityLabel(mergeAbilityItems([i])[0]));
    expect(labels).toEqual([
      "Resistance / Сопротивление (Cold)",
      "Resistance / Сопротивление (Heat)"
    ]);
  });
});
