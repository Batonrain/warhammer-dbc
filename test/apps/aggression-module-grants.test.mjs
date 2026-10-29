// test/apps/aggression-module-grants.test.mjs
//
// Модуль Агрессии Скитария (корбук «Бионика и Кибернетика»): Frenzy — любое
// Качество; Good.Q — ещё Cold Fury и Fire in Blood; Best.Q — как Good.Q;
// Poor.Q — −10 к I. Решение владельца 27.10.2026: Таланты выдаются НАСТОЯЩИМИ
// предметами (чтобы работали требования других Талантов и вкладка Талантов),
// а не только Возможностями, и ведутся ЖИВЬЁМ — при установке, извлечении и
// смене Качества (раньше выдача была разовой при получении предмета и
// «залипала»).
//
// Берётся НАСТОЯЩИЙ документ из packs-src/implants (урок wdbc-g6cb: фикстура
// из выдуманного JSON не доказывает, что запись в паке жива).

import "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { abs } from "../../tools/packs.mjs";
import {
  syncLiveGrants, hasLiveSyncedGrants, onItemQualityChanged, applyItemMechanics, syncMechanicsEffects
} from "../../module/apps/mechanics.mjs";
import { hasColdFury } from "../../module/rules/predicates.mjs";
import { hasAbility } from "../../module/rules/ability-by-key.mjs";
import { rageRules } from "../../module/rules/rage.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const FLAG = "warhammer-dbc";

function loadModule() {
  const dir = abs("packs-src/implants");
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(e.parentPath ?? e.path, e.name), "utf8"));
    if (/aggression module|модуль агрессии/i.test(doc.name ?? "")) found.push(doc);
  }
  expect(found).toHaveLength(1);
  return found[0];
}
const DOC = loadModule();

/** Актор-заглушка с коллекцией предметов, умеющей создавать/удалять встроенные документы. */
function makeActor() {
  const actor = new Actor();
  actor.system = { inRage: true, characteristics: {}, wounds: {}, conditions: {} };
  const items = [];
  items.contents = items;
  items.get = id => items.find(i => i.id === id) ?? null;
  actor.items = items;
  let seq = 0;
  const wrap = d => ({
    id: `g-${seq++}`, name: d.name, type: d.type, system: d.system ?? {}, flags: d.flags,
    getFlag: (_s, k) => d.flags?.[FLAG]?.[k]
  });
  actor.createEmbeddedDocuments = async (_t, docs) => { const made = docs.map(wrap); items.push(...made); return made; };
  actor.deleteEmbeddedDocuments = async (_t, ids) => {
    for (const id of ids) { const i = items.findIndex(x => x.id === id); if (i >= 0) items.splice(i, 1); }
    return ids;
  };
  return actor;
}

/** Модуль Агрессии на акторе: настоящие записи Конструктора из пака, меняемые Качество и «установлен». */
function addModule(actor, { quality = "common", installed = true } = {}) {
  const state = { quality, installed, applied: undefined };
  const flagsOf = () => ({ ...DOC.flags[FLAG], installed: state.installed, mechanicsApplied: state.applied });
  const item = {
    id: "aggr", type: "implant", name: DOC.name, parent: actor, effects: [],
    get system() { return { ...DOC.system, quality: state.quality }; },
    get flags() { return { [FLAG]: flagsOf() }; },
    getFlag: (_s, k) => flagsOf()[k],
    async setFlag(_s, k, v) { if (k === "mechanicsApplied") state.applied = v; },
    async unsetFlag() {},
    // Эффекты предмета (для записей kind:"characteristic"): простая коллекция.
    async createEmbeddedDocuments(_t, docs) {
      const made = docs.map((d, i) => ({ id: `fx-${item.effects.length + i}-${d.flags?.[FLAG]?.mechEntry}`, ...d,
        disabled: false, getFlag: (_s, k) => d.flags?.[FLAG]?.[k] }));
      item.effects.push(...made); return made;
    },
    async deleteEmbeddedDocuments(_t, ids) {
      for (const id of ids) { const i = item.effects.findIndex(x => x.id === id); if (i >= 0) item.effects.splice(i, 1); }
      return ids;
    },
    async updateEmbeddedDocuments() { return []; }
  };
  actor.items.push(item);
  return { item, state };
}

