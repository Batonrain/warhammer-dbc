// test/tools/gift-active-ability-khorne-batch1.test.mjs
//
// wdbc-suwp, партия 1 (Дары Кхорна): tools/_gift-active-ability-khorne-batch1.mjs
// перевёл 7 записей из kind:"capability"-заглушки в реальный kind:"script" с
// ценой/частотой (wdbc-1dc8/wdbc-f4jt). Тест гоняет НАСТОЯЩИЙ code из
// packs-src через runMechScriptEntry — не пересказ, а живой прогон каждого
// файла: цена списывается/гейтится, троттлинг работает, «Жрец Кровопролития»
// реально начисляет временное Очко Бесчестия (module/rules/temp-infamy.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/mutations/Дары_Богов/Кхорн");

const FILES = {
  avengersStride:    "Avenger_s_Stride___Шаг_Мстителя_Iqux9O19e1y25oTr.json",
  challengeOfHonour: "Challenge_of_Honour___Вызов_Чести_QAi2ecmgby1hSIFS.json",
  charioteer:        "Charioteer___Колесничий_fVLerNvY6L1TyA7Z.json",
  fontOfBlood:       "Font_of_Blood___Кровавая_Купель_sOvci5GhSNtsnzkN.json",
  livingWeapon:      "Living_Weapon___Живое_Оружие_hRwi2DatRrINumVS.json",
  priestOfBloodshed: "Priest_of_Bloodshed___Жрец_Кровопролития_PYgA6tKKRyvio3mE.json",
  purityOfBattle:    "Purity_of_Battle___Чистота_Битвы_4Sdz3wYLKDm7jGcQ.json"
};

function loadDoc(key) {
  return JSON.parse(fs.readFileSync(path.join(DIR, FILES[key]), "utf8"));
}

function scriptEntryOf(doc) {
  const group = doc.flags["warhammer-dbc"].mechanics[0];
  const entry = group.entries.find(e => e.kind === "script");
  return { groupId: group.id, entry };
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
  doc.unsetFlag = async (scope, key) => { delete flags[`${scope}.${key}`]; };
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

describe("Дары Кхорна, партия 1 — все 7 несут ровно одну валидную kind:\"script\" запись", () => {
  it.each(Object.keys(FILES))("%s", key => {
    const { entry } = scriptEntryOf(loadDoc(key));
    expect(entry).toBeTruthy();
    expect(entry.code?.trim()).not.toBe("");
    expect(entry.label?.trim()).not.toBe("");
  });
});

describe.each([
  ["challengeOfHonour", "infamy", 1],
  ["charioteer", "infamy", 1],
  ["fontOfBlood", "infamy", 1],
  ["livingWeapon", "infamy", 1],
  ["purityOfBattle", "infamy", 1]
])("%s — цена %s×%i", (key, pool, amount) => {
  it("хватает в пуле: код выполняется, цена списывается, карточка постится", async () => {
    const actor = actorFor({ value: 2, max: 4 });
    const doc = loadDoc(key);
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.fate.value).toBe(2 - amount);
    // 2 карточки: своя (текст записи) + общая от spendCapabilityCost («Потрачено: …»).
    expect(captured.chat).toHaveLength(2);
    expect(captured.chat.some(c => c.content.includes(entry.label))).toBe(true);
  });

  it("не хватает в пуле: код не выполняется, предупреждение", async () => {
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc(key);
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.system.fate.value).toBe(0);
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.length).toBe(1);
  });
});

describe("avengersStride — раз в Раунд, бесплатно", () => {
  it("гейтится Раундом, не пулом", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorFor({ value: 0, max: 4 }); // пустой пул — не должен мешать
    const doc = loadDoc("avengersStride");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(1);
    expect(actor.system.fate.value).toBe(0); // бесплатно — пул не тронут

    await runMechScriptEntry(item, groupId, entry.id); // тот же Раунд
    expect(captured.chat).toHaveLength(1); // второй не прошёл
    expect(captured.warnings.length).toBe(1);

    globalThis.game.combat = { round: 2 };
    await runMechScriptEntry(item, groupId, entry.id);
    expect(captured.chat).toHaveLength(2);
  });
});

describe("priestOfBloodshed — раз в Раунд, бесплатно, реально начисляет временное Очко Бесчестия", () => {
  it("успешный запуск заводит flags.warhammer-dbc.tempInfamy и постит карточку", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorFor({ value: 0, max: 4 });
    const doc = loadDoc("priestOfBloodshed");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.getFlag("warhammer-dbc", "tempInfamy")).toEqual({
      amount: 1, source: "Priest of Bloodshed / Жрец Кровопролития",
      restriction: "тратится как обычное Очко Бесчестия, сгорает в конце следующего Хода чемпиона"
    });
    expect(actor.system.fate.value).toBe(0); // обычный пул не тронут — это ДРУГАЯ валюта
    expect(captured.chat).toHaveLength(1);
  });

  it("два срабатывания в разных Раундах складывают временный запас", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorFor();
    const doc = loadDoc("priestOfBloodshed");
    const { groupId, entry } = scriptEntryOf(doc);
    const item = itemFor(doc, actor);

    await runMechScriptEntry(item, groupId, entry.id);
    globalThis.game.combat = { round: 2 };
    await runMechScriptEntry(item, groupId, entry.id);
    expect(actor.getFlag("warhammer-dbc", "tempInfamy").amount).toBe(2);
  });
});
