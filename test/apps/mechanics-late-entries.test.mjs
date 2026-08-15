// test/apps/mechanics-late-entries.test.mjs
//
// Продолжение симптома 1 отчёта (wdbc-gak), вторая его половина.
//
// Пересборка эффектов (syncMechanicsEffects) починила ДОЛГОВЕЧНЫЕ записи:
// характеристику, вес, перемещение. Но жалоба была шире — «механика не
// работает вовсе», а не «числа не пересчитываются». Черта из библиотеки
// приезжает пустой, и ГМ дописывает ей на листе актора что угодно, в том числе
// РАЗОВОЕ: «выдать Черту», «± Раны», «± Порча», «Код». Такая запись не
// применяется никогда: applyItemMechanics отсекается на `!groups.length` (при
// createItem механики ещё нет) и потом на mechanicsApplied.
//
// Поэтому «применено» перестаёт быть свойством ПРЕДМЕТА и становится свойством
// ЗАПИСИ: mechanicsApplied — список id уже сработавших. Разовое от повтора
// держит этот список, а не общий выключатель, и дописанное позже применяется
// ровно один раз.
//
// Старое `mechanicsApplied === true` читается как «всё, что тогда лежало» —
// иначе первый же прогон на живом мире переиграл бы Порчу, Раны и выдачи.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";
import { materializeMechanicsApplied } from "../../module/migrations/item-effects.mjs";

const FLAG = "warhammer-dbc";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const woundsEntry = (id, value = "3") => ({ id, kind: "wounds", op: "add", woundsValue: value });

/** Предмет на акторе: столько, сколько трогает применение механики. */
function itemOnActor({ mechanics = [], flags = {} } = {}) {
  const own = { mechanics, ...flags };
  const actor = new Actor();
  actor.system = { wounds: { max: 10 } };
  actor.update = async data => { actor.system.wounds.max = data["system.wounds.max"]; };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;

  let seq = 0;
  const item = {
    id: "item-1", type: "trait", name: "Черта", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
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

beforeEach(() => { globalThis.game.user = { isGM: true }; });

describe("разовая запись, дописанная на предмете у актора", () => {
  it("применяется — предмет из библиотеки приезжает без механики", async () => {
    // Так это и выглядит: createItem отработал на пустой механике, ГМ дописал
    // «± Раны» уже на листе. Прежде здесь не происходило ничего.
    const item = itemOnActor();
    await applyItemMechanics(item);                    // createItem: механики нет
    expect(item.parent.system.wounds.max).toBe(10);

    await item.setFlag(FLAG, "mechanics", [andGroup(woundsEntry("e1"))]);
    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBeGreaterThan(10);
  });

  it("второй раз не отыгрывается", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))] });
    await applyItemMechanics(item);
    const afterFirst = item.parent.system.wounds.max;

    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBe(afterFirst);
  });

  it("соседняя запись, дописанная позже, отыгрывается своя и только раз", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))] });
    await applyItemMechanics(item);
    const afterFirst = item.parent.system.wounds.max;

    await item.setFlag(FLAG, "mechanics", [andGroup(woundsEntry("e1"), woundsEntry("e2"))]);
    await applyItemMechanics(item);
    const afterSecond = item.parent.system.wounds.max;
    expect(afterSecond).toBeGreaterThan(afterFirst);

    await applyItemMechanics(item);
    expect(item.parent.system.wounds.max).toBe(afterSecond);
  });

  it("предмет из мира прошлой версии разовое не переигрывает", async () => {
    // mechanicsApplied === true — «применено всё, что тогда лежало».
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))],
                               flags: { mechanicsApplied: true } });

    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBe(10);
  });

  it("а дописанное после перевода флага — отыгрывает", async () => {
    // Перевод булева флага в список делает миграция при загрузке мира, когда
    // дописать ещё ничего не успели. Делать ту же догадку на лету нельзя:
    // «всё, что лежит сейчас» проглотило бы только что дописанную запись.
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))],
                               flags: { mechanicsApplied: true } });
    await materializeMechanicsApplied(item);
    expect(item.getFlag(FLAG, "mechanicsApplied")).toEqual(["e1"]);

    await item.setFlag(FLAG, "mechanics", [andGroup(woundsEntry("e1"), woundsEntry("e2"))]);
    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBeGreaterThan(10);
  });
});

describe("предмет вне актора", () => {
  it("механику не применяет", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))] });
    const actor = item.parent;
    item.parent = null;

    await applyItemMechanics(item);

    expect(actor.system.wounds.max).toBe(10);
  });
});