const names = actor => actor.items.filter(i => i.type === "talent").map(i => i.name.split(" / ")[0]).sort();

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

describe("Модуль Агрессии: записи в паке", () => {
  it("Таланты выдаются настоящими записями kind:talent с компендиумным uuid, а не только Возможностями", () => {
    const entries = DOC.flags[FLAG].mechanics.flatMap(g => g.entries);
    const talents = entries.filter(e => e.kind === "talent");
    expect(talents.map(e => e.sourceName.split(" / ")[0]).sort()).toEqual(["Cold Fury", "Fire in Blood", "Frenzy"]);
    for (const e of talents) expect(e.sourceUuid).toMatch(/^Compendium\.warhammer-dbc\.talents\.Item\.\w{16}$/);
    // Cold Fury и Fire in Blood — только Good и Best; Frenzy — без гейта.
    const q = n => entries.find(e => e.sourceName?.startsWith(n))?.when?.quality ?? null;
    expect(q("Frenzy")).toBeNull();
    expect(q("Cold Fury")).toEqual(["good", "best"]);
    expect(q("Fire in Blood")).toEqual(["good", "best"]);
  });

  it("выданные Таланты не дублируются Возможностями (нет двойного Frenzy/Cold Fury)", () => {
    const keys = DOC.flags[FLAG].mechanics.flatMap(g => g.entries).filter(e => e.kind === "capability")
      .map(e => e.capabilityKey);
    // Возможности — только собственные правила Модуля (не Таланты): штраф BS и, с пачки «поведение Ярости»,
    // Избегания без запрета и автоуспех выхода (test/rules/rage-behavior.test.mjs).
    expect(keys).toEqual(["rage.noBsPenalty", "rage.avoidWithoutLimit", "rage.exitAutoSuccess"]);
  });

  it("Poor.Q: −10 к I — запись «Характеристика» с гейтом по Качеству", () => {
    const e = DOC.flags[FLAG].mechanics.flatMap(g => g.entries).find(x => x.kind === "characteristic");
    expect(e).toMatchObject({ charKey: "int", field: "total", op: "subtract", value: 10 });
    expect(e.when.quality).toEqual(["poor"]);
  });
});

