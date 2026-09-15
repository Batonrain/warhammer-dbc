// test/combat/burning-grace.test.mjs
//
// wdbc-3pv5 (Cooler/Охладитель + Морозное Сердце, «даёт улучшение Cooler,
// пока активен»): книга — «может игнорировать все негативные эффекты
// Горения в течение 1d5 Ходов, если пламя, которым он объят, наносит не
// больше 1d10 урона». Раньше нечем было сравнить порог — Горение не хранило
// урон ПОДЖИГАНИЯ. kind:"burningGrace" (armorMod ИЛИ forcefield, общий для
// Cooler/Frozen Heart) + system.conditions.burningSourceDamage/
// burningGraceRounds закрывают разбор. Автоматика без кнопки (wdbc-3pv5,
// решение по итогам обсуждения — у способности нет цены/риска отказа, в
// отличие от реального wdbc-5knb, который САМ оказался автоматикой, не
// кнопкой, см. shield-vs-condition-tick.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { hasBurningGraceCapability, burningGraceSourceItem } from "../../module/combat/damage.mjs";
import { ensureBurningGrace, processConditionTurnStart, processConditionTurnEnd } from "../../module/combat/condition-ticks.mjs";

const burningGraceMechanics = [{
  id: "g1", operator: "AND",
  entries: [{ id: "e1", kind: "burningGrace" }]
}];

