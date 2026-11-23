// test/combat/monarch-lacrimallus-script-limit.test.mjs
//
// Приёмка #597: кнопки «▶ Запустить» Сборочной Линии (лимит «сутки»),
// Пробуждения и Короны Полентии («раунд»). runMechScriptEntry тратит лимит,
// когда код вернул пустое значение, и не тратит на truthy (отказ — результат
// ui.notifications.warn, отмена — CANCEL). Код был `await useX(actor);` без
// return — лимит сгорал и на отказе, и на отмене окна.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { runMechScriptEntry, scriptRunReady } from "../../module/apps/mechanics.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";

const NS = "warhammer-dbc";
const LACRIMALLUS = ["packs-src/talents/Элитные_архетипы/Лакрималлус", "T2N6fi5JexfGE3ki", "assemblyLineBtn1"];
const AWAKENING = ["packs-src/talents/Элитные_архетипы/Монарх", "JCUahHRT0WNLHJLk", "awakeningBtn0001"];
const CORONA = ["packs-src/traits/Элитные_архетипы/Монарх", "KJ38G1RKcQ16Eb6E", "coronaSwapBtn001"];

function packItem([dir, id, entryId]) {
  const doc = packDocById(dir, id);
  const flags = structuredClone(doc.flags);
  const groups = flags[NS].mechanics;
  const group = groups.find(g => g.entries.some(e => e.id === entryId));
  const item = {
    id, name: doc.name, type: doc.type, flags,
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { (flags[scope] ??= {})[key] = value; return value; }
  };
  return { item, groupId: group.id, entry: group.entries.find(e => e.id === entryId) };
}

function actorWith(...items) {
  const actor = { name: "Монарх", items, system: { followers: [], resourcePools: {}, characteristics: { wp: { total: 40 } } },
    update: async upd => { for (const [k, v] of Object.entries(upd)) if (k.startsWith("system.resourcePools.")) actor.system.resourcePools[k.split(".").pop()] = v; } };
  for (const i of items) i.actor = actor;
  return actor;
}

const DialogV2 = globalThis.foundry.applications.api.DialogV2;
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; delete DialogV2.prompt; });

describe("кнопки Монарха и Лакрималлуса: лимит тратит только состоявшееся использование", () => {
  it("Сборочная Линия: нет Орд — отказ, «сутки» не сгорают", async () => {
    globalThis.game.time = { worldTime: 100000 };
    const { item, groupId, entry } = packItem(LACRIMALLUS);
    actorWith(item);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(scriptRunReady(item, entry)).toBe(true);
  });

  it("Корона Полентия: смена контейнера тратит «раз в Раунд»", async () => {
    globalThis.game.combat = { round: 1 };
    const { item, groupId, entry } = packItem(CORONA);
    actorWith(item);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(item.actor.system.resourcePools.vassalAp).toBe(1);
    expect(scriptRunReady(item, entry)).toBe(false);
  });

  it("Корона Полентия без пула — отказ, Раунд не сгорает", async () => {
    globalThis.game.combat = { round: 1 };
    const { item, groupId, entry } = packItem(CORONA);
    item.flags[NS].mechanics = item.flags[NS].mechanics.map(g => ({ ...g, entries: g.entries.filter(e => e.kind !== "resourcePool") }));
    actorWith(item);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(scriptRunReady(item, entry)).toBe(true);
  });

  it("Пробуждение: окно закрыли — Раунд не сгорает", async () => {
    globalThis.game.combat = { round: 1 };
    DialogV2.prompt = async () => null;
    const aw = packItem(AWAKENING);
    actorWith(aw.item, packItem(CORONA).item);
    await runMechScriptEntry(aw.item, aw.groupId, aw.entry.id);
    expect(scriptRunReady(aw.item, aw.entry)).toBe(true);
  });
});
