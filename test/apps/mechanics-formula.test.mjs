// test/apps/mechanics-formula.test.mjs
//
// Поля «Значение»/«Рейтинг» Конструктора МЕХАНИКА принимают формулу
// (module/rules/mech-formula.mjs), не только голое число — по просьбе из
// чата: «позволить полям Конструктора выдавать рейтинг, равный формуле».
// Здесь — что формула реально считается по актору-получателю на живом пути
// applyItemMechanics/syncMechanicsEffects, а не только в чистом
// mechFormulaTotal (test/rules/mech-formula.test.mjs). Примеры — прямо из
// книги: «Flyer (A.b×2)» (Крылья), «Unnatural S (½Cor.b, окр.▲)».

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics, syncMechanicsEffects } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const traitEntry = (id, rating) => ({
  id, kind: "trait", sourceUuid: "Compendium.warhammer-dbc.traits.Item.abc123",
  sourceName: "Unnatural S / Сверхъестественная Сила", rating, when: null
});
const charEntry = (id, value) =>
  ({ id, kind: "characteristic", charKey: "ag", field: "bonus", op: "add", value, when: null });

function itemOnActor({ mechanics = [], characteristics = {}, corruptionBonus = 0 } = {}) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = { characteristics, corruptionBonus };
  actor.items = [];
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => ({ id: `it-${seq++}`, name: d.name, type: d.type, system: d.system,
                                  getFlag: (_s2, k) => d.flags?.[FLAG]?.[k] }));
    actor.items.push(...made);
    return made;
  };

  const item = {
    id: "item-1", type: "mutation", name: "Крылья", img: "icons/svg/acid.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    update: async () => item,
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

describe("syncMechanicsEffects — Значение формулой", () => {
  it("Flyer (A.b×2) — эффект считает по A.b актора", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(charEntry("e1", "ag*2"))],
      characteristics: { ag: { bonus: 4 } }
    });
    await syncMechanicsEffects(item);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].system.changes[0].value).toBe(8);
  });

  it("эффект пересчитывается заново, если A.b изменился между прогонами", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(charEntry("e1", "ag*2"))],
      characteristics: { ag: { bonus: 4 } }
    });
    await syncMechanicsEffects(item);
    expect(item.effects[0].system.changes[0].value).toBe(8);

    item.parent.system.characteristics.ag.bonus = 6;
    await syncMechanicsEffects(item);
    expect(item.effects[0].system.changes[0].value).toBe(12);
  });

  it("голое число в поле Значение работает как раньше", async () => {
    const item = itemOnActor({ mechanics: [andGroup(charEntry("e1", "3"))] });
    await syncMechanicsEffects(item);
    expect(item.effects[0].system.changes[0].value).toBe(3);
  });

  it("синтаксически битая формула — запись считается незаполненной (не тихий 0)", async () => {
    // Синтаксическая ошибка ловится ДО применения — на этапе isEntryComplete,
    // тем же путём, что незаполненное поле: эффект просто не заводится,
    // ничего не роняет и не пишет молчаливый ноль автору на лист.
    const item = itemOnActor({ mechanics: [andGroup(charEntry("e1", "ag+++"))] });
    await expect(syncMechanicsEffects(item)).resolves.not.toThrow();
    expect(item.effects).toHaveLength(0);
  });
});

describe("applyItemMechanics — Рейтинг Черты формулой", () => {
  it("Unnatural S (½Cor.b, окр.▲) — рейтинг считается по Cor.b актора", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(traitEntry("e1", "ceil(cor/2)"))],
      corruptionBonus: 9
    });
    await applyItemMechanics(item);
    expect(item.parent.items).toHaveLength(1);
    expect(item.parent.items[0].system.rating).toBe(5); // ceil(9/2) = 5
  });

  it("голый рейтинг — как раньше", async () => {
    const item = itemOnActor({ mechanics: [andGroup(traitEntry("e1", "2"))] });
    await applyItemMechanics(item);
    expect(item.parent.items[0].system.rating).toBe(2);
  });
});