function forcefield({ name = "Frozen Heart / Морозное Сердце", equipped = true, status = "active", mechanics = burningGraceMechanics } = {}) {
  return {
    name, type: "forcefield",
    system: { equipped, status },
    flags: { "warhammer-dbc": { mechanics } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  };
}

function armor({ id = "armor1", equipped = true } = {}) {
  return { id, type: "armor", system: { equipped, body: 1 } };
}

function armorMod({ name = "Cooler / Охладитель", installedOn = "armor1", activatable = false, active = false, mechanics = burningGraceMechanics } = {}) {
  return {
    name, type: "armorMod",
    system: { installedOn, category: "armor", activatable, active, modGroup: "general" },
    flags: { "warhammer-dbc": { mechanics } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
  };
}

function makeActor({ items = [], overrides = {} } = {}) {
  const updates = [];
  const actor = {
    name: "Подставной",
    items: Object.assign([...items], { contents: items }),
    updates,
    system: {
      characteristics: { t: { bonus: 0, total: 40 }, wp: { bonus: 0 } },
      fatigue: { value: 0 },
      wounds: { value: 5, max: 10, critical: 0, firstAidUsed: true },
      conditions: {},
      ...overrides
    },
    getFlag: () => undefined,
    setFlag: async () => {},
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = actor;
        for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("hasBurningGraceCapability", () => {
  it("щит с kind:\"burningGrace\", надет и активен — true", () => {
    const actor = makeActor({ items: [forcefield()] });
    expect(hasBurningGraceCapability(actor)).toBe(true);
  });

  it("щит с записью, но не надет — false", () => {
    const actor = makeActor({ items: [forcefield({ equipped: false })] });
    expect(hasBurningGraceCapability(actor)).toBe(false);
  });

  it("щит с записью, но не активен (status !== \"active\") — false", () => {
    const actor = makeActor({ items: [forcefield({ status: "inactive" })] });
    expect(hasBurningGraceCapability(actor)).toBe(false);
  });

  it("армор-мод с kind:\"burningGrace\", установлен на надетую броню — true", () => {
    const actor = makeActor({ items: [armor(), armorMod()] });
    expect(hasBurningGraceCapability(actor)).toBe(true);
  });

  it("армор-мод установлен, но броня не надета — false", () => {
    const actor = makeActor({ items: [armor({ equipped: false }), armorMod()] });
    expect(hasBurningGraceCapability(actor)).toBe(false);
  });

  it("армор-мод не установлен ни на какую броню (installedOn не совпадает) — false", () => {
    const actor = makeActor({ items: [armor(), armorMod({ installedOn: "другая-броня" })] });
    expect(hasBurningGraceCapability(actor)).toBe(false);
  });

  it("ни щита, ни мода с этой записью — false", () => {
    const actor = makeActor({ items: [armor(), forcefield({ mechanics: [] })] });
    expect(hasBurningGraceCapability(actor)).toBe(false);
  });
});

// wdbc-lm83: заметка в чате раньше звала окно «Cooler» даже когда сработал
// только Frozen Heart без Cooler на акторе — burningGraceSourceItem отдаёт
// РЕАЛЬНЫЙ предмет, чтобы вызывающий код мог назвать его по имени.
describe("burningGraceSourceItem (wdbc-lm83)", () => {
  it("только Frozen Heart (без Cooler) — возвращает именно Frozen Heart", () => {
    const shield = forcefield();
    const actor = makeActor({ items: [shield] });
    expect(burningGraceSourceItem(actor)).toBe(shield);
  });

  it("только Cooler (без Frozen Heart) — возвращает именно Cooler", () => {
    const mod = armorMod();
    const actor = makeActor({ items: [armor(), mod] });
    expect(burningGraceSourceItem(actor)).toBe(mod);
  });

  it("ни одного предмета со способностью — null", () => {
    const actor = makeActor({ items: [armor()] });
    expect(burningGraceSourceItem(actor)).toBeNull();
  });
});

describe("ensureBurningGrace", () => {
  it("нет способности — не выдаёт окно", async () => {
    const actor = makeActor({ overrides: { conditions: { burning: true, burningSourceDamage: 5 } } });
    const { rounds, roll } = await ensureBurningGrace(actor);
    expect(rounds).toBe(0);
    expect(roll).toBeNull();
    expect(actor.system.conditions.burningGraceRounds).toBeUndefined();
  });

  it("есть способность, но урон поджигания 0 (не поджигали через этот путь) — не выдаёт", async () => {
    const actor = makeActor({ items: [forcefield()], overrides: { conditions: { burning: true, burningSourceDamage: 0 } } });
    const { rounds } = await ensureBurningGrace(actor);
    expect(rounds).toBe(0);
  });

  it("есть способность, но урон поджигания выше 10 — не выдаёт", async () => {
    const actor = makeActor({ items: [forcefield()], overrides: { conditions: { burning: true, burningSourceDamage: 11 } } });
    const { rounds } = await ensureBurningGrace(actor);
    expect(rounds).toBe(0);
    expect(actor.system.conditions.burningSourceDamage).toBe(11); // не тронуто — окно не выдано
  });

  it("есть способность и урон поджигания ≤10 — выдаёт 1d5, обнуляет burningSourceDamage", async () => {
    const actor = makeActor({ items: [forcefield()], overrides: { conditions: { burning: true, burningSourceDamage: 10 } } });
    captured.dice = [3];
    const { rounds, roll } = await ensureBurningGrace(actor);
    expect(rounds).toBe(3);
    expect(roll.total).toBe(3);
    expect(actor.system.conditions.burningGraceRounds).toBe(3);
    expect(actor.system.conditions.burningSourceDamage).toBe(0);
  });

  it("окно уже выдано (burningGraceRounds > 0) — не бросает заново, возвращает текущий остаток", async () => {
    const actor = makeActor({ items: [forcefield()], overrides: { conditions: { burning: true, burningGraceRounds: 2, burningSourceDamage: 5 } } });
    const { rounds, roll } = await ensureBurningGrace(actor);
    expect(rounds).toBe(2);
    expect(roll).toBeNull();
    expect(captured.rolls).toHaveLength(0); // никакого броска не было
  });
});

describe("processConditionTurnStart: Cooler/Морозное Сердце гасит Панику от Горения", () => {
  it("только Frozen Heart (без Cooler) — заметка зовёт Frozen Heart, не «Cooler» (wdbc-lm83)", async () => {
    const actor = makeActor({
      items: [forcefield()],
      overrides: { conditions: { burning: true, burningSourceDamage: 8 } }
    });
    captured.dice = [4]; // 1d5 окна
    await processConditionTurnStart(actor);

    // "Паника от Горения" тоже встречается в самой строке-заметке — проверяем
    // отсутствие НАСТОЯЩЕЙ карточки теста Морали по её исходу.
    expect(captured.chat.some(c =>
      c.content.includes("держит себя в руках") || c.content.includes("потерян в панике")
    )).toBe(false);
    expect(actor.system.conditions.burningGraceRounds).toBe(4);
    const card = captured.chat.find(c => c.content.includes("Паника от Горения пропущена"));
    expect(card).toBeTruthy();
    expect(card.content).toContain("Frozen Heart / Морозное Сердце");
    expect(card.content).not.toContain("Cooler"); // wdbc-lm83: не жёстко зашитое имя
  });

  it("только Cooler (без Frozen Heart) — заметка зовёт Cooler по имени", async () => {
    const actor = makeActor({
      items: [armor(), armorMod()],
      overrides: { conditions: { burning: true, burningSourceDamage: 8 } }
    });
    captured.dice = [3];
    await processConditionTurnStart(actor);

    const card = captured.chat.find(c => c.content.includes("Паника от Горения пропущена"));
    expect(card.content).toContain("Cooler / Охладитель");
  });

  it("нет способности — Паника от Горения проходит как обычно", async () => {
    const actor = makeActor({ overrides: { conditions: { burning: true } } });
    captured.dice = [50]; // 1d100 теста Морали
    await processConditionTurnStart(actor);

    expect(captured.chat.some(c => c.content.includes("Паника от Горения"))).toBe(true);
  });
});

describe("processConditionTurnEnd: Cooler/Морозное Сердце гасит тик Горения", () => {
  it("порог пройден — тик пропущен, Раны/Усталость не меняются, остаток окна убывает", async () => {
    const actor = makeActor({
      items: [forcefield()],
      overrides: { conditions: { burning: true, burningSourceDamage: 8 } }
    });
    captured.dice = [4]; // 1d5 окна (сначала выдаётся здесь — начало Хода не вызывалось в этом тесте)
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(5);      // не изменилось
    expect(actor.system.fatigue.value).toBe(0);      // не изменилось
    expect(actor.system.conditions.burningGraceRounds).toBe(3); // 4 выдано − 1 потрачено этим тиком
    expect(actor.system.conditions.burning).toBe(true); // само Состояние не снимается — только эффекты
    // wdbc-lm83: только Frozen Heart на акторе — заметка зовёт его, не «Cooler».
    const card = captured.chat.find(c => c.content.includes("тик Горения пропущен"));
    expect(card.content).toContain("Frozen Heart / Морозное Сердце");
    expect(card.content).not.toContain("Cooler");
  });

  it("окно уже открыто с прошлого Хода (burningGraceRounds=1) — тик пропущен, окно закрывается на 0", async () => {
    const actor = makeActor({
      items: [forcefield()],
      overrides: { conditions: { burning: true, burningGraceRounds: 1, burningSourceDamage: 0 } }
    });
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBe(5);
    expect(actor.system.conditions.burningGraceRounds).toBe(0);
  });

  it("окно кончилось (0) — следующий тик снова наносит урон как обычно", async () => {
    const actor = makeActor({
      items: [forcefield()],
      overrides: { conditions: { burning: true, burningGraceRounds: 0, burningSourceDamage: 0 } }
    });
    captured.dice = [7]; // обычный тик 1d10
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBeLessThan(5);
  });

  it("нет способности — тик Горения считается как обычно, даже при малом уроне поджигания", async () => {
    const actor = makeActor({ overrides: { conditions: { burning: true, burningSourceDamage: 3 } } });
    captured.dice = [7];
    await processConditionTurnEnd(actor);

    expect(actor.system.wounds.value).toBeLessThan(5);
  });
});
