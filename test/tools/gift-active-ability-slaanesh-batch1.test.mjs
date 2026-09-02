// test/tools/gift-active-ability-slaanesh-batch1.test.mjs
//
// wdbc-suwp, партия 3 (2 Дара Слаанеш): tools/_gift-active-ability-slaanesh-batch1.mjs
// перевёл Idol of Vanity и Narcissus — обе троттлятся «раз в Раунд»,
// бесплатны, эффект — карточка-напоминание (кросс-акторный штраф/W-тест
// намеренно не симулируются). Живой прогон настоящего packs-src через
// runMechScriptEntry.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/mutations/Дары_Богов/Слаанеш");

const FILES = {
  idolOfVanity: "Idol_of_Vanity___Идол_Тщеславия_nA2TV4qVVucoMyfn.json",
  narcissus:    "Narcissus___Нарцисс_8qxZRIA1IT3N7h2k.json"
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

function itemFor(doc, actor = null) {
  const store = { "warhammer-dbc.mechanics": doc.flags["warhammer-dbc"].mechanics };
  return {
    name: doc.name, actor,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
  };
}

// Карточка ссылается на actor.name — реминдер-запись без актора-владельца
// не рендерится (та же ситуация, что у любого kind:"script" вне листа
// актора), поэтому тесту всё равно нужен минимальный актор-стенд.
const actorStub = () => ({ id: "actor-1", name: "Тестовый Чемпион" });

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("Дары Слаанеш, партия 1 — обе несут ровно одну валидную kind:\"script\" запись", () => {
  it.each(Object.keys(FILES))("%s", key => {
    const { entry } = scriptEntryOf(loadDoc(key));
    expect(entry).toBeTruthy();
    expect(entry.code?.trim()).not.toBe("");
    expect(entry.label?.trim()).not.toBe("");
    expect(entry.scriptThrottleUnit).toBe("round");
    expect(entry.capabilityCostPool).toBe(""); // бесплатны
  });
});

describe.each(Object.keys(FILES))("%s — раз в Раунд, бесплатно", key => {
  it("гейтится Раундом, не пулом", async () => {
    globalThis.game.combat = { round: 1 };
    const doc = loadDoc(key);
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actorStub());

    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain(entry.label);

    await runMechScriptEntry(item, groupId, entry.id); // тот же Раунд
    expect(captured.chat).toHaveLength(1);
    expect(captured.warnings.length).toBe(1);

    globalThis.game.combat = { round: 2 };
    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(2);
  });
});
