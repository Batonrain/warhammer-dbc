// test/apps/armour-history-trance.test.mjs
//
// Транс «Дух героя» (module/apps/armour-history-trance.mjs, wdbc-vyua):
// разовый выбор одного из N баффов на время боя + откат с Порчей по концу
// боя. Не toggle-abilities (см. шапку модуля) — свой маленький модуль, тем
// же приёмом, что Сус-ан Мембрана (apps/sus-an-heal.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  currentTrance, findTranceOption, activeTrance, tranceButtonHtml, useTrance, resolveTrancesForCombat
} from "../../module/apps/armour-history-trance.mjs";

const FLAG = "warhammer-dbc";
const FEARLESS_TALENT = { name: "Fearless / Бесстрашный", type: "talent", system: {}, effects: [] };

function fakePack(index, documents) {
  return {
    getIndex: async () => index,
    getDocument: async id => documents[id] ? { toObject: () => structuredClone(documents[id]) } : null
  };
}

let nextId = 1;

/** Предмет-заглушка: getFlag/setFlag правят один и тот же объект. */
function itemStub(data) {
  const it = { id: data.id || data._id || `item-${nextId++}`, ...structuredClone(data) };
  it.flags ??= {};
  it.getFlag = (scope, key) => it.flags[scope]?.[key];
  it.setFlag = async (scope, key, v) => { it.flags[scope] ??= {}; it.flags[scope][key] = v; };
  return it;
}

function armorWithHistory(historyName, table = "legend") {
  return itemStub({
    id: "armor1", name: "Тестовая Броня", type: "armor", img: "icons/armor.svg",
    system: { armorType: "power", history: { table, name: historyName } }
  });
}

function actorWith({ id = "actor-1", items = [], corruption = 0 } = {}) {
  const actor = {
    id, name: "Тестовый Астартес",
    system: { corruption: { value: corruption } },
    items,
    update: async data => {
      captured.updates.push(data);
      if ("system.corruption.value" in data) actor.system.corruption.value = data["system.corruption.value"];
    },
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => itemStub(d));
      items.push(...created);
      captured.created.push(...docs);
      return created;
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      for (const id of ids) {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      }
    }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  nextId = 1;
  globalThis.game.combat = undefined;
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map([
    ["warhammer-dbc.talents", fakePack(
      [{ _id: "fear1", name: FEARLESS_TALENT.name }],
      { fear1: FEARLESS_TALENT }
    )]
  ]);
});

describe("currentTrance", () => {
  it("у «Духа героя» есть транс с тремя вариантами", () => {
    const trance = currentTrance(armorWithHistory("Дух героя"));
    expect(trance).toBeTruthy();
    expect(trance.options.map(o => o.key)).toEqual(["ws", "bs", "fearless"]);
    expect(trance.corruptionRoll).toBe("1d10");
  });

  it("у истории без транса — null", () => {
    expect(currentTrance(armorWithHistory("Последний выживший"))).toBeNull();
  });

  it("истории нет вовсе — null", () => {
    expect(currentTrance(armorWithHistory(""))).toBeNull();
  });

  it("не силовая броня — null", () => {
    const item = itemStub({ id: "a2", type: "armor", system: { armorType: "primitive", history: { table: "legend", name: "Дух героя" } } });
    expect(currentTrance(item)).toBeNull();
  });
});

describe("findTranceOption", () => {
  it("находит по ключу, неизвестный ключ — null", () => {
    const trance = currentTrance(armorWithHistory("Дух героя"));
    expect(findTranceOption(trance, "bs").label).toBe("+15 к BS");
    expect(findTranceOption(trance, "нет-такого")).toBeNull();
  });
});

describe("activeTrance", () => {
  it("находит носителя по tranceOf, чужой предмет не мешает", () => {
    const carrier = itemStub({ id: "c1", name: "Дух героя: +15 к WS",
      flags: { [FLAG]: { tranceOf: "armor1", tranceOptionLabel: "+15 к WS", tranceCombatId: "combat1" } } });
    const other = itemStub({ id: "c2", flags: {} });
    const actor = actorWith({ items: [other, carrier] });
    expect(activeTrance(actor, "armor1")).toEqual({ itemId: "c1", optionLabel: "+15 к WS", combatId: "combat1" });
  });

  it("нет носителя — null", () => {
    expect(activeTrance(actorWith(), "armor1")).toBeNull();
  });
});