describe("Модуль Агрессии: выдача Талантов по Качеству и установке", () => {
  it("предмет опознаётся как ведомый живой синхронизацией", () => {
    const actor = makeActor();
    expect(hasLiveSyncedGrants(addModule(actor).item)).toBe(true);
  });

  for (const [quality, want] of [
    ["poor", ["Frenzy"]], ["common", ["Frenzy"]],
    ["good", ["Cold Fury", "Fire in Blood", "Frenzy"]], ["best", ["Cold Fury", "Fire in Blood", "Frenzy"]]
  ]) {
    it(`${quality}: установленный Модуль даёт ${want.join(", ")}`, async () => {
      const actor = makeActor();
      const { item } = addModule(actor, { quality });
      await syncLiveGrants(item);
      expect(names(actor)).toEqual(want);
      // выданное опознаётся по имени — то же, что видят требования Талантов и hasColdFury
      expect(hasAbility(actor, "ability.frenzy", "Frenzy", "talent")).toBe(true);
      expect(hasColdFury(actor)).toBe(want.includes("Cold Fury"));
    });
  }

  it("выданные Таланты отмечены как «дар»: бесплатные, не купленные", async () => {
    const actor = makeActor();
    const { item } = addModule(actor, { quality: "good" });
    await syncLiveGrants(item);
    for (const t of actor.items.filter(i => i.type === "talent")) {
      expect(t.system).toMatchObject({ granted: true, purchased: false, cost: 0 });
      expect(t.getFlag(FLAG, "grantedByItem")).toBe("aggr");
    }
  });

  it("Модуль в сумке (не установлен) Талантов не даёт", async () => {
    const actor = makeActor();
    const { item } = addModule(actor, { quality: "best", installed: false });
    await syncLiveGrants(item);
    expect(names(actor)).toEqual([]);
  });

  it("повторная сверка ничего не задваивает", async () => {
    const actor = makeActor();
    const { item } = addModule(actor, { quality: "best" });
    await syncLiveGrants(item);
    await syncLiveGrants(item);
    expect(names(actor)).toEqual(["Cold Fury", "Fire in Blood", "Frenzy"]);
  });

  it("смена Качества: Good → Common снимает Cold Fury и Fire in Blood, Frenzy остаётся; обратно — возвращает", async () => {
    const actor = makeActor();
    const { item, state } = addModule(actor, { quality: "good" });
    await syncLiveGrants(item);
    state.quality = "common";
    await onItemQualityChanged(item, { system: { quality: "common" } });
    expect(names(actor)).toEqual(["Frenzy"]);
    expect(hasColdFury(actor)).toBe(false);
    state.quality = "best";
    await onItemQualityChanged(item, { system: { quality: "best" } });
    expect(names(actor)).toEqual(["Cold Fury", "Fire in Blood", "Frenzy"]);
    expect(hasColdFury(actor)).toBe(true);
  });

  it("Холодная Ярость от Модуля снимает штраф к F в Ярости только пока выдана", async () => {
    const actor = makeActor();
    const { item, state } = addModule(actor, { quality: "good" });
    await syncLiveGrants(item);
    expect(rageRules(actor).some(r => r.id === "rage.penalty.fel")).toBe(false);
    state.quality = "common";
    await onItemQualityChanged(item, { system: { quality: "common" } });
    expect(rageRules(actor).some(r => r.id === "rage.penalty.fel")).toBe(true);
  });

  it("две сверки подряд без ожидания (быстрая смена Качества) не плодят дубли Талантов", async () => {
    const actor = makeActor();
    const { item } = addModule(actor, { quality: "best" });
    await Promise.all([syncLiveGrants(item), syncLiveGrants(item), syncLiveGrants(item)]);
    expect(names(actor)).toEqual(["Cold Fury", "Fire in Blood", "Frenzy"]);
  });

  it("извлечение импланта снимает все выданные Таланты, установка возвращает", async () => {
    const actor = makeActor();
    const { item, state } = addModule(actor, { quality: "best" });
    await syncLiveGrants(item);
    expect(names(actor)).toHaveLength(3);
    state.installed = false;
    await syncLiveGrants(item);
    expect(names(actor)).toEqual([]);
    state.installed = true;
    await syncLiveGrants(item);
    expect(names(actor)).toEqual(["Cold Fury", "Fire in Blood", "Frenzy"]);
  });

  it("свой купленный Талант не задваивается и не снимается вместе с имплантом", async () => {
    const actor = makeActor();
    actor.items.push({ id: "own-frenzy", type: "talent", name: "Frenzy / Ярость", system: {}, flags: {}, getFlag: () => undefined });
    const { item, state } = addModule(actor, { quality: "common" });
    await syncLiveGrants(item);
    expect(names(actor)).toEqual(["Frenzy"]);
    state.installed = false;
    await syncLiveGrants(item);
    expect(names(actor)).toEqual(["Frenzy"]);
  });

  it("предмет без записей с гейтом Качества живой синхронизации не подлежит (прочие импланты не тронуты)", async () => {
    const actor = makeActor();
    const plain = {
      id: "p", type: "implant", name: "Тест", parent: actor, system: {},
      flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "talent", sourceName: "Sprint / Спринт", sourceUuid: "Compendium.warhammer-dbc.talents.Item.zzzzzzzzzzzzzzzz" }] }] } },
      getFlag: (_s, k) => ({ mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "talent", sourceName: "Sprint / Спринт", sourceUuid: "Compendium.warhammer-dbc.talents.Item.zzzzzzzzzzzzzzzz" }] }] })[k]
    };
    actor.items.push(plain);
    expect(hasLiveSyncedGrants(plain)).toBe(false);
    await syncLiveGrants(plain);
    expect(names(actor)).toEqual([]);
  });

  it("получение предмета (applyItemMechanics): установленный — выдаёт, в сумке — нет, разовая выдача не обходит гейт Качества", async () => {
    const a1 = makeActor();
    const { item: installed } = addModule(a1, { quality: "common" });
    await applyItemMechanics(installed);
    expect(names(a1)).toEqual(["Frenzy"]);

    const a2 = makeActor();
    const { item: bag } = addModule(a2, { quality: "best", installed: false });
    await applyItemMechanics(bag);
    expect(names(a2)).toEqual([]);
  });
});

