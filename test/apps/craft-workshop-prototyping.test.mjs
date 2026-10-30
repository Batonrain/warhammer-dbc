// test/apps/craft-workshop-prototyping.test.mjs
//
// Талант Prototyping / Прототипирование в Мастерской (корбук гл. 3, 3-3a64):
// память «что уже создавал» (rules/craft-memory.mjs) + три эффекта в расчёте и
// броске смены. Чистая логика — test/rules/craft-memory.test.mjs; здесь стык с
// окном: _resolve (Банк, -20 Улучшения), _rollShift (переброс, запись в память).

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";
import { CRAFTED_ITEMS_FLAG, recordCreation } from "../../module/rules/craft-memory.mjs";

const NS = "warhammer-dbc";
const PROTO = { type: "talent", name: "Prototyping / Прототипирование" };

function actor(id, name, { items = [], log } = {}) {
  const flags = log ? { [CRAFTED_ITEMS_FLAG]: log } : {};
  const a = {
    id, name, items, flags: { [NS]: flags },
    system: {
      characteristics: { int: { total: 40 } },
      skills: { techUse: { total: 50, rank: "trained" } },
      groupSkills: {}, fatigue: { value: 0 }
    },
    update: async () => {},
    getFlag: (_s, k) => a.flags[NS][k],
    setFlag: async (_s, k, v) => { a.flags[NS][k] = v; }
  };
  return a;
}

function newApp(over = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "Лазган Лукас", collapsed: false, mode: "craft",
    crafterId: "crafter-1", categoryKey: "explosive",
    rarity: 0, quality: "good", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: 20, improve: false, monotony: false,
    diceMode: "normal", slowShift: false, researchKind: "blueprint",
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false, bioCycle: 0, bioLog: [],
    skillChoices: {}, project: { accumulated: 0, shifts: 0, fatigue: 0 },
    ...over
  }];
  app.render = () => {};
  return app;
}

let crafter, helper;
beforeEach(() => {
  resetCaptured();
  crafter = actor("crafter-1", "Крейн", { items: [PROTO] });
  helper = actor("assistant-1", "Помощник");
  // Массив с get: _projectVM перечисляет game.actors (список крафтеров), остальное зовёт get.
  const byId = { "crafter-1": crafter, "assistant-1": helper };
  globalThis.game.actors = Object.assign([crafter, helper], { get: id => byId[id] ?? null });
});

const knows = (quality, name = "Лазган Лукас") => recordCreation({}, name, quality);

describe("Банк: мультипликатор Качества вдвое (числа книги)", () => {
  it("делал в Качестве ниже: Good.Q ×2 вместо ×4", () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    const app = newApp();
    expect(app._resolve(app.projects[0]).bank).toBe(40);
  });

  it("делал только в том же Качестве: Банк обычный (скидка — за Качество НИЖЕ)", () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("good");
    const app = newApp();
    expect(app._resolve(app.projects[0]).bank).toBe(80);
  });

  it("без Таланта память не работает: Банк обычный", () => {
    crafter.items = [];
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    const app = newApp();
    expect(app._resolve(app.projects[0]).bank).toBe(80);
  });

  it("другой предмет (название не совпало): Банк обычный", () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common", "Болтер");
    const app = newApp();
    expect(app._resolve(app.projects[0]).bank).toBe(80);
  });
});

describe("Улучшение: штраф −20", () => {
  it("предмет создан/ассистирован — штрафа нет; чужой или без Таланта — −20", () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    const app = newApp({ improve: true });
    expect(app._resolve(app.projects[0]).mods.improveMod).toBe(0);

    app.projects[0].title = "Что-то чужое";
    expect(app._resolve(app.projects[0]).mods.improveMod).toBe(-20);

    crafter.items = [];
    app.projects[0].title = "Лазган Лукас";
    expect(app._resolve(app.projects[0]).mods.improveMod).toBe(-20);
  });
});

describe("_rollShift: переброс", () => {
  it("делал в том же Качестве: два кубика, лучший берётся, карточка называет Талант", async () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("good");
    const app = newApp();
    captured.dice = [80, 20];
    await app._rollShift("p1");
    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Прототипирование");
    expect(captured.chat[0].content).toContain("отброшено 80");
  });

  it("делал только ниже или ничего: один кубик", async () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    const app = newApp();
    captured.nextRoll = 40;
    await app._rollShift("p1");
    expect(captured.rolls).toEqual(["1d100"]);
  });
});

