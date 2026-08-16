// test/rules/actor-setup.test.mjs
//
// Ядро «Вариаций» бестиария (Книга Хаоса): из описания в паке и ответов ГМа
// собирается план правок актора. Foundry здесь не нужна — план считается на
// голых данных, поэтому и проверяется без заглушки.

import { describe, it, expect } from "vitest";
import {
  readSetup, defaultAnswers, buildSetupPlan, applyDeltas, mergeGroupSkills
} from "../../module/rules/actor-setup.mjs";

const RANKS = ["untrained", "knows", "trained", "veteran", "expert"];

const W = (n) => `Compendium.warhammer-dbc.weapons.${n}`;

/** Культист Фанатик в миниатюре: замена оружия, выбор из списка, числа, галочки. */
const FANATIC = {
  name: "Культист Фанатик",
  flags: {
    "warhammer-dbc": {
      setup: {
        source: "DoomBC — Хаос, стр. 47",
        groups: [
          {
            key: "variant", label: "Вариация", mode: "one", default: "base",
            options: [
              { key: "base", label: "Базовый" },
              {
                key: "berserk", label: "Берсерк",
                remove: [{ type: "weapon", name: "Автопистолет" }],
                pick: [{ label: "Второе рукопашное", from: [W("knife"), W("chainsword")] }]
              },
              {
                key: "brute", label: "Здоровяк",
                system: { "characteristics.s.base": 52, "wounds.max": "+5", size: 1 },
                add: [W("club")]
              }
            ]
          },
          {
            key: "chem", label: "Химия", mode: "many",
            options: [
              { key: "stimm", label: "1× Stimm", add: [W("stimm")] },
              { key: "spur", label: "1× Spur", add: [W("spur")] }
            ]
          }
        ]
      }
    }
  }
};

describe("описание Вариаций", () => {
  it("актор без флага описания не имеет", () => {
    expect(readSetup({ name: "Раб" })).toBeNull();
    expect(readSetup({ flags: { "warhammer-dbc": {} } })).toBeNull();
  });

  it("группы без опций отбрасываются, а не роняют разбор", () => {
    const setup = readSetup({ flags: { "warhammer-dbc": { setup: { groups: [
      { key: "empty", label: "Пусто", options: [] },
      { key: "ok", label: "Есть", options: [{ key: "a", label: "A" }] }
    ] } } } });

    expect(setup.groups.map(g => g.key)).toEqual(["ok"]);
  });

  it("режим по умолчанию — «одно из», подпись подставляется из ключа", () => {
    const setup = readSetup({ flags: { "warhammer-dbc": { setup: { groups: [
      { key: "variant", options: [{ key: "a" }] }
    ] } } } });

    expect(setup.groups[0].mode).toBe("one");
    expect(setup.groups[0].label).toBe("variant");
    expect(setup.groups[0].options[0].label).toBe("a");
  });

  it("описание без единой годной группы считается отсутствующим", () => {
    expect(readSetup({ flags: { "warhammer-dbc": { setup: { groups: [] } } } })).toBeNull();
  });
});

describe("ответы по умолчанию", () => {
  it("«одно из» берёт default, «сколько угодно» — ничего", () => {
    const answers = defaultAnswers(readSetup(FANATIC));

    expect(answers.groups.variant).toEqual(["base"]);
    expect(answers.groups.chem).toEqual([]);
  });

  it("без default берётся первая опция — она и есть базовая версия", () => {
    const setup = readSetup({ flags: { "warhammer-dbc": { setup: { groups: [
      { key: "variant", options: [{ key: "first" }, { key: "second" }] }
    ] } } } });

    expect(defaultAnswers(setup).groups.variant).toEqual(["first"]);
  });
});

