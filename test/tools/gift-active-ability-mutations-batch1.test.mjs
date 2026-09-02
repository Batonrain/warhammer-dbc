// test/tools/gift-active-ability-mutations-batch1.test.mjs
//
// wdbc-suwp, партия 5 (последняя): tools/_gift-active-ability-mutations-batch1.mjs
// перевёл Eyes of Chaos и Twins — обе «раз в Раунд», бесплатны, реминдер-
// карточка. Illusion of Normality НЕ входит — постоянно действующая
// пассивная иллюзия без активации, осталась kind:"capability" (см. проверку
// ниже — этот тест заодно закрепляет, что её никто не тронул).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/mutations/Общие_мутации");

const FILES = {
  eyesOfChaos: "Eyes_of_Chaos___Глаза_Хаоса_U5BlbfojB0YMxHAf.json",
  twins:       "Twins___Близнецы_4ZbCZVle20Jt3HCG.json"
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

function actorFor() {
  return { id: "actor-1", name: "Тестовый Мутант" };
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

describe("Общие мутации, партия 1 — обе несут ровно одну валидную kind:\"script\" запись, раз в Раунд, бесплатно", () => {
  it.each(Object.keys(FILES))("%s", key => {
    const { entry } = scriptEntryOf(loadDoc(key));
    expect(entry).toBeTruthy();
    expect(entry.code?.trim()).not.toBe("");
    expect(entry.scriptThrottleUnit).toBe("round");
    expect(entry.capabilityCostPool).toBe("");
  });

  it.each(Object.keys(FILES))("%s: гейтится Раундом", async key => {
    globalThis.game.combat = { round: 1 };
    const doc = loadDoc(key);
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actorFor());

    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);
    expect(captured.warnings.length).toBe(1);
  });
});

describe("Illusion of Normality — НЕ мигрирована (пассивная, без активации)", () => {
  it("остаётся kind:\"capability\" с прежним capabilityKey", () => {
    const doc = JSON.parse(fs.readFileSync(path.join(DIR, "Illusion_of_Normality___Иллюзия_Нормальн_1GO1WxLJ6dhOw8n1.json"), "utf8"));
    const entry = doc.flags["warhammer-dbc"].mechanics[0].entries[0];
    expect(entry.kind).toBe("capability");
    expect(entry.capabilityKey).toBe("mutation.illusionOfNormality");
  });
});