describe("_rollShift: запись в память при завершении", () => {
  const finish = async app => {
    app.projects[0].project.accumulated = 79; // Банк Good.Q = 80
    captured.nextRoll = 10;
    await app._rollShift("p1");
  };

  it("готовое создание пишет предмет и Качество крафтеру — даже без Таланта", async () => {
    crafter.items = [];
    const app = newApp();
    await finish(app);
    const log = crafter.flags[NS][CRAFTED_ITEMS_FLAG];
    expect(Object.values(log)).toEqual([expect.objectContaining({ name: "Лазган Лукас", made: ["good"] })]);
    expect(captured.chat[0].content).toContain("Запомнено");
  });

  it("именованный ассистент получает пометку «ассистировал»", async () => {
    const app = newApp({ assistants: 1, assistantId: "assistant-1" });
    await finish(app);
    expect(Object.values(helper.flags[NS][CRAFTED_ITEMS_FLAG])).toEqual([expect.objectContaining({ made: [], assisted: true })]);
  });

  it("Улучшение, ремонт и Исследование «создания» не пишут", async () => {
    for (const over of [{ improve: true }, { repair: true }]) {
      const app = newApp(over);
      app.projects[0].baseBank = 1;
      app.projects[0].quality = "common";
      captured.nextRoll = 10;
      await app._rollShift("p1");
      expect(crafter.flags[NS][CRAFTED_ITEMS_FLAG]).toBeUndefined();
    }
  });

  it("проект без названия: ничего не пишется; у владельца Таланта карточка объясняет почему", async () => {
    const app = newApp({ title: "" });
    await finish(app);
    expect(crafter.flags[NS][CRAFTED_ITEMS_FLAG]).toBeUndefined();
    expect(captured.chat[0].content).toContain("без названия");
  });

  it("не пишется повторно, пока проект уже записан (смены после ГОТОВО)", async () => {
    const app = newApp();
    app.projects[0].project.accumulated = 500;
    app.projects[0].project.memoryRecorded = "лазган лукас|good";
    captured.nextRoll = 10;
    await app._rollShift("p1");
    expect(crafter.flags[NS][CRAFTED_ITEMS_FLAG]).toBeUndefined();
  });

  it("Банк опустился ниже накопленного без броска (параллельный проект в Качестве ниже) — запись не теряется", async () => {
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    const app = newApp();               // Good.Q: Банк 80, а по журналу Common — 40
    app.projects[0].project.accumulated = 50;
    captured.nextRoll = 90;             // провал: прогресс не растёт, но проект уже «готов»
    await app._rollShift("p1");
    const made = Object.values(crafter.flags[NS][CRAFTED_ITEMS_FLAG])[0].made;
    expect(made).toEqual(expect.arrayContaining(["common", "good"]));
  });

  it("после ГОТОВО следующие смены не повторяют «Запомнено»; смена названия — записывает заново", async () => {
    const app = newApp();
    app.projects[0].project.accumulated = 79;
    captured.nextRoll = 10;
    await app._rollShift("p1");
    await app._rollShift("p1");
    expect(captured.chat[0].content).toContain("Запомнено");
    expect(captured.chat[1].content).not.toContain("Запомнено");
    app.projects[0].title = "Лазган Лукас Мк.II";
    await app._rollShift("p1");
    expect(captured.chat[2].content).toContain("Запомнено");
    expect(Object.keys(crafter.flags[NS][CRAFTED_ITEMS_FLAG])).toHaveLength(2);
  });

  it("безымянный при готовности, названный позже — запись делается следующей сменой", async () => {
    const app = newApp({ title: "" });
    app.projects[0].project.accumulated = 500;
    captured.nextRoll = 10;
    await app._rollShift("p1");
    expect(crafter.flags[NS][CRAFTED_ITEMS_FLAG]).toBeUndefined();
    app.projects[0].title = "Лазган Лукас";
    await app._rollShift("p1");
    expect(crafter.flags[NS][CRAFTED_ITEMS_FLAG]).toBeDefined();
  });
});

describe("подсказка проекта", () => {
  it("безымянный — просит назвать; неизвестный — «запомнится»; известный — перечисляет выгоды", () => {
    const app = newApp({ title: "" });
    expect(app._projectVM(app.projects[0]).prototypingNote).toContain("назовите проект");
    app.projects[0].title = "Лазган Лукас";
    expect(app._projectVM(app.projects[0]).prototypingNote).toContain("ещё не создавался");
    crafter.flags[NS][CRAFTED_ITEMS_FLAG] = knows("common");
    expect(app._projectVM(app.projects[0]).prototypingNote).toContain("вдвое");
  });

  it("без Таланта подсказки нет", () => {
    crafter.items = [];
    const app = newApp();
    expect(app._projectVM(app.projects[0]).prototypingNote).toBe("");
  });
});