describe("план правок", () => {
  const setup = readSetup(FANATIC);

  it("базовый вариант ничего не меняет", () => {
    const plan = buildSetupPlan(setup, defaultAnswers(setup));

    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.system).toEqual({});
    expect(plan.isEmpty).toBe(true);
  });

  it("Берсерк убирает пистолет и добавляет выбранное оружие", () => {
    const plan = buildSetupPlan(setup, {
      groups: { variant: ["berserk"] },
      picks: { "variant.berserk.0": W("chainsword") }
    });

    expect(plan.remove).toEqual([{ type: "weapon", name: "Автопистолет" }]);
    expect(plan.add).toEqual([W("chainsword")]);
    expect(plan.isEmpty).toBe(false);
  });

  it("невыбранный список берёт первый вариант, а не роняет план", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["berserk"] } });

    expect(plan.add).toEqual([W("knife")]);
  });

  it("числа варианта попадают в правки, включая дельту", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["brute"] } });

    expect(plan.system).toEqual({ "characteristics.s.base": 52, "wounds.max": "+5", size: 1 });
    expect(plan.add).toEqual([W("club")]);
  });

  it("«сколько угодно» складывает все отмеченные опции", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["base"], chem: ["stimm", "spur"] } });

    expect(plan.add).toEqual([W("stimm"), W("spur")]);
  });

  it("«одно из» берёт только первый ответ: два варианта разом книга не даёт", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["brute", "berserk"] } });

    expect(plan.system).toEqual({ "characteristics.s.base": 52, "wounds.max": "+5", size: 1 });
    expect(plan.remove).toEqual([]);
  });

  it("чужие ключи в ответах игнорируются и попадают в журнал", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["нет-такого"], чужое: ["a"] } });

    expect(plan.isEmpty).toBe(true);
    expect(plan.warnings.length).toBe(2);
  });

  it("выбор записан в журнале — его же увидит ГМ на листе", () => {
    const plan = buildSetupPlan(setup, { groups: { variant: ["berserk"], chem: ["stimm"] } });

    expect(plan.chosen).toEqual({ variant: ["berserk"], chem: ["stimm"] });
  });
});

describe("групповые навыки варианта", () => {
  const current = {
    commonLore: [{ specialty: "War", rank: "knows", char: "int" }],
    operate:    []
  };

  it("новая специализация добавляется, чужие записи не трогаются", () => {
    const out = mergeGroupSkills(current, [{ group: "operate", specialty: "Surface", rank: "veteran" }], RANKS);

    expect(out.operate).toEqual([{ specialty: "Surface", rank: "veteran" }]);
    expect(out.commonLore).toBeUndefined();          // группу не тронули — и не переписываем
    expect(current.operate).toEqual([]);             // исходник остался прежним
  });

  it("уже известная специализация повышается в ранге", () => {
    const out = mergeGroupSkills(current, [{ group: "commonLore", specialty: "War", rank: "veteran" }], RANKS);

    expect(out.commonLore).toEqual([{ specialty: "War", rank: "veteran", char: "int" }]);
  });

  it("ранг ниже имеющегося не понижает: вариант даёт бонус, а не отбирает", () => {
    const out = mergeGroupSkills(
      { commonLore: [{ specialty: "War", rank: "expert" }] },
      [{ group: "commonLore", specialty: "war", rank: "trained" }], RANKS);

    expect(out.commonLore).toEqual([{ specialty: "War", rank: "expert" }]);
  });
});

describe("дельты числовых полей", () => {
  const system = { wounds: { max: 12 }, characteristics: { s: { base: 42 } }, size: 0 };

  it("«+5» прибавляется к текущему, число заменяет", () => {
    expect(applyDeltas(system, { "wounds.max": "+5" })).toEqual({ "system.wounds.max": 17 });
    expect(applyDeltas(system, { "characteristics.s.base": 52 }))
      .toEqual({ "system.characteristics.s.base": 52 });
  });

  it("«−2» вычитается (и минус из книги, и обычный дефис)", () => {
    expect(applyDeltas(system, { size: "-2" })).toEqual({ "system.size": -2 });
    expect(applyDeltas(system, { "wounds.max": "−2" })).toEqual({ "system.wounds.max": 10 });
  });

  it("строка не-число остаётся строкой: не всякое поле числовое", () => {
    expect(applyDeltas(system, { "bio.features": "хитин" })).toEqual({ "system.bio.features": "хитин" });
  });

  it("отсутствующее поле при дельте считается нулём", () => {
    expect(applyDeltas(system, { "fate.max": "+1" })).toEqual({ "system.fate.max": 1 });
  });
});
