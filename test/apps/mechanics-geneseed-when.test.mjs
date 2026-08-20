// test/apps/mechanics-geneseed-when.test.mjs
//
// entry.when — условие по Геносемени (список вариантов legion/chapter, ИЛИ
// между ними, с общим negate), общее для ЛЮБОГО вида записи Конструктора, не
// только Импланта. Примеры из жизни (реальный контент пака):
//  - Оккулоб выдаёт Dark Sight ТОЛЬКО Повелителям Ночи (VIII легион) — один
//    вариант, negate:false.
//  - Железа Бетчера НЕ работает СРАЗУ у трёх линий — Имперские Кулаки (VII,
//    весь легион), Звёздные Драконы (X, только этот орден) и Гвардия Ворона
//    (XIX, весь легион) — три варианта ОДНОЙ записи, negate:true, а не три
//    её копии (копии задвоили бы выдачу тем, кто ни под одно условие не
//    попадает).
//
// Пустой список вариантов — запись работает как раньше, всем: старый контент
// в паке не меняет поведения. Нет актора (превью/сравнение вне владельца) —
// тоже «да», гейт не о том, показывать ли запись автору.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics, syncMechanicsEffects } from "../../module/apps/mechanics.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const FLAG = "warhammer-dbc";

const when = (negate, ...conditions) => ({ negate, conditions });
const cond = (legion, chapter = "") => ({ legion, chapter });

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const traitEntry = (id, w) => ({
  id, kind: "trait", sourceUuid: "Compendium.warhammer-dbc.traits.Item.abc123",
  sourceName: "Dark Sight / Ночное Зрение", rating: "", when: w
});
const charEntry = (id, value, w) =>
  ({ id, kind: "characteristic", charKey: "t", field: "bonus", op: "add", value, when: w });

