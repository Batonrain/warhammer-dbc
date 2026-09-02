// test/tools/gift-active-ability-tzeentch-batch1.test.mjs
//
// wdbc-suwp, партия 4 (8 Даров Тзинча): tools/_gift-active-ability-tzeentch-batch1.mjs
// перевёл capability-заглушки в реальный kind:"script". Flame of Souls несёт
// первый в этой серии реальный ВЫБОР через DialogV2.confirm (captured.confirmAnswer
// в заглушке, test/support/foundry-stub.mjs) — 1 или 3 временных Очка
// Бесчестия в зависимости от ответа. Остальные — реминдер-карточки с ценой/
// частотой, где они есть в тексте книги (не у всех — Gatekeeper/Genius of
// Loki/Nine Thousand Faces/Thief of Fate намеренно без цены/троттлинга,
// см. комментарии в самом инструменте).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/mutations/Дары_Богов/Тзинч");

const FILES = {
  cauldronOfFlesh:   "Cauldron_of_Flesh___Кот_л_Плоти_ju41pinF1NCOmzVj.json",
  flameOfSouls:       "Flame_of_Souls___Пламя_Душ_7zXiJnjBINAGFHxb.json",
  gatekeeper:         "Gatekeeper___Привратник_qkngN9Hac4D3l73D.json",
  geniusOfLoki:       "Genius_of_Loki___Гений_Локи_K2eTFPqsLDEITh79.json",
  hyperanalich:       "Hyperanalich___Гипераналих_SxH6wGylDY2GFpXv.json",
  nineThousandFaces:  "Nine_Thousand_Faces___Девять_Тысяч_Лиц_lPXvgbB3spqdwo7z.json",
  pathchanger:        "Pathchanger___Изменяющий_Пути_mpiCAQbKumcNB13W.json",
  thiefOfFate:        "Thief_of_Fate___Вор_Судьбы_Olxzbl4P59icsara.json"
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

function actorFor(fate = { value: 2, max: 4 }) {
  const doc = { id: "actor-1", name: "Тестовый Чемпион", type: "character", system: { fate, characteristics: {} } };
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

describe("Дары Тзинча, партия 1 — все 8 несут ровно одну валидную kind:\"script\" запись", () => {
  it.each(Object.keys(FILES))("%s", key => {
    const { entry } = scriptEntryOf(loadDoc(key));
    expect(entry).toBeTruthy();
    expect(entry.code?.trim()).not.toBe("");
    expect(entry.label?.trim()).not.toBe("");
  });
});

describe("cauldronOfFlesh / pathchanger — цена 1 Очко Бесчестия, без троттлинга", () => {
  it.each(["cauldronOfFlesh", "pathchanger"])("%s: списывает при успехе, гейтится при нуле", async key => {
    const okActor = actorFor({ value: 1, max: 4 });
    const docOk = loadDoc(key);
    const { groupId, entry } = scriptEntryOf(docOk);
    await runMechScriptEntry(itemFor(docOk, okActor), groupId, entry.id);
    expect(okActor.system.fate.value).toBe(0);
    expect(captured.chat.length).toBeGreaterThan(0);

    resetCaptured();
    const brokeActor = actorFor({ value: 0, max: 4 });
    const docBroke = loadDoc(key);
    const broke = scriptEntryOf(docBroke);
    await runMechScriptEntry(itemFor(docBroke, brokeActor), broke.groupId, broke.entry.id);
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.length).toBe(1);
  });
});

describe.each(["gatekeeper", "geniusOfLoki", "nineThousandFaces", "thiefOfFate"])(
  "%s — без цены/троттлинга, только карточка",
  key => {
    it("выполняется свободно, сколько угодно раз, без пула", async () => {
      const actor = actorFor({ value: 0, max: 4 });
      const doc = loadDoc(key);
      const { groupId, entry } = scriptEntryOf(doc);
      const item = itemFor(doc, actor);
      await runMechScriptEntry(item, groupId, entry.id);
      await runMechScriptEntry(item, groupId, entry.id);
      expect(captured.chat).toHaveLength(2);
      expect(captured.warnings.length).toBe(0);
      expect(actor.system.fate.value).toBe(0);
    });
  }
);

describe("hyperanalich — раз в Ход (приближено Раундом), бесплатно", () => {
  it("гейтится Раундом", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("hyperanalich");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);
    expect(captured.warnings.length).toBe(1);
  });
});

describe("flameOfSouls — реальный выбор через DialogV2.confirm, временное Очко Бесчестия", () => {
  it("ответ «нет» (замечена) — начисляет 1", async () => {
    globalThis.game.combat = { round: 1 };
    captured.confirmAnswer = false;
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("flameOfSouls");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.getFlag("warhammer-dbc", "tempInfamy").amount).toBe(1);
    expect(actor.system.fate.value).toBe(0); // обычный пул не тронут
  });

  it("ответ «да» (не замечена) — начисляет 3", async () => {
    globalThis.game.combat = { round: 1 };
    captured.confirmAnswer = true;
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("flameOfSouls");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.getFlag("warhammer-dbc", "tempInfamy").amount).toBe(3);
  });

  it("раз в Раунд — второй запуск в том же Раунде блокируется", async () => {
    globalThis.game.combat = { round: 1 };
    captured.confirmAnswer = false;
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("flameOfSouls");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.getFlag("warhammer-dbc", "tempInfamy").amount).toBe(1);
    expect(captured.warnings.length).toBe(1);
  });
});
