// test/apps/mechanics-submutation-when.test.mjs
//
// entry.when.submutations — второй, независимый гейт «Когда» (module/rules/
// mech-when.mjs), рядом с гейтом по Геносемени (mechanics-geneseed-when.test.mjs).
// Мутация с субмутациями (стр. 440) меняет своё действие в зависимости от
// того, какая строка выпала (system.submutation.label, apps/submutations.mjs)
// — одна и та же Мутация несёт в Конструкторе по записи на каждый набор строк
// со своим эффектом, и работает только та, чья субмутация сейчас записана на
// ПРЕДМЕТЕ (а не на акторе, как у Геносемени).
//
// Пример из жизни (реальная таблица пака, «Животный Гибрид», MUTATION_LIBRARY):
// строка «4 — Кошка» даёт Dark Sight, строка «6 — Змея» (цвет Нургла) —
// свойство Toxic укусу. Здесь используется урезанный текст той же формы, ради
// компактности теста.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics, syncMechanicsEffects, mechanicsRelevantChange } from "../../module/apps/mechanics.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const FLAG = "warhammer-dbc";

const BENEFIT = `Персонаж срастается с животным, приобретая один из его признаков.

СУБМУТАЦИИ (d10):
1 — Насекомое: даёт естественную броню.
4 — Кошка: даёт Трейт Dark Sight и когти.
6 — Змея: даёт тепловое зрение. [только для последователей: Нургл]`;

const when = (submutations, negateSub = false) => ({ negate: false, conditions: [], submutations, negateSub });

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const traitEntry = (id, w) => ({
  id, kind: "trait", sourceUuid: "Compendium.warhammer-dbc.traits.Item.abc123",
  sourceName: "Dark Sight / Ночное Зрение", rating: "", when: w
});
const charEntry = (id, value, w) =>
  ({ id, kind: "characteristic", charKey: "t", field: "bonus", op: "add", value, when: w });

/** Мутация-предмет на акторе, с собственной таблицей субмутаций в тексте. */
function mutationOnActor({ mechanics = [], submutation = {} } = {}) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = {};
  actor.items = [];
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `it-${seq++}`, name: d.name, type: d.type,
                                  getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
    actor.items.push(...made);
    return made;
  };

  const item = {
    id: "item-1", type: "mutation", name: "Животный Гибрид", img: "icons/svg/acid.svg",
    system: { benefit: BENEFIT, submutation }, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    update: async (changes) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = item;
        for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
        node[keys[keys.length - 1]] = value;
      }
      return item;
    },
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

describe("entryWhenOk — гейт по субмутации, чистая функция", () => {
  it("без when — да, всем", () => {
    expect(entryWhenOk(null, { when: null }, { system: {} })).toBe(true);
  });

  it("пустой список строк — да, всем", () => {
    expect(entryWhenOk(null, { when: when([]) }, { system: { submutation: { label: "4" } } })).toBe(true);
  });

  it("нет предмета вовсе — да (вызов вне контекста Механики, как «нет актора» у Геносемени)", () => {
    expect(entryWhenOk(null, { when: when(["4"]) })).toBe(true);
  });

  it("предмет есть, субмутация ещё не выбрана — нет (запись не включается ДО броска)", () => {
    expect(entryWhenOk(null, { when: when(["4"]) }, { system: { submutation: { label: "" } } })).toBe(false);
  });

  it("строка совпала — да", () => {
    expect(entryWhenOk(null, { when: when(["4"]) }, { system: { submutation: { label: "4" } } })).toBe(true);
  });

  it("строка не совпала — нет", () => {
    expect(entryWhenOk(null, { when: when(["4"]) }, { system: { submutation: { label: "6" } } })).toBe(false);
  });

  it("несколько строк — ИЛИ", () => {
    const w = when(["4", "6"]);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "4" } } })).toBe(true);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "6" } } })).toBe(true);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "1" } } })).toBe(false);
  });

  it("negateSub переворачивает — «любая, КРОМЕ этой»", () => {
    const w = when(["4"], true);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "4" } } })).toBe(false);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "6" } } })).toBe(true);
  });

  it("negateSub + субмутация ещё не выбрана — всё равно нет: запись не включается ДО броска", () => {
    const w = when(["4"], true);
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "" } } })).toBe(false);
    expect(entryWhenOk(null, { when: w }, { system: {} })).toBe(false);
  });

  it("свой negateSub не путается с общим negate Геносемени", () => {
    // negate:true задан, но условий Геносемени нет вовсе — на субмутацию не влияет.
    const w = { negate: true, conditions: [], submutations: ["4"], negateSub: false };
    expect(entryWhenOk(null, { when: w }, { system: { submutation: { label: "4" } } })).toBe(true);
  });
});

