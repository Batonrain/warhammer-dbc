// test/tools/gift-active-ability-nurgle-batch1.test.mjs
//
// wdbc-suwp, партия 2 (2 Дара Нургла): tools/_gift-active-ability-nurgle-batch1.mjs
// перевёл Destructive Swarm (троттлинг «раз за бой», без цены) и Devourer of
// Suffering (без троттлинга/цены вовсе — в книге нет лимита частоты, только
// реальная автоматика восстановления 1 Очка). Живой прогон настоящего
// packs-src через runMechScriptEntry.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/mutations/Дары_Богов/Нургл");

const FILES = {
  destructiveSwarm:    "Destructive_Swarm___Разрушительный_Рой_SF0Jj2Bt4W65MQfe.json",
  devourerOfSuffering: "Devourer_of_Suffering___Поглотитель_Стра_oYWfYcPClHUJ3oRT.json"
};

function loadDoc(key) {
  return JSON.parse(fs.readFileSync(path.join(DIR, FILES[key]), "utf8"));
}

function scriptEntryOf(doc) {
  for (const group of doc.flags["warhammer-dbc"].mechanics) {
    const entry = group.entries.find(e => e.kind === "script");
    if (entry) return { groupId: group.id, entry };
  }
  return { groupId: null, entry: null };
}

function actorFor(fate = { value: 2, max: 4 }, over = {}) {
  const doc = { id: "actor-1", name: "Тестовый Чемпион", type: "character", system: { fate, characteristics: {}, ...over } };
  doc.update = async changes => {
    for (const [p, v] of Object.entries(changes)) {
      const keys = p.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
    return doc;
  };
  const flags = {};
  doc.getFlag = (scope, key) => flags[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { flags[`${scope}.${key}`] = value; return value; };
  return doc;
}

function itemFor(doc, actor = null) {
  const store = { "warhammer-dbc.mechanics": doc.flags["warhammer-dbc"].mechanics };
  return {
    name: doc.name, actor,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
  };
}

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("Дары Нургла, партия 1 — обе несут ровно одну валидную kind:\"script\" запись", () => {
  it.each(Object.keys(FILES))("%s", key => {
    const { entry } = scriptEntryOf(loadDoc(key));
    expect(entry).toBeTruthy();
    expect(entry.code?.trim()).not.toBe("");
    expect(entry.label?.trim()).not.toBe("");
  });
});

describe("destructiveSwarm — раз за бой, бесплатно", () => {
  it("гейтится боем (game.combat.id), не пулом", async () => {
    globalThis.game.combat = { id: "battle-1", round: 1 };
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("destructiveSwarm");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);

    await runMechScriptEntry(item, groupId, entry.id); // тот же бой
    expect(captured.chat).toHaveLength(1);
    expect(captured.warnings.length).toBe(1);

    globalThis.game.combat = { id: "battle-2", round: 1 };
    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(2);
  });
});

describe("devourerOfSuffering — без троттлинга/цены, реально восстанавливает 1 Очко", () => {
  it("обычный актор: system.fate.value +1, не выше max", async () => {
    const actor = actorFor({ value: 2, max: 4 });
    const doc = loadDoc("devourerOfSuffering");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.fate.value).toBe(3);
    expect(captured.chat).toHaveLength(1);
  });

  it("уже на максимуме — update не поднимает выше max", async () => {
    const actor = actorFor({ value: 4, max: 4 });
    const doc = loadDoc("devourerOfSuffering");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.fate.value).toBe(4);
  });

  it("Демон-Принц — восстанавливает dp.ip, максимум = Inf.b, не fate.value", async () => {
    const actor = actorFor(
      { value: 99, max: 99 },
      { type: "demonPrince", dp: { ip: 1 }, characteristics: { inf: { bonus: 3 } } }
    );
    actor.type = "demonPrince";
    const doc = loadDoc("devourerOfSuffering");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.dp.ip).toBe(2);
    expect(actor.system.fate.value).toBe(99); // не тронуто
  });

  it("нет троттлинга — можно запускать многократно подряд без гейта", async () => {
    const actor = actorFor({ value: 0, max: 10 });
    const doc = loadDoc("devourerOfSuffering");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    await runMechScriptEntry(item, groupId, entry.id);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.fate.value).toBe(3);
    expect(captured.warnings.length).toBe(0);
  });
});