describe("Живая выдача не задевает чужое", () => {
  it("получение Модуля при уже купленном Frenzy не возвращает опыт и не дублирует Талант", async () => {
    const actor = makeActor();
    const updates = [];
    actor.update = async d => { updates.push(d); };
    actor.items.push({ id: "own-frenzy", type: "talent", name: "Frenzy / Ярость",
      system: { cost: 200, purchased: true }, flags: {}, getFlag: () => undefined });
    const { item } = addModule(actor, { quality: "common" });
    await applyItemMechanics(item);
    expect(names(actor)).toEqual(["Frenzy"]);
    expect(updates).toEqual([]);
  });

  it("не имплант (мутация) с записью по Качеству живой выдаче не подлежит", () => {
    const mech = [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "talent",
      sourceName: "Frenzy / Ярость", sourceUuid: "Compendium.warhammer-dbc.talents.Item.FP1xN9yNXHr9vWw8",
      when: { quality: ["good"] } }] }];
    const mutation = { id: "m", type: "mutation", system: {}, flags: { [FLAG]: { mechanics: mech } },
      getFlag: (_s, k) => ({ mechanics: mech })[k] };
    expect(hasLiveSyncedGrants(mutation)).toBe(false);
  });
});

describe("Модуль Агрессии: Poor.Q −10 к I", () => {
  const changesOf = item => item.effects.flatMap(fx => fx.system?.changes ?? []);

  it("Poor: эффект −10 к значению I; Common/Good/Best: эффекта нет; смена Качества пересобирает его", async () => {
    const actor = makeActor();
    const { item, state } = addModule(actor, { quality: "poor" });
    await syncMechanicsEffects(item);
    expect(changesOf(item)).toEqual([expect.objectContaining({ key: "system.characteristics.int.totalFx", type: "subtract", value: 10 })]);

    state.quality = "common";
    await onItemQualityChanged(item, { system: { quality: "common" } });
    expect(changesOf(item)).toEqual([]);

    state.quality = "poor";
    await onItemQualityChanged(item, { system: { quality: "poor" } });
    expect(changesOf(item)).toHaveLength(1);

    for (const q of ["good", "best"]) {
      state.quality = q;
      await onItemQualityChanged(item, { system: { quality: q } });
      expect(changesOf(item), q).toEqual([]);
    }
  });

  it("ключ эффекта доезжает до расчёта актора: I на 10 ниже", () => {
    const make = fx => {
      const system = new ACTOR_DATA_MODELS.character({}).toObject();
      system.characteristics.int.base = 40;
      system.characteristics.int.totalFx = fx;
      const items = []; items.get = () => null;
      WarhammerActor.prototype.prepareDerivedData.call({ type: "character", name: "x", system, items, getFlag: () => undefined });
      return system.characteristics.int.total;
    };
    expect(make(0)).toBe(40);
    expect(make(-10)).toBe(30);
  });
});

describe("Смена Качества других предметов не трогает чужую механику", () => {
  it("правка не Качества (описание) ничего не пересобирает", async () => {
    const actor = makeActor();
    const { item } = addModule(actor, { quality: "good", installed: true });
    await onItemQualityChanged(item, { system: { description: "x" } });
    expect(names(actor)).toEqual([]);
  });
});
