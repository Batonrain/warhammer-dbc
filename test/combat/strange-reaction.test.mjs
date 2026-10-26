// test/combat/strange-reaction.test.mjs
//
// Странная Техника / Strange Technique (Рукопашные, Sahara 3-8dc5): +1 Реакция,
// тратится ТОЛЬКО на атаки вроде хвоста/мехадендритов/бонусных «Повалить» (не на
// Избегание и не на Furious Assault). Отдельный пул system.reactions.strangeValue —
// по образцу defenseValue Защитной Стойки; общая +1 к reactions.max у Таланта снята.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import {
  resetActionEconomy, canSpendReaction, spendReaction, effectiveStrangeReactionMax
} from "../../module/combat/action-economy.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { strangeReactionMax, STRANGE_TECHNIQUE_KEY } from "../../module/rules/melee-talents.mjs";

const talentDoc = packDocById("packs-src/talents/Рукопашные", "T5D0bzAETftow4OF");

/** Предмет-носитель Таланта — настоящая запись Конструктора из пака. */
const strangeItem = () => ({
  id: "st", name: talentDoc.name, type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: talentDoc.flags["warhammer-dbc"].mechanics } }
});

function actorFor({ items = [], type = "character", reactions = {} } = {}) {
  const store = {};
  const doc = {
    id: "a1", type, items,
    system: {
      meleeStance: "standard",
      actionPoints: { value: 2, max: 2 },
      reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0, strangeValue: 0, ...reactions }
    }
  };
  doc.update = async (changes = {}) => {
    for (const [p, value] of Object.entries(changes)) {
      const m = p.match(/^flags\.([^.]+)\.(-=)?(.+)$/);
      if (m) { if (m[2]) delete store[`${m[1]}.${m[3]}`]; else store[`${m[1]}.${m[3]}`] = value; continue; }
      const keys = p.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async () => {};
  return doc;
}
const inCombat = () => { globalThis.game.combat = { started: true, combatant: null }; };
afterEach(() => { globalThis.game.combat = undefined; });

describe("Странная Техника: данные пака", () => {
  it("общая +1 к system.reactions.max снята: ActiveEffect у Таланта нет", () => {
    expect(talentDoc.effects).toEqual([]);
  });
  it("Талант несёт запись Конструктора с ключом возможности", () => {
    const keys = talentDoc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(STRANGE_TECHNIQUE_KEY);
  });
});

describe("Странная Техника: старый общий эффект не уцелел нигде в паках", () => {
  it("ни у одного предмета-Таланта (в том числе вложенного в бестиарий) нет ActiveEffect «+1 к reactions.max»", () => {
    const bad = [];
    for (const pack of ["bestiary", "talents"]) {
      for (const { doc, file } of allPackDocuments(pack)) {
        const items = [doc, ...(doc.items ?? [])];
        for (const it of items) {
          if (!/Strange Technique/.test(it?.name ?? "")) continue;
          for (const e of it.effects ?? []) {
            if ((e.system?.changes ?? e.changes ?? []).some(c => c.key === "system.reactions.max")) bad.push(`${pack}: ${doc.name}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});

describe("Странная Техника: максимум пула", () => {
  it("с Талантом по ключу — 1", () => {
    expect(strangeReactionMax(actorFor({ items: [{ ...strangeItem(), name: "ИСПОРЧЕННОЕ" }] }))).toBe(1);
  });
  it("с Талантом по имени (снимок без записи) — 1", () => {
    expect(strangeReactionMax(actorFor({ items: [{ id: "x", name: "Strange Technique / Странная Техника", type: "talent", system: {} }] }))).toBe(1);
  });
  it("без Таланта — 0", () => {
    expect(strangeReactionMax(actorFor())).toBe(0);
    expect(effectiveStrangeReactionMax(actorFor())).toBe(0);
  });
});

describe("Странная Техника: пул в Ходе", () => {
  it("сброс Хода выдаёт 1 «странную» Реакцию, универсальный максимум не вырос", async () => {
    inCombat();
    const a = actorFor({ items: [strangeItem()], reactions: { value: 0 } });
    await resetActionEconomy(a);
    expect(a.system.reactions.strangeValue).toBe(1);
    expect(a.system.reactions.value).toBe(1);   // обычный пул — 1, а не 2
  });
  it("без Таланта пул остаётся 0", async () => {
    inCombat();
    const a = actorFor();
    await resetActionEconomy(a);
    expect(a.system.reactions.strangeValue ?? 0).toBe(0);
  });
  it("оглушённый (apLocked) — пул 0", async () => {
    inCombat();
    const a = actorFor({ items: [strangeItem()] });
    a.system.conditions = { unconscious: true };
    await resetActionEconomy(a);
    expect(a.system.reactions.strangeValue).toBe(0);
  });
});

describe("Странная Техника: трата", () => {
  it("странная атака с пустым общим пулом — тратит странную Реакцию", async () => {
    inCombat();
    const a = actorFor({ items: [strangeItem()], reactions: { value: 0, strangeValue: 1 } });
    expect(canSpendReaction(a, { strange: true })).toBe(true);
    expect(await spendReaction(a, { strange: true })).toBe(true);
    expect(a.system.reactions.strangeValue).toBe(0);
    expect(a.system.reactions.value).toBe(0);
  });
  it("странная Реакция тратится раньше обычной, обычная остаётся", async () => {
    inCombat();
    const a = actorFor({ reactions: { value: 1, strangeValue: 1 } });
    await spendReaction(a, { strange: true });
    expect(a.system.reactions.strangeValue).toBe(0);
    expect(a.system.reactions.value).toBe(1);
  });
  it("обычное Избегание странную Реакцию НЕ тратит и не может на неё опереться", async () => {
    inCombat();
    const a = actorFor({ reactions: { value: 0, strangeValue: 1 } });
    expect(canSpendReaction(a, { forDefense: true })).toBe(false);
    expect(canSpendReaction(a)).toBe(false);
    expect(await spendReaction(a, { forDefense: true })).toBe(false);
    expect(a.system.reactions.strangeValue).toBe(1);
  });
  it("Избегание при полном общем пуле тратит общую, странная остаётся", async () => {
    inCombat();
    const a = actorFor({ reactions: { value: 1, strangeValue: 1 } });
    await spendReaction(a, { forDefense: true });
    expect(a.system.reactions.value).toBe(0);
    expect(a.system.reactions.strangeValue).toBe(1);
  });
  it("странная Реакция при пустых обоих пулах и без strange — отказ; со strange и пустой странной — отказ", async () => {
    inCombat();
    const a = actorFor({ reactions: { value: 0, strangeValue: 0 } });
    expect(canSpendReaction(a, { strange: true })).toBe(false);
  });
});