function itemOnActor({ mechanics = [], geneSeed = {} } = {}) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = { geneSeed };
  actor.items = [];
  let seq = 0;
  // Черта/Талант выданные kind:"trait"/"talent" создаются НА АКТОРЕ.
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `it-${seq++}`, name: d.name, type: d.type,
                                  getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
    actor.items.push(...made);
    return made;
  };

  const item = {
    id: "item-1", type: "implant", name: "Оккулоб", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    update: async () => item,
    // Долговечные записи (kind:"characteristic" и т.п.) заводят ActiveEffect
    // НА ПРЕДМЕТЕ (syncMechanicsEffects) — отдельный маршрут от выдачи Черт.
    createEmbeddedDocuments: async (_t, docs) => {
      const made = docs.map(d => ({ id: `fx-${seq++}`, name: d.name, system: d.system,
                                    getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
      item.effects.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (_t, ids) => {
      item.effects = item.effects.filter(f => !ids.includes(f.id));
      return ids;
    }
  };
  return item;
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

describe("entryWhenOk — чистая функция", () => {
  const gs = (legion, chapter = "") => ({ system: { geneSeed: { legion, chapter } } });

  it("без when — да, всем", () => {
    expect(entryWhenOk(gs("VIII"), { when: null })).toBe(true);
  });

  it("пустой список вариантов — да, всем", () => {
    expect(entryWhenOk(gs("VIII"), { when: when(false) })).toBe(true);
  });

  it("нет актора — да (превью)", () => {
    expect(entryWhenOk(null, { when: when(false, cond("VIII")) })).toBe(true);
  });

  it("легион совпал — да", () => {
    expect(entryWhenOk(gs("VIII"), { when: when(false, cond("VIII")) })).toBe(true);
  });

  it("легион не совпал — нет", () => {
    expect(entryWhenOk(gs("VII"), { when: when(false, cond("VIII")) })).toBe(false);
  });

  it("задан орден — легиона недостаточно, нужен тот же орден", () => {
    expect(entryWhenOk(gs("X", "ironlords"),   { when: when(false, cond("X", "stardragons")) })).toBe(false);
    expect(entryWhenOk(gs("X", "stardragons"), { when: when(false, cond("X", "stardragons")) })).toBe(true);
  });

  it("орден не задан — подходит весь легион, включая любых наследников", () => {
    expect(entryWhenOk(gs("X", "stardragons"), { when: when(false, cond("X")) })).toBe(true);
  });

  it("negate переворачивает условие — «всем, кроме»", () => {
    expect(entryWhenOk(gs("X", "stardragons"), { when: when(true, cond("X", "stardragons")) })).toBe(false);
    expect(entryWhenOk(gs("X", "ironlords"),   { when: when(true, cond("X", "stardragons")) })).toBe(true);
  });

  // Железа Бетчера: одна запись, три разных линии, где она гасится.
  it("несколько вариантов — ИЛИ, а не три отдельных копии записи", () => {
    const betchersGland = when(true, cond("VII"), cond("X", "stardragons"), cond("XIX"));
    expect(entryWhenOk(gs("VII"),               { when: betchersGland })).toBe(false); // весь VII легион
    expect(entryWhenOk(gs("VII", "punishers"),  { when: betchersGland })).toBe(false); // и его наследники
    expect(entryWhenOk(gs("X", "stardragons"),  { when: betchersGland })).toBe(false); // только этот орден X
    expect(entryWhenOk(gs("X", "ironlords"),    { when: betchersGland })).toBe(true);  // другой орден X — работает
    expect(entryWhenOk(gs("XIX"),               { when: betchersGland })).toBe(false); // весь XIX легион
    expect(entryWhenOk(gs("VI"),                { when: betchersGland })).toBe(true);  // никого из трёх не задело
  });
});

describe("entryWhenOk — ageAtLeast (доп. сужение по Возрасту)", () => {
  const gs = (legion, age, chapter = "") => ({ system: { geneSeed: { legion, chapter }, bio: { age } } });

  it("Геносемя подошло, Возраст ещё мал — нет", () => {
    expect(entryWhenOk(gs("VI", 25), { when: when(false, { legion: "VI", chapter: "", ageAtLeast: 30 }) })).toBe(false);
  });

  it("Геносемя подошло, Возраст достаточен — да", () => {
    expect(entryWhenOk(gs("VI", 30), { when: when(false, { legion: "VI", chapter: "", ageAtLeast: 30 }) })).toBe(true);
    expect(entryWhenOk(gs("VI", 90), { when: when(false, { legion: "VI", chapter: "", ageAtLeast: 30 }) })).toBe(true);
  });

  it("Возраст сам по себе легион не заменяет — нужны оба", () => {
    expect(entryWhenOk(gs("VII", 90), { when: when(false, { legion: "VI", chapter: "", ageAtLeast: 30 }) })).toBe(false);
  });

  it("ageAtLeast не задан — условие только по Геносемени, как раньше", () => {
    expect(entryWhenOk(gs("VI", 0), { when: when(false, cond("VI")) })).toBe(true);
  });
});

describe("applyItemMechanics — гейт на разовой выдаче Черты", () => {
  it("Повелителям Ночи достаётся Dark Sight", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", when(false, cond("VIII"))))],
      geneSeed: { legion: "VIII", chapter: "" }
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Dark Sight / Ночное Зрение");
  });

  it("другому легиону — нет", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", when(false, cond("VIII"))))],
      geneSeed: { legion: "VI", chapter: "" }
    });
    await applyItemMechanics(item);
    expect(item.parent.items).toHaveLength(0);
  });

  it("пропущенная запись не помечается применённой — сменили Геносемя, повтор применения её подхватывает", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", when(false, cond("VIII"))))],
      geneSeed: { legion: "VI", chapter: "" }
    });
    await applyItemMechanics(item);
    expect(item.parent.items).toHaveLength(0);

    item.parent.system.geneSeed = { legion: "VIII", chapter: "" };
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Dark Sight / Ночное Зрение");
  });
});

describe("syncMechanicsEffects — гейт на долговечной записи", () => {
  it("эффект стоит только пока Геносемя совпадает", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(charEntry("e1", 2, when(false, cond("X", "stardragons"))))],
      geneSeed: { legion: "X", chapter: "stardragons" }
    });

    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);

    // Сменили орден на другой в том же легионе — условие перестало
    // выполняться, эффект обязан уйти следом, а не остаться от прошлого раза.
    item.parent.system.geneSeed = { legion: "X", chapter: "ironlords" };
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(0);
  });

  it("negate с несколькими вариантами — эффект у всех, КРОМЕ перечисленных линий", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(charEntry("e1", 2, when(true, cond("VII"), cond("X", "stardragons"), cond("XIX"))))],
      geneSeed: { legion: "X", chapter: "ironlords" }
    });

    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);

    item.parent.system.geneSeed = { legion: "X", chapter: "stardragons" };
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(0);

    item.parent.system.geneSeed = { legion: "XIX", chapter: "" };
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(0);
  });
});