describe("applyItemMechanics — гейт на разовой выдаче Черты по субмутации", () => {
  it("выпала «Кошка» — Dark Sight выдаётся", async () => {
    const item = mutationOnActor({
      mechanics: [andGroup(traitEntry("e1", when(["4"])))],
      submutation: { label: "4" }
    });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Dark Sight / Ночное Зрение");
  });

  it("выпала другая строка — не выдаётся", async () => {
    const item = mutationOnActor({
      mechanics: [andGroup(traitEntry("e1", when(["4"])))],
      submutation: { label: "1" }
    });
    await applyItemMechanics(item);
    expect(item.parent.items).toHaveLength(0);
  });

  it("субмутация ещё не брошена — не выдаётся, но и не помечается применённой", async () => {
    const item = mutationOnActor({
      mechanics: [andGroup(traitEntry("e1", when(["4"])))],
      submutation: {}
    });
    await applyItemMechanics(item);
    expect(item.parent.items).toHaveLength(0);

    // Бросок субмутации (setSubmutation, apps/submutations.mjs) пишет только
    // system.submutation.* — Hooks.on в стенде пустышка, хук updateItem тут НЕ
    // стреляет, поэтому applyItemMechanics зовётся руками. Что живой хук на
    // такую правку среагирует — отдельно доказывает тест предиката
    // mechanicsRelevantChange ниже: хук — ровно «предикат → applyItemMechanics».
    await item.update({ "system.submutation.label": "4" });
    await applyItemMechanics(item);
    expect(item.parent.items.map(i => i.name)).toContain("Dark Sight / Ночное Зрение");
  });
});

describe("mechanicsRelevantChange — предикат хука updateItem (warhammer-dbc.mjs)", () => {
  it("правка групп Конструктора — да, и пустой список тоже (снятие последней группы)", () => {
    expect(mechanicsRelevantChange({ flags: { [FLAG]: { mechanics: [{}] } } })).toBe(true);
    expect(mechanicsRelevantChange({ flags: { [FLAG]: { mechanics: [] } } })).toBe(true);
  });

  it("бросок/реролл/сброс субмутации (system.submutation.*) — да: гейт when.submutations должен пересчитаться", () => {
    expect(mechanicsRelevantChange({ system: { submutation: { label: "4" } } })).toBe(true);
    expect(mechanicsRelevantChange({ system: { submutation: { label: "" } } })).toBe(true);
  });

  it("посторонняя правка — нет: ни рекурсии от собственных флагов, ни лишних пересборок", () => {
    expect(mechanicsRelevantChange({ name: "Другое имя" })).toBe(false);
    expect(mechanicsRelevantChange({ system: { benefit: "текст" } })).toBe(false);
    expect(mechanicsRelevantChange({ flags: { [FLAG]: { mechanicsApplied: ["e1"] } } })).toBe(false);
    expect(mechanicsRelevantChange({})).toBe(false);
    expect(mechanicsRelevantChange(undefined)).toBe(false);
  });
});

describe("syncMechanicsEffects — гейт на долговечной записи по субмутации", () => {
  it("эффект стоит только пока субмутация совпадает — реролл её убирает", async () => {
    const item = mutationOnActor({
      mechanics: [andGroup(charEntry("e1", 2, when(["4"])))],
      submutation: { label: "4" }
    });

    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);

    // Игрок перебросил субмутацию — выпала другая строка.
    await item.update({ "system.submutation.label": "1" });
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(0);

    // И обратно — строка снова та же, эффект возвращается.
    await item.update({ "system.submutation.label": "4" });
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);
  });

  it("две записи на разные строки одной Мутации — включена только своя", async () => {
    const item = mutationOnActor({
      mechanics: [andGroup(
        charEntry("e-cat", 2, when(["4"])),
        charEntry("e-snake", 3, when(["6"]))
      )],
      submutation: { label: "6" }
    });

    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].system.changes[0].value).toBe(3);
  });
});
