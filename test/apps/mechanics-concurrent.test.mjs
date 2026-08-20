// test/apps/mechanics-concurrent.test.mjs
//
// Гонка двух применений механики одного предмета.
//
// Идемпотентность держится на mechanicsApplied, но флаг читается в НАЧАЛЕ
// применения и пишется в КОНЦЕ. Стартов у применения несколько и они
// независимы: прямой вызов из applyRace рядом с хуком createItem, а на
// холодном мире — и два хука, разошедшихся из-за сетевых задержек на каждую
// выдачу. Если они перекроются, оба прочитают ещё пустой флаг, оба сочтут себя
// первыми и оба выдадут ВСЁ: живьём Черта Геносемя раздала 38 органов вместо
// 19, а архетип Апотекарий — два Нартеция.
//
// Тестами это раньше не ловилось: Hooks в стенде — пустышка, поэтому
// отрабатывал только один старт, и «зелёный» прогон про гонку ничего не
// доказывал. Здесь два старта заводятся руками, без хуков.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";
import { captured } from "../support/foundry-stub.mjs";

const FLAG = "warhammer-dbc";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const woundsEntry = (id, value = "3") => ({ id, kind: "wounds", op: "add", woundsValue: value });

/**
 * Предмет на акторе. Задержка в setFlag воспроизводит то, из-за чего гонка и
 * возникает вживую: запись флага уходит на сервер и возвращается не мгновенно,
 * а второй старт успевает прочитать его до этого.
 */
function itemOnActor({ mechanics = [], flagDelayMs = 0, uuid = "Actor.a1.Item.item-1" } = {}) {
  const own = { mechanics };
  const actor = new Actor();
  actor.system = { wounds: { max: 10 } };
  actor.update = async data => { actor.system.wounds.max = data["system.wounds.max"]; };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;

  const item = {
    id: "item-1", uuid, type: "trait", name: "Черта", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => {
      if (flagDelayMs) await new Promise(r => setTimeout(r, flagDelayMs));
      own[k] = v;
      return v;
    },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => item,
    createEmbeddedDocuments: async (_t, docs) => docs.map((d, n) => ({ id: `fx-${n}`, name: d.name, system: d.system })),
    deleteEmbeddedDocuments: async (_t, ids) => ids
  };
  return item;
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  // Стенд отдаёт на любую формулу одно и то же число (по умолчанию 50).
  // Ставим 3, чтобы «+3 Раны» в записи и арифметика в ожиданиях совпадали.
  captured.nextRoll = 3;
});

describe("два применения механики одного предмета внахлёст", () => {
  it("разовая запись отыгрывается ровно один раз", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))], flagDelayMs: 5 });

    // Два независимых старта, как хук createItem и прямой вызов из applyRace.
    await Promise.all([applyItemMechanics(item), applyItemMechanics(item)]);

    // Одна запись «+3 Раны» — значит 13, а не 16.
    expect(item.parent.system.wounds.max).toBe(13);
    expect(item.getFlag(FLAG, "mechanicsApplied")).toEqual(["e1"]);
  });

  it("не теряет записи, когда стартов больше двух", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"), woundsEntry("e2"))], flagDelayMs: 3 });

    await Promise.all([0, 1, 2, 3].map(() => applyItemMechanics(item)));

    // Обе записи по разу: 10 + 3 + 3.
    expect(item.parent.system.wounds.max).toBe(16);
    expect(new Set(item.getFlag(FLAG, "mechanicsApplied"))).toEqual(new Set(["e1", "e2"]));
  });

  it("очередь у разных предметов независима", async () => {
    const a = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))], uuid: "Actor.a1.Item.A" });
    const b = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))], uuid: "Actor.a1.Item.B" });

    await Promise.all([applyItemMechanics(a), applyItemMechanics(b)]);

    expect(a.parent.system.wounds.max).toBe(13);
    expect(b.parent.system.wounds.max).toBe(13);
  });

  it("упавшее применение не заклинивает очередь следующему", async () => {
    const item = itemOnActor({ mechanics: [andGroup(woundsEntry("e1"))] });
    const целый = item.parent.update;
    item.parent.update = async () => { throw new Error("сервер не ответил"); };

    await expect(applyItemMechanics(item)).rejects.toThrow("сервер не ответил");

    item.parent.update = целый;
    await applyItemMechanics(item);

    expect(item.parent.system.wounds.max).toBe(13);
  });
});