describe("tranceButtonHtml", () => {
  it("нет транса — пусто", () => {
    expect(tranceButtonHtml(armorWithHistory("Последний выживший"), actorWith())).toBe("");
  });

  it("транс есть, не активен — кнопка", () => {
    const html = tranceButtonHtml(armorWithHistory("Дух героя"), actorWith());
    expect(html).toContain("pa-trance-btn");
    expect(html).toContain("Впасть в транс");
  });

  it("транс активен — статус вместо кнопки", () => {
    const carrier = itemStub({ id: "c1", flags: { [FLAG]: { tranceOf: "armor1", tranceOptionLabel: "+15 к BS" } } });
    const html = tranceButtonHtml(armorWithHistory("Дух героя"), actorWith({ items: [carrier] }));
    expect(html).toContain("pa-trance-status");
    expect(html).toContain("+15 к BS");
    expect(html).not.toContain("pa-trance-btn");
  });
});

describe("useTrance", () => {
  it("не в бою — предупреждает, ничего не создаёт", async () => {
    const actor = actorWith();
    await useTrance(actor, armorWithHistory("Дух героя"));
    expect(captured.warnings.length).toBe(1);
    expect(actor.items.length).toBe(0);
  });

  it("уже в трансе — предупреждает и не открывает диалог снова", async () => {
    const item = armorWithHistory("Дух героя");
    const carrier = itemStub({ id: "c1", flags: { [FLAG]: { tranceOf: "armor1" } } });
    const actor = actorWith({ items: [carrier] });
    await useTrance(actor, item);
    expect(captured.warnings.length).toBe(1);
    expect(captured.dialog).toBeNull();
  });

  it("выбор +15 к WS: создаёт носителя с эффектом и уходит в чат", async () => {
    const item = armorWithHistory("Дух героя");
    const actor = actorWith();
    globalThis.game.combat = { id: "combat1", combatants: [{ actor }] };

    const promise = useTrance(actor, item);
    expect(captured.dialog?.buttons?.ws).toBeTruthy();
    await captured.dialog.buttons.ws.callback();
    await promise;

    expect(actor.items.length).toBe(1);
    const carrier = actor.items[0];
    expect(carrier.type).toBe("trait");
    expect(carrier.effects[0].system.changes[0]).toMatchObject({ key: "system.characteristics.ws.totalFx", value: 15 });
    expect(carrier.flags[FLAG]).toMatchObject({
      tranceOf: "armor1", tranceCombatId: "combat1", tranceCorruptionRoll: "1d10", tranceOptionLabel: "+15 к WS"
    });
    expect(captured.chat.length).toBe(1);
  });

  it("выбор Fearless: клонирует Талант из компендиума", async () => {
    const item = armorWithHistory("Дух героя");
    const actor = actorWith();
    globalThis.game.combat = { id: "combat1", combatants: [{ actor }] };

    const promise = useTrance(actor, item);
    await captured.dialog.buttons.fearless.callback();
    await promise;

    expect(actor.items.length).toBe(1);
    expect(actor.items[0].name).toBe("Fearless / Бесстрашный");
    expect(actor.items[0].flags[FLAG].tranceOf).toBe("armor1");
  });

  it("диалог закрыт без выбора — ничего не создаёт", async () => {
    const item = armorWithHistory("Дух героя");
    const actor = actorWith();
    globalThis.game.combat = { id: "combat1", combatants: [{ actor }] };

    const promise = useTrance(actor, item);
    await captured.dialog.close();
    await promise;

    expect(actor.items.length).toBe(0);
    expect(captured.chat.length).toBe(0);
  });
});

describe("resolveTrancesForCombat", () => {
  function pendingSetup({ corruption = 5 } = {}) {
    const carrier = itemStub({ id: "c1", name: "Дух героя: +15 к WS",
      flags: { [FLAG]: { tranceOf: "armor1", tranceCombatId: "combat1", tranceCorruptionRoll: "1d10" } } });
    const actor = actorWith({ items: [carrier], corruption });
    const combat = { id: "combat1", combatants: [{ actor }] };
    return { actor, carrier, combat };
  }

  it("снимает носителя и бросает Порчу по его формуле", async () => {
    captured.nextRoll = 6;
    const { actor, combat } = pendingSetup({ corruption: 5 });
    await resolveTrancesForCombat(combat);
    expect(actor.items.length).toBe(0);
    expect(actor.system.corruption.value).toBe(11);
    expect(captured.chat.length).toBe(1);
  });

  it("не поднимает Порчу выше 100", async () => {
    captured.nextRoll = 10;
    const { actor, combat } = pendingSetup({ corruption: 98 });
    await resolveTrancesForCombat(combat);
    expect(actor.system.corruption.value).toBe(100);
  });

  it("не-ГМ ничего не трогает", async () => {
    globalThis.game.user = { isGM: false };
    const { actor, combat } = pendingSetup();
    await resolveTrancesForCombat(combat);
    expect(actor.items.length).toBe(1);
  });

  it("нет носителей этого боя — не трогает", async () => {
    const actor = actorWith();
    await resolveTrancesForCombat({ id: "combat1", combatants: [{ actor }] });
    expect(actor.items.length).toBe(0);
  });
});
